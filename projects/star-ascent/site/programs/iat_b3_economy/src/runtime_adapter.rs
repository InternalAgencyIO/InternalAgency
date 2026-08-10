//! Feature-gated, read-only Solana runtime bridge for the held B3 economy port.
//!
//! This module reads immutable facts from real [`AccountInfo`] values and the
//! `Clock`/`Rent` sysvars, then delegates to the existing strict host kernels.
//! It has no entrypoint, instruction decoder, mutable account borrow, account
//! write, CPI, token operation, or public dispatcher. Runtime program, mint,
//! Daily Law, and network identities remain inputs to opaque bindings and are
//! not accepted from instruction data here.

use crate::native_adapter::{
    authenticate_signer, authenticate_state_account, authenticate_system_payer, derive_pda,
    prepare_create_state_account, prepare_existing_state_write, AuthenticatedSigner,
    AuthenticatedStateAccount, AuthenticatedSystemPayer, NativeAccountObservation,
    NativeAdapterError, NativeEconomyBinding, PdaIdentity, StateWriteIntent, StrictStateValue,
};
use crate::{
    decode_config_genesis_state, verify_daily_law_open, CanonicalDailyLawBinding,
    ConfigGenesisCodecError, ConfigGenesisState, EconomyError, ReadonlyDailyLawAccount,
    ValidatedDailyLawWrite,
};
use sha2::{Digest, Sha256};
use solana_account_info::AccountInfo;
use solana_clock::Clock;
use solana_rent::Rent;
use solana_sysvar::Sysvar;

pub const RUNTIME_ACCOUNT_BRIDGE_STATUS: &str =
    "FEATURE_GATED_READ_ONLY_ACCOUNTINFO_CLOCK_RENT_NO_DISPATCH";
pub const CONFIG_GENESIS_RUNTIME_STATUS: &str =
    "FEATURE_GATED_READ_ONLY_CONFIG_PARSER_PHASE_TRANSITIONS_UNRESOLVED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisRuntimeTruth {
    pub feature_gated: bool,
    pub requires_open_daily_law_capability: bool,
    pub immutable_account_borrow_only: bool,
    pub binding_relative_config_identity_checked: bool,
    pub production_identity_binding_frozen: bool,
    pub owner_bootstrap_policy_accepted: bool,
    pub phase_transition_predicate_frozen: bool,
    pub genesis_conservation_proved: bool,
    pub transition_authorized: bool,
    pub account_writes_executed: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const CONFIG_GENESIS_RUNTIME_TRUTH: ConfigGenesisRuntimeTruth = ConfigGenesisRuntimeTruth {
    feature_gated: true,
    requires_open_daily_law_capability: true,
    immutable_account_borrow_only: true,
    binding_relative_config_identity_checked: true,
    production_identity_binding_frozen: false,
    owner_bootstrap_policy_accepted: false,
    phase_transition_predicate_frozen: false,
    genesis_conservation_proved: false,
    transition_authorized: false,
    account_writes_executed: false,
    instruction_abi_frozen: false,
    entrypoint_exposed: false,
    dispatcher_exposed: false,
    any_handler_complete: false,
    mainnet_hold: true,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeAccountBridgeTruth {
    pub feature_gated: bool,
    pub account_info_reads: bool,
    pub clock_sysvar_authenticated: bool,
    pub rent_sysvar_authenticated: bool,
    pub mutable_account_borrows: bool,
    pub account_writes_executed: bool,
    pub system_cpi_executed: bool,
    pub token_cpi_executed: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub production_identity_binding_frozen: bool,
    pub config_codec_supported: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const RUNTIME_ACCOUNT_BRIDGE_TRUTH: RuntimeAccountBridgeTruth = RuntimeAccountBridgeTruth {
    feature_gated: true,
    account_info_reads: true,
    clock_sysvar_authenticated: true,
    rent_sysvar_authenticated: true,
    mutable_account_borrows: false,
    account_writes_executed: false,
    system_cpi_executed: false,
    token_cpi_executed: false,
    instruction_abi_frozen: false,
    entrypoint_exposed: false,
    dispatcher_exposed: false,
    production_identity_binding_frozen: false,
    // Aggregate handler/write-adapter support remains blocked. The separate
    // parser below produces only a read-only observation.
    config_codec_supported: false,
    any_handler_complete: false,
    mainnet_hold: true,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeAdapterError {
    Economy(EconomyError),
    Native(NativeAdapterError),
    ConfigGenesisCodec(ConfigGenesisCodecError),
    AccountBorrowFailed,
    ConfigAccountMustBeReadOnly,
    ConfigMintMismatch,
    ConfigBumpMismatch,
    ClockSysvarUnavailable,
    RentSysvarUnavailable,
}

impl From<EconomyError> for RuntimeAdapterError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

impl From<NativeAdapterError> for RuntimeAdapterError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<ConfigGenesisCodecError> for RuntimeAdapterError {
    fn from(value: ConfigGenesisCodecError) -> Self {
        Self::ConfigGenesisCodec(value)
    }
}

/// Opaque result of the feature-gated read-only Config parser. Private fields
/// prevent callers from manufacturing this observation, but the value still
/// carries no phase-transition or write authorization.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyConfigGenesisAccount {
    key: [u8; 32],
    state: ConfigGenesisState,
    preimage_sha256: [u8; 32],
}

impl ReadonlyConfigGenesisAccount {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn state(&self) -> ConfigGenesisState {
        self.state
    }

    pub const fn preimage_sha256(&self) -> [u8; 32] {
        self.preimage_sha256
    }
}

fn with_account_observation<T>(
    account: &AccountInfo<'_>,
    operation: impl FnOnce(NativeAccountObservation<'_>) -> Result<T, NativeAdapterError>,
) -> Result<T, RuntimeAdapterError> {
    let lamports = account
        .try_borrow_lamports()
        .map_err(|_| RuntimeAdapterError::AccountBorrowFailed)?;
    let data = account
        .try_borrow_data()
        .map_err(|_| RuntimeAdapterError::AccountBorrowFailed)?;
    operation(NativeAccountObservation {
        key: account.key.to_bytes(),
        owner: account.owner.to_bytes(),
        lamports: **lamports,
        data: &data,
        is_signer: account.is_signer,
        is_writable: account.is_writable,
        executable: account.executable,
    })
    .map_err(RuntimeAdapterError::Native)
}

fn require_daily_law_header(
    binding: &CanonicalDailyLawBinding,
    law_state: &AccountInfo<'_>,
) -> Result<(), RuntimeAdapterError> {
    if law_state.key.to_bytes() != binding.law_state_address()
        || law_state.owner.to_bytes() != binding.law_program_id()
        || law_state.is_writable
        || law_state.executable
    {
        return Err(RuntimeAdapterError::Economy(
            EconomyError::NonCanonicalDailyLawAccount,
        ));
    }
    Ok(())
}

fn verify_daily_law_open_at_clock(
    binding: &CanonicalDailyLawBinding,
    law_state: &AccountInfo<'_>,
    clock: &Clock,
) -> Result<ValidatedDailyLawWrite, RuntimeAdapterError> {
    require_daily_law_header(binding, law_state)?;
    let data = law_state
        .try_borrow_data()
        .map_err(|_| RuntimeAdapterError::AccountBorrowFailed)?;
    verify_daily_law_open(
        binding,
        ReadonlyDailyLawAccount::new(
            law_state.key.to_bytes(),
            law_state.owner.to_bytes(),
            law_state.is_writable,
            &data,
        ),
        clock.unix_timestamp,
    )
    .map_err(RuntimeAdapterError::Economy)
}

/// Derive the opaque open-Day capability from a real read-only law account and
/// the runtime Clock sysvar. No timestamp or disposition is caller supplied.
#[inline(never)]
pub fn verify_daily_law_open_account_info(
    binding: &CanonicalDailyLawBinding,
    law_state: &AccountInfo<'_>,
) -> Result<ValidatedDailyLawWrite, RuntimeAdapterError> {
    require_daily_law_header(binding, law_state)?;
    let clock = Clock::get().map_err(|_| RuntimeAdapterError::ClockSysvarUnavailable)?;
    verify_daily_law_open_at_clock(binding, law_state, &clock)
}

pub fn authenticate_signer_account_info(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    expected_key: [u8; 32],
    must_be_writable: bool,
) -> Result<AuthenticatedSigner, RuntimeAdapterError> {
    with_account_observation(account, |observed| {
        authenticate_signer(gate, binding, observed, expected_key, must_be_writable)
    })
}

pub fn authenticate_system_payer_account_info(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    expected_key: [u8; 32],
) -> Result<AuthenticatedSystemPayer, RuntimeAdapterError> {
    with_account_observation(account, |observed| {
        authenticate_system_payer(gate, binding, observed, expected_key)
    })
}

#[inline(never)]
pub fn authenticate_state_account_info(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    expected_identity: PdaIdentity,
) -> Result<AuthenticatedStateAccount, RuntimeAdapterError> {
    with_account_observation(account, |observed| {
        authenticate_state_account(gate, binding, observed, expected_identity)
    })
}

/// Parse the binding-relative economy Config PDA only after Daily Law has
/// produced an opaque open-Day capability. The account meta must itself be
/// read-only. This function never selects or authorizes a Genesis phase edge
/// and never returns a mutable or executable intent.
pub fn parse_config_genesis_account_info(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
) -> Result<ReadonlyConfigGenesisAccount, RuntimeAdapterError> {
    if gate.mint() != binding.mint() {
        return Err(RuntimeAdapterError::Native(
            NativeAdapterError::LawMintMismatch,
        ));
    }
    let identity = PdaIdentity::Config {
        mint: binding.mint(),
    };
    let derived = derive_pda(binding, identity).map_err(RuntimeAdapterError::Native)?;
    if account.key.to_bytes() != derived.key {
        return Err(RuntimeAdapterError::Native(
            NativeAdapterError::AccountKeyMismatch,
        ));
    }
    if account.owner.to_bytes() != binding.program_id() {
        return Err(RuntimeAdapterError::Native(
            NativeAdapterError::AccountOwnerMismatch,
        ));
    }
    if account.is_writable {
        return Err(RuntimeAdapterError::ConfigAccountMustBeReadOnly);
    }
    if account.executable {
        return Err(RuntimeAdapterError::Native(
            NativeAdapterError::AccountMustNotBeExecutable,
        ));
    }
    if account.is_signer {
        return Err(RuntimeAdapterError::Native(
            NativeAdapterError::PdaAccountMustNotBeSigner,
        ));
    }

    let data = account
        .try_borrow_data()
        .map_err(|_| RuntimeAdapterError::AccountBorrowFailed)?;
    let state = decode_config_genesis_state(&data)?;
    if state.config.mint != binding.mint() {
        return Err(RuntimeAdapterError::ConfigMintMismatch);
    }
    if state.config.bump != derived.bump {
        return Err(RuntimeAdapterError::ConfigBumpMismatch);
    }
    Ok(ReadonlyConfigGenesisAccount {
        key: derived.key,
        state,
        preimage_sha256: Sha256::digest(&*data).into(),
    })
}

/// Authenticate one existing strict state account from `AccountInfo` and
/// prepare its owned CAS postimage. This does not reborrow or write the account.
#[inline(never)]
pub fn prepare_existing_state_write_account_info(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    expected_identity: PdaIdentity,
    next: StrictStateValue,
) -> Result<StateWriteIntent, RuntimeAdapterError> {
    let authenticated = authenticate_state_account_info(gate, binding, account, expected_identity)?;
    prepare_existing_state_write(gate, binding, &authenticated, next)
        .map_err(RuntimeAdapterError::Native)
}

fn prepare_create_state_account_with_rent(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    authenticated_payer: &AuthenticatedSystemPayer,
    target: &AccountInfo<'_>,
    identity: PdaIdentity,
    initial_state: StrictStateValue,
    rent: &Rent,
) -> Result<StateWriteIntent, RuntimeAdapterError> {
    let rent_minimum_lamports = rent.minimum_balance(initial_state.kind().account_len());
    with_account_observation(target, |observed| {
        prepare_create_state_account(
            gate,
            binding,
            authenticated_payer,
            observed,
            identity,
            initial_state,
            rent_minimum_lamports,
        )
    })
}

/// Authenticate a real system-owned payer and vacant target, derive the exact
/// codec length, and source its rent minimum from the runtime Rent sysvar. The
/// returned value is still an inert intent; no allocation, funding, or write is
/// executed here.
#[inline(never)]
pub fn prepare_create_state_account_info(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    payer: &AccountInfo<'_>,
    expected_payer_key: [u8; 32],
    target: &AccountInfo<'_>,
    identity: PdaIdentity,
    initial_state: StrictStateValue,
) -> Result<StateWriteIntent, RuntimeAdapterError> {
    let authenticated_payer =
        authenticate_system_payer_account_info(gate, binding, payer, expected_payer_key)?;
    let rent = Rent::get().map_err(|_| RuntimeAdapterError::RentSysvarUnavailable)?;
    prepare_create_state_account_with_rent(
        gate,
        binding,
        &authenticated_payer,
        target,
        identity,
        initial_state,
        &rent,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_adapter::{derive_pda, CreatePdaLifecycle, StrictStateKind};
    use crate::{EligibilityState, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION};
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_sdk_ids::system_program;

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const OWNER: [u8; 32] = [0xA1; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    fn decision() -> SolanaDailyDecision {
        let local_day = protocol_local_day(CLOCK_TIMESTAMP);
        for candidate in 0u16..=u8::MAX.into() {
            let mut hash = [0u8; 32];
            hash[31] = candidate as u8;
            let decision =
                create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
            if !decision.locked {
                return decision;
            }
        }
        panic!("test vector search did not find an open decision")
    }

    fn law_data() -> [u8; LAW_STATE_LEN] {
        let decision = decision();
        let mut data = [0u8; LAW_STATE_LEN];
        data[0..8].copy_from_slice(LAW_STATE_MAGIC);
        data[8] = LAW_STATE_VERSION;
        data[9] = LAW_BUMP;
        data[10] = 1;
        data[11] = u8::from(decision.locked);
        data[16..48].copy_from_slice(&MINT);
        data[48..80].copy_from_slice(&NETWORK);
        data[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
        data[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
        data[96..128].copy_from_slice(&decision.ancestor_slot_hash);
        data[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
        data[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
        data[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
        data[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
        data
    }

    #[test]
    fn injected_clock_seam_proves_success_without_exposing_a_timestamp_api() {
        let binding =
            CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK);
        let key = LAW_STATE.into();
        let owner = LAW_PROGRAM.into();
        let mut lamports = 1;
        let mut data = law_data();
        let account = AccountInfo::new(&key, false, false, &mut lamports, &mut data, &owner, false);
        let clock = Clock {
            unix_timestamp: CLOCK_TIMESTAMP,
            ..Clock::default()
        };
        let gate = verify_daily_law_open_at_clock(&binding, &account, &clock).unwrap();
        assert_eq!(gate.unix_timestamp(), CLOCK_TIMESTAMP);
        assert_eq!(gate.mint(), MINT);
    }

    #[test]
    fn injected_rent_seam_uses_exact_codec_length_without_writing_accounts() {
        let law_binding =
            CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK);
        let law_key = LAW_STATE.into();
        let law_owner = LAW_PROGRAM.into();
        let mut law_lamports = 1;
        let mut data = law_data();
        let law_account = AccountInfo::new(
            &law_key,
            false,
            false,
            &mut law_lamports,
            &mut data,
            &law_owner,
            false,
        );
        let clock = Clock {
            unix_timestamp: CLOCK_TIMESTAMP,
            ..Clock::default()
        };
        let gate = verify_daily_law_open_at_clock(&law_binding, &law_account, &clock).unwrap();

        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let identity = PdaIdentity::Eligibility {
            config: binding.config(),
            operator: OWNER,
        };
        let derived = derive_pda(&binding, identity).unwrap();
        let initial_state = StrictStateValue::Eligibility(EligibilityState {
            config: binding.config(),
            wallet: OWNER,
            agency_index: u32::MAX,
            role: 0,
            bump: derived.bump,
        });

        let payer_key = OWNER.into();
        let system_owner = system_program::id().to_bytes().into();
        let target_key = derived.key.into();
        let mut payer_lamports = 10_000_000;
        let mut payer_data = [];
        let mut target_lamports = 0;
        let mut target_data = [];
        let payer = AccountInfo::new(
            &payer_key,
            true,
            true,
            &mut payer_lamports,
            &mut payer_data,
            &system_owner,
            false,
        );
        let target = AccountInfo::new(
            &target_key,
            false,
            true,
            &mut target_lamports,
            &mut target_data,
            &system_owner,
            false,
        );
        let authenticated_payer =
            authenticate_system_payer_account_info(&gate, &binding, &payer, OWNER).unwrap();
        let rent = Rent::default();
        let intent = prepare_create_state_account_with_rent(
            &gate,
            &binding,
            &authenticated_payer,
            &target,
            identity,
            initial_state,
            &rent,
        )
        .unwrap();
        let StateWriteIntent::Create(create) = intent else {
            panic!("expected create intent")
        };
        assert_eq!(create.lifecycle(), CreatePdaLifecycle::CreateAccount);
        assert_eq!(
            create.data_len(),
            StrictStateKind::Eligibility.account_len()
        );
        assert_eq!(
            create.rent_minimum_lamports(),
            rent.minimum_balance(StrictStateKind::Eligibility.account_len())
        );
        assert_eq!(target.data_len(), 0);
        assert_eq!(target.lamports(), 0);
    }
}

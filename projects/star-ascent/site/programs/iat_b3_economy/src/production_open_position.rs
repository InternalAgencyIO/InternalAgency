//! Strict retained-V2 `open_position` base-account composition.
//!
//! This module freezes the canonical instruction and twelve V2 account roles,
//! authenticates every state identity needed by the retained pre-token-CPI
//! kernel, and returns an opaque pre-CPI plan. The B3-only Daily-Law hook,
//! ingress-authority, hook-meta, confidential-proof, Token-2022 CPI, completed
//! Position lifecycle, and Config/lane CAS remain in the separate stake-ingress
//! runtime. No executor, dispatcher, entrypoint, or complete-handler claim is
//! exposed here.

use crate::native_adapter::{
    derive_pda, NativeAdapterError, NativeEconomyBinding, PdaIdentity, StrictStateValue,
};
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_account_lifecycle::{require_system_program, RuntimeAccountLifecycleError};
use crate::runtime_adapter::{
    authenticate_production_active_writable_config_account_info,
    authenticate_runtime_production_active_writable_config, authenticate_state_account_info,
    authenticate_system_payer_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
    RuntimeValidatedDailyLawWrite,
};
use crate::stake_ingress_runtime::{observe_stake_ingress_source, observe_stake_ingress_vault};
use crate::{
    decode_eligibility_state, prepare_open_position, CodecError, EconomyError, EligibilityState,
    LaneState, OpenPositionPreCpiPlan, PrepareOpenPositionInput, ValidatedDailyLawWrite, ECOSYSTEM,
    LIQUIDITY, TREASURY,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use solana_sdk_ids::system_program;
use spl_token_2022_interface::ID as TOKEN_2022_PROGRAM_ID;

pub const PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT: usize = 12;
pub const PRODUCTION_OPEN_POSITION_STATUS: &str =
    "EXACT_V2_BASE_ACCOUNTS_PRE_TOKEN_CPI_PLAN_NO_EXECUTOR_NO_ENTRYPOINT_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionOpenPositionTruth {
    pub feature_gated: bool,
    pub exact_instruction_codec_required: bool,
    pub runtime_daily_law_capability_supported: bool,
    pub production_active_writable_config_required: bool,
    pub exact_twelve_v2_account_order_and_flags_required: bool,
    pub owner_and_readonly_eligibility_bound: bool,
    pub exact_vault_authority_and_stake_token_owner_bound: bool,
    pub exact_three_lane_pdas_authenticated: bool,
    pub exact_position_pda_target_authenticated: bool,
    pub retained_v2_pre_token_cpi_kernel_used: bool,
    pub canonical_confidential_mint_policy_authenticated: bool,
    pub hooked_token_cpi_executed: bool,
    pub completed_position_lifecycle_executed: bool,
    pub config_and_lane_cas_executed: bool,
    pub supplemental_b3_account_graph_frozen: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_OPEN_POSITION_TRUTH: ProductionOpenPositionTruth =
    ProductionOpenPositionTruth {
        feature_gated: true,
        exact_instruction_codec_required: true,
        runtime_daily_law_capability_supported: true,
        production_active_writable_config_required: true,
        exact_twelve_v2_account_order_and_flags_required: true,
        owner_and_readonly_eligibility_bound: true,
        exact_vault_authority_and_stake_token_owner_bound: true,
        exact_three_lane_pdas_authenticated: true,
        exact_position_pda_target_authenticated: true,
        retained_v2_pre_token_cpi_kernel_used: true,
        canonical_confidential_mint_policy_authenticated: false,
        hooked_token_cpi_executed: false,
        completed_position_lifecycle_executed: false,
        config_and_lane_cas_executed: false,
        supplemental_b3_account_graph_frozen: false,
        production_dispatcher_exposed: false,
        production_entrypoint_exposed: false,
        handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Debug, Eq, PartialEq)]
pub enum ProductionOpenPositionError {
    Instruction(ProductionInstructionError),
    WrongInstruction,
    AccountCountMismatch,
    AccountBindingMismatch,
    AccountMetaMismatch,
    EligibilityCodec(CodecError),
    StateTypeMismatch,
    OwnerTokenRejected,
    StakeTokenRejected,
    Runtime(RuntimeAdapterError),
    Native(NativeAdapterError),
    Lifecycle(RuntimeAccountLifecycleError),
    Economy(EconomyError),
}

impl From<ProductionInstructionError> for ProductionOpenPositionError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

impl From<RuntimeAdapterError> for ProductionOpenPositionError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<NativeAdapterError> for ProductionOpenPositionError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<RuntimeAccountLifecycleError> for ProductionOpenPositionError {
    fn from(value: RuntimeAccountLifecycleError) -> Self {
        Self::Lifecycle(value)
    }
}

impl From<EconomyError> for ProductionOpenPositionError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PreparedProductionOpenPosition {
    owner: [u8; 32],
    config: [u8; 32],
    vault_authority: [u8; 32],
    position: [u8; 32],
    plan: OpenPositionPreCpiPlan,
}

impl PreparedProductionOpenPosition {
    pub const fn owner(&self) -> [u8; 32] {
        self.owner
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn vault_authority(&self) -> [u8; 32] {
        self.vault_authority
    }

    pub const fn position(&self) -> [u8; 32] {
        self.position
    }

    pub const fn plan(&self) -> &OpenPositionPreCpiPlan {
        &self.plan
    }
}

/// Runtime production preparation from an opaque live Daily-Law capability.
/// The writable Config is authenticated against the same Law observation.
#[inline(never)]
pub fn prepare_runtime_production_open_position_account_infos(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionOpenPosition, ProductionOpenPositionError> {
    let (position_id, principal) = require_open_position_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let active_config =
        authenticate_runtime_production_active_writable_config(runtime_law, binding, &accounts[1])?;
    prepare_with_active_config(
        runtime_law.gate(),
        &active_config,
        binding,
        accounts,
        position_id,
        principal,
    )
}

/// Host/rehearsal seam. Final runtime composition must use
/// [`prepare_runtime_production_open_position_account_infos`] so the Law
/// account and Clock remain runtime-authenticated facts.
#[inline(never)]
pub fn prepare_production_open_position_account_infos(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionOpenPosition, ProductionOpenPositionError> {
    let (position_id, principal) = require_open_position_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let active_config =
        authenticate_production_active_writable_config_account_info(gate, binding, &accounts[1])?;
    prepare_with_active_config(
        gate,
        &active_config,
        binding,
        accounts,
        position_id,
        principal,
    )
}

fn require_open_position_instruction(
    instruction_data: &[u8],
) -> Result<(u64, u64), ProductionOpenPositionError> {
    match decode_production_instruction(instruction_data)? {
        ProductionInstruction::OpenPosition {
            position_id,
            principal,
        } => Ok((position_id, principal)),
        _ => Err(ProductionOpenPositionError::WrongInstruction),
    }
}

fn require_exact_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionOpenPositionError> {
    if accounts.len() != PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT {
        return Err(ProductionOpenPositionError::AccountCountMismatch);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn prepare_with_active_config(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
    position_id: u64,
    principal: u64,
) -> Result<PreparedProductionOpenPosition, ProductionOpenPositionError> {
    let owner = accounts[0].key.to_bytes();
    authenticate_system_payer_account_info(gate, binding, &accounts[0], owner)?;
    require_mint_meta(binding, &accounts[3])?;
    require_token_program(&accounts[10])?;
    require_system_program(&accounts[11])?;

    let config = active_config.state().config;
    if config.mint != binding.mint()
        || config.token_program != TOKEN_2022_PROGRAM_ID.to_bytes()
        || config.stake_token_account != accounts[5].key.to_bytes()
    {
        return Err(ProductionOpenPositionError::AccountBindingMismatch);
    }

    let vault_authority_identity = PdaIdentity::VaultAuthority {
        config: active_config.key(),
    };
    let vault_authority = derive_pda(binding, vault_authority_identity)?;
    if vault_authority.bump != config.vault_authority_bump {
        return Err(ProductionOpenPositionError::AccountBindingMismatch);
    }

    let eligibility =
        authenticate_readonly_eligibility(binding, &accounts[2], active_config.key(), owner)?;
    let source = observe_stake_ingress_source(&accounts[4], accounts[3].key, accounts[0].key)
        .map_err(|_| ProductionOpenPositionError::OwnerTokenRejected)?;
    let vault_authority_key = Pubkey::new_from_array(vault_authority.key);
    let stake = observe_stake_ingress_vault(&accounts[5], accounts[3].key, &vault_authority_key)
        .map_err(|_| ProductionOpenPositionError::StakeTokenRejected)?;
    let treasury = authenticate_lane(gate, binding, &accounts[6], active_config.key(), TREASURY)?;
    let ecosystem = authenticate_lane(gate, binding, &accounts[7], active_config.key(), ECOSYSTEM)?;
    let liquidity = authenticate_lane(gate, binding, &accounts[8], active_config.key(), LIQUIDITY)?;

    let position_identity = PdaIdentity::Position {
        config: active_config.key(),
        operator: owner,
        position_id,
    };
    let position = derive_pda(binding, position_identity)?;
    require_create_target(&accounts[9], position.key)?;

    let plan = prepare_open_position(
        gate,
        PrepareOpenPositionInput {
            config_key: active_config.key(),
            config,
            owner,
            mint: binding.mint(),
            owner_tokens: source.token,
            vault_authority: vault_authority.key,
            stake_tokens: stake,
            eligibility,
            treasury,
            ecosystem,
            liquidity,
            position_id,
            principal,
            position_bump: position.bump,
        },
    )?;

    Ok(PreparedProductionOpenPosition {
        owner,
        config: active_config.key(),
        vault_authority: vault_authority.key,
        position: position.key,
        plan,
    })
}

fn require_mint_meta(
    binding: &NativeEconomyBinding,
    mint: &AccountInfo<'_>,
) -> Result<(), ProductionOpenPositionError> {
    if mint.key.to_bytes() != binding.mint() || mint.owner != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionOpenPositionError::AccountBindingMismatch);
    }
    if mint.is_signer || mint.is_writable || mint.executable {
        return Err(ProductionOpenPositionError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_token_program(program: &AccountInfo<'_>) -> Result<(), ProductionOpenPositionError> {
    if program.key != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionOpenPositionError::AccountBindingMismatch);
    }
    if program.is_signer || program.is_writable || !program.executable {
        return Err(ProductionOpenPositionError::AccountMetaMismatch);
    }
    Ok(())
}

fn authenticate_readonly_eligibility(
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
    owner: [u8; 32],
) -> Result<EligibilityState, ProductionOpenPositionError> {
    let identity = PdaIdentity::Eligibility {
        config,
        operator: owner,
    };
    let derived = derive_pda(binding, identity)?;
    if account.key.to_bytes() != derived.key || account.owner.to_bytes() != binding.program_id() {
        return Err(ProductionOpenPositionError::AccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionOpenPositionError::AccountMetaMismatch);
    }
    let data = account.try_borrow_data().map_err(|_| {
        ProductionOpenPositionError::Runtime(RuntimeAdapterError::AccountBorrowFailed)
    })?;
    let state =
        decode_eligibility_state(&data).map_err(ProductionOpenPositionError::EligibilityCodec)?;
    if state.config != config
        || state.wallet != owner
        || state.bump != derived.bump
        || state.role > 2
    {
        return Err(ProductionOpenPositionError::AccountBindingMismatch);
    }
    Ok(state)
}

fn authenticate_lane(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
    lane: u8,
) -> Result<LaneState, ProductionOpenPositionError> {
    let authenticated = authenticate_state_account_info(
        gate,
        binding,
        account,
        PdaIdentity::LaneState { config, lane },
    )?;
    match authenticated.state() {
        StrictStateValue::Lane(state) => Ok(state),
        _ => Err(ProductionOpenPositionError::StateTypeMismatch),
    }
}

fn require_create_target(
    target: &AccountInfo<'_>,
    expected_key: [u8; 32],
) -> Result<(), ProductionOpenPositionError> {
    if target.key.to_bytes() != expected_key || target.owner != &system_program::ID {
        return Err(ProductionOpenPositionError::AccountBindingMismatch);
    }
    if target.is_signer || !target.is_writable || target.executable {
        return Err(ProductionOpenPositionError::AccountMetaMismatch);
    }
    let data = target.try_borrow_data().map_err(|_| {
        ProductionOpenPositionError::Lifecycle(RuntimeAccountLifecycleError::AccountBorrowFailed)
    })?;
    if !data.is_empty() {
        return Err(ProductionOpenPositionError::Native(
            NativeAdapterError::VacantAccountDataNotEmpty,
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::{
        encode_config_genesis_state, encode_eligibility_state, encode_lane_state,
        verify_daily_law_open, CanonicalDailyLawBinding, ConfigGenesisState, ConfigState,
        GenesisPhase, ReadonlyDailyLawAccount, CONFIG_GENESIS_ACCOUNT_LEN, ELIGIBILITY_ACCOUNT_LEN,
        LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, MAINNET_SUPPLY,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_pubkey::Pubkey;
    use solana_sdk_ids::{native_loader, system_program};
    use spl_token_2022_interface::{
        extension::{
            transfer_hook::TransferHookAccount, AccountType, BaseStateWithExtensionsMut,
            ExtensionType, StateWithExtensionsMut,
        },
        state::{Account as TokenAccount, AccountState},
    };

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const OWNER: [u8; 32] = [0xA1; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    fn binding() -> NativeEconomyBinding {
        NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
    }

    fn open_gate() -> ValidatedDailyLawWrite {
        let decision = open_decision(CLOCK_TIMESTAMP);
        let data = pack_law_state(decision);
        verify_daily_law_open(
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
            CLOCK_TIMESTAMP,
        )
        .unwrap()
    }

    fn open_decision(timestamp: i64) -> SolanaDailyDecision {
        let local_day = protocol_local_day(timestamp);
        for candidate in 0u16..=u8::MAX.into() {
            let mut hash = [0u8; 32];
            hash[31] = candidate as u8;
            let decision =
                create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
            if !decision.locked {
                return decision;
            }
        }
        panic!("test vector search did not find an open disposition")
    }

    fn pack_law_state(decision: SolanaDailyDecision) -> [u8; LAW_STATE_LEN] {
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

    fn encoded(instruction: ProductionInstruction) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut data = [0u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(instruction, &mut data).unwrap();
        data
    }

    fn token_data(mint: [u8; 32], owner: [u8; 32], amount: u64) -> Vec<u8> {
        let extensions = [ExtensionType::TransferHookAccount];
        let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state =
            StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Account);
        state.base = TokenAccount {
            mint: mint.into(),
            owner: owner.into(),
            amount,
            state: AccountState::Initialized,
            ..TokenAccount::default()
        };
        state.init_extension::<TransferHookAccount>(false).unwrap();
        state.pack_base();
        data
    }

    fn lane(binding: &NativeEconomyBinding, lane: u8) -> ([u8; 32], Vec<u8>) {
        let identity = PdaIdentity::LaneState {
            config: binding.config(),
            lane,
        };
        let token = derive_pda(
            binding,
            PdaIdentity::LaneToken {
                config: binding.config(),
                lane,
            },
        )
        .unwrap();
        let state = LaneState {
            config: binding.config(),
            token_account: token.key,
            beneficiary: [0xA0 | lane; 32],
            total: 1_000_000,
            genesis_unlocked: 1_000_000,
            cliff_week: 0,
            linear_end_week: 104,
            reserved: 0,
            paid: 0,
            principal_claimed: 0,
            lane,
            reward_source: true,
            bump: derive_pda(binding, identity).unwrap().bump,
            token_bump: token.bump,
        };
        let mut data = [0u8; LANE_ACCOUNT_LEN];
        encode_lane_state(&state, &mut data).unwrap();
        (derive_pda(binding, identity).unwrap().key, data.to_vec())
    }

    struct TestAccount {
        key: Pubkey,
        owner: Pubkey,
        lamports: u64,
        data: Vec<u8>,
        signer: bool,
        writable: bool,
        executable: bool,
    }

    impl TestAccount {
        fn info(&mut self) -> AccountInfo<'_> {
            AccountInfo::new(
                &self.key,
                self.signer,
                self.writable,
                &mut self.lamports,
                &mut self.data,
                &self.owner,
                self.executable,
            )
        }
    }

    struct Fixture {
        owner: TestAccount,
        config: TestAccount,
        eligibility: TestAccount,
        mint: TestAccount,
        owner_tokens: TestAccount,
        stake_tokens: TestAccount,
        treasury: TestAccount,
        ecosystem: TestAccount,
        liquidity: TestAccount,
        position: TestAccount,
        token_program: TestAccount,
        system: TestAccount,
    }

    impl Fixture {
        fn new(binding: &NativeEconomyBinding, position_id: u64) -> Self {
            let vault_authority = derive_pda(
                binding,
                PdaIdentity::VaultAuthority {
                    config: binding.config(),
                },
            )
            .unwrap();
            let stake_key = derive_pda(
                binding,
                PdaIdentity::StakeToken {
                    config: binding.config(),
                },
            )
            .unwrap()
            .key;
            let config_state = ConfigGenesisState {
                phase: GenesisPhase::Active,
                config: ConfigState {
                    admin: [0x21; 32],
                    mint: MINT,
                    token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
                    randomness_program: [0x44; 32],
                    stake_token_account: stake_key,
                    agency_registry_hash: [0x66; 32],
                    genesis_timestamp: CLOCK_TIMESTAMP - 60,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: 100,
                    agency_count: 0,
                    rehearsal_mode: false,
                    active: true,
                    lane_mask: 0b1_1110,
                    stake_vault_initialized: true,
                    bump: binding.config_bump(),
                    vault_authority_bump: vault_authority.bump,
                },
            };
            let mut config_data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
            encode_config_genesis_state(&config_state, &mut config_data).unwrap();

            let eligibility_identity = PdaIdentity::Eligibility {
                config: binding.config(),
                operator: OWNER,
            };
            let eligibility_derived = derive_pda(binding, eligibility_identity).unwrap();
            let eligibility_state = EligibilityState {
                config: binding.config(),
                wallet: OWNER,
                agency_index: u32::MAX,
                role: 0,
                bump: eligibility_derived.bump,
            };
            let mut eligibility_data = [0u8; ELIGIBILITY_ACCOUNT_LEN];
            encode_eligibility_state(&eligibility_state, &mut eligibility_data).unwrap();

            let (treasury_key, treasury_data) = lane(binding, TREASURY);
            let (ecosystem_key, ecosystem_data) = lane(binding, ECOSYSTEM);
            let (liquidity_key, liquidity_data) = lane(binding, LIQUIDITY);
            let position = derive_pda(
                binding,
                PdaIdentity::Position {
                    config: binding.config(),
                    operator: OWNER,
                    position_id,
                },
            )
            .unwrap();

            Self {
                owner: TestAccount {
                    key: OWNER.into(),
                    owner: system_program::ID,
                    lamports: 10_000_000,
                    data: Vec::new(),
                    signer: true,
                    writable: true,
                    executable: false,
                },
                config: TestAccount {
                    key: binding.config().into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: config_data.to_vec(),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                eligibility: TestAccount {
                    key: eligibility_derived.key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: eligibility_data.to_vec(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                mint: TestAccount {
                    key: MINT.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                owner_tokens: TestAccount {
                    key: [0x71; 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(MINT, OWNER, 10_000),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                stake_tokens: TestAccount {
                    key: stake_key.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(MINT, vault_authority.key, 100),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                treasury: TestAccount {
                    key: treasury_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: treasury_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                ecosystem: TestAccount {
                    key: ecosystem_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: ecosystem_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                liquidity: TestAccount {
                    key: liquidity_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: liquidity_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                position: TestAccount {
                    key: position.key.into(),
                    owner: system_program::ID,
                    lamports: 0,
                    data: Vec::new(),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                token_program: TestAccount {
                    key: TOKEN_2022_PROGRAM_ID,
                    owner: [0x99; 32].into(),
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
                system: TestAccount {
                    key: system_program::ID,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
            }
        }

        fn with_infos<R>(
            &mut self,
            operation: impl FnOnce(&mut [AccountInfo<'_>; PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT]) -> R,
        ) -> R {
            let mut infos = [
                self.owner.info(),
                self.config.info(),
                self.eligibility.info(),
                self.mint.info(),
                self.owner_tokens.info(),
                self.stake_tokens.info(),
                self.treasury.info(),
                self.ecosystem.info(),
                self.liquidity.info(),
                self.position.info(),
                self.token_program.info(),
                self.system.info(),
            ];
            operation(&mut infos)
        }

        fn mutation_snapshot(&self) -> [Vec<u8>; 7] {
            [
                self.config.data.clone(),
                self.owner_tokens.data.clone(),
                self.stake_tokens.data.clone(),
                self.treasury.data.clone(),
                self.ecosystem.data.clone(),
                self.liquidity.data.clone(),
                self.position.data.clone(),
            ]
        }
    }

    #[test]
    fn exact_base_accounts_produce_the_retained_v2_pre_cpi_plan_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::OpenPosition {
            position_id: 7,
            principal: 100,
        });
        let mut fixture = Fixture::new(&binding, 7);
        let before = fixture.mutation_snapshot();
        fixture.with_infos(|accounts| {
            let prepared = prepare_production_open_position_account_infos(
                &gate,
                &binding,
                &instruction,
                accounts,
            )
            .unwrap();
            let expected_vault = derive_pda(
                &binding,
                PdaIdentity::VaultAuthority {
                    config: binding.config(),
                },
            )
            .unwrap();
            assert_eq!(prepared.owner(), OWNER);
            assert_eq!(prepared.config(), binding.config());
            assert_eq!(prepared.vault_authority(), expected_vault.key);
            assert_eq!(prepared.position(), accounts[9].key.to_bytes());
            assert_eq!(prepared.plan().position_id, 7);
            assert_eq!(prepared.plan().principal, 100);
            assert_eq!(prepared.plan().owner, OWNER);
            assert_eq!(prepared.plan().transfer.source, accounts[4].key.to_bytes());
            assert_eq!(
                prepared.plan().transfer.destination,
                accounts[5].key.to_bytes()
            );
        });
        assert_eq!(fixture.mutation_snapshot(), before);
    }

    #[test]
    fn every_adjacent_slot_swap_fails_without_writing_any_candidate_account() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::OpenPosition {
            position_id: 7,
            principal: 100,
        });

        for index in 0..(PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT - 1) {
            let mut fixture = Fixture::new(&binding, 7);
            let before = fixture.mutation_snapshot();
            fixture.with_infos(|accounts| {
                accounts.swap(index, index + 1);
                assert!(prepare_production_open_position_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                )
                .is_err());
            });
            assert_eq!(fixture.mutation_snapshot(), before, "slot swap {index}");
        }
    }

    #[test]
    fn every_base_account_meta_bit_is_exact_and_fail_closed() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::OpenPosition {
            position_id: 7,
            principal: 100,
        });

        for index in 0..PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT {
            for flag in 0..3 {
                let mut fixture = Fixture::new(&binding, 7);
                let before = fixture.mutation_snapshot();
                fixture.with_infos(|accounts| {
                    match flag {
                        0 => accounts[index].is_signer = !accounts[index].is_signer,
                        1 => accounts[index].is_writable = !accounts[index].is_writable,
                        2 => accounts[index].executable = !accounts[index].executable,
                        _ => unreachable!(),
                    }
                    assert!(prepare_production_open_position_account_infos(
                        &gate,
                        &binding,
                        &instruction,
                        accounts,
                    )
                    .is_err());
                });
                assert_eq!(
                    fixture.mutation_snapshot(),
                    before,
                    "meta flip account {index}, flag {flag}"
                );
            }
        }
    }

    #[test]
    fn wrong_instruction_count_order_identity_and_policy_fail_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let valid = encoded(ProductionInstruction::OpenPosition {
            position_id: 7,
            principal: 100,
        });
        let wrong = encoded(ProductionInstruction::ClosePosition);
        let mut fixture = Fixture::new(&binding, 7);
        let before = fixture.mutation_snapshot();
        fixture.with_infos(|accounts| {
            assert_eq!(
                prepare_production_open_position_account_infos(&gate, &binding, &wrong, accounts),
                Err(ProductionOpenPositionError::WrongInstruction)
            );
            assert_eq!(
                prepare_production_open_position_account_infos(
                    &gate,
                    &binding,
                    &valid,
                    &accounts[..11],
                ),
                Err(ProductionOpenPositionError::AccountCountMismatch)
            );
            accounts.swap(2, 3);
            assert_eq!(
                prepare_production_open_position_account_infos(&gate, &binding, &valid, accounts),
                Err(ProductionOpenPositionError::AccountBindingMismatch)
            );
            accounts.swap(2, 3);
        });
        assert_eq!(fixture.mutation_snapshot(), before);

        let mut wrong_position = Fixture::new(&binding, 7);
        wrong_position.position.key = Pubkey::new_unique();
        wrong_position.with_infos(|accounts| {
            assert_eq!(
                prepare_production_open_position_account_infos(&gate, &binding, &valid, accounts),
                Err(ProductionOpenPositionError::AccountBindingMismatch)
            );
        });

        let zero = encoded(ProductionInstruction::OpenPosition {
            position_id: 7,
            principal: 0,
        });
        let mut zero_principal = Fixture::new(&binding, 7);
        zero_principal.with_infos(|accounts| {
            assert_eq!(
                prepare_production_open_position_account_infos(&gate, &binding, &zero, accounts,),
                Err(ProductionOpenPositionError::Economy(
                    EconomyError::ZeroPrincipal
                ))
            );
        });
    }

    #[test]
    fn late_lane_borrow_conflict_preserves_every_candidate_preimage() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::OpenPosition {
            position_id: 7,
            principal: 100,
        });
        let mut fixture = Fixture::new(&binding, 7);
        fixture.with_infos(|accounts| {
            let held = accounts[8].try_borrow_mut_data().unwrap();
            let before = held.to_vec();
            assert_eq!(
                prepare_production_open_position_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                ),
                Err(ProductionOpenPositionError::Runtime(
                    RuntimeAdapterError::AccountBorrowFailed
                ))
            );
            assert_eq!(&held[..], before.as_slice());
        });
    }

    #[test]
    fn truth_is_pre_cpi_only_and_unconditionally_held() {
        let truth = PRODUCTION_OPEN_POSITION_TRUTH;
        assert!(truth.feature_gated);
        assert!(truth.exact_instruction_codec_required);
        assert!(truth.runtime_daily_law_capability_supported);
        assert!(truth.production_active_writable_config_required);
        assert!(truth.exact_twelve_v2_account_order_and_flags_required);
        assert!(truth.owner_and_readonly_eligibility_bound);
        assert!(truth.exact_vault_authority_and_stake_token_owner_bound);
        assert!(truth.exact_three_lane_pdas_authenticated);
        assert!(truth.exact_position_pda_target_authenticated);
        assert!(truth.retained_v2_pre_token_cpi_kernel_used);
        assert!(!truth.canonical_confidential_mint_policy_authenticated);
        assert!(!truth.hooked_token_cpi_executed);
        assert!(!truth.completed_position_lifecycle_executed);
        assert!(!truth.config_and_lane_cas_executed);
        assert!(!truth.supplemental_b3_account_graph_frozen);
        assert!(!truth.production_dispatcher_exposed);
        assert!(!truth.production_entrypoint_exposed);
        assert!(!truth.handler_complete);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_OPEN_POSITION_STATUS.contains("MAINNET_HOLD"));
    }
}

//! Strict retained-V2 non-core `claim_lane_principal` composition and CAS seam.
//!
//! The public surface stops at the exact pre-token-CPI plan. An internal seam
//! can reload the source and destination Token-2022 accounts after a future
//! hook-aware executor, prove their exact transfer delta, apply V2's deliberately
//! post-CPI `principal_claimed` update, and seal one existing-state CAS intent.
//! Core-team custody remains explicitly unresolved. This module exposes no token
//! executor, CAS executor, dispatcher, entrypoint, or complete-handler claim.

extern crate alloc;

use alloc::boxed::Box;

use crate::native_adapter::{
    derive_pda, prepare_existing_state_write, seal_atomic_write_batch, AtomicWriteBatch,
    AuthenticatedStateAccount, NativeAdapterError, NativeEconomyBinding, PdaIdentity,
    StrictStateValue,
};
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_adapter::{
    authenticate_production_active_config_account_info,
    authenticate_runtime_production_active_config, authenticate_signer_account_info,
    authenticate_state_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
    RuntimeValidatedDailyLawWrite,
};
use crate::stake_ingress::SourceTokenState;
use crate::stake_ingress_runtime::{observe_stake_ingress_source, observe_stake_ingress_vault};
use crate::{
    prepare_claim_lane_principal, ClaimLanePrincipalPreCpiPlan, EconomyError, LaneState,
    PrepareClaimLanePrincipalInput, ReadonlyTokenState, ValidatedDailyLawWrite,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use spl_token_2022_interface::ID as TOKEN_2022_PROGRAM_ID;

pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT: usize = 8;
pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_WRITE_COUNT: usize = 1;
pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_STATUS: &str =
    "NON_CORE_PRE_CPI_COMPOSITION_INTERNAL_POST_RELOAD_CAS_NO_EXECUTOR_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionClaimLanePrincipalTruth {
    pub feature_gated: bool,
    pub exact_instruction_codec_required: bool,
    pub runtime_daily_law_capability_supported: bool,
    pub production_active_readonly_config_required: bool,
    pub exact_eight_account_order_and_flags_required: bool,
    pub arbitrary_readonly_signer_caller_preserved: bool,
    pub exact_lane_and_companion_token_pdas_authenticated: bool,
    pub stored_beneficiary_destination_authenticated: bool,
    pub non_core_lanes_supported: bool,
    pub core_team_custody_rejected: bool,
    pub retained_v2_pre_token_cpi_kernel_used: bool,
    pub post_transfer_runtime_token_reloads_required: bool,
    pub exact_lane_state_cas_sealable_after_reloads: bool,
    pub hooked_token_cpi_executed: bool,
    pub cas_executor_exposed: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_TRUTH: ProductionClaimLanePrincipalTruth =
    ProductionClaimLanePrincipalTruth {
        feature_gated: true,
        exact_instruction_codec_required: true,
        runtime_daily_law_capability_supported: true,
        production_active_readonly_config_required: true,
        exact_eight_account_order_and_flags_required: true,
        arbitrary_readonly_signer_caller_preserved: true,
        exact_lane_and_companion_token_pdas_authenticated: true,
        stored_beneficiary_destination_authenticated: true,
        non_core_lanes_supported: true,
        core_team_custody_rejected: true,
        retained_v2_pre_token_cpi_kernel_used: true,
        post_transfer_runtime_token_reloads_required: true,
        exact_lane_state_cas_sealable_after_reloads: true,
        hooked_token_cpi_executed: false,
        cas_executor_exposed: false,
        production_dispatcher_exposed: false,
        production_entrypoint_exposed: false,
        handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Debug, Eq, PartialEq)]
pub enum ProductionClaimLanePrincipalError {
    Instruction(ProductionInstructionError),
    WrongInstruction,
    AccountCountMismatch,
    AccountBindingMismatch,
    AccountMetaMismatch,
    SourceTokenRejected,
    DestinationTokenRejected,
    TokenReloadIdentityMismatch,
    TokenReloadAmountMismatch,
    TokenBalanceArithmetic,
    StateTypeMismatch,
    Runtime(RuntimeAdapterError),
    Native(NativeAdapterError),
    Economy(EconomyError),
}

impl From<ProductionInstructionError> for ProductionClaimLanePrincipalError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

impl From<RuntimeAdapterError> for ProductionClaimLanePrincipalError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<NativeAdapterError> for ProductionClaimLanePrincipalError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<EconomyError> for ProductionClaimLanePrincipalError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

#[derive(Debug, Eq, PartialEq)]
pub struct PreparedProductionClaimLanePrincipal {
    caller: [u8; 32],
    config: [u8; 32],
    lane_account: [u8; 32],
    vault_authority: [u8; 32],
    plan: Box<ClaimLanePrincipalPreCpiPlan>,
    authenticated_lane: AuthenticatedStateAccount,
    source_before: ReadonlyTokenState,
    destination_before: SourceTokenState,
}

impl PreparedProductionClaimLanePrincipal {
    pub const fn caller(&self) -> [u8; 32] {
        self.caller
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn lane_account(&self) -> [u8; 32] {
        self.lane_account
    }

    pub const fn vault_authority(&self) -> [u8; 32] {
        self.vault_authority
    }

    pub const fn plan(&self) -> &ClaimLanePrincipalPreCpiPlan {
        &self.plan
    }

    /// Internal post-transfer boundary only. The caller must be the future
    /// ordered hook-aware token executor holding the same live AccountInfos.
    /// This function validates exact reloads and seals CAS, but never invokes
    /// Token-2022 or executes the returned state batch.
    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn seal_post_transfer_cas_account_infos(
        self,
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
        source_account: &AccountInfo<'_>,
        destination_account: &AccountInfo<'_>,
    ) -> Result<
        AtomicWriteBatch<PRODUCTION_CLAIM_LANE_PRINCIPAL_WRITE_COUNT>,
        ProductionClaimLanePrincipalError,
    > {
        let mint = Pubkey::new_from_array(self.plan.config_snapshot.mint);
        let source_after = observe_stake_ingress_vault(
            source_account,
            &mint,
            &Pubkey::new_from_array(self.vault_authority),
        )
        .map_err(|_| ProductionClaimLanePrincipalError::SourceTokenRejected)?;
        let destination_after = observe_stake_ingress_source(
            destination_account,
            &mint,
            &Pubkey::new_from_array(self.plan.lane_snapshot.beneficiary),
        )
        .map_err(|_| ProductionClaimLanePrincipalError::DestinationTokenRejected)?;
        self.require_exact_reload_delta(source_after, destination_after)?;

        // Retained V2 updates principal_claimed only after its transfer CPI.
        // Keeping this checked-add here preserves the exact late boundary.
        let mut lane = self.plan.lane_snapshot;
        lane.principal_claimed = lane
            .principal_claimed
            .checked_add(self.plan.claimable)
            .ok_or(ProductionClaimLanePrincipalError::Economy(
                EconomyError::ArithmeticOverflow,
            ))?;
        let intent = prepare_existing_state_write(
            gate,
            binding,
            &self.authenticated_lane,
            StrictStateValue::Lane(lane),
        )?;
        seal_atomic_write_batch(gate, binding, [intent]).map_err(Into::into)
    }

    #[cfg_attr(not(test), allow(dead_code))]
    fn require_exact_reload_delta(
        &self,
        source_after: ReadonlyTokenState,
        destination_after: SourceTokenState,
    ) -> Result<(), ProductionClaimLanePrincipalError> {
        if source_after.key != self.source_before.key
            || source_after.mint != self.source_before.mint
            || source_after.owner != self.source_before.owner
            || source_after.key != self.plan.transfer.source
        {
            return Err(ProductionClaimLanePrincipalError::TokenReloadIdentityMismatch);
        }
        let expected_source = self
            .source_before
            .amount
            .checked_sub(self.plan.claimable)
            .ok_or(ProductionClaimLanePrincipalError::TokenBalanceArithmetic)?;
        if source_after.amount != expected_source {
            return Err(ProductionClaimLanePrincipalError::TokenReloadAmountMismatch);
        }

        if destination_after.token.key != self.destination_before.token.key
            || destination_after.token.mint != self.destination_before.token.mint
            || destination_after.token.owner != self.destination_before.token.owner
            || destination_after.delegate != self.destination_before.delegate
            || destination_after.cpi_guard_locked != self.destination_before.cpi_guard_locked
            || destination_after.token.key != self.plan.transfer.destination
        {
            return Err(ProductionClaimLanePrincipalError::TokenReloadIdentityMismatch);
        }
        let expected_destination = self
            .destination_before
            .token
            .amount
            .checked_add(self.plan.claimable)
            .ok_or(ProductionClaimLanePrincipalError::TokenBalanceArithmetic)?;
        if destination_after.token.amount != expected_destination {
            return Err(ProductionClaimLanePrincipalError::TokenReloadAmountMismatch);
        }
        Ok(())
    }
}

#[inline(never)]
pub fn prepare_runtime_production_claim_lane_principal_account_infos(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionClaimLanePrincipal, ProductionClaimLanePrincipalError> {
    let lane = require_claim_lane_principal_instruction(instruction_data)?;
    require_account_count(accounts)?;
    let active_config =
        authenticate_runtime_production_active_config(runtime_law, binding, &accounts[1])?;
    prepare_with_active_config(runtime_law.gate(), &active_config, binding, accounts, lane)
}

/// Host/rehearsal seam. Runtime composition must use
/// [`prepare_runtime_production_claim_lane_principal_account_infos`] so the Law
/// account and Clock are runtime-authenticated facts.
#[inline(never)]
pub fn prepare_production_claim_lane_principal_account_infos(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionClaimLanePrincipal, ProductionClaimLanePrincipalError> {
    let lane = require_claim_lane_principal_instruction(instruction_data)?;
    require_account_count(accounts)?;
    let active_config =
        authenticate_production_active_config_account_info(gate, binding, &accounts[1])?;
    prepare_with_active_config(gate, &active_config, binding, accounts, lane)
}

fn require_claim_lane_principal_instruction(
    instruction_data: &[u8],
) -> Result<u8, ProductionClaimLanePrincipalError> {
    match decode_production_instruction(instruction_data)? {
        ProductionInstruction::ClaimLanePrincipal { lane } => Ok(lane),
        _ => Err(ProductionClaimLanePrincipalError::WrongInstruction),
    }
}

fn require_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionClaimLanePrincipalError> {
    if accounts.len() != PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT {
        return Err(ProductionClaimLanePrincipalError::AccountCountMismatch);
    }
    Ok(())
}

fn prepare_with_active_config(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
    lane: u8,
) -> Result<PreparedProductionClaimLanePrincipal, ProductionClaimLanePrincipalError> {
    let caller = authenticate_caller(gate, binding, &accounts[0])?;
    let config = active_config.state().config;
    if config.mint != binding.mint() || config.token_program != TOKEN_2022_PROGRAM_ID.to_bytes() {
        return Err(ProductionClaimLanePrincipalError::AccountBindingMismatch);
    }
    require_mint_meta(binding, &accounts[2])?;
    require_token_program(&accounts[7])?;

    let vault_authority = derive_pda(
        binding,
        PdaIdentity::VaultAuthority {
            config: active_config.key(),
        },
    )?;
    if vault_authority.bump != config.vault_authority_bump {
        return Err(ProductionClaimLanePrincipalError::AccountBindingMismatch);
    }
    require_vault_authority_meta(&accounts[3], vault_authority.key)?;

    let (authenticated_lane, lane_state) =
        authenticate_lane(gate, binding, &accounts[4], active_config.key(), lane)?;
    require_source_token_meta(&accounts[5], lane_state.token_account)?;

    let mint = Pubkey::new_from_array(binding.mint());
    let destination_before = observe_stake_ingress_source(
        &accounts[6],
        &mint,
        &Pubkey::new_from_array(lane_state.beneficiary),
    )
    .map_err(|_| ProductionClaimLanePrincipalError::DestinationTokenRejected)?;

    // The retained kernel does not inspect source mint/authority/balance before
    // its business checks. Supply only the already authenticated account key,
    // then validate those CPI-time source facts after the kernel succeeds so
    // NothingVested/CoreCustody error precedence remains exact.
    let plan = prepare_claim_lane_principal(
        gate,
        PrepareClaimLanePrincipalInput {
            config_key: active_config.key(),
            config,
            lane,
            lane_state,
            mint: binding.mint(),
            vault_authority: vault_authority.key,
            lane_tokens: ReadonlyTokenState {
                key: accounts[5].key.to_bytes(),
                mint: binding.mint(),
                owner: vault_authority.key,
                amount: 0,
            },
            destination_tokens: destination_before.token,
        },
    )?;

    let source_before = observe_stake_ingress_vault(
        &accounts[5],
        &mint,
        &Pubkey::new_from_array(vault_authority.key),
    )
    .map_err(|_| ProductionClaimLanePrincipalError::SourceTokenRejected)?;

    Ok(PreparedProductionClaimLanePrincipal {
        caller,
        config: active_config.key(),
        lane_account: accounts[4].key.to_bytes(),
        vault_authority: vault_authority.key,
        plan: Box::new(plan),
        authenticated_lane,
        source_before,
        destination_before,
    })
}

fn authenticate_caller(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
) -> Result<[u8; 32], ProductionClaimLanePrincipalError> {
    if account.is_writable {
        return Err(ProductionClaimLanePrincipalError::AccountMetaMismatch);
    }
    let key = account.key.to_bytes();
    Ok(authenticate_signer_account_info(gate, binding, account, key, false)?.key())
}

fn authenticate_lane(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
    lane: u8,
) -> Result<(AuthenticatedStateAccount, LaneState), ProductionClaimLanePrincipalError> {
    let authenticated = authenticate_state_account_info(
        gate,
        binding,
        account,
        PdaIdentity::LaneState { config, lane },
    )?;
    match authenticated.state() {
        StrictStateValue::Lane(state) => Ok((authenticated, state)),
        _ => Err(ProductionClaimLanePrincipalError::StateTypeMismatch),
    }
}

fn require_source_token_meta(
    account: &AccountInfo<'_>,
    expected_key: [u8; 32],
) -> Result<(), ProductionClaimLanePrincipalError> {
    if account.key.to_bytes() != expected_key || account.owner != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionClaimLanePrincipalError::AccountBindingMismatch);
    }
    if account.is_signer || !account.is_writable || account.executable {
        return Err(ProductionClaimLanePrincipalError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_mint_meta(
    binding: &NativeEconomyBinding,
    mint: &AccountInfo<'_>,
) -> Result<(), ProductionClaimLanePrincipalError> {
    if mint.key.to_bytes() != binding.mint() || mint.owner != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionClaimLanePrincipalError::AccountBindingMismatch);
    }
    if mint.is_signer || mint.is_writable || mint.executable {
        return Err(ProductionClaimLanePrincipalError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_vault_authority_meta(
    account: &AccountInfo<'_>,
    expected_key: [u8; 32],
) -> Result<(), ProductionClaimLanePrincipalError> {
    if account.key.to_bytes() != expected_key {
        return Err(ProductionClaimLanePrincipalError::AccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionClaimLanePrincipalError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_token_program(
    program: &AccountInfo<'_>,
) -> Result<(), ProductionClaimLanePrincipalError> {
    if program.key != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionClaimLanePrincipalError::AccountBindingMismatch);
    }
    if program.is_signer || program.is_writable || !program.executable {
        return Err(ProductionClaimLanePrincipalError::AccountMetaMismatch);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::runtime_write_adapter::{
        execute_production_active_existing_write_batch_account_infos, RuntimeWriteAdapterError,
    };
    use crate::{
        decode_lane_state, encode_config_genesis_state, encode_lane_state, verify_daily_law_open,
        CanonicalDailyLawBinding, ConfigGenesisState, ConfigState, GenesisPhase,
        ReadonlyDailyLawAccount, CONFIG_GENESIS_ACCOUNT_LEN, CORE_BENEFICIARY, CORE_TEAM,
        ECOSYSTEM, ECOSYSTEM_BENEFICIARY, LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC,
        LAW_STATE_VERSION, LIQUIDITY, LIQUIDITY_BENEFICIARY, MAINNET_SUPPLY, SECONDS_PER_WEEK,
        TREASURY, TREASURY_BENEFICIARY,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
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
    const CALLER: [u8; 32] = [0xC1; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_654_860;
    const INITIAL_SOURCE_AMOUNT: u64 = 10_000;
    const INITIAL_DESTINATION_AMOUNT: u64 = 100;
    const EXPECTED_CLAIMABLE: u64 = 3_775;

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

    fn beneficiary(lane: u8) -> [u8; 32] {
        match lane {
            TREASURY => TREASURY_BENEFICIARY,
            ECOSYSTEM => ECOSYSTEM_BENEFICIARY,
            CORE_TEAM => CORE_BENEFICIARY,
            LIQUIDITY => LIQUIDITY_BENEFICIARY,
            _ => panic!("test fixture requires a retained claimable lane"),
        }
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

    fn set_token_amount(data: &mut [u8], amount: u64) {
        let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(data).unwrap();
        state.base.amount = amount;
        state.pack_base();
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
        lane: u8,
        caller: TestAccount,
        config: TestAccount,
        mint: TestAccount,
        vault_authority: TestAccount,
        lane_state: TestAccount,
        lane_tokens: TestAccount,
        destination_tokens: TestAccount,
        token_program: TestAccount,
    }

    impl Fixture {
        fn new(binding: &NativeEconomyBinding, lane: u8) -> Self {
            let vault_authority = derive_pda(
                binding,
                PdaIdentity::VaultAuthority {
                    config: binding.config(),
                },
            )
            .unwrap();
            let stake_token = derive_pda(
                binding,
                PdaIdentity::StakeToken {
                    config: binding.config(),
                },
            )
            .unwrap();
            let config_state = ConfigGenesisState {
                phase: GenesisPhase::Active,
                config: ConfigState {
                    admin: [0x21; 32],
                    mint: MINT,
                    token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
                    randomness_program: [0x44; 32],
                    stake_token_account: stake_token.key,
                    agency_registry_hash: [0x66; 32],
                    genesis_timestamp: CLOCK_TIMESTAMP - 5 * SECONDS_PER_WEEK,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: 0,
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

            let lane_identity = PdaIdentity::LaneState {
                config: binding.config(),
                lane,
            };
            let lane_key = derive_pda(binding, lane_identity).unwrap();
            let lane_token = derive_pda(
                binding,
                PdaIdentity::LaneToken {
                    config: binding.config(),
                    lane,
                },
            )
            .unwrap();
            let beneficiary = beneficiary(lane);
            let lane_value = LaneState {
                config: binding.config(),
                token_account: lane_token.key,
                beneficiary,
                total: 10_000,
                genesis_unlocked: 1_000,
                cliff_week: 2,
                linear_end_week: 10,
                reserved: 100,
                paid: 200,
                principal_claimed: 300,
                lane,
                reward_source: lane != CORE_TEAM,
                bump: lane_key.bump,
                token_bump: lane_token.bump,
            };
            let mut lane_data = [0u8; LANE_ACCOUNT_LEN];
            encode_lane_state(&lane_value, &mut lane_data).unwrap();

            Self {
                lane,
                caller: TestAccount {
                    key: CALLER.into(),
                    owner: system_program::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: true,
                    writable: false,
                    executable: false,
                },
                config: TestAccount {
                    key: binding.config().into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: config_data.to_vec(),
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
                vault_authority: TestAccount {
                    key: vault_authority.key.into(),
                    owner: system_program::ID,
                    lamports: 0,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                lane_state: TestAccount {
                    key: lane_key.key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: lane_data.to_vec(),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                lane_tokens: TestAccount {
                    key: lane_token.key.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(MINT, vault_authority.key, INITIAL_SOURCE_AMOUNT),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                destination_tokens: TestAccount {
                    key: [0x72u8.wrapping_add(lane); 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(MINT, beneficiary, INITIAL_DESTINATION_AMOUNT),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                token_program: TestAccount {
                    key: TOKEN_2022_PROGRAM_ID,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
            }
        }

        fn instruction(&self) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
            encoded(ProductionInstruction::ClaimLanePrincipal { lane: self.lane })
        }

        fn with_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &mut [AccountInfo<'_>; PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT],
            ) -> R,
        ) -> R {
            let mut infos = [
                self.caller.info(),
                self.config.info(),
                self.mint.info(),
                self.vault_authority.info(),
                self.lane_state.info(),
                self.lane_tokens.info(),
                self.destination_tokens.info(),
                self.token_program.info(),
            ];
            operation(&mut infos)
        }

        fn with_reload_infos<R>(
            &mut self,
            operation: impl FnOnce(&AccountInfo<'_>, &AccountInfo<'_>) -> R,
        ) -> R {
            let source = self.lane_tokens.info();
            let destination = self.destination_tokens.info();
            operation(&source, &destination)
        }

        fn with_config_and_lane_infos<R>(
            &mut self,
            operation: impl FnOnce(&AccountInfo<'_>, &mut [AccountInfo<'_>; 1]) -> R,
        ) -> R {
            let config = self.config.info();
            let mut lane = [self.lane_state.info()];
            operation(&config, &mut lane)
        }

        fn state_snapshot(&self) -> Vec<u8> {
            self.lane_state.data.clone()
        }

        fn all_snapshot(&self) -> [Vec<u8>; 4] {
            [
                self.config.data.clone(),
                self.lane_state.data.clone(),
                self.lane_tokens.data.clone(),
                self.destination_tokens.data.clone(),
            ]
        }

        fn apply_exact_token_delta(&mut self, claimable: u64) {
            set_token_amount(
                &mut self.lane_tokens.data,
                INITIAL_SOURCE_AMOUNT - claimable,
            );
            set_token_amount(
                &mut self.destination_tokens.data,
                INITIAL_DESTINATION_AMOUNT + claimable,
            );
        }
    }

    fn prepare(
        fixture: &mut Fixture,
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
    ) -> PreparedProductionClaimLanePrincipal {
        let instruction = fixture.instruction();
        fixture.with_infos(|accounts| {
            prepare_production_claim_lane_principal_account_infos(
                gate,
                binding,
                &instruction,
                accounts,
            )
            .unwrap()
        })
    }

    fn seal_after_exact_token_delta(
        prepared: PreparedProductionClaimLanePrincipal,
        fixture: &mut Fixture,
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
    ) -> AtomicWriteBatch<PRODUCTION_CLAIM_LANE_PRINCIPAL_WRITE_COUNT> {
        let claimable = prepared.plan().claimable;
        fixture.apply_exact_token_delta(claimable);
        fixture.with_reload_infos(|source, destination| {
            prepared
                .seal_post_transfer_cas_account_infos(gate, binding, source, destination)
                .unwrap()
        })
    }

    #[test]
    fn all_three_non_core_lanes_prepare_exact_v2_plans_without_writes() {
        let binding = binding();
        let gate = open_gate();
        for lane in [TREASURY, ECOSYSTEM, LIQUIDITY] {
            let mut fixture = Fixture::new(&binding, lane);
            let before = fixture.all_snapshot();
            let prepared = prepare(&mut fixture, &gate, &binding);
            assert_eq!(prepared.caller(), CALLER);
            assert_eq!(prepared.config(), binding.config());
            assert_eq!(prepared.lane_account(), fixture.lane_state.key.to_bytes());
            assert_eq!(
                prepared.vault_authority(),
                fixture.vault_authority.key.to_bytes()
            );
            assert_eq!(prepared.plan().lane, lane);
            assert_eq!(prepared.plan().current_week, 5);
            assert_eq!(prepared.plan().unlocked, 4_375);
            assert_eq!(prepared.plan().committed, 600);
            assert_eq!(prepared.plan().claimable, EXPECTED_CLAIMABLE);
            assert_eq!(prepared.plan().transfer.amount, EXPECTED_CLAIMABLE);
            assert_eq!(
                prepared.plan().lane_snapshot.principal_claimed,
                300,
                "V2 updates this only after token CPI"
            );
            assert_eq!(fixture.all_snapshot(), before, "lane {lane}");
        }
    }

    #[test]
    fn every_account_slot_and_meta_bit_is_exact_and_fail_closed() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::ClaimLanePrincipal { lane: TREASURY });

        for index in 0..(PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT - 1) {
            let mut fixture = Fixture::new(&binding, TREASURY);
            let before = fixture.all_snapshot();
            fixture.with_infos(|accounts| {
                accounts.swap(index, index + 1);
                assert!(prepare_production_claim_lane_principal_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                )
                .is_err());
            });
            assert_eq!(fixture.all_snapshot(), before, "slot swap {index}");
        }

        for index in 0..PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT {
            for flag in 0..3 {
                let mut fixture = Fixture::new(&binding, TREASURY);
                let before = fixture.all_snapshot();
                fixture.with_infos(|accounts| {
                    match flag {
                        0 => accounts[index].is_signer = !accounts[index].is_signer,
                        1 => accounts[index].is_writable = !accounts[index].is_writable,
                        2 => accounts[index].executable = !accounts[index].executable,
                        _ => unreachable!(),
                    }
                    assert!(prepare_production_claim_lane_principal_account_infos(
                        &gate,
                        &binding,
                        &instruction,
                        accounts,
                    )
                    .is_err());
                });
                assert_eq!(
                    fixture.all_snapshot(),
                    before,
                    "meta flip account {index}, flag {flag}"
                );
            }
        }
    }

    #[test]
    fn instruction_count_identity_destination_and_core_policy_fail_atomically() {
        let binding = binding();
        let gate = open_gate();
        let treasury = encoded(ProductionInstruction::ClaimLanePrincipal { lane: TREASURY });

        let mut wrong_instruction = Fixture::new(&binding, TREASURY);
        let before = wrong_instruction.all_snapshot();
        let close = encoded(ProductionInstruction::ClosePosition);
        wrong_instruction.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate, &binding, &close, accounts,
                ),
                Err(ProductionClaimLanePrincipalError::WrongInstruction)
            );
        });
        assert_eq!(wrong_instruction.all_snapshot(), before);

        let mut wrong_count = Fixture::new(&binding, TREASURY);
        let before = wrong_count.all_snapshot();
        wrong_count.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate,
                    &binding,
                    &treasury,
                    &accounts[..PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT - 1],
                ),
                Err(ProductionClaimLanePrincipalError::AccountCountMismatch)
            );
        });
        assert_eq!(wrong_count.all_snapshot(), before);

        let mut wrong_lane = Fixture::new(&binding, TREASURY);
        let before = wrong_lane.all_snapshot();
        let ecosystem = encoded(ProductionInstruction::ClaimLanePrincipal { lane: ECOSYSTEM });
        wrong_lane.with_infos(|accounts| {
            assert!(prepare_production_claim_lane_principal_account_infos(
                &gate, &binding, &ecosystem, accounts,
            )
            .is_err());
        });
        assert_eq!(wrong_lane.all_snapshot(), before);

        let mut wrong_source_key = Fixture::new(&binding, TREASURY);
        wrong_source_key.lane_tokens.key = [0xF1; 32].into();
        let before = wrong_source_key.all_snapshot();
        wrong_source_key.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate, &binding, &treasury, accounts,
                ),
                Err(ProductionClaimLanePrincipalError::AccountBindingMismatch)
            );
        });
        assert_eq!(wrong_source_key.all_snapshot(), before);

        let mut wrong_destination = Fixture::new(&binding, TREASURY);
        wrong_destination.destination_tokens.data =
            token_data(MINT, [0x99; 32], INITIAL_DESTINATION_AMOUNT);
        let before = wrong_destination.all_snapshot();
        wrong_destination.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate, &binding, &treasury, accounts,
                ),
                Err(ProductionClaimLanePrincipalError::DestinationTokenRejected)
            );
        });
        assert_eq!(wrong_destination.all_snapshot(), before);

        let mut core = Fixture::new(&binding, CORE_TEAM);
        let before = core.all_snapshot();
        let core_instruction = core.instruction();
        core.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate,
                    &binding,
                    &core_instruction,
                    accounts,
                ),
                Err(ProductionClaimLanePrincipalError::Economy(
                    EconomyError::CoreCustodyPolicyUnresolved
                ))
            );
        });
        assert_eq!(core.all_snapshot(), before);
    }

    #[test]
    fn source_cpi_facts_follow_retained_business_and_core_error_precedence() {
        let binding = binding();
        let gate = open_gate();

        let mut wrong_source = Fixture::new(&binding, TREASURY);
        wrong_source.lane_tokens.data = token_data(
            [0x99; 32],
            wrong_source.vault_authority.key.to_bytes(),
            INITIAL_SOURCE_AMOUNT,
        );
        let before = wrong_source.all_snapshot();
        let instruction = wrong_source.instruction();
        wrong_source.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                ),
                Err(ProductionClaimLanePrincipalError::SourceTokenRejected)
            );
        });
        assert_eq!(wrong_source.all_snapshot(), before);

        let mut nothing_vested = Fixture::new(&binding, TREASURY);
        let mut lane = decode_lane_state(&nothing_vested.lane_state.data).unwrap();
        lane.principal_claimed = 9_700;
        encode_lane_state(&lane, &mut nothing_vested.lane_state.data).unwrap();
        nothing_vested.lane_tokens.data = token_data(
            [0x99; 32],
            nothing_vested.vault_authority.key.to_bytes(),
            INITIAL_SOURCE_AMOUNT,
        );
        let before = nothing_vested.all_snapshot();
        let instruction = nothing_vested.instruction();
        nothing_vested.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                ),
                Err(ProductionClaimLanePrincipalError::Economy(
                    EconomyError::NothingVestedToClaim
                ))
            );
        });
        assert_eq!(nothing_vested.all_snapshot(), before);

        let mut core = Fixture::new(&binding, CORE_TEAM);
        core.lane_tokens.data = token_data(
            [0x99; 32],
            core.vault_authority.key.to_bytes(),
            INITIAL_SOURCE_AMOUNT,
        );
        let before = core.all_snapshot();
        let instruction = core.instruction();
        core.with_infos(|accounts| {
            assert_eq!(
                prepare_production_claim_lane_principal_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                ),
                Err(ProductionClaimLanePrincipalError::Economy(
                    EconomyError::CoreCustodyPolicyUnresolved
                ))
            );
        });
        assert_eq!(core.all_snapshot(), before);
    }

    #[test]
    fn exact_post_transfer_reloads_seal_and_commit_the_v2_lane_postimage() {
        let binding = binding();
        let gate = open_gate();
        let mut fixture = Fixture::new(&binding, TREASURY);
        let mut expected = decode_lane_state(&fixture.lane_state.data).unwrap();
        expected.principal_claimed += EXPECTED_CLAIMABLE;
        let prepared = prepare(&mut fixture, &gate, &binding);
        let batch = seal_after_exact_token_delta(prepared, &mut fixture, &gate, &binding);

        fixture.with_config_and_lane_infos(|config, lanes| {
            let active_config =
                authenticate_production_active_config_account_info(&gate, &binding, config)
                    .unwrap();
            execute_production_active_existing_write_batch_account_infos(
                &gate,
                &active_config,
                &binding,
                batch,
                lanes,
            )
            .unwrap();
        });
        assert_eq!(
            decode_lane_state(&fixture.lane_state.data).unwrap(),
            expected
        );
    }

    #[test]
    fn every_post_transfer_reload_drift_fails_before_a_cas_batch_exists() {
        let binding = binding();
        let gate = open_gate();

        let mut source_amount = Fixture::new(&binding, TREASURY);
        let prepared = prepare(&mut source_amount, &gate, &binding);
        source_amount.apply_exact_token_delta(EXPECTED_CLAIMABLE);
        set_token_amount(
            &mut source_amount.lane_tokens.data,
            INITIAL_SOURCE_AMOUNT - EXPECTED_CLAIMABLE + 1,
        );
        let before = source_amount.state_snapshot();
        let result = source_amount.with_reload_infos(|source, destination| {
            prepared.seal_post_transfer_cas_account_infos(&gate, &binding, source, destination)
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalError::TokenReloadAmountMismatch)
        );
        assert_eq!(source_amount.state_snapshot(), before);

        let mut destination_amount = Fixture::new(&binding, TREASURY);
        let prepared = prepare(&mut destination_amount, &gate, &binding);
        destination_amount.apply_exact_token_delta(EXPECTED_CLAIMABLE);
        set_token_amount(
            &mut destination_amount.destination_tokens.data,
            INITIAL_DESTINATION_AMOUNT + EXPECTED_CLAIMABLE - 1,
        );
        let before = destination_amount.state_snapshot();
        let result = destination_amount.with_reload_infos(|source, destination| {
            prepared.seal_post_transfer_cas_account_infos(&gate, &binding, source, destination)
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalError::TokenReloadAmountMismatch)
        );
        assert_eq!(destination_amount.state_snapshot(), before);

        let mut source_identity = Fixture::new(&binding, TREASURY);
        let prepared = prepare(&mut source_identity, &gate, &binding);
        source_identity.apply_exact_token_delta(EXPECTED_CLAIMABLE);
        source_identity.lane_tokens.key = [0xD1; 32].into();
        let before = source_identity.state_snapshot();
        let result = source_identity.with_reload_infos(|source, destination| {
            prepared.seal_post_transfer_cas_account_infos(&gate, &binding, source, destination)
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalError::TokenReloadIdentityMismatch)
        );
        assert_eq!(source_identity.state_snapshot(), before);

        let mut destination_identity = Fixture::new(&binding, TREASURY);
        let prepared = prepare(&mut destination_identity, &gate, &binding);
        destination_identity.apply_exact_token_delta(EXPECTED_CLAIMABLE);
        destination_identity.destination_tokens.key = [0xD2; 32].into();
        let before = destination_identity.state_snapshot();
        let result = destination_identity.with_reload_infos(|source, destination| {
            prepared.seal_post_transfer_cas_account_infos(&gate, &binding, source, destination)
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalError::TokenReloadIdentityMismatch)
        );
        assert_eq!(destination_identity.state_snapshot(), before);
    }

    #[test]
    fn borrow_conflict_and_stale_preimage_cannot_partially_commit_lane_state() {
        let binding = binding();
        let gate = open_gate();

        let mut borrow_conflict = Fixture::new(&binding, TREASURY);
        let prepared = prepare(&mut borrow_conflict, &gate, &binding);
        let batch = seal_after_exact_token_delta(prepared, &mut borrow_conflict, &gate, &binding);
        let before = borrow_conflict.state_snapshot();
        borrow_conflict.with_config_and_lane_infos(|config, lanes| {
            let active_config =
                authenticate_production_active_config_account_info(&gate, &binding, config)
                    .unwrap();
            let held = lanes[0].try_borrow_mut_data().unwrap();
            assert_eq!(
                execute_production_active_existing_write_batch_account_infos(
                    &gate,
                    &active_config,
                    &binding,
                    batch,
                    lanes,
                ),
                Err(RuntimeWriteAdapterError::AccountBorrowFailed)
            );
            drop(held);
        });
        assert_eq!(borrow_conflict.state_snapshot(), before);

        let mut stale = Fixture::new(&binding, TREASURY);
        let prepared = prepare(&mut stale, &gate, &binding);
        let batch = seal_after_exact_token_delta(prepared, &mut stale, &gate, &binding);
        let mut changed = decode_lane_state(&stale.lane_state.data).unwrap();
        changed.paid += 1;
        encode_lane_state(&changed, &mut stale.lane_state.data).unwrap();
        let before = stale.state_snapshot();
        stale.with_config_and_lane_infos(|config, lanes| {
            let active_config =
                authenticate_production_active_config_account_info(&gate, &binding, config)
                    .unwrap();
            assert!(
                execute_production_active_existing_write_batch_account_infos(
                    &gate,
                    &active_config,
                    &binding,
                    batch,
                    lanes,
                )
                .is_err()
            );
        });
        assert_eq!(stale.state_snapshot(), before);
    }

    #[test]
    fn truth_surface_keeps_core_and_every_executable_boundary_held() {
        let truth = core::hint::black_box(PRODUCTION_CLAIM_LANE_PRINCIPAL_TRUTH);
        assert!(truth.feature_gated);
        assert!(truth.exact_instruction_codec_required);
        assert!(truth.runtime_daily_law_capability_supported);
        assert!(truth.production_active_readonly_config_required);
        assert!(truth.exact_eight_account_order_and_flags_required);
        assert!(truth.arbitrary_readonly_signer_caller_preserved);
        assert!(truth.exact_lane_and_companion_token_pdas_authenticated);
        assert!(truth.stored_beneficiary_destination_authenticated);
        assert!(truth.non_core_lanes_supported);
        assert!(truth.core_team_custody_rejected);
        assert!(truth.retained_v2_pre_token_cpi_kernel_used);
        assert!(truth.post_transfer_runtime_token_reloads_required);
        assert!(truth.exact_lane_state_cas_sealable_after_reloads);
        assert!(!truth.hooked_token_cpi_executed);
        assert!(!truth.cas_executor_exposed);
        assert!(!truth.production_dispatcher_exposed);
        assert!(!truth.production_entrypoint_exposed);
        assert!(!truth.handler_complete);
        assert!(truth.mainnet_hold);
        assert!(
            core::hint::black_box(PRODUCTION_CLAIM_LANE_PRINCIPAL_STATUS)
                .contains("NO_EXECUTOR_MAINNET_HOLD")
        );
    }
}

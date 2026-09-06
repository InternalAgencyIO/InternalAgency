//! Hook-aware Token-2022 executor for retained-V2 non-core lane claims.
//!
//! This module composes the already-isolated claim preflight with one exact
//! `transfer_checked` CPI, post-CPI Token-2022 reloads, and one existing-state
//! lane CAS. The feature-gated production dispatcher now routes this adapter:
//! non-core lanes reach the executor, while the core lane remains a typed
//! custody-policy HOLD before account reads. Runtime transaction rollback still
//! requires final-binary adversarial Devnet evidence; host tests cannot attest
//! validator rollback behavior.

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;

use crate::native_adapter::{NativeEconomyBinding, VAULT_AUTHORITY_SEED};
use crate::production_claim_lane_principal::{
    prepare_runtime_production_claim_lane_principal_account_infos,
    PreparedProductionClaimLanePrincipal, ProductionClaimLanePrincipalError,
    PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT, PRODUCTION_CLAIM_LANE_PRINCIPAL_WRITE_COUNT,
};
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_adapter::{
    authenticate_runtime_production_active_config, RuntimeAdapterError,
    RuntimeProductionActiveConfig, RuntimeValidatedDailyLawWrite,
};
use crate::runtime_write_adapter::{
    execute_production_active_existing_write_batch_account_infos, RuntimeWriteAdapterError,
    RuntimeWriteReceipt,
};
use crate::token_2022_runtime::{
    authenticate_canonical_economy_mint_account_info, CanonicalEconomyMintBinding,
    EconomyToken2022Error,
};
use crate::{CORE_TEAM, ECOSYSTEM, LIQUIDITY, MAINNET_SUPPLY, TOKEN_DECIMALS, TREASURY};
use sha2::{Digest, Sha256};
use solana_account_info::AccountInfo;
use solana_cpi::invoke_signed;
use solana_instruction::{AccountMeta, Instruction};
use solana_program_error::{ProgramError, ProgramResult};
use solana_pubkey::Pubkey;
use solana_sdk_ids::zk_elgamal_proof_program;
use spl_token_2022_interface::{instruction::transfer_checked, ID as TOKEN_2022_PROGRAM_ID};
use spl_transfer_hook_interface::{
    get_extra_account_metas_address, onchain::add_extra_accounts_for_execute_cpi,
};

pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_ACCOUNT_COUNT: usize = 12;
pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_DISPATCH_ACCOUNT_COUNT: usize =
    PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_ACCOUNT_COUNT - 1;
pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_STATUS: &str =
    "NON_CORE_HOOK_AWARE_TOKEN_2022_CPI_RELOAD_ONE_STATE_CAS_ROUTED_ONE_LAW_PREFIX_CORE_POLICY_HOLD_DEVNET_ROLLBACK_FALSE_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionClaimLanePrincipalExecutorTruth {
    pub feature_gated: bool,
    pub exact_twelve_account_graph_required: bool,
    pub runtime_daily_law_capability_rebound: bool,
    pub production_active_config_required: bool,
    pub exact_production_program_identity_required: bool,
    pub canonical_confidential_hooked_mint_required: bool,
    pub exact_hook_validation_pda_required: bool,
    pub exact_resolved_readonly_law_meta_required: bool,
    pub vault_authority_invoke_signed_used: bool,
    pub retained_v2_post_cpi_reload_order_preserved: bool,
    pub exact_one_state_cas_executed: bool,
    pub non_core_only: bool,
    pub production_dispatch_adapter_complete: bool,
    pub program_identity_and_runtime_law_precede_decode: bool,
    pub non_core_lane_filter_precedes_account_reads: bool,
    pub core_team_policy_hold_precedes_account_reads: bool,
    pub invalid_lane_rejected_before_account_reads: bool,
    pub one_daily_law_transaction_prefix_reused: bool,
    pub same_instruction_transaction_rollback_required_after_cpi: bool,
    pub dispatcher_exposed: bool,
    pub entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub devnet_transaction_rollback_proven: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_TRUTH:
    ProductionClaimLanePrincipalExecutorTruth = ProductionClaimLanePrincipalExecutorTruth {
    feature_gated: true,
    exact_twelve_account_graph_required: true,
    runtime_daily_law_capability_rebound: true,
    production_active_config_required: true,
    exact_production_program_identity_required: true,
    canonical_confidential_hooked_mint_required: true,
    exact_hook_validation_pda_required: true,
    exact_resolved_readonly_law_meta_required: true,
    vault_authority_invoke_signed_used: true,
    retained_v2_post_cpi_reload_order_preserved: true,
    exact_one_state_cas_executed: true,
    non_core_only: true,
    production_dispatch_adapter_complete: true,
    program_identity_and_runtime_law_precede_decode: true,
    non_core_lane_filter_precedes_account_reads: true,
    core_team_policy_hold_precedes_account_reads: true,
    invalid_lane_rejected_before_account_reads: true,
    one_daily_law_transaction_prefix_reused: true,
    same_instruction_transaction_rollback_required_after_cpi: true,
    dispatcher_exposed: true,
    entrypoint_exposed: true,
    handler_complete: true,
    devnet_transaction_rollback_proven: false,
    mainnet_hold: true,
};

#[derive(Debug, Eq, PartialEq)]
pub enum ProductionClaimLanePrincipalExecutorError {
    AccountCountMismatch,
    DuplicateDailyLawAccount,
    ProgramIdentityMismatch,
    DailyLawBindingMismatch,
    Instruction(ProductionInstructionError),
    WrongInstruction,
    InvalidLane { lane: u8 },
    CoreCustodyPolicyHold,
    SupplementalAccountBindingMismatch,
    SupplementalAccountMetaMismatch,
    LawCapabilityMismatch,
    LawAccountBorrowFailed,
    TransferPlanMismatch,
    ResolvedHookGraphMismatch,
    Claim(ProductionClaimLanePrincipalError),
    Runtime(RuntimeAdapterError),
    Mint(EconomyToken2022Error),
    Write(RuntimeWriteAdapterError),
    Program(ProgramError),
}

impl From<ProductionInstructionError> for ProductionClaimLanePrincipalExecutorError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

impl From<ProductionClaimLanePrincipalError> for ProductionClaimLanePrincipalExecutorError {
    fn from(value: ProductionClaimLanePrincipalError) -> Self {
        Self::Claim(value)
    }
}

impl From<RuntimeAdapterError> for ProductionClaimLanePrincipalExecutorError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<EconomyToken2022Error> for ProductionClaimLanePrincipalExecutorError {
    fn from(value: EconomyToken2022Error) -> Self {
        Self::Mint(value)
    }
}

impl From<RuntimeWriteAdapterError> for ProductionClaimLanePrincipalExecutorError {
    fn from(value: RuntimeWriteAdapterError) -> Self {
        Self::Write(value)
    }
}

impl From<ProgramError> for ProductionClaimLanePrincipalExecutorError {
    fn from(value: ProgramError) -> Self {
        Self::Program(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionClaimLanePrincipalExecutionReceipt {
    caller: [u8; 32],
    config: [u8; 32],
    lane_account: [u8; 32],
    lane: u8,
    claimable: u64,
    law_account_sha256: [u8; 32],
    state_write: RuntimeWriteReceipt<PRODUCTION_CLAIM_LANE_PRINCIPAL_WRITE_COUNT>,
}

impl ProductionClaimLanePrincipalExecutionReceipt {
    pub const fn caller(&self) -> [u8; 32] {
        self.caller
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn lane_account(&self) -> [u8; 32] {
        self.lane_account
    }

    pub const fn lane(&self) -> u8 {
        self.lane
    }

    pub const fn claimable(&self) -> u64 {
        self.claimable
    }

    pub const fn law_account_sha256(&self) -> [u8; 32] {
        self.law_account_sha256
    }

    pub const fn state_write(
        &self,
    ) -> &RuntimeWriteReceipt<PRODUCTION_CLAIM_LANE_PRINCIPAL_WRITE_COUNT> {
        &self.state_write
    }
}

struct ClaimTransferCpi<'a> {
    instruction: Instruction,
    account_infos: Vec<AccountInfo<'a>>,
    config: Pubkey,
    vault_authority_bump: u8,
}

impl ClaimTransferCpi<'_> {
    fn invoke(&self) -> ProgramResult {
        let bump_seed = [self.vault_authority_bump];
        let signer_seeds: &[&[u8]] = &[VAULT_AUTHORITY_SEED, self.config.as_ref(), &bump_seed];
        invoke_signed(&self.instruction, &self.account_infos, &[signer_seeds])
    }
}

/// Execute one non-core retained-V2 lane-principal claim through the exact
/// Token-2022 hook-aware CPI and existing lane-state CAS boundaries.
///
/// Account order is exact:
/// 0 caller, 1 Config, 2 mint, 3 vault authority, 4 lane state,
/// 5 lane token source, 6 beneficiary token destination, 7 Token-2022 program,
/// 8 ZK ElGamal proof program, 9 transfer-hook program,
/// 10 transfer-hook validation PDA, 11 Daily-Law state.
///
/// This callable executor remains deliberately undispatched and has no public
/// program entrypoint. A returned error after CPI relies on Solana transaction
/// semantics for rollback; final-binary adversarial Devnet proof is outstanding.
#[inline(never)]
pub fn execute_runtime_production_claim_lane_principal_account_infos(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<ProductionClaimLanePrincipalExecutionReceipt, ProductionClaimLanePrincipalExecutorError>
{
    execute_with_transfer(
        program_id,
        runtime_law,
        binding,
        instruction_data,
        accounts,
        ClaimTransferCpi::invoke,
    )
}

/// Classify the exact opcode-9 lane before reading any operation account, then
/// reuse the production entrypoint's one authenticated Daily-Law prefix at the
/// executor's frozen slot 11 for supported non-core lanes only.
///
/// `CORE_TEAM` remains a typed owner-policy HOLD. `COMMUNITY` and unknown lane
/// discriminants are invalid for the retained claim operation. This adapter is
/// crate-private and is not yet connected to the production dispatcher.
#[inline(never)]
pub(crate) fn execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos<
    'info,
>(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    daily_law_account: &AccountInfo<'info>,
    operation_accounts: &[AccountInfo<'info>],
) -> Result<ProductionClaimLanePrincipalExecutionReceipt, ProductionClaimLanePrincipalExecutorError>
{
    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionClaimLanePrincipalExecutorError::ProgramIdentityMismatch);
    }
    require_dispatch_runtime_law_binding(runtime_law, binding)?;
    let lane = match decode_production_instruction(instruction_data)? {
        ProductionInstruction::ClaimLanePrincipal { lane } => lane,
        _ => return Err(ProductionClaimLanePrincipalExecutorError::WrongInstruction),
    };
    match lane {
        TREASURY | ECOSYSTEM | LIQUIDITY => {}
        CORE_TEAM => {
            return Err(ProductionClaimLanePrincipalExecutorError::CoreCustodyPolicyHold);
        }
        _ => return Err(ProductionClaimLanePrincipalExecutorError::InvalidLane { lane }),
    }
    if operation_accounts.len() != PRODUCTION_CLAIM_LANE_PRINCIPAL_DISPATCH_ACCOUNT_COUNT {
        return Err(ProductionClaimLanePrincipalExecutorError::AccountCountMismatch);
    }
    if operation_accounts
        .iter()
        .any(|account| account.key == daily_law_account.key)
    {
        return Err(ProductionClaimLanePrincipalExecutorError::DuplicateDailyLawAccount);
    }
    let mut executor_accounts =
        Vec::with_capacity(PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_ACCOUNT_COUNT);
    executor_accounts.extend(operation_accounts.iter().cloned());
    executor_accounts.push(daily_law_account.clone());
    execute_runtime_production_claim_lane_principal_account_infos(
        program_id,
        runtime_law,
        binding,
        instruction_data,
        &executor_accounts,
    )
}

fn require_dispatch_runtime_law_binding(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    if runtime_law.mint() != binding.mint()
        || runtime_law.gate().law_program_id() != runtime_law.law_program_owner()
        || runtime_law.gate().law_state_address() != runtime_law.law_account_key()
    {
        return Err(ProductionClaimLanePrincipalExecutorError::DailyLawBindingMismatch);
    }
    Ok(())
}

#[inline(never)]
fn execute_with_transfer<'a, F>(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'a>],
    transfer: F,
) -> Result<ProductionClaimLanePrincipalExecutionReceipt, ProductionClaimLanePrincipalExecutorError>
where
    F: FnOnce(&ClaimTransferCpi<'a>) -> ProgramResult,
{
    require_account_count(accounts)?;

    // Preserve the completed seam's instruction, ACTIVE Config, account, and
    // retained-kernel error ordering before introducing executor-only checks.
    let prepared = prepare_runtime_production_claim_lane_principal_account_infos(
        runtime_law,
        binding,
        instruction_data,
        &accounts[..PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT],
    )?;
    let active_config =
        authenticate_runtime_production_active_config(runtime_law, binding, &accounts[1])?;

    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionClaimLanePrincipalExecutorError::ProgramIdentityMismatch);
    }

    require_supplemental_accounts(runtime_law, accounts)?;
    authenticate_executor_mint(runtime_law, binding, accounts)?;
    require_law_capability_rebound(runtime_law, &accounts[11])?;

    let caller = prepared.caller();
    let config = prepared.config();
    let lane_account = prepared.lane_account();
    let lane = prepared.plan().lane;
    let claimable = prepared.plan().claimable;
    let cpi = build_claim_transfer_cpi(&prepared, binding, accounts)?;
    transfer(&cpi)?;
    drop(cpi);

    let state_write =
        execute_post_transfer_cas(prepared, runtime_law, &active_config, binding, accounts)?;

    Ok(ProductionClaimLanePrincipalExecutionReceipt {
        caller,
        config,
        lane_account,
        lane,
        claimable,
        law_account_sha256: runtime_law.law_account_sha256(),
        state_write,
    })
}

// Keep the owning sealed write batch out of the transfer frame. V2 reloads
// both token accounts and mutates `principal_claimed` only after the transfer
// CPI returns success; this stage preserves that exact late boundary.
#[inline(never)]
fn execute_post_transfer_cas(
    prepared: PreparedProductionClaimLanePrincipal,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
) -> Result<
    RuntimeWriteReceipt<PRODUCTION_CLAIM_LANE_PRINCIPAL_WRITE_COUNT>,
    ProductionClaimLanePrincipalExecutorError,
> {
    let batch = prepared.seal_post_transfer_cas_account_infos(
        runtime_law.gate(),
        binding,
        &accounts[5],
        &accounts[6],
    )?;
    execute_production_active_existing_write_batch_account_infos(
        runtime_law.gate(),
        active_config,
        binding,
        batch,
        &accounts[4..5],
    )
    .map_err(Into::into)
}

fn require_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    if accounts.len() != PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_ACCOUNT_COUNT {
        return Err(ProductionClaimLanePrincipalExecutorError::AccountCountMismatch);
    }
    Ok(())
}

fn require_supplemental_accounts(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    require_readonly_program(&accounts[8], &zk_elgamal_proof_program::ID)?;
    let hook_program = Pubkey::new_from_array(runtime_law.law_program_owner());
    require_readonly_program(&accounts[9], &hook_program)?;

    let expected_validation = get_extra_account_metas_address(accounts[2].key, &hook_program);
    require_readonly_owned_account(&accounts[10], &expected_validation, &hook_program)?;
    require_readonly_owned_account(
        &accounts[11],
        &Pubkey::new_from_array(runtime_law.law_account_key()),
        &hook_program,
    )?;
    Ok(())
}

fn require_readonly_program(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    if account.key != expected_key {
        return Err(ProductionClaimLanePrincipalExecutorError::SupplementalAccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || !account.executable {
        return Err(ProductionClaimLanePrincipalExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn require_readonly_owned_account(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
    expected_owner: &Pubkey,
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    if account.key != expected_key || account.owner != expected_owner {
        return Err(ProductionClaimLanePrincipalExecutorError::SupplementalAccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionClaimLanePrincipalExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn authenticate_executor_mint(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    let mint_binding = CanonicalEconomyMintBinding::new(
        binding.mint(),
        runtime_law.law_program_owner(),
        MAINNET_SUPPLY,
        TOKEN_DECIMALS,
    )?;
    authenticate_canonical_economy_mint_account_info(
        &mint_binding,
        &accounts[7],
        &accounts[8],
        &accounts[2],
    )?;
    Ok(())
}

fn require_law_capability_rebound(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    law_account: &AccountInfo<'_>,
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    let data = law_account
        .try_borrow_data()
        .map_err(|_| ProductionClaimLanePrincipalExecutorError::LawAccountBorrowFailed)?;
    let observed: [u8; 32] = Sha256::digest(&*data).into();
    if observed != runtime_law.law_account_sha256() {
        return Err(ProductionClaimLanePrincipalExecutorError::LawCapabilityMismatch);
    }
    Ok(())
}

fn build_claim_transfer_cpi<'a>(
    prepared: &PreparedProductionClaimLanePrincipal,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'a>],
) -> Result<ClaimTransferCpi<'a>, ProductionClaimLanePrincipalExecutorError> {
    let plan = prepared.plan();
    if plan.transfer.token_program != TOKEN_2022_PROGRAM_ID.to_bytes()
        || plan.transfer.source != accounts[5].key.to_bytes()
        || plan.transfer.mint != binding.mint()
        || plan.transfer.mint != accounts[2].key.to_bytes()
        || plan.transfer.destination != accounts[6].key.to_bytes()
        || plan.transfer.authority != prepared.vault_authority()
        || plan.transfer.authority != accounts[3].key.to_bytes()
        || plan.transfer.amount != plan.claimable
        || plan.transfer.decimals != TOKEN_DECIMALS
    {
        return Err(ProductionClaimLanePrincipalExecutorError::TransferPlanMismatch);
    }

    let mut instruction = transfer_checked(
        &TOKEN_2022_PROGRAM_ID,
        accounts[5].key,
        accounts[2].key,
        accounts[6].key,
        accounts[3].key,
        &[],
        plan.transfer.amount,
        TOKEN_DECIMALS,
    )?;
    let mut account_infos = vec![
        accounts[5].clone(),
        accounts[2].clone(),
        accounts[6].clone(),
        accounts[3].clone(),
    ];
    let additional = [
        accounts[9].clone(),
        accounts[10].clone(),
        accounts[11].clone(),
    ];
    add_extra_accounts_for_execute_cpi(
        &mut instruction,
        &mut account_infos,
        accounts[9].key,
        accounts[5].clone(),
        accounts[2].clone(),
        accounts[6].clone(),
        accounts[3].clone(),
        plan.transfer.amount,
        &additional,
    )?;
    require_exact_resolved_hook_graph(&instruction, &account_infos, accounts)?;
    account_infos.push(accounts[7].clone());

    Ok(ClaimTransferCpi {
        instruction,
        account_infos,
        config: Pubkey::new_from_array(prepared.config()),
        vault_authority_bump: plan.config_snapshot.vault_authority_bump,
    })
}

fn require_exact_resolved_hook_graph(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionClaimLanePrincipalExecutorError> {
    let expected_metas = [
        AccountMeta::new(*accounts[5].key, false),
        AccountMeta::new_readonly(*accounts[2].key, false),
        AccountMeta::new(*accounts[6].key, false),
        // Token-2022 requires the authority meta to sign. The corresponding
        // AccountInfo is the non-signer vault PDA and `invoke_signed` supplies
        // this privilege from the exact binding-relative seeds.
        AccountMeta::new_readonly(*accounts[3].key, true),
        AccountMeta::new_readonly(*accounts[11].key, false),
        AccountMeta::new_readonly(*accounts[10].key, false),
        AccountMeta::new_readonly(*accounts[9].key, false),
    ];
    let expected_keys = [
        accounts[5].key,
        accounts[2].key,
        accounts[6].key,
        accounts[3].key,
        accounts[11].key,
        accounts[10].key,
        accounts[9].key,
    ];
    if instruction.program_id != TOKEN_2022_PROGRAM_ID
        || instruction.accounts.as_slice() != expected_metas
        || account_infos.len() != expected_keys.len()
        || account_infos
            .iter()
            .zip(expected_keys)
            .any(|(observed, expected)| observed.key != expected)
    {
        return Err(ProductionClaimLanePrincipalExecutorError::ResolvedHookGraphMismatch);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_adapter::{derive_pda, PdaIdentity};
    use crate::production_instruction::{
        encode_production_instruction, ProductionInstruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::{
        decode_lane_state, encode_config_genesis_state, encode_lane_state, verify_daily_law_open,
        CanonicalDailyLawBinding, ConfigGenesisState, ConfigState, EconomyError, GenesisPhase,
        LaneState, ReadonlyDailyLawAccount, ValidatedDailyLawWrite, CONFIG_GENESIS_ACCOUNT_LEN,
        CORE_BENEFICIARY, CORE_TEAM, ECOSYSTEM, ECOSYSTEM_BENEFICIARY, LANE_ACCOUNT_LEN,
        LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, LIQUIDITY, LIQUIDITY_BENEFICIARY,
        SECONDS_PER_WEEK, TREASURY, TREASURY_BENEFICIARY,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_sdk_ids::{native_loader, system_program};
    use spl_token_2022_interface::{
        extension::{
            confidential_transfer::ConfidentialTransferMint,
            transfer_hook::{TransferHook, TransferHookAccount},
            AccountType, BaseStateWithExtensionsMut, ExtensionType, StateWithExtensions,
            StateWithExtensionsMut,
        },
        state::{Account as TokenAccount, AccountState, Mint},
    };
    use spl_transfer_hook_interface::instruction::TransferHookInstruction;

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
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

    fn law_identity() -> ([u8; 32], u8) {
        let (key, bump) = Pubkey::find_program_address(
            &[b"law-state", &MINT],
            &Pubkey::new_from_array(LAW_PROGRAM),
        );
        (key.to_bytes(), bump)
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

    fn law_data() -> [u8; LAW_STATE_LEN] {
        let decision = open_decision(CLOCK_TIMESTAMP);
        let (_, law_bump) = law_identity();
        let mut data = [0u8; LAW_STATE_LEN];
        data[0..8].copy_from_slice(LAW_STATE_MAGIC);
        data[8] = LAW_STATE_VERSION;
        data[9] = law_bump;
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

    fn open_gate() -> ValidatedDailyLawWrite {
        let data = law_data();
        let (law_state, law_bump) = law_identity();
        verify_daily_law_open(
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, law_state, law_bump, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(law_state, LAW_PROGRAM, false, &data),
            CLOCK_TIMESTAMP,
        )
        .unwrap()
    }

    fn runtime_law() -> RuntimeValidatedDailyLawWrite {
        RuntimeValidatedDailyLawWrite::from_test_gate(open_gate(), law_identity().0, LAW_PROGRAM)
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

    fn mint_data(hook_program: [u8; 32]) -> Vec<u8> {
        let extensions = [
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
        ];
        let len = ExtensionType::try_calculate_account_len::<Mint>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state = StateWithExtensionsMut::<Mint>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Mint);
        state.base = Mint {
            supply: MAINNET_SUPPLY,
            decimals: TOKEN_DECIMALS,
            is_initialized: true,
            ..Mint::default()
        };
        state
            .init_extension::<ConfidentialTransferMint>(false)
            .unwrap()
            .auto_approve_new_accounts = true.into();
        state
            .init_extension::<TransferHook>(false)
            .unwrap()
            .program_id = Some(Pubkey::new_from_array(hook_program))
            .try_into()
            .unwrap();
        state.pack_base();
        data
    }

    fn token_data(owner: [u8; 32], amount: u64) -> Vec<u8> {
        let extensions = [ExtensionType::TransferHookAccount];
        let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state =
            StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Account);
        state.base = TokenAccount {
            mint: MINT.into(),
            owner: owner.into(),
            amount,
            state: AccountState::Initialized,
            ..TokenAccount::default()
        };
        state.init_extension::<TransferHookAccount>(false).unwrap();
        state.pack_base();
        data
    }

    // Exact `ExtraAccountMetaList<ExecuteInstruction>` bytes emitted by the
    // Law initializer for one readonly, non-signer `[b"law-state", mint]`
    // PDA. Keeping this local avoids widening the production dependency
    // surface merely for test construction.
    fn validation_data(mint_account_index: u8) -> Vec<u8> {
        const TLV_HEADER_LEN: usize = 12;
        const LIST_HEADER_LEN: usize = 4;
        const EXTRA_META_LEN: usize = 35;
        let list_len = LIST_HEADER_LEN + EXTRA_META_LEN;
        let mut data = vec![0u8; TLV_HEADER_LEN + list_len];
        let execute = TransferHookInstruction::Execute { amount: 0 }.pack();
        data[0..8].copy_from_slice(&execute[0..8]);
        data[8..12].copy_from_slice(&(list_len as u32).to_le_bytes());
        data[12..16].copy_from_slice(&1u32.to_le_bytes());
        data[16] = 1; // PDA seed AccountMeta discriminator
        data[17] = 1; // literal seed discriminator
        data[18] = 9; // b"law-state" length
        data[19..28].copy_from_slice(b"law-state");
        data[28] = 3; // account-key seed discriminator
        data[29] = mint_account_index;
        data[49] = 0; // non-signer
        data[50] = 0; // readonly
        data
    }

    fn token_amount(account: &AccountInfo<'_>) -> u64 {
        let data = account.try_borrow_data().unwrap();
        StateWithExtensions::<TokenAccount>::unpack(&data)
            .unwrap()
            .base
            .amount
    }

    fn set_token_amount(account: &AccountInfo<'_>, amount: u64) -> ProgramResult {
        let mut data = account.try_borrow_mut_data()?;
        let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(&mut data)?;
        state.base.amount = amount;
        state.pack_base();
        Ok(())
    }

    fn apply_exact_mock_transfer(cpi: &ClaimTransferCpi<'_>) -> ProgramResult {
        assert_eq!(cpi.instruction.accounts.len(), 7);
        assert_eq!(cpi.account_infos.len(), 8);
        assert_eq!(
            cpi.instruction.accounts[4].pubkey,
            Pubkey::new_from_array(law_identity().0)
        );
        assert_eq!(
            cpi.instruction.accounts[5].pubkey,
            get_extra_account_metas_address(
                &Pubkey::new_from_array(MINT),
                &Pubkey::new_from_array(LAW_PROGRAM),
            )
        );
        assert_eq!(
            cpi.instruction.accounts[6].pubkey,
            Pubkey::new_from_array(LAW_PROGRAM)
        );
        assert_eq!(cpi.account_infos[7].key, &TOKEN_2022_PROGRAM_ID);
        assert_eq!(token_amount(&cpi.account_infos[0]), INITIAL_SOURCE_AMOUNT);
        assert_eq!(
            token_amount(&cpi.account_infos[2]),
            INITIAL_DESTINATION_AMOUNT
        );
        set_token_amount(
            &cpi.account_infos[0],
            INITIAL_SOURCE_AMOUNT - EXPECTED_CLAIMABLE,
        )?;
        set_token_amount(
            &cpi.account_infos[2],
            INITIAL_DESTINATION_AMOUNT + EXPECTED_CLAIMABLE,
        )
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
        zk_program: TestAccount,
        hook_program: TestAccount,
        hook_validation: TestAccount,
        law_state: TestAccount,
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

            let hook_program = Pubkey::new_from_array(LAW_PROGRAM);
            let law_state = Pubkey::new_from_array(law_identity().0);
            let hook_validation =
                get_extra_account_metas_address(&Pubkey::new_from_array(MINT), &hook_program);
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
                    data: mint_data(LAW_PROGRAM),
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
                    data: token_data(vault_authority.key, INITIAL_SOURCE_AMOUNT),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                destination_tokens: TestAccount {
                    key: [0x72u8.wrapping_add(lane); 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(beneficiary, INITIAL_DESTINATION_AMOUNT),
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
                zk_program: TestAccount {
                    key: zk_elgamal_proof_program::ID,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
                hook_program: TestAccount {
                    key: hook_program,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
                hook_validation: TestAccount {
                    key: hook_validation,
                    owner: hook_program,
                    lamports: 1,
                    data: validation_data(1),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                law_state: TestAccount {
                    key: law_state,
                    owner: hook_program,
                    lamports: 1,
                    data: law_data().to_vec(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
            }
        }

        fn instruction(&self) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
            encoded(ProductionInstruction::ClaimLanePrincipal { lane: self.lane })
        }

        fn with_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &mut [AccountInfo<'_>; PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_ACCOUNT_COUNT],
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
                self.zk_program.info(),
                self.hook_program.info(),
                self.hook_validation.info(),
                self.law_state.info(),
            ];
            operation(&mut infos)
        }

        fn all_snapshot(&self) -> [Vec<u8>; 4] {
            [
                self.config.data.clone(),
                self.lane_state.data.clone(),
                self.lane_tokens.data.clone(),
                self.destination_tokens.data.clone(),
            ]
        }
    }

    #[test]
    fn truth_is_narrow_and_mainnet_held() {
        let truth = core::hint::black_box(PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_TRUTH);
        assert_eq!(
            PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_STATUS,
            "NON_CORE_HOOK_AWARE_TOKEN_2022_CPI_RELOAD_ONE_STATE_CAS_ROUTED_ONE_LAW_PREFIX_CORE_POLICY_HOLD_DEVNET_ROLLBACK_FALSE_MAINNET_HOLD"
        );
        assert!(truth.feature_gated);
        assert!(truth.exact_resolved_readonly_law_meta_required);
        assert!(truth.vault_authority_invoke_signed_used);
        assert!(truth.production_dispatch_adapter_complete);
        assert!(truth.program_identity_and_runtime_law_precede_decode);
        assert!(truth.non_core_lane_filter_precedes_account_reads);
        assert!(truth.core_team_policy_hold_precedes_account_reads);
        assert!(truth.invalid_lane_rejected_before_account_reads);
        assert!(truth.one_daily_law_transaction_prefix_reused);
        assert!(truth.same_instruction_transaction_rollback_required_after_cpi);
        assert!(truth.dispatcher_exposed);
        assert!(truth.entrypoint_exposed);
        assert!(truth.handler_complete);
        assert!(!truth.devnet_transaction_rollback_proven);
        assert!(truth.mainnet_hold);
    }

    #[test]
    fn dispatch_adapter_reuses_one_law_prefix_for_each_supported_non_core_lane() {
        let binding = binding();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let runtime_law = runtime_law();
        for lane in [TREASURY, ECOSYSTEM, LIQUIDITY] {
            let mut fixture = Fixture::new(&binding, lane);
            let instruction = fixture.instruction();
            let before = fixture.all_snapshot();
            let result = fixture.with_infos(|accounts| {
                execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &instruction,
                    &accounts[11],
                    &accounts[..PRODUCTION_CLAIM_LANE_PRINCIPAL_DISPATCH_ACCOUNT_COUNT],
                )
            });
            assert_eq!(
                result,
                Err(ProductionClaimLanePrincipalExecutorError::Claim(
                    ProductionClaimLanePrincipalError::TokenReloadAmountMismatch
                )),
            );
            assert_eq!(fixture.all_snapshot(), before);
        }
    }

    #[test]
    fn dispatch_adapter_rejects_duplicate_law_only_after_non_core_classification() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, TREASURY);
        let instruction = fixture.instruction();
        fixture.with_infos(|accounts| {
            let law_account = accounts[11].clone();
            let mut operation_accounts =
                accounts[..PRODUCTION_CLAIM_LANE_PRINCIPAL_DISPATCH_ACCOUNT_COUNT].to_vec();
            operation_accounts[0] = law_account.clone();
            assert_eq!(
                execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                    &Pubkey::new_from_array(ECONOMY_PROGRAM),
                    &runtime_law,
                    &binding,
                    &instruction,
                    &law_account,
                    &operation_accounts,
                ),
                Err(ProductionClaimLanePrincipalExecutorError::DuplicateDailyLawAccount),
            );
        });
    }

    #[test]
    fn identity_and_opaque_law_binding_precede_abi_and_account_shape() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, TREASURY);
        fixture.with_infos(|accounts| {
            assert_eq!(
                execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                    &Pubkey::new_from_array([0x99; 32]),
                    &runtime_law,
                    &binding,
                    &[0xFF],
                    &accounts[11],
                    &[],
                ),
                Err(ProductionClaimLanePrincipalExecutorError::ProgramIdentityMismatch),
            );

            let wrong_binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, [0x44; 32]).unwrap();
            assert_eq!(
                execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                    &Pubkey::new_from_array(ECONOMY_PROGRAM),
                    &runtime_law,
                    &wrong_binding,
                    &[0xFF],
                    &accounts[11],
                    &[],
                ),
                Err(ProductionClaimLanePrincipalExecutorError::DailyLawBindingMismatch),
            );
        });
    }

    #[test]
    fn exact_opcode_lane_policy_precedes_every_operation_account_read() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let mut fixture = Fixture::new(&binding, CORE_TEAM);
        fixture.with_infos(|accounts| {
            assert_eq!(
                execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &encoded(ProductionInstruction::ClaimLanePrincipal { lane: CORE_TEAM }),
                    &accounts[11],
                    &[],
                ),
                Err(ProductionClaimLanePrincipalExecutorError::CoreCustodyPolicyHold),
            );
            for lane in [0, LIQUIDITY + 1, u8::MAX] {
                assert_eq!(
                    execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                        &program_id,
                        &runtime_law,
                        &binding,
                        &encoded(ProductionInstruction::ClaimLanePrincipal { lane }),
                        &accounts[11],
                        &[],
                    ),
                    Err(ProductionClaimLanePrincipalExecutorError::InvalidLane { lane }),
                );
            }
            assert_eq!(
                execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &encoded(ProductionInstruction::ClosePosition),
                    &accounts[11],
                    &[],
                ),
                Err(ProductionClaimLanePrincipalExecutorError::WrongInstruction),
            );
            assert_eq!(
                execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &[0xFF],
                    &accounts[11],
                    &[],
                ),
                Err(ProductionClaimLanePrincipalExecutorError::Instruction(
                    ProductionInstructionError::InvalidLength,
                )),
            );
        });
    }

    #[test]
    fn all_non_core_lanes_execute_exact_hook_graph_reload_and_one_state_cas() {
        let binding = binding();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let runtime_law = runtime_law();
        for lane in [TREASURY, ECOSYSTEM, LIQUIDITY] {
            let mut fixture = Fixture::new(&binding, lane);
            let instruction = fixture.instruction();
            let receipt = fixture.with_infos(|accounts| {
                execute_with_transfer(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &instruction,
                    accounts,
                    |cpi| {
                        let bump = [cpi.vault_authority_bump];
                        assert_eq!(
                            Pubkey::create_program_address(
                                &[VAULT_AUTHORITY_SEED, cpi.config.as_ref(), &bump],
                                &program_id,
                            )
                            .unwrap(),
                            *accounts[3].key,
                        );
                        apply_exact_mock_transfer(cpi)
                    },
                )
                .unwrap()
            });
            assert_eq!(receipt.caller(), CALLER);
            assert_eq!(receipt.config(), binding.config());
            assert_eq!(receipt.lane(), lane);
            assert_eq!(receipt.claimable(), EXPECTED_CLAIMABLE);
            assert_eq!(
                receipt.law_account_sha256(),
                runtime_law.law_account_sha256()
            );
            assert_ne!(receipt.state_write().batch_commitment_sha256(), [0; 32]);
            assert_eq!(
                decode_lane_state(&fixture.lane_state.data)
                    .unwrap()
                    .principal_claimed,
                300 + EXPECTED_CLAIMABLE,
            );
            {
                let source = fixture.lane_tokens.info();
                assert_eq!(
                    token_amount(&source),
                    INITIAL_SOURCE_AMOUNT - EXPECTED_CLAIMABLE
                );
            }
            {
                let destination = fixture.destination_tokens.info();
                assert_eq!(
                    token_amount(&destination),
                    INITIAL_DESTINATION_AMOUNT + EXPECTED_CLAIMABLE
                );
            }
        }
    }

    #[test]
    fn host_cpi_stub_cannot_fake_token_success_or_commit_lane() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, TREASURY);
        let instruction = fixture.instruction();
        let before = fixture.all_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_claim_lane_principal_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::Claim(
                ProductionClaimLanePrincipalError::TokenReloadAmountMismatch
            ))
        );
        assert_eq!(fixture.all_snapshot(), before);
    }

    #[test]
    fn cpi_error_returns_before_any_reload_or_state_write() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, TREASURY);
        let instruction = fixture.instruction();
        let before = fixture.all_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |_| Err(ProgramError::Custom(0xC91)),
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::Program(
                ProgramError::Custom(0xC91)
            ))
        );
        assert_eq!(fixture.all_snapshot(), before);
    }

    #[test]
    fn partial_mock_transfer_fails_reload_and_never_commits_lane_state() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, TREASURY);
        let instruction = fixture.instruction();
        let lane_before = fixture.lane_state.data.clone();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |cpi| {
                    set_token_amount(
                        &cpi.account_infos[0],
                        INITIAL_SOURCE_AMOUNT - EXPECTED_CLAIMABLE,
                    )
                },
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::Claim(
                ProductionClaimLanePrincipalError::TokenReloadAmountMismatch
            ))
        );
        assert_eq!(fixture.lane_state.data, lane_before);
        assert!(
            !core::hint::black_box(
                PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_TRUTH.devnet_transaction_rollback_proven
            ),
            "host mutation injection is not validator rollback evidence"
        );
    }

    #[test]
    fn late_lane_borrow_conflict_fails_cas_after_exact_reloads_without_state_commit() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, TREASURY);
        let instruction = fixture.instruction();
        let lane_before = fixture.lane_state.data.clone();
        let result = fixture.with_infos(|accounts| {
            let lane_info = accounts[4].clone();
            let mut held_lane_borrow = None;
            let result = execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |cpi| {
                    apply_exact_mock_transfer(cpi)?;
                    held_lane_borrow = Some(lane_info.try_borrow_mut_data()?);
                    Ok(())
                },
            );
            drop(held_lane_borrow);
            result
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::Write(
                RuntimeWriteAdapterError::AccountBorrowFailed
            ))
        );
        assert_eq!(fixture.lane_state.data, lane_before);
        assert!(
            !core::hint::black_box(
                PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_TRUTH.devnet_transaction_rollback_proven
            ),
            "Solana must roll the successful CPI back when the enclosing instruction fails"
        );
    }

    #[test]
    fn exact_count_program_and_supplemental_identities_fail_closed() {
        let binding = binding();
        let runtime_law = runtime_law();

        let mut fixture = Fixture::new(&binding, TREASURY);
        let instruction = fixture.instruction();
        fixture.with_infos(|accounts| {
            assert_eq!(
                execute_with_transfer(
                    &Pubkey::new_from_array(ECONOMY_PROGRAM),
                    &runtime_law,
                    &binding,
                    &instruction,
                    &accounts[..11],
                    |_| Ok(()),
                ),
                Err(ProductionClaimLanePrincipalExecutorError::AccountCountMismatch)
            );
            let mut extended = accounts.to_vec();
            extended.push(accounts[11].clone());
            assert_eq!(
                execute_with_transfer(
                    &Pubkey::new_from_array(ECONOMY_PROGRAM),
                    &runtime_law,
                    &binding,
                    &instruction,
                    &extended,
                    |_| Ok(()),
                ),
                Err(ProductionClaimLanePrincipalExecutorError::AccountCountMismatch)
            );
            assert_eq!(
                execute_with_transfer(
                    &Pubkey::new_from_array([0x99; 32]),
                    &runtime_law,
                    &binding,
                    &instruction,
                    accounts,
                    |_| Ok(()),
                ),
                Err(ProductionClaimLanePrincipalExecutorError::ProgramIdentityMismatch)
            );
        });

        let mut fixture = Fixture::new(&binding, TREASURY);
        fixture.hook_program.writable = true;
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::SupplementalAccountMetaMismatch)
        );

        let mut fixture = Fixture::new(&binding, TREASURY);
        fixture.hook_validation.owner = [0x98; 32].into();
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::SupplementalAccountBindingMismatch)
        );
    }

    #[test]
    fn canonical_mint_live_law_hash_and_validation_resolution_are_all_required() {
        let binding = binding();
        let runtime_law = runtime_law();

        let mut fixture = Fixture::new(&binding, TREASURY);
        fixture.mint.data = mint_data([0x99; 32]);
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::Mint(
                EconomyToken2022Error::TransferHookBindingMismatch
            ))
        );

        let mut fixture = Fixture::new(&binding, TREASURY);
        fixture.law_state.data[159] = 1;
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::LawCapabilityMismatch)
        );

        let mut fixture = Fixture::new(&binding, TREASURY);
        fixture.hook_validation.data = validation_data(0);
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |_| Ok(()),
            )
        });
        assert!(matches!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::Program(_))
        ));
    }

    #[test]
    fn unresolved_core_policy_precedes_executor_only_hook_validation() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, CORE_TEAM);
        fixture.hook_program.key = [0x99; 32].into();
        fixture.hook_validation.data.clear();
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionClaimLanePrincipalExecutorError::Claim(
                ProductionClaimLanePrincipalError::Economy(
                    EconomyError::CoreCustodyPolicyUnresolved
                )
            ))
        );
    }
}

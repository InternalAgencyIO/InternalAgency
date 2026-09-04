//! Hook-aware Token-2022 executor for retained-V2 standard weekly settlement.
//!
//! This module composes the isolated standard settlement preflight with up to
//! three ordered `transfer_checked` CPIs, exact post-CPI Token-2022 reloads,
//! and one four-state existing-account CAS. Zero transfers are skipped exactly
//! as retained V2 specifies. The feature-gated production dispatcher supplies
//! one authenticated Daily-Law transaction prefix and reuses that AccountInfo
//! at the executor's frozen hook slot. Host tests do not attest validator
//! transaction rollback.

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;

use crate::native_adapter::{NativeEconomyBinding, VAULT_AUTHORITY_SEED};
use crate::production_settle_position_week::{
    prepare_runtime_production_settle_position_week_account_infos,
    PreparedProductionSettlePositionWeek, PreparedProductionSettlePositionWrites,
    ProductionSettlePositionError, PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT,
    PRODUCTION_SETTLE_POSITION_WRITE_COUNT,
};
use crate::runtime_adapter::{
    authenticate_runtime_production_active_config, RuntimeAdapterError,
    RuntimeValidatedDailyLawWrite,
};
#[cfg(test)]
use crate::runtime_write_adapter::execute_production_active_existing_write_batch_account_infos;
use crate::runtime_write_adapter::{
    execute_production_active_existing_write_batch_borrowed_4_account_infos,
    RuntimeWriteAdapterError, RuntimeWriteReceipt,
};
use crate::token_2022_runtime::{
    authenticate_canonical_economy_mint_account_info, CanonicalEconomyMintBinding,
    EconomyToken2022Error,
};
use crate::{MAINNET_SUPPLY, TOKEN_DECIMALS};
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

const POSITION_INDEX: usize = 2;
const MINT_INDEX: usize = 3;
const VAULT_AUTHORITY_INDEX: usize = 4;
const LANE_STATE_INDICES: [usize; 3] = [5, 7, 9];
const SOURCE_TOKEN_INDICES: [usize; 3] = [6, 8, 10];
const DESTINATION_TOKEN_INDEX: usize = 11;
const TOKEN_PROGRAM_INDEX: usize = 12;
const ZK_PROOF_PROGRAM_INDEX: usize = 13;
const HOOK_PROGRAM_INDEX: usize = 14;
const HOOK_VALIDATION_INDEX: usize = 15;
const LAW_STATE_INDEX: usize = 16;

pub const PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_ACCOUNT_COUNT: usize = 17;
pub const PRODUCTION_SETTLE_POSITION_STANDARD_DISPATCH_ACCOUNT_COUNT: usize =
    PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_ACCOUNT_COUNT - 1;
pub const PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_STATUS: &str =
    "STANDARD_ORDERED_HOOK_AWARE_TOKEN_2022_CPI_RELOAD_FOUR_STATE_CAS_ROUTED_ONE_LAW_PREFIX_DEVNET_ROLLBACK_FALSE_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionSettlePositionStandardExecutorTruth {
    pub feature_gated: bool,
    pub exact_seventeen_account_graph_required: bool,
    pub standard_round_omission_required: bool,
    pub runtime_daily_law_capability_rebound: bool,
    pub production_active_config_required: bool,
    pub exact_production_program_identity_required: bool,
    pub program_identity_rejected_before_instruction_or_account_access: bool,
    pub canonical_confidential_hooked_mint_required: bool,
    pub exact_hook_validation_pda_required: bool,
    pub exact_resolved_readonly_law_meta_required: bool,
    pub treasury_ecosystem_liquidity_cpi_order_required: bool,
    pub zero_amount_cpi_skipped: bool,
    pub vault_authority_invoke_signed_used: bool,
    pub retained_v2_post_cpi_reload_order_preserved: bool,
    pub exact_four_state_cas_executed: bool,
    pub one_daily_law_transaction_prefix_reused: bool,
    pub same_instruction_transaction_rollback_required_after_cpi: bool,
    pub dispatcher_exposed: bool,
    pub entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub devnet_transaction_rollback_proven: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_TRUTH:
    ProductionSettlePositionStandardExecutorTruth = ProductionSettlePositionStandardExecutorTruth {
    feature_gated: true,
    exact_seventeen_account_graph_required: true,
    standard_round_omission_required: true,
    runtime_daily_law_capability_rebound: true,
    production_active_config_required: true,
    exact_production_program_identity_required: true,
    program_identity_rejected_before_instruction_or_account_access: true,
    canonical_confidential_hooked_mint_required: true,
    exact_hook_validation_pda_required: true,
    exact_resolved_readonly_law_meta_required: true,
    treasury_ecosystem_liquidity_cpi_order_required: true,
    zero_amount_cpi_skipped: true,
    vault_authority_invoke_signed_used: true,
    retained_v2_post_cpi_reload_order_preserved: true,
    exact_four_state_cas_executed: true,
    one_daily_law_transaction_prefix_reused: true,
    same_instruction_transaction_rollback_required_after_cpi: true,
    dispatcher_exposed: true,
    entrypoint_exposed: true,
    handler_complete: true,
    devnet_transaction_rollback_proven: false,
    mainnet_hold: true,
};

#[derive(Debug, Eq, PartialEq)]
pub enum ProductionSettlePositionStandardExecutorError {
    AccountCountMismatch,
    DuplicateDailyLawAccount,
    ProgramIdentityMismatch,
    SupplementalAccountBindingMismatch,
    SupplementalAccountMetaMismatch,
    LawCapabilityMismatch,
    LawAccountBorrowFailed,
    TransferPlanMismatch,
    ResolvedHookGraphMismatch,
    Settle(ProductionSettlePositionError),
    Runtime(RuntimeAdapterError),
    Mint(EconomyToken2022Error),
    Write(RuntimeWriteAdapterError),
    Program(ProgramError),
}

impl From<ProductionSettlePositionError> for ProductionSettlePositionStandardExecutorError {
    fn from(value: ProductionSettlePositionError) -> Self {
        Self::Settle(value)
    }
}

impl From<RuntimeAdapterError> for ProductionSettlePositionStandardExecutorError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<EconomyToken2022Error> for ProductionSettlePositionStandardExecutorError {
    fn from(value: EconomyToken2022Error) -> Self {
        Self::Mint(value)
    }
}

impl From<RuntimeWriteAdapterError> for ProductionSettlePositionStandardExecutorError {
    fn from(value: RuntimeWriteAdapterError) -> Self {
        Self::Write(value)
    }
}

impl From<ProgramError> for ProductionSettlePositionStandardExecutorError {
    fn from(value: ProgramError) -> Self {
        Self::Program(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionSettlePositionStandardExecutionReceipt {
    caller: [u8; 32],
    config: [u8; 32],
    position: [u8; 32],
    week: u64,
    amount: u64,
    transfer_amounts: [u64; 3],
    executed_transfer_count: u8,
    law_account_sha256: [u8; 32],
    state_write: RuntimeWriteReceipt<PRODUCTION_SETTLE_POSITION_WRITE_COUNT>,
}

impl ProductionSettlePositionStandardExecutionReceipt {
    pub const fn caller(&self) -> [u8; 32] {
        self.caller
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn position(&self) -> [u8; 32] {
        self.position
    }

    pub const fn week(&self) -> u64 {
        self.week
    }

    pub const fn amount(&self) -> u64 {
        self.amount
    }

    pub const fn transfer_amounts(&self) -> [u64; 3] {
        self.transfer_amounts
    }

    pub const fn executed_transfer_count(&self) -> u8 {
        self.executed_transfer_count
    }

    pub const fn law_account_sha256(&self) -> [u8; 32] {
        self.law_account_sha256
    }

    pub const fn state_write(
        &self,
    ) -> &RuntimeWriteReceipt<PRODUCTION_SETTLE_POSITION_WRITE_COUNT> {
        &self.state_write
    }
}

struct SettleTransferCpi<'a> {
    transfer_index: usize,
    amount: u64,
    instruction: Instruction,
    account_infos: Vec<AccountInfo<'a>>,
    config: Pubkey,
    vault_authority_bump: u8,
}

#[derive(Clone, Copy)]
struct PreparedSettleExecutionFacts {
    caller: [u8; 32],
    config: [u8; 32],
    position: [u8; 32],
    week: u64,
    amount: u64,
    transfer_amounts: [u64; 3],
    law_account_sha256: [u8; 32],
}

impl SettleTransferCpi<'_> {
    fn invoke(&self) -> ProgramResult {
        if self.transfer_index >= 3 || self.amount == 0 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let bump_seed = [self.vault_authority_bump];
        let signer_seeds: &[&[u8]] = &[VAULT_AUTHORITY_SEED, self.config.as_ref(), &bump_seed];
        invoke_signed(&self.instruction, &self.account_infos, &[signer_seeds])
    }
}

/// Execute one standard retained-V2 weekly settlement through ordered
/// hook-aware Token-2022 CPIs and the exact four-state CAS boundary.
///
/// Account order is exact:
/// 0 caller, 1 Config, 2 Position, 3 mint, 4 vault authority,
/// 5 Treasury lane, 6 Treasury tokens, 7 Ecosystem lane, 8 Ecosystem tokens,
/// 9 Liquidity lane, 10 Liquidity tokens, 11 owner destination tokens,
/// 12 Token-2022 program, 13 ZK ElGamal proof program, 14 transfer-hook program,
/// 15 transfer-hook validation PDA, 16 Daily-Law state.
///
/// The feature-gated production dispatcher reaches this executor. Final-binary
/// adversarial Devnet must still prove validator rollback if a later CPI,
/// reload, or CAS boundary returns an error.
#[inline(never)]
pub fn execute_runtime_production_settle_position_week_standard_account_infos(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
> {
    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionSettlePositionStandardExecutorError::ProgramIdentityMismatch);
    }
    require_account_count(accounts)?;

    // Reuse the frozen standard-only seam verbatim before executor-only
    // identities. Passing exactly its first 13 accounts makes an optional CCC
    // Round structurally impossible at this executable boundary.
    let prepared = prepare_runtime_production_settle_position_week_account_infos(
        runtime_law,
        binding,
        instruction_data,
        &accounts[..PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT],
    )?;
    let active_config =
        authenticate_runtime_production_active_config(runtime_law, binding, &accounts[1])?;
    execute_production_validated_settlement_stage(
        program_id,
        runtime_law,
        &active_config,
        binding,
        accounts,
        prepared,
    )
}

/// Reuse the production entrypoint's single authenticated Daily-Law prefix at
/// executor slot 16. The transaction supplies exactly operation accounts
/// 0..15; a second account with the Daily-Law key is rejected before
/// instruction decoding or operation-account parsing.
#[inline(never)]
pub(crate) fn execute_runtime_production_settle_position_week_standard_with_daily_law_prefix_account_infos<
    'info,
>(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    daily_law_account: &AccountInfo<'info>,
    operation_accounts: &[AccountInfo<'info>],
) -> Result<
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
> {
    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionSettlePositionStandardExecutorError::ProgramIdentityMismatch);
    }
    if operation_accounts.len() != PRODUCTION_SETTLE_POSITION_STANDARD_DISPATCH_ACCOUNT_COUNT {
        return Err(ProductionSettlePositionStandardExecutorError::AccountCountMismatch);
    }
    if operation_accounts
        .iter()
        .any(|account| account.key == daily_law_account.key)
    {
        return Err(ProductionSettlePositionStandardExecutorError::DuplicateDailyLawAccount);
    }
    let mut executor_accounts =
        Vec::with_capacity(PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_ACCOUNT_COUNT);
    executor_accounts.extend(operation_accounts.iter().cloned());
    executor_accounts.push(daily_law_account.clone());
    execute_runtime_production_settle_position_week_standard_account_infos(
        program_id,
        runtime_law,
        binding,
        instruction_data,
        &executor_accounts,
    )
}

#[inline(never)]
fn execute_production_validated_settlement_stage<'a>(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    active_config: &crate::runtime_adapter::RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'a>],
    prepared: PreparedProductionSettlePositionWeek,
) -> Result<
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
> {
    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionSettlePositionStandardExecutorError::ProgramIdentityMismatch);
    }

    require_supplemental_accounts(runtime_law, accounts)?;
    authenticate_executor_mint(runtime_law, binding, accounts)?;
    require_law_capability_rebound(runtime_law, &accounts[LAW_STATE_INDEX])?;
    require_exact_transfer_plan(&prepared, binding, accounts)?;

    let facts = PreparedSettleExecutionFacts {
        caller: prepared.caller(),
        config: prepared.config(),
        position: prepared.position(),
        week: prepared.plan().week,
        amount: prepared.plan().amount,
        transfer_amounts: prepared.plan().transfers.map(|intent| intent.amount),
        law_account_sha256: runtime_law.law_account_sha256(),
    };
    execute_production_transfer_stage(
        runtime_law,
        active_config,
        binding,
        accounts,
        prepared,
        facts,
    )
}

#[inline(never)]
fn execute_production_transfer_stage<'a>(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    active_config: &crate::runtime_adapter::RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'a>],
    prepared: PreparedProductionSettlePositionWeek,
    facts: PreparedSettleExecutionFacts,
) -> Result<
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
> {
    let mut executed_transfer_count = execute_one_production_transfer(&prepared, 0, accounts)?;
    executed_transfer_count = executed_transfer_count
        .checked_add(execute_one_production_transfer(&prepared, 1, accounts)?)
        .ok_or(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch)?;
    executed_transfer_count = executed_transfer_count
        .checked_add(execute_one_production_transfer(&prepared, 2, accounts)?)
        .ok_or(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch)?;
    execute_production_reload_stage(
        runtime_law,
        active_config,
        binding,
        accounts,
        prepared,
        facts,
        executed_transfer_count,
    )
}

#[inline(never)]
fn execute_one_production_transfer<'a>(
    prepared: &PreparedProductionSettlePositionWeek,
    transfer_index: usize,
    accounts: &[AccountInfo<'a>],
) -> Result<u8, ProductionSettlePositionStandardExecutorError> {
    let amount = prepared
        .plan()
        .transfers
        .get(transfer_index)
        .ok_or(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch)?
        .amount;
    if amount == 0 {
        return Ok(0);
    }
    build_settle_transfer_cpi(prepared, transfer_index, accounts)?.invoke()?;
    Ok(1)
}

#[inline(never)]
fn execute_production_reload_stage<'a>(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    active_config: &crate::runtime_adapter::RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'a>],
    prepared: PreparedProductionSettlePositionWeek,
    facts: PreparedSettleExecutionFacts,
    executed_transfer_count: u8,
) -> Result<
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
> {
    let mut writes = PreparedProductionSettlePositionWrites::empty();
    prepared.prepare_post_transfer_write_intents_account_infos(
        runtime_law.gate(),
        binding,
        [
            &accounts[SOURCE_TOKEN_INDICES[0]],
            &accounts[SOURCE_TOKEN_INDICES[1]],
            &accounts[SOURCE_TOKEN_INDICES[2]],
        ],
        &accounts[DESTINATION_TOKEN_INDEX],
        &mut writes,
    )?;
    execute_production_settlement_write_stage(
        runtime_law,
        active_config,
        binding,
        accounts,
        &writes,
        facts,
        executed_transfer_count,
    )
}

#[inline(never)]
fn execute_production_settlement_write_stage(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    active_config: &crate::runtime_adapter::RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
    writes: &PreparedProductionSettlePositionWrites,
    facts: PreparedSettleExecutionFacts,
    executed_transfer_count: u8,
) -> Result<
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
> {
    let batch = writes.seal_borrowed(runtime_law.gate(), binding)?;
    let write_accounts = [
        accounts[POSITION_INDEX].clone(),
        accounts[LANE_STATE_INDICES[0]].clone(),
        accounts[LANE_STATE_INDICES[1]].clone(),
        accounts[LANE_STATE_INDICES[2]].clone(),
    ];
    let state_write = execute_production_active_existing_write_batch_borrowed_4_account_infos(
        runtime_law.gate(),
        active_config,
        binding,
        batch,
        &write_accounts,
    )?;
    Ok(ProductionSettlePositionStandardExecutionReceipt {
        caller: facts.caller,
        config: facts.config,
        position: facts.position,
        week: facts.week,
        amount: facts.amount,
        transfer_amounts: facts.transfer_amounts,
        executed_transfer_count,
        law_account_sha256: facts.law_account_sha256,
        state_write,
    })
}

#[cfg(test)]
#[inline(never)]
fn execute_with_transfers<'a, F>(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'a>],
    mut transfer: F,
) -> Result<
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
>
where
    F: FnMut(&SettleTransferCpi<'a>) -> ProgramResult,
{
    require_account_count(accounts)?;

    // Reuse the frozen standard-only seam verbatim before executor-only
    // identities. Passing exactly its first 13 accounts makes an optional CCC
    // Round structurally impossible at this executable boundary.
    let prepared = prepare_runtime_production_settle_position_week_account_infos(
        runtime_law,
        binding,
        instruction_data,
        &accounts[..PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT],
    )?;
    let active_config =
        authenticate_runtime_production_active_config(runtime_law, binding, &accounts[1])?;

    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionSettlePositionStandardExecutorError::ProgramIdentityMismatch);
    }

    require_supplemental_accounts(runtime_law, accounts)?;
    authenticate_executor_mint(runtime_law, binding, accounts)?;
    require_law_capability_rebound(runtime_law, &accounts[LAW_STATE_INDEX])?;
    require_exact_transfer_plan(&prepared, binding, accounts)?;

    let caller = prepared.caller();
    let config = prepared.config();
    let position = prepared.position();
    let week = prepared.plan().week;
    let amount = prepared.plan().amount;
    let transfer_amounts = prepared.plan().transfers.map(|intent| intent.amount);
    let mut executed_transfer_count = 0u8;
    for (transfer_index, transfer_amount) in transfer_amounts.iter().enumerate() {
        if *transfer_amount == 0 {
            continue;
        }
        let cpi = build_settle_transfer_cpi(&prepared, transfer_index, accounts)?;
        transfer(&cpi)?;
        executed_transfer_count = executed_transfer_count
            .checked_add(1)
            .ok_or(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch)?;
    }

    // Retained V2 reloads after all nonzero CPIs and only then mutates Position
    // paid/mask fields and commits Position plus all three lanes atomically.
    let batch = prepared.seal_post_transfer_cas_account_infos(
        runtime_law.gate(),
        binding,
        [
            &accounts[SOURCE_TOKEN_INDICES[0]],
            &accounts[SOURCE_TOKEN_INDICES[1]],
            &accounts[SOURCE_TOKEN_INDICES[2]],
        ],
        &accounts[DESTINATION_TOKEN_INDEX],
    )?;
    let write_accounts = [
        accounts[POSITION_INDEX].clone(),
        accounts[LANE_STATE_INDICES[0]].clone(),
        accounts[LANE_STATE_INDICES[1]].clone(),
        accounts[LANE_STATE_INDICES[2]].clone(),
    ];
    let state_write = execute_production_active_existing_write_batch_account_infos(
        runtime_law.gate(),
        &active_config,
        binding,
        batch,
        &write_accounts,
    )?;

    Ok(ProductionSettlePositionStandardExecutionReceipt {
        caller,
        config,
        position,
        week,
        amount,
        transfer_amounts,
        executed_transfer_count,
        law_account_sha256: runtime_law.law_account_sha256(),
        state_write,
    })
}

fn require_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    if accounts.len() != PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_ACCOUNT_COUNT {
        return Err(ProductionSettlePositionStandardExecutorError::AccountCountMismatch);
    }
    Ok(())
}

fn require_supplemental_accounts(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    require_readonly_program(
        &accounts[ZK_PROOF_PROGRAM_INDEX],
        &zk_elgamal_proof_program::ID,
    )?;
    let hook_program = Pubkey::new_from_array(runtime_law.law_program_owner());
    require_readonly_program(&accounts[HOOK_PROGRAM_INDEX], &hook_program)?;

    let expected_validation =
        get_extra_account_metas_address(accounts[MINT_INDEX].key, &hook_program);
    require_readonly_owned_account(
        &accounts[HOOK_VALIDATION_INDEX],
        &expected_validation,
        &hook_program,
    )?;
    require_readonly_owned_account(
        &accounts[LAW_STATE_INDEX],
        &Pubkey::new_from_array(runtime_law.law_account_key()),
        &hook_program,
    )?;
    Ok(())
}

fn require_readonly_program(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    if account.key != expected_key {
        return Err(
            ProductionSettlePositionStandardExecutorError::SupplementalAccountBindingMismatch,
        );
    }
    if account.is_signer || account.is_writable || !account.executable {
        return Err(ProductionSettlePositionStandardExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn require_readonly_owned_account(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
    expected_owner: &Pubkey,
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    if account.key != expected_key || account.owner != expected_owner {
        return Err(
            ProductionSettlePositionStandardExecutorError::SupplementalAccountBindingMismatch,
        );
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionSettlePositionStandardExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn authenticate_executor_mint(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    let mint_binding = CanonicalEconomyMintBinding::new(
        binding.mint(),
        runtime_law.law_program_owner(),
        MAINNET_SUPPLY,
        TOKEN_DECIMALS,
    )?;
    authenticate_canonical_economy_mint_account_info(
        &mint_binding,
        &accounts[TOKEN_PROGRAM_INDEX],
        &accounts[ZK_PROOF_PROGRAM_INDEX],
        &accounts[MINT_INDEX],
    )?;
    Ok(())
}

fn require_law_capability_rebound(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    law_account: &AccountInfo<'_>,
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    let data = law_account
        .try_borrow_data()
        .map_err(|_| ProductionSettlePositionStandardExecutorError::LawAccountBorrowFailed)?;
    let observed: [u8; 32] = Sha256::digest(&*data).into();
    if observed != runtime_law.law_account_sha256() {
        return Err(ProductionSettlePositionStandardExecutorError::LawCapabilityMismatch);
    }
    Ok(())
}

fn require_exact_transfer_plan(
    prepared: &PreparedProductionSettlePositionWeek,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    let plan = prepared.plan();
    let mut total = 0u64;
    for (index, intent) in plan.transfers.iter().enumerate() {
        if intent.token_program != TOKEN_2022_PROGRAM_ID.to_bytes()
            || intent.source != accounts[SOURCE_TOKEN_INDICES[index]].key.to_bytes()
            || intent.mint != binding.mint()
            || intent.mint != accounts[MINT_INDEX].key.to_bytes()
            || intent.destination != accounts[DESTINATION_TOKEN_INDEX].key.to_bytes()
            || intent.authority != prepared.vault_authority()
            || intent.authority != accounts[VAULT_AUTHORITY_INDEX].key.to_bytes()
            || intent.decimals != TOKEN_DECIMALS
        {
            return Err(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch);
        }
        total = total
            .checked_add(intent.amount)
            .ok_or(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch)?;
    }
    if total != plan.amount {
        return Err(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch);
    }
    Ok(())
}

fn build_settle_transfer_cpi<'a>(
    prepared: &PreparedProductionSettlePositionWeek,
    transfer_index: usize,
    accounts: &[AccountInfo<'a>],
) -> Result<SettleTransferCpi<'a>, ProductionSettlePositionStandardExecutorError> {
    let intent = prepared
        .plan()
        .transfers
        .get(transfer_index)
        .ok_or(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch)?;
    if intent.amount == 0 {
        return Err(ProductionSettlePositionStandardExecutorError::TransferPlanMismatch);
    }
    let source_index = SOURCE_TOKEN_INDICES[transfer_index];
    let mut instruction = transfer_checked(
        &TOKEN_2022_PROGRAM_ID,
        accounts[source_index].key,
        accounts[MINT_INDEX].key,
        accounts[DESTINATION_TOKEN_INDEX].key,
        accounts[VAULT_AUTHORITY_INDEX].key,
        &[],
        intent.amount,
        TOKEN_DECIMALS,
    )?;
    let mut account_infos = vec![
        accounts[source_index].clone(),
        accounts[MINT_INDEX].clone(),
        accounts[DESTINATION_TOKEN_INDEX].clone(),
        accounts[VAULT_AUTHORITY_INDEX].clone(),
    ];
    let additional = [
        accounts[HOOK_PROGRAM_INDEX].clone(),
        accounts[HOOK_VALIDATION_INDEX].clone(),
        accounts[LAW_STATE_INDEX].clone(),
    ];
    add_extra_accounts_for_execute_cpi(
        &mut instruction,
        &mut account_infos,
        accounts[HOOK_PROGRAM_INDEX].key,
        accounts[source_index].clone(),
        accounts[MINT_INDEX].clone(),
        accounts[DESTINATION_TOKEN_INDEX].clone(),
        accounts[VAULT_AUTHORITY_INDEX].clone(),
        intent.amount,
        &additional,
    )?;
    require_exact_resolved_hook_graph(&instruction, &account_infos, accounts, source_index)?;
    account_infos.push(accounts[TOKEN_PROGRAM_INDEX].clone());

    Ok(SettleTransferCpi {
        transfer_index,
        amount: intent.amount,
        instruction,
        account_infos,
        config: Pubkey::new_from_array(prepared.config()),
        vault_authority_bump: prepared.plan().config_snapshot.vault_authority_bump,
    })
}

fn require_exact_resolved_hook_graph(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    accounts: &[AccountInfo<'_>],
    source_index: usize,
) -> Result<(), ProductionSettlePositionStandardExecutorError> {
    let expected_metas = [
        AccountMeta::new(*accounts[source_index].key, false),
        AccountMeta::new_readonly(*accounts[MINT_INDEX].key, false),
        AccountMeta::new(*accounts[DESTINATION_TOKEN_INDEX].key, false),
        // Token-2022 expects a signer meta; the live AccountInfo is the
        // non-signer vault PDA and `invoke_signed` supplies exact PDA authority.
        AccountMeta::new_readonly(*accounts[VAULT_AUTHORITY_INDEX].key, true),
        AccountMeta::new_readonly(*accounts[LAW_STATE_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[HOOK_VALIDATION_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[HOOK_PROGRAM_INDEX].key, false),
    ];
    let expected_keys = [
        accounts[source_index].key,
        accounts[MINT_INDEX].key,
        accounts[DESTINATION_TOKEN_INDEX].key,
        accounts[VAULT_AUTHORITY_INDEX].key,
        accounts[LAW_STATE_INDEX].key,
        accounts[HOOK_VALIDATION_INDEX].key,
        accounts[HOOK_PROGRAM_INDEX].key,
    ];
    if instruction.program_id != TOKEN_2022_PROGRAM_ID
        || instruction.accounts.as_slice() != expected_metas
        || account_infos.len() != expected_keys.len()
        || account_infos
            .iter()
            .zip(expected_keys)
            .any(|(observed, expected)| observed.key != expected)
    {
        return Err(ProductionSettlePositionStandardExecutorError::ResolvedHookGraphMismatch);
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
        decode_lane_state, decode_position_state, encode_config_genesis_state, encode_lane_state,
        encode_position_state, verify_daily_law_open, CanonicalDailyLawBinding, ConfigGenesisState,
        ConfigState, EconomyError, GenesisPhase, LaneState, PositionState, ReadonlyDailyLawAccount,
        ValidatedDailyLawWrite, CONFIG_GENESIS_ACCOUNT_LEN, ECOSYSTEM, LANE_ACCOUNT_LEN,
        LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, LIQUIDITY, POSITION_ACCOUNT_LEN,
        SECONDS_PER_WEEK, STANDARD_RATE_BPS, TREASURY, USER_TERM_WEEKS,
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
    const POSITION_OWNER: [u8; 32] = [0xA1; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;
    const SETTLEMENT_WEEK: u64 = 4;
    const INITIAL_SOURCE_AMOUNT: u64 = 10_000;
    const INITIAL_DESTINATION_AMOUNT: u64 = 100;
    const EXPECTED_TOTAL_AMOUNT: u64 = 10_000;

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
        data[49] = 0;
        data[50] = 0;
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

    fn apply_exact_mock_transfer(cpi: &SettleTransferCpi<'_>) -> ProgramResult {
        assert!(cpi.transfer_index < 3);
        assert!(cpi.amount > 0);
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
        let source = token_amount(&cpi.account_infos[0]);
        let destination = token_amount(&cpi.account_infos[2]);
        set_token_amount(
            &cpi.account_infos[0],
            source
                .checked_sub(cpi.amount)
                .ok_or(ProgramError::InvalidAccountData)?,
        )?;
        set_token_amount(
            &cpi.account_infos[2],
            destination
                .checked_add(cpi.amount)
                .ok_or(ProgramError::InvalidAccountData)?,
        )
    }

    fn lane(
        binding: &NativeEconomyBinding,
        lane: u8,
        reserved: u64,
    ) -> ([u8; 32], [u8; 32], Vec<u8>) {
        let derived = derive_pda(
            binding,
            PdaIdentity::LaneState {
                config: binding.config(),
                lane,
            },
        )
        .unwrap();
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
            beneficiary: [0x90 | lane; 32],
            total: 1_000_000,
            genesis_unlocked: 1_000_000,
            cliff_week: 0,
            linear_end_week: 104,
            reserved,
            paid: 0,
            principal_claimed: 0,
            lane,
            reward_source: true,
            bump: derived.bump,
            token_bump: token.bump,
        };
        let mut data = [0u8; LANE_ACCOUNT_LEN];
        encode_lane_state(&state, &mut data).unwrap();
        (derived.key, token.key, data.to_vec())
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
        caller: TestAccount,
        config: TestAccount,
        position: TestAccount,
        mint: TestAccount,
        vault_authority: TestAccount,
        treasury: TestAccount,
        treasury_tokens: TestAccount,
        ecosystem: TestAccount,
        ecosystem_tokens: TestAccount,
        liquidity: TestAccount,
        liquidity_tokens: TestAccount,
        destination_tokens: TestAccount,
        token_program: TestAccount,
        zk_program: TestAccount,
        hook_program: TestAccount,
        hook_validation: TestAccount,
        law_state: TestAccount,
    }

    impl Fixture {
        fn new(binding: &NativeEconomyBinding) -> Self {
            Self::with_reservations(binding, [6_000, 3_000, 2_000])
        }

        fn with_reservations(binding: &NativeEconomyBinding, reservations: [u64; 3]) -> Self {
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
                    genesis_timestamp: CLOCK_TIMESTAMP - 4 * SECONDS_PER_WEEK,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: 5_200_000,
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

            let position_key = derive_pda(
                binding,
                PdaIdentity::Position {
                    config: binding.config(),
                    operator: POSITION_OWNER,
                    position_id: 44,
                },
            )
            .unwrap();
            let position_state = PositionState {
                config: binding.config(),
                owner: POSITION_OWNER,
                position_id: 44,
                principal: 5_200_000,
                accepted_week: 3,
                first_accrual_week: 4,
                term_weeks: USER_TERM_WEEKS,
                annual_rate_bps: STANDARD_RATE_BPS,
                treasury_reserved: reservations[0],
                ecosystem_reserved: reservations[1],
                liquidity_reserved: reservations[2],
                paid: 0,
                settled_mask: 0,
                agency_index: u32::MAX,
                role: 0,
                principal_returned: false,
                closed: false,
                bump: position_key.bump,
            };
            let mut position_data = [0u8; POSITION_ACCOUNT_LEN];
            encode_position_state(&position_state, &mut position_data).unwrap();

            let (treasury_key, treasury_token, treasury_data) =
                lane(binding, TREASURY, reservations[0]);
            let (ecosystem_key, ecosystem_token, ecosystem_data) =
                lane(binding, ECOSYSTEM, reservations[1]);
            let (liquidity_key, liquidity_token, liquidity_data) =
                lane(binding, LIQUIDITY, reservations[2]);
            let hook_program = Pubkey::new_from_array(LAW_PROGRAM);
            let law_state = Pubkey::new_from_array(law_identity().0);
            let hook_validation =
                get_extra_account_metas_address(&Pubkey::new_from_array(MINT), &hook_program);

            Self {
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
                position: TestAccount {
                    key: position_key.key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: position_data.to_vec(),
                    signer: false,
                    writable: true,
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
                treasury: TestAccount {
                    key: treasury_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: treasury_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                treasury_tokens: TestAccount {
                    key: treasury_token.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, INITIAL_SOURCE_AMOUNT),
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
                ecosystem_tokens: TestAccount {
                    key: ecosystem_token.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, INITIAL_SOURCE_AMOUNT),
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
                liquidity_tokens: TestAccount {
                    key: liquidity_token.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, INITIAL_SOURCE_AMOUNT),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                destination_tokens: TestAccount {
                    key: [0x72; 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(POSITION_OWNER, INITIAL_DESTINATION_AMOUNT),
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
            encoded(ProductionInstruction::SettlePositionWeek {
                week: SETTLEMENT_WEEK,
            })
        }

        fn with_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &mut [AccountInfo<'_>; PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_ACCOUNT_COUNT],
            ) -> R,
        ) -> R {
            let mut infos = [
                self.caller.info(),
                self.config.info(),
                self.position.info(),
                self.mint.info(),
                self.vault_authority.info(),
                self.treasury.info(),
                self.treasury_tokens.info(),
                self.ecosystem.info(),
                self.ecosystem_tokens.info(),
                self.liquidity.info(),
                self.liquidity_tokens.info(),
                self.destination_tokens.info(),
                self.token_program.info(),
                self.zk_program.info(),
                self.hook_program.info(),
                self.hook_validation.info(),
                self.law_state.info(),
            ];
            operation(&mut infos)
        }

        fn state_snapshot(&self) -> [Vec<u8>; PRODUCTION_SETTLE_POSITION_WRITE_COUNT] {
            [
                self.position.data.clone(),
                self.treasury.data.clone(),
                self.ecosystem.data.clone(),
                self.liquidity.data.clone(),
            ]
        }

        fn all_snapshot(&self) -> Vec<Vec<u8>> {
            vec![
                self.config.data.clone(),
                self.position.data.clone(),
                self.treasury.data.clone(),
                self.treasury_tokens.data.clone(),
                self.ecosystem.data.clone(),
                self.ecosystem_tokens.data.clone(),
                self.liquidity.data.clone(),
                self.liquidity_tokens.data.clone(),
                self.destination_tokens.data.clone(),
            ]
        }

        fn token_amounts(&mut self) -> [u64; 4] {
            [
                token_amount(&self.treasury_tokens.info()),
                token_amount(&self.ecosystem_tokens.info()),
                token_amount(&self.liquidity_tokens.info()),
                token_amount(&self.destination_tokens.info()),
            ]
        }
    }

    #[test]
    fn truth_is_standard_only_routed_one_prefix_and_mainnet_held() {
        let truth = core::hint::black_box(PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_TRUTH);
        assert_eq!(
            PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_STATUS,
            "STANDARD_ORDERED_HOOK_AWARE_TOKEN_2022_CPI_RELOAD_FOUR_STATE_CAS_ROUTED_ONE_LAW_PREFIX_DEVNET_ROLLBACK_FALSE_MAINNET_HOLD"
        );
        assert!(truth.exact_seventeen_account_graph_required);
        assert!(truth.standard_round_omission_required);
        assert!(truth.treasury_ecosystem_liquidity_cpi_order_required);
        assert!(truth.zero_amount_cpi_skipped);
        assert!(truth.program_identity_rejected_before_instruction_or_account_access);
        assert!(truth.one_daily_law_transaction_prefix_reused);
        assert!(truth.same_instruction_transaction_rollback_required_after_cpi);
        assert!(truth.dispatcher_exposed);
        assert!(truth.entrypoint_exposed);
        assert!(truth.handler_complete);
        assert!(!truth.devnet_transaction_rollback_proven);
        assert!(truth.mainnet_hold);
    }

    #[test]
    fn dispatch_adapter_reuses_prefix_at_exact_law_slot_and_rejects_duplicates() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let mut fixture = Fixture::new(&binding);
        let instruction = fixture.instruction();
        let before = fixture.all_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_settle_position_week_standard_with_daily_law_prefix_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction,
                &accounts[LAW_STATE_INDEX],
                &accounts[..LAW_STATE_INDEX],
            )
        });
        assert_eq!(
            result,
            Err(ProductionSettlePositionStandardExecutorError::Settle(
                ProductionSettlePositionError::TokenReloadAmountMismatch
            ))
        );
        assert_eq!(fixture.all_snapshot(), before);

        let mut fixture = Fixture::new(&binding);
        fixture.with_infos(|accounts| {
            let law_account = accounts[LAW_STATE_INDEX].clone();
            let mut operation_accounts = accounts[..LAW_STATE_INDEX].to_vec();
            operation_accounts[0] = law_account.clone();
            assert_eq!(
                execute_runtime_production_settle_position_week_standard_with_daily_law_prefix_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &[0xFF],
                    &law_account,
                    &operation_accounts,
                ),
                Err(ProductionSettlePositionStandardExecutorError::DuplicateDailyLawAccount)
            );
        });
    }

    #[test]
    fn production_identity_precedes_instruction_and_account_access() {
        let binding = binding();
        let runtime_law = runtime_law();
        let wrong_program = Pubkey::new_from_array([0x99; 32]);
        assert_eq!(
            execute_runtime_production_settle_position_week_standard_account_infos(
                &wrong_program,
                &runtime_law,
                &binding,
                &[0xFF],
                &[],
            ),
            Err(ProductionSettlePositionStandardExecutorError::ProgramIdentityMismatch)
        );

        let mut fixture = Fixture::new(&binding);
        fixture.with_infos(|accounts| {
            assert_eq!(
                execute_runtime_production_settle_position_week_standard_with_daily_law_prefix_account_infos(
                    &wrong_program,
                    &runtime_law,
                    &binding,
                    &[0xFF],
                    &accounts[LAW_STATE_INDEX],
                    &[],
                ),
                Err(ProductionSettlePositionStandardExecutorError::ProgramIdentityMismatch)
            );
        });
    }

    #[test]
    fn exact_three_transfer_order_reloads_and_four_state_cas_execute() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let mut fixture = Fixture::new(&binding);
        let instruction = fixture.instruction();
        let mut order = Vec::new();
        let receipt = fixture.with_infos(|accounts| {
            execute_with_transfers(
                &program_id,
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |cpi| {
                    order.push(cpi.transfer_index);
                    let bump = [cpi.vault_authority_bump];
                    assert_eq!(
                        Pubkey::create_program_address(
                            &[VAULT_AUTHORITY_SEED, cpi.config.as_ref(), &bump],
                            &program_id,
                        )
                        .unwrap(),
                        *accounts[VAULT_AUTHORITY_INDEX].key,
                    );
                    apply_exact_mock_transfer(cpi)
                },
            )
            .unwrap()
        });
        assert_eq!(order, [0, 1, 2]);
        assert_eq!(receipt.caller(), CALLER);
        assert_eq!(receipt.config(), binding.config());
        assert_eq!(receipt.position(), fixture.position.key.to_bytes());
        assert_eq!(receipt.week(), SETTLEMENT_WEEK);
        assert_eq!(receipt.amount(), EXPECTED_TOTAL_AMOUNT);
        assert_eq!(receipt.transfer_amounts(), [6_000, 3_000, 1_000]);
        assert_eq!(receipt.executed_transfer_count(), 3);
        assert_ne!(receipt.state_write().batch_commitment_sha256(), [0; 32]);
        let position = decode_position_state(&fixture.position.data).unwrap();
        assert_eq!(position.paid, EXPECTED_TOTAL_AMOUNT);
        assert_eq!(position.settled_mask, 1);
        assert_eq!(position.liquidity_reserved, 1_000);
        assert_eq!(
            decode_lane_state(&fixture.treasury.data).unwrap().reserved,
            0
        );
        assert_eq!(
            decode_lane_state(&fixture.ecosystem.data).unwrap().reserved,
            0
        );
        assert_eq!(
            decode_lane_state(&fixture.liquidity.data).unwrap().reserved,
            1_000
        );
        for (account, expected) in [
            (&mut fixture.treasury_tokens, 4_000),
            (&mut fixture.ecosystem_tokens, 7_000),
            (&mut fixture.liquidity_tokens, 9_000),
        ] {
            let info = account.info();
            assert_eq!(token_amount(&info), expected);
        }
        let destination = fixture.destination_tokens.info();
        assert_eq!(token_amount(&destination), 10_100);
    }

    #[test]
    fn zero_amount_transfers_are_skipped_without_reordering() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::with_reservations(&binding, [0, 11_000, 0]);
        let instruction = fixture.instruction();
        let mut order = Vec::new();
        let receipt = fixture.with_infos(|accounts| {
            execute_with_transfers(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |cpi| {
                    order.push(cpi.transfer_index);
                    apply_exact_mock_transfer(cpi)
                },
            )
            .unwrap()
        });
        assert_eq!(receipt.transfer_amounts(), [0, 10_000, 0]);
        assert_eq!(receipt.executed_transfer_count(), 1);
        assert_eq!(order, [1]);
        let treasury = fixture.treasury_tokens.info();
        assert_eq!(token_amount(&treasury), INITIAL_SOURCE_AMOUNT);
        drop(treasury);
        let ecosystem = fixture.ecosystem_tokens.info();
        assert_eq!(token_amount(&ecosystem), 0);
        drop(ecosystem);
        let liquidity = fixture.liquidity_tokens.info();
        assert_eq!(token_amount(&liquidity), INITIAL_SOURCE_AMOUNT);

        let mut zero_fixture = Fixture::with_reservations(&binding, [0, 0, 0]);
        let mut zero_position = decode_position_state(&zero_fixture.position.data).unwrap();
        zero_position.principal = 1;
        encode_position_state(&zero_position, &mut zero_fixture.position.data).unwrap();
        let zero_instruction = zero_fixture.instruction();
        let mut zero_calls = 0u8;
        let zero_receipt = zero_fixture.with_infos(|accounts| {
            execute_with_transfers(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &zero_instruction,
                accounts,
                |_| {
                    zero_calls += 1;
                    Ok(())
                },
            )
            .unwrap()
        });
        assert_eq!(zero_receipt.amount(), 0);
        assert_eq!(zero_receipt.transfer_amounts(), [0, 0, 0]);
        assert_eq!(zero_receipt.executed_transfer_count(), 0);
        assert_eq!(zero_calls, 0);
        let zero_position = decode_position_state(&zero_fixture.position.data).unwrap();
        assert_eq!(zero_position.paid, 0);
        assert_eq!(zero_position.settled_mask, 1);
    }

    #[test]
    fn host_cpi_stubs_cannot_fake_three_transfer_success_or_commit_state() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let instruction = fixture.instruction();
        let before = fixture.all_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_settle_position_week_standard_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
            )
        });
        assert_eq!(
            result,
            Err(ProductionSettlePositionStandardExecutorError::Settle(
                ProductionSettlePositionError::TokenReloadAmountMismatch
            ))
        );
        assert_eq!(fixture.all_snapshot(), before);
    }

    #[test]
    fn second_cpi_failure_stops_order_and_never_commits_any_state() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let instruction = fixture.instruction();
        let state_before = fixture.state_snapshot();
        let mut order = Vec::new();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfers(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |cpi| {
                    order.push(cpi.transfer_index);
                    if cpi.transfer_index == 1 {
                        return Err(ProgramError::Custom(0x529));
                    }
                    apply_exact_mock_transfer(cpi)
                },
            )
        });
        assert_eq!(order, [0, 1]);
        assert_eq!(
            result,
            Err(ProductionSettlePositionStandardExecutorError::Program(
                ProgramError::Custom(0x529)
            ))
        );
        assert_eq!(fixture.state_snapshot(), state_before);
        assert!(
            !core::hint::black_box(
                PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_TRUTH
                    .devnet_transaction_rollback_proven
            ),
            "the validator must roll the first CPI back"
        );
    }

    #[test]
    fn partial_final_transfer_fails_reload_without_committing_state() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let instruction = fixture.instruction();
        let state_before = fixture.state_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfers(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |cpi| {
                    if cpi.transfer_index < 2 {
                        return apply_exact_mock_transfer(cpi);
                    }
                    let source = token_amount(&cpi.account_infos[0]);
                    set_token_amount(&cpi.account_infos[0], source - cpi.amount)
                },
            )
        });
        assert_eq!(
            result,
            Err(ProductionSettlePositionStandardExecutorError::Settle(
                ProductionSettlePositionError::TokenReloadAmountMismatch
            ))
        );
        assert_eq!(fixture.state_snapshot(), state_before);
    }

    #[test]
    fn late_four_state_borrow_conflict_fails_cas_after_exact_reloads() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let instruction = fixture.instruction();
        let state_before = fixture.state_snapshot();
        let tokens_before = fixture.token_amounts();
        let result = fixture.with_infos(|accounts| {
            let position_info = accounts[POSITION_INDEX].clone();
            let mut held_position_borrow = None;
            let result = execute_with_transfers(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction,
                accounts,
                |cpi| {
                    apply_exact_mock_transfer(cpi)?;
                    if cpi.transfer_index == 2 {
                        held_position_borrow = Some(position_info.try_borrow_mut_data()?);
                    }
                    Ok(())
                },
            );
            drop(held_position_borrow);
            result
        });
        assert_eq!(
            result,
            Err(ProductionSettlePositionStandardExecutorError::Write(
                RuntimeWriteAdapterError::AccountBorrowFailed
            ))
        );
        assert_eq!(fixture.state_snapshot(), state_before);
        let tokens_after = fixture.token_amounts();
        assert_eq!(tokens_after, [4_000, 7_000, 9_000, 10_100]);
        assert_ne!(tokens_after, tokens_before);
        assert!(
            PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_TRUTH
                .same_instruction_transaction_rollback_required_after_cpi
        );
        assert!(
            !PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_TRUTH.devnet_transaction_rollback_proven
        );
    }

    #[test]
    fn exact_standard_count_program_and_supplemental_metas_fail_closed() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let instruction = fixture.instruction();
        fixture.with_infos(|accounts| {
            assert_eq!(
                execute_with_transfers(
                    &Pubkey::new_from_array(ECONOMY_PROGRAM),
                    &runtime_law,
                    &binding,
                    &instruction,
                    &accounts[..16],
                    |_| Ok(()),
                ),
                Err(ProductionSettlePositionStandardExecutorError::AccountCountMismatch)
            );
            let mut with_round_shape = accounts.to_vec();
            with_round_shape.insert(3, accounts[LAW_STATE_INDEX].clone());
            assert_eq!(
                execute_with_transfers(
                    &Pubkey::new_from_array(ECONOMY_PROGRAM),
                    &runtime_law,
                    &binding,
                    &instruction,
                    &with_round_shape,
                    |_| Ok(()),
                ),
                Err(ProductionSettlePositionStandardExecutorError::AccountCountMismatch)
            );
            assert_eq!(
                execute_with_transfers(
                    &Pubkey::new_from_array([0x99; 32]),
                    &runtime_law,
                    &binding,
                    &instruction,
                    accounts,
                    |_| Ok(()),
                ),
                Err(ProductionSettlePositionStandardExecutorError::ProgramIdentityMismatch)
            );
        });

        let mut fixture = Fixture::new(&binding);
        fixture.hook_program.writable = true;
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfers(
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
            Err(ProductionSettlePositionStandardExecutorError::SupplementalAccountMetaMismatch)
        );
    }

    #[test]
    fn canonical_mint_law_hash_and_exact_validation_resolution_are_required() {
        let binding = binding();
        let runtime_law = runtime_law();

        let mut fixture = Fixture::new(&binding);
        fixture.mint.data = mint_data([0x99; 32]);
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfers(
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
            Err(ProductionSettlePositionStandardExecutorError::Mint(
                EconomyToken2022Error::TransferHookBindingMismatch
            ))
        );

        let mut fixture = Fixture::new(&binding);
        fixture.law_state.data[159] = 1;
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfers(
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
            Err(ProductionSettlePositionStandardExecutorError::LawCapabilityMismatch)
        );

        let mut fixture = Fixture::new(&binding);
        fixture.hook_validation.data = validation_data(0);
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfers(
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
            Err(ProductionSettlePositionStandardExecutorError::Program(_))
        ));
    }

    #[test]
    fn retained_position_error_precedes_executor_only_hook_validation() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let mut position = decode_position_state(&fixture.position.data).unwrap();
        position.closed = true;
        encode_position_state(&position, &mut fixture.position.data).unwrap();
        fixture.hook_program.key = [0x99; 32].into();
        fixture.hook_validation.data.clear();
        let instruction = fixture.instruction();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfers(
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
            Err(ProductionSettlePositionStandardExecutorError::Settle(
                ProductionSettlePositionError::Economy(EconomyError::PositionClosed)
            ))
        );
    }
}

//! Hook-aware Token-2022 executor for retained-V2 principal withdrawal.
//!
//! This source-complete handler composes the frozen withdraw preflight with one
//! exact `transfer_checked` CPI, exact post-CPI token reloads, and an atomic
//! Config/Position compare-and-swap boundary. The feature-gated production
//! dispatcher/entrypoint routes it with one nonduplicated Daily-Law prefix.
//! Runtime transaction rollback still requires final-binary adversarial Devnet
//! evidence; host tests cannot attest validator rollback behavior, so Mainnet
//! remains on hold.

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;

use crate::native_adapter::{NativeEconomyBinding, VAULT_AUTHORITY_SEED};
use crate::production_withdraw_position::{
    prepare_runtime_production_withdraw_position_account_infos, PreparedProductionWithdrawPosition,
    ProductionWithdrawPositionError, PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT,
};
use crate::runtime_adapter::{
    authenticate_runtime_production_active_writable_config, RuntimeAdapterError,
    RuntimeProductionActiveConfig, RuntimeValidatedDailyLawWrite,
};
use crate::stake_ingress::SourceTokenState;
use crate::stake_ingress_runtime::{observe_stake_ingress_source, observe_stake_ingress_vault};
use crate::token_2022_runtime::{
    authenticate_canonical_economy_mint_account_info, CanonicalEconomyMintBinding,
    EconomyToken2022Error,
};
use crate::{
    encode_config_genesis_state, encode_position_state, CodecError, ConfigGenesisCodecError,
    ConfigGenesisState, PositionState, ReadonlyTokenState, CONFIG_GENESIS_ACCOUNT_LEN,
    MAINNET_SUPPLY, POSITION_ACCOUNT_LEN, TOKEN_DECIMALS,
};
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

const CONFIG_INDEX: usize = 1;
const POSITION_INDEX: usize = 2;
const MINT_INDEX: usize = 3;
const VAULT_AUTHORITY_INDEX: usize = 4;
const SOURCE_TOKEN_INDEX: usize = 5;
const DESTINATION_TOKEN_INDEX: usize = 6;
const TOKEN_PROGRAM_INDEX: usize = 7;
const ZK_PROOF_PROGRAM_INDEX: usize = 8;
const HOOK_PROGRAM_INDEX: usize = 9;
const HOOK_VALIDATION_INDEX: usize = 10;
const LAW_STATE_INDEX: usize = 11;

pub const PRODUCTION_WITHDRAW_POSITION_EXECUTOR_ACCOUNT_COUNT: usize = 12;
/// Transaction-level operation accounts when the canonical Daily-Law account
/// is supplied once as the production entrypoint prefix.
pub const PRODUCTION_WITHDRAW_POSITION_DISPATCH_ACCOUNT_COUNT: usize =
    PRODUCTION_WITHDRAW_POSITION_EXECUTOR_ACCOUNT_COUNT - 1;
pub const PRODUCTION_WITHDRAW_POSITION_EXECUTOR_STATUS: &str =
    "HOOK_AWARE_TOKEN_2022_HANDLER_COMPLETE_ATOMIC_CAS_ROUTED_ONE_LAW_PREFIX_DEVNET_ROLLBACK_FALSE_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionWithdrawPositionExecutorTruth {
    pub feature_gated: bool,
    pub exact_twelve_account_graph_required: bool,
    pub runtime_daily_law_capability_rebound: bool,
    pub production_active_writable_config_required: bool,
    pub exact_production_program_identity_required: bool,
    pub canonical_confidential_hooked_mint_required: bool,
    pub exact_hook_validation_pda_required: bool,
    pub exact_resolved_readonly_law_meta_required: bool,
    pub vault_authority_invoke_signed_used: bool,
    pub zero_amount_cpi_skipped: bool,
    pub retained_v2_cpi_before_state_write_order_preserved: bool,
    pub exact_config_and_position_atomic_cas_executed: bool,
    pub same_instruction_transaction_rollback_required_after_cpi: bool,
    pub dispatcher_exposed: bool,
    pub entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub devnet_transaction_rollback_proven: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_WITHDRAW_POSITION_EXECUTOR_TRUTH: ProductionWithdrawPositionExecutorTruth =
    ProductionWithdrawPositionExecutorTruth {
        feature_gated: true,
        exact_twelve_account_graph_required: true,
        runtime_daily_law_capability_rebound: true,
        production_active_writable_config_required: true,
        exact_production_program_identity_required: true,
        canonical_confidential_hooked_mint_required: true,
        exact_hook_validation_pda_required: true,
        exact_resolved_readonly_law_meta_required: true,
        vault_authority_invoke_signed_used: true,
        zero_amount_cpi_skipped: true,
        retained_v2_cpi_before_state_write_order_preserved: true,
        exact_config_and_position_atomic_cas_executed: true,
        same_instruction_transaction_rollback_required_after_cpi: true,
        dispatcher_exposed: true,
        entrypoint_exposed: true,
        handler_complete: true,
        devnet_transaction_rollback_proven: false,
        mainnet_hold: true,
    };

#[derive(Debug, Eq, PartialEq)]
pub enum ProductionWithdrawPositionExecutorError {
    AccountCountMismatch,
    DuplicateDailyLawAccount,
    ProgramIdentityMismatch,
    SupplementalAccountBindingMismatch,
    SupplementalAccountMetaMismatch,
    LawCapabilityMismatch,
    LawAccountBorrowFailed,
    TransferPlanMismatch,
    ResolvedHookGraphMismatch,
    StakeTokenReloadRejected,
    DestinationTokenReloadRejected,
    TokenReloadIdentityMismatch,
    TokenReloadAmountMismatch,
    ConfigCapabilityMismatch,
    AccountBorrowFailed,
    ConfigPreimageMismatch,
    PositionPreimageMismatch,
    ConfigCodec(ConfigGenesisCodecError),
    PositionCodec(CodecError),
    ArithmeticOverflow,
    Withdraw(ProductionWithdrawPositionError),
    Runtime(RuntimeAdapterError),
    Mint(EconomyToken2022Error),
    Program(ProgramError),
}

impl From<ProductionWithdrawPositionError> for ProductionWithdrawPositionExecutorError {
    fn from(value: ProductionWithdrawPositionError) -> Self {
        Self::Withdraw(value)
    }
}

impl From<RuntimeAdapterError> for ProductionWithdrawPositionExecutorError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<EconomyToken2022Error> for ProductionWithdrawPositionExecutorError {
    fn from(value: EconomyToken2022Error) -> Self {
        Self::Mint(value)
    }
}

impl From<ProgramError> for ProductionWithdrawPositionExecutorError {
    fn from(value: ProgramError) -> Self {
        Self::Program(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionWithdrawPositionStateWriteReceipt {
    config_preimage_sha256: [u8; 32],
    config_postimage_sha256: [u8; 32],
    position_preimage_sha256: [u8; 32],
    position_postimage_sha256: [u8; 32],
    previous_staked_principal: u64,
    next_staked_principal: u64,
}

impl ProductionWithdrawPositionStateWriteReceipt {
    pub const fn config_preimage_sha256(&self) -> [u8; 32] {
        self.config_preimage_sha256
    }

    pub const fn config_postimage_sha256(&self) -> [u8; 32] {
        self.config_postimage_sha256
    }

    pub const fn position_preimage_sha256(&self) -> [u8; 32] {
        self.position_preimage_sha256
    }

    pub const fn position_postimage_sha256(&self) -> [u8; 32] {
        self.position_postimage_sha256
    }

    pub const fn previous_staked_principal(&self) -> u64 {
        self.previous_staked_principal
    }

    pub const fn next_staked_principal(&self) -> u64 {
        self.next_staked_principal
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionWithdrawPositionExecutionReceipt {
    caller: [u8; 32],
    config: [u8; 32],
    position: [u8; 32],
    principal: u64,
    maturity_week: u64,
    law_account_sha256: [u8; 32],
    state_write: ProductionWithdrawPositionStateWriteReceipt,
}

impl ProductionWithdrawPositionExecutionReceipt {
    pub const fn caller(&self) -> [u8; 32] {
        self.caller
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn position(&self) -> [u8; 32] {
        self.position
    }

    pub const fn principal(&self) -> u64 {
        self.principal
    }

    pub const fn maturity_week(&self) -> u64 {
        self.maturity_week
    }

    pub const fn law_account_sha256(&self) -> [u8; 32] {
        self.law_account_sha256
    }

    pub const fn state_write(&self) -> &ProductionWithdrawPositionStateWriteReceipt {
        &self.state_write
    }
}

struct WithdrawTransferCpi<'a> {
    instruction: Instruction,
    account_infos: Vec<AccountInfo<'a>>,
    config: Pubkey,
    vault_authority_bump: u8,
}

impl WithdrawTransferCpi<'_> {
    fn invoke(&self) -> ProgramResult {
        let bump_seed = [self.vault_authority_bump];
        let signer_seeds: &[&[u8]] = &[VAULT_AUTHORITY_SEED, self.config.as_ref(), &bump_seed];
        invoke_signed(&self.instruction, &self.account_infos, &[signer_seeds])
    }
}

struct PreparedWithdrawStateCas {
    expected_config_sha256: [u8; 32],
    config_postimage: [u8; CONFIG_GENESIS_ACCOUNT_LEN],
    expected_position_sha256: [u8; 32],
    position_postimage: [u8; POSITION_ACCOUNT_LEN],
    previous_staked_principal: u64,
    next_staked_principal: u64,
}

struct PreparedWithdrawTokenReload {
    source_before: ReadonlyTokenState,
    destination_before: SourceTokenState,
}

/// Execute retained-V2 principal withdrawal through the exact hook-aware
/// Token-2022 CPI and atomic Config/Position CAS boundaries.
///
/// Account order is exact: 0 caller, 1 Config, 2 Position, 3 mint,
/// 4 vault authority, 5 stake-token source, 6 owner-token destination,
/// 7 Token-2022 program, 8 ZK ElGamal proof program, 9 transfer-hook program,
/// 10 transfer-hook validation PDA, 11 Daily-Law state.
///
/// This source-complete callable executor is reached through the feature-gated
/// production dispatcher. A returned error after CPI relies on Solana
/// transaction semantics for rollback; final-binary adversarial Devnet proof
/// is outstanding and Mainnet remains held.
#[inline(never)]
pub fn execute_runtime_production_withdraw_position_account_infos(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<ProductionWithdrawPositionExecutionReceipt, ProductionWithdrawPositionExecutorError> {
    execute_with_transfer(
        program_id,
        runtime_law,
        binding,
        instruction_data,
        accounts,
        WithdrawTransferCpi::invoke,
    )
}

/// Adapt the production entrypoint's one canonical Daily-Law prefix account to
/// the executor's frozen hook-CPI order. The transaction supplies exactly
/// eleven operation accounts; this function appends an internal AccountInfo
/// handle for the already-authenticated prefix. A duplicated Law key in the
/// operation slice is rejected before instruction or account parsing.
#[inline(never)]
pub(crate) fn execute_runtime_production_withdraw_position_with_daily_law_prefix_account_infos<
    'info,
>(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    daily_law_account: &AccountInfo<'info>,
    operation_accounts: &[AccountInfo<'info>],
) -> Result<ProductionWithdrawPositionExecutionReceipt, ProductionWithdrawPositionExecutorError> {
    if operation_accounts.len() != PRODUCTION_WITHDRAW_POSITION_DISPATCH_ACCOUNT_COUNT {
        return Err(ProductionWithdrawPositionExecutorError::AccountCountMismatch);
    }
    if operation_accounts
        .iter()
        .any(|account| account.key == daily_law_account.key)
    {
        return Err(ProductionWithdrawPositionExecutorError::DuplicateDailyLawAccount);
    }
    let mut executor_accounts =
        Vec::with_capacity(PRODUCTION_WITHDRAW_POSITION_EXECUTOR_ACCOUNT_COUNT);
    executor_accounts.extend(operation_accounts.iter().cloned());
    executor_accounts.push(daily_law_account.clone());
    execute_runtime_production_withdraw_position_account_infos(
        program_id,
        runtime_law,
        binding,
        instruction_data,
        &executor_accounts,
    )
}

#[inline(never)]
fn execute_with_transfer<'a, F>(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'a>],
    transfer: F,
) -> Result<ProductionWithdrawPositionExecutionReceipt, ProductionWithdrawPositionExecutorError>
where
    F: FnOnce(&WithdrawTransferCpi<'a>) -> ProgramResult,
{
    require_account_count(accounts)?;

    // Preserve the frozen retained-V2 instruction/account/kernel error order
    // before introducing executor-only mint and hook checks.
    let prepared = prepare_runtime_production_withdraw_position_account_infos(
        runtime_law,
        binding,
        instruction_data,
        &accounts[..PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT],
    )?;
    let active_config = authenticate_runtime_production_active_writable_config(
        runtime_law,
        binding,
        &accounts[CONFIG_INDEX],
    )?;

    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionWithdrawPositionExecutorError::ProgramIdentityMismatch);
    }

    require_supplemental_accounts(runtime_law, accounts)?;
    authenticate_executor_mint(runtime_law, binding, accounts)?;
    require_law_capability_rebound(runtime_law, &accounts[LAW_STATE_INDEX])?;

    let state_cas = prepare_state_cas(&prepared, &active_config, accounts)?;
    let token_reload = prepare_token_reload(&prepared, accounts)?;

    // Retained V2's `transfer_from_vault` returns before constructing a CPI
    // when the amount is zero. Preserve that exact observable call count.
    if prepared.plan().transfer.amount != 0 {
        let cpi = build_withdraw_transfer_cpi(&prepared, binding, accounts)?;
        transfer(&cpi)?;
        drop(cpi);
    }

    require_exact_post_transfer_tokens(&prepared, accounts, token_reload)?;
    let state_write = execute_state_cas(accounts, state_cas)?;

    Ok(ProductionWithdrawPositionExecutionReceipt {
        caller: prepared.caller(),
        config: prepared.config(),
        position: prepared.position(),
        principal: prepared.plan().transfer.amount,
        maturity_week: prepared.plan().maturity_week,
        law_account_sha256: runtime_law.law_account_sha256(),
        state_write,
    })
}

fn require_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionWithdrawPositionExecutorError> {
    if accounts.len() != PRODUCTION_WITHDRAW_POSITION_EXECUTOR_ACCOUNT_COUNT {
        return Err(ProductionWithdrawPositionExecutorError::AccountCountMismatch);
    }
    Ok(())
}

fn require_supplemental_accounts(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionWithdrawPositionExecutorError> {
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
) -> Result<(), ProductionWithdrawPositionExecutorError> {
    if account.key != expected_key {
        return Err(ProductionWithdrawPositionExecutorError::SupplementalAccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || !account.executable {
        return Err(ProductionWithdrawPositionExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn require_readonly_owned_account(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
    expected_owner: &Pubkey,
) -> Result<(), ProductionWithdrawPositionExecutorError> {
    if account.key != expected_key || account.owner != expected_owner {
        return Err(ProductionWithdrawPositionExecutorError::SupplementalAccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionWithdrawPositionExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn authenticate_executor_mint(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionWithdrawPositionExecutorError> {
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
) -> Result<(), ProductionWithdrawPositionExecutorError> {
    let data = law_account
        .try_borrow_data()
        .map_err(|_| ProductionWithdrawPositionExecutorError::LawAccountBorrowFailed)?;
    let observed: [u8; 32] = Sha256::digest(&*data).into();
    if observed != runtime_law.law_account_sha256() {
        return Err(ProductionWithdrawPositionExecutorError::LawCapabilityMismatch);
    }
    Ok(())
}

fn prepare_state_cas(
    prepared: &PreparedProductionWithdrawPosition,
    active_config: &RuntimeProductionActiveConfig,
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedWithdrawStateCas, ProductionWithdrawPositionExecutorError> {
    let plan = prepared.plan();
    if active_config.key() != prepared.config()
        || active_config.state().config != plan.config_snapshot
        || plan.config_key != prepared.config()
        || plan.position_snapshot.config != prepared.config()
        || accounts[CONFIG_INDEX].key.to_bytes() != prepared.config()
        || accounts[POSITION_INDEX].key.to_bytes() != prepared.position()
    {
        return Err(ProductionWithdrawPositionExecutorError::ConfigCapabilityMismatch);
    }

    let config_data = accounts[CONFIG_INDEX]
        .try_borrow_data()
        .map_err(|_| ProductionWithdrawPositionExecutorError::AccountBorrowFailed)?;
    if config_data.len() != CONFIG_GENESIS_ACCOUNT_LEN
        || sha256(&config_data) != active_config.preimage_sha256()
    {
        return Err(ProductionWithdrawPositionExecutorError::ConfigPreimageMismatch);
    }
    drop(config_data);

    let position_data = accounts[POSITION_INDEX]
        .try_borrow_data()
        .map_err(|_| ProductionWithdrawPositionExecutorError::AccountBorrowFailed)?;
    if position_data.len() != POSITION_ACCOUNT_LEN {
        return Err(ProductionWithdrawPositionExecutorError::PositionPreimageMismatch);
    }
    let expected_position_sha256 = sha256(&position_data);
    let mut canonical_position_preimage = [0u8; POSITION_ACCOUNT_LEN];
    encode_position_state(&plan.position_snapshot, &mut canonical_position_preimage)
        .map_err(ProductionWithdrawPositionExecutorError::PositionCodec)?;
    if position_data.as_ref() != canonical_position_preimage {
        return Err(ProductionWithdrawPositionExecutorError::PositionPreimageMismatch);
    }
    drop(position_data);

    let previous_staked_principal = plan.config_snapshot.staked_principal;
    let next_staked_principal = previous_staked_principal
        .checked_sub(plan.transfer.amount)
        .ok_or(ProductionWithdrawPositionExecutorError::ArithmeticOverflow)?;
    let mut next_config = ConfigGenesisState {
        phase: active_config.state().phase,
        config: plan.config_snapshot,
    };
    next_config.config.staked_principal = next_staked_principal;
    let mut config_postimage = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&next_config, &mut config_postimage)
        .map_err(ProductionWithdrawPositionExecutorError::ConfigCodec)?;

    let mut next_position: PositionState = plan.position_snapshot;
    next_position.principal_returned = true;
    let mut position_postimage = [0u8; POSITION_ACCOUNT_LEN];
    encode_position_state(&next_position, &mut position_postimage)
        .map_err(ProductionWithdrawPositionExecutorError::PositionCodec)?;

    Ok(PreparedWithdrawStateCas {
        expected_config_sha256: active_config.preimage_sha256(),
        config_postimage,
        expected_position_sha256,
        position_postimage,
        previous_staked_principal,
        next_staked_principal,
    })
}

fn prepare_token_reload(
    prepared: &PreparedProductionWithdrawPosition,
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedWithdrawTokenReload, ProductionWithdrawPositionExecutorError> {
    let source = observe_stake_ingress_vault(
        &accounts[SOURCE_TOKEN_INDEX],
        accounts[MINT_INDEX].key,
        accounts[VAULT_AUTHORITY_INDEX].key,
    )
    .map_err(|_| ProductionWithdrawPositionExecutorError::StakeTokenReloadRejected)?;
    let destination = observe_stake_ingress_source(
        &accounts[DESTINATION_TOKEN_INDEX],
        accounts[MINT_INDEX].key,
        &Pubkey::new_from_array(prepared.plan().position_snapshot.owner),
    )
    .map_err(|_| ProductionWithdrawPositionExecutorError::DestinationTokenReloadRejected)?;
    if source.amount != prepared.plan().config_snapshot.staked_principal {
        return Err(ProductionWithdrawPositionExecutorError::TokenReloadAmountMismatch);
    }
    Ok(PreparedWithdrawTokenReload {
        source_before: source,
        destination_before: destination,
    })
}

fn require_exact_post_transfer_tokens(
    prepared: &PreparedProductionWithdrawPosition,
    accounts: &[AccountInfo<'_>],
    reload: PreparedWithdrawTokenReload,
) -> Result<(), ProductionWithdrawPositionExecutorError> {
    let source = observe_stake_ingress_vault(
        &accounts[SOURCE_TOKEN_INDEX],
        accounts[MINT_INDEX].key,
        accounts[VAULT_AUTHORITY_INDEX].key,
    )
    .map_err(|_| ProductionWithdrawPositionExecutorError::StakeTokenReloadRejected)?;
    let destination = observe_stake_ingress_source(
        &accounts[DESTINATION_TOKEN_INDEX],
        accounts[MINT_INDEX].key,
        &Pubkey::new_from_array(prepared.plan().position_snapshot.owner),
    )
    .map_err(|_| ProductionWithdrawPositionExecutorError::DestinationTokenReloadRejected)?;
    if source.key != reload.source_before.key
        || source.mint != reload.source_before.mint
        || source.owner != reload.source_before.owner
        || source.key != prepared.plan().transfer.source
        || destination.token.key != reload.destination_before.token.key
        || destination.token.mint != reload.destination_before.token.mint
        || destination.token.owner != reload.destination_before.token.owner
        || destination.delegate != reload.destination_before.delegate
        || destination.cpi_guard_locked != reload.destination_before.cpi_guard_locked
        || destination.token.key != prepared.plan().transfer.destination
    {
        return Err(ProductionWithdrawPositionExecutorError::TokenReloadIdentityMismatch);
    }
    // Retained V2 reaches this arithmetic only after Token-2022 returns
    // success. In particular, a destination overflow must not suppress the
    // transfer call or replace its ProgramError.
    let expected_source_after = reload
        .source_before
        .amount
        .checked_sub(prepared.plan().transfer.amount)
        .ok_or(ProductionWithdrawPositionExecutorError::ArithmeticOverflow)?;
    let expected_destination_after = reload
        .destination_before
        .token
        .amount
        .checked_add(prepared.plan().transfer.amount)
        .ok_or(ProductionWithdrawPositionExecutorError::ArithmeticOverflow)?;
    if source.amount != expected_source_after
        || destination.token.amount != expected_destination_after
    {
        return Err(ProductionWithdrawPositionExecutorError::TokenReloadAmountMismatch);
    }
    Ok(())
}

fn build_withdraw_transfer_cpi<'a>(
    prepared: &PreparedProductionWithdrawPosition,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'a>],
) -> Result<WithdrawTransferCpi<'a>, ProductionWithdrawPositionExecutorError> {
    let plan = prepared.plan();
    if plan.transfer.token_program != TOKEN_2022_PROGRAM_ID.to_bytes()
        || plan.transfer.source != accounts[SOURCE_TOKEN_INDEX].key.to_bytes()
        || plan.transfer.mint != binding.mint()
        || plan.transfer.mint != accounts[MINT_INDEX].key.to_bytes()
        || plan.transfer.destination != accounts[DESTINATION_TOKEN_INDEX].key.to_bytes()
        || plan.transfer.authority != prepared.vault_authority()
        || plan.transfer.authority != accounts[VAULT_AUTHORITY_INDEX].key.to_bytes()
        || plan.transfer.amount != plan.position_snapshot.principal
        || plan.transfer.decimals != TOKEN_DECIMALS
    {
        return Err(ProductionWithdrawPositionExecutorError::TransferPlanMismatch);
    }

    let mut instruction = transfer_checked(
        &TOKEN_2022_PROGRAM_ID,
        accounts[SOURCE_TOKEN_INDEX].key,
        accounts[MINT_INDEX].key,
        accounts[DESTINATION_TOKEN_INDEX].key,
        accounts[VAULT_AUTHORITY_INDEX].key,
        &[],
        plan.transfer.amount,
        TOKEN_DECIMALS,
    )?;
    let mut account_infos = vec![
        accounts[SOURCE_TOKEN_INDEX].clone(),
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
        accounts[SOURCE_TOKEN_INDEX].clone(),
        accounts[MINT_INDEX].clone(),
        accounts[DESTINATION_TOKEN_INDEX].clone(),
        accounts[VAULT_AUTHORITY_INDEX].clone(),
        plan.transfer.amount,
        &additional,
    )?;
    require_exact_resolved_hook_graph(&instruction, &account_infos, accounts)?;
    account_infos.push(accounts[TOKEN_PROGRAM_INDEX].clone());

    Ok(WithdrawTransferCpi {
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
) -> Result<(), ProductionWithdrawPositionExecutorError> {
    let expected_metas = [
        AccountMeta::new(*accounts[SOURCE_TOKEN_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[MINT_INDEX].key, false),
        AccountMeta::new(*accounts[DESTINATION_TOKEN_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[VAULT_AUTHORITY_INDEX].key, true),
        AccountMeta::new_readonly(*accounts[LAW_STATE_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[HOOK_VALIDATION_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[HOOK_PROGRAM_INDEX].key, false),
    ];
    let expected_keys = [
        accounts[SOURCE_TOKEN_INDEX].key,
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
        return Err(ProductionWithdrawPositionExecutorError::ResolvedHookGraphMismatch);
    }
    Ok(())
}

fn execute_state_cas(
    accounts: &[AccountInfo<'_>],
    prepared: PreparedWithdrawStateCas,
) -> Result<ProductionWithdrawPositionStateWriteReceipt, ProductionWithdrawPositionExecutorError> {
    // Acquire both mutable borrows and revalidate both live preimages before
    // the first byte is copied. Any local failure therefore writes neither
    // Config nor Position.
    let mut config_data = accounts[CONFIG_INDEX]
        .try_borrow_mut_data()
        .map_err(|_| ProductionWithdrawPositionExecutorError::AccountBorrowFailed)?;
    let mut position_data = accounts[POSITION_INDEX]
        .try_borrow_mut_data()
        .map_err(|_| ProductionWithdrawPositionExecutorError::AccountBorrowFailed)?;
    if config_data.len() != CONFIG_GENESIS_ACCOUNT_LEN
        || sha256(&config_data) != prepared.expected_config_sha256
    {
        return Err(ProductionWithdrawPositionExecutorError::ConfigPreimageMismatch);
    }
    if position_data.len() != POSITION_ACCOUNT_LEN
        || sha256(&position_data) != prepared.expected_position_sha256
    {
        return Err(ProductionWithdrawPositionExecutorError::PositionPreimageMismatch);
    }

    config_data.copy_from_slice(&prepared.config_postimage);
    position_data.copy_from_slice(&prepared.position_postimage);

    Ok(ProductionWithdrawPositionStateWriteReceipt {
        config_preimage_sha256: prepared.expected_config_sha256,
        config_postimage_sha256: sha256(&prepared.config_postimage),
        position_preimage_sha256: prepared.expected_position_sha256,
        position_postimage_sha256: sha256(&prepared.position_postimage),
        previous_staked_principal: prepared.previous_staked_principal,
        next_staked_principal: prepared.next_staked_principal,
    })
}

fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_adapter::{derive_pda, PdaIdentity};
    use crate::production_instruction::{
        encode_production_instruction, ProductionInstruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::{
        decode_config_genesis_state, decode_position_state, encode_config_genesis_state,
        encode_position_state, verify_daily_law_open, CanonicalDailyLawBinding, ConfigState,
        EconomyError, GenesisPhase, ReadonlyDailyLawAccount, ValidatedDailyLawWrite, LAW_STATE_LEN,
        LAW_STATE_MAGIC, LAW_STATE_VERSION, SECONDS_PER_WEEK, USER_TERM_WEEKS,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_sdk_ids::{native_loader, system_program};
    use spl_token_2022_interface::{
        extension::{
            confidential_transfer::ConfidentialTransferMint,
            cpi_guard::CpiGuard,
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
    const PRINCIPAL: u64 = 100;
    const INITIAL_DESTINATION_AMOUNT: u64 = 1_000;

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

    fn instruction() -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut data = [0u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(ProductionInstruction::WithdrawPositionPrincipal, &mut data)
            .unwrap();
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

    fn token_data(owner: [u8; 32], amount: u64, include_cpi_guard: bool) -> Vec<u8> {
        let mut extensions = vec![ExtensionType::TransferHookAccount];
        if include_cpi_guard {
            extensions.push(ExtensionType::CpiGuard);
        }
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
        if include_cpi_guard {
            state.init_extension::<CpiGuard>(false).unwrap();
        }
        state.pack_base();
        data
    }

    // Exact `ExtraAccountMetaList<ExecuteInstruction>` bytes emitted by the
    // Law initializer for one readonly `[b"law-state", mint]` PDA.
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
        data[16] = 1;
        data[17] = 1;
        data[18] = 9;
        data[19..28].copy_from_slice(b"law-state");
        data[28] = 3;
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

    fn set_destination_delegate(account: &AccountInfo<'_>) -> ProgramResult {
        let mut data = account.try_borrow_mut_data()?;
        let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(&mut data)?;
        state.base.delegate = Some(Pubkey::new_from_array([0xD1; 32])).into();
        state.base.delegated_amount = 1;
        state.pack_base();
        Ok(())
    }

    fn set_destination_cpi_guard(account: &AccountInfo<'_>) -> ProgramResult {
        let mut data = account.try_borrow_mut_data()?;
        let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(&mut data)?;
        state.get_extension_mut::<CpiGuard>()?.lock_cpi.0 = 1;
        Ok(())
    }

    fn apply_exact_mock_transfer(cpi: &WithdrawTransferCpi<'_>) -> ProgramResult {
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
        assert_eq!(token_amount(&cpi.account_infos[0]), PRINCIPAL);
        assert_eq!(
            token_amount(&cpi.account_infos[2]),
            INITIAL_DESTINATION_AMOUNT
        );
        set_token_amount(&cpi.account_infos[0], 0)?;
        set_token_amount(
            &cpi.account_infos[2],
            INITIAL_DESTINATION_AMOUNT + PRINCIPAL,
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
        caller: TestAccount,
        config: TestAccount,
        position: TestAccount,
        mint: TestAccount,
        vault_authority: TestAccount,
        stake_tokens: TestAccount,
        destination_tokens: TestAccount,
        token_program: TestAccount,
        zk_program: TestAccount,
        hook_program: TestAccount,
        hook_validation: TestAccount,
        law_state: TestAccount,
    }

    impl Fixture {
        fn new(binding: &NativeEconomyBinding) -> Self {
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
                    genesis_timestamp: CLOCK_TIMESTAMP - 55 * SECONDS_PER_WEEK,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: PRINCIPAL,
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

            let position_identity = PdaIdentity::Position {
                config: binding.config(),
                operator: POSITION_OWNER,
                position_id: 7,
            };
            let position_key = derive_pda(binding, position_identity).unwrap();
            let position_state = PositionState {
                config: binding.config(),
                owner: POSITION_OWNER,
                position_id: 7,
                principal: PRINCIPAL,
                accepted_week: 1,
                first_accrual_week: 2,
                term_weeks: USER_TERM_WEEKS,
                annual_rate_bps: 500,
                treasury_reserved: 0,
                ecosystem_reserved: 0,
                liquidity_reserved: 0,
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
                    writable: true,
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
                stake_tokens: TestAccount {
                    key: stake_token.key.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, PRINCIPAL, false),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                destination_tokens: TestAccount {
                    key: [0x72; 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(POSITION_OWNER, INITIAL_DESTINATION_AMOUNT, true),
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

        fn with_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &mut [AccountInfo<'_>; PRODUCTION_WITHDRAW_POSITION_EXECUTOR_ACCOUNT_COUNT],
            ) -> R,
        ) -> R {
            let mut infos = [
                self.caller.info(),
                self.config.info(),
                self.position.info(),
                self.mint.info(),
                self.vault_authority.info(),
                self.stake_tokens.info(),
                self.destination_tokens.info(),
                self.token_program.info(),
                self.zk_program.info(),
                self.hook_program.info(),
                self.hook_validation.info(),
                self.law_state.info(),
            ];
            operation(&mut infos)
        }

        fn state_snapshot(&self) -> [Vec<u8>; 2] {
            [self.config.data.clone(), self.position.data.clone()]
        }

        fn all_snapshot(&self) -> [Vec<u8>; 4] {
            [
                self.config.data.clone(),
                self.position.data.clone(),
                self.stake_tokens.data.clone(),
                self.destination_tokens.data.clone(),
            ]
        }

        fn make_zero_principal(&mut self) {
            let mut config = decode_config_genesis_state(&self.config.data).unwrap();
            config.config.staked_principal = 0;
            encode_config_genesis_state(&config, &mut self.config.data).unwrap();

            let mut position = decode_position_state(&self.position.data).unwrap();
            position.principal = 0;
            encode_position_state(&position, &mut self.position.data).unwrap();

            let info = self.stake_tokens.info();
            set_token_amount(&info, 0).unwrap();
        }
    }

    #[test]
    fn truth_is_source_complete_zero_aware_routed_and_mainnet_held() {
        let truth = core::hint::black_box(PRODUCTION_WITHDRAW_POSITION_EXECUTOR_TRUTH);
        assert_eq!(
            PRODUCTION_WITHDRAW_POSITION_EXECUTOR_STATUS,
            "HOOK_AWARE_TOKEN_2022_HANDLER_COMPLETE_ATOMIC_CAS_ROUTED_ONE_LAW_PREFIX_DEVNET_ROLLBACK_FALSE_MAINNET_HOLD"
        );
        assert!(truth.exact_twelve_account_graph_required);
        assert!(truth.production_active_writable_config_required);
        assert!(truth.zero_amount_cpi_skipped);
        assert!(truth.retained_v2_cpi_before_state_write_order_preserved);
        assert!(truth.exact_config_and_position_atomic_cas_executed);
        assert!(truth.same_instruction_transaction_rollback_required_after_cpi);
        assert!(truth.dispatcher_exposed);
        assert!(truth.entrypoint_exposed);
        assert!(truth.handler_complete);
        assert!(!truth.devnet_transaction_rollback_proven);
        assert!(truth.mainnet_hold);
    }

    #[test]
    fn exact_hook_graph_reload_and_two_state_atomic_cas_execute() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let mut fixture = Fixture::new(&binding);
        let before_config = decode_config_genesis_state(&fixture.config.data).unwrap();
        let before_position = decode_position_state(&fixture.position.data).unwrap();
        let mut calls = 0u8;
        let receipt = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |cpi| {
                    calls += 1;
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
        assert_eq!(calls, 1);
        assert_eq!(receipt.caller(), CALLER);
        assert_eq!(receipt.config(), binding.config());
        assert_eq!(receipt.position(), fixture.position.key.to_bytes());
        assert_eq!(receipt.principal(), PRINCIPAL);
        assert_eq!(receipt.maturity_week(), 1 + USER_TERM_WEEKS);
        assert_eq!(receipt.state_write().previous_staked_principal(), PRINCIPAL);
        assert_eq!(receipt.state_write().next_staked_principal(), 0);
        assert_ne!(receipt.state_write().config_preimage_sha256(), [0; 32]);
        assert_ne!(receipt.state_write().config_postimage_sha256(), [0; 32]);
        assert_ne!(receipt.state_write().position_preimage_sha256(), [0; 32]);
        assert_ne!(receipt.state_write().position_postimage_sha256(), [0; 32]);

        let after_config = decode_config_genesis_state(&fixture.config.data).unwrap();
        let after_position = decode_position_state(&fixture.position.data).unwrap();
        let mut expected_config = before_config;
        expected_config.config.staked_principal = 0;
        let mut expected_position = before_position;
        expected_position.principal_returned = true;
        assert_eq!(after_config, expected_config);
        assert_eq!(after_position, expected_position);
        let source = fixture.stake_tokens.info();
        assert_eq!(token_amount(&source), 0);
        drop(source);
        let destination = fixture.destination_tokens.info();
        assert_eq!(
            token_amount(&destination),
            INITIAL_DESTINATION_AMOUNT + PRINCIPAL
        );
    }

    #[test]
    fn zero_principal_skips_cpi_reloads_unchanged_tokens_and_marks_returned() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        fixture.make_zero_principal();
        let tokens_before = [
            fixture.stake_tokens.data.clone(),
            fixture.destination_tokens.data.clone(),
        ];
        let mut calls = 0u8;
        let receipt = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| {
                    calls += 1;
                    Ok(())
                },
            )
            .unwrap()
        });
        assert_eq!(calls, 0);
        assert_eq!(receipt.principal(), 0);
        assert_eq!(receipt.state_write().previous_staked_principal(), 0);
        assert_eq!(receipt.state_write().next_staked_principal(), 0);
        assert_eq!(
            [
                fixture.stake_tokens.data.clone(),
                fixture.destination_tokens.data.clone(),
            ],
            tokens_before
        );
        assert_eq!(
            decode_config_genesis_state(&fixture.config.data)
                .unwrap()
                .config
                .staked_principal,
            0
        );
        assert!(
            decode_position_state(&fixture.position.data)
                .unwrap()
                .principal_returned
        );
    }

    #[test]
    fn host_cpi_stub_cannot_fake_success_or_commit_state() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let before = fixture.all_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_withdraw_position_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::TokenReloadAmountMismatch)
        );
        assert_eq!(fixture.all_snapshot(), before);
    }

    #[test]
    fn dispatch_mapping_reuses_one_law_prefix_and_rejects_duplicate_transaction_meta() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let before = fixture.all_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_withdraw_position_with_daily_law_prefix_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                &accounts[LAW_STATE_INDEX],
                &accounts[..LAW_STATE_INDEX],
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::TokenReloadAmountMismatch)
        );
        assert_eq!(fixture.all_snapshot(), before);

        let mut fixture = Fixture::new(&binding);
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_withdraw_position_with_daily_law_prefix_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                &accounts[LAW_STATE_INDEX],
                &accounts[1..],
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::DuplicateDailyLawAccount)
        );
    }

    #[test]
    fn cpi_error_returns_before_reload_or_any_state_write() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let before = fixture.all_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| Err(ProgramError::Custom(0x731)),
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::Program(
                ProgramError::Custom(0x731)
            ))
        );
        assert_eq!(fixture.all_snapshot(), before);
    }

    #[test]
    fn destination_overflow_is_checked_only_after_the_retained_cpi_boundary() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let destination = fixture.destination_tokens.info();
        set_token_amount(&destination, u64::MAX).unwrap();
        drop(destination);
        let state_before = fixture.state_snapshot();
        let mut calls = 0u8;
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| {
                    calls += 1;
                    Ok(())
                },
            )
        });
        assert_eq!(calls, 1);
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::ArithmeticOverflow)
        );
        assert_eq!(fixture.state_snapshot(), state_before);
    }

    #[test]
    fn partial_transfer_fails_reload_without_committing_config_or_position() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let state_before = fixture.state_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |cpi| set_token_amount(&cpi.account_infos[0], 0),
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::TokenReloadAmountMismatch)
        );
        assert_eq!(fixture.state_snapshot(), state_before);
        assert!(
            !core::hint::black_box(
                PRODUCTION_WITHDRAW_POSITION_EXECUTOR_TRUTH.devnet_transaction_rollback_proven
            ),
            "a validator must prove rollback of the partial token mutation"
        );
    }

    #[test]
    fn destination_delegate_and_cpi_guard_drift_fail_exact_reload() {
        let binding = binding();
        let runtime_law = runtime_law();

        let mut fixture = Fixture::new(&binding);
        let state_before = fixture.state_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |cpi| {
                    apply_exact_mock_transfer(cpi)?;
                    set_destination_delegate(&cpi.account_infos[2])
                },
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::TokenReloadIdentityMismatch)
        );
        assert_eq!(fixture.state_snapshot(), state_before);

        let mut fixture = Fixture::new(&binding);
        let state_before = fixture.state_snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |cpi| {
                    apply_exact_mock_transfer(cpi)?;
                    set_destination_cpi_guard(&cpi.account_infos[2])
                },
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::TokenReloadIdentityMismatch)
        );
        assert_eq!(fixture.state_snapshot(), state_before);
    }

    #[test]
    fn late_position_borrow_conflict_writes_neither_ledger_account_and_keeps_rollback_held() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        let state_before = fixture.state_snapshot();
        let result = fixture.with_infos(|accounts| {
            let position_info = accounts[POSITION_INDEX].clone();
            let mut held_position_borrow = None;
            let result = execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |cpi| {
                    apply_exact_mock_transfer(cpi)?;
                    held_position_borrow = Some(position_info.try_borrow_mut_data()?);
                    Ok(())
                },
            );
            drop(held_position_borrow);
            result
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::AccountBorrowFailed)
        );
        assert_eq!(fixture.state_snapshot(), state_before);
        let source = fixture.stake_tokens.info();
        assert_eq!(token_amount(&source), 0);
        drop(source);
        let destination = fixture.destination_tokens.info();
        assert_eq!(
            token_amount(&destination),
            INITIAL_DESTINATION_AMOUNT + PRINCIPAL
        );
        drop(destination);
        let truth = PRODUCTION_WITHDRAW_POSITION_EXECUTOR_TRUTH;
        assert!(truth.same_instruction_transaction_rollback_required_after_cpi);
        assert!(!truth.devnet_transaction_rollback_proven);
    }

    #[test]
    fn exact_count_program_and_supplemental_metas_fail_closed() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding);
        fixture.with_infos(|accounts| {
            assert_eq!(
                execute_with_transfer(
                    &Pubkey::new_from_array(ECONOMY_PROGRAM),
                    &runtime_law,
                    &binding,
                    &instruction(),
                    &accounts[..11],
                    |_| Ok(()),
                ),
                Err(ProductionWithdrawPositionExecutorError::AccountCountMismatch)
            );
            assert_eq!(
                execute_with_transfer(
                    &Pubkey::new_from_array([0x99; 32]),
                    &runtime_law,
                    &binding,
                    &instruction(),
                    accounts,
                    |_| Ok(()),
                ),
                Err(ProductionWithdrawPositionExecutorError::ProgramIdentityMismatch)
            );
        });

        let mut fixture = Fixture::new(&binding);
        fixture.hook_program.writable = true;
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::SupplementalAccountMetaMismatch)
        );
    }

    #[test]
    fn canonical_mint_law_hash_and_validation_resolution_are_required() {
        let binding = binding();
        let runtime_law = runtime_law();

        let mut fixture = Fixture::new(&binding);
        fixture.mint.data = mint_data([0x99; 32]);
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::Mint(
                EconomyToken2022Error::TransferHookBindingMismatch
            ))
        );

        let mut fixture = Fixture::new(&binding);
        fixture.law_state.data[159] = 1;
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::LawCapabilityMismatch)
        );

        let mut fixture = Fixture::new(&binding);
        fixture.hook_validation.data = validation_data(0);
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| Ok(()),
            )
        });
        assert!(matches!(
            result,
            Err(ProductionWithdrawPositionExecutorError::Program(_))
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
        let result = fixture.with_infos(|accounts| {
            execute_with_transfer(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
                |_| Ok(()),
            )
        });
        assert_eq!(
            result,
            Err(ProductionWithdrawPositionExecutorError::Withdraw(
                ProductionWithdrawPositionError::Economy(EconomyError::PositionClosed)
            ))
        );
    }
}

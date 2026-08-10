//! Feature-gated Token-2022 executor for a prepared stake-ingress plan.
//!
//! This closes the production-source Daily-Law-authentication/CPI/reload gap without exposing an
//! entrypoint, dispatcher, instruction ABI, production identity, or deployment
//! authorization. The production combined executor below authenticates the
//! canonical finalized OPEN Daily Law account from `AccountInfo` and `Clock`,
//! requires an opaque production-ACTIVE Config capability bound to that exact
//! Law observation, constructs the retained V2 plan inside the same call, and
//! only then enters Token-2022.
//! The lower-level prepared-plan primitive remains non-authorizing. Full
//! confidential-mint policy authentication and the post-CPI V2 persistence
//! finalizer remain mandatory. This executor carries
//! only bounded token observations on the SBF stack and calls a transaction-
//! local persistence callback after the exact transfer delta is proven. Any
//! callback or delegate-restoration failure rolls the complete transaction
//! back.

extern crate alloc;

use alloc::{boxed::Box, vec, vec::Vec};
use solana_account_info::AccountInfo;
use solana_cpi::{invoke, invoke_signed};
use solana_program_error::{ProgramError, ProgramResult};
use solana_pubkey::Pubkey;
use spl_token_2022_interface::{
    extension::{
        cpi_guard::CpiGuard,
        transfer_hook::{TransferHook, TransferHookAccount},
        BaseStateWithExtensions, ExtensionType, StateWithExtensions,
    },
    instruction::{approve_checked, transfer_checked},
    state::{Account as TokenAccount, AccountState, Mint},
    ID as TOKEN_2022_PROGRAM_ID,
};
use spl_transfer_hook_interface::{
    get_extra_account_metas_address, onchain::add_extra_accounts_for_execute_cpi,
};

use crate::{
    native_adapter::NativeEconomyBinding,
    runtime_adapter::{
        verify_daily_law_open_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
    },
    stake_ingress::{
        prepare_open_position_stake_ingress, DelegateRestorationIntent, DelegateSnapshot,
        IngressPdaBinding, PrepareStakeIngressInput, SourceTokenState, StakeIngressExecutionPlan,
        StakeIngressSpecError, STAKE_INGRESS_SEED,
    },
    CanonicalDailyLawBinding, EconomyError, PrepareOpenPositionInput, ReadonlyTokenState,
    ValidatedDailyLawWrite, TOKEN_DECIMALS,
};

pub const STAKE_INGRESS_RUNTIME_STATUS: &str =
    "FEATURE_GATED_OPEN_DAILY_LAW_AUTHENTICATED_TOKEN_2022_CPI_RELOAD_NO_ABI_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressRuntimeTruth {
    pub feature_gated: bool,
    pub prepared_stake_ingress_plan_required: bool,
    pub daily_law_capability_reauthenticated: bool,
    pub production_active_config_capability_required: bool,
    pub canonical_mint_policy_reauthenticated: bool,
    pub canonical_ingress_pda_derived: bool,
    pub transfer_hook_extra_accounts_resolved: bool,
    pub exact_cpi_reload_sequence_executed: bool,
    pub callback_and_restoration_failures_are_transaction_atomic: bool,
    pub retained_v2_post_cpi_persistence_complete: bool,
    pub public_entrypoint_exposed: bool,
    pub instruction_abi_frozen: bool,
    pub production_identities_frozen: bool,
    pub devnet_executed: bool,
    pub mainnet_hold: bool,
}

pub const STAKE_INGRESS_RUNTIME_TRUTH: StakeIngressRuntimeTruth = StakeIngressRuntimeTruth {
    feature_gated: true,
    prepared_stake_ingress_plan_required: true,
    daily_law_capability_reauthenticated: true,
    production_active_config_capability_required: true,
    canonical_mint_policy_reauthenticated: false,
    canonical_ingress_pda_derived: true,
    transfer_hook_extra_accounts_resolved: true,
    exact_cpi_reload_sequence_executed: true,
    callback_and_restoration_failures_are_transaction_atomic: true,
    retained_v2_post_cpi_persistence_complete: false,
    public_entrypoint_exposed: false,
    instruction_abi_frozen: false,
    production_identities_frozen: false,
    devnet_executed: false,
    mainnet_hold: true,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressRuntimePostTransfer {
    pub source: SourceTokenState,
    pub stake: ReadonlyTokenState,
    pub original_delegate: DelegateSnapshot,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressRuntimeReceipt {
    pub source_amount: u64,
    pub stake_amount: u64,
    pub original_delegate_restored: bool,
    pub transaction_local_persistence_callback_succeeded: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DailyLawAuthenticatedStakeIngressReceipt {
    pub token: StakeIngressRuntimeReceipt,
    pub daily_law_local_day: i64,
    pub daily_law_account_sha256: [u8; 32],
    pub plan_constructed_after_daily_law_authentication: bool,
}

struct AccountBoundStakeIngressInput {
    open_position: Box<PrepareOpenPositionInput>,
    ingress: Box<PrepareStakeIngressInput>,
}

#[derive(Debug)]
pub enum StakeIngressRuntimeError {
    InvalidAccountFlags,
    InvalidAccountBinding,
    InvalidMint,
    InvalidTokenAccount,
    InvalidTokenExtension,
    NonCanonicalPodBoolean,
    ApprovalMismatch,
    BalanceDeltaMismatch,
    DelegateNotConsumed,
    DelegateRestorationMismatch,
    HookLawAccountUnresolved,
    DailyLawAccountRejected,
    DailyLawDayUnfinalized,
    DailyLawLocked,
    StakeIngressPreparationRejected,
    CpiGuardLocked,
    ActiveConfigCapabilityMismatch,
    Program(ProgramError),
}

impl StakeIngressRuntimeError {
    /// Preserve native CPI failures. Adapter-owned failures occupy a private
    /// feature-gated range and do not freeze a public instruction ABI.
    pub fn into_program_error(self) -> ProgramError {
        match self {
            Self::Program(error) => error,
            Self::InvalidAccountFlags => ProgramError::Custom(0xB300),
            Self::InvalidAccountBinding => ProgramError::Custom(0xB301),
            Self::InvalidMint => ProgramError::Custom(0xB302),
            Self::InvalidTokenAccount => ProgramError::Custom(0xB303),
            Self::InvalidTokenExtension => ProgramError::Custom(0xB304),
            Self::NonCanonicalPodBoolean => ProgramError::Custom(0xB305),
            Self::ApprovalMismatch => ProgramError::Custom(0xB306),
            Self::BalanceDeltaMismatch => ProgramError::Custom(0xB307),
            Self::DelegateNotConsumed => ProgramError::Custom(0xB308),
            Self::DelegateRestorationMismatch => ProgramError::Custom(0xB309),
            Self::HookLawAccountUnresolved => ProgramError::Custom(0xB30A),
            Self::DailyLawAccountRejected => ProgramError::Custom(0xB30B),
            Self::DailyLawDayUnfinalized => ProgramError::Custom(0xB30C),
            Self::DailyLawLocked => ProgramError::Custom(0xB30D),
            Self::StakeIngressPreparationRejected => ProgramError::Custom(0xB30E),
            Self::CpiGuardLocked => ProgramError::Custom(0xB30F),
            Self::ActiveConfigCapabilityMismatch => ProgramError::Custom(0xB310),
        }
    }
}

fn map_daily_law_error(error: RuntimeAdapterError) -> StakeIngressRuntimeError {
    match error {
        RuntimeAdapterError::Economy(EconomyError::DayUnfinalized) => {
            StakeIngressRuntimeError::DailyLawDayUnfinalized
        }
        RuntimeAdapterError::Economy(EconomyError::DailyLockdown) => {
            StakeIngressRuntimeError::DailyLawLocked
        }
        _ => StakeIngressRuntimeError::DailyLawAccountRejected,
    }
}

fn map_stake_ingress_preparation_error(error: StakeIngressSpecError) -> StakeIngressRuntimeError {
    match error {
        StakeIngressSpecError::CpiGuardBlocksAtomicApproval => {
            StakeIngressRuntimeError::CpiGuardLocked
        }
        _ => StakeIngressRuntimeError::StakeIngressPreparationRejected,
    }
}

impl From<ProgramError> for StakeIngressRuntimeError {
    fn from(value: ProgramError) -> Self {
        Self::Program(value)
    }
}

#[derive(Clone, Copy)]
pub struct StakeIngressRuntimeAccounts<'a, 'info> {
    pub owner: &'a AccountInfo<'info>,
    pub source: &'a AccountInfo<'info>,
    pub mint: &'a AccountInfo<'info>,
    pub stake_vault: &'a AccountInfo<'info>,
    pub ingress_authority: &'a AccountInfo<'info>,
    pub prior_delegate: Option<&'a AccountInfo<'info>>,
    pub token_program: &'a AccountInfo<'info>,
    pub hook_program: &'a AccountInfo<'info>,
    pub hook_validation: &'a AccountInfo<'info>,
    /// Includes every account referenced by the hook validation TLV. The
    /// prepared plan's Daily Law account must occur in the resolved CPI list.
    pub additional_hook_accounts: &'a [AccountInfo<'info>],
}

fn exact_allowed_extensions(actual: &[ExtensionType], allow_cpi_guard: bool) -> bool {
    actual.iter().all(|extension| {
        *extension == ExtensionType::TransferHookAccount
            || (allow_cpi_guard && *extension == ExtensionType::CpiGuard)
    }) && actual
        .iter()
        .filter(|extension| **extension == ExtensionType::TransferHookAccount)
        .count()
        == 1
        && actual
            .iter()
            .filter(|extension| **extension == ExtensionType::CpiGuard)
            .count()
            <= 1
}

fn parse_mint(
    mint: &AccountInfo<'_>,
    hook_program: &AccountInfo<'_>,
) -> Result<(), StakeIngressRuntimeError> {
    if mint.is_signer
        || mint.is_writable
        || mint.executable
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || !hook_program.executable
        || hook_program.is_signer
        || hook_program.is_writable
    {
        return Err(StakeIngressRuntimeError::InvalidAccountFlags);
    }
    let data = mint
        .try_borrow_data()
        .map_err(|_| StakeIngressRuntimeError::InvalidMint)?;
    let state = StateWithExtensions::<Mint>::unpack(&data)
        .map_err(|_| StakeIngressRuntimeError::InvalidMint)?;
    if state
        .try_get_account_len()
        .map_err(|_| StakeIngressRuntimeError::InvalidMint)?
        != data.len()
        || !state.base.is_initialized
        || state.base.decimals != TOKEN_DECIMALS
    {
        return Err(StakeIngressRuntimeError::InvalidMint);
    }
    let extensions = state
        .get_extension_types()
        .map_err(|_| StakeIngressRuntimeError::InvalidMint)?;
    if extensions
        .iter()
        .filter(|extension| **extension == ExtensionType::TransferHook)
        .count()
        != 1
    {
        return Err(StakeIngressRuntimeError::InvalidTokenExtension);
    }
    let transfer_hook = state
        .get_extension::<TransferHook>()
        .map_err(|_| StakeIngressRuntimeError::InvalidTokenExtension)?;
    if Option::<Pubkey>::from(transfer_hook.program_id) != Some(*hook_program.key) {
        return Err(StakeIngressRuntimeError::InvalidAccountBinding);
    }
    Ok(())
}

pub fn observe_stake_ingress_source(
    account: &AccountInfo<'_>,
    expected_mint: &Pubkey,
    expected_owner: &Pubkey,
) -> Result<SourceTokenState, StakeIngressRuntimeError> {
    let (token, delegate, cpi_guard_locked) =
        parse_token_account(account, expected_mint, expected_owner, true)?;
    Ok(SourceTokenState {
        token,
        delegate,
        cpi_guard_locked,
    })
}

pub fn observe_stake_ingress_vault(
    account: &AccountInfo<'_>,
    expected_mint: &Pubkey,
    expected_owner: &Pubkey,
) -> Result<ReadonlyTokenState, StakeIngressRuntimeError> {
    let (token, delegate, cpi_guard_locked) =
        parse_token_account(account, expected_mint, expected_owner, false)?;
    if delegate.delegate.is_some() || delegate.delegated_amount != 0 || cpi_guard_locked {
        return Err(StakeIngressRuntimeError::InvalidTokenAccount);
    }
    Ok(token)
}

fn parse_token_account(
    account: &AccountInfo<'_>,
    expected_mint: &Pubkey,
    expected_owner: &Pubkey,
    allow_cpi_guard: bool,
) -> Result<(ReadonlyTokenState, DelegateSnapshot, bool), StakeIngressRuntimeError> {
    if account.is_signer
        || !account.is_writable
        || account.executable
        || account.owner != &TOKEN_2022_PROGRAM_ID
    {
        return Err(StakeIngressRuntimeError::InvalidAccountFlags);
    }
    let data = account
        .try_borrow_data()
        .map_err(|_| StakeIngressRuntimeError::InvalidTokenAccount)?;
    let state = StateWithExtensions::<TokenAccount>::unpack(&data)
        .map_err(|_| StakeIngressRuntimeError::InvalidTokenAccount)?;
    if state
        .try_get_account_len()
        .map_err(|_| StakeIngressRuntimeError::InvalidTokenAccount)?
        != data.len()
        || state.base.state != AccountState::Initialized
        || state.base.mint != *expected_mint
        || state.base.owner != *expected_owner
        || state.base.is_native.is_some()
        || state.base.close_authority.is_some()
    {
        return Err(StakeIngressRuntimeError::InvalidTokenAccount);
    }
    let extensions = state
        .get_extension_types()
        .map_err(|_| StakeIngressRuntimeError::InvalidTokenExtension)?;
    if !exact_allowed_extensions(&extensions, allow_cpi_guard) {
        return Err(StakeIngressRuntimeError::InvalidTokenExtension);
    }
    let transfer_hook = state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| StakeIngressRuntimeError::InvalidTokenExtension)?;
    if transfer_hook.transferring.0 > 1 {
        return Err(StakeIngressRuntimeError::NonCanonicalPodBoolean);
    }
    if bool::from(transfer_hook.transferring) {
        return Err(StakeIngressRuntimeError::InvalidTokenAccount);
    }
    let cpi_guard_locked = if extensions.contains(&ExtensionType::CpiGuard) {
        let guard = state
            .get_extension::<CpiGuard>()
            .map_err(|_| StakeIngressRuntimeError::InvalidTokenExtension)?;
        if guard.lock_cpi.0 > 1 {
            return Err(StakeIngressRuntimeError::NonCanonicalPodBoolean);
        }
        bool::from(guard.lock_cpi)
    } else {
        false
    };
    Ok((
        ReadonlyTokenState {
            key: account.key.to_bytes(),
            mint: state.base.mint.to_bytes(),
            owner: state.base.owner.to_bytes(),
            amount: state.base.amount,
        },
        DelegateSnapshot {
            delegate: Option::<Pubkey>::from(state.base.delegate).map(|key| key.to_bytes()),
            delegated_amount: state.base.delegated_amount,
        },
        cpi_guard_locked,
    ))
}

fn validate_accounts(
    program_id: &Pubkey,
    plan: &StakeIngressExecutionPlan,
    accounts: &StakeIngressRuntimeAccounts<'_, '_>,
) -> Result<(Pubkey, u8), StakeIngressRuntimeError> {
    if !accounts.owner.is_signer
        || accounts.owner.executable
        || !accounts.source.is_writable
        || !accounts.stake_vault.is_writable
        || accounts.ingress_authority.is_signer
        || accounts.ingress_authority.is_writable
        || accounts.ingress_authority.executable
        || accounts.token_program.key != &TOKEN_2022_PROGRAM_ID
        || !accounts.token_program.executable
        || accounts.token_program.is_signer
        || accounts.token_program.is_writable
        || accounts.hook_validation.is_signer
        || accounts.hook_validation.is_writable
        || accounts.hook_validation.executable
    {
        return Err(StakeIngressRuntimeError::InvalidAccountFlags);
    }
    let config = Pubkey::new_from_array(plan.open_position.config_key);
    let (ingress, bump) =
        Pubkey::find_program_address(&[STAKE_INGRESS_SEED, config.as_ref()], program_id);
    let validation = get_extra_account_metas_address(accounts.mint.key, accounts.hook_program.key);
    if accounts.owner.key.to_bytes() != plan.open_position.owner
        || accounts.source.key.to_bytes() != plan.approve_ingress.source
        || accounts.mint.key.to_bytes() != plan.approve_ingress.mint
        || accounts.stake_vault.key.to_bytes() != plan.transfer.transfer.destination
        || accounts.ingress_authority.key != &ingress
        || plan.approve_ingress.delegate != ingress.to_bytes()
        || plan.transfer.transfer.authority != ingress.to_bytes()
        || plan.approve_ingress.token_program != TOKEN_2022_PROGRAM_ID.to_bytes()
        || plan.transfer.transfer.token_program != TOKEN_2022_PROGRAM_ID.to_bytes()
        || plan.approve_ingress.amount != plan.open_position.principal
        || plan.transfer.transfer.amount != plan.open_position.principal
        || plan.approve_ingress.decimals != TOKEN_DECIMALS
        || plan.transfer.transfer.decimals != TOKEN_DECIMALS
        || accounts.hook_validation.key != &validation
        || accounts.hook_validation.owner != accounts.hook_program.key
        || plan.transfer.hook_validation_address != validation.to_bytes()
        || !plan.transfer.token_cpi_uses_ingress_invoke_signed
        || plan.transfer.hook_execute_authority_is_signer
        || !plan.transfer.add_extra_accounts_for_execute_cpi_required
    {
        return Err(StakeIngressRuntimeError::InvalidAccountBinding);
    }
    parse_mint(accounts.mint, accounts.hook_program)?;
    Ok((config, bump))
}

/// Execute the Token-2022 portion of a prepared plan. The enclosing production
/// handler must first authenticate Daily Law and the canonical mint, then call
/// the pure ingress preparation boundary; this function cannot prove plan
/// provenance by itself. The callback must apply the pure post-CPI V2 finalizer and persist the resulting
/// Config/Position/Lane bytes; this primitive does not claim that handler work
/// complete. Callback failure is intentionally inside the atomic CPI sequence.
#[inline(never)]
pub fn execute_prepared_stake_ingress<'info, F>(
    program_id: &Pubkey,
    plan: &StakeIngressExecutionPlan,
    accounts: StakeIngressRuntimeAccounts<'_, 'info>,
    persist_transaction_local_state: F,
) -> Result<StakeIngressRuntimeReceipt, StakeIngressRuntimeError>
where
    F: FnOnce(&StakeIngressExecutionPlan, &StakeIngressRuntimePostTransfer) -> ProgramResult,
{
    let (config, ingress_bump) = validate_accounts(program_id, plan, &accounts)?;
    let source_before =
        observe_stake_ingress_source(accounts.source, accounts.mint.key, accounts.owner.key)?;
    let stake_before =
        observe_stake_ingress_vault(accounts.stake_vault, accounts.mint.key, &config)?;
    if source_before != plan.source_before || stake_before != plan.stake_before {
        return Err(StakeIngressRuntimeError::InvalidAccountBinding);
    }

    invoke_ingress_approval(plan, accounts)?;
    let source_after_approval =
        observe_stake_ingress_source(accounts.source, accounts.mint.key, accounts.owner.key)?;
    let stake_after_approval =
        observe_stake_ingress_vault(accounts.stake_vault, accounts.mint.key, &config)?;
    if source_after_approval.token.amount != source_before.token.amount
        || stake_after_approval.amount != stake_before.amount
        || source_after_approval.delegate.delegate
            != Some(*accounts.ingress_authority.key).map(|key| key.to_bytes())
        || source_after_approval.delegate.delegated_amount != plan.open_position.principal
    {
        return Err(StakeIngressRuntimeError::ApprovalMismatch);
    }

    invoke_ingress_transfer(plan, accounts, &config, ingress_bump)?;
    let source_after_transfer =
        observe_stake_ingress_source(accounts.source, accounts.mint.key, accounts.owner.key)?;
    let stake_after_transfer =
        observe_stake_ingress_vault(accounts.stake_vault, accounts.mint.key, &config)?;
    if source_after_transfer.token.amount
        != source_before
            .token
            .amount
            .checked_sub(plan.open_position.principal)
            .ok_or(StakeIngressRuntimeError::BalanceDeltaMismatch)?
        || stake_after_transfer.amount
            != stake_before
                .amount
                .checked_add(plan.open_position.principal)
                .ok_or(StakeIngressRuntimeError::BalanceDeltaMismatch)?
    {
        return Err(StakeIngressRuntimeError::BalanceDeltaMismatch);
    }
    if source_after_transfer.delegate
        != (DelegateSnapshot {
            delegate: None,
            delegated_amount: 0,
        })
    {
        return Err(StakeIngressRuntimeError::DelegateNotConsumed);
    }
    let post_transfer = StakeIngressRuntimePostTransfer {
        source: source_after_transfer,
        stake: stake_after_transfer,
        original_delegate: source_before.delegate,
    };
    persist_transaction_local_state(plan, &post_transfer)?;

    restore_original_delegate(plan, accounts)?;
    let source_after_restoration =
        observe_stake_ingress_source(accounts.source, accounts.mint.key, accounts.owner.key)?;
    let stake_after_restoration =
        observe_stake_ingress_vault(accounts.stake_vault, accounts.mint.key, &config)?;
    if source_after_restoration.token.amount != source_after_transfer.token.amount
        || stake_after_restoration.amount != stake_after_transfer.amount
        || source_after_restoration.delegate != source_before.delegate
    {
        return Err(StakeIngressRuntimeError::DelegateRestorationMismatch);
    }
    Ok(StakeIngressRuntimeReceipt {
        source_amount: source_after_restoration.token.amount,
        stake_amount: stake_after_restoration.amount,
        original_delegate_restored: true,
        transaction_local_persistence_callback_succeeded: true,
    })
}

/// Authenticate a real finalized OPEN Daily Law account for the pinned
/// structural SBF fixture, construct the retained V2 open-position/stake-ingress
/// plan, and execute its Token-2022 CPI/reload sequence. Production callers
/// must use [`execute_production_active_daily_law_authenticated_stake_ingress`].
/// Daily Law is checked
/// before mint, token, delegate, or hook account parsing, so a locked,
/// unfinalized, stale, forged, or substituted law account cannot mutate token
/// state even when later accounts are hostile.
///
/// This remains feature-gated and dispatcher-disabled. It does not freeze
/// production identities, validate the complete confidential-mint policy, or
/// replace the transaction-local Config/Position/Lane persistence callback.
#[inline(never)]
pub fn execute_daily_law_authenticated_stake_ingress<'info, F>(
    program_id: &Pubkey,
    law_binding: &CanonicalDailyLawBinding,
    law_state: &AccountInfo<'info>,
    open_position: Box<PrepareOpenPositionInput>,
    accounts: StakeIngressRuntimeAccounts<'_, 'info>,
    persist_transaction_local_state: F,
) -> Result<DailyLawAuthenticatedStakeIngressReceipt, StakeIngressRuntimeError>
where
    F: FnOnce(&StakeIngressExecutionPlan, &StakeIngressRuntimePostTransfer) -> ProgramResult,
{
    let gate = authenticate_daily_law(law_binding, law_state, accounts.mint.key)?;
    execute_daily_law_authenticated_stake_ingress_with_gate(
        program_id,
        gate,
        open_position,
        accounts,
        persist_transaction_local_state,
    )
}

/// Production-shaped combined Daily Law, ACTIVE Config, and Token-2022 ingress
/// path. The Config capability is checked against the exact runtime Law
/// observation before mint or token data parsing and before any CPI.
#[inline(never)]
#[allow(clippy::too_many_arguments)]
pub fn execute_production_active_daily_law_authenticated_stake_ingress<'info, F>(
    program_id: &Pubkey,
    economy_binding: &NativeEconomyBinding,
    active_config: &RuntimeProductionActiveConfig,
    law_binding: &CanonicalDailyLawBinding,
    law_state: &AccountInfo<'info>,
    open_position: Box<PrepareOpenPositionInput>,
    accounts: StakeIngressRuntimeAccounts<'_, 'info>,
    persist_transaction_local_state: F,
) -> Result<DailyLawAuthenticatedStakeIngressReceipt, StakeIngressRuntimeError>
where
    F: FnOnce(&StakeIngressExecutionPlan, &StakeIngressRuntimePostTransfer) -> ProgramResult,
{
    let gate = authenticate_daily_law(law_binding, law_state, accounts.mint.key)?;
    require_production_active_context(
        &gate,
        active_config,
        economy_binding,
        program_id,
        accounts.mint.key,
    )?;
    execute_daily_law_authenticated_stake_ingress_with_gate(
        program_id,
        gate,
        open_position,
        accounts,
        persist_transaction_local_state,
    )
}

#[inline(never)]
fn execute_daily_law_authenticated_stake_ingress_with_gate<'info, F>(
    program_id: &Pubkey,
    gate: Box<ValidatedDailyLawWrite>,
    open_position: Box<PrepareOpenPositionInput>,
    accounts: StakeIngressRuntimeAccounts<'_, 'info>,
    persist_transaction_local_state: F,
) -> Result<DailyLawAuthenticatedStakeIngressReceipt, StakeIngressRuntimeError>
where
    F: FnOnce(&StakeIngressExecutionPlan, &StakeIngressRuntimePostTransfer) -> ProgramResult,
{
    let daily_law_local_day = gate.local_day();
    let daily_law_account_sha256 = gate.law_account_sha256();
    let bound = bind_stake_ingress_accounts(program_id, open_position, &accounts)?;
    let plan = prepare_authenticated_stake_ingress(&gate, bound)?;
    let token = execute_prepared_stake_ingress(
        program_id,
        &plan,
        accounts,
        persist_transaction_local_state,
    )?;
    Ok(DailyLawAuthenticatedStakeIngressReceipt {
        token,
        daily_law_local_day,
        daily_law_account_sha256,
        plan_constructed_after_daily_law_authentication: true,
    })
}

fn require_production_active_context(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    economy_binding: &NativeEconomyBinding,
    program_id: &Pubkey,
    mint: &Pubkey,
) -> Result<(), StakeIngressRuntimeError> {
    if program_id.to_bytes() != economy_binding.program_id()
        || mint.to_bytes() != economy_binding.mint()
        || active_config.program_id() != economy_binding.program_id()
        || active_config.mint() != economy_binding.mint()
        || active_config.key() != economy_binding.config()
        || active_config.law_account_sha256() != gate.law_account_sha256()
        || active_config.law_unix_timestamp() != gate.unix_timestamp()
        || active_config.law_local_day() != gate.local_day()
    {
        return Err(StakeIngressRuntimeError::ActiveConfigCapabilityMismatch);
    }
    Ok(())
}

#[inline(never)]
fn authenticate_daily_law(
    law_binding: &CanonicalDailyLawBinding,
    law_state: &AccountInfo<'_>,
    mint: &Pubkey,
) -> Result<Box<ValidatedDailyLawWrite>, StakeIngressRuntimeError> {
    // This must stay first. Do not inspect mutable token accounts before the
    // canonical law account and runtime Clock have produced the opaque gate.
    let gate =
        verify_daily_law_open_account_info(law_binding, law_state).map_err(map_daily_law_error)?;
    if gate.mint() != mint.to_bytes() || gate.law_state_address() != law_state.key.to_bytes() {
        return Err(StakeIngressRuntimeError::InvalidAccountBinding);
    }
    Ok(Box::new(gate))
}

#[inline(never)]
fn bind_stake_ingress_accounts(
    program_id: &Pubkey,
    mut open_position: Box<PrepareOpenPositionInput>,
    accounts: &StakeIngressRuntimeAccounts<'_, '_>,
) -> Result<AccountBoundStakeIngressInput, StakeIngressRuntimeError> {
    let config = Pubkey::new_from_array(open_position.config_key);
    let (ingress, _) =
        Pubkey::find_program_address(&[STAKE_INGRESS_SEED, config.as_ref()], program_id);
    let source_before =
        observe_stake_ingress_source(accounts.source, accounts.mint.key, accounts.owner.key)?;
    let stake_before =
        observe_stake_ingress_vault(accounts.stake_vault, accounts.mint.key, &config)?;
    // AccountInfo-derived identities and balances replace every equivalent
    // caller-provided field before the retained V2 preflight executes.
    open_position.owner = accounts.owner.key.to_bytes();
    open_position.mint = accounts.mint.key.to_bytes();
    open_position.owner_tokens = source_before.token;
    open_position.vault_authority = config.to_bytes();
    open_position.stake_tokens = stake_before;
    open_position.config.mint = accounts.mint.key.to_bytes();
    open_position.config.token_program = TOKEN_2022_PROGRAM_ID.to_bytes();
    open_position.config.stake_token_account = accounts.stake_vault.key.to_bytes();
    open_position.config.staked_principal = stake_before.amount;
    let hook_validation_address =
        get_extra_account_metas_address(accounts.mint.key, accounts.hook_program.key);
    Ok(AccountBoundStakeIngressInput {
        open_position,
        ingress: Box::new(PrepareStakeIngressInput {
            owner_is_signer: accounts.owner.is_signer,
            canonical_ingress_authority: ingress.to_bytes(),
            ingress: IngressPdaBinding {
                key: accounts.ingress_authority.key.to_bytes(),
            },
            hook_validation_address: hook_validation_address.to_bytes(),
            source_before,
            stake_before,
        }),
    })
}

#[inline(never)]
fn prepare_authenticated_stake_ingress(
    gate: &ValidatedDailyLawWrite,
    input: AccountBoundStakeIngressInput,
) -> Result<Box<StakeIngressExecutionPlan>, StakeIngressRuntimeError> {
    Ok(Box::new(
        prepare_open_position_stake_ingress(gate, *input.open_position, *input.ingress)
            .map_err(map_stake_ingress_preparation_error)?,
    ))
}

#[inline(never)]
fn invoke_ingress_approval(
    plan: &StakeIngressExecutionPlan,
    accounts: StakeIngressRuntimeAccounts<'_, '_>,
) -> Result<(), StakeIngressRuntimeError> {
    let approve = approve_checked(
        &TOKEN_2022_PROGRAM_ID,
        accounts.source.key,
        accounts.mint.key,
        accounts.ingress_authority.key,
        accounts.owner.key,
        &[],
        plan.approve_ingress.amount,
        TOKEN_DECIMALS,
    )?;
    invoke(
        &approve,
        &[
            accounts.source.clone(),
            accounts.mint.clone(),
            accounts.ingress_authority.clone(),
            accounts.owner.clone(),
            accounts.token_program.clone(),
        ],
    )?;
    Ok(())
}

#[inline(never)]
fn invoke_ingress_transfer(
    plan: &StakeIngressExecutionPlan,
    accounts: StakeIngressRuntimeAccounts<'_, '_>,
    config: &Pubkey,
    ingress_bump: u8,
) -> Result<(), StakeIngressRuntimeError> {
    let mut transfer = transfer_checked(
        &TOKEN_2022_PROGRAM_ID,
        accounts.source.key,
        accounts.mint.key,
        accounts.stake_vault.key,
        accounts.ingress_authority.key,
        &[],
        plan.transfer.transfer.amount,
        TOKEN_DECIMALS,
    )?;
    let mut transfer_infos = vec![
        accounts.source.clone(),
        accounts.mint.clone(),
        accounts.stake_vault.clone(),
        accounts.ingress_authority.clone(),
    ];
    let mut hook_accounts = Vec::with_capacity(accounts.additional_hook_accounts.len() + 2);
    hook_accounts.push(accounts.hook_program.clone());
    hook_accounts.push(accounts.hook_validation.clone());
    hook_accounts.extend_from_slice(accounts.additional_hook_accounts);
    add_extra_accounts_for_execute_cpi(
        &mut transfer,
        &mut transfer_infos,
        accounts.hook_program.key,
        accounts.source.clone(),
        accounts.mint.clone(),
        accounts.stake_vault.clone(),
        accounts.ingress_authority.clone(),
        plan.transfer.transfer.amount,
        &hook_accounts,
    )?;
    if !transfer_infos
        .iter()
        .any(|account| account.key.to_bytes() == plan.transfer.law_state_address)
    {
        return Err(StakeIngressRuntimeError::HookLawAccountUnresolved);
    }
    transfer_infos.push(accounts.token_program.clone());
    let ingress_bump_seed = [ingress_bump];
    let signer_seeds: &[&[u8]] = &[STAKE_INGRESS_SEED, config.as_ref(), &ingress_bump_seed];
    invoke_signed(&transfer, &transfer_infos, &[signer_seeds])?;
    Ok(())
}

#[inline(never)]
fn restore_original_delegate(
    plan: &StakeIngressExecutionPlan,
    accounts: StakeIngressRuntimeAccounts<'_, '_>,
) -> Result<(), StakeIngressRuntimeError> {
    if let DelegateRestorationIntent::ApproveChecked(intent) = plan.restore_delegate {
        let prior_delegate = accounts
            .prior_delegate
            .ok_or(StakeIngressRuntimeError::InvalidAccountBinding)?;
        if prior_delegate.key.to_bytes() != intent.delegate
            || prior_delegate.is_signer
            || prior_delegate.is_writable
            || prior_delegate.executable
            || intent.decimals != TOKEN_DECIMALS
        {
            return Err(StakeIngressRuntimeError::InvalidAccountBinding);
        }
        let restore = approve_checked(
            &TOKEN_2022_PROGRAM_ID,
            accounts.source.key,
            accounts.mint.key,
            prior_delegate.key,
            accounts.owner.key,
            &[],
            intent.amount,
            TOKEN_DECIMALS,
        )?;
        invoke(
            &restore,
            &[
                accounts.source.clone(),
                accounts.mint.clone(),
                prior_delegate.clone(),
                accounts.owner.clone(),
                accounts.token_program.clone(),
            ],
        )?;
    }
    Ok(())
}

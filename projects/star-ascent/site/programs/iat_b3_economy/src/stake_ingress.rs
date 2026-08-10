//! Production-source, dispatcher-disabled kernel for atomic B3 stake ingress.
//!
//! This performs no CPI, PDA derivation, account reload, serialization, or
//! persistence. A future native adapter must prove
//! the canonical `b"stake-ingress" + config` PDA and Transfer Hook validation
//! PDA, capture the source delegate before the first CPI, and execute every
//! represented step in one Solana transaction. Any failure must roll the whole
//! transaction back. Nothing in this module is reachable from a Solana
//! entrypoint or public dispatcher.

use crate::{
    prepare_open_position, ConfigState, EconomyError, LaneState, OpenPositionPreCpiPlan,
    PositionState, PrepareOpenPositionInput, ReadonlyTokenState, TransferCheckedIntent,
    ValidatedDailyLawWrite, TOKEN_DECIMALS, USER_TERM_WEEKS,
};

pub const STAKE_INGRESS_SEED: &[u8] = b"stake-ingress";

/// Frozen adapter order. The phase functions below make this sequence
/// executable rather than leaving it as prose.
pub const STAKE_INGRESS_EXECUTION_ORDER: [&str; 10] = [
    "capture_source_delegate",
    "owner_signed_approve_checked_cpi",
    "reload_and_verify_exact_ingress_approval",
    "ingress_pda_transfer_checked_with_hook_accounts",
    "reload_and_verify_exact_balance_delta",
    "retained_v2_checked_add_staked_principal",
    "retained_v2_construct_position",
    "owner_signed_restore_delegate_cpi_if_needed",
    "reload_and_verify_exact_delegate_restoration",
    "persist_all_transaction_local_state",
];

/// Stateless signer binding. The adapter proves this key is the canonical PDA;
/// no account-existence, balance, ownership, data-length, or executable-state
/// predicate is permitted. Token-2022 needs only the PDA pubkey plus the
/// economy program's valid `invoke_signed` seeds, so unsolicited SOL sent to
/// the address cannot disable stake ingress.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct IngressPdaBinding {
    pub key: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DelegateSnapshot {
    pub delegate: Option<[u8; 32]>,
    pub delegated_amount: u64,
}

impl DelegateSnapshot {
    fn is_canonical(self) -> bool {
        self.delegate.is_some() || self.delegated_amount == 0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SourceTokenState {
    pub token: ReadonlyTokenState,
    pub delegate: DelegateSnapshot,
    /// Token-2022 blocks Approve/ApproveChecked from CPI while this guard is
    /// locked. The atomic in-program capture/approve/restore design therefore
    /// rejects such source accounts instead of silently losing prior state.
    pub cpi_guard_locked: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ApproveCheckedIntent {
    pub token_program: [u8; 32],
    pub source: [u8; 32],
    pub mint: [u8; 32],
    pub delegate: [u8; 32],
    pub owner: [u8; 32],
    pub amount: u64,
    pub decimals: u8,
    pub owner_signature_required: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HookedTransferCheckedIntent {
    pub transfer: TransferCheckedIntent,
    pub hook_validation_address: [u8; 32],
    pub law_state_address: [u8; 32],
    /// The economy adapter must call Token-2022 with `invoke_signed` for the
    /// stateless ingress-authority PDA.
    pub token_cpi_uses_ingress_invoke_signed: bool,
    /// Token-2022 deliberately de-escalates the authority meta before invoking
    /// Transfer Hook Execute. The hook binds the pubkey and transferring flag;
    /// it must not require this meta to remain a signer.
    pub hook_execute_authority_is_signer: bool,
    pub add_extra_accounts_for_execute_cpi_required: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DelegateRestorationIntent {
    NoneRequired,
    ApproveChecked(ApproveCheckedIntent),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PrepareStakeIngressInput {
    pub owner_is_signer: bool,
    /// Derived by the future adapter from the frozen seed, config key, and
    /// immutable economy program ID. It is not instruction-controlled policy.
    pub canonical_ingress_authority: [u8; 32],
    pub ingress: IngressPdaBinding,
    /// Derived by the future adapter for the canonical mint and hook program.
    pub hook_validation_address: [u8; 32],
    pub source_before: SourceTokenState,
    pub stake_before: ReadonlyTokenState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressExecutionPlan {
    pub open_position: OpenPositionPreCpiPlan,
    pub source_before: SourceTokenState,
    pub stake_before: ReadonlyTokenState,
    pub original_delegate: DelegateSnapshot,
    pub approve_ingress: ApproveCheckedIntent,
    pub transfer: HookedTransferCheckedIntent,
    pub restore_delegate: DelegateRestorationIntent,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressApprovalObservation {
    pub source_after_approval: SourceTokenState,
    pub stake_after_approval: ReadonlyTokenState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ApprovedStakeIngressPlan {
    pub execution: StakeIngressExecutionPlan,
    pub source_after_approval: SourceTokenState,
    pub stake_after_approval: ReadonlyTokenState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressTransferObservation {
    pub source_after_transfer: SourceTokenState,
    pub stake_after_transfer: ReadonlyTokenState,
}

/// Provisional transaction-local result after the hooked transfer and exact
/// balance reload. It includes the retained V2 post-CPI operations in their
/// original order, but is not complete until delegate restoration is reloaded
/// and proven exact.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressPostCpiPlan {
    pub config: ConfigState,
    pub position: PositionState,
    pub treasury: LaneState,
    pub ecosystem: LaneState,
    pub liquidity: LaneState,
    pub source_after_transfer: SourceTokenState,
    pub stake_after_transfer: ReadonlyTokenState,
    pub original_delegate: DelegateSnapshot,
    pub restore_delegate: DelegateRestorationIntent,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressRestorationObservation {
    pub source_after_restoration: SourceTokenState,
    pub stake_after_restoration: ReadonlyTokenState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CompletedStakeIngress {
    pub config: ConfigState,
    pub position: PositionState,
    pub treasury: LaneState,
    pub ecosystem: LaneState,
    pub liquidity: LaneState,
    pub source: SourceTokenState,
    pub stake: ReadonlyTokenState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StakeIngressSpecError {
    MissingOwnerSignature,
    NonCanonicalIngressAuthority,
    CpiGuardBlocksAtomicApproval,
    NonCanonicalDelegateState,
    OpenPlanMismatch,
    SourceIdentityMismatch,
    StakeIdentityMismatch,
    StakeLedgerMismatch,
    IngressApprovalMismatch,
    InsufficientSourceBalance,
    TokenBalanceOverflow,
    SourceBalanceDeltaMismatch,
    StakeBalanceDeltaMismatch,
    TransientDelegateNotConsumed,
    DelegateRestorationMismatch,
    RetainedV2(EconomyError),
}

/// Run the canonical Daily-Law-gated retained V2 open-position preflight and
/// bind its exact output to the atomic stake-ingress protocol in one API.
///
/// This is the production-source composition boundary. It cannot be called
/// without the opaque capability returned by `verify_daily_law_open`, and it
/// does not accept a caller-authored open-position plan. Returned values are
/// still transaction-local intents: a future native adapter must authenticate
/// accounts, derive PDAs, perform/reload every CPI, and persist only after exact
/// delegate restoration succeeds.
#[inline(never)]
pub fn prepare_open_position_stake_ingress(
    gate: &ValidatedDailyLawWrite,
    open_position: PrepareOpenPositionInput,
    ingress: PrepareStakeIngressInput,
) -> Result<StakeIngressExecutionPlan, StakeIngressSpecError> {
    let open_position =
        prepare_open_position(gate, open_position).map_err(StakeIngressSpecError::RetainedV2)?;
    prepare_stake_ingress(gate, open_position, ingress)
}

/// Bind a Daily-Law-gated retained V2 preflight to the anti-donation ingress
/// flow. Capturing the delegate before approval is essential: a client-side
/// ApproveChecked instruction would already have overwritten the only on-chain
/// copy, making exact restoration unverifiable.
///
/// Native adapter code should prefer [`prepare_open_position_stake_ingress`].
/// This lower-level phase remains public so deterministic post-CPI and rollback
/// vectors can inject otherwise unreachable transaction-local observations; it
/// is not an authorization boundary and is not exposed by a dispatcher.
pub fn prepare_stake_ingress(
    gate: &ValidatedDailyLawWrite,
    open_position: OpenPositionPreCpiPlan,
    input: PrepareStakeIngressInput,
) -> Result<StakeIngressExecutionPlan, StakeIngressSpecError> {
    if !input.owner_is_signer {
        return Err(StakeIngressSpecError::MissingOwnerSignature);
    }
    if input.ingress.key != input.canonical_ingress_authority {
        return Err(StakeIngressSpecError::NonCanonicalIngressAuthority);
    }
    if input.source_before.cpi_guard_locked {
        return Err(StakeIngressSpecError::CpiGuardBlocksAtomicApproval);
    }
    if !input.source_before.delegate.is_canonical() {
        return Err(StakeIngressSpecError::NonCanonicalDelegateState);
    }

    let retained_transfer = open_position.transfer;
    if retained_transfer.token_program != open_position.config_snapshot.token_program
        || retained_transfer.mint != open_position.config_snapshot.mint
        || retained_transfer.source != input.source_before.token.key
        || retained_transfer.destination != input.stake_before.key
        || retained_transfer.authority != open_position.owner
        || retained_transfer.amount != open_position.principal
        || retained_transfer.decimals != TOKEN_DECIMALS
    {
        return Err(StakeIngressSpecError::OpenPlanMismatch);
    }
    if input.source_before.token.mint != retained_transfer.mint
        || input.source_before.token.owner != open_position.owner
    {
        return Err(StakeIngressSpecError::SourceIdentityMismatch);
    }
    if input.stake_before.key != open_position.config_snapshot.stake_token_account
        || input.stake_before.mint != retained_transfer.mint
    {
        return Err(StakeIngressSpecError::StakeIdentityMismatch);
    }
    if input.stake_before.amount != open_position.config_snapshot.staked_principal {
        return Err(StakeIngressSpecError::StakeLedgerMismatch);
    }

    let original_delegate = input.source_before.delegate;
    let approve_ingress = ApproveCheckedIntent {
        token_program: retained_transfer.token_program,
        source: retained_transfer.source,
        mint: retained_transfer.mint,
        delegate: input.canonical_ingress_authority,
        owner: open_position.owner,
        amount: open_position.principal,
        decimals: TOKEN_DECIMALS,
        owner_signature_required: true,
    };
    let restore_delegate = match original_delegate.delegate {
        Some(delegate) => DelegateRestorationIntent::ApproveChecked(ApproveCheckedIntent {
            token_program: retained_transfer.token_program,
            source: retained_transfer.source,
            mint: retained_transfer.mint,
            delegate,
            owner: open_position.owner,
            amount: original_delegate.delegated_amount,
            decimals: TOKEN_DECIMALS,
            owner_signature_required: true,
        }),
        None => DelegateRestorationIntent::NoneRequired,
    };

    Ok(StakeIngressExecutionPlan {
        open_position,
        source_before: input.source_before,
        stake_before: input.stake_before,
        original_delegate,
        approve_ingress,
        transfer: HookedTransferCheckedIntent {
            transfer: TransferCheckedIntent {
                authority: input.canonical_ingress_authority,
                ..retained_transfer
            },
            hook_validation_address: input.hook_validation_address,
            law_state_address: gate.law_state_address(),
            token_cpi_uses_ingress_invoke_signed: true,
            hook_execute_authority_is_signer: false,
            add_extra_accounts_for_execute_cpi_required: true,
        },
        restore_delegate,
    })
}

/// Reload and prove the owner-signed ApproveChecked CPI wrote exactly the
/// ingress PDA and exact principal allowance without changing either public
/// token balance. A transfer cannot be attempted from this model without this
/// phase, even if the ingress PDA happened to be the source's prior delegate.
#[inline(never)]
pub fn verify_ingress_approval(
    plan: StakeIngressExecutionPlan,
    observed: StakeIngressApprovalObservation,
) -> Result<ApprovedStakeIngressPlan, StakeIngressSpecError> {
    verify_source_identity(plan.source_before, observed.source_after_approval)?;
    verify_stake_identity(plan.stake_before, observed.stake_after_approval)?;
    if observed.source_after_approval.token.amount != plan.source_before.token.amount
        || observed.stake_after_approval.amount != plan.stake_before.amount
        || observed.source_after_approval.delegate
            != (DelegateSnapshot {
                delegate: Some(plan.approve_ingress.delegate),
                delegated_amount: plan.approve_ingress.amount,
            })
    {
        return Err(StakeIngressSpecError::IngressApprovalMismatch);
    }

    Ok(ApprovedStakeIngressPlan {
        execution: plan,
        source_after_approval: observed.source_after_approval,
        stake_after_approval: observed.stake_after_approval,
    })
}

/// Verify the successful Token-2022 transfer by exact account reload, then
/// apply V2's post-CPI operations: checked-add tracked principal first and
/// construct the Position second. All returned values remain provisional until
/// [`complete_stake_ingress`] proves delegate restoration.
#[inline(never)]
pub fn apply_transfer_and_retained_v2_finalizer(
    approved: ApprovedStakeIngressPlan,
    observed: StakeIngressTransferObservation,
) -> Result<StakeIngressPostCpiPlan, StakeIngressSpecError> {
    let plan = approved.execution;
    verify_source_identity(
        approved.source_after_approval,
        observed.source_after_transfer,
    )?;
    verify_stake_identity(approved.stake_after_approval, observed.stake_after_transfer)?;

    let expected_source_amount = plan
        .source_before
        .token
        .amount
        .checked_sub(plan.open_position.principal)
        .ok_or(StakeIngressSpecError::InsufficientSourceBalance)?;
    let expected_stake_amount = plan
        .stake_before
        .amount
        .checked_add(plan.open_position.principal)
        .ok_or(StakeIngressSpecError::TokenBalanceOverflow)?;
    if observed.source_after_transfer.token.amount != expected_source_amount {
        return Err(StakeIngressSpecError::SourceBalanceDeltaMismatch);
    }
    if observed.stake_after_transfer.amount != expected_stake_amount {
        return Err(StakeIngressSpecError::StakeBalanceDeltaMismatch);
    }
    if observed.source_after_transfer.delegate
        != (DelegateSnapshot {
            delegate: None,
            delegated_amount: 0,
        })
    {
        return Err(StakeIngressSpecError::TransientDelegateNotConsumed);
    }

    // Retained V2 post-CPI operation 1.
    let mut config = plan.open_position.config_snapshot;
    config.staked_principal = config
        .staked_principal
        .checked_add(plan.open_position.principal)
        .ok_or(StakeIngressSpecError::RetainedV2(
            EconomyError::ArithmeticOverflow,
        ))?;

    // Retained V2 post-CPI operation 2. Field order mirrors V2. The checked
    // first-accrual calculation deliberately occurs only after the config add.
    let position = PositionState {
        config: plan.open_position.config_key,
        owner: plan.open_position.owner,
        position_id: plan.open_position.position_id,
        principal: plan.open_position.principal,
        accepted_week: plan.open_position.accepted_week,
        first_accrual_week: plan.open_position.accepted_week.checked_add(1).ok_or(
            StakeIngressSpecError::RetainedV2(EconomyError::ArithmeticOverflow),
        )?,
        term_weeks: USER_TERM_WEEKS,
        annual_rate_bps: plan.open_position.annual_rate_bps,
        treasury_reserved: plan.open_position.treasury_reserved,
        ecosystem_reserved: plan.open_position.ecosystem_reserved,
        liquidity_reserved: plan.open_position.liquidity_reserved,
        paid: 0,
        settled_mask: 0,
        agency_index: plan.open_position.agency_index,
        role: plan.open_position.role,
        principal_returned: false,
        closed: false,
        bump: plan.open_position.position_bump,
    };

    Ok(StakeIngressPostCpiPlan {
        config,
        position,
        treasury: plan.open_position.treasury,
        ecosystem: plan.open_position.ecosystem,
        liquidity: plan.open_position.liquidity,
        source_after_transfer: observed.source_after_transfer,
        stake_after_transfer: observed.stake_after_transfer,
        original_delegate: plan.original_delegate,
        restore_delegate: plan.restore_delegate,
    })
}

/// Prove exact restoration after the optional owner-signed ApproveChecked CPI.
/// A mismatch returns no complete result; a real Solana adapter must propagate
/// the error so approval, transfer, V2 writes, and restoration all roll back.
#[inline(never)]
pub fn complete_stake_ingress(
    post_cpi: StakeIngressPostCpiPlan,
    observed: StakeIngressRestorationObservation,
) -> Result<CompletedStakeIngress, StakeIngressSpecError> {
    verify_source_identity(
        post_cpi.source_after_transfer,
        observed.source_after_restoration,
    )?;
    verify_stake_identity(
        post_cpi.stake_after_transfer,
        observed.stake_after_restoration,
    )?;
    if observed.source_after_restoration.token.amount != post_cpi.source_after_transfer.token.amount
    {
        return Err(StakeIngressSpecError::SourceBalanceDeltaMismatch);
    }
    if observed.stake_after_restoration.amount != post_cpi.stake_after_transfer.amount {
        return Err(StakeIngressSpecError::StakeBalanceDeltaMismatch);
    }
    if observed.source_after_restoration.delegate != post_cpi.original_delegate {
        return Err(StakeIngressSpecError::DelegateRestorationMismatch);
    }

    Ok(CompletedStakeIngress {
        config: post_cpi.config,
        position: post_cpi.position,
        treasury: post_cpi.treasury,
        ecosystem: post_cpi.ecosystem,
        liquidity: post_cpi.liquidity,
        source: observed.source_after_restoration,
        stake: observed.stake_after_restoration,
    })
}

fn verify_source_identity(
    expected: SourceTokenState,
    observed: SourceTokenState,
) -> Result<(), StakeIngressSpecError> {
    if observed.token.key != expected.token.key
        || observed.token.mint != expected.token.mint
        || observed.token.owner != expected.token.owner
        || observed.cpi_guard_locked != expected.cpi_guard_locked
    {
        return Err(StakeIngressSpecError::SourceIdentityMismatch);
    }
    if !observed.delegate.is_canonical() {
        return Err(StakeIngressSpecError::NonCanonicalDelegateState);
    }
    Ok(())
}

fn verify_stake_identity(
    expected: ReadonlyTokenState,
    observed: ReadonlyTokenState,
) -> Result<(), StakeIngressSpecError> {
    if observed.key != expected.key
        || observed.mint != expected.mint
        || observed.owner != expected.owner
    {
        return Err(StakeIngressSpecError::StakeIdentityMismatch);
    }
    Ok(())
}

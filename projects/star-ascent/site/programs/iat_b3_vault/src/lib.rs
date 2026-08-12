#![no_std]
#![forbid(unsafe_code)]

//! Host-only lifecycle planner for the optional IAT B3 Privacy Vault client.
//!
//! This crate performs no RPC, persistent key storage, signing, account
//! mutation, token CPI, or instruction submission. The optional
//! `native_instruction_plan` module constructs only unsigned, inert,
//! account-local Token-2022 instructions; the host-compatibility feature also
//! generates fresh ephemeral proof test vectors and returns no key material. It
//! cannot authorize Devnet or Mainnet. Its purpose is to make the documented
//! lifecycle shape and its fail-closed boundaries deterministic before a full
//! exact-version native client adapter is implemented and independently
//! reviewed.

pub mod journal_codec;
pub mod journal_transition;
pub mod journal_transition_codec;
#[cfg(feature = "token-2022-host-compatibility")]
pub mod native_instruction_plan;
#[cfg(feature = "token-2022-host-compatibility")]
pub mod token_2022_host;

pub const PRIVACY_VAULT_CLIENT_SCHEMA_VERSION: u8 = 1;
pub const PRIVACY_VAULT_CLIENT_REFERENCE_STATUS: &str =
    "DOCUMENTED_HOST_ONLY_LIFECYCLE_SHAPE_NONACTIVATING";
pub const MAX_PLAN_STEPS: usize = 4;
pub const MAINNET_STATUS_HOLD: bool = true;

pub type Key = [u8; 32];
pub type Digest = [u8; 32];

const ZERO_KEY: Key = [0; 32];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PrivacyVaultError {
    ZeroIdentity,
    RuntimeIdentityCollision,
    MintExtensionsNotExact,
    ConfidentialPolicyNotImmutable,
    GlobalAuditorForbidden,
    ExplicitOptInRequired,
    OwnerAuthorizationRequired,
    RecoveryReadinessRequired,
    AccountBindingMismatch,
    ConfidentialAccountAlreadyConfigured,
    ConfidentialAccountNotReady,
    ConfidentialCreditsDisabled,
    AmountMustBePositive,
    InsufficientPublicBalance,
    InsufficientConfidentialBalance,
    SelfTransferForbidden,
    ProofBundleIncomplete,
    ProofBundleBindingMismatch,
    DailyLawUnfinalized,
    DailyLawLocked,
    DailyLawBindingMismatch,
    HookAccountsNotResolvedByOfficialAdapter,
    PendingBalanceEmpty,
    PendingCounterMismatch,
    RecoveryBindingMismatch,
    MaximumPendingCounterMustBePositive,
    PubkeyValidityProofIncomplete,
    PubkeyValidityProofBindingMismatch,
    CreditPermissionNoOp,
    ConfidentialBalancesNotEmpty,
    PublicBalanceNotEmpty,
    EmptyAccountProofIncomplete,
    EmptyAccountProofBindingMismatch,
    OperationIdMustBeNonzero,
    JournalPlanMismatch,
    JournalStepOutOfOrder,
    JournalAlreadyTerminal,
    JournalRecoveryRequired,
    JournalRecoveryNotRequired,
    JournalCleanupRequired,
    JournalProofContextUnderflow,
    JournalRecoveryInconsistent,
    ProofContextCleanupNotRequired,
    InvalidPlanShape,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PrivacyRuntimeFacts {
    pub token_2022_program: Key,
    pub zk_elgamal_proof_program: Key,
    pub canonical_mint: Key,
    pub daily_law_program: Key,
    pub law_state: Key,
    pub hook_validation: Key,
    pub has_confidential_transfer_mint: bool,
    pub has_transfer_hook: bool,
    pub has_any_other_mint_extension: bool,
    pub auto_approve_new_confidential_accounts: bool,
    pub confidential_mint_authority_is_none: bool,
    pub transfer_hook_authority_is_none: bool,
    pub global_auditor_is_none: bool,
}

/// A validated *reference input*, not authenticated chain evidence. The fields
/// remain private so plans can only receive values that passed this crate's
/// structural checks, but a production adapter must still derive the facts
/// from exact owner/address/data/bytecode validation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReferenceRuntime {
    token_2022_program: Key,
    zk_elgamal_proof_program: Key,
    canonical_mint: Key,
    daily_law_program: Key,
    law_state: Key,
    hook_validation: Key,
}

impl ReferenceRuntime {
    pub const fn token_2022_program(&self) -> Key {
        self.token_2022_program
    }

    pub const fn zk_elgamal_proof_program(&self) -> Key {
        self.zk_elgamal_proof_program
    }

    pub const fn canonical_mint(&self) -> Key {
        self.canonical_mint
    }

    pub const fn daily_law_program(&self) -> Key {
        self.daily_law_program
    }

    pub const fn law_state(&self) -> Key {
        self.law_state
    }

    pub const fn hook_validation(&self) -> Key {
        self.hook_validation
    }
}

pub fn validate_reference_runtime(
    facts: PrivacyRuntimeFacts,
) -> Result<ReferenceRuntime, PrivacyVaultError> {
    let identities = [
        facts.token_2022_program,
        facts.zk_elgamal_proof_program,
        facts.canonical_mint,
        facts.daily_law_program,
        facts.law_state,
        facts.hook_validation,
    ];
    if identities.contains(&ZERO_KEY) {
        return Err(PrivacyVaultError::ZeroIdentity);
    }
    for left in 0..identities.len() {
        for right in (left + 1)..identities.len() {
            if identities[left] == identities[right] {
                return Err(PrivacyVaultError::RuntimeIdentityCollision);
            }
        }
    }
    if !facts.has_confidential_transfer_mint
        || !facts.has_transfer_hook
        || facts.has_any_other_mint_extension
    {
        return Err(PrivacyVaultError::MintExtensionsNotExact);
    }
    if !facts.auto_approve_new_confidential_accounts
        || !facts.confidential_mint_authority_is_none
        || !facts.transfer_hook_authority_is_none
    {
        return Err(PrivacyVaultError::ConfidentialPolicyNotImmutable);
    }
    if !facts.global_auditor_is_none {
        return Err(PrivacyVaultError::GlobalAuditorForbidden);
    }
    Ok(ReferenceRuntime {
        token_2022_program: facts.token_2022_program,
        zk_elgamal_proof_program: facts.zk_elgamal_proof_program,
        canonical_mint: facts.canonical_mint,
        daily_law_program: facts.daily_law_program,
        law_state: facts.law_state,
        hook_validation: facts.hook_validation,
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfidentialAccountSnapshot {
    pub token_account: Key,
    pub mint: Key,
    pub owner: Key,
    pub elgamal_public_key: Key,
    pub public_balance: u64,
    pub decryptable_available_balance: u64,
    pub decryptable_pending_balance: u64,
    pub pending_balance_credit_counter: u64,
    pub maximum_pending_balance_credit_counter: u64,
    pub configured: bool,
    pub approved: bool,
    pub allow_confidential_credits: bool,
    pub allow_non_confidential_credits: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RecoveryReadiness {
    pub owner: Key,
    pub token_account: Key,
    pub elgamal_public_key: Key,
    pub local_keystore_commitment: Digest,
    pub encrypted_backup_commitment: Digest,
    pub restored_elgamal_public_key: Key,
    pub restored_keystore_commitment: Digest,
    pub backup_is_encrypted: bool,
    pub restore_was_tested: bool,
    pub secrets_exported_to_planner: bool,
}

pub fn validate_recovery_readiness(
    account: &ConfidentialAccountSnapshot,
    recovery: RecoveryReadiness,
) -> Result<(), PrivacyVaultError> {
    if recovery.owner != account.owner
        || recovery.token_account != account.token_account
        || recovery.elgamal_public_key == ZERO_KEY
        || recovery.elgamal_public_key != recovery.restored_elgamal_public_key
        || recovery.local_keystore_commitment == ZERO_KEY
        || recovery.local_keystore_commitment != recovery.restored_keystore_commitment
        || recovery.encrypted_backup_commitment == ZERO_KEY
        || !recovery.backup_is_encrypted
        || !recovery.restore_was_tested
        || recovery.secrets_exported_to_planner
    {
        return Err(PrivacyVaultError::RecoveryBindingMismatch);
    }
    Ok(())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DailyLawTransferAccounts {
    pub daily_law_program: Key,
    pub law_state: Key,
    pub hook_validation: Key,
    pub current_day_finalized: bool,
    pub current_day_open: bool,
    pub resolved_by_official_transfer_hook_adapter: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfidentialProofFacts {
    pub source_token_account: Key,
    pub destination_token_account: Key,
    pub mint: Key,
    pub proof_context_commitment: Digest,
    pub equality_proof_present: bool,
    pub ciphertext_validity_proof_present: bool,
    pub range_proof_present: bool,
    pub generated_locally: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PubkeyValidityProofFacts {
    pub token_account: Key,
    pub mint: Key,
    pub elgamal_public_key: Key,
    pub proof_context_account: Key,
    pub proof_context_authority: Key,
    pub proof_context_commitment: Digest,
    pub generated_locally: bool,
    pub verified_by_zk_elgamal_proof_program: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigureAccountRequest {
    pub explicit_opt_in: bool,
    pub owner_authorized: bool,
    pub recovery: RecoveryReadiness,
    pub proof: PubkeyValidityProofFacts,
    pub maximum_pending_balance_credit_counter: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EmptyAccountProofFacts {
    pub token_account: Key,
    pub mint: Key,
    pub elgamal_public_key: Key,
    pub proof_context_account: Key,
    pub proof_context_authority: Key,
    pub proof_context_commitment: Digest,
    pub generated_locally: bool,
    pub verified_by_zk_elgamal_proof_program: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PrivacyOperation {
    ConfigureAccount,
    Deposit,
    ConfidentialTransfer,
    ApplyPendingBalance,
    Withdraw,
    SetConfidentialCredits,
    SetNonConfidentialCredits,
    EmptyAndCloseAccount,
    CleanupProofContexts,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlanStepKind {
    None,
    ReallocateConfidentialExtension,
    CreateAndVerifyPubkeyValidityProofContext,
    ConfigureConfidentialAccount,
    DepositPublicToConfidential,
    CreateAndVerifyProofContexts,
    ConfidentialTransferWithDailyLawHook,
    CloseProofContexts,
    ApplyPendingBalance,
    WithdrawConfidentialToPublic,
    EnableConfidentialCredits,
    DisableConfidentialCredits,
    EnableNonConfidentialCredits,
    DisableNonConfidentialCredits,
    CreateAndVerifyEmptyAccountProofContext,
    EmptyConfidentialAccount,
    CloseTokenAccount,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AmountVisibility {
    None,
    PublicCleartext,
    ConfidentialClientOnly,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PlanStep {
    pub kind: PlanStepKind,
    pub owner_signature_required: bool,
    pub invokes_daily_law_hook: bool,
    pub changes_owner: bool,
    pub proof_context_cleanup_required: bool,
    pub amount_visibility: AmountVisibility,
    pub cleartext_amount: u64,
}

const EMPTY_STEP: PlanStep = PlanStep {
    kind: PlanStepKind::None,
    owner_signature_required: false,
    invokes_daily_law_hook: false,
    changes_owner: false,
    proof_context_cleanup_required: false,
    amount_visibility: AmountVisibility::None,
    cleartext_amount: 0,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PrivacyOperationPlan {
    pub schema_version: u8,
    pub operation: PrivacyOperation,
    pub source_token_account: Key,
    pub destination_token_account: Key,
    pub mint: Key,
    pub steps: [PlanStep; MAX_PLAN_STEPS],
    pub step_count: u8,
    pub optional_privacy_only: bool,
    pub documented_lifecycle_shape_covered: bool,
    pub same_canonical_mint: bool,
    pub wrapper_or_bridge_asset: bool,
    pub global_auditor: bool,
    pub planner_daily_law_gate_passed: bool,
    pub direct_client_bypass_prevention_verified: bool,
    pub account_local_conversion_outside_hook_disclosed: bool,
    pub maximum_pending_balance_credit_counter: u64,
    pub expected_pending_balance_credit_counter: Option<u64>,
    pub requested_credit_permission: Option<bool>,
    pub operation_binding: Digest,
    pub runtime_authentication_verified: bool,
    pub exact_client_adapter_verified: bool,
    pub durable_resume_and_cleanup_verified: bool,
    pub devnet_lifecycle_verified: bool,
    pub activation_ready: bool,
    pub mainnet_hold: bool,
}

impl PrivacyOperationPlan {
    pub fn active_steps(&self) -> &[PlanStep] {
        let count = self.step_count as usize;
        &self.steps[..if count > MAX_PLAN_STEPS {
            MAX_PLAN_STEPS
        } else {
            count
        }]
    }
}

fn reference_plan(
    operation: PrivacyOperation,
    source: Key,
    destination: Key,
    mint: Key,
    steps: [PlanStep; MAX_PLAN_STEPS],
    step_count: u8,
    conversion_disclosed: bool,
) -> PrivacyOperationPlan {
    PrivacyOperationPlan {
        schema_version: PRIVACY_VAULT_CLIENT_SCHEMA_VERSION,
        operation,
        source_token_account: source,
        destination_token_account: destination,
        mint,
        steps,
        step_count,
        optional_privacy_only: true,
        documented_lifecycle_shape_covered: true,
        same_canonical_mint: true,
        wrapper_or_bridge_asset: false,
        global_auditor: false,
        planner_daily_law_gate_passed: true,
        direct_client_bypass_prevention_verified: false,
        account_local_conversion_outside_hook_disclosed: conversion_disclosed,
        maximum_pending_balance_credit_counter: 0,
        expected_pending_balance_credit_counter: None,
        requested_credit_permission: None,
        operation_binding: ZERO_KEY,
        runtime_authentication_verified: false,
        exact_client_adapter_verified: false,
        durable_resume_and_cleanup_verified: false,
        devnet_lifecycle_verified: false,
        activation_ready: false,
        mainnet_hold: MAINNET_STATUS_HOLD,
    }
}

fn validate_account_binding(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
) -> Result<(), PrivacyVaultError> {
    if account.token_account == ZERO_KEY
        || account.owner == ZERO_KEY
        || account.mint != runtime.canonical_mint
    {
        return Err(PrivacyVaultError::AccountBindingMismatch);
    }
    Ok(())
}

fn require_ready(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
) -> Result<(), PrivacyVaultError> {
    validate_account_binding(runtime, account)?;
    if !account.configured || !account.approved || account.elgamal_public_key == ZERO_KEY {
        return Err(PrivacyVaultError::ConfidentialAccountNotReady);
    }
    Ok(())
}

fn require_owner_authorized(value: bool) -> Result<(), PrivacyVaultError> {
    if !value {
        return Err(PrivacyVaultError::OwnerAuthorizationRequired);
    }
    Ok(())
}

/// Planner-level admission gate for every write-shaped operation. Account-local
/// Token-2022 instructions do not invoke the hook, so this structural gate is
/// not a production substitute for preventing direct-client bypasses.
fn validate_daily_law_first(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    require_hook_resolution: bool,
) -> Result<(), PrivacyVaultError> {
    if law.daily_law_program != runtime.daily_law_program
        || law.law_state != runtime.law_state
        || law.hook_validation != runtime.hook_validation
    {
        return Err(PrivacyVaultError::DailyLawBindingMismatch);
    }
    if !law.current_day_finalized {
        return Err(PrivacyVaultError::DailyLawUnfinalized);
    }
    if !law.current_day_open {
        return Err(PrivacyVaultError::DailyLawLocked);
    }
    if require_hook_resolution && !law.resolved_by_official_transfer_hook_adapter {
        return Err(PrivacyVaultError::HookAccountsNotResolvedByOfficialAdapter);
    }
    Ok(())
}

fn validate_pubkey_validity_proof(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
    proof: PubkeyValidityProofFacts,
) -> Result<(), PrivacyVaultError> {
    if proof.elgamal_public_key == ZERO_KEY
        || proof.proof_context_account == ZERO_KEY
        || proof.proof_context_commitment == ZERO_KEY
        || !proof.generated_locally
        || !proof.verified_by_zk_elgamal_proof_program
    {
        return Err(PrivacyVaultError::PubkeyValidityProofIncomplete);
    }
    if proof.token_account != account.token_account
        || proof.mint != runtime.canonical_mint
        || proof.elgamal_public_key != account.elgamal_public_key
        || proof.proof_context_authority != account.owner
    {
        return Err(PrivacyVaultError::PubkeyValidityProofBindingMismatch);
    }
    Ok(())
}

pub fn plan_configure_account(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    request: ConfigureAccountRequest,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_daily_law_first(runtime, law, false)?;
    validate_account_binding(runtime, account)?;
    if !request.explicit_opt_in {
        return Err(PrivacyVaultError::ExplicitOptInRequired);
    }
    require_owner_authorized(request.owner_authorized)?;
    if account.configured {
        return Err(PrivacyVaultError::ConfidentialAccountAlreadyConfigured);
    }
    if request.maximum_pending_balance_credit_counter == 0 {
        return Err(PrivacyVaultError::MaximumPendingCounterMustBePositive);
    }
    validate_recovery_readiness(account, request.recovery)
        .map_err(|_| PrivacyVaultError::RecoveryReadinessRequired)?;
    validate_pubkey_validity_proof(runtime, account, request.proof)?;
    let steps = [
        PlanStep {
            kind: PlanStepKind::ReallocateConfidentialExtension,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::CreateAndVerifyPubkeyValidityProofContext,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::ConfigureConfidentialAccount,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::CloseProofContexts,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
    ];
    let mut plan = reference_plan(
        PrivacyOperation::ConfigureAccount,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        4,
        true,
    );
    plan.maximum_pending_balance_credit_counter = request.maximum_pending_balance_credit_counter;
    plan.operation_binding = request.proof.proof_context_commitment;
    Ok(plan)
}

pub fn plan_deposit(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    amount: u64,
    owner_authorized: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_daily_law_first(runtime, law, false)?;
    require_ready(runtime, account)?;
    require_owner_authorized(owner_authorized)?;
    if !account.allow_confidential_credits {
        return Err(PrivacyVaultError::ConfidentialCreditsDisabled);
    }
    if amount == 0 {
        return Err(PrivacyVaultError::AmountMustBePositive);
    }
    if account.public_balance < amount {
        return Err(PrivacyVaultError::InsufficientPublicBalance);
    }
    let steps = [
        PlanStep {
            kind: PlanStepKind::DepositPublicToConfidential,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::PublicCleartext,
            cleartext_amount: amount,
        },
        EMPTY_STEP,
        EMPTY_STEP,
        EMPTY_STEP,
    ];
    Ok(reference_plan(
        PrivacyOperation::Deposit,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        1,
        true,
    ))
}

fn validate_proof_bundle(
    runtime: &ReferenceRuntime,
    source: &ConfidentialAccountSnapshot,
    destination: &ConfidentialAccountSnapshot,
    proof: ConfidentialProofFacts,
) -> Result<(), PrivacyVaultError> {
    if !proof.equality_proof_present
        || !proof.ciphertext_validity_proof_present
        || !proof.range_proof_present
        || !proof.generated_locally
        || proof.proof_context_commitment == ZERO_KEY
    {
        return Err(PrivacyVaultError::ProofBundleIncomplete);
    }
    if proof.source_token_account != source.token_account
        || proof.destination_token_account != destination.token_account
        || proof.mint != runtime.canonical_mint
    {
        return Err(PrivacyVaultError::ProofBundleBindingMismatch);
    }
    Ok(())
}

fn validate_law_accounts(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
) -> Result<(), PrivacyVaultError> {
    validate_daily_law_first(runtime, law, true)
}

pub fn plan_confidential_transfer(
    runtime: &ReferenceRuntime,
    source: &ConfidentialAccountSnapshot,
    destination: &ConfidentialAccountSnapshot,
    amount: u64,
    owner_authorized: bool,
    proof: ConfidentialProofFacts,
    law: DailyLawTransferAccounts,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    // A confidential transfer is the only modeled ownership-transfer path.
    // Validate its Daily-Law and hook account boundary before reading account,
    // owner, amount, pending-counter, or proof facts.
    validate_law_accounts(runtime, law)?;
    require_ready(runtime, source)?;
    require_ready(runtime, destination)?;
    require_owner_authorized(owner_authorized)?;
    if source.token_account == destination.token_account {
        return Err(PrivacyVaultError::SelfTransferForbidden);
    }
    if !destination.allow_confidential_credits {
        return Err(PrivacyVaultError::ConfidentialCreditsDisabled);
    }
    if amount == 0 {
        return Err(PrivacyVaultError::AmountMustBePositive);
    }
    if source.decryptable_available_balance < amount {
        return Err(PrivacyVaultError::InsufficientConfidentialBalance);
    }
    if destination.pending_balance_credit_counter
        >= destination.maximum_pending_balance_credit_counter
    {
        return Err(PrivacyVaultError::PendingCounterMismatch);
    }
    validate_proof_bundle(runtime, source, destination, proof)?;
    let changes_owner = source.owner != destination.owner;
    let steps = [
        PlanStep {
            kind: PlanStepKind::CreateAndVerifyProofContexts,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::ConfidentialClientOnly,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::ConfidentialTransferWithDailyLawHook,
            owner_signature_required: true,
            invokes_daily_law_hook: true,
            changes_owner,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::ConfidentialClientOnly,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::CloseProofContexts,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        EMPTY_STEP,
    ];
    let mut plan = reference_plan(
        PrivacyOperation::ConfidentialTransfer,
        source.token_account,
        destination.token_account,
        runtime.canonical_mint,
        steps,
        3,
        false,
    );
    plan.operation_binding = proof.proof_context_commitment;
    Ok(plan)
}

pub fn plan_apply_pending_balance(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    expected_pending_credit_counter: u64,
    owner_authorized: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_daily_law_first(runtime, law, false)?;
    require_ready(runtime, account)?;
    require_owner_authorized(owner_authorized)?;
    if account.decryptable_pending_balance == 0 {
        return Err(PrivacyVaultError::PendingBalanceEmpty);
    }
    if account.pending_balance_credit_counter != expected_pending_credit_counter {
        return Err(PrivacyVaultError::PendingCounterMismatch);
    }
    let steps = [
        PlanStep {
            kind: PlanStepKind::ApplyPendingBalance,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::ConfidentialClientOnly,
            cleartext_amount: 0,
        },
        EMPTY_STEP,
        EMPTY_STEP,
        EMPTY_STEP,
    ];
    let mut plan = reference_plan(
        PrivacyOperation::ApplyPendingBalance,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        1,
        true,
    );
    plan.expected_pending_balance_credit_counter = Some(expected_pending_credit_counter);
    Ok(plan)
}

pub fn plan_withdraw(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    amount: u64,
    owner_authorized: bool,
    proof_context_commitment: Digest,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_daily_law_first(runtime, law, false)?;
    require_ready(runtime, account)?;
    require_owner_authorized(owner_authorized)?;
    if amount == 0 {
        return Err(PrivacyVaultError::AmountMustBePositive);
    }
    if account.decryptable_available_balance < amount {
        return Err(PrivacyVaultError::InsufficientConfidentialBalance);
    }
    if proof_context_commitment == ZERO_KEY {
        return Err(PrivacyVaultError::ProofBundleIncomplete);
    }
    let steps = [
        PlanStep {
            kind: PlanStepKind::CreateAndVerifyProofContexts,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::ConfidentialClientOnly,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::WithdrawConfidentialToPublic,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::PublicCleartext,
            cleartext_amount: amount,
        },
        PlanStep {
            kind: PlanStepKind::CloseProofContexts,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        EMPTY_STEP,
    ];
    let mut plan = reference_plan(
        PrivacyOperation::Withdraw,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        3,
        true,
    );
    plan.operation_binding = proof_context_commitment;
    Ok(plan)
}

fn plan_set_credit_permission(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    enabled: bool,
    owner_authorized: bool,
    confidential: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_daily_law_first(runtime, law, false)?;
    require_ready(runtime, account)?;
    require_owner_authorized(owner_authorized)?;
    let current = if confidential {
        account.allow_confidential_credits
    } else {
        account.allow_non_confidential_credits
    };
    if current == enabled {
        return Err(PrivacyVaultError::CreditPermissionNoOp);
    }
    let kind = match (confidential, enabled) {
        (true, true) => PlanStepKind::EnableConfidentialCredits,
        (true, false) => PlanStepKind::DisableConfidentialCredits,
        (false, true) => PlanStepKind::EnableNonConfidentialCredits,
        (false, false) => PlanStepKind::DisableNonConfidentialCredits,
    };
    let steps = [
        PlanStep {
            kind,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        EMPTY_STEP,
        EMPTY_STEP,
        EMPTY_STEP,
    ];
    let operation = if confidential {
        PrivacyOperation::SetConfidentialCredits
    } else {
        PrivacyOperation::SetNonConfidentialCredits
    };
    let mut plan = reference_plan(
        operation,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        1,
        true,
    );
    plan.requested_credit_permission = Some(enabled);
    Ok(plan)
}

pub fn plan_set_confidential_credits(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    enabled: bool,
    owner_authorized: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    plan_set_credit_permission(runtime, law, account, enabled, owner_authorized, true)
}

pub fn plan_set_non_confidential_credits(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    enabled: bool,
    owner_authorized: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    plan_set_credit_permission(runtime, law, account, enabled, owner_authorized, false)
}

fn validate_empty_account_proof(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
    proof: EmptyAccountProofFacts,
) -> Result<(), PrivacyVaultError> {
    if proof.elgamal_public_key == ZERO_KEY
        || proof.proof_context_account == ZERO_KEY
        || proof.proof_context_commitment == ZERO_KEY
        || !proof.generated_locally
        || !proof.verified_by_zk_elgamal_proof_program
    {
        return Err(PrivacyVaultError::EmptyAccountProofIncomplete);
    }
    if proof.token_account != account.token_account
        || proof.mint != runtime.canonical_mint
        || proof.elgamal_public_key != account.elgamal_public_key
        || proof.proof_context_authority != account.owner
    {
        return Err(PrivacyVaultError::EmptyAccountProofBindingMismatch);
    }
    Ok(())
}

pub fn plan_empty_and_close_account(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    account: &ConfidentialAccountSnapshot,
    owner_authorized: bool,
    proof: EmptyAccountProofFacts,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_daily_law_first(runtime, law, false)?;
    require_ready(runtime, account)?;
    require_owner_authorized(owner_authorized)?;
    if account.public_balance != 0 {
        return Err(PrivacyVaultError::PublicBalanceNotEmpty);
    }
    if account.decryptable_available_balance != 0 || account.decryptable_pending_balance != 0 {
        return Err(PrivacyVaultError::ConfidentialBalancesNotEmpty);
    }
    validate_empty_account_proof(runtime, account, proof)?;
    let steps = [
        PlanStep {
            kind: PlanStepKind::CreateAndVerifyEmptyAccountProofContext,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::ConfidentialClientOnly,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::EmptyConfidentialAccount,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: true,
            amount_visibility: AmountVisibility::ConfidentialClientOnly,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::CloseProofContexts,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        PlanStep {
            kind: PlanStepKind::CloseTokenAccount,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
    ];
    let mut plan = reference_plan(
        PrivacyOperation::EmptyAndCloseAccount,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        4,
        true,
    );
    plan.operation_binding = proof.proof_context_commitment;
    Ok(plan)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OperationJournalStatus {
    InProgress,
    CleanupRequired,
    RecoveryRequired,
    Completed,
    Aborted,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JournalStepObservation {
    Confirmed,
    FailedBeforeCommit,
    ResultUnknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OperationJournal {
    pub operation_id: u64,
    bound_plan: PrivacyOperationPlan,
    pub next_step_index: u8,
    pub open_proof_contexts: u8,
    pub status: OperationJournalStatus,
    pub authenticated_chain_observation_verified: bool,
    pub durable_persistence_verified: bool,
    pub activation_ready: bool,
    pub mainnet_hold: bool,
}

impl OperationJournal {
    pub fn bound_plan(&self) -> &PrivacyOperationPlan {
        &self.bound_plan
    }
}

fn exact_step(
    step: PlanStep,
    kind: PlanStepKind,
    invokes_hook: bool,
    changes_owner: bool,
    cleanup_required: bool,
    visibility: AmountVisibility,
    cleartext_amount: u64,
) -> bool {
    step.kind == kind
        && step.owner_signature_required
        && step.invokes_daily_law_hook == invokes_hook
        && step.changes_owner == changes_owner
        && step.proof_context_cleanup_required == cleanup_required
        && step.amount_visibility == visibility
        && step.cleartext_amount == cleartext_amount
}

fn has_canonical_operation_steps(plan: &PrivacyOperationPlan) -> bool {
    let steps = &plan.steps;
    match plan.operation {
        PrivacyOperation::ConfigureAccount => {
            plan.step_count == 4
                && exact_step(
                    steps[0],
                    PlanStepKind::ReallocateConfidentialExtension,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
                && exact_step(
                    steps[1],
                    PlanStepKind::CreateAndVerifyPubkeyValidityProofContext,
                    false,
                    false,
                    true,
                    AmountVisibility::None,
                    0,
                )
                && exact_step(
                    steps[2],
                    PlanStepKind::ConfigureConfidentialAccount,
                    false,
                    false,
                    true,
                    AmountVisibility::None,
                    0,
                )
                && exact_step(
                    steps[3],
                    PlanStepKind::CloseProofContexts,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
        }
        PrivacyOperation::Deposit => {
            plan.step_count == 1
                && steps[0].cleartext_amount > 0
                && exact_step(
                    steps[0],
                    PlanStepKind::DepositPublicToConfidential,
                    false,
                    false,
                    false,
                    AmountVisibility::PublicCleartext,
                    steps[0].cleartext_amount,
                )
        }
        PrivacyOperation::ConfidentialTransfer => {
            plan.step_count == 3
                && exact_step(
                    steps[0],
                    PlanStepKind::CreateAndVerifyProofContexts,
                    false,
                    false,
                    true,
                    AmountVisibility::ConfidentialClientOnly,
                    0,
                )
                && steps[1].kind == PlanStepKind::ConfidentialTransferWithDailyLawHook
                && steps[1].owner_signature_required
                && steps[1].invokes_daily_law_hook
                && steps[1].proof_context_cleanup_required
                && steps[1].amount_visibility == AmountVisibility::ConfidentialClientOnly
                && steps[1].cleartext_amount == 0
                && exact_step(
                    steps[2],
                    PlanStepKind::CloseProofContexts,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
        }
        PrivacyOperation::ApplyPendingBalance => {
            plan.step_count == 1
                && exact_step(
                    steps[0],
                    PlanStepKind::ApplyPendingBalance,
                    false,
                    false,
                    false,
                    AmountVisibility::ConfidentialClientOnly,
                    0,
                )
        }
        PrivacyOperation::Withdraw => {
            plan.step_count == 3
                && exact_step(
                    steps[0],
                    PlanStepKind::CreateAndVerifyProofContexts,
                    false,
                    false,
                    true,
                    AmountVisibility::ConfidentialClientOnly,
                    0,
                )
                && steps[1].cleartext_amount > 0
                && exact_step(
                    steps[1],
                    PlanStepKind::WithdrawConfidentialToPublic,
                    false,
                    false,
                    true,
                    AmountVisibility::PublicCleartext,
                    steps[1].cleartext_amount,
                )
                && exact_step(
                    steps[2],
                    PlanStepKind::CloseProofContexts,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
        }
        PrivacyOperation::SetConfidentialCredits | PrivacyOperation::SetNonConfidentialCredits => {
            let kind = match (plan.operation, plan.requested_credit_permission) {
                (PrivacyOperation::SetConfidentialCredits, Some(true)) => {
                    PlanStepKind::EnableConfidentialCredits
                }
                (PrivacyOperation::SetConfidentialCredits, Some(false)) => {
                    PlanStepKind::DisableConfidentialCredits
                }
                (PrivacyOperation::SetNonConfidentialCredits, Some(true)) => {
                    PlanStepKind::EnableNonConfidentialCredits
                }
                (PrivacyOperation::SetNonConfidentialCredits, Some(false)) => {
                    PlanStepKind::DisableNonConfidentialCredits
                }
                _ => return false,
            };
            plan.step_count == 1
                && exact_step(
                    steps[0],
                    kind,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
        }
        PrivacyOperation::EmptyAndCloseAccount => {
            plan.step_count == 4
                && exact_step(
                    steps[0],
                    PlanStepKind::CreateAndVerifyEmptyAccountProofContext,
                    false,
                    false,
                    true,
                    AmountVisibility::ConfidentialClientOnly,
                    0,
                )
                && exact_step(
                    steps[1],
                    PlanStepKind::EmptyConfidentialAccount,
                    false,
                    false,
                    true,
                    AmountVisibility::ConfidentialClientOnly,
                    0,
                )
                && exact_step(
                    steps[2],
                    PlanStepKind::CloseProofContexts,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
                && exact_step(
                    steps[3],
                    PlanStepKind::CloseTokenAccount,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
        }
        PrivacyOperation::CleanupProofContexts => {
            plan.step_count == 1
                && exact_step(
                    steps[0],
                    PlanStepKind::CloseProofContexts,
                    false,
                    false,
                    false,
                    AmountVisibility::None,
                    0,
                )
        }
    }
}

fn validate_plan_shape(plan: &PrivacyOperationPlan) -> Result<(), PrivacyVaultError> {
    let step_count = plan.step_count as usize;
    let is_transfer = plan.operation == PrivacyOperation::ConfidentialTransfer;
    let is_configure = plan.operation == PrivacyOperation::ConfigureAccount;
    let is_apply_pending = plan.operation == PrivacyOperation::ApplyPendingBalance;
    let is_credit_toggle = matches!(
        plan.operation,
        PrivacyOperation::SetConfidentialCredits | PrivacyOperation::SetNonConfidentialCredits
    );
    let requires_operation_binding = matches!(
        plan.operation,
        PrivacyOperation::ConfigureAccount
            | PrivacyOperation::ConfidentialTransfer
            | PrivacyOperation::Withdraw
            | PrivacyOperation::EmptyAndCloseAccount
    );
    if plan.schema_version != PRIVACY_VAULT_CLIENT_SCHEMA_VERSION
        || step_count == 0
        || step_count > MAX_PLAN_STEPS
        || plan.source_token_account == ZERO_KEY
        || plan.destination_token_account == ZERO_KEY
        || plan.mint == ZERO_KEY
        || !plan.optional_privacy_only
        || !plan.documented_lifecycle_shape_covered
        || !plan.same_canonical_mint
        || plan.wrapper_or_bridge_asset
        || plan.global_auditor
        || !plan.planner_daily_law_gate_passed
        || plan.direct_client_bypass_prevention_verified
        || plan.account_local_conversion_outside_hook_disclosed == is_transfer
        || (plan.maximum_pending_balance_credit_counter > 0) != is_configure
        || plan.expected_pending_balance_credit_counter.is_some() != is_apply_pending
        || plan.requested_credit_permission.is_some() != is_credit_toggle
        || (plan.operation_binding != ZERO_KEY) != requires_operation_binding
        || plan.runtime_authentication_verified
        || plan.exact_client_adapter_verified
        || plan.durable_resume_and_cleanup_verified
        || plan.devnet_lifecycle_verified
        || plan.activation_ready
        || !plan.mainnet_hold
        || !has_canonical_operation_steps(plan)
    {
        return Err(PrivacyVaultError::InvalidPlanShape);
    }
    for (index, step) in plan.steps.iter().enumerate() {
        if (index < step_count) == (step.kind == PlanStepKind::None) {
            return Err(PrivacyVaultError::InvalidPlanShape);
        }
    }
    Ok(())
}

pub fn create_operation_journal(
    plan: &PrivacyOperationPlan,
    operation_id: u64,
) -> Result<OperationJournal, PrivacyVaultError> {
    if operation_id == 0 {
        return Err(PrivacyVaultError::OperationIdMustBeNonzero);
    }
    validate_plan_shape(plan)?;
    Ok(OperationJournal {
        operation_id,
        bound_plan: *plan,
        next_step_index: 0,
        open_proof_contexts: 0,
        status: OperationJournalStatus::InProgress,
        authenticated_chain_observation_verified: false,
        durable_persistence_verified: false,
        activation_ready: false,
        mainnet_hold: true,
    })
}

fn validate_journal_binding(
    plan: &PrivacyOperationPlan,
    journal: &OperationJournal,
) -> Result<(), PrivacyVaultError> {
    validate_plan_shape(plan)?;
    if journal.operation_id == 0 || journal.bound_plan != *plan {
        return Err(PrivacyVaultError::JournalPlanMismatch);
    }
    Ok(())
}

fn proof_context_delta(kind: PlanStepKind) -> (u8, u8) {
    match kind {
        PlanStepKind::CreateAndVerifyPubkeyValidityProofContext
        | PlanStepKind::CreateAndVerifyEmptyAccountProofContext => (1, 0),
        PlanStepKind::CreateAndVerifyProofContexts => (3, 0),
        PlanStepKind::CloseProofContexts => (0, u8::MAX),
        _ => (0, 0),
    }
}

fn apply_confirmed_step(
    open_proof_contexts: &mut u8,
    step: PlanStep,
) -> Result<(), PrivacyVaultError> {
    let (opened, closed) = proof_context_delta(step.kind);
    *open_proof_contexts = open_proof_contexts
        .checked_add(opened)
        .ok_or(PrivacyVaultError::JournalRecoveryInconsistent)?;
    if closed == u8::MAX {
        *open_proof_contexts = 0;
    } else {
        *open_proof_contexts = open_proof_contexts
            .checked_sub(closed)
            .ok_or(PrivacyVaultError::JournalProofContextUnderflow)?;
    }
    Ok(())
}

pub fn record_operation_step(
    plan: &PrivacyOperationPlan,
    journal: &mut OperationJournal,
    step_index: u8,
    observation: JournalStepObservation,
) -> Result<(), PrivacyVaultError> {
    validate_journal_binding(plan, journal)?;
    if matches!(
        journal.status,
        OperationJournalStatus::Completed | OperationJournalStatus::Aborted
    ) {
        return Err(PrivacyVaultError::JournalAlreadyTerminal);
    }
    if journal.status == OperationJournalStatus::RecoveryRequired {
        return Err(PrivacyVaultError::JournalRecoveryRequired);
    }
    if journal.status == OperationJournalStatus::CleanupRequired {
        return Err(PrivacyVaultError::JournalCleanupRequired);
    }
    if step_index != journal.next_step_index || step_index >= plan.step_count {
        return Err(PrivacyVaultError::JournalStepOutOfOrder);
    }
    match observation {
        JournalStepObservation::Confirmed => {
            apply_confirmed_step(
                &mut journal.open_proof_contexts,
                plan.steps[step_index as usize],
            )?;
            journal.next_step_index += 1;
            journal.status = if journal.next_step_index == plan.step_count {
                if journal.open_proof_contexts == 0 {
                    OperationJournalStatus::Completed
                } else {
                    OperationJournalStatus::CleanupRequired
                }
            } else {
                OperationJournalStatus::InProgress
            };
        }
        JournalStepObservation::FailedBeforeCommit => {
            journal.status = if journal.open_proof_contexts == 0 {
                OperationJournalStatus::Aborted
            } else {
                OperationJournalStatus::CleanupRequired
            };
        }
        JournalStepObservation::ResultUnknown => {
            journal.status = OperationJournalStatus::RecoveryRequired;
        }
    }
    Ok(())
}

pub fn recover_operation_journal(
    plan: &PrivacyOperationPlan,
    journal: &mut OperationJournal,
    confirmed_step_count: u8,
    observed_open_proof_contexts: u8,
) -> Result<(), PrivacyVaultError> {
    validate_journal_binding(plan, journal)?;
    if matches!(
        journal.status,
        OperationJournalStatus::Completed | OperationJournalStatus::Aborted
    ) {
        return Err(PrivacyVaultError::JournalAlreadyTerminal);
    }
    if !matches!(
        journal.status,
        OperationJournalStatus::RecoveryRequired | OperationJournalStatus::CleanupRequired
    ) {
        return Err(PrivacyVaultError::JournalRecoveryNotRequired);
    }
    if confirmed_step_count > plan.step_count {
        return Err(PrivacyVaultError::JournalRecoveryInconsistent);
    }
    let mut expected_open = 0;
    for index in 0..confirmed_step_count {
        apply_confirmed_step(&mut expected_open, plan.steps[index as usize])?;
    }
    if expected_open != observed_open_proof_contexts {
        return Err(PrivacyVaultError::JournalRecoveryInconsistent);
    }
    journal.next_step_index = confirmed_step_count;
    journal.open_proof_contexts = observed_open_proof_contexts;
    journal.status = if confirmed_step_count == plan.step_count {
        if expected_open == 0 {
            OperationJournalStatus::Completed
        } else {
            OperationJournalStatus::CleanupRequired
        }
    } else {
        OperationJournalStatus::InProgress
    };
    journal.authenticated_chain_observation_verified = false;
    journal.durable_persistence_verified = false;
    journal.activation_ready = false;
    journal.mainnet_hold = true;
    Ok(())
}

pub fn plan_cleanup_proof_contexts(
    runtime: &ReferenceRuntime,
    law: DailyLawTransferAccounts,
    original_plan: &PrivacyOperationPlan,
    journal: &OperationJournal,
    owner_authorized: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_daily_law_first(runtime, law, false)?;
    validate_journal_binding(original_plan, journal)?;
    require_owner_authorized(owner_authorized)?;
    if journal.open_proof_contexts == 0 {
        return Err(PrivacyVaultError::ProofContextCleanupNotRequired);
    }
    let steps = [
        PlanStep {
            kind: PlanStepKind::CloseProofContexts,
            owner_signature_required: true,
            invokes_daily_law_hook: false,
            changes_owner: false,
            proof_context_cleanup_required: false,
            amount_visibility: AmountVisibility::None,
            cleartext_amount: 0,
        },
        EMPTY_STEP,
        EMPTY_STEP,
        EMPTY_STEP,
    ];
    Ok(reference_plan(
        PrivacyOperation::CleanupProofContexts,
        journal.bound_plan.source_token_account,
        journal.bound_plan.destination_token_account,
        journal.bound_plan.mint,
        steps,
        1,
        true,
    ))
}

/// Ordinary public IAT users do not opt in to this crate's lifecycle and incur
/// no confidential-account, proof-context, proof-generation, or key-backup
/// requirements from the Privacy Vault feature itself.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OrdinaryPublicPrivacyOverhead {
    pub confidential_account_required: bool,
    pub proof_generation_required: bool,
    pub proof_context_transactions_required: bool,
    pub privacy_key_backup_required: bool,
}

pub const fn ordinary_public_privacy_overhead() -> OrdinaryPublicPrivacyOverhead {
    OrdinaryPublicPrivacyOverhead {
        confidential_account_required: false,
        proof_generation_required: false,
        proof_context_transactions_required: false,
        privacy_key_backup_required: false,
    }
}

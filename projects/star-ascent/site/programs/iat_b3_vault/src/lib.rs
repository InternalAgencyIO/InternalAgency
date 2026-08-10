#![no_std]
#![forbid(unsafe_code)]

//! Host-only lifecycle planner for the optional IAT B3 Privacy Vault client.
//!
//! This crate performs no RPC, proof generation, key storage, signing, account
//! mutation, or token instruction encoding. It cannot authorize Devnet or
//! Mainnet. Its purpose is to make the currently modeled lifecycle shape and
//! its fail-closed boundaries deterministic before the missing Token-2022
//! phases and an exact-version native client adapter are implemented and
//! independently reviewed.

pub const PRIVACY_VAULT_CLIENT_SCHEMA_VERSION: u8 = 1;
pub const PRIVACY_VAULT_CLIENT_REFERENCE_STATUS: &str = "PARTIAL_HOST_ONLY_LIFECYCLE_SHAPE";
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
pub enum PrivacyOperation {
    ConfigureAccount,
    Deposit,
    ConfidentialTransfer,
    ApplyPendingBalance,
    Withdraw,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlanStepKind {
    None,
    ConfigureConfidentialAccount,
    DepositPublicToConfidential,
    CreateAndVerifyProofContexts,
    ConfidentialTransferWithDailyLawHook,
    CloseProofContexts,
    ApplyPendingBalance,
    WithdrawConfidentialToPublic,
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
    pub lifecycle_shape_complete: bool,
    pub same_canonical_mint: bool,
    pub wrapper_or_bridge_asset: bool,
    pub global_auditor: bool,
    pub no_daily_law_bypass: bool,
    pub account_local_conversion_outside_hook_disclosed: bool,
    pub runtime_authentication_verified: bool,
    pub exact_client_adapter_verified: bool,
    pub durable_resume_and_cleanup_verified: bool,
    pub devnet_lifecycle_verified: bool,
    pub activation_ready: bool,
    pub mainnet_hold: bool,
}

impl PrivacyOperationPlan {
    pub fn active_steps(&self) -> &[PlanStep] {
        &self.steps[..self.step_count as usize]
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
        lifecycle_shape_complete: false,
        same_canonical_mint: true,
        wrapper_or_bridge_asset: false,
        global_auditor: false,
        no_daily_law_bypass: true,
        account_local_conversion_outside_hook_disclosed: conversion_disclosed,
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

pub fn plan_configure_account(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
    explicit_opt_in: bool,
    owner_authorized: bool,
    recovery: RecoveryReadiness,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
    validate_account_binding(runtime, account)?;
    if !explicit_opt_in {
        return Err(PrivacyVaultError::ExplicitOptInRequired);
    }
    require_owner_authorized(owner_authorized)?;
    if account.configured {
        return Err(PrivacyVaultError::ConfidentialAccountAlreadyConfigured);
    }
    validate_recovery_readiness(account, recovery)
        .map_err(|_| PrivacyVaultError::RecoveryReadinessRequired)?;
    let steps = [
        PlanStep {
            kind: PlanStepKind::ConfigureConfidentialAccount,
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
        PrivacyOperation::ConfigureAccount,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        1,
        true,
    ))
}

pub fn plan_deposit(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
    amount: u64,
    owner_authorized: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
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
    if !law.resolved_by_official_transfer_hook_adapter {
        return Err(PrivacyVaultError::HookAccountsNotResolvedByOfficialAdapter);
    }
    Ok(())
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
    Ok(reference_plan(
        PrivacyOperation::ConfidentialTransfer,
        source.token_account,
        destination.token_account,
        runtime.canonical_mint,
        steps,
        3,
        false,
    ))
}

pub fn plan_apply_pending_balance(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
    expected_pending_credit_counter: u64,
    owner_authorized: bool,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
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
    Ok(reference_plan(
        PrivacyOperation::ApplyPendingBalance,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        1,
        true,
    ))
}

pub fn plan_withdraw(
    runtime: &ReferenceRuntime,
    account: &ConfidentialAccountSnapshot,
    amount: u64,
    owner_authorized: bool,
    proof_context_commitment: Digest,
) -> Result<PrivacyOperationPlan, PrivacyVaultError> {
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
    Ok(reference_plan(
        PrivacyOperation::Withdraw,
        account.token_account,
        account.token_account,
        account.mint,
        steps,
        3,
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

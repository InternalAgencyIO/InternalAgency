use iat_b3_vault::*;

const TOKEN_2022: Key = [1; 32];
const ZK_PROOF: Key = [2; 32];
const MINT: Key = [3; 32];
const LAW_PROGRAM: Key = [4; 32];
const LAW_STATE: Key = [5; 32];
const HOOK_VALIDATION: Key = [6; 32];
const OWNER: Key = [7; 32];
const SOURCE: Key = [8; 32];
const DESTINATION: Key = [9; 32];
const ELGAMAL: Key = [10; 32];

fn runtime_facts() -> PrivacyRuntimeFacts {
    PrivacyRuntimeFacts {
        token_2022_program: TOKEN_2022,
        zk_elgamal_proof_program: ZK_PROOF,
        canonical_mint: MINT,
        daily_law_program: LAW_PROGRAM,
        law_state: LAW_STATE,
        hook_validation: HOOK_VALIDATION,
        has_confidential_transfer_mint: true,
        has_transfer_hook: true,
        has_any_other_mint_extension: false,
        auto_approve_new_confidential_accounts: true,
        confidential_mint_authority_is_none: true,
        transfer_hook_authority_is_none: true,
        global_auditor_is_none: true,
    }
}

fn runtime() -> ReferenceRuntime {
    validate_reference_runtime(runtime_facts()).unwrap()
}

fn account(token_account: Key) -> ConfidentialAccountSnapshot {
    ConfidentialAccountSnapshot {
        token_account,
        mint: MINT,
        owner: OWNER,
        elgamal_public_key: ELGAMAL,
        public_balance: 1_000,
        decryptable_available_balance: 600,
        decryptable_pending_balance: 50,
        pending_balance_credit_counter: 2,
        maximum_pending_balance_credit_counter: 64,
        configured: true,
        approved: true,
        allow_confidential_credits: true,
    }
}

fn recovery(token_account: Key) -> RecoveryReadiness {
    RecoveryReadiness {
        owner: OWNER,
        token_account,
        elgamal_public_key: ELGAMAL,
        local_keystore_commitment: [11; 32],
        encrypted_backup_commitment: [12; 32],
        restored_elgamal_public_key: ELGAMAL,
        restored_keystore_commitment: [11; 32],
        backup_is_encrypted: true,
        restore_was_tested: true,
        secrets_exported_to_planner: false,
    }
}

fn proof() -> ConfidentialProofFacts {
    ConfidentialProofFacts {
        source_token_account: SOURCE,
        destination_token_account: DESTINATION,
        mint: MINT,
        proof_context_commitment: [13; 32],
        equality_proof_present: true,
        ciphertext_validity_proof_present: true,
        range_proof_present: true,
        generated_locally: true,
    }
}

fn open_law() -> DailyLawTransferAccounts {
    DailyLawTransferAccounts {
        daily_law_program: LAW_PROGRAM,
        law_state: LAW_STATE,
        hook_validation: HOOK_VALIDATION,
        current_day_finalized: true,
        current_day_open: true,
        resolved_by_official_transfer_hook_adapter: true,
    }
}

#[test]
fn runtime_accepts_only_the_exact_immutable_no_auditor_mint_policy() {
    let bound = runtime();
    assert_eq!(bound.token_2022_program(), TOKEN_2022);
    assert_eq!(bound.zk_elgamal_proof_program(), ZK_PROOF);
    assert_eq!(bound.canonical_mint(), MINT);

    let mut facts = runtime_facts();
    facts.global_auditor_is_none = false;
    assert_eq!(
        validate_reference_runtime(facts),
        Err(PrivacyVaultError::GlobalAuditorForbidden)
    );
    let mut facts = runtime_facts();
    facts.has_any_other_mint_extension = true;
    assert_eq!(
        validate_reference_runtime(facts),
        Err(PrivacyVaultError::MintExtensionsNotExact)
    );
    let mut facts = runtime_facts();
    facts.transfer_hook_authority_is_none = false;
    assert_eq!(
        validate_reference_runtime(facts),
        Err(PrivacyVaultError::ConfidentialPolicyNotImmutable)
    );
    let mut facts = runtime_facts();
    facts.law_state = facts.daily_law_program;
    assert_eq!(
        validate_reference_runtime(facts),
        Err(PrivacyVaultError::RuntimeIdentityCollision)
    );
}

#[test]
fn configuration_requires_explicit_opt_in_owner_authorization_and_tested_recovery() {
    let mut unconfigured = account(SOURCE);
    unconfigured.configured = false;
    unconfigured.approved = false;
    unconfigured.elgamal_public_key = [0; 32];
    let mut readiness = recovery(SOURCE);
    readiness.elgamal_public_key = ELGAMAL;

    assert_eq!(
        plan_configure_account(&runtime(), &unconfigured, false, true, readiness),
        Err(PrivacyVaultError::ExplicitOptInRequired)
    );
    assert_eq!(
        plan_configure_account(&runtime(), &unconfigured, true, false, readiness),
        Err(PrivacyVaultError::OwnerAuthorizationRequired)
    );
    let mut invalid = readiness;
    invalid.restore_was_tested = false;
    assert_eq!(
        plan_configure_account(&runtime(), &unconfigured, true, true, invalid),
        Err(PrivacyVaultError::RecoveryReadinessRequired)
    );
    let plan = plan_configure_account(&runtime(), &unconfigured, true, true, readiness).unwrap();
    assert_eq!(plan.operation, PrivacyOperation::ConfigureAccount);
    assert_eq!(plan.active_steps().len(), 1);
    assert_eq!(
        plan.active_steps()[0].kind,
        PlanStepKind::ConfigureConfidentialAccount
    );
    assert!(plan.account_local_conversion_outside_hook_disclosed);
}

#[test]
fn account_local_deposit_apply_and_withdraw_never_claim_hook_invocation() {
    let source = account(SOURCE);
    let deposit = plan_deposit(&runtime(), &source, 100, true).unwrap();
    assert_eq!(deposit.operation, PrivacyOperation::Deposit);
    assert_eq!(deposit.active_steps()[0].cleartext_amount, 100);
    assert_eq!(
        deposit.active_steps()[0].amount_visibility,
        AmountVisibility::PublicCleartext
    );
    assert!(deposit
        .active_steps()
        .iter()
        .all(|step| !step.invokes_daily_law_hook && !step.changes_owner));

    let apply = plan_apply_pending_balance(&runtime(), &source, 2, true).unwrap();
    assert_eq!(apply.operation, PrivacyOperation::ApplyPendingBalance);
    assert_eq!(
        apply.active_steps()[0].kind,
        PlanStepKind::ApplyPendingBalance
    );
    assert!(!apply.active_steps()[0].invokes_daily_law_hook);

    let withdraw = plan_withdraw(&runtime(), &source, 200, true, [14; 32]).unwrap();
    assert_eq!(withdraw.operation, PrivacyOperation::Withdraw);
    assert_eq!(withdraw.active_steps().len(), 3);
    assert_eq!(
        withdraw.active_steps()[1].kind,
        PlanStepKind::WithdrawConfidentialToPublic
    );
    assert_eq!(withdraw.active_steps()[1].cleartext_amount, 200);
    assert!(withdraw
        .active_steps()
        .iter()
        .all(|step| !step.invokes_daily_law_hook && !step.changes_owner));
}

#[test]
fn same_owner_confidential_transfer_has_proofs_cleanup_and_exact_daily_law_hook() {
    let source = account(SOURCE);
    let destination = account(DESTINATION);
    let plan = plan_confidential_transfer(
        &runtime(),
        &source,
        &destination,
        250,
        true,
        proof(),
        open_law(),
    )
    .unwrap();
    assert_eq!(plan.operation, PrivacyOperation::ConfidentialTransfer);
    assert_eq!(plan.active_steps().len(), 3);
    assert_eq!(
        plan.active_steps()[0].kind,
        PlanStepKind::CreateAndVerifyProofContexts
    );
    assert_eq!(
        plan.active_steps()[1].kind,
        PlanStepKind::ConfidentialTransferWithDailyLawHook
    );
    assert_eq!(
        plan.active_steps()[2].kind,
        PlanStepKind::CloseProofContexts
    );
    assert_eq!(
        plan.active_steps()
            .iter()
            .filter(|step| step.invokes_daily_law_hook)
            .count(),
        1
    );
    assert_eq!(
        plan.active_steps()
            .iter()
            .filter(|step| step.changes_owner)
            .count(),
        0
    );
    assert_eq!(plan.active_steps()[1].cleartext_amount, 0);
    assert_eq!(
        plan.active_steps()[1].amount_visibility,
        AmountVisibility::ConfidentialClientOnly
    );
    assert!(plan.active_steps()[0].proof_context_cleanup_required);
    assert!(plan.active_steps()[1].proof_context_cleanup_required);
    assert!(!plan.account_local_conversion_outside_hook_disclosed);
}

#[test]
fn different_owner_confidential_transfer_marks_exactly_one_ownership_change() {
    let source = account(SOURCE);
    let mut destination = account(DESTINATION);
    destination.owner = [15; 32];
    let plan = plan_confidential_transfer(
        &runtime(),
        &source,
        &destination,
        250,
        true,
        proof(),
        open_law(),
    )
    .unwrap();
    assert_eq!(
        plan.active_steps()
            .iter()
            .filter(|step| step.changes_owner)
            .count(),
        1
    );
    assert!(plan.active_steps()[1].invokes_daily_law_hook);
}

#[test]
fn transfer_fails_closed_on_law_proof_binding_credit_and_balance_adversaries() {
    let source = account(SOURCE);
    let destination = account(DESTINATION);

    let mut law = open_law();
    law.current_day_finalized = false;
    assert_eq!(
        plan_confidential_transfer(&runtime(), &source, &destination, 1, true, proof(), law),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    let mut law = open_law();
    law.current_day_open = false;
    assert_eq!(
        plan_confidential_transfer(&runtime(), &source, &destination, 1, true, proof(), law),
        Err(PrivacyVaultError::DailyLawLocked)
    );
    let mut law = open_law();
    law.resolved_by_official_transfer_hook_adapter = false;
    assert_eq!(
        plan_confidential_transfer(&runtime(), &source, &destination, 1, true, proof(), law),
        Err(PrivacyVaultError::HookAccountsNotResolvedByOfficialAdapter)
    );
    let mut invalid_proof = proof();
    invalid_proof.range_proof_present = false;
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &source,
            &destination,
            1,
            true,
            invalid_proof,
            open_law()
        ),
        Err(PrivacyVaultError::ProofBundleIncomplete)
    );
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &source,
            &destination,
            601,
            true,
            proof(),
            open_law()
        ),
        Err(PrivacyVaultError::InsufficientConfidentialBalance)
    );
    let mut full_destination = destination;
    full_destination.pending_balance_credit_counter =
        full_destination.maximum_pending_balance_credit_counter;
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &source,
            &full_destination,
            1,
            true,
            proof(),
            open_law()
        ),
        Err(PrivacyVaultError::PendingCounterMismatch)
    );
}

#[test]
fn confidential_transfer_validates_daily_law_before_account_or_proof_facts() {
    let mut invalid_source = account(SOURCE);
    invalid_source.mint = [0; 32];
    let mut invalid_proof = proof();
    invalid_proof.range_proof_present = false;
    let mut unfinalized = open_law();
    unfinalized.current_day_finalized = false;
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &invalid_source,
            &account(DESTINATION),
            0,
            false,
            invalid_proof,
            unfinalized,
        ),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
}

#[test]
fn every_plan_is_non_activating_and_public_users_have_zero_privacy_overhead() {
    let source = account(SOURCE);
    let destination = account(DESTINATION);
    let plans = [
        plan_deposit(&runtime(), &source, 1, true).unwrap(),
        plan_confidential_transfer(
            &runtime(),
            &source,
            &destination,
            1,
            true,
            proof(),
            open_law(),
        )
        .unwrap(),
        plan_apply_pending_balance(&runtime(), &source, 2, true).unwrap(),
        plan_withdraw(&runtime(), &source, 1, true, [14; 32]).unwrap(),
    ];
    for plan in plans {
        assert!(plan.optional_privacy_only);
        assert!(!plan.lifecycle_shape_complete);
        assert!(plan.same_canonical_mint);
        assert!(!plan.wrapper_or_bridge_asset);
        assert!(!plan.global_auditor);
        assert!(plan.no_daily_law_bypass);
        assert!(!plan.runtime_authentication_verified);
        assert!(!plan.exact_client_adapter_verified);
        assert!(!plan.durable_resume_and_cleanup_verified);
        assert!(!plan.devnet_lifecycle_verified);
        assert!(!plan.activation_ready);
        assert!(plan.mainnet_hold);
    }
    let ordinary = ordinary_public_privacy_overhead();
    assert_eq!(
        ordinary,
        OrdinaryPublicPrivacyOverhead {
            confidential_account_required: false,
            proof_generation_required: false,
            proof_context_transactions_required: false,
            privacy_key_backup_required: false,
        }
    );
}

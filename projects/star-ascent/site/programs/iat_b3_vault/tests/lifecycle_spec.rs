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
const PUBKEY_CONTEXT: Key = [16; 32];
const EMPTY_CONTEXT: Key = [17; 32];

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
        allow_non_confidential_credits: true,
    }
}

fn unconfigured_account() -> ConfidentialAccountSnapshot {
    let mut value = account(SOURCE);
    value.configured = false;
    value.approved = false;
    value
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

fn transfer_proof() -> ConfidentialProofFacts {
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

fn pubkey_proof() -> PubkeyValidityProofFacts {
    PubkeyValidityProofFacts {
        token_account: SOURCE,
        mint: MINT,
        elgamal_public_key: ELGAMAL,
        proof_context_account: PUBKEY_CONTEXT,
        proof_context_authority: OWNER,
        proof_context_commitment: [18; 32],
        generated_locally: true,
        verified_by_zk_elgamal_proof_program: true,
    }
}

fn configure_request() -> ConfigureAccountRequest {
    ConfigureAccountRequest {
        explicit_opt_in: true,
        owner_authorized: true,
        recovery: recovery(SOURCE),
        proof: pubkey_proof(),
        maximum_pending_balance_credit_counter: 64,
    }
}

fn empty_proof(token_account: Key) -> EmptyAccountProofFacts {
    EmptyAccountProofFacts {
        token_account,
        mint: MINT,
        elgamal_public_key: ELGAMAL,
        proof_context_account: EMPTY_CONTEXT,
        proof_context_authority: OWNER,
        proof_context_commitment: [19; 32],
        generated_locally: true,
        verified_by_zk_elgamal_proof_program: true,
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

fn unfinalized_law() -> DailyLawTransferAccounts {
    let mut law = open_law();
    law.current_day_finalized = false;
    law
}

fn transfer_plan() -> PrivacyOperationPlan {
    plan_confidential_transfer(
        &runtime(),
        &account(SOURCE),
        &account(DESTINATION),
        1,
        true,
        transfer_proof(),
        open_law(),
    )
    .unwrap()
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
fn configure_models_reallocation_pubkey_validity_context_counter_and_cleanup() {
    let account = unconfigured_account();
    let mut zero_counter = configure_request();
    zero_counter.maximum_pending_balance_credit_counter = 0;
    assert_eq!(
        plan_configure_account(&runtime(), open_law(), &account, zero_counter),
        Err(PrivacyVaultError::MaximumPendingCounterMustBePositive)
    );
    let mut bad_proof = configure_request();
    bad_proof.proof.proof_context_authority = [99; 32];
    assert_eq!(
        plan_configure_account(&runtime(), open_law(), &account, bad_proof),
        Err(PrivacyVaultError::PubkeyValidityProofBindingMismatch)
    );
    let plan =
        plan_configure_account(&runtime(), open_law(), &account, configure_request()).unwrap();
    assert_eq!(plan.maximum_pending_balance_credit_counter, 64);
    assert_eq!(
        plan.active_steps()
            .iter()
            .map(|item| item.kind)
            .collect::<Vec<_>>(),
        vec![
            PlanStepKind::ReallocateConfidentialExtension,
            PlanStepKind::CreateAndVerifyPubkeyValidityProofContext,
            PlanStepKind::ConfigureConfidentialAccount,
            PlanStepKind::CloseProofContexts,
        ]
    );
}

#[test]
fn configure_preserves_opt_in_owner_and_recovery_failure_branches() {
    let account = unconfigured_account();
    let mut missing_opt_in = configure_request();
    missing_opt_in.explicit_opt_in = false;
    assert_eq!(
        plan_configure_account(&runtime(), open_law(), &account, missing_opt_in),
        Err(PrivacyVaultError::ExplicitOptInRequired)
    );

    let mut missing_owner = configure_request();
    missing_owner.owner_authorized = false;
    assert_eq!(
        plan_configure_account(&runtime(), open_law(), &account, missing_owner),
        Err(PrivacyVaultError::OwnerAuthorizationRequired)
    );

    let mut unready_recovery = configure_request();
    unready_recovery.recovery.restore_was_tested = false;
    assert_eq!(
        plan_configure_account(&runtime(), open_law(), &account, unready_recovery),
        Err(PrivacyVaultError::RecoveryReadinessRequired)
    );
}

#[test]
fn daily_law_failure_precedence_is_binding_then_finalized_then_open() {
    let invalid = ConfidentialAccountSnapshot {
        token_account: [0; 32],
        ..account(SOURCE)
    };
    let mut wrong_binding = open_law();
    wrong_binding.law_state = [99; 32];
    wrong_binding.current_day_finalized = false;
    wrong_binding.current_day_open = false;
    assert_eq!(
        plan_deposit(&runtime(), wrong_binding, &invalid, 0, false),
        Err(PrivacyVaultError::DailyLawBindingMismatch)
    );

    let mut unfinalized = open_law();
    unfinalized.current_day_finalized = false;
    unfinalized.current_day_open = false;
    assert_eq!(
        plan_deposit(&runtime(), unfinalized, &invalid, 0, false),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );

    let mut locked = open_law();
    locked.current_day_open = false;
    assert_eq!(
        plan_deposit(&runtime(), locked, &invalid, 0, false),
        Err(PrivacyVaultError::DailyLawLocked)
    );
}

#[test]
fn account_local_write_shapes_never_claim_hook_invocation() {
    let source = account(SOURCE);
    let deposit = plan_deposit(&runtime(), open_law(), &source, 100, true).unwrap();
    let apply = plan_apply_pending_balance(&runtime(), open_law(), &source, 2, true).unwrap();
    let withdraw = plan_withdraw(&runtime(), open_law(), &source, 200, true, [14; 32]).unwrap();
    for plan in [deposit, apply, withdraw] {
        assert!(plan.account_local_conversion_outside_hook_disclosed);
        assert!(plan
            .active_steps()
            .iter()
            .all(|item| !item.invokes_daily_law_hook && !item.changes_owner));
    }
}

#[test]
fn apply_pending_counter_requires_exact_observed_expected_match() {
    let source = account(SOURCE);
    let counter_two = plan_apply_pending_balance(&runtime(), open_law(), &source, 2, true).unwrap();
    assert_eq!(counter_two.expected_pending_balance_credit_counter, Some(2));
    assert_eq!(
        plan_apply_pending_balance(&runtime(), open_law(), &source, 3, true),
        Err(PrivacyVaultError::PendingCounterMismatch)
    );

    let mut counter_one_account = source;
    counter_one_account.pending_balance_credit_counter = 1;
    let counter_one =
        plan_apply_pending_balance(&runtime(), open_law(), &counter_one_account, 1, true).unwrap();
    assert_ne!(counter_one, counter_two);
    let mut journal = create_operation_journal(&counter_two, 63).unwrap();
    assert_eq!(
        record_operation_step(
            &counter_one,
            &mut journal,
            0,
            JournalStepObservation::Confirmed,
        ),
        Err(PrivacyVaultError::JournalPlanMismatch)
    );
}

#[test]
fn confidential_transfer_models_same_and_different_owner_semantics() {
    let same_owner = transfer_plan();
    assert_eq!(
        same_owner
            .active_steps()
            .iter()
            .filter(|item| item.invokes_daily_law_hook)
            .count(),
        1
    );
    assert!(!same_owner.active_steps()[1].changes_owner);

    let mut destination = account(DESTINATION);
    destination.owner = [15; 32];
    let different_owner = plan_confidential_transfer(
        &runtime(),
        &account(SOURCE),
        &destination,
        1,
        true,
        transfer_proof(),
        open_law(),
    )
    .unwrap();
    assert!(different_owner.active_steps()[1].changes_owner);
    assert_eq!(
        different_owner
            .active_steps()
            .iter()
            .filter(|item| item.changes_owner)
            .count(),
        1
    );
}

#[test]
fn transfer_fails_closed_on_law_proof_credit_balance_and_counter_adversaries() {
    let source = account(SOURCE);
    let destination = account(DESTINATION);
    let mut law = open_law();
    law.resolved_by_official_transfer_hook_adapter = false;
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &source,
            &destination,
            1,
            true,
            transfer_proof(),
            law,
        ),
        Err(PrivacyVaultError::HookAccountsNotResolvedByOfficialAdapter)
    );
    let mut proof = transfer_proof();
    proof.range_proof_present = false;
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &source,
            &destination,
            1,
            true,
            proof,
            open_law(),
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
            transfer_proof(),
            open_law(),
        ),
        Err(PrivacyVaultError::InsufficientConfidentialBalance)
    );
    let mut full = destination;
    full.pending_balance_credit_counter = full.maximum_pending_balance_credit_counter;
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &source,
            &full,
            1,
            true,
            transfer_proof(),
            open_law(),
        ),
        Err(PrivacyVaultError::PendingCounterMismatch)
    );
}

#[test]
fn credit_permission_enable_disable_shapes_are_explicit_and_no_op_fails() {
    let current = account(SOURCE);
    let disable_conf =
        plan_set_confidential_credits(&runtime(), open_law(), &current, false, true).unwrap();
    let disable_public =
        plan_set_non_confidential_credits(&runtime(), open_law(), &current, false, true).unwrap();
    assert_eq!(
        disable_conf.active_steps()[0].kind,
        PlanStepKind::DisableConfidentialCredits
    );
    assert_eq!(
        disable_public.active_steps()[0].kind,
        PlanStepKind::DisableNonConfidentialCredits
    );
    assert_eq!(disable_conf.requested_credit_permission, Some(false));

    let mut disabled = current;
    disabled.allow_confidential_credits = false;
    disabled.allow_non_confidential_credits = false;
    assert_eq!(
        plan_set_confidential_credits(&runtime(), open_law(), &disabled, true, true)
            .unwrap()
            .active_steps()[0]
            .kind,
        PlanStepKind::EnableConfidentialCredits
    );
    assert_eq!(
        plan_set_non_confidential_credits(&runtime(), open_law(), &disabled, true, true)
            .unwrap()
            .active_steps()[0]
            .kind,
        PlanStepKind::EnableNonConfidentialCredits
    );
    assert_eq!(
        plan_set_confidential_credits(&runtime(), open_law(), &current, true, true),
        Err(PrivacyVaultError::CreditPermissionNoOp)
    );
}

#[test]
fn empty_account_proof_precedes_confidential_empty_cleanup_and_token_close() {
    let mut closing = account(SOURCE);
    assert_eq!(
        plan_empty_and_close_account(&runtime(), open_law(), &closing, true, empty_proof(SOURCE),),
        Err(PrivacyVaultError::PublicBalanceNotEmpty)
    );
    closing.public_balance = 0;
    assert_eq!(
        plan_empty_and_close_account(&runtime(), open_law(), &closing, true, empty_proof(SOURCE),),
        Err(PrivacyVaultError::ConfidentialBalancesNotEmpty)
    );
    closing.decryptable_available_balance = 0;
    closing.decryptable_pending_balance = 0;
    let plan =
        plan_empty_and_close_account(&runtime(), open_law(), &closing, true, empty_proof(SOURCE))
            .unwrap();
    assert_eq!(
        plan.active_steps()
            .iter()
            .map(|item| item.kind)
            .collect::<Vec<_>>(),
        vec![
            PlanStepKind::CreateAndVerifyEmptyAccountProofContext,
            PlanStepKind::EmptyConfidentialAccount,
            PlanStepKind::CloseProofContexts,
            PlanStepKind::CloseTokenAccount,
        ]
    );
}

#[test]
fn every_write_planner_checks_daily_law_before_other_inputs() {
    let invalid = ConfidentialAccountSnapshot {
        token_account: [0; 32],
        ..account(SOURCE)
    };
    let mut invalid_request = configure_request();
    invalid_request.explicit_opt_in = false;
    invalid_request.owner_authorized = false;
    invalid_request.maximum_pending_balance_credit_counter = 0;
    assert_eq!(
        plan_configure_account(&runtime(), unfinalized_law(), &invalid, invalid_request),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    assert_eq!(
        plan_deposit(&runtime(), unfinalized_law(), &invalid, 0, false),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    assert_eq!(
        plan_apply_pending_balance(&runtime(), unfinalized_law(), &invalid, 0, false),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    assert_eq!(
        plan_withdraw(&runtime(), unfinalized_law(), &invalid, 0, false, [0; 32]),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    assert_eq!(
        plan_set_confidential_credits(&runtime(), unfinalized_law(), &invalid, true, false),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    assert_eq!(
        plan_set_non_confidential_credits(&runtime(), unfinalized_law(), &invalid, true, false),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    assert_eq!(
        plan_empty_and_close_account(
            &runtime(),
            unfinalized_law(),
            &invalid,
            false,
            empty_proof(SOURCE),
        ),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
    assert_eq!(
        plan_confidential_transfer(
            &runtime(),
            &invalid,
            &invalid,
            0,
            false,
            transfer_proof(),
            unfinalized_law(),
        ),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );

    let plan = transfer_plan();
    let mut journal = create_operation_journal(&plan, 1).unwrap();
    record_operation_step(&plan, &mut journal, 0, JournalStepObservation::Confirmed).unwrap();
    assert_eq!(
        plan_cleanup_proof_contexts(&runtime(), unfinalized_law(), &plan, &journal, false),
        Err(PrivacyVaultError::DailyLawUnfinalized)
    );
}

#[test]
fn journal_tracks_proof_cleanup_completion_and_rejects_order_forgery() {
    let plan = transfer_plan();
    assert_eq!(
        create_operation_journal(&plan, 0),
        Err(PrivacyVaultError::OperationIdMustBeNonzero)
    );
    let mut journal = create_operation_journal(&plan, 44).unwrap();
    assert_eq!(journal.bound_plan(), &plan);
    assert_eq!(
        record_operation_step(&plan, &mut journal, 1, JournalStepObservation::Confirmed),
        Err(PrivacyVaultError::JournalStepOutOfOrder)
    );
    record_operation_step(&plan, &mut journal, 0, JournalStepObservation::Confirmed).unwrap();
    assert_eq!(journal.open_proof_contexts, 3);
    record_operation_step(&plan, &mut journal, 1, JournalStepObservation::Confirmed).unwrap();
    record_operation_step(&plan, &mut journal, 2, JournalStepObservation::Confirmed).unwrap();
    assert_eq!(journal.status, OperationJournalStatus::Completed);
    assert_eq!(journal.open_proof_contexts, 0);
    assert_eq!(
        record_operation_step(&plan, &mut journal, 2, JournalStepObservation::Confirmed),
        Err(PrivacyVaultError::JournalAlreadyTerminal)
    );

    let mut failed = create_operation_journal(&plan, 45).unwrap();
    record_operation_step(&plan, &mut failed, 0, JournalStepObservation::Confirmed).unwrap();
    record_operation_step(
        &plan,
        &mut failed,
        1,
        JournalStepObservation::FailedBeforeCommit,
    )
    .unwrap();
    assert_eq!(failed.status, OperationJournalStatus::CleanupRequired);
    assert_eq!(
        record_operation_step(&plan, &mut failed, 1, JournalStepObservation::Confirmed),
        Err(PrivacyVaultError::JournalCleanupRequired)
    );
}

#[test]
fn journal_rejects_oversized_and_same_identity_substituted_plans_without_panicking() {
    let plan = transfer_plan();
    let mut oversized = plan;
    oversized.step_count = (MAX_PLAN_STEPS as u8) + 1;
    assert_eq!(oversized.active_steps().len(), MAX_PLAN_STEPS);
    assert_eq!(
        create_operation_journal(&oversized, 60),
        Err(PrivacyVaultError::InvalidPlanShape)
    );
    let mut false_completion = plan;
    false_completion.runtime_authentication_verified = true;
    assert_eq!(
        create_operation_journal(&false_completion, 60),
        Err(PrivacyVaultError::InvalidPlanShape)
    );
    let mut contradictory_steps = plan;
    contradictory_steps.steps[0].kind = PlanStepKind::CloseTokenAccount;
    assert_eq!(
        create_operation_journal(&contradictory_steps, 60),
        Err(PrivacyVaultError::InvalidPlanShape)
    );

    let mut alternate_proof = transfer_proof();
    alternate_proof.proof_context_commitment = [21; 32];
    let alternate_transfer = plan_confidential_transfer(
        &runtime(),
        &account(SOURCE),
        &account(DESTINATION),
        2,
        true,
        alternate_proof,
        open_law(),
    )
    .unwrap();
    assert_ne!(plan.operation_binding, alternate_transfer.operation_binding);
    let mut transfer_journal = create_operation_journal(&plan, 62).unwrap();
    assert_eq!(
        record_operation_step(
            &alternate_transfer,
            &mut transfer_journal,
            0,
            JournalStepObservation::Confirmed,
        ),
        Err(PrivacyVaultError::JournalPlanMismatch)
    );

    let current = account(SOURCE);
    let disable =
        plan_set_confidential_credits(&runtime(), open_law(), &current, false, true).unwrap();
    let mut disabled = current;
    disabled.allow_confidential_credits = false;
    let enable =
        plan_set_confidential_credits(&runtime(), open_law(), &disabled, true, true).unwrap();
    assert_eq!(disable.operation, enable.operation);
    assert_eq!(disable.source_token_account, enable.source_token_account);
    assert_eq!(
        disable.destination_token_account,
        enable.destination_token_account
    );
    assert_eq!(disable.mint, enable.mint);

    let mut journal = create_operation_journal(&disable, 61).unwrap();
    assert_eq!(
        record_operation_step(&enable, &mut journal, 0, JournalStepObservation::Confirmed),
        Err(PrivacyVaultError::JournalPlanMismatch)
    );
}

#[test]
fn unknown_result_recovery_and_cleanup_remain_structural_and_nonactivating() {
    let plan = transfer_plan();
    let mut journal = create_operation_journal(&plan, 55).unwrap();
    record_operation_step(&plan, &mut journal, 0, JournalStepObservation::Confirmed).unwrap();
    record_operation_step(
        &plan,
        &mut journal,
        1,
        JournalStepObservation::ResultUnknown,
    )
    .unwrap();
    assert_eq!(journal.status, OperationJournalStatus::RecoveryRequired);
    assert_eq!(
        record_operation_step(&plan, &mut journal, 1, JournalStepObservation::Confirmed),
        Err(PrivacyVaultError::JournalRecoveryRequired)
    );
    assert_eq!(
        recover_operation_journal(&plan, &mut journal, 1, 2),
        Err(PrivacyVaultError::JournalRecoveryInconsistent)
    );
    recover_operation_journal(&plan, &mut journal, 1, 3).unwrap();
    assert_eq!(
        recover_operation_journal(&plan, &mut journal, 0, 0),
        Err(PrivacyVaultError::JournalRecoveryNotRequired)
    );
    assert!(!journal.authenticated_chain_observation_verified);
    assert!(!journal.durable_persistence_verified);
    assert!(!journal.activation_ready);
    assert!(journal.mainnet_hold);

    let cleanup =
        plan_cleanup_proof_contexts(&runtime(), open_law(), &plan, &journal, true).unwrap();
    assert_eq!(cleanup.operation, PrivacyOperation::CleanupProofContexts);
    assert_eq!(
        cleanup.active_steps()[0].kind,
        PlanStepKind::CloseProofContexts
    );

    let mut substituted_proof = transfer_proof();
    substituted_proof.proof_context_commitment = [22; 32];
    let substituted = plan_confidential_transfer(
        &runtime(),
        &account(SOURCE),
        &account(DESTINATION),
        1,
        true,
        substituted_proof,
        open_law(),
    )
    .unwrap();
    assert_eq!(
        plan_cleanup_proof_contexts(&runtime(), open_law(), &substituted, &journal, true),
        Err(PrivacyVaultError::JournalPlanMismatch)
    );
}

#[test]
fn every_plan_is_nonactivating_and_public_users_have_zero_privacy_overhead() {
    let source = account(SOURCE);
    let mut closing = source;
    closing.public_balance = 0;
    closing.decryptable_available_balance = 0;
    closing.decryptable_pending_balance = 0;
    let plans = [
        plan_deposit(&runtime(), open_law(), &source, 1, true).unwrap(),
        transfer_plan(),
        plan_apply_pending_balance(&runtime(), open_law(), &source, 2, true).unwrap(),
        plan_withdraw(&runtime(), open_law(), &source, 1, true, [14; 32]).unwrap(),
        plan_set_confidential_credits(&runtime(), open_law(), &source, false, true).unwrap(),
        plan_set_non_confidential_credits(&runtime(), open_law(), &source, false, true).unwrap(),
        plan_empty_and_close_account(&runtime(), open_law(), &closing, true, empty_proof(SOURCE))
            .unwrap(),
    ];
    for plan in plans {
        assert!(plan.optional_privacy_only);
        assert!(plan.documented_lifecycle_shape_covered);
        assert!(plan.same_canonical_mint);
        assert!(!plan.wrapper_or_bridge_asset);
        assert!(!plan.global_auditor);
        assert!(plan.planner_daily_law_gate_passed);
        assert!(!plan.direct_client_bypass_prevention_verified);
        assert!(!plan.runtime_authentication_verified);
        assert!(!plan.exact_client_adapter_verified);
        assert!(!plan.durable_resume_and_cleanup_verified);
        assert!(!plan.devnet_lifecycle_verified);
        assert!(!plan.activation_ready);
        assert!(plan.mainnet_hold);
    }
    assert_eq!(
        ordinary_public_privacy_overhead(),
        OrdinaryPublicPrivacyOverhead {
            confidential_account_required: false,
            proof_generation_required: false,
            proof_context_transactions_required: false,
            privacy_key_backup_required: false,
        }
    );
}

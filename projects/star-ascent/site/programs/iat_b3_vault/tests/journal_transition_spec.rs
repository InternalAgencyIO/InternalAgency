use iat_b3_vault::journal_codec::{
    decode_operation_journal, encode_operation_journal, operation_journal_digest,
};
use iat_b3_vault::journal_transition::{
    prepare_journal_transition, verify_journal_transition_parts, verify_journal_transition_receipt,
    JournalTransitionError, JournalTransitionMutation, PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION,
    PRIVACY_JOURNAL_TRANSITION_REFERENCE_STATUS,
};
use iat_b3_vault::{
    create_operation_journal, AmountVisibility, JournalStepObservation, OperationJournal,
    OperationJournalStatus, PlanStep, PlanStepKind, PrivacyOperation, PrivacyOperationPlan,
    PrivacyVaultError, MAINNET_STATUS_HOLD, MAX_PLAN_STEPS, PRIVACY_VAULT_CLIENT_SCHEMA_VERSION,
};

const EMPTY_STEP: PlanStep = PlanStep {
    kind: PlanStepKind::None,
    owner_signature_required: false,
    invokes_daily_law_hook: false,
    changes_owner: false,
    proof_context_cleanup_required: false,
    amount_visibility: AmountVisibility::None,
    cleartext_amount: 0,
};

fn key(value: u8) -> [u8; 32] {
    [value; 32]
}

fn step(
    kind: PlanStepKind,
    invokes_daily_law_hook: bool,
    changes_owner: bool,
    cleanup_required: bool,
    visibility: AmountVisibility,
    cleartext_amount: u64,
) -> PlanStep {
    PlanStep {
        kind,
        owner_signature_required: true,
        invokes_daily_law_hook,
        changes_owner,
        proof_context_cleanup_required: cleanup_required,
        amount_visibility: visibility,
        cleartext_amount,
    }
}

fn base_plan(
    operation: PrivacyOperation,
    steps: [PlanStep; MAX_PLAN_STEPS],
    step_count: u8,
    conversion_disclosed: bool,
) -> PrivacyOperationPlan {
    PrivacyOperationPlan {
        schema_version: PRIVACY_VAULT_CLIENT_SCHEMA_VERSION,
        operation,
        source_token_account: key(0x11),
        destination_token_account: key(0x22),
        mint: key(0x33),
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
        operation_binding: [0; 32],
        runtime_authentication_verified: false,
        exact_client_adapter_verified: false,
        durable_resume_and_cleanup_verified: false,
        devnet_lifecycle_verified: false,
        activation_ready: false,
        mainnet_hold: MAINNET_STATUS_HOLD,
    }
}

fn deposit_plan() -> PrivacyOperationPlan {
    base_plan(
        PrivacyOperation::Deposit,
        [
            step(
                PlanStepKind::DepositPublicToConfidential,
                false,
                false,
                false,
                AmountVisibility::PublicCleartext,
                42,
            ),
            EMPTY_STEP,
            EMPTY_STEP,
            EMPTY_STEP,
        ],
        1,
        true,
    )
}

fn transfer_plan() -> PrivacyOperationPlan {
    let mut plan = base_plan(
        PrivacyOperation::ConfidentialTransfer,
        [
            step(
                PlanStepKind::CreateAndVerifyProofContexts,
                false,
                false,
                true,
                AmountVisibility::ConfidentialClientOnly,
                0,
            ),
            step(
                PlanStepKind::ConfidentialTransferWithDailyLawHook,
                true,
                true,
                true,
                AmountVisibility::ConfidentialClientOnly,
                0,
            ),
            step(
                PlanStepKind::CloseProofContexts,
                false,
                false,
                false,
                AmountVisibility::None,
                0,
            ),
            EMPTY_STEP,
        ],
        3,
        false,
    );
    plan.operation_binding = key(0x44);
    plan
}

fn initial_journal(plan: &PrivacyOperationPlan, operation_id: u64) -> OperationJournal {
    create_operation_journal(plan, operation_id).expect("canonical initial journal")
}

fn confirmed(step_index: u8) -> JournalTransitionMutation {
    JournalTransitionMutation::RecordStep {
        step_index,
        observation: JournalStepObservation::Confirmed,
    }
}

fn prepare(
    journal: &OperationJournal,
    mutation: JournalTransitionMutation,
) -> iat_b3_vault::journal_transition::JournalTransitionReceipt {
    prepare_journal_transition(
        journal,
        operation_journal_digest(journal).expect("canonical digest"),
        mutation,
    )
    .expect("valid transition")
}

fn receipt_after(
    receipt: &iat_b3_vault::journal_transition::JournalTransitionReceipt,
) -> OperationJournal {
    decode_operation_journal(receipt.after_journal_bytes()).expect("canonical receipt after")
}

#[test]
fn confirmed_receipt_binds_exact_codec_snapshots_without_mutating_input() {
    let plan = deposit_plan();
    let journal = initial_journal(&plan, 7);
    let original = journal;
    let direct_before = encode_operation_journal(&journal).unwrap();

    let receipt = prepare(&journal, confirmed(0));

    assert_eq!(journal, original);
    assert_eq!(
        receipt.version(),
        PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION
    );
    assert_eq!(receipt.before_journal_bytes(), &direct_before);
    assert_eq!(
        receipt.before_journal_digest(),
        operation_journal_digest(&journal).unwrap()
    );
    assert_ne!(
        receipt.before_journal_digest(),
        receipt.after_journal_digest()
    );
    assert!(verify_journal_transition_receipt(&receipt).is_ok());
    let after = receipt_after(&receipt);
    assert_eq!(after.operation_id, 7);
    assert_eq!(after.bound_plan(), &plan);
    assert_eq!(after.next_step_index, 1);
    assert_eq!(after.status, OperationJournalStatus::Completed);
}

#[test]
fn receipt_truth_is_replay_only_and_every_external_fact_stays_hold() {
    let receipt = prepare(&initial_journal(&deposit_plan(), 8), confirmed(0));

    assert_eq!(
        PRIVACY_JOURNAL_TRANSITION_REFERENCE_STATUS,
        "HOST_ONLY_DETERMINISTIC_TRANSITION_REPLAY_NONACTIVATING"
    );
    assert!(receipt.deterministic_transition_replay_verified());
    assert!(!receipt.durable_persistence_verified());
    assert!(!receipt.writer_confinement_verified());
    assert!(!receipt.authenticated_chain_observation_verified());
    assert!(!receipt.runtime_integration_verified());
    assert!(!receipt.devnet_lifecycle_verified());
    assert!(!receipt.activation_ready());
    assert!(receipt.mainnet_hold());
    assert!(!receipt_after(&receipt).durable_persistence_verified);
    assert!(receipt_after(&receipt).mainnet_hold);
}

#[test]
fn all_observations_and_unknown_result_recovery_replay_exactly() {
    let plan = deposit_plan();
    let initial = initial_journal(&plan, 9);
    let failed = prepare(
        &initial,
        JournalTransitionMutation::RecordStep {
            step_index: 0,
            observation: JournalStepObservation::FailedBeforeCommit,
        },
    );
    assert_eq!(
        receipt_after(&failed).status,
        OperationJournalStatus::Aborted
    );

    let unknown = prepare(
        &initial,
        JournalTransitionMutation::RecordStep {
            step_index: 0,
            observation: JournalStepObservation::ResultUnknown,
        },
    );
    let recovery_required = receipt_after(&unknown);
    assert_eq!(
        recovery_required.status,
        OperationJournalStatus::RecoveryRequired
    );
    let recovered = prepare(
        &recovery_required,
        JournalTransitionMutation::Recover {
            confirmed_step_count: 1,
            observed_open_proof_contexts: 0,
        },
    );
    assert_eq!(
        receipt_after(&recovered).status,
        OperationJournalStatus::Completed
    );
}

#[test]
fn proof_context_prefix_recovery_and_cleanup_transition_are_exact() {
    let plan = transfer_plan();
    let initial = initial_journal(&plan, 10);
    let after_open = receipt_after(&prepare(&initial, confirmed(0)));
    assert_eq!(after_open.open_proof_contexts, 3);

    let unknown = receipt_after(&prepare(
        &after_open,
        JournalTransitionMutation::RecordStep {
            step_index: 1,
            observation: JournalStepObservation::ResultUnknown,
        },
    ));
    let recovered = receipt_after(&prepare(
        &unknown,
        JournalTransitionMutation::Recover {
            confirmed_step_count: 2,
            observed_open_proof_contexts: 3,
        },
    ));
    assert_eq!(recovered.next_step_index, 2);
    assert_eq!(recovered.open_proof_contexts, 3);
    assert_eq!(recovered.status, OperationJournalStatus::InProgress);

    let completed = receipt_after(&prepare(&recovered, confirmed(2)));
    assert_eq!(completed.open_proof_contexts, 0);
    assert_eq!(completed.status, OperationJournalStatus::Completed);
}

#[test]
fn stale_before_digest_and_illegal_mutations_fail_without_mutating_input() {
    let plan = deposit_plan();
    let journal = initial_journal(&plan, 11);
    let original = journal;
    let mut stale = operation_journal_digest(&journal).unwrap();
    stale[0] ^= 1;
    assert_eq!(
        prepare_journal_transition(&journal, stale, confirmed(0)),
        Err(JournalTransitionError::BeforeDigestMismatch)
    );
    assert_eq!(journal, original);

    assert_eq!(
        prepare_journal_transition(
            &journal,
            operation_journal_digest(&journal).unwrap(),
            confirmed(1),
        ),
        Err(JournalTransitionError::Lifecycle(
            PrivacyVaultError::JournalStepOutOfOrder
        ))
    );
    assert_eq!(
        prepare_journal_transition(
            &journal,
            operation_journal_digest(&journal).unwrap(),
            JournalTransitionMutation::Recover {
                confirmed_step_count: 0,
                observed_open_proof_contexts: 0,
            },
        ),
        Err(JournalTransitionError::Lifecycle(
            PrivacyVaultError::JournalRecoveryNotRequired
        ))
    );
    assert_eq!(journal, original);
}

#[test]
fn forged_mutation_arguments_swapped_endpoints_and_noop_pairs_fail_closed() {
    let initial = initial_journal(&deposit_plan(), 12);
    let receipt = prepare(&initial, confirmed(0));
    assert_eq!(
        verify_journal_transition_parts(
            receipt.before_journal_bytes(),
            receipt.before_journal_digest(),
            JournalTransitionMutation::RecordStep {
                step_index: 0,
                observation: JournalStepObservation::FailedBeforeCommit,
            },
            receipt.after_journal_bytes(),
            receipt.after_journal_digest(),
        ),
        Err(JournalTransitionError::AfterSnapshotMismatch)
    );
    assert!(verify_journal_transition_parts(
        receipt.after_journal_bytes(),
        receipt.after_journal_digest(),
        confirmed(0),
        receipt.before_journal_bytes(),
        receipt.before_journal_digest(),
    )
    .is_err());
    assert_eq!(
        verify_journal_transition_parts(
            receipt.before_journal_bytes(),
            receipt.before_journal_digest(),
            confirmed(0),
            receipt.before_journal_bytes(),
            receipt.before_journal_digest(),
        ),
        Err(JournalTransitionError::NoStateChange)
    );
}

#[test]
fn digest_bit_flips_and_endpoint_byte_drift_fail_closed() {
    let receipt = prepare(&initial_journal(&deposit_plan(), 13), confirmed(0));
    let mut before_digest = receipt.before_journal_digest();
    before_digest[3] ^= 0x80;
    assert_eq!(
        verify_journal_transition_parts(
            receipt.before_journal_bytes(),
            before_digest,
            receipt.mutation(),
            receipt.after_journal_bytes(),
            receipt.after_journal_digest(),
        ),
        Err(JournalTransitionError::BeforeDigestMismatch)
    );

    let mut after_digest = receipt.after_journal_digest();
    after_digest[9] ^= 0x01;
    assert_eq!(
        verify_journal_transition_parts(
            receipt.before_journal_bytes(),
            receipt.before_journal_digest(),
            receipt.mutation(),
            receipt.after_journal_bytes(),
            after_digest,
        ),
        Err(JournalTransitionError::AfterDigestMismatch)
    );

    let mut after_bytes = *receipt.after_journal_bytes();
    after_bytes[16] ^= 1;
    assert!(verify_journal_transition_parts(
        receipt.before_journal_bytes(),
        receipt.before_journal_digest(),
        receipt.mutation(),
        &after_bytes,
        receipt.after_journal_digest(),
    )
    .is_err());
}

#[test]
fn cross_operation_and_cross_plan_after_snapshots_cannot_substitute() {
    let first = prepare(&initial_journal(&deposit_plan(), 14), confirmed(0));
    let other_operation = prepare(&initial_journal(&deposit_plan(), 15), confirmed(0));
    assert_eq!(
        verify_journal_transition_parts(
            first.before_journal_bytes(),
            first.before_journal_digest(),
            first.mutation(),
            other_operation.after_journal_bytes(),
            other_operation.after_journal_digest(),
        ),
        Err(JournalTransitionError::AfterSnapshotMismatch)
    );

    let other_plan = prepare(&initial_journal(&transfer_plan(), 14), confirmed(0));
    assert_eq!(
        verify_journal_transition_parts(
            first.before_journal_bytes(),
            first.before_journal_digest(),
            first.mutation(),
            other_plan.after_journal_bytes(),
            other_plan.after_journal_digest(),
        ),
        Err(JournalTransitionError::AfterSnapshotMismatch)
    );
}

#[test]
fn separately_valid_nonadjacent_snapshot_cannot_skip_a_transition() {
    let initial = initial_journal(&transfer_plan(), 18);
    let first = prepare(&initial, confirmed(0));
    let after_first = receipt_after(&first);
    let second = prepare(&after_first, confirmed(1));

    assert_eq!(
        verify_journal_transition_parts(
            first.before_journal_bytes(),
            first.before_journal_digest(),
            confirmed(0),
            second.after_journal_bytes(),
            second.after_journal_digest(),
        ),
        Err(JournalTransitionError::AfterSnapshotMismatch)
    );
}

#[test]
fn terminal_and_recovery_prefix_adversaries_remain_lifecycle_errors() {
    let plan = deposit_plan();
    let completed = receipt_after(&prepare(&initial_journal(&plan, 16), confirmed(0)));
    assert_eq!(
        prepare_journal_transition(
            &completed,
            operation_journal_digest(&completed).unwrap(),
            confirmed(0),
        ),
        Err(JournalTransitionError::Lifecycle(
            PrivacyVaultError::JournalAlreadyTerminal
        ))
    );

    let unknown = receipt_after(&prepare(
        &initial_journal(&plan, 17),
        JournalTransitionMutation::RecordStep {
            step_index: 0,
            observation: JournalStepObservation::ResultUnknown,
        },
    ));
    assert_eq!(
        prepare_journal_transition(
            &unknown,
            operation_journal_digest(&unknown).unwrap(),
            JournalTransitionMutation::Recover {
                confirmed_step_count: 2,
                observed_open_proof_contexts: 0,
            },
        ),
        Err(JournalTransitionError::Lifecycle(
            PrivacyVaultError::JournalRecoveryInconsistent
        ))
    );
}

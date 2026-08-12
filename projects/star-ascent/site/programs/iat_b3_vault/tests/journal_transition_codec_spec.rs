use iat_b3_vault::journal_codec::{decode_operation_journal, operation_journal_digest};
use iat_b3_vault::journal_transition::{
    prepare_journal_transition, JournalTransitionError, JournalTransitionMutation,
    JournalTransitionReceipt,
};
use iat_b3_vault::journal_transition_codec::{
    decode_journal_transition_receipt, encode_journal_transition_receipt,
    JournalTransitionCodecError, JOURNAL_TRANSITION_RECEIPT_BYTES_LEN,
    PRIVACY_JOURNAL_TRANSITION_CODEC_REFERENCE_STATUS, PRIVACY_JOURNAL_TRANSITION_CODEC_VERSION,
};
use iat_b3_vault::{
    create_operation_journal, AmountVisibility, JournalStepObservation, OperationJournal, PlanStep,
    PlanStepKind, PrivacyOperation, PrivacyOperationPlan, MAINNET_STATUS_HOLD, MAX_PLAN_STEPS,
    PRIVACY_VAULT_CLIENT_SCHEMA_VERSION,
};

const HEADER_LEN: usize = 16;
const RECEIPT_VERSION_OFFSET: usize = HEADER_LEN;
const MUTATION_KIND_OFFSET: usize = RECEIPT_VERSION_OFFSET + 1;
const ARGUMENT_0_OFFSET: usize = MUTATION_KIND_OFFSET + 1;
const ARGUMENT_1_OFFSET: usize = ARGUMENT_0_OFFSET + 1;
const BEFORE_DIGEST_OFFSET: usize = ARGUMENT_1_OFFSET + 1;
const BEFORE_JOURNAL_OFFSET: usize = BEFORE_DIGEST_OFFSET + 32;
const AFTER_DIGEST_OFFSET: usize = BEFORE_JOURNAL_OFFSET + 283;
const AFTER_JOURNAL_OFFSET: usize = AFTER_DIGEST_OFFSET + 32;

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

fn prepare(
    journal: &OperationJournal,
    mutation: JournalTransitionMutation,
) -> JournalTransitionReceipt {
    prepare_journal_transition(
        journal,
        operation_journal_digest(journal).expect("canonical digest"),
        mutation,
    )
    .expect("valid transition")
}

fn confirmed(step_index: u8) -> JournalTransitionMutation {
    JournalTransitionMutation::RecordStep {
        step_index,
        observation: JournalStepObservation::Confirmed,
    }
}

fn receipt_after(receipt: &JournalTransitionReceipt) -> OperationJournal {
    decode_operation_journal(receipt.after_journal_bytes()).expect("canonical after journal")
}

#[test]
fn record_step_frame_round_trips_and_freezes_every_offset() {
    let receipt = prepare(
        &initial_journal(&deposit_plan(), 0x0102_0304_0506_0708),
        confirmed(0),
    );
    let bytes = encode_journal_transition_receipt(&receipt).unwrap();

    assert_eq!(bytes.len(), JOURNAL_TRANSITION_RECEIPT_BYTES_LEN);
    assert_eq!(&bytes[..8], b"IATB3JTR");
    assert_eq!(bytes[8], PRIVACY_JOURNAL_TRANSITION_CODEC_VERSION);
    assert_eq!(bytes[9], 1);
    assert_eq!(&bytes[10..12], &[0, 0]);
    assert_eq!(
        &bytes[12..16],
        &((JOURNAL_TRANSITION_RECEIPT_BYTES_LEN - HEADER_LEN) as u32).to_be_bytes()
    );
    assert_eq!(bytes[RECEIPT_VERSION_OFFSET], 1);
    assert_eq!(bytes[MUTATION_KIND_OFFSET], 1);
    assert_eq!(bytes[ARGUMENT_0_OFFSET], 0);
    assert_eq!(bytes[ARGUMENT_1_OFFSET], 1);
    assert_eq!(
        &bytes[BEFORE_DIGEST_OFFSET..BEFORE_JOURNAL_OFFSET],
        &receipt.before_journal_digest()
    );
    assert_eq!(
        &bytes[BEFORE_JOURNAL_OFFSET..AFTER_DIGEST_OFFSET],
        receipt.before_journal_bytes()
    );
    assert_eq!(
        &bytes[AFTER_DIGEST_OFFSET..AFTER_JOURNAL_OFFSET],
        &receipt.after_journal_digest()
    );
    assert_eq!(
        &bytes[AFTER_JOURNAL_OFFSET..],
        receipt.after_journal_bytes()
    );
    let decoded = decode_journal_transition_receipt(&bytes).unwrap();
    assert_eq!(decoded, receipt);
    assert_eq!(encode_journal_transition_receipt(&decoded).unwrap(), bytes);
}

#[test]
fn all_record_observations_have_exact_discriminants_and_round_trip() {
    let initial = initial_journal(&deposit_plan(), 2);
    for (observation, discriminant) in [
        (JournalStepObservation::Confirmed, 1),
        (JournalStepObservation::FailedBeforeCommit, 2),
        (JournalStepObservation::ResultUnknown, 3),
    ] {
        let receipt = prepare(
            &initial,
            JournalTransitionMutation::RecordStep {
                step_index: 0,
                observation,
            },
        );
        let bytes = encode_journal_transition_receipt(&receipt).unwrap();
        assert_eq!(bytes[MUTATION_KIND_OFFSET], 1);
        assert_eq!(bytes[ARGUMENT_0_OFFSET], 0);
        assert_eq!(bytes[ARGUMENT_1_OFFSET], discriminant);
        assert_eq!(decode_journal_transition_receipt(&bytes).unwrap(), receipt);
    }
}

#[test]
fn recovery_frame_binds_confirmed_prefix_and_open_context_count() {
    let unknown_receipt = prepare(
        &initial_journal(&transfer_plan(), 3),
        JournalTransitionMutation::RecordStep {
            step_index: 0,
            observation: JournalStepObservation::ResultUnknown,
        },
    );
    let unknown = receipt_after(&unknown_receipt);
    let recovery = prepare(
        &unknown,
        JournalTransitionMutation::Recover {
            confirmed_step_count: 1,
            observed_open_proof_contexts: 3,
        },
    );
    let bytes = encode_journal_transition_receipt(&recovery).unwrap();

    assert_eq!(bytes[MUTATION_KIND_OFFSET], 2);
    assert_eq!(bytes[ARGUMENT_0_OFFSET], 1);
    assert_eq!(bytes[ARGUMENT_1_OFFSET], 3);
    assert_eq!(decode_journal_transition_receipt(&bytes).unwrap(), recovery);
}

#[test]
fn frame_truth_is_transport_only_and_every_external_fact_remains_hold() {
    let first = prepare(&initial_journal(&deposit_plan(), 4), confirmed(0));
    let second = prepare(&initial_journal(&deposit_plan(), 5), confirmed(0));
    let first_bytes = encode_journal_transition_receipt(&first).unwrap();
    let second_bytes = encode_journal_transition_receipt(&second).unwrap();

    assert_ne!(first_bytes, second_bytes);
    assert_eq!(
        PRIVACY_JOURNAL_TRANSITION_CODEC_REFERENCE_STATUS,
        "HOST_ONLY_CANONICAL_TRANSITION_TRANSPORT_NONACTIVATING"
    );
    for decoded in [
        decode_journal_transition_receipt(&first_bytes).unwrap(),
        decode_journal_transition_receipt(&second_bytes).unwrap(),
    ] {
        assert!(decoded.deterministic_transition_replay_verified());
        assert!(!decoded.durable_persistence_verified());
        assert!(!decoded.writer_confinement_verified());
        assert!(!decoded.authenticated_chain_observation_verified());
        assert!(!decoded.runtime_integration_verified());
        assert!(!decoded.devnet_lifecycle_verified());
        assert!(!decoded.activation_ready());
        assert!(decoded.mainnet_hold());
    }
}

#[test]
fn framing_rejects_length_magic_version_kind_reserved_and_payload_aliases() {
    let receipt = prepare(&initial_journal(&deposit_plan(), 6), confirmed(0));
    let bytes = encode_journal_transition_receipt(&receipt).unwrap();
    assert_eq!(
        decode_journal_transition_receipt(&bytes[..bytes.len() - 1]),
        Err(JournalTransitionCodecError::InvalidLength)
    );
    let mut long = bytes.to_vec();
    long.push(0);
    assert_eq!(
        decode_journal_transition_receipt(&long),
        Err(JournalTransitionCodecError::InvalidLength)
    );

    for (offset, expected) in [
        (0, JournalTransitionCodecError::InvalidMagic),
        (8, JournalTransitionCodecError::UnsupportedVersion),
        (9, JournalTransitionCodecError::InvalidRecordKind),
        (10, JournalTransitionCodecError::NonCanonicalReserved),
        (11, JournalTransitionCodecError::NonCanonicalReserved),
        (15, JournalTransitionCodecError::InvalidPayloadLength),
    ] {
        let mut drift = bytes;
        drift[offset] ^= 1;
        assert_eq!(decode_journal_transition_receipt(&drift), Err(expected));
    }
}

#[test]
fn receipt_version_mutation_kind_and_observation_aliases_fail_closed() {
    let receipt = prepare(&initial_journal(&deposit_plan(), 7), confirmed(0));
    let bytes = encode_journal_transition_receipt(&receipt).unwrap();

    let mut version = bytes;
    version[RECEIPT_VERSION_OFFSET] = 2;
    assert_eq!(
        decode_journal_transition_receipt(&version),
        Err(JournalTransitionCodecError::UnsupportedReceiptVersion)
    );

    for kind in [0, 3, u8::MAX] {
        let mut mutation = bytes;
        mutation[MUTATION_KIND_OFFSET] = kind;
        assert_eq!(
            decode_journal_transition_receipt(&mutation),
            Err(JournalTransitionCodecError::InvalidMutationKind)
        );
    }
    for observation in [0, 4, u8::MAX] {
        let mut mutation = bytes;
        mutation[ARGUMENT_1_OFFSET] = observation;
        assert_eq!(
            decode_journal_transition_receipt(&mutation),
            Err(JournalTransitionCodecError::InvalidObservation)
        );
    }
}

#[test]
fn before_and_after_digest_or_snapshot_drift_cannot_decode() {
    let receipt = prepare(&initial_journal(&deposit_plan(), 8), confirmed(0));
    let bytes = encode_journal_transition_receipt(&receipt).unwrap();

    for offset in [
        BEFORE_DIGEST_OFFSET,
        BEFORE_JOURNAL_OFFSET,
        AFTER_DIGEST_OFFSET,
        AFTER_JOURNAL_OFFSET,
    ] {
        let mut drift = bytes;
        drift[offset] ^= 0x80;
        assert!(decode_journal_transition_receipt(&drift).is_err());
    }
}

#[test]
fn mutation_relabel_and_cross_operation_endpoint_substitution_fail_closed() {
    let first = prepare(&initial_journal(&deposit_plan(), 9), confirmed(0));
    let other = prepare(&initial_journal(&deposit_plan(), 10), confirmed(0));
    let mut relabeled = encode_journal_transition_receipt(&first).unwrap();
    relabeled[ARGUMENT_1_OFFSET] = 2;
    assert_eq!(
        decode_journal_transition_receipt(&relabeled),
        Err(JournalTransitionCodecError::ReceiptComponentMismatch)
    );

    let other_bytes = encode_journal_transition_receipt(&other).unwrap();
    let mut substituted = encode_journal_transition_receipt(&first).unwrap();
    substituted[AFTER_DIGEST_OFFSET..].copy_from_slice(&other_bytes[AFTER_DIGEST_OFFSET..]);
    assert_eq!(
        decode_journal_transition_receipt(&substituted),
        Err(JournalTransitionCodecError::ReceiptComponentMismatch)
    );
}

#[test]
fn separately_valid_nonadjacent_after_snapshot_cannot_skip_a_transition() {
    let initial = initial_journal(&transfer_plan(), 11);
    let first = prepare(&initial, confirmed(0));
    let after_first = receipt_after(&first);
    let second = prepare(&after_first, confirmed(1));
    let second_bytes = encode_journal_transition_receipt(&second).unwrap();
    let mut skipped = encode_journal_transition_receipt(&first).unwrap();
    skipped[AFTER_DIGEST_OFFSET..].copy_from_slice(&second_bytes[AFTER_DIGEST_OFFSET..]);

    assert_eq!(
        decode_journal_transition_receipt(&skipped),
        Err(JournalTransitionCodecError::ReceiptComponentMismatch)
    );
}

#[test]
fn recover_argument_drift_is_replayed_not_accepted_as_opaque_metadata() {
    let unknown_receipt = prepare(
        &initial_journal(&deposit_plan(), 12),
        JournalTransitionMutation::RecordStep {
            step_index: 0,
            observation: JournalStepObservation::ResultUnknown,
        },
    );
    let unknown = receipt_after(&unknown_receipt);
    let recovery = prepare(
        &unknown,
        JournalTransitionMutation::Recover {
            confirmed_step_count: 1,
            observed_open_proof_contexts: 0,
        },
    );
    let mut bytes = encode_journal_transition_receipt(&recovery).unwrap();
    bytes[ARGUMENT_0_OFFSET] = 2;

    assert_eq!(
        decode_journal_transition_receipt(&bytes),
        Err(JournalTransitionCodecError::Transition(
            JournalTransitionError::Lifecycle(
                iat_b3_vault::PrivacyVaultError::JournalRecoveryInconsistent
            )
        ))
    );
}

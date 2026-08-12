use iat_b3_vault::journal_codec::{
    decode_operation_journal, decode_privacy_operation_plan, encode_operation_journal,
    encode_privacy_operation_plan, operation_journal_digest, privacy_operation_plan_digest,
    JournalCodecError, OPERATION_JOURNAL_BYTES_LEN, PRIVACY_JOURNAL_CODEC_REFERENCE_STATUS,
    PRIVACY_OPERATION_PLAN_BYTES_LEN,
};
use iat_b3_vault::{
    create_operation_journal, record_operation_step, AmountVisibility, JournalStepObservation,
    OperationJournalStatus, PlanStep, PlanStepKind, PrivacyOperation, PrivacyOperationPlan,
    MAINNET_STATUS_HOLD, MAX_PLAN_STEPS, PRIVACY_VAULT_CLIENT_SCHEMA_VERSION,
};

const HEADER_LEN: usize = 16;
const PLAN_PAYLOAD_LEN: usize = PRIVACY_OPERATION_PLAN_BYTES_LEN - HEADER_LEN;
const PLAN_OPERATION_OFFSET: usize = 17;
const PLAN_FIRST_SOURCE_BYTE_OFFSET: usize = 18;
const PLAN_STEP_COUNT_OFFSET: usize = 114;
const PLAN_STEPS_OFFSET: usize = 115;
const STEP_LEN: usize = 14;
const PLAN_FLAGS_OFFSET: usize = PLAN_STEPS_OFFSET + STEP_LEN * MAX_PLAN_STEPS;
const PLAN_MAXIMUM_COUNTER_OFFSET: usize = PLAN_FLAGS_OFFSET + 8;
const PLAN_EXPECTED_COUNTER_TAG_OFFSET: usize = PLAN_MAXIMUM_COUNTER_OFFSET + 8;
const PLAN_EXPECTED_COUNTER_VALUE_OFFSET: usize = PLAN_EXPECTED_COUNTER_TAG_OFFSET + 1;
const PLAN_PERMISSION_TAG_OFFSET: usize = PLAN_EXPECTED_COUNTER_VALUE_OFFSET + 8;
const PLAN_PERMISSION_VALUE_OFFSET: usize = PLAN_PERMISSION_TAG_OFFSET + 1;
const PLAN_BINDING_OFFSET: usize = PLAN_PERMISSION_VALUE_OFFSET + 1;
const PLAN_RUNTIME_AUTH_OFFSET: usize = PLAN_BINDING_OFFSET + 32;
const PLAN_MAINNET_HOLD_OFFSET: usize = PLAN_RUNTIME_AUTH_OFFSET + 5;
const JOURNAL_OPERATION_ID_OFFSET: usize = HEADER_LEN;
const JOURNAL_PLAN_PAYLOAD_OFFSET: usize = JOURNAL_OPERATION_ID_OFFSET + 8;
const JOURNAL_PLAN_DIGEST_OFFSET: usize = JOURNAL_PLAN_PAYLOAD_OFFSET + PLAN_PAYLOAD_LEN;
const JOURNAL_NEXT_STEP_OFFSET: usize = JOURNAL_PLAN_DIGEST_OFFSET + 32;
const JOURNAL_OPEN_CONTEXTS_OFFSET: usize = JOURNAL_NEXT_STEP_OFFSET + 1;
const JOURNAL_STATUS_OFFSET: usize = JOURNAL_OPEN_CONTEXTS_OFFSET + 1;
const JOURNAL_AUTHENTICATED_OBSERVATION_OFFSET: usize = JOURNAL_STATUS_OFFSET + 1;
const JOURNAL_MAINNET_HOLD_OFFSET: usize = JOURNAL_AUTHENTICATED_OBSERVATION_OFFSET + 3;
const TEST_AMOUNT: u64 = 0x0102_0304_0506_0708;
const TEST_OPERATION_ID: u64 = 0x1112_1314_1516_1718;

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
    proof_context_cleanup_required: bool,
    amount_visibility: AmountVisibility,
    cleartext_amount: u64,
) -> PlanStep {
    PlanStep {
        kind,
        owner_signature_required: true,
        invokes_daily_law_hook,
        changes_owner,
        proof_context_cleanup_required,
        amount_visibility,
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
                TEST_AMOUNT,
            ),
            EMPTY_STEP,
            EMPTY_STEP,
            EMPTY_STEP,
        ],
        1,
        true,
    )
}

fn configure_plan() -> PrivacyOperationPlan {
    let mut plan = base_plan(
        PrivacyOperation::ConfigureAccount,
        [
            step(
                PlanStepKind::ReallocateConfidentialExtension,
                false,
                false,
                false,
                AmountVisibility::None,
                0,
            ),
            step(
                PlanStepKind::CreateAndVerifyPubkeyValidityProofContext,
                false,
                false,
                true,
                AmountVisibility::None,
                0,
            ),
            step(
                PlanStepKind::ConfigureConfidentialAccount,
                false,
                false,
                true,
                AmountVisibility::None,
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
        ],
        4,
        true,
    );
    plan.maximum_pending_balance_credit_counter = 65_535;
    plan.operation_binding = key(0x44);
    plan
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
    plan.operation_binding = key(0x55);
    plan
}

fn apply_pending_plan() -> PrivacyOperationPlan {
    let mut plan = base_plan(
        PrivacyOperation::ApplyPendingBalance,
        [
            step(
                PlanStepKind::ApplyPendingBalance,
                false,
                false,
                false,
                AmountVisibility::ConfidentialClientOnly,
                0,
            ),
            EMPTY_STEP,
            EMPTY_STEP,
            EMPTY_STEP,
        ],
        1,
        true,
    );
    plan.expected_pending_balance_credit_counter = Some(0x2122_2324_2526_2728);
    plan
}

fn withdraw_plan() -> PrivacyOperationPlan {
    let mut plan = base_plan(
        PrivacyOperation::Withdraw,
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
                PlanStepKind::WithdrawConfidentialToPublic,
                false,
                false,
                true,
                AmountVisibility::PublicCleartext,
                TEST_AMOUNT,
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
        true,
    );
    plan.operation_binding = key(0x66);
    plan
}

fn credit_plan(operation: PrivacyOperation, enabled: bool) -> PrivacyOperationPlan {
    let kind = match (operation, enabled) {
        (PrivacyOperation::SetConfidentialCredits, true) => PlanStepKind::EnableConfidentialCredits,
        (PrivacyOperation::SetConfidentialCredits, false) => {
            PlanStepKind::DisableConfidentialCredits
        }
        (PrivacyOperation::SetNonConfidentialCredits, true) => {
            PlanStepKind::EnableNonConfidentialCredits
        }
        (PrivacyOperation::SetNonConfidentialCredits, false) => {
            PlanStepKind::DisableNonConfidentialCredits
        }
        _ => panic!("credit plan requires a credit operation"),
    };
    let mut plan = base_plan(
        operation,
        [
            step(kind, false, false, false, AmountVisibility::None, 0),
            EMPTY_STEP,
            EMPTY_STEP,
            EMPTY_STEP,
        ],
        1,
        true,
    );
    plan.requested_credit_permission = Some(enabled);
    plan
}

fn empty_close_plan() -> PrivacyOperationPlan {
    let mut plan = base_plan(
        PrivacyOperation::EmptyAndCloseAccount,
        [
            step(
                PlanStepKind::CreateAndVerifyEmptyAccountProofContext,
                false,
                false,
                true,
                AmountVisibility::ConfidentialClientOnly,
                0,
            ),
            step(
                PlanStepKind::EmptyConfidentialAccount,
                false,
                false,
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
            step(
                PlanStepKind::CloseTokenAccount,
                false,
                false,
                false,
                AmountVisibility::None,
                0,
            ),
        ],
        4,
        true,
    );
    plan.operation_binding = key(0x77);
    plan
}

fn cleanup_plan() -> PrivacyOperationPlan {
    base_plan(
        PrivacyOperation::CleanupProofContexts,
        [
            step(
                PlanStepKind::CloseProofContexts,
                false,
                false,
                false,
                AmountVisibility::None,
                0,
            ),
            EMPTY_STEP,
            EMPTY_STEP,
            EMPTY_STEP,
        ],
        1,
        true,
    )
}

fn all_plan_variants() -> [PrivacyOperationPlan; 11] {
    [
        configure_plan(),
        deposit_plan(),
        transfer_plan(),
        apply_pending_plan(),
        withdraw_plan(),
        credit_plan(PrivacyOperation::SetConfidentialCredits, true),
        credit_plan(PrivacyOperation::SetConfidentialCredits, false),
        credit_plan(PrivacyOperation::SetNonConfidentialCredits, true),
        credit_plan(PrivacyOperation::SetNonConfidentialCredits, false),
        empty_close_plan(),
        cleanup_plan(),
    ]
}

#[test]
fn every_plan_and_step_discriminant_round_trips_in_one_fixed_frame() {
    assert_eq!(
        PRIVACY_JOURNAL_CODEC_REFERENCE_STATUS,
        "HOST_ONLY_CANONICAL_BYTES_AND_CONTENT_DIGEST_NONACTIVATING"
    );
    for plan in all_plan_variants() {
        let bytes = encode_privacy_operation_plan(&plan).unwrap();
        assert_eq!(bytes.len(), PRIVACY_OPERATION_PLAN_BYTES_LEN);
        assert_eq!(decode_privacy_operation_plan(&bytes), Ok(plan));
        assert!(!plan.runtime_authentication_verified);
        assert!(!plan.exact_client_adapter_verified);
        assert!(!plan.durable_resume_and_cleanup_verified);
        assert!(!plan.devnet_lifecycle_verified);
        assert!(!plan.activation_ready);
        assert!(plan.mainnet_hold);
    }
}

#[test]
fn plan_frame_freezes_big_endian_u64s_inactive_zeroes_and_digest() {
    let plan = deposit_plan();
    let bytes = encode_privacy_operation_plan(&plan).unwrap();
    assert_eq!(&bytes[..8], b"IATB3PJC");
    assert_eq!(&bytes[8..12], &[1, 1, 0, 0]);
    assert_eq!(&bytes[12..16], &(PLAN_PAYLOAD_LEN as u32).to_be_bytes());
    assert_eq!(bytes[PLAN_STEP_COUNT_OFFSET], 1);
    assert_eq!(
        &bytes[PLAN_STEPS_OFFSET + 6..PLAN_STEPS_OFFSET + 14],
        &TEST_AMOUNT.to_be_bytes()
    );
    assert!(bytes[PLAN_STEPS_OFFSET + STEP_LEN..PLAN_FLAGS_OFFSET]
        .iter()
        .all(|value| *value == 0));
    assert_eq!(
        privacy_operation_plan_digest(&plan).unwrap(),
        [
            0xe0, 0xab, 0xe3, 0x11, 0xab, 0xee, 0xe9, 0xc8, 0xad, 0x4c, 0xe8, 0x8e, 0x5f, 0x01,
            0xf0, 0xd9, 0x5e, 0xfa, 0xf4, 0x25, 0x08, 0xf5, 0x15, 0x77, 0xbb, 0xd4, 0xd2, 0x10,
            0xda, 0xad, 0xb8, 0xb2,
        ]
    );
}

#[test]
fn journals_round_trip_initial_progress_terminal_and_recovery_states() {
    for (index, plan) in all_plan_variants().iter().enumerate() {
        let mut journal = create_operation_journal(plan, TEST_OPERATION_ID + index as u64).unwrap();
        let initial = encode_operation_journal(&journal).unwrap();
        assert_eq!(decode_operation_journal(&initial), Ok(journal));
        for step_index in 0..plan.step_count {
            record_operation_step(
                plan,
                &mut journal,
                step_index,
                JournalStepObservation::Confirmed,
            )
            .unwrap();
        }
        assert_eq!(journal.status, OperationJournalStatus::Completed);
        let completed = encode_operation_journal(&journal).unwrap();
        assert_eq!(decode_operation_journal(&completed), Ok(journal));
    }

    let transfer = transfer_plan();
    let mut recovery = create_operation_journal(&transfer, 70).unwrap();
    record_operation_step(
        &transfer,
        &mut recovery,
        0,
        JournalStepObservation::Confirmed,
    )
    .unwrap();
    record_operation_step(
        &transfer,
        &mut recovery,
        1,
        JournalStepObservation::ResultUnknown,
    )
    .unwrap();
    assert_eq!(recovery.status, OperationJournalStatus::RecoveryRequired);
    assert_eq!(
        decode_operation_journal(&encode_operation_journal(&recovery).unwrap()),
        Ok(recovery)
    );

    let mut cleanup = create_operation_journal(&transfer, 71).unwrap();
    record_operation_step(
        &transfer,
        &mut cleanup,
        0,
        JournalStepObservation::Confirmed,
    )
    .unwrap();
    record_operation_step(
        &transfer,
        &mut cleanup,
        1,
        JournalStepObservation::FailedBeforeCommit,
    )
    .unwrap();
    assert_eq!(cleanup.status, OperationJournalStatus::CleanupRequired);
    assert_eq!(
        decode_operation_journal(&encode_operation_journal(&cleanup).unwrap()),
        Ok(cleanup)
    );

    let deposit = deposit_plan();
    let mut aborted = create_operation_journal(&deposit, 72).unwrap();
    record_operation_step(
        &deposit,
        &mut aborted,
        0,
        JournalStepObservation::FailedBeforeCommit,
    )
    .unwrap();
    assert_eq!(aborted.status, OperationJournalStatus::Aborted);
    assert_eq!(
        decode_operation_journal(&encode_operation_journal(&aborted).unwrap()),
        Ok(aborted)
    );
}

#[test]
fn journal_frame_binds_exact_plan_digest_and_big_endian_operation_id() {
    let plan = deposit_plan();
    let journal = create_operation_journal(&plan, TEST_OPERATION_ID).unwrap();
    let plan_bytes = encode_privacy_operation_plan(&plan).unwrap();
    let bytes = encode_operation_journal(&journal).unwrap();
    assert_eq!(bytes.len(), OPERATION_JOURNAL_BYTES_LEN);
    assert_eq!(&bytes[..8], b"IATB3PJC");
    assert_eq!(&bytes[8..12], &[1, 2, 0, 0]);
    assert_eq!(
        &bytes[12..16],
        &((OPERATION_JOURNAL_BYTES_LEN - HEADER_LEN) as u32).to_be_bytes()
    );
    assert_eq!(
        &bytes[JOURNAL_OPERATION_ID_OFFSET..JOURNAL_PLAN_PAYLOAD_OFFSET],
        &TEST_OPERATION_ID.to_be_bytes()
    );
    assert_eq!(
        &bytes[JOURNAL_PLAN_PAYLOAD_OFFSET..JOURNAL_PLAN_DIGEST_OFFSET],
        &plan_bytes[HEADER_LEN..]
    );
    assert_eq!(
        &bytes[JOURNAL_PLAN_DIGEST_OFFSET..JOURNAL_NEXT_STEP_OFFSET],
        &privacy_operation_plan_digest(&plan).unwrap()
    );
    assert_eq!(
        operation_journal_digest(&journal).unwrap(),
        [
            0x3a, 0xf2, 0x02, 0x07, 0xa2, 0xc6, 0x5f, 0x6b, 0xee, 0x84, 0x49, 0x04, 0xdc, 0x1f,
            0x79, 0xd1, 0x7b, 0x36, 0x8a, 0xad, 0xc2, 0xb9, 0x9b, 0x4b, 0x1b, 0xfb, 0x65, 0x1d,
            0xbb, 0xc3, 0xe6, 0x60,
        ]
    );
}

#[test]
fn framing_rejects_short_long_magic_version_kind_reserved_and_length_aliases() {
    let plan = deposit_plan();
    let bytes = encode_privacy_operation_plan(&plan).unwrap();
    assert_eq!(
        decode_privacy_operation_plan(&bytes[..bytes.len() - 1]),
        Err(JournalCodecError::InvalidLength)
    );
    let mut trailing = bytes.to_vec();
    trailing.push(0);
    assert_eq!(
        decode_privacy_operation_plan(&trailing),
        Err(JournalCodecError::InvalidLength)
    );
    for (offset, expected) in [
        (0, JournalCodecError::InvalidMagic),
        (8, JournalCodecError::UnsupportedVersion),
        (9, JournalCodecError::InvalidRecordKind),
        (10, JournalCodecError::NonCanonicalReserved),
        (11, JournalCodecError::NonCanonicalReserved),
    ] {
        let mut drifted = bytes;
        drifted[offset] ^= 0x80;
        assert_eq!(decode_privacy_operation_plan(&drifted), Err(expected));
    }
    let mut wrong_length = bytes;
    wrong_length[12..16].copy_from_slice(&(PLAN_PAYLOAD_LEN as u32).to_le_bytes());
    assert_eq!(
        decode_privacy_operation_plan(&wrong_length),
        Err(JournalCodecError::InvalidPayloadLength)
    );

    let journal = create_operation_journal(&plan, TEST_OPERATION_ID).unwrap();
    let journal_bytes = encode_operation_journal(&journal).unwrap();
    assert_eq!(
        decode_operation_journal(&journal_bytes[..journal_bytes.len() - 1]),
        Err(JournalCodecError::InvalidLength)
    );
    let mut journal_trailing = journal_bytes.to_vec();
    journal_trailing.push(0);
    assert_eq!(
        decode_operation_journal(&journal_trailing),
        Err(JournalCodecError::InvalidLength)
    );
}

#[test]
fn plan_discriminants_booleans_options_and_unused_steps_are_canonical() {
    let plan = deposit_plan();
    let bytes = encode_privacy_operation_plan(&plan).unwrap();
    for (offset, value, expected) in [
        (
            PLAN_OPERATION_OFFSET,
            0,
            JournalCodecError::InvalidDiscriminant,
        ),
        (
            PLAN_OPERATION_OFFSET,
            u8::MAX,
            JournalCodecError::InvalidDiscriminant,
        ),
        (PLAN_FLAGS_OFFSET, 2, JournalCodecError::InvalidBoolean),
        (
            PLAN_EXPECTED_COUNTER_VALUE_OFFSET + 7,
            1,
            JournalCodecError::NonCanonicalOption,
        ),
        (
            PLAN_PERMISSION_VALUE_OFFSET,
            1,
            JournalCodecError::NonCanonicalOption,
        ),
        (
            PLAN_STEPS_OFFSET + STEP_LEN + 1,
            1,
            JournalCodecError::NonCanonicalZero,
        ),
        (
            PLAN_RUNTIME_AUTH_OFFSET,
            1,
            JournalCodecError::InvalidPlanShape,
        ),
        (
            PLAN_MAINNET_HOLD_OFFSET,
            0,
            JournalCodecError::InvalidPlanShape,
        ),
    ] {
        let mut drifted = bytes;
        drifted[offset] = value;
        assert_eq!(decode_privacy_operation_plan(&drifted), Err(expected));
    }

    let mut nonzero_inactive_step = plan;
    nonzero_inactive_step.steps[1].cleartext_amount = 1;
    assert_eq!(
        encode_privacy_operation_plan(&nonzero_inactive_step),
        Err(JournalCodecError::NonCanonicalZero)
    );
    let mut promoted = plan;
    promoted.runtime_authentication_verified = true;
    assert_eq!(
        encode_privacy_operation_plan(&promoted),
        Err(JournalCodecError::InvalidPlanShape)
    );

    let apply = encode_privacy_operation_plan(&apply_pending_plan()).unwrap();
    assert_eq!(apply[PLAN_EXPECTED_COUNTER_TAG_OFFSET], 1);
    assert_eq!(
        &apply[PLAN_EXPECTED_COUNTER_VALUE_OFFSET..PLAN_PERMISSION_TAG_OFFSET],
        &0x2122_2324_2526_2728u64.to_be_bytes()
    );
    let disabled = encode_privacy_operation_plan(&credit_plan(
        PrivacyOperation::SetConfidentialCredits,
        false,
    ))
    .unwrap();
    assert_eq!(disabled[PLAN_PERMISSION_TAG_OFFSET], 1);
    assert_eq!(disabled[PLAN_PERMISSION_VALUE_OFFSET], 0);
}

#[test]
fn alternate_little_endian_u64_bytes_change_semantics_and_digest_not_representation() {
    let plan = deposit_plan();
    let bytes = encode_privacy_operation_plan(&plan).unwrap();
    let amount_offset = PLAN_STEPS_OFFSET + 6;
    let mut little_endian = bytes;
    little_endian[amount_offset..amount_offset + 8].copy_from_slice(&TEST_AMOUNT.to_le_bytes());
    let decoded = decode_privacy_operation_plan(&little_endian).unwrap();
    assert_eq!(decoded.steps[0].cleartext_amount, TEST_AMOUNT.swap_bytes());
    assert_ne!(decoded, plan);
    assert_ne!(
        privacy_operation_plan_digest(&decoded).unwrap(),
        privacy_operation_plan_digest(&plan).unwrap()
    );
}

#[test]
fn journal_rejects_zero_id_impossible_progress_truth_overclaim_and_discriminant_drift() {
    let plan = deposit_plan();
    let journal = create_operation_journal(&plan, TEST_OPERATION_ID).unwrap();
    let bytes = encode_operation_journal(&journal).unwrap();
    let mut cases = [
        (bytes, JournalCodecError::InvalidJournalShape),
        (bytes, JournalCodecError::InvalidJournalShape),
        (bytes, JournalCodecError::InvalidJournalShape),
        (bytes, JournalCodecError::InvalidDiscriminant),
        (bytes, JournalCodecError::InvalidBoolean),
        (bytes, JournalCodecError::InvalidJournalShape),
    ];
    cases[0].0[JOURNAL_OPERATION_ID_OFFSET..JOURNAL_PLAN_PAYLOAD_OFFSET].fill(0);
    cases[1].0[JOURNAL_NEXT_STEP_OFFSET] = 1;
    cases[2].0[JOURNAL_OPEN_CONTEXTS_OFFSET] = 1;
    cases[3].0[JOURNAL_STATUS_OFFSET] = 0;
    cases[4].0[JOURNAL_AUTHENTICATED_OBSERVATION_OFFSET] = 2;
    cases[5].0[JOURNAL_MAINNET_HOLD_OFFSET] = 0;
    for (drifted, expected) in cases {
        assert_eq!(decode_operation_journal(&drifted), Err(expected));
    }

    let mut overclaimed = journal;
    overclaimed.durable_persistence_verified = true;
    assert_eq!(
        encode_operation_journal(&overclaimed),
        Err(JournalCodecError::InvalidJournalShape)
    );
}

#[test]
fn bit_flips_and_cross_plan_substitution_cannot_preserve_the_same_binding() {
    let plan = deposit_plan();
    let original_digest = privacy_operation_plan_digest(&plan).unwrap();
    let mut changed_key = encode_privacy_operation_plan(&plan).unwrap();
    changed_key[PLAN_FIRST_SOURCE_BYTE_OFFSET] ^= 1;
    let changed_plan = decode_privacy_operation_plan(&changed_key).unwrap();
    assert_ne!(changed_plan, plan);
    assert_ne!(
        privacy_operation_plan_digest(&changed_plan).unwrap(),
        original_digest
    );

    let journal = create_operation_journal(&plan, TEST_OPERATION_ID).unwrap();
    let mut changed_digest = encode_operation_journal(&journal).unwrap();
    changed_digest[JOURNAL_PLAN_DIGEST_OFFSET] ^= 1;
    assert_eq!(
        decode_operation_journal(&changed_digest),
        Err(JournalCodecError::BoundPlanDigestMismatch)
    );

    let other = cleanup_plan();
    let other_bytes = encode_privacy_operation_plan(&other).unwrap();
    let mut cross_plan = encode_operation_journal(&journal).unwrap();
    cross_plan[JOURNAL_PLAN_PAYLOAD_OFFSET..JOURNAL_PLAN_DIGEST_OFFSET]
        .copy_from_slice(&other_bytes[HEADER_LEN..]);
    assert_eq!(
        decode_operation_journal(&cross_plan),
        Err(JournalCodecError::BoundPlanDigestMismatch)
    );
}

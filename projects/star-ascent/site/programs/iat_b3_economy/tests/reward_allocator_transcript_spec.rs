use iat_b3_economy::{
    decode_reward_allocator_batch, decode_reward_allocator_receipt, encode_reward_allocator_batch,
    encode_reward_allocator_receipt, validate_reward_allocator_transcript_binding,
    AllocatorDisposition, AllocatorReason, RewardAllocatorTranscriptError,
    ALLOCATOR_BATCH_TRANSCRIPT_LEN, ALLOCATOR_RECEIPT_TRANSCRIPT_LEN,
    REWARD_ALLOCATOR_TRANSCRIPT_MAINNET_STATUS, REWARD_ALLOCATOR_TRANSCRIPT_TRUTH,
};

const FIXTURE: &str =
    include_str!("../../../tests/fixtures/iat-b3-reward-allocator-transcript-v1.txt");

fn fixture_value(key: &str) -> &'static str {
    FIXTURE
        .lines()
        .find_map(|line| {
            line.strip_prefix(key)
                .and_then(|value| value.strip_prefix('='))
        })
        .unwrap_or_else(|| panic!("missing fixture key {key}"))
}

fn hex_bytes(value: &str) -> Vec<u8> {
    assert_eq!(value.len() % 2, 0, "fixture hex must have pairs");
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let high = (pair[0] as char).to_digit(16).expect("hex high nibble");
            let low = (pair[1] as char).to_digit(16).expect("hex low nibble");
            ((high << 4) | low) as u8
        })
        .collect()
}

fn digest(value: &str) -> [u8; 32] {
    hex_bytes(value).try_into().expect("fixture digest length")
}

fn replace_once(source: &[u8], needle: &[u8], replacement: &[u8]) -> Vec<u8> {
    let start = source
        .windows(needle.len())
        .position(|window| window == needle)
        .unwrap_or_else(|| {
            panic!(
                "missing replacement marker {}",
                String::from_utf8_lossy(needle)
            )
        });
    [
        &source[..start],
        replacement,
        &source[start + needle.len()..],
    ]
    .concat()
}

fn batch() -> Vec<u8> {
    hex_bytes(fixture_value("batch"))
}

fn receipts() -> [Vec<u8>; 3] {
    [
        hex_bytes(fixture_value("receipt.0")),
        hex_bytes(fixture_value("receipt.1")),
        hex_bytes(fixture_value("receipt.2")),
    ]
}

fn reference_receipts() -> [[u8; 32]; 3] {
    [
        digest(fixture_value("reference_receipt.0")),
        digest(fixture_value("reference_receipt.1")),
        digest(fixture_value("reference_receipt.2")),
    ]
}

fn reference_cores() -> [Vec<u8>; 3] {
    [
        hex_bytes(fixture_value("reference_core.0")),
        hex_bytes(fixture_value("reference_core.1")),
        hex_bytes(fixture_value("reference_core.2")),
    ]
}

#[test]
fn js_fixture_decodes_reencodes_and_binds_in_native_no_std_code() {
    let batch_bytes = batch();
    let receipt_bytes = receipts();
    let references = reference_receipts();
    let reference_cores = reference_cores();
    assert_eq!(batch_bytes.len(), ALLOCATOR_BATCH_TRANSCRIPT_LEN);
    assert!(receipt_bytes
        .iter()
        .all(|receipt| receipt.len() == ALLOCATOR_RECEIPT_TRANSCRIPT_LEN));

    let decoded_batch = decode_reward_allocator_batch(&batch_bytes).expect("decode JS batch");
    assert_eq!(decoded_batch.receipt_count, 3);
    assert_eq!(
        encode_reward_allocator_batch(&decoded_batch).expect("reencode batch"),
        batch_bytes.as_slice()
    );

    let expected = [
        (
            AllocatorDisposition::AdmittedReserved,
            AllocatorReason::None,
        ),
        (
            AllocatorDisposition::NullUnderfunded,
            AllocatorReason::ExactAmountNotAvailable,
        ),
        (
            AllocatorDisposition::NullBlocked,
            AllocatorReason::HigherPriorityOrEarlierObligationUnderfunded,
        ),
    ];
    for (index, bytes) in receipt_bytes.iter().enumerate() {
        let decoded = decode_reward_allocator_receipt(bytes).expect("decode JS receipt");
        assert_eq!((decoded.disposition, decoded.reason), expected[index]);
        assert_eq!(decoded.allocation_index, index as u32);
        assert_eq!(
            encode_reward_allocator_receipt(&decoded).expect("reencode receipt"),
            bytes.as_slice()
        );
        let binding = validate_reward_allocator_transcript_binding(
            &batch_bytes,
            bytes,
            &references,
            &reference_cores[index],
        )
        .expect("bind ordered JS receipt and exact reference core");
        assert_eq!(binding.receipt.reference_receipt_sha256, references[index]);
        assert_eq!(binding.reference_receipt.receipt_sha256, references[index]);
    }

    let truth = core::hint::black_box(REWARD_ALLOCATOR_TRANSCRIPT_TRUTH);
    assert!(truth.strict_no_std_decoder_present);
    assert!(truth.canonical_reencode_checked);
    assert!(truth.ordered_reference_binding_checked);
    assert!(!truth.runtime_authentication_verified);
    assert!(!truth.production_identity_bound);
    assert!(!truth.durable_account_writer_present);
    assert!(!truth.native_instruction_exposed);
    assert!(!truth.abi_or_dispatcher_exposed);
    assert!(!truth.activation_ready);
    assert!(truth.mainnet_hold);
    assert_eq!(REWARD_ALLOCATOR_TRANSCRIPT_MAINNET_STATUS, "HOLD");
}

#[test]
fn strict_decoders_reject_truncation_trailing_bytes_and_noncanonical_fields() {
    let batch_bytes = batch();
    let receipt_bytes = receipts()[0].clone();
    assert_eq!(
        decode_reward_allocator_batch(&batch_bytes[..batch_bytes.len() - 1]),
        Err(RewardAllocatorTranscriptError::InvalidLength)
    );
    let mut trailing = batch_bytes.clone();
    trailing.push(0);
    assert_eq!(
        decode_reward_allocator_batch(&trailing),
        Err(RewardAllocatorTranscriptError::InvalidLength)
    );
    assert_eq!(
        decode_reward_allocator_receipt(&receipt_bytes[..receipt_bytes.len() - 1]),
        Err(RewardAllocatorTranscriptError::InvalidLength)
    );
    let mut trailing = receipt_bytes.clone();
    trailing.push(0);
    assert_eq!(
        decode_reward_allocator_receipt(&trailing),
        Err(RewardAllocatorTranscriptError::InvalidLength)
    );

    for (offset, expected) in [
        (0, RewardAllocatorTranscriptError::WrongMagic),
        (8, RewardAllocatorTranscriptError::UnsupportedVersion),
        (9, RewardAllocatorTranscriptError::NonactivatingFlagRequired),
        (10, RewardAllocatorTranscriptError::UnsupportedHashSuite),
        (11, RewardAllocatorTranscriptError::ReservedBytesNonZero),
        (16, RewardAllocatorTranscriptError::PolicyDigestMismatch),
        (
            48,
            RewardAllocatorTranscriptError::DeploymentDomainNotReferenceSentinel,
        ),
        (316, RewardAllocatorTranscriptError::ReservedBytesNonZero),
    ] {
        let mut corrupt = batch_bytes.clone();
        corrupt[offset] ^= 0xff;
        assert_eq!(decode_reward_allocator_batch(&corrupt), Err(expected));
    }
    let mut non_midnight = batch_bytes.clone();
    non_midnight[80] ^= 1;
    assert_eq!(
        decode_reward_allocator_batch(&non_midnight),
        Err(RewardAllocatorTranscriptError::NonMidnightFundingRound)
    );

    for (offset, expected) in [
        (0, RewardAllocatorTranscriptError::WrongMagic),
        (8, RewardAllocatorTranscriptError::UnsupportedVersion),
        (9, RewardAllocatorTranscriptError::NonactivatingFlagRequired),
        (10, RewardAllocatorTranscriptError::UnsupportedHashSuite),
        (11, RewardAllocatorTranscriptError::ReservedBytesNonZero),
        (280, RewardAllocatorTranscriptError::UnsupportedDisposition),
        (281, RewardAllocatorTranscriptError::UnsupportedReason),
        (282, RewardAllocatorTranscriptError::NoncanonicalFactionFlag),
        (283, RewardAllocatorTranscriptError::ReservedBytesNonZero),
    ] {
        let mut corrupt = receipt_bytes.clone();
        corrupt[offset] = 0xff;
        assert_eq!(decode_reward_allocator_receipt(&corrupt), Err(expected));
    }
}

#[test]
fn receipt_arithmetic_and_disposition_rules_fail_closed() {
    let valid = receipts();

    let mut zero_amount = valid[0].clone();
    zero_amount[184..192].fill(0);
    assert_eq!(
        decode_reward_allocator_receipt(&zero_amount),
        Err(RewardAllocatorTranscriptError::ExactAmountZero)
    );

    let mut partial = valid[0].clone();
    partial[192..200].copy_from_slice(&599u64.to_le_bytes());
    assert_eq!(
        decode_reward_allocator_receipt(&partial),
        Err(RewardAllocatorTranscriptError::LanePlanMismatch)
    );

    let mut overflow = valid[0].clone();
    overflow[192..200].copy_from_slice(&u64::MAX.to_le_bytes());
    overflow[200..208].copy_from_slice(&1u64.to_le_bytes());
    assert_eq!(
        decode_reward_allocator_receipt(&overflow),
        Err(RewardAllocatorTranscriptError::LaneSumOverflow)
    );

    let mut funded_null = valid[1].clone();
    funded_null[192..200].copy_from_slice(&1u64.to_le_bytes());
    assert_eq!(
        decode_reward_allocator_receipt(&funded_null),
        Err(RewardAllocatorTranscriptError::LanePlanMismatch)
    );

    let mut mismatched_reason = valid[0].clone();
    mismatched_reason[281] = 1;
    assert_eq!(
        decode_reward_allocator_receipt(&mismatched_reason),
        Err(RewardAllocatorTranscriptError::DispositionReasonMismatch)
    );

    let mut absent_faction_with_bytes = valid[0].clone();
    absent_faction_with_bytes[248] = 1;
    assert_eq!(
        decode_reward_allocator_receipt(&absent_faction_with_bytes),
        Err(RewardAllocatorTranscriptError::FactionPresenceMismatch)
    );

    let mut present_zero_faction = valid[1].clone();
    present_zero_faction[248..280].fill(0);
    present_zero_faction[282] = 1;
    assert_eq!(
        decode_reward_allocator_receipt(&present_zero_faction),
        Err(RewardAllocatorTranscriptError::FactionPresenceMismatch)
    );
}

#[test]
fn ordered_membership_and_every_duplicated_batch_binding_are_enforced() {
    let batch_bytes = batch();
    let receipt_bytes = receipts();
    let references = reference_receipts();
    let reference_cores = reference_cores();

    let mut short = references.to_vec();
    short.pop();
    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &receipt_bytes[0],
            &short,
            &reference_cores[0],
        ),
        Err(RewardAllocatorTranscriptError::ReceiptCountMismatch)
    );

    let duplicates = [references[0], references[0], references[2]];
    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &receipt_bytes[0],
            &duplicates,
            &reference_cores[0],
        ),
        Err(RewardAllocatorTranscriptError::DuplicateReferenceReceipt)
    );

    let reordered = [references[1], references[0], references[2]];
    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &receipt_bytes[0],
            &reordered,
            &reference_cores[0],
        ),
        Err(RewardAllocatorTranscriptError::ReceiptSetDigestMismatch)
    );

    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &receipt_bytes[1],
            &[references[0], references[2], references[1]],
            &reference_cores[1],
        ),
        Err(RewardAllocatorTranscriptError::ReceiptSetDigestMismatch)
    );

    for (offset, expected) in [
        (16, RewardAllocatorTranscriptError::BatchCommitmentMismatch),
        (56, RewardAllocatorTranscriptError::SealMismatch),
        (
            88,
            RewardAllocatorTranscriptError::ReferenceFinalizationMismatch,
        ),
    ] {
        let mut corrupt = receipt_bytes[0].clone();
        corrupt[offset] ^= 1;
        assert_eq!(
            validate_reward_allocator_transcript_binding(
                &batch_bytes,
                &corrupt,
                &references,
                &reference_cores[0],
            ),
            Err(expected)
        );
    }

    let mut wrong_round = receipt_bytes[0].clone();
    let decoded = decode_reward_allocator_receipt(&wrong_round).expect("valid round");
    wrong_round[48..56]
        .copy_from_slice(&(decoded.funding_round_at_unix_seconds + 86_400).to_le_bytes());
    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &wrong_round,
            &references,
            &reference_cores[0],
        ),
        Err(RewardAllocatorTranscriptError::FundingRoundMismatch)
    );

    let mut out_of_range = receipt_bytes[0].clone();
    out_of_range[284..288].copy_from_slice(&3u32.to_le_bytes());
    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &out_of_range,
            &references,
            &reference_cores[0],
        ),
        Err(RewardAllocatorTranscriptError::AllocationIndexOutOfRange)
    );

    let mut wrong_index = receipt_bytes[0].clone();
    wrong_index[284..288].copy_from_slice(&1u32.to_le_bytes());
    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &wrong_index,
            &references,
            &reference_cores[1],
        ),
        Err(RewardAllocatorTranscriptError::ReceiptMembershipMismatch)
    );
}

#[test]
fn member_digest_cannot_mask_any_forged_reference_decision_semantics() {
    let batch_bytes = batch();
    let receipts = receipts();
    let references = reference_receipts();
    let cores = reference_cores();

    let assert_semantic_rejection = |bytes: &[u8], core: &[u8], expected| {
        assert_eq!(
            validate_reward_allocator_transcript_binding(&batch_bytes, bytes, &references, core,),
            Err(expected),
        );
    };

    let mut obligation_id = receipts[0].clone();
    obligation_id[120] ^= 1;
    assert_semantic_rejection(
        &obligation_id,
        &cores[0],
        RewardAllocatorTranscriptError::ReferenceObligationIdMismatch,
    );

    let mut obligation = receipts[0].clone();
    obligation[152] ^= 1;
    assert_semantic_rejection(
        &obligation,
        &cores[0],
        RewardAllocatorTranscriptError::ReferenceObligationMismatch,
    );

    let mut exact_amount = receipts[0].clone();
    exact_amount[184..192].copy_from_slice(&601u64.to_le_bytes());
    exact_amount[192..200].copy_from_slice(&601u64.to_le_bytes());
    assert_semantic_rejection(
        &exact_amount,
        &cores[0],
        RewardAllocatorTranscriptError::ReferenceExactAmountMismatch,
    );

    let mut lane_plan = receipts[0].clone();
    lane_plan[192..200].copy_from_slice(&599u64.to_le_bytes());
    lane_plan[200..208].copy_from_slice(&1u64.to_le_bytes());
    assert_semantic_rejection(
        &lane_plan,
        &cores[0],
        RewardAllocatorTranscriptError::ReferenceLanePlanMismatch,
    );

    let mut faction = receipts[1].clone();
    faction[248..280].fill(0xdd);
    faction[282] = 1;
    assert_semantic_rejection(
        &faction,
        &cores[1],
        RewardAllocatorTranscriptError::ReferenceFactionMismatch,
    );

    let mut disposition_and_reason = receipts[1].clone();
    disposition_and_reason[280] = 3;
    disposition_and_reason[281] = 2;
    assert_semantic_rejection(
        &disposition_and_reason,
        &cores[1],
        RewardAllocatorTranscriptError::ReferenceDispositionMismatch,
    );
}

#[test]
fn reference_core_bytes_must_be_exact_canonical_json_and_exact_ordered_member() {
    let batch_bytes = batch();
    let receipts = receipts();
    let references = reference_receipts();
    let cores = reference_cores();

    for malformed in [
        [b" ".as_slice(), cores[0].as_slice()].concat(),
        [cores[0].as_slice(), b" ".as_slice()].concat(),
        cores[0][..cores[0].len() - 1].to_vec(),
        replace_once(
            &cores[0],
            b"\"activationReady\":false",
            b"\"activationReady\":true",
        ),
        replace_once(
            &cores[0],
            b"iat-b3-reward-capacity-allocator-receipt/v1",
            b"iat-b3-reward-capacity-allocator-receipt/v2",
        ),
        replace_once(
            &cores[0],
            b"NON_ACTIVATING_REFERENCE_RECEIPT",
            b"NON_ACTIVATING_REFERENCE_RECEIPX",
        ),
        replace_once(&cores[0], b"\"reason\":null", b"\"reason\":\"NONE\""),
        replace_once(
            &cores[0],
            b"\"plannedByLane\":{\"ecosystem\":\"0\",\"liquidity\":\"0\",\"treasury\":\"600\"}",
            b"\"plannedByLane\":null",
        ),
        replace_once(
            &cores[1],
            b"\"plannedByLane\":null",
            b"\"plannedByLane\":{\"ecosystem\":\"0\",\"liquidity\":\"0\",\"treasury\":\"0\"}",
        ),
        replace_once(
            &cores[1],
            b"\"reason\":\"EXACT_AMOUNT_NOT_AVAILABLE\"",
            b"\"reason\":null",
        ),
    ] {
        assert_eq!(
            validate_reward_allocator_transcript_binding(
                &batch_bytes,
                &receipts[0],
                &references,
                &malformed,
            ),
            Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore),
        );
    }

    let mut changed_core = cores[0].clone();
    let obligation_digest_marker = b"\"obligationSha256\":\"";
    let start = changed_core
        .windows(obligation_digest_marker.len())
        .position(|window| window == obligation_digest_marker)
        .map(|offset| offset + obligation_digest_marker.len())
        .expect("canonical obligation digest marker");
    changed_core[start] = b'3';
    assert_eq!(
        validate_reward_allocator_transcript_binding(
            &batch_bytes,
            &receipts[0],
            &references,
            &changed_core,
        ),
        Err(RewardAllocatorTranscriptError::ReferenceReceiptDigestMismatch),
    );
}

#[test]
fn production_source_has_no_instruction_writer_dispatcher_or_authorizing_truth() {
    let source = include_str!("../src/reward_allocator_transcript.rs");
    assert!(source.starts_with("//! Strict no-std decoder"));
    for forbidden in [
        "process_instruction",
        "AccountInfo",
        "invoke_signed",
        "entrypoint!",
        "activation_ready: true",
        "mainnet_hold: false",
        "runtime_authentication_verified: true",
        "durable_account_writer_present: true",
    ] {
        assert!(
            !source.contains(forbidden),
            "forbidden source marker: {forbidden}"
        );
    }
}

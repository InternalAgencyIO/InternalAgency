use std::collections::BTreeMap;

use iat_b3_economy::{
    verify_reward_capacity_allocation_recomputation, RewardCapacityCandidateScratch,
    RewardCapacityCccReveal, RewardCapacityReceiptInput, RewardCapacityRecomputationError,
    RewardCapacityRecomputationWorkspace, REWARD_CAPACITY_RECOMPUTATION_MAINNET_STATUS,
    REWARD_CAPACITY_RECOMPUTATION_STATUS, REWARD_CAPACITY_RECOMPUTATION_TRUTH,
};
use sha2::{Digest, Sha256};

const FIXTURE: &str =
    include_str!("../../../tests/fixtures/iat-b3-reward-capacity-recomputation-v1.txt");

struct Vectors {
    source_id: Vec<u8>,
    randomness: [u8; 32],
    seal: Vec<u8>,
    batch: Vec<u8>,
    receipts: Vec<Vec<u8>>,
    cores: Vec<Vec<u8>>,
}

fn fixture() -> Vectors {
    let values: BTreeMap<&str, &str> = FIXTURE
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| line.split_once('=').expect("valid fixture line"))
        .collect();
    assert_eq!(
        values["schema"],
        "iat-b3-reward-capacity-rust-recomputation/v1"
    );
    let count: usize = values["count"].parse().expect("count");
    let mut randomness = [0; 32];
    randomness.copy_from_slice(&decode_hex(values["randomness"]));
    Vectors {
        source_id: decode_hex(values["source_id"]),
        randomness,
        seal: decode_hex(values["seal"]),
        batch: decode_hex(values["batch"]),
        receipts: (0..count)
            .map(|index| decode_hex(values[format!("receipt.{index}").as_str()]))
            .collect(),
        cores: (0..count)
            .map(|index| decode_hex(values[format!("reference_core.{index}").as_str()]))
            .collect(),
    }
}

fn decode_hex(value: &str) -> Vec<u8> {
    assert_eq!(value.len() % 2, 0);
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| (nibble(pair[0]) << 4) | nibble(pair[1]))
        .collect()
}

fn nibble(value: u8) -> u8 {
    match value {
        b'0'..=b'9' => value - b'0',
        b'a'..=b'f' => value - b'a' + 10,
        _ => panic!("invalid fixture hex"),
    }
}

fn verify(vectors: &Vectors) -> Result<(), RewardCapacityRecomputationError> {
    let inputs: Vec<_> = vectors
        .receipts
        .iter()
        .zip(vectors.cores.iter())
        .map(|(receipt, core)| RewardCapacityReceiptInput {
            receipt_bytes: receipt,
            reference_receipt_core_bytes: core,
        })
        .collect();
    let mut candidates = vec![RewardCapacityCandidateScratch::EMPTY; inputs.len()];
    let mut order = vec![0; inputs.len()];
    let mut digests = vec![[0; 32]; inputs.len()];
    verify_reward_capacity_allocation_recomputation(
        &vectors.batch,
        &vectors.seal,
        Some(RewardCapacityCccReveal {
            source_id: &vectors.source_id,
            randomness: vectors.randomness,
        }),
        &inputs,
        RewardCapacityRecomputationWorkspace {
            candidates: &mut candidates,
            allocation_order: &mut order,
            reference_receipt_sha256: &mut digests,
        },
    )?;
    Ok(())
}

#[test]
fn accepts_exact_host_seal_and_recomputes_every_downstream_commitment() {
    verify(&fixture()).expect("exact host vector must verify");
}

#[test]
fn rejects_truncation_trailing_bytes_and_committed_seal_drift() {
    let canonical = fixture();
    for seal in [
        canonical.seal[..canonical.seal.len() - 1].to_vec(),
        [canonical.seal.as_slice(), b"x"].concat(),
    ] {
        let hostile = Vectors { seal, ..fixture() };
        assert_eq!(
            verify(&hostile),
            Err(RewardCapacityRecomputationError::SealDigestMismatch)
        );
    }
    let mut hostile = fixture();
    let marker = b"\"unlocked\":\"150\"";
    let offset = hostile
        .seal
        .windows(marker.len())
        .position(|window| window == marker)
        .expect("treasury unlocked marker");
    hostile.seal[offset + marker.len() - 2] = b'1';
    assert_eq!(
        verify(&hostile),
        Err(RewardCapacityRecomputationError::SealDigestMismatch)
    );
}

#[test]
fn rejects_a_digest_rebound_seal_outside_the_supported_prevalidated_shape() {
    let mut hostile = fixture();
    let marker = b"SEALED_NON_ACTIVATING";
    let offset = hostile
        .seal
        .windows(marker.len())
        .position(|window| window == marker)
        .expect("seal status marker");
    hostile.seal[offset + marker.len() - 1] = b'X';
    hostile.batch[88..120].copy_from_slice(&Sha256::digest(&hostile.seal));
    assert_eq!(
        verify(&hostile),
        Err(RewardCapacityRecomputationError::InvalidSealShape)
    );
}

#[test]
fn rejects_wrong_reveal_and_any_receipt_semantic_mutation() {
    let mut wrong_reveal = fixture();
    wrong_reveal.randomness[0] ^= 1;
    assert_eq!(
        verify(&wrong_reveal),
        Err(RewardCapacityRecomputationError::CccCommitmentMismatch)
    );

    for offset in [120usize, 152, 184, 192, 280, 281, 284] {
        let mut hostile = fixture();
        hostile.receipts[0][offset] ^= 1;
        assert!(matches!(
            verify(&hostile),
            Err(RewardCapacityRecomputationError::ReceiptBinding(_))
                | Err(RewardCapacityRecomputationError::ReceiptOrderMismatch)
                | Err(RewardCapacityRecomputationError::ReceiptCandidateMismatch)
                | Err(RewardCapacityRecomputationError::ReceiptDecisionMismatch)
        ));
    }
}

#[test]
fn rejects_reference_core_mutation_and_receipt_reordering() {
    let mut core = fixture();
    core.cores[0][20] ^= 1;
    assert!(matches!(
        verify(&core),
        Err(RewardCapacityRecomputationError::ReceiptBinding(_))
    ));

    let mut reordered = fixture();
    reordered.receipts.swap(0, 1);
    reordered.cores.swap(0, 1);
    assert!(matches!(
        verify(&reordered),
        Err(RewardCapacityRecomputationError::ReceiptBinding(_))
            | Err(RewardCapacityRecomputationError::ReceiptOrderMismatch)
    ));
}

#[test]
fn requires_exact_nonaliasing_workspace_capacity() {
    let vectors = fixture();
    let inputs: Vec<_> = vectors
        .receipts
        .iter()
        .zip(vectors.cores.iter())
        .map(|(receipt, core)| RewardCapacityReceiptInput {
            receipt_bytes: receipt,
            reference_receipt_core_bytes: core,
        })
        .collect();
    let mut candidates = vec![RewardCapacityCandidateScratch::EMPTY; inputs.len() - 1];
    let mut order = vec![0; inputs.len()];
    let mut digests = vec![[0; 32]; inputs.len()];
    assert_eq!(
        verify_reward_capacity_allocation_recomputation(
            &vectors.batch,
            &vectors.seal,
            Some(RewardCapacityCccReveal {
                source_id: &vectors.source_id,
                randomness: vectors.randomness,
            }),
            &inputs,
            RewardCapacityRecomputationWorkspace {
                candidates: &mut candidates,
                allocation_order: &mut order,
                reference_receipt_sha256: &mut digests,
            },
        ),
        Err(RewardCapacityRecomputationError::WorkspaceLengthMismatch)
    );
}

#[test]
fn truth_boundary_is_permanently_nonactivating_and_hold() {
    assert_eq!(
        REWARD_CAPACITY_RECOMPUTATION_STATUS,
        "EXTERNALLY_PREVALIDATED_COMMITTED_SEAL_ALLOCATION_PARITY_ONLY_NONACTIVATING"
    );
    assert_eq!(REWARD_CAPACITY_RECOMPUTATION_MAINNET_STATUS, "HOLD");
    let truth = std::hint::black_box(REWARD_CAPACITY_RECOMPUTATION_TRUTH);
    assert!(truth.externally_canonical_seal_required);
    assert!(truth.exact_seal_bytes_bound);
    assert!(truth.committed_ccc_order_recomputed);
    assert!(truth.lane_waterfall_recomputed);
    assert!(truth.downstream_commitments_recomputed);
    assert!(!truth.canonical_seal_semantics_verified);
    assert!(!truth.candidate_identifier_derivations_verified);
    assert!(!truth.non_ccc_chronology_recomputed);
    assert!(!truth.escaped_source_identifiers_supported);
    assert!(!truth.source_kind_authenticated);
    assert!(!truth.chronology_authenticated);
    assert!(!truth.round_clock_authenticated);
    assert!(!truth.daily_law_provenance_authenticated);
    assert!(!truth.production_identity_bound);
    assert!(!truth.durable_account_writer_present);
    assert!(!truth.native_instruction_exposed);
    assert!(!truth.abi_or_dispatcher_exposed);
    assert!(!truth.activation_ready);
    assert!(truth.mainnet_hold);
}

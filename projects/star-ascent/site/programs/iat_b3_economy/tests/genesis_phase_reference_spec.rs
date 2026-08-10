#[allow(dead_code)]
#[path = "../src/genesis_phase_reference.rs"]
mod genesis_phase_reference;

use genesis_phase_reference::*;
use sha2::{Digest, Sha256};

const GOLDEN_SHA256: [u8; 32] = [
    225, 79, 108, 198, 40, 32, 151, 13, 108, 199, 86, 226, 9, 21, 103, 198, 21, 77, 3, 136, 199,
    104, 249, 226, 2, 249, 50, 113, 191, 17, 92, 49,
];

fn binding(byte: u8) -> [u8; 32] {
    [byte; 32]
}

fn sample_reference() -> GenesisPhaseReference {
    GenesisPhaseReference {
        current_phase: GenesisPhase::GenesisStaging,
        requested_phase: GenesisPhase::Active,
        current_open_daily_law: binding(1),
        v2_feature_parity: binding(2),
        exact_phase_rule: binding(3),
        core_custody: binding(4),
        faction_economics_and_funding: binding(5),
        genesis_allocation_manifest: binding(6),
        genesis_conservation: binding(7),
        production_identity_freeze: binding(8),
        combined_stake_ingress_binary: binding(9),
        terminal_authority_seal: binding(10),
        native_account_adapter: binding(11),
        final_program_binary: binding(12),
    }
}

fn encoded(reference: &GenesisPhaseReference) -> [u8; GENESIS_PHASE_REFERENCE_LEN] {
    let mut bytes = [0u8; GENESIS_PHASE_REFERENCE_LEN];
    encode_genesis_phase_reference(reference, &mut bytes).unwrap();
    bytes
}

#[test]
fn exact_layout_round_trip_and_golden_hash_are_pinned() {
    let reference = sample_reference();
    let bytes = encoded(&reference);

    assert_eq!(&bytes[..8], &GENESIS_PHASE_REFERENCE_MAGIC);
    assert_eq!(bytes[8], GENESIS_PHASE_REFERENCE_VERSION);
    assert_eq!(bytes[9], 1);
    assert_eq!(bytes[10], 2);
    assert!(bytes[11..32].iter().all(|byte| *byte == 0));
    for index in 0..12 {
        let start = 32 + index * 32;
        assert_eq!(&bytes[start..start + 32], &[index as u8 + 1; 32]);
    }
    assert_eq!(decode_genesis_phase_reference(&bytes), Ok(reference));
    assert_eq!(Sha256::digest(bytes).as_slice(), GOLDEN_SHA256);
}

#[test]
fn decoder_rejects_every_noncanonical_envelope_shape() {
    let bytes = encoded(&sample_reference());

    assert_eq!(
        decode_genesis_phase_reference(&bytes[..GENESIS_PHASE_REFERENCE_LEN - 1]),
        Err(GenesisPhaseReferenceCodecError::InvalidLength)
    );
    let mut trailing = bytes.to_vec();
    trailing.push(0);
    assert_eq!(
        decode_genesis_phase_reference(&trailing),
        Err(GenesisPhaseReferenceCodecError::InvalidLength)
    );

    let mut wrong_magic = bytes;
    wrong_magic[0] ^= 1;
    assert_eq!(
        decode_genesis_phase_reference(&wrong_magic),
        Err(GenesisPhaseReferenceCodecError::WrongTypeMagic)
    );

    let mut wrong_version = bytes;
    wrong_version[8] = GENESIS_PHASE_REFERENCE_VERSION + 1;
    assert_eq!(
        decode_genesis_phase_reference(&wrong_version),
        Err(GenesisPhaseReferenceCodecError::UnsupportedVersion)
    );

    for offset in 11..32 {
        let mut nonzero_reserved = bytes;
        nonzero_reserved[offset] = 1;
        assert_eq!(
            decode_genesis_phase_reference(&nonzero_reserved),
            Err(GenesisPhaseReferenceCodecError::ReservedBytesNonZero),
            "reserved byte {offset}"
        );
    }

    for phase_offset in [9, 10] {
        for invalid in [3, 127, 255] {
            let mut invalid_phase = bytes;
            invalid_phase[phase_offset] = invalid;
            assert_eq!(
                decode_genesis_phase_reference(&invalid_phase),
                Err(GenesisPhaseReferenceCodecError::NonCanonicalPhase),
                "phase offset {phase_offset}, value {invalid}"
            );
        }
    }
}

#[test]
fn encoder_failure_is_transactional() {
    let reference = sample_reference();
    let mut short = [0xA5; GENESIS_PHASE_REFERENCE_LEN - 1];
    let before = short;
    assert_eq!(
        encode_genesis_phase_reference(&reference, &mut short),
        Err(GenesisPhaseReferenceCodecError::InvalidLength)
    );
    assert_eq!(short, before);
}

#[test]
fn only_frozen_one_way_phase_edges_are_structurally_admitted() {
    let phases = [
        GenesisPhase::Uninitialized,
        GenesisPhase::GenesisStaging,
        GenesisPhase::Active,
    ];

    for current_phase in phases {
        for requested_phase in phases {
            let mut reference = sample_reference();
            reference.current_phase = current_phase;
            reference.requested_phase = requested_phase;
            let result = assess_genesis_phase_reference(&reference);
            let is_frozen_edge = matches!(
                (current_phase, requested_phase),
                (GenesisPhase::Uninitialized, GenesisPhase::GenesisStaging)
                    | (GenesisPhase::GenesisStaging, GenesisPhase::Active)
            );
            assert_eq!(result.is_ok(), is_frozen_edge);
        }
    }
}

#[test]
fn activation_is_daily_law_first_before_later_dependencies() {
    let mut reference = sample_reference();
    reference.current_open_daily_law = [0; 32];
    reference.v2_feature_parity = [0; 32];
    reference.exact_phase_rule = [0; 32];
    reference.core_custody = [0; 32];
    reference.faction_economics_and_funding = [0; 32];
    reference.genesis_allocation_manifest = [0; 32];
    reference.genesis_conservation = [0; 32];

    assert_eq!(
        assess_genesis_phase_reference(&reference),
        Err(GenesisPhaseAssessmentError::CurrentOpenDailyLawReferenceMissing)
    );

    reference.current_open_daily_law = binding(1);
    let assessment = assess_genesis_phase_reference(&reference).unwrap();
    assert_eq!(
        assessment.referenced_bindings & DAILY_LAW_BINDING,
        DAILY_LAW_BINDING
    );
    assert_eq!(
        assessment.unresolved_bindings & V2_FEATURE_PARITY_BINDING,
        V2_FEATURE_PARITY_BINDING
    );
    assert_eq!(
        assessment.unresolved_bindings & EXACT_PHASE_RULE_BINDING,
        EXACT_PHASE_RULE_BINDING
    );
    assert_eq!(
        assessment.unresolved_bindings & CORE_CUSTODY_BINDING,
        CORE_CUSTODY_BINDING
    );
    assert_eq!(
        assessment.unresolved_bindings & FACTION_ECONOMICS_BINDING,
        FACTION_ECONOMICS_BINDING
    );
    assert_eq!(
        assessment.unresolved_bindings & GENESIS_MANIFEST_BINDING,
        GENESIS_MANIFEST_BINDING
    );
    assert_eq!(
        assessment.unresolved_bindings & GENESIS_CONSERVATION_BINDING,
        GENESIS_CONSERVATION_BINDING
    );
}

#[test]
fn staging_does_not_invent_a_daily_law_requirement_and_still_holds() {
    let mut reference = sample_reference();
    reference.current_phase = GenesisPhase::Uninitialized;
    reference.requested_phase = GenesisPhase::GenesisStaging;
    reference.current_open_daily_law = [0; 32];

    let assessment = assess_genesis_phase_reference(&reference).unwrap();
    assert_eq!(
        assessment.unresolved_bindings & DAILY_LAW_BINDING,
        DAILY_LAW_BINDING
    );
    assert!(!assessment.transition_authorized);
    assert!(assessment.mainnet_hold);
}

#[test]
fn unresolved_owner_choices_and_fully_populated_references_both_fail_closed() {
    let mut unresolved = sample_reference();
    unresolved.core_custody = [0; 32];
    unresolved.faction_economics_and_funding = [0; 32];
    unresolved.genesis_allocation_manifest = [0; 32];
    unresolved.genesis_conservation = [0; 32];
    let unresolved_assessment = assess_genesis_phase_reference(&unresolved).unwrap();
    assert_ne!(unresolved_assessment.unresolved_bindings, 0);
    assert!(!unresolved_assessment.owner_policy_accepted);
    assert!(!unresolved_assessment.genesis_conservation_proved);
    assert!(!unresolved_assessment.transition_authorized);
    assert!(unresolved_assessment.mainnet_hold);

    let populated_assessment = assess_genesis_phase_reference(&sample_reference()).unwrap();
    assert_eq!(
        populated_assessment.referenced_bindings,
        ALL_GENESIS_BINDINGS
    );
    assert_eq!(populated_assessment.unresolved_bindings, 0);
    assert!(!populated_assessment.external_artifacts_authenticated);
    assert!(!populated_assessment.owner_policy_accepted);
    assert!(!populated_assessment.genesis_conservation_proved);
    assert!(!populated_assessment.config_codec_frozen);
    assert!(!populated_assessment.runtime_transition_verified);
    assert!(!populated_assessment.transition_authorized);
    assert!(populated_assessment.mainnet_hold);
}

#[test]
fn every_binding_has_an_independent_stable_mask_bit() {
    let mut reference = sample_reference();
    let expected = [
        DAILY_LAW_BINDING,
        V2_FEATURE_PARITY_BINDING,
        EXACT_PHASE_RULE_BINDING,
        CORE_CUSTODY_BINDING,
        FACTION_ECONOMICS_BINDING,
        GENESIS_MANIFEST_BINDING,
        GENESIS_CONSERVATION_BINDING,
        PRODUCTION_IDENTITY_BINDING,
        COMBINED_STAKE_INGRESS_BINDING,
        TERMINAL_AUTHORITY_SEAL_BINDING,
        NATIVE_ADAPTER_BINDING,
        FINAL_PROGRAM_BINARY_BINDING,
    ];

    for (index, expected_bit) in expected.into_iter().enumerate() {
        let start = 32 + index * 32;
        let mut bytes = encoded(&reference);
        bytes[start..start + 32].fill(0);
        reference = decode_genesis_phase_reference(&bytes).unwrap();
        if index == 0 {
            reference.current_phase = GenesisPhase::Uninitialized;
            reference.requested_phase = GenesisPhase::GenesisStaging;
        }
        let assessment = assess_genesis_phase_reference(&reference).unwrap();
        assert_eq!(assessment.unresolved_bindings & expected_bit, expected_bit);
        reference = sample_reference();
    }
}

#[test]
fn corruption_sweep_is_panic_free() {
    let bytes = encoded(&sample_reference());
    for offset in 0..GENESIS_PHASE_REFERENCE_LEN {
        let mut corrupted = bytes;
        corrupted[offset] ^= 0xFF;
        let result = std::panic::catch_unwind(|| {
            if let Ok(reference) = decode_genesis_phase_reference(&corrupted) {
                let _ = assess_genesis_phase_reference(&reference);
            }
        });
        assert!(result.is_ok(), "panic at byte {offset}");
    }
}

#[test]
fn reference_is_test_only_and_has_no_executable_or_config_codec_surface() {
    let source = include_str!("../src/genesis_phase_reference.rs");
    let crate_root = include_str!("../src/lib.rs");

    assert!(!crate_root.contains("mod genesis_phase_reference"));
    assert!(!source.contains("use solana_program"));
    assert!(!source.contains("AccountInfo"));
    assert!(!source.contains("entrypoint!("));
    assert!(!source.contains("invoke("));
    assert!(!source.contains("ConfigState"));
    assert!(!source.contains("encode_config"));
    assert!(!source.contains("decode_config"));
}

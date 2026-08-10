use iat_b3_economy::{
    decode_config_genesis_state, encode_config_genesis_state, ConfigGenesisCodecError,
    ConfigGenesisCodecTruth, ConfigGenesisState, ConfigState, GenesisPhase,
    CONFIG_GENESIS_ACCOUNT_LEN, CONFIG_GENESIS_ACCOUNT_MAGIC, CONFIG_GENESIS_ACCOUNT_VERSION,
    CONFIG_GENESIS_CODEC_STATUS, CONFIG_GENESIS_CODEC_TRUTH,
};
use sha2::{Digest, Sha256};

fn sample_state() -> ConfigGenesisState {
    ConfigGenesisState {
        phase: GenesisPhase::GenesisStaging,
        config: ConfigState {
            admin: [0x11; 32],
            mint: [0x22; 32],
            token_program: [0x33; 32],
            randomness_program: [0x44; 32],
            stake_token_account: [0x55; 32],
            agency_registry_hash: [0x66; 32],
            genesis_timestamp: -1_786_000_001,
            expected_supply: 1_000_000_000_000,
            staked_principal: 987_654_321,
            agency_count: 17,
            rehearsal_mode: true,
            active: false,
            lane_mask: 0b1_1110,
            stake_vault_initialized: true,
            bump: 201,
            vault_authority_bump: 202,
        },
    }
}

fn encoded(state: &ConfigGenesisState) -> [u8; CONFIG_GENESIS_ACCOUNT_LEN] {
    let mut bytes = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(state, &mut bytes).unwrap();
    bytes
}

#[test]
fn codec_truth_is_representation_only_and_unconditionally_held() {
    assert_eq!(
        CONFIG_GENESIS_CODEC_STATUS,
        "STRICT_V1_REPRESENTATION_ONLY_PHASE_POLICY_UNRESOLVED_MAINNET_HOLD"
    );
    assert_eq!(
        CONFIG_GENESIS_CODEC_TRUTH,
        ConfigGenesisCodecTruth {
            production_source_representation_present: true,
            exact_length_and_version_checked: true,
            owner_bootstrap_policy_accepted: false,
            phase_transition_predicate_frozen: false,
            vacuous_cap_rule_proved: false,
            genesis_conservation_proved: false,
            transition_authorized: false,
            account_writes_executed: false,
            any_handler_complete: false,
            mainnet_hold: true,
        }
    );
}

#[test]
fn fixed_v1_layout_is_field_complete_and_round_trips() {
    let state = sample_state();
    let bytes = encoded(&state);
    assert_eq!(&bytes[..8], &CONFIG_GENESIS_ACCOUNT_MAGIC);
    assert_eq!(bytes[8], CONFIG_GENESIS_ACCOUNT_VERSION);
    assert_eq!(bytes[9], GenesisPhase::GenesisStaging as u8);
    assert!(bytes[10..32].iter().all(|byte| *byte == 0));
    assert_eq!(&bytes[32..64], &[0x11; 32]);
    assert_eq!(&bytes[64..96], &[0x22; 32]);
    assert_eq!(&bytes[96..128], &[0x33; 32]);
    assert_eq!(&bytes[128..160], &[0x44; 32]);
    assert_eq!(&bytes[160..192], &[0x55; 32]);
    assert_eq!(&bytes[192..224], &[0x66; 32]);
    assert_eq!(
        i64::from_le_bytes(bytes[224..232].try_into().unwrap()),
        -1_786_000_001
    );
    assert_eq!(
        u64::from_le_bytes(bytes[232..240].try_into().unwrap()),
        1_000_000_000_000
    );
    assert_eq!(
        u64::from_le_bytes(bytes[240..248].try_into().unwrap()),
        987_654_321
    );
    assert_eq!(u32::from_le_bytes(bytes[248..252].try_into().unwrap()), 17);
    assert_eq!(&bytes[252..258], &[1, 0, 0b1_1110, 1, 201, 202]);
    assert!(bytes[258..].iter().all(|byte| *byte == 0));
    assert_eq!(decode_config_genesis_state(&bytes), Ok(state));

    let digest: [u8; 32] = Sha256::digest(bytes).into();
    assert_eq!(
        digest,
        [
            236, 14, 37, 111, 17, 225, 210, 223, 17, 214, 117, 184, 11, 170, 37, 11, 90, 149, 61,
            22, 114, 136, 177, 81, 45, 216, 208, 106, 8, 179, 99, 230,
        ]
    );
}

#[test]
fn all_three_phase_labels_round_trip_without_defining_an_edge() {
    for phase in [
        GenesisPhase::Uninitialized,
        GenesisPhase::GenesisStaging,
        GenesisPhase::Active,
    ] {
        let mut state = sample_state();
        state.phase = phase;
        state.config.active = phase == GenesisPhase::Active;
        assert_eq!(decode_config_genesis_state(&encoded(&state)), Ok(state));
    }
}

#[test]
fn decoder_rejects_lengths_type_version_reserved_phase_and_boolean_drift() {
    let bytes = encoded(&sample_state());
    assert_eq!(
        decode_config_genesis_state(&bytes[..CONFIG_GENESIS_ACCOUNT_LEN - 1]),
        Err(ConfigGenesisCodecError::InvalidLength)
    );
    let mut trailing = bytes.to_vec();
    trailing.push(0);
    assert_eq!(
        decode_config_genesis_state(&trailing),
        Err(ConfigGenesisCodecError::InvalidLength)
    );

    let mut wrong_magic = bytes;
    wrong_magic[0] ^= 0x80;
    assert_eq!(
        decode_config_genesis_state(&wrong_magic),
        Err(ConfigGenesisCodecError::WrongTypeMagic)
    );
    let mut wrong_version = bytes;
    wrong_version[8] = CONFIG_GENESIS_ACCOUNT_VERSION.wrapping_add(1);
    assert_eq!(
        decode_config_genesis_state(&wrong_version),
        Err(ConfigGenesisCodecError::UnsupportedVersion)
    );
    for offset in (10..32).chain(258..CONFIG_GENESIS_ACCOUNT_LEN) {
        let mut nonzero_reserved = bytes;
        nonzero_reserved[offset] = 1;
        assert_eq!(
            decode_config_genesis_state(&nonzero_reserved),
            Err(ConfigGenesisCodecError::ReservedBytesNonZero),
            "reserved offset {offset}"
        );
    }
    for invalid in [3, 127, u8::MAX] {
        let mut noncanonical_phase = bytes;
        noncanonical_phase[9] = invalid;
        assert_eq!(
            decode_config_genesis_state(&noncanonical_phase),
            Err(ConfigGenesisCodecError::NonCanonicalPhase)
        );
    }
    for offset in [252, 253, 255] {
        for invalid in [2, 127, u8::MAX] {
            let mut noncanonical_bool = bytes;
            noncanonical_bool[offset] = invalid;
            assert_eq!(
                decode_config_genesis_state(&noncanonical_bool),
                Err(ConfigGenesisCodecError::NonCanonicalBoolean),
                "boolean offset {offset}, value {invalid}"
            );
        }
    }
    for invalid in [1, 0b10_0000, u8::MAX] {
        let mut noncanonical_lane_mask = bytes;
        noncanonical_lane_mask[254] = invalid;
        assert_eq!(
            decode_config_genesis_state(&noncanonical_lane_mask),
            Err(ConfigGenesisCodecError::NonCanonicalLaneMask)
        );
    }
}

#[test]
fn phase_and_retained_active_boolean_cannot_contradict_each_other() {
    let mut bytes = encoded(&sample_state());
    bytes[9] = GenesisPhase::Active as u8;
    assert_eq!(
        decode_config_genesis_state(&bytes),
        Err(ConfigGenesisCodecError::PhaseActiveMismatch)
    );

    let mut state = sample_state();
    state.config.active = true;
    let mut output = [0xA5; CONFIG_GENESIS_ACCOUNT_LEN];
    assert_eq!(
        encode_config_genesis_state(&state, &mut output),
        Err(ConfigGenesisCodecError::PhaseActiveMismatch)
    );
    assert_eq!(output, [0xA5; CONFIG_GENESIS_ACCOUNT_LEN]);
}

#[test]
fn encoder_is_exact_length_and_transactional_on_failure() {
    let state = sample_state();
    let mut short = [0x5A; CONFIG_GENESIS_ACCOUNT_LEN - 1];
    assert_eq!(
        encode_config_genesis_state(&state, &mut short),
        Err(ConfigGenesisCodecError::InvalidLength)
    );
    assert_eq!(short, [0x5A; CONFIG_GENESIS_ACCOUNT_LEN - 1]);
    let mut long = [0x5A; CONFIG_GENESIS_ACCOUNT_LEN + 1];
    assert_eq!(
        encode_config_genesis_state(&state, &mut long),
        Err(ConfigGenesisCodecError::InvalidLength)
    );
    assert_eq!(long, [0x5A; CONFIG_GENESIS_ACCOUNT_LEN + 1]);

    let mut noncanonical = state;
    noncanonical.config.lane_mask = 1;
    let mut output = [0x5A; CONFIG_GENESIS_ACCOUNT_LEN];
    assert_eq!(
        encode_config_genesis_state(&noncanonical, &mut output),
        Err(ConfigGenesisCodecError::NonCanonicalLaneMask)
    );
    assert_eq!(output, [0x5A; CONFIG_GENESIS_ACCOUNT_LEN]);
}

#[test]
fn every_semantic_field_changes_the_encoding() {
    let baseline_state = sample_state();
    let baseline = encoded(&baseline_state);
    let mutations: [fn(&mut ConfigGenesisState); 17] = [
        |state| state.phase = GenesisPhase::Uninitialized,
        |state| state.config.admin[0] ^= 1,
        |state| state.config.mint[0] ^= 1,
        |state| state.config.token_program[0] ^= 1,
        |state| state.config.randomness_program[0] ^= 1,
        |state| state.config.stake_token_account[0] ^= 1,
        |state| state.config.agency_registry_hash[0] ^= 1,
        |state| state.config.genesis_timestamp ^= 1,
        |state| state.config.expected_supply ^= 1,
        |state| state.config.staked_principal ^= 1,
        |state| state.config.agency_count ^= 1,
        |state| state.config.rehearsal_mode = false,
        |state| {
            state.phase = GenesisPhase::Active;
            state.config.active = true;
        },
        |state| state.config.lane_mask ^= 0b0010,
        |state| state.config.stake_vault_initialized = false,
        |state| state.config.bump ^= 1,
        |state| state.config.vault_authority_bump ^= 1,
    ];
    for (index, mutate) in mutations.into_iter().enumerate() {
        let mut state = baseline_state;
        mutate(&mut state);
        let candidate = encoded(&state);
        assert_ne!(candidate, baseline, "semantic mutation {index}");
        assert_eq!(decode_config_genesis_state(&candidate), Ok(state));
    }
}

#[test]
fn hostile_byte_sweep_is_panic_free() {
    let bytes = encoded(&sample_state());
    for offset in 0..CONFIG_GENESIS_ACCOUNT_LEN {
        for mask in [1, 0x80, 0xFF] {
            let mut corrupted = bytes;
            corrupted[offset] ^= mask;
            let result = std::panic::catch_unwind(|| decode_config_genesis_state(&corrupted));
            assert!(result.is_ok(), "panic at byte {offset}, mask {mask:#04x}");
        }
    }
    for hostile in [
        [0u8; CONFIG_GENESIS_ACCOUNT_LEN],
        [u8::MAX; CONFIG_GENESIS_ACCOUNT_LEN],
    ] {
        assert!(std::panic::catch_unwind(|| decode_config_genesis_state(&hostile)).is_ok());
    }
}

#[test]
fn production_codec_has_no_transition_or_executable_surface() {
    let source = include_str!("../src/config_genesis_codec.rs");
    assert!(!source.contains("AccountInfo"));
    assert!(!source.contains("entrypoint!("));
    assert!(!source.contains("process_instruction"));
    assert!(!source.contains("invoke("));
    assert!(!source.contains("invoke_signed"));
    assert!(!source.contains("try_borrow_mut"));
    assert!(!source.contains("pub fn activate"));
    assert!(!source.contains("pub fn finalize"));
    assert!(!source.contains("pub fn transition"));
}

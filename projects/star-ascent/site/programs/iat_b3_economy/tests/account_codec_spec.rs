use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
use iat_b3_economy::{
    close_position, decode_lane_state, decode_position_state, encode_lane_state,
    encode_position_state, verify_daily_law_open, CanonicalDailyLawBinding, CodecError,
    ConfigState, LaneState, PositionState, ReadonlyDailyLawAccount, ACCOUNT_CODEC_VERSION,
    ECOSYSTEM, LANE_ACCOUNT_LEN, LANE_ACCOUNT_MAGIC, LAW_STATE_LEN, LAW_STATE_MAGIC,
    LAW_STATE_VERSION, LIQUIDITY, POSITION_ACCOUNT_LEN, POSITION_ACCOUNT_MAGIC, TREASURY,
    USER_TERM_WEEKS,
};
use sha2::{Digest, Sha256};

const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
const LAW_STATE: [u8; 32] = [0x51; 32];
const LAW_BUMP: u8 = 254;
const MINT: [u8; 32] = [0x22; 32];
const NETWORK: [u8; 32] = [0x11; 32];
const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

// These hashes pin every byte of the named golden semantic vectors below.
// They are intentionally independent of any production program or mint ID.
const POSITION_GOLDEN_SHA256: [u8; 32] = [
    115, 209, 239, 34, 63, 31, 18, 174, 235, 140, 68, 87, 205, 63, 94, 211, 116, 18, 201, 134, 63,
    18, 207, 157, 156, 250, 125, 78, 108, 62, 70, 181,
];
const LANE_GOLDEN_SHA256: [u8; 32] = [
    79, 52, 230, 73, 224, 203, 244, 153, 89, 190, 30, 39, 100, 142, 109, 190, 75, 181, 25, 209,
    195, 43, 11, 107, 10, 136, 188, 11, 141, 243, 191, 255,
];

fn sample_position() -> PositionState {
    PositionState {
        config: [0x10; 32],
        owner: [0x20; 32],
        position_id: 0x0102_0304_0506_0708,
        principal: 0x1112_1314_1516_1718,
        accepted_week: 0x2122_2324_2526_2728,
        first_accrual_week: 0x3132_3334_3536_3738,
        term_weeks: 0x4142_4344_4546_4748,
        annual_rate_bps: 0x5152_5354_5556_5758,
        treasury_reserved: 0x6162_6364_6566_6768,
        ecosystem_reserved: 0x7172_7374_7576_7778,
        liquidity_reserved: 0x8182_8384_8586_8788,
        paid: 0x9192_9394_9596_9798,
        settled_mask: 0xA1A2_A3A4_A5A6_A7A8,
        agency_index: 0xB1B2_B3B4,
        role: 2,
        principal_returned: true,
        closed: false,
        bump: 0xD1,
    }
}

fn sample_lane() -> LaneState {
    LaneState {
        config: [0x30; 32],
        token_account: [0x40; 32],
        beneficiary: [0x50; 32],
        total: 0x0102_0304_0506_0708,
        genesis_unlocked: 0x1112_1314_1516_1718,
        cliff_week: 0x2122_2324_2526_2728,
        linear_end_week: 0x3132_3334_3536_3738,
        reserved: 0x4142_4344_4546_4748,
        paid: 0x5152_5354_5556_5758,
        principal_claimed: 0x6162_6364_6566_6768,
        lane: 4,
        reward_source: true,
        bump: 0x81,
        token_bump: 0x91,
    }
}

fn encoded_position(position: &PositionState) -> [u8; POSITION_ACCOUNT_LEN] {
    let mut bytes = [0u8; POSITION_ACCOUNT_LEN];
    encode_position_state(position, &mut bytes).unwrap();
    bytes
}

fn encoded_lane(lane: &LaneState) -> [u8; LANE_ACCOUNT_LEN] {
    let mut bytes = [0u8; LANE_ACCOUNT_LEN];
    encode_lane_state(lane, &mut bytes).unwrap();
    bytes
}

fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

#[test]
fn codecs_pin_distinct_versioned_fixed_golden_vectors() {
    let position = sample_position();
    let lane = sample_lane();
    let position_bytes = encoded_position(&position);
    let lane_bytes = encoded_lane(&lane);

    assert_ne!(POSITION_ACCOUNT_MAGIC, LANE_ACCOUNT_MAGIC);
    assert_eq!(&position_bytes[..8], &POSITION_ACCOUNT_MAGIC);
    assert_eq!(&lane_bytes[..8], &LANE_ACCOUNT_MAGIC);
    assert_eq!(position_bytes[8], ACCOUNT_CODEC_VERSION);
    assert_eq!(lane_bytes[8], ACCOUNT_CODEC_VERSION);
    assert!(position_bytes[9..16].iter().all(|byte| *byte == 0));
    assert!(lane_bytes[9..16].iter().all(|byte| *byte == 0));
    assert!(lane_bytes[172..].iter().all(|byte| *byte == 0));

    assert_eq!(&position_bytes[80..88], &position.position_id.to_le_bytes());
    assert_eq!(
        &position_bytes[168..172],
        &position.agency_index.to_le_bytes()
    );
    assert_eq!(position_bytes[173], 1);
    assert_eq!(position_bytes[174], 0);
    assert_eq!(&lane_bytes[112..120], &lane.total.to_le_bytes());
    assert_eq!(lane_bytes[169], 1);

    assert_eq!(sha256(&position_bytes), POSITION_GOLDEN_SHA256);
    assert_eq!(sha256(&lane_bytes), LANE_GOLDEN_SHA256);
    assert_eq!(decode_position_state(&position_bytes), Ok(position));
    assert_eq!(decode_lane_state(&lane_bytes), Ok(lane));
}

#[test]
fn strict_decoders_reject_length_type_version_reserved_and_boolean_drift() {
    let position_bytes = encoded_position(&sample_position());
    let lane_bytes = encoded_lane(&sample_lane());

    assert_eq!(
        decode_position_state(&position_bytes[..POSITION_ACCOUNT_LEN - 1]),
        Err(CodecError::InvalidLength)
    );
    let mut long_position = position_bytes.to_vec();
    long_position.push(0);
    assert_eq!(
        decode_position_state(&long_position),
        Err(CodecError::InvalidLength)
    );
    assert_eq!(
        decode_position_state(&lane_bytes),
        Err(CodecError::WrongTypeMagic)
    );
    assert_eq!(
        decode_lane_state(&position_bytes),
        Err(CodecError::WrongTypeMagic)
    );

    let mut wrong_version = position_bytes;
    wrong_version[8] = ACCOUNT_CODEC_VERSION + 1;
    assert_eq!(
        decode_position_state(&wrong_version),
        Err(CodecError::UnsupportedVersion)
    );

    let mut header_reserved = position_bytes;
    header_reserved[15] = 1;
    assert_eq!(
        decode_position_state(&header_reserved),
        Err(CodecError::ReservedBytesNonZero)
    );
    let mut lane_reserved = lane_bytes;
    lane_reserved[175] = 1;
    assert_eq!(
        decode_lane_state(&lane_reserved),
        Err(CodecError::ReservedBytesNonZero)
    );

    let mut position_bool = position_bytes;
    position_bool[173] = 2;
    assert_eq!(
        decode_position_state(&position_bool),
        Err(CodecError::NonCanonicalBoolean)
    );
    let mut lane_bool = lane_bytes;
    lane_bool[169] = u8::MAX;
    assert_eq!(
        decode_lane_state(&lane_bool),
        Err(CodecError::NonCanonicalBoolean)
    );

    let mut position_role = position_bytes;
    position_role[172] = 3;
    assert_eq!(
        decode_position_state(&position_role),
        Err(CodecError::NonCanonicalDiscriminant)
    );
    let mut lane_discriminant = lane_bytes;
    lane_discriminant[168] = 0;
    assert_eq!(
        decode_lane_state(&lane_discriminant),
        Err(CodecError::NonCanonicalDiscriminant)
    );
}

#[test]
fn failed_encode_leaves_the_caller_buffer_unchanged() {
    let mut short_position = [0xA5; POSITION_ACCOUNT_LEN - 1];
    let position_before = short_position;
    assert_eq!(
        encode_position_state(&sample_position(), &mut short_position),
        Err(CodecError::InvalidLength)
    );
    assert_eq!(short_position, position_before);

    let mut long_lane = [0x5A; LANE_ACCOUNT_LEN + 1];
    let lane_before = long_lane;
    assert_eq!(
        encode_lane_state(&sample_lane(), &mut long_lane),
        Err(CodecError::InvalidLength)
    );
    assert_eq!(long_lane, lane_before);

    let mut invalid_role_output = [0x3C; POSITION_ACCOUNT_LEN];
    let invalid_role_before = invalid_role_output;
    assert_eq!(
        encode_position_state(
            &PositionState {
                role: 3,
                ..sample_position()
            },
            &mut invalid_role_output,
        ),
        Err(CodecError::NonCanonicalDiscriminant)
    );
    assert_eq!(invalid_role_output, invalid_role_before);

    let mut invalid_lane_output = [0xC3; LANE_ACCOUNT_LEN];
    let invalid_lane_before = invalid_lane_output;
    assert_eq!(
        encode_lane_state(
            &LaneState {
                lane: 0,
                ..sample_lane()
            },
            &mut invalid_lane_output,
        ),
        Err(CodecError::NonCanonicalDiscriminant)
    );
    assert_eq!(invalid_lane_output, invalid_lane_before);
}

#[test]
fn every_position_and_lane_semantic_field_changes_the_encoding() {
    let position = sample_position();
    let position_bytes = encoded_position(&position);
    let position_variants = [
        PositionState {
            config: [1; 32],
            ..position
        },
        PositionState {
            owner: [2; 32],
            ..position
        },
        PositionState {
            position_id: 1,
            ..position
        },
        PositionState {
            principal: 2,
            ..position
        },
        PositionState {
            accepted_week: 3,
            ..position
        },
        PositionState {
            first_accrual_week: 4,
            ..position
        },
        PositionState {
            term_weeks: 5,
            ..position
        },
        PositionState {
            annual_rate_bps: 6,
            ..position
        },
        PositionState {
            treasury_reserved: 7,
            ..position
        },
        PositionState {
            ecosystem_reserved: 8,
            ..position
        },
        PositionState {
            liquidity_reserved: 9,
            ..position
        },
        PositionState {
            paid: 10,
            ..position
        },
        PositionState {
            settled_mask: 11,
            ..position
        },
        PositionState {
            agency_index: 12,
            ..position
        },
        PositionState {
            role: 1,
            ..position
        },
        PositionState {
            principal_returned: false,
            ..position
        },
        PositionState {
            closed: true,
            ..position
        },
        PositionState {
            bump: 14,
            ..position
        },
    ];
    for variant in position_variants {
        assert_ne!(encoded_position(&variant), position_bytes);
        assert_eq!(
            decode_position_state(&encoded_position(&variant)),
            Ok(variant)
        );
    }

    let lane = sample_lane();
    let lane_bytes = encoded_lane(&lane);
    let lane_variants = [
        LaneState {
            config: [3; 32],
            ..lane
        },
        LaneState {
            token_account: [4; 32],
            ..lane
        },
        LaneState {
            beneficiary: [5; 32],
            ..lane
        },
        LaneState { total: 1, ..lane },
        LaneState {
            genesis_unlocked: 2,
            ..lane
        },
        LaneState {
            cliff_week: 3,
            ..lane
        },
        LaneState {
            linear_end_week: 4,
            ..lane
        },
        LaneState {
            reserved: 5,
            ..lane
        },
        LaneState { paid: 6, ..lane },
        LaneState {
            principal_claimed: 7,
            ..lane
        },
        LaneState { lane: 2, ..lane },
        LaneState {
            reward_source: false,
            ..lane
        },
        LaneState { bump: 9, ..lane },
        LaneState {
            token_bump: 10,
            ..lane
        },
    ];
    for variant in lane_variants {
        assert_ne!(encoded_lane(&variant), lane_bytes);
        assert_eq!(decode_lane_state(&encoded_lane(&variant)), Ok(variant));
    }
}

#[test]
fn decoded_position_and_lanes_cross_the_gated_close_kernel_without_config_codec_claim() {
    let gate = open_gate();
    // Config remains an already-authenticated semantic input for this slice.
    // No Config account bytes, owner, address, phase, or activation rule are
    // accepted or frozen by the Position/Lane codec integration proof.
    let config = semantic_config_for_integration();
    let position = PositionState {
        settled_mask: (1u64 << USER_TERM_WEEKS) - 1,
        treasury_reserved: 11,
        ecosystem_reserved: 13,
        liquidity_reserved: 17,
        ..sample_position()
    };
    let treasury = close_lane(TREASURY, 101);
    let ecosystem = close_lane(ECOSYSTEM, 103);
    let liquidity = close_lane(LIQUIDITY, 107);

    let result = close_position(
        &gate,
        config.active,
        decode_position_state(&encoded_position(&position)).unwrap(),
        decode_lane_state(&encoded_lane(&treasury)).unwrap(),
        decode_lane_state(&encoded_lane(&ecosystem)).unwrap(),
        decode_lane_state(&encoded_lane(&liquidity)).unwrap(),
    )
    .unwrap();

    let closed_position =
        decode_position_state(&encoded_position(&result.position)).expect("closed position codec");
    let closed_treasury =
        decode_lane_state(&encoded_lane(&result.treasury)).expect("treasury codec");
    let closed_ecosystem =
        decode_lane_state(&encoded_lane(&result.ecosystem)).expect("ecosystem codec");
    let closed_liquidity =
        decode_lane_state(&encoded_lane(&result.liquidity)).expect("liquidity codec");

    assert!(closed_position.closed);
    assert_eq!(closed_position.treasury_reserved, 0);
    assert_eq!(closed_position.ecosystem_reserved, 0);
    assert_eq!(closed_position.liquidity_reserved, 0);
    assert_eq!(closed_treasury.reserved, treasury.reserved - 11);
    assert_eq!(closed_ecosystem.reserved, ecosystem.reserved - 13);
    assert_eq!(closed_liquidity.reserved, liquidity.reserved - 17);
}

fn close_lane(lane: u8, reserved: u64) -> LaneState {
    LaneState {
        config: [0x10; 32],
        token_account: [lane; 32],
        beneficiary: [lane.wrapping_add(1); 32],
        total: 1_000,
        genesis_unlocked: 100,
        cliff_week: 5,
        linear_end_week: 25,
        reserved,
        paid: 50,
        principal_claimed: 25,
        lane,
        reward_source: true,
        bump: lane.wrapping_add(10),
        token_bump: lane.wrapping_add(20),
    }
}

fn semantic_config_for_integration() -> ConfigState {
    ConfigState {
        admin: [0x01; 32],
        mint: MINT,
        token_program: [0x02; 32],
        randomness_program: [0x03; 32],
        stake_token_account: [0x04; 32],
        agency_registry_hash: [0x05; 32],
        genesis_timestamp: 1_000,
        expected_supply: 1_000_000,
        staked_principal: 500_000,
        agency_count: 7,
        rehearsal_mode: true,
        active: true,
        lane_mask: 0b1_1110,
        stake_vault_initialized: true,
        bump: 250,
        vault_authority_bump: 249,
    }
}

fn open_gate() -> iat_b3_economy::ValidatedDailyLawWrite {
    let data = pack_law_state(Some(decision_for(CLOCK_TIMESTAMP, false)));
    verify_daily_law_open(
        &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        CLOCK_TIMESTAMP,
    )
    .unwrap()
}

fn decision_for(timestamp: i64, locked: bool) -> SolanaDailyDecision {
    let local_day = protocol_local_day(timestamp);
    for candidate in 0u16..=u8::MAX.into() {
        let mut hash = [0u8; 32];
        hash[31] = candidate as u8;
        let decision =
            create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
        if decision.locked == locked {
            return decision;
        }
    }
    panic!("test vector search did not find requested disposition")
}

fn pack_law_state(decision: Option<SolanaDailyDecision>) -> [u8; LAW_STATE_LEN] {
    let mut data = [0u8; LAW_STATE_LEN];
    data[0..8].copy_from_slice(LAW_STATE_MAGIC);
    data[8] = LAW_STATE_VERSION;
    data[9] = LAW_BUMP;
    data[16..48].copy_from_slice(&MINT);
    data[48..80].copy_from_slice(&NETWORK);
    if let Some(decision) = decision {
        data[10] = 1;
        data[11] = u8::from(decision.locked);
        data[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
        data[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
        data[96..128].copy_from_slice(&decision.ancestor_slot_hash);
        data[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
        data[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
        data[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
        data[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
    }
    data
}

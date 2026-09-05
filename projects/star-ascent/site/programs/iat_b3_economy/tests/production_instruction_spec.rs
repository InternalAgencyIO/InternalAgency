use iat_b3_economy::production_instruction::{
    decode_production_instruction, decode_production_open_position_instruction,
    encode_production_instruction, encode_production_open_position_instruction,
    ProductionInstruction, ProductionInstructionError, ProductionOpenPositionInstruction,
    OPEN_POSITION_INSTRUCTION_LEN, OPEN_POSITION_OPCODE, PRODUCTION_INSTRUCTION_COUNT,
    PRODUCTION_INSTRUCTION_LEN, PRODUCTION_INSTRUCTION_NAMESPACE, PRODUCTION_INSTRUCTION_STATUS,
    PRODUCTION_INSTRUCTION_TRUTH,
};

fn encoded(position_id: u64, principal: u64) -> [u8; OPEN_POSITION_INSTRUCTION_LEN] {
    let mut output = [0_u8; OPEN_POSITION_INSTRUCTION_LEN];
    encode_production_open_position_instruction(
        ProductionOpenPositionInstruction {
            position_id,
            principal,
        },
        &mut output,
    )
    .unwrap();
    output
}

fn encode_any(instruction: ProductionInstruction) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
    let mut output = [0_u8; PRODUCTION_INSTRUCTION_LEN];
    encode_production_instruction(instruction, &mut output).unwrap();
    output
}

fn all_instructions() -> [ProductionInstruction; PRODUCTION_INSTRUCTION_COUNT] {
    [
        ProductionInstruction::InitializeConfig,
        ProductionInstruction::InitializeLaneVault { lane: 1 },
        ProductionInstruction::InitializeStakeVault,
        ProductionInstruction::Activate,
        ProductionInstruction::RegisterAgency,
        ProductionInstruction::SetEligibility {
            role: 2,
            agency_index: Some(0xA1B2_C3D4),
        },
        ProductionInstruction::OpenPosition {
            position_id: 0x0102_0304_0506_0708,
            principal: 0x1112_1314_1516_1718,
        },
        ProductionInstruction::SettlePositionWeek { week: 9 },
        ProductionInstruction::SettleCoreWeek { ordinal: 51 },
        ProductionInstruction::ClaimLanePrincipal { lane: 4 },
        ProductionInstruction::WithdrawPositionPrincipal,
        ProductionInstruction::ClosePosition,
        ProductionInstruction::CommitRound { week: u64::MAX },
        ProductionInstruction::SettleRound,
        ProductionInstruction::ExpireRound,
    ]
}

#[test]
fn exact_open_position_vector_and_round_trip_are_frozen() {
    let bytes = encoded(0x0807_0605_0403_0201, 0x1817_1615_1413_1211);
    assert_eq!(&bytes[0..8], PRODUCTION_INSTRUCTION_NAMESPACE);
    assert_eq!(bytes[8], 1);
    assert_eq!(bytes[9], OPEN_POSITION_OPCODE);
    assert_eq!(&bytes[10..16], &[0; 6]);
    assert_eq!(&bytes[16..24], &[1, 2, 3, 4, 5, 6, 7, 8]);
    assert_eq!(
        &bytes[24..32],
        &[0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18]
    );
    assert_eq!(
        decode_production_open_position_instruction(&bytes).unwrap(),
        ProductionOpenPositionInstruction {
            position_id: 0x0807_0605_0403_0201,
            principal: 0x1817_1615_1413_1211,
        }
    );
}

#[test]
fn decoder_rejects_every_noncanonical_envelope_shape() {
    let canonical = encoded(0, u64::MAX);
    for length in 0..=OPEN_POSITION_INSTRUCTION_LEN + 1 {
        if length != OPEN_POSITION_INSTRUCTION_LEN {
            let data = vec![0_u8; length];
            assert_eq!(
                decode_production_open_position_instruction(&data),
                Err(ProductionInstructionError::InvalidLength)
            );
        }
    }
    let mut wrong = canonical;
    wrong[0] ^= 1;
    assert_eq!(
        decode_production_open_position_instruction(&wrong),
        Err(ProductionInstructionError::InvalidNamespace)
    );
    let mut wrong = canonical;
    wrong[8] = 2;
    assert_eq!(
        decode_production_open_position_instruction(&wrong),
        Err(ProductionInstructionError::InvalidVersion)
    );
    let mut wrong = canonical;
    wrong[9] = u8::MAX;
    assert_eq!(
        decode_production_open_position_instruction(&wrong),
        Err(ProductionInstructionError::InvalidOpcode)
    );
    for index in 10..16 {
        let mut wrong = canonical;
        wrong[index] = 1;
        assert_eq!(
            decode_production_open_position_instruction(&wrong),
            Err(ProductionInstructionError::NonzeroReservedBytes)
        );
    }
}

#[test]
fn every_retained_operation_has_one_exact_ordered_round_trip() {
    let instructions = all_instructions();
    assert_eq!(instructions.len(), PRODUCTION_INSTRUCTION_COUNT);
    for (expected_opcode, instruction) in instructions.into_iter().enumerate() {
        assert_eq!(usize::from(instruction.opcode()), expected_opcode);
        let bytes = encode_any(instruction);
        assert_eq!(bytes[9], instruction.opcode());
        assert_eq!(decode_production_instruction(&bytes).unwrap(), instruction);
    }
}

#[test]
fn every_payload_family_rejects_noncanonical_tail_and_option_bytes() {
    let mut argless = encode_any(ProductionInstruction::Activate);
    argless[31] = 1;
    assert_eq!(
        decode_production_instruction(&argless),
        Err(ProductionInstructionError::NonCanonicalPayload)
    );

    let mut lane = encode_any(ProductionInstruction::InitializeLaneVault { lane: 2 });
    lane[17] = 1;
    assert_eq!(
        decode_production_instruction(&lane),
        Err(ProductionInstructionError::NonCanonicalPayload)
    );

    let mut single_u64 = encode_any(ProductionInstruction::SettlePositionWeek { week: 9 });
    single_u64[24] = 1;
    assert_eq!(
        decode_production_instruction(&single_u64),
        Err(ProductionInstructionError::NonCanonicalPayload)
    );

    let mut option = encode_any(ProductionInstruction::SetEligibility {
        role: 0,
        agency_index: None,
    });
    option[17] = 2;
    assert_eq!(
        decode_production_instruction(&option),
        Err(ProductionInstructionError::NonCanonicalOption)
    );
    let mut option = encode_any(ProductionInstruction::SetEligibility {
        role: 0,
        agency_index: None,
    });
    option[20] = 1;
    assert_eq!(
        decode_production_instruction(&option),
        Err(ProductionInstructionError::NonCanonicalOption)
    );
    let mut option = encode_any(ProductionInstruction::SetEligibility {
        role: 2,
        agency_index: Some(7),
    });
    option[18] = 1;
    assert_eq!(
        decode_production_instruction(&option),
        Err(ProductionInstructionError::NonCanonicalPayload)
    );
}

#[test]
fn encoder_failure_is_atomic_and_zero_principal_remains_semantic() {
    let instruction = ProductionOpenPositionInstruction {
        position_id: u64::MAX,
        principal: 0,
    };
    let mut short = [0xA5_u8; OPEN_POSITION_INSTRUCTION_LEN - 1];
    let before = short;
    assert_eq!(
        encode_production_open_position_instruction(instruction, &mut short),
        Err(ProductionInstructionError::InvalidLength)
    );
    assert_eq!(short, before);
    assert_eq!(
        decode_production_open_position_instruction(&encoded(u64::MAX, 0)).unwrap(),
        instruction
    );
}

#[test]
fn truth_freezes_all_codecs_and_reports_only_the_feature_gated_held_surface() {
    let truth = std::hint::black_box(PRODUCTION_INSTRUCTION_TRUTH);
    assert!(truth.open_position_codec_exact);
    assert!(truth.all_15_instruction_abi_frozen);
    assert!(truth.production_surface_feature_gated);
    assert!(truth.production_dispatcher_exposed);
    assert!(truth.production_entrypoint_exposed);
    assert!(truth.account_data_read);
    assert!(truth.account_writes_executed);
    assert!(truth.cpi_executed);
    assert!(!truth.production_identities_frozen);
    assert!(!truth.devnet_executed);
    assert!(truth.any_handler_complete);
    assert!(truth.mainnet_hold);
    assert!(PRODUCTION_INSTRUCTION_STATUS.contains("MAINNET_HOLD"));
}

#[cfg(feature = "runtime-account-bridge")]
#[test]
fn opcodes_match_the_retained_all_15_inventory_order() {
    use iat_b3_economy::rehearsal_adapter::{RehearsalOperation, ALL_REHEARSAL_OPERATIONS};
    let expected = [
        RehearsalOperation::InitializeConfig,
        RehearsalOperation::InitializeLaneVault,
        RehearsalOperation::InitializeStakeVault,
        RehearsalOperation::Activate,
        RehearsalOperation::RegisterAgency,
        RehearsalOperation::SetEligibility,
        RehearsalOperation::OpenPosition,
        RehearsalOperation::SettlePositionWeek,
        RehearsalOperation::SettleCoreWeek,
        RehearsalOperation::ClaimLanePrincipal,
        RehearsalOperation::WithdrawPositionPrincipal,
        RehearsalOperation::ClosePosition,
        RehearsalOperation::CommitRound,
        RehearsalOperation::SettleRound,
        RehearsalOperation::ExpireRound,
    ];
    assert_eq!(ALL_REHEARSAL_OPERATIONS, expected);
    let instructions = all_instructions();
    for (index, instruction) in instructions.into_iter().enumerate() {
        assert_eq!(usize::from(instruction.opcode()), index);
        assert_eq!(ALL_REHEARSAL_OPERATIONS[index], expected[index]);
    }
}

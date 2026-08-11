use iat_b3_economy::production_instruction::{
    decode_production_open_position_instruction, encode_production_open_position_instruction,
    ProductionInstructionError, ProductionOpenPositionInstruction, OPEN_POSITION_INSTRUCTION_LEN,
    OPEN_POSITION_OPCODE, PRODUCTION_INSTRUCTION_NAMESPACE, PRODUCTION_INSTRUCTION_STATUS,
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
    wrong[9] = OPEN_POSITION_OPCODE.wrapping_add(1);
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
fn truth_is_one_codec_only_and_never_authorizes_execution() {
    let truth = std::hint::black_box(PRODUCTION_INSTRUCTION_TRUTH);
    assert!(truth.open_position_codec_exact);
    assert!(!truth.all_15_instruction_abi_frozen);
    assert!(!truth.production_dispatcher_exposed);
    assert!(!truth.production_entrypoint_exposed);
    assert!(!truth.account_data_read);
    assert!(!truth.account_writes_executed);
    assert!(!truth.cpi_executed);
    assert!(!truth.production_identities_frozen);
    assert!(!truth.devnet_executed);
    assert!(!truth.any_handler_complete);
    assert!(truth.mainnet_hold);
    assert!(PRODUCTION_INSTRUCTION_STATUS.contains("MAINNET_HOLD"));
}

#[cfg(feature = "runtime-account-bridge")]
#[test]
fn opcode_matches_the_retained_all_15_inventory_index() {
    use iat_b3_economy::rehearsal_adapter::{RehearsalOperation, ALL_REHEARSAL_OPERATIONS};
    assert_eq!(
        ALL_REHEARSAL_OPERATIONS[usize::from(OPEN_POSITION_OPCODE)],
        RehearsalOperation::OpenPosition
    );
}

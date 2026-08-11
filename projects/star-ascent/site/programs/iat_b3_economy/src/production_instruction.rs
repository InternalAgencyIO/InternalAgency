//! Strict production instruction representation for the first composed B3
//! economic write. This module decodes bytes only; it exposes no dispatcher,
//! entrypoint, accounts, writes, CPI, identity, or release authority.

pub const PRODUCTION_INSTRUCTION_NAMESPACE: &[u8; 8] = b"IATB3EC1";
pub const PRODUCTION_INSTRUCTION_VERSION: u8 = 1;
pub const OPEN_POSITION_OPCODE: u8 = 6;
pub const OPEN_POSITION_INSTRUCTION_LEN: usize = 32;

pub const PRODUCTION_INSTRUCTION_STATUS: &str =
    "OPEN_POSITION_CODEC_EXACT_ALL_15_ABI_INCOMPLETE_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionInstructionTruth {
    pub open_position_codec_exact: bool,
    pub all_15_instruction_abi_frozen: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub account_data_read: bool,
    pub account_writes_executed: bool,
    pub cpi_executed: bool,
    pub production_identities_frozen: bool,
    pub devnet_executed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_INSTRUCTION_TRUTH: ProductionInstructionTruth = ProductionInstructionTruth {
    open_position_codec_exact: true,
    all_15_instruction_abi_frozen: false,
    production_dispatcher_exposed: false,
    production_entrypoint_exposed: false,
    account_data_read: false,
    account_writes_executed: false,
    cpi_executed: false,
    production_identities_frozen: false,
    devnet_executed: false,
    any_handler_complete: false,
    mainnet_hold: true,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionOpenPositionInstruction {
    pub position_id: u64,
    pub principal: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionInstructionError {
    InvalidLength,
    InvalidNamespace,
    InvalidVersion,
    InvalidOpcode,
    NonzeroReservedBytes,
}

/// Decode the exact B3 OpenPosition instruction envelope. Principal policy is
/// deliberately not evaluated here so Daily Law can remain first at the
/// executable handler boundary.
pub fn decode_production_open_position_instruction(
    data: &[u8],
) -> Result<ProductionOpenPositionInstruction, ProductionInstructionError> {
    if data.len() != OPEN_POSITION_INSTRUCTION_LEN {
        return Err(ProductionInstructionError::InvalidLength);
    }
    if data.get(0..8) != Some(PRODUCTION_INSTRUCTION_NAMESPACE) {
        return Err(ProductionInstructionError::InvalidNamespace);
    }
    if data[8] != PRODUCTION_INSTRUCTION_VERSION {
        return Err(ProductionInstructionError::InvalidVersion);
    }
    if data[9] != OPEN_POSITION_OPCODE {
        return Err(ProductionInstructionError::InvalidOpcode);
    }
    if data[10..16].iter().any(|byte| *byte != 0) {
        return Err(ProductionInstructionError::NonzeroReservedBytes);
    }
    let position_id = u64::from_le_bytes(
        data[16..24]
            .try_into()
            .map_err(|_| ProductionInstructionError::InvalidLength)?,
    );
    let principal = u64::from_le_bytes(
        data[24..32]
            .try_into()
            .map_err(|_| ProductionInstructionError::InvalidLength)?,
    );
    Ok(ProductionOpenPositionInstruction {
        position_id,
        principal,
    })
}

/// Encode atomically: the caller buffer is untouched on every error.
pub fn encode_production_open_position_instruction(
    instruction: ProductionOpenPositionInstruction,
    output: &mut [u8],
) -> Result<(), ProductionInstructionError> {
    if output.len() != OPEN_POSITION_INSTRUCTION_LEN {
        return Err(ProductionInstructionError::InvalidLength);
    }
    let mut encoded = [0_u8; OPEN_POSITION_INSTRUCTION_LEN];
    encoded[0..8].copy_from_slice(PRODUCTION_INSTRUCTION_NAMESPACE);
    encoded[8] = PRODUCTION_INSTRUCTION_VERSION;
    encoded[9] = OPEN_POSITION_OPCODE;
    encoded[16..24].copy_from_slice(&instruction.position_id.to_le_bytes());
    encoded[24..32].copy_from_slice(&instruction.principal.to_le_bytes());
    output.copy_from_slice(&encoded);
    Ok(())
}

//! Strict production instruction representations for all fifteen retained B3
//! economic operations. This module only canonicalizes bytes; it exposes no
//! dispatcher, entrypoint, accounts, writes, CPI, identity, or release authority.

pub const PRODUCTION_INSTRUCTION_NAMESPACE: &[u8; 8] = b"IATB3EC1";
pub const PRODUCTION_INSTRUCTION_VERSION: u8 = 1;
pub const PRODUCTION_INSTRUCTION_LEN: usize = 32;
pub const PRODUCTION_INSTRUCTION_COUNT: usize = 15;

pub const INITIALIZE_CONFIG_OPCODE: u8 = 0;
pub const INITIALIZE_LANE_VAULT_OPCODE: u8 = 1;
pub const INITIALIZE_STAKE_VAULT_OPCODE: u8 = 2;
pub const ACTIVATE_OPCODE: u8 = 3;
pub const REGISTER_AGENCY_OPCODE: u8 = 4;
pub const SET_ELIGIBILITY_OPCODE: u8 = 5;
pub const OPEN_POSITION_OPCODE: u8 = 6;
pub const SETTLE_POSITION_WEEK_OPCODE: u8 = 7;
pub const SETTLE_CORE_WEEK_OPCODE: u8 = 8;
pub const CLAIM_LANE_PRINCIPAL_OPCODE: u8 = 9;
pub const WITHDRAW_POSITION_PRINCIPAL_OPCODE: u8 = 10;
pub const CLOSE_POSITION_OPCODE: u8 = 11;
pub const COMMIT_ROUND_OPCODE: u8 = 12;
pub const SETTLE_ROUND_OPCODE: u8 = 13;
pub const EXPIRE_ROUND_OPCODE: u8 = 14;

pub const OPEN_POSITION_INSTRUCTION_LEN: usize = PRODUCTION_INSTRUCTION_LEN;

pub const PRODUCTION_INSTRUCTION_STATUS: &str =
    "ALL_15_PRODUCTION_CODECS_EXACT_NO_DISPATCH_NO_ENTRYPOINT_MAINNET_HOLD";

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
    all_15_instruction_abi_frozen: true,
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
pub enum ProductionInstruction {
    InitializeConfig,
    InitializeLaneVault { lane: u8 },
    InitializeStakeVault,
    Activate,
    RegisterAgency,
    SetEligibility { role: u8, agency_index: Option<u32> },
    OpenPosition { position_id: u64, principal: u64 },
    SettlePositionWeek { week: u64 },
    SettleCoreWeek { ordinal: u64 },
    ClaimLanePrincipal { lane: u8 },
    WithdrawPositionPrincipal,
    ClosePosition,
    CommitRound { week: u64 },
    SettleRound,
    ExpireRound,
}

impl ProductionInstruction {
    pub const fn opcode(self) -> u8 {
        match self {
            Self::InitializeConfig => INITIALIZE_CONFIG_OPCODE,
            Self::InitializeLaneVault { .. } => INITIALIZE_LANE_VAULT_OPCODE,
            Self::InitializeStakeVault => INITIALIZE_STAKE_VAULT_OPCODE,
            Self::Activate => ACTIVATE_OPCODE,
            Self::RegisterAgency => REGISTER_AGENCY_OPCODE,
            Self::SetEligibility { .. } => SET_ELIGIBILITY_OPCODE,
            Self::OpenPosition { .. } => OPEN_POSITION_OPCODE,
            Self::SettlePositionWeek { .. } => SETTLE_POSITION_WEEK_OPCODE,
            Self::SettleCoreWeek { .. } => SETTLE_CORE_WEEK_OPCODE,
            Self::ClaimLanePrincipal { .. } => CLAIM_LANE_PRINCIPAL_OPCODE,
            Self::WithdrawPositionPrincipal => WITHDRAW_POSITION_PRINCIPAL_OPCODE,
            Self::ClosePosition => CLOSE_POSITION_OPCODE,
            Self::CommitRound { .. } => COMMIT_ROUND_OPCODE,
            Self::SettleRound => SETTLE_ROUND_OPCODE,
            Self::ExpireRound => EXPIRE_ROUND_OPCODE,
        }
    }
}

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
    NonCanonicalPayload,
    NonCanonicalOption,
}

fn read_u32(data: &[u8]) -> Result<u32, ProductionInstructionError> {
    Ok(u32::from_le_bytes(
        data.try_into()
            .map_err(|_| ProductionInstructionError::InvalidLength)?,
    ))
}

fn read_u64(data: &[u8]) -> Result<u64, ProductionInstructionError> {
    Ok(u64::from_le_bytes(
        data.try_into()
            .map_err(|_| ProductionInstructionError::InvalidLength)?,
    ))
}

fn require_zero(data: &[u8]) -> Result<(), ProductionInstructionError> {
    if data.iter().any(|byte| *byte != 0) {
        return Err(ProductionInstructionError::NonCanonicalPayload);
    }
    Ok(())
}

/// Decode exactly one canonical all-15 instruction envelope. Business policy
/// is deliberately not evaluated here so Daily Law remains first when a future
/// production dispatcher is composed.
pub fn decode_production_instruction(
    data: &[u8],
) -> Result<ProductionInstruction, ProductionInstructionError> {
    if data.len() != PRODUCTION_INSTRUCTION_LEN {
        return Err(ProductionInstructionError::InvalidLength);
    }
    if data.get(0..8) != Some(PRODUCTION_INSTRUCTION_NAMESPACE) {
        return Err(ProductionInstructionError::InvalidNamespace);
    }
    if data[8] != PRODUCTION_INSTRUCTION_VERSION {
        return Err(ProductionInstructionError::InvalidVersion);
    }
    if data[10..16].iter().any(|byte| *byte != 0) {
        return Err(ProductionInstructionError::NonzeroReservedBytes);
    }

    let payload = &data[16..32];
    match data[9] {
        INITIALIZE_CONFIG_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::InitializeConfig)
        }
        INITIALIZE_LANE_VAULT_OPCODE => {
            require_zero(&payload[1..])?;
            Ok(ProductionInstruction::InitializeLaneVault { lane: payload[0] })
        }
        INITIALIZE_STAKE_VAULT_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::InitializeStakeVault)
        }
        ACTIVATE_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::Activate)
        }
        REGISTER_AGENCY_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::RegisterAgency)
        }
        SET_ELIGIBILITY_OPCODE => {
            require_zero(&payload[2..4])?;
            require_zero(&payload[8..])?;
            let raw_index = read_u32(&payload[4..8])?;
            let agency_index = match payload[1] {
                0 if raw_index == 0 => None,
                0 => return Err(ProductionInstructionError::NonCanonicalOption),
                1 => Some(raw_index),
                _ => return Err(ProductionInstructionError::NonCanonicalOption),
            };
            Ok(ProductionInstruction::SetEligibility {
                role: payload[0],
                agency_index,
            })
        }
        OPEN_POSITION_OPCODE => Ok(ProductionInstruction::OpenPosition {
            position_id: read_u64(&payload[0..8])?,
            principal: read_u64(&payload[8..16])?,
        }),
        SETTLE_POSITION_WEEK_OPCODE => {
            require_zero(&payload[8..])?;
            Ok(ProductionInstruction::SettlePositionWeek {
                week: read_u64(&payload[0..8])?,
            })
        }
        SETTLE_CORE_WEEK_OPCODE => {
            require_zero(&payload[8..])?;
            Ok(ProductionInstruction::SettleCoreWeek {
                ordinal: read_u64(&payload[0..8])?,
            })
        }
        CLAIM_LANE_PRINCIPAL_OPCODE => {
            require_zero(&payload[1..])?;
            Ok(ProductionInstruction::ClaimLanePrincipal { lane: payload[0] })
        }
        WITHDRAW_POSITION_PRINCIPAL_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::WithdrawPositionPrincipal)
        }
        CLOSE_POSITION_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::ClosePosition)
        }
        COMMIT_ROUND_OPCODE => {
            require_zero(&payload[8..])?;
            Ok(ProductionInstruction::CommitRound {
                week: read_u64(&payload[0..8])?,
            })
        }
        SETTLE_ROUND_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::SettleRound)
        }
        EXPIRE_ROUND_OPCODE => {
            require_zero(payload)?;
            Ok(ProductionInstruction::ExpireRound)
        }
        _ => Err(ProductionInstructionError::InvalidOpcode),
    }
}

/// Encode atomically: the caller buffer is untouched on every error.
pub fn encode_production_instruction(
    instruction: ProductionInstruction,
    output: &mut [u8],
) -> Result<(), ProductionInstructionError> {
    if output.len() != PRODUCTION_INSTRUCTION_LEN {
        return Err(ProductionInstructionError::InvalidLength);
    }
    let mut encoded = [0_u8; PRODUCTION_INSTRUCTION_LEN];
    encoded[0..8].copy_from_slice(PRODUCTION_INSTRUCTION_NAMESPACE);
    encoded[8] = PRODUCTION_INSTRUCTION_VERSION;
    encoded[9] = instruction.opcode();
    match instruction {
        ProductionInstruction::InitializeLaneVault { lane }
        | ProductionInstruction::ClaimLanePrincipal { lane } => encoded[16] = lane,
        ProductionInstruction::SetEligibility { role, agency_index } => {
            encoded[16] = role;
            if let Some(index) = agency_index {
                encoded[17] = 1;
                encoded[20..24].copy_from_slice(&index.to_le_bytes());
            }
        }
        ProductionInstruction::OpenPosition {
            position_id,
            principal,
        } => {
            encoded[16..24].copy_from_slice(&position_id.to_le_bytes());
            encoded[24..32].copy_from_slice(&principal.to_le_bytes());
        }
        ProductionInstruction::SettlePositionWeek { week }
        | ProductionInstruction::CommitRound { week } => {
            encoded[16..24].copy_from_slice(&week.to_le_bytes());
        }
        ProductionInstruction::SettleCoreWeek { ordinal } => {
            encoded[16..24].copy_from_slice(&ordinal.to_le_bytes());
        }
        ProductionInstruction::InitializeConfig
        | ProductionInstruction::InitializeStakeVault
        | ProductionInstruction::Activate
        | ProductionInstruction::RegisterAgency
        | ProductionInstruction::WithdrawPositionPrincipal
        | ProductionInstruction::ClosePosition
        | ProductionInstruction::SettleRound
        | ProductionInstruction::ExpireRound => {}
    }
    output.copy_from_slice(&encoded);
    Ok(())
}

pub fn decode_production_open_position_instruction(
    data: &[u8],
) -> Result<ProductionOpenPositionInstruction, ProductionInstructionError> {
    match decode_production_instruction(data)? {
        ProductionInstruction::OpenPosition {
            position_id,
            principal,
        } => Ok(ProductionOpenPositionInstruction {
            position_id,
            principal,
        }),
        _ => Err(ProductionInstructionError::InvalidOpcode),
    }
}

pub fn encode_production_open_position_instruction(
    instruction: ProductionOpenPositionInstruction,
    output: &mut [u8],
) -> Result<(), ProductionInstructionError> {
    encode_production_instruction(
        ProductionInstruction::OpenPosition {
            position_id: instruction.position_id,
            principal: instruction.principal,
        },
        output,
    )
}

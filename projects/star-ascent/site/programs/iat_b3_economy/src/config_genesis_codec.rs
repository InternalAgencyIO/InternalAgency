//! Strict, non-activating B3 Config/Genesis account representation.
//!
//! This production-source module freezes only a byte representation. It does
//! not decide the unresolved Genesis bootstrap predicate, assess vacuous-cap
//! safety, authorize a phase edge, authenticate owner policy, or expose an
//! instruction, lifecycle, CPI, account write, or dispatcher. The retained V2
//! `ConfigState::active` field remains present for exact semantic parity; the
//! additional phase discriminant prevents that legacy boolean from silently
//! standing in for an unstated B3 phase.

use crate::ConfigState;

pub const CONFIG_GENESIS_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3CFG";
pub const CONFIG_GENESIS_ACCOUNT_VERSION: u8 = 1;
pub const CONFIG_GENESIS_ACCOUNT_LEN: usize = 272;
pub const CONFIG_GENESIS_CODEC_STATUS: &str =
    "STRICT_V1_REPRESENTATION_ONLY_PHASE_POLICY_UNRESOLVED_MAINNET_HOLD";

const HEADER_LEN: usize = 32;
const HEADER_RESERVED_START: usize = 10;
const PAYLOAD_RESERVED_START: usize = 258;

/// Frozen high-level phase labels only. No transition function is provided.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum GenesisPhase {
    Uninitialized = 0,
    GenesisStaging = 1,
    Active = 2,
}

impl GenesisPhase {
    const fn from_byte(value: u8) -> Result<Self, ConfigGenesisCodecError> {
        match value {
            0 => Ok(Self::Uninitialized),
            1 => Ok(Self::GenesisStaging),
            2 => Ok(Self::Active),
            _ => Err(ConfigGenesisCodecError::NonCanonicalPhase),
        }
    }

    const fn expects_legacy_active(self) -> bool {
        matches!(self, Self::Active)
    }
}

/// Field-complete retained V2 Config semantics plus an explicit B3 phase.
/// This value describes bytes only; it is not an authorization capability.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisState {
    pub phase: GenesisPhase,
    pub config: ConfigState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfigGenesisCodecError {
    InvalidLength,
    WrongTypeMagic,
    UnsupportedVersion,
    ReservedBytesNonZero,
    NonCanonicalPhase,
    NonCanonicalBoolean,
    NonCanonicalLaneMask,
    PhaseActiveMismatch,
}

/// Truth boundary for this partial. Positive fields describe representation
/// only; every trust, mutation, transition, and release claim remains false.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisCodecTruth {
    pub production_source_representation_present: bool,
    pub exact_length_and_version_checked: bool,
    pub owner_bootstrap_policy_accepted: bool,
    pub phase_transition_predicate_frozen: bool,
    pub vacuous_cap_rule_proved: bool,
    pub genesis_conservation_proved: bool,
    pub transition_authorized: bool,
    pub account_writes_executed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const CONFIG_GENESIS_CODEC_TRUTH: ConfigGenesisCodecTruth = ConfigGenesisCodecTruth {
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
};

/// Encode into a temporary fixed buffer before touching caller output.
pub fn encode_config_genesis_state(
    state: &ConfigGenesisState,
    output: &mut [u8],
) -> Result<(), ConfigGenesisCodecError> {
    if output.len() != CONFIG_GENESIS_ACCOUNT_LEN {
        return Err(ConfigGenesisCodecError::InvalidLength);
    }
    require_phase_active_consistency(state.phase, state.config.active)?;
    require_lane_mask(state.config.lane_mask)?;

    let mut encoded = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encoded[..8].copy_from_slice(&CONFIG_GENESIS_ACCOUNT_MAGIC);
    encoded[8] = CONFIG_GENESIS_ACCOUNT_VERSION;
    encoded[9] = state.phase as u8;

    let mut offset = HEADER_LEN;
    write_key(&mut encoded, &mut offset, state.config.admin);
    write_key(&mut encoded, &mut offset, state.config.mint);
    write_key(&mut encoded, &mut offset, state.config.token_program);
    write_key(&mut encoded, &mut offset, state.config.randomness_program);
    write_key(&mut encoded, &mut offset, state.config.stake_token_account);
    write_key(&mut encoded, &mut offset, state.config.agency_registry_hash);
    write_i64(&mut encoded, &mut offset, state.config.genesis_timestamp);
    write_u64(&mut encoded, &mut offset, state.config.expected_supply);
    write_u64(&mut encoded, &mut offset, state.config.staked_principal);
    write_u32(&mut encoded, &mut offset, state.config.agency_count);
    write_bool(&mut encoded, &mut offset, state.config.rehearsal_mode);
    write_bool(&mut encoded, &mut offset, state.config.active);
    write_u8(&mut encoded, &mut offset, state.config.lane_mask);
    write_bool(
        &mut encoded,
        &mut offset,
        state.config.stake_vault_initialized,
    );
    write_u8(&mut encoded, &mut offset, state.config.bump);
    write_u8(&mut encoded, &mut offset, state.config.vault_authority_bump);
    debug_assert_eq!(offset, PAYLOAD_RESERVED_START);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode the exact representation. Success establishes no account identity,
/// policy acceptance, transition readiness, or runtime authorization.
pub fn decode_config_genesis_state(
    input: &[u8],
) -> Result<ConfigGenesisState, ConfigGenesisCodecError> {
    if input.len() != CONFIG_GENESIS_ACCOUNT_LEN {
        return Err(ConfigGenesisCodecError::InvalidLength);
    }
    if input[..8] != CONFIG_GENESIS_ACCOUNT_MAGIC {
        return Err(ConfigGenesisCodecError::WrongTypeMagic);
    }
    if input[8] != CONFIG_GENESIS_ACCOUNT_VERSION {
        return Err(ConfigGenesisCodecError::UnsupportedVersion);
    }
    if input[HEADER_RESERVED_START..HEADER_LEN]
        .iter()
        .chain(input[PAYLOAD_RESERVED_START..].iter())
        .any(|byte| *byte != 0)
    {
        return Err(ConfigGenesisCodecError::ReservedBytesNonZero);
    }

    let phase = GenesisPhase::from_byte(input[9])?;
    let mut offset = HEADER_LEN;
    let config = ConfigState {
        admin: read_key(input, &mut offset),
        mint: read_key(input, &mut offset),
        token_program: read_key(input, &mut offset),
        randomness_program: read_key(input, &mut offset),
        stake_token_account: read_key(input, &mut offset),
        agency_registry_hash: read_key(input, &mut offset),
        genesis_timestamp: read_i64(input, &mut offset),
        expected_supply: read_u64(input, &mut offset),
        staked_principal: read_u64(input, &mut offset),
        agency_count: read_u32(input, &mut offset),
        rehearsal_mode: read_bool(input, &mut offset)?,
        active: read_bool(input, &mut offset)?,
        lane_mask: read_u8(input, &mut offset),
        stake_vault_initialized: read_bool(input, &mut offset)?,
        bump: read_u8(input, &mut offset),
        vault_authority_bump: read_u8(input, &mut offset),
    };
    debug_assert_eq!(offset, PAYLOAD_RESERVED_START);
    require_lane_mask(config.lane_mask)?;
    require_phase_active_consistency(phase, config.active)?;
    Ok(ConfigGenesisState { phase, config })
}

fn require_lane_mask(lane_mask: u8) -> Result<(), ConfigGenesisCodecError> {
    const RETAINED_V2_LANE_MASK: u8 = 0b1_1110;
    if lane_mask & !RETAINED_V2_LANE_MASK != 0 {
        return Err(ConfigGenesisCodecError::NonCanonicalLaneMask);
    }
    Ok(())
}

fn require_phase_active_consistency(
    phase: GenesisPhase,
    legacy_active: bool,
) -> Result<(), ConfigGenesisCodecError> {
    if phase.expects_legacy_active() != legacy_active {
        return Err(ConfigGenesisCodecError::PhaseActiveMismatch);
    }
    Ok(())
}

fn write_key(output: &mut [u8], offset: &mut usize, value: [u8; 32]) {
    output[*offset..*offset + 32].copy_from_slice(&value);
    *offset += 32;
}

fn write_u64(output: &mut [u8], offset: &mut usize, value: u64) {
    output[*offset..*offset + 8].copy_from_slice(&value.to_le_bytes());
    *offset += 8;
}

fn write_i64(output: &mut [u8], offset: &mut usize, value: i64) {
    output[*offset..*offset + 8].copy_from_slice(&value.to_le_bytes());
    *offset += 8;
}

fn write_u32(output: &mut [u8], offset: &mut usize, value: u32) {
    output[*offset..*offset + 4].copy_from_slice(&value.to_le_bytes());
    *offset += 4;
}

fn write_bool(output: &mut [u8], offset: &mut usize, value: bool) {
    write_u8(output, offset, u8::from(value));
}

fn write_u8(output: &mut [u8], offset: &mut usize, value: u8) {
    output[*offset] = value;
    *offset += 1;
}

fn read_key(input: &[u8], offset: &mut usize) -> [u8; 32] {
    let mut value = [0u8; 32];
    value.copy_from_slice(&input[*offset..*offset + 32]);
    *offset += 32;
    value
}

fn read_u64(input: &[u8], offset: &mut usize) -> u64 {
    let mut value = [0u8; 8];
    value.copy_from_slice(&input[*offset..*offset + 8]);
    *offset += 8;
    u64::from_le_bytes(value)
}

fn read_i64(input: &[u8], offset: &mut usize) -> i64 {
    let mut value = [0u8; 8];
    value.copy_from_slice(&input[*offset..*offset + 8]);
    *offset += 8;
    i64::from_le_bytes(value)
}

fn read_u32(input: &[u8], offset: &mut usize) -> u32 {
    let mut value = [0u8; 4];
    value.copy_from_slice(&input[*offset..*offset + 4]);
    *offset += 4;
    u32::from_le_bytes(value)
}

fn read_bool(input: &[u8], offset: &mut usize) -> Result<bool, ConfigGenesisCodecError> {
    match read_u8(input, offset) {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(ConfigGenesisCodecError::NonCanonicalBoolean),
    }
}

fn read_u8(input: &[u8], offset: &mut usize) -> u8 {
    let value = input[*offset];
    *offset += 1;
    value
}

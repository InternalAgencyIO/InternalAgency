use crate::{LaneState, PositionState};

/// Version one of the strict B3 economic account byte envelope.
pub const ACCOUNT_CODEC_VERSION: u8 = 1;
pub const POSITION_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3POS";
pub const LANE_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3LAN";
pub const CORE_REWARD_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3CRW";
pub const AGENCY_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3AGN";
pub const AGENCY_OWNER_INDEX_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3AOI";
pub const ELIGIBILITY_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3ELG";
pub const POSITION_ACCOUNT_LEN: usize = 176;
pub const LANE_ACCOUNT_LEN: usize = 176;
pub const CORE_REWARD_ACCOUNT_LEN: usize = 128;
pub const AGENCY_ACCOUNT_LEN: usize = 96;
pub const AGENCY_OWNER_INDEX_ACCOUNT_LEN: usize = 96;
pub const ELIGIBILITY_ACCOUNT_LEN: usize = 96;

const HEADER_LEN: usize = 16;
const HEADER_RESERVED_START: usize = 9;
const POSITION_BODY_START: usize = HEADER_LEN;
const LANE_BODY_START: usize = HEADER_LEN;
const LANE_RESERVED_START: usize = 172;
const CORE_REWARD_RESERVED_START: usize = 121;
const AGENCY_RESERVED_START: usize = 93;
const AGENCY_OWNER_INDEX_RESERVED_START: usize = 85;
const ELIGIBILITY_RESERVED_START: usize = 86;

/// Strict byte-codec failures. These codecs authenticate neither Solana
/// account ownership nor PDA identity and confer no write authorization.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodecError {
    InvalidLength,
    WrongTypeMagic,
    UnsupportedVersion,
    ReservedBytesNonZero,
    NonCanonicalBoolean,
    NonCanonicalDiscriminant,
}

/// Encode a semantic Position into the fixed B3 Position byte layout.
///
/// The caller's output is changed only after a complete temporary buffer has
/// been constructed, so every error leaves it byte-for-byte unchanged.
pub fn encode_position_state(
    position: &PositionState,
    output: &mut [u8],
) -> Result<(), CodecError> {
    if output.len() != POSITION_ACCOUNT_LEN {
        return Err(CodecError::InvalidLength);
    }
    require_role(position.role)?;

    let mut encoded = [0u8; POSITION_ACCOUNT_LEN];
    write_header(&mut encoded, POSITION_ACCOUNT_MAGIC);
    let mut offset = POSITION_BODY_START;
    write_bytes(&mut encoded, &mut offset, &position.config);
    write_bytes(&mut encoded, &mut offset, &position.owner);
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.position_id.to_le_bytes(),
    );
    write_bytes(&mut encoded, &mut offset, &position.principal.to_le_bytes());
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.accepted_week.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.first_accrual_week.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.term_weeks.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.annual_rate_bps.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.treasury_reserved.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.ecosystem_reserved.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.liquidity_reserved.to_le_bytes(),
    );
    write_bytes(&mut encoded, &mut offset, &position.paid.to_le_bytes());
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.settled_mask.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &position.agency_index.to_le_bytes(),
    );
    write_byte(&mut encoded, &mut offset, position.role);
    write_bool(&mut encoded, &mut offset, position.principal_returned);
    write_bool(&mut encoded, &mut offset, position.closed);
    write_byte(&mut encoded, &mut offset, position.bump);
    debug_assert_eq!(offset, POSITION_ACCOUNT_LEN);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode only the exact fixed B3 Position byte layout.
pub fn decode_position_state(input: &[u8]) -> Result<PositionState, CodecError> {
    require_header(input, POSITION_ACCOUNT_LEN, POSITION_ACCOUNT_MAGIC)?;

    let mut offset = POSITION_BODY_START;
    let config = read_bytes(input, &mut offset);
    let owner = read_bytes(input, &mut offset);
    let position_id = read_u64(input, &mut offset);
    let principal = read_u64(input, &mut offset);
    let accepted_week = read_u64(input, &mut offset);
    let first_accrual_week = read_u64(input, &mut offset);
    let term_weeks = read_u64(input, &mut offset);
    let annual_rate_bps = read_u64(input, &mut offset);
    let treasury_reserved = read_u64(input, &mut offset);
    let ecosystem_reserved = read_u64(input, &mut offset);
    let liquidity_reserved = read_u64(input, &mut offset);
    let paid = read_u64(input, &mut offset);
    let settled_mask = read_u64(input, &mut offset);
    let agency_index = read_u32(input, &mut offset);
    let role = read_byte(input, &mut offset);
    require_role(role)?;
    let principal_returned = read_bool(input, &mut offset)?;
    let closed = read_bool(input, &mut offset)?;
    let bump = read_byte(input, &mut offset);
    let position = PositionState {
        config,
        owner,
        position_id,
        principal,
        accepted_week,
        first_accrual_week,
        term_weeks,
        annual_rate_bps,
        treasury_reserved,
        ecosystem_reserved,
        liquidity_reserved,
        paid,
        settled_mask,
        agency_index,
        role,
        principal_returned,
        closed,
        bump,
    };
    debug_assert_eq!(offset, POSITION_ACCOUNT_LEN);
    Ok(position)
}

/// Encode a semantic Lane into the fixed B3 Lane byte layout.
///
/// The caller's output is changed only after a complete temporary buffer has
/// been constructed, so every error leaves it byte-for-byte unchanged.
pub fn encode_lane_state(lane: &LaneState, output: &mut [u8]) -> Result<(), CodecError> {
    if output.len() != LANE_ACCOUNT_LEN {
        return Err(CodecError::InvalidLength);
    }
    require_lane_discriminant(lane.lane)?;

    let mut encoded = [0u8; LANE_ACCOUNT_LEN];
    write_header(&mut encoded, LANE_ACCOUNT_MAGIC);
    let mut offset = LANE_BODY_START;
    write_bytes(&mut encoded, &mut offset, &lane.config);
    write_bytes(&mut encoded, &mut offset, &lane.token_account);
    write_bytes(&mut encoded, &mut offset, &lane.beneficiary);
    write_bytes(&mut encoded, &mut offset, &lane.total.to_le_bytes());
    write_bytes(
        &mut encoded,
        &mut offset,
        &lane.genesis_unlocked.to_le_bytes(),
    );
    write_bytes(&mut encoded, &mut offset, &lane.cliff_week.to_le_bytes());
    write_bytes(
        &mut encoded,
        &mut offset,
        &lane.linear_end_week.to_le_bytes(),
    );
    write_bytes(&mut encoded, &mut offset, &lane.reserved.to_le_bytes());
    write_bytes(&mut encoded, &mut offset, &lane.paid.to_le_bytes());
    write_bytes(
        &mut encoded,
        &mut offset,
        &lane.principal_claimed.to_le_bytes(),
    );
    write_byte(&mut encoded, &mut offset, lane.lane);
    write_bool(&mut encoded, &mut offset, lane.reward_source);
    write_byte(&mut encoded, &mut offset, lane.bump);
    write_byte(&mut encoded, &mut offset, lane.token_bump);
    debug_assert_eq!(offset, LANE_RESERVED_START);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode only the exact fixed B3 Lane byte layout.
pub fn decode_lane_state(input: &[u8]) -> Result<LaneState, CodecError> {
    require_header(input, LANE_ACCOUNT_LEN, LANE_ACCOUNT_MAGIC)?;
    require_zero_reserved(&input[LANE_RESERVED_START..])?;

    let mut offset = LANE_BODY_START;
    let config = read_bytes(input, &mut offset);
    let token_account = read_bytes(input, &mut offset);
    let beneficiary = read_bytes(input, &mut offset);
    let total = read_u64(input, &mut offset);
    let genesis_unlocked = read_u64(input, &mut offset);
    let cliff_week = read_u64(input, &mut offset);
    let linear_end_week = read_u64(input, &mut offset);
    let reserved = read_u64(input, &mut offset);
    let paid = read_u64(input, &mut offset);
    let principal_claimed = read_u64(input, &mut offset);
    let lane_discriminant = read_byte(input, &mut offset);
    require_lane_discriminant(lane_discriminant)?;
    let reward_source = read_bool(input, &mut offset)?;
    let bump = read_byte(input, &mut offset);
    let token_bump = read_byte(input, &mut offset);
    let lane = LaneState {
        config,
        token_account,
        beneficiary,
        total,
        genesis_unlocked,
        cliff_week,
        linear_end_week,
        reserved,
        paid,
        principal_claimed,
        lane: lane_discriminant,
        reward_source,
        bump,
        token_bump,
    };
    debug_assert_eq!(offset, LANE_RESERVED_START);
    Ok(lane)
}

/// Encode a semantic CoreReward into its fixed B3 byte layout.
pub fn encode_core_reward_state(
    core_reward: &crate::CoreRewardState,
    output: &mut [u8],
) -> Result<(), CodecError> {
    if output.len() != CORE_REWARD_ACCOUNT_LEN {
        return Err(CodecError::InvalidLength);
    }

    let mut encoded = [0u8; CORE_REWARD_ACCOUNT_LEN];
    write_header(&mut encoded, CORE_REWARD_ACCOUNT_MAGIC);
    let mut offset = HEADER_LEN;
    write_bytes(&mut encoded, &mut offset, &core_reward.config);
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.principal.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.annual_rate_bps.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.term_weeks.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.treasury_reserved.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.ecosystem_reserved.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.liquidity_reserved.to_le_bytes(),
    );
    write_bytes(&mut encoded, &mut offset, &core_reward.paid.to_le_bytes());
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.settled_low.to_le_bytes(),
    );
    write_bytes(
        &mut encoded,
        &mut offset,
        &core_reward.settled_high.to_le_bytes(),
    );
    write_byte(&mut encoded, &mut offset, core_reward.bump);
    debug_assert_eq!(offset, CORE_REWARD_RESERVED_START);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode only the exact fixed B3 CoreReward byte layout.
pub fn decode_core_reward_state(input: &[u8]) -> Result<crate::CoreRewardState, CodecError> {
    require_header(input, CORE_REWARD_ACCOUNT_LEN, CORE_REWARD_ACCOUNT_MAGIC)?;
    require_zero_reserved(&input[CORE_REWARD_RESERVED_START..])?;

    let mut offset = HEADER_LEN;
    let core_reward = crate::CoreRewardState {
        config: read_bytes(input, &mut offset),
        principal: read_u64(input, &mut offset),
        annual_rate_bps: read_u64(input, &mut offset),
        term_weeks: read_u64(input, &mut offset),
        treasury_reserved: read_u64(input, &mut offset),
        ecosystem_reserved: read_u64(input, &mut offset),
        liquidity_reserved: read_u64(input, &mut offset),
        paid: read_u64(input, &mut offset),
        settled_low: read_u64(input, &mut offset),
        settled_high: read_u64(input, &mut offset),
        bump: read_byte(input, &mut offset),
    };
    debug_assert_eq!(offset, CORE_REWARD_RESERVED_START);
    Ok(core_reward)
}

/// Encode a semantic Agency into its fixed B3 byte layout.
pub fn encode_agency_state(
    agency: &crate::AgencyState,
    output: &mut [u8],
) -> Result<(), CodecError> {
    if output.len() != AGENCY_ACCOUNT_LEN {
        return Err(CodecError::InvalidLength);
    }

    let mut encoded = [0u8; AGENCY_ACCOUNT_LEN];
    write_header(&mut encoded, AGENCY_ACCOUNT_MAGIC);
    let mut offset = HEADER_LEN;
    write_bytes(&mut encoded, &mut offset, &agency.config);
    write_bytes(&mut encoded, &mut offset, &agency.owner);
    write_bytes(&mut encoded, &mut offset, &agency.index.to_le_bytes());
    write_bytes(
        &mut encoded,
        &mut offset,
        &agency.registered_week.to_le_bytes(),
    );
    write_byte(&mut encoded, &mut offset, agency.bump);
    debug_assert_eq!(offset, AGENCY_RESERVED_START);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode only the exact fixed B3 Agency byte layout.
pub fn decode_agency_state(input: &[u8]) -> Result<crate::AgencyState, CodecError> {
    require_header(input, AGENCY_ACCOUNT_LEN, AGENCY_ACCOUNT_MAGIC)?;
    require_zero_reserved(&input[AGENCY_RESERVED_START..])?;

    let mut offset = HEADER_LEN;
    let agency = crate::AgencyState {
        config: read_bytes(input, &mut offset),
        owner: read_bytes(input, &mut offset),
        index: read_u32(input, &mut offset),
        registered_week: read_u64(input, &mut offset),
        bump: read_byte(input, &mut offset),
    };
    debug_assert_eq!(offset, AGENCY_RESERVED_START);
    Ok(agency)
}

/// Encode a semantic AgencyOwnerIndex into its fixed B3 byte layout.
pub fn encode_agency_owner_index_state(
    owner_index: &crate::AgencyOwnerIndexState,
    output: &mut [u8],
) -> Result<(), CodecError> {
    if output.len() != AGENCY_OWNER_INDEX_ACCOUNT_LEN {
        return Err(CodecError::InvalidLength);
    }

    let mut encoded = [0u8; AGENCY_OWNER_INDEX_ACCOUNT_LEN];
    write_header(&mut encoded, AGENCY_OWNER_INDEX_ACCOUNT_MAGIC);
    let mut offset = HEADER_LEN;
    write_bytes(&mut encoded, &mut offset, &owner_index.config);
    write_bytes(&mut encoded, &mut offset, &owner_index.owner);
    write_bytes(&mut encoded, &mut offset, &owner_index.index.to_le_bytes());
    write_byte(&mut encoded, &mut offset, owner_index.bump);
    debug_assert_eq!(offset, AGENCY_OWNER_INDEX_RESERVED_START);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode only the exact fixed B3 AgencyOwnerIndex byte layout.
pub fn decode_agency_owner_index_state(
    input: &[u8],
) -> Result<crate::AgencyOwnerIndexState, CodecError> {
    require_header(
        input,
        AGENCY_OWNER_INDEX_ACCOUNT_LEN,
        AGENCY_OWNER_INDEX_ACCOUNT_MAGIC,
    )?;
    require_zero_reserved(&input[AGENCY_OWNER_INDEX_RESERVED_START..])?;

    let mut offset = HEADER_LEN;
    let owner_index = crate::AgencyOwnerIndexState {
        config: read_bytes(input, &mut offset),
        owner: read_bytes(input, &mut offset),
        index: read_u32(input, &mut offset),
        bump: read_byte(input, &mut offset),
    };
    debug_assert_eq!(offset, AGENCY_OWNER_INDEX_RESERVED_START);
    Ok(owner_index)
}

/// Encode a semantic Eligibility into its fixed B3 byte layout.
pub fn encode_eligibility_state(
    eligibility: &crate::EligibilityState,
    output: &mut [u8],
) -> Result<(), CodecError> {
    if output.len() != ELIGIBILITY_ACCOUNT_LEN {
        return Err(CodecError::InvalidLength);
    }
    require_role(eligibility.role)?;

    let mut encoded = [0u8; ELIGIBILITY_ACCOUNT_LEN];
    write_header(&mut encoded, ELIGIBILITY_ACCOUNT_MAGIC);
    let mut offset = HEADER_LEN;
    write_bytes(&mut encoded, &mut offset, &eligibility.config);
    write_bytes(&mut encoded, &mut offset, &eligibility.wallet);
    write_bytes(
        &mut encoded,
        &mut offset,
        &eligibility.agency_index.to_le_bytes(),
    );
    write_byte(&mut encoded, &mut offset, eligibility.role);
    write_byte(&mut encoded, &mut offset, eligibility.bump);
    debug_assert_eq!(offset, ELIGIBILITY_RESERVED_START);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode only the exact fixed B3 Eligibility byte layout.
pub fn decode_eligibility_state(input: &[u8]) -> Result<crate::EligibilityState, CodecError> {
    require_header(input, ELIGIBILITY_ACCOUNT_LEN, ELIGIBILITY_ACCOUNT_MAGIC)?;
    require_zero_reserved(&input[ELIGIBILITY_RESERVED_START..])?;

    let mut offset = HEADER_LEN;
    let config = read_bytes(input, &mut offset);
    let wallet = read_bytes(input, &mut offset);
    let agency_index = read_u32(input, &mut offset);
    let role = read_byte(input, &mut offset);
    require_role(role)?;
    let bump = read_byte(input, &mut offset);
    let eligibility = crate::EligibilityState {
        config,
        wallet,
        agency_index,
        role,
        bump,
    };
    debug_assert_eq!(offset, ELIGIBILITY_RESERVED_START);
    Ok(eligibility)
}

fn write_header(output: &mut [u8], magic: [u8; 8]) {
    output[..8].copy_from_slice(&magic);
    output[8] = ACCOUNT_CODEC_VERSION;
}

fn require_header(input: &[u8], expected_len: usize, magic: [u8; 8]) -> Result<(), CodecError> {
    if input.len() != expected_len {
        return Err(CodecError::InvalidLength);
    }
    if input[..8] != magic {
        return Err(CodecError::WrongTypeMagic);
    }
    if input[8] != ACCOUNT_CODEC_VERSION {
        return Err(CodecError::UnsupportedVersion);
    }
    require_zero_reserved(&input[HEADER_RESERVED_START..HEADER_LEN])
}

fn require_zero_reserved(bytes: &[u8]) -> Result<(), CodecError> {
    if bytes.iter().any(|byte| *byte != 0) {
        return Err(CodecError::ReservedBytesNonZero);
    }
    Ok(())
}

fn write_bytes<const N: usize>(output: &mut [u8], offset: &mut usize, bytes: &[u8; N]) {
    let end = *offset + N;
    output[*offset..end].copy_from_slice(bytes);
    *offset = end;
}

fn write_byte(output: &mut [u8], offset: &mut usize, byte: u8) {
    output[*offset] = byte;
    *offset += 1;
}

fn write_bool(output: &mut [u8], offset: &mut usize, value: bool) {
    write_byte(output, offset, u8::from(value));
}

fn read_bytes<const N: usize>(input: &[u8], offset: &mut usize) -> [u8; N] {
    let end = *offset + N;
    let mut value = [0u8; N];
    value.copy_from_slice(&input[*offset..end]);
    *offset = end;
    value
}

fn read_byte(input: &[u8], offset: &mut usize) -> u8 {
    let value = input[*offset];
    *offset += 1;
    value
}

fn read_u32(input: &[u8], offset: &mut usize) -> u32 {
    u32::from_le_bytes(read_bytes(input, offset))
}

fn read_u64(input: &[u8], offset: &mut usize) -> u64 {
    u64::from_le_bytes(read_bytes(input, offset))
}

fn read_bool(input: &[u8], offset: &mut usize) -> Result<bool, CodecError> {
    match read_byte(input, offset) {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(CodecError::NonCanonicalBoolean),
    }
}

fn require_role(role: u8) -> Result<(), CodecError> {
    if role > 2 {
        return Err(CodecError::NonCanonicalDiscriminant);
    }
    Ok(())
}

fn require_lane_discriminant(lane: u8) -> Result<(), CodecError> {
    if !(1..=4).contains(&lane) {
        return Err(CodecError::NonCanonicalDiscriminant);
    }
    Ok(())
}

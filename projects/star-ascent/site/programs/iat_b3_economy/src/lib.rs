#![cfg_attr(not(test), no_std)]
#![forbid(unsafe_code)]

use iat_b3_consensus::{
    iat_transfer_disposition, protocol_local_day, IatTransferDisposition, SolanaDailyDecision,
};

// Exact retained V2 constants. These remain duplicated intentionally until the
// complete V2 policy is extracted into a shared, independently reviewed crate.
pub const TOKEN_DECIMALS: u8 = 9;
pub const MAINNET_SUPPLY: u64 = 1_000_000_000_000_000_000;
pub const REHEARSAL_SUPPLY: u64 = 1_000_000_000_000;
pub const BPS_DENOMINATOR: u128 = 10_000;
pub const RATE_WEEKS: u128 = 52;
pub const SECONDS_PER_DAY: i64 = 86_400;
pub const SECONDS_PER_WEEK: i64 = 604_800;
pub const CCC_FIRST_SELECTION_DELAY_SECONDS: i64 = SECONDS_PER_DAY;
pub const CCC_REVEAL_TIMEOUT_SECONDS: i64 = SECONDS_PER_DAY;
pub const USER_TERM_WEEKS: u64 = 52;
pub const CORE_TERM_WEEKS: u64 = 104;
pub const CORE_RATE_BPS: u64 = 1_700;
pub const STANDARD_RATE_BPS: u64 = 1_000;
pub const CCC_AGENT_RATE_BPS: u64 = 2_800;
pub const CCC_ASSOCIATE_RATE_BPS: u64 = 2_000;

pub const COMMUNITY: u8 = 0;
pub const TREASURY: u8 = 1;
pub const ECOSYSTEM: u8 = 2;
pub const CORE_TEAM: u8 = 3;
pub const LIQUIDITY: u8 = 4;

pub const CCC_DLC_GENESIS_ENABLED: bool = false;
pub const ROUND_PENDING: u8 = 0;
pub const ROUND_SETTLED: u8 = 1;
pub const ROUND_EXPIRED_NEUTRAL: u8 = 2;
pub const NO_SELECTED_AGENCY: u32 = u32::MAX;
pub const NO_DERIVATION_COUNTER: u32 = u32::MAX;

pub const LAW_STATE_MAGIC: &[u8; 8] = b"IATB3S01";
pub const LAW_STATE_VERSION: u8 = 1;
pub const LAW_STATE_LEN: usize = 160;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LanePolicy {
    pub total: u64,
    pub genesis_unlocked: u64,
    pub cliff_week: u64,
    pub linear_end_week: u64,
    pub reward_source: bool,
}

/// Native, host-only semantic representation of the retained V2 `Round`.
/// It has no Anchor discriminator and makes no account-layout compatibility
/// claim; migration must decode V2 and encode B3 explicitly.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RoundState {
    pub config: [u8; 32],
    pub randomness_account: [u8; 32],
    pub week: u64,
    pub commit_slot: u64,
    pub commit_timestamp: i64,
    pub randomness: [u8; 32],
    pub agency_registry_hash_snapshot: [u8; 32],
    pub decision_context: [u8; 32],
    pub agency_count_snapshot: u32,
    pub selected_agency_index: u32,
    pub derivation_counter: u32,
    pub status: u8,
}

/// Native, host-only semantic representation of the retained V2 `Position`.
/// The adapter remains responsible for account ownership, PDA, config-key,
/// and bump validation before passing decoded values into this pure kernel.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PositionState {
    pub config: [u8; 32],
    pub owner: [u8; 32],
    pub position_id: u64,
    pub principal: u64,
    pub accepted_week: u64,
    pub first_accrual_week: u64,
    pub term_weeks: u64,
    pub annual_rate_bps: u64,
    pub treasury_reserved: u64,
    pub ecosystem_reserved: u64,
    pub liquidity_reserved: u64,
    pub paid: u64,
    pub settled_mask: u64,
    pub agency_index: u32,
    pub role: u8,
    pub principal_returned: bool,
    pub closed: bool,
    pub bump: u8,
}

/// Native, host-only semantic representation of the retained V2 `LaneVault`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LaneState {
    pub config: [u8; 32],
    pub token_account: [u8; 32],
    pub beneficiary: [u8; 32],
    pub total: u64,
    pub genesis_unlocked: u64,
    pub cliff_week: u64,
    pub linear_end_week: u64,
    pub reserved: u64,
    pub paid: u64,
    pub principal_claimed: u64,
    pub lane: u8,
    pub reward_source: bool,
    pub bump: u8,
    pub token_bump: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ExpireRoundResult {
    pub round: RoundState,
    pub recovery_timestamp: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ClosePositionResult {
    pub position: PositionState,
    pub treasury: LaneState,
    pub ecosystem: LaneState,
    pub liquidity: LaneState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EconomyError {
    NonCanonicalDailyLawAccount,
    InvalidDailyLawCodec,
    InvalidDailyLawDecision,
    DayUnfinalized,
    DailyLockdown,
    NotActive,
    PositionClosed,
    PrincipalNotReturned,
    PositionWeeksOutstanding,
    WrongLaneOrder,
    ReservationLedgerMismatch,
    CccDlcNotActive,
    RoundAlreadySettled,
    RoundRevealTimeoutNotReached,
    ArithmeticOverflow,
}

/// Runtime-derived immutable identities. A future native adapter must build
/// this value from frozen program/mint constants and PDA derivation, never from
/// instruction data.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CanonicalDailyLawBinding {
    law_program_id: [u8; 32],
    law_state_address: [u8; 32],
    law_state_bump: u8,
    mint: [u8; 32],
    network_genesis_hash: [u8; 32],
}

impl CanonicalDailyLawBinding {
    pub const fn new(
        law_program_id: [u8; 32],
        law_state_address: [u8; 32],
        law_state_bump: u8,
        mint: [u8; 32],
        network_genesis_hash: [u8; 32],
    ) -> Self {
        Self {
            law_program_id,
            law_state_address,
            law_state_bump,
            mint,
            network_genesis_hash,
        }
    }
}

/// Read-only account facts supplied by a future native adapter directly from
/// Solana `AccountInfo`. There is deliberately no `allowed` or disposition
/// field: the verifier derives the only accepted capability from canonical
/// bytes and the consensus kernel.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyDailyLawAccount<'a> {
    key: [u8; 32],
    owner: [u8; 32],
    is_writable: bool,
    data: &'a [u8],
}

impl<'a> ReadonlyDailyLawAccount<'a> {
    pub const fn new(key: [u8; 32], owner: [u8; 32], is_writable: bool, data: &'a [u8]) -> Self {
        Self {
            key,
            owner,
            is_writable,
            data,
        }
    }
}

/// Opaque proof that one exact read-only Daily Law account was canonical,
/// current, and open at one observed Clock timestamp.
///
/// This cannot be constructed from an `ALLOWED` flag because all fields are
/// private and the only constructor is [`verify_daily_law_open`].
#[derive(Debug, Eq, PartialEq)]
pub struct ValidatedDailyLawWrite {
    unix_timestamp: i64,
    local_day: i64,
    law_state_address: [u8; 32],
}

impl ValidatedDailyLawWrite {
    pub const fn unix_timestamp(&self) -> i64 {
        self.unix_timestamp
    }

    pub const fn local_day(&self) -> i64 {
        self.local_day
    }

    pub const fn law_state_address(&self) -> [u8; 32] {
        self.law_state_address
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct DecodedLawState {
    mint: [u8; 32],
    network_genesis_hash: [u8; 32],
    decision: Option<SolanaDailyDecision>,
}

/// Validate the exact fixed Daily Law codec and derive an opaque open-day
/// capability. This function is read-only and performs no account mutation or
/// cross-program invocation.
pub fn verify_daily_law_open(
    binding: &CanonicalDailyLawBinding,
    observed: ReadonlyDailyLawAccount<'_>,
    clock_unix_timestamp: i64,
) -> Result<ValidatedDailyLawWrite, EconomyError> {
    if observed.key != binding.law_state_address
        || observed.owner != binding.law_program_id
        || observed.is_writable
    {
        return Err(EconomyError::NonCanonicalDailyLawAccount);
    }

    let state = decode_law_state(observed.data, binding.law_state_bump)?;
    if state.mint != binding.mint || state.network_genesis_hash != binding.network_genesis_hash {
        return Err(EconomyError::NonCanonicalDailyLawAccount);
    }

    let disposition = iat_transfer_disposition(
        clock_unix_timestamp,
        state.decision,
        state.network_genesis_hash,
        state.mint,
    )
    .map_err(|_| EconomyError::InvalidDailyLawDecision)?;

    match disposition {
        IatTransferDisposition::Allowed => Ok(ValidatedDailyLawWrite {
            unix_timestamp: clock_unix_timestamp,
            local_day: protocol_local_day(clock_unix_timestamp),
            law_state_address: observed.key,
        }),
        IatTransferDisposition::DayUnfinalized => Err(EconomyError::DayUnfinalized),
        IatTransferDisposition::RejectedDailyLockdown => Err(EconomyError::DailyLockdown),
    }
}

/// Production-facing internal transition. The retained CCC DLC is immutable
/// inactive in the Genesis candidate, so this function currently fails before
/// changing the by-value round state. The transition kernel below remains
/// testable for exact V2 differential evidence without exposing a dispatcher.
pub fn expire_round(
    gate: &ValidatedDailyLawWrite,
    round: RoundState,
) -> Result<ExpireRoundResult, EconomyError> {
    if !CCC_DLC_GENESIS_ENABLED {
        return Err(EconomyError::CccDlcNotActive);
    }
    expire_pending_round(round, gate.unix_timestamp)
}

/// Pure retained V2 `close_position` handler-body transition. The opaque gate
/// proves the canonical Daily Law was open before any state value reached this
/// function. A future native adapter must additionally validate the decoded
/// config/position/lane account identities and PDAs before calling it.
///
/// Inputs and outputs are by value, so a failed lane reconciliation cannot
/// expose the V2 helper's intermediate mutations outside this atomic kernel.
pub fn close_position(
    _gate: &ValidatedDailyLawWrite,
    config_active: bool,
    position: PositionState,
    treasury: LaneState,
    ecosystem: LaneState,
    liquidity: LaneState,
) -> Result<ClosePositionResult, EconomyError> {
    close_position_transition(config_active, position, treasury, ecosystem, liquidity)
}

fn close_position_transition(
    config_active: bool,
    mut position: PositionState,
    mut treasury: LaneState,
    mut ecosystem: LaneState,
    mut liquidity: LaneState,
) -> Result<ClosePositionResult, EconomyError> {
    if !config_active {
        return Err(EconomyError::NotActive);
    }
    if position.closed {
        return Err(EconomyError::PositionClosed);
    }
    if !position.principal_returned {
        return Err(EconomyError::PrincipalNotReturned);
    }
    if position.settled_mask != full_position_settlement_mask() {
        return Err(EconomyError::PositionWeeksOutstanding);
    }
    if treasury.lane != TREASURY || ecosystem.lane != ECOSYSTEM || liquidity.lane != LIQUIDITY {
        return Err(EconomyError::WrongLaneOrder);
    }

    release_reserved_lane(&mut treasury, &mut position.treasury_reserved)?;
    release_reserved_lane(&mut ecosystem, &mut position.ecosystem_reserved)?;
    release_reserved_lane(&mut liquidity, &mut position.liquidity_reserved)?;
    position.closed = true;

    Ok(ClosePositionResult {
        position,
        treasury,
        ecosystem,
        liquidity,
    })
}

const fn full_position_settlement_mask() -> u64 {
    (1u64 << USER_TERM_WEEKS) - 1
}

fn release_reserved_lane(
    lane: &mut LaneState,
    position_reserved: &mut u64,
) -> Result<(), EconomyError> {
    if *position_reserved > lane.reserved {
        return Err(EconomyError::ReservationLedgerMismatch);
    }
    lane.reserved = lane
        .reserved
        .checked_sub(*position_reserved)
        .ok_or(EconomyError::ReservationLedgerMismatch)?;
    *position_reserved = 0;
    Ok(())
}

fn expire_pending_round(
    mut round: RoundState,
    clock_unix_timestamp: i64,
) -> Result<ExpireRoundResult, EconomyError> {
    if round.status != ROUND_PENDING {
        return Err(EconomyError::RoundAlreadySettled);
    }
    let recovery_timestamp = round
        .commit_timestamp
        .checked_add(CCC_REVEAL_TIMEOUT_SECONDS)
        .ok_or(EconomyError::ArithmeticOverflow)?;
    if clock_unix_timestamp < recovery_timestamp {
        return Err(EconomyError::RoundRevealTimeoutNotReached);
    }

    round.randomness = [0; 32];
    round.selected_agency_index = NO_SELECTED_AGENCY;
    round.derivation_counter = NO_DERIVATION_COUNTER;
    round.status = ROUND_EXPIRED_NEUTRAL;
    Ok(ExpireRoundResult {
        round,
        recovery_timestamp,
    })
}

fn decode_law_state(data: &[u8], expected_bump: u8) -> Result<DecodedLawState, EconomyError> {
    if data.len() != LAW_STATE_LEN
        || data.get(0..8) != Some(LAW_STATE_MAGIC)
        || data[8] != LAW_STATE_VERSION
        || data[9] != expected_bump
        || data[12..16].iter().any(|byte| *byte != 0)
        || data[142..].iter().any(|byte| *byte != 0)
    {
        return Err(EconomyError::InvalidDailyLawCodec);
    }

    let mint = copy_array::<32>(&data[16..48])?;
    let network_genesis_hash = copy_array::<32>(&data[48..80])?;
    let decision = match data[10] {
        0 => {
            if data[11] != 0 || data[80..142].iter().any(|byte| *byte != 0) {
                return Err(EconomyError::InvalidDailyLawCodec);
            }
            None
        }
        1 => {
            let locked = match data[11] {
                0 => false,
                1 => true,
                _ => return Err(EconomyError::InvalidDailyLawCodec),
            };
            Some(SolanaDailyDecision {
                local_day: i64::from_le_bytes(copy_array::<8>(&data[80..88])?),
                entropy_slot: u64::from_le_bytes(copy_array::<8>(&data[88..96])?),
                ancestor_slot_hash: copy_array::<32>(&data[96..128])?,
                draw_counter: u64::from_le_bytes(copy_array::<8>(&data[128..136])?),
                draw_bucket: u16::from_le_bytes(copy_array::<2>(&data[136..138])?),
                chance_numerator: u16::from_le_bytes(copy_array::<2>(&data[138..140])?),
                chance_denominator: u16::from_le_bytes(copy_array::<2>(&data[140..142])?),
                locked,
            })
        }
        _ => return Err(EconomyError::InvalidDailyLawCodec),
    };

    Ok(DecodedLawState {
        mint,
        network_genesis_hash,
        decision,
    })
}

fn copy_array<const N: usize>(input: &[u8]) -> Result<[u8; N], EconomyError> {
    input
        .try_into()
        .map_err(|_| EconomyError::InvalidDailyLawCodec)
}

#[cfg(test)]
mod tests {
    use super::*;
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};
    use iat_v2::policy as v2_policy;
    use iat_v2::{LaneVault as V2LaneState, Position as V2PositionState};

    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const FRIDAY_BOUNDARY_UTC: i64 = 1_786_050_060;

    fn binding() -> CanonicalDailyLawBinding {
        CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK)
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

    fn verify(timestamp: i64, data: &[u8]) -> Result<ValidatedDailyLawWrite, EconomyError> {
        verify_daily_law_open(
            &binding(),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, data),
            timestamp,
        )
    }

    fn pending_round(commit_timestamp: i64) -> RoundState {
        RoundState {
            config: [1; 32],
            randomness_account: [2; 32],
            week: 7,
            commit_slot: 42,
            commit_timestamp,
            randomness: [0xA5; 32],
            agency_registry_hash_snapshot: [3; 32],
            decision_context: [4; 32],
            agency_count_snapshot: 11,
            selected_agency_index: 5,
            derivation_counter: 6,
            status: ROUND_PENDING,
        }
    }

    fn position_state(
        treasury_reserved: u64,
        ecosystem_reserved: u64,
        liquidity_reserved: u64,
    ) -> PositionState {
        PositionState {
            config: [1; 32],
            owner: [2; 32],
            position_id: 17,
            principal: 400,
            accepted_week: 3,
            first_accrual_week: 4,
            term_weeks: USER_TERM_WEEKS,
            annual_rate_bps: STANDARD_RATE_BPS,
            treasury_reserved,
            ecosystem_reserved,
            liquidity_reserved,
            paid: 91,
            settled_mask: full_position_settlement_mask(),
            agency_index: 8,
            role: 1,
            principal_returned: true,
            closed: false,
            bump: 253,
        }
    }

    fn lane_state(lane: u8, reserved: u64, marker: u8) -> LaneState {
        LaneState {
            config: [1; 32],
            token_account: [marker; 32],
            beneficiary: [marker.wrapping_add(1); 32],
            total: 10_000,
            genesis_unlocked: 20,
            cliff_week: 5,
            linear_end_week: 100,
            reserved,
            paid: 700 + u64::from(marker),
            principal_claimed: 300,
            lane,
            reward_source: true,
            bump: marker,
            token_bump: marker.wrapping_add(2),
        }
    }

    fn v2_position(
        treasury_reserved: u64,
        ecosystem_reserved: u64,
        liquidity_reserved: u64,
    ) -> V2PositionState {
        V2PositionState {
            config: Default::default(),
            owner: Default::default(),
            position_id: 17,
            principal: 400,
            accepted_week: 3,
            first_accrual_week: 4,
            term_weeks: v2_policy::USER_TERM_WEEKS,
            annual_rate_bps: v2_policy::STANDARD_RATE_BPS,
            treasury_reserved,
            ecosystem_reserved,
            liquidity_reserved,
            paid: 91,
            settled_mask: (1u64 << v2_policy::USER_TERM_WEEKS) - 1,
            agency_index: 8,
            role: 1,
            principal_returned: true,
            closed: false,
            bump: 253,
        }
    }

    fn v2_lane(lane: u8, reserved: u64, marker: u8) -> V2LaneState {
        V2LaneState {
            config: Default::default(),
            token_account: Default::default(),
            beneficiary: Default::default(),
            total: 10_000,
            genesis_unlocked: 20,
            cliff_week: 5,
            linear_end_week: 100,
            reserved,
            paid: 700 + u64::from(marker),
            principal_claimed: 300,
            lane,
            reward_source: true,
            bump: marker,
            token_bump: marker.wrapping_add(2),
        }
    }

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    enum CloseObservation {
        Error(EconomyError),
        Success {
            position_reserved: [u64; 3],
            lane_reserved: [u64; 3],
            lane_paid: [u64; 3],
            position_paid: u64,
            position_closed: bool,
        },
    }

    fn observe_close_result(result: Result<ClosePositionResult, EconomyError>) -> CloseObservation {
        match result {
            Err(error) => CloseObservation::Error(error),
            Ok(result) => CloseObservation::Success {
                position_reserved: [
                    result.position.treasury_reserved,
                    result.position.ecosystem_reserved,
                    result.position.liquidity_reserved,
                ],
                lane_reserved: [
                    result.treasury.reserved,
                    result.ecosystem.reserved,
                    result.liquidity.reserved,
                ],
                lane_paid: [
                    result.treasury.paid,
                    result.ecosystem.paid,
                    result.liquidity.paid,
                ],
                position_paid: result.position.paid,
                position_closed: result.position.closed,
            },
        }
    }

    fn v2_release_reserved_lane(
        lane: &mut V2LaneState,
        position_reserved: &mut u64,
    ) -> Result<(), EconomyError> {
        if *position_reserved > lane.reserved {
            return Err(EconomyError::ReservationLedgerMismatch);
        }
        lane.reserved = lane
            .reserved
            .checked_sub(*position_reserved)
            .ok_or(EconomyError::ReservationLedgerMismatch)?;
        *position_reserved = 0;
        Ok(())
    }

    /// Independent, line-for-line semantic oracle for the retained V2
    /// `close_position` handler and `release_three_reservations` helper. It
    /// operates on the actual V2 state types so field/schema drift fails the
    /// economy crate's differential tests at compile time.
    fn v2_close_position_reference(
        config_active: bool,
        mut position: V2PositionState,
        mut treasury: V2LaneState,
        mut ecosystem: V2LaneState,
        mut liquidity: V2LaneState,
    ) -> CloseObservation {
        let result = (|| {
            if !config_active {
                return Err(EconomyError::NotActive);
            }
            if position.closed {
                return Err(EconomyError::PositionClosed);
            }
            if !position.principal_returned {
                return Err(EconomyError::PrincipalNotReturned);
            }
            if position.settled_mask != (1u64 << v2_policy::USER_TERM_WEEKS) - 1 {
                return Err(EconomyError::PositionWeeksOutstanding);
            }
            if treasury.lane != v2_policy::TREASURY
                || ecosystem.lane != v2_policy::ECOSYSTEM
                || liquidity.lane != v2_policy::LIQUIDITY
            {
                return Err(EconomyError::WrongLaneOrder);
            }

            v2_release_reserved_lane(&mut treasury, &mut position.treasury_reserved)?;
            v2_release_reserved_lane(&mut ecosystem, &mut position.ecosystem_reserved)?;
            v2_release_reserved_lane(&mut liquidity, &mut position.liquidity_reserved)?;
            position.closed = true;
            Ok(())
        })();

        match result {
            Err(error) => CloseObservation::Error(error),
            Ok(()) => CloseObservation::Success {
                position_reserved: [
                    position.treasury_reserved,
                    position.ecosystem_reserved,
                    position.liquidity_reserved,
                ],
                lane_reserved: [treasury.reserved, ecosystem.reserved, liquidity.reserved],
                lane_paid: [treasury.paid, ecosystem.paid, liquidity.paid],
                position_paid: position.paid,
                position_closed: position.closed,
            },
        }
    }

    #[test]
    fn immutable_constants_match_the_retained_v2_policy() {
        assert_eq!(TOKEN_DECIMALS, v2_policy::TOKEN_DECIMALS);
        assert_eq!(MAINNET_SUPPLY, v2_policy::MAINNET_SUPPLY);
        assert_eq!(REHEARSAL_SUPPLY, v2_policy::REHEARSAL_SUPPLY);
        assert_eq!(BPS_DENOMINATOR, v2_policy::BPS_DENOMINATOR);
        assert_eq!(RATE_WEEKS, v2_policy::RATE_WEEKS);
        assert_eq!(SECONDS_PER_DAY, v2_policy::SECONDS_PER_DAY);
        assert_eq!(SECONDS_PER_WEEK, v2_policy::SECONDS_PER_WEEK);
        assert_eq!(
            CCC_FIRST_SELECTION_DELAY_SECONDS,
            v2_policy::CCC_FIRST_SELECTION_DELAY_SECONDS
        );
        assert_eq!(
            CCC_REVEAL_TIMEOUT_SECONDS,
            v2_policy::CCC_REVEAL_TIMEOUT_SECONDS
        );
        assert_eq!(USER_TERM_WEEKS, v2_policy::USER_TERM_WEEKS);
        assert_eq!(CORE_TERM_WEEKS, v2_policy::CORE_TERM_WEEKS);
        assert_eq!(CORE_RATE_BPS, v2_policy::CORE_RATE_BPS);
        assert_eq!(STANDARD_RATE_BPS, v2_policy::STANDARD_RATE_BPS);
        assert_eq!(CCC_AGENT_RATE_BPS, v2_policy::CCC_AGENT_RATE_BPS);
        assert_eq!(CCC_ASSOCIATE_RATE_BPS, v2_policy::CCC_ASSOCIATE_RATE_BPS);
        assert_eq!(COMMUNITY, v2_policy::COMMUNITY);
        assert_eq!(TREASURY, v2_policy::TREASURY);
        assert_eq!(ECOSYSTEM, v2_policy::ECOSYSTEM);
        assert_eq!(CORE_TEAM, v2_policy::CORE_TEAM);
        assert_eq!(LIQUIDITY, v2_policy::LIQUIDITY);
        assert_eq!(CCC_DLC_GENESIS_ENABLED, iat_v2::CCC_DLC_GENESIS_ENABLED);
        assert_eq!(ROUND_PENDING, iat_v2::ROUND_PENDING);
        assert_eq!(ROUND_SETTLED, iat_v2::ROUND_SETTLED);
        assert_eq!(ROUND_EXPIRED_NEUTRAL, iat_v2::ROUND_EXPIRED_NEUTRAL);
    }

    #[test]
    fn close_position_differential_vectors_match_the_retained_v2_handler() {
        #[derive(Clone, Copy)]
        struct Vector {
            active: bool,
            closed: bool,
            principal_returned: bool,
            settled_mask: u64,
            position_reserved: [u64; 3],
            lane_reserved: [u64; 3],
            lane_order: [u8; 3],
        }

        let full_mask = full_position_settlement_mask();
        let vectors = [
            Vector {
                active: true,
                closed: false,
                principal_returned: true,
                settled_mask: full_mask,
                position_reserved: [0, 0, 0],
                lane_reserved: [0, 0, 0],
                lane_order: [TREASURY, ECOSYSTEM, LIQUIDITY],
            },
            Vector {
                active: true,
                closed: false,
                principal_returned: true,
                settled_mask: full_mask,
                position_reserved: [3, 5, 8],
                lane_reserved: [3, 9, 13],
                lane_order: [TREASURY, ECOSYSTEM, LIQUIDITY],
            },
            Vector {
                active: false,
                closed: true,
                principal_returned: false,
                settled_mask: 0,
                position_reserved: [4, 4, 4],
                lane_reserved: [0, 0, 0],
                lane_order: [LIQUIDITY, TREASURY, ECOSYSTEM],
            },
            Vector {
                active: true,
                closed: true,
                principal_returned: false,
                settled_mask: 0,
                position_reserved: [4, 4, 4],
                lane_reserved: [0, 0, 0],
                lane_order: [LIQUIDITY, TREASURY, ECOSYSTEM],
            },
            Vector {
                active: true,
                closed: false,
                principal_returned: false,
                settled_mask: 0,
                position_reserved: [4, 4, 4],
                lane_reserved: [0, 0, 0],
                lane_order: [LIQUIDITY, TREASURY, ECOSYSTEM],
            },
            Vector {
                active: true,
                closed: false,
                principal_returned: true,
                settled_mask: full_mask - 1,
                position_reserved: [4, 4, 4],
                lane_reserved: [0, 0, 0],
                lane_order: [LIQUIDITY, TREASURY, ECOSYSTEM],
            },
            Vector {
                active: true,
                closed: false,
                principal_returned: true,
                settled_mask: full_mask,
                position_reserved: [4, 4, 4],
                lane_reserved: [0, 0, 0],
                lane_order: [LIQUIDITY, TREASURY, ECOSYSTEM],
            },
            Vector {
                active: true,
                closed: false,
                principal_returned: true,
                settled_mask: full_mask,
                position_reserved: [4, 4, 4],
                lane_reserved: [3, 4, 4],
                lane_order: [TREASURY, ECOSYSTEM, LIQUIDITY],
            },
            Vector {
                active: true,
                closed: false,
                principal_returned: true,
                settled_mask: full_mask,
                position_reserved: [4, 4, 4],
                lane_reserved: [4, 3, 4],
                lane_order: [TREASURY, ECOSYSTEM, LIQUIDITY],
            },
            Vector {
                active: true,
                closed: false,
                principal_returned: true,
                settled_mask: full_mask,
                position_reserved: [4, 4, 4],
                lane_reserved: [4, 4, 3],
                lane_order: [TREASURY, ECOSYSTEM, LIQUIDITY],
            },
        ];

        for vector in vectors {
            let mut position = position_state(
                vector.position_reserved[0],
                vector.position_reserved[1],
                vector.position_reserved[2],
            );
            position.closed = vector.closed;
            position.principal_returned = vector.principal_returned;
            position.settled_mask = vector.settled_mask;
            let actual = observe_close_result(close_position_transition(
                vector.active,
                position,
                lane_state(vector.lane_order[0], vector.lane_reserved[0], 10),
                lane_state(vector.lane_order[1], vector.lane_reserved[1], 20),
                lane_state(vector.lane_order[2], vector.lane_reserved[2], 30),
            ));

            let mut reference_position = v2_position(
                vector.position_reserved[0],
                vector.position_reserved[1],
                vector.position_reserved[2],
            );
            reference_position.closed = vector.closed;
            reference_position.principal_returned = vector.principal_returned;
            reference_position.settled_mask = vector.settled_mask;
            let expected = v2_close_position_reference(
                vector.active,
                reference_position,
                v2_lane(vector.lane_order[0], vector.lane_reserved[0], 10),
                v2_lane(vector.lane_order[1], vector.lane_reserved[1], 20),
                v2_lane(vector.lane_order[2], vector.lane_reserved[2], 30),
            );

            assert_eq!(actual, expected);
        }
    }

    #[test]
    fn close_position_changes_only_v2_reservations_and_terminal_flag() {
        let position = position_state(3, 5, 8);
        let treasury = lane_state(TREASURY, 7, 10);
        let ecosystem = lane_state(ECOSYSTEM, 11, 20);
        let liquidity = lane_state(LIQUIDITY, 17, 30);

        let result =
            close_position_transition(true, position, treasury, ecosystem, liquidity).unwrap();

        assert_eq!(
            result.position,
            PositionState {
                treasury_reserved: 0,
                ecosystem_reserved: 0,
                liquidity_reserved: 0,
                closed: true,
                ..position
            }
        );
        assert_eq!(
            result.treasury,
            LaneState {
                reserved: 4,
                ..treasury
            }
        );
        assert_eq!(
            result.ecosystem,
            LaneState {
                reserved: 6,
                ..ecosystem
            }
        );
        assert_eq!(
            result.liquidity,
            LaneState {
                reserved: 9,
                ..liquidity
            }
        );
    }

    #[test]
    fn close_position_requires_an_open_canonical_daily_law_capability() {
        let open_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &open_bytes).unwrap();
        let result = close_position(
            &gate,
            true,
            position_state(1, 2, 3),
            lane_state(TREASURY, 1, 10),
            lane_state(ECOSYSTEM, 2, 20),
            lane_state(LIQUIDITY, 3, 30),
        )
        .unwrap();
        assert!(result.position.closed);

        let locked_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, true)));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &locked_bytes),
            Err(EconomyError::DailyLockdown)
        );
    }

    #[test]
    fn exact_timeout_matches_v2_and_produces_the_terminal_neutral_state() {
        let commit_timestamp = FRIDAY_BOUNDARY_UTC - CCC_REVEAL_TIMEOUT_SECONDS;
        let before = FRIDAY_BOUNDARY_UTC - 1;
        assert_eq!(
            v2_policy::ccc_round_recovery_available(commit_timestamp, before),
            Some(false)
        );
        assert_eq!(
            expire_pending_round(pending_round(commit_timestamp), before),
            Err(EconomyError::RoundRevealTimeoutNotReached)
        );
        assert_eq!(
            v2_policy::ccc_round_recovery_available(commit_timestamp, FRIDAY_BOUNDARY_UTC),
            Some(true)
        );

        let result =
            expire_pending_round(pending_round(commit_timestamp), FRIDAY_BOUNDARY_UTC).unwrap();
        assert_eq!(result.recovery_timestamp, FRIDAY_BOUNDARY_UTC);
        assert_eq!(result.round.randomness, [0; 32]);
        assert_eq!(result.round.selected_agency_index, u32::MAX);
        assert_eq!(result.round.derivation_counter, u32::MAX);
        assert_eq!(result.round.status, iat_v2::ROUND_EXPIRED_NEUTRAL);
        assert_eq!(result.round.agency_count_snapshot, 11);
        assert_eq!(result.round.agency_registry_hash_snapshot, [3; 32]);
        assert_eq!(result.round.decision_context, [4; 32]);
    }

    #[test]
    fn timeout_overflow_and_nonpending_rounds_fail_closed() {
        assert_eq!(
            expire_pending_round(pending_round(i64::MAX), i64::MAX),
            Err(EconomyError::ArithmeticOverflow)
        );
        let mut settled = pending_round(FRIDAY_BOUNDARY_UTC - SECONDS_PER_DAY);
        settled.status = ROUND_SETTLED;
        assert_eq!(
            expire_pending_round(settled, FRIDAY_BOUNDARY_UTC),
            Err(EconomyError::RoundAlreadySettled)
        );
    }

    #[test]
    fn production_transition_preserves_the_immutable_inactive_ccc_boundary() {
        let bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &bytes).unwrap();
        assert_eq!(
            expire_round(
                &gate,
                pending_round(FRIDAY_BOUNDARY_UTC - CCC_REVEAL_TIMEOUT_SECONDS)
            ),
            Err(EconomyError::CccDlcNotActive)
        );
    }

    #[test]
    fn missing_and_stale_daily_law_state_fail_closed() {
        let missing = pack_law_state(None);
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &missing),
            Err(EconomyError::DayUnfinalized)
        );

        let stale_decision = create_solana_daily_decision(
            protocol_local_day(FRIDAY_BOUNDARY_UTC) - 1,
            42_424_000,
            [0x55; 32],
            NETWORK,
            MINT,
        )
        .unwrap();
        let stale = pack_law_state(Some(stale_decision));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &stale),
            Err(EconomyError::DayUnfinalized)
        );
    }

    #[test]
    fn locked_and_forged_daily_law_state_fail_closed() {
        let locked = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, true)));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &locked),
            Err(EconomyError::DailyLockdown)
        );

        let mut forged = decision_for(FRIDAY_BOUNDARY_UTC, false);
        forged.locked = true;
        let forged = pack_law_state(Some(forged));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &forged),
            Err(EconomyError::InvalidDailyLawDecision)
        );
    }

    #[test]
    fn wrong_identity_writable_or_corrupt_law_accounts_fail_closed() {
        let bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        for observed in [
            ReadonlyDailyLawAccount::new([9; 32], LAW_PROGRAM, false, &bytes),
            ReadonlyDailyLawAccount::new(LAW_STATE, [9; 32], false, &bytes),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, true, &bytes),
        ] {
            assert_eq!(
                verify_daily_law_open(&binding(), observed, FRIDAY_BOUNDARY_UTC),
                Err(EconomyError::NonCanonicalDailyLawAccount)
            );
        }

        let mut corrupt = bytes;
        corrupt[159] = 1;
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &corrupt),
            Err(EconomyError::InvalidDailyLawCodec)
        );
    }
}

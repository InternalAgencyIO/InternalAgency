#![cfg_attr(not(test), no_std)]
#![forbid(unsafe_code)]

use iat_b3_consensus::{
    iat_transfer_disposition, protocol_local_day, IatTransferDisposition, SolanaDailyDecision,
};
use sha2::{Digest, Sha256};

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
pub const TIEBREAK_DOMAIN: &[u8] = b"IAT_TIEBREAK_V1";
pub const TIEBREAK_MAX_DERIVATION_ATTEMPTS: u32 = 16;
pub const CCC_TIEBREAK_CONTEXT_DOMAIN: &[u8] = b"IAT_CCC_WEEKLY_TIEBREAK_V1";

pub const COMMUNITY: u8 = 0;
pub const TREASURY: u8 = 1;
pub const ECOSYSTEM: u8 = 2;
pub const CORE_TEAM: u8 = 3;
pub const LIQUIDITY: u8 = 4;

pub const CCC_DLC_GENESIS_ENABLED: bool = false;
pub const RANDOMNESS_ADAPTER_VERIFIED: bool = true;
pub const ROUND_PENDING: u8 = 0;
pub const ROUND_SETTLED: u8 = 1;
pub const ROUND_EXPIRED_NEUTRAL: u8 = 2;
pub const NO_SELECTED_AGENCY: u32 = u32::MAX;
pub const NO_DERIVATION_COUNTER: u32 = u32::MAX;

pub const LAW_STATE_MAGIC: &[u8; 8] = b"IATB3S01";
pub const LAW_STATE_VERSION: u8 = 1;
pub const LAW_STATE_LEN: usize = 160;

pub const RANDOMNESS_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
pub const RANDOMNESS_COMMIT_DISCRIMINATOR: [u8; 8] = [52, 170, 152, 201, 179, 133, 242, 141];
pub const RANDOMNESS_ACCOUNT_SIZE: usize = 408;
const RANDOMNESS_SEED_SLOT_START: usize = 104;
const RANDOMNESS_REVEAL_SLOT_START: usize = 144;
const RANDOMNESS_VALUE_START: usize = 152;

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
pub struct SettleRoundResult {
    pub round: RoundState,
    pub reveal_slot: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CommitRoundResult {
    pub round: RoundState,
    pub round_bump: u8,
}

/// Exact retained V2 config projection consumed by `commit_round`. It is a
/// semantic value only; a future native adapter must validate and decode the
/// canonical config PDA before constructing it.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CommitRoundConfigState {
    pub key: [u8; 32],
    pub randomness_program: [u8; 32],
    pub agency_registry_hash: [u8; 32],
    pub genesis_timestamp: i64,
    pub agency_count: u32,
    pub active: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InstructionAccountMeta {
    pub key: [u8; 32],
    pub is_signer: bool,
    pub is_writable: bool,
}

/// Framework-neutral decoded instruction used only to prove the immediately
/// preceding Switchboard commit. No instruction is executed by this crate.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyInstruction<'a> {
    program_id: [u8; 32],
    accounts: &'a [InstructionAccountMeta],
    data: &'a [u8],
}

impl<'a> ReadonlyInstruction<'a> {
    pub const fn new(
        program_id: [u8; 32],
        accounts: &'a [InstructionAccountMeta],
        data: &'a [u8],
    ) -> Self {
        Self {
            program_id,
            accounts,
            data,
        }
    }
}

/// Decoded canonical instructions-sysvar view. `current_instruction_index`
/// remains optional so malformed/missing sysvar decoding fails with the exact
/// retained V2 error before any state snapshot is returned.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyInstructionTrace<'a> {
    current_instruction_index: Option<u16>,
    instructions: &'a [ReadonlyInstruction<'a>],
}

impl<'a> ReadonlyInstructionTrace<'a> {
    pub const fn new(
        current_instruction_index: Option<u16>,
        instructions: &'a [ReadonlyInstruction<'a>],
    ) -> Self {
        Self {
            current_instruction_index,
            instructions,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CommitRoundInput<'a> {
    pub config: CommitRoundConfigState,
    pub week: u64,
    pub payer: [u8; 32],
    pub randomness_account_key: [u8; 32],
    pub randomness_account: ReadonlyRoundRandomnessAccount<'a>,
    pub instruction_trace: ReadonlyInstructionTrace<'a>,
    pub clock_slot: u64,
    pub round_bump: u8,
}

/// Read-only Switchboard account facts supplied by a future native adapter.
/// The adapter must bind the key to `RoundState.randomness_account` before
/// calling this host-only kernel; owner, codec, commit, and reveal freshness
/// are validated again inside the transition in retained V2 order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyRoundRandomnessAccount<'a> {
    owner: [u8; 32],
    data: &'a [u8],
}

impl<'a> ReadonlyRoundRandomnessAccount<'a> {
    pub const fn new(owner: [u8; 32], data: &'a [u8]) -> Self {
        Self { owner, data }
    }
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
    RandomnessAdapterNotVerified,
    NoEligibleAgencies,
    CccSelectionNotOpen,
    WrongRoundWeek,
    RandomnessCommitInstructionMissing,
    InvalidRandomnessCommitInstruction,
    RandomnessCommitNotFresh,
    RoundAlreadySettled,
    WrongRandomnessProgram,
    RoundRevealWindowExpired,
    InvalidRandomnessAccount,
    RandomnessNotFresh,
    RandomnessCommitSlotMismatch,
    RandomnessRevealNotAfterCommit,
    TiebreakDerivationExhausted,
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

/// Production-facing retained V2 `commit_round` boundary. The Genesis build
/// remains CCC-disabled, so this returns before validating the decoded
/// instruction trace or constructing a round snapshot. No account is created
/// and no instruction is invoked by this host-only library.
pub fn commit_round(
    gate: &ValidatedDailyLawWrite,
    input: CommitRoundInput<'_>,
) -> Result<CommitRoundResult, EconomyError> {
    if !CCC_DLC_GENESIS_ENABLED {
        return Err(EconomyError::CccDlcNotActive);
    }
    if !RANDOMNESS_ADAPTER_VERIFIED {
        return Err(EconomyError::RandomnessAdapterNotVerified);
    }
    commit_round_transition(input, gate.unix_timestamp)
}

fn commit_round_transition(
    input: CommitRoundInput<'_>,
    clock_unix_timestamp: i64,
) -> Result<CommitRoundResult, EconomyError> {
    if !input.config.active {
        return Err(EconomyError::NotActive);
    }
    if input.config.agency_count == 0 {
        return Err(EconomyError::NoEligibleAgencies);
    }

    let expected_week = current_ccc_round(input.config.genesis_timestamp, clock_unix_timestamp)
        .ok_or(EconomyError::CccSelectionNotOpen)?;
    if input.week != expected_week {
        return Err(EconomyError::WrongRoundWeek);
    }
    if input.randomness_account.owner != input.config.randomness_program {
        return Err(EconomyError::WrongRandomnessProgram);
    }

    let commit_instruction = immediately_preceding_instruction(input.instruction_trace)?;
    validate_round_commit_instruction(
        commit_instruction,
        input.config.randomness_program,
        input.randomness_account_key,
        input.payer,
    )
    .map_err(|()| EconomyError::InvalidRandomnessCommitInstruction)?;

    let randomness = parse_round_randomness(input.randomness_account.data)
        .ok_or(EconomyError::InvalidRandomnessAccount)?;
    if input.clock_slot.checked_sub(1) != Some(randomness.seed_slot)
        || randomness.reveal_slot == input.clock_slot
    {
        return Err(EconomyError::RandomnessCommitNotFresh);
    }

    let decision_context = ccc_tiebreak_context(
        input.config.key,
        input.week,
        input.config.agency_registry_hash,
    );
    Ok(CommitRoundResult {
        round: RoundState {
            config: input.config.key,
            randomness_account: input.randomness_account_key,
            week: input.week,
            commit_slot: randomness.seed_slot,
            commit_timestamp: clock_unix_timestamp,
            randomness: [0; 32],
            agency_registry_hash_snapshot: input.config.agency_registry_hash,
            decision_context,
            agency_count_snapshot: input.config.agency_count,
            selected_agency_index: NO_SELECTED_AGENCY,
            derivation_counter: NO_DERIVATION_COUNTER,
            status: ROUND_PENDING,
        },
        round_bump: input.round_bump,
    })
}

fn immediately_preceding_instruction(
    trace: ReadonlyInstructionTrace<'_>,
) -> Result<ReadonlyInstruction<'_>, EconomyError> {
    let current_index = usize::from(
        trace
            .current_instruction_index
            .ok_or(EconomyError::RandomnessCommitInstructionMissing)?,
    );
    if current_index == 0 || current_index >= trace.instructions.len() {
        return Err(EconomyError::RandomnessCommitInstructionMissing);
    }
    trace
        .instructions
        .get(current_index - 1)
        .copied()
        .ok_or(EconomyError::RandomnessCommitInstructionMissing)
}

fn validate_round_commit_instruction(
    instruction: ReadonlyInstruction<'_>,
    randomness_program: [u8; 32],
    randomness_account: [u8; 32],
    authority: [u8; 32],
) -> Result<(), ()> {
    if instruction.program_id != randomness_program
        || instruction
            .data
            .get(..RANDOMNESS_COMMIT_DISCRIMINATOR.len())
            != Some(RANDOMNESS_COMMIT_DISCRIMINATOR.as_slice())
        || instruction.accounts.len() < 5
    {
        return Err(());
    }
    let randomness_meta = &instruction.accounts[0];
    if randomness_meta.key != randomness_account || !randomness_meta.is_writable {
        return Err(());
    }
    let authority_meta = &instruction.accounts[4];
    if authority_meta.key != authority || !authority_meta.is_signer {
        return Err(());
    }
    Ok(())
}

fn current_ccc_round(genesis_timestamp: i64, now_timestamp: i64) -> Option<u64> {
    let first_selection = genesis_timestamp.checked_add(CCC_FIRST_SELECTION_DELAY_SECONDS)?;
    if now_timestamp < first_selection {
        return None;
    }
    u64::try_from(
        now_timestamp
            .checked_sub(first_selection)?
            .checked_div(SECONDS_PER_WEEK)?,
    )
    .ok()
}

fn ccc_tiebreak_context(config: [u8; 32], week: u64, agency_registry_hash: [u8; 32]) -> [u8; 32] {
    sha256v(&[
        CCC_TIEBREAK_CONTEXT_DOMAIN,
        &config,
        &week.to_le_bytes(),
        &agency_registry_hash,
    ])
}

/// Production-facing retained V2 `settle_round` boundary. CCC remains
/// compile-time disabled in the Genesis candidate, so this returns before
/// inspecting or changing round/randomness values. The private by-value kernel
/// is exercised only for V2 differential evidence until a future candidate
/// intentionally changes that immutable build profile.
pub fn settle_round(
    gate: &ValidatedDailyLawWrite,
    config_active: bool,
    randomness_program: [u8; 32],
    round: RoundState,
    randomness_account: ReadonlyRoundRandomnessAccount<'_>,
    clock_slot: u64,
) -> Result<SettleRoundResult, EconomyError> {
    if !CCC_DLC_GENESIS_ENABLED {
        return Err(EconomyError::CccDlcNotActive);
    }
    if !RANDOMNESS_ADAPTER_VERIFIED {
        return Err(EconomyError::RandomnessAdapterNotVerified);
    }
    settle_pending_round(
        config_active,
        randomness_program,
        round,
        randomness_account,
        gate.unix_timestamp,
        clock_slot,
    )
}

fn settle_pending_round(
    config_active: bool,
    randomness_program: [u8; 32],
    mut round: RoundState,
    randomness_account: ReadonlyRoundRandomnessAccount<'_>,
    clock_unix_timestamp: i64,
    clock_slot: u64,
) -> Result<SettleRoundResult, EconomyError> {
    if !config_active {
        return Err(EconomyError::NotActive);
    }
    if round.status != ROUND_PENDING {
        return Err(EconomyError::RoundAlreadySettled);
    }
    if randomness_account.owner != randomness_program {
        return Err(EconomyError::WrongRandomnessProgram);
    }

    let recovery_timestamp = round
        .commit_timestamp
        .checked_add(CCC_REVEAL_TIMEOUT_SECONDS)
        .ok_or(EconomyError::ArithmeticOverflow)?;
    if clock_unix_timestamp >= recovery_timestamp {
        return Err(EconomyError::RoundRevealWindowExpired);
    }

    let randomness = parse_round_randomness(randomness_account.data)
        .ok_or(EconomyError::InvalidRandomnessAccount)?;
    if randomness.reveal_slot != clock_slot {
        return Err(EconomyError::RandomnessNotFresh);
    }
    if randomness.seed_slot != round.commit_slot {
        return Err(EconomyError::RandomnessCommitSlotMismatch);
    }
    if randomness.reveal_slot <= randomness.seed_slot {
        return Err(EconomyError::RandomnessRevealNotAfterCommit);
    }

    let outcome = uniform_tiebreak_outcome(
        randomness.value,
        round.decision_context,
        round.agency_count_snapshot,
    )
    .ok_or(EconomyError::TiebreakDerivationExhausted)?;

    round.randomness = randomness.value;
    round.selected_agency_index = outcome.index;
    round.derivation_counter = outcome.derivation_counter;
    round.status = ROUND_SETTLED;
    Ok(SettleRoundResult {
        round,
        reveal_slot: randomness.reveal_slot,
    })
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ParsedRoundRandomness {
    seed_slot: u64,
    reveal_slot: u64,
    value: [u8; 32],
}

fn parse_round_randomness(data: &[u8]) -> Option<ParsedRoundRandomness> {
    if data.len() < RANDOMNESS_ACCOUNT_SIZE
        || data.get(..RANDOMNESS_DISCRIMINATOR.len())? != RANDOMNESS_DISCRIMINATOR
    {
        return None;
    }

    Some(ParsedRoundRandomness {
        seed_slot: u64::from_le_bytes(
            data.get(RANDOMNESS_SEED_SLOT_START..RANDOMNESS_SEED_SLOT_START + 8)?
                .try_into()
                .ok()?,
        ),
        reveal_slot: u64::from_le_bytes(
            data.get(RANDOMNESS_REVEAL_SLOT_START..RANDOMNESS_REVEAL_SLOT_START + 8)?
                .try_into()
                .ok()?,
        ),
        value: data
            .get(RANDOMNESS_VALUE_START..RANDOMNESS_VALUE_START + 32)?
            .try_into()
            .ok()?,
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct TiebreakOutcome {
    index: u32,
    derivation_counter: u32,
}

fn uniform_tiebreak_outcome(
    oracle_randomness: [u8; 32],
    decision_context: [u8; 32],
    candidate_count: u32,
) -> Option<TiebreakOutcome> {
    if candidate_count == 0 {
        return None;
    }
    if candidate_count == 1 {
        return Some(TiebreakOutcome {
            index: 0,
            derivation_counter: 0,
        });
    }

    let rejection_tail = two_to_256_mod(candidate_count)?;
    for counter in 0..TIEBREAK_MAX_DERIVATION_ATTEMPTS {
        let counter_bytes = counter.to_be_bytes();
        let sample = sha256v(&[
            TIEBREAK_DOMAIN,
            &decision_context,
            &oracle_randomness,
            &counter_bytes,
        ]);
        if !sample_is_in_rejection_tail(&sample, rejection_tail) {
            return selected_agency(sample, candidate_count).map(|index| TiebreakOutcome {
                index,
                derivation_counter: counter,
            });
        }
    }
    None
}

fn two_to_256_mod(modulus: u32) -> Option<u32> {
    if modulus == 0 {
        return None;
    }
    let mut remainder = 1u64;
    for _ in 0..256 {
        remainder = (remainder * 2) % u64::from(modulus);
    }
    u32::try_from(remainder).ok()
}

fn sample_is_in_rejection_tail(sample: &[u8; 32], tail_size: u32) -> bool {
    if tail_size == 0 || sample[..28].iter().any(|byte| *byte != 0xff) {
        return false;
    }
    let low = u32::from_be_bytes([sample[28], sample[29], sample[30], sample[31]]);
    low >= 0u32.wrapping_sub(tail_size)
}

fn selected_agency(randomness: [u8; 32], agency_count: u32) -> Option<u32> {
    if agency_count == 0 {
        return None;
    }
    let modulus = u64::from(agency_count);
    let mut remainder = 0u64;
    for byte in randomness {
        remainder = ((u128::from(remainder) * 256 + u128::from(byte)) % u128::from(modulus)) as u64;
    }
    u32::try_from(remainder).ok()
}

fn sha256v(parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part);
    }
    hasher.finalize().into()
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
    use iat_v2::switchboard_randomness::{
        parse_randomness as v2_parse_randomness, RevealValidationError,
        RANDOMNESS_ACCOUNT_SIZE as V2_RANDOMNESS_ACCOUNT_SIZE,
        RANDOMNESS_COMMIT_DISCRIMINATOR as V2_RANDOMNESS_COMMIT_DISCRIMINATOR,
        RANDOMNESS_DISCRIMINATOR as V2_RANDOMNESS_DISCRIMINATOR,
    };
    use iat_v2::{
        Config as V2ConfigState, LaneVault as V2LaneState, Position as V2PositionState,
        Round as V2RoundState,
    };

    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const FRIDAY_BOUNDARY_UTC: i64 = 1_786_050_060;
    const COMMIT_CONFIG_KEY: [u8; 32] = [0x41; 32];
    const COMMIT_RANDOMNESS_PROGRAM: [u8; 32] = [0x42; 32];
    const COMMIT_RANDOMNESS_ACCOUNT: [u8; 32] = [0x43; 32];
    const COMMIT_PAYER: [u8; 32] = [0x44; 32];
    const COMMIT_GENESIS: i64 = 1_000;
    const COMMIT_WEEK: u64 = 3;
    const COMMIT_CLOCK_TIMESTAMP: i64 = COMMIT_GENESIS
        + CCC_FIRST_SELECTION_DELAY_SECONDS
        + (COMMIT_WEEK as i64 * SECONDS_PER_WEEK)
        + 123;
    const COMMIT_CLOCK_SLOT: u64 = 42;

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

    fn randomness_fixture(
        seed_slot: u64,
        reveal_slot: u64,
        value: [u8; 32],
    ) -> [u8; RANDOMNESS_ACCOUNT_SIZE] {
        let mut data = [0u8; RANDOMNESS_ACCOUNT_SIZE];
        data[..8].copy_from_slice(&RANDOMNESS_DISCRIMINATOR);
        data[RANDOMNESS_SEED_SLOT_START..RANDOMNESS_SEED_SLOT_START + 8]
            .copy_from_slice(&seed_slot.to_le_bytes());
        data[RANDOMNESS_REVEAL_SLOT_START..RANDOMNESS_REVEAL_SLOT_START + 8]
            .copy_from_slice(&reveal_slot.to_le_bytes());
        data[RANDOMNESS_VALUE_START..RANDOMNESS_VALUE_START + 32].copy_from_slice(&value);
        data
    }

    fn settle_round_state(
        commit_timestamp: i64,
        commit_slot: u64,
        agency_count_snapshot: u32,
        status: u8,
        decision_context: [u8; 32],
    ) -> RoundState {
        RoundState {
            config: [1; 32],
            randomness_account: [2; 32],
            week: 9,
            commit_slot,
            commit_timestamp,
            randomness: [0xA5; 32],
            agency_registry_hash_snapshot: [3; 32],
            decision_context,
            agency_count_snapshot,
            selected_agency_index: 7,
            derivation_counter: 8,
            status,
        }
    }

    fn v2_settle_round_state(
        commit_timestamp: i64,
        commit_slot: u64,
        agency_count_snapshot: u32,
        status: u8,
        decision_context: [u8; 32],
    ) -> V2RoundState {
        V2RoundState {
            config: [1; 32].into(),
            randomness_account: [2; 32].into(),
            week: 9,
            commit_slot,
            commit_timestamp,
            randomness: [0xA5; 32],
            agency_registry_hash_snapshot: [3; 32],
            decision_context,
            agency_count_snapshot,
            selected_agency_index: 7,
            derivation_counter: 8,
            status,
            bump: 252,
        }
    }

    #[derive(Debug, Eq, PartialEq)]
    enum SettleObservation {
        Error(EconomyError),
        Success(Box<SettleSuccess>),
    }

    #[derive(Debug, Eq, PartialEq)]
    struct SettleSuccess {
        config: [u8; 32],
        randomness_account: [u8; 32],
        week: u64,
        commit_slot: u64,
        commit_timestamp: i64,
        randomness: [u8; 32],
        agency_registry_hash_snapshot: [u8; 32],
        decision_context: [u8; 32],
        agency_count_snapshot: u32,
        selected_agency_index: u32,
        derivation_counter: u32,
        status: u8,
        reveal_slot: u64,
    }

    fn observe_settle_result(result: Result<SettleRoundResult, EconomyError>) -> SettleObservation {
        match result {
            Err(error) => SettleObservation::Error(error),
            Ok(result) => SettleObservation::Success(Box::new(SettleSuccess {
                config: result.round.config,
                randomness_account: result.round.randomness_account,
                week: result.round.week,
                commit_slot: result.round.commit_slot,
                commit_timestamp: result.round.commit_timestamp,
                randomness: result.round.randomness,
                agency_registry_hash_snapshot: result.round.agency_registry_hash_snapshot,
                decision_context: result.round.decision_context,
                agency_count_snapshot: result.round.agency_count_snapshot,
                selected_agency_index: result.round.selected_agency_index,
                derivation_counter: result.round.derivation_counter,
                status: result.round.status,
                reveal_slot: result.reveal_slot,
            })),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn v2_settle_round_reference(
        config_active: bool,
        randomness_program: [u8; 32],
        randomness_owner: [u8; 32],
        mut round: V2RoundState,
        randomness_data: &[u8],
        clock_unix_timestamp: i64,
        clock_slot: u64,
    ) -> SettleObservation {
        let transition = (|| {
            if !config_active {
                return Err(EconomyError::NotActive);
            }
            if round.status != iat_v2::ROUND_PENDING {
                return Err(EconomyError::RoundAlreadySettled);
            }
            if randomness_owner != randomness_program {
                return Err(EconomyError::WrongRandomnessProgram);
            }
            if v2_policy::ccc_round_recovery_available(round.commit_timestamp, clock_unix_timestamp)
                .ok_or(EconomyError::ArithmeticOverflow)?
            {
                return Err(EconomyError::RoundRevealWindowExpired);
            }

            let randomness = v2_parse_randomness(randomness_data)
                .ok_or(EconomyError::InvalidRandomnessAccount)?;
            let revealed = match randomness.validated_reveal(clock_slot, round.commit_slot) {
                Ok(value) => value,
                Err(RevealValidationError::RevealNotCurrent) => {
                    return Err(EconomyError::RandomnessNotFresh)
                }
                Err(RevealValidationError::CommitSlotMismatch) => {
                    return Err(EconomyError::RandomnessCommitSlotMismatch)
                }
                Err(RevealValidationError::RevealNotAfterCommit) => {
                    return Err(EconomyError::RandomnessRevealNotAfterCommit)
                }
            };
            let outcome = v2_policy::uniform_tiebreak_outcome(
                revealed,
                round.decision_context,
                round.agency_count_snapshot,
            )
            .ok_or(EconomyError::TiebreakDerivationExhausted)?;

            round.randomness = revealed;
            round.selected_agency_index = outcome.index;
            round.derivation_counter = outcome.derivation_counter;
            round.status = iat_v2::ROUND_SETTLED;
            Ok(randomness.reveal_slot)
        })();

        match transition {
            Err(error) => SettleObservation::Error(error),
            Ok(reveal_slot) => SettleObservation::Success(Box::new(SettleSuccess {
                config: round.config.to_bytes(),
                randomness_account: round.randomness_account.to_bytes(),
                week: round.week,
                commit_slot: round.commit_slot,
                commit_timestamp: round.commit_timestamp,
                randomness: round.randomness,
                agency_registry_hash_snapshot: round.agency_registry_hash_snapshot,
                decision_context: round.decision_context,
                agency_count_snapshot: round.agency_count_snapshot,
                selected_agency_index: round.selected_agency_index,
                derivation_counter: round.derivation_counter,
                status: round.status,
                reveal_slot,
            })),
        }
    }

    #[derive(Clone, Copy, Debug)]
    enum CommitProofCase {
        Valid,
        MissingIndex,
        FirstInstruction,
        OutOfRange,
        NonAdjacentValidCommit,
        WrongProgram,
        WrongDiscriminator,
        MissingAccounts,
        WrongRandomnessAccount,
        RandomnessAccountReadonly,
        WrongAuthority,
        AuthorityNotSigner,
    }

    #[derive(Clone, Copy)]
    struct CommitProofFixture {
        current_index: Option<u16>,
        instruction_count: usize,
        non_adjacent_valid_commit: bool,
        program_id: [u8; 32],
        accounts: [InstructionAccountMeta; 5],
        accounts_len: usize,
        data: [u8; 8],
    }

    fn commit_proof_fixture(case: CommitProofCase) -> CommitProofFixture {
        let empty_meta = InstructionAccountMeta {
            key: [0; 32],
            is_signer: false,
            is_writable: false,
        };
        let mut accounts = [empty_meta; 5];
        accounts[0] = InstructionAccountMeta {
            key: COMMIT_RANDOMNESS_ACCOUNT,
            is_signer: false,
            is_writable: true,
        };
        accounts[4] = InstructionAccountMeta {
            key: COMMIT_PAYER,
            is_signer: true,
            is_writable: false,
        };
        let mut fixture = CommitProofFixture {
            current_index: Some(1),
            instruction_count: 2,
            non_adjacent_valid_commit: false,
            program_id: COMMIT_RANDOMNESS_PROGRAM,
            accounts,
            accounts_len: 5,
            data: RANDOMNESS_COMMIT_DISCRIMINATOR,
        };

        match case {
            CommitProofCase::Valid => {}
            CommitProofCase::MissingIndex => fixture.current_index = None,
            CommitProofCase::FirstInstruction => fixture.current_index = Some(0),
            CommitProofCase::OutOfRange => {
                fixture.current_index = Some(3);
                fixture.instruction_count = 3;
            }
            CommitProofCase::NonAdjacentValidCommit => {
                fixture.current_index = Some(2);
                fixture.instruction_count = 3;
                fixture.non_adjacent_valid_commit = true;
                fixture.program_id = [0x99; 32];
            }
            CommitProofCase::WrongProgram => fixture.program_id = [0x99; 32],
            CommitProofCase::WrongDiscriminator => fixture.data[0] ^= 0xff,
            CommitProofCase::MissingAccounts => fixture.accounts_len = 4,
            CommitProofCase::WrongRandomnessAccount => fixture.accounts[0].key = [0x98; 32],
            CommitProofCase::RandomnessAccountReadonly => {
                fixture.accounts[0].is_writable = false;
            }
            CommitProofCase::WrongAuthority => fixture.accounts[4].key = [0x97; 32],
            CommitProofCase::AuthorityNotSigner => fixture.accounts[4].is_signer = false,
        }
        fixture
    }

    #[derive(Clone, Copy)]
    struct CommitVector {
        name: &'static str,
        active: bool,
        agency_count: u32,
        genesis_timestamp: i64,
        week: u64,
        randomness_owner: [u8; 32],
        proof_case: CommitProofCase,
        clock_timestamp: i64,
        clock_slot: u64,
        seed_slot: u64,
        reveal_slot: u64,
        corrupt_randomness_codec: bool,
    }

    fn commit_config(vector: CommitVector) -> CommitRoundConfigState {
        CommitRoundConfigState {
            key: COMMIT_CONFIG_KEY,
            randomness_program: COMMIT_RANDOMNESS_PROGRAM,
            agency_registry_hash: [0x45; 32],
            genesis_timestamp: vector.genesis_timestamp,
            agency_count: vector.agency_count,
            active: vector.active,
        }
    }

    fn v2_commit_config(vector: CommitVector) -> V2ConfigState {
        V2ConfigState {
            admin: Default::default(),
            mint: Default::default(),
            token_program: Default::default(),
            randomness_program: COMMIT_RANDOMNESS_PROGRAM.into(),
            stake_token_account: Default::default(),
            agency_registry_hash: [0x45; 32],
            genesis_timestamp: vector.genesis_timestamp,
            expected_supply: MAINNET_SUPPLY,
            staked_principal: 99,
            agency_count: vector.agency_count,
            rehearsal_mode: false,
            active: vector.active,
            lane_mask: 0x1f,
            stake_vault_initialized: true,
            bump: 251,
            vault_authority_bump: 250,
        }
    }

    #[derive(Debug, Eq, PartialEq)]
    enum CommitObservation {
        Error(EconomyError),
        Success(Box<CommitSuccess>),
    }

    #[derive(Debug, Eq, PartialEq)]
    struct CommitSuccess {
        config: [u8; 32],
        randomness_account: [u8; 32],
        week: u64,
        commit_slot: u64,
        commit_timestamp: i64,
        randomness: [u8; 32],
        agency_registry_hash_snapshot: [u8; 32],
        decision_context: [u8; 32],
        agency_count_snapshot: u32,
        selected_agency_index: u32,
        derivation_counter: u32,
        status: u8,
        round_bump: u8,
    }

    fn observe_commit_result(result: Result<CommitRoundResult, EconomyError>) -> CommitObservation {
        match result {
            Err(error) => CommitObservation::Error(error),
            Ok(result) => CommitObservation::Success(Box::new(CommitSuccess {
                config: result.round.config,
                randomness_account: result.round.randomness_account,
                week: result.round.week,
                commit_slot: result.round.commit_slot,
                commit_timestamp: result.round.commit_timestamp,
                randomness: result.round.randomness,
                agency_registry_hash_snapshot: result.round.agency_registry_hash_snapshot,
                decision_context: result.round.decision_context,
                agency_count_snapshot: result.round.agency_count_snapshot,
                selected_agency_index: result.round.selected_agency_index,
                derivation_counter: result.round.derivation_counter,
                status: result.round.status,
                round_bump: result.round_bump,
            })),
        }
    }

    fn b3_commit_round_observation(
        vector: CommitVector,
        proof: CommitProofFixture,
        randomness_data: &[u8],
    ) -> CommitObservation {
        let valid_proof = commit_proof_fixture(CommitProofCase::Valid);
        let valid_instruction = ReadonlyInstruction::new(
            valid_proof.program_id,
            &valid_proof.accounts[..valid_proof.accounts_len],
            &valid_proof.data,
        );
        let selected_instruction = ReadonlyInstruction::new(
            proof.program_id,
            &proof.accounts[..proof.accounts_len],
            &proof.data,
        );
        let current_instruction = ReadonlyInstruction::new([0x46; 32], &[], &[]);
        let instructions = if proof.non_adjacent_valid_commit {
            [valid_instruction, selected_instruction, current_instruction]
        } else {
            [
                selected_instruction,
                current_instruction,
                current_instruction,
            ]
        };
        let trace = ReadonlyInstructionTrace::new(
            proof.current_index,
            &instructions[..proof.instruction_count],
        );
        observe_commit_result(commit_round_transition(
            CommitRoundInput {
                config: commit_config(vector),
                week: vector.week,
                payer: COMMIT_PAYER,
                randomness_account_key: COMMIT_RANDOMNESS_ACCOUNT,
                randomness_account: ReadonlyRoundRandomnessAccount::new(
                    vector.randomness_owner,
                    randomness_data,
                ),
                instruction_trace: trace,
                clock_slot: vector.clock_slot,
                round_bump: 249,
            },
            vector.clock_timestamp,
        ))
    }

    fn v2_commit_proof_is_valid(proof: CommitProofFixture) -> Result<(), EconomyError> {
        let current_index = usize::from(
            proof
                .current_index
                .ok_or(EconomyError::RandomnessCommitInstructionMissing)?,
        );
        if current_index == 0 || current_index >= proof.instruction_count {
            return Err(EconomyError::RandomnessCommitInstructionMissing);
        }
        if proof.program_id != COMMIT_RANDOMNESS_PROGRAM
            || proof.data.get(..V2_RANDOMNESS_COMMIT_DISCRIMINATOR.len())
                != Some(V2_RANDOMNESS_COMMIT_DISCRIMINATOR.as_slice())
            || proof.accounts_len < 5
            || proof.accounts[0].key != COMMIT_RANDOMNESS_ACCOUNT
            || !proof.accounts[0].is_writable
            || proof.accounts[4].key != COMMIT_PAYER
            || !proof.accounts[4].is_signer
        {
            return Err(EconomyError::InvalidRandomnessCommitInstruction);
        }
        Ok(())
    }

    fn v2_commit_round_reference(
        vector: CommitVector,
        proof: CommitProofFixture,
        randomness_data: &[u8],
    ) -> CommitObservation {
        let config = v2_commit_config(vector);
        let transition = (|| {
            if !config.active {
                return Err(EconomyError::NotActive);
            }
            if config.agency_count == 0 {
                return Err(EconomyError::NoEligibleAgencies);
            }
            let expected_week =
                v2_policy::current_ccc_round(config.genesis_timestamp, vector.clock_timestamp)
                    .ok_or(EconomyError::CccSelectionNotOpen)?;
            if vector.week != expected_week {
                return Err(EconomyError::WrongRoundWeek);
            }
            if vector.randomness_owner != config.randomness_program.to_bytes() {
                return Err(EconomyError::WrongRandomnessProgram);
            }
            v2_commit_proof_is_valid(proof)?;
            let randomness = v2_parse_randomness(randomness_data)
                .ok_or(EconomyError::InvalidRandomnessAccount)?;
            if !randomness.is_fresh_unrevealed_commit(vector.clock_slot) {
                return Err(EconomyError::RandomnessCommitNotFresh);
            }

            Ok(V2RoundState {
                config: COMMIT_CONFIG_KEY.into(),
                randomness_account: COMMIT_RANDOMNESS_ACCOUNT.into(),
                week: vector.week,
                commit_slot: randomness.seed_slot,
                commit_timestamp: vector.clock_timestamp,
                randomness: [0; 32],
                agency_registry_hash_snapshot: config.agency_registry_hash,
                decision_context: v2_policy::ccc_tiebreak_context(
                    &COMMIT_CONFIG_KEY,
                    vector.week,
                    config.agency_registry_hash,
                ),
                agency_count_snapshot: config.agency_count,
                selected_agency_index: u32::MAX,
                derivation_counter: u32::MAX,
                status: iat_v2::ROUND_PENDING,
                bump: 249,
            })
        })();

        match transition {
            Err(error) => CommitObservation::Error(error),
            Ok(round) => CommitObservation::Success(Box::new(CommitSuccess {
                config: round.config.to_bytes(),
                randomness_account: round.randomness_account.to_bytes(),
                week: round.week,
                commit_slot: round.commit_slot,
                commit_timestamp: round.commit_timestamp,
                randomness: round.randomness,
                agency_registry_hash_snapshot: round.agency_registry_hash_snapshot,
                decision_context: round.decision_context,
                agency_count_snapshot: round.agency_count_snapshot,
                selected_agency_index: round.selected_agency_index,
                derivation_counter: round.derivation_counter,
                status: round.status,
                round_bump: round.bump,
            })),
        }
    }

    fn valid_commit_vector(name: &'static str) -> CommitVector {
        CommitVector {
            name,
            active: true,
            agency_count: 11,
            genesis_timestamp: COMMIT_GENESIS,
            week: COMMIT_WEEK,
            randomness_owner: COMMIT_RANDOMNESS_PROGRAM,
            proof_case: CommitProofCase::Valid,
            clock_timestamp: COMMIT_CLOCK_TIMESTAMP,
            clock_slot: COMMIT_CLOCK_SLOT,
            seed_slot: COMMIT_CLOCK_SLOT - 1,
            reveal_slot: 0,
            corrupt_randomness_codec: false,
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
        assert_eq!(TIEBREAK_DOMAIN, v2_policy::TIEBREAK_DOMAIN);
        assert_eq!(
            TIEBREAK_MAX_DERIVATION_ATTEMPTS,
            v2_policy::TIEBREAK_MAX_DERIVATION_ATTEMPTS
        );
        assert_eq!(COMMUNITY, v2_policy::COMMUNITY);
        assert_eq!(TREASURY, v2_policy::TREASURY);
        assert_eq!(ECOSYSTEM, v2_policy::ECOSYSTEM);
        assert_eq!(CORE_TEAM, v2_policy::CORE_TEAM);
        assert_eq!(LIQUIDITY, v2_policy::LIQUIDITY);
        assert_eq!(CCC_DLC_GENESIS_ENABLED, iat_v2::CCC_DLC_GENESIS_ENABLED);
        assert_eq!(
            RANDOMNESS_ADAPTER_VERIFIED,
            iat_v2::RANDOMNESS_ADAPTER_VERIFIED
        );
        assert_eq!(RANDOMNESS_DISCRIMINATOR, V2_RANDOMNESS_DISCRIMINATOR);
        assert_eq!(
            RANDOMNESS_COMMIT_DISCRIMINATOR,
            V2_RANDOMNESS_COMMIT_DISCRIMINATOR
        );
        assert_eq!(RANDOMNESS_ACCOUNT_SIZE, V2_RANDOMNESS_ACCOUNT_SIZE);
        assert_eq!(ROUND_PENDING, iat_v2::ROUND_PENDING);
        assert_eq!(ROUND_SETTLED, iat_v2::ROUND_SETTLED);
        assert_eq!(ROUND_EXPIRED_NEUTRAL, iat_v2::ROUND_EXPIRED_NEUTRAL);
    }

    #[test]
    fn commit_round_differential_and_adversarial_vectors_match_retained_v2() {
        let vectors = [
            CommitVector {
                active: false,
                agency_count: 0,
                genesis_timestamp: i64::MAX,
                week: u64::MAX,
                randomness_owner: [0x99; 32],
                proof_case: CommitProofCase::WrongProgram,
                corrupt_randomness_codec: true,
                ..valid_commit_vector("inactive precedes every other validation")
            },
            CommitVector {
                agency_count: 0,
                genesis_timestamp: i64::MAX,
                week: u64::MAX,
                randomness_owner: [0x99; 32],
                proof_case: CommitProofCase::WrongProgram,
                corrupt_randomness_codec: true,
                ..valid_commit_vector("empty registry precedes time and proof validation")
            },
            CommitVector {
                clock_timestamp: COMMIT_GENESIS + CCC_FIRST_SELECTION_DELAY_SECONDS - 1,
                ..valid_commit_vector("selection cadence has not opened")
            },
            CommitVector {
                genesis_timestamp: i64::MAX,
                clock_timestamp: i64::MAX,
                ..valid_commit_vector("selection timestamp overflow fails closed")
            },
            CommitVector {
                week: COMMIT_WEEK + 1,
                randomness_owner: [0x99; 32],
                proof_case: CommitProofCase::WrongProgram,
                ..valid_commit_vector("wrong week precedes owner and proof validation")
            },
            CommitVector {
                randomness_owner: [0x99; 32],
                proof_case: CommitProofCase::WrongProgram,
                ..valid_commit_vector("wrong owner precedes adjacent proof validation")
            },
            CommitVector {
                proof_case: CommitProofCase::MissingIndex,
                ..valid_commit_vector("missing current instruction index")
            },
            CommitVector {
                proof_case: CommitProofCase::FirstInstruction,
                ..valid_commit_vector("commit cannot precede the first instruction")
            },
            CommitVector {
                proof_case: CommitProofCase::OutOfRange,
                ..valid_commit_vector("malformed out-of-range trace")
            },
            CommitVector {
                proof_case: CommitProofCase::NonAdjacentValidCommit,
                ..valid_commit_vector("non-adjacent valid commit cannot authorize")
            },
            CommitVector {
                proof_case: CommitProofCase::WrongProgram,
                ..valid_commit_vector("preceding instruction uses wrong program")
            },
            CommitVector {
                proof_case: CommitProofCase::WrongDiscriminator,
                ..valid_commit_vector("preceding instruction uses wrong discriminator")
            },
            CommitVector {
                proof_case: CommitProofCase::MissingAccounts,
                ..valid_commit_vector("preceding instruction omits required accounts")
            },
            CommitVector {
                proof_case: CommitProofCase::WrongRandomnessAccount,
                ..valid_commit_vector("commit targets another randomness account")
            },
            CommitVector {
                proof_case: CommitProofCase::RandomnessAccountReadonly,
                ..valid_commit_vector("commit randomness account must be writable")
            },
            CommitVector {
                proof_case: CommitProofCase::WrongAuthority,
                ..valid_commit_vector("commit authority differs from payer")
            },
            CommitVector {
                proof_case: CommitProofCase::AuthorityNotSigner,
                ..valid_commit_vector("commit authority must sign")
            },
            CommitVector {
                corrupt_randomness_codec: true,
                ..valid_commit_vector("randomness account codec is invalid")
            },
            CommitVector {
                seed_slot: COMMIT_CLOCK_SLOT - 2,
                ..valid_commit_vector("randomness seed is not the adjacent prior slot")
            },
            CommitVector {
                reveal_slot: COMMIT_CLOCK_SLOT,
                ..valid_commit_vector("already revealed randomness cannot be committed")
            },
            CommitVector {
                clock_slot: 0,
                seed_slot: 0,
                ..valid_commit_vector("slot zero checked subtraction fails closed")
            },
            valid_commit_vector("valid adjacent proof constructs exact pending snapshot"),
        ];

        for vector in vectors {
            let proof = commit_proof_fixture(vector.proof_case);
            let mut randomness_data =
                randomness_fixture(vector.seed_slot, vector.reveal_slot, [0x47; 32]);
            if vector.corrupt_randomness_codec {
                randomness_data[0] ^= 0xff;
            }
            let actual = b3_commit_round_observation(vector, proof, &randomness_data);
            let expected = v2_commit_round_reference(vector, proof, &randomness_data);
            assert_eq!(actual, expected, "{}", vector.name);
        }
    }

    #[test]
    fn commit_round_context_and_cadence_match_v2_boundary_vectors() {
        for timestamp in [
            COMMIT_GENESIS,
            COMMIT_GENESIS + CCC_FIRST_SELECTION_DELAY_SECONDS - 1,
            COMMIT_GENESIS + CCC_FIRST_SELECTION_DELAY_SECONDS,
            COMMIT_GENESIS + CCC_FIRST_SELECTION_DELAY_SECONDS + SECONDS_PER_WEEK - 1,
            COMMIT_GENESIS + CCC_FIRST_SELECTION_DELAY_SECONDS + SECONDS_PER_WEEK,
            i64::MAX,
        ] {
            assert_eq!(
                current_ccc_round(COMMIT_GENESIS, timestamp),
                v2_policy::current_ccc_round(COMMIT_GENESIS, timestamp)
            );
        }
        for week in [0, 1, COMMIT_WEEK, u64::MAX] {
            assert_eq!(
                ccc_tiebreak_context(COMMIT_CONFIG_KEY, week, [0x45; 32]),
                v2_policy::ccc_tiebreak_context(&COMMIT_CONFIG_KEY, week, [0x45; 32])
            );
        }
    }

    #[test]
    fn production_commit_round_preserves_the_immutable_inactive_ccc_boundary() {
        let law_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &law_bytes).unwrap();
        let invalid_randomness = [0u8; 1];
        let no_instructions: [ReadonlyInstruction<'_>; 0] = [];
        let vector = CommitVector {
            active: false,
            agency_count: 0,
            genesis_timestamp: i64::MAX,
            week: u64::MAX,
            randomness_owner: [0x99; 32],
            proof_case: CommitProofCase::MissingIndex,
            clock_timestamp: FRIDAY_BOUNDARY_UTC,
            clock_slot: 0,
            seed_slot: 0,
            reveal_slot: 0,
            corrupt_randomness_codec: true,
            name: "production boundary",
        };
        assert_eq!(
            commit_round(
                &gate,
                CommitRoundInput {
                    config: commit_config(vector),
                    week: vector.week,
                    payer: COMMIT_PAYER,
                    randomness_account_key: COMMIT_RANDOMNESS_ACCOUNT,
                    randomness_account: ReadonlyRoundRandomnessAccount::new(
                        vector.randomness_owner,
                        &invalid_randomness,
                    ),
                    instruction_trace: ReadonlyInstructionTrace::new(None, &no_instructions),
                    clock_slot: vector.clock_slot,
                    round_bump: 249,
                },
            ),
            Err(EconomyError::CccDlcNotActive)
        );
    }

    #[test]
    fn settle_round_differential_vectors_match_the_retained_v2_handler() {
        #[derive(Clone, Copy)]
        struct Vector {
            name: &'static str,
            active: bool,
            expected_owner: [u8; 32],
            observed_owner: [u8; 32],
            commit_timestamp: i64,
            commit_slot: u64,
            agency_count: u32,
            status: u8,
            decision_context: [u8; 32],
            clock_timestamp: i64,
            clock_slot: u64,
            data: [u8; RANDOMNESS_ACCOUNT_SIZE],
        }

        let expected_owner = [0x77; 32];
        let valid_data = randomness_fixture(41, 42, [0x33; 32]);
        let mut invalid_data = valid_data;
        invalid_data[0] ^= 0xff;
        let vectors = [
            Vector {
                name: "inactive precedes every round/randomness error",
                active: false,
                expected_owner,
                observed_owner: [0x88; 32],
                commit_timestamp: i64::MAX,
                commit_slot: 41,
                agency_count: 0,
                status: ROUND_SETTLED,
                decision_context: [1; 32],
                clock_timestamp: i64::MAX,
                clock_slot: 42,
                data: invalid_data,
            },
            Vector {
                name: "terminal status precedes owner and clock errors",
                active: true,
                expected_owner,
                observed_owner: [0x88; 32],
                commit_timestamp: i64::MAX,
                commit_slot: 41,
                agency_count: 0,
                status: ROUND_EXPIRED_NEUTRAL,
                decision_context: [2; 32],
                clock_timestamp: i64::MAX,
                clock_slot: 42,
                data: invalid_data,
            },
            Vector {
                name: "wrong randomness owner precedes timeout",
                active: true,
                expected_owner,
                observed_owner: [0x88; 32],
                commit_timestamp: i64::MAX,
                commit_slot: 41,
                agency_count: 0,
                status: ROUND_PENDING,
                decision_context: [3; 32],
                clock_timestamp: i64::MAX,
                clock_slot: 42,
                data: invalid_data,
            },
            Vector {
                name: "recovery timestamp overflow",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: i64::MAX,
                commit_slot: 41,
                agency_count: 11,
                status: ROUND_PENDING,
                decision_context: [4; 32],
                clock_timestamp: i64::MAX,
                clock_slot: 42,
                data: valid_data,
            },
            Vector {
                name: "exact recovery boundary is expired",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 41,
                agency_count: 11,
                status: ROUND_PENDING,
                decision_context: [5; 32],
                clock_timestamp: 1_000 + CCC_REVEAL_TIMEOUT_SECONDS,
                clock_slot: 42,
                data: valid_data,
            },
            Vector {
                name: "invalid randomness codec",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 41,
                agency_count: 11,
                status: ROUND_PENDING,
                decision_context: [6; 32],
                clock_timestamp: 1_001,
                clock_slot: 42,
                data: invalid_data,
            },
            Vector {
                name: "reveal is not current",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 41,
                agency_count: 11,
                status: ROUND_PENDING,
                decision_context: [7; 32],
                clock_timestamp: 1_001,
                clock_slot: 42,
                data: randomness_fixture(41, 43, [0x44; 32]),
            },
            Vector {
                name: "seed slot does not match committed slot",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 41,
                agency_count: 11,
                status: ROUND_PENDING,
                decision_context: [8; 32],
                clock_timestamp: 1_001,
                clock_slot: 42,
                data: randomness_fixture(40, 42, [0x55; 32]),
            },
            Vector {
                name: "reveal must follow commit",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 42,
                agency_count: 11,
                status: ROUND_PENDING,
                decision_context: [9; 32],
                clock_timestamp: 1_001,
                clock_slot: 42,
                data: randomness_fixture(42, 42, [0x66; 32]),
            },
            Vector {
                name: "zero candidate snapshot cannot settle",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 41,
                agency_count: 0,
                status: ROUND_PENDING,
                decision_context: [10; 32],
                clock_timestamp: 1_001,
                clock_slot: 42,
                data: randomness_fixture(41, 42, [0x77; 32]),
            },
            Vector {
                name: "single candidate settles deterministically",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 41,
                agency_count: 1,
                status: ROUND_PENDING,
                decision_context: [11; 32],
                clock_timestamp: 1_001,
                clock_slot: 42,
                data: randomness_fixture(41, 42, [0x88; 32]),
            },
            Vector {
                name: "multi-candidate uniform outcome settles",
                active: true,
                expected_owner,
                observed_owner: expected_owner,
                commit_timestamp: 1_000,
                commit_slot: 41,
                agency_count: 11,
                status: ROUND_PENDING,
                decision_context: [12; 32],
                clock_timestamp: 1_001,
                clock_slot: 42,
                data: randomness_fixture(41, 42, [0x99; 32]),
            },
        ];

        for vector in vectors {
            let actual = observe_settle_result(settle_pending_round(
                vector.active,
                vector.expected_owner,
                settle_round_state(
                    vector.commit_timestamp,
                    vector.commit_slot,
                    vector.agency_count,
                    vector.status,
                    vector.decision_context,
                ),
                ReadonlyRoundRandomnessAccount::new(vector.observed_owner, &vector.data),
                vector.clock_timestamp,
                vector.clock_slot,
            ));
            let expected = v2_settle_round_reference(
                vector.active,
                vector.expected_owner,
                vector.observed_owner,
                v2_settle_round_state(
                    vector.commit_timestamp,
                    vector.commit_slot,
                    vector.agency_count,
                    vector.status,
                    vector.decision_context,
                ),
                &vector.data,
                vector.clock_timestamp,
                vector.clock_slot,
            );
            assert_eq!(actual, expected, "{}", vector.name);
        }
    }

    #[test]
    fn uniform_tiebreak_matches_v2_across_counts_and_contexts() {
        for candidate_count in [0, 1, 2, 3, 7, 257, u32::MAX] {
            for marker in 0u8..16 {
                let randomness = [marker; 32];
                let context = [marker.wrapping_mul(17); 32];
                let actual = uniform_tiebreak_outcome(randomness, context, candidate_count)
                    .map(|outcome| (outcome.index, outcome.derivation_counter));
                let expected =
                    v2_policy::uniform_tiebreak_outcome(randomness, context, candidate_count)
                        .map(|outcome| (outcome.index, outcome.derivation_counter));
                assert_eq!(
                    actual, expected,
                    "candidate_count={candidate_count} marker={marker}"
                );
            }
        }
    }

    #[test]
    fn production_settle_round_preserves_the_immutable_inactive_ccc_boundary() {
        let bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &bytes).unwrap();
        let invalid_randomness = [0u8; 1];
        assert_eq!(
            settle_round(
                &gate,
                false,
                [0x77; 32],
                settle_round_state(i64::MAX, 41, 0, ROUND_SETTLED, [0; 32]),
                ReadonlyRoundRandomnessAccount::new([0x88; 32], &invalid_randomness),
                0,
            ),
            Err(EconomyError::CccDlcNotActive)
        );
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

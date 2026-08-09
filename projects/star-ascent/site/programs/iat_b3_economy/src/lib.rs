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

pub const PROGRAM_ADMIN: [u8; 32] = [
    96, 250, 143, 44, 72, 168, 188, 109, 42, 212, 118, 176, 148, 187, 47, 86, 159, 2, 2, 17, 191,
    131, 77, 235, 20, 77, 46, 41, 88, 172, 66, 48,
];
pub const ON_DEMAND_MAINNET_PID: [u8; 32] = [
    6, 115, 189, 70, 242, 228, 126, 4, 241, 43, 217, 47, 183, 49, 150, 142, 205, 157, 151, 87, 194,
    116, 218, 135, 71, 111, 70, 92, 4, 12, 101, 115,
];
pub const ON_DEMAND_DEVNET_PID: [u8; 32] = [
    144, 110, 20, 100, 197, 248, 183, 99, 60, 192, 90, 66, 76, 221, 179, 174, 205, 109, 171, 184,
    174, 199, 71, 188, 79, 62, 17, 48, 30, 64, 99, 203,
];

pub const COMMUNITY_CUSTODY: [u8; 32] = PROGRAM_ADMIN;
pub const TREASURY_BENEFICIARY: [u8; 32] = [
    176, 234, 210, 80, 127, 82, 123, 19, 225, 61, 194, 50, 57, 247, 40, 109, 9, 38, 213, 31, 165,
    236, 251, 141, 147, 125, 148, 145, 25, 227, 197, 39,
];
pub const ECOSYSTEM_BENEFICIARY: [u8; 32] = [
    252, 72, 216, 255, 0, 242, 145, 139, 196, 26, 113, 42, 243, 23, 174, 180, 208, 191, 67, 37, 34,
    38, 169, 209, 135, 22, 220, 186, 2, 253, 190, 11,
];
pub const CORE_BENEFICIARY: [u8; 32] = [
    29, 63, 222, 204, 73, 139, 41, 10, 235, 128, 228, 15, 47, 185, 171, 204, 237, 167, 250, 94, 65,
    128, 197, 208, 62, 251, 138, 246, 23, 206, 112, 130,
];
pub const LIQUIDITY_BENEFICIARY: [u8; 32] = [
    24, 24, 0, 128, 110, 46, 22, 67, 50, 225, 22, 170, 229, 182, 166, 239, 134, 210, 52, 26, 159,
    168, 204, 64, 224, 169, 227, 240, 150, 80, 123, 107,
];

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

/// Native semantic representation of the retained V2 `Config` data. This is
/// not an account codec or proof that a config PDA exists.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigState {
    pub admin: [u8; 32],
    pub mint: [u8; 32],
    pub token_program: [u8; 32],
    pub randomness_program: [u8; 32],
    pub stake_token_account: [u8; 32],
    pub agency_registry_hash: [u8; 32],
    pub genesis_timestamp: i64,
    pub expected_supply: u64,
    pub staked_principal: u64,
    pub agency_count: u32,
    pub rehearsal_mode: bool,
    pub active: bool,
    pub lane_mask: u8,
    pub stake_vault_initialized: bool,
    pub bump: u8,
    pub vault_authority_bump: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InitializeConfigInput {
    pub admin: [u8; 32],
    pub mint: [u8; 32],
    pub mint_decimals: u8,
    pub token_program: [u8; 32],
    pub rehearsal_mode: bool,
    pub rehearsal_genesis_timestamp: Option<i64>,
    pub randomness_program: [u8; 32],
    pub config_bump: u8,
    pub vault_authority_bump: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InitializeConfigResult {
    pub config: ConfigState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InitializeLaneVaultInput {
    pub config_key: [u8; 32],
    pub config: ConfigState,
    pub lane: u8,
    pub lane_token_account: [u8; 32],
    pub lane_state_bump: u8,
    pub lane_token_bump: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InitializeLaneVaultResult {
    pub config: ConfigState,
    pub lane_state: LaneState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InitializeStakeVaultInput {
    pub config: ConfigState,
    pub stake_token_account: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InitializeStakeVaultResult {
    pub config: ConfigState,
}

/// Read-only mint facts decoded by a future native adapter. This semantic
/// value does not prove the account key, owner, or canonical Token-2022 shape.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyMintState {
    pub key: [u8; 32],
    pub supply: u64,
    pub mint_authority: Option<[u8; 32]>,
    pub freeze_authority: Option<[u8; 32]>,
}

/// Read-only token-account facts decoded by a future native adapter. Account
/// ownership, canonical PDA derivation, extensions, delegate, close authority,
/// and public-balance shape remain adapter responsibilities.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyTokenState {
    pub key: [u8; 32],
    pub mint: [u8; 32],
    pub owner: [u8; 32],
    pub amount: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CoreRewardState {
    pub config: [u8; 32],
    pub principal: u64,
    pub annual_rate_bps: u64,
    pub term_weeks: u64,
    pub treasury_reserved: u64,
    pub ecosystem_reserved: u64,
    pub liquidity_reserved: u64,
    pub paid: u64,
    pub settled_low: u64,
    pub settled_high: u64,
    pub bump: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivateInput {
    pub config_key: [u8; 32],
    pub config: ConfigState,
    pub mint: ReadonlyMintState,
    pub vault_authority: [u8; 32],
    pub community_tokens: ReadonlyTokenState,
    pub stake_tokens: ReadonlyTokenState,
    pub treasury: LaneState,
    pub treasury_tokens: ReadonlyTokenState,
    pub ecosystem: LaneState,
    pub ecosystem_tokens: ReadonlyTokenState,
    pub core_team: LaneState,
    pub core_team_tokens: ReadonlyTokenState,
    pub liquidity: LaneState,
    pub liquidity_tokens: ReadonlyTokenState,
    pub core_reward_bump: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivateResult {
    pub config: ConfigState,
    pub treasury: LaneState,
    pub ecosystem: LaneState,
    pub liquidity: LaneState,
    pub core_reward: CoreRewardState,
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
    WrongHardwareAdministrator,
    WrongMintDecimals,
    RehearsalTimestampRequired,
    ProductionTimestampOverrideForbidden,
    GenesisTimestampInFuture,
    AlreadyActive,
    UnknownLane,
    CommunityMustUseHardwareCustody,
    LaneAlreadyInitialized,
    StakeVaultAlreadyInitialized,
    MissingLaneVault,
    MissingStakeVault,
    WrongFixedSupply,
    MintAuthorityNotRevoked,
    FreezeAuthorityNotRevoked,
    WrongVaultTokenAccount,
    WrongTokenMint,
    WrongVaultAuthority,
    WrongCommunityCustody,
    WrongCommunityFunding,
    StakeLedgerMismatch,
    WrongVaultFunding,
    NotRewardLane,
    InsufficientUnlockedRewardCapacity,
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

/// Host-only pre-lifecycle `initialize_config` validation and state
/// construction. The opaque capability proves Daily Law was open before this
/// retained handler-body logic runs. This function does not authenticate an
/// account, derive a PDA, allocate data, transfer lamports, or write state.
pub fn initialize_config(
    gate: &ValidatedDailyLawWrite,
    input: InitializeConfigInput,
) -> Result<InitializeConfigResult, EconomyError> {
    initialize_config_transition(input, gate.unix_timestamp)
}

/// Host-only pre-lifecycle `initialize_lane_vault` state construction. The
/// opaque capability proves Daily Law was open before the retained handler
/// logic runs. This function does not authenticate accounts, derive PDAs,
/// allocate either account, initialize Token-2022 state, or persist the result.
pub fn initialize_lane_vault(
    _gate: &ValidatedDailyLawWrite,
    input: InitializeLaneVaultInput,
) -> Result<InitializeLaneVaultResult, EconomyError> {
    initialize_lane_vault_transition(input)
}

/// Host-only pre-lifecycle `initialize_stake_vault` state construction. The
/// opaque capability proves Daily Law was open before the retained handler
/// logic runs. This function does not authenticate accounts, derive the stake
/// vault PDA, allocate or initialize Token-2022 state, or persist the result.
pub fn initialize_stake_vault(
    _gate: &ValidatedDailyLawWrite,
    input: InitializeStakeVaultInput,
) -> Result<InitializeStakeVaultResult, EconomyError> {
    initialize_stake_vault_transition(input)
}

/// Host-only pre-lifecycle `activate` validation and state construction. The
/// opaque capability proves Daily Law was open before the retained handler
/// logic runs. This function does not authenticate accounts, derive or create
/// the core-reward PDA, deserialize Token-2022 state, or persist any result.
pub fn activate(
    _gate: &ValidatedDailyLawWrite,
    input: ActivateInput,
) -> Result<ActivateResult, EconomyError> {
    activate_transition(input)
}

fn activate_transition(input: ActivateInput) -> Result<ActivateResult, EconomyError> {
    if !RANDOMNESS_ADAPTER_VERIFIED {
        return Err(EconomyError::RandomnessAdapterNotVerified);
    }
    if input.config.active {
        return Err(EconomyError::AlreadyActive);
    }
    if input.config.lane_mask != 0b1_1110 {
        return Err(EconomyError::MissingLaneVault);
    }
    if !input.config.stake_vault_initialized {
        return Err(EconomyError::MissingStakeVault);
    }
    if input.mint.supply != input.config.expected_supply {
        return Err(EconomyError::WrongFixedSupply);
    }
    if input.mint.mint_authority.is_some() {
        return Err(EconomyError::MintAuthorityNotRevoked);
    }
    if input.mint.freeze_authority.is_some() {
        return Err(EconomyError::FreezeAuthorityNotRevoked);
    }

    let expected_community = lane_policy(COMMUNITY, input.config.rehearsal_mode)
        .ok_or(EconomyError::UnknownLane)?
        .total;
    verify_community_funding(input.community_tokens, input.mint.key, expected_community)?;
    verify_stake_vault(input.stake_tokens, input.mint.key, input.vault_authority, 0)?;
    verify_lane_funding(
        input.treasury,
        input.treasury_tokens,
        input.mint.key,
        input.vault_authority,
    )?;
    verify_lane_funding(
        input.ecosystem,
        input.ecosystem_tokens,
        input.mint.key,
        input.vault_authority,
    )?;
    verify_lane_funding(
        input.core_team,
        input.core_team_tokens,
        input.mint.key,
        input.vault_authority,
    )?;
    verify_lane_funding(
        input.liquidity,
        input.liquidity_tokens,
        input.mint.key,
        input.vault_authority,
    )?;

    let core_principal = lane_policy(CORE_TEAM, input.config.rehearsal_mode)
        .ok_or(EconomyError::UnknownLane)?
        .total;
    let obligation = maximum_reward(core_principal, CORE_RATE_BPS, CORE_TERM_WEEKS)
        .ok_or(EconomyError::ArithmeticOverflow)?;
    let mut treasury = input.treasury;
    let mut ecosystem = input.ecosystem;
    let mut liquidity = input.liquidity;
    let (treasury_reserved, ecosystem_reserved, liquidity_reserved) =
        reserve_three_lanes(&mut treasury, &mut ecosystem, &mut liquidity, obligation, 0)?;

    let core_reward = CoreRewardState {
        config: input.config_key,
        principal: core_principal,
        annual_rate_bps: CORE_RATE_BPS,
        term_weeks: CORE_TERM_WEEKS,
        treasury_reserved,
        ecosystem_reserved,
        liquidity_reserved,
        paid: 0,
        settled_low: 0,
        settled_high: 0,
        bump: input.core_reward_bump,
    };
    let mut config = input.config;
    config.active = true;

    Ok(ActivateResult {
        config,
        treasury,
        ecosystem,
        liquidity,
        core_reward,
    })
}

fn initialize_stake_vault_transition(
    input: InitializeStakeVaultInput,
) -> Result<InitializeStakeVaultResult, EconomyError> {
    if input.config.active {
        return Err(EconomyError::AlreadyActive);
    }
    if input.config.stake_vault_initialized {
        return Err(EconomyError::StakeVaultAlreadyInitialized);
    }

    let mut config = input.config;
    config.stake_token_account = input.stake_token_account;
    config.stake_vault_initialized = true;
    Ok(InitializeStakeVaultResult { config })
}

fn initialize_lane_vault_transition(
    input: InitializeLaneVaultInput,
) -> Result<InitializeLaneVaultResult, EconomyError> {
    if input.config.active {
        return Err(EconomyError::AlreadyActive);
    }
    if !(TREASURY..=LIQUIDITY).contains(&input.lane) {
        return Err(EconomyError::CommunityMustUseHardwareCustody);
    }
    if input.config.lane_mask & (1u8 << input.lane) != 0 {
        return Err(EconomyError::LaneAlreadyInitialized);
    }

    let lane_terms =
        lane_policy(input.lane, input.config.rehearsal_mode).ok_or(EconomyError::UnknownLane)?;
    let beneficiary = beneficiary(input.lane).ok_or(EconomyError::UnknownLane)?;
    let lane_state = LaneState {
        config: input.config_key,
        token_account: input.lane_token_account,
        beneficiary,
        total: lane_terms.total,
        genesis_unlocked: lane_terms.genesis_unlocked,
        cliff_week: lane_terms.cliff_week,
        linear_end_week: lane_terms.linear_end_week,
        reserved: 0,
        paid: 0,
        principal_claimed: 0,
        lane: input.lane,
        reward_source: lane_terms.reward_source,
        bump: input.lane_state_bump,
        token_bump: input.lane_token_bump,
    };
    let mut config = input.config;
    config.lane_mask |= 1u8 << input.lane;

    Ok(InitializeLaneVaultResult { config, lane_state })
}

fn lane_policy(lane: u8, rehearsal: bool) -> Option<LanePolicy> {
    let mainnet = match lane {
        COMMUNITY => LanePolicy {
            total: 500_000_000_000_000_000,
            genesis_unlocked: 500_000_000_000_000_000,
            cliff_week: 0,
            linear_end_week: 0,
            reward_source: false,
        },
        TREASURY => LanePolicy {
            total: 200_000_000_000_000_000,
            genesis_unlocked: 50_000_000_000_000_000,
            cliff_week: 52,
            linear_end_week: 208,
            reward_source: true,
        },
        ECOSYSTEM => LanePolicy {
            total: 150_000_000_000_000_000,
            genesis_unlocked: 37_500_000_000_000_000,
            cliff_week: 26,
            linear_end_week: 104,
            reward_source: true,
        },
        CORE_TEAM => LanePolicy {
            total: 100_000_000_000_000_000,
            genesis_unlocked: 0,
            cliff_week: 26,
            linear_end_week: 104,
            reward_source: false,
        },
        LIQUIDITY => LanePolicy {
            total: 50_000_000_000_000_000,
            genesis_unlocked: 12_500_000_000_000_000,
            cliff_week: 26,
            linear_end_week: 104,
            reward_source: true,
        },
        _ => return None,
    };

    Some(LanePolicy {
        total: scale_lane_amount(mainnet.total, rehearsal)?,
        genesis_unlocked: scale_lane_amount(mainnet.genesis_unlocked, rehearsal)?,
        ..mainnet
    })
}

fn scale_lane_amount(mainnet_amount: u64, rehearsal: bool) -> Option<u64> {
    if rehearsal {
        mainnet_amount.checked_div(1_000_000)
    } else {
        Some(mainnet_amount)
    }
}

fn beneficiary(lane: u8) -> Option<[u8; 32]> {
    match lane {
        COMMUNITY => Some(COMMUNITY_CUSTODY),
        TREASURY => Some(TREASURY_BENEFICIARY),
        ECOSYSTEM => Some(ECOSYSTEM_BENEFICIARY),
        CORE_TEAM => Some(CORE_BENEFICIARY),
        LIQUIDITY => Some(LIQUIDITY_BENEFICIARY),
        _ => None,
    }
}

fn cumulative_unlocked(policy: LanePolicy, week: u64) -> Option<u64> {
    if policy.linear_end_week == 0 || week >= policy.linear_end_week {
        return Some(policy.total);
    }
    if week < policy.cliff_week {
        return Some(policy.genesis_unlocked);
    }
    let remainder = policy.total.checked_sub(policy.genesis_unlocked)? as u128;
    let elapsed = week.checked_sub(policy.cliff_week)? as u128;
    let duration = policy.linear_end_week.checked_sub(policy.cliff_week)? as u128;
    let released = remainder.checked_mul(elapsed)?.checked_div(duration)?;
    u64::try_from((policy.genesis_unlocked as u128).checked_add(released)?).ok()
}

fn maximum_reward(principal: u64, annual_rate_bps: u64, term_weeks: u64) -> Option<u64> {
    let numerator = (principal as u128)
        .checked_mul(annual_rate_bps as u128)?
        .checked_mul(term_weeks as u128)?;
    u64::try_from(numerator.checked_div(BPS_DENOMINATOR.checked_mul(RATE_WEEKS)?)?).ok()
}

fn verify_community_funding(
    tokens: ReadonlyTokenState,
    mint: [u8; 32],
    expected_amount: u64,
) -> Result<(), EconomyError> {
    if tokens.mint != mint {
        return Err(EconomyError::WrongTokenMint);
    }
    if tokens.owner != COMMUNITY_CUSTODY {
        return Err(EconomyError::WrongCommunityCustody);
    }
    if tokens.amount != expected_amount {
        return Err(EconomyError::WrongCommunityFunding);
    }
    Ok(())
}

fn verify_stake_vault(
    tokens: ReadonlyTokenState,
    mint: [u8; 32],
    vault_authority: [u8; 32],
    expected_amount: u64,
) -> Result<(), EconomyError> {
    if tokens.mint != mint {
        return Err(EconomyError::WrongTokenMint);
    }
    if tokens.owner != vault_authority {
        return Err(EconomyError::WrongVaultAuthority);
    }
    if tokens.amount != expected_amount {
        return Err(EconomyError::StakeLedgerMismatch);
    }
    Ok(())
}

fn verify_lane_funding(
    lane: LaneState,
    tokens: ReadonlyTokenState,
    mint: [u8; 32],
    vault_authority: [u8; 32],
) -> Result<(), EconomyError> {
    if lane.token_account != tokens.key {
        return Err(EconomyError::WrongVaultTokenAccount);
    }
    if tokens.mint != mint {
        return Err(EconomyError::WrongTokenMint);
    }
    if tokens.owner != vault_authority {
        return Err(EconomyError::WrongVaultAuthority);
    }
    if lane.total != tokens.amount {
        return Err(EconomyError::WrongVaultFunding);
    }
    Ok(())
}

fn reserve_lane(lane: &mut LaneState, remaining: &mut u64, week: u64) -> Result<u64, EconomyError> {
    if *remaining == 0 {
        return Ok(0);
    }
    if !lane.reward_source {
        return Err(EconomyError::NotRewardLane);
    }
    let terms = LanePolicy {
        total: lane.total,
        genesis_unlocked: lane.genesis_unlocked,
        cliff_week: lane.cliff_week,
        linear_end_week: lane.linear_end_week,
        reward_source: lane.reward_source,
    };
    let unlocked = cumulative_unlocked(terms, week).ok_or(EconomyError::ArithmeticOverflow)?;
    let used = lane
        .reserved
        .checked_add(lane.paid)
        .and_then(|value| value.checked_add(lane.principal_claimed))
        .ok_or(EconomyError::ArithmeticOverflow)?;
    let capacity = unlocked.saturating_sub(used);
    let take = capacity.min(*remaining);
    lane.reserved = lane
        .reserved
        .checked_add(take)
        .ok_or(EconomyError::ArithmeticOverflow)?;
    *remaining = remaining
        .checked_sub(take)
        .ok_or(EconomyError::ArithmeticOverflow)?;
    Ok(take)
}

fn reserve_three_lanes(
    treasury: &mut LaneState,
    ecosystem: &mut LaneState,
    liquidity: &mut LaneState,
    amount: u64,
    week: u64,
) -> Result<(u64, u64, u64), EconomyError> {
    if treasury.lane != TREASURY || ecosystem.lane != ECOSYSTEM || liquidity.lane != LIQUIDITY {
        return Err(EconomyError::WrongLaneOrder);
    }
    let mut remaining = amount;
    let treasury_reserved = reserve_lane(treasury, &mut remaining, week)?;
    let ecosystem_reserved = reserve_lane(ecosystem, &mut remaining, week)?;
    let liquidity_reserved = reserve_lane(liquidity, &mut remaining, week)?;
    if remaining != 0 {
        return Err(EconomyError::InsufficientUnlockedRewardCapacity);
    }
    Ok((treasury_reserved, ecosystem_reserved, liquidity_reserved))
}

fn initialize_config_transition(
    input: InitializeConfigInput,
    clock_unix_timestamp: i64,
) -> Result<InitializeConfigResult, EconomyError> {
    if input.admin != PROGRAM_ADMIN {
        return Err(EconomyError::WrongHardwareAdministrator);
    }
    if input.mint_decimals != TOKEN_DECIMALS {
        return Err(EconomyError::WrongMintDecimals);
    }

    let expected_randomness_program = if input.rehearsal_mode {
        ON_DEMAND_DEVNET_PID
    } else {
        ON_DEMAND_MAINNET_PID
    };
    if input.randomness_program != expected_randomness_program {
        return Err(EconomyError::WrongRandomnessProgram);
    }

    let genesis_timestamp = if input.rehearsal_mode {
        input
            .rehearsal_genesis_timestamp
            .ok_or(EconomyError::RehearsalTimestampRequired)?
    } else {
        if input.rehearsal_genesis_timestamp.is_some() {
            return Err(EconomyError::ProductionTimestampOverrideForbidden);
        }
        clock_unix_timestamp
    };
    if genesis_timestamp > clock_unix_timestamp {
        return Err(EconomyError::GenesisTimestampInFuture);
    }

    Ok(InitializeConfigResult {
        config: ConfigState {
            admin: PROGRAM_ADMIN,
            mint: input.mint,
            token_program: input.token_program,
            randomness_program: input.randomness_program,
            stake_token_account: [0; 32],
            agency_registry_hash: [0; 32],
            genesis_timestamp,
            expected_supply: if input.rehearsal_mode {
                REHEARSAL_SUPPLY
            } else {
                MAINNET_SUPPLY
            },
            staked_principal: 0,
            agency_count: 0,
            rehearsal_mode: input.rehearsal_mode,
            active: false,
            lane_mask: 0,
            stake_vault_initialized: false,
            bump: input.config_bump,
            vault_authority_bump: input.vault_authority_bump,
        },
    })
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
        ON_DEMAND_DEVNET_PID as V2_ON_DEMAND_DEVNET_PID,
        ON_DEMAND_MAINNET_PID as V2_ON_DEMAND_MAINNET_PID,
        RANDOMNESS_ACCOUNT_SIZE as V2_RANDOMNESS_ACCOUNT_SIZE,
        RANDOMNESS_COMMIT_DISCRIMINATOR as V2_RANDOMNESS_COMMIT_DISCRIMINATOR,
        RANDOMNESS_DISCRIMINATOR as V2_RANDOMNESS_DISCRIMINATOR,
    };
    use iat_v2::{
        Config as V2ConfigState, CoreReward as V2CoreRewardState, LaneVault as V2LaneState,
        Position as V2PositionState, Round as V2RoundState,
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

    #[derive(Clone, Copy)]
    struct InitializeConfigVector {
        name: &'static str,
        input: InitializeConfigInput,
        clock_timestamp: i64,
    }

    fn valid_initialize_config_vector(
        name: &'static str,
        rehearsal_mode: bool,
    ) -> InitializeConfigVector {
        InitializeConfigVector {
            name,
            input: InitializeConfigInput {
                admin: PROGRAM_ADMIN,
                mint: [0x31; 32],
                mint_decimals: TOKEN_DECIMALS,
                token_program: [0x32; 32],
                rehearsal_mode,
                rehearsal_genesis_timestamp: rehearsal_mode.then_some(900),
                randomness_program: if rehearsal_mode {
                    ON_DEMAND_DEVNET_PID
                } else {
                    ON_DEMAND_MAINNET_PID
                },
                config_bump: 248,
                vault_authority_bump: 247,
            },
            clock_timestamp: 1_000,
        }
    }

    #[derive(Debug, Eq, PartialEq)]
    enum InitializeConfigObservation {
        Error(EconomyError),
        Success(Box<ConfigState>),
    }

    fn observe_initialize_config(
        result: Result<InitializeConfigResult, EconomyError>,
    ) -> InitializeConfigObservation {
        match result {
            Err(error) => InitializeConfigObservation::Error(error),
            Ok(result) => InitializeConfigObservation::Success(Box::new(result.config)),
        }
    }

    fn semantic_config_from_v2(config: V2ConfigState) -> ConfigState {
        ConfigState {
            admin: config.admin.to_bytes(),
            mint: config.mint.to_bytes(),
            token_program: config.token_program.to_bytes(),
            randomness_program: config.randomness_program.to_bytes(),
            stake_token_account: config.stake_token_account.to_bytes(),
            agency_registry_hash: config.agency_registry_hash,
            genesis_timestamp: config.genesis_timestamp,
            expected_supply: config.expected_supply,
            staked_principal: config.staked_principal,
            agency_count: config.agency_count,
            rehearsal_mode: config.rehearsal_mode,
            active: config.active,
            lane_mask: config.lane_mask,
            stake_vault_initialized: config.stake_vault_initialized,
            bump: config.bump,
            vault_authority_bump: config.vault_authority_bump,
        }
    }

    fn v2_initialize_config_reference(
        vector: InitializeConfigVector,
    ) -> InitializeConfigObservation {
        let input = vector.input;
        let result = (|| {
            if input.admin != iat_v2::PROGRAM_ADMIN.to_bytes() {
                return Err(EconomyError::WrongHardwareAdministrator);
            }
            if input.mint_decimals != v2_policy::TOKEN_DECIMALS {
                return Err(EconomyError::WrongMintDecimals);
            }
            let expected_randomness_program = if input.rehearsal_mode {
                V2_ON_DEMAND_DEVNET_PID.to_bytes()
            } else {
                V2_ON_DEMAND_MAINNET_PID.to_bytes()
            };
            if input.randomness_program != expected_randomness_program {
                return Err(EconomyError::WrongRandomnessProgram);
            }
            let genesis_timestamp = if input.rehearsal_mode {
                input
                    .rehearsal_genesis_timestamp
                    .ok_or(EconomyError::RehearsalTimestampRequired)?
            } else {
                if input.rehearsal_genesis_timestamp.is_some() {
                    return Err(EconomyError::ProductionTimestampOverrideForbidden);
                }
                vector.clock_timestamp
            };
            if genesis_timestamp > vector.clock_timestamp {
                return Err(EconomyError::GenesisTimestampInFuture);
            }

            Ok(V2ConfigState {
                admin: iat_v2::PROGRAM_ADMIN,
                mint: input.mint.into(),
                token_program: input.token_program.into(),
                randomness_program: input.randomness_program.into(),
                stake_token_account: Default::default(),
                agency_registry_hash: [0; 32],
                genesis_timestamp,
                expected_supply: if input.rehearsal_mode {
                    v2_policy::REHEARSAL_SUPPLY
                } else {
                    v2_policy::MAINNET_SUPPLY
                },
                staked_principal: 0,
                agency_count: 0,
                rehearsal_mode: input.rehearsal_mode,
                active: false,
                lane_mask: 0,
                stake_vault_initialized: false,
                bump: input.config_bump,
                vault_authority_bump: input.vault_authority_bump,
            })
        })();

        match result {
            Err(error) => InitializeConfigObservation::Error(error),
            Ok(config) => {
                InitializeConfigObservation::Success(Box::new(semantic_config_from_v2(config)))
            }
        }
    }

    #[derive(Clone, Copy)]
    struct InitializeLaneVaultVector {
        name: &'static str,
        input: InitializeLaneVaultInput,
    }

    fn valid_initialize_lane_vault_vector(
        name: &'static str,
        lane: u8,
        rehearsal_mode: bool,
    ) -> InitializeLaneVaultVector {
        let config = initialize_config_transition(
            valid_initialize_config_vector("lane config", rehearsal_mode).input,
            1_000,
        )
        .unwrap()
        .config;
        InitializeLaneVaultVector {
            name,
            input: InitializeLaneVaultInput {
                config_key: [0x61; 32],
                config,
                lane,
                lane_token_account: [0x62; 32],
                lane_state_bump: 246,
                lane_token_bump: 245,
            },
        }
    }

    #[derive(Debug, Eq, PartialEq)]
    enum InitializeLaneVaultObservation {
        Error(EconomyError),
        Success {
            config: Box<ConfigState>,
            lane_state: Box<LaneState>,
        },
    }

    fn observe_initialize_lane_vault(
        result: Result<InitializeLaneVaultResult, EconomyError>,
    ) -> InitializeLaneVaultObservation {
        match result {
            Err(error) => InitializeLaneVaultObservation::Error(error),
            Ok(result) => InitializeLaneVaultObservation::Success {
                config: Box::new(result.config),
                lane_state: Box::new(result.lane_state),
            },
        }
    }

    fn semantic_lane_from_v2(lane: V2LaneState) -> LaneState {
        LaneState {
            config: lane.config.to_bytes(),
            token_account: lane.token_account.to_bytes(),
            beneficiary: lane.beneficiary.to_bytes(),
            total: lane.total,
            genesis_unlocked: lane.genesis_unlocked,
            cliff_week: lane.cliff_week,
            linear_end_week: lane.linear_end_week,
            reserved: lane.reserved,
            paid: lane.paid,
            principal_claimed: lane.principal_claimed,
            lane: lane.lane,
            reward_source: lane.reward_source,
            bump: lane.bump,
            token_bump: lane.token_bump,
        }
    }

    fn v2_lane_from_semantic(lane: LaneState) -> V2LaneState {
        V2LaneState {
            config: lane.config.into(),
            token_account: lane.token_account.into(),
            beneficiary: lane.beneficiary.into(),
            total: lane.total,
            genesis_unlocked: lane.genesis_unlocked,
            cliff_week: lane.cliff_week,
            linear_end_week: lane.linear_end_week,
            reserved: lane.reserved,
            paid: lane.paid,
            principal_claimed: lane.principal_claimed,
            lane: lane.lane,
            reward_source: lane.reward_source,
            bump: lane.bump,
            token_bump: lane.token_bump,
        }
    }

    fn v2_config_from_semantic(config: ConfigState) -> V2ConfigState {
        V2ConfigState {
            admin: config.admin.into(),
            mint: config.mint.into(),
            token_program: config.token_program.into(),
            randomness_program: config.randomness_program.into(),
            stake_token_account: config.stake_token_account.into(),
            agency_registry_hash: config.agency_registry_hash,
            genesis_timestamp: config.genesis_timestamp,
            expected_supply: config.expected_supply,
            staked_principal: config.staked_principal,
            agency_count: config.agency_count,
            rehearsal_mode: config.rehearsal_mode,
            active: config.active,
            lane_mask: config.lane_mask,
            stake_vault_initialized: config.stake_vault_initialized,
            bump: config.bump,
            vault_authority_bump: config.vault_authority_bump,
        }
    }

    fn v2_initialize_lane_vault_reference(
        vector: InitializeLaneVaultVector,
    ) -> InitializeLaneVaultObservation {
        let input = vector.input;
        let mut config = v2_config_from_semantic(input.config);
        let result = (|| {
            if config.active {
                return Err(EconomyError::AlreadyActive);
            }
            if !(v2_policy::TREASURY..=v2_policy::LIQUIDITY).contains(&input.lane) {
                return Err(EconomyError::CommunityMustUseHardwareCustody);
            }
            if config.lane_mask & (1u8 << input.lane) != 0 {
                return Err(EconomyError::LaneAlreadyInitialized);
            }
            let terms = v2_policy::lane_policy(input.lane, config.rehearsal_mode)
                .ok_or(EconomyError::UnknownLane)?;
            let beneficiary = match input.lane {
                v2_policy::COMMUNITY => iat_v2::COMMUNITY_CUSTODY,
                v2_policy::TREASURY => iat_v2::TREASURY_BENEFICIARY,
                v2_policy::ECOSYSTEM => iat_v2::ECOSYSTEM_BENEFICIARY,
                v2_policy::CORE_TEAM => iat_v2::CORE_BENEFICIARY,
                v2_policy::LIQUIDITY => iat_v2::LIQUIDITY_BENEFICIARY,
                _ => return Err(EconomyError::UnknownLane),
            };
            let lane_state = V2LaneState {
                config: input.config_key.into(),
                token_account: input.lane_token_account.into(),
                beneficiary,
                total: terms.total,
                genesis_unlocked: terms.genesis_unlocked,
                cliff_week: terms.cliff_week,
                linear_end_week: terms.linear_end_week,
                reserved: 0,
                paid: 0,
                principal_claimed: 0,
                lane: input.lane,
                reward_source: terms.reward_source,
                bump: input.lane_state_bump,
                token_bump: input.lane_token_bump,
            };
            config.lane_mask |= 1u8 << input.lane;
            Ok((config, lane_state))
        })();

        match result {
            Err(error) => InitializeLaneVaultObservation::Error(error),
            Ok((config, lane_state)) => InitializeLaneVaultObservation::Success {
                config: Box::new(semantic_config_from_v2(config)),
                lane_state: Box::new(semantic_lane_from_v2(lane_state)),
            },
        }
    }

    #[derive(Clone, Copy)]
    struct InitializeStakeVaultVector {
        name: &'static str,
        input: InitializeStakeVaultInput,
    }

    fn valid_initialize_stake_vault_vector(name: &'static str) -> InitializeStakeVaultVector {
        let config = initialize_config_transition(
            valid_initialize_config_vector("stake config", false).input,
            1_000,
        )
        .unwrap()
        .config;
        InitializeStakeVaultVector {
            name,
            input: InitializeStakeVaultInput {
                config,
                stake_token_account: [0x71; 32],
            },
        }
    }

    #[derive(Debug, Eq, PartialEq)]
    enum InitializeStakeVaultObservation {
        Error(EconomyError),
        Success(Box<ConfigState>),
    }

    fn observe_initialize_stake_vault(
        result: Result<InitializeStakeVaultResult, EconomyError>,
    ) -> InitializeStakeVaultObservation {
        match result {
            Err(error) => InitializeStakeVaultObservation::Error(error),
            Ok(result) => InitializeStakeVaultObservation::Success(Box::new(result.config)),
        }
    }

    fn v2_initialize_stake_vault_reference(
        vector: InitializeStakeVaultVector,
    ) -> InitializeStakeVaultObservation {
        let input = vector.input;
        let mut config = v2_config_from_semantic(input.config);
        let result = (|| {
            if config.active {
                return Err(EconomyError::AlreadyActive);
            }
            if config.stake_vault_initialized {
                return Err(EconomyError::StakeVaultAlreadyInitialized);
            }
            config.stake_token_account = input.stake_token_account.into();
            config.stake_vault_initialized = true;
            Ok(config)
        })();

        match result {
            Err(error) => InitializeStakeVaultObservation::Error(error),
            Ok(config) => {
                InitializeStakeVaultObservation::Success(Box::new(semantic_config_from_v2(config)))
            }
        }
    }

    #[derive(Clone, Copy)]
    struct ActivateVector {
        name: &'static str,
        input: ActivateInput,
    }

    fn activation_lane(lane: u8, rehearsal_mode: bool, marker: u8) -> LaneState {
        let terms = lane_policy(lane, rehearsal_mode).unwrap();
        LaneState {
            config: [0x81; 32],
            token_account: [marker; 32],
            beneficiary: beneficiary(lane).unwrap(),
            total: terms.total,
            genesis_unlocked: terms.genesis_unlocked,
            cliff_week: terms.cliff_week,
            linear_end_week: terms.linear_end_week,
            reserved: 0,
            paid: 0,
            principal_claimed: 0,
            lane,
            reward_source: terms.reward_source,
            bump: marker.wrapping_add(1),
            token_bump: marker.wrapping_add(2),
        }
    }

    fn token_for_lane(lane: LaneState, mint: [u8; 32], owner: [u8; 32]) -> ReadonlyTokenState {
        ReadonlyTokenState {
            key: lane.token_account,
            mint,
            owner,
            amount: lane.total,
        }
    }

    fn valid_activate_vector(name: &'static str, rehearsal_mode: bool) -> ActivateVector {
        let mut config = initialize_config_transition(
            valid_initialize_config_vector("activate config", rehearsal_mode).input,
            1_000,
        )
        .unwrap()
        .config;
        config.lane_mask = 0b1_1110;
        config.stake_vault_initialized = true;
        config.stake_token_account = [0x82; 32];
        let mint = ReadonlyMintState {
            key: config.mint,
            supply: config.expected_supply,
            mint_authority: None,
            freeze_authority: None,
        };
        let vault_authority = [0x83; 32];
        let treasury = activation_lane(TREASURY, rehearsal_mode, 0x84);
        let ecosystem = activation_lane(ECOSYSTEM, rehearsal_mode, 0x88);
        let core_team = activation_lane(CORE_TEAM, rehearsal_mode, 0x8c);
        let liquidity = activation_lane(LIQUIDITY, rehearsal_mode, 0x90);
        let community_total = lane_policy(COMMUNITY, rehearsal_mode).unwrap().total;

        ActivateVector {
            name,
            input: ActivateInput {
                config_key: [0x81; 32],
                config,
                mint,
                vault_authority,
                community_tokens: ReadonlyTokenState {
                    key: [0x94; 32],
                    mint: mint.key,
                    owner: COMMUNITY_CUSTODY,
                    amount: community_total,
                },
                stake_tokens: ReadonlyTokenState {
                    key: config.stake_token_account,
                    mint: mint.key,
                    owner: vault_authority,
                    amount: 0,
                },
                treasury,
                treasury_tokens: token_for_lane(treasury, mint.key, vault_authority),
                ecosystem,
                ecosystem_tokens: token_for_lane(ecosystem, mint.key, vault_authority),
                core_team,
                core_team_tokens: token_for_lane(core_team, mint.key, vault_authority),
                liquidity,
                liquidity_tokens: token_for_lane(liquidity, mint.key, vault_authority),
                core_reward_bump: 244,
            },
        }
    }

    #[derive(Debug, Eq, PartialEq)]
    enum ActivateObservation {
        Error(EconomyError),
        Success(Box<ActivateResult>),
    }

    fn observe_activate(result: Result<ActivateResult, EconomyError>) -> ActivateObservation {
        match result {
            Err(error) => ActivateObservation::Error(error),
            Ok(result) => ActivateObservation::Success(Box::new(result)),
        }
    }

    fn semantic_core_from_v2(core: V2CoreRewardState) -> CoreRewardState {
        CoreRewardState {
            config: core.config.to_bytes(),
            principal: core.principal,
            annual_rate_bps: core.annual_rate_bps,
            term_weeks: core.term_weeks,
            treasury_reserved: core.treasury_reserved,
            ecosystem_reserved: core.ecosystem_reserved,
            liquidity_reserved: core.liquidity_reserved,
            paid: core.paid,
            settled_low: core.settled_low,
            settled_high: core.settled_high,
            bump: core.bump,
        }
    }

    fn v2_verify_community_funding(
        tokens: ReadonlyTokenState,
        mint: [u8; 32],
        expected_amount: u64,
    ) -> Result<(), EconomyError> {
        if tokens.mint != mint {
            return Err(EconomyError::WrongTokenMint);
        }
        if tokens.owner != iat_v2::COMMUNITY_CUSTODY.to_bytes() {
            return Err(EconomyError::WrongCommunityCustody);
        }
        if tokens.amount != expected_amount {
            return Err(EconomyError::WrongCommunityFunding);
        }
        Ok(())
    }

    fn v2_verify_stake_vault(
        tokens: ReadonlyTokenState,
        mint: [u8; 32],
        vault_authority: [u8; 32],
        expected_amount: u64,
    ) -> Result<(), EconomyError> {
        if tokens.mint != mint {
            return Err(EconomyError::WrongTokenMint);
        }
        if tokens.owner != vault_authority {
            return Err(EconomyError::WrongVaultAuthority);
        }
        if tokens.amount != expected_amount {
            return Err(EconomyError::StakeLedgerMismatch);
        }
        Ok(())
    }

    fn v2_verify_lane_funding(
        lane: &V2LaneState,
        tokens: ReadonlyTokenState,
        mint: [u8; 32],
        vault_authority: [u8; 32],
    ) -> Result<(), EconomyError> {
        if lane.token_account.to_bytes() != tokens.key {
            return Err(EconomyError::WrongVaultTokenAccount);
        }
        if tokens.mint != mint {
            return Err(EconomyError::WrongTokenMint);
        }
        if tokens.owner != vault_authority {
            return Err(EconomyError::WrongVaultAuthority);
        }
        if lane.total != tokens.amount {
            return Err(EconomyError::WrongVaultFunding);
        }
        Ok(())
    }

    fn v2_reserve_lane(
        lane: &mut V2LaneState,
        remaining: &mut u64,
        week: u64,
    ) -> Result<u64, EconomyError> {
        if *remaining == 0 {
            return Ok(0);
        }
        if !lane.reward_source {
            return Err(EconomyError::NotRewardLane);
        }
        let terms = v2_policy::LanePolicy {
            total: lane.total,
            genesis_unlocked: lane.genesis_unlocked,
            cliff_week: lane.cliff_week,
            linear_end_week: lane.linear_end_week,
            reward_source: lane.reward_source,
        };
        let unlocked =
            v2_policy::cumulative_unlocked(terms, week).ok_or(EconomyError::ArithmeticOverflow)?;
        let used = lane
            .reserved
            .checked_add(lane.paid)
            .and_then(|value| value.checked_add(lane.principal_claimed))
            .ok_or(EconomyError::ArithmeticOverflow)?;
        let capacity = unlocked.saturating_sub(used);
        let take = capacity.min(*remaining);
        lane.reserved = lane
            .reserved
            .checked_add(take)
            .ok_or(EconomyError::ArithmeticOverflow)?;
        *remaining = remaining
            .checked_sub(take)
            .ok_or(EconomyError::ArithmeticOverflow)?;
        Ok(take)
    }

    fn v2_reserve_three_lanes(
        treasury: &mut V2LaneState,
        ecosystem: &mut V2LaneState,
        liquidity: &mut V2LaneState,
        amount: u64,
        week: u64,
    ) -> Result<(u64, u64, u64), EconomyError> {
        if treasury.lane != v2_policy::TREASURY
            || ecosystem.lane != v2_policy::ECOSYSTEM
            || liquidity.lane != v2_policy::LIQUIDITY
        {
            return Err(EconomyError::WrongLaneOrder);
        }
        let mut remaining = amount;
        let treasury_reserved = v2_reserve_lane(treasury, &mut remaining, week)?;
        let ecosystem_reserved = v2_reserve_lane(ecosystem, &mut remaining, week)?;
        let liquidity_reserved = v2_reserve_lane(liquidity, &mut remaining, week)?;
        if remaining != 0 {
            return Err(EconomyError::InsufficientUnlockedRewardCapacity);
        }
        Ok((treasury_reserved, ecosystem_reserved, liquidity_reserved))
    }

    fn v2_activate_reference(vector: ActivateVector) -> ActivateObservation {
        let _case_name = vector.name;
        let input = vector.input;
        let mut config = v2_config_from_semantic(input.config);
        let mut treasury = v2_lane_from_semantic(input.treasury);
        let mut ecosystem = v2_lane_from_semantic(input.ecosystem);
        let core_team = v2_lane_from_semantic(input.core_team);
        let mut liquidity = v2_lane_from_semantic(input.liquidity);
        let result = (|| {
            if !iat_v2::RANDOMNESS_ADAPTER_VERIFIED {
                return Err(EconomyError::RandomnessAdapterNotVerified);
            }
            if config.active {
                return Err(EconomyError::AlreadyActive);
            }
            if config.lane_mask != 0b1_1110 {
                return Err(EconomyError::MissingLaneVault);
            }
            if !config.stake_vault_initialized {
                return Err(EconomyError::MissingStakeVault);
            }
            if input.mint.supply != config.expected_supply {
                return Err(EconomyError::WrongFixedSupply);
            }
            if input.mint.mint_authority.is_some() {
                return Err(EconomyError::MintAuthorityNotRevoked);
            }
            if input.mint.freeze_authority.is_some() {
                return Err(EconomyError::FreezeAuthorityNotRevoked);
            }
            let expected_community =
                v2_policy::lane_policy(v2_policy::COMMUNITY, config.rehearsal_mode)
                    .ok_or(EconomyError::UnknownLane)?
                    .total;
            v2_verify_community_funding(
                input.community_tokens,
                input.mint.key,
                expected_community,
            )?;
            v2_verify_stake_vault(input.stake_tokens, input.mint.key, input.vault_authority, 0)?;
            v2_verify_lane_funding(
                &treasury,
                input.treasury_tokens,
                input.mint.key,
                input.vault_authority,
            )?;
            v2_verify_lane_funding(
                &ecosystem,
                input.ecosystem_tokens,
                input.mint.key,
                input.vault_authority,
            )?;
            v2_verify_lane_funding(
                &core_team,
                input.core_team_tokens,
                input.mint.key,
                input.vault_authority,
            )?;
            v2_verify_lane_funding(
                &liquidity,
                input.liquidity_tokens,
                input.mint.key,
                input.vault_authority,
            )?;
            let core_principal =
                v2_policy::lane_policy(v2_policy::CORE_TEAM, config.rehearsal_mode)
                    .ok_or(EconomyError::UnknownLane)?
                    .total;
            let obligation = v2_policy::maximum_reward(
                core_principal,
                v2_policy::CORE_RATE_BPS,
                v2_policy::CORE_TERM_WEEKS,
            )
            .ok_or(EconomyError::ArithmeticOverflow)?;
            let (treasury_reserved, ecosystem_reserved, liquidity_reserved) =
                v2_reserve_three_lanes(
                    &mut treasury,
                    &mut ecosystem,
                    &mut liquidity,
                    obligation,
                    0,
                )?;
            let core_reward = V2CoreRewardState {
                config: input.config_key.into(),
                principal: core_principal,
                annual_rate_bps: v2_policy::CORE_RATE_BPS,
                term_weeks: v2_policy::CORE_TERM_WEEKS,
                treasury_reserved,
                ecosystem_reserved,
                liquidity_reserved,
                paid: 0,
                settled_low: 0,
                settled_high: 0,
                bump: input.core_reward_bump,
            };
            config.active = true;
            Ok((config, treasury, ecosystem, liquidity, core_reward))
        })();

        match result {
            Err(error) => ActivateObservation::Error(error),
            Ok((config, treasury, ecosystem, liquidity, core_reward)) => {
                ActivateObservation::Success(Box::new(ActivateResult {
                    config: semantic_config_from_v2(config),
                    treasury: semantic_lane_from_v2(treasury),
                    ecosystem: semantic_lane_from_v2(ecosystem),
                    liquidity: semantic_lane_from_v2(liquidity),
                    core_reward: semantic_core_from_v2(core_reward),
                }))
            }
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
        assert_eq!(PROGRAM_ADMIN, iat_v2::PROGRAM_ADMIN.to_bytes());
        assert_eq!(COMMUNITY_CUSTODY, iat_v2::COMMUNITY_CUSTODY.to_bytes());
        assert_eq!(
            TREASURY_BENEFICIARY,
            iat_v2::TREASURY_BENEFICIARY.to_bytes()
        );
        assert_eq!(
            ECOSYSTEM_BENEFICIARY,
            iat_v2::ECOSYSTEM_BENEFICIARY.to_bytes()
        );
        assert_eq!(CORE_BENEFICIARY, iat_v2::CORE_BENEFICIARY.to_bytes());
        assert_eq!(
            LIQUIDITY_BENEFICIARY,
            iat_v2::LIQUIDITY_BENEFICIARY.to_bytes()
        );
        assert_eq!(ON_DEMAND_MAINNET_PID, V2_ON_DEMAND_MAINNET_PID.to_bytes());
        assert_eq!(ON_DEMAND_DEVNET_PID, V2_ON_DEMAND_DEVNET_PID.to_bytes());
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
    fn initialize_config_differential_and_adversarial_vectors_match_retained_v2() {
        let vectors = [
            InitializeConfigVector {
                input: InitializeConfigInput {
                    admin: [0xff; 32],
                    mint_decimals: TOKEN_DECIMALS.wrapping_add(1),
                    randomness_program: [0xee; 32],
                    rehearsal_genesis_timestamp: None,
                    ..valid_initialize_config_vector("ignored", true).input
                },
                ..valid_initialize_config_vector(
                    "hardware admin precedes decimals, cluster, and timestamp validation",
                    true,
                )
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    mint_decimals: TOKEN_DECIMALS.wrapping_add(1),
                    randomness_program: [0xee; 32],
                    rehearsal_genesis_timestamp: None,
                    ..valid_initialize_config_vector("ignored", true).input
                },
                ..valid_initialize_config_vector(
                    "mint decimals precede cluster and timestamp validation",
                    true,
                )
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    randomness_program: ON_DEMAND_MAINNET_PID,
                    rehearsal_genesis_timestamp: None,
                    ..valid_initialize_config_vector("ignored", true).input
                },
                ..valid_initialize_config_vector(
                    "rehearsal cluster validation precedes missing timestamp",
                    true,
                )
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    randomness_program: ON_DEMAND_DEVNET_PID,
                    rehearsal_genesis_timestamp: Some(i64::MAX),
                    ..valid_initialize_config_vector("ignored", false).input
                },
                ..valid_initialize_config_vector(
                    "production cluster validation precedes forbidden override",
                    false,
                )
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    rehearsal_genesis_timestamp: None,
                    ..valid_initialize_config_vector("ignored", true).input
                },
                ..valid_initialize_config_vector("rehearsal timestamp is required", true)
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    rehearsal_genesis_timestamp: Some(i64::MAX),
                    ..valid_initialize_config_vector("ignored", false).input
                },
                ..valid_initialize_config_vector(
                    "production override is forbidden before any future check",
                    false,
                )
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    rehearsal_genesis_timestamp: Some(1_001),
                    ..valid_initialize_config_vector("ignored", true).input
                },
                ..valid_initialize_config_vector("rehearsal genesis cannot be in the future", true)
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    rehearsal_genesis_timestamp: Some(1_000),
                    ..valid_initialize_config_vector("ignored", true).input
                },
                ..valid_initialize_config_vector("rehearsal genesis may equal Clock", true)
            },
            valid_initialize_config_vector("rehearsal genesis may precede Clock", true),
            InitializeConfigVector {
                input: InitializeConfigInput {
                    mint: [0xa1; 32],
                    token_program: [0xa2; 32],
                    rehearsal_genesis_timestamp: Some(i64::MIN),
                    config_bump: 0,
                    vault_authority_bump: u8::MAX,
                    ..valid_initialize_config_vector("ignored", true).input
                },
                clock_timestamp: i64::MIN,
                ..valid_initialize_config_vector(
                    "minimum rehearsal timestamp and bump boundaries",
                    true,
                )
            },
            InitializeConfigVector {
                input: InitializeConfigInput {
                    mint: [0xb1; 32],
                    token_program: [0xb2; 32],
                    config_bump: u8::MAX,
                    vault_authority_bump: 0,
                    ..valid_initialize_config_vector("ignored", false).input
                },
                clock_timestamp: i64::MIN,
                ..valid_initialize_config_vector(
                    "production genesis is the minimum Clock timestamp",
                    false,
                )
            },
            InitializeConfigVector {
                clock_timestamp: i64::MAX,
                ..valid_initialize_config_vector(
                    "production genesis is the maximum Clock timestamp",
                    false,
                )
            },
        ];

        for vector in vectors {
            let actual = observe_initialize_config(initialize_config_transition(
                vector.input,
                vector.clock_timestamp,
            ));
            let expected = v2_initialize_config_reference(vector);
            assert_eq!(actual, expected, "{}", vector.name);
        }

        let rehearsal = initialize_config_transition(
            valid_initialize_config_vector("rehearsal snapshot", true).input,
            1_000,
        )
        .unwrap()
        .config;
        assert_eq!(rehearsal.expected_supply, REHEARSAL_SUPPLY);
        assert_eq!(rehearsal.genesis_timestamp, 900);
        assert!(rehearsal.rehearsal_mode);
        assert!(!rehearsal.active);
        assert!(!rehearsal.stake_vault_initialized);
        assert_eq!(rehearsal.lane_mask, 0);
        assert_eq!(rehearsal.stake_token_account, [0; 32]);
        assert_eq!(rehearsal.staked_principal, 0);
        assert_eq!(rehearsal.agency_registry_hash, [0; 32]);
        assert_eq!(rehearsal.agency_count, 0);

        let production = initialize_config_transition(
            valid_initialize_config_vector("production snapshot", false).input,
            i64::MAX,
        )
        .unwrap()
        .config;
        assert_eq!(production.expected_supply, MAINNET_SUPPLY);
        assert_eq!(production.genesis_timestamp, i64::MAX);
        assert!(!production.rehearsal_mode);
    }

    #[test]
    fn production_initialize_config_requires_an_open_daily_law_capability() {
        let open_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &open_bytes).unwrap();
        let result = initialize_config(
            &gate,
            valid_initialize_config_vector("production wrapper", false).input,
        )
        .unwrap();
        assert_eq!(result.config.genesis_timestamp, FRIDAY_BOUNDARY_UTC);
        assert_eq!(result.config.expected_supply, MAINNET_SUPPLY);

        let locked_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, true)));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &locked_bytes),
            Err(EconomyError::DailyLockdown)
        );
    }

    #[test]
    fn initialize_lane_vault_differential_vectors_match_retained_v2() {
        let active = valid_initialize_lane_vault_vector("active", COMMUNITY, true);
        let invalid_community = valid_initialize_lane_vault_vector("community", COMMUNITY, true);
        let invalid_high = valid_initialize_lane_vault_vector("high lane", u8::MAX, false);
        let already_initialized =
            valid_initialize_lane_vault_vector("already initialized", CORE_TEAM, false);

        let vectors = [
            InitializeLaneVaultVector {
                name: "active precedes invalid lane and initialized-bit checks",
                input: InitializeLaneVaultInput {
                    config: ConfigState {
                        active: true,
                        lane_mask: u8::MAX,
                        ..active.input.config
                    },
                    ..active.input
                },
            },
            InitializeLaneVaultVector {
                name: "community lane is rejected before its initialized bit",
                input: InitializeLaneVaultInput {
                    config: ConfigState {
                        lane_mask: 1u8 << COMMUNITY,
                        ..invalid_community.input.config
                    },
                    ..invalid_community.input
                },
            },
            valid_initialize_lane_vault_vector("lane above liquidity is rejected", 5, false),
            invalid_high,
            InitializeLaneVaultVector {
                name: "initialized bit is checked before policy construction",
                input: InitializeLaneVaultInput {
                    config: ConfigState {
                        lane_mask: (1u8 << TREASURY) | (1u8 << CORE_TEAM),
                        ..already_initialized.input.config
                    },
                    ..already_initialized.input
                },
            },
            valid_initialize_lane_vault_vector("production treasury", TREASURY, false),
            valid_initialize_lane_vault_vector("production ecosystem", ECOSYSTEM, false),
            valid_initialize_lane_vault_vector("production core", CORE_TEAM, false),
            valid_initialize_lane_vault_vector("production liquidity", LIQUIDITY, false),
            valid_initialize_lane_vault_vector("rehearsal treasury", TREASURY, true),
            valid_initialize_lane_vault_vector("rehearsal ecosystem", ECOSYSTEM, true),
            valid_initialize_lane_vault_vector("rehearsal core", CORE_TEAM, true),
            InitializeLaneVaultVector {
                input: InitializeLaneVaultInput {
                    config_key: [0xa1; 32],
                    lane_token_account: [0xa2; 32],
                    lane_state_bump: 0,
                    lane_token_bump: u8::MAX,
                    config: ConfigState {
                        lane_mask: 1u8 << TREASURY,
                        ..valid_initialize_lane_vault_vector("ignored", LIQUIDITY, true)
                            .input
                            .config
                    },
                    ..valid_initialize_lane_vault_vector("ignored", LIQUIDITY, true).input
                },
                ..valid_initialize_lane_vault_vector(
                    "rehearsal liquidity preserves unrelated mask and bump boundaries",
                    LIQUIDITY,
                    true,
                )
            },
        ];

        for vector in vectors {
            let actual =
                observe_initialize_lane_vault(initialize_lane_vault_transition(vector.input));
            let expected = v2_initialize_lane_vault_reference(vector);
            assert_eq!(actual, expected, "{}", vector.name);
        }
    }

    #[test]
    fn initialize_lane_vault_exhaustive_precedence_matches_retained_v2() {
        for active in [false, true] {
            for rehearsal_mode in [false, true] {
                for lane in u8::MIN..=u8::MAX {
                    for lane_mask in u8::MIN..=u8::MAX {
                        let base = valid_initialize_lane_vault_vector(
                            "exhaustive lane precedence",
                            lane,
                            rehearsal_mode,
                        );
                        let vector = InitializeLaneVaultVector {
                            input: InitializeLaneVaultInput {
                                config: ConfigState {
                                    active,
                                    lane_mask,
                                    ..base.input.config
                                },
                                ..base.input
                            },
                            ..base
                        };
                        let actual = observe_initialize_lane_vault(
                            initialize_lane_vault_transition(vector.input),
                        );
                        let expected = v2_initialize_lane_vault_reference(vector);
                        assert_eq!(
                            actual, expected,
                            "active={active} rehearsal={rehearsal_mode} lane={lane} mask={lane_mask}"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn initialize_lane_vault_errors_and_private_policy_helpers_are_pinned() {
        for rehearsal_mode in [false, true] {
            for lane in u8::MIN..=u8::MAX {
                let expected =
                    v2_policy::lane_policy(lane, rehearsal_mode).map(|policy| LanePolicy {
                        total: policy.total,
                        genesis_unlocked: policy.genesis_unlocked,
                        cliff_week: policy.cliff_week,
                        linear_end_week: policy.linear_end_week,
                        reward_source: policy.reward_source,
                    });
                assert_eq!(lane_policy(lane, rehearsal_mode), expected, "lane={lane}");
            }
        }
        assert_eq!(beneficiary(COMMUNITY), Some(COMMUNITY_CUSTODY));
        assert_eq!(beneficiary(TREASURY), Some(TREASURY_BENEFICIARY));
        assert_eq!(beneficiary(ECOSYSTEM), Some(ECOSYSTEM_BENEFICIARY));
        assert_eq!(beneficiary(CORE_TEAM), Some(CORE_BENEFICIARY));
        assert_eq!(beneficiary(LIQUIDITY), Some(LIQUIDITY_BENEFICIARY));
        assert_eq!(beneficiary(LIQUIDITY + 1), None);
        assert_eq!(beneficiary(u8::MAX), None);

        let base = valid_initialize_lane_vault_vector("fixed errors", CORE_TEAM, false).input;
        assert_eq!(
            initialize_lane_vault_transition(InitializeLaneVaultInput {
                lane: u8::MAX,
                config: ConfigState {
                    active: true,
                    lane_mask: u8::MAX,
                    ..base.config
                },
                ..base
            }),
            Err(EconomyError::AlreadyActive)
        );
        assert_eq!(
            initialize_lane_vault_transition(InitializeLaneVaultInput {
                lane: COMMUNITY,
                config: ConfigState {
                    lane_mask: 1u8 << COMMUNITY,
                    ..base.config
                },
                ..base
            }),
            Err(EconomyError::CommunityMustUseHardwareCustody)
        );
        assert_eq!(
            initialize_lane_vault_transition(InitializeLaneVaultInput {
                lane: CORE_TEAM,
                config: ConfigState {
                    lane_mask: 1u8 << CORE_TEAM,
                    ..base.config
                },
                ..base
            }),
            Err(EconomyError::LaneAlreadyInitialized)
        );
    }

    #[test]
    fn initialize_lane_vault_accumulates_the_exact_v2_mask_and_requires_open_law() {
        let open_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &open_bytes).unwrap();
        let mut config = valid_initialize_lane_vault_vector("mask sequence", TREASURY, false)
            .input
            .config;

        for lane in TREASURY..=LIQUIDITY {
            let vector = valid_initialize_lane_vault_vector("mask sequence", lane, false);
            let result = initialize_lane_vault(
                &gate,
                InitializeLaneVaultInput {
                    config,
                    ..vector.input
                },
            )
            .unwrap();
            assert_eq!(result.lane_state.lane, lane);
            assert_eq!(result.lane_state.reserved, 0);
            assert_eq!(result.lane_state.paid, 0);
            assert_eq!(result.lane_state.principal_claimed, 0);
            config = result.config;
        }
        assert_eq!(config.lane_mask, 0b1_1110);

        let locked_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, true)));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &locked_bytes),
            Err(EconomyError::DailyLockdown)
        );
    }

    #[test]
    fn initialize_stake_vault_differential_and_error_precedence_match_retained_v2() {
        let base = valid_initialize_stake_vault_vector("base");
        let vectors = [
            InitializeStakeVaultVector {
                name: "active precedes the already-initialized check",
                input: InitializeStakeVaultInput {
                    config: ConfigState {
                        active: true,
                        stake_vault_initialized: true,
                        stake_token_account: [0xa1; 32],
                        ..base.input.config
                    },
                    stake_token_account: [0xa2; 32],
                },
            },
            InitializeStakeVaultVector {
                name: "an initialized stake vault is rejected",
                input: InitializeStakeVaultInput {
                    config: ConfigState {
                        stake_vault_initialized: true,
                        stake_token_account: [0xb1; 32],
                        ..base.input.config
                    },
                    stake_token_account: [0xb2; 32],
                },
            },
            valid_initialize_stake_vault_vector("canonical fresh config"),
            InitializeStakeVaultVector {
                name: "a stale uninitialized binding is overwritten exactly like V2",
                input: InitializeStakeVaultInput {
                    config: ConfigState {
                        stake_token_account: [0xc1; 32],
                        rehearsal_mode: true,
                        lane_mask: u8::MAX,
                        staked_principal: u64::MAX,
                        ..base.input.config
                    },
                    stake_token_account: [0xc2; 32],
                },
            },
            InitializeStakeVaultVector {
                name: "zero target account bytes are handler-body parity",
                input: InitializeStakeVaultInput {
                    config: ConfigState {
                        bump: 0,
                        vault_authority_bump: u8::MAX,
                        ..base.input.config
                    },
                    stake_token_account: [0; 32],
                },
            },
            InitializeStakeVaultVector {
                name: "maximum target account bytes are handler-body parity",
                input: InitializeStakeVaultInput {
                    stake_token_account: [u8::MAX; 32],
                    ..base.input
                },
            },
        ];

        for vector in vectors {
            let actual =
                observe_initialize_stake_vault(initialize_stake_vault_transition(vector.input));
            let expected = v2_initialize_stake_vault_reference(vector);
            assert_eq!(actual, expected, "{}", vector.name);
        }

        for active in [false, true] {
            for stake_vault_initialized in [false, true] {
                let vector = InitializeStakeVaultVector {
                    name: "boolean precedence grid",
                    input: InitializeStakeVaultInput {
                        config: ConfigState {
                            active,
                            stake_vault_initialized,
                            ..base.input.config
                        },
                        ..base.input
                    },
                };
                let actual =
                    observe_initialize_stake_vault(initialize_stake_vault_transition(vector.input));
                let expected = v2_initialize_stake_vault_reference(vector);
                assert_eq!(
                    actual, expected,
                    "active={active} initialized={stake_vault_initialized}"
                );
            }
        }

        assert_eq!(
            initialize_stake_vault_transition(InitializeStakeVaultInput {
                config: ConfigState {
                    active: true,
                    stake_vault_initialized: true,
                    ..base.input.config
                },
                ..base.input
            }),
            Err(EconomyError::AlreadyActive)
        );
        assert_eq!(
            initialize_stake_vault_transition(InitializeStakeVaultInput {
                config: ConfigState {
                    stake_vault_initialized: true,
                    ..base.input.config
                },
                ..base.input
            }),
            Err(EconomyError::StakeVaultAlreadyInitialized)
        );
    }

    #[test]
    fn initialize_stake_vault_changes_only_the_v2_binding_and_requires_open_law() {
        let open_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &open_bytes).unwrap();
        let vector = valid_initialize_stake_vault_vector("open wrapper");
        let result = initialize_stake_vault(&gate, vector.input).unwrap();
        assert_eq!(
            result.config,
            ConfigState {
                stake_token_account: vector.input.stake_token_account,
                stake_vault_initialized: true,
                ..vector.input.config
            }
        );

        let locked_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, true)));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &locked_bytes),
            Err(EconomyError::DailyLockdown)
        );
    }

    #[test]
    fn activate_policy_math_and_success_match_the_retained_v2_handler_body() {
        for rehearsal_mode in [false, true] {
            for lane in COMMUNITY..=LIQUIDITY {
                let actual = lane_policy(lane, rehearsal_mode).unwrap();
                let expected = v2_policy::lane_policy(lane, rehearsal_mode).unwrap();
                assert_eq!(actual.total, expected.total);
                assert_eq!(actual.genesis_unlocked, expected.genesis_unlocked);
                assert_eq!(actual.cliff_week, expected.cliff_week);
                assert_eq!(actual.linear_end_week, expected.linear_end_week);
                assert_eq!(actual.reward_source, expected.reward_source);
                for week in [
                    0,
                    expected.cliff_week.saturating_sub(1),
                    expected.cliff_week,
                    expected.cliff_week.saturating_add(1),
                    expected.linear_end_week.saturating_sub(1),
                    expected.linear_end_week,
                    u64::MAX,
                ] {
                    assert_eq!(
                        cumulative_unlocked(actual, week),
                        v2_policy::cumulative_unlocked(expected, week),
                        "rehearsal={rehearsal_mode} lane={lane} week={week}"
                    );
                }
            }

            let vector = valid_activate_vector("canonical activation", rehearsal_mode);
            let actual = observe_activate(activate_transition(vector.input));
            let expected = v2_activate_reference(vector);
            assert_eq!(actual, expected, "rehearsal={rehearsal_mode}");

            let ActivateObservation::Success(result) = actual else {
                panic!("canonical activation must succeed")
            };
            let expected_principal = if rehearsal_mode {
                100_000_000_000
            } else {
                100_000_000_000_000_000
            };
            let expected_obligation = if rehearsal_mode {
                34_000_000_000
            } else {
                34_000_000_000_000_000
            };
            assert!(result.config.active);
            assert_eq!(result.core_reward.principal, expected_principal);
            assert_eq!(result.core_reward.annual_rate_bps, CORE_RATE_BPS);
            assert_eq!(result.core_reward.term_weeks, CORE_TERM_WEEKS);
            assert_eq!(result.core_reward.treasury_reserved, expected_obligation);
            assert_eq!(result.core_reward.ecosystem_reserved, 0);
            assert_eq!(result.core_reward.liquidity_reserved, 0);
            assert_eq!(result.core_reward.paid, 0);
            assert_eq!(result.core_reward.settled_low, 0);
            assert_eq!(result.core_reward.settled_high, 0);
            assert_eq!(result.treasury.reserved, expected_obligation);
            assert_eq!(result.ecosystem, vector.input.ecosystem);
            assert_eq!(result.liquidity, vector.input.liquidity);
        }

        for (principal, annual_rate_bps, term_weeks) in [
            (0, 0, 0),
            (1, 1, 1),
            (u64::MAX, 1, 1),
            (u64::MAX, u64::MAX, u64::MAX),
            (MAINNET_SUPPLY, CORE_RATE_BPS, CORE_TERM_WEEKS),
        ] {
            assert_eq!(
                maximum_reward(principal, annual_rate_bps, term_weeks),
                v2_policy::maximum_reward(principal, annual_rate_bps, term_weeks)
            );
        }
    }

    #[test]
    fn activate_validation_order_and_funding_errors_match_the_retained_v2_handler_body() {
        let base = valid_activate_vector("base", false);
        let mut vectors = Vec::new();

        let mut input = base.input;
        input.config.active = true;
        input.config.lane_mask = 0;
        input.config.stake_vault_initialized = false;
        input.mint.supply = 0;
        vectors.push((
            "active precedes all later checks",
            input,
            EconomyError::AlreadyActive,
        ));

        let mut input = base.input;
        input.config.lane_mask = 0b1_1111;
        input.config.stake_vault_initialized = false;
        vectors.push((
            "exact lane mask precedes stake state",
            input,
            EconomyError::MissingLaneVault,
        ));

        let mut input = base.input;
        input.config.stake_vault_initialized = false;
        input.mint.supply = 0;
        vectors.push((
            "stake initialization precedes supply",
            input,
            EconomyError::MissingStakeVault,
        ));

        let mut input = base.input;
        input.mint.supply = input.config.expected_supply - 1;
        input.mint.mint_authority = Some([0xa1; 32]);
        vectors.push((
            "supply precedes mint authority",
            input,
            EconomyError::WrongFixedSupply,
        ));

        let mut input = base.input;
        input.mint.mint_authority = Some([0xa2; 32]);
        input.mint.freeze_authority = Some([0xa3; 32]);
        vectors.push((
            "mint authority precedes freeze authority",
            input,
            EconomyError::MintAuthorityNotRevoked,
        ));

        let mut input = base.input;
        input.mint.freeze_authority = Some([0xa4; 32]);
        input.community_tokens.mint = [0xa5; 32];
        vectors.push((
            "freeze authority precedes funding",
            input,
            EconomyError::FreezeAuthorityNotRevoked,
        ));

        let mut input = base.input;
        input.community_tokens.mint = [0xb1; 32];
        input.community_tokens.owner = [0xb2; 32];
        input.community_tokens.amount = 0;
        vectors.push((
            "community mint precedes custody and amount",
            input,
            EconomyError::WrongTokenMint,
        ));

        let mut input = base.input;
        input.community_tokens.owner = [0xb3; 32];
        input.community_tokens.amount = 0;
        vectors.push((
            "community custody precedes amount",
            input,
            EconomyError::WrongCommunityCustody,
        ));

        let mut input = base.input;
        input.community_tokens.amount -= 1;
        input.stake_tokens.mint = [0xb4; 32];
        vectors.push((
            "community amount precedes stake vault",
            input,
            EconomyError::WrongCommunityFunding,
        ));

        let mut input = base.input;
        input.stake_tokens.mint = [0xc1; 32];
        input.stake_tokens.owner = [0xc2; 32];
        input.stake_tokens.amount = 1;
        vectors.push((
            "stake mint precedes owner and amount",
            input,
            EconomyError::WrongTokenMint,
        ));

        let mut input = base.input;
        input.stake_tokens.owner = [0xc3; 32];
        input.stake_tokens.amount = 1;
        vectors.push((
            "stake owner precedes amount",
            input,
            EconomyError::WrongVaultAuthority,
        ));

        let mut input = base.input;
        input.stake_tokens.amount = 1;
        input.treasury_tokens.key = [0xc4; 32];
        vectors.push((
            "stake amount precedes lane funding",
            input,
            EconomyError::StakeLedgerMismatch,
        ));

        let mut input = base.input;
        input.treasury_tokens.key = [0xd1; 32];
        input.treasury_tokens.mint = [0xd2; 32];
        vectors.push((
            "lane account binding precedes mint",
            input,
            EconomyError::WrongVaultTokenAccount,
        ));

        let mut input = base.input;
        input.treasury_tokens.mint = [0xd3; 32];
        input.treasury_tokens.owner = [0xd4; 32];
        vectors.push((
            "lane mint precedes authority",
            input,
            EconomyError::WrongTokenMint,
        ));

        let mut input = base.input;
        input.treasury_tokens.owner = [0xd5; 32];
        input.treasury_tokens.amount = 0;
        vectors.push((
            "lane authority precedes amount",
            input,
            EconomyError::WrongVaultAuthority,
        ));

        let mut input = base.input;
        input.treasury_tokens.amount -= 1;
        input.ecosystem_tokens.key = [0xd6; 32];
        vectors.push((
            "treasury amount precedes ecosystem",
            input,
            EconomyError::WrongVaultFunding,
        ));

        let mut input = base.input;
        input.ecosystem_tokens.key = [0xe1; 32];
        input.core_team_tokens.key = [0xe2; 32];
        vectors.push((
            "ecosystem precedes core",
            input,
            EconomyError::WrongVaultTokenAccount,
        ));

        let mut input = base.input;
        input.core_team_tokens.key = [0xe3; 32];
        input.liquidity_tokens.key = [0xe4; 32];
        vectors.push((
            "core precedes liquidity",
            input,
            EconomyError::WrongVaultTokenAccount,
        ));

        let mut input = base.input;
        input.liquidity_tokens.key = [0xe5; 32];
        vectors.push((
            "liquidity is checked last",
            input,
            EconomyError::WrongVaultTokenAccount,
        ));

        for (name, input, expected_error) in vectors {
            let vector = ActivateVector { name, input };
            assert_eq!(
                observe_activate(activate_transition(input)),
                ActivateObservation::Error(expected_error),
                "fixed error: {name}"
            );
            assert_eq!(
                observe_activate(activate_transition(input)),
                v2_activate_reference(vector),
                "V2 differential: {name}"
            );
        }
    }

    #[test]
    fn activate_reservation_edges_match_v2_and_preserve_atomic_output_semantics() {
        let base = valid_activate_vector("reservation base", false);
        let obligation = 34_000_000_000_000_000;

        let mut spill = base.input;
        spill.treasury.genesis_unlocked = 1;
        spill.ecosystem.genesis_unlocked = 2;
        spill.liquidity.genesis_unlocked = obligation;
        let spill_result = activate_transition(spill).unwrap();
        assert_eq!(spill_result.core_reward.treasury_reserved, 1);
        assert_eq!(spill_result.core_reward.ecosystem_reserved, 2);
        assert_eq!(spill_result.core_reward.liquidity_reserved, obligation - 3);
        assert_eq!(
            observe_activate(Ok(spill_result)),
            v2_activate_reference(ActivateVector {
                name: "three-lane spill",
                input: spill,
            })
        );

        let mut overclaimed = base.input;
        overclaimed.treasury.genesis_unlocked = 5;
        overclaimed.treasury.reserved = 6;
        let overclaimed_result = activate_transition(overclaimed).unwrap();
        assert_eq!(overclaimed_result.core_reward.treasury_reserved, 0);
        assert_eq!(
            overclaimed_result.core_reward.ecosystem_reserved,
            obligation
        );
        assert_eq!(
            observe_activate(Ok(overclaimed_result)),
            v2_activate_reference(ActivateVector {
                name: "used above unlocked saturates capacity to zero",
                input: overclaimed,
            })
        );

        let mut early_return = base.input;
        early_return.ecosystem.reward_source = false;
        early_return.ecosystem.reserved = u64::MAX;
        early_return.ecosystem.paid = 1;
        early_return.liquidity.reward_source = false;
        assert!(activate_transition(early_return).is_ok());
        assert_eq!(
            observe_activate(activate_transition(early_return)),
            v2_activate_reference(ActivateVector {
                name: "later lanes are skipped once the obligation is reserved",
                input: early_return,
            })
        );

        let cases = [
            {
                let mut input = base.input;
                input.treasury.lane = ECOSYSTEM;
                (
                    "wrong stored lane order",
                    input,
                    EconomyError::WrongLaneOrder,
                )
            },
            {
                let mut input = base.input;
                input.treasury.reward_source = false;
                (
                    "first required reward lane is disabled",
                    input,
                    EconomyError::NotRewardLane,
                )
            },
            {
                let mut input = base.input;
                input.treasury.reserved = u64::MAX;
                input.treasury.paid = 1;
                (
                    "used-ledger addition overflows",
                    input,
                    EconomyError::ArithmeticOverflow,
                )
            },
            {
                let mut input = base.input;
                input.treasury.genesis_unlocked = 0;
                input.ecosystem.genesis_unlocked = 0;
                input.liquidity.genesis_unlocked = 0;
                (
                    "combined unlocked capacity is insufficient",
                    input,
                    EconomyError::InsufficientUnlockedRewardCapacity,
                )
            },
        ];

        for (name, input, expected_error) in cases {
            let original = input;
            assert_eq!(activate_transition(input), Err(expected_error), "{name}");
            assert_eq!(
                input, original,
                "by-value input changed after error: {name}"
            );
            assert_eq!(
                observe_activate(activate_transition(input)),
                v2_activate_reference(ActivateVector { name, input }),
                "{name}"
            );
        }
    }

    #[test]
    fn activate_requires_an_open_canonical_daily_law_capability() {
        let open_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, false)));
        let gate = verify(FRIDAY_BOUNDARY_UTC, &open_bytes).unwrap();
        let vector = valid_activate_vector("open activation wrapper", true);
        assert!(activate(&gate, vector.input).unwrap().config.active);

        let locked_bytes = pack_law_state(Some(decision_for(FRIDAY_BOUNDARY_UTC, true)));
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &locked_bytes),
            Err(EconomyError::DailyLockdown)
        );
        let missing_bytes = pack_law_state(None);
        assert_eq!(
            verify(FRIDAY_BOUNDARY_UTC, &missing_bytes),
            Err(EconomyError::DayUnfinalized)
        );
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

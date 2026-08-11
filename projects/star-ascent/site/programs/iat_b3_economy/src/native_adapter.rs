//! Host-only native account adapter and atomic write-intent boundary.
//!
//! This production source is deliberately unreachable from a Solana
//! dispatcher or entrypoint. It performs no borrow, allocation, CPI, token
//! transfer, or account write. It derives the frozen economy PDA recipes,
//! authenticates read-only account observations, binds the seven already-
//! frozen strict state codecs to their PDA identities, and prepares CAS-style
//! transaction-local intents. A future executable adapter must validate Daily
//! Law first, validate every batch precondition, and execute the entire batch
//! in one Solana instruction so a failure rolls every effect back.
//!
//! Config is intentionally absent from this mutable state/intents surface. A
//! separate strict representation and feature-gated read-only parser exist,
//! but its lifecycle and transition predicate remain blocked on the unresolved
//! Genesis-staging/Active/cap rule. Nothing here changes that HOLD,
//! authenticates owner policy, or makes a retained handler complete.

use crate::{
    decode_agency_owner_index_state, decode_agency_state, decode_core_reward_state,
    decode_eligibility_state, decode_lane_state, decode_position_state, decode_round_state,
    encode_agency_owner_index_state, encode_agency_state, encode_core_reward_state,
    encode_eligibility_state, encode_lane_state, encode_position_state, encode_round_state,
    AgencyOwnerIndexState, AgencyState, CodecError, CoreRewardState, EligibilityState, LaneState,
    PositionState, RoundState, ValidatedDailyLawWrite, AGENCY_ACCOUNT_LEN,
    AGENCY_OWNER_INDEX_ACCOUNT_LEN, CORE_REWARD_ACCOUNT_LEN, ELIGIBILITY_ACCOUNT_LEN,
    LANE_ACCOUNT_LEN, POSITION_ACCOUNT_LEN, ROUND_ACCOUNT_LEN,
};
use sha2::{Digest, Sha256};
use solana_pubkey::Pubkey;
use solana_sdk_ids::system_program;

pub const NATIVE_ACCOUNT_ADAPTER_STATUS: &str = "HOST_ONLY_NONACTIVATING_STRICT_STATE_ADAPTER";
pub const MAX_STRICT_STATE_ACCOUNT_LEN: usize = ROUND_ACCOUNT_LEN;
pub const NO_PARTIAL_WRITES_ALLOWED: bool = true;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NativeAdapterTruth {
    pub host_only: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub account_writes_executed: bool,
    pub system_cpi_executed: bool,
    pub token_cpi_executed: bool,
    pub rent_sysvar_authenticated: bool,
    pub config_codec_supported: bool,
    pub runtime_authorization_complete: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const NATIVE_ADAPTER_TRUTH: NativeAdapterTruth = NativeAdapterTruth {
    host_only: true,
    entrypoint_exposed: false,
    dispatcher_exposed: false,
    account_writes_executed: false,
    system_cpi_executed: false,
    token_cpi_executed: false,
    rent_sysvar_authenticated: false,
    config_codec_supported: false,
    runtime_authorization_complete: false,
    any_handler_complete: false,
    mainnet_hold: true,
};

pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault-authority";
pub const LANE_STATE_SEED: &[u8] = b"lane";
pub const LANE_TOKEN_SEED: &[u8] = b"lane-token";
pub const STAKE_TOKEN_SEED: &[u8] = b"stake-token";
pub const STAKE_INGRESS_SEED: &[u8] = b"stake-ingress";
pub const CORE_REWARD_SEED: &[u8] = b"core-reward";
pub const AGENCY_SEED: &[u8] = b"agency";
pub const AGENCY_OWNER_INDEX_SEED: &[u8] = b"agency-owner";
pub const ELIGIBILITY_SEED: &[u8] = b"eligibility";
pub const POSITION_SEED: &[u8] = b"position";
pub const ROUND_SEED: &[u8] = b"round";
pub const FACTION_CONFIG_SEED: &[u8] = b"faction-config";
pub const FACTION_ALLEGIANCE_SEED: &[u8] = b"faction-allegiance";
pub const FACTION_WEEK_SEED: &[u8] = b"faction-week";
pub const FACTION_SCORE_SEED: &[u8] = b"faction-score";
pub const FACTION_REWARD_VAULT_SEED: &[u8] = b"faction-reward-vault";
pub const FACTION_REWARD_MANIFEST_SEED: &[u8] = b"faction-reward";
pub const FACTION_FOLLOWER_SNAPSHOT_SEED: &[u8] = b"faction-followers";
pub const FACTION_CLAIM_SEED: &[u8] = b"faction-claim";

const WRITE_BATCH_DOMAIN: &[u8] = b"IAT_B3_NATIVE_WRITE_BATCH_V1";
const ZERO_KEY: [u8; 32] = [0; 32];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeAdapterError {
    EconomyProgramIsSystemProgram,
    ZeroMintIdentity,
    RuntimeIdentityCollision,
    ZeroPdaSeedIdentity,
    NonCanonicalConfigIdentity,
    ParentPdaBindingMismatch,
    AccountKeyMismatch,
    AccountOwnerMismatch,
    AccountMustBeWritable,
    AccountMustNotBeExecutable,
    PdaAccountMustNotBeSigner,
    SignerKeyMismatch,
    MissingRequiredSignature,
    SignerMustBeWritable,
    PayerMustBeSystemOwned,
    PayerDataMustBeEmpty,
    LawMintMismatch,
    Codec(CodecError),
    StateIdentityMismatch,
    PdaBumpMismatch,
    CompanionPdaMismatch,
    PostStateIdentityDrift,
    LawCapabilityMismatch,
    PreimageMismatch,
    VacantAccountDataNotEmpty,
    RentMinimumMustBePositive,
    PayerTargetCollision,
    PayerPreimageMismatch,
    PayerObservationCountMismatch,
    PayerObservationMissing,
    DuplicatePayerObservation,
    UnexpectedPayerObservation,
    InsufficientPayerBalance,
    FundingOverflow,
    EmptyWriteBatch,
    DuplicateWriteAccount,
    ObservationCountMismatch,
}

impl From<CodecError> for NativeAdapterError {
    fn from(value: CodecError) -> Self {
        Self::Codec(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NativeEconomyBinding {
    program_id: [u8; 32],
    mint: [u8; 32],
    config: [u8; 32],
    config_bump: u8,
}

impl NativeEconomyBinding {
    pub fn new(program_id: [u8; 32], mint: [u8; 32]) -> Result<Self, NativeAdapterError> {
        if program_id == system_program_id() {
            return Err(NativeAdapterError::EconomyProgramIsSystemProgram);
        }
        if mint == ZERO_KEY {
            return Err(NativeAdapterError::ZeroMintIdentity);
        }
        if mint == program_id {
            return Err(NativeAdapterError::RuntimeIdentityCollision);
        }
        let program = Pubkey::new_from_array(program_id);
        let (config, config_bump) = Pubkey::find_program_address(&[CONFIG_SEED, &mint], &program);
        Ok(Self {
            program_id,
            mint,
            config: config.to_bytes(),
            config_bump,
        })
    }

    pub const fn program_id(&self) -> [u8; 32] {
        self.program_id
    }

    pub const fn mint(&self) -> [u8; 32] {
        self.mint
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn config_bump(&self) -> u8 {
        self.config_bump
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum PdaKind {
    Config,
    VaultAuthority,
    LaneState,
    LaneToken,
    StakeToken,
    StakeIngress,
    CoreReward,
    Agency,
    AgencyOwnerIndex,
    Eligibility,
    Position,
    Round,
    FactionConfig,
    FactionAllegiance,
    FactionWeek,
    FactionScore,
    FactionRewardVault,
    FactionRewardManifest,
    FactionFollowerSnapshot,
    FactionClaim,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CanonicalFactionConfigPda {
    program_id: [u8; 32],
    mint: [u8; 32],
    key: [u8; 32],
    bump: u8,
}

impl CanonicalFactionConfigPda {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn bump(&self) -> u8 {
        self.bump
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CanonicalFactionWeekPda {
    program_id: [u8; 32],
    mint: [u8; 32],
    faction_config: [u8; 32],
    week: u64,
    key: [u8; 32],
    bump: u8,
}

impl CanonicalFactionWeekPda {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn bump(&self) -> u8 {
        self.bump
    }

    pub const fn week(&self) -> u64 {
        self.week
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CanonicalFactionRewardManifestPda {
    program_id: [u8; 32],
    mint: [u8; 32],
    faction_week: [u8; 32],
    key: [u8; 32],
    bump: u8,
}

impl CanonicalFactionRewardManifestPda {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn bump(&self) -> u8 {
        self.bump
    }
}

pub fn derive_faction_config(binding: &NativeEconomyBinding) -> CanonicalFactionConfigPda {
    let program = Pubkey::new_from_array(binding.program_id);
    let (key, bump) = derive(&program, &[FACTION_CONFIG_SEED, &binding.config]);
    CanonicalFactionConfigPda {
        program_id: binding.program_id,
        mint: binding.mint,
        key: key.to_bytes(),
        bump,
    }
}

pub fn derive_faction_week(
    binding: &NativeEconomyBinding,
    faction_config: &CanonicalFactionConfigPda,
    week: u64,
) -> Result<CanonicalFactionWeekPda, NativeAdapterError> {
    validate_faction_config_parent(binding, faction_config)?;
    let program = Pubkey::new_from_array(binding.program_id);
    let (key, bump) = derive(
        &program,
        &[FACTION_WEEK_SEED, &faction_config.key, &week.to_le_bytes()],
    );
    Ok(CanonicalFactionWeekPda {
        program_id: binding.program_id,
        mint: binding.mint,
        faction_config: faction_config.key,
        week,
        key: key.to_bytes(),
        bump,
    })
}

pub fn derive_faction_reward_manifest(
    binding: &NativeEconomyBinding,
    faction_week: &CanonicalFactionWeekPda,
) -> Result<CanonicalFactionRewardManifestPda, NativeAdapterError> {
    validate_faction_week_parent(binding, faction_week)?;
    let program = Pubkey::new_from_array(binding.program_id);
    let (key, bump) = derive(&program, &[FACTION_REWARD_MANIFEST_SEED, &faction_week.key]);
    Ok(CanonicalFactionRewardManifestPda {
        program_id: binding.program_id,
        mint: binding.mint,
        faction_week: faction_week.key,
        key: key.to_bytes(),
        bump,
    })
}

/// Exact seed inputs from the frozen B3 identity inventory. Program identity
/// is supplied only by [`NativeEconomyBinding`], never by instruction data.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PdaIdentity {
    Config {
        mint: [u8; 32],
    },
    VaultAuthority {
        config: [u8; 32],
    },
    LaneState {
        config: [u8; 32],
        lane: u8,
    },
    LaneToken {
        config: [u8; 32],
        lane: u8,
    },
    StakeToken {
        config: [u8; 32],
    },
    StakeIngress {
        config: [u8; 32],
    },
    CoreReward {
        config: [u8; 32],
    },
    Agency {
        config: [u8; 32],
        index: u32,
    },
    AgencyOwnerIndex {
        config: [u8; 32],
        owner: [u8; 32],
    },
    Eligibility {
        config: [u8; 32],
        operator: [u8; 32],
    },
    Position {
        config: [u8; 32],
        operator: [u8; 32],
        position_id: u64,
    },
    Round {
        config: [u8; 32],
        week: u64,
    },
    FactionConfig {
        config: [u8; 32],
    },
    FactionAllegiance {
        faction_config: CanonicalFactionConfigPda,
        operator: [u8; 32],
    },
    FactionWeek {
        faction_config: CanonicalFactionConfigPda,
        week: u64,
    },
    FactionScore {
        faction_week: CanonicalFactionWeekPda,
        faction_id: u8,
    },
    FactionRewardVault {
        faction_config: CanonicalFactionConfigPda,
    },
    FactionRewardManifest {
        faction_week: CanonicalFactionWeekPda,
    },
    FactionFollowerSnapshot {
        faction_week: CanonicalFactionWeekPda,
        faction_id: u8,
    },
    FactionClaim {
        reward_manifest: CanonicalFactionRewardManifestPda,
        operator: [u8; 32],
    },
}

impl PdaIdentity {
    pub const fn kind(self) -> PdaKind {
        match self {
            Self::Config { .. } => PdaKind::Config,
            Self::VaultAuthority { .. } => PdaKind::VaultAuthority,
            Self::LaneState { .. } => PdaKind::LaneState,
            Self::LaneToken { .. } => PdaKind::LaneToken,
            Self::StakeToken { .. } => PdaKind::StakeToken,
            Self::StakeIngress { .. } => PdaKind::StakeIngress,
            Self::CoreReward { .. } => PdaKind::CoreReward,
            Self::Agency { .. } => PdaKind::Agency,
            Self::AgencyOwnerIndex { .. } => PdaKind::AgencyOwnerIndex,
            Self::Eligibility { .. } => PdaKind::Eligibility,
            Self::Position { .. } => PdaKind::Position,
            Self::Round { .. } => PdaKind::Round,
            Self::FactionConfig { .. } => PdaKind::FactionConfig,
            Self::FactionAllegiance { .. } => PdaKind::FactionAllegiance,
            Self::FactionWeek { .. } => PdaKind::FactionWeek,
            Self::FactionScore { .. } => PdaKind::FactionScore,
            Self::FactionRewardVault { .. } => PdaKind::FactionRewardVault,
            Self::FactionRewardManifest { .. } => PdaKind::FactionRewardManifest,
            Self::FactionFollowerSnapshot { .. } => PdaKind::FactionFollowerSnapshot,
            Self::FactionClaim { .. } => PdaKind::FactionClaim,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DerivedPda {
    pub kind: PdaKind,
    pub key: [u8; 32],
    pub bump: u8,
}

pub fn derive_pda(
    binding: &NativeEconomyBinding,
    identity: PdaIdentity,
) -> Result<DerivedPda, NativeAdapterError> {
    validate_seed_identities(binding, identity)?;
    let program_id = Pubkey::new_from_array(binding.program_id);
    let (key, bump) = match identity {
        PdaIdentity::Config { mint } => derive(&program_id, &[CONFIG_SEED, &mint]),
        PdaIdentity::VaultAuthority { config } => {
            derive(&program_id, &[VAULT_AUTHORITY_SEED, &config])
        }
        PdaIdentity::LaneState { config, lane } => {
            derive(&program_id, &[LANE_STATE_SEED, &config, &[lane]])
        }
        PdaIdentity::LaneToken { config, lane } => {
            derive(&program_id, &[LANE_TOKEN_SEED, &config, &[lane]])
        }
        PdaIdentity::StakeToken { config } => derive(&program_id, &[STAKE_TOKEN_SEED, &config]),
        PdaIdentity::StakeIngress { config } => derive(&program_id, &[STAKE_INGRESS_SEED, &config]),
        PdaIdentity::CoreReward { config } => derive(&program_id, &[CORE_REWARD_SEED, &config]),
        PdaIdentity::Agency { config, index } => {
            derive(&program_id, &[AGENCY_SEED, &config, &index.to_le_bytes()])
        }
        PdaIdentity::AgencyOwnerIndex { config, owner } => {
            derive(&program_id, &[AGENCY_OWNER_INDEX_SEED, &config, &owner])
        }
        PdaIdentity::Eligibility { config, operator } => {
            derive(&program_id, &[ELIGIBILITY_SEED, &config, &operator])
        }
        PdaIdentity::Position {
            config,
            operator,
            position_id,
        } => derive(
            &program_id,
            &[
                POSITION_SEED,
                &config,
                &operator,
                &position_id.to_le_bytes(),
            ],
        ),
        PdaIdentity::Round { config, week } => {
            derive(&program_id, &[ROUND_SEED, &config, &week.to_le_bytes()])
        }
        PdaIdentity::FactionConfig { config } => {
            derive(&program_id, &[FACTION_CONFIG_SEED, &config])
        }
        PdaIdentity::FactionAllegiance {
            faction_config,
            operator,
        } => derive(
            &program_id,
            &[FACTION_ALLEGIANCE_SEED, &faction_config.key, &operator],
        ),
        PdaIdentity::FactionWeek {
            faction_config,
            week,
        } => derive(
            &program_id,
            &[FACTION_WEEK_SEED, &faction_config.key, &week.to_le_bytes()],
        ),
        PdaIdentity::FactionScore {
            faction_week,
            faction_id,
        } => derive(
            &program_id,
            &[FACTION_SCORE_SEED, &faction_week.key, &[faction_id]],
        ),
        PdaIdentity::FactionRewardVault { faction_config } => derive(
            &program_id,
            &[FACTION_REWARD_VAULT_SEED, &faction_config.key],
        ),
        PdaIdentity::FactionRewardManifest { faction_week } => derive(
            &program_id,
            &[FACTION_REWARD_MANIFEST_SEED, &faction_week.key],
        ),
        PdaIdentity::FactionFollowerSnapshot {
            faction_week,
            faction_id,
        } => derive(
            &program_id,
            &[
                FACTION_FOLLOWER_SNAPSHOT_SEED,
                &faction_week.key,
                &[faction_id],
            ],
        ),
        PdaIdentity::FactionClaim {
            reward_manifest,
            operator,
        } => derive(
            &program_id,
            &[FACTION_CLAIM_SEED, &reward_manifest.key, &operator],
        ),
    };
    Ok(DerivedPda {
        kind: identity.kind(),
        key: key.to_bytes(),
        bump,
    })
}

/// Reconstruct the exact canonical signer seeds for one already-validated PDA.
///
/// This helper is crate-private so runtime adapters can never accept arbitrary
/// caller-provided signer seeds. The bump is sealed into the write intent and
/// is rechecked against [`derive_pda`] before any CPI is attempted.
#[cfg(feature = "runtime-account-lifecycle")]
pub(crate) fn with_pda_signer_seeds<T>(
    identity: PdaIdentity,
    bump: u8,
    operation: impl FnOnce(&[&[u8]]) -> T,
) -> T {
    let bump_seed = [bump];
    match identity {
        PdaIdentity::Config { mint } => operation(&[CONFIG_SEED, &mint, &bump_seed]),
        PdaIdentity::VaultAuthority { config } => {
            operation(&[VAULT_AUTHORITY_SEED, &config, &bump_seed])
        }
        PdaIdentity::LaneState { config, lane } => {
            let lane_seed = [lane];
            operation(&[LANE_STATE_SEED, &config, &lane_seed, &bump_seed])
        }
        PdaIdentity::LaneToken { config, lane } => {
            let lane_seed = [lane];
            operation(&[LANE_TOKEN_SEED, &config, &lane_seed, &bump_seed])
        }
        PdaIdentity::StakeToken { config } => operation(&[STAKE_TOKEN_SEED, &config, &bump_seed]),
        PdaIdentity::StakeIngress { config } => {
            operation(&[STAKE_INGRESS_SEED, &config, &bump_seed])
        }
        PdaIdentity::CoreReward { config } => operation(&[CORE_REWARD_SEED, &config, &bump_seed]),
        PdaIdentity::Agency { config, index } => {
            let index_seed = index.to_le_bytes();
            operation(&[AGENCY_SEED, &config, &index_seed, &bump_seed])
        }
        PdaIdentity::AgencyOwnerIndex { config, owner } => {
            operation(&[AGENCY_OWNER_INDEX_SEED, &config, &owner, &bump_seed])
        }
        PdaIdentity::Eligibility { config, operator } => {
            operation(&[ELIGIBILITY_SEED, &config, &operator, &bump_seed])
        }
        PdaIdentity::Position {
            config,
            operator,
            position_id,
        } => {
            let position_seed = position_id.to_le_bytes();
            operation(&[
                POSITION_SEED,
                &config,
                &operator,
                &position_seed,
                &bump_seed,
            ])
        }
        PdaIdentity::Round { config, week } => {
            let week_seed = week.to_le_bytes();
            operation(&[ROUND_SEED, &config, &week_seed, &bump_seed])
        }
        PdaIdentity::FactionConfig { config } => {
            operation(&[FACTION_CONFIG_SEED, &config, &bump_seed])
        }
        PdaIdentity::FactionAllegiance {
            faction_config,
            operator,
        } => operation(&[
            FACTION_ALLEGIANCE_SEED,
            &faction_config.key,
            &operator,
            &bump_seed,
        ]),
        PdaIdentity::FactionWeek {
            faction_config,
            week,
        } => {
            let week_seed = week.to_le_bytes();
            operation(&[
                FACTION_WEEK_SEED,
                &faction_config.key,
                &week_seed,
                &bump_seed,
            ])
        }
        PdaIdentity::FactionScore {
            faction_week,
            faction_id,
        } => {
            let faction_seed = [faction_id];
            operation(&[
                FACTION_SCORE_SEED,
                &faction_week.key,
                &faction_seed,
                &bump_seed,
            ])
        }
        PdaIdentity::FactionRewardVault { faction_config } => {
            operation(&[FACTION_REWARD_VAULT_SEED, &faction_config.key, &bump_seed])
        }
        PdaIdentity::FactionRewardManifest { faction_week } => {
            operation(&[FACTION_REWARD_MANIFEST_SEED, &faction_week.key, &bump_seed])
        }
        PdaIdentity::FactionFollowerSnapshot {
            faction_week,
            faction_id,
        } => {
            let faction_seed = [faction_id];
            operation(&[
                FACTION_FOLLOWER_SNAPSHOT_SEED,
                &faction_week.key,
                &faction_seed,
                &bump_seed,
            ])
        }
        PdaIdentity::FactionClaim {
            reward_manifest,
            operator,
        } => operation(&[
            FACTION_CLAIM_SEED,
            &reward_manifest.key,
            &operator,
            &bump_seed,
        ]),
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NativeAccountObservation<'a> {
    pub key: [u8; 32],
    pub owner: [u8; 32],
    pub lamports: u64,
    pub data: &'a [u8],
    pub is_signer: bool,
    pub is_writable: bool,
    pub executable: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct LawWriteStamp {
    unix_timestamp: i64,
    local_day: i64,
    law_program_id: [u8; 32],
    law_state_address: [u8; 32],
    law_state_bump: u8,
    mint: [u8; 32],
    network_genesis_hash: [u8; 32],
    law_account_sha256: [u8; 32],
}

impl LawWriteStamp {
    const fn from_gate(gate: &ValidatedDailyLawWrite) -> Self {
        Self {
            unix_timestamp: gate.unix_timestamp(),
            local_day: gate.local_day(),
            law_program_id: gate.law_program_id(),
            law_state_address: gate.law_state_address(),
            law_state_bump: gate.law_state_bump(),
            mint: gate.mint(),
            network_genesis_hash: gate.network_genesis_hash(),
            law_account_sha256: gate.law_account_sha256(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AuthenticatedSigner {
    key: [u8; 32],
    writable: bool,
    law: LawWriteStamp,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AuthenticatedSystemPayer {
    key: [u8; 32],
    lamports: u64,
    law: LawWriteStamp,
}

impl AuthenticatedSystemPayer {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn lamports(&self) -> u64 {
        self.lamports
    }
}

impl AuthenticatedSigner {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn is_writable(&self) -> bool {
        self.writable
    }
}

pub fn authenticate_signer(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: NativeAccountObservation<'_>,
    expected_key: [u8; 32],
    must_be_writable: bool,
) -> Result<AuthenticatedSigner, NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    if expected_key == ZERO_KEY || account.key != expected_key {
        return Err(NativeAdapterError::SignerKeyMismatch);
    }
    if !account.is_signer {
        return Err(NativeAdapterError::MissingRequiredSignature);
    }
    if must_be_writable && !account.is_writable {
        return Err(NativeAdapterError::SignerMustBeWritable);
    }
    if account.executable {
        return Err(NativeAdapterError::AccountMustNotBeExecutable);
    }
    Ok(AuthenticatedSigner {
        key: account.key,
        writable: account.is_writable,
        law: LawWriteStamp::from_gate(gate),
    })
}

/// Authenticate the stronger lifecycle-payer shape separately from a generic
/// protocol authority. This still does not authenticate Rent; callers must not
/// treat the supplied rent minimum as sysvar-derived until a native runtime
/// adapter performs that missing check.
pub fn authenticate_system_payer(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: NativeAccountObservation<'_>,
    expected_key: [u8; 32],
) -> Result<AuthenticatedSystemPayer, NativeAdapterError> {
    let signer = authenticate_signer(gate, binding, account, expected_key, true)?;
    if account.owner != system_program_id() {
        return Err(NativeAdapterError::PayerMustBeSystemOwned);
    }
    if !account.data.is_empty() {
        return Err(NativeAdapterError::PayerDataMustBeEmpty);
    }
    Ok(AuthenticatedSystemPayer {
        key: signer.key,
        lamports: account.lamports,
        law: signer.law,
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum StrictStateKind {
    Position,
    Lane,
    Round,
    CoreReward,
    Agency,
    AgencyOwnerIndex,
    Eligibility,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StrictStateValue {
    Position(PositionState),
    Lane(LaneState),
    Round(RoundState),
    CoreReward(CoreRewardState),
    Agency(AgencyState),
    AgencyOwnerIndex(AgencyOwnerIndexState),
    Eligibility(EligibilityState),
}

impl StrictStateValue {
    pub const fn kind(self) -> StrictStateKind {
        match self {
            Self::Position(_) => StrictStateKind::Position,
            Self::Lane(_) => StrictStateKind::Lane,
            Self::Round(_) => StrictStateKind::Round,
            Self::CoreReward(_) => StrictStateKind::CoreReward,
            Self::Agency(_) => StrictStateKind::Agency,
            Self::AgencyOwnerIndex(_) => StrictStateKind::AgencyOwnerIndex,
            Self::Eligibility(_) => StrictStateKind::Eligibility,
        }
    }
}

impl StrictStateKind {
    pub const fn account_len(self) -> usize {
        match self {
            Self::Position => POSITION_ACCOUNT_LEN,
            Self::Lane => LANE_ACCOUNT_LEN,
            Self::Round => ROUND_ACCOUNT_LEN,
            Self::CoreReward => CORE_REWARD_ACCOUNT_LEN,
            Self::Agency => AGENCY_ACCOUNT_LEN,
            Self::AgencyOwnerIndex => AGENCY_OWNER_INDEX_ACCOUNT_LEN,
            Self::Eligibility => ELIGIBILITY_ACCOUNT_LEN,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AuthenticatedStateAccount {
    law: LawWriteStamp,
    key: [u8; 32],
    owner: [u8; 32],
    identity: PdaIdentity,
    state: StrictStateValue,
    preimage_sha256: [u8; 32],
}

impl AuthenticatedStateAccount {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn identity(&self) -> PdaIdentity {
        self.identity
    }

    pub const fn state(&self) -> StrictStateValue {
        self.state
    }

    pub const fn preimage_sha256(&self) -> [u8; 32] {
        self.preimage_sha256
    }
}

pub fn authenticate_state_account(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: NativeAccountObservation<'_>,
    expected_identity: PdaIdentity,
) -> Result<AuthenticatedStateAccount, NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    let derived = derive_pda(binding, expected_identity)?;
    if account.key != derived.key {
        return Err(NativeAdapterError::AccountKeyMismatch);
    }
    if account.owner != binding.program_id {
        return Err(NativeAdapterError::AccountOwnerMismatch);
    }
    require_pda_account_flags(account)?;

    let state = decode_expected_state(expected_identity, account.data)?;
    validate_state_identity(binding, state, expected_identity, derived.bump)?;
    Ok(AuthenticatedStateAccount {
        law: LawWriteStamp::from_gate(gate),
        key: account.key,
        owner: account.owner,
        identity: expected_identity,
        state,
        preimage_sha256: sha256(account.data),
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum CreatePdaLifecycle {
    CreateAccount,
    AllocateAssignAndFund,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ExistingStateWriteIntent {
    law: LawWriteStamp,
    key: [u8; 32],
    owner: [u8; 32],
    identity: PdaIdentity,
    kind: StrictStateKind,
    data_len: u16,
    expected_preimage_sha256: [u8; 32],
    postimage_sha256: [u8; 32],
    postimage: [u8; MAX_STRICT_STATE_ACCOUNT_LEN],
}

impl ExistingStateWriteIntent {
    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn data_len(&self) -> usize {
        self.data_len as usize
    }

    pub fn postimage(&self) -> &[u8] {
        &self.postimage[..self.data_len()]
    }

    pub const fn expected_preimage_sha256(&self) -> [u8; 32] {
        self.expected_preimage_sha256
    }

    pub const fn postimage_sha256(&self) -> [u8; 32] {
        self.postimage_sha256
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CreateStateAccountIntent {
    law: LawWriteStamp,
    payer: [u8; 32],
    key: [u8; 32],
    owner: [u8; 32],
    identity: PdaIdentity,
    kind: StrictStateKind,
    bump: u8,
    lifecycle: CreatePdaLifecycle,
    expected_payer_lamports: u64,
    expected_lamports: u64,
    rent_minimum_lamports: u64,
    funding_lamports: u64,
    data_len: u16,
    postimage_sha256: [u8; 32],
    postimage: [u8; MAX_STRICT_STATE_ACCOUNT_LEN],
    invoke_signed_required: bool,
}

impl CreateStateAccountIntent {
    pub const fn payer(&self) -> [u8; 32] {
        self.payer
    }

    pub const fn key(&self) -> [u8; 32] {
        self.key
    }

    pub const fn owner(&self) -> [u8; 32] {
        self.owner
    }

    pub const fn identity(&self) -> PdaIdentity {
        self.identity
    }

    pub const fn bump(&self) -> u8 {
        self.bump
    }

    pub const fn lifecycle(&self) -> CreatePdaLifecycle {
        self.lifecycle
    }

    pub const fn expected_lamports(&self) -> u64 {
        self.expected_lamports
    }

    pub const fn expected_payer_lamports(&self) -> u64 {
        self.expected_payer_lamports
    }

    pub const fn rent_minimum_lamports(&self) -> u64 {
        self.rent_minimum_lamports
    }

    pub const fn funding_lamports(&self) -> u64 {
        self.funding_lamports
    }

    pub const fn data_len(&self) -> usize {
        self.data_len as usize
    }

    pub fn postimage(&self) -> &[u8] {
        &self.postimage[..self.data_len()]
    }

    pub const fn postimage_sha256(&self) -> [u8; 32] {
        self.postimage_sha256
    }

    pub const fn invoke_signed_required(&self) -> bool {
        self.invoke_signed_required
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StateWriteIntent {
    Existing(ExistingStateWriteIntent),
    Create(CreateStateAccountIntent),
}

impl StateWriteIntent {
    pub const fn key(&self) -> [u8; 32] {
        match self {
            Self::Existing(intent) => intent.key,
            Self::Create(intent) => intent.key,
        }
    }

    const fn law(&self) -> LawWriteStamp {
        match self {
            Self::Existing(intent) => intent.law,
            Self::Create(intent) => intent.law,
        }
    }
}

// Preserve the fixed preimage and postimage in an isolated SBF frame.
#[inline(never)]
pub fn prepare_existing_state_write(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    authenticated: &AuthenticatedStateAccount,
    next: StrictStateValue,
) -> Result<StateWriteIntent, NativeAdapterError> {
    Ok(StateWriteIntent::Existing(
        prepare_existing_state_write_intent(gate, binding, authenticated, next)?,
    ))
}

/// Existing-only counterpart used by borrowed production batches so callers
/// do not have to materialize the larger create-capable enum for every slot.
#[inline(never)]
pub fn prepare_existing_state_write_intent(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    authenticated: &AuthenticatedStateAccount,
    next: StrictStateValue,
) -> Result<ExistingStateWriteIntent, NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    let law = LawWriteStamp::from_gate(gate);
    if authenticated.law != law {
        return Err(NativeAdapterError::LawCapabilityMismatch);
    }
    let derived = derive_pda(binding, authenticated.identity)?;
    if authenticated.owner != binding.program_id || authenticated.key != derived.key {
        return Err(NativeAdapterError::AccountOwnerMismatch);
    }
    if state_identity(next) != authenticated.identity {
        return Err(NativeAdapterError::PostStateIdentityDrift);
    }
    validate_state_identity(binding, next, authenticated.identity, derived.bump)?;
    let (postimage, data_len) = encode_state(next)?;
    let postimage_sha256 = sha256(&postimage[..data_len]);
    Ok(ExistingStateWriteIntent {
        law: LawWriteStamp::from_gate(gate),
        key: authenticated.key,
        owner: authenticated.owner,
        identity: authenticated.identity,
        kind: next.kind(),
        data_len: data_len as u16,
        expected_preimage_sha256: authenticated.preimage_sha256,
        postimage_sha256,
        postimage,
    })
}

// Preserve an SBF frame boundary around the fixed-size sealed postimage.
#[inline(never)]
pub fn prepare_create_state_account(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    payer: &AuthenticatedSystemPayer,
    target: NativeAccountObservation<'_>,
    identity: PdaIdentity,
    initial_state: StrictStateValue,
    rent_minimum_lamports: u64,
) -> Result<StateWriteIntent, NativeAdapterError> {
    prepare_create_state_account_with_rent_policy(
        gate,
        binding,
        payer,
        target,
        identity,
        initial_state,
        rent_minimum_lamports,
        CreateRentMinimumPolicy::RequirePositive,
    )
}

/// Internal counterpart for a lifecycle that has already authenticated the
/// runtime Rent sysvar. Pinned Anchor 1.0.2 permits a raw zero Rent minimum on
/// its vacant `create_account` branch; the public native planning API above
/// intentionally retains its positive-Rent prerequisite.
#[inline(never)]
#[allow(clippy::too_many_arguments)]
pub(crate) fn prepare_runtime_rent_create_state_account(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    payer: &AuthenticatedSystemPayer,
    target: NativeAccountObservation<'_>,
    identity: PdaIdentity,
    initial_state: StrictStateValue,
    rent_minimum_lamports: u64,
) -> Result<StateWriteIntent, NativeAdapterError> {
    prepare_create_state_account_with_rent_policy(
        gate,
        binding,
        payer,
        target,
        identity,
        initial_state,
        rent_minimum_lamports,
        CreateRentMinimumPolicy::AuthenticatedRuntimeRent,
    )
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CreateRentMinimumPolicy {
    RequirePositive,
    AuthenticatedRuntimeRent,
}

#[allow(clippy::too_many_arguments)]
fn prepare_create_state_account_with_rent_policy(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    payer: &AuthenticatedSystemPayer,
    target: NativeAccountObservation<'_>,
    identity: PdaIdentity,
    initial_state: StrictStateValue,
    rent_minimum_lamports: u64,
    rent_policy: CreateRentMinimumPolicy,
) -> Result<StateWriteIntent, NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    let law = LawWriteStamp::from_gate(gate);
    if payer.law != law {
        return Err(NativeAdapterError::LawCapabilityMismatch);
    }
    let derived = derive_pda(binding, identity)?;
    if target.key != derived.key {
        return Err(NativeAdapterError::AccountKeyMismatch);
    }
    if payer.key == target.key {
        return Err(NativeAdapterError::PayerTargetCollision);
    }
    if target.owner != system_program_id() {
        return Err(NativeAdapterError::AccountOwnerMismatch);
    }
    require_pda_account_flags(target)?;
    if !target.data.is_empty() {
        return Err(NativeAdapterError::VacantAccountDataNotEmpty);
    }
    if rent_minimum_lamports == 0 && rent_policy == CreateRentMinimumPolicy::RequirePositive {
        return Err(NativeAdapterError::RentMinimumMustBePositive);
    }
    if state_identity(initial_state) != identity {
        return Err(NativeAdapterError::StateIdentityMismatch);
    }
    validate_state_identity(binding, initial_state, identity, derived.bump)?;
    let (postimage, data_len) = encode_state(initial_state)?;
    let lifecycle = if target.lamports == 0 {
        CreatePdaLifecycle::CreateAccount
    } else {
        CreatePdaLifecycle::AllocateAssignAndFund
    };
    let funding_lamports = rent_minimum_lamports.saturating_sub(target.lamports);
    if payer.lamports < funding_lamports {
        return Err(NativeAdapterError::InsufficientPayerBalance);
    }
    Ok(StateWriteIntent::Create(CreateStateAccountIntent {
        law,
        payer: payer.key,
        key: target.key,
        owner: binding.program_id,
        identity,
        kind: initial_state.kind(),
        bump: derived.bump,
        lifecycle,
        expected_payer_lamports: payer.lamports,
        expected_lamports: target.lamports,
        rent_minimum_lamports,
        funding_lamports,
        data_len: data_len as u16,
        postimage_sha256: sha256(&postimage[..data_len]),
        postimage,
        invoke_signed_required: true,
    }))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AtomicWriteBatch<const N: usize> {
    law: LawWriteStamp,
    intents: [StateWriteIntent; N],
    commitment_sha256: [u8; 32],
}

/// A sealed existing-only batch that borrows each caller-owned intent instead
/// of copying fixed-size postimages into a second owning batch. The fields are
/// private and the value is deliberately non-`Clone`/non-`Copy`; its lifetime
/// prevents any intent from being changed while the seal is live.
#[derive(Debug, Eq, PartialEq)]
pub struct BorrowedExistingWriteBatch<'a, const N: usize> {
    law: LawWriteStamp,
    intents: [&'a ExistingStateWriteIntent; N],
    commitment_sha256: [u8; 32],
}

impl<const N: usize> BorrowedExistingWriteBatch<'_, N> {
    pub const fn intents(&self) -> &[&ExistingStateWriteIntent; N] {
        &self.intents
    }

    pub const fn commitment_sha256(&self) -> [u8; 32] {
        self.commitment_sha256
    }
}

impl<const N: usize> AtomicWriteBatch<N> {
    pub const fn intents(&self) -> &[StateWriteIntent; N] {
        &self.intents
    }

    pub const fn commitment_sha256(&self) -> [u8; 32] {
        self.commitment_sha256
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ValidatedAtomicWriteBatch<const N: usize> {
    batch: AtomicWriteBatch<N>,
}

/// Consumed validation capability for a borrowed sealed batch. Like the seal,
/// this is intentionally non-`Clone`/non-`Copy`.
#[derive(Debug, Eq, PartialEq)]
pub struct ValidatedBorrowedExistingWriteBatch<'a, const N: usize> {
    batch: BorrowedExistingWriteBatch<'a, N>,
}

impl<const N: usize> ValidatedBorrowedExistingWriteBatch<'_, N> {
    pub const fn batch(&self) -> &BorrowedExistingWriteBatch<'_, N> {
        &self.batch
    }
}

impl<const N: usize> ValidatedAtomicWriteBatch<N> {
    pub const fn batch(&self) -> &AtomicWriteBatch<N> {
        &self.batch
    }
}

// Prevent LTO from merging sealed intent construction into an entrypoint
// frame; the batch remains passed by value and its bytes stay unchanged.
#[inline(never)]
pub fn seal_atomic_write_batch<const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    intents: [StateWriteIntent; N],
) -> Result<AtomicWriteBatch<N>, NativeAdapterError> {
    let (law, commitment_sha256) = seal_atomic_write_intents(gate, binding, &intents)?;
    Ok(AtomicWriteBatch {
        law,
        intents,
        commitment_sha256,
    })
}

/// Seal existing caller-owned intents without copying their fixed-size
/// postimages. The commitment domain and per-intent fields are byte-identical
/// to an owning batch containing the same ordered Existing variants.
#[inline(never)]
pub fn seal_existing_write_batch_borrowed<'a, const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    intents: [&'a ExistingStateWriteIntent; N],
) -> Result<BorrowedExistingWriteBatch<'a, N>, NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    if N == 0 {
        return Err(NativeAdapterError::EmptyWriteBatch);
    }
    let law = LawWriteStamp::from_gate(gate);
    for left in 0..N {
        if intents[left].law != law {
            return Err(NativeAdapterError::LawCapabilityMismatch);
        }
        for right in (left + 1)..N {
            if intents[left].key == intents[right].key {
                return Err(NativeAdapterError::DuplicateWriteAccount);
            }
        }
    }
    let commitment_sha256 = batch_commitment_existing_refs(law, &intents);
    Ok(BorrowedExistingWriteBatch {
        law,
        intents,
        commitment_sha256,
    })
}

fn seal_atomic_write_intents<const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    intents: &[StateWriteIntent; N],
) -> Result<(LawWriteStamp, [u8; 32]), NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    if N == 0 {
        return Err(NativeAdapterError::EmptyWriteBatch);
    }
    let law = LawWriteStamp::from_gate(gate);
    for left in 0..N {
        if intents[left].law() != law {
            return Err(NativeAdapterError::LawCapabilityMismatch);
        }
        for right in (left + 1)..N {
            if intents[left].key() == intents[right].key() {
                return Err(NativeAdapterError::DuplicateWriteAccount);
            }
        }
    }
    validate_batch_funding(intents)?;
    let commitment_sha256 = batch_commitment(law, intents);
    Ok((law, commitment_sha256))
}

pub fn validate_atomic_write_preconditions<const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    observations: &[NativeAccountObservation<'_>],
    payer_observations: &[NativeAccountObservation<'_>],
) -> Result<ValidatedAtomicWriteBatch<N>, NativeAdapterError> {
    validate_atomic_write_preconditions_inner(
        gate,
        binding,
        batch.law,
        &batch.intents,
        batch.commitment_sha256,
        observations,
        payer_observations,
    )?;
    Ok(ValidatedAtomicWriteBatch { batch })
}

pub fn validate_existing_write_preconditions_borrowed<'a, const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    batch: BorrowedExistingWriteBatch<'a, N>,
    observations: &[NativeAccountObservation<'_>],
    payer_observations: &[NativeAccountObservation<'_>],
) -> Result<ValidatedBorrowedExistingWriteBatch<'a, N>, NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    if batch.law != LawWriteStamp::from_gate(gate) {
        return Err(NativeAdapterError::LawCapabilityMismatch);
    }
    if observations.len() != N {
        return Err(NativeAdapterError::ObservationCountMismatch);
    }
    if !payer_observations.is_empty() {
        return Err(NativeAdapterError::PayerObservationCountMismatch);
    }
    if batch.commitment_sha256 != batch_commitment_existing_refs(batch.law, &batch.intents) {
        return Err(NativeAdapterError::PreimageMismatch);
    }
    for (intent, observation) in batch.intents.iter().zip(observations) {
        validate_existing_intent_precondition(intent, *observation)?;
    }
    Ok(ValidatedBorrowedExistingWriteBatch { batch })
}

#[allow(clippy::too_many_arguments)]
fn validate_atomic_write_preconditions_inner<const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    law: LawWriteStamp,
    intents: &[StateWriteIntent; N],
    commitment_sha256: [u8; 32],
    observations: &[NativeAccountObservation<'_>],
    payer_observations: &[NativeAccountObservation<'_>],
) -> Result<(), NativeAdapterError> {
    require_gate_mint(gate, binding)?;
    if law != LawWriteStamp::from_gate(gate) {
        return Err(NativeAdapterError::LawCapabilityMismatch);
    }
    if observations.len() != N {
        return Err(NativeAdapterError::ObservationCountMismatch);
    }
    if commitment_sha256 != batch_commitment(law, intents) {
        return Err(NativeAdapterError::PreimageMismatch);
    }
    validate_batch_funding(intents)?;
    for (intent, observation) in intents.iter().zip(observations) {
        validate_intent_precondition(intent, *observation)?;
    }
    validate_payer_preconditions(intents, payer_observations)?;
    Ok(())
}

fn validate_batch_funding<const N: usize>(
    intents: &[StateWriteIntent; N],
) -> Result<usize, NativeAdapterError> {
    let mut unique_payers = 0usize;
    for left in 0..N {
        let StateWriteIntent::Create(payer_intent) = intents[left] else {
            continue;
        };
        if intents
            .iter()
            .any(|intent| intent.key() == payer_intent.payer)
        {
            return Err(NativeAdapterError::PayerTargetCollision);
        }
        if intents[..left].iter().any(|intent| {
            matches!(intent, StateWriteIntent::Create(value) if value.payer == payer_intent.payer)
        }) {
            continue;
        }
        unique_payers = unique_payers
            .checked_add(1)
            .ok_or(NativeAdapterError::FundingOverflow)?;
        let mut aggregate = 0u64;
        for intent in intents {
            if let StateWriteIntent::Create(value) = intent {
                if value.payer == payer_intent.payer {
                    if value.expected_payer_lamports != payer_intent.expected_payer_lamports {
                        return Err(NativeAdapterError::PayerPreimageMismatch);
                    }
                    aggregate = aggregate
                        .checked_add(value.funding_lamports)
                        .ok_or(NativeAdapterError::FundingOverflow)?;
                }
            }
        }
        if payer_intent.expected_payer_lamports < aggregate {
            return Err(NativeAdapterError::InsufficientPayerBalance);
        }
    }
    Ok(unique_payers)
}

fn validate_payer_preconditions<const N: usize>(
    intents: &[StateWriteIntent; N],
    observations: &[NativeAccountObservation<'_>],
) -> Result<(), NativeAdapterError> {
    let expected_count = validate_batch_funding(intents)?;
    if observations.len() != expected_count {
        return Err(NativeAdapterError::PayerObservationCountMismatch);
    }
    for (index, observed) in observations.iter().enumerate() {
        if observations[..index]
            .iter()
            .any(|prior| prior.key == observed.key)
        {
            return Err(NativeAdapterError::DuplicatePayerObservation);
        }
        let mut expected_lamports = None;
        let mut aggregate = 0u64;
        for intent in intents {
            if let StateWriteIntent::Create(value) = intent {
                if value.payer == observed.key {
                    if let Some(expected) = expected_lamports {
                        if expected != value.expected_payer_lamports {
                            return Err(NativeAdapterError::PayerPreimageMismatch);
                        }
                    } else {
                        expected_lamports = Some(value.expected_payer_lamports);
                    }
                    aggregate = aggregate
                        .checked_add(value.funding_lamports)
                        .ok_or(NativeAdapterError::FundingOverflow)?;
                }
            }
        }
        let Some(expected_lamports) = expected_lamports else {
            return Err(NativeAdapterError::UnexpectedPayerObservation);
        };
        if observed.owner != system_program_id() {
            return Err(NativeAdapterError::PayerMustBeSystemOwned);
        }
        if !observed.is_signer {
            return Err(NativeAdapterError::MissingRequiredSignature);
        }
        if !observed.is_writable {
            return Err(NativeAdapterError::SignerMustBeWritable);
        }
        if observed.executable {
            return Err(NativeAdapterError::AccountMustNotBeExecutable);
        }
        if !observed.data.is_empty() {
            return Err(NativeAdapterError::PayerDataMustBeEmpty);
        }
        if observed.lamports != expected_lamports {
            return Err(NativeAdapterError::PayerPreimageMismatch);
        }
        if observed.lamports < aggregate {
            return Err(NativeAdapterError::InsufficientPayerBalance);
        }
    }
    for (index, intent) in intents.iter().enumerate() {
        let StateWriteIntent::Create(value) = intent else {
            continue;
        };
        if intents[..index].iter().any(
            |prior| matches!(prior, StateWriteIntent::Create(prior) if prior.payer == value.payer),
        ) {
            continue;
        }
        if !observations
            .iter()
            .any(|observed| observed.key == value.payer)
        {
            return Err(NativeAdapterError::PayerObservationMissing);
        }
    }
    Ok(())
}

fn validate_intent_precondition(
    intent: &StateWriteIntent,
    observation: NativeAccountObservation<'_>,
) -> Result<(), NativeAdapterError> {
    match intent {
        StateWriteIntent::Existing(existing) => {
            validate_existing_intent_precondition(existing, observation)?
        }
        StateWriteIntent::Create(create) => {
            if observation.key != create.key {
                return Err(NativeAdapterError::AccountKeyMismatch);
            }
            if observation.owner != system_program_id() {
                return Err(NativeAdapterError::AccountOwnerMismatch);
            }
            require_pda_account_flags(observation)?;
            if !observation.data.is_empty() {
                return Err(NativeAdapterError::VacantAccountDataNotEmpty);
            }
            if observation.lamports != create.expected_lamports {
                return Err(NativeAdapterError::PreimageMismatch);
            }
        }
    }
    Ok(())
}

fn validate_existing_intent_precondition(
    existing: &ExistingStateWriteIntent,
    observation: NativeAccountObservation<'_>,
) -> Result<(), NativeAdapterError> {
    if observation.key != existing.key {
        return Err(NativeAdapterError::AccountKeyMismatch);
    }
    if observation.owner != existing.owner {
        return Err(NativeAdapterError::AccountOwnerMismatch);
    }
    require_pda_account_flags(observation)?;
    if observation.data.len() != existing.data_len()
        || sha256(observation.data) != existing.expected_preimage_sha256
    {
        return Err(NativeAdapterError::PreimageMismatch);
    }
    Ok(())
}

fn require_pda_account_flags(
    account: NativeAccountObservation<'_>,
) -> Result<(), NativeAdapterError> {
    if !account.is_writable {
        return Err(NativeAdapterError::AccountMustBeWritable);
    }
    if account.executable {
        return Err(NativeAdapterError::AccountMustNotBeExecutable);
    }
    if account.is_signer {
        return Err(NativeAdapterError::PdaAccountMustNotBeSigner);
    }
    Ok(())
}

fn decode_expected_state(
    identity: PdaIdentity,
    data: &[u8],
) -> Result<StrictStateValue, NativeAdapterError> {
    Ok(match identity {
        PdaIdentity::Position { .. } => StrictStateValue::Position(decode_position_state(data)?),
        PdaIdentity::LaneState { .. } => StrictStateValue::Lane(decode_lane_state(data)?),
        PdaIdentity::Round { .. } => StrictStateValue::Round(decode_round_state(data)?),
        PdaIdentity::CoreReward { .. } => {
            StrictStateValue::CoreReward(decode_core_reward_state(data)?)
        }
        PdaIdentity::Agency { .. } => StrictStateValue::Agency(decode_agency_state(data)?),
        PdaIdentity::AgencyOwnerIndex { .. } => {
            StrictStateValue::AgencyOwnerIndex(decode_agency_owner_index_state(data)?)
        }
        PdaIdentity::Eligibility { .. } => {
            StrictStateValue::Eligibility(decode_eligibility_state(data)?)
        }
        _ => return Err(NativeAdapterError::StateIdentityMismatch),
    })
}

fn state_identity(state: StrictStateValue) -> PdaIdentity {
    match state {
        StrictStateValue::Position(value) => PdaIdentity::Position {
            config: value.config,
            operator: value.owner,
            position_id: value.position_id,
        },
        StrictStateValue::Lane(value) => PdaIdentity::LaneState {
            config: value.config,
            lane: value.lane,
        },
        StrictStateValue::Round(value) => PdaIdentity::Round {
            config: value.config,
            week: value.week,
        },
        StrictStateValue::CoreReward(value) => PdaIdentity::CoreReward {
            config: value.config,
        },
        StrictStateValue::Agency(value) => PdaIdentity::Agency {
            config: value.config,
            index: value.index,
        },
        StrictStateValue::AgencyOwnerIndex(value) => PdaIdentity::AgencyOwnerIndex {
            config: value.config,
            owner: value.owner,
        },
        StrictStateValue::Eligibility(value) => PdaIdentity::Eligibility {
            config: value.config,
            operator: value.wallet,
        },
    }
}

fn state_bump(state: StrictStateValue) -> u8 {
    match state {
        StrictStateValue::Position(value) => value.bump,
        StrictStateValue::Lane(value) => value.bump,
        StrictStateValue::Round(value) => value.bump,
        StrictStateValue::CoreReward(value) => value.bump,
        StrictStateValue::Agency(value) => value.bump,
        StrictStateValue::AgencyOwnerIndex(value) => value.bump,
        StrictStateValue::Eligibility(value) => value.bump,
    }
}

fn validate_state_identity(
    binding: &NativeEconomyBinding,
    state: StrictStateValue,
    expected_identity: PdaIdentity,
    expected_bump: u8,
) -> Result<(), NativeAdapterError> {
    if state_identity(state) != expected_identity {
        return Err(NativeAdapterError::StateIdentityMismatch);
    }
    if state_bump(state) != expected_bump {
        return Err(NativeAdapterError::PdaBumpMismatch);
    }
    if let StrictStateValue::Lane(lane) = state {
        let token = derive_pda(
            binding,
            PdaIdentity::LaneToken {
                config: lane.config,
                lane: lane.lane,
            },
        )?;
        if lane.token_account != token.key || lane.token_bump != token.bump {
            return Err(NativeAdapterError::CompanionPdaMismatch);
        }
    }
    Ok(())
}

fn encode_state(
    state: StrictStateValue,
) -> Result<([u8; MAX_STRICT_STATE_ACCOUNT_LEN], usize), NativeAdapterError> {
    let mut output = [0u8; MAX_STRICT_STATE_ACCOUNT_LEN];
    let len = match state {
        StrictStateValue::Position(value) => {
            encode_position_state(&value, &mut output[..POSITION_ACCOUNT_LEN])?;
            POSITION_ACCOUNT_LEN
        }
        StrictStateValue::Lane(value) => {
            encode_lane_state(&value, &mut output[..LANE_ACCOUNT_LEN])?;
            LANE_ACCOUNT_LEN
        }
        StrictStateValue::Round(value) => {
            encode_round_state(&value, &mut output[..ROUND_ACCOUNT_LEN])?;
            ROUND_ACCOUNT_LEN
        }
        StrictStateValue::CoreReward(value) => {
            encode_core_reward_state(&value, &mut output[..CORE_REWARD_ACCOUNT_LEN])?;
            CORE_REWARD_ACCOUNT_LEN
        }
        StrictStateValue::Agency(value) => {
            encode_agency_state(&value, &mut output[..AGENCY_ACCOUNT_LEN])?;
            AGENCY_ACCOUNT_LEN
        }
        StrictStateValue::AgencyOwnerIndex(value) => {
            encode_agency_owner_index_state(&value, &mut output[..AGENCY_OWNER_INDEX_ACCOUNT_LEN])?;
            AGENCY_OWNER_INDEX_ACCOUNT_LEN
        }
        StrictStateValue::Eligibility(value) => {
            encode_eligibility_state(&value, &mut output[..ELIGIBILITY_ACCOUNT_LEN])?;
            ELIGIBILITY_ACCOUNT_LEN
        }
    };
    Ok((output, len))
}

fn validate_seed_identities(
    binding: &NativeEconomyBinding,
    identity: PdaIdentity,
) -> Result<(), NativeAdapterError> {
    let valid = match identity {
        PdaIdentity::Config { mint } => mint != ZERO_KEY,
        PdaIdentity::VaultAuthority { config }
        | PdaIdentity::LaneState { config, .. }
        | PdaIdentity::LaneToken { config, .. }
        | PdaIdentity::StakeToken { config }
        | PdaIdentity::StakeIngress { config }
        | PdaIdentity::CoreReward { config }
        | PdaIdentity::Agency { config, .. }
        | PdaIdentity::Round { config, .. }
        | PdaIdentity::FactionConfig { config } => config != ZERO_KEY,
        PdaIdentity::AgencyOwnerIndex { config, owner } => config != ZERO_KEY && owner != ZERO_KEY,
        PdaIdentity::Eligibility { config, operator }
        | PdaIdentity::Position {
            config, operator, ..
        } => config != ZERO_KEY && operator != ZERO_KEY,
        PdaIdentity::FactionAllegiance { operator, .. }
        | PdaIdentity::FactionClaim { operator, .. } => operator != ZERO_KEY,
        PdaIdentity::FactionWeek { .. }
        | PdaIdentity::FactionScore { .. }
        | PdaIdentity::FactionRewardVault { .. }
        | PdaIdentity::FactionRewardManifest { .. }
        | PdaIdentity::FactionFollowerSnapshot { .. } => true,
    };
    if !valid {
        return Err(NativeAdapterError::ZeroPdaSeedIdentity);
    }
    let config = match identity {
        PdaIdentity::Config { mint } => {
            if mint != binding.mint {
                return Err(NativeAdapterError::NonCanonicalConfigIdentity);
            }
            None
        }
        PdaIdentity::VaultAuthority { config }
        | PdaIdentity::LaneState { config, .. }
        | PdaIdentity::LaneToken { config, .. }
        | PdaIdentity::StakeToken { config }
        | PdaIdentity::StakeIngress { config }
        | PdaIdentity::CoreReward { config }
        | PdaIdentity::Agency { config, .. }
        | PdaIdentity::AgencyOwnerIndex { config, .. }
        | PdaIdentity::Eligibility { config, .. }
        | PdaIdentity::Position { config, .. }
        | PdaIdentity::Round { config, .. }
        | PdaIdentity::FactionConfig { config } => Some(config),
        _ => None,
    };
    if config.is_some_and(|value| value != binding.config) {
        return Err(NativeAdapterError::NonCanonicalConfigIdentity);
    }
    match identity {
        PdaIdentity::FactionAllegiance { faction_config, .. }
        | PdaIdentity::FactionWeek { faction_config, .. }
        | PdaIdentity::FactionRewardVault { faction_config } => {
            validate_faction_config_parent(binding, &faction_config)?;
        }
        PdaIdentity::FactionScore { faction_week, .. }
        | PdaIdentity::FactionRewardManifest { faction_week }
        | PdaIdentity::FactionFollowerSnapshot { faction_week, .. } => {
            validate_faction_week_parent(binding, &faction_week)?;
        }
        PdaIdentity::FactionClaim {
            reward_manifest, ..
        } => validate_reward_manifest_parent(binding, &reward_manifest)?,
        _ => {}
    }
    Ok(())
}

fn validate_faction_config_parent(
    binding: &NativeEconomyBinding,
    parent: &CanonicalFactionConfigPda,
) -> Result<(), NativeAdapterError> {
    if *parent != derive_faction_config(binding) {
        return Err(NativeAdapterError::ParentPdaBindingMismatch);
    }
    Ok(())
}

fn validate_faction_week_parent(
    binding: &NativeEconomyBinding,
    parent: &CanonicalFactionWeekPda,
) -> Result<(), NativeAdapterError> {
    let faction_config = derive_faction_config(binding);
    if parent.program_id != binding.program_id
        || parent.mint != binding.mint
        || parent.faction_config != faction_config.key
    {
        return Err(NativeAdapterError::ParentPdaBindingMismatch);
    }
    let program = Pubkey::new_from_array(binding.program_id);
    let (key, bump) = derive(
        &program,
        &[
            FACTION_WEEK_SEED,
            &faction_config.key,
            &parent.week.to_le_bytes(),
        ],
    );
    if parent.key != key.to_bytes() || parent.bump != bump {
        return Err(NativeAdapterError::ParentPdaBindingMismatch);
    }
    Ok(())
}

fn validate_reward_manifest_parent(
    binding: &NativeEconomyBinding,
    parent: &CanonicalFactionRewardManifestPda,
) -> Result<(), NativeAdapterError> {
    if parent.program_id != binding.program_id || parent.mint != binding.mint {
        return Err(NativeAdapterError::ParentPdaBindingMismatch);
    }
    let program = Pubkey::new_from_array(binding.program_id);
    let (key, bump) = derive(
        &program,
        &[FACTION_REWARD_MANIFEST_SEED, &parent.faction_week],
    );
    if parent.key != key.to_bytes() || parent.bump != bump {
        return Err(NativeAdapterError::ParentPdaBindingMismatch);
    }
    Ok(())
}

fn derive(program_id: &Pubkey, seeds: &[&[u8]]) -> (Pubkey, u8) {
    Pubkey::find_program_address(seeds, program_id)
}

fn system_program_id() -> [u8; 32] {
    system_program::ID.to_bytes()
}

fn require_gate_mint(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
) -> Result<(), NativeAdapterError> {
    if gate.mint() != binding.mint {
        return Err(NativeAdapterError::LawMintMismatch);
    }
    Ok(())
}

fn sha256(input: &[u8]) -> [u8; 32] {
    Sha256::digest(input).into()
}

fn batch_commitment<const N: usize>(
    law: LawWriteStamp,
    intents: &[StateWriteIntent; N],
) -> [u8; 32] {
    let mut hash = begin_batch_commitment(law, N);
    for intent in intents {
        match intent {
            StateWriteIntent::Existing(value) => {
                update_existing_intent_commitment(&mut hash, value)
            }
            StateWriteIntent::Create(value) => update_create_intent_commitment(&mut hash, value),
        }
    }
    hash.finalize().into()
}

fn batch_commitment_existing_refs<const N: usize>(
    law: LawWriteStamp,
    intents: &[&ExistingStateWriteIntent; N],
) -> [u8; 32] {
    let mut hash = begin_batch_commitment(law, N);
    for intent in intents {
        update_existing_intent_commitment(&mut hash, intent);
    }
    hash.finalize().into()
}

fn begin_batch_commitment(law: LawWriteStamp, count: usize) -> Sha256 {
    let mut hash = Sha256::new();
    hash.update(WRITE_BATCH_DOMAIN);
    hash.update(law.unix_timestamp.to_le_bytes());
    hash.update(law.local_day.to_le_bytes());
    hash.update(law.law_program_id);
    hash.update(law.law_state_address);
    hash.update([law.law_state_bump]);
    hash.update(law.mint);
    hash.update(law.network_genesis_hash);
    hash.update(law.law_account_sha256);
    hash.update((count as u64).to_le_bytes());
    hash
}

fn update_existing_intent_commitment(hash: &mut Sha256, value: &ExistingStateWriteIntent) {
    hash.update([0]);
    hash.update(value.key);
    hash.update(value.owner);
    hash.update([value.kind as u8]);
    hash.update(value.data_len.to_le_bytes());
    hash.update(value.expected_preimage_sha256);
    hash.update(value.postimage_sha256);
}

fn update_create_intent_commitment(hash: &mut Sha256, value: &CreateStateAccountIntent) {
    hash.update([1]);
    hash.update(value.payer);
    hash.update(value.key);
    hash.update(value.owner);
    hash.update([value.kind as u8]);
    hash.update([value.bump]);
    hash.update([value.lifecycle as u8]);
    hash.update(value.expected_payer_lamports.to_le_bytes());
    hash.update(value.expected_lamports.to_le_bytes());
    hash.update(value.rent_minimum_lamports.to_le_bytes());
    hash.update(value.funding_lamports.to_le_bytes());
    hash.update(value.data_len.to_le_bytes());
    hash.update(value.postimage_sha256);
}

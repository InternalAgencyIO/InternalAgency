//! Non-executing candidate predicate for the two frozen Config/Genesis edges.
//!
//! This codifies one non-circular rule for owner and independent review. It is
//! not accepted policy and is not consumed by any writer, ABI, entrypoint, or
//! dispatcher. In particular, the returned candidate cannot authorize a phase
//! change: owner acceptance, authenticated preactivation facts, production
//! identities, final binaries, and execution evidence remain absent.

#[cfg(feature = "runtime-account-lifecycle")]
pub mod runtime_persistence;

extern crate alloc;

use alloc::boxed::Box;
use core::fmt;
use sha2::{Digest, Sha256};

use crate::{
    activate, beneficiary, encode_config_genesis_state, encode_core_reward_state,
    encode_lane_state, lane_policy, ActivateInput, ActivateResult, ConfigGenesisState,
    CoreRewardState, EconomyError, GenesisConservationReceipt, GenesisPhase, LaneState,
    ReadonlyMintState, ReadonlyTokenState, ValidatedDailyLawWrite, CONFIG_GENESIS_ACCOUNT_LEN,
    CORE_REWARD_ACCOUNT_LEN, CORE_TEAM, ECOSYSTEM, LANE_ACCOUNT_LEN, LIQUIDITY, MAINNET_SUPPLY,
    TREASURY,
};

pub const CONFIG_GENESIS_TRANSITION_CANDIDATE_DOMAIN: &[u8] =
    b"IAT_B3_CONFIG_GENESIS_TRANSITION_CANDIDATE_V1";
pub const CONFIG_GENESIS_ACTIVATION_POSTSTATES_DOMAIN: &[u8] =
    b"IAT_B3_CONFIG_GENESIS_ACTIVATION_POSTSTATES_V1";
pub const CONFIG_GENESIS_ACTIVATION_READSET_DOMAIN: &[u8] =
    b"IAT_B3_CONFIG_GENESIS_ACTIVATION_READSET_V1";
pub const CONFIG_GENESIS_TRANSITION_CANDIDATE_STATUS: &str =
    "NONEXECUTING_NONCIRCULAR_CANDIDATE_OWNER_ACCEPTANCE_REQUIRED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisTransitionCandidateTruth {
    pub exact_two_edge_order_checked: bool,
    pub staging_requires_empty_economic_state: bool,
    pub staging_daily_law_not_required: bool,
    pub activation_requires_open_daily_law: bool,
    pub activation_requires_conservation_receipt: bool,
    pub activation_requires_zero_preactivation_economic_state: bool,
    pub activation_binds_complete_readset: bool,
    pub activation_binds_retained_five_account_poststate: bool,
    pub owner_bootstrap_policy_accepted: bool,
    pub preactivation_facts_runtime_authenticated: bool,
    pub production_identity_binding_frozen: bool,
    pub transition_authorized: bool,
    pub account_writes_executed: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub mainnet_hold: bool,
}

pub const CONFIG_GENESIS_TRANSITION_CANDIDATE_TRUTH: ConfigGenesisTransitionCandidateTruth =
    ConfigGenesisTransitionCandidateTruth {
        exact_two_edge_order_checked: true,
        staging_requires_empty_economic_state: true,
        staging_daily_law_not_required: true,
        activation_requires_open_daily_law: true,
        activation_requires_conservation_receipt: true,
        activation_requires_zero_preactivation_economic_state: true,
        activation_binds_complete_readset: true,
        activation_binds_retained_five_account_poststate: true,
        owner_bootstrap_policy_accepted: false,
        preactivation_facts_runtime_authenticated: false,
        production_identity_binding_frozen: false,
        transition_authorized: false,
        account_writes_executed: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        mainnet_hold: true,
    };

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfigGenesisTransitionEdge {
    EnterGenesisStaging = 1,
    Activate = 2,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisPreactivationCandidateFacts {
    pub config_staked_principal: u64,
    pub config_agency_count: u32,
    pub lane_reserved_total: u64,
    pub lane_paid_total: u64,
    pub lane_principal_claimed_total: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisTransitionCandidate {
    edge: ConfigGenesisTransitionEdge,
    next_state: ConfigGenesisState,
    current_config_sha256: [u8; 32],
    law_account_sha256: Option<[u8; 32]>,
    conservation_manifest_sha256: Option<[u8; 32]>,
    candidate_facts_sha256: [u8; 32],
}

/// One indivisible, non-executing projection of the retained V2 activation
/// result. The private fields prevent callers from manufacturing a plan, while
/// the absence of any account writer keeps this value nonauthorizing.
#[derive(Eq, PartialEq)]
pub struct ConfigGenesisActivationPlan {
    config_key: [u8; 32],
    config: ConfigGenesisState,
    treasury: LaneState,
    ecosystem: LaneState,
    liquidity: LaneState,
    core_reward: CoreRewardState,
    current_config_sha256: [u8; 32],
    law_account_sha256: [u8; 32],
    conservation_manifest_sha256: [u8; 32],
    activation_readset_sha256: [u8; 32],
    poststates_sha256: [u8; 32],
}

impl fmt::Debug for ConfigGenesisActivationPlan {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ConfigGenesisActivationPlan")
            .field("current_config_sha256", &self.current_config_sha256)
            .field("law_account_sha256", &self.law_account_sha256)
            .field(
                "conservation_manifest_sha256",
                &self.conservation_manifest_sha256,
            )
            .field("activation_readset_sha256", &self.activation_readset_sha256)
            .field("poststates_sha256", &self.poststates_sha256)
            .finish_non_exhaustive()
    }
}

impl ConfigGenesisActivationPlan {
    pub const fn current_config_sha256(&self) -> [u8; 32] {
        self.current_config_sha256
    }

    pub const fn law_account_sha256(&self) -> [u8; 32] {
        self.law_account_sha256
    }

    pub const fn conservation_manifest_sha256(&self) -> [u8; 32] {
        self.conservation_manifest_sha256
    }

    pub const fn activation_readset_sha256(&self) -> [u8; 32] {
        self.activation_readset_sha256
    }

    pub const fn poststates_sha256(&self) -> [u8; 32] {
        self.poststates_sha256
    }

    /// Review-only equality check for the complete retained result. No single
    /// poststate accessor is exposed, preventing downstream Config-only use.
    pub fn matches_exact_retained_result(&self, result: &ActivateResult) -> bool {
        self.config.phase == GenesisPhase::Active
            && self.config.config == result.config
            && self.treasury == result.treasury
            && self.ecosystem == result.ecosystem
            && self.liquidity == result.liquidity
            && self.core_reward == result.core_reward
            && self.core_reward.config == self.config_key
    }
}

impl ConfigGenesisTransitionCandidate {
    pub const fn edge(&self) -> ConfigGenesisTransitionEdge {
        self.edge
    }

    pub const fn next_state(&self) -> ConfigGenesisState {
        self.next_state
    }

    pub const fn current_config_sha256(&self) -> [u8; 32] {
        self.current_config_sha256
    }

    pub const fn law_account_sha256(&self) -> Option<[u8; 32]> {
        self.law_account_sha256
    }

    pub const fn conservation_manifest_sha256(&self) -> Option<[u8; 32]> {
        self.conservation_manifest_sha256
    }

    pub const fn candidate_facts_sha256(&self) -> [u8; 32] {
        self.candidate_facts_sha256
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfigGenesisTransitionCandidateError {
    NonCanonicalPhase,
    NonProductionConfig,
    InvalidConfigIdentity,
    StagingStateNotEmpty,
    DailyLawMintMismatch,
    DailyLawBeforeGenesis,
    ConservationMintMismatch,
    ConservationTokenProgramMismatch,
    ConservationSupplyMismatch,
    GenesisFundingIncomplete,
    PreactivationEconomicStateNotVacuous,
    ActivateInputConfigKeyMismatch,
    ActivateInputConfigMismatch,
    ActivateInputMintMismatch,
    ActivateInputLaneBindingMismatch,
    ActivateInputStakeTokenMismatch,
    RetainedActivation(EconomyError),
    PostStateEncodingFailed,
    ConfigEncodingFailed,
}

/// Candidate for `UNINITIALIZED -> GENESIS_STAGING`.
///
/// Daily Law is deliberately not required on this edge: staging admits only an
/// empty economic state and therefore cannot create the circular dependency in
/// which a preactivation Daily Law decision requires an already-active core
/// custody regime. The returned value remains non-executing and unaccepted.
pub fn prepare_enter_genesis_staging_candidate(
    current: ConfigGenesisState,
    facts: GenesisPreactivationCandidateFacts,
) -> Result<ConfigGenesisTransitionCandidate, ConfigGenesisTransitionCandidateError> {
    if current.phase != GenesisPhase::Uninitialized || current.config.active {
        return Err(ConfigGenesisTransitionCandidateError::NonCanonicalPhase);
    }
    require_production_config(&current)?;
    if current.config.stake_token_account != [0; 32]
        || current.config.staked_principal != 0
        || current.config.agency_count != 0
        || current.config.lane_mask != 0
        || current.config.stake_vault_initialized
    {
        return Err(ConfigGenesisTransitionCandidateError::StagingStateNotEmpty);
    }
    require_vacuous_preactivation(facts)?;

    let mut next_state = current;
    next_state.phase = GenesisPhase::GenesisStaging;
    candidate(
        ConfigGenesisTransitionEdge::EnterGenesisStaging,
        current,
        next_state,
        None,
        None,
        facts,
    )
}

/// Build the complete retained activation poststate as one held plan.
///
/// The B3 phase and exact-current-config checks run first. Open Daily Law,
/// conservation, and the explicit vacuous-cap facts then precede the retained
/// V2 activation body. That body preserves its own established error order and
/// produces Config, three reward Lane, and CoreReward poststates together.
/// No account is borrowed mutably and no poststate is written here.
pub fn prepare_config_genesis_activation_plan(
    expected_config_key: [u8; 32],
    current: ConfigGenesisState,
    law: &ValidatedDailyLawWrite,
    conservation: &GenesisConservationReceipt,
    input: ActivateInput,
) -> Result<ConfigGenesisActivationPlan, ConfigGenesisTransitionCandidateError> {
    prepare_config_genesis_activation_plan_boxed(
        expected_config_key,
        current,
        law,
        conservation,
        Box::new(input),
    )
    .map(|plan| *plan)
}

/// Heap-bounded counterpart used by the runtime full-readset composer. Keeping
/// the retained input, activation result, and indivisible five-poststate plan
/// behind one indirection apiece prevents their fixed arrays from sharing a
/// single SBF frame; it does not change validation order or expose poststates.
#[inline(never)]
pub(crate) fn prepare_config_genesis_activation_plan_boxed(
    expected_config_key: [u8; 32],
    current: ConfigGenesisState,
    law: &ValidatedDailyLawWrite,
    conservation: &GenesisConservationReceipt,
    input: Box<ActivateInput>,
) -> Result<Box<ConfigGenesisActivationPlan>, ConfigGenesisTransitionCandidateError> {
    if current.phase != GenesisPhase::GenesisStaging || current.config.active {
        return Err(ConfigGenesisTransitionCandidateError::NonCanonicalPhase);
    }
    require_production_config(&current)?;
    if expected_config_key == [0; 32] || input.config_key != expected_config_key {
        return Err(ConfigGenesisTransitionCandidateError::ActivateInputConfigKeyMismatch);
    }
    if input.config != current.config {
        return Err(ConfigGenesisTransitionCandidateError::ActivateInputConfigMismatch);
    }
    if input.mint.key != current.config.mint {
        return Err(ConfigGenesisTransitionCandidateError::ActivateInputMintMismatch);
    }
    require_activation_lane_bindings(expected_config_key, &input)?;
    if input.stake_tokens.key != current.config.stake_token_account {
        return Err(ConfigGenesisTransitionCandidateError::ActivateInputStakeTokenMismatch);
    }
    if law.mint() != current.config.mint {
        return Err(ConfigGenesisTransitionCandidateError::DailyLawMintMismatch);
    }
    if law.unix_timestamp() < current.config.genesis_timestamp {
        return Err(ConfigGenesisTransitionCandidateError::DailyLawBeforeGenesis);
    }
    if conservation.manifest_mint() != current.config.mint {
        return Err(ConfigGenesisTransitionCandidateError::ConservationMintMismatch);
    }
    if conservation.manifest_token_program() != current.config.token_program {
        return Err(ConfigGenesisTransitionCandidateError::ConservationTokenProgramMismatch);
    }
    if conservation.observed_supply() != MAINNET_SUPPLY
        || conservation.observed_allocation_total() != MAINNET_SUPPLY
    {
        return Err(ConfigGenesisTransitionCandidateError::ConservationSupplyMismatch);
    }
    require_vacuous_activation_input(&current, &input)?;

    let activation_readset_sha256 = hash_activation_readset(expected_config_key, &input)?;
    let result = Box::new(
        activate(law, *input).map_err(ConfigGenesisTransitionCandidateError::RetainedActivation)?,
    );
    let config = ConfigGenesisState {
        phase: GenesisPhase::Active,
        config: result.config,
    };
    let current_config_sha256 = hash_config(&current)?;
    let poststates_sha256 = hash_activation_poststates(
        &config,
        &result.treasury,
        &result.ecosystem,
        &result.liquidity,
        &result.core_reward,
    )?;
    Ok(Box::new(ConfigGenesisActivationPlan {
        config_key: expected_config_key,
        config,
        treasury: result.treasury,
        ecosystem: result.ecosystem,
        liquidity: result.liquidity,
        core_reward: result.core_reward,
        current_config_sha256,
        law_account_sha256: law.law_account_sha256(),
        conservation_manifest_sha256: conservation.manifest_sha256(),
        activation_readset_sha256,
        poststates_sha256,
    }))
}

/// Runtime composers may reuse the exact B3 preconditions without obtaining a
/// Config-only activation poststate. This returns data only and deliberately
/// exposes no transition candidate or write intent.
pub(crate) fn validate_activate_genesis_prerequisites(
    current: ConfigGenesisState,
    law: &ValidatedDailyLawWrite,
    conservation: &GenesisConservationReceipt,
    facts: GenesisPreactivationCandidateFacts,
) -> Result<([u8; 32], [u8; 32]), ConfigGenesisTransitionCandidateError> {
    if current.phase != GenesisPhase::GenesisStaging || current.config.active {
        return Err(ConfigGenesisTransitionCandidateError::NonCanonicalPhase);
    }
    require_production_config(&current)?;
    if law.mint() != current.config.mint {
        return Err(ConfigGenesisTransitionCandidateError::DailyLawMintMismatch);
    }
    if law.unix_timestamp() < current.config.genesis_timestamp {
        return Err(ConfigGenesisTransitionCandidateError::DailyLawBeforeGenesis);
    }
    if conservation.manifest_mint() != current.config.mint {
        return Err(ConfigGenesisTransitionCandidateError::ConservationMintMismatch);
    }
    if conservation.manifest_token_program() != current.config.token_program {
        return Err(ConfigGenesisTransitionCandidateError::ConservationTokenProgramMismatch);
    }
    if conservation.observed_supply() != MAINNET_SUPPLY
        || conservation.observed_allocation_total() != MAINNET_SUPPLY
    {
        return Err(ConfigGenesisTransitionCandidateError::ConservationSupplyMismatch);
    }
    require_vacuous_preactivation(facts)?;
    Ok((hash_config(&current)?, hash_facts(facts)))
}

fn require_production_config(
    current: &ConfigGenesisState,
) -> Result<(), ConfigGenesisTransitionCandidateError> {
    if current.config.rehearsal_mode || current.config.expected_supply != MAINNET_SUPPLY {
        return Err(ConfigGenesisTransitionCandidateError::NonProductionConfig);
    }
    let identities = [
        current.config.admin,
        current.config.mint,
        current.config.token_program,
        current.config.randomness_program,
    ];
    for (index, identity) in identities.iter().enumerate() {
        if *identity == [0; 32] || identities[..index].contains(identity) {
            return Err(ConfigGenesisTransitionCandidateError::InvalidConfigIdentity);
        }
    }
    Ok(())
}

fn require_vacuous_preactivation(
    facts: GenesisPreactivationCandidateFacts,
) -> Result<(), ConfigGenesisTransitionCandidateError> {
    if facts.config_staked_principal != 0
        || facts.config_agency_count != 0
        || facts.lane_reserved_total != 0
        || facts.lane_paid_total != 0
        || facts.lane_principal_claimed_total != 0
    {
        return Err(ConfigGenesisTransitionCandidateError::PreactivationEconomicStateNotVacuous);
    }
    Ok(())
}

fn require_vacuous_activation_input(
    current: &ConfigGenesisState,
    input: &ActivateInput,
) -> Result<(), ConfigGenesisTransitionCandidateError> {
    if current.config.staked_principal != 0 || current.config.agency_count != 0 {
        return Err(ConfigGenesisTransitionCandidateError::PreactivationEconomicStateNotVacuous);
    }
    for lane in [
        input.treasury,
        input.ecosystem,
        input.core_team,
        input.liquidity,
    ] {
        if lane.reserved != 0 || lane.paid != 0 || lane.principal_claimed != 0 {
            return Err(
                ConfigGenesisTransitionCandidateError::PreactivationEconomicStateNotVacuous,
            );
        }
    }
    Ok(())
}

fn require_activation_lane_bindings(
    expected_config_key: [u8; 32],
    input: &ActivateInput,
) -> Result<(), ConfigGenesisTransitionCandidateError> {
    for (lane, expected_lane) in [
        (input.treasury, TREASURY),
        (input.ecosystem, ECOSYSTEM),
        (input.core_team, CORE_TEAM),
        (input.liquidity, LIQUIDITY),
    ] {
        let policy = lane_policy(expected_lane, false)
            .ok_or(ConfigGenesisTransitionCandidateError::ActivateInputLaneBindingMismatch)?;
        if lane.config != expected_config_key
            || lane.lane != expected_lane
            || lane.beneficiary != beneficiary(expected_lane).unwrap_or([0; 32])
            || lane.total != policy.total
            || lane.genesis_unlocked != policy.genesis_unlocked
            || lane.cliff_week != policy.cliff_week
            || lane.linear_end_week != policy.linear_end_week
            || lane.reward_source != policy.reward_source
        {
            return Err(ConfigGenesisTransitionCandidateError::ActivateInputLaneBindingMismatch);
        }
    }
    Ok(())
}

fn candidate(
    edge: ConfigGenesisTransitionEdge,
    current: ConfigGenesisState,
    next_state: ConfigGenesisState,
    law_account_sha256: Option<[u8; 32]>,
    conservation_manifest_sha256: Option<[u8; 32]>,
    facts: GenesisPreactivationCandidateFacts,
) -> Result<ConfigGenesisTransitionCandidate, ConfigGenesisTransitionCandidateError> {
    Ok(ConfigGenesisTransitionCandidate {
        edge,
        next_state,
        current_config_sha256: hash_config(&current)?,
        law_account_sha256,
        conservation_manifest_sha256,
        candidate_facts_sha256: hash_facts(facts),
    })
}

fn hash_config(
    state: &ConfigGenesisState,
) -> Result<[u8; 32], ConfigGenesisTransitionCandidateError> {
    let mut encoded = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(state, &mut encoded)
        .map_err(|_| ConfigGenesisTransitionCandidateError::ConfigEncodingFailed)?;
    Ok(Sha256::digest(encoded).into())
}

fn hash_facts(facts: GenesisPreactivationCandidateFacts) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(CONFIG_GENESIS_TRANSITION_CANDIDATE_DOMAIN);
    hasher.update(facts.config_staked_principal.to_le_bytes());
    hasher.update(facts.config_agency_count.to_le_bytes());
    hasher.update(facts.lane_reserved_total.to_le_bytes());
    hasher.update(facts.lane_paid_total.to_le_bytes());
    hasher.update(facts.lane_principal_claimed_total.to_le_bytes());
    hasher.finalize().into()
}

fn hash_activation_poststates(
    config: &ConfigGenesisState,
    treasury: &LaneState,
    ecosystem: &LaneState,
    liquidity: &LaneState,
    core_reward: &CoreRewardState,
) -> Result<[u8; 32], ConfigGenesisTransitionCandidateError> {
    let mut config_bytes = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    let mut treasury_bytes = [0u8; LANE_ACCOUNT_LEN];
    let mut ecosystem_bytes = [0u8; LANE_ACCOUNT_LEN];
    let mut liquidity_bytes = [0u8; LANE_ACCOUNT_LEN];
    let mut core_reward_bytes = [0u8; CORE_REWARD_ACCOUNT_LEN];
    encode_config_genesis_state(config, &mut config_bytes)
        .map_err(|_| ConfigGenesisTransitionCandidateError::PostStateEncodingFailed)?;
    encode_lane_state(treasury, &mut treasury_bytes)
        .map_err(|_| ConfigGenesisTransitionCandidateError::PostStateEncodingFailed)?;
    encode_lane_state(ecosystem, &mut ecosystem_bytes)
        .map_err(|_| ConfigGenesisTransitionCandidateError::PostStateEncodingFailed)?;
    encode_lane_state(liquidity, &mut liquidity_bytes)
        .map_err(|_| ConfigGenesisTransitionCandidateError::PostStateEncodingFailed)?;
    encode_core_reward_state(core_reward, &mut core_reward_bytes)
        .map_err(|_| ConfigGenesisTransitionCandidateError::PostStateEncodingFailed)?;
    let mut hasher = Sha256::new();
    hasher.update(CONFIG_GENESIS_ACTIVATION_POSTSTATES_DOMAIN);
    hasher.update(config_bytes);
    hasher.update(treasury_bytes);
    hasher.update(ecosystem_bytes);
    hasher.update(liquidity_bytes);
    hasher.update(core_reward_bytes);
    Ok(hasher.finalize().into())
}

fn hash_activation_readset(
    expected_config_key: [u8; 32],
    input: &ActivateInput,
) -> Result<[u8; 32], ConfigGenesisTransitionCandidateError> {
    let mut hasher = Sha256::new();
    hasher.update(CONFIG_GENESIS_ACTIVATION_READSET_DOMAIN);
    hasher.update(expected_config_key);
    hash_mint(&mut hasher, input.mint);
    hasher.update(input.vault_authority);
    for token in [
        input.community_tokens,
        input.stake_tokens,
        input.treasury_tokens,
        input.ecosystem_tokens,
        input.core_team_tokens,
        input.liquidity_tokens,
    ] {
        hash_token(&mut hasher, token);
    }
    for lane in [
        input.treasury,
        input.ecosystem,
        input.core_team,
        input.liquidity,
    ] {
        let mut encoded = [0u8; LANE_ACCOUNT_LEN];
        encode_lane_state(&lane, &mut encoded)
            .map_err(|_| ConfigGenesisTransitionCandidateError::PostStateEncodingFailed)?;
        hasher.update(encoded);
    }
    hasher.update([input.core_reward_bump]);
    Ok(hasher.finalize().into())
}

fn hash_mint(hasher: &mut Sha256, mint: ReadonlyMintState) {
    hasher.update(mint.key);
    hasher.update(mint.supply.to_le_bytes());
    hash_optional_key(hasher, mint.mint_authority);
    hash_optional_key(hasher, mint.freeze_authority);
}

fn hash_token(hasher: &mut Sha256, token: ReadonlyTokenState) {
    hasher.update(token.key);
    hasher.update(token.mint);
    hasher.update(token.owner);
    hasher.update(token.amount.to_le_bytes());
}

fn hash_optional_key(hasher: &mut Sha256, value: Option<[u8; 32]>) {
    match value {
        Some(key) => {
            hasher.update([1]);
            hasher.update(key);
        }
        None => hasher.update([0]),
    }
}

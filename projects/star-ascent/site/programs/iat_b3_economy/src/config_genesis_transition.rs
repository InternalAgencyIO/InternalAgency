//! Non-executing candidate predicate for the two frozen Config/Genesis edges.
//!
//! This codifies one non-circular rule for owner and independent review. It is
//! not accepted policy and is not consumed by any writer, ABI, entrypoint, or
//! dispatcher. In particular, the returned candidate cannot authorize a phase
//! change: owner acceptance, authenticated preactivation facts, production
//! identities, final binaries, and execution evidence remain absent.

use sha2::{Digest, Sha256};

use crate::{
    encode_config_genesis_state, ConfigGenesisState, GenesisConservationReceipt, GenesisPhase,
    ValidatedDailyLawWrite, CONFIG_GENESIS_ACCOUNT_LEN, MAINNET_SUPPLY,
};

pub const CONFIG_GENESIS_TRANSITION_CANDIDATE_DOMAIN: &[u8] =
    b"IAT_B3_CONFIG_GENESIS_TRANSITION_CANDIDATE_V1";
pub const CONFIG_GENESIS_TRANSITION_CANDIDATE_STATUS: &str =
    "NONEXECUTING_NONCIRCULAR_CANDIDATE_OWNER_ACCEPTANCE_REQUIRED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisTransitionCandidateTruth {
    pub exact_two_edge_order_checked: bool,
    pub staging_requires_empty_economic_state: bool,
    pub staging_daily_law_not_required: bool,
    pub activation_requires_open_daily_law: bool,
    pub activation_requires_conservation_receipt: bool,
    pub activation_requires_zero_preactivation_core_facts: bool,
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
        activation_requires_zero_preactivation_core_facts: true,
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
    pub economic_write_count: u64,
    pub attributed_core_principal: u64,
    pub core_rewards_paid: u64,
    pub core_tokens_released: u64,
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
    PreactivationCoreNotVacuous,
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

/// Candidate for `GENESIS_STAGING -> ACTIVE`.
///
/// This requires opaque open-Daily-Law and conservation capabilities before it
/// computes the candidate state. It still accepts caller-shaped preactivation
/// facts and has no owner acceptance or write path, so it is not authorization.
pub fn prepare_activate_genesis_candidate(
    current: ConfigGenesisState,
    law: &ValidatedDailyLawWrite,
    conservation: &GenesisConservationReceipt,
    facts: GenesisPreactivationCandidateFacts,
) -> Result<ConfigGenesisTransitionCandidate, ConfigGenesisTransitionCandidateError> {
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
    if current.config.lane_mask != 0b1_1110
        || !current.config.stake_vault_initialized
        || current.config.stake_token_account == [0; 32]
        || current.config.staked_principal != 0
    {
        return Err(ConfigGenesisTransitionCandidateError::GenesisFundingIncomplete);
    }
    require_vacuous_preactivation(facts)?;

    let mut next_state = current;
    next_state.phase = GenesisPhase::Active;
    next_state.config.active = true;
    candidate(
        ConfigGenesisTransitionEdge::Activate,
        current,
        next_state,
        Some(law.law_account_sha256()),
        Some(conservation.manifest_sha256()),
        facts,
    )
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
    if facts.economic_write_count != 0
        || facts.attributed_core_principal != 0
        || facts.core_rewards_paid != 0
        || facts.core_tokens_released != 0
    {
        return Err(ConfigGenesisTransitionCandidateError::PreactivationCoreNotVacuous);
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
    let mut encoded = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&current, &mut encoded)
        .map_err(|_| ConfigGenesisTransitionCandidateError::ConfigEncodingFailed)?;
    let mut facts_hasher = Sha256::new();
    facts_hasher.update(CONFIG_GENESIS_TRANSITION_CANDIDATE_DOMAIN);
    facts_hasher.update(facts.economic_write_count.to_le_bytes());
    facts_hasher.update(facts.attributed_core_principal.to_le_bytes());
    facts_hasher.update(facts.core_rewards_paid.to_le_bytes());
    facts_hasher.update(facts.core_tokens_released.to_le_bytes());
    Ok(ConfigGenesisTransitionCandidate {
        edge,
        next_state,
        current_config_sha256: Sha256::digest(encoded).into(),
        law_account_sha256,
        conservation_manifest_sha256,
        candidate_facts_sha256: facts_hasher.finalize().into(),
    })
}

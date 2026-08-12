//! Runtime-authenticated prerequisites for a future Config/Genesis activation
//! executor.
//!
//! This feature-gated module accepts only an opaque runtime Daily-Law
//! capability, a real immutable Config PDA, and an opaque runtime Genesis
//! conservation receipt. It authenticates current observable preactivation
//! state, but cannot prove complete historical absence of prior writes and
//! cannot authorize or execute the transition.

use crate::config_genesis_transition::{
    prepare_config_genesis_activation_plan, validate_activate_genesis_prerequisites,
};
use crate::genesis_conservation_runtime::{
    AuthenticatedGenesisConservationReceipt, AuthenticatedGenesisLaneCapability,
    GenesisConservationRuntimeError, GENESIS_ACTIVATE_LANE_WRITABILITY,
};
use crate::native_adapter::{derive_pda, NativeEconomyBinding, PdaIdentity, StrictStateValue};
use crate::runtime_adapter::{
    parse_config_genesis_account_info_with_runtime_law, RuntimeAdapterError,
    RuntimeValidatedDailyLawWrite,
};
use crate::token_2022_runtime::{ReadonlyCanonicalEconomyMint, ReadonlyPublicTokenAccount};
use crate::{
    ActivateInput, ConfigGenesisActivationPlan, ConfigGenesisTransitionCandidateError,
    GenesisPreactivationCandidateFacts, ReadonlyMintState, ReadonlyTokenState, CORE_TEAM,
    ECOSYSTEM, GENESIS_ALLOCATION_COUNT, LIQUIDITY, TREASURY,
};
use sha2::{Digest, Sha256};
use solana_account_info::AccountInfo;
use solana_sdk_ids::system_program;

pub const CONFIG_GENESIS_RUNTIME_ACTIVATION_READSET_DOMAIN: &[u8] =
    b"IAT_B3_CONFIG_GENESIS_RUNTIME_ACTIVATION_READSET_V2";

pub const CONFIG_GENESIS_TRANSITION_RUNTIME_STATUS: &str =
    "RUNTIME_AUTHENTICATED_COMPLETE_ACTIVATION_READSET_CORE_CREATE_EXECUTION_UNPROVED_OWNER_ACCEPTANCE_REQUIRED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisTransitionRuntimeTruth {
    pub feature_gated: bool,
    pub runtime_daily_law_account_authenticated: bool,
    pub runtime_config_pda_authenticated: bool,
    pub runtime_genesis_balances_and_lanes_authenticated: bool,
    pub current_preactivation_economic_state_authenticated: bool,
    pub conservation_account_set_cross_bound_to_activation_readset: bool,
    pub complete_activation_readset_authenticated: bool,
    pub exact_retained_activate_lane_writability_authenticated: bool,
    pub stake_vault_observation_authenticated: bool,
    pub core_reward_vacant_or_prefunded_target_authenticated: bool,
    pub stake_vault_and_core_reward_lifecycle_authenticated: bool,
    pub complete_preactivation_write_history_authenticated: bool,
    pub owner_bootstrap_policy_accepted: bool,
    pub production_identity_binding_frozen: bool,
    pub transition_authorized: bool,
    pub account_writes_executed: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub mainnet_hold: bool,
}

pub const CONFIG_GENESIS_TRANSITION_RUNTIME_TRUTH: ConfigGenesisTransitionRuntimeTruth =
    ConfigGenesisTransitionRuntimeTruth {
        feature_gated: true,
        runtime_daily_law_account_authenticated: true,
        runtime_config_pda_authenticated: true,
        runtime_genesis_balances_and_lanes_authenticated: true,
        current_preactivation_economic_state_authenticated: true,
        conservation_account_set_cross_bound_to_activation_readset: true,
        complete_activation_readset_authenticated: true,
        exact_retained_activate_lane_writability_authenticated: true,
        stake_vault_observation_authenticated: true,
        core_reward_vacant_or_prefunded_target_authenticated: true,
        // Payer, Rent, System CPI, post-CPI assertions, atomic persistence,
        // and rollback are deliberately outside this held read-only composer.
        stake_vault_and_core_reward_lifecycle_authenticated: false,
        complete_preactivation_write_history_authenticated: false,
        owner_bootstrap_policy_accepted: false,
        production_identity_binding_frozen: false,
        transition_authorized: false,
        account_writes_executed: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        mainnet_hold: true,
    };

#[derive(Debug, Eq, PartialEq)]
pub enum ConfigGenesisTransitionRuntimeError {
    Runtime(RuntimeAdapterError),
    ConservationRuntime(GenesisConservationRuntimeError),
    Candidate(ConfigGenesisTransitionCandidateError),
    RuntimeLawBindingMismatch,
    ConservationConfigMismatch,
    ConservationMintMismatch,
    ConservationTokenProgramMismatch,
    ConservationAccountSetMismatch,
    LaneLawCapabilityMismatch,
    LaneAccountMetaMismatch,
    LaneCapabilityOrderMismatch,
    TokenObservationShapeMismatch,
    RuntimePdaBindingMismatch,
    CoreRewardTargetKeyMismatch,
    CoreRewardTargetShapeMismatch,
    CoreRewardTargetBorrowFailed,
}

impl From<RuntimeAdapterError> for ConfigGenesisTransitionRuntimeError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<ConfigGenesisTransitionCandidateError> for ConfigGenesisTransitionRuntimeError {
    fn from(value: ConfigGenesisTransitionCandidateError) -> Self {
        Self::Candidate(value)
    }
}

impl From<GenesisConservationRuntimeError> for ConfigGenesisTransitionRuntimeError {
    fn from(value: GenesisConservationRuntimeError) -> Self {
        Self::ConservationRuntime(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeCoreRewardTargetPath {
    Vacant,
    Prefunded,
}

/// Opaque, nonexecuting composition of the exact runtime activation read set
/// and the complete retained five-account poststate plan. Its private plan
/// cannot be split into independent writes, and this type carries no payer,
/// Rent value, System CPI, write intent, dispatcher, or authorization bit.
#[derive(Debug, Eq, PartialEq)]
pub struct RuntimeAuthenticatedConfigGenesisActivationPlan {
    plan: ConfigGenesisActivationPlan,
    conservation_account_set_sha256: [u8; 32],
    runtime_activation_readset_sha256: [u8; 32],
    core_reward_target_key: [u8; 32],
    core_reward_target_lamports: u64,
    core_reward_target_path: RuntimeCoreRewardTargetPath,
}

impl RuntimeAuthenticatedConfigGenesisActivationPlan {
    pub const fn current_config_sha256(&self) -> [u8; 32] {
        self.plan.current_config_sha256()
    }

    pub const fn law_account_sha256(&self) -> [u8; 32] {
        self.plan.law_account_sha256()
    }

    pub const fn conservation_manifest_sha256(&self) -> [u8; 32] {
        self.plan.conservation_manifest_sha256()
    }

    pub const fn activation_readset_sha256(&self) -> [u8; 32] {
        self.plan.activation_readset_sha256()
    }

    pub const fn poststates_sha256(&self) -> [u8; 32] {
        self.plan.poststates_sha256()
    }

    pub const fn conservation_account_set_sha256(&self) -> [u8; 32] {
        self.conservation_account_set_sha256
    }

    /// Commitment over Config/Law, conservation manifest/account set, the
    /// retained semantic activation read set, and CoreReward target prestate.
    pub const fn runtime_activation_readset_sha256(&self) -> [u8; 32] {
        self.runtime_activation_readset_sha256
    }

    pub const fn core_reward_target_key(&self) -> [u8; 32] {
        self.core_reward_target_key
    }

    pub const fn core_reward_target_lamports(&self) -> u64 {
        self.core_reward_target_lamports
    }

    pub const fn core_reward_target_path(&self) -> RuntimeCoreRewardTargetPath {
        self.core_reward_target_path
    }
}

/// Opaque composition result for runtime-authenticated current facts only.
/// It deliberately carries no Config-only activation poststate, instruction
/// data, write intent, or authorization bit.
#[derive(Debug, Eq, PartialEq)]
pub struct RuntimeAuthenticatedConfigGenesisPrerequisites {
    config_account_key: [u8; 32],
    config_account_sha256: [u8; 32],
    law_account_key: [u8; 32],
    conservation_manifest_sha256: [u8; 32],
    candidate_facts_sha256: [u8; 32],
}

impl RuntimeAuthenticatedConfigGenesisPrerequisites {
    pub const fn config_account_key(&self) -> [u8; 32] {
        self.config_account_key
    }

    pub const fn config_account_sha256(&self) -> [u8; 32] {
        self.config_account_sha256
    }

    pub const fn law_account_key(&self) -> [u8; 32] {
        self.law_account_key
    }

    pub const fn conservation_manifest_sha256(&self) -> [u8; 32] {
        self.conservation_manifest_sha256
    }

    pub const fn candidate_facts_sha256(&self) -> [u8; 32] {
        self.candidate_facts_sha256
    }
}

/// Compose the currently available runtime-authenticated inputs into held
/// prerequisites. This function reads the Config AccountInfo immutably and
/// returns data only. It deliberately does not produce activation poststates:
/// the stake-token read and CoreReward lifecycle target are not supplied here.
pub fn prepare_runtime_authenticated_activate_genesis_prerequisites(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    config_account: &AccountInfo<'_>,
    conservation: &AuthenticatedGenesisConservationReceipt,
) -> Result<RuntimeAuthenticatedConfigGenesisPrerequisites, ConfigGenesisTransitionRuntimeError> {
    if runtime_law.mint() != binding.mint()
        || runtime_law.law_program_owner() != runtime_law.gate().law_program_id()
    {
        return Err(ConfigGenesisTransitionRuntimeError::RuntimeLawBindingMismatch);
    }
    if conservation.config() != binding.config() {
        return Err(ConfigGenesisTransitionRuntimeError::ConservationConfigMismatch);
    }
    if conservation.mint() != binding.mint() {
        return Err(ConfigGenesisTransitionRuntimeError::ConservationMintMismatch);
    }

    let config =
        parse_config_genesis_account_info_with_runtime_law(runtime_law, binding, config_account)?;
    let state = config.state();
    if conservation.token_program() != state.config.token_program {
        return Err(ConfigGenesisTransitionRuntimeError::ConservationTokenProgramMismatch);
    }
    let facts = GenesisPreactivationCandidateFacts {
        config_staked_principal: state.config.staked_principal,
        config_agency_count: state.config.agency_count,
        lane_reserved_total: conservation.lane_reserved_total(),
        lane_paid_total: conservation.lane_paid_total(),
        lane_principal_claimed_total: conservation.lane_principal_claimed_total(),
    };
    let (current_config_sha256, candidate_facts_sha256) = validate_activate_genesis_prerequisites(
        state,
        runtime_law.gate(),
        conservation.receipt(),
        facts,
    )?;
    if state.config.lane_mask != 0b1_1110
        || !state.config.stake_vault_initialized
        || state.config.stake_token_account == [0; 32]
    {
        return Err(ConfigGenesisTransitionRuntimeError::Candidate(
            ConfigGenesisTransitionCandidateError::GenesisFundingIncomplete,
        ));
    }
    debug_assert_eq!(current_config_sha256, config.preimage_sha256());
    Ok(RuntimeAuthenticatedConfigGenesisPrerequisites {
        config_account_key: config.key(),
        config_account_sha256: current_config_sha256,
        law_account_key: runtime_law.law_account_key(),
        conservation_manifest_sha256: conservation.manifest_sha256(),
        candidate_facts_sha256,
    })
}

/// Cross-bind the exact runtime conservation account set to the complete
/// retained activation read set and build one held five-poststate plan.
///
/// The conservation subset is canonical mint + community/four Lane Token-2022
/// observations + four strict Lane capabilities with exact retained
/// `[Treasury W, Ecosystem W, CoreTeam R, Liquidity W]` metas. The additional
/// activation reads are the exact Config, canonical stake PDA observation,
/// derived vault authority, and exact system-owned empty CoreReward PDA target. The target's
/// zero/nonzero lamports select only its vacant/prefunded lifecycle shape; no
/// payer, Rent, System CPI, write, rollback claim, or authorization is created.
#[inline(never)]
#[allow(clippy::too_many_arguments)]
pub fn prepare_runtime_authenticated_config_genesis_activation_plan(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    config_account: &AccountInfo<'_>,
    conservation: &AuthenticatedGenesisConservationReceipt,
    canonical_mint: &ReadonlyCanonicalEconomyMint,
    community_tokens: &ReadonlyPublicTokenAccount,
    stake_tokens: &ReadonlyPublicTokenAccount,
    lane_tokens: &[ReadonlyPublicTokenAccount; GENESIS_ALLOCATION_COUNT - 1],
    lane_states: &[AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1],
    core_reward_target: &AccountInfo<'_>,
) -> Result<RuntimeAuthenticatedConfigGenesisActivationPlan, ConfigGenesisTransitionRuntimeError> {
    let law_program_id = runtime_law.gate().law_program_id();
    if runtime_law.mint() != binding.mint()
        || runtime_law.law_program_owner() != law_program_id
        || canonical_mint.transfer_hook_program() != law_program_id
    {
        return Err(ConfigGenesisTransitionRuntimeError::RuntimeLawBindingMismatch);
    }
    if conservation.config() != binding.config() {
        return Err(ConfigGenesisTransitionRuntimeError::ConservationConfigMismatch);
    }
    if conservation.mint() != binding.mint() {
        return Err(ConfigGenesisTransitionRuntimeError::ConservationMintMismatch);
    }

    let config =
        parse_config_genesis_account_info_with_runtime_law(runtime_law, binding, config_account)?;
    let current = config.state();
    if conservation.token_program() != current.config.token_program {
        return Err(ConfigGenesisTransitionRuntimeError::ConservationTokenProgramMismatch);
    }

    let conservation_tokens = [
        *community_tokens,
        lane_tokens[0],
        lane_tokens[1],
        lane_tokens[2],
        lane_tokens[3],
    ];
    for (index, lane) in lane_states.iter().enumerate() {
        if lane.observed_writable() != GENESIS_ACTIVATE_LANE_WRITABILITY[index] {
            return Err(ConfigGenesisTransitionRuntimeError::LaneAccountMetaMismatch);
        }
        if !lane.is_bound_to_gate(runtime_law.gate()) {
            return Err(ConfigGenesisTransitionRuntimeError::LaneLawCapabilityMismatch);
        }
    }
    if !conservation.matches_exact_account_set(
        binding,
        canonical_mint,
        &conservation_tokens,
        lane_states,
    )? {
        return Err(ConfigGenesisTransitionRuntimeError::ConservationAccountSetMismatch);
    }
    let lanes = [TREASURY, ECOSYSTEM, CORE_TEAM, LIQUIDITY];
    let lane_values = core::array::from_fn(|index| match lane_states[index].state() {
        StrictStateValue::Lane(lane) if lane.lane == lanes[index] => Some(lane),
        _ => None,
    });
    let [Some(treasury), Some(ecosystem), Some(core_team), Some(liquidity)] = lane_values else {
        return Err(ConfigGenesisTransitionRuntimeError::LaneCapabilityOrderMismatch);
    };

    let vault = derive_pda(
        binding,
        PdaIdentity::VaultAuthority {
            config: binding.config(),
        },
    )
    .map_err(RuntimeAdapterError::Native)?;
    let stake = derive_pda(
        binding,
        PdaIdentity::StakeToken {
            config: binding.config(),
        },
    )
    .map_err(RuntimeAdapterError::Native)?;
    let core_reward = derive_pda(
        binding,
        PdaIdentity::CoreReward {
            config: binding.config(),
        },
    )
    .map_err(RuntimeAdapterError::Native)?;
    if current.config.vault_authority_bump != vault.bump
        || current.config.stake_token_account != stake.key
    {
        return Err(ConfigGenesisTransitionRuntimeError::RuntimePdaBindingMismatch);
    }

    for token in conservation_tokens
        .iter()
        .chain(core::iter::once(stake_tokens))
    {
        if !token.immutable_owner() || token.observed_writable() {
            return Err(ConfigGenesisTransitionRuntimeError::TokenObservationShapeMismatch);
        }
    }
    if stake_tokens.token_account() != stake.key
        || stake_tokens.mint() != binding.mint()
        || stake_tokens.wallet_owner() != vault.key
        || stake_tokens.public_amount() != 0
    {
        return Err(ConfigGenesisTransitionRuntimeError::RuntimePdaBindingMismatch);
    }

    let (core_reward_target_lamports, core_reward_target_path) =
        authenticate_core_reward_target(core_reward_target, core_reward.key)?;
    let input = ActivateInput {
        config_key: binding.config(),
        config: current.config,
        mint: ReadonlyMintState {
            key: canonical_mint.canonical_mint(),
            supply: canonical_mint.supply(),
            mint_authority: None,
            freeze_authority: None,
        },
        vault_authority: vault.key,
        community_tokens: semantic_token(*community_tokens),
        stake_tokens: semantic_token(*stake_tokens),
        treasury,
        treasury_tokens: semantic_token(lane_tokens[0]),
        ecosystem,
        ecosystem_tokens: semantic_token(lane_tokens[1]),
        core_team,
        core_team_tokens: semantic_token(lane_tokens[2]),
        liquidity,
        liquidity_tokens: semantic_token(lane_tokens[3]),
        core_reward_bump: core_reward.bump,
    };
    let plan = prepare_config_genesis_activation_plan(
        binding.config(),
        current,
        runtime_law.gate(),
        conservation.receipt(),
        input,
    )?;
    let runtime_activation_readset_sha256 = hash_runtime_activation_readset(
        &plan,
        conservation.account_set_sha256(),
        core_reward.key,
        core_reward_target_lamports,
        core_reward_target_path,
    );
    Ok(RuntimeAuthenticatedConfigGenesisActivationPlan {
        plan,
        conservation_account_set_sha256: conservation.account_set_sha256(),
        runtime_activation_readset_sha256,
        core_reward_target_key: core_reward.key,
        core_reward_target_lamports,
        core_reward_target_path,
    })
}

fn hash_runtime_activation_readset(
    plan: &ConfigGenesisActivationPlan,
    conservation_account_set_sha256: [u8; 32],
    core_reward_target_key: [u8; 32],
    core_reward_target_lamports: u64,
    core_reward_target_path: RuntimeCoreRewardTargetPath,
) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(CONFIG_GENESIS_RUNTIME_ACTIVATION_READSET_DOMAIN);
    hasher.update(plan.current_config_sha256());
    hasher.update(plan.law_account_sha256());
    hasher.update(plan.conservation_manifest_sha256());
    hasher.update(conservation_account_set_sha256);
    hasher.update(plan.activation_readset_sha256());
    hasher.update(core_reward_target_key);
    hasher.update(system_program::ID.to_bytes());
    hasher.update(core_reward_target_lamports.to_le_bytes());
    hasher.update([match core_reward_target_path {
        RuntimeCoreRewardTargetPath::Vacant => 0,
        RuntimeCoreRewardTargetPath::Prefunded => 1,
    }]);
    hasher.finalize().into()
}

fn semantic_token(token: ReadonlyPublicTokenAccount) -> ReadonlyTokenState {
    ReadonlyTokenState {
        key: token.token_account(),
        mint: token.mint(),
        owner: token.wallet_owner(),
        amount: token.public_amount(),
    }
}

fn authenticate_core_reward_target(
    target: &AccountInfo<'_>,
    expected_key: [u8; 32],
) -> Result<(u64, RuntimeCoreRewardTargetPath), ConfigGenesisTransitionRuntimeError> {
    if target.key.to_bytes() != expected_key {
        return Err(ConfigGenesisTransitionRuntimeError::CoreRewardTargetKeyMismatch);
    }
    if target.owner.to_bytes() != system_program::ID.to_bytes()
        || !target.is_writable
        || target.is_signer
        || target.executable
    {
        return Err(ConfigGenesisTransitionRuntimeError::CoreRewardTargetShapeMismatch);
    }
    let lamports = target
        .try_borrow_lamports()
        .map_err(|_| ConfigGenesisTransitionRuntimeError::CoreRewardTargetBorrowFailed)?;
    let data = target
        .try_borrow_data()
        .map_err(|_| ConfigGenesisTransitionRuntimeError::CoreRewardTargetBorrowFailed)?;
    if !data.is_empty() {
        return Err(ConfigGenesisTransitionRuntimeError::CoreRewardTargetShapeMismatch);
    }
    let lamports = **lamports;
    let path = if lamports == 0 {
        RuntimeCoreRewardTargetPath::Vacant
    } else {
        RuntimeCoreRewardTargetPath::Prefunded
    };
    Ok((lamports, path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::genesis_conservation_runtime::{
        verify_authenticated_genesis_conservation, AuthenticatedGenesisConservationReceipt,
        AuthenticatedGenesisLaneCapability,
    };
    use crate::native_adapter::{
        authenticate_readonly_state_account, authenticate_state_account, derive_pda,
        NativeAccountObservation, NativeEconomyBinding, PdaIdentity,
    };
    use crate::runtime_adapter::RuntimeValidatedDailyLawWrite;
    use crate::token_2022_runtime::{
        authenticate_canonical_economy_mint_account_info, authenticate_public_token_account_info,
        CanonicalEconomyMintBinding, PublicTokenAccountBinding, PublicTokenAccountForm,
        ReadonlyCanonicalEconomyMint, ReadonlyPublicTokenAccount,
    };
    use crate::{
        beneficiary, encode_config_genesis_state, encode_lane_state, lane_policy,
        verify_daily_law_open, verify_genesis_allocation_conservation, CanonicalDailyLawBinding,
        ConfigGenesisState, ConfigState, GenesisAllocationEntry, GenesisAllocationManifest,
        GenesisConservationInput, GenesisPhase, LaneState, ObservedGenesisAllocation,
        ObservedGenesisMint, ReadonlyDailyLawAccount, COMMUNITY, COMMUNITY_CUSTODY,
        CONFIG_GENESIS_ACCOUNT_LEN, GENESIS_ALLOCATION_AMOUNTS, GENESIS_ALLOCATION_ROLES,
        LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, MAINNET_SUPPLY,
        TOKEN_DECIMALS,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};
    use solana_pubkey::Pubkey;
    use solana_sdk_ids::zk_elgamal_proof_program;
    use spl_token_2022_interface::{
        extension::{
            confidential_transfer::ConfidentialTransferMint,
            immutable_owner::ImmutableOwner,
            transfer_hook::{TransferHook, TransferHookAccount},
            AccountType, BaseStateWithExtensionsMut, ExtensionType, StateWithExtensionsMut,
        },
        state::{Account as TokenAccount, AccountState, Mint},
        ID as TOKEN_2022_PROGRAM_ID,
    };

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const OTHER_LAW_PROGRAM: [u8; 32] = [0xB4; 32];
    const OTHER_LAW_STATE: [u8; 32] = [0x52; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const TOKEN_PROGRAM: [u8; 32] = TOKEN_2022_PROGRAM_ID.to_bytes();
    const NETWORK: [u8; 32] = [0x11; 32];
    const GENESIS_TIMESTAMP: i64 = 1_786_000_000;
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    struct TestAccount {
        key: Pubkey,
        owner: Pubkey,
        lamports: u64,
        data: Vec<u8>,
        is_writable: bool,
        executable: bool,
    }

    impl TestAccount {
        fn data(key: [u8; 32], owner: [u8; 32], data: Vec<u8>) -> Self {
            Self {
                key: key.into(),
                owner: owner.into(),
                lamports: 1,
                data,
                is_writable: false,
                executable: false,
            }
        }

        fn program(key: [u8; 32]) -> Self {
            Self {
                key: key.into(),
                owner: [0x99; 32].into(),
                lamports: 1,
                data: Vec::new(),
                is_writable: false,
                executable: true,
            }
        }

        fn info(&mut self) -> AccountInfo<'_> {
            AccountInfo::new(
                &self.key,
                false,
                self.is_writable,
                &mut self.lamports,
                &mut self.data,
                &self.owner,
                self.executable,
            )
        }
    }

    #[derive(Clone, Copy)]
    struct RuntimeReadSet {
        conservation: AuthenticatedGenesisConservationReceipt,
        mint: ReadonlyCanonicalEconomyMint,
        community: ReadonlyPublicTokenAccount,
        stake: ReadonlyPublicTokenAccount,
        lane_tokens: [ReadonlyPublicTokenAccount; GENESIS_ALLOCATION_COUNT - 1],
        lanes: [AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1],
    }

    fn runtime_law() -> RuntimeValidatedDailyLawWrite {
        runtime_law_at(CLOCK_TIMESTAMP)
    }

    fn runtime_law_at(clock_timestamp: i64) -> RuntimeValidatedDailyLawWrite {
        runtime_law_for(clock_timestamp, LAW_PROGRAM, LAW_STATE, LAW_PROGRAM)
    }

    fn runtime_law_for(
        clock_timestamp: i64,
        law_program_id: [u8; 32],
        law_state: [u8; 32],
        observed_program_owner: [u8; 32],
    ) -> RuntimeValidatedDailyLawWrite {
        let local_day = protocol_local_day(clock_timestamp);
        let decision = (0u16..=u8::MAX.into())
            .find_map(|candidate| {
                let mut hash = [0u8; 32];
                hash[31] = candidate as u8;
                let value =
                    create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT)
                        .unwrap();
                (!value.locked).then_some(value)
            })
            .unwrap();
        let mut data = [0u8; LAW_STATE_LEN];
        data[0..8].copy_from_slice(LAW_STATE_MAGIC);
        data[8] = LAW_STATE_VERSION;
        data[9] = LAW_BUMP;
        data[10] = 1;
        data[11] = u8::from(decision.locked);
        data[16..48].copy_from_slice(&MINT);
        data[48..80].copy_from_slice(&NETWORK);
        data[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
        data[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
        data[96..128].copy_from_slice(&decision.ancestor_slot_hash);
        data[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
        data[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
        data[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
        data[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
        let gate = verify_daily_law_open(
            &CanonicalDailyLawBinding::new(law_program_id, law_state, LAW_BUMP, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(law_state, law_program_id, false, &data),
            clock_timestamp,
        )
        .unwrap();
        RuntimeValidatedDailyLawWrite::from_test_gate(gate, law_state, observed_program_owner)
    }

    fn conservation(binding: &NativeEconomyBinding) -> AuthenticatedGenesisConservationReceipt {
        let entries = core::array::from_fn(|index| GenesisAllocationEntry {
            role: GENESIS_ALLOCATION_ROLES[index],
            token_account: [0x60 + index as u8; 32],
            token_authority: [0x70 + index as u8; 32],
            beneficiary: [0x80 + index as u8; 32],
            amount: GENESIS_ALLOCATION_AMOUNTS[index],
        });
        let allocations = core::array::from_fn(|index| ObservedGenesisAllocation {
            role: entries[index].role,
            token_account: entries[index].token_account,
            token_program: TOKEN_PROGRAM,
            mint: MINT,
            token_authority: entries[index].token_authority,
            beneficiary_binding: entries[index].beneficiary,
            amount: entries[index].amount,
            delegate: None,
            close_authority: None,
            delegated_amount: 0,
            frozen: false,
            native: false,
        });
        let receipt = verify_genesis_allocation_conservation(&GenesisConservationInput {
            manifest: GenesisAllocationManifest {
                mint: MINT,
                token_program: TOKEN_PROGRAM,
                entries,
            },
            mint: ObservedGenesisMint {
                key: MINT,
                token_program: TOKEN_PROGRAM,
                decimals: TOKEN_DECIMALS,
                supply: MAINNET_SUPPLY,
                mint_authority: None,
                freeze_authority: None,
            },
            allocations,
        })
        .unwrap();
        AuthenticatedGenesisConservationReceipt::from_test_receipt(
            receipt,
            binding.config(),
            MINT,
            TOKEN_PROGRAM,
        )
    }

    fn state(binding: &NativeEconomyBinding) -> ConfigGenesisState {
        let stake = derive_pda(
            binding,
            PdaIdentity::StakeToken {
                config: binding.config(),
            },
        )
        .unwrap();
        let vault = derive_pda(
            binding,
            PdaIdentity::VaultAuthority {
                config: binding.config(),
            },
        )
        .unwrap();
        ConfigGenesisState {
            phase: GenesisPhase::GenesisStaging,
            config: ConfigState {
                admin: [0x21; 32],
                mint: MINT,
                token_program: TOKEN_PROGRAM,
                randomness_program: [0x44; 32],
                stake_token_account: stake.key,
                agency_registry_hash: [0; 32],
                genesis_timestamp: GENESIS_TIMESTAMP,
                expected_supply: MAINNET_SUPPLY,
                staked_principal: 0,
                agency_count: 0,
                rehearsal_mode: false,
                active: false,
                lane_mask: 0b1_1110,
                stake_vault_initialized: true,
                bump: binding.config_bump(),
                vault_authority_bump: vault.bump,
            },
        }
    }

    fn config_data(binding: &NativeEconomyBinding) -> [u8; CONFIG_GENESIS_ACCOUNT_LEN] {
        let mut data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
        encode_config_genesis_state(&state(binding), &mut data).unwrap();
        data
    }

    fn mint_data() -> Vec<u8> {
        let extensions = [
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
        ];
        let len = ExtensionType::try_calculate_account_len::<Mint>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state = StateWithExtensionsMut::<Mint>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Mint);
        state.base = Mint {
            supply: MAINNET_SUPPLY,
            decimals: TOKEN_DECIMALS,
            is_initialized: true,
            ..Mint::default()
        };
        state
            .init_extension::<ConfidentialTransferMint>(false)
            .unwrap()
            .auto_approve_new_accounts = true.into();
        state
            .init_extension::<TransferHook>(false)
            .unwrap()
            .program_id = Some(Pubkey::new_from_array(LAW_PROGRAM))
            .try_into()
            .unwrap();
        state.pack_base();
        data
    }

    fn token_data(owner: [u8; 32], amount: u64) -> Vec<u8> {
        let extensions = [
            ExtensionType::TransferHookAccount,
            ExtensionType::ImmutableOwner,
        ];
        let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state =
            StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Account);
        state.base = TokenAccount {
            mint: MINT.into(),
            owner: owner.into(),
            amount,
            state: AccountState::Initialized,
            ..TokenAccount::default()
        };
        state.init_extension::<TransferHookAccount>(false).unwrap();
        state.init_extension::<ImmutableOwner>(false).unwrap();
        state.pack_base();
        data
    }

    fn canonical_mint() -> ReadonlyCanonicalEconomyMint {
        let mut token_program = TestAccount::program(TOKEN_PROGRAM);
        let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
        let mut mint = TestAccount::data(MINT, TOKEN_PROGRAM, mint_data());
        authenticate_canonical_economy_mint_account_info(
            &CanonicalEconomyMintBinding::new(MINT, LAW_PROGRAM, MAINNET_SUPPLY, TOKEN_DECIMALS)
                .unwrap(),
            &token_program.info(),
            &zk_program.info(),
            &mint.info(),
        )
        .unwrap()
    }

    fn token_capability(
        mint: &ReadonlyCanonicalEconomyMint,
        key: [u8; 32],
        owner: [u8; 32],
        amount: u64,
    ) -> ReadonlyPublicTokenAccount {
        let mut account = TestAccount::data(key, TOKEN_PROGRAM, token_data(owner, amount));
        authenticate_public_token_account_info(
            mint,
            &PublicTokenAccountBinding::new(
                key,
                owner,
                PublicTokenAccountForm::ImmutableOwner,
                false,
            )
            .unwrap(),
            &account.info(),
        )
        .unwrap()
    }

    fn runtime_manifest(
        binding: &NativeEconomyBinding,
        community_token: [u8; 32],
    ) -> GenesisAllocationManifest {
        let vault = derive_pda(
            binding,
            PdaIdentity::VaultAuthority {
                config: binding.config(),
            },
        )
        .unwrap()
        .key;
        let entries = core::array::from_fn(|index| {
            let role = GENESIS_ALLOCATION_ROLES[index];
            if role as u8 == COMMUNITY {
                GenesisAllocationEntry {
                    role,
                    token_account: community_token,
                    token_authority: COMMUNITY_CUSTODY,
                    beneficiary: COMMUNITY_CUSTODY,
                    amount: GENESIS_ALLOCATION_AMOUNTS[index],
                }
            } else {
                GenesisAllocationEntry {
                    role,
                    token_account: derive_pda(
                        binding,
                        PdaIdentity::LaneToken {
                            config: binding.config(),
                            lane: role as u8,
                        },
                    )
                    .unwrap()
                    .key,
                    token_authority: vault,
                    beneficiary: beneficiary(role as u8).unwrap(),
                    amount: GENESIS_ALLOCATION_AMOUNTS[index],
                }
            }
        });
        GenesisAllocationManifest {
            mint: MINT,
            token_program: TOKEN_PROGRAM,
            entries,
        }
    }

    fn runtime_lanes(
        binding: &NativeEconomyBinding,
        law: &RuntimeValidatedDailyLawWrite,
        manifest: &GenesisAllocationManifest,
    ) -> [AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1] {
        runtime_lanes_with_writability(binding, law, manifest, GENESIS_ACTIVATE_LANE_WRITABILITY)
    }

    fn runtime_lanes_with_writability(
        binding: &NativeEconomyBinding,
        law: &RuntimeValidatedDailyLawWrite,
        manifest: &GenesisAllocationManifest,
        writability: [bool; GENESIS_ALLOCATION_COUNT - 1],
    ) -> [AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1] {
        core::array::from_fn(|index| {
            let entry = manifest.entries[index + 1];
            let lane = entry.role as u8;
            let identity = PdaIdentity::LaneState {
                config: binding.config(),
                lane,
            };
            let state_pda = derive_pda(binding, identity).unwrap();
            let token_pda = derive_pda(
                binding,
                PdaIdentity::LaneToken {
                    config: binding.config(),
                    lane,
                },
            )
            .unwrap();
            let policy = lane_policy(lane, false).unwrap();
            let state = LaneState {
                config: binding.config(),
                token_account: token_pda.key,
                beneficiary: entry.beneficiary,
                total: policy.total,
                genesis_unlocked: policy.genesis_unlocked,
                cliff_week: policy.cliff_week,
                linear_end_week: policy.linear_end_week,
                reserved: 0,
                paid: 0,
                principal_claimed: 0,
                lane,
                reward_source: policy.reward_source,
                bump: state_pda.bump,
                token_bump: token_pda.bump,
            };
            let mut data = [0u8; LANE_ACCOUNT_LEN];
            encode_lane_state(&state, &mut data).unwrap();
            let observation = NativeAccountObservation {
                key: state_pda.key,
                owner: binding.program_id(),
                lamports: 1,
                data: &data,
                is_signer: false,
                is_writable: writability[index],
                executable: false,
            };
            if writability[index] {
                AuthenticatedGenesisLaneCapability::Writable(
                    authenticate_state_account(law.gate(), binding, observation, identity).unwrap(),
                )
            } else {
                AuthenticatedGenesisLaneCapability::Readonly(
                    authenticate_readonly_state_account(law.gate(), binding, observation, identity)
                        .unwrap(),
                )
            }
        })
    }

    fn runtime_readset(
        binding: &NativeEconomyBinding,
        law: &RuntimeValidatedDailyLawWrite,
        community_key: [u8; 32],
    ) -> RuntimeReadSet {
        let manifest = runtime_manifest(binding, community_key);
        let mint = canonical_mint();
        let vault = derive_pda(
            binding,
            PdaIdentity::VaultAuthority {
                config: binding.config(),
            },
        )
        .unwrap()
        .key;
        let tokens = core::array::from_fn(|index| {
            let entry = manifest.entries[index];
            token_capability(
                &mint,
                entry.token_account,
                entry.token_authority,
                entry.amount,
            )
        });
        let lanes = runtime_lanes(binding, law, &manifest);
        let conservation =
            verify_authenticated_genesis_conservation(binding, manifest, &mint, &tokens, &lanes)
                .unwrap();
        let stake_key = derive_pda(
            binding,
            PdaIdentity::StakeToken {
                config: binding.config(),
            },
        )
        .unwrap()
        .key;
        RuntimeReadSet {
            conservation,
            mint,
            community: tokens[0],
            stake: token_capability(&mint, stake_key, vault, 0),
            lane_tokens: [tokens[1], tokens[2], tokens[3], tokens[4]],
            lanes,
        }
    }

    #[test]
    fn runtime_truth_authenticates_current_state_without_claiming_history_or_authority() {
        assert_eq!(
            CONFIG_GENESIS_RUNTIME_ACTIVATION_READSET_DOMAIN,
            b"IAT_B3_CONFIG_GENESIS_RUNTIME_ACTIVATION_READSET_V2"
        );
        assert_eq!(
            CONFIG_GENESIS_TRANSITION_RUNTIME_TRUTH,
            ConfigGenesisTransitionRuntimeTruth {
                feature_gated: true,
                runtime_daily_law_account_authenticated: true,
                runtime_config_pda_authenticated: true,
                runtime_genesis_balances_and_lanes_authenticated: true,
                current_preactivation_economic_state_authenticated: true,
                conservation_account_set_cross_bound_to_activation_readset: true,
                complete_activation_readset_authenticated: true,
                exact_retained_activate_lane_writability_authenticated: true,
                stake_vault_observation_authenticated: true,
                core_reward_vacant_or_prefunded_target_authenticated: true,
                stake_vault_and_core_reward_lifecycle_authenticated: false,
                complete_preactivation_write_history_authenticated: false,
                owner_bootstrap_policy_accepted: false,
                production_identity_binding_frozen: false,
                transition_authorized: false,
                account_writes_executed: false,
                entrypoint_exposed: false,
                dispatcher_exposed: false,
                mainnet_hold: true,
            }
        );
    }

    #[test]
    fn runtime_law_config_and_conservation_compose_held_prerequisites_only() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let law = runtime_law();
        let conservation = conservation(&binding);
        let key = Pubkey::new_from_array(binding.config());
        let owner = Pubkey::new_from_array(binding.program_id());
        let mut lamports = 1;
        let mut data = config_data(&binding);
        let account = AccountInfo::new(&key, false, false, &mut lamports, &mut data, &owner, false);
        let result = prepare_runtime_authenticated_activate_genesis_prerequisites(
            &law,
            &binding,
            &account,
            &conservation,
        )
        .unwrap();
        assert_eq!(result.config_account_key(), binding.config());
        assert_eq!(result.law_account_key(), LAW_STATE);
        assert_eq!(
            result.conservation_manifest_sha256(),
            conservation.manifest_sha256()
        );
        assert_ne!(result.config_account_sha256(), [0; 32]);
        assert_ne!(result.candidate_facts_sha256(), [0; 32]);
    }

    #[test]
    fn exact_runtime_readset_cross_binds_and_accepts_vacant_or_prefunded_core_target() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let law = runtime_law();
        let readset = runtime_readset(&binding, &law, [0x90; 32]);
        assert_eq!(
            readset.lanes.map(|lane| lane.observed_writable()),
            GENESIS_ACTIVATE_LANE_WRITABILITY
        );
        let core_reward = derive_pda(
            &binding,
            PdaIdentity::CoreReward {
                config: binding.config(),
            },
        )
        .unwrap();

        let mut runtime_readset_hashes = [[0; 32]; 2];
        for (index, (lamports, expected_path)) in [
            (0, RuntimeCoreRewardTargetPath::Vacant),
            (17, RuntimeCoreRewardTargetPath::Prefunded),
        ]
        .into_iter()
        .enumerate()
        {
            let mut config = TestAccount::data(
                binding.config(),
                binding.program_id(),
                config_data(&binding).to_vec(),
            );
            let mut core =
                TestAccount::data(core_reward.key, system_program::ID.to_bytes(), Vec::new());
            core.lamports = lamports;
            core.is_writable = true;
            let plan = prepare_runtime_authenticated_config_genesis_activation_plan(
                &law,
                &binding,
                &config.info(),
                &readset.conservation,
                &readset.mint,
                &readset.community,
                &readset.stake,
                &readset.lane_tokens,
                &readset.lanes,
                &core.info(),
            )
            .unwrap();
            assert_ne!(plan.current_config_sha256(), [0; 32]);
            assert_eq!(plan.law_account_sha256(), law.gate().law_account_sha256());
            assert_eq!(
                plan.conservation_manifest_sha256(),
                readset.conservation.manifest_sha256()
            );
            assert_ne!(plan.activation_readset_sha256(), [0; 32]);
            assert_ne!(plan.poststates_sha256(), [0; 32]);
            assert_eq!(
                plan.conservation_account_set_sha256(),
                readset.conservation.account_set_sha256()
            );
            assert_eq!(plan.core_reward_target_key(), core_reward.key);
            assert_eq!(plan.core_reward_target_lamports(), lamports);
            assert_eq!(plan.core_reward_target_path(), expected_path);
            runtime_readset_hashes[index] = plan.runtime_activation_readset_sha256();
            assert_ne!(runtime_readset_hashes[index], [0; 32]);
        }
        assert_ne!(runtime_readset_hashes[0], runtime_readset_hashes[1]);
    }

    #[test]
    fn retained_activate_lane_meta_escalation_and_downgrade_fail_closed() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let law = runtime_law();
        let community_key = [0x90; 32];
        let manifest = runtime_manifest(&binding, community_key);
        let readset = runtime_readset(&binding, &law, community_key);
        let core_reward = derive_pda(
            &binding,
            PdaIdentity::CoreReward {
                config: binding.config(),
            },
        )
        .unwrap();
        let mut config = TestAccount::data(
            binding.config(),
            binding.program_id(),
            config_data(&binding).to_vec(),
        );
        let mut core =
            TestAccount::data(core_reward.key, system_program::ID.to_bytes(), Vec::new());
        core.is_writable = true;

        for hostile_shape in [
            [true, true, true, true],
            [false, true, false, true],
            [true, false, false, true],
            [true, true, false, false],
        ] {
            let hostile_lanes =
                runtime_lanes_with_writability(&binding, &law, &manifest, hostile_shape);
            assert_eq!(
                prepare_runtime_authenticated_config_genesis_activation_plan(
                    &law,
                    &binding,
                    &config.info(),
                    &readset.conservation,
                    &readset.mint,
                    &readset.community,
                    &readset.stake,
                    &readset.lane_tokens,
                    &hostile_lanes,
                    &core.info(),
                ),
                Err(ConfigGenesisTransitionRuntimeError::LaneAccountMetaMismatch)
            );
        }
    }

    #[test]
    fn conservation_subset_stake_law_and_core_target_drift_fail_closed() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let law = runtime_law();
        let readset = runtime_readset(&binding, &law, [0x90; 32]);
        let alternate = runtime_readset(&binding, &law, [0x91; 32]);
        let core_reward = derive_pda(
            &binding,
            PdaIdentity::CoreReward {
                config: binding.config(),
            },
        )
        .unwrap();
        let mut config = TestAccount::data(
            binding.config(),
            binding.program_id(),
            config_data(&binding).to_vec(),
        );
        let mut core =
            TestAccount::data(core_reward.key, system_program::ID.to_bytes(), Vec::new());
        core.lamports = 1;
        core.is_writable = true;
        assert_eq!(
            prepare_runtime_authenticated_config_genesis_activation_plan(
                &law,
                &binding,
                &config.info(),
                &alternate.conservation,
                &readset.mint,
                &readset.community,
                &readset.stake,
                &readset.lane_tokens,
                &readset.lanes,
                &core.info(),
            ),
            Err(ConfigGenesisTransitionRuntimeError::ConservationAccountSetMismatch)
        );

        let vault = derive_pda(
            &binding,
            PdaIdentity::VaultAuthority {
                config: binding.config(),
            },
        )
        .unwrap();
        let stake = derive_pda(
            &binding,
            PdaIdentity::StakeToken {
                config: binding.config(),
            },
        )
        .unwrap();
        let funded_stake = token_capability(&readset.mint, stake.key, vault.key, 1);
        assert_eq!(
            prepare_runtime_authenticated_config_genesis_activation_plan(
                &law,
                &binding,
                &config.info(),
                &readset.conservation,
                &readset.mint,
                &readset.community,
                &funded_stake,
                &readset.lane_tokens,
                &readset.lanes,
                &core.info(),
            ),
            Err(ConfigGenesisTransitionRuntimeError::RuntimePdaBindingMismatch)
        );

        let stale_law = runtime_law_at(CLOCK_TIMESTAMP + 86_400);
        let stale = runtime_readset(&binding, &stale_law, [0x90; 32]);
        assert_eq!(
            prepare_runtime_authenticated_config_genesis_activation_plan(
                &law,
                &binding,
                &config.info(),
                &stale.conservation,
                &stale.mint,
                &stale.community,
                &stale.stake,
                &stale.lane_tokens,
                &stale.lanes,
                &core.info(),
            ),
            Err(ConfigGenesisTransitionRuntimeError::LaneLawCapabilityMismatch)
        );

        let mut wrong_core =
            TestAccount::data(core_reward.key, system_program::ID.to_bytes(), vec![0xA5]);
        wrong_core.is_writable = true;
        assert_eq!(
            prepare_runtime_authenticated_config_genesis_activation_plan(
                &law,
                &binding,
                &config.info(),
                &readset.conservation,
                &readset.mint,
                &readset.community,
                &readset.stake,
                &readset.lane_tokens,
                &readset.lanes,
                &wrong_core.info(),
            ),
            Err(ConfigGenesisTransitionRuntimeError::CoreRewardTargetShapeMismatch)
        );
    }

    #[test]
    fn authenticated_mint_hook_and_law_program_splice_fails_closed() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let other_law = runtime_law_for(
            CLOCK_TIMESTAMP,
            OTHER_LAW_PROGRAM,
            OTHER_LAW_STATE,
            OTHER_LAW_PROGRAM,
        );
        let readset = runtime_readset(&binding, &other_law, [0x90; 32]);
        assert_eq!(readset.mint.transfer_hook_program(), LAW_PROGRAM);
        assert_eq!(other_law.gate().law_program_id(), OTHER_LAW_PROGRAM);
        assert_eq!(other_law.law_program_owner(), OTHER_LAW_PROGRAM);

        let core_reward = derive_pda(
            &binding,
            PdaIdentity::CoreReward {
                config: binding.config(),
            },
        )
        .unwrap();
        let mut config = TestAccount::data(
            binding.config(),
            binding.program_id(),
            config_data(&binding).to_vec(),
        );
        let mut core =
            TestAccount::data(core_reward.key, system_program::ID.to_bytes(), Vec::new());
        core.is_writable = true;

        assert_eq!(
            prepare_runtime_authenticated_config_genesis_activation_plan(
                &other_law,
                &binding,
                &config.info(),
                &readset.conservation,
                &readset.mint,
                &readset.community,
                &readset.stake,
                &readset.lane_tokens,
                &readset.lanes,
                &core.info(),
            ),
            Err(ConfigGenesisTransitionRuntimeError::RuntimeLawBindingMismatch)
        );

        let owner_spliced_law =
            runtime_law_for(CLOCK_TIMESTAMP, LAW_PROGRAM, LAW_STATE, OTHER_LAW_PROGRAM);
        let owner_spliced_readset = runtime_readset(&binding, &owner_spliced_law, [0x90; 32]);
        assert_eq!(
            prepare_runtime_authenticated_config_genesis_activation_plan(
                &owner_spliced_law,
                &binding,
                &config.info(),
                &owner_spliced_readset.conservation,
                &owner_spliced_readset.mint,
                &owner_spliced_readset.community,
                &owner_spliced_readset.stake,
                &owner_spliced_readset.lane_tokens,
                &owner_spliced_readset.lanes,
                &core.info(),
            ),
            Err(ConfigGenesisTransitionRuntimeError::RuntimeLawBindingMismatch)
        );
    }

    #[test]
    fn nonzero_authenticated_config_state_fails_before_a_candidate_is_returned() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let law = runtime_law();
        let conservation = conservation(&binding);
        let mut hostile = state(&binding);
        hostile.config.staked_principal = 1;
        let mut data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
        encode_config_genesis_state(&hostile, &mut data).unwrap();
        let key = Pubkey::new_from_array(binding.config());
        let owner = Pubkey::new_from_array(binding.program_id());
        let mut lamports = 1;
        let account = AccountInfo::new(&key, false, false, &mut lamports, &mut data, &owner, false);
        assert_eq!(
            prepare_runtime_authenticated_activate_genesis_prerequisites(
                &law,
                &binding,
                &account,
                &conservation,
            ),
            Err(ConfigGenesisTransitionRuntimeError::Candidate(
                ConfigGenesisTransitionCandidateError::PreactivationEconomicStateNotVacuous
            ))
        );
    }

    #[test]
    fn mismatched_runtime_bindings_and_writable_config_fail_closed() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let other_binding = NativeEconomyBinding::new([0xE2; 32], MINT).unwrap();
        let law = runtime_law();
        let mismatched_conservation = conservation(&other_binding);
        let key = Pubkey::new_from_array(binding.config());
        let owner = Pubkey::new_from_array(binding.program_id());
        let mut lamports = 1;
        let mut data = config_data(&binding);
        let account = AccountInfo::new(&key, false, true, &mut lamports, &mut data, &owner, false);
        assert_eq!(
            prepare_runtime_authenticated_activate_genesis_prerequisites(
                &law,
                &binding,
                &account,
                &mismatched_conservation,
            ),
            Err(ConfigGenesisTransitionRuntimeError::ConservationConfigMismatch)
        );

        let conservation = conservation(&binding);
        assert_eq!(
            prepare_runtime_authenticated_activate_genesis_prerequisites(
                &law,
                &binding,
                &account,
                &conservation,
            ),
            Err(ConfigGenesisTransitionRuntimeError::Runtime(
                RuntimeAdapterError::ConfigAccountMustBeReadOnly
            ))
        );
    }

    #[test]
    fn runtime_composer_source_has_no_write_or_public_execution_surface() {
        let source = include_str!("config_genesis_transition_runtime.rs");
        for forbidden in [
            concat!("try_borrow_", "mut"),
            concat!("inv", "oke("),
            concat!("invoke_", "signed("),
            concat!("entry", "point!"),
            concat!("process_", "instruction"),
            concat!("transition_authorized", ": true"),
            concat!("account_writes_executed", ": true"),
            concat!("mainnet_hold", ": false"),
            concat!("next_", "state"),
            concat!("StateWrite", "Intent"),
            concat!("AtomicWrite", "Batch"),
            concat!("prepare_create_state_", "account"),
        ] {
            assert!(!source.contains(forbidden), "forbidden source: {forbidden}");
        }
    }
}

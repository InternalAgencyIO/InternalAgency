//! Runtime-authenticated prerequisites for a future Config/Genesis activation
//! executor.
//!
//! This feature-gated module accepts only an opaque runtime Daily-Law
//! capability, a real immutable Config PDA, and an opaque runtime Genesis
//! conservation receipt. It authenticates current observable preactivation
//! state, but cannot prove complete historical absence of prior writes and
//! cannot authorize or execute the transition.

use crate::config_genesis_transition::validate_activate_genesis_prerequisites;
use crate::genesis_conservation_runtime::AuthenticatedGenesisConservationReceipt;
use crate::native_adapter::NativeEconomyBinding;
use crate::runtime_adapter::{
    parse_config_genesis_account_info_with_runtime_law, RuntimeAdapterError,
    RuntimeValidatedDailyLawWrite,
};
use crate::{ConfigGenesisTransitionCandidateError, GenesisPreactivationCandidateFacts};
use solana_account_info::AccountInfo;

pub const CONFIG_GENESIS_TRANSITION_RUNTIME_STATUS: &str =
    "RUNTIME_AUTHENTICATED_CURRENT_STATE_COMPLETE_HISTORY_UNPROVED_OWNER_ACCEPTANCE_REQUIRED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisTransitionRuntimeTruth {
    pub feature_gated: bool,
    pub runtime_daily_law_account_authenticated: bool,
    pub runtime_config_pda_authenticated: bool,
    pub runtime_genesis_balances_and_lanes_authenticated: bool,
    pub current_preactivation_economic_state_authenticated: bool,
    pub complete_activation_readset_authenticated: bool,
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
        complete_activation_readset_authenticated: false,
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
    Candidate(ConfigGenesisTransitionCandidateError),
    RuntimeLawBindingMismatch,
    ConservationConfigMismatch,
    ConservationMintMismatch,
    ConservationTokenProgramMismatch,
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
    if runtime_law.mint() != binding.mint() {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::genesis_conservation_runtime::AuthenticatedGenesisConservationReceipt;
    use crate::native_adapter::NativeEconomyBinding;
    use crate::runtime_adapter::RuntimeValidatedDailyLawWrite;
    use crate::{
        encode_config_genesis_state, verify_daily_law_open, verify_genesis_allocation_conservation,
        CanonicalDailyLawBinding, ConfigGenesisState, ConfigState, GenesisAllocationEntry,
        GenesisAllocationManifest, GenesisConservationInput, GenesisPhase,
        ObservedGenesisAllocation, ObservedGenesisMint, ReadonlyDailyLawAccount,
        CONFIG_GENESIS_ACCOUNT_LEN, GENESIS_ALLOCATION_AMOUNTS, GENESIS_ALLOCATION_ROLES,
        LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, MAINNET_SUPPLY, TOKEN_DECIMALS,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};
    use solana_pubkey::Pubkey;

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const TOKEN_PROGRAM: [u8; 32] = [0x33; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const GENESIS_TIMESTAMP: i64 = 1_786_000_000;
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    fn runtime_law() -> RuntimeValidatedDailyLawWrite {
        let local_day = protocol_local_day(CLOCK_TIMESTAMP);
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
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
            CLOCK_TIMESTAMP,
        )
        .unwrap();
        RuntimeValidatedDailyLawWrite::from_test_gate(gate, LAW_STATE, LAW_PROGRAM)
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
        ConfigGenesisState {
            phase: GenesisPhase::GenesisStaging,
            config: ConfigState {
                admin: [0x21; 32],
                mint: MINT,
                token_program: TOKEN_PROGRAM,
                randomness_program: [0x44; 32],
                stake_token_account: [0x55; 32],
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
                vault_authority_bump: 202,
            },
        }
    }

    fn config_data(binding: &NativeEconomyBinding) -> [u8; CONFIG_GENESIS_ACCOUNT_LEN] {
        let mut data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
        encode_config_genesis_state(&state(binding), &mut data).unwrap();
        data
    }

    #[test]
    fn runtime_truth_authenticates_current_state_without_claiming_history_or_authority() {
        assert_eq!(
            CONFIG_GENESIS_TRANSITION_RUNTIME_TRUTH,
            ConfigGenesisTransitionRuntimeTruth {
                feature_gated: true,
                runtime_daily_law_account_authenticated: true,
                runtime_config_pda_authenticated: true,
                runtime_genesis_balances_and_lanes_authenticated: true,
                current_preactivation_economic_state_authenticated: true,
                complete_activation_readset_authenticated: false,
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
            concat!("prepare_config_genesis_", "activation_plan"),
            concat!("ConfigGenesis", "ActivationPlan"),
            concat!("next_", "state"),
        ] {
            assert!(!source.contains(forbidden), "forbidden source: {forbidden}");
        }
    }
}

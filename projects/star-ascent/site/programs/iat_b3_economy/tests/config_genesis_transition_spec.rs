use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};
use iat_b3_economy::{
    prepare_activate_genesis_candidate, prepare_enter_genesis_staging_candidate,
    verify_daily_law_open, verify_genesis_allocation_conservation, CanonicalDailyLawBinding,
    ConfigGenesisState, ConfigGenesisTransitionCandidateError,
    ConfigGenesisTransitionCandidateTruth, ConfigGenesisTransitionEdge, ConfigState,
    GenesisAllocationEntry, GenesisAllocationManifest, GenesisConservationInput, GenesisPhase,
    GenesisPreactivationCandidateFacts, ObservedGenesisAllocation, ObservedGenesisMint,
    ReadonlyDailyLawAccount, CONFIG_GENESIS_TRANSITION_CANDIDATE_STATUS,
    CONFIG_GENESIS_TRANSITION_CANDIDATE_TRUTH, GENESIS_ALLOCATION_AMOUNTS,
    GENESIS_ALLOCATION_ROLES, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, MAINNET_SUPPLY,
    TOKEN_DECIMALS,
};

const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
const LAW_STATE: [u8; 32] = [0x51; 32];
const LAW_BUMP: u8 = 254;
const MINT: [u8; 32] = [0x22; 32];
const TOKEN_PROGRAM: [u8; 32] = [0x33; 32];
const NETWORK: [u8; 32] = [0x11; 32];
const GENESIS_TIMESTAMP: i64 = 1_786_000_000;
const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

fn facts() -> GenesisPreactivationCandidateFacts {
    GenesisPreactivationCandidateFacts {
        economic_write_count: 0,
        attributed_core_principal: 0,
        core_rewards_paid: 0,
        core_tokens_released: 0,
    }
}

fn config(phase: GenesisPhase) -> ConfigGenesisState {
    let active = phase == GenesisPhase::Active;
    ConfigGenesisState {
        phase,
        config: ConfigState {
            admin: [0x21; 32],
            mint: MINT,
            token_program: TOKEN_PROGRAM,
            randomness_program: [0x44; 32],
            stake_token_account: if phase == GenesisPhase::Uninitialized {
                [0; 32]
            } else {
                [0x55; 32]
            },
            agency_registry_hash: [0; 32],
            genesis_timestamp: GENESIS_TIMESTAMP,
            expected_supply: MAINNET_SUPPLY,
            staked_principal: 0,
            agency_count: 0,
            rehearsal_mode: false,
            active,
            lane_mask: if phase == GenesisPhase::Uninitialized {
                0
            } else {
                0b1_1110
            },
            stake_vault_initialized: phase != GenesisPhase::Uninitialized,
            bump: 201,
            vault_authority_bump: 202,
        },
    }
}

fn open_gate(mint: [u8; 32], timestamp: i64) -> iat_b3_economy::ValidatedDailyLawWrite {
    let local_day = protocol_local_day(timestamp);
    let decision = (0u16..=u8::MAX.into())
        .find_map(|candidate| {
            let mut hash = [0u8; 32];
            hash[31] = candidate as u8;
            let value =
                create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, mint).unwrap();
            (!value.locked).then_some(value)
        })
        .unwrap();
    let mut data = [0u8; LAW_STATE_LEN];
    data[0..8].copy_from_slice(LAW_STATE_MAGIC);
    data[8] = LAW_STATE_VERSION;
    data[9] = LAW_BUMP;
    data[10] = 1;
    data[11] = u8::from(decision.locked);
    data[16..48].copy_from_slice(&mint);
    data[48..80].copy_from_slice(&NETWORK);
    data[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
    data[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
    data[96..128].copy_from_slice(&decision.ancestor_slot_hash);
    data[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
    data[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
    data[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
    data[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
    verify_daily_law_open(
        &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, mint, NETWORK),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        timestamp,
    )
    .unwrap()
}

fn conservation(token_program: [u8; 32]) -> iat_b3_economy::GenesisConservationReceipt {
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
        token_program,
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
    verify_genesis_allocation_conservation(&GenesisConservationInput {
        manifest: GenesisAllocationManifest {
            mint: MINT,
            token_program,
            entries,
        },
        mint: ObservedGenesisMint {
            key: MINT,
            token_program,
            decimals: TOKEN_DECIMALS,
            supply: MAINNET_SUPPLY,
            mint_authority: None,
            freeze_authority: None,
        },
        allocations,
    })
    .unwrap()
}

#[test]
fn candidate_truth_never_claims_owner_acceptance_or_authorization() {
    assert_eq!(
        CONFIG_GENESIS_TRANSITION_CANDIDATE_STATUS,
        "NONEXECUTING_NONCIRCULAR_CANDIDATE_OWNER_ACCEPTANCE_REQUIRED_MAINNET_HOLD"
    );
    assert_eq!(
        CONFIG_GENESIS_TRANSITION_CANDIDATE_TRUTH,
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
        }
    );
}

#[test]
fn empty_uninitialized_state_can_only_produce_the_staging_candidate() {
    let current = config(GenesisPhase::Uninitialized);
    let candidate = prepare_enter_genesis_staging_candidate(current, facts()).unwrap();
    assert_eq!(
        candidate.edge(),
        ConfigGenesisTransitionEdge::EnterGenesisStaging
    );
    assert_eq!(candidate.next_state().phase, GenesisPhase::GenesisStaging);
    assert!(!candidate.next_state().config.active);
    assert_eq!(candidate.law_account_sha256(), None);
    assert_eq!(candidate.conservation_manifest_sha256(), None);
    assert_ne!(candidate.current_config_sha256(), [0; 32]);
    assert_ne!(candidate.candidate_facts_sha256(), [0; 32]);
}

#[test]
fn staging_rejects_existing_economic_state_and_nonvacuous_core_facts() {
    let mut nonempty = config(GenesisPhase::Uninitialized);
    nonempty.config.lane_mask = 0b10;
    assert_eq!(
        prepare_enter_genesis_staging_candidate(nonempty, facts()),
        Err(ConfigGenesisTransitionCandidateError::StagingStateNotEmpty)
    );
    let mut nonvacuous = facts();
    nonvacuous.core_tokens_released = 1;
    assert_eq!(
        prepare_enter_genesis_staging_candidate(config(GenesisPhase::Uninitialized), nonvacuous),
        Err(ConfigGenesisTransitionCandidateError::PreactivationCoreNotVacuous)
    );
}

#[test]
fn activation_candidate_binds_open_law_conservation_and_exact_funding_shape() {
    let current = config(GenesisPhase::GenesisStaging);
    let law = open_gate(MINT, CLOCK_TIMESTAMP);
    let conservation = conservation(TOKEN_PROGRAM);
    let candidate =
        prepare_activate_genesis_candidate(current, &law, &conservation, facts()).unwrap();
    assert_eq!(candidate.edge(), ConfigGenesisTransitionEdge::Activate);
    assert_eq!(candidate.next_state().phase, GenesisPhase::Active);
    assert!(candidate.next_state().config.active);
    assert_eq!(
        candidate.law_account_sha256(),
        Some(law.law_account_sha256())
    );
    assert_eq!(
        candidate.conservation_manifest_sha256(),
        Some(conservation.manifest_sha256())
    );
}

#[test]
fn activation_checks_law_then_conservation_then_funding_and_vacuous_cap() {
    let current = config(GenesisPhase::GenesisStaging);
    let wrong_law = open_gate([0x23; 32], CLOCK_TIMESTAMP);
    let good_law = open_gate(MINT, CLOCK_TIMESTAMP);
    let good_conservation = conservation(TOKEN_PROGRAM);
    assert_eq!(
        prepare_activate_genesis_candidate(current, &wrong_law, &good_conservation, facts()),
        Err(ConfigGenesisTransitionCandidateError::DailyLawMintMismatch)
    );
    assert_eq!(
        prepare_activate_genesis_candidate(current, &good_law, &conservation([0x34; 32]), facts()),
        Err(ConfigGenesisTransitionCandidateError::ConservationTokenProgramMismatch)
    );
    let mut unfunded = current;
    unfunded.config.lane_mask = 0;
    assert_eq!(
        prepare_activate_genesis_candidate(unfunded, &good_law, &good_conservation, facts()),
        Err(ConfigGenesisTransitionCandidateError::GenesisFundingIncomplete)
    );
    let mut nonvacuous = facts();
    nonvacuous.economic_write_count = 1;
    assert_eq!(
        prepare_activate_genesis_candidate(current, &good_law, &good_conservation, nonvacuous),
        Err(ConfigGenesisTransitionCandidateError::PreactivationCoreNotVacuous)
    );
}

#[test]
fn candidate_source_has_no_executable_or_write_surface() {
    let source = include_str!("../src/config_genesis_transition.rs");
    for forbidden in [
        "AccountInfo",
        "try_borrow_mut",
        "invoke(",
        "invoke_signed(",
        "entrypoint!",
        "process_instruction",
        "transition_authorized: true",
        "account_writes_executed: true",
        "mainnet_hold: false",
    ] {
        assert!(!source.contains(forbidden), "forbidden token {forbidden}");
    }
}

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};
use iat_b3_economy::{
    activate, prepare_config_genesis_activation_plan, prepare_enter_genesis_staging_candidate,
    verify_daily_law_open, verify_genesis_allocation_conservation, ActivateInput,
    CanonicalDailyLawBinding, ConfigGenesisState, ConfigGenesisTransitionCandidateError,
    ConfigGenesisTransitionCandidateTruth, ConfigGenesisTransitionEdge, ConfigState, EconomyError,
    GenesisAllocationEntry, GenesisAllocationManifest, GenesisConservationInput, GenesisPhase,
    GenesisPreactivationCandidateFacts, LaneState, ObservedGenesisAllocation, ObservedGenesisMint,
    ReadonlyDailyLawAccount, ReadonlyMintState, ReadonlyTokenState, COMMUNITY_CUSTODY,
    CONFIG_GENESIS_TRANSITION_CANDIDATE_STATUS, CONFIG_GENESIS_TRANSITION_CANDIDATE_TRUTH,
    CORE_BENEFICIARY, CORE_TEAM, ECOSYSTEM, ECOSYSTEM_BENEFICIARY, GENESIS_ALLOCATION_AMOUNTS,
    GENESIS_ALLOCATION_ROLES, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, LIQUIDITY,
    LIQUIDITY_BENEFICIARY, MAINNET_SUPPLY, TOKEN_DECIMALS, TREASURY, TREASURY_BENEFICIARY,
};

const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
const LAW_STATE: [u8; 32] = [0x51; 32];
const LAW_BUMP: u8 = 254;
const MINT: [u8; 32] = [0x22; 32];
const TOKEN_PROGRAM: [u8; 32] = [0x33; 32];
const NETWORK: [u8; 32] = [0x11; 32];
const GENESIS_TIMESTAMP: i64 = 1_786_000_000;
const CLOCK_TIMESTAMP: i64 = 1_786_050_060;
const CONFIG_KEY: [u8; 32] = [0x81; 32];
const VAULT_AUTHORITY: [u8; 32] = [0x83; 32];

fn facts() -> GenesisPreactivationCandidateFacts {
    GenesisPreactivationCandidateFacts {
        config_staked_principal: 0,
        config_agency_count: 0,
        lane_reserved_total: 0,
        lane_paid_total: 0,
        lane_principal_claimed_total: 0,
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

fn activation_lane(lane: u8, marker: u8) -> LaneState {
    let (beneficiary, total, genesis_unlocked, cliff_week, linear_end_week, reward_source) =
        match lane {
            TREASURY => (
                TREASURY_BENEFICIARY,
                GENESIS_ALLOCATION_AMOUNTS[1],
                50_000_000_000_000_000,
                52,
                208,
                true,
            ),
            ECOSYSTEM => (
                ECOSYSTEM_BENEFICIARY,
                GENESIS_ALLOCATION_AMOUNTS[2],
                37_500_000_000_000_000,
                26,
                104,
                true,
            ),
            CORE_TEAM => (
                CORE_BENEFICIARY,
                GENESIS_ALLOCATION_AMOUNTS[3],
                0,
                26,
                104,
                false,
            ),
            LIQUIDITY => (
                LIQUIDITY_BENEFICIARY,
                GENESIS_ALLOCATION_AMOUNTS[4],
                12_500_000_000_000_000,
                26,
                104,
                true,
            ),
            _ => panic!("unsupported activation lane"),
        };
    LaneState {
        config: CONFIG_KEY,
        token_account: [marker; 32],
        beneficiary,
        total,
        genesis_unlocked,
        cliff_week,
        linear_end_week,
        reserved: 0,
        paid: 0,
        principal_claimed: 0,
        lane,
        reward_source,
        bump: marker.wrapping_add(1),
        token_bump: marker.wrapping_add(2),
    }
}

fn lane_tokens(lane: LaneState) -> ReadonlyTokenState {
    ReadonlyTokenState {
        key: lane.token_account,
        mint: MINT,
        owner: VAULT_AUTHORITY,
        amount: lane.total,
    }
}

fn activate_input(current: ConfigGenesisState) -> ActivateInput {
    let treasury = activation_lane(TREASURY, 0x84);
    let ecosystem = activation_lane(ECOSYSTEM, 0x88);
    let core_team = activation_lane(CORE_TEAM, 0x8c);
    let liquidity = activation_lane(LIQUIDITY, 0x90);
    ActivateInput {
        config_key: CONFIG_KEY,
        config: current.config,
        mint: ReadonlyMintState {
            key: MINT,
            supply: MAINNET_SUPPLY,
            mint_authority: None,
            freeze_authority: None,
        },
        vault_authority: VAULT_AUTHORITY,
        community_tokens: ReadonlyTokenState {
            key: [0x94; 32],
            mint: MINT,
            owner: COMMUNITY_CUSTODY,
            amount: GENESIS_ALLOCATION_AMOUNTS[0],
        },
        stake_tokens: ReadonlyTokenState {
            key: current.config.stake_token_account,
            mint: MINT,
            owner: VAULT_AUTHORITY,
            amount: 0,
        },
        treasury,
        treasury_tokens: lane_tokens(treasury),
        ecosystem,
        ecosystem_tokens: lane_tokens(ecosystem),
        core_team,
        core_team_tokens: lane_tokens(core_team),
        liquidity,
        liquidity_tokens: lane_tokens(liquidity),
        core_reward_bump: 244,
    }
}

fn activation_plan(
    current: ConfigGenesisState,
    input: ActivateInput,
) -> Result<iat_b3_economy::ConfigGenesisActivationPlan, ConfigGenesisTransitionCandidateError> {
    prepare_config_genesis_activation_plan(
        CONFIG_KEY,
        current,
        &open_gate(MINT, CLOCK_TIMESTAMP),
        &conservation(TOKEN_PROGRAM),
        input,
    )
}

fn activation_lane_mut(input: &mut ActivateInput, index: usize) -> &mut LaneState {
    match index {
        0 => &mut input.treasury,
        1 => &mut input.ecosystem,
        2 => &mut input.core_team,
        3 => &mut input.liquidity,
        _ => panic!("invalid activation lane index"),
    }
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
    nonvacuous.lane_principal_claimed_total = 1;
    assert_eq!(
        prepare_enter_genesis_staging_candidate(config(GenesisPhase::Uninitialized), nonvacuous),
        Err(ConfigGenesisTransitionCandidateError::PreactivationEconomicStateNotVacuous)
    );
}

#[test]
fn activation_plan_matches_the_complete_retained_five_account_result() {
    let current = config(GenesisPhase::GenesisStaging);
    let law = open_gate(MINT, CLOCK_TIMESTAMP);
    let conservation = conservation(TOKEN_PROGRAM);
    let input = activate_input(current);
    let retained = activate(&law, input).unwrap();
    let plan =
        prepare_config_genesis_activation_plan(CONFIG_KEY, current, &law, &conservation, input)
            .unwrap();
    assert!(plan.matches_exact_retained_result(&retained));
    assert_eq!(plan.law_account_sha256(), law.law_account_sha256());
    assert_eq!(
        plan.conservation_manifest_sha256(),
        conservation.manifest_sha256()
    );
    assert_ne!(plan.current_config_sha256(), [0; 32]);
    assert_ne!(plan.activation_readset_sha256(), [0; 32]);
    assert_ne!(plan.poststates_sha256(), [0; 32]);
}

#[test]
fn activation_checks_key_config_law_conservation_vacuity_then_retained_body() {
    let current = config(GenesisPhase::GenesisStaging);
    let wrong_law = open_gate([0x23; 32], CLOCK_TIMESTAMP);
    let good_law = open_gate(MINT, CLOCK_TIMESTAMP);
    let good_conservation = conservation(TOKEN_PROGRAM);
    let input = activate_input(current);
    assert_eq!(
        prepare_config_genesis_activation_plan(
            CONFIG_KEY,
            current,
            &wrong_law,
            &good_conservation,
            input,
        ),
        Err(ConfigGenesisTransitionCandidateError::DailyLawMintMismatch)
    );
    assert_eq!(
        prepare_config_genesis_activation_plan(
            CONFIG_KEY,
            current,
            &good_law,
            &conservation([0x34; 32]),
            input,
        ),
        Err(ConfigGenesisTransitionCandidateError::ConservationTokenProgramMismatch)
    );
    let mut wrong_key = input;
    wrong_key.config_key = [0x82; 32];
    assert_eq!(
        activation_plan(current, wrong_key),
        Err(ConfigGenesisTransitionCandidateError::ActivateInputConfigKeyMismatch)
    );
    let mut wrong_config = input;
    wrong_config.config.agency_count = 1;
    assert_eq!(
        activation_plan(current, wrong_config),
        Err(ConfigGenesisTransitionCandidateError::ActivateInputConfigMismatch)
    );
    let mut wrong_mint = input;
    wrong_mint.mint.key = [0x23; 32];
    assert_eq!(
        activation_plan(current, wrong_mint),
        Err(ConfigGenesisTransitionCandidateError::ActivateInputMintMismatch)
    );
    let mut wrong_lane = input;
    wrong_lane.core_team.config = [0x82; 32];
    assert_eq!(
        activation_plan(current, wrong_lane),
        Err(ConfigGenesisTransitionCandidateError::ActivateInputLaneBindingMismatch)
    );
    let mut wrong_stake = input;
    wrong_stake.stake_tokens.key = [0x56; 32];
    assert_eq!(
        activation_plan(current, wrong_stake),
        Err(ConfigGenesisTransitionCandidateError::ActivateInputStakeTokenMismatch)
    );
    let mut unfunded = input;
    unfunded.treasury_tokens.amount -= 1;
    assert_eq!(
        activation_plan(current, unfunded),
        Err(ConfigGenesisTransitionCandidateError::RetainedActivation(
            EconomyError::WrongVaultFunding
        ))
    );
}

#[test]
fn every_lane_preactivation_counter_is_derived_and_rejected_individually() {
    let current = config(GenesisPhase::GenesisStaging);
    for lane_index in 0..4 {
        for counter_index in 0..3 {
            let mut input = activate_input(current);
            let lane = activation_lane_mut(&mut input, lane_index);
            match counter_index {
                0 => lane.reserved = 1,
                1 => lane.paid = 1,
                2 => lane.principal_claimed = 1,
                _ => unreachable!(),
            }
            assert_eq!(
                activation_plan(current, input),
                Err(ConfigGenesisTransitionCandidateError::PreactivationEconomicStateNotVacuous),
                "lane={lane_index} counter={counter_index}"
            );
        }
    }
}

#[test]
fn exact_phase_graph_has_only_uninitialized_to_staging_and_staging_to_active() {
    let phases = [
        GenesisPhase::Uninitialized,
        GenesisPhase::GenesisStaging,
        GenesisPhase::Active,
    ];
    for from in phases {
        for to in phases {
            let accepted = match to {
                GenesisPhase::Uninitialized => false,
                GenesisPhase::GenesisStaging => {
                    prepare_enter_genesis_staging_candidate(config(from), facts()).is_ok()
                }
                GenesisPhase::Active => {
                    let current = config(from);
                    activation_plan(
                        current,
                        activate_input(config(GenesisPhase::GenesisStaging)),
                    )
                    .is_ok()
                }
            };
            assert_eq!(
                accepted,
                matches!(
                    (from, to),
                    (GenesisPhase::Uninitialized, GenesisPhase::GenesisStaging)
                        | (GenesisPhase::GenesisStaging, GenesisPhase::Active)
                ),
                "from={from:?} to={to:?}"
            );
        }
    }
}

#[test]
fn readset_and_each_of_the_five_poststates_are_commitment_bound() {
    let current = config(GenesisPhase::GenesisStaging);
    let base_input = activate_input(current);
    let base = activation_plan(current, base_input).unwrap();
    let repeated = activation_plan(current, base_input).unwrap();
    assert_eq!(
        base.activation_readset_sha256(),
        repeated.activation_readset_sha256()
    );
    assert_eq!(base.poststates_sha256(), repeated.poststates_sha256());

    let mut read_only_change = base_input;
    read_only_change.community_tokens.key = [0x95; 32];
    let read_only_plan = activation_plan(current, read_only_change).unwrap();
    assert_ne!(
        base.activation_readset_sha256(),
        read_only_plan.activation_readset_sha256()
    );
    assert_eq!(base.poststates_sha256(), read_only_plan.poststates_sha256());

    let mut variants = [base_input; 5];
    let mut config_variant = current;
    config_variant.config.agency_registry_hash = [0xA1; 32];
    variants[0].config = config_variant.config;
    variants[1].treasury.bump = variants[1].treasury.bump.wrapping_add(1);
    variants[2].ecosystem.bump = variants[2].ecosystem.bump.wrapping_add(1);
    variants[3].liquidity.bump = variants[3].liquidity.bump.wrapping_add(1);
    variants[4].core_reward_bump = variants[4].core_reward_bump.wrapping_add(1);

    for (index, input) in variants.into_iter().enumerate() {
        let variant_current = if index == 0 { config_variant } else { current };
        let variant = activation_plan(variant_current, input).unwrap();
        assert_ne!(
            base.poststates_sha256(),
            variant.poststates_sha256(),
            "poststate index={index}"
        );
    }
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
        "pub const fn config(&self)",
        "pub const fn treasury(&self)",
        "pub const fn ecosystem(&self)",
        "pub const fn liquidity(&self)",
        "pub const fn core_reward(&self)",
        "prepare_activate_genesis_candidate",
        "transition_authorized: true",
        "account_writes_executed: true",
        "mainnet_hold: false",
    ] {
        assert!(!source.contains(forbidden), "forbidden token {forbidden}");
    }
}

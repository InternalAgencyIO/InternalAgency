use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
use iat_b3_economy::native_adapter::*;
use iat_b3_economy::{
    decode_eligibility_state, decode_position_state, encode_agency_owner_index_state,
    encode_agency_state, encode_core_reward_state, encode_eligibility_state, encode_lane_state,
    encode_position_state, encode_round_state, verify_daily_law_open, AgencyOwnerIndexState,
    AgencyState, CanonicalDailyLawBinding, CoreRewardState, EligibilityState, LaneState,
    PositionState, ReadonlyDailyLawAccount, RoundState, ValidatedDailyLawWrite, AGENCY_ACCOUNT_LEN,
    AGENCY_OWNER_INDEX_ACCOUNT_LEN, CORE_REWARD_ACCOUNT_LEN, ELIGIBILITY_ACCOUNT_LEN,
    LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, POSITION_ACCOUNT_LEN,
    ROUND_ACCOUNT_LEN, ROUND_PENDING,
};
use solana_pubkey::Pubkey;
use solana_sdk_ids::system_program;

const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
const LAW_STATE: [u8; 32] = [0x51; 32];
const LAW_BUMP: u8 = 254;
const MINT: [u8; 32] = [0x22; 32];
const NETWORK: [u8; 32] = [0x11; 32];
const OWNER: [u8; 32] = [0xA1; 32];
const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

fn binding() -> NativeEconomyBinding {
    NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
}

fn open_gate_at(timestamp: i64) -> ValidatedDailyLawWrite {
    open_gate_with(
        LAW_PROGRAM,
        LAW_STATE,
        LAW_BUMP,
        MINT,
        NETWORK,
        timestamp,
        0,
    )
}

fn open_gate_with(
    law_program: [u8; 32],
    law_state: [u8; 32],
    law_bump: u8,
    mint: [u8; 32],
    network: [u8; 32],
    timestamp: i64,
    open_decision_ordinal: usize,
) -> ValidatedDailyLawWrite {
    let decision = decision_for_inputs(timestamp, false, network, mint, open_decision_ordinal);
    let data = pack_law_state_for(law_bump, mint, network, Some(decision));
    verify_daily_law_open(
        &CanonicalDailyLawBinding::new(law_program, law_state, law_bump, mint, network),
        ReadonlyDailyLawAccount::new(law_state, law_program, false, &data),
        timestamp,
    )
    .unwrap()
}

fn decision_for_inputs(
    timestamp: i64,
    locked: bool,
    network: [u8; 32],
    mint: [u8; 32],
    matching_ordinal: usize,
) -> SolanaDailyDecision {
    let local_day = protocol_local_day(timestamp);
    let mut matches = 0usize;
    for candidate in 0u16..=u8::MAX.into() {
        let mut hash = [0u8; 32];
        hash[31] = candidate as u8;
        let decision =
            create_solana_daily_decision(local_day, 42_424_242, hash, network, mint).unwrap();
        if decision.locked == locked {
            if matches == matching_ordinal {
                return decision;
            }
            matches += 1;
        }
    }
    panic!("test vector search did not find requested disposition")
}

fn pack_law_state_for(
    law_bump: u8,
    mint: [u8; 32],
    network: [u8; 32],
    decision: Option<SolanaDailyDecision>,
) -> [u8; LAW_STATE_LEN] {
    let mut data = [0u8; LAW_STATE_LEN];
    data[0..8].copy_from_slice(LAW_STATE_MAGIC);
    data[8] = LAW_STATE_VERSION;
    data[9] = law_bump;
    data[16..48].copy_from_slice(&mint);
    data[48..80].copy_from_slice(&network);
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

fn config_key(binding: &NativeEconomyBinding) -> [u8; 32] {
    binding.config()
}

fn strict_state_cases(
    binding: &NativeEconomyBinding,
) -> Vec<(PdaIdentity, StrictStateValue, Vec<u8>)> {
    let config = config_key(binding);

    let position_identity = PdaIdentity::Position {
        config,
        operator: OWNER,
        position_id: 7,
    };
    let position = PositionState {
        config,
        owner: OWNER,
        position_id: 7,
        principal: 1_000,
        accepted_week: 4,
        first_accrual_week: 5,
        term_weeks: 52,
        annual_rate_bps: 1_000,
        treasury_reserved: 20,
        ecosystem_reserved: 30,
        liquidity_reserved: 40,
        paid: 0,
        settled_mask: 0,
        agency_index: u32::MAX,
        role: 0,
        principal_returned: false,
        closed: false,
        bump: derive_pda(binding, position_identity).unwrap().bump,
    };

    let lane_identity = PdaIdentity::LaneState { config, lane: 1 };
    let lane_token = derive_pda(binding, PdaIdentity::LaneToken { config, lane: 1 }).unwrap();
    let lane = LaneState {
        config,
        token_account: lane_token.key,
        beneficiary: [0xA2; 32],
        total: 10_000,
        genesis_unlocked: 1_000,
        cliff_week: 0,
        linear_end_week: 104,
        reserved: 90,
        paid: 0,
        principal_claimed: 0,
        lane: 1,
        reward_source: true,
        bump: derive_pda(binding, lane_identity).unwrap().bump,
        token_bump: lane_token.bump,
    };

    let round_identity = PdaIdentity::Round { config, week: 9 };
    let round = RoundState {
        config,
        randomness_account: [0xA3; 32],
        week: 9,
        commit_slot: 400,
        commit_timestamp: CLOCK_TIMESTAMP,
        randomness: [0; 32],
        agency_registry_hash_snapshot: [0xA4; 32],
        decision_context: [0xA5; 32],
        agency_count_snapshot: 0,
        selected_agency_index: u32::MAX,
        derivation_counter: u32::MAX,
        status: ROUND_PENDING,
        bump: derive_pda(binding, round_identity).unwrap().bump,
    };

    let core_identity = PdaIdentity::CoreReward { config };
    let core = CoreRewardState {
        config,
        principal: 1_000,
        annual_rate_bps: 1_700,
        term_weeks: 104,
        treasury_reserved: 10,
        ecosystem_reserved: 20,
        liquidity_reserved: 30,
        paid: 0,
        settled_low: 0,
        settled_high: 0,
        bump: derive_pda(binding, core_identity).unwrap().bump,
    };

    let agency_identity = PdaIdentity::Agency { config, index: 3 };
    let agency = AgencyState {
        config,
        owner: OWNER,
        index: 3,
        registered_week: 2,
        bump: derive_pda(binding, agency_identity).unwrap().bump,
    };

    let owner_index_identity = PdaIdentity::AgencyOwnerIndex {
        config,
        owner: OWNER,
    };
    let owner_index = AgencyOwnerIndexState {
        config,
        owner: OWNER,
        index: 3,
        bump: derive_pda(binding, owner_index_identity).unwrap().bump,
    };

    let eligibility_identity = PdaIdentity::Eligibility {
        config,
        operator: OWNER,
    };
    let eligibility = EligibilityState {
        config,
        wallet: OWNER,
        agency_index: u32::MAX,
        role: 0,
        bump: derive_pda(binding, eligibility_identity).unwrap().bump,
    };

    [
        (position_identity, StrictStateValue::Position(position)),
        (lane_identity, StrictStateValue::Lane(lane)),
        (round_identity, StrictStateValue::Round(round)),
        (core_identity, StrictStateValue::CoreReward(core)),
        (agency_identity, StrictStateValue::Agency(agency)),
        (
            owner_index_identity,
            StrictStateValue::AgencyOwnerIndex(owner_index),
        ),
        (
            eligibility_identity,
            StrictStateValue::Eligibility(eligibility),
        ),
    ]
    .into_iter()
    .map(|(identity, state)| (identity, state, encode_state(state)))
    .collect()
}

fn encode_state(state: StrictStateValue) -> Vec<u8> {
    match state {
        StrictStateValue::Position(value) => {
            let mut data = vec![0; POSITION_ACCOUNT_LEN];
            encode_position_state(&value, &mut data).unwrap();
            data
        }
        StrictStateValue::Lane(value) => {
            let mut data = vec![0; LANE_ACCOUNT_LEN];
            encode_lane_state(&value, &mut data).unwrap();
            data
        }
        StrictStateValue::Round(value) => {
            let mut data = vec![0; ROUND_ACCOUNT_LEN];
            encode_round_state(&value, &mut data).unwrap();
            data
        }
        StrictStateValue::CoreReward(value) => {
            let mut data = vec![0; CORE_REWARD_ACCOUNT_LEN];
            encode_core_reward_state(&value, &mut data).unwrap();
            data
        }
        StrictStateValue::Agency(value) => {
            let mut data = vec![0; AGENCY_ACCOUNT_LEN];
            encode_agency_state(&value, &mut data).unwrap();
            data
        }
        StrictStateValue::AgencyOwnerIndex(value) => {
            let mut data = vec![0; AGENCY_OWNER_INDEX_ACCOUNT_LEN];
            encode_agency_owner_index_state(&value, &mut data).unwrap();
            data
        }
        StrictStateValue::Eligibility(value) => {
            let mut data = vec![0; ELIGIBILITY_ACCOUNT_LEN];
            encode_eligibility_state(&value, &mut data).unwrap();
            data
        }
    }
}

fn observed<'a>(key: [u8; 32], owner: [u8; 32], data: &'a [u8]) -> NativeAccountObservation<'a> {
    NativeAccountObservation {
        key,
        owner,
        lamports: 1_000_000,
        data,
        is_signer: false,
        is_writable: true,
        executable: false,
    }
}

#[test]
fn full_frozen_economy_pda_roster_is_nonzero_distinct_and_seed_exact() {
    assert_eq!(
        NATIVE_ADAPTER_TRUTH,
        NativeAdapterTruth {
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
        }
    );
    let binding = binding();
    let config = config_key(&binding);
    let faction_config = derive_faction_config(&binding);
    let faction_week = derive_faction_week(&binding, &faction_config, 10).unwrap();
    let reward_manifest = derive_faction_reward_manifest(&binding, &faction_week).unwrap();
    let identities = [
        PdaIdentity::Config { mint: MINT },
        PdaIdentity::VaultAuthority { config },
        PdaIdentity::LaneState { config, lane: 1 },
        PdaIdentity::LaneToken { config, lane: 1 },
        PdaIdentity::StakeToken { config },
        PdaIdentity::StakeIngress { config },
        PdaIdentity::CoreReward { config },
        PdaIdentity::Agency { config, index: 7 },
        PdaIdentity::AgencyOwnerIndex {
            config,
            owner: OWNER,
        },
        PdaIdentity::Eligibility {
            config,
            operator: OWNER,
        },
        PdaIdentity::Position {
            config,
            operator: OWNER,
            position_id: 8,
        },
        PdaIdentity::Round { config, week: 9 },
        PdaIdentity::FactionConfig { config },
        PdaIdentity::FactionAllegiance {
            faction_config,
            operator: OWNER,
        },
        PdaIdentity::FactionWeek {
            faction_config,
            week: 10,
        },
        PdaIdentity::FactionScore {
            faction_week,
            faction_id: 2,
        },
        PdaIdentity::FactionRewardVault { faction_config },
        PdaIdentity::FactionRewardManifest { faction_week },
        PdaIdentity::FactionFollowerSnapshot {
            faction_week,
            faction_id: 2,
        },
        PdaIdentity::FactionClaim {
            reward_manifest,
            operator: OWNER,
        },
    ];
    let mut keys = Vec::new();
    for identity in identities {
        let actual = derive_pda(&binding, identity).unwrap();
        let expected = independently_derive(identity);
        assert_eq!((actual.key, actual.bump), expected, "{:?}", identity.kind());
        assert_ne!(actual.key, [0; 32]);
        assert!(!keys.contains(&actual.key));
        keys.push(actual.key);
    }
    assert_eq!(keys.len(), 20);
    assert_eq!(
        NativeEconomyBinding::new([0; 32], MINT),
        Err(NativeAdapterError::EconomyProgramIsSystemProgram)
    );
    assert_eq!(
        NativeEconomyBinding::new(ECONOMY_PROGRAM, [0; 32]),
        Err(NativeAdapterError::ZeroMintIdentity)
    );
    assert_eq!(
        NativeEconomyBinding::new(ECONOMY_PROGRAM, ECONOMY_PROGRAM),
        Err(NativeAdapterError::RuntimeIdentityCollision)
    );
    assert_eq!(
        derive_pda(&binding, PdaIdentity::Config { mint: [0; 32] }),
        Err(NativeAdapterError::ZeroPdaSeedIdentity)
    );
    assert_eq!(
        derive_pda(&binding, PdaIdentity::StakeToken { config: [7; 32] }),
        Err(NativeAdapterError::NonCanonicalConfigIdentity)
    );
    let other_binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, [0x23; 32]).unwrap();
    assert_eq!(
        derive_pda(
            &other_binding,
            PdaIdentity::FactionScore {
                faction_week,
                faction_id: 2,
            },
        ),
        Err(NativeAdapterError::ParentPdaBindingMismatch)
    );
}

#[test]
fn every_strict_codec_is_bound_to_owner_pda_embedded_identity_and_bump() {
    let binding = binding();
    let gate = open_gate_at(CLOCK_TIMESTAMP);
    for (identity, state, data) in strict_state_cases(&binding) {
        let key = derive_pda(&binding, identity).unwrap().key;
        let authenticated = authenticate_state_account(
            &gate,
            &binding,
            observed(key, ECONOMY_PROGRAM, &data),
            identity,
        )
        .unwrap();
        assert_eq!(authenticated.key(), key);
        assert_eq!(authenticated.identity(), identity);
        assert_eq!(authenticated.state(), state);
    }

    let (identity, state, data) = strict_state_cases(&binding).remove(0);
    let key = derive_pda(&binding, identity).unwrap().key;
    let base = observed(key, ECONOMY_PROGRAM, &data);
    assert_eq!(
        authenticate_state_account(
            &gate,
            &binding,
            NativeAccountObservation {
                key: [9; 32],
                ..base
            },
            identity
        ),
        Err(NativeAdapterError::AccountKeyMismatch)
    );
    assert_eq!(
        authenticate_state_account(
            &gate,
            &binding,
            NativeAccountObservation {
                owner: [8; 32],
                ..base
            },
            identity
        ),
        Err(NativeAdapterError::AccountOwnerMismatch)
    );
    assert_eq!(
        authenticate_state_account(
            &gate,
            &binding,
            NativeAccountObservation {
                is_writable: false,
                ..base
            },
            identity
        ),
        Err(NativeAdapterError::AccountMustBeWritable)
    );
    assert_eq!(
        authenticate_state_account(
            &gate,
            &binding,
            NativeAccountObservation {
                executable: true,
                ..base
            },
            identity
        ),
        Err(NativeAdapterError::AccountMustNotBeExecutable)
    );
    assert_eq!(
        authenticate_state_account(
            &gate,
            &binding,
            NativeAccountObservation {
                is_signer: true,
                ..base
            },
            identity
        ),
        Err(NativeAdapterError::PdaAccountMustNotBeSigner)
    );

    let StrictStateValue::Position(mut wrong_bump) = state else {
        unreachable!()
    };
    wrong_bump.bump = wrong_bump.bump.wrapping_add(1);
    let wrong_bump_bytes = encode_state(StrictStateValue::Position(wrong_bump));
    assert_eq!(
        authenticate_state_account(
            &gate,
            &binding,
            observed(key, ECONOMY_PROGRAM, &wrong_bump_bytes),
            identity,
        ),
        Err(NativeAdapterError::PdaBumpMismatch)
    );

    let (lane_identity, lane_state, _) = strict_state_cases(&binding).remove(1);
    let StrictStateValue::Lane(mut wrong_token) = lane_state else {
        unreachable!()
    };
    wrong_token.token_account = [0xEE; 32];
    let wrong_token_bytes = encode_state(StrictStateValue::Lane(wrong_token));
    assert_eq!(
        authenticate_state_account(
            &gate,
            &binding,
            observed(
                derive_pda(&binding, lane_identity).unwrap().key,
                ECONOMY_PROGRAM,
                &wrong_token_bytes,
            ),
            lane_identity,
        ),
        Err(NativeAdapterError::CompanionPdaMismatch)
    );
}

#[test]
fn existing_write_is_daily_law_stamped_cas_bound_and_batch_atomic() {
    let binding = binding();
    let gate = open_gate_at(CLOCK_TIMESTAMP);
    let (identity, state, data) = strict_state_cases(&binding).remove(0);
    let key = derive_pda(&binding, identity).unwrap().key;
    let account = observed(key, ECONOMY_PROGRAM, &data);
    let authenticated = authenticate_state_account(&gate, &binding, account, identity).unwrap();
    let StrictStateValue::Position(mut next) = state else {
        unreachable!()
    };
    next.paid = 12;
    let intent = prepare_existing_state_write(
        &gate,
        &binding,
        &authenticated,
        StrictStateValue::Position(next),
    )
    .unwrap();
    let StateWriteIntent::Existing(existing) = intent else {
        unreachable!()
    };
    assert_eq!(decode_position_state(existing.postimage()).unwrap(), next);
    assert_ne!(
        existing.expected_preimage_sha256(),
        existing.postimage_sha256()
    );

    let batch = seal_atomic_write_batch(&gate, &binding, [intent]).unwrap();
    assert_ne!(batch.commitment_sha256(), [0; 32]);
    let validated =
        validate_atomic_write_preconditions(&gate, &binding, batch, &[account], &[]).unwrap();
    assert_eq!(
        validated.batch().commitment_sha256(),
        batch.commitment_sha256()
    );

    let mut stale = data.clone();
    stale[100] ^= 1;
    assert_eq!(
        validate_atomic_write_preconditions(
            &gate,
            &binding,
            batch,
            &[observed(key, ECONOMY_PROGRAM, &stale)],
            &[],
        ),
        Err(NativeAdapterError::PreimageMismatch)
    );
    assert_eq!(
        seal_atomic_write_batch(&gate, &binding, [intent, intent]),
        Err(NativeAdapterError::DuplicateWriteAccount)
    );
    assert_eq!(
        seal_atomic_write_batch::<0>(&gate, &binding, []),
        Err(NativeAdapterError::EmptyWriteBatch)
    );
    let later_gate = open_gate_at(CLOCK_TIMESTAMP + 1);
    assert_eq!(
        seal_atomic_write_batch(&later_gate, &binding, [intent]),
        Err(NativeAdapterError::LawCapabilityMismatch)
    );

    let StrictStateValue::Position(mut drift) = state else {
        unreachable!()
    };
    drift.position_id += 1;
    assert_eq!(
        prepare_existing_state_write(
            &gate,
            &binding,
            &authenticated,
            StrictStateValue::Position(drift),
        ),
        Err(NativeAdapterError::PostStateIdentityDrift)
    );
}

#[test]
fn exact_law_capability_prevents_cross_binding_auth_create_seal_and_validation() {
    let binding = binding();
    let gate_a = open_gate_at(CLOCK_TIMESTAMP);
    assert_eq!(gate_a.law_program_id(), LAW_PROGRAM);
    assert_eq!(gate_a.law_state_address(), LAW_STATE);
    assert_eq!(gate_a.law_state_bump(), LAW_BUMP);
    assert_eq!(gate_a.mint(), MINT);
    assert_eq!(gate_a.network_genesis_hash(), NETWORK);
    assert_ne!(gate_a.law_account_sha256(), [0; 32]);

    let config = binding.config();
    let identity_a = PdaIdentity::Eligibility {
        config,
        operator: OWNER,
    };
    let target_a_pda = derive_pda(&binding, identity_a).unwrap();
    let initial_a = EligibilityState {
        config,
        wallet: OWNER,
        agency_index: u32::MAX,
        role: 0,
        bump: target_a_pda.bump,
    };
    let payer_key = [0xF1; 32];
    let payer_observation = NativeAccountObservation {
        key: payer_key,
        owner: system_program::ID.to_bytes(),
        lamports: 9_000_000,
        data: &[],
        is_signer: true,
        is_writable: true,
        executable: false,
    };
    let payer_a =
        authenticate_system_payer(&gate_a, &binding, payer_observation, payer_key).unwrap();
    let target_a = NativeAccountObservation {
        key: target_a_pda.key,
        owner: system_program::ID.to_bytes(),
        lamports: 0,
        data: &[],
        is_signer: false,
        is_writable: true,
        executable: false,
    };
    let intent_a = prepare_create_state_account(
        &gate_a,
        &binding,
        &payer_a,
        target_a,
        identity_a,
        StrictStateValue::Eligibility(initial_a),
        50_000,
    )
    .unwrap();
    let batch_a = seal_atomic_write_batch(&gate_a, &binding, [intent_a]).unwrap();
    validate_atomic_write_preconditions(
        &gate_a,
        &binding,
        batch_a,
        &[target_a],
        &[payer_observation],
    )
    .unwrap();

    let program_b = open_gate_with(
        [0xB4; 32],
        LAW_STATE,
        LAW_BUMP,
        MINT,
        NETWORK,
        CLOCK_TIMESTAMP,
        0,
    );
    let address_b = open_gate_with(
        LAW_PROGRAM,
        [0x52; 32],
        LAW_BUMP,
        MINT,
        NETWORK,
        CLOCK_TIMESTAMP,
        0,
    );
    let bump_b = open_gate_with(
        LAW_PROGRAM,
        LAW_STATE,
        LAW_BUMP - 1,
        MINT,
        NETWORK,
        CLOCK_TIMESTAMP,
        0,
    );
    let mint_b = open_gate_with(
        LAW_PROGRAM,
        LAW_STATE,
        LAW_BUMP,
        [0x23; 32],
        NETWORK,
        CLOCK_TIMESTAMP,
        0,
    );
    let network_b = open_gate_with(
        LAW_PROGRAM,
        LAW_STATE,
        LAW_BUMP,
        MINT,
        [0x12; 32],
        CLOCK_TIMESTAMP,
        0,
    );
    let data_b = open_gate_with(
        LAW_PROGRAM,
        LAW_STATE,
        LAW_BUMP,
        MINT,
        NETWORK,
        CLOCK_TIMESTAMP,
        1,
    );
    assert_ne!(program_b.law_program_id(), gate_a.law_program_id());
    assert_ne!(address_b.law_state_address(), gate_a.law_state_address());
    assert_ne!(bump_b.law_state_bump(), gate_a.law_state_bump());
    assert_ne!(mint_b.mint(), gate_a.mint());
    assert_ne!(
        network_b.network_genesis_hash(),
        gate_a.network_genesis_hash()
    );
    assert_eq!(data_b.law_program_id(), gate_a.law_program_id());
    assert_eq!(data_b.law_state_address(), gate_a.law_state_address());
    assert_eq!(data_b.law_state_bump(), gate_a.law_state_bump());
    assert_eq!(data_b.mint(), gate_a.mint());
    assert_eq!(data_b.network_genesis_hash(), gate_a.network_genesis_hash());
    assert_ne!(data_b.law_account_sha256(), gate_a.law_account_sha256());

    for (gate_b, expected) in [
        (&program_b, NativeAdapterError::LawCapabilityMismatch),
        (&address_b, NativeAdapterError::LawCapabilityMismatch),
        (&bump_b, NativeAdapterError::LawCapabilityMismatch),
        (&mint_b, NativeAdapterError::LawMintMismatch),
        (&network_b, NativeAdapterError::LawCapabilityMismatch),
        (&data_b, NativeAdapterError::LawCapabilityMismatch),
    ] {
        assert_eq!(
            prepare_create_state_account(
                gate_b,
                &binding,
                &payer_a,
                target_a,
                identity_a,
                StrictStateValue::Eligibility(initial_a),
                50_000,
            ),
            Err(expected)
        );
    }
    assert_eq!(
        seal_atomic_write_batch(&data_b, &binding, [intent_a]),
        Err(NativeAdapterError::LawCapabilityMismatch)
    );
    assert_eq!(
        validate_atomic_write_preconditions(
            &data_b,
            &binding,
            batch_a,
            &[target_a],
            &[payer_observation],
        ),
        Err(NativeAdapterError::LawCapabilityMismatch)
    );

    let operator_b = [0xA6; 32];
    let identity_b = PdaIdentity::Eligibility {
        config,
        operator: operator_b,
    };
    let target_b_pda = derive_pda(&binding, identity_b).unwrap();
    let initial_b = EligibilityState {
        config,
        wallet: operator_b,
        agency_index: u32::MAX,
        role: 0,
        bump: target_b_pda.bump,
    };
    let target_b = NativeAccountObservation {
        key: target_b_pda.key,
        ..target_a
    };
    let payer_b =
        authenticate_system_payer(&data_b, &binding, payer_observation, payer_key).unwrap();
    let intent_b = prepare_create_state_account(
        &data_b,
        &binding,
        &payer_b,
        target_b,
        identity_b,
        StrictStateValue::Eligibility(initial_b),
        50_000,
    )
    .unwrap();
    assert_eq!(
        seal_atomic_write_batch(&gate_a, &binding, [intent_a, intent_b]),
        Err(NativeAdapterError::LawCapabilityMismatch)
    );

    let independently_verified_a = open_gate_at(CLOCK_TIMESTAMP);
    let identical_intent = prepare_create_state_account(
        &independently_verified_a,
        &binding,
        &payer_a,
        target_a,
        identity_a,
        StrictStateValue::Eligibility(initial_a),
        50_000,
    )
    .unwrap();
    let identical_batch =
        seal_atomic_write_batch(&independently_verified_a, &binding, [identical_intent]).unwrap();
    validate_atomic_write_preconditions(
        &independently_verified_a,
        &binding,
        identical_batch,
        &[target_a],
        &[payer_observation],
    )
    .unwrap();

    let mint_b_binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, [0x23; 32]).unwrap();
    assert_eq!(
        authenticate_system_payer(&gate_a, &mint_b_binding, payer_observation, payer_key,),
        Err(NativeAdapterError::LawMintMismatch)
    );
}

#[test]
fn vacant_pda_creation_is_signer_rent_and_precondition_bound_without_a_cpi() {
    let binding = binding();
    let gate = open_gate_at(CLOCK_TIMESTAMP);
    let config = config_key(&binding);
    let identity = PdaIdentity::Eligibility {
        config,
        operator: OWNER,
    };
    let pda = derive_pda(&binding, identity).unwrap();
    let initial = EligibilityState {
        config,
        wallet: OWNER,
        agency_index: u32::MAX,
        role: 0,
        bump: pda.bump,
    };
    let payer_key = [0xF1; 32];
    let system_owner = system_program::ID.to_bytes();
    let payer_account = NativeAccountObservation {
        key: payer_key,
        owner: system_owner,
        lamports: 9_000_000,
        data: &[],
        is_signer: true,
        is_writable: true,
        executable: false,
    };
    let payer = authenticate_system_payer(&gate, &binding, payer_account, payer_key).unwrap();
    let target = NativeAccountObservation {
        key: pda.key,
        owner: system_owner,
        lamports: 0,
        data: &[],
        is_signer: false,
        is_writable: true,
        executable: false,
    };
    let intent = prepare_create_state_account(
        &gate,
        &binding,
        &payer,
        target,
        identity,
        StrictStateValue::Eligibility(initial),
        50_000,
    )
    .unwrap();
    let StateWriteIntent::Create(create) = intent else {
        unreachable!()
    };
    assert_eq!(create.lifecycle(), CreatePdaLifecycle::CreateAccount);
    assert_eq!(create.funding_lamports(), 50_000);
    assert!(create.invoke_signed_required());
    assert_eq!(
        decode_eligibility_state(create.postimage()).unwrap(),
        initial
    );

    let prefunded = NativeAccountObservation {
        lamports: 12_000,
        ..target
    };
    let prefunded_intent = prepare_create_state_account(
        &gate,
        &binding,
        &payer,
        prefunded,
        identity,
        StrictStateValue::Eligibility(initial),
        50_000,
    )
    .unwrap();
    let StateWriteIntent::Create(prefunded_create) = prefunded_intent else {
        unreachable!()
    };
    assert_eq!(
        prefunded_create.lifecycle(),
        CreatePdaLifecycle::AllocateAssignAndFund
    );
    assert_eq!(prefunded_create.funding_lamports(), 38_000);
    let batch = seal_atomic_write_batch(&gate, &binding, [prefunded_intent]).unwrap();
    validate_atomic_write_preconditions(&gate, &binding, batch, &[prefunded], &[payer_account])
        .unwrap();
    assert_eq!(
        validate_atomic_write_preconditions(&gate, &binding, batch, &[prefunded], &[]),
        Err(NativeAdapterError::PayerObservationCountMismatch)
    );
    assert_eq!(
        validate_atomic_write_preconditions(
            &gate,
            &binding,
            batch,
            &[prefunded],
            &[NativeAccountObservation {
                owner: ECONOMY_PROGRAM,
                ..payer_account
            }],
        ),
        Err(NativeAdapterError::PayerMustBeSystemOwned)
    );
    assert_eq!(
        validate_atomic_write_preconditions(
            &gate,
            &binding,
            batch,
            &[prefunded],
            &[NativeAccountObservation {
                data: &[1],
                ..payer_account
            }],
        ),
        Err(NativeAdapterError::PayerDataMustBeEmpty)
    );
    assert_eq!(
        validate_atomic_write_preconditions(
            &gate,
            &binding,
            batch,
            &[prefunded],
            &[NativeAccountObservation {
                lamports: payer_account.lamports - 1,
                ..payer_account
            }],
        ),
        Err(NativeAdapterError::PayerPreimageMismatch)
    );
    assert_eq!(
        validate_atomic_write_preconditions(
            &gate,
            &binding,
            batch,
            &[NativeAccountObservation {
                lamports: 12_001,
                ..prefunded
            }],
            &[payer_account],
        ),
        Err(NativeAdapterError::PreimageMismatch)
    );

    let second_operator = [0xA7; 32];
    let second_identity = PdaIdentity::Eligibility {
        config,
        operator: second_operator,
    };
    let second_pda = derive_pda(&binding, second_identity).unwrap();
    let second_state = EligibilityState {
        config,
        wallet: second_operator,
        agency_index: u32::MAX,
        role: 0,
        bump: second_pda.bump,
    };
    let second_target = NativeAccountObservation {
        key: second_pda.key,
        ..target
    };
    let high_funding_first = prepare_create_state_account(
        &gate,
        &binding,
        &payer,
        target,
        identity,
        StrictStateValue::Eligibility(initial),
        5_000_000,
    )
    .unwrap();
    let high_funding_second = prepare_create_state_account(
        &gate,
        &binding,
        &payer,
        second_target,
        second_identity,
        StrictStateValue::Eligibility(second_state),
        5_000_000,
    )
    .unwrap();
    assert_eq!(
        seal_atomic_write_batch(&gate, &binding, [high_funding_first, high_funding_second],),
        Err(NativeAdapterError::InsufficientPayerBalance)
    );

    assert_eq!(
        prepare_create_state_account(
            &gate,
            &binding,
            &payer,
            NativeAccountObservation {
                data: &[1],
                ..target
            },
            identity,
            StrictStateValue::Eligibility(initial),
            50_000,
        ),
        Err(NativeAdapterError::VacantAccountDataNotEmpty)
    );
    assert_eq!(
        prepare_create_state_account(
            &gate,
            &binding,
            &payer,
            target,
            identity,
            StrictStateValue::Eligibility(initial),
            0,
        ),
        Err(NativeAdapterError::RentMinimumMustBePositive)
    );
    assert_eq!(
        authenticate_signer(
            &gate,
            &binding,
            NativeAccountObservation {
                is_signer: false,
                ..payer_account
            },
            payer_key,
            true,
        ),
        Err(NativeAdapterError::MissingRequiredSignature)
    );
    assert_eq!(
        authenticate_system_payer(
            &gate,
            &binding,
            NativeAccountObservation {
                owner: ECONOMY_PROGRAM,
                ..payer_account
            },
            payer_key,
        ),
        Err(NativeAdapterError::PayerMustBeSystemOwned)
    );
    assert_eq!(
        authenticate_system_payer(
            &gate,
            &binding,
            NativeAccountObservation {
                data: &[1],
                ..payer_account
            },
            payer_key,
        ),
        Err(NativeAdapterError::PayerDataMustBeEmpty)
    );
}

fn independently_derive(identity: PdaIdentity) -> ([u8; 32], u8) {
    let program = Pubkey::new_from_array(ECONOMY_PROGRAM);
    let (key, bump) = match identity {
        PdaIdentity::Config { mint } => Pubkey::find_program_address(&[b"config", &mint], &program),
        PdaIdentity::VaultAuthority { config } => {
            Pubkey::find_program_address(&[b"vault-authority", &config], &program)
        }
        PdaIdentity::LaneState { config, lane } => {
            Pubkey::find_program_address(&[b"lane", &config, &[lane]], &program)
        }
        PdaIdentity::LaneToken { config, lane } => {
            Pubkey::find_program_address(&[b"lane-token", &config, &[lane]], &program)
        }
        PdaIdentity::StakeToken { config } => {
            Pubkey::find_program_address(&[b"stake-token", &config], &program)
        }
        PdaIdentity::StakeIngress { config } => {
            Pubkey::find_program_address(&[b"stake-ingress", &config], &program)
        }
        PdaIdentity::CoreReward { config } => {
            Pubkey::find_program_address(&[b"core-reward", &config], &program)
        }
        PdaIdentity::Agency { config, index } => {
            Pubkey::find_program_address(&[b"agency", &config, &index.to_le_bytes()], &program)
        }
        PdaIdentity::AgencyOwnerIndex { config, owner } => {
            Pubkey::find_program_address(&[b"agency-owner", &config, &owner], &program)
        }
        PdaIdentity::Eligibility { config, operator } => {
            Pubkey::find_program_address(&[b"eligibility", &config, &operator], &program)
        }
        PdaIdentity::Position {
            config,
            operator,
            position_id,
        } => Pubkey::find_program_address(
            &[b"position", &config, &operator, &position_id.to_le_bytes()],
            &program,
        ),
        PdaIdentity::Round { config, week } => {
            Pubkey::find_program_address(&[b"round", &config, &week.to_le_bytes()], &program)
        }
        PdaIdentity::FactionConfig { config } => {
            Pubkey::find_program_address(&[b"faction-config", &config], &program)
        }
        PdaIdentity::FactionAllegiance {
            faction_config,
            operator,
        } => Pubkey::find_program_address(
            &[b"faction-allegiance", &faction_config.key(), &operator],
            &program,
        ),
        PdaIdentity::FactionWeek {
            faction_config,
            week,
        } => Pubkey::find_program_address(
            &[b"faction-week", &faction_config.key(), &week.to_le_bytes()],
            &program,
        ),
        PdaIdentity::FactionScore {
            faction_week,
            faction_id,
        } => Pubkey::find_program_address(
            &[b"faction-score", &faction_week.key(), &[faction_id]],
            &program,
        ),
        PdaIdentity::FactionRewardVault { faction_config } => Pubkey::find_program_address(
            &[b"faction-reward-vault", &faction_config.key()],
            &program,
        ),
        PdaIdentity::FactionRewardManifest { faction_week } => {
            Pubkey::find_program_address(&[b"faction-reward", &faction_week.key()], &program)
        }
        PdaIdentity::FactionFollowerSnapshot {
            faction_week,
            faction_id,
        } => Pubkey::find_program_address(
            &[b"faction-followers", &faction_week.key(), &[faction_id]],
            &program,
        ),
        PdaIdentity::FactionClaim {
            reward_manifest,
            operator,
        } => Pubkey::find_program_address(
            &[b"faction-claim", &reward_manifest.key(), &operator],
            &program,
        ),
    };
    (key.to_bytes(), bump)
}

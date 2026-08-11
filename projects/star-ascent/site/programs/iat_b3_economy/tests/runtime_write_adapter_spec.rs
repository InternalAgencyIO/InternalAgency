#![cfg(feature = "runtime-write-adapter")]

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
use iat_b3_economy::native_adapter::{
    authenticate_state_account, authenticate_system_payer, derive_pda,
    prepare_create_state_account, prepare_existing_state_write, seal_atomic_write_batch,
    AtomicWriteBatch, NativeAccountObservation, NativeAdapterError, NativeEconomyBinding,
    PdaIdentity, StateWriteIntent, StrictStateValue,
};
use iat_b3_economy::runtime_adapter::{
    authenticate_production_active_config_account_info,
    authenticate_production_active_writable_config_account_info, RuntimeAdapterError,
    RuntimeProductionActiveConfig,
};
use iat_b3_economy::runtime_write_adapter::{
    execute_production_active_config_stake_principal_cas_for_completed_ingress,
    execute_production_active_existing_write_batch_account_infos,
    execute_production_completed_ingress_config_and_lanes_cas_account_infos,
    prepare_production_completed_ingress_lane_write_batch_account_infos, RuntimeWriteAdapterError,
    RuntimeWriteAdapterTruth, RUNTIME_WRITE_ADAPTER_TRUTH,
};
use iat_b3_economy::stake_ingress::{CompletedStakeIngress, DelegateSnapshot, SourceTokenState};
use iat_b3_economy::{
    decode_config_genesis_state, decode_lane_state, decode_position_state,
    encode_config_genesis_state, encode_lane_state, encode_position_state, verify_daily_law_open,
    CanonicalDailyLawBinding, ConfigGenesisState, ConfigState, EligibilityState, GenesisPhase,
    LaneState, PositionState, ReadonlyDailyLawAccount, ReadonlyTokenState, ValidatedDailyLawWrite,
    CONFIG_GENESIS_ACCOUNT_LEN, ECOSYSTEM, LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC,
    LAW_STATE_VERSION, LIQUIDITY, MAINNET_SUPPLY, POSITION_ACCOUNT_LEN, TREASURY,
};
use solana_account_info::AccountInfo;
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

fn open_gate(timestamp: i64) -> ValidatedDailyLawWrite {
    let decision = decision_for_inputs(timestamp);
    let data = pack_law_state(decision);
    verify_daily_law_open(
        &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        timestamp,
    )
    .unwrap()
}

fn production_active_config(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
) -> RuntimeProductionActiveConfig {
    let state = ConfigGenesisState {
        phase: GenesisPhase::Active,
        config: ConfigState {
            admin: [0x21; 32],
            mint: MINT,
            token_program: [0x33; 32],
            randomness_program: [0x44; 32],
            stake_token_account: [0x55; 32],
            agency_registry_hash: [0; 32],
            genesis_timestamp: CLOCK_TIMESTAMP - 60,
            expected_supply: MAINNET_SUPPLY,
            staked_principal: 1_000,
            agency_count: 0,
            rehearsal_mode: false,
            active: true,
            lane_mask: 0b1_1110,
            stake_vault_initialized: true,
            bump: binding.config_bump(),
            vault_authority_bump: 202,
        },
    };
    let mut data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&state, &mut data).unwrap();
    let key = binding.config().into();
    let owner = binding.program_id().into();
    let mut lamports = 1;
    let account = AccountInfo::new(&key, false, false, &mut lamports, &mut data, &owner, false);
    authenticate_production_active_config_account_info(gate, binding, &account).unwrap()
}

fn decision_for_inputs(timestamp: i64) -> SolanaDailyDecision {
    let local_day = protocol_local_day(timestamp);
    for candidate in 0u16..=u8::MAX.into() {
        let mut hash = [0u8; 32];
        hash[31] = candidate as u8;
        let decision =
            create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
        if !decision.locked {
            return decision;
        }
    }
    panic!("test vector search did not find an open disposition")
}

fn pack_law_state(decision: SolanaDailyDecision) -> [u8; LAW_STATE_LEN] {
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
    data
}

#[derive(Clone, Copy)]
struct StatePair {
    position_identity: PdaIdentity,
    position: PositionState,
    lane_identity: PdaIdentity,
    lane: LaneState,
}

fn states(binding: &NativeEconomyBinding) -> StatePair {
    let config = binding.config();
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
    StatePair {
        position_identity,
        position,
        lane_identity,
        lane,
    }
}

fn canonical_lane(binding: &NativeEconomyBinding, lane: u8, reserved: u64) -> LaneState {
    let config = binding.config();
    let identity = PdaIdentity::LaneState { config, lane };
    let token = derive_pda(binding, PdaIdentity::LaneToken { config, lane }).unwrap();
    LaneState {
        config,
        token_account: token.key,
        beneficiary: [0xA0 | lane; 32],
        total: 10_000,
        genesis_unlocked: 1_000,
        cliff_week: 0,
        linear_end_week: 104,
        reserved,
        paid: 0,
        principal_claimed: 0,
        lane,
        reward_source: true,
        bump: derive_pda(binding, identity).unwrap().bump,
        token_bump: token.bump,
    }
}

fn completed_ingress(
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    principal: u64,
) -> CompletedStakeIngress {
    let mut config = active_config.state().config;
    config.staked_principal = config.staked_principal.checked_add(principal).unwrap();
    let mut position = states(binding).position;
    position.principal = principal;
    let treasury = canonical_lane(binding, TREASURY, 20);
    let ecosystem = canonical_lane(binding, ECOSYSTEM, 30);
    let liquidity = canonical_lane(binding, LIQUIDITY, 40);
    let stake = ReadonlyTokenState {
        key: config.stake_token_account,
        mint: binding.mint(),
        owner: derive_pda(
            binding,
            PdaIdentity::VaultAuthority {
                config: binding.config(),
            },
        )
        .unwrap()
        .key,
        amount: config.staked_principal,
    };
    CompletedStakeIngress {
        config,
        position,
        treasury,
        ecosystem,
        liquidity,
        source: SourceTokenState {
            token: ReadonlyTokenState {
                key: [0x91; 32],
                mint: binding.mint(),
                owner: OWNER,
                amount: 10_000,
            },
            delegate: DelegateSnapshot {
                delegate: None,
                delegated_amount: 0,
            },
            cpi_guard_locked: false,
        },
        stake,
    }
}

fn prepare_batch(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    states: StatePair,
    position_data: &[u8],
    lane_data: &[u8],
) -> (AtomicWriteBatch<2>, PositionState, LaneState) {
    let position_account = authenticate_state_account(
        gate,
        binding,
        NativeAccountObservation {
            key: derive_pda(binding, states.position_identity).unwrap().key,
            owner: ECONOMY_PROGRAM,
            lamports: 1,
            data: position_data,
            is_signer: false,
            is_writable: true,
            executable: false,
        },
        states.position_identity,
    )
    .unwrap();
    let lane_account = authenticate_state_account(
        gate,
        binding,
        NativeAccountObservation {
            key: derive_pda(binding, states.lane_identity).unwrap().key,
            owner: ECONOMY_PROGRAM,
            lamports: 1,
            data: lane_data,
            is_signer: false,
            is_writable: true,
            executable: false,
        },
        states.lane_identity,
    )
    .unwrap();

    let mut next_position = states.position;
    next_position.paid = 12;
    let mut next_lane = states.lane;
    next_lane.paid = 12;
    let position_intent = prepare_existing_state_write(
        gate,
        binding,
        &position_account,
        StrictStateValue::Position(next_position),
    )
    .unwrap();
    let lane_intent = prepare_existing_state_write(
        gate,
        binding,
        &lane_account,
        StrictStateValue::Lane(next_lane),
    )
    .unwrap();
    (
        seal_atomic_write_batch(gate, binding, [position_intent, lane_intent]).unwrap(),
        next_position,
        next_lane,
    )
}

#[test]
fn existing_state_batch_acquires_every_borrow_and_revalidates_before_writing() {
    let binding = binding();
    let gate = open_gate(CLOCK_TIMESTAMP);
    let active_config = production_active_config(&gate, &binding);
    let states = states(&binding);
    let mut position_data = [0u8; POSITION_ACCOUNT_LEN];
    let mut lane_data = [0u8; LANE_ACCOUNT_LEN];
    encode_position_state(&states.position, &mut position_data).unwrap();
    encode_lane_state(&states.lane, &mut lane_data).unwrap();
    let (batch, next_position, next_lane) =
        prepare_batch(&gate, &binding, states, &position_data, &lane_data);

    let position_key = derive_pda(&binding, states.position_identity)
        .unwrap()
        .key
        .into();
    let lane_key = derive_pda(&binding, states.lane_identity)
        .unwrap()
        .key
        .into();
    let owner = ECONOMY_PROGRAM.into();
    let mut position_lamports = 1;
    let mut lane_lamports = 1;
    let accounts = [
        AccountInfo::new(
            &position_key,
            false,
            true,
            &mut position_lamports,
            &mut position_data,
            &owner,
            false,
        ),
        AccountInfo::new(
            &lane_key,
            false,
            true,
            &mut lane_lamports,
            &mut lane_data,
            &owner,
            false,
        ),
    ];

    assert_eq!(
        execute_production_active_existing_write_batch_account_infos(
            &gate,
            &active_config,
            &binding,
            batch,
            &[],
        ),
        Err(RuntimeWriteAdapterError::AccountCountMismatch)
    );
    let later_gate = open_gate(CLOCK_TIMESTAMP + 1);
    assert_eq!(
        execute_production_active_existing_write_batch_account_infos(
            &later_gate,
            &active_config,
            &binding,
            batch,
            &accounts,
        ),
        Err(RuntimeWriteAdapterError::ActiveConfigCapabilityMismatch)
    );

    let receipt = execute_production_active_existing_write_batch_account_infos(
        &gate,
        &active_config,
        &binding,
        batch,
        &accounts,
    )
    .unwrap();
    assert_eq!(receipt.batch_commitment_sha256(), batch.commitment_sha256());
    assert_eq!(
        decode_position_state(&accounts[0].try_borrow_data().unwrap()).unwrap(),
        next_position
    );
    assert_eq!(
        decode_lane_state(&accounts[1].try_borrow_data().unwrap()).unwrap(),
        next_lane
    );
    assert_ne!(receipt.postimage_sha256()[0], receipt.postimage_sha256()[1]);
}

#[test]
fn stale_preimage_or_late_borrow_conflict_leaves_the_entire_batch_unchanged() {
    let binding = binding();
    let gate = open_gate(CLOCK_TIMESTAMP);
    let active_config = production_active_config(&gate, &binding);
    let states = states(&binding);
    let mut position_data = [0u8; POSITION_ACCOUNT_LEN];
    let mut lane_data = [0u8; LANE_ACCOUNT_LEN];
    encode_position_state(&states.position, &mut position_data).unwrap();
    encode_lane_state(&states.lane, &mut lane_data).unwrap();
    let original_position = position_data;
    let original_lane = lane_data;
    let (batch, _, _) = prepare_batch(&gate, &binding, states, &position_data, &lane_data);

    let position_key = derive_pda(&binding, states.position_identity)
        .unwrap()
        .key
        .into();
    let lane_key = derive_pda(&binding, states.lane_identity)
        .unwrap()
        .key
        .into();
    let owner = ECONOMY_PROGRAM.into();
    let mut position_lamports = 1;
    let mut lane_lamports = 1;
    let accounts = [
        AccountInfo::new(
            &position_key,
            false,
            true,
            &mut position_lamports,
            &mut position_data,
            &owner,
            false,
        ),
        AccountInfo::new(
            &lane_key,
            false,
            true,
            &mut lane_lamports,
            &mut lane_data,
            &owner,
            false,
        ),
    ];

    let held = accounts[1].try_borrow_data().unwrap();
    assert_eq!(
        execute_production_active_existing_write_batch_account_infos(
            &gate,
            &active_config,
            &binding,
            batch,
            &accounts,
        ),
        Err(RuntimeWriteAdapterError::AccountBorrowFailed)
    );
    drop(held);
    assert_eq!(&*accounts[0].try_borrow_data().unwrap(), &original_position);
    assert_eq!(&*accounts[1].try_borrow_data().unwrap(), &original_lane);

    accounts[1].try_borrow_mut_data().unwrap()[20] ^= 1;
    assert_eq!(
        execute_production_active_existing_write_batch_account_infos(
            &gate,
            &active_config,
            &binding,
            batch,
            &accounts,
        ),
        Err(RuntimeWriteAdapterError::Native(
            NativeAdapterError::PreimageMismatch
        ))
    );
    assert_eq!(&*accounts[0].try_borrow_data().unwrap(), &original_position);
}

#[test]
fn production_active_config_cas_changes_only_staked_principal_and_revalidates_preimage() {
    let binding = binding();
    let gate = open_gate(CLOCK_TIMESTAMP);
    let original_state = production_active_config(&gate, &binding).state();
    let mut config_data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&original_state, &mut config_data).unwrap();
    let original_data = config_data;
    let config_key = binding.config().into();
    let owner = binding.program_id().into();
    let mut lamports = 1;
    let account = AccountInfo::new(
        &config_key,
        false,
        true,
        &mut lamports,
        &mut config_data,
        &owner,
        false,
    );
    let active_config =
        authenticate_production_active_writable_config_account_info(&gate, &binding, &account)
            .unwrap();

    let empty_completed = completed_ingress(&active_config, &binding, 0);
    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &gate,
            &active_config,
            &binding,
            &empty_completed,
            &account,
        ),
        Err(RuntimeWriteAdapterError::CompletedStakeIngressMismatch)
    );
    assert_eq!(&*account.try_borrow_data().unwrap(), &original_data);

    let completed = completed_ingress(&active_config, &binding, 250);
    let mut hostile_completed = completed;
    hostile_completed.config.agency_count = 1;
    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &gate,
            &active_config,
            &binding,
            &hostile_completed,
            &account,
        ),
        Err(RuntimeWriteAdapterError::CompletedStakeIngressMismatch)
    );
    assert_eq!(&*account.try_borrow_data().unwrap(), &original_data);

    hostile_completed = completed;
    hostile_completed.ecosystem.lane = TREASURY;
    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &gate,
            &active_config,
            &binding,
            &hostile_completed,
            &account,
        ),
        Err(RuntimeWriteAdapterError::CompletedStakeIngressMismatch)
    );
    assert_eq!(&*account.try_borrow_data().unwrap(), &original_data);

    hostile_completed = completed;
    hostile_completed.stake.owner = binding.config();
    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &gate,
            &active_config,
            &binding,
            &hostile_completed,
            &account,
        ),
        Err(RuntimeWriteAdapterError::CompletedStakeIngressMismatch)
    );
    assert_eq!(&*account.try_borrow_data().unwrap(), &original_data);

    let receipt = execute_production_active_config_stake_principal_cas_for_completed_ingress(
        &gate,
        &active_config,
        &binding,
        &completed,
        &account,
    )
    .unwrap();
    let updated = decode_config_genesis_state(&account.try_borrow_data().unwrap()).unwrap();
    let mut expected = original_state;
    expected.config.staked_principal = 1_250;
    assert_eq!(updated, expected);
    assert_eq!(receipt.config_key(), binding.config());
    assert_eq!(
        receipt.expected_preimage_sha256(),
        active_config.preimage_sha256()
    );
    assert_eq!(receipt.previous_staked_principal(), 1_000);
    assert_eq!(receipt.next_staked_principal(), 1_250);
    assert_eq!(receipt.law_account_sha256(), gate.law_account_sha256());
    assert_ne!(
        receipt.postimage_sha256(),
        receipt.expected_preimage_sha256()
    );

    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &gate,
            &active_config,
            &binding,
            &completed,
            &account,
        ),
        Err(RuntimeWriteAdapterError::ConfigPreimageMismatch)
    );
    assert_eq!(
        decode_config_genesis_state(&account.try_borrow_data().unwrap()).unwrap(),
        expected
    );
}

#[test]
fn production_active_config_cas_rejects_wrong_law_flags_and_borrow_conflicts_without_writes() {
    let binding = binding();
    let gate = open_gate(CLOCK_TIMESTAMP);
    let later_gate = open_gate(CLOCK_TIMESTAMP + 1);
    let original_state = production_active_config(&gate, &binding).state();
    let mut config_data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&original_state, &mut config_data).unwrap();
    let original_data = config_data;
    let config_key = binding.config().into();
    let owner = binding.program_id().into();
    let mut lamports = 1;
    let account = AccountInfo::new(
        &config_key,
        false,
        true,
        &mut lamports,
        &mut config_data,
        &owner,
        false,
    );
    let active_config =
        authenticate_production_active_writable_config_account_info(&gate, &binding, &account)
            .unwrap();

    let completed = completed_ingress(&active_config, &binding, 1);
    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &later_gate,
            &active_config,
            &binding,
            &completed,
            &account,
        ),
        Err(RuntimeWriteAdapterError::ActiveConfigCapabilityMismatch)
    );
    let held = account.try_borrow_data().unwrap();
    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &gate,
            &active_config,
            &binding,
            &completed,
            &account,
        ),
        Err(RuntimeWriteAdapterError::AccountBorrowFailed)
    );
    drop(held);
    assert_eq!(&*account.try_borrow_data().unwrap(), &original_data);

    let mut readonly_data = original_data;
    let mut readonly_lamports = 1;
    let readonly = AccountInfo::new(
        &config_key,
        false,
        false,
        &mut readonly_lamports,
        &mut readonly_data,
        &owner,
        false,
    );
    assert_eq!(
        authenticate_production_active_writable_config_account_info(&gate, &binding, &readonly),
        Err(RuntimeAdapterError::ConfigAccountMustBeWritable)
    );
    assert_eq!(
        execute_production_active_config_stake_principal_cas_for_completed_ingress(
            &gate,
            &active_config,
            &binding,
            &completed,
            &readonly,
        ),
        Err(RuntimeWriteAdapterError::ConfigAccountFlagsMismatch)
    );
    assert_eq!(&*readonly.try_borrow_data().unwrap(), &original_data);
}

#[test]
fn completed_ingress_lane_preflight_authenticates_exact_account_order_and_seals_postimages() {
    let binding = binding();
    let gate = open_gate(CLOCK_TIMESTAMP);
    let template = production_active_config(&gate, &binding);
    let mut config_data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&template.state(), &mut config_data).unwrap();
    let original_config_data = config_data;
    let config_key = binding.config().into();
    let owner = binding.program_id().into();
    let mut config_lamports = 1;
    let config_account = AccountInfo::new(
        &config_key,
        false,
        true,
        &mut config_lamports,
        &mut config_data,
        &owner,
        false,
    );
    let active_config = authenticate_production_active_writable_config_account_info(
        &gate,
        &binding,
        &config_account,
    )
    .unwrap();
    let completed = completed_ingress(&active_config, &binding, 250);

    let current = [
        canonical_lane(&binding, TREASURY, 0),
        canonical_lane(&binding, ECOSYSTEM, 0),
        canonical_lane(&binding, LIQUIDITY, 0),
    ];
    let mut treasury_data = [0u8; LANE_ACCOUNT_LEN];
    let mut ecosystem_data = [0u8; LANE_ACCOUNT_LEN];
    let mut liquidity_data = [0u8; LANE_ACCOUNT_LEN];
    encode_lane_state(&current[0], &mut treasury_data).unwrap();
    encode_lane_state(&current[1], &mut ecosystem_data).unwrap();
    encode_lane_state(&current[2], &mut liquidity_data).unwrap();
    let original_treasury_data = treasury_data;
    let original_ecosystem_data = ecosystem_data;
    let original_liquidity_data = liquidity_data;
    let treasury_key = derive_pda(
        &binding,
        PdaIdentity::LaneState {
            config: binding.config(),
            lane: TREASURY,
        },
    )
    .unwrap()
    .key
    .into();
    let ecosystem_key = derive_pda(
        &binding,
        PdaIdentity::LaneState {
            config: binding.config(),
            lane: ECOSYSTEM,
        },
    )
    .unwrap()
    .key
    .into();
    let liquidity_key = derive_pda(
        &binding,
        PdaIdentity::LaneState {
            config: binding.config(),
            lane: LIQUIDITY,
        },
    )
    .unwrap()
    .key
    .into();
    let mut treasury_lamports = 1;
    let mut ecosystem_lamports = 1;
    let mut liquidity_lamports = 1;
    let treasury = AccountInfo::new(
        &treasury_key,
        false,
        true,
        &mut treasury_lamports,
        &mut treasury_data,
        &owner,
        false,
    );
    let ecosystem = AccountInfo::new(
        &ecosystem_key,
        false,
        true,
        &mut ecosystem_lamports,
        &mut ecosystem_data,
        &owner,
        false,
    );
    let liquidity = AccountInfo::new(
        &liquidity_key,
        false,
        true,
        &mut liquidity_lamports,
        &mut liquidity_data,
        &owner,
        false,
    );

    assert_eq!(
        prepare_production_completed_ingress_lane_write_batch_account_infos(
            &gate,
            &active_config,
            &binding,
            &completed,
            [&ecosystem, &treasury, &liquidity],
        ),
        Err(RuntimeWriteAdapterError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::AccountKeyMismatch)
        ))
    );

    let batch = prepare_production_completed_ingress_lane_write_batch_account_infos(
        &gate,
        &active_config,
        &binding,
        &completed,
        [&treasury, &ecosystem, &liquidity],
    )
    .unwrap();
    for (intent, expected) in
        batch
            .intents()
            .iter()
            .zip([completed.treasury, completed.ecosystem, completed.liquidity])
    {
        let StateWriteIntent::Existing(existing) = intent else {
            panic!("completed lane preflight emitted a create intent");
        };
        assert_eq!(decode_lane_state(existing.postimage()).unwrap(), expected);
    }

    let held = ecosystem.try_borrow_data().unwrap();
    assert_eq!(
        execute_production_completed_ingress_config_and_lanes_cas_account_infos(
            &gate,
            &active_config,
            &binding,
            &completed,
            &config_account,
            [&treasury, &ecosystem, &liquidity],
        ),
        Err(RuntimeWriteAdapterError::AccountBorrowFailed)
    );
    drop(held);
    assert_eq!(
        &*config_account.try_borrow_data().unwrap(),
        &original_config_data
    );
    assert_eq!(
        &*treasury.try_borrow_data().unwrap(),
        &original_treasury_data
    );
    assert_eq!(
        &*ecosystem.try_borrow_data().unwrap(),
        &original_ecosystem_data
    );
    assert_eq!(
        &*liquidity.try_borrow_data().unwrap(),
        &original_liquidity_data
    );

    let receipt = execute_production_completed_ingress_config_and_lanes_cas_account_infos(
        &gate,
        &active_config,
        &binding,
        &completed,
        &config_account,
        [&treasury, &ecosystem, &liquidity],
    )
    .unwrap();
    assert_eq!(receipt.config().next_staked_principal(), 1_250);
    assert_eq!(
        receipt.lanes().batch_commitment_sha256(),
        batch.commitment_sha256()
    );
    assert_eq!(
        decode_config_genesis_state(&config_account.try_borrow_data().unwrap())
            .unwrap()
            .config,
        completed.config
    );
    for (account, expected) in [
        (&treasury, completed.treasury),
        (&ecosystem, completed.ecosystem),
        (&liquidity, completed.liquidity),
    ] {
        assert_eq!(
            decode_lane_state(&account.try_borrow_data().unwrap()).unwrap(),
            expected
        );
    }
}

#[test]
fn public_surface_remains_narrow_and_fail_closed() {
    assert_eq!(
        RUNTIME_WRITE_ADAPTER_TRUTH,
        RuntimeWriteAdapterTruth {
            feature_gated: true,
            daily_law_capability_required: true,
            production_active_config_capability_required: true,
            authenticated_existing_state_only: true,
            all_mutable_borrows_acquired_before_write: true,
            all_preimages_revalidated_before_write: true,
            account_data_writes_supported: true,
            production_active_config_stake_principal_cas_supported: true,
            production_completed_ingress_lane_account_preflight_supported: true,
            production_completed_ingress_config_and_lanes_atomic_cas_supported: true,
            account_creation_supported: false,
            lamport_writes_supported: false,
            system_cpi_supported: false,
            token_cpi_supported: false,
            instruction_abi_frozen: false,
            entrypoint_exposed: false,
            dispatcher_exposed: false,
            any_handler_complete: false,
            mainnet_hold: true,
        }
    );
}

#[test]
fn account_creation_intents_are_rejected_before_any_borrow_or_cpi() {
    let binding = binding();
    let gate = open_gate(CLOCK_TIMESTAMP);
    let active_config = production_active_config(&gate, &binding);
    let payer_key = [0x77; 32];
    let payer = authenticate_system_payer(
        &gate,
        &binding,
        NativeAccountObservation {
            key: payer_key,
            owner: system_program::ID.to_bytes(),
            lamports: 1_000_000,
            data: &[],
            is_signer: true,
            is_writable: true,
            executable: false,
        },
        payer_key,
    )
    .unwrap();
    let identity = PdaIdentity::Eligibility {
        config: binding.config(),
        operator: OWNER,
    };
    let derived = derive_pda(&binding, identity).unwrap();
    let create = prepare_create_state_account(
        &gate,
        &binding,
        &payer,
        NativeAccountObservation {
            key: derived.key,
            owner: system_program::ID.to_bytes(),
            lamports: 0,
            data: &[],
            is_signer: false,
            is_writable: true,
            executable: false,
        },
        identity,
        StrictStateValue::Eligibility(EligibilityState {
            config: binding.config(),
            wallet: OWNER,
            agency_index: u32::MAX,
            role: 0,
            bump: derived.bump,
        }),
        1,
    )
    .unwrap();
    let batch = seal_atomic_write_batch(&gate, &binding, [create]).unwrap();

    let key = derived.key.into();
    let owner = system_program::ID;
    let mut lamports = 0;
    let mut data = [];
    let account = AccountInfo::new(&key, false, true, &mut lamports, &mut data, &owner, false);
    assert_eq!(
        execute_production_active_existing_write_batch_account_infos(
            &gate,
            &active_config,
            &binding,
            batch,
            &[account],
        ),
        Err(RuntimeWriteAdapterError::CreateIntentUnsupported)
    );
}

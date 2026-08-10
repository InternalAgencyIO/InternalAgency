#![cfg(feature = "runtime-account-bridge")]

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
use iat_b3_economy::native_adapter::{
    derive_pda, NativeAdapterError, NativeEconomyBinding, PdaIdentity, StateWriteIntent,
    StrictStateKind, StrictStateValue,
};
use iat_b3_economy::runtime_adapter::*;
use iat_b3_economy::{
    encode_agency_owner_index_state, encode_agency_state, encode_core_reward_state,
    encode_eligibility_state, encode_lane_state, encode_position_state, encode_round_state,
    verify_daily_law_open, AgencyOwnerIndexState, AgencyState, CanonicalDailyLawBinding,
    CoreRewardState, EconomyError, EligibilityState, LaneState, PositionState,
    ReadonlyDailyLawAccount, RoundState, ValidatedDailyLawWrite, AGENCY_ACCOUNT_LEN,
    AGENCY_OWNER_INDEX_ACCOUNT_LEN, CORE_REWARD_ACCOUNT_LEN, ELIGIBILITY_ACCOUNT_LEN,
    LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, POSITION_ACCOUNT_LEN,
    ROUND_ACCOUNT_LEN, ROUND_PENDING,
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

fn economy_binding() -> NativeEconomyBinding {
    NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
}

fn daily_law_binding() -> CanonicalDailyLawBinding {
    CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK)
}

fn open_gate() -> ValidatedDailyLawWrite {
    let decision = decision_for_inputs(CLOCK_TIMESTAMP, false);
    let data = pack_law_state(Some(decision));
    verify_daily_law_open(
        &daily_law_binding(),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        CLOCK_TIMESTAMP,
    )
    .unwrap()
}

fn decision_for_inputs(timestamp: i64, locked: bool) -> SolanaDailyDecision {
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

#[allow(clippy::too_many_arguments)]
fn with_account<T>(
    key_bytes: [u8; 32],
    owner_bytes: [u8; 32],
    lamports_value: u64,
    data: &mut [u8],
    is_signer: bool,
    is_writable: bool,
    executable: bool,
    operation: impl FnOnce(&AccountInfo<'_>) -> T,
) -> T {
    let key = key_bytes.into();
    let owner = owner_bytes.into();
    let mut lamports = lamports_value;
    let account = AccountInfo::new(
        &key,
        is_signer,
        is_writable,
        &mut lamports,
        data,
        &owner,
        executable,
    );
    operation(&account)
}

fn strict_state_cases(
    binding: &NativeEconomyBinding,
) -> Vec<(PdaIdentity, StrictStateValue, Vec<u8>)> {
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
    let mut data = vec![0; state.kind().account_len()];
    match state {
        StrictStateValue::Position(value) => encode_position_state(&value, &mut data).unwrap(),
        StrictStateValue::Lane(value) => encode_lane_state(&value, &mut data).unwrap(),
        StrictStateValue::Round(value) => encode_round_state(&value, &mut data).unwrap(),
        StrictStateValue::CoreReward(value) => encode_core_reward_state(&value, &mut data).unwrap(),
        StrictStateValue::Agency(value) => encode_agency_state(&value, &mut data).unwrap(),
        StrictStateValue::AgencyOwnerIndex(value) => {
            encode_agency_owner_index_state(&value, &mut data).unwrap()
        }
        StrictStateValue::Eligibility(value) => {
            encode_eligibility_state(&value, &mut data).unwrap()
        }
    }
    data
}

#[test]
fn runtime_truth_is_explicitly_read_only_and_nonactivating() {
    assert_eq!(
        RUNTIME_ACCOUNT_BRIDGE_TRUTH,
        RuntimeAccountBridgeTruth {
            feature_gated: true,
            account_info_reads: true,
            clock_sysvar_authenticated: true,
            rent_sysvar_authenticated: true,
            mutable_account_borrows: false,
            account_writes_executed: false,
            system_cpi_executed: false,
            token_cpi_executed: false,
            instruction_abi_frozen: false,
            entrypoint_exposed: false,
            dispatcher_exposed: false,
            production_identity_binding_frozen: false,
            config_codec_supported: false,
            any_handler_complete: false,
            mainnet_hold: true,
        }
    );
    assert_eq!(
        StrictStateKind::Position.account_len(),
        POSITION_ACCOUNT_LEN
    );
    assert_eq!(StrictStateKind::Lane.account_len(), LANE_ACCOUNT_LEN);
    assert_eq!(StrictStateKind::Round.account_len(), ROUND_ACCOUNT_LEN);
    assert_eq!(
        StrictStateKind::CoreReward.account_len(),
        CORE_REWARD_ACCOUNT_LEN
    );
    assert_eq!(StrictStateKind::Agency.account_len(), AGENCY_ACCOUNT_LEN);
    assert_eq!(
        StrictStateKind::AgencyOwnerIndex.account_len(),
        AGENCY_OWNER_INDEX_ACCOUNT_LEN
    );
    assert_eq!(
        StrictStateKind::Eligibility.account_len(),
        ELIGIBILITY_ACCOUNT_LEN
    );
}

#[test]
fn real_account_info_authenticates_all_seven_strict_state_codecs() {
    let gate = open_gate();
    let binding = economy_binding();
    for (identity, state, mut data) in strict_state_cases(&binding) {
        let key = derive_pda(&binding, identity).unwrap().key;
        let authenticated = with_account(
            key,
            ECONOMY_PROGRAM,
            1_000_000,
            &mut data,
            false,
            true,
            false,
            |account| authenticate_state_account_info(&gate, &binding, account, identity),
        )
        .unwrap();
        assert_eq!(authenticated.state(), state);

        let unchanged = with_account(
            key,
            ECONOMY_PROGRAM,
            1_000_000,
            &mut data,
            false,
            true,
            false,
            |account| {
                prepare_existing_state_write_account_info(&gate, &binding, account, identity, state)
            },
        )
        .unwrap();
        assert!(matches!(unchanged, StateWriteIntent::Existing(_)));
    }
}

#[test]
fn state_bridge_rejects_wrong_owner_flags_corruption_and_borrow_conflicts() {
    let gate = open_gate();
    let binding = economy_binding();
    let (identity, _, mut data) = strict_state_cases(&binding).remove(0);
    let key = derive_pda(&binding, identity).unwrap().key;

    let wrong_owner = with_account(
        key,
        [0xEE; 32],
        1,
        &mut data,
        false,
        true,
        false,
        |account| authenticate_state_account_info(&gate, &binding, account, identity),
    );
    assert_eq!(
        wrong_owner,
        Err(RuntimeAdapterError::Native(
            NativeAdapterError::AccountOwnerMismatch
        ))
    );

    let signer_pda = with_account(
        key,
        ECONOMY_PROGRAM,
        1,
        &mut data,
        true,
        true,
        false,
        |account| authenticate_state_account_info(&gate, &binding, account, identity),
    );
    assert_eq!(
        signer_pda,
        Err(RuntimeAdapterError::Native(
            NativeAdapterError::PdaAccountMustNotBeSigner
        ))
    );

    data[0] ^= 0xFF;
    let corrupt = with_account(
        key,
        ECONOMY_PROGRAM,
        1,
        &mut data,
        false,
        true,
        false,
        |account| authenticate_state_account_info(&gate, &binding, account, identity),
    );
    assert!(matches!(
        corrupt,
        Err(RuntimeAdapterError::Native(NativeAdapterError::Codec(_)))
    ));
    data[0] ^= 0xFF;

    let borrow_conflict = with_account(
        key,
        ECONOMY_PROGRAM,
        1,
        &mut data,
        false,
        true,
        false,
        |account| {
            let _borrow = account.try_borrow_mut_data().unwrap();
            authenticate_state_account_info(&gate, &binding, account, identity)
        },
    );
    assert_eq!(
        borrow_conflict,
        Err(RuntimeAdapterError::AccountBorrowFailed)
    );
}

#[test]
fn signer_and_system_payer_facts_come_from_real_account_info() {
    let gate = open_gate();
    let binding = economy_binding();
    let mut empty = [];
    let signer = with_account(
        OWNER,
        system_program::id().to_bytes(),
        900_000,
        &mut empty,
        true,
        true,
        false,
        |account| authenticate_signer_account_info(&gate, &binding, account, OWNER, true),
    )
    .unwrap();
    assert_eq!(signer.key(), OWNER);
    assert!(signer.is_writable());

    let payer = with_account(
        OWNER,
        system_program::id().to_bytes(),
        900_000,
        &mut empty,
        true,
        true,
        false,
        |account| authenticate_system_payer_account_info(&gate, &binding, account, OWNER),
    )
    .unwrap();
    assert_eq!(payer.key(), OWNER);
    assert_eq!(payer.lamports(), 900_000);

    let missing_signature = with_account(
        OWNER,
        system_program::id().to_bytes(),
        900_000,
        &mut empty,
        false,
        true,
        false,
        |account| authenticate_system_payer_account_info(&gate, &binding, account, OWNER),
    );
    assert_eq!(
        missing_signature,
        Err(RuntimeAdapterError::Native(
            NativeAdapterError::MissingRequiredSignature
        ))
    );
}

#[test]
fn public_sysvar_paths_fail_closed_on_an_unstubbed_host() {
    let mut law_data = pack_law_state(Some(decision_for_inputs(CLOCK_TIMESTAMP, false)));
    let law_result = with_account(
        LAW_STATE,
        LAW_PROGRAM,
        1,
        &mut law_data,
        false,
        false,
        false,
        |account| verify_daily_law_open_account_info(&daily_law_binding(), account),
    );
    assert_eq!(law_result, Err(RuntimeAdapterError::ClockSysvarUnavailable));

    let mut wrong_header_data = law_data;
    let wrong_header = with_account(
        [0x99; 32],
        LAW_PROGRAM,
        1,
        &mut wrong_header_data,
        false,
        false,
        false,
        |account| verify_daily_law_open_account_info(&daily_law_binding(), account),
    );
    assert_eq!(
        wrong_header,
        Err(RuntimeAdapterError::Economy(
            EconomyError::NonCanonicalDailyLawAccount
        ))
    );

    let gate = open_gate();
    let binding = economy_binding();
    let (identity, initial_state, _) = strict_state_cases(&binding).remove(0);
    let target_key = derive_pda(&binding, identity).unwrap().key;
    let mut payer_data = [];
    let mut target_data = [];
    let payer_key = OWNER.into();
    let payer_owner = system_program::id().to_bytes().into();
    let target_key_address = target_key.into();
    let target_owner = system_program::id().to_bytes().into();
    let mut payer_lamports = 10_000_000;
    let mut target_lamports = 0;
    let payer = AccountInfo::new(
        &payer_key,
        true,
        true,
        &mut payer_lamports,
        &mut payer_data,
        &payer_owner,
        false,
    );
    let target = AccountInfo::new(
        &target_key_address,
        false,
        true,
        &mut target_lamports,
        &mut target_data,
        &target_owner,
        false,
    );
    assert_eq!(
        prepare_create_state_account_info(
            &gate,
            &binding,
            &payer,
            OWNER,
            &target,
            identity,
            initial_state,
        ),
        Err(RuntimeAdapterError::RentSysvarUnavailable)
    );
}

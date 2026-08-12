#![cfg(feature = "runtime-write-adapter")]

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
use iat_b3_economy::native_adapter::{
    derive_pda, NativeAdapterError, NativeEconomyBinding, PdaIdentity,
};
use iat_b3_economy::production_close_position::*;
use iat_b3_economy::production_instruction::{
    encode_production_instruction, ProductionInstruction, PRODUCTION_INSTRUCTION_LEN,
};
use iat_b3_economy::runtime_adapter::RuntimeAdapterError;
use iat_b3_economy::{
    decode_lane_state, decode_position_state, encode_config_genesis_state, encode_lane_state,
    encode_position_state, verify_daily_law_open, CanonicalDailyLawBinding, ConfigGenesisState,
    ConfigState, EconomyError, GenesisPhase, LaneState, PositionState, ReadonlyDailyLawAccount,
    ValidatedDailyLawWrite, CONFIG_GENESIS_ACCOUNT_LEN, ECOSYSTEM, LANE_ACCOUNT_LEN, LAW_STATE_LEN,
    LAW_STATE_MAGIC, LAW_STATE_VERSION, LIQUIDITY, MAINNET_SUPPLY, POSITION_ACCOUNT_LEN, TREASURY,
    USER_TERM_WEEKS,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;

const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
const LAW_STATE: [u8; 32] = [0x51; 32];
const LAW_BUMP: u8 = 254;
const MINT: [u8; 32] = [0x22; 32];
const NETWORK: [u8; 32] = [0x11; 32];
const POSITION_OWNER: [u8; 32] = [0xA1; 32];
const UNRELATED_CALLER: [u8; 32] = [0xA2; 32];
const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

fn binding() -> NativeEconomyBinding {
    NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
}

fn open_gate() -> ValidatedDailyLawWrite {
    let decision = open_decision(CLOCK_TIMESTAMP);
    let data = pack_law_state(decision);
    verify_daily_law_open(
        &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        CLOCK_TIMESTAMP,
    )
    .unwrap()
}

fn open_decision(timestamp: i64) -> SolanaDailyDecision {
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

fn encoded(instruction: ProductionInstruction) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
    let mut data = [0u8; PRODUCTION_INSTRUCTION_LEN];
    encode_production_instruction(instruction, &mut data).unwrap();
    data
}

struct TestAccount {
    key: Pubkey,
    owner: Pubkey,
    lamports: u64,
    data: Vec<u8>,
    is_signer: bool,
    is_writable: bool,
}

impl TestAccount {
    fn new(
        key: [u8; 32],
        owner: [u8; 32],
        data: Vec<u8>,
        is_signer: bool,
        is_writable: bool,
    ) -> Self {
        Self {
            key: key.into(),
            owner: owner.into(),
            lamports: 1,
            data,
            is_signer,
            is_writable,
        }
    }

    fn info(&mut self) -> AccountInfo<'_> {
        AccountInfo::new(
            &self.key,
            self.is_signer,
            self.is_writable,
            &mut self.lamports,
            &mut self.data,
            &self.owner,
            false,
        )
    }
}

struct Fixture {
    caller: TestAccount,
    config: TestAccount,
    position: TestAccount,
    treasury: TestAccount,
    ecosystem: TestAccount,
    liquidity: TestAccount,
}

impl Fixture {
    fn new(binding: &NativeEconomyBinding) -> Self {
        let config_key = binding.config();
        let config_state = ConfigGenesisState {
            phase: GenesisPhase::Active,
            config: ConfigState {
                admin: [0x21; 32],
                mint: MINT,
                token_program: [0x33; 32],
                randomness_program: [0x44; 32],
                stake_token_account: [0x55; 32],
                agency_registry_hash: [0x66; 32],
                genesis_timestamp: CLOCK_TIMESTAMP - 60,
                expected_supply: MAINNET_SUPPLY,
                staked_principal: 1_000,
                agency_count: 2,
                rehearsal_mode: false,
                active: true,
                lane_mask: 0b1_1110,
                stake_vault_initialized: true,
                bump: binding.config_bump(),
                vault_authority_bump: 202,
            },
        };
        let mut config_data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
        encode_config_genesis_state(&config_state, &mut config_data).unwrap();

        let position_identity = PdaIdentity::Position {
            config: config_key,
            operator: POSITION_OWNER,
            position_id: 7,
        };
        let position_derived = derive_pda(binding, position_identity).unwrap();
        let position = PositionState {
            config: config_key,
            owner: POSITION_OWNER,
            position_id: 7,
            principal: 500,
            accepted_week: 1,
            first_accrual_week: 2,
            term_weeks: USER_TERM_WEEKS,
            annual_rate_bps: 700,
            treasury_reserved: 3,
            ecosystem_reserved: 5,
            liquidity_reserved: 8,
            paid: 77,
            settled_mask: (1u64 << USER_TERM_WEEKS) - 1,
            agency_index: 0,
            role: 0,
            principal_returned: true,
            closed: false,
            bump: position_derived.bump,
        };
        let mut position_data = [0u8; POSITION_ACCOUNT_LEN];
        encode_position_state(&position, &mut position_data).unwrap();

        let (treasury_key, treasury_data) = lane(binding, TREASURY, 13);
        let (ecosystem_key, ecosystem_data) = lane(binding, ECOSYSTEM, 17);
        let (liquidity_key, liquidity_data) = lane(binding, LIQUIDITY, 23);

        Self {
            caller: TestAccount::new(UNRELATED_CALLER, [0x99; 32], Vec::new(), true, false),
            config: TestAccount::new(
                config_key,
                ECONOMY_PROGRAM,
                config_data.to_vec(),
                false,
                false,
            ),
            position: TestAccount::new(
                position_derived.key,
                ECONOMY_PROGRAM,
                position_data.to_vec(),
                false,
                true,
            ),
            treasury: TestAccount::new(treasury_key, ECONOMY_PROGRAM, treasury_data, false, true),
            ecosystem: TestAccount::new(
                ecosystem_key,
                ECONOMY_PROGRAM,
                ecosystem_data,
                false,
                true,
            ),
            liquidity: TestAccount::new(
                liquidity_key,
                ECONOMY_PROGRAM,
                liquidity_data,
                false,
                true,
            ),
        }
    }

    fn with_infos<R>(&mut self, operation: impl FnOnce(&mut [AccountInfo<'_>; 6]) -> R) -> R {
        let mut infos = [
            self.caller.info(),
            self.config.info(),
            self.position.info(),
            self.treasury.info(),
            self.ecosystem.info(),
            self.liquidity.info(),
        ];
        operation(&mut infos)
    }

    fn write_bytes(&self) -> [Vec<u8>; 4] {
        [
            self.position.data.clone(),
            self.treasury.data.clone(),
            self.ecosystem.data.clone(),
            self.liquidity.data.clone(),
        ]
    }
}

fn lane(binding: &NativeEconomyBinding, lane: u8, reserved: u64) -> ([u8; 32], Vec<u8>) {
    let config = binding.config();
    let identity = PdaIdentity::LaneState { config, lane };
    let derived = derive_pda(binding, identity).unwrap();
    let token = derive_pda(binding, PdaIdentity::LaneToken { config, lane }).unwrap();
    let state = LaneState {
        config,
        token_account: token.key,
        beneficiary: [0xA0 | lane; 32],
        total: 10_000,
        genesis_unlocked: 1_000,
        cliff_week: 0,
        linear_end_week: 104,
        reserved,
        paid: 10,
        principal_claimed: 0,
        lane,
        reward_source: true,
        bump: derived.bump,
        token_bump: token.bump,
    };
    let mut data = [0u8; LANE_ACCOUNT_LEN];
    encode_lane_state(&state, &mut data).unwrap();
    (derived.key, data.to_vec())
}

#[test]
fn exact_close_position_path_atomically_commits_all_four_retained_v2_postimages() {
    let binding = binding();
    let gate = open_gate();
    let instruction = encoded(ProductionInstruction::ClosePosition);
    let mut fixture = Fixture::new(&binding);
    let original_config = fixture.config.data.clone();

    let receipt = fixture
        .with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &instruction, accounts)
        })
        .unwrap();

    assert_eq!(receipt.caller(), UNRELATED_CALLER);
    assert_eq!(receipt.position(), fixture.position.key.to_bytes());
    assert_ne!(receipt.writes().batch_commitment_sha256(), [0; 32]);
    assert_eq!(receipt.writes().postimage_sha256().len(), 4);
    assert_eq!(fixture.config.data, original_config);

    let position = decode_position_state(&fixture.position.data).unwrap();
    assert_eq!(position.owner, POSITION_OWNER);
    assert!(position.closed);
    assert_eq!(position.treasury_reserved, 0);
    assert_eq!(position.ecosystem_reserved, 0);
    assert_eq!(position.liquidity_reserved, 0);
    assert_eq!(
        decode_lane_state(&fixture.treasury.data).unwrap().reserved,
        10
    );
    assert_eq!(
        decode_lane_state(&fixture.ecosystem.data).unwrap().reserved,
        12
    );
    assert_eq!(
        decode_lane_state(&fixture.liquidity.data).unwrap().reserved,
        15
    );
}

#[test]
fn wrong_instruction_count_signer_flags_and_lane_order_fail_without_any_write() {
    let binding = binding();
    let gate = open_gate();
    let close = encoded(ProductionInstruction::ClosePosition);

    let mut wrong_instruction = Fixture::new(&binding);
    let before = wrong_instruction.write_bytes();
    let activate = encoded(ProductionInstruction::Activate);
    assert_eq!(
        wrong_instruction.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &activate, accounts)
        }),
        Err(ProductionClosePositionError::WrongInstruction)
    );
    assert_eq!(wrong_instruction.write_bytes(), before);

    let mut wrong_count = Fixture::new(&binding);
    let before = wrong_count.write_bytes();
    assert_eq!(
        wrong_count.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, &accounts[..5])
        }),
        Err(ProductionClosePositionError::AccountCountMismatch)
    );
    assert_eq!(wrong_count.write_bytes(), before);

    let mut missing_signer = Fixture::new(&binding);
    missing_signer.caller.is_signer = false;
    let before = missing_signer.write_bytes();
    assert_eq!(
        missing_signer.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::MissingRequiredSignature)
        ))
    );
    assert_eq!(missing_signer.write_bytes(), before);

    let mut writable_signer = Fixture::new(&binding);
    writable_signer.caller.is_writable = true;
    let before = writable_signer.write_bytes();
    assert_eq!(
        writable_signer.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::CallerMustBeReadonly)
    );
    assert_eq!(writable_signer.write_bytes(), before);

    let mut swapped_lanes = Fixture::new(&binding);
    let before = swapped_lanes.write_bytes();
    assert_eq!(
        swapped_lanes.with_infos(|accounts| {
            accounts.swap(3, 4);
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::AccountKeyMismatch)
        ))
    );
    assert_eq!(swapped_lanes.write_bytes(), before);
}

#[test]
fn transition_failure_corruption_and_late_borrow_conflict_are_atomic() {
    let binding = binding();
    let gate = open_gate();
    let close = encoded(ProductionInstruction::ClosePosition);

    let mut invalid_transition = Fixture::new(&binding);
    let mut position = decode_position_state(&invalid_transition.position.data).unwrap();
    position.principal_returned = false;
    encode_position_state(&position, &mut invalid_transition.position.data).unwrap();
    let before = invalid_transition.write_bytes();
    assert_eq!(
        invalid_transition.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Economy(
            EconomyError::PrincipalNotReturned
        ))
    );
    assert_eq!(invalid_transition.write_bytes(), before);

    // The retained V2 kernel releases Treasury and Ecosystem in local values
    // before it discovers a Liquidity mismatch. No account may expose either
    // of those intermediate mutations when the third reconciliation fails.
    let mut late_transition_failure = Fixture::new(&binding);
    let mut liquidity = decode_lane_state(&late_transition_failure.liquidity.data).unwrap();
    liquidity.reserved = 7;
    encode_lane_state(&liquidity, &mut late_transition_failure.liquidity.data).unwrap();
    let before = late_transition_failure.write_bytes();
    assert_eq!(
        late_transition_failure.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Economy(
            EconomyError::ReservationLedgerMismatch
        ))
    );
    assert_eq!(late_transition_failure.write_bytes(), before);

    let mut corrupt = Fixture::new(&binding);
    corrupt.position.data[0] ^= 1;
    let before = corrupt.write_bytes();
    assert!(matches!(
        corrupt.with_infos(|accounts| execute_production_close_position_account_infos(
            &gate, &binding, &close, accounts
        )),
        Err(ProductionClosePositionError::PositionCodec(_))
    ));
    assert_eq!(corrupt.write_bytes(), before);

    let mut borrowed = Fixture::new(&binding);
    let before = borrowed.write_bytes();
    assert_eq!(
        borrowed.with_infos(|accounts| {
            let late_conflict = accounts[5].try_borrow_mut_data().unwrap();
            let result =
                execute_production_close_position_account_infos(&gate, &binding, &close, accounts);
            drop(late_conflict);
            result
        }),
        Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::AccountBorrowFailed
        ))
    );
    assert_eq!(borrowed.write_bytes(), before);
}

#[test]
fn config_and_state_meta_drift_fail_closed_before_any_write() {
    let binding = binding();
    let gate = open_gate();
    let close = encoded(ProductionInstruction::ClosePosition);

    let mut writable_config = Fixture::new(&binding);
    writable_config.config.is_writable = true;
    let before = writable_config.write_bytes();
    assert_eq!(
        writable_config.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::ConfigAccountMustBeReadOnly
        ))
    );
    assert_eq!(writable_config.write_bytes(), before);

    let mut readonly_position = Fixture::new(&binding);
    readonly_position.position.is_writable = false;
    let before = readonly_position.write_bytes();
    assert_eq!(
        readonly_position.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::AccountMustBeWritable)
        ))
    );
    assert_eq!(readonly_position.write_bytes(), before);

    let mut signer_lane = Fixture::new(&binding);
    signer_lane.treasury.is_signer = true;
    let before = signer_lane.write_bytes();
    assert_eq!(
        signer_lane.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::PdaAccountMustNotBeSigner)
        ))
    );
    assert_eq!(signer_lane.write_bytes(), before);

    let mut inactive_config = Fixture::new(&binding);
    let mut state =
        iat_b3_economy::decode_config_genesis_state(&inactive_config.config.data).unwrap();
    state.phase = GenesisPhase::GenesisStaging;
    state.config.active = false;
    encode_config_genesis_state(&state, &mut inactive_config.config.data).unwrap();
    let before = inactive_config.write_bytes();
    assert_eq!(
        inactive_config.with_infos(|accounts| {
            execute_production_close_position_account_infos(&gate, &binding, &close, accounts)
        }),
        Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::ConfigPhaseNotActive
        ))
    );
    assert_eq!(inactive_config.write_bytes(), before);
}

#[test]
fn truth_marks_exactly_one_handler_complete_and_keeps_all_15_on_hold() {
    assert_eq!(PRODUCTION_CLOSE_POSITION_ACCOUNT_COUNT, 6);
    assert_eq!(PRODUCTION_CLOSE_POSITION_WRITE_COUNT, 4);
    let truth = PRODUCTION_CLOSE_POSITION_TRUTH;
    assert!(truth.feature_gated);
    assert!(truth.exact_instruction_codec_required);
    assert!(truth.runtime_daily_law_capability_supported);
    assert!(truth.production_active_config_required);
    assert!(truth.exact_account_count_and_flags_required);
    assert!(truth.position_and_ordered_lane_pdas_authenticated);
    assert!(truth.retained_v2_transition_used);
    assert!(truth.all_four_preimages_revalidated_before_first_write);
    assert!(truth.exact_four_account_atomic_cas_supported);
    assert!(!truth.token_cpi_executed);
    assert!(!truth.system_cpi_executed);
    assert!(!truth.production_dispatcher_exposed);
    assert!(!truth.production_entrypoint_exposed);
    assert!(truth.handler_complete);
    assert!(!truth.all_15_handlers_complete);
    assert!(!truth.devnet_executed);
    assert!(truth.mainnet_hold);
    assert!(PRODUCTION_CLOSE_POSITION_STATUS.contains("MAINNET_HOLD"));
}

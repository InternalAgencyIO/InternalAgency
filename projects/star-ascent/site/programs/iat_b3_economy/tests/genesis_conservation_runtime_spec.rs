#![cfg(feature = "runtime-account-bridge")]

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};
use iat_b3_economy::genesis_conservation_runtime::{
    verify_authenticated_genesis_conservation, AuthenticatedGenesisLaneCapability,
    GenesisConservationRuntimeError, GenesisConservationRuntimeTruth,
    GENESIS_ACTIVATE_LANE_WRITABILITY, GENESIS_CONSERVATION_RUNTIME_ACCOUNT_SET_DOMAIN,
    GENESIS_CONSERVATION_RUNTIME_STATUS, GENESIS_CONSERVATION_RUNTIME_TRUTH,
};
use iat_b3_economy::native_adapter::{
    authenticate_readonly_state_account, authenticate_state_account, derive_pda,
    NativeAccountObservation, NativeEconomyBinding, PdaIdentity,
};
use iat_b3_economy::token_2022_runtime::{
    authenticate_canonical_economy_mint_account_info, authenticate_public_token_account_info,
    CanonicalEconomyMintBinding, PublicTokenAccountBinding, PublicTokenAccountForm,
    ReadonlyCanonicalEconomyMint, ReadonlyPublicTokenAccount,
};
use iat_b3_economy::{
    encode_lane_state, verify_daily_law_open, CanonicalDailyLawBinding, GenesisAllocationEntry,
    GenesisAllocationManifest, LaneState, ReadonlyDailyLawAccount, ValidatedDailyLawWrite,
    GENESIS_ALLOCATION_AMOUNTS, GENESIS_ALLOCATION_COUNT, GENESIS_ALLOCATION_ROLES,
    LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, MAINNET_SUPPLY,
    TOKEN_DECIMALS,
};
use solana_account_info::AccountInfo;
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
const LAW_BUMP: u8 = 254;
const MINT: [u8; 32] = [0x22; 32];
const NETWORK: [u8; 32] = [0x11; 32];
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

fn open_gate() -> ValidatedDailyLawWrite {
    let local_day = protocol_local_day(CLOCK_TIMESTAMP);
    let decision = (0u16..=u8::MAX.into())
        .find_map(|candidate| {
            let mut hash = [0u8; 32];
            hash[31] = candidate as u8;
            let value =
                create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
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
    verify_daily_law_open(
        &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        CLOCK_TIMESTAMP,
    )
    .unwrap()
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
    let mut token_program = TestAccount::program(TOKEN_2022_PROGRAM_ID.to_bytes());
    let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
    let mut mint = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), mint_data());
    authenticate_canonical_economy_mint_account_info(
        &CanonicalEconomyMintBinding::new(MINT, LAW_PROGRAM, MAINNET_SUPPLY, TOKEN_DECIMALS)
            .unwrap(),
        &token_program.info(),
        &zk_program.info(),
        &mint.info(),
    )
    .unwrap()
}

fn manifest(binding: &NativeEconomyBinding) -> GenesisAllocationManifest {
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
        if index == 0 {
            GenesisAllocationEntry {
                role,
                token_account: [0x20; 32],
                token_authority: [0x40; 32],
                beneficiary: [0x40; 32],
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
                beneficiary: [0x40 + index as u8; 32],
                amount: GENESIS_ALLOCATION_AMOUNTS[index],
            }
        }
    });
    GenesisAllocationManifest {
        mint: MINT,
        token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
        entries,
    }
}

fn token_capabilities(
    mint: &ReadonlyCanonicalEconomyMint,
    manifest: &GenesisAllocationManifest,
) -> [ReadonlyPublicTokenAccount; GENESIS_ALLOCATION_COUNT] {
    core::array::from_fn(|index| {
        let entry = manifest.entries[index];
        let mut account = TestAccount::data(
            entry.token_account,
            TOKEN_2022_PROGRAM_ID.to_bytes(),
            token_data(entry.token_authority, entry.amount),
        );
        authenticate_public_token_account_info(
            mint,
            &PublicTokenAccountBinding::new(
                entry.token_account,
                entry.token_authority,
                PublicTokenAccountForm::ImmutableOwner,
                false,
            )
            .unwrap(),
            &account.info(),
        )
        .unwrap()
    })
}

fn lane_capabilities(
    binding: &NativeEconomyBinding,
    gate: &ValidatedDailyLawWrite,
    manifest: &GenesisAllocationManifest,
    reserved_lane_index: Option<usize>,
) -> [AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1] {
    lane_capabilities_with_writability(
        binding,
        gate,
        manifest,
        reserved_lane_index,
        GENESIS_ACTIVATE_LANE_WRITABILITY,
    )
}

fn lane_capabilities_with_writability(
    binding: &NativeEconomyBinding,
    gate: &ValidatedDailyLawWrite,
    manifest: &GenesisAllocationManifest,
    reserved_lane_index: Option<usize>,
    writability: [bool; GENESIS_ALLOCATION_COUNT - 1],
) -> [AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1] {
    let genesis_unlocked = [
        50_000_000_000_000_000,
        37_500_000_000_000_000,
        0,
        12_500_000_000_000_000,
    ];
    let cliffs = [52, 26, 26, 26];
    let ends = [208, 104, 104, 104];
    let reward_sources = [true, true, false, true];
    core::array::from_fn(|lane_index| {
        let manifest_index = lane_index + 1;
        let entry = manifest.entries[manifest_index];
        let identity = PdaIdentity::LaneState {
            config: binding.config(),
            lane: entry.role as u8,
        };
        let derived = derive_pda(binding, identity).unwrap();
        let token = derive_pda(
            binding,
            PdaIdentity::LaneToken {
                config: binding.config(),
                lane: entry.role as u8,
            },
        )
        .unwrap();
        let lane = LaneState {
            config: binding.config(),
            token_account: token.key,
            beneficiary: entry.beneficiary,
            total: entry.amount,
            genesis_unlocked: genesis_unlocked[lane_index],
            cliff_week: cliffs[lane_index],
            linear_end_week: ends[lane_index],
            reserved: u64::from(reserved_lane_index == Some(lane_index)),
            paid: 0,
            principal_claimed: 0,
            lane: entry.role as u8,
            reward_source: reward_sources[lane_index],
            bump: derived.bump,
            token_bump: token.bump,
        };
        let mut data = [0u8; LANE_ACCOUNT_LEN];
        encode_lane_state(&lane, &mut data).unwrap();
        let observation = NativeAccountObservation {
            key: derived.key,
            owner: binding.program_id(),
            lamports: 1,
            data: &data,
            is_signer: false,
            is_writable: writability[lane_index],
            executable: false,
        };
        if writability[lane_index] {
            AuthenticatedGenesisLaneCapability::Writable(
                authenticate_state_account(gate, binding, observation, identity).unwrap(),
            )
        } else {
            AuthenticatedGenesisLaneCapability::Readonly(
                authenticate_readonly_state_account(gate, binding, observation, identity).unwrap(),
            )
        }
    })
}

#[test]
fn truth_reports_authenticated_runtime_partial_without_authorization() {
    assert_eq!(
        GENESIS_CONSERVATION_RUNTIME_STATUS,
        "FEATURE_GATED_AUTHENTICATED_TOKEN_AND_LANE_CAPABILITIES_OWNER_POLICY_REQUIRED_MAINNET_HOLD"
    );
    assert_eq!(
        GENESIS_CONSERVATION_RUNTIME_TRUTH,
        GenesisConservationRuntimeTruth {
            feature_gated: true,
            opaque_token_2022_capabilities_required: true,
            opaque_lane_state_capabilities_required: true,
            exact_runtime_balances_authenticated: true,
            exact_lane_beneficiaries_authenticated: true,
            exact_retained_activate_lane_writability_authenticated: true,
            immutable_account_borrows_only: true,
            owner_destination_manifest_accepted: false,
            production_identity_binding_frozen: false,
            migration_or_no_prior_supply_proved: false,
            phase_transition_authorized: false,
            account_writes_executed: false,
            entrypoint_exposed: false,
            dispatcher_exposed: false,
            mainnet_hold: true,
        }
    );
}

#[test]
fn opaque_token_and_lane_capabilities_produce_the_exact_receipt() {
    let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
    let manifest = manifest(&binding);
    let mint = canonical_mint();
    let tokens = token_capabilities(&mint, &manifest);
    let lanes = lane_capabilities(&binding, &open_gate(), &manifest, None);
    assert_eq!(
        lanes.map(|lane| lane.observed_writable()),
        GENESIS_ACTIVATE_LANE_WRITABILITY
    );
    let receipt =
        verify_authenticated_genesis_conservation(&binding, manifest, &mint, &tokens, &lanes)
            .unwrap();
    assert_eq!(receipt.observed_supply(), MAINNET_SUPPLY);
    assert_eq!(receipt.observed_allocation_total(), MAINNET_SUPPLY);
    assert_ne!(receipt.account_set_sha256(), [0; 32]);
    assert_eq!(
        GENESIS_CONSERVATION_RUNTIME_ACCOUNT_SET_DOMAIN,
        b"IAT_B3_GENESIS_CONSERVATION_RUNTIME_ACCOUNT_SET_V2"
    );

    let mut alternate_manifest = manifest;
    alternate_manifest.entries[0].token_account = [0x21; 32];
    let alternate_tokens = token_capabilities(&mint, &alternate_manifest);
    let alternate = verify_authenticated_genesis_conservation(
        &binding,
        alternate_manifest,
        &mint,
        &alternate_tokens,
        &lanes,
    )
    .unwrap();
    assert_ne!(alternate.account_set_sha256(), receipt.account_set_sha256());
}

#[test]
fn retained_activate_lane_writability_escalation_and_downgrade_fail_closed() {
    let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
    let manifest = manifest(&binding);
    let mint = canonical_mint();
    let tokens = token_capabilities(&mint, &manifest);
    let gate = open_gate();
    for hostile_shape in [
        [true, true, true, true],
        [false, true, false, true],
        [true, false, false, true],
        [true, true, false, false],
    ] {
        let hostile =
            lane_capabilities_with_writability(&binding, &gate, &manifest, None, hostile_shape);
        assert_eq!(
            verify_authenticated_genesis_conservation(&binding, manifest, &mint, &tokens, &hostile,),
            Err(GenesisConservationRuntimeError::LaneWritabilityMismatch)
        );
    }
}

#[test]
fn account_order_community_custody_and_lane_capabilities_fail_closed() {
    let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
    let base_manifest = manifest(&binding);
    let mint = canonical_mint();
    let tokens = token_capabilities(&mint, &base_manifest);
    let lanes = lane_capabilities(&binding, &open_gate(), &base_manifest, None);

    let mut swapped = tokens;
    swapped.swap(0, 1);
    assert_eq!(
        verify_authenticated_genesis_conservation(&binding, base_manifest, &mint, &swapped, &lanes),
        Err(GenesisConservationRuntimeError::CommunityCustodyMismatch)
    );

    let mut community = base_manifest;
    community.entries[0].beneficiary[0] ^= 1;
    assert_eq!(
        verify_authenticated_genesis_conservation(&binding, community, &mint, &tokens, &lanes),
        Err(GenesisConservationRuntimeError::CommunityCustodyMismatch)
    );

    let mut wrong_order = lanes;
    wrong_order.swap(0, 1);
    assert_eq!(
        verify_authenticated_genesis_conservation(
            &binding,
            base_manifest,
            &mint,
            &tokens,
            &wrong_order
        ),
        Err(GenesisConservationRuntimeError::LaneCapabilityMismatch)
    );
}

#[test]
fn nonzero_genesis_lane_accounting_is_rejected_even_when_the_pda_is_authentic() {
    let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
    let manifest = manifest(&binding);
    let mint = canonical_mint();
    let tokens = token_capabilities(&mint, &manifest);
    let lanes = lane_capabilities(&binding, &open_gate(), &manifest, Some(2));
    assert_eq!(
        verify_authenticated_genesis_conservation(&binding, manifest, &mint, &tokens, &lanes),
        Err(GenesisConservationRuntimeError::LaneEconomicsMismatch)
    );
}

#[test]
fn runtime_composition_source_has_no_write_or_public_execution_surface() {
    let source = include_str!("../src/genesis_conservation_runtime.rs");
    for forbidden in [
        "try_borrow_mut",
        "invoke(",
        "invoke_signed(",
        "entrypoint!",
        "process_instruction",
        "account_writes_executed: true",
        "phase_transition_authorized: true",
        "mainnet_hold: false",
    ] {
        assert!(!source.contains(forbidden), "forbidden token {forbidden}");
    }
}

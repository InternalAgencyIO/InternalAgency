#![cfg(feature = "runtime-account-bridge")]

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
use iat_b3_economy::native_adapter::{NativeAdapterError, NativeEconomyBinding};
use iat_b3_economy::production_dispatch::*;
use iat_b3_economy::production_instruction::{
    encode_production_instruction, ProductionInstruction, PRODUCTION_INSTRUCTION_LEN,
};
use iat_b3_economy::rehearsal_adapter::*;
use iat_b3_economy::token_2022_runtime::*;
use iat_b3_economy::{
    verify_daily_law_open, CanonicalDailyLawBinding, ReadonlyDailyLawAccount,
    ValidatedDailyLawWrite, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use solana_sdk_ids::zk_elgamal_proof_program;
use spl_token_2022_interface::{
    extension::{
        confidential_transfer::{ConfidentialTransferAccount, ConfidentialTransferMint},
        cpi_guard::CpiGuard,
        immutable_owner::ImmutableOwner,
        mint_close_authority::MintCloseAuthority,
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
const OTHER_MINT: [u8; 32] = [0x23; 32];
const NETWORK: [u8; 32] = [0x11; 32];
const TOKEN_ACCOUNT: [u8; 32] = [0x31; 32];
const WALLET: [u8; 32] = [0x32; 32];
const OTHER_WALLET: [u8; 32] = [0x33; 32];
const SUPPLY: u64 = 1_000_000_000_000_000_000;
const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

struct TestAccount {
    key: Pubkey,
    owner: Pubkey,
    lamports: u64,
    data: Vec<u8>,
    is_signer: bool,
    is_writable: bool,
    executable: bool,
}

impl TestAccount {
    fn data(key: [u8; 32], owner: [u8; 32], data: Vec<u8>, is_writable: bool) -> Self {
        Self {
            key: key.into(),
            owner: owner.into(),
            lamports: 1,
            data,
            is_signer: false,
            is_writable,
            executable: false,
        }
    }

    fn program(key: [u8; 32]) -> Self {
        Self {
            key: key.into(),
            owner: [0x99; 32].into(),
            lamports: 1,
            data: Vec::new(),
            is_signer: false,
            is_writable: false,
            executable: true,
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
            self.executable,
        )
    }
}

fn daily_law_binding(mint: [u8; 32]) -> CanonicalDailyLawBinding {
    CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, mint, NETWORK)
}

fn decision_for_inputs(timestamp: i64, mint: [u8; 32]) -> SolanaDailyDecision {
    let local_day = protocol_local_day(timestamp);
    for candidate in 0u16..=u8::MAX.into() {
        let mut hash = [0u8; 32];
        hash[31] = candidate as u8;
        let decision =
            create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, mint).unwrap();
        if !decision.locked {
            return decision;
        }
    }
    panic!("test vector search did not find an open decision")
}

fn pack_law_state(mint: [u8; 32], decision: SolanaDailyDecision) -> [u8; LAW_STATE_LEN] {
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
    data
}

fn open_gate(mint: [u8; 32]) -> ValidatedDailyLawWrite {
    let data = pack_law_state(mint, decision_for_inputs(CLOCK_TIMESTAMP, mint));
    verify_daily_law_open(
        &daily_law_binding(mint),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        CLOCK_TIMESTAMP,
    )
    .unwrap()
}

fn build_mint_data(extra_extension: bool) -> Vec<u8> {
    let extensions = if extra_extension {
        vec![
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
            ExtensionType::MintCloseAuthority,
        ]
    } else {
        vec![
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
        ]
    };
    let len = ExtensionType::try_calculate_account_len::<Mint>(&extensions).unwrap();
    let mut data = vec![0; len];
    let mut state = StateWithExtensionsMut::<Mint>::unpack_uninitialized(&mut data).unwrap();
    state.get_account_type_mut()[0] = u8::from(AccountType::Mint);
    state.base = Mint {
        supply: SUPPLY,
        decimals: 9,
        is_initialized: true,
        ..Mint::default()
    };
    for extension in extensions {
        match extension {
            ExtensionType::ConfidentialTransferMint => {
                let confidential = state
                    .init_extension::<ConfidentialTransferMint>(false)
                    .unwrap();
                confidential.auto_approve_new_accounts = true.into();
            }
            ExtensionType::TransferHook => {
                let hook = state.init_extension::<TransferHook>(false).unwrap();
                hook.program_id = Some(Pubkey::new_from_array(LAW_PROGRAM))
                    .try_into()
                    .unwrap();
            }
            ExtensionType::MintCloseAuthority => {
                state.init_extension::<MintCloseAuthority>(false).unwrap();
            }
            _ => unreachable!(),
        }
    }
    state.pack_base();
    data
}

fn mutate_mint_pod_bool() -> Vec<u8> {
    let mut data = build_mint_data(false);
    let mut state = StateWithExtensionsMut::<Mint>::unpack(&mut data).unwrap();
    state
        .get_extension_mut::<ConfidentialTransferMint>()
        .unwrap()
        .auto_approve_new_accounts
        .0 = 2;
    data
}

#[derive(Clone, Copy)]
struct PublicAccountShape {
    mint: [u8; 32],
    wallet: [u8; 32],
    immutable_owner: bool,
    confidential: bool,
    cpi_guard: bool,
    transferring_byte: u8,
    state: AccountState,
}

impl Default for PublicAccountShape {
    fn default() -> Self {
        Self {
            mint: MINT,
            wallet: WALLET,
            immutable_owner: true,
            confidential: false,
            cpi_guard: false,
            transferring_byte: 0,
            state: AccountState::Initialized,
        }
    }
}

fn build_public_account_data(shape: PublicAccountShape) -> Vec<u8> {
    let mut extensions = vec![ExtensionType::TransferHookAccount];
    if shape.immutable_owner {
        extensions.push(ExtensionType::ImmutableOwner);
    }
    if shape.confidential {
        extensions.push(ExtensionType::ConfidentialTransferAccount);
    }
    if shape.cpi_guard {
        extensions.push(ExtensionType::CpiGuard);
    }
    let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extensions).unwrap();
    let mut data = vec![0; len];
    let mut state =
        StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
    state.get_account_type_mut()[0] = u8::from(AccountType::Account);
    state.base = TokenAccount {
        mint: shape.mint.into(),
        owner: shape.wallet.into(),
        amount: 777,
        state: shape.state,
        ..TokenAccount::default()
    };
    for extension in extensions {
        match extension {
            ExtensionType::TransferHookAccount => {
                state
                    .init_extension::<TransferHookAccount>(false)
                    .unwrap()
                    .transferring
                    .0 = shape.transferring_byte;
            }
            ExtensionType::ImmutableOwner => {
                state.init_extension::<ImmutableOwner>(false).unwrap();
            }
            ExtensionType::ConfidentialTransferAccount => {
                state
                    .init_extension::<ConfidentialTransferAccount>(false)
                    .unwrap();
            }
            ExtensionType::CpiGuard => {
                state.init_extension::<CpiGuard>(false).unwrap();
            }
            _ => unreachable!(),
        }
    }
    state.pack_base();
    data
}

fn corrupt_immutable_owner_tlv_length() -> Vec<u8> {
    let mut data = build_public_account_data(PublicAccountShape::default());
    let extension_type = u16::from(ExtensionType::ImmutableOwner).to_le_bytes();
    let header = data
        .windows(4)
        .rposition(|window| window[..2] == extension_type && window[2..] == [0, 0])
        .unwrap();
    data[header + 2] = 1;
    data.push(0);
    data
}

fn duplicate_transfer_hook_tlv() -> Vec<u8> {
    let mut data = build_public_account_data(PublicAccountShape {
        cpi_guard: true,
        ..PublicAccountShape::default()
    });
    let cpi_guard = u16::from(ExtensionType::CpiGuard).to_le_bytes();
    let header = data
        .windows(4)
        .position(|window| window[..2] == cpi_guard)
        .unwrap();
    data[header..header + 2]
        .copy_from_slice(&u16::from(ExtensionType::TransferHookAccount).to_le_bytes());
    data
}

fn mutate_public_base(mut mutate: impl FnMut(&mut TokenAccount)) -> Vec<u8> {
    let mut data = build_public_account_data(PublicAccountShape::default());
    let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(&mut data).unwrap();
    mutate(&mut state.base);
    state.pack_base();
    data
}

fn authenticate_mint_for(
    mint_key: [u8; 32],
    data: Vec<u8>,
) -> Result<ReadonlyCanonicalEconomyMint, EconomyToken2022Error> {
    let mut token_program = TestAccount::program(TOKEN_2022_PROGRAM_ID.to_bytes());
    let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
    let mut mint = TestAccount::data(mint_key, TOKEN_2022_PROGRAM_ID.to_bytes(), data, false);
    authenticate_canonical_economy_mint_account_info(
        &CanonicalEconomyMintBinding::new(mint_key, LAW_PROGRAM, SUPPLY, 9).unwrap(),
        &token_program.info(),
        &zk_program.info(),
        &mint.info(),
    )
}

fn canonical_mint() -> ReadonlyCanonicalEconomyMint {
    authenticate_mint_for(MINT, build_mint_data(false)).unwrap()
}

fn public_binding() -> PublicTokenAccountBinding {
    PublicTokenAccountBinding::new(
        TOKEN_ACCOUNT,
        WALLET,
        PublicTokenAccountForm::ImmutableOwner,
        true,
    )
    .unwrap()
}

fn production_instructions() -> [ProductionInstruction; EXPECTED_REHEARSAL_HANDLER_COUNT] {
    [
        ProductionInstruction::InitializeConfig,
        ProductionInstruction::InitializeLaneVault { lane: 1 },
        ProductionInstruction::InitializeStakeVault,
        ProductionInstruction::Activate,
        ProductionInstruction::RegisterAgency,
        ProductionInstruction::SetEligibility {
            role: 2,
            agency_index: Some(7),
        },
        ProductionInstruction::OpenPosition {
            position_id: 9,
            principal: 10,
        },
        ProductionInstruction::SettlePositionWeek { week: 11 },
        ProductionInstruction::SettleCoreWeek { ordinal: 12 },
        ProductionInstruction::ClaimLanePrincipal { lane: 3 },
        ProductionInstruction::WithdrawPositionPrincipal,
        ProductionInstruction::ClosePosition,
        ProductionInstruction::CommitRound { week: 13 },
        ProductionInstruction::SettleRound,
        ProductionInstruction::ExpireRound,
    ]
}

fn production_meta_account(slot: RehearsalAccountSlot, index: usize) -> TestAccount {
    TestAccount {
        key: Pubkey::new_from_array([u8::try_from(index + 1).unwrap(); 32]),
        owner: Pubkey::new_from_array([0x99; 32]),
        lamports: 1,
        data: Vec::new(),
        is_signer: slot.signer,
        is_writable: slot.writable,
        executable: slot.executable,
    }
}

#[test]
fn exact_all_15_inventory_is_structural_only_and_mainnet_held() {
    type ExpectedSlot = (&'static str, bool, bool, bool, bool);
    type ExpectedRow = (
        RehearsalOperation,
        &'static str,
        RehearsalHold,
        &'static [ExpectedSlot],
    );

    let expected: &[ExpectedRow] = &[
        (
            RehearsalOperation::InitializeConfig,
            "initialize_config",
            RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen,
            &[
                ("admin", true, true, false, false),
                ("mint", false, false, false, false),
                ("config", false, true, false, false),
                ("vault_authority", false, false, false, false),
                ("token_program", false, false, true, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::InitializeLaneVault,
            "initialize_lane_vault",
            RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen,
            &[
                ("admin", true, true, false, false),
                ("config", false, true, false, false),
                ("mint", false, false, false, false),
                ("vault_authority", false, false, false, false),
                ("lane_state", false, true, false, false),
                ("lane_token_account", false, true, false, false),
                ("token_program", false, false, true, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::InitializeStakeVault,
            "initialize_stake_vault",
            RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen,
            &[
                ("admin", true, true, false, false),
                ("config", false, true, false, false),
                ("mint", false, false, false, false),
                ("vault_authority", false, false, false, false),
                ("stake_token_account", false, true, false, false),
                ("token_program", false, false, true, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::Activate,
            "activate",
            RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen,
            &[
                ("admin", true, true, false, false),
                ("config", false, true, false, false),
                ("mint", false, false, false, false),
                ("vault_authority", false, false, false, false),
                ("community_tokens", false, false, false, false),
                ("stake_tokens", false, false, false, false),
                ("treasury", false, true, false, false),
                ("treasury_tokens", false, false, false, false),
                ("ecosystem", false, true, false, false),
                ("ecosystem_tokens", false, false, false, false),
                ("core_team", false, false, false, false),
                ("core_team_tokens", false, false, false, false),
                ("liquidity", false, true, false, false),
                ("liquidity_tokens", false, false, false, false),
                ("core_reward", false, true, false, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::RegisterAgency,
            "register_agency",
            RehearsalHold::ImmutableCccGenesisDisabled,
            &[
                ("admin", true, true, false, false),
                ("config", false, true, false, false),
                ("agency_owner", false, false, false, false),
                ("agency", false, true, false, false),
                ("agency_owner_index", false, true, false, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::SetEligibility,
            "set_eligibility",
            RehearsalHold::HandlerRuntimeIncomplete,
            &[
                ("admin", true, true, false, false),
                ("config", false, false, false, false),
                ("wallet", false, false, false, false),
                ("eligibility", false, true, false, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::OpenPosition,
            "open_position",
            RehearsalHold::HandlerRuntimeIncomplete,
            &[
                ("owner", true, true, false, false),
                ("config", false, true, false, false),
                ("eligibility", false, false, false, false),
                ("mint", false, false, false, false),
                ("owner_tokens", false, true, false, false),
                ("stake_tokens", false, true, false, false),
                ("treasury", false, true, false, false),
                ("ecosystem", false, true, false, false),
                ("liquidity", false, true, false, false),
                ("position", false, true, false, false),
                ("token_program", false, false, true, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::SettlePositionWeek,
            "settle_position_week",
            RehearsalHold::HandlerRuntimeIncomplete,
            &[
                ("caller", true, false, false, false),
                ("config", false, false, false, false),
                ("position", false, true, false, false),
                ("round", false, false, false, true),
                ("mint", false, false, false, false),
                ("vault_authority", false, false, false, false),
                ("treasury", false, true, false, false),
                ("treasury_tokens", false, true, false, false),
                ("ecosystem", false, true, false, false),
                ("ecosystem_tokens", false, true, false, false),
                ("liquidity", false, true, false, false),
                ("liquidity_tokens", false, true, false, false),
                ("destination_tokens", false, true, false, false),
                ("token_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::SettleCoreWeek,
            "settle_core_week",
            RehearsalHold::OwnerCustodyPolicyUnfrozen,
            &[
                ("caller", true, false, false, false),
                ("config", false, false, false, false),
                ("mint", false, false, false, false),
                ("vault_authority", false, false, false, false),
                ("core_reward", false, true, false, false),
                ("treasury", false, true, false, false),
                ("treasury_tokens", false, true, false, false),
                ("ecosystem", false, true, false, false),
                ("ecosystem_tokens", false, true, false, false),
                ("liquidity", false, true, false, false),
                ("liquidity_tokens", false, true, false, false),
                ("destination_tokens", false, true, false, false),
                ("token_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::ClaimLanePrincipal,
            "claim_lane_principal",
            RehearsalHold::CoreLaneOwnerPolicyUnfrozen,
            &[
                ("caller", true, false, false, false),
                ("config", false, false, false, false),
                ("mint", false, false, false, false),
                ("vault_authority", false, false, false, false),
                ("lane_state", false, true, false, false),
                ("lane_tokens", false, true, false, false),
                ("destination_tokens", false, true, false, false),
                ("token_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::WithdrawPositionPrincipal,
            "withdraw_position_principal",
            RehearsalHold::HandlerRuntimeIncomplete,
            &[
                ("caller", true, false, false, false),
                ("config", false, true, false, false),
                ("position", false, true, false, false),
                ("mint", false, false, false, false),
                ("vault_authority", false, false, false, false),
                ("stake_tokens", false, true, false, false),
                ("destination_tokens", false, true, false, false),
                ("token_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::ClosePosition,
            "close_position",
            RehearsalHold::HandlerRuntimeIncomplete,
            &[
                ("caller", true, false, false, false),
                ("config", false, false, false, false),
                ("position", false, true, false, false),
                ("treasury", false, true, false, false),
                ("ecosystem", false, true, false, false),
                ("liquidity", false, true, false, false),
            ],
        ),
        (
            RehearsalOperation::CommitRound,
            "commit_round",
            RehearsalHold::ImmutableCccGenesisDisabled,
            &[
                ("payer", true, true, false, false),
                ("config", false, false, false, false),
                ("randomness_account", false, false, false, false),
                ("instructions", false, false, false, false),
                ("round", false, true, false, false),
                ("system_program", false, false, true, false),
            ],
        ),
        (
            RehearsalOperation::SettleRound,
            "settle_round",
            RehearsalHold::ImmutableCccGenesisDisabled,
            &[
                ("config", false, false, false, false),
                ("round", false, true, false, false),
                ("randomness_account", false, false, false, false),
            ],
        ),
        (
            RehearsalOperation::ExpireRound,
            "expire_round",
            RehearsalHold::ImmutableCccGenesisDisabled,
            &[
                ("config", false, false, false, false),
                ("round", false, true, false, false),
            ],
        ),
    ];

    assert_eq!(ALL_REHEARSAL_OPERATIONS.len(), 15);
    assert_eq!(EXPECTED_REHEARSAL_HANDLER_COUNT, 15);
    assert!(!std::hint::black_box(ALL_15_REHEARSAL_PREFLIGHT_COMPLETE));
    assert_eq!(expected.len(), EXPECTED_REHEARSAL_HANDLER_COUNT);
    for (index, (operation, name, hold, accounts)) in expected.iter().enumerate() {
        assert_eq!(ALL_REHEARSAL_OPERATIONS[index], *operation, "{name}");
        assert_eq!(operation.name(), *name);
        let descriptor = operation_descriptor(*operation);
        assert_eq!(descriptor.operation, *operation, "{name}");
        assert_eq!(descriptor.hold, *hold, "{name}");
        let actual_accounts: Vec<ExpectedSlot> = descriptor
            .accounts
            .iter()
            .map(|slot| {
                (
                    slot.name,
                    slot.signer,
                    slot.writable,
                    slot.executable,
                    slot.optional,
                )
            })
            .collect();
        assert_eq!(actual_accounts.as_slice(), *accounts, "{name}");
        assert!(descriptor.requires_daily_law_capability);
        assert!(descriptor.requires_canonical_mint_capability);
        assert!(!descriptor.handler_complete);
        assert!(!descriptor.devnet_executable);
    }

    let truth = std::hint::black_box(ALL_15_REHEARSAL_PREFLIGHT_TRUTH);
    assert!(truth.feature_gated);
    assert!(!truth.account_identity_graph_complete);
    assert!(!truth.instruction_abi_frozen);
    assert!(!truth.entrypoint_exposed);
    assert!(!truth.dispatcher_exposed);
    assert!(!truth.mutable_account_borrows);
    assert!(!truth.account_writes_executed);
    assert!(!truth.system_cpi_executed);
    assert!(!truth.token_cpi_executed);
    assert!(!truth.rpc_used);
    assert!(!truth.transaction_signed);
    assert!(!truth.deployment_executed);
    assert!(!truth.production_identity_binding_frozen);
    assert!(!truth.devnet_executed);
    assert!(!truth.any_handler_complete);
    assert!(truth.mainnet_hold);
}

#[test]
fn canonical_mint_and_public_account_produce_readonly_capabilities() {
    assert_eq!(TOKEN_2022_INTERFACE_VERSION, "2.1.0");
    assert_eq!(SOLANA_ZK_SDK_VERSION, "4.0.0");
    assert_eq!(ZK_ELGAMAL_PUBKEY_LAYOUT_BYTES, 32);
    let mint = canonical_mint();
    assert_eq!(mint.canonical_mint(), MINT);
    assert_eq!(mint.transfer_hook_program(), LAW_PROGRAM);
    assert_eq!(mint.supply(), SUPPLY);
    assert_eq!(mint.decimals(), 9);

    let mut token_account = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_public_account_data(PublicAccountShape::default()),
        true,
    );
    let capability =
        authenticate_public_token_account_info(&mint, &public_binding(), &token_account.info())
            .unwrap();
    assert_eq!(capability.token_account(), TOKEN_ACCOUNT);
    assert_eq!(capability.mint(), MINT);
    assert_eq!(capability.wallet_owner(), WALLET);
    assert_eq!(capability.public_amount(), 777);
    assert!(capability.immutable_owner());
    assert!(capability.observed_writable());
}

#[test]
fn mint_rejects_noncanonical_boolean_extra_extension_length_and_borrow() {
    assert_eq!(
        authenticate_mint_for(MINT, mutate_mint_pod_bool()),
        Err(EconomyToken2022Error::NonCanonicalPodBoolean)
    );
    assert_eq!(
        authenticate_mint_for(MINT, build_mint_data(true)),
        Err(EconomyToken2022Error::MintExtensionMismatch)
    );
    let mut padded = build_mint_data(false);
    padded.push(0);
    assert_eq!(
        authenticate_mint_for(MINT, padded),
        Err(EconomyToken2022Error::MintLengthMismatch)
    );

    let mut token_program = TestAccount::program(TOKEN_2022_PROGRAM_ID.to_bytes());
    let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
    let mut mint = TestAccount::data(
        MINT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_mint_data(false),
        false,
    );
    let mint_info = mint.info();
    let _borrow = mint_info.try_borrow_mut_data().unwrap();
    assert_eq!(
        authenticate_canonical_economy_mint_account_info(
            &CanonicalEconomyMintBinding::new(MINT, LAW_PROGRAM, SUPPLY, 9).unwrap(),
            &token_program.info(),
            &zk_program.info(),
            &mint_info,
        ),
        Err(EconomyToken2022Error::AccountBorrowFailed)
    );
}

#[test]
fn public_account_rejects_cross_mint_owner_state_extensions_and_pod_bool() {
    let mint = canonical_mint();
    let reject = |shape, expected| {
        let mut account = TestAccount::data(
            TOKEN_ACCOUNT,
            TOKEN_2022_PROGRAM_ID.to_bytes(),
            build_public_account_data(shape),
            true,
        );
        assert_eq!(
            authenticate_public_token_account_info(&mint, &public_binding(), &account.info()),
            Err(expected)
        );
    };
    reject(
        PublicAccountShape {
            mint: OTHER_MINT,
            ..PublicAccountShape::default()
        },
        EconomyToken2022Error::CrossMintTokenAccount,
    );
    reject(
        PublicAccountShape {
            wallet: OTHER_WALLET,
            ..PublicAccountShape::default()
        },
        EconomyToken2022Error::TokenAccountWalletOwnerMismatch,
    );
    reject(
        PublicAccountShape {
            state: AccountState::Frozen,
            ..PublicAccountShape::default()
        },
        EconomyToken2022Error::TokenAccountBaseMismatch,
    );
    reject(
        PublicAccountShape {
            confidential: true,
            ..PublicAccountShape::default()
        },
        EconomyToken2022Error::TokenAccountExtensionMismatch,
    );
    reject(
        PublicAccountShape {
            cpi_guard: true,
            ..PublicAccountShape::default()
        },
        EconomyToken2022Error::TokenAccountExtensionMismatch,
    );
    reject(
        PublicAccountShape {
            transferring_byte: 2,
            ..PublicAccountShape::default()
        },
        EconomyToken2022Error::NonCanonicalPodBoolean,
    );

    let mut malformed = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        corrupt_immutable_owner_tlv_length(),
        true,
    );
    assert!(matches!(
        authenticate_public_token_account_info(&mint, &public_binding(), &malformed.info()),
        Err(EconomyToken2022Error::InvalidTokenAccountData)
            | Err(EconomyToken2022Error::TokenAccountExtensionMismatch)
    ));

    let reject_data = |data, expected| {
        let mut account =
            TestAccount::data(TOKEN_ACCOUNT, TOKEN_2022_PROGRAM_ID.to_bytes(), data, true);
        assert_eq!(
            authenticate_public_token_account_info(&mint, &public_binding(), &account.info()),
            Err(expected)
        );
    };
    reject_data(
        duplicate_transfer_hook_tlv(),
        EconomyToken2022Error::TokenAccountExtensionMismatch,
    );
    reject_data(
        mutate_public_base(|base| {
            base.delegate = Some(Pubkey::new_from_array([0x71; 32])).into();
            base.delegated_amount = 1;
        }),
        EconomyToken2022Error::TokenAccountBaseMismatch,
    );
    reject_data(
        mutate_public_base(|base| base.is_native = Some(1).into()),
        EconomyToken2022Error::TokenAccountBaseMismatch,
    );
    reject_data(
        mutate_public_base(|base| {
            base.close_authority = Some(Pubkey::new_from_array([0x72; 32])).into();
        }),
        EconomyToken2022Error::TokenAccountBaseMismatch,
    );

    let mut padded = build_public_account_data(PublicAccountShape::default());
    padded.push(0);
    reject_data(padded, EconomyToken2022Error::TokenAccountLengthMismatch);

    let mut wrong_key = TestAccount::data(
        [0x73; 32],
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_public_account_data(PublicAccountShape::default()),
        true,
    );
    assert_eq!(
        authenticate_public_token_account_info(&mint, &public_binding(), &wrong_key.info()),
        Err(EconomyToken2022Error::TokenAccountKeyMismatch)
    );
    let mut wrong_program_owner = TestAccount::data(
        TOKEN_ACCOUNT,
        [0x74; 32],
        build_public_account_data(PublicAccountShape::default()),
        true,
    );
    assert_eq!(
        authenticate_public_token_account_info(
            &mint,
            &public_binding(),
            &wrong_program_owner.info(),
        ),
        Err(EconomyToken2022Error::TokenAccountProgramOwnerMismatch)
    );
    let mut wrong_flags = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_public_account_data(PublicAccountShape::default()),
        false,
    );
    assert_eq!(
        authenticate_public_token_account_info(&mint, &public_binding(), &wrong_flags.info()),
        Err(EconomyToken2022Error::TokenAccountFlagsInvalid)
    );

    let mut borrowed = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_public_account_data(PublicAccountShape::default()),
        true,
    );
    let borrowed_info = borrowed.info();
    let _borrow = borrowed_info.try_borrow_mut_data().unwrap();
    assert_eq!(
        authenticate_public_token_account_info(&mint, &public_binding(), &borrowed_info),
        Err(EconomyToken2022Error::AccountBorrowFailed)
    );
}

#[test]
fn composed_session_rejects_cross_mint_and_only_returns_structural_graph_checks() {
    let gate = open_gate(MINT);
    let native = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
    let mint = canonical_mint();
    let session = All15RehearsalPreflight::new(&gate, &native, &mint).unwrap();

    let descriptor = session.descriptor(RehearsalOperation::SettlePositionWeek);
    let observations: Vec<_> = descriptor
        .accounts
        .iter()
        .filter(|slot| !slot.optional)
        .map(|slot| RehearsalAccountMetaObservation {
            name: slot.name,
            signer: slot.signer,
            writable: slot.writable,
            executable: slot.executable,
        })
        .collect();
    let structural = session
        .validate_account_meta_shape(RehearsalOperation::SettlePositionWeek, &observations)
        .unwrap();
    assert_eq!(
        structural.operation(),
        RehearsalOperation::SettlePositionWeek
    );
    assert!(!structural.authorizes_handler());
    assert!(!structural.devnet_executable());

    let mut hostile = observations.clone();
    hostile[0].signer = false;
    assert_eq!(
        session.validate_account_meta_shape(RehearsalOperation::SettlePositionWeek, &hostile),
        Err(RehearsalPreflightError::AccountMetaMismatch)
    );
    assert_eq!(
        session.seal_inert_write_batch::<0>([]),
        Err(RehearsalPreflightError::Native(
            NativeAdapterError::EmptyWriteBatch
        ))
    );

    let wrong_native = NativeEconomyBinding::new(ECONOMY_PROGRAM, OTHER_MINT).unwrap();
    assert!(matches!(
        All15RehearsalPreflight::new(&gate, &wrong_native, &mint),
        Err(RehearsalPreflightError::LawAndNativeMintMismatch)
    ));
    let other_mint = authenticate_mint_for(OTHER_MINT, build_mint_data(false)).unwrap();
    assert!(matches!(
        All15RehearsalPreflight::new(&gate, &native, &other_mint),
        Err(RehearsalPreflightError::CanonicalMintMismatch)
    ));
}

#[test]
fn production_dispatch_preflight_routes_every_exact_abi_to_its_account_graph() {
    let gate = open_gate(MINT);
    let native = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
    let mint = canonical_mint();
    let capabilities = All15RehearsalPreflight::new(&gate, &native, &mint).unwrap();

    for (index, instruction) in production_instructions().into_iter().enumerate() {
        let expected_operation = ALL_REHEARSAL_OPERATIONS[index];
        let descriptor = capabilities.descriptor(expected_operation);
        let mut observed: Vec<_> = descriptor
            .accounts
            .iter()
            .enumerate()
            .map(|(account_index, slot)| production_meta_account(*slot, account_index))
            .collect();
        let infos: Vec<_> = observed.iter_mut().map(TestAccount::info).collect();
        let mut instruction_data = [0u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(instruction, &mut instruction_data).unwrap();

        let preflight =
            prepare_production_dispatch_preflight(&capabilities, &instruction_data, &infos)
                .unwrap();
        assert_eq!(preflight.instruction(), instruction);
        assert_eq!(preflight.operation(), expected_operation);
        assert_eq!(preflight.hold(), descriptor.hold);
        assert_eq!(preflight.observed_account_count(), infos.len());
        assert!(!preflight.authorizes_handler());
        assert!(!preflight.devnet_executable());
    }
}

#[test]
fn production_dispatch_preflight_accepts_only_the_exact_optional_shape_and_flags() {
    let gate = open_gate(MINT);
    let native = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
    let mint = canonical_mint();
    let capabilities = All15RehearsalPreflight::new(&gate, &native, &mint).unwrap();
    let descriptor = capabilities.descriptor(RehearsalOperation::SettlePositionWeek);
    let mut instruction_data = [0u8; PRODUCTION_INSTRUCTION_LEN];
    encode_production_instruction(
        ProductionInstruction::SettlePositionWeek { week: 9 },
        &mut instruction_data,
    )
    .unwrap();

    let mut without_optional: Vec<_> = descriptor
        .accounts
        .iter()
        .filter(|slot| !slot.optional)
        .enumerate()
        .map(|(index, slot)| production_meta_account(*slot, index))
        .collect();
    let infos: Vec<_> = without_optional.iter_mut().map(TestAccount::info).collect();
    assert!(
        prepare_production_dispatch_preflight(&capabilities, &instruction_data, &infos).is_ok()
    );
    drop(infos);

    without_optional[0].is_signer = false;
    let infos: Vec<_> = without_optional.iter_mut().map(TestAccount::info).collect();
    assert_eq!(
        prepare_production_dispatch_preflight(&capabilities, &instruction_data, &infos),
        Err(ProductionDispatchPreflightError::AccountMetaMismatch)
    );
    drop(infos);

    without_optional[0].is_signer = true;
    without_optional[0].is_writable = !without_optional[0].is_writable;
    let infos: Vec<_> = without_optional.iter_mut().map(TestAccount::info).collect();
    assert_eq!(
        prepare_production_dispatch_preflight(&capabilities, &instruction_data, &infos),
        Err(ProductionDispatchPreflightError::AccountMetaMismatch)
    );
    drop(infos);

    without_optional[0].is_writable = !without_optional[0].is_writable;
    without_optional[0].executable = !without_optional[0].executable;
    let infos: Vec<_> = without_optional.iter_mut().map(TestAccount::info).collect();
    assert_eq!(
        prepare_production_dispatch_preflight(&capabilities, &instruction_data, &infos),
        Err(ProductionDispatchPreflightError::AccountMetaMismatch)
    );
    drop(infos);

    let mut too_many: Vec<_> = descriptor
        .accounts
        .iter()
        .enumerate()
        .map(|(index, slot)| production_meta_account(*slot, index))
        .collect();
    too_many.push(production_meta_account(
        descriptor.accounts[0],
        too_many.len(),
    ));
    let infos: Vec<_> = too_many.iter_mut().map(TestAccount::info).collect();
    assert_eq!(
        prepare_production_dispatch_preflight(&capabilities, &instruction_data, &infos),
        Err(ProductionDispatchPreflightError::UnexpectedAccount)
    );

    let mut too_short: Vec<_> = descriptor
        .accounts
        .iter()
        .filter(|slot| !slot.optional)
        .take(12)
        .enumerate()
        .map(|(index, slot)| production_meta_account(*slot, index))
        .collect();
    let infos: Vec<_> = too_short.iter_mut().map(TestAccount::info).collect();
    assert_eq!(
        prepare_production_dispatch_preflight(&capabilities, &instruction_data, &infos),
        Err(ProductionDispatchPreflightError::MissingRequiredAccount)
    );

    let mut invalid = instruction_data;
    invalid[0] ^= 1;
    assert!(matches!(
        prepare_production_dispatch_preflight(&capabilities, &invalid, &[]),
        Err(ProductionDispatchPreflightError::Instruction(_))
    ));
}

#[test]
fn production_dispatch_truth_is_routing_only_and_remains_held() {
    let truth = PRODUCTION_DISPATCH_PREFLIGHT_TRUTH;
    assert!(truth.feature_gated);
    assert!(truth.instruction_abi_frozen);
    assert!(truth.all_15_instruction_routes_frozen);
    assert!(truth.opaque_daily_law_capability_required);
    assert!(truth.native_binding_required);
    assert!(truth.canonical_mint_capability_required);
    assert!(truth.exact_account_meta_shape_required);
    assert!(!truth.account_identity_graph_complete);
    assert!(!truth.account_data_read);
    assert!(!truth.mutable_account_borrow);
    assert!(!truth.handler_dispatch_exposed);
    assert!(!truth.entrypoint_exposed);
    assert!(!truth.account_writes_executed);
    assert!(!truth.system_cpi_executed);
    assert!(!truth.token_cpi_executed);
    assert!(!truth.any_handler_complete);
    assert!(truth.mainnet_hold);
}

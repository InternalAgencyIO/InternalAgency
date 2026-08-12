#![cfg(feature = "token-2022-host-compatibility")]

use iat_b3_vault::{
    journal_codec::{privacy_operation_plan_digest, JournalCodecError},
    native_instruction_plan::{
        prepare_native_account_local_instruction, NativeAccountLocalError,
        NativeAccountLocalMaterial, PRIVACY_VAULT_NATIVE_ACCOUNT_LOCAL_STATUS,
        PRIVACY_VAULT_NATIVE_ACCOUNT_LOCAL_TRUTH,
    },
    plan_apply_pending_balance, plan_deposit, plan_set_confidential_credits,
    plan_set_non_confidential_credits, plan_withdraw,
    token_2022_host::{
        authenticate_canonical_mint_account_info, authenticate_confidential_token_account_info,
        CanonicalMintHostBinding, ConfidentialTokenAccountBinding, ConfidentialTokenAccountForm,
        ReadonlyCanonicalMintCapability, ReadonlyConfidentialAccountCapability,
    },
    ConfidentialAccountSnapshot, DailyLawTransferAccounts, PrivacyOperation,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use solana_sdk_ids::zk_elgamal_proof_program;
use spl_token_2022_interface::{
    extension::{
        confidential_transfer::{
            instruction as confidential_instruction, ConfidentialTransferAccount,
            ConfidentialTransferMint, DecryptableBalance,
        },
        immutable_owner::ImmutableOwner,
        transfer_hook::{TransferHook, TransferHookAccount},
        AccountType, BaseStateWithExtensionsMut, ExtensionType, StateWithExtensionsMut,
    },
    state::{Account as TokenAccount, AccountState, Mint},
    ID as TOKEN_2022_PROGRAM_ID,
};

const MINT: [u8; 32] = [0x31; 32];
const LAW_PROGRAM: [u8; 32] = [0x41; 32];
const LAW_STATE: [u8; 32] = [0x42; 32];
const HOOK_VALIDATION: [u8; 32] = [0x43; 32];
const TOKEN_ACCOUNT: [u8; 32] = [0x51; 32];
const WALLET: [u8; 32] = [0x52; 32];
const OTHER_ACCOUNT: [u8; 32] = [0x61; 32];
const SUPPLY: u64 = 1_000_000_000_000_000_000;
const VALID_ELGAMAL_PUBKEY: [u8; 32] = [
    0xe2, 0xf2, 0xae, 0x0a, 0x6a, 0xbc, 0x4e, 0x71, 0xa8, 0x84, 0xa9, 0x61, 0xc5, 0x00, 0x51, 0x5f,
    0x58, 0xe3, 0x0b, 0x6a, 0xa5, 0x82, 0xdd, 0x8d, 0xb6, 0xa6, 0x59, 0x45, 0xe0, 0x8d, 0x2d, 0x76,
];

struct TestAccount {
    key: Pubkey,
    owner: Pubkey,
    lamports: u64,
    data: Vec<u8>,
    executable: bool,
}

impl TestAccount {
    fn data(key: [u8; 32], owner: [u8; 32], data: Vec<u8>) -> Self {
        Self {
            key: key.into(),
            owner: owner.into(),
            lamports: 1,
            data,
            executable: false,
        }
    }

    fn program(key: [u8; 32]) -> Self {
        Self {
            key: key.into(),
            owner: [0x99; 32].into(),
            lamports: 1,
            data: Vec::new(),
            executable: true,
        }
    }

    fn info(&mut self) -> AccountInfo<'_> {
        AccountInfo::new(
            &self.key,
            false,
            false,
            &mut self.lamports,
            &mut self.data,
            &self.owner,
            self.executable,
        )
    }
}

fn exact_mint_data() -> Vec<u8> {
    let extension_types = [
        ExtensionType::ConfidentialTransferMint,
        ExtensionType::TransferHook,
    ];
    let len = ExtensionType::try_calculate_account_len::<Mint>(&extension_types).unwrap();
    let mut data = vec![0; len];
    let mut state = StateWithExtensionsMut::<Mint>::unpack_uninitialized(&mut data).unwrap();
    state.get_account_type_mut()[0] = u8::from(AccountType::Mint);
    state.base = Mint {
        supply: SUPPLY,
        decimals: 9,
        is_initialized: true,
        ..Mint::default()
    };
    let confidential = state
        .init_extension::<ConfidentialTransferMint>(false)
        .unwrap();
    confidential.auto_approve_new_accounts = true.into();
    let hook = state.init_extension::<TransferHook>(false).unwrap();
    hook.program_id = Some(Pubkey::new_from_array(LAW_PROGRAM))
        .try_into()
        .unwrap();
    state.pack_base();
    data
}

#[derive(Clone, Copy)]
struct AccountShape {
    public_amount: u64,
    allow_confidential_credits: bool,
    allow_non_confidential_credits: bool,
    pending_counter: u64,
}

impl Default for AccountShape {
    fn default() -> Self {
        Self {
            public_amount: 777,
            allow_confidential_credits: true,
            allow_non_confidential_credits: true,
            pending_counter: 2,
        }
    }
}

fn exact_token_account_data(shape: AccountShape) -> Vec<u8> {
    let extension_types = [
        ExtensionType::ConfidentialTransferAccount,
        ExtensionType::TransferHookAccount,
        ExtensionType::ImmutableOwner,
    ];
    let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extension_types).unwrap();
    let mut data = vec![0; len];
    let mut state =
        StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
    state.get_account_type_mut()[0] = u8::from(AccountType::Account);
    state.base = TokenAccount {
        mint: MINT.into(),
        owner: WALLET.into(),
        amount: shape.public_amount,
        state: AccountState::Initialized,
        ..TokenAccount::default()
    };
    let confidential = state
        .init_extension::<ConfidentialTransferAccount>(false)
        .unwrap();
    confidential.approved = true.into();
    confidential.elgamal_pubkey = VALID_ELGAMAL_PUBKEY.into();
    confidential.allow_confidential_credits = shape.allow_confidential_credits.into();
    confidential.allow_non_confidential_credits = shape.allow_non_confidential_credits.into();
    confidential.pending_balance_credit_counter = shape.pending_counter.into();
    confidential.maximum_pending_balance_credit_counter = 64u64.into();
    confidential.expected_pending_balance_credit_counter = 1u64.into();
    confidential.actual_pending_balance_credit_counter = 1u64.into();
    state.init_extension::<TransferHookAccount>(false).unwrap();
    state.init_extension::<ImmutableOwner>(false).unwrap();
    state.pack_base();
    data
}

fn capabilities(
    shape: AccountShape,
) -> (
    ReadonlyCanonicalMintCapability,
    ReadonlyConfidentialAccountCapability,
) {
    let mut token_program = TestAccount::program(TOKEN_2022_PROGRAM_ID.to_bytes());
    let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
    let mut mint_account =
        TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), exact_mint_data());
    let mint = authenticate_canonical_mint_account_info(
        &CanonicalMintHostBinding::new(MINT, LAW_PROGRAM, SUPPLY, 9).unwrap(),
        &token_program.info(),
        &zk_program.info(),
        &mint_account.info(),
    )
    .unwrap();

    let mut token_account = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        exact_token_account_data(shape),
    );
    let account = authenticate_confidential_token_account_info(
        &mint,
        &ConfidentialTokenAccountBinding::new(
            TOKEN_ACCOUNT,
            WALLET,
            ConfidentialTokenAccountForm::ImmutableOwner,
        )
        .unwrap(),
        &token_account.info(),
    )
    .unwrap();
    (mint, account)
}

fn snapshot(shape: AccountShape) -> ConfidentialAccountSnapshot {
    ConfidentialAccountSnapshot {
        token_account: TOKEN_ACCOUNT,
        mint: MINT,
        owner: WALLET,
        elgamal_public_key: VALID_ELGAMAL_PUBKEY,
        public_balance: shape.public_amount,
        decryptable_available_balance: 500,
        decryptable_pending_balance: 25,
        pending_balance_credit_counter: shape.pending_counter,
        maximum_pending_balance_credit_counter: 64,
        configured: true,
        approved: true,
        allow_confidential_credits: shape.allow_confidential_credits,
        allow_non_confidential_credits: shape.allow_non_confidential_credits,
    }
}

fn law() -> DailyLawTransferAccounts {
    DailyLawTransferAccounts {
        daily_law_program: LAW_PROGRAM,
        law_state: LAW_STATE,
        hook_validation: HOOK_VALIDATION,
        current_day_finalized: true,
        current_day_open: true,
        resolved_by_official_transfer_hook_adapter: false,
    }
}

fn assert_instruction_eq(
    actual: &solana_instruction::Instruction,
    expected: &solana_instruction::Instruction,
) {
    assert_eq!(actual.program_id, expected.program_id);
    assert_eq!(actual.accounts, expected.accounts);
    assert_eq!(actual.data, expected.data);
}

#[test]
fn truth_boundary_is_exactly_unsigned_and_mainnet_held() {
    assert_eq!(
        PRIVACY_VAULT_NATIVE_ACCOUNT_LOCAL_STATUS,
        "PINNED_TOKEN_2022_ACCOUNT_LOCAL_INSTRUCTION_SUBSET_NO_SIGNING_MAINNET_HOLD"
    );
    let truth = PRIVACY_VAULT_NATIVE_ACCOUNT_LOCAL_TRUTH;
    assert!(truth.feature_gated);
    assert!(truth.canonical_plan_codec_required);
    assert!(truth.runtime_mint_capability_required);
    assert!(truth.runtime_confidential_account_capability_required);
    assert!(truth.exact_token_2022_interface_builder_used);
    assert!(truth.account_owner_cross_binding_required);
    assert!(truth.deposit_instruction_supported);
    assert!(truth.apply_pending_balance_instruction_supported);
    assert!(truth.both_credit_permission_instructions_supported);
    assert!(!truth.configure_account_instruction_supported);
    assert!(!truth.confidential_transfer_instruction_supported);
    assert!(!truth.withdraw_instruction_supported);
    assert!(!truth.empty_and_close_instruction_supported);
    assert!(!truth.proof_context_lifecycle_supported);
    assert!(!truth.official_transfer_hook_resolution_executed);
    assert!(!truth.runtime_daily_law_authenticated);
    assert!(!truth.instruction_signed);
    assert!(!truth.rpc_performed);
    assert!(!truth.instruction_submitted);
    assert!(!truth.chain_state_mutated);
    assert!(!truth.devnet_verified);
    assert!(!truth.activation_ready);
    assert!(truth.mainnet_hold);
}

#[test]
fn deposit_and_apply_pending_balance_match_the_pinned_official_builders() {
    let shape = AccountShape::default();
    let (mint, account) = capabilities(shape);
    let runtime = mint.reference_runtime(LAW_STATE, HOOK_VALIDATION).unwrap();
    let deposit_plan = plan_deposit(&runtime, law(), &snapshot(shape), 125, true).unwrap();
    let prepared = prepare_native_account_local_instruction(
        &mint,
        &account,
        &deposit_plan,
        NativeAccountLocalMaterial::None,
    )
    .unwrap();
    let token_account = Pubkey::new_from_array(TOKEN_ACCOUNT);
    let canonical_mint = Pubkey::new_from_array(MINT);
    let wallet = Pubkey::new_from_array(WALLET);
    let no_multisig_signers: &[&Pubkey] = &[];
    let expected = confidential_instruction::deposit(
        &TOKEN_2022_PROGRAM_ID,
        &token_account,
        &canonical_mint,
        125,
        9,
        &wallet,
        no_multisig_signers,
    )
    .unwrap();
    assert_instruction_eq(prepared.instruction(), &expected);
    assert_eq!(prepared.operation(), PrivacyOperation::Deposit);
    assert_eq!(
        prepared.plan_sha256(),
        privacy_operation_plan_digest(&deposit_plan).unwrap()
    );
    assert_eq!(prepared.token_account(), TOKEN_ACCOUNT);
    assert_eq!(prepared.wallet_owner(), WALLET);
    assert!(!prepared.signs_or_submits());

    let pending_plan =
        plan_apply_pending_balance(&runtime, law(), &snapshot(shape), 2, true).unwrap();
    let new_balance = DecryptableBalance::default();
    let prepared = prepare_native_account_local_instruction(
        &mint,
        &account,
        &pending_plan,
        NativeAccountLocalMaterial::ApplyPendingBalance {
            new_decryptable_available_balance: new_balance,
        },
    )
    .unwrap();
    let expected = confidential_instruction::apply_pending_balance(
        &TOKEN_2022_PROGRAM_ID,
        &token_account,
        2,
        &new_balance,
        &wallet,
        no_multisig_signers,
    )
    .unwrap();
    assert_instruction_eq(prepared.instruction(), &expected);
}

fn assert_credit_toggle(confidential: bool, current: bool, requested: bool) {
    let shape = AccountShape {
        allow_confidential_credits: if confidential { current } else { true },
        allow_non_confidential_credits: if confidential { true } else { current },
        ..AccountShape::default()
    };
    let (mint, account) = capabilities(shape);
    let runtime = mint.reference_runtime(LAW_STATE, HOOK_VALIDATION).unwrap();
    let semantic = snapshot(shape);
    let plan = if confidential {
        plan_set_confidential_credits(&runtime, law(), &semantic, requested, true).unwrap()
    } else {
        plan_set_non_confidential_credits(&runtime, law(), &semantic, requested, true).unwrap()
    };
    let prepared = prepare_native_account_local_instruction(
        &mint,
        &account,
        &plan,
        NativeAccountLocalMaterial::None,
    )
    .unwrap();
    let token_account = Pubkey::new_from_array(TOKEN_ACCOUNT);
    let wallet = Pubkey::new_from_array(WALLET);
    let no_multisig_signers: &[&Pubkey] = &[];
    let expected = match (confidential, requested) {
        (true, true) => confidential_instruction::enable_confidential_credits(
            &TOKEN_2022_PROGRAM_ID,
            &token_account,
            &wallet,
            no_multisig_signers,
        ),
        (true, false) => confidential_instruction::disable_confidential_credits(
            &TOKEN_2022_PROGRAM_ID,
            &token_account,
            &wallet,
            no_multisig_signers,
        ),
        (false, true) => confidential_instruction::enable_non_confidential_credits(
            &TOKEN_2022_PROGRAM_ID,
            &token_account,
            &wallet,
            no_multisig_signers,
        ),
        (false, false) => confidential_instruction::disable_non_confidential_credits(
            &TOKEN_2022_PROGRAM_ID,
            &token_account,
            &wallet,
            no_multisig_signers,
        ),
    }
    .unwrap();
    assert_instruction_eq(prepared.instruction(), &expected);
}

#[test]
fn all_four_credit_permission_instructions_match_the_pinned_official_builders() {
    assert_credit_toggle(true, false, true);
    assert_credit_toggle(true, true, false);
    assert_credit_toggle(false, false, true);
    assert_credit_toggle(false, true, false);
}

#[test]
fn hostile_plan_and_runtime_drift_fail_closed_before_instruction_escape() {
    let shape = AccountShape::default();
    let (mint, account) = capabilities(shape);
    let runtime = mint.reference_runtime(LAW_STATE, HOOK_VALIDATION).unwrap();
    let base_plan = plan_deposit(&runtime, law(), &snapshot(shape), 125, true).unwrap();

    let mut noncanonical = base_plan;
    noncanonical.mainnet_hold = false;
    assert_eq!(
        prepare_native_account_local_instruction(
            &mint,
            &account,
            &noncanonical,
            NativeAccountLocalMaterial::None,
        )
        .unwrap_err(),
        NativeAccountLocalError::PlanCodec(JournalCodecError::InvalidPlanShape)
    );

    let mut wrong_account = base_plan;
    wrong_account.source_token_account = OTHER_ACCOUNT;
    wrong_account.destination_token_account = OTHER_ACCOUNT;
    assert_eq!(
        prepare_native_account_local_instruction(
            &mint,
            &account,
            &wrong_account,
            NativeAccountLocalMaterial::None,
        )
        .unwrap_err(),
        NativeAccountLocalError::RuntimeBindingMismatch
    );

    assert_eq!(
        prepare_native_account_local_instruction(
            &mint,
            &account,
            &base_plan,
            NativeAccountLocalMaterial::ApplyPendingBalance {
                new_decryptable_available_balance: DecryptableBalance::default(),
            },
        )
        .unwrap_err(),
        NativeAccountLocalError::MaterialMismatch
    );

    let low_public_shape = AccountShape {
        public_amount: 100,
        ..shape
    };
    let (low_mint, low_account) = capabilities(low_public_shape);
    assert_eq!(
        prepare_native_account_local_instruction(
            &low_mint,
            &low_account,
            &base_plan,
            NativeAccountLocalMaterial::None,
        )
        .unwrap_err(),
        NativeAccountLocalError::RuntimeAccountStateMismatch
    );
}

#[test]
fn pending_permission_and_unsupported_operation_drift_fail_closed() {
    let shape = AccountShape::default();
    let (mint, account) = capabilities(shape);
    let runtime = mint.reference_runtime(LAW_STATE, HOOK_VALIDATION).unwrap();

    let mut semantic = snapshot(shape);
    semantic.pending_balance_credit_counter = 3;
    let pending_plan = plan_apply_pending_balance(&runtime, law(), &semantic, 3, true).unwrap();
    assert_eq!(
        prepare_native_account_local_instruction(
            &mint,
            &account,
            &pending_plan,
            NativeAccountLocalMaterial::ApplyPendingBalance {
                new_decryptable_available_balance: DecryptableBalance::default(),
            },
        )
        .unwrap_err(),
        NativeAccountLocalError::RuntimeAccountStateMismatch
    );

    semantic = snapshot(shape);
    semantic.allow_confidential_credits = false;
    let enable_plan =
        plan_set_confidential_credits(&runtime, law(), &semantic, true, true).unwrap();
    assert_eq!(
        prepare_native_account_local_instruction(
            &mint,
            &account,
            &enable_plan,
            NativeAccountLocalMaterial::None,
        )
        .unwrap_err(),
        NativeAccountLocalError::RuntimeAccountStateMismatch
    );

    let withdraw_plan =
        plan_withdraw(&runtime, law(), &snapshot(shape), 100, true, [0x77; 32]).unwrap();
    assert_eq!(
        prepare_native_account_local_instruction(
            &mint,
            &account,
            &withdraw_plan,
            NativeAccountLocalMaterial::None,
        )
        .unwrap_err(),
        NativeAccountLocalError::UnsupportedOperation
    );
}

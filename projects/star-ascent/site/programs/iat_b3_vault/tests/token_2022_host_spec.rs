#![cfg(feature = "token-2022-host-compatibility")]

use iat_b3_vault::token_2022_host::*;
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

const MINT: [u8; 32] = [0x31; 32];
const OTHER_MINT: [u8; 32] = [0x32; 32];
const LAW_PROGRAM: [u8; 32] = [0x41; 32];
const LAW_STATE: [u8; 32] = [0x42; 32];
const HOOK_VALIDATION: [u8; 32] = [0x43; 32];
const TOKEN_ACCOUNT: [u8; 32] = [0x51; 32];
const WALLET: [u8; 32] = [0x52; 32];
const OTHER_WALLET: [u8; 32] = [0x53; 32];
const SUPPLY: u64 = 1_000_000_000_000_000_000;

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
    fn data(key: [u8; 32], owner: [u8; 32], data: Vec<u8>) -> Self {
        Self {
            key: key.into(),
            owner: owner.into(),
            lamports: 1,
            data,
            is_signer: false,
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

fn mint_binding() -> CanonicalMintHostBinding {
    CanonicalMintHostBinding::new(MINT, LAW_PROGRAM, SUPPLY, 9).unwrap()
}

fn build_mint_data(
    extension_types: &[ExtensionType],
    hook_program: [u8; 32],
    auto_approve: bool,
) -> Vec<u8> {
    let len = ExtensionType::try_calculate_account_len::<Mint>(extension_types).unwrap();
    let mut data = vec![0; len];
    let mut state = StateWithExtensionsMut::<Mint>::unpack_uninitialized(&mut data).unwrap();
    state.get_account_type_mut()[0] = u8::from(AccountType::Mint);
    state.base = Mint {
        supply: SUPPLY,
        decimals: 9,
        is_initialized: true,
        ..Mint::default()
    };
    for extension_type in extension_types {
        match extension_type {
            ExtensionType::ConfidentialTransferMint => {
                let extension = state
                    .init_extension::<ConfidentialTransferMint>(false)
                    .unwrap();
                extension.auto_approve_new_accounts = auto_approve.into();
            }
            ExtensionType::TransferHook => {
                let extension = state.init_extension::<TransferHook>(false).unwrap();
                extension.program_id = Some(Pubkey::new_from_array(hook_program))
                    .try_into()
                    .unwrap();
            }
            ExtensionType::MintCloseAuthority => {
                state.init_extension::<MintCloseAuthority>(false).unwrap();
            }
            _ => panic!("unsupported mint test extension"),
        }
    }
    state.pack_base();
    data
}

fn exact_mint_data() -> Vec<u8> {
    build_mint_data(
        &[
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
        ],
        LAW_PROGRAM,
        true,
    )
}

fn mutate_mint_confidential(mut mutate: impl FnMut(&mut ConfidentialTransferMint)) -> Vec<u8> {
    let mut data = exact_mint_data();
    let mut state = StateWithExtensionsMut::<Mint>::unpack(&mut data).unwrap();
    let extension = state
        .get_extension_mut::<ConfidentialTransferMint>()
        .unwrap();
    mutate(extension);
    data
}

#[derive(Clone, Copy)]
struct TokenAccountShape {
    mint: [u8; 32],
    wallet: [u8; 32],
    immutable_owner: bool,
    include_confidential: bool,
    include_hook: bool,
    include_cpi_guard: bool,
    approved: bool,
    transferring: bool,
    pending_counter: u64,
    maximum_pending_counter: u64,
}

impl Default for TokenAccountShape {
    fn default() -> Self {
        Self {
            mint: MINT,
            wallet: WALLET,
            immutable_owner: true,
            include_confidential: true,
            include_hook: true,
            include_cpi_guard: false,
            approved: true,
            transferring: false,
            pending_counter: 2,
            maximum_pending_counter: 64,
        }
    }
}

fn build_token_account_data(shape: TokenAccountShape) -> Vec<u8> {
    let mut extension_types = Vec::new();
    if shape.include_confidential {
        extension_types.push(ExtensionType::ConfidentialTransferAccount);
    }
    if shape.include_hook {
        extension_types.push(ExtensionType::TransferHookAccount);
    }
    if shape.immutable_owner {
        extension_types.push(ExtensionType::ImmutableOwner);
    }
    if shape.include_cpi_guard {
        extension_types.push(ExtensionType::CpiGuard);
    }

    let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extension_types).unwrap();
    let mut data = vec![0; len];
    let mut state =
        StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
    state.get_account_type_mut()[0] = u8::from(AccountType::Account);
    state.base = TokenAccount {
        mint: shape.mint.into(),
        owner: shape.wallet.into(),
        amount: 777,
        state: AccountState::Initialized,
        ..TokenAccount::default()
    };
    for extension_type in extension_types {
        match extension_type {
            ExtensionType::ConfidentialTransferAccount => {
                let extension = state
                    .init_extension::<ConfidentialTransferAccount>(false)
                    .unwrap();
                extension.approved = shape.approved.into();
                extension.elgamal_pubkey = [0x71; 32].into();
                extension.allow_confidential_credits = true.into();
                extension.allow_non_confidential_credits = true.into();
                extension.pending_balance_credit_counter = shape.pending_counter.into();
                extension.maximum_pending_balance_credit_counter =
                    shape.maximum_pending_counter.into();
                extension.expected_pending_balance_credit_counter = 1u64.into();
                extension.actual_pending_balance_credit_counter = 1u64.into();
            }
            ExtensionType::TransferHookAccount => {
                let extension = state.init_extension::<TransferHookAccount>(false).unwrap();
                extension.transferring = shape.transferring.into();
            }
            ExtensionType::ImmutableOwner => {
                state.init_extension::<ImmutableOwner>(false).unwrap();
            }
            ExtensionType::CpiGuard => {
                state.init_extension::<CpiGuard>(false).unwrap();
            }
            _ => panic!("unsupported token-account test extension"),
        }
    }
    state.pack_base();
    data
}

fn mutate_account_confidential(
    mut mutate: impl FnMut(&mut ConfidentialTransferAccount),
) -> Vec<u8> {
    let mut data = build_token_account_data(TokenAccountShape::default());
    let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(&mut data).unwrap();
    let extension = state
        .get_extension_mut::<ConfidentialTransferAccount>()
        .unwrap();
    mutate(extension);
    data
}

fn mutate_account_transfer_hook(mut mutate: impl FnMut(&mut TransferHookAccount)) -> Vec<u8> {
    let mut data = build_token_account_data(TokenAccountShape::default());
    let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(&mut data).unwrap();
    let extension = state.get_extension_mut::<TransferHookAccount>().unwrap();
    mutate(extension);
    data
}

fn authenticate_mint(
    mint_account: &mut TestAccount,
) -> Result<ReadonlyCanonicalMintCapability, Token2022HostError> {
    let mut token_program = TestAccount::program(TOKEN_2022_PROGRAM_ID.to_bytes());
    let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
    let token_program_info = token_program.info();
    let zk_program_info = zk_program.info();
    let mint_info = mint_account.info();
    authenticate_canonical_mint_account_info(
        &mint_binding(),
        &token_program_info,
        &zk_program_info,
        &mint_info,
    )
}

fn valid_mint_capability() -> ReadonlyCanonicalMintCapability {
    let mut mint = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), exact_mint_data());
    authenticate_mint(&mut mint).unwrap()
}

fn account_binding() -> ConfidentialTokenAccountBinding {
    ConfidentialTokenAccountBinding::new(
        TOKEN_ACCOUNT,
        WALLET,
        ConfidentialTokenAccountForm::AssociatedImmutableOwner,
    )
    .unwrap()
}

#[test]
fn exact_versions_and_capability_truth_remain_nonactivating() {
    assert_eq!(TOKEN_2022_INTERFACE_VERSION, "2.1.0");
    assert_eq!(TOKEN_2022_INTERFACE_LICENSE, "Apache-2.0");
    assert_eq!(SOLANA_ZK_SDK_VERSION, "4.0.0");
    assert_eq!(SOLANA_ZK_SDK_LICENSE, "Apache-2.0");
    assert_eq!(ZK_ELGAMAL_PUBKEY_LAYOUT_BYTES, 32);
    let complete = std::hint::black_box(TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY_COMPLETE);
    let truth = std::hint::black_box(TOKEN_2022_HOST_COMPATIBILITY_TRUTH);
    assert!(!complete);
    assert!(truth.feature_gated);
    assert!(truth.account_info_reads);
    assert!(!truth.mutable_account_borrows);
    assert!(!truth.account_writes_executed);
    assert!(!truth.token_cpi_executed);
    assert!(!truth.proof_generation_verified);
    assert!(!truth.proof_verification_verified);
    assert!(!truth.elgamal_pubkey_curve_validity_verified);
    assert!(!truth.deployed_program_bytecode_authenticated);
    assert!(!truth.devnet_verified);
    assert!(!truth.release_gate_complete);
    assert!(truth.mainnet_hold);
}

#[test]
fn exact_mint_and_confidential_account_produce_readonly_capabilities() {
    let mint = valid_mint_capability();
    assert_eq!(mint.canonical_mint(), MINT);
    assert_eq!(mint.transfer_hook_program(), LAW_PROGRAM);
    assert_eq!(mint.supply(), SUPPLY);
    assert_eq!(mint.decimals(), 9);
    let reference = mint.reference_runtime(LAW_STATE, HOOK_VALIDATION).unwrap();
    assert_eq!(reference.canonical_mint(), MINT);
    assert_eq!(reference.daily_law_program(), LAW_PROGRAM);
    assert_eq!(
        reference.zk_elgamal_proof_program(),
        zk_elgamal_proof_program::ID.to_bytes()
    );

    let mut account = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(TokenAccountShape::default()),
    );
    let info = account.info();
    let capability =
        authenticate_confidential_token_account_info(&mint, &account_binding(), &info).unwrap();
    assert_eq!(capability.token_account(), TOKEN_ACCOUNT);
    assert_eq!(capability.mint(), MINT);
    assert_eq!(capability.wallet_owner(), WALLET);
    assert_eq!(capability.public_amount(), 777);
    assert_eq!(capability.pending_balance_credit_counter(), 2);
    assert_eq!(capability.maximum_pending_balance_credit_counter(), 64);
    assert!(capability.allow_confidential_credits());
    assert!(capability.allow_non_confidential_credits());
    assert!(capability.immutable_owner());
}

#[test]
fn executable_program_accounts_require_exact_standard_keys() {
    let mut wrong_token = TestAccount::program([0x61; 32]);
    let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
    let mut mint = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), exact_mint_data());
    assert_eq!(
        authenticate_canonical_mint_account_info(
            &mint_binding(),
            &wrong_token.info(),
            &zk_program.info(),
            &mint.info(),
        ),
        Err(Token2022HostError::Token2022ProgramAccountInvalid)
    );

    let mut token_program = TestAccount::program(TOKEN_2022_PROGRAM_ID.to_bytes());
    let mut wrong_zk = TestAccount::program([0x62; 32]);
    let mut mint = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), exact_mint_data());
    assert_eq!(
        authenticate_canonical_mint_account_info(
            &mint_binding(),
            &token_program.info(),
            &wrong_zk.info(),
            &mint.info(),
        ),
        Err(Token2022HostError::ZkProofProgramAccountInvalid)
    );
}

#[test]
fn mint_rejects_hostile_key_owner_length_extension_policy_and_borrow() {
    let mut wrong_key = TestAccount::data(
        OTHER_MINT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        exact_mint_data(),
    );
    assert_eq!(
        authenticate_mint(&mut wrong_key),
        Err(Token2022HostError::MintKeyMismatch)
    );

    let mut wrong_owner = TestAccount::data(MINT, [0x63; 32], exact_mint_data());
    assert_eq!(
        authenticate_mint(&mut wrong_owner),
        Err(Token2022HostError::MintOwnerMismatch)
    );

    let mut padded_data = exact_mint_data();
    padded_data.push(0);
    let mut padded = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), padded_data);
    assert_eq!(
        authenticate_mint(&mut padded),
        Err(Token2022HostError::MintLengthMismatch)
    );

    let missing_hook = build_mint_data(
        &[ExtensionType::ConfidentialTransferMint],
        LAW_PROGRAM,
        true,
    );
    let mut missing = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), missing_hook);
    assert_eq!(
        authenticate_mint(&mut missing),
        Err(Token2022HostError::MintExtensionMismatch)
    );

    let extra_extension = build_mint_data(
        &[
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
            ExtensionType::MintCloseAuthority,
        ],
        LAW_PROGRAM,
        true,
    );
    let mut extra = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), extra_extension);
    assert_eq!(
        authenticate_mint(&mut extra),
        Err(Token2022HostError::MintExtensionMismatch)
    );

    let manual_approval = build_mint_data(
        &[
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
        ],
        LAW_PROGRAM,
        false,
    );
    let mut manual = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), manual_approval);
    assert_eq!(
        authenticate_mint(&mut manual),
        Err(Token2022HostError::ConfidentialMintPolicyMismatch)
    );

    let mut borrowed = TestAccount::data(MINT, TOKEN_2022_PROGRAM_ID.to_bytes(), exact_mint_data());
    let info = borrowed.info();
    let _borrow = info.try_borrow_mut_data().unwrap();
    let mut token_program = TestAccount::program(TOKEN_2022_PROGRAM_ID.to_bytes());
    let mut zk_program = TestAccount::program(zk_elgamal_proof_program::ID.to_bytes());
    assert_eq!(
        authenticate_canonical_mint_account_info(
            &mint_binding(),
            &token_program.info(),
            &zk_program.info(),
            &info,
        ),
        Err(Token2022HostError::AccountBorrowFailed)
    );
}

#[test]
fn confidential_account_rejects_hostile_key_owner_length_extension_and_cross_mint() {
    let mint = valid_mint_capability();

    let mut wrong_key = TestAccount::data(
        [0x64; 32],
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(TokenAccountShape::default()),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(&mint, &account_binding(), &wrong_key.info()),
        Err(Token2022HostError::TokenAccountKeyMismatch)
    );

    let mut wrong_program_owner = TestAccount::data(
        TOKEN_ACCOUNT,
        [0x65; 32],
        build_token_account_data(TokenAccountShape::default()),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(
            &mint,
            &account_binding(),
            &wrong_program_owner.info(),
        ),
        Err(Token2022HostError::TokenAccountProgramOwnerMismatch)
    );

    let mut padded_data = build_token_account_data(TokenAccountShape::default());
    padded_data.push(0);
    let mut padded =
        TestAccount::data(TOKEN_ACCOUNT, TOKEN_2022_PROGRAM_ID.to_bytes(), padded_data);
    assert_eq!(
        authenticate_confidential_token_account_info(&mint, &account_binding(), &padded.info()),
        Err(Token2022HostError::TokenAccountLengthMismatch)
    );

    let extra_shape = TokenAccountShape {
        include_cpi_guard: true,
        ..TokenAccountShape::default()
    };
    let mut extra = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(extra_shape),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(&mint, &account_binding(), &extra.info()),
        Err(Token2022HostError::TokenAccountExtensionMismatch)
    );

    let missing_shape = TokenAccountShape {
        include_confidential: false,
        ..TokenAccountShape::default()
    };
    let mut missing = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(missing_shape),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(&mint, &account_binding(), &missing.info()),
        Err(Token2022HostError::TokenAccountExtensionMismatch)
    );

    let cross_mint_shape = TokenAccountShape {
        mint: OTHER_MINT,
        ..TokenAccountShape::default()
    };
    let mut cross_mint = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(cross_mint_shape),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(&mint, &account_binding(), &cross_mint.info(),),
        Err(Token2022HostError::CrossMintTokenAccount)
    );

    let wrong_wallet_shape = TokenAccountShape {
        wallet: OTHER_WALLET,
        ..TokenAccountShape::default()
    };
    let mut wrong_wallet = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(wrong_wallet_shape),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(
            &mint,
            &account_binding(),
            &wrong_wallet.info(),
        ),
        Err(Token2022HostError::TokenAccountWalletOwnerMismatch)
    );
}

#[test]
fn confidential_account_rejects_borrow_readiness_counter_and_transfer_hazards() {
    let mint = valid_mint_capability();
    let mut borrowed = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(TokenAccountShape::default()),
    );
    let info = borrowed.info();
    let _borrow = info.try_borrow_mut_data().unwrap();
    assert_eq!(
        authenticate_confidential_token_account_info(&mint, &account_binding(), &info),
        Err(Token2022HostError::AccountBorrowFailed)
    );

    let unapproved_shape = TokenAccountShape {
        approved: false,
        ..TokenAccountShape::default()
    };
    let mut unapproved = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(unapproved_shape),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(&mint, &account_binding(), &unapproved.info(),),
        Err(Token2022HostError::ConfidentialAccountNotReady)
    );

    let invalid_counter_shape = TokenAccountShape {
        pending_counter: 65,
        maximum_pending_counter: 64,
        ..TokenAccountShape::default()
    };
    let mut invalid_counter = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(invalid_counter_shape),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(
            &mint,
            &account_binding(),
            &invalid_counter.info(),
        ),
        Err(Token2022HostError::ConfidentialCounterInvalid)
    );

    let transferring_shape = TokenAccountShape {
        transferring: true,
        ..TokenAccountShape::default()
    };
    let mut transferring = TestAccount::data(
        TOKEN_ACCOUNT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        build_token_account_data(transferring_shape),
    );
    assert_eq!(
        authenticate_confidential_token_account_info(
            &mint,
            &account_binding(),
            &transferring.info(),
        ),
        Err(Token2022HostError::TransferInProgress)
    );
}

#[test]
fn noncanonical_pod_boolean_bytes_fail_closed() {
    let mut mint = TestAccount::data(
        MINT,
        TOKEN_2022_PROGRAM_ID.to_bytes(),
        mutate_mint_confidential(|extension| extension.auto_approve_new_accounts.0 = 2),
    );
    assert_eq!(
        authenticate_mint(&mut mint),
        Err(Token2022HostError::NonCanonicalPodBoolean)
    );

    let mint = valid_mint_capability();
    let reject_account = |data| {
        let mut account = TestAccount::data(TOKEN_ACCOUNT, TOKEN_2022_PROGRAM_ID.to_bytes(), data);
        assert_eq!(
            authenticate_confidential_token_account_info(
                &mint,
                &account_binding(),
                &account.info(),
            ),
            Err(Token2022HostError::NonCanonicalPodBoolean)
        );
    };

    reject_account(mutate_account_confidential(|extension| {
        extension.approved.0 = 2;
    }));
    reject_account(mutate_account_confidential(|extension| {
        extension.allow_confidential_credits.0 = 2;
    }));
    reject_account(mutate_account_confidential(|extension| {
        extension.allow_non_confidential_credits.0 = 2;
    }));
    reject_account(mutate_account_transfer_hook(|extension| {
        extension.transferring.0 = 2;
    }));
}

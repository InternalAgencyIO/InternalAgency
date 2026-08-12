//! Exact-version, read-only Token-2022 parsing for economy rehearsal preflight.
//!
//! The parser authenticates immutable observations of the canonical IAT mint
//! and public-balance economic token accounts. It deliberately does not build
//! instructions, borrow account data mutably, execute CPI, attest deployed
//! bytecode, or authorize an economy handler. The Privacy Vault crate is not a
//! dependency: these economy-specific rules are local so the two held runtime
//! boundaries cannot accidentally activate one another.

use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use solana_sdk_ids::zk_elgamal_proof_program;
use spl_token_2022_interface::{
    extension::{
        confidential_transfer::ConfidentialTransferMint,
        immutable_owner::ImmutableOwner,
        transfer_hook::{TransferHook, TransferHookAccount},
        BaseStateWithExtensions, ExtensionType, StateWithExtensions,
    },
    state::{Account as TokenAccount, AccountState, Mint},
    ID as TOKEN_2022_PROGRAM_ID,
};

pub type Key = [u8; 32];

pub const TOKEN_2022_INTERFACE_VERSION: &str = "2.1.0";
pub const SOLANA_ACCOUNT_INFO_VERSION: &str = "3.1.1";
pub const SOLANA_PUBKEY_VERSION: &str = "3.0.0";
pub const SOLANA_SDK_IDS_VERSION: &str = "3.1.0";
pub const SOLANA_ZK_SDK_VERSION: &str = "4.0.0";
pub const ZK_ELGAMAL_PUBKEY_LAYOUT_BYTES: usize =
    core::mem::size_of::<solana_zk_sdk::encryption::pod::elgamal::PodElGamalPubkey>();
pub const ECONOMY_TOKEN_2022_RUNTIME_STATUS: &str =
    "FEATURE_GATED_EXACT_VERSION_READ_ONLY_PUBLIC_ACCOUNT_PREFLIGHT_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EconomyToken2022RuntimeTruth {
    pub feature_gated: bool,
    pub exact_dependency_versions_pinned: bool,
    pub immutable_account_reads: bool,
    pub canonical_mint_parsed: bool,
    pub public_token_accounts_parsed: bool,
    pub exact_base_and_tlv_lengths_required: bool,
    pub canonical_pod_booleans_required: bool,
    pub confidential_balance_accounts_accepted: bool,
    pub mutable_account_borrows: bool,
    pub account_writes_executed: bool,
    pub token_cpi_executed: bool,
    pub deployed_program_bytecode_authenticated: bool,
    pub instruction_abi_frozen: bool,
    pub handler_authorization_complete: bool,
    pub devnet_executed: bool,
    pub mainnet_hold: bool,
}

pub const ECONOMY_TOKEN_2022_RUNTIME_TRUTH: EconomyToken2022RuntimeTruth =
    EconomyToken2022RuntimeTruth {
        feature_gated: true,
        exact_dependency_versions_pinned: true,
        immutable_account_reads: true,
        canonical_mint_parsed: true,
        public_token_accounts_parsed: true,
        exact_base_and_tlv_lengths_required: true,
        canonical_pod_booleans_required: true,
        confidential_balance_accounts_accepted: false,
        mutable_account_borrows: false,
        account_writes_executed: false,
        token_cpi_executed: false,
        deployed_program_bytecode_authenticated: false,
        instruction_abi_frozen: false,
        handler_authorization_complete: false,
        devnet_executed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EconomyToken2022Error {
    InvalidBinding,
    Token2022ProgramAccountInvalid,
    ZkProofProgramAccountInvalid,
    MintAccountFlagsInvalid,
    MintKeyMismatch,
    MintOwnerMismatch,
    AccountBorrowFailed,
    InvalidMintData,
    NonCanonicalPodBoolean,
    MintLengthMismatch,
    MintBaseMismatch,
    MintExtensionMismatch,
    TransferHookBindingMismatch,
    ConfidentialMintPolicyMismatch,
    TokenAccountFlagsInvalid,
    TokenAccountKeyMismatch,
    TokenAccountProgramOwnerMismatch,
    InvalidTokenAccountData,
    TokenAccountLengthMismatch,
    CrossMintTokenAccount,
    TokenAccountWalletOwnerMismatch,
    TokenAccountBaseMismatch,
    TokenAccountExtensionMismatch,
    TransferInProgress,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CanonicalEconomyMintBinding {
    canonical_mint: Key,
    transfer_hook_program: Key,
    expected_supply: u64,
    expected_decimals: u8,
}

impl CanonicalEconomyMintBinding {
    /// Bind rehearsal identities without embedding production program or mint
    /// addresses in this crate.
    pub fn new(
        canonical_mint: Key,
        transfer_hook_program: Key,
        expected_supply: u64,
        expected_decimals: u8,
    ) -> Result<Self, EconomyToken2022Error> {
        let token_program = TOKEN_2022_PROGRAM_ID.to_bytes();
        let zk_program = zk_elgamal_proof_program::ID.to_bytes();
        if canonical_mint == [0; 32]
            || transfer_hook_program == [0; 32]
            || expected_supply == 0
            || canonical_mint == transfer_hook_program
            || canonical_mint == token_program
            || canonical_mint == zk_program
            || transfer_hook_program == token_program
            || transfer_hook_program == zk_program
        {
            return Err(EconomyToken2022Error::InvalidBinding);
        }
        Ok(Self {
            canonical_mint,
            transfer_hook_program,
            expected_supply,
            expected_decimals,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyCanonicalEconomyMint {
    token_2022_program: Key,
    zk_elgamal_proof_program: Key,
    canonical_mint: Key,
    transfer_hook_program: Key,
    supply: u64,
    decimals: u8,
    data_len: usize,
}

impl ReadonlyCanonicalEconomyMint {
    pub const fn token_2022_program(&self) -> Key {
        self.token_2022_program
    }

    pub const fn zk_elgamal_proof_program(&self) -> Key {
        self.zk_elgamal_proof_program
    }

    pub const fn canonical_mint(&self) -> Key {
        self.canonical_mint
    }

    pub const fn transfer_hook_program(&self) -> Key {
        self.transfer_hook_program
    }

    pub const fn supply(&self) -> u64 {
        self.supply
    }

    pub const fn decimals(&self) -> u8 {
        self.decimals
    }

    pub const fn data_len(&self) -> usize {
        self.data_len
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PublicTokenAccountForm {
    Standalone,
    ImmutableOwner,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicTokenAccountBinding {
    token_account: Key,
    wallet_owner: Key,
    form: PublicTokenAccountForm,
    expected_writable: bool,
}

impl PublicTokenAccountBinding {
    pub fn new(
        token_account: Key,
        wallet_owner: Key,
        form: PublicTokenAccountForm,
        expected_writable: bool,
    ) -> Result<Self, EconomyToken2022Error> {
        if token_account == [0; 32]
            || wallet_owner == [0; 32]
            || token_account == wallet_owner
            || token_account == TOKEN_2022_PROGRAM_ID.to_bytes()
            || wallet_owner == TOKEN_2022_PROGRAM_ID.to_bytes()
        {
            return Err(EconomyToken2022Error::InvalidBinding);
        }
        Ok(Self {
            token_account,
            wallet_owner,
            form,
            expected_writable,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyPublicTokenAccount {
    token_account: Key,
    mint: Key,
    wallet_owner: Key,
    public_amount: u64,
    immutable_owner: bool,
    observed_writable: bool,
    data_len: usize,
}

impl ReadonlyPublicTokenAccount {
    pub const fn token_account(&self) -> Key {
        self.token_account
    }

    pub const fn mint(&self) -> Key {
        self.mint
    }

    pub const fn wallet_owner(&self) -> Key {
        self.wallet_owner
    }

    pub const fn public_amount(&self) -> u64 {
        self.public_amount
    }

    pub const fn immutable_owner(&self) -> bool {
        self.immutable_owner
    }

    /// This records only the transaction meta flag. The parser never takes a
    /// mutable borrow and cannot write the account.
    pub const fn observed_writable(&self) -> bool {
        self.observed_writable
    }

    pub const fn data_len(&self) -> usize {
        self.data_len
    }
}

fn exact_extensions(actual: &[ExtensionType], expected: &[ExtensionType]) -> bool {
    actual.len() == expected.len()
        && expected.iter().all(|expected_type| {
            actual
                .iter()
                .filter(|value| *value == expected_type)
                .count()
                == 1
        })
}

fn require_program_account(
    account: &AccountInfo<'_>,
    expected_key: Key,
    error: EconomyToken2022Error,
) -> Result<(), EconomyToken2022Error> {
    if account.key.to_bytes() != expected_key
        || !account.executable
        || account.is_writable
        || account.is_signer
    {
        return Err(error);
    }
    Ok(())
}

/// Authenticate the exact held canonical mint layout. Standard executable IDs
/// are checked, but this is not deployed bytecode or release-hash attestation.
pub fn authenticate_canonical_economy_mint_account_info(
    binding: &CanonicalEconomyMintBinding,
    token_2022_program: &AccountInfo<'_>,
    zk_elgamal_proof_program: &AccountInfo<'_>,
    mint: &AccountInfo<'_>,
) -> Result<ReadonlyCanonicalEconomyMint, EconomyToken2022Error> {
    let token_program_key = TOKEN_2022_PROGRAM_ID.to_bytes();
    let zk_program_key = zk_elgamal_proof_program::ID.to_bytes();
    require_program_account(
        token_2022_program,
        token_program_key,
        EconomyToken2022Error::Token2022ProgramAccountInvalid,
    )?;
    require_program_account(
        zk_elgamal_proof_program,
        zk_program_key,
        EconomyToken2022Error::ZkProofProgramAccountInvalid,
    )?;
    if mint.is_writable || mint.is_signer || mint.executable {
        return Err(EconomyToken2022Error::MintAccountFlagsInvalid);
    }
    if mint.key.to_bytes() != binding.canonical_mint {
        return Err(EconomyToken2022Error::MintKeyMismatch);
    }
    if mint.owner.to_bytes() != token_program_key {
        return Err(EconomyToken2022Error::MintOwnerMismatch);
    }

    let data = mint
        .try_borrow_data()
        .map_err(|_| EconomyToken2022Error::AccountBorrowFailed)?;
    let state = StateWithExtensions::<Mint>::unpack(&data)
        .map_err(|_| EconomyToken2022Error::InvalidMintData)?;
    let exact_len = state
        .try_get_account_len()
        .map_err(|_| EconomyToken2022Error::InvalidMintData)?;
    if exact_len != data.len() {
        return Err(EconomyToken2022Error::MintLengthMismatch);
    }
    if !state.base.is_initialized
        || state.base.supply != binding.expected_supply
        || state.base.decimals != binding.expected_decimals
        || !state.base.mint_authority.is_none()
        || !state.base.freeze_authority.is_none()
    {
        return Err(EconomyToken2022Error::MintBaseMismatch);
    }

    let extension_types = state
        .get_extension_types()
        .map_err(|_| EconomyToken2022Error::InvalidMintData)?;
    let expected_extensions = [
        ExtensionType::ConfidentialTransferMint,
        ExtensionType::TransferHook,
    ];
    if !exact_extensions(&extension_types, &expected_extensions) {
        return Err(EconomyToken2022Error::MintExtensionMismatch);
    }
    let transfer_hook = state
        .get_extension::<TransferHook>()
        .map_err(|_| EconomyToken2022Error::MintExtensionMismatch)?;
    if Option::<Pubkey>::from(transfer_hook.authority).is_some()
        || Option::<Pubkey>::from(transfer_hook.program_id).map(|key| key.to_bytes())
            != Some(binding.transfer_hook_program)
    {
        return Err(EconomyToken2022Error::TransferHookBindingMismatch);
    }
    let confidential = state
        .get_extension::<ConfidentialTransferMint>()
        .map_err(|_| EconomyToken2022Error::MintExtensionMismatch)?;
    if confidential.auto_approve_new_accounts.0 > 1 {
        return Err(EconomyToken2022Error::NonCanonicalPodBoolean);
    }
    if Option::<Pubkey>::from(confidential.authority).is_some()
        || !bool::from(confidential.auto_approve_new_accounts)
        || confidential.auditor_elgamal_pubkey != Default::default()
    {
        return Err(EconomyToken2022Error::ConfidentialMintPolicyMismatch);
    }

    Ok(ReadonlyCanonicalEconomyMint {
        token_2022_program: token_program_key,
        zk_elgamal_proof_program: zk_program_key,
        canonical_mint: binding.canonical_mint,
        transfer_hook_program: binding.transfer_hook_program,
        supply: state.base.supply,
        decimals: state.base.decimals,
        data_len: data.len(),
    })
}

/// Authenticate one public-balance token account against the canonical mint.
/// Confidential account extensions are rejected so `public_amount` is the
/// complete accepted balance surface for this economy capability.
pub fn authenticate_public_token_account_info(
    mint: &ReadonlyCanonicalEconomyMint,
    binding: &PublicTokenAccountBinding,
    token_account: &AccountInfo<'_>,
) -> Result<ReadonlyPublicTokenAccount, EconomyToken2022Error> {
    if token_account.is_signer
        || token_account.executable
        || token_account.is_writable != binding.expected_writable
    {
        return Err(EconomyToken2022Error::TokenAccountFlagsInvalid);
    }
    if token_account.key.to_bytes() != binding.token_account {
        return Err(EconomyToken2022Error::TokenAccountKeyMismatch);
    }
    if token_account.owner.to_bytes() != mint.token_2022_program {
        return Err(EconomyToken2022Error::TokenAccountProgramOwnerMismatch);
    }

    let data = token_account
        .try_borrow_data()
        .map_err(|_| EconomyToken2022Error::AccountBorrowFailed)?;
    let state = StateWithExtensions::<TokenAccount>::unpack(&data)
        .map_err(|_| EconomyToken2022Error::InvalidTokenAccountData)?;
    let exact_len = state
        .try_get_account_len()
        .map_err(|_| EconomyToken2022Error::InvalidTokenAccountData)?;
    if exact_len != data.len() {
        return Err(EconomyToken2022Error::TokenAccountLengthMismatch);
    }
    if state.base.mint.to_bytes() != mint.canonical_mint {
        return Err(EconomyToken2022Error::CrossMintTokenAccount);
    }
    if state.base.owner.to_bytes() != binding.wallet_owner {
        return Err(EconomyToken2022Error::TokenAccountWalletOwnerMismatch);
    }
    if state.base.state != AccountState::Initialized
        || state.base.delegate.is_some()
        || state.base.delegated_amount != 0
        || state.base.is_native.is_some()
        || state.base.close_authority.is_some()
    {
        return Err(EconomyToken2022Error::TokenAccountBaseMismatch);
    }

    let extension_types = state
        .get_extension_types()
        .map_err(|_| EconomyToken2022Error::InvalidTokenAccountData)?;
    let immutable_owner = matches!(binding.form, PublicTokenAccountForm::ImmutableOwner);
    let expected_standalone = [ExtensionType::TransferHookAccount];
    let expected_immutable = [
        ExtensionType::TransferHookAccount,
        ExtensionType::ImmutableOwner,
    ];
    let expected_extensions = if immutable_owner {
        expected_immutable.as_slice()
    } else {
        expected_standalone.as_slice()
    };
    if !exact_extensions(&extension_types, expected_extensions) {
        return Err(EconomyToken2022Error::TokenAccountExtensionMismatch);
    }
    if immutable_owner {
        state
            .get_extension::<ImmutableOwner>()
            .map_err(|_| EconomyToken2022Error::TokenAccountExtensionMismatch)?;
    }
    let transfer_hook = state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| EconomyToken2022Error::TokenAccountExtensionMismatch)?;
    if transfer_hook.transferring.0 > 1 {
        return Err(EconomyToken2022Error::NonCanonicalPodBoolean);
    }
    if bool::from(transfer_hook.transferring) {
        return Err(EconomyToken2022Error::TransferInProgress);
    }

    Ok(ReadonlyPublicTokenAccount {
        token_account: binding.token_account,
        mint: mint.canonical_mint,
        wallet_owner: binding.wallet_owner,
        public_amount: state.base.amount,
        immutable_owner,
        observed_writable: token_account.is_writable,
        data_len: data.len(),
    })
}

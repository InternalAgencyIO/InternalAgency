//! Exact-version, read-only host parsing for the held Privacy Vault boundary.
//!
//! This feature authenticates immutable `AccountInfo` observations against the
//! Token-2022 v2.1.0 layouts already pinned by the native Daily Law adapter. It
//! deliberately stops before proof generation or verification, bytecode
//! attestation, instruction construction, CPI, mutation, or dispatch. In
//! particular, an executable program account with the expected standard ID is
//! not proof of the deployed program-data hash or release version.

use crate::{
    validate_reference_runtime, Key, PrivacyRuntimeFacts, PrivacyVaultError, ReferenceRuntime,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use solana_sdk_ids::zk_elgamal_proof_program;
use solana_zk_sdk::encryption::elgamal::{ElGamalCiphertext, ElGamalPubkey};
use spl_token_2022_interface::{
    extension::{
        confidential_transfer::{ConfidentialTransferAccount, ConfidentialTransferMint},
        immutable_owner::ImmutableOwner,
        transfer_hook::{TransferHook, TransferHookAccount},
        BaseStateWithExtensions, ExtensionType, StateWithExtensions,
    },
    state::{Account as TokenAccount, AccountState, Mint},
    ID as TOKEN_2022_PROGRAM_ID,
};

pub const TOKEN_2022_INTERFACE_VERSION: &str = "2.1.0";
pub const TOKEN_2022_INTERFACE_LICENSE: &str = "Apache-2.0";
pub const SOLANA_ZK_SDK_VERSION: &str = "4.0.0";
pub const SOLANA_ZK_SDK_LICENSE: &str = "Apache-2.0";
pub const ZK_ELGAMAL_PUBKEY_LAYOUT_BYTES: usize =
    core::mem::size_of::<solana_zk_sdk::encryption::pod::elgamal::PodElGamalPubkey>();
pub const TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY_STATUS: &str =
    "EXACT_VERSION_READ_ONLY_HOST_LAYOUTS_VERIFIED_GATE_INCOMPLETE_MAINNET_HOLD";
pub const TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY_COMPLETE: bool = false;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Token2022HostCompatibilityTruth {
    pub feature_gated: bool,
    pub account_info_reads: bool,
    pub exact_token_2022_interface_pinned: bool,
    pub exact_zk_sdk_layout_pinned: bool,
    pub token_and_zk_standard_ids_checked: bool,
    pub mint_base_and_extensions_parsed: bool,
    pub confidential_account_base_and_extensions_parsed: bool,
    pub exact_account_lengths_required: bool,
    pub mutable_account_borrows: bool,
    pub account_writes_executed: bool,
    pub token_cpi_executed: bool,
    pub proof_generation_verified: bool,
    pub proof_verification_verified: bool,
    pub elgamal_pubkey_curve_validity_verified: bool,
    pub elgamal_ciphertext_curve_validity_verified: bool,
    pub deployed_program_bytecode_authenticated: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub production_identity_binding_frozen: bool,
    pub privacy_vault_lifecycle_verified: bool,
    pub devnet_verified: bool,
    pub release_gate_complete: bool,
    pub mainnet_hold: bool,
}

pub const TOKEN_2022_HOST_COMPATIBILITY_TRUTH: Token2022HostCompatibilityTruth =
    Token2022HostCompatibilityTruth {
        feature_gated: true,
        account_info_reads: true,
        exact_token_2022_interface_pinned: true,
        exact_zk_sdk_layout_pinned: true,
        token_and_zk_standard_ids_checked: true,
        mint_base_and_extensions_parsed: true,
        confidential_account_base_and_extensions_parsed: true,
        exact_account_lengths_required: true,
        mutable_account_borrows: false,
        account_writes_executed: false,
        token_cpi_executed: false,
        proof_generation_verified: false,
        proof_verification_verified: false,
        elgamal_pubkey_curve_validity_verified: true,
        elgamal_ciphertext_curve_validity_verified: true,
        deployed_program_bytecode_authenticated: false,
        instruction_abi_frozen: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        production_identity_binding_frozen: false,
        privacy_vault_lifecycle_verified: false,
        devnet_verified: false,
        release_gate_complete: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Token2022HostError {
    InvalidBinding,
    Token2022ProgramAccountInvalid,
    ZkProofProgramAccountInvalid,
    DataAccountMustBeReadonly,
    ExecutableDataAccount,
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
    TokenAccountKeyMismatch,
    TokenAccountProgramOwnerMismatch,
    InvalidTokenAccountData,
    TokenAccountLengthMismatch,
    CrossMintTokenAccount,
    TokenAccountWalletOwnerMismatch,
    TokenAccountBaseMismatch,
    TokenAccountExtensionMismatch,
    ConfidentialAccountNotReady,
    ElGamalPubkeyCurveInvalid,
    ElGamalCiphertextCurveInvalid,
    ConfidentialCounterInvalid,
    TransferInProgress,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CanonicalMintHostBinding {
    canonical_mint: Key,
    transfer_hook_program: Key,
    expected_supply: u64,
    expected_decimals: u8,
}

impl CanonicalMintHostBinding {
    /// Bind expected IAT identities and base values without freezing any
    /// production mint or Daily Law program ID in this crate.
    pub fn new(
        canonical_mint: Key,
        transfer_hook_program: Key,
        expected_supply: u64,
        expected_decimals: u8,
    ) -> Result<Self, Token2022HostError> {
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
            return Err(Token2022HostError::InvalidBinding);
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
pub struct ReadonlyCanonicalMintCapability {
    token_2022_program: Key,
    zk_elgamal_proof_program: Key,
    canonical_mint: Key,
    transfer_hook_program: Key,
    supply: u64,
    decimals: u8,
    data_len: usize,
}

impl ReadonlyCanonicalMintCapability {
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

    /// Feed mint facts proven by this read-only parser into the existing
    /// reference planner boundary. The law-state and hook-validation addresses
    /// remain caller-supplied reference identities, not authenticated accounts.
    pub fn reference_runtime(
        &self,
        law_state: Key,
        hook_validation: Key,
    ) -> Result<ReferenceRuntime, PrivacyVaultError> {
        validate_reference_runtime(PrivacyRuntimeFacts {
            token_2022_program: self.token_2022_program,
            zk_elgamal_proof_program: self.zk_elgamal_proof_program,
            canonical_mint: self.canonical_mint,
            daily_law_program: self.transfer_hook_program,
            law_state,
            hook_validation,
            has_confidential_transfer_mint: true,
            has_transfer_hook: true,
            has_any_other_mint_extension: false,
            auto_approve_new_confidential_accounts: true,
            confidential_mint_authority_is_none: true,
            transfer_hook_authority_is_none: true,
            global_auditor_is_none: true,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfidentialTokenAccountForm {
    Standalone,
    ImmutableOwner,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfidentialTokenAccountBinding {
    token_account: Key,
    wallet_owner: Key,
    form: ConfidentialTokenAccountForm,
}

impl ConfidentialTokenAccountBinding {
    pub fn new(
        token_account: Key,
        wallet_owner: Key,
        form: ConfidentialTokenAccountForm,
    ) -> Result<Self, Token2022HostError> {
        if token_account == [0; 32]
            || wallet_owner == [0; 32]
            || token_account == wallet_owner
            || token_account == TOKEN_2022_PROGRAM_ID.to_bytes()
            || wallet_owner == TOKEN_2022_PROGRAM_ID.to_bytes()
        {
            return Err(Token2022HostError::InvalidBinding);
        }
        Ok(Self {
            token_account,
            wallet_owner,
            form,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadonlyConfidentialAccountCapability {
    token_account: Key,
    mint: Key,
    wallet_owner: Key,
    public_amount: u64,
    allow_confidential_credits: bool,
    allow_non_confidential_credits: bool,
    pending_balance_credit_counter: u64,
    maximum_pending_balance_credit_counter: u64,
    expected_pending_balance_credit_counter: u64,
    actual_pending_balance_credit_counter: u64,
    immutable_owner: bool,
    data_len: usize,
}

impl ReadonlyConfidentialAccountCapability {
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

    pub const fn allow_confidential_credits(&self) -> bool {
        self.allow_confidential_credits
    }

    pub const fn allow_non_confidential_credits(&self) -> bool {
        self.allow_non_confidential_credits
    }

    pub const fn pending_balance_credit_counter(&self) -> u64 {
        self.pending_balance_credit_counter
    }

    pub const fn maximum_pending_balance_credit_counter(&self) -> u64 {
        self.maximum_pending_balance_credit_counter
    }

    pub const fn expected_pending_balance_credit_counter(&self) -> u64 {
        self.expected_pending_balance_credit_counter
    }

    pub const fn actual_pending_balance_credit_counter(&self) -> u64 {
        self.actual_pending_balance_credit_counter
    }

    pub const fn immutable_owner(&self) -> bool {
        self.immutable_owner
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
    error: Token2022HostError,
) -> Result<(), Token2022HostError> {
    if account.key.to_bytes() != expected_key
        || !account.executable
        || account.is_writable
        || account.is_signer
    {
        return Err(error);
    }
    Ok(())
}

fn require_readonly_data_account(account: &AccountInfo<'_>) -> Result<(), Token2022HostError> {
    if account.is_writable {
        return Err(Token2022HostError::DataAccountMustBeReadonly);
    }
    if account.executable {
        return Err(Token2022HostError::ExecutableDataAccount);
    }
    Ok(())
}

/// Authenticate the exact final mint shape from immutable AccountInfo values.
/// Program identities and executable flags are checked, but deployed program
/// bytecode is intentionally outside this capability.
pub fn authenticate_canonical_mint_account_info(
    binding: &CanonicalMintHostBinding,
    token_2022_program: &AccountInfo<'_>,
    zk_elgamal_proof_program: &AccountInfo<'_>,
    mint: &AccountInfo<'_>,
) -> Result<ReadonlyCanonicalMintCapability, Token2022HostError> {
    let token_program_key = TOKEN_2022_PROGRAM_ID.to_bytes();
    let zk_program_key = zk_elgamal_proof_program::ID.to_bytes();
    require_program_account(
        token_2022_program,
        token_program_key,
        Token2022HostError::Token2022ProgramAccountInvalid,
    )?;
    require_program_account(
        zk_elgamal_proof_program,
        zk_program_key,
        Token2022HostError::ZkProofProgramAccountInvalid,
    )?;
    require_readonly_data_account(mint)?;
    if mint.key.to_bytes() != binding.canonical_mint {
        return Err(Token2022HostError::MintKeyMismatch);
    }
    if mint.owner.to_bytes() != token_program_key {
        return Err(Token2022HostError::MintOwnerMismatch);
    }

    let data = mint
        .try_borrow_data()
        .map_err(|_| Token2022HostError::AccountBorrowFailed)?;
    let state = StateWithExtensions::<Mint>::unpack(&data)
        .map_err(|_| Token2022HostError::InvalidMintData)?;
    let exact_len = state
        .try_get_account_len()
        .map_err(|_| Token2022HostError::InvalidMintData)?;
    if exact_len != data.len() {
        return Err(Token2022HostError::MintLengthMismatch);
    }
    if state.base.supply != binding.expected_supply
        || state.base.decimals != binding.expected_decimals
        || !state.base.mint_authority.is_none()
        || !state.base.freeze_authority.is_none()
    {
        return Err(Token2022HostError::MintBaseMismatch);
    }

    let extension_types = state
        .get_extension_types()
        .map_err(|_| Token2022HostError::InvalidMintData)?;
    let expected_extensions = [
        ExtensionType::ConfidentialTransferMint,
        ExtensionType::TransferHook,
    ];
    if !exact_extensions(&extension_types, &expected_extensions) {
        return Err(Token2022HostError::MintExtensionMismatch);
    }
    let transfer_hook = state
        .get_extension::<TransferHook>()
        .map_err(|_| Token2022HostError::MintExtensionMismatch)?;
    if Option::<Pubkey>::from(transfer_hook.authority).is_some()
        || Option::<Pubkey>::from(transfer_hook.program_id).map(|value| value.to_bytes())
            != Some(binding.transfer_hook_program)
    {
        return Err(Token2022HostError::TransferHookBindingMismatch);
    }
    let confidential = state
        .get_extension::<ConfidentialTransferMint>()
        .map_err(|_| Token2022HostError::MintExtensionMismatch)?;
    if confidential.auto_approve_new_accounts.0 > 1 {
        return Err(Token2022HostError::NonCanonicalPodBoolean);
    }
    if Option::<Pubkey>::from(confidential.authority).is_some()
        || !bool::from(confidential.auto_approve_new_accounts)
        || confidential.auditor_elgamal_pubkey != Default::default()
    {
        return Err(Token2022HostError::ConfidentialMintPolicyMismatch);
    }

    Ok(ReadonlyCanonicalMintCapability {
        token_2022_program: token_program_key,
        zk_elgamal_proof_program: zk_program_key,
        canonical_mint: binding.canonical_mint,
        transfer_hook_program: binding.transfer_hook_program,
        supply: state.base.supply,
        decimals: state.base.decimals,
        data_len: data.len(),
    })
}

/// Authenticate one configured, ready confidential token account against a
/// previously authenticated mint capability. The configured ElGamal public key
/// and all three persisted ElGamal balance ciphertexts must decode to Ristretto
/// points. Ciphertext decryption and proof validity are deliberately not
/// represented by the returned capability.
pub fn authenticate_confidential_token_account_info(
    mint_capability: &ReadonlyCanonicalMintCapability,
    binding: &ConfidentialTokenAccountBinding,
    token_account: &AccountInfo<'_>,
) -> Result<ReadonlyConfidentialAccountCapability, Token2022HostError> {
    require_readonly_data_account(token_account)?;
    if token_account.key.to_bytes() != binding.token_account {
        return Err(Token2022HostError::TokenAccountKeyMismatch);
    }
    if token_account.owner.to_bytes() != mint_capability.token_2022_program {
        return Err(Token2022HostError::TokenAccountProgramOwnerMismatch);
    }

    let data = token_account
        .try_borrow_data()
        .map_err(|_| Token2022HostError::AccountBorrowFailed)?;
    let state = StateWithExtensions::<TokenAccount>::unpack(&data)
        .map_err(|_| Token2022HostError::InvalidTokenAccountData)?;
    let exact_len = state
        .try_get_account_len()
        .map_err(|_| Token2022HostError::InvalidTokenAccountData)?;
    if exact_len != data.len() {
        return Err(Token2022HostError::TokenAccountLengthMismatch);
    }
    if state.base.mint.to_bytes() != mint_capability.canonical_mint {
        return Err(Token2022HostError::CrossMintTokenAccount);
    }
    if state.base.owner.to_bytes() != binding.wallet_owner {
        return Err(Token2022HostError::TokenAccountWalletOwnerMismatch);
    }
    if state.base.state != AccountState::Initialized
        || state.base.delegate.is_some()
        || state.base.delegated_amount != 0
        || state.base.is_native.is_some()
        || state.base.close_authority.is_some()
    {
        return Err(Token2022HostError::TokenAccountBaseMismatch);
    }

    let extension_types = state
        .get_extension_types()
        .map_err(|_| Token2022HostError::InvalidTokenAccountData)?;
    let immutable_owner = matches!(binding.form, ConfidentialTokenAccountForm::ImmutableOwner);
    let expected_standalone = [
        ExtensionType::ConfidentialTransferAccount,
        ExtensionType::TransferHookAccount,
    ];
    let expected_immutable_owner = [
        ExtensionType::ConfidentialTransferAccount,
        ExtensionType::TransferHookAccount,
        ExtensionType::ImmutableOwner,
    ];
    let expected_extensions = if immutable_owner {
        expected_immutable_owner.as_slice()
    } else {
        expected_standalone.as_slice()
    };
    if !exact_extensions(&extension_types, expected_extensions) {
        return Err(Token2022HostError::TokenAccountExtensionMismatch);
    }
    if immutable_owner {
        state
            .get_extension::<ImmutableOwner>()
            .map_err(|_| Token2022HostError::TokenAccountExtensionMismatch)?;
    }

    let transfer_hook = state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| Token2022HostError::TokenAccountExtensionMismatch)?;
    if transfer_hook.transferring.0 > 1 {
        return Err(Token2022HostError::NonCanonicalPodBoolean);
    }
    if bool::from(transfer_hook.transferring) {
        return Err(Token2022HostError::TransferInProgress);
    }
    let confidential = state
        .get_extension::<ConfidentialTransferAccount>()
        .map_err(|_| Token2022HostError::TokenAccountExtensionMismatch)?;
    if confidential.approved.0 > 1
        || confidential.allow_confidential_credits.0 > 1
        || confidential.allow_non_confidential_credits.0 > 1
    {
        return Err(Token2022HostError::NonCanonicalPodBoolean);
    }
    if !bool::from(confidential.approved) || confidential.elgamal_pubkey == Default::default() {
        return Err(Token2022HostError::ConfidentialAccountNotReady);
    }
    ElGamalPubkey::try_from(confidential.elgamal_pubkey)
        .map_err(|_| Token2022HostError::ElGamalPubkeyCurveInvalid)?;
    for ciphertext in [
        confidential.pending_balance_lo,
        confidential.pending_balance_hi,
        confidential.available_balance,
    ] {
        ElGamalCiphertext::try_from(ciphertext)
            .map_err(|_| Token2022HostError::ElGamalCiphertextCurveInvalid)?;
    }
    let pending_balance_credit_counter = u64::from(confidential.pending_balance_credit_counter);
    let maximum_pending_balance_credit_counter =
        u64::from(confidential.maximum_pending_balance_credit_counter);
    if maximum_pending_balance_credit_counter == 0
        || pending_balance_credit_counter > maximum_pending_balance_credit_counter
    {
        return Err(Token2022HostError::ConfidentialCounterInvalid);
    }

    Ok(ReadonlyConfidentialAccountCapability {
        token_account: binding.token_account,
        mint: mint_capability.canonical_mint,
        wallet_owner: binding.wallet_owner,
        public_amount: state.base.amount,
        allow_confidential_credits: bool::from(confidential.allow_confidential_credits),
        allow_non_confidential_credits: bool::from(confidential.allow_non_confidential_credits),
        pending_balance_credit_counter,
        maximum_pending_balance_credit_counter,
        expected_pending_balance_credit_counter: u64::from(
            confidential.expected_pending_balance_credit_counter,
        ),
        actual_pending_balance_credit_counter: u64::from(
            confidential.actual_pending_balance_credit_counter,
        ),
        immutable_owner,
        data_len: data.len(),
    })
}

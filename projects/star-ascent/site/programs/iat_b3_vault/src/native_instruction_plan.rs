//! Exact-version Token-2022 instruction construction for the configured,
//! account-local Privacy Vault subset.
//!
//! This module deliberately covers only deposit, apply-pending-balance, and
//! confidential/non-confidential credit toggles. These operations need no ZK
//! proof-context instruction and do not change token ownership. The caller must
//! first supply the canonical plan codec plus read-only runtime mint/account
//! capabilities produced by [`crate::token_2022_host`]. Configure, confidential
//! transfer, withdraw, empty/close, proof-context lifecycle, hook resolution,
//! signing, submission, and chain confirmation remain outside this boundary.

use crate::journal_codec::{privacy_operation_plan_digest, JournalCodecError};
use crate::token_2022_host::{
    ReadonlyCanonicalMintCapability, ReadonlyConfidentialAccountCapability,
};
use crate::{Digest, PrivacyOperation, PrivacyOperationPlan};
use solana_instruction::Instruction;
use solana_pubkey::Pubkey;
use spl_token_2022_interface::{
    extension::confidential_transfer::{
        instruction as confidential_instruction, DecryptableBalance,
    },
    ID as TOKEN_2022_PROGRAM_ID,
};

pub const PRIVACY_VAULT_NATIVE_ACCOUNT_LOCAL_STATUS: &str =
    "PINNED_TOKEN_2022_ACCOUNT_LOCAL_INSTRUCTION_SUBSET_NO_SIGNING_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PrivacyVaultNativeAccountLocalTruth {
    pub feature_gated: bool,
    pub canonical_plan_codec_required: bool,
    pub runtime_mint_capability_required: bool,
    pub runtime_confidential_account_capability_required: bool,
    pub exact_token_2022_interface_builder_used: bool,
    pub account_owner_cross_binding_required: bool,
    pub deposit_instruction_supported: bool,
    pub apply_pending_balance_instruction_supported: bool,
    pub both_credit_permission_instructions_supported: bool,
    pub configure_account_instruction_supported: bool,
    pub confidential_transfer_instruction_supported: bool,
    pub withdraw_instruction_supported: bool,
    pub empty_and_close_instruction_supported: bool,
    pub proof_context_lifecycle_supported: bool,
    pub official_transfer_hook_resolution_executed: bool,
    pub runtime_daily_law_authenticated: bool,
    pub instruction_signed: bool,
    pub rpc_performed: bool,
    pub instruction_submitted: bool,
    pub chain_state_mutated: bool,
    pub devnet_verified: bool,
    pub activation_ready: bool,
    pub mainnet_hold: bool,
}

pub const PRIVACY_VAULT_NATIVE_ACCOUNT_LOCAL_TRUTH: PrivacyVaultNativeAccountLocalTruth =
    PrivacyVaultNativeAccountLocalTruth {
        feature_gated: true,
        canonical_plan_codec_required: true,
        runtime_mint_capability_required: true,
        runtime_confidential_account_capability_required: true,
        exact_token_2022_interface_builder_used: true,
        account_owner_cross_binding_required: true,
        deposit_instruction_supported: true,
        apply_pending_balance_instruction_supported: true,
        both_credit_permission_instructions_supported: true,
        configure_account_instruction_supported: false,
        confidential_transfer_instruction_supported: false,
        withdraw_instruction_supported: false,
        empty_and_close_instruction_supported: false,
        proof_context_lifecycle_supported: false,
        official_transfer_hook_resolution_executed: false,
        runtime_daily_law_authenticated: false,
        instruction_signed: false,
        rpc_performed: false,
        instruction_submitted: false,
        chain_state_mutated: false,
        devnet_verified: false,
        activation_ready: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeAccountLocalMaterial {
    None,
    ApplyPendingBalance {
        new_decryptable_available_balance: DecryptableBalance,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeAccountLocalError {
    PlanCodec(JournalCodecError),
    UnsupportedOperation,
    RuntimeBindingMismatch,
    RuntimeAccountStateMismatch,
    MaterialMismatch,
    TokenInstructionBuildFailed,
}

impl From<JournalCodecError> for NativeAccountLocalError {
    fn from(value: JournalCodecError) -> Self {
        Self::PlanCodec(value)
    }
}

/// Opaque, inert instruction-plan receipt. The returned instruction is an
/// unsigned value only; this crate exposes no signing, RPC, or submission API.
#[derive(Clone, Debug)]
pub struct PreparedNativeAccountLocalInstruction {
    operation: PrivacyOperation,
    plan_sha256: Digest,
    token_account: [u8; 32],
    wallet_owner: [u8; 32],
    instruction: Instruction,
}

impl PreparedNativeAccountLocalInstruction {
    pub const fn operation(&self) -> PrivacyOperation {
        self.operation
    }

    pub const fn plan_sha256(&self) -> Digest {
        self.plan_sha256
    }

    pub const fn token_account(&self) -> [u8; 32] {
        self.token_account
    }

    pub const fn wallet_owner(&self) -> [u8; 32] {
        self.wallet_owner
    }

    pub const fn instruction(&self) -> &Instruction {
        &self.instruction
    }

    pub const fn signs_or_submits(&self) -> bool {
        false
    }
}

fn validate_runtime_binding(
    mint: &ReadonlyCanonicalMintCapability,
    account: &ReadonlyConfidentialAccountCapability,
    plan: &PrivacyOperationPlan,
) -> Result<(), NativeAccountLocalError> {
    if mint.token_2022_program() != TOKEN_2022_PROGRAM_ID.to_bytes()
        || account.mint() != mint.canonical_mint()
        || plan.mint != mint.canonical_mint()
        || plan.source_token_account != account.token_account()
        || plan.destination_token_account != account.token_account()
    {
        return Err(NativeAccountLocalError::RuntimeBindingMismatch);
    }
    Ok(())
}

/// Construct one exact unsigned Token-2022 instruction for the configured,
/// account-local subset after canonical plan and runtime account cross-binding.
///
/// The read-only runtime capabilities prove account identity and current public
/// fields only. They do not authenticate the Daily Law account, confidential
/// plaintext, proof material, a signer, or chain finality.
pub fn prepare_native_account_local_instruction(
    mint: &ReadonlyCanonicalMintCapability,
    account: &ReadonlyConfidentialAccountCapability,
    plan: &PrivacyOperationPlan,
    material: NativeAccountLocalMaterial,
) -> Result<PreparedNativeAccountLocalInstruction, NativeAccountLocalError> {
    let plan_sha256 = privacy_operation_plan_digest(plan)?;
    validate_runtime_binding(mint, account, plan)?;

    let token_program = Pubkey::new_from_array(mint.token_2022_program());
    let token_account = Pubkey::new_from_array(account.token_account());
    let canonical_mint = Pubkey::new_from_array(mint.canonical_mint());
    let wallet_owner = Pubkey::new_from_array(account.wallet_owner());
    let no_multisig_signers: &[&Pubkey] = &[];

    let instruction = match plan.operation {
        PrivacyOperation::Deposit => {
            if material != NativeAccountLocalMaterial::None {
                return Err(NativeAccountLocalError::MaterialMismatch);
            }
            let amount = plan.steps[0].cleartext_amount;
            if !account.allow_confidential_credits() || account.public_amount() < amount {
                return Err(NativeAccountLocalError::RuntimeAccountStateMismatch);
            }
            confidential_instruction::deposit(
                &token_program,
                &token_account,
                &canonical_mint,
                amount,
                mint.decimals(),
                &wallet_owner,
                no_multisig_signers,
            )
            .map_err(|_| NativeAccountLocalError::TokenInstructionBuildFailed)?
        }
        PrivacyOperation::ApplyPendingBalance => {
            let NativeAccountLocalMaterial::ApplyPendingBalance {
                new_decryptable_available_balance,
            } = material
            else {
                return Err(NativeAccountLocalError::MaterialMismatch);
            };
            let expected_counter = plan
                .expected_pending_balance_credit_counter
                .ok_or(NativeAccountLocalError::MaterialMismatch)?;
            if expected_counter != account.pending_balance_credit_counter() {
                return Err(NativeAccountLocalError::RuntimeAccountStateMismatch);
            }
            confidential_instruction::apply_pending_balance(
                &token_program,
                &token_account,
                expected_counter,
                &new_decryptable_available_balance,
                &wallet_owner,
                no_multisig_signers,
            )
            .map_err(|_| NativeAccountLocalError::TokenInstructionBuildFailed)?
        }
        PrivacyOperation::SetConfidentialCredits => {
            if material != NativeAccountLocalMaterial::None {
                return Err(NativeAccountLocalError::MaterialMismatch);
            }
            let enabled = plan
                .requested_credit_permission
                .ok_or(NativeAccountLocalError::MaterialMismatch)?;
            if enabled == account.allow_confidential_credits() {
                return Err(NativeAccountLocalError::RuntimeAccountStateMismatch);
            }
            if enabled {
                confidential_instruction::enable_confidential_credits(
                    &token_program,
                    &token_account,
                    &wallet_owner,
                    no_multisig_signers,
                )
            } else {
                confidential_instruction::disable_confidential_credits(
                    &token_program,
                    &token_account,
                    &wallet_owner,
                    no_multisig_signers,
                )
            }
            .map_err(|_| NativeAccountLocalError::TokenInstructionBuildFailed)?
        }
        PrivacyOperation::SetNonConfidentialCredits => {
            if material != NativeAccountLocalMaterial::None {
                return Err(NativeAccountLocalError::MaterialMismatch);
            }
            let enabled = plan
                .requested_credit_permission
                .ok_or(NativeAccountLocalError::MaterialMismatch)?;
            if enabled == account.allow_non_confidential_credits() {
                return Err(NativeAccountLocalError::RuntimeAccountStateMismatch);
            }
            if enabled {
                confidential_instruction::enable_non_confidential_credits(
                    &token_program,
                    &token_account,
                    &wallet_owner,
                    no_multisig_signers,
                )
            } else {
                confidential_instruction::disable_non_confidential_credits(
                    &token_program,
                    &token_account,
                    &wallet_owner,
                    no_multisig_signers,
                )
            }
            .map_err(|_| NativeAccountLocalError::TokenInstructionBuildFailed)?
        }
        _ => return Err(NativeAccountLocalError::UnsupportedOperation),
    };

    Ok(PreparedNativeAccountLocalInstruction {
        operation: plan.operation,
        plan_sha256,
        token_account: account.token_account(),
        wallet_owner: account.wallet_owner(),
        instruction,
    })
}

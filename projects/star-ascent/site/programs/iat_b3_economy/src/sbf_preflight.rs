//! Feature-gated, read-only SBF structural preflight for the retained all-15
//! economy account graphs.
//!
//! This is deliberately not an economic handler. It validates only the exact
//! signer/writable/executable shape already frozen by [`crate::rehearsal_adapter`].
//! It never borrows account data or lamports mutably, writes state, invokes a
//! program, authenticates production identities, or authorizes Devnet/Mainnet
//! economic execution.

use crate::rehearsal_adapter::{
    operation_descriptor, ALL_REHEARSAL_OPERATIONS, EXPECTED_REHEARSAL_HANDLER_COUNT,
};
use solana_account_info::AccountInfo;
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

pub const SBF_PREFLIGHT_INSTRUCTION_NAMESPACE: &[u8; 8] = b"IATB3PF1";
pub const SBF_PREFLIGHT_INSTRUCTION_VERSION: u8 = 1;
pub const SBF_PREFLIGHT_ACCOUNT_GRAPH_OPCODE: u8 = 0;
pub const SBF_PREFLIGHT_INSTRUCTION_LEN: usize = 16;
pub const SBF_PREFLIGHT_STATUS: &str =
    "READ_ONLY_ALL_15_ACCOUNT_META_SHAPE_ENTRYPOINT_HANDLERS_INCOMPLETE_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SbfStructuralPreflightTruth {
    pub feature_gated: bool,
    pub retained_handler_count: usize,
    pub structural_preflight_abi_frozen: bool,
    pub production_instruction_abi_frozen: bool,
    pub structural_preflight_entrypoint_exposed: bool,
    pub structural_preflight_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub production_dispatcher_exposed: bool,
    pub public_economic_write_exposure: bool,
    pub account_keys_authenticated: bool,
    pub account_owners_authenticated: bool,
    pub mutable_account_borrows: bool,
    pub account_writes_executed: bool,
    pub system_cpi_executed: bool,
    pub token_cpi_executed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const SBF_STRUCTURAL_PREFLIGHT_TRUTH: SbfStructuralPreflightTruth =
    SbfStructuralPreflightTruth {
        feature_gated: true,
        retained_handler_count: EXPECTED_REHEARSAL_HANDLER_COUNT,
        structural_preflight_abi_frozen: true,
        production_instruction_abi_frozen: false,
        structural_preflight_entrypoint_exposed: true,
        structural_preflight_dispatcher_exposed: true,
        production_entrypoint_exposed: false,
        production_dispatcher_exposed: false,
        public_economic_write_exposure: false,
        account_keys_authenticated: false,
        account_owners_authenticated: false,
        mutable_account_borrows: false,
        account_writes_executed: false,
        system_cpi_executed: false,
        token_cpi_executed: false,
        any_handler_complete: false,
        mainnet_hold: true,
    };

#[repr(u32)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SbfPreflightError {
    InvalidInstruction = 0,
    InvalidOperation = 1,
    IncorrectAccountCount = 2,
    SignerMismatch = 3,
    WritableMismatch = 4,
    ExecutableMismatch = 5,
    DefaultProgramId = 6,
}

impl From<SbfPreflightError> for ProgramError {
    fn from(value: SbfPreflightError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

/// Validate one retained handler's complete account-meta shape without
/// authenticating identities or exposing the handler itself.
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
) -> ProgramResult {
    if program_id == &Pubkey::default() {
        return Err(SbfPreflightError::DefaultProgramId.into());
    }
    if instruction_data.len() != SBF_PREFLIGHT_INSTRUCTION_LEN
        || instruction_data.get(0..8) != Some(SBF_PREFLIGHT_INSTRUCTION_NAMESPACE)
        || instruction_data[8] != SBF_PREFLIGHT_INSTRUCTION_VERSION
        || instruction_data[9] != SBF_PREFLIGHT_ACCOUNT_GRAPH_OPCODE
        || instruction_data[11..].iter().any(|byte| *byte != 0)
    {
        return Err(SbfPreflightError::InvalidInstruction.into());
    }

    let operation = *ALL_REHEARSAL_OPERATIONS
        .get(usize::from(instruction_data[10]))
        .ok_or(SbfPreflightError::InvalidOperation)?;
    let descriptor = operation_descriptor(operation);
    if accounts.len() != descriptor.accounts.len() {
        return Err(SbfPreflightError::IncorrectAccountCount.into());
    }

    for (account, expected) in accounts.iter().zip(descriptor.accounts.iter()) {
        if account.is_signer != expected.signer {
            return Err(SbfPreflightError::SignerMismatch.into());
        }
        if account.is_writable != expected.writable {
            return Err(SbfPreflightError::WritableMismatch.into());
        }
        if account.executable != expected.executable {
            return Err(SbfPreflightError::ExecutableMismatch.into());
        }
    }
    Ok(())
}

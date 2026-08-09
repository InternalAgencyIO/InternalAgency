#![deny(unsafe_code)]

use solana_account_info::{next_account_info, AccountInfo};
use solana_cpi::invoke_signed;
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;
use solana_rent::Rent;
use solana_sdk_ids::system_program;
use solana_system_interface::instruction::create_account;
use solana_sysvar::Sysvar;
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_token_2022_interface::{
    extension::{transfer_hook::TransferHookAccount, BaseStateWithExtensions, StateWithExtensions},
    state::Account as TokenAccount,
    ID as TOKEN_2022_PROGRAM_ID,
};
use spl_transfer_hook_interface::{
    get_extra_account_metas_address,
    instruction::{ExecuteInstruction, TransferHookInstruction},
};

solana_program_entrypoint::entrypoint!(process_instruction);

// Fixture-only IDs. Neither program is a deployment candidate.
pub const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
pub const HOOK_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB4; 32]);
pub const INJECTED_HOOK_FAILURE_AMOUNT: u64 = 13;

#[repr(u32)]
enum RehearsalHookError {
    InvalidInstruction = 100,
    InvalidAccount = 101,
    TransferHookNotExecuting = 102,
    UnauthorizedStakeIngress = 103,
    AuthorityUnexpectedlySigner = 104,
    InjectedHookFailure = 105,
}

impl From<RehearsalHookError> for ProgramError {
    fn from(value: RehearsalHookError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
) -> ProgramResult {
    if program_id != &HOOK_PROGRAM_ID {
        return Err(RehearsalHookError::InvalidAccount.into());
    }
    if instruction_data == [0] {
        return initialize_validation(program_id, accounts);
    }
    match TransferHookInstruction::unpack(instruction_data) {
        Ok(TransferHookInstruction::Execute { amount }) => execute(program_id, accounts, amount),
        _ => Err(RehearsalHookError::InvalidInstruction.into()),
    }
}

fn initialize_validation(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    if !payer.is_signer || system.key != &system_program::ID {
        return Err(RehearsalHookError::InvalidAccount.into());
    }
    let expected = get_extra_account_metas_address(mint.key, program_id);
    if validation.key != &expected || validation.owner == program_id {
        return Err(RehearsalHookError::InvalidAccount.into());
    }
    let size = ExtraAccountMetaList::size_of(0)?;
    let rent = Rent::get()?;
    let (_, bump) =
        Pubkey::find_program_address(&[b"extra-account-metas", mint.key.as_ref()], program_id);
    let instruction = create_account(
        payer.key,
        validation.key,
        rent.minimum_balance(size),
        u64::try_from(size).map_err(|_| RehearsalHookError::InvalidAccount)?,
        program_id,
    );
    invoke_signed(
        &instruction,
        &[payer.clone(), validation.clone(), system.clone()],
        &[&[b"extra-account-metas", mint.key.as_ref(), &[bump]]],
    )?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut validation.try_borrow_mut_data()?, &[])?;
    Ok(())
}

fn execute(program_id: &Pubkey, accounts: &[AccountInfo<'_>], amount: u64) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let source = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let destination = next_account_info(account_iter)?;
    let authority = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    if source.owner != &TOKEN_2022_PROGRAM_ID
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || destination.owner != &TOKEN_2022_PROGRAM_ID
        || validation.owner != program_id
        || validation.key != &get_extra_account_metas_address(mint.key, program_id)
    {
        return Err(RehearsalHookError::InvalidAccount.into());
    }
    let source_data = source.try_borrow_data()?;
    let source_state = StateWithExtensions::<TokenAccount>::unpack(&source_data)
        .map_err(|_| RehearsalHookError::InvalidAccount)?;
    let hook = source_state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| RehearsalHookError::TransferHookNotExecuting)?;
    if !bool::from(hook.transferring) {
        return Err(RehearsalHookError::TransferHookNotExecuting.into());
    }
    if authority.is_signer {
        return Err(RehearsalHookError::AuthorityUnexpectedlySigner.into());
    }

    let (config, _) =
        Pubkey::find_program_address(&[b"config", mint.key.as_ref()], &ECONOMY_PROGRAM_ID);
    let (stake_vault, _) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], &ECONOMY_PROGRAM_ID);
    let (ingress_authority, _) =
        Pubkey::find_program_address(&[b"stake-ingress", config.as_ref()], &ECONOMY_PROGRAM_ID);
    if destination.key == &stake_vault && authority.key != &ingress_authority {
        return Err(RehearsalHookError::UnauthorizedStakeIngress.into());
    }
    if amount == INJECTED_HOOK_FAILURE_AMOUNT {
        return Err(RehearsalHookError::InjectedHookFailure.into());
    }
    Ok(())
}

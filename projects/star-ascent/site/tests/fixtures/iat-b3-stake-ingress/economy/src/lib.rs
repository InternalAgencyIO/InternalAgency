#![deny(unsafe_code)]

use solana_account_info::{next_account_info, AccountInfo};
use solana_cpi::{invoke, invoke_signed};
use solana_instruction::AccountMeta;
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_program_option::COption;
use solana_pubkey::Pubkey;
use solana_rent::Rent;
use solana_sdk_ids::system_program;
use solana_system_interface::instruction::create_account;
use solana_sysvar::Sysvar;
use spl_token_2022_interface::{
    extension::{ExtensionType, StateWithExtensions},
    instruction::{approve_checked, initialize_account3, transfer_checked},
    state::Account as TokenAccount,
    ID as TOKEN_2022_PROGRAM_ID,
};

solana_program_entrypoint::entrypoint!(process_instruction);

pub const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
pub const HOOK_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB4; 32]);
pub const TOKEN_DECIMALS: u8 = 9;

#[repr(u32)]
enum RehearsalEconomyError {
    InvalidInstruction = 200,
    InvalidAccount = 201,
    MissingOwnerSignature = 202,
    ApprovalMismatch = 203,
    BalanceDeltaMismatch = 204,
    DelegateNotConsumed = 205,
    DelegateRestorationMismatch = 206,
    InjectedPostCpiFailure = 207,
}

impl From<RehearsalEconomyError> for ProgramError {
    fn from(value: RehearsalEconomyError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct DelegateSnapshot {
    delegate: COption<Pubkey>,
    delegated_amount: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct TokenSnapshot {
    amount: u64,
    delegate: DelegateSnapshot,
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    data: &[u8],
) -> ProgramResult {
    if program_id != &ECONOMY_PROGRAM_ID || data.is_empty() {
        return Err(RehearsalEconomyError::InvalidInstruction.into());
    }
    match data[0] {
        0 if data.len() == 1 => initialize_stake_vault(program_id, accounts),
        1 if data.len() == 10 => execute_stake_ingress(program_id, accounts, data),
        _ => Err(RehearsalEconomyError::InvalidInstruction.into()),
    }
}

fn initialize_stake_vault(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let stake_vault = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    let token_program = next_account_info(account_iter)?;
    if !payer.is_signer
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || system.key != &system_program::ID
        || token_program.key != &TOKEN_2022_PROGRAM_ID
        || !token_program.executable
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let (config, _) = Pubkey::find_program_address(&[b"config", mint.key.as_ref()], program_id);
    let (expected_vault, bump) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], program_id);
    if stake_vault.key != &expected_vault || stake_vault.owner == &TOKEN_2022_PROGRAM_ID {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let account_len = ExtensionType::try_calculate_account_len::<TokenAccount>(&[
        ExtensionType::TransferHookAccount,
    ])?;
    let rent = Rent::get()?;
    let create = create_account(
        payer.key,
        stake_vault.key,
        rent.minimum_balance(account_len),
        u64::try_from(account_len).map_err(|_| RehearsalEconomyError::InvalidAccount)?,
        &TOKEN_2022_PROGRAM_ID,
    );
    invoke_signed(
        &create,
        &[payer.clone(), stake_vault.clone(), system.clone()],
        &[&[b"stake-token", config.as_ref(), &[bump]]],
    )?;
    let vault_owner = config;
    let initialize = initialize_account3(
        &TOKEN_2022_PROGRAM_ID,
        stake_vault.key,
        mint.key,
        &vault_owner,
    )?;
    invoke(
        &initialize,
        &[stake_vault.clone(), mint.clone(), token_program.clone()],
    )
}

fn execute_stake_ingress(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    data: &[u8],
) -> ProgramResult {
    let mode = data[1];
    let amount = u64::from_le_bytes(
        data[2..10]
            .try_into()
            .map_err(|_| RehearsalEconomyError::InvalidInstruction)?,
    );
    let account_iter = &mut accounts.iter();
    let owner = next_account_info(account_iter)?;
    let source = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let stake_vault = next_account_info(account_iter)?;
    let ingress_authority = next_account_info(account_iter)?;
    let prior_delegate = next_account_info(account_iter)?;
    let token_program = next_account_info(account_iter)?;
    let hook_program = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    if !owner.is_signer {
        return Err(RehearsalEconomyError::MissingOwnerSignature.into());
    }
    if source.owner != &TOKEN_2022_PROGRAM_ID
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || stake_vault.owner != &TOKEN_2022_PROGRAM_ID
        || token_program.key != &TOKEN_2022_PROGRAM_ID
        || hook_program.key != &HOOK_PROGRAM_ID
        || !hook_program.executable
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let (config, _) = Pubkey::find_program_address(&[b"config", mint.key.as_ref()], program_id);
    let (expected_vault, _) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], program_id);
    let (expected_ingress, ingress_bump) =
        Pubkey::find_program_address(&[b"stake-ingress", config.as_ref()], program_id);
    if stake_vault.key != &expected_vault || ingress_authority.key != &expected_ingress {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }

    let source_before = unpack(source)?;
    let vault_before = unpack(stake_vault)?;
    if source_before.delegate.delegate.is_some()
        && source_before.delegate.delegate != COption::Some(*prior_delegate.key)
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }

    let approve_ingress = approve_checked(
        &TOKEN_2022_PROGRAM_ID,
        source.key,
        mint.key,
        ingress_authority.key,
        owner.key,
        &[],
        amount,
        TOKEN_DECIMALS,
    )?;
    invoke(
        &approve_ingress,
        &[
            source.clone(),
            mint.clone(),
            ingress_authority.clone(),
            owner.clone(),
            token_program.clone(),
        ],
    )?;
    let after_approval = unpack(source)?;
    if after_approval.amount != source_before.amount
        || after_approval.delegate
            != (DelegateSnapshot {
                delegate: COption::Some(*ingress_authority.key),
                delegated_amount: amount,
            })
    {
        return Err(RehearsalEconomyError::ApprovalMismatch.into());
    }

    let mut transfer = transfer_checked(
        &TOKEN_2022_PROGRAM_ID,
        source.key,
        mint.key,
        stake_vault.key,
        ingress_authority.key,
        &[],
        amount,
        TOKEN_DECIMALS,
    )?;
    transfer
        .accounts
        .push(AccountMeta::new_readonly(*hook_program.key, false));
    transfer
        .accounts
        .push(AccountMeta::new_readonly(*validation.key, false));
    invoke_signed(
        &transfer,
        &[
            source.clone(),
            mint.clone(),
            stake_vault.clone(),
            ingress_authority.clone(),
            hook_program.clone(),
            validation.clone(),
            token_program.clone(),
        ],
        &[&[b"stake-ingress", config.as_ref(), &[ingress_bump]]],
    )?;

    let after_transfer = unpack(source)?;
    let vault_after = unpack(stake_vault)?;
    if after_transfer.amount
        != source_before
            .amount
            .checked_sub(amount)
            .ok_or(RehearsalEconomyError::BalanceDeltaMismatch)?
        || vault_after.amount
            != vault_before
                .amount
                .checked_add(amount)
                .ok_or(RehearsalEconomyError::BalanceDeltaMismatch)?
    {
        return Err(RehearsalEconomyError::BalanceDeltaMismatch.into());
    }
    if after_transfer.delegate
        != (DelegateSnapshot {
            delegate: COption::None,
            delegated_amount: 0,
        })
    {
        return Err(RehearsalEconomyError::DelegateNotConsumed.into());
    }
    if mode == 1 {
        return Err(RehearsalEconomyError::InjectedPostCpiFailure.into());
    }

    if let COption::Some(delegate) = source_before.delegate.delegate {
        let restore_decimals = if mode == 2 {
            TOKEN_DECIMALS.saturating_add(1)
        } else {
            TOKEN_DECIMALS
        };
        let restore = approve_checked(
            &TOKEN_2022_PROGRAM_ID,
            source.key,
            mint.key,
            &delegate,
            owner.key,
            &[],
            source_before.delegate.delegated_amount,
            restore_decimals,
        )?;
        invoke(
            &restore,
            &[
                source.clone(),
                mint.clone(),
                prior_delegate.clone(),
                owner.clone(),
                token_program.clone(),
            ],
        )?;
    } else if mode == 2 {
        return Err(RehearsalEconomyError::InvalidInstruction.into());
    }

    let after_restoration = unpack(source)?;
    if after_restoration.delegate != source_before.delegate {
        return Err(RehearsalEconomyError::DelegateRestorationMismatch.into());
    }
    Ok(())
}

fn unpack(account: &AccountInfo<'_>) -> Result<TokenSnapshot, ProgramError> {
    let data = account.try_borrow_data()?;
    let token = StateWithExtensions::<TokenAccount>::unpack(&data)
        .map_err(|_| RehearsalEconomyError::InvalidAccount)?;
    Ok(TokenSnapshot {
        amount: token.base.amount,
        delegate: DelegateSnapshot {
            delegate: token.base.delegate,
            delegated_amount: token.base.delegated_amount,
        },
    })
}

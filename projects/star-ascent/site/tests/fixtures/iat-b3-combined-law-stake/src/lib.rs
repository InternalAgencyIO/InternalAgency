#![deny(unsafe_code)]

use iat_b3_economy::{
    stake_ingress_runtime::{
        execute_daily_law_authenticated_stake_ingress, StakeIngressRuntimeAccounts,
    },
    CanonicalDailyLawBinding, ConfigState, EligibilityState, LaneState, PrepareOpenPositionInput,
    ReadonlyTokenState,
};
use solana_account_info::{next_account_info, AccountInfo};
use solana_clock::Clock;
use solana_cpi::{invoke, invoke_signed};
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;
use solana_rent::Rent;
use solana_sdk_ids::system_program;
use solana_system_interface::instruction::create_account;
use solana_sysvar::Sysvar;
use spl_token_2022_interface::{
    extension::{ExtensionType, StateWithExtensions},
    instruction::initialize_account3,
    state::Account as TokenAccount,
    ID as TOKEN_2022_PROGRAM_ID,
};

solana_program_entrypoint::entrypoint!(process_instruction);

pub const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
pub const LAW_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB3; 32]);
pub const REHEARSAL_NETWORK_GENESIS_HASH: [u8; 32] = [0x91; 32];
pub const INITIALIZE_STAKE_VAULT_OPCODE: u8 = 0;
pub const EXECUTE_STAKE_INGRESS_OPCODE: u8 = 1;
pub const INITIALIZE_STAKE_VAULT_ACCOUNT_COUNT: usize = 5;
pub const EXECUTE_STAKE_INGRESS_ACCOUNT_COUNT: usize = 10;

#[repr(u32)]
enum RehearsalEconomyError {
    InvalidInstruction = 200,
    InvalidAccount = 201,
}

impl From<RehearsalEconomyError> for ProgramError {
    fn from(value: RehearsalEconomyError) -> Self {
        ProgramError::Custom(value as u32)
    }
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
        INITIALIZE_STAKE_VAULT_OPCODE if data.len() == 1 => {
            initialize_stake_vault(program_id, accounts)
        }
        EXECUTE_STAKE_INGRESS_OPCODE if data.len() == 9 => {
            execute_stake_ingress(program_id, accounts, data)
        }
        _ => Err(RehearsalEconomyError::InvalidInstruction.into()),
    }
}

fn initialize_stake_vault(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    require_exact_account_count(accounts, INITIALIZE_STAKE_VAULT_ACCOUNT_COUNT)?;
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
    let (vault_authority, _) =
        Pubkey::find_program_address(&[b"vault-authority", config.as_ref()], program_id);
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
    let initialize = initialize_account3(
        &TOKEN_2022_PROGRAM_ID,
        stake_vault.key,
        mint.key,
        &vault_authority,
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
    require_exact_account_count(accounts, EXECUTE_STAKE_INGRESS_ACCOUNT_COUNT)?;
    let amount = u64::from_le_bytes(
        data[1..9]
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
    let law_state = next_account_info(account_iter)?;

    let (config, _) = Pubkey::find_program_address(&[b"config", mint.key.as_ref()], program_id);
    let (expected_law_state, law_bump) =
        Pubkey::find_program_address(&[b"law-state", mint.key.as_ref()], &LAW_PROGRAM_ID);
    let (expected_vault, _) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], program_id);
    let (vault_authority, vault_authority_bump) =
        Pubkey::find_program_address(&[b"vault-authority", config.as_ref()], program_id);
    let (expected_ingress, _) =
        Pubkey::find_program_address(&[b"stake-ingress", config.as_ref()], program_id);
    if stake_vault.key != &expected_vault
        || ingress_authority.key != &expected_ingress
        || hook_program.key != &LAW_PROGRAM_ID
        || law_state.key != &expected_law_state
        || law_state.owner != &LAW_PROGRAM_ID
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }

    let tracked_staked_principal = {
        let data = stake_vault
            .try_borrow_data()
            .map_err(|_| RehearsalEconomyError::InvalidAccount)?;
        StateWithExtensions::<TokenAccount>::unpack(&data)
            .map_err(|_| RehearsalEconomyError::InvalidAccount)?
            .base
            .amount
    };
    let binding = CanonicalDailyLawBinding::new(
        LAW_PROGRAM_ID.to_bytes(),
        expected_law_state.to_bytes(),
        law_bump,
        mint.key.to_bytes(),
        REHEARSAL_NETWORK_GENESIS_HASH,
    );
    let input = rehearsal_open_position_input(
        owner.key,
        mint.key,
        source.key,
        stake_vault.key,
        &config,
        &vault_authority,
        vault_authority_bump,
        tracked_staked_principal,
        Clock::get()?.unix_timestamp,
        amount,
    );
    execute_daily_law_authenticated_stake_ingress(
        program_id,
        &binding,
        law_state,
        Box::new(input),
        StakeIngressRuntimeAccounts {
            owner,
            source,
            mint,
            stake_vault,
            ingress_authority,
            prior_delegate: Some(prior_delegate),
            token_program,
            hook_program,
            hook_validation: validation,
            additional_hook_accounts: core::slice::from_ref(law_state),
        },
        |_, _| Ok(()),
    )
    .map_err(|error| error.into_program_error())?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn rehearsal_open_position_input(
    owner: &Pubkey,
    mint: &Pubkey,
    source: &Pubkey,
    stake_vault: &Pubkey,
    config: &Pubkey,
    vault_authority: &Pubkey,
    vault_authority_bump: u8,
    staked_principal: u64,
    genesis_timestamp: i64,
    principal: u64,
) -> PrepareOpenPositionInput {
    let lane = LaneState {
        config: config.to_bytes(),
        token_account: [3; 32],
        beneficiary: [4; 32],
        total: 1_000_000_000_000,
        genesis_unlocked: 1_000_000_000_000,
        cliff_week: 0,
        linear_end_week: 0,
        reserved: 0,
        paid: 0,
        principal_claimed: 0,
        lane: 1,
        reward_source: true,
        bump: 1,
        token_bump: 1,
    };
    let config_snapshot = ConfigState {
        admin: owner.to_bytes(),
        mint: mint.to_bytes(),
        token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
        randomness_program: [5; 32],
        stake_token_account: stake_vault.to_bytes(),
        agency_registry_hash: [0; 32],
        genesis_timestamp,
        expected_supply: 1,
        staked_principal,
        agency_count: 0,
        rehearsal_mode: true,
        active: true,
        lane_mask: 0,
        stake_vault_initialized: true,
        bump: 1,
        vault_authority_bump,
    };
    PrepareOpenPositionInput {
        config_key: config.to_bytes(),
        config: config_snapshot,
        owner: owner.to_bytes(),
        mint: mint.to_bytes(),
        owner_tokens: ReadonlyTokenState {
            key: source.to_bytes(),
            mint: mint.to_bytes(),
            owner: owner.to_bytes(),
            amount: 0,
        },
        vault_authority: vault_authority.to_bytes(),
        stake_tokens: ReadonlyTokenState {
            key: stake_vault.to_bytes(),
            mint: mint.to_bytes(),
            owner: vault_authority.to_bytes(),
            amount: 0,
        },
        eligibility: EligibilityState {
            config: config.to_bytes(),
            wallet: owner.to_bytes(),
            agency_index: u32::MAX,
            role: 0,
            bump: 1,
        },
        treasury: lane,
        ecosystem: LaneState { lane: 2, ..lane },
        liquidity: LaneState { lane: 4, ..lane },
        position_id: 1,
        principal,
        position_bump: 1,
    }
}

fn require_exact_account_count(accounts: &[AccountInfo<'_>], expected: usize) -> ProgramResult {
    if accounts.len() != expected {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    Ok(())
}

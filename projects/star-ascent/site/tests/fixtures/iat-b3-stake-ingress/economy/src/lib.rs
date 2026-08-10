#![deny(unsafe_code)]

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};
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
    extension::ExtensionType,
    instruction::{approve_checked, initialize_account3},
    state::Account as TokenAccount,
    ID as TOKEN_2022_PROGRAM_ID,
};

solana_program_entrypoint::entrypoint!(process_instruction);

pub const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
pub const HOOK_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB4; 32]);
pub const LAW_STATE_SEED: &[u8] = b"law-state";
pub const LAW_STATE_LEN: usize = 160;
pub const REHEARSAL_NETWORK_GENESIS_HASH: [u8; 32] = [0x91; 32];
pub const TOKEN_DECIMALS: u8 = 9;

#[repr(u32)]
enum RehearsalEconomyError {
    InvalidInstruction = 200,
    InvalidAccount = 201,
    InjectedPostCpiFailure = 207,
    LawDecisionConstructionFailed = 208,
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
        0 if data.len() == 1 => initialize_stake_vault(program_id, accounts),
        1 if data.len() == 10 => execute_stake_ingress(program_id, accounts, data),
        2 if data.len() == 1 => initialize_law_state(program_id, accounts),
        3 if data.len() == 2 || data.len() == 34 => set_law_state(program_id, accounts, data),
        _ => Err(RehearsalEconomyError::InvalidInstruction.into()),
    }
}

fn law_state_address(program_id: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[LAW_STATE_SEED, mint.as_ref()], program_id)
}

fn initialize_law_state(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    let (expected, bump) = law_state_address(program_id, mint.key);
    if !payer.is_signer
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || law_state.key != &expected
        || law_state.owner == program_id
        || system.key != &system_program::ID
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let rent = Rent::get()?;
    let create = create_account(
        payer.key,
        law_state.key,
        rent.minimum_balance(LAW_STATE_LEN),
        u64::try_from(LAW_STATE_LEN).map_err(|_| RehearsalEconomyError::InvalidAccount)?,
        program_id,
    );
    invoke_signed(
        &create,
        &[payer.clone(), law_state.clone(), system.clone()],
        &[&[LAW_STATE_SEED, mint.key.as_ref(), &[bump]]],
    )?;
    write_law_state(law_state, mint.key, bump, 0, None)
}

fn set_law_state(program_id: &Pubkey, accounts: &[AccountInfo<'_>], data: &[u8]) -> ProgramResult {
    let mode = data[1];
    let account_iter = &mut accounts.iter();
    let authority = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    let (expected, bump) = law_state_address(program_id, mint.key);
    if !authority.is_signer
        || law_state.key != &expected
        || law_state.owner != program_id
        || !law_state.is_writable
        || mode > 2
        || (mode == 1 && data.len() != 34)
        || (mode != 1 && data.len() != 2)
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let locked_ancestor = if mode == 1 {
        Some(
            data[2..34]
                .try_into()
                .map_err(|_| RehearsalEconomyError::InvalidInstruction)?,
        )
    } else {
        None
    };
    write_law_state(law_state, mint.key, bump, mode, locked_ancestor)
}

fn write_law_state(
    law_state: &AccountInfo<'_>,
    mint: &Pubkey,
    bump: u8,
    mode: u8,
    locked_ancestor: Option<[u8; 32]>,
) -> ProgramResult {
    let clock = Clock::get()?;
    let local_day = protocol_local_day(clock.unix_timestamp);
    let mut data = law_state.try_borrow_mut_data()?;
    if data.len() != LAW_STATE_LEN {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    data.fill(0);
    data[0..8].copy_from_slice(b"IATB3S01");
    data[8] = 1;
    data[9] = bump;
    data[16..48].copy_from_slice(mint.as_ref());
    data[48..80].copy_from_slice(&REHEARSAL_NETWORK_GENESIS_HASH);
    if mode == 2 {
        return Ok(());
    }
    let want_locked = mode == 1;
    let decision = if let Some(ancestor_hash) = locked_ancestor {
        create_solana_daily_decision(
            local_day,
            42_424_242,
            ancestor_hash,
            REHEARSAL_NETWORK_GENESIS_HASH,
            mint.to_bytes(),
        )
        .ok()
        .filter(|value| value.locked)
    } else {
        (0u8..=u8::MAX).find_map(|candidate| {
            let mut ancestor_hash = [0x42; 32];
            ancestor_hash[0] = candidate;
            create_solana_daily_decision(
                local_day,
                clock.slot.saturating_sub(1),
                ancestor_hash,
                REHEARSAL_NETWORK_GENESIS_HASH,
                mint.to_bytes(),
            )
            .ok()
            .filter(|value| value.locked == want_locked)
        })
    }
    .ok_or(RehearsalEconomyError::LawDecisionConstructionFailed)?;
    data[10] = 1;
    data[11] = u8::from(decision.locked);
    data[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
    data[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
    data[96..128].copy_from_slice(&decision.ancestor_slot_hash);
    data[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
    data[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
    data[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
    data[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
    Ok(())
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
    let law_state = next_account_info(account_iter)?;
    let (config, _) = Pubkey::find_program_address(&[b"config", mint.key.as_ref()], program_id);
    let (expected_law_state, law_bump) = law_state_address(program_id, mint.key);
    let (expected_vault, _) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], program_id);
    let (expected_ingress, _) =
        Pubkey::find_program_address(&[b"stake-ingress", config.as_ref()], program_id);
    if stake_vault.key != &expected_vault || ingress_authority.key != &expected_ingress {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    if hook_program.key != &HOOK_PROGRAM_ID {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let binding = CanonicalDailyLawBinding::new(
        program_id.to_bytes(),
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
        |_, _| {
            if mode == 1 {
                Err(RehearsalEconomyError::InjectedPostCpiFailure.into())
            } else {
                Ok(())
            }
        },
    )
    .map_err(|error| error.into_program_error())?;

    // A fixture-only post-completion failure proves every production-executor
    // CPI still rolls back when a later instruction in the same handler fails.
    if mode == 2 {
        let invalid = approve_checked(
            &TOKEN_2022_PROGRAM_ID,
            source.key,
            mint.key,
            prior_delegate.key,
            owner.key,
            &[],
            0,
            TOKEN_DECIMALS.saturating_add(1),
        )?;
        invoke(
            &invalid,
            &[
                source.clone(),
                mint.clone(),
                prior_delegate.clone(),
                owner.clone(),
                token_program.clone(),
            ],
        )?;
    }
    Ok(())
}

fn rehearsal_open_position_input(
    owner: &Pubkey,
    mint: &Pubkey,
    source: &Pubkey,
    stake_vault: &Pubkey,
    config: &Pubkey,
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
        staked_principal: 0,
        agency_count: 0,
        rehearsal_mode: true,
        active: true,
        lane_mask: 0,
        stake_vault_initialized: true,
        bump: 1,
        vault_authority_bump: 1,
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
        vault_authority: config.to_bytes(),
        stake_tokens: ReadonlyTokenState {
            key: stake_vault.to_bytes(),
            mint: mint.to_bytes(),
            owner: config.to_bytes(),
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

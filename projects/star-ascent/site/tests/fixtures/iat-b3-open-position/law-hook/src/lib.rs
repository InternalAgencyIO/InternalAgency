#![deny(unsafe_code)]

use iat_b3_consensus::{
    create_solana_daily_decision, iat_transfer_disposition, protocol_local_day,
    IatTransferDisposition, SolanaDailyDecision,
};
use solana_account_info::{next_account_info, AccountInfo};
use solana_clock::Clock;
use solana_cpi::invoke_signed;
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;
use solana_rent::Rent;
use solana_sdk_ids::system_program;
use solana_system_interface::instruction::create_account;
use solana_sysvar::Sysvar;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
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

// Conspicuous fixture identities; neither is a deployment candidate.
pub const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
pub const LAW_HOOK_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB4; 32]);
pub const LAW_STATE_SEED: &[u8] = b"law-state";
pub const LAW_STATE_LEN: usize = 160;
pub const NETWORK_GENESIS_HASH: [u8; 32] = [0x91; 32];
pub const INJECTED_HOOK_FAILURE_AMOUNT: u64 = 13;

#[repr(u32)]
enum FixtureLawError {
    InvalidInstruction = 0xE410,
    InvalidAccount = 0xE411,
    TransferHookNotExecuting = 0xE412,
    UnauthorizedStakeIngress = 0xE413,
    AuthorityUnexpectedlySigner = 0xE414,
    InjectedHookFailure = 0xE415,
    LawStateNotOpen = 0xE416,
    DecisionConstructionFailed = 0xE417,
}

impl From<FixtureLawError> for ProgramError {
    fn from(value: FixtureLawError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
) -> ProgramResult {
    if program_id != &LAW_HOOK_PROGRAM_ID {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    match instruction_data {
        [0] => initialize_law_state(program_id, accounts),
        [1, mode] if *mode != 1 => set_law_state(program_id, accounts, *mode, None),
        data if data.len() == 34 && data[0] == 1 && data[1] == 1 => {
            let ancestor = data[2..34]
                .try_into()
                .map_err(|_| FixtureLawError::InvalidInstruction)?;
            set_law_state(program_id, accounts, 1, Some(ancestor))
        }
        [2] => initialize_validation(program_id, accounts),
        _ => match TransferHookInstruction::unpack(instruction_data) {
            Ok(TransferHookInstruction::Execute { amount }) => {
                execute_hook(program_id, accounts, amount)
            }
            _ => Err(FixtureLawError::InvalidInstruction.into()),
        },
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
    if account_iter.next().is_some() {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let (expected, bump) = law_state_address(program_id, mint.key);
    if !payer.is_signer
        || !payer.is_writable
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || law_state.key != &expected
        || !law_state.is_writable
        || law_state.owner == program_id
        || system.key != &system_program::ID
        || !system.executable
    {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let rent = Rent::get()?;
    let create = create_account(
        payer.key,
        law_state.key,
        rent.minimum_balance(LAW_STATE_LEN),
        u64::try_from(LAW_STATE_LEN).map_err(|_| FixtureLawError::InvalidAccount)?,
        program_id,
    );
    invoke_signed(
        &create,
        &[payer.clone(), law_state.clone(), system.clone()],
        &[&[LAW_STATE_SEED, mint.key.as_ref(), &[bump]]],
    )?;
    write_law_state(law_state, mint.key, bump, 0, None)
}

fn set_law_state(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    mode: u8,
    locked_ancestor: Option<[u8; 32]>,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let authority = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    if account_iter.next().is_some() {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let (expected, bump) = law_state_address(program_id, mint.key);
    if !authority.is_signer
        || law_state.key != &expected
        || law_state.owner != program_id
        || !law_state.is_writable
        || mode > 2
        || (mode == 1) != locked_ancestor.is_some()
    {
        return Err(FixtureLawError::InvalidAccount.into());
    }
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
        return Err(FixtureLawError::InvalidAccount.into());
    }
    data.fill(0);
    data[0..8].copy_from_slice(b"IATB3S01");
    data[8] = 1;
    data[9] = bump;
    data[16..48].copy_from_slice(mint.as_ref());
    data[48..80].copy_from_slice(&NETWORK_GENESIS_HASH);
    if mode == 2 {
        return Ok(());
    }
    let want_locked = mode == 1;
    let decision = if let Some(ancestor_hash) = locked_ancestor {
        create_solana_daily_decision(
            local_day,
            42_424_242,
            ancestor_hash,
            NETWORK_GENESIS_HASH,
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
                NETWORK_GENESIS_HASH,
                mint.to_bytes(),
            )
            .ok()
            .filter(|value| value.locked == want_locked)
        })
    }
    .ok_or(FixtureLawError::DecisionConstructionFailed)?;
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

fn initialize_validation(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    if account_iter.next().is_some() {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let expected_validation = get_extra_account_metas_address(mint.key, program_id);
    let (expected_law_state, _) = law_state_address(program_id, mint.key);
    if !payer.is_signer
        || !payer.is_writable
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || validation.key != &expected_validation
        || validation.owner == program_id
        || !validation.is_writable
        || law_state.key != &expected_law_state
        || law_state.owner != program_id
        || law_state.is_writable
        || system.key != &system_program::ID
        || !system.executable
    {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    require_open_law_bytes(law_state, mint.key)?;
    let law_meta = ExtraAccountMeta::new_with_pubkey(law_state.key, false, false)?;
    let size = ExtraAccountMetaList::size_of(1)?;
    let rent = Rent::get()?;
    let (_, bump) =
        Pubkey::find_program_address(&[b"extra-account-metas", mint.key.as_ref()], program_id);
    let create = create_account(
        payer.key,
        validation.key,
        rent.minimum_balance(size),
        u64::try_from(size).map_err(|_| FixtureLawError::InvalidAccount)?,
        program_id,
    );
    invoke_signed(
        &create,
        &[payer.clone(), validation.clone(), system.clone()],
        &[&[b"extra-account-metas", mint.key.as_ref(), &[bump]]],
    )?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(
        &mut validation.try_borrow_mut_data()?,
        &[law_meta],
    )?;
    Ok(())
}

fn execute_hook(program_id: &Pubkey, accounts: &[AccountInfo<'_>], amount: u64) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let source = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let destination = next_account_info(account_iter)?;
    let authority = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    if account_iter.next().is_some()
        || source.owner != &TOKEN_2022_PROGRAM_ID
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || destination.owner != &TOKEN_2022_PROGRAM_ID
        || validation.owner != program_id
        || validation.key != &get_extra_account_metas_address(mint.key, program_id)
        || validation.is_writable
        || law_state.is_writable
    {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let (expected_law_state, _) = law_state_address(program_id, mint.key);
    if law_state.key != &expected_law_state || law_state.owner != program_id {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    require_open_law_bytes(law_state, mint.key)?;

    let source_data = source.try_borrow_data()?;
    let source_state = StateWithExtensions::<TokenAccount>::unpack(&source_data)
        .map_err(|_| FixtureLawError::InvalidAccount)?;
    let hook = source_state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| FixtureLawError::TransferHookNotExecuting)?;
    if !bool::from(hook.transferring) {
        return Err(FixtureLawError::TransferHookNotExecuting.into());
    }
    if authority.is_signer {
        return Err(FixtureLawError::AuthorityUnexpectedlySigner.into());
    }

    let (config, _) =
        Pubkey::find_program_address(&[b"config", mint.key.as_ref()], &ECONOMY_PROGRAM_ID);
    let (stake_vault, _) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], &ECONOMY_PROGRAM_ID);
    let (ingress_authority, _) =
        Pubkey::find_program_address(&[b"stake-ingress", config.as_ref()], &ECONOMY_PROGRAM_ID);
    if destination.key != &stake_vault || authority.key != &ingress_authority {
        return Err(FixtureLawError::UnauthorizedStakeIngress.into());
    }
    if amount == INJECTED_HOOK_FAILURE_AMOUNT {
        return Err(FixtureLawError::InjectedHookFailure.into());
    }
    Ok(())
}

fn require_open_law_bytes(law_state: &AccountInfo<'_>, mint: &Pubkey) -> ProgramResult {
    let data = law_state.try_borrow_data()?;
    let (expected_address, expected_bump) = law_state_address(&LAW_HOOK_PROGRAM_ID, mint);
    if data.len() != LAW_STATE_LEN
        || law_state.key != &expected_address
        || data[9] != expected_bump
        || data.get(0..8) != Some(b"IATB3S01")
        || data[8] != 1
        || data[10] != 1
        || data[11] != 0
        || data.get(16..48) != Some(mint.as_ref())
        || data.get(48..80) != Some(NETWORK_GENESIS_HASH.as_ref())
    {
        return Err(FixtureLawError::LawStateNotOpen.into());
    }
    let decision = SolanaDailyDecision {
        local_day: i64::from_le_bytes(
            data[80..88]
                .try_into()
                .map_err(|_| FixtureLawError::LawStateNotOpen)?,
        ),
        entropy_slot: u64::from_le_bytes(
            data[88..96]
                .try_into()
                .map_err(|_| FixtureLawError::LawStateNotOpen)?,
        ),
        ancestor_slot_hash: data[96..128]
            .try_into()
            .map_err(|_| FixtureLawError::LawStateNotOpen)?,
        draw_counter: u64::from_le_bytes(
            data[128..136]
                .try_into()
                .map_err(|_| FixtureLawError::LawStateNotOpen)?,
        ),
        draw_bucket: u16::from_le_bytes(
            data[136..138]
                .try_into()
                .map_err(|_| FixtureLawError::LawStateNotOpen)?,
        ),
        chance_numerator: u16::from_le_bytes(
            data[138..140]
                .try_into()
                .map_err(|_| FixtureLawError::LawStateNotOpen)?,
        ),
        chance_denominator: u16::from_le_bytes(
            data[140..142]
                .try_into()
                .map_err(|_| FixtureLawError::LawStateNotOpen)?,
        ),
        locked: false,
    };
    let clock = Clock::get()?;
    if decision.local_day != protocol_local_day(clock.unix_timestamp)
        || iat_transfer_disposition(
            clock.unix_timestamp,
            Some(decision),
            NETWORK_GENESIS_HASH,
            mint.to_bytes(),
        )
        .map_err(|_| FixtureLawError::LawStateNotOpen)?
            != IatTransferDisposition::Allowed
    {
        return Err(FixtureLawError::LawStateNotOpen.into());
    }
    Ok(())
}

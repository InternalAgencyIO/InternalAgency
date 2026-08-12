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
const CONTROL_DISCRIMINATOR: [u8; 8] = *b"IATB3CTL";
const CONTROL_PAYLOAD_LEN: usize = 34;
const CONTROL_TLV_HEADER_LEN: usize = 12;
const CONTROL_TLV_LEN: usize = CONTROL_TLV_HEADER_LEN + CONTROL_PAYLOAD_LEN;
const CONTROL_VERSION: u8 = 1;

#[repr(u32)]
enum FixtureLawError {
    InvalidInstruction = 0xE410,
    InvalidAccount = 0xE411,
    TransferHookNotExecuting = 0xE412,
    UnauthorizedLaneTransfer = 0xE413,
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
        [3, ordinal] if *ordinal <= 3 => set_hook_rejection(program_id, accounts, *ordinal),
        _ => match TransferHookInstruction::unpack(instruction_data) {
            Ok(TransferHookInstruction::Execute { amount }) => {
                execute_hook(program_id, accounts, amount)
            }
            _ => Err(FixtureLawError::InvalidInstruction.into()),
        },
    }
}

fn set_hook_rejection(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    ordinal: u8,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let authority = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    if account_iter.next().is_some() {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let expected_validation = get_extra_account_metas_address(mint.key, program_id);
    let (expected_law, _) = law_state_address(program_id, mint.key);
    let facts = ControlUpdateFacts {
        authority_is_signer: authority.is_signer,
        mint_is_readonly: !mint.is_signer && !mint.is_writable,
        mint_owner_matches: mint.owner == &TOKEN_2022_PROGRAM_ID,
        validation_address_matches: validation.key == &expected_validation,
        validation_owner_matches: validation.owner == program_id,
        validation_is_writable: validation.is_writable,
        law_address_matches: law_state.key == &expected_law,
        law_owner_matches: law_state.owner == program_id,
        law_is_readonly: !law_state.is_signer && !law_state.is_writable,
        law_is_open: true,
        ordinal,
    };
    if !authorize_control_update(facts) {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    require_open_law_bytes(law_state, mint.key)?;
    let mut data = validation.try_borrow_mut_data()?;
    require_exact_execute_meta_list(&data, law_state.key)?;
    set_control_ordinal(&mut data, authority.key, ordinal)
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
    let size = validation_account_len()?;
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
    let mut data = validation.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &[law_meta])?;
    initialize_control_tlv(&mut data, payer.key)?;
    Ok(())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ValidationControl {
    controller: Pubkey,
    ordinal: u8,
}

#[derive(Clone, Copy)]
struct ControlUpdateFacts {
    authority_is_signer: bool,
    mint_is_readonly: bool,
    mint_owner_matches: bool,
    validation_address_matches: bool,
    validation_owner_matches: bool,
    validation_is_writable: bool,
    law_address_matches: bool,
    law_owner_matches: bool,
    law_is_readonly: bool,
    law_is_open: bool,
    ordinal: u8,
}

fn authorize_control_update(facts: ControlUpdateFacts) -> bool {
    facts.authority_is_signer
        && facts.mint_is_readonly
        && facts.mint_owner_matches
        && facts.validation_address_matches
        && facts.validation_owner_matches
        && facts.validation_is_writable
        && facts.law_address_matches
        && facts.law_owner_matches
        && facts.law_is_readonly
        && facts.law_is_open
        && facts.ordinal <= 3
}

fn validation_account_len() -> Result<usize, ProgramError> {
    ExtraAccountMetaList::size_of(1)?
        .checked_add(CONTROL_TLV_LEN)
        .ok_or(ProgramError::InvalidAccountData)
}

fn control_tlv_offset() -> Result<usize, ProgramError> {
    ExtraAccountMetaList::size_of(1)
}

fn initialize_control_tlv(data: &mut [u8], controller: &Pubkey) -> ProgramResult {
    if data.len() != validation_account_len()? {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let offset = control_tlv_offset()?;
    let control = data
        .get_mut(offset..offset + CONTROL_TLV_LEN)
        .ok_or(FixtureLawError::InvalidAccount)?;
    control.fill(0);
    control[0..8].copy_from_slice(&CONTROL_DISCRIMINATOR);
    control[8..12].copy_from_slice(
        &u32::try_from(CONTROL_PAYLOAD_LEN)
            .map_err(|_| FixtureLawError::InvalidAccount)?
            .to_le_bytes(),
    );
    control[12] = CONTROL_VERSION;
    control[13] = 0;
    control[14..46].copy_from_slice(controller.as_ref());
    Ok(())
}

fn require_exact_execute_meta_list(data: &[u8], law_state: &Pubkey) -> ProgramResult {
    let meta_len = control_tlv_offset()?;
    if data.len() != validation_account_len()? {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let law_meta = ExtraAccountMeta::new_with_pubkey(law_state, false, false)?;
    let mut expected = vec![0u8; meta_len];
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut expected, &[law_meta])?;
    if data.get(..meta_len) != Some(expected.as_slice()) {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    Ok(())
}

fn read_control_tlv(data: &[u8]) -> Result<ValidationControl, ProgramError> {
    if data.len() != validation_account_len()? {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let offset = control_tlv_offset()?;
    let control = data
        .get(offset..offset + CONTROL_TLV_LEN)
        .ok_or(FixtureLawError::InvalidAccount)?;
    let length = u32::from_le_bytes(
        control[8..12]
            .try_into()
            .map_err(|_| FixtureLawError::InvalidAccount)?,
    );
    if control[0..8] != CONTROL_DISCRIMINATOR
        || usize::try_from(length).map_err(|_| FixtureLawError::InvalidAccount)?
            != CONTROL_PAYLOAD_LEN
        || control[12] != CONTROL_VERSION
        || control[13] > 3
    {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let controller = Pubkey::new_from_array(
        control[14..46]
            .try_into()
            .map_err(|_| FixtureLawError::InvalidAccount)?,
    );
    Ok(ValidationControl {
        controller,
        ordinal: control[13],
    })
}

fn set_control_ordinal(data: &mut [u8], authority: &Pubkey, ordinal: u8) -> ProgramResult {
    let control = read_control_tlv(data)?;
    if ordinal > 3 || control.controller != *authority {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let ordinal_offset = control_tlv_offset()?
        .checked_add(13)
        .ok_or(FixtureLawError::InvalidAccount)?;
    data[ordinal_offset] = ordinal;
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
    let (config, _) =
        Pubkey::find_program_address(&[b"config", mint.key.as_ref()], &ECONOMY_PROGRAM_ID);
    let (vault_authority, _) =
        Pubkey::find_program_address(&[b"vault-authority", config.as_ref()], &ECONOMY_PROGRAM_ID);
    let destination_data = destination.try_borrow_data()?;
    let destination_state = StateWithExtensions::<TokenAccount>::unpack(&destination_data)
        .map_err(|_| FixtureLawError::InvalidAccount)?;
    if source_state.base.mint != *mint.key || destination_state.base.mint != *mint.key {
        return Err(FixtureLawError::InvalidAccount.into());
    }
    let mut source_ordinal = None;
    let mut destination_is_lane = false;
    for lane in [1u8, 2, 3, 4] {
        let (lane_token, _) = Pubkey::find_program_address(
            &[b"lane-token", config.as_ref(), &[lane]],
            &ECONOMY_PROGRAM_ID,
        );
        if source.key == &lane_token {
            source_ordinal = Some(lane);
        }
        if destination.key == &lane_token {
            destination_is_lane = true;
        }
    }
    let transfer_class = classify_lane_transfer(LaneTransferFacts {
        amount,
        destination_is_lane,
        source_ordinal,
        authority_is_signer: authority.is_signer,
        authority: *authority.key,
        source_owner: source_state.base.owner,
        destination_owner: destination_state.base.owner,
        vault_authority,
    });
    let Some(transfer_class) = transfer_class else {
        return Err(FixtureLawError::UnauthorizedLaneTransfer.into());
    };
    let validation_data = validation.try_borrow_data()?;
    require_exact_execute_meta_list(&validation_data, law_state.key)?;
    let rejection = read_control_tlv(&validation_data)?.ordinal;
    if transfer_class == LaneTransferClass::ProductionClaim && rejection != 0 {
        return Err(FixtureLawError::InjectedHookFailure.into());
    }
    Ok(())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LaneTransferClass {
    SyntheticFunding,
    ProductionClaim,
}

#[derive(Clone, Copy)]
struct LaneTransferFacts {
    amount: u64,
    destination_is_lane: bool,
    source_ordinal: Option<u8>,
    authority_is_signer: bool,
    authority: Pubkey,
    source_owner: Pubkey,
    destination_owner: Pubkey,
    vault_authority: Pubkey,
}

fn classify_lane_transfer(facts: LaneTransferFacts) -> Option<LaneTransferClass> {
    let funding_fixture = facts.amount > 0
        && facts.destination_is_lane
        && facts.source_ordinal.is_none()
        && !facts.authority_is_signer
        && facts.authority == facts.source_owner
        && facts.source_owner != facts.vault_authority
        && facts.destination_owner == facts.vault_authority;
    let production_claim = facts.source_ordinal.is_some()
        && !facts.authority_is_signer
        && facts.authority == facts.vault_authority
        && facts.source_owner == facts.vault_authority
        && facts.destination_owner != facts.vault_authority;
    if funding_fixture {
        Some(LaneTransferClass::SyntheticFunding)
    } else if production_claim {
        Some(LaneTransferClass::ProductionClaim)
    } else {
        None
    }
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

#[cfg(test)]
mod tests {
    use super::{
        authorize_control_update, classify_lane_transfer, control_tlv_offset,
        initialize_control_tlv, read_control_tlv, require_exact_execute_meta_list,
        set_control_ordinal, validation_account_len, ControlUpdateFacts, LaneTransferClass,
        LaneTransferFacts, CONTROL_PAYLOAD_LEN, CONTROL_VERSION,
    };
    use solana_pubkey::Pubkey;
    use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
    use spl_transfer_hook_interface::instruction::ExecuteInstruction;

    const OWNER: Pubkey = Pubkey::new_from_array([0x11; 32]);
    const DELEGATE: Pubkey = Pubkey::new_from_array([0x22; 32]);
    const VAULT: Pubkey = Pubkey::new_from_array([0x33; 32]);
    const OTHER: Pubkey = Pubkey::new_from_array([0x44; 32]);

    fn validation_bytes() -> Vec<u8> {
        let mut data = vec![0u8; validation_account_len().unwrap()];
        let law_meta = ExtraAccountMeta::new_with_pubkey(&OTHER, false, false).unwrap();
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &[law_meta]).unwrap();
        initialize_control_tlv(&mut data, &OWNER).unwrap();
        data
    }

    fn authorized_update() -> ControlUpdateFacts {
        ControlUpdateFacts {
            authority_is_signer: true,
            mint_is_readonly: true,
            mint_owner_matches: true,
            validation_address_matches: true,
            validation_owner_matches: true,
            validation_is_writable: true,
            law_address_matches: true,
            law_owner_matches: true,
            law_is_readonly: true,
            law_is_open: true,
            ordinal: 3,
        }
    }

    fn synthetic_funding() -> LaneTransferFacts {
        LaneTransferFacts {
            amount: 1,
            destination_is_lane: true,
            source_ordinal: None,
            authority_is_signer: false,
            authority: OWNER,
            source_owner: OWNER,
            destination_owner: VAULT,
            vault_authority: VAULT,
        }
    }

    #[test]
    fn synthetic_funding_classifier_is_fail_closed() {
        let accepted = synthetic_funding();
        assert_eq!(
            classify_lane_transfer(accepted),
            Some(LaneTransferClass::SyntheticFunding)
        );

        let cases = [
            (
                "zero amount",
                LaneTransferFacts {
                    amount: 0,
                    ..accepted
                },
            ),
            (
                "signer escalation",
                LaneTransferFacts {
                    authority_is_signer: true,
                    ..accepted
                },
            ),
            (
                "delegate or wrong authority",
                LaneTransferFacts {
                    authority: DELEGATE,
                    ..accepted
                },
            ),
            (
                "non-lane destination",
                LaneTransferFacts {
                    destination_is_lane: false,
                    ..accepted
                },
            ),
            (
                "lane-to-lane",
                LaneTransferFacts {
                    source_ordinal: Some(1),
                    authority: VAULT,
                    source_owner: VAULT,
                    ..accepted
                },
            ),
            (
                "vault-owned non-lane source",
                LaneTransferFacts {
                    source_owner: VAULT,
                    authority: VAULT,
                    ..accepted
                },
            ),
            (
                "wrong destination owner",
                LaneTransferFacts {
                    destination_owner: OTHER,
                    ..accepted
                },
            ),
        ];
        for (label, facts) in cases {
            assert_eq!(classify_lane_transfer(facts), None, "{label}");
        }
    }

    #[test]
    fn production_claim_classifier_is_unchanged() {
        let production = LaneTransferFacts {
            amount: 1,
            destination_is_lane: false,
            source_ordinal: Some(2),
            authority_is_signer: false,
            authority: VAULT,
            source_owner: VAULT,
            destination_owner: OWNER,
            vault_authority: VAULT,
        };
        assert_eq!(
            classify_lane_transfer(production),
            Some(LaneTransferClass::ProductionClaim)
        );
        assert_eq!(
            classify_lane_transfer(LaneTransferFacts {
                authority_is_signer: true,
                ..production
            }),
            None
        );
        assert_eq!(
            classify_lane_transfer(LaneTransferFacts {
                authority: DELEGATE,
                ..production
            }),
            None
        );
        assert_eq!(
            classify_lane_transfer(LaneTransferFacts {
                destination_owner: VAULT,
                ..production
            }),
            None
        );
    }

    #[test]
    fn validation_control_changes_only_ordinal_and_clears_to_exact_baseline() {
        let baseline = validation_bytes();
        require_exact_execute_meta_list(&baseline, &OTHER).unwrap();
        let control = read_control_tlv(&baseline).unwrap();
        assert_eq!(control.controller, OWNER);
        assert_eq!(control.ordinal, 0);

        let mut changed = baseline.clone();
        set_control_ordinal(&mut changed, &OWNER, 2).unwrap();
        let offset = control_tlv_offset().unwrap() + 13;
        let mut expected = baseline.clone();
        expected[offset] = 2;
        assert_eq!(changed, expected);
        require_exact_execute_meta_list(&changed, &OTHER).unwrap();
        assert_eq!(read_control_tlv(&changed).unwrap().ordinal, 2);

        set_control_ordinal(&mut changed, &OWNER, 0).unwrap();
        assert_eq!(changed, baseline);
    }

    #[test]
    fn validation_control_rejects_hostile_bytes_without_mutation() {
        let baseline = validation_bytes();
        let offset = control_tlv_offset().unwrap();
        let mut cases = Vec::new();

        cases.push(("absent TLV", baseline[..offset].to_vec(), false));
        cases.push((
            "wrong account length",
            baseline[..baseline.len() - 1].to_vec(),
            false,
        ));
        let mut wrong_discriminator = baseline.clone();
        wrong_discriminator[offset] ^= 0xff;
        cases.push(("wrong discriminator", wrong_discriminator, false));
        let mut wrong_length = baseline.clone();
        wrong_length[offset + 8..offset + 12].copy_from_slice(
            &u32::try_from(CONTROL_PAYLOAD_LEN + 1)
                .unwrap()
                .to_le_bytes(),
        );
        cases.push(("wrong payload length", wrong_length, false));
        let mut wrong_version = baseline.clone();
        wrong_version[offset + 12] = CONTROL_VERSION + 1;
        cases.push(("wrong version", wrong_version, false));
        let mut wrong_ordinal = baseline.clone();
        wrong_ordinal[offset + 13] = 4;
        cases.push(("wrong ordinal", wrong_ordinal, false));
        let mut wrong_meta_list = baseline.clone();
        wrong_meta_list[0] ^= 0xff;
        cases.push(("wrong Execute meta list", wrong_meta_list, true));

        for (label, data, meta_only) in cases {
            let before = data.clone();
            if meta_only {
                assert!(
                    require_exact_execute_meta_list(&data, &OTHER).is_err(),
                    "{label}"
                );
            } else {
                assert!(read_control_tlv(&data).is_err(), "{label}");
            }
            assert_eq!(data, before, "{label} mutated bytes on failure");
        }

        let mut wrong_controller = baseline.clone();
        let before = wrong_controller.clone();
        assert!(set_control_ordinal(&mut wrong_controller, &DELEGATE, 1).is_err());
        assert_eq!(wrong_controller, before);
        assert!(set_control_ordinal(&mut wrong_controller, &OWNER, 4).is_err());
        assert_eq!(wrong_controller, before);
    }

    #[test]
    fn validation_control_update_facts_are_fail_closed() {
        let accepted = authorized_update();
        assert!(authorize_control_update(accepted));
        let cases = [
            (
                "wrong signer",
                ControlUpdateFacts {
                    authority_is_signer: false,
                    ..accepted
                },
            ),
            (
                "writable mint",
                ControlUpdateFacts {
                    mint_is_readonly: false,
                    ..accepted
                },
            ),
            (
                "wrong mint owner",
                ControlUpdateFacts {
                    mint_owner_matches: false,
                    ..accepted
                },
            ),
            (
                "wrong validation address",
                ControlUpdateFacts {
                    validation_address_matches: false,
                    ..accepted
                },
            ),
            (
                "wrong validation owner",
                ControlUpdateFacts {
                    validation_owner_matches: false,
                    ..accepted
                },
            ),
            (
                "readonly validation",
                ControlUpdateFacts {
                    validation_is_writable: false,
                    ..accepted
                },
            ),
            (
                "wrong Law address",
                ControlUpdateFacts {
                    law_address_matches: false,
                    ..accepted
                },
            ),
            (
                "wrong Law owner",
                ControlUpdateFacts {
                    law_owner_matches: false,
                    ..accepted
                },
            ),
            (
                "writable Law",
                ControlUpdateFacts {
                    law_is_readonly: false,
                    ..accepted
                },
            ),
            (
                "locked Law",
                ControlUpdateFacts {
                    law_is_open: false,
                    ..accepted
                },
            ),
            (
                "invalid control ordinal",
                ControlUpdateFacts {
                    ordinal: 4,
                    ..accepted
                },
            ),
        ];
        for (label, facts) in cases {
            assert!(!authorize_control_update(facts), "{label}");
        }
    }
}

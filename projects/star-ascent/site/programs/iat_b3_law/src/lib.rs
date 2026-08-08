#![deny(unsafe_code)]

use iat_b3_consensus::{
    create_solana_daily_decision, iat_transfer_disposition, protocol_local_day,
    validate_solana_daily_decision, IatTransferDisposition, SolanaDailyDecision,
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
use solana_sysvar::{slot_hashes::PodSlotHashes, Sysvar};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_token_2022_interface::{
    extension::{
        confidential_transfer::ConfidentialTransferMint,
        transfer_hook::{TransferHook, TransferHookAccount},
        BaseStateWithExtensions, ExtensionType, StateWithExtensions,
    },
    instruction::{set_authority, AuthorityType},
    state::{Account as TokenAccount, Mint},
    ID as TOKEN_2022_PROGRAM_ID,
};
use spl_transfer_hook_interface::{
    get_extra_account_metas_address,
    instruction::{ExecuteInstruction, TransferHookInstruction},
};

#[cfg(not(feature = "no-entrypoint"))]
solana_program_entrypoint::entrypoint!(process_instruction);

pub const LAW_STATE_SEED: &[u8] = b"law-state";
pub const INSTRUCTION_NAMESPACE: &[u8; 8] = b"IATB3LAW";
pub const INITIALIZE_LAW_OPCODE: u8 = 0;
pub const FINALIZE_DAY_OPCODE: u8 = 1;
pub const LAW_STATE_MAGIC: &[u8; 8] = b"IATB3S01";
pub const LAW_STATE_VERSION: u8 = 1;
pub const LAW_STATE_LEN: usize = 160;
pub const IAT_DECIMALS: u8 = 9;
pub const IAT_TOTAL_BASE_UNITS: u64 = 1_000_000_000_000_000_000;

/// Provisional one-minute ancestor lag at Solana's nominal 400ms slot time.
/// This constant is source-immutable after deployment, but remains a measured
/// Devnet gate before a Mainnet binary can be frozen.
pub const ENTROPY_LAG_SLOTS: u64 = 150;

#[repr(u32)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IatB3LawError {
    InvalidInstruction = 0,
    InvalidPda = 1,
    IncorrectOwner = 2,
    MissingSignature = 3,
    InvalidMint = 4,
    MissingRequiredMintExtension = 5,
    AlreadyInitialized = 6,
    DayUnfinalized = 7,
    DailyLockdown = 8,
    DayAlreadyFinalized = 9,
    EntropyUnavailable = 10,
    StateCorrupt = 11,
    TransferHookNotExecuting = 12,
    WrongSystemProgram = 13,
    WrongMintAuthority = 14,
    ArithmeticFailure = 15,
    UnapprovedMintExtension = 16,
    InvalidConfidentialTransferConfig = 17,
    MintNotWritable = 18,
    WrongTokenProgram = 19,
}

impl From<IatB3LawError> for ProgramError {
    fn from(value: IatB3LawError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LawState {
    pub bump: u8,
    pub mint: Pubkey,
    pub network_genesis_hash: [u8; 32],
    pub decision: Option<SolanaDailyDecision>,
}

impl LawState {
    pub fn uninitialized(bump: u8, mint: Pubkey, network_genesis_hash: [u8; 32]) -> Self {
        Self {
            bump,
            mint,
            network_genesis_hash,
            decision: None,
        }
    }

    pub fn pack(&self, output: &mut [u8]) -> ProgramResult {
        if output.len() != LAW_STATE_LEN {
            return Err(IatB3LawError::StateCorrupt.into());
        }
        output.fill(0);
        output[0..8].copy_from_slice(LAW_STATE_MAGIC);
        output[8] = LAW_STATE_VERSION;
        output[9] = self.bump;
        output[16..48].copy_from_slice(self.mint.as_ref());
        output[48..80].copy_from_slice(&self.network_genesis_hash);

        if let Some(decision) = self.decision {
            output[10] = 1;
            output[11] = u8::from(decision.locked);
            output[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
            output[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
            output[96..128].copy_from_slice(&decision.ancestor_slot_hash);
            output[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
            output[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
            output[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
            output[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
        }
        Ok(())
    }

    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        if input.len() != LAW_STATE_LEN
            || input.get(0..8) != Some(LAW_STATE_MAGIC)
            || input[8] != LAW_STATE_VERSION
            || input[12..16].iter().any(|byte| *byte != 0)
            || input[142..].iter().any(|byte| *byte != 0)
        {
            return Err(IatB3LawError::StateCorrupt.into());
        }

        let mint = Pubkey::new_from_array(copy_array::<32>(&input[16..48])?);
        let network_genesis_hash = copy_array::<32>(&input[48..80])?;
        let decision = match input[10] {
            0 => {
                if input[11] != 0 || input[80..142].iter().any(|byte| *byte != 0) {
                    return Err(IatB3LawError::StateCorrupt.into());
                }
                None
            }
            1 => {
                let locked = match input[11] {
                    0 => false,
                    1 => true,
                    _ => return Err(IatB3LawError::StateCorrupt.into()),
                };
                Some(SolanaDailyDecision {
                    local_day: i64::from_le_bytes(copy_array::<8>(&input[80..88])?),
                    entropy_slot: u64::from_le_bytes(copy_array::<8>(&input[88..96])?),
                    ancestor_slot_hash: copy_array::<32>(&input[96..128])?,
                    draw_counter: u64::from_le_bytes(copy_array::<8>(&input[128..136])?),
                    draw_bucket: u16::from_le_bytes(copy_array::<2>(&input[136..138])?),
                    chance_numerator: u16::from_le_bytes(copy_array::<2>(&input[138..140])?),
                    chance_denominator: u16::from_le_bytes(copy_array::<2>(&input[140..142])?),
                    locked,
                })
            }
            _ => return Err(IatB3LawError::StateCorrupt.into()),
        };

        Ok(Self {
            bump: input[9],
            mint,
            network_genesis_hash,
            decision,
        })
    }

    pub fn transfer_disposition_at(
        &self,
        unix_timestamp: i64,
    ) -> Result<IatTransferDisposition, ProgramError> {
        iat_transfer_disposition(
            unix_timestamp,
            self.decision,
            self.network_genesis_hash,
            self.mint.to_bytes(),
        )
        .map_err(|_| IatB3LawError::StateCorrupt.into())
    }
}

pub fn law_state_address(program_id: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[LAW_STATE_SEED, mint.as_ref()], program_id)
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
) -> ProgramResult {
    if let Ok(TransferHookInstruction::Execute { amount }) =
        TransferHookInstruction::unpack(instruction_data)
    {
        return process_execute(program_id, accounts, amount);
    }

    let (namespace, body) = instruction_data
        .split_at_checked(INSTRUCTION_NAMESPACE.len())
        .ok_or(IatB3LawError::InvalidInstruction)?;
    if namespace != INSTRUCTION_NAMESPACE || body.is_empty() {
        return Err(IatB3LawError::InvalidInstruction.into());
    }
    match body[0] {
        INITIALIZE_LAW_OPCODE if body.len() == 33 => {
            process_initialize_law(program_id, accounts, copy_array::<32>(&body[1..33])?)
        }
        FINALIZE_DAY_OPCODE if body.len() == 1 => process_finalize_day(program_id, accounts),
        _ => Err(IatB3LawError::InvalidInstruction.into()),
    }
}

fn process_initialize_law(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    network_genesis_hash: [u8; 32],
) -> ProgramResult {
    if network_genesis_hash == [0; 32] {
        return Err(IatB3LawError::InvalidMint.into());
    }
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    let token_2022_program = next_account_info(account_iter)?;

    if !payer.is_signer {
        return Err(IatB3LawError::MissingSignature.into());
    }
    if system.key != &system_program::ID {
        return Err(IatB3LawError::WrongSystemProgram.into());
    }
    if token_2022_program.key != &TOKEN_2022_PROGRAM_ID || !token_2022_program.executable {
        return Err(IatB3LawError::WrongTokenProgram.into());
    }
    if !mint.is_writable {
        return Err(IatB3LawError::MintNotWritable.into());
    }
    validate_mint_extensions(program_id, Some(payer.key), mint)?;

    let (expected_state, state_bump) = law_state_address(program_id, mint.key);
    if law_state.key != &expected_state {
        return Err(IatB3LawError::InvalidPda.into());
    }
    let expected_validation = get_extra_account_metas_address(mint.key, program_id);
    if validation.key != &expected_validation {
        return Err(IatB3LawError::InvalidPda.into());
    }
    if law_state.owner == program_id || validation.owner == program_id {
        return Err(IatB3LawError::AlreadyInitialized.into());
    }

    revoke_mint_extension_authority(
        payer,
        mint,
        token_2022_program,
        AuthorityType::TransferHookProgramId,
    )?;
    revoke_mint_extension_authority(
        payer,
        mint,
        token_2022_program,
        AuthorityType::ConfidentialTransferMint,
    )?;
    validate_mint_extensions(program_id, None, mint)?;

    create_program_pda(
        payer,
        law_state,
        system,
        program_id,
        LAW_STATE_LEN,
        &[LAW_STATE_SEED, mint.key.as_ref(), &[state_bump]],
    )?;

    let extra_meta = ExtraAccountMeta::new_with_seeds(
        &[
            Seed::Literal {
                bytes: LAW_STATE_SEED.to_vec(),
            },
            Seed::AccountKey { index: 1 },
        ],
        false,
        false,
    )?;
    let validation_len = ExtraAccountMetaList::size_of(1)?;
    let (_, validation_bump) =
        Pubkey::find_program_address(&[b"extra-account-metas", mint.key.as_ref()], program_id);
    create_program_pda(
        payer,
        validation,
        system,
        program_id,
        validation_len,
        &[
            b"extra-account-metas",
            mint.key.as_ref(),
            &[validation_bump],
        ],
    )?;

    LawState::uninitialized(state_bump, *mint.key, network_genesis_hash)
        .pack(&mut law_state.try_borrow_mut_data()?)?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(
        &mut validation.try_borrow_mut_data()?,
        &[extra_meta],
    )?;
    Ok(())
}

fn process_finalize_day(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let mint = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;

    if mint.owner != &TOKEN_2022_PROGRAM_ID {
        return Err(IatB3LawError::IncorrectOwner.into());
    }
    validate_law_state_account(program_id, mint.key, law_state, true)?;
    let mut state = LawState::unpack(&law_state.try_borrow_data()?)?;
    if state.mint != *mint.key {
        return Err(IatB3LawError::InvalidMint.into());
    }

    let clock = Clock::get()?;
    let current_day = protocol_local_day(clock.unix_timestamp);
    ensure_day_can_finalize(&state, current_day)?;

    let slot_hashes = PodSlotHashes::fetch()?;
    let (entropy_slot, ancestor_slot_hash) = select_lagged_entropy(
        clock.slot,
        slot_hashes
            .as_slice()?
            .iter()
            .map(|entry| (entry.slot, entry.hash.to_bytes())),
    )?;

    let decision = create_solana_daily_decision(
        current_day,
        entropy_slot,
        ancestor_slot_hash,
        state.network_genesis_hash,
        mint.key.to_bytes(),
    )
    .map_err(|_| ProgramError::from(IatB3LawError::ArithmeticFailure))?;
    state.decision = Some(decision);
    state.pack(&mut law_state.try_borrow_mut_data()?)?;
    Ok(())
}

fn process_execute(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    _amount: u64,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let source = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let destination = next_account_info(account_iter)?;
    let _authority = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;

    if mint.owner != &TOKEN_2022_PROGRAM_ID
        || source.owner != &TOKEN_2022_PROGRAM_ID
        || destination.owner != &TOKEN_2022_PROGRAM_ID
    {
        return Err(IatB3LawError::IncorrectOwner.into());
    }
    if validation.key != &get_extra_account_metas_address(mint.key, program_id)
        || validation.owner != program_id
    {
        return Err(IatB3LawError::InvalidPda.into());
    }
    validate_law_state_account(program_id, mint.key, law_state, false)?;
    validate_transfer_context(source, destination, mint.key)?;

    let state = LawState::unpack(&law_state.try_borrow_data()?)?;
    if state.mint != *mint.key {
        return Err(IatB3LawError::InvalidMint.into());
    }
    let clock = Clock::get()?;
    match state.transfer_disposition_at(clock.unix_timestamp)? {
        IatTransferDisposition::Allowed => Ok(()),
        IatTransferDisposition::DayUnfinalized => Err(IatB3LawError::DayUnfinalized.into()),
        IatTransferDisposition::RejectedDailyLockdown => Err(IatB3LawError::DailyLockdown.into()),
    }
}

fn validate_mint_extensions(
    program_id: &Pubkey,
    expected_authority: Option<&Pubkey>,
    mint: &AccountInfo<'_>,
) -> ProgramResult {
    if mint.owner != &TOKEN_2022_PROGRAM_ID {
        return Err(IatB3LawError::IncorrectOwner.into());
    }
    let mint_data = mint.try_borrow_data()?;
    let mint_state = StateWithExtensions::<Mint>::unpack(&mint_data)
        .map_err(|_| ProgramError::from(IatB3LawError::InvalidMint))?;
    validate_mint_base(&mint_state.base)?;
    validate_mint_extension_allowlist(
        &mint_state
            .get_extension_types()
            .map_err(|_| ProgramError::from(IatB3LawError::InvalidMint))?,
    )?;
    let transfer_hook = mint_state
        .get_extension::<TransferHook>()
        .map_err(|_| ProgramError::from(IatB3LawError::MissingRequiredMintExtension))?;
    let confidential_transfer = mint_state
        .get_extension::<ConfidentialTransferMint>()
        .map_err(|_| ProgramError::from(IatB3LawError::MissingRequiredMintExtension))?;

    if Option::<Pubkey>::from(transfer_hook.program_id) != Some(*program_id) {
        return Err(IatB3LawError::InvalidMint.into());
    }
    let expected_authority = expected_authority.copied();
    if Option::<Pubkey>::from(transfer_hook.authority) != expected_authority {
        return Err(IatB3LawError::WrongMintAuthority.into());
    }
    validate_confidential_transfer_config(
        Option::<Pubkey>::from(confidential_transfer.authority),
        expected_authority,
        bool::from(confidential_transfer.auto_approve_new_accounts),
        confidential_transfer.auditor_elgamal_pubkey == Default::default(),
    )?;
    Ok(())
}

fn validate_confidential_transfer_config(
    authority: Option<Pubkey>,
    expected_authority: Option<Pubkey>,
    auto_approve_new_accounts: bool,
    auditor_is_null: bool,
) -> ProgramResult {
    if authority != expected_authority {
        return Err(IatB3LawError::WrongMintAuthority.into());
    }
    if !auto_approve_new_accounts || !auditor_is_null {
        return Err(IatB3LawError::InvalidConfidentialTransferConfig.into());
    }
    Ok(())
}

fn revoke_mint_extension_authority<'a>(
    payer: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    token_2022_program: &AccountInfo<'a>,
    authority_type: AuthorityType,
) -> ProgramResult {
    let instruction = set_authority(
        &TOKEN_2022_PROGRAM_ID,
        mint.key,
        None,
        authority_type,
        payer.key,
        &[],
    )?;
    invoke(
        &instruction,
        &[mint.clone(), payer.clone(), token_2022_program.clone()],
    )
}

fn validate_mint_extension_allowlist(extension_types: &[ExtensionType]) -> ProgramResult {
    let has_confidential_transfer =
        extension_types.contains(&ExtensionType::ConfidentialTransferMint);
    let has_transfer_hook = extension_types.contains(&ExtensionType::TransferHook);
    if !has_confidential_transfer || !has_transfer_hook {
        return Err(IatB3LawError::MissingRequiredMintExtension.into());
    }
    if extension_types.len() != 2 {
        return Err(IatB3LawError::UnapprovedMintExtension.into());
    }
    Ok(())
}

fn validate_mint_base(mint: &Mint) -> ProgramResult {
    if !mint.is_initialized
        || mint.decimals != IAT_DECIMALS
        || mint.supply != IAT_TOTAL_BASE_UNITS
        || !mint.mint_authority.is_none()
        || !mint.freeze_authority.is_none()
    {
        return Err(IatB3LawError::InvalidMint.into());
    }
    Ok(())
}

fn validate_transfer_context(
    source: &AccountInfo<'_>,
    destination: &AccountInfo<'_>,
    mint: &Pubkey,
) -> ProgramResult {
    let source_data = source.try_borrow_data()?;
    let source_state = StateWithExtensions::<TokenAccount>::unpack(&source_data)
        .map_err(|_| ProgramError::from(IatB3LawError::InvalidMint))?;
    let destination_data = destination.try_borrow_data()?;
    let destination_state = StateWithExtensions::<TokenAccount>::unpack(&destination_data)
        .map_err(|_| ProgramError::from(IatB3LawError::InvalidMint))?;
    if source_state.base.mint != *mint || destination_state.base.mint != *mint {
        return Err(IatB3LawError::InvalidMint.into());
    }
    let hook = source_state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| ProgramError::from(IatB3LawError::TransferHookNotExecuting))?;
    if !bool::from(hook.transferring) {
        return Err(IatB3LawError::TransferHookNotExecuting.into());
    }
    Ok(())
}

fn validate_law_state_account(
    program_id: &Pubkey,
    mint: &Pubkey,
    law_state: &AccountInfo<'_>,
    require_writable: bool,
) -> ProgramResult {
    let (expected, _) = law_state_address(program_id, mint);
    if law_state.key != &expected {
        return Err(IatB3LawError::InvalidPda.into());
    }
    if law_state.owner != program_id || (require_writable && !law_state.is_writable) {
        return Err(IatB3LawError::IncorrectOwner.into());
    }
    Ok(())
}

fn ensure_day_can_finalize(state: &LawState, current_day: i64) -> ProgramResult {
    if let Some(existing) = state.decision {
        validate_solana_daily_decision(existing, state.network_genesis_hash, state.mint.to_bytes())
            .map_err(|_| ProgramError::from(IatB3LawError::StateCorrupt))?;
        if existing.local_day == current_day {
            return Err(IatB3LawError::DayAlreadyFinalized.into());
        }
        if existing.local_day > current_day {
            return Err(IatB3LawError::StateCorrupt.into());
        }
    }
    Ok(())
}

fn select_lagged_entropy<I>(current_slot: u64, entries: I) -> Result<(u64, [u8; 32]), ProgramError>
where
    I: IntoIterator<Item = (u64, [u8; 32])>,
{
    let target_slot = current_slot
        .checked_sub(ENTROPY_LAG_SLOTS)
        .ok_or(IatB3LawError::EntropyUnavailable)?;
    entries
        .into_iter()
        .find(|(slot, _)| *slot <= target_slot)
        .ok_or_else(|| IatB3LawError::EntropyUnavailable.into())
}

fn create_program_pda<'a>(
    payer: &AccountInfo<'a>,
    account: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    program_id: &Pubkey,
    space: usize,
    signer_seeds: &[&[u8]],
) -> ProgramResult {
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);
    let instruction = create_account(
        payer.key,
        account.key,
        lamports,
        u64::try_from(space).map_err(|_| IatB3LawError::ArithmeticFailure)?,
        program_id,
    );
    invoke_signed(
        &instruction,
        &[payer.clone(), account.clone(), system.clone()],
        &[signer_seeds],
    )
}

fn copy_array<const N: usize>(input: &[u8]) -> Result<[u8; N], ProgramError> {
    input
        .try_into()
        .map_err(|_| IatB3LawError::StateCorrupt.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use iat_b3_consensus::{
        create_solana_daily_decision, DRAW_DENOMINATOR, FRIDAY_LOCKDOWN_NUMERATOR,
        NORMAL_DAY_LOCKDOWN_NUMERATOR,
    };
    use spl_transfer_hook_interface::instruction::TransferHookInstruction;

    const PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB3; 32]);
    const MINT: Pubkey = Pubkey::new_from_array([0x22; 32]);
    const NETWORK: [u8; 32] = [0x11; 32];

    #[test]
    fn state_round_trip_preserves_no_decision() {
        let (_, bump) = law_state_address(&PROGRAM_ID, &MINT);
        let state = LawState::uninitialized(bump, MINT, NETWORK);
        let mut bytes = [0u8; LAW_STATE_LEN];
        state.pack(&mut bytes).unwrap();
        assert_eq!(LawState::unpack(&bytes), Ok(state));
    }

    #[test]
    fn state_round_trip_preserves_finalized_decision() {
        let decision =
            create_solana_daily_decision(20_672, 42_424_242, [0x33; 32], NETWORK, MINT.to_bytes())
                .unwrap();
        let state = LawState {
            bump: 254,
            mint: MINT,
            network_genesis_hash: NETWORK,
            decision: Some(decision),
        };
        let mut bytes = [0u8; LAW_STATE_LEN];
        state.pack(&mut bytes).unwrap();
        assert_eq!(LawState::unpack(&bytes), Ok(state));
    }

    #[test]
    fn state_codec_rejects_noncanonical_or_corrupt_bytes() {
        let mut bytes = [0u8; LAW_STATE_LEN];
        LawState::uninitialized(1, MINT, NETWORK)
            .pack(&mut bytes)
            .unwrap();
        bytes[159] = 1;
        assert_eq!(
            LawState::unpack(&bytes),
            Err(IatB3LawError::StateCorrupt.into())
        );
    }

    #[test]
    fn law_state_pda_is_mint_and_program_specific() {
        assert_ne!(
            law_state_address(&PROGRAM_ID, &MINT).0,
            law_state_address(&PROGRAM_ID, &Pubkey::new_from_array([0x23; 32])).0
        );
        assert_ne!(
            law_state_address(&PROGRAM_ID, &MINT).0,
            law_state_address(&Pubkey::new_from_array([0xB4; 32]), &MINT).0
        );
    }

    #[test]
    fn public_transfer_hook_instruction_dispatch_is_standard() {
        let data = TransferHookInstruction::Execute { amount: 100 }.pack();
        assert_eq!(
            TransferHookInstruction::unpack(&data),
            Ok(TransferHookInstruction::Execute { amount: 100 })
        );
    }

    #[test]
    fn kernel_thresholds_remain_one_percent_and_friday_sixty_six_point_six_seven() {
        let normal =
            create_solana_daily_decision(20_671, 1, [0x44; 32], NETWORK, MINT.to_bytes()).unwrap();
        let friday =
            create_solana_daily_decision(20_672, 1, [0x44; 32], NETWORK, MINT.to_bytes()).unwrap();
        assert_eq!(normal.chance_numerator, NORMAL_DAY_LOCKDOWN_NUMERATOR);
        assert_eq!(friday.chance_numerator, FRIDAY_LOCKDOWN_NUMERATOR);
        assert_eq!(normal.chance_denominator, DRAW_DENOMINATOR);
        assert_eq!(friday.chance_denominator, DRAW_DENOMINATOR);
    }

    #[test]
    fn initialization_requires_the_final_fixed_supply_mint_shape() {
        let valid = Mint {
            supply: IAT_TOTAL_BASE_UNITS,
            decimals: IAT_DECIMALS,
            is_initialized: true,
            ..Mint::default()
        };
        assert_eq!(validate_mint_base(&valid), Ok(()));

        let mut wrong_supply = valid;
        wrong_supply.supply -= 1;
        assert_eq!(
            validate_mint_base(&wrong_supply),
            Err(IatB3LawError::InvalidMint.into())
        );

        let mut wrong_decimals = valid;
        wrong_decimals.decimals = 8;
        assert_eq!(
            validate_mint_base(&wrong_decimals),
            Err(IatB3LawError::InvalidMint.into())
        );
    }

    #[test]
    fn mint_extension_allowlist_accepts_only_confidential_transfer_and_hook() {
        assert_eq!(
            validate_mint_extension_allowlist(&[
                ExtensionType::ConfidentialTransferMint,
                ExtensionType::TransferHook,
            ]),
            Ok(())
        );
        assert_eq!(
            validate_mint_extension_allowlist(&[
                ExtensionType::TransferHook,
                ExtensionType::ConfidentialTransferMint,
            ]),
            Ok(())
        );
        assert_eq!(
            validate_mint_extension_allowlist(&[ExtensionType::TransferHook]),
            Err(IatB3LawError::MissingRequiredMintExtension.into())
        );
    }

    #[test]
    fn authority_bearing_and_other_extra_mint_extensions_fail_closed() {
        for unapproved in [
            ExtensionType::PermanentDelegate,
            ExtensionType::MintCloseAuthority,
            ExtensionType::Pausable,
            ExtensionType::ConfidentialMintBurn,
            ExtensionType::TransferFeeConfig,
            ExtensionType::MetadataPointer,
        ] {
            assert_eq!(
                validate_mint_extension_allowlist(&[
                    ExtensionType::ConfidentialTransferMint,
                    ExtensionType::TransferHook,
                    unapproved,
                ]),
                Err(IatB3LawError::UnapprovedMintExtension.into()),
                "extension {unapproved:?} must be rejected"
            );
        }
    }

    #[test]
    fn confidential_transfer_config_must_be_exact_before_and_after_sealing() {
        let authority = Pubkey::new_from_array([0x77; 32]);
        assert_eq!(
            validate_confidential_transfer_config(Some(authority), Some(authority), true, true,),
            Ok(())
        );
        assert_eq!(
            validate_confidential_transfer_config(None, None, true, true),
            Ok(())
        );
        assert_eq!(
            validate_confidential_transfer_config(
                Some(Pubkey::new_from_array([0x78; 32])),
                Some(authority),
                true,
                true,
            ),
            Err(IatB3LawError::WrongMintAuthority.into())
        );
        for (auto_approve, auditor_is_null) in [(false, true), (true, false)] {
            assert_eq!(
                validate_confidential_transfer_config(
                    Some(authority),
                    Some(authority),
                    auto_approve,
                    auditor_is_null,
                ),
                Err(IatB3LawError::InvalidConfidentialTransferConfig.into())
            );
        }
    }

    #[test]
    fn same_day_reroll_and_future_state_fail_closed() {
        let decision =
            create_solana_daily_decision(20_672, 1, [0x44; 32], NETWORK, MINT.to_bytes()).unwrap();
        let mut state = LawState::uninitialized(1, MINT, NETWORK);
        state.decision = Some(decision);
        assert_eq!(
            ensure_day_can_finalize(&state, 20_672),
            Err(IatB3LawError::DayAlreadyFinalized.into())
        );
        assert_eq!(
            ensure_day_can_finalize(&state, 20_671),
            Err(IatB3LawError::StateCorrupt.into())
        );
        assert_eq!(ensure_day_can_finalize(&state, 20_673), Ok(()));
    }

    #[test]
    fn lagged_entropy_selection_is_deterministic_and_fails_closed() {
        let entries = [(1_000, [1; 32]), (999, [2; 32]), (850, [3; 32])];
        assert_eq!(select_lagged_entropy(1_000, entries), Ok((850, [3; 32])));
        assert_eq!(
            select_lagged_entropy(149, entries),
            Err(IatB3LawError::EntropyUnavailable.into())
        );
    }

    #[test]
    fn serialized_adapter_state_gates_missing_stale_locked_and_open_days() {
        const FRIDAY_BOUNDARY_UTC: i64 = 1_786_050_060;
        let mut state = LawState::uninitialized(1, MINT, NETWORK);
        assert_eq!(
            state.transfer_disposition_at(FRIDAY_BOUNDARY_UTC),
            Ok(IatTransferDisposition::DayUnfinalized)
        );

        let prior_day =
            create_solana_daily_decision(20_671, 1, [0x55; 32], NETWORK, MINT.to_bytes()).unwrap();
        state.decision = Some(prior_day);
        let prior_day_expected = if prior_day.locked {
            IatTransferDisposition::RejectedDailyLockdown
        } else {
            IatTransferDisposition::Allowed
        };
        assert_eq!(
            state.transfer_disposition_at(FRIDAY_BOUNDARY_UTC - 1),
            Ok(prior_day_expected)
        );
        assert_eq!(
            state.transfer_disposition_at(FRIDAY_BOUNDARY_UTC),
            Ok(IatTransferDisposition::DayUnfinalized)
        );

        let mut decisions = (0..10_000).map(|entropy_slot| {
            create_solana_daily_decision(20_672, entropy_slot, [0x66; 32], NETWORK, MINT.to_bytes())
                .unwrap()
        });
        let locked = decisions
            .clone()
            .find(|decision| decision.locked)
            .expect("Friday vector must include a locked decision");
        let open = decisions
            .find(|decision| !decision.locked)
            .expect("Friday vector must include an open decision");

        state.decision = Some(locked);
        assert_eq!(
            state.transfer_disposition_at(FRIDAY_BOUNDARY_UTC),
            Ok(IatTransferDisposition::RejectedDailyLockdown)
        );
        state.decision = Some(open);
        assert_eq!(
            state.transfer_disposition_at(FRIDAY_BOUNDARY_UTC),
            Ok(IatTransferDisposition::Allowed)
        );
    }
}

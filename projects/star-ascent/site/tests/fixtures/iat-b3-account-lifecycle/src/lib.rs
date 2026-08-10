#![deny(unsafe_code)]

use iat_b3_economy::native_adapter::{
    derive_pda, seal_atomic_write_batch, NativeEconomyBinding, PdaIdentity, StrictStateValue,
};
use iat_b3_economy::runtime_account_lifecycle::execute_create_state_batch_account_infos;
use iat_b3_economy::runtime_adapter::{
    prepare_create_state_account_info, verify_daily_law_open_account_info,
};
use iat_b3_economy::{CanonicalDailyLawBinding, EligibilityState};
use solana_account_info::{next_account_info, AccountInfo};
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

solana_program_entrypoint::entrypoint!(process_instruction);

pub const REHEARSAL_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE6; 32]);
pub const REHEARSAL_LAW_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB3; 32]);
pub const REHEARSAL_MINT: Pubkey = Pubkey::new_from_array([0x22; 32]);
pub const REHEARSAL_NETWORK_GENESIS_HASH: [u8; 32] = [0x11; 32];
pub const INSTRUCTION_NAMESPACE: &[u8; 8] = b"IATB3LC1";
pub const INSTRUCTION_VERSION: u8 = 1;
pub const INSTRUCTION_LEN: usize = 16;

const OPERATOR_ZERO_LAMPORT: [u8; 32] = [0xA1; 32];
const OPERATOR_PREFUNDED: [u8; 32] = [0xA2; 32];
const OPERATOR_ROLLBACK: [u8; 32] = [0xA3; 32];

#[repr(u32)]
enum RehearsalError {
    InvalidInstruction = 900,
    InvalidProgram = 901,
    InvalidAccountCount = 902,
    InvalidLawBinding = 903,
    InvalidNativeBinding = 904,
    InvalidPayer = 905,
    InvalidTarget = 906,
    BatchSealFailed = 907,
    LifecycleFailed = 908,
    InjectedRollback = 909,
}

impl From<RehearsalError> for ProgramError {
    fn from(value: RehearsalError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
) -> ProgramResult {
    if program_id != &REHEARSAL_PROGRAM_ID {
        return Err(RehearsalError::InvalidProgram.into());
    }
    if instruction_data.len() != INSTRUCTION_LEN
        || instruction_data.get(0..8) != Some(INSTRUCTION_NAMESPACE)
        || instruction_data[8] != INSTRUCTION_VERSION
        || instruction_data[10..].iter().any(|byte| *byte != 0)
    {
        return Err(RehearsalError::InvalidInstruction.into());
    }

    match instruction_data[9] {
        0 => execute_single(program_id, accounts, OPERATOR_ZERO_LAMPORT, false),
        1 => execute_single(program_id, accounts, OPERATOR_PREFUNDED, false),
        2 => execute_single(program_id, accounts, OPERATOR_ROLLBACK, true),
        _ => Err(RehearsalError::InvalidInstruction.into()),
    }
}

#[inline(never)]
fn bindings(
    program_id: &Pubkey,
    law_state: &AccountInfo<'_>,
) -> Result<(iat_b3_economy::ValidatedDailyLawWrite, NativeEconomyBinding), ProgramError> {
    let (expected_law_state, law_bump) =
        Pubkey::find_program_address(&[b"law-state"], &REHEARSAL_LAW_PROGRAM_ID);
    if law_state.key != &expected_law_state {
        return Err(RehearsalError::InvalidLawBinding.into());
    }
    let law_binding = CanonicalDailyLawBinding::new(
        REHEARSAL_LAW_PROGRAM_ID.to_bytes(),
        expected_law_state.to_bytes(),
        law_bump,
        REHEARSAL_MINT.to_bytes(),
        REHEARSAL_NETWORK_GENESIS_HASH,
    );
    let gate = verify_daily_law_open_account_info(&law_binding, law_state)
        .map_err(|_| RehearsalError::InvalidLawBinding)?;
    let native = NativeEconomyBinding::new(program_id.to_bytes(), REHEARSAL_MINT.to_bytes())
        .map_err(|_| RehearsalError::InvalidNativeBinding)?;
    Ok((gate, native))
}

#[inline(never)]
fn intent_for<'a>(
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    native: &NativeEconomyBinding,
    payer: &AccountInfo<'a>,
    target: &AccountInfo<'a>,
    operator: [u8; 32],
) -> Result<iat_b3_economy::native_adapter::StateWriteIntent, ProgramError> {
    let identity = PdaIdentity::Eligibility {
        config: native.config(),
        operator,
    };
    let derived = derive_pda(native, identity).map_err(|_| RehearsalError::InvalidTarget)?;
    if target.key.to_bytes() != derived.key {
        return Err(RehearsalError::InvalidTarget.into());
    }
    prepare_create_state_account_info(
        gate,
        native,
        payer,
        payer.key.to_bytes(),
        target,
        identity,
        StrictStateValue::Eligibility(EligibilityState {
            config: native.config(),
            wallet: operator,
            agency_index: u32::MAX,
            role: 0,
            bump: derived.bump,
        }),
    )
    .map_err(|_| RehearsalError::InvalidPayer.into())
}

#[inline(never)]
fn execute_single(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    operator: [u8; 32],
    inject_rollback: bool,
) -> ProgramResult {
    if accounts.len() != 4 {
        return Err(RehearsalError::InvalidAccountCount.into());
    }
    let account_iter = &mut accounts.iter();
    let law_state = next_account_info(account_iter)?;
    let payer = next_account_info(account_iter)?;
    let target = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    let (gate, native) = bindings(program_id, law_state)?;
    let batch = seal_atomic_write_batch(
        &gate,
        &native,
        [intent_for(&gate, &native, payer, target, operator)?],
    )
    .map_err(|_| RehearsalError::BatchSealFailed)?;
    execute_create_state_batch_account_infos(
        &gate,
        &native,
        batch,
        core::slice::from_ref(target),
        core::slice::from_ref(payer),
        system,
    )
    .map_err(|_| RehearsalError::LifecycleFailed)?;
    if inject_rollback {
        Err(RehearsalError::InjectedRollback.into())
    } else {
        Ok(())
    }
}

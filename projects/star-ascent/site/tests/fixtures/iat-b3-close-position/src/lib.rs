#![deny(unsafe_code)]

//! Disposable loopback wrapper for the real production `close_position`
//! runtime handler. This crate is outside the production workspace and its
//! entrypoint/error mapping are synthetic rehearsal infrastructure only.

use iat_b3_economy::native_adapter::NativeEconomyBinding;
use iat_b3_economy::production_close_position::execute_runtime_production_close_position_account_infos;
use iat_b3_economy::runtime_adapter::verify_runtime_daily_law_open_account_info;
use iat_b3_economy::CanonicalDailyLawBinding;
use solana_account_info::AccountInfo;
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

solana_program_entrypoint::entrypoint!(process_instruction);

pub const REHEARSAL_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE7; 32]);
pub const REHEARSAL_LAW_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB3; 32]);
pub const REHEARSAL_MINT: Pubkey = Pubkey::new_from_array([0x22; 32]);
pub const REHEARSAL_NETWORK_GENESIS_HASH: [u8; 32] = [0x11; 32];

const BASE_ACCOUNT_COUNT: usize = 7;
const INJECTED_ACCOUNT_COUNT: usize = 8;
const INJECTED_FAILURE_SENTINEL: Pubkey = Pubkey::new_from_array([0; 32]);

#[repr(u32)]
enum RehearsalError {
    InvalidProgram = 900,
    InvalidAccountCount = 901,
    InvalidNativeBinding = 902,
    LawRejectedBeforeDecode = 910,
    ProductionClosePositionFailed = 911,
    InjectedAfterProductionHandlerSuccess = 912,
    InvalidFailureSentinel = 913,
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

    // The runtime Law capability is deliberately obtained before account-count
    // or production instruction decoding. A malformed instruction paired with
    // the wrong Law account therefore proves the fail-closed ordering.
    let law_state = accounts
        .first()
        .ok_or(RehearsalError::InvalidAccountCount)?;
    let law_binding = canonical_law_binding();
    let runtime_law = verify_runtime_daily_law_open_account_info(&law_binding, law_state)
        .map_err(|_| RehearsalError::LawRejectedBeforeDecode)?;

    if accounts.len() != BASE_ACCOUNT_COUNT && accounts.len() != INJECTED_ACCOUNT_COUNT {
        return Err(RehearsalError::InvalidAccountCount.into());
    }
    if accounts.len() == INJECTED_ACCOUNT_COUNT
        && accounts[BASE_ACCOUNT_COUNT].key != &INJECTED_FAILURE_SENTINEL
    {
        return Err(RehearsalError::InvalidFailureSentinel.into());
    }

    let binding = NativeEconomyBinding::new(program_id.to_bytes(), REHEARSAL_MINT.to_bytes())
        .map_err(|_| RehearsalError::InvalidNativeBinding)?;
    execute_runtime_production_close_position_account_infos(
        &runtime_law,
        &binding,
        instruction_data,
        &accounts[1..BASE_ACCOUNT_COUNT],
    )
    .map_err(|_| RehearsalError::ProductionClosePositionFailed)?;

    // Returning an error after the real handler has completed must cause the
    // validator to restore all four state accounts byte-for-byte.
    if accounts.len() == INJECTED_ACCOUNT_COUNT {
        return Err(RehearsalError::InjectedAfterProductionHandlerSuccess.into());
    }
    Ok(())
}

fn canonical_law_binding() -> CanonicalDailyLawBinding {
    let (law_state, bump) =
        Pubkey::find_program_address(&[b"law-state"], &REHEARSAL_LAW_PROGRAM_ID);
    CanonicalDailyLawBinding::new(
        REHEARSAL_LAW_PROGRAM_ID.to_bytes(),
        law_state.to_bytes(),
        bump,
        REHEARSAL_MINT.to_bytes(),
        REHEARSAL_NETWORK_GENESIS_HASH,
    )
}

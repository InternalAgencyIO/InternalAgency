#![deny(unsafe_code)]

use iat_b3_economy::native_adapter::{
    derive_pda, seal_atomic_write_batch, NativeEconomyBinding, PdaIdentity, StrictStateValue,
};
use iat_b3_economy::production_instruction::{
    decode_production_instruction, ProductionInstruction, PRODUCTION_INSTRUCTION_NAMESPACE,
};
use iat_b3_economy::runtime_account_lifecycle::{
    execute_create_state_batch_account_infos,
    execute_production_active_init_if_needed_account_infos,
    prepare_production_active_init_if_needed_account_infos, ProductionInitIfNeededPath,
};
use iat_b3_economy::runtime_adapter::{
    authenticate_runtime_production_active_config, prepare_create_state_account_info,
    prepare_existing_state_write_account_info, verify_daily_law_open_account_info,
    verify_runtime_daily_law_open_account_info,
};
use iat_b3_economy::runtime_write_adapter::execute_existing_write_batch_account_infos;
use iat_b3_economy::{
    set_eligibility, CanonicalDailyLawBinding, EconomyError, EligibilityState, SetEligibilityInput,
};
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
    ProductionLawRejectedBeforeDecode = 910,
    ProductionSetEligibilityUnknownRole = 911,
    ProductionSetEligibilityFailed = 912,
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
    if instruction_data.get(..PRODUCTION_INSTRUCTION_NAMESPACE.len())
        == Some(PRODUCTION_INSTRUCTION_NAMESPACE)
    {
        return execute_production_set_eligibility(program_id, accounts, instruction_data);
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
        3 => execute_existing(program_id, accounts, false),
        4 => execute_existing(program_id, accounts, true),
        _ => Err(RehearsalError::InvalidInstruction.into()),
    }
}

#[inline(never)]
fn execute_production_set_eligibility(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
) -> ProgramResult {
    let law_state = accounts
        .first()
        .ok_or(RehearsalError::InvalidAccountCount)?;
    // The fixture deliberately authenticates the runtime Law account before
    // the production decoder, account graph, retained body, or System CPI.
    let law_binding = canonical_law_binding();
    let runtime_law = verify_runtime_daily_law_open_account_info(&law_binding, law_state)
        .map_err(|_| RehearsalError::ProductionLawRejectedBeforeDecode)?;
    let native = native_binding(program_id)?;

    let (role, agency_index) = match decode_production_instruction(instruction_data)
        .map_err(|_| RehearsalError::ProductionSetEligibilityFailed)?
    {
        ProductionInstruction::SetEligibility { role, agency_index } => (role, agency_index),
        _ => return Err(RehearsalError::ProductionSetEligibilityFailed.into()),
    };
    if accounts.len() != 6 || agency_index.is_some() || !matches!(role, 0 | 3 | 255) {
        return Err(RehearsalError::ProductionSetEligibilityFailed.into());
    }
    let production_accounts = &accounts[1..];
    let gate = verify_daily_law_open_account_info(&law_binding, law_state)
        .map_err(|_| RehearsalError::ProductionSetEligibilityFailed)?;
    let active_config = authenticate_runtime_production_active_config(
        &runtime_law,
        &native,
        &production_accounts[1],
    )
    .map_err(|_| RehearsalError::ProductionSetEligibilityFailed)?;
    execute_set_eligibility_rollback_prerequisite(
        &gate,
        &active_config,
        &native,
        production_accounts,
        role,
        agency_index,
    )
}

#[allow(clippy::too_many_arguments)]
#[inline(never)]
fn execute_set_eligibility_rollback_prerequisite(
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    active_config: &iat_b3_economy::runtime_adapter::RuntimeProductionActiveConfig,
    native: &NativeEconomyBinding,
    production_accounts: &[AccountInfo<'_>],
    role: u8,
    agency_index: Option<u32>,
) -> ProgramResult {
    let wallet = &production_accounts[2];
    if wallet.is_signer || wallet.is_writable || wallet.executable {
        return Err(RehearsalError::ProductionSetEligibilityFailed.into());
    }
    let identity = PdaIdentity::Eligibility {
        config: active_config.key(),
        operator: wallet.key.to_bytes(),
    };
    let derived =
        derive_pda(native, identity).map_err(|_| RehearsalError::ProductionSetEligibilityFailed)?;
    let provisional_next = EligibilityState {
        config: active_config.key(),
        wallet: wallet.key.to_bytes(),
        agency_index: u32::MAX,
        role: 0,
        bump: derived.bump,
    };
    let prepared = prepare_production_active_init_if_needed_account_infos(
        gate,
        active_config,
        native,
        &production_accounts[0],
        &production_accounts[3],
        &production_accounts[4],
        identity,
        StrictStateValue::Eligibility(provisional_next),
    )
    .map_err(|_| RehearsalError::ProductionSetEligibilityFailed)?;
    if prepared.path() == ProductionInitIfNeededPath::ExistingCas {
        // Existing state must reach the retained role check with zero CPI and
        // no account write. A successful retained body would execute its CAS.
        retained_set_eligibility(
            gate,
            active_config,
            wallet.key.to_bytes(),
            role,
            agency_index,
            derived.bump,
            provisional_next,
        )?;
        execute_production_active_init_if_needed_account_infos(
            gate,
            active_config,
            native,
            prepared,
            &production_accounts[0],
            &production_accounts[3],
            &production_accounts[4],
        )
        .map_err(|_| RehearsalError::ProductionSetEligibilityFailed)?;
    } else {
        // This fixture-only rollback prerequisite deliberately executes the
        // sealed System lifecycle before the invalid retained body. It proves
        // real transaction rollback, but does not claim the combined executor
        // or final binary is SBF-safe.
        execute_production_active_init_if_needed_account_infos(
            gate,
            active_config,
            native,
            prepared,
            &production_accounts[0],
            &production_accounts[3],
            &production_accounts[4],
        )
        .map_err(|_| RehearsalError::ProductionSetEligibilityFailed)?;
        retained_set_eligibility(
            gate,
            active_config,
            wallet.key.to_bytes(),
            role,
            agency_index,
            derived.bump,
            provisional_next,
        )?;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
#[inline(never)]
fn retained_set_eligibility(
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    active_config: &iat_b3_economy::runtime_adapter::RuntimeProductionActiveConfig,
    wallet: [u8; 32],
    role: u8,
    agency_index: Option<u32>,
    eligibility_bump: u8,
    expected: EligibilityState,
) -> ProgramResult {
    let result = set_eligibility(
        gate,
        SetEligibilityInput {
            config_key: active_config.key(),
            config: active_config.state().config,
            wallet,
            role,
            agency_index,
            eligibility_bump,
        },
    )
    .map_err(|error| match error {
        EconomyError::UnknownRole => {
            ProgramError::from(RehearsalError::ProductionSetEligibilityUnknownRole)
        }
        _ => ProgramError::from(RehearsalError::ProductionSetEligibilityFailed),
    })?;
    if result.eligibility != expected {
        return Err(RehearsalError::ProductionSetEligibilityFailed.into());
    }
    Ok(())
}

fn canonical_law_binding() -> CanonicalDailyLawBinding {
    let (expected_law_state, law_bump) =
        Pubkey::find_program_address(&[b"law-state"], &REHEARSAL_LAW_PROGRAM_ID);
    CanonicalDailyLawBinding::new(
        REHEARSAL_LAW_PROGRAM_ID.to_bytes(),
        expected_law_state.to_bytes(),
        law_bump,
        REHEARSAL_MINT.to_bytes(),
        REHEARSAL_NETWORK_GENESIS_HASH,
    )
}

fn native_binding(program_id: &Pubkey) -> Result<NativeEconomyBinding, ProgramError> {
    NativeEconomyBinding::new(program_id.to_bytes(), REHEARSAL_MINT.to_bytes())
        .map_err(|_| RehearsalError::InvalidNativeBinding.into())
}

#[inline(never)]
fn bindings(
    program_id: &Pubkey,
    law_state: &AccountInfo<'_>,
) -> Result<(iat_b3_economy::ValidatedDailyLawWrite, NativeEconomyBinding), ProgramError> {
    let law_binding = canonical_law_binding();
    if law_state.key.to_bytes() != law_binding.law_state_address() {
        return Err(RehearsalError::InvalidLawBinding.into());
    }
    let gate = verify_daily_law_open_account_info(&law_binding, law_state)
        .map_err(|_| RehearsalError::InvalidLawBinding)?;
    let native = native_binding(program_id)?;
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

#[inline(never)]
fn prepare_existing_batch(
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    native: &NativeEconomyBinding,
    target: &AccountInfo<'_>,
    inject_rollback: bool,
) -> Result<iat_b3_economy::native_adapter::AtomicWriteBatch<1>, ProgramError> {
    let identity = PdaIdentity::Eligibility {
        config: native.config(),
        operator: OPERATOR_ZERO_LAMPORT,
    };
    let derived = derive_pda(native, identity).map_err(|_| RehearsalError::InvalidTarget)?;
    if target.key.to_bytes() != derived.key {
        return Err(RehearsalError::InvalidTarget.into());
    }
    let next = StrictStateValue::Eligibility(EligibilityState {
        config: native.config(),
        wallet: OPERATOR_ZERO_LAMPORT,
        agency_index: if inject_rollback { 1 } else { 0 },
        role: if inject_rollback { 2 } else { 1 },
        bump: derived.bump,
    });
    seal_atomic_write_batch(
        gate,
        native,
        [
            prepare_existing_state_write_account_info(gate, native, target, identity, next)
                .map_err(|_| RehearsalError::InvalidTarget)?,
        ],
    )
    .map_err(|_| RehearsalError::BatchSealFailed.into())
}

#[inline(never)]
fn apply_existing_batch(
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    native: &NativeEconomyBinding,
    target: &AccountInfo<'_>,
    batch: iat_b3_economy::native_adapter::AtomicWriteBatch<1>,
) -> ProgramResult {
    execute_existing_write_batch_account_infos(gate, native, batch, core::slice::from_ref(target))
        .map(|_| ())
        .map_err(|_| RehearsalError::LifecycleFailed.into())
}

#[inline(never)]
fn execute_existing(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    inject_rollback: bool,
) -> ProgramResult {
    if accounts.len() != 2 {
        return Err(RehearsalError::InvalidAccountCount.into());
    }
    let account_iter = &mut accounts.iter();
    let law_state = next_account_info(account_iter)?;
    let target = next_account_info(account_iter)?;
    let (gate, native) = bindings(program_id, law_state)?;
    let batch = prepare_existing_batch(&gate, &native, target, inject_rollback)?;
    apply_existing_batch(&gate, &native, target, batch)?;
    if inject_rollback {
        Err(RehearsalError::InjectedRollback.into())
    } else {
        Ok(())
    }
}

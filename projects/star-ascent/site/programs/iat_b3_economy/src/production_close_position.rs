//! Exact existing-state runtime handler for retained V2 `close_position`.
//!
//! This is one deliberately narrow handler path, not the all-fifteen
//! dispatcher or a Solana entrypoint. It accepts only the frozen
//! `ClosePosition` instruction, authenticates the open Daily-Law capability,
//! production ACTIVE Config, signer meta, Position PDA, and three ordered Lane
//! PDAs, executes the retained V2 transition, then commits all four strict
//! postimages through the all-borrows-before-first-write CAS primitive.
//!
//! The retained V2 account contract requires a signer but does not require the
//! signer to own the Position; this handler preserves that behavior exactly.

use crate::native_adapter::{
    prepare_existing_state_write, seal_atomic_write_batch, NativeAdapterError,
    NativeEconomyBinding, PdaIdentity, StrictStateValue,
};
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_adapter::{
    authenticate_production_active_config_account_info,
    authenticate_runtime_production_active_config, authenticate_signer_account_info,
    authenticate_state_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
    RuntimeValidatedDailyLawWrite,
};
use crate::runtime_write_adapter::{
    execute_production_active_existing_write_batch_account_infos, RuntimeWriteAdapterError,
    RuntimeWriteReceipt,
};
use crate::{
    close_position, decode_position_state, CodecError, EconomyError, LaneState, PositionState,
    ValidatedDailyLawWrite, ECOSYSTEM, LIQUIDITY, TREASURY,
};
use solana_account_info::AccountInfo;

pub const PRODUCTION_CLOSE_POSITION_ACCOUNT_COUNT: usize = 6;
pub const PRODUCTION_CLOSE_POSITION_WRITE_COUNT: usize = 4;
pub const PRODUCTION_CLOSE_POSITION_STATUS: &str =
    "ONE_OF_15_EXACT_ATOMIC_RUNTIME_HANDLER_NO_ENTRYPOINT_ALL_15_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionClosePositionTruth {
    pub feature_gated: bool,
    pub exact_instruction_codec_required: bool,
    pub runtime_daily_law_capability_supported: bool,
    pub production_active_config_required: bool,
    pub exact_account_count_and_flags_required: bool,
    pub position_and_ordered_lane_pdas_authenticated: bool,
    pub retained_v2_transition_used: bool,
    pub all_four_preimages_revalidated_before_first_write: bool,
    pub exact_four_account_atomic_cas_supported: bool,
    pub token_cpi_executed: bool,
    pub system_cpi_executed: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub all_15_handlers_complete: bool,
    pub devnet_executed: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_CLOSE_POSITION_TRUTH: ProductionClosePositionTruth =
    ProductionClosePositionTruth {
        feature_gated: true,
        exact_instruction_codec_required: true,
        runtime_daily_law_capability_supported: true,
        production_active_config_required: true,
        exact_account_count_and_flags_required: true,
        position_and_ordered_lane_pdas_authenticated: true,
        retained_v2_transition_used: true,
        all_four_preimages_revalidated_before_first_write: true,
        exact_four_account_atomic_cas_supported: true,
        token_cpi_executed: false,
        system_cpi_executed: false,
        production_dispatcher_exposed: false,
        production_entrypoint_exposed: false,
        handler_complete: true,
        all_15_handlers_complete: false,
        devnet_executed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionClosePositionError {
    Instruction(ProductionInstructionError),
    WrongInstruction,
    AccountCountMismatch,
    CallerMustBeReadonly,
    AccountBorrowFailed,
    PositionCodec(CodecError),
    StateTypeMismatch,
    Runtime(RuntimeAdapterError),
    Native(NativeAdapterError),
    Economy(EconomyError),
    Write(RuntimeWriteAdapterError),
}

impl From<ProductionInstructionError> for ProductionClosePositionError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

impl From<RuntimeAdapterError> for ProductionClosePositionError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<NativeAdapterError> for ProductionClosePositionError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<EconomyError> for ProductionClosePositionError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

impl From<RuntimeWriteAdapterError> for ProductionClosePositionError {
    fn from(value: RuntimeWriteAdapterError) -> Self {
        Self::Write(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionClosePositionReceipt {
    caller: [u8; 32],
    position: [u8; 32],
    writes: RuntimeWriteReceipt<PRODUCTION_CLOSE_POSITION_WRITE_COUNT>,
}

impl ProductionClosePositionReceipt {
    pub const fn caller(&self) -> [u8; 32] {
        self.caller
    }

    pub const fn position(&self) -> [u8; 32] {
        self.position
    }

    pub const fn writes(&self) -> &RuntimeWriteReceipt<PRODUCTION_CLOSE_POSITION_WRITE_COUNT> {
        &self.writes
    }
}

/// Runtime production path. `runtime_law` can only be obtained from the
/// canonical Law AccountInfo and Clock sysvar; Config authentication is
/// repeated against the live read-only Config account before any state write.
#[inline(never)]
pub fn execute_runtime_production_close_position_account_infos(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<ProductionClosePositionReceipt, ProductionClosePositionError> {
    require_close_position_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let caller = authenticate_caller(runtime_law.gate(), binding, &accounts[0])?;
    let active_config =
        authenticate_runtime_production_active_config(runtime_law, binding, &accounts[1])?;
    execute_with_active_config(
        runtime_law.gate(),
        &active_config,
        binding,
        caller,
        accounts,
    )
}

/// Host/rehearsal seam for deterministic tests and final-binary rehearsal.
/// Mainnet composition must use
/// [`execute_runtime_production_close_position_account_infos`] so callers
/// cannot supply a timestamp-shaped Law observation.
#[inline(never)]
pub fn execute_production_close_position_account_infos(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<ProductionClosePositionReceipt, ProductionClosePositionError> {
    require_close_position_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let caller = authenticate_caller(gate, binding, &accounts[0])?;
    let active_config =
        authenticate_production_active_config_account_info(gate, binding, &accounts[1])?;
    execute_with_active_config(gate, &active_config, binding, caller, accounts)
}

fn require_close_position_instruction(
    instruction_data: &[u8],
) -> Result<(), ProductionClosePositionError> {
    if decode_production_instruction(instruction_data)? != ProductionInstruction::ClosePosition {
        return Err(ProductionClosePositionError::WrongInstruction);
    }
    Ok(())
}

fn require_exact_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionClosePositionError> {
    if accounts.len() != PRODUCTION_CLOSE_POSITION_ACCOUNT_COUNT {
        return Err(ProductionClosePositionError::AccountCountMismatch);
    }
    Ok(())
}

fn execute_with_active_config(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    caller: [u8; 32],
    accounts: &[AccountInfo<'_>],
) -> Result<ProductionClosePositionReceipt, ProductionClosePositionError> {
    let position_identity = embedded_position_identity(&accounts[2], active_config.key(), binding)?;
    let position = authenticate_state(gate, binding, &accounts[2], position_identity)?;
    let treasury = authenticate_lane(gate, binding, &accounts[3], active_config.key(), TREASURY)?;
    let ecosystem = authenticate_lane(gate, binding, &accounts[4], active_config.key(), ECOSYSTEM)?;
    let liquidity = authenticate_lane(gate, binding, &accounts[5], active_config.key(), LIQUIDITY)?;

    let result = close_position(
        gate,
        active_config.state().config.active,
        position,
        treasury,
        ecosystem,
        liquidity,
    )?;
    let intents = [
        prepare_existing_state_write(
            gate,
            binding,
            &authenticate_state_account_info(gate, binding, &accounts[2], position_identity)?,
            StrictStateValue::Position(result.position),
        )?,
        prepare_lane_write(
            gate,
            binding,
            &accounts[3],
            active_config.key(),
            result.treasury,
        )?,
        prepare_lane_write(
            gate,
            binding,
            &accounts[4],
            active_config.key(),
            result.ecosystem,
        )?,
        prepare_lane_write(
            gate,
            binding,
            &accounts[5],
            active_config.key(),
            result.liquidity,
        )?,
    ];
    let batch = seal_atomic_write_batch(gate, binding, intents)?;
    let writes = execute_production_active_existing_write_batch_account_infos(
        gate,
        active_config,
        binding,
        batch,
        &accounts[2..],
    )?;

    Ok(ProductionClosePositionReceipt {
        caller,
        position: accounts[2].key.to_bytes(),
        writes,
    })
}

fn authenticate_caller(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
) -> Result<[u8; 32], ProductionClosePositionError> {
    if account.is_writable {
        return Err(ProductionClosePositionError::CallerMustBeReadonly);
    }
    let key = account.key.to_bytes();
    Ok(authenticate_signer_account_info(gate, binding, account, key, false)?.key())
}

fn embedded_position_identity(
    account: &AccountInfo<'_>,
    config: [u8; 32],
    binding: &NativeEconomyBinding,
) -> Result<PdaIdentity, ProductionClosePositionError> {
    if account.owner.to_bytes() != binding.program_id() {
        return Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::AccountOwnerMismatch),
        ));
    }
    if !account.is_writable {
        return Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::AccountMustBeWritable),
        ));
    }
    if account.executable {
        return Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::AccountMustNotBeExecutable),
        ));
    }
    if account.is_signer {
        return Err(ProductionClosePositionError::Runtime(
            RuntimeAdapterError::Native(NativeAdapterError::PdaAccountMustNotBeSigner),
        ));
    }
    let data = account
        .try_borrow_data()
        .map_err(|_| ProductionClosePositionError::AccountBorrowFailed)?;
    let state =
        decode_position_state(&data).map_err(ProductionClosePositionError::PositionCodec)?;
    Ok(PdaIdentity::Position {
        config,
        operator: state.owner,
        position_id: state.position_id,
    })
}

fn authenticate_state(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    identity: PdaIdentity,
) -> Result<PositionState, ProductionClosePositionError> {
    let authenticated = authenticate_state_account_info(gate, binding, account, identity)?;
    match authenticated.state() {
        StrictStateValue::Position(state) => Ok(state),
        _ => Err(ProductionClosePositionError::StateTypeMismatch),
    }
}

fn authenticate_lane(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
    lane: u8,
) -> Result<LaneState, ProductionClosePositionError> {
    let authenticated = authenticate_state_account_info(
        gate,
        binding,
        account,
        PdaIdentity::LaneState { config, lane },
    )?;
    match authenticated.state() {
        StrictStateValue::Lane(state) => Ok(state),
        _ => Err(ProductionClosePositionError::StateTypeMismatch),
    }
}

fn prepare_lane_write(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
    next: LaneState,
) -> Result<crate::native_adapter::StateWriteIntent, ProductionClosePositionError> {
    let identity = PdaIdentity::LaneState {
        config,
        lane: next.lane,
    };
    let authenticated = authenticate_state_account_info(gate, binding, account, identity)?;
    prepare_existing_state_write(gate, binding, &authenticated, StrictStateValue::Lane(next))
        .map_err(ProductionClosePositionError::Native)
}

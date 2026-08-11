//! Fail-closed production instruction-to-account-graph routing.
//!
//! This feature-gated boundary connects the frozen all-fifteen instruction ABI
//! to the exact retained account-meta inventory only after the caller already
//! holds the composed Daily-Law/native-binding/canonical-mint preflight. It
//! reads account flags but never account data, dispatches no handler, borrows
//! nothing mutably, invokes no CPI, and exposes no entrypoint.

use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::rehearsal_adapter::{
    All15RehearsalPreflight, RehearsalAccountSlot, RehearsalHold, RehearsalOperation,
};
use solana_account_info::AccountInfo;

pub const PRODUCTION_DISPATCH_PREFLIGHT_STATUS: &str =
    "ALL_15_ABI_ACCOUNT_GRAPH_ROUTES_FROZEN_NO_HANDLER_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionDispatchPreflightTruth {
    pub feature_gated: bool,
    pub instruction_abi_frozen: bool,
    pub all_15_instruction_routes_frozen: bool,
    pub opaque_daily_law_capability_required: bool,
    pub native_binding_required: bool,
    pub canonical_mint_capability_required: bool,
    pub exact_account_meta_shape_required: bool,
    pub account_identity_graph_complete: bool,
    pub account_data_read: bool,
    pub mutable_account_borrow: bool,
    pub handler_dispatch_exposed: bool,
    pub entrypoint_exposed: bool,
    pub account_writes_executed: bool,
    pub system_cpi_executed: bool,
    pub token_cpi_executed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_DISPATCH_PREFLIGHT_TRUTH: ProductionDispatchPreflightTruth =
    ProductionDispatchPreflightTruth {
        feature_gated: true,
        instruction_abi_frozen: true,
        all_15_instruction_routes_frozen: true,
        opaque_daily_law_capability_required: true,
        native_binding_required: true,
        canonical_mint_capability_required: true,
        exact_account_meta_shape_required: true,
        account_identity_graph_complete: false,
        account_data_read: false,
        mutable_account_borrow: false,
        handler_dispatch_exposed: false,
        entrypoint_exposed: false,
        account_writes_executed: false,
        system_cpi_executed: false,
        token_cpi_executed: false,
        any_handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionDispatchPreflightError {
    Instruction(ProductionInstructionError),
    MissingRequiredAccount,
    UnexpectedAccount,
    AccountMetaMismatch,
}

impl From<ProductionInstructionError> for ProductionDispatchPreflightError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionDispatchPreflight {
    instruction: ProductionInstruction,
    operation: RehearsalOperation,
    hold: RehearsalHold,
    observed_account_count: usize,
}

impl ProductionDispatchPreflight {
    pub const fn instruction(&self) -> ProductionInstruction {
        self.instruction
    }

    pub const fn operation(&self) -> RehearsalOperation {
        self.operation
    }

    pub const fn hold(&self) -> RehearsalHold {
        self.hold
    }

    pub const fn observed_account_count(&self) -> usize {
        self.observed_account_count
    }

    pub const fn authorizes_handler(&self) -> bool {
        false
    }

    pub const fn devnet_executable(&self) -> bool {
        false
    }
}

/// Bind canonical instruction bytes to exactly one retained operation and its
/// account-meta shape. The `capabilities` value can only be obtained after the
/// opaque Daily-Law gate, native economy binding, and canonical mint agree.
/// No account data is borrowed and the returned receipt authorizes nothing.
pub fn prepare_production_dispatch_preflight(
    capabilities: &All15RehearsalPreflight<'_>,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<ProductionDispatchPreflight, ProductionDispatchPreflightError> {
    let instruction = decode_production_instruction(instruction_data)?;
    let operation = operation_for_instruction(instruction);
    let descriptor = capabilities.descriptor(operation);
    validate_account_meta_shape(descriptor.accounts, accounts)?;
    Ok(ProductionDispatchPreflight {
        instruction,
        operation,
        hold: descriptor.hold,
        observed_account_count: accounts.len(),
    })
}

const fn operation_for_instruction(instruction: ProductionInstruction) -> RehearsalOperation {
    match instruction {
        ProductionInstruction::InitializeConfig => RehearsalOperation::InitializeConfig,
        ProductionInstruction::InitializeLaneVault { .. } => {
            RehearsalOperation::InitializeLaneVault
        }
        ProductionInstruction::InitializeStakeVault => RehearsalOperation::InitializeStakeVault,
        ProductionInstruction::Activate => RehearsalOperation::Activate,
        ProductionInstruction::RegisterAgency => RehearsalOperation::RegisterAgency,
        ProductionInstruction::SetEligibility { .. } => RehearsalOperation::SetEligibility,
        ProductionInstruction::OpenPosition { .. } => RehearsalOperation::OpenPosition,
        ProductionInstruction::SettlePositionWeek { .. } => RehearsalOperation::SettlePositionWeek,
        ProductionInstruction::SettleCoreWeek { .. } => RehearsalOperation::SettleCoreWeek,
        ProductionInstruction::ClaimLanePrincipal { .. } => RehearsalOperation::ClaimLanePrincipal,
        ProductionInstruction::WithdrawPositionPrincipal => {
            RehearsalOperation::WithdrawPositionPrincipal
        }
        ProductionInstruction::ClosePosition => RehearsalOperation::ClosePosition,
        ProductionInstruction::CommitRound { .. } => RehearsalOperation::CommitRound,
        ProductionInstruction::SettleRound => RehearsalOperation::SettleRound,
        ProductionInstruction::ExpireRound => RehearsalOperation::ExpireRound,
    }
}

fn validate_account_meta_shape(
    expected: &[RehearsalAccountSlot],
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionDispatchPreflightError> {
    let required = expected.iter().filter(|slot| !slot.optional).count();
    if accounts.len() < required {
        return Err(ProductionDispatchPreflightError::MissingRequiredAccount);
    }
    if accounts.len() > expected.len() {
        return Err(ProductionDispatchPreflightError::UnexpectedAccount);
    }

    let mut observed_index = 0usize;
    for (expected_index, slot) in expected.iter().enumerate() {
        let remaining_required = expected[expected_index + 1..]
            .iter()
            .filter(|remaining| !remaining.optional)
            .count();
        if slot.optional && accounts.len() - observed_index == remaining_required {
            continue;
        }
        let Some(account) = accounts.get(observed_index) else {
            return Err(ProductionDispatchPreflightError::MissingRequiredAccount);
        };
        if account.is_signer != slot.signer
            || account.is_writable != slot.writable
            || account.executable != slot.executable
        {
            return Err(ProductionDispatchPreflightError::AccountMetaMismatch);
        }
        observed_index += 1;
    }
    if observed_index != accounts.len() {
        return Err(ProductionDispatchPreflightError::UnexpectedAccount);
    }
    Ok(())
}

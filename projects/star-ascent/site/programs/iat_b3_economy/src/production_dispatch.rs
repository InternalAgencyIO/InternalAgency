//! Fail-closed production instruction routing.
//!
//! This feature-gated boundary connects the frozen all-fifteen instruction ABI
//! to the exact retained account-meta inventory only after the caller already
//! holds the composed Daily-Law/native-binding/canonical-mint preflight. It
//! retains the nonexecuting account-graph preflight and, behind the narrower
//! `runtime-production-dispatch` feature, exposes one authenticated dispatcher
//! seam. That seam routes six internally complete active handlers, three
//! source-complete CCC-disabled round handlers, five source-complete typed
//! initialization policy-HOLD handlers, and one source-complete core-settlement
//! policy-HOLD handler. Disabled and held handlers terminate before accepting
//! operation accounts. Both unresolved core-custody discriminants are rejected
//! before account data is read or mutated. The entrypoint supplies one
//! canonical Daily-Law prefix; Open, SettlePositionWeek, ClaimLanePrincipal,
//! and Withdraw reuse that AccountInfo internally instead of requiring a
//! duplicate transaction meta.

use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::rehearsal_adapter::{
    All15RehearsalPreflight, RehearsalAccountSlot, RehearsalHold, RehearsalOperation,
};
use solana_account_info::AccountInfo;

#[cfg(feature = "runtime-production-dispatch")]
use crate::native_adapter::NativeEconomyBinding;
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_claim_lane_principal_executor::{
    execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos,
    ProductionClaimLanePrincipalExecutionReceipt, ProductionClaimLanePrincipalExecutorError,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_close_position::{
    execute_runtime_production_close_position_account_infos, ProductionClosePositionError,
    ProductionClosePositionReceipt,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_initialization_policy_hold::{
    execute_runtime_production_initialization_policy_hold, ProductionInitializationPolicyHoldError,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_open_position_executor::{
    execute_runtime_production_open_position_with_daily_law_prefix_account_infos,
    ProductionOpenPositionExecutionReceipt, ProductionOpenPositionExecutorError,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_round_disabled::{
    execute_runtime_production_disabled_round_instruction, ProductionDisabledRoundError,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_set_eligibility::{
    execute_runtime_production_set_eligibility_account_infos, ProductionSetEligibilityError,
    ProductionSetEligibilityExecutionReceipt,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_settle_position_week::{
    execute_runtime_production_settle_core_week_policy_hold,
    ProductionSettleCoreWeekPolicyHoldError,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_settle_position_week_executor::{
    execute_runtime_production_settle_position_week_standard_with_daily_law_prefix_account_infos,
    ProductionSettlePositionStandardExecutionReceipt,
    ProductionSettlePositionStandardExecutorError,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::production_withdraw_position_executor::{
    execute_runtime_production_withdraw_position_with_daily_law_prefix_account_infos,
    ProductionWithdrawPositionExecutionReceipt, ProductionWithdrawPositionExecutorError,
};
#[cfg(feature = "runtime-production-dispatch")]
use crate::runtime_adapter::RuntimeValidatedDailyLawWrite;
#[cfg(feature = "runtime-production-dispatch")]
use solana_pubkey::Pubkey;

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

pub const PRODUCTION_AUTHENTICATED_DISPATCH_STATUS: &str =
    "ALL_15_ABI_DECODED_SIX_ACTIVE_THREE_CCC_DISABLED_SIX_POLICY_HELD_ONE_LAW_PREFIX_NO_DEVNET_MAINNET_HOLD";
pub const PRODUCTION_ACTIVE_HANDLER_COUNT: usize = 6;
pub const PRODUCTION_DISABLED_HANDLER_COUNT: usize = 3;
pub const PRODUCTION_POLICY_HELD_HANDLER_COUNT: usize = 6;
pub const PRODUCTION_ROUTED_HANDLER_COUNT: usize = PRODUCTION_ACTIVE_HANDLER_COUNT
    + PRODUCTION_DISABLED_HANDLER_COUNT
    + PRODUCTION_POLICY_HELD_HANDLER_COUNT;
pub const PRODUCTION_UNAVAILABLE_HANDLER_COUNT: usize = 0;
pub const PRODUCTION_DAILY_LAW_TRANSACTION_ACCOUNT_COUNT: usize = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionAuthenticatedDispatchTruth {
    pub feature_gated: bool,
    pub exact_all_15_discriminants_covered: bool,
    pub opaque_runtime_daily_law_required_before_dispatch: bool,
    pub native_economy_binding_required: bool,
    pub routed_complete_handler_count: usize,
    pub routed_active_handler_count: usize,
    pub routed_disabled_handler_count: usize,
    pub routed_policy_held_handler_count: usize,
    pub rejected_incomplete_handler_count: usize,
    pub set_eligibility_routed: bool,
    pub open_position_routed: bool,
    pub settle_position_week_routed: bool,
    pub withdraw_position_routed: bool,
    pub close_position_routed: bool,
    pub claim_lane_principal_non_core_routed: bool,
    pub claim_lane_principal_core_policy_held: bool,
    pub commit_round_disabled_routed: bool,
    pub settle_round_disabled_routed: bool,
    pub expire_round_disabled_routed: bool,
    pub initialization_policy_held_routes: usize,
    pub owner_bootstrap_policy_accepted: bool,
    pub activation_authorized: bool,
    pub settle_core_week_policy_held: bool,
    pub ccc_dlc_genesis_enabled: bool,
    pub one_daily_law_transaction_prefix_required: bool,
    pub token_handlers_reuse_prefix_without_duplicate_meta: bool,
    pub incomplete_handlers_rejected_before_account_reads: bool,
    pub all_15_handlers_complete: bool,
    pub production_identity_evidence_verified: bool,
    pub devnet_executed: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_AUTHENTICATED_DISPATCH_TRUTH: ProductionAuthenticatedDispatchTruth =
    ProductionAuthenticatedDispatchTruth {
        feature_gated: true,
        exact_all_15_discriminants_covered: true,
        opaque_runtime_daily_law_required_before_dispatch: true,
        native_economy_binding_required: true,
        routed_complete_handler_count: PRODUCTION_ROUTED_HANDLER_COUNT,
        routed_active_handler_count: PRODUCTION_ACTIVE_HANDLER_COUNT,
        routed_disabled_handler_count: PRODUCTION_DISABLED_HANDLER_COUNT,
        routed_policy_held_handler_count: PRODUCTION_POLICY_HELD_HANDLER_COUNT,
        rejected_incomplete_handler_count: PRODUCTION_UNAVAILABLE_HANDLER_COUNT,
        set_eligibility_routed: true,
        open_position_routed: true,
        settle_position_week_routed: true,
        withdraw_position_routed: true,
        close_position_routed: true,
        claim_lane_principal_non_core_routed: true,
        claim_lane_principal_core_policy_held: true,
        commit_round_disabled_routed: true,
        settle_round_disabled_routed: true,
        expire_round_disabled_routed: true,
        initialization_policy_held_routes: 5,
        owner_bootstrap_policy_accepted: false,
        activation_authorized: false,
        settle_core_week_policy_held: true,
        ccc_dlc_genesis_enabled: false,
        one_daily_law_transaction_prefix_required: true,
        token_handlers_reuse_prefix_without_duplicate_meta: true,
        incomplete_handlers_rejected_before_account_reads: true,
        all_15_handlers_complete: false,
        production_identity_evidence_verified: false,
        devnet_executed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionHandlerRoute {
    CompleteInitializationPolicyHold,
    CompleteSettleCoreWeekPolicyHold,
    CompleteSetEligibility,
    CompleteOpenPosition,
    CompleteSettlePositionWeek,
    CompleteClaimLanePrincipal,
    CompleteWithdrawPosition,
    CompleteClosePosition,
    CompleteDisabledRound,
    Unavailable,
}

/// The exhaustive route table is deliberately payload-independent. Adding a
/// executable route requires changing this match and its exact-count
/// tests; a partial executor cannot become public merely by enabling a Cargo
/// feature.
pub const fn production_handler_route(
    instruction: ProductionInstruction,
) -> ProductionHandlerRoute {
    match instruction {
        ProductionInstruction::InitializeConfig
        | ProductionInstruction::InitializeLaneVault { .. }
        | ProductionInstruction::InitializeStakeVault
        | ProductionInstruction::Activate
        | ProductionInstruction::RegisterAgency => {
            ProductionHandlerRoute::CompleteInitializationPolicyHold
        }
        ProductionInstruction::SetEligibility { .. } => {
            ProductionHandlerRoute::CompleteSetEligibility
        }
        ProductionInstruction::OpenPosition { .. } => ProductionHandlerRoute::CompleteOpenPosition,
        ProductionInstruction::SettlePositionWeek { .. } => {
            ProductionHandlerRoute::CompleteSettlePositionWeek
        }
        ProductionInstruction::ClaimLanePrincipal { .. } => {
            ProductionHandlerRoute::CompleteClaimLanePrincipal
        }
        ProductionInstruction::WithdrawPositionPrincipal => {
            ProductionHandlerRoute::CompleteWithdrawPosition
        }
        ProductionInstruction::ClosePosition => ProductionHandlerRoute::CompleteClosePosition,
        ProductionInstruction::CommitRound { .. }
        | ProductionInstruction::SettleRound
        | ProductionInstruction::ExpireRound => ProductionHandlerRoute::CompleteDisabledRound,
        ProductionInstruction::SettleCoreWeek { .. } => {
            ProductionHandlerRoute::CompleteSettleCoreWeekPolicyHold
        }
    }
}

#[cfg(feature = "runtime-production-dispatch")]
#[derive(Debug)]
pub(crate) enum ProductionAuthenticatedDispatchError {
    Instruction(ProductionInstructionError),
    HandlerUnavailable { opcode: u8 },
    InitializationPolicyHold(ProductionInitializationPolicyHoldError),
    SettleCoreWeekPolicyHold(ProductionSettleCoreWeekPolicyHoldError),
    SetEligibility(ProductionSetEligibilityError),
    OpenPosition(ProductionOpenPositionExecutorError),
    SettlePositionWeek(ProductionSettlePositionStandardExecutorError),
    ClaimLanePrincipal(ProductionClaimLanePrincipalExecutorError),
    WithdrawPosition(ProductionWithdrawPositionExecutorError),
    ClosePosition(ProductionClosePositionError),
    DisabledRound(ProductionDisabledRoundError),
}

#[cfg(feature = "runtime-production-dispatch")]
impl From<ProductionInstructionError> for ProductionAuthenticatedDispatchError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

#[cfg(feature = "runtime-production-dispatch")]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ProductionAuthenticatedDispatchReceipt {
    SetEligibility(ProductionSetEligibilityExecutionReceipt),
    OpenPosition(ProductionOpenPositionExecutionReceipt),
    SettlePositionWeek(ProductionSettlePositionStandardExecutionReceipt),
    ClaimLanePrincipal(ProductionClaimLanePrincipalExecutionReceipt),
    WithdrawPosition(ProductionWithdrawPositionExecutionReceipt),
    ClosePosition(ProductionClosePositionReceipt),
}

/// Dispatch after the runtime Daily-Law account has already been authenticated
/// against `Clock`. The opaque capability is the ordering boundary: callers
/// cannot decode or execute an economic route through this function before an
/// open canonical day has been proven. The same authenticated Law AccountInfo
/// is forwarded separately from operation accounts, freezing one transaction
/// prefix and preventing token handlers from requiring a duplicated meta. Only
/// six active handlers, three source-complete disabled handlers, five
/// source-complete initialization policy-HOLD handlers, and one
/// source-complete core-settlement policy-HOLD handler are reachable. Both
/// core-custody operations fail without inspecting their accounts.
#[cfg(feature = "runtime-production-dispatch")]
#[inline(never)]
pub(crate) fn dispatch_authenticated_production_instruction<'info>(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    daily_law_account: &AccountInfo<'info>,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'info>],
) -> Result<ProductionAuthenticatedDispatchReceipt, ProductionAuthenticatedDispatchError> {
    let instruction = decode_production_instruction(instruction_data)?;
    match production_handler_route(instruction) {
        ProductionHandlerRoute::CompleteInitializationPolicyHold => {
            execute_runtime_production_initialization_policy_hold(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
            )
            .map(|()| unreachable!("initialization policy-HOLD handlers cannot succeed"))
            .map_err(ProductionAuthenticatedDispatchError::InitializationPolicyHold)
        }
        ProductionHandlerRoute::CompleteSettleCoreWeekPolicyHold => {
            execute_runtime_production_settle_core_week_policy_hold(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
            )
            .map(|()| unreachable!("core settlement policy-HOLD handler cannot succeed"))
            .map_err(ProductionAuthenticatedDispatchError::SettleCoreWeekPolicyHold)
        }
        ProductionHandlerRoute::CompleteSetEligibility => {
            execute_runtime_production_set_eligibility_account_infos(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
                accounts,
            )
            .map(ProductionAuthenticatedDispatchReceipt::SetEligibility)
            .map_err(ProductionAuthenticatedDispatchError::SetEligibility)
        }
        ProductionHandlerRoute::CompleteOpenPosition => {
            execute_runtime_production_open_position_with_daily_law_prefix_account_infos(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
                daily_law_account,
                accounts,
            )
            .map(ProductionAuthenticatedDispatchReceipt::OpenPosition)
            .map_err(ProductionAuthenticatedDispatchError::OpenPosition)
        }
        ProductionHandlerRoute::CompleteSettlePositionWeek => {
            execute_runtime_production_settle_position_week_standard_with_daily_law_prefix_account_infos(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
                daily_law_account,
                accounts,
            )
            .map(ProductionAuthenticatedDispatchReceipt::SettlePositionWeek)
            .map_err(ProductionAuthenticatedDispatchError::SettlePositionWeek)
        }
        ProductionHandlerRoute::CompleteClaimLanePrincipal => {
            execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
                daily_law_account,
                accounts,
            )
            .map(ProductionAuthenticatedDispatchReceipt::ClaimLanePrincipal)
            .map_err(ProductionAuthenticatedDispatchError::ClaimLanePrincipal)
        }
        ProductionHandlerRoute::CompleteWithdrawPosition => {
            execute_runtime_production_withdraw_position_with_daily_law_prefix_account_infos(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
                daily_law_account,
                accounts,
            )
            .map(ProductionAuthenticatedDispatchReceipt::WithdrawPosition)
            .map_err(ProductionAuthenticatedDispatchError::WithdrawPosition)
        }
        ProductionHandlerRoute::CompleteClosePosition => {
            execute_runtime_production_close_position_account_infos(
                runtime_law,
                binding,
                instruction_data,
                accounts,
            )
            .map(ProductionAuthenticatedDispatchReceipt::ClosePosition)
            .map_err(ProductionAuthenticatedDispatchError::ClosePosition)
        }
        ProductionHandlerRoute::CompleteDisabledRound => {
            execute_runtime_production_disabled_round_instruction(
                &Pubkey::new_from_array(binding.program_id()),
                runtime_law,
                binding,
                instruction_data,
            )
            .map(|()| unreachable!("CCC-disabled round handlers cannot succeed"))
            .map_err(ProductionAuthenticatedDispatchError::DisabledRound)
        }
        ProductionHandlerRoute::Unavailable => {
            Err(ProductionAuthenticatedDispatchError::HandlerUnavailable {
                opcode: instruction.opcode(),
            })
        }
    }
}

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

#[cfg(all(test, feature = "runtime-production-dispatch"))]
mod tests {
    use super::*;
    use crate::native_adapter::NativeEconomyBinding;
    use crate::production_claim_lane_principal_executor::ProductionClaimLanePrincipalExecutorError;
    use crate::production_close_position::ProductionClosePositionError;
    use crate::production_initialization_policy_hold::{
        classify_production_initialization_policy_hold, ProductionInitializationPolicyHoldError,
    };
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_COUNT, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::production_open_position_executor::ProductionOpenPositionExecutorError;
    use crate::production_round_disabled::ProductionDisabledRoundError;
    use crate::production_set_eligibility::ProductionSetEligibilityError;
    use crate::production_settle_position_week::{
        ProductionSettleCoreWeekPolicyHoldError, ProductionSettleCoreWeekPreflightUnavailable,
    };
    use crate::production_settle_position_week_executor::ProductionSettlePositionStandardExecutorError;
    use crate::production_withdraw_position_executor::ProductionWithdrawPositionExecutorError;
    use crate::runtime_adapter::RuntimeValidatedDailyLawWrite;
    use crate::{
        verify_daily_law_open, CanonicalDailyLawBinding, ReadonlyDailyLawAccount, LAW_STATE_LEN,
        LAW_STATE_MAGIC, LAW_STATE_VERSION,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    fn all_instructions() -> [ProductionInstruction; PRODUCTION_INSTRUCTION_COUNT] {
        [
            ProductionInstruction::InitializeConfig,
            ProductionInstruction::InitializeLaneVault { lane: 1 },
            ProductionInstruction::InitializeStakeVault,
            ProductionInstruction::Activate,
            ProductionInstruction::RegisterAgency,
            ProductionInstruction::SetEligibility {
                role: 2,
                agency_index: Some(3),
            },
            ProductionInstruction::OpenPosition {
                position_id: 4,
                principal: 5,
            },
            ProductionInstruction::SettlePositionWeek { week: 6 },
            ProductionInstruction::SettleCoreWeek { ordinal: 7 },
            ProductionInstruction::ClaimLanePrincipal { lane: 1 },
            ProductionInstruction::WithdrawPositionPrincipal,
            ProductionInstruction::ClosePosition,
            ProductionInstruction::CommitRound { week: 8 },
            ProductionInstruction::SettleRound,
            ProductionInstruction::ExpireRound,
        ]
    }

    fn encoded(instruction: ProductionInstruction) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut data = [0_u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(instruction, &mut data).unwrap();
        data
    }

    fn open_decision() -> SolanaDailyDecision {
        let local_day = protocol_local_day(CLOCK_TIMESTAMP);
        for candidate in 0_u16..=u8::MAX.into() {
            let mut hash = [0_u8; 32];
            hash[31] = candidate as u8;
            let decision =
                create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
            if !decision.locked {
                return decision;
            }
        }
        panic!("test vector search did not find an open disposition")
    }

    fn with_runtime_law_account<R>(
        operation: impl FnOnce(&RuntimeValidatedDailyLawWrite, &AccountInfo<'_>) -> R,
    ) -> R {
        let decision = open_decision();
        let mut data = [0_u8; LAW_STATE_LEN];
        data[0..8].copy_from_slice(LAW_STATE_MAGIC);
        data[8] = LAW_STATE_VERSION;
        data[9] = LAW_BUMP;
        data[10] = 1;
        data[11] = u8::from(decision.locked);
        data[16..48].copy_from_slice(&MINT);
        data[48..80].copy_from_slice(&NETWORK);
        data[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
        data[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
        data[96..128].copy_from_slice(&decision.ancestor_slot_hash);
        data[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
        data[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
        data[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
        data[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
        let gate = verify_daily_law_open(
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
            CLOCK_TIMESTAMP,
        )
        .unwrap();
        let runtime_law =
            RuntimeValidatedDailyLawWrite::from_test_gate(gate, LAW_STATE, LAW_PROGRAM);
        let key = Pubkey::new_from_array(LAW_STATE);
        let owner = Pubkey::new_from_array(LAW_PROGRAM);
        let mut lamports = 1_u64;
        let account = AccountInfo::new(&key, false, false, &mut lamports, &mut data, &owner, false);
        operation(&runtime_law, &account)
    }

    #[test]
    fn exact_route_table_exposes_every_source_complete_disposition() {
        let instructions = all_instructions();
        assert_eq!(instructions.len(), PRODUCTION_INSTRUCTION_COUNT);
        let mut routed = 0_usize;
        let mut unavailable = 0_usize;
        for (opcode, instruction) in instructions.into_iter().enumerate() {
            assert_eq!(usize::from(instruction.opcode()), opcode);
            match production_handler_route(instruction) {
                ProductionHandlerRoute::CompleteInitializationPolicyHold => {
                    assert!(classify_production_initialization_policy_hold(instruction).is_some());
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteSettleCoreWeekPolicyHold => {
                    assert!(matches!(
                        instruction,
                        ProductionInstruction::SettleCoreWeek { .. }
                    ));
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteSetEligibility => {
                    assert!(matches!(
                        instruction,
                        ProductionInstruction::SetEligibility { .. }
                    ));
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteOpenPosition => {
                    assert!(matches!(
                        instruction,
                        ProductionInstruction::OpenPosition { .. }
                    ));
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteSettlePositionWeek => {
                    assert!(matches!(
                        instruction,
                        ProductionInstruction::SettlePositionWeek { .. }
                    ));
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteClaimLanePrincipal => {
                    assert!(matches!(
                        instruction,
                        ProductionInstruction::ClaimLanePrincipal { .. }
                    ));
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteWithdrawPosition => {
                    assert_eq!(
                        instruction,
                        ProductionInstruction::WithdrawPositionPrincipal
                    );
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteClosePosition => {
                    assert_eq!(instruction, ProductionInstruction::ClosePosition);
                    routed += 1;
                }
                ProductionHandlerRoute::CompleteDisabledRound => {
                    assert!(matches!(
                        instruction,
                        ProductionInstruction::CommitRound { .. }
                            | ProductionInstruction::SettleRound
                            | ProductionInstruction::ExpireRound
                    ));
                    routed += 1;
                }
                ProductionHandlerRoute::Unavailable => unavailable += 1,
            }
        }
        assert_eq!(routed, PRODUCTION_ROUTED_HANDLER_COUNT);
        assert_eq!(unavailable, PRODUCTION_UNAVAILABLE_HANDLER_COUNT);
    }

    #[test]
    fn authenticated_dispatch_reaches_all_fifteen_source_complete_dispositions() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        with_runtime_law_account(|runtime_law, law_account| {
            for instruction in all_instructions() {
                let result = dispatch_authenticated_production_instruction(
                    runtime_law,
                    &binding,
                    law_account,
                    &encoded(instruction),
                    &[],
                );
                match (instruction, result) {
                    (
                        held @ (ProductionInstruction::InitializeConfig
                        | ProductionInstruction::InitializeLaneVault { .. }
                        | ProductionInstruction::InitializeStakeVault
                        | ProductionInstruction::Activate
                        | ProductionInstruction::RegisterAgency),
                        Err(ProductionAuthenticatedDispatchError::InitializationPolicyHold(
                            ProductionInitializationPolicyHoldError::Held(observed),
                        )),
                    ) if Some(observed) == classify_production_initialization_policy_hold(held) => {
                    }
                    (
                        ProductionInstruction::SettleCoreWeek { ordinal },
                        Err(ProductionAuthenticatedDispatchError::SettleCoreWeekPolicyHold(
                            ProductionSettleCoreWeekPolicyHoldError::CoreCustodyPolicyUnresolved {
                                ordinal: observed,
                                retained_preflight:
                                    ProductionSettleCoreWeekPreflightUnavailable::ExactAbiOmitsAuthenticatedAccountFacts,
                            },
                        )),
                    ) if ordinal == observed => {}
                    (
                        ProductionInstruction::SetEligibility { .. },
                        Err(ProductionAuthenticatedDispatchError::SetEligibility(
                            ProductionSetEligibilityError::AccountCountMismatch,
                        )),
                    )
                    | (
                        ProductionInstruction::OpenPosition { .. },
                        Err(ProductionAuthenticatedDispatchError::OpenPosition(
                            ProductionOpenPositionExecutorError::AccountCountMismatch,
                        )),
                    )
                    | (
                        ProductionInstruction::SettlePositionWeek { .. },
                        Err(ProductionAuthenticatedDispatchError::SettlePositionWeek(
                            ProductionSettlePositionStandardExecutorError::AccountCountMismatch,
                        )),
                    )
                    | (
                        ProductionInstruction::ClaimLanePrincipal { lane: 1 },
                        Err(ProductionAuthenticatedDispatchError::ClaimLanePrincipal(
                            ProductionClaimLanePrincipalExecutorError::AccountCountMismatch,
                        )),
                    )
                    | (
                        ProductionInstruction::WithdrawPositionPrincipal,
                        Err(ProductionAuthenticatedDispatchError::WithdrawPosition(
                            ProductionWithdrawPositionExecutorError::AccountCountMismatch,
                        )),
                    )
                    | (
                        ProductionInstruction::ClosePosition,
                        Err(ProductionAuthenticatedDispatchError::ClosePosition(
                            ProductionClosePositionError::AccountCountMismatch,
                        )),
                    ) => {}
                    (
                        ProductionInstruction::CommitRound { .. }
                        | ProductionInstruction::SettleRound
                        | ProductionInstruction::ExpireRound,
                        Err(ProductionAuthenticatedDispatchError::DisabledRound(
                            ProductionDisabledRoundError::CccDlcNotActive,
                        )),
                    ) => {}
                    (
                        held,
                        Err(ProductionAuthenticatedDispatchError::HandlerUnavailable { opcode }),
                    ) if opcode == held.opcode() => {}
                    (observed_instruction, observed_result) => panic!(
                        "unexpected route result for {observed_instruction:?}: {observed_result:?}"
                    ),
                }
            }
        });
    }

    #[test]
    fn malformed_abi_never_reaches_a_handler() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        with_runtime_law_account(|runtime_law, law_account| {
            assert!(matches!(
                dispatch_authenticated_production_instruction(
                    runtime_law,
                    &binding,
                    law_account,
                    &[0xFF],
                    &[],
                ),
                Err(ProductionAuthenticatedDispatchError::Instruction(
                    ProductionInstructionError::InvalidLength,
                ))
            ));
        });
    }

    #[test]
    fn disabled_round_routes_return_ccc_hold_without_inspecting_operation_accounts() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        with_runtime_law_account(|runtime_law, law_account| {
            let ignored_operation_accounts = [law_account.clone()];
            for instruction in [
                ProductionInstruction::CommitRound { week: u64::MAX },
                ProductionInstruction::SettleRound,
                ProductionInstruction::ExpireRound,
            ] {
                assert!(matches!(
                    dispatch_authenticated_production_instruction(
                        runtime_law,
                        &binding,
                        law_account,
                        &encoded(instruction),
                        &ignored_operation_accounts,
                    ),
                    Err(ProductionAuthenticatedDispatchError::DisabledRound(
                        ProductionDisabledRoundError::CccDlcNotActive,
                    )),
                ));
            }
        });
    }

    #[test]
    fn core_principal_claim_returns_policy_hold_before_operation_account_reads() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        with_runtime_law_account(|runtime_law, law_account| {
            let ignored_operation_accounts = [law_account.clone()];
            assert!(matches!(
                dispatch_authenticated_production_instruction(
                    runtime_law,
                    &binding,
                    law_account,
                    &encoded(ProductionInstruction::ClaimLanePrincipal { lane: 3 }),
                    &ignored_operation_accounts,
                ),
                Err(ProductionAuthenticatedDispatchError::ClaimLanePrincipal(
                    ProductionClaimLanePrincipalExecutorError::CoreCustodyPolicyHold,
                )),
            ));
        });
    }

    #[test]
    fn core_settlement_returns_typed_policy_hold_without_inspecting_operation_accounts() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        with_runtime_law_account(|runtime_law, law_account| {
            let ignored_operation_accounts = [law_account.clone()];
            assert!(matches!(
                dispatch_authenticated_production_instruction(
                    runtime_law,
                    &binding,
                    law_account,
                    &encoded(ProductionInstruction::SettleCoreWeek { ordinal: 73 }),
                    &ignored_operation_accounts,
                ),
                Err(ProductionAuthenticatedDispatchError::SettleCoreWeekPolicyHold(
                    ProductionSettleCoreWeekPolicyHoldError::CoreCustodyPolicyUnresolved {
                        ordinal: 73,
                        retained_preflight:
                            ProductionSettleCoreWeekPreflightUnavailable::ExactAbiOmitsAuthenticatedAccountFacts,
                    },
                )),
            ));
        });
    }

    #[test]
    fn aggregate_truth_never_promotes_all_15_or_devnet() {
        let truth = PRODUCTION_AUTHENTICATED_DISPATCH_TRUTH;
        assert!(truth.feature_gated);
        assert!(truth.exact_all_15_discriminants_covered);
        assert!(truth.opaque_runtime_daily_law_required_before_dispatch);
        assert!(truth.native_economy_binding_required);
        assert_eq!(truth.routed_complete_handler_count, 15);
        assert_eq!(truth.routed_active_handler_count, 6);
        assert_eq!(truth.routed_disabled_handler_count, 3);
        assert_eq!(truth.routed_policy_held_handler_count, 6);
        assert_eq!(truth.rejected_incomplete_handler_count, 0);
        assert!(truth.set_eligibility_routed);
        assert!(truth.open_position_routed);
        assert!(truth.settle_position_week_routed);
        assert!(truth.withdraw_position_routed);
        assert!(truth.close_position_routed);
        assert!(truth.claim_lane_principal_non_core_routed);
        assert!(truth.claim_lane_principal_core_policy_held);
        assert!(truth.commit_round_disabled_routed);
        assert!(truth.settle_round_disabled_routed);
        assert!(truth.expire_round_disabled_routed);
        assert_eq!(truth.initialization_policy_held_routes, 5);
        assert!(!truth.owner_bootstrap_policy_accepted);
        assert!(!truth.activation_authorized);
        assert!(truth.settle_core_week_policy_held);
        assert!(!truth.ccc_dlc_genesis_enabled);
        assert!(truth.one_daily_law_transaction_prefix_required);
        assert!(truth.token_handlers_reuse_prefix_without_duplicate_meta);
        assert!(truth.incomplete_handlers_rejected_before_account_reads);
        assert!(!truth.all_15_handlers_complete);
        assert!(!truth.production_identity_evidence_verified);
        assert!(!truth.devnet_executed);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_AUTHENTICATED_DISPATCH_STATUS.contains("MAINNET_HOLD"));
    }
}

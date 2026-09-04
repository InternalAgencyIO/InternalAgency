//! Feature-gated production ABI entrypoint foundation.
//!
//! Four public identities are required at build time and embedded into the
//! artifact: the Law program, Economy program, canonical mint, and Mainnet
//! genesis hash. The canonical Law PDA is derived by `build.rs`; none of these
//! values can come from instruction data or transaction accounts.
//!
//! Every call authenticates the read-only Daily-Law account against runtime
//! `Clock` before decoding the economic instruction. The authenticated
//! dispatcher routes six active handlers (including non-core lane claims), three
//! source-complete CCC-disabled round handlers, and five source-complete typed
//! initialization policy-HOLD handlers. The canonical Law account is supplied
//! once at transaction index zero and reused by token handler CPIs without a
//! duplicate meta. Disabled and held handlers terminate before accepting
//! operation accounts. Core principal claims and core settlement return typed
//! policy HOLDs before account reads. Every opcode therefore has a
//! source-complete active, disabled, or held disposition. This is not
//! Devnet evidence or release authorization.

use crate::native_adapter::NativeEconomyBinding;
use crate::production_dispatch::{
    dispatch_authenticated_production_instruction, ProductionAuthenticatedDispatchError,
};
use crate::runtime_adapter::verify_runtime_daily_law_open_account_info;
use crate::CanonicalDailyLawBinding;
use solana_account_info::AccountInfo;
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

mod compiled_identity {
    include!(concat!(
        env!("OUT_DIR"),
        "/iat_b3_production_economy_identity.rs"
    ));
}

const LAW_STATE_SEED: &[u8] = b"law-state";

pub const PRODUCTION_ENTRYPOINT_STATUS: &str =
    "FEATURE_GATED_ALL_15_ABI_DAILY_LAW_FIRST_SIX_ACTIVE_THREE_CCC_DISABLED_SIX_POLICY_HELD_ZERO_UNAVAILABLE_ONE_LAW_PREFIX_DEVNET_FALSE_MAINNET_HOLD";
pub const PRODUCTION_HANDLER_UNAVAILABLE_ERROR_BASE: u32 = 0xE520;
pub const PRODUCTION_INITIALIZATION_POLICY_HOLD_ERROR_BASE: u32 = 0xE540;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionEntrypointTruth {
    pub feature_gated: bool,
    pub exact_all_15_instruction_abi_exposed: bool,
    pub compiled_identity_inputs_required: bool,
    pub identities_accepted_from_instruction_or_accounts: bool,
    pub daily_law_authenticated_before_instruction_decode: bool,
    pub routed_complete_handler_count: usize,
    pub routed_active_handler_count: usize,
    pub routed_disabled_handler_count: usize,
    pub routed_policy_held_handler_count: usize,
    pub rejected_incomplete_handler_count: usize,
    pub one_daily_law_transaction_prefix_required: bool,
    pub token_handlers_reuse_prefix_without_duplicate_meta: bool,
    pub set_eligibility_write_path_exposed: bool,
    pub open_position_write_path_exposed: bool,
    pub settle_position_week_write_path_exposed: bool,
    pub withdraw_position_write_path_exposed: bool,
    pub close_position_write_path_exposed: bool,
    pub claim_lane_principal_non_core_write_path_exposed: bool,
    pub claim_lane_principal_core_policy_hold: bool,
    pub disabled_round_paths_exposed: bool,
    pub disabled_round_active_success_possible: bool,
    pub initialization_policy_hold_paths_exposed: bool,
    pub initialization_or_activation_success_possible: bool,
    pub all_15_handlers_complete: bool,
    pub production_identity_evidence_verified: bool,
    pub devnet_executed: bool,
    pub release_authorized: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_ENTRYPOINT_TRUTH: ProductionEntrypointTruth = ProductionEntrypointTruth {
    feature_gated: true,
    exact_all_15_instruction_abi_exposed: true,
    compiled_identity_inputs_required: true,
    identities_accepted_from_instruction_or_accounts: false,
    daily_law_authenticated_before_instruction_decode: true,
    routed_complete_handler_count: 15,
    routed_active_handler_count: 6,
    routed_disabled_handler_count: 3,
    routed_policy_held_handler_count: 6,
    rejected_incomplete_handler_count: 0,
    one_daily_law_transaction_prefix_required: true,
    token_handlers_reuse_prefix_without_duplicate_meta: true,
    set_eligibility_write_path_exposed: true,
    open_position_write_path_exposed: true,
    settle_position_week_write_path_exposed: true,
    withdraw_position_write_path_exposed: true,
    close_position_write_path_exposed: true,
    claim_lane_principal_non_core_write_path_exposed: true,
    claim_lane_principal_core_policy_hold: true,
    disabled_round_paths_exposed: true,
    disabled_round_active_success_possible: false,
    initialization_policy_hold_paths_exposed: true,
    initialization_or_activation_success_possible: false,
    all_15_handlers_complete: false,
    production_identity_evidence_verified: false,
    devnet_executed: false,
    release_authorized: false,
    mainnet_hold: true,
};

#[repr(u32)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionEntrypointError {
    IncorrectProgramId = 0xE500,
    IdentityBindingRejected = 0xE501,
    MissingDailyLawAccount = 0xE502,
    DailyLawRejected = 0xE503,
    InvalidInstruction = 0xE504,
    ClosePositionRejected = 0xE505,
    SetEligibilityRejected = 0xE506,
    WithdrawPositionRejected = 0xE507,
    OpenPositionRejected = 0xE508,
    SettlePositionWeekRejected = 0xE509,
    CccDlcNotActive = 0xE50A,
    DisabledRoundRejected = 0xE50B,
    InitializationPolicyHoldRejected = 0xE50C,
    ClaimLanePrincipalRejected = 0xE50D,
    CoreCustodyPolicyHold = 0xE50E,
    SettleCoreWeekPolicyHoldRejected = 0xE50F,
}

impl From<ProductionEntrypointError> for ProgramError {
    fn from(value: ProductionEntrypointError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

/// Exposes the exact compiled Economy ID for source-bound artifact checks and
/// host tests. It conveys no signing or deployment authority.
pub const fn compiled_economy_program_id() -> [u8; 32] {
    compiled_identity::ECONOMY_PROGRAM_ID_BYTES
}

fn compiled_bindings(
) -> Result<(CanonicalDailyLawBinding, NativeEconomyBinding), ProductionEntrypointError> {
    let law = CanonicalDailyLawBinding::new(
        compiled_identity::LAW_PROGRAM_ID_BYTES,
        compiled_identity::LAW_STATE_BYTES,
        compiled_identity::LAW_STATE_BUMP,
        compiled_identity::CANONICAL_MINT_BYTES,
        compiled_identity::NETWORK_GENESIS_HASH_BYTES,
    );
    let economy = NativeEconomyBinding::new(
        compiled_identity::ECONOMY_PROGRAM_ID_BYTES,
        compiled_identity::CANONICAL_MINT_BYTES,
    )
    .map_err(|_| ProductionEntrypointError::IdentityBindingRejected)?;
    validate_runtime_bindings(&law, &economy)?;
    Ok((law, economy))
}

fn validate_runtime_bindings(
    law: &CanonicalDailyLawBinding,
    economy: &NativeEconomyBinding,
) -> Result<(), ProductionEntrypointError> {
    if law.mint() != economy.mint()
        || law.law_program_id() == economy.program_id()
        || law.network_genesis_hash() == [0; 32]
    {
        return Err(ProductionEntrypointError::IdentityBindingRejected);
    }
    let law_program = Pubkey::new_from_array(law.law_program_id());
    let (expected_law_state, expected_bump) =
        Pubkey::find_program_address(&[LAW_STATE_SEED, &law.mint()], &law_program);
    if expected_law_state.to_bytes() != law.law_state_address()
        || expected_bump != law.law_state_bump()
    {
        return Err(ProductionEntrypointError::IdentityBindingRejected);
    }
    Ok(())
}

/// Testable composition seam used by the compiled entrypoint. Identity
/// consistency and the program ID are checked before account access; the
/// canonical Daily-Law account is always account zero and is authenticated
/// before instruction decoding or operation-specific account reads.
#[inline(never)]
fn process_instruction_with_runtime_bindings(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
    law: &CanonicalDailyLawBinding,
    economy: &NativeEconomyBinding,
) -> ProgramResult {
    validate_runtime_bindings(law, economy)?;
    if program_id.to_bytes() != economy.program_id() {
        return Err(ProductionEntrypointError::IncorrectProgramId.into());
    }
    let (law_state, operation_accounts) = accounts
        .split_first()
        .ok_or(ProductionEntrypointError::MissingDailyLawAccount)?;
    let runtime_law = verify_runtime_daily_law_open_account_info(law, law_state)
        .map_err(|_| ProductionEntrypointError::DailyLawRejected)?;
    dispatch_authenticated_production_instruction(
        &runtime_law,
        economy,
        law_state,
        instruction_data,
        operation_accounts,
    )
    .map(|_| ())
    .map_err(map_dispatch_error)
}

fn map_dispatch_error(error: ProductionAuthenticatedDispatchError) -> ProgramError {
    match error {
        ProductionAuthenticatedDispatchError::Instruction(_) => {
            ProductionEntrypointError::InvalidInstruction.into()
        }
        ProductionAuthenticatedDispatchError::HandlerUnavailable { opcode } => {
            ProgramError::Custom(PRODUCTION_HANDLER_UNAVAILABLE_ERROR_BASE + u32::from(opcode))
        }
        ProductionAuthenticatedDispatchError::InitializationPolicyHold(
            crate::production_initialization_policy_hold::ProductionInitializationPolicyHoldError::Held(
                hold,
            ),
        ) => ProgramError::Custom(
            PRODUCTION_INITIALIZATION_POLICY_HOLD_ERROR_BASE + u32::from(hold.opcode()),
        ),
        ProductionAuthenticatedDispatchError::InitializationPolicyHold(_) => {
            ProductionEntrypointError::InitializationPolicyHoldRejected.into()
        }
        ProductionAuthenticatedDispatchError::SettleCoreWeekPolicyHold(
            crate::production_settle_position_week::ProductionSettleCoreWeekPolicyHoldError::CoreCustodyPolicyUnresolved { .. },
        ) => ProductionEntrypointError::CoreCustodyPolicyHold.into(),
        ProductionAuthenticatedDispatchError::SettleCoreWeekPolicyHold(_) => {
            ProductionEntrypointError::SettleCoreWeekPolicyHoldRejected.into()
        }
        ProductionAuthenticatedDispatchError::SetEligibility(_) => {
            ProductionEntrypointError::SetEligibilityRejected.into()
        }
        ProductionAuthenticatedDispatchError::OpenPosition(_) => {
            ProductionEntrypointError::OpenPositionRejected.into()
        }
        ProductionAuthenticatedDispatchError::SettlePositionWeek(_) => {
            ProductionEntrypointError::SettlePositionWeekRejected.into()
        }
        ProductionAuthenticatedDispatchError::ClaimLanePrincipal(
            crate::production_claim_lane_principal_executor::ProductionClaimLanePrincipalExecutorError::CoreCustodyPolicyHold,
        ) => ProductionEntrypointError::CoreCustodyPolicyHold.into(),
        ProductionAuthenticatedDispatchError::ClaimLanePrincipal(_) => {
            ProductionEntrypointError::ClaimLanePrincipalRejected.into()
        }
        ProductionAuthenticatedDispatchError::WithdrawPosition(_) => {
            ProductionEntrypointError::WithdrawPositionRejected.into()
        }
        ProductionAuthenticatedDispatchError::ClosePosition(_) => {
            ProductionEntrypointError::ClosePositionRejected.into()
        }
        ProductionAuthenticatedDispatchError::DisabledRound(
            crate::production_round_disabled::ProductionDisabledRoundError::CccDlcNotActive,
        ) => ProductionEntrypointError::CccDlcNotActive.into(),
        ProductionAuthenticatedDispatchError::DisabledRound(_) => {
            ProductionEntrypointError::DisabledRoundRejected.into()
        }
    }
}

/// SBF entrypoint using only build-time compiled identities.
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    instruction_data: &[u8],
) -> ProgramResult {
    let (law, economy) = compiled_bindings()?;
    process_instruction_with_runtime_bindings(
        program_id,
        accounts,
        instruction_data,
        &law,
        &economy,
    )
}

#[cfg(not(feature = "no-entrypoint"))]
solana_program_entrypoint::entrypoint!(process_instruction);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_adapter::NativeAdapterError;
    use crate::production_claim_lane_principal_executor::ProductionClaimLanePrincipalExecutorError;
    use crate::production_dispatch::{
        PRODUCTION_ROUTED_HANDLER_COUNT, PRODUCTION_UNAVAILABLE_HANDLER_COUNT,
    };
    use crate::production_initialization_policy_hold::{
        ProductionInitializationPolicyHold, ProductionInitializationPolicyHoldError,
    };
    use crate::production_open_position_executor::ProductionOpenPositionExecutorError;
    use crate::production_round_disabled::ProductionDisabledRoundError;
    use crate::production_set_eligibility::ProductionSetEligibilityError;
    use crate::production_settle_position_week::{
        ProductionSettleCoreWeekPolicyHoldError, ProductionSettleCoreWeekPreflightUnavailable,
    };
    use crate::production_settle_position_week_executor::ProductionSettlePositionStandardExecutorError;
    use crate::production_withdraw_position_executor::ProductionWithdrawPositionExecutorError;

    #[test]
    fn truth_keeps_all_15_devnet_release_and_mainnet_on_hold() {
        let truth = PRODUCTION_ENTRYPOINT_TRUTH;
        assert!(truth.feature_gated);
        assert!(truth.exact_all_15_instruction_abi_exposed);
        assert!(truth.compiled_identity_inputs_required);
        assert!(!truth.identities_accepted_from_instruction_or_accounts);
        assert!(truth.daily_law_authenticated_before_instruction_decode);
        assert_eq!(
            truth.routed_complete_handler_count,
            PRODUCTION_ROUTED_HANDLER_COUNT
        );
        assert_eq!(
            truth.rejected_incomplete_handler_count,
            PRODUCTION_UNAVAILABLE_HANDLER_COUNT
        );
        assert_eq!(truth.routed_active_handler_count, 6);
        assert_eq!(truth.routed_disabled_handler_count, 3);
        assert_eq!(truth.routed_policy_held_handler_count, 6);
        assert!(truth.one_daily_law_transaction_prefix_required);
        assert!(truth.token_handlers_reuse_prefix_without_duplicate_meta);
        assert!(truth.set_eligibility_write_path_exposed);
        assert!(truth.open_position_write_path_exposed);
        assert!(truth.settle_position_week_write_path_exposed);
        assert!(truth.withdraw_position_write_path_exposed);
        assert!(truth.close_position_write_path_exposed);
        assert!(truth.claim_lane_principal_non_core_write_path_exposed);
        assert!(truth.claim_lane_principal_core_policy_hold);
        assert!(truth.disabled_round_paths_exposed);
        assert!(!truth.disabled_round_active_success_possible);
        assert!(truth.initialization_policy_hold_paths_exposed);
        assert!(!truth.initialization_or_activation_success_possible);
        assert!(!truth.all_15_handlers_complete);
        assert!(!truth.production_identity_evidence_verified);
        assert!(!truth.devnet_executed);
        assert!(!truth.release_authorized);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_ENTRYPOINT_STATUS.contains("MAINNET_HOLD"));
    }

    #[test]
    fn compiled_entrypoint_rejects_wrong_program_and_missing_law_account() {
        let correct_program = Pubkey::new_from_array(compiled_economy_program_id());
        assert_eq!(
            process_instruction(&Pubkey::default(), &[], &[]),
            Err(ProductionEntrypointError::IncorrectProgramId.into())
        );
        assert_eq!(
            process_instruction(&correct_program, &[], &[]),
            Err(ProductionEntrypointError::MissingDailyLawAccount.into())
        );
    }

    #[test]
    fn no_handler_unavailable_route_remains() {
        assert_eq!(PRODUCTION_UNAVAILABLE_HANDLER_COUNT, 0);
        assert_eq!(PRODUCTION_ROUTED_HANDLER_COUNT, 15);
    }

    #[test]
    fn routed_handler_failures_have_distinct_stable_entrypoint_errors() {
        assert_eq!(
            map_dispatch_error(
                ProductionAuthenticatedDispatchError::SettleCoreWeekPolicyHold(
                    ProductionSettleCoreWeekPolicyHoldError::CoreCustodyPolicyUnresolved {
                        ordinal: 7,
                        retained_preflight:
                            ProductionSettleCoreWeekPreflightUnavailable::ExactAbiOmitsAuthenticatedAccountFacts,
                    },
                ),
            ),
            ProgramError::Custom(ProductionEntrypointError::CoreCustodyPolicyHold as u32),
        );
        assert_eq!(
            map_dispatch_error(
                ProductionAuthenticatedDispatchError::SettleCoreWeekPolicyHold(
                    ProductionSettleCoreWeekPolicyHoldError::WrongInstruction,
                ),
            ),
            ProgramError::Custom(
                ProductionEntrypointError::SettleCoreWeekPolicyHoldRejected as u32,
            ),
        );
        for hold in [
            ProductionInitializationPolicyHold::InitializeConfigOwnerBootstrapPolicyUnaccepted,
            ProductionInitializationPolicyHold::InitializeLaneVaultGenesisPolicyUnaccepted,
            ProductionInitializationPolicyHold::InitializeStakeVaultGenesisPolicyUnaccepted,
            ProductionInitializationPolicyHold::ActivateGenesisAuthorizationAbsent,
            ProductionInitializationPolicyHold::RegisterAgencyCccDlcNotActive,
        ] {
            assert_eq!(
                map_dispatch_error(
                    ProductionAuthenticatedDispatchError::InitializationPolicyHold(
                        ProductionInitializationPolicyHoldError::Held(hold),
                    ),
                ),
                ProgramError::Custom(
                    PRODUCTION_INITIALIZATION_POLICY_HOLD_ERROR_BASE + u32::from(hold.opcode()),
                ),
            );
        }
        assert_eq!(
            map_dispatch_error(
                ProductionAuthenticatedDispatchError::InitializationPolicyHold(
                    ProductionInitializationPolicyHoldError::NotInitializationInstruction,
                )
            ),
            ProgramError::Custom(
                ProductionEntrypointError::InitializationPolicyHoldRejected as u32,
            ),
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::SetEligibility(
                ProductionSetEligibilityError::AccountCountMismatch,
            )),
            ProgramError::Custom(ProductionEntrypointError::SetEligibilityRejected as u32)
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::ClaimLanePrincipal(
                ProductionClaimLanePrincipalExecutorError::CoreCustodyPolicyHold,
            )),
            ProgramError::Custom(ProductionEntrypointError::CoreCustodyPolicyHold as u32),
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::ClaimLanePrincipal(
                ProductionClaimLanePrincipalExecutorError::AccountCountMismatch,
            )),
            ProgramError::Custom(ProductionEntrypointError::ClaimLanePrincipalRejected as u32),
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::WithdrawPosition(
                ProductionWithdrawPositionExecutorError::AccountCountMismatch,
            )),
            ProgramError::Custom(ProductionEntrypointError::WithdrawPositionRejected as u32)
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::OpenPosition(
                ProductionOpenPositionExecutorError::AccountCountMismatch,
            )),
            ProgramError::Custom(ProductionEntrypointError::OpenPositionRejected as u32)
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::SettlePositionWeek(
                ProductionSettlePositionStandardExecutorError::AccountCountMismatch,
            )),
            ProgramError::Custom(ProductionEntrypointError::SettlePositionWeekRejected as u32)
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::DisabledRound(
                ProductionDisabledRoundError::CccDlcNotActive,
            )),
            ProgramError::Custom(ProductionEntrypointError::CccDlcNotActive as u32)
        );
        assert_eq!(
            map_dispatch_error(ProductionAuthenticatedDispatchError::DisabledRound(
                ProductionDisabledRoundError::WrongInstruction,
            )),
            ProgramError::Custom(ProductionEntrypointError::DisabledRoundRejected as u32)
        );
    }

    #[test]
    fn identity_mismatch_fails_before_account_or_instruction_access() {
        let (law, economy) = compiled_bindings().unwrap();
        let mismatched_economy =
            NativeEconomyBinding::new(economy.program_id(), [0xA5; 32]).unwrap();
        assert_eq!(
            process_instruction_with_runtime_bindings(
                &Pubkey::new_from_array(economy.program_id()),
                &[],
                &[0xFF],
                &law,
                &mismatched_economy,
            ),
            Err(ProductionEntrypointError::IdentityBindingRejected.into())
        );
    }

    #[test]
    fn daily_law_rejection_precedes_malformed_instruction_decode() {
        let (law, economy) = compiled_bindings().unwrap();
        let wrong_law_key = Pubkey::default();
        let law_owner = Pubkey::new_from_array(law.law_program_id());
        let mut lamports = 0_u64;
        let mut data = [];
        let wrong_law = AccountInfo::new(
            &wrong_law_key,
            false,
            false,
            &mut lamports,
            &mut data,
            &law_owner,
            false,
        );
        assert_eq!(
            process_instruction_with_runtime_bindings(
                &Pubkey::new_from_array(economy.program_id()),
                &[wrong_law],
                &[0xFF],
                &law,
                &economy,
            ),
            Err(ProductionEntrypointError::DailyLawRejected.into())
        );
    }

    #[test]
    fn native_binding_errors_never_escape_the_entrypoint_surface() {
        let error = NativeEconomyBinding::new([1; 32], [0; 32]).unwrap_err();
        assert!(matches!(error, NativeAdapterError::ZeroMintIdentity));
        assert_eq!(
            ProgramError::from(ProductionEntrypointError::IdentityBindingRejected),
            ProgramError::Custom(0xE501)
        );
    }
}

//! Production-native fail-closed handlers for initialization and activation.
//!
//! The retained transition kernels exist, but the production bootstrap policy,
//! complete preactivation history, destination manifest, and activation
//! authorization are not accepted. This module therefore makes the current
//! production behavior explicit: a compiled program identity and an opaque,
//! already-authenticated Daily-Law capability are required before the exact ABI
//! is decoded, then operations zero through three return a typed owner-policy
//! HOLD and `register_agency` returns the retained compile-time CCC-disabled
//! HOLD. No operation accounts are accepted by this boundary, so these paths
//! cannot borrow data, invoke CPI, or write state while authorization is absent.

use crate::native_adapter::NativeEconomyBinding;
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_adapter::RuntimeValidatedDailyLawWrite;
use solana_pubkey::Pubkey;

pub const PRODUCTION_INITIALIZATION_POLICY_HOLD_STATUS: &str =
    "FIVE_DAILY_LAW_FIRST_NATIVE_HOLD_HANDLERS_NO_ACCOUNT_READS_NO_CPI_NO_WRITES_DEVNET_FALSE_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionInitializationPolicyHoldTruth {
    pub feature_gated: bool,
    pub production_program_identity_required_before_decode: bool,
    pub opaque_runtime_daily_law_required_before_decode: bool,
    pub exact_instruction_abi_decoded: bool,
    pub initialization_route_count: usize,
    pub owner_policy_held_route_count: usize,
    pub compile_time_disabled_route_count: usize,
    pub operation_accounts_accepted: bool,
    pub account_data_read: bool,
    pub mutable_account_borrowed: bool,
    pub cpi_executed: bool,
    pub account_writes_executed: bool,
    pub owner_bootstrap_policy_accepted: bool,
    pub complete_preactivation_history_authenticated: bool,
    pub genesis_destination_manifest_accepted: bool,
    pub activation_authorized: bool,
    pub ccc_dlc_genesis_enabled: bool,
    pub devnet_executed: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_INITIALIZATION_POLICY_HOLD_TRUTH: ProductionInitializationPolicyHoldTruth =
    ProductionInitializationPolicyHoldTruth {
        feature_gated: true,
        production_program_identity_required_before_decode: true,
        opaque_runtime_daily_law_required_before_decode: true,
        exact_instruction_abi_decoded: true,
        initialization_route_count: 5,
        owner_policy_held_route_count: 4,
        compile_time_disabled_route_count: 1,
        operation_accounts_accepted: false,
        account_data_read: false,
        mutable_account_borrowed: false,
        cpi_executed: false,
        account_writes_executed: false,
        owner_bootstrap_policy_accepted: false,
        complete_preactivation_history_authenticated: false,
        genesis_destination_manifest_accepted: false,
        activation_authorized: false,
        ccc_dlc_genesis_enabled: false,
        devnet_executed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionInitializationPolicyHold {
    InitializeConfigOwnerBootstrapPolicyUnaccepted,
    InitializeLaneVaultGenesisPolicyUnaccepted,
    InitializeStakeVaultGenesisPolicyUnaccepted,
    ActivateGenesisAuthorizationAbsent,
    RegisterAgencyCccDlcNotActive,
}

impl ProductionInitializationPolicyHold {
    pub const fn opcode(self) -> u8 {
        match self {
            Self::InitializeConfigOwnerBootstrapPolicyUnaccepted => 0,
            Self::InitializeLaneVaultGenesisPolicyUnaccepted => 1,
            Self::InitializeStakeVaultGenesisPolicyUnaccepted => 2,
            Self::ActivateGenesisAuthorizationAbsent => 3,
            Self::RegisterAgencyCccDlcNotActive => 4,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionInitializationPolicyHoldError {
    IncorrectProgramId,
    Instruction(ProductionInstructionError),
    NotInitializationInstruction,
    Held(ProductionInitializationPolicyHold),
}

impl From<ProductionInstructionError> for ProductionInitializationPolicyHoldError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

/// Classify the exact retained instruction after the caller has authenticated
/// the program identity and Daily Law. The result is policy truth, not an
/// authorization capability.
pub const fn classify_production_initialization_policy_hold(
    instruction: ProductionInstruction,
) -> Option<ProductionInitializationPolicyHold> {
    match instruction {
        ProductionInstruction::InitializeConfig => {
            Some(ProductionInitializationPolicyHold::InitializeConfigOwnerBootstrapPolicyUnaccepted)
        }
        ProductionInstruction::InitializeLaneVault { .. } => {
            Some(ProductionInitializationPolicyHold::InitializeLaneVaultGenesisPolicyUnaccepted)
        }
        ProductionInstruction::InitializeStakeVault => {
            Some(ProductionInitializationPolicyHold::InitializeStakeVaultGenesisPolicyUnaccepted)
        }
        ProductionInstruction::Activate => {
            Some(ProductionInitializationPolicyHold::ActivateGenesisAuthorizationAbsent)
        }
        ProductionInstruction::RegisterAgency => {
            Some(ProductionInitializationPolicyHold::RegisterAgencyCccDlcNotActive)
        }
        _ => None,
    }
}

/// Authenticate the compiled Economy identity before decoding the ABI, while
/// requiring the unforgeable runtime Daily-Law capability as an input. This
/// boundary deliberately accepts no AccountInfo slice. Until the referenced
/// owner decisions are accepted, every supported route terminates in a typed
/// HOLD without any possible account access or CPI.
#[inline(never)]
pub(crate) fn execute_runtime_production_initialization_policy_hold(
    program_id: &Pubkey,
    _runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
) -> Result<(), ProductionInitializationPolicyHoldError> {
    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionInitializationPolicyHoldError::IncorrectProgramId);
    }
    let instruction = decode_production_instruction(instruction_data)?;
    let hold = classify_production_initialization_policy_hold(instruction)
        .ok_or(ProductionInitializationPolicyHoldError::NotInitializationInstruction)?;
    Err(ProductionInitializationPolicyHoldError::Held(hold))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::runtime_adapter::RuntimeValidatedDailyLawWrite;
    use crate::{
        verify_daily_law_open, CanonicalDailyLawBinding, ReadonlyDailyLawAccount, LAW_STATE_LEN,
        LAW_STATE_MAGIC, LAW_STATE_VERSION,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day};

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    fn encoded(instruction: ProductionInstruction) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut output = [0_u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(instruction, &mut output).unwrap();
        output
    }

    fn with_runtime_law<R>(operation: impl FnOnce(&RuntimeValidatedDailyLawWrite) -> R) -> R {
        let local_day = protocol_local_day(CLOCK_TIMESTAMP);
        let decision = (0_u16..=u8::MAX.into())
            .find_map(|candidate| {
                let mut hash = [0_u8; 32];
                hash[31] = candidate as u8;
                let decision =
                    create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT)
                        .unwrap();
                (!decision.locked).then_some(decision)
            })
            .expect("an open deterministic Daily-Law vector");
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
        operation(&RuntimeValidatedDailyLawWrite::from_test_gate(
            gate,
            LAW_STATE,
            LAW_PROGRAM,
        ))
    }

    #[test]
    fn exact_five_routes_have_typed_non_authorizing_holds() {
        let instructions = [
            ProductionInstruction::InitializeConfig,
            ProductionInstruction::InitializeLaneVault { lane: 3 },
            ProductionInstruction::InitializeStakeVault,
            ProductionInstruction::Activate,
            ProductionInstruction::RegisterAgency,
        ];
        for (opcode, instruction) in instructions.into_iter().enumerate() {
            let hold = classify_production_initialization_policy_hold(instruction).unwrap();
            assert_eq!(usize::from(hold.opcode()), opcode);
        }
        assert_eq!(
            classify_production_initialization_policy_hold(
                ProductionInstruction::WithdrawPositionPrincipal,
            ),
            None,
        );
    }

    #[test]
    fn wrong_program_identity_precedes_even_malformed_instruction_decode() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        with_runtime_law(|runtime_law| {
            assert_eq!(
                execute_runtime_production_initialization_policy_hold(
                    &Pubkey::default(),
                    runtime_law,
                    &binding,
                    &[0xFF],
                ),
                Err(ProductionInitializationPolicyHoldError::IncorrectProgramId),
            );
        });
    }

    #[test]
    fn all_five_authenticated_routes_stop_at_the_exact_hold_without_accounts() {
        let binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap();
        let instructions = [
            ProductionInstruction::InitializeConfig,
            ProductionInstruction::InitializeLaneVault { lane: 3 },
            ProductionInstruction::InitializeStakeVault,
            ProductionInstruction::Activate,
            ProductionInstruction::RegisterAgency,
        ];
        with_runtime_law(|runtime_law| {
            for instruction in instructions {
                let expected = classify_production_initialization_policy_hold(instruction).unwrap();
                assert_eq!(
                    execute_runtime_production_initialization_policy_hold(
                        &Pubkey::new_from_array(ECONOMY_PROGRAM),
                        runtime_law,
                        &binding,
                        &encoded(instruction),
                    ),
                    Err(ProductionInitializationPolicyHoldError::Held(expected)),
                );
            }
        });
    }

    #[test]
    fn truth_never_promotes_bootstrap_activation_ccc_or_devnet() {
        let truth = PRODUCTION_INITIALIZATION_POLICY_HOLD_TRUTH;
        assert!(truth.feature_gated);
        assert!(truth.production_program_identity_required_before_decode);
        assert!(truth.opaque_runtime_daily_law_required_before_decode);
        assert!(truth.exact_instruction_abi_decoded);
        assert_eq!(truth.initialization_route_count, 5);
        assert_eq!(truth.owner_policy_held_route_count, 4);
        assert_eq!(truth.compile_time_disabled_route_count, 1);
        assert!(!truth.operation_accounts_accepted);
        assert!(!truth.account_data_read);
        assert!(!truth.mutable_account_borrowed);
        assert!(!truth.cpi_executed);
        assert!(!truth.account_writes_executed);
        assert!(!truth.owner_bootstrap_policy_accepted);
        assert!(!truth.complete_preactivation_history_authenticated);
        assert!(!truth.genesis_destination_manifest_accepted);
        assert!(!truth.activation_authorized);
        assert!(!truth.ccc_dlc_genesis_enabled);
        assert!(!truth.devnet_executed);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_INITIALIZATION_POLICY_HOLD_STATUS.ends_with("MAINNET_HOLD"));
    }
}

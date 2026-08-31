//! Production-native disabled boundary for retained CCC round operations.
//!
//! The Genesis artifact fixes `CCC_DLC_GENESIS_ENABLED` to `false`. These
//! handlers therefore authenticate the already-validated transaction Daily-Law
//! capability and production program identity, decode the exact ABI, and call
//! the retained public kernels with deliberately inert by-value observations.
//! Every canonical opcode deterministically returns `CccDlcNotActive` before
//! any operation account is accepted, borrowed, written, or passed to CPI.

use crate::native_adapter::NativeEconomyBinding;
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_adapter::RuntimeValidatedDailyLawWrite;
use crate::{
    commit_round, expire_round, settle_round, CommitRoundConfigState, CommitRoundInput,
    EconomyError, ReadonlyInstruction, ReadonlyInstructionTrace, ReadonlyRoundRandomnessAccount,
    RoundState, CCC_DLC_GENESIS_ENABLED,
};
use solana_pubkey::Pubkey;

pub const PRODUCTION_DISABLED_ROUND_STATUS: &str =
    "EXACT_ROUND_ABI_PRODUCTION_ID_DAILY_LAW_AUTHENTICATED_RETAINED_KERNEL_CCC_DISABLED_BEFORE_ACCOUNTS_WRITES_CPI_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionDisabledRoundTruth {
    pub feature_gated: bool,
    pub commit_round_opcode_routed: bool,
    pub settle_round_opcode_routed: bool,
    pub expire_round_opcode_routed: bool,
    pub exact_instruction_codec_required: bool,
    pub production_program_identity_required: bool,
    pub runtime_daily_law_capability_required: bool,
    pub retained_public_kernels_called: bool,
    pub ccc_dlc_genesis_enabled: bool,
    pub ccc_dlc_not_active_returned: bool,
    pub operation_accounts_accepted: bool,
    pub account_borrows_executed: bool,
    pub account_writes_executed: bool,
    pub cpi_executed: bool,
    pub active_feature_success_possible: bool,
    pub source_complete_disabled_handlers: bool,
    pub devnet_executed: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_DISABLED_ROUND_TRUTH: ProductionDisabledRoundTruth =
    ProductionDisabledRoundTruth {
        feature_gated: true,
        commit_round_opcode_routed: true,
        settle_round_opcode_routed: true,
        expire_round_opcode_routed: true,
        exact_instruction_codec_required: true,
        production_program_identity_required: true,
        runtime_daily_law_capability_required: true,
        retained_public_kernels_called: true,
        ccc_dlc_genesis_enabled: CCC_DLC_GENESIS_ENABLED,
        ccc_dlc_not_active_returned: true,
        operation_accounts_accepted: false,
        account_borrows_executed: false,
        account_writes_executed: false,
        cpi_executed: false,
        active_feature_success_possible: false,
        source_complete_disabled_handlers: true,
        devnet_executed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionDisabledRoundError {
    ProgramIdentityMismatch,
    DailyLawBindingMismatch,
    Instruction(ProductionInstructionError),
    WrongInstruction,
    CccDlcNotActive,
    DisabledInvariantViolated,
}

impl From<ProductionInstructionError> for ProductionDisabledRoundError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

/// Dispatch one of the three CCC-disabled round opcodes without accepting any
/// operation accounts. Identity and the opaque Daily-Law capability are
/// authenticated before decoding; only canonical round instructions reach a
/// retained kernel.
#[inline(never)]
pub fn execute_runtime_production_disabled_round_instruction(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
) -> Result<(), ProductionDisabledRoundError> {
    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionDisabledRoundError::ProgramIdentityMismatch);
    }
    require_runtime_law_binding(runtime_law, binding)?;
    let instruction = decode_production_instruction(instruction_data)?;
    match instruction {
        ProductionInstruction::CommitRound { week } => map_disabled_kernel_result(commit_round(
            runtime_law.gate(),
            inert_commit_round_input(binding, week),
        )),
        ProductionInstruction::SettleRound => map_disabled_kernel_result(settle_round(
            runtime_law.gate(),
            false,
            [0; 32],
            inert_round_state(binding),
            ReadonlyRoundRandomnessAccount::new([0; 32], &[]),
            0,
        )),
        ProductionInstruction::ExpireRound => {
            map_disabled_kernel_result(expire_round(runtime_law.gate(), inert_round_state(binding)))
        }
        _ => Err(ProductionDisabledRoundError::WrongInstruction),
    }
}

fn require_runtime_law_binding(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
) -> Result<(), ProductionDisabledRoundError> {
    if runtime_law.mint() != binding.mint()
        || runtime_law.gate().law_program_id() != runtime_law.law_program_owner()
        || runtime_law.gate().law_state_address() != runtime_law.law_account_key()
    {
        return Err(ProductionDisabledRoundError::DailyLawBindingMismatch);
    }
    Ok(())
}

fn map_disabled_kernel_result<T>(
    result: Result<T, EconomyError>,
) -> Result<(), ProductionDisabledRoundError> {
    match result {
        Err(EconomyError::CccDlcNotActive) => Err(ProductionDisabledRoundError::CccDlcNotActive),
        Ok(_) | Err(_) => Err(ProductionDisabledRoundError::DisabledInvariantViolated),
    }
}

fn inert_commit_round_input(
    binding: &NativeEconomyBinding,
    week: u64,
) -> CommitRoundInput<'static> {
    const NO_INSTRUCTIONS: [ReadonlyInstruction<'static>; 0] = [];
    CommitRoundInput {
        config: CommitRoundConfigState {
            key: binding.config(),
            randomness_program: [0; 32],
            agency_registry_hash: [0; 32],
            genesis_timestamp: i64::MAX,
            agency_count: 0,
            active: false,
        },
        week,
        payer: [0; 32],
        randomness_account_key: [0; 32],
        randomness_account: ReadonlyRoundRandomnessAccount::new([0; 32], &[]),
        instruction_trace: ReadonlyInstructionTrace::new(None, &NO_INSTRUCTIONS),
        clock_slot: 0,
        round_bump: 0,
    }
}

fn inert_round_state(binding: &NativeEconomyBinding) -> RoundState {
    RoundState {
        config: binding.config(),
        randomness_account: [0; 32],
        week: u64::MAX,
        commit_slot: 0,
        commit_timestamp: i64::MAX,
        randomness: [0; 32],
        agency_registry_hash_snapshot: [0; 32],
        decision_context: [0; 32],
        agency_count_snapshot: 0,
        selected_agency_index: u32::MAX,
        derivation_counter: u32::MAX,
        status: u8::MAX,
        bump: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_LEN,
    };
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

    fn binding() -> NativeEconomyBinding {
        NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
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

    fn runtime_law() -> RuntimeValidatedDailyLawWrite {
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
        RuntimeValidatedDailyLawWrite::from_test_gate(gate, LAW_STATE, LAW_PROGRAM)
    }

    fn encoded(instruction: ProductionInstruction) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut output = [0_u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(instruction, &mut output).unwrap();
        output
    }

    #[test]
    fn exact_three_round_opcodes_reach_retained_kernels_and_remain_disabled() {
        let binding = binding();
        let law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        for instruction in [
            ProductionInstruction::CommitRound { week: u64::MAX },
            ProductionInstruction::SettleRound,
            ProductionInstruction::ExpireRound,
        ] {
            assert_eq!(
                execute_runtime_production_disabled_round_instruction(
                    &program_id,
                    &law,
                    &binding,
                    &encoded(instruction),
                ),
                Err(ProductionDisabledRoundError::CccDlcNotActive),
            );
        }
    }

    #[test]
    fn identity_and_law_binding_precede_abi_decode() {
        let binding = binding();
        let law = runtime_law();
        assert_eq!(
            execute_runtime_production_disabled_round_instruction(
                &Pubkey::new_from_array([0x99; 32]),
                &law,
                &binding,
                &[0xFF],
            ),
            Err(ProductionDisabledRoundError::ProgramIdentityMismatch),
        );

        let wrong_binding = NativeEconomyBinding::new(ECONOMY_PROGRAM, [0x44; 32]).unwrap();
        assert_eq!(
            execute_runtime_production_disabled_round_instruction(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &law,
                &wrong_binding,
                &[0xFF],
            ),
            Err(ProductionDisabledRoundError::DailyLawBindingMismatch),
        );
    }

    #[test]
    fn malformed_or_nonround_abi_never_reaches_disabled_kernel() {
        let binding = binding();
        let law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        assert_eq!(
            execute_runtime_production_disabled_round_instruction(
                &program_id,
                &law,
                &binding,
                &[0xFF],
            ),
            Err(ProductionDisabledRoundError::Instruction(
                ProductionInstructionError::InvalidLength,
            )),
        );
        assert_eq!(
            execute_runtime_production_disabled_round_instruction(
                &program_id,
                &law,
                &binding,
                &encoded(ProductionInstruction::ClosePosition),
            ),
            Err(ProductionDisabledRoundError::WrongInstruction),
        );
    }

    #[test]
    fn truth_never_claims_active_ccc_or_runtime_effects() {
        let truth = PRODUCTION_DISABLED_ROUND_TRUTH;
        assert!(truth.source_complete_disabled_handlers);
        assert!(truth.retained_public_kernels_called);
        assert!(truth.ccc_dlc_not_active_returned);
        assert!(!truth.ccc_dlc_genesis_enabled);
        assert!(!truth.operation_accounts_accepted);
        assert!(!truth.account_borrows_executed);
        assert!(!truth.account_writes_executed);
        assert!(!truth.cpi_executed);
        assert!(!truth.active_feature_success_possible);
        assert!(!truth.devnet_executed);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_DISABLED_ROUND_STATUS.contains("MAINNET_HOLD"));
    }
}

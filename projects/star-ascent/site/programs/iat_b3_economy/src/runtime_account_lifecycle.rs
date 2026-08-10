//! Feature-gated execution of sealed B3 PDA account-creation intents.
//!
//! This is an internal lifecycle primitive, not an instruction handler. It
//! accepts only an [`AtomicWriteBatch`] sealed by the native adapter, validates
//! every target and payer preimage before the first CPI, reconstructs canonical
//! PDA signer seeds inside this crate, performs only the exact System Program
//! create/allocate/assign/fund sequence, and writes only the sealed postimages.
//! Solana transaction rollback is required for any error after the first CPI.
//! No public instruction decoder, dispatcher, entrypoint, Token CPI, arbitrary
//! seed input, arbitrary owner, or arbitrary instruction is exposed.

extern crate alloc;

use alloc::vec::Vec;
use core::array;

use crate::native_adapter::{
    derive_pda, validate_atomic_write_preconditions, with_pda_signer_seeds, AtomicWriteBatch,
    CreatePdaLifecycle, NativeAccountObservation, NativeAdapterError, NativeEconomyBinding,
    StateWriteIntent,
};
use crate::ValidatedDailyLawWrite;
use solana_account_info::AccountInfo;
use solana_cpi::{invoke, invoke_signed};
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;
use solana_sdk_ids::{native_loader, system_program};
use solana_system_interface::instruction as system_instruction;

pub const RUNTIME_ACCOUNT_LIFECYCLE_STATUS: &str =
    "FEATURE_GATED_SEALED_PDA_SYSTEM_CPI_NO_ABI_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeAccountLifecycleTruth {
    pub feature_gated: bool,
    pub daily_law_capability_required: bool,
    pub sealed_create_intents_only: bool,
    pub all_preconditions_checked_before_first_cpi: bool,
    pub canonical_internal_pda_signer_seeds_only: bool,
    pub system_create_account_supported: bool,
    pub system_allocate_assign_fund_supported: bool,
    pub sealed_postimage_write_supported: bool,
    pub transaction_rollback_required_after_cpi: bool,
    pub token_cpi_supported: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const RUNTIME_ACCOUNT_LIFECYCLE_TRUTH: RuntimeAccountLifecycleTruth =
    RuntimeAccountLifecycleTruth {
        feature_gated: true,
        daily_law_capability_required: true,
        sealed_create_intents_only: true,
        all_preconditions_checked_before_first_cpi: true,
        canonical_internal_pda_signer_seeds_only: true,
        system_create_account_supported: true,
        system_allocate_assign_fund_supported: true,
        sealed_postimage_write_supported: true,
        transaction_rollback_required_after_cpi: true,
        token_cpi_supported: false,
        instruction_abi_frozen: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        any_handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RuntimeAccountLifecycleError {
    Native(NativeAdapterError),
    AccountCountMismatch,
    ExistingIntentUnsupported,
    AccountBorrowFailed,
    SystemProgramKeyMismatch,
    SystemProgramOwnerMismatch,
    SystemProgramMustBeReadonly,
    SystemProgramMustNotBeSigner,
    SystemProgramMustBeExecutable,
    PayerAccountMissing,
    CanonicalPdaMismatch,
    CpiFailed(ProgramError),
    PostCpiOwnerMismatch,
    PostCpiLamportMismatch,
    PostCpiPayerLamportMismatch,
    PostCpiDataLengthMismatch,
    PostCpiDataNotZero,
}

impl From<NativeAdapterError> for RuntimeAccountLifecycleError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeAccountLifecycleReceipt<const N: usize> {
    batch_commitment_sha256: [u8; 32],
    postimage_sha256: [[u8; 32]; N],
}

impl<const N: usize> RuntimeAccountLifecycleReceipt<N> {
    pub const fn batch_commitment_sha256(&self) -> [u8; 32] {
        self.batch_commitment_sha256
    }

    pub const fn postimage_sha256(&self) -> &[[u8; 32]; N] {
        &self.postimage_sha256
    }
}

trait SystemCpiInvoker {
    #[allow(clippy::too_many_arguments)]
    fn create_account<'a>(
        &mut self,
        payer: &AccountInfo<'a>,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        lamports: u64,
        data_len: usize,
        owner: &Pubkey,
        signer_seeds: &[&[u8]],
    ) -> Result<(), ProgramError>;

    fn allocate<'a>(
        &mut self,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        data_len: usize,
        signer_seeds: &[&[u8]],
    ) -> Result<(), ProgramError>;

    fn assign<'a>(
        &mut self,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        owner: &Pubkey,
        signer_seeds: &[&[u8]],
    ) -> Result<(), ProgramError>;

    fn transfer<'a>(
        &mut self,
        payer: &AccountInfo<'a>,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        lamports: u64,
    ) -> Result<(), ProgramError>;
}

struct SolanaSystemCpi;

impl SystemCpiInvoker for SolanaSystemCpi {
    fn create_account<'a>(
        &mut self,
        payer: &AccountInfo<'a>,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        lamports: u64,
        data_len: usize,
        owner: &Pubkey,
        signer_seeds: &[&[u8]],
    ) -> Result<(), ProgramError> {
        let instruction = system_instruction::create_account(
            payer.key,
            target.key,
            lamports,
            u64::try_from(data_len).map_err(|_| ProgramError::InvalidInstructionData)?,
            owner,
        );
        invoke_signed(
            &instruction,
            &[payer.clone(), target.clone(), system.clone()],
            &[signer_seeds],
        )
    }

    fn allocate<'a>(
        &mut self,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        data_len: usize,
        signer_seeds: &[&[u8]],
    ) -> Result<(), ProgramError> {
        let instruction = system_instruction::allocate(
            target.key,
            u64::try_from(data_len).map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        invoke_signed(
            &instruction,
            &[target.clone(), system.clone()],
            &[signer_seeds],
        )
    }

    fn assign<'a>(
        &mut self,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        owner: &Pubkey,
        signer_seeds: &[&[u8]],
    ) -> Result<(), ProgramError> {
        let instruction = system_instruction::assign(target.key, owner);
        invoke_signed(
            &instruction,
            &[target.clone(), system.clone()],
            &[signer_seeds],
        )
    }

    fn transfer<'a>(
        &mut self,
        payer: &AccountInfo<'a>,
        target: &AccountInfo<'a>,
        system: &AccountInfo<'a>,
        lamports: u64,
    ) -> Result<(), ProgramError> {
        invoke(
            &system_instruction::transfer(payer.key, target.key, lamports),
            &[payer.clone(), target.clone(), system.clone()],
        )
    }
}

/// Execute a sealed batch containing only new PDA state accounts.
///
/// All immutable target and payer observations are held and validated before
/// the first CPI. A CPI or post-CPI validation failure returns an error so the
/// Solana runtime rolls the entire enclosing instruction back atomically.
// The public lifecycle boundary must remain a distinct SBF frame. LTO may
// otherwise merge the sealed batch, verifier, and entrypoint locals past the
// runtime's 4 KiB per-frame limit.
#[inline(never)]
pub fn execute_create_state_batch_account_infos<'a, const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    targets: &[AccountInfo<'a>],
    payers: &[AccountInfo<'a>],
    system: &AccountInfo<'a>,
) -> Result<RuntimeAccountLifecycleReceipt<N>, RuntimeAccountLifecycleError> {
    execute_create_state_batch_with(
        gate,
        binding,
        batch,
        targets,
        payers,
        system,
        &mut SolanaSystemCpi,
    )
}

#[inline(never)]
fn execute_create_state_batch_with<'a, const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    targets: &[AccountInfo<'a>],
    payers: &[AccountInfo<'a>],
    system: &AccountInfo<'a>,
    invoker: &mut impl SystemCpiInvoker,
) -> Result<RuntimeAccountLifecycleReceipt<N>, RuntimeAccountLifecycleError> {
    require_system_program(system)?;
    if targets.len() != N {
        return Err(RuntimeAccountLifecycleError::AccountCountMismatch);
    }
    if batch
        .intents()
        .iter()
        .any(|intent| matches!(intent, StateWriteIntent::Existing(_)))
    {
        return Err(RuntimeAccountLifecycleError::ExistingIntentUnsupported);
    }

    let mut target_lamports = Vec::with_capacity(N);
    let mut target_data = Vec::with_capacity(N);
    for target in targets {
        target_lamports.push(
            target
                .try_borrow_lamports()
                .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?,
        );
        target_data.push(
            target
                .try_borrow_data()
                .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?,
        );
    }
    let mut payer_lamports = Vec::with_capacity(payers.len());
    let mut payer_data = Vec::with_capacity(payers.len());
    for payer in payers {
        payer_lamports.push(
            payer
                .try_borrow_lamports()
                .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?,
        );
        payer_data.push(
            payer
                .try_borrow_data()
                .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?,
        );
    }
    let target_observations: Vec<_> = targets
        .iter()
        .enumerate()
        .map(|(index, target)| NativeAccountObservation {
            key: target.key.to_bytes(),
            owner: target.owner.to_bytes(),
            lamports: **target_lamports[index],
            data: &target_data[index],
            is_signer: target.is_signer,
            is_writable: target.is_writable,
            executable: target.executable,
        })
        .collect();
    let payer_observations: Vec<_> = payers
        .iter()
        .enumerate()
        .map(|(index, payer)| NativeAccountObservation {
            key: payer.key.to_bytes(),
            owner: payer.owner.to_bytes(),
            lamports: **payer_lamports[index],
            data: &payer_data[index],
            is_signer: payer.is_signer,
            is_writable: payer.is_writable,
            executable: payer.executable,
        })
        .collect();
    let validated = validate_atomic_write_preconditions(
        gate,
        binding,
        batch,
        &target_observations,
        &payer_observations,
    )?;
    drop(payer_observations);
    drop(target_observations);
    drop(payer_data);
    drop(payer_lamports);
    drop(target_data);
    drop(target_lamports);

    for (intent, target) in validated.batch().intents().iter().zip(targets) {
        let StateWriteIntent::Create(create) = intent else {
            return Err(RuntimeAccountLifecycleError::ExistingIntentUnsupported);
        };
        let derived = derive_pda(binding, create.identity())?;
        if derived.key != create.key() || derived.bump != create.bump() {
            return Err(RuntimeAccountLifecycleError::CanonicalPdaMismatch);
        }
        let payer = payers
            .iter()
            .find(|payer| payer.key.to_bytes() == create.payer())
            .ok_or(RuntimeAccountLifecycleError::PayerAccountMissing)?;
        let owner = Pubkey::new_from_array(create.owner());
        with_pda_signer_seeds(
            create.identity(),
            create.bump(),
            |signer_seeds| match create.lifecycle() {
                CreatePdaLifecycle::CreateAccount => invoker.create_account(
                    payer,
                    target,
                    system,
                    create.funding_lamports(),
                    create.data_len(),
                    &owner,
                    signer_seeds,
                ),
                CreatePdaLifecycle::AllocateAssignAndFund => {
                    invoker.allocate(target, system, create.data_len(), signer_seeds)?;
                    invoker.assign(target, system, &owner, signer_seeds)?;
                    if create.funding_lamports() != 0 {
                        invoker.transfer(payer, target, system, create.funding_lamports())?;
                    }
                    Ok(())
                }
            },
        )
        .map_err(RuntimeAccountLifecycleError::CpiFailed)?;
    }

    for (intent, target) in validated.batch().intents().iter().zip(targets) {
        let StateWriteIntent::Create(create) = intent else {
            return Err(RuntimeAccountLifecycleError::ExistingIntentUnsupported);
        };
        if target.owner.to_bytes() != create.owner() {
            return Err(RuntimeAccountLifecycleError::PostCpiOwnerMismatch);
        }
        let expected_lamports = create
            .expected_lamports()
            .checked_add(create.funding_lamports())
            .ok_or(RuntimeAccountLifecycleError::PostCpiLamportMismatch)?;
        if target.lamports() != expected_lamports {
            return Err(RuntimeAccountLifecycleError::PostCpiLamportMismatch);
        }
        let data = target
            .try_borrow_data()
            .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?;
        if data.len() != create.data_len() {
            return Err(RuntimeAccountLifecycleError::PostCpiDataLengthMismatch);
        }
        if data.iter().any(|byte| *byte != 0) {
            return Err(RuntimeAccountLifecycleError::PostCpiDataNotZero);
        }
    }
    for payer in payers {
        let expected_start = validated
            .batch()
            .intents()
            .iter()
            .find_map(|intent| match intent {
                StateWriteIntent::Create(create) if create.payer() == payer.key.to_bytes() => {
                    Some(create.expected_payer_lamports())
                }
                _ => None,
            })
            .ok_or(RuntimeAccountLifecycleError::PayerAccountMissing)?;
        let aggregate = validated
            .batch()
            .intents()
            .iter()
            .filter_map(|intent| match intent {
                StateWriteIntent::Create(create) if create.payer() == payer.key.to_bytes() => {
                    Some(create.funding_lamports())
                }
                _ => None,
            })
            .try_fold(0u64, |sum, value| sum.checked_add(value))
            .ok_or(RuntimeAccountLifecycleError::PostCpiPayerLamportMismatch)?;
        let expected_end = expected_start
            .checked_sub(aggregate)
            .ok_or(RuntimeAccountLifecycleError::PostCpiPayerLamportMismatch)?;
        if payer.lamports() != expected_end {
            return Err(RuntimeAccountLifecycleError::PostCpiPayerLamportMismatch);
        }
    }

    let mut mutable_data = Vec::with_capacity(N);
    for target in targets {
        mutable_data.push(
            target
                .try_borrow_mut_data()
                .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?,
        );
    }
    for (data, intent) in mutable_data.iter_mut().zip(validated.batch().intents()) {
        let StateWriteIntent::Create(create) = intent else {
            return Err(RuntimeAccountLifecycleError::ExistingIntentUnsupported);
        };
        data.copy_from_slice(create.postimage());
    }

    Ok(RuntimeAccountLifecycleReceipt {
        batch_commitment_sha256: validated.batch().commitment_sha256(),
        postimage_sha256: array::from_fn(|index| match validated.batch().intents()[index] {
            StateWriteIntent::Create(create) => create.postimage_sha256(),
            StateWriteIntent::Existing(_) => unreachable!("existing intents were rejected"),
        }),
    })
}

fn require_system_program(system: &AccountInfo<'_>) -> Result<(), RuntimeAccountLifecycleError> {
    if system.key != &system_program::ID {
        return Err(RuntimeAccountLifecycleError::SystemProgramKeyMismatch);
    }
    if system.owner != &native_loader::ID {
        return Err(RuntimeAccountLifecycleError::SystemProgramOwnerMismatch);
    }
    if system.is_writable {
        return Err(RuntimeAccountLifecycleError::SystemProgramMustBeReadonly);
    }
    if system.is_signer {
        return Err(RuntimeAccountLifecycleError::SystemProgramMustNotBeSigner);
    }
    if !system.executable {
        return Err(RuntimeAccountLifecycleError::SystemProgramMustBeExecutable);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_adapter::{
        derive_faction_config, derive_faction_reward_manifest, derive_faction_week,
        prepare_create_state_account, seal_atomic_write_batch, PdaIdentity, StrictStateValue,
    };
    use crate::{
        decode_eligibility_state, verify_daily_law_open, CanonicalDailyLawBinding,
        EligibilityState, ReadonlyDailyLawAccount, LAW_STATE_LEN, LAW_STATE_MAGIC,
        LAW_STATE_VERSION,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_sdk_ids::system_program;

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const OPERATOR_A: [u8; 32] = [0xA1; 32];
    const OPERATOR_B: [u8; 32] = [0xA2; 32];
    const PAYER: [u8; 32] = [0x77; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    fn binding() -> NativeEconomyBinding {
        NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
    }

    fn open_gate() -> ValidatedDailyLawWrite {
        let decision = decision_for_inputs(CLOCK_TIMESTAMP);
        let data = pack_law_state(decision);
        verify_daily_law_open(
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
            CLOCK_TIMESTAMP,
        )
        .unwrap()
    }

    fn decision_for_inputs(timestamp: i64) -> SolanaDailyDecision {
        let local_day = protocol_local_day(timestamp);
        for candidate in 0u16..=u8::MAX.into() {
            let mut hash = [0u8; 32];
            hash[31] = candidate as u8;
            let decision =
                create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
            if !decision.locked {
                return decision;
            }
        }
        panic!("test vector search did not find an open disposition")
    }

    fn pack_law_state(decision: SolanaDailyDecision) -> [u8; LAW_STATE_LEN] {
        let mut data = [0u8; LAW_STATE_LEN];
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
        data
    }

    fn create_intent(
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
        payer: &crate::native_adapter::AuthenticatedSystemPayer,
        operator: [u8; 32],
        current_lamports: u64,
    ) -> StateWriteIntent {
        let identity = PdaIdentity::Eligibility {
            config: binding.config(),
            operator,
        };
        let derived = derive_pda(binding, identity).unwrap();
        prepare_create_state_account(
            gate,
            binding,
            payer,
            NativeAccountObservation {
                key: derived.key,
                owner: system_program::ID.to_bytes(),
                lamports: current_lamports,
                data: &[],
                is_signer: false,
                is_writable: true,
                executable: false,
            },
            identity,
            StrictStateValue::Eligibility(EligibilityState {
                config: binding.config(),
                wallet: operator,
                agency_index: u32::MAX,
                role: 0,
                bump: derived.bump,
            }),
            100,
        )
        .unwrap()
    }

    #[derive(Clone, Debug, Eq, PartialEq)]
    enum MockCall {
        Create {
            target: [u8; 32],
            lamports: u64,
            data_len: usize,
            seeds: Vec<Vec<u8>>,
        },
        Allocate {
            target: [u8; 32],
            data_len: usize,
            seeds: Vec<Vec<u8>>,
        },
        Assign {
            target: [u8; 32],
            owner: [u8; 32],
            seeds: Vec<Vec<u8>>,
        },
        Transfer {
            target: [u8; 32],
            lamports: u64,
        },
    }

    #[derive(Default)]
    struct MockSystemCpi {
        calls: Vec<MockCall>,
        fail_at: Option<usize>,
    }

    impl MockSystemCpi {
        fn should_fail(&self) -> bool {
            self.fail_at == Some(self.calls.len())
        }

        fn copied_seeds(seeds: &[&[u8]]) -> Vec<Vec<u8>> {
            seeds.iter().map(|seed| seed.to_vec()).collect()
        }

        fn allocate_data<'a>(target: &AccountInfo<'a>, data_len: usize) {
            let allocated: &'static mut [u8] = Box::leak(vec![0u8; data_len].into_boxed_slice());
            *target.data.borrow_mut() = allocated;
        }
    }

    impl SystemCpiInvoker for MockSystemCpi {
        fn create_account<'a>(
            &mut self,
            payer: &AccountInfo<'a>,
            target: &AccountInfo<'a>,
            _system: &AccountInfo<'a>,
            lamports: u64,
            data_len: usize,
            owner: &Pubkey,
            signer_seeds: &[&[u8]],
        ) -> Result<(), ProgramError> {
            if self.should_fail() {
                return Err(ProgramError::Custom(91));
            }
            self.calls.push(MockCall::Create {
                target: target.key.to_bytes(),
                lamports,
                data_len,
                seeds: Self::copied_seeds(signer_seeds),
            });
            **payer.try_borrow_mut_lamports()? -= lamports;
            **target.try_borrow_mut_lamports()? += lamports;
            Self::allocate_data(target, data_len);
            target.assign(owner);
            Ok(())
        }

        fn allocate<'a>(
            &mut self,
            target: &AccountInfo<'a>,
            _system: &AccountInfo<'a>,
            data_len: usize,
            signer_seeds: &[&[u8]],
        ) -> Result<(), ProgramError> {
            if self.should_fail() {
                return Err(ProgramError::Custom(92));
            }
            self.calls.push(MockCall::Allocate {
                target: target.key.to_bytes(),
                data_len,
                seeds: Self::copied_seeds(signer_seeds),
            });
            Self::allocate_data(target, data_len);
            Ok(())
        }

        fn assign<'a>(
            &mut self,
            target: &AccountInfo<'a>,
            _system: &AccountInfo<'a>,
            owner: &Pubkey,
            signer_seeds: &[&[u8]],
        ) -> Result<(), ProgramError> {
            if self.should_fail() {
                return Err(ProgramError::Custom(93));
            }
            self.calls.push(MockCall::Assign {
                target: target.key.to_bytes(),
                owner: owner.to_bytes(),
                seeds: Self::copied_seeds(signer_seeds),
            });
            target.assign(owner);
            Ok(())
        }

        fn transfer<'a>(
            &mut self,
            payer: &AccountInfo<'a>,
            target: &AccountInfo<'a>,
            _system: &AccountInfo<'a>,
            lamports: u64,
        ) -> Result<(), ProgramError> {
            if self.should_fail() {
                return Err(ProgramError::Custom(94));
            }
            self.calls.push(MockCall::Transfer {
                target: target.key.to_bytes(),
                lamports,
            });
            **payer.try_borrow_mut_lamports()? -= lamports;
            **target.try_borrow_mut_lamports()? += lamports;
            Ok(())
        }
    }

    #[test]
    fn canonical_signer_seeds_rederive_every_frozen_pda_identity() {
        let binding = binding();
        let faction_config = derive_faction_config(&binding);
        let faction_week = derive_faction_week(&binding, &faction_config, 9).unwrap();
        let reward_manifest = derive_faction_reward_manifest(&binding, &faction_week).unwrap();
        let identities = [
            PdaIdentity::Config { mint: MINT },
            PdaIdentity::VaultAuthority {
                config: binding.config(),
            },
            PdaIdentity::LaneState {
                config: binding.config(),
                lane: 1,
            },
            PdaIdentity::LaneToken {
                config: binding.config(),
                lane: 1,
            },
            PdaIdentity::StakeToken {
                config: binding.config(),
            },
            PdaIdentity::StakeIngress {
                config: binding.config(),
            },
            PdaIdentity::CoreReward {
                config: binding.config(),
            },
            PdaIdentity::Agency {
                config: binding.config(),
                index: 3,
            },
            PdaIdentity::AgencyOwnerIndex {
                config: binding.config(),
                owner: OPERATOR_A,
            },
            PdaIdentity::Eligibility {
                config: binding.config(),
                operator: OPERATOR_A,
            },
            PdaIdentity::Position {
                config: binding.config(),
                operator: OPERATOR_A,
                position_id: 7,
            },
            PdaIdentity::Round {
                config: binding.config(),
                week: 9,
            },
            PdaIdentity::FactionConfig {
                config: binding.config(),
            },
            PdaIdentity::FactionAllegiance {
                faction_config,
                operator: OPERATOR_A,
            },
            PdaIdentity::FactionWeek {
                faction_config,
                week: 9,
            },
            PdaIdentity::FactionScore {
                faction_week,
                faction_id: 2,
            },
            PdaIdentity::FactionRewardVault { faction_config },
            PdaIdentity::FactionRewardManifest { faction_week },
            PdaIdentity::FactionFollowerSnapshot {
                faction_week,
                faction_id: 2,
            },
            PdaIdentity::FactionClaim {
                reward_manifest,
                operator: OPERATOR_A,
            },
        ];
        let program = Pubkey::new_from_array(ECONOMY_PROGRAM);
        for identity in identities {
            let derived = derive_pda(&binding, identity).unwrap();
            let reconstructed = with_pda_signer_seeds(identity, derived.bump, |seeds| {
                Pubkey::create_program_address(seeds, &program).unwrap()
            });
            assert_eq!(reconstructed.to_bytes(), derived.key);
        }
    }

    #[test]
    fn vacant_and_prefunded_targets_execute_exact_system_sequences_and_postimages() {
        let binding = binding();
        let gate = open_gate();
        let payer = crate::native_adapter::authenticate_system_payer(
            &gate,
            &binding,
            NativeAccountObservation {
                key: PAYER,
                owner: system_program::ID.to_bytes(),
                lamports: 500,
                data: &[],
                is_signer: true,
                is_writable: true,
                executable: false,
            },
            PAYER,
        )
        .unwrap();
        let first = create_intent(&gate, &binding, &payer, OPERATOR_A, 0);
        let second = create_intent(&gate, &binding, &payer, OPERATOR_B, 40);
        let batch = seal_atomic_write_batch(&gate, &binding, [first, second]).unwrap();
        let keys = [first.key().into(), second.key().into()];
        let mut payer_lamports = 500;
        let mut payer_data = [];
        let mut first_lamports = 0;
        let mut first_data = [];
        let mut second_lamports = 40;
        let mut second_data = [];
        let system_owner = system_program::ID;
        let first_owner = system_program::ID;
        let second_owner = system_program::ID;
        let native_owner = native_loader::ID;
        let mut system_lamports = 1;
        let mut system_data = [];
        let payer_key = Pubkey::new_from_array(PAYER);
        let payer_info = AccountInfo::new(
            &payer_key,
            true,
            true,
            &mut payer_lamports,
            &mut payer_data,
            &system_owner,
            false,
        );
        let targets = [
            AccountInfo::new(
                &keys[0],
                false,
                true,
                &mut first_lamports,
                &mut first_data,
                &first_owner,
                false,
            ),
            AccountInfo::new(
                &keys[1],
                false,
                true,
                &mut second_lamports,
                &mut second_data,
                &second_owner,
                false,
            ),
        ];
        let system_info = AccountInfo::new(
            &system_program::ID,
            false,
            false,
            &mut system_lamports,
            &mut system_data,
            &native_owner,
            true,
        );
        let mut invoker = MockSystemCpi::default();
        let receipt = execute_create_state_batch_with(
            &gate,
            &binding,
            batch,
            &targets,
            core::slice::from_ref(&payer_info),
            &system_info,
            &mut invoker,
        )
        .unwrap();

        assert_eq!(payer_info.lamports(), 340);
        assert_eq!(targets[0].lamports(), 100);
        assert_eq!(targets[1].lamports(), 100);
        assert_eq!(targets[0].owner.to_bytes(), ECONOMY_PROGRAM);
        assert_eq!(targets[1].owner.to_bytes(), ECONOMY_PROGRAM);
        assert_eq!(
            decode_eligibility_state(&targets[0].try_borrow_data().unwrap())
                .unwrap()
                .wallet,
            OPERATOR_A
        );
        assert_eq!(
            decode_eligibility_state(&targets[1].try_borrow_data().unwrap())
                .unwrap()
                .wallet,
            OPERATOR_B
        );
        assert_eq!(receipt.batch_commitment_sha256(), batch.commitment_sha256());
        assert_eq!(receipt.postimage_sha256().len(), 2);
        assert!(matches!(
            invoker.calls[0],
            MockCall::Create { lamports: 100, .. }
        ));
        assert!(matches!(invoker.calls[1], MockCall::Allocate { .. }));
        assert!(matches!(invoker.calls[2], MockCall::Assign { .. }));
        assert!(matches!(
            invoker.calls[3],
            MockCall::Transfer { lamports: 60, .. }
        ));
    }

    #[test]
    fn forged_system_program_or_stale_payer_fails_before_cpi() {
        let binding = binding();
        let gate = open_gate();
        let authenticated_payer = crate::native_adapter::authenticate_system_payer(
            &gate,
            &binding,
            NativeAccountObservation {
                key: PAYER,
                owner: system_program::ID.to_bytes(),
                lamports: 500,
                data: &[],
                is_signer: true,
                is_writable: true,
                executable: false,
            },
            PAYER,
        )
        .unwrap();
        let intent = create_intent(&gate, &binding, &authenticated_payer, OPERATOR_A, 0);
        let batch = seal_atomic_write_batch(&gate, &binding, [intent]).unwrap();
        let target_key = Pubkey::new_from_array(intent.key());
        let payer_key = Pubkey::new_from_array(PAYER);
        let system_owner = system_program::ID;
        let mut payer_lamports = 499;
        let mut payer_data = [];
        let mut target_lamports = 0;
        let mut target_data = [];
        let target_owner = system_program::ID;
        let native_owner = native_loader::ID;
        let forged_system_key = Pubkey::new_from_array([0x99; 32]);
        let mut system_lamports = 1;
        let mut system_data = [];
        let payer_info = AccountInfo::new(
            &payer_key,
            true,
            true,
            &mut payer_lamports,
            &mut payer_data,
            &system_owner,
            false,
        );
        let target_info = AccountInfo::new(
            &target_key,
            false,
            true,
            &mut target_lamports,
            &mut target_data,
            &target_owner,
            false,
        );
        let forged_system = AccountInfo::new(
            &forged_system_key,
            false,
            false,
            &mut system_lamports,
            &mut system_data,
            &native_owner,
            true,
        );
        let mut invoker = MockSystemCpi::default();
        assert_eq!(
            execute_create_state_batch_with(
                &gate,
                &binding,
                batch,
                core::slice::from_ref(&target_info),
                core::slice::from_ref(&payer_info),
                &forged_system,
                &mut invoker,
            ),
            Err(RuntimeAccountLifecycleError::SystemProgramKeyMismatch)
        );
        assert!(invoker.calls.is_empty());

        let mut real_system_lamports = 1;
        let mut real_system_data = [];
        let real_system = AccountInfo::new(
            &system_program::ID,
            false,
            false,
            &mut real_system_lamports,
            &mut real_system_data,
            &native_owner,
            true,
        );
        assert_eq!(
            execute_create_state_batch_with(
                &gate,
                &binding,
                batch,
                &[target_info],
                &[payer_info],
                &real_system,
                &mut invoker,
            ),
            Err(RuntimeAccountLifecycleError::Native(
                NativeAdapterError::PayerPreimageMismatch
            ))
        );
        assert!(invoker.calls.is_empty());
    }

    #[test]
    fn cpi_error_is_propagated_and_truth_stays_nonactivating() {
        assert_eq!(
            RUNTIME_ACCOUNT_LIFECYCLE_TRUTH,
            RuntimeAccountLifecycleTruth {
                feature_gated: true,
                daily_law_capability_required: true,
                sealed_create_intents_only: true,
                all_preconditions_checked_before_first_cpi: true,
                canonical_internal_pda_signer_seeds_only: true,
                system_create_account_supported: true,
                system_allocate_assign_fund_supported: true,
                sealed_postimage_write_supported: true,
                transaction_rollback_required_after_cpi: true,
                token_cpi_supported: false,
                instruction_abi_frozen: false,
                entrypoint_exposed: false,
                dispatcher_exposed: false,
                any_handler_complete: false,
                mainnet_hold: true,
            }
        );
        assert!(RUNTIME_ACCOUNT_LIFECYCLE_STATUS.contains("MAINNET_HOLD"));

        let binding = binding();
        let gate = open_gate();
        let payer = crate::native_adapter::authenticate_system_payer(
            &gate,
            &binding,
            NativeAccountObservation {
                key: PAYER,
                owner: system_program::ID.to_bytes(),
                lamports: 500,
                data: &[],
                is_signer: true,
                is_writable: true,
                executable: false,
            },
            PAYER,
        )
        .unwrap();
        let intent = create_intent(&gate, &binding, &payer, OPERATOR_A, 0);
        let batch = seal_atomic_write_batch(&gate, &binding, [intent]).unwrap();
        let payer_key = Pubkey::new_from_array(PAYER);
        let target_key = Pubkey::new_from_array(intent.key());
        let system_owner = system_program::ID;
        let target_owner = system_program::ID;
        let native_owner = native_loader::ID;
        let mut payer_lamports = 500;
        let mut payer_data = [];
        let mut target_lamports = 0;
        let mut target_data = [];
        let mut system_lamports = 1;
        let mut system_data = [];
        let payer_info = AccountInfo::new(
            &payer_key,
            true,
            true,
            &mut payer_lamports,
            &mut payer_data,
            &system_owner,
            false,
        );
        let target_info = AccountInfo::new(
            &target_key,
            false,
            true,
            &mut target_lamports,
            &mut target_data,
            &target_owner,
            false,
        );
        let system_info = AccountInfo::new(
            &system_program::ID,
            false,
            false,
            &mut system_lamports,
            &mut system_data,
            &native_owner,
            true,
        );
        let mut invoker = MockSystemCpi {
            calls: Vec::new(),
            fail_at: Some(0),
        };
        assert_eq!(
            execute_create_state_batch_with(
                &gate,
                &binding,
                batch,
                core::slice::from_ref(&target_info),
                core::slice::from_ref(&payer_info),
                &system_info,
                &mut invoker,
            ),
            Err(RuntimeAccountLifecycleError::CpiFailed(
                ProgramError::Custom(91)
            ))
        );
        assert!(invoker.calls.is_empty());
        assert_eq!(payer_info.lamports(), 500);
        assert_eq!(target_info.lamports(), 0);
        assert!(target_info.try_borrow_data().unwrap().is_empty());
        assert_eq!(target_info.owner, &system_program::ID);
    }
}

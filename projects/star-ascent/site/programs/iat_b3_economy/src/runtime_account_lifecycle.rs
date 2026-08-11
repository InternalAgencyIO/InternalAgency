//! Feature-gated execution of sealed B3 PDA account-creation intents.
//!
//! This is an internal lifecycle primitive, not an instruction handler. It
//! Its production entry accepts only an [`AtomicWriteBatch`] sealed by the
//! native adapter after an opaque production-ACTIVE Config capability, validates
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
    derive_pda, prepare_create_state_account, seal_atomic_write_batch,
    validate_atomic_write_preconditions, with_pda_signer_seeds, AtomicWriteBatch,
    CreatePdaLifecycle, NativeAccountObservation, NativeAdapterError, NativeEconomyBinding,
    PdaIdentity, StateWriteIntent, StrictStateValue,
};
use crate::runtime_adapter::{
    authenticate_system_payer_account_info, prepare_create_state_account_info,
    prepare_existing_state_write_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
};
use crate::runtime_write_adapter::{
    execute_production_active_existing_write_batch_account_infos,
    require_completed_ingress_binding, RuntimeWriteAdapterError, RuntimeWriteReceipt,
};
use crate::stake_ingress::CompletedStakeIngress;
use crate::ValidatedDailyLawWrite;
use solana_account_info::AccountInfo;
use solana_cpi::{invoke, invoke_signed};
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;
use solana_rent::Rent;
use solana_sdk_ids::{native_loader, system_program};
use solana_system_interface::instruction as system_instruction;
use solana_sysvar::Sysvar;

pub const RUNTIME_ACCOUNT_LIFECYCLE_STATUS: &str =
    "FEATURE_GATED_SEALED_PDA_SYSTEM_CPI_NO_ABI_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeAccountLifecycleTruth {
    pub feature_gated: bool,
    pub daily_law_capability_required: bool,
    pub production_active_config_capability_required: bool,
    pub sealed_create_intents_only: bool,
    pub all_preconditions_checked_before_first_cpi: bool,
    pub canonical_internal_pda_signer_seeds_only: bool,
    pub system_create_account_supported: bool,
    pub system_allocate_assign_fund_supported: bool,
    pub sealed_postimage_write_supported: bool,
    pub production_completed_ingress_position_lifecycle_boundary_present: bool,
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
        production_active_config_capability_required: true,
        sealed_create_intents_only: true,
        all_preconditions_checked_before_first_cpi: true,
        canonical_internal_pda_signer_seeds_only: true,
        system_create_account_supported: true,
        system_allocate_assign_fund_supported: true,
        sealed_postimage_write_supported: true,
        production_completed_ingress_position_lifecycle_boundary_present: true,
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
    Runtime(RuntimeAdapterError),
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
    ActiveConfigCapabilityMismatch,
    CompletedStakeIngressMismatch,
    InitIfNeededTargetShapeMismatch,
    InitIfNeededPlanMismatch,
    Write(RuntimeWriteAdapterError),
}

impl From<NativeAdapterError> for RuntimeAccountLifecycleError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<RuntimeAdapterError> for RuntimeAccountLifecycleError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<RuntimeWriteAdapterError> for RuntimeAccountLifecycleError {
    fn from(value: RuntimeWriteAdapterError) -> Self {
        Self::Write(value)
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

pub const PRODUCTION_INIT_IF_NEEDED_STATUS: &str =
    "HANDLER_NEUTRAL_EXISTING_OR_VACANT_OR_PREFUNDED_RUNTIME_RENT_CPI_HARNESS_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionInitIfNeededTruth {
    pub handler_neutral: bool,
    pub production_active_config_required: bool,
    pub active_config_admin_payer_required: bool,
    pub exact_system_program_required: bool,
    pub exact_existing_program_owned_cas_path: bool,
    pub exact_vacant_system_owned_create_path: bool,
    pub exact_prefunded_system_owned_allocate_assign_fund_path: bool,
    pub runtime_rent_sysvar_required_for_creation: bool,
    pub target_shape_selected_from_account_facts: bool,
    pub caller_path_selector_accepted: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_INIT_IF_NEEDED_TRUTH: ProductionInitIfNeededTruth =
    ProductionInitIfNeededTruth {
        handler_neutral: true,
        production_active_config_required: true,
        active_config_admin_payer_required: true,
        exact_system_program_required: true,
        exact_existing_program_owned_cas_path: true,
        exact_vacant_system_owned_create_path: true,
        exact_prefunded_system_owned_allocate_assign_fund_path: true,
        runtime_rent_sysvar_required_for_creation: true,
        target_shape_selected_from_account_facts: true,
        caller_path_selector_accepted: false,
        production_dispatcher_exposed: false,
        production_entrypoint_exposed: false,
        any_handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionInitIfNeededPath {
    ExistingCas,
    CreateAccount,
    AllocateAssignAndFund,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PreparedProductionInitIfNeeded {
    path: ProductionInitIfNeededPath,
    payer: [u8; 32],
    rent_minimum_lamports: Option<u64>,
    batch: AtomicWriteBatch<1>,
}

impl PreparedProductionInitIfNeeded {
    pub const fn path(&self) -> ProductionInitIfNeededPath {
        self.path
    }

    pub const fn payer(&self) -> [u8; 32] {
        self.payer
    }

    pub const fn rent_minimum_lamports(&self) -> Option<u64> {
        self.rent_minimum_lamports
    }

    pub const fn batch_commitment_sha256(&self) -> [u8; 32] {
        self.batch.commitment_sha256()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProductionInitIfNeededReceipt {
    ExistingCas(RuntimeWriteReceipt<1>),
    Created(RuntimeAccountLifecycleReceipt<1>),
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

/// Execute a sealed batch for the pinned structural lifecycle rehearsal.
/// Production callers must use
/// [`execute_production_active_create_state_batch_account_infos`].
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

/// Prepare one handler-neutral `init_if_needed` state mutation from observed
/// account facts. Program-owned strict state selects existing-state CAS.
/// System-owned empty state selects canonical PDA creation, and only that path
/// reads the runtime Rent sysvar. No caller-provided path selector is accepted.
#[inline(never)]
#[allow(clippy::too_many_arguments)]
pub fn prepare_production_active_init_if_needed_account_infos(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    payer: &AccountInfo<'_>,
    target: &AccountInfo<'_>,
    system: &AccountInfo<'_>,
    identity: PdaIdentity,
    next: StrictStateValue,
) -> Result<PreparedProductionInitIfNeeded, RuntimeAccountLifecycleError> {
    // Preserve the production prerequisite order before consulting Rent: an
    // unrelated/forged target cannot use the sysvar read to mask a stale Law,
    // Config, admin, or System Program failure.
    require_active_config_capability(gate, active_config, binding)?;
    require_system_program(system)?;
    authenticate_system_payer_account_info(
        gate,
        binding,
        payer,
        active_config.state().config.admin,
    )?;
    if target.owner.to_bytes() == binding.program_id() {
        return prepare_production_active_init_if_needed_with_rent(
            gate,
            active_config,
            binding,
            payer,
            target,
            system,
            identity,
            next,
            None,
        );
    }
    if target.owner.to_bytes() != system_program::ID.to_bytes() {
        return Err(RuntimeAccountLifecycleError::InitIfNeededTargetShapeMismatch);
    }
    let rent = Rent::get().map_err(|_| {
        RuntimeAccountLifecycleError::Runtime(RuntimeAdapterError::RentSysvarUnavailable)
    })?;
    prepare_production_active_init_if_needed_with_rent(
        gate,
        active_config,
        binding,
        payer,
        target,
        system,
        identity,
        next,
        Some(&rent),
    )
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn prepare_production_active_init_if_needed_with_rent(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    payer: &AccountInfo<'_>,
    target: &AccountInfo<'_>,
    system: &AccountInfo<'_>,
    identity: PdaIdentity,
    next: StrictStateValue,
    rent: Option<&Rent>,
) -> Result<PreparedProductionInitIfNeeded, RuntimeAccountLifecycleError> {
    require_active_config_capability(gate, active_config, binding)?;
    require_system_program(system)?;
    let expected_payer = active_config.state().config.admin;
    let authenticated_payer =
        authenticate_system_payer_account_info(gate, binding, payer, expected_payer)?;

    let (path, rent_minimum_lamports, intent) = if target.owner.to_bytes() == binding.program_id() {
        if rent.is_some() {
            return Err(RuntimeAccountLifecycleError::InitIfNeededPlanMismatch);
        }
        let intent =
            prepare_existing_state_write_account_info(gate, binding, target, identity, next)?;
        (ProductionInitIfNeededPath::ExistingCas, None, intent)
    } else if target.owner.to_bytes() == system_program::ID.to_bytes() {
        let rent = rent.ok_or(RuntimeAccountLifecycleError::InitIfNeededPlanMismatch)?;
        let rent_minimum_lamports = rent.minimum_balance(next.kind().account_len());
        let target_lamports = target
            .try_borrow_lamports()
            .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?;
        let target_data = target
            .try_borrow_data()
            .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?;
        let intent = prepare_create_state_account(
            gate,
            binding,
            &authenticated_payer,
            NativeAccountObservation {
                key: target.key.to_bytes(),
                owner: target.owner.to_bytes(),
                lamports: **target_lamports,
                data: &target_data,
                is_signer: target.is_signer,
                is_writable: target.is_writable,
                executable: target.executable,
            },
            identity,
            next,
            rent_minimum_lamports,
        )?;
        let StateWriteIntent::Create(create) = intent else {
            return Err(RuntimeAccountLifecycleError::InitIfNeededPlanMismatch);
        };
        let path = match create.lifecycle() {
            CreatePdaLifecycle::CreateAccount => ProductionInitIfNeededPath::CreateAccount,
            CreatePdaLifecycle::AllocateAssignAndFund => {
                ProductionInitIfNeededPath::AllocateAssignAndFund
            }
        };
        (path, Some(rent_minimum_lamports), intent)
    } else {
        return Err(RuntimeAccountLifecycleError::InitIfNeededTargetShapeMismatch);
    };

    Ok(PreparedProductionInitIfNeeded {
        path,
        payer: authenticated_payer.key(),
        rent_minimum_lamports,
        batch: seal_atomic_write_batch(gate, binding, [intent])?,
    })
}

/// Execute only the path selected by the sealed read-only preparation above.
/// Existing state uses the all-preimages-before-first-write CAS executor;
/// vacant/prefunded state uses the System CPI lifecycle and therefore relies on
/// Solana transaction rollback after the first CPI.
#[inline(never)]
pub fn execute_production_active_init_if_needed_account_infos<'a>(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    prepared: PreparedProductionInitIfNeeded,
    payer: &AccountInfo<'a>,
    target: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
) -> Result<ProductionInitIfNeededReceipt, RuntimeAccountLifecycleError> {
    execute_production_active_init_if_needed_with(
        gate,
        active_config,
        binding,
        prepared,
        payer,
        target,
        system,
        &mut SolanaSystemCpi,
    )
}

#[allow(clippy::too_many_arguments)]
fn execute_production_active_init_if_needed_with<'a>(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    prepared: PreparedProductionInitIfNeeded,
    payer: &AccountInfo<'a>,
    target: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    invoker: &mut impl SystemCpiInvoker,
) -> Result<ProductionInitIfNeededReceipt, RuntimeAccountLifecycleError> {
    require_active_config_capability(gate, active_config, binding)?;
    require_system_program(system)?;
    let expected_payer = active_config.state().config.admin;
    if prepared.payer != expected_payer || payer.key.to_bytes() != expected_payer {
        return Err(RuntimeAccountLifecycleError::InitIfNeededPlanMismatch);
    }
    authenticate_system_payer_account_info(gate, binding, payer, expected_payer)?;

    match (prepared.path, prepared.batch.intents()[0]) {
        (ProductionInitIfNeededPath::ExistingCas, StateWriteIntent::Existing(_)) => {
            if prepared.rent_minimum_lamports.is_some() {
                return Err(RuntimeAccountLifecycleError::InitIfNeededPlanMismatch);
            }
            let receipt = execute_production_active_existing_write_batch_account_infos(
                gate,
                active_config,
                binding,
                prepared.batch,
                core::slice::from_ref(target),
            )?;
            Ok(ProductionInitIfNeededReceipt::ExistingCas(receipt))
        }
        (ProductionInitIfNeededPath::CreateAccount, StateWriteIntent::Create(create))
            if create.lifecycle() == CreatePdaLifecycle::CreateAccount
                && prepared.rent_minimum_lamports == Some(create.rent_minimum_lamports()) =>
        {
            let receipt = execute_production_active_create_state_batch_with(
                gate,
                active_config,
                binding,
                prepared.batch,
                core::slice::from_ref(target),
                core::slice::from_ref(payer),
                system,
                invoker,
            )?;
            Ok(ProductionInitIfNeededReceipt::Created(receipt))
        }
        (ProductionInitIfNeededPath::AllocateAssignAndFund, StateWriteIntent::Create(create))
            if create.lifecycle() == CreatePdaLifecycle::AllocateAssignAndFund
                && prepared.rent_minimum_lamports == Some(create.rent_minimum_lamports()) =>
        {
            let receipt = execute_production_active_create_state_batch_with(
                gate,
                active_config,
                binding,
                prepared.batch,
                core::slice::from_ref(target),
                core::slice::from_ref(payer),
                system,
                invoker,
            )?;
            Ok(ProductionInitIfNeededReceipt::Created(receipt))
        }
        _ => Err(RuntimeAccountLifecycleError::InitIfNeededPlanMismatch),
    }
}

fn require_active_config_capability(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
) -> Result<(), RuntimeAccountLifecycleError> {
    if active_config.program_id() != binding.program_id()
        || active_config.mint() != binding.mint()
        || active_config.key() != binding.config()
        || active_config.law_account_sha256() != gate.law_account_sha256()
        || active_config.law_unix_timestamp() != gate.unix_timestamp()
        || active_config.law_local_day() != gate.local_day()
    {
        return Err(RuntimeAccountLifecycleError::ActiveConfigCapabilityMismatch);
    }
    Ok(())
}

/// Bind a completed retained-V2 stake ingress to the one canonical Position
/// identity that its owner payer may create. This is a structural lifecycle
/// prerequisite only; it allocates nothing and grants no dispatch authority.
pub fn validate_production_completed_ingress_position_lifecycle_binding(
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    completed: &CompletedStakeIngress,
    payer_key: [u8; 32],
) -> Result<PdaIdentity, RuntimeAccountLifecycleError> {
    require_completed_ingress_binding(active_config, binding, completed)
        .map_err(|_| RuntimeAccountLifecycleError::CompletedStakeIngressMismatch)?;
    if completed.position.owner != payer_key {
        return Err(RuntimeAccountLifecycleError::CompletedStakeIngressMismatch);
    }
    let identity = PdaIdentity::Position {
        config: binding.config(),
        operator: completed.position.owner,
        position_id: completed.position.position_id,
    };
    let derived = derive_pda(binding, identity)?;
    if completed.position.bump != derived.bump {
        return Err(RuntimeAccountLifecycleError::CompletedStakeIngressMismatch);
    }
    Ok(identity)
}

/// Create exactly the Position PDA produced by a completed retained-V2 stake
/// ingress. The opaque production-ACTIVE Config and Daily Law capability are
/// checked before payer/target inspection. The payer must be the position
/// owner, the PDA seeds and bump are reconstructed internally, and the sealed
/// postimage is executed through the existing atomic System CPI lifecycle.
/// This remains an internal executor: no instruction ABI, entrypoint, or
/// dispatcher exposes it.
#[inline(never)]
pub fn execute_production_completed_ingress_position_create_account_infos<'a>(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    completed: &CompletedStakeIngress,
    payer: &AccountInfo<'a>,
    position: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
) -> Result<RuntimeAccountLifecycleReceipt<1>, RuntimeAccountLifecycleError> {
    require_active_config_capability(gate, active_config, binding)?;
    let identity = validate_production_completed_ingress_position_lifecycle_binding(
        active_config,
        binding,
        completed,
        payer.key.to_bytes(),
    )?;
    let intent = prepare_create_state_account_info(
        gate,
        binding,
        payer,
        completed.position.owner,
        position,
        identity,
        StrictStateValue::Position(completed.position),
    )?;
    let batch = seal_atomic_write_batch(gate, binding, [intent])?;
    execute_production_active_create_state_batch_account_infos(
        gate,
        active_config,
        binding,
        batch,
        core::slice::from_ref(position),
        core::slice::from_ref(payer),
        system,
    )
}

/// Production-shaped PDA creation path. The opaque Config capability is
/// checked before System Program validation, account-count checks, borrows, or
/// the first CPI, so an inactive/staging/rehearsal Config cannot reach account
/// lifecycle execution.
#[inline(never)]
pub fn execute_production_active_create_state_batch_account_infos<'a, const N: usize>(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    targets: &[AccountInfo<'a>],
    payers: &[AccountInfo<'a>],
    system: &AccountInfo<'a>,
) -> Result<RuntimeAccountLifecycleReceipt<N>, RuntimeAccountLifecycleError> {
    execute_production_active_create_state_batch_with(
        gate,
        active_config,
        binding,
        batch,
        targets,
        payers,
        system,
        &mut SolanaSystemCpi,
    )
}

#[allow(clippy::too_many_arguments)]
fn execute_production_active_create_state_batch_with<'a, const N: usize>(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    targets: &[AccountInfo<'a>],
    payers: &[AccountInfo<'a>],
    system: &AccountInfo<'a>,
    invoker: &mut impl SystemCpiInvoker,
) -> Result<RuntimeAccountLifecycleReceipt<N>, RuntimeAccountLifecycleError> {
    require_active_config_capability(gate, active_config, binding)?;
    execute_create_state_batch_with(gate, binding, batch, targets, payers, system, invoker)
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

pub(crate) fn require_system_program(
    system: &AccountInfo<'_>,
) -> Result<(), RuntimeAccountLifecycleError> {
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
    use crate::stake_ingress::{DelegateSnapshot, SourceTokenState};
    use crate::{
        decode_eligibility_state, encode_config_genesis_state, encode_eligibility_state,
        runtime_adapter::authenticate_production_active_config_account_info, verify_daily_law_open,
        CanonicalDailyLawBinding, ConfigGenesisState, ConfigState, EligibilityState, GenesisPhase,
        LaneState, PositionState, ReadonlyDailyLawAccount, ReadonlyTokenState,
        CONFIG_GENESIS_ACCOUNT_LEN, ECOSYSTEM, ELIGIBILITY_ACCOUNT_LEN, LAW_STATE_LEN,
        LAW_STATE_MAGIC, LAW_STATE_VERSION, LIQUIDITY, MAINNET_SUPPLY, TREASURY,
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
    const ADMIN: [u8; 32] = [0x21; 32];
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

    fn production_active_config(
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
    ) -> RuntimeProductionActiveConfig {
        let state = ConfigGenesisState {
            phase: GenesisPhase::Active,
            config: ConfigState {
                admin: ADMIN,
                mint: MINT,
                token_program: [0x33; 32],
                randomness_program: [0x44; 32],
                stake_token_account: [0x55; 32],
                agency_registry_hash: [0; 32],
                genesis_timestamp: CLOCK_TIMESTAMP - 60,
                expected_supply: MAINNET_SUPPLY,
                staked_principal: 1_000,
                agency_count: 0,
                rehearsal_mode: false,
                active: true,
                lane_mask: 0b1_1110,
                stake_vault_initialized: true,
                bump: binding.config_bump(),
                vault_authority_bump: 202,
            },
        };
        let mut data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
        encode_config_genesis_state(&state, &mut data).unwrap();
        let key = binding.config().into();
        let owner = binding.program_id().into();
        let mut lamports = 1;
        let account = AccountInfo::new(&key, false, false, &mut lamports, &mut data, &owner, false);
        authenticate_production_active_config_account_info(gate, binding, &account).unwrap()
    }

    fn canonical_lane(binding: &NativeEconomyBinding, lane: u8, reserved: u64) -> LaneState {
        let config = binding.config();
        let identity = PdaIdentity::LaneState { config, lane };
        let token = derive_pda(binding, PdaIdentity::LaneToken { config, lane }).unwrap();
        LaneState {
            config,
            token_account: token.key,
            beneficiary: [0xA0 | lane; 32],
            total: 10_000,
            genesis_unlocked: 1_000,
            cliff_week: 0,
            linear_end_week: 104,
            reserved,
            paid: 0,
            principal_claimed: 0,
            lane,
            reward_source: true,
            bump: derive_pda(binding, identity).unwrap().bump,
            token_bump: token.bump,
        }
    }

    fn completed_ingress(
        active_config: &RuntimeProductionActiveConfig,
        binding: &NativeEconomyBinding,
        principal: u64,
    ) -> CompletedStakeIngress {
        let mut config = active_config.state().config;
        config.staked_principal = config.staked_principal.checked_add(principal).unwrap();
        let identity = PdaIdentity::Position {
            config: binding.config(),
            operator: PAYER,
            position_id: 7,
        };
        let position = PositionState {
            config: binding.config(),
            owner: PAYER,
            position_id: 7,
            principal,
            accepted_week: 4,
            first_accrual_week: 5,
            term_weeks: 52,
            annual_rate_bps: 1_000,
            treasury_reserved: 20,
            ecosystem_reserved: 30,
            liquidity_reserved: 40,
            paid: 0,
            settled_mask: 0,
            agency_index: u32::MAX,
            role: 0,
            principal_returned: false,
            closed: false,
            bump: derive_pda(binding, identity).unwrap().bump,
        };
        CompletedStakeIngress {
            config,
            position,
            treasury: canonical_lane(binding, TREASURY, 20),
            ecosystem: canonical_lane(binding, ECOSYSTEM, 30),
            liquidity: canonical_lane(binding, LIQUIDITY, 40),
            source: SourceTokenState {
                token: ReadonlyTokenState {
                    key: [0x91; 32],
                    mint: binding.mint(),
                    owner: PAYER,
                    amount: 10_000,
                },
                delegate: DelegateSnapshot {
                    delegate: None,
                    delegated_amount: 0,
                },
                cpi_guard_locked: false,
            },
            stake: ReadonlyTokenState {
                key: config.stake_token_account,
                mint: binding.mint(),
                owner: derive_pda(
                    binding,
                    PdaIdentity::VaultAuthority {
                        config: binding.config(),
                    },
                )
                .unwrap()
                .key,
                amount: config.staked_principal,
            },
        }
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

    fn eligibility(
        binding: &NativeEconomyBinding,
        wallet: [u8; 32],
        role: u8,
        agency_index: u32,
    ) -> (PdaIdentity, EligibilityState, Vec<u8>) {
        let identity = PdaIdentity::Eligibility {
            config: binding.config(),
            operator: wallet,
        };
        let state = EligibilityState {
            config: binding.config(),
            wallet,
            agency_index,
            role,
            bump: derive_pda(binding, identity).unwrap().bump,
        };
        let mut data = [0u8; ELIGIBILITY_ACCOUNT_LEN];
        encode_eligibility_state(&state, &mut data).unwrap();
        (identity, state, data.to_vec())
    }

    #[test]
    fn init_if_needed_existing_state_uses_cas_without_reading_rent_or_invoking_cpi() {
        let binding = binding();
        let gate = open_gate();
        let active_config = production_active_config(&gate, &binding);
        let (identity, _, mut target_data) = eligibility(&binding, OPERATOR_A, 1, 7);
        let (_, next, _) = eligibility(&binding, OPERATOR_A, 0, u32::MAX);
        let target_key = Pubkey::new_from_array(derive_pda(&binding, identity).unwrap().key);
        let target_owner = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let mut target_lamports = 100;
        let target = AccountInfo::new(
            &target_key,
            false,
            true,
            &mut target_lamports,
            &mut target_data,
            &target_owner,
            false,
        );

        let admin_key = Pubkey::new_from_array(ADMIN);
        let admin_owner = system_program::ID;
        let mut admin_lamports = 1_000_000;
        let mut admin_data = [];
        let admin = AccountInfo::new(
            &admin_key,
            true,
            true,
            &mut admin_lamports,
            &mut admin_data,
            &admin_owner,
            false,
        );
        let native_owner = native_loader::ID;
        let mut system_lamports = 1;
        let mut system_data = [];
        let system = AccountInfo::new(
            &system_program::ID,
            false,
            false,
            &mut system_lamports,
            &mut system_data,
            &native_owner,
            true,
        );

        // The public preparation succeeds on a host without a Rent sysvar,
        // proving the existing branch never consults Rent.
        let prepared = prepare_production_active_init_if_needed_account_infos(
            &gate,
            &active_config,
            &binding,
            &admin,
            &target,
            &system,
            identity,
            StrictStateValue::Eligibility(next),
        )
        .unwrap();
        assert_eq!(prepared.path(), ProductionInitIfNeededPath::ExistingCas);
        assert_eq!(prepared.payer(), ADMIN);
        assert_eq!(prepared.rent_minimum_lamports(), None);

        let mut invoker = MockSystemCpi::default();
        let receipt = execute_production_active_init_if_needed_with(
            &gate,
            &active_config,
            &binding,
            prepared,
            &admin,
            &target,
            &system,
            &mut invoker,
        )
        .unwrap();
        assert!(matches!(
            receipt,
            ProductionInitIfNeededReceipt::ExistingCas(_)
        ));
        assert!(invoker.calls.is_empty());
        assert_eq!(
            decode_eligibility_state(&target.try_borrow_data().unwrap()).unwrap(),
            next
        );
    }

    fn assert_init_if_needed_creation_path(
        current_lamports: u64,
        expected_path: ProductionInitIfNeededPath,
    ) {
        let binding = binding();
        let gate = open_gate();
        let active_config = production_active_config(&gate, &binding);
        let (identity, next, _) = eligibility(&binding, OPERATOR_B, 0, u32::MAX);
        let target_key = Pubkey::new_from_array(derive_pda(&binding, identity).unwrap().key);
        let target_owner = system_program::ID;
        let mut target_lamports = current_lamports;
        let mut target_data = [];
        let target = AccountInfo::new(
            &target_key,
            false,
            true,
            &mut target_lamports,
            &mut target_data,
            &target_owner,
            false,
        );

        let rent = Rent::default();
        let rent_minimum = rent.minimum_balance(ELIGIBILITY_ACCOUNT_LEN);
        let funding_lamports = rent_minimum.saturating_sub(current_lamports);
        let admin_key = Pubkey::new_from_array(ADMIN);
        let admin_owner = system_program::ID;
        let mut admin_lamports = rent_minimum + 1_000_000;
        let initial_admin_lamports = admin_lamports;
        let mut admin_data = [];
        let admin = AccountInfo::new(
            &admin_key,
            true,
            true,
            &mut admin_lamports,
            &mut admin_data,
            &admin_owner,
            false,
        );
        let native_owner = native_loader::ID;
        let mut system_lamports = 1;
        let mut system_data = [];
        let system = AccountInfo::new(
            &system_program::ID,
            false,
            false,
            &mut system_lamports,
            &mut system_data,
            &native_owner,
            true,
        );

        let prepared = prepare_production_active_init_if_needed_with_rent(
            &gate,
            &active_config,
            &binding,
            &admin,
            &target,
            &system,
            identity,
            StrictStateValue::Eligibility(next),
            Some(&rent),
        )
        .unwrap();
        assert_eq!(prepared.path(), expected_path);
        assert_eq!(prepared.rent_minimum_lamports(), Some(rent_minimum));

        let mut invoker = MockSystemCpi::default();
        let receipt = execute_production_active_init_if_needed_with(
            &gate,
            &active_config,
            &binding,
            prepared,
            &admin,
            &target,
            &system,
            &mut invoker,
        )
        .unwrap();
        assert!(matches!(receipt, ProductionInitIfNeededReceipt::Created(_)));
        assert_eq!(target.owner.to_bytes(), ECONOMY_PROGRAM);
        assert_eq!(target.lamports(), current_lamports + funding_lamports);
        assert_eq!(admin.lamports(), initial_admin_lamports - funding_lamports);
        assert_eq!(
            decode_eligibility_state(&target.try_borrow_data().unwrap()).unwrap(),
            next
        );
        match expected_path {
            ProductionInitIfNeededPath::CreateAccount => {
                assert!(matches!(
                    invoker.calls.as_slice(),
                    [MockCall::Create { .. }]
                ));
            }
            ProductionInitIfNeededPath::AllocateAssignAndFund => {
                if funding_lamports == 0 {
                    assert!(matches!(
                        invoker.calls.as_slice(),
                        [MockCall::Allocate { .. }, MockCall::Assign { .. }]
                    ));
                } else {
                    assert!(matches!(
                        invoker.calls.as_slice(),
                        [
                            MockCall::Allocate { .. },
                            MockCall::Assign { .. },
                            MockCall::Transfer { .. }
                        ]
                    ));
                }
            }
            ProductionInitIfNeededPath::ExistingCas => unreachable!(),
        }
    }

    #[test]
    fn init_if_needed_vacant_and_prefunded_paths_use_exact_rent_and_cpi_sequences() {
        let rent_minimum = Rent::default().minimum_balance(ELIGIBILITY_ACCOUNT_LEN);
        assert_init_if_needed_creation_path(0, ProductionInitIfNeededPath::CreateAccount);
        assert_init_if_needed_creation_path(
            rent_minimum / 2,
            ProductionInitIfNeededPath::AllocateAssignAndFund,
        );
        assert_init_if_needed_creation_path(
            rent_minimum + 1,
            ProductionInitIfNeededPath::AllocateAssignAndFund,
        );
    }

    #[test]
    fn init_if_needed_rejects_creation_without_rent_and_unrecognized_target_owners() {
        let binding = binding();
        let gate = open_gate();
        let active_config = production_active_config(&gate, &binding);
        let (identity, next, _) = eligibility(&binding, OPERATOR_A, 0, u32::MAX);
        let target_key = Pubkey::new_from_array(derive_pda(&binding, identity).unwrap().key);
        let mut target_lamports = 0;
        let mut target_data = [];
        let target_owner = system_program::ID;
        let target = AccountInfo::new(
            &target_key,
            false,
            true,
            &mut target_lamports,
            &mut target_data,
            &target_owner,
            false,
        );
        let admin_key = Pubkey::new_from_array(ADMIN);
        let admin_owner = system_program::ID;
        let mut admin_lamports = 1_000_000;
        let mut admin_data = [];
        let admin = AccountInfo::new(
            &admin_key,
            true,
            true,
            &mut admin_lamports,
            &mut admin_data,
            &admin_owner,
            false,
        );
        let native_owner = native_loader::ID;
        let mut system_lamports = 1;
        let mut system_data = [];
        let system = AccountInfo::new(
            &system_program::ID,
            false,
            false,
            &mut system_lamports,
            &mut system_data,
            &native_owner,
            true,
        );
        assert_eq!(
            prepare_production_active_init_if_needed_account_infos(
                &gate,
                &active_config,
                &binding,
                &admin,
                &target,
                &system,
                identity,
                StrictStateValue::Eligibility(next),
            ),
            Err(RuntimeAccountLifecycleError::Runtime(
                RuntimeAdapterError::RentSysvarUnavailable
            ))
        );
        assert_eq!(
            prepare_production_active_init_if_needed_with_rent(
                &gate,
                &active_config,
                &binding,
                &admin,
                &target,
                &system,
                identity,
                StrictStateValue::Eligibility(next),
                None,
            ),
            Err(RuntimeAccountLifecycleError::InitIfNeededPlanMismatch)
        );

        let hostile_owner = Pubkey::new_from_array([0x88; 32]);
        let hostile = AccountInfo::new(
            &target_key,
            false,
            true,
            &mut target_lamports,
            &mut target_data,
            &hostile_owner,
            false,
        );
        assert_eq!(
            prepare_production_active_init_if_needed_account_infos(
                &gate,
                &active_config,
                &binding,
                &admin,
                &hostile,
                &system,
                identity,
                StrictStateValue::Eligibility(next),
            ),
            Err(RuntimeAccountLifecycleError::InitIfNeededTargetShapeMismatch)
        );
    }

    #[test]
    fn init_if_needed_truth_is_handler_neutral_and_unconditionally_held() {
        let truth = PRODUCTION_INIT_IF_NEEDED_TRUTH;
        assert!(truth.handler_neutral);
        assert!(truth.production_active_config_required);
        assert!(truth.active_config_admin_payer_required);
        assert!(truth.exact_system_program_required);
        assert!(truth.exact_existing_program_owned_cas_path);
        assert!(truth.exact_vacant_system_owned_create_path);
        assert!(truth.exact_prefunded_system_owned_allocate_assign_fund_path);
        assert!(truth.runtime_rent_sysvar_required_for_creation);
        assert!(truth.target_shape_selected_from_account_facts);
        assert!(!truth.caller_path_selector_accepted);
        assert!(!truth.production_dispatcher_exposed);
        assert!(!truth.production_entrypoint_exposed);
        assert!(!truth.any_handler_complete);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_INIT_IF_NEEDED_STATUS.contains("MAINNET_HOLD"));
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
        let active_config = production_active_config(&gate, &binding);
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
        let receipt = execute_production_active_create_state_batch_with(
            &gate,
            &active_config,
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
        let active_config = production_active_config(&gate, &binding);
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
            execute_production_active_create_state_batch_with(
                &gate,
                &active_config,
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
            execute_production_active_create_state_batch_with(
                &gate,
                &active_config,
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
    fn completed_ingress_position_lifecycle_binding_is_exact_and_non_authorizing() {
        let binding = binding();
        let gate = open_gate();
        let active_config = production_active_config(&gate, &binding);
        let completed = completed_ingress(&active_config, &binding, 250);
        assert_eq!(
            validate_production_completed_ingress_position_lifecycle_binding(
                &active_config,
                &binding,
                &completed,
                PAYER,
            ),
            Ok(PdaIdentity::Position {
                config: binding.config(),
                operator: PAYER,
                position_id: 7,
            })
        );

        let mut hostile = completed;
        hostile.position.owner = OPERATOR_A;
        assert_eq!(
            validate_production_completed_ingress_position_lifecycle_binding(
                &active_config,
                &binding,
                &hostile,
                PAYER,
            ),
            Err(RuntimeAccountLifecycleError::CompletedStakeIngressMismatch)
        );
        hostile = completed;
        hostile.position.bump ^= 1;
        assert_eq!(
            validate_production_completed_ingress_position_lifecycle_binding(
                &active_config,
                &binding,
                &hostile,
                PAYER,
            ),
            Err(RuntimeAccountLifecycleError::CompletedStakeIngressMismatch)
        );
        hostile = completed;
        hostile.config.agency_count = 1;
        assert_eq!(
            validate_production_completed_ingress_position_lifecycle_binding(
                &active_config,
                &binding,
                &hostile,
                PAYER,
            ),
            Err(RuntimeAccountLifecycleError::CompletedStakeIngressMismatch)
        );
        hostile = completed;
        hostile.stake.owner = binding.config();
        assert_eq!(
            validate_production_completed_ingress_position_lifecycle_binding(
                &active_config,
                &binding,
                &hostile,
                PAYER,
            ),
            Err(RuntimeAccountLifecycleError::CompletedStakeIngressMismatch)
        );
        hostile = completed;
        hostile.stake.amount -= 1;
        assert_eq!(
            validate_production_completed_ingress_position_lifecycle_binding(
                &active_config,
                &binding,
                &hostile,
                PAYER,
            ),
            Err(RuntimeAccountLifecycleError::CompletedStakeIngressMismatch)
        );
    }

    #[test]
    fn cpi_error_is_propagated_and_truth_stays_nonactivating() {
        assert_eq!(
            RUNTIME_ACCOUNT_LIFECYCLE_TRUTH,
            RuntimeAccountLifecycleTruth {
                feature_gated: true,
                daily_law_capability_required: true,
                production_active_config_capability_required: true,
                sealed_create_intents_only: true,
                all_preconditions_checked_before_first_cpi: true,
                canonical_internal_pda_signer_seeds_only: true,
                system_create_account_supported: true,
                system_allocate_assign_fund_supported: true,
                sealed_postimage_write_supported: true,
                production_completed_ingress_position_lifecycle_boundary_present: true,
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
        let active_config = production_active_config(&gate, &binding);
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
        let wrong_binding = NativeEconomyBinding::new([0xE2; 32], MINT).unwrap();
        assert_eq!(
            execute_production_active_create_state_batch_with(
                &gate,
                &active_config,
                &wrong_binding,
                batch,
                core::slice::from_ref(&target_info),
                core::slice::from_ref(&payer_info),
                &system_info,
                &mut invoker,
            ),
            Err(RuntimeAccountLifecycleError::ActiveConfigCapabilityMismatch)
        );
        assert!(invoker.calls.is_empty());
        assert_eq!(
            execute_production_active_create_state_batch_with(
                &gate,
                &active_config,
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

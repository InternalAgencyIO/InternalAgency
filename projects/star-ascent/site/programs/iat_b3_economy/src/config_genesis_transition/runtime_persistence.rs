//! Held Config/Genesis mixed-persistence prerequisite.
//!
//! This module proves one exact local execution algorithm for the retained
//! `Activate` poststate: Config, Treasury, Ecosystem, and Liquidity are
//! existing-account compare-and-swap writes; CoreReward is the exact derived
//! vacant-or-prefunded System lifecycle. The plan remains nonactivating. Its
//! execution guard has no production constructor, no ABI/dispatcher consumes
//! it, and any error after the first System CPI still depends on Solana
//! transaction rollback rather than carrying rollback evidence in the receipt.

extern crate alloc;

use alloc::boxed::Box;
use sha2::{Digest, Sha256};
use solana_account_info::AccountInfo;
use solana_rent::Rent;
use solana_sdk_ids::system_program;

use super::ConfigGenesisActivationPlan;
use crate::genesis_conservation_runtime::AuthenticatedGenesisLaneCapability;
use crate::native_adapter::{
    prepare_existing_state_write_intent, prepare_runtime_rent_create_state_account,
    seal_atomic_write_batch, seal_boxed_atomic_write_batch,
    validate_boxed_atomic_write_preconditions_borrowed, AtomicWriteBatch,
    AuthenticatedStateAccount, AuthenticatedSystemPayer, BoxedAtomicWriteBatch, CreatePdaLifecycle,
    CreateStateAccountIntent, ExistingStateWriteIntent, NativeAccountObservation,
    NativeAdapterError, NativeEconomyBinding, PdaIdentity, StateWriteIntent, StrictStateValue,
};
use crate::runtime_account_lifecycle::{
    execute_create_state_batch_with, require_system_program, RuntimeAccountLifecycleError,
    SolanaSystemCpi, SystemCpiInvoker,
};
use crate::runtime_adapter::{
    authenticate_system_payer_account_info, RuntimeAdapterError,
    RuntimeGenesisStagingWritableConfig,
};
use crate::{
    encode_config_genesis_state, GenesisPhase, ValidatedDailyLawWrite, CONFIG_GENESIS_ACCOUNT_LEN,
    CORE_REWARD_ACCOUNT_LEN,
};

pub const CONFIG_GENESIS_MIXED_PERSISTENCE_DOMAIN: &[u8] =
    b"IAT_B3_CONFIG_GENESIS_MIXED_PERSISTENCE_V1";
const CONFIG_GENESIS_RUNTIME_RENT_DOMAIN: &[u8] = b"IAT_B3_CONFIG_GENESIS_RUNTIME_RENT_V1";
pub const CONFIG_GENESIS_RUNTIME_PERSISTENCE_STATUS: &str =
    "HELD_GUARDED_MIXED_EXISTING_CREATE_EXECUTION_ROLLBACK_EVIDENCE_UNPROVED_NO_ABI_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisRuntimePersistenceTruth {
    pub feature_gated: bool,
    pub distinct_writable_genesis_staging_config_required: bool,
    pub exact_retained_lane_writability_required: bool,
    pub admin_system_payer_and_runtime_rent_required: bool,
    pub vacant_or_prefunded_core_path_derived_from_prestate: bool,
    pub all_existing_borrows_and_preimages_checked_before_first_cpi: bool,
    pub existing_writes_delayed_until_core_lifecycle_success: bool,
    pub post_cpi_transaction_rollback_required: bool,
    pub rollback_evidence_present: bool,
    pub production_execution_guard_constructible: bool,
    pub transition_authorized: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub mainnet_hold: bool,
}

pub const CONFIG_GENESIS_RUNTIME_PERSISTENCE_TRUTH: ConfigGenesisRuntimePersistenceTruth =
    ConfigGenesisRuntimePersistenceTruth {
        feature_gated: true,
        distinct_writable_genesis_staging_config_required: true,
        exact_retained_lane_writability_required: true,
        admin_system_payer_and_runtime_rent_required: true,
        vacant_or_prefunded_core_path_derived_from_prestate: true,
        all_existing_borrows_and_preimages_checked_before_first_cpi: true,
        existing_writes_delayed_until_core_lifecycle_success: true,
        post_cpi_transaction_rollback_required: true,
        rollback_evidence_present: false,
        production_execution_guard_constructible: false,
        transition_authorized: false,
        instruction_abi_frozen: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConfigGenesisRuntimePersistenceError {
    Native(NativeAdapterError),
    Runtime(RuntimeAdapterError),
    Lifecycle(RuntimeAccountLifecycleError),
    ConfigCapabilityMismatch,
    ConfigAccountShapeMismatch,
    ConfigPreimageMismatch,
    LaneCapabilityShapeMismatch,
    CoreRewardPrestateMismatch,
    AccountCollision,
    AccountBorrowFailed,
    CommitmentMismatch,
    PostStateEncodingFailed,
}

impl From<NativeAdapterError> for ConfigGenesisRuntimePersistenceError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<RuntimeAdapterError> for ConfigGenesisRuntimePersistenceError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<RuntimeAccountLifecycleError> for ConfigGenesisRuntimePersistenceError {
    fn from(value: RuntimeAccountLifecycleError) -> Self {
        Self::Lifecycle(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ConfigActivationCas {
    key: [u8; 32],
    owner: [u8; 32],
    expected_preimage_sha256: [u8; 32],
    postimage_sha256: [u8; 32],
    postimage: [u8; CONFIG_GENESIS_ACCOUNT_LEN],
}

/// Opaque held proof that the exact five-account poststate can be coupled to
/// one Config CAS plus one native mixed `[T existing, E existing, L existing,
/// Core create]` seal. Private fields prevent batch substitution.
#[derive(Debug, Eq, PartialEq)]
pub struct HeldConfigGenesisRuntimePersistencePlan {
    config: Box<ConfigActivationCas>,
    mixed_batch: BoxedAtomicWriteBatch<4>,
    core_batch: AtomicWriteBatch<1>,
    runtime_activation_readset_sha256: [u8; 32],
    retained_poststates_sha256: [u8; 32],
    runtime_rent_sha256: [u8; 32],
    rent_minimum_lamports: u64,
    core_reward_lifecycle: CreatePdaLifecycle,
    commitment_sha256: [u8; 32],
}

impl HeldConfigGenesisRuntimePersistencePlan {
    pub const fn runtime_activation_readset_sha256(&self) -> [u8; 32] {
        self.runtime_activation_readset_sha256
    }

    pub const fn retained_poststates_sha256(&self) -> [u8; 32] {
        self.retained_poststates_sha256
    }

    pub const fn runtime_rent_sha256(&self) -> [u8; 32] {
        self.runtime_rent_sha256
    }

    pub const fn rent_minimum_lamports(&self) -> u64 {
        self.rent_minimum_lamports
    }

    pub const fn core_reward_lifecycle(&self) -> CreatePdaLifecycle {
        self.core_reward_lifecycle
    }

    pub const fn mixed_batch_commitment_sha256(&self) -> [u8; 32] {
        self.mixed_batch.commitment_sha256()
    }

    pub const fn core_batch_commitment_sha256(&self) -> [u8; 32] {
        self.core_batch.commitment_sha256()
    }

    pub const fn commitment_sha256(&self) -> [u8; 32] {
        self.commitment_sha256
    }
}

#[cfg(test)]
pub(crate) fn seal_equivalent_owning_mixed_batch_for_test(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    plan: &HeldConfigGenesisRuntimePersistencePlan,
) -> Result<AtomicWriteBatch<4>, ConfigGenesisRuntimePersistenceError> {
    seal_atomic_write_batch(gate, binding, *plan.mixed_batch.intents()).map_err(Into::into)
}

/// Deliberately unconstructable by production code. A future accepted owner
/// policy must introduce a separately reviewed authorization source rather
/// than turning this structural prerequisite into an implicit transition.
#[derive(Debug)]
pub struct ConfigGenesisRuntimePersistenceExecutionGuard {
    _private: (),
}

impl ConfigGenesisRuntimePersistenceExecutionGuard {
    #[cfg(test)]
    pub(crate) const fn for_test() -> Self {
        Self { _private: () }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisRuntimePersistenceReceipt {
    commitment_sha256: [u8; 32],
    mixed_batch_commitment_sha256: [u8; 32],
    postimage_sha256: [[u8; 32]; 5],
}

impl ConfigGenesisRuntimePersistenceReceipt {
    pub const fn commitment_sha256(&self) -> [u8; 32] {
        self.commitment_sha256
    }

    pub const fn mixed_batch_commitment_sha256(&self) -> [u8; 32] {
        self.mixed_batch_commitment_sha256
    }

    pub const fn postimage_sha256(&self) -> &[[u8; 32]; 5] {
        &self.postimage_sha256
    }
}

#[allow(clippy::too_many_arguments)]
#[inline(never)]
pub(crate) fn prepare_held_config_genesis_runtime_persistence_plan(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    staging_config: &RuntimeGenesisStagingWritableConfig,
    plan: Box<ConfigGenesisActivationPlan>,
    runtime_activation_readset_sha256: [u8; 32],
    expected_core_reward_key: [u8; 32],
    expected_core_reward_lamports: u64,
    lanes: &[AuthenticatedGenesisLaneCapability; 4],
    payer: &AccountInfo<'_>,
    core_reward_target: &AccountInfo<'_>,
    system: &AccountInfo<'_>,
    rent: &Rent,
) -> Result<Box<HeldConfigGenesisRuntimePersistencePlan>, ConfigGenesisRuntimePersistenceError> {
    require_system_program(system)?;
    require_staging_config_binding(gate, binding, staging_config, &plan)?;

    let authenticated_payer = authenticate_system_payer_account_info(
        gate,
        binding,
        payer,
        staging_config.state().config.admin,
    )?;
    let AuthenticatedGenesisLaneCapability::Writable(treasury) = &lanes[0] else {
        return Err(ConfigGenesisRuntimePersistenceError::LaneCapabilityShapeMismatch);
    };
    let AuthenticatedGenesisLaneCapability::Writable(ecosystem) = &lanes[1] else {
        return Err(ConfigGenesisRuntimePersistenceError::LaneCapabilityShapeMismatch);
    };
    let AuthenticatedGenesisLaneCapability::Readonly(core_team) = &lanes[2] else {
        return Err(ConfigGenesisRuntimePersistenceError::LaneCapabilityShapeMismatch);
    };
    let AuthenticatedGenesisLaneCapability::Writable(liquidity) = &lanes[3] else {
        return Err(ConfigGenesisRuntimePersistenceError::LaneCapabilityShapeMismatch);
    };
    if !core_team.is_bound_to_gate(gate) {
        return Err(ConfigGenesisRuntimePersistenceError::LaneCapabilityShapeMismatch);
    }

    let config = prepare_config_cas_boxed(staging_config, &plan)?;
    let treasury = prepare_existing_state_write_intent_boxed(
        gate,
        binding,
        treasury,
        StrictStateValue::Lane(plan.treasury),
    )?;
    let ecosystem = prepare_existing_state_write_intent_boxed(
        gate,
        binding,
        ecosystem,
        StrictStateValue::Lane(plan.ecosystem),
    )?;
    let liquidity = prepare_existing_state_write_intent_boxed(
        gate,
        binding,
        liquidity,
        StrictStateValue::Lane(plan.liquidity),
    )?;

    let rent_minimum_lamports = rent.minimum_balance(CORE_REWARD_ACCOUNT_LEN);
    let core = prepare_core_reward_create_intent_boxed(
        gate,
        binding,
        &authenticated_payer,
        &plan,
        core_reward_target,
        expected_core_reward_key,
        expected_core_reward_lamports,
        rent_minimum_lamports,
    )?;
    require_no_cross_domain_collisions(
        config.key,
        authenticated_payer.key(),
        [&treasury, &ecosystem, &liquidity],
        core.key(),
    )?;

    let core_reward_lifecycle = core.lifecycle();
    let mixed_batch = seal_mixed_config_genesis_batch_boxed(
        gate, binding, &treasury, &ecosystem, &liquidity, &core,
    )?;
    let core_batch = seal_core_reward_batch_boxed(gate, binding, &core)?;
    let runtime_rent_sha256 = hash_runtime_rent(rent, rent_minimum_lamports);
    let retained_poststates_sha256 = plan.poststates_sha256();
    let commitment_sha256 = hash_persistence_plan(
        gate,
        &config,
        mixed_batch.commitment_sha256(),
        core_batch.commitment_sha256(),
        runtime_activation_readset_sha256,
        retained_poststates_sha256,
        runtime_rent_sha256,
        rent_minimum_lamports,
        core_reward_lifecycle,
    );
    Ok(Box::new(HeldConfigGenesisRuntimePersistencePlan {
        config,
        mixed_batch,
        core_batch,
        runtime_activation_readset_sha256,
        retained_poststates_sha256,
        runtime_rent_sha256,
        rent_minimum_lamports,
        core_reward_lifecycle,
        commitment_sha256,
    }))
}

#[inline(never)]
fn prepare_config_cas_boxed(
    staging_config: &RuntimeGenesisStagingWritableConfig,
    plan: &ConfigGenesisActivationPlan,
) -> Result<Box<ConfigActivationCas>, ConfigGenesisRuntimePersistenceError> {
    prepare_config_cas(staging_config, plan).map(Box::new)
}

#[inline(never)]
fn prepare_existing_state_write_intent_boxed(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    authenticated: &AuthenticatedStateAccount,
    next: StrictStateValue,
) -> Result<Box<ExistingStateWriteIntent>, ConfigGenesisRuntimePersistenceError> {
    prepare_existing_state_write_intent(gate, binding, authenticated, next)
        .map(Box::new)
        .map_err(Into::into)
}

#[inline(never)]
#[allow(clippy::too_many_arguments)]
fn prepare_core_reward_create_intent_boxed(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    authenticated_payer: &AuthenticatedSystemPayer,
    plan: &ConfigGenesisActivationPlan,
    core_reward_target: &AccountInfo<'_>,
    expected_core_reward_key: [u8; 32],
    expected_core_reward_lamports: u64,
    rent_minimum_lamports: u64,
) -> Result<Box<CreateStateAccountIntent>, ConfigGenesisRuntimePersistenceError> {
    let core_lamports = core_reward_target
        .try_borrow_lamports()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    let core_data = core_reward_target
        .try_borrow_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    let core_observation = native_observation(core_reward_target, **core_lamports, &core_data);
    if core_observation.key != expected_core_reward_key
        || core_observation.lamports != expected_core_reward_lamports
    {
        return Err(ConfigGenesisRuntimePersistenceError::CoreRewardPrestateMismatch);
    }
    let core = prepare_runtime_rent_create_state_account(
        gate,
        binding,
        authenticated_payer,
        core_observation,
        PdaIdentity::CoreReward {
            config: binding.config(),
        },
        StrictStateValue::CoreReward(plan.core_reward),
        rent_minimum_lamports,
    )?;
    drop(core_data);
    drop(core_lamports);
    let StateWriteIntent::Create(core) = core else {
        return Err(ConfigGenesisRuntimePersistenceError::CoreRewardPrestateMismatch);
    };
    Ok(Box::new(core))
}

#[inline(never)]
fn seal_mixed_config_genesis_batch_boxed(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    treasury: &ExistingStateWriteIntent,
    ecosystem: &ExistingStateWriteIntent,
    liquidity: &ExistingStateWriteIntent,
    core: &CreateStateAccountIntent,
) -> Result<BoxedAtomicWriteBatch<4>, ConfigGenesisRuntimePersistenceError> {
    seal_boxed_atomic_write_batch(
        gate,
        binding,
        Box::new([
            StateWriteIntent::Existing(*treasury),
            StateWriteIntent::Existing(*ecosystem),
            StateWriteIntent::Existing(*liquidity),
            StateWriteIntent::Create(*core),
        ]),
    )
    .map_err(Into::into)
}

#[inline(never)]
fn seal_core_reward_batch_boxed(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    core: &CreateStateAccountIntent,
) -> Result<AtomicWriteBatch<1>, ConfigGenesisRuntimePersistenceError> {
    seal_atomic_write_batch(gate, binding, [StateWriteIntent::Create(*core)]).map_err(Into::into)
}

/// Structurally executable boundary retained behind an opaque guard with no
/// production constructor. All five targets and the payer are validated first;
/// Config/T/E/L mutable borrows and live preimages are held before the first
/// CoreReward CPI. Existing bytes are copied only after the complete lifecycle
/// succeeds. A post-CPI error still requires transaction rollback and produces
/// no receipt.
#[inline(never)]
#[allow(clippy::too_many_arguments)]
pub fn execute_held_config_genesis_runtime_persistence_plan<'a>(
    guard: ConfigGenesisRuntimePersistenceExecutionGuard,
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    plan: Box<HeldConfigGenesisRuntimePersistencePlan>,
    config_account: &AccountInfo<'a>,
    lane_accounts: [&AccountInfo<'a>; 3],
    core_reward_target: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
) -> Result<ConfigGenesisRuntimePersistenceReceipt, ConfigGenesisRuntimePersistenceError> {
    let mut invoker = SolanaSystemCpi;
    execute_held_config_genesis_runtime_persistence_plan_with(
        guard,
        gate,
        binding,
        plan,
        config_account,
        lane_accounts,
        core_reward_target,
        payer,
        system,
        &mut invoker,
    )
}

#[cfg(test)]
#[allow(clippy::too_many_arguments)]
pub(crate) fn execute_held_config_genesis_runtime_persistence_plan_with_test_invoker<'a>(
    guard: ConfigGenesisRuntimePersistenceExecutionGuard,
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    plan: Box<HeldConfigGenesisRuntimePersistencePlan>,
    config_account: &AccountInfo<'a>,
    lane_accounts: [&AccountInfo<'a>; 3],
    core_reward_target: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    invoker: &mut impl SystemCpiInvoker,
) -> Result<ConfigGenesisRuntimePersistenceReceipt, ConfigGenesisRuntimePersistenceError> {
    execute_held_config_genesis_runtime_persistence_plan_with(
        guard,
        gate,
        binding,
        plan,
        config_account,
        lane_accounts,
        core_reward_target,
        payer,
        system,
        invoker,
    )
}

#[inline(never)]
#[allow(clippy::too_many_arguments)]
fn execute_held_config_genesis_runtime_persistence_plan_with<'a>(
    _guard: ConfigGenesisRuntimePersistenceExecutionGuard,
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    plan: Box<HeldConfigGenesisRuntimePersistencePlan>,
    config_account: &AccountInfo<'a>,
    lane_accounts: [&AccountInfo<'a>; 3],
    core_reward_target: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    invoker: &mut impl SystemCpiInvoker,
) -> Result<ConfigGenesisRuntimePersistenceReceipt, ConfigGenesisRuntimePersistenceError> {
    validate_held_persistence_plan_and_order(
        gate,
        &plan,
        config_account,
        lane_accounts,
        core_reward_target,
        payer,
        system,
    )?;
    validate_held_persistence_account_preconditions(
        gate,
        binding,
        &plan,
        config_account,
        lane_accounts,
        core_reward_target,
        payer,
    )?;
    execute_held_persistence_after_preflight(
        gate,
        binding,
        &plan,
        config_account,
        lane_accounts,
        core_reward_target,
        payer,
        system,
        invoker,
    )
}

#[inline(never)]
#[allow(clippy::too_many_arguments)]
fn validate_held_persistence_plan_and_order<'a>(
    gate: &ValidatedDailyLawWrite,
    plan: &HeldConfigGenesisRuntimePersistencePlan,
    config_account: &AccountInfo<'a>,
    lane_accounts: [&AccountInfo<'a>; 3],
    core_reward_target: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
) -> Result<(), ConfigGenesisRuntimePersistenceError> {
    require_system_program(system)?;
    require_execution_account_order(
        plan,
        config_account,
        lane_accounts,
        core_reward_target,
        payer,
    )?;
    if plan.commitment_sha256 != recompute_persistence_commitment(gate, plan) {
        return Err(ConfigGenesisRuntimePersistenceError::CommitmentMismatch);
    }
    Ok(())
}

/// Keep the owning mixed batch and all immutable account observations in an
/// isolated SBF frame. Returning `()` proves every borrow and sealed preimage
/// check completed before the executor acquires any mutable existing-account
/// handle or reaches the first System CPI.
#[inline(never)]
#[allow(clippy::too_many_arguments)]
fn validate_held_persistence_account_preconditions<'a>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    plan: &HeldConfigGenesisRuntimePersistencePlan,
    config_account: &AccountInfo<'a>,
    lane_accounts: [&AccountInfo<'a>; 3],
    core_reward_target: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
) -> Result<(), ConfigGenesisRuntimePersistenceError> {
    let config_data = config_account
        .try_borrow_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    let lane_lamports = [
        read_account_lamports(lane_accounts[0])?,
        read_account_lamports(lane_accounts[1])?,
        read_account_lamports(lane_accounts[2])?,
    ];
    let lane_data = Box::new([
        lane_accounts[0]
            .try_borrow_data()
            .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?,
        lane_accounts[1]
            .try_borrow_data()
            .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?,
        lane_accounts[2]
            .try_borrow_data()
            .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?,
    ]);
    let core_lamports = read_account_lamports(core_reward_target)?;
    let core_data = core_reward_target
        .try_borrow_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    let payer_lamports = read_account_lamports(payer)?;
    let payer_data = payer
        .try_borrow_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;

    validate_config_precondition(&plan.config, config_account, &config_data)?;
    let observations = Box::new([
        native_observation(lane_accounts[0], lane_lamports[0], &lane_data[0]),
        native_observation(lane_accounts[1], lane_lamports[1], &lane_data[1]),
        native_observation(lane_accounts[2], lane_lamports[2], &lane_data[2]),
        native_observation(core_reward_target, core_lamports, &core_data),
    ]);
    let payer_observation = Box::new([native_observation(payer, payer_lamports, &payer_data)]);
    let validated = validate_boxed_atomic_write_preconditions_borrowed(
        gate,
        binding,
        &plan.mixed_batch,
        observations.as_ref(),
        payer_observation.as_ref(),
    )?;
    if validated.into_batch().commitment_sha256() != plan.mixed_batch.commitment_sha256() {
        return Err(ConfigGenesisRuntimePersistenceError::CommitmentMismatch);
    }
    drop(payer_observation);
    drop(observations);
    drop(payer_data);
    drop(core_data);
    drop(lane_data);
    drop(config_data);
    Ok(())
}

/// Run the only CPI-bearing phase after the immutable preflight frame has
/// returned. The plan stays heap-owned by the caller; this frame holds only
/// references to its sealed intents plus the four pre-CPI mutable borrows.
#[inline(never)]
#[allow(clippy::too_many_arguments)]
fn execute_held_persistence_after_preflight<'a>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    plan: &HeldConfigGenesisRuntimePersistencePlan,
    config_account: &AccountInfo<'a>,
    lane_accounts: [&AccountInfo<'a>; 3],
    core_reward_target: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    invoker: &mut impl SystemCpiInvoker,
) -> Result<ConfigGenesisRuntimePersistenceReceipt, ConfigGenesisRuntimePersistenceError> {
    // Acquire and retain every existing-account mutable borrow before the
    // first CPI, then revalidate all four live preimages while no existing byte
    // has changed.
    let mut config_data = config_account
        .try_borrow_mut_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    let mut treasury_data = lane_accounts[0]
        .try_borrow_mut_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    let mut ecosystem_data = lane_accounts[1]
        .try_borrow_mut_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    let mut liquidity_data = lane_accounts[2]
        .try_borrow_mut_data()
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)?;
    validate_config_precondition(&plan.config, config_account, &config_data)?;
    let intents = plan.mixed_batch.intents();
    let [StateWriteIntent::Existing(treasury), StateWriteIntent::Existing(ecosystem), StateWriteIntent::Existing(liquidity), StateWriteIntent::Create(core)] =
        intents
    else {
        return Err(ConfigGenesisRuntimePersistenceError::CommitmentMismatch);
    };
    validate_existing_live_preimage(treasury, lane_accounts[0], &treasury_data)?;
    validate_existing_live_preimage(ecosystem, lane_accounts[1], &ecosystem_data)?;
    validate_existing_live_preimage(liquidity, lane_accounts[2], &liquidity_data)?;

    let lifecycle_receipt = execute_create_state_batch_with(
        gate,
        binding,
        plan.core_batch,
        core::slice::from_ref(core_reward_target),
        core::slice::from_ref(payer),
        system,
        invoker,
    )?;
    if lifecycle_receipt.batch_commitment_sha256() != plan.core_batch.commitment_sha256()
        || lifecycle_receipt.postimage_sha256()[0] != core.postimage_sha256()
    {
        return Err(ConfigGenesisRuntimePersistenceError::CommitmentMismatch);
    }

    // These four fixed-length copies are the first existing-account mutations.
    config_data.copy_from_slice(&plan.config.postimage);
    treasury_data.copy_from_slice(treasury.postimage());
    ecosystem_data.copy_from_slice(ecosystem.postimage());
    liquidity_data.copy_from_slice(liquidity.postimage());

    Ok(ConfigGenesisRuntimePersistenceReceipt {
        commitment_sha256: plan.commitment_sha256,
        mixed_batch_commitment_sha256: plan.mixed_batch.commitment_sha256(),
        postimage_sha256: [
            plan.config.postimage_sha256,
            treasury.postimage_sha256(),
            ecosystem.postimage_sha256(),
            liquidity.postimage_sha256(),
            core.postimage_sha256(),
        ],
    })
}

fn require_staging_config_binding(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    config: &RuntimeGenesisStagingWritableConfig,
    plan: &ConfigGenesisActivationPlan,
) -> Result<(), ConfigGenesisRuntimePersistenceError> {
    if config.key() != binding.config()
        || config.program_id() != binding.program_id()
        || config.mint() != binding.mint()
        || config.state().phase != GenesisPhase::GenesisStaging
        || config.state().config.active
        || config.preimage_sha256() != plan.current_config_sha256()
        || config.law_account_sha256() != gate.law_account_sha256()
        || config.law_unix_timestamp() != gate.unix_timestamp()
        || config.law_local_day() != gate.local_day()
        || plan.law_account_sha256() != gate.law_account_sha256()
        || plan.config_key != config.key()
    {
        return Err(ConfigGenesisRuntimePersistenceError::ConfigCapabilityMismatch);
    }
    Ok(())
}

fn prepare_config_cas(
    staging_config: &RuntimeGenesisStagingWritableConfig,
    plan: &ConfigGenesisActivationPlan,
) -> Result<ConfigActivationCas, ConfigGenesisRuntimePersistenceError> {
    let mut postimage = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&plan.config, &mut postimage)
        .map_err(|_| ConfigGenesisRuntimePersistenceError::PostStateEncodingFailed)?;
    Ok(ConfigActivationCas {
        key: staging_config.key(),
        owner: staging_config.program_id(),
        expected_preimage_sha256: staging_config.preimage_sha256(),
        postimage_sha256: sha256(&postimage),
        postimage,
    })
}

fn require_no_cross_domain_collisions(
    config: [u8; 32],
    payer: [u8; 32],
    existing: [&ExistingStateWriteIntent; 3],
    core: [u8; 32],
) -> Result<(), ConfigGenesisRuntimePersistenceError> {
    let keys = [
        config,
        payer,
        existing[0].key(),
        existing[1].key(),
        existing[2].key(),
        core,
    ];
    for left in 0..keys.len() {
        for right in (left + 1)..keys.len() {
            if keys[left] == keys[right] {
                return Err(ConfigGenesisRuntimePersistenceError::AccountCollision);
            }
        }
    }
    Ok(())
}

fn require_execution_account_order(
    plan: &HeldConfigGenesisRuntimePersistencePlan,
    config: &AccountInfo<'_>,
    lanes: [&AccountInfo<'_>; 3],
    core: &AccountInfo<'_>,
    payer: &AccountInfo<'_>,
) -> Result<(), ConfigGenesisRuntimePersistenceError> {
    let intents = plan.mixed_batch.intents();
    let expected = [
        plan.config.key,
        intents[0].key(),
        intents[1].key(),
        intents[2].key(),
        intents[3].key(),
    ];
    let observed = [
        config.key.to_bytes(),
        lanes[0].key.to_bytes(),
        lanes[1].key.to_bytes(),
        lanes[2].key.to_bytes(),
        core.key.to_bytes(),
    ];
    if expected != observed
        || observed.contains(&payer.key.to_bytes())
        || core.key.to_bytes() == payer.key.to_bytes()
    {
        return Err(ConfigGenesisRuntimePersistenceError::AccountCollision);
    }
    Ok(())
}

fn validate_config_precondition(
    expected: &ConfigActivationCas,
    account: &AccountInfo<'_>,
    data: &[u8],
) -> Result<(), ConfigGenesisRuntimePersistenceError> {
    if account.key.to_bytes() != expected.key
        || account.owner.to_bytes() != expected.owner
        || !account.is_writable
        || account.is_signer
        || account.executable
        || data.len() != CONFIG_GENESIS_ACCOUNT_LEN
    {
        return Err(ConfigGenesisRuntimePersistenceError::ConfigAccountShapeMismatch);
    }
    if sha256(data) != expected.expected_preimage_sha256 {
        return Err(ConfigGenesisRuntimePersistenceError::ConfigPreimageMismatch);
    }
    Ok(())
}

fn validate_existing_live_preimage(
    intent: &ExistingStateWriteIntent,
    account: &AccountInfo<'_>,
    data: &[u8],
) -> Result<(), ConfigGenesisRuntimePersistenceError> {
    if account.key.to_bytes() != intent.key()
        || !account.is_writable
        || account.is_signer
        || account.executable
        || data.len() != intent.data_len()
        || sha256(data) != intent.expected_preimage_sha256()
    {
        return Err(ConfigGenesisRuntimePersistenceError::ConfigPreimageMismatch);
    }
    Ok(())
}

fn native_observation<'a>(
    account: &AccountInfo<'_>,
    lamports: u64,
    data: &'a [u8],
) -> NativeAccountObservation<'a> {
    NativeAccountObservation {
        key: account.key.to_bytes(),
        owner: account.owner.to_bytes(),
        lamports,
        data,
        is_signer: account.is_signer,
        is_writable: account.is_writable,
        executable: account.executable,
    }
}

fn read_account_lamports(
    account: &AccountInfo<'_>,
) -> Result<u64, ConfigGenesisRuntimePersistenceError> {
    account
        .try_borrow_lamports()
        .map(|lamports| **lamports)
        .map_err(|_| ConfigGenesisRuntimePersistenceError::AccountBorrowFailed)
}

#[allow(deprecated)]
fn hash_runtime_rent(rent: &Rent, minimum_balance: u64) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(CONFIG_GENESIS_RUNTIME_RENT_DOMAIN);
    hash.update((CORE_REWARD_ACCOUNT_LEN as u64).to_le_bytes());
    hash.update(rent.lamports_per_byte_year.to_le_bytes());
    hash.update(rent.exemption_threshold.to_bits().to_le_bytes());
    hash.update([rent.burn_percent]);
    hash.update(minimum_balance.to_le_bytes());
    debug_assert_eq!(
        minimum_balance,
        rent.minimum_balance(CORE_REWARD_ACCOUNT_LEN)
    );
    hash.finalize().into()
}

#[allow(clippy::too_many_arguments)]
fn hash_persistence_plan(
    gate: &ValidatedDailyLawWrite,
    config: &ConfigActivationCas,
    mixed_batch_commitment_sha256: [u8; 32],
    core_batch_commitment_sha256: [u8; 32],
    runtime_activation_readset_sha256: [u8; 32],
    retained_poststates_sha256: [u8; 32],
    runtime_rent_sha256: [u8; 32],
    rent_minimum_lamports: u64,
    core_reward_lifecycle: CreatePdaLifecycle,
) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(CONFIG_GENESIS_MIXED_PERSISTENCE_DOMAIN);
    hash.update(gate.unix_timestamp().to_le_bytes());
    hash.update(gate.local_day().to_le_bytes());
    hash.update(gate.law_program_id());
    hash.update(gate.law_state_address());
    hash.update([gate.law_state_bump()]);
    hash.update(gate.mint());
    hash.update(gate.network_genesis_hash());
    hash.update(gate.law_account_sha256());
    hash.update(runtime_activation_readset_sha256);
    hash.update(retained_poststates_sha256);
    hash.update(config.key);
    hash.update(config.owner);
    hash.update((CONFIG_GENESIS_ACCOUNT_LEN as u64).to_le_bytes());
    hash.update(config.expected_preimage_sha256);
    hash.update(config.postimage_sha256);
    hash.update(mixed_batch_commitment_sha256);
    hash.update(core_batch_commitment_sha256);
    hash.update(system_program::ID.to_bytes());
    hash.update(runtime_rent_sha256);
    hash.update(rent_minimum_lamports.to_le_bytes());
    hash.update([core_reward_lifecycle as u8]);
    hash.finalize().into()
}

fn recompute_persistence_commitment(
    gate: &ValidatedDailyLawWrite,
    plan: &HeldConfigGenesisRuntimePersistencePlan,
) -> [u8; 32] {
    hash_persistence_plan(
        gate,
        &plan.config,
        plan.mixed_batch.commitment_sha256(),
        plan.core_batch.commitment_sha256(),
        plan.runtime_activation_readset_sha256,
        plan.retained_poststates_sha256,
        plan.runtime_rent_sha256,
        plan.rent_minimum_lamports,
        plan.core_reward_lifecycle,
    )
}

fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

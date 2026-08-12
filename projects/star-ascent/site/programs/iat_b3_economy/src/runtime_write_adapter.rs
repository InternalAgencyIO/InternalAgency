//! Feature-gated execution of already-authenticated existing-state CAS writes.
//!
//! This is a narrow internal write primitive, not an instruction handler. It
//! accepts only an [`AtomicWriteBatch`] created by the strict native adapter,
//! validates the exact Daily-Law capability and every account preimage, then
//! acquires every mutable data borrow and revalidates every preimage before it
//! writes any byte. Account creation, lamport mutation, CPI, instruction
//! decoding, dispatch, and public entrypoints remain absent.

extern crate alloc;

use alloc::vec::Vec;
use core::array;

#[cfg(not(target_os = "solana"))]
use crate::native_adapter::seal_atomic_write_batch;
use crate::native_adapter::{
    derive_pda, prepare_existing_state_write_intent, seal_existing_write_batch_borrowed,
    validate_atomic_write_preconditions, validate_existing_write_preconditions_borrowed,
    AtomicWriteBatch, BorrowedExistingWriteBatch, ExistingStateWriteIntent,
    NativeAccountObservation, NativeAdapterError, NativeEconomyBinding, PdaIdentity,
    StateWriteIntent, StrictStateValue,
};
use crate::runtime_adapter::{
    authenticate_state_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
};
use crate::stake_ingress::CompletedStakeIngress;
use crate::{
    decode_config_genesis_state, encode_config_genesis_state, GenesisPhase, ValidatedDailyLawWrite,
    CONFIG_GENESIS_ACCOUNT_LEN, ECOSYSTEM, LIQUIDITY, TREASURY,
};
use sha2::{Digest, Sha256};
use solana_account_info::AccountInfo;

pub const RUNTIME_WRITE_ADAPTER_STATUS: &str =
    "FEATURE_GATED_EXISTING_STATE_CAS_BATCH_WRITES_NO_CPI_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeWriteAdapterTruth {
    pub feature_gated: bool,
    pub daily_law_capability_required: bool,
    pub production_active_config_capability_required: bool,
    pub authenticated_existing_state_only: bool,
    pub all_mutable_borrows_acquired_before_write: bool,
    pub all_preimages_revalidated_before_write: bool,
    pub account_data_writes_supported: bool,
    pub production_active_config_stake_principal_cas_supported: bool,
    pub production_completed_ingress_lane_account_preflight_supported: bool,
    pub production_completed_ingress_config_and_lanes_atomic_cas_supported: bool,
    pub account_creation_supported: bool,
    pub lamport_writes_supported: bool,
    pub system_cpi_supported: bool,
    pub token_cpi_supported: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const RUNTIME_WRITE_ADAPTER_TRUTH: RuntimeWriteAdapterTruth = RuntimeWriteAdapterTruth {
    feature_gated: true,
    daily_law_capability_required: true,
    production_active_config_capability_required: true,
    authenticated_existing_state_only: true,
    all_mutable_borrows_acquired_before_write: true,
    all_preimages_revalidated_before_write: true,
    account_data_writes_supported: true,
    production_active_config_stake_principal_cas_supported: true,
    production_completed_ingress_lane_account_preflight_supported: true,
    production_completed_ingress_config_and_lanes_atomic_cas_supported: true,
    account_creation_supported: false,
    lamport_writes_supported: false,
    system_cpi_supported: false,
    token_cpi_supported: false,
    instruction_abi_frozen: false,
    entrypoint_exposed: false,
    dispatcher_exposed: false,
    any_handler_complete: false,
    mainnet_hold: true,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeWriteAdapterError {
    Native(NativeAdapterError),
    Runtime(RuntimeAdapterError),
    AccountCountMismatch,
    CreateIntentUnsupported,
    AccountBorrowFailed,
    PostValidationPreimageMismatch,
    ActiveConfigCapabilityMismatch,
    ConfigAccountIdentityMismatch,
    ConfigAccountFlagsMismatch,
    ConfigAccountLengthMismatch,
    ConfigPreimageMismatch,
    ConfigStateMismatch,
    ConfigPrincipalOverflow,
    CompletedStakeIngressMismatch,
    ConfigCodecRejected,
    PreparedWriteIncomplete,
}

impl From<NativeAdapterError> for RuntimeWriteAdapterError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<RuntimeAdapterError> for RuntimeWriteAdapterError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeWriteReceipt<const N: usize> {
    batch_commitment_sha256: [u8; 32],
    postimage_sha256: [[u8; 32]; N],
}

impl<const N: usize> RuntimeWriteReceipt<N> {
    pub const fn batch_commitment_sha256(&self) -> [u8; 32] {
        self.batch_commitment_sha256
    }

    pub const fn postimage_sha256(&self) -> &[[u8; 32]; N] {
        &self.postimage_sha256
    }
}

/// Receipt for the only Config mutation admitted by this adapter: a checked,
/// non-zero increase of retained V2 `staked_principal` on the exact
/// authenticated ACTIVE Config preimage. It is not handler, CPI, deployment,
/// release, or Mainnet evidence.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionActiveConfigStakePrincipalReceipt {
    config_key: [u8; 32],
    expected_preimage_sha256: [u8; 32],
    postimage_sha256: [u8; 32],
    previous_staked_principal: u64,
    next_staked_principal: u64,
    law_account_sha256: [u8; 32],
}

impl ProductionActiveConfigStakePrincipalReceipt {
    pub const fn config_key(&self) -> [u8; 32] {
        self.config_key
    }

    pub const fn expected_preimage_sha256(&self) -> [u8; 32] {
        self.expected_preimage_sha256
    }

    pub const fn postimage_sha256(&self) -> [u8; 32] {
        self.postimage_sha256
    }

    pub const fn previous_staked_principal(&self) -> u64 {
        self.previous_staked_principal
    }

    pub const fn next_staked_principal(&self) -> u64 {
        self.next_staked_principal
    }

    pub const fn law_account_sha256(&self) -> [u8; 32] {
        self.law_account_sha256
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionActiveIngressLedgerReceipt {
    config: ProductionActiveConfigStakePrincipalReceipt,
    lanes: RuntimeWriteReceipt<3>,
}

impl ProductionActiveIngressLedgerReceipt {
    pub const fn config(&self) -> &ProductionActiveConfigStakePrincipalReceipt {
        &self.config
    }

    pub const fn lanes(&self) -> &RuntimeWriteReceipt<3> {
        &self.lanes
    }
}

struct PreparedConfigStakePrincipalCas {
    postimage: [u8; CONFIG_GENESIS_ACCOUNT_LEN],
    receipt: ProductionActiveConfigStakePrincipalReceipt,
}

struct PreparedCompletedIngressLaneWrites {
    treasury: Option<ExistingStateWriteIntent>,
    ecosystem: Option<ExistingStateWriteIntent>,
    liquidity: Option<ExistingStateWriteIntent>,
}

impl PreparedCompletedIngressLaneWrites {
    const fn empty() -> Self {
        Self {
            treasury: None,
            ecosystem: None,
            liquidity: None,
        }
    }
}

fn require_active_config_capability(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
) -> Result<(), RuntimeWriteAdapterError> {
    if active_config.program_id() != binding.program_id()
        || active_config.mint() != binding.mint()
        || active_config.key() != binding.config()
        || active_config.law_account_sha256() != gate.law_account_sha256()
        || active_config.law_unix_timestamp() != gate.unix_timestamp()
        || active_config.law_local_day() != gate.local_day()
        || active_config.state().phase != GenesisPhase::Active
        || !active_config.state().config.active
    {
        return Err(RuntimeWriteAdapterError::ActiveConfigCapabilityMismatch);
    }
    Ok(())
}

pub(crate) fn require_completed_ingress_binding(
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    completed: &CompletedStakeIngress,
) -> Result<u64, RuntimeWriteAdapterError> {
    let vault_authority = derive_pda(
        binding,
        PdaIdentity::VaultAuthority {
            config: binding.config(),
        },
    )?;
    let principal_delta = completed.position.principal;
    let next_staked_principal = active_config
        .state()
        .config
        .staked_principal
        .checked_add(principal_delta)
        .ok_or(RuntimeWriteAdapterError::ConfigPrincipalOverflow)?;
    let mut expected_config = active_config.state().config;
    expected_config.staked_principal = next_staked_principal;
    if principal_delta == 0
        || completed.config != expected_config
        || completed.position.config != binding.config()
        || completed.treasury.config != binding.config()
        || completed.ecosystem.config != binding.config()
        || completed.liquidity.config != binding.config()
        || completed.treasury.lane != TREASURY
        || completed.ecosystem.lane != ECOSYSTEM
        || completed.liquidity.lane != LIQUIDITY
        || completed.stake.key != active_config.state().config.stake_token_account
        || completed.stake.mint != binding.mint()
        || completed.stake.owner != vault_authority.key
        || completed.stake.amount != next_staked_principal
    {
        return Err(RuntimeWriteAdapterError::CompletedStakeIngressMismatch);
    }
    Ok(principal_delta)
}

/// Host/rehearsal-only owning preflight for the exact treasury, ecosystem, and
/// liquidity AccountInfos. It seals their completed-ingress postimages before
/// any persistence mutation, and the fixed account order is part of this
/// boundary. The SBF production executor uses the equivalent borrowed-intent
/// path below; this helper neither executes writes nor completes the handler.
#[cfg(not(target_os = "solana"))]
#[inline(never)]
pub fn prepare_production_completed_ingress_lane_write_batch_account_infos(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    completed: &CompletedStakeIngress,
    lane_accounts: [&AccountInfo<'_>; 3],
) -> Result<AtomicWriteBatch<3>, RuntimeWriteAdapterError> {
    let mut prepared = PreparedCompletedIngressLaneWrites::empty();
    prepare_completed_ingress_lane_writes(
        gate,
        active_config,
        binding,
        completed,
        lane_accounts,
        &mut prepared,
    )?;
    let treasury = prepared
        .treasury
        .take()
        .ok_or(RuntimeWriteAdapterError::PreparedWriteIncomplete)?;
    let ecosystem = prepared
        .ecosystem
        .take()
        .ok_or(RuntimeWriteAdapterError::PreparedWriteIncomplete)?;
    let liquidity = prepared
        .liquidity
        .take()
        .ok_or(RuntimeWriteAdapterError::PreparedWriteIncomplete)?;
    seal_atomic_write_batch(
        gate,
        binding,
        [
            StateWriteIntent::Existing(treasury),
            StateWriteIntent::Existing(ecosystem),
            StateWriteIntent::Existing(liquidity),
        ],
    )
    .map_err(RuntimeWriteAdapterError::Native)
}

#[inline(never)]
fn prepare_completed_ingress_lane_writes(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    completed: &CompletedStakeIngress,
    lane_accounts: [&AccountInfo<'_>; 3],
    prepared: &mut PreparedCompletedIngressLaneWrites,
) -> Result<(), RuntimeWriteAdapterError> {
    require_active_config_capability(gate, active_config, binding)?;
    require_completed_ingress_binding(active_config, binding, completed)?;
    let config = binding.config();
    prepared.treasury = Some(prepare_existing_lane_write_intent(
        gate,
        binding,
        lane_accounts[0],
        config,
        TREASURY,
        completed.treasury,
    )?);
    prepared.ecosystem = Some(prepare_existing_lane_write_intent(
        gate,
        binding,
        lane_accounts[1],
        config,
        ECOSYSTEM,
        completed.ecosystem,
    )?);
    prepared.liquidity = Some(prepare_existing_lane_write_intent(
        gate,
        binding,
        lane_accounts[2],
        config,
        LIQUIDITY,
        completed.liquidity,
    )?);
    Ok(())
}

#[inline(never)]
fn prepare_existing_lane_write_intent(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
    lane: u8,
    next: crate::LaneState,
) -> Result<ExistingStateWriteIntent, RuntimeWriteAdapterError> {
    let authenticated = authenticate_state_account_info(
        gate,
        binding,
        account,
        PdaIdentity::LaneState { config, lane },
    )?;
    prepare_existing_state_write_intent(gate, binding, &authenticated, StrictStateValue::Lane(next))
        .map_err(RuntimeWriteAdapterError::Native)
}

/// Bind the narrow Config CAS to the exact retained-V2 post-CPI completion.
/// The completed Config must equal the authenticated ACTIVE Config with only
/// `staked_principal += position.principal`; the three reward lanes, position,
/// and reloaded stake-vault token state must all remain binding-relative.
#[inline(never)]
pub fn execute_production_active_config_stake_principal_cas_for_completed_ingress(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    completed: &CompletedStakeIngress,
    config_account: &AccountInfo<'_>,
) -> Result<ProductionActiveConfigStakePrincipalReceipt, RuntimeWriteAdapterError> {
    require_active_config_capability(gate, active_config, binding)?;
    let principal_delta = require_completed_ingress_binding(active_config, binding, completed)?;
    let prepared = prepare_production_active_config_stake_principal_cas_inner(
        gate,
        active_config,
        binding,
        principal_delta,
        config_account,
    )?;
    let mut mutable_data = config_account
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    require_live_preimage(
        &mutable_data,
        CONFIG_GENESIS_ACCOUNT_LEN,
        active_config.preimage_sha256(),
    )?;
    mutable_data.copy_from_slice(&prepared.postimage);
    Ok(prepared.receipt)
}

/// Execute Config plus treasury/ecosystem/liquidity postimages as one local
/// atomic CAS boundary. All four mutable borrows and every live preimage check
/// complete before the first byte is copied.
#[inline(never)]
pub fn execute_production_completed_ingress_config_and_lanes_cas_account_infos(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    completed: &CompletedStakeIngress,
    config_account: &AccountInfo<'_>,
    lane_accounts: [&AccountInfo<'_>; 3],
) -> Result<ProductionActiveIngressLedgerReceipt, RuntimeWriteAdapterError> {
    let mut lanes = PreparedCompletedIngressLaneWrites::empty();
    prepare_completed_ingress_lane_writes(
        gate,
        active_config,
        binding,
        completed,
        lane_accounts,
        &mut lanes,
    )?;
    let principal_delta = require_completed_ingress_binding(active_config, binding, completed)?;
    let mut config = None;
    prepare_production_active_config_stake_principal_cas_into(
        gate,
        active_config,
        binding,
        principal_delta,
        config_account,
        &mut config,
    )?;
    let config = config
        .as_ref()
        .ok_or(RuntimeWriteAdapterError::PreparedWriteIncomplete)?;
    let treasury = lanes
        .treasury
        .as_ref()
        .ok_or(RuntimeWriteAdapterError::PreparedWriteIncomplete)?;
    let ecosystem = lanes
        .ecosystem
        .as_ref()
        .ok_or(RuntimeWriteAdapterError::PreparedWriteIncomplete)?;
    let liquidity = lanes
        .liquidity
        .as_ref()
        .ok_or(RuntimeWriteAdapterError::PreparedWriteIncomplete)?;
    let lane_batch =
        seal_existing_write_batch_borrowed(gate, binding, [treasury, ecosystem, liquidity])?;
    execute_prepared_completed_ingress_config_and_lanes(
        active_config,
        config,
        lane_batch,
        config_account,
        lane_accounts,
    )
}

#[inline(never)]
fn execute_prepared_completed_ingress_config_and_lanes(
    active_config: &RuntimeProductionActiveConfig,
    config: &PreparedConfigStakePrincipalCas,
    lane_batch: BorrowedExistingWriteBatch<'_, 3>,
    config_account: &AccountInfo<'_>,
    lane_accounts: [&AccountInfo<'_>; 3],
) -> Result<ProductionActiveIngressLedgerReceipt, RuntimeWriteAdapterError> {
    let mut config_data = config_account
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let mut treasury_data = lane_accounts[0]
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let mut ecosystem_data = lane_accounts[1]
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let mut liquidity_data = lane_accounts[2]
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    require_live_preimage(
        &config_data,
        CONFIG_GENESIS_ACCOUNT_LEN,
        active_config.preimage_sha256(),
    )?;
    let intents = lane_batch.intents();
    require_existing_live_preimage(&treasury_data, intents[0])?;
    require_existing_live_preimage(&ecosystem_data, intents[1])?;
    require_existing_live_preimage(&liquidity_data, intents[2])?;

    config_data.copy_from_slice(&config.postimage);
    treasury_data.copy_from_slice(intents[0].postimage());
    ecosystem_data.copy_from_slice(intents[1].postimage());
    liquidity_data.copy_from_slice(intents[2].postimage());

    Ok(ProductionActiveIngressLedgerReceipt {
        config: config.receipt,
        lanes: RuntimeWriteReceipt {
            batch_commitment_sha256: lane_batch.commitment_sha256(),
            postimage_sha256: [
                intents[0].postimage_sha256(),
                intents[1].postimage_sha256(),
                intents[2].postimage_sha256(),
            ],
        },
    })
}

#[inline(never)]
fn prepare_production_active_config_stake_principal_cas_into(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    principal_delta: u64,
    config_account: &AccountInfo<'_>,
    prepared: &mut Option<PreparedConfigStakePrincipalCas>,
) -> Result<(), RuntimeWriteAdapterError> {
    *prepared = Some(prepare_production_active_config_stake_principal_cas_inner(
        gate,
        active_config,
        binding,
        principal_delta,
        config_account,
    )?);
    Ok(())
}

fn require_live_preimage(
    data: &[u8],
    expected_len: usize,
    expected_sha256: [u8; 32],
) -> Result<(), RuntimeWriteAdapterError> {
    if data.len() != expected_len || sha256(data) != expected_sha256 {
        return Err(RuntimeWriteAdapterError::PostValidationPreimageMismatch);
    }
    Ok(())
}

/// Prepare the already-bound Config delta without admitting a generic 272-byte
/// Config writer. The caller must revalidate the live preimage after acquiring
/// every mutable borrow and before copying this postimage.
fn prepare_production_active_config_stake_principal_cas_inner(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    principal_delta: u64,
    config_account: &AccountInfo<'_>,
) -> Result<PreparedConfigStakePrincipalCas, RuntimeWriteAdapterError> {
    if config_account.key.to_bytes() != active_config.key()
        || config_account.owner.to_bytes() != binding.program_id()
    {
        return Err(RuntimeWriteAdapterError::ConfigAccountIdentityMismatch);
    }
    if !config_account.is_writable || config_account.is_signer || config_account.executable {
        return Err(RuntimeWriteAdapterError::ConfigAccountFlagsMismatch);
    }

    let data = config_account
        .try_borrow_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    if data.len() != CONFIG_GENESIS_ACCOUNT_LEN {
        return Err(RuntimeWriteAdapterError::ConfigAccountLengthMismatch);
    }
    let observed_preimage = sha256(&data);
    if observed_preimage != active_config.preimage_sha256() {
        return Err(RuntimeWriteAdapterError::ConfigPreimageMismatch);
    }
    let observed_state = decode_config_genesis_state(&data)
        .map_err(|_| RuntimeWriteAdapterError::ConfigCodecRejected)?;
    if observed_state != active_config.state() {
        return Err(RuntimeWriteAdapterError::ConfigStateMismatch);
    }
    drop(data);

    let previous_staked_principal = active_config.state().config.staked_principal;
    let next_staked_principal = previous_staked_principal
        .checked_add(principal_delta)
        .ok_or(RuntimeWriteAdapterError::ConfigPrincipalOverflow)?;
    let mut next_state = active_config.state();
    next_state.config.staked_principal = next_staked_principal;
    let mut postimage = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&next_state, &mut postimage)
        .map_err(|_| RuntimeWriteAdapterError::ConfigCodecRejected)?;
    let postimage_sha256 = sha256(&postimage);

    Ok(PreparedConfigStakePrincipalCas {
        postimage,
        receipt: ProductionActiveConfigStakePrincipalReceipt {
            config_key: active_config.key(),
            expected_preimage_sha256: active_config.preimage_sha256(),
            postimage_sha256,
            previous_staked_principal,
            next_staked_principal,
            law_account_sha256: gate.law_account_sha256(),
        },
    })
}

/// Execute one sealed batch for the pinned structural lifecycle rehearsal.
/// Production callers must use
/// [`execute_production_active_existing_write_batch_account_infos`].
///
/// Every immutable validation and every mutable borrow/preimage check finishes
/// before the first `copy_from_slice`. A failure therefore leaves all supplied
/// account data unchanged. The returned receipt is a deterministic local fact;
/// it is not release, deployment, or Mainnet evidence.
// Keep the validated batch and mutable borrow set in a distinct SBF frame.
#[inline(never)]
pub fn execute_existing_write_batch_account_infos<const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    accounts: &[AccountInfo<'_>],
) -> Result<RuntimeWriteReceipt<N>, RuntimeWriteAdapterError> {
    execute_existing_write_batch_inner(gate, binding, batch, accounts)
}

/// Production-shaped existing-state CAS path. The opaque Config capability is
/// checked before account count validation, immutable borrows, mutable borrows,
/// or writes, so an inactive/staging/rehearsal Config cannot reach the executor.
#[inline(never)]
pub fn execute_production_active_existing_write_batch_account_infos<const N: usize>(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    accounts: &[AccountInfo<'_>],
) -> Result<RuntimeWriteReceipt<N>, RuntimeWriteAdapterError> {
    require_active_config_capability(gate, active_config, binding)?;
    execute_existing_write_batch_inner(gate, binding, batch, accounts)
}

/// Fixed-arity production executor for one borrowed four-intent batch. The
/// borrowed seal avoids a second owning copy of every fixed-size postimage;
/// explicit borrow handles avoid heap allocation while preserving the exact
/// all-borrows/all-preimages-before-first-write boundary.
#[inline(never)]
pub fn execute_production_active_existing_write_batch_borrowed_4_account_infos(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    batch: BorrowedExistingWriteBatch<'_, 4>,
    accounts: &[AccountInfo<'_>],
) -> Result<RuntimeWriteReceipt<4>, RuntimeWriteAdapterError> {
    require_active_config_capability(gate, active_config, binding)?;
    if accounts.len() != 4 {
        return Err(RuntimeWriteAdapterError::AccountCountMismatch);
    }

    let lamports0 = accounts[0]
        .try_borrow_lamports()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let lamports1 = accounts[1]
        .try_borrow_lamports()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let lamports2 = accounts[2]
        .try_borrow_lamports()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let lamports3 = accounts[3]
        .try_borrow_lamports()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let data0 = accounts[0]
        .try_borrow_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let data1 = accounts[1]
        .try_borrow_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let data2 = accounts[2]
        .try_borrow_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let data3 = accounts[3]
        .try_borrow_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let observations = [
        native_observation(&accounts[0], **lamports0, &data0),
        native_observation(&accounts[1], **lamports1, &data1),
        native_observation(&accounts[2], **lamports2, &data2),
        native_observation(&accounts[3], **lamports3, &data3),
    ];
    let validated =
        validate_existing_write_preconditions_borrowed(gate, binding, batch, &observations, &[])?;
    drop(data3);
    drop(data2);
    drop(data1);
    drop(data0);
    drop(lamports3);
    drop(lamports2);
    drop(lamports1);
    drop(lamports0);

    let mut data0 = accounts[0]
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let mut data1 = accounts[1]
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let mut data2 = accounts[2]
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    let mut data3 = accounts[3]
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;

    let intents = validated.batch().intents();
    let existing0 = intents[0];
    let existing1 = intents[1];
    let existing2 = intents[2];
    let existing3 = intents[3];
    require_existing_live_preimage(&data0, existing0)?;
    require_existing_live_preimage(&data1, existing1)?;
    require_existing_live_preimage(&data2, existing2)?;
    require_existing_live_preimage(&data3, existing3)?;

    data0.copy_from_slice(existing0.postimage());
    data1.copy_from_slice(existing1.postimage());
    data2.copy_from_slice(existing2.postimage());
    data3.copy_from_slice(existing3.postimage());

    Ok(RuntimeWriteReceipt {
        batch_commitment_sha256: validated.batch().commitment_sha256(),
        postimage_sha256: [
            existing0.postimage_sha256(),
            existing1.postimage_sha256(),
            existing2.postimage_sha256(),
            existing3.postimage_sha256(),
        ],
    })
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

fn require_existing_live_preimage(
    data: &[u8],
    existing: &ExistingStateWriteIntent,
) -> Result<(), RuntimeWriteAdapterError> {
    if data.len() != existing.data_len() || sha256(data) != existing.expected_preimage_sha256() {
        return Err(RuntimeWriteAdapterError::PostValidationPreimageMismatch);
    }
    Ok(())
}

fn execute_existing_write_batch_inner<const N: usize>(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    batch: AtomicWriteBatch<N>,
    accounts: &[AccountInfo<'_>],
) -> Result<RuntimeWriteReceipt<N>, RuntimeWriteAdapterError> {
    if accounts.len() != N {
        return Err(RuntimeWriteAdapterError::AccountCountMismatch);
    }
    if batch
        .intents()
        .iter()
        .any(|intent| matches!(intent, StateWriteIntent::Create(_)))
    {
        return Err(RuntimeWriteAdapterError::CreateIntentUnsupported);
    }

    let mut lamport_borrows = Vec::with_capacity(N);
    let mut data_borrows = Vec::with_capacity(N);
    for account in accounts {
        lamport_borrows.push(
            account
                .try_borrow_lamports()
                .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?,
        );
        data_borrows.push(
            account
                .try_borrow_data()
                .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?,
        );
    }
    let observations: Vec<_> = accounts
        .iter()
        .enumerate()
        .map(|(index, account)| NativeAccountObservation {
            key: account.key.to_bytes(),
            owner: account.owner.to_bytes(),
            lamports: **lamport_borrows[index],
            data: &data_borrows[index],
            is_signer: account.is_signer,
            is_writable: account.is_writable,
            executable: account.executable,
        })
        .collect();
    let validated = validate_atomic_write_preconditions(gate, binding, batch, &observations, &[])?;
    drop(observations);
    drop(data_borrows);
    drop(lamport_borrows);

    let mut mutable_data = Vec::with_capacity(N);
    for account in accounts {
        mutable_data.push(
            account
                .try_borrow_mut_data()
                .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?,
        );
    }

    for (data, intent) in mutable_data.iter().zip(validated.batch().intents()) {
        let StateWriteIntent::Existing(existing) = intent else {
            return Err(RuntimeWriteAdapterError::CreateIntentUnsupported);
        };
        if data.len() != existing.data_len() || sha256(data) != existing.expected_preimage_sha256()
        {
            return Err(RuntimeWriteAdapterError::PostValidationPreimageMismatch);
        }
    }

    for (data, intent) in mutable_data.iter_mut().zip(validated.batch().intents()) {
        let StateWriteIntent::Existing(existing) = intent else {
            return Err(RuntimeWriteAdapterError::CreateIntentUnsupported);
        };
        data.copy_from_slice(existing.postimage());
    }

    Ok(RuntimeWriteReceipt {
        batch_commitment_sha256: validated.batch().commitment_sha256(),
        postimage_sha256: array::from_fn(|index| match validated.batch().intents()[index] {
            StateWriteIntent::Existing(existing) => existing.postimage_sha256(),
            StateWriteIntent::Create(_) => unreachable!("create intents were rejected"),
        }),
    })
}

fn sha256(data: &[u8]) -> [u8; 32] {
    let digest = Sha256::digest(data);
    let mut output = [0u8; 32];
    output.copy_from_slice(&digest);
    output
}

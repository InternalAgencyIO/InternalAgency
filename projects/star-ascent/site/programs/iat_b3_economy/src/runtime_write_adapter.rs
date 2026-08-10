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

use crate::native_adapter::{
    validate_atomic_write_preconditions, AtomicWriteBatch, NativeAccountObservation,
    NativeAdapterError, NativeEconomyBinding, StateWriteIntent,
};
use crate::runtime_adapter::RuntimeProductionActiveConfig;
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
}

impl From<NativeAdapterError> for RuntimeWriteAdapterError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
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
        || completed.stake.owner != binding.config()
        || completed.stake.amount != next_staked_principal
    {
        return Err(RuntimeWriteAdapterError::CompletedStakeIngressMismatch);
    }
    execute_production_active_config_stake_principal_cas_inner(
        gate,
        active_config,
        binding,
        principal_delta,
        config_account,
    )
}

/// Apply the already-bound delta without admitting a generic 272-byte Config
/// writer. The live account is checked from an immutable borrow, then checked
/// again after acquiring the mutable borrow; no byte is written unless both
/// observations match the opaque preimage.
fn execute_production_active_config_stake_principal_cas_inner(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    principal_delta: u64,
    config_account: &AccountInfo<'_>,
) -> Result<ProductionActiveConfigStakePrincipalReceipt, RuntimeWriteAdapterError> {
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
    let observed_preimage = <[u8; 32]>::from(Sha256::digest(&*data));
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
    let postimage_sha256 = <[u8; 32]>::from(Sha256::digest(postimage));

    let mut mutable_data = config_account
        .try_borrow_mut_data()
        .map_err(|_| RuntimeWriteAdapterError::AccountBorrowFailed)?;
    if mutable_data.len() != CONFIG_GENESIS_ACCOUNT_LEN
        || <[u8; 32]>::from(Sha256::digest(&**mutable_data)) != active_config.preimage_sha256()
    {
        return Err(RuntimeWriteAdapterError::PostValidationPreimageMismatch);
    }
    mutable_data.copy_from_slice(&postimage);

    Ok(ProductionActiveConfigStakePrincipalReceipt {
        config_key: active_config.key(),
        expected_preimage_sha256: active_config.preimage_sha256(),
        postimage_sha256,
        previous_staked_principal,
        next_staked_principal,
        law_account_sha256: gate.law_account_sha256(),
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
        if data.len() != existing.data_len()
            || <[u8; 32]>::from(Sha256::digest(&***data)) != existing.expected_preimage_sha256()
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

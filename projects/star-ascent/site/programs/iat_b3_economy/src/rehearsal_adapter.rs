//! Nonactivating all-15 economy rehearsal preflight.
//!
//! This feature-gated host surface composes three already opaque facts: an
//! open Daily Law write capability, a native economy binding, and an exact
//! read-only Token-2022 mint capability. It inventories the retained V2 account
//! roles and can check caller-described account-meta shape. It is not an
//! instruction ABI, identity authenticator, entrypoint, dispatcher, write
//! executor, CPI layer, RPC client, signer, deployment driver, or Devnet pass.

use crate::native_adapter::{
    seal_atomic_write_batch, AtomicWriteBatch, AuthenticatedStateAccount, NativeAdapterError,
    NativeEconomyBinding, PdaIdentity, StateWriteIntent,
};
use crate::runtime_adapter::{authenticate_state_account_info, RuntimeAdapterError};
use crate::token_2022_runtime::{
    authenticate_public_token_account_info, EconomyToken2022Error, PublicTokenAccountBinding,
    ReadonlyCanonicalEconomyMint, ReadonlyPublicTokenAccount,
};
use crate::ValidatedDailyLawWrite;
use solana_account_info::AccountInfo;

pub const EXPECTED_REHEARSAL_HANDLER_COUNT: usize = 15;
pub const ALL_15_REHEARSAL_PREFLIGHT_STATUS: &str =
    "FEATURE_GATED_READ_ONLY_ALL_15_ACCOUNT_GRAPH_PREFLIGHT_NO_DISPATCH";
pub const ALL_15_REHEARSAL_PREFLIGHT_COMPLETE: bool = false;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct All15RehearsalPreflightTruth {
    pub feature_gated: bool,
    pub retained_handler_count: usize,
    pub daily_law_capability_required: bool,
    pub native_binding_required: bool,
    pub canonical_token_2022_mint_required: bool,
    pub account_role_graphs_present: bool,
    pub account_meta_shape_checks_present: bool,
    pub strict_state_authentication_reused: bool,
    pub inert_write_batch_sealing_reused: bool,
    pub public_token_account_authentication_present: bool,
    pub account_identity_graph_complete: bool,
    pub config_codec_supported: bool,
    pub owner_policy_frozen: bool,
    pub ccc_genesis_enabled: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub mutable_account_borrows: bool,
    pub account_writes_executed: bool,
    pub system_cpi_executed: bool,
    pub token_cpi_executed: bool,
    pub rpc_used: bool,
    pub transaction_signed: bool,
    pub deployment_executed: bool,
    pub production_identity_binding_frozen: bool,
    pub devnet_executed: bool,
    pub any_handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const ALL_15_REHEARSAL_PREFLIGHT_TRUTH: All15RehearsalPreflightTruth =
    All15RehearsalPreflightTruth {
        feature_gated: true,
        retained_handler_count: EXPECTED_REHEARSAL_HANDLER_COUNT,
        daily_law_capability_required: true,
        native_binding_required: true,
        canonical_token_2022_mint_required: true,
        account_role_graphs_present: true,
        account_meta_shape_checks_present: true,
        strict_state_authentication_reused: true,
        inert_write_batch_sealing_reused: true,
        public_token_account_authentication_present: true,
        account_identity_graph_complete: false,
        config_codec_supported: false,
        owner_policy_frozen: false,
        ccc_genesis_enabled: false,
        instruction_abi_frozen: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        mutable_account_borrows: false,
        account_writes_executed: false,
        system_cpi_executed: false,
        token_cpi_executed: false,
        rpc_used: false,
        transaction_signed: false,
        deployment_executed: false,
        production_identity_binding_frozen: false,
        devnet_executed: false,
        any_handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum RehearsalOperation {
    InitializeConfig,
    InitializeLaneVault,
    InitializeStakeVault,
    Activate,
    RegisterAgency,
    SetEligibility,
    OpenPosition,
    SettlePositionWeek,
    SettleCoreWeek,
    ClaimLanePrincipal,
    WithdrawPositionPrincipal,
    ClosePosition,
    CommitRound,
    SettleRound,
    ExpireRound,
}

pub const ALL_REHEARSAL_OPERATIONS: [RehearsalOperation; EXPECTED_REHEARSAL_HANDLER_COUNT] = [
    RehearsalOperation::InitializeConfig,
    RehearsalOperation::InitializeLaneVault,
    RehearsalOperation::InitializeStakeVault,
    RehearsalOperation::Activate,
    RehearsalOperation::RegisterAgency,
    RehearsalOperation::SetEligibility,
    RehearsalOperation::OpenPosition,
    RehearsalOperation::SettlePositionWeek,
    RehearsalOperation::SettleCoreWeek,
    RehearsalOperation::ClaimLanePrincipal,
    RehearsalOperation::WithdrawPositionPrincipal,
    RehearsalOperation::ClosePosition,
    RehearsalOperation::CommitRound,
    RehearsalOperation::SettleRound,
    RehearsalOperation::ExpireRound,
];

impl RehearsalOperation {
    pub const fn name(self) -> &'static str {
        match self {
            Self::InitializeConfig => "initialize_config",
            Self::InitializeLaneVault => "initialize_lane_vault",
            Self::InitializeStakeVault => "initialize_stake_vault",
            Self::Activate => "activate",
            Self::RegisterAgency => "register_agency",
            Self::SetEligibility => "set_eligibility",
            Self::OpenPosition => "open_position",
            Self::SettlePositionWeek => "settle_position_week",
            Self::SettleCoreWeek => "settle_core_week",
            Self::ClaimLanePrincipal => "claim_lane_principal",
            Self::WithdrawPositionPrincipal => "withdraw_position_principal",
            Self::ClosePosition => "close_position",
            Self::CommitRound => "commit_round",
            Self::SettleRound => "settle_round",
            Self::ExpireRound => "expire_round",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RehearsalHold {
    GenesisPhaseAndConfigCodecUnfrozen,
    ImmutableCccGenesisDisabled,
    OwnerCustodyPolicyUnfrozen,
    CoreLaneOwnerPolicyUnfrozen,
    HandlerRuntimeIncomplete,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RehearsalAccountSlot {
    pub name: &'static str,
    pub signer: bool,
    pub writable: bool,
    pub executable: bool,
    pub optional: bool,
}

const fn slot(
    name: &'static str,
    signer: bool,
    writable: bool,
    executable: bool,
) -> RehearsalAccountSlot {
    RehearsalAccountSlot {
        name,
        signer,
        writable,
        executable,
        optional: false,
    }
}

const fn optional_slot(
    name: &'static str,
    signer: bool,
    writable: bool,
    executable: bool,
) -> RehearsalAccountSlot {
    RehearsalAccountSlot {
        name,
        signer,
        writable,
        executable,
        optional: true,
    }
}

const INITIALIZE_CONFIG: &[RehearsalAccountSlot] = &[
    slot("admin", true, true, false),
    slot("mint", false, false, false),
    slot("config", false, true, false),
    slot("vault_authority", false, false, false),
    slot("token_program", false, false, true),
    slot("system_program", false, false, true),
];
const INITIALIZE_LANE_VAULT: &[RehearsalAccountSlot] = &[
    slot("admin", true, true, false),
    slot("config", false, true, false),
    slot("mint", false, false, false),
    slot("vault_authority", false, false, false),
    slot("lane_state", false, true, false),
    slot("lane_token_account", false, true, false),
    slot("token_program", false, false, true),
    slot("system_program", false, false, true),
];
const INITIALIZE_STAKE_VAULT: &[RehearsalAccountSlot] = &[
    slot("admin", true, true, false),
    slot("config", false, true, false),
    slot("mint", false, false, false),
    slot("vault_authority", false, false, false),
    slot("stake_token_account", false, true, false),
    slot("token_program", false, false, true),
    slot("system_program", false, false, true),
];
const ACTIVATE: &[RehearsalAccountSlot] = &[
    slot("admin", true, true, false),
    slot("config", false, true, false),
    slot("mint", false, false, false),
    slot("vault_authority", false, false, false),
    slot("community_tokens", false, false, false),
    slot("stake_tokens", false, false, false),
    slot("treasury", false, true, false),
    slot("treasury_tokens", false, false, false),
    slot("ecosystem", false, true, false),
    slot("ecosystem_tokens", false, false, false),
    slot("core_team", false, false, false),
    slot("core_team_tokens", false, false, false),
    slot("liquidity", false, true, false),
    slot("liquidity_tokens", false, false, false),
    slot("core_reward", false, true, false),
    slot("system_program", false, false, true),
];
const REGISTER_AGENCY: &[RehearsalAccountSlot] = &[
    slot("admin", true, true, false),
    slot("config", false, true, false),
    slot("agency_owner", false, false, false),
    slot("agency", false, true, false),
    slot("agency_owner_index", false, true, false),
    slot("system_program", false, false, true),
];
const SET_ELIGIBILITY: &[RehearsalAccountSlot] = &[
    slot("admin", true, true, false),
    slot("config", false, false, false),
    slot("wallet", false, false, false),
    slot("eligibility", false, true, false),
    slot("system_program", false, false, true),
];
const OPEN_POSITION: &[RehearsalAccountSlot] = &[
    slot("owner", true, true, false),
    slot("config", false, true, false),
    slot("eligibility", false, false, false),
    slot("mint", false, false, false),
    slot("owner_tokens", false, true, false),
    slot("stake_tokens", false, true, false),
    slot("treasury", false, true, false),
    slot("ecosystem", false, true, false),
    slot("liquidity", false, true, false),
    slot("position", false, true, false),
    slot("token_program", false, false, true),
    slot("system_program", false, false, true),
];
const SETTLE_POSITION_WEEK: &[RehearsalAccountSlot] = &[
    slot("caller", true, false, false),
    slot("config", false, false, false),
    slot("position", false, true, false),
    optional_slot("round", false, false, false),
    slot("mint", false, false, false),
    slot("vault_authority", false, false, false),
    slot("treasury", false, true, false),
    slot("treasury_tokens", false, true, false),
    slot("ecosystem", false, true, false),
    slot("ecosystem_tokens", false, true, false),
    slot("liquidity", false, true, false),
    slot("liquidity_tokens", false, true, false),
    slot("destination_tokens", false, true, false),
    slot("token_program", false, false, true),
];
const SETTLE_CORE_WEEK: &[RehearsalAccountSlot] = &[
    slot("caller", true, false, false),
    slot("config", false, false, false),
    slot("mint", false, false, false),
    slot("vault_authority", false, false, false),
    slot("core_reward", false, true, false),
    slot("treasury", false, true, false),
    slot("treasury_tokens", false, true, false),
    slot("ecosystem", false, true, false),
    slot("ecosystem_tokens", false, true, false),
    slot("liquidity", false, true, false),
    slot("liquidity_tokens", false, true, false),
    slot("destination_tokens", false, true, false),
    slot("token_program", false, false, true),
];
const CLAIM_LANE_PRINCIPAL: &[RehearsalAccountSlot] = &[
    slot("caller", true, false, false),
    slot("config", false, false, false),
    slot("mint", false, false, false),
    slot("vault_authority", false, false, false),
    slot("lane_state", false, true, false),
    slot("lane_tokens", false, true, false),
    slot("destination_tokens", false, true, false),
    slot("token_program", false, false, true),
];
const WITHDRAW_POSITION_PRINCIPAL: &[RehearsalAccountSlot] = &[
    slot("caller", true, false, false),
    slot("config", false, true, false),
    slot("position", false, true, false),
    slot("mint", false, false, false),
    slot("vault_authority", false, false, false),
    slot("stake_tokens", false, true, false),
    slot("destination_tokens", false, true, false),
    slot("token_program", false, false, true),
];
const CLOSE_POSITION: &[RehearsalAccountSlot] = &[
    slot("caller", true, false, false),
    slot("config", false, false, false),
    slot("position", false, true, false),
    slot("treasury", false, true, false),
    slot("ecosystem", false, true, false),
    slot("liquidity", false, true, false),
];
const COMMIT_ROUND: &[RehearsalAccountSlot] = &[
    slot("payer", true, true, false),
    slot("config", false, false, false),
    slot("randomness_account", false, false, false),
    slot("instructions", false, false, false),
    slot("round", false, true, false),
    slot("system_program", false, false, true),
];
const SETTLE_ROUND: &[RehearsalAccountSlot] = &[
    slot("config", false, false, false),
    slot("round", false, true, false),
    slot("randomness_account", false, false, false),
];
const EXPIRE_ROUND: &[RehearsalAccountSlot] = &[
    slot("config", false, false, false),
    slot("round", false, true, false),
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RehearsalOperationDescriptor {
    pub operation: RehearsalOperation,
    pub accounts: &'static [RehearsalAccountSlot],
    pub hold: RehearsalHold,
    pub requires_daily_law_capability: bool,
    pub requires_canonical_mint_capability: bool,
    pub handler_complete: bool,
    pub devnet_executable: bool,
}

pub const fn operation_descriptor(operation: RehearsalOperation) -> RehearsalOperationDescriptor {
    let (accounts, hold) = match operation {
        RehearsalOperation::InitializeConfig => (
            INITIALIZE_CONFIG,
            RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen,
        ),
        RehearsalOperation::InitializeLaneVault => (
            INITIALIZE_LANE_VAULT,
            RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen,
        ),
        RehearsalOperation::InitializeStakeVault => (
            INITIALIZE_STAKE_VAULT,
            RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen,
        ),
        RehearsalOperation::Activate => {
            (ACTIVATE, RehearsalHold::GenesisPhaseAndConfigCodecUnfrozen)
        }
        RehearsalOperation::RegisterAgency => {
            (REGISTER_AGENCY, RehearsalHold::ImmutableCccGenesisDisabled)
        }
        RehearsalOperation::SetEligibility => {
            (SET_ELIGIBILITY, RehearsalHold::HandlerRuntimeIncomplete)
        }
        RehearsalOperation::OpenPosition => {
            (OPEN_POSITION, RehearsalHold::HandlerRuntimeIncomplete)
        }
        RehearsalOperation::SettlePositionWeek => (
            SETTLE_POSITION_WEEK,
            RehearsalHold::HandlerRuntimeIncomplete,
        ),
        RehearsalOperation::SettleCoreWeek => {
            (SETTLE_CORE_WEEK, RehearsalHold::OwnerCustodyPolicyUnfrozen)
        }
        RehearsalOperation::ClaimLanePrincipal => (
            CLAIM_LANE_PRINCIPAL,
            RehearsalHold::CoreLaneOwnerPolicyUnfrozen,
        ),
        RehearsalOperation::WithdrawPositionPrincipal => (
            WITHDRAW_POSITION_PRINCIPAL,
            RehearsalHold::HandlerRuntimeIncomplete,
        ),
        RehearsalOperation::ClosePosition => {
            (CLOSE_POSITION, RehearsalHold::HandlerRuntimeIncomplete)
        }
        RehearsalOperation::CommitRound => {
            (COMMIT_ROUND, RehearsalHold::ImmutableCccGenesisDisabled)
        }
        RehearsalOperation::SettleRound => {
            (SETTLE_ROUND, RehearsalHold::ImmutableCccGenesisDisabled)
        }
        RehearsalOperation::ExpireRound => {
            (EXPIRE_ROUND, RehearsalHold::ImmutableCccGenesisDisabled)
        }
    };
    RehearsalOperationDescriptor {
        operation,
        accounts,
        hold,
        requires_daily_law_capability: true,
        requires_canonical_mint_capability: true,
        handler_complete: false,
        devnet_executable: false,
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RehearsalAccountMetaObservation<'a> {
    pub name: &'a str,
    pub signer: bool,
    pub writable: bool,
    pub executable: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StructuralAccountGraphPreflight {
    operation: RehearsalOperation,
    observed_account_count: usize,
}

impl StructuralAccountGraphPreflight {
    pub const fn operation(&self) -> RehearsalOperation {
        self.operation
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RehearsalPreflightError {
    LawAndNativeMintMismatch,
    CanonicalMintMismatch,
    MissingRequiredAccount,
    UnexpectedAccount,
    AccountRoleMismatch,
    AccountMetaMismatch,
    Runtime(RuntimeAdapterError),
    Native(NativeAdapterError),
    Token2022(EconomyToken2022Error),
}

impl From<RuntimeAdapterError> for RehearsalPreflightError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<NativeAdapterError> for RehearsalPreflightError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<EconomyToken2022Error> for RehearsalPreflightError {
    fn from(value: EconomyToken2022Error) -> Self {
        Self::Token2022(value)
    }
}

pub struct All15RehearsalPreflight<'a> {
    gate: &'a ValidatedDailyLawWrite,
    native: &'a NativeEconomyBinding,
    mint: &'a ReadonlyCanonicalEconomyMint,
}

impl<'a> All15RehearsalPreflight<'a> {
    pub fn new(
        gate: &'a ValidatedDailyLawWrite,
        native: &'a NativeEconomyBinding,
        mint: &'a ReadonlyCanonicalEconomyMint,
    ) -> Result<Self, RehearsalPreflightError> {
        if gate.mint() != native.mint() {
            return Err(RehearsalPreflightError::LawAndNativeMintMismatch);
        }
        if mint.canonical_mint() != native.mint() {
            return Err(RehearsalPreflightError::CanonicalMintMismatch);
        }
        Ok(Self { gate, native, mint })
    }

    pub const fn descriptor(&self, operation: RehearsalOperation) -> RehearsalOperationDescriptor {
        operation_descriptor(operation)
    }

    /// Validate only role order and account-meta flags. Names are rehearsal
    /// labels supplied by the caller, not authenticated account identities.
    pub fn validate_account_meta_shape(
        &self,
        operation: RehearsalOperation,
        observed: &[RehearsalAccountMetaObservation<'_>],
    ) -> Result<StructuralAccountGraphPreflight, RehearsalPreflightError> {
        let descriptor = operation_descriptor(operation);
        let mut observed_index = 0usize;
        for expected in descriptor.accounts {
            let Some(actual) = observed.get(observed_index) else {
                if expected.optional {
                    continue;
                }
                return Err(RehearsalPreflightError::MissingRequiredAccount);
            };
            if actual.name != expected.name {
                if expected.optional {
                    continue;
                }
                return Err(RehearsalPreflightError::AccountRoleMismatch);
            }
            if actual.signer != expected.signer
                || actual.writable != expected.writable
                || actual.executable != expected.executable
            {
                return Err(RehearsalPreflightError::AccountMetaMismatch);
            }
            observed_index += 1;
        }
        if observed_index != observed.len() {
            return Err(RehearsalPreflightError::UnexpectedAccount);
        }
        Ok(StructuralAccountGraphPreflight {
            operation,
            observed_account_count: observed.len(),
        })
    }

    /// Reuse the strict state AccountInfo authenticator without broadening its
    /// authority or performing any mutable borrow.
    pub fn authenticate_strict_state(
        &self,
        account: &AccountInfo<'_>,
        expected_identity: PdaIdentity,
    ) -> Result<AuthenticatedStateAccount, RehearsalPreflightError> {
        authenticate_state_account_info(self.gate, self.native, account, expected_identity)
            .map_err(Into::into)
    }

    /// Reuse the exact public Token-2022 parser. Account writability is merely
    /// observed and checked against the binding; no mutable borrow occurs.
    pub fn authenticate_public_token_account(
        &self,
        binding: &PublicTokenAccountBinding,
        account: &AccountInfo<'_>,
    ) -> Result<ReadonlyPublicTokenAccount, RehearsalPreflightError> {
        authenticate_public_token_account_info(self.mint, binding, account).map_err(Into::into)
    }

    /// Seal already prepared intents into an inert commitment. This cannot
    /// execute, write, invoke, sign, submit, or deploy the batch.
    pub fn seal_inert_write_batch<const N: usize>(
        &self,
        intents: [StateWriteIntent; N],
    ) -> Result<AtomicWriteBatch<N>, RehearsalPreflightError> {
        seal_atomic_write_batch(self.gate, self.native, intents).map_err(Into::into)
    }
}

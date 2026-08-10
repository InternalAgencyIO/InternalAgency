//! Composition of opaque runtime-authenticated capabilities into the pure
//! Genesis conservation receipt.
//!
//! This module cannot parse caller-shaped semantic observations. Canonical
//! mint and token-account values must first pass the exact Token-2022 runtime
//! parser, and every program-custody beneficiary must come from an
//! authenticated strict Lane PDA. The result is still not an activation or
//! Mainnet authorization: production identities, owner acceptance, prior-mint
//! retirement, phase policy, writes, and deployment evidence remain absent.

use crate::native_adapter::{
    derive_pda, AuthenticatedStateAccount, NativeAdapterError, NativeEconomyBinding, PdaIdentity,
    StrictStateValue,
};
use crate::token_2022_runtime::{ReadonlyCanonicalEconomyMint, ReadonlyPublicTokenAccount};
use crate::{
    lane_policy, verify_genesis_allocation_conservation, GenesisAllocationManifest,
    GenesisAllocationRole, GenesisConservationError, GenesisConservationInput,
    GenesisConservationReceipt, ObservedGenesisAllocation, ObservedGenesisMint,
    GENESIS_ALLOCATION_COUNT,
};

pub const GENESIS_CONSERVATION_RUNTIME_STATUS: &str =
    "FEATURE_GATED_AUTHENTICATED_TOKEN_AND_LANE_CAPABILITIES_OWNER_POLICY_REQUIRED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisConservationRuntimeTruth {
    pub feature_gated: bool,
    pub opaque_token_2022_capabilities_required: bool,
    pub opaque_lane_state_capabilities_required: bool,
    pub exact_runtime_balances_authenticated: bool,
    pub exact_lane_beneficiaries_authenticated: bool,
    pub immutable_account_borrows_only: bool,
    pub owner_destination_manifest_accepted: bool,
    pub production_identity_binding_frozen: bool,
    pub migration_or_no_prior_supply_proved: bool,
    pub phase_transition_authorized: bool,
    pub account_writes_executed: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub mainnet_hold: bool,
}

pub const GENESIS_CONSERVATION_RUNTIME_TRUTH: GenesisConservationRuntimeTruth =
    GenesisConservationRuntimeTruth {
        feature_gated: true,
        opaque_token_2022_capabilities_required: true,
        opaque_lane_state_capabilities_required: true,
        exact_runtime_balances_authenticated: true,
        exact_lane_beneficiaries_authenticated: true,
        immutable_account_borrows_only: true,
        owner_destination_manifest_accepted: false,
        production_identity_binding_frozen: false,
        migration_or_no_prior_supply_proved: false,
        phase_transition_authorized: false,
        account_writes_executed: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenesisConservationRuntimeError {
    Native(NativeAdapterError),
    Conservation(GenesisConservationError),
    MintBindingMismatch,
    TokenProgramBindingMismatch,
    CommunityCustodyMismatch,
    LaneCapabilityMismatch,
    LaneEconomicsMismatch,
}

impl From<NativeAdapterError> for GenesisConservationRuntimeError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<GenesisConservationError> for GenesisConservationRuntimeError {
    fn from(value: GenesisConservationError) -> Self {
        Self::Conservation(value)
    }
}

/// Bind five opaque Token-2022 balance observations and four authenticated
/// Lane-state capabilities to one structural conservation receipt.
///
/// Index zero is the community hardware-custody account. Indices one through
/// four are the retained treasury, ecosystem, core-team, and liquidity Lane
/// PDAs in exact order. No caller-supplied balance or beneficiary is accepted.
pub fn verify_authenticated_genesis_conservation(
    binding: &NativeEconomyBinding,
    manifest: GenesisAllocationManifest,
    canonical_mint: &ReadonlyCanonicalEconomyMint,
    token_accounts: &[ReadonlyPublicTokenAccount; GENESIS_ALLOCATION_COUNT],
    lane_states: &[AuthenticatedStateAccount; GENESIS_ALLOCATION_COUNT - 1],
) -> Result<GenesisConservationReceipt, GenesisConservationRuntimeError> {
    if manifest.mint != binding.mint() || canonical_mint.canonical_mint() != binding.mint() {
        return Err(GenesisConservationRuntimeError::MintBindingMismatch);
    }
    if manifest.token_program != canonical_mint.token_2022_program() {
        return Err(GenesisConservationRuntimeError::TokenProgramBindingMismatch);
    }

    let vault_authority = derive_pda(
        binding,
        PdaIdentity::VaultAuthority {
            config: binding.config(),
        },
    )?
    .key;
    let mut observations = [ObservedGenesisAllocation {
        role: GenesisAllocationRole::Community,
        token_account: [0; 32],
        token_program: manifest.token_program,
        mint: manifest.mint,
        token_authority: [0; 32],
        beneficiary_binding: [0; 32],
        amount: 0,
        delegate: None,
        close_authority: None,
        delegated_amount: 0,
        frozen: false,
        native: false,
    }; GENESIS_ALLOCATION_COUNT];

    for index in 0..GENESIS_ALLOCATION_COUNT {
        let entry = manifest.entries[index];
        let token = token_accounts[index];
        let beneficiary_binding = if index == 0 {
            if entry.role != GenesisAllocationRole::Community
                || entry.token_authority != entry.beneficiary
                || token.wallet_owner() != entry.beneficiary
            {
                return Err(GenesisConservationRuntimeError::CommunityCustodyMismatch);
            }
            entry.beneficiary
        } else {
            let expected_lane = entry.role as u8;
            let authenticated = lane_states[index - 1];
            if authenticated.identity()
                != (PdaIdentity::LaneState {
                    config: binding.config(),
                    lane: expected_lane,
                })
            {
                return Err(GenesisConservationRuntimeError::LaneCapabilityMismatch);
            }
            let StrictStateValue::Lane(lane) = authenticated.state() else {
                return Err(GenesisConservationRuntimeError::LaneCapabilityMismatch);
            };
            let expected_policy = lane_policy(expected_lane, false)
                .ok_or(GenesisConservationRuntimeError::LaneCapabilityMismatch)?;
            if lane.token_account != entry.token_account
                || lane.beneficiary != entry.beneficiary
                || lane.total != entry.amount
                || lane.total != expected_policy.total
                || lane.genesis_unlocked != expected_policy.genesis_unlocked
                || lane.cliff_week != expected_policy.cliff_week
                || lane.linear_end_week != expected_policy.linear_end_week
                || lane.reward_source != expected_policy.reward_source
                || lane.reserved != 0
                || lane.paid != 0
                || lane.principal_claimed != 0
                || entry.token_authority != vault_authority
                || token.wallet_owner() != vault_authority
            {
                return Err(GenesisConservationRuntimeError::LaneEconomicsMismatch);
            }
            lane.beneficiary
        };

        observations[index] = ObservedGenesisAllocation {
            role: entry.role,
            token_account: token.token_account(),
            token_program: canonical_mint.token_2022_program(),
            mint: token.mint(),
            token_authority: token.wallet_owner(),
            beneficiary_binding,
            amount: token.public_amount(),
            delegate: None,
            close_authority: None,
            delegated_amount: 0,
            frozen: false,
            native: false,
        };
    }

    verify_genesis_allocation_conservation(&GenesisConservationInput {
        manifest,
        mint: ObservedGenesisMint {
            key: canonical_mint.canonical_mint(),
            token_program: canonical_mint.token_2022_program(),
            decimals: canonical_mint.decimals(),
            supply: canonical_mint.supply(),
            mint_authority: None,
            freeze_authority: None,
        },
        allocations: observations,
    })
    .map_err(GenesisConservationRuntimeError::Conservation)
}

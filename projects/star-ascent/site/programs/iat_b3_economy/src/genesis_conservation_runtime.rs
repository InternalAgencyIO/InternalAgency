//! Composition of opaque runtime-authenticated capabilities into the pure
//! Genesis conservation receipt.
//!
//! This module cannot parse caller-shaped semantic observations. Canonical
//! mint and token-account values must first pass the exact Token-2022 runtime
//! parser, and every program-custody beneficiary must come from an
//! authenticated strict Lane PDA with the exact retained Activate account
//! meta. The result is still not an activation or
//! Mainnet authorization: production identities, owner acceptance, prior-mint
//! retirement, phase policy, writes, and deployment evidence remain absent.

use sha2::{Digest, Sha256};

use crate::native_adapter::{
    derive_pda, AuthenticatedReadonlyStateAccount, AuthenticatedStateAccount, NativeAdapterError,
    NativeEconomyBinding, PdaIdentity, StrictStateValue,
};
use crate::token_2022_runtime::{ReadonlyCanonicalEconomyMint, ReadonlyPublicTokenAccount};
use crate::{
    genesis_conservation::verify_genesis_allocation_conservation_parts, lane_policy,
    GenesisAllocationManifest, GenesisAllocationRole, GenesisConservationError,
    GenesisConservationReceipt, ObservedGenesisAllocation, ObservedGenesisMint,
    GENESIS_ALLOCATION_COUNT, GENESIS_ALLOCATION_ROLES,
};

pub const GENESIS_CONSERVATION_RUNTIME_ACCOUNT_SET_DOMAIN: &[u8] =
    b"IAT_B3_GENESIS_CONSERVATION_RUNTIME_ACCOUNT_SET_V2";

/// Exact retained `Activate` Lane account metas in Treasury, Ecosystem,
/// CoreTeam, Liquidity order. CoreTeam is read-only because the retained body
/// reads it only to initialize CoreReward; the other three Lane states mutate.
pub const GENESIS_ACTIVATE_LANE_WRITABILITY: [bool; GENESIS_ALLOCATION_COUNT - 1] =
    [true, true, false, true];

pub const GENESIS_CONSERVATION_RUNTIME_STATUS: &str =
    "FEATURE_GATED_AUTHENTICATED_TOKEN_AND_LANE_CAPABILITIES_OWNER_POLICY_REQUIRED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisConservationRuntimeTruth {
    pub feature_gated: bool,
    pub opaque_token_2022_capabilities_required: bool,
    pub opaque_lane_state_capabilities_required: bool,
    pub exact_runtime_balances_authenticated: bool,
    pub exact_lane_beneficiaries_authenticated: bool,
    pub exact_retained_activate_lane_writability_authenticated: bool,
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
        exact_retained_activate_lane_writability_authenticated: true,
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

/// Role-aware strict Lane capability used by Genesis conservation and the
/// held activation read-set composer. Both variants are opaque and
/// Daily-Law-stamped; neither variant can be forged from semantic fields.
/// The read-only variant is intentionally unusable by native write-intent
/// preparation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthenticatedGenesisLaneCapability {
    Writable(AuthenticatedStateAccount),
    Readonly(AuthenticatedReadonlyStateAccount),
}

impl AuthenticatedGenesisLaneCapability {
    pub const fn key(self) -> [u8; 32] {
        match self {
            Self::Writable(value) => value.key(),
            Self::Readonly(value) => value.key(),
        }
    }

    pub const fn owner(self) -> [u8; 32] {
        match self {
            Self::Writable(value) => value.owner(),
            Self::Readonly(value) => value.owner(),
        }
    }

    pub const fn identity(self) -> PdaIdentity {
        match self {
            Self::Writable(value) => value.identity(),
            Self::Readonly(value) => value.identity(),
        }
    }

    pub const fn state(self) -> StrictStateValue {
        match self {
            Self::Writable(value) => value.state(),
            Self::Readonly(value) => value.state(),
        }
    }

    pub const fn preimage_sha256(self) -> [u8; 32] {
        match self {
            Self::Writable(value) => value.preimage_sha256(),
            Self::Readonly(value) => value.preimage_sha256(),
        }
    }

    pub const fn observed_writable(self) -> bool {
        match self {
            Self::Writable(value) => value.observed_writable(),
            Self::Readonly(value) => value.observed_writable(),
        }
    }

    pub(crate) fn is_bound_to_gate(self, gate: &crate::ValidatedDailyLawWrite) -> bool {
        match self {
            Self::Writable(value) => value.is_bound_to_gate(gate),
            Self::Readonly(value) => value.is_bound_to_gate(gate),
        }
    }
}

/// Opaque proof that the pure conservation receipt was produced from the
/// feature-gated Token-2022 and strict Lane-PDA capability path. Callers can
/// inspect hashes and totals, but cannot manufacture this runtime binding or
/// extract a forgeable inner receipt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AuthenticatedGenesisConservationReceipt {
    receipt: GenesisConservationReceipt,
    config: [u8; 32],
    mint: [u8; 32],
    token_program: [u8; 32],
    lane_reserved_total: u64,
    lane_paid_total: u64,
    lane_principal_claimed_total: u64,
    account_set_sha256: [u8; 32],
}

impl AuthenticatedGenesisConservationReceipt {
    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn mint(&self) -> [u8; 32] {
        self.mint
    }

    pub const fn token_program(&self) -> [u8; 32] {
        self.token_program
    }

    pub const fn manifest_sha256(&self) -> [u8; 32] {
        self.receipt.manifest_sha256()
    }

    pub const fn observed_supply(&self) -> u64 {
        self.receipt.observed_supply()
    }

    pub const fn observed_allocation_total(&self) -> u64 {
        self.receipt.observed_allocation_total()
    }

    pub const fn lane_reserved_total(&self) -> u64 {
        self.lane_reserved_total
    }

    pub const fn lane_paid_total(&self) -> u64 {
        self.lane_paid_total
    }

    pub const fn lane_principal_claimed_total(&self) -> u64 {
        self.lane_principal_claimed_total
    }

    /// Commitment to the exact canonical mint, Config/vault identities, five
    /// public Token-2022 observations, and four strict Lane capabilities that
    /// produced this receipt. It is evidence data only, not authorization.
    pub const fn account_set_sha256(&self) -> [u8; 32] {
        self.account_set_sha256
    }

    pub(crate) fn matches_exact_account_set(
        &self,
        binding: &NativeEconomyBinding,
        canonical_mint: &ReadonlyCanonicalEconomyMint,
        token_accounts: &[ReadonlyPublicTokenAccount; GENESIS_ALLOCATION_COUNT],
        lane_states: &[AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1],
    ) -> Result<bool, GenesisConservationRuntimeError> {
        Ok(self.account_set_sha256
            == hash_authenticated_account_set(
                binding,
                canonical_mint,
                token_accounts,
                lane_states,
            )?)
    }

    pub(crate) const fn receipt(&self) -> &GenesisConservationReceipt {
        &self.receipt
    }

    #[cfg(test)]
    pub(crate) const fn from_test_receipt(
        receipt: GenesisConservationReceipt,
        config: [u8; 32],
        mint: [u8; 32],
        token_program: [u8; 32],
    ) -> Self {
        Self {
            receipt,
            config,
            mint,
            token_program,
            lane_reserved_total: 0,
            lane_paid_total: 0,
            lane_principal_claimed_total: 0,
            account_set_sha256: [0; 32],
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenesisConservationRuntimeError {
    Native(NativeAdapterError),
    Conservation(GenesisConservationError),
    MintBindingMismatch,
    TokenProgramBindingMismatch,
    CommunityCustodyMismatch,
    LaneCapabilityMismatch,
    LaneWritabilityMismatch,
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
    manifest: &GenesisAllocationManifest,
    canonical_mint: &ReadonlyCanonicalEconomyMint,
    token_accounts: &[ReadonlyPublicTokenAccount; GENESIS_ALLOCATION_COUNT],
    lane_states: &[AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1],
) -> Result<AuthenticatedGenesisConservationReceipt, GenesisConservationRuntimeError> {
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
            if authenticated.observed_writable() != GENESIS_ACTIVATE_LANE_WRITABILITY[index - 1] {
                return Err(GenesisConservationRuntimeError::LaneWritabilityMismatch);
            }
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

    let observed_mint = ObservedGenesisMint {
        key: canonical_mint.canonical_mint(),
        token_program: canonical_mint.token_2022_program(),
        decimals: canonical_mint.decimals(),
        supply: canonical_mint.supply(),
        mint_authority: None,
        freeze_authority: None,
    };
    let receipt =
        verify_genesis_allocation_conservation_parts(manifest, &observed_mint, &observations)
            .map_err(GenesisConservationRuntimeError::Conservation)?;

    Ok(AuthenticatedGenesisConservationReceipt {
        receipt,
        config: binding.config(),
        mint: canonical_mint.canonical_mint(),
        token_program: canonical_mint.token_2022_program(),
        // Every Lane capability above was authenticated and required to hold
        // exact zero-valued Genesis accounting fields.
        lane_reserved_total: 0,
        lane_paid_total: 0,
        lane_principal_claimed_total: 0,
        account_set_sha256: hash_authenticated_account_set(
            binding,
            canonical_mint,
            token_accounts,
            lane_states,
        )?,
    })
}

fn hash_authenticated_account_set(
    binding: &NativeEconomyBinding,
    canonical_mint: &ReadonlyCanonicalEconomyMint,
    token_accounts: &[ReadonlyPublicTokenAccount; GENESIS_ALLOCATION_COUNT],
    lane_states: &[AuthenticatedGenesisLaneCapability; GENESIS_ALLOCATION_COUNT - 1],
) -> Result<[u8; 32], GenesisConservationRuntimeError> {
    let vault_authority = derive_pda(
        binding,
        PdaIdentity::VaultAuthority {
            config: binding.config(),
        },
    )?
    .key;
    let mut hasher = Sha256::new();
    hasher.update(GENESIS_CONSERVATION_RUNTIME_ACCOUNT_SET_DOMAIN);
    hasher.update(binding.program_id());
    hasher.update(binding.config());
    hasher.update(vault_authority);
    hasher.update(canonical_mint.token_2022_program());
    hasher.update(canonical_mint.zk_elgamal_proof_program());
    hasher.update(canonical_mint.canonical_mint());
    hasher.update(canonical_mint.transfer_hook_program());
    hasher.update(canonical_mint.supply().to_le_bytes());
    hasher.update([canonical_mint.decimals()]);
    hasher.update((canonical_mint.data_len() as u64).to_le_bytes());
    for token in token_accounts {
        hasher.update(token.token_account());
        hasher.update(token.mint());
        hasher.update(token.wallet_owner());
        hasher.update(token.public_amount().to_le_bytes());
        hasher.update([u8::from(token.immutable_owner())]);
        hasher.update([u8::from(token.observed_writable())]);
        hasher.update((token.data_len() as u64).to_le_bytes());
    }
    for (index, lane) in lane_states.iter().enumerate() {
        if lane.observed_writable() != GENESIS_ACTIVATE_LANE_WRITABILITY[index] {
            return Err(GenesisConservationRuntimeError::LaneWritabilityMismatch);
        }
        hasher.update([GENESIS_ALLOCATION_ROLES[index + 1] as u8]);
        hasher.update(lane.key());
        hasher.update(lane.owner());
        hasher.update([u8::from(lane.observed_writable())]);
        hasher.update(lane.preimage_sha256());
    }
    Ok(hasher.finalize().into())
}

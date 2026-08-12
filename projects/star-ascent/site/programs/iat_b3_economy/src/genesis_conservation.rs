use sha2::{Digest, Sha256};

use crate::{COMMUNITY, CORE_TEAM, ECOSYSTEM, LIQUIDITY, MAINNET_SUPPLY, TOKEN_DECIMALS, TREASURY};

pub const GENESIS_ALLOCATION_COUNT: usize = 5;
pub const GENESIS_CONSERVATION_DOMAIN: &[u8] = b"IAT_B3_GENESIS_CONSERVATION_V2";
pub const GENESIS_ALLOCATION_ROLES: [GenesisAllocationRole; GENESIS_ALLOCATION_COUNT] = [
    GenesisAllocationRole::Community,
    GenesisAllocationRole::Treasury,
    GenesisAllocationRole::Ecosystem,
    GenesisAllocationRole::CoreTeam,
    GenesisAllocationRole::Liquidity,
];
pub const GENESIS_ALLOCATION_AMOUNTS: [u64; GENESIS_ALLOCATION_COUNT] = [
    500_000_000_000_000_000,
    200_000_000_000_000_000,
    150_000_000_000_000_000,
    100_000_000_000_000_000,
    50_000_000_000_000_000,
];
pub const GENESIS_VESTING_TERMS: [GenesisVestingTerms; GENESIS_ALLOCATION_COUNT] = [
    GenesisVestingTerms {
        genesis_unlocked: 500_000_000_000_000_000,
        cliff_week: 0,
        linear_end_week: 0,
    },
    GenesisVestingTerms {
        genesis_unlocked: 50_000_000_000_000_000,
        cliff_week: 52,
        linear_end_week: 208,
    },
    GenesisVestingTerms {
        genesis_unlocked: 37_500_000_000_000_000,
        cliff_week: 26,
        linear_end_week: 104,
    },
    GenesisVestingTerms {
        genesis_unlocked: 0,
        cliff_week: 26,
        linear_end_week: 104,
    },
    GenesisVestingTerms {
        genesis_unlocked: 12_500_000_000_000_000,
        cliff_week: 26,
        linear_end_week: 104,
    },
];

pub const GENESIS_CONSERVATION_STATUS: &str =
    "STRUCTURAL_ALLOCATION_AND_VESTING_CONSERVATION_VERIFIED_OWNER_AND_RUNTIME_EVIDENCE_REQUIRED_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisConservationTruth {
    pub fixed_supply_and_decimals_checked: bool,
    pub exact_allocation_arithmetic_checked: bool,
    pub exact_vesting_vectors_checked: bool,
    pub distinct_destination_accounts_checked: bool,
    pub distinct_beneficiaries_checked: bool,
    pub terminal_base_mint_authorities_checked: bool,
    pub owner_destination_manifest_accepted: bool,
    pub production_identity_binding_frozen: bool,
    pub runtime_account_authentication_present: bool,
    pub migration_or_no_prior_supply_proved: bool,
    pub transition_authorized: bool,
    pub mainnet_hold: bool,
}

pub const GENESIS_CONSERVATION_TRUTH: GenesisConservationTruth = GenesisConservationTruth {
    fixed_supply_and_decimals_checked: true,
    exact_allocation_arithmetic_checked: true,
    exact_vesting_vectors_checked: true,
    distinct_destination_accounts_checked: true,
    distinct_beneficiaries_checked: true,
    terminal_base_mint_authorities_checked: true,
    owner_destination_manifest_accepted: false,
    production_identity_binding_frozen: false,
    runtime_account_authentication_present: false,
    migration_or_no_prior_supply_proved: false,
    transition_authorized: false,
    mainnet_hold: true,
};

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenesisAllocationRole {
    Community = COMMUNITY,
    Treasury = TREASURY,
    Ecosystem = ECOSYSTEM,
    CoreTeam = CORE_TEAM,
    Liquidity = LIQUIDITY,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisVestingTerms {
    pub genesis_unlocked: u64,
    pub cliff_week: u64,
    pub linear_end_week: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisAllocationEntry {
    pub role: GenesisAllocationRole,
    pub token_account: [u8; 32],
    pub token_authority: [u8; 32],
    pub beneficiary: [u8; 32],
    pub amount: u64,
    pub vesting: GenesisVestingTerms,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisAllocationManifest {
    pub mint: [u8; 32],
    pub token_program: [u8; 32],
    pub entries: [GenesisAllocationEntry; GENESIS_ALLOCATION_COUNT],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ObservedGenesisMint {
    pub key: [u8; 32],
    pub token_program: [u8; 32],
    pub decimals: u8,
    pub supply: u64,
    pub mint_authority: Option<[u8; 32]>,
    pub freeze_authority: Option<[u8; 32]>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ObservedGenesisAllocation {
    pub role: GenesisAllocationRole,
    pub token_account: [u8; 32],
    pub token_program: [u8; 32],
    pub mint: [u8; 32],
    pub token_authority: [u8; 32],
    pub beneficiary_binding: [u8; 32],
    pub amount: u64,
    pub delegate: Option<[u8; 32]>,
    pub close_authority: Option<[u8; 32]>,
    pub delegated_amount: u64,
    pub frozen: bool,
    pub native: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisConservationInput {
    pub manifest: GenesisAllocationManifest,
    pub mint: ObservedGenesisMint,
    pub allocations: [ObservedGenesisAllocation; GENESIS_ALLOCATION_COUNT],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisConservationReceipt {
    manifest_mint: [u8; 32],
    manifest_token_program: [u8; 32],
    manifest_sha256: [u8; 32],
    observed_supply: u64,
    observed_allocation_total: u64,
}

impl GenesisConservationReceipt {
    pub const fn manifest_mint(&self) -> [u8; 32] {
        self.manifest_mint
    }

    pub const fn manifest_token_program(&self) -> [u8; 32] {
        self.manifest_token_program
    }

    pub const fn manifest_sha256(&self) -> [u8; 32] {
        self.manifest_sha256
    }

    pub const fn observed_supply(&self) -> u64 {
        self.observed_supply
    }

    pub const fn observed_allocation_total(&self) -> u64 {
        self.observed_allocation_total
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenesisConservationError {
    ZeroIdentity,
    WrongMint,
    WrongTokenProgram,
    WrongDecimals,
    WrongSupply,
    MintAuthorityNotTerminal,
    FreezeAuthorityNotTerminal,
    WrongRoleOrder,
    WrongAllocationAmount,
    WrongVestingVector,
    DuplicateDestinationAccount,
    DuplicateBeneficiary,
    AllocationObservationMismatch,
    UnsafeTokenAccountState,
    ArithmeticOverflow,
    ConservationMismatch,
}

pub fn verify_genesis_allocation_conservation(
    input: &GenesisConservationInput,
) -> Result<GenesisConservationReceipt, GenesisConservationError> {
    verify_genesis_allocation_conservation_parts(&input.manifest, &input.mint, &input.allocations)
}

/// Borrowed equivalent used by the authenticated runtime composer so the
/// larger exact-vector manifest is never duplicated in an SBF stack frame.
/// Validation and error ordering are shared with the public aggregate API.
pub(crate) fn verify_genesis_allocation_conservation_parts(
    manifest: &GenesisAllocationManifest,
    mint: &ObservedGenesisMint,
    allocations: &[ObservedGenesisAllocation; GENESIS_ALLOCATION_COUNT],
) -> Result<GenesisConservationReceipt, GenesisConservationError> {
    if is_zero(manifest.mint) || is_zero(manifest.token_program) {
        return Err(GenesisConservationError::ZeroIdentity);
    }
    if mint.key != manifest.mint {
        return Err(GenesisConservationError::WrongMint);
    }
    if mint.token_program != manifest.token_program {
        return Err(GenesisConservationError::WrongTokenProgram);
    }
    if mint.decimals != TOKEN_DECIMALS {
        return Err(GenesisConservationError::WrongDecimals);
    }
    if mint.supply != MAINNET_SUPPLY {
        return Err(GenesisConservationError::WrongSupply);
    }
    if mint.mint_authority.is_some() {
        return Err(GenesisConservationError::MintAuthorityNotTerminal);
    }
    if mint.freeze_authority.is_some() {
        return Err(GenesisConservationError::FreezeAuthorityNotTerminal);
    }

    let mut total = 0u64;
    for index in 0..GENESIS_ALLOCATION_COUNT {
        let entry = manifest.entries[index];
        let observation = allocations[index];
        if entry.role != GENESIS_ALLOCATION_ROLES[index]
            || observation.role != GENESIS_ALLOCATION_ROLES[index]
        {
            return Err(GenesisConservationError::WrongRoleOrder);
        }
        if entry.amount != GENESIS_ALLOCATION_AMOUNTS[index] {
            return Err(GenesisConservationError::WrongAllocationAmount);
        }
        if entry.vesting != GENESIS_VESTING_TERMS[index] {
            return Err(GenesisConservationError::WrongVestingVector);
        }
        if is_zero(entry.token_account)
            || is_zero(entry.token_authority)
            || is_zero(entry.beneficiary)
        {
            return Err(GenesisConservationError::ZeroIdentity);
        }
        for prior in 0..index {
            if entry.token_account == manifest.entries[prior].token_account {
                return Err(GenesisConservationError::DuplicateDestinationAccount);
            }
            if entry.beneficiary == manifest.entries[prior].beneficiary {
                return Err(GenesisConservationError::DuplicateBeneficiary);
            }
        }
        if observation.token_account != entry.token_account
            || observation.token_program != manifest.token_program
            || observation.mint != manifest.mint
            || observation.token_authority != entry.token_authority
            || observation.beneficiary_binding != entry.beneficiary
            || observation.amount != entry.amount
        {
            return Err(GenesisConservationError::AllocationObservationMismatch);
        }
        if observation.delegate.is_some()
            || observation.close_authority.is_some()
            || observation.delegated_amount != 0
            || observation.frozen
            || observation.native
        {
            return Err(GenesisConservationError::UnsafeTokenAccountState);
        }
        total = total
            .checked_add(observation.amount)
            .ok_or(GenesisConservationError::ArithmeticOverflow)?;
    }
    if total != MAINNET_SUPPLY || total != mint.supply {
        return Err(GenesisConservationError::ConservationMismatch);
    }

    Ok(GenesisConservationReceipt {
        manifest_mint: manifest.mint,
        manifest_token_program: manifest.token_program,
        manifest_sha256: genesis_allocation_manifest_sha256(manifest),
        observed_supply: mint.supply,
        observed_allocation_total: total,
    })
}

/// Canonical nonauthorizing commitment over the exact ordered allocation,
/// destination, beneficiary, and retained V2 vesting vectors. Exposing this
/// pure hash lets owner/reviewer packets bind proposed manifests even while
/// validation, runtime authentication, and transition authorization remain
/// separate fail-closed requirements.
pub fn genesis_allocation_manifest_sha256(manifest: &GenesisAllocationManifest) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(GENESIS_CONSERVATION_DOMAIN);
    hasher.update(manifest.mint);
    hasher.update(manifest.token_program);
    for entry in manifest.entries {
        hasher.update([entry.role as u8]);
        hasher.update(entry.token_account);
        hasher.update(entry.token_authority);
        hasher.update(entry.beneficiary);
        hasher.update(entry.amount.to_le_bytes());
        hasher.update(entry.vesting.genesis_unlocked.to_le_bytes());
        hasher.update(entry.vesting.cliff_week.to_le_bytes());
        hasher.update(entry.vesting.linear_end_week.to_le_bytes());
    }
    hasher.finalize().into()
}

const fn is_zero(value: [u8; 32]) -> bool {
    let mut index = 0;
    while index < value.len() {
        if value[index] != 0 {
            return false;
        }
        index += 1;
    }
    true
}

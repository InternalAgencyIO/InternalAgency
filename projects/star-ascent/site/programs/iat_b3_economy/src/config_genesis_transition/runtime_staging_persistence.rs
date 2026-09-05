//! Held runtime CAS for `UNINITIALIZED -> GENESIS_STAGING`.
//!
//! This closes the missing structural write path for the first Config/Genesis
//! edge without inventing bootstrap authority. The exact Config PDA, strict
//! preimage, admin signer meta, empty-economic-state predicate, and postimage
//! are committed before the single existing-account write. The execution
//! guard deliberately has no production constructor: owner bootstrap policy
//! and complete preactivation-history evidence remain unresolved.

extern crate alloc;

use alloc::boxed::Box;
use sha2::{Digest, Sha256};
use solana_account_info::AccountInfo;

use super::{
    prepare_enter_genesis_staging_candidate, ConfigGenesisTransitionCandidateError,
    GenesisPreactivationCandidateFacts,
};
use crate::native_adapter::NativeEconomyBinding;
use crate::{
    decode_config_genesis_state, encode_config_genesis_state, ConfigGenesisCodecError,
    ConfigGenesisState, GenesisPhase, CONFIG_GENESIS_ACCOUNT_LEN,
};

pub const CONFIG_GENESIS_STAGING_PERSISTENCE_DOMAIN: &[u8] =
    b"IAT_B3_CONFIG_GENESIS_STAGING_PERSISTENCE_V1";
pub const CONFIG_GENESIS_STAGING_PERSISTENCE_STATUS: &str =
    "HELD_ADMIN_SIGNED_EXACT_CONFIG_CAS_OWNER_POLICY_AND_HISTORY_UNPROVED_NO_ABI_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisStagingPersistenceTruth {
    pub feature_gated: bool,
    pub canonical_writable_config_pda_authenticated: bool,
    pub strict_uninitialized_preimage_authenticated: bool,
    pub admin_signer_meta_authenticated: bool,
    pub empty_economic_state_predicate_checked: bool,
    pub daily_law_deliberately_not_required: bool,
    pub exact_staging_postimage_committed: bool,
    pub single_existing_account_cas_implemented: bool,
    pub unit_rollback_surface_absent: bool,
    pub complete_preactivation_write_history_authenticated: bool,
    pub owner_bootstrap_policy_accepted: bool,
    pub production_execution_guard_constructible: bool,
    pub transition_authorized: bool,
    pub instruction_abi_frozen: bool,
    pub entrypoint_exposed: bool,
    pub dispatcher_exposed: bool,
    pub mainnet_hold: bool,
}

pub const CONFIG_GENESIS_STAGING_PERSISTENCE_TRUTH: ConfigGenesisStagingPersistenceTruth =
    ConfigGenesisStagingPersistenceTruth {
        feature_gated: true,
        canonical_writable_config_pda_authenticated: true,
        strict_uninitialized_preimage_authenticated: true,
        admin_signer_meta_authenticated: true,
        empty_economic_state_predicate_checked: true,
        daily_law_deliberately_not_required: true,
        exact_staging_postimage_committed: true,
        single_existing_account_cas_implemented: true,
        // This edge performs one fixed-length copy and has no CPI or second
        // account mutation from which an in-process partial commit can arise.
        unit_rollback_surface_absent: true,
        complete_preactivation_write_history_authenticated: false,
        owner_bootstrap_policy_accepted: false,
        production_execution_guard_constructible: false,
        transition_authorized: false,
        instruction_abi_frozen: false,
        entrypoint_exposed: false,
        dispatcher_exposed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConfigGenesisStagingPersistenceError {
    Candidate(ConfigGenesisTransitionCandidateError),
    Codec(ConfigGenesisCodecError),
    ConfigKeyMismatch,
    ConfigOwnerMismatch,
    ConfigMustBeWritable,
    ConfigMustNotBeSigner,
    ConfigMustNotBeExecutable,
    ConfigMintMismatch,
    ConfigBumpMismatch,
    AdminMismatch,
    AdminMustSign,
    AdminMustBeReadonly,
    AdminMustNotBeExecutable,
    AccountCollision,
    AccountBorrowFailed,
    ConfigPreimageMismatch,
    CommitmentMismatch,
}

impl From<ConfigGenesisTransitionCandidateError> for ConfigGenesisStagingPersistenceError {
    fn from(value: ConfigGenesisTransitionCandidateError) -> Self {
        Self::Candidate(value)
    }
}

impl From<ConfigGenesisCodecError> for ConfigGenesisStagingPersistenceError {
    fn from(value: ConfigGenesisCodecError) -> Self {
        Self::Codec(value)
    }
}

/// Opaque source-bound plan for the first Genesis phase edge. Private fields
/// prevent substituting a different admin, Config preimage, facts digest, or
/// staging postimage after review.
#[derive(Debug, Eq, PartialEq)]
pub struct HeldConfigGenesisStagingPersistencePlan {
    program_id: [u8; 32],
    mint: [u8; 32],
    config_key: [u8; 32],
    config_bump: u8,
    admin: [u8; 32],
    expected_preimage_sha256: [u8; 32],
    facts_sha256: [u8; 32],
    postimage_sha256: [u8; 32],
    postimage: [u8; CONFIG_GENESIS_ACCOUNT_LEN],
    commitment_sha256: [u8; 32],
}

impl HeldConfigGenesisStagingPersistencePlan {
    pub const fn config_key(&self) -> [u8; 32] {
        self.config_key
    }

    pub const fn admin(&self) -> [u8; 32] {
        self.admin
    }

    pub const fn expected_preimage_sha256(&self) -> [u8; 32] {
        self.expected_preimage_sha256
    }

    pub const fn facts_sha256(&self) -> [u8; 32] {
        self.facts_sha256
    }

    pub const fn postimage_sha256(&self) -> [u8; 32] {
        self.postimage_sha256
    }

    pub const fn commitment_sha256(&self) -> [u8; 32] {
        self.commitment_sha256
    }
}

/// Deliberately unavailable to production. A reviewed owner-policy capability
/// must replace this held guard; callers cannot convert an admin signature
/// alone into bootstrap authorization.
#[derive(Debug)]
pub struct ConfigGenesisStagingPersistenceExecutionGuard {
    _private: (),
}

impl ConfigGenesisStagingPersistenceExecutionGuard {
    #[cfg(test)]
    pub(crate) const fn for_test() -> Self {
        Self { _private: () }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConfigGenesisStagingPersistenceReceipt {
    commitment_sha256: [u8; 32],
    preimage_sha256: [u8; 32],
    postimage_sha256: [u8; 32],
}

impl ConfigGenesisStagingPersistenceReceipt {
    pub const fn commitment_sha256(&self) -> [u8; 32] {
        self.commitment_sha256
    }

    pub const fn preimage_sha256(&self) -> [u8; 32] {
        self.preimage_sha256
    }

    pub const fn postimage_sha256(&self) -> [u8; 32] {
        self.postimage_sha256
    }
}

/// Authenticate the exact existing Config and admin signer, run the retained
/// empty-state predicate, and seal its single staging CAS. This function only
/// reads AccountInfo data and cannot authorize or execute the edge.
pub fn prepare_held_config_genesis_staging_persistence_plan(
    binding: &NativeEconomyBinding,
    config_account: &AccountInfo<'_>,
    admin_account: &AccountInfo<'_>,
    facts: GenesisPreactivationCandidateFacts,
) -> Result<Box<HeldConfigGenesisStagingPersistencePlan>, ConfigGenesisStagingPersistenceError> {
    let (current, expected_preimage_sha256) =
        authenticate_config_and_admin(binding, config_account, admin_account)?;
    let candidate = prepare_enter_genesis_staging_candidate(current, facts)?;
    let next = candidate.next_state();
    let mut postimage = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(&next, &mut postimage)?;
    let postimage_sha256 = sha256(&postimage);
    let facts_sha256 = candidate.candidate_facts_sha256();
    let commitment_sha256 = hash_plan(
        binding.program_id(),
        binding.mint(),
        binding.config(),
        binding.config_bump(),
        current.config.admin,
        expected_preimage_sha256,
        facts_sha256,
        postimage_sha256,
    );
    Ok(Box::new(HeldConfigGenesisStagingPersistencePlan {
        program_id: binding.program_id(),
        mint: binding.mint(),
        config_key: binding.config(),
        config_bump: binding.config_bump(),
        admin: current.config.admin,
        expected_preimage_sha256,
        facts_sha256,
        postimage_sha256,
        postimage,
        commitment_sha256,
    }))
}

/// Execute the exact single-account CAS behind the held guard. All fallible
/// checks complete before the fixed-length copy, and there is no CPI or other
/// account write on this edge.
pub fn execute_held_config_genesis_staging_persistence_plan(
    _guard: ConfigGenesisStagingPersistenceExecutionGuard,
    binding: &NativeEconomyBinding,
    plan: Box<HeldConfigGenesisStagingPersistencePlan>,
    config_account: &AccountInfo<'_>,
    admin_account: &AccountInfo<'_>,
) -> Result<ConfigGenesisStagingPersistenceReceipt, ConfigGenesisStagingPersistenceError> {
    require_plan_binding(binding, &plan)?;
    require_account_headers(binding, plan.admin, config_account, admin_account)?;
    if plan.commitment_sha256
        != hash_plan(
            plan.program_id,
            plan.mint,
            plan.config_key,
            plan.config_bump,
            plan.admin,
            plan.expected_preimage_sha256,
            plan.facts_sha256,
            plan.postimage_sha256,
        )
        || sha256(&plan.postimage) != plan.postimage_sha256
    {
        return Err(ConfigGenesisStagingPersistenceError::CommitmentMismatch);
    }

    let mut live = config_account
        .try_borrow_mut_data()
        .map_err(|_| ConfigGenesisStagingPersistenceError::AccountBorrowFailed)?;
    let current = decode_config_genesis_state(&live)?;
    if current.phase != GenesisPhase::Uninitialized
        || current.config.admin != plan.admin
        || current.config.mint != plan.mint
        || current.config.bump != plan.config_bump
        || sha256(&live) != plan.expected_preimage_sha256
    {
        return Err(ConfigGenesisStagingPersistenceError::ConfigPreimageMismatch);
    }

    live.copy_from_slice(&plan.postimage);
    Ok(ConfigGenesisStagingPersistenceReceipt {
        commitment_sha256: plan.commitment_sha256,
        preimage_sha256: plan.expected_preimage_sha256,
        postimage_sha256: plan.postimage_sha256,
    })
}

fn authenticate_config_and_admin(
    binding: &NativeEconomyBinding,
    config_account: &AccountInfo<'_>,
    admin_account: &AccountInfo<'_>,
) -> Result<(ConfigGenesisState, [u8; 32]), ConfigGenesisStagingPersistenceError> {
    require_account_headers(
        binding,
        admin_account.key.to_bytes(),
        config_account,
        admin_account,
    )?;
    let data = config_account
        .try_borrow_data()
        .map_err(|_| ConfigGenesisStagingPersistenceError::AccountBorrowFailed)?;
    let current = decode_config_genesis_state(&data)?;
    if current.config.mint != binding.mint() {
        return Err(ConfigGenesisStagingPersistenceError::ConfigMintMismatch);
    }
    if current.config.bump != binding.config_bump() {
        return Err(ConfigGenesisStagingPersistenceError::ConfigBumpMismatch);
    }
    if current.config.admin != admin_account.key.to_bytes() {
        return Err(ConfigGenesisStagingPersistenceError::AdminMismatch);
    }
    Ok((current, sha256(&data)))
}

fn require_plan_binding(
    binding: &NativeEconomyBinding,
    plan: &HeldConfigGenesisStagingPersistencePlan,
) -> Result<(), ConfigGenesisStagingPersistenceError> {
    if plan.program_id != binding.program_id()
        || plan.mint != binding.mint()
        || plan.config_key != binding.config()
        || plan.config_bump != binding.config_bump()
    {
        return Err(ConfigGenesisStagingPersistenceError::CommitmentMismatch);
    }
    Ok(())
}

fn require_account_headers(
    binding: &NativeEconomyBinding,
    expected_admin: [u8; 32],
    config_account: &AccountInfo<'_>,
    admin_account: &AccountInfo<'_>,
) -> Result<(), ConfigGenesisStagingPersistenceError> {
    if config_account.key.to_bytes() != binding.config() {
        return Err(ConfigGenesisStagingPersistenceError::ConfigKeyMismatch);
    }
    if config_account.owner.to_bytes() != binding.program_id() {
        return Err(ConfigGenesisStagingPersistenceError::ConfigOwnerMismatch);
    }
    if !config_account.is_writable {
        return Err(ConfigGenesisStagingPersistenceError::ConfigMustBeWritable);
    }
    if config_account.is_signer {
        return Err(ConfigGenesisStagingPersistenceError::ConfigMustNotBeSigner);
    }
    if config_account.executable {
        return Err(ConfigGenesisStagingPersistenceError::ConfigMustNotBeExecutable);
    }
    if admin_account.key.to_bytes() != expected_admin {
        return Err(ConfigGenesisStagingPersistenceError::AdminMismatch);
    }
    if !admin_account.is_signer {
        return Err(ConfigGenesisStagingPersistenceError::AdminMustSign);
    }
    if admin_account.is_writable {
        return Err(ConfigGenesisStagingPersistenceError::AdminMustBeReadonly);
    }
    if admin_account.executable {
        return Err(ConfigGenesisStagingPersistenceError::AdminMustNotBeExecutable);
    }
    if admin_account.key == config_account.key {
        return Err(ConfigGenesisStagingPersistenceError::AccountCollision);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn hash_plan(
    program_id: [u8; 32],
    mint: [u8; 32],
    config_key: [u8; 32],
    config_bump: u8,
    admin: [u8; 32],
    preimage_sha256: [u8; 32],
    facts_sha256: [u8; 32],
    postimage_sha256: [u8; 32],
) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(CONFIG_GENESIS_STAGING_PERSISTENCE_DOMAIN);
    hash.update(program_id);
    hash.update(mint);
    hash.update(config_key);
    hash.update([config_bump]);
    hash.update(admin);
    hash.update(preimage_sha256);
    hash.update(facts_sha256);
    hash.update(postimage_sha256);
    hash.finalize().into()
}

fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ConfigState, MAINNET_SUPPLY};
    use solana_pubkey::Pubkey;

    const PROGRAM: [u8; 32] = [0xE1; 32];
    const MINT: [u8; 32] = [0x22; 32];
    const ADMIN: [u8; 32] = [0xA1; 32];

    struct TestAccount {
        key: Pubkey,
        owner: Pubkey,
        lamports: u64,
        data: Vec<u8>,
        is_signer: bool,
        is_writable: bool,
        executable: bool,
    }

    impl TestAccount {
        fn info(&mut self) -> AccountInfo<'_> {
            AccountInfo::new(
                &self.key,
                self.is_signer,
                self.is_writable,
                &mut self.lamports,
                &mut self.data,
                &self.owner,
                self.executable,
            )
        }
    }

    fn facts() -> GenesisPreactivationCandidateFacts {
        GenesisPreactivationCandidateFacts {
            config_staked_principal: 0,
            config_agency_count: 0,
            lane_reserved_total: 0,
            lane_paid_total: 0,
            lane_principal_claimed_total: 0,
        }
    }

    fn config_state(binding: &NativeEconomyBinding) -> ConfigGenesisState {
        ConfigGenesisState {
            phase: GenesisPhase::Uninitialized,
            config: ConfigState {
                admin: ADMIN,
                mint: MINT,
                token_program: [0x33; 32],
                randomness_program: [0x44; 32],
                stake_token_account: [0; 32],
                agency_registry_hash: [0; 32],
                genesis_timestamp: 1_786_050_000,
                expected_supply: MAINNET_SUPPLY,
                staked_principal: 0,
                agency_count: 0,
                rehearsal_mode: false,
                active: false,
                lane_mask: 0,
                stake_vault_initialized: false,
                bump: binding.config_bump(),
                vault_authority_bump: 253,
            },
        }
    }

    fn accounts() -> (NativeEconomyBinding, TestAccount, TestAccount) {
        let binding = NativeEconomyBinding::new(PROGRAM, MINT).unwrap();
        let mut data = vec![0u8; CONFIG_GENESIS_ACCOUNT_LEN];
        encode_config_genesis_state(&config_state(&binding), &mut data).unwrap();
        let config = TestAccount {
            key: binding.config().into(),
            owner: PROGRAM.into(),
            lamports: 1,
            data,
            is_signer: false,
            is_writable: true,
            executable: false,
        };
        let admin = TestAccount {
            key: ADMIN.into(),
            owner: solana_sdk_ids::system_program::ID,
            lamports: 1,
            data: Vec::new(),
            is_signer: true,
            is_writable: false,
            executable: false,
        };
        (binding, config, admin)
    }

    #[test]
    fn exact_admin_signed_config_cas_enters_staging() {
        let (binding, mut config, mut admin) = accounts();
        let config_info = config.info();
        let admin_info = admin.info();
        let plan = prepare_held_config_genesis_staging_persistence_plan(
            &binding,
            &config_info,
            &admin_info,
            facts(),
        )
        .unwrap();
        let expected_commitment = plan.commitment_sha256();
        let expected_postimage = plan.postimage_sha256();
        let receipt = execute_held_config_genesis_staging_persistence_plan(
            ConfigGenesisStagingPersistenceExecutionGuard::for_test(),
            &binding,
            plan,
            &config_info,
            &admin_info,
        )
        .unwrap();
        assert_eq!(receipt.commitment_sha256(), expected_commitment);
        assert_eq!(receipt.postimage_sha256(), expected_postimage);
        drop(admin_info);
        drop(config_info);
        let staged = decode_config_genesis_state(&config.data).unwrap();
        assert_eq!(staged.phase, GenesisPhase::GenesisStaging);
        assert!(!staged.config.active);
    }

    #[test]
    fn nonvacuous_facts_and_admin_meta_fail_before_write() {
        let (binding, mut config, mut admin) = accounts();
        let original = config.data.clone();
        let config_info = config.info();
        let admin_info = admin.info();
        let mut nonvacuous = facts();
        nonvacuous.lane_paid_total = 1;
        assert_eq!(
            prepare_held_config_genesis_staging_persistence_plan(
                &binding,
                &config_info,
                &admin_info,
                nonvacuous,
            ),
            Err(ConfigGenesisStagingPersistenceError::Candidate(
                ConfigGenesisTransitionCandidateError::PreactivationEconomicStateNotVacuous,
            ))
        );
        drop(admin_info);
        drop(config_info);
        assert_eq!(config.data, original);

        admin.is_signer = false;
        let config_info = config.info();
        let admin_info = admin.info();
        assert_eq!(
            prepare_held_config_genesis_staging_persistence_plan(
                &binding,
                &config_info,
                &admin_info,
                facts(),
            ),
            Err(ConfigGenesisStagingPersistenceError::AdminMustSign)
        );
    }

    #[test]
    fn stale_config_preimage_is_rejected_without_mutation() {
        let (binding, mut config, mut admin) = accounts();
        let config_info = config.info();
        let admin_info = admin.info();
        let plan = prepare_held_config_genesis_staging_persistence_plan(
            &binding,
            &config_info,
            &admin_info,
            facts(),
        )
        .unwrap();
        {
            let mut data = config_info.try_borrow_mut_data().unwrap();
            data[CONFIG_GENESIS_ACCOUNT_LEN - 1] ^= 1;
        }
        let drifted = config_info.try_borrow_data().unwrap().to_vec();
        assert_eq!(
            execute_held_config_genesis_staging_persistence_plan(
                ConfigGenesisStagingPersistenceExecutionGuard::for_test(),
                &binding,
                plan,
                &config_info,
                &admin_info,
            ),
            Err(ConfigGenesisStagingPersistenceError::Codec(
                ConfigGenesisCodecError::ReservedBytesNonZero,
            ))
        );
        assert_eq!(
            &config_info.try_borrow_data().unwrap()[..],
            drifted.as_slice()
        );
    }

    #[test]
    fn truth_boundary_keeps_history_policy_and_dispatch_held() {
        assert!(CONFIG_GENESIS_STAGING_PERSISTENCE_STATUS.ends_with("MAINNET_HOLD"));
        assert_eq!(
            CONFIG_GENESIS_STAGING_PERSISTENCE_TRUTH,
            ConfigGenesisStagingPersistenceTruth {
                feature_gated: true,
                canonical_writable_config_pda_authenticated: true,
                strict_uninitialized_preimage_authenticated: true,
                admin_signer_meta_authenticated: true,
                empty_economic_state_predicate_checked: true,
                daily_law_deliberately_not_required: true,
                exact_staging_postimage_committed: true,
                single_existing_account_cas_implemented: true,
                unit_rollback_surface_absent: true,
                complete_preactivation_write_history_authenticated: false,
                owner_bootstrap_policy_accepted: false,
                production_execution_guard_constructible: false,
                transition_authorized: false,
                instruction_abi_frozen: false,
                entrypoint_exposed: false,
                dispatcher_exposed: false,
                mainnet_hold: true,
            }
        );
    }
}

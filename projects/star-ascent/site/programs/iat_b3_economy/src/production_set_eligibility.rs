//! Exact retained-V2 `set_eligibility` composition through a sealed lifecycle
//! plan.
//!
//! This module binds the frozen instruction bytes and five-account order to
//! the production-ACTIVE Config, its administrator, the public wallet key, the
//! exact wallet-scoped Eligibility PDA, and the retained V2 transition. It
//! returns an opaque existing-CAS-or-init plan but deliberately exposes no
//! executor, dispatcher, or entrypoint and claims no complete handler.

use crate::native_adapter::{
    derive_pda, NativeAdapterError, NativeEconomyBinding, PdaIdentity, StrictStateKind,
    StrictStateValue,
};
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
#[cfg(test)]
use crate::runtime_account_lifecycle::prepare_production_active_init_if_needed_constraints_with_rent;
use crate::runtime_account_lifecycle::{
    prepare_production_active_init_if_needed_constraints_account_infos, require_system_program,
    seal_production_active_init_if_needed_postimage, PreparedProductionInitIfNeeded,
    ProductionInitIfNeededPath, RuntimeAccountLifecycleError,
};
use crate::runtime_adapter::{
    authenticate_production_active_config_account_info,
    authenticate_runtime_production_active_config, authenticate_state_account_info,
    authenticate_system_payer_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
    RuntimeValidatedDailyLawWrite,
};
use crate::{
    set_eligibility, EconomyError, EligibilityState, SetEligibilityInput, ValidatedDailyLawWrite,
};
use solana_account_info::AccountInfo;
#[cfg(test)]
use solana_rent::Rent;
use solana_sdk_ids::system_program;

pub const PRODUCTION_SET_ELIGIBILITY_ACCOUNT_COUNT: usize = 5;
pub const PRODUCTION_SET_ELIGIBILITY_STATUS: &str =
    "EXACT_V2_COMPOSITION_SEALED_INIT_IF_NEEDED_PLAN_NO_EXECUTOR_NO_ENTRYPOINT_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionSetEligibilityTruth {
    pub feature_gated: bool,
    pub exact_instruction_codec_required: bool,
    pub runtime_daily_law_capability_supported: bool,
    pub production_active_config_required: bool,
    pub exact_five_account_order_and_flags_required: bool,
    pub public_wallet_key_bound: bool,
    pub exact_wallet_eligibility_pda_authenticated: bool,
    pub init_if_needed_pre_cpi_facts_precede_retained_v2_body: bool,
    pub existing_eligibility_rent_exemption_required: bool,
    pub retained_v2_transition_used: bool,
    pub role_bearing_postimage_sealed_only_after_transition: bool,
    pub sealed_existing_or_init_lifecycle_plan_returned: bool,
    pub account_write_executed: bool,
    pub system_cpi_executed: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub devnet_executed: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_SET_ELIGIBILITY_TRUTH: ProductionSetEligibilityTruth =
    ProductionSetEligibilityTruth {
        feature_gated: true,
        exact_instruction_codec_required: true,
        runtime_daily_law_capability_supported: true,
        production_active_config_required: true,
        exact_five_account_order_and_flags_required: true,
        public_wallet_key_bound: true,
        exact_wallet_eligibility_pda_authenticated: true,
        init_if_needed_pre_cpi_facts_precede_retained_v2_body: true,
        existing_eligibility_rent_exemption_required: true,
        retained_v2_transition_used: true,
        role_bearing_postimage_sealed_only_after_transition: true,
        sealed_existing_or_init_lifecycle_plan_returned: true,
        account_write_executed: false,
        system_cpi_executed: false,
        production_dispatcher_exposed: false,
        production_entrypoint_exposed: false,
        handler_complete: false,
        devnet_executed: false,
        mainnet_hold: true,
    };

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProductionSetEligibilityError {
    Instruction(ProductionInstructionError),
    WrongInstruction,
    AccountCountMismatch,
    WalletMetaMismatch,
    Runtime(RuntimeAdapterError),
    Native(NativeAdapterError),
    Economy(EconomyError),
    Lifecycle(RuntimeAccountLifecycleError),
    RetainedV2PostimageMismatch,
}

impl From<ProductionInstructionError> for ProductionSetEligibilityError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

impl From<RuntimeAdapterError> for ProductionSetEligibilityError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<NativeAdapterError> for ProductionSetEligibilityError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<EconomyError> for ProductionSetEligibilityError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

impl From<RuntimeAccountLifecycleError> for ProductionSetEligibilityError {
    fn from(value: RuntimeAccountLifecycleError) -> Self {
        Self::Lifecycle(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PreparedProductionSetEligibility {
    config: [u8; 32],
    admin: [u8; 32],
    wallet: [u8; 32],
    eligibility: [u8; 32],
    next: EligibilityState,
    lifecycle: PreparedProductionInitIfNeeded,
}

impl PreparedProductionSetEligibility {
    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn admin(&self) -> [u8; 32] {
        self.admin
    }

    pub const fn wallet(&self) -> [u8; 32] {
        self.wallet
    }

    pub const fn eligibility(&self) -> [u8; 32] {
        self.eligibility
    }

    pub const fn next(&self) -> EligibilityState {
        self.next
    }

    pub const fn lifecycle_path(&self) -> ProductionInitIfNeededPath {
        self.lifecycle.path()
    }

    pub const fn rent_minimum_lamports(&self) -> Option<u64> {
        self.lifecycle.rent_minimum_lamports()
    }

    pub const fn batch_commitment_sha256(&self) -> [u8; 32] {
        self.lifecycle.batch_commitment_sha256()
    }
}

#[derive(Clone, Copy)]
struct PreparedSetEligibilityKernel {
    wallet: [u8; 32],
    identity: PdaIdentity,
    input: SetEligibilityInput,
    projected_next: EligibilityState,
}

/// Runtime production composition. The opaque Law capability and live Config
/// account are authenticated before the retained V2 kernel or lifecycle
/// planner runs. This function only returns a sealed plan; it writes nothing.
#[inline(never)]
pub fn prepare_runtime_production_set_eligibility_account_infos(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionSetEligibility, ProductionSetEligibilityError> {
    let (role, agency_index) = require_set_eligibility_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let active_config =
        authenticate_runtime_production_active_config(runtime_law, binding, &accounts[1])?;
    prepare_with_active_config(
        runtime_law.gate(),
        &active_config,
        binding,
        accounts,
        role,
        agency_index,
    )
}

/// Host/rehearsal composition seam. Final runtime composition must use
/// [`prepare_runtime_production_set_eligibility_account_infos`] so the Law
/// account and Clock remain opaque runtime facts.
#[inline(never)]
pub fn prepare_production_set_eligibility_account_infos(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionSetEligibility, ProductionSetEligibilityError> {
    let (role, agency_index) = require_set_eligibility_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let active_config =
        authenticate_production_active_config_account_info(gate, binding, &accounts[1])?;
    prepare_with_active_config(gate, &active_config, binding, accounts, role, agency_index)
}

fn require_set_eligibility_instruction(
    instruction_data: &[u8],
) -> Result<(u8, Option<u32>), ProductionSetEligibilityError> {
    match decode_production_instruction(instruction_data)? {
        ProductionInstruction::SetEligibility { role, agency_index } => Ok((role, agency_index)),
        _ => Err(ProductionSetEligibilityError::WrongInstruction),
    }
}

fn require_exact_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionSetEligibilityError> {
    if accounts.len() != PRODUCTION_SET_ELIGIBILITY_ACCOUNT_COUNT {
        return Err(ProductionSetEligibilityError::AccountCountMismatch);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn prepare_with_active_config(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
    role: u8,
    agency_index: Option<u32>,
) -> Result<PreparedProductionSetEligibility, ProductionSetEligibilityError> {
    let kernel = prepare_kernel_inputs(gate, active_config, binding, accounts, role, agency_index)?;
    // Anchor 1.0.2 executes its full `init_if_needed` lifecycle before entering
    // the handler body, but it does not serialize that body's next state during
    // constraint evaluation. This nonexecuting seam validates and plans only
    // the pre-CPI Rent, payer-funding, target-shape, and CAS facts before the
    // retained error ordering begins below. System CPIs and their post-CPI
    // assertions remain executor work and are truthfully false in this module.
    let constraints = prepare_production_active_init_if_needed_constraints_account_infos(
        gate,
        active_config,
        binding,
        &accounts[0],
        &accounts[3],
        &accounts[4],
        kernel.identity,
        StrictStateKind::Eligibility,
    )?;
    let result = set_eligibility(gate, kernel.input)?;
    if result.eligibility != kernel.projected_next {
        return Err(ProductionSetEligibilityError::RetainedV2PostimageMismatch);
    }
    let lifecycle = seal_production_active_init_if_needed_postimage(
        gate,
        binding,
        constraints,
        StrictStateValue::Eligibility(result.eligibility),
    )?;
    Ok(finish_plan(
        active_config,
        accounts,
        kernel,
        result.eligibility,
        lifecycle,
    ))
}

#[allow(clippy::too_many_arguments)]
fn prepare_kernel_inputs(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
    role: u8,
    agency_index: Option<u32>,
) -> Result<PreparedSetEligibilityKernel, ProductionSetEligibilityError> {
    let config = active_config.state().config;
    authenticate_system_payer_account_info(gate, binding, &accounts[0], config.admin)?;
    require_wallet_meta(&accounts[2])?;
    require_system_program(&accounts[4])?;

    let wallet = accounts[2].key.to_bytes();
    let identity = PdaIdentity::Eligibility {
        config: active_config.key(),
        operator: wallet,
    };
    let derived = derive_pda(binding, identity)?;
    require_eligibility_target_shape(gate, binding, &accounts[3], identity, derived.key)?;

    let input = SetEligibilityInput {
        config_key: active_config.key(),
        config,
        wallet,
        role,
        agency_index,
        eligibility_bump: derived.bump,
    };
    Ok(PreparedSetEligibilityKernel {
        wallet,
        identity,
        input,
        projected_next: EligibilityState {
            config: input.config_key,
            wallet: input.wallet,
            agency_index: input.agency_index.unwrap_or(u32::MAX),
            role: input.role,
            bump: input.eligibility_bump,
        },
    })
}

fn require_wallet_meta(account: &AccountInfo<'_>) -> Result<(), ProductionSetEligibilityError> {
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionSetEligibilityError::WalletMetaMismatch);
    }
    Ok(())
}

fn require_eligibility_target_shape(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    target: &AccountInfo<'_>,
    identity: PdaIdentity,
    expected_key: [u8; 32],
) -> Result<(), ProductionSetEligibilityError> {
    if target.key.to_bytes() != expected_key {
        return Err(ProductionSetEligibilityError::Native(
            NativeAdapterError::AccountKeyMismatch,
        ));
    }
    if !target.is_writable {
        return Err(ProductionSetEligibilityError::Native(
            NativeAdapterError::AccountMustBeWritable,
        ));
    }
    if target.is_signer {
        return Err(ProductionSetEligibilityError::Native(
            NativeAdapterError::PdaAccountMustNotBeSigner,
        ));
    }
    if target.executable {
        return Err(ProductionSetEligibilityError::Native(
            NativeAdapterError::AccountMustNotBeExecutable,
        ));
    }

    if target.owner.to_bytes() == binding.program_id() {
        authenticate_state_account_info(gate, binding, target, identity)?;
        return Ok(());
    }
    if target.owner.to_bytes() != system_program::ID.to_bytes() {
        return Err(ProductionSetEligibilityError::Lifecycle(
            RuntimeAccountLifecycleError::InitIfNeededTargetShapeMismatch,
        ));
    }
    let data = target
        .try_borrow_data()
        .map_err(|_| RuntimeAccountLifecycleError::AccountBorrowFailed)?;
    if !data.is_empty() {
        return Err(ProductionSetEligibilityError::Native(
            NativeAdapterError::VacantAccountDataNotEmpty,
        ));
    }
    Ok(())
}

fn finish_plan(
    active_config: &RuntimeProductionActiveConfig,
    accounts: &[AccountInfo<'_>],
    kernel: PreparedSetEligibilityKernel,
    next: EligibilityState,
    lifecycle: PreparedProductionInitIfNeeded,
) -> PreparedProductionSetEligibility {
    PreparedProductionSetEligibility {
        config: active_config.key(),
        admin: active_config.state().config.admin,
        wallet: kernel.wallet,
        eligibility: accounts[3].key.to_bytes(),
        next,
        lifecycle,
    }
}

#[cfg(test)]
#[allow(clippy::too_many_arguments)]
fn prepare_production_set_eligibility_with_rent(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
    rent: Option<&Rent>,
) -> Result<PreparedProductionSetEligibility, ProductionSetEligibilityError> {
    let (role, agency_index) = require_set_eligibility_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let active_config =
        authenticate_production_active_config_account_info(gate, binding, &accounts[1])?;
    let kernel =
        prepare_kernel_inputs(gate, &active_config, binding, accounts, role, agency_index)?;
    // Test-only injected Rent preserves the same pre-CPI-facts-before-handler
    // ordering as the runtime path above.
    let constraints = prepare_production_active_init_if_needed_constraints_with_rent(
        gate,
        &active_config,
        binding,
        &accounts[0],
        &accounts[3],
        &accounts[4],
        kernel.identity,
        StrictStateKind::Eligibility,
        rent,
    )?;
    let result = set_eligibility(gate, kernel.input)?;
    if result.eligibility != kernel.projected_next {
        return Err(ProductionSetEligibilityError::RetainedV2PostimageMismatch);
    }
    let lifecycle = seal_production_active_init_if_needed_postimage(
        gate,
        binding,
        constraints,
        StrictStateValue::Eligibility(result.eligibility),
    )?;
    Ok(finish_plan(
        &active_config,
        accounts,
        kernel,
        result.eligibility,
        lifecycle,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_adapter::derive_pda;
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::runtime_account_lifecycle::{
        execute_production_active_init_if_needed_account_infos, ProductionInitIfNeededReceipt,
    };
    use crate::{
        decode_eligibility_state, encode_config_genesis_state, encode_eligibility_state,
        verify_daily_law_open, CanonicalDailyLawBinding, ConfigGenesisState, ConfigState,
        GenesisPhase, ReadonlyDailyLawAccount, CONFIG_GENESIS_ACCOUNT_LEN, ELIGIBILITY_ACCOUNT_LEN,
        LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, MAINNET_SUPPLY,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_pubkey::Pubkey;
    use solana_sdk_ids::{native_loader, system_program};

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const ADMIN: [u8; 32] = [0x21; 32];
    const WALLET: [u8; 32] = [0xA1; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_050_060;

    fn binding() -> NativeEconomyBinding {
        NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
    }

    fn open_gate() -> ValidatedDailyLawWrite {
        let decision = open_decision(CLOCK_TIMESTAMP);
        let data = pack_law_state(decision);
        verify_daily_law_open(
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
            CLOCK_TIMESTAMP,
        )
        .unwrap()
    }

    fn open_decision(timestamp: i64) -> SolanaDailyDecision {
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

    fn encoded(instruction: ProductionInstruction) -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut data = [0u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(instruction, &mut data).unwrap();
        data
    }

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

    #[derive(Clone, Copy)]
    enum EligibilityShape {
        Existing,
        SystemOwned { lamports: u64 },
    }

    struct Fixture {
        admin: TestAccount,
        config: TestAccount,
        wallet: TestAccount,
        eligibility: TestAccount,
        system: TestAccount,
    }

    impl Fixture {
        fn new(binding: &NativeEconomyBinding, shape: EligibilityShape) -> Self {
            let config_state = ConfigGenesisState {
                phase: GenesisPhase::Active,
                config: ConfigState {
                    admin: ADMIN,
                    mint: MINT,
                    token_program: [0x33; 32],
                    randomness_program: [0x44; 32],
                    stake_token_account: [0x55; 32],
                    agency_registry_hash: [0x66; 32],
                    genesis_timestamp: CLOCK_TIMESTAMP - 60,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: 1_000,
                    agency_count: 2,
                    rehearsal_mode: false,
                    active: true,
                    lane_mask: 0b1_1110,
                    stake_vault_initialized: true,
                    bump: binding.config_bump(),
                    vault_authority_bump: 202,
                },
            };
            let mut config_data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
            encode_config_genesis_state(&config_state, &mut config_data).unwrap();

            let identity = PdaIdentity::Eligibility {
                config: binding.config(),
                operator: WALLET,
            };
            let derived = derive_pda(binding, identity).unwrap();
            let (eligibility_owner, eligibility_lamports, eligibility_data) = match shape {
                EligibilityShape::Existing => {
                    let current = EligibilityState {
                        config: binding.config(),
                        wallet: WALLET,
                        agency_index: 0,
                        role: 1,
                        bump: derived.bump,
                    };
                    let mut data = [0u8; ELIGIBILITY_ACCOUNT_LEN];
                    encode_eligibility_state(&current, &mut data).unwrap();
                    (
                        Pubkey::new_from_array(ECONOMY_PROGRAM),
                        Rent::default().minimum_balance(ELIGIBILITY_ACCOUNT_LEN),
                        data.to_vec(),
                    )
                }
                EligibilityShape::SystemOwned { lamports } => {
                    (system_program::ID, lamports, Vec::new())
                }
            };

            Self {
                admin: TestAccount {
                    key: ADMIN.into(),
                    owner: system_program::ID,
                    lamports: 10_000_000,
                    data: Vec::new(),
                    is_signer: true,
                    is_writable: true,
                    executable: false,
                },
                config: TestAccount {
                    key: binding.config().into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: config_data.to_vec(),
                    is_signer: false,
                    is_writable: false,
                    executable: false,
                },
                wallet: TestAccount {
                    key: WALLET.into(),
                    owner: system_program::ID,
                    lamports: 1,
                    data: Vec::new(),
                    is_signer: false,
                    is_writable: false,
                    executable: false,
                },
                eligibility: TestAccount {
                    key: derived.key.into(),
                    owner: eligibility_owner,
                    lamports: eligibility_lamports,
                    data: eligibility_data,
                    is_signer: false,
                    is_writable: true,
                    executable: false,
                },
                system: TestAccount {
                    key: system_program::ID,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    is_signer: false,
                    is_writable: false,
                    executable: true,
                },
            }
        }

        fn with_infos<R>(&mut self, operation: impl FnOnce(&mut [AccountInfo<'_>; 5]) -> R) -> R {
            let mut infos = [
                self.admin.info(),
                self.config.info(),
                self.wallet.info(),
                self.eligibility.info(),
                self.system.info(),
            ];
            operation(&mut infos)
        }
    }

    #[test]
    fn existing_composition_binds_wallet_pda_and_executes_exact_v2_cas() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::SetEligibility {
            role: 0,
            agency_index: None,
        });
        let mut fixture = Fixture::new(&binding, EligibilityShape::Existing);
        fixture.with_infos(|accounts| {
            let rent = Rent::default();
            let prepared = prepare_production_set_eligibility_with_rent(
                &gate,
                &binding,
                &instruction,
                accounts,
                Some(&rent),
            )
            .unwrap();
            assert_eq!(prepared.config(), binding.config());
            assert_eq!(prepared.admin(), ADMIN);
            assert_eq!(prepared.wallet(), WALLET);
            assert_eq!(prepared.eligibility(), accounts[3].key.to_bytes());
            assert_eq!(
                prepared.lifecycle_path(),
                ProductionInitIfNeededPath::ExistingCas
            );
            assert_eq!(
                prepared.rent_minimum_lamports(),
                Some(rent.minimum_balance(ELIGIBILITY_ACCOUNT_LEN))
            );
            assert_eq!(prepared.next().role, 0);
            assert_eq!(prepared.next().agency_index, u32::MAX);

            let active_config =
                authenticate_production_active_config_account_info(&gate, &binding, &accounts[1])
                    .unwrap();
            let receipt = execute_production_active_init_if_needed_account_infos(
                &gate,
                &active_config,
                &binding,
                prepared.lifecycle,
                &accounts[0],
                &accounts[3],
                &accounts[4],
            )
            .unwrap();
            assert!(matches!(
                receipt,
                ProductionInitIfNeededReceipt::ExistingCas(_)
            ));
            assert_eq!(
                decode_eligibility_state(&accounts[3].try_borrow_data().unwrap()).unwrap(),
                prepared.next()
            );
        });
    }

    #[test]
    fn vacant_and_prefunded_composition_select_exact_runtime_rent_paths_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::SetEligibility {
            role: 0,
            agency_index: None,
        });
        let rent = Rent::default();
        let rent_minimum = rent.minimum_balance(ELIGIBILITY_ACCOUNT_LEN);

        for (shape, expected) in [
            (
                EligibilityShape::SystemOwned { lamports: 0 },
                ProductionInitIfNeededPath::CreateAccount,
            ),
            (
                EligibilityShape::SystemOwned {
                    lamports: rent_minimum / 2,
                },
                ProductionInitIfNeededPath::AllocateAssignAndFund,
            ),
            (
                EligibilityShape::SystemOwned {
                    lamports: rent_minimum + 1,
                },
                ProductionInitIfNeededPath::AllocateAssignAndFund,
            ),
        ] {
            let mut fixture = Fixture::new(&binding, shape);
            let before = (
                fixture.admin.lamports,
                fixture.eligibility.owner,
                fixture.eligibility.lamports,
                fixture.eligibility.data.clone(),
            );
            fixture.with_infos(|accounts| {
                let prepared = prepare_production_set_eligibility_with_rent(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                    Some(&rent),
                )
                .unwrap();
                assert_eq!(prepared.lifecycle_path(), expected);
                assert_eq!(prepared.rent_minimum_lamports(), Some(rent_minimum));
            });
            assert_eq!(
                (
                    fixture.admin.lamports,
                    fixture.eligibility.owner,
                    fixture.eligibility.lamports,
                    fixture.eligibility.data.clone(),
                ),
                before
            );
        }
    }

    #[test]
    fn hostile_instruction_account_policy_and_identity_fail_without_mutation() {
        let binding = binding();
        let gate = open_gate();
        let valid = encoded(ProductionInstruction::SetEligibility {
            role: 0,
            agency_index: None,
        });
        let wrong = encoded(ProductionInstruction::ClosePosition);

        let mut fixture = Fixture::new(&binding, EligibilityShape::Existing);
        let before = fixture.eligibility.data.clone();
        fixture.with_infos(|accounts| {
            assert_eq!(
                prepare_production_set_eligibility_account_infos(
                    &gate, &binding, &wrong, accounts,
                ),
                Err(ProductionSetEligibilityError::WrongInstruction)
            );
            assert_eq!(
                prepare_production_set_eligibility_account_infos(
                    &gate,
                    &binding,
                    &valid,
                    &accounts[..4],
                ),
                Err(ProductionSetEligibilityError::AccountCountMismatch)
            );
            accounts.swap(2, 3);
            assert_eq!(
                prepare_production_set_eligibility_account_infos(
                    &gate, &binding, &valid, accounts,
                ),
                Err(ProductionSetEligibilityError::WalletMetaMismatch)
            );
            accounts.swap(2, 3);
        });
        assert_eq!(fixture.eligibility.data, before);

        let mut writable_wallet = Fixture::new(&binding, EligibilityShape::Existing);
        writable_wallet.wallet.is_writable = true;
        writable_wallet.with_infos(|accounts| {
            assert_eq!(
                prepare_production_set_eligibility_account_infos(
                    &gate, &binding, &valid, accounts,
                ),
                Err(ProductionSetEligibilityError::WalletMetaMismatch)
            );
        });

        let mut wrong_pda = Fixture::new(&binding, EligibilityShape::Existing);
        wrong_pda.eligibility.key = Pubkey::new_unique();
        wrong_pda.with_infos(|accounts| {
            assert_eq!(
                prepare_production_set_eligibility_account_infos(
                    &gate, &binding, &valid, accounts,
                ),
                Err(ProductionSetEligibilityError::Native(
                    NativeAdapterError::AccountKeyMismatch
                ))
            );
        });

        let disabled_ccc = encoded(ProductionInstruction::SetEligibility {
            role: 1,
            agency_index: Some(0),
        });
        let mut policy = Fixture::new(&binding, EligibilityShape::Existing);
        let before = policy.eligibility.data.clone();
        policy.with_infos(|accounts| {
            let rent = Rent::default();
            assert_eq!(
                prepare_production_set_eligibility_with_rent(
                    &gate,
                    &binding,
                    &disabled_ccc,
                    accounts,
                    Some(&rent),
                ),
                Err(ProductionSetEligibilityError::Economy(
                    EconomyError::CccDlcNotActive
                ))
            );
        });
        assert_eq!(policy.eligibility.data, before);
    }

    #[test]
    fn init_if_needed_constraints_precede_retained_role_errors_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let rent = Rent::default();
        let rent_minimum = rent.minimum_balance(ELIGIBILITY_ACCOUNT_LEN);
        let invalid_role = encoded(ProductionInstruction::SetEligibility {
            role: u8::MAX,
            agency_index: None,
        });

        let mut existing = Fixture::new(&binding, EligibilityShape::Existing);
        existing.eligibility.lamports = rent_minimum - 1;
        let existing_before = existing.eligibility.data.clone();
        existing.with_infos(|accounts| {
            assert_eq!(
                prepare_production_set_eligibility_with_rent(
                    &gate,
                    &binding,
                    &invalid_role,
                    accounts,
                    Some(&rent),
                ),
                Err(ProductionSetEligibilityError::Lifecycle(
                    RuntimeAccountLifecycleError::ExistingAccountNotRentExempt
                ))
            );
        });
        assert_eq!(existing.eligibility.data, existing_before);

        for shape in [
            EligibilityShape::SystemOwned { lamports: 0 },
            EligibilityShape::SystemOwned {
                lamports: rent_minimum / 2,
            },
        ] {
            let mut system_owned = Fixture::new(&binding, shape);
            system_owned.admin.lamports = 0;
            let before = (
                system_owned.admin.lamports,
                system_owned.eligibility.owner,
                system_owned.eligibility.lamports,
                system_owned.eligibility.data.clone(),
            );
            system_owned.with_infos(|accounts| {
                assert_eq!(
                    prepare_production_set_eligibility_with_rent(
                        &gate,
                        &binding,
                        &invalid_role,
                        accounts,
                        Some(&rent),
                    ),
                    Err(ProductionSetEligibilityError::Lifecycle(
                        RuntimeAccountLifecycleError::Native(
                            NativeAdapterError::InsufficientPayerBalance
                        )
                    ))
                );
            });
            assert_eq!(
                (
                    system_owned.admin.lamports,
                    system_owned.eligibility.owner,
                    system_owned.eligibility.lamports,
                    system_owned.eligibility.data.clone(),
                ),
                before
            );
        }
    }

    #[test]
    fn unknown_roles_follow_successful_constraints_on_every_init_shape_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let rent = Rent::default();
        let rent_minimum = rent.minimum_balance(ELIGIBILITY_ACCOUNT_LEN);

        for role in [3, u8::MAX] {
            let instruction = encoded(ProductionInstruction::SetEligibility {
                role,
                agency_index: None,
            });
            for shape in [
                EligibilityShape::Existing,
                EligibilityShape::SystemOwned { lamports: 0 },
                EligibilityShape::SystemOwned {
                    lamports: rent_minimum / 2,
                },
            ] {
                let mut fixture = Fixture::new(&binding, shape);
                let before = (
                    fixture.admin.lamports,
                    fixture.eligibility.owner,
                    fixture.eligibility.lamports,
                    fixture.eligibility.data.clone(),
                );
                fixture.with_infos(|accounts| {
                    assert_eq!(
                        prepare_production_set_eligibility_with_rent(
                            &gate,
                            &binding,
                            &instruction,
                            accounts,
                            Some(&rent),
                        ),
                        Err(ProductionSetEligibilityError::Economy(
                            EconomyError::UnknownRole
                        )),
                        "role={role}"
                    );
                });
                assert_eq!(
                    (
                        fixture.admin.lamports,
                        fixture.eligibility.owner,
                        fixture.eligibility.lamports,
                        fixture.eligibility.data.clone(),
                    ),
                    before,
                    "role={role}"
                );
            }
        }
    }

    #[test]
    fn late_existing_borrow_conflict_leaves_the_entire_preimage_unchanged() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::SetEligibility {
            role: 0,
            agency_index: None,
        });
        let mut fixture = Fixture::new(&binding, EligibilityShape::Existing);
        fixture.with_infos(|accounts| {
            let rent = Rent::default();
            let prepared = prepare_production_set_eligibility_with_rent(
                &gate,
                &binding,
                &instruction,
                accounts,
                Some(&rent),
            )
            .unwrap();
            let active_config =
                authenticate_production_active_config_account_info(&gate, &binding, &accounts[1])
                    .unwrap();
            let held = accounts[3].try_borrow_mut_data().unwrap();
            let before = held.to_vec();
            assert_eq!(
                execute_production_active_init_if_needed_account_infos(
                    &gate,
                    &active_config,
                    &binding,
                    prepared.lifecycle,
                    &accounts[0],
                    &accounts[3],
                    &accounts[4],
                ),
                Err(RuntimeAccountLifecycleError::Write(
                    crate::runtime_write_adapter::RuntimeWriteAdapterError::AccountBorrowFailed
                ))
            );
            assert_eq!(&held[..], before.as_slice());
        });
    }

    #[test]
    fn truth_is_prepared_composition_only_and_unconditionally_held() {
        let truth = PRODUCTION_SET_ELIGIBILITY_TRUTH;
        assert!(truth.feature_gated);
        assert!(truth.exact_instruction_codec_required);
        assert!(truth.runtime_daily_law_capability_supported);
        assert!(truth.production_active_config_required);
        assert!(truth.exact_five_account_order_and_flags_required);
        assert!(truth.public_wallet_key_bound);
        assert!(truth.exact_wallet_eligibility_pda_authenticated);
        assert!(truth.init_if_needed_pre_cpi_facts_precede_retained_v2_body);
        assert!(truth.existing_eligibility_rent_exemption_required);
        assert!(truth.retained_v2_transition_used);
        assert!(truth.role_bearing_postimage_sealed_only_after_transition);
        assert!(truth.sealed_existing_or_init_lifecycle_plan_returned);
        assert!(!truth.account_write_executed);
        assert!(!truth.system_cpi_executed);
        assert!(!truth.production_dispatcher_exposed);
        assert!(!truth.production_entrypoint_exposed);
        assert!(!truth.handler_complete);
        assert!(!truth.devnet_executed);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_SET_ELIGIBILITY_STATUS.contains("MAINNET_HOLD"));
    }
}

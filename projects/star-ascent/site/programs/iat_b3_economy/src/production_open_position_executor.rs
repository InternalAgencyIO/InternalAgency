//! Exact account composition for the retained-V2 OpenPosition executor.
//!
//! The frozen twelve-account preflight is replayed before this module binds
//! the supplemental stake-ingress, confidential-mint, hook, and Daily-Law
//! accounts. Execution is delegated to the existing same-instruction runtime
//! that performs approval, ingress transfer, delegate restoration, token
//! reloads, Position lifecycle, and Config/lane CAS. No dispatcher or program
//! entrypoint is exposed here. Final-binary transaction rollback still needs
//! adversarial Devnet evidence.

extern crate alloc;

use alloc::{boxed::Box, vec};

use crate::native_adapter::NativeEconomyBinding;
use crate::production_open_position::{
    prepare_runtime_production_open_position_account_infos, PreparedProductionOpenPosition,
    ProductionOpenPositionError, PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT,
};
use crate::runtime_adapter::{
    authenticate_runtime_production_active_writable_config, RuntimeAdapterError,
    RuntimeValidatedDailyLawWrite,
};
use crate::stake_ingress::{SourceTokenState, STAKE_INGRESS_SEED};
use crate::stake_ingress_runtime::{
    execute_production_open_position_and_persist, observe_stake_ingress_source,
    observe_stake_ingress_vault, ProductionOpenPositionPersistenceAccounts,
    ProductionOpenPositionRuntimeReceipt, StakeIngressRuntimeAccounts, StakeIngressRuntimeError,
};
use crate::token_2022_runtime::{CanonicalEconomyMintBinding, EconomyToken2022Error};
use crate::{
    decode_eligibility_state, decode_lane_state, prepare_open_position, CanonicalDailyLawBinding,
    CodecError, EconomyError, PrepareOpenPositionInput, MAINNET_SUPPLY, TOKEN_DECIMALS,
};
use sha2::{Digest, Sha256};
use solana_account_info::AccountInfo;
use solana_instruction::{AccountMeta, Instruction};
use solana_pubkey::Pubkey;
use solana_sdk_ids::zk_elgamal_proof_program;
use spl_token_2022_interface::{instruction::transfer_checked, ID as TOKEN_2022_PROGRAM_ID};
use spl_transfer_hook_interface::{
    get_extra_account_metas_address, onchain::add_extra_accounts_for_execute_cpi,
};

const OWNER_INDEX: usize = 0;
const CONFIG_INDEX: usize = 1;
const ELIGIBILITY_INDEX: usize = 2;
const MINT_INDEX: usize = 3;
const SOURCE_TOKEN_INDEX: usize = 4;
const STAKE_TOKEN_INDEX: usize = 5;
const TREASURY_INDEX: usize = 6;
const ECOSYSTEM_INDEX: usize = 7;
const LIQUIDITY_INDEX: usize = 8;
const POSITION_INDEX: usize = 9;
const TOKEN_PROGRAM_INDEX: usize = 10;
const SYSTEM_PROGRAM_INDEX: usize = 11;
const INGRESS_AUTHORITY_INDEX: usize = 12;
const ZK_PROOF_PROGRAM_INDEX: usize = 13;
const HOOK_PROGRAM_INDEX: usize = 14;
const HOOK_VALIDATION_INDEX: usize = 15;
const LAW_STATE_INDEX: usize = 16;
const PRIOR_DELEGATE_INDEX: usize = 17;

pub const PRODUCTION_OPEN_POSITION_EXECUTOR_BASE_ACCOUNT_COUNT: usize = 17;
pub const PRODUCTION_OPEN_POSITION_EXECUTOR_DELEGATE_ACCOUNT_COUNT: usize = 18;
pub const PRODUCTION_OPEN_POSITION_EXECUTOR_STATUS: &str =
    "EXACT_V2_PLUS_INGRESS_GRAPH_COMBINED_LAW_TOKEN_CPI_LIFECYCLE_LEDGER_CAS_NO_DISPATCH_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionOpenPositionExecutorTruth {
    pub feature_gated: bool,
    pub exact_seventeen_or_eighteen_account_graph_required: bool,
    pub frozen_v2_preflight_required: bool,
    pub preflight_and_runtime_plan_equivalence_required: bool,
    pub runtime_daily_law_capability_rebound: bool,
    pub production_active_writable_config_required: bool,
    pub canonical_confidential_hooked_mint_required: bool,
    pub canonical_ingress_authority_required: bool,
    pub optional_prior_delegate_shape_exact: bool,
    pub exact_resolved_hook_cpi_graph_required: bool,
    pub combined_ingress_lifecycle_and_ledger_engine_called: bool,
    pub dispatcher_exposed: bool,
    pub entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub devnet_transaction_rollback_proven: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_OPEN_POSITION_EXECUTOR_TRUTH: ProductionOpenPositionExecutorTruth =
    ProductionOpenPositionExecutorTruth {
        feature_gated: true,
        exact_seventeen_or_eighteen_account_graph_required: true,
        frozen_v2_preflight_required: true,
        preflight_and_runtime_plan_equivalence_required: true,
        runtime_daily_law_capability_rebound: true,
        production_active_writable_config_required: true,
        canonical_confidential_hooked_mint_required: true,
        canonical_ingress_authority_required: true,
        optional_prior_delegate_shape_exact: true,
        exact_resolved_hook_cpi_graph_required: true,
        combined_ingress_lifecycle_and_ledger_engine_called: true,
        dispatcher_exposed: false,
        entrypoint_exposed: false,
        handler_complete: false,
        devnet_transaction_rollback_proven: false,
        mainnet_hold: true,
    };

#[derive(Debug)]
pub enum ProductionOpenPositionExecutorError {
    AccountCountMismatch,
    ProgramIdentityMismatch,
    SupplementalAccountBindingMismatch,
    SupplementalAccountMetaMismatch,
    PriorDelegateShapeMismatch,
    ResolvedHookGraphMismatch,
    LawCapabilityMismatch,
    AccountBorrowFailed,
    PlanMismatch,
    Codec(CodecError),
    OpenPosition(ProductionOpenPositionError),
    Runtime(RuntimeAdapterError),
    MintBinding(EconomyToken2022Error),
    StakeIngress(StakeIngressRuntimeError),
    Economy(EconomyError),
}

impl From<ProductionOpenPositionError> for ProductionOpenPositionExecutorError {
    fn from(value: ProductionOpenPositionError) -> Self {
        Self::OpenPosition(value)
    }
}

impl From<RuntimeAdapterError> for ProductionOpenPositionExecutorError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<EconomyToken2022Error> for ProductionOpenPositionExecutorError {
    fn from(value: EconomyToken2022Error) -> Self {
        Self::MintBinding(value)
    }
}

impl From<StakeIngressRuntimeError> for ProductionOpenPositionExecutorError {
    fn from(value: StakeIngressRuntimeError) -> Self {
        Self::StakeIngress(value)
    }
}

impl From<EconomyError> for ProductionOpenPositionExecutorError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionOpenPositionExecutionReceipt {
    owner: [u8; 32],
    config: [u8; 32],
    position: [u8; 32],
    position_id: u64,
    principal: u64,
    runtime: ProductionOpenPositionRuntimeReceipt,
}

impl ProductionOpenPositionExecutionReceipt {
    pub const fn owner(&self) -> [u8; 32] {
        self.owner
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn position(&self) -> [u8; 32] {
        self.position
    }

    pub const fn position_id(&self) -> u64 {
        self.position_id
    }

    pub const fn principal(&self) -> u64 {
        self.principal
    }

    pub const fn runtime(&self) -> &ProductionOpenPositionRuntimeReceipt {
        &self.runtime
    }
}

struct ReconstructedOpenPosition {
    input: PrepareOpenPositionInput,
    source: SourceTokenState,
}

/// Execute the exact retained-V2 OpenPosition ABI through the existing
/// authenticated combined-law stake-ingress and persistence engine.
///
/// Accounts 0..11 are the frozen V2 order. Supplemental order is exact:
/// 12 ingress-authority PDA, 13 ZK ElGamal proof program, 14 hook/Law program,
/// 15 hook validation PDA, 16 live Daily-Law state, and 17 the prior delegate
/// only when the source token account already has one.
#[inline(never)]
pub fn execute_runtime_production_open_position_account_infos(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<ProductionOpenPositionExecutionReceipt, ProductionOpenPositionExecutorError> {
    require_admissible_account_count(accounts)?;

    // Freeze V2 error ordering across its exact base-account boundary before
    // inspecting any B3-only supplemental account data.
    let prepared = prepare_runtime_production_open_position_account_infos(
        runtime_law,
        binding,
        instruction_data,
        &accounts[..PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT],
    )?;
    let active_config = authenticate_runtime_production_active_writable_config(
        runtime_law,
        binding,
        &accounts[CONFIG_INDEX],
    )?;

    if program_id.to_bytes() != binding.program_id() {
        return Err(ProductionOpenPositionExecutorError::ProgramIdentityMismatch);
    }
    require_supplemental_accounts(program_id, runtime_law, &prepared, accounts)?;
    let reconstructed = reconstruct_exact_input(runtime_law, binding, &prepared, accounts)?;
    let prior_delegate = require_exact_prior_delegate_shape(&reconstructed.source, accounts)?;
    require_exact_resolved_ingress_hook_graph(prepared.plan().principal, accounts)?;

    let gate = runtime_law.gate();
    let law_binding = CanonicalDailyLawBinding::new(
        gate.law_program_id(),
        gate.law_state_address(),
        gate.law_state_bump(),
        gate.mint(),
        gate.network_genesis_hash(),
    );
    let mint_binding = CanonicalEconomyMintBinding::new(
        binding.mint(),
        runtime_law.law_program_owner(),
        MAINNET_SUPPLY,
        TOKEN_DECIMALS,
    )?;
    let hook_accounts = [accounts[LAW_STATE_INDEX].clone()];
    let runtime_accounts = StakeIngressRuntimeAccounts {
        owner: &accounts[OWNER_INDEX],
        source: &accounts[SOURCE_TOKEN_INDEX],
        mint: &accounts[MINT_INDEX],
        stake_vault: &accounts[STAKE_TOKEN_INDEX],
        ingress_authority: &accounts[INGRESS_AUTHORITY_INDEX],
        prior_delegate,
        token_program: &accounts[TOKEN_PROGRAM_INDEX],
        hook_program: &accounts[HOOK_PROGRAM_INDEX],
        hook_validation: &accounts[HOOK_VALIDATION_INDEX],
        additional_hook_accounts: &hook_accounts,
    };
    let persistence = ProductionOpenPositionPersistenceAccounts {
        config: &accounts[CONFIG_INDEX],
        treasury: &accounts[TREASURY_INDEX],
        ecosystem: &accounts[ECOSYSTEM_INDEX],
        liquidity: &accounts[LIQUIDITY_INDEX],
        position: &accounts[POSITION_INDEX],
        system_program: &accounts[SYSTEM_PROGRAM_INDEX],
    };
    let runtime = execute_production_open_position_and_persist(
        program_id,
        binding,
        &active_config,
        &mint_binding,
        &accounts[ZK_PROOF_PROGRAM_INDEX],
        &law_binding,
        &accounts[LAW_STATE_INDEX],
        Box::new(reconstructed.input),
        runtime_accounts,
        persistence,
    )?;

    Ok(ProductionOpenPositionExecutionReceipt {
        owner: prepared.owner(),
        config: prepared.config(),
        position: prepared.position(),
        position_id: prepared.plan().position_id,
        principal: prepared.plan().principal,
        runtime,
    })
}

fn require_admissible_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionOpenPositionExecutorError> {
    if accounts.len() != PRODUCTION_OPEN_POSITION_EXECUTOR_BASE_ACCOUNT_COUNT
        && accounts.len() != PRODUCTION_OPEN_POSITION_EXECUTOR_DELEGATE_ACCOUNT_COUNT
    {
        return Err(ProductionOpenPositionExecutorError::AccountCountMismatch);
    }
    Ok(())
}

fn require_supplemental_accounts(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    prepared: &PreparedProductionOpenPosition,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionOpenPositionExecutorError> {
    let config = Pubkey::new_from_array(prepared.config());
    let expected_ingress =
        Pubkey::find_program_address(&[STAKE_INGRESS_SEED, config.as_ref()], program_id).0;
    require_readonly_nonexecutable(&accounts[INGRESS_AUTHORITY_INDEX], &expected_ingress)?;
    require_readonly_program(
        &accounts[ZK_PROOF_PROGRAM_INDEX],
        &zk_elgamal_proof_program::ID,
    )?;

    let hook_program = Pubkey::new_from_array(runtime_law.law_program_owner());
    require_readonly_program(&accounts[HOOK_PROGRAM_INDEX], &hook_program)?;
    let expected_validation =
        get_extra_account_metas_address(accounts[MINT_INDEX].key, &hook_program);
    require_readonly_owned_account(
        &accounts[HOOK_VALIDATION_INDEX],
        &expected_validation,
        &hook_program,
    )?;
    require_readonly_owned_account(
        &accounts[LAW_STATE_INDEX],
        &Pubkey::new_from_array(runtime_law.law_account_key()),
        &hook_program,
    )?;
    let law_data = accounts[LAW_STATE_INDEX]
        .try_borrow_data()
        .map_err(|_| ProductionOpenPositionExecutorError::AccountBorrowFailed)?;
    let observed_law_sha256: [u8; 32] = Sha256::digest(&*law_data).into();
    if observed_law_sha256 != runtime_law.law_account_sha256() {
        return Err(ProductionOpenPositionExecutorError::LawCapabilityMismatch);
    }
    Ok(())
}

fn require_readonly_nonexecutable(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
) -> Result<(), ProductionOpenPositionExecutorError> {
    if account.key != expected_key {
        return Err(ProductionOpenPositionExecutorError::SupplementalAccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionOpenPositionExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn require_readonly_program(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
) -> Result<(), ProductionOpenPositionExecutorError> {
    if account.key != expected_key {
        return Err(ProductionOpenPositionExecutorError::SupplementalAccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || !account.executable {
        return Err(ProductionOpenPositionExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn require_readonly_owned_account(
    account: &AccountInfo<'_>,
    expected_key: &Pubkey,
    expected_owner: &Pubkey,
) -> Result<(), ProductionOpenPositionExecutorError> {
    if account.key != expected_key || account.owner != expected_owner {
        return Err(ProductionOpenPositionExecutorError::SupplementalAccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionOpenPositionExecutorError::SupplementalAccountMetaMismatch);
    }
    Ok(())
}

fn reconstruct_exact_input(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    prepared: &PreparedProductionOpenPosition,
    accounts: &[AccountInfo<'_>],
) -> Result<ReconstructedOpenPosition, ProductionOpenPositionExecutorError> {
    let eligibility_data = accounts[ELIGIBILITY_INDEX]
        .try_borrow_data()
        .map_err(|_| ProductionOpenPositionExecutorError::AccountBorrowFailed)?;
    let eligibility = decode_eligibility_state(&eligibility_data)
        .map_err(ProductionOpenPositionExecutorError::Codec)?;
    drop(eligibility_data);

    let treasury = decode_lane(&accounts[TREASURY_INDEX])?;
    let ecosystem = decode_lane(&accounts[ECOSYSTEM_INDEX])?;
    let liquidity = decode_lane(&accounts[LIQUIDITY_INDEX])?;
    let source = observe_stake_ingress_source(
        &accounts[SOURCE_TOKEN_INDEX],
        accounts[MINT_INDEX].key,
        accounts[OWNER_INDEX].key,
    )
    .map_err(|_| ProductionOpenPositionExecutorError::PlanMismatch)?;
    let stake = observe_stake_ingress_vault(
        &accounts[STAKE_TOKEN_INDEX],
        accounts[MINT_INDEX].key,
        &Pubkey::new_from_array(prepared.vault_authority()),
    )
    .map_err(|_| ProductionOpenPositionExecutorError::PlanMismatch)?;

    let plan = prepared.plan();
    let input = PrepareOpenPositionInput {
        config_key: prepared.config(),
        config: plan.config_snapshot,
        owner: prepared.owner(),
        mint: binding.mint(),
        owner_tokens: source.token,
        vault_authority: prepared.vault_authority(),
        stake_tokens: stake,
        eligibility,
        treasury,
        ecosystem,
        liquidity,
        position_id: plan.position_id,
        principal: plan.principal,
        position_bump: plan.position_bump,
    };
    if prepare_open_position(runtime_law.gate(), input)? != *plan {
        return Err(ProductionOpenPositionExecutorError::PlanMismatch);
    }
    Ok(ReconstructedOpenPosition { input, source })
}

fn decode_lane(
    account: &AccountInfo<'_>,
) -> Result<crate::LaneState, ProductionOpenPositionExecutorError> {
    let data = account
        .try_borrow_data()
        .map_err(|_| ProductionOpenPositionExecutorError::AccountBorrowFailed)?;
    decode_lane_state(&data).map_err(ProductionOpenPositionExecutorError::Codec)
}

fn require_exact_prior_delegate_shape<'a, 'info>(
    source: &SourceTokenState,
    accounts: &'a [AccountInfo<'info>],
) -> Result<Option<&'a AccountInfo<'info>>, ProductionOpenPositionExecutorError> {
    match source.delegate.delegate {
        None => {
            if accounts.len() != PRODUCTION_OPEN_POSITION_EXECUTOR_BASE_ACCOUNT_COUNT {
                return Err(ProductionOpenPositionExecutorError::PriorDelegateShapeMismatch);
            }
            Ok(None)
        }
        Some(delegate) => {
            if accounts.len() != PRODUCTION_OPEN_POSITION_EXECUTOR_DELEGATE_ACCOUNT_COUNT {
                return Err(ProductionOpenPositionExecutorError::PriorDelegateShapeMismatch);
            }
            let account = &accounts[PRIOR_DELEGATE_INDEX];
            if account.key.to_bytes() != delegate {
                return Err(ProductionOpenPositionExecutorError::PriorDelegateShapeMismatch);
            }
            Ok(Some(account))
        }
    }
}

/// Resolve the live Transfer-Hook validation TLV before the first CPI and
/// require the one canonical Law meta followed by the validation account and
/// hook program. Read-only duplicate AccountInfos are not enough: duplicate or
/// additional resolved metas would change the inner Token-2022 instruction.
fn require_exact_resolved_ingress_hook_graph(
    amount: u64,
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionOpenPositionExecutorError> {
    let mut instruction = transfer_checked(
        &TOKEN_2022_PROGRAM_ID,
        accounts[SOURCE_TOKEN_INDEX].key,
        accounts[MINT_INDEX].key,
        accounts[STAKE_TOKEN_INDEX].key,
        accounts[INGRESS_AUTHORITY_INDEX].key,
        &[],
        amount,
        TOKEN_DECIMALS,
    )
    .map_err(|_| ProductionOpenPositionExecutorError::ResolvedHookGraphMismatch)?;
    let mut account_infos = vec![
        accounts[SOURCE_TOKEN_INDEX].clone(),
        accounts[MINT_INDEX].clone(),
        accounts[STAKE_TOKEN_INDEX].clone(),
        accounts[INGRESS_AUTHORITY_INDEX].clone(),
    ];
    let additional = [
        accounts[HOOK_PROGRAM_INDEX].clone(),
        accounts[HOOK_VALIDATION_INDEX].clone(),
        accounts[LAW_STATE_INDEX].clone(),
    ];
    add_extra_accounts_for_execute_cpi(
        &mut instruction,
        &mut account_infos,
        accounts[HOOK_PROGRAM_INDEX].key,
        accounts[SOURCE_TOKEN_INDEX].clone(),
        accounts[MINT_INDEX].clone(),
        accounts[STAKE_TOKEN_INDEX].clone(),
        accounts[INGRESS_AUTHORITY_INDEX].clone(),
        amount,
        &additional,
    )
    .map_err(|_| ProductionOpenPositionExecutorError::ResolvedHookGraphMismatch)?;
    require_exact_resolved_ingress_hook_graph_result(&instruction, &account_infos, accounts)
}

fn require_exact_resolved_ingress_hook_graph_result(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionOpenPositionExecutorError> {
    let expected_metas = [
        AccountMeta::new(*accounts[SOURCE_TOKEN_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[MINT_INDEX].key, false),
        AccountMeta::new(*accounts[STAKE_TOKEN_INDEX].key, false),
        // The live AccountInfo is a non-signer PDA; invoke_signed supplies the
        // exact binding-relative ingress-authority signature at CPI time.
        AccountMeta::new_readonly(*accounts[INGRESS_AUTHORITY_INDEX].key, true),
        AccountMeta::new_readonly(*accounts[LAW_STATE_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[HOOK_VALIDATION_INDEX].key, false),
        AccountMeta::new_readonly(*accounts[HOOK_PROGRAM_INDEX].key, false),
    ];
    let expected_keys = [
        accounts[SOURCE_TOKEN_INDEX].key,
        accounts[MINT_INDEX].key,
        accounts[STAKE_TOKEN_INDEX].key,
        accounts[INGRESS_AUTHORITY_INDEX].key,
        accounts[LAW_STATE_INDEX].key,
        accounts[HOOK_VALIDATION_INDEX].key,
        accounts[HOOK_PROGRAM_INDEX].key,
    ];
    if instruction.program_id != TOKEN_2022_PROGRAM_ID
        || instruction.accounts.as_slice() != expected_metas
        || account_infos.len() != expected_keys.len()
        || account_infos
            .iter()
            .zip(expected_keys)
            .any(|(observed, expected)| observed.key != expected)
    {
        return Err(ProductionOpenPositionExecutorError::ResolvedHookGraphMismatch);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_adapter::{derive_pda, PdaIdentity};
    use crate::production_instruction::{
        encode_production_instruction, ProductionInstruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::stake_ingress::{
        apply_transfer_and_retained_v2_finalizer, complete_stake_ingress,
        prepare_open_position_stake_ingress, verify_ingress_approval, DelegateSnapshot,
        IngressPdaBinding, PrepareStakeIngressInput, StakeIngressApprovalObservation,
        StakeIngressRestorationObservation, StakeIngressSpecError, StakeIngressTransferObservation,
    };
    use crate::{
        encode_config_genesis_state, encode_eligibility_state, encode_lane_state,
        verify_daily_law_open, CanonicalDailyLawBinding, ConfigGenesisState, ConfigState,
        EligibilityState, GenesisPhase, LaneState, ReadonlyDailyLawAccount, ValidatedDailyLawWrite,
        CONFIG_GENESIS_ACCOUNT_LEN, ECOSYSTEM, ELIGIBILITY_ACCOUNT_LEN, LANE_ACCOUNT_LEN,
        LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, LIQUIDITY, MAINNET_SUPPLY, TREASURY,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_sdk_ids::{native_loader, system_program};
    use spl_token_2022_interface::{
        extension::{
            confidential_transfer::ConfidentialTransferMint,
            cpi_guard::CpiGuard,
            transfer_hook::{TransferHook, TransferHookAccount},
            AccountType, BaseStateWithExtensionsMut, ExtensionType, StateWithExtensionsMut,
        },
        state::{Account as TokenAccount, AccountState, Mint},
        ID as TOKEN_2022_PROGRAM_ID,
    };
    use spl_transfer_hook_interface::instruction::TransferHookInstruction;

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const OWNER: [u8; 32] = [0xA1; 32];
    const PRIOR_DELEGATE: [u8; 32] = [0xD1; 32];
    const CLOCK_TIMESTAMP: i64 = 1_786_654_860;
    const POSITION_ID: u64 = 7;
    const PRINCIPAL: u64 = 100;
    const SOURCE_AMOUNT: u64 = 10_000;
    const STAKE_AMOUNT: u64 = 100;

    fn binding() -> NativeEconomyBinding {
        NativeEconomyBinding::new(ECONOMY_PROGRAM, MINT).unwrap()
    }

    fn law_identity() -> ([u8; 32], u8) {
        let (key, bump) = Pubkey::find_program_address(
            &[b"law-state", &MINT],
            &Pubkey::new_from_array(LAW_PROGRAM),
        );
        (key.to_bytes(), bump)
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

    fn law_data() -> [u8; LAW_STATE_LEN] {
        let decision = open_decision(CLOCK_TIMESTAMP);
        let (_, bump) = law_identity();
        let mut data = [0u8; LAW_STATE_LEN];
        data[0..8].copy_from_slice(LAW_STATE_MAGIC);
        data[8] = LAW_STATE_VERSION;
        data[9] = bump;
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

    fn open_gate() -> ValidatedDailyLawWrite {
        let data = law_data();
        let (law_state, bump) = law_identity();
        verify_daily_law_open(
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, law_state, bump, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(law_state, LAW_PROGRAM, false, &data),
            CLOCK_TIMESTAMP,
        )
        .unwrap()
    }

    fn runtime_law() -> RuntimeValidatedDailyLawWrite {
        RuntimeValidatedDailyLawWrite::from_test_gate(open_gate(), law_identity().0, LAW_PROGRAM)
    }

    fn instruction() -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut data = [0u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(
            ProductionInstruction::OpenPosition {
                position_id: POSITION_ID,
                principal: PRINCIPAL,
            },
            &mut data,
        )
        .unwrap();
        data
    }

    fn wrong_instruction() -> [u8; PRODUCTION_INSTRUCTION_LEN] {
        let mut data = [0u8; PRODUCTION_INSTRUCTION_LEN];
        encode_production_instruction(ProductionInstruction::ClosePosition, &mut data).unwrap();
        data
    }

    fn mint_data(hook_program: [u8; 32]) -> Vec<u8> {
        let extensions = [
            ExtensionType::ConfidentialTransferMint,
            ExtensionType::TransferHook,
        ];
        let len = ExtensionType::try_calculate_account_len::<Mint>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state = StateWithExtensionsMut::<Mint>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Mint);
        state.base = Mint {
            supply: MAINNET_SUPPLY,
            decimals: TOKEN_DECIMALS,
            is_initialized: true,
            ..Mint::default()
        };
        state
            .init_extension::<ConfidentialTransferMint>(false)
            .unwrap()
            .auto_approve_new_accounts = true.into();
        state
            .init_extension::<TransferHook>(false)
            .unwrap()
            .program_id = Some(Pubkey::new_from_array(hook_program))
            .try_into()
            .unwrap();
        state.pack_base();
        data
    }

    fn token_data(
        owner: [u8; 32],
        amount: u64,
        delegate: Option<([u8; 32], u64)>,
        cpi_guard_locked: bool,
    ) -> Vec<u8> {
        let mut extensions = vec![ExtensionType::TransferHookAccount];
        if cpi_guard_locked {
            extensions.push(ExtensionType::CpiGuard);
        }
        let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state =
            StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Account);
        state.base = TokenAccount {
            mint: MINT.into(),
            owner: owner.into(),
            amount,
            state: AccountState::Initialized,
            ..TokenAccount::default()
        };
        if let Some((delegate, delegated_amount)) = delegate {
            state.base.delegate = Some(Pubkey::new_from_array(delegate)).into();
            state.base.delegated_amount = delegated_amount;
        }
        state.init_extension::<TransferHookAccount>(false).unwrap();
        if cpi_guard_locked {
            state.init_extension::<CpiGuard>(false).unwrap().lock_cpi.0 = 1;
        }
        state.pack_base();
        data
    }

    #[derive(Clone, Copy)]
    enum TestValidationMeta {
        LawPda { mint_account_index: u8 },
        Static(Pubkey),
    }

    fn validation_data_for(metas: &[TestValidationMeta]) -> Vec<u8> {
        const TLV_HEADER_LEN: usize = 12;
        const LIST_HEADER_LEN: usize = 4;
        const EXTRA_META_LEN: usize = 35;
        let list_len = LIST_HEADER_LEN + EXTRA_META_LEN * metas.len();
        let mut data = vec![0u8; TLV_HEADER_LEN + list_len];
        let execute = TransferHookInstruction::Execute { amount: 0 }.pack();
        data[0..8].copy_from_slice(&execute[0..8]);
        data[8..12].copy_from_slice(&(list_len as u32).to_le_bytes());
        data[12..16].copy_from_slice(&(metas.len() as u32).to_le_bytes());
        for (index, meta) in metas.iter().enumerate() {
            let offset = 16 + index * EXTRA_META_LEN;
            match meta {
                TestValidationMeta::LawPda { mint_account_index } => {
                    data[offset] = 1;
                    data[offset + 1] = 1;
                    data[offset + 2] = 9;
                    data[offset + 3..offset + 12].copy_from_slice(b"law-state");
                    data[offset + 12] = 3;
                    data[offset + 13] = *mint_account_index;
                }
                TestValidationMeta::Static(key) => {
                    data[offset + 1..offset + 33].copy_from_slice(key.as_ref());
                }
            }
            data[offset + 33] = 0;
            data[offset + 34] = 0;
        }
        data
    }

    fn validation_data(mint_account_index: u8) -> Vec<u8> {
        validation_data_for(&[TestValidationMeta::LawPda { mint_account_index }])
    }

    fn lane(binding: &NativeEconomyBinding, lane: u8) -> ([u8; 32], Vec<u8>) {
        let identity = PdaIdentity::LaneState {
            config: binding.config(),
            lane,
        };
        let token = derive_pda(
            binding,
            PdaIdentity::LaneToken {
                config: binding.config(),
                lane,
            },
        )
        .unwrap();
        let state = LaneState {
            config: binding.config(),
            token_account: token.key,
            beneficiary: [0xA0 | lane; 32],
            total: 1_000_000,
            genesis_unlocked: 1_000_000,
            cliff_week: 0,
            linear_end_week: 104,
            reserved: 0,
            paid: 0,
            principal_claimed: 0,
            lane,
            reward_source: true,
            bump: derive_pda(binding, identity).unwrap().bump,
            token_bump: token.bump,
        };
        let mut data = [0u8; LANE_ACCOUNT_LEN];
        encode_lane_state(&state, &mut data).unwrap();
        (derive_pda(binding, identity).unwrap().key, data.to_vec())
    }

    struct TestAccount {
        key: Pubkey,
        owner: Pubkey,
        lamports: u64,
        data: Vec<u8>,
        signer: bool,
        writable: bool,
        executable: bool,
    }

    impl TestAccount {
        fn info(&mut self) -> AccountInfo<'_> {
            AccountInfo::new(
                &self.key,
                self.signer,
                self.writable,
                &mut self.lamports,
                &mut self.data,
                &self.owner,
                self.executable,
            )
        }
    }

    struct Fixture {
        owner: TestAccount,
        config: TestAccount,
        eligibility: TestAccount,
        mint: TestAccount,
        source: TestAccount,
        stake: TestAccount,
        treasury: TestAccount,
        ecosystem: TestAccount,
        liquidity: TestAccount,
        position: TestAccount,
        token_program: TestAccount,
        system_program: TestAccount,
        ingress_authority: TestAccount,
        zk_program: TestAccount,
        hook_program: TestAccount,
        hook_validation: TestAccount,
        law_state: TestAccount,
        prior_delegate: Option<TestAccount>,
    }

    impl Fixture {
        fn new(binding: &NativeEconomyBinding, prior_delegate: bool) -> Self {
            let vault_authority = derive_pda(
                binding,
                PdaIdentity::VaultAuthority {
                    config: binding.config(),
                },
            )
            .unwrap();
            let stake = derive_pda(
                binding,
                PdaIdentity::StakeToken {
                    config: binding.config(),
                },
            )
            .unwrap();
            let config_state = ConfigGenesisState {
                phase: GenesisPhase::Active,
                config: ConfigState {
                    admin: [0x21; 32],
                    mint: MINT,
                    token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
                    randomness_program: [0x44; 32],
                    stake_token_account: stake.key,
                    agency_registry_hash: [0x66; 32],
                    genesis_timestamp: CLOCK_TIMESTAMP - 60,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: STAKE_AMOUNT,
                    agency_count: 0,
                    rehearsal_mode: false,
                    active: true,
                    lane_mask: 0b1_1110,
                    stake_vault_initialized: true,
                    bump: binding.config_bump(),
                    vault_authority_bump: vault_authority.bump,
                },
            };
            let mut config_data = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
            encode_config_genesis_state(&config_state, &mut config_data).unwrap();

            let eligibility_identity = PdaIdentity::Eligibility {
                config: binding.config(),
                operator: OWNER,
            };
            let eligibility = derive_pda(binding, eligibility_identity).unwrap();
            let eligibility_state = EligibilityState {
                config: binding.config(),
                wallet: OWNER,
                agency_index: u32::MAX,
                role: 0,
                bump: eligibility.bump,
            };
            let mut eligibility_data = [0u8; ELIGIBILITY_ACCOUNT_LEN];
            encode_eligibility_state(&eligibility_state, &mut eligibility_data).unwrap();

            let (treasury_key, treasury_data) = lane(binding, TREASURY);
            let (ecosystem_key, ecosystem_data) = lane(binding, ECOSYSTEM);
            let (liquidity_key, liquidity_data) = lane(binding, LIQUIDITY);
            let position = derive_pda(
                binding,
                PdaIdentity::Position {
                    config: binding.config(),
                    operator: OWNER,
                    position_id: POSITION_ID,
                },
            )
            .unwrap();
            let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
            let ingress_authority =
                Pubkey::find_program_address(&[STAKE_INGRESS_SEED, &binding.config()], &program_id)
                    .0;
            let hook_program = Pubkey::new_from_array(LAW_PROGRAM);
            let hook_validation =
                get_extra_account_metas_address(&Pubkey::new_from_array(MINT), &hook_program);
            let (law_state, _) = law_identity();

            Self {
                owner: TestAccount {
                    key: OWNER.into(),
                    owner: system_program::ID,
                    lamports: 10_000_000,
                    data: Vec::new(),
                    signer: true,
                    writable: true,
                    executable: false,
                },
                config: TestAccount {
                    key: binding.config().into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: config_data.to_vec(),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                eligibility: TestAccount {
                    key: eligibility.key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: eligibility_data.to_vec(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                mint: TestAccount {
                    key: MINT.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: mint_data(LAW_PROGRAM),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                source: TestAccount {
                    key: [0x71; 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(
                        OWNER,
                        SOURCE_AMOUNT,
                        prior_delegate.then_some((PRIOR_DELEGATE, 41)),
                        false,
                    ),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                stake: TestAccount {
                    key: stake.key.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, STAKE_AMOUNT, None, false),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                treasury: TestAccount {
                    key: treasury_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: treasury_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                ecosystem: TestAccount {
                    key: ecosystem_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: ecosystem_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                liquidity: TestAccount {
                    key: liquidity_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: liquidity_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                position: TestAccount {
                    key: position.key.into(),
                    owner: system_program::ID,
                    lamports: 0,
                    data: Vec::new(),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                token_program: TestAccount {
                    key: TOKEN_2022_PROGRAM_ID,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
                system_program: TestAccount {
                    key: system_program::ID,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
                ingress_authority: TestAccount {
                    key: ingress_authority,
                    owner: system_program::ID,
                    lamports: 0,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                zk_program: TestAccount {
                    key: zk_elgamal_proof_program::ID,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
                hook_program: TestAccount {
                    key: hook_program,
                    owner: native_loader::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: true,
                },
                hook_validation: TestAccount {
                    key: hook_validation,
                    owner: hook_program,
                    lamports: 1,
                    data: validation_data(1),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                law_state: TestAccount {
                    key: law_state.into(),
                    owner: hook_program,
                    lamports: 1,
                    data: law_data().to_vec(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                prior_delegate: prior_delegate.then_some(TestAccount {
                    key: PRIOR_DELEGATE.into(),
                    owner: system_program::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: false,
                }),
            }
        }

        fn with_infos<R>(&mut self, operation: impl FnOnce(&mut Vec<AccountInfo<'_>>) -> R) -> R {
            let mut infos = vec![
                self.owner.info(),
                self.config.info(),
                self.eligibility.info(),
                self.mint.info(),
                self.source.info(),
                self.stake.info(),
                self.treasury.info(),
                self.ecosystem.info(),
                self.liquidity.info(),
                self.position.info(),
                self.token_program.info(),
                self.system_program.info(),
                self.ingress_authority.info(),
                self.zk_program.info(),
                self.hook_program.info(),
                self.hook_validation.info(),
                self.law_state.info(),
            ];
            if let Some(prior_delegate) = self.prior_delegate.as_mut() {
                infos.push(prior_delegate.info());
            }
            operation(&mut infos)
        }

        fn snapshot(&self) -> [Vec<u8>; 7] {
            [
                self.config.data.clone(),
                self.source.data.clone(),
                self.stake.data.clone(),
                self.treasury.data.clone(),
                self.ecosystem.data.clone(),
                self.liquidity.data.clone(),
                self.position.data.clone(),
            ]
        }
    }

    #[test]
    fn truth_is_exact_undispatched_and_mainnet_held() {
        let truth = core::hint::black_box(PRODUCTION_OPEN_POSITION_EXECUTOR_TRUTH);
        assert!(truth.feature_gated);
        assert!(truth.exact_seventeen_or_eighteen_account_graph_required);
        assert!(truth.frozen_v2_preflight_required);
        assert!(truth.preflight_and_runtime_plan_equivalence_required);
        assert!(truth.runtime_daily_law_capability_rebound);
        assert!(truth.production_active_writable_config_required);
        assert!(truth.canonical_confidential_hooked_mint_required);
        assert!(truth.canonical_ingress_authority_required);
        assert!(truth.optional_prior_delegate_shape_exact);
        assert!(truth.exact_resolved_hook_cpi_graph_required);
        assert!(truth.combined_ingress_lifecycle_and_ledger_engine_called);
        assert!(!truth.dispatcher_exposed);
        assert!(!truth.entrypoint_exposed);
        assert!(!truth.handler_complete);
        assert!(!truth.devnet_transaction_rollback_proven);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_OPEN_POSITION_EXECUTOR_STATUS.contains("MAINNET_HOLD"));
    }

    #[test]
    fn no_delegate_graph_reaches_runtime_law_reauthentication_and_host_cannot_commit() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, false);
        let before = fixture.snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::StakeIngress(
                StakeIngressRuntimeError::DailyLawAccountRejected
            ))
        ));
        assert_eq!(fixture.snapshot(), before);
    }

    #[test]
    fn prior_delegate_graph_is_exact_and_reaches_the_same_runtime_law_boundary() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, true);
        let before = fixture.snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::StakeIngress(
                StakeIngressRuntimeError::DailyLawAccountRejected
            ))
        ));
        assert_eq!(fixture.snapshot(), before);
    }

    #[test]
    fn exact_count_program_and_supplemental_identities_fail_before_any_write() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);

        let mut fixture = Fixture::new(&binding, false);
        let before = fixture.snapshot();
        fixture.with_infos(|accounts| {
            assert!(matches!(
                execute_runtime_production_open_position_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &instruction(),
                    &accounts[..16],
                ),
                Err(ProductionOpenPositionExecutorError::AccountCountMismatch)
            ));
            let mut extended = accounts.clone();
            extended.extend_from_slice(&accounts[..2]);
            assert!(matches!(
                execute_runtime_production_open_position_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &instruction(),
                    &extended,
                ),
                Err(ProductionOpenPositionExecutorError::AccountCountMismatch)
            ));
            assert!(matches!(
                execute_runtime_production_open_position_account_infos(
                    &Pubkey::new_from_array([0x99; 32]),
                    &runtime_law,
                    &binding,
                    &instruction(),
                    accounts,
                ),
                Err(ProductionOpenPositionExecutorError::ProgramIdentityMismatch)
            ));
        });
        assert_eq!(fixture.snapshot(), before);

        for index in [
            INGRESS_AUTHORITY_INDEX,
            ZK_PROOF_PROGRAM_INDEX,
            HOOK_PROGRAM_INDEX,
            HOOK_VALIDATION_INDEX,
            LAW_STATE_INDEX,
        ] {
            let mut fixture = Fixture::new(&binding, false);
            let before = fixture.snapshot();
            fixture.with_infos(|accounts| {
                accounts[index].key = accounts[OWNER_INDEX].key;
                assert!(matches!(
                    execute_runtime_production_open_position_account_infos(
                        &program_id,
                        &runtime_law,
                        &binding,
                        &instruction(),
                        accounts,
                    ),
                    Err(ProductionOpenPositionExecutorError::SupplementalAccountBindingMismatch)
                ));
            });
            assert_eq!(fixture.snapshot(), before, "identity slot {index}");
        }
    }

    #[test]
    fn every_supplemental_meta_escalation_fails_without_writes() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        for index in INGRESS_AUTHORITY_INDEX..=LAW_STATE_INDEX {
            for flag in 0..3 {
                let mut fixture = Fixture::new(&binding, false);
                let before = fixture.snapshot();
                fixture.with_infos(|accounts| {
                    match flag {
                        0 => accounts[index].is_signer = !accounts[index].is_signer,
                        1 => accounts[index].is_writable = !accounts[index].is_writable,
                        2 => accounts[index].executable = !accounts[index].executable,
                        _ => unreachable!(),
                    }
                    assert!(matches!(
                        execute_runtime_production_open_position_account_infos(
                            &program_id,
                            &runtime_law,
                            &binding,
                            &instruction(),
                            accounts,
                        ),
                        Err(ProductionOpenPositionExecutorError::SupplementalAccountMetaMismatch)
                    ));
                });
                assert_eq!(fixture.snapshot(), before, "meta slot {index}, flag {flag}");
            }
        }
    }

    #[test]
    fn live_law_hash_and_owned_supplemental_accounts_are_rebound_exactly() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);

        let mut fixture = Fixture::new(&binding, false);
        fixture.law_state.data[LAW_STATE_LEN - 1] ^= 1;
        let before = fixture.snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::LawCapabilityMismatch)
        ));
        assert_eq!(fixture.snapshot(), before);

        let mut fixture = Fixture::new(&binding, false);
        fixture.hook_validation.owner = system_program::ID;
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::SupplementalAccountBindingMismatch)
        ));
    }

    #[test]
    fn duplicate_law_or_extra_resolved_hook_meta_fails_before_any_write() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let hostile_validation = [
            validation_data_for(&[
                TestValidationMeta::LawPda {
                    mint_account_index: 1,
                },
                TestValidationMeta::LawPda {
                    mint_account_index: 1,
                },
            ]),
            validation_data_for(&[
                TestValidationMeta::LawPda {
                    mint_account_index: 1,
                },
                TestValidationMeta::Static(Pubkey::new_from_array(LAW_PROGRAM)),
            ]),
        ];

        for validation in hostile_validation {
            let mut fixture = Fixture::new(&binding, false);
            fixture.hook_validation.data = validation;
            let before = fixture.snapshot();
            let result = fixture.with_infos(|accounts| {
                execute_runtime_production_open_position_account_infos(
                    &program_id,
                    &runtime_law,
                    &binding,
                    &instruction(),
                    accounts,
                )
            });
            assert!(matches!(
                result,
                Err(ProductionOpenPositionExecutorError::ResolvedHookGraphMismatch)
            ));
            assert_eq!(fixture.snapshot(), before);
        }
    }

    #[test]
    fn optional_prior_delegate_presence_and_key_are_exact_without_privilege_cuts() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);

        let mut fixture = Fixture::new(&binding, false);
        fixture.prior_delegate = Some(TestAccount {
            key: PRIOR_DELEGATE.into(),
            owner: system_program::ID,
            lamports: 1,
            data: Vec::new(),
            signer: false,
            writable: false,
            executable: false,
        });
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::PriorDelegateShapeMismatch)
        ));

        let mut fixture = Fixture::new(&binding, true);
        let prior = fixture.prior_delegate.take().unwrap();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::PriorDelegateShapeMismatch)
        ));
        fixture.prior_delegate = Some(prior);

        let mut fixture = Fixture::new(&binding, true);
        fixture.prior_delegate.as_mut().unwrap().key = [0xD2; 32].into();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::PriorDelegateShapeMismatch)
        ));

        let mut owner_delegate = Fixture::new(&binding, true);
        owner_delegate.source.data = token_data(OWNER, SOURCE_AMOUNT, Some((OWNER, 41)), false);
        let prior = owner_delegate.prior_delegate.as_mut().unwrap();
        prior.key = OWNER.into();
        // Duplicate outer metas inherit the owner's effective privileges.
        prior.signer = true;
        prior.writable = true;
        let before = owner_delegate.snapshot();
        let result = owner_delegate.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::StakeIngress(
                StakeIngressRuntimeError::DailyLawAccountRejected
            ))
        ));
        assert_eq!(owner_delegate.snapshot(), before);

        let mut executable_delegate = Fixture::new(&binding, true);
        executable_delegate
            .prior_delegate
            .as_mut()
            .unwrap()
            .executable = true;
        let before = executable_delegate.snapshot();
        let result = executable_delegate.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &program_id,
                &runtime_law,
                &binding,
                &instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::StakeIngress(
                StakeIngressRuntimeError::DailyLawAccountRejected
            ))
        ));
        assert_eq!(executable_delegate.snapshot(), before);
    }

    #[test]
    fn retained_v2_instruction_error_precedes_executor_only_supplemental_errors() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, false);
        fixture.hook_program.key = [0x99; 32].into();
        let before = fixture.snapshot();
        let result = fixture.with_infos(|accounts| {
            execute_runtime_production_open_position_account_infos(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &binding,
                &wrong_instruction(),
                accounts,
            )
        });
        assert!(matches!(
            result,
            Err(ProductionOpenPositionExecutorError::OpenPosition(
                ProductionOpenPositionError::WrongInstruction
            ))
        ));
        assert_eq!(fixture.snapshot(), before);
    }

    #[test]
    fn reconstructed_locked_source_guard_fails_before_any_cpi_or_state_plan() {
        let binding = binding();
        let runtime_law = runtime_law();
        let mut fixture = Fixture::new(&binding, false);
        fixture.source.data = token_data(OWNER, SOURCE_AMOUNT, None, true);
        let before = fixture.snapshot();
        let result = fixture.with_infos(|accounts| {
            let prepared = prepare_runtime_production_open_position_account_infos(
                &runtime_law,
                &binding,
                &instruction(),
                &accounts[..PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT],
            )
            .unwrap();
            require_supplemental_accounts(
                &Pubkey::new_from_array(ECONOMY_PROGRAM),
                &runtime_law,
                &prepared,
                accounts,
            )
            .unwrap();
            let reconstructed =
                reconstruct_exact_input(&runtime_law, &binding, &prepared, accounts).unwrap();
            prepare_open_position_stake_ingress(
                runtime_law.gate(),
                reconstructed.input,
                PrepareStakeIngressInput {
                    owner_is_signer: accounts[OWNER_INDEX].is_signer,
                    canonical_ingress_authority: accounts[INGRESS_AUTHORITY_INDEX].key.to_bytes(),
                    ingress: IngressPdaBinding {
                        key: accounts[INGRESS_AUTHORITY_INDEX].key.to_bytes(),
                    },
                    hook_validation_address: accounts[HOOK_VALIDATION_INDEX].key.to_bytes(),
                    source_before: reconstructed.source,
                    stake_before: reconstructed.input.stake_tokens,
                },
            )
        });
        assert!(matches!(
            result,
            Err(StakeIngressSpecError::CpiGuardBlocksAtomicApproval)
        ));
        assert_eq!(fixture.snapshot(), before);
    }

    #[test]
    fn reconstructed_plan_freezes_exact_cpi_reloads_and_late_rollback_boundary() {
        let binding = binding();
        let runtime_law = runtime_law();
        let program_id = Pubkey::new_from_array(ECONOMY_PROGRAM);
        let mut fixture = Fixture::new(&binding, true);
        let before = fixture.snapshot();
        let plan = fixture.with_infos(|accounts| {
            let prepared = prepare_runtime_production_open_position_account_infos(
                &runtime_law,
                &binding,
                &instruction(),
                &accounts[..PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT],
            )
            .unwrap();
            require_supplemental_accounts(&program_id, &runtime_law, &prepared, accounts).unwrap();
            let reconstructed =
                reconstruct_exact_input(&runtime_law, &binding, &prepared, accounts).unwrap();
            require_exact_prior_delegate_shape(&reconstructed.source, accounts).unwrap();
            prepare_open_position_stake_ingress(
                runtime_law.gate(),
                reconstructed.input,
                PrepareStakeIngressInput {
                    owner_is_signer: true,
                    canonical_ingress_authority: accounts[INGRESS_AUTHORITY_INDEX].key.to_bytes(),
                    ingress: IngressPdaBinding {
                        key: accounts[INGRESS_AUTHORITY_INDEX].key.to_bytes(),
                    },
                    hook_validation_address: accounts[HOOK_VALIDATION_INDEX].key.to_bytes(),
                    source_before: reconstructed.source,
                    stake_before: reconstructed.input.stake_tokens,
                },
            )
            .unwrap()
        });

        assert_eq!(plan.approve_ingress.source, fixture.source.key.to_bytes());
        assert_eq!(
            plan.approve_ingress.delegate,
            fixture.ingress_authority.key.to_bytes()
        );
        assert_eq!(plan.approve_ingress.amount, PRINCIPAL);
        assert_eq!(plan.transfer.transfer.source, fixture.source.key.to_bytes());
        assert_eq!(
            plan.transfer.transfer.destination,
            fixture.stake.key.to_bytes()
        );
        assert_eq!(
            plan.transfer.transfer.authority,
            fixture.ingress_authority.key.to_bytes()
        );
        assert_eq!(plan.transfer.transfer.amount, PRINCIPAL);
        assert_eq!(plan.transfer.law_state_address, law_identity().0);
        assert!(plan.transfer.token_cpi_uses_ingress_invoke_signed);
        assert!(!plan.transfer.hook_execute_authority_is_signer);
        assert!(plan.transfer.add_extra_accounts_for_execute_cpi_required);

        let mut source_after_approval = plan.source_before;
        source_after_approval.delegate = DelegateSnapshot {
            delegate: Some(plan.approve_ingress.delegate),
            delegated_amount: PRINCIPAL,
        };
        let approved = verify_ingress_approval(
            plan,
            StakeIngressApprovalObservation {
                source_after_approval,
                stake_after_approval: plan.stake_before,
            },
        )
        .unwrap();

        let mut source_after_transfer = source_after_approval;
        source_after_transfer.token.amount -= PRINCIPAL;
        source_after_transfer.delegate = DelegateSnapshot {
            delegate: None,
            delegated_amount: 0,
        };
        assert!(matches!(
            apply_transfer_and_retained_v2_finalizer(
                approved,
                StakeIngressTransferObservation {
                    source_after_transfer,
                    stake_after_transfer: plan.stake_before,
                },
            ),
            Err(StakeIngressSpecError::StakeBalanceDeltaMismatch)
        ));

        let mut stake_after_transfer = plan.stake_before;
        stake_after_transfer.amount += PRINCIPAL;
        let post_cpi = apply_transfer_and_retained_v2_finalizer(
            approved,
            StakeIngressTransferObservation {
                source_after_transfer,
                stake_after_transfer,
            },
        )
        .unwrap();
        assert!(matches!(
            complete_stake_ingress(
                post_cpi,
                StakeIngressRestorationObservation {
                    source_after_restoration: source_after_transfer,
                    stake_after_restoration: stake_after_transfer,
                },
            ),
            Err(StakeIngressSpecError::DelegateRestorationMismatch)
        ));

        let mut source_after_restoration = source_after_transfer;
        source_after_restoration.delegate = DelegateSnapshot {
            delegate: Some(PRIOR_DELEGATE),
            delegated_amount: 41,
        };
        let completed = complete_stake_ingress(
            post_cpi,
            StakeIngressRestorationObservation {
                source_after_restoration,
                stake_after_restoration: stake_after_transfer,
            },
        )
        .unwrap();
        assert_eq!(completed.config.staked_principal, STAKE_AMOUNT + PRINCIPAL);
        assert_eq!(completed.position.position_id, POSITION_ID);
        assert_eq!(completed.position.principal, PRINCIPAL);
        assert_eq!(completed.source.delegate, plan.original_delegate);
        assert_eq!(fixture.snapshot(), before);
        assert!(
            !core::hint::black_box(
                PRODUCTION_OPEN_POSITION_EXECUTOR_TRUTH.devnet_transaction_rollback_proven
            ),
            "pure reload vectors cannot replace validator rollback evidence"
        );
    }
}

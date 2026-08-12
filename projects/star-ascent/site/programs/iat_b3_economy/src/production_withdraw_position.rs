//! Strict retained-V2 `withdraw_position_principal` account composition.
//!
//! This module freezes the exact V2 instruction and eight base-account roles,
//! authenticates all identities needed by the retained pre-token-CPI kernel,
//! and returns only an opaque pre-CPI plan. Hook account expansion, Token-2022
//! CPI, Config/Position CAS, dispatch, and entrypoint composition remain absent
//! and fail closed.

use crate::native_adapter::{
    derive_pda, NativeAdapterError, NativeEconomyBinding, PdaIdentity, StrictStateValue,
};
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_adapter::{
    authenticate_production_active_writable_config_account_info,
    authenticate_runtime_production_active_writable_config, authenticate_signer_account_info,
    authenticate_state_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
    RuntimeValidatedDailyLawWrite,
};
use crate::stake_ingress_runtime::{observe_stake_ingress_source, observe_stake_ingress_vault};
use crate::{
    decode_position_state, prepare_withdraw_position_principal, CodecError, EconomyError,
    PositionState, PrepareWithdrawPositionPrincipalInput, ValidatedDailyLawWrite,
    WithdrawPositionPrincipalPreCpiPlan,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use spl_token_2022_interface::ID as TOKEN_2022_PROGRAM_ID;

pub const PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT: usize = 8;
pub const PRODUCTION_WITHDRAW_POSITION_STATUS: &str =
    "EXACT_V2_ACCOUNTS_PRE_TOKEN_CPI_PLAN_NO_EXECUTOR_NO_ENTRYPOINT_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionWithdrawPositionTruth {
    pub feature_gated: bool,
    pub exact_instruction_codec_required: bool,
    pub runtime_daily_law_capability_supported: bool,
    pub production_active_writable_config_required: bool,
    pub exact_eight_v2_account_order_and_flags_required: bool,
    pub arbitrary_readonly_signer_caller_preserved: bool,
    pub exact_position_pda_authenticated: bool,
    pub exact_vault_authority_and_stake_token_owner_bound: bool,
    pub owner_bound_destination_authenticated: bool,
    pub retained_v2_pre_token_cpi_kernel_used: bool,
    pub canonical_confidential_mint_policy_authenticated: bool,
    pub hooked_token_cpi_executed: bool,
    pub config_and_position_cas_executed: bool,
    pub supplemental_b3_account_graph_frozen: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_WITHDRAW_POSITION_TRUTH: ProductionWithdrawPositionTruth =
    ProductionWithdrawPositionTruth {
        feature_gated: true,
        exact_instruction_codec_required: true,
        runtime_daily_law_capability_supported: true,
        production_active_writable_config_required: true,
        exact_eight_v2_account_order_and_flags_required: true,
        arbitrary_readonly_signer_caller_preserved: true,
        exact_position_pda_authenticated: true,
        exact_vault_authority_and_stake_token_owner_bound: true,
        owner_bound_destination_authenticated: true,
        retained_v2_pre_token_cpi_kernel_used: true,
        canonical_confidential_mint_policy_authenticated: false,
        hooked_token_cpi_executed: false,
        config_and_position_cas_executed: false,
        supplemental_b3_account_graph_frozen: false,
        production_dispatcher_exposed: false,
        production_entrypoint_exposed: false,
        handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Debug, Eq, PartialEq)]
pub enum ProductionWithdrawPositionError {
    Instruction(ProductionInstructionError),
    WrongInstruction,
    AccountCountMismatch,
    AccountBindingMismatch,
    AccountMetaMismatch,
    AccountBorrowFailed,
    PositionCodec(CodecError),
    StateTypeMismatch,
    DestinationTokenRejected,
    StakeTokenRejected,
    Runtime(RuntimeAdapterError),
    Native(NativeAdapterError),
    Economy(EconomyError),
}

impl From<ProductionInstructionError> for ProductionWithdrawPositionError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

impl From<RuntimeAdapterError> for ProductionWithdrawPositionError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<NativeAdapterError> for ProductionWithdrawPositionError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<EconomyError> for ProductionWithdrawPositionError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PreparedProductionWithdrawPosition {
    caller: [u8; 32],
    config: [u8; 32],
    position: [u8; 32],
    vault_authority: [u8; 32],
    plan: WithdrawPositionPrincipalPreCpiPlan,
}

impl PreparedProductionWithdrawPosition {
    pub const fn caller(&self) -> [u8; 32] {
        self.caller
    }

    pub const fn config(&self) -> [u8; 32] {
        self.config
    }

    pub const fn position(&self) -> [u8; 32] {
        self.position
    }

    pub const fn vault_authority(&self) -> [u8; 32] {
        self.vault_authority
    }

    pub const fn plan(&self) -> &WithdrawPositionPrincipalPreCpiPlan {
        &self.plan
    }
}

#[inline(never)]
pub fn prepare_runtime_production_withdraw_position_account_infos(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionWithdrawPosition, ProductionWithdrawPositionError> {
    require_withdraw_position_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let active_config =
        authenticate_runtime_production_active_writable_config(runtime_law, binding, &accounts[1])?;
    prepare_with_active_config(runtime_law.gate(), &active_config, binding, accounts)
}

/// Host/rehearsal seam. Runtime composition must use
/// [`prepare_runtime_production_withdraw_position_account_infos`] so the Law
/// account and Clock remain runtime-authenticated facts.
#[inline(never)]
pub fn prepare_production_withdraw_position_account_infos(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionWithdrawPosition, ProductionWithdrawPositionError> {
    require_withdraw_position_instruction(instruction_data)?;
    require_exact_account_count(accounts)?;
    let active_config =
        authenticate_production_active_writable_config_account_info(gate, binding, &accounts[1])?;
    prepare_with_active_config(gate, &active_config, binding, accounts)
}

fn require_withdraw_position_instruction(
    instruction_data: &[u8],
) -> Result<(), ProductionWithdrawPositionError> {
    if decode_production_instruction(instruction_data)?
        != ProductionInstruction::WithdrawPositionPrincipal
    {
        return Err(ProductionWithdrawPositionError::WrongInstruction);
    }
    Ok(())
}

fn require_exact_account_count(
    accounts: &[AccountInfo<'_>],
) -> Result<(), ProductionWithdrawPositionError> {
    if accounts.len() != PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT {
        return Err(ProductionWithdrawPositionError::AccountCountMismatch);
    }
    Ok(())
}

fn prepare_with_active_config(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionWithdrawPosition, ProductionWithdrawPositionError> {
    let caller = authenticate_caller(gate, binding, &accounts[0])?;
    require_mint_meta(binding, &accounts[3])?;
    require_token_program(&accounts[7])?;

    let config = active_config.state().config;
    if config.mint != binding.mint()
        || config.token_program != TOKEN_2022_PROGRAM_ID.to_bytes()
        || config.stake_token_account != accounts[5].key.to_bytes()
    {
        return Err(ProductionWithdrawPositionError::AccountBindingMismatch);
    }

    let position = authenticate_position(gate, binding, &accounts[2], active_config.key())?;
    let vault_authority = derive_pda(
        binding,
        PdaIdentity::VaultAuthority {
            config: active_config.key(),
        },
    )?;
    if vault_authority.bump != config.vault_authority_bump {
        return Err(ProductionWithdrawPositionError::AccountBindingMismatch);
    }
    require_vault_authority_meta(&accounts[4], vault_authority.key)?;

    let vault_authority_key = Pubkey::new_from_array(vault_authority.key);
    let stake = observe_stake_ingress_vault(&accounts[5], accounts[3].key, &vault_authority_key)
        .map_err(|_| ProductionWithdrawPositionError::StakeTokenRejected)?;
    let destination = observe_stake_ingress_source(
        &accounts[6],
        accounts[3].key,
        &Pubkey::new_from_array(position.owner),
    )
    .map_err(|_| ProductionWithdrawPositionError::DestinationTokenRejected)?;

    let plan = prepare_withdraw_position_principal(
        gate,
        PrepareWithdrawPositionPrincipalInput {
            config_key: active_config.key(),
            config,
            position,
            mint: binding.mint(),
            vault_authority: vault_authority.key,
            stake_tokens: stake,
            destination_tokens: destination.token,
        },
    )?;

    Ok(PreparedProductionWithdrawPosition {
        caller,
        config: active_config.key(),
        position: accounts[2].key.to_bytes(),
        vault_authority: vault_authority.key,
        plan,
    })
}

fn authenticate_caller(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
) -> Result<[u8; 32], ProductionWithdrawPositionError> {
    if account.is_writable {
        return Err(ProductionWithdrawPositionError::AccountMetaMismatch);
    }
    let key = account.key.to_bytes();
    Ok(authenticate_signer_account_info(gate, binding, account, key, false)?.key())
}

fn authenticate_position(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
) -> Result<PositionState, ProductionWithdrawPositionError> {
    if account.owner.to_bytes() != binding.program_id() {
        return Err(ProductionWithdrawPositionError::AccountBindingMismatch);
    }
    if account.is_signer || !account.is_writable || account.executable {
        return Err(ProductionWithdrawPositionError::AccountMetaMismatch);
    }
    let data = account
        .try_borrow_data()
        .map_err(|_| ProductionWithdrawPositionError::AccountBorrowFailed)?;
    let state =
        decode_position_state(&data).map_err(ProductionWithdrawPositionError::PositionCodec)?;
    drop(data);
    let identity = PdaIdentity::Position {
        config,
        operator: state.owner,
        position_id: state.position_id,
    };
    let authenticated = authenticate_state_account_info(gate, binding, account, identity)?;
    match authenticated.state() {
        StrictStateValue::Position(state) => Ok(state),
        _ => Err(ProductionWithdrawPositionError::StateTypeMismatch),
    }
}

fn require_mint_meta(
    binding: &NativeEconomyBinding,
    mint: &AccountInfo<'_>,
) -> Result<(), ProductionWithdrawPositionError> {
    if mint.key.to_bytes() != binding.mint() || mint.owner != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionWithdrawPositionError::AccountBindingMismatch);
    }
    if mint.is_signer || mint.is_writable || mint.executable {
        return Err(ProductionWithdrawPositionError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_vault_authority_meta(
    account: &AccountInfo<'_>,
    expected_key: [u8; 32],
) -> Result<(), ProductionWithdrawPositionError> {
    if account.key.to_bytes() != expected_key {
        return Err(ProductionWithdrawPositionError::AccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionWithdrawPositionError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_token_program(program: &AccountInfo<'_>) -> Result<(), ProductionWithdrawPositionError> {
    if program.key != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionWithdrawPositionError::AccountBindingMismatch);
    }
    if program.is_signer || program.is_writable || !program.executable {
        return Err(ProductionWithdrawPositionError::AccountMetaMismatch);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::{
        encode_config_genesis_state, encode_position_state, verify_daily_law_open,
        CanonicalDailyLawBinding, ConfigGenesisState, ConfigState, GenesisPhase,
        ReadonlyDailyLawAccount, CONFIG_GENESIS_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC,
        LAW_STATE_VERSION, MAINNET_SUPPLY, POSITION_ACCOUNT_LEN, SECONDS_PER_WEEK, USER_TERM_WEEKS,
    };
    use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
    use solana_sdk_ids::{native_loader, system_program};
    use spl_token_2022_interface::{
        extension::{
            transfer_hook::TransferHookAccount, AccountType, BaseStateWithExtensionsMut,
            ExtensionType, StateWithExtensionsMut,
        },
        state::{Account as TokenAccount, AccountState},
    };

    const ECONOMY_PROGRAM: [u8; 32] = [0xE1; 32];
    const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
    const LAW_STATE: [u8; 32] = [0x51; 32];
    const LAW_BUMP: u8 = 254;
    const MINT: [u8; 32] = [0x22; 32];
    const NETWORK: [u8; 32] = [0x11; 32];
    const CALLER: [u8; 32] = [0xC1; 32];
    const POSITION_OWNER: [u8; 32] = [0xA1; 32];
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

    fn token_data(mint: [u8; 32], owner: [u8; 32], amount: u64) -> Vec<u8> {
        let extensions = [ExtensionType::TransferHookAccount];
        let len = ExtensionType::try_calculate_account_len::<TokenAccount>(&extensions).unwrap();
        let mut data = vec![0; len];
        let mut state =
            StateWithExtensionsMut::<TokenAccount>::unpack_uninitialized(&mut data).unwrap();
        state.get_account_type_mut()[0] = u8::from(AccountType::Account);
        state.base = TokenAccount {
            mint: mint.into(),
            owner: owner.into(),
            amount,
            state: AccountState::Initialized,
            ..TokenAccount::default()
        };
        state.init_extension::<TransferHookAccount>(false).unwrap();
        state.pack_base();
        data
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
        caller: TestAccount,
        config: TestAccount,
        position: TestAccount,
        mint: TestAccount,
        vault_authority: TestAccount,
        stake_tokens: TestAccount,
        destination_tokens: TestAccount,
        token_program: TestAccount,
    }

    impl Fixture {
        fn new(binding: &NativeEconomyBinding) -> Self {
            let vault_authority = derive_pda(
                binding,
                PdaIdentity::VaultAuthority {
                    config: binding.config(),
                },
            )
            .unwrap();
            let stake_key = derive_pda(
                binding,
                PdaIdentity::StakeToken {
                    config: binding.config(),
                },
            )
            .unwrap()
            .key;
            let config_state = ConfigGenesisState {
                phase: GenesisPhase::Active,
                config: ConfigState {
                    admin: [0x21; 32],
                    mint: MINT,
                    token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
                    randomness_program: [0x44; 32],
                    stake_token_account: stake_key,
                    agency_registry_hash: [0x66; 32],
                    genesis_timestamp: CLOCK_TIMESTAMP - 55 * SECONDS_PER_WEEK,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: 100,
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

            let position_identity = PdaIdentity::Position {
                config: binding.config(),
                operator: POSITION_OWNER,
                position_id: 7,
            };
            let position_key = derive_pda(binding, position_identity).unwrap();
            let position_state = PositionState {
                config: binding.config(),
                owner: POSITION_OWNER,
                position_id: 7,
                principal: 100,
                accepted_week: 1,
                first_accrual_week: 2,
                term_weeks: USER_TERM_WEEKS,
                annual_rate_bps: 500,
                treasury_reserved: 0,
                ecosystem_reserved: 0,
                liquidity_reserved: 0,
                paid: 0,
                settled_mask: 0,
                agency_index: u32::MAX,
                role: 0,
                principal_returned: false,
                closed: false,
                bump: position_key.bump,
            };
            let mut position_data = [0u8; POSITION_ACCOUNT_LEN];
            encode_position_state(&position_state, &mut position_data).unwrap();

            Self {
                caller: TestAccount {
                    key: CALLER.into(),
                    owner: system_program::ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: true,
                    writable: false,
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
                position: TestAccount {
                    key: position_key.key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: position_data.to_vec(),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                mint: TestAccount {
                    key: MINT.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                vault_authority: TestAccount {
                    key: vault_authority.key.into(),
                    owner: system_program::ID,
                    lamports: 0,
                    data: Vec::new(),
                    signer: false,
                    writable: false,
                    executable: false,
                },
                stake_tokens: TestAccount {
                    key: stake_key.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(MINT, vault_authority.key, 100),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                destination_tokens: TestAccount {
                    key: [0x72; 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(MINT, POSITION_OWNER, 1_000),
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
            }
        }

        fn with_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &mut [AccountInfo<'_>; PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT],
            ) -> R,
        ) -> R {
            let mut infos = [
                self.caller.info(),
                self.config.info(),
                self.position.info(),
                self.mint.info(),
                self.vault_authority.info(),
                self.stake_tokens.info(),
                self.destination_tokens.info(),
                self.token_program.info(),
            ];
            operation(&mut infos)
        }

        fn snapshot(&self) -> [Vec<u8>; 4] {
            [
                self.config.data.clone(),
                self.position.data.clone(),
                self.stake_tokens.data.clone(),
                self.destination_tokens.data.clone(),
            ]
        }
    }

    #[test]
    fn exact_accounts_produce_v2_pre_cpi_plan_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::WithdrawPositionPrincipal);
        let mut fixture = Fixture::new(&binding);
        let before = fixture.snapshot();
        fixture.with_infos(|accounts| {
            let prepared = prepare_production_withdraw_position_account_infos(
                &gate,
                &binding,
                &instruction,
                accounts,
            )
            .unwrap();
            assert_eq!(prepared.caller(), CALLER);
            assert_eq!(prepared.config(), binding.config());
            assert_eq!(prepared.position(), accounts[2].key.to_bytes());
            assert_eq!(prepared.vault_authority(), accounts[4].key.to_bytes());
            assert_eq!(prepared.plan().maturity_week, 53);
            assert_eq!(prepared.plan().transfer.source, accounts[5].key.to_bytes());
            assert_eq!(
                prepared.plan().transfer.destination,
                accounts[6].key.to_bytes()
            );
            assert_eq!(
                prepared.plan().transfer.authority,
                accounts[4].key.to_bytes()
            );
            assert_eq!(prepared.plan().transfer.amount, 100);
        });
        assert_eq!(fixture.snapshot(), before);
    }

    #[test]
    fn every_slot_and_meta_drift_fails_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::WithdrawPositionPrincipal);

        for index in 0..(PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT - 1) {
            let mut fixture = Fixture::new(&binding);
            let before = fixture.snapshot();
            fixture.with_infos(|accounts| {
                accounts.swap(index, index + 1);
                assert!(prepare_production_withdraw_position_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                )
                .is_err());
            });
            assert_eq!(fixture.snapshot(), before, "slot swap {index}");
        }

        for index in 0..PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT {
            for flag in 0..3 {
                let mut fixture = Fixture::new(&binding);
                let before = fixture.snapshot();
                fixture.with_infos(|accounts| {
                    match flag {
                        0 => accounts[index].is_signer = !accounts[index].is_signer,
                        1 => accounts[index].is_writable = !accounts[index].is_writable,
                        2 => accounts[index].executable = !accounts[index].executable,
                        _ => unreachable!(),
                    }
                    assert!(prepare_production_withdraw_position_account_infos(
                        &gate,
                        &binding,
                        &instruction,
                        accounts,
                    )
                    .is_err());
                });
                assert_eq!(
                    fixture.snapshot(),
                    before,
                    "meta flip account {index}, flag {flag}"
                );
            }
        }
    }

    #[test]
    fn instruction_count_identity_and_semantic_failures_are_atomic() {
        let binding = binding();
        let gate = open_gate();
        let valid = encoded(ProductionInstruction::WithdrawPositionPrincipal);
        let wrong = encoded(ProductionInstruction::ClosePosition);
        let mut fixture = Fixture::new(&binding);
        let before = fixture.snapshot();
        fixture.with_infos(|accounts| {
            assert_eq!(
                prepare_production_withdraw_position_account_infos(
                    &gate, &binding, &wrong, accounts,
                ),
                Err(ProductionWithdrawPositionError::WrongInstruction)
            );
            assert_eq!(
                prepare_production_withdraw_position_account_infos(
                    &gate,
                    &binding,
                    &valid,
                    &accounts[..7],
                ),
                Err(ProductionWithdrawPositionError::AccountCountMismatch)
            );
        });
        assert_eq!(fixture.snapshot(), before);

        let mut wrong_vault = Fixture::new(&binding);
        wrong_vault.vault_authority.key = Pubkey::new_unique();
        wrong_vault.with_infos(|accounts| {
            assert_eq!(
                prepare_production_withdraw_position_account_infos(
                    &gate, &binding, &valid, accounts,
                ),
                Err(ProductionWithdrawPositionError::AccountBindingMismatch)
            );
        });

        let mut donated = Fixture::new(&binding);
        donated.stake_tokens.data = token_data(
            MINT,
            derive_pda(
                &binding,
                PdaIdentity::VaultAuthority {
                    config: binding.config(),
                },
            )
            .unwrap()
            .key,
            101,
        );
        let donated_before = donated.snapshot();
        donated.with_infos(|accounts| {
            assert_eq!(
                prepare_production_withdraw_position_account_infos(
                    &gate, &binding, &valid, accounts,
                ),
                Err(ProductionWithdrawPositionError::Economy(
                    EconomyError::StakeLedgerMismatch
                ))
            );
        });
        assert_eq!(donated.snapshot(), donated_before);
    }

    #[test]
    fn late_destination_borrow_conflict_preserves_all_candidate_preimages() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::WithdrawPositionPrincipal);
        let mut fixture = Fixture::new(&binding);
        fixture.with_infos(|accounts| {
            let held = accounts[6].try_borrow_mut_data().unwrap();
            let before = held.to_vec();
            assert_eq!(
                prepare_production_withdraw_position_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                ),
                Err(ProductionWithdrawPositionError::DestinationTokenRejected)
            );
            assert_eq!(&held[..], before.as_slice());
        });
    }

    #[test]
    fn truth_is_pre_cpi_only_and_unconditionally_held() {
        let truth = PRODUCTION_WITHDRAW_POSITION_TRUTH;
        assert!(truth.feature_gated);
        assert!(truth.exact_instruction_codec_required);
        assert!(truth.runtime_daily_law_capability_supported);
        assert!(truth.production_active_writable_config_required);
        assert!(truth.exact_eight_v2_account_order_and_flags_required);
        assert!(truth.arbitrary_readonly_signer_caller_preserved);
        assert!(truth.exact_position_pda_authenticated);
        assert!(truth.exact_vault_authority_and_stake_token_owner_bound);
        assert!(truth.owner_bound_destination_authenticated);
        assert!(truth.retained_v2_pre_token_cpi_kernel_used);
        assert!(!truth.canonical_confidential_mint_policy_authenticated);
        assert!(!truth.hooked_token_cpi_executed);
        assert!(!truth.config_and_position_cas_executed);
        assert!(!truth.supplemental_b3_account_graph_frozen);
        assert!(!truth.production_dispatcher_exposed);
        assert!(!truth.production_entrypoint_exposed);
        assert!(!truth.handler_complete);
        assert!(truth.mainnet_hold);
        assert!(PRODUCTION_WITHDRAW_POSITION_STATUS.contains("MAINNET_HOLD"));
    }
}

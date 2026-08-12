#![deny(unsafe_code)]

extern crate alloc;

use alloc::{boxed::Box, vec::Vec};
use iat_b3_economy::native_adapter::{derive_pda, NativeEconomyBinding, PdaIdentity};
use iat_b3_economy::production_claim_lane_principal_executor::{
    execute_runtime_production_claim_lane_principal_account_infos,
    ProductionClaimLanePrincipalExecutorError,
};
use iat_b3_economy::runtime_adapter::{
    verify_daily_law_open_account_info, verify_runtime_daily_law_open_account_info,
    RuntimeAdapterError, RuntimeValidatedDailyLawWrite,
};
use iat_b3_economy::{
    activate, decode_config_genesis_state, encode_config_genesis_state, encode_lane_state,
    initialize_config, initialize_lane_vault, initialize_stake_vault, ActivateInput,
    CanonicalDailyLawBinding, ConfigGenesisState, EconomyError, GenesisPhase,
    InitializeConfigInput, InitializeLaneVaultInput, InitializeStakeVaultInput, LaneState,
    ReadonlyMintState, ReadonlyTokenState, COMMUNITY_CUSTODY, CONFIG_GENESIS_ACCOUNT_LEN,
    CORE_TEAM, ECOSYSTEM, LANE_ACCOUNT_LEN, LIQUIDITY, MAINNET_SUPPLY, ON_DEMAND_MAINNET_PID,
    PROGRAM_ADMIN, TOKEN_DECIMALS, TREASURY,
};
use solana_account_info::{next_account_info, AccountInfo};
use solana_cpi::{invoke, invoke_signed};
use solana_program_entrypoint::ProgramResult;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;
use solana_rent::Rent;
use solana_sdk_ids::system_program;
use solana_system_interface::instruction::create_account;
use solana_sysvar::Sysvar;
use spl_token_2022_interface::{
    extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
    instruction::initialize_account3,
    state::{Account as TokenAccount, Mint},
    ID as TOKEN_2022_PROGRAM_ID,
};

solana_program_entrypoint::entrypoint!(process_instruction);

// Conspicuous fixture identities; neither is a deployment candidate.
pub const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
pub const LAW_HOOK_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB4; 32]);
pub const NETWORK_GENESIS_HASH: [u8; 32] = [0x91; 32];
const LAW_STATE_SEED: &[u8] = b"law-state";

#[repr(u32)]
enum FixtureEconomyError {
    InvalidInstruction = 0xE300,
    InvalidAccount = 0xE301,
    SeedRejected = 0xE302,
    ProductionExecutorRejected = 0xE303,
    InjectedAfterExecutorSuccess = 0xE304,
    SyntheticLawCapabilityMismatch = 0xE305,
}

const FIXTURE_LANE_TOTAL: u64 = 100;
const SHADOW_LAW_DECISION_BYTE_OFFSET: usize = 128;

impl From<FixtureEconomyError> for ProgramError {
    fn from(value: FixtureEconomyError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    data: &[u8],
) -> ProgramResult {
    if program_id != &ECONOMY_PROGRAM_ID || data.is_empty() {
        return Err(FixtureEconomyError::InvalidInstruction.into());
    }
    match data[0] {
        0 if data.len() == 2 => initialize_lane_token(program_id, accounts, data[1]),
        1 if data.len() == 1 => seed_rehearsal_state(program_id, accounts),
        2 if data.len() == 34 && data[1] <= 3 => {
            execute_real_claim_lane_principal(program_id, accounts, data[1], &data[2..34])
        }
        3 if data.len() == 2 && data[1] <= 1 => {
            set_fixture_config_active(program_id, accounts, data[1] == 1)
        }
        _ => Err(FixtureEconomyError::InvalidInstruction.into()),
    }
}

fn set_fixture_config_active(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    active: bool,
) -> ProgramResult {
    if accounts.len() != 4 {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let authority = &accounts[0];
    let config = &accounts[1];
    let mint = &accounts[2];
    let law_state = &accounts[3];
    let binding = NativeEconomyBinding::new(program_id.to_bytes(), mint.key.to_bytes())
        .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    verify_daily_law_open_account_info(&law_binding(mint.key), law_state)
        .map_err(map_runtime_law_error)?;
    if !authority.is_signer
        || authority.is_writable
        || config.key.to_bytes() != binding.config()
        || config.owner != program_id
        || !config.is_writable
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || mint.is_writable
        || law_state.is_writable
    {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let mut data = config.try_borrow_mut_data()?;
    let mut state =
        decode_config_genesis_state(&data).map_err(|_| FixtureEconomyError::InvalidAccount)?;
    if state.config.admin != authority.key.to_bytes() {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let (phase, active) = fixture_config_lifecycle_pair(active);
    state.phase = phase;
    state.config.active = active;
    encode_config_genesis_state(&state, &mut data)
        .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    Ok(())
}

const fn fixture_config_lifecycle_pair(active: bool) -> (GenesisPhase, bool) {
    if active {
        (GenesisPhase::Active, true)
    } else {
        (GenesisPhase::GenesisStaging, false)
    }
}

fn law_binding(mint: &Pubkey) -> CanonicalDailyLawBinding {
    let (law_state, bump) =
        Pubkey::find_program_address(&[LAW_STATE_SEED, mint.as_ref()], &LAW_HOOK_PROGRAM_ID);
    CanonicalDailyLawBinding::new(
        LAW_HOOK_PROGRAM_ID.to_bytes(),
        law_state.to_bytes(),
        bump,
        mint.to_bytes(),
        NETWORK_GENESIS_HASH,
    )
}

#[inline(never)]
fn execute_real_claim_lane_principal(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    mode: u8,
    production_instruction: &[u8],
) -> ProgramResult {
    if accounts.len() != 12 {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let mint = &accounts[2];
    let runtime_law =
        verify_runtime_daily_law_open_account_info(&law_binding(mint.key), &accounts[11])
            .map_err(map_runtime_law_error)?;
    let binding = NativeEconomyBinding::new(program_id.to_bytes(), mint.key.to_bytes())
        .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    if mode == 3 {
        return execute_shadow_law_capability_mismatch(
            program_id,
            &runtime_law,
            &binding,
            production_instruction,
            accounts,
        );
    }
    let executor_program_id = if mode == 2 {
        Pubkey::new_from_array([0xEF; 32])
    } else {
        *program_id
    };
    execute_runtime_production_claim_lane_principal_account_infos(
        &executor_program_id,
        &runtime_law,
        &binding,
        production_instruction,
        accounts,
    )
    .map_err(map_executor_error)?;
    if mode == 1 {
        return Err(FixtureEconomyError::InjectedAfterExecutorSuccess.into());
    }
    Ok(())
}

#[inline(never)]
fn execute_shadow_law_capability_mismatch(
    program_id: &Pubkey,
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    production_instruction: &[u8],
    accounts: &[AccountInfo<'_>],
) -> ProgramResult {
    macro_rules! copy_account_parts {
        ($index:literal, $key:ident, $owner:ident, $lamports:ident, $data:ident) => {
            let $key = *accounts[$index].key;
            let $owner = *accounts[$index].owner;
            let mut $lamports = accounts[$index].lamports();
            let mut $data: Vec<u8> = accounts[$index].try_borrow_data()?.to_vec();
        };
    }
    copy_account_parts!(0, key0, owner0, lamports0, data0);
    copy_account_parts!(1, key1, owner1, lamports1, data1);
    copy_account_parts!(2, key2, owner2, lamports2, data2);
    copy_account_parts!(3, key3, owner3, lamports3, data3);
    copy_account_parts!(4, key4, owner4, lamports4, data4);
    copy_account_parts!(5, key5, owner5, lamports5, data5);
    copy_account_parts!(6, key6, owner6, lamports6, data6);
    copy_account_parts!(7, key7, owner7, lamports7, data7);
    copy_account_parts!(8, key8, owner8, lamports8, data8);
    copy_account_parts!(9, key9, owner9, lamports9, data9);
    copy_account_parts!(10, key10, owner10, lamports10, data10);
    copy_account_parts!(11, key11, owner11, lamports11, data11);
    let real_law_before = data11.clone();
    if data11.len() <= SHADOW_LAW_DECISION_BYTE_OFFSET {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    data11[SHADOW_LAW_DECISION_BYTE_OFFSET] ^= 1;
    if data11 == real_law_before {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let shadow_accounts = [
        AccountInfo::new(
            &key0,
            accounts[0].is_signer,
            accounts[0].is_writable,
            &mut lamports0,
            &mut data0,
            &owner0,
            accounts[0].executable,
        ),
        AccountInfo::new(
            &key1,
            accounts[1].is_signer,
            accounts[1].is_writable,
            &mut lamports1,
            &mut data1,
            &owner1,
            accounts[1].executable,
        ),
        AccountInfo::new(
            &key2,
            accounts[2].is_signer,
            accounts[2].is_writable,
            &mut lamports2,
            &mut data2,
            &owner2,
            accounts[2].executable,
        ),
        AccountInfo::new(
            &key3,
            accounts[3].is_signer,
            accounts[3].is_writable,
            &mut lamports3,
            &mut data3,
            &owner3,
            accounts[3].executable,
        ),
        AccountInfo::new(
            &key4,
            accounts[4].is_signer,
            accounts[4].is_writable,
            &mut lamports4,
            &mut data4,
            &owner4,
            accounts[4].executable,
        ),
        AccountInfo::new(
            &key5,
            accounts[5].is_signer,
            accounts[5].is_writable,
            &mut lamports5,
            &mut data5,
            &owner5,
            accounts[5].executable,
        ),
        AccountInfo::new(
            &key6,
            accounts[6].is_signer,
            accounts[6].is_writable,
            &mut lamports6,
            &mut data6,
            &owner6,
            accounts[6].executable,
        ),
        AccountInfo::new(
            &key7,
            accounts[7].is_signer,
            accounts[7].is_writable,
            &mut lamports7,
            &mut data7,
            &owner7,
            accounts[7].executable,
        ),
        AccountInfo::new(
            &key8,
            accounts[8].is_signer,
            accounts[8].is_writable,
            &mut lamports8,
            &mut data8,
            &owner8,
            accounts[8].executable,
        ),
        AccountInfo::new(
            &key9,
            accounts[9].is_signer,
            accounts[9].is_writable,
            &mut lamports9,
            &mut data9,
            &owner9,
            accounts[9].executable,
        ),
        AccountInfo::new(
            &key10,
            accounts[10].is_signer,
            accounts[10].is_writable,
            &mut lamports10,
            &mut data10,
            &owner10,
            accounts[10].executable,
        ),
        AccountInfo::new(
            &key11,
            false,
            false,
            &mut lamports11,
            &mut data11,
            &owner11,
            false,
        ),
    ];
    let result = execute_runtime_production_claim_lane_principal_account_infos(
        program_id,
        runtime_law,
        binding,
        production_instruction,
        &shadow_accounts,
    );
    let real_law_after = accounts[11].try_borrow_data()?;
    if !real_law_after.iter().eq(real_law_before.iter()) {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    match result {
        Err(ProductionClaimLanePrincipalExecutorError::LawCapabilityMismatch) => {
            Err(FixtureEconomyError::SyntheticLawCapabilityMismatch.into())
        }
        _ => Err(FixtureEconomyError::InvalidAccount.into()),
    }
}

#[inline(never)]
fn seed_rehearsal_state(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    if accounts.len() != 9 {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let payer = &accounts[0];
    let mint = &accounts[1];
    let config_account = &accounts[2];
    let treasury_account = &accounts[3];
    let ecosystem_account = &accounts[4];
    let core_account = &accounts[5];
    let liquidity_account = &accounts[6];
    let system = &accounts[7];
    let law_state = &accounts[8];
    if !payer.is_signer
        || !payer.is_writable
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || mint.is_writable
        || system.key != &system_program::ID
        || !system.executable
    {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let binding = NativeEconomyBinding::new(program_id.to_bytes(), mint.key.to_bytes())
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    let gate = verify_daily_law_open_account_info(&law_binding(mint.key), law_state)
        .map_err(map_runtime_law_error)?;
    let mut prepared = prepare_seed_state(&binding, &gate, mint, payer.key.to_bytes())?;
    for lane in [
        &mut prepared.treasury,
        &mut prepared.ecosystem,
        &mut prepared.core,
        &mut prepared.liquidity,
    ] {
        lane.total = FIXTURE_LANE_TOTAL;
        lane.genesis_unlocked = FIXTURE_LANE_TOTAL;
        lane.cliff_week = 0;
        lane.linear_end_week = 1;
        lane.reserved = 0;
        lane.paid = 0;
        lane.principal_claimed = 0;
    }
    persist_config(
        program_id,
        payer,
        mint,
        config_account,
        system,
        &binding,
        &prepared.config,
    )?;
    persist_lane(
        program_id,
        payer,
        treasury_account,
        system,
        &binding,
        prepared.treasury,
    )?;
    persist_lane(
        program_id,
        payer,
        ecosystem_account,
        system,
        &binding,
        prepared.ecosystem,
    )?;
    persist_lane(
        program_id,
        payer,
        core_account,
        system,
        &binding,
        prepared.core,
    )?;
    persist_lane(
        program_id,
        payer,
        liquidity_account,
        system,
        &binding,
        prepared.liquidity,
    )
}

fn map_runtime_law_error(error: RuntimeAdapterError) -> ProgramError {
    match error {
        RuntimeAdapterError::Economy(EconomyError::DayUnfinalized) => ProgramError::Custom(0xB30C),
        RuntimeAdapterError::Economy(EconomyError::DailyLockdown) => ProgramError::Custom(0xB30D),
        _ => ProgramError::Custom(0xB30B),
    }
}

fn map_executor_error(error: ProductionClaimLanePrincipalExecutorError) -> ProgramError {
    match error {
        ProductionClaimLanePrincipalExecutorError::Program(program) => program,
        _ => FixtureEconomyError::ProductionExecutorRejected.into(),
    }
}

fn initialize_lane_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    lane: u8,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let lane_token = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    let token_program = next_account_info(account_iter)?;
    if account_iter.next().is_some()
        || !payer.is_signer
        || !payer.is_writable
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || mint.is_writable
        || system.key != &system_program::ID
        || !system.executable
        || token_program.key != &TOKEN_2022_PROGRAM_ID
        || !token_program.executable
    {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let binding = NativeEconomyBinding::new(program_id.to_bytes(), mint.key.to_bytes())
        .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    if !matches!(lane, TREASURY | ECOSYSTEM | CORE_TEAM | LIQUIDITY) {
        return Err(FixtureEconomyError::InvalidInstruction.into());
    }
    let derived = derive_pda(
        &binding,
        PdaIdentity::LaneToken {
            config: binding.config(),
            lane,
        },
    )
    .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    let vault_authority = derive_pda(
        &binding,
        PdaIdentity::VaultAuthority {
            config: binding.config(),
        },
    )
    .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    require_vacant_target(lane_token, derived.key)?;
    let account_len = ExtensionType::try_calculate_account_len::<TokenAccount>(&[
        ExtensionType::TransferHookAccount,
    ])?;
    let rent = Rent::get()?;
    let create = create_account(
        payer.key,
        lane_token.key,
        rent.minimum_balance(account_len),
        u64::try_from(account_len).map_err(|_| FixtureEconomyError::InvalidAccount)?,
        &TOKEN_2022_PROGRAM_ID,
    );
    invoke_signed(
        &create,
        &[payer.clone(), lane_token.clone(), system.clone()],
        &[&[
            b"lane-token",
            binding.config().as_ref(),
            &[lane],
            &[derived.bump],
        ]],
    )?;
    let initialize = initialize_account3(
        &TOKEN_2022_PROGRAM_ID,
        lane_token.key,
        mint.key,
        &Pubkey::new_from_array(vault_authority.key),
    )?;
    invoke(
        &initialize,
        &[lane_token.clone(), mint.clone(), token_program.clone()],
    )?;
    require_exact_lane_token(
        lane_token,
        mint.key,
        &Pubkey::new_from_array(vault_authority.key),
    )
}

fn require_exact_lane_token(
    account: &AccountInfo<'_>,
    mint: &Pubkey,
    owner: &Pubkey,
) -> ProgramResult {
    let data = account.try_borrow_data()?;
    let state = StateWithExtensions::<TokenAccount>::unpack(&data)
        .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    if state.base.mint != *mint
        || state.base.owner != *owner
        || state.base.amount != 0
        || state.base.delegate.is_some()
        || state.base.close_authority.is_some()
        || state.base.is_native.is_some()
        || state.get_extension_types()? != [ExtensionType::TransferHookAccount]
    {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    Ok(())
}

struct PreparedSeedState {
    config: ConfigGenesisState,
    treasury: LaneState,
    ecosystem: LaneState,
    core: LaneState,
    liquidity: LaneState,
}

struct PreparedActivationSeed {
    config: iat_b3_economy::ConfigState,
    treasury: LaneState,
    ecosystem: LaneState,
    core_team: LaneState,
    liquidity: LaneState,
    vault_authority: [u8; 32],
    stake_token: [u8; 32],
}

#[inline(never)]
fn prepare_seed_state(
    binding: &NativeEconomyBinding,
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    mint_account: &AccountInfo<'_>,
    fixture_controller: [u8; 32],
) -> Result<Box<PreparedSeedState>, ProgramError> {
    let prepared = prepare_activation_seed(binding, gate, mint_account)?;
    let (activation, core_team) = execute_activation_seed(binding, gate, mint_account, prepared)?;
    Ok(finalize_seed_state(
        activation,
        core_team,
        fixture_controller,
    ))
}

#[inline(never)]
fn prepare_activation_seed(
    binding: &NativeEconomyBinding,
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    mint_account: &AccountInfo<'_>,
) -> Result<Box<PreparedActivationSeed>, ProgramError> {
    let config = binding.config();
    let vault_authority = derive_pda(binding, PdaIdentity::VaultAuthority { config })
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    let stake_token = derive_pda(binding, PdaIdentity::StakeToken { config })
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    let mut config_state = initialize_config(
        gate,
        InitializeConfigInput {
            admin: PROGRAM_ADMIN,
            mint: mint_account.key.to_bytes(),
            mint_decimals: TOKEN_DECIMALS,
            token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
            rehearsal_mode: false,
            rehearsal_genesis_timestamp: None,
            randomness_program: ON_DEMAND_MAINNET_PID,
            config_bump: binding.config_bump(),
            vault_authority_bump: vault_authority.bump,
        },
    )
    .map_err(|_| FixtureEconomyError::SeedRejected)?
    .config;

    let (next, treasury) = initialize_lane(binding, gate, config_state, TREASURY)?;
    config_state = next;
    let (next, ecosystem) = initialize_lane(binding, gate, config_state, ECOSYSTEM)?;
    config_state = next;
    let (next, core_team) = initialize_lane(binding, gate, config_state, CORE_TEAM)?;
    config_state = next;
    let (next, liquidity) = initialize_lane(binding, gate, config_state, LIQUIDITY)?;
    config_state = next;
    config_state = initialize_stake_vault(
        gate,
        InitializeStakeVaultInput {
            config: config_state,
            stake_token_account: stake_token.key,
        },
    )
    .map_err(|_| FixtureEconomyError::SeedRejected)?
    .config;

    Ok(Box::new(PreparedActivationSeed {
        config: config_state,
        treasury,
        ecosystem,
        core_team,
        liquidity,
        vault_authority: vault_authority.key,
        stake_token: stake_token.key,
    }))
}

#[inline(never)]
fn require_activation_mint(mint_account: &AccountInfo<'_>) -> Result<u64, ProgramError> {
    let mint_data = mint_account.try_borrow_data()?;
    let mint = StateWithExtensions::<Mint>::unpack(&mint_data)
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    if mint.base.supply != MAINNET_SUPPLY
        || mint.base.decimals != TOKEN_DECIMALS
        || mint.base.mint_authority.is_some()
        || mint.base.freeze_authority.is_some()
    {
        return Err(FixtureEconomyError::SeedRejected.into());
    }
    Ok(mint.base.supply)
}

#[inline(never)]
fn execute_activation_seed(
    binding: &NativeEconomyBinding,
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    mint_account: &AccountInfo<'_>,
    prepared: Box<PreparedActivationSeed>,
) -> Result<(Box<iat_b3_economy::ActivateResult>, LaneState), ProgramError> {
    let core_team = prepared.core_team;
    let mint_supply = require_activation_mint(mint_account)?;
    let input = Box::new(ActivateInput {
        config_key: binding.config(),
        config: prepared.config,
        mint: ReadonlyMintState {
            key: mint_account.key.to_bytes(),
            supply: mint_supply,
            mint_authority: None,
            freeze_authority: None,
        },
        vault_authority: prepared.vault_authority,
        community_tokens: ReadonlyTokenState {
            key: [0xC0; 32],
            mint: mint_account.key.to_bytes(),
            owner: COMMUNITY_CUSTODY,
            amount: 500_000_000_000_000_000,
        },
        stake_tokens: ReadonlyTokenState {
            key: prepared.stake_token,
            mint: mint_account.key.to_bytes(),
            owner: prepared.vault_authority,
            amount: 0,
        },
        treasury: prepared.treasury,
        treasury_tokens: lane_tokens(
            prepared.treasury,
            mint_account.key,
            prepared.vault_authority,
        ),
        ecosystem: prepared.ecosystem,
        ecosystem_tokens: lane_tokens(
            prepared.ecosystem,
            mint_account.key,
            prepared.vault_authority,
        ),
        core_team: prepared.core_team,
        core_team_tokens: lane_tokens(
            prepared.core_team,
            mint_account.key,
            prepared.vault_authority,
        ),
        liquidity: prepared.liquidity,
        liquidity_tokens: lane_tokens(
            prepared.liquidity,
            mint_account.key,
            prepared.vault_authority,
        ),
        core_reward_bump: derive_pda(
            binding,
            PdaIdentity::CoreReward {
                config: binding.config(),
            },
        )
        .map_err(|_| FixtureEconomyError::SeedRejected)?
        .bump,
    });
    Ok((execute_boxed_activation(gate, input)?, core_team))
}

#[inline(never)]
fn execute_boxed_activation(
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    input: Box<ActivateInput>,
) -> Result<Box<iat_b3_economy::ActivateResult>, ProgramError> {
    let activation = activate(gate, *input).map_err(|_| FixtureEconomyError::SeedRejected)?;
    Ok(Box::new(activation))
}

#[inline(never)]
fn finalize_seed_state(
    activation: Box<iat_b3_economy::ActivateResult>,
    core_team: LaneState,
    fixture_controller: [u8; 32],
) -> Box<PreparedSeedState> {
    let mut config = activation.config;
    config.admin = fixture_controller;
    Box::new(PreparedSeedState {
        config: ConfigGenesisState {
            phase: GenesisPhase::Active,
            config,
        },
        treasury: activation.treasury,
        ecosystem: activation.ecosystem,
        core: core_team,
        liquidity: activation.liquidity,
    })
}

fn initialize_lane(
    binding: &NativeEconomyBinding,
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    config_state: iat_b3_economy::ConfigState,
    lane: u8,
) -> Result<(iat_b3_economy::ConfigState, LaneState), ProgramError> {
    let config = binding.config();
    let lane_state = derive_pda(binding, PdaIdentity::LaneState { config, lane })
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    let lane_token = derive_pda(binding, PdaIdentity::LaneToken { config, lane })
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    let result = initialize_lane_vault(
        gate,
        InitializeLaneVaultInput {
            config_key: config,
            config: config_state,
            lane,
            lane_token_account: lane_token.key,
            lane_state_bump: lane_state.bump,
            lane_token_bump: lane_token.bump,
        },
    )
    .map_err(|_| FixtureEconomyError::SeedRejected)?;
    Ok((result.config, result.lane_state))
}

fn lane_tokens(lane: LaneState, mint: &Pubkey, vault_authority: [u8; 32]) -> ReadonlyTokenState {
    ReadonlyTokenState {
        key: lane.token_account,
        mint: mint.to_bytes(),
        owner: vault_authority,
        amount: lane.total,
    }
}

fn persist_config<'info>(
    program_id: &Pubkey,
    payer: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    target: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
    binding: &NativeEconomyBinding,
    state: &ConfigGenesisState,
) -> ProgramResult {
    require_vacant_target(target, binding.config())?;
    let mut encoded = [0u8; CONFIG_GENESIS_ACCOUNT_LEN];
    encode_config_genesis_state(state, &mut encoded)
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    create_and_write(
        program_id,
        payer,
        target,
        system,
        &[b"config", mint.key.as_ref(), &[binding.config_bump()]],
        &encoded,
    )
}

fn persist_lane<'info>(
    program_id: &Pubkey,
    payer: &AccountInfo<'info>,
    target: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
    binding: &NativeEconomyBinding,
    state: LaneState,
) -> ProgramResult {
    let derived = derive_pda(
        binding,
        PdaIdentity::LaneState {
            config: binding.config(),
            lane: state.lane,
        },
    )
    .map_err(|_| FixtureEconomyError::SeedRejected)?;
    require_vacant_target(target, derived.key)?;
    let mut encoded = [0u8; LANE_ACCOUNT_LEN];
    encode_lane_state(&state, &mut encoded).map_err(|_| FixtureEconomyError::SeedRejected)?;
    create_and_write(
        program_id,
        payer,
        target,
        system,
        &[
            b"lane",
            binding.config().as_ref(),
            &[state.lane],
            &[derived.bump],
        ],
        &encoded,
    )
}

fn create_and_write<'info>(
    program_id: &Pubkey,
    payer: &AccountInfo<'info>,
    target: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
    signer_seeds: &[&[u8]],
    data: &[u8],
) -> ProgramResult {
    let rent = Rent::get()?;
    let create = create_account(
        payer.key,
        target.key,
        rent.minimum_balance(data.len()),
        u64::try_from(data.len()).map_err(|_| FixtureEconomyError::SeedRejected)?,
        program_id,
    );
    invoke_signed(
        &create,
        &[payer.clone(), target.clone(), system.clone()],
        &[signer_seeds],
    )?;
    if target.owner != program_id || target.data_len() != data.len() {
        return Err(FixtureEconomyError::SeedRejected.into());
    }
    target.try_borrow_mut_data()?.copy_from_slice(data);
    Ok(())
}

fn require_vacant_target(target: &AccountInfo<'_>, expected: [u8; 32]) -> ProgramResult {
    if target.key.to_bytes() != expected
        || target.owner != &system_program::ID
        || **target.try_borrow_lamports()? != 0
        || !target.try_borrow_data()?.is_empty()
        || target.is_signer
        || !target.is_writable
        || target.executable
    {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{fixture_config_lifecycle_pair, GenesisPhase};

    #[test]
    fn fixture_active_flag_maps_to_the_canonical_phase_pair() {
        let (phase, active) = fixture_config_lifecycle_pair(false);
        assert!(matches!(phase, GenesisPhase::GenesisStaging));
        assert!(!active);

        let (phase, active) = fixture_config_lifecycle_pair(true);
        assert!(matches!(phase, GenesisPhase::Active));
        assert!(active);
    }
}

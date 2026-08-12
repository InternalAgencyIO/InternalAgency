#![deny(unsafe_code)]

extern crate alloc;

use alloc::boxed::Box;
use iat_b3_economy::native_adapter::{derive_pda, NativeEconomyBinding, PdaIdentity};
use iat_b3_economy::production_open_position_executor::{
    execute_runtime_production_open_position_account_infos, ProductionOpenPositionExecutorError,
};
use iat_b3_economy::runtime_adapter::{
    verify_daily_law_open_account_info, verify_runtime_daily_law_open_account_info,
    RuntimeAdapterError,
};
use iat_b3_economy::{
    activate, encode_config_genesis_state, encode_eligibility_state, encode_lane_state,
    initialize_config, initialize_lane_vault, initialize_stake_vault, set_eligibility,
    ActivateInput, CanonicalDailyLawBinding, ConfigGenesisState, EconomyError, GenesisPhase,
    InitializeConfigInput, InitializeLaneVaultInput, InitializeStakeVaultInput, LaneState,
    ReadonlyMintState, ReadonlyTokenState, SetEligibilityInput, COMMUNITY_CUSTODY,
    CONFIG_GENESIS_ACCOUNT_LEN, CORE_TEAM, ECOSYSTEM, ELIGIBILITY_ACCOUNT_LEN, LANE_ACCOUNT_LEN,
    LIQUIDITY, MAINNET_SUPPLY, ON_DEMAND_MAINNET_PID, PROGRAM_ADMIN, TOKEN_DECIMALS, TREASURY,
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
}

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
        0 if data.len() == 1 => initialize_stake_token(program_id, accounts),
        1 if data.len() == 1 => seed_production_shaped_state(program_id, accounts),
        2 if data.len() == 34 && data[1] <= 1 => {
            execute_real_open_position(program_id, accounts, data[1], &data[2..34])
        }
        _ => Err(FixtureEconomyError::InvalidInstruction.into()),
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
fn execute_real_open_position(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    mode: u8,
    production_instruction: &[u8],
) -> ProgramResult {
    if accounts.len() != 17 && accounts.len() != 18 {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let mint = &accounts[3];
    let runtime_law =
        verify_runtime_daily_law_open_account_info(&law_binding(mint.key), &accounts[16])
            .map_err(map_runtime_law_error)?;
    let binding = NativeEconomyBinding::new(program_id.to_bytes(), mint.key.to_bytes())
        .map_err(|_| FixtureEconomyError::InvalidAccount)?;
    execute_runtime_production_open_position_account_infos(
        program_id,
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

fn map_runtime_law_error(error: RuntimeAdapterError) -> ProgramError {
    match error {
        RuntimeAdapterError::Economy(EconomyError::DayUnfinalized) => ProgramError::Custom(0xB30C),
        RuntimeAdapterError::Economy(EconomyError::DailyLockdown) => ProgramError::Custom(0xB30D),
        _ => ProgramError::Custom(0xB30B),
    }
}

fn map_executor_error(error: ProductionOpenPositionExecutorError) -> ProgramError {
    match error {
        ProductionOpenPositionExecutorError::StakeIngress(runtime) => runtime.into_program_error(),
        _ => FixtureEconomyError::ProductionExecutorRejected.into(),
    }
}

fn initialize_stake_token(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let stake_token = next_account_info(account_iter)?;
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
    let stake = derive_pda(
        &binding,
        PdaIdentity::StakeToken {
            config: binding.config(),
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
    require_vacant_target(stake_token, stake.key)?;
    let account_len = ExtensionType::try_calculate_account_len::<TokenAccount>(&[
        ExtensionType::TransferHookAccount,
    ])?;
    let rent = Rent::get()?;
    let create = create_account(
        payer.key,
        stake_token.key,
        rent.minimum_balance(account_len),
        u64::try_from(account_len).map_err(|_| FixtureEconomyError::InvalidAccount)?,
        &TOKEN_2022_PROGRAM_ID,
    );
    invoke_signed(
        &create,
        &[payer.clone(), stake_token.clone(), system.clone()],
        &[&[b"stake-token", binding.config().as_ref(), &[stake.bump]]],
    )?;
    let initialize = initialize_account3(
        &TOKEN_2022_PROGRAM_ID,
        stake_token.key,
        mint.key,
        &Pubkey::new_from_array(vault_authority.key),
    )?;
    invoke(
        &initialize,
        &[stake_token.clone(), mint.clone(), token_program.clone()],
    )?;
    require_exact_stake_token(
        stake_token,
        mint.key,
        &Pubkey::new_from_array(vault_authority.key),
    )
}

fn require_exact_stake_token(
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

#[inline(never)]
fn seed_production_shaped_state(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
) -> ProgramResult {
    if accounts.len() != 9 {
        return Err(FixtureEconomyError::InvalidAccount.into());
    }
    let payer = &accounts[0];
    let mint = &accounts[1];
    let config_account = &accounts[2];
    let eligibility_account = &accounts[3];
    let treasury_account = &accounts[4];
    let ecosystem_account = &accounts[5];
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
    let prepared = prepare_seed_state(&binding, &gate, payer.key, mint)?;

    persist_config(
        program_id,
        payer,
        mint,
        config_account,
        system,
        &binding,
        &prepared.config,
    )?;
    persist_eligibility(
        program_id,
        payer,
        eligibility_account,
        system,
        &binding,
        prepared.eligibility,
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
        liquidity_account,
        system,
        &binding,
        prepared.liquidity,
    )
}

struct PreparedSeedState {
    config: ConfigGenesisState,
    eligibility: iat_b3_economy::EligibilityState,
    treasury: LaneState,
    ecosystem: LaneState,
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
    wallet: &Pubkey,
    mint_account: &AccountInfo<'_>,
) -> Result<Box<PreparedSeedState>, ProgramError> {
    let prepared = prepare_activation_seed(binding, gate, mint_account)?;
    let activation = execute_activation_seed(binding, gate, mint_account, prepared)?;
    finalize_seed_state(binding, gate, wallet, activation)
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
) -> Result<Box<iat_b3_economy::ActivateResult>, ProgramError> {
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
    execute_boxed_activation(gate, input)
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
    binding: &NativeEconomyBinding,
    gate: &iat_b3_economy::ValidatedDailyLawWrite,
    wallet: &Pubkey,
    activation: Box<iat_b3_economy::ActivateResult>,
) -> Result<Box<PreparedSeedState>, ProgramError> {
    let config = binding.config();
    let eligibility_pda = derive_pda(
        binding,
        PdaIdentity::Eligibility {
            config,
            operator: wallet.to_bytes(),
        },
    )
    .map_err(|_| FixtureEconomyError::SeedRejected)?;
    let eligibility = set_eligibility(
        gate,
        SetEligibilityInput {
            config_key: config,
            config: activation.config,
            wallet: wallet.to_bytes(),
            role: 0,
            agency_index: None,
            eligibility_bump: eligibility_pda.bump,
        },
    )
    .map_err(|_| FixtureEconomyError::SeedRejected)?
    .eligibility;
    Ok(Box::new(PreparedSeedState {
        config: ConfigGenesisState {
            phase: GenesisPhase::Active,
            config: activation.config,
        },
        eligibility,
        treasury: activation.treasury,
        ecosystem: activation.ecosystem,
        liquidity: activation.liquidity,
    }))
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

fn persist_eligibility<'info>(
    program_id: &Pubkey,
    payer: &AccountInfo<'info>,
    target: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
    binding: &NativeEconomyBinding,
    state: iat_b3_economy::EligibilityState,
) -> ProgramResult {
    let derived = derive_pda(
        binding,
        PdaIdentity::Eligibility {
            config: binding.config(),
            operator: state.wallet,
        },
    )
    .map_err(|_| FixtureEconomyError::SeedRejected)?;
    require_vacant_target(target, derived.key)?;
    let mut encoded = [0u8; ELIGIBILITY_ACCOUNT_LEN];
    encode_eligibility_state(&state, &mut encoded)
        .map_err(|_| FixtureEconomyError::SeedRejected)?;
    create_and_write(
        program_id,
        payer,
        target,
        system,
        &[
            b"eligibility",
            binding.config().as_ref(),
            state.wallet.as_ref(),
            &[derived.bump],
        ],
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

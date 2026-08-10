#![deny(unsafe_code)]

use iat_b3_economy::{
    stake_ingress::{
        ApproveCheckedIntent, DelegateRestorationIntent, HookedTransferCheckedIntent,
        StakeIngressExecutionPlan,
    },
    stake_ingress_runtime::{
        execute_prepared_stake_ingress, observe_stake_ingress_source,
        observe_stake_ingress_vault, StakeIngressRuntimeAccounts,
    },
    ConfigState, LaneState, OpenPositionPreCpiPlan, TransferCheckedIntent,
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
    extension::ExtensionType,
    instruction::{approve_checked, initialize_account3},
    state::Account as TokenAccount,
    ID as TOKEN_2022_PROGRAM_ID,
};

solana_program_entrypoint::entrypoint!(process_instruction);

pub const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
pub const HOOK_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB4; 32]);
pub const LAW_STATE_ADDRESS: Pubkey = Pubkey::new_from_array([0xA7; 32]);
pub const TOKEN_DECIMALS: u8 = 9;

#[repr(u32)]
enum RehearsalEconomyError {
    InvalidInstruction = 200,
    InvalidAccount = 201,
    InjectedPostCpiFailure = 207,
}

impl From<RehearsalEconomyError> for ProgramError {
    fn from(value: RehearsalEconomyError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    data: &[u8],
) -> ProgramResult {
    if program_id != &ECONOMY_PROGRAM_ID || data.is_empty() {
        return Err(RehearsalEconomyError::InvalidInstruction.into());
    }
    match data[0] {
        0 if data.len() == 1 => initialize_stake_vault(program_id, accounts),
        1 if data.len() == 10 => execute_stake_ingress(program_id, accounts, data),
        _ => Err(RehearsalEconomyError::InvalidInstruction.into()),
    }
}

fn initialize_stake_vault(program_id: &Pubkey, accounts: &[AccountInfo<'_>]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let payer = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let stake_vault = next_account_info(account_iter)?;
    let system = next_account_info(account_iter)?;
    let token_program = next_account_info(account_iter)?;
    if !payer.is_signer
        || mint.owner != &TOKEN_2022_PROGRAM_ID
        || system.key != &system_program::ID
        || token_program.key != &TOKEN_2022_PROGRAM_ID
        || !token_program.executable
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let (config, _) = Pubkey::find_program_address(&[b"config", mint.key.as_ref()], program_id);
    let (expected_vault, bump) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], program_id);
    if stake_vault.key != &expected_vault || stake_vault.owner == &TOKEN_2022_PROGRAM_ID {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let account_len = ExtensionType::try_calculate_account_len::<TokenAccount>(&[
        ExtensionType::TransferHookAccount,
    ])?;
    let rent = Rent::get()?;
    let create = create_account(
        payer.key,
        stake_vault.key,
        rent.minimum_balance(account_len),
        u64::try_from(account_len).map_err(|_| RehearsalEconomyError::InvalidAccount)?,
        &TOKEN_2022_PROGRAM_ID,
    );
    invoke_signed(
        &create,
        &[payer.clone(), stake_vault.clone(), system.clone()],
        &[&[b"stake-token", config.as_ref(), &[bump]]],
    )?;
    let vault_owner = config;
    let initialize = initialize_account3(
        &TOKEN_2022_PROGRAM_ID,
        stake_vault.key,
        mint.key,
        &vault_owner,
    )?;
    invoke(
        &initialize,
        &[stake_vault.clone(), mint.clone(), token_program.clone()],
    )
}

fn execute_stake_ingress(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'_>],
    data: &[u8],
) -> ProgramResult {
    let mode = data[1];
    let amount = u64::from_le_bytes(
        data[2..10]
            .try_into()
            .map_err(|_| RehearsalEconomyError::InvalidInstruction)?,
    );
    let account_iter = &mut accounts.iter();
    let owner = next_account_info(account_iter)?;
    let source = next_account_info(account_iter)?;
    let mint = next_account_info(account_iter)?;
    let stake_vault = next_account_info(account_iter)?;
    let ingress_authority = next_account_info(account_iter)?;
    let prior_delegate = next_account_info(account_iter)?;
    let token_program = next_account_info(account_iter)?;
    let hook_program = next_account_info(account_iter)?;
    let validation = next_account_info(account_iter)?;
    let law_state = next_account_info(account_iter)?;
    let (config, _) = Pubkey::find_program_address(&[b"config", mint.key.as_ref()], program_id);
    let (expected_vault, _) =
        Pubkey::find_program_address(&[b"stake-token", config.as_ref()], program_id);
    let (expected_ingress, _) =
        Pubkey::find_program_address(&[b"stake-ingress", config.as_ref()], program_id);
    if stake_vault.key != &expected_vault || ingress_authority.key != &expected_ingress {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    if hook_program.key != &HOOK_PROGRAM_ID || law_state.key != &LAW_STATE_ADDRESS {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }
    let source_before = observe_stake_ingress_source(source, mint.key, owner.key)
        .map_err(|error| error.into_program_error())?;
    let vault_before = observe_stake_ingress_vault(stake_vault, mint.key, &config)
        .map_err(|error| error.into_program_error())?;
    if source_before.delegate.delegate.is_some()
        && source_before.delegate.delegate != Some(prior_delegate.key.to_bytes())
    {
        return Err(RehearsalEconomyError::InvalidAccount.into());
    }

    let plan = rehearsal_plan(
        owner.key,
        mint.key,
        source.key,
        stake_vault.key,
        ingress_authority.key,
        validation.key,
        &config,
        amount,
        source_before,
        vault_before,
    );
    execute_prepared_stake_ingress(
        program_id,
        &plan,
        StakeIngressRuntimeAccounts {
            owner,
            source,
            mint,
            stake_vault,
            ingress_authority,
            prior_delegate: Some(prior_delegate),
            token_program,
            hook_program,
            hook_validation: validation,
            additional_hook_accounts: core::slice::from_ref(law_state),
        },
        |_, _| {
            if mode == 1 {
                Err(RehearsalEconomyError::InjectedPostCpiFailure.into())
            } else {
                Ok(())
            }
        },
    )
    .map_err(|error| error.into_program_error())?;

    // A fixture-only post-completion failure proves every production-executor
    // CPI still rolls back when a later instruction in the same handler fails.
    if mode == 2 {
        let invalid = approve_checked(
            &TOKEN_2022_PROGRAM_ID,
            source.key,
            mint.key,
            prior_delegate.key,
            owner.key,
            &[],
            source_before.delegate.delegated_amount,
            TOKEN_DECIMALS.saturating_add(1),
        )?;
        invoke(
            &invalid,
            &[
                source.clone(),
                mint.clone(),
                prior_delegate.clone(),
                owner.clone(),
                token_program.clone(),
            ],
        )?;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn rehearsal_plan(
    owner: &Pubkey,
    mint: &Pubkey,
    source: &Pubkey,
    stake_vault: &Pubkey,
    ingress: &Pubkey,
    validation: &Pubkey,
    config: &Pubkey,
    principal: u64,
    source_before: iat_b3_economy::stake_ingress::SourceTokenState,
    stake_before: iat_b3_economy::ReadonlyTokenState,
) -> StakeIngressExecutionPlan {
    let lane = LaneState {
        config: config.to_bytes(),
        token_account: [3; 32],
        beneficiary: [4; 32],
        total: 0,
        genesis_unlocked: 0,
        cliff_week: 0,
        linear_end_week: 1,
        reserved: 0,
        paid: 0,
        principal_claimed: 0,
        lane: 0,
        reward_source: true,
        bump: 1,
        token_bump: 1,
    };
    let config_snapshot = ConfigState {
        admin: owner.to_bytes(),
        mint: mint.to_bytes(),
        token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
        randomness_program: [5; 32],
        stake_token_account: stake_vault.to_bytes(),
        agency_registry_hash: [0; 32],
        genesis_timestamp: 0,
        expected_supply: 1,
        staked_principal: stake_before.amount,
        agency_count: 0,
        rehearsal_mode: true,
        active: true,
        lane_mask: 0,
        stake_vault_initialized: true,
        bump: 1,
        vault_authority_bump: 1,
    };
    let transfer = TransferCheckedIntent {
        token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
        source: source.to_bytes(),
        mint: mint.to_bytes(),
        destination: stake_vault.to_bytes(),
        authority: ingress.to_bytes(),
        amount: principal,
        decimals: TOKEN_DECIMALS,
    };
    let open_position = OpenPositionPreCpiPlan {
        config_key: config.to_bytes(),
        config_snapshot,
        owner: owner.to_bytes(),
        position_id: 1,
        principal,
        accepted_week: 1,
        annual_rate_bps: 500,
        obligation: 0,
        agency_index: 0,
        role: 0,
        position_bump: 1,
        treasury: lane,
        ecosystem: LaneState { lane: 1, ..lane },
        liquidity: LaneState { lane: 3, ..lane },
        treasury_reserved: 0,
        ecosystem_reserved: 0,
        liquidity_reserved: 0,
        transfer: TransferCheckedIntent { authority: owner.to_bytes(), ..transfer },
    };
    let approve_ingress = ApproveCheckedIntent {
        token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
        source: source.to_bytes(),
        mint: mint.to_bytes(),
        delegate: ingress.to_bytes(),
        owner: owner.to_bytes(),
        amount: principal,
        decimals: TOKEN_DECIMALS,
        owner_signature_required: true,
    };
    let restore_delegate = match source_before.delegate.delegate {
        Some(delegate) => DelegateRestorationIntent::ApproveChecked(ApproveCheckedIntent {
            token_program: TOKEN_2022_PROGRAM_ID.to_bytes(),
            source: source.to_bytes(),
            mint: mint.to_bytes(),
            delegate,
            owner: owner.to_bytes(),
            amount: source_before.delegate.delegated_amount,
            decimals: TOKEN_DECIMALS,
            owner_signature_required: true,
        }),
        None => DelegateRestorationIntent::NoneRequired,
    };
    StakeIngressExecutionPlan {
        open_position,
        source_before,
        stake_before,
        original_delegate: source_before.delegate,
        approve_ingress,
        transfer: HookedTransferCheckedIntent {
            transfer,
            hook_validation_address: validation.to_bytes(),
            law_state_address: LAW_STATE_ADDRESS.to_bytes(),
            token_cpi_uses_ingress_invoke_signed: true,
            hook_execute_authority_is_signer: false,
            add_extra_accounts_for_execute_cpi_required: true,
        },
        restore_delegate,
    }
}

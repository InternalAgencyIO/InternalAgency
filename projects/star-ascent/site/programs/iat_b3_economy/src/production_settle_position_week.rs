//! Strict retained-V2 standard `settle_position_week` composition and CAS seam.
//!
//! The public surface stops at the exact pre-token-CPI plan. An internal seam
//! can reload the four Token-2022 accounts after a future ordered hook-aware
//! executor, prove exact source/destination deltas, apply V2's deliberately
//! post-CPI Position fields, and seal a four-account existing-state CAS batch.
//! This module exposes no token executor, CAS executor, dispatcher, entrypoint,
//! or complete-handler claim.

extern crate alloc;

use alloc::boxed::Box;

use crate::native_adapter::{
    derive_pda, prepare_existing_state_write, seal_atomic_write_batch, AtomicWriteBatch,
    AuthenticatedStateAccount, NativeAdapterError, NativeEconomyBinding, PdaIdentity,
    StrictStateValue,
};
use crate::production_instruction::{
    decode_production_instruction, ProductionInstruction, ProductionInstructionError,
};
use crate::runtime_adapter::{
    authenticate_production_active_config_account_info,
    authenticate_runtime_production_active_config, authenticate_signer_account_info,
    authenticate_state_account_info, RuntimeAdapterError, RuntimeProductionActiveConfig,
    RuntimeValidatedDailyLawWrite,
};
use crate::stake_ingress::SourceTokenState;
use crate::stake_ingress_runtime::{observe_stake_ingress_source, observe_stake_ingress_vault};
use crate::{
    decode_position_state, decode_round_state, prepare_settle_position_week, CodecError,
    EconomyError, LaneState, PositionState, PrepareSettlePositionWeekInput, ReadonlyTokenState,
    RoundState, SettlePositionWeekPreCpiPlan, ValidatedDailyLawWrite, ECOSYSTEM, LIQUIDITY,
    TREASURY,
};
use solana_account_info::AccountInfo;
use solana_pubkey::Pubkey;
use spl_token_2022_interface::ID as TOKEN_2022_PROGRAM_ID;

pub const PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT: usize = 13;
pub const PRODUCTION_SETTLE_POSITION_WITH_ROUND_ACCOUNT_COUNT: usize = 14;
pub const PRODUCTION_SETTLE_POSITION_WRITE_COUNT: usize = 4;
pub const PRODUCTION_SETTLE_POSITION_STATUS: &str =
    "STANDARD_PRE_CPI_COMPOSITION_INTERNAL_POST_RELOAD_CAS_NO_EXECUTOR_MAINNET_HOLD";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductionSettlePositionTruth {
    pub feature_gated: bool,
    pub exact_instruction_codec_required: bool,
    pub runtime_daily_law_capability_supported: bool,
    pub production_active_readonly_config_required: bool,
    pub exact_standard_account_order_and_flags_required: bool,
    pub standard_round_omission_required: bool,
    pub ccc_round_path_enabled: bool,
    pub exact_position_and_three_lane_pdas_authenticated: bool,
    pub exact_lane_token_and_owner_destination_bindings_authenticated: bool,
    pub retained_v2_pre_token_cpi_kernel_used: bool,
    pub post_transfer_runtime_token_reloads_required: bool,
    pub exact_four_state_cas_batch_sealable_after_reloads: bool,
    pub ordered_hooked_token_cpi_executed: bool,
    pub cas_executor_exposed: bool,
    pub production_dispatcher_exposed: bool,
    pub production_entrypoint_exposed: bool,
    pub handler_complete: bool,
    pub mainnet_hold: bool,
}

pub const PRODUCTION_SETTLE_POSITION_TRUTH: ProductionSettlePositionTruth =
    ProductionSettlePositionTruth {
        feature_gated: true,
        exact_instruction_codec_required: true,
        runtime_daily_law_capability_supported: true,
        production_active_readonly_config_required: true,
        exact_standard_account_order_and_flags_required: true,
        standard_round_omission_required: true,
        ccc_round_path_enabled: false,
        exact_position_and_three_lane_pdas_authenticated: true,
        exact_lane_token_and_owner_destination_bindings_authenticated: true,
        retained_v2_pre_token_cpi_kernel_used: true,
        post_transfer_runtime_token_reloads_required: true,
        exact_four_state_cas_batch_sealable_after_reloads: true,
        ordered_hooked_token_cpi_executed: false,
        cas_executor_exposed: false,
        production_dispatcher_exposed: false,
        production_entrypoint_exposed: false,
        handler_complete: false,
        mainnet_hold: true,
    };

#[derive(Debug, Eq, PartialEq)]
pub enum ProductionSettlePositionError {
    Instruction(ProductionInstructionError),
    WrongInstruction,
    AccountCountMismatch,
    AccountBindingMismatch,
    AccountMetaMismatch,
    AccountBorrowFailed,
    PositionCodec(CodecError),
    RoundCodec(CodecError),
    StateTypeMismatch,
    SourceTokenRejected,
    DestinationTokenRejected,
    TokenReloadIdentityMismatch,
    TokenReloadAmountMismatch,
    TokenBalanceArithmetic,
    Runtime(RuntimeAdapterError),
    Native(NativeAdapterError),
    Economy(EconomyError),
}

impl From<ProductionInstructionError> for ProductionSettlePositionError {
    fn from(value: ProductionInstructionError) -> Self {
        Self::Instruction(value)
    }
}

impl From<RuntimeAdapterError> for ProductionSettlePositionError {
    fn from(value: RuntimeAdapterError) -> Self {
        Self::Runtime(value)
    }
}

impl From<NativeAdapterError> for ProductionSettlePositionError {
    fn from(value: NativeAdapterError) -> Self {
        Self::Native(value)
    }
}

impl From<EconomyError> for ProductionSettlePositionError {
    fn from(value: EconomyError) -> Self {
        Self::Economy(value)
    }
}

#[derive(Debug, Eq, PartialEq)]
pub struct PreparedProductionSettlePositionWeek {
    caller: [u8; 32],
    config: [u8; 32],
    position: [u8; 32],
    vault_authority: [u8; 32],
    plan: Box<SettlePositionWeekPreCpiPlan>,
    authenticated: Box<[AuthenticatedStateAccount; PRODUCTION_SETTLE_POSITION_WRITE_COUNT]>,
    source_before: [ReadonlyTokenState; 3],
    destination_before: SourceTokenState,
}

impl PreparedProductionSettlePositionWeek {
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

    pub const fn plan(&self) -> &SettlePositionWeekPreCpiPlan {
        &self.plan
    }

    /// Internal post-transfer boundary only. The caller must be the future
    /// ordered hook-aware token executor holding the same live AccountInfos.
    /// This function performs reload validation and seals CAS intents, but it
    /// never invokes Token-2022 or executes the returned state batch.
    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn seal_post_transfer_cas_account_infos(
        self,
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
        source_accounts: [&AccountInfo<'_>; 3],
        destination_account: &AccountInfo<'_>,
    ) -> Result<
        AtomicWriteBatch<PRODUCTION_SETTLE_POSITION_WRITE_COUNT>,
        ProductionSettlePositionError,
    > {
        let vault_authority = Pubkey::new_from_array(self.vault_authority);
        let mint = Pubkey::new_from_array(self.plan.config_snapshot.mint);
        let after = [
            observe_stake_ingress_vault(source_accounts[0], &mint, &vault_authority)
                .map_err(|_| ProductionSettlePositionError::SourceTokenRejected)?,
            observe_stake_ingress_vault(source_accounts[1], &mint, &vault_authority)
                .map_err(|_| ProductionSettlePositionError::SourceTokenRejected)?,
            observe_stake_ingress_vault(source_accounts[2], &mint, &vault_authority)
                .map_err(|_| ProductionSettlePositionError::SourceTokenRejected)?,
        ];
        let destination_after = observe_stake_ingress_source(
            destination_account,
            &mint,
            &Pubkey::new_from_array(self.plan.position.owner),
        )
        .map_err(|_| ProductionSettlePositionError::DestinationTokenRejected)?;
        self.require_exact_reload_deltas(after, destination_after)?;

        // Retained V2 performs these two Position operations only after every
        // nonzero transfer CPI succeeds. Keeping them here preserves that
        // precedence for the future runtime executor.
        let mut position = self.plan.position;
        position.paid = position.paid.checked_add(self.plan.amount).ok_or(
            ProductionSettlePositionError::Economy(EconomyError::ArithmeticOverflow),
        )?;
        position.settled_mask |= self.plan.settlement_bit;

        let authenticated = *self.authenticated;
        let intents = [
            prepare_existing_state_write(
                gate,
                binding,
                &authenticated[0],
                StrictStateValue::Position(position),
            )?,
            prepare_existing_state_write(
                gate,
                binding,
                &authenticated[1],
                StrictStateValue::Lane(self.plan.treasury),
            )?,
            prepare_existing_state_write(
                gate,
                binding,
                &authenticated[2],
                StrictStateValue::Lane(self.plan.ecosystem),
            )?,
            prepare_existing_state_write(
                gate,
                binding,
                &authenticated[3],
                StrictStateValue::Lane(self.plan.liquidity),
            )?,
        ];
        seal_atomic_write_batch(gate, binding, intents).map_err(Into::into)
    }

    #[cfg_attr(not(test), allow(dead_code))]
    fn require_exact_reload_deltas(
        &self,
        after: [ReadonlyTokenState; 3],
        destination_after: SourceTokenState,
    ) -> Result<(), ProductionSettlePositionError> {
        let mut destination_credit = 0u64;
        for (index, after_state) in after.iter().enumerate() {
            if after_state.key != self.source_before[index].key
                || after_state.mint != self.source_before[index].mint
                || after_state.owner != self.source_before[index].owner
                || after_state.key != self.plan.transfers[index].source
            {
                return Err(ProductionSettlePositionError::TokenReloadIdentityMismatch);
            }
            let expected = self.source_before[index]
                .amount
                .checked_sub(self.plan.transfers[index].amount)
                .ok_or(ProductionSettlePositionError::TokenBalanceArithmetic)?;
            if after_state.amount != expected {
                return Err(ProductionSettlePositionError::TokenReloadAmountMismatch);
            }
            destination_credit = destination_credit
                .checked_add(self.plan.transfers[index].amount)
                .ok_or(ProductionSettlePositionError::TokenBalanceArithmetic)?;
        }

        if destination_after.token.key != self.destination_before.token.key
            || destination_after.token.mint != self.destination_before.token.mint
            || destination_after.token.owner != self.destination_before.token.owner
            || destination_after.delegate != self.destination_before.delegate
            || destination_after.cpi_guard_locked != self.destination_before.cpi_guard_locked
            || destination_after.token.key != self.plan.transfers[0].destination
        {
            return Err(ProductionSettlePositionError::TokenReloadIdentityMismatch);
        }
        let expected_destination = self
            .destination_before
            .token
            .amount
            .checked_add(destination_credit)
            .ok_or(ProductionSettlePositionError::TokenBalanceArithmetic)?;
        if destination_after.token.amount != expected_destination {
            return Err(ProductionSettlePositionError::TokenReloadAmountMismatch);
        }
        Ok(())
    }
}

#[derive(Clone, Copy)]
struct AccountLayout {
    round: Option<usize>,
    mint: usize,
    vault_authority: usize,
    treasury: usize,
    treasury_tokens: usize,
    ecosystem: usize,
    ecosystem_tokens: usize,
    liquidity: usize,
    liquidity_tokens: usize,
    destination_tokens: usize,
    token_program: usize,
}

impl AccountLayout {
    fn for_count(count: usize) -> Result<Self, ProductionSettlePositionError> {
        let round = match count {
            PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT => None,
            PRODUCTION_SETTLE_POSITION_WITH_ROUND_ACCOUNT_COUNT => Some(3),
            _ => return Err(ProductionSettlePositionError::AccountCountMismatch),
        };
        let shift = usize::from(round.is_some());
        Ok(Self {
            round,
            mint: 3 + shift,
            vault_authority: 4 + shift,
            treasury: 5 + shift,
            treasury_tokens: 6 + shift,
            ecosystem: 7 + shift,
            ecosystem_tokens: 8 + shift,
            liquidity: 9 + shift,
            liquidity_tokens: 10 + shift,
            destination_tokens: 11 + shift,
            token_program: 12 + shift,
        })
    }
}

#[inline(never)]
pub fn prepare_runtime_production_settle_position_week_account_infos(
    runtime_law: &RuntimeValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionSettlePositionWeek, ProductionSettlePositionError> {
    let week = require_settle_position_instruction(instruction_data)?;
    let layout = AccountLayout::for_count(accounts.len())?;
    let active_config =
        authenticate_runtime_production_active_config(runtime_law, binding, &accounts[1])?;
    prepare_with_active_config(
        runtime_law.gate(),
        &active_config,
        binding,
        accounts,
        layout,
        week,
    )
}

/// Host/rehearsal seam. Runtime composition must use
/// [`prepare_runtime_production_settle_position_week_account_infos`] so the
/// Law account and Clock are runtime-authenticated facts.
#[inline(never)]
pub fn prepare_production_settle_position_week_account_infos(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    instruction_data: &[u8],
    accounts: &[AccountInfo<'_>],
) -> Result<PreparedProductionSettlePositionWeek, ProductionSettlePositionError> {
    let week = require_settle_position_instruction(instruction_data)?;
    let layout = AccountLayout::for_count(accounts.len())?;
    let active_config =
        authenticate_production_active_config_account_info(gate, binding, &accounts[1])?;
    prepare_with_active_config(gate, &active_config, binding, accounts, layout, week)
}

fn require_settle_position_instruction(
    instruction_data: &[u8],
) -> Result<u64, ProductionSettlePositionError> {
    match decode_production_instruction(instruction_data)? {
        ProductionInstruction::SettlePositionWeek { week } => Ok(week),
        _ => Err(ProductionSettlePositionError::WrongInstruction),
    }
}

fn prepare_with_active_config(
    gate: &ValidatedDailyLawWrite,
    active_config: &RuntimeProductionActiveConfig,
    binding: &NativeEconomyBinding,
    accounts: &[AccountInfo<'_>],
    layout: AccountLayout,
    week: u64,
) -> Result<PreparedProductionSettlePositionWeek, ProductionSettlePositionError> {
    let caller = authenticate_caller(gate, binding, &accounts[0])?;
    let config = active_config.state().config;
    if config.mint != binding.mint() || config.token_program != TOKEN_2022_PROGRAM_ID.to_bytes() {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }

    let (position_authenticated, position) =
        authenticate_position(gate, binding, &accounts[2], active_config.key())?;
    let round = layout
        .round
        .map(|index| parse_optional_round(binding, &accounts[index]))
        .transpose()?;
    require_mint_meta(binding, &accounts[layout.mint])?;
    require_token_program(&accounts[layout.token_program])?;

    let vault_authority = derive_pda(
        binding,
        PdaIdentity::VaultAuthority {
            config: active_config.key(),
        },
    )?;
    if vault_authority.bump != config.vault_authority_bump {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }
    require_vault_authority_meta(&accounts[layout.vault_authority], vault_authority.key)?;

    let (treasury_authenticated, treasury) = authenticate_lane(
        gate,
        binding,
        &accounts[layout.treasury],
        active_config.key(),
        TREASURY,
    )?;
    let (ecosystem_authenticated, ecosystem) = authenticate_lane(
        gate,
        binding,
        &accounts[layout.ecosystem],
        active_config.key(),
        ECOSYSTEM,
    )?;
    let (liquidity_authenticated, liquidity) = authenticate_lane(
        gate,
        binding,
        &accounts[layout.liquidity],
        active_config.key(),
        LIQUIDITY,
    )?;

    let mint = Pubkey::new_from_array(binding.mint());
    let vault = Pubkey::new_from_array(vault_authority.key);
    let source_before = [
        observe_lane_token(
            &accounts[layout.treasury_tokens],
            treasury.token_account,
            &mint,
            &vault,
        )?,
        observe_lane_token(
            &accounts[layout.ecosystem_tokens],
            ecosystem.token_account,
            &mint,
            &vault,
        )?,
        observe_lane_token(
            &accounts[layout.liquidity_tokens],
            liquidity.token_account,
            &mint,
            &vault,
        )?,
    ];
    let destination_before = observe_stake_ingress_source(
        &accounts[layout.destination_tokens],
        &mint,
        &Pubkey::new_from_array(position.owner),
    )
    .map_err(|_| ProductionSettlePositionError::DestinationTokenRejected)?;

    let plan = prepare_settle_position_week(
        gate,
        PrepareSettlePositionWeekInput {
            config_key: active_config.key(),
            config,
            position,
            round,
            mint: binding.mint(),
            vault_authority: vault_authority.key,
            destination_tokens: destination_before.token,
            treasury,
            ecosystem,
            liquidity,
            week,
        },
    )?;

    Ok(PreparedProductionSettlePositionWeek {
        caller,
        config: active_config.key(),
        position: accounts[2].key.to_bytes(),
        vault_authority: vault_authority.key,
        plan: Box::new(plan),
        authenticated: Box::new([
            position_authenticated,
            treasury_authenticated,
            ecosystem_authenticated,
            liquidity_authenticated,
        ]),
        source_before,
        destination_before,
    })
}

fn authenticate_caller(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
) -> Result<[u8; 32], ProductionSettlePositionError> {
    if account.is_writable {
        return Err(ProductionSettlePositionError::AccountMetaMismatch);
    }
    let key = account.key.to_bytes();
    Ok(authenticate_signer_account_info(gate, binding, account, key, false)?.key())
}

fn authenticate_position(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
) -> Result<(AuthenticatedStateAccount, PositionState), ProductionSettlePositionError> {
    if account.owner.to_bytes() != binding.program_id() {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }
    if account.is_signer || !account.is_writable || account.executable {
        return Err(ProductionSettlePositionError::AccountMetaMismatch);
    }
    let data = account
        .try_borrow_data()
        .map_err(|_| ProductionSettlePositionError::AccountBorrowFailed)?;
    let state =
        decode_position_state(&data).map_err(ProductionSettlePositionError::PositionCodec)?;
    drop(data);
    let identity = PdaIdentity::Position {
        config,
        operator: state.owner,
        position_id: state.position_id,
    };
    let authenticated = authenticate_state_account_info(gate, binding, account, identity)?;
    match authenticated.state() {
        StrictStateValue::Position(state) => Ok((authenticated, state)),
        _ => Err(ProductionSettlePositionError::StateTypeMismatch),
    }
}

fn authenticate_lane(
    gate: &ValidatedDailyLawWrite,
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
    config: [u8; 32],
    lane: u8,
) -> Result<(AuthenticatedStateAccount, LaneState), ProductionSettlePositionError> {
    let authenticated = authenticate_state_account_info(
        gate,
        binding,
        account,
        PdaIdentity::LaneState { config, lane },
    )?;
    match authenticated.state() {
        StrictStateValue::Lane(state) => Ok((authenticated, state)),
        _ => Err(ProductionSettlePositionError::StateTypeMismatch),
    }
}

fn parse_optional_round(
    binding: &NativeEconomyBinding,
    account: &AccountInfo<'_>,
) -> Result<RoundState, ProductionSettlePositionError> {
    if account.owner.to_bytes() != binding.program_id() {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionSettlePositionError::AccountMetaMismatch);
    }
    let data = account
        .try_borrow_data()
        .map_err(|_| ProductionSettlePositionError::AccountBorrowFailed)?;
    decode_round_state(&data).map_err(ProductionSettlePositionError::RoundCodec)
}

fn observe_lane_token(
    account: &AccountInfo<'_>,
    expected_key: [u8; 32],
    mint: &Pubkey,
    vault_authority: &Pubkey,
) -> Result<ReadonlyTokenState, ProductionSettlePositionError> {
    if account.key.to_bytes() != expected_key {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }
    observe_stake_ingress_vault(account, mint, vault_authority)
        .map_err(|_| ProductionSettlePositionError::SourceTokenRejected)
}

fn require_mint_meta(
    binding: &NativeEconomyBinding,
    mint: &AccountInfo<'_>,
) -> Result<(), ProductionSettlePositionError> {
    if mint.key.to_bytes() != binding.mint() || mint.owner != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }
    if mint.is_signer || mint.is_writable || mint.executable {
        return Err(ProductionSettlePositionError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_vault_authority_meta(
    account: &AccountInfo<'_>,
    expected_key: [u8; 32],
) -> Result<(), ProductionSettlePositionError> {
    if account.key.to_bytes() != expected_key {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }
    if account.is_signer || account.is_writable || account.executable {
        return Err(ProductionSettlePositionError::AccountMetaMismatch);
    }
    Ok(())
}

fn require_token_program(program: &AccountInfo<'_>) -> Result<(), ProductionSettlePositionError> {
    if program.key != &TOKEN_2022_PROGRAM_ID {
        return Err(ProductionSettlePositionError::AccountBindingMismatch);
    }
    if program.is_signer || program.is_writable || !program.executable {
        return Err(ProductionSettlePositionError::AccountMetaMismatch);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::production_instruction::{
        encode_production_instruction, PRODUCTION_INSTRUCTION_LEN,
    };
    use crate::runtime_write_adapter::{
        execute_production_active_existing_write_batch_account_infos, RuntimeWriteAdapterError,
    };
    use crate::{
        decode_lane_state, encode_config_genesis_state, encode_lane_state, encode_position_state,
        encode_round_state, verify_daily_law_open, CanonicalDailyLawBinding, ConfigGenesisState,
        ConfigState, GenesisPhase, ReadonlyDailyLawAccount, CONFIG_GENESIS_ACCOUNT_LEN,
        LANE_ACCOUNT_LEN, LAW_STATE_LEN, LAW_STATE_MAGIC, LAW_STATE_VERSION, MAINNET_SUPPLY,
        POSITION_ACCOUNT_LEN, ROUND_ACCOUNT_LEN, ROUND_PENDING, SECONDS_PER_WEEK,
        STANDARD_RATE_BPS, USER_TERM_WEEKS,
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
    const SETTLEMENT_WEEK: u64 = 4;
    const INITIAL_SOURCE_AMOUNT: u64 = 10_000;
    const INITIAL_DESTINATION_AMOUNT: u64 = 100;

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

    fn token_data(owner: [u8; 32], amount: u64) -> Vec<u8> {
        let extensions = [ExtensionType::TransferHookAccount];
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
        state.init_extension::<TransferHookAccount>(false).unwrap();
        state.pack_base();
        data
    }

    fn set_token_amount(data: &mut [u8], amount: u64) {
        let mut state = StateWithExtensionsMut::<TokenAccount>::unpack(data).unwrap();
        state.base.amount = amount;
        state.pack_base();
    }

    fn lane(
        binding: &NativeEconomyBinding,
        lane: u8,
        reserved: u64,
    ) -> ([u8; 32], [u8; 32], Vec<u8>) {
        let identity = PdaIdentity::LaneState {
            config: binding.config(),
            lane,
        };
        let derived = derive_pda(binding, identity).unwrap();
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
            beneficiary: [0x90 | lane; 32],
            total: 1_000_000,
            genesis_unlocked: 1_000_000,
            cliff_week: 0,
            linear_end_week: 104,
            reserved,
            paid: 0,
            principal_claimed: 0,
            lane,
            reward_source: true,
            bump: derived.bump,
            token_bump: token.bump,
        };
        let mut data = [0u8; LANE_ACCOUNT_LEN];
        encode_lane_state(&state, &mut data).unwrap();
        (derived.key, token.key, data.to_vec())
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
        round: TestAccount,
        mint: TestAccount,
        vault_authority: TestAccount,
        treasury: TestAccount,
        treasury_tokens: TestAccount,
        ecosystem: TestAccount,
        ecosystem_tokens: TestAccount,
        liquidity: TestAccount,
        liquidity_tokens: TestAccount,
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
                    genesis_timestamp: CLOCK_TIMESTAMP - 4 * SECONDS_PER_WEEK,
                    expected_supply: MAINNET_SUPPLY,
                    staked_principal: 5_200_000,
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
                position_id: 44,
            };
            let position_key = derive_pda(binding, position_identity).unwrap();
            let position_state = PositionState {
                config: binding.config(),
                owner: POSITION_OWNER,
                position_id: 44,
                principal: 5_200_000,
                accepted_week: 3,
                first_accrual_week: 4,
                term_weeks: USER_TERM_WEEKS,
                annual_rate_bps: STANDARD_RATE_BPS,
                treasury_reserved: 6_000,
                ecosystem_reserved: 3_000,
                liquidity_reserved: 2_000,
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

            let round_identity = PdaIdentity::Round {
                config: binding.config(),
                week: SETTLEMENT_WEEK,
            };
            let round_key = derive_pda(binding, round_identity).unwrap();
            let round_state = RoundState {
                config: binding.config(),
                randomness_account: [0x43; 32],
                week: SETTLEMENT_WEEK,
                commit_slot: 10,
                commit_timestamp: CLOCK_TIMESTAMP - 60,
                randomness: [0; 32],
                agency_registry_hash_snapshot: [0x66; 32],
                decision_context: [0x77; 32],
                agency_count_snapshot: 0,
                selected_agency_index: u32::MAX,
                derivation_counter: u32::MAX,
                status: ROUND_PENDING,
                bump: round_key.bump,
            };
            let mut round_data = [0u8; ROUND_ACCOUNT_LEN];
            encode_round_state(&round_state, &mut round_data).unwrap();

            let (treasury_key, treasury_token, treasury_data) = lane(binding, TREASURY, 6_000);
            let (ecosystem_key, ecosystem_token, ecosystem_data) = lane(binding, ECOSYSTEM, 3_000);
            let (liquidity_key, liquidity_token, liquidity_data) = lane(binding, LIQUIDITY, 2_000);

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
                    writable: false,
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
                round: TestAccount {
                    key: round_key.key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: round_data.to_vec(),
                    signer: false,
                    writable: false,
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
                treasury: TestAccount {
                    key: treasury_key.into(),
                    owner: ECONOMY_PROGRAM.into(),
                    lamports: 1,
                    data: treasury_data,
                    signer: false,
                    writable: true,
                    executable: false,
                },
                treasury_tokens: TestAccount {
                    key: treasury_token.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, INITIAL_SOURCE_AMOUNT),
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
                ecosystem_tokens: TestAccount {
                    key: ecosystem_token.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, INITIAL_SOURCE_AMOUNT),
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
                liquidity_tokens: TestAccount {
                    key: liquidity_token.into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(vault_authority.key, INITIAL_SOURCE_AMOUNT),
                    signer: false,
                    writable: true,
                    executable: false,
                },
                destination_tokens: TestAccount {
                    key: [0x72; 32].into(),
                    owner: TOKEN_2022_PROGRAM_ID,
                    lamports: 1,
                    data: token_data(POSITION_OWNER, INITIAL_DESTINATION_AMOUNT),
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

        fn with_standard_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &mut [AccountInfo<'_>; PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT],
            ) -> R,
        ) -> R {
            let mut infos = [
                self.caller.info(),
                self.config.info(),
                self.position.info(),
                self.mint.info(),
                self.vault_authority.info(),
                self.treasury.info(),
                self.treasury_tokens.info(),
                self.ecosystem.info(),
                self.ecosystem_tokens.info(),
                self.liquidity.info(),
                self.liquidity_tokens.info(),
                self.destination_tokens.info(),
                self.token_program.info(),
            ];
            operation(&mut infos)
        }

        fn with_round_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &mut [AccountInfo<'_>; PRODUCTION_SETTLE_POSITION_WITH_ROUND_ACCOUNT_COUNT],
            ) -> R,
        ) -> R {
            let mut infos = [
                self.caller.info(),
                self.config.info(),
                self.position.info(),
                self.round.info(),
                self.mint.info(),
                self.vault_authority.info(),
                self.treasury.info(),
                self.treasury_tokens.info(),
                self.ecosystem.info(),
                self.ecosystem_tokens.info(),
                self.liquidity.info(),
                self.liquidity_tokens.info(),
                self.destination_tokens.info(),
                self.token_program.info(),
            ];
            operation(&mut infos)
        }

        fn with_reload_infos<R>(
            &mut self,
            operation: impl FnOnce([&AccountInfo<'_>; 3], &AccountInfo<'_>) -> R,
        ) -> R {
            let treasury = self.treasury_tokens.info();
            let ecosystem = self.ecosystem_tokens.info();
            let liquidity = self.liquidity_tokens.info();
            let destination = self.destination_tokens.info();
            operation([&treasury, &ecosystem, &liquidity], &destination)
        }

        fn with_config_and_write_infos<R>(
            &mut self,
            operation: impl FnOnce(
                &AccountInfo<'_>,
                &mut [AccountInfo<'_>; PRODUCTION_SETTLE_POSITION_WRITE_COUNT],
            ) -> R,
        ) -> R {
            let config = self.config.info();
            let mut writes = [
                self.position.info(),
                self.treasury.info(),
                self.ecosystem.info(),
                self.liquidity.info(),
            ];
            operation(&config, &mut writes)
        }

        fn state_snapshot(&self) -> [Vec<u8>; PRODUCTION_SETTLE_POSITION_WRITE_COUNT] {
            [
                self.position.data.clone(),
                self.treasury.data.clone(),
                self.ecosystem.data.clone(),
                self.liquidity.data.clone(),
            ]
        }

        fn all_snapshot(&self) -> Vec<Vec<u8>> {
            vec![
                self.config.data.clone(),
                self.position.data.clone(),
                self.treasury.data.clone(),
                self.treasury_tokens.data.clone(),
                self.ecosystem.data.clone(),
                self.ecosystem_tokens.data.clone(),
                self.liquidity.data.clone(),
                self.liquidity_tokens.data.clone(),
                self.destination_tokens.data.clone(),
            ]
        }

        fn apply_exact_token_deltas(&mut self, amounts: [u64; 3]) {
            set_token_amount(
                &mut self.treasury_tokens.data,
                INITIAL_SOURCE_AMOUNT - amounts[0],
            );
            set_token_amount(
                &mut self.ecosystem_tokens.data,
                INITIAL_SOURCE_AMOUNT - amounts[1],
            );
            set_token_amount(
                &mut self.liquidity_tokens.data,
                INITIAL_SOURCE_AMOUNT - amounts[2],
            );
            set_token_amount(
                &mut self.destination_tokens.data,
                INITIAL_DESTINATION_AMOUNT + amounts.into_iter().sum::<u64>(),
            );
        }
    }

    fn prepare(
        fixture: &mut Fixture,
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
    ) -> PreparedProductionSettlePositionWeek {
        let instruction = encoded(ProductionInstruction::SettlePositionWeek {
            week: SETTLEMENT_WEEK,
        });
        fixture.with_standard_infos(|accounts| {
            prepare_production_settle_position_week_account_infos(
                gate,
                binding,
                &instruction,
                accounts,
            )
            .unwrap()
        })
    }

    fn seal_after_exact_token_deltas(
        prepared: PreparedProductionSettlePositionWeek,
        fixture: &mut Fixture,
        gate: &ValidatedDailyLawWrite,
        binding: &NativeEconomyBinding,
    ) -> AtomicWriteBatch<PRODUCTION_SETTLE_POSITION_WRITE_COUNT> {
        let amounts = prepared.plan().transfers.map(|transfer| transfer.amount);
        fixture.apply_exact_token_deltas(amounts);
        fixture.with_reload_infos(|sources, destination| {
            prepared
                .seal_post_transfer_cas_account_infos(gate, binding, sources, destination)
                .unwrap()
        })
    }

    #[test]
    fn exact_standard_accounts_prepare_the_v2_plan_without_writes() {
        let binding = binding();
        let gate = open_gate();
        let mut fixture = Fixture::new(&binding);
        let before = fixture.all_snapshot();
        let prepared = prepare(&mut fixture, &gate, &binding);
        assert_eq!(prepared.caller(), CALLER);
        assert_eq!(prepared.config(), binding.config());
        assert_eq!(prepared.position(), fixture.position.key.to_bytes());
        assert_eq!(
            prepared.vault_authority(),
            fixture.vault_authority.key.to_bytes()
        );
        assert_eq!(prepared.plan().amount, 10_000);
        assert_eq!(
            prepared.plan().transfers.map(|transfer| transfer.amount),
            [6_000, 3_000, 1_000]
        );
        assert_eq!(prepared.plan().position.treasury_reserved, 0);
        assert_eq!(prepared.plan().position.ecosystem_reserved, 0);
        assert_eq!(prepared.plan().position.liquidity_reserved, 1_000);
        assert_eq!(fixture.all_snapshot(), before);
    }

    #[test]
    fn every_standard_slot_and_meta_bit_is_exact_and_fail_closed() {
        let binding = binding();
        let gate = open_gate();
        let instruction = encoded(ProductionInstruction::SettlePositionWeek {
            week: SETTLEMENT_WEEK,
        });

        for index in 0..(PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT - 1) {
            let mut fixture = Fixture::new(&binding);
            let before = fixture.all_snapshot();
            fixture.with_standard_infos(|accounts| {
                accounts.swap(index, index + 1);
                assert!(prepare_production_settle_position_week_account_infos(
                    &gate,
                    &binding,
                    &instruction,
                    accounts,
                )
                .is_err());
            });
            assert_eq!(fixture.all_snapshot(), before, "slot swap {index}");
        }

        for index in 0..PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT {
            for flag in 0..3 {
                let mut fixture = Fixture::new(&binding);
                let before = fixture.all_snapshot();
                fixture.with_standard_infos(|accounts| {
                    match flag {
                        0 => accounts[index].is_signer = !accounts[index].is_signer,
                        1 => accounts[index].is_writable = !accounts[index].is_writable,
                        2 => accounts[index].executable = !accounts[index].executable,
                        _ => unreachable!(),
                    }
                    assert!(prepare_production_settle_position_week_account_infos(
                        &gate,
                        &binding,
                        &instruction,
                        accounts,
                    )
                    .is_err());
                });
                assert_eq!(
                    fixture.all_snapshot(),
                    before,
                    "meta flip account {index}, flag {flag}"
                );
            }
        }
    }

    #[test]
    fn wrong_instruction_count_optional_round_and_token_binding_fail_atomically() {
        let binding = binding();
        let gate = open_gate();
        let settle = encoded(ProductionInstruction::SettlePositionWeek {
            week: SETTLEMENT_WEEK,
        });

        let mut wrong_instruction = Fixture::new(&binding);
        let before = wrong_instruction.all_snapshot();
        let close = encoded(ProductionInstruction::ClosePosition);
        wrong_instruction.with_standard_infos(|accounts| {
            assert_eq!(
                prepare_production_settle_position_week_account_infos(
                    &gate, &binding, &close, accounts,
                ),
                Err(ProductionSettlePositionError::WrongInstruction)
            );
        });
        assert_eq!(wrong_instruction.all_snapshot(), before);

        let mut wrong_count = Fixture::new(&binding);
        let before = wrong_count.all_snapshot();
        wrong_count.with_standard_infos(|accounts| {
            assert_eq!(
                prepare_production_settle_position_week_account_infos(
                    &gate,
                    &binding,
                    &settle,
                    &accounts[..PRODUCTION_SETTLE_POSITION_STANDARD_ACCOUNT_COUNT - 1],
                ),
                Err(ProductionSettlePositionError::AccountCountMismatch)
            );
        });
        assert_eq!(wrong_count.all_snapshot(), before);

        let mut optional_round = Fixture::new(&binding);
        let before = optional_round.all_snapshot();
        optional_round.with_round_infos(|accounts| {
            assert_eq!(
                prepare_production_settle_position_week_account_infos(
                    &gate, &binding, &settle, accounts,
                ),
                Err(ProductionSettlePositionError::Economy(
                    EconomyError::StandardRoundMustBeOmitted
                ))
            );
        });
        assert_eq!(optional_round.all_snapshot(), before);

        let mut wrong_token = Fixture::new(&binding);
        wrong_token.treasury_tokens.key = [0xF1; 32].into();
        let before = wrong_token.all_snapshot();
        wrong_token.with_standard_infos(|accounts| {
            assert_eq!(
                prepare_production_settle_position_week_account_infos(
                    &gate, &binding, &settle, accounts,
                ),
                Err(ProductionSettlePositionError::AccountBindingMismatch)
            );
        });
        assert_eq!(wrong_token.all_snapshot(), before);
    }

    #[test]
    fn exact_post_transfer_reloads_seal_and_commit_all_four_v2_postimages() {
        let binding = binding();
        let gate = open_gate();
        let mut fixture = Fixture::new(&binding);
        let prepared = prepare(&mut fixture, &gate, &binding);
        let batch = seal_after_exact_token_deltas(prepared, &mut fixture, &gate, &binding);

        fixture.with_config_and_write_infos(|config, writes| {
            let active_config =
                authenticate_production_active_config_account_info(&gate, &binding, config)
                    .unwrap();
            execute_production_active_existing_write_batch_account_infos(
                &gate,
                &active_config,
                &binding,
                batch,
                writes,
            )
            .unwrap();
        });

        let position = decode_position_state(&fixture.position.data).unwrap();
        assert_eq!(position.paid, 10_000);
        assert_eq!(position.settled_mask, 1);
        assert_eq!(position.treasury_reserved, 0);
        assert_eq!(position.ecosystem_reserved, 0);
        assert_eq!(position.liquidity_reserved, 1_000);

        let treasury = decode_lane_state(&fixture.treasury.data).unwrap();
        let ecosystem = decode_lane_state(&fixture.ecosystem.data).unwrap();
        let liquidity = decode_lane_state(&fixture.liquidity.data).unwrap();
        assert_eq!((treasury.reserved, treasury.paid), (0, 6_000));
        assert_eq!((ecosystem.reserved, ecosystem.paid), (0, 3_000));
        assert_eq!((liquidity.reserved, liquidity.paid), (1_000, 1_000));
    }

    #[test]
    fn token_reload_drift_cannot_produce_a_cas_batch() {
        let binding = binding();
        let gate = open_gate();
        let mut fixture = Fixture::new(&binding);
        let prepared = prepare(&mut fixture, &gate, &binding);
        let amounts = prepared.plan().transfers.map(|transfer| transfer.amount);
        fixture.apply_exact_token_deltas(amounts);
        set_token_amount(
            &mut fixture.ecosystem_tokens.data,
            INITIAL_SOURCE_AMOUNT - amounts[1] + 1,
        );
        let before = fixture.state_snapshot();
        let result = fixture.with_reload_infos(|sources, destination| {
            prepared.seal_post_transfer_cas_account_infos(&gate, &binding, sources, destination)
        });
        assert_eq!(
            result,
            Err(ProductionSettlePositionError::TokenReloadAmountMismatch)
        );
        assert_eq!(fixture.state_snapshot(), before);
    }

    #[test]
    fn retained_paid_overflow_occurs_only_after_exact_token_reloads() {
        let binding = binding();
        let gate = open_gate();
        let mut fixture = Fixture::new(&binding);
        let mut position = decode_position_state(&fixture.position.data).unwrap();
        position.paid = u64::MAX;
        encode_position_state(&position, &mut fixture.position.data).unwrap();
        let before = fixture.state_snapshot();
        let prepared = prepare(&mut fixture, &gate, &binding);
        let amounts = prepared.plan().transfers.map(|transfer| transfer.amount);
        fixture.apply_exact_token_deltas(amounts);
        let result = fixture.with_reload_infos(|sources, destination| {
            prepared.seal_post_transfer_cas_account_infos(&gate, &binding, sources, destination)
        });
        assert_eq!(
            result,
            Err(ProductionSettlePositionError::Economy(
                EconomyError::ArithmeticOverflow
            ))
        );
        assert_eq!(fixture.state_snapshot(), before);
    }

    #[test]
    fn late_fourth_account_borrow_conflict_leaves_every_state_preimage_unchanged() {
        let binding = binding();
        let gate = open_gate();
        let mut fixture = Fixture::new(&binding);
        let prepared = prepare(&mut fixture, &gate, &binding);
        let batch = seal_after_exact_token_deltas(prepared, &mut fixture, &gate, &binding);
        let before = fixture.state_snapshot();

        fixture.with_config_and_write_infos(|config, writes| {
            let active_config =
                authenticate_production_active_config_account_info(&gate, &binding, config)
                    .unwrap();
            let held = writes[3].try_borrow_mut_data().unwrap();
            assert_eq!(
                execute_production_active_existing_write_batch_account_infos(
                    &gate,
                    &active_config,
                    &binding,
                    batch,
                    writes,
                ),
                Err(RuntimeWriteAdapterError::AccountBorrowFailed)
            );
            drop(held);
        });
        assert_eq!(fixture.state_snapshot(), before);
    }

    #[test]
    fn truth_surface_remains_fail_closed_about_missing_executor_and_dispatch() {
        let truth = core::hint::black_box(PRODUCTION_SETTLE_POSITION_TRUTH);
        assert!(truth.feature_gated);
        assert!(truth.exact_instruction_codec_required);
        assert!(truth.runtime_daily_law_capability_supported);
        assert!(truth.production_active_readonly_config_required);
        assert!(truth.exact_standard_account_order_and_flags_required);
        assert!(truth.standard_round_omission_required);
        assert!(!truth.ccc_round_path_enabled);
        assert!(truth.exact_position_and_three_lane_pdas_authenticated);
        assert!(truth.exact_lane_token_and_owner_destination_bindings_authenticated);
        assert!(truth.retained_v2_pre_token_cpi_kernel_used);
        assert!(truth.post_transfer_runtime_token_reloads_required);
        assert!(truth.exact_four_state_cas_batch_sealable_after_reloads);
        assert!(!truth.ordered_hooked_token_cpi_executed);
        assert!(!truth.cas_executor_exposed);
        assert!(!truth.production_dispatcher_exposed);
        assert!(!truth.production_entrypoint_exposed);
        assert!(!truth.handler_complete);
        assert!(truth.mainnet_hold);
        assert!(core::hint::black_box(PRODUCTION_SETTLE_POSITION_STATUS)
            .contains("NO_EXECUTOR_MAINNET_HOLD"));
    }
}

// Anchor 1.0.2 expands legacy Solana target/feature cfgs that Rust 1.97
// reports at the consuming crate. They are framework-generated, not IAT gates.
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use solana_instructions_sysvar::{
    load_current_index_checked, load_instruction_at_checked, ID as INSTRUCTIONS_SYSVAR_ID,
};

pub mod policy;
pub mod switchboard_randomness;
use policy::*;
use switchboard_randomness::{
    parse_randomness, validate_commit_instruction, RevealValidationError, ON_DEMAND_DEVNET_PID,
    ON_DEMAND_MAINNET_PID,
};

declare_id!("62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj");

pub const PROGRAM_ADMIN: Pubkey = pubkey!("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
pub const COMMUNITY_CUSTODY: Pubkey = pubkey!("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
pub const TREASURY_BENEFICIARY: Pubkey = pubkey!("CucS4oym18YjEMUmXYVx45q6HUGhW35wE3qpwkcnSCFQ");
pub const ECOSYSTEM_BENEFICIARY: Pubkey = pubkey!("HypAfe9RwaBRnZeLpqvYU1rBbAwHTSBnm24enRL6Qx18");
pub const CORE_BENEFICIARY: Pubkey = pubkey!("2yBK1NkeUoTToE4cfz33WRckho4Qr2BV1ZtCTrw3AHyB");
pub const LIQUIDITY_BENEFICIARY: Pubkey = pubkey!("2d41i3afUpWuo2LqpuKao5D1ToEU88aBokiQ3z8HQtPC");

// This records that the ABI-pinned Switchboard 0.13 parser and freshness checks
// are compiled into this source. Mainnet authorization remains controlled by
// the independent evidence and hardware-signing gates outside this constant.
pub const RANDOMNESS_ADAPTER_VERIFIED: bool = true;

#[program]
pub mod iat_v2 {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        rehearsal_mode: bool,
        rehearsal_genesis_timestamp: Option<i64>,
        randomness_program: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.admin.key(),
            PROGRAM_ADMIN,
            IatV2Error::WrongHardwareAdministrator
        );
        require_eq!(
            ctx.accounts.mint.decimals,
            TOKEN_DECIMALS,
            IatV2Error::WrongMintDecimals
        );
        let expected_randomness_program = if rehearsal_mode {
            ON_DEMAND_DEVNET_PID
        } else {
            ON_DEMAND_MAINNET_PID
        };
        require_keys_eq!(
            randomness_program,
            expected_randomness_program,
            IatV2Error::WrongRandomnessProgram
        );
        let now = Clock::get()?.unix_timestamp;
        let genesis_timestamp = if rehearsal_mode {
            rehearsal_genesis_timestamp.ok_or(IatV2Error::RehearsalTimestampRequired)?
        } else {
            require!(
                rehearsal_genesis_timestamp.is_none(),
                IatV2Error::ProductionTimestampOverrideForbidden
            );
            now
        };
        require!(
            genesis_timestamp <= now,
            IatV2Error::GenesisTimestampInFuture
        );

        let config = &mut ctx.accounts.config;
        config.admin = PROGRAM_ADMIN;
        config.mint = ctx.accounts.mint.key();
        config.token_program = ctx.accounts.token_program.key();
        config.randomness_program = randomness_program;
        config.genesis_timestamp = genesis_timestamp;
        config.expected_supply = if rehearsal_mode {
            REHEARSAL_SUPPLY
        } else {
            MAINNET_SUPPLY
        };
        config.rehearsal_mode = rehearsal_mode;
        config.active = false;
        config.lane_mask = 0;
        config.stake_vault_initialized = false;
        config.stake_token_account = Pubkey::default();
        config.staked_principal = 0;
        config.agency_registry_hash = [0; 32];
        config.agency_count = 0;
        config.bump = ctx.bumps.config;
        config.vault_authority_bump = ctx.bumps.vault_authority;
        Ok(())
    }

    pub fn initialize_lane_vault(ctx: Context<InitializeLaneVault>, lane: u8) -> Result<()> {
        require!(!ctx.accounts.config.active, IatV2Error::AlreadyActive);
        require!(
            (TREASURY..=LIQUIDITY).contains(&lane),
            IatV2Error::CommunityMustUseHardwareCustody
        );
        require_eq!(
            ctx.accounts.config.lane_mask & (1u8 << lane),
            0,
            IatV2Error::LaneAlreadyInitialized
        );
        let lane_terms =
            lane_policy(lane, ctx.accounts.config.rehearsal_mode).ok_or(IatV2Error::UnknownLane)?;
        let state = &mut ctx.accounts.lane_state;
        state.config = ctx.accounts.config.key();
        state.token_account = ctx.accounts.lane_token_account.key();
        state.beneficiary = beneficiary(lane)?;
        state.total = lane_terms.total;
        state.genesis_unlocked = lane_terms.genesis_unlocked;
        state.cliff_week = lane_terms.cliff_week;
        state.linear_end_week = lane_terms.linear_end_week;
        state.reserved = 0;
        state.paid = 0;
        state.principal_claimed = 0;
        state.lane = lane;
        state.reward_source = lane_terms.reward_source;
        state.bump = ctx.bumps.lane_state;
        state.token_bump = ctx.bumps.lane_token_account;
        ctx.accounts.config.lane_mask |= 1u8 << lane;
        Ok(())
    }

    pub fn initialize_stake_vault(ctx: Context<InitializeStakeVault>) -> Result<()> {
        require!(!ctx.accounts.config.active, IatV2Error::AlreadyActive);
        require!(
            !ctx.accounts.config.stake_vault_initialized,
            IatV2Error::StakeVaultAlreadyInitialized
        );
        ctx.accounts.config.stake_token_account = ctx.accounts.stake_token_account.key();
        ctx.accounts.config.stake_vault_initialized = true;
        Ok(())
    }

    pub fn activate(ctx: Context<Activate>) -> Result<()> {
        require!(
            RANDOMNESS_ADAPTER_VERIFIED,
            IatV2Error::RandomnessAdapterNotVerified
        );
        require!(!ctx.accounts.config.active, IatV2Error::AlreadyActive);
        require_eq!(
            ctx.accounts.config.lane_mask,
            0b1_1110,
            IatV2Error::MissingLaneVault
        );
        require!(
            ctx.accounts.config.stake_vault_initialized,
            IatV2Error::MissingStakeVault
        );
        require_eq!(
            ctx.accounts.mint.supply,
            ctx.accounts.config.expected_supply,
            IatV2Error::WrongFixedSupply
        );
        require!(
            matches!(ctx.accounts.mint.mint_authority, COption::None),
            IatV2Error::MintAuthorityNotRevoked
        );
        require!(
            matches!(ctx.accounts.mint.freeze_authority, COption::None),
            IatV2Error::FreezeAuthorityNotRevoked
        );

        let expected_community = lane_policy(COMMUNITY, ctx.accounts.config.rehearsal_mode)
            .ok_or(IatV2Error::UnknownLane)?
            .total;
        verify_community_funding(
            &ctx.accounts.community_tokens,
            ctx.accounts.mint.key(),
            expected_community,
        )?;
        verify_stake_vault(
            &ctx.accounts.stake_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.vault_authority.key(),
            0,
        )?;
        verify_lane_funding(
            &ctx.accounts.treasury,
            &ctx.accounts.treasury_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.vault_authority.key(),
        )?;
        verify_lane_funding(
            &ctx.accounts.ecosystem,
            &ctx.accounts.ecosystem_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.vault_authority.key(),
        )?;
        verify_lane_funding(
            &ctx.accounts.core_team,
            &ctx.accounts.core_team_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.vault_authority.key(),
        )?;
        verify_lane_funding(
            &ctx.accounts.liquidity,
            &ctx.accounts.liquidity_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.vault_authority.key(),
        )?;

        let core_principal = lane_policy(CORE_TEAM, ctx.accounts.config.rehearsal_mode)
            .ok_or(IatV2Error::UnknownLane)?
            .total;
        let obligation = maximum_reward(core_principal, CORE_RATE_BPS, CORE_TERM_WEEKS)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        let (treasury, ecosystem, liquidity) = reserve_three_lanes(
            &mut ctx.accounts.treasury,
            &mut ctx.accounts.ecosystem,
            &mut ctx.accounts.liquidity,
            obligation,
            0,
        )?;
        let core_reward = &mut ctx.accounts.core_reward;
        core_reward.config = ctx.accounts.config.key();
        core_reward.principal = core_principal;
        core_reward.annual_rate_bps = CORE_RATE_BPS;
        core_reward.term_weeks = CORE_TERM_WEEKS;
        core_reward.treasury_reserved = treasury;
        core_reward.ecosystem_reserved = ecosystem;
        core_reward.liquidity_reserved = liquidity;
        core_reward.paid = 0;
        core_reward.settled_low = 0;
        core_reward.settled_high = 0;
        core_reward.bump = ctx.bumps.core_reward;
        ctx.accounts.config.active = true;
        Ok(())
    }

    pub fn register_agency(ctx: Context<RegisterAgency>) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        let agency = &mut ctx.accounts.agency;
        agency.config = ctx.accounts.config.key();
        agency.owner = ctx.accounts.agency_owner.key();
        agency.index = ctx.accounts.config.agency_count;
        agency.registered_week = week_for(&ctx.accounts.config)?;
        agency.bump = ctx.bumps.agency;
        let owner_index = &mut ctx.accounts.agency_owner_index;
        owner_index.config = ctx.accounts.config.key();
        owner_index.owner = ctx.accounts.agency_owner.key();
        owner_index.index = agency.index;
        owner_index.bump = ctx.bumps.agency_owner_index;
        let owner_bytes = ctx.accounts.agency_owner.key().to_bytes();
        ctx.accounts.config.agency_registry_hash = append_agency_registry_hash(
            ctx.accounts.config.agency_registry_hash,
            agency.index,
            &owner_bytes,
        );
        ctx.accounts.config.agency_count = ctx
            .accounts
            .config
            .agency_count
            .checked_add(1)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn set_eligibility(
        ctx: Context<SetEligibility>,
        role: u8,
        agency_index: Option<u32>,
    ) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require!(role_rate(role).is_some(), IatV2Error::UnknownRole);
        if role == 0 {
            require!(agency_index.is_none(), IatV2Error::StandardCannotLinkAgency);
        } else {
            require!(agency_index.is_some(), IatV2Error::CccRoleRequiresAgency);
            require!(
                agency_index.unwrap() < ctx.accounts.config.agency_count,
                IatV2Error::InvalidAgencyIndex
            );
        }
        let eligibility = &mut ctx.accounts.eligibility;
        eligibility.config = ctx.accounts.config.key();
        eligibility.wallet = ctx.accounts.wallet.key();
        eligibility.role = role;
        eligibility.agency_index = agency_index.unwrap_or(u32::MAX);
        eligibility.bump = ctx.bumps.eligibility;
        Ok(())
    }

    pub fn open_position(
        ctx: Context<OpenPosition>,
        position_id: u64,
        principal: u64,
    ) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require!(principal > 0, IatV2Error::ZeroPrincipal);
        verify_destination(
            &ctx.accounts.owner_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.owner.key(),
        )?;
        let (vault_authority, _) = Pubkey::find_program_address(
            &[b"vault-authority", ctx.accounts.config.key().as_ref()],
            ctx.program_id,
        );
        verify_stake_vault(
            &ctx.accounts.stake_tokens,
            ctx.accounts.mint.key(),
            vault_authority,
            ctx.accounts.config.staked_principal,
        )?;
        require_keys_eq!(
            ctx.accounts.eligibility.wallet,
            ctx.accounts.owner.key(),
            IatV2Error::WrongPositionOwner
        );
        let rate = role_rate(ctx.accounts.eligibility.role).ok_or(IatV2Error::UnknownRole)?;
        if ctx.accounts.eligibility.role == 0 {
            require_eq!(
                ctx.accounts.eligibility.agency_index,
                u32::MAX,
                IatV2Error::StandardCannotLinkAgency
            );
        } else {
            require!(
                ctx.accounts.eligibility.agency_index < ctx.accounts.config.agency_count,
                IatV2Error::InvalidAgencyIndex
            );
        }
        let accepted_week = week_for(&ctx.accounts.config)?;
        let obligation = maximum_reward(principal, rate, USER_TERM_WEEKS)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        let (treasury, ecosystem, liquidity) = reserve_three_lanes(
            &mut ctx.accounts.treasury,
            &mut ctx.accounts.ecosystem,
            &mut ctx.accounts.liquidity,
            obligation,
            accepted_week,
        )?;

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.owner_tokens.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.stake_tokens.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            principal,
            TOKEN_DECIMALS,
        )?;

        ctx.accounts.config.staked_principal = ctx
            .accounts
            .config
            .staked_principal
            .checked_add(principal)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        let position = &mut ctx.accounts.position;
        position.config = ctx.accounts.config.key();
        position.owner = ctx.accounts.owner.key();
        position.position_id = position_id;
        position.principal = principal;
        position.accepted_week = accepted_week;
        position.first_accrual_week = accepted_week
            .checked_add(1)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        position.term_weeks = USER_TERM_WEEKS;
        position.annual_rate_bps = rate;
        position.treasury_reserved = treasury;
        position.ecosystem_reserved = ecosystem;
        position.liquidity_reserved = liquidity;
        position.paid = 0;
        position.settled_mask = 0;
        position.agency_index = ctx.accounts.eligibility.agency_index;
        position.role = ctx.accounts.eligibility.role;
        position.principal_returned = false;
        position.closed = false;
        position.bump = ctx.bumps.position;
        Ok(())
    }

    pub fn settle_position_week(ctx: Context<SettlePositionWeek>, week: u64) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require!(!ctx.accounts.position.closed, IatV2Error::PositionClosed);
        verify_destination(
            &ctx.accounts.destination_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.position.owner,
        )?;
        require!(
            week <= week_for(&ctx.accounts.config)?,
            IatV2Error::FutureSettlementForbidden
        );
        let ordinal = week
            .checked_sub(ctx.accounts.position.first_accrual_week)
            .ok_or(IatV2Error::RoundOutsidePositionTerm)?;
        require!(
            ordinal < ctx.accounts.position.term_weeks,
            IatV2Error::RoundOutsidePositionTerm
        );
        let bit = 1u64
            .checked_shl(u32::try_from(ordinal).map_err(|_| IatV2Error::ArithmeticOverflow)?)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        require_eq!(
            ctx.accounts.position.settled_mask & bit,
            0,
            IatV2Error::PositionWeekAlreadySettled
        );

        let paused = if ctx.accounts.position.role == 0 {
            require!(
                ctx.accounts.round.is_none(),
                IatV2Error::StandardRoundMustBeOmitted
            );
            false
        } else {
            let round = ctx
                .accounts
                .round
                .as_ref()
                .ok_or(IatV2Error::CccRoundRequired)?;
            require_keys_eq!(
                round.config,
                ctx.accounts.config.key(),
                IatV2Error::WrongRoundConfig
            );
            require_eq!(round.week, week, IatV2Error::WrongRoundWeek);
            require_eq!(round.status, 1, IatV2Error::RoundNotSettled);
            require!(
                ctx.accounts.position.agency_index < round.agency_count_snapshot,
                IatV2Error::AgencyNotInRoundSnapshot
            );
            ctx.accounts.position.agency_index == round.selected_agency_index
        };
        let rate = if paused {
            0
        } else {
            ctx.accounts.position.annual_rate_bps
        };
        let amount = reward_for_week(ctx.accounts.position.principal, rate, ordinal)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        let mut treasury_reserved = ctx.accounts.position.treasury_reserved;
        let mut ecosystem_reserved = ctx.accounts.position.ecosystem_reserved;
        let mut liquidity_reserved = ctx.accounts.position.liquidity_reserved;
        let (treasury, ecosystem, liquidity) = consume_three_reservations(
            &mut ctx.accounts.treasury,
            &mut ctx.accounts.ecosystem,
            &mut ctx.accounts.liquidity,
            &mut treasury_reserved,
            &mut ecosystem_reserved,
            &mut liquidity_reserved,
            amount,
        )?;
        ctx.accounts.position.treasury_reserved = treasury_reserved;
        ctx.accounts.position.ecosystem_reserved = ecosystem_reserved;
        ctx.accounts.position.liquidity_reserved = liquidity_reserved;
        transfer_reward_splits(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.vault_authority,
            ctx.accounts.config.key(),
            ctx.accounts.config.vault_authority_bump,
            &ctx.accounts.treasury_tokens,
            &ctx.accounts.ecosystem_tokens,
            &ctx.accounts.liquidity_tokens,
            &ctx.accounts.destination_tokens,
            treasury,
            ecosystem,
            liquidity,
        )?;
        ctx.accounts.position.paid = ctx
            .accounts
            .position
            .paid
            .checked_add(amount)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        ctx.accounts.position.settled_mask |= bit;
        Ok(())
    }

    pub fn settle_core_week(ctx: Context<SettleCoreWeek>, ordinal: u64) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        verify_destination(
            &ctx.accounts.destination_tokens,
            ctx.accounts.mint.key(),
            CORE_BENEFICIARY,
        )?;
        require!(
            ordinal < ctx.accounts.core_reward.term_weeks,
            IatV2Error::CoreRewardTermComplete
        );
        let payable_week = ordinal
            .checked_add(1)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        require!(
            payable_week <= week_for(&ctx.accounts.config)?,
            IatV2Error::FutureSettlementForbidden
        );
        require!(
            !core_week_is_settled(&ctx.accounts.core_reward, ordinal)?,
            IatV2Error::CoreWeekAlreadySettled
        );
        let amount = reward_for_week(
            ctx.accounts.core_reward.principal,
            ctx.accounts.core_reward.annual_rate_bps,
            ordinal,
        )
        .ok_or(IatV2Error::ArithmeticOverflow)?;
        let mut treasury_reserved = ctx.accounts.core_reward.treasury_reserved;
        let mut ecosystem_reserved = ctx.accounts.core_reward.ecosystem_reserved;
        let mut liquidity_reserved = ctx.accounts.core_reward.liquidity_reserved;
        let (treasury, ecosystem, liquidity) = consume_three_reservations(
            &mut ctx.accounts.treasury,
            &mut ctx.accounts.ecosystem,
            &mut ctx.accounts.liquidity,
            &mut treasury_reserved,
            &mut ecosystem_reserved,
            &mut liquidity_reserved,
            amount,
        )?;
        ctx.accounts.core_reward.treasury_reserved = treasury_reserved;
        ctx.accounts.core_reward.ecosystem_reserved = ecosystem_reserved;
        ctx.accounts.core_reward.liquidity_reserved = liquidity_reserved;
        transfer_reward_splits(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.vault_authority,
            ctx.accounts.config.key(),
            ctx.accounts.config.vault_authority_bump,
            &ctx.accounts.treasury_tokens,
            &ctx.accounts.ecosystem_tokens,
            &ctx.accounts.liquidity_tokens,
            &ctx.accounts.destination_tokens,
            treasury,
            ecosystem,
            liquidity,
        )?;
        ctx.accounts.core_reward.paid = ctx
            .accounts
            .core_reward
            .paid
            .checked_add(amount)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        mark_core_week_settled(&mut ctx.accounts.core_reward, ordinal)?;
        Ok(())
    }

    pub fn claim_lane_principal(ctx: Context<ClaimLanePrincipal>, lane: u8) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require_eq!(ctx.accounts.lane_state.lane, lane, IatV2Error::UnknownLane);
        require!(
            (TREASURY..=LIQUIDITY).contains(&lane),
            IatV2Error::UnknownLane
        );
        verify_destination(
            &ctx.accounts.destination_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.lane_state.beneficiary,
        )?;
        let terms = LanePolicy {
            total: ctx.accounts.lane_state.total,
            genesis_unlocked: ctx.accounts.lane_state.genesis_unlocked,
            cliff_week: ctx.accounts.lane_state.cliff_week,
            linear_end_week: ctx.accounts.lane_state.linear_end_week,
            reward_source: ctx.accounts.lane_state.reward_source,
        };
        let unlocked = cumulative_unlocked(terms, week_for(&ctx.accounts.config)?)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        let committed = ctx
            .accounts
            .lane_state
            .reserved
            .checked_add(ctx.accounts.lane_state.paid)
            .and_then(|value| value.checked_add(ctx.accounts.lane_state.principal_claimed))
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        let claimable = unlocked.saturating_sub(committed);
        require!(claimable > 0, IatV2Error::NothingVestedToClaim);
        transfer_from_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.lane_tokens,
            &ctx.accounts.mint,
            &ctx.accounts.destination_tokens,
            &ctx.accounts.vault_authority,
            ctx.accounts.config.key(),
            ctx.accounts.config.vault_authority_bump,
            claimable,
        )?;
        ctx.accounts.lane_state.principal_claimed = ctx
            .accounts
            .lane_state
            .principal_claimed
            .checked_add(claimable)
            .ok_or(IatV2Error::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn withdraw_position_principal(ctx: Context<WithdrawPositionPrincipal>) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require!(!ctx.accounts.position.closed, IatV2Error::PositionClosed);
        verify_destination(
            &ctx.accounts.destination_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.position.owner,
        )?;
        require!(
            !ctx.accounts.position.principal_returned,
            IatV2Error::PrincipalAlreadyReturned
        );
        let maturity_week = position_maturity_week(
            ctx.accounts.position.accepted_week,
            ctx.accounts.position.term_weeks,
        )
        .ok_or(IatV2Error::ArithmeticOverflow)?;
        require!(
            week_for(&ctx.accounts.config)? >= maturity_week,
            IatV2Error::PositionTermNotComplete
        );
        require!(
            ctx.accounts.config.staked_principal >= ctx.accounts.position.principal,
            IatV2Error::StakeLedgerMismatch
        );
        verify_stake_vault(
            &ctx.accounts.stake_tokens,
            ctx.accounts.mint.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.config.staked_principal,
        )?;
        transfer_from_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.stake_tokens,
            &ctx.accounts.mint,
            &ctx.accounts.destination_tokens,
            &ctx.accounts.vault_authority,
            ctx.accounts.config.key(),
            ctx.accounts.config.vault_authority_bump,
            ctx.accounts.position.principal,
        )?;
        ctx.accounts.config.staked_principal = ctx
            .accounts
            .config
            .staked_principal
            .checked_sub(ctx.accounts.position.principal)
            .ok_or(IatV2Error::StakeLedgerMismatch)?;
        ctx.accounts.position.principal_returned = true;
        Ok(())
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require!(!ctx.accounts.position.closed, IatV2Error::PositionClosed);
        require!(
            ctx.accounts.position.principal_returned,
            IatV2Error::PrincipalNotReturned
        );
        require_eq!(
            ctx.accounts.position.settled_mask,
            full_position_settlement_mask(),
            IatV2Error::PositionWeeksOutstanding
        );
        let mut treasury_reserved = ctx.accounts.position.treasury_reserved;
        let mut ecosystem_reserved = ctx.accounts.position.ecosystem_reserved;
        let mut liquidity_reserved = ctx.accounts.position.liquidity_reserved;
        release_three_reservations(
            &mut ctx.accounts.treasury,
            &mut ctx.accounts.ecosystem,
            &mut ctx.accounts.liquidity,
            &mut treasury_reserved,
            &mut ecosystem_reserved,
            &mut liquidity_reserved,
        )?;
        ctx.accounts.position.treasury_reserved = treasury_reserved;
        ctx.accounts.position.ecosystem_reserved = ecosystem_reserved;
        ctx.accounts.position.liquidity_reserved = liquidity_reserved;
        ctx.accounts.position.closed = true;
        Ok(())
    }

    pub fn commit_round(ctx: Context<CommitRound>, week: u64) -> Result<()> {
        require!(
            RANDOMNESS_ADAPTER_VERIFIED,
            IatV2Error::RandomnessAdapterNotVerified
        );
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require!(
            ctx.accounts.config.agency_count > 0,
            IatV2Error::NoEligibleAgencies
        );
        require_eq!(
            week,
            ccc_round_for(&ctx.accounts.config)?,
            IatV2Error::WrongRoundWeek
        );
        require_keys_eq!(
            *ctx.accounts.randomness_account.owner,
            ctx.accounts.config.randomness_program,
            IatV2Error::WrongRandomnessProgram
        );
        let instructions_account = ctx.accounts.instructions.to_account_info();
        let current_instruction_index = load_current_index_checked(&instructions_account)
            .map_err(|_| IatV2Error::RandomnessCommitInstructionMissing)?;
        require!(
            current_instruction_index > 0,
            IatV2Error::RandomnessCommitInstructionMissing
        );
        let commit_instruction = load_instruction_at_checked(
            usize::from(current_instruction_index - 1),
            &instructions_account,
        )
        .map_err(|_| IatV2Error::RandomnessCommitInstructionMissing)?;
        validate_commit_instruction(
            &commit_instruction,
            ctx.accounts.config.randomness_program,
            ctx.accounts.randomness_account.key(),
            ctx.accounts.payer.key(),
        )
        .map_err(|_| IatV2Error::InvalidRandomnessCommitInstruction)?;
        let clock = Clock::get()?;
        let committed_seed_slot = {
            let data = ctx.accounts.randomness_account.data.borrow();
            let randomness = parse_randomness(&data).ok_or(IatV2Error::InvalidRandomnessAccount)?;
            require!(
                randomness.is_fresh_unrevealed_commit(clock.slot),
                IatV2Error::RandomnessCommitNotFresh
            );
            randomness.seed_slot
        };
        let round = &mut ctx.accounts.round;
        round.config = ctx.accounts.config.key();
        round.week = week;
        round.agency_count_snapshot = ctx.accounts.config.agency_count;
        round.agency_registry_hash_snapshot = ctx.accounts.config.agency_registry_hash;
        let config_bytes = ctx.accounts.config.key().to_bytes();
        round.decision_context =
            ccc_tiebreak_context(&config_bytes, week, round.agency_registry_hash_snapshot);
        round.randomness_account = ctx.accounts.randomness_account.key();
        round.commit_slot = committed_seed_slot;
        round.randomness = [0; 32];
        round.selected_agency_index = u32::MAX;
        round.derivation_counter = u32::MAX;
        round.status = 0;
        round.bump = ctx.bumps.round;
        Ok(())
    }

    pub fn settle_round(ctx: Context<SettleRound>) -> Result<()> {
        require!(
            RANDOMNESS_ADAPTER_VERIFIED,
            IatV2Error::RandomnessAdapterNotVerified
        );
        require!(ctx.accounts.config.active, IatV2Error::NotActive);
        require_eq!(
            ctx.accounts.round.status,
            0,
            IatV2Error::RoundAlreadySettled
        );
        require_keys_eq!(
            *ctx.accounts.randomness_account.owner,
            ctx.accounts.config.randomness_program,
            IatV2Error::WrongRandomnessProgram
        );

        let clock = Clock::get()?;
        let (reveal_slot, revealed) = {
            let data = ctx.accounts.randomness_account.data.borrow();
            let randomness = parse_randomness(&data).ok_or(IatV2Error::InvalidRandomnessAccount)?;
            let revealed =
                match randomness.validated_reveal(clock.slot, ctx.accounts.round.commit_slot) {
                    Ok(value) => value,
                    Err(RevealValidationError::RevealNotCurrent) => {
                        return err!(IatV2Error::RandomnessNotFresh)
                    }
                    Err(RevealValidationError::CommitSlotMismatch) => {
                        return err!(IatV2Error::RandomnessCommitSlotMismatch)
                    }
                    Err(RevealValidationError::RevealNotAfterCommit) => {
                        return err!(IatV2Error::RandomnessRevealNotAfterCommit)
                    }
                };
            (randomness.reveal_slot, revealed)
        };

        let outcome = uniform_tiebreak_outcome(
            revealed,
            ctx.accounts.round.decision_context,
            ctx.accounts.round.agency_count_snapshot,
        )
        .ok_or(IatV2Error::TiebreakDerivationExhausted)?;

        let round = &mut ctx.accounts.round;
        round.randomness = revealed;
        round.selected_agency_index = outcome.index;
        round.derivation_counter = outcome.derivation_counter;
        round.status = 1;

        emit!(RoundSettled {
            config: round.config,
            round: round.key(),
            week: round.week,
            randomness_account: round.randomness_account,
            commit_slot: round.commit_slot,
            reveal_slot,
            agency_count_snapshot: round.agency_count_snapshot,
            agency_registry_hash_snapshot: round.agency_registry_hash_snapshot,
            decision_context: round.decision_context,
            randomness: round.randomness,
            derivation_counter: round.derivation_counter,
            selected_agency_index: round.selected_agency_index,
        });
        Ok(())
    }
}

fn beneficiary(lane: u8) -> Result<Pubkey> {
    match lane {
        COMMUNITY => Ok(COMMUNITY_CUSTODY),
        TREASURY => Ok(TREASURY_BENEFICIARY),
        ECOSYSTEM => Ok(ECOSYSTEM_BENEFICIARY),
        CORE_TEAM => Ok(CORE_BENEFICIARY),
        LIQUIDITY => Ok(LIQUIDITY_BENEFICIARY),
        _ => err!(IatV2Error::UnknownLane),
    }
}

fn week_for(config: &Config) -> Result<u64> {
    current_week(config.genesis_timestamp, Clock::get()?.unix_timestamp)
        .ok_or_else(|| error!(IatV2Error::InvalidClock))
}

fn ccc_round_for(config: &Config) -> Result<u64> {
    current_ccc_round(config.genesis_timestamp, Clock::get()?.unix_timestamp)
        .ok_or_else(|| error!(IatV2Error::CccSelectionNotOpen))
}

fn verify_community_funding(
    tokens: &Account<'_, TokenAccount>,
    mint: Pubkey,
    expected_amount: u64,
) -> Result<()> {
    require_keys_eq!(tokens.mint, mint, IatV2Error::WrongTokenMint);
    require_keys_eq!(
        tokens.owner,
        COMMUNITY_CUSTODY,
        IatV2Error::WrongCommunityCustody
    );
    require_eq!(
        tokens.amount,
        expected_amount,
        IatV2Error::WrongCommunityFunding
    );
    Ok(())
}

fn verify_destination(
    tokens: &Account<'_, TokenAccount>,
    mint: Pubkey,
    owner: Pubkey,
) -> Result<()> {
    require_keys_eq!(tokens.mint, mint, IatV2Error::WrongTokenMint);
    require_keys_eq!(tokens.owner, owner, IatV2Error::WrongDestinationOwner);
    Ok(())
}

fn verify_stake_vault(
    tokens: &Account<'_, TokenAccount>,
    mint: Pubkey,
    vault_authority: Pubkey,
    expected_amount: u64,
) -> Result<()> {
    require_keys_eq!(tokens.mint, mint, IatV2Error::WrongTokenMint);
    require_keys_eq!(
        tokens.owner,
        vault_authority,
        IatV2Error::WrongVaultAuthority
    );
    require_eq!(
        tokens.amount,
        expected_amount,
        IatV2Error::StakeLedgerMismatch
    );
    Ok(())
}

fn verify_lane_funding(
    lane: &LaneVault,
    tokens: &Account<'_, TokenAccount>,
    mint: Pubkey,
    vault_authority: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        lane.token_account,
        tokens.key(),
        IatV2Error::WrongVaultTokenAccount
    );
    require_keys_eq!(tokens.mint, mint, IatV2Error::WrongTokenMint);
    require_keys_eq!(
        tokens.owner,
        vault_authority,
        IatV2Error::WrongVaultAuthority
    );
    require_eq!(lane.total, tokens.amount, IatV2Error::WrongVaultFunding);
    Ok(())
}

fn reserve_lane(lane: &mut LaneVault, remaining: &mut u64, week: u64) -> Result<u64> {
    if *remaining == 0 {
        return Ok(0);
    }
    require!(lane.reward_source, IatV2Error::NotRewardLane);
    let terms = LanePolicy {
        total: lane.total,
        genesis_unlocked: lane.genesis_unlocked,
        cliff_week: lane.cliff_week,
        linear_end_week: lane.linear_end_week,
        reward_source: lane.reward_source,
    };
    let unlocked = cumulative_unlocked(terms, week).ok_or(IatV2Error::ArithmeticOverflow)?;
    let used = lane
        .reserved
        .checked_add(lane.paid)
        .and_then(|value| value.checked_add(lane.principal_claimed))
        .ok_or(IatV2Error::ArithmeticOverflow)?;
    let capacity = unlocked.saturating_sub(used);
    let take = capacity.min(*remaining);
    lane.reserved = lane
        .reserved
        .checked_add(take)
        .ok_or(IatV2Error::ArithmeticOverflow)?;
    *remaining = remaining
        .checked_sub(take)
        .ok_or(IatV2Error::ArithmeticOverflow)?;
    Ok(take)
}

fn reserve_three_lanes(
    treasury: &mut LaneVault,
    ecosystem: &mut LaneVault,
    liquidity: &mut LaneVault,
    amount: u64,
    week: u64,
) -> Result<(u64, u64, u64)> {
    require_eq!(treasury.lane, TREASURY, IatV2Error::WrongLaneOrder);
    require_eq!(ecosystem.lane, ECOSYSTEM, IatV2Error::WrongLaneOrder);
    require_eq!(liquidity.lane, LIQUIDITY, IatV2Error::WrongLaneOrder);
    let mut remaining = amount;
    let treasury_reserved = reserve_lane(treasury, &mut remaining, week)?;
    let ecosystem_reserved = reserve_lane(ecosystem, &mut remaining, week)?;
    let liquidity_reserved = reserve_lane(liquidity, &mut remaining, week)?;
    require_eq!(remaining, 0, IatV2Error::InsufficientUnlockedRewardCapacity);
    Ok((treasury_reserved, ecosystem_reserved, liquidity_reserved))
}

fn consume_reserved_lane(
    lane: &mut LaneVault,
    position_reserved: &mut u64,
    remaining: &mut u64,
) -> Result<u64> {
    require!(lane.reward_source, IatV2Error::NotRewardLane);
    require!(
        *position_reserved <= lane.reserved,
        IatV2Error::ReservationLedgerMismatch
    );
    let take = (*position_reserved).min(*remaining);
    *position_reserved = position_reserved
        .checked_sub(take)
        .ok_or(IatV2Error::ReservationLedgerMismatch)?;
    lane.reserved = lane
        .reserved
        .checked_sub(take)
        .ok_or(IatV2Error::ReservationLedgerMismatch)?;
    lane.paid = lane
        .paid
        .checked_add(take)
        .ok_or(IatV2Error::ArithmeticOverflow)?;
    *remaining = remaining
        .checked_sub(take)
        .ok_or(IatV2Error::ArithmeticOverflow)?;
    Ok(take)
}

fn consume_three_reservations(
    treasury: &mut LaneVault,
    ecosystem: &mut LaneVault,
    liquidity: &mut LaneVault,
    treasury_reserved: &mut u64,
    ecosystem_reserved: &mut u64,
    liquidity_reserved: &mut u64,
    amount: u64,
) -> Result<(u64, u64, u64)> {
    require_eq!(treasury.lane, TREASURY, IatV2Error::WrongLaneOrder);
    require_eq!(ecosystem.lane, ECOSYSTEM, IatV2Error::WrongLaneOrder);
    require_eq!(liquidity.lane, LIQUIDITY, IatV2Error::WrongLaneOrder);
    let mut remaining = amount;
    let treasury_paid = consume_reserved_lane(treasury, treasury_reserved, &mut remaining)?;
    let ecosystem_paid = consume_reserved_lane(ecosystem, ecosystem_reserved, &mut remaining)?;
    let liquidity_paid = consume_reserved_lane(liquidity, liquidity_reserved, &mut remaining)?;
    require_eq!(remaining, 0, IatV2Error::PaymentExceedsReservation);
    Ok((treasury_paid, ecosystem_paid, liquidity_paid))
}

fn release_reserved_lane(lane: &mut LaneVault, position_reserved: &mut u64) -> Result<()> {
    require!(
        *position_reserved <= lane.reserved,
        IatV2Error::ReservationLedgerMismatch
    );
    lane.reserved = lane
        .reserved
        .checked_sub(*position_reserved)
        .ok_or(IatV2Error::ReservationLedgerMismatch)?;
    *position_reserved = 0;
    Ok(())
}

fn release_three_reservations(
    treasury: &mut LaneVault,
    ecosystem: &mut LaneVault,
    liquidity: &mut LaneVault,
    treasury_reserved: &mut u64,
    ecosystem_reserved: &mut u64,
    liquidity_reserved: &mut u64,
) -> Result<()> {
    require_eq!(treasury.lane, TREASURY, IatV2Error::WrongLaneOrder);
    require_eq!(ecosystem.lane, ECOSYSTEM, IatV2Error::WrongLaneOrder);
    require_eq!(liquidity.lane, LIQUIDITY, IatV2Error::WrongLaneOrder);
    release_reserved_lane(treasury, treasury_reserved)?;
    release_reserved_lane(ecosystem, ecosystem_reserved)?;
    release_reserved_lane(liquidity, liquidity_reserved)?;
    Ok(())
}

fn transfer_from_vault<'info>(
    token_program: &Program<'info, Token>,
    source: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    destination: &Account<'info, TokenAccount>,
    vault_authority: &UncheckedAccount<'info>,
    config_key: Pubkey,
    vault_authority_bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let bump = [vault_authority_bump];
    let signer_seeds: &[&[u8]] = &[b"vault-authority", config_key.as_ref(), &bump];
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: source.to_account_info(),
                mint: mint.to_account_info(),
                to: destination.to_account_info(),
                authority: vault_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
        TOKEN_DECIMALS,
    )
}

#[allow(clippy::too_many_arguments)]
fn transfer_reward_splits<'info>(
    token_program: &Program<'info, Token>,
    mint: &Account<'info, Mint>,
    vault_authority: &UncheckedAccount<'info>,
    config_key: Pubkey,
    vault_authority_bump: u8,
    treasury_tokens: &Account<'info, TokenAccount>,
    ecosystem_tokens: &Account<'info, TokenAccount>,
    liquidity_tokens: &Account<'info, TokenAccount>,
    destination: &Account<'info, TokenAccount>,
    treasury: u64,
    ecosystem: u64,
    liquidity: u64,
) -> Result<()> {
    transfer_from_vault(
        token_program,
        treasury_tokens,
        mint,
        destination,
        vault_authority,
        config_key,
        vault_authority_bump,
        treasury,
    )?;
    transfer_from_vault(
        token_program,
        ecosystem_tokens,
        mint,
        destination,
        vault_authority,
        config_key,
        vault_authority_bump,
        ecosystem,
    )?;
    transfer_from_vault(
        token_program,
        liquidity_tokens,
        mint,
        destination,
        vault_authority,
        config_key,
        vault_authority_bump,
        liquidity,
    )
}

fn full_position_settlement_mask() -> u64 {
    (1u64 << USER_TERM_WEEKS) - 1
}

fn core_week_is_settled(core: &CoreReward, ordinal: u64) -> Result<bool> {
    if ordinal < 64 {
        Ok(core.settled_low & (1u64 << ordinal) != 0)
    } else if ordinal < CORE_TERM_WEEKS {
        Ok(core.settled_high & (1u64 << (ordinal - 64)) != 0)
    } else {
        err!(IatV2Error::CoreRewardTermComplete)
    }
}

fn mark_core_week_settled(core: &mut CoreReward, ordinal: u64) -> Result<()> {
    if ordinal < 64 {
        core.settled_low |= 1u64 << ordinal;
    } else if ordinal < CORE_TERM_WEEKS {
        core.settled_high |= 1u64 << (ordinal - 64);
    } else {
        return err!(IatV2Error::CoreRewardTermComplete);
    }
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config", mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, Config>,
    /// CHECK: signing-only PDA; owns program token vaults.
    #[account(seeds = [b"vault-authority", config.key().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lane: u8)]
pub struct InitializeLaneVault<'info> {
    #[account(mut, address = config.admin)]
    pub admin: Signer<'info>,
    #[account(mut, has_one = mint, has_one = token_program)]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    /// CHECK: validated by PDA seeds and used only as token authority.
    #[account(
        seeds = [b"vault-authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + LaneVault::INIT_SPACE,
        seeds = [b"lane", config.key().as_ref(), &[lane]],
        bump
    )]
    pub lane_state: Account<'info, LaneVault>,
    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = vault_authority,
        seeds = [b"lane-token", config.key().as_ref(), &[lane]],
        bump
    )]
    pub lane_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeStakeVault<'info> {
    #[account(mut, address = config.admin)]
    pub admin: Signer<'info>,
    #[account(mut, has_one = mint, has_one = token_program)]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    /// CHECK: validated by PDA seeds and used only as token authority.
    #[account(
        seeds = [b"vault-authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = vault_authority,
        seeds = [b"stake-token", config.key().as_ref()],
        bump
    )]
    pub stake_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Activate<'info> {
    #[account(mut, address = config.admin)]
    pub admin: Signer<'info>,
    #[account(mut, has_one = mint)]
    pub config: Box<Account<'info, Config>>,
    pub mint: Box<Account<'info, Mint>>,
    /// CHECK: validated by PDA seeds and used only as the expected token authority.
    #[account(
        seeds = [b"vault-authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    pub community_tokens: Box<Account<'info, TokenAccount>>,
    #[account(address = config.stake_token_account)]
    pub stake_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [b"lane", config.key().as_ref(), &[TREASURY]], bump = treasury.bump)]
    pub treasury: Box<Account<'info, LaneVault>>,
    #[account(address = treasury.token_account)]
    pub treasury_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [b"lane", config.key().as_ref(), &[ECOSYSTEM]], bump = ecosystem.bump)]
    pub ecosystem: Box<Account<'info, LaneVault>>,
    #[account(address = ecosystem.token_account)]
    pub ecosystem_tokens: Box<Account<'info, TokenAccount>>,
    #[account(seeds = [b"lane", config.key().as_ref(), &[CORE_TEAM]], bump = core_team.bump)]
    pub core_team: Box<Account<'info, LaneVault>>,
    #[account(address = core_team.token_account)]
    pub core_team_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [b"lane", config.key().as_ref(), &[LIQUIDITY]], bump = liquidity.bump)]
    pub liquidity: Box<Account<'info, LaneVault>>,
    #[account(address = liquidity.token_account)]
    pub liquidity_tokens: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = admin,
        space = 8 + CoreReward::INIT_SPACE,
        seeds = [b"core-reward", config.key().as_ref()],
        bump
    )]
    pub core_reward: Box<Account<'info, CoreReward>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAgency<'info> {
    #[account(mut, address = config.admin)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    /// CHECK: public agency owner; no signature or private material is requested.
    pub agency_owner: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Agency::INIT_SPACE,
        seeds = [b"agency", config.key().as_ref(), &config.agency_count.to_le_bytes()],
        bump
    )]
    pub agency: Account<'info, Agency>,
    #[account(
        init,
        payer = admin,
        space = 8 + AgencyOwnerIndex::INIT_SPACE,
        seeds = [b"agency-owner", config.key().as_ref(), agency_owner.key().as_ref()],
        bump
    )]
    pub agency_owner_index: Account<'info, AgencyOwnerIndex>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetEligibility<'info> {
    #[account(mut, address = config.admin)]
    pub admin: Signer<'info>,
    pub config: Account<'info, Config>,
    /// CHECK: public wallet being certified.
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + Eligibility::INIT_SPACE,
        seeds = [b"eligibility", config.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub eligibility: Account<'info, Eligibility>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(position_id: u64)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = mint, has_one = token_program)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        has_one = config,
        seeds = [b"eligibility", config.key().as_ref(), owner.key().as_ref()],
        bump = eligibility.bump
    )]
    pub eligibility: Box<Account<'info, Eligibility>>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub owner_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.stake_token_account)]
    pub stake_tokens: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[TREASURY]],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, LaneVault>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[ECOSYSTEM]],
        bump = ecosystem.bump
    )]
    pub ecosystem: Box<Account<'info, LaneVault>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[LIQUIDITY]],
        bump = liquidity.bump
    )]
    pub liquidity: Box<Account<'info, LaneVault>>,
    #[account(
        init,
        payer = owner,
        space = 8 + Position::INIT_SPACE,
        seeds = [
            b"position",
            config.key().as_ref(),
            owner.key().as_ref(),
            &position_id.to_le_bytes()
        ],
        bump
    )]
    pub position: Box<Account<'info, Position>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettlePositionWeek<'info> {
    pub caller: Signer<'info>,
    #[account(has_one = mint, has_one = token_program)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, has_one = config)]
    pub position: Box<Account<'info, Position>>,
    pub round: Option<Account<'info, Round>>,
    pub mint: Box<Account<'info, Mint>>,
    /// CHECK: canonical signer PDA for all program token vaults.
    #[account(
        seeds = [b"vault-authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[TREASURY]],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, LaneVault>>,
    #[account(mut, address = treasury.token_account)]
    pub treasury_tokens: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[ECOSYSTEM]],
        bump = ecosystem.bump
    )]
    pub ecosystem: Box<Account<'info, LaneVault>>,
    #[account(mut, address = ecosystem.token_account)]
    pub ecosystem_tokens: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[LIQUIDITY]],
        bump = liquidity.bump
    )]
    pub liquidity: Box<Account<'info, LaneVault>>,
    #[account(mut, address = liquidity.token_account)]
    pub liquidity_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SettleCoreWeek<'info> {
    pub caller: Signer<'info>,
    #[account(has_one = mint, has_one = token_program)]
    pub config: Box<Account<'info, Config>>,
    pub mint: Box<Account<'info, Mint>>,
    /// CHECK: canonical signer PDA for all program token vaults.
    #[account(
        seeds = [b"vault-authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"core-reward", config.key().as_ref()],
        bump = core_reward.bump
    )]
    pub core_reward: Box<Account<'info, CoreReward>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[TREASURY]],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, LaneVault>>,
    #[account(mut, address = treasury.token_account)]
    pub treasury_tokens: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[ECOSYSTEM]],
        bump = ecosystem.bump
    )]
    pub ecosystem: Box<Account<'info, LaneVault>>,
    #[account(mut, address = ecosystem.token_account)]
    pub ecosystem_tokens: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[LIQUIDITY]],
        bump = liquidity.bump
    )]
    pub liquidity: Box<Account<'info, LaneVault>>,
    #[account(mut, address = liquidity.token_account)]
    pub liquidity_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(lane: u8)]
pub struct ClaimLanePrincipal<'info> {
    pub caller: Signer<'info>,
    #[account(has_one = mint, has_one = token_program)]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    /// CHECK: canonical signer PDA for all program token vaults.
    #[account(
        seeds = [b"vault-authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[lane]],
        bump = lane_state.bump
    )]
    pub lane_state: Account<'info, LaneVault>,
    #[account(mut, address = lane_state.token_account)]
    pub lane_tokens: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_tokens: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawPositionPrincipal<'info> {
    pub caller: Signer<'info>,
    #[account(mut, has_one = mint, has_one = token_program)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config)]
    pub position: Account<'info, Position>,
    pub mint: Account<'info, Mint>,
    /// CHECK: canonical signer PDA for all program token vaults.
    #[account(
        seeds = [b"vault-authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(mut, address = config.stake_token_account)]
    pub stake_tokens: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_tokens: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    pub caller: Signer<'info>,
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config)]
    pub position: Account<'info, Position>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[TREASURY]],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, LaneVault>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[ECOSYSTEM]],
        bump = ecosystem.bump
    )]
    pub ecosystem: Account<'info, LaneVault>,
    #[account(
        mut,
        seeds = [b"lane", config.key().as_ref(), &[LIQUIDITY]],
        bump = liquidity.bump
    )]
    pub liquidity: Account<'info, LaneVault>,
}

#[derive(Accounts)]
#[instruction(week: u64)]
pub struct CommitRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, Config>,
    /// CHECK: owner is pinned to config.randomness_program and key is stored.
    pub randomness_account: UncheckedAccount<'info>,
    /// CHECK: address is the canonical instructions sysvar and the immediately
    /// preceding Switchboard commit instruction is parsed in the handler.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Round::INIT_SPACE,
        seeds = [b"round", config.key().as_ref(), &week.to_le_bytes()],
        bump
    )]
    pub round: Account<'info, Round>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleRound<'info> {
    pub config: Account<'info, Config>,
    #[account(mut, has_one = config)]
    pub round: Account<'info, Round>,
    /// CHECK: address and owner are pinned; data is parsed against the Switchboard
    /// On-Demand 0.13 RandomnessAccountData ABI, discriminator, size and freshness.
    #[account(address = round.randomness_account)]
    pub randomness_account: UncheckedAccount<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub token_program: Pubkey,
    pub randomness_program: Pubkey,
    pub stake_token_account: Pubkey,
    pub agency_registry_hash: [u8; 32],
    pub genesis_timestamp: i64,
    pub expected_supply: u64,
    pub staked_principal: u64,
    pub agency_count: u32,
    pub rehearsal_mode: bool,
    pub active: bool,
    pub lane_mask: u8,
    pub stake_vault_initialized: bool,
    pub bump: u8,
    pub vault_authority_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LaneVault {
    pub config: Pubkey,
    pub token_account: Pubkey,
    pub beneficiary: Pubkey,
    pub total: u64,
    pub genesis_unlocked: u64,
    pub cliff_week: u64,
    pub linear_end_week: u64,
    pub reserved: u64,
    pub paid: u64,
    pub principal_claimed: u64,
    pub lane: u8,
    pub reward_source: bool,
    pub bump: u8,
    pub token_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CoreReward {
    pub config: Pubkey,
    pub principal: u64,
    pub annual_rate_bps: u64,
    pub term_weeks: u64,
    pub treasury_reserved: u64,
    pub ecosystem_reserved: u64,
    pub liquidity_reserved: u64,
    pub paid: u64,
    pub settled_low: u64,
    pub settled_high: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Agency {
    pub config: Pubkey,
    pub owner: Pubkey,
    pub index: u32,
    pub registered_week: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgencyOwnerIndex {
    pub config: Pubkey,
    pub owner: Pubkey,
    pub index: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Eligibility {
    pub config: Pubkey,
    pub wallet: Pubkey,
    pub agency_index: u32,
    pub role: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub config: Pubkey,
    pub owner: Pubkey,
    pub position_id: u64,
    pub principal: u64,
    pub accepted_week: u64,
    pub first_accrual_week: u64,
    pub term_weeks: u64,
    pub annual_rate_bps: u64,
    pub treasury_reserved: u64,
    pub ecosystem_reserved: u64,
    pub liquidity_reserved: u64,
    pub paid: u64,
    pub settled_mask: u64,
    pub agency_index: u32,
    pub role: u8,
    pub principal_returned: bool,
    pub closed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub config: Pubkey,
    pub randomness_account: Pubkey,
    pub week: u64,
    pub commit_slot: u64,
    pub randomness: [u8; 32],
    pub agency_registry_hash_snapshot: [u8; 32],
    pub decision_context: [u8; 32],
    pub agency_count_snapshot: u32,
    pub selected_agency_index: u32,
    pub derivation_counter: u32,
    pub status: u8,
    pub bump: u8,
}

#[event]
pub struct RoundSettled {
    pub config: Pubkey,
    pub round: Pubkey,
    pub week: u64,
    pub randomness_account: Pubkey,
    pub commit_slot: u64,
    pub reveal_slot: u64,
    pub agency_count_snapshot: u32,
    pub agency_registry_hash_snapshot: [u8; 32],
    pub decision_context: [u8; 32],
    pub randomness: [u8; 32],
    pub derivation_counter: u32,
    pub selected_agency_index: u32,
}

#[error_code]
pub enum IatV2Error {
    #[msg("The reviewed Model T administrator must sign this instruction.")]
    WrongHardwareAdministrator,
    #[msg("The mint must use nine decimals.")]
    WrongMintDecimals,
    #[msg("A reviewed randomness program is required.")]
    RandomnessProgramMissing,
    #[msg("Rehearsal mode requires an explicit backdated timestamp.")]
    RehearsalTimestampRequired,
    #[msg("Production mode cannot override the Genesis timestamp.")]
    ProductionTimestampOverrideForbidden,
    #[msg("Genesis timestamp cannot be in the future.")]
    GenesisTimestampInFuture,
    #[msg("The program is already active.")]
    AlreadyActive,
    #[msg("Unknown allocation lane.")]
    UnknownLane,
    #[msg("The community allocation must use the published hardware-custody token account, not a program vault.")]
    CommunityMustUseHardwareCustody,
    #[msg("This allocation lane is already initialized.")]
    LaneAlreadyInitialized,
    #[msg("The stake vault is already initialized.")]
    StakeVaultAlreadyInitialized,
    #[msg("The reviewed randomness adapter has not passed compiled tests.")]
    RandomnessAdapterNotVerified,
    #[msg("One or more canonical lane vaults are missing.")]
    MissingLaneVault,
    #[msg("The canonical stake vault is missing.")]
    MissingStakeVault,
    #[msg("The mint supply does not equal the canonical fixed supply.")]
    WrongFixedSupply,
    #[msg("Mint authority must be revoked.")]
    MintAuthorityNotRevoked,
    #[msg("Freeze authority must be revoked.")]
    FreezeAuthorityNotRevoked,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
    #[msg("Vault token account does not match lane state.")]
    WrongVaultTokenAccount,
    #[msg("Token account is for the wrong mint.")]
    WrongTokenMint,
    #[msg("Destination token account is controlled by the wrong owner.")]
    WrongDestinationOwner,
    #[msg("Program token vault has the wrong authority.")]
    WrongVaultAuthority,
    #[msg("Community token account is not controlled by the published hardware-custody address.")]
    WrongCommunityCustody,
    #[msg("Community token account does not hold its exact allocation.")]
    WrongCommunityFunding,
    #[msg("Stake token balance does not match tracked principal.")]
    StakeLedgerMismatch,
    #[msg("Vault funding does not equal its exact allocation.")]
    WrongVaultFunding,
    #[msg("Only reward-source lanes may reserve rewards.")]
    NotRewardLane,
    #[msg("Reward lanes were not supplied in treasury, ecosystem, liquidity order.")]
    WrongLaneOrder,
    #[msg("Insufficient currently unlocked reward capacity; reward debt is forbidden.")]
    InsufficientUnlockedRewardCapacity,
    #[msg("Program is not active.")]
    NotActive,
    #[msg("No eligible CCC agencies exist for this round.")]
    NoEligibleAgencies,
    #[msg("Unknown eligibility role.")]
    UnknownRole,
    #[msg("A standard position cannot link a CCC agency.")]
    StandardCannotLinkAgency,
    #[msg("A CCC role requires a registered agency index.")]
    CccRoleRequiresAgency,
    #[msg("CCC agency index is not registered.")]
    InvalidAgencyIndex,
    #[msg("Position principal must be greater than zero.")]
    ZeroPrincipal,
    #[msg("Position signer does not match its certified wallet.")]
    WrongPositionOwner,
    #[msg("Position is already closed.")]
    PositionClosed,
    #[msg("A settlement cannot execute before its policy week.")]
    FutureSettlementForbidden,
    #[msg("The requested week is outside the position term.")]
    RoundOutsidePositionTerm,
    #[msg("This position week was already settled.")]
    PositionWeekAlreadySettled,
    #[msg("Standard positions must omit the CCC round account.")]
    StandardRoundMustBeOmitted,
    #[msg("CCC positions require the settled round for that week.")]
    CccRoundRequired,
    #[msg("Round belongs to a different configuration.")]
    WrongRoundConfig,
    #[msg("CCC round has not been settled.")]
    RoundNotSettled,
    #[msg("Position agency was not part of the round snapshot.")]
    AgencyNotInRoundSnapshot,
    #[msg("Core reward term is complete.")]
    CoreRewardTermComplete,
    #[msg("This core reward week was already settled.")]
    CoreWeekAlreadySettled,
    #[msg("Reservation state does not reconcile with the lane ledger.")]
    ReservationLedgerMismatch,
    #[msg("Reward payment exceeds the position's reserved obligation.")]
    PaymentExceedsReservation,
    #[msg("No unreserved vested principal is currently claimable.")]
    NothingVestedToClaim,
    #[msg("Position principal was already returned.")]
    PrincipalAlreadyReturned,
    #[msg("Position has not reached the end of its 52-week term.")]
    PositionTermNotComplete,
    #[msg("Position principal must be returned before final close.")]
    PrincipalNotReturned,
    #[msg("Every position week must be settled before residual reservation is released.")]
    PositionWeeksOutstanding,
    #[msg("Randomness account is owned by the wrong program.")]
    WrongRandomnessProgram,
    #[msg("Clock is before the configured Genesis timestamp.")]
    InvalidClock,
    #[msg("Round index does not equal the current 24-hour-delayed CCC cadence.")]
    WrongRoundWeek,
    #[msg("The first CCC selection opens 24 hours after Genesis; later rounds advance every seven days.")]
    CccSelectionNotOpen,
    #[msg("This CCC round was already settled; rerolls are forbidden.")]
    RoundAlreadySettled,
    #[msg("The Switchboard randomness account failed discriminator or size validation.")]
    InvalidRandomnessAccount,
    #[msg(
        "The Switchboard randomness seed is not the fresh prior-slot seed for this atomic commit."
    )]
    RandomnessCommitNotFresh,
    #[msg(
        "The Switchboard commit must immediately precede this instruction in the same transaction."
    )]
    RandomnessCommitInstructionMissing,
    #[msg("The preceding instruction is not the exact Switchboard randomness commit for this account and signer.")]
    InvalidRandomnessCommitInstruction,
    #[msg("The Switchboard reveal is not fresh in the current settlement slot.")]
    RandomnessNotFresh,
    #[msg("The Switchboard seed slot does not match the committed round slot.")]
    RandomnessCommitSlotMismatch,
    #[msg("The Switchboard reveal slot must be after its seed slot.")]
    RandomnessRevealNotAfterCommit,
    #[msg("The bounded deterministic rejection sampler did not produce an accepted sample.")]
    TiebreakDerivationExhausted,
}

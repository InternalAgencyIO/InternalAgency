#![cfg_attr(not(test), no_std)]

use sha2::{Digest, Sha256};

pub const IAT_PROTOCOL_OFFSET_SECONDS: i128 = 10_800;
pub const SECONDS_PER_DAY: i128 = 86_400;
pub const FRIDAY_LOCAL_DAY_MODULUS: i128 = 1;
pub const DRAW_DENOMINATOR: u16 = 10_000;
pub const NORMAL_DAY_LOCKDOWN_NUMERATOR: u16 = 100;
pub const FRIDAY_LOCKDOWN_NUMERATOR: u16 = 6_667;
pub const DAILY_LOCKDOWN_LAW_ID: &[u8] = b"IAT_B3_DAILY_LOCKDOWN_LAW_V1";
pub const SOLANA_DAILY_LAW_ID: &[u8] = b"IAT_B3_SOLANA_DAILY_LAW_V1";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LawError {
    ArithmeticOverflow,
    DecisionNotAfterGenesis,
    HeightPredatesGenesis,
    InvalidBlockPeriod,
    InvalidDecision,
    InvalidNetworkId,
    UserTransactionsForbidden,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ImmutableSchedule<'a> {
    pub genesis_height: u64,
    pub genesis_nominal_unix_seconds: i64,
    pub nominal_block_seconds: u64,
    pub network_id: &'a str,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DailyWindow {
    pub local_day: i64,
    pub is_friday: bool,
    pub decision_height: u64,
    pub opens_at_height: u64,
    pub closes_at_height: u64,
    pub decision_at_nominal_unix_seconds: i128,
    pub closes_at_nominal_unix_seconds: i128,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LockdownDraw {
    pub counter: u64,
    pub bucket: u16,
    pub chance_numerator: u16,
    pub chance_denominator: u16,
    pub locked: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LockdownDecision {
    pub local_day: i64,
    pub is_friday: bool,
    pub decision_height: u64,
    pub randomness_output: [u8; 32],
    pub draw_counter: u64,
    pub draw_bucket: u16,
    pub chance_numerator: u16,
    pub chance_denominator: u16,
    pub locked: bool,
}

/// Persistent result recorded by the permissionless Solana `finalize_day`
/// instruction. The slot-selection rule and SlotHashes access live in the
/// onchain adapter; this kernel binds the selected ancestor hash to the day,
/// host-chain identity, vIAT receipt mint, and entropy slot.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SolanaDailyDecision {
    pub local_day: i64,
    pub entropy_slot: u64,
    pub ancestor_slot_hash: [u8; 32],
    pub draw_counter: u64,
    pub draw_bucket: u16,
    pub chance_numerator: u16,
    pub chance_denominator: u16,
    pub locked: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VaultTransferDisposition {
    Allowed,
    DayUnfinalized,
    RejectedDailyLockdown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OperationKind {
    UserTransaction,
    ConsensusHousekeeping,
    Query,
    Simulation,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OperationDisposition {
    Allowed,
    NonBindingSimulation,
    RejectedDailyLockdown,
}

const fn floor_div(dividend: i128, divisor: i128) -> i128 {
    let quotient = dividend / divisor;
    let remainder = dividend % divisor;
    if remainder < 0 {
        quotient - 1
    } else {
        quotient
    }
}

const fn ceil_div(dividend: i128, divisor: i128) -> i128 {
    -floor_div(-dividend, divisor)
}

const fn floor_mod(dividend: i128, divisor: i128) -> i128 {
    let remainder = dividend % divisor;
    if remainder < 0 {
        remainder + divisor
    } else {
        remainder
    }
}

pub const fn protocol_local_day(nominal_unix_seconds: i64) -> i64 {
    floor_div(
        nominal_unix_seconds as i128 + IAT_PROTOCOL_OFFSET_SECONDS,
        SECONDS_PER_DAY,
    ) as i64
}

pub const fn is_friday_local_day(local_day: i64) -> bool {
    floor_mod(local_day as i128, 7) == FRIDAY_LOCAL_DAY_MODULUS
}

pub const fn lockdown_chance_numerator(local_day: i64) -> u16 {
    if is_friday_local_day(local_day) {
        FRIDAY_LOCKDOWN_NUMERATOR
    } else {
        NORMAL_DAY_LOCKDOWN_NUMERATOR
    }
}

fn valid_network_id(network_id: &str) -> bool {
    let bytes = network_id.as_bytes();
    if bytes.is_empty()
        || bytes.len() > 128
        || !bytes[0].is_ascii_lowercase() && !bytes[0].is_ascii_digit()
    {
        return false;
    }
    bytes.iter().all(|byte| {
        byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(*byte, b'.' | b'_' | b'-')
    })
}

impl<'a> ImmutableSchedule<'a> {
    pub fn validate(self) -> Result<Self, LawError> {
        if self.nominal_block_seconds == 0 {
            return Err(LawError::InvalidBlockPeriod);
        }
        if !valid_network_id(self.network_id) {
            return Err(LawError::InvalidNetworkId);
        }
        Ok(self)
    }

    pub fn nominal_unix_seconds_at_height(self, height: u64) -> Result<i128, LawError> {
        self.validate()?;
        let height_delta = height
            .checked_sub(self.genesis_height)
            .ok_or(LawError::HeightPredatesGenesis)?;
        i128::from(self.genesis_nominal_unix_seconds)
            .checked_add(
                i128::from(height_delta)
                    .checked_mul(i128::from(self.nominal_block_seconds))
                    .ok_or(LawError::ArithmeticOverflow)?,
            )
            .ok_or(LawError::ArithmeticOverflow)
    }

    pub fn first_height_at_or_after(self, nominal_unix_seconds: i128) -> Result<u64, LawError> {
        self.validate()?;
        let delta = nominal_unix_seconds
            .checked_sub(i128::from(self.genesis_nominal_unix_seconds))
            .ok_or(LawError::ArithmeticOverflow)?;
        let height = i128::from(self.genesis_height)
            .checked_add(ceil_div(delta, i128::from(self.nominal_block_seconds)))
            .ok_or(LawError::ArithmeticOverflow)?;
        u64::try_from(height).map_err(|_| LawError::HeightPredatesGenesis)
    }

    pub fn daily_window(self, local_day: i64) -> Result<DailyWindow, LawError> {
        let decision_at_nominal_unix_seconds = i128::from(local_day)
            .checked_mul(SECONDS_PER_DAY)
            .and_then(|value| value.checked_sub(IAT_PROTOCOL_OFFSET_SECONDS))
            .ok_or(LawError::ArithmeticOverflow)?;
        let closes_at_nominal_unix_seconds = decision_at_nominal_unix_seconds
            .checked_add(SECONDS_PER_DAY)
            .ok_or(LawError::ArithmeticOverflow)?;
        let decision_height = self.first_height_at_or_after(decision_at_nominal_unix_seconds)?;
        if decision_height <= self.genesis_height {
            return Err(LawError::DecisionNotAfterGenesis);
        }
        let closes_at_height = self.first_height_at_or_after(closes_at_nominal_unix_seconds)?;
        Ok(DailyWindow {
            local_day,
            is_friday: is_friday_local_day(local_day),
            decision_height,
            opens_at_height: decision_height,
            closes_at_height,
            decision_at_nominal_unix_seconds,
            closes_at_nominal_unix_seconds,
        })
    }
}

struct DecimalI64 {
    bytes: [u8; 20],
    start: usize,
}

impl DecimalI64 {
    fn new(value: i64) -> Self {
        let mut decimal = Self {
            bytes: [0; 20],
            start: 20,
        };
        let negative = value < 0;
        let mut magnitude = value.unsigned_abs();
        loop {
            decimal.start -= 1;
            decimal.bytes[decimal.start] = b'0' + (magnitude % 10) as u8;
            magnitude /= 10;
            if magnitude == 0 {
                break;
            }
        }
        if negative {
            decimal.start -= 1;
            decimal.bytes[decimal.start] = b'-';
        }
        decimal
    }

    fn as_bytes(&self) -> &[u8] {
        &self.bytes[self.start..]
    }
}

fn two_to_256_mod(modulus: u16) -> u16 {
    let mut remainder = 1u32;
    for _ in 0..256 {
        remainder = (remainder * 2) % u32::from(modulus);
    }
    remainder as u16
}

fn sample_is_in_rejection_tail(sample: &[u8; 32], tail_size: u16) -> bool {
    if tail_size == 0 || sample[..28].iter().any(|byte| *byte != 0xff) {
        return false;
    }
    let low = u32::from_be_bytes([sample[28], sample[29], sample[30], sample[31]]);
    low >= 0u32.wrapping_sub(u32::from(tail_size))
}

fn sample_mod(sample: &[u8; 32], modulus: u16) -> u16 {
    let mut remainder = 0u32;
    for byte in sample {
        remainder = (remainder * 256 + u32::from(*byte)) % u32::from(modulus);
    }
    remainder as u16
}

/// Derive the immutable daily draw from a randomness output whose consensus
/// beacon proof has already been verified. Proof verification must happen in
/// the block-header validity path before this function is called.
pub fn derive_lockdown_draw(
    randomness_output: [u8; 32],
    local_day: i64,
    network_id: &str,
) -> Result<LockdownDraw, LawError> {
    if !valid_network_id(network_id) {
        return Err(LawError::InvalidNetworkId);
    }
    let day = DecimalI64::new(local_day);
    let rejection_tail = two_to_256_mod(DRAW_DENOMINATOR);
    let chance_numerator = lockdown_chance_numerator(local_day);

    for counter in 0..=u64::MAX {
        let mut hasher = Sha256::new();
        hasher.update(DAILY_LOCKDOWN_LAW_ID);
        hasher.update([0]);
        hasher.update(network_id.as_bytes());
        hasher.update([0]);
        hasher.update(day.as_bytes());
        hasher.update([0]);
        hasher.update(randomness_output);
        hasher.update(counter.to_be_bytes());
        let sample: [u8; 32] = hasher.finalize().into();
        if sample_is_in_rejection_tail(&sample, rejection_tail) {
            continue;
        }
        let bucket = sample_mod(&sample, DRAW_DENOMINATOR);
        return Ok(LockdownDraw {
            counter,
            bucket,
            chance_numerator,
            chance_denominator: DRAW_DENOMINATOR,
            locked: bucket < chance_numerator,
        });
    }
    Err(LawError::ArithmeticOverflow)
}

/// Derive the selected Solana-hosted profile's exact bucket mapping.
///
/// This function makes no claim that `ancestor_slot_hash` is an unbiased VRF.
/// It only guarantees deterministic domain separation, rejection sampling, and
/// exact thresholds for the supplied hash.
pub fn derive_solana_lockdown_draw(
    ancestor_slot_hash: [u8; 32],
    local_day: i64,
    entropy_slot: u64,
    solana_genesis_hash: [u8; 32],
    viat_mint: [u8; 32],
) -> Result<LockdownDraw, LawError> {
    let day = DecimalI64::new(local_day);
    let rejection_tail = two_to_256_mod(DRAW_DENOMINATOR);
    let chance_numerator = lockdown_chance_numerator(local_day);

    for counter in 0..=u64::MAX {
        let mut hasher = Sha256::new();
        hasher.update(SOLANA_DAILY_LAW_ID);
        hasher.update([0]);
        hasher.update(solana_genesis_hash);
        hasher.update([0]);
        hasher.update(viat_mint);
        hasher.update([0]);
        hasher.update(day.as_bytes());
        hasher.update([0]);
        hasher.update(entropy_slot.to_be_bytes());
        hasher.update([0]);
        hasher.update(ancestor_slot_hash);
        hasher.update(counter.to_be_bytes());
        let sample: [u8; 32] = hasher.finalize().into();
        if sample_is_in_rejection_tail(&sample, rejection_tail) {
            continue;
        }
        let bucket = sample_mod(&sample, DRAW_DENOMINATOR);
        return Ok(LockdownDraw {
            counter,
            bucket,
            chance_numerator,
            chance_denominator: DRAW_DENOMINATOR,
            locked: bucket < chance_numerator,
        });
    }
    Err(LawError::ArithmeticOverflow)
}

pub fn create_solana_daily_decision(
    local_day: i64,
    entropy_slot: u64,
    ancestor_slot_hash: [u8; 32],
    solana_genesis_hash: [u8; 32],
    viat_mint: [u8; 32],
) -> Result<SolanaDailyDecision, LawError> {
    let draw = derive_solana_lockdown_draw(
        ancestor_slot_hash,
        local_day,
        entropy_slot,
        solana_genesis_hash,
        viat_mint,
    )?;
    Ok(SolanaDailyDecision {
        local_day,
        entropy_slot,
        ancestor_slot_hash,
        draw_counter: draw.counter,
        draw_bucket: draw.bucket,
        chance_numerator: draw.chance_numerator,
        chance_denominator: draw.chance_denominator,
        locked: draw.locked,
    })
}

pub fn validate_solana_daily_decision(
    decision: SolanaDailyDecision,
    solana_genesis_hash: [u8; 32],
    viat_mint: [u8; 32],
) -> Result<(), LawError> {
    let expected = create_solana_daily_decision(
        decision.local_day,
        decision.entropy_slot,
        decision.ancestor_slot_hash,
        solana_genesis_hash,
        viat_mint,
    )?;
    if decision != expected {
        return Err(LawError::InvalidDecision);
    }
    Ok(())
}

/// Fail-closed movement gate for the optional Solana-hosted Privacy Vault.
/// Canonical IAT transfers outside the vault do not call this function.
pub fn vault_transfer_disposition(
    current_unix_seconds: i64,
    decision: Option<SolanaDailyDecision>,
    solana_genesis_hash: [u8; 32],
    viat_mint: [u8; 32],
) -> Result<VaultTransferDisposition, LawError> {
    let current_day = protocol_local_day(current_unix_seconds);
    let Some(decision) = decision else {
        return Ok(VaultTransferDisposition::DayUnfinalized);
    };
    validate_solana_daily_decision(decision, solana_genesis_hash, viat_mint)?;
    if decision.local_day != current_day {
        return Ok(VaultTransferDisposition::DayUnfinalized);
    }
    if decision.locked {
        return Ok(VaultTransferDisposition::RejectedDailyLockdown);
    }
    Ok(VaultTransferDisposition::Allowed)
}

pub fn create_lockdown_decision(
    local_day: i64,
    randomness_output: [u8; 32],
    schedule: ImmutableSchedule<'_>,
) -> Result<LockdownDecision, LawError> {
    let window = schedule.daily_window(local_day)?;
    let draw = derive_lockdown_draw(randomness_output, local_day, schedule.network_id)?;
    Ok(LockdownDecision {
        local_day,
        is_friday: window.is_friday,
        decision_height: window.decision_height,
        randomness_output,
        draw_counter: draw.counter,
        draw_bucket: draw.bucket,
        chance_numerator: draw.chance_numerator,
        chance_denominator: draw.chance_denominator,
        locked: draw.locked,
    })
}

pub fn validate_lockdown_decision(
    decision: LockdownDecision,
    schedule: ImmutableSchedule<'_>,
) -> Result<(), LawError> {
    let expected =
        create_lockdown_decision(decision.local_day, decision.randomness_output, schedule)?;
    if decision != expected {
        return Err(LawError::InvalidDecision);
    }
    Ok(())
}

pub fn is_daily_lockdown(
    height: u64,
    decision: LockdownDecision,
    schedule: ImmutableSchedule<'_>,
) -> Result<bool, LawError> {
    validate_lockdown_decision(decision, schedule)?;
    let window = schedule.daily_window(decision.local_day)?;
    Ok(decision.locked && height >= window.opens_at_height && height < window.closes_at_height)
}

pub fn operation_disposition(
    height: u64,
    decision: LockdownDecision,
    operation: OperationKind,
    schedule: ImmutableSchedule<'_>,
) -> Result<OperationDisposition, LawError> {
    if operation == OperationKind::UserTransaction && is_daily_lockdown(height, decision, schedule)?
    {
        return Ok(OperationDisposition::RejectedDailyLockdown);
    }
    if operation == OperationKind::Simulation {
        return Ok(OperationDisposition::NonBindingSimulation);
    }
    Ok(OperationDisposition::Allowed)
}

pub fn validate_block_user_transactions(
    height: u64,
    decision: LockdownDecision,
    user_transaction_count: u64,
    schedule: ImmutableSchedule<'_>,
) -> Result<(), LawError> {
    if user_transaction_count != 0 && is_daily_lockdown(height, decision, schedule)? {
        return Err(LawError::UserTransactionsForbidden);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCHEDULE: ImmutableSchedule<'static> = ImmutableSchedule {
        genesis_height: 0,
        genesis_nominal_unix_seconds: 1_786_049_940,
        nominal_block_seconds: 1,
        network_id: "iat-b3-testnet-1",
    };
    const FRIDAY_LOCAL_DAY: i64 = 20_672;
    const SATURDAY_LOCAL_DAY: i64 = 20_673;
    const SOLANA_GENESIS_HASH: [u8; 32] = [0x11; 32];
    const VIAT_MINT: [u8; 32] = [0x22; 32];

    #[test]
    fn schedule_matches_the_public_javascript_vectors() {
        assert_eq!(
            SCHEDULE.nominal_unix_seconds_at_height(60),
            Ok(1_786_050_000)
        );
        assert_eq!(
            SCHEDULE.daily_window(FRIDAY_LOCAL_DAY),
            Ok(DailyWindow {
                local_day: FRIDAY_LOCAL_DAY,
                is_friday: true,
                decision_height: 60,
                opens_at_height: 60,
                closes_at_height: 86_460,
                decision_at_nominal_unix_seconds: 1_786_050_000,
                closes_at_nominal_unix_seconds: 1_786_136_400,
            })
        );
    }

    #[test]
    fn friday_draw_matches_the_public_javascript_vector() {
        let mut randomness = [0u8; 32];
        randomness[31] = 1;
        assert_eq!(
            derive_lockdown_draw(randomness, FRIDAY_LOCAL_DAY, SCHEDULE.network_id),
            Ok(LockdownDraw {
                counter: 0,
                bucket: 2_128,
                chance_numerator: 6_667,
                chance_denominator: 10_000,
                locked: true,
            })
        );
        assert_eq!(
            derive_lockdown_draw([0; 32], FRIDAY_LOCAL_DAY, SCHEDULE.network_id)
                .unwrap()
                .bucket,
            8_358
        );
    }

    #[test]
    fn normal_day_draw_matches_the_public_javascript_vector() {
        let mut randomness = [0u8; 32];
        randomness[31] = 0x9d;
        assert_eq!(
            derive_lockdown_draw(randomness, SATURDAY_LOCAL_DAY, SCHEDULE.network_id),
            Ok(LockdownDraw {
                counter: 0,
                bucket: 59,
                chance_numerator: 100,
                chance_denominator: 10_000,
                locked: true,
            })
        );
        assert_eq!(
            derive_lockdown_draw([0; 32], SATURDAY_LOCAL_DAY, SCHEDULE.network_id)
                .unwrap()
                .bucket,
            7_986
        );
    }

    #[test]
    fn selected_decision_block_rejects_user_transactions_but_not_consensus() {
        let mut randomness = [0u8; 32];
        randomness[31] = 1;
        let decision = create_lockdown_decision(FRIDAY_LOCAL_DAY, randomness, SCHEDULE).unwrap();
        assert_eq!(
            validate_block_user_transactions(60, decision, 1, SCHEDULE),
            Err(LawError::UserTransactionsForbidden)
        );
        assert_eq!(
            operation_disposition(60, decision, OperationKind::ConsensusHousekeeping, SCHEDULE),
            Ok(OperationDisposition::Allowed)
        );
        assert_eq!(
            operation_disposition(60, decision, OperationKind::Query, SCHEDULE),
            Ok(OperationDisposition::Allowed)
        );
    }

    #[test]
    fn forged_decisions_fail_closed() {
        let mut randomness = [0u8; 32];
        randomness[31] = 1;
        let mut decision =
            create_lockdown_decision(FRIDAY_LOCAL_DAY, randomness, SCHEDULE).unwrap();
        decision.locked = false;
        assert_eq!(
            validate_lockdown_decision(decision, SCHEDULE),
            Err(LawError::InvalidDecision)
        );
        assert_eq!(
            is_daily_lockdown(60, decision, SCHEDULE),
            Err(LawError::InvalidDecision)
        );
    }

    #[test]
    fn consecutive_selected_days_have_no_forced_open_block() {
        let mut friday_randomness = [0u8; 32];
        friday_randomness[31] = 1;
        let friday =
            create_lockdown_decision(FRIDAY_LOCAL_DAY, friday_randomness, SCHEDULE).unwrap();
        let mut saturday_randomness = [0u8; 32];
        saturday_randomness[31] = 0x9d;
        let saturday =
            create_lockdown_decision(SATURDAY_LOCAL_DAY, saturday_randomness, SCHEDULE).unwrap();
        assert_eq!(is_daily_lockdown(86_460, friday, SCHEDULE), Ok(false));
        assert_eq!(is_daily_lockdown(86_460, saturday, SCHEDULE), Ok(true));
    }

    #[test]
    fn schedule_and_network_inputs_fail_closed() {
        assert_eq!(
            ImmutableSchedule {
                nominal_block_seconds: 0,
                ..SCHEDULE
            }
            .validate(),
            Err(LawError::InvalidBlockPeriod)
        );
        assert_eq!(
            ImmutableSchedule {
                network_id: "IAT B3",
                ..SCHEDULE
            }
            .validate(),
            Err(LawError::InvalidNetworkId)
        );
        assert_eq!(
            SCHEDULE.nominal_unix_seconds_at_height(0),
            Ok(1_786_049_940)
        );
        assert!(SCHEDULE.nominal_unix_seconds_at_height(u64::MAX).is_ok());
    }

    #[test]
    fn negative_local_day_encoding_is_stable() {
        let outcome = derive_lockdown_draw([0; 32], -1, SCHEDULE.network_id).unwrap();
        assert!(outcome.bucket < DRAW_DENOMINATOR);
        assert_eq!(floor_div(-1, SECONDS_PER_DAY), -1);
        assert_eq!(floor_mod(-1, 7), 6);
    }

    #[test]
    fn solana_profile_decision_is_domain_separated_and_reproducible() {
        let decision = create_solana_daily_decision(
            FRIDAY_LOCAL_DAY,
            42_424_242,
            [0x33; 32],
            SOLANA_GENESIS_HASH,
            VIAT_MINT,
        )
        .unwrap();
        assert_eq!(decision.chance_numerator, FRIDAY_LOCKDOWN_NUMERATOR);
        assert_eq!(decision.chance_denominator, DRAW_DENOMINATOR);
        assert!(decision.draw_bucket < DRAW_DENOMINATOR);
        assert_eq!(
            validate_solana_daily_decision(decision, SOLANA_GENESIS_HASH, VIAT_MINT),
            Ok(())
        );
        assert_eq!(
            validate_solana_daily_decision(decision, [0x44; 32], VIAT_MINT),
            Err(LawError::InvalidDecision)
        );
    }

    #[test]
    fn solana_profile_transfer_gate_fails_closed_for_missing_or_stale_day() {
        let friday_midnight_utc = 1_786_050_000;
        assert_eq!(
            vault_transfer_disposition(friday_midnight_utc, None, SOLANA_GENESIS_HASH, VIAT_MINT,),
            Ok(VaultTransferDisposition::DayUnfinalized)
        );

        let stale = create_solana_daily_decision(
            FRIDAY_LOCAL_DAY - 1,
            42_424_000,
            [0x55; 32],
            SOLANA_GENESIS_HASH,
            VIAT_MINT,
        )
        .unwrap();
        assert_eq!(
            vault_transfer_disposition(
                friday_midnight_utc,
                Some(stale),
                SOLANA_GENESIS_HASH,
                VIAT_MINT,
            ),
            Ok(VaultTransferDisposition::DayUnfinalized)
        );
    }

    #[test]
    fn solana_profile_transfer_gate_matches_the_recorded_result() {
        let friday_midnight_utc = 1_786_050_000;
        let decision = create_solana_daily_decision(
            FRIDAY_LOCAL_DAY,
            42_424_242,
            [0x33; 32],
            SOLANA_GENESIS_HASH,
            VIAT_MINT,
        )
        .unwrap();
        let expected = if decision.locked {
            VaultTransferDisposition::RejectedDailyLockdown
        } else {
            VaultTransferDisposition::Allowed
        };
        assert_eq!(
            vault_transfer_disposition(
                friday_midnight_utc,
                Some(decision),
                SOLANA_GENESIS_HASH,
                VIAT_MINT,
            ),
            Ok(expected)
        );
    }
}

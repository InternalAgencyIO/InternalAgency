pub const TOKEN_DECIMALS: u8 = 9;
pub const MAINNET_SUPPLY: u64 = 1_000_000_000_000_000_000;
pub const REHEARSAL_SUPPLY: u64 = 1_000_000_000_000;
pub const BPS_DENOMINATOR: u128 = 10_000;
pub const RATE_WEEKS: u128 = 52;
pub const SECONDS_PER_DAY: i64 = 86_400;
pub const SECONDS_PER_WEEK: i64 = 604_800;
pub const CCC_FIRST_SELECTION_DELAY_SECONDS: i64 = SECONDS_PER_DAY;
pub const CCC_REVEAL_TIMEOUT_SECONDS: i64 = SECONDS_PER_DAY;
pub const USER_TERM_WEEKS: u64 = 52;
pub const CORE_TERM_WEEKS: u64 = 104;
pub const CORE_RATE_BPS: u64 = 1_700;
pub const STANDARD_RATE_BPS: u64 = 1_000;
pub const CCC_AGENT_RATE_BPS: u64 = 2_800;
pub const CCC_ASSOCIATE_RATE_BPS: u64 = 2_000;
pub const TIEBREAK_DOMAIN: &[u8] = b"IAT_TIEBREAK_V1";
pub const TIEBREAK_MAX_DERIVATION_ATTEMPTS: u32 = 16;

pub const COMMUNITY: u8 = 0;
pub const TREASURY: u8 = 1;
pub const ECOSYSTEM: u8 = 2;
pub const CORE_TEAM: u8 = 3;
pub const LIQUIDITY: u8 = 4;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LanePolicy {
    pub total: u64,
    pub genesis_unlocked: u64,
    pub cliff_week: u64,
    pub linear_end_week: u64,
    pub reward_source: bool,
}

pub fn scale(mainnet_amount: u64, rehearsal: bool) -> Option<u64> {
    if rehearsal {
        mainnet_amount.checked_div(1_000_000)
    } else {
        Some(mainnet_amount)
    }
}

pub fn lane_policy(lane: u8, rehearsal: bool) -> Option<LanePolicy> {
    let mainnet = match lane {
        COMMUNITY => LanePolicy {
            total: 500_000_000_000_000_000,
            genesis_unlocked: 500_000_000_000_000_000,
            cliff_week: 0,
            linear_end_week: 0,
            reward_source: false,
        },
        TREASURY => LanePolicy {
            total: 200_000_000_000_000_000,
            genesis_unlocked: 50_000_000_000_000_000,
            cliff_week: 52,
            linear_end_week: 208,
            reward_source: true,
        },
        ECOSYSTEM => LanePolicy {
            total: 150_000_000_000_000_000,
            genesis_unlocked: 37_500_000_000_000_000,
            cliff_week: 26,
            linear_end_week: 104,
            reward_source: true,
        },
        CORE_TEAM => LanePolicy {
            total: 100_000_000_000_000_000,
            genesis_unlocked: 0,
            cliff_week: 26,
            linear_end_week: 104,
            reward_source: false,
        },
        LIQUIDITY => LanePolicy {
            total: 50_000_000_000_000_000,
            genesis_unlocked: 12_500_000_000_000_000,
            cliff_week: 26,
            linear_end_week: 104,
            reward_source: true,
        },
        _ => return None,
    };
    Some(LanePolicy {
        total: scale(mainnet.total, rehearsal)?,
        genesis_unlocked: scale(mainnet.genesis_unlocked, rehearsal)?,
        ..mainnet
    })
}

pub fn cumulative_unlocked(policy: LanePolicy, week: u64) -> Option<u64> {
    if policy.linear_end_week == 0 || week >= policy.linear_end_week {
        return Some(policy.total);
    }
    if week < policy.cliff_week {
        return Some(policy.genesis_unlocked);
    }
    let remainder = policy.total.checked_sub(policy.genesis_unlocked)? as u128;
    let elapsed = week.checked_sub(policy.cliff_week)? as u128;
    let duration = policy.linear_end_week.checked_sub(policy.cliff_week)? as u128;
    let released = remainder.checked_mul(elapsed)?.checked_div(duration)?;
    u64::try_from((policy.genesis_unlocked as u128).checked_add(released)?).ok()
}

pub fn maximum_reward(principal: u64, annual_rate_bps: u64, term_weeks: u64) -> Option<u64> {
    let numerator = (principal as u128)
        .checked_mul(annual_rate_bps as u128)?
        .checked_mul(term_weeks as u128)?;
    u64::try_from(numerator.checked_div(BPS_DENOMINATOR.checked_mul(RATE_WEEKS)?)?).ok()
}

pub fn reward_for_week(principal: u64, annual_rate_bps: u64, ordinal: u64) -> Option<u64> {
    let after = maximum_reward(principal, annual_rate_bps, ordinal.checked_add(1)?)?;
    let before = maximum_reward(principal, annual_rate_bps, ordinal)?;
    after.checked_sub(before)
}

pub fn current_week(genesis_timestamp: i64, now_timestamp: i64) -> Option<u64> {
    if now_timestamp < genesis_timestamp {
        return None;
    }
    u64::try_from(
        now_timestamp
            .checked_sub(genesis_timestamp)?
            .checked_div(SECONDS_PER_WEEK)?,
    )
    .ok()
}

pub fn current_ccc_round(genesis_timestamp: i64, now_timestamp: i64) -> Option<u64> {
    let first_selection = genesis_timestamp.checked_add(CCC_FIRST_SELECTION_DELAY_SECONDS)?;
    if now_timestamp < first_selection {
        return None;
    }
    u64::try_from(
        now_timestamp
            .checked_sub(first_selection)?
            .checked_div(SECONDS_PER_WEEK)?,
    )
    .ok()
}

pub fn ccc_round_recovery_available(commit_timestamp: i64, now_timestamp: i64) -> Option<bool> {
    let recovery_timestamp = commit_timestamp.checked_add(CCC_REVEAL_TIMEOUT_SECONDS)?;
    Some(now_timestamp >= recovery_timestamp)
}

/// Preserves the exact expected reward of a fair one-of-N weekly pause when
/// the committed oracle result is unavailable. This terminal fallback cannot
/// select a winner or supply a replacement random value, so it cannot reroll
/// the immutable candidate snapshot.
pub fn neutral_expired_round_reward(full_reward: u64, candidate_count: u32) -> Option<u64> {
    if candidate_count == 0 {
        return None;
    }
    let payable_candidates = u128::from(candidate_count.checked_sub(1)?);
    u64::try_from(
        u128::from(full_reward)
            .checked_mul(payable_candidates)?
            .checked_div(u128::from(candidate_count))?,
    )
    .ok()
}

pub fn position_maturity_week(accepted_week: u64, term_weeks: u64) -> Option<u64> {
    accepted_week.checked_add(term_weeks)
}

pub fn role_rate(role: u8) -> Option<u64> {
    match role {
        0 => Some(STANDARD_RATE_BPS),
        1 => Some(CCC_AGENT_RATE_BPS),
        2 => Some(CCC_ASSOCIATE_RATE_BPS),
        _ => None,
    }
}

pub fn selected_agency(randomness: [u8; 32], agency_count: u32) -> Option<u32> {
    if agency_count == 0 {
        return None;
    }
    let modulus = agency_count as u64;
    let mut remainder = 0u64;
    for byte in randomness {
        remainder = ((remainder as u128 * 256 + byte as u128) % modulus as u128) as u64;
    }
    u32::try_from(remainder).ok()
}

fn two_to_256_mod(modulus: u32) -> Option<u32> {
    if modulus == 0 {
        return None;
    }
    let mut remainder = 1u64;
    for _ in 0..256 {
        remainder = (remainder * 2) % modulus as u64;
    }
    u32::try_from(remainder).ok()
}

fn sample_is_in_rejection_tail(sample: &[u8; 32], tail_size: u32) -> bool {
    if tail_size == 0 || sample[..28].iter().any(|byte| *byte != 0xff) {
        return false;
    }
    let low = u32::from_be_bytes(sample[28..32].try_into().unwrap());
    low >= 0u32.wrapping_sub(tail_size)
}

/// Selects an exactly uniform index from a canonical, precommitted candidate
/// list using one oracle result. SHA-256 counter expansion supplies rejection
/// samples without requesting a second oracle roll. For u32-sized candidate
/// sets, a rejection is less likely than 2^-224 per attempt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TiebreakOutcome {
    pub index: u32,
    pub derivation_counter: u32,
}

pub fn uniform_tiebreak_outcome(
    oracle_randomness: [u8; 32],
    decision_context: [u8; 32],
    candidate_count: u32,
) -> Option<TiebreakOutcome> {
    if candidate_count == 0 {
        return None;
    }
    if candidate_count == 1 {
        return Some(TiebreakOutcome {
            index: 0,
            derivation_counter: 0,
        });
    }
    let rejection_tail = two_to_256_mod(candidate_count)?;
    for counter in 0..TIEBREAK_MAX_DERIVATION_ATTEMPTS {
        let counter_bytes = counter.to_be_bytes();
        let sample = hashv(&[
            TIEBREAK_DOMAIN,
            &decision_context,
            &oracle_randomness,
            &counter_bytes,
        ])
        .to_bytes();
        if !sample_is_in_rejection_tail(&sample, rejection_tail) {
            return selected_agency(sample, candidate_count).map(|index| TiebreakOutcome {
                index,
                derivation_counter: counter,
            });
        }
    }
    None
}

pub fn uniform_tiebreak_index(
    oracle_randomness: [u8; 32],
    decision_context: [u8; 32],
    candidate_count: u32,
) -> Option<u32> {
    uniform_tiebreak_outcome(oracle_randomness, decision_context, candidate_count)
        .map(|outcome| outcome.index)
}

pub fn append_agency_registry_hash(
    current_hash: [u8; 32],
    index: u32,
    owner: &[u8; 32],
) -> [u8; 32] {
    hashv(&[
        b"IAT_AGENCY_REGISTRY_V1".as_ref(),
        current_hash.as_ref(),
        index.to_le_bytes().as_ref(),
        owner.as_ref(),
    ])
    .to_bytes()
}

pub fn ccc_tiebreak_context(
    config: &[u8; 32],
    week: u64,
    agency_registry_hash: [u8; 32],
) -> [u8; 32] {
    hashv(&[
        b"IAT_CCC_WEEKLY_TIEBREAK_V1".as_ref(),
        config.as_ref(),
        week.to_le_bytes().as_ref(),
        agency_registry_hash.as_ref(),
    ])
    .to_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_core_reward_is_34m() {
        assert_eq!(
            maximum_reward(100_000_000_000_000_000, CORE_RATE_BPS, CORE_TERM_WEEKS),
            Some(34_000_000_000_000_000)
        );
    }

    #[test]
    fn reserve_schedules_match_reference_vectors() {
        assert_eq!(
            cumulative_unlocked(lane_policy(TREASURY, false).unwrap(), 0),
            Some(50_000_000_000_000_000)
        );
        assert_eq!(
            cumulative_unlocked(lane_policy(TREASURY, false).unwrap(), 130),
            Some(125_000_000_000_000_000)
        );
        assert_eq!(
            cumulative_unlocked(lane_policy(ECOSYSTEM, false).unwrap(), 65),
            Some(93_750_000_000_000_000)
        );
        assert_eq!(
            cumulative_unlocked(lane_policy(LIQUIDITY, false).unwrap(), 65),
            Some(31_250_000_000_000_000)
        );
    }

    #[test]
    fn selection_consumes_all_256_bits() {
        assert_eq!(selected_agency([0xff; 32], 11), Some(8));
        assert_eq!(selected_agency([0; 32], 11), Some(0));
    }

    #[test]
    fn one_roll_tiebreak_is_deterministic_and_handles_one_hundred_candidates() {
        let context = [0x42; 32];
        let randomness = [0xa5; 32];
        let first = uniform_tiebreak_index(randomness, context, 100).unwrap();
        let second = uniform_tiebreak_index(randomness, context, 100).unwrap();
        assert_eq!(first, second);
        assert_eq!(first, 1);
        assert_eq!(
            uniform_tiebreak_outcome(randomness, context, 100),
            Some(TiebreakOutcome {
                index: 1,
                derivation_counter: 0,
            })
        );
    }

    #[test]
    fn registry_hash_commits_order_and_owner() {
        let owner_a = [1u8; 32];
        let owner_b = [2u8; 32];
        let first = append_agency_registry_hash([0; 32], 0, &owner_a);
        assert_ne!(first, append_agency_registry_hash([0; 32], 0, &owner_b));
        assert_ne!(first, append_agency_registry_hash([0; 32], 1, &owner_a));
    }

    #[test]
    fn fifty_two_week_position_matures_after_its_final_accrual_week() {
        assert_eq!(position_maturity_week(0, USER_TERM_WEEKS), Some(52));
        assert_eq!(position_maturity_week(7, USER_TERM_WEEKS), Some(59));
        assert_eq!(position_maturity_week(u64::MAX, USER_TERM_WEEKS), None);
    }

    #[test]
    fn ccc_round_zero_opens_after_twenty_four_hours_then_advances_weekly() {
        let genesis = 1_900_000_000;
        assert_eq!(current_ccc_round(genesis, genesis), None);
        assert_eq!(
            current_ccc_round(genesis, genesis + CCC_FIRST_SELECTION_DELAY_SECONDS - 1),
            None
        );
        assert_eq!(
            current_ccc_round(genesis, genesis + CCC_FIRST_SELECTION_DELAY_SECONDS),
            Some(0)
        );
        assert_eq!(
            current_ccc_round(
                genesis,
                genesis + CCC_FIRST_SELECTION_DELAY_SECONDS + SECONDS_PER_WEEK - 1
            ),
            Some(0)
        );
        assert_eq!(
            current_ccc_round(
                genesis,
                genesis + CCC_FIRST_SELECTION_DELAY_SECONDS + SECONDS_PER_WEEK
            ),
            Some(1)
        );
    }

    #[test]
    fn ccc_reveal_recovery_flips_at_the_exact_timeout_without_overflow() {
        let committed_at = 1_900_000_000;
        assert_eq!(
            ccc_round_recovery_available(
                committed_at,
                committed_at + CCC_REVEAL_TIMEOUT_SECONDS - 1
            ),
            Some(false)
        );
        assert_eq!(
            ccc_round_recovery_available(committed_at, committed_at + CCC_REVEAL_TIMEOUT_SECONDS),
            Some(true)
        );
        assert_eq!(ccc_round_recovery_available(i64::MAX, i64::MAX), None);
    }

    #[test]
    fn expired_round_reward_is_the_floor_of_the_fair_expected_value() {
        assert_eq!(neutral_expired_round_reward(1_000, 1), Some(0));
        assert_eq!(neutral_expired_round_reward(1_001, 2), Some(500));
        assert_eq!(neutral_expired_round_reward(1_000, 100), Some(990));
        assert_eq!(neutral_expired_round_reward(1_000, 0), None);
        assert_eq!(
            neutral_expired_round_reward(u64::MAX, u32::MAX),
            Some(18_446_744_069_414_584_318)
        );
    }
}
use solana_sha256_hasher::hashv;

use iat_v2::policy::{
    cumulative_unlocked, current_ccc_round, current_week, lane_policy, position_maturity_week,
    CCC_FIRST_SELECTION_DELAY_SECONDS, CORE_TEAM, ECOSYSTEM, LIQUIDITY, SECONDS_PER_WEEK, TREASURY,
    USER_TERM_WEEKS,
};

const GENESIS: i64 = 1_900_000_000;

#[test]
fn virtual_clock_rejects_pre_genesis_and_flips_at_exact_week_boundaries() {
    assert_eq!(current_week(GENESIS, GENESIS - 1), None);
    assert_eq!(current_week(GENESIS, GENESIS), Some(0));
    assert_eq!(
        current_week(GENESIS, GENESIS + 52 * SECONDS_PER_WEEK - 1),
        Some(51)
    );
    assert_eq!(
        current_week(GENESIS, GENESIS + 52 * SECONDS_PER_WEEK),
        Some(52)
    );
    assert_eq!(
        current_week(GENESIS, GENESIS + 104 * SECONDS_PER_WEEK),
        Some(104)
    );
    assert_eq!(
        current_week(GENESIS, GENESIS + 208 * SECONDS_PER_WEEK),
        Some(208)
    );
}

#[test]
fn ccc_clock_flips_at_twenty_four_hours_and_then_weekly() {
    let first = GENESIS + CCC_FIRST_SELECTION_DELAY_SECONDS;
    assert_eq!(current_ccc_round(GENESIS, first - 1), None);
    assert_eq!(current_ccc_round(GENESIS, first), Some(0));
    assert_eq!(
        current_ccc_round(GENESIS, first + SECONDS_PER_WEEK - 1),
        Some(0)
    );
    assert_eq!(
        current_ccc_round(GENESIS, first + SECONDS_PER_WEEK),
        Some(1)
    );
}

#[test]
fn every_lane_holds_through_its_cliff_and_finishes_at_its_exact_end_week() {
    let cases = [
        (TREASURY, 51, 50_000_000_000_000_000),
        (TREASURY, 52, 50_000_000_000_000_000),
        (TREASURY, 53, 50_961_538_461_538_461),
        (TREASURY, 130, 125_000_000_000_000_000),
        (TREASURY, 207, 199_038_461_538_461_538),
        (TREASURY, 208, 200_000_000_000_000_000),
        (ECOSYSTEM, 25, 37_500_000_000_000_000),
        (ECOSYSTEM, 26, 37_500_000_000_000_000),
        (ECOSYSTEM, 27, 38_942_307_692_307_692),
        (ECOSYSTEM, 65, 93_750_000_000_000_000),
        (ECOSYSTEM, 103, 148_557_692_307_692_307),
        (ECOSYSTEM, 104, 150_000_000_000_000_000),
        (CORE_TEAM, 25, 0),
        (CORE_TEAM, 26, 0),
        (CORE_TEAM, 27, 1_282_051_282_051_282),
        (CORE_TEAM, 65, 50_000_000_000_000_000),
        (CORE_TEAM, 103, 98_717_948_717_948_717),
        (CORE_TEAM, 104, 100_000_000_000_000_000),
        (LIQUIDITY, 25, 12_500_000_000_000_000),
        (LIQUIDITY, 26, 12_500_000_000_000_000),
        (LIQUIDITY, 27, 12_980_769_230_769_230),
        (LIQUIDITY, 65, 31_250_000_000_000_000),
        (LIQUIDITY, 103, 49_519_230_769_230_769),
        (LIQUIDITY, 104, 50_000_000_000_000_000),
    ];

    for (lane, week, expected) in cases {
        let terms = lane_policy(lane, false).expect("known lane");
        assert_eq!(cumulative_unlocked(terms, week), Some(expected));
    }
}

#[test]
fn position_matures_on_the_same_policy_week_as_its_final_accrual() {
    let accepted_week = 7;
    let first_accrual_week = accepted_week + 1;
    let final_accrual_week = first_accrual_week + USER_TERM_WEEKS - 1;
    let maturity_week = position_maturity_week(accepted_week, USER_TERM_WEEKS).unwrap();

    assert_eq!(final_accrual_week, 59);
    assert_eq!(maturity_week, 59);
    assert!(58 < maturity_week);
    assert!(59 >= maturity_week);
}

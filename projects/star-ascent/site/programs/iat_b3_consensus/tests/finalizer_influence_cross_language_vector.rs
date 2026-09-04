use iat_b3_consensus::{create_solana_daily_decision, DRAW_DENOMINATOR, FRIDAY_LOCKDOWN_NUMERATOR};

#[test]
fn javascript_finalizer_influence_measurement_vector_matches_rust() {
    let decision =
        create_solana_daily_decision(20_672, 42_424_242, [0x33; 32], [0x11; 32], [0x22; 32])
            .unwrap();
    assert_eq!(decision.draw_counter, 0);
    assert_eq!(decision.draw_bucket, 151);
    assert_eq!(decision.chance_numerator, FRIDAY_LOCKDOWN_NUMERATOR);
    assert_eq!(decision.chance_denominator, DRAW_DENOMINATOR);
    assert!(decision.locked);
}

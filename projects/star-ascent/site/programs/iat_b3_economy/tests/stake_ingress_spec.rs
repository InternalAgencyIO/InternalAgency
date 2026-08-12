#![allow(dead_code)]

use iat_b3_consensus::{create_solana_daily_decision, protocol_local_day, SolanaDailyDecision};
use iat_b3_economy::stake_ingress::*;
use iat_b3_economy::{
    prepare_open_position, verify_daily_law_open, CanonicalDailyLawBinding, ConfigState,
    EconomyError, EligibilityState, LaneState, PrepareOpenPositionInput, ReadonlyDailyLawAccount,
    ReadonlyTokenState, ValidatedDailyLawWrite, ECOSYSTEM, LAW_STATE_LEN, LAW_STATE_MAGIC,
    LAW_STATE_VERSION, LIQUIDITY, TOKEN_DECIMALS, TREASURY,
};

const LAW_PROGRAM: [u8; 32] = [0xB3; 32];
const LAW_STATE: [u8; 32] = [0x51; 32];
const LAW_BUMP: u8 = 254;
const MINT: [u8; 32] = [0x22; 32];
const NETWORK: [u8; 32] = [0x11; 32];
const TOKEN_PROGRAM: [u8; 32] = [0x20; 32];
const CONFIG: [u8; 32] = [0xC0; 32];
const OWNER: [u8; 32] = [0xA1; 32];
const OWNER_TOKENS: [u8; 32] = [0xA2; 32];
const STAKE_TOKENS: [u8; 32] = [0xA3; 32];
const VAULT_AUTHORITY: [u8; 32] = [0xA4; 32];
const INGRESS_AUTHORITY: [u8; 32] = [0xA5; 32];
const HOOK_VALIDATION: [u8; 32] = [0xA6; 32];
const ORIGINAL_DELEGATE: [u8; 32] = [0xA7; 32];
const CLOCK_TIMESTAMP: i64 = 1_786_050_060;
const PRINCIPAL: u64 = 500;
const STAKED_BEFORE: u64 = 1_000;
const SOURCE_BEFORE: u64 = 4_000;

fn open_gate() -> ValidatedDailyLawWrite {
    let decision = decision_for(CLOCK_TIMESTAMP, false);
    let data = pack_law_state(Some(decision));
    verify_daily_law_open(
        &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
        ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &data),
        CLOCK_TIMESTAMP,
    )
    .unwrap()
}

fn decision_for(timestamp: i64, locked: bool) -> SolanaDailyDecision {
    let local_day = protocol_local_day(timestamp);
    for candidate in 0u16..=u8::MAX.into() {
        let mut hash = [0u8; 32];
        hash[31] = candidate as u8;
        let decision =
            create_solana_daily_decision(local_day, 42_424_242, hash, NETWORK, MINT).unwrap();
        if decision.locked == locked {
            return decision;
        }
    }
    panic!("test vector search did not find requested disposition")
}

fn pack_law_state(decision: Option<SolanaDailyDecision>) -> [u8; LAW_STATE_LEN] {
    let mut data = [0u8; LAW_STATE_LEN];
    data[0..8].copy_from_slice(LAW_STATE_MAGIC);
    data[8] = LAW_STATE_VERSION;
    data[9] = LAW_BUMP;
    data[16..48].copy_from_slice(&MINT);
    data[48..80].copy_from_slice(&NETWORK);
    if let Some(decision) = decision {
        data[10] = 1;
        data[11] = u8::from(decision.locked);
        data[80..88].copy_from_slice(&decision.local_day.to_le_bytes());
        data[88..96].copy_from_slice(&decision.entropy_slot.to_le_bytes());
        data[96..128].copy_from_slice(&decision.ancestor_slot_hash);
        data[128..136].copy_from_slice(&decision.draw_counter.to_le_bytes());
        data[136..138].copy_from_slice(&decision.draw_bucket.to_le_bytes());
        data[138..140].copy_from_slice(&decision.chance_numerator.to_le_bytes());
        data[140..142].copy_from_slice(&decision.chance_denominator.to_le_bytes());
    }
    data
}

fn lane(lane: u8, amount: u64) -> LaneState {
    LaneState {
        config: CONFIG,
        token_account: [lane; 32],
        beneficiary: [lane.wrapping_add(1); 32],
        total: amount,
        genesis_unlocked: amount,
        cliff_week: 0,
        linear_end_week: 1,
        reserved: 0,
        paid: 0,
        principal_claimed: 0,
        lane,
        reward_source: true,
        bump: lane,
        token_bump: lane.wrapping_add(1),
    }
}

fn config() -> ConfigState {
    ConfigState {
        admin: [0x10; 32],
        mint: MINT,
        token_program: TOKEN_PROGRAM,
        randomness_program: [0x30; 32],
        stake_token_account: STAKE_TOKENS,
        agency_registry_hash: [0x40; 32],
        genesis_timestamp: CLOCK_TIMESTAMP - 604_800,
        expected_supply: 1_000_000_000,
        staked_principal: STAKED_BEFORE,
        agency_count: 0,
        rehearsal_mode: true,
        active: true,
        lane_mask: 0b1_1110,
        stake_vault_initialized: true,
        bump: 200,
        vault_authority_bump: 201,
    }
}

fn retained_open_input() -> PrepareOpenPositionInput {
    PrepareOpenPositionInput {
        config_key: CONFIG,
        config: config(),
        owner: OWNER,
        mint: MINT,
        owner_tokens: ReadonlyTokenState {
            key: OWNER_TOKENS,
            mint: MINT,
            owner: OWNER,
            amount: SOURCE_BEFORE,
        },
        vault_authority: VAULT_AUTHORITY,
        stake_tokens: ReadonlyTokenState {
            key: STAKE_TOKENS,
            mint: MINT,
            owner: VAULT_AUTHORITY,
            amount: STAKED_BEFORE,
        },
        eligibility: EligibilityState {
            config: CONFIG,
            wallet: OWNER,
            agency_index: u32::MAX,
            role: 0,
            bump: 202,
        },
        treasury: lane(TREASURY, 1_000_000),
        ecosystem: lane(ECOSYSTEM, 1_000_000),
        liquidity: lane(LIQUIDITY, 1_000_000),
        position_id: 77,
        principal: PRINCIPAL,
        position_bump: 203,
    }
}

fn retained_open_plan(gate: &ValidatedDailyLawWrite) -> iat_b3_economy::OpenPositionPreCpiPlan {
    prepare_open_position(gate, retained_open_input()).unwrap()
}

fn source(delegate: DelegateSnapshot) -> SourceTokenState {
    SourceTokenState {
        token: ReadonlyTokenState {
            key: OWNER_TOKENS,
            mint: MINT,
            owner: OWNER,
            amount: SOURCE_BEFORE,
        },
        delegate,
        cpi_guard_locked: false,
    }
}

fn prepare_input(delegate: DelegateSnapshot) -> PrepareStakeIngressInput {
    PrepareStakeIngressInput {
        owner_is_signer: true,
        canonical_ingress_authority: INGRESS_AUTHORITY,
        ingress: IngressPdaBinding {
            key: INGRESS_AUTHORITY,
        },
        hook_validation_address: HOOK_VALIDATION,
        source_before: source(delegate),
        stake_before: ReadonlyTokenState {
            key: STAKE_TOKENS,
            mint: MINT,
            owner: VAULT_AUTHORITY,
            amount: STAKED_BEFORE,
        },
    }
}

fn successful_approval_observation(
    plan: &StakeIngressExecutionPlan,
) -> StakeIngressApprovalObservation {
    let mut source_after = plan.source_before;
    source_after.delegate = DelegateSnapshot {
        delegate: Some(plan.approve_ingress.delegate),
        delegated_amount: plan.approve_ingress.amount,
    };
    StakeIngressApprovalObservation {
        source_after_approval: source_after,
        stake_after_approval: plan.stake_before,
    }
}

fn successfully_approved(plan: StakeIngressExecutionPlan) -> ApprovedStakeIngressPlan {
    verify_ingress_approval(plan, successful_approval_observation(&plan)).unwrap()
}

fn successful_transfer_observation(
    approved: &ApprovedStakeIngressPlan,
) -> StakeIngressTransferObservation {
    let mut source_after = approved.source_after_approval;
    source_after.token.amount -= approved.execution.open_position.principal;
    source_after.delegate = DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    };
    let mut stake_after = approved.stake_after_approval;
    stake_after.amount += approved.execution.open_position.principal;
    StakeIngressTransferObservation {
        source_after_transfer: source_after,
        stake_after_transfer: stake_after,
    }
}

fn successful_restoration_observation(
    post: &StakeIngressPostCpiPlan,
) -> StakeIngressRestorationObservation {
    let mut source_after = post.source_after_transfer;
    source_after.delegate = post.original_delegate;
    StakeIngressRestorationObservation {
        source_after_restoration: source_after,
        stake_after_restoration: post.stake_after_transfer,
    }
}

#[test]
fn frozen_sequence_keeps_daily_law_and_v2_order_explicit() {
    assert_eq!(STAKE_INGRESS_SEED, b"stake-ingress");
    assert_eq!(
        STAKE_INGRESS_EXECUTION_ORDER,
        [
            "capture_source_delegate",
            "owner_signed_approve_checked_cpi",
            "reload_and_verify_exact_ingress_approval",
            "ingress_pda_transfer_checked_with_hook_accounts",
            "reload_and_verify_exact_balance_delta",
            "retained_v2_checked_add_staked_principal",
            "retained_v2_construct_position",
            "owner_signed_restore_delegate_cpi_if_needed",
            "reload_and_verify_exact_delegate_restoration",
            "persist_all_transaction_local_state",
        ]
    );

    let locked = pack_law_state(Some(decision_for(CLOCK_TIMESTAMP, true)));
    assert_eq!(
        verify_daily_law_open(
            &CanonicalDailyLawBinding::new(LAW_PROGRAM, LAW_STATE, LAW_BUMP, MINT, NETWORK),
            ReadonlyDailyLawAccount::new(LAW_STATE, LAW_PROGRAM, false, &locked),
            CLOCK_TIMESTAMP,
        ),
        Err(EconomyError::DailyLockdown)
    );
}

#[test]
fn combined_boundary_runs_retained_v2_preflight_before_ingress_and_matches_the_phases() {
    let gate = open_gate();
    let ingress = prepare_input(DelegateSnapshot {
        delegate: Some(ORIGINAL_DELEGATE),
        delegated_amount: 777,
    });
    let combined = prepare_open_position_stake_ingress(&gate, retained_open_input(), ingress)
        .expect("open Daily Law and exact retained inputs must compose");
    let phased = prepare_stake_ingress(&gate, retained_open_plan(&gate), ingress).unwrap();
    assert_eq!(combined, phased);

    let mut invalid_open = retained_open_input();
    invalid_open.principal = 0;
    let mut invalid_ingress = ingress;
    invalid_ingress.owner_is_signer = false;
    assert_eq!(
        prepare_open_position_stake_ingress(&gate, invalid_open, invalid_ingress),
        Err(StakeIngressSpecError::RetainedV2(
            EconomyError::ZeroPrincipal
        ))
    );
}

#[test]
fn no_prior_delegate_plans_exact_approve_and_hooked_ingress_transfer() {
    let gate = open_gate();
    let open = retained_open_plan(&gate);
    let plan = prepare_stake_ingress(
        &gate,
        open,
        prepare_input(DelegateSnapshot {
            delegate: None,
            delegated_amount: 0,
        }),
    )
    .unwrap();

    assert_eq!(
        plan.approve_ingress,
        ApproveCheckedIntent {
            token_program: TOKEN_PROGRAM,
            source: OWNER_TOKENS,
            mint: MINT,
            delegate: INGRESS_AUTHORITY,
            owner: OWNER,
            amount: PRINCIPAL,
            decimals: TOKEN_DECIMALS,
            owner_signature_required: true,
        }
    );
    assert_eq!(plan.transfer.transfer.authority, INGRESS_AUTHORITY);
    assert_eq!(plan.transfer.transfer.amount, PRINCIPAL);
    assert_eq!(plan.transfer.hook_validation_address, HOOK_VALIDATION);
    assert_eq!(plan.transfer.law_state_address, LAW_STATE);
    assert!(plan.transfer.token_cpi_uses_ingress_invoke_signed);
    assert!(!plan.transfer.hook_execute_authority_is_signer);
    assert!(plan.transfer.add_extra_accounts_for_execute_cpi_required);
    assert_eq!(
        plan.restore_delegate,
        DelegateRestorationIntent::NoneRequired
    );
}

#[test]
fn prior_delegate_and_allowance_are_restored_exactly_after_v2_finalizer() {
    let gate = open_gate();
    let original = DelegateSnapshot {
        delegate: Some(ORIGINAL_DELEGATE),
        delegated_amount: 777,
    };
    let plan =
        prepare_stake_ingress(&gate, retained_open_plan(&gate), prepare_input(original)).unwrap();
    assert_eq!(
        plan.restore_delegate,
        DelegateRestorationIntent::ApproveChecked(ApproveCheckedIntent {
            token_program: TOKEN_PROGRAM,
            source: OWNER_TOKENS,
            mint: MINT,
            delegate: ORIGINAL_DELEGATE,
            owner: OWNER,
            amount: 777,
            decimals: TOKEN_DECIMALS,
            owner_signature_required: true,
        })
    );

    let approved = successfully_approved(plan);
    let transfer = successful_transfer_observation(&approved);
    let post = apply_transfer_and_retained_v2_finalizer(approved, transfer).unwrap();
    assert_eq!(post.config.staked_principal, STAKED_BEFORE + PRINCIPAL);
    assert_eq!(post.position.config, CONFIG);
    assert_eq!(post.position.owner, OWNER);
    assert_eq!(post.position.position_id, 77);
    assert_eq!(post.position.principal, PRINCIPAL);
    assert_eq!(
        post.position.first_accrual_week,
        post.position.accepted_week + 1
    );
    assert_eq!(post.position.term_weeks, 52);
    assert_eq!(post.position.paid, 0);
    assert_eq!(post.position.settled_mask, 0);
    assert!(!post.position.principal_returned);
    assert!(!post.position.closed);

    let restored = successful_restoration_observation(&post);
    let completed = complete_stake_ingress(post, restored).unwrap();
    assert_eq!(completed.source.delegate, original);
    assert_eq!(completed.source.token.amount, SOURCE_BEFORE - PRINCIPAL);
    assert_eq!(completed.stake.amount, STAKED_BEFORE + PRINCIPAL);
}

#[test]
fn zero_allowance_existing_delegate_is_not_collapsed_to_none() {
    let gate = open_gate();
    let original = DelegateSnapshot {
        delegate: Some(ORIGINAL_DELEGATE),
        delegated_amount: 0,
    };
    let plan =
        prepare_stake_ingress(&gate, retained_open_plan(&gate), prepare_input(original)).unwrap();
    assert!(matches!(
        plan.restore_delegate,
        DelegateRestorationIntent::ApproveChecked(ApproveCheckedIntent { amount: 0, .. })
    ));
    let approved = successfully_approved(plan);
    let transfer = successful_transfer_observation(&approved);
    let post = apply_transfer_and_retained_v2_finalizer(approved, transfer).unwrap();
    let restored = successful_restoration_observation(&post);
    assert_eq!(
        complete_stake_ingress(post, restored)
            .unwrap()
            .source
            .delegate,
        original
    );
}

#[test]
fn cpi_guard_and_wrong_ingress_key_fail_closed_before_any_plan() {
    let gate = open_gate();
    let open = retained_open_plan(&gate);
    let mut guarded = prepare_input(DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    });
    guarded.source_before.cpi_guard_locked = true;
    assert_eq!(
        prepare_stake_ingress(&gate, open, guarded),
        Err(StakeIngressSpecError::CpiGuardBlocksAtomicApproval)
    );

    let mut wrong_pda = prepare_input(DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    });
    wrong_pda.ingress.key = [0xFF; 32];
    assert_eq!(
        prepare_stake_ingress(&gate, open, wrong_pda),
        Err(StakeIngressSpecError::NonCanonicalIngressAuthority)
    );
}

#[test]
fn ingress_has_no_griefable_account_state_admission_rule() {
    let model = include_str!("../src/stake_ingress.rs");
    assert!(!model.contains("pub lamports:"));
    assert!(!model.contains("pub data_len:"));
    assert!(!model.contains("pub executable:"));
    assert!(!model.contains("IngressPdaMustBeEmpty"));
}

#[test]
fn owner_signature_and_canonical_delegate_pair_are_mandatory() {
    let gate = open_gate();
    let open = retained_open_plan(&gate);
    let mut unsigned = prepare_input(DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    });
    unsigned.owner_is_signer = false;
    assert_eq!(
        prepare_stake_ingress(&gate, open, unsigned),
        Err(StakeIngressSpecError::MissingOwnerSignature)
    );

    let malformed = prepare_input(DelegateSnapshot {
        delegate: None,
        delegated_amount: 1,
    });
    assert_eq!(
        prepare_stake_ingress(&gate, open, malformed),
        Err(StakeIngressSpecError::NonCanonicalDelegateState)
    );
}

#[test]
fn approval_reload_requires_exact_ingress_delegate_and_preserves_balances() {
    let gate = open_gate();
    let plan = prepare_stake_ingress(
        &gate,
        retained_open_plan(&gate),
        prepare_input(DelegateSnapshot {
            delegate: Some(ORIGINAL_DELEGATE),
            delegated_amount: 777,
        }),
    )
    .unwrap();

    let mut wrong_allowance = successful_approval_observation(&plan);
    wrong_allowance
        .source_after_approval
        .delegate
        .delegated_amount -= 1;
    assert_eq!(
        verify_ingress_approval(plan, wrong_allowance),
        Err(StakeIngressSpecError::IngressApprovalMismatch)
    );

    let mut changed_balance = successful_approval_observation(&plan);
    changed_balance.source_after_approval.token.amount -= 1;
    assert_eq!(
        verify_ingress_approval(plan, changed_balance),
        Err(StakeIngressSpecError::IngressApprovalMismatch)
    );
}

#[test]
fn exact_reload_rejects_fee_like_credit_donation_and_residual_ingress_delegate() {
    let gate = open_gate();
    let plan = prepare_stake_ingress(
        &gate,
        retained_open_plan(&gate),
        prepare_input(DelegateSnapshot {
            delegate: None,
            delegated_amount: 0,
        }),
    )
    .unwrap();

    let approved = successfully_approved(plan);
    let mut fee_like = successful_transfer_observation(&approved);
    fee_like.stake_after_transfer.amount -= 1;
    assert_eq!(
        apply_transfer_and_retained_v2_finalizer(approved, fee_like),
        Err(StakeIngressSpecError::StakeBalanceDeltaMismatch)
    );

    let mut donation = successful_transfer_observation(&approved);
    donation.stake_after_transfer.amount += 1;
    assert_eq!(
        apply_transfer_and_retained_v2_finalizer(approved, donation),
        Err(StakeIngressSpecError::StakeBalanceDeltaMismatch)
    );

    let mut residual = successful_transfer_observation(&approved);
    residual.source_after_transfer.delegate = DelegateSnapshot {
        delegate: Some(INGRESS_AUTHORITY),
        delegated_amount: 1,
    };
    assert_eq!(
        apply_transfer_and_retained_v2_finalizer(approved, residual),
        Err(StakeIngressSpecError::TransientDelegateNotConsumed)
    );
}

#[test]
fn insufficient_source_and_token_balance_overflow_stay_pre_v2_failures() {
    let gate = open_gate();
    let mut insufficient_input = prepare_input(DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    });
    insufficient_input.source_before.token.amount = PRINCIPAL - 1;
    let insufficient =
        prepare_stake_ingress(&gate, retained_open_plan(&gate), insufficient_input).unwrap();
    let approved_insufficient = successfully_approved(insufficient);
    let mut impossible_source = approved_insufficient.source_after_approval;
    impossible_source.token.amount = 0;
    impossible_source.delegate = DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    };
    assert_eq!(
        apply_transfer_and_retained_v2_finalizer(
            approved_insufficient,
            StakeIngressTransferObservation {
                source_after_transfer: impossible_source,
                stake_after_transfer: approved_insufficient.stake_after_approval,
            },
        ),
        Err(StakeIngressSpecError::InsufficientSourceBalance)
    );

    let mut overflow_open = retained_open_plan(&gate);
    overflow_open.config_snapshot.staked_principal = u64::MAX;
    let mut overflow_input = prepare_input(DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    });
    overflow_input.stake_before.amount = u64::MAX;
    let overflow = prepare_stake_ingress(&gate, overflow_open, overflow_input).unwrap();
    let approved_overflow = successfully_approved(overflow);
    let mut source_after = approved_overflow.source_after_approval;
    source_after.token.amount -= PRINCIPAL;
    source_after.delegate = DelegateSnapshot {
        delegate: None,
        delegated_amount: 0,
    };
    let impossible_observation = StakeIngressTransferObservation {
        source_after_transfer: source_after,
        stake_after_transfer: approved_overflow.stake_after_approval,
    };
    assert_eq!(
        apply_transfer_and_retained_v2_finalizer(approved_overflow, impossible_observation),
        Err(StakeIngressSpecError::TokenBalanceOverflow)
    );
}

#[test]
fn first_accrual_overflow_occurs_only_after_a_successful_exact_transfer() {
    let gate = open_gate();
    let mut open = retained_open_plan(&gate);
    open.accepted_week = u64::MAX;
    let plan = prepare_stake_ingress(
        &gate,
        open,
        prepare_input(DelegateSnapshot {
            delegate: None,
            delegated_amount: 0,
        }),
    )
    .unwrap();
    let approved = successfully_approved(plan);
    let transfer = successful_transfer_observation(&approved);
    assert_eq!(
        apply_transfer_and_retained_v2_finalizer(approved, transfer),
        Err(StakeIngressSpecError::RetainedV2(
            EconomyError::ArithmeticOverflow
        ))
    );
}

#[test]
fn restoration_mismatch_never_yields_a_completed_result() {
    let gate = open_gate();
    let original = DelegateSnapshot {
        delegate: Some(ORIGINAL_DELEGATE),
        delegated_amount: 777,
    };
    let plan =
        prepare_stake_ingress(&gate, retained_open_plan(&gate), prepare_input(original)).unwrap();
    let approved = successfully_approved(plan);
    let transfer = successful_transfer_observation(&approved);
    let post = apply_transfer_and_retained_v2_finalizer(approved, transfer).unwrap();
    let mut wrong = successful_restoration_observation(&post);
    wrong.source_after_restoration.delegate.delegated_amount = 776;
    assert_eq!(
        complete_stake_ingress(post, wrong),
        Err(StakeIngressSpecError::DelegateRestorationMismatch)
    );
}

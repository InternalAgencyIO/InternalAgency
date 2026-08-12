use iat_b3_economy::{
    genesis_allocation_manifest_sha256, verify_genesis_allocation_conservation,
    GenesisAllocationEntry, GenesisAllocationManifest, GenesisAllocationRole,
    GenesisConservationError, GenesisConservationInput, GenesisConservationTruth,
    ObservedGenesisAllocation, ObservedGenesisMint, GENESIS_ALLOCATION_AMOUNTS,
    GENESIS_ALLOCATION_COUNT, GENESIS_ALLOCATION_ROLES, GENESIS_CONSERVATION_DOMAIN,
    GENESIS_CONSERVATION_STATUS, GENESIS_CONSERVATION_TRUTH, GENESIS_VESTING_TERMS, MAINNET_SUPPLY,
    TOKEN_DECIMALS,
};

fn identity(byte: u8) -> [u8; 32] {
    [byte; 32]
}

fn valid_input() -> GenesisConservationInput {
    let mint = identity(0x11);
    let token_program = identity(0x12);
    let entries = core::array::from_fn(|index| GenesisAllocationEntry {
        role: GENESIS_ALLOCATION_ROLES[index],
        token_account: identity(0x20 + index as u8),
        token_authority: identity(0x30 + index as u8),
        beneficiary: identity(0x40 + index as u8),
        amount: GENESIS_ALLOCATION_AMOUNTS[index],
        vesting: GENESIS_VESTING_TERMS[index],
    });
    let allocations = core::array::from_fn(|index| ObservedGenesisAllocation {
        role: entries[index].role,
        token_account: entries[index].token_account,
        token_program,
        mint,
        token_authority: entries[index].token_authority,
        beneficiary_binding: entries[index].beneficiary,
        amount: entries[index].amount,
        delegate: None,
        close_authority: None,
        delegated_amount: 0,
        frozen: false,
        native: false,
    });
    GenesisConservationInput {
        manifest: GenesisAllocationManifest {
            mint,
            token_program,
            entries,
        },
        mint: ObservedGenesisMint {
            key: mint,
            token_program,
            decimals: TOKEN_DECIMALS,
            supply: MAINNET_SUPPLY,
            mint_authority: None,
            freeze_authority: None,
        },
        allocations,
    }
}

#[test]
fn truth_is_structural_only_and_never_authorizes_genesis_or_mainnet() {
    assert_eq!(
        GENESIS_CONSERVATION_STATUS,
        "STRUCTURAL_ALLOCATION_AND_VESTING_CONSERVATION_VERIFIED_OWNER_AND_RUNTIME_EVIDENCE_REQUIRED_MAINNET_HOLD"
    );
    assert_eq!(
        GENESIS_CONSERVATION_DOMAIN,
        b"IAT_B3_GENESIS_CONSERVATION_V2"
    );
    assert_eq!(
        GENESIS_CONSERVATION_TRUTH,
        GenesisConservationTruth {
            fixed_supply_and_decimals_checked: true,
            exact_allocation_arithmetic_checked: true,
            exact_vesting_vectors_checked: true,
            distinct_destination_accounts_checked: true,
            distinct_beneficiaries_checked: true,
            terminal_base_mint_authorities_checked: true,
            owner_destination_manifest_accepted: false,
            production_identity_binding_frozen: false,
            runtime_account_authentication_present: false,
            migration_or_no_prior_supply_proved: false,
            transition_authorized: false,
            mainnet_hold: true,
        }
    );
}

#[test]
fn exact_five_lane_allocation_conserves_the_fixed_supply() {
    assert_eq!(GENESIS_ALLOCATION_COUNT, 5);
    assert_eq!(
        GENESIS_ALLOCATION_ROLES,
        [
            GenesisAllocationRole::Community,
            GenesisAllocationRole::Treasury,
            GenesisAllocationRole::Ecosystem,
            GenesisAllocationRole::CoreTeam,
            GenesisAllocationRole::Liquidity,
        ]
    );
    assert_eq!(
        GENESIS_ALLOCATION_AMOUNTS
            .iter()
            .copied()
            .try_fold(0u64, u64::checked_add),
        Some(MAINNET_SUPPLY)
    );

    let input = valid_input();
    let receipt = verify_genesis_allocation_conservation(&input).unwrap();
    assert_eq!(receipt.manifest_mint(), input.manifest.mint);
    assert_eq!(
        receipt.manifest_token_program(),
        input.manifest.token_program
    );
    assert_eq!(receipt.observed_supply(), MAINNET_SUPPLY);
    assert_eq!(receipt.observed_allocation_total(), MAINNET_SUPPLY);
    assert_ne!(receipt.manifest_sha256(), [0; 32]);
    assert_eq!(
        receipt,
        verify_genesis_allocation_conservation(&input).unwrap()
    );

    let mut other = valid_input();
    other.manifest.entries[0].token_account = identity(0x70);
    other.allocations[0].token_account = identity(0x70);
    assert_ne!(
        receipt.manifest_sha256(),
        verify_genesis_allocation_conservation(&other)
            .unwrap()
            .manifest_sha256()
    );

    let mut exact_vesting_other_destination = valid_input();
    exact_vesting_other_destination.manifest.entries[3].token_account = identity(0x71);
    exact_vesting_other_destination.allocations[3].token_account = identity(0x71);
    let exact_vesting_receipt =
        verify_genesis_allocation_conservation(&exact_vesting_other_destination).unwrap();
    assert_ne!(
        receipt.manifest_sha256(),
        exact_vesting_receipt.manifest_sha256()
    );
}

#[test]
fn every_ordered_amount_and_vesting_field_is_committed_and_fails_closed() {
    let base = valid_input();
    let canonical_commitment = genesis_allocation_manifest_sha256(&base.manifest);
    assert_eq!(
        canonical_commitment,
        [
            0x4b, 0xbc, 0xe8, 0xce, 0x49, 0x27, 0x97, 0x2f, 0x64, 0x61, 0x85, 0xb0, 0x98, 0x05,
            0x86, 0x91, 0x01, 0x3c, 0x2f, 0xbe, 0x31, 0x8e, 0xcd, 0x48, 0x06, 0xd9, 0x85, 0x59,
            0x3e, 0xc1, 0x7f, 0xe7,
        ]
    );
    assert_eq!(
        canonical_commitment,
        verify_genesis_allocation_conservation(&base)
            .unwrap()
            .manifest_sha256()
    );

    for index in 0..GENESIS_ALLOCATION_COUNT {
        let cases = [
            (
                "amount",
                {
                    let mut value = base;
                    value.manifest.entries[index].amount ^= 1;
                    value
                },
                GenesisConservationError::WrongAllocationAmount,
            ),
            (
                "genesis_unlocked",
                {
                    let mut value = base;
                    value.manifest.entries[index].vesting.genesis_unlocked ^= 1;
                    value
                },
                GenesisConservationError::WrongVestingVector,
            ),
            (
                "cliff_week",
                {
                    let mut value = base;
                    value.manifest.entries[index].vesting.cliff_week ^= 1;
                    value
                },
                GenesisConservationError::WrongVestingVector,
            ),
            (
                "linear_end_week",
                {
                    let mut value = base;
                    value.manifest.entries[index].vesting.linear_end_week ^= 1;
                    value
                },
                GenesisConservationError::WrongVestingVector,
            ),
        ];
        for (field, candidate, expected_error) in cases {
            assert_ne!(
                genesis_allocation_manifest_sha256(&candidate.manifest),
                canonical_commitment,
                "allocation {index} field {field} was not committed"
            );
            assert_eq!(
                verify_genesis_allocation_conservation(&candidate),
                Err(expected_error),
                "allocation {index} field {field} did not fail closed"
            );
        }
    }

    let mut precedence = base;
    precedence.manifest.entries[2].amount ^= 1;
    precedence.manifest.entries[2].vesting.cliff_week ^= 1;
    assert_eq!(
        verify_genesis_allocation_conservation(&precedence),
        Err(GenesisConservationError::WrongAllocationAmount)
    );
}

#[test]
fn mint_identity_supply_decimals_and_terminal_authorities_fail_closed() {
    let base = valid_input();
    let cases = [
        (
            "zero manifest mint",
            {
                let mut value = base;
                value.manifest.mint = [0; 32];
                value
            },
            GenesisConservationError::ZeroIdentity,
        ),
        (
            "wrong observed mint",
            {
                let mut value = base;
                value.mint.key[0] ^= 1;
                value
            },
            GenesisConservationError::WrongMint,
        ),
        (
            "wrong mint program",
            {
                let mut value = base;
                value.mint.token_program[0] ^= 1;
                value
            },
            GenesisConservationError::WrongTokenProgram,
        ),
        (
            "wrong decimals",
            {
                let mut value = base;
                value.mint.decimals = 8;
                value
            },
            GenesisConservationError::WrongDecimals,
        ),
        (
            "wrong supply",
            {
                let mut value = base;
                value.mint.supply -= 1;
                value
            },
            GenesisConservationError::WrongSupply,
        ),
        (
            "mint authority",
            {
                let mut value = base;
                value.mint.mint_authority = Some(identity(0x71));
                value
            },
            GenesisConservationError::MintAuthorityNotTerminal,
        ),
        (
            "freeze authority",
            {
                let mut value = base;
                value.mint.freeze_authority = Some(identity(0x72));
                value
            },
            GenesisConservationError::FreezeAuthorityNotTerminal,
        ),
    ];
    for (name, input, expected) in cases {
        assert_eq!(
            verify_genesis_allocation_conservation(&input),
            Err(expected),
            "{name}"
        );
    }
}

#[test]
fn manifest_order_amounts_and_unique_bindings_fail_closed() {
    let base = valid_input();
    let cases = [
        (
            "role order",
            {
                let mut value = base;
                value.manifest.entries[0].role = GenesisAllocationRole::Treasury;
                value
            },
            GenesisConservationError::WrongRoleOrder,
        ),
        (
            "amount",
            {
                let mut value = base;
                value.manifest.entries[0].amount -= 1;
                value
            },
            GenesisConservationError::WrongAllocationAmount,
        ),
        (
            "genesis unlock",
            {
                let mut value = base;
                value.manifest.entries[1].vesting.genesis_unlocked -= 1;
                value
            },
            GenesisConservationError::WrongVestingVector,
        ),
        (
            "cliff week",
            {
                let mut value = base;
                value.manifest.entries[2].vesting.cliff_week += 1;
                value
            },
            GenesisConservationError::WrongVestingVector,
        ),
        (
            "linear end week",
            {
                let mut value = base;
                value.manifest.entries[4].vesting.linear_end_week -= 1;
                value
            },
            GenesisConservationError::WrongVestingVector,
        ),
        (
            "zero destination",
            {
                let mut value = base;
                value.manifest.entries[0].token_account = [0; 32];
                value
            },
            GenesisConservationError::ZeroIdentity,
        ),
        (
            "duplicate destination",
            {
                let mut value = base;
                value.manifest.entries[1].token_account = value.manifest.entries[0].token_account;
                value
            },
            GenesisConservationError::DuplicateDestinationAccount,
        ),
        (
            "duplicate beneficiary",
            {
                let mut value = base;
                value.manifest.entries[1].beneficiary = value.manifest.entries[0].beneficiary;
                value
            },
            GenesisConservationError::DuplicateBeneficiary,
        ),
    ];
    for (name, input, expected) in cases {
        assert_eq!(
            verify_genesis_allocation_conservation(&input),
            Err(expected),
            "{name}"
        );
    }
}

#[test]
fn every_observed_binding_and_balance_must_match_the_manifest() {
    let base = valid_input();
    for mutate in 0..7 {
        let mut input = base;
        match mutate {
            0 => input.allocations[2].token_account[0] ^= 1,
            1 => input.allocations[2].token_program[0] ^= 1,
            2 => input.allocations[2].mint[0] ^= 1,
            3 => input.allocations[2].token_authority[0] ^= 1,
            4 => input.allocations[2].beneficiary_binding[0] ^= 1,
            5 => input.allocations[2].amount -= 1,
            _ => input.allocations[2].role = GenesisAllocationRole::Treasury,
        }
        let expected = if mutate == 6 {
            GenesisConservationError::WrongRoleOrder
        } else {
            GenesisConservationError::AllocationObservationMismatch
        };
        assert_eq!(
            verify_genesis_allocation_conservation(&input),
            Err(expected),
            "mutation {mutate}"
        );
    }
}

#[test]
fn unsafe_token_account_states_fail_before_a_receipt_exists() {
    let base = valid_input();
    for mutate in 0..5 {
        let mut input = base;
        match mutate {
            0 => input.allocations[4].delegate = Some(identity(0x80)),
            1 => input.allocations[4].close_authority = Some(identity(0x81)),
            2 => input.allocations[4].delegated_amount = 1,
            3 => input.allocations[4].frozen = true,
            _ => input.allocations[4].native = true,
        }
        assert_eq!(
            verify_genesis_allocation_conservation(&input),
            Err(GenesisConservationError::UnsafeTokenAccountState),
            "mutation {mutate}"
        );
    }
}

#[test]
fn production_source_is_pure_and_exposes_no_transition_or_write_surface() {
    let source = include_str!("../src/genesis_conservation.rs");
    for forbidden in [
        "AccountInfo",
        "entrypoint!",
        "process_instruction",
        "invoke(",
        "invoke_signed(",
        "try_borrow_mut",
        "Transaction",
        "transition_authorized: true",
        "mainnet_hold: false",
    ] {
        assert!(!source.contains(forbidden), "forbidden token {forbidden}");
    }
}

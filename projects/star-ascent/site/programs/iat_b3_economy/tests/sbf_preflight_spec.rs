#![cfg(feature = "sbf-preflight-entrypoint")]

use iat_b3_economy::rehearsal_adapter::{
    operation_descriptor, ALL_REHEARSAL_OPERATIONS, EXPECTED_REHEARSAL_HANDLER_COUNT,
};
use iat_b3_economy::sbf_preflight::{
    process_instruction, SbfPreflightError, SBF_PREFLIGHT_ACCOUNT_GRAPH_OPCODE,
    SBF_PREFLIGHT_INSTRUCTION_LEN, SBF_PREFLIGHT_INSTRUCTION_NAMESPACE,
    SBF_PREFLIGHT_INSTRUCTION_VERSION, SBF_STRUCTURAL_PREFLIGHT_TRUTH,
};
use solana_account_info::AccountInfo;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[derive(Debug)]
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

fn instruction(operation_index: u8) -> [u8; SBF_PREFLIGHT_INSTRUCTION_LEN] {
    let mut data = [0u8; SBF_PREFLIGHT_INSTRUCTION_LEN];
    data[0..8].copy_from_slice(SBF_PREFLIGHT_INSTRUCTION_NAMESPACE);
    data[8] = SBF_PREFLIGHT_INSTRUCTION_VERSION;
    data[9] = SBF_PREFLIGHT_ACCOUNT_GRAPH_OPCODE;
    data[10] = operation_index;
    data
}

fn accounts_for(operation_index: usize) -> Vec<TestAccount> {
    operation_descriptor(ALL_REHEARSAL_OPERATIONS[operation_index])
        .accounts
        .iter()
        .enumerate()
        .map(|(index, expected)| TestAccount {
            key: Pubkey::new_from_array([u8::try_from(index + 1).unwrap(); 32]),
            owner: Pubkey::new_from_array([0xA5; 32]),
            lamports: 7,
            data: vec![0x5A],
            signer: expected.signer,
            writable: expected.writable,
            executable: expected.executable,
        })
        .collect()
}

fn invoke(
    program_id: &Pubkey,
    operation_index: usize,
    backing: &mut [TestAccount],
) -> Result<(), ProgramError> {
    let infos: Vec<AccountInfo<'_>> = backing.iter_mut().map(TestAccount::info).collect();
    process_instruction(
        program_id,
        &infos,
        &instruction(u8::try_from(operation_index).unwrap()),
    )
}

#[test]
fn all_fifteen_exact_account_graphs_pass_without_mutation() {
    let program_id = Pubkey::new_from_array([0x44; 32]);
    assert_eq!(
        ALL_REHEARSAL_OPERATIONS.len(),
        EXPECTED_REHEARSAL_HANDLER_COUNT
    );
    for (operation_index, _) in ALL_REHEARSAL_OPERATIONS.iter().enumerate() {
        let mut accounts = accounts_for(operation_index);
        let before: Vec<(u64, Vec<u8>)> = accounts
            .iter()
            .map(|account| (account.lamports, account.data.clone()))
            .collect();
        assert_eq!(invoke(&program_id, operation_index, &mut accounts), Ok(()));
        let after: Vec<(u64, Vec<u8>)> = accounts
            .iter()
            .map(|account| (account.lamports, account.data.clone()))
            .collect();
        assert_eq!(after, before);
    }
}

#[test]
fn every_account_flag_and_count_drift_fails_closed() {
    let program_id = Pubkey::new_from_array([0x44; 32]);
    for (operation_index, operation) in ALL_REHEARSAL_OPERATIONS.iter().copied().enumerate() {
        let expected = operation_descriptor(operation);
        for account_index in 0..expected.accounts.len() {
            let mut signer = accounts_for(operation_index);
            signer[account_index].signer = !signer[account_index].signer;
            assert_eq!(
                invoke(&program_id, operation_index, &mut signer),
                Err(SbfPreflightError::SignerMismatch.into())
            );

            let mut writable = accounts_for(operation_index);
            writable[account_index].writable = !writable[account_index].writable;
            assert_eq!(
                invoke(&program_id, operation_index, &mut writable),
                Err(SbfPreflightError::WritableMismatch.into())
            );

            let mut executable = accounts_for(operation_index);
            executable[account_index].executable = !executable[account_index].executable;
            assert_eq!(
                invoke(&program_id, operation_index, &mut executable),
                Err(SbfPreflightError::ExecutableMismatch.into())
            );
        }

        let mut short = accounts_for(operation_index);
        short.pop();
        assert_eq!(
            invoke(&program_id, operation_index, &mut short),
            Err(SbfPreflightError::IncorrectAccountCount.into())
        );
    }
}

#[test]
fn instruction_envelope_and_program_id_are_exact() {
    let program_id = Pubkey::new_from_array([0x44; 32]);
    let mut accounts = accounts_for(0);
    let infos: Vec<AccountInfo<'_>> = accounts.iter_mut().map(TestAccount::info).collect();
    assert_eq!(
        process_instruction(&Pubkey::default(), &infos, &instruction(0)),
        Err(SbfPreflightError::DefaultProgramId.into())
    );

    let mut cases = Vec::new();
    cases.push(Vec::new());
    let mut wrong_namespace = instruction(0);
    wrong_namespace[0] ^= 1;
    cases.push(wrong_namespace.to_vec());
    let mut wrong_version = instruction(0);
    wrong_version[8] = 2;
    cases.push(wrong_version.to_vec());
    let mut wrong_opcode = instruction(0);
    wrong_opcode[9] = 1;
    cases.push(wrong_opcode.to_vec());
    let mut reserved = instruction(0);
    reserved[15] = 1;
    cases.push(reserved.to_vec());
    let mut trailing = instruction(0).to_vec();
    trailing.push(0);
    cases.push(trailing);
    for data in cases {
        assert_eq!(
            process_instruction(&program_id, &infos, &data),
            Err(SbfPreflightError::InvalidInstruction.into())
        );
    }

    let mut invalid_operation = instruction(0);
    invalid_operation[10] = u8::try_from(EXPECTED_REHEARSAL_HANDLER_COUNT).unwrap();
    assert_eq!(
        process_instruction(&program_id, &infos, &invalid_operation),
        Err(SbfPreflightError::InvalidOperation.into())
    );
}

#[test]
fn truth_surface_exposes_only_nonactivating_structural_preflight() {
    let truth = SBF_STRUCTURAL_PREFLIGHT_TRUTH;
    assert!(truth.feature_gated);
    assert_eq!(truth.retained_handler_count, 15);
    assert!(truth.structural_preflight_abi_frozen);
    assert!(!truth.production_instruction_abi_frozen);
    assert!(truth.structural_preflight_entrypoint_exposed);
    assert!(truth.structural_preflight_dispatcher_exposed);
    assert!(!truth.production_entrypoint_exposed);
    assert!(!truth.production_dispatcher_exposed);
    assert!(!truth.public_economic_write_exposure);
    assert!(!truth.account_keys_authenticated);
    assert!(!truth.account_owners_authenticated);
    assert!(!truth.mutable_account_borrows);
    assert!(!truth.account_writes_executed);
    assert!(!truth.system_cpi_executed);
    assert!(!truth.token_cpi_executed);
    assert!(!truth.any_handler_complete);
    assert!(truth.mainnet_hold);
}

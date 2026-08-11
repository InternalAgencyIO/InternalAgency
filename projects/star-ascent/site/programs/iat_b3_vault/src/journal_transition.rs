//! Deterministic, host-only transition receipts for canonical privacy journals.
//!
//! A receipt proves only that the existing lifecycle transition function maps
//! one canonical journal snapshot to another. It performs no persistence, CAS,
//! signing, RPC, chain observation, runtime integration, or authorization.

use super::journal_codec::{
    decode_operation_journal, encode_operation_journal, operation_journal_digest,
    JournalCodecError, OPERATION_JOURNAL_BYTES_LEN,
};
use super::{
    record_operation_step, recover_operation_journal, Digest, JournalStepObservation,
    OperationJournal, PrivacyOperationPlan, PrivacyVaultError,
};

pub const PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION: u8 = 1;
pub const PRIVACY_JOURNAL_TRANSITION_REFERENCE_STATUS: &str =
    "HOST_ONLY_DETERMINISTIC_TRANSITION_REPLAY_NONACTIVATING";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JournalTransitionMutation {
    RecordStep {
        step_index: u8,
        observation: JournalStepObservation,
    },
    Recover {
        confirmed_step_count: u8,
        observed_open_proof_contexts: u8,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JournalTransitionError {
    Codec(JournalCodecError),
    Lifecycle(PrivacyVaultError),
    BeforeDigestMismatch,
    AfterDigestMismatch,
    NoStateChange,
    AfterSnapshotMismatch,
}

impl From<JournalCodecError> for JournalTransitionError {
    fn from(value: JournalCodecError) -> Self {
        Self::Codec(value)
    }
}

impl From<PrivacyVaultError> for JournalTransitionError {
    fn from(value: PrivacyVaultError) -> Self {
        Self::Lifecycle(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct JournalTransitionReceipt {
    version: u8,
    mutation: JournalTransitionMutation,
    before_journal_bytes: [u8; OPERATION_JOURNAL_BYTES_LEN],
    after_journal_bytes: [u8; OPERATION_JOURNAL_BYTES_LEN],
    before_journal_digest: Digest,
    after_journal_digest: Digest,
}

impl JournalTransitionReceipt {
    pub const fn version(&self) -> u8 {
        self.version
    }

    pub const fn mutation(&self) -> JournalTransitionMutation {
        self.mutation
    }

    pub const fn before_journal_bytes(&self) -> &[u8; OPERATION_JOURNAL_BYTES_LEN] {
        &self.before_journal_bytes
    }

    pub const fn after_journal_bytes(&self) -> &[u8; OPERATION_JOURNAL_BYTES_LEN] {
        &self.after_journal_bytes
    }

    pub const fn before_journal_digest(&self) -> Digest {
        self.before_journal_digest
    }

    pub const fn after_journal_digest(&self) -> Digest {
        self.after_journal_digest
    }

    pub const fn deterministic_transition_replay_verified(&self) -> bool {
        true
    }

    pub const fn durable_persistence_verified(&self) -> bool {
        false
    }

    pub const fn writer_confinement_verified(&self) -> bool {
        false
    }

    pub const fn authenticated_chain_observation_verified(&self) -> bool {
        false
    }

    pub const fn runtime_integration_verified(&self) -> bool {
        false
    }

    pub const fn devnet_lifecycle_verified(&self) -> bool {
        false
    }

    pub const fn activation_ready(&self) -> bool {
        false
    }

    pub const fn mainnet_hold(&self) -> bool {
        true
    }
}

fn replay_mutation(
    journal: &mut OperationJournal,
    mutation: JournalTransitionMutation,
) -> Result<(), PrivacyVaultError> {
    let plan: PrivacyOperationPlan = *journal.bound_plan();
    match mutation {
        JournalTransitionMutation::RecordStep {
            step_index,
            observation,
        } => record_operation_step(&plan, journal, step_index, observation),
        JournalTransitionMutation::Recover {
            confirmed_step_count,
            observed_open_proof_contexts,
        } => recover_operation_journal(
            &plan,
            journal,
            confirmed_step_count,
            observed_open_proof_contexts,
        ),
    }
}

pub fn verify_journal_transition_parts(
    before_journal_bytes: &[u8],
    before_journal_digest: Digest,
    mutation: JournalTransitionMutation,
    after_journal_bytes: &[u8],
    after_journal_digest: Digest,
) -> Result<(), JournalTransitionError> {
    let before = decode_operation_journal(before_journal_bytes)?;
    if operation_journal_digest(&before)? != before_journal_digest {
        return Err(JournalTransitionError::BeforeDigestMismatch);
    }
    let after = decode_operation_journal(after_journal_bytes)?;
    if operation_journal_digest(&after)? != after_journal_digest {
        return Err(JournalTransitionError::AfterDigestMismatch);
    }
    if before_journal_bytes == after_journal_bytes || before_journal_digest == after_journal_digest
    {
        return Err(JournalTransitionError::NoStateChange);
    }

    let mut replayed = before;
    replay_mutation(&mut replayed, mutation)?;
    let replayed_bytes = encode_operation_journal(&replayed)?;
    if replayed_bytes.as_slice() != after_journal_bytes
        || operation_journal_digest(&replayed)? != after_journal_digest
    {
        return Err(JournalTransitionError::AfterSnapshotMismatch);
    }
    Ok(())
}

pub fn prepare_journal_transition(
    journal: &OperationJournal,
    expected_before_journal_digest: Digest,
    mutation: JournalTransitionMutation,
) -> Result<JournalTransitionReceipt, JournalTransitionError> {
    let before_journal_bytes = encode_operation_journal(journal)?;
    let before_journal_digest = operation_journal_digest(journal)?;
    if before_journal_digest != expected_before_journal_digest {
        return Err(JournalTransitionError::BeforeDigestMismatch);
    }

    let mut after = *journal;
    replay_mutation(&mut after, mutation)?;
    let after_journal_bytes = encode_operation_journal(&after)?;
    let after_journal_digest = operation_journal_digest(&after)?;

    verify_journal_transition_parts(
        &before_journal_bytes,
        before_journal_digest,
        mutation,
        &after_journal_bytes,
        after_journal_digest,
    )?;

    Ok(JournalTransitionReceipt {
        version: PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION,
        mutation,
        before_journal_bytes,
        after_journal_bytes,
        before_journal_digest,
        after_journal_digest,
    })
}

pub fn verify_journal_transition_receipt(
    receipt: &JournalTransitionReceipt,
) -> Result<(), JournalTransitionError> {
    if receipt.version != PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION {
        return Err(JournalTransitionError::AfterSnapshotMismatch);
    }
    verify_journal_transition_parts(
        &receipt.before_journal_bytes,
        receipt.before_journal_digest,
        receipt.mutation,
        &receipt.after_journal_bytes,
        receipt.after_journal_digest,
    )
}

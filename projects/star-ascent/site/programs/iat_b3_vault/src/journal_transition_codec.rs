//! Canonical fixed-size transport for verified privacy journal transitions.
//!
//! Decoding recreates the private transition receipt through the reviewed
//! transition constructor. This module performs no persistence, CAS, signing,
//! RPC, chain observation, runtime integration, or authorization.

use super::journal_codec::{decode_operation_journal, OPERATION_JOURNAL_BYTES_LEN};
use super::journal_transition::{
    prepare_journal_transition, verify_journal_transition_receipt, JournalTransitionError,
    JournalTransitionMutation, JournalTransitionReceipt,
    PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION,
};
use super::{Digest, JournalStepObservation};

pub const PRIVACY_JOURNAL_TRANSITION_CODEC_VERSION: u8 = 1;
pub const PRIVACY_JOURNAL_TRANSITION_CODEC_REFERENCE_STATUS: &str =
    "HOST_ONLY_CANONICAL_TRANSITION_TRANSPORT_NONACTIVATING";
pub const JOURNAL_TRANSITION_RECEIPT_BYTES_LEN: usize = 650;

const MAGIC: [u8; 8] = *b"IATB3JTR";
const HEADER_LEN: usize = 16;
const RECORD_KIND: u8 = 1;
const PAYLOAD_LEN: usize = JOURNAL_TRANSITION_RECEIPT_BYTES_LEN - HEADER_LEN;
const RECORD_STEP_MUTATION_KIND: u8 = 1;
const RECOVER_MUTATION_KIND: u8 = 2;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JournalTransitionCodecError {
    InvalidLength,
    InvalidMagic,
    UnsupportedVersion,
    InvalidRecordKind,
    NonCanonicalReserved,
    InvalidPayloadLength,
    UnsupportedReceiptVersion,
    InvalidMutationKind,
    InvalidObservation,
    Transition(JournalTransitionError),
    ReceiptComponentMismatch,
}

impl From<JournalTransitionError> for JournalTransitionCodecError {
    fn from(value: JournalTransitionError) -> Self {
        Self::Transition(value)
    }
}

struct Writer<'a> {
    bytes: &'a mut [u8],
    offset: usize,
}

impl<'a> Writer<'a> {
    fn new(bytes: &'a mut [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn put_u8(&mut self, value: u8) {
        self.bytes[self.offset] = value;
        self.offset += 1;
    }

    fn put_bytes(&mut self, value: &[u8]) {
        let end = self.offset + value.len();
        self.bytes[self.offset..end].copy_from_slice(value);
        self.offset = end;
    }

    fn finish(self) -> Result<(), JournalTransitionCodecError> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(JournalTransitionCodecError::InvalidLength)
        }
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn take_u8(&mut self) -> Result<u8, JournalTransitionCodecError> {
        let value = *self
            .bytes
            .get(self.offset)
            .ok_or(JournalTransitionCodecError::InvalidLength)?;
        self.offset += 1;
        Ok(value)
    }

    fn take_array<const N: usize>(&mut self) -> Result<[u8; N], JournalTransitionCodecError> {
        let end = self
            .offset
            .checked_add(N)
            .ok_or(JournalTransitionCodecError::InvalidLength)?;
        let source = self
            .bytes
            .get(self.offset..end)
            .ok_or(JournalTransitionCodecError::InvalidLength)?;
        let mut value = [0; N];
        value.copy_from_slice(source);
        self.offset = end;
        Ok(value)
    }

    fn finish(self) -> Result<(), JournalTransitionCodecError> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(JournalTransitionCodecError::InvalidLength)
        }
    }
}

fn observation_discriminant(observation: JournalStepObservation) -> u8 {
    match observation {
        JournalStepObservation::Confirmed => 1,
        JournalStepObservation::FailedBeforeCommit => 2,
        JournalStepObservation::ResultUnknown => 3,
    }
}

fn decode_observation(value: u8) -> Result<JournalStepObservation, JournalTransitionCodecError> {
    match value {
        1 => Ok(JournalStepObservation::Confirmed),
        2 => Ok(JournalStepObservation::FailedBeforeCommit),
        3 => Ok(JournalStepObservation::ResultUnknown),
        _ => Err(JournalTransitionCodecError::InvalidObservation),
    }
}

fn encode_mutation(mutation: JournalTransitionMutation) -> (u8, u8, u8) {
    match mutation {
        JournalTransitionMutation::RecordStep {
            step_index,
            observation,
        } => (
            RECORD_STEP_MUTATION_KIND,
            step_index,
            observation_discriminant(observation),
        ),
        JournalTransitionMutation::Recover {
            confirmed_step_count,
            observed_open_proof_contexts,
        } => (
            RECOVER_MUTATION_KIND,
            confirmed_step_count,
            observed_open_proof_contexts,
        ),
    }
}

fn decode_mutation(
    kind: u8,
    argument_0: u8,
    argument_1: u8,
) -> Result<JournalTransitionMutation, JournalTransitionCodecError> {
    match kind {
        RECORD_STEP_MUTATION_KIND => Ok(JournalTransitionMutation::RecordStep {
            step_index: argument_0,
            observation: decode_observation(argument_1)?,
        }),
        RECOVER_MUTATION_KIND => Ok(JournalTransitionMutation::Recover {
            confirmed_step_count: argument_0,
            observed_open_proof_contexts: argument_1,
        }),
        _ => Err(JournalTransitionCodecError::InvalidMutationKind),
    }
}

fn put_header(bytes: &mut [u8; JOURNAL_TRANSITION_RECEIPT_BYTES_LEN]) {
    bytes[..8].copy_from_slice(&MAGIC);
    bytes[8] = PRIVACY_JOURNAL_TRANSITION_CODEC_VERSION;
    bytes[9] = RECORD_KIND;
    bytes[10..12].fill(0);
    bytes[12..16].copy_from_slice(&(PAYLOAD_LEN as u32).to_be_bytes());
}

fn checked_payload(bytes: &[u8]) -> Result<&[u8], JournalTransitionCodecError> {
    if bytes.len() != JOURNAL_TRANSITION_RECEIPT_BYTES_LEN {
        return Err(JournalTransitionCodecError::InvalidLength);
    }
    if bytes[..8] != MAGIC {
        return Err(JournalTransitionCodecError::InvalidMagic);
    }
    if bytes[8] != PRIVACY_JOURNAL_TRANSITION_CODEC_VERSION {
        return Err(JournalTransitionCodecError::UnsupportedVersion);
    }
    if bytes[9] != RECORD_KIND {
        return Err(JournalTransitionCodecError::InvalidRecordKind);
    }
    if bytes[10] != 0 || bytes[11] != 0 {
        return Err(JournalTransitionCodecError::NonCanonicalReserved);
    }
    let payload_len = u32::from_be_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]) as usize;
    if payload_len != PAYLOAD_LEN {
        return Err(JournalTransitionCodecError::InvalidPayloadLength);
    }
    Ok(&bytes[HEADER_LEN..])
}

pub fn encode_journal_transition_receipt(
    receipt: &JournalTransitionReceipt,
) -> Result<[u8; JOURNAL_TRANSITION_RECEIPT_BYTES_LEN], JournalTransitionCodecError> {
    if receipt.version() != PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION {
        return Err(JournalTransitionCodecError::UnsupportedReceiptVersion);
    }
    verify_journal_transition_receipt(receipt)?;
    let (mutation_kind, argument_0, argument_1) = encode_mutation(receipt.mutation());
    let mut bytes = [0; JOURNAL_TRANSITION_RECEIPT_BYTES_LEN];
    put_header(&mut bytes);
    let mut writer = Writer::new(&mut bytes[HEADER_LEN..]);
    writer.put_u8(receipt.version());
    writer.put_u8(mutation_kind);
    writer.put_u8(argument_0);
    writer.put_u8(argument_1);
    writer.put_bytes(&receipt.before_journal_digest());
    writer.put_bytes(receipt.before_journal_bytes());
    writer.put_bytes(&receipt.after_journal_digest());
    writer.put_bytes(receipt.after_journal_bytes());
    writer.finish()?;
    Ok(bytes)
}

pub fn decode_journal_transition_receipt(
    bytes: &[u8],
) -> Result<JournalTransitionReceipt, JournalTransitionCodecError> {
    let mut reader = Reader::new(checked_payload(bytes)?);
    let receipt_version = reader.take_u8()?;
    if receipt_version != PRIVACY_JOURNAL_TRANSITION_RECEIPT_VERSION {
        return Err(JournalTransitionCodecError::UnsupportedReceiptVersion);
    }
    let mutation = decode_mutation(reader.take_u8()?, reader.take_u8()?, reader.take_u8()?)?;
    let before_journal_digest: Digest = reader.take_array()?;
    let before_journal_bytes: [u8; OPERATION_JOURNAL_BYTES_LEN] = reader.take_array()?;
    let after_journal_digest: Digest = reader.take_array()?;
    let after_journal_bytes: [u8; OPERATION_JOURNAL_BYTES_LEN] = reader.take_array()?;
    reader.finish()?;

    let before_journal = decode_operation_journal(&before_journal_bytes)
        .map_err(|error| JournalTransitionCodecError::Transition(error.into()))?;
    let receipt = prepare_journal_transition(&before_journal, before_journal_digest, mutation)?;
    if receipt.version() != receipt_version
        || receipt.mutation() != mutation
        || receipt.before_journal_digest() != before_journal_digest
        || receipt.before_journal_bytes() != &before_journal_bytes
        || receipt.after_journal_digest() != after_journal_digest
        || receipt.after_journal_bytes() != &after_journal_bytes
    {
        return Err(JournalTransitionCodecError::ReceiptComponentMismatch);
    }
    verify_journal_transition_receipt(&receipt)?;
    Ok(receipt)
}

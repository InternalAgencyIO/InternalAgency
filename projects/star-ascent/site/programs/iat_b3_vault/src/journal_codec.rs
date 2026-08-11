//! Canonical, fixed-size host codec for privacy operation plans and journals.
//!
//! The codec is content addressing only. It performs no persistence, signing,
//! RPC, chain observation, runtime integration, or authorization.

use super::{
    apply_confirmed_step, validate_plan_shape, AmountVisibility, Digest, OperationJournal,
    OperationJournalStatus, PlanStep, PlanStepKind, PrivacyOperation, PrivacyOperationPlan,
    EMPTY_STEP, MAX_PLAN_STEPS,
};

pub const PRIVACY_JOURNAL_CODEC_VERSION: u8 = 1;
pub const PRIVACY_JOURNAL_CODEC_REFERENCE_STATUS: &str =
    "HOST_ONLY_CANONICAL_BYTES_AND_CONTENT_DIGEST_NONACTIVATING";
pub const PRIVACY_OPERATION_PLAN_BYTES_LEN: usize = 236;
pub const OPERATION_JOURNAL_BYTES_LEN: usize = 283;

const MAGIC: [u8; 8] = *b"IATB3PJC";
const HEADER_LEN: usize = 16;
const PLAN_RECORD_KIND: u8 = 1;
const JOURNAL_RECORD_KIND: u8 = 2;
const PLAN_PAYLOAD_LEN: usize = PRIVACY_OPERATION_PLAN_BYTES_LEN - HEADER_LEN;
const JOURNAL_PAYLOAD_LEN: usize = OPERATION_JOURNAL_BYTES_LEN - HEADER_LEN;
const PLAN_DIGEST_DOMAIN: &[u8] = b"IAT_B3_PRIVACY_OPERATION_PLAN_CODEC_DIGEST_V1";
const JOURNAL_DIGEST_DOMAIN: &[u8] = b"IAT_B3_OPERATION_JOURNAL_CODEC_DIGEST_V1";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JournalCodecError {
    InvalidLength,
    InvalidMagic,
    UnsupportedVersion,
    InvalidRecordKind,
    NonCanonicalReserved,
    InvalidPayloadLength,
    InvalidDiscriminant,
    InvalidBoolean,
    NonCanonicalOption,
    NonCanonicalZero,
    InvalidPlanShape,
    InvalidJournalShape,
    BoundPlanDigestMismatch,
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

    fn put_bool(&mut self, value: bool) {
        self.put_u8(u8::from(value));
    }

    fn put_u64(&mut self, value: u64) {
        self.put_bytes(&value.to_be_bytes());
    }

    fn put_bytes(&mut self, value: &[u8]) {
        let end = self.offset + value.len();
        self.bytes[self.offset..end].copy_from_slice(value);
        self.offset = end;
    }

    fn finish(self) -> Result<(), JournalCodecError> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(JournalCodecError::InvalidLength)
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

    fn take_u8(&mut self) -> Result<u8, JournalCodecError> {
        let value = *self
            .bytes
            .get(self.offset)
            .ok_or(JournalCodecError::InvalidLength)?;
        self.offset += 1;
        Ok(value)
    }

    fn take_bool(&mut self) -> Result<bool, JournalCodecError> {
        match self.take_u8()? {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err(JournalCodecError::InvalidBoolean),
        }
    }

    fn take_u64(&mut self) -> Result<u64, JournalCodecError> {
        Ok(u64::from_be_bytes(self.take_array()?))
    }

    fn take_array<const N: usize>(&mut self) -> Result<[u8; N], JournalCodecError> {
        let end = self
            .offset
            .checked_add(N)
            .ok_or(JournalCodecError::InvalidLength)?;
        let source = self
            .bytes
            .get(self.offset..end)
            .ok_or(JournalCodecError::InvalidLength)?;
        let mut value = [0; N];
        value.copy_from_slice(source);
        self.offset = end;
        Ok(value)
    }

    fn finish(self) -> Result<(), JournalCodecError> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(JournalCodecError::InvalidLength)
        }
    }
}

fn put_header(bytes: &mut [u8], record_kind: u8, payload_len: usize) {
    bytes[..8].copy_from_slice(&MAGIC);
    bytes[8] = PRIVACY_JOURNAL_CODEC_VERSION;
    bytes[9] = record_kind;
    bytes[10] = 0;
    bytes[11] = 0;
    bytes[12..16].copy_from_slice(&(payload_len as u32).to_be_bytes());
}

fn checked_payload(
    bytes: &[u8],
    expected_record_len: usize,
    expected_record_kind: u8,
    expected_payload_len: usize,
) -> Result<&[u8], JournalCodecError> {
    if bytes.len() != expected_record_len {
        return Err(JournalCodecError::InvalidLength);
    }
    if bytes[..8] != MAGIC {
        return Err(JournalCodecError::InvalidMagic);
    }
    if bytes[8] != PRIVACY_JOURNAL_CODEC_VERSION {
        return Err(JournalCodecError::UnsupportedVersion);
    }
    if bytes[9] != expected_record_kind {
        return Err(JournalCodecError::InvalidRecordKind);
    }
    if bytes[10] != 0 || bytes[11] != 0 {
        return Err(JournalCodecError::NonCanonicalReserved);
    }
    let payload_len = u32::from_be_bytes(
        bytes[12..16]
            .try_into()
            .map_err(|_| JournalCodecError::InvalidLength)?,
    ) as usize;
    if payload_len != expected_payload_len {
        return Err(JournalCodecError::InvalidPayloadLength);
    }
    Ok(&bytes[HEADER_LEN..])
}

fn operation_discriminant(value: PrivacyOperation) -> u8 {
    match value {
        PrivacyOperation::ConfigureAccount => 1,
        PrivacyOperation::Deposit => 2,
        PrivacyOperation::ConfidentialTransfer => 3,
        PrivacyOperation::ApplyPendingBalance => 4,
        PrivacyOperation::Withdraw => 5,
        PrivacyOperation::SetConfidentialCredits => 6,
        PrivacyOperation::SetNonConfidentialCredits => 7,
        PrivacyOperation::EmptyAndCloseAccount => 8,
        PrivacyOperation::CleanupProofContexts => 9,
    }
}

fn decode_operation(value: u8) -> Result<PrivacyOperation, JournalCodecError> {
    match value {
        1 => Ok(PrivacyOperation::ConfigureAccount),
        2 => Ok(PrivacyOperation::Deposit),
        3 => Ok(PrivacyOperation::ConfidentialTransfer),
        4 => Ok(PrivacyOperation::ApplyPendingBalance),
        5 => Ok(PrivacyOperation::Withdraw),
        6 => Ok(PrivacyOperation::SetConfidentialCredits),
        7 => Ok(PrivacyOperation::SetNonConfidentialCredits),
        8 => Ok(PrivacyOperation::EmptyAndCloseAccount),
        9 => Ok(PrivacyOperation::CleanupProofContexts),
        _ => Err(JournalCodecError::InvalidDiscriminant),
    }
}

fn step_kind_discriminant(value: PlanStepKind) -> u8 {
    match value {
        PlanStepKind::None => 0,
        PlanStepKind::ReallocateConfidentialExtension => 1,
        PlanStepKind::CreateAndVerifyPubkeyValidityProofContext => 2,
        PlanStepKind::ConfigureConfidentialAccount => 3,
        PlanStepKind::DepositPublicToConfidential => 4,
        PlanStepKind::CreateAndVerifyProofContexts => 5,
        PlanStepKind::ConfidentialTransferWithDailyLawHook => 6,
        PlanStepKind::CloseProofContexts => 7,
        PlanStepKind::ApplyPendingBalance => 8,
        PlanStepKind::WithdrawConfidentialToPublic => 9,
        PlanStepKind::EnableConfidentialCredits => 10,
        PlanStepKind::DisableConfidentialCredits => 11,
        PlanStepKind::EnableNonConfidentialCredits => 12,
        PlanStepKind::DisableNonConfidentialCredits => 13,
        PlanStepKind::CreateAndVerifyEmptyAccountProofContext => 14,
        PlanStepKind::EmptyConfidentialAccount => 15,
        PlanStepKind::CloseTokenAccount => 16,
    }
}

fn decode_step_kind(value: u8) -> Result<PlanStepKind, JournalCodecError> {
    match value {
        0 => Ok(PlanStepKind::None),
        1 => Ok(PlanStepKind::ReallocateConfidentialExtension),
        2 => Ok(PlanStepKind::CreateAndVerifyPubkeyValidityProofContext),
        3 => Ok(PlanStepKind::ConfigureConfidentialAccount),
        4 => Ok(PlanStepKind::DepositPublicToConfidential),
        5 => Ok(PlanStepKind::CreateAndVerifyProofContexts),
        6 => Ok(PlanStepKind::ConfidentialTransferWithDailyLawHook),
        7 => Ok(PlanStepKind::CloseProofContexts),
        8 => Ok(PlanStepKind::ApplyPendingBalance),
        9 => Ok(PlanStepKind::WithdrawConfidentialToPublic),
        10 => Ok(PlanStepKind::EnableConfidentialCredits),
        11 => Ok(PlanStepKind::DisableConfidentialCredits),
        12 => Ok(PlanStepKind::EnableNonConfidentialCredits),
        13 => Ok(PlanStepKind::DisableNonConfidentialCredits),
        14 => Ok(PlanStepKind::CreateAndVerifyEmptyAccountProofContext),
        15 => Ok(PlanStepKind::EmptyConfidentialAccount),
        16 => Ok(PlanStepKind::CloseTokenAccount),
        _ => Err(JournalCodecError::InvalidDiscriminant),
    }
}

fn visibility_discriminant(value: AmountVisibility) -> u8 {
    match value {
        AmountVisibility::None => 0,
        AmountVisibility::PublicCleartext => 1,
        AmountVisibility::ConfidentialClientOnly => 2,
    }
}

fn decode_visibility(value: u8) -> Result<AmountVisibility, JournalCodecError> {
    match value {
        0 => Ok(AmountVisibility::None),
        1 => Ok(AmountVisibility::PublicCleartext),
        2 => Ok(AmountVisibility::ConfidentialClientOnly),
        _ => Err(JournalCodecError::InvalidDiscriminant),
    }
}

fn journal_status_discriminant(value: OperationJournalStatus) -> u8 {
    match value {
        OperationJournalStatus::InProgress => 1,
        OperationJournalStatus::CleanupRequired => 2,
        OperationJournalStatus::RecoveryRequired => 3,
        OperationJournalStatus::Completed => 4,
        OperationJournalStatus::Aborted => 5,
    }
}

fn decode_journal_status(value: u8) -> Result<OperationJournalStatus, JournalCodecError> {
    match value {
        1 => Ok(OperationJournalStatus::InProgress),
        2 => Ok(OperationJournalStatus::CleanupRequired),
        3 => Ok(OperationJournalStatus::RecoveryRequired),
        4 => Ok(OperationJournalStatus::Completed),
        5 => Ok(OperationJournalStatus::Aborted),
        _ => Err(JournalCodecError::InvalidDiscriminant),
    }
}

fn encode_step(writer: &mut Writer<'_>, step: PlanStep) {
    writer.put_u8(step_kind_discriminant(step.kind));
    writer.put_bool(step.owner_signature_required);
    writer.put_bool(step.invokes_daily_law_hook);
    writer.put_bool(step.changes_owner);
    writer.put_bool(step.proof_context_cleanup_required);
    writer.put_u8(visibility_discriminant(step.amount_visibility));
    writer.put_u64(step.cleartext_amount);
}

fn decode_step(reader: &mut Reader<'_>) -> Result<PlanStep, JournalCodecError> {
    Ok(PlanStep {
        kind: decode_step_kind(reader.take_u8()?)?,
        owner_signature_required: reader.take_bool()?,
        invokes_daily_law_hook: reader.take_bool()?,
        changes_owner: reader.take_bool()?,
        proof_context_cleanup_required: reader.take_bool()?,
        amount_visibility: decode_visibility(reader.take_u8()?)?,
        cleartext_amount: reader.take_u64()?,
    })
}

fn validate_plan_for_codec(plan: &PrivacyOperationPlan) -> Result<(), JournalCodecError> {
    validate_plan_shape(plan).map_err(|_| JournalCodecError::InvalidPlanShape)?;
    for step in &plan.steps[plan.step_count as usize..] {
        if *step != EMPTY_STEP {
            return Err(JournalCodecError::NonCanonicalZero);
        }
    }
    Ok(())
}

fn encode_plan_payload(
    plan: &PrivacyOperationPlan,
) -> Result<[u8; PLAN_PAYLOAD_LEN], JournalCodecError> {
    validate_plan_for_codec(plan)?;
    let mut payload = [0; PLAN_PAYLOAD_LEN];
    let mut writer = Writer::new(&mut payload);
    writer.put_u8(plan.schema_version);
    writer.put_u8(operation_discriminant(plan.operation));
    writer.put_bytes(&plan.source_token_account);
    writer.put_bytes(&plan.destination_token_account);
    writer.put_bytes(&plan.mint);
    writer.put_u8(plan.step_count);
    for step in plan.steps {
        encode_step(&mut writer, step);
    }
    writer.put_bool(plan.optional_privacy_only);
    writer.put_bool(plan.documented_lifecycle_shape_covered);
    writer.put_bool(plan.same_canonical_mint);
    writer.put_bool(plan.wrapper_or_bridge_asset);
    writer.put_bool(plan.global_auditor);
    writer.put_bool(plan.planner_daily_law_gate_passed);
    writer.put_bool(plan.direct_client_bypass_prevention_verified);
    writer.put_bool(plan.account_local_conversion_outside_hook_disclosed);
    writer.put_u64(plan.maximum_pending_balance_credit_counter);
    match plan.expected_pending_balance_credit_counter {
        None => {
            writer.put_u8(0);
            writer.put_u64(0);
        }
        Some(value) => {
            writer.put_u8(1);
            writer.put_u64(value);
        }
    }
    match plan.requested_credit_permission {
        None => {
            writer.put_u8(0);
            writer.put_u8(0);
        }
        Some(value) => {
            writer.put_u8(1);
            writer.put_bool(value);
        }
    }
    writer.put_bytes(&plan.operation_binding);
    writer.put_bool(plan.runtime_authentication_verified);
    writer.put_bool(plan.exact_client_adapter_verified);
    writer.put_bool(plan.durable_resume_and_cleanup_verified);
    writer.put_bool(plan.devnet_lifecycle_verified);
    writer.put_bool(plan.activation_ready);
    writer.put_bool(plan.mainnet_hold);
    writer.finish()?;
    Ok(payload)
}

fn decode_optional_u64(reader: &mut Reader<'_>) -> Result<Option<u64>, JournalCodecError> {
    let tag = reader.take_u8()?;
    let value = reader.take_u64()?;
    match tag {
        0 if value == 0 => Ok(None),
        0 => Err(JournalCodecError::NonCanonicalOption),
        1 => Ok(Some(value)),
        _ => Err(JournalCodecError::NonCanonicalOption),
    }
}

fn decode_optional_bool(reader: &mut Reader<'_>) -> Result<Option<bool>, JournalCodecError> {
    let tag = reader.take_u8()?;
    let value = reader.take_u8()?;
    match (tag, value) {
        (0, 0) => Ok(None),
        (0, _) => Err(JournalCodecError::NonCanonicalOption),
        (1, 0) => Ok(Some(false)),
        (1, 1) => Ok(Some(true)),
        _ => Err(JournalCodecError::NonCanonicalOption),
    }
}

fn decode_plan_payload(payload: &[u8]) -> Result<PrivacyOperationPlan, JournalCodecError> {
    if payload.len() != PLAN_PAYLOAD_LEN {
        return Err(JournalCodecError::InvalidLength);
    }
    let mut reader = Reader::new(payload);
    let schema_version = reader.take_u8()?;
    let operation = decode_operation(reader.take_u8()?)?;
    let source_token_account = reader.take_array()?;
    let destination_token_account = reader.take_array()?;
    let mint = reader.take_array()?;
    let step_count = reader.take_u8()?;
    let mut steps = [EMPTY_STEP; MAX_PLAN_STEPS];
    for step in &mut steps {
        *step = decode_step(&mut reader)?;
    }
    let plan = PrivacyOperationPlan {
        schema_version,
        operation,
        source_token_account,
        destination_token_account,
        mint,
        steps,
        step_count,
        optional_privacy_only: reader.take_bool()?,
        documented_lifecycle_shape_covered: reader.take_bool()?,
        same_canonical_mint: reader.take_bool()?,
        wrapper_or_bridge_asset: reader.take_bool()?,
        global_auditor: reader.take_bool()?,
        planner_daily_law_gate_passed: reader.take_bool()?,
        direct_client_bypass_prevention_verified: reader.take_bool()?,
        account_local_conversion_outside_hook_disclosed: reader.take_bool()?,
        maximum_pending_balance_credit_counter: reader.take_u64()?,
        expected_pending_balance_credit_counter: decode_optional_u64(&mut reader)?,
        requested_credit_permission: decode_optional_bool(&mut reader)?,
        operation_binding: reader.take_array()?,
        runtime_authentication_verified: reader.take_bool()?,
        exact_client_adapter_verified: reader.take_bool()?,
        durable_resume_and_cleanup_verified: reader.take_bool()?,
        devnet_lifecycle_verified: reader.take_bool()?,
        activation_ready: reader.take_bool()?,
        mainnet_hold: reader.take_bool()?,
    };
    reader.finish()?;
    validate_plan_for_codec(&plan)?;
    Ok(plan)
}

fn expected_open_proof_contexts(
    plan: &PrivacyOperationPlan,
    confirmed_step_count: u8,
) -> Result<u8, JournalCodecError> {
    if confirmed_step_count > plan.step_count {
        return Err(JournalCodecError::InvalidJournalShape);
    }
    let mut open = 0;
    for index in 0..confirmed_step_count {
        apply_confirmed_step(&mut open, plan.steps[index as usize])
            .map_err(|_| JournalCodecError::InvalidJournalShape)?;
    }
    Ok(open)
}

fn validate_journal_for_codec(journal: &OperationJournal) -> Result<(), JournalCodecError> {
    let plan = journal.bound_plan();
    validate_plan_for_codec(plan)?;
    if journal.operation_id == 0
        || journal.next_step_index > plan.step_count
        || journal.authenticated_chain_observation_verified
        || journal.durable_persistence_verified
        || journal.activation_ready
        || !journal.mainnet_hold
    {
        return Err(JournalCodecError::InvalidJournalShape);
    }
    let expected_open = expected_open_proof_contexts(plan, journal.next_step_index)?;
    if journal.open_proof_contexts != expected_open {
        return Err(JournalCodecError::InvalidJournalShape);
    }
    let before_end = journal.next_step_index < plan.step_count;
    let valid_status = match journal.status {
        OperationJournalStatus::InProgress | OperationJournalStatus::RecoveryRequired => before_end,
        OperationJournalStatus::Completed => !before_end && expected_open == 0,
        OperationJournalStatus::Aborted => before_end && expected_open == 0,
        OperationJournalStatus::CleanupRequired => expected_open > 0,
    };
    if !valid_status {
        return Err(JournalCodecError::InvalidJournalShape);
    }
    Ok(())
}

pub fn encode_privacy_operation_plan(
    plan: &PrivacyOperationPlan,
) -> Result<[u8; PRIVACY_OPERATION_PLAN_BYTES_LEN], JournalCodecError> {
    let payload = encode_plan_payload(plan)?;
    let mut bytes = [0; PRIVACY_OPERATION_PLAN_BYTES_LEN];
    put_header(&mut bytes, PLAN_RECORD_KIND, PLAN_PAYLOAD_LEN);
    bytes[HEADER_LEN..].copy_from_slice(&payload);
    Ok(bytes)
}

pub fn decode_privacy_operation_plan(
    bytes: &[u8],
) -> Result<PrivacyOperationPlan, JournalCodecError> {
    decode_plan_payload(checked_payload(
        bytes,
        PRIVACY_OPERATION_PLAN_BYTES_LEN,
        PLAN_RECORD_KIND,
        PLAN_PAYLOAD_LEN,
    )?)
}

pub fn privacy_operation_plan_digest(
    plan: &PrivacyOperationPlan,
) -> Result<Digest, JournalCodecError> {
    let bytes = encode_privacy_operation_plan(plan)?;
    Ok(sha256_parts(&[PLAN_DIGEST_DOMAIN, &[0], &bytes]))
}

pub fn encode_operation_journal(
    journal: &OperationJournal,
) -> Result<[u8; OPERATION_JOURNAL_BYTES_LEN], JournalCodecError> {
    validate_journal_for_codec(journal)?;
    let plan_payload = encode_plan_payload(journal.bound_plan())?;
    let plan_digest = privacy_operation_plan_digest(journal.bound_plan())?;
    let mut bytes = [0; OPERATION_JOURNAL_BYTES_LEN];
    put_header(&mut bytes, JOURNAL_RECORD_KIND, JOURNAL_PAYLOAD_LEN);
    let mut writer = Writer::new(&mut bytes[HEADER_LEN..]);
    writer.put_u64(journal.operation_id);
    writer.put_bytes(&plan_payload);
    writer.put_bytes(&plan_digest);
    writer.put_u8(journal.next_step_index);
    writer.put_u8(journal.open_proof_contexts);
    writer.put_u8(journal_status_discriminant(journal.status));
    writer.put_bool(journal.authenticated_chain_observation_verified);
    writer.put_bool(journal.durable_persistence_verified);
    writer.put_bool(journal.activation_ready);
    writer.put_bool(journal.mainnet_hold);
    writer.finish()?;
    Ok(bytes)
}

pub fn decode_operation_journal(bytes: &[u8]) -> Result<OperationJournal, JournalCodecError> {
    let payload = checked_payload(
        bytes,
        OPERATION_JOURNAL_BYTES_LEN,
        JOURNAL_RECORD_KIND,
        JOURNAL_PAYLOAD_LEN,
    )?;
    let mut reader = Reader::new(payload);
    let operation_id = reader.take_u64()?;
    let plan_payload: [u8; PLAN_PAYLOAD_LEN] = reader.take_array()?;
    let bound_plan = decode_plan_payload(&plan_payload)?;
    let encoded_plan_digest: Digest = reader.take_array()?;
    if encoded_plan_digest != privacy_operation_plan_digest(&bound_plan)? {
        return Err(JournalCodecError::BoundPlanDigestMismatch);
    }
    let journal = OperationJournal {
        operation_id,
        bound_plan,
        next_step_index: reader.take_u8()?,
        open_proof_contexts: reader.take_u8()?,
        status: decode_journal_status(reader.take_u8()?)?,
        authenticated_chain_observation_verified: reader.take_bool()?,
        durable_persistence_verified: reader.take_bool()?,
        activation_ready: reader.take_bool()?,
        mainnet_hold: reader.take_bool()?,
    };
    reader.finish()?;
    validate_journal_for_codec(&journal)?;
    Ok(journal)
}

pub fn operation_journal_digest(journal: &OperationJournal) -> Result<Digest, JournalCodecError> {
    let bytes = encode_operation_journal(journal)?;
    Ok(sha256_parts(&[JOURNAL_DIGEST_DOMAIN, &[0], &bytes]))
}

fn sha256_parts(parts: &[&[u8]]) -> Digest {
    const INITIAL: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    const ROUND: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];

    let message_len = parts.iter().fold(0usize, |sum, part| sum + part.len());
    let padded_len = (message_len + 9).div_ceil(64) * 64;
    debug_assert!(padded_len <= 384);
    let mut message = [0u8; 384];
    let mut offset = 0;
    for part in parts {
        let end = offset + part.len();
        message[offset..end].copy_from_slice(part);
        offset = end;
    }
    message[message_len] = 0x80;
    message[padded_len - 8..padded_len].copy_from_slice(&((message_len as u64) * 8).to_be_bytes());

    let mut state = INITIAL;
    for block in message[..padded_len].chunks_exact(64) {
        let mut words = [0u32; 64];
        for (index, word) in words[..16].iter_mut().enumerate() {
            let start = index * 4;
            *word = u32::from_be_bytes([
                block[start],
                block[start + 1],
                block[start + 2],
                block[start + 3],
            ]);
        }
        for index in 16..64 {
            let s0 = words[index - 15].rotate_right(7)
                ^ words[index - 15].rotate_right(18)
                ^ (words[index - 15] >> 3);
            let s1 = words[index - 2].rotate_right(17)
                ^ words[index - 2].rotate_right(19)
                ^ (words[index - 2] >> 10);
            words[index] = words[index - 16]
                .wrapping_add(s0)
                .wrapping_add(words[index - 7])
                .wrapping_add(s1);
        }
        let mut a = state[0];
        let mut b = state[1];
        let mut c = state[2];
        let mut d = state[3];
        let mut e = state[4];
        let mut f = state[5];
        let mut g = state[6];
        let mut h = state[7];
        for index in 0..64 {
            let big_e = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let choose = (e & f) ^ ((!e) & g);
            let first = h
                .wrapping_add(big_e)
                .wrapping_add(choose)
                .wrapping_add(ROUND[index])
                .wrapping_add(words[index]);
            let big_a = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let majority = (a & b) ^ (a & c) ^ (b & c);
            let second = big_a.wrapping_add(majority);
            h = g;
            g = f;
            f = e;
            e = d.wrapping_add(first);
            d = c;
            c = b;
            b = a;
            a = first.wrapping_add(second);
        }
        state[0] = state[0].wrapping_add(a);
        state[1] = state[1].wrapping_add(b);
        state[2] = state[2].wrapping_add(c);
        state[3] = state[3].wrapping_add(d);
        state[4] = state[4].wrapping_add(e);
        state[5] = state[5].wrapping_add(f);
        state[6] = state[6].wrapping_add(g);
        state[7] = state[7].wrapping_add(h);
    }
    let mut digest = [0; 32];
    for (index, word) in state.iter().enumerate() {
        digest[index * 4..index * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    digest
}

#[cfg(test)]
mod tests {
    use super::sha256_parts;

    #[test]
    fn local_sha256_matches_the_fips_abc_vector() {
        assert_eq!(
            sha256_parts(&[b"abc"]),
            [
                0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
                0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
                0xf2, 0x00, 0x15, 0xad,
            ]
        );
    }
}

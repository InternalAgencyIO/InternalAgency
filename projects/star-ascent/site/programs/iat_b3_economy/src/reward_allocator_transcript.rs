//! Strict no-std decoder and binding validator for the nonactivating reward
//! allocator transcript frozen by the host reference implementation.
//!
//! This module deliberately exposes no instruction, dispatcher, account
//! writer, CPI, authority check, or activation edge. Successful validation is
//! evidence about canonical bytes and their internal lineage only.

use sha2::{Digest, Sha256};

pub const ALLOCATOR_BATCH_TRANSCRIPT_LEN: usize = 320;
pub const ALLOCATOR_RECEIPT_TRANSCRIPT_LEN: usize = 288;
pub const MAX_REFERENCE_RECEIPT_CORE_LEN: usize = 1_024;
pub const REWARD_ALLOCATOR_TRANSCRIPT_STATUS: &str =
    "NATIVE_NO_STD_STRICT_DECODER_BINDING_ONLY_NONACTIVATING";
pub const REWARD_ALLOCATOR_TRANSCRIPT_MAINNET_STATUS: &str = "HOLD";

const BATCH_MAGIC: [u8; 8] = *b"IATB3RCF";
const RECEIPT_MAGIC: [u8; 8] = *b"IATB3ALR";
const VERSION: u8 = 1;
const FINALIZED_NONACTIVATING: u8 = 1;
const NONACTIVATING_REFERENCE_RECEIPT: u8 = 1;
const SHA256_SUITE: u8 = 1;
const UTC_DAY_SECONDS: i64 = 86_400;

pub const REWARD_CAPACITY_POLICY_CANONICAL_SHA256: [u8; 32] = [
    0x20, 0x54, 0xc8, 0x81, 0xf9, 0xc7, 0x52, 0x4a, 0xcb, 0x96, 0x54, 0x54, 0x28, 0x69, 0x50, 0x44,
    0x5c, 0xd3, 0x7c, 0x99, 0xf7, 0x48, 0x5b, 0x45, 0xe2, 0xc7, 0x87, 0xbc, 0xfb, 0x36, 0x17, 0xe2,
];

pub const REFERENCE_DEPLOYMENT_DOMAIN_SHA256: [u8; 32] = [
    0x48, 0x51, 0xda, 0x6c, 0xd9, 0x6c, 0x82, 0x31, 0xe0, 0xd2, 0xb8, 0x5b, 0x1f, 0x80, 0xb8, 0x89,
    0xe0, 0xe4, 0x8f, 0x52, 0x8b, 0x5a, 0xaa, 0x50, 0x56, 0xdc, 0xd8, 0x73, 0x0e, 0x21, 0x62, 0x24,
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum AllocatorDisposition {
    AdmittedReserved = 1,
    NullUnderfunded = 2,
    NullBlocked = 3,
}

impl AllocatorDisposition {
    const fn from_byte(value: u8) -> Result<Self, RewardAllocatorTranscriptError> {
        match value {
            1 => Ok(Self::AdmittedReserved),
            2 => Ok(Self::NullUnderfunded),
            3 => Ok(Self::NullBlocked),
            _ => Err(RewardAllocatorTranscriptError::UnsupportedDisposition),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum AllocatorReason {
    None = 0,
    ExactAmountNotAvailable = 1,
    HigherPriorityOrEarlierObligationUnderfunded = 2,
}

impl AllocatorReason {
    const fn from_byte(value: u8) -> Result<Self, RewardAllocatorTranscriptError> {
        match value {
            0 => Ok(Self::None),
            1 => Ok(Self::ExactAmountNotAvailable),
            2 => Ok(Self::HigherPriorityOrEarlierObligationUnderfunded),
            _ => Err(RewardAllocatorTranscriptError::UnsupportedReason),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardAllocatorBatch {
    pub policy_sha256: [u8; 32],
    pub deployment_domain_sha256: [u8; 32],
    pub funding_round_at_unix_seconds: i64,
    pub seal_sha256: [u8; 32],
    pub candidate_set_sha256: [u8; 32],
    pub pre_ledger_sha256: [u8; 32],
    pub post_ledger_sha256: [u8; 32],
    pub receipt_set_sha256: [u8; 32],
    pub outcome_sha256: [u8; 32],
    pub reference_finalization_sha256: [u8; 32],
    pub receipt_count: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardAllocatorReceipt {
    pub batch_commitment_sha256: [u8; 32],
    pub funding_round_at_unix_seconds: i64,
    pub seal_sha256: [u8; 32],
    pub reference_finalization_sha256: [u8; 32],
    pub obligation_id_sha256: [u8; 32],
    pub obligation_sha256: [u8; 32],
    pub exact_amount: u64,
    pub treasury_planned: u64,
    pub ecosystem_planned: u64,
    pub liquidity_planned: u64,
    pub reference_receipt_sha256: [u8; 32],
    pub faction_payout_sha256: Option<[u8; 32]>,
    pub disposition: AllocatorDisposition,
    pub reason: AllocatorReason,
    pub allocation_index: u32,
}

/// Parsed semantics of the exact canonical JSON bytes hashed by the host
/// reference receipt. The raw obligation identifier is constrained to the
/// canonical lowercase 32-byte hexadecimal form required by waterfall
/// obligations; its SHA-256 is retained for exact envelope comparison.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardAllocatorReferenceReceipt {
    pub funding_round_at_unix_seconds: i64,
    pub seal_sha256: [u8; 32],
    pub obligation_id_sha256: [u8; 32],
    pub obligation_sha256: [u8; 32],
    pub exact_amount: u64,
    pub treasury_planned: u64,
    pub ecosystem_planned: u64,
    pub liquidity_planned: u64,
    pub faction_payout_sha256: Option<[u8; 32]>,
    pub disposition: AllocatorDisposition,
    pub reason: AllocatorReason,
    pub receipt_sha256: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardAllocatorTranscriptBinding {
    pub batch: RewardAllocatorBatch,
    pub receipt: RewardAllocatorReceipt,
    pub reference_receipt: RewardAllocatorReferenceReceipt,
    pub batch_commitment_sha256: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RewardAllocatorTranscriptError {
    InvalidLength,
    WrongMagic,
    UnsupportedVersion,
    NonactivatingFlagRequired,
    UnsupportedHashSuite,
    ReservedBytesNonZero,
    PolicyDigestMismatch,
    DeploymentDomainNotReferenceSentinel,
    NonMidnightFundingRound,
    UnsupportedDisposition,
    UnsupportedReason,
    DispositionReasonMismatch,
    NoncanonicalFactionFlag,
    FactionPresenceMismatch,
    ExactAmountZero,
    LaneSumOverflow,
    LanePlanMismatch,
    ReceiptCountMismatch,
    AllocationIndexOutOfRange,
    DuplicateReferenceReceipt,
    ReceiptSetDigestMismatch,
    ReceiptMembershipMismatch,
    InvalidReferenceReceiptCore,
    ReferenceReceiptDigestMismatch,
    ReferenceFundingRoundMismatch,
    ReferenceSealMismatch,
    ReferenceObligationIdMismatch,
    ReferenceObligationMismatch,
    ReferenceExactAmountMismatch,
    ReferenceLanePlanMismatch,
    ReferenceFactionMismatch,
    ReferenceDispositionMismatch,
    ReferenceReasonMismatch,
    BatchCommitmentMismatch,
    FundingRoundMismatch,
    SealMismatch,
    ReferenceFinalizationMismatch,
    ReencodeMismatch,
}

/// Immutable claim boundary. The positive fields cover byte validation only;
/// all authority, mutation, and release claims remain false and fail closed.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardAllocatorTranscriptTruth {
    pub strict_no_std_decoder_present: bool,
    pub canonical_reencode_checked: bool,
    pub ordered_reference_binding_checked: bool,
    pub runtime_authentication_verified: bool,
    pub production_identity_bound: bool,
    pub durable_account_writer_present: bool,
    pub native_instruction_exposed: bool,
    pub abi_or_dispatcher_exposed: bool,
    pub activation_ready: bool,
    pub mainnet_hold: bool,
}

pub const REWARD_ALLOCATOR_TRANSCRIPT_TRUTH: RewardAllocatorTranscriptTruth =
    RewardAllocatorTranscriptTruth {
        strict_no_std_decoder_present: true,
        canonical_reencode_checked: true,
        ordered_reference_binding_checked: true,
        runtime_authentication_verified: false,
        production_identity_bound: false,
        durable_account_writer_present: false,
        native_instruction_exposed: false,
        abi_or_dispatcher_exposed: false,
        activation_ready: false,
        mainnet_hold: true,
    };

pub fn decode_reward_allocator_batch(
    input: &[u8],
) -> Result<RewardAllocatorBatch, RewardAllocatorTranscriptError> {
    let bytes: &[u8; ALLOCATOR_BATCH_TRANSCRIPT_LEN] = input
        .try_into()
        .map_err(|_| RewardAllocatorTranscriptError::InvalidLength)?;
    require_header(bytes, &BATCH_MAGIC, FINALIZED_NONACTIVATING)?;
    require_zero(&bytes[11..16])?;
    require_zero(&bytes[316..320])?;

    let decoded = RewardAllocatorBatch {
        policy_sha256: read_32(bytes, 16),
        deployment_domain_sha256: read_32(bytes, 48),
        funding_round_at_unix_seconds: read_i64(bytes, 80),
        seal_sha256: read_32(bytes, 88),
        candidate_set_sha256: read_32(bytes, 120),
        pre_ledger_sha256: read_32(bytes, 152),
        post_ledger_sha256: read_32(bytes, 184),
        receipt_set_sha256: read_32(bytes, 216),
        outcome_sha256: read_32(bytes, 248),
        reference_finalization_sha256: read_32(bytes, 280),
        receipt_count: read_u32(bytes, 312),
    };
    validate_batch_fields(&decoded)?;
    if encode_reward_allocator_batch(&decoded)? != *bytes {
        return Err(RewardAllocatorTranscriptError::ReencodeMismatch);
    }
    Ok(decoded)
}

pub fn encode_reward_allocator_batch(
    batch: &RewardAllocatorBatch,
) -> Result<[u8; ALLOCATOR_BATCH_TRANSCRIPT_LEN], RewardAllocatorTranscriptError> {
    validate_batch_fields(batch)?;
    let mut output = [0u8; ALLOCATOR_BATCH_TRANSCRIPT_LEN];
    write_header(&mut output, &BATCH_MAGIC, FINALIZED_NONACTIVATING);
    write_32(&mut output, 16, &batch.policy_sha256);
    write_32(&mut output, 48, &batch.deployment_domain_sha256);
    write_i64(&mut output, 80, batch.funding_round_at_unix_seconds);
    write_32(&mut output, 88, &batch.seal_sha256);
    write_32(&mut output, 120, &batch.candidate_set_sha256);
    write_32(&mut output, 152, &batch.pre_ledger_sha256);
    write_32(&mut output, 184, &batch.post_ledger_sha256);
    write_32(&mut output, 216, &batch.receipt_set_sha256);
    write_32(&mut output, 248, &batch.outcome_sha256);
    write_32(&mut output, 280, &batch.reference_finalization_sha256);
    write_u32(&mut output, 312, batch.receipt_count);
    Ok(output)
}

pub fn decode_reward_allocator_receipt(
    input: &[u8],
) -> Result<RewardAllocatorReceipt, RewardAllocatorTranscriptError> {
    let bytes: &[u8; ALLOCATOR_RECEIPT_TRANSCRIPT_LEN] = input
        .try_into()
        .map_err(|_| RewardAllocatorTranscriptError::InvalidLength)?;
    require_header(bytes, &RECEIPT_MAGIC, NONACTIVATING_REFERENCE_RECEIPT)?;
    require_zero(&bytes[11..16])?;
    if bytes[283] != 0 {
        return Err(RewardAllocatorTranscriptError::ReservedBytesNonZero);
    }
    let faction_digest = read_32(bytes, 248);
    let faction_payout_sha256 = match bytes[282] {
        0 if faction_digest == [0u8; 32] => None,
        1 if faction_digest != [0u8; 32] => Some(faction_digest),
        0 | 1 => return Err(RewardAllocatorTranscriptError::FactionPresenceMismatch),
        _ => return Err(RewardAllocatorTranscriptError::NoncanonicalFactionFlag),
    };
    let decoded = RewardAllocatorReceipt {
        batch_commitment_sha256: read_32(bytes, 16),
        funding_round_at_unix_seconds: read_i64(bytes, 48),
        seal_sha256: read_32(bytes, 56),
        reference_finalization_sha256: read_32(bytes, 88),
        obligation_id_sha256: read_32(bytes, 120),
        obligation_sha256: read_32(bytes, 152),
        exact_amount: read_u64(bytes, 184),
        treasury_planned: read_u64(bytes, 192),
        ecosystem_planned: read_u64(bytes, 200),
        liquidity_planned: read_u64(bytes, 208),
        reference_receipt_sha256: read_32(bytes, 216),
        faction_payout_sha256,
        disposition: AllocatorDisposition::from_byte(bytes[280])?,
        reason: AllocatorReason::from_byte(bytes[281])?,
        allocation_index: read_u32(bytes, 284),
    };
    validate_receipt_fields(&decoded)?;
    if encode_reward_allocator_receipt(&decoded)? != *bytes {
        return Err(RewardAllocatorTranscriptError::ReencodeMismatch);
    }
    Ok(decoded)
}

pub fn encode_reward_allocator_receipt(
    receipt: &RewardAllocatorReceipt,
) -> Result<[u8; ALLOCATOR_RECEIPT_TRANSCRIPT_LEN], RewardAllocatorTranscriptError> {
    validate_receipt_fields(receipt)?;
    let mut output = [0u8; ALLOCATOR_RECEIPT_TRANSCRIPT_LEN];
    write_header(&mut output, &RECEIPT_MAGIC, NONACTIVATING_REFERENCE_RECEIPT);
    write_32(&mut output, 16, &receipt.batch_commitment_sha256);
    write_i64(&mut output, 48, receipt.funding_round_at_unix_seconds);
    write_32(&mut output, 56, &receipt.seal_sha256);
    write_32(&mut output, 88, &receipt.reference_finalization_sha256);
    write_32(&mut output, 120, &receipt.obligation_id_sha256);
    write_32(&mut output, 152, &receipt.obligation_sha256);
    write_u64(&mut output, 184, receipt.exact_amount);
    write_u64(&mut output, 192, receipt.treasury_planned);
    write_u64(&mut output, 200, receipt.ecosystem_planned);
    write_u64(&mut output, 208, receipt.liquidity_planned);
    write_32(&mut output, 216, &receipt.reference_receipt_sha256);
    if let Some(faction) = receipt.faction_payout_sha256 {
        write_32(&mut output, 248, &faction);
        output[282] = 1;
    }
    output[280] = receipt.disposition as u8;
    output[281] = receipt.reason as u8;
    write_u32(&mut output, 284, receipt.allocation_index);
    Ok(output)
}

pub fn reward_allocator_batch_sha256(
    batch_bytes: &[u8],
) -> Result<[u8; 32], RewardAllocatorTranscriptError> {
    let exact: &[u8; ALLOCATOR_BATCH_TRANSCRIPT_LEN] = batch_bytes
        .try_into()
        .map_err(|_| RewardAllocatorTranscriptError::InvalidLength)?;
    Ok(Sha256::digest(exact).into())
}

pub fn validate_reward_allocator_transcript_binding(
    batch_bytes: &[u8],
    receipt_bytes: &[u8],
    ordered_reference_receipt_sha256: &[[u8; 32]],
    reference_receipt_core_bytes: &[u8],
) -> Result<RewardAllocatorTranscriptBinding, RewardAllocatorTranscriptError> {
    let batch = decode_reward_allocator_batch(batch_bytes)?;
    let receipt = decode_reward_allocator_receipt(receipt_bytes)?;
    if ordered_reference_receipt_sha256.len() != batch.receipt_count as usize {
        return Err(RewardAllocatorTranscriptError::ReceiptCountMismatch);
    }
    for index in 0..ordered_reference_receipt_sha256.len() {
        if ordered_reference_receipt_sha256[index + 1..]
            .iter()
            .any(|digest| digest == &ordered_reference_receipt_sha256[index])
        {
            return Err(RewardAllocatorTranscriptError::DuplicateReferenceReceipt);
        }
    }
    if canonical_reference_receipt_set_sha256(ordered_reference_receipt_sha256)
        != batch.receipt_set_sha256
    {
        return Err(RewardAllocatorTranscriptError::ReceiptSetDigestMismatch);
    }
    let allocation_index = receipt.allocation_index as usize;
    if allocation_index >= ordered_reference_receipt_sha256.len() {
        return Err(RewardAllocatorTranscriptError::AllocationIndexOutOfRange);
    }
    let reference_receipt = decode_reference_receipt_core(reference_receipt_core_bytes)?;
    if ordered_reference_receipt_sha256[allocation_index] != reference_receipt.receipt_sha256 {
        return Err(RewardAllocatorTranscriptError::ReferenceReceiptDigestMismatch);
    }
    if receipt.reference_receipt_sha256 != reference_receipt.receipt_sha256 {
        return Err(RewardAllocatorTranscriptError::ReceiptMembershipMismatch);
    }
    let batch_commitment_sha256 = reward_allocator_batch_sha256(batch_bytes)?;
    if receipt.batch_commitment_sha256 != batch_commitment_sha256 {
        return Err(RewardAllocatorTranscriptError::BatchCommitmentMismatch);
    }
    if receipt.funding_round_at_unix_seconds != batch.funding_round_at_unix_seconds {
        return Err(RewardAllocatorTranscriptError::FundingRoundMismatch);
    }
    if receipt.seal_sha256 != batch.seal_sha256 {
        return Err(RewardAllocatorTranscriptError::SealMismatch);
    }
    if receipt.reference_finalization_sha256 != batch.reference_finalization_sha256 {
        return Err(RewardAllocatorTranscriptError::ReferenceFinalizationMismatch);
    }
    compare_reference_receipt(&receipt, &reference_receipt)?;
    Ok(RewardAllocatorTranscriptBinding {
        batch,
        receipt,
        reference_receipt,
        batch_commitment_sha256,
    })
}

fn compare_reference_receipt(
    receipt: &RewardAllocatorReceipt,
    reference: &RewardAllocatorReferenceReceipt,
) -> Result<(), RewardAllocatorTranscriptError> {
    if receipt.funding_round_at_unix_seconds != reference.funding_round_at_unix_seconds {
        return Err(RewardAllocatorTranscriptError::ReferenceFundingRoundMismatch);
    }
    if receipt.seal_sha256 != reference.seal_sha256 {
        return Err(RewardAllocatorTranscriptError::ReferenceSealMismatch);
    }
    if receipt.obligation_id_sha256 != reference.obligation_id_sha256 {
        return Err(RewardAllocatorTranscriptError::ReferenceObligationIdMismatch);
    }
    if receipt.obligation_sha256 != reference.obligation_sha256 {
        return Err(RewardAllocatorTranscriptError::ReferenceObligationMismatch);
    }
    if receipt.exact_amount != reference.exact_amount {
        return Err(RewardAllocatorTranscriptError::ReferenceExactAmountMismatch);
    }
    if receipt.treasury_planned != reference.treasury_planned
        || receipt.ecosystem_planned != reference.ecosystem_planned
        || receipt.liquidity_planned != reference.liquidity_planned
    {
        return Err(RewardAllocatorTranscriptError::ReferenceLanePlanMismatch);
    }
    if receipt.faction_payout_sha256 != reference.faction_payout_sha256 {
        return Err(RewardAllocatorTranscriptError::ReferenceFactionMismatch);
    }
    if receipt.disposition != reference.disposition {
        return Err(RewardAllocatorTranscriptError::ReferenceDispositionMismatch);
    }
    if receipt.reason != reference.reason {
        return Err(RewardAllocatorTranscriptError::ReferenceReasonMismatch);
    }
    Ok(())
}

fn decode_reference_receipt_core(
    bytes: &[u8],
) -> Result<RewardAllocatorReferenceReceipt, RewardAllocatorTranscriptError> {
    if bytes.is_empty() || bytes.len() > MAX_REFERENCE_RECEIPT_CORE_LEN {
        return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
    }
    let mut cursor = CanonicalReceiptCursor::new(bytes);
    cursor.require(b"{\"activationReady\":false,\"disposition\":")?;
    let disposition = cursor.disposition()?;
    cursor.require(b",\"exactAmount\":")?;
    let exact_amount = cursor.u64_string()?;
    cursor.require(b",\"factionPayoutDigest\":")?;
    let faction_payout_sha256 = cursor.nullable_hex32()?;
    cursor.require(b",\"fundingRoundAtUnixSeconds\":")?;
    let funding_round_at_unix_seconds = cursor.i64_string()?;
    cursor.require(b",\"obligationId\":\"")?;
    let obligation_id_ascii = cursor.canonical_hex_ascii_32()?;
    cursor.require(b"\",\"obligationSha256\":")?;
    let obligation_sha256 = cursor.hex32_string()?;
    cursor.require(b",\"plannedByLane\":")?;
    let (ecosystem_planned, liquidity_planned, treasury_planned, has_lane_plan) =
        cursor.nullable_lane_plan()?;
    cursor.require(b",\"reason\":")?;
    let (reason, has_reason) = cursor.nullable_reference_reason()?;
    cursor
        .require(b",\"schema\":\"iat-b3-reward-capacity-allocator-receipt/v1\",\"sealSha256\":")?;
    let seal_sha256 = cursor.hex32_string()?;
    cursor.require(b",\"status\":\"NON_ACTIVATING_REFERENCE_RECEIPT\"}")?;
    if !cursor.finished() {
        return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
    }

    let raw_shape_valid = match disposition {
        AllocatorDisposition::AdmittedReserved => has_lane_plan && !has_reason,
        AllocatorDisposition::NullUnderfunded | AllocatorDisposition::NullBlocked => {
            !has_lane_plan && has_reason
        }
    };
    if !raw_shape_valid {
        return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
    }

    let reference = RewardAllocatorReferenceReceipt {
        funding_round_at_unix_seconds,
        seal_sha256,
        obligation_id_sha256: Sha256::digest(obligation_id_ascii).into(),
        obligation_sha256,
        exact_amount,
        treasury_planned,
        ecosystem_planned,
        liquidity_planned,
        faction_payout_sha256,
        disposition,
        reason,
        receipt_sha256: Sha256::digest(bytes).into(),
    };
    validate_reference_receipt_fields(&reference)?;
    Ok(reference)
}

fn validate_reference_receipt_fields(
    reference: &RewardAllocatorReferenceReceipt,
) -> Result<(), RewardAllocatorTranscriptError> {
    require_midnight(reference.funding_round_at_unix_seconds)?;
    if reference.exact_amount == 0 {
        return Err(RewardAllocatorTranscriptError::ExactAmountZero);
    }
    validate_disposition_reason(reference.disposition, reference.reason)?;
    let lane_sum = reference
        .treasury_planned
        .checked_add(reference.ecosystem_planned)
        .and_then(|value| value.checked_add(reference.liquidity_planned))
        .ok_or(RewardAllocatorTranscriptError::LaneSumOverflow)?;
    let valid = match reference.disposition {
        AllocatorDisposition::AdmittedReserved => lane_sum == reference.exact_amount,
        AllocatorDisposition::NullUnderfunded | AllocatorDisposition::NullBlocked => lane_sum == 0,
    };
    if !valid {
        return Err(RewardAllocatorTranscriptError::LanePlanMismatch);
    }
    if reference
        .faction_payout_sha256
        .is_some_and(|digest| digest == [0u8; 32])
    {
        return Err(RewardAllocatorTranscriptError::FactionPresenceMismatch);
    }
    Ok(())
}

struct CanonicalReceiptCursor<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> CanonicalReceiptCursor<'a> {
    const fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn finished(&self) -> bool {
        self.offset == self.bytes.len()
    }

    fn require(&mut self, expected: &[u8]) -> Result<(), RewardAllocatorTranscriptError> {
        if !self.bytes[self.offset..].starts_with(expected) {
            return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
        }
        self.offset += expected.len();
        Ok(())
    }

    fn disposition(&mut self) -> Result<AllocatorDisposition, RewardAllocatorTranscriptError> {
        for (encoded, disposition) in [
            (
                b"\"ADMITTED_RESERVED\"".as_slice(),
                AllocatorDisposition::AdmittedReserved,
            ),
            (
                b"\"NULL_UNDERFUNDED\"".as_slice(),
                AllocatorDisposition::NullUnderfunded,
            ),
            (
                b"\"NULL_BLOCKED\"".as_slice(),
                AllocatorDisposition::NullBlocked,
            ),
        ] {
            if self.bytes[self.offset..].starts_with(encoded) {
                self.offset += encoded.len();
                return Ok(disposition);
            }
        }
        Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)
    }

    fn nullable_reference_reason(
        &mut self,
    ) -> Result<(AllocatorReason, bool), RewardAllocatorTranscriptError> {
        if self.bytes[self.offset..].starts_with(b"null") {
            self.offset += 4;
            return Ok((AllocatorReason::None, false));
        }
        for (encoded, reason) in [
            (
                b"\"EXACT_AMOUNT_NOT_AVAILABLE\"".as_slice(),
                AllocatorReason::ExactAmountNotAvailable,
            ),
            (
                b"\"HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED\"".as_slice(),
                AllocatorReason::HigherPriorityOrEarlierObligationUnderfunded,
            ),
        ] {
            if self.bytes[self.offset..].starts_with(encoded) {
                self.offset += encoded.len();
                return Ok((reason, true));
            }
        }
        Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)
    }

    fn nullable_lane_plan(
        &mut self,
    ) -> Result<(u64, u64, u64, bool), RewardAllocatorTranscriptError> {
        if self.bytes[self.offset..].starts_with(b"null") {
            self.offset += 4;
            return Ok((0, 0, 0, false));
        }
        self.require(b"{\"ecosystem\":")?;
        let ecosystem = self.u64_string()?;
        self.require(b",\"liquidity\":")?;
        let liquidity = self.u64_string()?;
        self.require(b",\"treasury\":")?;
        let treasury = self.u64_string()?;
        self.require(b"}")?;
        Ok((ecosystem, liquidity, treasury, true))
    }

    fn nullable_hex32(&mut self) -> Result<Option<[u8; 32]>, RewardAllocatorTranscriptError> {
        if self.bytes[self.offset..].starts_with(b"null") {
            self.offset += 4;
            Ok(None)
        } else {
            self.hex32_string().map(Some)
        }
    }

    fn hex32_string(&mut self) -> Result<[u8; 32], RewardAllocatorTranscriptError> {
        self.require(b"\"")?;
        let encoded = self.canonical_hex_ascii_32()?;
        let decoded = decode_lower_hex_32(encoded)?;
        self.require(b"\"")?;
        Ok(decoded)
    }

    fn canonical_hex_ascii_32(&mut self) -> Result<&'a [u8], RewardAllocatorTranscriptError> {
        let end = self
            .offset
            .checked_add(64)
            .ok_or(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)?;
        let encoded = self
            .bytes
            .get(self.offset..end)
            .ok_or(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)?;
        if encoded
            .iter()
            .any(|byte| !byte.is_ascii_digit() && !(b'a'..=b'f').contains(byte))
        {
            return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
        }
        self.offset = end;
        Ok(encoded)
    }

    fn u64_string(&mut self) -> Result<u64, RewardAllocatorTranscriptError> {
        let digits = self.decimal_string(false)?;
        let mut value = 0u64;
        for digit in digits {
            value = value
                .checked_mul(10)
                .and_then(|current| current.checked_add(u64::from(digit - b'0')))
                .ok_or(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)?;
        }
        Ok(value)
    }

    fn i64_string(&mut self) -> Result<i64, RewardAllocatorTranscriptError> {
        let raw = self.decimal_string(true)?;
        let negative = raw[0] == b'-';
        let digits = if negative { &raw[1..] } else { raw };
        let mut magnitude = 0u64;
        for digit in digits {
            magnitude = magnitude
                .checked_mul(10)
                .and_then(|current| current.checked_add(u64::from(digit - b'0')))
                .ok_or(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)?;
        }
        if negative {
            if magnitude == (i64::MAX as u64) + 1 {
                Ok(i64::MIN)
            } else if magnitude <= i64::MAX as u64 {
                Ok(-(magnitude as i64))
            } else {
                Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)
            }
        } else {
            i64::try_from(magnitude)
                .map_err(|_| RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)
        }
    }

    fn decimal_string(&mut self, signed: bool) -> Result<&'a [u8], RewardAllocatorTranscriptError> {
        self.require(b"\"")?;
        let start = self.offset;
        let end = self.bytes[start..]
            .iter()
            .position(|byte| *byte == b'\"')
            .and_then(|relative| start.checked_add(relative))
            .ok_or(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore)?;
        let value = &self.bytes[start..end];
        if value.is_empty() {
            return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
        }
        let digits = if signed && value[0] == b'-' {
            if value.len() == 1 || value.get(1) == Some(&b'0') {
                return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
            }
            &value[1..]
        } else {
            value
        };
        if digits.iter().any(|byte| !byte.is_ascii_digit())
            || (digits.len() > 1 && digits[0] == b'0')
        {
            return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
        }
        self.offset = end + 1;
        Ok(value)
    }
}

fn decode_lower_hex_32(value: &[u8]) -> Result<[u8; 32], RewardAllocatorTranscriptError> {
    if value.len() != 64 {
        return Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore);
    }
    let mut decoded = [0u8; 32];
    for (index, pair) in value.chunks_exact(2).enumerate() {
        let high = lower_hex_nibble(pair[0])?;
        let low = lower_hex_nibble(pair[1])?;
        decoded[index] = (high << 4) | low;
    }
    Ok(decoded)
}

fn lower_hex_nibble(value: u8) -> Result<u8, RewardAllocatorTranscriptError> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err(RewardAllocatorTranscriptError::InvalidReferenceReceiptCore),
    }
}

fn validate_batch_fields(
    batch: &RewardAllocatorBatch,
) -> Result<(), RewardAllocatorTranscriptError> {
    if batch.policy_sha256 != REWARD_CAPACITY_POLICY_CANONICAL_SHA256 {
        return Err(RewardAllocatorTranscriptError::PolicyDigestMismatch);
    }
    if batch.deployment_domain_sha256 != REFERENCE_DEPLOYMENT_DOMAIN_SHA256 {
        return Err(RewardAllocatorTranscriptError::DeploymentDomainNotReferenceSentinel);
    }
    require_midnight(batch.funding_round_at_unix_seconds)
}

fn validate_receipt_fields(
    receipt: &RewardAllocatorReceipt,
) -> Result<(), RewardAllocatorTranscriptError> {
    require_midnight(receipt.funding_round_at_unix_seconds)?;
    if receipt.exact_amount == 0 {
        return Err(RewardAllocatorTranscriptError::ExactAmountZero);
    }
    validate_disposition_reason(receipt.disposition, receipt.reason)?;
    let lane_sum = receipt
        .treasury_planned
        .checked_add(receipt.ecosystem_planned)
        .and_then(|value| value.checked_add(receipt.liquidity_planned))
        .ok_or(RewardAllocatorTranscriptError::LaneSumOverflow)?;
    let lane_plan_valid = match receipt.disposition {
        AllocatorDisposition::AdmittedReserved => lane_sum == receipt.exact_amount,
        AllocatorDisposition::NullUnderfunded | AllocatorDisposition::NullBlocked => lane_sum == 0,
    };
    if !lane_plan_valid {
        return Err(RewardAllocatorTranscriptError::LanePlanMismatch);
    }
    if receipt
        .faction_payout_sha256
        .is_some_and(|digest| digest == [0u8; 32])
    {
        return Err(RewardAllocatorTranscriptError::FactionPresenceMismatch);
    }
    Ok(())
}

const fn validate_disposition_reason(
    disposition: AllocatorDisposition,
    reason: AllocatorReason,
) -> Result<(), RewardAllocatorTranscriptError> {
    let valid = matches!(
        (disposition, reason),
        (
            AllocatorDisposition::AdmittedReserved,
            AllocatorReason::None
        ) | (
            AllocatorDisposition::NullUnderfunded,
            AllocatorReason::ExactAmountNotAvailable
        ) | (
            AllocatorDisposition::NullBlocked,
            AllocatorReason::HigherPriorityOrEarlierObligationUnderfunded
        )
    );
    if valid {
        Ok(())
    } else {
        Err(RewardAllocatorTranscriptError::DispositionReasonMismatch)
    }
}

fn canonical_reference_receipt_set_sha256(receipts: &[[u8; 32]]) -> [u8; 32] {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut hasher = Sha256::new();
    hasher.update(b"[");
    for (index, digest) in receipts.iter().enumerate() {
        if index != 0 {
            hasher.update(b",");
        }
        hasher.update(b"\"");
        for byte in digest {
            hasher.update([HEX[(byte >> 4) as usize], HEX[(byte & 0x0f) as usize]]);
        }
        hasher.update(b"\"");
    }
    hasher.update(b"]");
    hasher.finalize().into()
}

fn require_header(
    bytes: &[u8],
    magic: &[u8; 8],
    required_status: u8,
) -> Result<(), RewardAllocatorTranscriptError> {
    if bytes[..8] != *magic {
        return Err(RewardAllocatorTranscriptError::WrongMagic);
    }
    if bytes[8] != VERSION {
        return Err(RewardAllocatorTranscriptError::UnsupportedVersion);
    }
    if bytes[9] != required_status {
        return Err(RewardAllocatorTranscriptError::NonactivatingFlagRequired);
    }
    if bytes[10] != SHA256_SUITE {
        return Err(RewardAllocatorTranscriptError::UnsupportedHashSuite);
    }
    Ok(())
}

fn write_header(bytes: &mut [u8], magic: &[u8; 8], status: u8) {
    bytes[..8].copy_from_slice(magic);
    bytes[8] = VERSION;
    bytes[9] = status;
    bytes[10] = SHA256_SUITE;
}

fn require_zero(bytes: &[u8]) -> Result<(), RewardAllocatorTranscriptError> {
    if bytes.iter().any(|byte| *byte != 0) {
        Err(RewardAllocatorTranscriptError::ReservedBytesNonZero)
    } else {
        Ok(())
    }
}

fn require_midnight(value: i64) -> Result<(), RewardAllocatorTranscriptError> {
    if value % UTC_DAY_SECONDS == 0 {
        Ok(())
    } else {
        Err(RewardAllocatorTranscriptError::NonMidnightFundingRound)
    }
}

fn read_32(bytes: &[u8], offset: usize) -> [u8; 32] {
    let mut output = [0u8; 32];
    output.copy_from_slice(&bytes[offset..offset + 32]);
    output
}

fn write_32(bytes: &mut [u8], offset: usize, value: &[u8; 32]) {
    bytes[offset..offset + 32].copy_from_slice(value);
}

fn read_i64(bytes: &[u8], offset: usize) -> i64 {
    let mut value = [0u8; 8];
    value.copy_from_slice(&bytes[offset..offset + 8]);
    i64::from_le_bytes(value)
}

fn write_i64(bytes: &mut [u8], offset: usize, value: i64) {
    bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}

fn read_u64(bytes: &[u8], offset: usize) -> u64 {
    let mut value = [0u8; 8];
    value.copy_from_slice(&bytes[offset..offset + 8]);
    u64::from_le_bytes(value)
}

fn write_u64(bytes: &mut [u8], offset: usize, value: u64) {
    bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    let mut value = [0u8; 4];
    value.copy_from_slice(&bytes[offset..offset + 4]);
    u32::from_le_bytes(value)
}

fn write_u32(bytes: &mut [u8], offset: usize, value: u32) {
    bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

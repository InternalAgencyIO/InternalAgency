//! No-std verification of the allocation implied by externally prevalidated,
//! exact committed reward-capacity seal bytes.
//!
//! This is deliberately a nonactivating parity boundary. It hashes and parses
//! the supported committed-seal shape, verifies the seal/batch commitments,
//! applies the committed CCC reveal ordering, recomputes the three-lane
//! waterfall, and binds every result to the strict allocator receipt decoder.
//! The caller must first establish exact host canonical-seal semantics. This
//! module does not validate candidate derivations, all nested variant semantics,
//! non-CCC chronology ordering, source authenticity, the round clock, Daily Law,
//! or how the seal reached the caller. It exposes no instruction, account writer,
//! CPI, dispatcher, authority, or activation edge.

use core::cmp::Ordering;

use sha2::{Digest, Sha256};

use crate::{
    decode_reward_allocator_batch, validate_reward_allocator_transcript_binding,
    AllocatorDisposition, AllocatorReason, RewardAllocatorTranscriptError,
};

pub const REWARD_CAPACITY_RECOMPUTATION_STATUS: &str =
    "EXTERNALLY_PREVALIDATED_COMMITTED_SEAL_ALLOCATION_PARITY_ONLY_NONACTIVATING";
pub const REWARD_CAPACITY_RECOMPUTATION_MAINNET_STATUS: &str = "HOLD";

const UTC_DAY_SECONDS: i64 = 86_400;
const CCC_COMMITMENT_SCHEME: &[u8] = b"IAT_B3_CCC_REVEAL_COMMITMENT_V1";
const CCC_CONTEXT_DOMAIN: &[u8] = b"IAT_B3_CCC_CAPACITY_DECISION_CONTEXT_V1";
const CCC_ORDER_DOMAIN: &[u8] = b"IAT_B3_CCC_CAPACITY_ORDER_V1";
const TIEBREAK_DOMAIN: &[u8] = b"IAT_TIEBREAK_V1";
const MAX_TIEBREAK_ATTEMPTS: u32 = 16;
const POLICY_HEX: &[u8] = b"2054c881f9c7524acb965454286950445cd37c99f7485b45e2c787bcfb3617e2";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
enum Priority {
    CccAgent = 0,
    CccAssociate = 1,
    Standard = 2,
    WeeklyFaction = 3,
    Core = 4,
}

impl Priority {
    fn parse(value: &[u8]) -> Result<Self, RewardCapacityRecomputationError> {
        match value {
            b"CCC_AGENT" => Ok(Self::CccAgent),
            b"CCC_ASSOCIATE" => Ok(Self::CccAssociate),
            b"STANDARD_10_PERCENT_AND_X_CAMPAIGN" => Ok(Self::Standard),
            b"WEEKLY_FACTION" => Ok(Self::WeeklyFaction),
            b"CORE" => Ok(Self::Core),
            _ => Err(RewardCapacityRecomputationError::UnsupportedPriority),
        }
    }

    const fn is_ccc(self) -> bool {
        matches!(self, Self::CccAgent | Self::CccAssociate)
    }

    const fn ascii(self) -> &'static [u8] {
        match self {
            Self::CccAgent => b"CCC_AGENT",
            Self::CccAssociate => b"CCC_ASSOCIATE",
            Self::Standard => b"STANDARD_10_PERCENT_AND_X_CAMPAIGN",
            Self::WeeklyFaction => b"WEEKLY_FACTION",
            Self::Core => b"CORE",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardCapacityCandidateScratch {
    id: [u8; 32],
    obligation_sha256: [u8; 32],
    amount: u64,
    funding_round: i64,
    priority: Priority,
    qualifying_activity_start_slot: u64,
    node_activation_slot: u64,
    eligible_sequence: u64,
    qualification_pda: [u8; 32],
    faction_payout_sha256: Option<[u8; 32]>,
    expected_id_present: bool,
}

impl RewardCapacityCandidateScratch {
    pub const EMPTY: Self = Self {
        id: [0; 32],
        obligation_sha256: [0; 32],
        amount: 0,
        funding_round: 0,
        priority: Priority::Core,
        qualifying_activity_start_slot: 0,
        node_activation_slot: 0,
        eligible_sequence: 0,
        qualification_pda: [0; 32],
        faction_payout_sha256: None,
        expected_id_present: false,
    };
}

#[derive(Clone, Copy, Debug)]
pub struct RewardCapacityReceiptInput<'a> {
    pub receipt_bytes: &'a [u8],
    pub reference_receipt_core_bytes: &'a [u8],
}

#[derive(Clone, Copy, Debug)]
pub struct RewardCapacityCccReveal<'a> {
    /// Exact unescaped UTF-8 source identifier committed by the seal.
    pub source_id: &'a [u8],
    pub randomness: [u8; 32],
}

pub struct RewardCapacityRecomputationWorkspace<'a> {
    pub candidates: &'a mut [RewardCapacityCandidateScratch],
    pub allocation_order: &'a mut [u32],
    pub reference_receipt_sha256: &'a mut [[u8; 32]],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardCapacityRecomputationReceipt {
    pub candidate_count: u32,
    pub seal_sha256: [u8; 32],
    pub candidate_set_sha256: [u8; 32],
    pub pre_ledger_sha256: [u8; 32],
    pub post_ledger_sha256: [u8; 32],
    pub receipt_set_sha256: [u8; 32],
    pub outcome_sha256: [u8; 32],
    pub finalization_sha256: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RewardCapacityRecomputationError {
    InvalidCanonicalJson,
    InvalidSealShape,
    UnsupportedSealSemantics,
    UnsupportedPriority,
    WorkspaceLengthMismatch,
    CandidateCountMismatch,
    DuplicateCandidateId,
    DuplicateCccQualificationPda,
    MultipleWeeklyFactionManifests,
    CandidateIdMismatch,
    CandidateDigestMismatch,
    CandidateOrderMismatch,
    CandidateAmountZero,
    FundingRoundMismatch,
    SealDigestMismatch,
    CandidateSetDigestMismatch,
    LedgerDigestMismatch,
    LedgerAccountingCorrupt,
    RegistryDigestMismatch,
    CccTieContractMismatch,
    CccCommitmentMismatch,
    CccContextMismatch,
    CccRevealMismatch,
    TiebreakExhausted,
    ReceiptBinding(RewardAllocatorTranscriptError),
    ReceiptOrderMismatch,
    ReceiptCandidateMismatch,
    ReceiptDecisionMismatch,
    ReservationOverflow,
    PostLedgerDigestMismatch,
    ReceiptSetDigestMismatch,
    OutcomeDigestMismatch,
    FinalizationDigestMismatch,
}

impl From<RewardAllocatorTranscriptError> for RewardCapacityRecomputationError {
    fn from(value: RewardAllocatorTranscriptError) -> Self {
        Self::ReceiptBinding(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RewardCapacityRecomputationTruth {
    pub externally_canonical_seal_required: bool,
    pub exact_seal_bytes_bound: bool,
    pub committed_ccc_order_recomputed: bool,
    pub lane_waterfall_recomputed: bool,
    pub downstream_commitments_recomputed: bool,
    pub candidate_id_uniqueness_verified: bool,
    pub per_ccc_priority_tier_qualification_pda_uniqueness_verified: bool,
    pub at_most_one_weekly_faction_manifest_verified: bool,
    pub canonical_seal_semantics_verified: bool,
    pub candidate_identifier_derivations_verified: bool,
    pub non_ccc_chronology_recomputed: bool,
    pub escaped_source_identifiers_supported: bool,
    pub source_kind_authenticated: bool,
    pub chronology_authenticated: bool,
    pub round_clock_authenticated: bool,
    pub daily_law_provenance_authenticated: bool,
    pub production_identity_bound: bool,
    pub durable_account_writer_present: bool,
    pub native_instruction_exposed: bool,
    pub abi_or_dispatcher_exposed: bool,
    pub activation_ready: bool,
    pub mainnet_hold: bool,
}

pub const REWARD_CAPACITY_RECOMPUTATION_TRUTH: RewardCapacityRecomputationTruth =
    RewardCapacityRecomputationTruth {
        externally_canonical_seal_required: true,
        exact_seal_bytes_bound: true,
        committed_ccc_order_recomputed: true,
        lane_waterfall_recomputed: true,
        downstream_commitments_recomputed: true,
        candidate_id_uniqueness_verified: true,
        per_ccc_priority_tier_qualification_pda_uniqueness_verified: true,
        at_most_one_weekly_faction_manifest_verified: true,
        canonical_seal_semantics_verified: false,
        candidate_identifier_derivations_verified: false,
        non_ccc_chronology_recomputed: false,
        escaped_source_identifiers_supported: false,
        source_kind_authenticated: false,
        chronology_authenticated: false,
        round_clock_authenticated: false,
        daily_law_provenance_authenticated: false,
        production_identity_bound: false,
        durable_account_writer_present: false,
        native_instruction_exposed: false,
        abi_or_dispatcher_exposed: false,
        activation_ready: false,
        mainnet_hold: true,
    };

#[derive(Clone, Copy)]
struct Span {
    start: usize,
    end: usize,
}

impl Span {
    fn bytes(self, input: &[u8]) -> &[u8] {
        &input[self.start..self.end]
    }
}

#[derive(Clone, Copy, Default)]
struct Lane {
    unlocked: u64,
    reserved: u64,
    paid: u64,
    withdrawn: u64,
}

impl Lane {
    fn available(self) -> Result<u64, RewardCapacityRecomputationError> {
        let used = self
            .reserved
            .checked_add(self.paid)
            .and_then(|value| value.checked_add(self.withdrawn))
            .ok_or(RewardCapacityRecomputationError::LedgerAccountingCorrupt)?;
        self.unlocked
            .checked_sub(used)
            .ok_or(RewardCapacityRecomputationError::LedgerAccountingCorrupt)
    }
}

#[derive(Clone, Copy, Default)]
struct Ledger {
    // Economic order, deliberately distinct from canonical JSON key order.
    treasury: Lane,
    ecosystem: Lane,
    liquidity: Lane,
}

#[derive(Clone, Copy)]
struct Registry<'a> {
    entry_span: Option<Span>,
    source_id: Option<&'a [u8]>,
    committed_at: Option<i64>,
    commitment_sha256: Option<[u8; 32]>,
    snapshot_sha256: [u8; 32],
    funding_round: i64,
}

struct ParsedSeal<'a> {
    funding_round: i64,
    candidate_set_sha256: [u8; 32],
    ledger_sha256: [u8; 32],
    ledger: Ledger,
    registry: Registry<'a>,
    reveal_commitment: Option<Span>,
    decision_context: Option<[u8; 32]>,
}

/// Verify the allocation and downstream commitments implied by externally
/// prevalidated, exact committed-seal bytes.
///
/// # Precondition
///
/// `externally_prevalidated_seal_bytes` must already have passed the exact host
/// canonical seal validator. This function binds those bytes and checks a
/// deliberately narrower allocation-parity subset; it does not establish that
/// precondition or standalone seal authority.
pub fn verify_reward_capacity_allocation_recomputation(
    batch_bytes: &[u8],
    externally_prevalidated_seal_bytes: &[u8],
    ccc_reveal: Option<RewardCapacityCccReveal<'_>>,
    receipts: &[RewardCapacityReceiptInput<'_>],
    workspace: RewardCapacityRecomputationWorkspace<'_>,
) -> Result<RewardCapacityRecomputationReceipt, RewardCapacityRecomputationError> {
    let batch = decode_reward_allocator_batch(batch_bytes)?;
    let count = usize::try_from(batch.receipt_count)
        .map_err(|_| RewardCapacityRecomputationError::CandidateCountMismatch)?;
    if receipts.len() != count
        || workspace.candidates.len() != count
        || workspace.allocation_order.len() != count
        || workspace.reference_receipt_sha256.len() != count
    {
        return Err(RewardCapacityRecomputationError::WorkspaceLengthMismatch);
    }

    let seal_sha256: [u8; 32] = Sha256::digest(externally_prevalidated_seal_bytes).into();
    if seal_sha256 != batch.seal_sha256 {
        return Err(RewardCapacityRecomputationError::SealDigestMismatch);
    }

    let parsed = parse_seal(
        externally_prevalidated_seal_bytes,
        workspace.candidates,
        count,
    )?;
    if parsed.funding_round != batch.funding_round_at_unix_seconds {
        return Err(RewardCapacityRecomputationError::FundingRoundMismatch);
    }
    if parsed.candidate_set_sha256 != batch.candidate_set_sha256 {
        return Err(RewardCapacityRecomputationError::CandidateSetDigestMismatch);
    }
    if parsed.ledger_sha256 != batch.pre_ledger_sha256 {
        return Err(RewardCapacityRecomputationError::LedgerDigestMismatch);
    }
    validate_sealed_candidate_uniqueness(workspace.candidates)?;

    for (index, slot) in workspace.allocation_order.iter_mut().enumerate() {
        *slot = u32::try_from(index)
            .map_err(|_| RewardCapacityRecomputationError::CandidateCountMismatch)?;
    }
    validate_committed_candidate_order(workspace.candidates)?;
    let ccc = validate_ccc_contract(
        externally_prevalidated_seal_bytes,
        &parsed,
        workspace.candidates,
        ccc_reveal,
    )?;
    apply_ccc_order(
        workspace.candidates,
        workspace.allocation_order,
        ccc.as_ref(),
    )?;

    for (digest, input) in workspace
        .reference_receipt_sha256
        .iter_mut()
        .zip(receipts.iter())
    {
        *digest = Sha256::digest(input.reference_receipt_core_bytes).into();
    }

    let mut ledger = parsed.ledger;
    let mut blocked = false;
    for (allocation_index, receipt_input) in receipts.iter().enumerate() {
        let candidate_index = usize::try_from(workspace.allocation_order[allocation_index])
            .map_err(|_| RewardCapacityRecomputationError::ReceiptOrderMismatch)?;
        let candidate = workspace
            .candidates
            .get(candidate_index)
            .ok_or(RewardCapacityRecomputationError::ReceiptOrderMismatch)?;
        let binding = validate_reward_allocator_transcript_binding(
            batch_bytes,
            receipt_input.receipt_bytes,
            workspace.reference_receipt_sha256,
            receipt_input.reference_receipt_core_bytes,
        )?;
        if binding.receipt.allocation_index as usize != allocation_index {
            return Err(RewardCapacityRecomputationError::ReceiptOrderMismatch);
        }
        let id_ascii = lower_hex(&candidate.id);
        let id_sha256: [u8; 32] = Sha256::digest(id_ascii).into();
        if binding.receipt.obligation_id_sha256 != id_sha256
            || binding.receipt.obligation_sha256 != candidate.obligation_sha256
            || binding.receipt.exact_amount != candidate.amount
            || binding.receipt.faction_payout_sha256 != candidate.faction_payout_sha256
        {
            return Err(RewardCapacityRecomputationError::ReceiptCandidateMismatch);
        }

        let (disposition, reason, planned) = if blocked {
            (
                AllocatorDisposition::NullBlocked,
                AllocatorReason::HigherPriorityOrEarlierObligationUnderfunded,
                [0; 3],
            )
        } else if let Some(plan) = plan_reservation(&mut ledger, candidate.amount)? {
            (
                AllocatorDisposition::AdmittedReserved,
                AllocatorReason::None,
                plan,
            )
        } else {
            blocked = true;
            (
                AllocatorDisposition::NullUnderfunded,
                AllocatorReason::ExactAmountNotAvailable,
                [0; 3],
            )
        };
        if binding.receipt.disposition != disposition
            || binding.receipt.reason != reason
            || binding.receipt.treasury_planned != planned[0]
            || binding.receipt.ecosystem_planned != planned[1]
            || binding.receipt.liquidity_planned != planned[2]
        {
            return Err(RewardCapacityRecomputationError::ReceiptDecisionMismatch);
        }
    }

    let post_ledger_sha256 = canonical_ledger_sha256(&ledger);
    if post_ledger_sha256 != batch.post_ledger_sha256 {
        return Err(RewardCapacityRecomputationError::PostLedgerDigestMismatch);
    }
    let receipt_set_sha256 = canonical_digest_array_sha256(workspace.reference_receipt_sha256);
    if receipt_set_sha256 != batch.receipt_set_sha256 {
        return Err(RewardCapacityRecomputationError::ReceiptSetDigestMismatch);
    }
    let outcome_sha256 = canonical_outcome_sha256(
        &batch,
        &parsed,
        &ccc,
        post_ledger_sha256,
        workspace.reference_receipt_sha256,
    );
    if outcome_sha256 != batch.outcome_sha256 {
        return Err(RewardCapacityRecomputationError::OutcomeDigestMismatch);
    }
    let finalization_sha256 = canonical_finalization_sha256(
        &batch,
        &parsed,
        &ccc,
        post_ledger_sha256,
        receipt_set_sha256,
        outcome_sha256,
        workspace.reference_receipt_sha256,
    );
    if finalization_sha256 != batch.reference_finalization_sha256 {
        return Err(RewardCapacityRecomputationError::FinalizationDigestMismatch);
    }

    Ok(RewardCapacityRecomputationReceipt {
        candidate_count: batch.receipt_count,
        seal_sha256,
        candidate_set_sha256: parsed.candidate_set_sha256,
        pre_ledger_sha256: parsed.ledger_sha256,
        post_ledger_sha256,
        receipt_set_sha256,
        outcome_sha256,
        finalization_sha256,
    })
}

fn validate_sealed_candidate_uniqueness(
    candidates: &[RewardCapacityCandidateScratch],
) -> Result<(), RewardCapacityRecomputationError> {
    let mut weekly_faction_count = 0usize;
    for (index, candidate) in candidates.iter().enumerate() {
        if candidate.priority == Priority::WeeklyFaction {
            weekly_faction_count = weekly_faction_count
                .checked_add(1)
                .ok_or(RewardCapacityRecomputationError::MultipleWeeklyFactionManifests)?;
            if weekly_faction_count > 1 {
                return Err(RewardCapacityRecomputationError::MultipleWeeklyFactionManifests);
            }
        }
        for previous in &candidates[..index] {
            if candidate.id == previous.id {
                return Err(RewardCapacityRecomputationError::DuplicateCandidateId);
            }
            if candidate.priority.is_ccc()
                && candidate.priority == previous.priority
                && candidate.qualification_pda == previous.qualification_pda
            {
                return Err(RewardCapacityRecomputationError::DuplicateCccQualificationPda);
            }
        }
    }
    Ok(())
}

#[derive(Clone, Copy)]
struct VerifiedCcc<'a> {
    source_id: &'a [u8],
    randomness: [u8; 32],
    reveal_sha256: [u8; 32],
    commitment_sha256: [u8; 32],
    decision_context: [u8; 32],
}

fn validate_ccc_contract<'a>(
    seal_bytes: &'a [u8],
    parsed: &ParsedSeal<'a>,
    candidates: &[RewardCapacityCandidateScratch],
    reveal: Option<RewardCapacityCccReveal<'a>>,
) -> Result<Option<VerifiedCcc<'a>>, RewardCapacityRecomputationError> {
    let tie = candidates.windows(2).any(|pair| {
        pair[0].priority.is_ccc()
            && pair[0].priority == pair[1].priority
            && ccc_tuple(&pair[0]) == ccc_tuple(&pair[1])
    });
    if !tie {
        if parsed.registry.entry_span.is_some()
            || parsed.reveal_commitment.is_some()
            || parsed.decision_context.is_some()
            || reveal.is_some()
        {
            return Err(RewardCapacityRecomputationError::CccTieContractMismatch);
        }
        return Ok(None);
    }
    let registry_entry = parsed
        .registry
        .entry_span
        .ok_or(RewardCapacityRecomputationError::CccTieContractMismatch)?;
    let reveal_span = parsed
        .reveal_commitment
        .ok_or(RewardCapacityRecomputationError::CccTieContractMismatch)?;
    if registry_entry.bytes(seal_bytes) != reveal_span.bytes(seal_bytes) {
        return Err(RewardCapacityRecomputationError::CccTieContractMismatch);
    }
    let supplied = reveal.ok_or(RewardCapacityRecomputationError::CccRevealMismatch)?;
    let source_id = parsed
        .registry
        .source_id
        .ok_or(RewardCapacityRecomputationError::CccTieContractMismatch)?;
    if source_id.is_empty() || core::str::from_utf8(source_id).is_err() {
        return Err(RewardCapacityRecomputationError::CccRevealMismatch);
    }
    if supplied.source_id != source_id {
        return Err(RewardCapacityRecomputationError::CccRevealMismatch);
    }
    let committed_at = parsed
        .registry
        .committed_at
        .ok_or(RewardCapacityRecomputationError::CccTieContractMismatch)?;
    if committed_at >= parsed.funding_round {
        return Err(RewardCapacityRecomputationError::CccCommitmentMismatch);
    }
    let commitment_sha256 = parsed
        .registry
        .commitment_sha256
        .ok_or(RewardCapacityRecomputationError::CccTieContractMismatch)?;
    let (committed_start, committed_decimal) = decimal_i64(committed_at);
    let (funding_start, funding_decimal) = decimal_i64(parsed.funding_round);
    let randomness_hex = lower_hex(&supplied.randomness);
    let actual_commitment = hash_pipe(&[
        CCC_COMMITMENT_SCHEME,
        source_id,
        &committed_decimal[committed_start..],
        &funding_decimal[funding_start..],
        &randomness_hex,
    ]);
    if actual_commitment != commitment_sha256 {
        return Err(RewardCapacityRecomputationError::CccCommitmentMismatch);
    }
    let candidate_hex = lower_hex(&parsed.candidate_set_sha256);
    let ledger_hex = lower_hex(&parsed.ledger_sha256);
    let registry_hex = lower_hex(&parsed.registry.snapshot_sha256);
    let commitment_hex = lower_hex(&commitment_sha256);
    let decision_context = hash_pipe(&[
        CCC_CONTEXT_DOMAIN,
        POLICY_HEX,
        &funding_decimal[funding_start..],
        &candidate_hex,
        &ledger_hex,
        &registry_hex,
        source_id,
        &committed_decimal[committed_start..],
        &commitment_hex,
    ]);
    if parsed.decision_context != Some(decision_context) {
        return Err(RewardCapacityRecomputationError::CccContextMismatch);
    }
    let reveal_sha256: [u8; 32] = Sha256::digest(randomness_hex).into();
    Ok(Some(VerifiedCcc {
        source_id,
        randomness: supplied.randomness,
        reveal_sha256,
        commitment_sha256,
        decision_context,
    }))
}

fn apply_ccc_order(
    candidates: &[RewardCapacityCandidateScratch],
    order: &mut [u32],
    ccc: Option<&VerifiedCcc<'_>>,
) -> Result<(), RewardCapacityRecomputationError> {
    let mut start = 0;
    while start < candidates.len() {
        if !candidates[start].priority.is_ccc() {
            start += 1;
            continue;
        }
        let mut end = start + 1;
        while end < candidates.len()
            && candidates[end].priority == candidates[start].priority
            && ccc_tuple(&candidates[end]) == ccc_tuple(&candidates[start])
        {
            end += 1;
        }
        if end - start > 1 {
            let verified = ccc.ok_or(RewardCapacityRecomputationError::CccTieContractMismatch)?;
            let cohort_hash = cohort_pda_sha256(&candidates[start..end]);
            let mut rank = 0;
            while start + rank < end {
                let remaining = end - (start + rank);
                let rank_u32 = u32::try_from(rank)
                    .map_err(|_| RewardCapacityRecomputationError::CandidateCountMismatch)?;
                let context_hex = lower_hex(&verified.decision_context);
                let cohort_hex = lower_hex(&cohort_hash);
                let (activity_start, activity_decimal) =
                    decimal_u64(candidates[start].qualifying_activity_start_slot);
                let (node_start, node_decimal) =
                    decimal_u64(candidates[start].node_activation_slot);
                let (eligible_start, eligible_decimal) =
                    decimal_u64(candidates[start].eligible_sequence);
                let (rank_start, rank_decimal) = decimal_u64(u64::from(rank_u32));
                let rank_context = hash_pipe(&[
                    CCC_ORDER_DOMAIN,
                    &context_hex,
                    candidates[start].priority.ascii(),
                    &activity_decimal[activity_start..],
                    &node_decimal[node_start..],
                    &eligible_decimal[eligible_start..],
                    &cohort_hex,
                    &rank_decimal[rank_start..],
                ]);
                let choice = uniform_tiebreak(
                    verified.randomness,
                    rank_context,
                    u32::try_from(remaining)
                        .map_err(|_| RewardCapacityRecomputationError::CandidateCountMismatch)?,
                )? as usize;
                let selected = start + rank + choice;
                let value = order[selected];
                for cursor in ((start + rank)..selected).rev() {
                    order[cursor + 1] = order[cursor];
                }
                order[start + rank] = value;
                rank += 1;
            }
        }
        start = end;
    }
    Ok(())
}

fn validate_committed_candidate_order(
    candidates: &[RewardCapacityCandidateScratch],
) -> Result<(), RewardCapacityRecomputationError> {
    for pair in candidates.windows(2) {
        if pair[0].priority as u8 > pair[1].priority as u8 {
            return Err(RewardCapacityRecomputationError::CandidateOrderMismatch);
        }
        if pair[0].priority == pair[1].priority && pair[0].priority.is_ccc() {
            let ordering = ccc_tuple(&pair[0]).cmp(&ccc_tuple(&pair[1]));
            if ordering == Ordering::Greater
                || (ordering == Ordering::Equal
                    && pair[0].qualification_pda >= pair[1].qualification_pda)
            {
                return Err(RewardCapacityRecomputationError::CandidateOrderMismatch);
            }
        }
    }
    Ok(())
}

fn ccc_tuple(candidate: &RewardCapacityCandidateScratch) -> (u64, u64, u64) {
    (
        candidate.qualifying_activity_start_slot,
        candidate.node_activation_slot,
        candidate.eligible_sequence,
    )
}

fn plan_reservation(
    ledger: &mut Ledger,
    amount: u64,
) -> Result<Option<[u64; 3]>, RewardCapacityRecomputationError> {
    let capacity = u128::from(ledger.treasury.available()?)
        + u128::from(ledger.ecosystem.available()?)
        + u128::from(ledger.liquidity.available()?);
    if capacity < u128::from(amount) {
        return Ok(None);
    }
    let mut remaining = amount;
    let mut planned = [0; 3];
    for (index, lane) in [
        &mut ledger.treasury,
        &mut ledger.ecosystem,
        &mut ledger.liquidity,
    ]
    .into_iter()
    .enumerate()
    {
        let take = lane.available()?.min(remaining);
        lane.reserved = lane
            .reserved
            .checked_add(take)
            .ok_or(RewardCapacityRecomputationError::ReservationOverflow)?;
        planned[index] = take;
        remaining -= take;
        if remaining == 0 {
            break;
        }
    }
    if remaining != 0 {
        return Err(RewardCapacityRecomputationError::ReservationOverflow);
    }
    Ok(Some(planned))
}

fn parse_seal<'a>(
    bytes: &'a [u8],
    candidates: &mut [RewardCapacityCandidateScratch],
    expected_count: usize,
) -> Result<ParsedSeal<'a>, RewardCapacityRecomputationError> {
    let mut p = Json::new(bytes)?;
    p.byte(b'{')?;
    p.key(b"candidateCount")?;
    let count = p.u32_number()? as usize;
    if count != expected_count {
        return Err(RewardCapacityRecomputationError::CandidateCountMismatch);
    }
    p.comma_key(b"candidateIds")?;
    parse_candidate_ids(&mut p, candidates)?;
    p.comma_key(b"candidates")?;
    let candidate_span = parse_candidates(&mut p, candidates)?;
    p.comma_key(b"candidateSetSha256")?;
    let stored_candidate_sha = p.hex32_string()?;
    let candidate_sha: [u8; 32] = Sha256::digest(candidate_span.bytes(bytes)).into();
    if candidate_sha != stored_candidate_sha {
        return Err(RewardCapacityRecomputationError::CandidateDigestMismatch);
    }
    p.comma_key(b"cccDecisionContextSha256")?;
    let decision_context = p.nullable_hex32()?;
    p.comma_key(b"cccPrecommitRegistrySnapshot")?;
    let registry = parse_registry(&mut p)?;
    p.comma_key(b"cccPrecommitRegistrySnapshotSha256")?;
    let registry_sha = p.hex32_string()?;
    if registry.snapshot_sha256 != registry_sha {
        return Err(RewardCapacityRecomputationError::RegistryDigestMismatch);
    }
    p.comma_key(b"cccRevealCommitment")?;
    let reveal_commitment = if p.peek() == Some(b'n') {
        p.literal(b"null")?;
        None
    } else {
        let start = p.pos;
        let _ = parse_commitment(&mut p)?;
        Some(Span { start, end: p.pos })
    };
    p.comma_key(b"finalized")?;
    p.literal(b"false")?;
    p.comma_key(b"fundingRoundAtUnixSeconds")?;
    let funding_round = p.i64_string()?;
    if funding_round % UTC_DAY_SECONDS != 0 {
        return Err(RewardCapacityRecomputationError::FundingRoundMismatch);
    }
    if registry.funding_round != funding_round
        || candidates
            .iter()
            .any(|candidate| candidate.funding_round != funding_round)
    {
        return Err(RewardCapacityRecomputationError::FundingRoundMismatch);
    }
    p.comma_key(b"ledgerSnapshot")?;
    let ledger_start = p.pos;
    let ledger = parse_ledger(&mut p)?;
    let ledger_span = Span {
        start: ledger_start,
        end: p.pos,
    };
    p.comma_key(b"ledgerSnapshotSha256")?;
    let stored_ledger_sha = p.hex32_string()?;
    let ledger_sha: [u8; 32] = Sha256::digest(ledger_span.bytes(bytes)).into();
    if ledger_sha != stored_ledger_sha {
        return Err(RewardCapacityRecomputationError::LedgerDigestMismatch);
    }
    p.comma_key(b"schema")?;
    p.exact_string(b"iat-b3-reward-capacity-round-seal/v1")?;
    p.comma_key(b"sealedAtUnixSeconds")?;
    let sealed_at = p.i64_string()?;
    if sealed_at != funding_round {
        return Err(RewardCapacityRecomputationError::FundingRoundMismatch);
    }
    p.comma_key(b"status")?;
    p.exact_string(b"SEALED_NON_ACTIVATING")?;
    p.byte(b'}')?;
    p.end()?;
    Ok(ParsedSeal {
        funding_round,
        candidate_set_sha256: candidate_sha,
        ledger_sha256: ledger_sha,
        ledger,
        registry,
        reveal_commitment,
        decision_context,
    })
}

fn parse_candidate_ids(
    p: &mut Json<'_>,
    candidates: &mut [RewardCapacityCandidateScratch],
) -> Result<(), RewardCapacityRecomputationError> {
    p.byte(b'[')?;
    for (index, candidate) in candidates.iter_mut().enumerate() {
        if index != 0 {
            p.byte(b',')?;
        }
        candidate.id = p.hex32_string()?;
        candidate.expected_id_present = true;
    }
    p.byte(b']')
}

fn parse_candidates(
    p: &mut Json<'_>,
    candidates: &mut [RewardCapacityCandidateScratch],
) -> Result<Span, RewardCapacityRecomputationError> {
    let start = p.pos;
    p.byte(b'[')?;
    for (index, slot) in candidates.iter_mut().enumerate() {
        if index != 0 {
            p.byte(b',')?;
        }
        let expected_id = slot.id;
        let object_start = p.pos;
        let mut parsed = parse_candidate(p)?;
        parsed.obligation_sha256 = Sha256::digest(&p.bytes[object_start..p.pos]).into();
        if !slot.expected_id_present || parsed.id != expected_id {
            return Err(RewardCapacityRecomputationError::CandidateIdMismatch);
        }
        *slot = parsed;
    }
    p.byte(b']')?;
    Ok(Span { start, end: p.pos })
}

fn parse_candidate(
    p: &mut Json<'_>,
) -> Result<RewardCapacityCandidateScratch, RewardCapacityRecomputationError> {
    let mut out = RewardCapacityCandidateScratch::EMPTY;
    let mut fields = 0u32;
    let mut kind = 0u8;
    let mut last_key: Option<&[u8]> = None;
    p.byte(b'{')?;
    let mut first = true;
    while p.peek() != Some(b'}') {
        if !first {
            p.byte(b',')?;
        }
        first = false;
        let key = p.plain_string()?;
        if last_key.is_some_and(|last| last >= key) {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        last_key = Some(key);
        p.byte(b':')?;
        match key {
            b"amount" => {
                out.amount = p.u64_string()?;
                fields |= 1 << 0;
            }
            b"chronology" => {
                p.skip_value(0)?;
                fields |= 1 << 1;
            }
            b"eligibleSequence" => {
                out.eligible_sequence = p.u64_string()?;
                fields |= 1 << 2;
            }
            b"factionWeekId"
            | b"followerCount"
            | b"originalBaseAdmissionLineage"
            | b"payoutEntries"
            | b"rewardId"
            | b"trancheKinds" => p.skip_value(0)?,
            b"fundingPool" => {
                p.exact_string(b"SHARED_REWARD_RESERVE")?;
                fields |= 1 << 10;
            }
            b"fundingRoundAtUnixSeconds" => {
                out.funding_round = p.i64_string()?;
                fields |= 1 << 3;
            }
            b"id" => {
                out.id = p.hex32_string()?;
                fields |= 1 << 4;
            }
            b"kind" => {
                let parsed_kind = p.plain_string()?;
                kind = match parsed_kind {
                    b"X_BOUND_FUNDING" => 1,
                    b"WEEKLY_FACTION_MANIFEST" => 2,
                    _ => return Err(RewardCapacityRecomputationError::InvalidSealShape),
                };
            }
            b"nodeActivationSlot" => {
                out.node_activation_slot = p.u64_string()?;
                fields |= 1 << 5;
            }
            b"payoutDigest" => out.faction_payout_sha256 = Some(p.hex32_string()?),
            b"priorityClass" => {
                out.priority = Priority::parse(p.plain_string()?)?;
                fields |= 1 << 6;
            }
            b"qualificationPda" => {
                out.qualification_pda = p.hex32_string()?;
                fields |= 1 << 7;
            }
            b"qualifyingActivityStartSlot" => {
                out.qualifying_activity_start_slot = p.u64_string()?;
                fields |= 1 << 8;
            }
            b"reservationStatus" => {
                p.exact_string(b"NEW_UNRESERVED")?;
                fields |= 1 << 9;
            }
            b"rewardSourceKind" => match p.plain_string()? {
                b"GENESIS_AIRDROP" | b"X_INTERACTION" | b"STANDARD_POSITION" | b"CCC_AGENT"
                | b"CCC_ASSOCIATE" => {}
                _ => return Err(RewardCapacityRecomputationError::InvalidSealShape),
            },
            _ => return Err(RewardCapacityRecomputationError::UnsupportedSealSemantics),
        }
    }
    p.byte(b'}')?;
    if out.amount == 0 {
        return Err(RewardCapacityRecomputationError::CandidateAmountZero);
    }
    let common = (1 << 0) | (1 << 3) | (1 << 4) | (1 << 6) | (1 << 9) | (1 << 10);
    if fields & common != common {
        return Err(RewardCapacityRecomputationError::InvalidSealShape);
    }
    if out.priority.is_ccc() {
        let ccc = (1 << 2) | (1 << 5) | (1 << 7) | (1 << 8);
        if fields & ccc != ccc || fields & (1 << 1) != 0 {
            return Err(RewardCapacityRecomputationError::InvalidSealShape);
        }
    } else if fields & (1 << 1) == 0 {
        return Err(RewardCapacityRecomputationError::InvalidSealShape);
    }
    if out.priority == Priority::WeeklyFaction {
        if kind != 2 || out.faction_payout_sha256.is_none() {
            return Err(RewardCapacityRecomputationError::InvalidSealShape);
        }
    } else if kind == 2 || out.faction_payout_sha256.is_some() {
        return Err(RewardCapacityRecomputationError::InvalidSealShape);
    }
    Ok(out)
}

fn parse_ledger(p: &mut Json<'_>) -> Result<Ledger, RewardCapacityRecomputationError> {
    p.byte(b'{')?;
    p.key(b"lanes")?;
    p.byte(b'{')?;
    p.key(b"ecosystem")?;
    let ecosystem = parse_lane(p)?;
    p.comma_key(b"liquidity")?;
    let liquidity = parse_lane(p)?;
    p.comma_key(b"treasury")?;
    let treasury = parse_lane(p)?;
    p.byte(b'}')?;
    p.byte(b'}')?;
    Ok(Ledger {
        treasury,
        ecosystem,
        liquidity,
    })
}

fn parse_lane(p: &mut Json<'_>) -> Result<Lane, RewardCapacityRecomputationError> {
    p.byte(b'{')?;
    p.key(b"paid")?;
    let paid = p.u64_string()?;
    p.comma_key(b"reserved")?;
    let reserved = p.u64_string()?;
    p.comma_key(b"unlocked")?;
    let unlocked = p.u64_string()?;
    p.comma_key(b"withdrawn")?;
    let withdrawn = p.u64_string()?;
    p.byte(b'}')?;
    let lane = Lane {
        unlocked,
        reserved,
        paid,
        withdrawn,
    };
    let _ = lane.available()?;
    Ok(lane)
}

fn parse_registry<'a>(p: &mut Json<'a>) -> Result<Registry<'a>, RewardCapacityRecomputationError> {
    p.byte(b'{')?;
    p.key(b"complete")?;
    p.literal(b"true")?;
    p.comma_key(b"entries")?;
    let entries_start = p.pos;
    p.byte(b'[')?;
    let (entry_span, source_id, committed_at, commitment_sha256) = if p.peek() == Some(b']') {
        (None, None, None, None)
    } else {
        let start = p.pos;
        let commitment = parse_commitment(p)?;
        if p.peek() == Some(b',') {
            return Err(RewardCapacityRecomputationError::CccTieContractMismatch);
        }
        (
            Some(Span { start, end: p.pos }),
            Some(commitment.0),
            Some(commitment.1),
            Some(commitment.2),
        )
    };
    p.byte(b']')?;
    let entries_span = Span {
        start: entries_start,
        end: p.pos,
    };
    p.comma_key(b"fundingRoundAtUnixSeconds")?;
    let funding = p.i64_string()?;
    p.comma_key(b"schema")?;
    p.exact_string(b"iat-b3-ccc-precommit-registry-snapshot/v1")?;
    p.comma_key(b"snapshotSha256")?;
    let stored_snapshot = p.hex32_string()?;
    p.comma_key(b"status")?;
    p.exact_string(b"COMPLETE_UNAUTHENTICATED_REFERENCE_SNAPSHOT")?;
    p.byte(b'}')?;

    let mut hash = Sha256::new();
    hash.update(b"{\"complete\":true,\"entries\":");
    hash.update(entries_span.bytes(p.bytes));
    hash.update(b",\"fundingRoundAtUnixSeconds\":\"");
    update_i64(&mut hash, funding);
    hash.update(b"\",\"schema\":\"iat-b3-ccc-precommit-registry-snapshot/v1\",\"status\":\"COMPLETE_UNAUTHENTICATED_REFERENCE_SNAPSHOT\"}");
    let actual_snapshot: [u8; 32] = hash.finalize().into();
    if actual_snapshot != stored_snapshot {
        return Err(RewardCapacityRecomputationError::RegistryDigestMismatch);
    }
    Ok(Registry {
        entry_span,
        source_id,
        committed_at,
        commitment_sha256,
        snapshot_sha256: actual_snapshot,
        funding_round: funding,
    })
}

fn parse_commitment<'a>(
    p: &mut Json<'a>,
) -> Result<(&'a [u8], i64, [u8; 32]), RewardCapacityRecomputationError> {
    p.byte(b'{')?;
    p.key(b"commitmentSha256")?;
    let digest = p.hex32_string()?;
    p.comma_key(b"committedAtUnixSeconds")?;
    let committed_at = p.i64_string()?;
    p.comma_key(b"scheme")?;
    p.exact_string(CCC_COMMITMENT_SCHEME)?;
    p.comma_key(b"sourceId")?;
    let source = p.plain_string()?;
    p.byte(b'}')?;
    Ok((source, committed_at, digest))
}

struct Json<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Json<'a> {
    fn new(bytes: &'a [u8]) -> Result<Self, RewardCapacityRecomputationError> {
        core::str::from_utf8(bytes)
            .map_err(|_| RewardCapacityRecomputationError::InvalidCanonicalJson)?;
        Ok(Self { bytes, pos: 0 })
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    fn byte(&mut self, expected: u8) -> Result<(), RewardCapacityRecomputationError> {
        if self.peek() != Some(expected) {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        self.pos += 1;
        Ok(())
    }

    fn literal(&mut self, value: &[u8]) -> Result<(), RewardCapacityRecomputationError> {
        if self.bytes.get(self.pos..self.pos + value.len()) != Some(value) {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        self.pos += value.len();
        Ok(())
    }

    fn key(&mut self, key: &[u8]) -> Result<(), RewardCapacityRecomputationError> {
        self.exact_string(key)?;
        self.byte(b':')
    }

    fn comma_key(&mut self, key: &[u8]) -> Result<(), RewardCapacityRecomputationError> {
        self.byte(b',')?;
        self.key(key)
    }

    fn plain_string(&mut self) -> Result<&'a [u8], RewardCapacityRecomputationError> {
        self.byte(b'"')?;
        let start = self.pos;
        while let Some(byte) = self.peek() {
            if byte == b'"' {
                let end = self.pos;
                self.pos += 1;
                return Ok(&self.bytes[start..end]);
            }
            if byte == b'\\' || byte < 0x20 {
                return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
            }
            self.pos += 1;
        }
        Err(RewardCapacityRecomputationError::InvalidCanonicalJson)
    }

    fn exact_string(&mut self, value: &[u8]) -> Result<(), RewardCapacityRecomputationError> {
        if self.plain_string()? != value {
            return Err(RewardCapacityRecomputationError::InvalidSealShape);
        }
        Ok(())
    }

    fn hex32_string(&mut self) -> Result<[u8; 32], RewardCapacityRecomputationError> {
        decode_hex32(self.plain_string()?)
    }

    fn nullable_hex32(&mut self) -> Result<Option<[u8; 32]>, RewardCapacityRecomputationError> {
        if self.peek() == Some(b'n') {
            self.literal(b"null")?;
            Ok(None)
        } else {
            self.hex32_string().map(Some)
        }
    }

    fn u64_string(&mut self) -> Result<u64, RewardCapacityRecomputationError> {
        let value = self.plain_string()?;
        parse_u64(value)
    }

    fn i64_string(&mut self) -> Result<i64, RewardCapacityRecomputationError> {
        let value = self.plain_string()?;
        parse_i64(value)
    }

    fn u32_number(&mut self) -> Result<u32, RewardCapacityRecomputationError> {
        let start = self.pos;
        while matches!(self.peek(), Some(b'0'..=b'9')) {
            self.pos += 1;
        }
        let value = &self.bytes[start..self.pos];
        if value.is_empty() || (value.len() > 1 && value[0] == b'0') {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        u32::try_from(parse_u64(value)?)
            .map_err(|_| RewardCapacityRecomputationError::CandidateCountMismatch)
    }

    fn skip_value(&mut self, depth: u8) -> Result<(), RewardCapacityRecomputationError> {
        if depth > 24 {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        match self.peek() {
            Some(b'"') => self.skip_string(),
            Some(b'{') => {
                self.byte(b'{')?;
                let mut first = true;
                let mut last: Option<&[u8]> = None;
                while self.peek() != Some(b'}') {
                    if !first {
                        self.byte(b',')?;
                    }
                    first = false;
                    let key = self.plain_string()?;
                    if last.is_some_and(|value| value >= key) {
                        return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
                    }
                    last = Some(key);
                    self.byte(b':')?;
                    self.skip_value(depth + 1)?;
                }
                self.byte(b'}')
            }
            Some(b'[') => {
                self.byte(b'[')?;
                let mut first = true;
                while self.peek() != Some(b']') {
                    if !first {
                        self.byte(b',')?;
                    }
                    first = false;
                    self.skip_value(depth + 1)?;
                }
                self.byte(b']')
            }
            Some(b't') => self.literal(b"true"),
            Some(b'f') => self.literal(b"false"),
            Some(b'n') => self.literal(b"null"),
            Some(b'-' | b'0'..=b'9') => self.skip_number(),
            _ => Err(RewardCapacityRecomputationError::InvalidCanonicalJson),
        }
    }

    fn skip_string(&mut self) -> Result<(), RewardCapacityRecomputationError> {
        self.byte(b'"')?;
        while let Some(byte) = self.peek() {
            self.pos += 1;
            match byte {
                b'"' => return Ok(()),
                0..=0x1f => return Err(RewardCapacityRecomputationError::InvalidCanonicalJson),
                b'\\' => match self.peek() {
                    Some(b'"' | b'\\' | b'b' | b'f' | b'n' | b'r' | b't') => self.pos += 1,
                    Some(b'u') => {
                        self.pos += 1;
                        for _ in 0..4 {
                            if !matches!(self.peek(), Some(b'0'..=b'9' | b'a'..=b'f')) {
                                return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
                            }
                            self.pos += 1;
                        }
                    }
                    _ => return Err(RewardCapacityRecomputationError::InvalidCanonicalJson),
                },
                _ => {}
            }
        }
        Err(RewardCapacityRecomputationError::InvalidCanonicalJson)
    }

    fn skip_number(&mut self) -> Result<(), RewardCapacityRecomputationError> {
        if self.peek() == Some(b'-') {
            self.pos += 1;
        }
        let start = self.pos;
        while matches!(self.peek(), Some(b'0'..=b'9')) {
            self.pos += 1;
        }
        let digits = &self.bytes[start..self.pos];
        if digits.is_empty() || (digits.len() > 1 && digits[0] == b'0') {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        if matches!(self.peek(), Some(b'.' | b'e' | b'E' | b'+')) {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        Ok(())
    }

    fn end(&self) -> Result<(), RewardCapacityRecomputationError> {
        if self.pos == self.bytes.len() {
            Ok(())
        } else {
            Err(RewardCapacityRecomputationError::InvalidCanonicalJson)
        }
    }
}

fn parse_u64(value: &[u8]) -> Result<u64, RewardCapacityRecomputationError> {
    if value.is_empty() || (value.len() > 1 && value[0] == b'0') {
        return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
    }
    let mut out = 0u64;
    for byte in value {
        if !byte.is_ascii_digit() {
            return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
        }
        out = out
            .checked_mul(10)
            .and_then(|current| current.checked_add(u64::from(byte - b'0')))
            .ok_or(RewardCapacityRecomputationError::InvalidCanonicalJson)?;
    }
    Ok(out)
}

fn parse_i64(value: &[u8]) -> Result<i64, RewardCapacityRecomputationError> {
    let text = core::str::from_utf8(value)
        .map_err(|_| RewardCapacityRecomputationError::InvalidCanonicalJson)?;
    if text == "-0" || (text.starts_with('0') && text.len() > 1) || text.starts_with("-0") {
        return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
    }
    text.parse()
        .map_err(|_| RewardCapacityRecomputationError::InvalidCanonicalJson)
}

fn decode_hex32(value: &[u8]) -> Result<[u8; 32], RewardCapacityRecomputationError> {
    if value.len() != 64 {
        return Err(RewardCapacityRecomputationError::InvalidCanonicalJson);
    }
    let mut out = [0; 32];
    for index in 0..32 {
        out[index] = (hex_nibble(value[index * 2])? << 4) | hex_nibble(value[index * 2 + 1])?;
    }
    Ok(out)
}

fn hex_nibble(value: u8) -> Result<u8, RewardCapacityRecomputationError> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err(RewardCapacityRecomputationError::InvalidCanonicalJson),
    }
}

fn lower_hex(value: &[u8; 32]) -> [u8; 64] {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = [0; 64];
    for (index, byte) in value.iter().enumerate() {
        out[index * 2] = HEX[usize::from(byte >> 4)];
        out[index * 2 + 1] = HEX[usize::from(byte & 0x0f)];
    }
    out
}

fn hash_pipe(parts: &[&[u8]]) -> [u8; 32] {
    let mut hash = Sha256::new();
    for (index, part) in parts.iter().enumerate() {
        if index != 0 {
            hash.update(b"|");
        }
        hash.update(part);
    }
    hash.finalize().into()
}

fn cohort_pda_sha256(candidates: &[RewardCapacityCandidateScratch]) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(b"[");
    for (index, candidate) in candidates.iter().enumerate() {
        if index != 0 {
            hash.update(b",");
        }
        hash.update(b"\"");
        hash.update(lower_hex(&candidate.qualification_pda));
        hash.update(b"\"");
    }
    hash.update(b"]");
    hash.finalize().into()
}

fn uniform_tiebreak(
    randomness: [u8; 32],
    context: [u8; 32],
    count: u32,
) -> Result<u32, RewardCapacityRecomputationError> {
    if count == 0 {
        return Err(RewardCapacityRecomputationError::CandidateCountMismatch);
    }
    if count == 1 {
        return Ok(0);
    }
    let tail = two_to_256_mod(count);
    for counter in 0..MAX_TIEBREAK_ATTEMPTS {
        let mut hash = Sha256::new();
        hash.update(TIEBREAK_DOMAIN);
        hash.update(context);
        hash.update(randomness);
        hash.update(counter.to_be_bytes());
        let sample: [u8; 32] = hash.finalize().into();
        if !in_rejection_tail(&sample, tail) {
            return Ok(modulo_256(sample, count));
        }
    }
    Err(RewardCapacityRecomputationError::TiebreakExhausted)
}

fn two_to_256_mod(modulus: u32) -> u32 {
    let mut remainder = 1u64;
    for _ in 0..256 {
        remainder = (remainder * 2) % u64::from(modulus);
    }
    remainder as u32
}

fn in_rejection_tail(sample: &[u8; 32], tail: u32) -> bool {
    tail != 0
        && sample[..28].iter().all(|byte| *byte == 0xff)
        && u32::from_be_bytes([sample[28], sample[29], sample[30], sample[31]])
            >= 0u32.wrapping_sub(tail)
}

fn modulo_256(value: [u8; 32], modulus: u32) -> u32 {
    let mut remainder = 0u64;
    for byte in value {
        remainder = ((u128::from(remainder) * 256 + u128::from(byte)) % u128::from(modulus)) as u64;
    }
    remainder as u32
}

fn canonical_ledger_sha256(ledger: &Ledger) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(b"{\"lanes\":{\"ecosystem\":");
    update_lane(&mut hash, ledger.ecosystem);
    hash.update(b",\"liquidity\":");
    update_lane(&mut hash, ledger.liquidity);
    hash.update(b",\"treasury\":");
    update_lane(&mut hash, ledger.treasury);
    hash.update(b"}}");
    hash.finalize().into()
}

fn update_lane(hash: &mut Sha256, lane: Lane) {
    hash.update(b"{\"paid\":\"");
    update_u64(hash, lane.paid);
    hash.update(b"\",\"reserved\":\"");
    update_u64(hash, lane.reserved);
    hash.update(b"\",\"unlocked\":\"");
    update_u64(hash, lane.unlocked);
    hash.update(b"\",\"withdrawn\":\"");
    update_u64(hash, lane.withdrawn);
    hash.update(b"\"}");
}

fn canonical_digest_array_sha256(digests: &[[u8; 32]]) -> [u8; 32] {
    let mut hash = Sha256::new();
    update_digest_array(&mut hash, digests);
    hash.finalize().into()
}

fn update_digest_array(hash: &mut Sha256, digests: &[[u8; 32]]) {
    hash.update(b"[");
    for (index, digest) in digests.iter().enumerate() {
        if index != 0 {
            hash.update(b",");
        }
        update_quoted_hex(hash, digest);
    }
    hash.update(b"]");
}

fn canonical_outcome_sha256(
    batch: &crate::RewardAllocatorBatch,
    parsed: &ParsedSeal<'_>,
    ccc: &Option<VerifiedCcc<'_>>,
    post_ledger: [u8; 32],
    receipt_digests: &[[u8; 32]],
) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(b"{\"cccDecisionContextSha256\":");
    update_nullable_hex(&mut hash, parsed.decision_context);
    hash.update(b",\"cccPrecommitRegistrySnapshotSha256\":");
    update_quoted_hex(&mut hash, &parsed.registry.snapshot_sha256);
    hash.update(b",\"cccRevealCommitmentSha256\":");
    update_nullable_hex(&mut hash, ccc.as_ref().map(|value| value.commitment_sha256));
    hash.update(b",\"cccRevealSha256\":");
    update_nullable_hex(&mut hash, ccc.as_ref().map(|value| value.reveal_sha256));
    hash.update(b",\"cccRevealSourceId\":");
    update_nullable_source(&mut hash, ccc.as_ref().map(|value| value.source_id));
    hash.update(b",\"postLedgerSha256\":");
    update_quoted_hex(&mut hash, &post_ledger);
    hash.update(b",\"preLedgerSha256\":");
    update_quoted_hex(&mut hash, &batch.pre_ledger_sha256);
    hash.update(b",\"receiptDigests\":");
    update_digest_array(&mut hash, receipt_digests);
    hash.update(b",\"sealSha256\":");
    update_quoted_hex(&mut hash, &batch.seal_sha256);
    hash.update(b"}");
    hash.finalize().into()
}

#[allow(clippy::too_many_arguments)]
fn canonical_finalization_sha256(
    batch: &crate::RewardAllocatorBatch,
    parsed: &ParsedSeal<'_>,
    ccc: &Option<VerifiedCcc<'_>>,
    post_ledger: [u8; 32],
    receipt_set: [u8; 32],
    outcome: [u8; 32],
    receipt_digests: &[[u8; 32]],
) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(b"{\"activationReady\":false,\"cccDecisionContextSha256\":");
    update_nullable_hex(&mut hash, parsed.decision_context);
    hash.update(b",\"cccPrecommitRegistrySnapshotSha256\":");
    update_quoted_hex(&mut hash, &parsed.registry.snapshot_sha256);
    hash.update(b",\"cccRevealCommitmentSha256\":");
    update_nullable_hex(&mut hash, ccc.as_ref().map(|value| value.commitment_sha256));
    hash.update(b",\"cccRevealSha256\":");
    update_nullable_hex(&mut hash, ccc.as_ref().map(|value| value.reveal_sha256));
    hash.update(b",\"cccRevealSourceId\":");
    update_nullable_source(&mut hash, ccc.as_ref().map(|value| value.source_id));
    hash.update(b",\"finalized\":true,\"fundingRoundAtUnixSeconds\":\"");
    update_i64(&mut hash, parsed.funding_round);
    hash.update(b"\",\"outcomeSha256\":");
    update_quoted_hex(&mut hash, &outcome);
    hash.update(b",\"postLedgerSha256\":");
    update_quoted_hex(&mut hash, &post_ledger);
    hash.update(b",\"preLedgerSha256\":");
    update_quoted_hex(&mut hash, &batch.pre_ledger_sha256);
    hash.update(b",\"receiptDigests\":");
    update_digest_array(&mut hash, receipt_digests);
    hash.update(b",\"receiptSetSha256\":");
    update_quoted_hex(&mut hash, &receipt_set);
    hash.update(b",\"schema\":\"iat-b3-reward-capacity-round-finalization/v1\",\"sealSha256\":");
    update_quoted_hex(&mut hash, &batch.seal_sha256);
    hash.update(b",\"status\":\"FINALIZED_NON_ACTIVATING\"}");
    hash.finalize().into()
}

fn update_nullable_hex(hash: &mut Sha256, value: Option<[u8; 32]>) {
    if let Some(value) = value {
        update_quoted_hex(hash, &value);
    } else {
        hash.update(b"null");
    }
}

fn update_nullable_source(hash: &mut Sha256, value: Option<&[u8]>) {
    if let Some(value) = value {
        hash.update(b"\"");
        hash.update(value);
        hash.update(b"\"");
    } else {
        hash.update(b"null");
    }
}

fn update_quoted_hex(hash: &mut Sha256, value: &[u8; 32]) {
    hash.update(b"\"");
    hash.update(lower_hex(value));
    hash.update(b"\"");
}

fn update_u64(hash: &mut Sha256, value: u64) {
    let (start, bytes) = decimal_u64(value);
    hash.update(&bytes[start..]);
}

fn update_i64(hash: &mut Sha256, value: i64) {
    let (start, bytes) = decimal_i64(value);
    hash.update(&bytes[start..]);
}

fn decimal_u64(mut value: u64) -> (usize, [u8; 20]) {
    let mut out = [b'0'; 20];
    let mut start = out.len() - 1;
    while value >= 10 {
        out[start] = b'0' + (value % 10) as u8;
        start -= 1;
        value /= 10;
    }
    out[start] = b'0' + value as u8;
    (start, out)
}

fn decimal_i64(value: i64) -> (usize, [u8; 20]) {
    let negative = value < 0;
    let magnitude = value.unsigned_abs();
    let (mut start, mut out) = decimal_u64(magnitude);
    if negative {
        start -= 1;
        out[start] = b'-';
    }
    (start, out)
}

# Promotions DLC public status

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

Updated: 2026-07-31 13:39 UTC

Public draft PR: https://github.com/InternalAgencyIO/InternalAgency/pull/8

Public branch: `agent/iat-promotions-dlc-draft`

Previously published public increment: `c5db78a`

The authoritative current commit is always the head of the public draft PR.
This status file deliberately does not claim a self-referential commit hash.

## Completed

- fixed public product and economic contract;
- architecture, trust-boundary, privacy, and activation plan;
- campaign and nomination state machines;
- threat model and adversarial matrix;
- exact integer accounting policy and validator;
- 28 policy mutation tests;
- standalone, network-free reference engine;
- isolated community promotion-vault funding gate;
- pure-state nomination, cancellation, activation, and settlement operations;
- atomic rollback fault injection after either modeled transfer;
- replay, stable-X-ID, self-referral, triple-deduplication, full-cap, final-slot,
  and permanent-terminal-state tests;
- canonical verifier-attestation envelope with detached-signature boundary;
- 300-second attestation and 600-second wallet-proof freshness limits;
- no raw X user ID, OAuth token, or signing key in the public envelope;
- append-only transparency hash chain and public checkpoints;
- tamper, key/campaign mismatch, truncation, and history-rewrite tests; and
- twelve deterministic randomized state-machine traces;
- independent rejection tests for every proposer and hero node/wallet/X role
  dimension;
- deterministic cancellation-versus-settlement terminal ordering;
- fixed account layouts and eight-instruction proposed binary interface;
- canonical discriminator derivation and fixed little-endian serialization;
- one public byte vector for every proposed instruction;
- a network-free codec and structural interface validator; and
- mutation tests for deployment claims, layout drift, forbidden V2 accounts,
  integer boundaries, ambiguous bytes, weakened atomicity, and terminal guards;
- network-free adapter from encoded instructions to pure state transitions;
- exact verifier-result binding across public key, message, campaign, purpose,
  attestation ID, nonce, timestamps, node, wallet, and X commitment;
- encoded lifecycle coverage for initialization, funding, activation,
  nomination, cancellation, settlement, exhaustion, and surplus finalization;
- adapter rollback proof for policy, attestation, and injected transfer failures;
  and
- a complete 1,000-pair exhaustion run using encoded transitions;
- public-key-only RFC 8032 Ed25519 tests 1 and 2 with their primary source;
- runtime verification without storing or generating any private key;
- rejection of every changed byte across both 64-byte RFC signatures;
- deterministic fuzzing of 2,048 randomly generated fixed-width instructions;
- complete truncation and trailing-byte rejection across every instruction;
- canonical decode/re-encode checks for every single-bit vector mutation; and
- 128 verifier-binding mutations that all preserve byte-identical campaign
  state;
- pure public-key rotation and emergency-disable lifecycle model;
- separately reviewed, replay-resistant rotation scheduling;
- 24-hour minimum public notice and one-hour maximum old/new key overlap;
- explicit activation and retirement finalization with exact time boundaries;
- permanent key-reuse rejection and immutable identity-commitment domain;
- immediate terminal emergency disable with historical verification preserved;
  and
- canonical hash-chained key events and append-only public checkpoints;
- machine-readable verifier-registry amendment against interface v0;
- fixed layouts for registry, public-key record, and review receipt accounts;
- five proposed lifecycle instructions with no money or V2 account capability;
- read-only registry/key validity guards for every attestation consumer;
- deterministic byte vectors for all proposed lifecycle instructions;
- permanent review-receipt and key-record replay barriers; and
- explicit `baseV0Deployable: false` and `amendmentApplied: false` release gates;
- deterministic full-interface composition preview derived from both interface
  sources and both public vector artifacts;
- canonical SHA-256 source bindings and exact recomposition validation;
- removal of the obsolete inline verifier initializer argument;
- read-only registry/key insertion and complete issuance-time guard composition
  across nomination, cancellation, and settlement;
- cross-domain name and discriminator collision rejection;
- stale source, stale vector, deployment-claim, and writable external-account
  drift tests; and
- explicit `deployable: false` and `compositionApplied: false` preview gates;
- deterministic all-thirteen-instruction composed vector artifact;
- explicit removal of the obsolete 32-byte initializer vector payload;
- vector discriminator, length, byte, and round-trip drift validation;
- exact byte offsets and end offsets for all eight proposed account layouts;
- exact data offsets, encoded lengths, and account-meta indices/flags for all
  thirteen proposed instructions;
- canonical layout digests bound to the composed preview and vectors;
- language-neutral u8/u16/u32/u64/i64, bytes, bytes32, and public-key fixtures;
- gap, overlap, final-size, vector-length, meta-order, unsafe-number, scalar-byte,
  and stale-source rejection tests; and
- explicit client-binding-only and undeployable ABI status gates;
- fourteen fixed-width campaign, settlement, terminal, and verifier event
  layouts covering all thirteen composed instructions;
- one deterministic public byte vector for every event;
- fixed event discriminator domain, little-endian codec, and exact round trips;
- success-only emission and transaction-rollback semantics with accounts and
  receipts remaining authoritative;
- exact PairSettled destinations, commitment bindings, 120/60 rewards, receipt,
  sequence, counters, and vault-balance evidence;
- terminal pair-1,000 event without impossible arbitrary-account bulk writes;
- prior/new verifier hash heads bound to registry state;
- no raw X user ID, mutable X handle, secret, or signing material in events;
- exhaustive truncation, trailing-byte, malformed-field, privacy, economics,
  stale-vector, source-drift, and deployment-claim rejection; and
- explicit `eventInterfaceApplied: false` release gate;
- network-free ordered event/account reconciler with no RPC or wallet import;
- machine-readable reconciliation policy bound to the event-interface digest;
- complete campaign-history, funding, activation, cancellation, nomination,
  settlement, exhaustion, and surplus-finalization ordering checks;
- exact receipt/event bijection and full receipt-field comparison;
- campaign counter, reward-total, and promotion-vault snapshot reconciliation;
- explicit isolation of unsolicited vault deposits as non-budget surplus;
- same-transaction pair-1,000 exhaustion and permanent terminal-state proof;
- verifier zero-hash genesis, prior-head continuity, final registry-head, and
  emergency-terminal reconciliation;
- a complete 1,000-pair event/receipt/account reconciliation run; and
- policy, byte, cursor, receipt, counter, vault, terminal, refund, verifier,
  source-drift, and deployment-claim rejection tests.

Current proposal-only result: **128 tests passed**. This consists of 28 protected
policy tests, 13 reference-engine tests, eight attestation/transparency tests,
two deterministic randomized-state-machine tests, and eight program-interface
and codec tests, five encoded transition-adapter tests, four deterministic
byte-fuzz tests, three Ed25519 public-vector tests, and five verifier-key
lifecycle tests, seven lifecycle-amendment tests, twelve full-interface
composition and drift tests, eleven ABI offset/conformance tests, plus twelve
program-event interface tests and ten event/account reconciliation tests.

## Current guarantees of the reference model

- fixed 120 IAT hero and 60 IAT proposer reward;
- exactly 180 IAT per completed pair;
- no more than 1,000 completed pairs;
- no more than 180,000 IAT total outflow;
- pending, cancelled, invalid, and expired-attestation paths consume no slot;
- node, wallet, and X commitment markers are independent per reward role;
- a prior hero may later earn one proposer reward and vice versa;
- failed settlement returns no partial state;
- pair 1,001 cannot execute; and
- an exhausted campaign cannot reopen; all remaining nominations expire unpaid
  and release their reservations.

These are executable model properties, not claims about any deployed program.

## Open security decisions

- revoke standalone upgrade authority or use an enforced public timelock;
- identity-verifier key custody and emergency-reviewer threshold;
- independent reviewer authority and threshold;
- identity-commitment pepper custody and auditor procedure;
- X API terms, availability, minimal scopes, and retention;
- relayer and rent funding;
- exact community refund account;
- public-handle display consent; and
- legal review of promotion eligibility and regional restrictions.

## Next safe increment

Add deterministic public reconciliation fixtures and compact evidence digests
for active, cancelled, exhausted, surplus-finalized, and verifier-disabled
histories. Keep raw X identities absent and preserve every unapplied and
undeployable gate. No production import, chain connection, wallet operation, or
site deployment is needed for that work.

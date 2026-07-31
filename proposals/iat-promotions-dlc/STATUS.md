# Promotions DLC public status

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

Updated: 2026-07-31 15:28 UTC

Public draft PR: https://github.com/InternalAgencyIO/InternalAgency/pull/8

Public branch: `agent/iat-promotions-dlc-draft`

Previously published public increment: `463a63b`

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
  source-drift, and deployment-claim rejection tests;
- deterministic public fixtures for active, cancelled, exhausted,
  surplus-finalized, and verifier-disabled histories;
- two compact commitments over complete 2,006-event, 1,000-receipt histories;
- canonical evidence, record-array, snapshot, and reconciliation-result SHA-256
  digests for every fixture;
- domain-separated ordered record and receipt Merkle roots with fixed odd-node
  and empty-set rules;
- source hashes binding the held policy, event interface, reconciler, and
  deterministic fixture generator;
- no event bytes, account snapshots, receipt bodies, raw X identities,
  handles, signatures, or secrets in the compact public artifact;
- source, scenario, digest, Merkle, result, privacy, and deployment-drift tests;
- strict portable Draft-07 schemas for full evidence inputs and held results;
- closed object shapes, canonical decimal strings, lowercase fixed hex, exact
  status enums, and fixed reward/budget constants;
- explicit result constants preserving account authority and preventing event
  streams from claiming state-change authority;
- deterministic synthetic corpus with two valid evidence envelopes, two held
  results, and nine invalid pointer-based mutations;
- dependency-free local validation of the exact Draft-07 keyword subset used by
  the proposal, without claiming to be a general schema engine;
- structural validation followed by semantic reconciliation for every valid
  evidence example;
- schema source, open-object, economics, type, pattern, enum, required-field,
  extra-field, authority, privacy, and deployment-drift tests.
- deterministic content-addressed inventory of every non-self proposal file;
- normalized UTF-8 content hashes, domain-separated leaf hashes, and one
  deterministic binary Merkle root;
- explicit classification and counts for artifacts, generators, validators,
  tests, and supporting source;
- fail-closed symbolic-link, unknown-type, absolute-path, traversal,
  duplicate-path, malformed-digest, stale-content, stale-role, and stale-root
  guards;
- cross-platform LF/CRLF reproduction without weakening path or content
  commitments;
- an explicit, honest self-reference exclusion instead of an impossible
  recursive self-hash claim;
- no private evidence, identity, OAuth, signature, secret, or signing material
  in the published review inventory; and
- fixed network-free, undeployable, and unapplied manifest status gates.
- every intermediate Merkle level published for precise cross-review
  comparison, not only the final tree root;
- independent zero-dependency Python implementation of filesystem discovery,
  normalization, classification, content hashing, leaf hashing, tree building,
  summary accounting, and HOLD metadata;
- complete Node/Python manifest equality, including the intermediate vectors;
- nonzero independent-verifier failure on stale content or intermediate-node
  mutation; and
- the independent Python verifier itself classified and content-addressed as a
  validator in the review tree.
- deterministic machine-readable independent-review receipt template;
- required future binding to exact Git commit, review-manifest content digest,
  review-tree root, covered-file count, and canonical scope digest;
- fixed review coverage across eight security areas, every manifest entry, and
  every open security-decision disposition;
- explicit production, site, chain-state, wallet/key, DNS/hosting, and Genesis
  release-gate exclusions;
- reviewer-independence contract excluding concurrent author, operator,
  deployer, promotion-vault, and verifier-operator roles;
- review-only approval with zero activation effect and mandatory separate
  activation review;
- external-only Ed25519 attestation slots with no key generation, signing,
  public key, signature, reviewer, decision, target, or timestamp in the held
  template; and
- drift tests for bindings, scope, independence, decision, attestation,
  issuance, deployment, and activation claims.
- exact domain-separated unsigned receipt-message framing;
- fixed repository and PR binding plus exact ordered commit, manifest, tree,
  file-count, scope, reviewer, decision, rationale, findings, timestamp, and
  non-activation fields;
- canonical lowercase fixed-width hex and decimal-string JSON formats with
  fixed little-endian binary integers;
- one deterministic public unsigned message, length, and SHA-256 digest for
  each of the three allowed review-only decisions;
- exact encode/decode round trips with missing, extra, or reordered fields
  rejected;
- independent digest-change proof for every target, scope, reviewer, decision,
  rationale, findings, and timestamp binding;
- malformed format, false independence, unknown decision, activation claim,
  truncation, trailing-byte, magic, and decision-code rejection; and
- no key, signature, secret, raw X identity, handle, wallet capability, or
  cryptographic attestation in the public payload vectors.
- verify-only detached Ed25519 adapter for future externally supplied receipt
  attestations;
- positive verification through the two published RFC 8032 section 7.1 public
  vectors without loading private material;
- explicit proof that unrelated valid RFC signatures fail against all three
  canonical receipt payloads;
- payload-digest comparison before detached-signature verification;
- exact attestation shape, algorithm, public-key, signature, and message-format
  validation with malformed input failing without exceptions;
- changed key, signature, message, digest, invalid payload, and activation
  payload rejection;
- cryptographic verification explicitly separated from review semantics,
  reviewer independence, and activation authority; and
- source-level exclusion of signing, private-key, key-generation, wallet, and
  network capabilities, with no valid review-receipt signature published.

Current proposal-only result: **177 tests passed**. This consists of 28 protected
policy tests, 13 reference-engine tests, eight attestation/transparency tests,
two deterministic randomized-state-machine tests, and eight program-interface
and codec tests, five encoded transition-adapter tests, four deterministic
byte-fuzz tests, three Ed25519 public-vector tests, and five verifier-key
lifecycle tests, seven lifecycle-amendment tests, twelve full-interface
composition and drift tests, eleven ABI offset/conformance tests, plus twelve
program-event interface tests and ten event/account reconciliation tests.
Five compact reconciliation-vector and Merkle-commitment tests complete the
compact-vector suite, and six Draft-07 schema/example tests complete the current
suite. Eight content-addressed review-manifest tests and three independent
Python integration tests complete the review-surface suite. Eight held
independent-review receipt-template tests complete the review-contract suite.
Ten unsigned review-payload codec, binding, privacy, and byte-vector tests
complete the canonical payload suite.
Nine verify-only Ed25519 adapter, public-vector, malformed-input, source-safety,
and non-activation tests complete the cryptographic verification suite.

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

Add a complete review-receipt acceptance policy combining target, scope,
independence, semantic, and detached-signature gates without publishing a
signed receipt. Preserve the privacy boundary and every unapplied and
undeployable gate. No production import, chain connection, wallet operation, or
site deployment is needed for that work.

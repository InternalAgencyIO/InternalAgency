# Promotions DLC public status

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

Updated: 2026-07-31 11:50 UTC

Public draft PR: https://github.com/InternalAgencyIO/InternalAgency/pull/8

Public branch: `agent/iat-promotions-dlc-draft`

Previously published public increment: `90be7f9`

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
- a complete 1,000-pair exhaustion run using encoded transitions.

Current proposal-only result: **64 tests passed**. This consists of 28 protected
policy tests, 13 reference-engine tests, eight attestation/transparency tests,
two deterministic randomized-state-machine tests, and eight program-interface
and codec tests, plus five encoded transition-adapter tests.

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
- identity-verifier key custody, rotation, and emergency response;
- independent reviewer authority and threshold;
- identity-commitment pepper custody and auditor procedure;
- X API terms, availability, minimal scopes, and retention;
- relayer and rent funding;
- exact community refund account;
- public-handle display consent; and
- legal review of promotion eligibility and regional restrictions.

## Next safe increment

Add property-based codec and transition fuzzing plus public Ed25519 verification
vectors. No production import, chain connection, wallet operation, or site
deployment is needed for that work.

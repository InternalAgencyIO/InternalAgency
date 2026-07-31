# Promotions DLC public status

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

Updated: 2026-07-31 10:59 UTC

Public draft PR: https://github.com/InternalAgencyIO/InternalAgency/pull/8

Public branch: `agent/iat-promotions-dlc-draft`

Last published planning baseline: `374ca6a`

The authoritative current commit is always the head of the public draft PR.
This status file deliberately does not claim a self-referential commit hash.

## Completed

- fixed public product and economic contract;
- architecture, trust-boundary, privacy, and activation plan;
- campaign and nomination state machines;
- threat model and adversarial matrix;
- exact integer accounting policy and validator;
- 23 policy mutation tests;
- standalone, network-free reference engine;
- isolated community promotion-vault funding gate;
- pure-state nomination, cancellation, activation, and settlement operations;
- atomic rollback fault injection after either modeled transfer;
- replay, stable-X-ID, self-referral, triple-deduplication, full-cap, final-slot,
  and permanent-terminal-state tests.

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

Define the verifier-attestation envelope and transparency-log format, then add a
network-free signature/replay model and randomized state-machine property tests.
No production import, chain connection, wallet operation, or site deployment is
needed for that work.

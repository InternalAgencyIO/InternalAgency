# Propose a Hero future DLC security audit

> **FUTURE FEATURE — DRAFT — INACTIVE — NOT PART OF GENESIS — NOT DEPLOYED — NO CLAIM ROUTE — HOLD**

## Decision

**HOLD. Do not fund, deploy, activate, or expose a claim route for this DLC.**

The reviewed branch is correctly isolated from the Genesis candidate and is
consistently labelled inactive. Its exact integer model also preserves the
1,000-pair and 180,000-IAT caps in the reviewed tests. Those are meaningful
positives.

The package is nevertheless not activation-ready. It contains a network-free
JavaScript state model, a proposed ABI, codecs, vectors, and review tooling—not
an executable Solana program. The accepted X Premium requirement is absent.
Pending nominations can reserve a hero indefinitely, and an active campaign
has no timeout or emergency refund path before pair 1,000.

## Intended future boundary

- This feature is optional and cannot block Genesis.
- Its earliest possible opening is exactly eight hours after independently
  verified mainnet Genesis.
- Time alone never activates it: final code, a separate audit, separate funding,
  and an explicit reviewed activation transaction remain required.
- “Instant” means preparation starts after verification; normal Solana
  confirmation still applies.

## Identity model applied

A qualifying participant is one unique Solana wallet plus one unique immutable
X user ID plus active X Premium. The authenticated X account must also be at
least 40 complete 24-hour periods old at the participant's eligibility
checkpoint. In exact terms, `observed_at - account_created_at >= 3_456_000`
seconds. Missing, malformed, future-dated, or too-young `created_at` evidence
fails closed.

One person may control multiple qualifying pairs. A same-human referral using
two independently qualifying pairs is allowed under this model;
“self-proposal” can only mean equality of an enforceable wallet or immutable X
identifier unless the owner later adopts proof of personhood.

The reviewed proposal also deduplicates a node identifier. That extra dimension
must be reconciled with the accepted wallet/X/Premium definition so an opaque or
unstable node record cannot deny an otherwise valid pair.

## Source and method

- Public source PR: [draft PR #8](https://github.com/InternalAgencyIO/InternalAgency/pull/8)
- Audited commit: `eafb13c43db78ab182bbbe8fa3890cc1368dd132`
- Proposal tree: `0b6a258cf6f75e140431d91e906d2253c62566fe`
- Scope: all 268 tracked files under `proposals/iat-promotions-dlc/`
- Deep manual review: policy, state engine, attestation boundary, proposed ABI,
  key lifecycle, event reconciliation, test assertions, and public status.
- Execution: all 510 tests in the 55-file proposal suite passed, including the
  104-test security-critical policy/engine/attestation/interface subset.

The exact source digests are in [scope.json](scope.json), the findings in
[findings.json](findings.json), and the adversarial conclusions in
[attack-matrix.json](attack-matrix.json).

## What is strong already

- Exact base-unit accounting: 120 IAT to the hero, 60 IAT to the proposer,
  180 IAT per completed pair, 1,000 pairs, 180,000 IAT total.
- Pending, cancelled, and invalid attempts do not consume a completed slot.
- Stable X commitments make handle changes non-authoritative.
- The reference engine uses copy-on-write settlement and fault injection to
  demonstrate model-level rollback after either modeled transfer.
- Role-specific node, wallet, and X markers reject replay in the model.
- Pair 1,000 enters a permanent exhausted state and releases remaining model
  reservations.
- Public artifacts repeatedly and accurately state that nothing is deployed.

## Required closure before any future activation review

1. Implement the final Solana program in a new isolated path and audit the
   actual account constraints, PDA derivations, token CPI, concurrency, rent,
   close authority, upgrade policy, and SBF binary.
2. Add fail-closed X Premium and 40-day account-age evidence to the signed
   attestation. Request `id`, `subscription_type`, and `created_at` for the
   authenticated user; bind the allowed tier, account creation time,
   observation time, freshness, policy version, and immutable X commitment;
   and define downgrade, outage, and appeal rules.
3. Add bounded nomination expiry and permissionless cleanup, plus hero rejection
   or equivalent anti-griefing semantics.
4. Define an active-campaign timeout/emergency stop and immutable refund path
   that cannot redirect funds or reopen a terminal campaign.
5. Bind Genesis time to a precisely owned, typed, mainnet Genesis record; a
   caller string or supplied timestamp is not proof.
6. Resolve verifier/reviewer/pepper custody with independent threshold review,
   publish the final hashes, and obtain an independent audit of the final code.

## Limitations

This is an internal Codex-assisted source review, not an independent audit,
formal proof, production penetration test, legal review, X service audit, or
on-chain execution review. No wallet, key, signing device, secret, network
transaction, or funds were accessed. Passing a model test does not establish
Solana atomicity or deployment safety. The 40-day rule raises the cost and lead
time of newly created account farms; it does not detect purchased aged accounts,
payment fraud, common beneficial ownership, or unique humans.

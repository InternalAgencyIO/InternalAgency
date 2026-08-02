# CCC Associates future DLC security audit

> **INTENDED FUTURE FEATURE — NOT PART OF GENESIS — INACTIVE — NOT DEPLOYED ON MAINNET — NOT DEPLOYED AS A SEPARATE DLC — NO CLAIM ROUTE — HOLD**

## Decision

**HOLD. The current V2 candidate does not technically keep Associates out of
Genesis. Do not deploy this candidate while claiming Associates is a separately
activated future DLC.**

Unlike the isolated Hero proposal, CCC Associate logic is compiled into the
current `iat_v2` program and its economic policy. Once the common V2 config is
active, the administrator can set role `2` and the wallet can open an Associate
position immediately. There is no separate DLC state, policy hash, activation
authority, feature flag, or Genesis-plus-one-week time guard.

The requested “maximum T+1 week” rule also needs one exact machine invariant:
does Associates open at an owner-selected time in `[Genesis, Genesis+1 week]`,
exactly at `Genesis+1 week`, or only after a separate review that itself must
finish within a week? This report does not schedule launch or choose among
those meanings. Every interpretation currently fails because the program has
no Associates activation timestamp at all.

## Identity model applied

One unique Solana wallet plus one unique immutable X user ID plus active X
Premium is one qualifying participant. One person may control multiple
qualifying pairs. This is not proof of personhood and multi-account behavior is
not treated as Sybil abuse when each pair independently meets all three rules.

Current on-chain Associate eligibility stores only wallet, role, and agency
index. It stores no immutable X commitment, Premium observation, attestation
nonce, freshness, or verifier key. The intended per-pair cost is therefore not
enforced at this boundary.

## Source and method

- Public launch PR: [draft PR #4](https://github.com/InternalAgencyIO/InternalAgency/pull/4)
- Audited commit: `48660c81e437c51e44cc067e7357f6ebc0c5d4ea`
- IAT V2 program tree: `6c06e1a6051de709ddcbd707e563a46d4a89a5b4`
- Deep review: activation, agency registration, eligibility, position opening,
  weekly settlement, CCC round selection, account layouts, economic policy,
  existing Devnet feature evidence, and inherited pre-launch findings.

Exact source hashes are in [scope.json](scope.json). Machine-readable findings
and attacks are in [findings.json](findings.json) and
[attack-matrix.json](attack-matrix.json).

## Important positives

- Position owners sign `open_position`, and destination token ownership is
  checked.
- A position snapshots its role, agency, rate, accepted week, term, and maximum
  reward reservation.
- Associate weekly rewards use integer math and the same reservation accounting
  as other roles.
- A selected agency is deterministically paused for the matching settled round.
- Duplicate agency-owner wallets are prevented by an owner-index PDA.
- The Devnet rehearsal exercised Associate eligibility, opening, pause, and
  settlement behavior. That is evidence of implemented behavior, not evidence
  of future-feature isolation.

## Required closure before Genesis deployment

1. Remove Associate capability from the Genesis artifact, or implement a
   fail-closed, one-way, separately reviewed DLC activation gate that cannot be
   opened at Genesis.
2. Specify the exact T+1-week invariant, using the canonical Genesis clock, and
   add boundary tests for every second before, at, and after the window.
3. Require a signed, fresh identity attestation binding the exact wallet,
   immutable X ID commitment, allowed X Premium tier, agency, role, campaign,
   nonce, and policy hash.
4. Require agency-owner consent and an economically qualified, epoch-bounded
   candidate set; otherwise permitted multi-account operators can cheaply pad
   the selection denominator.
5. Fix the inherited CCC first-committer reveal-withholding deadlock before any
   Associate position can depend on a round.
6. Separate upgrade, administration, identity-verifier, and asset-custody
   authority; obtain independent review of the final code and binary.

## Limitations

This internal review is not an independent audit, formal proof, production
penetration test, legal review, market analysis, or custody review. No wallet,
key, signing device, secret, network transaction, or funds were accessed. The
review does not activate Associates or set a launch time.

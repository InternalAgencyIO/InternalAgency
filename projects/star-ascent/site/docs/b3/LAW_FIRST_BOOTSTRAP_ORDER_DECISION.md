# Law-first bootstrap order decision

The canonical 17-stage ceremony is still `BLOCKED`, its production journal is
still `PENDING` with null evidence, and Mainnet is still `HOLD`. No canonical
stage was reordered by this decision artifact.

The machine-readable record is
[`iat-b3-law-first-bootstrap-order-decision.v1.json`](iat-b3-law-first-bootstrap-order-decision.v1.json).
It binds the exact current identity, authority-evidence, graph, owner-policy,
Law, Economy, local-assessor, and Devnet-assessor bytes. Its validator is
[`validate-iat-b3-law-first-bootstrap-order-decision.mjs`](../../scripts/validate-iat-b3-law-first-bootstrap-order-decision.mjs).

## Why a stage-only reorder is unsafe

Three current source predicates form the deadlock:

1. `iat_b3_law::process_initialize_law` validates the mint before creating Law
   state. `validate_mint_base` requires an initialized 9-decimal mint, the exact
   fixed supply, and null mint and freeze authorities. The two configured
   extension authorities must still equal the ceremony signer so Law can revoke
   them atomically.
2. The production Economy entrypoint authenticates a current finalized open Law
   account before it dispatches or decodes an instruction. The five
   initialization routes are behind that boundary and presently terminate in
   source-complete, effect-free policy `HOLD`s.
3. The current ceremony enters Economy staging at stage 8 and funds canonical
   accounts at stage 9, but initializes Law at stage 13 and finalizes the day at
   stage 15. Moving Law directly after stage 7 does not work: the fixed supply
   and null base authorities do not yet exist.

The held staging persistence candidate deliberately does not consume Daily Law,
but it has no production execution guard, frozen ABI, entrypoint, or dispatcher.
It cannot bypass the production boundary or authorize a ceremony.

## Engineering recommendation

The recommended policy is
`TREZOR_MODEL_T_CONTROLLED_FULL_SUPPLY_TRANSIT`. It is concrete engineering
policy, not owner acceptance or execution authority:

- create one authenticated Token-2022 associated token account whose owner has
  no hot-key, server-authority, delegate, or separate close-authority path;
- mint exactly `1,000,000,000` 9-decimal tokens
  (`1,000,000,000,000,000,000` base units) to that ATA in exactly one mint
  operation, then make both mint and freeze authorities null;
- initialize Law, atomically seal both extension authorities, finalize the
  current day, and observe it open before any Economy opcode;
- transfer only from the authenticated transit ATA to the exact canonical vault
  or owner-accepted beneficiary destinations, with current open Law and exact
  conservation checked after every transfer;
- never retry or resubmit automatically. A locked day or pre-transfer failure
  stops with the full immutable supply in transit. A mid-transfer failure stops
  with all untransferred immutable supply in transit and preserves only already
  observed, conserved canonical transfers for manual reconciliation; and
- close the transit ATA only after activation is observed, final conservation
  passes, and its balance is exactly zero.

The proposal keeps exactly 17 assessor-compatible stages:

1. deploy and make both programs immutable;
2. create the exact Token-2022 mint and authenticated transit ATA, then mint the
   full fixed supply exactly once;
3. revoke mint and freeze authorities;
4. initialize Law, revoke both extension authorities, and verify the terminal
   authority state;
5. finalize the current day and continue only if it is open;
6. enter Economy staging, create canonical accounts, and use Law-gated transfers
   from transit custody with a conservation check after every transfer;
7. verify final Genesis conservation and a zero transit balance, activate only
   on current open Law, verify staging is disabled, then close the zero-balance
   transit ATA.

The exact machine list is `candidateMigration.order` in the packet. It is
recommended but not owner-selected or authorized. The transit owner public key
and signed owner acceptance remain null. Those are the two remaining fields
that require the Trezor Model T. The transit ATA address and canonical
destination manifest remain derivation-dependent/null until the owner key and
currently unresolved destination public keys are bound. Exempting Economy from
Law or relaxing the fixed-supply/null-authority precondition remains outside the
objective.

## Digests and prospective rebindings

- Current canonical 17-stage assessor digest:
  `6f6d69392db5e9a7426d26c349dea64e12f177c3429f735fdf87f83b07e108ac`.
- Engineering-recommended, owner-unaccepted transit-custody proposal digest:
  `cbee6085861e858be61036c45cec74e90c782b537365e1c780447370a06dfb0f`.
- Current identity-freeze file digest:
  `17bcf00f97c5fd95bc39fa9eff120fd7f7678ed77f9bc333c36189f44633cacf`.
- Current production identity/authority evidence digest:
  `94fc32f1380843ec31b2d94077061d7e788114d346d71f7c3a1001f2fcd980c5`.
- Current canonical graph digest:
  `68b22e29f555adb2f59fe5cf42e6a1bf7783a8c962195de6f7736ccd9b1ea843`.

Because no canonical file changed, this packet creates no stale canonical
binding. If the policy is accepted later, the identity-freeze binding in the
production evidence must be repinned; the resulting production-evidence digest
must then be repinned in the graph's three reference-contract consumers; and
any local or Devnet authorization packet carrying the prior ceremony-stage
digest must remain stale and `HOLD`. None of those mechanical migrations may
promote a graph node or claim execution evidence.

## Signature and evidence boundary

The Trezor Model T remains the sole human gate only for actual cryptographic
signatures. This repository decision packet requires no signature. Automated,
source-bound direct observation may close non-signature predicates; unobserved,
partial, stale, contradictory, or invalid claims remain `HOLD`. No additional
human or native reviewer prerequisite is introduced.

Validate with the required Node 24 runtime:

```text
node scripts/validate-iat-b3-law-first-bootstrap-order-decision.mjs
node --test tests/iat-b3-law-first-bootstrap-order-decision.test.mjs
```

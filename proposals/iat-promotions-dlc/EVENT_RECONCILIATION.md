# Event/account reconciliation v1

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

`event-reconciler.mjs` is a network-free audit model. It consumes fixed event
bytes plus inert semantic snapshots and checks that the public event history
agrees with the authoritative campaign account, promotion-vault balance,
complete settlement-receipt set, and verifier-registry hash head. It cannot
query Solana, access a wallet, construct a transaction, authorize a transition,
or replace account state.

## Evidence envelope

Each event record has a zero-based contiguous ordinal, a 32-byte transaction
message hash, its transaction log index, and the lowercase-hex event bytes.
The event codec must decode every record exactly; duplicate cursors, reordered
ordinals, reordered logs in one transaction, unknown discriminators,
truncation, trailing bytes, and non-v1 events fail closed.

Semantic snapshot public keys are represented as their raw 32-byte lowercase
hex value, matching the fixed event codec. A future client may render them as
base58, but that display conversion is outside this held proposal.

The snapshot must contain:

- one campaign account with immutable economics, identities, counters, status,
  promotion-vault binding, refund binding, and verifier-registry binding;
- the bound promotion-vault token balance;
- the complete settlement-receipt set; and
- every verifier-registry account referenced by the stream.

The reconciler intentionally does not accept raw X user IDs, mutable handles,
OAuth material, private keys, signatures, RPC URLs, or production identifiers.

## Campaign proof

A complete campaign history begins with `CampaignInitialized`. Funding must be
exactly 180,000 IAT, activation must follow funding, and nominations and
settlements can occur only while active. Every `PairSettled` event must bind a
previously pending nomination, fixed 120/60 IAT rewards, a unique receipt, the
next completed-pair counter, and an exact receipt snapshot. Aggregate reward
totals and the final counter must equal the campaign snapshot.

The promotion vault may receive an unsolicited SPL-token deposit outside the
proposed program. The reconciler therefore distinguishes campaign budget from
unattributed surplus. A reported balance below fixed budget minus fixed paired
payouts is a deficit and fails. A larger balance is public surplus, never
reward capacity. Its running amount cannot decrease through a settlement.
After exhaustion it may be returned only to the immutable community refund
account; the final vault snapshot must still match.

Pair 1,000 must be followed by exactly one `CampaignExhausted` event in the
same transaction record. Its receipt, count, total paid, and vault balance must
match the final settlement. Further campaign work is rejected. Pending
nomination accounts need no impossible bulk write: the terminal campaign status
makes them ineligible, and the reconciler reports their derived pending count.

## Verifier proof

The verifier registry must be initialized after the campaign. Its first event
starts from the all-zero hash. Every later verifier event must reference the
previous event hash and advance to a distinct nonzero head. The final head and
status must equal the registry snapshot. Emergency disable is terminal; no
later verifier event is accepted.

This proves consistency of supplied public evidence, not inclusion on a chain.
A future reviewed client would still need independently verified account bytes,
token balances, receipts, transaction inclusion, finality, and log ordering.

## Held policy

`event-reconciliation-policy.v1.json` binds the event-interface digest, exact
economics, required evidence, and fail-closed invariants. It remains
`network: NONE`, `programId: null`, `deployable: false`, and
`reconciliationApplied: false`.

Run the isolated tests with:

```sh
node --test proposals/iat-promotions-dlc/tests/event-reconciler.test.mjs
```

## Compact public vectors

`event-reconciliation-vectors.v1.json` binds five deterministic histories:
active with two pairs, pre-activation cancellation, pair-1,000 exhaustion,
surplus finalization, and terminal verifier disable. The two full-cap fixtures
each contain 2,006 generated events and 1,000 receipt snapshots, but the public
artifact stores only counts, held reconciliation summaries, canonical SHA-256
digests, and domain-separated record/receipt Merkle roots.

Leaves commit to canonical JSON and array order. Nodes commit to their raw
32-byte child hashes; an odd final node is duplicated. Empty sets have a
domain-separated empty root. The artifact also binds the policy, event
interface, reconciler source, and generator source.

Source-code hashes normalize CRLF to LF before SHA-256 so the artifact is
portable across Windows and Unix checkouts. The compact file deliberately
omits event bytes, full account snapshots,
receipt bodies, raw X identity, handles, OAuth data, signatures, and secret
material. Reproduce and validate it with:

```sh
node proposals/iat-promotions-dlc/generate-event-reconciliation-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-event-reconciliation-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/event-reconciliation-vectors.test.mjs
```

## Portable Draft-07 schemas

`event-reconciliation-evidence.schema.v1.json` fixes the full input envelope,
semantic campaign and vault snapshots, complete settlement receipt shape, and
verifier-registry snapshots. `event-reconciliation-result.schema.v1.json`
fixes the held result and requires both non-authority booleans to remain true.
All object shapes are closed, integers are canonical decimal strings, byte
values are lowercase 32-byte hex, and fixed campaign economics use `const`.

JSON Schema validates structure, not cross-field meaning. Ordered counters,
same-transaction exhaustion, receipt bijection, reward totals, vault surplus,
terminal status, and verifier hash heads still require `event-reconciler.mjs`.

`event-reconciliation-schema-examples.v1.json` contains two fully synthetic
valid evidence envelopes, two held results, and nine pointer-based invalid
mutations with their expected Draft-07 keyword. Valid evidence is also run
through semantic reconciliation. The corpus contains commitments only—no raw X
identity, mutable handle, OAuth material, signing field, or secret.

`json-schema-subset.mjs` is a dependency-free validator only for the Draft-07
keywords used here. It is not presented as a general JSON Schema engine;
portable consumers should use any conforming Draft-07 implementation.

```sh
node proposals/iat-promotions-dlc/generate-event-reconciliation-schema-examples.mjs --write
node proposals/iat-promotions-dlc/validate-event-reconciliation-schemas.mjs
node --test proposals/iat-promotions-dlc/tests/event-reconciliation-schema.test.mjs
```

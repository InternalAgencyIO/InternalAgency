# B3 owner-policy freeze intake

Status: **PRODUCTION / BLOCKED / non-activating**.

[`iat-b3-owner-policy-freeze.v1.json`](./iat-b3-owner-policy-freeze.v1.json)
is the bounded owner-choice intake for seven policy-controlled B3 dependency
nodes. It records exact choices needed before engineering can safely continue;
it does not complete those graph nodes, inspect a chain, verify a signer, accept
evidence, authorize Devnet, activate a program, or authorize release/Mainnet.

The canonical manifest intentionally leaves every unresolved owner choice
`null`. Its immutable assurance surface remains false with `mainnetStatus:
"HOLD"`. A copy with every choice populated may be *structurally complete*, but
the validator still returns false for owner authentication, external and
engineering evidence, chain truth, source-bound binary bindings, Genesis
conservation, ceremony funding, Devnet, activation, release, and Mainnet.

## Safe choice order

Choices are consumed only in this order:

1. `LIVE_ESTATE_CANONICAL_MINT_DECISION` identifies whether any live Estate
   mint exists and chooses adoption, migration, replacement, or a fresh
   Token-2022 mint without permitting duplicate canonical supply.
2. `CORE_CUSTODY_POLICY_ADAPTER` and `FACTION_ECONOMICS_FUNDING` may be decided
   in parallel after the asset decision.
3. `CONFIG_GENESIS_PHASE_CODEC` binds the exact one-way, fail-closed bootstrap
   policy after both custody and faction economics are chosen.
4. `GENESIS_ALLOCATIONS_CONSERVATION` supplies beneficiaries and the exact
   faction carve-out while retaining all V2 amounts, cliffs, and lane order.
5. `PRODUCTION_IDENTITY_INPUT_FREEZE` supplies three distinct production
   identities plus cluster, entropy, metadata, and canonical seed-table
   choices. Choosing an entropy lag alone is insufficient: the owner must
   explicitly accept the lagged-slot-hash construction's finalizer-timing
   influence and limit probability claims to the exact threshold for a
   supplied hash. Otherwise the architecture must be redesigned before this
   node can complete.
6. `B3_COST_CEREMONY_FUNDING` supplies only public/accountable payer and funding
   policy inputs after final identity-dependent costs can be measured.

Completing a later node before its dependencies does not make it eligible in
the validator result. The two stage-2 decisions must both be complete before
stage 3 can become eligible.

## Frozen constraints versus owner choices

The packet repeats only constraints already fixed by V2 or B3 law, including:

- V2's default disposition is `KEEP`; feature cuts and Daily Law weakening are
  forbidden.
- The asset model is one hooked Token-2022 canonical mint; any live Original
  SPL mint can only be a reconciled migration source.
- Core enforcement applies only to protocol-originated custody, uses the exact
  post-burn `ceil(max(0, 10*C - S) / 9)` rule, introduces no delegate, and
  requires current open Daily Law plus same-day atomic reconciliation.
- There are exactly five narrative factions, leaders have no protocol
  authority, allegiance cooldown is 86,400 seconds, every faction write is
  Daily-Law-gated, and debt, leapfrog, and partial funding are forbidden.
- Genesis phases are `UNINITIALIZED -> GENESIS_STAGING -> ACTIVE`; public
  economic writes are forbidden before the one-way atomic activation.
- The fixed 1,000,000,000 IAT supply, V2 allocation amounts/unlocks/cliffs,
  and treasury-to-ecosystem-to-liquidity reward order are retained exactly.
- Identity inputs retain the Daily Law domain, Mainnet-only canonical scope,
  22 ordered seed roles, Token-2022, nine decimals, the exact two-extension
  allowlist, and null/absent terminal authorities. The entropy construction
  does not claim an unbiased or exact realized probability and requires
  source-bound automated delayed-finalizer, grinding, and leader-influence
  measurement.
- The owner-frozen aggregate fresh-payer peak ceiling is 3,000,000,000
  lamports. Crossing it requires a new exact owner ceiling; it never permits a
  feature cut.

Every value still requiring owner judgment is isolated under `ownerChoices`.
Policy documents with many fields are bound by lowercase SHA-256 digests; the
intake does not carry arbitrary prose or executable content. Public keys,
digests, canonical decimal strings, bounded integers, and fixed enums are
validated semantically in addition to the strict JSON schema.

## Evidence boundary

Each node lists two requirement inventories:

- `external` names source-bound automated receipt, state, and endpoint
  observations, provider/authentication work, public-key control attestations,
  funding accountability, or explicit owner choices;
- `engineering` names native bytes, conservation, differential, adversarial,
  and rehearsal evidence that implementation must produce.

Those arrays are requirements, not evidence slots. This v1 contract accepts no
external or engineering proof payloads. A detached public signature reference
may be recorded under `ownerAcceptance`, but the validator deliberately does
not authenticate its signer or treat self-attestation as external proof.
Secrets, private keys, seed phrases, custom fields, and PEM private-key material
are rejected. Secret material must never be placed in this packet.

Downstream evidence contracts must later bind accepted owner choices, chain
state, source-bound binary hashes, Genesis conservation, and accountable
funding through automated direct observations. Non-signature predicates have
no human-review prerequisite; unobserved claims remain `HOLD`. The Trezor Model
T physical-confirmation step is the sole human gate, and only for actual
cryptographic signatures. Explicit owner policy choices remain owner decisions
and are never synthesized from machine observations. Only those downstream
contracts and the canonical release graph can determine node completion.

The retained V2 policy field `publicRoles.independentVerifier` is an immutable
compatibility name for the existing FDF Guard protocol identity and address. It
is not a current reviewer, approver, signature source, or release predicate.
Current ceremony and activation evidence explicitly requires automated
source/receipt/state observation, `humanReviewerRequired: false`, and
`noSelfAttestation: true`. Renaming or removing that retained identity would
change the inherited V2 feature surface, so the compatibility field remains;
no validator may infer human authorization from its legacy name.

## Validation

Use the repository's supported Node runtime:

```text
node scripts/validate-iat-b3-owner-policy-freeze.mjs
node --test tests/iat-b3-owner-policy-freeze.test.mjs
```

The normal CLI exits zero when the canonical blocked intake is structurally
valid. `--require-owner-choices-complete` exits `2` while choices are missing;
it does not request or imply release readiness. Invalid JSON or semantics exit
`1`. The parser rejects duplicate object members before `JSON.parse`, including
nested and escape-equivalent duplicates.

The semantic validator traverses only descriptor-safe plain objects and dense,
undecorated arrays. It never reads accessor values and rejects accessors,
symbols, non-enumerable properties, custom/null prototypes, sparse/decorated
arrays, cycles, aliases, non-finite/unsafe integers, negative zero, BigInt,
functions, `undefined`, and lone Unicode surrogates.

The companion
[`iat-b3-owner-policy-freeze.v1.schema.json`](./iat-b3-owner-policy-freeze.v1.schema.json)
uses JSON Schema 2020-12, disallows unknown properties throughout, and fixes the
same safety surface. The semantic validator remains authoritative for Base58
decoding, forbidden production identities, cross-node equality, arithmetic,
safe decision order, and the immutable false/HOLD result.

# V2 parity and public-claims readiness

Status: **BLOCKED / NON-ACTIVATING / MAINNET HOLD**

This packet is the largest truthful isolated parity slice that can be completed
without editing the active application, localization, casino, media, native
runtime bridge, package, or release-graph work. It inventories every row in the
canonical V2 feature-parity contract, verifies that the inherited V2 source is
still present at `HEAD`, and freezes the public-claims boundary implied by the
canonical B3 dependency graph.

It does not claim that the B3 runtime has ported or rehearsed every feature.

## What the packet proves

The machine-readable contract and validator prove only these repository facts:

1. `f0a794952ab822d823c8d8eba0c4c8f5d9ae4796` is an ancestor of `HEAD`.
2. Thirteen representative V2 source surfaces exist at that commit and at
   `HEAD`, including on-chain policy, clients, wallet/X binding, the bounded
   network API, localization, inactive future previews, and the non-signing
   admin console.
3. All 15 inherited V2 on-chain entrypoints remain present in the committed V2
   program source.
4. All 53 canonical parity rows are mapped exactly once across seven evidence
   slices.
5. Every row remains under the default `RETAIN` decision. There are zero cut
   exceptions and zero owner-cut artifacts.
6. Evidence cited by the seven slices is confined to committed, clean B3
   documents. Dirty application, localization, casino, media, and runtime
   implementation paths cannot be substituted as accepted evidence.
7. The exact seven prerequisites of `RELEASE_SURFACE_PUBLIC_CLAIMS` are still
   `BLOCKED` with no completion evidence, and the release-claims node is also
   `BLOCKED`.
8. Manifest traversal is descriptor-safe and accepts only canonical JSON data:
   plain objects, dense undecorated arrays, enumerable data properties, valid
   Unicode strings, and finite safe integers other than negative zero. It
   rejects accessors without invoking them, symbols, hidden properties,
   custom/null prototypes, sparse arrays, decorations, cycles, aliases,
   nonfinite values, fractions, `-0`, and `BigInt`.
9. The CLI scans JSON source before decoding and rejects duplicate member names,
   including escaped names that decode to an earlier top-level or nested key.

The canonical result therefore reports:

```text
sourceInheritanceVerified=true
featureInventoryMapped=true
zeroUnauthorizedCuts=true
implementationSliceInventoryComplete=true
productionParityPacketComplete=false
releaseSurfaceClaimsPacketComplete=false
publicReleaseClaimsAuthorized=false
activationReady=false
deploymentAuthorized=false
mainnetExecutionAuthorized=false
mainnetStatus=HOLD
```

Source inheritance is not runtime parity. A retained file, a reference model,
a codec, a prepared native intent, or a local passing test cannot be promoted
into a production completion claim.

## Seven implementation slices

| Slice | Current truthful state | Main remaining work |
| --- | --- | --- |
| Canonical asset and Privacy Vault | Blocked production asset/privacy | Signed mint and migration decision; exact-version native confidential lifecycle; privacy review |
| V2 economy, rewards, and CCC | Partial native port | Production entrypoint/dispatcher/CPI; complete native handlers; Config/Genesis and end-to-end differential rehearsal |
| Custody, ceremony, and reproducibility | Inherited transition boundary | Core/community custody policy, B3 supersession, final reproducible binaries, accountable ceremony funding |
| Identity, social, and network | Partial references and application adapters | Production X/checkpoint providers, B3 identity adapter, rollback protection, network adapter, integration rehearsal |
| Public domains and localization | Inherited runtime; review blocked | Native review and immutable acceptance for all 50 locales; production dual-host evidence |
| Inactive future and admin surfaces | Inherited inactive; final evidence pending | Final no-activation and cross-engine isolation proof |
| B3 Lockdown, factions, core, and waterfall | Partial B3 reference/native preparation | Production Daily Law hook, combined stake ingress, owner-frozen faction/core rules, downstream consumer integration |

No slice is labeled complete. This is deliberate: the canonical graph's
`V2_FEATURE_PARITY` node remains blocked until actual B3 implementation,
differential evidence, migration behavior, final inactive-surface proof, and
independent review are complete.

## Public-claims boundary

Claims that remain truthful when stated with exact scope are limited to:

- inherited V2 source;
- B3 reference or partial implementation status;
- exact local test results;
- exact-scope Devnet attempts; and
- Mainnet HOLD.

The following claim classes remain forbidden:

- full V2 parity complete;
- all features rehearsed on Devnet;
- production identities frozen;
- all 50 locales natively accepted;
- all media masters complete;
- B3 deployed or activation-ready; and
- Mainnet launch authorized.

This policy does not rewrite public application copy. It provides a bounded
validator that future release-surface work can consume only after the graph's
seven prerequisites close.

## Owner and external inputs

Code alone cannot supply these remaining inputs:

1. a signed canonical mint and migration decision for every live Estate;
2. frozen production program, mint, cluster, entropy, metadata, and authority
   inputs;
3. owner acceptance of core custody/release and faction economics, scoring,
   Sybil, snapshot, tie, authorization, carve-out, and funding rules;
4. authenticated production checkpoint and X evidence providers with rollback
   and independent-observer evidence;
5. accountable native review and immutable acceptance evidence for all 50
   locales;
6. all 16 release media masters plus license/legal clearance (14 masters remain
   missing); and
7. independent security, economic, privacy, dependency, and legal review of
   final bytes and evidence.

## Files and validation

- `iat-b3-v2-parity-claims-readiness.v1.json` is the held production packet.
- `scripts/validate-iat-b3-v2-parity-claims-readiness.mjs` validates the packet,
  source ancestry, exact feature inventory, clean evidence paths, and release
  dependency boundary.
- `tests/iat-b3-v2-parity-claims-readiness.test.mjs` exercises omission,
  reordering, cut injection, evidence substitution, false completion, claim
  promotion, input replacement, throwing accessors, noncanonical object/array
  shapes, cycles, aliases, non-JSON numbers, duplicate JSON members, and
  fail-closed CLI behavior.

Run from the repository root:

```text
node projects/star-ascent/site/scripts/validate-iat-b3-v2-parity-claims-readiness.mjs
node --test projects/star-ascent/site/tests/iat-b3-v2-parity-claims-readiness.test.mjs
```

The default validator exits zero for a valid, honestly held inventory.
`--require-parity-complete` and `--require-release-claims-complete` both exit 2
until their respective production packets actually complete.

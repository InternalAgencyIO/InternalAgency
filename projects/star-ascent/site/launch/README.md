# Genesis Manifest Workflow

> **MAINNET HOLD — TOKENOMICS V2 SUPERSEDES THE FOUR-TRANSACTION CEREMONY**
>
> The public policy at `/tokenomics` and
> `archive/public-disclosures/source/iat-tokenomics-v2-{en,tr}.txt` introduces
> vested reward lanes, full-obligation collateralization, fixed annual reward
> rates, and a weekly CCC reassignment. The existing allocation-lock plan,
> four-transaction rehearsal, generated mint configuration, and ceremony
> validators do not implement those mechanics. The `/mint` controls are
> deliberately disabled. These V1 artifacts remain regression-only historical
> scaffolding and must not be used for devnet execution or mainnet approval.
> The canonical implementation is now `programs/iat_v2`, with
> `engagement/iat-economic-policy.v2.json`,
> `launch/iat-v2-allocation-plan.template.json`, and
> `launch/iat-v2-devnet-rehearsal.template.json`.

## One-command preflight

Before the launch room opens, run the complete local consistency pass:

```bash
node scripts/run-launch-preflight.mjs
```

It first reports the machine-readable ceremony-entry assessment, then validates
the V2 policy, public Devnet evidence, separate local-only time-gate proof,
mainnet readiness ledger, and sign-off records before running the isolated
negative-case regressions for the manifest, Model T rehearsal, signer
checklist, mainnet handoff, release packet, and release snapshot gates. It then
runs the live schedule, supply, manifest, rehearsal, signing, handoff,
publication, evidence-chain, transaction-order, release-packet, and
release-snapshot checks in one sequence. A regression failure or any
live-artifact failure is a HOLD condition; resolve it and rerun the complete
command rather than treating a later passing check as clearance.

The default command is a preparation audit and may pass while reporting
ceremony blockers. During the final attended review only, require the separate
entry assertion:

```bash
node scripts/run-launch-preflight.mjs --require-ceremony-ready
```

That mode fails before the full preflight unless a fresh read-only balance, the
exact 8.5 SOL floor, one replacement UTC window,
post-funding/post-scheduling artifact regeneration, an assigned independent
verifier, and the reviewed Model T device path are all recorded. The artifact,
verifier, and device-path summaries are accepted only when the canonical
`READY` V2 ceremony review and `ARMED` V2 stage journal pass their validators in
that same assessment; flipping readiness-ledger booleans cannot clear them. See
[`IAT_V2_CEREMONY_ENTRY_GATE.md`](IAT_V2_CEREMONY_ENTRY_GATE.md).

`iat-v2-ceremony-review.template.json` is the V2-only attended-review record.
It binds the readiness ledger, V2 stage journal, economic policy, V2 allocation
plan, remediation audit, and local time-gate proof by SHA-256. While `HOLD`, it
must contain no identities, digests, completed reviews, or readiness timestamp.
`READY` requires a fresh attended review, the sole Model T signer address, a
distinct evidence-only verifier with no signing authority, current SBF and
signed-Devnet evidence review, an `ARMED` V2 stage journal, and separate
broadcast approval. It never stores a derivation path, PIN, seed, or key.

`genesis-manifest.template.json` is a HOLD-state source of truth. Copy it to a non-template manifest only after the signer and verifier agree on every final value. Its primary validator also requires the fixed five-step Genesis order and all five evidence records to remain `null` while the manifest is `HOLD`, so stale transaction URLs cannot make a HOLD record look partly released.

Validate before public release:

```bash
node scripts/validate-genesis-manifest.mjs launch/genesis-manifest.template.json
```

The validator checks intended network, program, decimals, supply target, and the declared exact base-unit supply/allocation amounts using integer arithmetic. It also checks whether a PUBLISHED manifest has all mandatory evidence fields. Published evidence must be non-placeholder HTTPS URLs, while mint and allocation destinations must use Solana base58 address form. Each allocation must have its own destination and public evidence URL, preventing a single wallet or record from silently satisfying multiple allocation buckets. It does not sign a transaction, inspect a wallet, or replace independent Explorer verification.

## Superseded V1 rehearsal record

`devnet-rehearsal.template.json` and its validator are retained only to test
that the former V1 fail-closed evidence system does not accept malformed or
secret-bearing records. A completed V1 record cannot authorize V2.

The active rehearsal runbook and evidence schema are:

```bash
cat launch/DEVNET_REHEARSAL_SCENARIO.md
node scripts/validate-iat-v2-policy.mjs
```

Complete `launch/iat-v2-devnet-rehearsal.template.json` only after a bound,
verifiable SBF build, unfunded deployment, hardware-control transfer, V2
initialization, scaled funding, authority revocation, activation, full positive
and adversarial scenario matrix, and independent verification.

The mainnet handoff uses the same non-secret boundary: its validator rejects credential-bearing fields anywhere in the record, including nested or unused `walletSeedPhrase`, `privateKey`, recovery-material, PIN, and derivation/account-path aliases. An `APPROVED` handoff also reruns the canonical devnet rehearsal validator against its fixed source path; `COMPLETED` status alone cannot bypass missing, stale, malformed, or inconsistent rehearsal proof. Remove a secret-bearing field entirely; never replace a real secret with a redacted value in a launch artifact.

## Verified publication payload

`PUBLICATION_PAYLOAD.template.md` is intentionally HOLD-state copy. Before the verified version is sent to the website, pinned announcement, or broadcast screen, validate that it contains every required field and no unresolved value:

```bash
node scripts/validate-publication-payload.mjs launch/PUBLICATION_PAYLOAD.template.md
```

For non-HOLD payloads it also requires a full Solana-form mint, the exact fixed-supply text, and non-placeholder HTTPS Explorer/allocation evidence. It checks only supplied text: it does not inspect Solana, authenticate a wallet, or turn a launch into an approved state.

## Release evidence chain

Before promoting a matched manifest and publication payload, check that their HOLD/PUBLISHED state agrees and that the published mint, authority-evidence, and canonical allocation/lock route values are identical in both artifacts:

```bash
node scripts/validate-release-evidence-chain.mjs launch/genesis-manifest.template.json launch/PUBLICATION_PAYLOAD.template.md
```

This local consistency check never contacts Solana or authorizes publication; independently verify every final on-chain value before release.

## Transaction-order evidence

The manifest carries a fixed, non-signing sequence: create the mint, mint the declared allocation destinations, revoke mint authority, revoke freeze authority, then publish evidence. Validate the order and its HOLD/PUBLISHED evidence boundary with:

```bash
node scripts/validate-genesis-transaction-order.mjs launch/genesis-manifest.template.json
```

For a PUBLISHED manifest, every sequence step requires its own non-placeholder public HTTPS evidence URL. The mint- and freeze-authority sequence records must exactly repeat the canonical authority-proof URLs in token metadata, so an alternate record cannot silently clear either revocation gate. This validator checks supplied records only; it never creates a transaction or establishes that an Explorer record is genuine.

## Public document assets

Before a document-index or Dossier deployment, confirm the paired English/Turkish source artifacts and local validator files are present:

```bash
node scripts/verify-public-disclosure-assets.mjs
```

This is a local existence check only. It does not verify production URLs, document accuracy, launch readiness, or accountable Turkish-language review. A Turkish filename or paired artifact must not be treated as permission to activate Turkish runtime copy.

## Public route integrity

Use the production route check before announcing a public route:

```bash
npm run check:public
```

It requires the canonical English launch surface, every locale-intent route, both public hosts, and every canonical Dossier document target to return the exact expected HTTPS URL without an unintended redirect. Language metadata, alternates, social metadata, runtime payload use, and indexing must follow `reviewed-localization-policy.json`. While Turkish is `HOLD`, both `/tr/...` and `ileriakil.com` must serve canonical English (`lang` and `Content-Language` `en`), carry meta/header `noindex`, omit Turkish hreflang/sitemap discovery, and request no Turkish runtime payload. It separately verifies that each documented legacy URL returns a same-origin HTTPS 308 to its reviewed Dossier target. Familiar content at a different URL or a Turkish-looking route with unreviewed Turkish copy is a failure.

## Launch schedule

Confirm that every active operator surface and paired source artifact uses the
exact scheduled open-source ceremony window:

```bash
node scripts/verify-launch-schedule.mjs
```

The schedule comparison is not localization review. Turkish remains on
localization `HOLD` and the active web UI remains English fallback until
accountable, source-bound review evidence is accepted. The scheduled time opens
the broadcast window only. It never signs, submits, or authorizes a transaction.
Mainnet remains on evidence HOLD until the exact devnet rehearsal and independent
evidence chain pass.

## Fixed-supply arithmetic

Before freezing final recipient amounts, derive the exact integer base-unit amounts rather than using a spreadsheet float:

```bash
node scripts/validate-iat-supply-math.mjs
```

For the 1,000,000,000 IAT target at 9 decimals, the validator confirms that the 50/20/15/10/5 allocation model totals exactly to the fixed supply.

Never place signing secrets, recovery material, device PINs, or private keys in a manifest.

## Signer and address gate

`genesis-signing-checklist.template.json` is a HOLD-safe, non-secret ceremony roster. It separates the signing roles, independent verifier, and publication operator so an address or responsibility mismatch can stop the release before a transaction is approved.

Validate it before changing its state to `READY`:

```bash
node scripts/validate-genesis-signing-checklist.mjs launch/genesis-signing-checklist.template.json
```

`READY` requires the mint-authority and fee-payer roles to share the one reviewed physical-signing address used by the Model T ceremony, while the independent verifier and publication operator must each use a different full Solana public address. It also requires physical device-path review for both signing responsibilities, independent manifest/destination review, a distinct reviewed recipient address for each allocation (with its exact intended base-unit amount), publication-operator review of the HOLD controls, an explicit HOLD owner confirmation, and a UTC readiness timestamp. The checklist rejects credential-bearing field names and credential-like values (including secret phrases and 12–24 word mnemonic-shaped text) anywhere in the record; remove such material entirely rather than redacting it. This keeps the broadcaster from treating a ceremony-ready record as permission to publish before independently checked evidence exists. It validates supplied checklist data only: it never creates keys, requests secrets, signs, or sends a transaction.

## Mainnet approval handoff

`mainnet-handoff.template.json` records the final non-signing approval boundary between a completed devnet rehearsal and the mainnet ceremony. It keeps the canonical manifest in `HOLD` until independent public evidence exists and explicitly assigns a correction owner. For an `APPROVED` handoff, `manifestDigest` must repeat the verified canonical manifest SHA-256, while `destinationDigest` must be the SHA-256 of the compact JSON object `{ "handoffVersion": 1, "network": "mainnet-beta", "artifactDigests": { ... } }`, using the three displayed artifact digest fields in order and lowercase values. This makes approval invalid if the handoff's network or any source artifact drifts.

Validate it before changing its state to `APPROVED`:

```bash
node scripts/validate-mainnet-handoff.mjs launch/mainnet-handoff.template.json
npm run check:mainnet-handoff
```

`APPROVED` requires a completed devnet rehearsal, a ready signer checklist, two immutable 64-character review digests, and SHA-256 values that exactly bind the approval to the current manifest, signer checklist, and rehearsal files. It also requires the generated HOLD release snapshot's pre-approval digest to match those same three files, so a stale ceremony snapshot cannot clear the handoff. It requires three distinct release, verifier, and correction-owner labels, a UTC approval time, and all four HOLD controls. The handoff rejects credential-bearing field names and credential-like values (including secret phrases and 12–24 word mnemonic-shaped text) anywhere in the record; remove them entirely rather than redacting them. The validator never approves a transaction, reads a wallet, creates keys, or contacts Solana.

`npm run check:mainnet-handoff` runs isolated HOLD fixtures for the non-authorizing authority control, canonical source paths, credential-shaped values, and closed reviewed schema. It changes only a temporary copy of the launch artifacts.

When a signer checklist moves to `READY`, its `ceremonyControls.manifestSha256` must be the SHA-256 of the exact canonical manifest reviewed for signer and recipient addresses. The checklist also requires a canonical `Z`-form UTC readiness timestamp. Any manifest edit after the address review therefore blocks the handoff until the checklist is re-reviewed and rebound; this is a local evidence control, not signing authority.

## Release coordination packet

`release-packet.template.json` is the final HOLD-safe coordination record. It binds the canonical manifest, publication payload, signer checklist, devnet rehearsal, and mainnet handoff so the team can stop when any prerequisite has drifted.

At both `HOLD` and `READY`, the packet validator reruns the canonical manifest, publication-payload, signer-checklist, and devnet-rehearsal validators. The standalone mainnet-handoff validator likewise reruns the canonical manifest, signer-checklist, and devnet-rehearsal validators at both `HOLD` and `APPROVED`. A structurally invalid dependency is therefore a stop condition before release-state review begins.

Validate it before changing its state to `READY`:

```bash
node scripts/validate-release-packet.mjs launch/release-packet.template.json
```

`READY` requires a completed rehearsal, ready signer checklist, approved handoff, and both public-facing artifacts still in `HOLD` until independent evidence exists. It reruns the canonical mainnet-handoff validator, then independently rechecks that the handoff points to the same manifest, signing checklist, and rehearsal as the packet, and that every handoff digest (including its deterministic destination digest) still matches those files. It also requires same-version review, three distinct release/verifier/correction owners, and exact continuity of those three labels from the approved handoff into the release packet, so accountability cannot change between approval and coordination. Fresh canonical UTC timestamps—the public-evidence check, approved handoff, and packet approval—must each be within 30 minutes (with no more than one minute of future skew) and occur in that order. SHA-256 digests must match each canonical source artifact. Its `packetDigest` must be the SHA-256 of the compact JSON object `{ "packetVersion": 1, "artifactDigests": { ... } }`, with the five artifact digest fields in the template's displayed order and lowercase values; this stops a READY approval from being reused after a packet artifact changes. This local consistency check never authorizes a transaction or publication.

Immediately after the canonical packet reaches `READY`, and before changing the manifest to `PUBLISHED` or the publication payload to `VERIFIED`, seal that validated packet:

```bash
node scripts/create-pre-publication-packet-proof.mjs
node scripts/validate-pre-publication-packet-proof.mjs launch/pre-publication-packet-proof.generated.json
```

The generated proof is an atomic, closed-schema historical receipt. It binds the exact canonical release-packet and HOLD release-snapshot bytes, the packet's ordered artifact digests, deterministic approval digest, and approval time. The generator refuses a non-READY or invalid packet and leaves any prior proof untouched. The proof remains durable after publication; its validator compares the sealed raw-byte digests rather than rerunning time-sensitive READY or snapshot-freshness gates against sources that have legitimately advanced.

For a `PUBLISHED` Genesis manifest, the final `PUBLISH_EVIDENCE` record must exactly equal the canonical English Proof Board route, `https://internalagency.io/proof`, and the `CREATE_MINT` record must be the canonical query-free `https://explorer.solana.com/address/<mint>` record for the full claimed mint address. This prevents a different public page, parameterized link, or unrelated host record from being substituted as ordered Genesis evidence.

## Post-Genesis evidence reconciliation

`post-genesis-reconciliation.template.json` is the HOLD-safe archive handoff after Genesis. It makes channel mismatches, stale evidence, unresolved corrections, reused public records, and unsupported distribution claims explicit stop conditions while preserving a public correction trail. A return to `HOLD` must clear all reconciliation timestamps, labels, public URLs, correction records, and channel records, so prior public evidence cannot be replayed as a current archive review. Its reviewed schema rejects extra archive, correction, or channel assertions and credential-bearing names or values. A `COMPLETE` record must name a usable 32-byte Solana mint and use distinct URLs for its evidence archive, public changelog, and every reconciled channel so one link cannot be presented as independent confirmation.

Validate it before changing its state to `COMPLETE`:

```bash
node scripts/validate-post-genesis-reconciliation.mjs launch/post-genesis-reconciliation.template.json
```

`COMPLETE` requires the manifest and publication payload to be published, the unchanged release packet and HOLD release snapshot to match their sealed pre-publication proof, separate archive/reviewer roles, a public evidence archive and changelog, plus at least two independently checked matching public channel records. The gate evaluates one captured dependency bundle and rejects any source, packet, proof, ceremony input, snapshot, or reconciliation edit that lands during validation. The payload's `Checked at (UTC)` minute must match the packet's reviewed public-evidence time, while the seal and every channel check must not postdate the reconciliation. It also requires an explicit correction state: `NONE` only when no correction records exist, or `RESOLVED` with a unique public notice, UTC report time, and UTC resolution time for every correction. The canonical publication payload and every channel record must repeat the canonical route, mint, mint-authority evidence, and freeze-authority evidence exactly as they appear in the canonical manifest; a `matched` label alone cannot clear the gate. Each channel check must fall within the declared 1 to 1,440 minute freshness window and cannot postdate the reconciliation. It validates supplied records only; it never contacts a chain, authorizes a distribution, or establishes on-chain truth.

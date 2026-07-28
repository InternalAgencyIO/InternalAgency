# Genesis Manifest Workflow

## One-command preflight

Before the launch room opens, run the complete local consistency pass:

```bash
node scripts/run-launch-preflight.mjs
```

It runs the schedule, supply, manifest, rehearsal, signing, handoff,
publication, evidence-chain, transaction-order, release-packet, and release
snapshot checks in one sequence.

`genesis-manifest.template.json` is a HOLD-state source of truth. Copy it to a non-template manifest only after the signer and verifier agree on every final value. Its primary validator also requires the fixed five-step Genesis order and all five evidence records to remain `null` while the manifest is `HOLD`, so stale transaction URLs cannot make a HOLD record look partly released.

Validate before public release:

```bash
node scripts/validate-genesis-manifest.mjs launch/genesis-manifest.template.json
```

The validator checks intended network, program, decimals, supply target, and the declared exact base-unit supply/allocation amounts using integer arithmetic. It also checks whether a PUBLISHED manifest has all mandatory evidence fields. Published evidence must be non-placeholder HTTPS URLs, while mint and allocation destinations must use Solana base58 address form. Each allocation must have its own destination and public evidence URL, preventing a single wallet or record from silently satisfying multiple allocation buckets. It does not sign a transaction, inspect a wallet, or replace independent Explorer verification.

## Model T rehearsal

Use `devnet-rehearsal.template.json` as the non-secret record for the exact transaction path intended for Genesis. It must stay on devnet and must not contain a seed phrase, PIN, private key, passphrase, wallet export, or any other credential. The validator rejects credential-bearing fields anywhere in the record, including unused extra fields; remove the field rather than redacting a secret into the launch artifact.

Validate it before declaring the rehearsal complete:

```bash
node scripts/validate-devnet-rehearsal.mjs launch/devnet-rehearsal.template.json
```

Only a completed rehearsal on a Trezor Model T with an exact whole-token-to-base-unit test-supply record, full Solana-form test addresses, canonical Solana Explorer devnet evidence links (with no extra query or fragment), six different devnet transaction identities for mint creation, mint initialization, test-recipient creation, minting, and both authority revocations, a UTC completion time, clear physical device confirmations, and the same intended mainnet path clears the Model T signing gate. A different device cannot substitute for the reviewed Model T path.

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

Before a document-index or Dossier deployment, confirm the bilingual public assets and local validator files are present:

```bash
node scripts/verify-public-disclosure-assets.mjs
```

This is a local existence check only. It does not verify production URLs, document accuracy, or launch readiness.

## Launch schedule

Confirm that the English/Turkish application and public packs retain the fixed broadcast and Genesis times:

```bash
node scripts/verify-launch-schedule.mjs
```

The confirmed schedule is 28 July 2026: broadcast at 13:30 UTC and Genesis at 14:00 UTC.

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

`READY` requires distinct full Solana public addresses, physical device-path review for each signer, independent manifest/destination review, a distinct reviewed recipient address for each allocation (with its exact intended base-unit amount), publication-operator review of the HOLD controls, an explicit HOLD owner confirmation, and a UTC readiness timestamp. This keeps the broadcaster from treating a ceremony-ready record as permission to publish before independently checked evidence exists. It validates supplied checklist data only: it never creates keys, requests secrets, signs, or sends a transaction.

## Mainnet approval handoff

`mainnet-handoff.template.json` records the final non-signing approval boundary between a completed devnet rehearsal and the mainnet ceremony. It keeps the canonical manifest in `HOLD` until independent public evidence exists and explicitly assigns a correction owner. For an `APPROVED` handoff, `manifestDigest` must repeat the verified canonical manifest SHA-256, while `destinationDigest` must be the SHA-256 of the compact JSON object `{ "handoffVersion": 1, "network": "mainnet-beta", "artifactDigests": { ... } }`, using the three displayed artifact digest fields in order and lowercase values. This makes approval invalid if the handoff's network or any source artifact drifts.

Validate it before changing its state to `APPROVED`:

```bash
node scripts/validate-mainnet-handoff.mjs launch/mainnet-handoff.template.json
```

`APPROVED` requires a completed devnet rehearsal, a ready signer checklist, two immutable 64-character review digests, and SHA-256 values that exactly bind the approval to the current manifest, signer checklist, and rehearsal files. It also requires the generated HOLD release snapshot's pre-approval digest to match those same three files, so a stale ceremony snapshot cannot clear the handoff. It requires three distinct release, verifier, and correction-owner labels, a UTC approval time, and all four HOLD controls. The validator never approves a transaction, reads a wallet, creates keys, or contacts Solana.

When a signer checklist moves to `READY`, its `ceremonyControls.manifestSha256` must be the SHA-256 of the exact canonical manifest reviewed for signer and recipient addresses. The checklist also requires a canonical `Z`-form UTC readiness timestamp. Any manifest edit after the address review therefore blocks the handoff until the checklist is re-reviewed and rebound; this is a local evidence control, not signing authority.

## Release coordination packet

`release-packet.template.json` is the final HOLD-safe coordination record. It binds the canonical manifest, publication payload, signer checklist, devnet rehearsal, and mainnet handoff so the team can stop when any prerequisite has drifted.

Validate it before changing its state to `READY`:

```bash
node scripts/validate-release-packet.mjs launch/release-packet.template.json
```

`READY` requires a completed rehearsal, ready signer checklist, approved handoff, and both public-facing artifacts still in `HOLD` until independent evidence exists. It independently rechecks that the handoff points to the same manifest, signing checklist, and rehearsal as the packet, and that every handoff digest (including its deterministic destination digest) still matches those files. It also requires same-version review, three distinct release/verifier/correction owners, and exact continuity of those three labels from the approved handoff into the release packet, so accountability cannot change between approval and coordination. Fresh canonical UTC timestamps—the public-evidence check, approved handoff, and packet approval—must each be within 30 minutes (with no more than one minute of future skew) and occur in that order. SHA-256 digests must match each canonical source artifact. Its `packetDigest` must be the SHA-256 of the compact JSON object `{ "packetVersion": 1, "artifactDigests": { ... } }`, with the five artifact digest fields in the template's displayed order and lowercase values; this stops a READY approval from being reused after a packet artifact changes. This local consistency check never authorizes a transaction or publication.

For a `PUBLISHED` Genesis manifest, the final `PUBLISH_EVIDENCE` record must exactly equal `claimOrDistribution.canonicalRoute`, and the `CREATE_MINT` record URL must visibly contain the full claimed mint address. This prevents a different public page or unrelated mint transaction from being substituted as ordered Genesis evidence.

## Post-Genesis evidence reconciliation

`post-genesis-reconciliation.template.json` is the HOLD-safe archive handoff after Genesis. It makes channel mismatches, stale evidence, unresolved corrections, reused public records, and unsupported distribution claims explicit stop conditions while preserving a public correction trail. A `COMPLETE` record must use distinct URLs for its evidence archive, public changelog, and every reconciled channel so one link cannot be presented as independent confirmation.

Validate it before changing its state to `COMPLETE`:

```bash
node scripts/validate-post-genesis-reconciliation.mjs launch/post-genesis-reconciliation.template.json
```

`COMPLETE` requires the manifest and publication payload to be published, the release packet to be ready, separate archive/reviewer roles, a public evidence archive and changelog, plus at least two independently checked matching public channel records. It also requires an explicit correction state: `NONE` only when no correction records exist, or `RESOLVED` with a unique public notice, UTC report time, and UTC resolution time for every correction. The canonical publication payload and every channel record must repeat the canonical route, mint, mint-authority evidence, and freeze-authority evidence exactly as they appear in the canonical manifest; a `matched` label alone cannot clear the gate. Each channel check must fall within the declared 1 to 1,440 minute freshness window and cannot postdate the reconciliation. It validates supplied records only; it never contacts a chain, authorizes a distribution, or establishes on-chain truth.

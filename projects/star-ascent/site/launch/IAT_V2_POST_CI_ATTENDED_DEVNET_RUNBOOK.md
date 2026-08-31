# IAT V2 post-CI attended Devnet runbook

Status: source-only operator procedure. Mainnet remains **HOLD**. Do not begin until both independent bindings below pass and the binding anchor plus runtime and artifact-input worktrees are clean.

1. The immutable migration artifact/evidence binding remains exactly the reviewed 649,680-byte artifact `771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`, source `a03fe71dd66cd1650b8d0353e486786df30b83e9`, source tree `ffe82fcf8fd3d851c09a937ebec945121137e546`, public CI run `33161771816` attempt 1, and evidence-manifest SHA-256 `ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9`. These existing migration constants prove the retained binary/evidence tuple and remain tied to that source; never update or rebind the immutable migration artifact/evidence constants to the recovery source.
2. The recovery-runtime binding is separate. Implementation commit `S` contains the exact recovery closure and an unbound anchor. Fresh exact-head public PR CI must run for `S`. Direct one-parent successor commit `B` may change only `scripts/data/iat-v2-devnet-buffer-runtime-binding.json`; it binds `S` and its tree, the exact runtime-closure digest, PR-merge checkout commit/tree/relation, CI run/attempt/workflow, runtime evidence-manifest SHA-256, and the same retained artifact tuple. Verification requires the checked-out HEAD to be exactly `B`, the `S` → `B` committed diff to contain only that data anchor, and the anchor plus entire runtime closure to be clean. This source/public-CI lane does not replace the immutable migration artifact/evidence lane and is not evidence of upload, signing, broadcast, authority handoff, deployment, or Mainnet authorization.

After fresh exact-head CI succeeds, stop before starting or restarting the console. Review the downloaded recovery-runtime evidence manifest, leave the immutable migration constants unchanged, populate only the canonical runtime anchor in direct successor `B`, create and verify the binding commit, and rerun the combined read-only recovery preflight from clean runtime and artifact-input states. Do not open or reopen any attended page until that binding commit and clean verification both pass.

## Fixed surfaces

Use PowerShell for the attended Node commands. Before any attended command, set both variables to operator-reviewed absolute files; do not copy the placeholders literally:

```powershell
$NodeExe = 'C:\ABSOLUTE\PATH\TO\REVIEWED\node.exe'
$NpmCli = 'C:\ABSOLUTE\PATH\TO\REVIEWED\npm-cli.js'
(Get-Item -LiteralPath $NodeExe).FullName
(Get-Item -LiteralPath $NpmCli).FullName
& $NodeExe --version
```

The reviewed runtime must be Node.js `>=22.13.0`. An older, malformed, unavailable, or changed path/version is a stop. Do not invoke `npm.cmd`: on Windows it can silently select the adjacent Node executable instead of `$NodeExe`. Prepend the reviewed Node directory for npm lifecycle subprocesses, then start the console from `projects/star-ascent/site` through the reviewed Node and npm CLI:

```powershell
$env:Path = "$(Split-Path -Parent $NodeExe);$env:Path"
& $NodeExe $NpmCli run iat:v2-admin
```

The `preiat:v2-admin` lifecycle gate repeats the version check before Vite or any console dependency can load. The recovery runtime closure binds the committed `package.json` and `package-lock.json` source bytes. This is a declared-dependency source binding only: it does not bind installed `node_modules` bytes, prove byte-for-byte local dependency integrity, or support a claim of installed dependency provenance. A stronger installed-dependency claim would require a separately reviewed byte-level installation manifest; this ceremony makes no such claim.

Use only these localhost URLs:

1. Program capacity and upgrade: `http://127.0.0.1:4175/?mode=upgrade`
2. Program capacity and upgrade with a verified buffer: `http://127.0.0.1:4175/?mode=upgrade&buffer=<BUFFER_ADDRESS>`
3. Legacy migration and historical neutral backfill: `http://127.0.0.1:4175/?mode=migrate-rounds`
4. Feature rehearsal and aggregate export: `http://127.0.0.1:4175/?mode=features`

Only the three canonical signing modes—`upgrade`, `migrate-rounds`, and `features`—may request transaction signatures. The default/no-mode and `settle-week9` pages are archived non-signing surfaces; legacy seven-stage signing is permanently disabled.

Use the same non-private browser profile, the same `127.0.0.1:4175` origin, and the same local-storage state for the entire attended sequence. Do not clear site data, switch browser profiles, change the host or port, or discard a source-bound receipt set between program, migration, feature, and aggregate export steps.

Never use a public host for these consoles. The reviewed Devnet program is `62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj`; the attended Model T administrator is `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`.

Every newly loaded or reloaded attended page must first use its memory-only on-device address-display gate and match the complete displayed address to `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`. This is a non-transaction device confirmation and is not one of the 17 Model T transaction-signature prompts. Navigation or reload may require another address-display confirmation, but it must never add or replay a transaction signature. If any action UI appears before the full on-device address match succeeds, stop without signing or broadcasting.

The transaction-prompt latch is permanent for its exact source/artifact/mint/action binding: a rejected, failed, expired, or explicitly discarded signed action ends that ceremony. Do not retry that action, clear browser storage, change origin/profile, or attempt another transaction signature. Preserve the consumed old latch and stop on HOLD. Only a separately reviewed ceremony with fresh exact-head CI and a genuinely new source binding may expose another action; its distinct source-bound namespaces do not delete, reset, or continue the old ceremony.

The program-capacity/upgrade surface alone adds an exact source/artifact/mint/action-bound signed-pending record. The verified signed wire is persisted while the prompt latch is still entered and before the broadcast control is shown, but it is never auto-broadcast. Before a broadcast attempt exists, a reload may restore only a record that matches the retained entered/verified prompt latch and must still perform complete finalized-state, message, signature, and blockhash revalidation before the separate broadcast boundary. Immediately before reserving the sole send, blockhash validity must be true at both finalized and processed commitment against the fresh finalized minimum context slot. A consumed latch with missing, malformed, mismatched, or stale pending state remains HOLD and must never trigger another prompt.

After all pre-send checks pass, the program broadcast boundary derives the exact Solana signature locally from the verified signed wire and atomically persists a permanent source/artifact/mint/action-bound broadcast-attempt reservation before the sole send. Only creation of that new reservation may reach the send method, and this program-only connection disables the client library's implicit HTTP-429 request retry as well as validator forwarding retries. Once the reservation exists—whether the RPC returns, throws, times out, or the page reloads—the action is permanently reconcile-only and no send method may ever be reached for it again. Poll only the retained local signature at finalized commitment; retrieve and compare the exact finalized wire, message, and signature; verify the exact action-specific finalized post-state; and only then persist the receipt and remove the signed-pending record under the same exclusive lock. Every retained program receipt must have its exact permanent attempt; attempt-without-signed-wire-and-receipt or receipt-without-attempt is HOLD. Never delete or reset the permanent attempt. A null, timeout, ambiguous result, or incomplete evidence remains HOLD and poll-only; never resend.

Signed-pending state on migration and feature surfaces remains memory-only. Those surfaces do not gain durable reload or reconcile-only recovery from the program amendment: never reload or navigate away while one of their signed transactions is pending. Loss or ambiguity is HOLD and must never cause another prompt or resend.

The feature-mode shell must require the exact migration artifact before it exposes feature actions. The archived seven-stage initialization shell remains pinned to its exact pre-upgrade artifact and may only inspect chain state or export already-existing historical receipts; it cannot select, sign, or broadcast an initialization action. Mode switching must never turn “either reviewed artifact” into an acceptable deployment check.

## 1. Bind and inspect the independent CI surfaces

Run the read-only artifact check:

```powershell
& $NodeExe scripts/iat-v2-devnet-buffer-preflight.mjs verify --artifact target/verifiable/iat_v2.so --evidence target/verifiable/iat-v2-build-evidence.json
```

This first command verifies only the immutable migration artifact/evidence lane. It must continue to report source `a03fe71dd66cd1650b8d0353e486786df30b83e9`; a report that substitutes the recovery source is a stop. After `S` public CI and the data-only `B` binding commit are complete, run the combined read-only check:

```powershell
& $NodeExe scripts/iat-v2-devnet-buffer-preflight.mjs verify-recovery --artifact target/verifiable/iat_v2.so --evidence target/verifiable/iat-v2-build-evidence.json --runtime-evidence target/verifiable/iat-v2-recovery-runtime-build-evidence.json
```

The combined result must independently pass the retained migration artifact/evidence tuple and the recovery-runtime `S`/`B` source, closure, public-CI, and manifest binding. Matching artifact hash and byte count across the lanes does not merge their source provenance.

Copy the returned exact artifact byte count into this read-only capacity check:

```powershell
& $NodeExe scripts/iat-v2-devnet-buffer-preflight.mjs capacity --artifact-bytes <CI_ARTIFACT_BYTES>
```

Compare the command result with the upgrade console. Both must show the same current ProgramData capacity, added bytes, extension-required decision, and rent figures. The console derives and displays the exact ProgramData rent top-up. Any disagreement is a stop.

If no extension is required, continue to buffer upload. If extension is required:

1. In `?mode=upgrade`, press **SIMULATE + SIGN SEPARATE CAPACITY EXTENSION**.
2. Review the exact added bytes and rent top-up on the Model T and approve physically.
3. Confirm the console shows **SIGNED // NOT BROADCAST**, the reviewed message SHA-256, and the exact last-valid block height.
   The amended console must also report that the exact signed-pending record is durably recoverable; do not reload unless recovery is necessary. Complete the separate attended broadcast approval without delay. If the signature expires, stop: that source-bound ceremony is terminal and a new source-bound ceremony with fresh exact-head CI is required.
4. After separately confirming that you are ready to submit the reviewed signed wire, press **BROADCAST SIGNED CAPACITY EXTENSION** once. The console must persist the exact locally derived signature in a permanent broadcast-attempt reservation before its sole send.
5. After that reservation exists, use only **POLL FINALIZED SIGNATURE + COMPLETE EVIDENCE (NO SEND)**. Wait for **FINALIZED**, export the source-bound program receipt set, then refresh the read-only capacity command. A null, timeout, RPC error, reload, or ambiguous result never authorizes another send.

The capacity transaction must never auto-start buffer upload or program upgrade.

## 2. Upload and hand off one fresh buffer

The buffer operations use the reviewed Devnet deployer keypair, not the Model T. They are staging operations outside the attended action roster and therefore do not produce canonical aggregate transaction records. Each helper first verifies the CI binding and requires its own exact typed confirmation; stop before typing if any displayed address, hash, byte count, payer, or network differs.

The buffer boundary is pinned to the installed `Ubuntu-24.04` WSL2 distribution, POSIX user `a` (UID 1000), and the one exact checkout below. Git Bash, another WSL distribution or user, a Windows executable substituted into WSL, an inherited shell profile, or a different checkout is a stop.

Exact helper checkout:

`/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site`

The helper scripts independently verify every pinned executable before sensitive access and again at mutation boundaries:

| Tool | Exact path | Exact version | SHA-256 | Bytes |
| --- | --- | --- | --- | ---: |
| Node.js | `/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node` | `v24.19.0` | `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12` | 125,989,464 |
| Git | `/usr/bin/git` | `git version 2.43.0` | `2a8c18fbf43da9f692d75474c72bea9dfd796c260b0f3dfe456376abc3bbd668` | 4,066,232 |
| Solana CLI | `/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana` | `solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)` | `aacc6871e8ff199608987f0364f2ed9e239a32e1e0548f1ae4477e0e533e1dea` | 28,546,968 |
| Solana keygen | `/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana-keygen` | `solana-keygen 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)` | `bf66aa11a13dd15503f40ab2b1160f06c7505bca692dfb20800682615d4ec952` | 2,828,816 |

The only admitted network is Devnet with exact genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. Any path, version, digest, byte count, ownership, permission, checkout, distribution, UID, or genesis drift is a HOLD before mutation.

The authority handoff has one permanent CAS namespace:

- Root: `/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1`, exact mode `0700`, owned by UID 1000.
- Sentinel: `/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1/.iat-v2-devnet-buffer-authority-cas-root.json`, exact mode `0600`, owned by UID 1000.
- Schema: `iat-v2-devnet-buffer-authority-cas-root/v1`; network: `devnet`; ceremony ID: `9e691e59-35c8-4861-86a0-7a219885b1c0`.
- Exact sentinel SHA-256: `11893575f111807621fcbc8c77ea73fae03390404507202146dde9e69d5818da`.

That namespace is initialized exactly once. If and only if the root has never existed, the separately reviewed one-time provisioning action is the same command below with the final word changed from `verify` to `initialize`. For the present ceremony run `verify` only:

```powershell
wsl.exe -d Ubuntu-24.04 -u a --exec /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-v1 /home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node /mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site/scripts/initialize-iat-v2-devnet-buffer-handoff-cas.mjs verify
```

The result must be `status: "VERIFIED"` with the exact root, sentinel, ceremony ID, and `network: "devnet"`. Never delete, rename, recreate, edit, reset, relocate, or reuse this root, sentinel, `attempts` directory, or any reservation—even after HOLD or an uncertain command result. A reservation is target-bound and permanently prevents a restarted or concurrent helper from repeating an ambiguous authority mutation.

Run the fresh-buffer helper from an attached PowerShell console using this literal clean-environment WSL2 launcher and exact helper path. Do not pipe or redirect stdin: both attended confirmations are read directly from readable/writable `/dev/tty`.

```powershell
wsl.exe -d Ubuntu-24.04 -u a --exec /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-v1 /usr/bin/bash --noprofile --norc /mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site/scripts/rebuild-iat-v2-devnet-buffer-fresh.sh
```

The rebuild has exactly two attended `/dev/tty` gates. First, after reviewing Devnet, artifact/evidence/source bindings, exact rent, the fixed 100,000,000-lamport upload-fee-headroom policy, balance, all exact tool identities, and the retained-old-buffer policy, type `REBUILD-DEVNET-FRESH`. The helper then atomically creates the fixed persistent `devnet-buffer-rebuild-v1/attempt-one-use` reservation; any existing reservation makes the original fresh entrypoint fail closed before tooling, network access, payer-key access, or a terminal prompt. It snapshots the exact reviewed artifact into that private namespace, binds the snapshot to an `O_NOFOLLOW` descriptor, durably records source/tool/target policy, and never uploads the mutable checkout pathname. After the helper creates and displays one fresh target address, review it and type the target-bound `UPLOAD-<FRESH_BUFFER_ADDRESS>` value exactly. Only the second gate admits the sole fresh-buffer write CLI invocation. That invocation uses `--max-sign-attempts 5`, which may re-sign or resend unconfirmed upload chunks across as many as five blockhash iterations; it is not a claim of one Solana transaction or one signature. The exact rent-plus-headroom floor is freshly reobserved immediately before upload. Record the finalized `BUFFER` printed by the helper. If either gate fails or final reconciliation is ambiguous, stop; do not rerun, and preserve the protected one-use recovery directory for separately reviewed recovery or read-only diagnosis.

The 2026-08-28 descriptor incident consumed the current fresh entrypoint after it created the signer and artifact snapshot but before it derived a buffer address or invoked `program write-buffer`; the exact evidence boundary is recorded in `IAT_V2_DEVNET_BUFFER_FD_INCIDENT_20260828.md`. **Do not run the fresh command above again for the current reservation.** Only after the immutable migration artifact/evidence preflight and the separate recovery-runtime `S`/`B` preflight both pass from the clean binding successor, run this literal recovery entrypoint from an attached PowerShell console:

```powershell
wsl.exe -d Ubuntu-24.04 -u a --exec /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-v1 /usr/bin/bash --noprofile --norc /mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site/scripts/recover-iat-v2-devnet-buffer-pre-address.sh
```

The recovery entrypoint accepts no arguments and creates no key, reservation, or artifact snapshot. Never append `recover-pre-address` to the fresh-helper command manually; use only the no-argument wrapper above. It admits only the exact existing pre-address phase: the protected signer and reviewed artifact snapshot must be the only attempt entries, while the address record, reservation manifest, and finalized reconstruction must all be absent. It preserves any unexpected or later-phase state and stops. After reviewing the same exact Devnet/tool/source/artifact/funding boundary plus `RECOVERY MODE: SAME RESERVED SIGNER; PRE-ADDRESS FAILURE ONLY; NO NEW KEY OR RESERVATION`, type `RECOVER-DEVNET-BUFFER-PRE-ADDRESS` only when the attached helper asks on `/dev/tty`, never at a `PS>` prompt. That first phrase authorizes protected continuation and local public-address/manifest creation only; it does not authorize upload. The helper then binds the existing signer and artifact snapshot to their protected descriptors, derives and durably records the fresh public buffer address, and reaches the same separate target-bound `UPLOAD-<FRESH_BUFFER_ADDRESS>` gate. Only that second immediate confirmation admits the sole shared `program write-buffer` invocation; `--max-sign-attempts 5` may internally re-sign or resend unconfirmed chunks and is not a one-transaction claim. This helper never prompts the Model T and never performs authority handoff. Never print, copy, digest, delete, rename, reset, replace, or reconstruct the protected signer. If recovery stops after deriving the address, if the target-bound gate is declined, or if the sole write result is ambiguous, do not run either helper again; preserve the entire reservation for read-only reconciliation. Continue to the separate handoff only after the helper prints finalized upload success plus the exact `BUFFER`, hash, bytes, and payer authority. Until independently evidenced, the fresh buffer upload and address, finalized buffer hash and bytes, authority handoff, artifact deployment, migrations, feature actions, aggregate proof, release, and every Mainnet action remain HOLD.

### Current partial-buffer override — 54,720-byte successor only

`IAT_V2_DEVNET_BUFFER_PARTIAL_UPLOAD_INCIDENT_20260828.md`,
`IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_INCIDENT_20260831.md`, and
`IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_54720_INCIDENT_20260831.md`
supersede every earlier buffer entry instruction for this ceremony.
`rebuild-iat-v2-devnet-buffer-fresh.sh`,
`recover-iat-v2-devnet-buffer-pre-address.sh`, and
`scripts/recover-iat-v2-devnet-buffer-in-place.sh` are permanently consumed.
The later `scripts/continue-iat-v2-devnet-buffer-in-place-from-35520.sh` lane is
also permanently consumed after its sole write invocation ended with
`Max retries exceeded`. All four **must not run again**. In particular, preserve
`/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-recovery-v1/attempt-one-use`
and
`/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-continuation-from-35520-v1/attempt-one-use`
unchanged; do not copy, reset, remove, rename, or inspect either to authorize a
new attempt.

Latest signer-free finalized reconciliation observed existing buffer
`564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`, deployer authority
`DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4`, loader owner
`BPFLoaderUpgradeab1e11111111111111111111111`, `4,522,976,880` lamports,
exact 649,680-byte payload capacity, partial hash
`c8b842bae57c2f23da0de4219ab879147971a0dafeda8755f6a90e8ca5db0dd3`,
 exact artifact prefix `[0, 54720)`, and zero tail `[54720, 649680)` at both
 minimum and account context slot `490807312`. The reviewed baseline
evidence-body SHA-256 is
`bceff73e737dee68f812e7d73c3554d30e08b899ca723e08a798b2275609f429`.
This remains HOLD evidence, not a ready buffer or transaction/signature receipt.
Do not pass `564X…1GHH` to the handoff helper, open the upgrade signing surface
for it, or claim handoff/deployment readiness unless a later fresh finalized
reconciliation proves the full `771c…8a01` artifact.

#### Pinned Agave public-address semantics

The in-place design is source-audited against exact Agave commit `7bc9c805218ca06769956e2cb61601329f5a0f6c`. Its [`write-buffer` parser](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L800-L844) and [`pubkey_from_path`](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/clap-utils/src/keypair.rs#L834-L845) admit a literal public buffer address without loading its signer. [`process_write_buffer`](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L1626-L1698) then selects `(None, pubkey)` for that route; although shared setup constructs an ephemeral keypair object in memory, it is not selected or passed as the buffer signer. The route is valid only for an already-existing compatible Buffer account: the CLI [fetches and verifies its owner, state, authority, and size](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L1497-L1546), and without a buffer signer it [stops instead of creating a missing addressed account](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L2989-L3032).

For an existing buffer, exact [`do_process_write_buffer`](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L2620-L2718) emits no create instruction, compares each complete target chunk with the corresponding existing payload chunk, skips matching chunks, and queues every differing chunk in full. The buffer public key is an account address, while the fee payer and buffer authority sign the queued writes; there is no buffer-account signer on this path. These are pinned-source semantics only. They neither prove that this helper executed nor establish submitted/finalized chunk count, upload success, a transaction signature or receipt, a ready buffer, handoff, deployment, release, or any Mainnet authorization. All such claims remain **HOLD** until fresh signer-free finalized reconciliation proves the full 649,680-byte `771c…8a01` payload at `564X…1GHH`.

The source below is a distinct continuation lane, not a retry. It is non-runnable
unless its exact helper, signer-free reconciler, both incident records, runbook,
package inputs, and transitive runtime source are commit `S`; fresh exact-head
public PR CI succeeds for `S`; and checked-out HEAD is the direct data-only
runtime-binding successor `B`. The source commit must contain the canonical
`UNBOUND` runtime anchor. The direct successor may change only that anchor.
After downloading the matching recovery-runtime evidence artifact and completing
the binding, run only this literal command from an attached PowerShell console:

```powershell
wsl.exe -d Ubuntu-24.04 -u a --exec /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-in-place-continuation-from-54720-v1 /usr/bin/bash --noprofile --norc /mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site/scripts/continue-iat-v2-devnet-buffer-in-place-from-54720.sh
```

The helper re-verifies exact source/public-CI/runtime binding, canonical Devnet
genesis, immutable artifact/evidence, the finalized payer fee floor, and the full
target-and-prestate tuple before and after its one attended `/dev/tty` gate.
Review the literal address, current and target hashes, 54,720/649,680-byte split,
594,960-byte zero tail, exact baseline slots and evidence hash, the observed
differing region and Agave chunk-rewrite semantics, toolchain, and disclosure
that one Agave `program write-buffer` invocation with
explicit QUIC TPU submission, a 1,500-second process timeout, and
`--max-sign-attempts 20` may sign, re-sign, send, and resend multiple deployer-key
Devnet chunk transactions. A matching chunk is skipped; a differing chunk is queued in full,
so the byte comparison does not establish the number of write transactions. The
audited CLI path may construct an unused ephemeral object in memory, but this
lane never reads, copies, digests, or passes the protected buffer signer and
never creates a new buffer. It does not prompt the Model T.

Only when all displayed values still match, type this full phrase at the helper's attached prompt—not at `PS>`:

`AUTHORIZE-DEVNET-IN-PLACE-BUFFER-CONTINUATION-564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH-FROM-54720-OF-649680-CURRENT-c8b842bae57c2f23da0de4219ab879147971a0dafeda8755f6a90e8ca5db0dd3-TARGET-771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`

Immediately before the sole write boundary, the helper creates the separate
permanent CAS
`/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-continuation-from-54720-v1/attempt-one-use`,
preserves exact binding/baseline/live-prestate/artifact evidence, and records the
entered mutation boundary durably. Any timeout, crash, error, malformed record,
or unclear result at or after that boundary means **DO NOT RERUN OR RESEND**;
use signer-free finalized reconciliation only. A validated monotonic partial
poststate is recorded distinctly from a process failure but still permanently
consumes this continuation. Exact success requires the same address, loader
owner, deployer authority, 649,680 payload bytes, and full target SHA-256
`771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`
at finalized commitment. This lane never closes an account, hands off authority,
upgrades or deploys the program, publishes a release, uses a Trezor, or accesses
Mainnet. The only safe public claim before exact success is: “A finalized
partial Devnet buffer was observed; the first 54,720 artifact bytes match and
the integrity gate kept promotion on HOLD.”

The historical buffer `Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6` is retained. The rebuild helper never closes or mutates it, and it does not reclaim its lamports.

Set only the exact address established by the completed recovery reconciliation as the dynamic handoff input, then run the exact handoff helper. For the current recovery lane that address is `564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`. `BUFFER_ADDRESS` is admitted only on this handoff command and has no default:

```powershell
$BufferAddress = '564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH'
$HandoffLauncher = @'
set -euo pipefail
set +x
umask 077
handoff_path='/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site/scripts/handoff-iat-v2-devnet-buffer.sh'
expected_sha256='05ac385c9630231daf0cfb281f43ac475846a8b150a4404e26772192a1e2dada'
expected_bytes='61116'
[[ "$handoff_path" == /* && ! -L "$handoff_path" && -f "$handoff_path" ]] || { echo 'HOLD: handoff source path is not exact' >&2; exit 1; }
before_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$handoff_path")"
exec 15< "$handoff_path"
fd_identity="$(/usr/bin/stat -Lc '%d:%i' -- /proc/$$/fd/15)"
after_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$handoff_path")"
[[ -n "$before_identity" && "$before_identity" == "$fd_identity" && "$after_identity" == "$fd_identity" ]] || { echo 'HOLD: handoff source identity changed while opening' >&2; exit 1; }
observed_sha256="$(/usr/bin/sha256sum -- /proc/$$/fd/15)"; observed_sha256="${observed_sha256%% *}"
observed_bytes="$(/usr/bin/stat -Lc '%s' -- /proc/$$/fd/15)"
[[ "$observed_sha256" == "$expected_sha256" && "$observed_bytes" == "$expected_bytes" ]] || { echo 'HOLD: handoff source digest or byte length drifted' >&2; exit 1; }
handoff_source="$(/usr/bin/cat <&15; printf '\x1f')"
[[ "${handoff_source: -1}" == $'\x1f' ]] || { echo 'HOLD: handoff source capture was incomplete' >&2; exit 1; }
handoff_source="${handoff_source%$'\x1f'}"
captured_sha256="$(printf '%s' "$handoff_source" | /usr/bin/sha256sum)"; captured_sha256="${captured_sha256%% *}"
captured_bytes="$(printf '%s' "$handoff_source" | /usr/bin/wc -c)"
[[ "$captured_sha256" == "$expected_sha256" && "$captured_bytes" == "$expected_bytes" ]] || { echo 'HOLD: captured handoff source drifted' >&2; exit 1; }
exec 15<&-
export IAT_V2_HANDOFF_CAPTURED_SOURCE='iat-v2-devnet-buffer-handoff-captured-source/v1'
export IAT_V2_HANDOFF_SOURCE_PATH="$handoff_path"
export IAT_V2_HANDOFF_CAPTURED_SHA256="$captured_sha256"
export IAT_V2_HANDOFF_CAPTURED_BYTES="$captured_bytes"
exec /usr/bin/bash --noprofile --norc -c "$handoff_source" "$handoff_path"
'@
wsl.exe -d Ubuntu-24.04 -u a --exec /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-v1 IAT_V2_HANDOFF_CAS_ROOT=/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1 "BUFFER_ADDRESS=$BufferAddress" /usr/bin/bash --noprofile --norc -c $HandoffLauncher iat-v2-captured-handoff-launcher
```

The captured-source launcher is mandatory: direct mutable-path execution is rejected. It opens the handoff once, verifies the displayed SHA-256 and byte count, captures the exact bytes with a sentinel, rehashes the capture, and only then asks a clean Bash to parse and run those captured bytes.

Review exact `BUFFER`, `FROM`, `TO`, artifact SHA-256 and bytes, Node/Git/Solana identity, Devnet genesis, and the 10,000,000-lamport single-handoff fee floor; then type the exact target-bound `TRANSFER-<BUFFER_ADDRESS>-<FIRST_12_ARTIFACT_SHA256_HEX>` challenge shown on `/dev/tty`. Buffer identity, authority, and bytes are observed only by the signer-free finalized-RPC reconciler (`getGenesisHash`, `getSlot`, and `getAccountInfo`); the handoff does not use CLI `program show` or `program dump`, cannot fall back to a default signer during observation, and is admitted only after the recovery-runtime binding verifies the helper, CAS modules, and reconciler at the exact public-CI source. Public buffer reads occur before the payer keypair is inspected. After confirmation, the helper verifies and exclusively locks the payer before address or balance use, freshly reobserves the finalized fee floor, exact buffer address, bytes, hash, and authority, then atomically creates the durable target-keyed reservation. The reservation result includes the canonical durable-record digest; the helper re-inspects the record through the pinned CAS directory, opens the exact record on FD11, checks the digest, and repeats the pinned runtime, payer address, finalized balance, buffer, and CAS checks immediately before the sole signer mutation. It submits that mutation once and follows it only with read-only finalized reconciliation. A pre-existing exact reservation skips keypair access and mutation and performs reconciliation only; a malformed or mismatched reservation is a HOLD. Any failure after reservation means **DO NOT RESUBMIT**, never remove the reservation, and stop for read-only reconciliation.

The source closure explicitly trusts, but does not individually SHA-256-bind, the root-owned Ubuntu 24.04 OS runtime (Bash and system utilities, loaders/shared libraries, and Python runtime modules) or the WSL kernel/procfs boundary. Filesystem locks serialize compliant launchers; they are not a protected external broker against a hostile same-UID process. Do not run this ceremony in a concurrently writable or compromised operator session. Even after helper success, do not request the upgrade signature until the upgrade console independently re-observes the same exact buffer at finalized commitment and shows authority `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`, the reviewed loader owner, 649,680 bytes, and `771c…8a01`.

## 3. Upgrade as one attended transaction

Open `http://127.0.0.1:4175/?mode=upgrade&buffer=<BUFFER_ADDRESS>` and verify the program, ProgramData linkage, current capacity, buffer owner, buffer authority, buffer hash, CI artifact hash, source commit, and zero loader padding.

1. Press **CONNECT 7XZ MODEL T DIRECTLY + SIMULATE + SIGN**.
2. Approve the exact upgrade on the Model T.
3. Review the signed-but-not-broadcast message SHA-256 and confirm the exact signed-pending record is durably recoverable.
4. Press the separate **BROADCAST SIGNED DEVNET UPGRADE** button once. The console must persist the exact locally derived signature in a permanent broadcast-attempt reservation before its sole send.
5. Once that reservation exists, continue only with **POLL FINALIZED SIGNATURE + COMPLETE EVIDENCE (NO SEND)**. Do not resend after any timeout, RPC error, reload, or ambiguous result. Export the source-bound receipt set containing `UPGRADE_PROGRAM` only after the retained signature, exact finalized transaction, and upgrade post-state all verify.

Do not auto-chain into migration.

## 4. Migrate weeks 7 and 8, one transaction each

Open `http://127.0.0.1:4175/?mode=migrate-rounds`. The console must show the exact CI artifact deployed and only settled 198-byte legacy rounds.

Migration signed-pending state is memory-only. Do not reload, navigate, close the page, or treat the program surface's durable recovery and reconcile-only controls as available here while a migration or backfill transaction is pending.

For week 7, then separately for week 8:

1. Press **SIMULATE + SIGN WEEK N**.
2. Approve that one week on the Model T.
3. Review the signed-but-not-broadcast message SHA-256.
4. Press the separate broadcast button.
5. Wait for finalized confirmation before refreshing or selecting the next week.

The receipt actions must be `MIGRATE_LEGACY_ROUND_WEEK_7` and `MIGRATE_LEGACY_ROUND_WEEK_8`.

## 5. Backfill weeks 9 and 10, one transaction each

Stay in `?mode=migrate-rounds`. Week 9 must prove exact terminal migrated week 8 as its previous-round snapshot. Week 10 must prove exact terminal backfilled week 9. The target PDA must be absent, the round strictly historical and timed out, and the config rehearsal-only.

For week 9, then separately for week 10:

1. Press **SIMULATE + SIGN NEUTRAL WEEK N**.
2. Approve that one terminal-neutral week on the Model T.
3. Review the signed-but-not-broadcast message SHA-256.
4. Press the separate broadcast button.
5. Wait for finalized confirmation and re-read the chained previous-round proof.

The receipt actions must be `BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9` and `BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10`. Export the source-bound receipt set after both finalize.

## 6. Finish the week-11 feature roster

Open `http://127.0.0.1:4175/?mode=features`. The selector must refresh its config and action accounts at finalized commitment, retain monotonic finalized context slots, and derive cadence only from finalized block time. After balance and linked-round reads, the greatest returned observation slot must still resolve to the same week and CCC round; a confirmed-only read, local workstation time, missing block time, regressing context, or boundary change during the observation is a stop. For every offered action, use the first button to build, simulate, and request the physical signature. Review the message hash, then use the separate broadcast button. Never approve the next action until the prior transaction is finalized and the console has refreshed chain state.

Feature signed-pending state is memory-only. Do not reload, navigate, close the page, or treat the program surface's durable recovery and reconcile-only controls as available here while a feature transaction is pending.

Immediately before transaction construction, the feature console must load a fresh finalized parent snapshot, use that snapshot's final slot as the minimum for every child config/state/balance/linked-round read, and then re-inspect the deployment at or after the child's greatest observation slot. The exact Program ID, ProgramData address, `771c…8a01` program hash, 649,680-byte artifact length, and `7XZj…fzPH` upgrade authority must all match. It repeats the finalized deployment-and-action check after simulation immediately before the Model T prompt.

The separate broadcast click must repeat the same parent → child → deployment observation chain from the signed pending record's final slot. The freshly selected action and exact parent/deployment bindings must match the signed record, the hardware-reviewed message hash and signatures must remain intact, and the signed blockhash must still be valid at or after the fresh final slot. Any pre-broadcast mismatch discards the pending signed transaction and broadcasts nothing. A failure after a send attempt remains an explicit HOLD because submission may be uncertain.

The remaining reviewed order is exact:

1. `SETTLE_STANDARD_POSITION_WEEK_10`
2. `SETTLE_STANDARD_POSITION_WEEK_11`
3. `SETTLE_LINKED_POSITION_2_WEEK_9`
4. `SETTLE_LINKED_POSITION_2_WEEK_10`
5. `SETTLE_LINKED_POSITION_3_WEEK_9`
6. `SETTLE_LINKED_POSITION_3_WEEK_10`
7. `CREATE_SWITCHBOARD_RANDOMNESS` using a freshly generated ephemeral protocol signer
8. `COMMIT_CCC_ROUND_11`
9. exactly one terminal action: `REVEAL_CCC_ROUND_11` or, only after its on-chain timeout, `EXPIRE_CCC_ROUND_11`
10. `SETTLE_LINKED_POSITION_2_WEEK_11`
11. `SETTLE_LINKED_POSITION_3_WEEK_11`

Plan for exactly **17** Model T transaction prompts while the reviewed capacity extension remains required: 15 fixed transaction prompts, one required capacity-extension prompt, and one required `CREATE_SWITCHBOARD_RANDOMNESS` prompt. A retained randomness address never reduces the roster to 16. Before the first feature receipt or signed pending feature transaction exists, if the console reports a retained source-bound randomness record, press **DISCARD RETAINED ADDRESS + REQUIRE FRESH CREATE**. That deliberate local control removes only the versioned address/CREATE-signature/message-hash record stored under the key bound to the exact source commit, migration artifact SHA-256, and mint; it preserves every receipt and performs no RPC read, signature request, broadcast, or chain mutation. Then press **REFRESH FEATURE STATE** and complete the freshly offered `CREATE_SWITCHBOARD_RANDOMNESS` when the roster reaches item 7. Reload continuity is allowed only for the same source-bound CREATE receipt and record after the console independently reconstructs the exact successful finalized two-signer legacy message, verifies its ComputeBudget-then-pinned-Switchboard instruction roster and message hash, and observes the retained account at finalized commitment under the pinned Switchboard owner. The discard control remains disabled after any feature evidence or signed pending feature work exists. If that reconstruction or account observation fails, or any retained state is ambiguous, stop on HOLD; this runbook supports no 16-prompt shortcut.

Do not warp Genesis or time, reroll randomness, fabricate a winner, or execute two attended actions in one transaction.

## 7. Export and independently finalize evidence

The consoles persist canonical records under a versioned local-storage key bound to exact source commit, program artifact SHA-256, and mint. Every record is exact:

`action,title,signature,messageSha256,explorerUrl,finalizedAtUtc,kind,week`

`finalizedAtUtc` is the observer-local UTC capture made after finalized confirmation; it is not claimed as the transaction's on-chain block time. The canonical finalizer independently re-observes and verifies finalized chain data. Keep the receipt field and schema unchanged.

In the feature console, import any separately exported source-bound receipt sets only if the shared local browser storage does not already contain them. Press **EXPORT COMPLETE ATTENDED BUNDLE**. The exporter rejects missing actions, conflicting duplicates, a missing ProgramData capacity observation, and anything other than exactly one round-11 terminal action. It never creates a placeholder receipt.

The legacy seven-stage evidence export is disabled in feature/post-upgrade mode. Its historical initialization receipts must remain separate and must never be rebound to, or combined with, the checked-in successor migration snapshot (`a03fe71d…` / `771c…8a01`). The pre-upgrade initialization shell retains its own legacy export. In the feature shell, **DOWNLOAD FEATURE EVIDENCE** is only a partial checkpoint; **EXPORT COMPLETE ATTENDED BUNDLE** is the canonical complete-roster export.

Use a new empty staging directory and run the finalizer first without `--write`:

```powershell
& $NodeExe scripts/finalize-iat-v2-current-source-devnet-evidence.mjs --console-export <ATTENDED_BUNDLE_JSON> --ci-manifest target/verifiable/iat-v2-build-evidence.json --staging-dir <NEW_EMPTY_STAGING_DIRECTORY>
```

Only after the dry run reports complete wire decoding, finalized transactions, exact post-state, and `clearingEligible: true`, rerun the same command with `--write`. A partial/non-clearing result is not a release artifact.

## Stop conditions

Stop without another signature or broadcast if any exact binding drifts; the connected key is not `7XZ…fzPH`; simulation fails; the wallet changes the message; a prior transaction is not finalized; the next action differs from the roster; previous-round proof fails; a duplicate receipt conflicts; the finalizer cannot decode an exact action; the exact post-state does not pass; or Mainnet is presented as anything other than **HOLD**. This runbook authorizes Devnet rehearsal only and does not authorize a Mainnet transaction.

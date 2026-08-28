# IAT V2 post-CI attended Devnet runbook

Status: source-only operator procedure. Mainnet remains **HOLD**. Do not begin until the public CI artifact, evidence manifest, source commit, artifact SHA-256, and byte count are bound by the checked-in migration constants and the worktree contains no artifact-input drift.

After fresh exact-head CI succeeds, stop before starting or restarting the console. Review the downloaded artifact and evidence manifest, update every checked-in scalar binding to that exact CI source/run/attempt/tree/manifest, create and verify the binding commit, and rerun the read-only artifact check from a clean artifact-input state. Do not open or reopen any attended page until that binding commit and clean verification both pass.

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

The `preiat:v2-admin` lifecycle gate repeats the version check before Vite or any console dependency can load. Use only these localhost URLs:

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

## 1. Bind and inspect the CI artifact

Run the read-only artifact check:

```powershell
& $NodeExe scripts/iat-v2-devnet-buffer-preflight.mjs verify --artifact target/verifiable/iat_v2.so --evidence target/verifiable/iat-v2-build-evidence.json
```

Copy the returned exact artifact byte count into this read-only capacity check:

```powershell
& $NodeExe scripts/iat-v2-devnet-buffer-preflight.mjs capacity --artifact-bytes <CI_ARTIFACT_BYTES>
```

Compare the command result with the upgrade console. Both must show the same current ProgramData capacity, added bytes, extension-required decision, and rent figures. The console derives and displays the exact ProgramData rent top-up. Any disagreement is a stop.

If no extension is required, continue to buffer upload. If extension is required:

1. In `?mode=upgrade`, press **SIMULATE + SIGN SEPARATE CAPACITY EXTENSION**.
2. Review the exact added bytes and rent top-up on the Model T and approve physically.
3. Confirm the console shows **SIGNED // NOT BROADCAST** and the reviewed message SHA-256.
   The amended console must also report that the exact signed-pending record is durably recoverable; do not reload unless recovery is necessary.
4. Press the separate **BROADCAST SIGNED CAPACITY EXTENSION** button once. The console must persist the exact locally derived signature in a permanent broadcast-attempt reservation before its sole send.
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
| Git | `/mnt/c/Program Files/Git/mingw64/bin/git.exe` | `git version 2.55.0.windows.3` | `1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9` | 4,383,048 |
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

The rebuild has exactly two attended `/dev/tty` gates. First, after reviewing Devnet, artifact/evidence/source bindings, exact rent, the fixed 100,000,000-lamport upload-fee-headroom policy, balance, all exact tool identities, and the retained-old-buffer policy, type `REBUILD-DEVNET-FRESH`. The helper then atomically creates the fixed persistent `devnet-buffer-rebuild-v1/attempt-one-use` reservation; any existing or unexpected recovery entry is a permanent read-only recovery HOLD. It snapshots the exact reviewed artifact into that private namespace, binds the snapshot to an `O_NOFOLLOW` descriptor, durably records source/tool/target policy, and never uploads the mutable checkout pathname. After the helper creates and displays one fresh target address, review it and type the target-bound `UPLOAD-<FRESH_BUFFER_ADDRESS>` value exactly. Only the second gate admits the sole fresh-buffer write CLI invocation. That invocation uses `--max-sign-attempts 5`, which may re-sign or resend unconfirmed upload chunks across as many as five blockhash iterations; it is not a claim of one Solana transaction or one signature. The exact rent-plus-headroom floor is freshly reobserved immediately before upload. Record the finalized `BUFFER` printed by the helper. If either gate fails or final reconciliation is ambiguous, stop; do not rerun, and preserve the protected one-use recovery directory for separately reviewed read-only diagnosis.

The historical buffer `Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6` is retained. The rebuild helper never closes or mutates it, and it does not reclaim its lamports.

Set only the fresh address printed by the completed rebuild as the dynamic handoff input, then run the exact handoff helper. `BUFFER_ADDRESS` is admitted only on this handoff command; it has no default, and no historical address is admitted:

```powershell
$BufferAddress = '<EXACT_FRESH_BUFFER_ADDRESS_PRINTED_BY_REBUILD>'
wsl.exe -d Ubuntu-24.04 -u a --exec /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-v1 IAT_V2_HANDOFF_CAS_ROOT=/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1 "BUFFER_ADDRESS=$BufferAddress" /usr/bin/bash --noprofile --norc /mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site/scripts/handoff-iat-v2-devnet-buffer.sh
```

Review exact `BUFFER`, `FROM`, `TO`, artifact SHA-256 and bytes, Node/Git/Solana identity, Devnet genesis, and the 10,000,000-lamport single-handoff fee floor; then type the exact target-bound `TRANSFER-<BUFFER_ADDRESS>-<FIRST_12_ARTIFACT_SHA256_HEX>` challenge shown on `/dev/tty`. Public buffer reads occur before the payer keypair is inspected. After confirmation, the helper verifies the payer identity, freshly reobserves the finalized fee floor, exact buffer address, bytes, hash, and authority after the attended pause, and completes every fallible tool/genesis check before it atomically creates the durable target-keyed reservation. No further tool, genesis, balance, or buffer check occurs between a newly created reservation and the sole authority mutation. The helper submits the authority mutation exactly once and then follows it only with read-only finalized reconciliation. A pre-existing exact reservation skips keypair access and mutation and performs reconciliation only; a malformed or mismatched reservation is a HOLD. Its successful finalized authority readback is necessary but not sufficient; if it reports HOLD or ambiguity, **DO NOT RESUBMIT**, never remove the reservation, and stop for read-only reconciliation. Even after helper success, do not request the upgrade signature until the upgrade console independently re-observes the same exact buffer at finalized commitment and shows authority `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`, the reviewed loader owner, 649,680 bytes, and `771c…8a01`.

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

The legacy seven-stage evidence export is disabled in feature/post-upgrade mode. Its historical initialization receipts must remain separate and must never be rebound to, or combined with, the checked-in successor migration snapshot (`e6f1041a…` / `771c…8a01`). The pre-upgrade initialization shell retains its own legacy export. In the feature shell, **DOWNLOAD FEATURE EVIDENCE** is only a partial checkpoint; **EXPORT COMPLETE ATTENDED BUNDLE** is the canonical complete-roster export.

Use a new empty staging directory and run the finalizer first without `--write`:

```powershell
& $NodeExe scripts/finalize-iat-v2-current-source-devnet-evidence.mjs --console-export <ATTENDED_BUNDLE_JSON> --ci-manifest target/verifiable/iat-v2-build-evidence.json --staging-dir <NEW_EMPTY_STAGING_DIRECTORY>
```

Only after the dry run reports complete wire decoding, finalized transactions, exact post-state, and `clearingEligible: true`, rerun the same command with `--write`. A partial/non-clearing result is not a release artifact.

## Stop conditions

Stop without another signature or broadcast if any exact binding drifts; the connected key is not `7XZ…fzPH`; simulation fails; the wallet changes the message; a prior transaction is not finalized; the next action differs from the roster; previous-round proof fails; a duplicate receipt conflicts; the finalizer cannot decode an exact action; the exact post-state does not pass; or Mainnet is presented as anything other than **HOLD**. This runbook authorizes Devnet rehearsal only and does not authorize a Mainnet transaction.

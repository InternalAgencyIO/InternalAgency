# IAT V2 post-CI attended Devnet runbook

Status: source-only operator procedure. Mainnet remains **HOLD**. Do not begin until the public CI artifact, evidence manifest, source commit, artifact SHA-256, and byte count are bound by the checked-in migration constants and the worktree contains no artifact-input drift.

## Fixed surfaces

Start the local console from `projects/star-ascent/site` with `npm run iat:v2-admin`. Use only these localhost URLs:

1. Program capacity and upgrade: `http://127.0.0.1:4175/?mode=upgrade`
2. Program capacity and upgrade with a verified buffer: `http://127.0.0.1:4175/?mode=upgrade&buffer=<BUFFER_ADDRESS>`
3. Legacy migration and historical neutral backfill: `http://127.0.0.1:4175/?mode=migrate-rounds`
4. Feature rehearsal and aggregate export: `http://127.0.0.1:4175/?mode=features`

Never use a public host for these consoles. The reviewed Devnet program is `62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj`; the attended Model T administrator is `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`.

## 1. Bind and inspect the CI artifact

Run the read-only artifact check:

```sh
node scripts/iat-v2-devnet-buffer-preflight.mjs verify --artifact target/verifiable/iat_v2.so --evidence target/verifiable/iat-v2-build-evidence.json
```

Copy the returned exact artifact byte count into this read-only capacity check:

```sh
node scripts/iat-v2-devnet-buffer-preflight.mjs capacity --artifact-bytes <CI_ARTIFACT_BYTES>
```

Compare the command result with the upgrade console. Both must show the same current ProgramData capacity, added bytes, extension-required decision, and rent figures. The console derives and displays the exact ProgramData rent top-up. Any disagreement is a stop.

If no extension is required, continue to buffer upload. If extension is required:

1. In `?mode=upgrade`, press **SIMULATE + SIGN SEPARATE CAPACITY EXTENSION**.
2. Review the exact added bytes and rent top-up on the Model T and approve physically.
3. Confirm the console shows **SIGNED // NOT BROADCAST** and the reviewed message SHA-256.
4. Press the separate **BROADCAST SIGNED CAPACITY EXTENSION** button.
5. Wait for **FINALIZED**, export the source-bound program receipt set, then refresh the read-only capacity command.

The capacity transaction must never auto-start buffer upload or program upgrade.

## 2. Upload and hand off one fresh buffer

The buffer operations use the reviewed Devnet deployer keypair, not the Model T. They are staging operations outside the attended action roster and therefore do not produce canonical aggregate transaction records. Each helper first verifies the CI binding and requires its own exact typed confirmation; stop before typing if any displayed address, hash, byte count, payer, or network differs.

Upload one fresh buffer:

```sh
ARTIFACT=target/verifiable/iat_v2.so EVIDENCE=target/verifiable/iat-v2-build-evidence.json bash scripts/rebuild-iat-v2-devnet-buffer-fresh.sh
```

Review the output, then type `REBUILD-DEVNET-FRESH` only when the exact CI artifact is shown. Record the new `BUFFER_ADDRESS` printed by the helper.

Hand only that buffer authority to the attended Model T administrator:

```sh
BUFFER_ADDRESS=<BUFFER_ADDRESS> ARTIFACT=target/verifiable/iat_v2.so EVIDENCE=target/verifiable/iat-v2-build-evidence.json bash scripts/handoff-iat-v2-devnet-buffer.sh
```

Review `FROM`, `TO`, `HASH`, and `BYTES`; then type `TRANSFER-7XZ`. Do not proceed until the helper reads the authority back as `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`.

## 3. Upgrade as one attended transaction

Open `http://127.0.0.1:4175/?mode=upgrade&buffer=<BUFFER_ADDRESS>` and verify the program, ProgramData linkage, current capacity, buffer owner, buffer authority, buffer hash, CI artifact hash, source commit, and zero loader padding.

1. Press **CONNECT 7XZ MODEL T DIRECTLY + SIMULATE + SIGN**.
2. Approve the exact upgrade on the Model T.
3. Review the signed-but-not-broadcast message SHA-256.
4. Press the separate **BROADCAST SIGNED DEVNET UPGRADE** button.
5. Wait for finalized confirmation and export the source-bound receipt set containing `UPGRADE_PROGRAM`.

Do not auto-chain into migration.

## 4. Migrate weeks 7 and 8, one transaction each

Open `http://127.0.0.1:4175/?mode=migrate-rounds`. The console must show the exact CI artifact deployed and only settled 198-byte legacy rounds.

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

Open `http://127.0.0.1:4175/?mode=features`. For every offered action, use the first button to build, simulate, and request the physical signature. Review the message hash, then use the separate broadcast button. Never approve the next action until the prior transaction is finalized and the console has refreshed chain state.

The remaining reviewed order is exact:

1. `SETTLE_STANDARD_POSITION_WEEK_10`
2. `SETTLE_STANDARD_POSITION_WEEK_11`
3. `SETTLE_LINKED_POSITION_2_WEEK_9`
4. `SETTLE_LINKED_POSITION_2_WEEK_10`
5. `SETTLE_LINKED_POSITION_3_WEEK_9`
6. `SETTLE_LINKED_POSITION_3_WEEK_10`
7. `CREATE_SWITCHBOARD_RANDOMNESS` only if no verified reusable rehearsal randomness account exists
8. `COMMIT_CCC_ROUND_11`
9. exactly one terminal action: `REVEAL_CCC_ROUND_11` or, only after its on-chain timeout, `EXPIRE_CCC_ROUND_11`
10. `SETTLE_LINKED_POSITION_2_WEEK_11`
11. `SETTLE_LINKED_POSITION_3_WEEK_11`

Do not warp Genesis or time, reroll randomness, fabricate a winner, or execute two attended actions in one transaction.

## 7. Export and independently finalize evidence

The consoles persist canonical records under a versioned local-storage key bound to exact source commit, program artifact SHA-256, and mint. Every record is exact:

`action,title,signature,messageSha256,explorerUrl,finalizedAtUtc,kind,week`

In the feature console, import any separately exported source-bound receipt sets only if the shared local browser storage does not already contain them. Press **EXPORT COMPLETE ATTENDED BUNDLE**. The exporter rejects missing actions, conflicting duplicates, a missing ProgramData capacity observation, and anything other than exactly one round-11 terminal action. It never creates a placeholder receipt.

Use a new empty staging directory and run the finalizer first without `--write`:

```sh
node scripts/finalize-iat-v2-current-source-devnet-evidence.mjs --console-export <ATTENDED_BUNDLE_JSON> --ci-manifest target/verifiable/iat-v2-build-evidence.json --staging-dir <NEW_EMPTY_STAGING_DIRECTORY>
```

Only after the dry run reports complete wire decoding, finalized transactions, exact post-state, and `clearingEligible: true`, rerun the same command with `--write`. A partial/non-clearing result is not a release artifact.

## Stop conditions

Stop without another signature or broadcast if any exact binding drifts; the connected key is not `7XZ…fzPH`; simulation fails; the wallet changes the message; a prior transaction is not finalized; the next action differs from the roster; previous-round proof fails; a duplicate receipt conflicts; the finalizer cannot decode an exact action; the exact post-state does not pass; or Mainnet is presented as anything other than **HOLD**. This runbook authorizes Devnet rehearsal only and does not authorize a Mainnet transaction.

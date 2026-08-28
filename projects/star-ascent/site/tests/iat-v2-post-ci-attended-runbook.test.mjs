import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { IAT_V2_PROGRAM_ID } from "../programs/iat_v2/instructions.mjs";

const runbook = readFileSync("launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md", "utf8");
const attendedIncident = readFileSync(
  "launch/IAT_V2_ATTENDED_DEVNET_INCIDENT_20260827.md",
  "utf8",
);
const upgrade = [
  "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
  "tools/iat-v2-admin-console/ProgramUpgradeAttendedActions.jsx",
].map((path) => readFileSync(path, "utf8")).join("\n");
const migration = readFileSync("tools/iat-v2-admin-console/LegacyRoundMigration.jsx", "utf8");
const feature = readFileSync("tools/iat-v2-admin-console/FeatureRehearsal.jsx", "utf8");
const attendedBoundary = readFileSync(
  "tools/iat-v2-admin-console/attended-transaction-boundary.mjs",
  "utf8",
);

test("post-CI runbook fixes localhost consoles and keeps Mainnet on hold", () => {
  for (const mode of ["upgrade", "migrate-rounds", "features"]) {
    assert.match(runbook, new RegExp(`http://127\\.0\\.0\\.1:4175/\\?mode=${mode}`, "u"));
  }
  assert.match(runbook, /Only the three canonical signing modes—`upgrade`, `migrate-rounds`, and `features`—may request transaction signatures/u);
  assert.match(runbook, /default\/no-mode and `settle-week9` pages are archived non-signing surfaces/u);
  assert.match(runbook, /legacy seven-stage signing is permanently disabled/u);
  assert.match(runbook, /transaction-prompt latch is permanent for its exact source\/artifact\/mint\/action binding/u);
  assert.match(runbook, /rejected, failed, expired, or explicitly discarded signed action ends that ceremony/u);
  assert.match(runbook, /Do not retry that action, clear browser storage, change origin\/profile, or attempt another transaction signature/u);
  assert.match(runbook, /Preserve the consumed old latch and stop on HOLD/u);
  assert.match(runbook, /fresh exact-head CI and a genuinely new source binding/u);
  assert.match(runbook, /After fresh exact-head CI succeeds, stop before starting or restarting the console/u);
  assert.match(runbook, /update every checked-in scalar binding to that exact CI source\/run\/attempt\/tree\/manifest/u);
  assert.match(runbook, /create and verify the binding commit/u);
  assert.match(runbook, /Do not open or reopen any attended page until that binding commit and clean verification both pass/u);
  assert.match(runbook, /Mainnet remains \*\*HOLD\*\*/u);
  assert.match(runbook, /does not authorize a Mainnet transaction/u);
  assert.match(runbook, new RegExp(IAT_V2_PROGRAM_ID.toBase58(), "u"));
  assert.doesNotMatch(runbook, /IATv2jRuKKmT41NKsb1iYwWba4wtviisFTcKMcpVR7X/u);
});

test("the incident preserves the consumed ceremony and requires a fresh source-bound replacement", () => {
  assert.match(attendedIncident, /SIGNED \/\/ NOT BROADCAST/u);
  assert.match(attendedIncident, /operator reported that the Model T locally signed/u);
  assert.match(attendedIncident, /No signed wire or signature\s+receipt was retained/u);
  assert.match(attendedIncident, /device and UI observations are not independently\s+verifiable/u);
  assert.match(attendedIncident, /signed wire reportedly existed only in React memory and was\s+lost/u);
  assert.match(attendedIncident, /Canonical action EXTEND_PROGRAM_DATA already consumed its transaction-prompt latch/u);
  assert.match(attendedIncident, /consumed v1 latch must remain preserved/u);
  assert.match(attendedIncident, /old ceremony cannot be continued/u);
  assert.match(attendedIncident, /genuinely new source\s+binding, and fresh exact-head CI/u);
  assert.match(attendedIncident, /distinct key without deleting the prior incident latch/u);
  assert.match(attendedIncident, /`m\/44'\/501'\/0'\/0'`/u);
  assert.match(attendedIncident, /preserve, rather than replace or bypass, the consumed\s+v1 incident latch/u);
  assert.match(attendedIncident, /not a transaction receipt, signature receipt, release,\s+deployment, or Mainnet authorization/u);
});

test("only program actions gain durable signed recovery and permanent reconcile-only broadcast", () => {
  assert.match(runbook, /program-capacity\/upgrade surface alone adds an exact source\/artifact\/mint\/action-bound signed-pending record/u);
  assert.match(runbook, /persisted while the prompt latch is still entered and before the broadcast control is shown/u);
  assert.match(runbook, /never auto-broadcast/u);
  assert.match(runbook, /derives the exact Solana signature locally/u);
  assert.match(runbook, /persists a permanent source\/artifact\/mint\/action-bound broadcast-attempt reservation before the sole send/u);
  assert.match(runbook, /Only creation of that new reservation may reach the send method/u);
  assert.match(runbook, /action is permanently reconcile-only and no send method may ever be reached for it again/u);
  assert.match(runbook, /exact finalized wire, message, and signature/u);
  assert.match(runbook, /exact action-specific finalized post-state/u);
  assert.match(runbook, /Never delete or reset the permanent attempt/u);
  assert.match(runbook, /null, timeout, ambiguous result, or incomplete evidence remains HOLD and poll-only; never resend/u);
  assert.match(runbook, /Signed-pending state on migration and feature surfaces remains memory-only/u);
  assert.match(runbook, /do not gain durable reload or reconcile-only recovery/u);
  assert.match(runbook, /never reload or navigate away while one of their signed transactions is pending/u);
  assert.match(runbook, /POLL FINALIZED SIGNATURE \+ COMPLETE EVIDENCE \(NO SEND\)/u);

  assert.match(attendedIncident, /permanent\s+source\/artifact\/mint\/action-bound broadcast-attempt reservation before the sole\s+send/u);
  assert.match(attendedIncident, /action is permanently reconcile-only/u);
  assert.match(attendedIncident, /never send again or delete\/reset the attempt/u);
  assert.match(attendedIncident, /keeps migration and feature signed-pending state memory-only/u);
});

test("attended runbook gates the runtime, shell, browser storage, and finalized buffer handoff", () => {
  assert.match(runbook, /\$NodeExe = 'C:\\ABSOLUTE\\PATH\\TO\\REVIEWED\\node\.exe'/u);
  assert.match(runbook, /\$NpmCli = 'C:\\ABSOLUTE\\PATH\\TO\\REVIEWED\\npm-cli\.js'/u);
  assert.match(runbook, /Node\.js `>=22\.13\.0`/u);
  assert.match(runbook, /older, malformed, unavailable, or changed path\/version is a stop/u);
  assert.match(runbook, /Do not invoke `npm\.cmd`/u);
  assert.match(runbook, /& \$NodeExe \$NpmCli run iat:v2-admin/u);
  assert.doesNotMatch(runbook, /^node scripts\/(?:iat-v2-devnet-buffer-preflight|finalize-iat-v2-current-source-devnet-evidence)\.mjs/mu);
  assert.doesNotMatch(runbook, /^npm(?:\.cmd)? run iat:v2-admin/mu);
  assert.match(runbook, /same non-private browser profile/u);
  assert.match(runbook, /Do not clear site data, switch browser profiles, change the host or port/u);
  assert.match(runbook, /pinned to the installed `Ubuntu-24\.04` WSL2 distribution, POSIX user `a` \(UID 1000\)/u);
  assert.match(runbook, /Git Bash, another WSL distribution or user[\s\S]*is a stop/u);
  assert.match(runbook, /readable\/writable `\/dev\/tty`/u);
  assert.match(runbook, /helper submits the authority mutation exactly once/u);
  assert.match(runbook, /successful finalized authority readback is necessary but not sufficient/u);
  assert.match(runbook, /\*\*DO NOT RESUBMIT\*\*/u);
  assert.match(runbook, /upgrade console independently re-observes the same exact buffer at finalized commitment/u);
});

test("buffer lane pins the exact WSL2 toolchain, Devnet genesis, and clean launchers", () => {
  const exactCheckout = "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site";
  const cleanPrefix = "wsl.exe -d Ubuntu-24.04 -u a --exec /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-v1";
  assert.match(runbook, new RegExp(exactCheckout.replaceAll("/", "\\/"), "u"));
  assert.ok(runbook.split(cleanPrefix).length >= 4, "CAS verify and both helpers must use the exact clean WSL launcher");
  for (const exact of [
    "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node",
    "v24.19.0",
    "bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12",
    "125,989,464",
    "/mnt/c/Program Files/Git/mingw64/bin/git.exe",
    "git version 2.55.0.windows.3",
    "1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9",
    "4,383,048",
    "/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana",
    "solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)",
    "aacc6871e8ff199608987f0364f2ed9e239a32e1e0548f1ae4477e0e533e1dea",
    "28,546,968",
    "/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana-keygen",
    "solana-keygen 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)",
    "bf66aa11a13dd15503f40ab2b1160f06c7505bca692dfb20800682615d4ec952",
    "2,828,816",
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  ]) {
    assert.ok(runbook.includes(exact), `runbook must include exact pin: ${exact}`);
  }
  assert.match(runbook, /\/usr\/bin\/bash --noprofile --norc [^\n]*\/scripts\/rebuild-iat-v2-devnet-buffer-fresh\.sh/u);
  assert.match(runbook, /"BUFFER_ADDRESS=\$BufferAddress" \/usr\/bin\/bash --noprofile --norc [^\n]*\/scripts\/handoff-iat-v2-devnet-buffer\.sh/u);
  assert.match(runbook, /`BUFFER_ADDRESS` is admitted only on this handoff command/u);
});

test("runbook freezes the one-use CAS and the two fresh-buffer terminal gates", () => {
  assert.match(runbook, /Root: `\/home\/a\/\.local\/state\/internal-agency\/iat-v2\/devnet-buffer-handoff-v1`/u);
  assert.match(runbook, /\.iat-v2-devnet-buffer-authority-cas-root\.json/u);
  assert.match(runbook, /ceremony ID: `9e691e59-35c8-4861-86a0-7a219885b1c0`/u);
  assert.match(runbook, /11893575f111807621fcbc8c77ea73fae03390404507202146dde9e69d5818da/u);
  assert.match(runbook, /initialized exactly once/u);
  assert.match(runbook, /with the final word changed from `verify` to `initialize`/u);
  assert.match(runbook, /initialize-iat-v2-devnet-buffer-handoff-cas\.mjs verify/u);
  assert.match(runbook, /Never delete, rename, recreate, edit, reset, relocate, or reuse this root/u);
  assert.match(runbook, /exactly two attended `\/dev\/tty` gates/u);
  assert.match(runbook, /type `REBUILD-DEVNET-FRESH`/u);
  assert.match(runbook, /target-bound `UPLOAD-<FRESH_BUFFER_ADDRESS>`/u);
  assert.match(runbook, /Only the second gate admits the sole fresh-buffer write CLI invocation/u);
  assert.match(runbook, /100,000,000-lamport upload-fee-headroom policy/u);
  assert.match(runbook, /attempt-one-use/u);
  assert.match(runbook, /`O_NOFOLLOW` descriptor/u);
  assert.match(runbook, /`--max-sign-attempts 5`[^.]*re-sign or resend/u);
  assert.match(runbook, /10,000,000-lamport single-handoff fee floor/u);
  assert.match(runbook, /`TRANSFER-<BUFFER_ADDRESS>-<FIRST_12_ARTIFACT_SHA256_HEX>`/u);
  assert.doesNotMatch(runbook, /`TRANSFER-7XZ`/u);
  assert.match(runbook, /every fallible tool\/genesis check before it atomically creates/u);
  assert.match(runbook, /historical buffer `Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6` is retained/u);
  assert.match(runbook, /never closes or mutates it/u);
  assert.doesNotMatch(runbook, /program close|close the old buffer|reclaim its lamports[^.]*\b(?:may|will|does)\b/iu);
});

test("operator sequence preserves conditional capacity, buffer, migration, backfill, and feature order", () => {
  const tokens = [
    "iat-v2-devnet-buffer-preflight.mjs capacity",
    "rebuild-iat-v2-devnet-buffer-fresh.sh",
    "handoff-iat-v2-devnet-buffer.sh",
    "UPGRADE_PROGRAM",
    "MIGRATE_LEGACY_ROUND_WEEK_7",
    "MIGRATE_LEGACY_ROUND_WEEK_8",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_11",
    "SETTLE_LINKED_POSITION_2_WEEK_9",
    "SETTLE_LINKED_POSITION_2_WEEK_10",
    "SETTLE_LINKED_POSITION_3_WEEK_9",
    "SETTLE_LINKED_POSITION_3_WEEK_10",
    "CREATE_SWITCHBOARD_RANDOMNESS",
    "COMMIT_CCC_ROUND_11",
    "SETTLE_LINKED_POSITION_2_WEEK_11",
    "SETTLE_LINKED_POSITION_3_WEEK_11",
    "finalize-iat-v2-current-source-devnet-evidence.mjs",
  ];
  let cursor = -1;
  for (const token of tokens) {
    const next = runbook.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${token} must appear in reviewed order`);
    cursor = next;
  }
});

test("each attended console separates simulation/signing from finalized broadcast and evidence", () => {
  for (const source of [`${upgrade}\n${attendedBoundary}`, `${migration}\n${attendedBoundary}`, feature]) {
    assert.match(source, /simulateTransaction/u);
    assert.match(source, /provider\.signTransaction/u);
    assert.match(source, /sendRawTransaction/u);
    assert.match(source, /FINALIZED_COMMITMENT/u);
    assert.match(source, /messageSha256/u);
    assert.match(source, /finalizedAtUtc/u);
    assert.doesNotMatch(source.match(/useEffect\([\s\S]*?\n  \}, \[\]\);/u)?.[0] ?? "", /sendRawTransaction/u);
  }
  assert.match(upgrade, /persistAttendedReceipt/u);
  assert.match(migration, /persistAttendedReceipt/u);
  assert.match(feature, /buildCompleteAttendedBundle/u);
  assert.match(feature, /EXPORT COMPLETE ATTENDED BUNDLE/u);
  assert.match(feature, /CLEAR LOCAL FEATURE RECEIPTS/u);
  assert.match(runbook, /never creates a placeholder receipt/u);
  assert.match(runbook, /`finalizedAtUtc` is the observer-local UTC capture made after finalized confirmation/u);
  assert.match(runbook, /not claimed as the transaction's on-chain block time/u);
  assert.match(runbook, /canonical finalizer independently re-observes and verifies finalized chain data/u);
  assert.match(runbook, /Keep the receipt field and schema unchanged/u);
});

test("feature selection is documented as finalized chain truth before any prompt", () => {
  assert.match(runbook, /selector must refresh its config and action accounts at finalized commitment/u);
  assert.match(runbook, /derive cadence only from finalized block time/u);
  assert.match(runbook, /greatest returned observation slot must still resolve to the same week and CCC round/u);
  assert.match(runbook, /confirmed-only read, local workstation time, missing block time, regressing context, or boundary change/u);
  assert.match(feature, /getAccountInfoAndContext/u);
  assert.match(feature, /getMultipleAccountsInfoAndContext/u);
  assert.match(feature, /getBalanceAndContext/u);
  assert.match(feature, /minContextSlot/u);
  assert.doesNotMatch(
    feature.slice(
      feature.indexOf("async function loadFeatureState"),
      feature.indexOf("function nextFeatureAction"),
    ),
    /Date\.now\(|["']confirmed["']/u,
  );
});

test("feature signing and broadcast stop on any fresh deployment or action mismatch", () => {
  assert.match(
    runbook,
    /fresh finalized parent snapshot[\s\S]*snapshot's final slot as the minimum[\s\S]*exact Program ID, ProgramData address, `771c…8a01` program hash, 649,680-byte artifact length, and `7XZj…fzPH` upgrade authority/u,
  );
  assert.match(
    runbook,
    /after simulation immediately before the Model T prompt[\s\S]*broadcast click must repeat the same parent → child → deployment observation chain/u,
  );
  assert.match(runbook, /pre-broadcast mismatch discards the pending signed transaction and broadcasts nothing/u);
});

test("the base admin shell keeps artifact modes exact and initialization finalized", () => {
  const admin = readFileSync("tools/iat-v2-admin-console/main.jsx", "utf8");
  assert.match(runbook, /feature-mode shell must require the exact migration artifact/u);
  assert.match(runbook, /seven-stage initialization shell remains pinned to its exact pre-upgrade artifact/u);
  assert.match(runbook, /Mode switching must never turn “either reviewed artifact” into an acceptable deployment check/u);
  assert.match(admin, /ACTIVE_PROGRAM_ARTIFACT_BYTES = FEATURE_MODE/u);
  assert.match(
    admin,
    /const FOOTER_SOURCE_COMMIT = FEATURE_MODE\s*\? IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD\s*: SOURCE_COMMIT;/u,
  );
  assert.match(admin, /<span>SOURCE \{FOOTER_SOURCE_COMMIT\.slice\(0, 12\)\}<\/span>/u);
  assert.match(admin, /expectedArtifactBytes: ACTIVE_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(admin, /expectedArtifactSha256: ACTIVE_PROGRAM_ARTIFACT_SHA256/u);
  assert.match(admin, /getMultipleAccountsInfoAndContext/u);
  assert.match(admin, /getBalanceAndContext/u);
  assert.match(admin, /finalizedBlockTimestamp/u);
  assert.doesNotMatch(admin, /Date\.now\(|["']confirmed["']/u);
});

test("post-upgrade feature evidence cannot reuse the legacy initialization export", () => {
  const admin = readFileSync("tools/iat-v2-admin-console/main.jsx", "utf8");
  assert.match(runbook, /legacy seven-stage evidence export is disabled in feature\/post-upgrade mode/u);
  assert.match(runbook, /checked-in successor migration snapshot \(`3b68feb8…` \/ `771c…8a01`\)/u);
  assert.match(runbook, /pre-upgrade initialization shell retains its own legacy export/u);
  assert.match(runbook, /DOWNLOAD FEATURE EVIDENCE[^\n]+only a partial checkpoint/u);
  assert.match(runbook, /EXPORT COMPLETE ATTENDED BUNDLE[^\n]+canonical complete-roster export/u);
  assert.match(admin, /if \(FEATURE_MODE\) \{[\s\S]*LEGACY SEVEN-STAGE EXPORT DISABLED IN POST-UPGRADE MODE[\s\S]*return;[\s\S]*const payload =/u);
  assert.match(admin, /rehearsalScope: "PRIMARY_INITIALIZATION"/u);
  assert.doesNotMatch(admin, /BACKDATED_FEATURE_INSTANCE_INITIALIZATION|iat-v2-devnet-feature-initialization-evidence\.json/u);
  assert.match(feature, /DOWNLOAD FEATURE EVIDENCE/u);
  assert.match(feature, /buildCompleteAttendedBundle/u);
  assert.match(feature, /EXPORT COMPLETE ATTENDED BUNDLE/u);
});

test("17 prompts always include a fresh source-bound randomness creation", () => {
  assert.match(runbook, /Plan for exactly \*\*17\*\* Model T transaction prompts/u);
  assert.match(runbook, /15 fixed transaction prompts, one required capacity-extension prompt, and one required `CREATE_SWITCHBOARD_RANDOMNESS` prompt/u);
  assert.match(runbook, /DISCARD RETAINED ADDRESS \+ REQUIRE FRESH CREATE/u);
  assert.match(runbook, /versioned address\/CREATE-signature\/message-hash record stored under the key bound to the exact source commit, migration artifact SHA-256, and mint/u);
  assert.match(runbook, /preserves every receipt and performs no RPC read, signature request, broadcast, or chain mutation/u);
  assert.match(runbook, /independently reconstructs the exact successful finalized two-signer legacy message/u);
  assert.match(runbook, /ComputeBudget-then-pinned-Switchboard instruction roster and message hash/u);
  assert.match(runbook, /retained account at finalized commitment under the pinned Switchboard owner/u);
  assert.match(runbook, /discard control remains disabled after any feature evidence or signed pending feature work exists/u);
  assert.match(runbook, /supports no 16-prompt shortcut/u);
  assert.match(runbook, /memory-only on-device address-display gate/u);
  assert.match(runbook, /non-transaction device confirmation and is not one of the 17 Model T transaction-signature prompts/u);
  assert.match(runbook, /action UI appears before the full on-device address match succeeds, stop without signing or broadcasting/u);
  assert.doesNotMatch(runbook, /may be \*\*16\*\*|verified reusable rehearsal randomness/u);
});

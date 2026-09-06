import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC,
  IAT_V2_DEVNET_CEREMONY_HORIZON_TRANSITION,
  IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
} from "../programs/iat_v2/ceremony-horizon.mjs";
import { IAT_V2_PROGRAM_ID } from "../programs/iat_v2/instructions.mjs";

const runbook = readFileSync("launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md", "utf8");
const attendedIncident = readFileSync(
  "launch/IAT_V2_ATTENDED_DEVNET_INCIDENT_20260827.md",
  "utf8",
);
const bufferDescriptorIncident = readFileSync(
  "launch/IAT_V2_DEVNET_BUFFER_FD_INCIDENT_20260828.md",
  "utf8",
);
const partialBufferIncident = readFileSync(
  "launch/IAT_V2_DEVNET_BUFFER_PARTIAL_UPLOAD_INCIDENT_20260828.md",
  "utf8",
);
const continuationIncident = readFileSync(
  "launch/IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_INCIDENT_20260831.md",
  "utf8",
);
const continuation54720Incident = readFileSync(
  "launch/IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_54720_INCIDENT_20260831.md",
  "utf8",
);
const upgradeExpiryIncident = readFileSync(
  "launch/IAT_V2_ATTENDED_DEVNET_UPGRADE_EXPIRY_INCIDENT_20260831.md",
  "utf8",
);
const programCeremonyBindingSource = readFileSync(
  "programs/iat_v2/ceremony-binding.mjs",
  "utf8",
);
const programCeremonyRuntimeSource = readFileSync(
  "scripts/lib/iat-v2-devnet-program-ceremony-runtime-binding.mjs",
  "utf8",
);
const programCeremonyAnchor = JSON.parse(readFileSync(
  "scripts/data/iat-v2-devnet-program-ceremony-runtime-binding.json",
  "utf8",
));
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
  assert.match(runbook, /never update or rebind the immutable migration artifact\/evidence constants to the recovery source/u);
  assert.match(runbook, /create and verify the binding commit/u);
  assert.match(runbook, /Do not open or reopen any attended page until the attended program-ceremony binding commit and clean verification pass/u);
  assert.match(runbook, /agent\/iat-v2-devnet-ceremony-ci-\$SourceS/u);
  assert.match(runbook, /target\/verifiable\/iat-v2-ceremony-runtime-build-evidence\.json/u);
  assert.match(
    runbook,
    /finalize-iat-v2-current-source-devnet-evidence\.mjs --console-export <ATTENDED_BUNDLE_JSON> --staging-dir <NEW_EMPTY_STAGING_DIRECTORY>/u,
  );
  assert.doesNotMatch(runbook, /finalize-iat-v2-current-source-devnet-evidence\.mjs[^\n]*--ci-manifest/u);
  assert.match(runbook, /finalizer has no operator-selectable manifest input/u);
  assert.match(runbook, /independently verifies the canonical program binary bytes before observing Devnet/u);
  assert.match(runbook, /verify-iat-v2-devnet-program-ceremony-runtime-binding\.mjs/u);
  assert.match(runbook, /Public `B` CI independently fetches the exact evidence branch, downloads the exact artifact from `\$RunId`, stages the manifest at the canonical path, and executes the same full verifier/u);
  assert.match(runbook, /`vite preview` is prohibited/u);
  assert.match(runbook, /Mainnet remains \*\*HOLD\*\*/u);
  assert.match(runbook, /does not authorize a Mainnet transaction/u);
  assert.match(runbook, new RegExp(IAT_V2_PROGRAM_ID.toBase58(), "u"));
  assert.doesNotMatch(runbook, /IATv2jRuKKmT41NKsb1iYwWba4wtviisFTcKMcpVR7X/u);
});

test("runbook preserves completed recovery S/B as historical staging evidence instead of a current-HEAD gate", () => {
  for (const exact of [
    "a03fe71dd66cd1650b8d0353e486786df30b83e9",
    "ffe82fcf8fd3d851c09a937ebec945121137e546",
    "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
    "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
    "33161771816",
    "scripts/data/iat-v2-devnet-buffer-runtime-binding.json",
    "target/verifiable/iat-v2-recovery-runtime-build-evidence.json",
  ]) {
    assert.ok(runbook.includes(exact), `runbook must include independent binding pin: ${exact}`);
  }
  assert.match(runbook, /The immutable migration artifact\/evidence binding remains exactly/u);
  assert.match(runbook, /recovery-runtime binding was a separate staging lane and is now immutable historical staging evidence/u);
  assert.match(runbook, /historical `B` binds `S` and its tree/u);
  assert.match(runbook, /cannot and must not also pass at the newer program-ceremony successor/u);
  assert.match(runbook, /Preserve its anchor, evidence manifest, commits, and completed staging record without modification/u);
  assert.match(runbook, /does not replace the immutable migration artifact\/evidence lane/u);
  assert.doesNotMatch(runbook, /^& \$NodeExe scripts\/iat-v2-devnet-buffer-preflight\.mjs verify-recovery/mu);
  assert.match(runbook, /Do \*\*not\*\* run `verify-recovery` from the fresh program-ceremony successor `B`/u);
  assert.match(runbook, /historical completed buffer staging and handoff — evidence only/iu);
  assert.match(runbook, /not current commands, are not prerequisites to rerun at the fresh program-ceremony `B`/u);
  assert.match(runbook, /does not bind installed `node_modules` bytes/u);
  assert.match(runbook, /does not merge their source provenance/u);
});

test("runbook makes artifact, fresh ceremony binding, and finalized console observations the only current entry gates", () => {
  assert.match(runbook, /current attended-entry gates are exactly the immutable migration artifact\/evidence preflight, the fresh attended program-ceremony runtime binding at its exact clean successor `B`, and fresh finalized in-console observations/u);
  assert.match(runbook, /current runtime gate is the full attended program-ceremony binding verification performed before the local console can serve action UI/u);
  assert.match(runbook, /freshly re-observe at finalized commitment the exact Program ID and ProgramData linkage/u);
  assert.match(runbook, /independently re-observe buffer `564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`/u);
  assert.match(runbook, /649,680 payload bytes/u);
  assert.match(runbook, /Any missing, stale, non-finalized, or mismatched observation keeps action UI on HOLD/u);
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

test("the 20260831 upgrade-expiry incident binds the exact pre-send HOLD without inventing transaction evidence", () => {
  assert.match(upgradeExpiryIncident, /HOLD \/ SIGNED UPGRADE EXPIRED BEFORE BROADCAST/u);
  assert.match(upgradeExpiryIncident, /Mainnet was not\s+accessed/u);
  assert.match(upgradeExpiryIncident, /`Signed transaction blockhash is no longer valid`/u);
  assert.match(upgradeExpiryIncident, /only inside the separate\s+broadcast control's exclusive `beforePersist` callback/u);
  assert.match(upgradeExpiryIncident, /permanent broadcast-attempt reservation is created only after\s+that callback succeeds/u);
  assert.match(upgradeExpiryIncident, /this exact failure\s+path is pre-reservation and pre-send/u);
  assert.match(upgradeExpiryIncident, /does not identify\s+which of the finalized or processed validity checks returned false/u);

  for (const exact of [
    "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj",
    "6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP",
    "489333243",
    "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
    "88d2a55973fd89245697d07e0e662cebdc3c0154bad4aa8f81e4c446beee34a3",
    "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7",
    "564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH",
    "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
    "491084506",
    "1db0e3eb84e70fc3301e5d233d0784a39547cc2169e59751b59e28a2b5fa41ca",
  ]) {
    assert.ok(upgradeExpiryIncident.includes(exact), `upgrade-expiry incident must retain exact evidence: ${exact}`);
  }
  assert.match(upgradeExpiryIncident, /No browser\s+storage was inspected/u);
  assert.match(upgradeExpiryIncident, /does not claim a particular local\s+prompt-latch, tombstone, signed-pending, or broadcast-attempt record/u);
  assert.match(upgradeExpiryIncident, /message hash, blockhash,\s+last-valid height, signed-wire hash, and local signature were not supplied and\s+must not be invented/u);
  assert.match(upgradeExpiryIncident, /old source\/artifact\/mint\/action ceremony is terminal/u);
  assert.match(upgradeExpiryIncident, /Do not retry the\s+Model T transaction signature, press broadcast, clear site data, change the\s+browser profile\/origin\/port, reconstruct or submit the expired wire, or erase\s+the old latch/u);
  assert.match(upgradeExpiryIncident, /genuinely new reviewed ceremony\s+source binding, fresh exact-head public CI, authenticated artifact and runtime\s+evidence, and a binding-only successor/u);
  assert.match(upgradeExpiryIncident, /must not be relabeled as recovery-source evidence/u);
  assert.match(upgradeExpiryIncident, /not a transaction receipt, deployment receipt, release,\s+or Mainnet authorization/u);
});

test("fresh attended program ceremony binding remains a separate S-to-B source lane and preserves the immutable artifact lane", () => {
  const nullUntilBound = [
    "checkoutCommit",
    "checkoutTree",
    "ciRunAttempt",
    "ciRunId",
    "runtimeClosureSha256",
    "runtimeEvidenceManifestSha256",
    "sourceHeadCommit",
    "sourceHeadTree",
    "workflowRef",
  ];
  assert.equal(programCeremonyAnchor.schema, "iat-v2-devnet-program-ceremony-runtime-binding/v1");
  assert.equal(programCeremonyAnchor.network, "devnet");
  assert.equal(programCeremonyAnchor.mainnetStatus, "HOLD");
  if (programCeremonyAnchor.status === "UNBOUND") {
    for (const field of nullUntilBound) {
      assert.equal(programCeremonyAnchor[field], null, `unbound ceremony anchor ${field} must remain null`);
    }
  } else {
    for (const field of nullUntilBound) {
      assert.notEqual(programCeremonyAnchor[field], null, `bound ceremony anchor ${field} must be populated`);
    }
    assert.notEqual(programCeremonyAnchor.sourceHeadCommit, programCeremonyAnchor.artifactSourceHeadCommit);
    assert.notEqual(
      programCeremonyAnchor.runtimeEvidenceManifestSha256,
      programCeremonyAnchor.artifactEvidenceManifestSha256,
    );
  }
  assert.equal(programCeremonyAnchor.artifactSourceHeadCommit, "a03fe71dd66cd1650b8d0353e486786df30b83e9");
  assert.equal(programCeremonyAnchor.artifactBuildRunId, 33_161_771_816);
  assert.equal(programCeremonyAnchor.artifactBuildRunAttempt, 1);
  assert.equal(programCeremonyAnchor.artifactBytes, 649_680);
  assert.equal(programCeremonyAnchor.artifactSha256, "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01");
  assert.equal(programCeremonyAnchor.artifactEvidenceManifestSha256, "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9");
  assert.ok(programCeremonyAnchor.limitations.every((line) => /not|do not|Does not/u.test(line)));

  assert.match(runbook, /attended program-ceremony runtime binding is also separate/u);
  assert.match(runbook, /implementation commit `S` contains the console, expiry watcher, storage boundaries, tests, runbook, and canonical unbound `scripts\/data\/iat-v2-devnet-program-ceremony-runtime-binding\.json`/u);
  assert.match(runbook, /Fresh exact-head public PR CI must run for that exact `S`/u);
  assert.match(runbook, /direct one-parent successor `B` may change only that anchor/u);
  assert.match(runbook, /binds the exact `S` commit\/tree, runtime closure, PR-merge checkout relation, CI run\/attempt\/workflow, runtime evidence-manifest SHA-256, and the unchanged immutable migration artifact tuple/u);
  assert.match(runbook, /permanent storage namespace uses `S` as `sourceCommit`; it never uses `B`, a CI rerun, or a schema\/version bump to manufacture another prompt namespace/u);
  assert.match(runbook, /old `a03fe71d…` latch and any tombstone remain preserved/u);
  assert.match(runbook, /binding authorizes no prompt by itself and provides no evidence of a signature, broadcast, deployment, release, or Mainnet action/u);
  assert.match(runbook, /Do not open or reopen any attended page until the attended program-ceremony binding commit and clean verification pass/u);
  assert.match(runbook, /fresh ceremony source is the reviewed attended implementation commit `S`, while artifact provenance remains the immutable `a03fe71d…` source/u);
  assert.match(runbook, /console must display both and must never relabel one as the other/u);

  assert.match(programCeremonyRuntimeSource, /"launch\/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK\.md"/u);
  assert.match(programCeremonyRuntimeSource, /IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH/u);
  assert.match(programCeremonyRuntimeSource, /current HEAD is not the direct one-parent binding successor B of source S/u);
  assert.match(programCeremonyRuntimeSource, /ceremony binding successor changed paths beyond the one canonical anchor/u);
  assert.match(programCeremonyRuntimeSource, /ceremony runtime closure changed in binding-only successor B/u);
  assert.match(programCeremonyRuntimeSource, /validateSbfEvidence/u);
  assert.match(programCeremonyRuntimeSource, /runtime CI evidence SHA-256 disagrees with the binding anchor/u);
  assert.match(programCeremonyRuntimeSource, /public ceremony CI-checkout evidence ref disagrees with the binding anchor/u);
  assert.match(programCeremonyBindingSource, /requireBound: true/u);
  assert.match(programCeremonyBindingSource, /value\.sourceHeadCommit !== value\.artifactSourceHeadCommit/u);
  assert.match(programCeremonyBindingSource, /sourceCommit: exact\.sourceHeadCommit/u);
  assert.match(programCeremonyBindingSource, /programArtifactSha256: exact\.artifactSha256/u);
  assert.match(upgrade, /ATTENDED CEREMONY SOURCE/u);
  assert.match(upgrade, /IMMUTABLE ARTIFACT SOURCE/u);
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

test("program upgrade documents a read-only live blockhash window while preserving the locked send gate", () => {
  assert.match(runbook, /read-only live window observes the signed blockhash at finalized and processed commitment/u);
  assert.match(runbook, /reports an exact remaining-block countdown/u);
  assert.match(runbook, /`CHECKING`, stale, background-tab, near-expiry, `RPC UNKNOWN`, or `EXPIRED` state disables broadcast/u);
  assert.match(runbook, /watcher never refreshes the blockhash, signs, persists, reserves, discards, or sends/u);
  assert.match(runbook, /display is advisory/u);
  assert.match(runbook, /locked authoritative gate still requires blockhash validity at both finalized and processed commitment/u);
  assert.match(runbook, /This click remains an explicit operator action/u);
  assert.match(attendedBoundary, /observeSignedBlockhashWindow/u);
  assert.match(upgrade, /MIN_BROADCAST_REMAINING_BLOCKS/u);
  assert.match(upgrade, /BLOCKHASH_WINDOW_MAX_AGE_MS/u);
  assert.match(upgrade, /!broadcastWindowReady/u);
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
  assert.match(runbook, /It submits that mutation once and follows it only with read-only finalized reconciliation/u);
  assert.match(runbook, /Even after helper success, do not request the upgrade signature until the upgrade console independently re-observes/u);
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
    "/usr/bin/git",
    "git version 2.43.0",
    "2a8c18fbf43da9f692d75474c72bea9dfd796c260b0f3dfe456376abc3bbd668",
    "4,066,232",
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
  assert.match(runbook, /"BUFFER_ADDRESS=\$BufferAddress" \/usr\/bin\/bash --noprofile --norc -c \$HandoffLauncher iat-v2-captured-handoff-launcher/u);
  assert.match(runbook, /expected_sha256='05ac385c9630231daf0cfb281f43ac475846a8b150a4404e26772192a1e2dada'/u);
  assert.match(runbook, /expected_bytes='61116'/u);
  assert.match(runbook, /The captured-source launcher is mandatory: direct mutable-path execution is rejected/u);
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
  assert.match(
    runbook,
    /atomically creates the durable target-keyed reservation[\s\S]*?re-inspects the record through the pinned CAS directory[\s\S]*?opens the exact record on FD11[\s\S]*?checks the digest[\s\S]*?repeats the pinned runtime, payer address, finalized balance, buffer, and CAS checks immediately before the sole signer mutation/u,
  );
  assert.match(runbook, /historical buffer `Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6` is retained/u);
  assert.match(runbook, /never closes or mutates it/u);
  assert.doesNotMatch(runbook, /program close|close the old buffer|reclaim its lamports[^.]*\b(?:may|will|does)\b/iu);
});

test("runbook binds the descriptor incident to one exact pre-address continuation", () => {
  assert.match(runbook, /recover-iat-v2-devnet-buffer-pre-address\.sh/u);
  assert.match(runbook, /Fresh exact-head public PR CI/u);
  assert.match(runbook, /Never append `recover-pre-address`/u);
  assert.match(runbook, /type `RECOVER-DEVNET-BUFFER-PRE-ADDRESS` only when the attached helper asks on `\/dev\/tty`, never at a `PS>` prompt/u);
  assert.match(runbook, /first phrase authorizes protected continuation and local public-address\/manifest creation only; it does not authorize upload/u);
  assert.match(runbook, /same separate target-bound `UPLOAD-<FRESH_BUFFER_ADDRESS>` gate/u);
  assert.match(runbook, /never prompts the Model T and never performs authority handoff/u);
  assert.match(runbook, /every Mainnet action remain HOLD/u);

  assert.match(bufferDescriptorIncident, /DEVNET HOLD \/ ONE-USE PRE-ADDRESS STATE PRESERVED \/ NO BUFFER WRITE ATTEMPT/u);
  assert.match(bufferDescriptorIncident, /cannot statx '\/proc\/self\/fd\/10'/u);
  assert.match(bufferDescriptorIncident, /target-bound\s+`UPLOAD-<FRESH_BUFFER_ADDRESS>` gate was never reached/u);
  assert.match(bufferDescriptorIncident, /never\s+invoked `solana program write-buffer`/u);
  assert.match(bufferDescriptorIncident, /historical buffer was untouched/u);
  assert.match(bufferDescriptorIncident, /No\s+Model T prompt was involved/u);
  assert.match(bufferDescriptorIncident, /two independent binding lanes/u);
  assert.match(bufferDescriptorIncident, /must not be rewritten or described as bound\s+to the newer recovery source/u);
  assert.match(bufferDescriptorIncident, /direct one-parent, data-only\s+successor commit `B`/u);
  assert.match(bufferDescriptorIncident, /does not bind installed `node_modules` bytes/u);
  assert.match(bufferDescriptorIncident, /not a general retry path/u);
  assert.match(bufferDescriptorIncident, /not a transaction receipt,[\s\S]*deployment proof,[\s\S]*Mainnet authorization/u);
});

test("current partial-buffer override admits only the separately bound 54,720 successor lane", () => {
  const buffer = "564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH";
  const partial = "c8b842bae57c2f23da0de4219ab879147971a0dafeda8755f6a90e8ca5db0dd3";
  const target = "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01";
  const phrase = `AUTHORIZE-DEVNET-IN-PLACE-BUFFER-CONTINUATION-${buffer}-FROM-54720-OF-649680-CURRENT-${partial}-TARGET-${target}`;
  for (const exact of [
    "Current partial-buffer override — 54,720-byte successor only",
    "IAT_V2_DEVNET_BUFFER_PARTIAL_UPLOAD_INCIDENT_20260828.md",
    "IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_INCIDENT_20260831.md",
    "IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_54720_INCIDENT_20260831.md",
    buffer,
    partial,
    target,
    phrase,
    "490807312",
    "bceff73e737dee68f812e7d73c3554d30e08b899ca723e08a798b2275609f429",
    "IAT_V2_CLEAN_ENVIRONMENT=iat-v2-devnet-buffer-in-place-continuation-from-54720-v1",
    "scripts/continue-iat-v2-devnet-buffer-in-place-from-54720.sh",
    "/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-continuation-from-54720-v1/attempt-one-use",
    "scripts/continue-iat-v2-devnet-buffer-in-place-from-35520.sh",
    "/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-continuation-from-35520-v1/attempt-one-use",
    "scripts/recover-iat-v2-devnet-buffer-in-place.sh",
    "/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-recovery-v1/attempt-one-use",
  ]) assert.ok(runbook.includes(exact), `runbook must retain continuation boundary: ${exact}`);
  assert.match(runbook, /rebuild-iat-v2-devnet-buffer-fresh\.sh[\s\S]*recover-iat-v2-devnet-buffer-pre-address\.sh[\s\S]*recover-iat-v2-devnet-buffer-in-place\.sh[\s\S]*permanently consumed[\s\S]*continue-iat-v2-devnet-buffer-in-place-from-35520\.sh[\s\S]*must not run again/iu);
  assert.match(runbook, /Do not pass `564X…1GHH` to the handoff helper[\s\S]*full `771c…8a01` artifact/u);
  assert.match(runbook, /observed\s+differing region and Agave chunk-rewrite semantics/u);
  assert.match(runbook, /7bc9c805218ca06769956e2cb61601329f5a0f6c/u);
  assert.match(runbook, /skips matching chunks,[\s\S]*queues every differing chunk in full/u);
  assert.match(runbook, /pinned-source semantics only[\s\S]*neither prove that this helper executed/u);
  assert.match(runbook, /may sign, re-sign, send, and resend multiple deployer-key[\s\S]*Devnet chunk transactions/u);
  assert.match(runbook, /never reads, copies, digests, or passes the protected buffer signer/u);
  assert.match(runbook, /does not prompt the Model T/u);
  assert.match(runbook, /explicit QUIC TPU submission[\s\S]*1,500-second process timeout[\s\S]*--max-sign-attempts 20/u);
  assert.match(runbook, /DO NOT RERUN OR RESEND/u);
  assert.match(runbook, /only safe public claim before exact success[\s\S]*integrity gate kept promotion on HOLD/u);
  assert.match(partialBufferIncident, /partial-state hash[^\n]*incident evidence only/u);
  assert.match(continuationIncident, /FIRST IN-PLACE LANE CONSUMED/u);
  assert.match(continuationIncident, /well-formed monotonic `PARTIAL_EXACT_PREFIX_ZERO_TAIL` result[\s\S]*DO NOT\s+RERUN/u);
  assert.match(continuation54720Incident, /SECOND IN-PLACE LANE CONSUMED/u);
  assert.match(continuation54720Incident, /evidenceFile: null[\s\S]*does not turn the partial buffer into a[\s\S]*successful upload/u);
  assert.doesNotMatch(runbook, /c8b842bae57c2f23da0de4219ab879147971a0dafeda8755f6a90e8ca5db0dd3[^\n]*(?:acceptable artifact|ready for handoff|deployment complete)/iu);
  const override = runbook.indexOf("Current partial-buffer override");
  const inPlace = runbook.indexOf("scripts/continue-iat-v2-devnet-buffer-in-place-from-54720.sh", override);
  const handoff = runbook.indexOf("scripts/handoff-iat-v2-devnet-buffer.sh", inPlace);
  assert.ok(override >= 0 && inPlace > override && handoff > inPlace);
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
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_11",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_12",
    "SETTLE_STANDARD_POSITION_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_11",
    "SETTLE_STANDARD_POSITION_WEEK_12",
    "SETTLE_STANDARD_POSITION_WEEK_13",
    "SETTLE_LINKED_POSITION_2_WEEK_9",
    "SETTLE_LINKED_POSITION_2_WEEK_10",
    "SETTLE_LINKED_POSITION_2_WEEK_11",
    "SETTLE_LINKED_POSITION_2_WEEK_12",
    "SETTLE_LINKED_POSITION_3_WEEK_9",
    "SETTLE_LINKED_POSITION_3_WEEK_10",
    "SETTLE_LINKED_POSITION_3_WEEK_11",
    "SETTLE_LINKED_POSITION_3_WEEK_12",
    "CREATE_SWITCHBOARD_RANDOMNESS",
    "COMMIT_CCC_ROUND_13",
    "exactly one terminal action: `REVEAL_CCC_ROUND_13` or",
    "EXPIRE_CCC_ROUND_13",
    "SETTLE_LINKED_POSITION_2_WEEK_13",
    "SETTLE_LINKED_POSITION_3_WEEK_13",
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
    /const FOOTER_SOURCE_LABEL = CANONICAL_ACTION_MODE\s*\? "SOURCE \/\/ SEE ISOLATED ACTION BINDING"\s*: `SOURCE \$\{SOURCE_COMMIT\.slice\(0, 12\)\}`;/u,
  );
  assert.match(admin, /<span>\{FOOTER_SOURCE_LABEL\}<\/span>/u);
  assert.doesNotMatch(admin, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD/u);
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
  assert.match(runbook, /checked-in successor migration snapshot \(`a03fe71d…` \/ `771c…8a01`\)/u);
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

test("24/25 prompts always include a fresh source-bound randomness creation", () => {
  assert.match(runbook, /Plan for exactly \*\*24\*\* mandatory Model T transaction prompts/u);
  assert.match(runbook, /one upgrade, two migrations, four historical neutral backfills, and the 17 feature actions above/u);
  assert.match(runbook, /count becomes \*\*25\*\* only if the fresh finalized pre-upgrade capacity observation proves `EXTEND_PROGRAM_DATA` is required/u);
  assert.match(runbook, /DISCARD RETAINED ADDRESS \+ REQUIRE FRESH CREATE/u);
  assert.match(runbook, /versioned address\/CREATE-signature\/message-hash record stored under the key bound to the exact source commit, migration artifact SHA-256, and mint/u);
  assert.match(runbook, /preserves every receipt and performs no RPC read, signature request, broadcast, or chain mutation/u);
  assert.match(runbook, /independently reconstructs the exact successful finalized two-signer legacy message/u);
  assert.match(runbook, /ComputeBudget-then-pinned-Switchboard instruction roster and message hash/u);
  assert.match(runbook, /retained account at finalized commitment under the pinned Switchboard owner/u);
  assert.match(runbook, /discard control remains disabled after any feature evidence or signed pending feature work exists/u);
  assert.match(runbook, /supports no retained-randomness prompt-count shortcut/u);
  assert.match(runbook, /memory-only on-device address-display gate/u);
  assert.match(runbook, /non-transaction device confirmation and is not one of the 24 mandatory Model T transaction-signature prompts/u);
  assert.match(runbook, /action UI appears before the full on-device address match succeeds, stop without signing or broadcasting/u);
  assert.doesNotMatch(runbook, /may be \*\*23\*\*|verified reusable rehearsal randomness/u);
});

test("runbook freezes the policy-13/CCC-13 pair until its strict POLICY_WEEK close", () => {
  assert.equal(IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP, 1_780_636_775);
  assert.equal(IAT_V2_DEVNET_CEREMONY_POLICY_WEEK, 13);
  assert.equal(IAT_V2_DEVNET_CEREMONY_CCC_ROUND, 13);
  assert.equal(IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP, 1_789_103_975);
  assert.equal(IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP, 1_789_190_375);
  assert.equal(IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP, 1_789_103_975);
  assert.equal(IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC, "2026-09-11T05:19:35.000Z");
  assert.equal(IAT_V2_DEVNET_CEREMONY_HORIZON_TRANSITION, "POLICY_WEEK");
  assert.match(runbook, /source-refresh observation proved the exact cadence transition from CCC round 12 to CCC round 13/u);
  assert.match(runbook, /With Genesis `1780636775`, this source permits exactly the fresh pair policy week \*\*13\*\* and CCC round \*\*13\*\*/u);
  assert.match(runbook, /next policy boundary is \*\*2026-09-11T05:19:35\.000Z\*\* \(`1789103975`\)/u);
  assert.match(runbook, /next CCC boundary is \*\*2026-09-12T05:19:35\.000Z\*\* \(`1789190375`\)/u);
  assert.match(runbook, /strict close is the earlier \*\*POLICY_WEEK\*\* transition at \*\*2026-09-11T05:19:35\.000Z\*\* \(`1789103975`\)/u);
  assert.match(runbook, /Equality is already closed/u);
  assert.match(runbook, /Any finalized policy\/CCC drift or timestamp at or after the close is a permanent HOLD/u);
  assert.match(runbook, /round-13 expiry contingency is valid only if `COMMIT_CCC_ROUND_13` finalizes at least 24 hours before the strict close/u);
  assert.match(runbook, /Otherwise `REVEAL_CCC_ROUND_13` is required/u);
  assert.match(runbook, /exactly one terminal action: `REVEAL_CCC_ROUND_13` or,[^\n]*`EXPIRE_CCC_ROUND_13`/u);
});

test("runbook pins the exact horizon accounting and outcome-dependent conservation values", () => {
  assert.match(runbook, /standard and both linked settled masks must all be `63` \(weeks 8–13\)/u);
  for (const exact of [
    "115,384,615",
    "188,461,538",
    "96,153,845",
    "161,538,461",
    "115,384,614",
    "215,384,615",
    "76,923,076",
    "326923076",
    "726923074",
    "719230766",
    "734615382",
    "39073076926",
    "39080769234",
    "39065384618",
    "199273076926",
    "199280769234",
    "199265384618",
    "470399999998",
    "470392307690",
    "470407692306",
  ]) assert.ok(runbook.includes(exact), `runbook must pin exact horizon accounting value ${exact}`);

  const corePaid = 326_923_076n;
  const coreReserved = 33_673_076_924n;
  const maximumPositionRewards = 5_800_000_000n;
  const outcomes = [
    { positionPaid: [115_384_615n, 188_461_538n, 96_153_845n], lanePaid: 726_923_074n, reserved: 39_073_076_926n, token: 199_273_076_926n, community: 470_399_999_998n },
    { positionPaid: [115_384_615n, 161_538_461n, 115_384_614n], lanePaid: 719_230_766n, reserved: 39_080_769_234n, token: 199_280_769_234n, community: 470_392_307_690n },
    { positionPaid: [115_384_615n, 215_384_615n, 76_923_076n], lanePaid: 734_615_382n, reserved: 39_065_384_618n, token: 199_265_384_618n, community: 470_407_692_306n },
  ];
  for (const outcome of outcomes) {
    const totalPositionPaid = outcome.positionPaid.reduce((sum, amount) => sum + amount, 0n);
    assert.equal(outcome.lanePaid, corePaid + totalPositionPaid);
    assert.equal(outcome.reserved, coreReserved + maximumPositionRewards - totalPositionPaid);
    assert.equal(outcome.token, 200_000_000_000n - outcome.lanePaid);
    assert.equal(outcome.community, 470_000_000_000n + totalPositionPaid);
    assert.equal(
      outcome.token + 150_000_000_000n + 100_000_000_000n + 37_500_000_000n
        + 30_000_000_000n + outcome.community + corePaid + 12_500_000_000n,
      1_000_000_000_000n,
    );
  }
  assert.match(runbook, /cumulative-difference `reward_for_week` rule, not a repeated floor-per-week approximation/u);
  assert.match(runbook, /Each treasury token amount equals the fixed `200000000000` lane total minus its paid amount/u);
  assert.match(runbook, /each outcome conserves the fixed `1000000000000` mint supply/u);
  assert.match(runbook, /Any one-unit drift is HOLD/u);
});

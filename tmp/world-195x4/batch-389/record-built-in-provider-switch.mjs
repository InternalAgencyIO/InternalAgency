#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-389-suriname-polar-airship-checkpoint.json");
const providerRaw = "C:/Users/A/.codex/generated_images/01a01d88-38a1-7763-b74d-470bc7bfe70e/exec-800c9518-feed-4cdc-9ab6-eed50129adaa.png";
const preservedRelative = "tmp/world-195x4/batch-389/raw/pass-1/scene-1576-built-in-provider-superseded-rejected.png";
const preservedPath = path.join(root, preservedRelative);
const scenes = [1576, 1577, 1578, 1579];
const expectedPromptSha256 = {
  1576: "5CBF25B02E097F269D6F27DEB4D0D6E3F29156518561C5EDC7C632BAD254BF68",
  1577: "19B6501D7CC304E345D6D3E336676010C8DDEB2CECB3157D01DDBA1F87B47096",
  1578: "23E945DCC01B6E4A8D7C60FE60EBF079A1419702C1D8BFB1BE4AABA6A566BEF3",
  1579: "F9EE08142B751C1DA268A614D3EE357BB05A80BF1221A20828FF42B024EE8260",
};
const expectedRawSha256 = "11721CC0A26F0579949B7CCE95B73F964784846156B2BF4E151B6A02B6D252CE";
const bankExecCallId = "call_1LgWqkSkPieEqDoRZWFpuZ2w";
const completedCallId = "exec-800c9518-feed-4cdc-9ab6-eed50129adaa";
const launchedAt = "2026-08-20T05:18:33.556Z";
const completedAt = "2026-08-20T05:19:37.587Z";
const providerSwitchAt = "2026-08-20T05:20:34.614Z";
const terminatedAt = "2026-08-20T05:20:39.347Z";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

if (!existsSync(providerRaw)) throw new Error(`Missing completed provider raw: ${providerRaw}`);
const rawBuffer = readFileSync(providerRaw);
if (sha256(rawBuffer) !== expectedRawSha256) throw new Error("Completed provider raw hash mismatch");
mkdirSync(path.dirname(preservedPath), { recursive: true });
if (existsSync(preservedPath)) {
  if (sha256(readFileSync(preservedPath)) !== expectedRawSha256) throw new Error("Existing preserved raw hash mismatch");
} else {
  copyFileSync(providerRaw, preservedPath);
}

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
if (checkpoint.batch !== 389 || checkpoint.country !== "Suriname") throw new Error("Unexpected checkpoint identity");
if ((checkpoint.rejectedPromptLedger?.entries ?? []).length) {
  const ids = new Set(checkpoint.rejectedPromptLedger.entries.map((entry) => entry.entryId));
  if (scenes.every((scene) => ids.has(`batch389-scene${scene}-pass1-provider-switch`))) {
    console.log(JSON.stringify({ mode: "already-recorded", checkpoint: path.relative(root, checkpointPath) }, null, 2));
    process.exit(0);
  }
  throw new Error("Checkpoint already contains unexpected rejected-prompt entries");
}

const promptRecords = Object.fromEntries(scenes.map((scene) => {
  const sourcePath = `tmp/world-195x4/batch-389/scene-${scene}-initial-prompt.txt`;
  const buffer = readFileSync(path.join(root, sourcePath));
  const digest = sha256(buffer);
  if (digest !== expectedPromptSha256[scene]) throw new Error(`Prompt hash mismatch for scene ${scene}`);
  return [scene, {
    sourcePath,
    text: buffer.toString("utf8"),
    sha256: digest,
    encoding: "utf-8",
    bytes: buffer.length,
    chars: buffer.toString("utf8").length,
    fidelity: "runtime-launch-byte-exact",
  }];
}));

const events = scenes.map((scene, index) => scene === 1576 ? {
  scene,
  bankExecCallId,
  callId: completedCallId,
  subcallIndex: index,
  launchedAt,
  occurredAt: completedAt,
  status: "completed-rejected-hard-safety-and-provider-superseded",
  provider: "built-in-imagegen",
  promptPath: promptRecords[scene].sourcePath,
  promptSha256: promptRecords[scene].sha256,
  promptBytes: promptRecords[scene].bytes,
  rawState: "preserved",
  rawPath: preservedRelative,
  rawSha256: expectedRawSha256,
  rawBytes: statSync(preservedPath).size,
  dimensions: [941, 1672],
  hardGateAudit: "Rejected. The handler's index is not visibly straight outside an empty guard, so inert-prop safety is not unambiguous. The output also became provider-superseded when the user required Meta AI only before any acceptance action.",
  acceptedAsset: null,
} : {
  scene,
  bankExecCallId,
  callId: null,
  callIdProvenance: "nested-call-id-not-surfaced-before-parent-exec-termination",
  subcallIndex: index,
  launchedAt,
  occurredAt: terminatedAt,
  status: "client-terminated-for-provider-switch-no-terminal-no-bytes",
  provider: "built-in-imagegen",
  promptPath: promptRecords[scene].sourcePath,
  promptSha256: promptRecords[scene].sha256,
  promptBytes: promptRecords[scene].bytes,
  rawState: "no-bytes",
  rawPath: null,
  rawSha256: null,
  rawBytes: 0,
  terminalProvenance: "No image-generation terminal event and no output file were observed after the user ordered Meta AI only; the parent execution was terminated at the recorded timestamp.",
  acceptedAsset: null,
});

checkpoint.status = "active-pass-2-meta-ai-only-ready-after-interrupted-pass-1";
checkpoint.policy.pass1CandidatesConsumed = 4;
checkpoint.providerPolicy = {
  status: "meta-ai-only",
  effectiveAt: providerSwitchAt,
  userInstruction: "generate images on META AI only from now on",
  builtInGenerationAllowed: false,
  completedBuiltInOutputAccepted: false,
  futureGenerationProvider: "Meta AI",
};
checkpoint.renderPasses.pass1 = {
  ...checkpoint.renderPasses.pass1,
  status: "closed-one-completed-rejected-three-client-terminated-no-bytes",
  candidatesConsumed: 4,
  launchWhenUnlocked: "Pass 1 is closed; no further pass-1 launch is authorized.",
  events,
  submittedNoTerminal: scenes.slice(1),
};
checkpoint.renderPasses.pass2 = {
  ...checkpoint.renderPasses.pass2,
  status: "ready-exactly-four-concurrent-meta-ai-only-holistic-corrections",
  sceneNumbers: scenes,
  candidatesAuthorized: 4,
  candidatesConsumed: 0,
  launchMode: "exactly four concurrent fresh Meta AI candidates from original identity anchors only",
  consolidatedCorrections: [
    "use Meta AI exclusively",
    "preserve secure opaque clearly adult public-fashion coverage and complete plausible anatomy",
    "keep separated silhouettes and isolate the sole inert-prop handler from every person and mascot",
    "show a straight index outside an unmistakably empty guard and a complete safe target/backstop or empty-water marker",
  ],
  thirdPassAllowed: false,
};
checkpoint.rejectedAssets = events.map((event) => ({
  scene: event.scene,
  phase: "pass-1",
  status: event.status,
  bankExecCallId,
  callId: event.callId,
  callIdProvenance: event.callIdProvenance ?? null,
  occurredAt: event.occurredAt,
  provider: event.provider,
  rawState: event.rawState,
  rawPath: event.rawPath,
  sha256: event.rawSha256,
  bytes: event.rawBytes,
  reason: event.hardGateAudit ?? event.terminalProvenance,
}));
checkpoint.rejectedPromptLedger = {
  status: "four-pass-1-nonaccepted-occurrences-exact-text-recorded",
  entries: events.map((event) => ({
    entryId: `batch389-scene${event.scene}-pass1-provider-switch`,
    scene: event.scene,
    phase: "pass-1",
    status: event.status,
    bankExecCallId,
    callId: event.callId,
    callIdProvenance: event.callIdProvenance ?? null,
    subcallIndex: event.subcallIndex,
    launchedAt,
    occurredAt: event.occurredAt,
    provider: event.provider,
    prompt: promptRecords[event.scene],
    rawOutput: {
      state: event.rawState,
      path: event.rawPath,
      sha256: event.rawSha256,
      bytes: event.rawBytes,
    },
    auditRef: `assets/lore/starlight-era/batch-389-suriname-polar-airship-checkpoint.json#/renderPasses/pass1/events/${event.subcallIndex}`,
    source: {
      promptPath: promptRecords[event.scene].sourcePath,
      rawPath: event.rawPath,
      sessionLog: "Codex session 01a01d88-38a1-7763-b74d-470bc7bfe70e; local absolute session path intentionally omitted",
    },
    immutable: true,
  })),
  appendBeforeLaterPassPublicationCommitOrPush: true,
};
checkpoint.hardSafeAcceptedCount = 0;
checkpoint.missingSceneNumbers = scenes;
checkpoint.xPost.status = "ineligible-until-four-of-four-and-git-remote-verification";

writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  mode: "recorded",
  checkpoint: path.relative(root, checkpointPath),
  preservedRaw: preservedRelative,
  rawSha256: expectedRawSha256,
  rejectedPromptEntries: checkpoint.rejectedPromptLedger.entries.length,
  pass2AuthorizedScenes: checkpoint.renderPasses.pass2.sceneNumbers,
  providerPolicy: checkpoint.providerPolicy.status,
}, null, 2));

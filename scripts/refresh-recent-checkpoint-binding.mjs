#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const checkpointPath = process.argv[2];
const ledgerPath = process.argv[3] ?? "assets/lore/starlight-era/world-rejected-prompt-ledger.json";
if (!checkpointPath) throw new Error("Usage: node refresh-recent-checkpoint-binding.mjs <checkpoint> [project-ledger]");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const checkpointBuffer = fs.readFileSync(checkpointPath);
const checkpoint = JSON.parse(checkpointBuffer.toString("utf8"));
const rejectedLedger = checkpoint.rejectedPromptLedger;
if (!rejectedLedger?.appendOnly || !Array.isArray(rejectedLedger.entries) || !rejectedLedger.entries.length) {
  throw new Error(`Checkpoint rejected ledger is absent or empty: ${checkpointPath}`);
}

let exactPromptShaPasses = 0;
for (const entry of rejectedLedger.entries) {
  if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) {
    throw new Error(`Prompt SHA mismatch: ${entry.entryId}`);
  }
  exactPromptShaPasses += 1;
  const raw = entry.rawOutput ?? {};
  if (raw.state === "preserved") {
    if (!raw.path || !fs.existsSync(raw.path)) throw new Error(`Preserved raw missing: ${entry.entryId}`);
    const rawBuffer = fs.readFileSync(raw.path);
    if (sha256(rawBuffer) !== raw.sha256 || rawBuffer.length !== raw.bytes) {
      throw new Error(`Preserved raw provenance mismatch: ${entry.entryId}`);
    }
  } else if (raw.state === "no-bytes") {
    if (raw.path !== null || raw.sha256 !== null || raw.bytes !== 0) throw new Error(`Invalid no-byte provenance: ${entry.entryId}`);
  } else {
    throw new Error(`Unsupported raw state: ${entry.entryId}`);
  }
}

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const recent = ledger.recentCheckpointRejectedEvidence;
if (!recent?.bindings || !recent?.entries) throw new Error("Project ledger recent-checkpoint section is absent");
const bindingIndex = recent.bindings.findIndex((binding) => binding.path === checkpointPath);
if (bindingIndex < 0) throw new Error(`Recent binding not found: ${checkpointPath}`);

const priorEntries = recent.entries.filter((entry) => entry.sourceAudit?.path === checkpointPath);
const priorIds = new Set(priorEntries.map((entry) => entry.entryId));
const nextIds = new Set(rejectedLedger.entries.map((entry) => entry.entryId));
const removedIds = [...priorIds].filter((entryId) => !nextIds.has(entryId));
if (removedIds.length) throw new Error(`Refusing to shrink recent checkpoint history: ${removedIds.join(", ")}`);

const checkpointSha256 = sha256(checkpointBuffer);
const ledgerSha256 = sha256(JSON.stringify(rejectedLedger));
recent.bindings[bindingIndex] = {
  path: checkpointPath,
  batch: checkpoint.batch,
  country: checkpoint.country,
  checkpointSha256,
  ledgerSha256,
  entryCount: rejectedLedger.entries.length,
  exactPromptShaPasses,
};
const retained = recent.entries.filter((entry) => entry.sourceAudit?.path !== checkpointPath);
const rebound = rejectedLedger.entries.map((entry) => ({
  ...entry,
  sourceAudit: {
    sourceKind: "recent-checkpoint-rejected-prompt-ledger",
    path: checkpointPath,
    checkpointSha256,
    ledgerSha256,
    entryId: entry.entryId,
  },
}));
recent.entries = [...retained, ...rebound];
recent.entryCount = recent.entries.length;
if (ledger.summary) ledger.summary.recentCheckpointRejectedPromptCount = recent.entryCount;
ledger.updatedAt = new Date().toISOString();
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  mode: "refreshed-recent-checkpoint-binding",
  checkpointPath,
  checkpointSha256,
  ledgerSha256,
  entryCount: rejectedLedger.entries.length,
  exactPromptShaPasses,
  projectRecentEntryCount: recent.entryCount,
  appendOnlyShrinkPrevented: true,
}, null, 2));

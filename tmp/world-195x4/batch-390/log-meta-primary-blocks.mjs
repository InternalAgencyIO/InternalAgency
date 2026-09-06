#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("Usage: node log-meta-primary-blocks.mjs <local-lexicon-jsonl>");

const blocks = [
  {
    scene: 1580,
    observedAtUtc: "2026-08-20T06:37:13.1029683Z",
    refusal: "I wasn't able to create that exact image as described — the combination of poses, contacts, and the training replica together is too complex to render as a clean, readable full-length editorial.",
  },
  {
    scene: 1581,
    observedAtUtc: "2026-08-20T06:38:54.4139604Z",
    refusal: "I wasn't able to generate that exact 9:16 editorial as described — there's too much overlapping detail in one frame for me to keep everything accurate and readable.",
  },
  {
    scene: 1583,
    observedAtUtc: "2026-08-20T06:37:13.1029683Z",
    refusal: "I wasn't able to create that exact image as described.",
  },
];

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const readRows = () => {
  if (!fs.existsSync(outputPath)) return [];
  return fs.readFileSync(outputPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
};
const rows = readRows();
const seenEventIds = new Set(rows.map((row) => row.eventId).filter(Boolean));
const candidateBlockedPromptIds = new Map();
for (const row of rows) {
  if (row.eventType !== "meta-ai-refusal-token-candidate" || !row.candidate || !row.blockedPromptId) continue;
  if (!candidateBlockedPromptIds.has(row.candidate)) candidateBlockedPromptIds.set(row.candidate, new Set());
  candidateBlockedPromptIds.get(row.candidate).add(row.blockedPromptId);
}

const additions = [];
for (const block of blocks) {
  const primaryPath = `tmp/world-195x4/batch-390/scene-${block.scene}-meta-pass-1-primary.txt`;
  const fallbackPath = `tmp/world-195x4/batch-390/scene-${block.scene}-meta-pass-1-fallback.txt`;
  const primaryText = fs.readFileSync(primaryPath, "utf8");
  const fallbackText = fs.readFileSync(fallbackPath, "utf8");
  const blockedPromptId = sha256(primaryText);
  const sentences = primaryText.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(" ") ?? primaryText;
  const tokens = (sentences.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []).filter(Boolean);
  const candidates = new Set(tokens);
  for (let index = 0; index < tokens.length - 1; index += 1) candidates.add(`${tokens[index]} ${tokens[index + 1]}`);

  const sceneEventId = sha256(`batch390|${block.scene}|primary-refusal|${block.refusal}|${blockedPromptId}`);
  if (!seenEventIds.has(sceneEventId)) {
    additions.push({
      schemaVersion: 1,
      eventId: sceneEventId,
      eventType: "meta-ai-refusal",
      observedAtUtc: block.observedAtUtc,
      batch: 390,
      scene: block.scene,
      attempt: "primary",
      status: "blocked-in-progress-fallback-pending",
      refusalText: block.refusal,
      primaryPromptSha256: blockedPromptId,
      fallbackPromptSha256: sha256(fallbackText),
      suppressionCounter: 0,
      blacklistedTokens: [],
    });
    seenEventIds.add(sceneEventId);
  }

  for (const candidate of candidates) {
    const ids = candidateBlockedPromptIds.get(candidate) ?? new Set();
    ids.add(blockedPromptId);
    candidateBlockedPromptIds.set(candidate, ids);
    const suppressionCounter = ids.size;
    const eventId = sha256(`batch390|${block.scene}|${blockedPromptId}|${candidate}|${block.refusal}`);
    if (seenEventIds.has(eventId)) continue;
    additions.push({
      schemaVersion: 1,
      eventId,
      eventType: "meta-ai-refusal-token-candidate",
      observedAtUtc: block.observedAtUtc,
      batch: 390,
      scene: block.scene,
      attempt: "primary",
      blockedPromptId,
      candidate,
      refusalText: block.refusal,
      suppressionCounter,
      blacklisted: suppressionCounter >= 3,
    });
    seenEventIds.add(eventId);
  }
}

if (additions.length) fs.appendFileSync(outputPath, `${additions.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
const blacklist = [...candidateBlockedPromptIds.entries()].filter(([, ids]) => ids.size >= 3).map(([candidate]) => candidate).sort();
console.log(JSON.stringify({ mode: "logged", newRows: additions.length, blockedScenes: blocks.map((block) => block.scene), blacklist }, null, 2));

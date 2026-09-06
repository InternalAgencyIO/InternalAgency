import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const promptPath = "tmp/world-195x4/batch-392/scene-1588-meta-successor-g-primary-surface.txt";
const promptText = readFileSync(resolve(root, promptPath), "utf8");
const promptSha256 = createHash("sha256").update(Buffer.from(promptText)).digest("hex").toUpperCase();
const refusalText = "I wasn't able to create that exact portrait for country sequence 1588 this time — the combination of open-terrain lap seating with no bench and the close cheek peck is pushing into an area I can't render as described.";
const observedAtUtc = new Date().toISOString();
const existingText = readFileSync(lexiconPath, "utf8");
const rows = existingText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const counters = new Map();
for (const row of rows) {
  if (!row.candidate) continue;
  const key = row.candidate.toLowerCase();
  counters.set(key, Math.max(counters.get(key) ?? 0, row.suppressionCounter ?? 0));
}
const firstTwoSentences = (promptText.match(/[^.!?]+[.!?]?/g) ?? []).slice(0, 2).join(" ").trim();
const tokens = firstTwoSentences.toLowerCase().match(/[a-z0-9#-]+/g) ?? [];
const candidates = [...new Set([...tokens, ...tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`)])];
const eventBase = `batch-392|scene-1588|successor-g-primary-surface|${promptSha256}|${observedAtUtc}`;
const appended = [];
const refusalEventId = createHash("sha256").update(`${eventBase}|refusal`).digest("hex");
if (!rows.some((row) => row.eventId === refusalEventId)) {
  appended.push({
    schemaVersion: 1,
    eventId: refusalEventId,
    eventType: "meta-ai-refusal",
    observedAtUtc,
    batch: 392,
    scene: 1588,
    attempt: "successor-g-primary-surface",
    blockedPromptId: promptSha256.toLowerCase(),
    promptPath,
    promptSha256,
    exactPromptText: promptText,
    refusalText,
    rawProvenance: "no-media-emitted",
    immutable: true,
  });
}
for (const candidate of candidates) {
  const suppressionCounter = (counters.get(candidate) ?? 0) + 1;
  counters.set(candidate, suppressionCounter);
  appended.push({
    schemaVersion: 1,
    eventId: createHash("sha256").update(`${eventBase}|candidate|${candidate}`).digest("hex"),
    eventType: "meta-ai-refusal-token-candidate",
    observedAtUtc,
    batch: 392,
    scene: 1588,
    attempt: "successor-g-primary-surface",
    blockedPromptId: promptSha256.toLowerCase(),
    candidate,
    refusalText,
    suppressionCounter,
    blacklisted: suppressionCounter >= 3,
  });
}
if (appended.length) writeFileSync(lexiconPath, `${existingText.trimEnd()}\n${appended.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
const blacklisted = [...counters].filter(([, count]) => count >= 3).map(([candidate]) => candidate).sort();
console.log(JSON.stringify({ observedAtUtc, promptSha256, candidateCount: candidates.length, appendedRows: appended.length, blacklistCount: blacklisted.length, newlyRelevantBlacklisted: blacklisted.filter((candidate) => candidates.includes(candidate)) }, null, 2));

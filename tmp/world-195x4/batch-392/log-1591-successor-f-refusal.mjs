import crypto from "node:crypto";
import fs from "node:fs";

const root = "tmp/world-195x4/batch-392";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const observedAtUtc = "2026-08-20T12:32:40.203Z";
const refusalText = "I couldn't generate that exact frame this time — the pose and wardrobe combination didn't come through.";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const shaLower = (value) => sha256(value).toLowerCase();
const primaryPath = `${root}/scene-1591-meta-successor-f-primary-surface.txt`;
const fallbackPath = `${root}/scene-1591-meta-successor-f-fallback-surface.txt`;
const primaryBytes = fs.readFileSync(primaryPath);
const fallbackBytes = fs.readFileSync(fallbackPath);
const blockedPromptId = sha256(primaryBytes).toLowerCase();
const fallbackPromptSha256 = sha256(fallbackBytes).toLowerCase();
const primaryText = primaryBytes.toString("utf8");
const rows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const promptIdsByCandidate = new Map();
for (const row of rows) {
  if (row.eventType !== "meta-ai-refusal-token-candidate" || !row.candidate || !row.blockedPromptId) continue;
  if (!promptIdsByCandidate.has(row.candidate)) promptIdsByCandidate.set(row.candidate, new Set());
  promptIdsByCandidate.get(row.candidate).add(row.blockedPromptId);
}
const sentences = primaryText.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(" ") ?? primaryText;
const words = sentences.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const candidates = new Set(words);
for (let index = 0; index < words.length - 1; index += 1) candidates.add(`${words[index]} ${words[index + 1]}`);
const seen = new Set(rows.map((row) => row.eventId).filter(Boolean));
const additions = [];
const refusalEventId = shaLower(`batch392|1591|successor-f-primary-surface|${refusalText}|${blockedPromptId}`);
if (!seen.has(refusalEventId)) additions.push({ schemaVersion: 1, eventId: refusalEventId, eventType: "meta-ai-refusal", observedAtUtc, batch: 392, scene: 1591, attempt: "successor-f-primary-surface", status: "blocked-in-progress-fallback-pending", refusalText, primaryPromptSha256: blockedPromptId, fallbackPromptSha256, suppressionCounter: 0, blacklistedTokens: [] });
for (const candidate of candidates) {
  const ids = promptIdsByCandidate.get(candidate) ?? new Set();
  ids.add(blockedPromptId);
  const eventId = shaLower(`batch392|1591|${blockedPromptId}|${candidate}|${refusalText}`);
  if (!seen.has(eventId)) additions.push({ schemaVersion: 1, eventId, eventType: "meta-ai-refusal-token-candidate", observedAtUtc, batch: 392, scene: 1591, attempt: "successor-f-primary-surface", blockedPromptId, candidate, refusalText, suppressionCounter: ids.size, blacklisted: ids.size >= 3 });
}
if (additions.length) fs.appendFileSync(lexiconPath, `${additions.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

const current = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const blacklist = [...new Set(current.filter((row) => row.blacklisted === true && Number(row.suppressionCounter) >= 3 && row.candidate).map((row) => row.candidate.toLowerCase()))];
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const contains = (text, candidate) => { const haystack = tokens(text); const needle = tokens(candidate); for (let i = 0; i <= haystack.length - needle.length; i += 1) if (needle.every((word, offset) => haystack[i + offset] === word)) return true; return false; };
const fallbackText = fallbackBytes.toString("utf8");
const conflicts = blacklist.filter((candidate) => contains(fallbackText, candidate));
if (conflicts.length) throw new Error(`Fallback contains run-blacklisted terms: ${conflicts.join(", ")}`);
console.log(JSON.stringify({ additions: additions.length, blacklistCount: blacklist.length, blockedPromptId, fallbackPromptSha256 }, null, 2));

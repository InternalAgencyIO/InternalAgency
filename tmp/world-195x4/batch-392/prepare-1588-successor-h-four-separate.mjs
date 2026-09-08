import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkpointPath = resolve(root, "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json");
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const readPrompt = (relativePath) => {
  const text = readFileSync(resolve(root, relativePath), "utf8");
  return { path: relativePath, sha256: sha256(Buffer.from(text)), bytes: Buffer.byteLength(text), text, exactText: text };
};

const lexiconBytes = readFileSync(lexiconPath);
const rows = lexiconBytes.toString("utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
const counts = new Map();
for (const row of rows) {
  if (!row.candidate) continue;
  const key = row.candidate.toLowerCase();
  counts.set(key, Math.max(counts.get(key) ?? 0, row.suppressionCounter ?? 0));
}
const blacklisted = [...counts].filter(([, count]) => count >= 3).map(([candidate]) => candidate);
const validate = (prompt) => {
  const tokens = prompt.text.toLowerCase().match(/[a-z0-9#-]+/g) ?? [];
  const singles = new Set(tokens);
  const pairs = new Set(tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`));
  const hits = blacklisted.filter((candidate) => candidate.includes(" ") ? pairs.has(candidate) : singles.has(candidate));
  if (hits.length) throw new Error(`Blacklisted prompt terms remain: ${hits.join(", ")}`);
  if ((prompt.text.match(/Picture (?:Alpha|Beta|Gamma|Delta)(?: instruction)?:/g) ?? []).length !== 4) throw new Error("Prompt lacks four named picture instructions");
  if (!/four separate picture files/i.test(prompt.text)) throw new Error("Prompt lacks four separate file request");
};

const primary = readPrompt("tmp/world-195x4/batch-392/scene-1588-meta-successor-h-primary-four-separate.txt");
const fallback = readPrompt("tmp/world-195x4/batch-392/scene-1588-meta-successor-h-fallback-four-separate.txt");
validate(primary);
validate(fallback);

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.preparedNextDispatches ??= {};
checkpoint.preparedNextDispatches[1588] = {
  phase: "successor-h-four-separate-picture-bundle",
  primary,
  fallback,
  requestedSeparateFiles: 4,
  numberedDetailedVariants: 4,
  collageGridContactSheetMosaicForbidden: true,
  blacklistSnapshotSha256: sha256(lexiconBytes),
  blacklistCount: blacklisted.length,
  faceReferenceUploadOrder: [938, 936, 937],
  faceReferenceShas: [
    "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
    "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
    "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"
  ],
  settingBinding: "protected exterior TRAPPIST-1 e surface under severe wind driven rain plus distant lightning",
  preparedAtUtc: new Date().toISOString()
};
checkpoint.status = "active-continuous-meta-scene-1588-successor-h-four-picture-bundle-prepared-after-remote-parity";
checkpoint.activeMetaLanes = {
  ...(checkpoint.activeMetaLanes ?? {}),
  candidateUnderInspection: "none after remote verified successor-G refusal evidence",
  candidateInFlight: "scene 1588 successor-H four-picture bundle authorized",
  candidateNPlus2Gate: "closed until every successor-H returned file or explicit shortfall is downloaded, archived, classified, pushed and remotely verified",
  requestedOutputsPerCandidate: 4,
  preserveEveryReturnedFileBeforeQa: true
};
checkpoint.rollingState = {
  ...checkpoint.rollingState,
  recordedAt: new Date().toISOString(),
  candidateUnderInspection: "none after remote verified successor-G terminal refusal",
  nextCandidateInFlight: "scene 1588 successor-H four-picture bundle authorized",
  candidateNPlus2Gate: "closed pending per-file successor-H evidence, QA, archive and remote parity"
};
checkpoint.nextMetaBundle = {
  batch: 392,
  scene: 1588,
  phase: "successor-h-four-separate-picture-bundle",
  state: "primary-plus-fallback-materialized-and-blacklist-verified",
  requestedSeparateFiles: 4,
  numberedDetailedVariantsRequired: 4,
  collageGridContactSheetMosaicForbidden: true,
  primaryPromptSha256: primary.sha256,
  fallbackPromptSha256: fallback.sha256,
  blacklistSnapshotSha256: sha256(lexiconBytes),
  providerShortfallRule: "Preserve exactly what arrives and record missing files or combined media without claiming absent files existed."
};

writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ primary, fallback, blacklistSnapshotSha256: sha256(lexiconBytes), blacklistCount: blacklisted.length }, null, 2));

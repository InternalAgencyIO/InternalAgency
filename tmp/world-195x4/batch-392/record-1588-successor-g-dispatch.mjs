import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkpointPath = resolve(root, "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json");
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const prompt = (relativePath) => {
  const text = readFileSync(resolve(root, relativePath), "utf8");
  return { path: relativePath, sha256: sha256(Buffer.from(text)), bytes: Buffer.byteLength(text), text, exactText: text };
};

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
const event = {
  eventId: "batch-392-scene-1588-successor-g-primary-surface-reference-dispatched",
  batch: 392,
  scene: 1588,
  provider: "Meta AI",
  phase: "successor-g-primary-surface",
  sentAtUtc: "2026-08-20T13:08:05.839Z",
  immediateResponseObservedAtUtc: "2026-08-20T13:08:06.000Z",
  prompt: prompt("tmp/world-195x4/batch-392/scene-1588-meta-successor-g-primary-surface.txt"),
  fallbackPrompt: prompt("tmp/world-195x4/batch-392/scene-1588-meta-successor-g-fallback-surface.txt"),
  blacklistSnapshotSha256: sha256(readFileSync(lexiconPath)),
  referenceImageShas: [
    "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
    "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
    "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
  ],
  referenceUploadOrder: [938, 936, 937],
  referenceTransferState: "transferred-and-visible-in-composer-before-send",
  immediateResponseText: "I'm arranging the three women on open alien ground with no furniture, keeping the lap-seated pose, full bodies, heels, and diagonal motion while honoring the reference faces.",
  responseClassification: "non-refusal-in-progress",
  rawState: "no-bytes-in-progress",
  immutable: true,
};
checkpoint.metaDispatches ??= [];
const index = checkpoint.metaDispatches.findIndex((entry) => entry.eventId === event.eventId);
if (index >= 0) checkpoint.metaDispatches[index] = event;
else checkpoint.metaDispatches.push(event);
checkpoint.status = "active-continuous-meta-scene-1588-successor-g-in-flight";
checkpoint.activeMetaLanes.candidateInFlight = "scene 1588 successor-G primary in flight; no other unresolved Meta lane";
checkpoint.activeMetaLanes.candidateUnderInspection = "none until successor-G emits bytes or refusal evidence";
checkpoint.activeMetaLanes.candidateNPlus2Gate = "closed until successor-G evidence and QA are archived and remotely verified";
checkpoint.rollingState.recordedAt = "2026-08-20T13:08:06.000Z";
checkpoint.rollingState.nextCandidateInFlight = "scene 1588 successor-G primary";
checkpoint.rollingState.candidateNPlus2Gate = "closed pending successor-G evidence, QA, archive and remote parity";
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ eventId: event.eventId, promptSha256: event.prompt.sha256, fallbackSha256: event.fallbackPrompt.sha256, blacklistSnapshotSha256: event.blacklistSnapshotSha256 }, null, 2));

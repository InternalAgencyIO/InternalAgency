import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const primaryPath = "tmp/world-195x4/batch-392/scene-1588-meta-successor-h-primary-four-separate.txt";
const fallbackPath = "tmp/world-195x4/batch-392/scene-1588-meta-successor-h-fallback-four-separate.txt";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
const promptRecord = (path) => {
  const text = readFileSync(path, "utf8");
  return { path, sha256: sha256(Buffer.from(text)), bytes: Buffer.byteLength(text), text, exactText: text };
};

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
const eventId = "batch-392-scene-1588-successor-h-four-separate-picture-bundle-dispatched";
checkpoint.providerDispatches ??= [];
if (!checkpoint.providerDispatches.some((entry) => entry.eventId === eventId)) {
  checkpoint.providerDispatches.push({
    eventId,
    batch: 392,
    scene: 1588,
    provider: "Meta AI",
    phase: "successor-h-four-separate-picture-bundle",
    sentAtUtc: "2026-08-20T13:42:03.854Z",
    immediateResponseObservedAtUtc: "2026-08-20T13:42:11.400Z",
    immediateResponseText: "I'm mapping the standing poses and hand placements for all four figures, making sure each silhouette, limb, and facial likeness stays clear and distinct.",
    responseClassification: "non-refusal-in-progress",
    requestedSeparateFiles: 4,
    returnedFilesAtImmediateRead: 0,
    galleryCountBeforeDispatch: 5,
    primaryPrompt: promptRecord(primaryPath),
    fallbackPrompt: promptRecord(fallbackPath),
    blacklistSnapshotSha256: sha256(readFileSync(lexiconPath)),
    faceReferenceUploadOrder: [938, 936, 937],
    faceReferenceShas: [
      "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
      "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
      "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"
    ],
    uploadOutcome: "three authorized historical references attached exactly once in required order",
    rawState: "no-bytes-in-progress",
    immutable: true
  });
}
checkpoint.status = "active-continuous-meta-scene-1588-successor-h-four-picture-bundle-in-progress";
checkpoint.activeMetaLanes = {
  ...(checkpoint.activeMetaLanes ?? {}),
  candidateInFlight: "scene 1588 successor-H primary four-picture bundle in progress",
  candidateNPlus2Gate: "closed until every successor-H returned file or explicit output shortfall is preserved and classified"
};
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ eventId, sentAtUtc: "2026-08-20T13:42:03.854Z", responseClassification: "non-refusal-in-progress" }, null, 2));

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const profilePath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_active_suppression_profile.json";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"
];
const specs = [
  { tab: 1, sentAtUtc: "2026-08-20T14:07:58.340Z", galleryBefore: 8, immediate: "I'm noting the exact outfits, sequined minis, and RAZE knee-highs for each character so the scene stays consistent and fully covered." },
  { tab: 2, sentAtUtc: "2026-08-20T14:07:58.363Z", galleryBefore: 6, immediate: "I'm cropping in for a tighter, more intimate frame that spotlights the five people, sharpening the couture embroidery and fabric textures while softly blurring the background to keep the landscape hinted but out of focus." },
  { tab: 3, sentAtUtc: "2026-08-20T14:07:58.317Z", galleryBefore: 7, immediate: "I'm updating the pose so Radiance reclines across Alia's lap while Ellie and AI ECE take their positions, making sure the new RAZE knee-highs and uncovered legs match the latest spec." },
  { tab: 4, sentAtUtc: "2026-08-20T14:07:58.376Z", galleryBefore: 9, immediate: "I'm assembling the final prompt for a vertical 9:16 cinematic shot, placing the four women on a futuristic alien terrace with rain, neon sequins, and dynamic poses as I lock in lighting, composition, and details before generating." }
];
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.metaDispatches ??= [];
const profileSha256 = sha256(readFileSync(profilePath));
const addUnique = (array, key, value) => {
  const index = array.findIndex((entry) => entry[key] === value[key]);
  if (index >= 0) array[index] = value;
  else array.push(value);
};
for (const spec of specs) {
  const primaryPath = `tmp/world-195x4/batch-392/scene-1588-meta-successor-i-tab-${spec.tab}-primary.txt`;
  const fallbackPath = `tmp/world-195x4/batch-392/scene-1588-meta-successor-i-tab-${spec.tab}-fallback.txt`;
  const primaryText = readFileSync(primaryPath, "utf8");
  const fallbackText = readFileSync(fallbackPath, "utf8");
  addUnique(checkpoint.metaDispatches, "eventId", {
    eventId: `batch-392-scene-1588-successor-i-tab-${spec.tab}-primary-dispatched`,
    batch: 392,
    scene: 1588,
    provider: "Meta AI",
    phase: `successor-i-tab-${spec.tab}-primary`,
    sentAtUtc: spec.sentAtUtc,
    immediateResponseObservedAtUtc: "2026-08-20T14:08:05.000Z",
    immediateResponseText: spec.immediate,
    responseClassification: "non-refusal-in-progress",
    galleryCountBeforeDispatch: spec.galleryBefore,
    outputsRequested: 1,
    primaryPrompt: { path: primaryPath, sha256: sha256(Buffer.from(primaryText)), bytes: Buffer.byteLength(primaryText), text: primaryText, exactText: primaryText },
    fallbackPrompt: { path: fallbackPath, sha256: sha256(Buffer.from(fallbackText)), bytes: Buffer.byteLength(fallbackText), text: fallbackText, exactText: fallbackText },
    activeSuppressionProfileSha256: profileSha256,
    referenceImageShas: sourceImageShas,
    referenceTransferState: "transferred-and-visible-in-composer-before-concurrent-send",
    rawState: "no-bytes-in-progress",
    immutable: true
  });
}
checkpoint.status = "active-continuous-meta-scene-1588-successor-i-four-tabs-in-progress";
checkpoint.activeMetaLanes = {
  ...(checkpoint.activeMetaLanes ?? {}),
  candidateUnderInspection: "successor-H four archived mission-static lineups",
  candidateInFlight: "successor-I four distinct primary prompts concurrently in flight across tabs 1 through 4",
  candidateNPlus2Gate: "closed independently per tab until raw or no-bytes provenance is captured and QA completes"
};
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ profileSha256, dispatchedTabs: specs.map(({ tab, sentAtUtc, galleryBefore }) => ({ tab, sentAtUtc, galleryBefore })) }, null, 2));

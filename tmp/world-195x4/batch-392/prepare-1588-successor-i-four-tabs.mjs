import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const contractPath = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const profilePath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_active_suppression_profile.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const profileBytes = readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));
if (!profile.active || profile.activeTerms.length !== 20) throw new Error("Active suppression profile must contain exactly twenty terms");
const termSet = profile.activeTerms.map((term) => term.toLowerCase());
const readPrompt = (path) => {
  const text = readFileSync(path, "utf8");
  const tokens = text.toLowerCase().match(/[a-z0-9#-]+/g) ?? [];
  const singles = new Set(tokens);
  const pairs = new Set(tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`));
  const hits = termSet.filter((term) => term.includes(" ") ? pairs.has(term) : singles.has(term));
  if (hits.length) throw new Error(`${path} contains active terms requiring rewrite: ${hits.join(", ")}`);
  if (!/Create exactly one vertical/i.test(text)) throw new Error(`${path} does not request exactly one image`);
  if (/four separate picture files/i.test(text)) throw new Error(`${path} still requests a four-file bundle`);
  return { path, sha256: sha256(Buffer.from(text)), bytes: Buffer.byteLength(text), text, exactText: text };
};

const lanes = [1, 2, 3, 4].map((tab) => ({
  tab,
  primary: readPrompt(`tmp/world-195x4/batch-392/scene-1588-meta-successor-i-tab-${tab}-primary.txt`),
  fallback: readPrompt(`tmp/world-195x4/batch-392/scene-1588-meta-successor-i-tab-${tab}-fallback.txt`),
  bolderPublicSafeStaging: tab === 1 || tab === 3
}));
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
const contractBytes = readFileSync(contractPath);
checkpoint.contractSha256 = sha256(contractBytes);
checkpoint.status = "active-continuous-meta-scene-1588-successor-i-four-distinct-tab-prompts-prepared-awaiting-archive-and-remote-parity";
checkpoint.fourTabConcurrentPromptPolicy = JSON.parse(contractBytes.toString("utf8")).rapidConsolidatedRenderPolicy.metaAiContinuousRollingRenderPolicy.fourTabConcurrentPromptPolicy;
checkpoint.activeSuppressionProfile = {
  path: "outputs/meta5_active_suppression_profile.json",
  sha256: sha256(profileBytes),
  activeTermCount: profile.activeTerms.length,
  activeTerms: profile.activeTerms,
  rewriteMap: profile.rewriteMap,
  fullLexiconSha256: sha256(readFileSync(lexiconPath)),
  fullLexiconRemainsAppendOnly: true,
  rewriteNeverDelete: true
};
checkpoint.preparedFourTabDispatch = {
  batch: 392,
  scene: 1588,
  phase: "successor-i-four-distinct-prompts-across-four-tabs",
  preparedAtUtc: new Date().toISOString(),
  tabCount: 4,
  promptCount: 4,
  outputsRequestedPerPrompt: 1,
  concurrentDispatchRequired: true,
  lanes,
  faceReferenceUploadOrder: [938, 936, 937],
  faceReferenceShas: [
    "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
    "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
    "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"
  ],
  missionDistinctness: [
    "supported seated cuddle plus cheek affection plus calm jealousy",
    "hand catch plus side hug plus behind hug plus floor-height action",
    "supported head rest plus face framing plus high oblique affection",
    "canted moving behind hug plus temple affection plus foreground heel"
  ]
};
checkpoint.nextMetaBundle = {
  batch: 392,
  scene: 1588,
  phase: "successor-i-four-distinct-prompts-across-four-tabs",
  state: "four-primary-and-four-fallback-prompts-materialized-and-active-profile-verified",
  promptCount: 4,
  tabCount: 4,
  outputsRequestedPerPrompt: 1,
  noSingleTabFourOutputRequest: true,
  downloadEveryOutputFirst: true
};
checkpoint.activeMetaLanes = {
  ...(checkpoint.activeMetaLanes ?? {}),
  candidateUnderInspection: "successor-H four preserved mission-static lineups awaiting archive barrier",
  candidateInFlight: "successor-I four distinct tab prompts prepared but not dispatched",
  candidateNPlus2Gate: "closed until successor-H evidence and successor-I preflight are committed, pushed and remotely verified"
};
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ profileSha256: sha256(profileBytes), contractSha256: checkpoint.contractSha256, lanes: lanes.map(({ tab, primary, fallback, bolderPublicSafeStaging }) => ({ tab, primarySha256: primary.sha256, fallbackSha256: fallback.sha256, bolderPublicSafeStaging })) }, null, 2));

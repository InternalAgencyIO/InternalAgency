import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const sourcePromptPath = path.join(root, "scene-1551-clean-fresh-round-17-prompt.txt");
const retryPromptPath = path.join(root, "scene-1551-clean-fresh-round-17-safety-retry-prompt.txt");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 17 safety retry");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 17 safety retry");
}
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-17-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

let prompt = fs.readFileSync(sourcePromptPath, "utf8");
prompt = prompt.replace(
  "Use case: photorealistic-natural.",
  "Use case: photorealistic-natural. This is a conservative, fully clothed, public daytime fashion editorial with a respectful full-body camera and no sensual posing.",
);
prompt = prompt.replaceAll("rigid opaque side-bust coverage", "rigid opaque wraparound side-panel coverage");
prompt = prompt.replaceAll("exposed side breast, or cleavage", "any gap in the continuous side-panel coverage");
prompt = prompt.replace(
  "All garments are fully opaque and public-safe with complete bust, hip, and seat coverage. Rolled midriff, strapless, and open-back details are restrained runway tailoring. Each woman has a different silhouette, construction, material language, motif technique, hem architecture, and footwear. No lingerie, swimwear, transparent intimate area, exposed undergarment, fetish styling, matching mini-dress set, matching two-piece set, repeated map print, palette-swapped copy, cleavage-focused lens, erotic framing, or intimate close-up.",
  "All garments are fully opaque, fully lined, and conservative public-fashion couture with complete torso and lower-body coverage. The rolled midriff, strapless, and open-back details remain restrained architectural runway tailoring. Each woman has a different silhouette, construction, material language, motif technique, hem architecture, and footwear. Use a respectful eye-level full-body editorial camera throughout.",
);
prompt = prompt.replace(
  "Alia's secure strapless copper front is visibly opaque from sternum through both side-bust panels, with no exposed breast, side breast, nipple, under-bust, cleavage, transparent area, or skin gap; the opaque side panels end before the fully open back.",
  "Alia's secure high-cut strapless copper front and wide wraparound side panels form one continuous opaque tailored structure; the opaque side panels end cleanly before the rolled open-back architecture.",
);
prompt = prompt.replace(
  "Compound-love roll 28: ECE sits close against Radiance's side with Radiance's arm around her back; ECE gives Ellie a cheek peck while Alia kneels beside them and rests both hands over their joined hands.",
  "Compound-love roll 28: ECE stays close at Radiance's side while giving Ellie a warm cheek greeting; Alia answers from beside them. This stored emotional influence is resolved physically only through the exact eight-hand inventory below.",
);

const forbiddenTerms = ["breast", "nipple", "cleavage", "under-bust", "lingerie", "fetish", "erotic", "intimate area"];
for (const term of forbiddenTerms) {
  if (prompt.toLowerCase().includes(term)) throw new Error(`Unsafe redundant term remains in retry prompt: ${term}`);
}

const safetyDirective = `\n\nPUBLIC-FASHION CLARITY\nEvery adult is fully clothed in secure opaque couture suitable for a public magazine cover. The controlled dance dip is athletic and stable, with neutral full-body framing. Keep faces, hands, garment engineering, Batumi landmarks, and the safe cinema-training demonstration as the editorial focus.`;
prompt = `${prompt}${safetyDirective}`;
fs.writeFileSync(retryPromptPath, prompt, "utf8");

const promptAudit = {
  path: path.relative(repo, retryPromptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  sourcePromptPath: path.relative(repo, sourcePromptPath).replaceAll("\\", "/"),
  sourcePromptSha256: sha256File(sourcePromptPath),
  storedRollsChanged: false,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  priorLaunchProducedRawAsset: false,
  visualPassBudgetConsumedByPriorLaunch: false,
  changeScope: "positive conservative public-fashion wording only",
};
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-17-safety-retry-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.scenePlans["1551"].freshRound17SafetyRetry = { ...promptAudit, prompt };
checkpoint.renderAttempts.freshRound17 = {
  ...checkpoint.renderAttempts.freshRound17,
  status: "safety-retry-materialized-pending-launch",
  initialLaunch: {
    status: "output-safety-rejected-before-asset",
    rawAssetProduced: false,
    visualPassBudgetConsumed: false,
    category: "sexual",
  },
  safetyRetry: {
    status: "materialized-pending-launch",
    preparedAt,
    promptAudit,
    sourceReferences: checkpoint.scenePlans["1551"].freshRound17.referenceAudit,
  },
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  eligibleBacklogRemaining: 0,
  reconciliationDecision: "Honduras remains publicly verified. Georgia remains X-blocked while the no-asset round 17 safety retry is pending.",
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-17-safety-retry-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));

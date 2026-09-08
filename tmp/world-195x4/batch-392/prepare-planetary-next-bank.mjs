#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const root = "tmp/world-195x4/batch-392";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const writePrompt = (path, text) => {
  fs.writeFileSync(path, `${text.trim()}\n`, "utf8");
  const bytes = fs.readFileSync(path);
  return { path, text: bytes.toString("utf8"), sha256: sha256(bytes), bytes: bytes.length, encoding: "utf8", fidelity: "runtime-launch-byte-exact" };
};
const recordPrompt = (path) => {
  const bytes = fs.readFileSync(path);
  return { path, text: bytes.toString("utf8"), sha256: sha256(bytes), bytes: bytes.length, encoding: "utf8", fidelity: "runtime-launch-byte-exact" };
};

const faceMap = `Radiance, Ellie, Alia and AI ECE are four distinct fictional adult women, each exactly age 21. Preserve the historical face map in every view: Alia is far left with voluminous natural curls; blonde Radiance is second; dark-haired Ellie is third; dark-haired ECE is far right. Scenes 938, 936 and 937 define the same faces, skin tones, facial geometry and name ownership. Keep four women with no duplicate, substitution, merge or age shift.`;
const coverage = `All garments are secure, lined and opaque across bust, seat, pelvis and intimate areas. Every woman has two traceable arms and hands, two complete legs and feet, separated silhouettes, visible joints, a clear task for each hand and complete footwear. No accidental exposure, underwear view, coercion, sexual activity, gross anatomy defect, extra person, watermark or visible text beyond exact RAZE sock marks.`;
const raze1589 = `Exactly Radiance and Ellie wear complete opaque rainbow-gradient RAZE knee-high pairs directly on uncovered legs. Radiance has the text-free sixteen-point Split-Star at the left outer upper calf and the angular RAZE wordmark horizontally at the right outer upper calf; Ellie reverses those sides. Alia and ECE have bare lower legs. Keep uninterrupted skin above each sock band and no trousers, leggings, tights or long underlayers.`;
const raze1590 = `Exactly Radiance and ECE wear complete opaque rainbow-gradient RAZE knee-high pairs directly on uncovered legs. Radiance has the text-free sixteen-point Split-Star at the left outer upper calf and the angular RAZE wordmark vertically at the right outer calf; ECE reverses those sides. Ellie and Alia have bare lower legs. Keep uninterrupted skin above each sock band and no trousers, leggings, tights or long underlayers.`;
const raze1591 = `Exactly Ellie and Alia wear complete opaque rainbow-gradient RAZE knee-high pairs directly on uncovered legs. Ellie has the text-free sixteen-point Split-Star at the left outer upper calf and the angular RAZE wordmark horizontally at the right outer upper calf; Alia reverses those sides. Radiance and ECE have bare lower legs. Keep uninterrupted skin above each sock band and no trousers, leggings, tights or long underlayers.`;

const prompts = {
  1589: {
    primary: `Render Maldives Scene 1589 as a vertical 1152 by 2048 realistic cinematic fashion image. ${faceMap}

This scene takes place inside a protected research habitat associated with the real NASA-catalog exoplanet Kepler-186 f. Lock deep violet dusk with a bright horizon band and readable faces. Maldives reads through a large speculative cultural installation based on Fuvahmulah, Thoondu white surf, palm rim, kilhi wetland contours, reef arcs and cupola ribs; never imply that the Earth island physically exists on this planet.

Frame a close floor-adjacent front-quarter fashion angle toward complete heels, uncovered legs, opaque hem side seams, torsos and faces. Keep the lens outside garment volume and away from the space between legs. Ellie turns inside Radiance's behind hug and gives Radiance a brief closed-mouth cheek peck. Alia catches Ellie's free hand with a calm jealous raised brow. ECE closes through a side-hug eye-line while holding a small closed gold route lantern safely in both hands. Omit every large calibration frame.

${raze1589} Dress the quartet in distinct sequined strapless, cropped or open-back cocktail minis, tailored mini skorts and short rompers carrying large Thoondu, reef, kilhi and mangrove motifs. ${coverage}`,
    fallback: `Render a simplified Maldives Scene 1589 vertical realistic fashion image inside the protected Kepler-186 f habitat at deep violet dusk. ${faceMap} Show a close low front-quarter angle with complete bodies and heels. Radiance gives Ellie a behind hug; Ellie gives Radiance a brief cheek peck; Alia catches Ellie's hand with the calm jealous look; ECE holds a small closed gold lantern. ${raze1589} Keep secure opaque cocktail minis and large Fuvahmulah, Thoondu, reef and kilhi motifs. Omit every calibration frame. ${coverage}`,
  },
  1590: {
    primary: `Render Maldives Scene 1590 as a vertical 1152 by 2048 realistic cinematic fashion image. ${faceMap} Add the established clearly adult athletic bearded man behind ECE without replacing any woman.

This scene takes place inside a protected research habitat associated with the real NASA-catalog exoplanet TOI-700 d. Lock golden-hour sunrise with long warm rays and readable faces. Maldives reads through a large speculative cultural installation based on Addu's horseshoe lagoon, linked-island causeway, reef passes, seagrass channels and solar facets; never imply that the Earth atoll physically exists on this planet.

Make a close high-oblique view with a mild Dutch roll and diagonal foreshortening. Alia settles sideways across Radiance's stable lap on a broad bench while Ellie gives Alia a brief closed-mouth temple peck. Radiance supports Alia through a warm side hug. ECE shows the calm jealous eye-line; the bearded man behind her returns his strongest gaze to ECE. ECE holds a small closed gold route lantern safely in both hands. Omit every large calibration frame.

${raze1590} Dress the quartet in distinct secure sequined strapless, cropped or open-back cocktail minis, tailored mini skorts and short rompers carrying large Addu lagoon, causeway, reef and seagrass motifs. ${coverage}`,
    fallback: `Render a simplified Maldives Scene 1590 vertical realistic fashion image inside the protected TOI-700 d habitat at golden-hour sunrise. ${faceMap} Keep the bearded adult man behind ECE. Show a close high-oblique Dutch view with complete bodies and heels. Alia sits safely across Radiance's lap; Ellie gives Alia a brief temple peck; Radiance supports Alia; ECE shows calm jealousy while holding a small closed gold lantern. ${raze1590} Keep secure opaque cocktail minis and large Addu horseshoe, causeway, reef and seagrass motifs. Omit every calibration frame. ${coverage}`,
  },
  1591: {
    primary: `Render Maldives Scene 1591 as a vertical 1152 by 2048 realistic cinematic fashion image. ${faceMap}

This scene takes place inside a protected research habitat associated with the real NASA-catalog exoplanet TOI-700 d. Lock deep violet dusk with a bright horizon band and readable faces. Maldives reads through a large speculative cultural installation based on Baa micro-atoll rings, lagoon shelves, reef chains, mangrove islets and cupola ribs; never imply that the Earth atoll physically exists on this planet.

Make a strong canted moving portrait. Radiance's blonde face and hair fill the near foreground while her complete heel and opaque skirt side seam stay visible. Ellie steps through Alia's behind hug as Alia gives Ellie a brief closed-mouth cheek peck. Radiance catches Alia's free hand and watches the pair with calm jealousy. ECE answers from close diagonal depth while holding a small closed gold route lantern safely in both hands. Omit every large calibration frame.

${raze1591} Dress the quartet in distinct secure sequined strapless, cropped or open-back cocktail minis, tailored mini skorts and short rompers carrying large Baa micro-atoll, lagoon, reef and mangrove motifs. ${coverage}`,
    fallback: `Render a simplified Maldives Scene 1591 vertical realistic fashion image inside the protected TOI-700 d habitat at deep violet dusk. ${faceMap} Show a strong canted close view with complete bodies and heels. Alia holds Ellie in a behind hug and gives her a brief cheek peck; Radiance catches Alia's hand with the calm jealous look; ECE holds a small closed gold lantern. ${raze1591} Keep secure opaque cocktail minis and large Baa micro-atoll, lagoon, reef and mangrove motifs. Omit every calibration frame. ${coverage}`,
  },
};

const prepared = {};
for (const scene of [1589, 1590, 1591]) {
  prepared[scene] = {
    primary: writePrompt(`${root}/scene-${scene}-meta-successor-d-primary-planetary.txt`, prompts[scene].primary),
    fallback: writePrompt(`${root}/scene-${scene}-meta-successor-d-fallback-planetary.txt`, prompts[scene].fallback),
  };
}
prepared[1588] = { fallback: recordPrompt(`${root}/scene-1588-meta-successor-c-fallback-planetary.txt`) };

const lexiconBytes = fs.readFileSync(lexiconPath);
const lexiconRows = lexiconBytes.toString("utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const blacklist = [...new Set(lexiconRows.filter((row) => row.blacklisted === true && Number(row.suppressionCounter) >= 3 && row.candidate).map((row) => row.candidate.toLowerCase()))].sort();
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const hasCandidate = (text, candidate) => {
  const haystack = tokens(text);
  const needle = tokens(candidate);
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((word, offset) => haystack[index + offset] === word)) return true;
  }
  return false;
};
for (const prompt of Object.values(prepared).flatMap((entry) => Object.values(entry))) {
  const conflicts = blacklist.filter((candidate) => hasCandidate(prompt.text, candidate));
  if (conflicts.length) throw new Error(`${prompt.path} contains run-blacklisted terms: ${conflicts.join(", ")}`);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.preparedRollingPrompts ??= {};
checkpoint.preparedRollingPrompts.planetaryNextBank = prepared;
checkpoint.rollingLexiconSnapshot = {
  ...(checkpoint.rollingLexiconSnapshot ?? {}),
  path: lexiconPath,
  sha256: sha256(lexiconBytes),
  bytes: lexiconBytes.length,
  observedAt: "2026-08-20T10:37:05.548Z",
  blacklist,
};
checkpoint.status = "active-continuous-meta-planetary-next-bank-prepared-awaiting-remote-parity";
checkpoint.rollingState = {
  recordedAt: "2026-08-20T10:37:05.548Z",
  candidateUnderInspection: "none; the refusal and three hard-unusable emitted raws are fully classified",
  nextCandidateInFlight: "none pending archive, ledger verification, commit, explicit push and remote verification",
  candidateNPlus2Gate: "closed until all current outcome evidence and next-bank prompt hashes reach remote parity",
  preparedNextDispatch: "scene 1588 candidate-C fallback plus successor-D primary prompts for scenes 1589, 1590 and 1591",
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: checkpoint.status,
  blacklistCount: blacklist.length,
  lexiconSha256: sha256(lexiconBytes),
  promptShas: Object.fromEntries(Object.entries(prepared).map(([scene, entry]) => [scene, Object.fromEntries(Object.entries(entry).map(([kind, prompt]) => [kind, prompt.sha256]))])),
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
}, null, 2));

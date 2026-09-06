import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",
);
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

const countryRead = {
  1548: "Real Tbilisi is the dominant physical setting: the illuminated Peace Bridge spans the Mtkvari bend, with Old Town balconies, Narikala ridge, and rounded Abanotubani sulfur-bath domes all large and recognizable. This is Georgia, not a Mars landscape. Mars language appears only in couture construction and a few portable field-atelier pieces.",
  1549: "Real Stepantsminda is the dominant physical setting: snow-capped Mount Kazbek, the deep Terek valley, layered Darial cliffs, and clustered town roofs are all large and recognizable. This is Georgia, not a Mars landscape. Mars language appears only in couture construction and a few portable ridge-laboratory pieces.",
  1550: "Real Sighnaghi is the dominant physical setting: complete ochre wall curves and towers, terracotta roofs, the green Alazani vineyard grid, and the Greater Caucasus horizon are all large and recognizable. This is Georgia, not a Mars landscape. Mars language appears only in couture construction and a few portable analysis pieces.",
  1551: "Real Batumi Boulevard is the dominant physical setting: the Black Sea horizon, Alphabet Tower silhouette, Ferris wheel, palms, and modern Adjara skyline are all large and recognizable. This is Georgia, not a Mars landscape. Mars language appears only in couture construction and a few portable observation pieces.",
};

const choreography = {
  1548: "Ellie, Radiance, and Alia form the mandatory three-person slow-dance chain on the left: Ellie has one hand at Radiance's waist and one at Alia's shoulder; Radiance has one hand at Ellie's shoulder and one linked with Alia; Alia has one linked hand and one at Ellie's waist. ECE is the excluded rival in a separate right-side safety lane, looking back toward Radiance while both of ECE's hands remain on the inert training prop. The dance, linked choice, and jealous interruption read first.",
  1549: "Alia supports Ellie in the mandatory controlled dip on the left, with planted feet, one hand at Ellie's waist, and one supporting Ellie's upper back. Ellie has one hand on Alia's shoulder and one held by Radiance. Radiance catches that hand and places her other hand at Ellie's shoulder. ECE answers with a visible invitation from the separate right-side safety lane while both of ECE's hands remain on the inert training prop. The dip and romantic choice read first.",
  1550: "On a stable low bench at far left, Alia sits securely sideways across Radiance's lap in the mandatory fully clothed public-safe lap-sitting choice. Radiance holds the active inflatable geometric weather-balloon pack with both hands. Alia uses one hand at Radiance's shoulder and one linked with Ellie; Ellie uses one linked hand and one at Alia's shoulder. At right, ECE uses both hands on the inert training prop. The adult Scene 1136 male stands behind ECE on the safe side, one hand at ECE's upper arm and one at ECE's waist, with his strongest sustained eye line to ECE and visible shame. All five adults remain fully clothed and stable.",
  1551: "Ellie supports Radiance in the mandatory controlled dip on the left, with one hand at Radiance's waist and one at her upper back. Radiance has one hand on Ellie's shoulder and one at ECE's shoulder. ECE holds the active oversized magnetic compass table with both hands and remains shoulder-to-shoulder with Ellie. Alia answers from the separate right-side safety lane while both of Alia's hands remain on the inert training prop. The dip, affectionate Radiance-ECE center, and Alia's invitation read first.",
};

const rollInfluence = {
  1548: "Romance roll 28 contributes a quick public-safe cheek greeting, shoulder-to-shoulder pursuit, and fingertip attention. Compound-love roll 46 contributes the turning embrace-chain energy and playful blown-kiss eye line. Resolve both through the exact slow-dance hand inventory below without adding another hand contact.",
  1549: "Romance roll 95 contributes the crossing-path weave, linked choice, protective support, and jealous over-shoulder look. Compound-love roll 91 contributes the seated-invitation, close-hug, public-safe cheek-greeting, and beacon-choice energy. Resolve both through the exact controlled-dip hand inventory below without adding another hand contact.",
  1550: "Romance roll 13 contributes the waiting side-hug and wounded-rival glance. Compound-love roll 25 contributes the behind-embrace, public-safe cheek-greeting, linked choice, and direct rival stare. Resolve both through the exact lap-sitting and male-drama hand inventory below without adding another hand contact.",
  1551: "Romance roll 86 contributes the linked spin, waist-steadying protection, and departure choice. Compound-love roll 28 contributes the close side-embrace, public-safe cheek-greeting, and joined-hands invitation. Resolve both through the exact controlled-dip hand inventory below without adding another hand contact.",
};

const lane = {
  1548: "Place the romance group entirely left of and behind ECE's shoulder line. ECE faces right. The photorealistic full-size polished rainbow-gradient inert Desert Eagle-style cinema-training replica has an obvious orange safety plug, no magazine, and no ammunition. Its muzzle points only right toward one clearly empty floating route marker inside a transparent shallow water safety basin, with a complete sand catch wall beyond. Show the full uninterrupted muzzle-to-marker-to-catch-wall line. No person, animal, camera, landmark, path, boat, or occupied object is in front of the muzzle. ECE's trigger finger is visibly straight along the frame outside the guard.",
  1549: "Place the dip group entirely left of and behind ECE's shoulder line. ECE faces right. The photorealistic full-size polished rainbow-gradient inert Desert Eagle-style cinema-training replica has an obvious orange safety plug, no magazine, and no ammunition. Its muzzle points only right toward one plain geometric paper route symbol fixed to a complete thick earth-and-sand catch wall inside a closed transparent-panel training lane. Show the full uninterrupted muzzle-to-paper-to-catch-wall line. No person, animal, camera, landmark, path, vehicle, or occupied object is in front of the muzzle. ECE's trigger finger is visibly straight along the frame outside the guard.",
  1550: "Place the bench trio entirely on the left. Place ECE and the male at center-right, both fully behind the muzzle plane. ECE faces right and the male contacts ECE only from behind on the safe side. The photorealistic full-size polished rainbow-gradient inert Desert Eagle-style cinema-training replica has an obvious orange safety plug, no magazine, and no ammunition. Its muzzle points only right toward one clearly empty floating route marker in a transparent shallow blue safety basin at the far-right edge, with a complete sand catch wall beyond. Show the full uninterrupted muzzle-to-marker-to-catch-wall line. No person, animal, camera, landmark, path, or occupied object is in front of the muzzle. ECE's trigger finger is visibly straight along the frame outside the guard.",
  1551: "Place the dip group and compass holder left of Alia's shoulder line. Alia stands at far right and faces further right. The photorealistic full-size polished rainbow-gradient inert Desert Eagle-style cinema-training replica has an obvious orange safety plug, no magazine, and no ammunition. Its muzzle points only right toward one plain geometric paper route symbol fixed to a complete thick earth-and-sand catch wall inside a closed transparent-panel training lane. Show the full uninterrupted muzzle-to-paper-to-catch-wall line. No person, animal, camera, landmark, path, vehicle, or occupied object is in front of the muzzle. Alia's trigger finger is visibly straight along the frame outside the guard.",
};

const mascot = {
  1548: "Mascot roll 41 is MAX only. Show exactly one small young golden retriever puppy named MAX on a padded dry lounge at far lower-left. Alia is the rolled visual supervisor by eye line only. No kitten and no other animal. MAX stays far from the training lane, water, ledges, hail, and equipment.",
  1549: "Mascot roll 70 is neither. Show no kitten, no puppy, and no other animal.",
  1550: "Mascot roll 60 is neither. Show no kitten, no puppy, and no other animal.",
  1551: "Mascot roll 15 is PAWS plus MAX. Show exactly two animals together on one padded dry lounge at far lower-left: PAWS is one tiny collarless golden kitten, unmistakably a cat; MAX is one distinct small young golden retriever puppy, unmistakably a dog. They share one harmless supervised nose-to-paw play beat. No adult dog, no second dog, no second cat, and no other animal. Ellie is the rolled visual supervisor by eye line only. Both stay far from the training lane, odd prop, sea edge, rain runoff, and equipment.",
};

function safeOutfit(text) {
  return text
    .replaceAll(
      "deeply open-necked bare-arm architectural bodice with no sleeves or neck-covering layer",
      "secure opaque sleeveless architectural bodice with a high public-fashion neckline and complete front coverage",
    )
    .replaceAll(
      "fully strapless secure opaque sculpted bodice with completely bare shoulders and no straps, sleeves, collar, or illusion mesh",
      "secure opaque strapless sculpted bodice with a high straight neckline, complete front coverage, bare shoulders, and no illusion mesh",
    )
    .replaceAll(
      "completely open from shoulder blades to the secure lower-back waistline with no crossing straps, fabric panel, illusion mesh, or hair covering it",
      "open-back couture panel from shoulder blades to a high secure waist, shown from a respectful three-quarter angle, with fully opaque front and sides and no illusion mesh",
    )
    .replaceAll(
      "deliberate narrow visible midriff panel",
      "restrained three-centimeter visible midriff band",
    );
}

function boolWord(active) {
  return active ? "active" : "inactive";
}

function createPrompt(scene, plan) {
  const people = plan.maleModel?.present ? 5 : 4;
  const limbCount = people * 2;
  const outfitLines = Object.entries(plan.outfits)
    .map(([name, value]) => `${name}: ${safeOutfit(value)}.`)
    .join("\n");
  const characterRolls = Object.entries(plan.characters)
    .map(([name, data]) => {
      const emotion = data.emotion.materializedResult ?? data.emotion.result;
      return `${name}: emotion roll ${data.emotion.roll} = ${emotion}; visible-midriff roll ${data.visibleMidriff.roll} = ${boolWord(data.visibleMidriff.active)}; strapless roll ${data.straplessDress.roll} = ${boolWord(data.straplessDress.active)}; fully-open-back roll ${data.fullyOpenBack.roll} = ${boolWord(data.fullyOpenBack.active)}.`;
    })
    .join("\n");
  const odd = plan.interestingProp.active
    ? `Odd-prop roll ${plan.interestingProp.roll} is active. Exactly ${plan.interestingProp.holder.result} holds one ${plan.interestingProp.family.result} with both existing hands; it is inert, secured, nonthreatening, integrated into the relationship beat, and far from mascots and the training lane.`
    : `Odd-prop roll ${plan.interestingProp.roll} is inactive. Do not show the audit-only ${plan.interestingProp.family.result}.`;
  const hosiery = plan.rainbowHosiery.active
    ? `Rainbow-hosiery roll ${plan.rainbowHosiery.roll} is active. Exactly ${plan.rainbowHosiery.wearer.result} wears opaque public-safe knee socks in the selected ${plan.rainbowHosiery.palette.result}; nobody else wears hosiery. Radiance and ECE are the affectionate center, and Alia alone handles the inert training prop.`
    : `Rainbow-hosiery roll ${plan.rainbowHosiery.roll} is inactive. Wearer selector ${plan.rainbowHosiery.wearer.roll} = ${plan.rainbowHosiery.wearer.result} and palette selector ${plan.rainbowHosiery.palette.roll} = ${plan.rainbowHosiery.palette.result} remain audit-only. Nobody wears stockings or knee socks. ECE alone handles the inert training prop.`;
  const male = plan.maleModel?.present
    ? `Male selector is active in this scene only. Add the established clearly adult Scene 1136 bearded male with an opaque fitted short-sleeve top, fitted black jeans, and black boots. Male emotion roll ${plan.maleModel.emotion.roll} = ${plan.maleModel.emotion.result}. Preserve two clear contacts and his strongest sustained eye line to ECE.`
    : "Male selector is inactive. Show no man and no fifth adult.";

  return `Use case: photorealistic-natural.
Asset type: fresh 9:16 full-length World Series public-fashion editorial, fresh render round 2.

PRIMARY SETTING
${countryRead[scene]}
Weather roll ${plan.weather.roll} = ${plan.weather.result}; make it clearly visible while all footing stays dry, stable, and nonslip. Scene mode is ${plan.mode}. Active theme is Mars-surface expedition couture, expressed through garment and portable-set construction only. No copied space-agency, airline, military, police, coast-guard, emergency-service, or official uniform, logo, badge, or insignia.

ADULT CAST AND IDENTITY
Show exactly ${people} clearly adult fictional people, all visibly over 28. Always show the four women: blonde Radiance; dark-haired Ellie; Black Alia with the only high sculptural braided ponytail; brunette AI ECE. Preserve four distinct faces and bodies, no clones, merges, replacements, or age shifts. ${male}

DETERMINISTIC CHARACTER ROLLS
${characterRolls}
Every emotion must read distinctly through face, eye line, torso direction, and posture without caricature.

FOUR DISTINCT COUTURE FINGERPRINTS
${outfitLines}
Keep all garments fully opaque and public-safe, with complete bust, hip, and seat coverage. Rolled midriff, strapless, and open-back details are restrained runway tailoring. No lingerie, swimwear, transparent intimate areas, exposed undergarment, fetish styling, cleavage-focused lens, erotic framing, or intimate close-up. The four women must differ in silhouette, construction, material language, motif technique, hem architecture, and footwear. No palette-swapped copies, matching mini-dress set, matching two-piece set, repeated map print, or color-only differentiation.

MANDATORY LOVE BEAT AND HAND INVENTORY
${rollInfluence[scene]}
Hard-love roll ${plan.hardLoveBeat.roll} = ${plan.hardLoveBeat.result}. ${choreography[scene]}
This clearly adult consensual relationship event is affectionate, fully clothed, stable, non-explicit, and the first read. Use aligned eye lines and at least three clear contacts. No static lineup, generic clustered cheek touching, decorative hand, or interchangeable pose.

MISSION PROP SAFETY
Mission pose-target roll ${plan.poseTargetRoll.roll}; resolved handler = ${plan.resolvedPropHandler}. ${lane[scene]}
The prop drives the safe love-beat interruption and is never decorative or placed on furniture. No firing, ammunition, loose magazine, muzzle flash, reload, holster, threat, injury, combat, person-targeting, animal-targeting, occupied-object targeting, or camera-targeting. ECE's separate holographic route map is hands-free and does not create another hand.

MASCOT AND ODD-PROP ROLLS
${mascot[scene]}
${odd}

OTHER STORED ROLLS
Pole-theme roll ${plan.poleDanceTheme.roll} = inactive; show no pole. Rainbow-only roll ${plan.rainbowOnly.roll} = inactive; do not convert the wardrobe to rainbow-only styling. ${hosiery}
Publishing audit only, not visible text: Georgia, red heart, Honduras, hashtag Georgia, hashtag InternalAgency.

ANATOMY AND FRAME
Eye-level full-body 9:16 group composition, not a low angle. Show all faces, shoulders, elbows, wrists, separated hands, finger clusters, legs, feet, heels, and boots. Exactly ${limbCount} human arms and exactly ${limbCount} human hands, two of each per adult, with every limb continuously traceable to one owner. No hidden-owner arm, extra arm, extra hand, missing limb, duplicate limb, fused hand, floating hand, borrowed hand, emerging hand, ambiguous wrist, malformed finger cluster, crop, or occlusion. Keep the country landmarks and the safe target line large and legible. No readable text, no watermark, no sacred imagery, no literal flag, and no official seal.`;
}

const promptAudit = {};
for (const scene of [1548, 1549, 1550, 1551]) {
  const plan = checkpoint.scenePlans[String(scene)];
  const prompt = createPrompt(scene, plan);
  const outputPath = path.join(root, `scene-${scene}-fresh-round-2-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    freshRound: 2,
    targetCorrections: [
      "real Georgia location remains dominant",
      "complete right-facing empty target and catch-wall line",
      "public-fashion safety phrasing",
      "exact mascot species and count",
    ],
  };
  plan.freshRound2 = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-2-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 0,
  missingSceneNumbers: [1548, 1549, 1550, 1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound2 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [1548, 1549, 1550, 1551],
  concurrency: "four independent built-in image generation calls with all-settled result capture",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit,
  storedRollsChanged: false,
};
checkpoint.xBacklogAudit = {
  checkedAt: preparedAt,
  account: "@dogramaci",
  signedIn: true,
  eligibleBacklogRemaining: 0,
  liveVerified: [
    { country: "Bolivia", url: "https://x.com/dogramaci/status/2087038342894424285", attachments: 3 },
    { country: "Guinea", url: "https://x.com/dogramaci/status/2087085841235550351", attachments: 2 },
    { country: "Tunisia", url: "https://x.com/dogramaci/status/2087086588354261209", attachments: 3 },
    { country: "Belgium", url: "https://x.com/dogramaci/status/2087087399465627713", attachments: 3 },
    { country: "Jordan", url: "https://x.com/dogramaci/status/2087087798968844508", attachments: 3 },
    { country: "Cuba", url: "https://x.com/dogramaci/status/2087088121691169160", attachments: 3 },
    { country: "Czechia", url: "https://x.com/dogramaci/status/2087088332253577528", attachments: 3 },
    { country: "Honduras", url: "https://x.com/dogramaci/status/2087088543499768003", attachments: 3 },
  ],
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-2",
  sceneNumbers: [1548, 1549, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));

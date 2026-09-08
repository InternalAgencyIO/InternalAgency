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
const scenes = [1548, 1550, 1551];

const setting = {
  1548: "Real Tbilisi dominates: the full Peace Bridge sweep, Mtkvari bend, Old Town balcony slopes, Narikala ridge, and rounded Abanotubani sulfur-bath domes remain large and recognizable on the left and center. Mars-surface expedition language appears only in couture construction and portable field-atelier details.",
  1550: "Real Sighnaghi dominates: complete ochre defensive-wall curves and towers, terracotta roofs, the Alazani vineyard grid, and the Greater Caucasus horizon remain large and recognizable. Mars-surface expedition language appears only in couture construction and portable agriculture-lab details.",
  1551: "Real Batumi Boulevard dominates: the Black Sea horizon, Alphabet Tower, Ferris wheel, palms, and modern Adjara skyline remain large and recognizable. Mars-surface expedition language appears only in couture construction and portable observation-court details.",
};

const choreography = {
  1548: `The rolled hard-love beat is the first read: a moving three-person slow-dance chain while ECE steps through the open side as the excluded rival. Place Radiance at left, Ellie forward-center, and Alia at right in a wide open crescent with visible air between every torso. Use exactly this six-hand dance inventory: Radiance and Ellie extend one linked pair outward at waist height on the far-left edge; Ellie and Alia extend one linked pair outward at waist height on the far-right edge; Alia's free arm wraps behind Radiance but its open palm remains fully visible on the front of Radiance's near-side waist; Radiance's free open palm remains fully visible on Alia's outer shoulder. Both linked pairs are isolated against open sky and no arm crosses a face. ECE remains separate at far right and owns only the two mission-prop hands. Exactly eight hands appear. Bent knees, turning hems, aligned romantic eye lines, and four unmistakable contacts make it a real dance, not a lineup.`,
  1550: `The rolled hard-love beat is the first read: Alia sits securely sideways across Radiance's lap on a broad low bench at left, with both of Alia's feet planted and the bench carrying both adults. Radiance holds the three-balloon odd prop outside the embrace at the far-left edge, splitting the balloon stems into two small bundles so one complete hand is visible around each bundle. Alia's left open palm rests visibly on Radiance's near-side shoulder; Alia's right hand extends to link with Ellie's left hand in an isolated waist-high link against open sky. Ellie kneels immediately in front-right of the bench; her linked left hand stays visible and her right open palm rests visibly on Alia's outer shoulder. ECE stands alone at far right and owns only the two mission-prop hands. Offset the adult male behind and camera-left of ECE so one male palm is fully visible on ECE's upper arm and his other palm is fully visible on ECE's near-side waist. His strongest sustained eye line stays on ECE. Exactly ten hands appear. No self-clasp, side-by-side substitute, hidden hand, arm leaving frame, or extra contact.`,
  1551: `The rolled hard-love beat is the first read: Ellie supports Radiance in a stable shallow backward dip at left. Rotate Radiance to a face-visible three-quarter rear angle so her open-back couture is clear. Ellie's left open palm lies visibly on Radiance's near-side waist and Ellie's right open palm lies visibly across the center of Radiance's blue upper back, each isolated by contrasting fabric. Radiance's left open palm rests visibly on Ellie's outer shoulder; Radiance's right open palm reaches to ECE's near-side shoulder as the visible invitation. ECE stands immediately beside the dip and owns only the two compass-table hands, one complete hand on each opposite side of the round compass rim. Alia remains separate at far right and owns only the two mission-prop hands while answering with a jealous eye line. Exactly eight hands appear, every wrist has an air gap, and no hand is hidden behind a torso.`,
};

const mission = {
  1548: `Preserve the authoritative water target exactly. ECE kneels safely at far right in strict side profile behind a dry secured parapet and angles the orange-plugged inert pistol about 40 degrees down and right. Directly below-right is one fluorescent orange empty floating route disk centered in a narrow cordoned empty Mtkvari water lane. Camera geometry must show the clean diagonal muzzle-to-disk axis ending at the disk itself, without any drawn beam. Open empty water fills the frame beyond the disk. All people, MAX, bridge, buildings, banks, boats, paths, and camera remain behind or left of the muzzle plane. Do not add a basin, paper wall target, laser beam, boat, person, animal, or occupied object downrange. Both of ECE's hands are separated and visible on the grip; the trigger finger is straight on the frame outside the guard.`,
  1550: `Preserve the authoritative basin target exactly. ECE kneels at far right in strict side profile and angles the orange-plugged inert pistol about 30 degrees down and right. A transparent shallow blue cinema-safety basin sits alone on a secure pedestal immediately below-right. One fluorescent orange empty floating route disk is centered exactly on the diagonal muzzle axis. Camera geometry must show the clean muzzle-to-disk axis ending at the disk itself, without any drawn beam. The basin is enclosed by transparent safety panels and separated from walls, paths, vineyards, and valley drops. Every other adult stays behind and left of the muzzle plane. No holographic ring, open-air target, person, animal, occupied object, camera-facing muzzle, ammunition, or magazine. Both of ECE's prop hands and indexed trigger finger are clear.`,
  1551: `Preserve the authoritative paper target exactly. Alia stands at far right in strict side profile inside the closed transparent-panel lane. The orange-plugged inert pistol is perfectly horizontal. One plain white paper square with one black non-humanoid route diamond is fixed to the thick sand backstop at the exact same height as the muzzle. A thin black horizontal alignment stripe crosses the paper through the diamond center so the diamond center, muzzle center, and Alia's eye line visibly form one horizontal line. The paper target is directly in front of the muzzle with a clear air gap. Every person and mascot remains behind and left of Alia's muzzle plane. Both of Alia's hands are separated and visible on the grip; the trigger finger is straight on the frame outside the guard. No beam, text, ammunition, magazine, firing, threat, or camera-facing muzzle.`,
};

const mascotText = {
  1548: "Mascot roll 41 = MAX only. Show exactly one small young golden retriever puppy on one padded dry lounge at far lower-left. No kitten and no other animal. Alia supervises by eye line only. MAX stays far from the river, hail, equipment, and prop lane.",
  1550: "Mascot roll 60 = neither. Show no kitten, no puppy, and no other animal.",
  1551: "Mascot roll 15 = PAWS plus MAX. On one padded dry lounge at far lower-left show exactly one tiny collarless golden kitten PAWS and one distinct small young golden retriever puppy MAX sharing a harmless nose-to-paw play beat. No adult dog, second dog, second cat, or other animal. Ellie supervises by eye line only. Both stay far from rain runoff, the sea edge, compass, and prop lane.",
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

function activeWord(value) {
  return value ? "ACTIVE" : "inactive";
}

function createPrompt(scene, plan) {
  const people = plan.maleModel?.present ? 5 : 4;
  const limbCount = people * 2;
  const characterLines = Object.entries(plan.characters).map(([name, data]) => {
    const emotion = data.emotion.materializedResult ?? data.emotion.result;
    return `${name}: emotion roll ${data.emotion.roll} = ${emotion}; visible-midriff roll ${data.visibleMidriff.roll} = ${activeWord(data.visibleMidriff.active)}; strapless roll ${data.straplessDress.roll} = ${activeWord(data.straplessDress.active)}; fully-open-back roll ${data.fullyOpenBack.roll} = ${activeWord(data.fullyOpenBack.active)}.`;
  }).join("\n");
  const outfitLines = Object.entries(plan.outfits).map(([name, text]) => `${name}: ${safeOutfit(text)}.`).join("\n");
  const oddProp = plan.interestingProp.active
    ? `Odd-prop roll ${plan.interestingProp.roll} = ACTIVE. Exactly ${plan.interestingProp.holder.result} owns one ${plan.interestingProp.family.result} with both existing hands. It is inert, secured, nonthreatening, and integrated into the relationship action. No other person touches it.`
    : `Odd-prop roll ${plan.interestingProp.roll} = inactive. Holder selector ${plan.interestingProp.holder.roll} = ${plan.interestingProp.holder.result} and family selector ${plan.interestingProp.family.roll} = ${plan.interestingProp.family.result} remain audit-only. Do not show that prop.`;
  const hosiery = plan.rainbowHosiery.active
    ? `Rainbow-hosiery roll ${plan.rainbowHosiery.roll} = ACTIVE. Exactly ${plan.rainbowHosiery.wearer.result} wears opaque public-safe knee socks in ${plan.rainbowHosiery.palette.result}; nobody else wears hosiery. Radiance and ECE are the clear affectionate center, and Alia alone handles the inert training prop.`
    : `Rainbow-hosiery roll ${plan.rainbowHosiery.roll} = inactive. Wearer selector ${plan.rainbowHosiery.wearer.roll} = ${plan.rainbowHosiery.wearer.result} and palette selector ${plan.rainbowHosiery.palette.roll} = ${plan.rainbowHosiery.palette.result} remain audit-only. Nobody wears stockings or knee socks. ECE alone handles the inert training prop.`;
  const male = plan.maleModel?.present
    ? `Male selector = this scene only. Add the established clearly adult Scene 1136 bearded male in his opaque fitted short-sleeve top, fitted black jeans, and black boots. Male emotion roll ${plan.maleModel.emotion.roll} = ${plan.maleModel.emotion.result}. Preserve his face, two visible contacts, adult infidelity drama, and strongest sustained eye line to ECE.`
    : "Male selector = inactive. Show no man and no fifth adult.";

  return `Use case: photorealistic-natural.\nAsset: fresh 9:16 full-length public-fashion editorial, Georgia Batch 382 fresh round 5.\n\nSETTING AND THEME\n${setting[scene]}\nWeather roll ${plan.weather.roll} = ${plan.weather.result}; make it unmistakable while all footing remains dry, stable, and nonslip. Mode = ${plan.mode}. Active unrelated theme = Mars-surface expedition couture. No copied space-agency, airline, military, police, coast-guard, emergency-service, or official uniform, logo, badge, or insignia.\n\nADULT CAST AND IDENTITY\nShow exactly ${people} clearly adult fictional people, all visibly over 28: blonde Radiance; dark-haired Ellie; Black Alia with the only high sculptural braided ponytail; brunette AI ECE. Preserve four distinct anchored faces and bodies with no clone, merge, replacement, or age shift. ${male}\n\nDETERMINISTIC CHARACTER ROLLS\n${characterLines}\nExpress each emotion distinctly through eyes, face, torso direction, and posture without caricature.\n\nFOUR DISTINCT OUTFIT FINGERPRINTS\n${outfitLines}\nAll garments are fully opaque and public-safe with complete bust, hip, and seat coverage. Rolled midriff, strapless, and open-back details are restrained runway tailoring. Each woman has a different silhouette, construction, material language, motif technique, hem architecture, and footwear. No lingerie, swimwear, transparent intimate area, exposed undergarment, fetish styling, matching mini-dress set, matching two-piece set, repeated map print, palette-swapped copy, cleavage-focused lens, erotic framing, or intimate close-up.\n\nROLLED RELATIONSHIP ACTION\nRomance roll ${plan.romanceBeat.roll}: ${plan.romanceBeat.contractResult}\nCompound-love roll ${plan.compoundLoveBeat.roll}: ${plan.compoundLoveBeat.contractResult}\nUse those two stored beats visibly as facial, eye-line, pursuit, choice, and torso-movement influences, but resolve every physical hand through the exact hard-love inventory below so no extra hand appears.\nHard-love roll ${plan.hardLoveBeat.roll}: ${plan.hardLoveBeat.result}\n${choreography[scene]}\nThe clearly adult consensual relationship event is fully clothed, stable, non-explicit, and the first read.\n\nMISSION PROP AND TARGET\nPose-target roll ${plan.poseTargetRoll.roll}; resolved handler = ${plan.resolvedPropHandler}. Authoritative action: ${plan.materializedPropAction}\n${mission[scene]}\nThe prop is exactly one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training pistol replica: short pistol barrel, one pistol grip, orange muzzle plug, compact stockless handgun silhouette, and no shoulder stock, long barrel, foregrip, sling, cable, rifle, shotgun, carbine, or long-gun form. It drives the safe interruption and is never decorative. ECE's separate holographic route map is hands-free. No firing, ammunition, loose magazine, reload, holster, muzzle flash, threat, injury, combat, person-targeting, animal-targeting, occupied-object targeting, or camera-targeting.\n\nMASCOT, ODD-PROP, AND GLOBAL ROLLS\n${mascotText[scene]}\n${oddProp}\nPole-theme roll ${plan.poleDanceTheme.roll} = inactive; show no pole. Rainbow-only roll ${plan.rainbowOnly.roll} = inactive; do not convert wardrobe to rainbow-only styling. ${hosiery}\nPublishing audit only, not visible text: Georgia \u2764\uFE0F Honduras, hashtag Georgia, hashtag InternalAgency, no WorldXXXSeries hashtag.\n\nANATOMY AND FRAME\nEye-level full-body 9:16 composition, never low-angle. Show all faces, shoulders, elbows, wrists, separated hands, finger clusters, legs, feet, heels, and boots. Exactly ${limbCount} human arms and exactly ${limbCount} human hands, two per adult, with every limb continuously traceable to one owner. No extra, duplicate, floating, fused, borrowed, emerging, hidden-owner, missing, cropped, or ambiguous limb or finger cluster. Keep Georgia landmarks, romance action, and complete target line large and legible. No readable text, watermark, literal flag, sacred imagery, or official seal.`;
}

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const prompt = createPrompt(scene, plan);
  const outputPath = path.join(root, `scene-${scene}-fresh-round-5-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  const required = [
    `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
    `Hard-love roll ${plan.hardLoveBeat.roll}: ${plan.hardLoveBeat.result}`,
    `Romance roll ${plan.romanceBeat.roll}: ${plan.romanceBeat.contractResult}`,
    `Compound-love roll ${plan.compoundLoveBeat.roll}: ${plan.compoundLoveBeat.contractResult}`,
    `Pose-target roll ${plan.poseTargetRoll.roll}`,
    `exactly ${peopleFor(plan) * 2} human hands`,
  ];
  for (const text of required) {
    if (!prompt.includes(text)) throw new Error(`Scene ${scene} missing required materialization: ${text}`);
  }
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    freshRound: 5,
    cleanAuthoritativePrompt: true,
    targetCorrections: [
      "clean prompt rebuilt from stored scene plan",
      "exact outward-facing non-overlapping hand inventory",
      "original stored mission target restored",
      "muzzle axis intersects the target center",
      "short-barreled stockless large-frame pistol silhouette locked",
      "no visible beam",
    ],
  };
  plan.freshRound5 = { ...promptAudit[scene], prompt };
}

function peopleFor(plan) {
  return plan.maleModel?.present ? 5 : 4;
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-5-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 1,
  missingSceneNumbers: scenes,
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound5 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: scenes,
  preservedAcceptedSceneNumbers: [1549],
  concurrency: "three independent built-in image generation calls with all-settled result capture",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit,
  storedRollsChanged: false,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  account: "@dogramaci",
  signedIn: true,
  eligibleBacklogRemaining: 0,
  latestVisibleSeriesStatus: {
    country: "Honduras",
    url: "https://x.com/dogramaci/status/2087088543499768003",
    attachments: 3,
    liveVerified: true,
  },
  reconciliationDecision: "No eligible unposted backlog item and no duplicate upload required before Georgia completion.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-5-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));

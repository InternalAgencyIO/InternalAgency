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
  1548: `The rolled hard-love beat is the first read: a moving three-person slow-dance triangle while ECE steps through the open side as the excluded rival. Pull back and place Radiance front-left, Ellie front-center, and Alia one full step behind-right with open air inside the triangle. Use exactly this planar six-hand inventory: Radiance's right hand and Ellie's left hand form one low linked pair in the open center; Ellie's right hand and Alia's left hand form one outward linked pair on the far-right side; Alia's right arm comes around from behind but its open palm lies fully visible on the front of Radiance's near-side waist; Radiance's left open palm lies fully visible on Alia's outer shoulder. Isolate every hand against contrasting fabric or open sky, show every complete forearm and wrist, and keep all hands inside generous side margins. ECE remains separate at far right and owns only the two mission-prop hands. Exactly eight hands appear. Bent knees, turning hems, aligned romantic eye lines, and four clear contacts make it a real dance, not a lineup.`,
  1550: `The rolled hard-love beat is the first read: Radiance sits upright on a broad low bench at far left while Alia sits securely sideways across both of Radiance's thighs at a clear ninety-degree angle, with no bench visible between their hips and both of Alia's feet planted. The exactly three soft geometric weather balloons attach to one short horizontal carry-bar with two separated handles; Radiance holds one handle in each complete hand outside the embrace, so both hands own only the odd prop. Alia's left open palm rests visibly on Radiance's shoulder and Alia's right hand links only with Ellie's left hand against open sky. Ellie kneels in front-right of Alia; her linked left hand stays visible and her right open palm rests visibly on Alia's outer shoulder. ECE kneels separately at far right and owns only the two mission-prop hands. The adult male stands behind and camera-left of ECE with one fully visible palm on ECE's shoulder blade and his other fully visible palm on ECE's outer upper arm, leaving both of ECE's forearms unobstructed. His strongest sustained eye line stays on ECE. Exactly ten hands appear. No self-clasp, hidden hand, arm leaving frame, fourth balloon, or changed partner.`,
  1551: `The rolled hard-love beat is the first read: Ellie supports Radiance in a stable shallow diagonal dip at left. Radiance's torso tilts only twenty degrees so both adults keep planted feet and face-visible three-quarter angles. Ellie's lower open palm lies fully visible on Radiance's near-side waist; Ellie's upper open palm lies fully visible high between Radiance's shoulder blades on the blue open-back panel, with a full hand-width of blue fabric separating the two palms. Radiance's left open palm rests visibly on Ellie's outer shoulder and Radiance's right open palm reaches to ECE's outer shoulder as the invitation. ECE stands upright one step away and owns only the two compass-table hands, one complete hand on each opposite handle of the round compass rim. Alia remains separate at far right and owns only the two mission-prop hands while answering with a jealous eye line. Exactly eight hands appear, every complete wrist has an air gap, and no hand is behind a torso or below the compass.`,
};

const mission = {
  1548: `Preserve the authoritative water target exactly. ECE kneels safely at far right in strict side profile behind a dry secured parapet and angles the orange-plugged inert pistol about 40 degrees down-right. Place one fluorescent orange empty floating route disk in the Mtkvari water immediately down-right and directly in front of the muzzle, with a clean empty-air gap and open empty water beyond it. Nothing visual connects the pistol or map to the disk: no beam, ray, tracer, laser, dashed route, dotted path, cord, string, glow trail, or painted trajectory. All people, MAX, bridge, buildings, banks, boats, paths, and camera remain behind or left of the muzzle plane. Both of ECE's hands are separated and visible on the grip; the trigger finger is straight on the frame outside the guard. ECE's separate hands-free blue holographic route map is a self-contained rectangular card beside her shoulder with no line leaving it.`,
  1550: `Preserve the authoritative basin target exactly. ECE kneels at far right in strict side profile and angles the orange-plugged inert pistol about 30 degrees down-right. A transparent shallow blue cinema-safety basin sits alone on a secure pedestal immediately down-right. Its single fluorescent orange empty floating route disk sits directly in front of the muzzle with a clean empty-air gap. Nothing visual connects pistol and disk: no beam, ray, tracer, laser, dashed route, dotted path, cord, string, glow trail, or painted trajectory. The basin is enclosed by transparent safety panels and separated from walls, paths, vineyards, and valley drops. Every other adult stays behind and left of the muzzle plane. Both of ECE's complete hands are separated and visible on the grip; the trigger finger is straight on the frame outside the guard.`,
  1551: `Preserve the authoritative paper target exactly. Alia stands at far right in strict side profile inside the closed transparent-panel lane. The orange-plugged inert pistol is perfectly horizontal. One plain white paper square with one black non-humanoid route diamond is fixed to the thick sand backstop at the exact same height as the muzzle. The diamond center, muzzle center, and Alia's eye line visibly share one horizontal height, with clean empty air between pistol and paper. Nothing visual connects pistol and target: no beam, ray, tracer, laser, dashed route, dotted path, cord, string, glow trail, or painted trajectory. Every person and mascot remains behind and left of Alia's muzzle plane. Both of Alia's hands are separated and visible on the grip; the trigger finger is straight on the frame outside the guard.`,
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

  return `Use case: photorealistic-natural.\nAsset: fresh 9:16 full-length public-fashion editorial, Georgia Batch 382 fresh round 6.\n\nSETTING AND THEME\n${setting[scene]}\nWeather roll ${plan.weather.roll} = ${plan.weather.result}; make it unmistakable while all footing remains dry, stable, and nonslip. Mode = ${plan.mode}. Active unrelated theme = Mars-surface expedition couture. No copied space-agency, airline, military, police, coast-guard, emergency-service, or official uniform, logo, badge, or insignia.\n\nADULT CAST AND IDENTITY\nShow exactly ${people} clearly adult fictional people, all visibly over 28: blonde Radiance; dark-haired Ellie; Black Alia with the only high sculptural braided ponytail; brunette AI ECE. Preserve four distinct anchored faces and bodies with no clone, merge, replacement, or age shift. ${male}\n\nDETERMINISTIC CHARACTER ROLLS\n${characterLines}\nExpress each emotion distinctly through eyes, face, torso direction, and posture without caricature.\n\nFOUR DISTINCT OUTFIT FINGERPRINTS\n${outfitLines}\nAll garments are fully opaque and public-safe with complete bust, hip, and seat coverage. Rolled midriff, strapless, and open-back details are restrained runway tailoring. Each woman has a different silhouette, construction, material language, motif technique, hem architecture, and footwear. No lingerie, swimwear, transparent intimate area, exposed undergarment, fetish styling, matching mini-dress set, matching two-piece set, repeated map print, palette-swapped copy, cleavage-focused lens, erotic framing, or intimate close-up.\n\nROLLED RELATIONSHIP ACTION\nRomance roll ${plan.romanceBeat.roll}: ${plan.romanceBeat.contractResult}\nCompound-love roll ${plan.compoundLoveBeat.roll}: ${plan.compoundLoveBeat.contractResult}\nUse those two stored beats visibly as facial, eye-line, pursuit, choice, and torso-movement influences, but resolve every physical hand through the exact hard-love inventory below so no extra hand appears.\nHard-love roll ${plan.hardLoveBeat.roll}: ${plan.hardLoveBeat.result}\n${choreography[scene]}\nThe clearly adult consensual relationship event is fully clothed, stable, non-explicit, and the first read.\n\nMISSION PROP AND TARGET\nPose-target roll ${plan.poseTargetRoll.roll}; resolved handler = ${plan.resolvedPropHandler}. Authoritative action: ${plan.materializedPropAction}\n${mission[scene]}\nThe prop is exactly one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training pistol replica: short pistol barrel, one pistol grip, orange muzzle plug, compact stockless handgun silhouette, and no shoulder stock, long barrel, foregrip, sling, cable, rifle, shotgun, carbine, or long-gun form. It drives the safe interruption and is never decorative. ECE's separate holographic route map is hands-free. No firing, ammunition, loose magazine, reload, holster, muzzle flash, threat, injury, combat, person-targeting, animal-targeting, occupied-object targeting, or camera-targeting.\n\nMASCOT, ODD-PROP, AND GLOBAL ROLLS\n${mascotText[scene]}\n${oddProp}\nPole-theme roll ${plan.poleDanceTheme.roll} = inactive; show no pole. Rainbow-only roll ${plan.rainbowOnly.roll} = inactive; do not convert wardrobe to rainbow-only styling. ${hosiery}\nPublishing audit only, not visible text: Georgia \u2764\uFE0F Honduras, hashtag Georgia, hashtag InternalAgency, no WorldXXXSeries hashtag.\n\nANATOMY AND FRAME\nEye-level full-body 9:16 composition, never low-angle, with generous clear margins around every complete arm and hand. Show all faces, shoulders, elbows, wrists, separated hands, finger clusters, legs, feet, heels, and boots. Exactly ${limbCount} human arms and exactly ${limbCount} human hands, two per adult, with every limb continuously traceable to one owner. No extra, duplicate, floating, fused, borrowed, emerging, hidden-owner, missing, cropped, or ambiguous limb or finger cluster. Keep Georgia landmarks, romance action, and complete target geometry large and legible. No readable text, watermark, literal flag, sacred imagery, or official seal.`;
}

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const prompt = createPrompt(scene, plan);
  const outputPath = path.join(root, `scene-${scene}-fresh-round-6-prompt.txt`);
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
    freshRound: 6,
    cleanAuthoritativePrompt: true,
    targetCorrections: [
      "clean prompt rebuilt from stored scene plan",
      "planar non-overlapping hand inventory with generous margins",
      "original stored mission target restored",
      "target placed directly in front of muzzle without a rendered line",
      "short-barreled stockless large-frame pistol silhouette locked",
      "no visible beam, tracer, dashed path, dotted path, cord, or string",
      "two-handle carry-bar locks both Radiance hands on the three-balloon pack in scene 1550",
    ],
  };
  plan.freshRound6 = { ...promptAudit[scene], prompt };
}

function peopleFor(plan) {
  return plan.maleModel?.present ? 5 : 4;
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-6-materialized";
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
checkpoint.renderAttempts.freshRound6 = {
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
  action: "launch-fresh-round-6-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));

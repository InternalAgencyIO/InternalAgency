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
const scenes = [1548, 1551];

const setting = {
  1548: "Real Tbilisi dominates: the full Peace Bridge sweep, Mtkvari bend, Old Town balcony slopes, Narikala ridge, and rounded Abanotubani sulfur-bath domes remain large and recognizable on the left and center. Mars-surface expedition language appears only in couture construction and portable field-atelier details.",
  1550: "Real Sighnaghi dominates: complete ochre defensive-wall curves and towers, terracotta roofs, the Alazani vineyard grid, and the Greater Caucasus horizon remain large and recognizable. Mars-surface expedition language appears only in couture construction and portable agriculture-lab details.",
  1551: "Real Batumi Boulevard dominates: the Black Sea horizon, Alphabet Tower, Ferris wheel, palms, and modern Adjara skyline remain large and recognizable. Mars-surface expedition language appears only in couture construction and portable observation-court details.",
};

const choreography = {
  1548: `The rolled hard-love beat is the first read in one broad, low riverside choreography. Radiance, Ellie, and braided Alia form an open triangular slow-dance chain across the left half while ECE occupies the center foreground in a deep right-facing crossing lunge that physically passes through the open side between Radiance and Ellie. ECE is inside the group composition, one shoulder-width from Ellie, never isolated at the edge. The six dancer hands are a simple planar inventory: Radiance's right hand and Ellie's left hand make one raised clasp against open sky; Ellie's right hand and Alia's left hand make one low clasp against Ellie's cobalt trousers; Alia's right palm wraps visibly around the camera-facing side of Radiance's waist; Radiance's left palm rests visibly on Alia's outer shoulder. Each of those four contacts has a continuous visible forearm and a different background. ECE owns only the two mission hands and no dancer touches ECE. Radiance and Ellie turn surprised romantic eye lines toward the intruding ECE while Alia watches Radiance with longing; ECE's crossing torso splits Radiance from Ellie even while ECE keeps her safety sight picture downrange. Exactly eight arms and eight hands, six dancer hands, two ECE hands, four romance contacts, bent dance knees, rotating hems, and the unmistakable center-foreground interruption appear.`,
  1550: `Preserve the successful rolled lap-sitting and exact ownership geometry. Radiance sits upright at far left while Alia sits securely sideways across both Radiance thighs at ninety degrees, both Alia feet planted and no bench visible between their hips. Exactly three soft geometric weather-balloon spheres are rigidly mounted above one short horizontal carry-bar with two separated vertical handles and no strings. Radiance's left hand grips only the left handle and her right hand grips only the right handle, shoulder-width apart. Alia's left open palm rests on Radiance's shoulder and her right hand links only with Ellie's left hand. Ellie kneels beside Alia; her linked hand remains exposed and her right open palm rests on Alia's outer shoulder. ECE kneels separately at far right with both hands only on the mission prop. The adult male leans close behind ECE with one visible palm on her shoulder cap and one on her outer upper arm, leaving both ECE forearms clear. His nose, chin, and both pupils point unmistakably at ECE's profile while ECE returns a sustained eye line; he does not look toward Ellie or the lap pair. Exactly ten visible hands, exactly three balloons, the clear lap choice, and at least five relationship contacts appear.`,
  1551: `Use one wide respectful rear three-quarter view with four non-overlapping full bodies: Ellie far left, dipped Radiance left-center, ECE right-center, and braided Alia far right in right-facing side profile. The eight-hand ownership map is non-negotiable. Ellie's left open palm supports Radiance high between the shoulder blades and Ellie's right open palm supports Radiance at the near waist; both palms and both forearms are fully visible on Radiance's camera-facing fully open cobalt back. Radiance's left arm reaches backward with its complete palm on Ellie's outer shoulder. Radiance's right arm reaches forward with only two fingertips resting on top of ECE's already-visible left fist. ECE's left fist remains wrapped around the left compass handle while its outer thumb closes gently over those two Radiance fingertips; ECE's right fist grips the opposite compass handle. This is one layered hand contact, not an extra hand, and Radiance never touches the compass. Alia owns the final two hands exclusively on the mission grip. Show all eight wrists, elbows, palms, and finger clusters with open air and contrasting backgrounds. Radiance and ECE sustain the clearest affectionate eye line while the dip, caught-fingertip invitation, and Alia's jealous answer remain the first read.`,
};

const mission = {
  1548: `Preserve the authoritative empty Mtkvari water marker using one short, visible twenty-degree down-right sight axis. ECE is center foreground on a low secured dry pier in a deep crossing lunge, strict right-facing profile, with every dancer behind and left of her muzzle plane. Her two straight wrists angle the orange-plugged inert pistol twenty degrees down-right. One fluorescent orange floating disk sits in the cordoned empty river lane only one pistol-length beyond the muzzle. In the camera image, barrel center, muzzle center, and disk center occupy one exact upper-left-to-lower-right line; the disk is the immediate visible endpoint, not below, behind, or beside that line. A complete low transparent backstop fills the open water directly beyond the disk. Both ECE hands are separated and wrapped around the grip, and her trigger index is a visibly straight finger lying flat on the colored frame above and outside the guard. The separate hands-free blue holographic route card floats above her rear shoulder. No person, MAX, building, bridge, bank, boat, path, or camera is along or beyond the sight axis. No beam, ray, tracer, laser, dashed or dotted path, cord, string, glow trail, or painted trajectory.`,
  1550: `Preserve the authoritative empty basin marker in one simple horizontal side view. ECE kneels at the far-right edge in strict right-facing profile and holds the orange-plugged inert pistol perfectly horizontal at lower-chest height. A tall narrow transparent blue cinema-safety basin on a secure pedestal begins sixty centimeters to the right of the muzzle; its water surface rises to muzzle height. One fluorescent orange floating disk sits at the basin's left edge exactly level with the barrel and muzzle centers. In the camera image, ECE's eye, barrel center, muzzle center, and disk center occupy one single horizontal row; the disk is visibly beyond the muzzle, never behind or below it. The basin and complete transparent backstop occupy empty foreground space to ECE's right, with every adult behind and left of the muzzle plane. Both ECE hands are separated and visibly wrapped around the grip; her index finger is straight and flat on the colored frame above and outside the guard. A small separate hands-free blue holographic route card floats immediately beside ECE's outer shoulder and is touched by nobody. No beam, ray, tracer, laser, dashed or dotted path, cord, string, glow trail, or painted trajectory.`,
  1551: `Preserve the authoritative paper marker using exact side-on geometry. Alia is the rightmost adult in strict right-facing profile. Her orange-plugged inert pistol is perfectly horizontal at shoulder height. A tall thick sand backstop begins sixty centimeters to the right of the muzzle; one plain white paper square with one black non-humanoid route diamond is fixed high on it so Alia's eye, barrel center, muzzle center, and diamond center occupy one horizontal row with clean empty air between pistol and paper. Every person and mascot remains behind and left of Alia's muzzle plane. Both Alia hands are separated and visible on the grip; her trigger index is unmistakably straight and flat on the colored frame above and outside the guard. Alia's secure strapless copper front is visibly opaque from sternum through both side-bust panels, with no exposed breast, side breast, nipple, under-bust, cleavage, transparent area, or skin gap; the opaque side panels end before the fully open back. No beam, ray, tracer, laser, dashed or dotted path, cord, string, glow trail, or painted trajectory.`,
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
      "secure opaque strapless sculpted bodice with a high straight top edge, complete front coverage, completely bare shoulders, and no straps, sleeves, halter, collar, neckband, or illusion mesh",
    )
    .replaceAll(
      "completely open from shoulder blades to the secure lower-back waistline with no crossing straps, fabric panel, illusion mesh, or hair covering it",
      "fully open-back couture from shoulder blades to a high secure waist, shown from a respectful rear three-quarter angle, with no crossing strap, back band, fabric panel, halter, or illusion mesh and with fully opaque front and side coverage",
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
  let outfitLines = Object.entries(plan.outfits).map(([name, text]) => `${name}: ${safeOutfit(text)}.`).join("\n");
  const rollVisibility = {
    1548: "Roll-visibility lock: Radiance, Ellie, and Alia each show one separate restrained three-centimeter midriff band; ECE's waist stays fully covered. No strapless or fully open-back construction appears on any woman.",
    1550: "Roll-visibility lock: Radiance alone shows one restrained three-centimeter midriff band. Alia alone has a completely strapless opaque bodice with bare shoulders and no strap, sleeve, halter, collar, or neckband. Ellie and ECE remain fully covered at waist and shoulders. No fully open back appears.",
    1551: "Roll-visibility lock: Ellie and Alia each show one separate restrained three-centimeter midriff band. Alia alone has a completely strapless high-cut opaque copper front with rigid opaque side-bust coverage, completely bare shoulders, and no strap, sleeve, halter, collar, neckband, exposed side breast, or cleavage. Radiance and Alia each have a fully open back from shoulder blades to a high secure waist with no crossing strap, back band, fabric panel, hair, halter, or illusion mesh; both open backs are simultaneously visible from the respectful rear three-quarter camera. ECE remains fully covered.",
  }[scene];
  outfitLines += `\n${rollVisibility}`;
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
  const prompt = createPrompt(scene, plan).replace("fresh round 6", "fresh round 9");
  const outputPath = path.join(root, `scene-${scene}-fresh-round-9-prompt.txt`);
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
    freshRound: 9,
    cleanAuthoritativePrompt: true,
    targetCorrections: [
      "clean prompt rebuilt from stored scene plan",
      "planar non-overlapping hand inventory with generous margins",
      "original stored mission target restored",
      "side-profile muzzle and target centers locked to one visible axis without a rendered line",
      "short-barreled stockless large-frame pistol silhouette locked",
      "no visible beam, tracer, dashed path, dotted path, cord, or string",
      "scene 1548 uses a short twenty-degree down-right water-marker axis from a low crossing lunge",
      "scene 1548 places ECE inside the center-foreground dance interruption while retaining both mission hands",
      "scene 1551 locks all eight hands to a single ownership map with no extra caught hand",
      "scene 1551 simultaneously exposes both active open backs while preserving opaque front and side-bust coverage",
    ],
  };
  plan.freshRound9 = { ...promptAudit[scene], prompt };
}

function peopleFor(plan) {
  return plan.maleModel?.present ? 5 : 4;
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-9-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 2,
  missingSceneNumbers: scenes,
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound9 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: scenes,
  preservedAcceptedSceneNumbers: [1549, 1550],
  concurrency: "two independent built-in image generation calls with all-settled result capture",
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
  action: "launch-fresh-round-9-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));

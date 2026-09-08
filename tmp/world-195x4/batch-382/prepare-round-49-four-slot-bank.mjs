import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const lore = path.join(repo, "assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(lore, "batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(lore, "world-x-publish-ledger.json");
const rawDir = path.join(root, "raw/round-48-four-slot-bank");
const checkedAt = new Date().toISOString();

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const sha256Text = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();

const expectedRound48 = {
  A: "F5C2EFC0EACAD93BAE1F6E729975BF75CB2119DA2E281CDA383850BBFF8773FD",
  B: "6938302CEA0D48B613436B147AEEFA693A1A955C586CD993EC5D6FDFD02B61F3",
  C: "1642A6A5027250D7DFBA222958379E1627699C4484C6D02015A5F34F9530E70D",
  D: "0323995D282C5A365A73F72FAA1DE41B5F26B1C9C2FC5EB0836F7BD3185D3675",
};

const round48Audit = {
  A: {
    accepted: false,
    decisiveRejectionReasons: [
      "The right trigger index is not independently certifiable as one straight finger entirely above and outside the empty guard.",
      "The paper diamond sits below the muzzle row rather than on the required horizontal eye-sight-barrel-target axis.",
      "The complete backstop ends beside the frame edge, leaving far less than eleven percent empty promenade beyond it.",
    ],
    retainedPasses: "Four distinct adults, exact eight-arm ownership, the three-contact dip graph, Batumi landmarks, PAWS plus MAX, ECE compass ownership, Alia two-hand prop ownership, and the active wardrobe cuts remain broadly readable, but no hard-gate waiver is allowed.",
  },
  B: {
    accepted: false,
    decisiveRejectionReasons: [
      "The right trigger index remains visually merged with the grip and guard geometry rather than independently straight above the empty guard.",
      "The target diamond is materially below the muzzle axis.",
      "The backstop occupies the far-right edge and leaves substantially less than eleven percent empty promenade beyond it.",
    ],
    retainedPasses: "Four distinct adults, eight owned arms and hands, the contact graph, Batumi, both mascots, compass ownership, and Alia's two-hand stance are readable, but the mission lane fails strict certification.",
  },
  C: {
    accepted: false,
    decisiveRejectionReasons: [
      "The right trigger index is not separately readable from the guard and grip cluster.",
      "The paper diamond is below the barrel and muzzle row.",
      "The target and backstop sit at the edge with no certifiable eleven-percent empty promenade after the complete backstop.",
    ],
    retainedPasses: "Four adults, the intended relationship triangle, Batumi, mascots, compass, and distinct couture are present, but the mission lane is not an exact pass.",
  },
  D: {
    accepted: false,
    decisiveRejectionReasons: [
      "The right trigger index is not independently certifiable outside the guard.",
      "An extra orange circular marker appears directly on the muzzle row, creating a second route target and violating the one-paper-target-only gate.",
      "The required black diamond paper target remains below the muzzle row, and the backstop leaves less than eleven percent empty promenade beyond it.",
    ],
    retainedPasses: "Four distinct adults, eight owned arms and hands, three relationship contacts, Batumi, mascots, compass ownership, and Alia's two-hand stance are readable, but the extra marker and mission geometry are decisive failures.",
  },
};

const commonPrompt = `Use case: photorealistic-natural
Asset: Georgia Batch 382, scene 1551, round 49 fixed four-slot parallel correction bank

FRESH INDEPENDENT SOURCE
Create one completely new clean 9:16 full-body photograph for this candidate. Images 1-3 anchor only the four clearly adult fictional identities; Image 4 anchors only brunette AI ECE. Do not copy reference wardrobe, pose, setting, rainbow group styling, prop, or texture. Do not use any prior Georgia or Batumi render. Show exactly four distinct adults visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE matching Image 4. No man, fifth adult, clone, merge, replacement, or age shift.

SETTING AND CAMERA
Use a clean eye-level 24 mm full-body public-fashion photograph on real Batumi Boulevard, Georgia, with heavy straight rain over flat wet nonslip tiles. Keep the Black Sea, Alphabet Tower, Ferris wheel, palms, and Adjara skyline large and unmistakable in the left and upper background. Mars-surface expedition language exists only in four civilian couture constructions and compact observation equipment. Natural skin, straight architecture, coherent rain and sand, crisp hands. No wavy, marbled, melted, liquified, painterly, overprocessed, haloed, or oversharpened surfaces. No logo, uniform, badge, patch, epaulette, insignia, flag, seal, watermark, readable sign, caption, or hashtag.

MEASURED COMPOSITION
Treat the portrait frame as a measured horizontal grid. Keep Ellie, Radiance, and ECE entirely in x=3-46 percent. Put Alia large and fully visible at x=48-61 percent. Put the complete inert replica in a strict orthogonal side profile at x=57-65 percent. Leave a broad empty air-and-pavement gap after the orange muzzle. Put one narrow complete transparent safety panel at x=67-69 percent. Affix one small complete white paper bearing one black non-humanoid diamond to the front of one narrow complete thick earth-and-sand backstop at x=71-76 percent. From x=79 percent through the right frame edge, show only empty wet promenade, sea, rain, and sky. This rightmost 21 percent is an obvious uninterrupted empty reserve: no person, hand, mascot, glass, paper, marker, target, backstop, prop, sign, plant, furniture, landmark, or crop intrusion. Keep the backstop fully visible with a clean vertical strip of empty promenade wider than the backstop after it.

Place the orange muzzle center, black diamond center, and Alia's dominant eye on one exact horizontal row. The white paper is attached to the backstop and is the only route target or marker anywhere. Do not draw a line. No orange disk, water marker, second target, extra paper, target stand, or symbol. All people and mascots remain left of the muzzle plane.

EXACT DISTINCT WARDROBE AND STORED ROLLS
Radiance expresses aching romantic longing. Her midriff is fully covered, she is not strapless, and her upper back is completely open from shoulder blades to a secure high waist with no rear strap, yoke, chain, band, fabric, mesh, clasp, or hair crossing it. She wears a cobalt asymmetric above-knee high-low sheath with side-mounted solar-gold aerobrake arcs, copper lens pucks, secure covered waist, bare arms, halo-arch heels, and exactly one pair of opaque original-independent-rainbow knee hosiery that visibly reaches both kneecaps.

Ellie expresses hope. She wears a snow-white asymmetrical fan-sleeve jumpsuit with sulfur-teal side planes, basalt heat-baffle ribs, one fitted sleeve and one cape sleeve, a deliberate three-centimeter bare midriff band, covered back, split ankle hems, and articulated wedge boots. She is not strapless.

Alia expresses magnetic confidence. She wears a rigid Mars-copper FRONT-ONLY strapless crop shell with secure opaque public coverage. Narrow side wings stop at her side ribs. A clear four-centimeter bare midriff band separates it from a high-waisted cobalt pleated skort. Her entire upper back is bare and unobstructed. No collar, necklace, neck loop, halter, shoulder strap, sleeve, rear band, rear clasp, crossing strap, rear fabric, illusion mesh, or braid crossing the back. Her sculptural braided ponytail stays lifted clear of the back. Angular shield pumps complete the look.

ECE expresses guilt and remorse. She wears a fully covered basalt civilian segmented peplum jacket with solar-gold stirrup trousers, cobalt pressure discs, and piston-platform shoes. Her waist and back remain covered. No official-service styling.

All four silhouettes, constructions, material languages, motif techniques, hems, and footwear families are visibly different. Secure opaque fully lined public fashion only. No matching mini-dress set, palette-swapped copies, repeated map print, lingerie, transparent intimate area, exposed undergarment, fetish styling, bondage, restraint, nudity, or explicit sexual content. Pole roll 67 inactive. Rainbow-only roll 15 inactive. Rainbow hosiery roll 14 active only on Radiance, wearer roll 38, original-independent-rainbow palette roll 54.

EXACT ROMANCE GRAPH AND EIGHT HANDS
Make the clearly adult consensual romance-square the first read. Ellie stands at far left with both feet planted. Radiance is visibly lower in a supported shallow dance dip, leaning back about 28 degrees with both feet planted, bare upper back toward camera, face turned to ECE. ECE stands front-three-quarter just right of Radiance and returns the direct sustained warm eye line.

Contact 1: Ellie's left arm remains fully outside both torsos and her open left palm supports Radiance high on the bare upper back.
Contact 2: Ellie's right hand and Radiance's left hand form one large low side clasp in clear air.
Contact 3: Radiance's separate right arm traces through clear air and her open right palm rests visibly on ECE's outer upper arm below the shoulder, entirely above and outside the compass hardware.

ECE owns exactly two other hands, one on each of two tall opposite compass handles. Alia owns exactly two mission hands. These are the three and only three relationship contacts. Exactly eight human arms and eight human hands, two per woman. Every arm traces continuously shoulder-elbow-wrist-hand. No hidden, extra, fused, floating, borrowed, duplicated, emerging, cropped, or ambiguous limb or finger cluster. Do not add waving, pointing, raised, folded, or decorative hands.

Hard-love roll 40 is this exact controlled dip, caught free hand, and fourth-partner answer. Romance roll 86 and compound roll 28 resolve only through the same three-contact graph, aligned torsos, direct Radiance-ECE gaze, Ellie's support, and Alia's separated profile. Radiance and ECE remain the affectionate center without changing hand ownership.

ODD PROP, ROUTE MAP, AND MASCOTS
Odd-prop roll 12 is active; holder roll 86 selects ECE; family roll 88 selects an oversized magnetic compass table. Show one narrow knee-high compass pedestal. ECE alone holds its two tall opposite handles, one separated hand per handle. A small translucent blue coastline route map rises hands-free from the center with exactly three nodes and no readable text. Radiance touches only ECE's outer upper arm.

Mascot roll 15 requires PAWS plus MAX. Show exactly one tiny collarless golden kitten and one distinct small young golden retriever puppy sharing one supervised nose-to-paw beat on one raised dry cream lounge at the extreme lower-left. Keep both fully behind the muzzle plane and far from water, glass, compass, target, backstop, and mission prop. No collar, accessory, adult dog, duplicate, malformed animal, or mascot elsewhere.

MISSION PROP: LARGE SIDE PROFILE AND CERTIFIABLE INDEX
Alia alone handles exactly one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training replica, about 30 cm long, with a short barrel, heavy grip, one large visibly EMPTY matte-black oval trigger guard, and one orange safety insert inside the muzzle. It is unloaded and magazine-free. Show it large, sharp, unobstructed, perpendicular to camera, and fully separated from glass and target. No ammunition, magazine, firing, muzzle flash, beam, tracer, threat, injury, combat, or aim at a person, animal, occupied object, or camera.

Alia's right hand wraps only the lower grip. Her middle, ring, and little fingers visibly curl below the guard. Her RIGHT TRIGGER INDEX is one long independently readable straight skin-toned finger in side view, separated from every curled finger, lying completely flat along the solid dark side frame at least one full finger-width ABOVE and OUTSIDE the empty black oval guard from knuckle through fingertip. A visible strip of dark frame and a visible air gap separate the index from the guard. The fingertip points downrange. It never bends toward, enters, overlaps, touches, or disappears behind the guard. Her left palm cups only the lower front of her right fist and grip base, well below the indexed finger. Show both complete arms, wrists, palms, and two clearly separate hand clusters.

FINAL GATE
Include only four adults, one compass, one hands-free map, one inert replica, one transparent panel, one paper diamond attached to one complete backstop, PAWS, MAX, one lounge, and Batumi landmarks. Must pass four identities; exact eight arms and hands; three contacts; obvious supported dip; direct Radiance-ECE gaze; Radiance and Alia fully open backs; Radiance knee-reaching opaque rainbow hosiery; Ellie and Alia midriffs; Alia strapless; candidate-specific Radiance invitation and response; exact mascots; ECE compass ownership; Alia prop ownership; one independently visible straight trigger index above and outside the guard; exact horizontal target row; no second marker; complete backstop; empty rightmost 21 percent; distinct outfits; clean natural surface.`;

const narratives = {
  A: `CANDIDATE A LIVE NARRATIVE AND COMPOSITION
Invitation key batch382-georgia-scene1551-radianceLiveInvitation-round49-candidateA; full hash 2462963726; roll 26; selector index 2.
Offered choice: ECE asks Radiance whether she wants one quiet fully clothed two-person route-count with ECE while Ellie keeps the safe support and Alia continues the separate demonstration.
Response key batch382-georgia-scene1551-radianceLiveResponse-round49-candidateA; full hash 4039709306; roll 6; category explicit affirmative.
Participant key batch382-georgia-scene1551-radianceLiveParticipants-round49-candidateA; full hash 4080746313; roll 13; willing participants Radiance and AI ECE.
Radiance explicitly agrees with one unmistakable gentle up-down nod, a warm willing smile and sustained direct gaze to ECE, while her existing right palm voluntarily maintains ECE's outer-upper-arm contact and her left hand maintains Ellie's clasp. partyActivation = TRUE only for Radiance and AI ECE. ECE returns the willing eye line and smile while both compass hands stay fixed. Ellie remains a willing support partner outside the optional count with both dip hands fixed. Alia remains neutral and mission-focused outside it. Visible evidence is Radiance's nod, smile, gaze, and maintained contact plus ECE's returned smile. Continuity: one restrained two-adult count occurs without changing any hand or safety geometry. This consent is invitation-specific and transfers nowhere else.
Composition variant A: use the most orthogonal prop side profile, Alia at x=52-61, backstop at x=72-76, and a very bright empty promenade from x=79 to the edge.`,
  B: `CANDIDATE B LIVE NARRATIVE AND COMPOSITION
Invitation key batch382-georgia-scene1551-radianceLiveInvitation-round49-candidateB; full hash 2446186107; roll 7; selector index 3.
Offered choice: Alia asks Radiance whether she wants to answer the completed demonstration with a restrained quartet count or pause for another route check.
Response key batch382-georgia-scene1551-radianceLiveResponse-round49-candidateB; full hash 4022931687; roll 87; category explicit pause.
Participant key batch382-georgia-scene1551-radianceLiveParticipants-round49-candidateB; full hash 4030413456; roll 56; ignored because party is inactive.
Radiance explicitly pauses with raised attentive brows, a calm closed-mouth expression, and sustained direct gaze to ECE while her existing open right palm remains gently splayed on ECE's outer upper arm as a hold-there cue. partyActivation = FALSE. Willing participants: none. Ellie calmly maintains both support hands. ECE watches attentively with both compass hands fixed. Alia remains mission-focused. No nod, victory cue, celebration, drink, confetti, crowd, banner, or stage. Visible evidence is the attentive gaze, splayed hold cue, and absence of celebration. Continuity: everyone holds the safe geometry while Radiance considers the choice. This pause is invitation-specific and transfers nowhere else.
Composition variant B: place the romance trio slightly lower and farther left, keep Alia at x=50-60, and make the empty x=79-100 promenade especially wide and featureless.`,
  C: `CANDIDATE C LIVE NARRATIVE AND COMPOSITION
Invitation key batch382-georgia-scene1551-radianceLiveInvitation-round49-candidateC; full hash 2429408488; roll 88; selector index 0.
Offered choice: ECE asks Radiance whether she wants ECE and Alia to join one restrained fully clothed route-count while Ellie keeps the safe dip support.
Response key batch382-georgia-scene1551-radianceLiveResponse-round49-candidateC; full hash 4006154068; roll 68; category explicit affirmative.
Participant key batch382-georgia-scene1551-radianceLiveParticipants-round49-candidateC; full hash 4047191075; roll 75; willing participants Radiance, Alia, and AI ECE.
Radiance explicitly agrees with a gentle up-down nod, direct warm ECE gaze, and willing smile while maintaining the exact two dip contacts and her palm on ECE's outer upper arm. partyActivation = TRUE only for Radiance, Alia, and AI ECE. ECE returns the willing smile without moving either compass hand. Alia gives one small willing profile smile while her eyes and both mission hands remain safely downrange. Ellie remains a willing support partner outside the optional count. Visible evidence is Radiance's nod and smile, ECE's returned smile, and Alia's profile smile. Continuity: one restrained three-adult count occurs without moving support, compass, or mission geometry. This consent is invitation-specific and transfers nowhere else.
Composition variant C: give Alia the largest clean hand-and-prop silhouette at x=49-61 and use a narrow backstop at x=71-75 so at least one quarter of the frame remains empty to its right.`,
  D: `CANDIDATE D LIVE NARRATIVE AND COMPOSITION
Invitation key batch382-georgia-scene1551-radianceLiveInvitation-round49-candidateD; full hash 2546851821; roll 21; selector index 1.
Offered choice: Ellie asks Radiance whether all four women may mark the completed safe route lesson with one restrained fully clothed rain-count while every existing hand stays fixed.
Response key batch382-georgia-scene1551-radianceLiveResponse-round49-candidateD; full hash 3989376449; roll 49; category explicit affirmative.
Participant key batch382-georgia-scene1551-radianceLiveParticipants-round49-candidateD; full hash 4131079170; roll 70; willing participants Radiance, Ellie, Alia, and AI ECE.
Radiance explicitly agrees with a gentle up-down nod, direct warm ECE gaze, and willing smile while preserving all three relationship contacts. partyActivation = TRUE for all four adults only. ECE returns the willing smile with both compass hands fixed. Ellie smiles supportively while both dip hands remain fixed. Alia gives a small willing profile smile while her eyes and two mission hands remain downrange. No extra gesture, hand, prop, drink, confetti, crowd, banner, or stage. Visible evidence is Radiance's nod and direct smile plus each named participant's willing smile. Continuity: one restrained quartet count occurs without changing support, compass, or mission geometry. This consent is invitation-specific and transfers nowhere else.
Composition variant D: use the clearest side lighting on Alia's straight index, the black guard, and the air gap between them; keep the complete target assembly at x=69-75 and everything after x=78 empty.`,
};

fs.mkdirSync(root, { recursive: true });
const commonPath = path.join(root, "scene-1551-round-49-four-slot-common-prompt.txt");
fs.writeFileSync(commonPath, `${commonPrompt}\n`, "utf8");

const candidateRecords = {};
for (const [slot, narrative] of Object.entries(narratives)) {
  const narrativePath = path.join(root, `scene-1551-round-49-candidate-${slot}-narrative.txt`);
  fs.writeFileSync(narrativePath, `${narrative}\n`, "utf8");
  candidateRecords[slot] = {
    scene: 1551,
    path: path.relative(repo, narrativePath).replaceAll("\\", "/"),
    sha256: sha256Text(`${narrative}\n`),
    chars: narrative.length,
    response: slot === "B" ? "explicit pause" : "explicit affirmative",
    partyActivation: slot !== "B",
    willingParticipants: slot === "A" ? ["Radiance", "AI ECE"] : slot === "B" ? [] : slot === "C" ? ["Radiance", "Alia", "AI ECE"] : ["Radiance", "Ellie", "Alia", "AI ECE"],
  };
}

const rawRecords = [];
const rejectionRecords = [];
for (const slot of Object.keys(expectedRound48)) {
  const file = path.join(rawDir, `candidate-${slot}.png`);
  if (!fs.existsSync(file)) throw new Error(`Missing round-48 raw ${file}`);
  const sha256 = sha256File(file);
  if (sha256 !== expectedRound48[slot]) throw new Error(`Round-48 candidate ${slot} hash mismatch: ${sha256}`);
  const relative = path.relative(repo, file).replaceAll("\\", "/");
  rawRecords.push({
    scene: 1551,
    round: 48,
    kind: "four-slot-clean-candidate-rejected",
    candidateSlot: slot,
    path: relative,
    sha256,
    dimensions: { width: 941, height: 1672 },
    preserved: true,
  });
  rejectionRecords.push({
    scene: 1551,
    round: 48,
    phase: "four-slot-parallel-bank",
    candidateSlot: slot,
    status: "rejected-strict-visual-audit",
    rawOutput: relative,
    sha256,
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: round48Audit[slot].decisiveRejectionReasons,
    recoveryPassConsumedThisRound: false,
  });
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.rawOutputs = checkpoint.rawOutputs.filter((item) => !(item.round === 48 && item.candidateSlot));
checkpoint.rawOutputs.push(...rawRecords);
checkpoint.rejectedAssets = checkpoint.rejectedAssets.filter((item) => !(item.round === 48 && item.candidateSlot));
checkpoint.rejectedAssets.push(...rejectionRecords);
checkpoint.status = "active-round-49-four-slot-parallel-bank-prepared";
checkpoint.checkpointedAt = checkedAt;
checkpoint.contractSha256 = sha256File(contractPath);
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 3,
  missingSceneNumbers: [1551],
  queueAdvanceAllowed: false,
  xPublicStatusVerified: false,
  gateSatisfied: false,
};
checkpoint.rapidConsolidatedClosureWindow = {
  ...checkpoint.rapidConsolidatedClosureWindow,
  currentWave: 49,
  remainingWaves: 1,
  round48Result: "four-clean-candidates-preserved-and-rejected; every slot failed the independently certifiable trigger-index and empty-right-reserve gates, slots A-C also missed the exact horizontal paper-target axis, and slot D introduced a forbidden second marker",
};
checkpoint.contractAmendments.fixedFourSlotParallelRenderBank = {
  ...checkpoint.contractAmendments.fixedFourSlotParallelRenderBank,
  activeRound: 49,
  round48BankAudit: {
    completedAt: checkedAt,
    scene: 1551,
    launchMode: "four-concurrent-clean-generations-from-original-identity-anchors",
    sourceRenderInputCount: 0,
    rawOutputs: rawRecords,
    slotAudit: round48Audit,
    auditOrder: ["A", "B", "C", "D"],
    acceptedCandidate: null,
    allRejected: true,
    unresolvedGates: [
      "one independently readable straight trigger index entirely above and outside the empty guard",
      "one exact horizontal eye-sight-muzzle-black-diamond axis",
      "one complete backstop followed by at least eleven percent visibly empty promenade",
      "no second marker or target",
    ],
  },
  round49Preparation: {
    preparedAt: checkedAt,
    round: 49,
    sceneNumbers: [1551],
    preservedAcceptedSceneNumbers: [1548, 1549, 1550],
    slotAllocation: { A: 1551, B: 1551, C: 1551, D: 1551 },
    commonPrompt: {
      path: path.relative(repo, commonPath).replaceAll("\\", "/"),
      sha256: sha256File(commonPath),
      chars: commonPrompt.length,
    },
    candidateNarratives: candidateRecords,
    allKnownRound48CorrectionsConsolidated: true,
    sourceMode: "four-clean-independent-generations-from-original-identity-anchors-only",
    priorBatumiRenderInputCount: 0,
    launchMode: "four-concurrent-image-generation-calls-in-one-orchestration",
    auditOrder: ["A", "B", "C", "D"],
    winnerRule: "first exact passing candidate in deterministic slot order",
  },
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt,
  signedIn: true,
  sessionState: "live-signed-in-dogramaci-profile-loaded-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  latestVisibleAccountStatuses: [
    { url: "https://x.com/dogramaci/status/2087541233283408297", classification: "unrelated-account-text-post-not-a-World-Series-ledger-item" },
    { url: "https://x.com/dogramaci/status/2087540947533877380", classification: "unrelated-account-text-post-not-a-World-Series-ledger-item" },
    { url: "https://x.com/dogramaci/status/2087540818387128543", classification: "unrelated-account-text-post-not-a-World-Series-ledger-item" },
  ],
  reconciliationDecision: "The signed-in live @dogramaci profile and authoritative ledger show no eligible pending, prepared, or deferred World Series item. Georgia remains publication-blocked at three accepted scenes, so no upload or country advance is permitted.",
};
checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "blocked-active-country-incomplete",
  url: null,
  acceptedCurrentCountryAssets: 3,
  note: "Georgia retains accepted scenes 1548-1550. The four round-48 candidates were preserved and rejected under strict audit; round 49 is prepared as the final four-slot bank in this wake. The live @dogramaci profile is signed in and the eligible backlog remains empty. Publication remains blocked until scene 1551 passes and the four-scene checkpoint is pushed.",
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-round-49-four-slot-parallel-candidate-bank-from-original-identity-anchors-with-all-slots-targeting-scene-1551",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
ledger.latestGuardianWakeAudit = {
  status: "clear-no-eligible-backlog-georgia-round-49-prepared",
  checkedAt,
  account: "@dogramaci",
  liveProfileVerified: true,
  signedInAccount: "@dogramaci",
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  eligibleBacklogRemaining: 0,
  activeCountryAudit: { batch: 382, country: "Georgia", acceptedCurrentCountryAssets: 3, required: 4, eligible: false },
  latestVisibleAccountStatuses: checkpoint.xBacklogAudit.latestVisibleAccountStatuses,
  action: "No upload was submitted because the eligible queue is empty and Georgia remains below its authoritative four-accepted-scene gate.",
  duplicatePrevention: "Do not classify unrelated recent account posts as Georgia's required three-attachment publication and do not upload Georgia before scene 1551 is accepted.",
};
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: checkpoint.status,
  checkedAt,
  round48AllRejected: true,
  round48RawHashes: Object.fromEntries(rawRecords.map((item) => [item.candidateSlot, item.sha256])),
  round49CommonPrompt: checkpoint.contractAmendments.fixedFourSlotParallelRenderBank.round49Preparation.commonPrompt,
  round49Candidates: candidateRecords,
  eligibleBacklogRemaining: ledger.latestGuardianWakeAudit.eligibleBacklogRemaining,
}, null, 2));

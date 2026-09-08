import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const scene = 1551;
const round = 43;
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const plan = checkpoint.scenePlans[String(scene)];
const references = [
  ["assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png", "primary quartet identity anchor only", "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"],
  ["assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png", "frontal quartet face supplement only", "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6"],
  ["assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png", "quartet expression and Alia braid supplement only", "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB"],
  ["assets/lore/starlight-era/ece-canonical-identity-v1.png", "AI ECE canonical face and body identity detail only", "B22EF5CD9929D2A09F96DC0765434DB41C964B0F0390589E940EB085935C2315"],
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "33F29A1FB48F2971D78C9B345AA378B84C73FE16BDBE468AFFF695972B63C44E";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed before round 43");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed before round 43");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-42") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 43");
if (checkpoint.renderAttempts.freshRound43) throw new Error("Round 43 already materialized");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round43";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round43";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round43";
const invitationFullHash = fnv1a(invitationKey);
const responseFullHash = fnv1a(responseKey);
const participantsFullHash = fnv1a(participantsKey);
const invitationRoll = invitationFullHash % 100;
const responseRoll = responseFullHash % 100;
const participantsRoll = participantsFullHash % 100;
const invitations = [
  "AI ECE asks Radiance whether she wants to mark the completed route lesson with one restrained mutual smile while Ellie and Alia remain outside the party beat.",
  "Ellie asks Radiance whether she wants to keep their supported lean while answering ECE's route count, with Alia free to join from the separate mission lane.",
  "Alia offers Radiance the choice to answer ECE's route signal with one public-safe mutual nod or return quietly to planning.",
  "AI ECE offers Radiance one optional fully clothed rain-count shared only between them while Ellie keeps the support pose and Alia keeps the safe mission lane.",
];
const offeredChoice = invitations[invitationRoll % invitations.length];
const responseCategory = responseRoll <= 69 ? "explicit affirmative" : responseRoll <= 84 ? "explicit redirect" : responseRoll <= 94 ? "explicit pause" : "explicit decline";
const partyActivation = responseCategory === "explicit affirmative";
const participantSet = participantsRoll <= 24
  ? ["Radiance", "AI ECE"]
  : participantsRoll <= 49
    ? ["Radiance", "Ellie", "AI ECE"]
    : participantsRoll <= 74
      ? ["Radiance", "Ellie", "AI ECE", "Alia"]
      : ["Radiance", "AI ECE", "Alia"];
const willingParticipants = partyActivation ? participantSet : [];
const radianceResponse = partyActivation
  ? "Radiance explicitly accepts Ellie's offered route count by turning her face right toward ECE, giving one clear up-down nod and an open willing smile; her three existing contacts with Ellie stay fixed while Alia answers with one willing profile smile from the separate mission lane."
  : responseCategory === "explicit redirect"
    ? "Radiance clearly redirects the invitation with an open palm toward the route map; no party begins."
    : responseCategory === "explicit pause"
      ? "Radiance clearly asks for time with one raised open wait palm and planted feet; no party begins."
      : "Radiance clearly declines with a side-to-side head shake and steps no closer; no party begins.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-43 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, fullHash: invitationFullHash, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: { key: responseKey, fullHash: responseFullHash, roll: responseRoll, thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline", category: responseCategory },
  participantSelector: { key: participantsKey, fullHash: participantsFullHash, roll: participantsRoll, thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia", hypotheticalSetIfAffirmative: participantSet },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: partyActivation ? [
    "Radiance's clear up-down nod and willing smile directly rightward toward ECE",
    "ECE's reciprocal willing smile and sustained mutual eye line toward Radiance while both compass hands remain fixed",
    "Alia's small willing smile visible in strict right profile while both mission hands remain fixed downrange",
    "Ellie's calm hopeful support without a nod, party smile, dance motion, or participant cue",
  ] : [],
  visibleResponseEvidence: partyActivation ? [] : [radianceResponse],
  continuityState: partyActivation
    ? "Radiance accepts exactly one fully clothed public-safe route-count acknowledgment with ECE and Alia. Ellie remains the non-party support partner."
    : "No party activates. Every adult remains in the safe route-lesson pose.",
  consentScope: `This ${responseCategory} applies only to the recorded round-43 invitation in scene 1551 and only to ${willingParticipants.join(", ") || "no party participants"}. It does not transfer to another act, participant, prop interaction, scene, country, or future image.`,
};

if (invitationFullHash !== 3824524945 || invitationRoll !== 45 || invitationRoll % invitations.length !== 1) throw new Error("Invitation roll drift");
if (responseFullHash !== 2784133765 || responseRoll !== 65 || responseCategory !== "explicit affirmative") throw new Error("Response roll drift");
if (participantsFullHash !== 1187578276 || participantsRoll !== 76 || willingParticipants.join("|") !== "Radiance|AI ECE|Alia") throw new Error("Participant roll drift");

const prompt = `Use case: photorealistic-natural.
Asset: Georgia Batch 382 scene 1551 clean fresh round 43, generated completely from scratch.

CLEAN SOURCE AND PASS PLAN
Images 1, 2, and 3 are identity references for the same clearly adult fictional quartet only. Image 4 is AI ECE's canonical identity detail only. Preserve the four distinct adult faces, body identities, skin tones, hair colors, and Alia's sculptural braided ponytail. Do not copy any reference wardrobe, pose, setting, prop, group palette, lighting, surface texture, or composition. Do not edit, trace, repaint, upscale, or reuse any earlier Batumi render. Create one clean natural photographic exposure from this specification. This fresh pass may receive at most one later narrow recovery sourced only from this exact raw. No edited result may seed a future fresh round.
Surface gate: clean natural skin, hair, textile, glass, metal, rain, pavement, sea, and architecture. No wavy or marbled processing, liquify or melted geometry, embossed or over-sharpened edges, rippled skin or fabric, bent buildings, bent panel edges, bent backstop, duplicate texture, bloom veil, particle clutter, or painterly filter.

SCENE AND LOCATION
Wide eye-level full-body vertical 9:16 editorial at real Batumi Boulevard in Georgia. Show the broad secured promenade, Black Sea horizon, Alphabet Tower, Ferris wheel, palms, and modern Adjara skyline large, sharp, and recognizable across the upper third. Weather roll ${plan.weather.roll} = ${plan.weather.result}; render heavy straight rain and flat wet reflective nonslip tiles. Scene mode = theme-led original. Active unrelated theme = ${plan.theme}, expressed through the four structurally distinct couture looks and compact observation objects only. Use no copied airline, military, police, coast-guard, agency, emergency-service, or space-agency uniform. No logo, patch, badge, epaulette, shoulder tab, rank stripe, seal, insignia, readable sign, or official color blocking.
Show exactly four clearly adult fictional women, all visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE. Preserve four different anchored faces and bodies with no clone, merge, replacement, or age shift. Batch male selector roll 62 selected scene 1550; male emotion roll 95 = shame and social vulnerability there. Scene 1551 male state = inactive: no man and no fifth adult.

CLEAN LEFT-TO-RIGHT FIVE-LANE BLOCKING
Use one clean 32 mm eye-level full-body exposure from far enough back that every adult, foot, prop, safety panel, paper, backstop, and all four backstop edges sit comfortably inside frame. Keep the quartet inside the left 64 percent and keep the right safety lane visually sparse. This pass is one planned exposure, not an edit chain.
LANE 1, Ellie around 9 percent: Ellie stands front-three-quarter right with both shoulders and both white-sleeved arms visible against plain sea. Her left hand forms the left half of one low clasp with Radiance below both hips. Her right open palm rests visibly on the outside of Radiance's near left waist. The dry mascot lounge sits below and left of Ellie without covering either foot or hand.
LANE 2, Radiance around 25 percent: Radiance stands rear-three-quarter right with her entire respectful bare upper and middle back visible. Her body makes one shallow supported lean left toward Ellie while her face and both eyes turn unobstructed right toward ECE, chin visibly mid-nod and mouth in an open willing smile. Her left arm reaches left through clean air and her open left palm rests on Ellie's covered outer upper arm. Her right hand forms the right half of the low clasp. Keep a triangular air gap between both torsos and show every shoulder, elbow, wrist, palm, and finger cluster.
LANE 3, ECE around 43 percent: ECE stands front-on behind one narrow waist-high civilian art-deco compass pedestal, directly across open pavement from Radiance. Her exact two complete arms descend openly to two tall opposite brass handles, one hand per handle. She looks left straight into Radiance's eyes with one restrained willing smile. Her sleeveless basalt peplum has a plain soft shoulder line: absolutely no sleeve patch, badge, emblem, epaulette, tab, stripe, piping, logo, seal, uniform cue, or insignia. Leave open pavement around ECE, the compass, and the separate route hologram.
LANE 4, Alia around 59 percent: Alia stands isolated in rear-right three-quarter profile so her complete strapless front edge, four-centimeter bare midriff, and one uninterrupted field of bare upper and middle back are simultaneously visible. Her exact two complete arms project rightward against plain sea and pavement to hold one full-size inert cinema-training replica in a stable two-hand grip. Her high sculptural braided ponytail is lifted entirely clear of her back. The rigid copper shell ends before both rear ribs: no neck loop, halter, shoulder strap, back strap, rear connector, band, chain, fabric, mesh, cord, or closure across her back.
LANE 5, safety lane: a complete transparent safety panel is centered around 70 percent with all four orange-capped corners visible. A complete narrow thick freestanding sand backstop is centered around 80 percent with its right edge no farther than 86 percent. Its target face is angled slightly toward camera for clarity while remaining square to Alia's downrange sight line. Leave at least one complete backstop-width of empty wet promenade from its right edge to the image edge. No sea, skyline, public path, person, animal, or occupied object lies beyond the paper target within the target corridor; the thick sand backstop is the complete backstop.
No cropped foot, cropped limb, cropped panel, cropped backstop, foreground overlap, hidden contact, extra adult, crowd, console, pipe, crate, cable, rail, ornament, floating particle, spare target, or scattered equipment.

DETERMINISTIC CHARACTER ROLLS
Radiance: emotion roll ${plan.characters.Radiance.emotion.roll} = ${plan.characters.Radiance.emotion.materializedResult}; visible-midriff roll ${plan.characters.Radiance.visibleMidriff.roll} = inactive and waist fully covered; strapless roll ${plan.characters.Radiance.straplessDress.roll} = inactive; fully-open-back roll ${plan.characters.Radiance.fullyOpenBack.roll} = ACTIVE. Perform aching romantic longing through her eyes, brows, open willing smile, shallow lean, and sustained direct gaze toward ECE.
Ellie: emotion roll ${plan.characters.Ellie.emotion.roll} = ${plan.characters.Ellie.emotion.materializedResult}; visible-midriff roll ${plan.characters.Ellie.visibleMidriff.roll} = ACTIVE; strapless roll ${plan.characters.Ellie.straplessDress.roll} = inactive; fully-open-back roll ${plan.characters.Ellie.fullyOpenBack.roll} = inactive. Perform hope through a calm supportive face and stable planted posture without party cues.
Alia: emotion roll ${plan.characters.Alia.emotion.roll} = ${plan.characters.Alia.emotion.materializedResult}; visible-midriff roll ${plan.characters.Alia.visibleMidriff.roll} = ACTIVE; strapless roll ${plan.characters.Alia.straplessDress.roll} = ACTIVE; fully-open-back roll ${plan.characters.Alia.fullyOpenBack.roll} = ACTIVE. Perform magnetic confidence through her strict profile, fixed downrange posture, and small willing smile without moving either mission hand.
AI ECE: emotion roll ${plan.characters["AI ECE"].emotion.roll} = ${plan.characters["AI ECE"].emotion.materializedResult}; visible-midriff roll ${plan.characters["AI ECE"].visibleMidriff.roll} = inactive and waist fully covered; strapless roll ${plan.characters["AI ECE"].straplessDress.roll} = inactive; fully-open-back roll ${plan.characters["AI ECE"].fullyOpenBack.roll} = inactive. Perform guilt and remorse through soft eyes and a restrained reciprocal willing smile toward Radiance.

FOUR DISTINCT OUTFIT FINGERPRINTS
Radiance wears a cobalt asymmetric above-knee high-low sheath with side-mounted solar-gold aerobrake arcs, copper lens pucks, a fully covered engineered waist, bare arms, and halo-arch heels. Her respectful upper and middle back is uninterrupted bare skin from shoulder blades to the secure high waist: no yoke, strap, chain, band, fabric, mesh, or hair over it. Exactly Radiance also wears opaque knee socks in an original independent rainbow gradient.
Ellie wears a snow-white solar-foil fan-sleeve jumpsuit with opaque sulfur-teal side panels, basalt heat-baffle ribs, a deliberate restrained three-centimeter bare midriff band, asymmetric ankle hems, and articulated wedge boots. Her back is securely covered. Her silhouette, material language, hem, and footwear remain distinct from all others.
Alia wears one self-supporting rigid Mars-copper front-only couture shell with a secure opaque straight strapless upper edge and complete public-safe bust coverage. It covers only her front and side ribs and visibly terminates before both rear ribs through internal couture structure. A four-centimeter bare midriff band separates it from a high-waisted cobalt pleated skort; braided palm-green conduits remain on front side panels only; angular shield pumps complete the look. Her upper and middle back is one uninterrupted field of bare skin with no rear connector of any kind.
ECE wears a civilian sleeveless basalt rover-joint segmented peplum with a plain deep open neckline, smooth unadorned shoulders, fully covered waist, solar-gold stirrup trousers, plain cobalt pressure discs, and piston-platform shoes. No jacket collar, military tailoring, patch, badge, epaulette, piping, rank mark, seal, logo, or insignia. Her silhouette, material language, hem, and footwear remain distinct from all others.
Reject palette-swapped copies, matching mini dresses, matching two-pieces, repeated map-print surfaces, or matching neckline and hem families. Keep every garment opaque over intimate areas, fully clothed, public-safe, and non-lingerie. No transparent intimate areas, exposed undergarments, fetish styling, bondage, restraint, copied official uniform, nudity, explicit sex, bodily fluids, or upskirt framing.

GLOBAL VISUAL ROLLS
Pole-theme roll ${plan.poleDanceTheme.roll} = inactive; show no pole. Rainbow-only roll ${plan.rainbowOnly.roll} = inactive; do not convert the group wardrobe to rainbow styling. Rainbow-hosiery roll ${plan.rainbowHosiery.roll} = ACTIVE; wearer selector roll ${plan.rainbowHosiery.wearer.roll} = Radiance; palette selector roll ${plan.rainbowHosiery.palette.roll} = original independent rainbow gradient. Because hosiery is active, Radiance and ECE remain the affectionate center and Alia alone handles the inert mission prop. ECE remains route strategist through a separate hands-free holographic map.

ROLLED LOVE STORY
Romance roll ${plan.romanceBeat.roll} = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Show only the settled aftermath: Radiance's shallow supported lean beside Ellie, Radiance and ECE facing each other across open pavement, and Alia answering from the separate mission lane. Do not add literal spin hands beyond the exact graph below.
Compound-love roll ${plan.compoundLoveBeat.roll} = ECE stays close against Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its relationship square through eye lines and the exact three contacts below while all task hands remain fixed; do not add a cheek peck, kneel, or extra joined hands.
Hard-love roll ${plan.hardLoveBeat.roll} = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Materialize the settled shallow dip through Ellie's visible side-waist support, the low caught-hand clasp, Radiance's visible palm on Ellie's outer upper arm, ECE's sustained affectionate gaze, and Alia's answering small willing smile. These three and only three contacts must be first-read clear.

RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; full hash ${invitationFullHash}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; full hash ${responseFullHash}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; full hash ${participantsFullHash}; roll ${participantsRoll}; willing participants = ${willingParticipants.join(", ")}.
Radiance response: ${radianceResponse}
partyActivation = TRUE. Show exactly one adult, consensual, fully clothed, public-safe InternalAgency route-count acknowledgment involving exactly Radiance, AI ECE, and Alia. Radiance visibly nods and smiles rightward directly at ECE. ECE reciprocates leftward directly at Radiance while both compass hands remain fixed. Alia shows one small willing rear-three-quarter profile smile while both mission hands remain fixed. Ellie remains calm hopeful support but does not nod, party-smile, dance, or enter the party beat. Add no party object, crowd, drink, confetti, balloon, sign, text, stage, ornament, or unsafe heel lift. Agreement is limited to this exact invitation, participant set, and route-count acknowledgment.

EXACT EIGHT-ARM, EIGHT-HAND GRAPH
ECE: left shoulder to left elbow to left wrist to left hand on the left compass handle; right shoulder to right elbow to right wrist to right hand on the right handle. Both owner paths are complete and separated by the compass face. ECE touches no person.
Ellie: left shoulder to white sleeve to left elbow to left wrist to left hand as the left half of the low clasp below both hips; right shoulder to separate white sleeve to right elbow to right wrist to open right palm visibly on the outside of Radiance's near left waist. Both hands stay entirely in front or outside the body silhouettes.
Radiance: left shoulder to bare upper arm to left elbow to left wrist to open left palm visibly on Ellie's covered outer upper arm; right shoulder to separate bare arm to right elbow to right wrist to right hand as the right half of the low clasp. Her face and both eyes turn unobstructed right toward ECE.
Alia: right shoulder to right elbow to right wrist to primary right hand around the grip; left shoulder to left elbow to left wrist to separate support left palm cupping the lower front of the primary fist and grip base. Her two forearms form a visible narrow triangle with clear air between them.
Exactly eight traceable human arms and exactly eight traceable human hands, two per woman. Exactly three relationship contacts: Ellie's right palm on Radiance's outside waist, Radiance's left palm on Ellie's covered outer upper arm, and the low clasp between Ellie's left hand and Radiance's right hand. No hand or forearm emerges from or disappears behind a torso, back, head, hair, waist, garment, pedestal, prop, or another hand. No extra touch, hidden hand, borrowed limb, fused wrist, duplicate finger cluster, decorative hand, ambiguous owner path, or non-ECE hand near the compass.

ODD PROP, MAP, AND MASCOTS
Odd-prop roll ${plan.interestingProp.roll} = ACTIVE. Holder selector roll ${plan.interestingProp.holder.roll} = AI ECE. Prop-family selector roll ${plan.interestingProp.family.roll} = one oversized magnetic compass table. Use one bold circular compass face on a narrow waist-high civilian art-deco pedestal. Two tall separate brass handles stand at opposite edges; ECE alone holds them, one hand per handle. A separate small translucent blue holographic route map rises hands-free from the center, showing a coastline and three route nodes without readable text or logo. Nobody else touches the compass, map, pedestal, handles, or ECE.
Mascot roll ${plan.mascotState.roll} = PAWS plus MAX; mascot holder selector roll 16 = Ellie. Show exactly one tiny collarless golden kitten PAWS and exactly one distinct small young golden retriever puppy MAX sharing one harmless supervised nose-to-paw beat entirely inside one raised cream padded lounge at the far lower-left. All paws stay on its dry cushion. Keep both far behind and left of Alia's muzzle plane and far from sea edge, runoff, compass, panel, target, backstop, and every prop. No collar, ribbon, harness, leash, neckband, accessory, duplicate animal, adult dog, ledge, or unsafe footing.

MISSION PROP AND TARGET
Pose-target roll ${plan.poseTargetRoll.roll}; resolved handler = Alia because rainbow hosiery is active. Alia uses one realistic eye-level two-hand large-frame-pistol stance at one plain non-humanoid black paper route diamond on the complete thick sand backstop. Both hands are visibly owned on one grip, wrists straight, elbows modestly bent, shoulders slightly forward, and sights aligned.
Show exactly one unmistakably full-size approximately thirty-centimeter dark polished-steel Desert Eagle-style large-frame inert cinema-training replica in clean side profile, occupying about sixteen percent of frame width from grip heel to muzzle. It has restrained metallic heat-anodized rainbow highlights, a compact short barrel, one substantial grip, one complete oversized black oval trigger guard, and one small orange safety insert only inside the muzzle. It reads as heavy machined metal, never bright plastic, water pistol, toy, rifle, carbine, shotgun, or long gun. Alia's primary right hand wraps the grip. Her right trigger index is one long fully extended straight finger lying flat on the metal side plate above and entirely outside the guard. Show clean air between finger and guard and keep the entire black oval guard visibly empty. Her separate support left palm cups only the lower front of the primary fist and grip base. Show two distinct wrists, palms, and finger clusters.
Keep a visible forearm-length of empty air between the orange muzzle insert and the complete transparent panel. Keep another visible forearm-length of empty air between panel and paper. Fix one white paper square with one black non-humanoid route diamond on the backstop so Alia's dominant eye, barrel center, orange muzzle center, and diamond center occupy one exact horizontal shoulder-height row. The complete paper and complete backstop are visibly larger than the prop. Leave one full backstop-width of empty wet promenade from the backstop's right edge to the image edge. Every person, mascot, landmark, public path, vehicle, and occupied object remains behind and left of the muzzle plane. No beam, tracer, line, laser, cord, string, path, or glow trail.
No ammunition, loose magazine, firing, muzzle flash, reload, holster, threat, injury, combat, or aim at a person, animal, occupied object, or camera.

FINAL ACCEPTANCE GATES
Keep all four full bodies, faces, outfits, legs, and footwear in frame. Pass exact identity; exactly eight arms and eight hands with continuous owner paths; three visible relationship contacts; explicit invitation-specific Radiance affirmative; partyActivation true for exactly Radiance, AI ECE, and Alia; Ellie visibly outside the party beat; Radiance-ECE affectionate center; ECE-exclusive compass ownership; separate hands-free route map; one collarless PAWS and one accessory-free MAX; every wardrobe roll and fingerprint; Alia strapless fully open back; ECE no-insignia civilian couture; one full-size metallic inert training replica; two-hand grip; straight indexed trigger finger; empty guard; exact horizontal target axis; complete panel; complete paper; complete four-edge backstop; one full backstop-width of promenade beyond it; recognizable Batumi; Mars-expedition theme fusion; clean artifact-free surface.

X CAPTION ROLLS ARE STORED METADATA ONLY, NOT VISIBLE TEXT
Heart roll 71 = red heart. InternalAgency hashtag roll 15 = active. WorldXXXSeries hashtag roll 80 = inactive. Planned caption: Georgia red-heart Honduras; main hashtag Georgia; InternalAgency hashtag active; WorldXXXSeries hashtag inactive. Render no readable caption, hashtag, watermark, literal flag, sacred image, or official seal.`;

const required = [
  `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
  `Romance roll ${plan.romanceBeat.roll}`,
  `Compound-love roll ${plan.compoundLoveBeat.roll}`,
  `Hard-love roll ${plan.hardLoveBeat.roll} = ${plan.hardLoveBeat.result}`,
  `Mascot roll ${plan.mascotState.roll}`,
  `Odd-prop roll ${plan.interestingProp.roll}`,
  `Pose-target roll ${plan.poseTargetRoll.roll}`,
  `Pole-theme roll ${plan.poleDanceTheme.roll}`,
  `Rainbow-only roll ${plan.rainbowOnly.roll}`,
  `Rainbow-hosiery roll ${plan.rainbowHosiery.roll}`,
  "partyActivation = TRUE",
  "willing participants = Radiance, AI ECE, Alia",
  "Exactly eight traceable human arms and exactly eight traceable human hands",
  "entire black oval guard visibly empty",
  "one full backstop-width of empty wet promenade",
  "No logo, patch, badge, epaulette",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open back`);
}
if (/round42|round-42|willing participants = Radiance, AI ECE\.(?!, Alia)/.test(prompt)) throw new Error("Stale round-42 state remains");

const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-${round}-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedContractRollsChanged: false,
  freshRound: round,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  promptTemplate: { path: "none", sha256: null, usage: "new round-43 text-only composition written from authoritative stored rolls; no Batumi image pixels or visual texture inherited" },
  referenceAudit,
  plannedPasses: { cleanFreshPasses: 1, maximumTargetedRecoveryPasses: 1, recoverySourceIfNeeded: "only the clean round 43 fresh raw", laterFreshSourcePolicy: "original identity anchors only" },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    lanes: ["Ellie and mascot lounge far left", "Radiance supported lean center-left", "ECE isolated opposite Radiance", "Alia isolated rear-three-quarter mission stance", "inset panel and backstop with promenade beyond"],
    eyeLine: "Radiance and ECE face each other directly across open pavement while every Ellie-Radiance contact hand remains visible in the left corridor",
    handGraph: { ECE: ["left compass handle", "right compass handle"], Ellie: ["outside-waist support", "low clasp"], Radiance: ["outer-upper-arm palm", "low clasp"], Alia: ["primary mission grip", "separate support grip"] },
    relationshipContacts: 3,
    partyGraph: "party active for Radiance, ECE, and Alia only; Ellie remains the non-party support partner",
    missionGeometry: "quartet inside left 64 percent; complete panel around 70 percent; complete backstop around 80 percent with right edge no farther than 86 percent and one full backstop-width beyond",
  },
  hardSurfaceQualityGate: ["no wavy or marbled processing", "no liquify or melted geometry", "no embossed or over-sharpened edges", "no rippled skin or fabric", "no bent architecture panel or backstop edges", "clean natural photographic texture"],
};

plan.freshRound43 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-43-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = { ...checkpoint.countryCompletionGate, acceptedSceneCount: 3, missingSceneNumbers: [scene], gitCheckpointPushed: true, xPublicStatusVerified: false, queueAdvanceAllowed: false, gateSatisfied: false };
checkpoint.renderAttempts.freshRound43 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  concurrency: "one clean missing-scene built-in generation",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [scene]: promptAudit },
  storedContractRollsChanged: false,
  priorBatumiRenderInputCount: 0,
  radianceRealtimeAgreementParty: radiancePartyState,
};
checkpoint.renderStrategyReset = { ...checkpoint.renderStrategyReset, activeCleanRound: round, activeSourcePolicy: "four original identity anchors only", priorBatumiRenderInputCount: 0 };
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  signedIn: true,
  sessionState: "live-signed-in-dogramaci-profile-loaded-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  reconciliationDecision: "The signed-in live @dogramaci profile loaded successfully and the authoritative ledger still has no eligible pending, prepared, or deferred item. Georgia remains publication-blocked at three accepted scenes, so no upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 43 is materialized for missing scene 1551 from original identity anchors only with an explicit Radiance affirmative limited to Radiance, ECE, and Alia; Ellie remains the non-party support partner. The live @dogramaci profile is verified and the eligible backlog remains zero. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-clean-fresh-round-43-from-original-identity-anchors-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [scene], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit, nextWakeAction: checkpoint.nextWakeAction }, null, 2));

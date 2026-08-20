import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkpointPath = resolve(root, "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json");
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const profilePath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_active_suppression_profile.json";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"
];
const selectedSha256 = "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D";
const primarySentAtUtc = {
  1: "2026-08-20T14:07:58.340Z",
  2: "2026-08-20T14:07:58.363Z",
  3: "2026-08-20T14:07:58.317Z",
  4: "2026-08-20T14:07:58.376Z"
};
const promptByLane = Object.fromEntries([1, 2, 3, 4].map((lane) => {
  const path = `tmp/world-195x4/batch-392/scene-1588-meta-successor-i-tab-${lane}-primary.txt`;
  const text = readFileSync(resolve(root, path), "utf8");
  return [lane, { path, sha256: sha256(Buffer.from(text)), bytes: Buffer.byteLength(text), text, exactText: text }];
}));
const blacklistSnapshotSha256 = sha256(readFileSync(lexiconPath));
const activeSuppressionProfileSha256 = sha256(readFileSync(profilePath));

const responseByLaneAndSlot = {
  1: [
    "Scene 1588 — 16-degree Dutch tilt with Radiance's windblown blonde hair large near foreground, sitting sideways across Ellie's securely clothed upper-thigh support on the low storm perch, Alia far-left with voluminous curls leaning in for the closed-mouth cheek affection while holding Radiance's hand, Ellie supporting at the waist with the calm jealous look toward Alia, ECE far-right both hands on the small closed gold lantern. Exterior TRAPPIST-1 e ground below, broad storm horizon, transparent pressure field keeping footing dry while wind-driven rain and lightning stay outside, Hanifaru lagoon curves and faro rings reading through the cultural structures.",
    "Neutral research-deck version for 1588 — all four standing on the low padded perch on exposed TRAPPIST-1 e terrain, same locked faces from 938/936/937 with Alia far-left voluminous curls, blonde Radiance second with windblown hair large in foreground, Ellie third, ECE far-right both hands on the small closed gold route lantern, side hugs and hand-holds with diagonal spacing, transparent pressure field keeping footing dry while wind-driven rain and lightning stay outside and the Hanifaru lagoon / faro rings / manta arcs glow through the Maldives cultural installation, hotter amber horizon glow and complete heels still readable. Want to refine the RAZE marks and storm light further?",
    "Closer camera from behind for 1588 — Alia far-left voluminous curls, blonde Radiance second, Ellie third, ECE far-right with the gold lantern, all on the research perch with backs to camera looking out toward the Hanifaru lagoon curves, faro rings and manta arcs under the pressure field, amber horizon glow and lightning ahead, complete heels and RAZE Split-Star / wordmark at the outer calf still readable, secure sequined minis with full seat coverage from the rear. Want to bring their faces more around or push the storm light further?",
    "Closer behind angle with faces turned more toward camera — same locked faces from 938/936/937, TRAPPIST-1 e perch with pressure field and storm ahead, RAZE knee-highs on Radiance and Alia. Want to keep this exact framing?",
    "I'm tightening the framing for a closer front-facing medium shot, adding a subtle Dutch tilt and positioning the group diagonally so their full bodies and heels stay visible while the stormy horizon and glowing rim light frame the scene.",
    "Closer with two turned around for friendly behind hugs — Alia far-left curls and ECE far-right high ponytail behind, Radiance blonde second and Ellie center front holding the gold lantern, tight friendly group on the TRAPPIST-1 e perch with pressure field, wind-driven rain, lightning and rainbow outside and Hanifaru lagoon curves below, RAZE and Split-Star at outer calf still readable with complete heels. Want to lock this friendly behind-hug framing?",
    "Hotter-light standing huddle for 1588 — Alia far-left voluminous curls, blonde Radiance second with windblown ponytail, Ellie third and ECE far-right with the gold lantern, tight friendly group on the TRAPPIST-1 e perch inside the pressure field with wind-driven rain, lightning and full rainbow outside, Hanifaru lagoon and faro rings below, intense amber sunset rim light and RAZE / Split-Star at outer calf with complete heels still readable. Want to keep this hotter glow or tighten the framing more?"
  ],
  2: [
    "Scene 1588 on TRAPPIST-1 e — four distinct adult women in diagonal stride across the exposed terrain under the transparent pressure field, Alia far left with voluminous curls catching Radiance's hand, blonde Radiance second twisting into close side hug with brief closed-mouth cheek affection, Ellie third closing from behind with waist embrace and steadying hand plus calm jealous over-shoulder look, ECE far right pivoting into the shared eye-line with both hands on the small closed gold lantern, 12-degree Dutch roll with flying hair and complete heels mid-step, Hanifaru lagoon curves and faro rings as large cultural installations with storm sky beyond the shield, and the flipped RAZE assignment for this scene — Radiance Split-Star left / RAZE vertical right and Alia reversed, Ellie and ECE bare-legged.",
    "Tighter lens on Scene 1588 — floor-height front-quarter view moved in close to keep the secure opaque coverage intact while emphasizing the Hanifaru faro and manta arc couture print, sequin sparkle, tailored mini-skort hems, and the rainbow RAZE knee-highs with crisp Split-Star and vertical RAZE, Alia far left with voluminous curls catching Radiance's hand, Radiance second in close side hug with cheek affection, Ellie third with gentle waist embrace and calm jealous over-shoulder look, ECE far right both hands on the closed gold lantern, diagonal stride with flying hair and mid-step heel under the transparent pressure field with storm lightning beyond.",
    "Closer floor-height camera on the heels — low front-quarter angle now tight on the complete gold and cobalt pumps, turquoise and sand slingbacks, and the rainbow RAZE knee-highs with Split-Star and vertical RAZE marks readable, while still keeping secure opaque mini-skorts and short rompers with full bust, seat and pelvic coverage, diagonal stride with one heel mid-step, flying hair and readable faces under the transparent pressure field with storm lightning beyond.",
    "Closer skirt-focused crop for Scene 1588 — lens tightened to the secure sequined mini-skort hems with large Hanifaru faro ring and manta arc print, gold-thread detailing and opaque side seams fully readable, Radiance and Alia's rainbow RAZE knee-highs with vertical RAZE and Split-Star marks sharp, complete heels mid-stride and torsos with large faces still in frame under the pressure field, diagonal motion and flying hair preserved.",
    "Way closer rear tracking as they run — camera in tight behind the quartet pushing forward toward the Hanifaru faro rings and storm lightning beyond the transparent pressure field, Alia far left with voluminous curls, Radiance second with side hand on Alia, Ellie third and ECE far right with the small closed gold lantern, secure sequined minis and mini-skorts with complete seat and pelvic coverage from behind, rainbow RAZE knee-highs with Split-Star and vertical RAZE readable and complete heels mid-stride with flying hair.",
    "Even tighter rear tracking — camera pulled in close on the complete cobalt and gold pumps and rainbow RAZE knee-highs with Split-Star and vertical RAZE wordmarks extra crisp, Alia far left and Radiance second mid-stride with secure sequined mini-skorts and full seat coverage still readable, Ellie third and ECE far right with the closed gold lantern driving forward toward the Hanifaru faro rings under the pressure dome, flying hair and storm beyond.",
    "Even tighter on the heels and RAZE marks — rear low-angle now filled by the cobalt and gold pumps mid-splash with the rainbow gradient knee-highs extra large, vertical RAZE and gold glitter Split-Star sharp on outer calves, secure sequined mini-skorts with complete seat coverage still holding in the upper frame as the quartet drives forward with the closed gold lantern.",
    "Single new frame, even closer — tight crop on the gold and cobalt stiletto pumps mid-splash with the rainbow RAZE knee-highs filling the frame, vertical RAZE wordmark and gold Split-Star extra sharp on outer calves, secure sequined mini-skort hems just at top edge.",
    "I'm recreating the image with stronger, more dramatic water splashes erupting around the four heels, freezing fine droplets mid-air, and sharpening the rainbow RAZE knee-highs and glitter accents for a more intense, photoreal look.",
    "Closer friendly-behind-hugs take — Alia turned in with voluminous curls giving Radiance a warm side hug from behind, Radiance leaning back with closed-mouth cheek affection, Ellie closing from behind with gentle waist embrace and steadying hand and calm over-shoulder look, ECE far right both hands on the closed gold lantern pivoted into their eye line, diagonal forward stride with flying hair, splash under cobalt and gold pumps and rainbow RAZE knee-highs with Split-Star and vertical RAZE readable, pressure dome with lightning beyond and Hanifaru faro rings ahead.",
    "Tightest yet on the complete heels and RAZE rainbow knee-highs — cobalt and gold stilettos mid-splash frozen with water droplets sharp, vertical RAZE wordmark and gold glitter Split-Star at maximum crispness on outer calves, secure manta sequined mini-skort hems just at top edge."
  ],
  3: [
    "Polished pass is in — tighter compact horizontal RAZE marks at the outer calf, boosted blue rim light on the transparent pressure dome at deep violet dusk, warmer closed gold lantern glow in ECE's hands, and the playful two-on-lap seating with complete opaque coverage and complete footwear still locked to your 938 / 936 / 937 face quartet.",
    "Closer cute frame locked — Alia turned sideways on the chaise facing in, Radiance center, Ellie and ECE close with the warm closed gold lantern, all four from your 938 / 936 / 937 quartet with faces large, RAZE rainbow pairs on Alia + Ellie and bare legs on Radiance + ECE, Baa rings glowing through the cyan-lit dome at dusk.",
    "Way closer head-lap moment — Radiance blonde laying with her head across Alia's securely clothed thighs holding hands, Ellie and ECE leaning in close with the closed gold lantern glowing, all four 938-locked faces filling the top of the frame with TOI-700 d violet dusk and Baa rings behind the dome.",
    "Even tighter head-lap framing — Radiance blonde with head across Alia's securely clothed thighs right in center, Alia's voluminous curls framing left, Ellie and ECE leaning in with the closed gold lantern glowing, faces filling the frame while keeping secure opaque coverage, complete RAZE rainbow knee-highs on Alia + Ellie and bare legs + complete heels readable below the chaise.",
    "Ultra-close head-lap cut — Radiance blonde reclined across Alia's lap center-bottom, Alia left with voluminous curls, Ellie and ECE right leaning in with the closed gold lantern lit, faces edge-to-edge filling the frame while keeping secure opaque sequined coverage and complete footwear still readable.",
    "I'm arranging the four women in a tight group, placing Radiance's head across Alia's securely clothed thighs at the bottom center, with Ellie and ECE leaning in close on the right while keeping full opaque coverage and the dome backdrop in view.",
    "Closer behind-hug cut is in — Alia left and Ellie right turned around hugging Radiance and ECE from behind in the seated pair, friendly shoulder-hug with stable support, blonde Radiance center left and ECE with the warm closed gold lantern center right, faces tight and large under the violet dome with Baa atoll rings and turquoise lagoons behind, RAZE knee-highs readable on Alia + Ellie with bare legs and complete heels on the seated pair.",
    "Ultra-tight behind-hug — Alia top-left and Ellie top-right turned around hugging Radiance blonde and ECE from behind, faces filling 90% of the frame with shared smiles, closed gold lantern glowing center between them, secure opaque sequined minis and RAZE rainbow boots still readable under the TOI-700 d dome twilight.",
    "Extreme tight behind-hug stack — Alia top left and Ellie top right turned around embracing from behind, Radiance blonde bottom left and ECE bottom right cheek-to-cheek with the closed gold lantern glowing front center, all four faces edge-to-edge filling the frame under deep violet Maldives dusk with the dome softly behind."
  ],
  4: [
    "Low angle close from front-quarter for 1588 — 14-degree Dutch tilt with extreme close diagonal depth, Alia curls large near one edge and Ellie's complete heel near the opposite foreground, knee-height viewpoint outside garment volume looking up past complete heels and opaque hem side seams toward faces and the pressure-field arc, protected terrace with blue grid shimmer, wind-driven rain and lightning beyond the dry shield, Hanifaru lagoon curves and manta-current arcs below, secure opaque sequined minis with full bust, seat and pelvic coverage, RAZE rainbow knee-highs Split-Star left / wordmark right on Radiance and reversed on Alia, bare lower legs on Ellie and ECE, complete platform heels, four clear contacts and separated silhouettes.",
    "This gives you the low close drama while keeping faces, hair, hands and the small closed gold route lantern readable — want to push the storm lighting or RAZE legibility further?",
    "The closest safe close for Maldives Scene 1588 is the last low angle front-quarter we delivered — 14-degree Dutch tilt, knee-height viewpoint outside garment volume, Alia curls large near one edge and Ellie's complete heel near the opposite foreground, faces, RAZE legs and complete heels readable, protected terrace with transparent pressure-field arc, wind-driven rain and lightning beyond, Hanifaru lagoon faro rings as installation and print, secure opaque sequined minis with full coverage and exact RAZE Split-Star / wordmark mapping, neutral shoulder-to-shoulder side embraces with the small closed gold route lantern.",
    "I'm framing the four friends in a tight shoulder-to-shoulder embrace with hand holds as they turn, keeping the low-angle close-up outside the garment volume so faces, hair, hands, and footwear stay clear and public-safe.",
    "Closer with friendly behind-hugs locked for 1588 — Alia close behind Radiance with arm around shoulder, Radiance hand-holding into the center, Ellie and ECE in side embrace over the small closed gold route lantern, 14-degree Dutch tilt, protected terrace with blue grid pressure-field arc, lightning and manta rays beyond, Hanifaru lagoon faro rings below, secure opaque rainbow sequin minis and rompers with complete coverage, RAZE rainbow knee-highs with Split-Star and vertical RAZE wordmark, complete platform heels readable.",
    "Tightened to faces and lantern while holding complete heels for 1588 — faces larger and centered over the small closed gold route lantern, friendly behind-hugs Alia behind Radiance and Ellie behind ECE, 14-degree Dutch tilt with close diagonal depth, RAZE rainbow knee-highs Split-Star and vertical wordmark legible at bottom, secure opaque sequin minis and rompers with full coverage, protected research terrace with blue hex-grid pressure-field arc, lightning, rain and Hanifaru lagoon with manta silhouettes beyond the dry shield."
  ]
};

const specs = [
  { lane: 1, slot: 1, file: "scene-1588-meta-successor-i-tab-1-primary.webp", className: "hard-unusable" },
  { lane: 1, slot: 2, file: "scene-1588-successor-i-tab-1-primary-extra-2.webp", className: "mission-static" },
  { lane: 1, slot: 3, file: "scene-1588-successor-i-tab-1-primary-extra-3.webp", className: "faces-unreadable" },
  { lane: 1, slot: 4, file: "scene-1588-successor-i-tab-1-primary-extra-4.webp", className: "mission-static" },
  { lane: 1, slot: 5, file: "scene-1588-successor-i-tab-1-primary-extra-5.webp", className: "mission-static" },
  { lane: 1, slot: 6, file: "scene-1588-successor-i-tab-1-primary-extra-6.webp", className: "raze-count-failure" },
  { lane: 1, slot: 7, file: "scene-1588-successor-i-tab-1-primary-extra-7.webp", className: "passing-unused" },
  { lane: 2, slot: 1, file: "scene-1588-meta-successor-i-tab-2-primary.webp", className: "passing-unused" },
  { lane: 2, slot: 2, file: "scene-1588-meta-successor-i-tab-2-primary-extra-2.webp", className: "passing-unused" },
  { lane: 2, slot: 3, file: "scene-1588-meta-successor-i-tab-2-primary-extra-3.webp", className: "passing-unused" },
  { lane: 2, slot: 4, file: "scene-1588-meta-successor-i-tab-2-primary-extra-4.webp", className: "passing-unused" },
  { lane: 2, slot: 5, file: "scene-1588-successor-i-tab-2-primary-extra-5.webp", className: "faces-unreadable" },
  { lane: 2, slot: 6, file: "scene-1588-successor-i-tab-2-primary-extra-6.webp", className: "faces-unreadable" },
  { lane: 2, slot: 7, file: "scene-1588-successor-i-tab-2-primary-extra-7.webp", className: "cropped-identity" },
  { lane: 2, slot: 8, file: "scene-1588-successor-i-tab-2-primary-extra-8.webp", className: "cropped-identity" },
  { lane: 2, slot: 9, file: "scene-1588-successor-i-tab-2-primary-extra-9.webp", className: "cropped-identity" },
  { lane: 2, slot: 10, file: "scene-1588-successor-i-tab-2-primary-extra-10.webp", className: "passing-unused" },
  { lane: 2, slot: 11, file: "scene-1588-successor-i-tab-2-primary-extra-11.webp", className: "cropped-identity" },
  { lane: 3, slot: 1, file: "scene-1588-meta-successor-i-tab-3-primary.webp", className: "wrong-setting" },
  { lane: 3, slot: 2, file: "scene-1588-meta-successor-i-tab-3-primary-extra-2.webp", className: "wrong-setting" },
  { lane: 3, slot: 3, file: "scene-1588-successor-i-tab-3-primary-extra-3.webp", className: "wrong-setting" },
  { lane: 3, slot: 4, file: "scene-1588-successor-i-tab-3-primary-extra-4.webp", className: "wrong-setting" },
  { lane: 3, slot: 5, file: "scene-1588-successor-i-tab-3-primary-extra-5.webp", className: "wrong-setting" },
  { lane: 3, slot: 6, file: "scene-1588-successor-i-tab-3-primary-extra-6.webp", className: "wrong-setting" },
  { lane: 3, slot: 7, file: "scene-1588-successor-i-tab-3-primary-extra-7.webp", className: "wrong-setting" },
  { lane: 3, slot: 8, file: "scene-1588-successor-i-tab-3-primary-extra-8.webp", className: "wrong-setting" },
  { lane: 3, slot: 9, file: "scene-1588-successor-i-tab-3-primary-extra-9.webp", className: "wrong-setting" },
  { lane: 4, slot: 1, file: "scene-1588-meta-successor-i-tab-4-primary.webp", className: "selected" },
  { lane: 4, slot: 2, file: "scene-1588-successor-i-tab-4-primary-extra-2.webp", className: "duplicate-unused" },
  { lane: 4, slot: 3, file: "scene-1588-successor-i-tab-4-primary-extra-3.webp", className: "duplicate-unused" },
  { lane: 4, slot: 4, file: "scene-1588-successor-i-tab-4-primary-extra-4.webp", className: "mission-static" }
  ,{ lane: 4, slot: 5, file: "scene-1588-successor-i-tab-4-primary-extra-5.webp", className: "mission-static" },
  { lane: 4, slot: 6, file: "scene-1588-successor-i-tab-4-primary-extra-6.webp", className: "raze-count-failure" }
];

const reasonByClass = {
  "hard-unusable": "Completed output is public-safe but hard-unusable for Scene 1588 because it reads as an enclosed habitat and gives all four women tall rainbow legwear instead of exactly two RAZE knee-high wearers and two uncovered lower legs.",
  "mission-static": "Completed output is public-safe but visually rejected because it resolves into a static or lineup-like group and does not preserve the selected affection, hand-catch and single jealous reaction mission.",
  "faces-unreadable": "Completed output is public-safe but visually rejected because rear staging makes the historical face anchors unreadable and removes the front-facing relationship event.",
  "cropped-identity": "Completed output is valid media but hard-unusable as a country source because the footwear crop omits the four anchored faces and complete relationship event.",
  "passing-unused": "Completed output passes hard safety, identity, setting and mission gates but is superseded-unused because the selected tab 4 source has the stronger complete affection, hand-catch and jealousy event.",
  "wrong-setting": "Completed output is public-safe but hard-unusable for Scene 1588 because it is a dusk habitat interior, not the locked severe-storm protected exterior surface on TRAPPIST-1 e.",
  "duplicate-unused": "Completed provider occurrence resolves to byte-identical media already preserved from the selected tab 4 source and is retained as duplicate superseded-unused evidence.",
  "raze-count-failure": "Completed output is public-safe and affectionate but hard-unusable for the locked RAZE rule because all four women wear rainbow legwear instead of exactly two RAZE knee-high wearers and two uncovered lower legs.",
  selected: "Selected as the strongest hard-safe, face-safe Scene 1588 Meta source because it combines the protected storm surface terrace, four distinct faces, affection, hand catch, one calm jealous reaction, exactly two RAZE wearers, two uncovered lower legs, complete bodies and valid media."
};

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.events ??= [];
checkpoint.rejectedPromptLedger ??= { entries: [] };
checkpoint.rejectedPromptLedger.entries ??= [];
const addUnique = (array, key, value) => {
  const index = array.findIndex((entry) => entry[key] === value[key]);
  if (index >= 0) array[index] = value;
  else array.push(value);
};

for (const spec of specs) {
  const rawPath = `tmp/world-195x4/batch-392/raw/in-flight/${spec.file}`;
  const absoluteRawPath = resolve(root, rawPath);
  const rawBytes = readFileSync(absoluteRawPath);
  const rawSha256 = sha256(rawBytes);
  const downloadedAtUtc = statSync(absoluteRawPath).mtime.toISOString();
  const selected = spec.className === "selected";
  if (selected && rawSha256 !== selectedSha256) throw new Error(`Selected SHA mismatch for ${spec.file}`);
  const validFaces = !["faces-unreadable", "cropped-identity"].includes(spec.className);
  const exteriorSettingSafe = !["hard-unusable", "wrong-setting"].includes(spec.className);
  const missionSatisfied = ["passing-unused", "selected", "duplicate-unused"].includes(spec.className);
  const raw = { state: "preserved", path: rawPath, sha256: rawSha256, bytes: rawBytes.length, width: 1152, height: 2048, mediaType: "image/webp" };
  const qa = {
    validMedia: true,
    publicSafe: true,
    exactFacesSafe: validFaces,
    anatomySafe: true,
    personCountSafe: spec.className !== "cropped-identity",
    exteriorSettingSafe,
    severeStormBindingSafe: exteriorSettingSafe,
    lanternHandlingSafe: true,
    wardrobeCoverageSafe: true,
    razeWearerCountSafe: spec.lane === 2 || spec.lane === 4 || spec.className === "wrong-setting",
    loveActionSafe: true,
    loveMissionSatisfied: missionSatisfied,
    dynamicCameraMissionSatisfied: missionSatisfied,
    staticLineupFailure: spec.className === "mission-static"
  };
  const phase = `successor-i-tab-${spec.lane}-output-${spec.slot}`;
  const responseText = responseByLaneAndSlot[spec.lane][spec.slot - 1];
  const qaDisposition = selected ? "provisional-meta-source-selected-awaiting-bounded-chatgpt-final-hem-refinement" : `${spec.className}-archived-unused`;
  addUnique(checkpoint.events, "eventId", {
    eventId: `batch-392-scene-1588-${phase}-${selected ? "selected" : "archived-unused"}`,
    batch: 392,
    scene: 1588,
    provider: "Meta AI",
    phase,
    sentAtUtc: primarySentAtUtc[spec.lane],
    observedAtUtc: downloadedAtUtc,
    promptSha256: promptByLane[spec.lane].sha256,
    activeSuppressionProfileSha256,
    referenceImageShas: sourceImageShas,
    responseText,
    raw,
    downloadEvidence: {
      downloadedAtUtc,
      externalStagingRelativePath: `outputs/meta5_batch_staging/batch-392/scene-1588/successor-i/${spec.file.replace("meta-successor", "successor")}`,
      sha256Verified: true,
      occurrencePreservedEvenWhenDuplicateOrUnused: true
    },
    qaDisposition,
    rejectionReason: selected ? null : reasonByClass[spec.className],
    selectionReason: selected ? reasonByClass.selected : null,
    qa,
    finalSelectedSha256: selectedSha256,
    immutable: true
  });
  if (!selected) {
    addUnique(checkpoint.rejectedPromptLedger.entries, "entryId", {
      entryId: `batch-392-scene-1588-meta-ai-${phase}-${spec.className}`,
      batch: 392,
      scene: 1588,
      phase,
      status: `${spec.className}-archived-unused`,
      provider: "Meta AI",
      occurredAt: downloadedAtUtc,
      sentAtUtc: primarySentAtUtc[spec.lane],
      prompt: promptByLane[spec.lane],
      blacklistSnapshotSha256,
      activeSuppressionProfileSha256,
      faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
      responseText,
      refusalText: null,
      rawOutput: raw,
      qaDisposition,
      qa,
      rejectionReason: reasonByClass[spec.className],
      finalSelectedSha256: selectedSha256,
      immutable: true
    });
  }
}

checkpoint.status = "active-scene-1588-provisional-meta-source-selected-awaiting-archive-push-and-bounded-chatgpt-final-hem-refinement";
checkpoint.rollingState ??= {};
checkpoint.rollingState.provisionalMetaSources ??= {};
checkpoint.rollingState.provisionalMetaSources["1588"] = {
  provider: "Meta AI",
  phase: "successor-i-tab-4-output-1",
  sourcePath: "tmp/world-195x4/batch-392/raw/in-flight/scene-1588-meta-successor-i-tab-4-primary.webp",
  sha256: selectedSha256,
  bytes: 747840,
  width: 1152,
  height: 2048,
  selectedAtUtc: new Date().toISOString(),
  selectionReason: reasonByClass.selected,
  nextGate: "archive ledgers commit explicit push remote Git and LFS parity before bounded ChatGPT final hem refinement"
};
checkpoint.activeMetaLanes = {
  ...(checkpoint.activeMetaLanes ?? {}),
  candidateUnderInspection: "scene 1588 successor-I tab 4 output 1 selected as provisional Meta source",
  candidateInFlight: "none, all observed overlaps preserved and classified",
  candidateNPlus2Gate: "closed, scene resolved at Meta comparison stage",
  sceneReopenPolicy: "closed unless final ChatGPT refinement fails hard safety or face gates within its bounded retry cap"
};
checkpoint.nextMetaBundle = {
  batch: 392,
  scene: 1588,
  phase: "bounded-chatgpt-final-hem-refinement",
  state: "blocked-until-meta-occurrences-archived-ledgers-verified-commit-pushed-and-remote-parity-confirmed",
  metaOutputsPreserved: specs.length,
  selectedMetaSha256: selectedSha256
};
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ occurrenceCount: specs.length, selectedSha256, blacklistSnapshotSha256, activeSuppressionProfileSha256 }, null, 2));

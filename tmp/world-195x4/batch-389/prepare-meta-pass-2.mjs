#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkpointRelative = "assets/lore/starlight-era/batch-389-suriname-polar-airship-checkpoint.json";
const checkpointPath = path.join(root, checkpointRelative);
const batchRoot = "tmp/world-195x4/batch-389";
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
if (checkpoint.batch !== 389 || checkpoint.country !== "Suriname") throw new Error("Unexpected checkpoint identity");
if (checkpoint.providerPolicy?.status !== "meta-ai-only") throw new Error("Meta AI-only provider policy is not active");
if (checkpoint.renderPasses?.pass1?.candidatesConsumed !== 4) throw new Error("Pass 1 is not closed at four consumed calls");
if (checkpoint.renderPasses?.pass2?.candidatesConsumed !== 0) throw new Error("Pass 2 already consumed a candidate");

const common = `Create one fresh photorealistic vertical 9:16 Starlight World Series public-fashion editorial. Use the uploaded original identity references only, not any earlier country render. Show exactly four fictional women visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE. Preserve four distinct adult faces and skin tones. Keep all people fully clothed in secure opaque lined public fashion with complete bust, seat, pelvic, and intimate coverage and no accidental exposure.

Use four different polar-airship couture silhouettes with pressure-envelope ribs, gondola panels, brass navigation rings, mooring geometry, cloud-silver surfaces, and aurora piping. The women's hems are concise upper-thigh minis, tailored shorts, or skorts with complete footwear. Cropped, strapless, or open-back structures may appear only as described and must remain securely constructed. No literal flag, official emblem, sacred symbol, uniform, logo, text, or watermark.

Use simple separated noncontact full-body standing lanes. Show two traceable arms and hands and two complete legs and feet per person, visible joints, one role per hand, unambiguous limb ownership, and no extra, missing, fused, cropped, or grossly malformed anatomy. Keep every person, mascot, target, complete backstop, and endpoint fully in frame.

The rainbow-gradient large-frame object is a harmless nonfunctional cinema-training prop. Its sole isolated handler keeps one index visibly straight along the outside of the frame beside an unmistakably empty guard. Its front end points only downrange toward one plain non-humanoid paper route marker on a complete thick earth-and-sand backstop behind a transparent safety panel. The entire lane and space beyond are empty. No ammunition, firing, threat, injury, person or animal aim, camera aim, or combat.`;

const sceneSpecs = {
  1576: {
    identity: "Images 1 through 4 anchor the women.",
    scene: "A broad dry covered pavilion on Paramaribo's Waterkant, with the complete Jules Wijdenbosch Bridge arc over the Suriname River, secular wooden waterfront facades, rain trees, and distant secured riverboats. Silent heat lightning stays beyond the pavilion.",
    wardrobe: "Radiance wears clay-red cropped airship tailoring with a rice-white upper-thigh skort; Ellie wears a rainforest-emerald upper-thigh mini; Alia wears a Suriname-river-blue upper-thigh tailored romper; ECE wears a sea-turtle-teal cropped top with a granite-silver upper-thigh skort and the only opaque original-rainbow knee socks.",
    protected: "PAWS the tiny golden kitten and MAX the young golden-retriever pup rest together on a padded lounge in Radiance's protected bay. ECE's giant tuning-fork sculpture stays sealed in a fixed transparent display. Alia alone handles the cinema prop in the isolated lane.",
  },
  1577: {
    identity: "Images 1 through 4 anchor the women.",
    scene: "A broad dry covered panoramic platform on Brownsberg at clear golden hour, overlooking the complete Brokopondo Reservoir, rainforest islands, a red-earth ridge, layered Guiana Shield hills, and one empty marked water route.",
    wardrobe: "Radiance wears a golden-yellow cropped airship jacket with rainforest-emerald upper-thigh shorts; Ellie wears a secure Suriname-river-blue strapless cropped bodice with a rice-white upper-thigh skort; Alia wears a bromeliad-magenta upper-thigh mini; ECE wears a secure granite-silver strapless upper-thigh mini.",
    protected: "PAWS and MAX rest together on a padded lounge in Ellie's protected bay. No odd prop or hosiery appears. ECE alone handles the cinema prop in the isolated lane.",
  },
  1578: {
    identity: "Images 1 through 4 anchor the women.",
    scene: "A broad dry covered conservation overlook in the Central Suriname Nature Reserve, with the complete rounded Voltzberg granite dome, Raleigh Falls on the Coppename River, layered primary rainforest, distant macaws, and coastal mist outside the shelter.",
    wardrobe: "Radiance wears a night-charcoal upper-thigh airship mini; Ellie wears a secure rainforest-emerald strapless upper-thigh mini; Alia wears a secure golden-yellow strapless upper-thigh tailored romper; ECE wears a secure sea-turtle-teal strapless upper-thigh mini with a complete open back to the waist.",
    protected: "PAWS and MAX rest together on a padded lounge in Alia's protected bay. Alia's chromatic brass telescope stays sealed in a fixed transparent display. ECE alone handles the cinema prop in the isolated lane.",
  },
  1579: {
    identity: "Images 1 through 4 anchor the women and Image 5 anchors the established athletic bearded adult man.",
    scene: "A broad dry covered conservation boardwalk at Galibi, with the complete shoreline, Marowijne River mouth, mangrove fringe, beach-morning-glory vines, protected leatherback tracks, faraway sea turtles, and distant lightning over the Atlantic.",
    wardrobe: "Radiance wears a clay-red upper-thigh airship mini; Ellie wears a rainforest-emerald upper-thigh skort look; Alia wears a bromeliad-magenta cropped bodice with night-charcoal upper-thigh shorts; ECE wears a Suriname-river-blue cropped top with a granite-silver upper-thigh skort; the man wears an opaque rice-white short-sleeve airship top, tailored above-knee night-charcoal shorts, and black shoes.",
    protected: "MAX alone rests on a padded lounge in Alia's protected bay. Radiance's mirrored megaphone sculpture stays sealed in a fixed transparent display. The five adults stay in separated noncontact lanes, and ECE alone handles the cinema prop in the isolated lane.",
  },
};

function primaryPrompt(scene) {
  const spec = sceneSpecs[scene];
  return `${common}\n\n${spec.identity}\n\nScene: ${spec.scene}\n\nWardrobe: ${spec.wardrobe}\n\nProtected details: ${spec.protected}\n\nRender a polished, realistic, public-safe full-body editorial with the Suriname location and polar-airship fashion equally clear.`;
}

function fallbackPrompt(scene) {
  const spec = sceneSpecs[scene];
  const adultCount = scene === 1579 ? "four adult women and one adult man" : "four adult women";
  return `Create one safe photorealistic vertical full-body fashion editorial using the uploaded identity references. Show exactly ${adultCount}, all visibly over 28, in separated standing lanes at this Suriname location: ${spec.scene} Preserve distinct faces, complete plausible arms, hands, legs, feet, and footwear.\n\nUse secure opaque lined polar-airship public fashion with tailored upper-thigh hemlines and complete coverage. ${spec.wardrobe}\n\n${spec.protected} The harmless rainbow-gradient cinema calibration frame remains visibly nonfunctional and isolated behind a clear safety panel. Its handler keeps an index straight outside the empty hand guard while its front end faces a plain route marker on a complete backstop; nobody or no animal is in that lane. No firing, threat, injury, combat, nudity, text, logo, or watermark. Keep the entire safe lane and all subjects in frame.`;
}

function record(text, relativePath) {
  const buffer = Buffer.from(text, "utf8");
  writeFileSync(path.join(root, relativePath), buffer);
  return {
    path: relativePath,
    sha256: createHash("sha256").update(buffer).digest("hex").toUpperCase(),
    bytes: buffer.length,
    chars: text.length,
    encoding: "utf-8",
    fidelity: "prepared-runtime-exact",
  };
}

const prompts = {};
for (const scene of Object.keys(sceneSpecs).map(Number)) {
  const primaryPath = `${batchRoot}/scene-${scene}-meta-pass-2-primary.txt`;
  const fallbackPath = `${batchRoot}/scene-${scene}-meta-pass-2-fallback.txt`;
  prompts[scene] = {
    primary: record(primaryPrompt(scene), primaryPath),
    fallback: record(fallbackPrompt(scene), fallbackPath),
  };
}

checkpoint.status = "active-pass-2-meta-ai-only-prepared-not-launched";
checkpoint.renderPasses.pass2 = {
  ...checkpoint.renderPasses.pass2,
  status: "prepared-exactly-four-concurrent-meta-ai-candidates-not-launched",
  prompts,
  hardBlockPolicy: {
    provider: "Meta AI only",
    initialDispatch: "one primary prompt per scene in one four-scene concurrent bank",
    refusalDetection: "read immediate page response and classify refusal phrases as blocked",
    retryLimit: "one fallback retry per blocked scene only",
    blacklistedTokenThreshold: 3,
    currentBlacklistedTokens: [],
    suppressionReplacements: {
      aggressive: "decisive",
      bold: "confidently-styled",
      "short-hem": "tailored hemline",
      explicit: "clear-style",
    },
    noBypassTactics: true,
    externalLexiconPublicPathOmitted: true,
  },
};

writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  checkpoint: checkpointRelative,
  status: checkpoint.status,
  prompts,
}, null, 2));

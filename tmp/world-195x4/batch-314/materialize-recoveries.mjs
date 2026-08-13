import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const recoveryDir = path.join(root, "recovery");
fs.mkdirSync(recoveryDir, { recursive: true });

const restrainedPublicFashion = `Recovery rendering direction: Treat this as a restrained, fully clothed, public conservation-fashion editorial for a general audience. Every subject is an adult over 28. Use an eye-level documentary camera, upright balanced posture, ordinary body proportions, opaque lined garments, high secure bust coverage, and zero cleavage or lingerie styling. Any uncovered waist, strapless construction, or back cut is only an ordinary fashion construction and must not be eroticized. Affection is limited to the exact friendly public hand contacts listed later, with composed expressions and generous personal space. Keep the profession theme abstract and fashion-only, with no caregiving roleplay. Preserve all deterministic rolls, identities, outfit construction, country motifs, landmarks, weather, prop rules, hand inventory, and composition. No nudity, underwear, bedroom context, suggestive pose, fetish styling, or camera emphasis on chest, hips, or thighs.`;

for (const scene of [1277, 1278, 1279]) {
  const original = fs.readFileSync(path.join(root, `scene-${scene}-prompt.txt`), "utf8").trim();
  fs.writeFileSync(
    path.join(recoveryDir, `scene-${scene}-recovery-prompt.txt`),
    `${restrainedPublicFashion}\n\n${original}\n`,
    "utf8",
  );
}

const scene1276Edit = `Use case: precise-object-edit. Asset type: Scene 1276 Guyana recovery edit. Image 1 is the edit target. Images 2 through 5 are identity references only. Preserve the target's four adult women, faces, skin tones, hairstyles, bodies, exact eight-arm and eight-hand anatomy, pose, contacts, four outfits, large complete Guyana motifs, Orinduik Falls setting, red-gold distant dust storm, safe horizontal prop direction, lighting, framing, and 9:16 full-length composition.

Make only these four corrections:
1. Remove every collar, necklace, harness, pendant, and ribbon from the tiny golden kitten on Ellie's far shoulder. Keep the kitten tiny, golden, secure, harmless, and far from the prop.
2. Make the entire overlook floor visibly dry, matte, level, and nonslip beneath all four pairs of heels.
3. Keep the inert polished rainbow-gradient cinema prop resting entirely on the opaque paddle, but remove its magazine and show a clearly empty magazine well plus a complete empty trigger guard in clean side profile. No hand touches its grip, trigger, or guard. Keep its muzzle pointed left across clearly empty water, away from people, kitten, wildlife, landmarks, and camera.
4. Add one small translucent hands-free holographic route map floating beside AI ECE's shoulder, clearly separate from the prop and from every hand.

This is a restrained, fully clothed public conservation-fashion editorial for a general audience. Every subject is an adult over 28. Keep upright balanced posture, opaque lined clothing, secure bust coverage, ordinary proportions, and no cleavage or erotic styling. Do not add, remove, hide, crop, fuse, duplicate, or reroute any person, arm, hand, finger cluster, leg, foot, shoe, contact, garment, motif, landmark, or weather feature. Exactly four adults, eight traceable arms, and eight separated hands, two per woman. No ammunition, reload, firing, muzzle flash, threat, combat, injury, text, or watermark.`;

fs.writeFileSync(
  path.join(recoveryDir, "scene-1276-recovery-edit-prompt.txt"),
  `${scene1276Edit}\n`,
  "utf8",
);

const files = [
  "scene-1276-recovery-edit-prompt.txt",
  "scene-1277-recovery-prompt.txt",
  "scene-1278-recovery-prompt.txt",
  "scene-1279-recovery-prompt.txt",
];

console.log(JSON.stringify({ recoveryDir, files }, null, 2));

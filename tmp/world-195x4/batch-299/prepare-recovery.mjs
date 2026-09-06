import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-299");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-299-sweden-preflight.json"), "utf8"));

const recovery = {
  "1216": {
    choreography: "Use a wide shallow arc with ECE isolated at the far right. Radiance and Ellie share two reciprocal touches, Ellie and Alia share two touches, and Alia sends ECE one playful blown kiss. The selected route-beacon and behind-embrace love beats read through the close side arc without any hidden arms.",
    hands: [
      "Radiance left hand rests visibly on Ellie's near shoulder; Radiance right hand hangs fully visible beside her own right thigh",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly on Ellie's near forearm; Alia right open hand stays visibly near her own lips in a blown-kiss gesture toward ECE",
      "ECE right hand holds the inert prop with index finger straight and flat along the outside frame above the trigger guard; ECE left hand supports her right hand from below without crossing the guard"
    ],
    prop: "ECE stands alone at the far right and aims one full-size rainbow-gradient Desert Eagle-style inert film prop horizontally OUTWARD toward the far-right edge and empty archipelago water. Both arms and both hands are fully visible. Her right index finger lies unmistakably straight and flat along the OUTSIDE of the frame above the trigger guard, parallel to the barrel. No finger enters or overlaps the guard. Her left hand supports the right hand from below. The muzzle points away from all women and camera. A hands-free route map floats behind ECE.",
    extra: "Show Radiance, Alia, and ECE in distinct three-quarter poses with each complete face visible in profile. Radiance's cropped waist, belly button, and complete open-back panel must be visible. Alia's bare strapless shoulders, cropped waist, belly button, and complete open back must be visible. ECE's cropped waist, belly button, and complete open back must be visible. Ellie stays fully covered."
  },
  "1217": {
    choreography: "Radiance and Alia link their left hands at waist height. Ellie holds Radiance's waist while reaching toward the hands-free route beacon. Alia places her free hand at Radiance's upper back. ECE stays separated at the far right for the unloaded inspection beat. This preserves the linked-turn and close-embrace rolls with four clean contacts and no hidden hands.",
    hands: [
      "Radiance left hand links visibly with Alia's left hand; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right open hand reaches visibly toward the hands-free route beacon",
      "Alia left hand links visibly with Radiance's left hand; Alia right hand rests visibly at Radiance's upper back",
      "ECE right hand holds the inert prop with index finger straight and flat along the outside frame above the trigger guard; ECE left open palm stays visibly below the empty magazine well"
    ],
    prop: "ECE stands alone at the far right and holds one full-size rainbow-gradient Desert Eagle-style inert film prop horizontally OUTWARD toward the far-right edge and empty harbor water at chest height. Her right index finger lies unmistakably straight and flat along the OUTSIDE of the frame above the trigger guard. No finger enters or overlaps the guard. Her left open palm stays below the visibly empty magazine well without touching the controls. No magazine or ammunition appears. The muzzle points away from all women and camera.",
    extra: "Turn ECE's spine forty-five degrees away from camera while her complete face remains visible in profile. Her cropped waist, belly button, and complete open back from shoulder blades to waist must be unobstructed. Radiance and Alia stay fully covered. Ellie alone also shows her cropped waist and belly button."
  },
  "1218": {
    choreography: "Radiance and Alia hold a simple shoulder-and-waist side embrace. Radiance sends ECE a playful blown kiss. Ellie touches Radiance's waist and ECE's cheek. Alia stands behind ECE at a clear offset and guides only ECE's upper arm. ECE remains the sole prop handler. This preserves the walking-weave and turning-embrace rolls through four clean contacts.",
    hands: [
      "Radiance left hand rests visibly on Alia's near shoulder; Radiance right open hand stays visibly near her own lips in a blown-kiss gesture toward ECE",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand gently touches ECE's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand guides ECE's near upper arm without touching the prop",
      "ECE right hand holds the inert prop with index finger straight and flat along the outside frame above the trigger guard; ECE left hand supports her right hand from below without crossing the guard"
    ],
    prop: "ECE stands at the far right and aims one full-size rainbow-gradient Desert Eagle-style inert film prop horizontally OUTWARD toward the far-right edge and empty Torne River ice. Both arms and both hands are fully visible. Her right index finger lies unmistakably straight and flat along the OUTSIDE of the frame above the trigger guard. No finger enters or overlaps the guard. Her left hand supports the right hand from below. Alia touches only ECE's upper arm. The muzzle points away from all women and camera. A hands-free route map floats beyond ECE.",
    extra: "Turn Ellie and ECE forty-five degrees away from camera while both complete faces remain visible in profile. Ellie's cropped waist, belly button, and complete open back must be unobstructed. ECE's completely bare strapless shoulders and complete open back from shoulder blades to waist must be unobstructed while her waist stays covered. Radiance and Alia stay fully covered."
  },
  "1219": {
    choreography: "Arrange the five adults from left to right as Radiance at the pole, ECE cheek-close beside Radiance, Ellie in a clean three-quarter back pose, the male, and Alia isolated at the far right with the prop. Radiance and ECE link hands as the extra-affectionate center. Ellie touches the male's chest and forearm. The male touches Ellie's waist and Alia's near shoulder while turning his head, chin, and pupils clearly past Ellie toward ECE. Alia receives his shoulder touch while maintaining the outward prop stance.",
    hands: [
      "Radiance left hand rests visibly on the fixed vertical pole at shoulder height; Radiance right hand links visibly with ECE's left hand",
      "ECE left hand links visibly with Radiance's right hand; ECE right open hand points visibly to one separate holographic route map",
      "Ellie left hand rests visibly on the male's upper chest; Ellie right hand rests visibly on the male's near forearm",
      "Male left hand rests visibly at Ellie's near waist; Male right hand rests visibly on Alia's near shoulder",
      "Alia right hand holds the inert prop with index finger straight and flat along the outside frame above the trigger guard; Alia left hand supports her right hand from below without crossing the guard"
    ],
    prop: "Alia alone stands at the FAR RIGHT and aims one full-size rainbow-gradient Desert Eagle-style inert film prop horizontally OUTWARD toward the far-right edge and empty Oresund water. Both of Alia's arms and hands are fully visible. Her right index finger lies unmistakably straight and flat along the OUTSIDE of the frame above the trigger guard. No finger enters or overlaps the guard. Her left hand supports the right hand from below. The muzzle points away from every person, pole, table, and camera. ECE uses no prop.",
    extra: "Exactly one fixed vertical stage-support pole stands at the far left and Radiance only rests one hand on it while standing upright. No dance or second pole. All four women's garments are visibly rainbow-only. ECE alone wears opaque knee socks with a cobalt, golden-yellow, berry-red, pine-green, and icy-cyan Sweden gradient. Ellie's complete open back must be visible in her three-quarter pose. Every woman's waist stays covered. The male wears his fitted short-sleeve black polo, black jeans, and black boots. His strongest sustained eye line is only on ECE, not Ellie, Alia, Radiance, camera, or the prop."
  }
};

for (const [scene, overrides] of Object.entries(recovery)) {
  const plan = preflight.scenePlans[scene];
  const hasMale = plan.maleModel.present;
  const refs = hasMale
    ? "Image 1 quartet face anchor; Image 2 frontal face supplement; Image 3 expression supplement; Image 4 ECE face-detail anchor; Image 5 established adult male face and build anchor. References control identity only."
    : "Image 1 quartet face anchor; Image 2 frontal face supplement; Image 3 expression supplement; Image 4 ECE face-detail anchor. References control identity only.";
  const cast = hasMale
    ? "Exactly five clearly adult fictional people: all four women plus the established adult male, with no replacement."
    : "Exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE.";
  const anatomy = hasMale ? "Exactly ten arms and ten hands, two per adult." : "Exactly eight arms and eight hands, two per woman.";
  const emotions = Object.entries(plan.characters).map(([name, value]) => `${name}: ${value.emotion.result}, performed as ${value.emotion.performance}`).join("; ");
  const outfits = Object.entries(plan.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const optional = [
    plan.paws.active ? "PAWS is active exactly as stored." : "No kitten.",
    plan.poleDanceTheme.active ? plan.scene === 1219 ? "The single fixed pole is active exactly as described below." : "One fixed pole is active." : "No pole.",
    plan.rainbowOnly.active ? "All four women's outfits are rainbow-only while retaining every rolled cut and Sweden motif." : "Do not use rainbow-only outfits.",
    plan.rainbowHosiery.active ? `Exactly one hosiery wearer: ${plan.rainbowHosiery.wearer.result}, using ${plan.rainbowHosiery.palette.result}. Radiance and ECE are the affectionate center, and Alia alone handles the prop.` : "No rainbow hosiery."
  ].join(" ");
  const prompt = [
    "Use case: photorealistic-natural. Fresh recovery generation. Vertical 9:16 full-length public department-store fashion editorial with neutral upright posture and broad stable footing.",
    refs,
    `Location: ${plan.landmark}. ${cast}`,
    "Preserve the distinct anchored adult faces and skin tones. Radiance is the blonde adult. Ellie is the dark-haired adult. Alia is the Black adult woman and alone has a high sculptural braided ponytail with fine face-framing braids. ECE is the brunette adult strategist. Do not clone or merge identities.",
    `Theme: ${plan.theme}, expressed only as original public-safe fashion. Secure, opaque, lined, above-knee clothing with four different silhouettes. Exact rolled wardrobe: ${outfits}.`,
    `Large complete secular Sweden motifs on at least two outfits: ${plan.motifs.join("; ")}. ${plan.culture}`,
    `Distinct rolled emotions: ${emotions}${hasMale ? `; Male: ${plan.maleModel.emotion.result}, performed as ${plan.maleModel.emotion.performance}` : ""}.`,
    `Affection choreography: ${overrides.choreography}`,
    `Exact hand inventory and no other hands: ${overrides.hands.join("; ")}.`,
    overrides.prop,
    overrides.extra,
    optional,
    `Materialize rolled weather exactly as ${plan.weather.result}. Keep the platform dry and stable while the weather remains cinematic.`,
    anatomy,
    "Every arm is fully visible continuously from shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. No hand emerges from behind another body. Keep all wrists, palms, and finger clusters separated except at listed contacts.",
    "Full-length head-to-toe framing contains every face, hand, leg, foot, heel, boot, and knee sock. Use a shallow arc with clear space between silhouettes.",
    "Reject any extra, missing, duplicate, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, leg, or foot.",
    "One inert film prop only. Every trigger finger stays straight outside the guard. No ammunition, magazine, live reload, firing, muzzle flash, holster, low-side carry, combat, threat, or injury.",
    "No text, watermark, literal flag, official emblem, sacred symbol, copied costume, badge, brand, minors, teen framing, nudity, explicit sexuality, upskirt framing, restraint, or non-consensual framing."
  ].join(" ");
  fs.writeFileSync(path.join(root, `scene-${scene}-recovery-prompt.txt`), `${prompt}\n`, "utf8");
}

console.log(JSON.stringify({ status: "recovery-prompts-stored", scenes: Object.keys(recovery) }, null, 2));

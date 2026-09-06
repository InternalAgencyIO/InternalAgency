import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-296");
const preflightPath = path.join(root, "batch-296-slovakia-preflight.json");
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

const rawResults = {
  "1204": {
    status: "rejected",
    source: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-38968e90-5b61-4c5d-9857-bd66f0374142.png",
    audit: [
      "ECE's index finger appears inside or against the trigger guard instead of visibly straight along the outer frame.",
      "The central affectionate hand cluster does not match the recorded inventory and several hand owners are ambiguous under the strict eight-hand gate.",
      "Bratislava Castle, the thunderstorm, four identities, full-length framing, country motifs, and major wardrobe triggers are otherwise readable."
    ]
  },
  "1205": {
    status: "rejected",
    source: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-907ea05b-aa19-450e-a54e-0ea3b143b57b.png",
    audit: [
      "ECE's index finger is curled through the trigger guard, violating the inert-prop handling rule.",
      "Radiance's and Ellie's triggered complete open backs are not visible, and Alia's triggered midriff is covered.",
      "The central hand ownership does not fully match the recorded inventory, so exactly eight traceable hands cannot be certified.",
      "Spis Castle, the dust wall, four identities, footwear, large castle motifs, and Ellie's radiant laughter are otherwise readable."
    ]
  },
  "1206": {
    status: "rejected",
    source: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-9e4cc0ae-7c24-4334-ba4c-d32cca670abe.png",
    audit: [
      "ECE's index finger appears inside or against the trigger guard instead of straight along the outer frame.",
      "The male's strongest eye line is toward Alia rather than his wife ECE.",
      "The recorded five-person hand inventory and four-woman romance-square contacts are not fully materialized, leaving ownership ambiguity under the ten-hand gate.",
      "The five adult identities, male wardrobe, High Tatras, lake mist, large motifs, and female wardrobe triggers are otherwise strong."
    ]
  },
  "1207": {
    status: "blocked-output-moderation",
    source: null,
    requestId: "287a2a6b-0ffc-4946-a23f-c4e4bd617b75",
    audit: [
      "The raw Modra generation was rejected by the output safety system under the sexual category and produced no local asset."
    ]
  }
};

preflight.renderAttempts.raw = {
  status: "complete-audited-no-accepted-assets",
  requested: 4,
  concurrency: "four independent built-in image generation calls",
  results: rawResults
};
preflight.renderAttempts.recovery = {
  status: "pending",
  maximumPerBlockedScene: 1,
  strategy: "One fresh public-safe generation per scene with shallow-arc staging, visible separated hands, an empty lateral downrange lane, and the handler's index finger laid flat high on the outer frame above an unobscured trigger guard."
};

const recovery = {
  "1204": {
    love: "Use a shallow affectionate arc instead of a behind embrace. Radiance and Ellie share a side hug while Alia leans close and touches both of them; Alia also touches ECE's shoulder so ECE remains inside the relationship square.",
    hands: [
      "Radiance left hand rests at Ellie's waist; Radiance right hand rests on Alia's upper arm",
      "Ellie left hand rests at Radiance's waist; Ellie right hand rests on Alia's shoulder",
      "Alia left hand rests on Ellie's upper arm; Alia right hand rests on ECE's shoulder",
      "ECE right hand holds the inert prop with index finger fully straight high along the outer frame above the guard; ECE left hand controls one separate holographic map"
    ]
  },
  "1205": {
    love: "Use a shallow affectionate arc. Radiance and Ellie link one hand and share a waist touch, Radiance and Alia exchange two separated shoulder and waist touches, and Alia keeps ECE inside the square with one shoulder touch.",
    hands: [
      "Radiance left hand links Ellie's right hand; Radiance right hand rests on Alia's shoulder",
      "Ellie right hand links Radiance's left hand; Ellie left hand rests at Radiance's waist",
      "Alia left hand rests on ECE's shoulder; Alia right hand rests at Radiance's waist",
      "ECE right hand holds the inert prop with index finger fully straight high along the outer frame above the guard; ECE left hand controls one separate holographic map"
    ]
  },
  "1206": {
    love: "Use a shallow five-adult arc with no hidden arms. Radiance seeks the male with one forearm touch while holding Ellie close. Ellie links the male's hand. Alia touches his chest while he holds her waist, and Alia also touches ECE's shoulder. The male turns his face and strongest sustained eye line clearly toward his wife ECE.",
    hands: [
      "Radiance left hand rests on the male's right forearm; Radiance right hand rests on Ellie's shoulder",
      "Ellie left hand links the male's right hand; Ellie right hand rests at Radiance's waist",
      "Alia left hand rests on the male's chest; Alia right hand rests on ECE's shoulder",
      "ECE right hand holds the inert prop with index finger fully straight high along the outer frame above the guard; ECE left hand controls one separate holographic map",
      "Male left hand rests at Alia's waist; Male right hand links Ellie's left hand"
    ]
  },
  "1207": {
    love: "Use a shallow affectionate arc. Radiance comforts Alia with a shoulder touch while holding Ellie close, Ellie and Alia link one hand, and Alia touches ECE's shoulder so jealous ECE remains inside the relationship square.",
    hands: [
      "Radiance left hand rests on Alia's shoulder; Radiance right hand rests on Ellie's shoulder",
      "Ellie left hand rests at Radiance's waist; Ellie right hand links Alia's left hand",
      "Alia left hand links Ellie's right hand; Alia right hand rests on ECE's shoulder",
      "ECE right hand holds the inert prop with index finger fully straight high along the outer frame above the guard; ECE left hand controls one separate holographic map"
    ]
  }
};

for (const [scene, changes] of Object.entries(recovery)) {
  const plan = preflight.scenePlans[scene];
  const oldLove = `Affection choreography: ${plan.materializedRomance}`;
  const oldHands = `Use this exact hand inventory: ${plan.handInventory.join("; ")}.`;
  let prompt = plan.renderPrompt
    .replace(oldLove, `Affection choreography: ${changes.love}`)
    .replace(oldHands, `Use this exact hand inventory: ${changes.hands.join("; ")}.`);
  prompt = [
    "RECOVERY PASS, final allowed attempt for this scene.",
    "Keep every deterministic identity, emotion, wardrobe roll, weather roll, country motif, landmark, theme, and cast count from the prompt below.",
    "Arrange the cast in one shallow arc with visible gaps between torsos. Keep every shoulder, elbow, wrist, and hand in front of clothing or against a named shoulder or waist, never hidden behind a body.",
    "Place the prop handler at the far right edge. Everyone else stays clearly left of and behind the handler, with no person beyond the muzzle. Show the prop in clean side profile toward an empty lateral background lane.",
    "Make the handler's index finger unmistakably flat and fully extended along the outside of the slide, high above the trigger guard. The empty trigger guard must remain completely visible with no finger touching or entering it.",
    prompt
  ].join(" ");
  fs.writeFileSync(path.join(root, `scene-${scene}-recovery.txt`), `${prompt}\n`, "utf8");
}

fs.writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  rawStatus: preflight.renderAttempts.raw.status,
  recoveryStatus: preflight.renderAttempts.recovery.status,
  recoveryPrompts: Object.keys(recovery)
}, null, 2));

import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-324");

const corrections = {
  1316: "RECOVERY PRIORITY: Create a fully clothed, mature, public-safe fashion editorial with no sensual framing or exposed chest emphasis. Preserve every stored roll, identity, outfit architecture, contact, weather, ECE-only prop ownership, and paper-target action. Show the paper target and complete sand-filled timber backstop clearly at far left. ECE uses a realistic eye-level two-hand grip aimed only at that target, with her index finger straight on the frame. Keep the other three women entirely behind the muzzle plane at right, all eight hands clearly owned, and all four secure opaque outfits unmistakably distinct.",
  1317: "RECOVERY PRIORITY: Preserve every stored roll and the five-adult Great Blue Hole scene, but correct the binding male relationship and anatomy gates. The established adult male turns his head across the group and maintains his strongest unmistakable eye line directly toward ECE at far left, not toward Ellie, Radiance, or Alia. Keep his two required contacts while every one of ten hands is clearly visible and attributable. Ellie securely holds PAWS far from the prop. ECE alone uses a realistic eye-level two-hand grip toward the distant empty lagoon buoy, with the entire group behind the muzzle plane and no person crossed by the line.",
  1318: "RECOVERY PRIORITY: Preserve every stored roll and the four-adult Cockscomb scene, but make the rolled target and anatomy unmistakable. Place a large geometric paper route target at far left on a complete thick sand-and-earth backstop, fully visible with empty earth beyond it. ECE alone uses a realistic eye-level two-hand grip aimed only at that target, index finger straight on the frame. Put the affectionate trio with PAWS completely behind the muzzle plane at right. Show exactly eight clearly owned hands: ECE two on the grip, Ellie two securely cradling PAWS, Radiance two on the listed contacts, and Alia two on the listed contacts.",
};

for (const [scene, correction] of Object.entries(corrections)) {
  const original = fs.readFileSync(path.join(root, `scene-${scene}-prompt.txt`), "utf8").trim();
  fs.writeFileSync(path.join(root, `scene-${scene}-recovery-prompt.txt`), `${correction} ${original}\n`, "utf8");
}

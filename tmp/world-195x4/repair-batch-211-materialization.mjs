import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const planPath = path.resolve("tmp/world-195x4/batch-211/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-211/runtime-checkpoint.json");

function matchingClose(source, openIndex) {
  const open = source[openIndex];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close && --depth === 0) return index;
  }
  throw new Error(`Unclosed JSON value at ${openIndex}`);
}

function topLevelValueRange(source, key) {
  const marker = `\n  "${key}": `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing top-level key ${key}`);
  const start = markerIndex + marker.length;
  return [start, matchingClose(source, start) + 1];
}

function patchBatch(batch) {
  if (batch.batch !== 211 || batch.country !== "Philippines") throw new Error("Unexpected batch repair target");
  for (const scene of batch.scenes) {
    const expected = `${scene.number}-${scene.slug}.png`;
    scene.file = expected;
    if (scene.number === 864) {
      scene.brief = scene.brief.replace(
        "fixed decorative back-seam lacing and one tiny elegant secular temple star-facet line.",
        "fixed decorative back-seam lacing."
      );
      scene.renderState.foundationPlan.suppressedDetails = [
        {
          trait: "Radiance.faceTattoo",
          reason: "The newer binding clean-face gate rejects symbol-marked facial skin; preserve the deterministic roll record but suppress visible execution."
        }
      ];
      scene.renderState.detailProgress.completed = ["Radiance.faceTattoo (suppressed-by-clean-face-gate)"];
      scene.renderState.detailProgress.remaining = scene.renderState.detailProgress.remaining.filter((item) => item !== "Radiance.faceTattoo");
    }
  }
  return batch;
}

let raw = fs.readFileSync(campaignPath, "utf8");
const [arrayStart, arrayEnd] = topLevelValueRange(raw, "plannedBatches");
let index = arrayStart + 1;
let replaced = false;
while (index < arrayEnd - 1) {
  while (/\s|,/.test(raw[index])) index += 1;
  if (raw[index] !== "{") throw new Error(`Unexpected plannedBatches token at ${index}`);
  const end = matchingClose(raw, index) + 1;
  const batch = JSON.parse(raw.slice(index, end));
  if (batch.batch === 211) {
    raw = raw.slice(0, index) + JSON.stringify(patchBatch(batch)) + raw.slice(end);
    replaced = true;
    break;
  }
  index = end;
}
if (!replaced) throw new Error("Batch 211 not found");
JSON.parse(raw);
fs.writeFileSync(campaignPath, raw, "utf8");

const plan = patchBatch(JSON.parse(fs.readFileSync(planPath, "utf8")));
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
for (const lane of checkpoint.lanes) {
  const scene = plan.scenes.find((item) => item.number === lane.scene);
  if (!scene) throw new Error(`Missing scene ${lane.scene}`);
  lane.file = scene.file;
}
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify(plan.scenes.map((scene) => ({ number: scene.number, file: scene.file })), null, 2));

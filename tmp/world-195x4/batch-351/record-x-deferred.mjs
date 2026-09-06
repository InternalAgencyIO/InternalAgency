import fs from "node:fs";
import path from "node:path";

const checkpointPath = path.resolve("assets/lore/starlight-era/batch-351-south-sudan-orbital-research-station-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "deferred-browser-control-unavailable",
  attemptedAt: new Date().toISOString(),
  reason: "The signed-in in-app browser was open, but its control bridge could not initialize and reported: failed to write kernel assets: The system cannot find the path specified. No compose or publish action was attempted.",
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

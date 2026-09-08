import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-326-iceland-relaxed-audit-checkpoint.json",
);
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "published",
  publishedAt: new Date().toISOString(),
  postUrl: "https://x.com/dogramaci/status/2086665774995804431",
  attachments: [
    "assets/lore/starlight-era/1324-iceland-reykjavik-harpa-covert-agent-harbor-marker-recovery.png",
    "assets/lore/starlight-era/1325-iceland-thingvellir-covert-agent-paper-target-recovery.png",
    "assets/lore/starlight-era/1320-bahamas-eleuthera-glass-window-bridge-cleaner-service-paper-target-recovery.png",
  ],
  verification: [
    "X confirmed the post was sent",
    "public caption matched the deterministic roll",
    "public photo/1, photo/2, and photo/3 endpoints were visible",
    "Made with AI disclosure was visible",
  ],
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpoint.xPost.postUrl);

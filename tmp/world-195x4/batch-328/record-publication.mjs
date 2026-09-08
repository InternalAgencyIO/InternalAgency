import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-328-barbados-relaxed-audit-checkpoint.json",
);
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "published",
  publishedAt: new Date().toISOString(),
  postUrl: "https://x.com/dogramaci/status/2086681429040062601",
  attachments: [
    "assets/lore/starlight-era/1332-barbados-bridgetown-care-rainbow-harbor-marker-recovery.png",
    "assets/lore/starlight-era/1333-barbados-bathsheba-care-ocean-marker.png",
    "assets/lore/starlight-era/1328-vanuatu-port-vila-investigator-paper-target-recovery.png",
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

import fs from "node:fs";
import path from "node:path";

const checkpointPath = path.resolve("assets/lore/starlight-era/batch-322-cabo-verde-relaxed-audit-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const postUrl = "https://x.com/dogramaci/status/2086637922757824641";

checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "published-and-three-attachments-verified",
  postUrl,
  verification: {
    sentToast: "Your post was sent",
    publicCaption: "Cabo Verde red-heart Maldives #CaboVerde #WorldXXXSeries",
    photoLinks: [1, 2, 3].map((photo) => `${postUrl}/photo/${photo}`),
    madeWithAI: true,
  },
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(checkpoint.xPost, null, 2));

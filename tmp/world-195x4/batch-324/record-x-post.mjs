import fs from "node:fs";
import path from "node:path";

const checkpointPath = path.resolve("assets/lore/starlight-era/batch-324-belize-relaxed-audit-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const postUrl = "https://x.com/dogramaci/status/2086651356270498292";

checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "published-and-three-attachments-verified",
  postedAt: new Date().toISOString(),
  postUrl,
  verification: {
    sentToast: "Your post was sent. You have 1 hour to make any edits.",
    publicCaption: "Belize red-heart Brunei #Belize",
    photoLinks: [1, 2, 3].map((number) => `${postUrl}/photo/${number}`),
    madeWithAI: true,
  },
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(checkpoint.xPost, null, 2));

import fs from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-333-seychelles-private-jet-checkpoint.json";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "published",
  publishedAt: new Date().toISOString(),
  url: "https://x.com/dogramaci/status/2086732761230950553",
  verifiedSignals: [
    "X displayed the sent-post confirmation",
    "the new timeline article contains the exact caption",
    "the new timeline article exposes three image links",
  ],
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

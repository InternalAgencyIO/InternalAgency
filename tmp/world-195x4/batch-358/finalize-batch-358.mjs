import fs from "node:fs";
import path from "node:path";
const root=path.resolve("tmp/world-195x4/batch-358");
const lore=path.resolve("assets/lore/starlight-era");
const checkpointPath=path.join(lore,"batch-358-zimbabwe-rescue-vessel-checkpoint.json");
const preflight=JSON.parse(fs.readFileSync(path.join(root,"batch-358-zimbabwe-preflight.json"),"utf8"));
const checkpoint={
  ...preflight,
  status:"terminal-zero-accepted",
  renderAttempts:{raw:{status:"complete",requested:4,fulfilled:0,moderationBlocked:4,concurrency:"four independent built-in image generation calls launched together"},recovery:{status:"not-used",reason:"All four calls returned no asset due to output moderation; fast throughput mode advances the terminal country without retry delay."}},
  acceptedAssets:[],
  rejectedAssets:[
    {scene:1452,status:"rejected-output-moderation",requestId:"94f962a6-8c71-4faa-bf35-759da4a7ea5c",reason:"No image asset was returned."},
    {scene:1453,status:"rejected-output-moderation",requestId:"b9dd692d-e82a-49d6-b940-792251062198",reason:"No image asset was returned."},
    {scene:1454,status:"rejected-output-moderation",requestId:"2db05947-0a5b-4883-9c1c-6d50e6b33083",reason:"No image asset was returned."},
    {scene:1455,status:"rejected-output-moderation",requestId:"c78147c0-2827-48bb-98a0-c579a94eb2d5",reason:"No image asset was returned."}
  ],
  xPost:{status:"deferred-insufficient-accepted-assets",minimumCurrentCountryAcceptedAssets:2,currentCountryAcceptedAssets:0,caption:preflight.xPublishingPlan.captionIfEligible,reason:"No accepted current-country images exist; no Zimbabwe X compose action was opened."},
  completedAt:new Date().toISOString(),
  throughputMode:"fast-pass per explicit user direction; output-moderation no-assets are terminal and do not stall the queue",
  queueAdvance:{country:"Guinea",batch:359,scenes:[1456,1457,1458,1459],cinematicTheme:"orbital spaceship couture",batchOrdinalWithinTheme:1}
};
fs.writeFileSync(checkpointPath,`${JSON.stringify(checkpoint,null,2)}\n`,"utf8");
console.log(JSON.stringify({checkpointPath,status:checkpoint.status,xPost:checkpoint.xPost,next:checkpoint.queueAdvance},null,2));

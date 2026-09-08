import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repo = process.cwd();
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-384-comoros-moon-surface-expedition-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const rows = [
  {
    scene: 1556,
    callId: "exec-febd9a61-ce90-4ab4-a355-7841eaa6bba1",
    occurredAt: "2026-08-13T13:44:24.919Z",
    source: "C:/Users/A/.codex/generated_images/019ff973-4f4e-7c73-89d5-ffae7c69d47c/exec-febd9a61-ce90-4ab4-a355-7841eaa6bba1.png",
    sha256: "92125E35BD86772A626D7B288218AA3D5EEC7F74144CA832409135BF315CF618",
    bytes: 2689266,
    raw: "tmp/world-195x4/batch-384/raw/pass-2/scene-1556.png",
    asset: "assets/lore/starlight-era/1556-comoros-mutsamudu-moon-surface-expedition-bounded-pass-2.png",
    audit: "four anchored adults, opaque public-safe short looks, complete gross anatomy and footwear, both mascots safe on lounge; isolated side-on handler aims over empty harbour water at visible orange marker"
  },
  {
    scene: 1557,
    callId: "exec-bfc4dcd2-31d7-4c9d-9e5b-eba1a72e3a9b",
    occurredAt: "2026-08-13T13:45:44.845Z",
    source: "C:/Users/A/.codex/generated_images/019ff973-4f4e-7c73-89d5-ffae7c69d47c/exec-bfc4dcd2-31d7-4c9d-9e5b-eba1a72e3a9b.png",
    sha256: "4F5AA4B51AB541CFD253CD8D7B1909C31F34D3B969F190994B5846696CC94CA1",
    bytes: 2784103,
    raw: "tmp/world-195x4/batch-384/raw/pass-2/scene-1557.png",
    asset: "assets/lore/starlight-era/1557-comoros-coelacanth-coast-moon-surface-expedition-bounded-pass-2.png",
    audit: "four anchored adults, opaque public-safe short looks, complete gross anatomy and footwear, both mascots safe left; isolated handler aims side-on at diamond paper target on thick concrete backstop"
  },
  {
    scene: 1558,
    callId: "exec-b8dead8e-033d-4244-ab54-99f909e1f195",
    occurredAt: "2026-08-13T13:47:19.680Z",
    source: "C:/Users/A/.codex/generated_images/019ff973-4f4e-7c73-89d5-ffae7c69d47c/exec-b8dead8e-033d-4244-ab54-99f909e1f195.png",
    sha256: "3CBBCB5AEE6F4BCB6CC21DF5047034DA4AB3282EA24BD538903FBC7730C6E08A",
    bytes: 2695368,
    raw: "tmp/world-195x4/batch-384/raw/pass-2/scene-1558.png",
    asset: "assets/lore/starlight-era/1558-comoros-karthala-moon-surface-expedition-male-bounded-pass-2.png",
    audit: "four anchored women plus established adult man, opaque public-safe short looks, complete gross anatomy and footwear, no mascots; isolated Alia aims side-on at diamond paper target on thick stone backstop"
  },
  {
    scene: 1559,
    callId: "exec-d467d615-7754-4c7d-b051-353227eea074",
    occurredAt: "2026-08-13T13:49:13.770Z",
    source: "C:/Users/A/.codex/generated_images/019ff973-4f4e-7c73-89d5-ffae7c69d47c/exec-d467d615-7754-4c7d-b051-353227eea074.png",
    sha256: "DDC2E2DC525787E09FE840AA0543F4BECB42FD437688CBDC91493D03BBE3D538",
    bytes: 2698102,
    raw: "tmp/world-195x4/batch-384/raw/pass-2/scene-1559.png",
    asset: "assets/lore/starlight-era/1559-comoros-mwali-lagoon-moon-surface-expedition-bounded-pass-2.png",
    audit: "four anchored adults, opaque public-safe short looks, complete gross anatomy and footwear, both mascots safe on lounge; isolated side-on handler aims away from group over empty lagoon with visible orange marker"
  }
];

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
for (const row of rows) {
  if (!fs.existsSync(row.source)) throw new Error(`Missing source ${row.source}`);
  if (sha(row.source) !== row.sha256) throw new Error(`Hash mismatch for scene ${row.scene}`);
  for (const rel of [row.raw, row.asset]) {
    const dest = path.join(repo, rel);
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(row.source, dest);
  }
}

checkpoint.status = "complete-four-of-four-hard-safe-pass-2-accepted-no-more-comoros-rendering";
checkpoint.policy.pass2CandidatesConsumed = 4;
checkpoint.policy.automaticThirdPassAllowed = false;
checkpoint.renderPasses.pass2.status = "completed-four-concurrent-four-hard-safe-accepted";
checkpoint.renderPasses.pass2.candidatesConsumed = 4;
checkpoint.renderPasses.pass2.events = rows.map((row) => ({
  scene: row.scene,
  callId: row.callId,
  occurredAt: row.occurredAt,
  status: "completed-hard-safe-accepted",
  promptPath: checkpoint.renderPasses.pass2.prompts[String(row.scene)].path,
  promptSha256: checkpoint.renderPasses.pass2.prompts[String(row.scene)].sha256,
  promptBytes: checkpoint.renderPasses.pass2.prompts[String(row.scene)].bytes,
  rawPath: row.raw,
  rawSha256: row.sha256,
  rawBytes: row.bytes,
  dimensions: [941, 1672],
  hardGateAudit: row.audit,
  acceptedAsset: row.asset
}));
checkpoint.renderPasses.pass2.auditStandard = "bounded hard gates only; exact garment microdetails, motifs, eye line, emotion, contact count, choreography, and pixel-perfect marker alignment remain soft quality targets";
checkpoint.renderPasses.pass2.thirdPassAllowed = false;
checkpoint.acceptedAssets = rows.map((row) => ({scene: row.scene, file: row.asset, sha256: row.sha256, bytes: row.bytes, dimensions: [941, 1672], acceptance: "bounded-hard-safe-pass-2"}));
checkpoint.hardSafeAcceptedCount = 4;
checkpoint.missingSceneNumbers = [];
checkpoint.xPost.status = "eligible-pending-live-duplicate-reconciliation-and-publication";
checkpoint.nextQueue = {
  nextCountry: "Guyana",
  nextBatch: 385,
  sceneNumbers: [1560, 1561, 1562, 1563],
  cinematicTheme: "near-Sun solar-observation couture",
  themePairPosition: 1,
  countryEvidence: [
    "assets/lore/starlight-era/batch-313-comoros-recovery-checkpoint.json#/nextQueueCountry",
    "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/159"
  ],
  lockedUntilBatch384Closed: false,
  materializationAllowedAfterRemoteVerifiedBatch384Closure: true
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({checkpoint: path.relative(repo, checkpointPath).replaceAll("\\", "/"), acceptedAssets: rows.map(r => r.asset)}, null, 2));

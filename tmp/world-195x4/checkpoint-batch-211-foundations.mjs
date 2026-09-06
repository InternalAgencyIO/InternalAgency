import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repo = process.cwd();
const batchRoot = path.join(repo, 'tmp', 'world-195x4', 'batch-211');
const checkpointPath = path.join(batchRoot, 'runtime-checkpoint.json');
const planPath = path.join(batchRoot, 'scene-plan.json');
const campaignPath = path.join(repo, 'assets', 'lore', 'starlight-era', 'world-195x4-campaign.json');
const generatedRoot = 'C:\\Users\\A\\.codex\\generated_images\\019fc83b-b7ab-7c70-a1b9-0953296a4666';
const now = new Date().toISOString();

const accepted = [
  { scene: 864, attempts: 5, source: 'exec-fac6d144-b71f-4eaa-9b4d-6a5fcf14d8d2.png', file: '864-philippines-manila-bay-gala-route-light-grid-foundation-accepted.png', nextStage: 'relationship-refinement' },
  { scene: 865, attempts: 5, source: 'exec-cf597795-f75a-444d-98ac-40bdb7ea2e6a.png', file: '865-philippines-vigan-calle-crisologo-cabin-signal-cipher-foundation-accepted.png', nextStage: 'relationship-refinement' },
  { scene: 866, attempts: 6, source: 'exec-f5a42110-593e-4a8b-a014-771e65a14194.png', file: '866-philippines-banaue-rice-terraces-star-map-relay-foundation-accepted.png', nextStage: 'relationship-refinement' },
  { scene: 867, attempts: 5, source: 'exec-17f37cc0-8339-4e4f-97d4-d7eb287ec745.png', file: '867-philippines-el-nido-bacuit-bay-arrival-beacon-finale-foundation-accepted.png', nextStage: 'triggered-detail-validation' },
];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const rel = (p) => path.relative(repo, p).replaceAll('\\', '/');

for (const item of accepted) {
  const src = path.join(generatedRoot, item.source);
  const dst = path.join(batchRoot, 'foundations', item.file);
  const sourceBytes = fs.readFileSync(src);
  if (fs.existsSync(dst)) {
    const archivedBytes = fs.readFileSync(dst);
    if (sha256(archivedBytes) !== sha256(sourceBytes)) {
      throw new Error(`Refusing to overwrite archived foundation ${dst}`);
    }
  } else {
    fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL);
  }
  const bytes = fs.readFileSync(dst);
  item.path = rel(dst);
  item.sha256 = sha256(bytes);
  item.bytes = bytes.length;
  item.width = bytes.readUInt32BE(16);
  item.height = bytes.readUInt32BE(20);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
checkpoint.updatedAt = now;
checkpoint.status = 'foundations-accepted';
checkpoint.acceptedFoundations = accepted.map(({ source, ...item }) => item);
for (const lane of checkpoint.lanes) {
  const item = accepted.find((candidate) => candidate.scene === lane.scene);
  lane.status = 'foundation-accepted';
  lane.attempts = item.attempts;
  lane.lastValidStage = 'foundation';
  lane.lastValidAsset = item.path;
  lane.lastValidSha256 = item.sha256;
  lane.lastValidBytes = item.bytes;
  lane.dimensions = `${item.width}x${item.height}`;
  lane.nextStage = item.nextStage;
  lane.foundationValidation = {
    exactAdultWomen: 3,
    exactPaws: 1,
    pawsGrowthStage: 'two-month-old kitten',
    pawsCoat: 'luminous honey-apricot-gold NY11',
    pawsActive: true,
    cleanFaces: true,
    completeFootwear: 6,
    opaqueSecureCouture: true,
    locationReadable: true,
    acceptedAt: now,
  };
}
checkpoint.publicBuild.status = 'foundation-release-pending';
checkpoint.moderationBlocks.push({
  scene: 864,
  attempt: 3,
  recovery: 'Resume from the visually sound archived candidate and split coat-color and footwear corrections into one-variable edits.',
});
checkpoint.moderationBlocks.push({
  scene: 866,
  attempt: 4,
  recovery: 'Retry only footwear staging from the immediately prior valid reciprocity asset with simpler composition wording.',
});
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);

const applySceneState = (scene) => {
  const item = accepted.find((candidate) => candidate.scene === scene.number);
  scene.status = 'foundation-accepted';
  scene.renderState.status = 'foundation-accepted';
  scene.renderState.attempts = item.attempts;
  scene.renderState.lastValidStage = 'foundation';
  scene.renderState.lastValidAsset = item.path;
  scene.renderState.lastValidSha256 = item.sha256;
  scene.renderState.lastValidBytes = item.bytes;
  scene.renderState.dimensions = `${item.width}x${item.height}`;
  scene.renderState.nextStage = item.nextStage;
  scene.renderState.stages.foundation = 'accepted';
  scene.renderState.stages.companion = 'accepted-in-foundation';
  scene.renderState.stages.validation = 'foundation-passed';
};

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
plan.status = 'foundations-accepted';
plan.renderTiming.firstFoundationAt ??= now;
for (const scene of plan.scenes) applySceneState(scene);
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
const plannedBatch = campaign.plannedBatches.find((batch) => batch.batch === 211);
if (!plannedBatch) throw new Error('Batch 211 is missing from campaign plannedBatches');
plannedBatch.status = 'foundations-accepted';
plannedBatch.renderTiming.firstFoundationAt ??= now;
for (const scene of plannedBatch.scenes) applySceneState(scene);
campaign.activeRenderCheckpoint = {
  ...campaign.activeRenderCheckpoint,
  status: 'foundations-accepted',
  updatedAt: now,
  acceptedFoundationCount: 4,
  acceptedFoundationHashes: accepted.map((item) => ({ number: item.scene, sha256: item.sha256 })),
  nextAction: 'Advance only the required relationship, silhouette and triggered-detail refinements from each archived accepted foundation; then run final batch validation.',
};
fs.writeFileSync(campaignPath, `${JSON.stringify(campaign, null, 2)}\n`);

console.log(JSON.stringify({ status: checkpoint.status, accepted: checkpoint.acceptedFoundations }, null, 2));

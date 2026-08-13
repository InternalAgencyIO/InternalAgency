import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repo = process.cwd();
const batchRoot = path.join(repo, 'tmp', 'world-195x4', 'batch-211');
const generatedRoot = 'C:\\Users\\A\\.codex\\generated_images\\019fc83b-b7ab-7c70-a1b9-0953296a4666';
const checkpointPath = path.join(batchRoot, 'runtime-checkpoint.json');
const planPath = path.join(batchRoot, 'scene-plan.json');
const campaignPath = path.join(repo, 'assets', 'lore', 'starlight-era', 'world-195x4-campaign.json');
const now = new Date().toISOString();
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const rel = (p) => path.relative(repo, p).replaceAll('\\', '/');

const accepted = [
  { scene: 864, attempts: 6, source: 'exec-be906b16-353c-4506-9f64-bb7176789d2d.png', directory: 'relationship', file: '864-philippines-manila-bay-gala-route-light-grid-relationship.png', stage: 'relationship', nextStage: 'companion-ribbon-refinement' },
  { scene: 865, attempts: 6, source: 'exec-4f95f0a9-1f6b-4983-b73d-9127abbe589c.png', directory: 'relationship', file: '865-philippines-vigan-calle-crisologo-cabin-signal-cipher-relationship.png', stage: 'relationship', nextStage: 'triggered-detail-refinement' },
  { scene: 866, attempts: 7, source: 'exec-23be3c60-3e79-4906-840e-c5c3e6feaf47.png', directory: 'relationship', file: '866-philippines-banaue-rice-terraces-star-map-relay-relationship.png', stage: 'relationship', nextStage: 'triggered-detail-refinement' },
  { scene: 867, attempts: 6, source: 'exec-af40eaf7-3b1f-41d8-ae27-97586ce141f1.png', directory: 'details', file: '867-philippines-el-nido-bacuit-bay-arrival-beacon-detail-01-choker.png', stage: 'triggered-detail', nextStage: 'remaining-detail-validation' },
];

for (const item of accepted) {
  const src = path.join(generatedRoot, item.source);
  const dir = path.join(batchRoot, item.directory);
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, item.file);
  const sourceBytes = fs.readFileSync(src);
  if (fs.existsSync(dst)) {
    const archivedBytes = fs.readFileSync(dst);
    if (sha256(archivedBytes) !== sha256(sourceBytes)) throw new Error(`Refusing to overwrite ${dst}`);
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
checkpoint.status = 'refinement-partial';
checkpoint.acceptedRefinements = accepted.map(({ source, directory, ...item }) => item);
for (const lane of checkpoint.lanes) {
  const item = accepted.find((candidate) => candidate.scene === lane.scene);
  lane.status = `${item.stage}-accepted`;
  lane.attempts = item.attempts;
  lane.lastValidStage = item.stage;
  lane.lastValidAsset = item.path;
  lane.lastValidSha256 = item.sha256;
  lane.lastValidBytes = item.bytes;
  lane.dimensions = `${item.width}x${item.height}`;
  lane.nextStage = item.nextStage;
  lane.noRegressionValidation = {
    identity: true,
    cleanFaces: true,
    adultTrio: true,
    exactPaws: true,
    pawsTwoMonthGoldenActive: true,
    completeFootwear: true,
    location: true,
    acceptedAt: now,
  };
}
checkpoint.publicBuild.pendingRefinementRelease = true;
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);

const updateScenes = (scenes) => {
  for (const scene of scenes) {
    const item = accepted.find((candidate) => candidate.scene === scene.number);
    scene.status = `${item.stage}-accepted`;
    scene.renderState.status = `${item.stage}-accepted`;
    scene.renderState.attempts = item.attempts;
    scene.renderState.lastValidStage = item.stage;
    scene.renderState.lastValidAsset = item.path;
    scene.renderState.lastValidSha256 = item.sha256;
    scene.renderState.lastValidBytes = item.bytes;
    scene.renderState.dimensions = `${item.width}x${item.height}`;
    scene.renderState.nextStage = item.nextStage;
    if (item.stage === 'relationship') scene.renderState.stages.relationship = 'accepted';
    if (item.stage === 'triggered-detail') scene.renderState.stages.triggeredDetails = 'partial-accepted';
  }
};

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
plan.status = 'refinement-partial';
updateScenes(plan.scenes);
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
const plannedBatch = campaign.plannedBatches.find((batch) => batch.batch === 211);
if (!plannedBatch) throw new Error('Batch 211 is missing');
plannedBatch.status = 'refinement-partial';
updateScenes(plannedBatch.scenes);
campaign.activeRenderCheckpoint = {
  ...campaign.activeRenderCheckpoint,
  status: 'refinement-partial',
  updatedAt: now,
  acceptedRefinementHashes: accepted.map((item) => ({ number: item.scene, stage: item.stage, sha256: item.sha256 })),
  nextAction: 'Resume only the remaining companion and triggered-detail refinements from the archived latest valid asset for each lane.',
};
fs.writeFileSync(campaignPath, `${JSON.stringify(campaign, null, 2)}\n`);

console.log(JSON.stringify({ status: checkpoint.status, accepted: checkpoint.acceptedRefinements }, null, 2));

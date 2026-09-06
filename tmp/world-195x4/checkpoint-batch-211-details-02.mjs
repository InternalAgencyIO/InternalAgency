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
  { scene: 864, attempts: 7, source: 'exec-30fce99b-aaba-48ee-b317-1ab927bdb094.png', file: '864-philippines-manila-bay-detail-01-ribbon-chase.png', completed: ['companion.PAWS', 'companion.PAWS.ribbon-chase'], nextStage: 'remaining-detail-validation' },
  { scene: 865, attempts: 7, source: 'exec-1b2f53e2-6baa-4e5c-b206-f9bf922029a9.png', file: '865-philippines-vigan-detail-01-sculptural-cuff.png', completed: ['Ellie.sculpturalCuff'], nextStage: 'next-triggered-detail' },
  { scene: 866, attempts: 8, source: 'exec-d2f9eea3-ed73-42a6-8d6b-49aedd92d9d6.png', file: '866-philippines-banaue-detail-01-shoulder-tattoo.png', completed: ['Radiance.tattoo'], nextStage: 'next-triggered-detail' },
  { scene: 867, attempts: 7, source: 'exec-b4b2638e-6587-4b56-9cad-20601d728dbb.png', file: '867-philippines-el-nido-detail-02-collarbone-chain.png', completed: ['Alia.collarboneJewelryChain', 'Alia.velvetChokerPendantSignal'], nextStage: 'lower-back-detail-refinement' },
];

for (const item of accepted) {
  const src = path.join(generatedRoot, item.source);
  const dir = path.join(batchRoot, 'details');
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
checkpoint.status = 'triggered-detail-partial';
checkpoint.acceptedDetailPass02 = accepted.map(({ source, ...item }) => item);
for (const lane of checkpoint.lanes) {
  const item = accepted.find((candidate) => candidate.scene === lane.scene);
  lane.status = 'triggered-detail-accepted';
  lane.attempts = item.attempts;
  lane.lastValidStage = 'triggered-detail';
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
checkpoint.publicBuild.pendingDetailPass02Release = true;
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);

const updateScenes = (scenes) => {
  for (const scene of scenes) {
    const item = accepted.find((candidate) => candidate.scene === scene.number);
    scene.status = 'triggered-detail-accepted';
    scene.renderState.status = 'triggered-detail-accepted';
    scene.renderState.attempts = item.attempts;
    scene.renderState.lastValidStage = 'triggered-detail';
    scene.renderState.lastValidAsset = item.path;
    scene.renderState.lastValidSha256 = item.sha256;
    scene.renderState.lastValidBytes = item.bytes;
    scene.renderState.dimensions = `${item.width}x${item.height}`;
    scene.renderState.nextStage = item.nextStage;
    scene.renderState.stages.triggeredDetails = 'partial-accepted';
    const progress = scene.renderState.detailProgress;
    progress.completed = [...new Set([...(progress.completed ?? []), ...item.completed])];
    progress.remaining = (progress.remaining ?? []).filter((detail) => !item.completed.includes(detail));
  }
};

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
plan.status = 'triggered-detail-partial';
updateScenes(plan.scenes);
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
const plannedBatch = campaign.plannedBatches.find((batch) => batch.batch === 211);
if (!plannedBatch) throw new Error('Batch 211 is missing');
plannedBatch.status = 'triggered-detail-partial';
updateScenes(plannedBatch.scenes);
campaign.activeRenderCheckpoint = {
  ...campaign.activeRenderCheckpoint,
  status: 'triggered-detail-partial',
  updatedAt: now,
  acceptedDetailPass02Hashes: accepted.map((item) => ({ number: item.scene, sha256: item.sha256 })),
  nextAction: 'Resume one remaining triggered detail per lane from each latest archived asset, preserving all accepted PAWS and clean-face gates.',
};
fs.writeFileSync(campaignPath, `${JSON.stringify(campaign, null, 2)}\n`);

console.log(JSON.stringify({ status: checkpoint.status, accepted: checkpoint.acceptedDetailPass02 }, null, 2));

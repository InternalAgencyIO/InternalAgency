import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repo = process.cwd();
const batchRoot = path.join(repo, 'tmp', 'world-195x4', 'batch-211');
const checkpointPath = path.join(batchRoot, 'runtime-checkpoint.json');
const planPath = path.join(batchRoot, 'scene-plan.json');
const campaignPath = path.join(repo, 'assets', 'lore', 'starlight-era', 'world-195x4-campaign.json');
const now = new Date().toISOString();
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const rel = (p) => path.relative(repo, p).replaceAll('\\', '/');

const accepted = [
  { scene: 864, attempts: 9, file: '864-philippines-manila-bay-detail-02-compact-ribbon.png', completed: ['companion.PAWS', 'companion.PAWS.ribbon-chase'], nextStage: 'remaining-detail-validation' },
  { scene: 865, attempts: 8, file: '865-philippines-vigan-detail-02-cabin-host-headpiece.png', completed: ['Alia.hat'], nextStage: 'next-triggered-detail' },
  { scene: 866, attempts: 9, file: '866-philippines-banaue-detail-02-ring-choker-hip-accent.png', completed: ['Ellie.ringChokerHipChainAccent'], nextStage: 'next-triggered-detail' },
];

for (const item of accepted) {
  const dst = path.join(batchRoot, 'details', item.file);
  const bytes = fs.readFileSync(dst);
  item.path = rel(dst);
  item.sha256 = sha256(bytes);
  item.bytes = bytes.length;
  item.width = bytes.readUInt32BE(16);
  item.height = bytes.readUInt32BE(20);
}

const blocked867 = {
  scene: 867,
  trait: 'Ellie.lowerBackTattoo',
  attempts: 10,
  status: 'blocked-after-three-one-variable-methods',
  retainedAsset: 'tmp/world-195x4/batch-211/details/867-philippines-el-nido-detail-02-collarbone-chain.png',
  evidence: [
    'The first mark attempt landed on front garment fabric.',
    'The second mark attempt landed on the front torso instead of the right lower back.',
    'The pose-only side-back reveal regressed the binding three-way embrace.',
  ],
  nextSafeMethod: 'Do not retry this trait until a new safe method can preserve the accepted embrace and expose the correct lower-back skin panel in one controlled dependency chain.',
};

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
checkpoint.updatedAt = now;
checkpoint.status = 'triggered-detail-partial-with-one-blocked-lane';
checkpoint.acceptedDetailPass03 = accepted;
checkpoint.blockedLanes = [...(checkpoint.blockedLanes ?? []).filter((item) => item.scene !== 867), blocked867];
checkpoint.rejectedCandidates.push(
  { scene: 864, reason: 'Shortened ribbon no longer reached PAWS; retained prior ribbon-chase asset and retried only the excess loop.' },
  { scene: 867, reason: 'Lower-back mark landed on front garment fabric; prior accepted asset retained.' },
  { scene: 867, reason: 'Lower-back mark landed on front torso; prior accepted asset retained.' },
  { scene: 867, reason: 'Pose-only side-back reveal regressed the binding embrace; prior accepted asset retained.' },
);
for (const lane of checkpoint.lanes) {
  const item = accepted.find((candidate) => candidate.scene === lane.scene);
  if (item) {
    lane.status = 'triggered-detail-accepted';
    lane.attempts = item.attempts;
    lane.lastValidStage = 'triggered-detail';
    lane.lastValidAsset = item.path;
    lane.lastValidSha256 = item.sha256;
    lane.lastValidBytes = item.bytes;
    lane.dimensions = `${item.width}x${item.height}`;
    lane.nextStage = item.nextStage;
    lane.blocker = null;
  } else if (lane.scene === 867) {
    lane.status = 'blocked-safe-method-needed';
    lane.attempts = blocked867.attempts;
    lane.nextStage = 'await-safe-lower-back-method';
    lane.blocker = blocked867;
  }
}
checkpoint.publicBuild.pendingDetailPass03Release = true;
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);

const updateScenes = (scenes) => {
  for (const scene of scenes) {
    const item = accepted.find((candidate) => candidate.scene === scene.number);
    if (item) {
      scene.status = 'triggered-detail-accepted';
      scene.renderState.status = 'triggered-detail-accepted';
      scene.renderState.attempts = item.attempts;
      scene.renderState.lastValidStage = 'triggered-detail';
      scene.renderState.lastValidAsset = item.path;
      scene.renderState.lastValidSha256 = item.sha256;
      scene.renderState.lastValidBytes = item.bytes;
      scene.renderState.dimensions = `${item.width}x${item.height}`;
      scene.renderState.nextStage = item.nextStage;
      const progress = scene.renderState.detailProgress;
      progress.completed = [...new Set([...(progress.completed ?? []), ...item.completed])];
      progress.remaining = (progress.remaining ?? []).filter((detail) => !item.completed.includes(detail));
    } else if (scene.number === 867) {
      scene.status = 'blocked-safe-method-needed';
      scene.renderState.status = 'blocked-safe-method-needed';
      scene.renderState.attempts = blocked867.attempts;
      scene.renderState.nextStage = 'await-safe-lower-back-method';
      scene.renderState.blocker = blocked867;
    }
  }
};

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
plan.status = 'triggered-detail-partial-with-one-blocked-lane';
updateScenes(plan.scenes);
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
const plannedBatch = campaign.plannedBatches.find((batch) => batch.batch === 211);
if (!plannedBatch) throw new Error('Batch 211 is missing');
plannedBatch.status = 'triggered-detail-partial-with-one-blocked-lane';
updateScenes(plannedBatch.scenes);
campaign.activeRenderCheckpoint = {
  ...campaign.activeRenderCheckpoint,
  status: 'triggered-detail-partial-with-one-blocked-lane',
  updatedAt: now,
  acceptedDetailPass03Hashes: accepted.map((item) => ({ number: item.scene, sha256: item.sha256 })),
  blockedLane: blocked867,
  nextAction: 'Continue remaining safe triggered details on lanes 864–866; keep lane 867 frozen until a safe lower-back method is available.',
};
fs.writeFileSync(campaignPath, `${JSON.stringify(campaign, null, 2)}\n`);

console.log(JSON.stringify({ status: checkpoint.status, accepted, blocked867 }, null, 2));

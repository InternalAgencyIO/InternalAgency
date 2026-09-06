import fs from 'node:fs';
import path from 'node:path';

const repo = 'C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency';
const preflightPath = path.join(repo, 'tmp/world-195x4/batch-372/batch-372-czechia-preflight.json');
const assetDir = path.join(repo, 'assets/lore/starlight-era');
const checkpointPath = path.join(assetDir, 'batch-372-czechia-orbital-research-station-checkpoint.json');
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));

const accepted = [
  {
    scene: 1508,
    file: '1508-czechia-prague-orbital-research-station-male-fast-pass.png',
    decision: 'accepted-fast-pass',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-821954bb-4343-463e-b6e3-1c82b97b050f.png',
    audit: {
      coreCast: 'Exactly four clearly adult core women plus the established adult male are present; Alia retains the braided anchor.',
      anatomy: 'No glaring extra whole person or limb is visible; ten owned arms and hands read plausibly.',
      missionProp: 'ECE alone uses a visible two-hand grip toward an empty paper target and complete backstop, away from every person and the camera.',
      romance: 'The male sustains his strongest eye line toward ECE while the quartet forms a clear multi-contact slow-dance chain.',
      themeLocation: 'Prague rooflines, Vltava setting and orbital-research architecture read together in one foreground composition.',
      deviations: ['Rolled MAX-only mascot is absent.']
    }
  },
  {
    scene: 1510,
    file: '1510-czechia-moravian-karst-orbital-research-station-recovery.png',
    decision: 'accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-1648bd53-c6e3-4d68-9c07-035b2db006f1.png',
    audit: {
      coreCast: 'Exactly four clearly adult core women are present; Alia retains the braided anchor.',
      anatomy: 'No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.',
      missionProp: 'ECE alone uses a clear eye-level two-hand side-profile grip toward a visible empty paper target and complete stone backstop.',
      romance: 'The women maintain a linked shoulder, hand and arm contact chain behind the muzzle corridor.',
      themeLocation: 'Moravian Karst cliffs, cavern mouth and civilian orbital-research structures remain large and recognizable.',
      deviations: ['The rolled folding solar fan is absent.', 'The close partner-dance beat resolves as a stationary linked contact chain.']
    }
  },
  {
    scene: 1511,
    file: '1511-czechia-karlovy-vary-orbital-research-station-recovery.png',
    decision: 'accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-73ff066f-cea6-4400-a7e7-5709bc76335b.png',
    audit: {
      coreCast: 'Exactly four clearly adult core women are present; Alia is the sole braided mission-prop handler.',
      anatomy: 'No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.',
      missionProp: 'Alia alone uses a clear two-hand side-profile grip toward a visible empty paper target and complete stone backstop.',
      romance: 'Radiance and rainbow-hosiery ECE are the affectionate center of a visible three-person hand-and-shoulder contact cluster.',
      themeLocation: 'Karlovy Vary hillside architecture, valley, storm and orbital-research modules read together.',
      deviations: ['The close partner-dance beat resolves as a stationary three-person affectionate contact.', 'PAWS appears on a padded platform but nearer the group than requested.']
    }
  }
];

for (const item of accepted) {
  fs.copyFileSync(item.sourceRaw, path.join(assetDir, item.file));
}

checkpoint.status = 'terminal-partially-accepted';
checkpoint.sourceCommit = '98173b1e86f7f467c63ca63a37237cf32aec10b6';
checkpoint.nextQueueCountry = 'Honduras';
checkpoint.nextQueueBatch = 373;
checkpoint.nextQueueScenes = [1512, 1513, 1514, 1515];
checkpoint.nextCinematicTheme = { active: 'private-jet aviation couture', batchOrdinalWithinTheme: 1 };
checkpoint.renderAttempts = {
  raw: {
    status: 'complete',
    requested: 4,
    fulfilled: 3,
    moderationBlocked: 1,
    concurrency: 'four independent built-in image generation calls launched together'
  },
  recovery: {
    status: 'complete',
    attemptedScenes: [1510, 1511],
    acceptedScenes: [1510, 1511],
    maximumPerBlockedScene: 1,
    reason: 'Raw scenes 1510 and 1511 failed the mission-prop ownership gate; each received one exact side-profile two-hand recovery and passed.'
  }
};
checkpoint.acceptedAssets = accepted;
checkpoint.rejectedAssets = [
  {
    scene: 1509,
    status: 'terminal-renderer-output-moderation-block',
    requestId: 'c8d3c4d2-ae46-4510-bb25-caa0fce00166',
    reason: 'The image service rejected the output before an auditable asset was delivered.'
  },
  {
    scene: 1510,
    status: 'rejected-raw-replaced-by-accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-159478eb-911b-46cd-84c8-23412c713199.png',
    reason: 'The raw render showed one-hand mission-prop control and no visible target.'
  },
  {
    scene: 1511,
    status: 'rejected-raw-replaced-by-accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-2a3509eb-d5e7-4075-8960-07fa674e23c7.png',
    reason: 'The raw render omitted Alia and the active mission prop entirely.'
  }
];
checkpoint.xPost = {
  status: 'eligible-queued-behind-confirmation-gated-bolivia-composer',
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 3,
  caption: 'Czechia white-heart Cuba #Czechia #WorldXXXSeries',
  attachmentPlan: [accepted[0].file, accepted[1].file, '1504-cuba-havana-orbital-research-station-recovery.png'],
  reason: 'An earlier exact Bolivia post remains staged in the signed-in X composer behind a required final-post confirmation. The composer was not overwritten or duplicated.'
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, accepted: accepted.map(({ scene, file }) => ({ scene, file })) }, null, 2));

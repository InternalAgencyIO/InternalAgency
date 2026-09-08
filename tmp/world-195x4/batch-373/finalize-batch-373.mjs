import fs from 'node:fs';
import path from 'node:path';

const repo = 'C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency';
const preflightPath = path.join(repo, 'tmp/world-195x4/batch-373/batch-373-honduras-preflight.json');
const assetDir = path.join(repo, 'assets/lore/starlight-era');
const checkpointPath = path.join(assetDir, 'batch-373-honduras-private-jet-aviation-checkpoint.json');
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));

const accepted = [
  {
    scene: 1512,
    file: '1512-honduras-tegucigalpa-private-jet-male-recovery.png',
    decision: 'accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-72a61ec8-622f-4177-adb3-57e52ec29ca4.png',
    audit: {
      coreCast: 'Exactly four clearly adult core women plus the established adult male are present; Alia retains the braided anchor and sole mission-prop ownership.',
      anatomy: 'No glaring extra whole person or limb is visible; ten owned arms and hands read plausibly.',
      missionProp: 'Alia alone uses a visible two-hand side-profile grip aligned to an empty paper target and complete earth backstop, away from every person and the camera.',
      romance: 'The male and three women form a clear hand, shoulder and waist contact chain behind the muzzle corridor; Radiance and ECE remain the dramatic center.',
      themeLocation: 'Tegucigalpa mountain basin, river, private-jet cabin and swept wing read together in one immediate foreground composition.',
      deviations: ['The controlled dance dip resolves as a standing interrupted contact chain.', 'The male eye-line hierarchy is less pronounced than requested.']
    }
  },
  {
    scene: 1515,
    file: '1515-honduras-lake-yojoa-private-jet-recovery.png',
    decision: 'accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-d177df7e-ef69-48fe-b947-7c541ae1f203.png',
    audit: {
      coreCast: 'Exactly four clearly adult core women are present; Alia retains the braided anchor.',
      anatomy: 'No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.',
      missionProp: 'ECE alone uses a clear eye-level two-hand side-profile grip aligned to a visible empty paper target and complete earth backstop.',
      romance: 'The other three women form a visible shoulder, upper-arm and waist contact chain fully behind ECE and outside the muzzle corridor.',
      themeLocation: 'Lake Yojoa, mountain frame, storm, private-jet terrace and four distinct aviation silhouettes read together.',
      deviations: ['The close partner dance resolves as a standing support chain.', 'Rolled PAWS-only mascot is absent.', 'Alia visibly owns the neon acrylic cello but does not actively play it.']
    }
  }
];

for (const item of accepted) fs.copyFileSync(item.sourceRaw, path.join(assetDir, item.file));

checkpoint.status = 'terminal-partially-accepted';
checkpoint.sourceCommit = '58fd4ff95e7e4d306ab76fcb1eb27e00743d733a';
checkpoint.nextQueueCountry = 'Armenia';
checkpoint.nextQueueBatch = 374;
checkpoint.nextQueueScenes = [1516, 1517, 1518, 1519];
checkpoint.nextCinematicTheme = { active: 'private-jet aviation couture', batchOrdinalWithinTheme: 2 };
checkpoint.renderAttempts = {
  raw: {
    status: 'complete',
    requested: 4,
    fulfilled: 3,
    moderationBlocked: 1,
    concurrency: 'Four independent built-in image generation calls launched together; two undelivered calls from the grouped rejection were resumed independently in the same wake.',
    note: 'Scene 1513 repeatedly produced no auditable asset. Scenes 1512, 1514 and 1515 delivered auditable raws.'
  },
  recovery: {
    status: 'complete',
    attemptedScenes: [1512, 1514, 1515],
    acceptedScenes: [1512, 1515],
    moderationBlockedScenes: [1514],
    maximumPerBlockedScene: 1,
    reason: 'Scene 1512 needed target alignment, scene 1514 needed a single-frame four-person correction, and scene 1515 needed a visible target/backstop corridor. The first and third passed; scene 1514 was output-blocked.'
  }
};
checkpoint.acceptedAssets = accepted;
checkpoint.rejectedAssets = [
  {
    scene: 1513,
    status: 'terminal-renderer-output-moderation-block',
    requestId: 'a007d68f-002f-4072-8e41-2720c43ead2a',
    reason: 'The image service rejected the output before an auditable asset was delivered.'
  },
  {
    scene: 1512,
    status: 'rejected-raw-replaced-by-accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-6e5ac6e7-6516-451e-8423-a6a5c166c2e7.png',
    reason: 'The raw prop line did not align to the visibly separate target and complete backstop.'
  },
  {
    scene: 1514,
    status: 'terminal-recovery-output-moderation-block',
    requestId: '874f0f90-8945-456d-bc1e-36f9903552bb',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-df5b2039-2c89-44b0-87cc-24ad889bfc1a.png',
    reason: 'The raw was a split-panel collage with a duplicated handler and one-hand prop control; its one permitted recovery was output-blocked.'
  },
  {
    scene: 1515,
    status: 'rejected-raw-replaced-by-accepted-recovery',
    sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-e7f0e449-27ae-47b6-9059-ab802b3df406.png',
    reason: 'The raw omitted the required visible target and complete backstop.'
  }
];
checkpoint.xPost = {
  status: 'eligible-queued-behind-confirmation-gated-bolivia-composer',
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 2,
  caption: 'Honduras red-heart Czechia #Honduras',
  attachmentPlan: [accepted[0].file, accepted[1].file, '1508-czechia-prague-orbital-research-station-male-fast-pass.png'],
  reason: 'An earlier exact Bolivia post remains staged in the signed-in X composer behind a required final-post confirmation. The composer was not overwritten or duplicated.'
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, accepted: accepted.map(({ scene, file }) => ({ scene, file })) }, null, 2));

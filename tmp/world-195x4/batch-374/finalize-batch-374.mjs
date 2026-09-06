import fs from 'node:fs';
import path from 'node:path';
const repo = 'C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency';
const assetDir = path.join(repo, 'assets/lore/starlight-era');
const checkpoint = JSON.parse(fs.readFileSync(path.join(repo, 'tmp/world-195x4/batch-374/batch-374-armenia-preflight.json'), 'utf8'));
const accepted = [{
  scene: 1518,
  file: '1518-armenia-garni-gorge-private-jet-recovery.png',
  decision: 'accepted-recovery-fast-pass',
  sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-77fa1ad5-a882-42a7-9c2b-612fe96168d7.png',
  audit: {
    coreCast: 'Exactly four clearly adult core women are present; Alia retains the sole braided mission-prop ownership.',
    anatomy: 'No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.',
    missionProp: 'Alia alone uses a visible two-hand side-profile grip on the inert prop with a safe empty downrange line; an empty paper target and complete earth backstop are visible below the line.',
    romance: 'Radiance, Ellie and ECE form a clear waist, arm and shoulder affection cluster behind Alia and outside the muzzle corridor.',
    themeLocation: 'Garni Gorge basalt columns, canyon river, storm, private-jet cabin and distinct aviation couture read together.',
    deviations: ['The sight line passes above rather than through the visible paper target.', 'The three-person slow dance resolves as a stationary affectionate cluster.']
  }
}];
fs.copyFileSync(accepted[0].sourceRaw, path.join(assetDir, accepted[0].file));
checkpoint.status = 'terminal-partially-accepted';
checkpoint.sourceCommit = '9b645f951437d149fe49cec93c9b4bc02fa8f646';
checkpoint.nextQueueCountry = 'Namibia';
checkpoint.nextQueueBatch = 375;
checkpoint.nextQueueScenes = [1520, 1521, 1522, 1523];
checkpoint.nextCinematicTheme = { active: 'civilian helicopter flight couture', batchOrdinalWithinTheme: 1 };
checkpoint.renderAttempts = {
  raw: { status: 'complete', requested: 4, fulfilled: 2, moderationBlocked: 2, concurrency: 'four independent built-in image generation calls launched together' },
  recovery: { status: 'complete', attemptedScenes: [1516, 1518], acceptedScenes: [1518], maximumPerBlockedScene: 1, reason: 'Both delivered raws failed the mission-prop corridor gate. Garni passed its one recovery; Yerevan remained without a target/backstop corridor.' }
};
checkpoint.acceptedAssets = accepted;
checkpoint.rejectedAssets = [
  { scene: 1517, status: 'terminal-renderer-output-moderation-block', requestId: 'a5fb3eb6-0f03-4833-b7ae-d8c46cdacc6e', reason: 'The image service rejected the output before an auditable asset was delivered.' },
  { scene: 1519, status: 'terminal-renderer-output-moderation-block', requestId: '0d1422d0-b097-4fee-bec6-2ac8b252771d', reason: 'The image service rejected the output before an auditable asset was delivered.' },
  { scene: 1516, status: 'terminal-rejected-after-recovery', sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5b518174-f2be-4ef0-82ce-c49f681f2db2.png', sourceRecovery: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-36969e5f-361a-4818-8c5a-5dbee97d5094.png', reason: 'Both raw and recovery omitted a visible empty target and complete backstop in the prop line.' },
  { scene: 1518, status: 'rejected-raw-replaced-by-accepted-recovery', sourceRaw: 'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-38caea17-329f-4664-9e86-ce567d85170e.png', reason: 'The raw placed a person inside the muzzle corridor and shared mission-prop support.' }
];
checkpoint.xPost = { status: 'deferred-insufficient-accepted-assets', minimumCurrentCountryAcceptedAssets: 2, acceptedCurrentCountryAssets: 1, caption: 'Armenia red-heart Honduras #Armenia #WorldXXXSeries', reason: 'Only one Armenia asset passed the terminal audit; publication requires at least two accepted current-country images.' };
fs.writeFileSync(path.join(assetDir, 'batch-374-armenia-private-jet-aviation-checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);

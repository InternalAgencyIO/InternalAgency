import fs from 'node:fs'; import path from 'node:path';
const repo='C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency', dir=path.join(repo,'assets/lore/starlight-era');
const j=JSON.parse(fs.readFileSync(path.join(repo,'tmp/world-195x4/batch-375/batch-375-namibia-preflight.json'),'utf8'));
j.status='terminal-zero-accepted'; j.sourceCommit='ffb391ec6b3e8b3b125abafe523ed3eb92506b73';
j.nextQueueCountry='Lithuania'; j.nextQueueBatch=376; j.nextQueueScenes=[1524,1525,1526,1527]; j.nextCinematicTheme={active:'civilian helicopter flight couture',batchOrdinalWithinTheme:2};
j.renderAttempts={raw:{status:'complete',requested:4,fulfilled:2,moderationBlocked:2,concurrency:'four independent built-in image generation calls launched together'},recovery:{status:'not-attempted',attemptedScenes:[],acceptedScenes:[],maximumPerBlockedScene:1,reason:'The wake terminalized after strict raw audit; no accepted asset existed and no safe recovery window remained.'}};
j.acceptedAssets=[];
j.rejectedAssets=[
 {scene:1520,status:'terminal-renderer-output-moderation-block',requestId:'f711e5d2-1ea5-4c99-9331-ec5cca60abfc',reason:'The image service rejected the output before an auditable asset was delivered.'},
 {scene:1521,status:'terminal-renderer-output-moderation-block',requestId:'50b96b4e-e758-4c38-98f8-3c70e92bc49b',reason:'The image service rejected the output before an auditable asset was delivered.'},
 {scene:1522,status:'terminal-rejected-raw',sourceRaw:'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-3e24ef1a-35d8-4584-88ae-fed7141182ff.png',reason:'The mission prop aimed out of frame with no visible empty target or complete backstop.'},
 {scene:1523,status:'terminal-rejected-raw',sourceRaw:'C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-bfb1f5a2-b236-4883-b916-7cd9a732f61d.png',reason:'The image duplicated the handler into a sixth adult, violating exact cast and anatomy requirements.'}
];
j.xPost={status:'deferred-insufficient-accepted-assets',minimumCurrentCountryAcceptedAssets:2,acceptedCurrentCountryAssets:0,caption:'Namibia red-heart Armenia #Namibia',reason:'No Namibia asset passed the terminal audit; publication requires at least two accepted current-country images.'};
fs.writeFileSync(path.join(dir,'batch-375-namibia-civilian-helicopter-checkpoint.json'),`${JSON.stringify(j,null,2)}\n`);

import fs from "node:fs";
import crypto from "node:crypto";
const cpPath="assets/lore/starlight-era/batch-385-guyana-near-sun-solar-observation-checkpoint.json";
const j=JSON.parse(fs.readFileSync(cpPath,"utf8"));
const read=(p)=>fs.readFileSync(p,"utf8"), hash=(b)=>crypto.createHash("sha256").update(b).digest("hex").toUpperCase();
const p1561=read("tmp/world-195x4/batch-385/scene-1561-initial-prompt.txt");
const p1563=read("tmp/world-195x4/batch-385/scene-1563-initial-prompt.txt");
j.status="pass-1-complete-two-hard-safe-accepted-two-no-byte-pass-2-two-slot-pending";
j.sourceCommit="3e40265b2fd65e99b01313309f78ce107a11cf1e";
j.policy.pass1CandidatesConsumed=4;
j.renderPasses.pass1.status="completed-two-hard-safe-accepted-two-output-moderation-no-bytes";
j.renderPasses.pass1.candidatesConsumed=4;
j.renderPasses.pass1.events=[
 {scene:1560,callId:"exec-c3a3ae40-b3d2-4d8d-95bb-9c214ee19c80",occurredAt:"2026-08-13T14:23:41.659Z",status:"completed-hard-safe-accepted",promptPath:j.scenePlans[1560].promptPath,promptSha256:j.scenePlans[1560].promptSha256,promptBytes:j.scenePlans[1560].promptBytes,rawPath:"tmp/world-195x4/batch-385/raw/pass-1/scene-1560.png",rawSha256:"2291BFD0E46B4781EA4719BC2D81740388A3B23AF0BC5B03256C60C979482898",rawBytes:2554759,dimensions:[941,1672],hardGateAudit:"five anchored adults, opaque public-safe short fashion, complete gross anatomy and footwear, mascots absent; isolated ECE aims side-on at paper target on complete earth-and-sand backstop behind transparent panel"},
 {scene:1561,callId:"exec-c274e281-21ff-4685-928c-e9ea09a0d6cc",occurredAt:"2026-08-13T14:25:18.387Z",status:"failed-output-moderation-no-bytes",requestId:"f2080b5a-409f-4c6f-8439-357414851e44",categories:["sexual"],promptPath:j.scenePlans[1561].promptPath,promptSha256:j.scenePlans[1561].promptSha256,promptBytes:j.scenePlans[1561].promptBytes,rawState:"no-bytes"},
 {scene:1562,callId:"exec-03adaca3-e2d6-473f-b2b9-8b069725af5e",occurredAt:"2026-08-13T14:27:01.396Z",status:"completed-hard-safe-accepted",promptPath:j.scenePlans[1562].promptPath,promptSha256:j.scenePlans[1562].promptSha256,promptBytes:j.scenePlans[1562].promptBytes,rawPath:"tmp/world-195x4/batch-385/raw/pass-1/scene-1562.png",rawSha256:"A76F3A05B5E2C0C3201419699E7586C6B687206AEB4756ADB67B2DA54E91427D",rawBytes:2274591,dimensions:[941,1672],hardGateAudit:"four anchored adults, opaque public-safe fashion, complete gross anatomy and footwear; MAX safe on separate lounge, sealed display isolated; Alia aims side-on across empty Atlantic water toward visible orange marker"},
 {scene:1563,callId:"exec-561561f5-0163-4c2d-9e9a-385269e5c49e",occurredAt:"2026-08-13T14:28:40.608Z",status:"failed-output-moderation-no-bytes",requestId:"4fbe9714-8b02-404d-aa42-7a37ef4cf412",categories:["sexual"],promptPath:j.scenePlans[1563].promptPath,promptSha256:j.scenePlans[1563].promptSha256,promptBytes:j.scenePlans[1563].promptBytes,rawState:"no-bytes"}
];
j.renderPasses.pass2={status:"authorized-two-concurrent-holistic-corrections",sceneNumbers:[1561,1563],candidatesAuthorized:2,candidatesConsumed:0,launchMode:"two concurrent clean candidates from original identity anchors only",thirdPassAllowed:false,consolidatedCorrections:["fully covered torso, waist, and back","no human contact and separated silhouettes","simple isolated handler lane with complete target and backstop","all limbs and footwear visible"],prompts:{
 "1561":{path:"tmp/world-195x4/batch-385/scene-1561-pass-2-holistic-prompt.txt",sha256:"5774C6301A29677129BCECC8506AFEAF37CDCF8E1461C2EBCF0EF0F9A778938C",bytes:2752},
 "1563":{path:"tmp/world-195x4/batch-385/scene-1563-pass-2-holistic-prompt.txt",sha256:"8A0AC5976F8C6E1EB8674DD505CB684CDB398D28A6376A3B91F09E8707A388B7",bytes:2771}
}};
j.acceptedAssets=[
 {scene:1560,file:null,rawPath:"tmp/world-195x4/batch-385/raw/pass-1/scene-1560.png",sha256:"2291BFD0E46B4781EA4719BC2D81740388A3B23AF0BC5B03256C60C979482898",bytes:2554759,dimensions:[941,1672],acceptance:"bounded-hard-safe-pass-1-canonicalization-pending"},
 {scene:1562,file:null,rawPath:"tmp/world-195x4/batch-385/raw/pass-1/scene-1562.png",sha256:"A76F3A05B5E2C0C3201419699E7586C6B687206AEB4756ADB67B2DA54E91427D",bytes:2274591,dimensions:[941,1672],acceptance:"bounded-hard-safe-pass-1-canonicalization-pending"}
];
j.rejectedAssets=[{scene:1561,status:"failed-output-moderation-no-bytes",callId:"exec-c274e281-21ff-4685-928c-e9ea09a0d6cc"},{scene:1563,status:"failed-output-moderation-no-bytes",callId:"exec-561561f5-0163-4c2d-9e9a-385269e5c49e"}];
j.rejectedPromptLedger={status:"two-no-byte-failures-exact-text-recorded",entries:[
 {entryId:"batch385-scene1561-pass1-exec-c274e281",scene:1561,phase:"pass-1",status:"failed-output-moderation-no-bytes",callId:"exec-c274e281-21ff-4685-928c-e9ea09a0d6cc",requestId:"f2080b5a-409f-4c6f-8439-357414851e44",prompt:{text:p1561,sha256:hash(Buffer.from(p1561)),encoding:"utf-8",bytes:Buffer.byteLength(p1561)},rawOutput:{state:"no-bytes",path:null,sha256:null,bytes:0},immutable:true},
 {entryId:"batch385-scene1563-pass1-exec-561561f5",scene:1563,phase:"pass-1",status:"failed-output-moderation-no-bytes",callId:"exec-561561f5-0163-4c2d-9e9a-385269e5c49e",requestId:"4fbe9714-8b02-404d-aa42-7a37ef4cf412",prompt:{text:p1563,sha256:hash(Buffer.from(p1563)),encoding:"utf-8",bytes:Buffer.byteLength(p1563)},rawOutput:{state:"no-bytes",path:null,sha256:null,bytes:0},immutable:true}
],appendBeforeLaterPassPublicationCommitOrPush:true};
j.hardSafeAcceptedCount=2;j.missingSceneNumbers=[1561,1563];
fs.writeFileSync(cpPath,JSON.stringify(j,null,2)+"\n","utf8");

import fs from "node:fs";
import crypto from "node:crypto";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.events ??= [];

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const referenceShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];
const blacklistSnapshotSha256 = "54E4DBF4EB31115943F0868AA959663097AB7A2C1963144D4496BC8312AD2F6D";
const sentAtUtc = "2026-08-20T12:07:40.950Z";
const expectedPromptShas = {
  1588: "3E706B80E8D42D28CEF77832EF225F3A66766C9C196C93B9212728819914CF25",
  1589: "9570C282ADB3A67077C519A4FDA8C5EA769B7E411BDB1DAC0504C00B4573CEFE",
  1590: "858F92337915A57224C10D88A4597E6530D33291EA7D2DB179D2BE1C03290760",
  1591: "F964E892163D93A9AEF73B7EDC2A1EAF1B83368BA1417125216930F776CE8276",
};
const conversationUrlShas = {
  1588: "0DB93EAEBC6581DFAE4742DC222BAE33697F4027F9ECDE45D2050C123876EC19",
  1589: "A5C07CCFCF108C26277E0989AAD03D6DBF8461D81F8ABF299045B5D14FA9DB0C",
  1590: "DB7922A47FDD81C6945FD89FD5E8C77878A684E803CB01CDB700E5E7DFFCECF3",
  1591: "CA3F38DF2CF5E517D5AD2EA36AFD16E198E54EE1C6B8A6568125D075FF50F1E1",
};

for (const scene of [1588, 1589, 1590, 1591]) {
  const eventId = `batch-392-scene-${scene}-successor-e-primary-surface-reference-dispatched`;
  if (checkpoint.events.some((event) => event.eventId === eventId)) continue;
  const promptPath = `tmp/world-195x4/batch-392/scene-${scene}-meta-successor-e-primary-surface.txt`;
  const prompt = fs.readFileSync(promptPath);
  const promptSha256 = sha256(prompt);
  if (promptSha256 !== expectedPromptShas[scene]) {
    throw new Error(`Unexpected prompt hash for scene ${scene}: ${promptSha256}`);
  }
  checkpoint.events.push({
    eventId,
    batch: 392,
    scene,
    provider: "Meta AI",
    phase: "successor-e-primary-surface",
    sentAtUtc,
    prompt: {
      path: promptPath,
      sha256: promptSha256,
      bytes: prompt.length,
      exactText: prompt.toString("utf8"),
    },
    blacklistSnapshotSha256,
    conversationUrlSha256: conversationUrlShas[scene],
    referenceProvenance: {
      requestedSourceImageShas: referenceShas,
      transferState: "transferred-and-visible-in-composer-before-send",
      dispatchMode: "reference-image-guided",
      uploadOrder: [938, 936, 937],
      uiVerification: "all three attachment chips visible and send control enabled before dispatch",
      scene1589AliasNote: scene === 1589
        ? "Upload alias filenames were used after a stale-composer attachment cache; their verified bytes match the three requested source hashes exactly."
        : null,
    },
    immediateResponseText: null,
    immediateResponseClassification: "no-new-provider-text-yet-loading-state",
    immediateBrowserState: "composer disabled with Loading status after accepted send",
    rawState: "no-bytes-in-progress",
    immutable: true,
  });
}

checkpoint.status = "active-continuous-meta-successor-e-surface-bank-in-flight";
checkpoint.activeMetaLanes = {
  tabCount: 4,
  unresolvedScenes: [1588, 1589, 1590, 1591],
  candidateUnderInspection: "none; successor-E primary candidates are in flight",
  candidateInFlight: "successor-E primary surface candidate in each of four lanes",
  candidateNPlus2Gate: "closed until each successor-E occurrence is downloaded or given explicit no-bytes provenance and classified",
  evidenceFirstRule: "download/preserve each completed candidate before dispatching its successor, then finish QA before any later N+2",
  settingLock: "all four Batch 392 scenes are protected exterior planet-surface settings",
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ status: checkpoint.status, addedEventIds: checkpoint.events.slice(-4).map((event) => event.eventId) }, null, 2));

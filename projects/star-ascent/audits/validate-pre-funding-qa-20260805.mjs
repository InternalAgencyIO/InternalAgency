import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const auditRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(auditRoot, "..", "..", "..");
const siteRoot = resolve(repositoryRoot, "projects", "star-ascent", "site");
const evidencePath = resolve(auditRoot, "pre-funding-qa-20260805-nightflight-hydration-ledger.json");
const scorecardPath = resolve(siteRoot, "public", "audits", "localization-qa-20260803", "language-qa-scorecard.json");
const catalogPath = resolve(siteRoot, "app", "i18n", "messages.json");
const gitNoLfsFilters = [
  "-c", "filter.lfs.clean=",
  "-c", "filter.lfs.smudge=",
  "-c", "filter.lfs.process=",
  "-c", "filter.lfs.required=false",
];

function fail(message) {
  throw new Error(`pre-funding QA evidence validation failed: ${message}`);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, keys) {
  return value && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function git(...args) {
  return execFileSync("git", [...gitNoLfsFilters, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

function isAncestor(ancestor, descendant) {
  return spawnSync("git", [...gitNoLfsFilters, "merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).status === 0;
}

const evidenceText = readFileSync(evidencePath, "utf8");
const evidence = JSON.parse(evidenceText);
check(!/(^|["'\s])[A-Za-z]:[\\/]/mu.test(evidenceText), "workstation paths are forbidden");
check(exactKeys(evidence, [
  "schema", "status", "recordedAtUtc", "timeBasis", "sourceBinding", "scope", "checks", "hydration",
  "supersededCurrentHydration", "priorSiteTreeHydration", "historicalHydration", "languageQa", "assurance",
  "mainnetStatus", "limitations",
]), "top-level contract drifted");
check(evidence.schema === "iat-pre-funding-current-source-qa/v1", "schema drifted");
check(evidence.status === "PARTIAL_PASS_NOT_LAUNCH_APPROVAL", "status must remain partial and non-authorizing");
check(evidence.timeBasis === "LATEST_RECORDED_CHECK_TIME", "timestamp basis drifted");
check(Number.isFinite(Date.parse(evidence.recordedAtUtc)), "recordedAtUtc is invalid");

const binding = evidence.sourceBinding;
check(/^[0-9a-f]{40}$/u.test(binding.commit), "source commit is invalid");
check(git("rev-parse", `${binding.commit}^{tree}`) === binding.tree, "source tree binding drifted");
check(git("rev-parse", `${binding.commit}:${binding.sitePath}`) === binding.siteTree, "site tree binding drifted");
check(isAncestor(binding.commit, git("rev-parse", "HEAD")), "evidence checkout does not descend from its source commit");
check(git("rev-parse", `HEAD:${binding.sitePath}`) === binding.siteTree, "current evidence commit changed the tested site tree");
for (const commit of evidence.scope.observedCommits) {
  check(/^[0-9a-f]{40}$/u.test(commit) && isAncestor(commit, binding.commit), `observed commit is not bound: ${commit}`);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const catalogSha256 = createHash("sha256").update(JSON.stringify(catalog.messages)).digest("hex");
check(catalogSha256 === binding.catalogSha256, "catalog digest drifted");
check(evidence.scope.pullRequest === 4 && evidence.scope.draftRequired === true, "Draft PR scope drifted");
check(evidence.scope.nightflightRooms === 10 && evidence.scope.nightflightAssets === 15, "Nightflight scope drifted");
check(evidence.scope.localeCount === 50 && evidence.scope.canonicalRoutes === 25, "locale/route scope drifted");

const expectedChecks = new Map([
  ["nightflight-future-teasers", { passed: 11, failed: 0 }],
  ["production-build", { passed: null, failed: 0 }],
  ["rendered-route-seo", { passed: 33, failed: 0 }],
  ["hosting-config", { passed: null, failed: 0 }],
  ["casino-playwright", { passed: 9, failed: 0, skipped: 12 }],
]);
check(evidence.checks.length === expectedChecks.size, "check inventory drifted");
for (const result of evidence.checks) {
  const expected = expectedChecks.get(result.id);
  check(expected && result.status === "PASS", `check is not PASS: ${result.id}`);
  check(result.passed === expected.passed && result.failed === expected.failed, `check totals drifted: ${result.id}`);
  if (expected.skipped !== undefined) check(result.skipped === expected.skipped, `check skip total drifted: ${result.id}`);
  check(typeof result.command === "string" && result.command.length > 5, `check command missing: ${result.id}`);
}

const currentHydration = evidence.hydration;
check(currentHydration.schema === "iat-v2-hydration-partial-evidence/v1", "current hydration schema drifted");
check(currentHydration.status === "PARTIAL_PASS_NOT_AGGREGATE", "current hydration status overclaims aggregate proof");
check(
  currentHydration.completedShards === 4 && currentHydration.requiredShards === 50
    && currentHydration.completedPages === 600 && currentHydration.fullProfilePages === 7500
    && currentHydration.failedPages === 0 && currentHydration.incompletePages === 0,
  "current hydration summary drifted",
);
check(currentHydration.batches.length === 2 && currentHydration.records.length === 4, "current hydration inventory drifted");
const expectedCurrentBatches = [
  {
    range: { shardStart: 49, shardEnd: 50 },
    evidenceSetSha256: "560779845efa2a7b24f8765f070a38129bedb3a80f16e2c0de0e03bff41f20e9",
    commit: "983c468c1d04688bdde580ef2164a4d060e83270",
    tree: "1cf84b95e4eb5c76f6d5a1632a1a834803ace418",
  },
  {
    range: { shardStart: 1, shardEnd: 2 },
    evidenceSetSha256: "96beeb04c4aecf23fb2ed5a028af49fcc9dfd728cacd8225352b1fc13eb4121b",
    commit: "80bc90bb1d477eff0a2bc5495ed75f2f2983ac8e",
    tree: "ffad4299027554d706d9cb33a707a1a3be51cb2e",
  },
];
for (const [index, batch] of currentHydration.batches.entries()) {
  const expected = expectedCurrentBatches[index];
  check(JSON.stringify(batch.range) === JSON.stringify(expected.range), `current hydration batch ${index + 1} range drifted`);
  check(batch.evidenceSetSha256 === expected.evidenceSetSha256, `current hydration batch ${index + 1} digest drifted`);
  check(batch.sourceBinding.commit === expected.commit && batch.sourceBinding.tree === expected.tree, `current hydration batch ${index + 1} source drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}^{tree}`) === batch.sourceBinding.tree, `current hydration batch ${index + 1} tree is not Git-bound`);
  check(isAncestor(batch.sourceBinding.commit, binding.commit), `current hydration batch ${index + 1} does not precede the evidence source`);
  check(batch.sourceBinding.scopePath === binding.sitePath && batch.sourceBinding.scopeTree === binding.siteTree, `current hydration batch ${index + 1} scope drifted`);
}
const currentShardIndices = [49, 50, 1, 2];
const currentLocales = ["ur", "zh", "ar", "az"];
const currentAssignments = [
  "0d9210a79f1a9fbec036d35b73dcf52397240269909e4d1e31329db8f04e84ec",
  "e5f5cb3be9728093305bed55a17af5c2d1578df25a10253eaf7735e7bbaa814a",
  "52ee9742123e36e8b089badd7ad4c9e436e085283dd4f3e84898c1baa9dd9b65",
  "fe6253897dd7ce61da6f741f20114dbee46ed3e1079ea6510c963eec3008fafb",
];
for (const [index, record] of currentHydration.records.entries()) {
  const shardIndex = currentShardIndices[index];
  check(record.schema === "iat-v2-hydration-shard-record/v2" && record.status === "SHARD_PASS_NOT_AGGREGATE", `current shard ${shardIndex} status drifted`);
  check(git("rev-parse", `${record.sourceBinding.commit}^{tree}`) === record.sourceBinding.tree, `current shard ${shardIndex} source tree is not Git-bound`);
  check(isAncestor(record.sourceBinding.commit, binding.commit), `current shard ${shardIndex} does not precede the evidence source`);
  check(record.sourceBinding.scopePath === binding.sitePath && record.sourceBinding.scopeTree === binding.siteTree, `current shard ${shardIndex} scope drifted`);
  check(record.catalogSha256 === binding.catalogSha256, `current shard ${shardIndex} catalog drifted`);
  check(record.profile.shardIndex === shardIndex && record.profile.shardCount === 50, `current shard ${shardIndex} index drifted`);
  check(record.profile.locale === currentLocales[index] && record.profile.assignedJobsSha256 === currentAssignments[index], `current shard ${shardIndex} assignment drifted`);
  check(JSON.stringify(record.profile.hosts) === JSON.stringify(["internalagency", "ileriakil"]), `current shard ${shardIndex} hosts drifted`);
  check(record.profile.canonicalRoutes === 25 && JSON.stringify(record.profile.engines) === JSON.stringify({ chromium: 50, firefox: 50, webkit: 50 }), `current shard ${shardIndex} coverage drifted`);
  check(record.profile.assignedPages === 150 && record.profile.fullProfilePages === 7500, `current shard ${shardIndex} page totals drifted`);
  check(record.profile.fullProfileJobsSha256 === "1f035cca45792e63056e961dc90b6783f1d210d62968b837e3dc8216746ccbd7", `current shard ${shardIndex} profile drifted`);
  check(JSON.stringify(record.result) === JSON.stringify({ completedPages: 150, failedPages: 0, incompletePages: 0 }), `current shard ${shardIndex} result drifted`);
  check(Object.values(record.assurance).every((value) => value === false) && record.mainnetStatus === "UNSCHEDULED_HOLD", `current shard ${shardIndex} assurance drifted`);
}

const supersededCurrent = evidence.supersededCurrentHydration;
check(supersededCurrent.schema === "iat-v2-hydration-historical-summary/v1", "superseded-current hydration schema drifted");
check(supersededCurrent.status === "HISTORICAL_PARTIAL_NOT_CURRENT_SOURCE_PROOF", "superseded-current hydration status overclaims current proof");
check(supersededCurrent.sourceBinding.siteTree === "3d6ea7807ed8eb80a1f4fef79e584651532f984a", "superseded-current site tree drifted");
check(supersededCurrent.supersededBySiteTree === binding.siteTree, "superseded-current hydration successor drifted");
check(git("rev-parse", `${supersededCurrent.sourceBinding.commit}^{tree}`) === supersededCurrent.sourceBinding.tree, "superseded-current source tree is not Git-bound");
check(git("rev-parse", `${supersededCurrent.sourceBinding.commit}:${supersededCurrent.sourceBinding.sitePath}`) === supersededCurrent.sourceBinding.siteTree, "superseded-current site tree is not Git-bound");
check(isAncestor(supersededCurrent.sourceBinding.commit, binding.commit), "superseded-current source does not precede current source");
check(supersededCurrent.sourceBinding.catalogSha256 === binding.catalogSha256, "superseded-current catalog drifted");
check(
  supersededCurrent.completedShards === 6 && supersededCurrent.requiredShards === 50
    && supersededCurrent.completedPages === 900 && supersededCurrent.fullProfilePages === 7500
    && supersededCurrent.failedPages === 0 && supersededCurrent.incompletePages === 0,
  "superseded-current hydration summary drifted",
);
const expectedSupersededBatches = [
  {
    range: { shardStart: 43, shardEnd: 44 },
    evidenceSetSha256: "c2e352d1b008dd5400f95ced4a139f9689ac11cdaba41e814bbc2b14d955fab4",
    commit: "d4b855cee78844af35eef6226e113abafd9c64f0",
    tree: "97fd45482a9444fa3aa943379bccec047c2678b7",
  },
  {
    range: { shardStart: 45, shardEnd: 46 },
    evidenceSetSha256: "36241a635f423bb963b446c098fd59af59e02eb7f3770076dad3eeea5acd5c03",
    commit: "0c7d310da4f34cf41ba9116a0f641f8e843ba623",
    tree: "ef4d7528bc023f7f916a107a27361fbd9c8ca159",
  },
  {
    range: { shardStart: 47, shardEnd: 48 },
    evidenceSetSha256: "fbc5a122de4e881f15a4e799a412006e9bd973b76a301170729e6e4f161b45d9",
    commit: "2363ad783202825f60f33e89082b65679d71fd8e",
    tree: "9fa07b45767b52fe9530785cc6daa902f4068c34",
  },
];
check(supersededCurrent.batches.length === expectedSupersededBatches.length, "superseded-current batch count drifted");
for (const [index, batch] of supersededCurrent.batches.entries()) {
  const expected = expectedSupersededBatches[index];
  check(JSON.stringify(batch.range) === JSON.stringify(expected.range), `superseded-current batch ${index + 1} range drifted`);
  check(batch.evidenceSetSha256 === expected.evidenceSetSha256, `superseded-current batch ${index + 1} digest drifted`);
  check(batch.sourceBinding.commit === expected.commit && batch.sourceBinding.tree === expected.tree, `superseded-current batch ${index + 1} source drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}^{tree}`) === batch.sourceBinding.tree, `superseded-current batch ${index + 1} source tree is not Git-bound`);
  check(isAncestor(batch.sourceBinding.commit, binding.commit), `superseded-current batch ${index + 1} does not precede current source`);
  check(batch.sourceBinding.scopePath === supersededCurrent.sourceBinding.sitePath && batch.sourceBinding.scopeTree === supersededCurrent.sourceBinding.siteTree, `superseded-current batch ${index + 1} scope drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}:${batch.sourceBinding.scopePath}`) === supersededCurrent.sourceBinding.siteTree, `superseded-current batch ${index + 1} site tree is not Git-bound`);
}
const supersededLocales = ["sl", "sq", "sr", "sv", "tr", "uk"];
const supersededAssignments = [
  "870ec3358883b5ae111f92bced35002678eb6b18a533aa7e1427e00c15f9bc20",
  "52d462a5b2df1495faf12921f32af0fb59608e8d6c9aac29e06aa8c97a7d2a28",
  "abf3dfd0f128fccbdb9ab89d002b3a5caf0153245dabc24b274c9dc1ab8e6fdc",
  "e4712926ca49d617557c175befc88f1097729a7a7932b6645d0e021aa613f3d8",
  "ffd4e63c255944816f4937857b50b98b333ef6dcabe16b57870a95700ab24231",
  "7bafcd9deca978d19786139d452ce1a21b5269a7398c8a6220709d793c13783d",
];
check(supersededCurrent.recordSummaries.length === supersededLocales.length, "superseded-current record summary count drifted");
for (const [index, record] of supersededCurrent.recordSummaries.entries()) {
  const shardIndex = index + 43;
  check(record.shardIndex === shardIndex && record.locale === supersededLocales[index], `superseded-current shard ${shardIndex} identity drifted`);
  check(record.assignedJobsSha256 === supersededAssignments[index], `superseded-current shard ${shardIndex} assignment drifted`);
  check(Number.isFinite(Date.parse(record.recordedAtUtc)) && record.completedPages === 150, `superseded-current shard ${shardIndex} result drifted`);
}
check(Object.values(supersededCurrent.assurance).every((value) => value === false), "superseded-current assurance overclaims proof");
check(supersededCurrent.mainnetStatus === "UNSCHEDULED_HOLD", "superseded-current hydration changed Mainnet status");

const hydration = evidence.priorSiteTreeHydration;
check(hydration.schema === "iat-v2-hydration-historical-evidence/v1", "prior-site hydration schema drifted");
check(hydration.status === "HISTORICAL_PARTIAL_NOT_CURRENT_SOURCE_PROOF", "prior-site hydration status overclaims current proof");
check(hydration.sourceBinding.siteTree === "f3b27795466d982f0bdd92ba66559987e77d95da", "prior-site hydration tree drifted");
check(hydration.supersededBySiteTree === supersededCurrent.sourceBinding.siteTree, "prior-site hydration supersession drifted");
check(git("rev-parse", `${hydration.sourceBinding.commit}^{tree}`) === hydration.sourceBinding.tree, "prior-site source tree is not Git-bound");
check(git("rev-parse", `${hydration.sourceBinding.commit}:${hydration.sourceBinding.sitePath}`) === hydration.sourceBinding.siteTree, "prior-site site tree is not Git-bound");
check(isAncestor(hydration.sourceBinding.commit, binding.commit), "prior-site source does not precede current source");
const expectedPriorBatches = [
  {
    range: { shardStart: 1, shardEnd: 2 },
    evidenceSetSha256: "6ba1ed0069ba9b9b51694c7aa80aefb0dff4f0f19e3447c5d85a5d1fa2b23086",
    commit: "11f69960c67091f811cea87fbb41db30eadba430",
    tree: "0a1b81e5ce312876a93a1f3dca0b11745382c58f",
  },
  {
    range: { shardStart: 3, shardEnd: 4 },
    evidenceSetSha256: "8267cd68feedf538d27c2a1001b4acf8ec2bc0cddbb0f5d5880617ad1920b22a",
    commit: "ef11246c31a52753fda30d7e3393023ec244ad67",
    tree: "32ef49396ea26e201b5e20eaf95ffae84e47f883",
  },
  {
    range: { shardStart: 5, shardEnd: 6 },
    evidenceSetSha256: "5cb29619b673fa8a5906d621505c17318963504a7d795aff9ead7506ed6b5887",
    commit: "a7394178b2993f6e622ccf8bb3428f266570ff1a",
    tree: "71e79967df2870b25eaa9cc50019f21b5244d348",
  },
  {
    range: { shardStart: 7, shardEnd: 8 },
    evidenceSetSha256: "23b48b53616dffb6e8a3f39d1c9a295fd786ff73a52470b5f01f4be1d03ee115",
    commit: "58a7239d7d69a744d8ec46173c6205aea4e5f624",
    tree: "ccb2e4dad9ff44564f8a2dc32c171c8c8c1313c2",
  },
  {
    range: { shardStart: 9, shardEnd: 10 },
    evidenceSetSha256: "0ad7c1e52a6fb70e6ed68547d4ea6120ca8f03056dfd19db6ab2e4c482154ad8",
    commit: "03ad10b9fd90d0e0c16ccb0bf598e61aa5b9b216",
    tree: "e5ef77447378eab9b7e2e29a9ccb8faca50a91dd",
  },
  {
    range: { shardStart: 11, shardEnd: 12 },
    evidenceSetSha256: "36bc06bf0401a267956767a5cefbf2fff0eccd680d8e777e21a840b1acc665a8",
    commit: "36eb7832be47c453e321d2b848788854cf9f3017",
    tree: "fe506ff41167d40d025daa871649f7980fa30aad",
  },
  {
    range: { shardStart: 13, shardEnd: 14 },
    evidenceSetSha256: "e6f27e41ece7d1d8d6c18b8a71fca5ea275c239e5917394e63f63e0e06ea846f",
    commit: "1c150b5b2c8334276f41d106ca95c5331c3ae485",
    tree: "2067ad5e12c6b05f952a7ec61b14c89328ce6e6c",
  },
  {
    range: { shardStart: 15, shardEnd: 16 },
    evidenceSetSha256: "97b7deaf64681933b5042f63a2f3dbc85d78eb41bea40be5f280e78afb10bca6",
    commit: "4c1a2e47af696715d9158bf0a43677a93ccb27d7",
    tree: "68d3733cff75705fb8a798631653cc4f54353fd8",
  },
  {
    range: { shardStart: 17, shardEnd: 18 },
    evidenceSetSha256: "267ace155c0dd0c00d9e0e6095b889de521a17893bdc64a5ef14bb9628dcd17f",
    commit: "4312ffd85d30fe6a001edd38f62d3545b1051353",
    tree: "581d202465487016dd640b4d7fa22a88bbda2617",
  },
  {
    range: { shardStart: 19, shardEnd: 20 },
    evidenceSetSha256: "41c4c6ebf38ed405b7321d77f56ce144227ae670dd6ac6bb3c6f298460408893",
    commit: "090c4ab69d268b32b7998ebc2e111d2144b18816",
    tree: "9f480d2e47505f534cd712e470f225e2f342ca72",
  },
  {
    range: { shardStart: 21, shardEnd: 22 },
    evidenceSetSha256: "4791ed695c6ea4a54faf5cbd2aa031d5c48467b98af4dd4b11193cbcda880919",
    commit: "70e3b14135599dd20ad95092225081e758d5513d",
    tree: "f68640c2bdfe8b34e65e755023c285191f22bcb2",
  },
  {
    range: { shardStart: 23, shardEnd: 24 },
    evidenceSetSha256: "bc7d81220a4a86ccaa4e9f80c9d1c9efc2e6de741e9b364a3c603a425e7f4279",
    commit: "d9a41d5a97dc553eefd047beadd4636ecf79a668",
    tree: "f9744e8ffc76a0517f0fd68f8206f9e2eccb1cd8",
  },
  {
    range: { shardStart: 25, shardEnd: 26 },
    evidenceSetSha256: "8114913fb58b89a7d5cc9b0fc402c70811382ad6479b09b1adb62ce0db8f3e25",
    commit: "7ee1ee5d607b335c0a09ed739bdd9f2d0cbf0136",
    tree: "2e512e397c7706c213e4a8de928a5acef1a5a9c4",
  },
  {
    range: { shardStart: 27, shardEnd: 28 },
    evidenceSetSha256: "cea91988e7cdfda2125d8bf9171c0f6bd26b8b3326df68202efcf5aace2b69eb",
    commit: "f983a308a5b99e1d8981b6c133a965ff2a0453c3",
    tree: "31fea44f47d25c6b0a17956fcffeb7eba328f424",
  },
  {
    range: { shardStart: 29, shardEnd: 30 },
    evidenceSetSha256: "b7bbc99bf9f95a6c797bba742df1c1270700332db05b725a7f833eacc8d47ea1",
    commit: "444a00c32c41757df84f7970c920e4a224dbf615",
    tree: "720844c1a0a3bd6d39573698e2d58f65249be614",
  },
  {
    range: { shardStart: 31, shardEnd: 32 },
    evidenceSetSha256: "4f3ccafa48d0377bdc59766ac6b573fc44b51ea3411757deec276f1e161ce44c",
    commit: "b48654f3e1e199372f615e1c5fe3effeaf383cfd",
    tree: "bf9aba655e7a717f5841e678494de2450ce2d67e",
  },
  {
    range: { shardStart: 33, shardEnd: 34 },
    evidenceSetSha256: "4b103cc3de8c0f01c4022b13a7d85a04e5e667451444ba6efa26356420093cec",
    commit: "0aa73849ed0090499d1763e52986543c0fb954d5",
    tree: "64dfea223d13c182c4a29772ca0dbed2efe789ce",
  },
  {
    range: { shardStart: 35, shardEnd: 36 },
    evidenceSetSha256: "f1e52beaf8d372e37c87e6325bacbcc2800e4abbd20c52c005941feb202c493c",
    commit: "ed5ec96ae346812ce8b5a5ad90dc03922f6c7aac",
    tree: "d182edb7a7f5bed1b1872ec2d73eb4db5f316406",
  },
  {
    range: { shardStart: 37, shardEnd: 38 },
    evidenceSetSha256: "9d28937610a49919ec04abf9a1300f54e6f528b4d20798bf8c5a85bcb383ed21",
    commit: "07cf294b6d9a15229bc813163df2cb9ab4ea151d",
    tree: "88914be568dc3608c438440b1679f734d44cc8d9",
  },
  {
    range: { shardStart: 39, shardEnd: 40 },
    evidenceSetSha256: "d98c159284a1d212baf8f0353224971e67d74d3ce467cebd83121e667fd21281",
    commit: "9da3058ce09c3e8b6e3a01ae24352f3ad024a25a",
    tree: "30a67da5c406612af4cfcc0496726883809be705",
  },
  {
    range: { shardStart: 41, shardEnd: 42 },
    evidenceSetSha256: "d01c3cfb8b94836904551bdeab7dcbaaa8b65b41a2bd82d464d0697778573dbd",
    commit: "7faee2f27956e81c6a98c1594e63647cc497e6fe",
    tree: "4e86e3474aead821aed2fe86e0e3d4c95bf20bd0",
  },
];
check(hydration.batches.length === expectedPriorBatches.length, "prior-site hydration batch count drifted");
for (const [index, batch] of hydration.batches.entries()) {
  const expected = expectedPriorBatches[index];
  check(JSON.stringify(batch.range) === JSON.stringify(expected.range), `prior-site hydration batch ${index + 1} range drifted`);
  check(batch.evidenceSetSha256 === expected.evidenceSetSha256, `prior-site hydration batch ${index + 1} digest drifted`);
  check(batch.sourceBinding.commit === expected.commit && batch.sourceBinding.tree === expected.tree, `prior-site hydration batch ${index + 1} source drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}^{tree}`) === batch.sourceBinding.tree, `prior-site hydration batch ${index + 1} tree is not Git-bound`);
  check(isAncestor(batch.sourceBinding.commit, binding.commit), `prior-site hydration batch ${index + 1} does not precede the evidence source`);
  check(batch.sourceBinding.scopePath === hydration.sourceBinding.sitePath && batch.sourceBinding.scopeTree === hydration.sourceBinding.siteTree, `prior-site hydration batch ${index + 1} site scope drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}:${batch.sourceBinding.scopePath}`) === hydration.sourceBinding.siteTree, `prior-site hydration batch ${index + 1} site tree is not Git-bound`);
}
check(
  hydration.completedShards === 42 && hydration.requiredShards === 50
    && hydration.completedPages === 6300 && hydration.fullProfilePages === 7500
    && hydration.failedPages === 0 && hydration.incompletePages === 0,
  "prior-site hydration summary drifted",
);
check(hydration.records.length === 42, "prior-site hydration record count drifted");
const expectedLocales = ["ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "gn", "hi", "hr", "ht", "hu", "hy", "id", "is", "it", "ja", "ka", "lb", "lt", "lv", "mk", "mt", "nl", "no", "pcm", "pl", "pt", "qu", "ro", "ru", "sk"];
const expectedAssignments = [
  "52ee9742123e36e8b089badd7ad4c9e436e085283dd4f3e84898c1baa9dd9b65",
  "fe6253897dd7ce61da6f741f20114dbee46ed3e1079ea6510c963eec3008fafb",
  "862666f4d4df79e068a7fee240095929a75798a6360f6691efc6a1cb994dcba8",
  "c8652e2883bcdb6b6cee7967bc92d03ebf4887a379197113b5d3d6a84ee9b501",
  "5c5a95018a9d4dc86b956c7b8e850f7a26d7e7c24499846719b139722960e6e2",
  "cf71e3ba150185c02042aa50012b15ec014bd2da53f0d4c449d55c250c96ef9e",
  "7f19d6405387992e9d904ed417479b6512ec5d59f1a6626df454c8510b4e5ab4",
  "37bb85fbaff335cdc174c0a934602eaa53059e785f0f43dd6bbb507ccde8b106",
  "f499a4fce88785ab31b9aa263aea6628ff8d019ec2bdcb07f105b6a7864d8358",
  "5fe4cf057d7ecd14c7278ade212d641082e4bfed849feccaa50841912ec68a52",
  "9d781e214724e14047cb59330d1ebee3cce3d6a3466238bebc2deae20aa99aac",
  "a1f3941e1fd30cbb8c7a4930a774d4812cf0e5b6ddf10fcfde33891bffc8ae8f",
  "bca04d1756da373d1071825145df4820b9de55a610627b4864653d9acaa48879",
  "948285e0fccb395462cc149e5cfb1b231b07612916f481f909a6da170b494caa",
  "3ddb66af2edd08667a1874d0c0c0f6d408bea3aa9f5056f7bf5f499b6e6de12c",
  "8f2278de4058842d7f5b58b67c33904a22334ced603c3e3040e54f8be3b9891c",
  "c4c8e5dc49a48a05cc1b156cd61e5d4ef60756d4b10aece05bf7363b092e81be",
  "1fd452555ddfac528fb53d5276d267897f398d6474c8ef8e640f9d3a8175ab6d",
  "858422650691eb1ce97520067899c073c15e297f2a022dda2c2928c86a97526e",
  "77bdf305084bf3c88d14a656b5cf5bd5a4d4fa10d31c825c5719306c1b596d70",
  "33a321c5e1daa7528beadf9c6dfc3f49a911be8b53604f6b92b9be46a14d4de2",
  "40ad87a17ffc1fe47167217a40236a7397f5b852555d9c507efb7fd654912330",
  "c75a2746a79bb3c037065b3062acb7671bed9cef7bf42acdda32bdcb896c0533",
  "a0d370c9d5f7c1cc897f1505adeb429216da8211fc53c0eb94d41d2f9602ab71",
  "6dc5757be79696f49c6cd69ffa76219ecc0ea0c0f77b41c21773f63482af7beb",
  "6066ab0e704720e2353da683c3662e1831fed9b49bd1f5c6e71c262ba8662b72",
  "462774f10e8488fafc9c946ed9d9ce2704970e661123ea07c949903443ef40de",
  "a00753dd5965d8fb25eb99482161edc86f595eeb2b16b20863e288eed4411524",
  "133e55d69bc26b9785a5116afdc69822376478c3aade5b1753bc5cb43b1dcb5d",
  "1cc25426c6a3506d9f5290bf732fa95f2940867e56621f34e655f50c9e372749",
  "04643f2e0ff4f656c8c37ca40951a2c7728241643ef46bbba6fb2e438b86577a",
  "397bc9d3ee8ac0fe5732aecb0df93fd3787a90c7c6f28f22a1d214eeb2e01d6e",
  "994c17c3cd9e9d7b9beec0b03472395bbdfc3c4ecc30e09862fc223f3cdff0cd",
  "7d65341aa0d74993ae727dc2a34e46a6fc716932b259594217d882df0f1cb61a",
  "30d9c4f811a7076654b891cf3c80ebf9d6f58cb550485a992ce1681b47c9057c",
  "ae93457f0ce1ee31135b2aa0d0744283b2593e81c54316c6f444b295787ea438",
  "853d787d05858c65d8fe6be4f08be35f9ecda410bb69fa8001e9774c139ff9d5",
  "e8cf962a733b4ab83646d105bb252159f38c8f7aa9850f8596ba1113b6fb26a3",
  "c987812b0a40d33029b4b06b6cb8b86700c207921ab49d4957ea5adff3230131",
  "10428e92885ebc0aa23a44f02f8ea2946bb7c91128b1e29a4ea2e4ebcfdf9c84",
  "ebde85808d971ca30ce9f68f5b0496c1ebe21e30d04005500924e1ca94b7fc83",
  "6627ade4c24e7467366056a9245827ec1788cae0e749dd5df8254c5a7bd76214",
];
for (const [index, record] of hydration.records.entries()) {
  check(record.schema === "iat-v2-hydration-shard-record/v2", `shard ${index + 1} schema drifted`);
  check(record.status === "SHARD_PASS_NOT_AGGREGATE", `shard ${index + 1} overclaims aggregate proof`);
  check(Number.isFinite(Date.parse(record.recordedAtUtc)), `shard ${index + 1} timestamp drifted`);
  check(/^[0-9a-f]{40}$/u.test(record.sourceBinding.commit), `shard ${index + 1} source commit is invalid`);
  check(git("rev-parse", `${record.sourceBinding.commit}^{tree}`) === record.sourceBinding.tree, `shard ${index + 1} source tree is not Git-bound`);
  check(isAncestor(record.sourceBinding.commit, binding.commit), `shard ${index + 1} does not precede the evidence source`);
  check(record.sourceBinding.scopePath === hydration.sourceBinding.sitePath && record.sourceBinding.scopeTree === hydration.sourceBinding.siteTree, `prior shard ${index + 1} site scope drifted`);
  check(git("rev-parse", `${record.sourceBinding.commit}:${record.sourceBinding.scopePath}`) === hydration.sourceBinding.siteTree, `prior shard ${index + 1} site tree is not Git-bound`);
  check(record.catalogSha256 === binding.catalogSha256, `shard ${index + 1} catalog binding drifted`);
  check(record.profile.shardIndex === index + 1 && record.profile.shardCount === 50, `shard ${index + 1} assignment index drifted`);
  check(record.profile.locale === expectedLocales[index], `shard ${index + 1} locale drifted`);
  check(JSON.stringify(record.profile.hosts) === JSON.stringify(["internalagency", "ileriakil"]), `shard ${index + 1} hosts drifted`);
  check(record.profile.canonicalRoutes === 25, `shard ${index + 1} route count drifted`);
  check(JSON.stringify(record.profile.engines) === JSON.stringify({ chromium: 50, firefox: 50, webkit: 50 }), `shard ${index + 1} engine totals drifted`);
  check(record.profile.assignedPages === 150 && record.profile.fullProfilePages === 7500, `shard ${index + 1} page totals drifted`);
  check(record.profile.assignedJobsSha256 === expectedAssignments[index], `shard ${index + 1} assignment digest drifted`);
  check(record.profile.fullProfileJobsSha256 === "1f035cca45792e63056e961dc90b6783f1d210d62968b837e3dc8216746ccbd7", `shard ${index + 1} profile digest drifted`);
  check(JSON.stringify(record.result) === JSON.stringify({ completedPages: 150, failedPages: 0, incompletePages: 0 }), `shard ${index + 1} result drifted`);
  check(Object.values(record.assurance).every((value) => value === false), `shard ${index + 1} assurance overclaims proof`);
  check(record.mainnetStatus === "UNSCHEDULED_HOLD", `shard ${index + 1} changed Mainnet status`);
}

const historical = evidence.historicalHydration;
check(historical.schema === "iat-v2-hydration-historical-evidence/v1", "historical hydration schema drifted");
check(historical.status === "HISTORICAL_PARTIAL_NOT_CURRENT_SOURCE_PROOF", "historical hydration status overclaims current proof");
check(historical.sourceBinding.siteTree === "955e1c94b81f614beddaa629d1245a055c985cb5", "historical site tree drifted");
check(
  historical.sourceBinding.siteTree !== hydration.sourceBinding.siteTree
    && historical.supersededBySiteTree === hydration.sourceBinding.siteTree,
  "historical generation chain drifted",
);
check(git("rev-parse", `${historical.sourceBinding.commit}^{tree}`) === historical.sourceBinding.tree, "historical source tree is not Git-bound");
check(git("rev-parse", `${historical.sourceBinding.commit}:${historical.sourceBinding.sitePath}`) === historical.sourceBinding.siteTree, "historical site tree is not Git-bound");
check(isAncestor(historical.sourceBinding.commit, binding.commit), "historical source does not precede the current source");
check(
  historical.completedShards === 4 && historical.requiredShards === 50
    && historical.completedPages === 600 && historical.fullProfilePages === 7500
    && historical.failedPages === 0 && historical.incompletePages === 0,
  "historical hydration summary drifted",
);
check(historical.batches.length === 2 && historical.records.length === 4, "historical hydration inventory drifted");
const historicalBatchDigests = [
  "0ea1247f7de93eaed39e25181aac40fb709b0b5c240b23858acf537ced6e006f",
  "7e12db50a0cf135611bbfc3fc229a7a2811c1af6f5c03667e6139b671f01f20a",
];
for (const [index, batch] of historical.batches.entries()) {
  check(batch.evidenceSetSha256 === historicalBatchDigests[index], `historical batch ${index + 1} digest drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}^{tree}`) === batch.sourceBinding.tree, `historical batch ${index + 1} source tree is not Git-bound`);
  check(batch.sourceBinding.scopeTree === historical.sourceBinding.siteTree, `historical batch ${index + 1} escaped its site tree`);
  check(git("rev-parse", `${batch.sourceBinding.commit}:${batch.sourceBinding.scopePath}`) === historical.sourceBinding.siteTree, `historical batch ${index + 1} site tree is not Git-bound`);
}
const historicalAssignments = [
  "52ee9742123e36e8b089badd7ad4c9e436e085283dd4f3e84898c1baa9dd9b65",
  "fe6253897dd7ce61da6f741f20114dbee46ed3e1079ea6510c963eec3008fafb",
  "862666f4d4df79e068a7fee240095929a75798a6360f6691efc6a1cb994dcba8",
  "c8652e2883bcdb6b6cee7967bc92d03ebf4887a379197113b5d3d6a84ee9b501",
];
for (const [index, record] of historical.records.entries()) {
  check(record.status === "SHARD_PASS_NOT_AGGREGATE", `historical shard ${index + 1} status drifted`);
  check(record.sourceBinding.scopeTree === historical.sourceBinding.siteTree, `historical shard ${index + 1} escaped its site tree`);
  check(git("rev-parse", `${record.sourceBinding.commit}:${record.sourceBinding.scopePath}`) === historical.sourceBinding.siteTree, `historical shard ${index + 1} site tree is not Git-bound`);
  check(record.profile.shardIndex === index + 1 && record.profile.assignedJobsSha256 === historicalAssignments[index], `historical shard ${index + 1} assignment drifted`);
  check(JSON.stringify(record.result) === JSON.stringify({ completedPages: 150, failedPages: 0, incompletePages: 0 }), `historical shard ${index + 1} result drifted`);
  check(Object.values(record.assurance).every((value) => value === false), `historical shard ${index + 1} assurance overclaims proof`);
}

const scorecard = JSON.parse(readFileSync(scorecardPath, "utf8"));
check(scorecard.scope.locales === 50 && scorecard.scope.checksPerLocale === 100 && scorecard.scope.results === 5000, "scorecard topology drifted");
check(JSON.stringify(scorecard.summary) === JSON.stringify(evidence.languageQa.summary), "scorecard summary drifted");
check(evidence.languageQa.nativeMeaningCadenceSlang === "ACCOUNTABLE_NATIVE_REVIEW_HOLD", "native review escaped HOLD");
check(scorecard.assurance.nativeQualityClaimAllowed === false && scorecard.assurance.releaseApproved === false, "scorecard assurance overclaims approval");
check(Object.values(evidence.assurance).every((value) => value === false), "QA assurance overclaims completion or mutation");
check(evidence.mainnetStatus === "UNSCHEDULED_HOLD", "Mainnet status changed");
check(evidence.limitations.some((item) => /four of fifty/u.test(item)), "current partial hydration limitation missing");
check(evidence.limitations.some((item) => /Six shards and 900 pages/u.test(item)), "superseded-current hydration limitation missing");
check(evidence.limitations.some((item) => /Forty-two shards and 6,300 pages/u.test(item)), "prior-site hydration limitation missing");
check(evidence.limitations.some((item) => /historical partial evidence/u.test(item)), "historical hydration limitation missing");
check(evidence.limitations.some((item) => /12 explicit expected skips/u.test(item)), "browser UI limitation missing");
check(evidence.limitations.some((item) => /accountable native review/u.test(item)), "native review limitation missing");
check(evidence.limitations.some((item) => /No deployment, wallet access, signing, funding/u.test(item)), "mutation safety limitation missing");

console.log(
  `pre-funding QA evidence PASS: ${evidence.checks.length} affected gates, `
    + `${currentHydration.completedShards}/${currentHydration.requiredShards} current-tree hydration shards, `
    + `${currentHydration.completedPages}/${currentHydration.fullProfilePages} current-tree pages, Mainnet ${evidence.mainnetStatus}.`,
);

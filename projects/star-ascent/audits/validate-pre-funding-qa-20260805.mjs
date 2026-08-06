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
  "historicalHydration", "languageQa", "assurance", "mainnetStatus", "limitations",
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

const hydration = evidence.hydration;
check(hydration.schema === "iat-v2-hydration-partial-evidence/v1", "hydration schema drifted");
check(hydration.status === "PARTIAL_PASS_NOT_AGGREGATE", "hydration status overclaims aggregate proof");
const expectedCurrentBatches = [
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
];
check(hydration.batches.length === expectedCurrentBatches.length, "current hydration batch count drifted");
for (const [index, batch] of hydration.batches.entries()) {
  const expected = expectedCurrentBatches[index];
  check(JSON.stringify(batch.range) === JSON.stringify(expected.range), `current hydration batch ${index + 1} range drifted`);
  check(batch.evidenceSetSha256 === expected.evidenceSetSha256, `current hydration batch ${index + 1} digest drifted`);
  check(batch.sourceBinding.commit === expected.commit && batch.sourceBinding.tree === expected.tree, `current hydration batch ${index + 1} source drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}^{tree}`) === batch.sourceBinding.tree, `current hydration batch ${index + 1} tree is not Git-bound`);
  check(isAncestor(batch.sourceBinding.commit, binding.commit), `current hydration batch ${index + 1} does not precede the evidence source`);
  check(batch.sourceBinding.scopePath === binding.sitePath && batch.sourceBinding.scopeTree === binding.siteTree, `current hydration batch ${index + 1} site scope drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}:${batch.sourceBinding.scopePath}`) === binding.siteTree, `current hydration batch ${index + 1} site tree is not Git-bound`);
}
check(
  hydration.completedShards === 28 && hydration.requiredShards === 50
    && hydration.completedPages === 4200 && hydration.fullProfilePages === 7500
    && hydration.failedPages === 0 && hydration.incompletePages === 0,
  "hydration summary drifted",
);
check(hydration.records.length === 28, "current hydration record count drifted");
const expectedLocales = ["ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "gn", "hi", "hr", "ht", "hu", "hy", "id", "is", "it", "ja", "ka"];
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
];
for (const [index, record] of hydration.records.entries()) {
  check(record.schema === "iat-v2-hydration-shard-record/v2", `shard ${index + 1} schema drifted`);
  check(record.status === "SHARD_PASS_NOT_AGGREGATE", `shard ${index + 1} overclaims aggregate proof`);
  check(Number.isFinite(Date.parse(record.recordedAtUtc)), `shard ${index + 1} timestamp drifted`);
  check(/^[0-9a-f]{40}$/u.test(record.sourceBinding.commit), `shard ${index + 1} source commit is invalid`);
  check(git("rev-parse", `${record.sourceBinding.commit}^{tree}`) === record.sourceBinding.tree, `shard ${index + 1} source tree is not Git-bound`);
  check(isAncestor(record.sourceBinding.commit, binding.commit), `shard ${index + 1} does not precede the evidence source`);
  check(record.sourceBinding.scopePath === binding.sitePath && record.sourceBinding.scopeTree === binding.siteTree, `shard ${index + 1} site scope drifted`);
  check(git("rev-parse", `${record.sourceBinding.commit}:${record.sourceBinding.scopePath}`) === binding.siteTree, `shard ${index + 1} site tree is not Git-bound`);
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
check(historical.sourceBinding.siteTree !== binding.siteTree && historical.supersededBySiteTree === binding.siteTree, "historical/current site separation drifted");
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
check(evidence.limitations.some((item) => /twenty-eight of fifty/u.test(item)), "partial hydration limitation missing");
check(evidence.limitations.some((item) => /historical partial evidence/u.test(item)), "historical hydration limitation missing");
check(evidence.limitations.some((item) => /12 explicit expected skips/u.test(item)), "browser UI limitation missing");
check(evidence.limitations.some((item) => /accountable native review/u.test(item)), "native review limitation missing");
check(evidence.limitations.some((item) => /No deployment, wallet access, signing, funding/u.test(item)), "mutation safety limitation missing");

console.log(
  `pre-funding QA evidence PASS: ${evidence.checks.length} affected gates, `
    + `${hydration.completedShards}/${hydration.requiredShards} hydration shards, `
    + `${hydration.completedPages}/${hydration.fullProfilePages} pages, Mainnet ${evidence.mainnetStatus}.`,
);

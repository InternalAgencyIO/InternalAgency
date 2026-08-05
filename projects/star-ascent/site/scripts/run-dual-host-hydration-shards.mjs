import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  createHydrationPlans,
  exhaustiveLocaleShardCount,
} from "./dual-host-locale-hydration-plan.mjs";
import {
  createHydrationShardBatchSummary,
  hydrationBatchSummaryPrefix,
  hydrationShardBatchRangeFromEnvironment,
} from "./hydration-shard-batch.mjs";
import {
  assertStableHydrationSourceBinding,
  createGitSourceBindingResolver,
  parseHydrationShardRecordLog,
  readCleanGitSourceBinding,
  reconcileHydrationShardRecords,
} from "./hydration-shard-evidence.mjs";

const range = hydrationShardBatchRangeFromEnvironment(process.env);
const initialSourceBinding = readCleanGitSourceBinding();
const checkerPath = fileURLToPath(new URL("./check-dual-host-locale-hydration.mjs", import.meta.url));
const records = [];

for (const shardIndex of range.shardIndexes) {
  console.log(`Dual-host locale hydration batch: starting shard ${shardIndex}/${exhaustiveLocaleShardCount}.`);
  const child = spawnSync(process.execPath, [checkerPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      I18N_HYDRATION_FULL_CROSS_ENGINE: "1",
      I18N_HYDRATION_SHARD_INDEX: String(shardIndex),
      I18N_HYDRATION_EMIT_SHARD_RECORD: "1",
    },
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Hydration shard ${shardIndex} exited with status ${child.status ?? "unknown"}`);
  }
  const record = parseHydrationShardRecordLog(child.stdout, `shard ${shardIndex} output`);
  if (record.profile?.shardIndex !== shardIndex) {
    throw new Error(`Hydration shard ${shardIndex} emitted record ${record.profile?.shardIndex ?? "unknown"}`);
  }
  assertStableHydrationSourceBinding(initialSourceBinding, record.sourceBinding);
  records.push(record);
}

const completedSourceBinding = readCleanGitSourceBinding();
assertStableHydrationSourceBinding(initialSourceBinding, completedSourceBinding);

if (records.length === exhaustiveLocaleShardCount) {
  const [catalog, contract, sitemapSource] = await Promise.all([
    readFile(new URL("../app/i18n/messages.json", import.meta.url), "utf8").then((text) => JSON.parse(text)),
    readFile(new URL("../app/i18n/payload-contract.json", import.meta.url), "utf8").then((text) => JSON.parse(text)),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  ]);
  const locales = Object.keys(catalog.messages ?? {}).sort();
  const routes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/gu)].map((match) => match[1] || "/");
  const engineNames = ["chromium", "firefox", "webkit"];
  const fullProfilePlans = createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true });
  const expectedShardPlans = Array.from({ length: exhaustiveLocaleShardCount }, (_, offset) =>
    createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true, shardIndex: offset + 1 }));
  const aggregate = reconcileHydrationShardRecords({
    records,
    expectedShardPlans,
    fullProfilePlans,
    catalogSha256: contract.catalogSha256,
    currentSourceBinding: completedSourceBinding,
    sourceBindingResolver: createGitSourceBindingResolver(),
  });
  console.log(
    `Dual-host locale hydration AGGREGATE PASS: ${aggregate.result.completedPages}/${aggregate.result.plannedPages} ` +
      `pages from ${aggregate.result.shardRecords}/50 Git-verified records; catalog ${aggregate.catalogSha256}.`,
  );
  console.log(JSON.stringify(aggregate, null, 2));
} else {
  const summary = createHydrationShardBatchSummary({
    records,
    shardStart: range.shardStart,
    shardEnd: range.shardEnd,
    sourceBinding: completedSourceBinding,
  });
  console.log(
    `Dual-host locale hydration BATCH PARTIAL PASS: ${summary.result.completedPages}/7,500 pages from ` +
      `${summary.result.shardRecords} record(s); this is not aggregate proof.`,
  );
  console.log(`${hydrationBatchSummaryPrefix}${JSON.stringify(summary)}`);
}
console.log("Ephemeral loopback browser evidence only: no deployment, native approval, or Mainnet change is implied.");

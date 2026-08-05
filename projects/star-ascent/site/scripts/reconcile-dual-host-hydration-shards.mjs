import { readFile } from "node:fs/promises";

import {
  createHydrationPlans,
  exhaustiveLocaleShardCount,
} from "./dual-host-locale-hydration-plan.mjs";
import {
  createGitSourceBindingResolver,
  decodeHydrationShardLog,
  parseHydrationShardRecordsLog,
  readCleanGitSourceBinding,
  reconcileHydrationShardRecords,
} from "./hydration-shard-evidence.mjs";

const logPaths = process.argv.slice(2);
if (logPaths.length < 1 || logPaths.length > exhaustiveLocaleShardCount) {
  throw new Error(`Expected 1 through 50 shard or batch log paths; received ${logPaths.length}`);
}

const [catalog, contract, sitemapSource, logTexts] = await Promise.all([
  readFile(new URL("../app/i18n/messages.json", import.meta.url), "utf8").then((text) => JSON.parse(text)),
  readFile(new URL("../app/i18n/payload-contract.json", import.meta.url), "utf8").then((text) => JSON.parse(text)),
  readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  Promise.all(logPaths.map((path) => readFile(path))),
]);
const locales = Object.keys(catalog.messages ?? {}).sort();
const routes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/gu)].map((match) => match[1] || "/");
const engineNames = ["chromium", "firefox", "webkit"];
const fullProfilePlans = createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true });
const expectedShardPlans = Array.from({ length: exhaustiveLocaleShardCount }, (_, offset) =>
  createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true, shardIndex: offset + 1 }));
const records = logTexts.flatMap((bytes, index) => {
  const label = `shard log ${index + 1}`;
  return parseHydrationShardRecordsLog(decodeHydrationShardLog(bytes, label), label);
});
const currentSourceBinding = readCleanGitSourceBinding();
const aggregate = reconcileHydrationShardRecords({
  records,
  expectedShardPlans,
  fullProfilePlans,
  catalogSha256: contract.catalogSha256,
  currentSourceBinding,
  sourceBindingResolver: createGitSourceBindingResolver(),
});

console.log(
  `Dual-host locale hydration AGGREGATE PASS: ${aggregate.result.completedPages}/${aggregate.result.plannedPages} ` +
    `pages from ${aggregate.result.shardRecords}/50 Git-verified shard records bound to unchanged ` +
    `${aggregate.sourceEquivalence.scopePath}; catalog ${aggregate.catalogSha256}.`,
);
console.log(JSON.stringify(aggregate, null, 2));
console.log("Local headless aggregate only: no deployment, native-language approval, or Mainnet change is implied.");

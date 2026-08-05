import { readFile } from "node:fs/promises";

import {
  createHydrationPlans,
  exhaustiveLocaleShardCount,
} from "./dual-host-locale-hydration-plan.mjs";
import {
  parseHydrationShardRecordLog,
  readCleanGitSourceBinding,
  reconcileHydrationShardRecords,
} from "./hydration-shard-evidence.mjs";

const logPaths = process.argv.slice(2);
if (logPaths.length !== exhaustiveLocaleShardCount) {
  throw new Error(`Expected exactly 50 shard log paths; received ${logPaths.length}`);
}

const [catalog, contract, sitemapSource, logTexts] = await Promise.all([
  readFile(new URL("../app/i18n/messages.json", import.meta.url), "utf8").then((text) => JSON.parse(text)),
  readFile(new URL("../app/i18n/payload-contract.json", import.meta.url), "utf8").then((text) => JSON.parse(text)),
  readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  Promise.all(logPaths.map((path) => readFile(path, "utf8"))),
]);
const locales = Object.keys(catalog.messages ?? {}).sort();
const routes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/gu)].map((match) => match[1] || "/");
const engineNames = ["chromium", "firefox", "webkit"];
const fullProfilePlans = createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true });
const expectedShardPlans = Array.from({ length: exhaustiveLocaleShardCount }, (_, offset) =>
  createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true, shardIndex: offset + 1 }));
const records = logTexts.map((text, index) => parseHydrationShardRecordLog(text, `shard log ${index + 1}`));
const aggregate = reconcileHydrationShardRecords({
  records,
  expectedShardPlans,
  fullProfilePlans,
  catalogSha256: contract.catalogSha256,
  sourceBinding: readCleanGitSourceBinding(),
});

console.log(
  `Dual-host locale hydration AGGREGATE PASS: ${aggregate.result.completedPages}/${aggregate.result.plannedPages} ` +
    `pages from ${aggregate.result.shardRecords}/50 source-bound shard records; catalog ${aggregate.catalogSha256}.`,
);
console.log(JSON.stringify(aggregate, null, 2));
console.log("Local headless aggregate only: no deployment, native-language approval, or Mainnet change is implied.");

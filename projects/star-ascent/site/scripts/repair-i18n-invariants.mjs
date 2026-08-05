import { readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const policyUrl = new URL("../app/i18n/reviewed-localization-policy.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const policy = JSON.parse(await readFile(policyUrl, "utf8"));

if (
  policy.schema !== "iat-reviewed-localization-policy/v1"
  || policy.mode !== "GLOBAL_FAIL_CLOSED"
  || policy.fallback !== "canonical-english"
  || policy.machineDraftRuntimeAllowed !== false
  || policy.unreviewedTargetLanguageBundleAllowed !== false
  || policy.unreviewedLocaleAutonymsAllowed !== false
  || policy.directComponentReviewBundleComplete !== false
) {
  throw new Error("Invariant repair requires the complete GLOBAL_FAIL_CLOSED policy");
}

const locales = Object.keys(catalog.messages ?? {});
const sources = Object.keys(catalog.messages?.en ?? {});
if (locales.length !== 50 || sources.length === 0 || policy.localeStatus?.en !== "SOURCE") {
  throw new Error("Invariant repair requires the canonical 50-locale catalog and English source");
}

let restoredFailClosedCells = 0;
for (const locale of locales) {
  const messages = catalog.messages[locale];
  if (!messages || Object.keys(messages).length !== sources.length) {
    throw new Error(`Catalog shape differs for ${locale}`);
  }
  if (locale === "en") continue;
  if (!Object.hasOwn(policy.localeStatus ?? {}, locale)) {
    throw new Error(`Reviewed-localization policy omits ${locale}`);
  }
  const reviewed = policy.translations?.[locale] ?? {};
  for (const source of sources) {
    const expected = Object.hasOwn(reviewed, source) ? reviewed[source] : source;
    if (typeof expected !== "string") throw new Error(`Invalid policy cell for ${locale}: ${source}`);
    if (messages[source] !== expected) {
      messages[source] = expected;
      restoredFailClosedCells += 1;
    }
  }
}

catalog.meta.invariantRepair = {
  mode: "GLOBAL_FAIL_CLOSED_REVIEWED_OVERRIDE_OR_CANONICAL_ENGLISH",
  restoredFailClosedCells,
};
await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Reasserted GLOBAL_FAIL_CLOSED invariants; restored ${restoredFailClosedCells} noncompliant runtime cell(s).`);

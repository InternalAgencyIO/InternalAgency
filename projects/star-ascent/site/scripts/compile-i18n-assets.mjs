import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const futureCopyUrl = new URL("../app/future/future-copy.json", import.meta.url);
const routeSeoUrl = new URL("../app/i18n/route-seo.json", import.meta.url);
const metadataUrl = new URL("../app/i18n/metadata.generated.json", import.meta.url);
const assetRoot = new URL("../public/i18n/", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const futureCopy = JSON.parse(await readFile(futureCopyUrl, "utf8"));
const routeSeo = JSON.parse(await readFile(routeSeoUrl, "utf8"));
const englishPrompt = catalog.prompts.en;
const metadata = {};
const seoSources = new Set();

function collectSeoSources(value, key = "") {
  if (typeof value === "string" && (/metadata/i.test(key) || /Alt$/.test(key))) seoSources.add(value);
  else if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) collectSeoSources(childValue, childKey);
  }
}

collectSeoSources(futureCopy.en);
for (const entry of Object.values(routeSeo)) {
  seoSources.add(entry.title);
  seoSources.add(entry.description);
}

await mkdir(assetRoot, { recursive: true });
for (const [locale, messages] of Object.entries(catalog.messages)) {
  assert.equal(Object.keys(messages).length, catalog.meta.sourceCount, `${locale} catalog is incomplete`);
  const prompt = Object.fromEntries(
    Object.entries(englishPrompt).map(([key, source]) => [key, messages[source] ?? source]),
  );
  metadata[locale] = {
    title: messages["Internal Agency — STAR ASCENT"] ?? "Internal Agency — STAR ASCENT",
    description: messages["The first public chapter of Internal Agency: transparent launch information, token disclosure, and operator safety guidance."] ?? "The first public chapter of Internal Agency: transparent launch information, token disclosure, and operator safety guidance.",
    imageAlt: messages["STAR ASCENT launch control"] ?? "STAR ASCENT launch control",
    prompt,
    seo: Object.fromEntries([...seoSources].map((source) => [source, messages[source] ?? source])),
  };
  await writeFile(
    new URL(`${locale}.json`, assetRoot),
    JSON.stringify({ locale, messages }),
    "utf8",
  );
}

await writeFile(metadataUrl, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Compiled ${Object.keys(metadata).length} static locale payloads.`);

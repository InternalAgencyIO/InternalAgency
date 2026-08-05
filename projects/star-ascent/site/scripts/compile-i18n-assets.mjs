import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const futureCopyUrl = new URL("../app/future/future-copy.json", import.meta.url);
const routeSeoUrl = new URL("../app/i18n/route-seo.json", import.meta.url);
const metadataUrl = new URL("../app/i18n/metadata.generated.json", import.meta.url);
const payloadContractUrl = new URL("../app/i18n/payload-contract.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const payloadContract = JSON.parse(await readFile(payloadContractUrl, "utf8"));
const catalogSha256 = createHash("sha256").update(JSON.stringify(catalog.messages)).digest("hex");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const knownContaminatedNamespaces = ["i18n-v2/4c1f960016ec313e"];
assert.equal(payloadContract.schema, "iat-locale-payload/v2", "Locale payload schema must be v2");
assert.match(payloadContract.assetNamespace, /^i18n-v[0-9]+$/u, "Locale payload namespace is invalid");
assert.ok(Array.isArray(payloadContract.retiredCatalogNamespaces), "Retired locale payload namespaces must be explicit");
for (const retired of payloadContract.retiredCatalogNamespaces) {
  assert.match(retired, /^i18n-v[0-9]+\/[a-f0-9]{16}$/u, `Invalid retired locale payload namespace: ${retired}`);
}
if (payloadContract.catalogSha256 !== undefined) {
  assert.match(payloadContract.catalogSha256, /^[a-f0-9]{64}$/u, "Previous locale catalog digest is invalid");
}
const sourceKeys = Object.keys(catalog.messages.en ?? {});
assert.equal(sourceKeys.length, catalog.meta.sourceCount, "English catalog source count is inconsistent");
const sourceKeysSha256 = sha256(JSON.stringify(sourceKeys));
const compiledPayloads = {};
const localeContentSha256 = {};
for (const [locale, messages] of Object.entries(catalog.messages)) {
  assert.deepEqual(Object.keys(messages), sourceKeys, `${locale} catalog source keys are incomplete or out of order`);
  const digestInput = {
    schema: payloadContract.schema,
    catalogSha256,
    sourceCount: catalog.meta.sourceCount,
    locale,
    sourceKeysSha256,
    messages,
  };
  const contentSha256 = sha256(JSON.stringify(digestInput));
  localeContentSha256[locale] = contentSha256;
  compiledPayloads[locale] = {
    schema: digestInput.schema,
    catalogSha256: digestInput.catalogSha256,
    sourceCount: digestInput.sourceCount,
    locale: digestInput.locale,
    sourceKeysSha256: digestInput.sourceKeysSha256,
    contentSha256,
    messages: digestInput.messages,
  };
}
const payloadNamespaceSha256 = sha256(JSON.stringify({
  schema: payloadContract.schema,
  assetNamespace: payloadContract.assetNamespace,
  catalogSha256,
  sourceCount: catalog.meta.sourceCount,
  sourceKeysSha256,
  localeContentSha256,
}));
const currentNamespace = `${payloadContract.assetNamespace}/${payloadNamespaceSha256.slice(0, 16)}`;
assert.ok(
  !knownContaminatedNamespaces.includes(currentNamespace),
  `Refusing to reactivate known contaminated payload namespace ${currentNamespace}`,
);
const assetNamespaceRoot = new URL(`../public/${payloadContract.assetNamespace}/`, import.meta.url);
const assetRoot = new URL(`${payloadNamespaceSha256.slice(0, 16)}/`, assetNamespaceRoot);
const assetNamespacePath = fileURLToPath(assetNamespaceRoot);
await mkdir(assetNamespaceRoot, { recursive: true });
const namespaceEntries = await readdir(assetNamespaceRoot, { withFileTypes: true });
for (const entry of namespaceEntries) {
  assert.ok(entry.isDirectory() && /^[a-f0-9]{16}$/u.test(entry.name), `Unexpected locale payload namespace entry: ${entry.name}`);
}
const retiredCatalogNamespaces = [];
const appendRetiredNamespace = (namespace) => {
  if (!namespace || namespace === currentNamespace || retiredCatalogNamespaces.includes(namespace)) return;
  assert.match(namespace, /^i18n-v[0-9]+\/[a-f0-9]{16}$/u, `Invalid retired locale payload namespace: ${namespace}`);
  retiredCatalogNamespaces.push(namespace);
};
for (const namespace of payloadContract.retiredCatalogNamespaces) appendRetiredNamespace(namespace);
for (const namespace of knownContaminatedNamespaces) appendRetiredNamespace(namespace);
if (payloadContract.catalogSha256) {
  const previousNamespaceDigest = payloadContract.payloadNamespaceSha256 ?? payloadContract.catalogSha256;
  assert.match(previousNamespaceDigest, /^[a-f0-9]{64}$/u, "Previous payload namespace digest is invalid");
  appendRetiredNamespace(`${payloadContract.assetNamespace}/${previousNamespaceDigest.slice(0, 16)}`);
}
for (const entry of namespaceEntries) appendRetiredNamespace(`${payloadContract.assetNamespace}/${entry.name}`);

const compiledPayloadContract = {
  ...payloadContract,
  catalogSha256,
  sourceCount: catalog.meta.sourceCount,
  sourceKeysSha256,
  localeContentSha256,
  payloadNamespaceSha256,
  retiredCatalogNamespaces,
};
// Persist the retirement inventory before pruning so an interrupted compilation
// can never forget a content-addressed namespace that it already discovered.
await writeFile(payloadContractUrl, `${JSON.stringify(compiledPayloadContract, null, 2)}\n`, "utf8");
let prunedNamespaceCount = 0;
for (const entry of namespaceEntries) {
  if (entry.name === payloadNamespaceSha256.slice(0, 16)) continue;
  const stalePath = resolve(assetNamespacePath, entry.name);
  assert.equal(dirname(stalePath), resolve(assetNamespacePath), `Refusing to prune payload path outside ${assetNamespacePath}`);
  assert.equal(relative(assetNamespacePath, stalePath), entry.name, `Refusing to prune unresolved payload namespace ${entry.name}`);
  await rm(stalePath, { recursive: true, force: true });
  prunedNamespaceCount += 1;
}
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
for (const [locale, payload] of Object.entries(compiledPayloads)) {
  const messages = payload.messages;
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
    JSON.stringify(payload),
    "utf8",
  );
}

await writeFile(metadataUrl, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Compiled ${Object.keys(metadata).length} static locale payloads under /${payloadContract.assetNamespace}/${payloadNamespaceSha256.slice(0, 16)}/; pruned ${prunedNamespaceCount} stale namespace(s).`);

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../app/i18n/messages.json", import.meta.url), "utf8"));
const payloadContract = JSON.parse(await readFile(new URL("../app/i18n/payload-contract.json", import.meta.url), "utf8"));
const catalogSha256 = createHash("sha256").update(JSON.stringify(catalog.messages)).digest("hex");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const knownContaminatedNamespaces = ["i18n-v2/4c1f960016ec313e"];
const payloadNamespaceRoot = new URL(`../public/${payloadContract.assetNamespace}/`, import.meta.url);
const expectedLocales = [
  "en", "zh", "es", "hi", "fr", "ar", "bn", "pt", "id", "ur", "ru", "de", "ja", "pcm", "tr",
  "sq", "ca", "be", "nl", "bs", "bg", "hr", "el", "cs", "da", "et", "fi", "hu", "is", "ga", "it",
  "lv", "lt", "lb", "mk", "mt", "no", "pl", "ro", "sr", "sk", "sl", "sv", "uk", "ht", "gn", "qu",
  "hy", "az", "ka",
];
const sourceKeys = Object.keys(catalog.messages.en);
const sourceKeysSha256 = sha256(JSON.stringify(sourceKeys));
const expectedLocaleContentSha256 = Object.fromEntries(Object.entries(catalog.messages).map(([locale, messages]) => [
  locale,
  sha256(JSON.stringify({
    schema: payloadContract.schema,
    catalogSha256,
    sourceCount: sourceKeys.length,
    locale,
    sourceKeysSha256,
    messages,
  })),
]));
const payloadNamespaceSha256 = sha256(JSON.stringify({
  schema: payloadContract.schema,
  assetNamespace: payloadContract.assetNamespace,
  catalogSha256,
  sourceCount: sourceKeys.length,
  sourceKeysSha256,
  localeContentSha256: expectedLocaleContentSha256,
}));
const payloadRoot = `../public/${payloadContract.assetNamespace}/${payloadNamespaceSha256.slice(0, 16)}/`;
const sitemapSource = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const sitemapRoutes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/g)]
  .map((match) => match[1] || "/")
  .sort();
const criticalUi = JSON.parse(await readFile(new URL("../app/i18n/critical-ui-source.json", import.meta.url), "utf8"));
const criticalUiOverrides = JSON.parse(await readFile(new URL("../app/i18n/critical-ui-overrides.json", import.meta.url), "utf8"));
const reviewedLocalizationPolicy = JSON.parse(await readFile(new URL("../app/i18n/reviewed-localization-policy.json", import.meta.url), "utf8"));
const localeConfigSource = await readFile(new URL("../app/i18n/config.ts", import.meta.url), "utf8");
const expectedQuarantinedDirectCopyFiles = [
  "app/page.tsx",
  "app/ActivationTerminal.tsx",
  "app/SignalField.tsx",
  "app/LaunchClock.tsx",
  "app/DossierDock.tsx",
  "app/CrewSignal.tsx",
  "app/DocumentLinkUpgrade.tsx",
  "app/LaunchSequence.tsx",
  "app/dossier/page.tsx",
  "app/dossier/read/[slug]/page.tsx",
  "app/launch/page.tsx",
  "app/network/page.tsx",
  "app/proof/page.tsx",
  "app/rewards/page.tsx",
  "app/signal/page.tsx",
  "app/tokenomics/page.tsx",
  "app/verify/page.tsx",
  "app/world/page.tsx",
  "app/future/future-copy.json",
];
const protectedTerms = [
  "Internal Agency", "STAR ASCENT", "$IAT", "$SOL", "IAT", "SOLANA", "Solana", "Model T", "Genesis",
  "APY", "CCC", "CCC-Agent", "RPC", "SBF", "NFT", "DAO", "JSON", "D1", "PKCE", "OAuth", "SHA-256",
  "Radiance", "Ellie", "Alia", "UTC", "ISTANBUL", "Devnet", "CC0", "FDF Guard", "mainnet", "HOLD",
];
const exactTokenPattern = /https?:\/\/[^\s]+|@[A-Za-z0-9_]+|\$[A-Z][A-Z0-9_-]*|\bT\+\d+(?:[.,:]\d+)*\b/g;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const containsProtectedTerm = (value, term) => new RegExp(
  `(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`,
  "u",
).test(value);

assert.ok(sourceKeys.length >= 250, `Expected a whole-site catalog, found only ${sourceKeys.length} source strings`);
assert.equal(catalog.meta.sourceCount, sourceKeys.length, "Catalog source count must match English keys");
assert.equal(payloadContract.schema, "iat-locale-payload/v2", "Locale payload contract schema must be v2");
assert.equal(payloadContract.sourceCount, sourceKeys.length, "Locale payload contract source count must match the catalog");
assert.equal(payloadContract.catalogSha256, catalogSha256, "Locale payload contract digest must match every locale message");
assert.equal(payloadContract.sourceKeysSha256, sourceKeysSha256, "Locale payload contract source-key digest must match exact English key order");
assert.deepEqual(payloadContract.localeContentSha256, expectedLocaleContentSha256, "Locale payload contract must bind every locale's exact content digest");
assert.equal(payloadContract.payloadNamespaceSha256, payloadNamespaceSha256, "Content-addressed payload namespace must bind the complete payload set");
assert.ok(Array.isArray(payloadContract.retiredCatalogNamespaces), "Retired payload namespaces must be explicit");
assert.equal(
  new Set(payloadContract.retiredCatalogNamespaces).size,
  payloadContract.retiredCatalogNamespaces.length,
  "Retired payload namespaces must be deduplicated",
);
const currentNamespace = `${payloadContract.assetNamespace}/${payloadNamespaceSha256.slice(0, 16)}`;
for (const retired of payloadContract.retiredCatalogNamespaces) {
  assert.match(retired, /^i18n-v[0-9]+\/[a-f0-9]{16}$/u, `Invalid retired payload namespace: ${retired}`);
  assert.notEqual(retired, currentNamespace, "Current payload namespace cannot be retired");
}
for (const contaminated of knownContaminatedNamespaces) {
  assert.ok(payloadContract.retiredCatalogNamespaces.includes(contaminated), `Known contaminated payload namespace was forgotten: ${contaminated}`);
}
assert.deepEqual(
  (await readdir(payloadNamespaceRoot, { withFileTypes: true })).map((entry) => `${entry.isDirectory() ? "directory" : "other"}:${entry.name}`).sort(),
  [`directory:${payloadNamespaceSha256.slice(0, 16)}`],
  "Static locale packaging must contain exactly the current catalog namespace",
);
assert.deepEqual(catalog.meta.renderedRoutes, sitemapRoutes, "Catalog extraction must cover all 25 canonical sitemap routes");
assert.deepEqual(Object.keys(catalog.messages), expectedLocales, "Catalog locale order changed unexpectedly");
assert.equal(reviewedLocalizationPolicy.schema, "iat-reviewed-localization-policy/v1");
assert.equal(reviewedLocalizationPolicy.mode, "GLOBAL_FAIL_CLOSED");
assert.equal(reviewedLocalizationPolicy.fallback, "canonical-english");
assert.equal(reviewedLocalizationPolicy.machineDraftRuntimeAllowed, false);
assert.equal(reviewedLocalizationPolicy.unreviewedTargetLanguageBundleAllowed, false);
assert.equal(reviewedLocalizationPolicy.unreviewedLocaleAutonymsAllowed, false);
assert.equal(reviewedLocalizationPolicy.directComponentReviewBundleComplete, false);
assert.deepEqual(Object.keys(reviewedLocalizationPolicy.localeStatus), expectedLocales);
assert.equal(reviewedLocalizationPolicy.localeStatus.en, "SOURCE");
assert.deepEqual(reviewedLocalizationPolicy.translations, {}, "No non-English translation has accountable review evidence yet");
assert.deepEqual(reviewedLocalizationPolicy.reviews, [], "No review record may be prefilled without evidence");
assert.deepEqual(Object.keys(catalog.prompts), ["en"], "Unreviewed localized prompt drafts must not remain in the catalog");
const localeDefinitions = [...localeConfigSource.matchAll(/\{\s*code:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*nativeName:\s*"([^"]+)"/gu)]
  .map((match) => ({ code: match[1], name: match[2], nativeName: match[3] }));
assert.deepEqual(localeDefinitions.map(({ code }) => code), expectedLocales, "Locale display roster drifted");
for (const definition of localeDefinitions) {
  if (definition.code !== "en" && reviewedLocalizationPolicy.localeStatus[definition.code] === "HOLD") {
    assert.equal(definition.nativeName, definition.name, `${definition.code} exposes an unreviewed autonym in the production locale menu`);
  }
}
assert.deepEqual(catalog.meta.sourceLocales, ["en"], "Only canonical English may seed the runtime catalog");
assert.deepEqual(
  catalog.meta.quarantinedDirectComponentSourceFiles,
  expectedQuarantinedDirectCopyFiles,
  "The complete direct-copy source inventory must remain explicitly quarantined from catalog extraction",
);
assert.deepEqual(
  criticalUiOverrides.translations,
  {},
  "Legacy critical machine-draft candidates must not remain in the runtime localization tree",
);
assert.match(criticalUiOverrides.reviewStatus, /removed.*native review is required/i);
for (const source of sourceKeys) {
  assert.doesNotMatch(
    source,
    /GENESIS\s*\/\/\s*AKT\u0130VASYON|YAYINLANMAMI\u015e|T\u00d6REN\s+ZAMANI|DE\u011e\u0130LME/iu,
    `Canonical English catalog contains quarantined Turkish launch copy: ${source}`,
  );
}
for (const source of Object.values(criticalUi)) {
  assert.ok(sourceKeys.includes(source), `Critical UI source is absent from the canonical catalog: ${source}`);
}

for (const locale of expectedLocales) {
  const keys = Object.keys(catalog.messages[locale]);
  assert.deepEqual(keys, sourceKeys, `${locale} must cover every canonical source string`);
  for (const source of sourceKeys) {
    assert.equal(typeof catalog.messages[locale][source], "string", `${locale} missing ${source}`);
    assert.ok(catalog.messages[locale][source].trim(), `${locale} has an empty translation for ${source}`);
    for (const protectedTerm of protectedTerms) {
      if (containsProtectedTerm(source, protectedTerm)) assert.ok(
        catalog.messages[locale][source].includes(protectedTerm),
        `${locale} changed protected term ${protectedTerm}`,
      );
    }
    assert.doesNotMatch(catalog.messages[locale][source], /ZXQTERM\d+QXZ/i, `${locale} leaked a translation placeholder for ${source}`);
    if (/^[0-9a-f]{64}$/u.test(source)) {
      assert.equal(catalog.messages[locale][source], source, `${locale} changed immutable SHA-256 evidence text`);
    }
    assert.doesNotMatch(
      catalog.messages[locale][source],
      /__IA_(?:TERM|EXACT)_[A-Z]+__/u,
      `${locale} leaked an IAT translation placeholder for ${source}`,
    );
    for (const number of source.match(/(?<![\p{L}\p{N}_])\d+(?:[.,:]\d+)*(?:[A-Za-z]+|%)?(?![\p{L}\p{N}_])/gu) ?? []) {
      assert.ok(catalog.messages[locale][source].includes(number), `${locale} changed numeric/unit token ${number} in ${source}`);
    }
    for (const token of source.match(exactTokenPattern) ?? []) {
      assert.ok(catalog.messages[locale][source].includes(token), `${locale} changed exact token ${token} in ${source}`);
    }
    assert.doesNotMatch(catalog.messages[locale][source], /<script\b|javascript:/i, `${locale} introduced executable markup in ${source}`);
    const expansionRatio = catalog.messages[locale][source].length / Math.max(1, source.length);
    assert.ok(
      catalog.messages[locale][source].length <= 800 && (source.length <= 40 || expansionRatio <= 4),
      `${locale} produced a suspiciously expanded translation for ${source}`,
    );
  }
  const promptSource = catalog.prompts.en.english;
  assert.ok(catalog.messages[locale][promptSource], `${locale} is missing the canonical English-return prompt fallback`);
  if (locale !== "en") {
    for (const source of Object.values(criticalUi)) {
      assert.equal(
        catalog.messages[locale][source],
        reviewedLocalizationPolicy.translations[locale]?.[source] ?? source,
        `${locale} critical UI copy escaped the reviewed-or-English runtime policy: ${source}`,
      );
    }
  }
}

for (const locale of expectedLocales.slice(1)) {
  assert.equal(reviewedLocalizationPolicy.localeStatus[locale], "HOLD", `${locale} must remain HOLD without review evidence`);
  for (const source of sourceKeys) {
    assert.equal(
      catalog.messages[locale][source],
      source,
      `${locale} exposes an unreviewed machine-draft runtime cell: ${source}`,
    );
  }
}
assert.deepEqual(catalog.meta.runtimeLocalizationPolicy, {
  mode: "GLOBAL_FAIL_CLOSED",
  fallback: "canonical-english",
  machineDraftRuntimeAllowed: false,
  reviewedRuntimeCells: 0,
  fallbackRuntimeCells: sourceKeys.length * (expectedLocales.length - 1),
});

assert.equal(catalog.messages.en["This closes on its own in 15 seconds."], "This closes on its own in 15 seconds.");
assert.match(catalog.meta.translationMode ?? "", /static committed output/i, "Catalog must disclose static translation mode");
assert.equal(
  catalog.meta.translationDraftStatus,
  "QUARANTINED_MACHINE_DRAFTS_RUNTIME_REVIEW_ONLY",
  "Catalog must label legacy machine drafts as quarantined from runtime",
);
assert.match(
  catalog.meta.translationEngine ?? "",
  /no machine translation is active at runtime/i,
  "Catalog must disclose that runtime machine translation is inactive",
);

const metadata = JSON.parse(await readFile(new URL("../app/i18n/metadata.generated.json", import.meta.url), "utf8"));
const routeSeo = JSON.parse(await readFile(new URL("../app/i18n/route-seo.json", import.meta.url), "utf8"));
for (const publicPath of sitemapRoutes) {
  assert.ok(routeSeo[publicPath], `Sitemap route is missing route-specific SEO copy: ${publicPath}`);
}
const routeSeoSources = [...new Set(Object.values(routeSeo).flatMap(({ title, description }) => [title, description]))];
for (const source of routeSeoSources) {
  assert.ok(sourceKeys.includes(source), `Route SEO source is not part of the canonical translation catalog: ${source}`);
}
assert.deepEqual(Object.keys(metadata), expectedLocales, "Localized metadata must cover every locale");
for (const locale of expectedLocales) {
  const payload = JSON.parse(await readFile(new URL(`${payloadRoot}${locale}.json`, import.meta.url), "utf8"));
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["catalogSha256", "contentSha256", "locale", "messages", "schema", "sourceCount", "sourceKeysSha256"].sort(),
    `${locale} static payload has missing or unexpected contract fields`,
  );
  assert.equal(payload.schema, payloadContract.schema, `${locale} static payload has the wrong schema`);
  assert.equal(payload.catalogSha256, catalogSha256, `${locale} static payload has the wrong catalog digest`);
  assert.equal(payload.sourceCount, sourceKeys.length, `${locale} static payload has the wrong source count`);
  assert.equal(payload.locale, locale, `${locale} static payload is mislabeled`);
  assert.deepEqual(Object.keys(payload.messages), sourceKeys, `${locale} static payload source keys are incomplete or out of order`);
  assert.equal(payload.sourceKeysSha256, sourceKeysSha256, `${locale} static payload has the wrong source-key digest`);
  const contentSha256 = sha256(JSON.stringify({
    schema: payload.schema,
    catalogSha256: payload.catalogSha256,
    sourceCount: payload.sourceCount,
    locale: payload.locale,
    sourceKeysSha256: payload.sourceKeysSha256,
    messages: payload.messages,
  }));
  assert.equal(payload.contentSha256, contentSha256, `${locale} static payload content digest does not match its exact messages`);
  assert.equal(
    payloadContract.localeContentSha256[locale],
    contentSha256,
    `${locale} static payload content digest does not match the contract`,
  );
  assert.equal(metadata[locale].prompt.timeout.includes("15"), true, `${locale} prompt must retain the 15-second timeout`);
  assert.ok(metadata[locale].title.length <= 140, `${locale} root title is unreasonably long`);
  assert.ok(metadata[locale].description.length <= 400, `${locale} root description is unreasonably long`);
  for (const source of routeSeoSources) {
    assert.ok(metadata[locale].seo[source]?.trim(), `${locale} is missing route SEO copy for ${source}`);
  }
}

console.log(`i18n catalog valid: ${sourceKeys.length} strings × ${expectedLocales.length} locales`);

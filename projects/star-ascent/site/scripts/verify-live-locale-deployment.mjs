import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cachePolicyError,
  payloadIntegrityError,
  responseIdentityError,
  runtimeBundleError,
  runtimeParityError,
} from "./live-locale-verifier-lib.mjs";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(siteRoot, "app/i18n/messages.json");
const contractPath = resolve(siteRoot, "app/i18n/payload-contract.json");
const policyPath = resolve(siteRoot, "app/i18n/reviewed-localization-policy.json");
const routeSeoPath = resolve(siteRoot, "app/i18n/route-seo.json");
const payloadRoot = resolve(siteRoot, "public");

const domains = ["https://internalagency.io", "https://ileriakil.com"];
const rtlLocales = new Set(["ar", "ur"]);
const knownContaminatedNamespaces = ["i18n-v2/4c1f960016ec313e"];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const htmlLanguageTag = (locale) => (locale === "zh" ? "zh-Hans" : locale === "sr" ? "sr-Cyrl" : locale);
const googleHreflangTag = (locale) => locale === "pcm" ? null : htmlLanguageTag(locale);
const normalizePublicUrl = (value, base) => {
  try {
    const url = new URL(value, base);
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
};
const htmlAttribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] ?? "";
const decodeHtml = (value) => value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|apos|gt|lt|quot);/giu, (entity, token) => {
  const normalized = token.toLowerCase();
  if (normalized === "amp") return "&";
  if (normalized === "apos") return "'";
  if (normalized === "gt") return ">";
  if (normalized === "lt") return "<";
  if (normalized === "quot") return '"';
  const codePoint = normalized.startsWith("#x")
    ? Number.parseInt(normalized.slice(2), 16)
    : Number.parseInt(normalized.slice(1), 10);
  return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
});
const normalizeHtmlText = (value) => decodeHtml(value).replace(/<[^>]*>/gu, "").trim().replace(/\s+/gu, " ");

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache, no-store",
      pragma: "no-cache",
      "user-agent": "IAT-live-locale-verifier/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = {
          ok: false,
          label: String(items[index]?.label ?? items[index]),
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const reviewedPolicy = JSON.parse(await readFile(policyPath, "utf8"));
const routeSeo = JSON.parse(await readFile(routeSeoPath, "utf8"));
const locales = Object.keys(catalog.messages ?? {}).sort();
const sourceKeys = Object.keys(catalog.messages?.en ?? {});
const catalogSha256 = sha256(JSON.stringify(catalog.messages));
const sourceKeysSha256 = sha256(JSON.stringify(sourceKeys));
const expectedLocaleContentSha256 = Object.fromEntries(Object.entries(catalog.messages ?? {}).map(([locale, messages]) => [
  locale,
  sha256(JSON.stringify({
    schema: contract.schema,
    catalogSha256,
    sourceCount: sourceKeys.length,
    locale,
    sourceKeysSha256,
    messages,
  })),
]));
const payloadNamespaceSha256 = sha256(JSON.stringify({
  schema: contract.schema,
  assetNamespace: contract.assetNamespace,
  catalogSha256,
  sourceCount: sourceKeys.length,
  sourceKeysSha256,
  localeContentSha256: expectedLocaleContentSha256,
}));
const policyLocales = Object.keys(reviewedPolicy.localeStatus ?? {}).sort();
const contentLocaleFor = () => "en";

if (
  reviewedPolicy.schema !== "iat-reviewed-localization-policy/v1"
  || reviewedPolicy.mode !== "GLOBAL_FAIL_CLOSED"
  || reviewedPolicy.fallback !== "canonical-english"
  || reviewedPolicy.machineDraftRuntimeAllowed !== false
  || reviewedPolicy.unreviewedTargetLanguageBundleAllowed !== false
  || reviewedPolicy.unreviewedLocaleAutonymsAllowed !== false
  || reviewedPolicy.directComponentReviewBundleComplete !== false
) {
  throw new Error("reviewed-localization policy is not GLOBAL_FAIL_CLOSED");
}
if (
  JSON.stringify(policyLocales) !== JSON.stringify(locales)
  || reviewedPolicy.localeStatus.en !== "SOURCE"
  || locales.filter((locale) => locale !== "en").some((locale) => reviewedPolicy.localeStatus[locale] !== "HOLD")
  || Object.keys(reviewedPolicy.translations ?? {}).length !== 0
  || (reviewedPolicy.reviews ?? []).length !== 0
) {
  throw new Error("live verification requires the exact evidence-free 49-locale HOLD policy; a status marker cannot activate copy");
}
for (const locale of locales) {
  if (contentLocaleFor(locale) === "en" && JSON.stringify(catalog.messages[locale]) !== JSON.stringify(catalog.messages.en)) {
    throw new Error(`${locale} is on review HOLD but its committed runtime catalog is not canonical English fallback`);
  }
}

if (contract.schema !== "iat-locale-payload/v2") {
  throw new Error(`Unsupported payload contract schema: ${contract.schema}`);
}
if (locales.length !== 50) {
  throw new Error(`Expected 50 catalog locales; found ${locales.length}`);
}
if (Object.keys(catalog.messages.en ?? {}).length !== contract.sourceCount) {
  throw new Error(
    `English catalog source count ${Object.keys(catalog.messages.en ?? {}).length} != contract ${contract.sourceCount}`,
  );
}
if (!/^[a-f0-9]{64}$/.test(contract.catalogSha256)) {
  throw new Error("payload-contract.json has an invalid catalogSha256");
}
if (contract.catalogSha256 !== catalogSha256) {
  throw new Error(`payload catalog digest ${contract.catalogSha256} != committed catalog ${catalogSha256}`);
}
if (contract.sourceKeysSha256 !== sourceKeysSha256) {
  throw new Error(`payload source-key digest ${contract.sourceKeysSha256 ?? "missing"} != committed catalog ${sourceKeysSha256}`);
}
if (
  !contract.localeContentSha256
  || typeof contract.localeContentSha256 !== "object"
  || Array.isArray(contract.localeContentSha256)
  || JSON.stringify(Object.keys(contract.localeContentSha256).sort()) !== JSON.stringify(locales)
  || Object.values(contract.localeContentSha256).some((digest) => !/^[a-f0-9]{64}$/u.test(digest))
) {
  throw new Error("payload contract does not bind one valid content digest for every locale");
}
if (JSON.stringify(contract.localeContentSha256) !== JSON.stringify(expectedLocaleContentSha256)) {
  throw new Error("payload contract per-locale content digests do not match the exact committed catalogs");
}
if (contract.payloadNamespaceSha256 !== payloadNamespaceSha256) {
  throw new Error(`payload namespace digest ${contract.payloadNamespaceSha256 ?? "missing"} != exact payload set ${payloadNamespaceSha256}`);
}

const namespace = `${contract.assetNamespace}/${contract.payloadNamespaceSha256.slice(0, 16)}`;
if (
  !Array.isArray(contract.retiredCatalogNamespaces)
  || new Set(contract.retiredCatalogNamespaces).size !== contract.retiredCatalogNamespaces.length
  || contract.retiredCatalogNamespaces.some((value) => !/^i18n-v[0-9]+\/[a-f0-9]{16}$/u.test(value) || value === namespace)
  || knownContaminatedNamespaces.some((value) => !contract.retiredCatalogNamespaces.includes(value))
) {
  throw new Error("payload contract has an invalid retired namespace inventory");
}
const localNamespaceEntries = (await readdir(resolve(payloadRoot, contract.assetNamespace), { withFileTypes: true }))
  .map((entry) => `${entry.isDirectory() ? "directory" : "other"}:${entry.name}`)
  .sort();
if (JSON.stringify(localNamespaceEntries) !== JSON.stringify([`directory:${contract.payloadNamespaceSha256.slice(0, 16)}`])) {
  throw new Error(`local production tree contains stale or unexpected payload namespaces: ${localNamespaceEntries.join(", ")}`);
}
const cacheBuster = Date.now();
const payloadJobs = domains.flatMap((domain) =>
  locales.map((locale) => ({ domain, locale, label: `${domain} ${locale}` })),
);

const payloadResults = await mapConcurrent(payloadJobs, 10, async ({ domain, locale, label }) => {
  const localPath = resolve(payloadRoot, namespace, `${locale}.json`);
  const expectedBytes = await readFile(localPath);
  const url = `${domain}/${namespace}/${locale}.json?verify=${cacheBuster}`;
  const { response, bytes } = await fetchBytes(url);
  const expectedHash = sha256(expectedBytes);
  const actualHash = sha256(bytes);

  if (response.status !== 200) {
    return { ok: false, label, detail: `HTTP ${response.status} at ${url}` };
  }
  const identityError = responseIdentityError(url, response);
  if (identityError) return { ok: false, label, detail: identityError };
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { ok: false, label, detail: `unexpected content type ${response.headers.get("content-type") ?? "missing"}` };
  }
  const cacheError = cachePolicyError({
    cacheControl: response.headers.get("cache-control"),
    contentAddressed: true,
  });
  if (cacheError) return { ok: false, label, detail: cacheError };
  if (actualHash !== expectedHash) {
    return {
      ok: false,
      label,
      detail: `payload SHA-256 ${actualHash} != committed ${expectedHash}`,
    };
  }
  let payload;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { ok: false, label, detail: "payload is not valid JSON" };
  }
  const integrityError = payloadIntegrityError({ payload, contract, locale });
  if (integrityError) return { ok: false, label, detail: integrityError };
  return { ok: true, label };
});

const retiredNamespaceJobs = domains.flatMap((domain) =>
  contract.retiredCatalogNamespaces.flatMap((retired) => locales.map((locale) => ({
    label: `${domain} retired ${retired}/${locale}.json`,
    url: `${domain}/${retired}/${locale}.json?verify=${cacheBuster}`,
  }))),
);
const retiredNamespaceResults = await mapConcurrent(retiredNamespaceJobs, 4, async ({ label, url }) => {
  const { response } = await fetchBytes(url);
  const identityError = responseIdentityError(url, response);
  if (identityError) return { ok: false, label, detail: identityError };
  if (![404, 410].includes(response.status)) {
    return { ok: false, label, detail: `retired contaminated payload remains reachable: HTTP ${response.status}` };
  }
  return { ok: true, label };
});

const englishBodyMarkers = {
  "/": "INTERNAL AGENCY PRESENTS",
  "/launch": "STAR ASCENT // GENESIS CONTROL",
  "/proof": "STAR ASCENT // PUBLIC PROOF BOARD",
  "/dossier": "INTERNAL AGENCY // CANONICAL DOSSIER",
  "/network": "IAT NETWORK // LIVE SOLANA READOUT",
};
const canonicalRoutes = Object.keys(routeSeo);
if (canonicalRoutes.length !== 25) {
  throw new Error(`Expected 25 canonical route identities; found ${canonicalRoutes.length}`);
}
for (const [publicPath, sources] of Object.entries(routeSeo)) {
  if (!sourceKeys.includes(sources.title) || !sourceKeys.includes(sources.description)) {
    throw new Error(`${publicPath} route SEO identity is not source-bound to the canonical English catalog`);
  }
}
const prefixedPageJobs = domains.flatMap((domain) => locales.flatMap((locale) =>
  canonicalRoutes.map((publicPath) => {
    const canonicalPath = publicPath === "/" ? "" : publicPath;
    const route = `/${locale}${canonicalPath}`;
    const contentLocale = contentLocaleFor(locale);
    return { domain, locale, contentLocale, publicPath, route, expectedLang: htmlLanguageTag(contentLocale), label: `${domain}${route}` };
  }),
));
const hostDefaultPageJobs = domains.flatMap((domain) => canonicalRoutes.map((publicPath) => {
  const locale = domain === "https://ileriakil.com" ? "tr" : "en";
  const contentLocale = contentLocaleFor(locale);
  return {
    domain,
    locale,
    contentLocale,
    publicPath,
    route: publicPath,
    expectedLang: htmlLanguageTag(contentLocale),
    label: `${domain}${publicPath} host-default route`,
  };
}));
const pageJobs = [...prefixedPageJobs, ...hostDefaultPageJobs];
const pageResults = await mapConcurrent(pageJobs, 20, async ({ domain, locale, contentLocale, publicPath, route, expectedLang, label }) => {
  const url = `${domain}${route}?verify=${cacheBuster}`;
  const { response, bytes } = await fetchBytes(url);
  const html = bytes.toString("utf8");
  const actualLang = html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1];
  const actualDir = html.match(/<html[^>]*\bdir=["']([^"']+)/i)?.[1];
  const expectedDir = rtlLocales.has(contentLocale) ? "rtl" : "ltr";

  if (response.status !== 200) {
    return { ok: false, label, detail: `HTTP ${response.status} at ${url}` };
  }
  const identityError = responseIdentityError(url, response);
  if (identityError) return { ok: false, label, detail: identityError };
  if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    return { ok: false, label, detail: `unexpected content type ${response.headers.get("content-type") ?? "missing"}` };
  }
  const cacheError = cachePolicyError({
    cacheControl: response.headers.get("cache-control"),
    contentAddressed: false,
  });
  if (cacheError) return { ok: false, label, detail: cacheError };
  if (response.headers.get("content-language")?.toLowerCase() !== contentLocale) {
    return {
      ok: false,
      label,
      detail: `Content-Language ${response.headers.get("content-language") ?? "missing"} != ${contentLocale}`,
    };
  }
  if (bytes.length < 1_000) {
    return { ok: false, label, detail: `unexpectedly small HTML response (${bytes.length} bytes)` };
  }
  if (actualLang !== expectedLang) {
    return { ok: false, label, detail: `HTML lang ${actualLang ?? "missing"} != ${expectedLang}` };
  }
  if (actualDir !== expectedDir) {
    return { ok: false, label, detail: `HTML dir ${actualDir ?? "missing"} != ${expectedDir}` };
  }
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  if (htmlAttribute(htmlTag, "data-route-locale") !== locale) {
    return { ok: false, label, detail: `route locale marker ${htmlAttribute(htmlTag, "data-route-locale") || "missing"} != ${locale}` };
  }
  if (contentLocale === "en" && htmlAttribute(htmlTag, "data-locale-ready") !== "true") {
    return { ok: false, label, detail: "canonical English fallback is not marked ready in server HTML" };
  }
  const hostReviewHold = domain === "https://ileriakil.com" && contentLocaleFor("tr") !== "tr";
  const reviewHold = contentLocale !== locale || hostReviewHold;
  const robotsMeta = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
  const headerRobots = response.headers.get("x-robots-tag") ?? "";
  if (reviewHold && (!/noindex/i.test(robotsMeta) || !/noindex/i.test(headerRobots))) {
    return { ok: false, label, detail: "review-HOLD page is missing meta/header noindex" };
  }
  if (reviewHold && /rel=["']preload["'][^>]+\/i18n-v2\//i.test(html)) {
    return { ok: false, label, detail: "review-HOLD page preloads a non-English payload" };
  }
  if (reviewHold && /\/i18n-v2\//i.test(html)) {
    return { ok: false, label, detail: "review-HOLD page references a locale payload" };
  }
  const bodyMarker = englishBodyMarkers[publicPath];
  if (contentLocale === "en" && bodyMarker && !html.includes(bodyMarker)) {
    return { ok: false, label, detail: `canonical English body marker is missing: ${bodyMarker}` };
  }
  const routeSources = routeSeo[publicPath];
  const title = normalizeHtmlText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const descriptionTag = metaTags.find((tag) => htmlAttribute(tag, "name").toLowerCase() === "description");
  const description = normalizeHtmlText(descriptionTag ? htmlAttribute(descriptionTag, "content") : "");
  if (contentLocale === "en" && (title !== routeSources.title || description !== routeSources.description)) {
    return {
      ok: false,
      label,
      detail: `route SEO source mismatch: title=${JSON.stringify(title)}, description=${JSON.stringify(description)}`,
    };
  }

  const canonicalPath = publicPath === "/" ? "" : publicPath;
  const expectedCanonical = reviewHold
    ? `https://internalagency.io${canonicalPath}`
    : domain === "https://ileriakil.com" && locale === "tr"
      ? `${domain}${canonicalPath}`
      : locale === "en"
        ? `https://internalagency.io${canonicalPath}`
        : `https://internalagency.io/${locale}${canonicalPath}`;
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const canonicalTag = linkTags.find((tag) => htmlAttribute(tag, "rel").toLowerCase() === "canonical");
  const actualCanonical = normalizePublicUrl(canonicalTag ? htmlAttribute(canonicalTag, "href") : "", domain);
  if (actualCanonical !== expectedCanonical) {
    return { ok: false, label, detail: `canonical ${actualCanonical || "missing"} != ${expectedCanonical}` };
  }
  const expectedAlternates = new Map();
  for (const candidate of locales) {
    if (contentLocaleFor(candidate) !== candidate) continue;
    const tag = googleHreflangTag(candidate);
    if (!tag) continue;
    expectedAlternates.set(tag, candidate === "en"
      ? `https://internalagency.io${canonicalPath}`
      : `https://internalagency.io/${candidate}${canonicalPath}`);
  }
  if (contentLocaleFor("tr") === "tr") expectedAlternates.set("tr-TR", `https://ileriakil.com${canonicalPath}`);
  expectedAlternates.set("x-default", `https://internalagency.io${canonicalPath}`);
  const alternateTags = linkTags.filter((tag) => htmlAttribute(tag, "rel").toLowerCase() === "alternate" && htmlAttribute(tag, "hreflang"));
  const actualAlternates = new Map(alternateTags.map((tag) => [htmlAttribute(tag, "hreflang"), normalizePublicUrl(htmlAttribute(tag, "href"), domain)]));
  if (
    alternateTags.length !== expectedAlternates.size
    || actualAlternates.size !== expectedAlternates.size
    || [...expectedAlternates].some(([tag, href]) => actualAlternates.get(tag) !== href)
  ) {
    return { ok: false, label, detail: "hreflang inventory includes a HOLD locale or omits an approved canonical alternate" };
  }

  const structuredDataScripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let webPage = null;
  for (const match of structuredDataScripts) {
    try {
      const value = JSON.parse(match[1]);
      const nodes = Array.isArray(value?.["@graph"]) ? value["@graph"] : [value];
      webPage ??= nodes.find((node) => node?.["@type"] === "WebPage") ?? null;
    } catch {
      return { ok: false, label, detail: "JSON-LD is not valid JSON" };
    }
  }
  if (!webPage || normalizePublicUrl(webPage.url, domain) !== expectedCanonical || webPage.inLanguage !== expectedLang) {
    return { ok: false, label, detail: "JSON-LD WebPage identity does not match the effective content language and canonical URL" };
  }
  return { ok: true, label };
});

const runtimeJobs = domains.map((domain) => ({ domain, label: `${domain} locale runtime` }));
const runtimeResults = await mapConcurrent(runtimeJobs, 2, async ({ domain, label }) => {
  const pageUrl = `${domain}/zh/network?verify=${cacheBuster}`;
  const { response: pageResponse, bytes: pageBytes } = await fetchBytes(pageUrl);

  if (pageResponse.status !== 200) {
    return { ok: false, label, detail: `HTTP ${pageResponse.status} at ${pageUrl}` };
  }
  const pageIdentityError = responseIdentityError(pageUrl, pageResponse);
  if (pageIdentityError) return { ok: false, label, detail: pageIdentityError };
  if (!pageResponse.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    return {
      ok: false,
      label,
      detail: `unexpected page content type ${pageResponse.headers.get("content-type") ?? "missing"}`,
    };
  }

  const html = pageBytes.toString("utf8");
  const runtimePath = html.match(/(?:src|href)=["']([^"']*LocaleRuntime-[^"']+\.js)["']/i)?.[1];
  if (!runtimePath) {
    return { ok: false, label, detail: "fingerprinted LocaleRuntime bundle was not referenced by rendered HTML" };
  }

  const runtimeUrl = new URL(runtimePath, domain).toString();
  const { response, bytes } = await fetchBytes(`${runtimeUrl}?verify=${cacheBuster}`);
  if (response.status !== 200) {
    return { ok: false, label, detail: `HTTP ${response.status} at ${runtimeUrl}` };
  }
  const runtimeIdentityError = responseIdentityError(runtimeUrl, response);
  if (runtimeIdentityError) return { ok: false, label, detail: runtimeIdentityError };
  const cacheError = cachePolicyError({
    cacheControl: response.headers.get("cache-control"),
    contentAddressed: true,
  });
  if (cacheError) return { ok: false, label, detail: cacheError };
  const bundleError = runtimeBundleError({
    contentType: response.headers.get("content-type"),
    bytes,
    contract,
  });
  if (bundleError) return { ok: false, label, detail: bundleError };
  return { ok: true, label, assetPath: new URL(runtimeUrl).pathname, sha256: sha256(bytes) };
});

const runtimeParityDetail = runtimeParityError(runtimeResults);
const runtimeParityResult = {
  ok: runtimeParityDetail === null,
  label: "cross-domain locale runtime parity",
  detail: runtimeParityDetail,
};
const failures = [...payloadResults, ...retiredNamespaceResults, ...pageResults, ...runtimeResults, runtimeParityResult].filter(
  (result) => !result.ok,
);
if (failures.length > 0) {
  console.error(`Live locale deployment FAIL: ${failures.length} check(s) failed.`);
  for (const failure of failures) {
    console.error(`- ${failure.label}: ${failure.detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Live locale deployment PASS: ${payloadResults.length}/${payloadResults.length} exact payloads and ` +
      `${retiredNamespaceResults.length}/${retiredNamespaceResults.length} retired namespaces absent and ` +
      `${pageResults.length}/${pageResults.length} locale pages and ` +
      `${runtimeResults.length}/${runtimeResults.length} matching locale runtime bundles across ` +
      `${domains.length} active domains with freshness-safe cache policies; ` +
      `catalog ${contract.catalogSha256}.`,
  );
  console.log("Read-only verification only: no deployment, signing, funding, or chain state was changed.");
}

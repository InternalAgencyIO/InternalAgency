import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { socialImageContractForPath } from "./iat-public-social-image-contract.mjs";

const timeoutMs = 12_000;
const concurrency = 8;

const publicOrigins = ["https://internalagency.io", "https://ileriakil.com"];
const metadataCatalog = JSON.parse(readFileSync(new URL("../app/i18n/metadata.generated.json", import.meta.url), "utf8"));
const routeSeoCatalog = JSON.parse(readFileSync(new URL("../app/i18n/route-seo.json", import.meta.url), "utf8"));
const reviewedPolicy = JSON.parse(readFileSync(new URL("../app/i18n/reviewed-localization-policy.json", import.meta.url), "utf8"));
const sitemapRoutes = Object.keys(routeSeoCatalog);
const localeCodes = Object.keys(metadataCatalog);
const localeCodeSet = new Set(localeCodes);
const stressRoutes = ["/", "/launch", "/proof", "/dossier", "/network"];
const pages = [...new Set([
  ...publicOrigins.flatMap((origin) => sitemapRoutes.map((route) => `${origin}${route}`)),
  ...localeCodes.flatMap((locale) => stressRoutes.map((route) =>
    `https://internalagency.io/${locale}${route === "/" ? "" : route}`,
  )),
])];
const contentLocaleFor = () => "en";
const htmlLanguageTag = (locale) => locale === "zh" ? "zh-Hans" : locale === "sr" ? "sr-Cyrl" : locale;
const googleHreflangTag = (locale) => locale === "pcm" ? null : htmlLanguageTag(locale);
const englishBodyMarkers = {
  "/": "INTERNAL AGENCY PRESENTS",
  "/launch": "STAR ASCENT // GENESIS CONTROL",
  "/proof": "STAR ASCENT // PUBLIC PROOF BOARD",
  "/verify": "STAR ASCENT // FIELD GUIDE 01",
  "/signal": "INTERNAL AGENCY // OFFICIAL SIGNAL DIRECTORY",
  "/dossier": "INTERNAL AGENCY // CANONICAL DOSSIER",
  "/press": "INTERNAL AGENCY // PRESS ROOM",
  "/rewards": "STAR ASCENT // NODE REWARDS",
  "/tokenomics": "IAT // PUBLIC ECONOMIC POLICY V2",
  "/network": "IAT NETWORK // LIVE SOLANA READOUT",
};

if (
  reviewedPolicy.schema !== "iat-reviewed-localization-policy/v1"
  || reviewedPolicy.mode !== "GLOBAL_FAIL_CLOSED"
  || reviewedPolicy.fallback !== "canonical-english"
  || reviewedPolicy.machineDraftRuntimeAllowed !== false
  || reviewedPolicy.unreviewedTargetLanguageBundleAllowed !== false
  || reviewedPolicy.unreviewedLocaleAutonymsAllowed !== false
  || reviewedPolicy.directComponentReviewBundleComplete !== false
) throw new Error("reviewed-localization policy is not GLOBAL_FAIL_CLOSED");
if (
  JSON.stringify(Object.keys(reviewedPolicy.localeStatus ?? {})) !== JSON.stringify(localeCodes)
  || reviewedPolicy.localeStatus.en !== "SOURCE"
  || localeCodes.slice(1).some((locale) => reviewedPolicy.localeStatus[locale] !== "HOLD")
  || Object.keys(reviewedPolicy.translations ?? {}).length !== 0
  || (reviewedPolicy.reviews ?? []).length !== 0
) throw new Error("public verification requires the exact evidence-free 49-locale HOLD policy; a status marker cannot activate copy");

function pageIdentity(url) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  const prefixedLocale = segments.length > 0 && localeCodeSet.has(segments[0]) ? segments[0] : null;
  const locale = prefixedLocale ?? (parsed.origin === "https://ileriakil.com" ? "tr" : "en");
  const publicSegments = prefixedLocale ? segments.slice(1) : segments;
  return {
    origin: parsed.origin,
    locale,
    publicPath: publicSegments.length > 0 ? `/${publicSegments.join("/")}` : "/",
  };
}

const disclosureRedirects = {
  "star-ascent-whitepaper-v2": "white-dossier",
  "star-ascent-white-dossier-v2": "white-dossier",
  "iat-litepaper": "white-dossier",
  "iat-tokenomics-v1": "tokenomics",
  "iat-tokenomics-v2": "tokenomics",
  "iat-token-implementation-manifest": "mint-manifest",
  "iat-genesis-evidence-record": "genesis-proof",
  "star-ascent-broadcast-pack": "broadcast-pack",
  "star-ascent-genesis-social-kit": "social-kit",
  "star-ascent-communications-kit": "social-kit",
  "star-ascent-genesis-run-sheet": "genesis-run",
  "star-ascent-launch-rehearsal": "genesis-run",
  "iat-allocation-authority-checklist": "authority-map",
  "iat-solana-technical-spec": "technical-spec",
  "star-ascent-readiness-scorecard": "readiness",
  "star-ascent-incident-response": "incident-response",
};
const directDocumentPages = [...new Set(Object.values(disclosureRedirects))].flatMap((document) =>
  publicOrigins.map((origin) => `${origin}/dossier/read/${document}`),
);
const redirects = Object.entries(disclosureRedirects).flatMap(([document, destination]) => [
  [`https://internalagency.io/disclosures/${document}-en.txt`, `/dossier/read/${destination}`],
  [`https://ileriakil.com/disclosures/${document}-tr.txt`, `/dossier/read/${destination}`],
]);

async function request(url, redirect = "follow") {
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(url, { redirect, signal, headers: { "user-agent": "STAR-ASCENT-public-route-check/1.0" } });
}

function decodeHtmlAttribute(value) {
  return value.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|apos|quot|lt|gt));/gi, (entity, hex, decimal, named) => {
    if (hex || decimal) {
      try { return String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10)); } catch { return entity; }
    }
    return { amp: "&", apos: "'", quot: "\"", lt: "<", gt: ">" }[named.toLowerCase()] ?? entity;
  });
}

function attribute(tag, name) {
  const value = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? "";
  return decodeHtmlAttribute(value);
}

function normalizePublicUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

function metadataError(url, html) {
  const { origin, locale, publicPath } = pageIdentity(url);
  const contentLocale = contentLocaleFor(locale);
  const localeMetadata = metadataCatalog[contentLocale];
  const seoSources = routeSeoCatalog[publicPath]
    ?? (publicPath.startsWith("/dossier/read/") ? routeSeoCatalog["/dossier"] : routeSeoCatalog["/"]);
  const expected = {
    lang: contentLocale,
    title: localeMetadata.seo[seoSources.title] ?? localeMetadata.title,
    description: localeMetadata.seo[seoSources.description] ?? localeMetadata.description,
  };
  const language = html.match(/<html\b[^>]*\blang="([^"]+)"/i)?.[1] ?? "";
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const metaValue = (name, kind = "property") => {
    const tag = metaTags.find((candidate) => attribute(candidate, kind) === name);
    return tag ? attribute(tag, "content") : "";
  };
  const canonicalTag = linkTags.find((candidate) => attribute(candidate, "rel") === "canonical");
  const canonicalHref = canonicalTag ? attribute(canonicalTag, "href") : "";
  const ogImageUrl = metaValue("og:image");
  const socialImageContract = socialImageContractForPath(publicPath);
  const expectedSocialImageUrl = `${origin}${socialImageContract.path}`;
  const routeSuffix = publicPath === "/" ? "" : publicPath;
  const hostReviewHold = origin === "https://ileriakil.com" && contentLocaleFor("tr") !== "tr";
  const reviewHold = contentLocale !== locale || hostReviewHold;
  const expectedCanonical = reviewHold ? `https://internalagency.io${routeSuffix}` : `${origin}${routeSuffix}`;
  if (language !== expected.lang) return `expected html lang=${expected.lang}; got ${language || "missing"}`;
  if (title !== expected.title) return `expected title ${expected.title}; got ${title || "missing"}`;
  if (metaValue("description", "name") !== expected.description) return "expected reviewed-or-fallback meta description";
  if (ogImageUrl !== expectedSocialImageUrl) return `expected route-bound OG image ${expectedSocialImageUrl}; got ${ogImageUrl || "missing"}`;
  if (metaValue("og:title") !== expected.title) return "expected OG title to exactly match the document title";
  if (metaValue("og:description") !== expected.description) return "expected OG description to exactly match the reviewed-or-fallback description";
  if (metaValue("og:type") !== "website") return `expected og:type=website; got ${metaValue("og:type") || "missing"}`;
  if (
    socialImageContract.width
    && (
      metaValue("og:image:width") !== socialImageContract.width
      || metaValue("og:image:height") !== socialImageContract.height
    )
  ) return "expected route-bound OG image dimensions";
  const ogImageAlt = metaValue("og:image:alt");
  if (!ogImageAlt) return "expected non-empty OG image alt text";
  if (normalizePublicUrl(metaValue("og:url")) !== expectedCanonical) return "expected OG URL to match the effective canonical route";
  if (metaValue("twitter:card", "name") !== "summary_large_image") return "expected Twitter large-image card";
  if (metaValue("twitter:title", "name") !== expected.title) return "expected Twitter title to exactly match the document title";
  if (metaValue("twitter:description", "name") !== expected.description) return "expected Twitter description to exactly match the reviewed-or-fallback description";
  if (metaValue("twitter:image", "name") !== expectedSocialImageUrl) return "expected route-bound Twitter image";
  if (metaValue("twitter:image:alt", "name") !== ogImageAlt) return "expected Twitter image alt text to match the route-bound OG image";
  if (normalizePublicUrl(canonicalHref) !== expectedCanonical) return `expected exact canonical route ${expectedCanonical}; got ${canonicalHref || "missing"}`;
  const expectedAlternates = new Map();
  for (const candidate of localeCodes) {
    if (contentLocaleFor(candidate) !== candidate) continue;
    const tag = googleHreflangTag(candidate);
    if (!tag) continue;
    expectedAlternates.set(tag, candidate === "en"
      ? `https://internalagency.io${routeSuffix}`
      : `https://internalagency.io/${candidate}${routeSuffix}`);
  }
  if (contentLocaleFor("tr") === "tr") expectedAlternates.set("tr-TR", `https://ileriakil.com${routeSuffix}`);
  expectedAlternates.set("x-default", `https://internalagency.io${routeSuffix}`);
  const alternateTags = linkTags.filter((candidate) => attribute(candidate, "rel") === "alternate" && attribute(candidate, "hreflang"));
  const actualAlternates = new Map(alternateTags.map((candidate) => [attribute(candidate, "hreflang"), normalizePublicUrl(attribute(candidate, "href"))]));
  if (
    alternateTags.length !== expectedAlternates.size
    || actualAlternates.size !== expectedAlternates.size
    || [...expectedAlternates].some(([tag, href]) => actualAlternates.get(tag) !== href)
  ) return "hreflang inventory includes a HOLD locale or omits an approved canonical alternate";
  const robots = metaValue("robots", "name");
  if (reviewHold && !/noindex/i.test(robots)) return "review-HOLD route must publish meta robots noindex";
  if (reviewHold && /\/i18n-v2\//i.test(html)) return "review-HOLD route must not reference a locale payload";
  const bodyMarker = englishBodyMarkers[publicPath];
  if (contentLocale === "en" && bodyMarker && !html.includes(bodyMarker)) return `canonical English body marker is missing: ${bodyMarker}`;
  const structuredDataScripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let webPage = null;
  for (const match of structuredDataScripts) {
    try {
      const value = JSON.parse(match[1]);
      const nodes = Array.isArray(value?.["@graph"]) ? value["@graph"] : [value];
      webPage ??= nodes.find((node) => node?.["@type"] === "WebPage") ?? null;
    } catch {
      return "JSON-LD is not valid JSON";
    }
  }
  if (!webPage || normalizePublicUrl(webPage.url) !== expectedCanonical || webPage.inLanguage !== htmlLanguageTag(contentLocale)) {
    return "JSON-LD WebPage identity does not match the effective content language and canonical URL";
  }
  return null;
}

function publicSurfaceSafetyError(url, html) {
  const interactiveControl = html.match(/<(form|input|textarea|select|option)\b/i)?.[1];
  if (interactiveControl && pageIdentity(url).publicPath !== "/network") {
    return `public launch surface must not expose a ${interactiveControl} control before the verified activation gate`;
  }
  if (/\b(?:phantom|solflare|backpack|walletconnect)\b/i.test(html)) {
    return "public launch surface must not expose a wallet-provider integration before the verified activation gate";
  }
  return null;
}

function htmlContentTypeError(contentType) {
  if (typeof contentType !== "string" || !/^text\/html\s*(?:;|$)/i.test(contentType)) {
    return `expected an HTML document Content-Type; got ${contentType || "missing"}`;
  }
  if (!/(?:^|;)\s*charset=utf-8\s*(?:;|$)/i.test(contentType)) {
    return `expected UTF-8 HTML for reviewed-or-fallback launch copy; got ${contentType}`;
  }
  return null;
}

function xmlContentTypeError(contentType) {
  if (typeof contentType !== "string" || !/^(?:application|text)\/xml\s*(?:;|$)/i.test(contentType)) {
    return `expected an XML sitemap Content-Type; got ${contentType || "missing"}`;
  }
  return null;
}

function sitemapError(origin, xml) {
  if (!/^<\?xml\s+version="1\.0"\s+encoding="UTF-8"\?>/i.test(xml)) {
    return "expected a UTF-8 XML declaration";
  }
  if (!/<urlset\b[^>]*\bxmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/i.test(xml)) {
    return "expected a sitemap.org urlset";
  }
  const locations = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1]);
  const canonicalOrigins = [
    "https://internalagency.io",
    ...(contentLocaleFor("tr") === "tr" ? ["https://ileriakil.com"] : []),
  ];
  const canonical = canonicalOrigins.flatMap((site) => sitemapRoutes.map((route) => route === "/" ? site : `${site}${route}`));
  const localized = localeCodes
    .filter((locale) => locale !== "en" && contentLocaleFor(locale) === locale)
    .flatMap((locale) => sitemapRoutes.map((route) => `https://internalagency.io/${locale}${route === "/" ? "" : route}`));
  const expected = [...canonical, ...localized];
  const missing = expected.filter((url) => !locations.includes(url));
  const unexpected = locations.filter((url) => !expected.includes(url));
  const duplicates = locations.filter((url, index) => locations.indexOf(url) !== index);
  if (missing.length) return `missing canonical sitemap URL ${missing[0]}`;
  if (unexpected.length) return `unexpected sitemap URL ${unexpected[0]}`;
  if (duplicates.length) return `duplicate sitemap URL ${duplicates[0]}`;
  if (locations.length !== expected.length) return `expected ${expected.length} sitemap URLs; got ${locations.length}`;
  return null;
}

function robotsError(origin, body) {
  const lines = body.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const hasAllowAll = lines.some((line) => /^allow:\s*\/$/i.test(line));
  const sitemaps = lines.filter((line) => /^sitemap:/i.test(line)).map((line) => line.replace(/^sitemap:\s*/i, ""));
  const expected = [
    "https://internalagency.io/sitemap.xml",
    ...(contentLocaleFor("tr") === "tr" ? ["https://ileriakil.com/sitemap.xml"] : []),
  ];
  if (!lines.some((line) => /^user-agent:\s*\*$/i.test(line))) return "expected a wildcard robots user agent rule";
  if (!hasAllowAll) return "expected robots to allow the public launch surfaces";
  if (sitemaps.length !== expected.length || expected.some((url) => !sitemaps.includes(url))) {
    return `expected robots to declare only review-approved canonical sitemaps for ${origin}`;
  }
  return null;
}

async function checkSitemap(origin) {
  const url = `${origin}/sitemap.xml`;
  try {
    const response = await request(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.url !== url) throw new Error(`expected canonical sitemap to remain ${url}; got ${response.url}`);
    const contentTypeIssue = xmlContentTypeError(response.headers.get("content-type"));
    if (contentTypeIssue) throw new Error(contentTypeIssue);
    const issue = sitemapError(origin, await response.text());
    if (issue) throw new Error(issue);
    console.log(`OK ${response.status} ${url} (review-approved canonical launch sitemap)`);
    return true;
  } catch (error) {
    try {
      const headers = curlHeaders(url);
      const binary = process.platform === "win32" ? "curl.exe" : "curl";
      const contentTypeIssue = xmlContentTypeError(headerValue(headers, "content-type"));
      const issue = sitemapError(origin, execFileSync(binary, ["-sS", "--connect-timeout", "5", "--max-time", "12", url], { encoding: "utf8" }));
      if (headerStatus(headers) >= 200 && headerStatus(headers) < 300 && !contentTypeIssue && !issue) {
        console.log(`OK ${headerStatus(headers)} ${url} (curl fallback; review-approved canonical launch sitemap)`); return true;
      }
    } catch { /* preserve the original network error below */ }
    console.error(`FAIL ${url}: ${error.message}`); return false;
  }
}

async function checkRobots(origin) {
  const url = `${origin}/robots.txt`;
  try {
    const response = await request(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.url !== url) throw new Error(`expected canonical robots document to remain ${url}; got ${response.url}`);
    const issue = robotsError(origin, await response.text());
    if (issue) throw new Error(issue);
    console.log(`OK ${response.status} ${url} (public launch access and canonical sitemap declarations)`);
    return true;
  } catch (error) {
    try {
      const headers = curlHeaders(url);
      const binary = process.platform === "win32" ? "curl.exe" : "curl";
      const issue = robotsError(origin, execFileSync(binary, ["-sS", "--connect-timeout", "5", "--max-time", "12", url], { encoding: "utf8" }));
      if (headerStatus(headers) >= 200 && headerStatus(headers) < 300 && !issue) {
        console.log(`OK ${headerStatus(headers)} ${url} (curl fallback; public launch access and canonical sitemap declarations)`); return true;
      }
    } catch { /* preserve the original network error below */ }
    console.error(`FAIL ${url}: ${error.message}`); return false;
  }
}

function curlHeaders(url) {
  const binary = process.platform === "win32" ? "curl.exe" : "curl";
  return execFileSync(binary, ["-sS", "-I", "--connect-timeout", "5", "--max-time", "12", url], { encoding: "utf8" });
}

function headerStatus(headers) {
  return Number(headers.match(/^HTTP\/\S+\s+(\d+)/m)?.[1] ?? 0);
}

function headerValue(headers, name) {
  return headers.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1].trim() ?? "";
}

function isExpectedRedirectTarget(sourceUrl, location, expectedPath) {
  try {
    const source = new URL(sourceUrl);
    const target = new URL(location, source);
    return target.protocol === "https:"
      && target.origin === source.origin
      && target.pathname === expectedPath
      && target.search === ""
      && target.hash === "";
  } catch {
    return false;
  }
}

async function checkPage(url) {
  let lastError = new Error("public route verification did not run");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await request(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (response.url !== url) throw new Error(`expected the canonical public route to remain ${url}; got ${response.url}`);
      const contentTypeIssue = htmlContentTypeError(response.headers.get("content-type"));
      if (contentTypeIssue) throw new Error(contentTypeIssue);
      const routeLocale = pageIdentity(url).locale;
      const contentLocale = contentLocaleFor(routeLocale);
      if (response.headers.get("content-language")?.toLowerCase() !== contentLocale) {
        throw new Error(`expected Content-Language ${contentLocale}; got ${response.headers.get("content-language") ?? "missing"}`);
      }
      const hostReviewHold = new URL(url).origin === "https://ileriakil.com" && contentLocaleFor("tr") !== "tr";
      if ((contentLocale !== routeLocale || hostReviewHold) && !/noindex/i.test(response.headers.get("x-robots-tag") ?? "")) {
        throw new Error("review-HOLD route must publish X-Robots-Tag noindex");
      }
      const html = await response.text();
      const metadataIssue = metadataError(url, html);
      if (metadataIssue) throw new Error(metadataIssue);
      const safetyIssue = publicSurfaceSafetyError(url, html);
      if (safetyIssue) throw new Error(safetyIssue);
      const retryNote = attempt > 1 ? ` after ${attempt} attempts` : "";
      console.log(`OK ${response.status} ${url}${retryNote} (UTF-8 HTML, language, alternate links, social metadata, and pre-activation safety)`);
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  try {
    const status = headerStatus(curlHeaders(url));
    if (status >= 200 && status < 300) {
      const binary = process.platform === "win32" ? "curl.exe" : "curl";
      const headers = curlHeaders(url);
      const contentTypeIssue = htmlContentTypeError(headerValue(headers, "content-type"));
      const routeLocale = pageIdentity(url).locale;
      const contentLocale = contentLocaleFor(routeLocale);
      const languageIssue = headerValue(headers, "content-language").toLowerCase() !== contentLocale;
      const hostReviewHold = new URL(url).origin === "https://ileriakil.com" && contentLocaleFor("tr") !== "tr";
      const indexingIssue = (contentLocale !== routeLocale || hostReviewHold) && !/noindex/i.test(headerValue(headers, "x-robots-tag"));
      const html = execFileSync(binary, ["-sS", "--connect-timeout", "5", "--max-time", "12", url], { encoding: "utf8" });
      const metadataIssue = metadataError(url, html);
      const safetyIssue = publicSurfaceSafetyError(url, html);
      if (!contentTypeIssue && !languageIssue && !indexingIssue && !metadataIssue && !safetyIssue) {
        console.log(`OK ${status} ${url} (curl fallback; UTF-8 HTML, language, alternate links, social metadata, and pre-activation safety)`);
        return true;
      }
    }
  } catch { /* preserve the latest fetch error below */ }
  console.error(`FAIL ${url}: ${lastError.message}`);
  return false;
}

async function checkRedirect(url, expectedPath) {
  try {
    const response = await request(url, "manual");
    const location = response.headers.get("location") ?? "";
    if (response.status !== 308 || !isExpectedRedirectTarget(url, location, expectedPath)) throw new Error(`expected a same-origin HTTPS 308 to ${expectedPath}; got ${response.status} ${location}`);
    console.log(`OK 308 ${url} -> ${expectedPath}`);
    return true;
  } catch (error) {
    try {
      const headers = curlHeaders(url);
      const status = headerStatus(headers);
      const location = headerValue(headers, "location");
      if (status === 308 && isExpectedRedirectTarget(url, location, expectedPath)) { console.log(`OK 308 ${url} -> ${expectedPath} (curl fallback)`); return true; }
    } catch { /* preserve the original network error below */ }
    console.error(`FAIL ${url}: ${error.message}`); return false;
  }
}

async function runLimited(tasks) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

const results = await runLimited([
  ...pages.map((url) => () => checkPage(url)),
  ...directDocumentPages.map((url) => () => checkPage(url)),
  ...redirects.map(([url, expectedPath]) => () => checkRedirect(url, expectedPath)),
  ...publicOrigins.flatMap((origin) => [
    () => checkSitemap(origin),
    () => checkRobots(origin),
  ]),
]);
if (results.some((result) => !result)) process.exit(1);
console.log("PUBLIC ROUTE CHECK COMPLETE: both public origins enforce reviewed-or-English content identity, safe indexing/alternates, approved metadata, pre-activation safety, and canonical sitemap/robots coverage; every documented legacy redirect is reachable.");

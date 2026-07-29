import { execFileSync } from "node:child_process";

const timeoutMs = 12_000;
const concurrency = 4;

const publicOrigins = ["https://internalagency.io", "https://ileriakil.com"];
const launchRoutes = [
  "/",
  "/launch",
  "/proof",
  "/verify",
  "/signal",
  "/dossier",
  "/press",
  "/rewards",
];
const sitemapRoutes = [...launchRoutes, "/world"];
const pages = publicOrigins.flatMap((origin) => launchRoutes.map((route) => `${origin}${route}`));

const disclosureRedirects = {
  "star-ascent-whitepaper-v2": "white-dossier",
  "star-ascent-white-dossier-v2": "white-dossier",
  "iat-litepaper": "white-dossier",
  "iat-tokenomics-v1": "tokenomics",
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

function metadataError(url, html) {
  const origin = new URL(url).origin;
  const expected = origin === "https://ileriakil.com"
    ? {
      lang: "tr",
      title: "İleri Akıl — STAR ASCENT",
      description: "İleri Akıl'ın ilk kamusal bölümü: şeffaf lansman bilgileri, token açıklaması ve operatör güvenlik rehberi.",
    }
    : {
      lang: "en",
      title: "Internal Agency — STAR ASCENT",
      description: "The first public chapter of Internal Agency: transparent launch information, token disclosure, and operator safety guidance.",
    };
  const language = html.match(/<html\b[^>]*\blang="([^"]+)"/i)?.[1] ?? "";
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const metaValue = (name, kind = "property") => {
    const tag = metaTags.find((candidate) => attribute(candidate, kind) === name);
    return tag ? attribute(tag, "content") : "";
  };
  const alternateHref = (language) => {
    const tag = linkTags.find((candidate) => attribute(candidate, "rel") === "alternate" && attribute(candidate, "hreflang") === language);
    return tag ? attribute(tag, "href") : "";
  };
  const ogImageUrl = metaValue("og:image");
  if (language !== expected.lang) return `expected html lang=${expected.lang}; got ${language || "missing"}`;
  if (title !== expected.title) return `expected title ${expected.title}; got ${title || "missing"}`;
  if (metaValue("description", "name") !== expected.description) return "expected canonical bilingual meta description";
  if (ogImageUrl !== `${origin}/og-star-ascent-v1.png`) return `expected canonical OG image; got ${ogImageUrl || "missing"}`;
  if (metaValue("og:title") !== expected.title) return "expected OG title to exactly match the document title";
  if (metaValue("og:description") !== expected.description) return "expected OG description to exactly match the canonical bilingual description";
  if (metaValue("og:type") !== "website") return `expected og:type=website; got ${metaValue("og:type") || "missing"}`;
  if (metaValue("og:image:width") !== "1792" || metaValue("og:image:height") !== "1024") return "expected canonical OG image dimensions";
  if (!metaValue("og:image:alt")) return "expected non-empty OG image alt text";
  if (metaValue("twitter:card", "name") !== "summary_large_image") return "expected Twitter large-image card";
  if (metaValue("twitter:title", "name") !== expected.title) return "expected Twitter title to exactly match the document title";
  if (metaValue("twitter:description", "name") !== expected.description) return "expected Twitter description to exactly match the canonical bilingual description";
  if (metaValue("twitter:image", "name") !== `${origin}/og-star-ascent-v1.png`) return "expected canonical Twitter image";
  if (alternateHref("en") !== "https://internalagency.io") return "expected exact English alternate link to the canonical English origin";
  if (alternateHref("tr") !== "https://ileriakil.com") return "expected exact Turkish alternate link to the canonical Turkish origin";
  return null;
}

function publicSurfaceSafetyError(html) {
  const interactiveControl = html.match(/<(form|input|textarea|select|option)\b/i)?.[1];
  if (interactiveControl) return `public launch surface must not expose a ${interactiveControl} control before the verified activation gate`;
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
    return `expected UTF-8 HTML for bilingual launch copy; got ${contentType}`;
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
  const expected = publicOrigins.flatMap((site) => sitemapRoutes.map((route) => route === "/" ? site : `${site}${route}`));
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
  const expected = publicOrigins.map((site) => `${site}/sitemap.xml`);
  if (!lines.some((line) => /^user-agent:\s*\*$/i.test(line))) return "expected a wildcard robots user agent rule";
  if (!hasAllowAll) return "expected robots to allow the public launch surfaces";
  if (sitemaps.length !== expected.length || expected.some((url) => !sitemaps.includes(url))) {
    return `expected robots to declare both canonical sitemaps, including ${origin}/sitemap.xml`;
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
    console.log(`OK ${response.status} ${url} (canonical bilingual launch sitemap)`);
    return true;
  } catch (error) {
    try {
      const headers = curlHeaders(url);
      const binary = process.platform === "win32" ? "curl.exe" : "curl";
      const contentTypeIssue = xmlContentTypeError(headerValue(headers, "content-type"));
      const issue = sitemapError(origin, execFileSync(binary, ["-sS", "--connect-timeout", "5", "--max-time", "12", url], { encoding: "utf8" }));
      if (headerStatus(headers) >= 200 && headerStatus(headers) < 300 && !contentTypeIssue && !issue) {
        console.log(`OK ${headerStatus(headers)} ${url} (curl fallback; canonical bilingual launch sitemap)`); return true;
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
  try {
    const response = await request(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.url !== url) throw new Error(`expected the canonical public route to remain ${url}; got ${response.url}`);
    const contentTypeIssue = htmlContentTypeError(response.headers.get("content-type"));
    if (contentTypeIssue) throw new Error(contentTypeIssue);
    const html = await response.text();
    const metadataIssue = metadataError(url, html);
    if (metadataIssue) throw new Error(metadataIssue);
    const safetyIssue = publicSurfaceSafetyError(html);
    if (safetyIssue) throw new Error(safetyIssue);
    console.log(`OK ${response.status} ${url} (UTF-8 HTML, language, alternate links, social metadata, and pre-activation safety)`);
    return true;
  } catch (error) {
    try {
      const status = headerStatus(curlHeaders(url));
      if (status >= 200 && status < 300) {
        const binary = process.platform === "win32" ? "curl.exe" : "curl";
        const headers = curlHeaders(url);
        const contentTypeIssue = htmlContentTypeError(headerValue(headers, "content-type"));
        const html = execFileSync(binary, ["-sS", "--connect-timeout", "5", "--max-time", "12", url], { encoding: "utf8" });
        const metadataIssue = metadataError(url, html);
        const safetyIssue = publicSurfaceSafetyError(html);
        if (!contentTypeIssue && !metadataIssue && !safetyIssue) { console.log(`OK ${status} ${url} (curl fallback; UTF-8 HTML, language, alternate links, social metadata, and pre-activation safety)`); return true; }
      }
    } catch { /* preserve the original network error below */ }
    console.error(`FAIL ${url}: ${error.message}`); return false;
  }
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
console.log("PUBLIC ROUTE CHECK COMPLETE: English and Turkish launch and direct-document routes have exact language alternates, approved metadata, pre-activation safety, and canonical sitemap/robots coverage; every documented legacy redirect is reachable.");

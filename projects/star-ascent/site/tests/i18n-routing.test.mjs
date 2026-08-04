import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(globalThis.__filename);
const workerPromise = import(new URL("../dist/server/index.js", import.meta.url).href);

async function request(path = "/", headers = {}) {
  const { default: worker } = await workerPromise;
  const requestHost = headers["x-forwarded-host"] ?? headers.host ?? "internalagency.io";
  const url = new URL(path, `https://${requestHost}`);
  return worker.fetch(
    new Request(url, {
      headers: {
        accept: "text/html",
        host: url.host,
        "x-forwarded-host": url.host,
        "x-forwarded-proto": "https",
        ...headers,
      },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("country routing wins unless a saved language preference exists", async () => {
  const france = await request("/", {
    "accept-language": "en-US,en;q=0.9",
    "cf-ipcountry": "FR",
  });
  assert.equal(france.status, 302);
  assert.equal(new URL(france.headers.get("location")).pathname, "/fr");
  assert.equal(france.headers.get("cache-control"), "private, no-store");
  assert.match(france.headers.get("vary"), /CF-IPCountry/i);

  const savedEnglish = await request("/", {
    cookie: "ia_language=en",
    "cf-ipcountry": "FR",
  });
  assert.equal(savedEnglish.status, 200);
  assert.equal(savedEnglish.headers.get("content-language"), "en");

  const crawlerStyleRequest = await request("/", { "cf-ipcountry": "FR" });
  assert.equal(crawlerStyleRequest.status, 200);
  assert.equal(crawlerStyleRequest.headers.get("content-language"), "en");
});

test("every locale route returns its own indexable document identity", async () => {
  const metadata = JSON.parse(await readFile(new URL("../app/i18n/metadata.generated.json", import.meta.url), "utf8"));
  const locales = Object.keys(metadata);
  assert.equal(locales.length, 50);
  for (let start = 0; start < locales.length; start += 5) {
    await Promise.all(locales.slice(start, start + 5).map(async (locale) => {
      const path = locale === "en" ? "/future" : `/${locale}/future`;
      const response = await request(path);
      assert.equal(response.status, 200, `${locale} route status`);
      assert.equal(response.headers.get("content-language"), locale, `${locale} Content-Language`);
      const html = await response.text();
      const languageTag = locale === "zh" ? "zh-Hans" : locale === "sr" ? "sr-Cyrl" : locale;
      assert.match(html, new RegExp(`<html lang="${languageTag}"`), `${locale} HTML language`);
      assert.match(html, new RegExp(`rel="canonical" href="https:\\/\\/internalagency\\.io${path.replaceAll("/", "\\/")}"`), `${locale} canonical`);
      assert.doesNotMatch(html, /<meta[^>]+(?:noindex|nofollow)/i, `${locale} must remain indexable`);
    }));
  }
});

test("multilingual countries honor a locally appropriate browser language", async () => {
  const canada = await request("/", {
    "accept-language": "en-CA;q=0.7,fr-CA;q=1,fr;q=0.9",
    "cf-ipcountry": "CA",
  });
  assert.equal(new URL(canada.headers.get("location")).pathname, "/fr");

  const switzerland = await request("/", {
    "accept-language": "it-CH,it;q=0.9,en;q=0.7",
    "cf-ipcountry": "CH",
  });
  assert.equal(new URL(switzerland.headers.get("location")).pathname, "/it");

  const catalanSpain = await request("/", {
    "accept-language": "ca-ES,ca;q=0.9,es;q=0.8",
    "cf-ipcountry": "ES",
  });
  assert.equal(new URL(catalanSpain.headers.get("location")).pathname, "/ca");

  const rejectsZeroQuality = await request("/", {
    "accept-language": "fr;q=0,en;q=1",
    "cf-ipcountry": "FR",
  });
  assert.equal(rejectsZeroQuality.status, 200);
});

test("localized paths render canonical routes with locale metadata", async () => {
  const payloadContract = JSON.parse(
    await readFile(new URL("../app/i18n/payload-contract.json", import.meta.url), "utf8"),
  );
  const french = await request("/fr/future");
  assert.equal(french.status, 200);
  assert.equal(french.headers.get("content-language"), "fr");
  const frenchHtml = await french.text();
  assert.match(frenchHtml, /<html lang="fr" dir="ltr"/i);
  assert.match(frenchHtml, /rel="canonical" href="https:\/\/internalagency\.io\/fr\/future"/i);
  assert.match(frenchHtml, /hrefLang="es" href="https:\/\/internalagency\.io\/es\/future"/i);
  assert.match(frenchHtml, /hrefLang="x-default" href="https:\/\/internalagency\.io\/future"/i);
  assert.match(frenchHtml, /hrefLang="zh-Hans"/i);
  assert.match(frenchHtml, /hrefLang="sr-Cyrl"/i);
  const frenchHead = frenchHtml.slice(0, frenchHtml.indexOf("</head>"));
  assert.doesNotMatch(frenchHead, /hrefLang="pcm"/i);
  assert.match(frenchHtml, /href="\/pcm\/future" hrefLang="pcm" lang="pcm"/i);
  assert.equal((frenchHead.match(/rel="alternate"/g) ?? []).length, 51);
  assert.equal((frenchHead.match(/rel="canonical"/g) ?? []).length, 1);
  assert.match(frenchHtml, /"@type":"WebPage"/i);
  assert.match(frenchHtml, /"inLanguage":"fr"/i);
  const payloadPath = `/${payloadContract.assetNamespace}/${payloadContract.catalogSha256.slice(0, 16)}/fr.json`;
  assert.match(
    frenchHtml,
    new RegExp(`rel="preload" href="${payloadPath.replaceAll("/", "\\/")}" as="fetch"`, "i"),
  );
  assert.equal((frenchHtml.match(/role="menuitem"/g) ?? []).length, 50);

  const arabic = await request("/ar");
  assert.equal(arabic.status, 200);
  assert.equal(arabic.headers.get("content-language"), "ar");
  assert.match(await arabic.text(), /<html lang="ar" dir="rtl"/i);

  const pidgin = await request("/pcm/future");
  assert.equal(pidgin.status, 200);
  assert.equal(pidgin.headers.get("content-language"), "pcm");
  const pidginHtml = await pidgin.text();
  assert.match(pidginHtml, /<html lang="pcm" dir="ltr"/i);
  assert.match(pidginHtml, /rel="canonical" href="https:\/\/internalagency\.io\/pcm\/future"/i);
});

test("the Turkish host keeps Turkish ownership without collapsing other locale canonicals", async () => {
  const turkishHeaders = {
    host: "ileriakil.com",
    "x-forwarded-host": "ileriakil.com",
  };
  const metadata = JSON.parse(
    await readFile(new URL("../app/i18n/metadata.generated.json", import.meta.url), "utf8"),
  );
  const locales = Object.keys(metadata);
  assert.equal(locales.length, 50);

  for (let start = 0; start < locales.length; start += 5) {
    await Promise.all(locales.slice(start, start + 5).map(async (locale) => {
      const path = locale === "tr" ? "/network" : `/${locale}/network`;
      const canonical = locale === "tr"
        ? "https://ileriakil.com/network"
        : `https://internalagency.io${locale === "en" ? "" : `/${locale}`}/network`;
      const languageTag = locale === "zh" ? "zh-Hans" : locale === "sr" ? "sr-Cyrl" : locale;
      const response = await request(path, turkishHeaders);
      assert.equal(response.status, 200, `${locale} Turkish-host route status`);
      assert.equal(response.headers.get("content-language"), locale, `${locale} Content-Language`);
      const html = await response.text();
      const head = html.slice(0, html.indexOf("</head>"));
      assert.match(html, new RegExp(`<html lang="${languageTag}"`), `${locale} HTML language`);
      assert.ok(head.includes(`rel="canonical" href="${canonical}"`), `${locale} canonical ownership`);
      assert.ok(head.includes(`property="og:url" content="${canonical}"`), `${locale} Open Graph ownership`);
      assert.ok(html.includes(`"url":"${canonical}"`), `${locale} structured-data ownership`);
      assert.equal((head.match(/rel="canonical"/g) ?? []).length, 1, `${locale} canonical count`);
    }));
  }
});

test("route-specific SEO copy and structured data are localized", async () => {
  const [metadata, routeSeo] = await Promise.all([
    readFile(new URL("../app/i18n/metadata.generated.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/i18n/route-seo.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const response = await request("/fr/launch");
  assert.equal(response.status, 200);
  const html = await response.text();
  const expectedTitle = metadata.fr.seo[routeSeo["/launch"].title];
  const expectedDescription = metadata.fr.seo[routeSeo["/launch"].description];
  assert.notEqual(expectedTitle, routeSeo["/launch"].title);
  assert.ok(html.includes(expectedTitle));
  assert.ok(html.includes(expectedDescription));
  assert.match(html, /"@type":"WebPage"/);
  assert.match(html, /"isPartOf":\{"@id":"https:\/\/internalagency\.io\/fr#website"\}/);

  const dossierRecord = await request("/fr/dossier/read/white-dossier");
  assert.equal(dossierRecord.status, 200);
  const dossierHtml = await dossierRecord.text();
  assert.ok(dossierHtml.includes(metadata.fr.seo[routeSeo["/dossier/read/white-dossier"].title]));
  assert.ok(dossierHtml.includes(metadata.fr.seo[routeSeo["/dossier/read/white-dossier"].description]));

  for (const publicPath of ["/network", "/tokenomics"]) {
    const localized = await request(`/fr${publicPath}`);
    assert.equal(localized.status, 200, `${publicPath} localized route status`);
    const localizedHtml = await localized.text();
    const localizedTitle = metadata.fr.seo[routeSeo[publicPath].title];
    const localizedDescription = metadata.fr.seo[routeSeo[publicPath].description];
    assert.notEqual(localizedTitle, routeSeo[publicPath].title, `${publicPath} must not reuse its English title`);
    assert.ok(localizedHtml.includes(localizedTitle), `${publicPath} is missing its localized title`);
    assert.ok(localizedHtml.includes(localizedDescription), `${publicPath} is missing its localized description`);
  }
});

test("the signing ceremony tool is excluded from search indexes", async () => {
  for (const path of ["/mint", "/fr/mint"]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
    assert.match(await response.text(), /<meta[^>]+name="robots"[^>]+content="noindex, nofollow, noarchive"/i);
  }
});

test("the sitemap publishes equivalent-route alternates for every locale", async () => {
  const sitemapSource = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  const routeCount = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/g)].length;
  const sitemap = await request("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  assert.match(xml, /https:\/\/internalagency\.io\/es\/future\/predictive-engine/);
  assert.match(xml, /https:\/\/internalagency\.io\/pcm\/future\/casino/);
  assert.match(xml, /https:\/\/internalagency\.io\/fr\/network/);
  assert.match(xml, /https:\/\/internalagency\.io\/ar\/tokenomics/);
  assert.match(xml, /hreflang="x-default"/i);
  assert.match(xml, /hreflang="zh-Hans"/i);
  assert.doesNotMatch(xml, /hreflang="pcm"/i);
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expectedLocationCount = routeCount * 51; // two canonical hosts plus 49 non-English locale paths
  assert.equal(locations.length, expectedLocationCount);
  assert.equal(new Set(locations).size, expectedLocationCount);
  assert.ok(Buffer.byteLength(xml, "utf8") < 50 * 1024 * 1024, "sitemap must stay below Google's 50 MB limit");
});

test("robots publishes both canonical sitemap endpoints", async () => {
  const response = await request("/robots.txt");
  assert.equal(response.status, 200);
  const robots = await response.text();
  assert.match(robots, /Sitemap: https:\/\/internalagency\.io\/sitemap\.xml/i);
  assert.match(robots, /Sitemap: https:\/\/ileriakil\.com\/sitemap\.xml/i);
});

test("country defaults cover every sovereign state in Europe and the Americas", async () => {
  const source = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const countryMap = source.match(/const countryLocale:[\s\S]*?= \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const mapped = new Set([...countryMap.matchAll(/\b([A-Z]{2}):/g)].map((match) => match[1]));
  const europe = [
    "AL", "AD", "AM", "AT", "AZ", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "GE", "DE", "GR", "HU", "IS", "IE", "IT", "KZ", "XK", "LV", "LI", "LT", "LU", "MT", "MD", "MC", "ME",
    "NL", "MK", "NO", "PL", "PT", "RO", "RU", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "TR", "UA", "GB", "VA",
  ];
  const americas = [
    "AG", "AR", "BS", "BB", "BZ", "BO", "BR", "CA", "CL", "CO", "CR", "CU", "DM", "DO", "EC", "SV", "GD",
    "GT", "GY", "HT", "HN", "JM", "MX", "NI", "PA", "PY", "PE", "KN", "LC", "VC", "SR", "TT", "US", "UY", "VE",
  ];
  assert.deepEqual([...europe, ...americas].filter((country) => !mapped.has(country)), []);
});

test("the locale runtime stays static, prompts for English, and ships one locale payload", async () => {
  const [runtime, layout, worker, styles, playwright] = await Promise.all([
    readFile(new URL("../app/i18n/LocaleRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../playwright.config.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /window\.setTimeout\(\(\) => setShowPrompt\(false\), 15_000\)/);
  assert.match(runtime, /ia_language=en/);
  assert.match(runtime, /returnToEnglish/);
  assert.doesNotMatch(runtime, /import masterMessages/);
  assert.match(runtime, /fetch\(localePayloadPath\(locale\)/);
  assert.match(runtime, /payload\.catalogSha256 !== localePayloadContract\.catalogSha256/);
  assert.match(runtime, /dataset\.localeError = "payload-contract-failed"/);
  assert.doesNotMatch(runtime, /revealFallback/);
  assert.doesNotMatch(runtime, /\.catch\(\(\) => \{\s*if \(active\) document\.documentElement\.dataset\.localeReady = "true"/);
  assert.doesNotMatch(layout, /messages\.json/);
  assert.match(layout, /data-locale-ready=\{localeReady \? "true" : "false"\}/);
  assert.match(layout, /promptCopy=\{promptCopy\}/);
  assert.match(layout, /"@context": "https:\/\/schema\.org"/);
  assert.match(layout, /"x-default"/);
  assert.match(worker, /acceptedLanguages\.length\) return "en"/);
  assert.match(playwright, /command: "npm run compile:i18n && node .*vinext.* dev -p 4176"/);
  assert.doesNotMatch(styles, /data-locale-ready="false"[^}]*opacity:0/);
});

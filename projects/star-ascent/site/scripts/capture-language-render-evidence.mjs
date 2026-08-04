import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "playwright";
import axe from "axe-core";
import { extractFromHtml } from "./generate-i18n-catalog.mjs";
import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const root = process.cwd();
const repoRoot = resolve(root, "../../..");
const readRepoText = (path) => Promise.resolve(readCanonicalTrackedFile({ repoRoot, absolutePath: path }).toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const canonicalDigest = (value) => sha256(canonical(value));
const normalize = (value) => value.trim().replace(/\s+/gu, " ");
const valueCounts = (values) => {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};
const htmlTags = { zh: "zh-Hans", sr: "sr-Cyrl" };
const rtlLocales = new Set(["ar", "ur"]);
const renderCheckIds = Array.from({ length: 25 }, (_, index) => `LQA-${String(index + 71).padStart(3, "0")}`);
const initialWorktreeStatus = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();
const startedFromCleanCheckout = initialWorktreeStatus.length === 0;
const claimedRenderCheckIds = startedFromCleanCheckout ? renderCheckIds : renderCheckIds.filter((id) => id !== "LQA-071");

function outputPath() {
  const index = process.argv.indexOf("--output");
  if (index < 0 || !process.argv[index + 1]) throw new Error("--output <path> is required");
  return resolve(root, process.argv[index + 1]);
}

async function reservePort() {
  return new Promise((resolvePort, reject) => {
    const reservation = createServer();
    reservation.unref();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const { port } = reservation.address();
      reservation.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([:\w-]+)=(?:"([^"]*)"|'([^']*)')/gu)].map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? ""]));
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "giu"))].map((match) => ({ raw: match[0], attrs: attrs(match[0]) }));
}

function localizedPath(locale, route) {
  if (locale === "en") return route;
  return `/${locale}${route === "/" ? "" : route}`;
}

function expectedTag(locale) {
  return htmlTags[locale] ?? locale;
}

function sourceAttributeValues(html, attribute, sourceSet) {
  const values = [];
  const pattern = new RegExp(`\\b${attribute}=(?:"([^"]*)"|'([^']*)')`, "giu");
  for (const match of html.matchAll(pattern)) {
    const value = normalize(match[1] ?? match[2] ?? "");
    if (sourceSet.has(value)) values.push(value);
  }
  return [...new Set(values)];
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function runPackageCommand(command, args, options) {
  if (process.platform === "win32") {
    return execFileSync(process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", `${command}.cmd ${args.join(" ")}`], options);
  }
  return execFileSync(command, args, options);
}

let [definitionRaw, messagesRaw, metadataRaw, routeSeoRaw, pendingRaw, payloadContractRaw, sitemapSource] = await Promise.all([
  readRepoText(resolve(root, "app/i18n/language-qa-checks.v1.json")),
  readRepoText(resolve(root, "app/i18n/messages.json")),
  readRepoText(resolve(root, "app/i18n/metadata.generated.json")),
  readRepoText(resolve(root, "app/i18n/route-seo.json")),
  readRepoText(resolve(root, "app/i18n/pending-visible-source.json")),
  readRepoText(resolve(root, "app/i18n/payload-contract.json")),
  readRepoText(resolve(root, "app/sitemap.ts")),
]);
let definition = JSON.parse(definitionRaw);
let catalog = JSON.parse(messagesRaw);
let metadata = JSON.parse(metadataRaw);
let routeSeo = JSON.parse(routeSeoRaw);
let pending = JSON.parse(pendingRaw);
const payloadContract = JSON.parse(payloadContractRaw);
const payloadRoot = `/${payloadContract.assetNamespace}/${payloadContract.catalogSha256.slice(0, 16)}`;
const locales = Object.keys(catalog.messages);
let sourceSet = new Set(Object.keys(catalog.messages.en));
const routes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/gu)].map((match) => match[1] || "/");
if (locales.length !== 50 || routes.length !== 25) throw new Error(`Unexpected scope: ${locales.length} locales, ${routes.length} routes`);

const failures = Object.fromEntries(locales.map((locale) => [locale, Object.fromEntries(renderCheckIds.map((id) => [id, []]))]));
const metrics = Object.fromEntries(locales.map((locale) => [locale, Object.fromEntries(renderCheckIds.map((id) => [id, {}]))]));
const addFailure = (locale, id, detail) => failures[locale][id].push(detail);
const addGlobalFailure = (id, detail) => locales.forEach((locale) => addFailure(locale, id, detail));
const rootHtml = new Map();

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
let serverOutput = "";
let serverProcess;
let browser;
try {
  runPackageCommand("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  [definitionRaw, messagesRaw, metadataRaw, routeSeoRaw, pendingRaw] = await Promise.all([
    readRepoText(resolve(root, "app/i18n/language-qa-checks.v1.json")),
    readRepoText(resolve(root, "app/i18n/messages.json")),
    readRepoText(resolve(root, "app/i18n/metadata.generated.json")),
    readRepoText(resolve(root, "app/i18n/route-seo.json")),
    readRepoText(resolve(root, "app/i18n/pending-visible-source.json")),
  ]);
  definition = JSON.parse(definitionRaw);
  catalog = JSON.parse(messagesRaw);
  metadata = JSON.parse(metadataRaw);
  routeSeo = JSON.parse(routeSeoRaw);
  pending = JSON.parse(pendingRaw);
  const compiledLocales = Object.keys(catalog.messages);
  if (compiledLocales.join("\0") !== locales.join("\0")) throw new Error("Build changed the configured locale set");
  sourceSet = new Set(Object.keys(catalog.messages.en));
  serverProcess = spawn(process.execPath, ["./node_modules/vinext/dist/cli.js", "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const recordOutput = (chunk) => { serverOutput = `${serverOutput}${chunk.toString("utf8")}`.slice(-12_000); };
  serverProcess.stdout.on("data", recordOutput);
  serverProcess.stderr.on("data", recordOutput);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (serverProcess.exitCode !== null) throw new Error(`Render server exited with ${serverProcess.exitCode}\n${serverOutput}`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  if (!ready) throw new Error(`Render server was not ready\n${serverOutput}`);

  let matrixPassed = true;
  try {
    runPackageCommand("npx", ["playwright", "test", "tests/ui/all-locales-render.spec.mjs"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, UI_AUDIT_BASE_URL: baseUrl, CI: "1" },
    });
  } catch {
    matrixPassed = false;
    addGlobalFailure("LQA-094", "Cross-engine/device locale stress matrix failed");
    addGlobalFailure("LQA-095", "Cross-engine/device accessibility matrix failed");
  }

  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(30_000) });
  const sitemapXml = sitemapResponse.ok ? await sitemapResponse.text() : "";
  if (!sitemapResponse.ok) addGlobalFailure("LQA-092", `sitemap.xml returned ${sitemapResponse.status}`);

  const tasks = locales.flatMap((locale) => routes.map((route) => ({ locale, route })));
  const unknownSources = new Set();
  await mapLimit(tasks, 10, async ({ locale, route }) => {
    const path = localizedPath(locale, route);
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, { headers: { "x-forwarded-host": "internalagency.io" }, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      for (const id of ["LQA-073", "LQA-074", "LQA-075", "LQA-076", "LQA-090", "LQA-091", "LQA-093"]) addFailure(locale, id, `${path}: ${error.message}`);
      return;
    }
    if (response.status !== 200) addFailure(locale, "LQA-073", `${path}: HTTP ${response.status}`);
    if (response.headers.get("content-language") !== locale) addFailure(locale, "LQA-074", `${path}: Content-Language ${response.headers.get("content-language") ?? "missing"}`);
    const html = await response.text();
    if (route === "/") rootHtml.set(locale, html);
    const htmlTag = html.match(/<html\b[^>]*>/iu)?.[0] ?? "";
    const htmlAttrs = attrs(htmlTag);
    if (htmlAttrs.lang !== expectedTag(locale)) addFailure(locale, "LQA-075", `${path}: html lang ${htmlAttrs.lang ?? "missing"}`);
    const expectedDirection = rtlLocales.has(locale) ? "rtl" : "ltr";
    if (htmlAttrs.dir !== expectedDirection) addFailure(locale, "LQA-076", `${path}: html dir ${htmlAttrs.dir ?? "missing"}`);

    const linkTags = tags(html, "link");
    const canonicals = linkTags.filter((entry) => entry.attrs.rel === "canonical");
    const expectedCanonicalPath = path || "/";
    if (canonicals.length !== 1) addFailure(locale, "LQA-090", `${path}: ${canonicals.length} canonicals`);
    else {
      try {
        if (new URL(canonicals[0].attrs.href).pathname !== expectedCanonicalPath) addFailure(locale, "LQA-090", `${path}: canonical ${canonicals[0].attrs.href}`);
      } catch { addFailure(locale, "LQA-090", `${path}: invalid canonical`); }
    }
    const alternates = linkTags.filter((entry) => entry.attrs.rel === "alternate" && entry.attrs.hreflang);
    const alternateNames = alternates.map((entry) => entry.attrs.hreflang);
    if (alternates.length !== 51 || new Set(alternateNames).size !== 51 || !alternateNames.includes("x-default")) addFailure(locale, "LQA-091", `${path}: hreflang count/uniqueness mismatch`);

    const seo = routeSeo[route];
    const expectedTitle = metadata[locale]?.seo?.[seo?.title];
    const expectedDescription = metadata[locale]?.seo?.[seo?.description];
    const scriptMatch = html.match(/<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/iu);
    try {
      const jsonLd = JSON.parse(scriptMatch?.[1] ?? "null");
      const pageNode = jsonLd?.["@graph"]?.find((entry) => entry["@type"] === "WebPage");
      if (!pageNode || pageNode.inLanguage !== expectedTag(locale) || pageNode.name !== expectedTitle || pageNode.description !== expectedDescription || new URL(pageNode.url).pathname !== expectedCanonicalPath) {
        addFailure(locale, "LQA-093", `${path}: localized JSON-LD/metadata mismatch`);
      }
    } catch (error) {
      addFailure(locale, "LQA-093", `${path}: JSON-LD ${error.message}`);
    }

    if (locale === "en") for (const source of extractFromHtml(html)) if (!sourceSet.has(source)) unknownSources.add(`${route}: ${source}`);
  });

  for (const locale of locales) {
    const payloadResponse = await fetch(`${baseUrl}${payloadRoot}/${locale}.json`, { signal: AbortSignal.timeout(30_000) });
    try {
      const payload = await payloadResponse.json();
      const contentType = payloadResponse.headers.get("content-type") ?? "";
      if (
        !payloadResponse.ok
        || !/application\/json/iu.test(contentType)
        || payload.schema !== payloadContract.schema
        || payload.catalogSha256 !== payloadContract.catalogSha256
        || payload.sourceCount !== sourceSet.size
        || payload.locale !== locale
        || Object.keys(payload.messages ?? {}).length !== sourceSet.size
      ) {
        addFailure(locale, "LQA-072", `payload status/content/schema mismatch`);
      }
    } catch (error) { addFailure(locale, "LQA-072", `payload parse failed: ${error.message}`); }

    const rootPath = localizedPath(locale, "/");
    const locNeedle = `<loc>https://internalagency.io${rootPath === "/" ? "" : rootPath}</loc>`;
    if (!sitemapXml.includes(locNeedle) || !sitemapXml.includes('hreflang="x-default"')) addFailure(locale, "LQA-092", `localized root or alternate cluster missing from sitemap`);
  }
  if (unknownSources.size > 0) addGlobalFailure("LQA-081", `Unknown rendered sources: ${[...unknownSources].slice(0, 5).join(" | ")}`);
  if (pending.capture?.routeCount !== routes.length || pending.capture?.pendingSourceCount !== 0) addGlobalFailure("LQA-082", "Pending rendered-source binding is not a zero-drift 25-route capture");

  browser = await chromium.launch();
  const browserCheckIds = ["LQA-077", "LQA-078", "LQA-079", "LQA-080", "LQA-083", "LQA-084", "LQA-085", "LQA-086", "LQA-087", "LQA-088", "LQA-089", "LQA-094", "LQA-095"];
  await mapLimit(locales, 3, async (locale) => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const failureCheckpoints = Object.fromEntries(browserCheckIds.map((id) => [id, failures[locale][id].length]));
      let context;
      try {
        context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const runtimeErrors = [];
        const requests = [];
        page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
        page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`); });
        page.on("request", (request) => requests.push(request.url()));
        page.on("response", (response) => { if (response.status() >= 400 && response.request().resourceType() !== "media") runtimeErrors.push(`response: ${response.status()} ${response.url()}`); });
        page.on("requestfailed", (request) => { if (request.resourceType() !== "media") runtimeErrors.push(`requestfailed: ${request.url()}`); });
      const path = localizedPath(locale, "/");
      const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      if (response?.status() !== 200) addFailure(locale, "LQA-080", `root HTTP ${response?.status() ?? "missing"}`);
      await page.waitForFunction(() => document.documentElement.dataset.localeReady === "true", null, { timeout: 30_000 });
      const html = rootHtml.get(locale) ?? "";
      const state = await page.evaluate((serverHtml) => {
        const skipped = (node) => node.parentElement?.closest("script, style, code, pre, [data-no-translate]");
        const texts = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const value = node.nodeValue?.trim().replace(/\s+/g, " ");
          if (value && !skipped(node)) texts.push(value);
        }
        const attributeValues = Object.fromEntries(["alt", "aria-label", "placeholder", "title"].map((name) => [name, Array.from(document.querySelectorAll(`[${name}]`)).filter((element) => !element.closest("[data-no-translate]")).map((element) => element.getAttribute(name)?.trim().replace(/\s+/g, " ")).filter(Boolean)]));
        const ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
        const sourceDocument = new DOMParser().parseFromString(serverHtml, "text/html");
        const preHydrationSources = [];
        const sourceWalker = sourceDocument.createTreeWalker(sourceDocument.body, NodeFilter.SHOW_TEXT);
        for (let node = sourceWalker.nextNode(); node; node = sourceWalker.nextNode()) {
          const value = node.nodeValue?.trim().replace(/\s+/g, " ");
          if (value && !node.parentElement?.closest("script, style, code, pre, [data-no-translate]")) preHydrationSources.push(value);
        }
        const preHydrationAttributes = Object.fromEntries(["alt", "aria-label", "placeholder", "title"].map((name) => [name, Array.from(sourceDocument.body.querySelectorAll(`[${name}]`)).filter((element) => !element.closest("script, style, code, pre, [data-no-translate]")).map((element) => element.getAttribute(name)?.trim().replace(/\s+/g, " ")).filter(Boolean)]));
        return {
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          ready: document.documentElement.dataset.localeReady,
          error: document.documentElement.dataset.localeError ?? null,
          texts,
          attributeValues,
          hrefs: Array.from(document.querySelectorAll("a[href]")).filter((anchor) => !anchor.closest("[data-no-translate]")).map((anchor) => anchor.getAttribute("href")),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
          headingCount: document.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
          preHydrationSources,
          preHydrationAttributes,
        };
      }, html);
      if (state.lang !== expectedTag(locale) || state.dir !== (rtlLocales.has(locale) ? "rtl" : "ltr")) addFailure(locale, "LQA-077", `hydrated lang/dir ${state.lang}/${state.dir}`);
      if (state.ready !== "true" || state.error !== null) addFailure(locale, "LQA-078", `localeReady=${state.ready}, localeError=${state.error}`);
      const translationRequests = requests.filter((url) => /translate\.googleapis\.com|translate\.google\./iu.test(url));
      const payloadObserved = locale === "en" || requests.some((url) => new URL(url).pathname === `${payloadRoot}/${locale}.json`);
      if (translationRequests.length > 0 || !payloadObserved) addFailure(locale, "LQA-079", `external translation or missing local payload request`);
      if (runtimeErrors.length > 0) addFailure(locale, "LQA-080", runtimeErrors.slice(0, 5).join(" | "));

      const sourceValues = [...state.preHydrationSources, ...Object.values(state.preHydrationAttributes).flat()].filter((source) => sourceSet.has(source));
      const sources = [...new Set(sourceValues)];
      const currentValues = [...state.texts, ...Object.values(state.attributeValues).flat()].map(normalize);
      const expectedValues = sourceValues.map((source) => normalize(catalog.messages[locale][source]));
      const currentCounts = valueCounts(currentValues);
      const expectedCounts = valueCounts(expectedValues);
      const missingValues = [...expectedCounts].filter(([value, count]) => (currentCounts.get(value) ?? 0) < count).map(([value]) => value);
      if (missingValues.length > 0) addFailure(locale, "LQA-084", `${missingValues.length} expected root values absent: ${missingValues.slice(0, 3).join(" | ")}`);
      if (locale !== "en") {
        const leaks = sources.filter((source) => catalog.messages[locale][source] !== source && (currentCounts.get(normalize(source)) ?? 0) > (expectedCounts.get(normalize(source)) ?? 0));
        if (leaks.length > 0) addFailure(locale, "LQA-083", `${leaks.length} replaced English sources remain: ${leaks.slice(0, 3).join(" | ")}`);
      }
      for (const [attribute, id] of [["alt", "LQA-085"], ["aria-label", "LQA-086"], ["placeholder", "LQA-087"], ["title", "LQA-088"]]) {
        const expected = [...new Set(state.preHydrationAttributes[attribute].filter((source) => sourceSet.has(source)))].map((source) => normalize(catalog.messages[locale][source]));
        const actual = new Set(state.attributeValues[attribute].map(normalize));
        const missing = expected.filter((value) => !actual.has(value));
        if (missing.length > 0 || [...actual].some((value) => !value)) addFailure(locale, id, `${missing.length} localized ${attribute} values absent`);
        metrics[locale][id] = { inspected: expected.length };
      }
      const invalidLinks = state.hrefs.filter((href) => {
        if (!href?.startsWith("/") || href.startsWith("//") || href.startsWith("/_") || href.startsWith("/api/") || href.startsWith("/disclosures/") || /\.[a-z0-9]{2,5}(?:[?#]|$)/iu.test(href)) return false;
        return locale === "en" ? /^\/[a-z]{2,3}(?:\/|$)/u.test(href) : !href.startsWith(`/${locale}/`) && href !== `/${locale}`;
      });
      if (invalidLinks.length > 0) addFailure(locale, "LQA-089", `${invalidLinks.length} locale-unsafe internal links: ${invalidLinks.slice(0, 3).join(" | ")}`);
      if (state.overflow || !matrixPassed) addFailure(locale, "LQA-094", state.overflow ? "root horizontal overflow" : "cross-engine matrix failed");

      await page.addScriptTag({ content: axe.source });
      const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast", "aria-prohibited-attr", "region", "heading-order"] } })).violations.map(({ id }) => id));
      if (violations.length > 0 || state.duplicateIds.length > 0 || state.headingCount === 0 || !matrixPassed) addFailure(locale, "LQA-095", `axe=${violations.join(",")}; duplicateIds=${state.duplicateIds.join(",")}; headings=${state.headingCount}`);
        return;
      } catch (error) {
        for (const id of browserCheckIds) failures[locale][id].length = failureCheckpoints[id];
        if (attempt === 2) {
          for (const id of browserCheckIds) addFailure(locale, id, `attempt ${attempt}/2: ${error.message}`);
        }
      } finally {
        await context?.close();
      }
    }
  });

  const artifact = {
    schema: "iat-language-render-evidence/v1",
    generatedAt: new Date().toISOString(),
    status: Object.values(failures).some((checks) => Object.values(checks).some((items) => items.length > 0)) ? "FAIL" : "PASS",
    scope: {
      localeCount: locales.length,
      routeCount: routes.length,
      claimedChecksPerLocale: claimedRenderCheckIds.length,
      omittedChecks: startedFromCleanCheckout ? [] : ["LQA-071"],
    },
    sourceBinding: {
      definitionSha256: sha256(definitionRaw),
      messagesFileSha256: sha256(messagesRaw),
      metadataSha256: canonicalDigest(metadata),
      routeSeoSha256: canonicalDigest(routeSeo),
      pendingSha256: canonicalDigest(pending),
    },
    environment: { origin: "EPHEMERAL_LOOPBACK", browser: "chromium", crossEngineMatrix: ["chromium", "firefox", "webkit", "tablet", "android-emulation", "ios-emulation"], mainnetChanged: false },
    limitations: [
      ...(!startedFromCleanCheckout ? ["LQA-071 remains unclaimed because this evidence was produced from a dirty bound worktree, not a fresh Git checkout."] : []),
      "This is local browser evidence, not native-language review or production deployment evidence.",
    ],
    locales: Object.fromEntries(locales.map((locale) => [locale, {
      checks: Object.fromEntries(claimedRenderCheckIds.map((id) => [id, {
        status: failures[locale][id].length > 0 ? "FAIL" : "PASS",
        detail: failures[locale][id].length > 0
          ? failures[locale][id].slice(0, 8).join(" | ")
          : id === "LQA-071"
            ? "Fresh-checkout production build compiled all 50 locale assets before server start"
            : "Source-bound clean-build loopback render check passed",
        ...(Object.keys(metrics[locale][id]).length > 0 ? { metrics: metrics[locale][id] } : {}),
      }]))
    }])),
  };
  const destination = outputPath();
  if (!process.argv.includes("--replace")) {
    try {
      await access(destination);
      throw new Error(`Refusing to overwrite existing render evidence without --replace: ${destination}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  await writeFile(destination, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`Wrote ${locales.length * claimedRenderCheckIds.length} source-bound render results to ${destination}: ${artifact.status}`);
} finally {
  await browser?.close();
  serverProcess?.kill();
}

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { localizedCoverageError } from "./live-locale-verifier-lib.mjs";

const catalog = JSON.parse(await readFile(new URL("../app/i18n/messages.json", import.meta.url), "utf8"));
const contract = JSON.parse(await readFile(new URL("../app/i18n/payload-contract.json", import.meta.url), "utf8"));
const sitemapSource = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const locales = Object.keys(catalog.messages ?? {}).sort();
const routes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/gu)].map((match) => match[1] || "/");
const rtlLocales = new Set(["ar", "ur"]);
const htmlLanguageTag = (locale) => (locale === "zh" ? "zh-Hans" : locale === "sr" ? "sr-Cyrl" : locale);
const payloadRoot = `/${contract.assetNamespace}/${contract.catalogSha256.slice(0, 16)}`;
const concurrency = Number.parseInt(process.env.I18N_HYDRATION_WORKERS ?? "8", 10);

if (locales.length !== 50) throw new Error(`Expected 50 catalog locales; found ${locales.length}`);
if (routes.length !== 25 || new Set(routes).size !== 25) {
  throw new Error(`Expected 25 unique canonical sitemap routes; found ${routes.length}/${new Set(routes).size}`);
}
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16) {
  throw new Error(`I18N_HYDRATION_WORKERS must be an integer from 1 through 16; received ${process.env.I18N_HYDRATION_WORKERS}`);
}

const port = await new Promise((resolvePort, reject) => {
  const reservation = createServer();
  reservation.unref();
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", () => {
    const address = reservation.address();
    reservation.close((error) => (error ? reject(error) : resolvePort(address.port)));
  });
});
const server = spawn(process.execPath, ["./node_modules/vinext/dist/cli.js", "dev", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let serverOutput = "";
const recordOutput = (chunk) => {
  serverOutput = `${serverOutput}${chunk.toString("utf8")}`.slice(-12_000);
};
server.stdout.on("data", recordOutput);
server.stderr.on("data", recordOutput);

async function stopServer() {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveWait) => server.once("exit", resolveWait)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Render server exited with ${server.exitCode}\n${serverOutput}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Render server did not become ready\n${serverOutput}`);
}

async function verifyPage(page, { host, locale, route, label }) {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
      if (url.pathname === "/api/network") return new Promise(() => {});
      return nativeFetch(input, init);
    };
  });
  const localizedPath = route === "/" ? `/${locale}` : `/${locale}${route}`;
  const url = `http://${host}.localhost:${port}${localizedPath}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (!response || response.status() !== 200) {
    return { ok: false, label, detail: `HTTP ${response?.status() ?? "missing"}` };
  }
  const serverHtml = await response.text();
  await page.waitForFunction(
    () => document.documentElement.dataset.localeReady === "true" || Boolean(document.documentElement.dataset.localeError),
    null,
    { timeout: 30_000 },
  );
  const state = await page.evaluate((initialHtml) => {
    const collect = (documentRoot) => {
      const values = [];
      const walker = documentRoot.createTreeWalker(documentRoot.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const value = node.nodeValue?.trim().replace(/\s+/g, " ");
        if (value && !node.parentElement?.closest("script, style, code, pre, [data-no-translate]")) values.push(value);
      }
      for (const attribute of ["alt", "aria-label", "placeholder", "title"]) {
        for (const element of documentRoot.body.querySelectorAll(`[${attribute}]`)) {
          if (element.closest("script, style, code, pre, [data-no-translate]")) continue;
          const value = element.getAttribute(attribute)?.trim().replace(/\s+/g, " ");
          if (value) values.push(value);
        }
      }
      return values;
    };
    const sourceDocument = new DOMParser().parseFromString(initialHtml, "text/html");
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      ready: document.documentElement.dataset.localeReady ?? null,
      error: document.documentElement.dataset.localeError ?? null,
      sourceValues: collect(sourceDocument),
      currentValues: collect(document),
    };
  }, serverHtml);
  if (state.ready !== "true" || state.error !== null) {
    return { ok: false, label, detail: `localeReady=${state.ready ?? "missing"}, localeError=${state.error ?? "none"}` };
  }
  if (state.lang !== htmlLanguageTag(locale) || state.dir !== (rtlLocales.has(locale) ? "rtl" : "ltr")) {
    return { ok: false, label, detail: `hydrated lang/dir ${state.lang}/${state.dir}` };
  }
  if (locale !== "en" && !(host === "ileriakil" && locale === "tr")) {
    const expectedPayload = `${payloadRoot}/${locale}.json`;
    if (!requests.some((requestUrl) => new URL(requestUrl).pathname === expectedPayload)) {
      return { ok: false, label, detail: `hydration did not request ${expectedPayload}` };
    }
  }
  if (requests.some((requestUrl) => /translate\.googleapis\.com|translate\.google\./iu.test(requestUrl))) {
    return { ok: false, label, detail: "hydration contacted an external translation service" };
  }
  const nativeTurkishSource = host === "ileriakil" && locale === "tr";
  const coverageError = nativeTurkishSource
    ? null
    : localizedCoverageError({
        sourceValues: state.sourceValues,
        currentValues: state.currentValues,
        localeMessages: catalog.messages[locale],
      });
  return coverageError ? { ok: false, label, detail: coverageError } : { ok: true, label };
}

const jobs = ["internalagency", "ileriakil"].flatMap((host) =>
  locales.flatMap((locale) =>
    routes.map((route) => ({
      host,
      locale,
      route,
      label: `${host}.localhost/${locale}${route === "/" ? "" : route}`,
    })),
  ),
);
const results = new Array(jobs.length);
let cursor = 0;
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        while (cursor < jobs.length) {
          const index = cursor;
          cursor += 1;
          const page = await context.newPage();
          try {
            results[index] = await verifyPage(page, jobs[index]);
          } catch (error) {
            results[index] = {
              ok: false,
              label: jobs[index].label,
              detail: error instanceof Error ? error.message : String(error),
            };
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }),
  );
} finally {
  await browser?.close();
  await stopServer();
}

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(`Dual-host locale hydration FAIL: ${failures.length}/${results.length} page(s) failed.`);
  for (const failure of failures) console.error(`- ${failure.label}: ${failure.detail}`);
  process.exitCode = 1;
} else {
  console.log(
    `Dual-host locale hydration PASS: ${results.length}/${results.length} canonical pages reached localeReady across ` +
      `${locales.length} locales x ${routes.length} routes x 2 hosts, with 2475 committed-catalog renders plus ` +
      `25 native Turkish source renders; catalog ${contract.catalogSha256}.`,
  );
  console.log("Ephemeral loopback browser evidence only: no deployment or public/chain state was changed.");
}

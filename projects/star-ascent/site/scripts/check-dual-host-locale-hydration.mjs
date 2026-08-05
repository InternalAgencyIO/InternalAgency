import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { chromium, firefox, webkit } from "playwright";
import {
  createHydrationPlans,
  engineConcurrencyCaps,
  hydrationOptionsFromEnvironment,
} from "./dual-host-locale-hydration-plan.mjs";
import { localizedCoverageError } from "./live-locale-verifier-lib.mjs";

const catalog = JSON.parse(await readFile(new URL("../app/i18n/messages.json", import.meta.url), "utf8"));
const contract = JSON.parse(await readFile(new URL("../app/i18n/payload-contract.json", import.meta.url), "utf8"));
const sitemapSource = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const locales = Object.keys(catalog.messages ?? {}).sort();
const routes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/gu)].map((match) => match[1] || "/");
const rtlLocales = new Set(["ar", "ur"]);
const htmlLanguageTag = (locale) => (locale === "zh" ? "zh-Hans" : locale === "sr" ? "sr-Cyrl" : locale);
const payloadRoot = `/${contract.assetNamespace}/${contract.catalogSha256.slice(0, 16)}`;
const browserTypes = { chromium, firefox, webkit };
const options = hydrationOptionsFromEnvironment(process.env);
const { concurrency, maxFailures, engineNames } = options;
const enginePlans = createHydrationPlans({ locales, routes, ...options });

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
  if (!coverageError) return { ok: true, label };

  const leakedValues = coverageError.match(/remain after hydration: (.+)$/u)?.[1]?.split(" | ") ?? [];
  const domSamples = leakedValues.length === 0
    ? []
    : await page.evaluate((values) => {
        const normalize = (value) => value.trim().replace(/\s+/g, " ");
        const targets = new Set(values);
        const samples = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node && samples.length < 10; node = walker.nextNode()) {
          const value = normalize(node.nodeValue ?? "");
          if (!targets.has(value) || node.parentElement?.closest("script, style, code, pre, [data-no-translate]")) continue;
          const region = node.parentElement?.closest("section, aside, nav, main, footer");
          samples.push({
            kind: "text",
            value,
            parent: node.parentElement?.outerHTML.slice(0, 320) ?? null,
            region: region ? `${region.tagName.toLowerCase()}${region.id ? `#${region.id}` : ""}${region.className ? `.${String(region.className).trim().replace(/\s+/g, ".")}` : ""}` : null,
          });
        }
        for (const attribute of ["alt", "aria-label", "placeholder", "title"]) {
          for (const element of document.body.querySelectorAll(`[${attribute}]`)) {
            const value = normalize(element.getAttribute(attribute) ?? "");
            if (!targets.has(value) || element.closest("script, style, code, pre, [data-no-translate]")) continue;
            samples.push({ kind: attribute, value, parent: element.outerHTML.slice(0, 320) });
            if (samples.length >= 10) return samples;
          }
        }
        return samples;
      }, leakedValues);
  const normalize = (value) => value.trim().replace(/\s+/g, " ");
  const collisionCounts = leakedValues.map((target) => {
    const producers = Object.entries(catalog.messages[locale])
      .filter(([, localized]) => normalize(localized) === normalize(target))
      .map(([source]) => ({
        source,
        sourceCount: state.sourceValues.filter((value) => normalize(value) === normalize(source)).length,
      }));
    return {
      target,
      expectedCount: producers.reduce((total, producer) => total + producer.sourceCount, 0),
      currentCount: state.currentValues.filter((value) => normalize(value) === normalize(target)).length,
      producers,
    };
  });
  const diagnostic = domSamples.length > 0
    ? `; DOM samples ${JSON.stringify(domSamples)}; collision counts ${JSON.stringify(collisionCounts)}`
    : "";
  return { ok: false, label, detail: `${coverageError}${diagnostic}` };
}

const resultOffset = enginePlans.reduce((total, plan) => total + plan.jobs.length, 0);
const results = new Array(resultOffset);

async function runEngine({ engineName, jobs, resultOffset: engineResultOffset }) {
  const browser = await browserTypes[engineName].launch();
  const engineConcurrency = Math.min(concurrency, engineConcurrencyCaps[engineName]);
  let cursor = 0;
  let failureCount = 0;
  let completedCount = 0;
  try {
    await Promise.all(
      Array.from({ length: engineConcurrency }, async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        try {
          while (cursor < jobs.length && failureCount < maxFailures) {
            const index = cursor;
            cursor += 1;
            const page = await context.newPage();
            try {
              const result = await verifyPage(page, {
                ...jobs[index],
                label: `${engineName}:${jobs[index].label}`,
              });
              results[engineResultOffset + index] = result;
              if (!result.ok) failureCount += 1;
            } catch (error) {
              results[engineResultOffset + index] = {
                ok: false,
                label: `${engineName}:${jobs[index].label}`,
                detail: error instanceof Error ? error.message : String(error),
              };
              failureCount += 1;
            } finally {
              await page.close();
              completedCount += 1;
              if (completedCount % 100 === 0 || completedCount === jobs.length) {
                console.log(
                  `Dual-host locale hydration: ${engineName} completed ${completedCount}/${jobs.length} ` +
                    `page(s), ${failureCount} failure(s).`,
                );
              }
            }
          }
        } finally {
          await context.close();
        }
      }),
    );
    if (failureCount >= maxFailures) {
      console.error(`Dual-host locale hydration: ${engineName} stopped after ${failureCount} failure(s).`);
    }
  } finally {
    await browser.close();
  }
}

try {
  await waitForServer();
  for (const [index, plan] of enginePlans.entries()) {
    console.log(
      `Dual-host locale hydration: starting ${plan.engineName} (${index + 1}/${enginePlans.length}, ` +
        `${plan.jobs.length} pages across ${plan.routeCount} routes, ` +
        `${Math.min(concurrency, engineConcurrencyCaps[plan.engineName])} workers).`,
    );
    await runEngine(plan);
  }
} finally {
  await stopServer();
}

const completedResults = results.filter(Boolean);
const failures = completedResults.filter((result) => !result.ok);
const incompleteCount = results.length - completedResults.length;
if (failures.length > 0 || incompleteCount > 0) {
  console.error(
    `Dual-host locale hydration FAIL: ${failures.length}/${completedResults.length} completed page(s) failed; ` +
      `${incompleteCount} page(s) were not run after the fail-fast ceiling.`,
  );
  for (const failure of failures) console.error(`- ${failure.label}: ${failure.detail}`);
  process.exitCode = 1;
} else {
  const nativeTurkishRenders = enginePlans.reduce(
    (total, plan) => total + plan.jobs.filter((job) => job.host === "ileriakil" && job.locale === "tr").length,
    0,
  );
  const catalogBackedRenders = results.length - nativeTurkishRenders;
  const coverageSummary = enginePlans.map((plan) => `${plan.engineName}:${plan.jobs.length}`).join(", ");
  const profileLocaleCount = new Set(enginePlans.flatMap((plan) => plan.jobs.map((job) => job.locale))).size;
  console.log(
    `Dual-host locale hydration PASS: ${results.length}/${results.length} profile pages reached localeReady across ` +
      `${profileLocaleCount} locale(s) and 2 hosts (${coverageSummary}), with ${catalogBackedRenders} ` +
      `committed-catalog renders plus ${nativeTurkishRenders} native Turkish source renders; ` +
      `catalog ${contract.catalogSha256}.`,
  );
  console.log("Ephemeral loopback browser evidence only: no deployment or public/chain state was changed.");
}

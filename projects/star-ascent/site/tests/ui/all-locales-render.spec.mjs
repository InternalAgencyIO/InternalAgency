import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import axe from "axe-core";

const metadata = JSON.parse(
  readFileSync(new URL("../../app/i18n/metadata.generated.json", import.meta.url), "utf8"),
);
const localeCodes = Object.keys(metadata);
const rtlLocales = new Set(["ar", "ur"]);
const htmlLanguageTags = { zh: "zh-Hans", sr: "sr-Cyrl" };
const stressRoutes = [
  ["ar", "/ar"],
  ["ur", "/ur/tokenomics"],
  ["zh", "/zh/future/predictive-engine"],
  ["ja", "/ja/dossier"],
  ["de", "/de/launch"],
  ["tr", "/tr/future/casino"],
];

function expectedLanguage(locale) {
  return htmlLanguageTags[locale] ?? locale;
}

function monitorRuntime(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    errors.push(`console: ${message.text()}${location ? ` @ ${location}` : ""}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (request.resourceType() === "media" || /\.(?:mp4|webm|ogg)(?:[?#]|$)/i.test(request.url())) return;
    errors.push(`requestfailed: ${request.url()} (${errorText})`);
  });
  return errors;
}

async function assertLocalizedDocument(page, locale, path, { accessibility = false } = {}) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${locale} HTTP status`).toBe(200);
  await page.waitForFunction(() => document.documentElement.dataset.localeReady === "true");

  const state = await page.evaluate(() => {
    const canonical = document.querySelector('link[rel="canonical"]')?.href ?? "";
    const alternates = Array.from(document.querySelectorAll('link[rel="alternate"][hrefLang]'));
    const bodyText = document.body.innerText;
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      canonical,
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      alternateCount: alternates.length,
      hasDefaultAlternate: alternates.some((link) => link.getAttribute("hrefLang") === "x-default"),
      visibleBody: getComputedStyle(document.body).visibility !== "hidden" && getComputedStyle(document.body).opacity !== "0",
      bodyLength: bodyText.trim().length,
      starshipControlLeak: bodyText.includes("STARSHIP CONTROL. GO."),
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      genericAriaLabels: document.querySelectorAll('div[aria-label]:not([role]), span[aria-label]:not([role])').length,
      mojibake: bodyText.match(/(?:\u00c3\u0192.|\u00c3\u201e.|\u00c3\u2026.|\u00c3\u00a2\u00e2\u201a\u00ac|\u00c3\u00af\u00c2\u00bf\u00c2\u00bd)/gu) ?? [],
    };
  });

  expect(state.lang, `${locale} document language`).toBe(expectedLanguage(locale));
  expect(state.dir, `${locale} document direction`).toBe(rtlLocales.has(locale) ? "rtl" : "ltr");
  expect(state.title, `${locale} document title`).not.toBe("");
  expect(state.description, `${locale} description`).not.toBe("");
  expect(state.canonicalCount, `${locale} canonical count`).toBe(1);
  expect(new URL(state.canonical).pathname, `${locale} canonical path`).toBe(path);
  expect(state.alternateCount, `${locale} alternate count`).toBe(51);
  expect(state.hasDefaultAlternate, `${locale} x-default alternate`).toBe(true);
  expect(state.visibleBody, `${locale} body visibility`).toBe(true);
  expect(state.bodyLength, `${locale} rendered body length`).toBeGreaterThan(300);
  expect(state.documentFits, `${locale} horizontal containment`).toBe(true);
  expect(state.genericAriaLabels, `${locale} generic ARIA labels`).toBe(0);
  expect(state.mojibake, `${locale} mojibake`).toEqual([]);
  if (locale !== "en") expect(state.starshipControlLeak, `${locale} critical English fallback`).toBe(false);

  if (accessibility) {
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const result = await globalThis.axe.run(document, {
        runOnly: { type: "rule", values: ["color-contrast", "aria-prohibited-attr", "region", "heading-order"] },
      });
      return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
    });
    expect(violations, `${locale} confirmed accessibility violations`).toEqual([]);
  }
}

test("all 50 locale roots hydrate with localized document ownership", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The exhaustive locale pass runs once; the stress matrix covers every project.");
  test.setTimeout(240_000);
  expect(localeCodes, "locale catalog size").toHaveLength(50);
  const runtimeErrors = monitorRuntime(page);

  for (const locale of localeCodes) {
    runtimeErrors.length = 0;
    const path = locale === "en" ? "/" : `/${locale}`;
    await assertLocalizedDocument(page, locale, path);
    expect(runtimeErrors, `${locale} runtime errors`).toEqual([]);
  }
});

test("RTL, CJK, long-copy, and Turkish routes survive every browser and viewport profile", async ({ context }) => {
  test.setTimeout(180_000);

  for (const [locale, path] of stressRoutes) {
    const page = await context.newPage();
    const runtimeErrors = monitorRuntime(page);
    try {
      await assertLocalizedDocument(page, locale, path, { accessibility: true });
      expect(runtimeErrors, `${locale} runtime errors`).toEqual([]);
    } finally {
      await page.close();
    }
  }
});

test("the Chinese network route replaces cataloged English copy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The focused Chinese regression runs once.");
  await page.route("**/api/network", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        network: { networkLabel: "SOLANA MAINNET BETA", programId: null, mint: null },
        snapshot: {
          health: "ok",
          slot: 1,
          blockHeight: 1,
          epoch: { epoch: 1, slotIndex: 1, slotsInEpoch: 432000 },
          observedAtUtc: "2026-08-04T00:00:00Z",
          rpcSource: "LOCALE_QA_FIXTURE",
        },
      }),
    });
  });
  const runtimeErrors = monitorRuntime(page);
  await assertLocalizedDocument(page, "zh", "/zh/network", { accessibility: true });
  const bodyText = await page.locator("body").innerText();
  for (const expected of ["一屏。", "IAT 网络 // 实时 SOLANA 读出", "返回 ⟨STAR ASCENT⟩", "整个信号。", "链脉冲", "玩家视图"]) {
    expect(bodyText, `Chinese network copy: ${expected}`).toContain(expected);
  }
  for (const fallback of ["ONE SCREEN.", "IAT NETWORK // LIVE SOLANA READOUT", "RETURN TO STAR ASCENT", "THE WHOLE SIGNAL.", "CHAIN PULSE", "PLAYER VIEW"]) {
    expect(bodyText, `English network fallback: ${fallback}`).not.toContain(fallback);
  }
  expect(runtimeErrors, "Chinese network runtime errors").toEqual([]);
});

test("a stale locale payload cannot mark the document ready", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The payload-contract rejection runs once.");
  await page.route("**/i18n-v2/**/*.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schema: "iat-locale-payload/v1",
        catalogSha256: "stale",
        sourceCount: 1,
        locale: "zh",
        messages: { "ONE SCREEN.": "错误的旧载荷" },
      }),
    });
  });
  await page.goto("/zh/network", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.localeError === "payload-contract-failed");
  const state = await page.evaluate(() => ({
    ready: document.documentElement.dataset.localeReady,
    error: document.documentElement.dataset.localeError,
  }));
  expect(state).toEqual({ ready: "false", error: "payload-contract-failed" });
});

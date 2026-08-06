import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import axe from "axe-core";

const metadata = JSON.parse(
  readFileSync(new URL("../../app/i18n/metadata.generated.json", import.meta.url), "utf8"),
);
const localeCodes = Object.keys(metadata);
const stressRoutes = [
  ["ar", "/ar", "INTERNAL AGENCY PRESENTS"],
  ["ur", "/ur/tokenomics", "IAT // PUBLIC ECONOMIC POLICY V2"],
  ["zh", "/zh/future/predictive-engine", "PREDICTIVE ENGINE"],
  ["ja", "/ja/dossier", "INTERNAL AGENCY // CANONICAL DOSSIER"],
  ["de", "/de/launch", "STAR ASCENT // GENESIS CONTROL"],
  ["tr", "/tr/future/casino", "CASINO DLC // EVERY RESULT REPLAYABLE"],
];

function expectedLanguage() {
  return "en";
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

async function waitForStableLocaleReady(page) {
  await page.waitForFunction(() => {
    const stableWindowMs = 250;
    const key = "__iatLocaleReadySince";
    if (document.documentElement.dataset.localeReady !== "true") {
      window[key] = 0;
      return false;
    }
    if (!window[key]) window[key] = performance.now();
    return performance.now() - window[key] >= stableWindowMs;
  }, { timeout: 30_000, polling: 50 });
}

async function assertLocalizedDocument(page, locale, path, { accessibility = false, englishMarker = null } = {}) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${locale} HTTP status`).toBe(200);
  await waitForStableLocaleReady(page);

  const state = await page.evaluate(() => {
    const canonical = document.querySelector('link[rel="canonical"]')?.href ?? "";
    const alternates = Array.from(document.querySelectorAll('link[rel="alternate"][hrefLang]'));
    const bodyText = document.body.innerText;
    const localeButton = document.querySelector(".locale-switcher > button");
    const localeButtonRect = localeButton?.getBoundingClientRect() ?? null;
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
      canonical,
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      alternateCount: alternates.length,
      hasDefaultAlternate: alternates.some((link) => link.getAttribute("hrefLang") === "x-default"),
      visibleBody: getComputedStyle(document.body).visibility !== "hidden" && getComputedStyle(document.body).opacity !== "0",
      bodyLength: bodyText.trim().length,
      localeButtonText: localeButton?.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      localeButtonBounds: localeButtonRect
        ? { left: localeButtonRect.left, right: localeButtonRect.right }
        : null,
      viewportWidth: document.documentElement.clientWidth,
      localePayloadRequests: performance.getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/i18n-v2/")).length,
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      genericAriaLabels: document.querySelectorAll('div[aria-label]:not([role]), span[aria-label]:not([role])').length,
      mojibake: bodyText.match(/(?:\u00c3\u0192.|\u00c3\u201e.|\u00c3\u2026.|\u00c3\u00a2\u00e2\u201a\u00ac|\u00c3\u00af\u00c2\u00bf\u00c2\u00bd)/gu) ?? [],
      targetLanguageScript: bodyText.match(/[\u0370-\u052f\u0530-\u058f\u0600-\u06ff\u0900-\u0d7f\u10a0-\u10ff\u3040-\u30ff\u3400-\u9fff]/gu) ?? [],
      turkishSpecificLetters: bodyText.match(/[\u011e\u011f\u0130\u0131\u015e\u015f]/gu) ?? [],
    };
  });

  expect(state.lang, `${locale} document language`).toBe(expectedLanguage(locale));
  expect(await response?.headerValue("content-language"), `${locale} response content language`).toBe("en");
  expect(state.dir, `${locale} document direction`).toBe("ltr");
  expect(state.title, `${locale} document title`).not.toBe("");
  expect(state.description, `${locale} description`).not.toBe("");
  expect(state.canonicalCount, `${locale} canonical count`).toBe(1);
  const canonicalPath = locale === "en" ? path : path.slice(locale.length + 1) || "/";
  expect(new URL(state.canonical).origin, `${locale} canonical origin`).toBe("https://internalagency.io");
  expect(new URL(state.canonical).pathname, `${locale} canonical path`).toBe(canonicalPath);
  expect(state.alternateCount, `${locale} alternate count`).toBe(2);
  expect(state.hasDefaultAlternate, `${locale} x-default alternate`).toBe(true);
  expect(state.visibleBody, `${locale} body visibility`).toBe(true);
  expect(state.bodyLength, `${locale} rendered body length`).toBeGreaterThan(300);
  expect(state.localeButtonBounds, `${locale} locale button bounds`).not.toBeNull();
  expect(state.localeButtonBounds.left, `${locale} locale button left containment`).toBeGreaterThanOrEqual(0);
  expect(state.localeButtonBounds.right, `${locale} locale button right containment`).toBeLessThanOrEqual(state.viewportWidth);
  if (locale === "en") {
    expect(state.localeButtonText, `${locale} locale button label`).toContain("English");
    expect(state.localeButtonText, `${locale} canonical locale button`).not.toContain("English fallback is active");
  } else {
    expect(state.localeButtonText, `${locale} fallback locale button`).toContain("English fallback is active");
  }
  expect(state.documentFits, `${locale} horizontal containment`).toBe(true);
  expect(state.genericAriaLabels, `${locale} generic ARIA labels`).toBe(0);
  expect(state.mojibake, `${locale} mojibake`).toEqual([]);
  expect(state.targetLanguageScript, `${locale} unreviewed target-language script`).toEqual([]);
  expect(state.turkishSpecificLetters, `${locale} unreviewed Turkish copy`).toEqual([]);
  if (englishMarker) expect(await page.locator("body").innerText(), `${locale} visible English fallback marker`).toContain(englishMarker);
  if (locale !== "en") {
    expect(state.robots, `${locale} review-HOLD indexing`).toContain("noindex");
    expect(await response?.headerValue("x-robots-tag"), `${locale} review-HOLD response indexing`).toContain("noindex");
    expect(state.localePayloadRequests, `${locale} review-HOLD payload isolation`).toBe(0);
  }

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

test("all 50 locale roots hydrate with reviewed-or-English document ownership", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The exhaustive locale pass runs once; the stress matrix covers every project.");
  test.setTimeout(240_000);
  expect(localeCodes, "locale catalog size").toHaveLength(50);
  const runtimeErrors = monitorRuntime(page);

  for (const locale of localeCodes) {
    runtimeErrors.length = 0;
    const path = locale === "en" ? "/" : `/${locale}`;
    await assertLocalizedDocument(page, locale, path, { englishMarker: "INTERNAL AGENCY PRESENTS" });
    expect(runtimeErrors, `${locale} runtime errors`).toEqual([]);
  }
});

test("HOLD script groups and long-copy routes preserve English fallback across every browser and viewport", async ({ context }) => {
  test.setTimeout(180_000);

  for (const [locale, path, englishMarker] of stressRoutes) {
    const page = await context.newPage();
    const runtimeErrors = monitorRuntime(page);
    try {
      await assertLocalizedDocument(page, locale, path, { accessibility: true, englishMarker });
      expect(runtimeErrors, `${locale} runtime errors`).toEqual([]);
    } finally {
      await page.close();
    }
  }
});

test("the Chinese network route keeps canonical English until accountable review", async ({ page }, testInfo) => {
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
    expect(bodyText, `unreviewed Chinese machine draft: ${expected}`).not.toContain(expected);
  }
  for (const fallback of ["ONE SCREEN.", "IAT NETWORK // LIVE SOLANA READOUT", "RETURN TO STAR ASCENT", "THE WHOLE SIGNAL.", "CHAIN PULSE", "PLAYER VIEW"]) {
    expect(bodyText, `review-HOLD English fallback: ${fallback}`).toContain(fallback);
  }
  expect(runtimeErrors, "Chinese network runtime errors").toEqual([]);
});

test("a review-HOLD route never requests or applies an unreviewed locale payload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The fail-closed payload isolation check runs once.");
  test.setTimeout(90_000);
  let payloadRequested = false;
  await page.route("**/i18n-v2/**/*.json", async (route) => {
    payloadRequested = true;
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
  await waitForStableLocaleReady(page);
  const state = await page.evaluate(() => ({
    ready: document.documentElement.dataset.localeReady,
    error: document.documentElement.dataset.localeError ?? null,
    body: document.body.innerText,
  }));
  expect(payloadRequested).toBe(false);
  expect(state.ready).toBe("true");
  expect(state.error).toBeNull();
  expect(state.body).toContain("IAT NETWORK // LIVE SOLANA READOUT");
});

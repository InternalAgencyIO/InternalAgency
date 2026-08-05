import { expect, test } from "@playwright/test";
import axe from "axe-core";

test("Casino DLC demo is labeled, contained, accessible, deterministic, and locally interactive", async ({ page }) => {
  const runtimeErrors = [];
  const roundRequests = [];
  let roundRunning = false;
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on("request", (request) => {
    if (roundRunning) roundRequests.push(request.url());
  });

  const response = await page.goto("/future/casino/demo", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByText("DEMO ONLY", { exact: true })).toBeVisible();
  await expect(page.getByText("SIMULATED CREDITS", { exact: true })).toBeVisible();
  await expect(page.getByText("FICTIONAL ADULT PARTICIPANTS", { exact: true })).toBeVisible();
  await expect(page.getByText("NO REAL WAGERS", { exact: true })).toBeVisible();
  await expect(page.locator(".dossier-dock")).toBeHidden();
  await expect(page.locator(".locale-switcher")).toBeHidden();

  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    language: document.documentElement.lang,
    title: document.title,
    demoNoTranslate: document.querySelector("main")?.hasAttribute("data-no-translate"),
    alternateLanguages: Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map((link) => link.getAttribute("hreflang")),
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.language).toBe("en");
  expect(geometry.title).toBe("Casino DLC — Interactive Demo");
  expect(geometry.demoNoTranslate).toBe(true);
  expect(geometry.alternateLanguages).toEqual(["en", "x-default"]);

  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await globalThis.axe.run(document, {
      runOnly: { type: "rule", values: ["color-contrast", "aria-prohibited-attr", "region", "heading-order", "button-name", "link-name"] },
    });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
  });
  expect(violations).toEqual([]);

  await page.getByRole("button", { name: "Increase simulated stake by 25 credits" }).click();
  await expect(page.locator(".demo-stake strong")).toHaveText("125");
  roundRunning = true;
  await page.getByRole("button", { name: "RUN DEMO ROUND" }).click();
  await expect(page.locator(".demo-phase-status strong")).toHaveText("Demo result settled and a fictional replay receipt recorded.");
  roundRunning = false;

  await expect(page.locator(".demo-result strong")).toHaveText("PLAYER WIN");
  await expect(page.locator(".demo-balance strong")).toHaveText("5,125");
  await expect(page.getByTestId("demo-receipt-id")).toHaveText("DLC-DEMO-001");
  await expect(page.locator(".demo-history-list article")).toHaveCount(1);
  expect(roundRequests, "a demo round must not initiate any request").toEqual([]);

  await page.getByRole("button", { name: "RESET DEMO" }).click();
  await expect(page.locator(".demo-balance strong")).toHaveText("5,000");
  await expect(page.locator(".demo-stake strong")).toHaveText("100");
  await expect(page.locator(".demo-history-list article")).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test("Casino DLC demo honors reduced-motion preferences", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The reduced-motion contract runs once; CSS is shared by every engine.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/future/casino/demo", { waitUntil: "domcontentloaded" });
  const motion = await page.evaluate(() => ({
    preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
    orbitDuration: getComputedStyle(document.querySelector(".orbit-one")).animationDuration,
    resultTransition: getComputedStyle(document.querySelector(".demo-result")).transitionDuration,
  }));
  expect(motion).toEqual({ preference: true, orbitDuration: "1e-05s", resultTransition: "1e-05s" });
});

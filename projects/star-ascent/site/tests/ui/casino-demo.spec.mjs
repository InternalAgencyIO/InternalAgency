import { expect, test } from "@playwright/test";
import axe from "axe-core";

test("Casino DLC demo is labeled, contained, accessible, deterministic, and locally interactive", async ({ page }) => {
  test.setTimeout(90_000);
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
  await expect(page.getByText("FICTIONAL ADULT HOSTS", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Radiance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ellie" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alia" })).toBeVisible();
  await expect(page.getByText("NO REAL WAGERS", { exact: true })).toBeVisible();
  await expect(page.locator(".dossier-dock")).toBeHidden();
  await expect(page.locator(".locale-switcher")).toBeHidden();
  await expect(page.locator(".game-selector button")).toHaveCount(10);
  const skipLink = page.getByRole("link", { name: "Skip to the ten-game lobby" });
  await expect(skipLink).toHaveCSS("position", "fixed");
  await expect(skipLink).toHaveCSS("clip-path", "inset(50%)");
  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toHaveCSS("color", "rgb(9, 8, 12)");
  await expect(skipLink).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.evaluate(() => document.activeElement?.blur());
  const lightControl = page.getByRole("button", { name: "SAFE PULSE OFF" });
  await expect(page.locator("main.casino-demo")).toHaveAttribute("data-interactive-ready", "true");
  await expect(lightControl).toBeEnabled();
  await expect(lightControl).toHaveAttribute("aria-pressed", "false");
  await lightControl.click();
  await expect(page.getByRole("button", { name: "SAFE PULSE ON" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main.casino-demo")).toHaveClass(/is-pulse-on/);
  await page.getByRole("button", { name: "SAFE PULSE ON" }).click();

  const crossEngineGameIds = ["plinko", "slots", "crash"];
  for (const gameId of crossEngineGameIds) {
    await page.getByTestId(`game-${gameId}`).click();
    await expect(page.getByTestId(`game-${gameId}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("active-game-scene")).toHaveClass(new RegExp(`game-${gameId}`));
  }
  await page.getByTestId("game-plinko").click();

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
  expect(geometry.title).toBe("Casino DLC — Nightflight Demo");
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
  await page.getByRole("button", { name: "RUN PLINKO DEMO" }).click();
  await expect(page.locator(".demo-phase-status strong")).toHaveText("Demo result settled and a fictional replay receipt recorded.");
  roundRunning = false;

  await expect(page.locator(".demo-result strong")).toHaveText("4.20× LANDING");
  await expect(page.locator(".demo-balance strong")).toHaveText("5,400");
  await expect(page.getByTestId("demo-receipt-id")).toHaveText("DLC-PLINKO-01");
  await expect(page.locator(".demo-history-list article")).toHaveCount(1);
  expect(roundRequests, "a demo round must not initiate any request").toEqual([]);

  await page.getByRole("button", { name: "RESET ALL DEMO DATA" }).click();
  await expect(page.locator(".demo-balance strong")).toHaveText("5,000");
  await expect(page.locator(".demo-stake strong")).toHaveText("100");
  await expect(page.locator(".demo-history-list article")).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test("all ten Casino DLC rooms complete their deterministic local walkthrough", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The ten-room walkthrough runs once; all engines cover the shared selector and round kernel.");
  test.setTimeout(60_000);
  const games = [
    ["plinko", "4.20× LANDING", "DLC-PLINKO-01"],
    ["dice", "ROLL 86 // MISS", "DLC-DICE-02"],
    ["roulette", "17 // STRAIGHT HIT", "DLC-ROULETTE-03"],
    ["mines", "CASH OUT // SAFE", "DLC-MINES-04"],
    ["keno", "4 HITS // WIN", "DLC-KENO-05"],
    ["limbo", "2.40× // CLEARED", "DLC-LIMBO-06"],
    ["slots", "TRIPLE SEVEN // WIN", "DLC-SLOTS-07"],
    ["baccarat", "BANKER 8 // WIN", "DLC-BACCARAT-08"],
    ["blackjack", "PLAYER 19 // WIN", "DLC-BLACKJACK-09"],
    ["crash", "EXIT 2.00× // CRASH 2.64×", "DLC-CRASH-10"],
  ];
  const roundRequests = [];
  let running = false;
  page.on("request", (request) => { if (running) roundRequests.push(request.url()); });
  await page.goto("/future/casino/demo", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  for (const [gameId, outcome, receipt] of games) {
    await page.getByTestId(`game-${gameId}`).click();
    running = true;
    await page.getByRole("button", { name: new RegExp(`RUN ${gameId === "slots" ? "ORIGINAL SLOTS" : gameId.toUpperCase()} DEMO`) }).click();
    await expect(page.getByTestId("demo-receipt-id")).toHaveText(receipt);
    running = false;
    await expect(page.locator(".demo-result strong")).toHaveText(outcome);
  }

  await expect(page.locator(".demo-history-list article")).toHaveCount(6);
  expect(roundRequests, "no demo room may initiate a round request").toEqual([]);
});

test("Casino DLC demo honors reduced-motion preferences", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The reduced-motion contract runs once; CSS is shared by every engine.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/future/casino/demo", { waitUntil: "domcontentloaded" });
  const lightControl = page.getByRole("button", { name: "SAFE PULSE OFF" });
  await expect(page.locator("main.casino-demo")).toHaveAttribute("data-interactive-ready", "true");
  await expect(lightControl).toBeEnabled();
  await lightControl.click();
  await expect(page.locator("main.casino-demo")).toHaveClass(/is-pulse-on/);
  const motion = await page.evaluate(() => ({
    preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
    orbitDuration: getComputedStyle(document.querySelector(".orbit-one")).animationDuration,
    resultTransition: getComputedStyle(document.querySelector(".demo-result")).transitionDuration,
    lightAnimation: getComputedStyle(document.querySelector(".demo-light-wash")).animationName,
    lightOpacity: getComputedStyle(document.querySelector(".demo-light-wash")).opacity,
  }));
  expect(motion).toEqual({ preference: true, orbitDuration: "1e-05s", resultTransition: "1e-05s", lightAnimation: "none", lightOpacity: "0" });
});

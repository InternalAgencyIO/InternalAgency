import { expect, test } from "@playwright/test";
import axe from "axe-core";

const routes = ["/", "/network", "/launch", "/proof", "/signal", "/tokenomics", "/dossier", "/world", "/verify", "/mint", "/rewards"];
const desktopOnlyRoutes = new Set(["/network", "/launch", "/proof", "/signal", "/tokenomics", "/dossier", "/world", "/verify", "/mint", "/rewards"]);

async function confirmedA11yViolations(page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const result = await globalThis.axe.run(document, {
      runOnly: { type: "rule", values: ["color-contrast", "aria-prohibited-attr", "region", "heading-order"] },
    });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
  });
}

test("public routes remain contained and clear confirmed audit rules", async ({ page, isMobile }) => {
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
          epoch: { epoch: 1 },
          observedAtUtc: "2026-08-03T00:00:00Z",
          rpcSource: "QA_FIXTURE",
        },
      }),
    });
  });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  for (const route of routes) {
    if (isMobile && desktopOnlyRoutes.has(route)) continue;
    runtimeErrors.length = 0;
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenImages: Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0).length,
      genericAriaLabels: document.querySelectorAll('div[aria-label]:not([role]), span[aria-label]:not([role])').length,
      language: document.documentElement.lang,
      title: document.title,
      mojibake: (document.body.textContent ?? "").match(/(?:Ã.|Ä.|Å.|â€|â†|ï¿½)/gu) ?? [],
    }));
    expect(response?.status(), `${route} HTTP status`).toBe(200);
    expect(geometry.scrollWidth, `${route} document overflow`).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.brokenImages, `${route} broken images`).toBe(0);
    expect(geometry.genericAriaLabels, `${route} generic ARIA labels`).toBe(0);
    expect(geometry.language, `${route} document language`).toBe("en");
    expect(geometry.title, `${route} document title`).not.toBe("");
    expect(geometry.mojibake, `${route} mojibake`).toEqual([]);
    expect(await confirmedA11yViolations(page), `${route} accessibility violations`).toEqual([]);
    expect(runtimeErrors, `${route} runtime errors`).toEqual([]);
  }
});

test("home remains usable at the active engine viewport", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const geometry = await page.evaluate(() => {
    const title = document.querySelector(".launch-sequence-title");
    const bounds = title?.getBoundingClientRect();
    return {
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      titleFits: Boolean(bounds && bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth),
      outerDimensions: document.querySelector('img[src="/images/outer-comms-v1.webp"]')?.getAttribute("width") === "1823",
      ritualDimensions: document.querySelector('img[src="/images/ascent-ritual-v1.webp"]')?.getAttribute("height") === "1024",
    };
  });
  expect(geometry).toEqual({ documentFits: true, titleFits: true, outerDimensions: true, ritualDimensions: true });
});

test("skip link and activation terminal implement the keyboard contract", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const skip = page.locator(".skip-link");
  await skip.focus();
  await skip.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main-content");

  const enter = page.getByRole("button", { name: "ENTER STAR ASCENT" });
  await enter.click();
  const opener = page.getByRole("button", { name: "Enter the Register" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "PREPARE YOUR SIGNAL." });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => ({ main: document.querySelector("main")?.inert, nav: document.querySelector("body > nav")?.inert }))).toEqual({ main: true, nav: true });

  const activationTab = page.getByRole("tab", { name: "ACTIVATION" });
  await activationTab.focus();
  await activationTab.press("ArrowRight");
  const claimTab = page.getByRole("tab", { name: "CLAIM STATUS" });
  await expect(claimTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "CLAIM STATUS" })).toBeVisible();
  await claimTab.press("Escape");
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Enter the Register");
});

test("network lookup announces failure without dropping focus", async ({ page }) => {
  await page.route("**/api/network**", async (route) => {
    const url = new URL(route.request().url());
    const body = url.searchParams.has("q")
      ? { error: "INVALID_SOLANA_ADDRESS_OR_SIGNATURE" }
      : { network: { networkLabel: "SOLANA MAINNET BETA", programId: null, mint: null }, snapshot: { health: "ok", slot: 1, blockHeight: 1, epoch: { epoch: 1 }, observedAtUtc: "2026-08-02T00:00:00Z", rpcSource: "TEST_FIXTURE" } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/network", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("TEST_FIXTURE", { exact: false })).toBeVisible();
  await page.getByLabel("Wallet, transaction, program, or mint").fill("not-a-solana-address");
  const submit = page.getByRole("button", { name: "INSPECT →" });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("INVALID SOLANA ADDRESS OR SIGNATURE");
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("BUTTON");
});

test("launch route emits no React reconciliation key errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /unique.*key|each child.*key/i.test(message.text())) errors.push(message.text());
  });
  await page.goto("/launch", { waitUntil: "networkidle" });
  expect(errors).toEqual([]);
});

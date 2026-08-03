import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium, firefox, webkit } from "@playwright/test";

const root = process.cwd();
const reserveLoopbackPort = () => new Promise((resolve, reject) => {
  const reservation = createServer();
  reservation.unref();
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", () => {
    const address = reservation.address();
    reservation.close((error) => error ? reject(error) : resolve(address.port));
  });
});

const port = await reserveLoopbackPort();
const origin = `http://127.0.0.1:${port}`;
const preview = spawn(process.execPath, [
  "./node_modules/vite/bin/vite.js",
  "preview",
  "--config",
  "tools/iat-v2-admin-console/vite.config.mjs",
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
], {
  cwd: root,
  stdio: "ignore",
  windowsHide: true,
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (preview.exitCode !== null) throw new Error(`Admin preview exited before readiness with code ${preview.exitCode}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, `admin preview did not become ready at ${origin}`);

  const engines = { chromium, firefox, webkit };
  for (const [engineName, browserType] of Object.entries(engines)) {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const externalRequests = [];
      const localRequests = [];
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin) {
          localRequests.push(url.pathname);
          await route.continue();
        }
        else {
          externalRequests.push(route.request().url());
          await route.abort("blockedbyclient");
        }
      });

      const response = await page.goto(`${origin}/?mode=inspect`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, `${engineName}: inspection page must return HTTP 200`);
      assert.equal(await page.locator("html").getAttribute("data-iat-admin-mode"), "inspection", `${engineName}: wrong admin mode`);
      assert.equal(await page.locator("html").getAttribute("data-iat-trezor-connect"), "unloaded", `${engineName}: inspection must not load Trezor Connect`);
      await assert.doesNotReject(() => page.getByText("NON-SIGNING INSPECTION MODE").waitFor(), `${engineName}: inspection banner missing`);
      assert.match(await page.locator("body").innerText(), /NETWORK, HARDWARE, SIGNING, BROADCAST DISABLED/u, `${engineName}: safety boundary copy missing`);

      const actionButtons = page.getByRole("button", { name: /REFRESH CHAIN|CONNECT MODEL T|SIMULATE|BROADCAST/u });
      assert.ok(await actionButtons.count() >= 3, `${engineName}: expected disabled operator controls were not rendered`);
      for (let index = 0; index < await actionButtons.count(); index += 1) {
        assert.equal(await actionButtons.nth(index).isDisabled(), true, `${engineName}: operator control ${index + 1} is enabled in inspection mode`);
      }
      assert.deepEqual(externalRequests, [], `${engineName}: inspection mode attempted an external request`);
      assert.equal(localRequests.some((path) => /FeatureRehearsal|ProgramUpgrade|\/lib-/u.test(path)), false, `${engineName}: inspection mode loaded a hardware, upgrade, or feature-only chunk`);
      assert.deepEqual(pageErrors, [], `${engineName}: inspection mode emitted a page error`);
      assert.deepEqual(consoleErrors, [], `${engineName}: inspection mode emitted a console error`);
    } finally {
      await browser.close();
    }
  }

  console.log("IAT V2 admin inspection runtime passed across Chromium, Firefox, and WebKit: isolated localhost renders, zero external requests, Trezor unloaded, all operator controls disabled.");
} finally {
  preview.kill();
}

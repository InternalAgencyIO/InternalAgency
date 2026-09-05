import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const root = process.cwd();
const distRoot = resolve(root, "tools/iat-v2-admin-console/dist");
const manifest = JSON.parse(readFileSync(resolve(distRoot, ".vite/manifest.json"), "utf8"));
const lazyAssetPaths = new Set(
  Object.values(manifest)
    .filter(({ isDynamicEntry }) => isDynamicEntry)
    .map(({ file }) => `/${file}`),
);
assert.ok(lazyAssetPaths.size >= 4, "admin manifest must expose separate feature, upgrade, Trezor, and Switchboard lazy assets");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);
const staticServer = createServer((request, response) => {
  try {
    if (!request.url || !["GET", "HEAD"].includes(request.method ?? "")) {
      response.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativeRequestPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = resolve(distRoot, relativeRequestPath);
    const containment = relative(distRoot, filePath);
    if (containment === "" || containment.startsWith("..") || isAbsolute(containment)) {
      response.writeHead(403).end();
      return;
    }
    const bytes = readFileSync(filePath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": bytes.length,
      "content-type": contentTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found\n");
  }
});
await new Promise((resolveListen, rejectListen) => {
  staticServer.once("error", rejectListen);
  staticServer.listen(0, "127.0.0.1", () => {
    staticServer.off("error", rejectListen);
    resolveListen();
  });
});
const address = staticServer.address();
assert.ok(address && typeof address === "object", "static inspection server has no loopback address");
const port = address.port;
const origin = `http://127.0.0.1:${port}`;

try {
  const readiness = await fetch(origin, { signal: AbortSignal.timeout(2_000) });
  assert.equal(readiness.status, 200, `static admin inspection server did not become ready at ${origin}`);

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

      const actionButtons = page.getByRole("button", {
        name: /REFRESH CHAIN|USE VERIFIED MODEL T SESSION|ARCHIVED INITIALIZATION SIGNING DISABLED|SIMULATE|BROADCAST/u,
      });
      assert.ok(await actionButtons.count() >= 3, `${engineName}: expected disabled operator controls were not rendered`);
      for (let index = 0; index < await actionButtons.count(); index += 1) {
        assert.equal(await actionButtons.nth(index).isDisabled(), true, `${engineName}: operator control ${index + 1} is enabled in inspection mode`);
      }
      assert.deepEqual(externalRequests, [], `${engineName}: inspection mode attempted an external request`);
      const requestedLazyAssets = localRequests.filter((path) => lazyAssetPaths.has(path));
      assert.deepEqual(requestedLazyAssets, [], `${engineName}: inspection mode loaded lazy operator assets`);
      assert.deepEqual(pageErrors, [], `${engineName}: inspection mode emitted a page error`);
      assert.deepEqual(consoleErrors, [], `${engineName}: inspection mode emitted a console error`);
    } finally {
      await browser.close();
    }
  }

  console.log("IAT V2 admin inspection runtime passed across Chromium, Firefox, and WebKit: isolated localhost renders, zero external requests, Trezor unloaded, all operator controls disabled.");
} finally {
  await new Promise((resolveClose, rejectClose) => {
    staticServer.close((error) => error ? rejectClose(error) : resolveClose());
  });
}

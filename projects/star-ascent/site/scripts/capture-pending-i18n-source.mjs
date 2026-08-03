import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractFromHtml } from "./generate-i18n-catalog.mjs";

const root = process.cwd();
const baseUrl = process.env.I18N_BASE_URL ?? "http://localhost:4177";
const outputPath = join(root, "app", "i18n", "pending-visible-source.json");
const catalogPath = join(root, "app", "i18n", "messages.json");
const sitemapPath = join(root, "app", "sitemap.ts");
let serverProcess = null;
if (process.argv.includes("--start-server")) {
  serverProcess = spawn(process.execPath, ["./node_modules/vinext/dist/cli.js", "dev", "-p", new URL(baseUrl).port || "4177"], {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
  });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) {
    serverProcess.kill();
    throw new Error(`Vinext capture server did not become ready at ${baseUrl}`);
  }
}

try {
const catalogBytes = await readFile(catalogPath);
const catalog = JSON.parse(catalogBytes.toString("utf8"));
const sitemapSource = await readFile(sitemapPath, "utf8");
const routes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/g)]
  .map((match) => match[1] || "/")
  .sort();
const activeSources = new Set(Object.keys(catalog.messages.en));
const pending = new Map();

for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), {
    headers: { "x-forwarded-host": "internalagency.io", "accept-language": "en" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Pending i18n capture failed for ${route}: HTTP ${response.status}`);
  for (const source of extractFromHtml(await response.text())) {
    if (activeSources.has(source)) continue;
    const sourceRoutes = pending.get(source) ?? [];
    sourceRoutes.push(route);
    pending.set(source, sourceRoutes);
  }
}

const sources = [...pending.entries()]
  .sort(([left], [right]) => left.localeCompare(right, "en"))
  .map(([source, sourceRoutes]) => ({ source, routes: [...new Set(sourceRoutes)].sort() }));
const byRoute = Object.fromEntries(routes.map((route) => [
  route,
  sources.filter((entry) => entry.routes.includes(route)).length,
]).filter(([, count]) => count > 0));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: join(root, "../../.."), encoding: "utf8" }).trim();
const localeWorkflow = Object.fromEntries(Object.keys(catalog.messages).map((locale) => [
  locale,
  locale === "en" ? "SOURCE_CAPTURED_PENDING_RUNTIME_ACTIVATION" : "TRANSLATION_AND_NATIVE_REVIEW_REQUIRED",
]));
const artifact = {
  schema: "iat-pending-visible-i18n-source/v1",
  status: "DRAFT_TRANSLATION_AND_NATIVE_REVIEW_HOLD",
  sourceBinding: {
    commit: sourceCommit,
    activeCatalogSha256: createHash("sha256").update(catalogBytes).digest("hex"),
  },
  capture: {
    origin: baseUrl,
    routeCount: routes.length,
    routesWithPendingSource: Object.keys(byRoute).length,
    pendingSourceCount: sources.length,
    byRoute,
  },
  localeWorkflow,
  runtime: {
    active: false,
    automaticEnglishFallbackApproved: false,
    translationComplete: false,
    nativeReviewComplete: false,
  },
  interpretation: "Every source string below is captured in the 50-locale workflow, but is not activated at runtime. Non-English translation and accountable native review remain required.",
  sources,
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Captured ${sources.length} pending visible strings across ${Object.keys(byRoute).length} of ${routes.length} canonical routes; runtime activation remains false.`);
} finally {
  serverProcess?.kill();
}

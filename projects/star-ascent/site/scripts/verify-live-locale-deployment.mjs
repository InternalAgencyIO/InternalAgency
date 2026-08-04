import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(siteRoot, "app/i18n/messages.json");
const contractPath = resolve(siteRoot, "app/i18n/payload-contract.json");
const payloadRoot = resolve(siteRoot, "public");

const domains = ["https://internalagency.io", "https://ileriakil.com"];
const rtlLocales = new Set(["ar", "ur"]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const htmlLanguageTag = (locale) => (locale === "zh" ? "zh-Hans" : locale === "sr" ? "sr-Cyrl" : locale);

function responseIdentityError(requestedUrl, response) {
  const requested = new URL(requestedUrl);
  const final = new URL(response.url);
  if (response.redirected) return `unexpected redirect to ${response.url}`;
  if (final.origin !== requested.origin || final.pathname !== requested.pathname) {
    return `final origin/path ${final.origin}${final.pathname} != ${requested.origin}${requested.pathname}`;
  }
  return null;
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache, no-store",
      pragma: "no-cache",
      "user-agent": "IAT-live-locale-verifier/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = {
          ok: false,
          label: String(items[index]?.label ?? items[index]),
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const locales = Object.keys(catalog.messages ?? {}).sort();

if (contract.schema !== "iat-locale-payload/v2") {
  throw new Error(`Unsupported payload contract schema: ${contract.schema}`);
}
if (locales.length !== 50) {
  throw new Error(`Expected 50 catalog locales; found ${locales.length}`);
}
if (Object.keys(catalog.messages.en ?? {}).length !== contract.sourceCount) {
  throw new Error(
    `English catalog source count ${Object.keys(catalog.messages.en ?? {}).length} != contract ${contract.sourceCount}`,
  );
}
if (!/^[a-f0-9]{64}$/.test(contract.catalogSha256)) {
  throw new Error("payload-contract.json has an invalid catalogSha256");
}

const namespace = `${contract.assetNamespace}/${contract.catalogSha256.slice(0, 16)}`;
const cacheBuster = Date.now();
const payloadJobs = domains.flatMap((domain) =>
  locales.map((locale) => ({ domain, locale, label: `${domain} ${locale}` })),
);

const payloadResults = await mapConcurrent(payloadJobs, 10, async ({ domain, locale, label }) => {
  const localPath = resolve(payloadRoot, namespace, `${locale}.json`);
  const expectedBytes = await readFile(localPath);
  const url = `${domain}/${namespace}/${locale}.json?verify=${cacheBuster}`;
  const { response, bytes } = await fetchBytes(url);
  const expectedHash = sha256(expectedBytes);
  const actualHash = sha256(bytes);

  if (response.status !== 200) {
    return { ok: false, label, detail: `HTTP ${response.status} at ${url}` };
  }
  const identityError = responseIdentityError(url, response);
  if (identityError) return { ok: false, label, detail: identityError };
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { ok: false, label, detail: `unexpected content type ${response.headers.get("content-type") ?? "missing"}` };
  }
  if (actualHash !== expectedHash) {
    return {
      ok: false,
      label,
      detail: `payload SHA-256 ${actualHash} != committed ${expectedHash}`,
    };
  }
  return { ok: true, label };
});

const pageJobs = domains.flatMap((domain) =>
  locales.map((locale) => {
    const route = `/${locale}/network`;
    return { domain, locale, route, expectedLang: htmlLanguageTag(locale), label: `${domain}${route}` };
  }),
);
const pageResults = await mapConcurrent(pageJobs, 8, async ({ domain, locale, route, expectedLang, label }) => {
  const url = `${domain}${route}?verify=${cacheBuster}`;
  const { response, bytes } = await fetchBytes(url);
  const html = bytes.toString("utf8");
  const actualLang = html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1];
  const actualDir = html.match(/<html[^>]*\bdir=["']([^"']+)/i)?.[1];
  const expectedDir = rtlLocales.has(locale) ? "rtl" : "ltr";

  if (response.status !== 200) {
    return { ok: false, label, detail: `HTTP ${response.status} at ${url}` };
  }
  const identityError = responseIdentityError(url, response);
  if (identityError) return { ok: false, label, detail: identityError };
  if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    return { ok: false, label, detail: `unexpected content type ${response.headers.get("content-type") ?? "missing"}` };
  }
  if (response.headers.get("content-language")?.toLowerCase() !== locale) {
    return {
      ok: false,
      label,
      detail: `Content-Language ${response.headers.get("content-language") ?? "missing"} != ${locale}`,
    };
  }
  if (bytes.length < 1_000) {
    return { ok: false, label, detail: `unexpectedly small HTML response (${bytes.length} bytes)` };
  }
  if (actualLang !== expectedLang) {
    return { ok: false, label, detail: `HTML lang ${actualLang ?? "missing"} != ${expectedLang}` };
  }
  if (actualDir !== expectedDir) {
    return { ok: false, label, detail: `HTML dir ${actualDir ?? "missing"} != ${expectedDir}` };
  }
  return { ok: true, label };
});

const failures = [...payloadResults, ...pageResults].filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(`Live locale deployment FAIL: ${failures.length} check(s) failed.`);
  for (const failure of failures) {
    console.error(`- ${failure.label}: ${failure.detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Live locale deployment PASS: ${payloadResults.length}/${payloadResults.length} exact payloads and ` +
      `${pageResults.length}/${pageResults.length} locale pages across ${domains.length} active domains; ` +
      `catalog ${contract.catalogSha256}.`,
  );
  console.log("Read-only verification only: no deployment, signing, funding, or chain state was changed.");
}

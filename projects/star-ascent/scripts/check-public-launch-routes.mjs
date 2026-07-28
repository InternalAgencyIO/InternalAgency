import { execFileSync } from "node:child_process";

const timeoutMs = 5_000;

const pages = [
  "https://internalagency.io/",
  "https://internalagency.io/launch",
  "https://internalagency.io/proof",
  "https://internalagency.io/verify",
  "https://internalagency.io/signal",
  "https://internalagency.io/dossier",
  "https://internalagency.io/press",
  "https://ileriakil.com/",
  "https://ileriakil.com/launch",
  "https://ileriakil.com/proof",
  "https://ileriakil.com/verify",
  "https://ileriakil.com/signal",
  "https://ileriakil.com/dossier",
];

const redirects = [
  ["https://internalagency.io/disclosures/star-ascent-whitepaper-v2-en.txt", "/dossier/read/white-dossier"],
  ["https://ileriakil.com/disclosures/star-ascent-whitepaper-v2-tr.txt", "/dossier/read/white-dossier"],
  ["https://internalagency.io/disclosures/iat-allocation-authority-checklist-en.txt", "/dossier/read/authority-map"],
];

async function request(url, redirect = "follow") {
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(url, { redirect, signal, headers: { "user-agent": "STAR-ASCENT-public-route-check/1.0" } });
}

function curlHeaders(url) {
  const binary = process.platform === "win32" ? "curl.exe" : "curl";
  return execFileSync(binary, ["-sS", "-I", "--connect-timeout", "5", "--max-time", "12", url], { encoding: "utf8" });
}

function headerStatus(headers) {
  return Number(headers.match(/^HTTP\/\S+\s+(\d+)/m)?.[1] ?? 0);
}

function headerValue(headers, name) {
  return headers.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1].trim() ?? "";
}

async function checkPage(url) {
  try {
    const response = await request(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`OK ${response.status} ${url}`);
    return true;
  } catch (error) {
    try {
      const status = headerStatus(curlHeaders(url));
      if (status >= 200 && status < 300) { console.log(`OK ${status} ${url} (curl fallback)`); return true; }
    } catch { /* preserve the original network error below */ }
    console.error(`FAIL ${url}: ${error.message}`); return false;
  }
}

async function checkRedirect(url, expectedPath) {
  try {
    const response = await request(url, "manual");
    const location = response.headers.get("location") ?? "";
    if (response.status !== 308 || !location.includes(expectedPath)) throw new Error(`expected 308 to ${expectedPath}; got ${response.status} ${location}`);
    console.log(`OK 308 ${url} → ${expectedPath}`);
    return true;
  } catch (error) {
    try {
      const headers = curlHeaders(url);
      const status = headerStatus(headers);
      const location = headerValue(headers, "location");
      if (status === 308 && location.includes(expectedPath)) { console.log(`OK 308 ${url} → ${expectedPath} (curl fallback)`); return true; }
    } catch { /* preserve the original network error below */ }
    console.error(`FAIL ${url}: ${error.message}`); return false;
  }
}

const results = await Promise.all([...pages.map(checkPage), ...redirects.map(([url, expectedPath]) => checkRedirect(url, expectedPath))]);
if (results.some((result) => !result)) process.exit(1);
console.log("PUBLIC ROUTE CHECK COMPLETE: English, Turkish, and high-traffic legacy routes are reachable.");

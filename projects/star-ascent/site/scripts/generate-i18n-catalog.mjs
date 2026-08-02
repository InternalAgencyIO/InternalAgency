import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const baseUrl = process.env.I18N_BASE_URL ?? "http://localhost:4177";
const outputPath = join(root, "app", "i18n", "messages.json");
const routeSeoPath = join(root, "app", "i18n", "route-seo.json");
const localeDefinitions = [
  ["en", "en"], ["zh", "zh-CN"], ["es", "es"], ["hi", "hi"], ["fr", "fr"], ["ar", "ar"], ["bn", "bn"],
  ["pt", "pt"], ["id", "id"], ["ur", "ur"], ["ru", "ru"], ["de", "de"], ["ja", "ja"], ["pcm", "pcm"], ["tr", "tr"],
  ["sq", "sq"], ["ca", "ca"], ["be", "be"], ["nl", "nl"], ["bs", "bs"], ["bg", "bg"], ["hr", "hr"],
  ["el", "el"], ["cs", "cs"], ["da", "da"], ["et", "et"], ["fi", "fi"], ["hu", "hu"], ["is", "is"],
  ["ga", "ga"], ["it", "it"], ["lv", "lv"], ["lt", "lt"], ["lb", "lb"], ["mk", "mk"], ["mt", "mt"],
  ["no", "no"], ["pl", "pl"], ["ro", "ro"], ["sr", "sr"], ["sk", "sk"], ["sl", "sl"], ["sv", "sv"],
  ["uk", "uk"], ["ht", "ht"], ["gn", "gn"], ["qu", "qu"], ["hy", "hy"], ["az", "az"], ["ka", "ka"],
];
const seedRoutes = ["/", "/dossier", "/launch", "/signal", "/proof", "/verify", "/press", "/rewards", "/world", "/future", "/future/predictive-engine", "/future/casino"];
const interactiveSourcePaths = [
  "app/page.tsx",
  "app/ActivationTerminal.tsx",
  "app/SignalField.tsx",
  "app/LaunchClock.tsx",
  "app/DossierDock.tsx",
  "app/CrewSignal.tsx",
  "app/DocumentLinkUpgrade.tsx",
];
const protectedTerms = ["Internal Agency", "STAR ASCENT", "$IAT", "$SOL", "IAT", "Solana", "SOLANA", "Model T", "Genesis", "APY", "CCC-Agent", "Radiance", "Ellie", "Alia"];

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function normalize(value) {
  return decodeHtml(value).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
}

function isTranslatable(value) {
  if (value.length < 2 || value.length > 800 || !/\p{L}/u.test(value)) return false;
  if (value.length > 500 && value.includes("{") && value.includes("}") && /(?:^|\s)[.#][a-z0-9_-]+(?:\s|>|\{|:)/i.test(value)) return false;
  if (/^(?:https?:|mailto:|\/|\.\/|\.\.\/|[a-z0-9_.-]+\.(?:tsx?|mjs|json|css|png|jpe?g|svg|mp4))/.test(value)) return false;
  if (/^(?:className|children|undefined|null|true|false|GET|POST|PUT|DELETE)$/i.test(value)) return false;
  if (/^[a-z][a-zA-Z0-9]*(?:[A-Z][a-z0-9]+)+$/.test(value)) return false;
  return true;
}

function extractFromHtml(html) {
  const values = new Set();
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const match of cleaned.matchAll(/\b(?:alt|aria-label|placeholder|title)=(?:"([^"]*)"|'([^']*)')/gi)) {
    const value = normalize(match[1] ?? match[2] ?? "");
    if (isTranslatable(value)) values.add(value);
  }
  const text = cleaned.replace(/<[^>]+>/g, "\n");
  for (const line of text.split(/\n+/)) {
    const value = normalize(line);
    if (isTranslatable(value)) values.add(value);
  }
  return values;
}

function extractInternalRoutes(html) {
  const routes = [];
  for (const match of html.matchAll(/\bhref=(?:"([^"]+)"|'([^']+)')/gi)) {
    const href = decodeHtml(match[1] ?? match[2] ?? "").split(/[?#]/)[0];
    if (href.startsWith("/dossier/read/")) routes.push(href);
  }
  return routes;
}

function extractFromSource(source) {
  const values = new Set();
  const pattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1] === "`" && match[2].includes("${")) continue;
    const value = normalize(match[2].replace(/\\(["'`])/g, "$1"));
    if (!isTranslatable(value)) continue;
    if (!value.includes(" ") && !/^[A-ZÀ-ÖØ-Þ]{3,}(?:[-/][A-Z0-9À-ÖØ-Þ]+)*$/u.test(value)) continue;
    values.add(value);
  }
  return values;
}

function maskTerms(source) {
  let masked = source;
  const replacements = [];
  protectedTerms.forEach((term, index) => {
    if (!masked.includes(term)) return;
    const token = `__IA_TERM_${index}__`;
    masked = masked.split(term).join(token);
    replacements.push([token, term]);
  });
  return { masked, replacements };
}

function unmaskTerms(value, replacements) {
  let restored = value;
  for (const [token, term] of replacements) restored = restored.split(token).join(term);
  return restored;
}

async function translateRequest(text, target, attempt = 1) {
  const body = new URLSearchParams({ client: "gtx", sl: "en", tl: target, dt: "t", q: text });
  try {
    const response = await fetch("https://translate.googleapis.com/translate_a/single", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.retryAfter = Number(response.headers.get("retry-after") ?? 0);
      throw error;
    }
    const payload = await response.json();
    return payload[0].map((part) => part[0]).join("");
  } catch (error) {
    if (attempt >= 7) throw error;
    const rateLimitDelay = error.status === 429 ? Math.max(error.retryAfter * 1_000, Math.min(60_000, 5_000 * (2 ** (attempt - 1)))) : 750 * attempt;
    await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
    return translateRequest(text, target, attempt + 1);
  }
}

async function renderRoute(route, attempt = 1) {
  const response = await fetch(new URL(route, baseUrl), {
    headers: { "x-forwarded-host": "internalagency.io", "accept-language": "en" },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.ok) return response.text();
  if (attempt >= 5) throw new Error(`Could not render ${route}: HTTP ${response.status}`);
  await response.arrayBuffer();
  await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  return renderRoute(route, attempt + 1);
}

function batches(strings, maxCharacters = 7500) {
  const result = [];
  let current = [];
  let size = 0;
  for (const source of strings) {
    const estimate = source.length + 28;
    if (current.length && size + estimate > maxCharacters) {
      result.push(current);
      current = [];
      size = 0;
    }
    current.push(source);
    size += estimate;
  }
  if (current.length) result.push(current);
  return result;
}

async function translateBatch(batch, target) {
  const prepared = batch.map(maskTerms);
  const payload = prepared.map((entry, index) => `__IA_LINE_${String(index).padStart(4, "0")}__\n${entry.masked}`).join("\n");
  const translated = await translateRequest(payload, target);
  const parts = translated.split(/__IA_LINE_(\d{4})__\s*/).slice(1);
  if (parts.length !== batch.length * 2) {
    const fallback = [];
    for (let index = 0; index < prepared.length; index += 1) {
      fallback.push(unmaskTerms(await translateRequest(prepared[index].masked, target), prepared[index].replacements));
    }
    return fallback;
  }
  const result = new Array(batch.length);
  for (let index = 0; index < parts.length; index += 2) {
    const position = Number(parts[index]);
    result[position] = unmaskTerms(parts[index + 1].trim(), prepared[position].replacements);
  }
  return result;
}

async function main() {
  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  const routeSeo = JSON.parse(await readFile(routeSeoPath, "utf8"));
  const sources = new Set([
    "Internal Agency — STAR ASCENT",
    "The first public chapter of Internal Agency: transparent launch information, token disclosure, and operator safety guidance.",
    "STAR ASCENT launch control",
    ...Object.values(existing.prompts.en),
    ...Object.values(routeSeo).flatMap(({ title, description }) => [title, description]),
  ]);
  const routeQueue = [...seedRoutes];
  const visited = new Set();
  while (routeQueue.length) {
    const route = routeQueue.shift();
    if (visited.has(route)) continue;
    visited.add(route);
    const html = await renderRoute(route);
    for (const value of extractFromHtml(html)) sources.add(value);
    for (const discovered of extractInternalRoutes(html)) if (!visited.has(discovered)) routeQueue.push(discovered);
  }
  for (const sourcePath of interactiveSourcePaths) {
    const file = join(root, sourcePath);
    const source = await readFile(file, "utf8");
    for (const value of extractFromSource(source)) sources.add(value);
  }

  const ordered = [...sources].sort((a, b) => a.localeCompare(b, "en"));
  const messages = { en: Object.fromEntries(ordered.map((source) => [source, source])) };
  for (const [locale] of localeDefinitions.slice(1)) {
    const cached = existing.messages?.[locale] ?? {};
    messages[locale] = Object.fromEntries(ordered.map((source) => [source, cached[source] ?? ""]));
  }
  const metadata = {
    ...existing.meta,
    generatedAt: new Date().toISOString(),
    sourceCount: ordered.length,
    renderedRoutes: [...visited].sort(),
    sourceFiles: [...interactiveSourcePaths, "app/i18n/route-seo.json"],
  };
  const persist = async () => writeFile(outputPath, `${JSON.stringify({ ...existing, meta: metadata, messages }, null, 2)}\n`, "utf8");
  await persist();
  if (!process.argv.includes("--allow-remote-translation")) {
    process.stdout.write(`Extracted ${ordered.length} canonical source strings.\n`);
    return;
  }
  for (const [locale, googleCode] of localeDefinitions.slice(1)) {
    const cached = existing.messages?.[locale] ?? {};
    if (ordered.every((source) => typeof cached[source] === "string" && cached[source].trim())) {
      messages[locale] = Object.fromEntries(ordered.map((source) => [source, cached[source]]));
      process.stdout.write(`Reused complete ${locale} catalog.\n`);
      continue;
    }
    process.stdout.write(`Translating ${ordered.length} source strings to ${locale}...\n`);
    const dictionary = {};
    for (const batch of batches(ordered)) {
      const translated = await translateBatch(batch, googleCode);
      batch.forEach((source, index) => { dictionary[source] = translated[index]; });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    messages[locale] = dictionary;
    await persist();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  await persist();
  process.stdout.write(`Wrote ${ordered.length} canonical source strings across ${localeDefinitions.length} locales.\n`);
}

await main();

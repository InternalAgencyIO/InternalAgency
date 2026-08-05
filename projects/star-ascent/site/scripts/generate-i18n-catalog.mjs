import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const baseUrl = process.env.I18N_BASE_URL ?? "http://localhost:4177";
const outputPath = join(root, "app", "i18n", "messages.json");
const routeSeoPath = join(root, "app", "i18n", "route-seo.json");
const criticalUiPath = join(root, "app", "i18n", "critical-ui-source.json");
const sitemapPath = join(root, "app", "sitemap.ts");
const localeDefinitions = [
  ["en", "en"], ["zh", "zh-CN"], ["es", "es"], ["hi", "hi"], ["fr", "fr"], ["ar", "ar"], ["bn", "bn"],
  ["pt", "pt"], ["id", "id"], ["ur", "ur"], ["ru", "ru"], ["de", "de"], ["ja", "ja"], ["pcm", null], ["tr", "tr"],
  ["sq", "sq"], ["ca", "ca"], ["be", "be"], ["nl", "nl"], ["bs", "bs"], ["bg", "bg"], ["hr", "hr"],
  ["el", "el"], ["cs", "cs"], ["da", "da"], ["et", "et"], ["fi", "fi"], ["hu", "hu"], ["is", "is"],
  ["ga", "ga"], ["it", "it"], ["lv", "lv"], ["lt", "lt"], ["lb", "lb"], ["mk", "mk"], ["mt", "mt"],
  ["no", "no"], ["pl", "pl"], ["ro", "ro"], ["sr", "sr"], ["sk", "sk"], ["sl", "sl"], ["sv", "sv"],
  ["uk", "uk"], ["ht", "ht"], ["gn", "gn"], ["qu", "qu"], ["hy", "hy"], ["az", "az"], ["ka", "ka"],
];
const quarantinedDirectComponentSourcePaths = [
  "app/page.tsx",
  "app/ActivationTerminal.tsx",
  "app/SignalField.tsx",
  "app/LaunchClock.tsx",
  "app/DossierDock.tsx",
  "app/CrewSignal.tsx",
  "app/DocumentLinkUpgrade.tsx",
  "app/LaunchSequence.tsx",
  "app/dossier/page.tsx",
  "app/dossier/read/[slug]/page.tsx",
  "app/launch/page.tsx",
  "app/network/page.tsx",
  "app/proof/page.tsx",
  "app/rewards/page.tsx",
  "app/signal/page.tsx",
  "app/tokenomics/page.tsx",
  "app/verify/page.tsx",
  "app/world/page.tsx",
  "app/future/future-copy.json",
];
function decodeHtml(value) {
  return value.replace(/&(?:nbsp|amp|quot|apos|lt|gt|#39|#x[0-9a-f]+|#[0-9]+);/gi, (entity) => {
    const normalized = entity.toLowerCase();
    if (normalized === "&nbsp;") return " ";
    if (normalized === "&amp;") return "&";
    if (normalized === "&quot;") return '"';
    if (normalized === "&apos;" || normalized === "&#39;") return "'";
    if (normalized === "&lt;") return "<";
    if (normalized === "&gt;") return ">";
    const radix = normalized.startsWith("&#x") ? 16 : 10;
    const digits = normalized.slice(radix === 16 ? 3 : 2, -1);
    return String.fromCodePoint(Number.parseInt(digits, radix));
  });
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
  const lowerHtml = html.toLowerCase();
  const rawTextElements = new Set(["script", "style", "noscript", "template"]);
  const voidElements = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  let noTranslateDepth = 0;
  const addText = (text) => {
    for (const line of text.split(/\n+/)) {
      const value = normalize(line);
      if (isTranslatable(value)) values.add(value);
    }
  };
  const tagEnd = (start) => {
    let quote = null;
    for (let index = start + 1; index < html.length; index += 1) {
      const character = html[index];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        return index;
      }
    }
    return -1;
  };

  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf("<", cursor);
    if (open === -1) {
      if (noTranslateDepth === 0) addText(html.slice(cursor));
      break;
    }
    if (noTranslateDepth === 0) addText(html.slice(cursor, open));
    if (html.startsWith("<!--", open)) {
      const commentEnd = html.indexOf("-->", open + 4);
      if (commentEnd === -1) break;
      cursor = commentEnd + 3;
      continue;
    }
    const end = tagEnd(open);
    if (end === -1) break;
    const tag = html.slice(open + 1, end);
    const name = /^\s*\/?\s*([a-z0-9:-]+)/i.exec(tag)?.[1]?.toLowerCase();
    const closing = /^\s*\//.test(tag);
    const selfClosing = /\/\s*$/.test(tag) || (name ? voidElements.has(name) : false);
    if (noTranslateDepth > 0) {
      if (closing) noTranslateDepth -= 1;
      else if (!selfClosing) noTranslateDepth += 1;
      cursor = end + 1;
      continue;
    }
    if (!closing && /\bdata-no-translate(?:\s|=|$)/i.test(tag)) {
      if (!selfClosing) noTranslateDepth = 1;
      cursor = end + 1;
      continue;
    }
    if (!closing && name && rawTextElements.has(name)) {
      const closeStart = lowerHtml.indexOf(`</${name}`, end + 1);
      if (closeStart === -1) break;
      const closeEnd = tagEnd(closeStart);
      if (closeEnd === -1) break;
      cursor = closeEnd + 1;
      continue;
    }
    for (const match of tag.matchAll(/\b(?:alt|aria-label|placeholder|title)=(?:"([^"]*)"|'([^']*)')/gi)) {
      const value = normalize(match[1] ?? match[2] ?? "");
      if (isTranslatable(value)) values.add(value);
    }
    cursor = end + 1;
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

async function main() {
  if (process.argv.includes("--allow-remote-translation")) {
    throw new Error("Remote machine-draft generation is disabled by GLOBAL_FAIL_CLOSED; add evidence-bound human-reviewed overrides instead");
  }
  const skipExtract = process.argv.includes("--skip-extract");
  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  const routeSeo = JSON.parse(await readFile(routeSeoPath, "utf8"));
  const criticalUi = JSON.parse(await readFile(criticalUiPath, "utf8"));
  const sitemapSource = await readFile(sitemapPath, "utf8");
  const seedRoutes = [...sitemapSource.matchAll(/\{\s*path:\s*"([^"]*)"/g)]
    .map((match) => match[1] || "/");
  if (seedRoutes.length !== 25 || new Set(seedRoutes).size !== seedRoutes.length) {
    throw new Error(`Expected 25 unique canonical sitemap routes, found ${seedRoutes.length}`);
  }
  const sources = new Set([
    "Internal Agency — STAR ASCENT",
    "The first public chapter of Internal Agency: transparent launch information, token disclosure, and operator safety guidance.",
    "STAR ASCENT launch control",
    ...Object.values(existing.prompts.en),
    ...Object.values(routeSeo).flatMap(({ title, description }) => [title, description]),
    ...Object.values(criticalUi),
  ]);
  const routeQueue = skipExtract ? [] : [...seedRoutes];
  const visited = new Set(skipExtract ? existing.meta.renderedRoutes : []);
  while (routeQueue.length) {
    const route = routeQueue.shift();
    if (visited.has(route)) continue;
    visited.add(route);
    const html = await renderRoute(route);
    for (const value of extractFromHtml(html)) sources.add(value);
    for (const discovered of extractInternalRoutes(html)) if (!visited.has(discovered)) routeQueue.push(discovered);
  }
  const ordered = skipExtract
    ? Object.keys(existing.messages.en)
    : [...sources].sort((a, b) => a.localeCompare(b, "en"));
  const messages = { en: Object.fromEntries(ordered.map((source) => [source, source])) };
  for (const [locale] of localeDefinitions.slice(1)) {
    messages[locale] = Object.fromEntries(ordered.map((source) => [source, source]));
  }
  const metadata = {
    sourceLocale: "en",
    method: "Canonical English fallback with only evidence-bound, human-reviewed locale overrides eligible for runtime.",
    tone: "Direct, energetic, human; avoid corporate filler while preserving safety and financial caveats.",
    generatedAt: new Date().toISOString(),
    sourceCount: ordered.length,
    renderedRoutes: [...visited].sort(),
    sourceFiles: ["rendered canonical English routes", "app/sitemap.ts", "app/i18n/route-seo.json", "app/i18n/critical-ui-source.json"],
    quarantinedDirectComponentSourceFiles: quarantinedDirectComponentSourcePaths,
    sourceLocales: ["en"],
    translationAlgorithmVersion: 2,
    translationDraftStatus: "QUARANTINED_MACHINE_DRAFTS_RUNTIME_REVIEW_ONLY",
    translationEngine: "No machine translation is active at runtime; legacy draft lineage is quarantined outside the reviewed override policy.",
    translationMode: "GLOBAL_FAIL_CLOSED reviewed-only static committed output with canonical English fallback; no runtime translation service.",
    prunedNonContentStrings: 0,
    normalizedUnicodeStrings: 0,
    sanitizedBidiControls: 0,
    balancedDelimiterStrings: 0,
    restoredSentenceIntent: 0,
    restoredSequenceMarkers: 0,
    restoredStructuralSeparators: 0,
    sourceMatchRefresh: {
      mode: "LEGACY_MACHINE_DRAFT_QUARANTINED_NOT_RUNTIME",
      algorithmVersion: 1,
    },
  };
  await writeFile(outputPath, `${JSON.stringify({
    ...existing,
    meta: metadata,
    prompts: { en: existing.prompts.en },
    messages,
  }, null, 2)}\n`, "utf8");
  process.stdout.write(`Extracted ${ordered.length} canonical English source strings with ${localeDefinitions.length - 1} fail-closed fallback catalogs.\n`);
}

export { decodeHtml, extractFromHtml, extractInternalRoutes };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

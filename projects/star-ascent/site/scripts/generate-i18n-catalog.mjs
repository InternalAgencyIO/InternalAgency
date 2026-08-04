import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const baseUrl = process.env.I18N_BASE_URL ?? "http://localhost:4177";
const outputPath = join(root, "app", "i18n", "messages.json");
const routeSeoPath = join(root, "app", "i18n", "route-seo.json");
const criticalUiPath = join(root, "app", "i18n", "critical-ui-source.json");
const criticalUiOverridesPath = join(root, "app", "i18n", "critical-ui-overrides.json");
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
const interactiveSourcePaths = [
  "app/page.tsx",
  "app/ActivationTerminal.tsx",
  "app/SignalField.tsx",
  "app/LaunchClock.tsx",
  "app/DossierDock.tsx",
  "app/CrewSignal.tsx",
  "app/DocumentLinkUpgrade.tsx",
];
const protectedTerms = ["Internal Agency", "STAR ASCENT", "$IAT", "$SOL", "IAT", "Solana", "SOLANA", "Model T", "Genesis", "APY", "CCC-Agent", "Radiance", "Ellie", "Alia", "Devnet", "CC0", "FDF Guard", "mainnet", "HOLD"];
const forbiddenBidiControls = /[\u202A-\u202E\u2066-\u2069]/gu;
const exactSourceTokenPattern = /https?:\/\/[^\s]+|@[A-Za-z0-9_]+|\$[A-Z][A-Z0-9_-]*|\bT\+\d+(?:[.,:]\d+)*\b/g;
const numericSourceTokenPattern = /(?<![\p{L}\p{N}_])\d+(?:[.,:]\d+)*(?:[A-Za-z]+|%)?(?![\p{L}\p{N}_])/gu;
const turkishWords = new Set([
  "açık", "başlangıç", "beklet", "bir", "bu", "cüzdan", "değil", "doğrulama", "göre", "henüz",
  "her", "için", "ile", "işlem", "kanıt", "kamu", "kadar", "olarak", "önce", "sonra", "ve", "veya",
  "yalnızca", "yayın", "yok",
]);

function sourceLanguage(value) {
  if (/[çğıöşüÇĞİÖŞÜı]/u.test(value)) return "tr";
  const words = new Set(value.toLocaleLowerCase("tr").match(/[^\W\d_]+/gu) ?? []);
  return [...words].filter((word) => turkishWords.has(word)).length >= 2 ? "tr" : "en";
}

function hasModelCollapse(value) {
  if (/([^\p{L}\p{N}\s])\1{11,}/u.test(value)) return true;
  const words = value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  let repeatedWords = 1;
  for (let index = 1; index < words.length; index += 1) {
    repeatedWords = words[index] === words[index - 1] && words[index].length >= 2 ? repeatedWords + 1 : 1;
    if (repeatedWords >= 8) return true;
  }
  for (let width = 2; width <= 8; width += 1) {
    for (let start = 0; start + width * 10 <= value.length; start += 1) {
      const unit = value.slice(start, start + width);
      if (unit.trim() && value.startsWith(unit.repeat(10), start)) return true;
    }
  }
  return false;
}

function needsMachineDraftRefresh(locale, source, translation) {
  if (!process.argv.includes("--refresh-invalid") || locale === "en" || locale === "pcm") return false;
  if (hasModelCollapse(translation)) return true;
  const sourceWords = source.match(/\p{L}+/gu) ?? [];
  if (sourceWords.length >= 2 && !/\p{L}/u.test(translation)) return true;
  return sourceWords.length >= 4
    && sourceLanguage(source) !== locale
    && translation.trim().toLocaleLowerCase() === source.trim().toLocaleLowerCase();
}

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
      addText(html.slice(cursor));
      break;
    }
    addText(html.slice(cursor, open));
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

function exactSourceTokens(source) {
  return [...new Set([
    ...(source.match(exactSourceTokenPattern) ?? []),
    ...(source.match(numericSourceTokenPattern) ?? []),
  ])].sort((left, right) => right.length - left.length);
}

function alphabeticIndex(index) {
  let value = index;
  let result = "";
  do {
    result = `${String.fromCharCode(65 + (value % 26))}${result}`;
    value = Math.floor(value / 26);
  } while (value > 0);
  return result.padStart(4, "A");
}

function maskTerms(source) {
  let masked = source;
  const replacements = [];
  exactSourceTokens(source)
    .forEach((term, index) => {
      if (!masked.includes(term)) return;
      const token = `__IA_EXACT_${alphabeticIndex(index)}__`;
      masked = masked.split(term).join(token);
      replacements.push([token, term]);
    });
  protectedTerms.forEach((term, index) => {
    if (!masked.includes(term)) return;
    const token = `__IA_TERM_${alphabeticIndex(index)}__`;
    masked = masked.split(term).join(token);
    replacements.push([token, term]);
  });
  return { masked, replacements };
}

function unmaskTerms(value, replacements) {
  let restored = value;
  for (const [token, term] of replacements) restored = restored.split(token).join(term);
  restored = restored.replace(forbiddenBidiControls, "");
  if (/__IA_(?:TERM|EXACT)_[A-Z]+__/u.test(restored)) {
    throw new Error(`Translation output retained an unresolved placeholder: ${restored}`);
  }
  return restored;
}

function assertMaskRoundTrip(source) {
  const prepared = maskTerms(source);
  const restored = unmaskTerms(prepared.masked, prepared.replacements);
  if (restored !== source) throw new Error(`Translation token mask failed to round-trip: ${source}`);
  for (const token of exactSourceTokens(source)) {
    if (prepared.masked.includes(token)) throw new Error(`Exact source token was not masked: ${token}`);
  }
}

async function translateRequest(text, target, source, attempt = 1) {
  const body = new URLSearchParams({ client: "gtx", sl: source, tl: target, dt: "t", q: text });
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
    return translateRequest(text, target, source, attempt + 1);
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

async function translateBatch(batch, target, sourceLanguageCode) {
  if (target === sourceLanguageCode) return batch;
  const prepared = batch.map(maskTerms);
  const payload = prepared.map((entry, index) => `__IA_LINE_${String(index).padStart(4, "0")}__\n${entry.masked}`).join("\n");
  const translated = await translateRequest(payload, target, sourceLanguageCode);
  const parts = translated.split(/__IA_LINE_(\d{4})__\s*/).slice(1);
  if (parts.length !== batch.length * 2) {
    const fallback = [];
    for (let index = 0; index < prepared.length; index += 1) {
      fallback.push(unmaskTerms(await translateRequest(prepared[index].masked, target, sourceLanguageCode), prepared[index].replacements));
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
  const skipExtract = process.argv.includes("--skip-extract");
  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  const routeSeo = JSON.parse(await readFile(routeSeoPath, "utf8"));
  const criticalUi = JSON.parse(await readFile(criticalUiPath, "utf8"));
  const criticalUiOverrides = JSON.parse(await readFile(criticalUiOverridesPath, "utf8"));
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
  if (!skipExtract) {
    for (const sourcePath of interactiveSourcePaths) {
      const file = join(root, sourcePath);
      const source = await readFile(file, "utf8");
      for (const value of extractFromSource(source)) sources.add(value);
    }
  }

  const ordered = skipExtract
    ? Object.keys(existing.messages.en)
    : [...sources].sort((a, b) => a.localeCompare(b, "en"));
  ordered.forEach(assertMaskRoundTrip);
  const messages = { en: Object.fromEntries(ordered.map((source) => [source, source])) };
  for (const [locale] of localeDefinitions.slice(1)) {
    const cached = existing.messages?.[locale] ?? {};
    const overrides = criticalUiOverrides.translations?.[locale] ?? {};
    messages[locale] = Object.fromEntries(ordered.map((source) => {
      const translation = (overrides[source] ?? cached[source] ?? "").replace(forbiddenBidiControls, "");
      return [source, needsMachineDraftRefresh(locale, source, translation) ? "" : translation];
    }));
  }
  const metadata = {
    ...existing.meta,
    generatedAt: new Date().toISOString(),
    sourceCount: ordered.length,
    renderedRoutes: [...visited].sort(),
    sourceFiles: [...interactiveSourcePaths, "app/sitemap.ts", "app/i18n/route-seo.json", "app/i18n/critical-ui-source.json", "app/i18n/critical-ui-overrides.json"],
    sourceLocales: ["en", "tr"],
    translationDraftStatus: process.argv.includes("--allow-remote-translation")
      ? "MACHINE_DRAFT_NATIVE_REVIEW_REQUIRED"
      : existing.meta.translationDraftStatus,
    translationEngine: process.argv.includes("--allow-remote-translation")
      ? "mixed cached NLLB-200 plus Google Translate draft gap fill"
      : existing.meta.translationEngine,
    translationMode: process.argv.includes("--allow-remote-translation")
      ? "remote-assisted draft generation; static committed output; no runtime translation service; native review required"
      : existing.meta.translationMode,
  };
  const persist = async () => writeFile(outputPath, `${JSON.stringify({ ...existing, meta: metadata, messages }, null, 2)}\n`, "utf8");
  await persist();
  if (!process.argv.includes("--allow-remote-translation")) {
    process.stdout.write(`Extracted ${ordered.length} canonical source strings.\n`);
    return;
  }
  for (const [locale, googleCode] of localeDefinitions.slice(1)) {
    const cached = messages[locale];
    const missing = ordered.filter((source) => !cached[source]?.trim());
    if (!missing.length) {
      messages[locale] = Object.fromEntries(ordered.map((source) => [source, cached[source]]));
      process.stdout.write(`Reused complete ${locale} catalog.\n`);
      continue;
    }
    if (!googleCode) {
      process.stdout.write(`Skipped ${missing.length} ${locale} strings: the remote draft engine has no approved target; local NLLB/native review remains required.\n`);
      continue;
    }
    process.stdout.write(`Translating ${missing.length} missing source strings to ${locale}...\n`);
    const dictionary = Object.fromEntries(ordered.map((source) => [source, cached[source] ?? ""]));
    for (const sourceLanguageCode of ["en", "tr"]) {
      const languageMissing = missing.filter((source) => sourceLanguage(source) === sourceLanguageCode);
      for (const batch of batches(languageMissing)) {
        const translated = await translateBatch(batch, googleCode, sourceLanguageCode);
        batch.forEach((source, index) => { dictionary[source] = translated[index]; });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    messages[locale] = dictionary;
    await persist();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  await persist();
  process.stdout.write(`Wrote ${ordered.length} canonical source strings across ${localeDefinitions.length} locales.\n`);
}

export { decodeHtml, extractFromHtml, extractInternalRoutes };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const siteRoot = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = resolve(siteRoot, "../../..");
const definitionPath = resolve(siteRoot, "app/i18n/language-qa-checks.v1.json");
const defaultNativeEvidencePath = resolve(siteRoot, "app/i18n/native-review-signoffs.v1.json");
const defaultLanguageIdEvidencePath = resolve(siteRoot, "app/i18n/language-id-evidence.v1.json");
const defaultRenderEvidencePath = resolve(siteRoot, "app/i18n/language-render-evidence.v1.json");
const defaultPublishedOutputPath = resolve(siteRoot, "public/audits/localization-qa-20260803/language-qa-scorecard.json");
const statuses = new Set(["PASS", "FAIL", "HOLD", "NOT_RUN"]);
const heuristicIds = new Set([
  "LQA-051", "LQA-052", "LQA-053", "LQA-054", "LQA-055",
  "LQA-056", "LQA-057", "LQA-058", "LQA-059", "LQA-060",
]);

function usage() {
  return [
    "Usage: node scripts/generate-language-qa-scorecard.mjs [options]",
    "",
    "Options:",
    "  --output <path>              Write JSON to a new file instead of stdout.",
    "  --replace                    Replace only the canonical published scorecard path.",
    "  --native-evidence <path>     Read optional native-review evidence.",
    "  --language-id-evidence <path> Read optional independent language-ID evidence.",
    "  --render-evidence <path>      Read optional clean-build browser/render evidence.",
    "  --compact                    Emit compact JSON.",
    "  --gate                       Exit 1 on FAIL or 2 on HOLD/NOT_RUN.",
    "  --help                       Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    output: null,
    nativeEvidence: defaultNativeEvidencePath,
    languageIdEvidence: defaultLanguageIdEvidencePath,
    renderEvidence: defaultRenderEvidencePath,
    compact: false,
    gate: false,
    replace: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (arg === "--compact") options.compact = true;
    else if (arg === "--gate") options.gate = true;
    else if (arg === "--replace") options.replace = true;
    else if (arg === "--output" || arg === "--native-evidence" || arg === "--language-id-evidence" || arg === "--render-evidence") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a path`);
      index += 1;
      const absolute = resolve(process.cwd(), value);
      if (arg === "--output") options.output = absolute;
      else if (arg === "--native-evidence") options.nativeEvidence = absolute;
      else if (arg === "--language-id-evidence") options.languageIdEvidence = absolute;
      else options.renderEvidence = absolute;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.replace && options.output !== defaultPublishedOutputPath) {
    throw new Error("--replace is restricted to the canonical published scorecard path");
  }
  return options;
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const canonicalDigest = (value) => sha256(canonical(value));
const publicEvidencePath = (path) => {
  const repoRelative = relative(siteRoot, path).replaceAll("\\", "/");
  if (!isAbsolute(repoRelative) && repoRelative !== ".." && !repoRelative.startsWith("../")) {
    return repoRelative || ".";
  }
  return `<external>/${basename(path)}`;
};
const normalizeSource = (value) => value.trim().replace(/\s+/gu, " ");
const decimalZeroCodePoints = [0x30, 0x660, 0x6f0, 0x966, 0x9e6];
const normalizeDecimalDigits = (value) => [...value].map((character) => {
  const codePoint = character.codePointAt(0);
  const zero = decimalZeroCodePoints.find((candidate) => codePoint >= candidate && codePoint <= candidate + 9);
  return zero === undefined ? character : String(codePoint - zero);
}).join("");
const arraysEqual = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const sorted = (values) => [...values].sort((left, right) => left.localeCompare(right, "en"));
const counts = (values) => {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};
const sameMultiset = (left, right) => {
  const a = counts(left);
  const b = counts(right);
  return a.size === b.size && [...a].every(([key, value]) => b.get(key) === value);
};
const sample = (values, maximum = 5) => values.slice(0, maximum);

function isWithinRepo(path) {
  const repoRelative = relative(repoRoot, path);
  return !isAbsolute(repoRelative) && repoRelative !== ".." && !repoRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
}

async function readText(path) {
  if (isWithinRepo(path)) return readCanonicalTrackedFile({ repoRoot, absolutePath: path }).toString("utf8");
  return readFile(path, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readOptionalJson(path) {
  try {
    return { present: true, value: await readJson(path), path };
  } catch (error) {
    if (error?.code === "ENOENT") return { present: false, value: null, path };
    return { present: true, value: null, path, error: error.message };
  }
}

const gitNoLfsFilters = [
  "-c", "filter.lfs.clean=",
  "-c", "filter.lfs.smudge=",
  "-c", "filter.lfs.process=",
  "-c", "filter.lfs.required=false",
];

function git(args) {
  return execFileSync("git", [...gitNoLfsFilters, ...args], { cwd: siteRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitCommitExists(commit) {
  try {
    execFileSync("git", [...gitNoLfsFilters, "cat-file", "-e", `${commit}^{commit}`], { cwd: siteRoot, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function parseLocaleConfig(source) {
  const rosterMatch = source.match(/export const localeCodes\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!rosterMatch) throw new Error("Could not parse localeCodes from app/i18n/config.ts");
  const codes = [...rosterMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const definitions = new Map();
  const pattern = /\{\s*code:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*nativeName:\s*"([^"]+)",\s*dir:\s*"(ltr|rtl)",\s*googleCode:\s*"([^"]+)"\s*\}/g;
  for (const match of source.matchAll(pattern)) {
    definitions.set(match[1], { code: match[1], name: match[2], nativeName: match[3], dir: match[4], googleCode: match[5] });
  }
  return { codes, definitions, source };
}

function parseSitemapRoutes(source) {
  return [...source.matchAll(/\{\s*path:\s*"([^"]*)"/g)].map((match) => match[1] || "/");
}

function pass(detail, metrics) {
  return { status: "PASS", detail, ...(metrics ? { metrics } : {}) };
}

function fail(detail, metrics) {
  return { status: "FAIL", detail, ...(metrics ? { metrics } : {}) };
}

function hold(detail, metrics) {
  return { status: "HOLD", detail, ...(metrics ? { metrics } : {}) };
}

function notRun(detail) {
  return { status: "NOT_RUN", detail };
}

function deterministic(ok, passDetail, failDetail, metrics) {
  return ok ? pass(passDetail, metrics) : fail(failDetail, metrics);
}

function heuristic(ok, passDetail, holdDetail, metrics) {
  return ok ? pass(passDetail, metrics) : hold(holdDetail, metrics);
}

function inspectMessages(context, locale, predicate) {
  const messages = context.catalog.messages[locale] ?? {};
  const failures = [];
  for (const [source, translation] of Object.entries(messages)) {
    if (!predicate(source, translation)) failures.push(source);
  }
  return failures;
}

function reviewKey(locale, source) {
  return `${locale}\u0000${source}`;
}

function expectedCatalogValue(context, locale, source) {
  return context.reviewedPolicy.translations?.[locale]?.[source] ?? source;
}

function extract(regex, value) {
  return [...value.matchAll(regex)].map((match) => match[0]);
}

function normalizeNumericLiteral(value) {
  if (value.includes(":")) return value;
  const separators = value.match(/[.,]/gu) ?? [];
  if (separators.length === 0) return value;
  const parts = value.split(/[.,]/u);
  const groupedThousands =
    parts[0].length <= 3 &&
    parts.slice(1).every((part) => part.length === 3) &&
    (parts.length > 2 || parts[0].length <= 3);
  return groupedThousands ? parts.join("") : value.replace(",", ".");
}

function extractNumericLiterals(value) {
  const tokenRegex =
    /(?<![\p{L}\p{N}])\d+(?:[.,:]\d+)*(?:-\d+)?(?=(?:[KMB]\b)|[^\p{L}\p{N}]|$)/gu;
  return extract(tokenRegex, value).map(normalizeNumericLiteral);
}

function expectedHtmlTag(locale) {
  if (locale === "zh") return "zh-Hans";
  if (locale === "sr") return "sr-Cyrl";
  return locale;
}

function localizedPath(locale, route) {
  return locale === "en" ? route : `/${locale}${route === "/" ? "" : route}`;
}

function stripLocalizedPath(locale, route) {
  if (locale === "en") return route;
  if (route === `/${locale}`) return "/";
  return route.startsWith(`/${locale}/`) ? route.slice(locale.length + 1) : route;
}

function balanced(value) {
  const pairs = [["(", ")"], ["[", "]"], ["{", "}"], ["“", "”"], ["«", "»"], ["「", "」"], ["『", "』"]];
  if (!pairs.every(([open, close]) => value.split(open).length === value.split(close).length)) return false;
  return (value.match(/"/g) ?? []).length % 2 === 0;
}

function scriptRatio(value, locale) {
  const profiles = {
    zh: /\p{Script=Han}/u,
    hi: /\p{Script=Devanagari}/u,
    ar: /\p{Script=Arabic}/u,
    ur: /\p{Script=Arabic}/u,
    bn: /\p{Script=Bengali}/u,
    ru: /\p{Script=Cyrillic}/u,
    be: /\p{Script=Cyrillic}/u,
    bg: /\p{Script=Cyrillic}/u,
    mk: /\p{Script=Cyrillic}/u,
    sr: /\p{Script=Cyrillic}/u,
    uk: /\p{Script=Cyrillic}/u,
    ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
    el: /\p{Script=Greek}/u,
    hy: /\p{Script=Armenian}/u,
    ka: /\p{Script=Georgian}/u,
  };
  const expected = profiles[locale] ?? /\p{Script=Latin}/u;
  const letters = [...value].filter((character) => /\p{L}/u.test(character));
  if (letters.length === 0) return 1;
  return letters.filter((character) => expected.test(character)).length / letters.length;
}

function nativeEvidenceResult(context, locale, check) {
  const evidenceFile = context.nativeEvidence;
  if (!evidenceFile.present) return hold("No native-review evidence file exists; native quality remains unclaimed");
  if (evidenceFile.error || !evidenceFile.value) return hold(`Native-review evidence is unreadable: ${evidenceFile.error ?? "invalid JSON"}`);
  const evidence = evidenceFile.value;
  if (evidence.schema !== "iat-native-review-signoffs/v1") return hold("Native-review evidence schema is not approved");
  if (evidence.catalogSha256 !== context.digests.messagesFileSha256) return hold("Native-review evidence is stale against messages.json");
  const localeEvidence = evidence.locales?.[locale];
  if (!localeEvidence) return hold("Locale has no native-review evidence record");
  const item = localeEvidence.checks?.[check.id];
  if (!item) return hold(`${check.id} has no native-review record`);
  if (!['PASS', 'FAIL', 'HOLD'].includes(item.status)) return hold(`${check.id} native status is missing or invalid`);
  if (item.status === "FAIL") return fail("Native reviewer explicitly recorded FAIL");
  if (item.status === "HOLD") return hold("Native reviewer explicitly recorded HOLD");

  const reviewer = item.reviewer ?? {};
  const envelopeProblems = [];
  if (!reviewer.reviewerId?.trim()) envelopeProblems.push("reviewerId");
  if (!reviewer.role?.trim()) envelopeProblems.push("reviewer role");
  if (!reviewer.localeCompetency?.trim()) envelopeProblems.push("locale competency");
  if (!reviewer.independenceStatement?.trim()) envelopeProblems.push("independence statement");
  if (!item.evidence?.trim()) envelopeProblems.push("review evidence note");
  if (!Number.isFinite(Date.parse(item.reviewedAt ?? ""))) envelopeProblems.push("reviewedAt");
  if (item.sourceCatalogSha256 !== context.digests.messagesFileSha256) envelopeProblems.push("source catalog digest");
  if (item.localeMessagesSha256 !== context.localeDigests[locale]) envelopeProblems.push("locale message digest");
  if (item.reviewedKeyCount !== context.sourceKeys.length) envelopeProblems.push("reviewed key count");
  if (check.id === "LQA-098" && !item.targetRegion?.trim()) envelopeProblems.push("target region");
  if (check.id === "LQA-100") {
    const routes = sorted(item.routeCoverage ?? []);
    if (!arraysEqual(routes, sorted(context.routes))) envelopeProblems.push("25-route coverage");
  }
  if (envelopeProblems.length > 0) {
    return hold(`Native PASS is not source-bound or complete: ${envelopeProblems.join(", ")}`);
  }
  return pass("Complete source-bound native-review record explicitly reports PASS", {
    reviewerId: reviewer.reviewerId,
    reviewedAt: item.reviewedAt,
  });
}

function evaluateStatic(context, locale, check) {
  const messages = context.catalog.messages[locale] ?? {};
  const sourceMessages = context.catalog.messages.en ?? {};
  const definition = context.config.definitions.get(locale);
  const criticalSources = Object.values(context.critical);
  const metadata = context.metadata[locale] ?? {};
  // Runtime prompts are compiled from the reviewed locale cells or canonical
  // English fallback. Unreviewed localized prompt maps are not retained.
  const prompt = metadata.prompt ?? context.catalog.prompts?.en ?? {};
  const nonEnglish = locale !== "en";
  const bad = (predicate) => inspectMessages(context, locale, predicate);
  const reviewedEntries = Object.entries(context.reviewedPolicy.translations?.[locale] ?? {});
  const linguisticMessages = nonEnglish ? Object.fromEntries(reviewedEntries) : messages;
  const linguisticValues = Object.values(linguisticMessages);
  const badLinguistic = (predicate) => Object.entries(linguisticMessages)
    .filter(([source, translation]) => !predicate(source, translation))
    .map(([source]) => source);

  if (heuristicIds.has(check.id) && check.id !== "LQA-054" && nonEnglish && reviewedEntries.length === 0) {
    return pass("No evidence-backed target-language cells are active; canonical English fallback is intentionally excluded from linguistic heuristics", { reviewedCellCount: 0 });
  }

  switch (check.id) {
    case "LQA-001":
      return deterministic(context.config.codes.length === 50, "50 configured locales", `Expected 50 locales, found ${context.config.codes.length}`);
    case "LQA-002":
      return deterministic(new Set(context.config.codes.map((code) => code.toLowerCase())).size === context.config.codes.length, "Locale codes are unique", "Duplicate locale code detected");
    case "LQA-003": {
      const occurrences = [context.config.codes, Object.keys(context.catalog.messages), Object.keys(context.metadata)].map((items) => items.filter((item) => item === locale).length);
      return deterministic(occurrences.every((count) => count === 1), "Locale occurs once in each canonical collection", "Locale membership is missing or duplicated", { occurrences });
    }
    case "LQA-004":
      return deterministic(/^[a-z]{2,3}$/.test(locale), "Locale code has approved lowercase syntax", `Noncanonical locale code: ${locale}`);
    case "LQA-005": {
      const holdLabelIsEnglish = locale === "en"
        || context.reviewedPolicy.localeStatus?.[locale] !== "HOLD"
        || definition?.nativeName === definition?.name;
      return deterministic(
        Boolean(definition?.name.trim() && definition?.nativeName.trim() && holdLabelIsEnglish),
        "Locale labels are present and HOLD uses canonical English",
        "Locale display label is empty or exposes an unreviewed autonym",
      );
    }
    case "LQA-006": {
      const nativeName = definition?.nativeName ?? "";
      const ok = nativeName === nativeName.normalize("NFC") && !context.mojibakePattern.test(nativeName) && !nativeName.includes("\uFFFD");
      return deterministic(ok, "Locale-menu label is normalized and encoding-clean", "Locale-menu label has normalization or encoding damage");
    }
    case "LQA-007": {
      const expected = context.rtlLocales.has(locale) ? "rtl" : "ltr";
      return deterministic(definition?.dir === expected, `Direction is ${expected}`, `Expected ${expected}, found ${definition?.dir ?? "missing"}`);
    }
    case "LQA-008": {
      const tag = expectedHtmlTag(locale);
      const explicit = locale === "zh" ? /locale === "zh"\) return "zh-Hans"/.test(context.config.source) : locale === "sr" ? /locale === "sr"\) return "sr-Cyrl"/.test(context.config.source) : true;
      return deterministic(explicit, `Approved HTML tag is ${tag}`, `Config does not explicitly implement ${tag}`);
    }
    case "LQA-009": {
      const googleCodeOk = Boolean(definition?.googleCode) && (locale !== "zh" || definition.googleCode === "zh-CN");
      const pcmException = locale !== "pcm" || /locale === "pcm" \? null/.test(context.config.source);
      return deterministic(googleCodeOk && pcmException, "Hreflang mapping is explicit and approved", "Hreflang mapping or pcm exception is missing");
    }
    case "LQA-010": {
      const failures = context.routes.filter((route) => stripLocalizedPath(locale, localizedPath(locale, route)) !== route);
      return deterministic(failures.length === 0, "All locale paths round-trip", "Locale path round-trip failed", { failures });
    }
    case "LQA-011":
      return deterministic(context.catalog.meta.sourceCount === context.sourceKeys.length, "Catalog source count matches", "Catalog source count mismatch", { declared: context.catalog.meta.sourceCount, actual: context.sourceKeys.length });
    case "LQA-012": {
      const failures = context.sourceKeys.filter((source) => sourceMessages[source] !== source);
      return deterministic(failures.length === 0, "English is the canonical identity map", "English values diverge from source keys", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-013": {
      const normalized = context.sourceKeys.map(normalizeSource);
      return deterministic(new Set(normalized).size === normalized.length, "Normalized source keys are unique", "Duplicate normalized source keys detected");
    }
    case "LQA-014":
      return deterministic(context.routes.length === 25 && new Set(context.routes).size === 25 && arraysEqual(sorted(context.routes), sorted(Object.keys(context.routeSeo))), "25 canonical routes match route SEO", "Canonical route inventory is incomplete or divergent", { sitemapRoutes: context.routes.length, routeSeoRoutes: Object.keys(context.routeSeo).length });
    case "LQA-015": {
      const missing = criticalSources.filter((source) => !context.sourceKeySet.has(source));
      return deterministic(missing.length === 0, "All critical sources are canonical", "Critical sources are absent from canonical English", { missing });
    }
    case "LQA-016": {
      const runtimeInactive = Object.values(context.pending.runtime ?? {}).every((value) => value === false);
      const ok = context.pending.schema === "iat-pending-visible-i18n-source/v1" && context.pending.status === "DRAFT_TRANSLATION_AND_NATIVE_REVIEW_HOLD" && runtimeInactive;
      return deterministic(ok, "Pending artifact is fail-closed", "Pending artifact schema, status, or runtime flags are unsafe");
    }
    case "LQA-017": {
      const sources = context.pending.sources.map((entry) => entry.source);
      return deterministic(new Set(sources).size === sources.length && arraysEqual(sources, [...sources].sort((a, b) => a.localeCompare(b, "en"))), "Pending source inventory is unique and stable", "Pending source inventory is duplicated or unstable");
    }
    case "LQA-018": {
      const failures = Object.entries(context.pending.capture.byRoute ?? {}).filter(([route, count]) => context.pending.sources.filter((entry) => entry.routes.includes(route)).length !== count);
      const totalOk = context.pending.capture.pendingSourceCount === context.pending.sources.length && context.pending.capture.routesWithPendingSource === Object.keys(context.pending.capture.byRoute ?? {}).length;
      return deterministic(totalOk && failures.length === 0, "Pending route counts reconcile", "Pending route counts do not reconcile", { failures });
    }
    case "LQA-019": {
      const expected = locale === "en" ? "SOURCE_CAPTURED_PENDING_RUNTIME_ACTIVATION" : "TRANSLATION_AND_NATIVE_REVIEW_REQUIRED";
      return deterministic(context.pending.localeWorkflow?.[locale] === expected, `Pending workflow remains ${expected}`, "Pending workflow state is missing or unsafe");
    }
    case "LQA-020": {
      const digestOk = context.pending.sourceBinding?.activeCatalogSha256 === context.digests.messagesFileSha256;
      const commitOk = gitCommitExists(context.pending.sourceBinding?.commit ?? "");
      return deterministic(digestOk && commitOk, "Pending artifact is bound to catalog bytes and a real commit", "Pending source binding is stale or references no commit", { digestOk, commitOk });
    }
    case "LQA-021":
      return deterministic(Boolean(context.catalog.messages[locale] && typeof context.catalog.messages[locale] === "object" && !Array.isArray(context.catalog.messages[locale])), "Locale catalog exists", "Locale catalog is absent or not an object");
    case "LQA-022":
      return deterministic(arraysEqual(Object.keys(messages), context.sourceKeys), "Locale key order and set match English", "Locale key order or set diverges from English", { keys: Object.keys(messages).length, expected: context.sourceKeys.length });
    case "LQA-023": {
      const failures = Object.entries(messages).filter(([, value]) => typeof value !== "string").map(([source]) => source);
      return deterministic(failures.length === 0, "All translations are strings", "Non-string translation values detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-024": {
      const failures = Object.entries(messages).filter(([, value]) => typeof value !== "string" || !value.trim()).map(([source]) => source);
      return deterministic(failures.length === 0, "All translations are nonempty", "Empty translation values detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-025": {
      const failures = bad((source, translation) => translation === translation.trim());
      return deterministic(failures.length === 0, "Translation boundaries are trimmed", "Boundary whitespace detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-026": {
      const failures = bad((source, translation) => translation === translation.normalize("NFC"));
      return deterministic(failures.length === 0, "All translations are NFC-normalized", "Non-NFC translations detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-027": {
      const failures = bad((source, translation) => !/\uFFFD|[\uD800-\uDFFF]/u.test(translation));
      return deterministic(failures.length === 0, "No replacement characters or surrogate code units", "Unicode damage detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-028": {
      const failures = bad((source, translation) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u.test(translation));
      return deterministic(failures.length === 0, "No forbidden controls or bidi overrides", "Forbidden control or bidi characters detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-029": {
      const failures = bad((source, translation) => !context.mojibakePattern.test(translation));
      return deterministic(failures.length === 0, "No known mojibake signatures", "Mojibake signatures detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-030": {
      const payload = context.payloads[locale];
      const ok = payload
        && payload.schema === context.payloadContract.schema
        && payload.catalogSha256 === context.payloadContract.catalogSha256
        && payload.sourceCount === context.sourceKeys.length
        && payload.locale === locale
        && arraysEqual(Object.keys(payload.messages ?? {}), context.sourceKeys)
        && canonical(payload.messages) === canonical(messages);
      return deterministic(Boolean(ok), "Compiled payload exactly matches catalog", "Compiled payload is missing, mislabeled, incomplete, or stale", { payloadPresent: Boolean(payload) });
    }
    case "LQA-031": {
      const protectedTerms = ["Internal Agency", "STAR ASCENT", "$IAT", "$SOL", "Solana", "Genesis", "APY", "CCC-Agent"];
      const failures = bad((source, translation) => protectedTerms.every((term) => !source.includes(term) || translation.includes(term)));
      return deterministic(failures.length === 0, "Protected brands retain approved forms", "Protected brand drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-032": {
      const tokenRegex = /\$(?:IAT|SOL)\b|[$€£₺]/g;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Ticker and currency-symbol tokens are preserved", "Ticker or currency-symbol drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-033": {
      const tokenRegex = /\b(?:CC0|UTC|FDF|D1|RPC|SBF|NFT|DAO|APY|CCC|JSON|SHA-256|SOLANA)\b/g;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Protocol acronyms are preserved", "Protocol acronym drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-034": {
      const tokenRegex = /(?<![A-Za-z0-9])[1-9A-HJ-NP-Za-km-z]{32,44}(?![A-Za-z0-9])/g;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Base58-like tokens are preserved", "Base58-like token drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-035": {
      const tokenRegex = /https?:\/\/[^\s<>"']+|\b(?:internalagency\.io|ileriakil\.com)\b/gi;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Absolute URLs and canonical domains are preserved", "URL or domain drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-036": {
      const tokenRegex = /\/(?!\/)[a-z][a-z0-9_.-]*(?:\/[a-z][a-z0-9_.-]*)*/gi;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Internal route tokens are preserved", "Internal route token drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-037": {
      const tokenRegex = /\b[\w-]+\.(?:json|txt|md|mjs|js|ts|tsx|png|jpg|webp|svg|xml)\b/gi;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Filenames and extensions are preserved", "Filename or extension drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-038": {
      const tokenRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\w)@[A-Za-z0-9_]{2,}/gi;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Contact tokens are preserved", "Email address or social handle drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-039": {
      const failures = bad((source, translation) =>
        sameMultiset(
          extractNumericLiterals(source),
          extractNumericLiterals(translation),
        ),
      );
      return deterministic(failures.length === 0, "Numeric literals are preserved", "Numeric-literal drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-040": {
      const tokenRegex = /%|\b(?:APY|BPS|bps|IAT|SOL|UTC)\b/g;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Protocol units retain their counts", "Protocol-unit drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-041": {
      const tokenRegex = /\$\{[^}]+\}|\{\{[^}]+\}\}|\{[A-Za-z_][A-Za-z0-9_.-]*\}|%(?:\d+\$)?[sdif]/g;
      const failures = bad((source, translation) => sameMultiset(extract(tokenRegex, source), extract(tokenRegex, translation)));
      return deterministic(failures.length === 0, "Interpolation placeholders are preserved", "Interpolation placeholder drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-042": {
      const failures = bad((source, translation) => !/<\/?(?:script|style|template|object|embed|iframe|svg|math)\b/i.test(translation));
      return deterministic(failures.length === 0, "No executable or embedding markup", "Executable or embedding markup detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-043": {
      const failures = bad((source, translation) => !/\bon[a-z]+\s*=/i.test(translation));
      return deterministic(failures.length === 0, "No event-handler attribute syntax", "Event-handler syntax detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-044": {
      const failures = bad((source, translation) => !/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i.test(translation));
      return deterministic(failures.length === 0, "No executable URI schemes", "Executable URI scheme detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-045": {
      const controlMarker = /ZXQTERM\d+QXZ|\b(?:FIXME|TRANSLATE_ME)\b|<\|(?:assistant|user|system)\|>/i;
      const todoMarker = /(?:^|[\[({:]\s*)TODO(?:\s*[:\])}]|$)/u;
      const failures = bad((source, translation) => !controlMarker.test(translation) && !todoMarker.test(translation));
      return deterministic(failures.length === 0, "No generator markers", "Generator or model-control marker detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-046": {
      const failures = bad((source, translation) => !/&(?:amp;)+(?:lt|gt);|&lt;\/?(?:script|style|iframe)\b/i.test(translation));
      return deterministic(failures.length === 0, "No nested entity markup", "Nested or encoded executable markup detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-047": {
      const failures = bad((source, translation) => balanced(translation));
      return deterministic(failures.length === 0, "Delimiters are balanced", "Unbalanced delimiters detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-048": {
      const markerRegex = /\/\/|→|•|\[\d{1,3}\]|(?<!\d)\d{2}\s*\/\//g;
      const failures = bad((source, translation) => sameMultiset(extract(markerRegex, source), extract(markerRegex, translation)));
      return deterministic(failures.length === 0, "Sequence markers retain cardinality", "Sequence-marker drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-049": {
      const failures = bad((source, translation) => (source.match(/\n/g) ?? []).length === (translation.match(/\n/g) ?? []).length);
      return deterministic(failures.length === 0, "Newline structure is preserved", "Newline structure drift detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-050": {
      const failures = bad((source, translation) => translation.length <= 800 && (source.length <= 40 || translation.length / Math.max(1, source.length) <= 4));
      return deterministic(failures.length === 0, "Length and expansion limits pass", "Suspiciously long or expanded translations detected", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-051": {
      if (!nonEnglish) return pass("English is the source-locale identity baseline");
      const invariant = /^(?:[\d\s.,:%+$€£₺/|—–-]+|[A-Z0-9$%+_.:/ -]{2,}|Internal Agency|STAR ASCENT|Solana|Genesis|APY|CCC-Agent)$/u;
      const failures = Object.entries(linguisticMessages).filter(([source, translation]) => source === translation && /\p{L}/u.test(source) && !invariant.test(source)).map(([source]) => source);
      return heuristic(failures.length === 0, "No suspicious unchanged linguistic source text", "Unchanged source-language prose requires review", { warningCount: failures.length, samples: sample(failures, 12) });
    }
    case "LQA-052": {
      if (locale === "en" || locale === "pcm") return pass("Locale-specific English-source leakage threshold is not diagnostic for this locale");
      const stopwords = /\b(?:the|and|with|from|this|that|before|after|while|through|public|launch|review|required|pending)\b/gi;
      const warnings = Object.entries(linguisticMessages).filter(([source, translation]) => translation !== source && (translation.match(stopwords) ?? []).length >= 3).map(([source]) => source);
      return heuristic(warnings.length === 0, "No high-confidence English stopword clusters", "English stopword clusters require review", { warningCount: warnings.length, samples: sample(warnings) });
    }
    case "LQA-053": {
      const linguistic = linguisticValues.filter((value) => /\p{L}/u.test(value)).join(" ");
      const ratio = scriptRatio(linguistic, locale);
      const threshold = context.nonLatinLocales.has(locale) ? 0.25 : 0.5;
      return heuristic(ratio >= threshold, "Target-script ratio meets the locale threshold", "Target-script ratio is below threshold and needs review", { ratio: Number(ratio.toFixed(4)), threshold });
    }
    case "LQA-054": {
      const evidence = context.languageIdEvidence;
      if (!evidence.present) return hold("No independent language-ID evidence file exists");
      if (evidence.error || evidence.value?.schema !== "iat-language-id-evidence/v1") return hold("Language-ID evidence is unreadable or has an unapproved schema");
      const entry = evidence.value.locales?.[locale];
      const ok = entry?.localeMessagesSha256 === context.localeDigests[locale] && entry?.identifiedLocale === locale && Number(entry?.confidence) >= Number(entry?.threshold) && entry?.engine?.trim();
      return heuristic(Boolean(ok), "Independent language-ID evidence meets its recorded threshold", "Language-ID evidence is missing, stale, or below threshold");
    }
    case "LQA-055": {
      const groups = new Map();
      for (const [source, translation] of Object.entries(linguisticMessages)) {
        if (!/\p{L}/u.test(source) || translation.length < 3) continue;
        const key = normalizeSource(translation).toLocaleLowerCase(locale);
        const list = groups.get(key) ?? [];
        list.push(source);
        groups.set(key, list);
      }
      const collisions = [...groups.values()].filter((group) => group.length > 1);
      const affected = collisions.reduce((total, group) => total + group.length, 0);
      const ratio = affected / Math.max(1, Object.keys(linguisticMessages).length);
      return heuristic(ratio <= 0.03, "Translation collision ratio is within threshold", "Translation collision ratio requires review", { ratio: Number(ratio.toFixed(4)), groups: collisions.length, samples: sample(collisions) });
    }
    case "LQA-056": {
      const warnings = Object.entries(linguisticMessages).filter(([, translation]) => /\b(\p{L}{2,})\b(?:[\s,;:—-]+\1\b){3,}/iu.test(translation)).map(([source]) => source);
      return heuristic(warnings.length === 0, "No four-token repetition runs detected", "Suspicious repeated-token runs require review", { warningCount: warnings.length, samples: sample(warnings) });
    }
    case "LQA-057": {
      const warnings = Object.entries(linguisticMessages).filter(([source, translation]) => source.length >= 80 && translation.length / source.length < 0.18).map(([source]) => source);
      return heuristic(warnings.length === 0, "Long-copy contraction floor passes", "Extreme contraction requires review", { warningCount: warnings.length, samples: sample(warnings) });
    }
    case "LQA-058": {
      const sentenceCount = (value) => (value.match(/[.!?。！？]/gu) ?? []).length;
      const warnings = Object.entries(linguisticMessages).filter(([source, translation]) => {
        const sourceCount = sentenceCount(source);
        if (sourceCount < 2) return false;
        return Math.abs(sourceCount - sentenceCount(translation)) > Math.max(2, Math.ceil(sourceCount * 0.6));
      }).map(([source]) => source);
      return heuristic(warnings.length === 0, "Sentence-count divergence is within threshold", "Sentence-count divergence requires review", { warningCount: warnings.length, samples: sample(warnings) });
    }
    case "LQA-059": {
      const questionMark = locale === "el" ? /[?？؟՞;]/u : /[?？؟՞]/u;
      const failures = badLinguistic((source, translation) => (!source.includes("?") || questionMark.test(translation)) && (!source.includes("!") || /[!！՜]/u.test(translation)));
      return deterministic(failures.length === 0, "Question and exclamation intent is preserved", "Question or exclamation intent was lost", { failureCount: failures.length, samples: sample(failures) });
    }
    case "LQA-060": {
      const warnings = Object.entries(linguisticMessages).filter(([source, translation]) => {
        const sourceLetters = [...source].filter((character) => /[A-Za-z]/.test(character)).join("");
        const targetLetters = [...translation].filter((character) => /\p{Ll}|\p{Lu}/u.test(character)).join("");
        return sourceLetters.length >= 8 && sourceLetters !== sourceLetters.toUpperCase() && targetLetters.length >= 8 && targetLetters === targetLetters.toLocaleUpperCase(locale);
      }).map(([source]) => source);
      return heuristic(warnings.length === 0, "No unexplained whole-string all-caps escalation", "All-caps escalation requires editorial review", { warningCount: warnings.length, samples: sample(warnings) });
    }
    case "LQA-061":
      return deterministic(criticalSources.length === 8 && criticalSources.every((source) => Object.hasOwn(messages, source)), "All eight critical sources are covered", "Critical source coverage is incomplete", { criticalCount: criticalSources.length });
    case "LQA-062": {
      if (!nonEnglish) return pass("English critical source is the canonical baseline");
      const keys = Object.keys(context.reviewedPolicy.translations?.[locale] ?? {}).filter((source) => criticalSources.includes(source));
      const missingEvidence = keys.filter((source) => !context.reviewIndex.has(reviewKey(locale, source)));
      return deterministic(missingEvidence.length === 0, "Every active critical translation has explicit review evidence; fallback needs no override", "A critical translation lacks explicit review evidence", { reviewedCriticalKeys: keys.length, missingEvidence });
    }
    case "LQA-063": {
      if (!nonEnglish) return pass("English critical source is the canonical baseline");
      const failures = criticalSources.filter((source) => messages[source] !== expectedCatalogValue(context, locale, source));
      return deterministic(failures.length === 0, "Critical catalog values equal reviewed translations or canonical fallback", "Critical values drifted from reviewed-or-fallback policy", { failures });
    }
    case "LQA-064": {
      if (!nonEnglish) return pass("English is the source-locale baseline");
      const failures = criticalSources.filter((source) => messages[source] !== expectedCatalogValue(context, locale, source));
      return deterministic(failures.length === 0, "Unreviewed critical cells fail closed to canonical English", "A critical cell bypasses the reviewed-or-fallback policy", { failures });
    }
    case "LQA-065": {
      const failures = criticalSources.filter((source) => (source.match(/\/\//g) ?? []).length !== (messages[source]?.match(/\/\//g) ?? []).length);
      return deterministic(failures.length === 0, "Critical sequence delimiters are preserved", "Critical sequence delimiter drift detected", { failures });
    }
    case "LQA-066": {
      const fields = ["eyebrow", "title", "body", "stay", "english", "close", "timeout"];
      const sourcePrompt = context.metadata.en?.prompt ?? {};
      const missing = fields.filter((field) => typeof prompt[field] !== "string" || !prompt[field].trim());
      const drift = fields.filter((field) => typeof sourcePrompt[field] === "string" && prompt[field] !== expectedCatalogValue(context, locale, sourcePrompt[field]));
      return deterministic(missing.length === 0 && drift.length === 0, "All seven prompt fields follow reviewed-or-fallback policy", "Prompt fields are missing or bypass policy", { missing, drift });
    }
    case "LQA-067":
      return deterministic(/15/.test(normalizeDecimalDigits(prompt.timeout ?? "")), "Prompt retains the 15-second fact", "Prompt lost or changed the 15-second timeout");
    case "LQA-068": {
      const englishAction = prompt.english ?? "";
      const sourceAction = context.metadata.en?.prompt?.english ?? "";
      const expectedAction = expectedCatalogValue(context, locale, sourceAction);
      const ok = englishAction.trim() && englishAction === expectedAction;
      return deterministic(Boolean(ok), "English-return action follows reviewed-or-fallback policy", "English-return action is empty or bypasses policy");
    }
    case "LQA-069": {
      const sources = [...new Set(Object.values(context.routeSeo).map((entry) => entry.title))];
      const missing = sources.filter((source) => !messages[source]?.trim() || !metadata.seo?.[source]?.trim());
      return deterministic(missing.length === 0, "Every route title has catalog and metadata coverage", "Route title localization is missing", { missingCount: missing.length, samples: sample(missing) });
    }
    case "LQA-070": {
      const seoSources = [...new Set(Object.values(context.routeSeo).flatMap((entry) => [entry.title, entry.description]))];
      const missing = seoSources.filter((source) => !metadata.seo?.[source]?.trim());
      const ok = Boolean(metadata.title?.trim() && metadata.description?.trim()) && metadata.title.length <= 140 && metadata.description.length <= 400 && missing.length === 0;
      return deterministic(ok, "Generated metadata is complete and within bounds", "Generated metadata is missing or outside bounds", { titleLength: metadata.title?.length ?? 0, descriptionLength: metadata.description?.length ?? 0, missingCount: missing.length });
    }
    default:
      return fail(`No static evaluator is implemented for ${check.id}`);
  }
}

function evidenceClass(check) {
  if (check.mode === "RENDER") return "RENDER_REQUIRED";
  if (check.mode === "NATIVE") return "NATIVE_REVIEW_RECORD";
  if (heuristicIds.has(check.id)) return "STATIC_HEURISTIC";
  return "STATIC_DETERMINISTIC";
}

function renderEvidenceResult(context, locale, check) {
  const evidence = context.renderEvidence;
  if (!evidence.present) return notRun("No clean-build browser/render evidence file exists");
  if (evidence.error) return fail(`Render evidence could not be parsed: ${evidence.error}`);
  const artifact = evidence.value;
  if (artifact?.schema !== "iat-language-render-evidence/v1") return fail("Render evidence schema is invalid");
  const requiredBindings = ["definitionSha256", "messagesFileSha256", "metadataSha256", "routeSeoSha256", "pendingSha256", "reviewedPolicySha256"];
  const mismatches = requiredBindings.filter((field) => artifact.sourceBinding?.[field] !== context.digests[field]);
  if (mismatches.length > 0) return fail("Render evidence source binding does not match the current catalog", { mismatches });
  const record = artifact.locales?.[locale]?.checks?.[check.id];
  if (!record) return notRun("Current render evidence has no result for this locale/check");
  if (!['PASS', 'FAIL'].includes(record.status)) return fail("Render evidence record has an invalid status");
  return {
    status: record.status,
    detail: record.detail ?? "Source-bound clean-build render evidence",
    ...(record.metrics ? { metrics: record.metrics } : {}),
  };
}

function evaluate(context, locale, check) {
  let result;
  if (check.mode === "RENDER") {
    result = renderEvidenceResult(context, locale, check);
  } else if (check.mode === "NATIVE") {
    result = nativeEvidenceResult(context, locale, check);
  } else {
    try {
      result = evaluateStatic(context, locale, check);
    } catch (error) {
      result = fail(`Evaluator error: ${error.message}`);
    }
  }
  if (!statuses.has(result.status)) throw new Error(`${check.id} returned invalid status ${result.status}`);
  return {
    id: check.id,
    mode: check.mode,
    category: check.category,
    evidenceClass: evidenceClass(check),
    status: result.status,
    detail: result.detail,
    ...(result.metrics ? { metrics: result.metrics } : {}),
  };
}

function summarize(results) {
  const summary = { PASS: 0, FAIL: 0, HOLD: 0, NOT_RUN: 0 };
  for (const result of results) summary[result.status] += 1;
  return summary;
}

function aggregateStatus(summary) {
  if (summary.FAIL > 0) return "FAIL";
  if (summary.HOLD > 0) return "HOLD";
  if (summary.NOT_RUN > 0) return "NOT_RUN";
  return "PASS";
}

function validateDefinition(definition) {
  if (definition.schema !== "iat-language-qa-check-definition/v1") throw new Error("Unexpected QA definition schema");
  if (definition.localeCount !== 50 || definition.checksPerLocale !== 100 || definition.resultCount !== 5000) throw new Error("QA definition cardinality changed");
  if (!Array.isArray(definition.checks) || definition.checks.length !== 100) throw new Error("QA definition must contain exactly 100 checks");
  const expectedIds = Array.from({ length: 100 }, (_, index) => `LQA-${String(index + 1).padStart(3, "0")}`);
  const actualIds = definition.checks.map((check) => check.id);
  if (!arraysEqual(actualIds, expectedIds) || new Set(actualIds).size !== 100) throw new Error("QA check IDs must be unique and contiguous from LQA-001 through LQA-100");
  for (const check of definition.checks) {
    if (!["STATIC", "RENDER", "NATIVE"].includes(check.mode)) throw new Error(`${check.id} has invalid mode`);
    if (!check.category?.trim() || !check.title?.trim()) throw new Error(`${check.id} lacks category or title`);
    if (check.mode === "STATIC" && !check.evaluator?.trim()) throw new Error(`${check.id} lacks a static evaluator`);
  }
  const modes = Object.fromEntries(["STATIC", "RENDER", "NATIVE"].map((mode) => [mode, definition.checks.filter((check) => check.mode === mode).length]));
  if (modes.STATIC !== 70 || modes.RENDER !== 25 || modes.NATIVE !== 5) throw new Error(`Unexpected mode cardinality: ${JSON.stringify(modes)}`);
}

async function buildContext(options) {
  const paths = {
    messages: resolve(siteRoot, "app/i18n/messages.json"),
    config: resolve(siteRoot, "app/i18n/config.ts"),
    critical: resolve(siteRoot, "app/i18n/critical-ui-source.json"),
    overrides: resolve(siteRoot, "app/i18n/critical-ui-overrides.json"),
    metadata: resolve(siteRoot, "app/i18n/metadata.generated.json"),
    routeSeo: resolve(siteRoot, "app/i18n/route-seo.json"),
    pending: resolve(siteRoot, "app/i18n/pending-visible-source.json"),
    payloadContract: resolve(siteRoot, "app/i18n/payload-contract.json"),
    sitemap: resolve(siteRoot, "app/sitemap.ts"),
    reviewedPolicy: resolve(siteRoot, "app/i18n/reviewed-localization-policy.json"),
  };
  const [definitionRaw, messagesRaw, configRaw, critical, overrides, metadata, routeSeo, pending, payloadContract, sitemapRaw, reviewedPolicy, nativeEvidence, languageIdEvidence, renderEvidence] = await Promise.all([
    readText(definitionPath),
    readText(paths.messages),
    readText(paths.config),
    readJson(paths.critical),
    readJson(paths.overrides),
    readJson(paths.metadata),
    readJson(paths.routeSeo),
    readJson(paths.pending),
    readJson(paths.payloadContract),
    readText(paths.sitemap),
    readJson(paths.reviewedPolicy),
    readOptionalJson(options.nativeEvidence),
    readOptionalJson(options.languageIdEvidence),
    readOptionalJson(options.renderEvidence),
  ]);
  const definition = JSON.parse(definitionRaw);
  const catalog = JSON.parse(messagesRaw);
  validateDefinition(definition);
  const config = parseLocaleConfig(configRaw);
  if (
    reviewedPolicy.schema !== "iat-reviewed-localization-policy/v1"
    || reviewedPolicy.mode !== "GLOBAL_FAIL_CLOSED"
    || reviewedPolicy.fallback !== "canonical-english"
    || reviewedPolicy.machineDraftRuntimeAllowed !== false
    || reviewedPolicy.unreviewedTargetLanguageBundleAllowed !== false
    || reviewedPolicy.unreviewedLocaleAutonymsAllowed !== false
    || reviewedPolicy.directComponentReviewBundleComplete !== false
    || reviewedPolicy.localeStatus?.en !== "SOURCE"
    || config.codes.some((locale) => !Object.hasOwn(reviewedPolicy.localeStatus ?? {}, locale))
    || !Array.isArray(reviewedPolicy.reviews)
  ) throw new Error("Reviewed-localization policy is missing, unsafe, or incomplete");
  const routes = parseSitemapRoutes(sitemapRaw);
  const sourceKeys = Object.keys(catalog.messages.en ?? {});
  const payloadRoot = resolve(siteRoot, `public/${payloadContract.assetNamespace}/${payloadContract.payloadNamespaceSha256.slice(0, 16)}`);
  const payloadEntries = await Promise.all(config.codes.map(async (locale) => {
    try {
      return [locale, await readJson(resolve(payloadRoot, `${locale}.json`))];
    } catch {
      return [locale, null];
    }
  }));
  return {
    definition,
    catalog,
    config,
    critical,
    overrides,
    metadata,
    routeSeo,
    pending,
    routes,
    sourceKeys,
    sourceKeySet: new Set(sourceKeys),
    payloads: Object.fromEntries(payloadEntries),
    payloadContract,
    nativeEvidence,
    languageIdEvidence,
    renderEvidence,
    reviewedPolicy,
    reviewIndex: new Set((reviewedPolicy.reviews ?? []).map((review) => reviewKey(review.locale, review.source))),
    localeDigests: Object.fromEntries(config.codes.map((locale) => [locale, canonicalDigest(catalog.messages[locale] ?? {})])),
    digests: {
      definitionSha256: sha256(definitionRaw),
      messagesFileSha256: sha256(messagesRaw),
      criticalSha256: canonicalDigest(critical),
      overridesSha256: canonicalDigest(overrides),
      metadataSha256: canonicalDigest(metadata),
      routeSeoSha256: canonicalDigest(routeSeo),
      pendingSha256: canonicalDigest(pending),
      reviewedPolicySha256: canonicalDigest(reviewedPolicy),
    },
    rtlLocales: new Set(["ar", "ur"]),
    nonLatinLocales: new Set(["zh", "hi", "ar", "ur", "bn", "ru", "be", "bg", "mk", "sr", "uk", "ja", "el", "hy", "ka"]),
    mojibakePattern: /(?:[ÃÂÐÑØÙÄÅÎÏÕÖ][\u0080-\u00BFıŒœŠšŸŽž–—‘’‚“”„†‡•…‰‹›€™]|â[\u0080-\u00BFŒœŠšŸŽž–—‘’‚“”„†‡•…‰‹›€™]|áƒ)/u,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const context = await buildContext(options);
  if (context.config.codes.length !== 50) throw new Error(`Configured locale count is ${context.config.codes.length}, expected 50`);

  const localeRows = context.config.codes.map((locale) => {
    const checks = context.definition.checks.map((check) => evaluate(context, locale, check));
    const summary = summarize(checks);
    return { locale, localeMessagesSha256: context.localeDigests[locale], status: aggregateStatus(summary), summary, checks };
  });
  const allResults = localeRows.flatMap((row) => row.checks);
  if (allResults.length !== 5000) throw new Error(`Generated ${allResults.length} results, expected exactly 5000`);
  const summary = summarize(allResults);
  const staticSummary = summarize(allResults.filter((result) => result.mode === "STATIC"));
  const renderSummary = summarize(allResults.filter((result) => result.mode === "RENDER"));
  const nativeSummary = summarize(allResults.filter((result) => result.mode === "NATIVE"));
  const nativePassClaimAllowed = nativeSummary.PASS === 250 && nativeSummary.FAIL === 0 && nativeSummary.HOLD === 0 && nativeSummary.NOT_RUN === 0;
  const worktreeStatus = git(["status", "--short", "--untracked-files=all"]);
  const scorecard = {
    schema: "iat-language-qa-scorecard/v1",
    generatedAt: new Date().toISOString(),
    sourceBinding: {
      headCommit: git(["rev-parse", "HEAD"]),
      headTree: git(["rev-parse", "HEAD^{tree}"]),
      worktreeDirty: Boolean(worktreeStatus),
      worktreeStatusSha256: sha256(worktreeStatus),
      ...context.digests,
    },
    scope: {
      locales: localeRows.length,
      checksPerLocale: context.definition.checks.length,
      results: allResults.length,
      canonicalStrings: context.sourceKeys.length,
      canonicalRoutes: context.routes.length,
      reviewedRuntimeCells: context.catalog.meta.runtimeLocalizationPolicy?.reviewedRuntimeCells ?? 0,
      canonicalFallbackCells: context.catalog.meta.runtimeLocalizationPolicy?.fallbackRuntimeCells ?? 0,
    },
    policy: {
      runtimeMode: context.reviewedPolicy.mode,
      runtimeFallback: context.reviewedPolicy.fallback,
      statusVocabulary: ["PASS", "FAIL", "HOLD", "NOT_RUN"],
      renderChecks: "PASS or FAIL only from a source-bound clean-build browser/render evidence artifact; missing checks remain NOT_RUN.",
      nativeChecks: "PASS only from complete source-bound native-review records; heuristic PASS never satisfies native review.",
      reviewerIdentityBoundary: "The generator validates record completeness and binding, not the real-world identity or legal qualification of a reviewer.",
      overallPassRequires: "All 5,000 results PASS, including separately obtained render and native evidence.",
    },
    status: aggregateStatus(summary),
    summary,
    lanes: {
      static: { status: aggregateStatus(staticSummary), summary: staticSummary },
      render: { status: aggregateStatus(renderSummary), summary: renderSummary },
      native: { status: aggregateStatus(nativeSummary), summary: nativeSummary, nativePassClaimAllowed },
    },
    assurance: {
      allFiveThousandPassed: summary.PASS === 5000,
      nativeQualityClaimAllowed: nativePassClaimAllowed,
      cadenceAndSlangCertifiedByAutomation: false,
      releaseApproved: false,
      mainnetStateChanged: false,
    },
    evidenceInputs: {
      nativeReview: { path: publicEvidencePath(options.nativeEvidence), present: context.nativeEvidence.present, parseError: context.nativeEvidence.error ?? null },
      languageId: { path: publicEvidencePath(options.languageIdEvidence), present: context.languageIdEvidence.present, parseError: context.languageIdEvidence.error ?? null },
      render: { path: publicEvidencePath(options.renderEvidence), present: context.renderEvidence.present, parseError: context.renderEvidence.error ?? null },
    },
    locales: localeRows,
  };

  const serialized = `${JSON.stringify(scorecard, null, options.compact ? 0 : 2)}\n`;
  if (options.output) {
    if (!options.replace) {
      try {
        await access(options.output);
        throw new Error(`Refusing to overwrite existing output: ${options.output}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stderr.write(`Wrote ${allResults.length} language-QA results to ${options.output}\n`);
  } else process.stdout.write(serialized);

  if (options.gate) {
    if (summary.FAIL > 0) process.exitCode = 1;
    else if (summary.HOLD > 0 || summary.NOT_RUN > 0) process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`Language QA scorecard generation failed: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});

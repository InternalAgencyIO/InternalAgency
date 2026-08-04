import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const outputRoot = resolve(root, "public/audits/localization-qa-20260803/review-templates");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

const [catalogRaw, routeSeoRaw, definitionRaw] = await Promise.all([
  readFile(resolve(root, "app/i18n/messages.json"), "utf8"),
  readFile(resolve(root, "app/i18n/route-seo.json"), "utf8"),
  readFile(resolve(root, "app/i18n/language-qa-checks.v1.json"), "utf8"),
]);
const catalog = JSON.parse(catalogRaw);
const routeSeo = JSON.parse(routeSeoRaw);
const definition = JSON.parse(definitionRaw);
const locales = Object.keys(catalog.messages);
const routes = Object.keys(routeSeo).sort();
const nativeCheckIds = definition.checks.filter(({ mode }) => mode === "NATIVE").map(({ id }) => id);
const catalogSha256 = sha256(catalogRaw);
const reviewedKeyCount = Object.keys(catalog.messages.en).length;

if (locales.length !== 50 || routes.length !== 25 || nativeCheckIds.join(",") !== "LQA-096,LQA-097,LQA-098,LQA-099,LQA-100") {
  throw new Error(`Unexpected review scope: ${locales.length} locales, ${routes.length} routes, ${nativeCheckIds.length} native checks`);
}

const localeDigests = Object.fromEntries(locales.map((locale) => [locale, sha256(canonical(catalog.messages[locale]))]));
const reviewerEnvelope = () => ({
  reviewerId: "",
  role: "",
  localeCompetency: "",
  independenceStatement: "",
});
const nativeRecord = (locale, id) => ({
  status: "HOLD",
  reviewer: reviewerEnvelope(),
  evidence: "",
  reviewedAt: "",
  sourceCatalogSha256: catalogSha256,
  localeMessagesSha256: localeDigests[locale],
  reviewedKeyCount,
  ...(id === "LQA-098" ? { targetRegion: "" } : {}),
  ...(id === "LQA-100" ? { routeCoverage: routes } : {}),
});

const nativeTemplate = {
  schema: "iat-native-review-signoffs/v1",
  templateStatus: "UNREVIEWED_HOLD",
  catalogSha256,
  instructions: "Replace HOLD with PASS or FAIL only after accountable native review. Fill every reviewer and evidence field. This template is not evidence.",
  locales: Object.fromEntries(locales.map((locale) => [locale, {
    localeMessagesSha256: localeDigests[locale],
    checks: Object.fromEntries(nativeCheckIds.map((id) => [id, nativeRecord(locale, id)])),
  }])),
};

const languageIdTemplate = {
  schema: "iat-language-id-evidence/v1",
  templateStatus: "UNEXECUTED_HOLD",
  instructions: "Record output from an independent language-identification engine. Do not prefill identifiedLocale, confidence, or engine from the expected locale.",
  locales: Object.fromEntries(locales.map((locale) => [locale, {
    expectedLocale: locale,
    localeMessagesSha256: localeDigests[locale],
    identifiedLocale: "",
    confidence: 0,
    threshold: 0.8,
    engine: "",
  }])),
};

await mkdir(outputRoot, { recursive: true });
await Promise.all([
  writeFile(resolve(outputRoot, "native-review-signoffs.template.json"), `${JSON.stringify(nativeTemplate, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputRoot, "language-id-evidence.template.json"), `${JSON.stringify(languageIdTemplate, null, 2)}\n`, "utf8"),
]);
console.log(`Generated fail-closed review templates for ${locales.length} locales at ${outputRoot}`);

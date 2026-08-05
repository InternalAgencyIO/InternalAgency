import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "app", "i18n", "messages.json");
const criticalOverridesPath = path.join(root, "app", "i18n", "critical-ui-overrides.json");
const reviewedLocalizationPolicyPath = path.join(root, "app", "i18n", "reviewed-localization-policy.json");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const criticalOverrides = JSON.parse(fs.readFileSync(criticalOverridesPath, "utf8"));
const reviewedLocalizationPolicy = JSON.parse(fs.readFileSync(reviewedLocalizationPolicyPath, "utf8"));
const sanitizeOverride = (value) => value.normalize("NFC").replace(/[\u202A-\u202E\u2066-\u2069]/gu, "");

if (Object.keys(criticalOverrides.translations ?? {}).length !== 0) {
  throw new Error("Legacy critical translation candidates must remain removed; use reviewedLocalizationPolicy with accountable evidence");
}

const catalogLocales = Object.keys(catalog.messages);
const policyLocales = Object.keys(reviewedLocalizationPolicy.localeStatus ?? {});
if (
  reviewedLocalizationPolicy.schema !== "iat-reviewed-localization-policy/v1"
  || reviewedLocalizationPolicy.mode !== "GLOBAL_FAIL_CLOSED"
  || reviewedLocalizationPolicy.fallback !== "canonical-english"
  || reviewedLocalizationPolicy.machineDraftRuntimeAllowed !== false
  || reviewedLocalizationPolicy.unreviewedTargetLanguageBundleAllowed !== false
  || reviewedLocalizationPolicy.unreviewedLocaleAutonymsAllowed !== false
  || reviewedLocalizationPolicy.directComponentReviewBundleComplete !== false
  || reviewedLocalizationPolicy.reviewRequirements?.accountableHumanReviewer !== true
  || reviewedLocalizationPolicy.reviewRequirements?.sourceBound !== true
  || reviewedLocalizationPolicy.reviewRequirements?.evidenceRequired !== true
  || reviewedLocalizationPolicy.reviewRequirements?.machineGeneratedAllowed !== false
  || reviewedLocalizationPolicy.reviewRequirements?.cryptographicContentBinding !== true
  || reviewedLocalizationPolicy.reviewRequirements?.trackedEvidenceArtifact !== true
  || policyLocales.length !== catalogLocales.length
  || catalogLocales.some((locale) => !Object.hasOwn(reviewedLocalizationPolicy.localeStatus, locale))
  || reviewedLocalizationPolicy.localeStatus.en !== "SOURCE"
) {
  throw new Error("Reviewed-localization policy must fail closed across the exact catalog locale roster");
}

const reviewedTranslations = reviewedLocalizationPolicy.translations ?? {};
const reviews = reviewedLocalizationPolicy.reviews ?? [];
if (!Array.isArray(reviews)) throw new Error("Reviewed-localization reviews must be an array");
const reviewKey = (locale, source) => `${locale}\u0000${source}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const reviewEvidenceRoot = path.join(root, "public", "audits", "localization-qa-20260803", "review-evidence");
const approvedReviews = new Map();
for (const review of reviews) {
  const approvedTranslation = reviewedTranslations[review?.locale]?.[review?.source];
  const evidencePath = typeof review?.evidencePath === "string" ? review.evidencePath.replaceAll("\\", "/") : "";
  const evidenceAbsolute = evidencePath ? path.resolve(root, evidencePath) : "";
  if (
    review?.status !== "APPROVED"
    || review.machineGenerated !== false
    || review.origin !== "HUMAN_AUTHORED_OR_CORRECTED"
    || typeof review.locale !== "string"
    || typeof review.source !== "string"
    || typeof review.reviewer?.reviewerId !== "string"
    || !review.reviewer.reviewerId.trim()
    || typeof review.reviewer?.role !== "string"
    || !review.reviewer.role.trim()
    || typeof review.reviewer?.localeCompetency !== "string"
    || !review.reviewer.localeCompetency.trim()
    || typeof review.reviewedAt !== "string"
    || !review.reviewedAt.trim()
    || typeof review.evidence !== "string"
    || !review.evidence.trim()
    || !/^[a-f0-9]{64}$/u.test(review.sourceSha256 ?? "")
    || !/^[a-f0-9]{64}$/u.test(review.translationSha256 ?? "")
    || !/^[a-f0-9]{64}$/u.test(review.evidenceSha256 ?? "")
    || typeof approvedTranslation !== "string"
    || review.sourceSha256 !== sha256(review.source)
    || review.translationSha256 !== sha256(sanitizeOverride(approvedTranslation))
    || !evidencePath.startsWith("public/audits/localization-qa-20260803/review-evidence/")
    || !evidenceAbsolute.startsWith(`${reviewEvidenceRoot}${path.sep}`)
    || !fs.existsSync(evidenceAbsolute)
    || review.evidenceSha256 !== (fs.existsSync(evidenceAbsolute) ? sha256(fs.readFileSync(evidenceAbsolute)) : "")
  ) {
    throw new Error("Every approved localization review must be accountable, human-authored or corrected, source/translation-digest-bound, and backed by an exact review-evidence artifact");
  }
  const key = reviewKey(review.locale, review.source);
  if (approvedReviews.has(key)) throw new Error(`Duplicate reviewed-localization evidence: ${review.locale}: ${review.source}`);
  approvedReviews.set(key, review);
}

let globalReviewCount = 0;
let globalFallbackCount = 0;
for (const locale of catalogLocales) {
  if (locale === "en") continue;
  const status = reviewedLocalizationPolicy.localeStatus[locale];
  if (!["HOLD", "PARTIAL_REVIEW", "REVIEWED"].includes(status)) {
    throw new Error(`Invalid reviewed-localization status for ${locale}: ${status}`);
  }
  const reviewed = reviewedTranslations[locale] ?? {};
  if (status === "REVIEWED") {
    const canonicalSources = Object.keys(catalog.messages.en);
    const missingTranslations = canonicalSources.filter((source) => !Object.hasOwn(reviewed, source));
    const missingEvidence = canonicalSources.filter((source) => !approvedReviews.has(reviewKey(locale, source)));
    if (missingTranslations.length > 0 || missingEvidence.length > 0) {
      throw new Error(
        `${locale} cannot enter REVIEWED without explicit translations and valid review evidence for every canonical runtime source`,
      );
    }
    throw new Error(
      `${locale} cannot enter REVIEWED until direct-component copy has a complete source-bound review bundle`,
    );
  }
  for (const source of Object.keys(catalog.messages.en)) {
    if (Object.hasOwn(reviewed, source)) {
      if (status === "HOLD") throw new Error(`${locale} cannot publish reviewed translations while locale status is HOLD`);
      if (!approvedReviews.has(reviewKey(locale, source))) {
        throw new Error(`Missing accountable review evidence for ${locale}: ${source}`);
      }
      catalog.messages[locale][source] = sanitizeOverride(reviewed[source]);
      globalReviewCount += 1;
    } else {
      catalog.messages[locale][source] = source;
      globalFallbackCount += 1;
    }
  }
}

for (const [locale, reviewed] of Object.entries(reviewedTranslations)) {
  if (!catalog.messages[locale] || locale === "en") throw new Error(`Invalid reviewed-translation locale: ${locale}`);
  for (const source of Object.keys(reviewed)) {
    if (!Object.hasOwn(catalog.messages.en, source)) throw new Error(`Reviewed translation is not source-bound for ${locale}: ${source}`);
  }
}

if (approvedReviews.size !== globalReviewCount) {
  throw new Error("Reviewed-localization evidence contains an unused or stale record");
}

catalog.meta.runtimeLocalizationPolicy = {
  mode: reviewedLocalizationPolicy.mode,
  fallback: reviewedLocalizationPolicy.fallback,
  machineDraftRuntimeAllowed: false,
  reviewedRuntimeCells: globalReviewCount,
  fallbackRuntimeCells: globalFallbackCount,
};
catalog.meta.method = "Canonical English fallback with only evidence-bound, human-reviewed locale overrides eligible for runtime.";
catalog.meta.translationEngine = "No machine translation is active at runtime; legacy draft lineage is quarantined outside the reviewed override policy.";
catalog.meta.translationMode = "GLOBAL_FAIL_CLOSED reviewed-only static committed output with canonical English fallback; no runtime translation service.";
catalog.meta.translationDraftStatus = "QUARANTINED_MACHINE_DRAFTS_RUNTIME_REVIEW_ONLY";
catalog.meta.sourceMatchRefresh = {
  ...(catalog.meta.sourceMatchRefresh ?? {}),
  mode: "LEGACY_MACHINE_DRAFT_QUARANTINED_NOT_RUNTIME",
};

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(
  `Legacy machine-draft candidates are absent; activated ${globalReviewCount} evidence-backed runtime translations and ${globalFallbackCount} global fail-closed fallbacks.`,
);

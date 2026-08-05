import { createHash } from "node:crypto";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const payloadFields = ["catalogSha256", "contentSha256", "locale", "messages", "schema", "sourceCount", "sourceKeysSha256"].sort();

function decodeHtmlTextOnce(value) {
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|apos|gt|lt|quot);/giu, (entity, token) => {
    const normalized = token.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "apos") return "'";
    if (normalized === "gt") return ">";
    if (normalized === "lt") return "<";
    if (normalized === "quot") return '"';
    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  });
}

export function normalizeHtmlMetadataText(value) {
  // This is comparison-only data. Preserve literal markup instead of attempting
  // an incomplete multi-character sanitizer that entity decoding could bypass.
  return decodeHtmlTextOnce(value).trim().replace(/\s+/gu, " ");
}

export function payloadIntegrityError({ payload, contract, locale }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "payload is not an object";
  if (JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(payloadFields)) {
    return "payload has missing or unexpected contract fields";
  }
  if (!payload.messages || typeof payload.messages !== "object" || Array.isArray(payload.messages)) {
    return "payload messages are not an object";
  }
  if (Object.values(payload.messages).some((value) => typeof value !== "string")) {
    return "payload messages contain a non-string value";
  }
  if (payload.locale !== locale) return `payload locale ${payload.locale ?? "missing"} != ${locale}`;
  const sourceKeys = Object.keys(payload.messages);
  if (
    payload.schema !== contract.schema
    || payload.catalogSha256 !== contract.catalogSha256
    || payload.sourceCount !== contract.sourceCount
    || sourceKeys.length !== contract.sourceCount
    || payload.sourceKeysSha256 !== contract.sourceKeysSha256
  ) return "payload metadata does not match the committed contract";
  const sourceKeysSha256 = sha256(JSON.stringify(sourceKeys));
  if (sourceKeysSha256 !== payload.sourceKeysSha256) {
    return `payload source-key SHA-256 ${sourceKeysSha256} != committed ${payload.sourceKeysSha256}`;
  }
  const contentSha256 = sha256(JSON.stringify({
    schema: payload.schema,
    catalogSha256: payload.catalogSha256,
    sourceCount: payload.sourceCount,
    locale: payload.locale,
    sourceKeysSha256: payload.sourceKeysSha256,
    messages: payload.messages,
  }));
  const expectedContentSha256 = contract.localeContentSha256?.[locale];
  if (!expectedContentSha256 || payload.contentSha256 !== expectedContentSha256 || contentSha256 !== expectedContentSha256) {
    return `payload content SHA-256 ${contentSha256} does not match its payload and contract bindings`;
  }
  return null;
}

export function responseIdentityError(requestedUrl, response) {
  const requested = new URL(requestedUrl);
  const final = new URL(response.url);
  if (response.redirected) return `unexpected redirect to ${response.url}`;
  if (final.origin !== requested.origin || final.pathname !== requested.pathname) {
    return `final origin/path ${final.origin}${final.pathname} != ${requested.origin}${requested.pathname}`;
  }
  return null;
}

export function cachePolicyError({ cacheControl, contentAddressed }) {
  const policy = cacheControl?.toLowerCase() ?? "";
  const directives = new Set(policy.split(",").map((directive) => directive.trim()).filter(Boolean));
  if (contentAddressed) {
    if (directives.has("immutable")) return null;
    if (directives.has("max-age=0") && directives.has("must-revalidate")) return null;
    return `content-addressed response cache policy is not immutable or immediately revalidated: ${cacheControl ?? "missing"}`;
  }
  if (directives.has("no-store") && directives.has("must-revalidate")) return null;
  return `HTML cache policy is not no-store and must-revalidate: ${cacheControl ?? "missing"}`;
}

const normalizeVisible = (value) => value.trim().replace(/\s+/gu, " ");

export function localizedCoverageError({ sourceValues, currentValues, localeMessages }) {
  const canonicalSources = sourceValues.filter((source) => Object.hasOwn(localeMessages, source));
  if (canonicalSources.length === 0) return "rendered page exposed no canonical pre-hydration source values";
  const counts = (values) => {
    const result = new Map();
    for (const value of values.map(normalizeVisible)) result.set(value, (result.get(value) ?? 0) + 1);
    return result;
  };
  const currentCounts = counts(currentValues);
  const expectedCounts = counts(canonicalSources.map((source) => localeMessages[source]));
  const catalogTargetValues = new Set(Object.values(localeMessages).map(normalizeVisible));
  const missing = [...expectedCounts]
    .filter(([value, count]) => (currentCounts.get(value) ?? 0) < count)
    .map(([value]) => value);
  if (missing.length > 0) {
    return `${missing.length} committed localized value(s) absent after hydration: ${missing.slice(0, 3).join(" | ")}`;
  }
  const leaks = [...new Set(canonicalSources)].filter((source) => {
    if (localeMessages[source] === source) return false;
    if (catalogTargetValues.has(normalizeVisible(source))) return false;
    return (currentCounts.get(normalizeVisible(source)) ?? 0) > (expectedCounts.get(normalizeVisible(source)) ?? 0);
  });
  if (leaks.length > 0) {
    return `${leaks.length} replaced English source value(s) remain after hydration: ${leaks.slice(0, 3).join(" | ")}`;
  }
  return null;
}

export function runtimeBundleError({ contentType, bytes, contract }) {
  if (!contentType?.toLowerCase().includes("javascript")) {
    return `unexpected runtime content type ${contentType ?? "missing"}`;
  }
  if (bytes.length < 1_000) {
    return `unexpectedly small runtime response (${bytes.length} bytes)`;
  }

  const runtime = bytes.toString("utf8");
  const requiredMarkers = [
    contract.schema,
    contract.assetNamespace,
    contract.catalogSha256,
    contract.catalogSha256.slice(0, 16),
    contract.payloadNamespaceSha256,
    contract.payloadNamespaceSha256.slice(0, 16),
    contract.sourceKeysSha256,
    "payload-contract-failed",
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !runtime.includes(marker));
  if (missingMarkers.length > 0) {
    return `runtime missing committed marker(s): ${missingMarkers.join(", ")}`;
  }
  if (runtime.includes("/i18n/")) {
    return "runtime still contains the legacy /i18n/ payload path";
  }
  const missingLocaleDigest = Object.entries(contract.localeContentSha256 ?? {})
    .find(([, digest]) => !runtime.includes(digest));
  if (missingLocaleDigest) {
    return `runtime missing committed payload content digest for ${missingLocaleDigest[0]}`;
  }
  const retiredReference = (contract.retiredCatalogNamespaces ?? []).find((retired) => runtime.includes(retired));
  if (retiredReference) {
    return `runtime still references retired locale payload namespace ${retiredReference}`;
  }
  return null;
}

export function runtimeParityError(results) {
  if (results.length < 2) return `runtime parity requires at least 2 domains; found ${results.length}`;
  if (results.some((result) => !result.ok || !result.assetPath || !result.sha256)) {
    return "runtime parity unavailable because a per-domain runtime result is incomplete";
  }

  const [reference, ...others] = results;
  const pathDrift = others.find((result) => result.assetPath !== reference.assetPath);
  if (pathDrift) {
    return `runtime asset path ${pathDrift.assetPath} != ${reference.assetPath}`;
  }
  const hashDrift = others.find((result) => result.sha256 !== reference.sha256);
  if (hashDrift) {
    return `runtime SHA-256 ${hashDrift.sha256} != ${reference.sha256}`;
  }
  return null;
}

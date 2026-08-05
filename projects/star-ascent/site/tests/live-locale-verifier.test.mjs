import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  cachePolicyError,
  localizedCoverageError,
  normalizeHtmlMetadataText,
  payloadIntegrityError,
  responseIdentityError,
  runtimeBundleError,
  runtimeParityError,
} from "../scripts/live-locale-verifier-lib.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const messages = { Hello: "Hello", "Mainnet stays on HOLD.": "Mainnet stays on HOLD." };
const sourceKeysSha256 = sha256(JSON.stringify(Object.keys(messages)));
const payloadDigestInput = {
  schema: "iat-locale-payload/v2",
  catalogSha256: "a".repeat(64),
  sourceCount: Object.keys(messages).length,
  locale: "tr",
  sourceKeysSha256,
  messages,
};
const contentSha256 = sha256(JSON.stringify(payloadDigestInput));
const assetNamespace = "i18n-v2";
const payloadNamespaceSha256 = sha256(JSON.stringify({
  schema: payloadDigestInput.schema,
  assetNamespace,
  catalogSha256: payloadDigestInput.catalogSha256,
  sourceCount: payloadDigestInput.sourceCount,
  sourceKeysSha256,
  localeContentSha256: { tr: contentSha256 },
}));
const contract = {
  schema: payloadDigestInput.schema,
  assetNamespace,
  catalogSha256: payloadDigestInput.catalogSha256,
  sourceCount: payloadDigestInput.sourceCount,
  sourceKeysSha256,
  localeContentSha256: { tr: contentSha256 },
  payloadNamespaceSha256,
  retiredCatalogNamespaces: ["i18n-v2/4c1f960016ec313e"],
};
const validPayload = { ...payloadDigestInput, contentSha256 };

test("metadata normalization decodes once without incomplete markup stripping", () => {
  assert.equal(normalizeHtmlMetadataText("  Launch &amp; HOLD  "), "Launch & HOLD");
  assert.equal(normalizeHtmlMetadataText("&amp;lt;script&amp;gt;"), "&lt;script&gt;");
  assert.equal(normalizeHtmlMetadataText("<script>literal comparison text</script>"), "<script>literal comparison text</script>");
  assert.equal(normalizeHtmlMetadataText("Line\n  two"), "Line two");
});

function validRuntime() {
  return Buffer.from(
    [
      contract.schema,
      contract.assetNamespace,
      contract.catalogSha256,
      contract.catalogSha256.slice(0, 16),
      contract.payloadNamespaceSha256,
      contract.payloadNamespaceSha256.slice(0, 16),
      contract.sourceKeysSha256,
      contract.localeContentSha256.tr,
      "payload-contract-failed",
      "x".repeat(1_000),
    ].join("|"),
  );
}

test("payload integrity binds exact source-key order and per-locale content before activation", () => {
  assert.equal(payloadIntegrityError({ payload: validPayload, contract, locale: "tr" }), null);
  assert.match(
    payloadIntegrityError({ payload: { ...validPayload, messages: { ...messages, Hello: "Tampered" } }, contract, locale: "tr" }),
    /content SHA-256/,
  );
  assert.match(
    payloadIntegrityError({ payload: { ...validPayload, messages: Object.fromEntries(Object.entries(messages).reverse()) }, contract, locale: "tr" }),
    /source-key SHA-256/,
  );
  assert.match(payloadIntegrityError({ payload: { ...validPayload, locale: "zh" }, contract, locale: "tr" }), /payload locale/);
  assert.match(payloadIntegrityError({ payload: { ...validPayload, unexpected: true }, contract, locale: "tr" }), /unexpected/);
});

test("response identity accepts only the exact requested origin and path without redirects", () => {
  const requested = "https://internalagency.io/assets/LocaleRuntime-current.js?verify=1";
  assert.equal(responseIdentityError(requested, { redirected: false, url: requested }), null);
  assert.match(
    responseIdentityError(requested, { redirected: true, url: "https://internalagency.io/login" }),
    /unexpected redirect/,
  );
  assert.match(
    responseIdentityError(requested, { redirected: false, url: "https://ileriakil.com/assets/LocaleRuntime-current.js" }),
    /final origin\/path/,
  );
  assert.match(
    responseIdentityError(requested, { redirected: false, url: "https://internalagency.io/assets/other.js" }),
    /final origin\/path/,
  );
});

test("cache policy prevents stale HTML and safely handles content-addressed assets", () => {
  assert.equal(
    cachePolicyError({ cacheControl: "no-store, must-revalidate", contentAddressed: false }),
    null,
  );
  assert.equal(
    cachePolicyError({ cacheControl: "public, max-age=0, must-revalidate", contentAddressed: true }),
    null,
  );
  assert.equal(
    cachePolicyError({ cacheControl: "public, max-age=31536000, immutable", contentAddressed: true }),
    null,
  );
  assert.match(cachePolicyError({ cacheControl: "max-age=300", contentAddressed: false }), /HTML cache policy/);
  assert.match(
    cachePolicyError({ cacheControl: "public, max-age=3600", contentAddressed: true }),
    /content-addressed response/,
  );
  assert.match(cachePolicyError({ cacheControl: null, contentAddressed: false }), /missing/);
});

test("localized coverage requires committed replacements and rejects English leakage", () => {
  const localeMessages = { Hello: "你好", "Internal Agency": "Internal Agency" };
  assert.equal(
    localizedCoverageError({
      sourceValues: ["Hello", "Internal Agency"],
      currentValues: ["你好", "Internal Agency"],
      localeMessages,
    }),
    null,
  );
  assert.match(
    localizedCoverageError({ sourceValues: ["Hello"], currentValues: ["Hello"], localeMessages }),
    /absent/,
  );
  assert.match(
    localizedCoverageError({ sourceValues: ["Hello"], currentValues: ["你好", "Hello"], localeMessages }),
    /English source/,
  );
  assert.match(localizedCoverageError({ sourceValues: ["Unknown"], currentValues: [], localeMessages }), /no canonical/);
});

test("localized coverage accepts source/target collisions without masking a missing required replacement", () => {
  const localeMessages = { ASCENT: "STOP", "SOCIAL KIT": "STOP", STOP: "STOP!" };
  assert.equal(
    localizedCoverageError({
      sourceValues: ["ASCENT", "STOP"],
      currentValues: ["STOP", "STOP!", "STOP"],
      localeMessages,
    }),
    null,
  );
  assert.match(
    localizedCoverageError({ sourceValues: ["ASCENT", "STOP"], currentValues: ["STOP", "STOP"], localeMessages }),
    /absent/,
  );
});

test("coverage accepts canonical English fallback without misclassifying it as a reviewed translation", () => {
  const canonicalFallback = { Hello: "Hello", "Mainnet stays on HOLD.": "Mainnet stays on HOLD." };
  assert.equal(
    localizedCoverageError({
      sourceValues: Object.keys(canonicalFallback),
      currentValues: Object.values(canonicalFallback),
      localeMessages: canonicalFallback,
    }),
    null,
  );
  assert.match(
    localizedCoverageError({
      sourceValues: Object.keys(canonicalFallback),
      currentValues: ["Hello"],
      localeMessages: canonicalFallback,
    }),
    /absent/,
  );
});

test("runtime bundle contract accepts a complete current fingerprint", () => {
  assert.equal(
    runtimeBundleError({ contentType: "text/javascript; charset=utf-8", bytes: validRuntime(), contract }),
    null,
  );
});

test("runtime bundle contract fails closed on transport and size drift", () => {
  assert.match(runtimeBundleError({ contentType: "text/html", bytes: validRuntime(), contract }), /content type/);
  assert.match(
    runtimeBundleError({ contentType: "application/javascript", bytes: Buffer.from("small"), contract }),
    /unexpectedly small/,
  );
});

test("runtime bundle contract fails closed on every missing committed marker", () => {
  const markers = [
    contract.schema,
    contract.assetNamespace,
    contract.catalogSha256,
    contract.catalogSha256.slice(0, 16),
    contract.payloadNamespaceSha256,
    contract.payloadNamespaceSha256.slice(0, 16),
    contract.sourceKeysSha256,
    "payload-contract-failed",
  ];
  for (const marker of markers) {
    const mutated = Buffer.from(validRuntime().toString("utf8").replace(marker, "removed-marker"));
    assert.match(runtimeBundleError({ contentType: "application/javascript", bytes: mutated, contract }), /missing/);
  }
  const withoutLocaleDigest = Buffer.from(validRuntime().toString("utf8").replace(contract.localeContentSha256.tr, "removed-locale-digest"));
  assert.match(runtimeBundleError({ contentType: "application/javascript", bytes: withoutLocaleDigest, contract }), /payload content digest/);
});

test("runtime bundle contract rejects the retired payload path", () => {
  const mutated = Buffer.concat([validRuntime(), Buffer.from("|/i18n/zh.json")]);
  assert.match(runtimeBundleError({ contentType: "application/javascript", bytes: mutated, contract }), /legacy/);
});

test("runtime bundle contract rejects a retired content-addressed namespace", () => {
  const mutated = Buffer.concat([validRuntime(), Buffer.from(`|/${contract.retiredCatalogNamespaces[0]}/tr.json`)]);
  assert.match(runtimeBundleError({ contentType: "application/javascript", bytes: mutated, contract }), /retired locale payload namespace/);
});

test("runtime parity requires the same fingerprinted path and bytes on every domain", () => {
  const reference = {
    ok: true,
    assetPath: "/assets/LocaleRuntime-current.js",
    sha256: "a".repeat(64),
  };
  assert.equal(runtimeParityError([reference, { ...reference }]), null);
  assert.match(
    runtimeParityError([reference, { ...reference, assetPath: "/assets/LocaleRuntime-stale.js" }]),
    /asset path/,
  );
  assert.match(runtimeParityError([reference, { ...reference, sha256: "b".repeat(64) }]), /SHA-256/);
  assert.match(runtimeParityError([reference, { ok: false }]), /incomplete/);
  assert.match(runtimeParityError([reference]), /at least 2 domains/);
});

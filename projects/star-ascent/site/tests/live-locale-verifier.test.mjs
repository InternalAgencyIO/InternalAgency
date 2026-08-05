import assert from "node:assert/strict";
import test from "node:test";
import {
  cachePolicyError,
  localizedCoverageError,
  responseIdentityError,
  runtimeBundleError,
  runtimeParityError,
} from "../scripts/live-locale-verifier-lib.mjs";

const contract = {
  schema: "iat-locale-payload/v2",
  assetNamespace: "i18n-v2",
  catalogSha256: "893cf8efbbb850b5cfb4133987a135785269b087d2d650de3fcb1946f050adce",
};

function validRuntime() {
  return Buffer.from(
    [
      contract.schema,
      contract.assetNamespace,
      contract.catalogSha256,
      contract.catalogSha256.slice(0, 16),
      "payload-contract-failed",
      "x".repeat(1_000),
    ].join("|"),
  );
}

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
    "payload-contract-failed",
  ];
  for (const marker of markers) {
    const mutated = Buffer.from(validRuntime().toString("utf8").replace(marker, "removed-marker"));
    assert.match(runtimeBundleError({ contentType: "application/javascript", bytes: mutated, contract }), /missing/);
  }
});

test("runtime bundle contract rejects the retired payload path", () => {
  const mutated = Buffer.concat([validRuntime(), Buffer.from("|/i18n/zh.json")]);
  assert.match(runtimeBundleError({ contentType: "application/javascript", bytes: mutated, contract }), /legacy/);
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

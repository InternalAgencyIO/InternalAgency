import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  parseToken2022ConfidentialHostCompatibilityJson,
  TOKEN_2022_HOST_SOURCE_BINDINGS,
  validateToken2022ConfidentialHostCompatibilityManifest,
} from "../scripts/validate-iat-b3-token-2022-confidential-host-compatibility.mjs";

const SITE = resolve(import.meta.dirname, "..");
const REPOSITORY = resolve(SITE, "../../..");
const MANIFEST_PATH = resolve(
  SITE,
  "docs/b3/iat-b3-token-2022-confidential-host-compatibility.v1.json",
);
const MANIFEST = parseToken2022ConfidentialHostCompatibilityJson(
  readFileSync(MANIFEST_PATH, "utf8"),
  MANIFEST_PATH,
);
const BOUND_FILES = new Map(TOKEN_2022_HOST_SOURCE_BINDINGS.map((binding) => [
  binding.path,
  readFileSync(resolve(REPOSITORY, binding.path)),
]));
const clone = (value) => structuredClone(value);

test("canonical Token-2022 confidential host compatibility packet is complete but nonactivating", () => {
  const result = validateToken2022ConfidentialHostCompatibilityManifest(MANIFEST, {
    boundFiles: BOUND_FILES,
  });
  assert.deepEqual(result.violations, []);
  assert.equal(result.valid, true);
  assert.equal(result.hostCompatibilityComplete, true);
  assert.equal(result.privacyVaultLifecycleComplete, false);
  assert.equal(result.devnetVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.releaseAuthorizationVerified, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("packet rejects version, proof, lifecycle, bytecode, and Mainnet overclaims", () => {
  for (const mutate of [
    (value) => { value.dependencyPins.solanaZkSdk = "=4.0.1"; },
    (value) => { value.hostChecks.nonzeroCiphertextZeroProofRejected = false; },
    (value) => { value.standardProgramObservation.token2022Upgradeable = false; },
    (value) => { value.standardProgramObservation.token2022CeremonyTimeReattestationRequired = false; },
    (value) => { value.privacyVaultLifecycleComplete = true; },
    (value) => { value.devnetVerified = true; },
    (value) => { value.mainnetExecutionAuthorized = true; },
  ]) {
    const hostile = clone(MANIFEST);
    mutate(hostile);
    assert.equal(validateToken2022ConfidentialHostCompatibilityManifest(hostile, {
      boundFiles: BOUND_FILES,
    }).valid, false);
  }
});

test("packet rejects missing, modified, or unbound source bytes", () => {
  assert.equal(validateToken2022ConfidentialHostCompatibilityManifest(MANIFEST).valid, false);
  for (const binding of TOKEN_2022_HOST_SOURCE_BINDINGS) {
    const missing = new Map(BOUND_FILES);
    missing.delete(binding.path);
    assert.equal(validateToken2022ConfidentialHostCompatibilityManifest(MANIFEST, {
      boundFiles: missing,
    }).valid, false);
    const changed = new Map(BOUND_FILES);
    changed.set(binding.path, Buffer.concat([changed.get(binding.path), Buffer.from([0])]));
    assert.equal(validateToken2022ConfidentialHostCompatibilityManifest(MANIFEST, {
      boundFiles: changed,
    }).valid, false);
  }
});

test("packet parser rejects duplicate JSON members", () => {
  assert.throws(
    () => parseToken2022ConfidentialHostCompatibilityJson('{"schema":"a","schema":"b"}'),
    /duplicate JSON member/u,
  );
});

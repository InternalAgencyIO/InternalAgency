#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const TOKEN_2022_HOST_COMPATIBILITY_SCHEMA =
  "iat-b3-token-2022-confidential-host-compatibility/v1";
export const TOKEN_2022_HOST_COMPATIBILITY_STATUS =
  "EXACT_HOST_COMPATIBILITY_COMPLETE_RELEASE_HOLD";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(SCRIPT_ROOT, "..");
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, "../../../..");
const DEFAULT_MANIFEST_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-token-2022-confidential-host-compatibility.v1.json",
);

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "status",
  "scope",
  "sourceBindings",
  "dependencyPins",
  "hostChecks",
  "standardProgramObservation",
  "hostCompatibilityComplete",
  "privacyVaultLifecycleComplete",
  "devnetVerified",
  "activationReady",
  "releaseAuthorizationVerified",
  "mainnetExecutionAuthorized",
  "mainnetStatus",
]);

const CERTIFIES = Object.freeze([
  "EXACT_DEPENDENCY_AND_STANDARD_PROGRAM_IDENTITY_BINDING",
  "STRICT_READ_ONLY_MINT_AND_CONFIDENTIAL_ACCOUNT_PARSING",
  "ELGAMAL_PUBLIC_KEY_AND_PERSISTED_CIPHERTEXT_CURVE_VALIDATION",
  "PUBLIC_KEY_VALIDITY_AND_ZERO_CIPHERTEXT_PROOF_PRIMITIVE_ROUND_TRIPS",
  "FINALIZED_MAINNET_STANDARD_PROGRAM_SOURCE_EQUIVALENCE_OBSERVATION",
]);

const DOES_NOT_CERTIFY = Object.freeze([
  "CONFIDENTIAL_TRANSFER_OR_WITHDRAW_PROOF_LIFECYCLE",
  "PROOF_CONTEXT_INSTRUCTION_CONSTRUCTION_OR_CLOSURE",
  "WALLET_KEYSTORE_JOURNAL_OR_RECOVERY",
  "TOKEN_2022_CEREMONY_TIME_BYTECODE_REATTESTATION",
  "DEVNET_TRANSFER_HOOK_OR_ROLLBACK_EXECUTION",
  "PRODUCTION_IDENTITY_MINT_DEPLOYMENT_ACTIVATION_OR_MAINNET_AUTHORIZATION",
]);

export const TOKEN_2022_HOST_SOURCE_BINDINGS = Object.freeze([
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/Cargo.toml",
    sha256: "02838be1e69291fa509278222e91b1c166fddedca6c44c1e10d89e010792c147",
    byteLength: 770,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/src/lib.rs",
    sha256: "aa6cbbc564332a69f25ec1dc8e6ca6910114969b5c76000fdf398e406d33ea09",
    byteLength: 51952,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/src/token_2022_host.rs",
    sha256: "8499cf37e7a50b8c07912d3d2f1b51f767300e15722478dafc7e52e185fdeb5a",
    byteLength: 23419,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/tests/token_2022_host_spec.rs",
    sha256: "888cf3fb0398dff84aab61d1937c57bf67d71e1d5726d71bfa8a1782d4888c84",
    byteLength: 24986,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/docs/b3/evidence/iat-b3-standard-program-mainnet-source-equivalence-20260811T040023Z.json",
    sha256: "9cef1db0263c3322ac80e9d4ee249461878cbf3a3e33fe1eb08fe1a17053b000",
    byteLength: 3477,
  }),
]);

const EXPECTED_DEPENDENCY_PINS = Object.freeze({
  splToken2022Interface: "=2.1.0",
  solanaZkSdk: "=4.0.0",
  token2022ProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  zkElgamalProofProgramId: "ZkE1Gama1Proof11111111111111111111111111111",
});

const EXPECTED_HOST_CHECKS = Object.freeze({
  featureGated: true,
  readOnlyAccountInfoParsing: true,
  exactMintAndAccountLengths: true,
  exactExtensionAllowlists: true,
  canonicalPodBooleans: true,
  elgamalPublicKeyCurveValidity: true,
  allPersistedElgamalCiphertextCurveValidity: true,
  pubkeyValidityProofGenerationAndVerification: true,
  zeroCiphertextProofGenerationAndVerification: true,
  mismatchedPubkeyStatementRejected: true,
  nonzeroCiphertextZeroProofRejected: true,
  mutableAccountBorrow: false,
  accountWrite: false,
  tokenCpi: false,
  instructionConstruction: false,
});

const EXPECTED_STANDARD_PROGRAM_OBSERVATION = Object.freeze({
  network: "mainnet-beta",
  commitment: "finalized",
  observedAtUtc: "2026-08-11T04:00:23.820Z",
  finalizedBoundarySlot: 438534028,
  token2022ReleaseTag: "program@v11.0.0",
  token2022SourceCommit: "9bc02757f600ffe754746708a8a072bcd49d1260",
  token2022DeployedProgramSha256: "0999dbf708971e723b08d1caafc988826a59c6001ed6dc02260da07defbe1469",
  token2022RebuiltArtifactSha256: "9bbf90b30e06778ca0feca100b29f0eeb9be576ae024f6323cc207308f51a5d1",
  token2022SourceEquivalenceVerified: true,
  token2022Upgradeable: true,
  token2022CeremonyTimeReattestationRequired: true,
  zkElgamalProofProgramNativeAndImmutable: true,
  rpcObservationAuthenticated: false,
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
const exactJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function result(violations) {
  return Object.freeze({
    valid: violations.length === 0,
    hostCompatibilityComplete: violations.length === 0,
    privacyVaultLifecycleComplete: false,
    devnetVerified: false,
    activationReady: false,
    releaseAuthorizationVerified: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    violations: Object.freeze([...violations]),
  });
}

export function validateToken2022ConfidentialHostCompatibilityManifest(
  manifest,
  { boundFiles = null } = {},
) {
  const violations = [];
  if (!exactKeys(manifest, TOP_LEVEL_KEYS)) {
    return result([`manifest: expected exact keys ${[...TOP_LEVEL_KEYS].sort().join(",")}`]);
  }
  if (manifest.$schema !== "./iat-b3-token-2022-confidential-host-compatibility.v1.schema.json"
    || manifest.schema !== TOKEN_2022_HOST_COMPATIBILITY_SCHEMA
    || manifest.status !== TOKEN_2022_HOST_COMPATIBILITY_STATUS) {
    violations.push("manifest: schema or status drifted");
  }
  if (!exactKeys(manifest.scope, ["predicate", "certifies", "doesNotCertify"])
    || manifest.scope.predicate !== "EXACT_TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY_PACKET"
    || !exactJson(manifest.scope.certifies, CERTIFIES)
    || !exactJson(manifest.scope.doesNotCertify, DOES_NOT_CERTIFY)) {
    violations.push("scope: exact host-only certification boundary drifted");
  }
  if (!exactJson(manifest.sourceBindings, TOKEN_2022_HOST_SOURCE_BINDINGS)) {
    violations.push("sourceBindings: exact ordered path, digest, or length drifted");
  }
  if (!exactKeys(manifest.dependencyPins, Object.keys(EXPECTED_DEPENDENCY_PINS))
    || !exactJson(manifest.dependencyPins, EXPECTED_DEPENDENCY_PINS)) {
    violations.push("dependencyPins: exact versions or standard program identities drifted");
  }
  if (!exactKeys(manifest.hostChecks, Object.keys(EXPECTED_HOST_CHECKS))
    || !exactJson(manifest.hostChecks, EXPECTED_HOST_CHECKS)) {
    violations.push("hostChecks: required positive checks or inert boundaries drifted");
  }
  if (!exactKeys(
    manifest.standardProgramObservation,
    Object.keys(EXPECTED_STANDARD_PROGRAM_OBSERVATION),
  ) || !exactJson(
    manifest.standardProgramObservation,
    EXPECTED_STANDARD_PROGRAM_OBSERVATION,
  )) {
    violations.push("standardProgramObservation: finalized source-equivalence or reattestation boundary drifted");
  }
  if (manifest.hostCompatibilityComplete !== true
    || manifest.privacyVaultLifecycleComplete !== false
    || manifest.devnetVerified !== false
    || manifest.activationReady !== false
    || manifest.releaseAuthorizationVerified !== false
    || manifest.mainnetExecutionAuthorized !== false
    || manifest.mainnetStatus !== "HOLD") {
    violations.push("terminal truth: host compatibility must not activate lifecycle, Devnet, release, or Mainnet");
  }

  if (!(boundFiles instanceof Map)) {
    violations.push("sourceBindings: exact committed bytes were not supplied");
  } else {
    for (const binding of TOKEN_2022_HOST_SOURCE_BINDINGS) {
      const bytes = boundFiles.get(binding.path);
      if (!Buffer.isBuffer(bytes)) {
        violations.push(`sourceBindings: missing bytes for ${binding.path}`);
      } else if (bytes.length !== binding.byteLength || sha256(bytes) !== binding.sha256) {
        violations.push(`sourceBindings: byte length or SHA-256 mismatch for ${binding.path}`);
      }
    }
  }
  return result(violations);
}

export function parseToken2022ConfidentialHostCompatibilityJson(text, label = "manifest") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") index += 2;
      else {
        if (character < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseStringToken();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

function diskBindings() {
  return new Map(TOKEN_2022_HOST_SOURCE_BINDINGS.map((binding) => [
    binding.path,
    readFileSync(resolve(REPOSITORY_ROOT, binding.path)),
  ]));
}

function main() {
  const manifestPath = resolve(process.argv[2] ?? DEFAULT_MANIFEST_PATH);
  const manifest = parseToken2022ConfidentialHostCompatibilityJson(
    readFileSync(manifestPath, "utf8"),
    manifestPath,
  );
  const validation = validateToken2022ConfidentialHostCompatibilityManifest(manifest, {
    boundFiles: diskBindings(),
  });
  process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
  process.exitCode = validation.valid ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

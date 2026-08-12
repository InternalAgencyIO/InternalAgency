#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  parseToken2022ConfidentialHostCompatibilityJson,
  TOKEN_2022_HOST_SOURCE_BINDINGS,
  validateToken2022ConfidentialHostCompatibilityManifest,
} from "./validate-iat-b3-token-2022-confidential-host-compatibility.mjs";

export const PRIVACY_VAULT_NATIVE_INSTRUCTION_PLAN_SCHEMA =
  "iat-b3-privacy-vault-native-instruction-plan/v1";
export const PRIVACY_VAULT_NATIVE_INSTRUCTION_PLAN_STATUS =
  "ACCOUNT_LOCAL_UNSIGNED_INSTRUCTION_PREREQUISITE_COMPLETE_RELEASE_HOLD";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(SCRIPT_ROOT, "..");
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, "../../../..");
const DEFAULT_MANIFEST_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-privacy-vault-native-instruction-plan.v1.json",
);

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "status",
  "scope",
  "hostPrerequisiteBinding",
  "sourceBindings",
  "dependencyPins",
  "supportedInstructions",
  "constructionChecks",
  "accountLocalInstructionPrerequisiteComplete",
  "privacyVaultLifecycleComplete",
  "devnetVerified",
  "activationReady",
  "releaseAuthorizationVerified",
  "mainnetExecutionAuthorized",
  "mainnetStatus",
]);

const EXPECTED_SCOPE = Object.freeze({
  predicate: "PRIVACY_VAULT_ACCOUNT_LOCAL_NATIVE_INSTRUCTION_PREREQUISITE_PACKET",
  certifies: Object.freeze([
    "CANONICAL_PRIVACY_PLAN_CODEC_AND_DIGEST_ADMISSION",
    "READ_ONLY_TOKEN_2022_MINT_AND_ACCOUNT_CAPABILITY_CROSS_BINDING",
    "EXACT_PINNED_OFFICIAL_ACCOUNT_LOCAL_INSTRUCTION_BUILDERS",
    "RELEVANT_RUNTIME_PUBLIC_FIELD_DRIFT_REJECTION",
    "UNSIGNED_INERT_INSTRUCTION_RECEIPT_BOUNDARY",
  ]),
  doesNotCertify: Object.freeze([
    "CONFIGURE_TRANSFER_WITHDRAW_EMPTY_OR_CLOSE_INSTRUCTIONS",
    "PROOF_GENERATION_CONTEXT_CREATION_VERIFICATION_OR_CLOSURE",
    "RUNTIME_DAILY_LAW_OR_TRANSFER_HOOK_ACCOUNT_AUTHENTICATION",
    "SIGNER_KEYSTORE_RPC_CPI_SUBMISSION_OR_CONFIRMATION",
    "DURABLE_JOURNAL_RECOVERY_OR_ROLLBACK_PROTECTION",
    "CHAIN_STATE_MUTATION_OR_DEPLOYED_PROGRAM_BYTECODE",
    "DEVNET_LIFECYCLE_OR_FINAL_BINARY_REPRODUCIBILITY",
    "PRIVACY_VAULT_ACTIVATION_RELEASE_OR_MAINNET_AUTHORIZATION",
  ]),
});

export const PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING = Object.freeze({
  path: "projects/star-ascent/site/docs/b3/iat-b3-token-2022-confidential-host-compatibility.v1.json",
  sha256: "0f8bc5f9622877e4f6298ea1d4c4f7eea4a0427f04e0f6a49f6a07eb66c5fb1b",
  hostPacketInstructionConstruction: false,
  separateNativeInstructionModuleRequired: true,
});

export const PRIVACY_VAULT_NATIVE_INSTRUCTION_SOURCE_BINDINGS = Object.freeze([
  Object.freeze({
    path: "projects/star-ascent/site/Cargo.lock",
    sha256: "9cdf2e9bb6b618c993dd482e6b5e2558359826e2aff0a80eb1b62957d2578d84",
    byteLength: 62795,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/Cargo.toml",
    sha256: "333389a41625cf9bc40ccaa21f94298a4de6244ad6bab2dd03dcaf789b2c54be",
    byteLength: 861,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/src/lib.rs",
    sha256: "d09d02b6f7124241d0d7e80d310a724b56f296422d729d9c5f34363ffa39127f",
    byteLength: 52248,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/src/journal_codec.rs",
    sha256: "8ec6468fbdf8e58588b3fce5835863237b37c8991abb323c2d88b0e5e297699e",
    byteLength: 25558,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/src/token_2022_host.rs",
    sha256: "8499cf37e7a50b8c07912d3d2f1b51f767300e15722478dafc7e52e185fdeb5a",
    byteLength: 23419,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/src/native_instruction_plan.rs",
    sha256: "105221cbaf3b9d9e77440f8a17d126a700494c1cc945306f7b4987da450b3508",
    byteLength: 11360,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/programs/iat_b3_vault/tests/native_instruction_plan_spec.rs",
    sha256: "1febcfe6fad1d1456ff46de8eb4698ee1f46a218e024bf2e40ef5b7a324ccaa1",
    byteLength: 17919,
  }),
  Object.freeze({
    path: "projects/star-ascent/site/docs/b3/PRIVACY_VAULT_NATIVE_INSTRUCTION_PLAN_REFERENCE.md",
    sha256: "5afb2e9c3d4a6cf8c5e259dd0606cd8e9dbeb3ed8aabbd85185974223f38f9de",
    byteLength: 5291,
  }),
]);

const EXPECTED_DEPENDENCY_PINS = Object.freeze({
  splToken2022Interface: "=2.1.0",
  solanaInstruction: "=3.5.0",
  solanaPubkey: "=3.0.0",
  token2022ProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
});

const EXPECTED_SUPPORTED_INSTRUCTIONS = Object.freeze([
  Object.freeze({
    operation: "DEPOSIT",
    officialBuilder: "deposit",
    material: "CANONICAL_PLAN_CLEARTEXT_AMOUNT",
  }),
  Object.freeze({
    operation: "APPLY_PENDING_BALANCE",
    officialBuilder: "apply_pending_balance",
    material: "CALLER_SUPPLIED_DECRYPTABLE_AVAILABLE_BALANCE",
  }),
  Object.freeze({
    operation: "ENABLE_CONFIDENTIAL_CREDITS",
    officialBuilder: "enable_confidential_credits",
    material: "NONE",
  }),
  Object.freeze({
    operation: "DISABLE_CONFIDENTIAL_CREDITS",
    officialBuilder: "disable_confidential_credits",
    material: "NONE",
  }),
  Object.freeze({
    operation: "ENABLE_NON_CONFIDENTIAL_CREDITS",
    officialBuilder: "enable_non_confidential_credits",
    material: "NONE",
  }),
  Object.freeze({
    operation: "DISABLE_NON_CONFIDENTIAL_CREDITS",
    officialBuilder: "disable_non_confidential_credits",
    material: "NONE",
  }),
]);

const EXPECTED_CONSTRUCTION_CHECKS = Object.freeze({
  featureGated: true,
  canonicalPlanCodecAndDigestRequired: true,
  readOnlyMintCapabilityRequired: true,
  readOnlyAccountCapabilityRequired: true,
  programMintAccountOwnerCrossBindingRequired: true,
  relevantRuntimePublicStateCrossBindingRequired: true,
  officialBuilderAccountAndDataEqualityTested: true,
  unsupportedOperationRejected: true,
  materialMismatchRejected: true,
  instructionConstruction: true,
  hostParserInstructionConstruction: false,
  configureAccountInstructionSupported: false,
  confidentialTransferInstructionSupported: false,
  withdrawInstructionSupported: false,
  emptyAndCloseInstructionSupported: false,
  proofContextLifecycleSupported: false,
  officialTransferHookResolutionExecuted: false,
  runtimeDailyLawAuthenticated: false,
  instructionSigned: false,
  rpcPerformed: false,
  tokenCpiExecuted: false,
  instructionSubmitted: false,
  chainStateMutated: false,
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
const exactJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function result(violations) {
  return Object.freeze({
    valid: violations.length === 0,
    accountLocalInstructionPrerequisiteComplete: violations.length === 0,
    privacyVaultLifecycleComplete: false,
    runtimeDailyLawAuthenticationVerified: false,
    proofContextLifecycleComplete: false,
    devnetVerified: false,
    activationReady: false,
    releaseAuthorizationVerified: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    violations: Object.freeze([...violations]),
  });
}

export function validatePrivacyVaultNativeInstructionPlanManifest(
  manifest,
  { boundFiles = null } = {},
) {
  const violations = [];
  if (!exactKeys(manifest, TOP_LEVEL_KEYS)) {
    return result([`manifest: expected exact keys ${[...TOP_LEVEL_KEYS].sort().join(",")}`]);
  }
  if (manifest.$schema !== "./iat-b3-privacy-vault-native-instruction-plan.v1.schema.json"
    || manifest.schema !== PRIVACY_VAULT_NATIVE_INSTRUCTION_PLAN_SCHEMA
    || manifest.status !== PRIVACY_VAULT_NATIVE_INSTRUCTION_PLAN_STATUS) {
    violations.push("manifest: schema or status drifted");
  }
  if (!exactKeys(manifest.scope, ["predicate", "certifies", "doesNotCertify"])
    || !exactJson(manifest.scope, EXPECTED_SCOPE)) {
    violations.push("scope: exact account-local construction boundary drifted");
  }
  if (!exactJson(
    manifest.hostPrerequisiteBinding,
    PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING,
  )) {
    violations.push("hostPrerequisiteBinding: host-only separation or packet binding drifted");
  }
  if (!exactJson(manifest.sourceBindings, PRIVACY_VAULT_NATIVE_INSTRUCTION_SOURCE_BINDINGS)) {
    violations.push("sourceBindings: exact ordered path, digest, or length drifted");
  }
  if (!exactKeys(manifest.dependencyPins, Object.keys(EXPECTED_DEPENDENCY_PINS))
    || !exactJson(manifest.dependencyPins, EXPECTED_DEPENDENCY_PINS)) {
    violations.push("dependencyPins: exact client versions or Token-2022 identity drifted");
  }
  if (!exactJson(manifest.supportedInstructions, EXPECTED_SUPPORTED_INSTRUCTIONS)) {
    violations.push("supportedInstructions: exact official account-local builder inventory drifted");
  }
  if (!exactKeys(manifest.constructionChecks, Object.keys(EXPECTED_CONSTRUCTION_CHECKS))
    || !exactJson(manifest.constructionChecks, EXPECTED_CONSTRUCTION_CHECKS)) {
    violations.push("constructionChecks: positive prerequisite or inert boundary drifted");
  }
  if (manifest.accountLocalInstructionPrerequisiteComplete !== true
    || manifest.privacyVaultLifecycleComplete !== false
    || manifest.devnetVerified !== false
    || manifest.activationReady !== false
    || manifest.releaseAuthorizationVerified !== false
    || manifest.mainnetExecutionAuthorized !== false
    || manifest.mainnetStatus !== "HOLD") {
    violations.push("terminal truth: instruction prerequisite must not activate lifecycle, Devnet, release, or Mainnet");
  }

  if (!(boundFiles instanceof Map)) {
    violations.push("sourceBindings: exact source and host-prerequisite bytes were not supplied");
  } else {
    for (const binding of PRIVACY_VAULT_NATIVE_INSTRUCTION_SOURCE_BINDINGS) {
      const bytes = boundFiles.get(binding.path);
      if (!Buffer.isBuffer(bytes)) {
        violations.push(`sourceBindings: missing bytes for ${binding.path}`);
      } else if (bytes.length !== binding.byteLength || sha256(bytes) !== binding.sha256) {
        violations.push(`sourceBindings: byte length or SHA-256 mismatch for ${binding.path}`);
      }
    }

    const hostBytes = boundFiles.get(PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.path);
    if (!Buffer.isBuffer(hostBytes)) {
      violations.push("hostPrerequisiteBinding: exact host packet bytes are missing");
    } else if (sha256(hostBytes) !== PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.sha256) {
      violations.push("hostPrerequisiteBinding: host packet SHA-256 mismatch");
    } else {
      try {
        const hostManifest = parseToken2022ConfidentialHostCompatibilityJson(
          hostBytes.toString("utf8"),
          PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.path,
        );
        const hostResult = validateToken2022ConfidentialHostCompatibilityManifest(hostManifest, {
          boundFiles,
        });
        if (!hostResult.valid
          || hostResult.hostCompatibilityComplete !== true
          || hostManifest.hostChecks?.instructionConstruction !== false) {
          violations.push("hostPrerequisiteBinding: host packet is invalid or no longer instruction-free");
        }
      } catch (error) {
        violations.push(`hostPrerequisiteBinding: strict host validation failed (${error.message})`);
      }
    }
  }
  return result(violations);
}

export function parsePrivacyVaultNativeInstructionPlanJson(text, label = "manifest") {
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
  const paths = new Set([
    ...PRIVACY_VAULT_NATIVE_INSTRUCTION_SOURCE_BINDINGS.map(({ path }) => path),
    ...TOKEN_2022_HOST_SOURCE_BINDINGS.map(({ path }) => path),
    PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.path,
  ]);
  return new Map([...paths].map((path) => [
    path,
    readFileSync(resolve(REPOSITORY_ROOT, path)),
  ]));
}

function main() {
  const manifestPath = resolve(process.argv[2] ?? DEFAULT_MANIFEST_PATH);
  const manifest = parsePrivacyVaultNativeInstructionPlanJson(
    readFileSync(manifestPath, "utf8"),
    manifestPath,
  );
  const validation = validatePrivacyVaultNativeInstructionPlanManifest(manifest, {
    boundFiles: diskBindings(),
  });
  process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
  process.exitCode = validation.valid ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

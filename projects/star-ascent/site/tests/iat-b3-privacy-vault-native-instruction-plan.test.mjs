import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parsePrivacyVaultNativeInstructionPlanJson,
  PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING,
  PRIVACY_VAULT_NATIVE_INSTRUCTION_PLAN_SCHEMA,
  PRIVACY_VAULT_NATIVE_INSTRUCTION_SOURCE_BINDINGS,
  validatePrivacyVaultNativeInstructionPlanManifest,
} from "../scripts/validate-iat-b3-privacy-vault-native-instruction-plan.mjs";
import {
  TOKEN_2022_HOST_SOURCE_BINDINGS,
} from "../scripts/validate-iat-b3-token-2022-confidential-host-compatibility.mjs";

const SITE = fileURLToPath(new URL("../", import.meta.url));
const REPOSITORY = resolve(SITE, "../../..");
const MANIFEST_PATH = resolve(
  SITE,
  "docs/b3/iat-b3-privacy-vault-native-instruction-plan.v1.json",
);
const SCHEMA_PATH = resolve(
  SITE,
  "docs/b3/iat-b3-privacy-vault-native-instruction-plan.v1.schema.json",
);
const VALIDATOR_PATH = resolve(
  SITE,
  "scripts/validate-iat-b3-privacy-vault-native-instruction-plan.mjs",
);
const MANIFEST = parsePrivacyVaultNativeInstructionPlanJson(
  readFileSync(MANIFEST_PATH, "utf8"),
  MANIFEST_PATH,
);
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const BINDING_PATHS = new Set([
  ...PRIVACY_VAULT_NATIVE_INSTRUCTION_SOURCE_BINDINGS.map(({ path }) => path),
  ...TOKEN_2022_HOST_SOURCE_BINDINGS.map(({ path }) => path),
  PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.path,
]);
const BOUND_FILES = new Map([...BINDING_PATHS].map((path) => [
  path,
  readFileSync(resolve(REPOSITORY, path)),
]));
const clone = (value) => structuredClone(value);

test("canonical Privacy Vault native instruction prerequisite is source-bound and nonactivating", () => {
  const result = validatePrivacyVaultNativeInstructionPlanManifest(MANIFEST, {
    boundFiles: BOUND_FILES,
  });
  assert.deepEqual(result.violations, []);
  assert.equal(result.valid, true);
  assert.equal(result.accountLocalInstructionPrerequisiteComplete, true);
  assert.equal(result.privacyVaultLifecycleComplete, false);
  assert.equal(result.runtimeDailyLawAuthenticationVerified, false);
  assert.equal(result.proofContextLifecycleComplete, false);
  assert.equal(result.devnetVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.releaseAuthorizationVerified, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal("ready" in result, false);
  assert.equal("GO" in result, false);
});

test("host parser remains instruction-free while the separate native module owns the exact subset", () => {
  const host = JSON.parse(
    BOUND_FILES.get(PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.path).toString("utf8"),
  );
  assert.equal(host.hostChecks.instructionConstruction, false);
  assert.equal(MANIFEST.hostPrerequisiteBinding.hostPacketInstructionConstruction, false);
  assert.equal(MANIFEST.hostPrerequisiteBinding.separateNativeInstructionModuleRequired, true);
  assert.equal(MANIFEST.constructionChecks.instructionConstruction, true);
  assert.equal(MANIFEST.constructionChecks.hostParserInstructionConstruction, false);
  assert.deepEqual(
    MANIFEST.supportedInstructions.map(({ officialBuilder }) => officialBuilder),
    [
      "deposit",
      "apply_pending_balance",
      "enable_confidential_credits",
      "disable_confidential_credits",
      "enable_non_confidential_credits",
      "disable_non_confidential_credits",
    ],
  );
});

test("schema pins the exact packet, inventory, operation set, and false/HOLD boundary", () => {
  assert.equal(SCHEMA.additionalProperties, false);
  assert.equal(SCHEMA.properties.schema.const, PRIVACY_VAULT_NATIVE_INSTRUCTION_PLAN_SCHEMA);
  assert.deepEqual([...SCHEMA.required].sort(), Object.keys(MANIFEST).sort());
  assert.deepEqual(SCHEMA.properties.scope.const, MANIFEST.scope);
  assert.deepEqual(
    SCHEMA.properties.hostPrerequisiteBinding.const,
    MANIFEST.hostPrerequisiteBinding,
  );
  assert.deepEqual(SCHEMA.properties.sourceBindings.const, MANIFEST.sourceBindings);
  assert.deepEqual(
    SCHEMA.properties.supportedInstructions.const,
    MANIFEST.supportedInstructions,
  );
  assert.deepEqual(SCHEMA.properties.constructionChecks.const, MANIFEST.constructionChecks);
  for (const key of [
    "privacyVaultLifecycleComplete",
    "devnetVerified",
    "activationReady",
    "releaseAuthorizationVerified",
    "mainnetExecutionAuthorized",
  ]) assert.equal(SCHEMA.properties[key].const, false);
  assert.equal(SCHEMA.properties.mainnetStatus.const, "HOLD");
});

test("packet rejects scope, version, operation, host-separation, and terminal overclaims", () => {
  for (const mutate of [
    (value) => { value.schema = "iat-b3-privacy-vault-native-instruction-plan/v2"; },
    (value) => { value.scope.certifies.reverse(); },
    (value) => { value.dependencyPins.solanaInstruction = "=3.5.1"; },
    (value) => { value.supportedInstructions[0].officialBuilder = "transfer"; },
    (value) => { value.supportedInstructions.push(value.supportedInstructions[0]); },
    (value) => { value.hostPrerequisiteBinding.hostPacketInstructionConstruction = true; },
    (value) => { value.constructionChecks.hostParserInstructionConstruction = true; },
    (value) => { value.constructionChecks.proofContextLifecycleSupported = true; },
    (value) => { value.constructionChecks.instructionSigned = true; },
    (value) => { value.privacyVaultLifecycleComplete = true; },
    (value) => { value.devnetVerified = true; },
    (value) => { value.mainnetExecutionAuthorized = true; },
    (value) => { value.unreviewedAlias = true; },
  ]) {
    const hostile = clone(MANIFEST);
    mutate(hostile);
    assert.equal(validatePrivacyVaultNativeInstructionPlanManifest(hostile, {
      boundFiles: BOUND_FILES,
    }).valid, false);
  }
});

test("packet rejects missing, changed, reordered, and unbound exact bytes", () => {
  assert.equal(validatePrivacyVaultNativeInstructionPlanManifest(MANIFEST).valid, false);
  for (const binding of PRIVACY_VAULT_NATIVE_INSTRUCTION_SOURCE_BINDINGS) {
    const missing = new Map(BOUND_FILES);
    missing.delete(binding.path);
    assert.equal(validatePrivacyVaultNativeInstructionPlanManifest(MANIFEST, {
      boundFiles: missing,
    }).valid, false);
    const changed = new Map(BOUND_FILES);
    changed.set(binding.path, Buffer.concat([changed.get(binding.path), Buffer.from([0])]));
    assert.equal(validatePrivacyVaultNativeInstructionPlanManifest(MANIFEST, {
      boundFiles: changed,
    }).valid, false);
  }

  const reordered = clone(MANIFEST);
  reordered.sourceBindings.reverse();
  assert.equal(validatePrivacyVaultNativeInstructionPlanManifest(reordered, {
    boundFiles: BOUND_FILES,
  }).valid, false);

  const changedHost = new Map(BOUND_FILES);
  changedHost.set(
    PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.path,
    Buffer.concat([
      changedHost.get(PRIVACY_VAULT_NATIVE_HOST_PREREQUISITE_BINDING.path),
      Buffer.from([0]),
    ]),
  );
  assert.equal(validatePrivacyVaultNativeInstructionPlanManifest(MANIFEST, {
    boundFiles: changedHost,
  }).valid, false);
});

test("strict parser rejects duplicate members and CLI reports HOLD success", () => {
  assert.throws(
    () => parsePrivacyVaultNativeInstructionPlanJson('{"schema":"a","schema":"b"}'),
    /duplicate JSON member/u,
  );
  const cli = spawnSync(process.execPath, [VALIDATOR_PATH], {
    cwd: SITE,
    encoding: "utf8",
  });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  const result = JSON.parse(cli.stdout);
  assert.equal(result.valid, true);
  assert.equal(result.accountLocalInstructionPrerequisiteComplete, true);
  assert.equal(result.privacyVaultLifecycleComplete, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

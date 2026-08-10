import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_V2_SOURCE_COMMIT,
  RELEASE_CLAIMS_PREREQUISITES,
  REQUIRED_V2_ENTRYPOINTS,
  REQUIRED_V2_SOURCE_PATHS,
  V2_PARITY_CLAIMS_MAINNET_STATUS,
  V2_PARITY_CLAIMS_SCHEMA,
  parseV2ParityClaimsReadinessJson,
  validateV2ParityClaimsReadinessManifest,
} from "../scripts/validate-iat-b3-v2-parity-claims-readiness.mjs";

const manifestPath = new URL(
  "../docs/b3/iat-b3-v2-parity-claims-readiness.v1.json",
  import.meta.url,
);
const validatorPath = new URL(
  "../scripts/validate-iat-b3-v2-parity-claims-readiness.mjs",
  import.meta.url,
);
const manifestText = readFileSync(manifestPath, "utf8");
const manifest = parseV2ParityClaimsReadinessJson(manifestText, "canonical manifest");
const clone = (value) => structuredClone(value);

function assertFailClosed(result) {
  assert.equal(result.valid, false);
  assert.equal(result.productionParityPacketComplete, false);
  assert.equal(result.releaseSurfaceClaimsPacketComplete, false);
  assert.equal(result.publicReleaseClaimsAuthorized, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
}

test("the canonical packet maps every retained V2 row and keeps all release surfaces held", () => {
  const result = validateV2ParityClaimsReadinessManifest(manifest);
  assert.equal(result.valid, true);
  assert.equal(result.profile, "PRODUCTION");
  assert.equal(result.sourceInheritanceVerified, true);
  assert.equal(result.featureInventoryMapped, true);
  assert.equal(result.zeroUnauthorizedCuts, true);
  assert.equal(result.implementationSliceInventoryComplete, true);
  assert.equal(result.releaseClaimsHeld, true);
  assert.equal(result.productionParityPacketComplete, false);
  assert.equal(result.releaseSurfaceClaimsPacketComplete, false);
  assert.equal(result.publicReleaseClaimsAuthorized, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(result.blockers.length, 22);
  assert.deepEqual(result.violations, []);
  assert.equal(manifest.schema, V2_PARITY_CLAIMS_SCHEMA);
  assert.equal(V2_PARITY_CLAIMS_MAINNET_STATUS, "HOLD");
  assert.equal(manifest.featureRows.length, 53);
  assert.equal(manifest.implementationSlices.length, 7);
});

test("source inheritance is pinned to the canonical ancestor, exact paths, and all 15 entrypoints", () => {
  assert.equal(manifest.sourceInheritance.canonicalV2SourceCommit, CANONICAL_V2_SOURCE_COMMIT);
  assert.deepEqual(manifest.sourceInheritance.requiredPaths, REQUIRED_V2_SOURCE_PATHS);
  assert.deepEqual(manifest.sourceInheritance.requiredEntrypoints, REQUIRED_V2_ENTRYPOINTS);
  assert.equal(REQUIRED_V2_ENTRYPOINTS.length, 15);
  assert.equal(REQUIRED_V2_SOURCE_PATHS.length, 13);

  const renamedEntrypoint = clone(manifest);
  renamedEntrypoint.sourceInheritance.requiredEntrypoints[14] = "expire_round_v3";
  const result = validateV2ParityClaimsReadinessManifest(renamedEntrypoint);
  assert.equal(result.valid, false);
  assert.equal(result.sourceInheritanceVerified, false);
  assert.match(result.violations.join("\n"), /15-entrypoint inventory drifted/u);
});

test("feature rows cannot be omitted, reordered, duplicated, renamed, or converted into implicit cut exceptions", () => {
  const omitted = clone(manifest);
  omitted.featureRows.pop();
  let result = validateV2ParityClaimsReadinessManifest(omitted);
  assert.equal(result.zeroUnauthorizedCuts, false);
  assert.match(result.violations.join("\n"), /expected exactly 53 ordered rows/u);

  const reordered = clone(manifest);
  [reordered.featureRows[0], reordered.featureRows[1]] = [reordered.featureRows[1], reordered.featureRows[0]];
  result = validateV2ParityClaimsReadinessManifest(reordered);
  assert.equal(result.featureInventoryMapped, false);
  assert.match(result.violations.join("\n"), /ordinal or canonical capability drifted/u);

  const cut = clone(manifest);
  cut.decisionPolicy.cutExceptions.push(42);
  cut.decisionPolicy.ownerCutAuthorizationArtifacts.push("owner-said-so");
  result = validateV2ParityClaimsReadinessManifest(cut);
  assert.equal(result.zeroUnauthorizedCuts, false);
  assert.match(result.violations.join("\n"), /no cut exception/u);
});

test("implementation slices must cover all 53 rows exactly once and only cite committed clean B3 evidence", () => {
  const duplicate = clone(manifest);
  duplicate.implementationSlices[0].featureOrdinals[0] = 2;
  let result = validateV2ParityClaimsReadinessManifest(duplicate);
  assert.equal(result.implementationSliceInventoryComplete, false);
  assert.match(result.violations.join("\n"), /exact feature coverage drifted|covered exactly once/u);

  const dirtySurfaceAlias = clone(manifest);
  dirtySurfaceAlias.implementationSlices[4].evidencePaths[0] = "projects/star-ascent/site/app/i18n/config.ts";
  result = validateV2ParityClaimsReadinessManifest(dirtySurfaceAlias);
  assert.equal(result.implementationSliceInventoryComplete, false);
  assert.match(result.violations.join("\n"), /unsafe or out-of-scope evidence path/u);

  const falseCompletion = clone(manifest);
  falseCompletion.implementationSlices[1].state = "COMPLETE";
  result = validateV2ParityClaimsReadinessManifest(falseCompletion);
  assert.equal(result.implementationSliceInventoryComplete, false);
  assert.match(result.violations.join("\n"), /id, state, evidence, blockers, or exact feature coverage drifted/u);
});

test("public claims retain the exact seven graph prerequisites and cannot be promoted by labels", () => {
  assert.deepEqual(manifest.releaseClaimsBoundary.prerequisiteNodeIds, RELEASE_CLAIMS_PREREQUISITES);
  assert.equal(RELEASE_CLAIMS_PREREQUISITES.length, 7);

  const missingPrerequisite = clone(manifest);
  missingPrerequisite.releaseClaimsBoundary.prerequisiteNodeIds.pop();
  let result = validateV2ParityClaimsReadinessManifest(missingPrerequisite);
  assert.equal(result.releaseClaimsHeld, false);
  assert.match(result.violations.join("\n"), /prerequisite or claim-class policy drifted/u);

  const relabeled = clone(manifest);
  relabeled.status = "READY";
  relabeled.productionParityPacketComplete = true;
  relabeled.releaseSurfaceClaimsPacketComplete = true;
  relabeled.activationReady = true;
  relabeled.deploymentAuthorized = true;
  relabeled.mainnetExecutionAuthorized = true;
  relabeled.mainnetStatus = "GO";
  result = validateV2ParityClaimsReadinessManifest(relabeled);
  assert.equal(result.productionParityPacketComplete, false);
  assert.equal(result.releaseSurfaceClaimsPacketComplete, false);
  assert.equal(result.publicReleaseClaimsAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.match(result.violations.join("\n"), /BLOCKED status/u);
  assert.match(result.violations.join("\n"), /mainnetStatus: expected "HOLD"/u);
});

test("the three canonical inputs are raw-byte bound and cannot be silently substituted", () => {
  const substituted = clone(manifest);
  substituted.inputBindings.releaseDependencyGraph.sha256 = "0".repeat(64);
  const result = validateV2ParityClaimsReadinessManifest(substituted);
  assert.equal(result.valid, false);
  assert.equal(result.releaseClaimsHeld, false);
  assert.match(result.violations.join("\n"), /canonical path or digest drifted/u);
});

test("descriptor-safe traversal rejects accessors, hidden and symbol keys, and custom prototypes without invoking getters", () => {
  let getterReads = 0;
  const accessor = clone(manifest);
  Object.defineProperty(accessor, "status", {
    enumerable: true,
    configurable: true,
    get() {
      getterReads += 1;
      throw new Error("GETTER_EXECUTED");
    },
  });
  let result = validateV2ParityClaimsReadinessManifest(accessor);
  assertFailClosed(result);
  assert.equal(getterReads, 0);
  assert.match(result.violations.join("\n"), /expected an enumerable own data property/u);

  const nestedAccessor = clone(manifest);
  Object.defineProperty(nestedAccessor.scope, "contract", {
    enumerable: true,
    configurable: true,
    get() {
      getterReads += 1;
      throw new Error("NESTED_GETTER_EXECUTED");
    },
  });
  result = validateV2ParityClaimsReadinessManifest(nestedAccessor);
  assertFailClosed(result);
  assert.equal(getterReads, 0);
  assert.match(result.violations.join("\n"), /manifest\.scope\.contract: expected an enumerable own data property/u);

  const hidden = clone(manifest);
  Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
  result = validateV2ParityClaimsReadinessManifest(hidden);
  assertFailClosed(result);
  assert.match(result.violations.join("\n"), /manifest\.hidden: expected an enumerable own data property/u);

  const symbol = clone(manifest);
  symbol[Symbol("extra")] = true;
  result = validateV2ParityClaimsReadinessManifest(symbol);
  assertFailClosed(result);
  assert.match(result.violations.join("\n"), /symbol properties are forbidden/u);

  for (const prototype of [{ inherited: true }, null]) {
    const customPrototype = clone(manifest);
    Object.setPrototypeOf(customPrototype, prototype);
    result = validateV2ParityClaimsReadinessManifest(customPrototype);
    assertFailClosed(result);
    assert.match(result.violations.join("\n"), /expected the canonical Object prototype/u);
  }
});

test("canonical JSON traversal rejects sparse or decorated arrays, cycles, aliases, and non-JSON numbers", () => {
  let arrayGetterReads = 0;
  const arrayAccessor = clone(manifest);
  Object.defineProperty(arrayAccessor.featureRows, "0", {
    enumerable: true,
    configurable: true,
    get() {
      arrayGetterReads += 1;
      throw new Error("ARRAY_GETTER_EXECUTED");
    },
  });
  let result = validateV2ParityClaimsReadinessManifest(arrayAccessor);
  assertFailClosed(result);
  assert.equal(arrayGetterReads, 0);
  assert.match(result.violations.join("\n"), /manifest\.featureRows\[0\]: expected an enumerable own data property/u);

  const sparse = clone(manifest);
  delete sparse.featureRows[3];
  result = validateV2ParityClaimsReadinessManifest(sparse);
  assertFailClosed(result);
  assert.match(result.violations.join("\n"), /dense undecorated JSON array|enumerable own data property/u);

  const decorated = clone(manifest);
  decorated.featureRows.extra = true;
  result = validateV2ParityClaimsReadinessManifest(decorated);
  assertFailClosed(result);
  assert.match(result.violations.join("\n"), /dense undecorated JSON array/u);

  for (const prototype of [Object.create(Array.prototype), null]) {
    const customArrayPrototype = clone(manifest);
    Object.setPrototypeOf(customArrayPrototype.featureRows, prototype);
    result = validateV2ParityClaimsReadinessManifest(customArrayPrototype);
    assertFailClosed(result);
    assert.match(result.violations.join("\n"), /expected the canonical Array prototype/u);
  }

  const cyclic = clone(manifest);
  cyclic.scope.self = cyclic.scope;
  result = validateV2ParityClaimsReadinessManifest(cyclic);
  assertFailClosed(result);
  assert.match(result.violations.join("\n"), /contains a cycle/u);

  const aliased = clone(manifest);
  aliased.inputBindings.sourceInventory = aliased.inputBindings.featureParityContract;
  result = validateV2ParityClaimsReadinessManifest(aliased);
  assertFailClosed(result);
  assert.match(result.violations.join("\n"), /shared object aliases are forbidden/u);

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, 1.5, 1n]) {
    const nonJsonNumber = clone(manifest);
    nonJsonNumber.featureRows[0].ordinal = value;
    result = validateV2ParityClaimsReadinessManifest(nonJsonNumber);
    assertFailClosed(result);
    assert.match(result.violations.join("\n"), /canonical JSON data|finite safe JSON integer other than negative zero/u);
  }
});

test("strict source parsing rejects decoded duplicate members at top-level and nested paths", () => {
  assert.throws(
    () => parseV2ParityClaimsReadinessJson('{"schema":"one","schema":"two"}', "top duplicate"),
    /duplicate JSON member \$root\.schema/u,
  );
  assert.throws(
    () => parseV2ParityClaimsReadinessJson('{"scope":{"contract":"one","\\u0063ontract":"two"}}', "nested duplicate"),
    /duplicate JSON member \$root\.scope\.contract/u,
  );
  assert.throws(
    () => parseV2ParityClaimsReadinessJson('{"items":[{"id":1,"id":2}]}', "array duplicate"),
    /duplicate JSON member \$root\.items\[0\]\.id/u,
  );
});

test("the CLI accepts the honest HOLD packet, rejects duplicate members, and completion requirements fail closed", (t) => {
  const validatorFile = fileURLToPath(validatorPath);
  const held = spawnSync(process.execPath, [validatorFile], { encoding: "utf8" });
  assert.equal(held.status, 0, held.stderr || held.stdout);
  const heldResult = JSON.parse(held.stdout);
  assert.equal(heldResult.valid, true);
  assert.equal(heldResult.productionParityPacketComplete, false);
  assert.equal(heldResult.releaseSurfaceClaimsPacketComplete, false);

  const parityRequired = spawnSync(process.execPath, [validatorFile, "--require-parity-complete"], { encoding: "utf8" });
  assert.equal(parityRequired.status, 2, parityRequired.stderr || parityRequired.stdout);

  const claimsRequired = spawnSync(process.execPath, [validatorFile, "--require-release-claims-complete"], { encoding: "utf8" });
  assert.equal(claimsRequired.status, 2, claimsRequired.stderr || claimsRequired.stdout);

  const directory = mkdtempSync(join(tmpdir(), "iat-b3-v2-parity-json-"));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const topDuplicatePath = join(directory, "top-duplicate.json");
  writeFileSync(
    topDuplicatePath,
    manifestText.replace(
      '  "schema": "iat-b3-v2-parity-claims-readiness/v1",',
      '  "schema": "iat-b3-v2-parity-claims-readiness/v1",\n  "schema": "iat-b3-v2-parity-claims-readiness/v1",',
    ),
    "utf8",
  );
  const topDuplicate = spawnSync(process.execPath, [validatorFile, "--manifest", topDuplicatePath], { encoding: "utf8" });
  assert.equal(topDuplicate.status, 1, topDuplicate.stderr || topDuplicate.stdout);
  assert.match(topDuplicate.stderr, /duplicate JSON member \$root\.schema/u);

  const nestedDuplicatePath = join(directory, "nested-duplicate.json");
  writeFileSync(
    nestedDuplicatePath,
    manifestText.replace(
      '    "contract": "NON_ACTIVATING_V2_SOURCE_INHERITANCE_AND_PUBLIC_CLAIMS_BOUNDARY",',
      '    "contract": "NON_ACTIVATING_V2_SOURCE_INHERITANCE_AND_PUBLIC_CLAIMS_BOUNDARY",\n    "contract": "NON_ACTIVATING_V2_SOURCE_INHERITANCE_AND_PUBLIC_CLAIMS_BOUNDARY",',
    ),
    "utf8",
  );
  const nestedDuplicate = spawnSync(process.execPath, [validatorFile, "--manifest", nestedDuplicatePath], { encoding: "utf8" });
  assert.equal(nestedDuplicate.status, 1, nestedDuplicate.stderr || nestedDuplicate.stdout);
  assert.match(nestedDuplicate.stderr, /duplicate JSON member \$root\.scope\.contract/u);
});

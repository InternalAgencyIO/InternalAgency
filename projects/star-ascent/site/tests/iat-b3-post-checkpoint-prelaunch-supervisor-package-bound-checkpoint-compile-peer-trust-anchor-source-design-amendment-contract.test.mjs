import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BPS08_FROZEN_BINDINGS,
  BPS08_JSON_SCHEMA,
  BPS08_PATHS,
  BPS08_SCHEMA_ID,
  BPS08_SOURCE_DESIGN,
  createBps08SourceDesign,
  validateBps08SourceDesign,
} from "../scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-peer-trust-anchor-source-design-amendment-contract.mjs";

const SCHEMA_PATH = new URL(
  "../docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-peer-trust-anchor-source-design-amendment.v1.schema.json",
  import.meta.url,
);
const CONTRACT_PATH = new URL(
  "../scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-peer-trust-anchor-source-design-amendment-contract.mjs",
  import.meta.url,
);

const EXPECTED_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-peer-trust-anchor-source-design-amendment.v1.schema.json",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-peer-trust-anchor-source-design-amendment-contract.mjs",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-peer-trust-anchor-source-design-amendment-contract.test.mjs",
]);

const EXPECTED_ROOT_KEYS = Object.freeze([
  "schema",
  "status",
  "purpose",
  "taskBoundary",
  "frozenBindings",
  "rejectedHistory",
  "anchorTopology",
  "rootProtocol",
  "anchorReceiptDesign",
  "truthBoundary",
  "hostileCases",
  "stopBoundary",
]);

const ACCEPTED_BINDING_TOKENS = Object.freeze([
  "09be6c33631845b2c300db6ba37157f667541335f00a9f31ec2e63df3d106b0b",
  "9f36884b53aa4646739b24e9829c69abd9a964a2ebc01934bc9217f78faafd7c",
  "fd47774fe6523e181b792d187a4bae708f96ad9d",
  "1a81c083b9207eaa6f0d4dd74c4c562aa9268201",
  "504e093893403af28e7291c49cdb5bbd6a387810d438359973ff3070ac897513",
  "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_SOURCE_REVIEW_ACCEPTED",
  "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_CHECKPOINT_COMPILE_INSTALL_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
  "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_SOURCE_CHECKPOINT_REVIEW_ACCEPTED",
]);

const BLOCKED_BPS07_HASHES = Object.freeze([
  "9ebdd8dca5dcaddafe8a82ee1f5191734fd8791bb6649ee8fa53cad7d0819ed3",
  "98eaff823f20254eb597b1bda4d6f780bfcbaf7b013299c44ad1d75bea73de88",
  "c12b1ca9f84bae93d6995c131a1853cc9de79c5edf88222ff6528a7b653aff62",
  "405c3ed9d6136b6fbe6af811e040c4322e7dc4adc99deacce106ed1b168693c0",
  "99e15d3cc2b577c7b07b915bf3052a500524bbc029718d4123d3b49a5000e85d",
]);

const EXPECTED_SIGNED_SUBJECT_FIELDS = Object.freeze([
  "schema",
  "attemptId",
  "runId",
  "sessionId",
  "bootId",
  "anchorNonceHex",
  "anchorCasKeySha256",
  "anchorCasAcquireReceiptSha256",
  "anchorExpiresAtMonotonicNs",
  "ownerRootFingerprintSha256",
  "ownerRootPublicKeyHex",
  "ownerRootProvisioningReceiptSha256",
  "ownerRootKeyAnchorFd",
  "ownerRootKeyAnchorProducer",
  "ownerRootKeyAnchorOutcome",
  "ownerRootKeyAnchorDescriptorSha256",
  "ownerRootKeyAnchorDev",
  "ownerRootKeyAnchorIno",
  "ownerRootKeyAnchorMountId",
  "ownerRootKeyAnchorHandleSha256",
  "ownerRootKeyAnchorOpenFileDescriptionSha256",
  "ownerRootKeyAnchorContentSha256",
  "ownerRootKeyAnchorByteLength",
  "deviceModel",
  "deviceFirmwareVersion",
  "deviceFirmwareIdentitySha256",
  "deviceDerivationPath",
  "deviceAccountPublicKeyHex",
  "deviceAccountAddress",
  "deviceReceiptSha256",
  "physicalConfirmationReceiptSha256",
  "ocmsVersion",
  "ocmsSignerCount",
  "ocmsSignerIndex",
  "ocmsSignerPublicKeyHex",
  "ocmsSignerListByteLength",
  "ocmsSignerListSha256",
  "bps05ManifestSha256",
  "bps06ManifestSha256",
  "bpc01Commit",
  "bpc01Tree",
  "bpc01ManifestSha256",
  "successorExecutorSha256",
  "sourceFdManifestSha256",
  "toolchainManifestSha256",
  "toolOpenFileDescriptionManifestSha256",
  "sysrootManifestSha256",
  "staticNodeIdentitySha256",
  "launchArgvSha256",
  "launchEnvironmentSha256",
  "launchCwdIdentitySha256",
  "startupClosureSha256",
  "watchdogPublicKeyHex",
  "observerPublicKeyHex",
  "custodianPublicKeyHex",
  "watchdogPrincipalSha256",
  "observerPrincipalSha256",
  "custodianPrincipalSha256",
  "watchdogChannelOfdSha256",
  "observerChannelOfdSha256",
  "custodianChannelOfdSha256",
  "operationTimerOfdSha256",
  "operationDeadlineMonotonicNs",
  "teardownTimerOfdSha256",
  "teardownDeadlineMonotonicNs",
  "decision",
  "authority",
]);

function clone(value) {
  return structuredClone(value);
}

function atPath(root, path) {
  return path.reduce((value, key) => value[key], root);
}

function collectObjectPaths(value, path = [], output = []) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return output;
  }
  output.push(path);
  for (const [key, child] of Object.entries(value)) {
    collectObjectPaths(child, [...path, key], output);
  }
  return output;
}

function collectNullPaths(value, path = [], output = []) {
  if (value === null) {
    output.push(path);
    return output;
  }
  if (typeof value !== "object") {
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    collectNullPaths(child, [...path, key], output);
  }
  return output;
}

function collectLeafPaths(value, path = [], output = []) {
  if (value === null || typeof value !== "object") {
    output.push([path, value]);
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    collectLeafPaths(child, [...path, key], output);
  }
  return output;
}

function collectArrayPaths(value, path = [], output = []) {
  if (Array.isArray(value)) {
    output.push(path);
    for (let index = 0; index < value.length; index += 1) {
      collectArrayPaths(value[index], [...path, index], output);
    }
    return output;
  }
  if (value === null || typeof value !== "object") {
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    collectArrayPaths(child, [...path, key], output);
  }
  return output;
}

function replaceAtPath(root, path, value) {
  const parent = atPath(root, path.slice(0, -1));
  parent[path.at(-1)] = value;
}

function forgedScalar(value) {
  if (value === null) return "FORGED_NULL_CLAIM";
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + 1;
  if (typeof value === "string") return `${value}_FORGED`;
  throw new TypeError("expected scalar");
}

function assertRejected(value, message) {
  assert.throws(
    () => validateBps08SourceDesign(value),
    undefined,
    message,
  );
}

function schemaObjectNodes(value, path = "$", output = []) {
  if (value === null || typeof value !== "object") {
    return output;
  }
  if (value.type === "object") {
    output.push([path, value]);
  }
  for (const [key, child] of Object.entries(value)) {
    if (child !== null && typeof child === "object") {
      schemaObjectNodes(child, `${path}.${key}`, output);
    }
  }
  return output;
}

function scalarStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (value === null || typeof value !== "object") {
    return output;
  }
  for (const child of Object.values(value)) {
    scalarStrings(child, output);
  }
  return output;
}

test("BPS08 checked schema, exports, and canonical source design are byte-coherent", () => {
  const checkedSchema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert.deepEqual(checkedSchema, BPS08_JSON_SCHEMA);
  assert.equal(checkedSchema.$id, BPS08_SCHEMA_ID);
  assert.deepEqual(Object.keys(BPS08_SOURCE_DESIGN), EXPECTED_ROOT_KEYS);
  assert.deepEqual(createBps08SourceDesign(), BPS08_SOURCE_DESIGN);
  assert.doesNotThrow(() => validateBps08SourceDesign(BPS08_SOURCE_DESIGN));
  assert.doesNotThrow(() => validateBps08SourceDesign(createBps08SourceDesign()));

  const exportedPaths = JSON.stringify(BPS08_PATHS);
  for (const path of EXPECTED_PATHS) {
    assert.match(exportedPaths, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.equal(new Set(EXPECTED_PATHS).size, 3);
});

test("BPS08 schema is exact-const closed and validator closure reaches every nested object", () => {
  const objectSchemas = schemaObjectNodes(BPS08_JSON_SCHEMA);
  assert.deepEqual(BPS08_JSON_SCHEMA.const, BPS08_SOURCE_DESIGN);
  assert.ok(objectSchemas.length >= 1);
  for (const [path, schema] of objectSchemas) {
    assert.equal(schema.additionalProperties, false, `${path} must reject unknown fields`);
    if (schema.properties !== undefined) {
      assert.deepEqual(
        [...(schema.required ?? [])].sort(),
        Object.keys(schema.properties).sort(),
        `${path} must require its exact property set`,
      );
    }
  }
  assert.doesNotMatch(JSON.stringify(BPS08_JSON_SCHEMA), /"(?:oneOf|anyOf|patternProperties)"/u);
});

test("BPS08 validator rejects unknown fields at every canonical object depth", () => {
  const objectPaths = collectObjectPaths(BPS08_SOURCE_DESIGN);
  assert.ok(objectPaths.length >= 12);
  for (const path of objectPaths) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    atPath(mutation, path).__bps08_unreviewed_field__ = "FORGED";
    assertRejected(mutation, `unknown field admitted at ${path.join(".") || "$"}`);
  }
});

test("BPS08 validator rejects deletion of every canonical root field", () => {
  for (const key of EXPECTED_ROOT_KEYS) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    delete mutation[key];
    assertRejected(mutation, `missing root field admitted: ${key}`);
  }
});

test("BPS08 validator rejects proxy, prototype, accessor, symbol, alias, and sparse inputs", () => {
  assertRejected(new Proxy(clone(BPS08_SOURCE_DESIGN), {}), "proxy root admitted");

  const nullPrototype = Object.assign(Object.create(null), clone(BPS08_SOURCE_DESIGN));
  assertRejected(nullPrototype, "null-prototype root admitted");

  const customPrototype = clone(BPS08_SOURCE_DESIGN);
  Object.setPrototypeOf(customPrototype.anchorTopology, { injected: true });
  assertRejected(customPrototype, "custom nested prototype admitted");

  const accessor = clone(BPS08_SOURCE_DESIGN);
  Object.defineProperty(accessor, "purpose", {
    configurable: true,
    enumerable: true,
    get() {
      return BPS08_SOURCE_DESIGN.purpose;
    },
  });
  assertRejected(accessor, "accessor field admitted");

  const symbol = clone(BPS08_SOURCE_DESIGN);
  symbol[Symbol("unreviewed")] = "FORGED";
  assertRejected(symbol, "symbol field admitted");

  const alias = clone(BPS08_SOURCE_DESIGN);
  alias.anchorTopology.teardownTimerPolicy = alias.anchorTopology.operationTimerPolicy;
  assertRejected(alias, "aliased timer policy admitted");

  const sparse = clone(BPS08_SOURCE_DESIGN);
  const sparsePath = collectArrayPaths(sparse).find((path) => atPath(sparse, path).length > 0);
  assert.ok(sparsePath, "canonical design must contain at least one ordered tuple");
  delete atPath(sparse, sparsePath)[0];
  assertRejected(sparse, "sparse hostile-case tuple admitted");
});

test("BPS08 validator rejects missing fields at every nested object depth", () => {
  const objectPaths = collectObjectPaths(BPS08_SOURCE_DESIGN);
  let mutationCount = 0;
  for (const path of objectPaths) {
    const canonicalObject = atPath(BPS08_SOURCE_DESIGN, path);
    for (const key of Object.keys(canonicalObject)) {
      const mutation = clone(BPS08_SOURCE_DESIGN);
      delete atPath(mutation, path)[key];
      assertRejected(mutation, `missing field admitted at ${[...path, key].join(".")}`);
      mutationCount += 1;
    }
  }
  assert.ok(mutationCount >= 80, "nested contract must be mechanically closed, not token-only");
});

test("BPS08 binds only accepted BPS06/BPC01 lineage", () => {
  assert.deepEqual(BPS08_SOURCE_DESIGN.frozenBindings, BPS08_FROZEN_BINDINGS);
  assert.deepEqual(Object.keys(BPS08_FROZEN_BINDINGS), ["bps05", "bps06", "bpc01"]);
  assert.deepEqual(
    {
      taskId: BPS08_FROZEN_BINDINGS.bps05.taskId,
      outcome: BPS08_FROZEN_BINDINGS.bps05.outcome,
      manifestSha256: BPS08_FROZEN_BINDINGS.bps05.manifestSha256,
      manifestByteLength: BPS08_FROZEN_BINDINGS.bps05.manifestByteLength,
      pathCount: BPS08_FROZEN_BINDINGS.bps05.pathCount,
      payloadByteLength: BPS08_FROZEN_BINDINGS.bps05.payloadByteLength,
    },
    {
      taskId: "BPS05R",
      outcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_SOURCE_REVIEW_ACCEPTED",
      manifestSha256: "09be6c33631845b2c300db6ba37157f667541335f00a9f31ec2e63df3d106b0b",
      manifestByteLength: 1214,
      pathCount: 6,
      payloadByteLength: 700762,
    },
  );
  assert.deepEqual(
    {
      taskId: BPS08_FROZEN_BINDINGS.bps06.taskId,
      outcome: BPS08_FROZEN_BINDINGS.bps06.outcome,
      manifestSha256: BPS08_FROZEN_BINDINGS.bps06.manifestSha256,
      manifestByteLength: BPS08_FROZEN_BINDINGS.bps06.manifestByteLength,
      pathCount: BPS08_FROZEN_BINDINGS.bps06.pathCount,
      payloadByteLength: BPS08_FROZEN_BINDINGS.bps06.payloadByteLength,
    },
    {
      taskId: "BPS06R",
      outcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_CHECKPOINT_COMPILE_INSTALL_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
      manifestSha256: "9f36884b53aa4646739b24e9829c69abd9a964a2ebc01934bc9217f78faafd7c",
      manifestByteLength: 682,
      pathCount: 3,
      payloadByteLength: 345346,
    },
  );
  assert.deepEqual(
    BPS08_FROZEN_BINDINGS.bpc01,
    {
      taskId: "BPC01R",
      outcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_SOURCE_CHECKPOINT_REVIEW_ACCEPTED",
      commit: "fd47774fe6523e181b792d187a4bae708f96ad9d",
      tree: "1a81c083b9207eaa6f0d4dd74c4c562aa9268201",
      parent: "11572110330c4b22aa89d629065574e567e9fea8",
      manifestSha256: "504e093893403af28e7291c49cdb5bbd6a387810d438359973ff3070ac897513",
      manifestByteLength: 1896,
      pathCount: 9,
      payloadByteLength: 1046108,
    },
  );
  const bindings = JSON.stringify(BPS08_FROZEN_BINDINGS);
  for (const token of ACCEPTED_BINDING_TOKENS) {
    assert.match(bindings, new RegExp(token, "u"), `missing accepted lineage token ${token}`);
  }
  for (const exactNumber of [1214, 6, 700762, 682, 3, 345346, 1896, 9, 1046108]) {
    assert.match(bindings, new RegExp(`:${exactNumber}(?:[,}])`, "u"));
  }
});

test("blocked BPS07 bytes remain rejected history and never become accepted authority", () => {
  const rejected = JSON.stringify(BPS08_SOURCE_DESIGN.rejectedHistory);
  const bindings = JSON.stringify(BPS08_FROZEN_BINDINGS);
  for (const hash of BLOCKED_BPS07_HASHES) {
    assert.match(rejected, new RegExp(hash, "u"), `missing blocked BPS07 identity ${hash}`);
    assert.doesNotMatch(bindings, new RegExp(hash, "u"), `blocked BPS07 identity promoted: ${hash}`);
  }
  assert.match(rejected, /BLOCKED_NONCIRCULAR_COMPILE_PEER_TRUST_ANCHOR_ABSENT/u);
  assert.doesNotMatch(bindings, /CONTROLLER_SOURCE_IMPLEMENTED/u);
});

test("current T2T1 firmware is version-gated to observed OCMS v1 capability and never inferred", () => {
  const protocol = BPS08_SOURCE_DESIGN.rootProtocol;
  const firmware = protocol.firmwareCompatibilityPolicy;
  assert.equal(protocol.policy, "TREZOR_MODEL_T_T2T1_SOLANA_OCMS_V1_ED25519_VERSION_GATED");
  assert.equal(protocol.conditional, true);
  assert.equal(protocol.requiredDeviceModel, "T2T1");
  assert.deepEqual(Object.keys(firmware), [
    "supportedFirmwareRange",
    "minimumFirmwareVersion",
    "semverComparison",
    "minimumVersionNecessaryNotSufficient",
    "exactObservedFirmwareVersionRequired",
    "exactFirmwareIdentitySha256Required",
    "exactOcmsV1CapabilityReceiptRequired",
    "officialT2t1ChangelogTag",
    "officialFirmwareSerializerPath",
    "officialProtocolSpecification",
    "officialOcmsV0AddedVersion",
    "officialOcmsV0RemovedVersion",
    "officialOcmsV1AddedVersion",
    "ocmsV0Permitted",
    "ocmsV1Required",
    "unobservedFirmwareCapabilityInferencePermitted",
    "unlistedOrUnverifiedFirmwareDecision",
    "actualObservedFirmwareVersion",
    "actualFirmwareIdentitySha256",
    "actualOcmsV1CapabilityReceiptSha256",
    "actualSelectedOcmsVersion",
  ]);
  assert.equal(firmware.supportedFirmwareRange, "SEMVER_GTE_2_12_4_WITH_EXACT_CAPABILITY_RECEIPT");
  assert.equal(firmware.minimumFirmwareVersion, "2.12.4");
  assert.equal(firmware.semverComparison, "NUMERIC_MAJOR_MINOR_PATCH_NO_LEXICAL_COMPARE");
  assert.equal(firmware.minimumVersionNecessaryNotSufficient, true);
  assert.equal(firmware.exactObservedFirmwareVersionRequired, true);
  assert.equal(firmware.exactFirmwareIdentitySha256Required, true);
  assert.equal(firmware.exactOcmsV1CapabilityReceiptRequired, true);
  assert.equal(firmware.officialT2t1ChangelogTag, "core/v2.12.4");
  assert.equal(firmware.officialFirmwareSerializerPath, "core/src/apps/solana/offchain_message.py");
  assert.equal(firmware.officialProtocolSpecification, "SOLANA_FOUNDATION_SRFC_38_OCMS_V1");
  assert.equal(firmware.officialOcmsV0AddedVersion, "2.12.1");
  assert.equal(firmware.officialOcmsV0RemovedVersion, "2.12.4");
  assert.equal(firmware.officialOcmsV1AddedVersion, "2.12.4");
  assert.equal(firmware.ocmsV0Permitted, false);
  assert.equal(firmware.ocmsV1Required, true);
  assert.equal(firmware.unobservedFirmwareCapabilityInferencePermitted, false);
  assert.equal(firmware.unlistedOrUnverifiedFirmwareDecision, "HOLD");
  for (const key of [
    "actualObservedFirmwareVersion",
    "actualFirmwareIdentitySha256",
    "actualOcmsV1CapabilityReceiptSha256",
    "actualSelectedOcmsVersion",
  ]) {
    assert.equal(firmware[key], null, `${key} must remain external and null`);
  }

  const numericSemverGte = (candidate, minimum) => {
    const parse = (value) => {
      assert.match(value, /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u);
      return value.split(".").map(Number);
    };
    const left = parse(candidate);
    const right = parse(minimum);
    for (let index = 0; index < 3; index += 1) {
      if (left[index] !== right[index]) return left[index] > right[index];
    }
    return true;
  };
  assert.equal(numericSemverGte("2.12.3", "2.12.4"), false);
  assert.equal(numericSemverGte("2.12.4", "2.12.4"), true);
  assert.equal(numericSemverGte("2.12.10", "2.12.4"), true);
  assert.equal("2.12.10" >= "2.12.4", false, "lexical comparison is an explicit downgrade hazard");

  const legacy = protocol.legacyOcmsV0RejectionPolicy;
  assert.deepEqual(legacy, {
    version: 0,
    forbiddenAtOrAfterFirmwareVersion: "2.12.4",
    serializationFieldOrder: [
      "PREFIX",
      "HEADER_VERSION",
      "APPLICATION_DOMAIN",
      "MESSAGE_FORMAT",
      "SIGNER_COUNT",
      "SIGNER_PUBLIC_KEYS",
      "BODY_LENGTH_U16_LE",
      "BODY",
    ],
    applicationDomainPresent: true,
    applicationDomainByteLength: 32,
    messageFormatPresent: true,
    messageFormatByteLength: 1,
    bodyLengthPrefixPresent: true,
    bodyLengthEncoding: "U16_LE",
    bodyLengthPrefixByteLength: 2,
    acceptedV1ApplicationDomainPresent: false,
    acceptedV1MessageFormatPresent: false,
    acceptedV1BodyLengthPrefixPresent: false,
    everyLegacyV0ShapeRejected: true,
    downgradePermitted: false,
    crossVersionReceiptReplayPermitted: false,
    decision: "HOLD",
    authority: "NONE",
  });
  for (const [key, value] of Object.entries({
    forbiddenAtOrAfterFirmwareVersion: "2.12.5",
    applicationDomainPresent: false,
    applicationDomainByteLength: 31,
    messageFormatPresent: false,
    messageFormatByteLength: 2,
    bodyLengthPrefixPresent: false,
    bodyLengthEncoding: "U16_BE",
    bodyLengthPrefixByteLength: 1,
    acceptedV1ApplicationDomainPresent: true,
    acceptedV1MessageFormatPresent: true,
    acceptedV1BodyLengthPrefixPresent: true,
    everyLegacyV0ShapeRejected: false,
    downgradePermitted: true,
    crossVersionReceiptReplayPermitted: true,
    decision: "PASS",
    authority: "CALLER",
  })) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.rootProtocol.legacyOcmsV0RejectionPolicy[key] = value;
    assertRejected(mutation, `OCMS-v0 downgrade admitted at ${key}`);
  }
  const reorderedLegacy = clone(BPS08_SOURCE_DESIGN);
  reorderedLegacy.rootProtocol.legacyOcmsV0RejectionPolicy.serializationFieldOrder.reverse();
  assertRejected(reorderedLegacy, "legacy OCMS-v0 protobuf field-order drift admitted");
  for (const [key, value] of Object.entries({
    minimumFirmwareVersion: "2.12.1",
    semverComparison: "LEXICAL",
    minimumVersionNecessaryNotSufficient: false,
    exactObservedFirmwareVersionRequired: false,
    exactFirmwareIdentitySha256Required: false,
    exactOcmsV1CapabilityReceiptRequired: false,
    officialOcmsV0RemovedVersion: "2.12.5",
    officialOcmsV1AddedVersion: "2.12.3",
    ocmsV0Permitted: true,
    ocmsV1Required: false,
    unobservedFirmwareCapabilityInferencePermitted: true,
    unlistedOrUnverifiedFirmwareDecision: "PASS",
  })) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.rootProtocol.firmwareCompatibilityPolicy[key] = value;
    assertRejected(mutation, `firmware compatibility substitution admitted at ${key}`);
  }

  assert.equal(protocol.messagePrefixHex, "ff736f6c616e61206f6666636861696e");
  assert.equal(protocol.subjectDigestAlgorithm, "SHA256");
  assert.equal(protocol.signatureAlgorithm, "ED25519");
  assert.equal(protocol.publicKeyEncoding, "LOWERCASE_HEX_RAW_32_BYTES");
  assert.equal(protocol.signatureEncoding, "LOWERCASE_HEX_RAW_64_BYTES");
  assert.equal(protocol.verificationInput, "EXACT_SOLANA_OCMS_V1_SERIALIZED_BYTES");
  assert.equal(protocol.futureImplementationMustPinRootPublicKeyOutsideFd3, true);
  assert.equal(protocol.rootPublicKeyMayComeFromBootstrap, false);
  assert.equal(protocol.rootPublicKeyMayComeFromPeer, false);
  assert.equal(protocol.ownerRootFingerprintMustEqualPublicKeyDigest, true);
  assert.equal(protocol.ownerRootProvisioningReceiptMustMatchFingerprintAndKey, true);
  assert.equal(protocol.receiptRootPublicKeyMustEqualSignedSubjectOwnerRoot, true);
  assert.equal(protocol.privateKeyMaterialPermitted, false);
  assert.deepEqual(protocol.privateKeyFieldsForbidden, [
    "privateKey", "secretKey", "seed", "mnemonic", "pin", "passphrase",
    "signingFd", "signingPath", "signingApi",
  ]);
  assert.equal(protocol.physicalConfirmationObserved, false);
  assert.equal(protocol.decision, "HOLD");
  assert.equal(protocol.authority, "NONE");
});

test("OCMS-v1 serializer reconstructs the exact firmware signed_data bytes", () => {
  const policy = BPS08_SOURCE_DESIGN.rootProtocol.ocmsV1SerializationPolicy;
  assert.deepEqual(policy.serializationFieldOrder, [
    "PREFIX",
    "HEADER_VERSION",
    "SIGNER_COUNT",
    "SIGNER_PUBLIC_KEYS",
    "BODY",
  ]);
  assert.equal(policy.prefixHex, "ff736f6c616e61206f6666636861696e");
  assert.equal(policy.prefixByteLength, 16);
  assert.equal(policy.headerVersion, 1);
  assert.equal(policy.signerCountEncoding, "U8");
  assert.equal(policy.requiredSignerCount, 1);
  assert.equal(policy.signerPublicKeyByteLength, 32);
  assert.equal(policy.signersUniqueRequired, true);
  assert.equal(policy.signersLexicographicallySortedRequired, true);
  assert.deepEqual(policy.signerListSerializationFieldOrder, [
    "SIGNER_COUNT_U8",
    "SIGNER_PUBLIC_KEYS",
  ]);
  assert.equal(policy.signerListByteLength, 33);
  assert.equal(policy.applicationDomainPresent, false);
  assert.equal(policy.messageFormatPresent, false);
  assert.equal(policy.bodyLengthPrefixPresent, false);
  assert.equal(policy.bodyEncoding, "UTF8");
  assert.equal(policy.bodyNonempty, true);
  assert.equal(policy.bodyAsciiSubsetRequired, true);
  assert.equal(policy.bodyAsciiPattern, "^IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:[0-9a-f]{64}$");
  assert.equal(policy.exactApplicationBodyByteLength, 100);
  assert.equal(policy.exactSerializedByteLength, 150);
  assert.equal(policy.protocolMaximumTotalByteLengthPresent, false);
  assert.equal(policy.signatureByteLength, 64);
  assert.equal(policy.signatureEnvelopeUsed, false);
  assert.equal(policy.firmwareReturnsSignatureAndSignedDataSeparately, true);
  assert.equal(policy.strictSignatureVerificationRequired, true);
  assert.equal(policy.rejectNonCanonicalSignatureRequired, true);
  assert.equal(policy.reconstructExactBytesRequired, true);
  assert.equal(policy.firmwareReturnedSignedDataByteEqualityRequired, true);
  for (const key of [
    "actualSignerListSha256",
    "actualMessageBodySha256",
    "actualSerializedBytesSha256",
    "actualSignatureSha256",
  ]) {
    assert.equal(policy[key], null, `${key} must remain external and null`);
  }

  const syntheticSubjectSha256 = "ab".repeat(32);
  const syntheticSignerPublicKey = Buffer.from("cd".repeat(32), "hex");
  const prefix = Buffer.from(policy.prefixHex, "hex");
  const body = Buffer.from(
    `IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:${syntheticSubjectSha256}`,
    "utf8",
  );
  const signerList = Buffer.concat([
    Buffer.from([policy.requiredSignerCount]),
    syntheticSignerPublicKey,
  ]);
  const signedData = Buffer.concat([
    prefix,
    Buffer.from([policy.headerVersion]),
    signerList,
    body,
  ]);
  assert.equal(prefix.length, 16);
  assert.equal(body.length, 100);
  assert.equal(signerList.length, 33);
  assert.equal(signedData.length, 150);
  assert.equal(signedData[16], 1);
  assert.equal(signedData[17], 1);
  assert.deepEqual(signedData.subarray(18, 50), syntheticSignerPublicKey);
  assert.equal(signedData.subarray(50).toString("utf8"), body.toString("utf8"));
  assert.match(body.toString("utf8"), /^IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:[0-9a-f]{64}$/u);
  assert.ok([...body].every((byte) => byte >= 0x20 && byte <= 0x7e));
  assert.equal(signedData.includes(Buffer.from("702beeed5e696dcfc5a11c9ab06bae754ee89cecff543ed709a2b222e8c469f5", "hex")), false);
  assert.equal(signedData.includes(Buffer.from("6400", "hex")), false);

  const changedSubjectBody = Buffer.from(
    `IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:${"ac".repeat(32)}`,
    "utf8",
  );
  const changedSubjectBytes = Buffer.concat([
    prefix,
    Buffer.from([1, 1]),
    syntheticSignerPublicKey,
    changedSubjectBody,
  ]);
  const changedSignerBytes = Buffer.concat([
    prefix,
    Buffer.from([1, 1]),
    Buffer.from("ce".repeat(32), "hex"),
    body,
  ]);
  assert.notDeepEqual(changedSubjectBytes, signedData);
  assert.notDeepEqual(changedSignerBytes, signedData);
  assert.notEqual(createHash("sha256").update(changedSubjectBytes).digest("hex"), createHash("sha256").update(signedData).digest("hex"));
  assert.notEqual(createHash("sha256").update(changedSignerBytes).digest("hex"), createHash("sha256").update(signedData).digest("hex"));

  const unsorted = [Buffer.from("ff".repeat(32), "hex"), Buffer.from("00".repeat(32), "hex")];
  const sorted = [...unsorted].sort(Buffer.compare);
  assert.deepEqual(sorted[0], unsorted[1]);
  assert.deepEqual(sorted[1], unsorted[0]);
  assert.equal(new Set(sorted.map((value) => value.toString("hex"))).size, sorted.length);
  assert.equal(Buffer.alloc(64).length, policy.signatureByteLength);
});

test("OCMS-v1 layout, firmware signed_data, signer, and signature substitutions fail closed", () => {
  const substitutions = {
    prefixHex: "00".repeat(16),
    prefixByteLength: 15,
    headerVersion: 0,
    signerCountEncoding: "U16_LE",
    requiredSignerCount: 2,
    signerPublicKeyByteLength: 31,
    signersUniqueRequired: false,
    signersLexicographicallySortedRequired: false,
    signerListByteLength: 34,
    applicationDomainPresent: true,
    messageFormatPresent: true,
    bodyLengthPrefixPresent: true,
    bodyEncoding: "ASCII",
    bodyNonempty: false,
    bodyAsciiSubsetRequired: false,
    exactApplicationBodyByteLength: 99,
    exactSerializedByteLength: 149,
    protocolMaximumTotalByteLengthPresent: true,
    signatureByteLength: 63,
    signatureEnvelopeUsed: true,
    firmwareReturnsSignatureAndSignedDataSeparately: false,
    strictSignatureVerificationRequired: false,
    rejectNonCanonicalSignatureRequired: false,
    reconstructExactBytesRequired: false,
    firmwareReturnedSignedDataByteEqualityRequired: false,
    actualSerializedBytesSha256: "00".repeat(32),
  };
  for (const [key, value] of Object.entries(substitutions)) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.rootProtocol.ocmsV1SerializationPolicy[key] = value;
    assertRejected(mutation, `OCMS-v1 serialization substitution admitted at ${key}`);
  }
  for (const key of ["serializationFieldOrder", "signerListSerializationFieldOrder"]) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.rootProtocol.ocmsV1SerializationPolicy[key].reverse();
    assertRejected(mutation, `OCMS-v1 ${key} reordering admitted`);
  }

  const exactBody = Buffer.from(`IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:${"ab".repeat(32)}`, "utf8");
  const bodyMatches = (bytes) =>
    bytes.length === 100 && /^IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:[0-9a-f]{64}$/u.test(bytes.toString("utf8"));
  assert.equal(bodyMatches(exactBody), true);
  assert.equal(bodyMatches(Buffer.alloc(0)), false);
  assert.equal(bodyMatches(Buffer.from(`${exactBody.toString("utf8")}\n`, "utf8")), false);
  assert.equal(bodyMatches(Buffer.from("é", "utf8")), false);
});

test("every capability truth remains false/HOLD and every root-protocol actual remains null", () => {
  const truth = BPS08_SOURCE_DESIGN.truthBoundary;
  assert.deepEqual(truth, {
    sourceDesignPresent: true,
    rootPublicKeyPinned: false,
    ownerRootKeyAnchorCheckpointed: false,
    ownerRootKeyAnchorVerified: false,
    ownerRootProvisioningVerified: false,
    deviceObserved: false,
    firmwareCompatibilityVerified: false,
    ocmsVersionSelected: false,
    deviceReceiptVerified: false,
    physicalConfirmationObserved: false,
    anchorReceiptPresent: false,
    anchorSignatureVerified: false,
    ocmsSerializedBytesVerified: false,
    oneUseCasAccepted: false,
    launchProjectionVerified: false,
    toolchainProjectionVerified: false,
    peerPrincipalsVerified: false,
    timersVerified: false,
    compileAuthorized: false,
    compiled: false,
    installed: false,
    launched: false,
    runtimeObserved: false,
    publicDevnet: false,
    gate8Go: false,
    releasePermitted: false,
    mainnetPermitted: false,
    decision: "HOLD",
    authority: "NONE",
  });
  for (const [key, value] of Object.entries(truth)) {
    if (value !== false) {
      continue;
    }
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.truthBoundary[key] = true;
    assertRejected(mutation, `truth promotion admitted at truthBoundary.${key}`);
  }

  const rootNullPaths = collectNullPaths(BPS08_SOURCE_DESIGN.rootProtocol);
  assert.ok(rootNullPaths.length >= 20, "device/key/message/signature/receipt actuals must be explicitly null");
  for (const path of rootNullPaths) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    const parent = atPath(mutation.rootProtocol, path.slice(0, -1));
    parent[path.at(-1)] = "FORGED_SOURCE_ATTESTATION";
    assertRejected(mutation, `root-protocol actual promotion admitted at ${path.join(".")}`);
  }
  const receiptNullPaths = collectNullPaths(BPS08_SOURCE_DESIGN.anchorReceiptDesign);
  assert.ok(receiptNullPaths.length >= 15, "subject/serialized/signature/receipt actuals must be explicitly null");
  for (const path of receiptNullPaths) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    const parent = atPath(mutation.anchorReceiptDesign, path.slice(0, -1));
    parent[path.at(-1)] = "FORGED_SOURCE_ATTESTATION";
    assertRejected(mutation, `anchor-receipt actual promotion admitted at ${path.join(".")}`);
  }
});

test("anchor topology reserves independent FD12 before FD11, FD3, peers, and both timers", () => {
  const topology = BPS08_SOURCE_DESIGN.anchorTopology;
  assert.equal(topology.compileBootstrapFd, 3);
  assert.equal(topology.watchdogFd, 6);
  assert.equal(topology.observerFd, 7);
  assert.equal(topology.custodianFd, 8);
  assert.equal(topology.operationTimerFd, 9);
  assert.equal(topology.teardownTimerFd, 10);
  assert.equal(topology.anchorReceiptFd, 11);
  assert.equal(topology.ownerRootKeyAnchorFd, 12);
  assert.equal(new Set([3, 6, 7, 8, 9, 10, 11, 12]).size, 8);
  assert.equal(topology.ownerRootKeyAnchorRole, "OWNER_ROOT_KEY_ANCHOR");
  assert.equal(topology.ownerRootKeyAnchorStorage, "SEALED_MEMFD");
  assert.equal(topology.ownerRootKeyAnchorNlinkRequired, "0");
  assert.equal(topology.ownerRootKeyAnchorOwnerUidRequired, "0");
  assert.equal(topology.ownerRootKeyAnchorModeRequired, "0400");
  assert.equal(topology.ownerRootKeyAnchorSealSet, "F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE|F_SEAL_FUTURE_WRITE");
  assert.equal(topology.ownerRootKeyAnchorSameHandleReplayRequired, true);
  assert.equal(topology.verifyOwnerRootKeyAnchorBeforeAnchorReceiptRead, true);
  assert.equal(topology.verifyOwnerRootKeyAnchorBeforeBootstrapRead, true);
  assert.equal(topology.verifyOwnerRootKeyAnchorBeforePeerRpc, true);
  assert.equal(topology.ownerRootKeyAnchorDistinctFromEveryOtherFixedFdAndOfd, true);
  assert.equal(topology.verifyAnchorBeforeBootstrapRead, true);
  assert.equal(topology.verifyAnchorBeforePeerRpc, true);
  assert.equal(topology.bootstrapMaySelectRootKey, false);
  assert.equal(topology.bootstrapMayAuthorizePeerKeys, false);
  assert.equal(topology.bootstrapPeerKeysMustEqualAnchor, true);
  assert.equal(topology.peerKeysPairwiseDistinct, true);
  assert.equal(topology.peerKeysDistinctFromRoot, true);
  assert.equal(topology.peerPrincipalsPairwiseDistinct, true);
  assert.equal(topology.peerChannelsPairwiseDistinct, true);
  assert.equal(topology.operationAndTeardownTimerFdsDistinct, true);
  assert.equal(topology.operationAndTeardownTimerOfdsDistinct, true);
  assert.equal(topology.operationTimerPolicy.fd, 9);
  assert.equal(topology.teardownTimerPolicy.fd, 10);
  assert.equal(topology.operationTimerPolicy.actualProjection, null);
  assert.equal(topology.teardownTimerPolicy.actualProjection, null);
  assert.equal(topology.actualAnchorReceiptIdentity, null);
  assert.equal(topology.actualOwnerRootKeyAnchorIdentity, null);

  for (const key of [
    "compileBootstrapFd",
    "watchdogFd",
    "observerFd",
    "custodianFd",
    "operationTimerFd",
    "teardownTimerFd",
    "anchorReceiptFd",
    "ownerRootKeyAnchorFd",
  ]) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorTopology[key] += 32;
    assertRejected(mutation, `descriptor substitution admitted at anchorTopology.${key}`);
  }
  for (const key of [
    "ownerRootKeyAnchorSameHandleReplayRequired",
    "verifyOwnerRootKeyAnchorBeforeAnchorReceiptRead",
    "verifyOwnerRootKeyAnchorBeforeBootstrapRead",
    "verifyOwnerRootKeyAnchorBeforePeerRpc",
    "ownerRootKeyAnchorDistinctFromEveryOtherFixedFdAndOfd",
    "verifyAnchorBeforeBootstrapRead",
    "verifyAnchorBeforePeerRpc",
    "bootstrapMaySelectRootKey",
    "bootstrapMayAuthorizePeerKeys",
    "bootstrapPeerKeysMustEqualAnchor",
    "peerKeysPairwiseDistinct",
    "peerKeysDistinctFromRoot",
    "peerPrincipalsPairwiseDistinct",
    "peerChannelsPairwiseDistinct",
    "operationAndTeardownTimerFdsDistinct",
    "operationAndTeardownTimerOfdsDistinct",
  ]) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorTopology[key] = !mutation.anchorTopology[key];
    assertRejected(mutation, `topology-policy inversion admitted at anchorTopology.${key}`);
  }
});

test("FD12 owner-root key is future-checkpoint pinned and verified before any FD11 self-attestation", () => {
  const protocol = BPS08_SOURCE_DESIGN.rootProtocol;
  const policy = protocol.ownerRootKeyAnchorPolicy;
  assert.equal(protocol.ownerRootSource, "FD12_FUTURE_CHECKPOINT_PINNED_SEALED_SAME_HANDLE_RAW32_KEY_DESCRIPTOR");
  assert.deepEqual(policy, {
    fd: 12,
    role: "OWNER_ROOT_KEY_ANCHOR",
    schema: "iat-b3-bps08-owner-root-key-anchor-descriptor/v1",
    producer: "EXTERNAL_OWNER_ROOT_KEY_PROVISIONING_CUSTODIAN",
    outcome: "OWNER_ROOT_PUBLIC_KEY_ANCHOR_CHECKPOINTED_HOLD",
    pinningMode: "FUTURE_REVIEWED_CHECKPOINT_EXACT_DESCRIPTOR_AND_RAW32_KEY_IDENTITY",
    descriptorFieldOrder: [
      "schema", "producer", "outcome", "rootFingerprintSha256", "rootPublicKeyHex",
      "provisioningReceiptSha256", "contentSha256", "byteLength", "dev", "ino",
      "mountId", "handleSha256", "openFileDescriptionSha256", "decision", "authority",
    ],
    rawPublicKeyEncoding: "LOWERCASE_HEX_RAW_32_BYTES",
    fingerprintAlgorithm: "SHA256_RAW_ED25519_PUBLIC_KEY",
    exactContentAndKernelIdentityMustEqualExternalCheckpointDescriptor: true,
    externalCheckpointDescriptorMustPreexistFd11AndFd3: true,
    fd11MayNotSupplySignOrSelectRootKeyAnchor: true,
    peerDeviceCallerMayNotSupplySignOrSelectRootKeyAnchor: true,
    sameHandleReplayBeforeAndAfterFd11VerificationRequired: true,
    actualCheckpointTaskId: null,
    actualCheckpointOutcome: null,
    actualDescriptorSha256: null,
    actualRootPublicKeyHex: null,
    actualContentSha256: null,
    actualByteLength: null,
    actualDev: null,
    actualIno: null,
    actualMountId: null,
    actualHandleSha256: null,
    actualOpenFileDescriptionSha256: null,
  });
  for (const key of [
    "exactContentAndKernelIdentityMustEqualExternalCheckpointDescriptor",
    "externalCheckpointDescriptorMustPreexistFd11AndFd3",
    "fd11MayNotSupplySignOrSelectRootKeyAnchor",
    "peerDeviceCallerMayNotSupplySignOrSelectRootKeyAnchor",
    "sameHandleReplayBeforeAndAfterFd11VerificationRequired",
  ]) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.rootProtocol.ownerRootKeyAnchorPolicy[key] = false;
    assertRejected(mutation, `FD12 root-key noncircularity disabled at ${key}`);
  }
  for (const [key, value] of Object.entries({
    fd: 11,
    producer: "FD11_ANCHOR_RECEIPT",
    outcome: "SELF_ATTESTED",
    pinningMode: "BOOTSTRAP_SELECTED",
    rawPublicKeyEncoding: "CALLER_STRING",
    fingerprintAlgorithm: "CALLER_ASSERTION",
  })) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.rootProtocol.ownerRootKeyAnchorPolicy[key] = value;
    assertRejected(mutation, `FD12 root-key identity substitution admitted at ${key}`);
  }
  for (const key of Object.keys(policy).filter((key) => key.startsWith("actual"))) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.rootProtocol.ownerRootKeyAnchorPolicy[key] = "FORGED_CHECKPOINT_AUTHORITY";
    assertRejected(mutation, `future FD12 checkpoint fact promoted at ${key}`);
  }
  const reorderedDescriptor = clone(BPS08_SOURCE_DESIGN);
  reorderedDescriptor.rootProtocol.ownerRootKeyAnchorPolicy.descriptorFieldOrder.reverse();
  assertRejected(reorderedDescriptor, "FD12 descriptor field order substitution admitted");

  const verification = BPS08_SOURCE_DESIGN.anchorReceiptDesign.verificationOrder;
  const requiredPrefix = [
    "REPLAY_FD12_OWNER_ROOT_KEY_ANCHOR_SEALED_SAME_HANDLE_IDENTITY",
    "VERIFY_FD12_AGAINST_INDEPENDENT_FUTURE_CHECKPOINT_PINNED_DESCRIPTOR",
    "PARSE_FD12_EXACT_RAW32_OWNER_ROOT_PUBLIC_KEY_AND_PROVISIONING_IDENTITY",
    "REPLAY_FD11_SEALED_MEMFD_SAME_HANDLE_IDENTITY",
    "PARSE_EXACT_CANONICAL_ANCHOR_RECEIPT",
    "VERIFY_FD11_OWNER_ROOT_AND_FD12_IDENTITY_BINDINGS_BYTE_EQUAL",
  ];
  assert.deepEqual(verification.slice(0, requiredPrefix.length), requiredPrefix);
  const fd3Index = verification.findIndex((value) => /FD3/u.test(value));
  const firstPeerIndex = verification.findIndex((value) => /PEER_RPC/u.test(value));
  assert.ok(fd3Index > requiredPrefix.length - 1);
  assert.ok(firstPeerIndex > fd3Index);
  for (let index = 0; index < requiredPrefix.length; index += 1) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign.verificationOrder.splice(index, 1);
    assertRejected(mutation, `FD12/FD11 verification step removal admitted: ${requiredPrefix[index]}`);
  }
});

test("signed anchor subject closes roles, provenance, replay, domains, paths, and authority", () => {
  const design = BPS08_SOURCE_DESIGN.anchorReceiptDesign;
  assert.deepEqual(Object.keys(design), [
    "schema",
    "producer",
    "outcome",
    "canonicalSubjectDomain",
    "canonicalReceiptDomain",
    "canonicalJsonUtf8LfRequired",
    "subjectFieldOrder",
    "subjectPreimagePolicy",
    "peerRoleOrder",
    "peerPrincipalFieldOrder",
    "receiptFieldOrder",
    "ownerRootProvisioningFieldOrder",
    "ownerRootKeyAnchorFieldOrder",
    "deviceReceiptFieldOrder",
    "launchProjectionFieldOrder",
    "toolchainProjectionFieldOrder",
    "oneUseFieldOrder",
    "ocmsSignerListPolicy",
    "oneUsePolicy",
    "outerReceiptBindingPolicy",
    "verificationOrder",
    "receiptSha256ProjectionExcludes",
    "receiptIdentityDomain",
    "actualSubject",
    "actualSubjectSha256",
    "actualMessageBodySha256",
    "actualMessageBodyByteLength",
    "actualSignerListSha256",
    "actualSignerListByteLength",
    "actualSerializedMessageSha256",
    "actualSerializedMessageByteLength",
    "actualSignatureSha256",
    "actualSignatureByteLength",
    "actualOwnerRootKeyAnchorDescriptorSha256",
    "actualOwnerRootKeyAnchorIdentity",
    "actualReceipt",
    "actualReceiptSha256",
    "actualReceiptByteLength",
  ]);
  const receipt = JSON.stringify(design);
  assert.match(receipt, /watchdog/iu);
  assert.match(receipt, /observer/iu);
  assert.match(receipt, /custodian/iu);
  assert.match(receipt, /exact/iu);
  assert.match(receipt, /replay/iu);
  assert.match(receipt, /HOLD/u);
  assert.deepEqual(design.peerRoleOrder, ["watchdog", "observer", "custodian"]);
  for (const forgedRoles of [
    ["observer", "watchdog", "custodian"],
    ["watchdog", "watchdog", "custodian"],
    ["WATCHDOG", "observer", "custodian"],
  ]) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign.peerRoleOrder = forgedRoles;
    assertRejected(mutation, `peer role substitution admitted: ${forgedRoles.join(",")}`);
  }
  assert.equal(design.actualSubject, null);
  assert.equal(design.actualSubjectSha256, null);
  assert.equal(design.actualMessageBodySha256, null);
  assert.equal(design.actualMessageBodyByteLength, null);
  assert.equal(design.actualSignerListSha256, null);
  assert.equal(design.actualSignerListByteLength, null);
  assert.equal(design.actualSerializedMessageSha256, null);
  assert.equal(design.actualSerializedMessageByteLength, null);
  assert.equal(design.actualSignatureSha256, null);
  assert.equal(design.actualSignatureByteLength, null);
  assert.equal(design.actualOwnerRootKeyAnchorDescriptorSha256, null);
  assert.equal(design.actualOwnerRootKeyAnchorIdentity, null);
  assert.equal(design.actualReceipt, null);
  assert.equal(design.actualReceiptSha256, null);
  assert.equal(design.actualReceiptByteLength, null);
  assert.deepEqual(design.ownerRootProvisioningFieldOrder, [
    "schema",
    "producer",
    "outcome",
    "rootFingerprintSha256",
    "rootPublicKeyHex",
    "provisioningSourceIdentitySha256",
    "observedAtMonotonicNs",
    "decision",
    "authority",
  ]);
  assert.deepEqual(design.ownerRootKeyAnchorFieldOrder, [
    "schema",
    "producer",
    "outcome",
    "rootFingerprintSha256",
    "rootPublicKeyHex",
    "provisioningReceiptSha256",
    "contentSha256",
    "byteLength",
    "dev",
    "ino",
    "mountId",
    "handleSha256",
    "openFileDescriptionSha256",
    "decision",
    "authority",
  ]);
  assert.deepEqual(design.deviceReceiptFieldOrder, [
    "schema",
    "producer",
    "outcome",
    "deviceModel",
    "firmwareVersion",
    "firmwareIdentitySha256",
    "derivationPath",
    "accountPublicKeyHex",
    "accountAddress",
    "physicalConfirmationReceiptSha256",
    "observedAtMonotonicNs",
    "decision",
    "authority",
  ]);
  assert.deepEqual(design.launchProjectionFieldOrder, [
    "successorExecutorSha256",
    "sourceFdManifestSha256",
    "launchArgvSha256",
    "launchEnvironmentSha256",
    "launchCwdIdentitySha256",
    "startupClosureSha256",
  ]);
  assert.deepEqual(design.toolchainProjectionFieldOrder, [
    "toolchainManifestSha256",
    "toolOpenFileDescriptionManifestSha256",
    "sysrootManifestSha256",
    "staticNodeIdentitySha256",
  ]);
  assert.deepEqual(design.oneUseFieldOrder, [
    "bootId",
    "anchorNonceHex",
    "anchorCasKeySha256",
    "anchorCasAcquireReceiptSha256",
    "anchorExpiresAtMonotonicNs",
  ]);
  assert.deepEqual(design.outerReceiptBindingPolicy, {
    receiptAttemptRunSessionMustEqualSignedSubject: true,
    receiptSubjectSha256MustEqualRecomputedSubjectPreimageSha256: true,
    receiptRootPublicKeyMustEqualSignedSubjectOwnerRoot: true,
    receiptOwnerRootKeyAnchorProducerOutcomeAndIdentityMustEqualFd12Replay: true,
    receiptDeviceReceiptSha256MustEqualSignedSubjectDeviceReceiptSha256: true,
    receiptOcmsVersionMustEqualFirmwareSelectedVersionOne: true,
    hardwareMessageMustEqualTemplateAppliedToRecomputedSubjectSha256: true,
    messageBodySha256AndByteLengthMustEqualExactUtf8Body: true,
    signerListSha256AndByteLengthMustEqualExactCountAndSortedKeys: true,
    serializedMessageSha256AndByteLengthMustEqualRebuiltOcmsV1Bytes: true,
    signatureSha256AndByteLengthMustEqualRawSignatureHex: true,
    firmwareReturnedSignedDataMustByteEqualRebuiltSerializedMessage: true,
    signatureMustVerifyExactOcmsBytesAndCausalSignerList: true,
    fullSerializedBytesRequiredForVerification: true,
    digestOnlyCallerAuthorityPermitted: false,
  });
  assert.deepEqual(design.ocmsSignerListPolicy, {
    source: "EXACT_OCMS_V1_SERIALIZED_SIGNER_LIST",
    serializationFieldOrder: [
      "SIGNER_COUNT_U8",
      "LEXICOGRAPHICALLY_SORTED_UNIQUE_SIGNER_PUBLIC_KEYS",
    ],
    requiredSignerCount: 1,
    ownerRootSignerIndex: 0,
    signerPublicKeyByteLength: 32,
    exactSignerListByteLength: 33,
    uniqueRequired: true,
    lexicographicSortRequired: true,
    signerPublicKeyMustEqualProvisionedOwnerRoot: true,
    signerListDigestMustBeInSignedSubject: true,
    actualSignerListByteLength: null,
    actualSignerListSha256: null,
  });
  assert.deepEqual(design.oneUsePolicy, {
    nonceEncoding: "LOWERCASE_HEX_RAW_32_BYTES",
    casOwner: "EXTERNAL_PRELAUNCH_SUPERVISOR_ANCHOR_CUSTODIAN",
    casInitialState: "ABSENT",
    casAcceptedState: "ACQUIRED_ONCE",
    casTerminalState: "CONSUMED_OR_EXPIRED_HOLD",
    expiryClock: "CLOCK_MONOTONIC",
    acquireBeforeAnchorAcceptance: true,
    rejectReplayAfterConsumeOrExpiry: true,
    actualBootId: null,
    actualNonceHex: null,
    actualCasKeySha256: null,
    actualCasAcquireReceiptSha256: null,
    actualExpiresAtMonotonicNs: null,
  });
  assert.ok(design.subjectFieldOrder.includes("ownerRootProvisioningReceiptSha256"));
  assert.ok(!design.ownerRootProvisioningFieldOrder.includes("ownerRootProvisioningReceiptSha256"));
  assert.ok(!design.ownerRootProvisioningFieldOrder.includes("receiptSha256"));

  for (const [key, value] of Object.entries({
    requiredSignerCount: 2,
    ownerRootSignerIndex: 1,
    signerPublicKeyByteLength: 31,
    exactSignerListByteLength: 34,
    uniqueRequired: false,
    lexicographicSortRequired: false,
    signerPublicKeyMustEqualProvisionedOwnerRoot: false,
    signerListDigestMustBeInSignedSubject: false,
  })) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign.ocmsSignerListPolicy[key] = value;
    assertRejected(mutation, `OCMS signer-list substitution admitted at ${key}`);
  }
  for (const [key, value] of Object.entries({
    casOwner: "CALLER",
    casInitialState: "ACQUIRED_ONCE",
    casAcceptedState: "ABSENT",
    casTerminalState: "REUSABLE",
    expiryClock: "CLOCK_REALTIME",
    acquireBeforeAnchorAcceptance: false,
    rejectReplayAfterConsumeOrExpiry: false,
  })) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign.oneUsePolicy[key] = value;
    assertRejected(mutation, `one-use/CAS substitution admitted at ${key}`);
  }
  for (const key of Object.keys(design.outerReceiptBindingPolicy)) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign.outerReceiptBindingPolicy[key] =
      !design.outerReceiptBindingPolicy[key];
    assertRejected(mutation, `outer-receipt binding polarity changed at ${key}`);
  }
  const anchorStep = design.verificationOrder.findIndex((value) => /anchor/iu.test(value));
  const bootstrapStep = design.verificationOrder.findIndex((value) => /bootstrap|FD3/iu.test(value));
  assert.ok(anchorStep >= 0 && bootstrapStep > anchorStep, "anchor verification must precede FD3 bootstrap trust");
});

test("OCMS-signed subject closes owner root, device confirmation, freshness, and executor causation", () => {
  const design = BPS08_SOURCE_DESIGN.anchorReceiptDesign;
  assert.deepEqual(design.subjectFieldOrder, EXPECTED_SIGNED_SUBJECT_FIELDS);
  const fields = design.subjectFieldOrder.join("\n");
  const requiredBindings = [
    ["owner-root public-key identity", /(?:owner.*root.*public.*key|rootPublicKey(?:Hex|Sha256))/iu],
    ["owner-root fingerprint", /(?:owner.*root.*fingerprint|root.*fingerprint.*sha256)/iu],
    ["device model", /device.*model/iu],
    ["firmware", /firmware/iu],
    ["derivation path", /derivation.*path/iu],
    ["account/public address", /(?:solana.*(?:account|address|public.*key)|account.*public.*key)/iu],
    ["physical-confirmation receipt", /(?:physical.*confirmation|confirmation.*receipt)/iu],
    ["boot identity", /boot.*(?:id|sha256)/iu],
    ["one-use anchor nonce", /(?:anchor.*nonce|nonce.*anchor)/iu],
    ["anchor CAS receipt", /(?:anchor.*cas|cas.*receipt)/iu],
    ["anchor expiry", /(?:anchor.*expir|expir.*monotonic)/iu],
    ["argv projection", /argv.*sha256/iu],
    ["environment projection", /env(?:ironment)?.*sha256/iu],
    ["cwd projection", /cwd.*sha256/iu],
    ["startup closure", /startup.*sha256/iu],
    ["source projection", /source.*sha256/iu],
    ["toolchain projection", /toolchain.*sha256/iu],
  ];
  for (const [label, pattern] of requiredBindings) {
    assert.match(fields, pattern, `OCMS-signed subject omits ${label}`);
  }

  const verification = design.verificationOrder.join("\n");
  assert.match(verification, /FD11/iu);
  assert.match(verification, /(?:OWNER_ROOT_PROVISIONING|PINNED.*OWNER_ROOT|PINNED.*ROOT_PUBLIC_KEY)/iu);
  assert.match(verification, /OCMS_V1/iu);
  assert.match(verification, /(?:CAS|ONE_USE)/iu);
  assert.match(verification, /EXPIR/iu);
  assert.match(verification, /FIRMWARE/iu);
  assert.match(verification, /PHYSICAL_CONFIRMATION/iu);
  assert.match(verification, /FD3/iu);

  for (const [, pattern] of requiredBindings) {
    const index = design.subjectFieldOrder.findIndex((field) => pattern.test(field));
    assert.ok(index >= 0);
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign.subjectFieldOrder.splice(index, 1);
    assertRejected(mutation, `signed-subject binding removal admitted: ${design.subjectFieldOrder[index]}`);
  }
  for (let index = 0; index < design.subjectFieldOrder.length; index += 1) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    const [removed] = mutation.anchorReceiptDesign.subjectFieldOrder.splice(index, 1);
    assertRejected(mutation, `signed-subject field removal admitted: ${removed}`);
  }

  const preimagePolicy = design.subjectPreimagePolicy;
  assert.deepEqual(preimagePolicy, {
    serializationFieldOrder: ["DOMAIN_ASCII", "NUL", "CANONICAL_JSON_UTF8", "LF"],
    domainAscii: "IAT_B3_BPS08_ANCHOR_SUBJECT_V1",
    domainAsciiByteLength: 30,
    separatorHex: "00",
    canonicalJsonEncoding: "UTF8",
    canonicalJsonObjectFieldOrderSource: "EXACT_SUBJECT_FIELD_ORDER",
    canonicalJsonWhitespace: "NONE",
    canonicalJsonTrailingLfRequired: true,
    finalLfHex: "0a",
    preimageFormula: "ASCII_DOMAIN||00||JSON_STRINGIFY_ORDERED_SUBJECT_WITHOUT_TRAILING_LF||0A",
    subjectSha256Algorithm: "SHA256",
    subjectSha256Encoding: "LOWERCASE_HEX_RAW_32_BYTES",
    duplicateUnknownMissingOrReorderedSubjectKeyRejected: true,
    actualCanonicalJsonSha256: null,
    actualPreimageByteLength: null,
    actualSubjectSha256: null,
  });
  const syntheticCanonicalJson = JSON.stringify({ schema: "IAT_B3_BPS08_SYNTHETIC_NONAUTHORITY" });
  assert.equal(design.canonicalSubjectDomain, preimagePolicy.domainAscii);
  const preimage = Buffer.concat([
    Buffer.from(preimagePolicy.domainAscii, "ascii"),
    Buffer.from(preimagePolicy.separatorHex, "hex"),
    Buffer.from(syntheticCanonicalJson, "utf8"),
    Buffer.from(preimagePolicy.finalLfHex, "hex"),
  ]);
  const domainBytes = Buffer.from(preimagePolicy.domainAscii, "ascii");
  assert.equal(domainBytes.length, preimagePolicy.domainAsciiByteLength);
  assert.deepEqual(preimage.subarray(0, domainBytes.length), domainBytes);
  assert.equal(preimage[domainBytes.length], 0);
  assert.equal(preimage.at(-1), 0x0a);
  assert.equal(preimage.subarray(domainBytes.length + 1, -1).toString("utf8"), syntheticCanonicalJson);
  assert.equal(createHash("sha256").update(preimage).digest("hex").length, 64);

  for (const [key, value] of Object.entries({
    domainAscii: "IAT_B3_BPS08_ANCHOR_SUBJECT_V0",
    domainAsciiByteLength: 29,
    separatorHex: "01",
    canonicalJsonEncoding: "UTF16LE",
    canonicalJsonObjectFieldOrderSource: "CALLER_ORDER",
    canonicalJsonWhitespace: "OPTIONAL",
    canonicalJsonTrailingLfRequired: false,
    finalLfHex: "0d0a",
    subjectSha256Algorithm: "SHA512",
    duplicateUnknownMissingOrReorderedSubjectKeyRejected: false,
    actualSubjectSha256: "00".repeat(32),
  })) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign.subjectPreimagePolicy[key] = value;
    assertRejected(mutation, `subject-preimage substitution admitted at ${key}`);
  }
  const reorderedPreimage = clone(BPS08_SOURCE_DESIGN);
  reorderedPreimage.anchorReceiptDesign.subjectPreimagePolicy.serializationFieldOrder.reverse();
  assertRejected(reorderedPreimage, "subject-preimage byte order substitution admitted");

  for (const key of ["canonicalSubjectDomain", "canonicalReceiptDomain", "receiptIdentityDomain"]) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.anchorReceiptDesign[key] += "_FORGED";
    assertRejected(mutation, `domain substitution admitted at anchorReceiptDesign.${key}`);
  }
});

test("hostile matrix names every authority-confusion and replay class", () => {
  const hostiles = JSON.stringify(BPS08_SOURCE_DESIGN.hostileCases);
  for (const token of [
    "root",
    "role",
    "replay",
    "domain",
    "firmware",
    "path",
    "authority",
    "FD11",
    "FD3",
    "FD9",
    "FD10",
    "PUBLIC_KEY",
    "signature",
  ]) {
    assert.match(hostiles, new RegExp(token, "iu"), `hostile matrix omits ${token}`);
  }
});

test("root, role, replay, domain, firmware, path, and authority substitutions fail closed", () => {
  const scopes = [
    ["root", BPS08_SOURCE_DESIGN.rootProtocol],
    ["role", BPS08_SOURCE_DESIGN.anchorReceiptDesign],
    ["replay", BPS08_SOURCE_DESIGN.anchorReceiptDesign],
    ["domain", BPS08_SOURCE_DESIGN.anchorReceiptDesign],
    ["firmware", BPS08_SOURCE_DESIGN.rootProtocol],
    ["path", BPS08_SOURCE_DESIGN.rootProtocol],
    ["authority", BPS08_SOURCE_DESIGN],
  ];
  for (const [label, scope] of scopes) {
    const matches = collectLeafPaths(scope).filter(([path, value]) =>
      `${path.join(".")}=${String(value)}`.toLowerCase().includes(label.toLowerCase()),
    );
    assert.ok(matches.length > 0, `canonical design exposes no ${label} binding to attack`);
    for (const [scopePath, value] of matches.slice(0, 4)) {
      const mutation = clone(BPS08_SOURCE_DESIGN);
      const rootPath = scope === BPS08_SOURCE_DESIGN
        ? scopePath
        : [
            scope === BPS08_SOURCE_DESIGN.rootProtocol ? "rootProtocol" : "anchorReceiptDesign",
            ...scopePath,
          ];
      replaceAtPath(mutation, rootPath, forgedScalar(value));
      assertRejected(mutation, `${label} substitution admitted at ${rootPath.join(".")}`);
    }
  }
});

test("source contract exposes no device, process, network, signing, or runtime execution API", () => {
  const source = readFileSync(CONTRACT_PATH, "utf8");
  assert.doesNotMatch(source, /from\s+["']node:(?:child_process|net|http|https|tls|dgram|worker_threads)["']/u);
  assert.doesNotMatch(source, /\b(?:spawn|spawnSync|exec|execFile|execSync|fork)\s*\(/u);
  assert.doesNotMatch(source, /\b(?:fetch|WebSocket)\s*\(/u);
  assert.doesNotMatch(source, /\b(?:hid|usb)\.(?:open|connect|write|transfer)/iu);
});

test("stop boundary remains source-design-only HOLD with no downstream authority", () => {
  const stop = BPS08_SOURCE_DESIGN.stopBoundary;
  assert.deepEqual(stop, {
    afterBps08: "SOURCE_DESIGN_AMENDMENT_FROZEN_HOLD",
    afterBps08R: "SOURCE_DESIGN_AMENDMENT_REVIEWED_HOLD",
    implementationAuthorized: false,
    checkpointAuthorizedByThisOutcome: false,
    deviceActionAuthorized: false,
    privateKeyHandlingAuthorized: false,
    compileInstallOrRuntimeAuthorized: false,
    finalDecision: "HOLD",
  });
  for (const key of [
    "implementationAuthorized",
    "checkpointAuthorizedByThisOutcome",
    "deviceActionAuthorized",
    "privateKeyHandlingAuthorized",
    "compileInstallOrRuntimeAuthorized",
  ]) {
    const mutation = clone(BPS08_SOURCE_DESIGN);
    mutation.stopBoundary[key] = true;
    assertRejected(mutation, `stop-boundary promotion admitted at ${key}`);
  }
});

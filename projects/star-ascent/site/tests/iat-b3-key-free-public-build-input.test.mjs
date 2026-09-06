import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  IAT_B3_KEY_FREE_ASSESSMENT_SCHEMA,
  IAT_B3_KEY_FREE_CHECKPOINT_SCHEMA,
  IAT_B3_KEY_FREE_DECLARED_GENESIS,
  IAT_B3_KEY_FREE_DECLARED_GENESIS_INPUT_PATH,
  IAT_B3_KEY_FREE_GENESIS_CLASSIFICATION,
  IAT_B3_KEY_FREE_IDENTITY_INPUT_PATH,
  IAT_B3_KEY_FREE_PURPOSE,
  IAT_B3_KEY_FREE_TEMPLATE_SCHEMA,
  canonicalIatB3KeyFreePublicBuildInputJson,
  createIatB3KeyFreePublicBuildPayloads,
  deriveIatB3KeyFreePublicIds,
  parseAndValidateIatB3KeyFreePublicBuildInputJson,
  parseIatB3KeyFreePublicBuildInputJson,
  validateIatB3KeyFreePublicBuildInput,
} from "../scripts/lib/iat-b3-key-free-public-build-input.mjs";

const TEMPLATE_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-key-free-public-build-input.template.v1.json",
  import.meta.url,
));

const CHECKPOINT = Object.freeze({
  schema: IAT_B3_KEY_FREE_CHECKPOINT_SCHEMA,
  headSha: "07b58cc94d9722c80f549f979f78b013c1794add",
  treeSha: "c13387c8403747f984b0a5fdb749060282905c97",
  b26RunnerSha256: "c34b347b860d23679b39a0e6fdd5b704611b9de79638dde53db8b23dfa7129bf",
  laneId: "iat-b3-build-only-a1",
});
const GENERATED_AT = "2026-08-14T06:30:00.000Z";
const NOW_UTC = "2026-08-14T06:40:00.000Z";

function clone(value) {
  return structuredClone(value);
}

function fixture(checkpoint = CHECKPOINT, generatedAtUtc = GENERATED_AT) {
  return createIatB3KeyFreePublicBuildPayloads({ trustedCheckpoint: checkpoint, generatedAtUtc });
}

function fileBinding(path, text) {
  return {
    path,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
  };
}

function jsonFixture(checkpoint = CHECKPOINT, generatedAtUtc = GENERATED_AT) {
  const payloads = fixture(checkpoint, generatedAtUtc);
  const identityJson = canonicalIatB3KeyFreePublicBuildInputJson(payloads.identity);
  const declaredGenesisJson = canonicalIatB3KeyFreePublicBuildInputJson(payloads.declaredGenesis);
  return {
    ...payloads,
    identityJson,
    declaredGenesisJson,
    identityFile: fileBinding(IAT_B3_KEY_FREE_IDENTITY_INPUT_PATH, identityJson),
    declaredGenesisFile: fileBinding(
      IAT_B3_KEY_FREE_DECLARED_GENESIS_INPUT_PATH,
      declaredGenesisJson,
    ),
  };
}

function validateObjects(payloads = fixture(), options = {}) {
  return validateIatB3KeyFreePublicBuildInput({
    identity: payloads.identity,
    declaredGenesis: payloads.declaredGenesis,
    trustedCheckpoint: options.trustedCheckpoint ?? CHECKPOINT,
    nowUtc: options.nowUtc ?? NOW_UTC,
    forbiddenProductionIds: options.forbiddenProductionIds ?? [],
    previouslyObservedPublicIds: options.previouslyObservedPublicIds ?? [],
  });
}

function validateJson(value = jsonFixture(), options = {}) {
  return parseAndValidateIatB3KeyFreePublicBuildInputJson({
    identityJson: value.identityJson,
    declaredGenesisJson: value.declaredGenesisJson,
    identityFile: value.identityFile,
    declaredGenesisFile: value.declaredGenesisFile,
    trustedCheckpoint: options.trustedCheckpoint ?? CHECKPOINT,
    nowUtc: options.nowUtc ?? NOW_UTC,
    forbiddenProductionIds: options.forbiddenProductionIds ?? [],
    previouslyObservedPublicIds: options.previouslyObservedPublicIds ?? [],
  });
}

test("deterministic key-free identities are canonical, distinct, and stable", () => {
  const first = deriveIatB3KeyFreePublicIds(CHECKPOINT);
  const second = deriveIatB3KeyFreePublicIds(clone(CHECKPOINT));
  assert.deepEqual(first, second);
  assert.equal(new Set(Object.values(first)).size, 3);
  for (const value of Object.values(first)) {
    assert.match(value, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u);
  }
});

test("changing the lane changes all build-only public identities", () => {
  const changed = deriveIatB3KeyFreePublicIds({ ...CHECKPOINT, laneId: "iat-b3-build-only-b1" });
  const original = deriveIatB3KeyFreePublicIds(CHECKPOINT);
  for (const key of Object.keys(original)) assert.notEqual(changed[key], original[key]);
});

test("generated payloads validate as nonauthorizing HOLD", () => {
  const result = validateObjects();
  assert.equal(result.schema, IAT_B3_KEY_FREE_ASSESSMENT_SCHEMA);
  assert.equal(result.status, "HOLD");
  assert.equal(result.purpose, IAT_B3_KEY_FREE_PURPOSE);
  assert.equal(result.structuralContractValid, true);
  assert.equal(result.structuralPayloadsValidated, true);
  assert.equal(result.authorizingBuildInputValidated, false);
  assert.equal(result.ready, false);
  assert.equal(result.consumerPromotionPermitted, false);
  assert.equal(result.capabilityIssued, false);
  assert.equal(result.callerSuppliedInputTextAndBindingStructurallyMatched, false);
  assert.equal(result.checkpointDirectlyObservedByThisModule, false);
  assert.equal(result.wallClockDirectlyObservedByThisModule, false);
  assert.equal(result.inputFilesDirectlyObservedByThisModule, false);
  assert.equal(result.productionIdentityInventoryDirectlyObservedByThisModule, false);
  assert.equal(result.priorLaneIdentityInventoryDirectlyObservedByThisModule, false);
  assert.equal(result.consumerMustSupplyDirectObservations, true);
  assert.equal(result.declaredGenesisClassification, IAT_B3_KEY_FREE_GENESIS_CLASSIFICATION);
  assert.deepEqual(result.deterministicPublicIds, deriveIatB3KeyFreePublicIds(CHECKPOINT));
  assert.deepEqual(result.truthBoundary, {
    keypairGenerated: false,
    privateKeyObserved: false,
    signerObserved: false,
    signatureObserved: false,
    payerObserved: false,
    payerBalanceObserved: false,
    fundingObserved: false,
    endpointUseAuthorized: false,
    networkContacted: false,
    rpcObserved: false,
    declaredGenesisNetworkObserved: false,
    deployable: false,
    deploymentAuthorized: false,
    releaseAuthorized: false,
    productionIdentityManifestSatisfied: false,
    executionAuthorized: false,
    signerBearingRehearsalAuthorized: false,
    publicDevnetAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  });
});

test("canonical JSON byte inputs and exact file bindings validate", () => {
  const source = jsonFixture();
  const result = validateJson(source);
  assert.equal(result.structuralInputFileClaims.identity.sha256, source.identityFile.sha256);
  assert.equal(
    result.structuralInputFileClaims.declaredGenesis.sha256,
    source.declaredGenesisFile.sha256,
  );
  assert.notEqual(
    result.structuralInputFileClaims.identity.path,
    result.structuralInputFileClaims.declaredGenesis.path,
  );
  assert.equal(result.authorizingBuildInputValidated, false);
  assert.equal(result.inputFilesDirectlyObservedByThisModule, false);
  assert.equal(result.callerSuppliedInputTextAndBindingStructurallyMatched, true);
  assert.equal(source.identityJson.endsWith("\n"), true);
  assert.equal(source.identityJson.slice(0, -1).includes("\n"), false);
});

test("duplicate JSON members are rejected before ordinary parsing", () => {
  const duplicate = "{\"schema\":\"one\",\"schema\":\"two\"}\n";
  assert.throws(
    () => parseIatB3KeyFreePublicBuildInputJson(duplicate, "duplicate"),
    /duplicate JSON member/u,
  );
});

test("noncanonical pretty JSON and missing terminal LF are rejected", () => {
  const { identity } = fixture();
  assert.throws(
    () => parseIatB3KeyFreePublicBuildInputJson(`${JSON.stringify(identity, null, 2)}\n`),
    /canonical sorted JSON/u,
  );
  assert.throws(
    () => parseIatB3KeyFreePublicBuildInputJson(
      canonicalIatB3KeyFreePublicBuildInputJson(identity).slice(0, -1),
    ),
    /canonical sorted JSON/u,
  );
});

test("identity derivation drift and extra fields are rejected", () => {
  const badIdentity = clone(fixture().identity);
  badIdentity.lawProgramId = badIdentity.economyProgramId;
  assert.throws(
    () => validateObjects({ ...fixture(), identity: badIdentity }),
    /pairwise distinct/u,
  );
  const extra = clone(fixture().identity);
  extra.payerPublicKey = extra.lawProgramId;
  assert.throws(
    () => validateObjects({ ...fixture(), identity: extra }),
    /expected exact keys/u,
  );
});

test("checkpoint or lane drift is rejected", () => {
  const payloads = fixture();
  assert.throws(
    () => validateObjects(payloads, {
      trustedCheckpoint: { ...CHECKPOINT, headSha: `1${CHECKPOINT.headSha.slice(1)}` },
    }),
    /deterministic derivation mismatch/u,
  );
  assert.throws(
    () => validateObjects(payloads, {
      trustedCheckpoint: { ...CHECKPOINT, laneId: "iat-b3-build-only-b1" },
    }),
    /does not match trusted checkpoint/u,
  );
});

test("future-dated and stale payloads remain HOLD by rejection", () => {
  assert.throws(
    () => validateObjects(fixture(CHECKPOINT, "2026-08-14T06:41:00.000Z")),
    /future-dated or older/u,
  );
  assert.throws(
    () => validateObjects(fixture(CHECKPOINT, "2026-08-14T06:20:00.000Z")),
    /future-dated or older/u,
  );
});

test("declared Genesis labels are compile inputs and cannot drift", () => {
  const payloads = fixture();
  assert.deepEqual(
    {
      network: payloads.declaredGenesis.network,
      rpcUrl: payloads.declaredGenesis.rpcUrl,
      genesisHash: payloads.declaredGenesis.genesisHash,
    },
    IAT_B3_KEY_FREE_DECLARED_GENESIS,
  );
  const changed = clone(payloads.declaredGenesis);
  changed.network = "mainnet-beta";
  assert.throws(
    () => validateObjects({ ...payloads, declaredGenesis: changed }),
    /declared compile-domain constant drifted/u,
  );
});

test("production and prior-lane public identity reuse are rejected", () => {
  const ids = deriveIatB3KeyFreePublicIds(CHECKPOINT);
  assert.throws(
    () => validateObjects(fixture(), { forbiddenProductionIds: [ids.lawProgramId] }),
    /production identity reuse rejected/u,
  );
  assert.throws(
    () => validateObjects(fixture(), { previouslyObservedPublicIds: [ids.canonicalMint] }),
    /prior-lane identity reuse rejected/u,
  );
});

test("file hashes, byte lengths, distinct paths, and nonsecret paths are enforced", () => {
  const wrongHash = jsonFixture();
  wrongHash.identityFile.sha256 = "0".repeat(64);
  assert.throws(() => validateJson(wrongHash), /does not match exact input bytes/u);

  const samePath = jsonFixture();
  samePath.declaredGenesisFile.path = samePath.identityFile.path;
  assert.throws(() => validateJson(samePath), /expected exact fixed path/u);

  const secretPath = jsonFixture();
  secretPath.identityFile.path = "inputs/private-keypair.json";
  assert.throws(() => validateJson(secretPath), /expected exact fixed path/u);
});

test("only the two exact lowercase fixed input paths are accepted", () => {
  const rejectedIdentityPaths = [
    "INPUTS/BUILD-ONLY-IDENTITY.JSON",
    "Inputs/build-only-identity.json",
    "./inputs/build-only-identity.json",
    "inputs/declared/./identity.json",
    "inputs/../build-only-identity.json",
    "inputs//build-only-identity.json",
    "inputs\\build-only-identity.json",
    "C:/inputs/build-only-identity.json",
    "//server/share/build-only-identity.json",
    "inputs/operatorPrivateKey.json",
    "inputs/.ssh/id_ed25519",
    "inputs/wallet.json",
    "inputs/.env",
    "inputs/credentials.json",
    "inputs/keystore.json",
    "inputs/CON",
    "inputs/build-only-identity.json.",
  ];
  for (const path of rejectedIdentityPaths) {
    const changed = jsonFixture();
    changed.identityFile.path = path;
    assert.throws(() => validateJson(changed), /expected exact fixed path/u, path);
  }
  const changedGenesis = jsonFixture();
  changedGenesis.declaredGenesisFile.path = "inputs/Declared-Genesis.json";
  assert.throws(() => validateJson(changedGenesis), /expected exact fixed path/u);
});

test("caller-relative time and empty inventories never become direct observations", () => {
  const ancientGeneratedAt = "2000-01-01T00:00:00.000Z";
  const result = validateObjects(fixture(CHECKPOINT, ancientGeneratedAt), {
    nowUtc: "2000-01-01T00:10:00.000Z",
  });
  assert.equal(result.structuralContractValid, true);
  assert.equal(result.callerSuppliedAgeMilliseconds, 600_000);
  assert.equal(result.wallClockDirectlyObservedByThisModule, false);
  assert.equal(result.productionIdentityInventoryClaimCount, 0);
  assert.equal(result.priorLaneIdentityInventoryClaimCount, 0);
  assert.equal(result.productionIdentityInventoryDirectlyObservedByThisModule, false);
  assert.equal(result.priorLaneIdentityInventoryDirectlyObservedByThisModule, false);
  assert.ok(result.blockers.includes("DIRECT_WALL_CLOCK_OBSERVER_REQUIRED_BY_CONSUMER"));
  assert.ok(result.blockers.includes(
    "DIRECT_PRODUCTION_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
  ));
  assert.ok(result.blockers.includes(
    "DIRECT_PRIOR_LANE_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
  ));
});

test("serialized structural output is frozen, nonauthorizing, and not a success token", () => {
  const result = validateJson();
  assert.equal(Object.hasOwn(result, "valid"), false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.truthBoundary), true);
  assert.equal(result.authorizingBuildInputValidated, false);
  assert.equal(result.consumerPromotionPermitted, false);
  assert.equal(result.capabilityIssued, false);
  assert.ok(result.blockers.includes("DIRECT_INPUT_FILE_OBSERVER_REQUIRED_BY_CONSUMER"));
  assert.ok(result.blockers.includes("THIS_ARTIFACT_DOES_NOT_AUTHORIZE_EXECUTION"));
  const serialized = JSON.parse(JSON.stringify(result));
  assert.equal(serialized.status, "HOLD");
  assert.equal(serialized.authorizingBuildInputValidated, false);
  assert.equal(serialized.consumerPromotionPermitted, false);
  assert.equal(serialized.inputFilesDirectlyObservedByThisModule, false);
  assert.equal(serialized.truthBoundary.endpointUseAuthorized, false);
  assert.equal(serialized.truthBoundary.deploymentAuthorized, false);
  assert.equal(serialized.truthBoundary.releaseAuthorized, false);
});

test("object accessors and proxies are rejected without invoking accessors", () => {
  const payloads = fixture();
  let getterReads = 0;
  const identity = clone(payloads.identity);
  Object.defineProperty(identity, "schema", {
    enumerable: true,
    get() {
      getterReads += 1;
      return payloads.identity.schema;
    },
  });
  assert.throws(
    () => validateObjects({ ...payloads, identity }),
    /accessor properties are rejected/u,
  );
  assert.equal(getterReads, 0);
  assert.throws(
    () => validateObjects({ ...payloads, identity: new Proxy(payloads.identity, {}) }),
    /proxy objects are rejected/u,
  );

  const outer = {
    identity: payloads.identity,
    declaredGenesis: payloads.declaredGenesis,
    trustedCheckpoint: CHECKPOINT,
    nowUtc: NOW_UTC,
    forbiddenProductionIds: [],
    previouslyObservedPublicIds: [],
  };
  Object.defineProperty(outer, "identity", {
    enumerable: true,
    get() {
      getterReads += 1;
      return payloads.identity;
    },
  });
  assert.throws(
    () => validateIatB3KeyFreePublicBuildInput(outer),
    /accessor properties are rejected/u,
  );
  assert.equal(getterReads, 0);
  assert.throws(
    () => validateIatB3KeyFreePublicBuildInput(new Proxy({
      identity: payloads.identity,
      declaredGenesis: payloads.declaredGenesis,
      trustedCheckpoint: CHECKPOINT,
      nowUtc: NOW_UTC,
      forbiddenProductionIds: [],
      previouslyObservedPublicIds: [],
    }, {})),
    /proxy objects are rejected/u,
  );
});

test("trusted checkpoint must have an exact non-self-asserted structural shape", () => {
  assert.throws(
    () => deriveIatB3KeyFreePublicIds({ ...CHECKPOINT, statusPorcelain: "" }),
    /expected exact keys/u,
  );
  assert.throws(
    () => deriveIatB3KeyFreePublicIds({ ...CHECKPOINT, headSha: "A".repeat(40) }),
    /lowercase 40-hex/u,
  );
});

test("the checked-in template is explicitly incomplete and nonauthorizing", () => {
  const template = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
  assert.equal(template.schema, IAT_B3_KEY_FREE_TEMPLATE_SCHEMA);
  assert.equal(template.status, "HOLD");
  assert.equal(template.purpose, IAT_B3_KEY_FREE_PURPOSE);
  assert.equal(template.identityPayload.generatedAtUtc, null);
  assert.equal(template.identityPayload.lawProgramId, null);
  assert.equal(template.inputPaths.identity, IAT_B3_KEY_FREE_IDENTITY_INPUT_PATH);
  assert.equal(
    template.inputPaths.declaredGenesis,
    IAT_B3_KEY_FREE_DECLARED_GENESIS_INPUT_PATH,
  );
  assert.equal(template.declaredGenesisPayload.network, IAT_B3_KEY_FREE_DECLARED_GENESIS.network);
  assert.equal(template.directObservationBoundary.inputFilesDirectlyObservedByThisModule, false);
  assert.equal(template.truthBoundary.signerObserved, false);
  assert.equal(template.truthBoundary.payerObserved, false);
  assert.equal(template.truthBoundary.endpointUseAuthorized, false);
  assert.equal(template.truthBoundary.deploymentAuthorized, false);
  assert.equal(template.truthBoundary.releaseAuthorized, false);
  assert.equal(template.truthBoundary.executionAuthorized, false);
  assert.equal(template.truthBoundary.publicDevnetAuthorized, false);
  assert.equal(template.truthBoundary.mainnetExecutionAuthorized, false);
  assert.equal(template.truthBoundary.mainnetStatus, "HOLD");
});

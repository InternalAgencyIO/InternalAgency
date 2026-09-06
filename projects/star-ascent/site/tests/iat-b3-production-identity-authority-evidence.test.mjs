import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EMPTY_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_BINDING,
  PRODUCTION_IDENTITY_AUTHORITY_RECEIPT_SCHEMA,
  PRODUCTION_IDENTITY_AUTHORITY_OWNER_DECISION_RECEIPT_SCHEMA,
  PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_OBSERVATION_SCHEMA,
  PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_BOUNDARY,
  PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA,
  PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS,
  PRODUCTION_IDENTITY_AUTHORITY_SCOPE,
  PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS,
  ceremonyFundingEvidenceSubjectSha256,
  createProductionIdentityAuthorityAutomatedEvidenceBinding,
  deployedSealEvidenceSubjectSha256,
  parseProductionIdentityAuthorityEvidenceJson,
  productionIdentityAuthorityModelTObservationSigningBytes,
  productionIdentityAuthorityOcmsEnvelopeBytes,
  productionIdentityAuthorityOwnerDecisionOcmsSigningMaterial,
  productionIdentityAuthorityReceiptSigningBytes,
  productionIdentityAuthoritySerializeOcmsMessage,
  productionIdentityAuthorityTerminalStateSha256,
  productionIdentityFreezeEvidenceSubjectSha256,
  validateProductionIdentityAuthorityEvidenceManifest,
} from "../scripts/validate-iat-b3-production-identity-authority-evidence.mjs";
import { EXPECTED_SEAL_ORDER } from "../scripts/validate-iat-b3-identity-freeze.mjs";

const SITE = fileURLToPath(new URL("../", import.meta.url));
const MANIFEST_PATH = join(
  SITE,
  "docs",
  "b3",
  "iat-b3-production-identity-authority-evidence.v1.json",
);
const SCHEMA_PATH = join(
  SITE,
  "docs",
  "b3",
  "iat-b3-production-identity-authority-evidence.v1.schema.json",
);
const VALIDATOR_PATH = join(
  SITE,
  "scripts",
  "validate-iat-b3-production-identity-authority-evidence.mjs",
);
const DRAFT = parseProductionIdentityAuthorityEvidenceJson(
  readFileSync(MANIFEST_PATH, "utf8"),
  MANIFEST_PATH,
);
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const VALIDATOR_SOURCE = readFileSync(VALIDATOR_PATH, "utf8");
const clone = (value) => structuredClone(value);
const digest = (label) => createHash("sha256").update(label, "utf8").digest("hex");
const FIXTURE_EVALUATION_UNIX_SECONDS = "2001000025";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes) {
  let number = BigInt(`0x${bytes.toString("hex")}`);
  let encoded = "";
  while (number > 0n) {
    encoded = BASE58_ALPHABET[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + (encoded || "1");
}

function makeEvidenceContext({ ocmsVersion = "OCMS_V0", firmwareVersion = "2.12.2" } = {}) {
  const roles = [
    ["owner.decision.prod", "OWNER_DECISION_SOURCE"],
    ["endpoint.alpha.prod", "AUTOMATED_ENDPOINT_SOURCE"],
    ["endpoint.beta.prod", "AUTOMATED_ENDPOINT_SOURCE"],
    ["automated.closure.prod", "AUTOMATED_EVIDENCE_CLOSURE"],
    ["device.observer.prod", "AUTOMATED_DEVICE_OBSERVATION_SOURCE"],
  ];
  const privateKeys = new Map();
  const sources = roles.map(([sourceId, role]) => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const der = publicKey.export({ format: "der", type: "spki" });
    privateKeys.set(sourceId, privateKey);
    const common = {
      sourceId,
      role,
      publicKeySpkiDerBase64url: der.toString("base64url"),
      publicKeySha256: createHash("sha256").update(der).digest("hex"),
      signingScheme: role === "OWNER_DECISION_SOURCE"
        ? "TREZOR_MODEL_T_SOLANA_OCMS"
        : "RAW_ED25519_SOURCE_BOUND_RECEIPT_V3",
    };
    if (role !== "OWNER_DECISION_SOURCE") return common;
    return {
      ...common,
      deviceModel: "Trezor Model T",
      derivationPath: "m/44'/501'/0'/0'",
      solanaPublicKey: encodeBase58(der.subarray(der.length - 32)),
      capabilityPredicate: "MODEL_T_SOLANA_OCMS_CAPABILITY_OBSERVED",
    };
  });
  const ownerSource = sources.find((source) => source.role === "OWNER_DECISION_SOURCE");
  const observationSource = sources.find(
    (source) => source.role === "AUTOMATED_DEVICE_OBSERVATION_SOURCE",
  );
  const unsignedObservation = {
    schema: PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_OBSERVATION_SCHEMA,
    sourceId: observationSource.sourceId,
    observedAtUnixSeconds: "2000999999",
    ownerDecisionSourceId: ownerSource.sourceId,
    deviceModel: "Trezor Model T",
    firmwareVersion,
    capabilityPredicate: "MODEL_T_SOLANA_OCMS_CAPABILITY_OBSERVED",
    ocmsVersion,
    derivationPath: ownerSource.derivationPath,
    solanaPublicKey: ownerSource.solanaPublicKey,
    observationClass: "SYNTHETIC_SOFTWARE_TEST_FIXTURE",
    observationValue: "CAPABILITY_PRESENT",
  };
  const modelTDeviceObservationReceipt = {
    ...unsignedObservation,
    signatureBase64url: sign(
      null,
      productionIdentityAuthorityModelTObservationSigningBytes(unsignedObservation),
      privateKeys.get(observationSource.sourceId),
    ).toString("base64url"),
  };
  return {
    automatedEvidenceBinding: createProductionIdentityAuthorityAutomatedEvidenceBinding(
      sources,
      modelTDeviceObservationReceipt,
    ),
    privateKeys,
    sources: new Map(sources.map((source) => [source.sourceId, source])),
    modelTDeviceObservationReceipt,
  };
}

function signedReceipt(context, fields) {
  const unsigned = {
    schema: fields.sourceId === "owner.decision.prod"
      ? PRODUCTION_IDENTITY_AUTHORITY_OWNER_DECISION_RECEIPT_SCHEMA
      : PRODUCTION_IDENTITY_AUTHORITY_RECEIPT_SCHEMA,
    kind: fields.kind,
    stage: fields.stage,
    sourceId: fields.sourceId,
    observedAtUnixSeconds: fields.observedAtUnixSeconds,
    endpointSha256: fields.endpointSha256,
    subjectSha256: fields.subjectSha256,
    observationValue: fields.observationValue,
    decision: fields.decision,
  };
  if (fields.sourceId === "owner.decision.prod") {
    const material = productionIdentityAuthorityOwnerDecisionOcmsSigningMaterial(
      unsigned,
      context.sources.get(fields.sourceId),
      context.modelTDeviceObservationReceipt,
    );
    const ocmsMessage = Buffer.from(material.ocmsMessageBase64url, "base64url");
    const signature = sign(
      null,
      ocmsMessage,
      context.privateKeys.get(fields.sourceId),
    );
    const envelope = productionIdentityAuthorityOcmsEnvelopeBytes(ocmsMessage, [signature]);
    return {
      ...unsigned,
      ...material,
      ocmsEnvelopeBase64url: envelope.toString("base64url"),
      ocmsEnvelopeSha256: createHash("sha256").update(envelope).digest("hex"),
      signatureBase64url: signature.toString("base64url"),
    };
  }
  return {
    ...unsigned,
    signatureBase64url: sign(
      null,
      productionIdentityAuthorityReceiptSigningBytes(unsigned),
      context.privateKeys.get(fields.sourceId),
    ).toString("base64url"),
  };
}

function resignReceipt(context, receipt, overrides = {}) {
  const unsigned = { ...receipt };
  delete unsigned.signatureBase64url;
  return signedReceipt(context, { ...unsigned, ...overrides });
}

function rebindPhaseBReceipts(fixture) {
  const phase = fixture.manifest.phaseBCeremonyFunding;
  phase.subjectSha256 = ceremonyFundingEvidenceSubjectSha256(fixture.manifest);
  phase.fundingDecisionReceipt = resignReceipt(fixture.context, phase.fundingDecisionReceipt, {
    subjectSha256: phase.subjectSha256,
  });
  phase.payerBalanceEndpointReceipts = phase.payerBalanceEndpointReceipts.map((entry) => (
    resignReceipt(fixture.context, entry, { subjectSha256: phase.subjectSha256 })
  ));
  phase.automatedClosureReceipt = resignReceipt(fixture.context, phase.automatedClosureReceipt, {
    subjectSha256: phase.subjectSha256,
    observationValue: phase.subjectSha256,
  });
}

function completeFixture(evidenceOptions = {}) {
  const context = makeEvidenceContext(evidenceOptions);
  const manifest = clone(DRAFT);
  manifest.profile = "TEST_FIXTURE";
  manifest.status = "EVIDENCE_COMPLETE";
  Object.assign(manifest.productionChoices, {
    lawProgramId: "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF",
    economyProgramId: "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij",
    canonicalMint: "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd",
    mainnetGenesisHash: "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
    ceremonySignerPublicKey: "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF",
    lawUpgradeAuthorityPublicKey: "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij",
    economyUpgradeAuthorityPublicKey: "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd",
    payerPublicKey: "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
  });

  const phaseA = manifest.phaseAProductionIdentityFreeze;
  phaseA.status = "EVIDENCE_COMPLETE";
  phaseA.ownerDecisionPreimageSha256 = digest("owner-identity-decision-preimage");
  phaseA.blocker = null;
  phaseA.subjectSha256 = productionIdentityFreezeEvidenceSubjectSha256(manifest);
  phaseA.ownerDecisionReceipt = signedReceipt(context, {
    kind: "OWNER_IDENTITY_DECISION_RECEIPT",
    stage: "A",
    sourceId: "owner.decision.prod",
    observedAtUnixSeconds: "2001000000",
    endpointSha256: null,
    subjectSha256: phaseA.subjectSha256,
    observationValue: phaseA.ownerDecisionPreimageSha256,
    decision: "ACCEPT",
  });
  phaseA.mainnetGenesisEndpointReceipts = [
    ["endpoint.alpha.prod", digest("rpc-mainnet-alpha"), "2001000001"],
    ["endpoint.beta.prod", digest("rpc-mainnet-beta"), "2001000002"],
  ].map(([sourceId, endpointSha256, observedAtUnixSeconds]) => signedReceipt(context, {
    kind: "MAINNET_GENESIS_ENDPOINT_RECEIPT",
    stage: "A",
    sourceId,
    observedAtUnixSeconds,
    endpointSha256,
    subjectSha256: phaseA.subjectSha256,
    observationValue: manifest.productionChoices.mainnetGenesisHash,
    decision: "MATCHED",
  }));
  phaseA.automatedClosureReceipt = signedReceipt(context, {
    kind: "AUTOMATED_IDENTITY_CLOSURE_RECEIPT",
    stage: "A",
    sourceId: "automated.closure.prod",
    observedAtUnixSeconds: "2001000003",
    endpointSha256: null,
    subjectSha256: phaseA.subjectSha256,
    observationValue: phaseA.subjectSha256,
    decision: "ACCEPT",
  });

  const phaseB = manifest.phaseBCeremonyFunding;
  phaseB.status = "EVIDENCE_COMPLETE";
  phaseB.finalBinaries.law = {
    programId: manifest.productionChoices.lawProgramId,
    sha256: digest("final-law-binary"),
    byteLength: 180000,
    sourceHeadSha256: digest("final-source-head"),
  };
  phaseB.finalBinaries.economy = {
    programId: manifest.productionChoices.economyProgramId,
    sha256: digest("final-economy-binary"),
    byteLength: 210000,
    sourceHeadSha256: digest("final-source-head"),
  };
  phaseB.freshCostMeasurementSha256 = digest("fresh-cost-measurement");
  phaseB.fundingSourceApprovalSha256 = digest("funding-source-approval");
  phaseB.ceremonyFloorPolicySha256 = digest("ceremony-floor-policy");
  phaseB.bufferRecoveryPlanSha256 = digest("buffer-recovery-plan");
  phaseB.ceremonyFloorLamports = "2100000000";
  phaseB.aggregateFreshPayerPeakLamports = "2000000000";
  phaseB.aggregatePermanentRentLamports = "1000000000";
  phaseB.aggregateRecoverableBufferLamports = "900000000";
  phaseB.aggregateFeeBudgetLamports = "10000000";
  phaseB.expiresAtUnixSeconds = "2001000100";
  phaseB.blocker = null;
  phaseB.subjectSha256 = ceremonyFundingEvidenceSubjectSha256(manifest);
  phaseB.fundingDecisionReceipt = signedReceipt(context, {
    kind: "OWNER_FUNDING_DECISION_RECEIPT",
    stage: "B",
    sourceId: "owner.decision.prod",
    observedAtUnixSeconds: "2001000010",
    endpointSha256: null,
    subjectSha256: phaseB.subjectSha256,
    observationValue: phaseB.fundingSourceApprovalSha256,
    decision: "ACCEPT",
  });
  phaseB.payerBalanceEndpointReceipts = [
    ["endpoint.alpha.prod", digest("rpc-payer-alpha"), "2200000000", "2001000011"],
    ["endpoint.beta.prod", digest("rpc-payer-beta"), "2300000000", "2001000012"],
  ].map(([sourceId, endpointSha256, observationValue, observedAtUnixSeconds]) => signedReceipt(context, {
    kind: "PAYER_BALANCE_ENDPOINT_RECEIPT",
    stage: "B",
    sourceId,
    observedAtUnixSeconds,
    endpointSha256,
    subjectSha256: phaseB.subjectSha256,
    observationValue,
    decision: "MATCHED",
  }));
  phaseB.automatedClosureReceipt = signedReceipt(context, {
    kind: "AUTOMATED_FUNDING_CLOSURE_RECEIPT",
    stage: "B",
    sourceId: "automated.closure.prod",
    observedAtUnixSeconds: "2001000013",
    endpointSha256: null,
    subjectSha256: phaseB.subjectSha256,
    observationValue: phaseB.subjectSha256,
    decision: "ACCEPT",
  });

  const phaseC = manifest.phaseCDeployedSeal;
  phaseC.status = "EVIDENCE_COMPLETE";
  phaseC.blocker = null;
  phaseC.journal = EXPECTED_SEAL_ORDER.map((step, index) => ({
    ordinal: index + 1,
    step,
    status: "FINALIZED_MATCHED",
    evidenceSha256: digest(`ceremony-journal-${index + 1}-${step}`),
  }));
  phaseC.terminalState = {
    lawProgramId: manifest.productionChoices.lawProgramId,
    economyProgramId: manifest.productionChoices.economyProgramId,
    canonicalMint: manifest.productionChoices.canonicalMint,
    lawBinarySha256: phaseB.finalBinaries.law.sha256,
    economyBinarySha256: phaseB.finalBinaries.economy.sha256,
    lawUpgradeAuthority: null,
    economyUpgradeAuthority: null,
    mintAuthority: null,
    freezeAuthority: null,
    transferHookAuthority: null,
    confidentialTransferMintAuthority: null,
    active: true,
    genesisStagingWritesDisabled: true,
    stateSha256: null,
  };
  phaseC.terminalState.stateSha256 = productionIdentityAuthorityTerminalStateSha256(
    phaseC.terminalState,
  );
  phaseC.subjectSha256 = deployedSealEvidenceSubjectSha256(manifest);
  phaseC.terminalEndpointReceipts = [
    ["endpoint.alpha.prod", digest("rpc-terminal-alpha"), "2001000020"],
    ["endpoint.beta.prod", digest("rpc-terminal-beta"), "2001000021"],
  ].map(([sourceId, endpointSha256, observedAtUnixSeconds]) => signedReceipt(context, {
    kind: "TERMINAL_AUTHORITY_STATE_ENDPOINT_RECEIPT",
    stage: "C",
    sourceId,
    observedAtUnixSeconds,
    endpointSha256,
    subjectSha256: phaseC.subjectSha256,
    observationValue: phaseC.terminalState.stateSha256,
    decision: "MATCHED",
  }));
  phaseC.automatedClosureReceipt = signedReceipt(context, {
    kind: "AUTOMATED_DEPLOYED_SEAL_CLOSURE_RECEIPT",
    stage: "C",
    sourceId: "automated.closure.prod",
    observedAtUnixSeconds: "2001000022",
    endpointSha256: null,
    subjectSha256: phaseC.subjectSha256,
    observationValue: phaseC.subjectSha256,
    decision: "ACCEPT",
  });
  return { context, manifest };
}

function fixtureResult(fixture) {
  return validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    allowTestFixture: true,
    automatedEvidenceBinding: fixture.context.automatedEvidenceBinding,
    evaluationUnixSeconds: FIXTURE_EVALUATION_UNIX_SECONDS,
  });
}

function expectFixtureViolation(mutator, pattern) {
  const fixture = completeFixture();
  mutator(fixture);
  const result = fixtureResult(fixture);
  assert.equal(result.valid, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.match(result.violations.join("\n"), pattern);
}

test("canonical production packet is structurally valid, owner-null, staged PENDING, and HOLD", () => {
  const result = validateProductionIdentityAuthorityEvidenceManifest(DRAFT);
  assert.equal(DRAFT.schema, PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA);
  assert.equal(DRAFT.profile, "PRODUCTION");
  assert.equal(DRAFT.status, "PENDING");
  assert.deepEqual(DRAFT.scope, PRODUCTION_IDENTITY_AUTHORITY_SCOPE);
  assert.deepEqual(DRAFT.sourceBindings, PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS);
  assert.deepEqual(
    DRAFT.modelTCapabilityBoundary,
    PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_BOUNDARY,
  );
  assert.deepEqual(EMPTY_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_BINDING.sources, []);
  assert.equal(
    EMPTY_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_BINDING.modelTDeviceObservationReceipt,
    null,
  );
  assert.equal(Object.values(DRAFT.productionChoices).every((value) => value === null), true);
  assert.equal(result.valid, true);
  assert.equal(result.automatedEvidenceSourcesConfigured, false);
  assert.equal(result.phaseAProductionIdentityFreezeComplete, false);
  assert.equal(result.phaseBCeremonyFundingComplete, false);
  assert.equal(result.phaseCDeployedIdentityAuthoritySealComplete, false);
  assert.equal(result.modelTCapabilityObserved, false);
  assert.equal(result.blockers.length, 5);
  assert.deepEqual(result.violations, []);
  for (const key of [
    "signingAuthorized",
    "deploymentAuthorized",
    "fundingSpendAuthorized",
    "activationAuthorized",
    "automatedGate8EvidenceComplete",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
  ]) assert.equal(result[key], false);
  assert.equal(result.mainnetStatus, PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS);
});

test("schema pins the three stages, source inputs, exact 17-step order, and immutable authorization boundary", () => {
  assert.deepEqual(SCHEMA.properties.scope.const, PRODUCTION_IDENTITY_AUTHORITY_SCOPE);
  assert.deepEqual(SCHEMA.properties.sourceBindings.const, PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS);
  assert.deepEqual(
    SCHEMA.properties.modelTCapabilityBoundary.const,
    PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_BOUNDARY,
  );
  assert.equal(
    SCHEMA.properties.phaseCDeployedSeal.properties.journal.prefixItems.length,
    EXPECTED_SEAL_ORDER.length,
  );
  assert.equal(
    SCHEMA.properties.phaseBCeremonyFunding.required.includes("expiresAtUnixSeconds"),
    true,
  );
  const schemaSteps = SCHEMA.properties.phaseCDeployedSeal.properties.journal.prefixItems.map(
    (entry) => SCHEMA.$defs[entry.$ref.split("/").at(-1)].allOf[1].properties.step.const,
  );
  assert.deepEqual(schemaSteps, EXPECTED_SEAL_ORDER);
  assert.equal(SCHEMA.properties.authorizationBoundary.const.automatedGate8EvidenceComplete, false);
  assert.equal(SCHEMA.properties.authorizationBoundary.const.mainnetExecutionAuthorized, false);
  assert.equal(SCHEMA.properties.authorizationBoundary.const.mainnetStatus, "HOLD");
});

test("fully signed fixture proves staged mechanics without ever satisfying a production predicate", () => {
  const fixture = completeFixture();
  const result = fixtureResult(fixture);
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.automatedEvidenceSourcesConfigured, true);
  assert.equal(result.phaseAProductionIdentityFreezeComplete, true);
  assert.equal(result.phaseBCeremonyFundingComplete, true);
  assert.equal(result.phaseCDeployedIdentityAuthoritySealComplete, true);
  assert.equal(result.productionIdentityFreezeEvidenceComplete, false);
  assert.equal(result.ceremonyFundingEvidenceComplete, false);
  assert.equal(result.deployedIdentityAuthoritySealEvidenceComplete, false);
  assert.equal(result.modelTCapabilityObserved, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("owner decisions use exact Solana OCMS v0 or v1 bytes while a separate source observes Model T capability", () => {
  for (const [ocmsVersion, firmwareVersion] of [
    ["OCMS_V0", "2.12.2"],
    ["OCMS_V1", "2.12.4"],
  ]) {
    const fixture = completeFixture({ ocmsVersion, firmwareVersion });
    const result = fixtureResult(fixture);
    assert.equal(result.valid, true, result.violations.join("\n"));
    const receipt = fixture.manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt;
    const message = Buffer.from(receipt.ocmsMessageBase64url, "base64url");
    const envelope = Buffer.from(receipt.ocmsEnvelopeBase64url, "base64url");
    assert.equal(message[0], 0xff);
    assert.equal(message.subarray(1, 16).toString("ascii"), "solana offchain");
    assert.equal(message[16], ocmsVersion === "OCMS_V0" ? 0 : 1);
    assert.equal(envelope[0], 1);
    assert.deepEqual(envelope.subarray(65), message);
    if (ocmsVersion === "OCMS_V0") {
      assert.equal(receipt.ocmsApplicationDomainBase64url.length, 43);
      assert.equal(message[49], 1);
      assert.equal(message[50], 1);
      assert.equal(message.readUInt16LE(83), Buffer.from(receipt.decisionPayloadBase64url, "base64url").length);
    } else {
      assert.equal(receipt.ocmsApplicationDomainBase64url, null);
      assert.equal(message[17], 1);
    }
  }
});

test("OCMS v0 UTF8_SHORT enforces the exact Model T 1147-byte payload boundary", () => {
  const context = makeEvidenceContext();
  const signer = context.sources.get("owner.decision.prod");
  const signerBytes = Buffer.from(signer.publicKeySpkiDerBase64url, "base64url").subarray(-32);
  assert.doesNotThrow(() => productionIdentityAuthoritySerializeOcmsMessage(
    "OCMS_V0",
    signerBytes,
    Buffer.alloc(1_147, 0x61),
  ));
  assert.throws(
    () => productionIdentityAuthoritySerializeOcmsMessage(
      "OCMS_V0",
      signerBytes,
      Buffer.alloc(1_148, 0x61),
    ),
    /1147 bytes.*1232/iu,
  );
  assert.doesNotThrow(() => productionIdentityAuthoritySerializeOcmsMessage(
    "OCMS_V1",
    signerBytes,
    Buffer.alloc(1_148, 0x61),
  ));
});

test("owner OCMS gate rejects raw-signature substitution, signer/path/domain/message drift, and software-only capability claims", () => {
  for (const [mutate, pattern] of [
    [({ manifest }) => {
      manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt.signatureScheme =
        "RAW_ED25519_SOURCE_BOUND_RECEIPT_V3";
    }, /OCMS signing material mismatch/iu],
    [({ manifest }) => {
      manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt.signerDerivationPath =
        "m/44'/501'/1'/0'";
    }, /OCMS signing material mismatch/iu],
    [({ manifest }) => {
      manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt.ocmsApplicationDomainBase64url =
        "A".repeat(43);
    }, /OCMS signing material mismatch/iu],
    [({ manifest }) => {
      const receipt = manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt;
      receipt.ocmsMessageBase64url = `${receipt.ocmsMessageBase64url.slice(0, -1)}A`;
    }, /OCMS signing material mismatch|serialized OCMS|signature is invalid/iu],
    [({ manifest, context }) => {
      const ownerReceipt = manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt;
      manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt = {
        schema: PRODUCTION_IDENTITY_AUTHORITY_RECEIPT_SCHEMA,
        kind: ownerReceipt.kind,
        stage: ownerReceipt.stage,
        sourceId: ownerReceipt.sourceId,
        observedAtUnixSeconds: ownerReceipt.observedAtUnixSeconds,
        endpointSha256: null,
        subjectSha256: ownerReceipt.subjectSha256,
        observationValue: ownerReceipt.observationValue,
        decision: ownerReceipt.decision,
        signatureBase64url: sign(
          null,
          Buffer.from("generic-software-owner-signature", "utf8"),
          context.privateKeys.get(ownerReceipt.sourceId),
        ).toString("base64url"),
      };
    }, /expected exact keys/iu],
  ]) expectFixtureViolation(mutate, pattern);

  assert.throws(
    () => productionIdentityAuthorityReceiptSigningBytes({
      schema: PRODUCTION_IDENTITY_AUTHORITY_RECEIPT_SCHEMA,
      kind: "OWNER_IDENTITY_DECISION_RECEIPT",
      stage: "A",
      sourceId: "owner.decision.prod",
      observedAtUnixSeconds: "2001000000",
      endpointSha256: null,
      subjectSha256: digest("subject"),
      observationValue: digest("value"),
      decision: "ACCEPT",
    }),
    /raw Ed25519 is forbidden/iu,
  );
});

test("firmware-to-OCMS mapping and observation provenance fail closed", () => {
  for (const evidenceOptions of [
    { ocmsVersion: "OCMS_V0", firmwareVersion: "2.12.4" },
    { ocmsVersion: "OCMS_V1", firmwareVersion: "2.12.2" },
  ]) {
    const fixture = completeFixture(evidenceOptions);
    const result = fixtureResult(fixture);
    assert.equal(result.valid, false);
    assert.match(result.violations.join("\n"), /firmware and OCMS version are incompatible/iu);
  }
  const fixture = completeFixture();
  fixture.context.automatedEvidenceBinding.modelTDeviceObservationReceipt.observationClass =
    "PRODUCTION_SOURCE_BOUND_DEVICE_OBSERVATION";
  const result = fixtureResult(fixture);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /TEST_FIXTURE requires SYNTHETIC_SOFTWARE_TEST_FIXTURE/iu);
});

test("fixture use requires explicit authority and production relabel cannot bypass source-bound identity readiness", () => {
  const fixture = completeFixture();
  const denied = validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    automatedEvidenceBinding: fixture.context.automatedEvidenceBinding,
  });
  assert.equal(denied.valid, false);
  assert.match(denied.violations.join("\n"), /TEST_FIXTURE requires explicit/iu);

  fixture.manifest.profile = "PRODUCTION";
  const relabeled = validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    automatedEvidenceBinding: fixture.context.automatedEvidenceBinding,
  });
  assert.equal(relabeled.valid, false);
  assert.equal(relabeled.productionIdentityFreezeEvidenceComplete, false);
  assert.match(
    [...relabeled.blockers, ...relabeled.violations].join("\n"),
    /identity-input bytes|phase A must complete first|EVIDENCE_COMPLETE requires/iu,
  );
});

test("packet cannot select automated evidence sources and completion requires exact external role cardinality", () => {
  expectFixtureViolation(({ manifest }) => {
    manifest.automatedEvidenceBinding = clone(EMPTY_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_BINDING);
  }, /expected exact keys/iu);

  const fixture = completeFixture();
  const noEvidenceSources = validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    allowTestFixture: true,
  });
  assert.equal(noEvidenceSources.valid, false);
  assert.match(noEvidenceSources.violations.join("\n"), /source is absent from the configured/iu);

  for (const mutate of [
    (binding) => binding.sources.pop(),
    (binding) => { binding.packetMaySelectEvidenceSources = true; },
    (binding) => { binding.sourceSetSha256 = digest("substituted-root"); },
    (binding) => { binding.sources[0].role = "OWNER_DECISION_SOURCE"; },
    (binding) => { binding.sources[1].sourceId = binding.sources[0].sourceId; },
    (binding) => { binding.sources[1].publicKeySpkiDerBase64url = binding.sources[0].publicKeySpkiDerBase64url; },
    (binding) => { binding.sources[1].publicKeySha256 = binding.sources[0].publicKeySha256; },
  ]) {
    const hostile = completeFixture();
    mutate(hostile.context.automatedEvidenceBinding);
    assert.equal(fixtureResult(hostile).valid, false);
  }
});

test("every receipt class is cryptographically bound to kind, stage, subject, value, decision, key, and endpoint", () => {
  const paths = [
    ["phaseAProductionIdentityFreeze", "ownerDecisionReceipt"],
    ["phaseAProductionIdentityFreeze", "mainnetGenesisEndpointReceipts", 0],
    ["phaseAProductionIdentityFreeze", "automatedClosureReceipt"],
    ["phaseBCeremonyFunding", "fundingDecisionReceipt"],
    ["phaseBCeremonyFunding", "payerBalanceEndpointReceipts", 0],
    ["phaseBCeremonyFunding", "automatedClosureReceipt"],
    ["phaseCDeployedSeal", "terminalEndpointReceipts", 0],
    ["phaseCDeployedSeal", "automatedClosureReceipt"],
  ];
  for (const path of paths) {
    for (const field of ["kind", "stage", "subjectSha256", "observationValue", "decision", "sourceId", "observedAtUnixSeconds"]) {
      expectFixtureViolation(({ manifest }) => {
        let target = manifest;
        for (const key of path) target = target[key];
        target[field] = field === "observedAtUnixSeconds" ? "0" : `tampered-${field}`;
      }, /expected|does not match|invalid|absent|out of range/iu);
    }
  }
});

test("two-endpoint requirements reject same key, same endpoint, wrong value, missing, extra, or unsigned observations", () => {
  const locations = [
    ["phaseAProductionIdentityFreeze", "mainnetGenesisEndpointReceipts"],
    ["phaseBCeremonyFunding", "payerBalanceEndpointReceipts"],
    ["phaseCDeployedSeal", "terminalEndpointReceipts"],
  ];
  for (const path of locations) {
    expectFixtureViolation(({ manifest }) => {
      const list = manifest[path[0]][path[1]];
      list[1].sourceId = list[0].sourceId;
    }, /endpoint source|automated sources|signature is invalid/iu);
    expectFixtureViolation(({ manifest }) => {
      const list = manifest[path[0]][path[1]];
      list[1].endpointSha256 = list[0].endpointSha256;
    }, /endpoint/iu);
    expectFixtureViolation(({ manifest }) => {
      manifest[path[0]][path[1]].pop();
    }, /exactly two|expected exactly two/iu);
    expectFixtureViolation(({ manifest }) => {
      manifest[path[0]][path[1]][0].signatureBase64url = "A".repeat(86);
    }, /signature is invalid/iu);
  }
});

test("phase A fails closed on identity drift, V2/7XZ reuse, source substitutions, and unsigned owner policy", () => {
  for (const value of [
    "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj",
    "7XZpNks16qmWruJxKzmB3JSsZUdtAJYCNSPEZ3GxdoZ8",
    "11111111111111111111111111111111",
  ]) expectFixtureViolation(({ manifest }) => {
    manifest.productionChoices.lawProgramId = value;
  }, /forbidden|subject commitment/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.productionChoices.canonicalMint = manifest.productionChoices.economyProgramId;
  }, /pairwise distinct|subject commitment/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.sourceBindings.identityInputFreeze.sha256 = digest("alternate-identity-input");
  }, /sourceBindings|subject commitment/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256 = digest("changed-owner-preimage");
  }, /subject commitment|does not match|signature is invalid/iu);
});

test("phase B binds two exact final binaries and fresh cost, funding, floor, buffer, recovery, and payer evidence", () => {
  const cases = [
    [(manifest) => { manifest.phaseBCeremonyFunding.finalBinaries.law.programId = manifest.productionChoices.economyProgramId; }, /program identity mismatch|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.finalBinaries.law.sha256 = digest("different-binary"); }, /subject commitment|signature is invalid/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.freshCostMeasurementSha256 = null; }, /SHA-256|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.aggregateFreshPayerPeakLamports = "3000000001"; }, /exceeds frozen 3 SOL|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.aggregatePermanentRentLamports = "1900000000"; }, /permanent rent plus recoverable buffer|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.ceremonyFloorLamports = "2000000000"; }, /does not cover exact peak plus fee|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.payerBalanceEndpointReceipts[0].observationValue = "1"; }, /below ceremony floor|signature is invalid/iu],
    [(manifest) => { manifest.sourceBindings.costFeasibilityReference.bindingScope = "COMPLETION_EVIDENCE"; }, /reference-only COST|sourceBindings/iu],
  ];
  for (const [mutate, pattern] of cases) {
    expectFixtureViolation(({ manifest }) => mutate(manifest), pattern);
  }
});

test("completed evidence requires external evaluation time and rejects stale, future, skewed, or expired live observations", () => {
  const noEvaluation = completeFixture();
  const noEvaluationResult = validateProductionIdentityAuthorityEvidenceManifest(
    noEvaluation.manifest,
    {
      allowTestFixture: true,
      automatedEvidenceBinding: noEvaluation.context.automatedEvidenceBinding,
    },
  );
  assert.equal(noEvaluationResult.valid, false);
  assert.match(noEvaluationResult.violations.join("\n"), /externally supplied evaluation time/iu);

  expectFixtureViolation((fixture) => {
    const phase = fixture.manifest.phaseBCeremonyFunding;
    phase.payerBalanceEndpointReceipts[0] = resignReceipt(
      fixture.context,
      phase.payerBalanceEndpointReceipts[0],
      { observedAtUnixSeconds: "2000999000" },
    );
  }, /live endpoint evidence is stale|bounded pair skew|evidence-review interval/iu);

  expectFixtureViolation((fixture) => {
    const phase = fixture.manifest.phaseBCeremonyFunding;
    phase.payerBalanceEndpointReceipts[1] = resignReceipt(
      fixture.context,
      phase.payerBalanceEndpointReceipts[1],
      { observedAtUnixSeconds: "2001000101" },
    );
  }, /future relative to externally supplied evaluation time|predates required signed evidence/iu);

  expectFixtureViolation((fixture) => {
    const phase = fixture.manifest.phaseBCeremonyFunding;
    phase.payerBalanceEndpointReceipts[1] = resignReceipt(
      fixture.context,
      phase.payerBalanceEndpointReceipts[1],
      { observedAtUnixSeconds: "2000999800" },
    );
  }, /bounded pair skew|live endpoint evidence is stale/iu);

  expectFixtureViolation((fixture) => {
    fixture.manifest.phaseBCeremonyFunding.expiresAtUnixSeconds = "2001000024";
    rebindPhaseBReceipts(fixture);
  }, /funding evidence has expired/iu);

  expectFixtureViolation((fixture) => {
    fixture.manifest.phaseBCeremonyFunding.expiresAtUnixSeconds = "2001002000";
    rebindPhaseBReceipts(fixture);
  }, /bounded post-observation funding evidence lifetime/iu);
});

test("phase order is strict: B cannot complete before A and C cannot complete before B", () => {
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseAProductionIdentityFreeze.status = "PENDING";
    manifest.phaseAProductionIdentityFreeze.subjectSha256 = null;
    manifest.phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256 = null;
    manifest.phaseAProductionIdentityFreeze.ownerDecisionReceipt = null;
    manifest.phaseAProductionIdentityFreeze.mainnetGenesisEndpointReceipts = [];
    manifest.phaseAProductionIdentityFreeze.automatedClosureReceipt = null;
    manifest.phaseAProductionIdentityFreeze.blocker = "The exact phase A identity evidence remains deliberately pending.";
  }, /phase A must complete first|owner-null|EVIDENCE_COMPLETE requires/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseBCeremonyFunding.status = "PENDING";
    manifest.phaseBCeremonyFunding.subjectSha256 = null;
    manifest.phaseBCeremonyFunding.finalBinaries.law = Object.fromEntries(
      Object.keys(manifest.phaseBCeremonyFunding.finalBinaries.law).map((key) => [key, null]),
    );
    manifest.phaseBCeremonyFunding.finalBinaries.economy = clone(manifest.phaseBCeremonyFunding.finalBinaries.law);
    for (const key of [
      "freshCostMeasurementSha256", "fundingSourceApprovalSha256", "ceremonyFloorPolicySha256",
      "bufferRecoveryPlanSha256", "ceremonyFloorLamports", "aggregateFreshPayerPeakLamports",
      "aggregatePermanentRentLamports", "aggregateRecoverableBufferLamports", "aggregateFeeBudgetLamports",
      "fundingDecisionReceipt", "automatedClosureReceipt",
    ]) manifest.phaseBCeremonyFunding[key] = null;
    manifest.phaseBCeremonyFunding.payerBalanceEndpointReceipts = [];
    manifest.phaseBCeremonyFunding.blocker = "The exact phase B cost and funding evidence remains deliberately pending.";
  }, /phase B must complete first|EVIDENCE_COMPLETE requires/iu);
});

test("phase C requires every exact ordered stage, distinct evidence, terminal null authorities, and active/staging truth", () => {
  expectFixtureViolation(({ manifest }) => {
    [manifest.phaseCDeployedSeal.journal[0], manifest.phaseCDeployedSeal.journal[1]] =
      [manifest.phaseCDeployedSeal.journal[1], manifest.phaseCDeployedSeal.journal[0]];
  }, /exact ordered ceremony stage|subject mismatch/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.journal[8].status = "PENDING";
  }, /FINALIZED_MATCHED|subject mismatch/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.journal[8].evidenceSha256 = null;
  }, /SHA-256|subject mismatch/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.journal[8].evidenceSha256 =
      manifest.phaseCDeployedSeal.journal[7].evidenceSha256;
  }, /distinct evidence|subject mismatch/iu);
  for (const key of [
    "lawUpgradeAuthority",
    "economyUpgradeAuthority",
    "mintAuthority",
    "freezeAuthority",
    "transferHookAuthority",
    "confidentialTransferMintAuthority",
  ]) expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.terminalState[key] = manifest.productionChoices.ceremonySignerPublicKey;
  }, /terminal identity\/authority state mismatch|terminal state commitment/iu);
  for (const key of ["active", "genesisStagingWritesDisabled"]) expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.terminalState[key] = false;
  }, /terminal identity\/authority state mismatch|terminal state commitment/iu);
});

test("authorization, Gate 8, release, and Mainnet flags are immutable even after all three evidence stages", () => {
  for (const key of [
    "signingAuthorized",
    "deploymentAuthorized",
    "fundingSpendAuthorized",
    "activationAuthorized",
    "automatedGate8EvidenceComplete",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
  ]) expectFixtureViolation(({ manifest }) => {
    manifest.authorizationBoundary[key] = true;
  }, /authorizationBoundary/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.authorizationBoundary.mainnetStatus = "GO";
  }, /authorizationBoundary/iu);
});

test("strict input rejects duplicate JSON sources, accessors, symbols, sparse arrays, cycles, and extra packet evidence-source material", () => {
  assert.throws(
    () => parseProductionIdentityAuthorityEvidenceJson('{"alpha":1,"\\u0061lpha":2}'),
    /duplicate JSON member/iu,
  );
  const cases = [];
  const symbol = clone(DRAFT);
  symbol[Symbol("extra")] = true;
  cases.push(symbol);
  const sparse = clone(DRAFT);
  sparse.phaseCDeployedSeal.journal.length = 18;
  delete sparse.phaseCDeployedSeal.journal[17];
  cases.push(sparse);
  const cycle = clone(DRAFT);
  cycle.scope.loop = cycle;
  cases.push(cycle);
  const extra = clone(DRAFT);
  extra.evidenceSources = [];
  cases.push(extra);
  for (const malformed of cases) {
    const result = validateProductionIdentityAuthorityEvidenceManifest(malformed);
    assert.equal(result.valid, false);
    assert.notEqual(result.violations.length, 0);
  }
  const accessor = clone(DRAFT);
  let reads = 0;
  Object.defineProperty(accessor, "profile", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("PROFILE_GETTER_EXECUTED");
    },
  });
  const result = validateProductionIdentityAuthorityEvidenceManifest(accessor);
  assert.equal(reads, 0);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /data property/iu);
});

test("validator remains pure, host-only, network-free, nonexecuting, and nonauthorizing", () => {
  assert.doesNotMatch(VALIDATOR_SOURCE, /fetch\(|https\.request|http\.request|@solana|web3/iu);
  assert.doesNotMatch(VALIDATOR_SOURCE, /execFile|spawn|writeFile|appendFile|git\s+(?:add|commit|push)/iu);
  assert.doesNotMatch(VALIDATOR_SOURCE, /privateKey|secretKey|keypair/iu);
  assert.match(VALIDATOR_SOURCE, /canonicalizeRfc8785/iu);
  assert.match(VALIDATOR_SOURCE, /verifySignature/iu);
  assert.match(VALIDATOR_SOURCE, /mainnetExecutionAuthorized:\s*false/iu);
  assert.match(VALIDATOR_SOURCE, /automatedGate8EvidenceComplete:\s*false/iu);
});

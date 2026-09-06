import { createHash, randomBytes } from "node:crypto";

import {
  PROVIDER_KINDS,
  validateProviderEnvelopeVerificationReceipt,
  validateProviderSignedEnvelope,
  verifyProviderSignedEnvelope,
} from "../../programs/iat_b3_reference/provider-authenticated-envelope.mjs";
import { canonicalizeRfc8785 } from "../iat-v2-canonical-json.mjs";
import { parseB3OwnerPolicyFreezeJson } from "../validate-iat-b3-owner-policy-freeze.mjs";
import {
  loadProductionIdentityIntegrationTrust,
  validateProductionIdentityIntegrationTrust,
} from "./iat-v2-production-identity-integration-evidence.mjs";

export const PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_BINDING_SCHEMA =
  "iat-v2-production-identity-external-observer-binding/v1";
export const PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_REQUEST_SCHEMA =
  "iat-v2-production-identity-external-observer-request/v1";
export const PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_RESPONSE_SCHEMA =
  "iat-v2-production-identity-external-observer-response/v1";
export const PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_CAPABILITY_SCHEMA =
  "iat-v2-production-identity-external-observer-capability/v1";
export const PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_CLEARANCE_BLOCKER =
  "LIVE_PROVIDER_ACQUISITION_AND_OPERATIONAL_TRUTH_REQUIRED";

const HOLD_SCHEMA = "iat-v2-production-identity-external-observer-hold/v1";
const CONSUMPTION_SCHEMA =
  "iat-v2-production-identity-external-observer-consumption/v1";
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT = /^[0-9a-f]{40}$/u;
const U64_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
const U64_MAX = (1n << 64n) - 1n;
const MAX_RESPONSE_FRESHNESS_SECONDS = 120n;
const MAX_OBSERVER_SKEW_SECONDS = 30n;
const MAX_EVALUATION_WINDOW_SECONDS = 300n;
const MAX_JSON_BYTES = 16_384;

const ROLE_CONFIG = Object.freeze({
  X_PROVIDER_OBSERVER: Object.freeze({
    providerKind: PROVIDER_KINDS.X_SOCIAL_EVIDENCE,
    operation: "X_IDENTITY_TIER_OBSERVATION",
    host: "api.x.com",
  }),
  CLOUDFLARE_D1_OBSERVER: Object.freeze({
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    operation: "CHECKPOINT_COMPARE_AND_SWAP",
    host: "api.cloudflare.com",
  }),
});
const ROLE_ORDER = Object.freeze([
  "X_PROVIDER_OBSERVER",
  "CLOUDFLARE_D1_OBSERVER",
]);
const BINDING_KEYS = Object.freeze([
  "schema",
  "sourceCommit",
  "sourceTree",
  "programArtifactSha256",
  "predicateEvidenceSha256",
  "trustSourceSetSha256",
  "evaluationNotBeforeUnixSeconds",
  "evaluationNotAfterUnixSeconds",
]);
const REQUEST_KEYS = Object.freeze([
  "schema",
  "environment",
  "role",
  "sourceId",
  "failureDomainId",
  "providerKind",
  "operation",
  "host",
  "receiptDomainId",
  "receiptDomainSha256",
  "subjectBindingSha256",
  "trustSourceSetSha256",
  "capabilityBindingSha256",
  "challengeNonceBase64url",
  "challengeNonceSha256",
]);
const RESPONSE_KEYS = Object.freeze([
  "schema",
  "environment",
  "role",
  "sourceId",
  "failureDomainId",
  "providerKind",
  "operation",
  "host",
  "receiptDomainId",
  "receiptDomainSha256",
  "subjectBindingSha256",
  "trustSourceSetSha256",
  "capabilityBindingSha256",
  "challengeNonceSha256",
  "requestSha256",
  "observationSha256",
  "observedAtUnixSeconds",
  "expiresAtUnixSeconds",
]);
const OBSERVATION_KEYS = Object.freeze([
  "sourceId",
  "stateBefore",
  "envelope",
  "requestBytes",
  "responseBytes",
]);

const CHALLENGES = new WeakMap();
const CAPABILITIES = new WeakMap();
const CONSUMED_ENVELOPES = new Set();

// This module authenticates configured-key transcript signatures only. It does not
// acquire live provider responses or establish the operational truths below.
const NON_CLEARING_TRUTH = Object.freeze({
  authenticated: false,
  clearanceValid: false,
  providerAuthenticationVerified: false,
  productionKeyOwnershipVerified: false,
  providerIdentityVerified: false,
  keyRegistryAuthenticityVerified: false,
  responseSemanticsVerified: false,
  durableReplayStateVerified: false,
  externalRollbackProtectionVerified: false,
  runtimeConsumerGatingVerified: false,
  providerOperationalTruthVerified: false,
  activationReady: false,
  blocker: PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_CLEARANCE_BLOCKER,
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function semanticSha256(domain, value) {
  return sha256(Buffer.concat([
    Buffer.from(`${domain}\0`, "utf8"),
    Buffer.from(canonicalizeRfc8785(value), "utf8"),
  ]));
}

function hold(failureReason) {
  return Object.freeze({
    schema: HOLD_SCHEMA,
    status: "HOLD",
    failureReason,
    challengeIssued: false,
    capabilityIssued: false,
    capabilityConsumed: false,
    ...NON_CLEARING_TRUTH,
    authorizesMainnet: false,
    mainnetStatus: "HOLD",
  });
}

function opaqueCarrier(publicBoundary) {
  return Object.freeze(Object.assign(Object.create(null), {
    ...publicBoundary,
    ...NON_CLEARING_TRUTH,
    authorizesMainnet: false,
    mainnetStatus: "HOLD",
  }));
}

function isPlainRecord(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function dataValues(value, expectedKeys, code) {
  if (!isPlainRecord(value)) throw new TypeError(code);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) throw new TypeError(code);
  const expected = [...expectedKeys].sort();
  const actual = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) throw new TypeError(code);
  const result = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, "value")
      || Object.hasOwn(descriptor, "get")
      || Object.hasOwn(descriptor, "set")) throw new TypeError(code);
    result[key] = descriptor.value;
  }
  return result;
}

function optionalInput(value, allowedKeys, code) {
  if (!isPlainRecord(value)) throw new TypeError(code);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    throw new TypeError(code);
  }
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, "value")
      || Object.hasOwn(descriptor, "get")
      || Object.hasOwn(descriptor, "set")) throw new TypeError(code);
    result[key] = descriptor.value;
  }
  return result;
}

function dataOnlyClone(value, path = "value") {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return value;
  if (Array.isArray(value)) {
    const ownKeys = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value")
      || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
      throw new TypeError(`${path}: data-only array required`);
    }
    const expected = new Set([
      "length",
      ...Array.from({ length: lengthDescriptor.value }, (_unused, index) => String(index)),
    ]);
    if (ownKeys.some((key) => typeof key === "symbol" || !expected.has(key))
      || ownKeys.length !== expected.size) throw new TypeError(`${path}: data-only array required`);
    const result = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
        throw new TypeError(`${path}: data-only array required`);
      }
      result.push(dataOnlyClone(descriptor.value, `${path}[${index}]`));
    }
    return result;
  }
  if (!isPlainRecord(value)) throw new TypeError(`${path}: data-only JSON required`);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) {
    throw new TypeError(`${path}: symbol keys forbidden`);
  }
  const result = {};
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, "value")) throw new TypeError(`${path}: accessor forbidden`);
    result[key] = dataOnlyClone(descriptor.value, `${path}.${key}`);
  }
  return result;
}

function productionDigest(value, label) {
  if (typeof value !== "string" || !HEX_SHA256.test(value)
    || /^0{64}$/u.test(value)
    || /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value)) {
    throw new TypeError(`${label}: canonical non-placeholder SHA-256 required`);
  }
  return value;
}

function gitObject(value, label) {
  if (typeof value !== "string" || !GIT_OBJECT.test(value)
    || /^0{40}$/u.test(value) || /^([0-9a-f])\1{39}$/u.test(value)) {
    throw new TypeError(`${label}: canonical non-placeholder Git object required`);
  }
  return value;
}

function u64(value, label) {
  if (typeof value !== "string" || !U64_DECIMAL.test(value)) {
    throw new TypeError(`${label}: canonical unsigned decimal required`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX) throw new RangeError(`${label}: unsigned 64-bit range exceeded`);
  return parsed;
}

function normalizeBinding(binding, expectedSourceSetSha256) {
  const values = dataValues(binding, BINDING_KEYS, "INVALID_EXTERNAL_OBSERVER_BINDING");
  if (values.schema !== PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_BINDING_SCHEMA) {
    throw new Error("EXTERNAL_OBSERVER_BINDING_SCHEMA_MISMATCH");
  }
  const normalized = {
    schema: values.schema,
    sourceCommit: gitObject(values.sourceCommit, "binding.sourceCommit"),
    sourceTree: gitObject(values.sourceTree, "binding.sourceTree"),
    programArtifactSha256: productionDigest(
      values.programArtifactSha256,
      "binding.programArtifactSha256",
    ),
    predicateEvidenceSha256: productionDigest(
      values.predicateEvidenceSha256,
      "binding.predicateEvidenceSha256",
    ),
    trustSourceSetSha256: productionDigest(
      values.trustSourceSetSha256,
      "binding.trustSourceSetSha256",
    ),
    evaluationNotBeforeUnixSeconds: values.evaluationNotBeforeUnixSeconds,
    evaluationNotAfterUnixSeconds: values.evaluationNotAfterUnixSeconds,
  };
  if (normalized.trustSourceSetSha256 !== expectedSourceSetSha256) {
    throw new Error("EXTERNAL_OBSERVER_BINDING_TRUST_SOURCE_SET_MISMATCH");
  }
  const notBefore = u64(
    normalized.evaluationNotBeforeUnixSeconds,
    "binding.evaluationNotBeforeUnixSeconds",
  );
  const notAfter = u64(
    normalized.evaluationNotAfterUnixSeconds,
    "binding.evaluationNotAfterUnixSeconds",
  );
  if (notAfter <= notBefore || notAfter - notBefore > MAX_EVALUATION_WINDOW_SECONDS) {
    throw new Error("EXTERNAL_OBSERVER_BINDING_EVALUATION_WINDOW_INVALID");
  }
  return Object.freeze(normalized);
}

function canonicalJsonBytes(record) {
  return Buffer.from(canonicalizeRfc8785(record), "utf8");
}

function decodeCanonicalJson(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > MAX_JSON_BYTES) {
    throw new TypeError(`${label}: bounded Buffer required`);
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`${label}: UTF-8 required`);
  }
  const record = parseB3OwnerPolicyFreezeJson(text, label);
  if (text !== canonicalizeRfc8785(record)) {
    throw new Error(`${label}: RFC8785 canonical JSON bytes required`);
  }
  return record;
}

function trustSnapshot(value) {
  const snapshot = dataOnlyClone(value, "trust");
  const result = validateProductionIdentityIntegrationTrust(snapshot);
  if (!result.valid) throw new Error("EXTERNAL_OBSERVER_TRUST_INVALID");
  return { snapshot, result, json: JSON.stringify(snapshot) };
}

function expectedRequest({ role, source, sourceSetSha256, bindingSha256, nonce }) {
  const config = ROLE_CONFIG[role];
  return Object.freeze({
    schema: PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_REQUEST_SCHEMA,
    environment: "PRODUCTION",
    role,
    sourceId: source.sourceId,
    failureDomainId: source.failureDomainId,
    providerKind: config.providerKind,
    operation: config.operation,
    host: config.host,
    receiptDomainId: source.trustBinding.receiptDomainId,
    receiptDomainSha256: source.trustBinding.receiptDomainSha256,
    subjectBindingSha256: source.trustBinding.subjectBindingSha256,
    trustSourceSetSha256: sourceSetSha256,
    capabilityBindingSha256: bindingSha256,
    challengeNonceBase64url: nonce.toString("base64url"),
    challengeNonceSha256: sha256(nonce),
  });
}

export function createProductionIdentityExternalObserverChallenge(input = {}) {
  try {
    const values = optionalInput(
      input,
      ["trust", "binding"],
      "INVALID_EXTERNAL_OBSERVER_CHALLENGE_INPUT",
    );
    const configuredTrust = Object.hasOwn(values, "trust")
      ? values.trust
      : loadProductionIdentityIntegrationTrust();
    const trusted = trustSnapshot(configuredTrust);
    if (!trusted.result.configured) return hold("UNCONFIGURED_HOLD");
    if (!Object.hasOwn(values, "binding")) return hold("EXTERNAL_OBSERVER_BINDING_REQUIRED_HOLD");
    const binding = normalizeBinding(values.binding, trusted.result.sourceSetSha256);
    const bindingSha256 = semanticSha256(
      "IAT_V2_PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_BINDING_V1",
      binding,
    );
    const nonce = randomBytes(32);
    const requests = new Map();
    for (const role of ROLE_ORDER) {
      const source = trusted.result.sourcesByRole.get(role);
      const record = expectedRequest({
        role,
        source,
        sourceSetSha256: trusted.result.sourceSetSha256,
        bindingSha256,
        nonce,
      });
      const bytes = canonicalJsonBytes(record);
      requests.set(role, Object.freeze({ record, bytes, sha256: sha256(bytes) }));
    }
    const challenge = opaqueCarrier({
      schema: "iat-v2-production-identity-external-observer-challenge/v1",
      status: "STRUCTURAL_CHALLENGE_READY_HOLD_ONLY",
      challengeIssued: true,
    });
    CHALLENGES.set(challenge, {
      trust: trusted.snapshot,
      trustJson: trusted.json,
      trustResult: trusted.result,
      binding,
      bindingSha256,
      nonce: Buffer.from(nonce),
      nonceSha256: sha256(nonce),
      requests,
    });
    return challenge;
  } catch (error) {
    return hold(error instanceof Error ? error.message : "EXTERNAL_OBSERVER_CHALLENGE_HOLD");
  }
}

export function inspectProductionIdentityExternalObserverChallenge(challenge) {
  const state = CHALLENGES.get(challenge);
  if (!state) return null;
  const requests = Object.freeze(ROLE_ORDER.map((role) => {
    const request = state.requests.get(role);
    return Object.freeze({
      role,
      sourceId: request.record.sourceId,
      failureDomainId: request.record.failureDomainId,
      host: request.record.host,
      requestBase64url: request.bytes.toString("base64url"),
      requestSha256: request.sha256,
    });
  }));
  return Object.freeze({
    schema: "iat-v2-production-identity-external-observer-challenge/v1",
    status: "STRUCTURAL_CHALLENGE_READY_HOLD_ONLY",
    challengeIssued: true,
    challengeNonceBase64url: state.nonce.toString("base64url"),
    challengeNonceSha256: state.nonceSha256,
    capabilityBindingSha256: state.bindingSha256,
    trustSourceSetSha256: state.trustResult.sourceSetSha256,
    requests,
    ...NON_CLEARING_TRUTH,
    authorizesMainnet: false,
    mainnetStatus: "HOLD",
  });
}

function verifyObservation({ role, observation, challengeState }) {
  const values = dataValues(
    observation,
    OBSERVATION_KEYS,
    `INVALID_${role}_OBSERVATION_INPUT`,
  );
  const source = challengeState.trustResult.sourcesByRole.get(role);
  const config = ROLE_CONFIG[role];
  if (values.sourceId !== source.sourceId) throw new Error(`${role}_SOURCE_ID_MISMATCH`);
  const request = challengeState.requests.get(role);
  if (!Buffer.isBuffer(values.requestBytes)
    || !values.requestBytes.equals(request.bytes)) throw new Error(`${role}_REQUEST_BYTES_MISMATCH`);
  const requestRecord = decodeCanonicalJson(values.requestBytes, `${role} request`);
  dataValues(requestRecord, REQUEST_KEYS, `${role}_REQUEST_SHAPE_MISMATCH`);
  if (canonicalizeRfc8785(requestRecord) !== canonicalizeRfc8785(request.record)) {
    throw new Error(`${role}_REQUEST_SEMANTICS_MISMATCH`);
  }
  const responseRecord = dataValues(
    decodeCanonicalJson(values.responseBytes, `${role} response`),
    RESPONSE_KEYS,
    `${role}_RESPONSE_SHAPE_MISMATCH`,
  );
  const expected = {
    schema: PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_RESPONSE_SCHEMA,
    environment: "PRODUCTION",
    role,
    sourceId: source.sourceId,
    failureDomainId: source.failureDomainId,
    providerKind: config.providerKind,
    operation: config.operation,
    host: config.host,
    receiptDomainId: source.trustBinding.receiptDomainId,
    receiptDomainSha256: source.trustBinding.receiptDomainSha256,
    subjectBindingSha256: source.trustBinding.subjectBindingSha256,
    trustSourceSetSha256: challengeState.trustResult.sourceSetSha256,
    capabilityBindingSha256: challengeState.bindingSha256,
    challengeNonceSha256: challengeState.nonceSha256,
    requestSha256: request.sha256,
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (responseRecord[key] !== expectedValue) throw new Error(`${role}_${key.toUpperCase()}_MISMATCH`);
  }
  productionDigest(responseRecord.observationSha256, `${role}.observationSha256`);
  const observedAt = u64(responseRecord.observedAtUnixSeconds, `${role}.observedAtUnixSeconds`);
  const responseExpiresAt = u64(
    responseRecord.expiresAtUnixSeconds,
    `${role}.expiresAtUnixSeconds`,
  );
  if (responseExpiresAt <= observedAt
    || responseExpiresAt - observedAt > MAX_RESPONSE_FRESHNESS_SECONDS) {
    throw new Error(`${role}_RESPONSE_FRESHNESS_WINDOW_INVALID`);
  }
  validateProviderSignedEnvelope(values.envelope);
  const envelopeIssuedAt = u64(values.envelope.issuedAtUnixSeconds, `${role}.envelope.issuedAt`);
  const envelopeExpiresAt = u64(values.envelope.expiresAtUnixSeconds, `${role}.envelope.expiresAt`);
  if (envelopeIssuedAt > observedAt || responseExpiresAt > envelopeExpiresAt) {
    throw new Error(`${role}_SIGNED_RESPONSE_OUTSIDE_ENVELOPE_WINDOW`);
  }
  if (values.envelope.operation !== config.operation) throw new Error(`${role}_OPERATION_MISMATCH`);
  return {
    role,
    source,
    values,
    responseRecord,
    observedAt,
    responseExpiresAt,
    envelopeExpiresAt,
  };
}

function snapshotObservation(observation, role) {
  const values = dataValues(
    observation,
    OBSERVATION_KEYS,
    `INVALID_${role}_OBSERVATION_INPUT`,
  );
  if (!Buffer.isBuffer(values.requestBytes) || !Buffer.isBuffer(values.responseBytes)) {
    throw new TypeError(`${role}_OBSERVATION_BYTES_MUST_BE_BUFFERS`);
  }
  return {
    sourceId: dataOnlyClone(values.sourceId, `${role}.sourceId`),
    stateBefore: dataOnlyClone(values.stateBefore, `${role}.stateBefore`),
    envelope: dataOnlyClone(values.envelope, `${role}.envelope`),
    requestBytes: Buffer.from(values.requestBytes),
    responseBytes: Buffer.from(values.responseBytes),
  };
}

function challengeFromAcquireInput(input) {
  if (!isPlainRecord(input)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(input, "challenge");
  if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) return null;
  return descriptor.value;
}

export function acquireProductionIdentityExternalObserverCapability(input) {
  const challenge = challengeFromAcquireInput(input);
  const challengeState = CHALLENGES.get(challenge);
  if (!challengeState) return hold("EXTERNAL_OBSERVER_CHALLENGE_INVALID_OR_CONSUMED_HOLD");
  CHALLENGES.delete(challenge);
  try {
    if (Object.getOwnPropertyDescriptor(input, "evaluationUnixSeconds")) {
      return hold("CALLER_SUPPLIED_EVALUATION_TIME_HOLD");
    }
    const values = dataValues(
      input,
      ["challenge", "trust", "xObservation", "d1Observation"],
      "INVALID_EXTERNAL_OBSERVER_ACQUISITION_INPUT",
    );
    if (values.challenge !== challenge) throw new Error("EXTERNAL_OBSERVER_CHALLENGE_IDENTITY_MISMATCH");
    const providedTrust = trustSnapshot(values.trust);
    if (!providedTrust.result.configured || providedTrust.json !== challengeState.trustJson) {
      throw new Error("EXTERNAL_OBSERVER_TRUST_SNAPSHOT_MISMATCH");
    }
    const xObservation = snapshotObservation(values.xObservation, "X_PROVIDER_OBSERVER");
    const d1Observation = snapshotObservation(
      values.d1Observation,
      "CLOUDFLARE_D1_OBSERVER",
    );
    const x = verifyObservation({
      role: "X_PROVIDER_OBSERVER",
      observation: xObservation,
      challengeState,
    });
    const d1 = verifyObservation({
      role: "CLOUDFLARE_D1_OBSERVER",
      observation: d1Observation,
      challengeState,
    });
    if (CONSUMED_ENVELOPES.has(x.values.envelope.envelopeSha256)
      || CONSUMED_ENVELOPES.has(d1.values.envelope.envelopeSha256)) {
      throw new Error("EXTERNAL_OBSERVER_ENVELOPE_REPLAY_HOLD");
    }
    const skew = x.observedAt >= d1.observedAt
      ? x.observedAt - d1.observedAt
      : d1.observedAt - x.observedAt;
    if (skew > MAX_OBSERVER_SKEW_SECONDS) {
      throw new Error("EXTERNAL_OBSERVER_SIGNED_TIME_SKEW_HOLD");
    }
    const evaluationTime = x.observedAt >= d1.observedAt ? x.observedAt : d1.observedAt;
    const bindingNotBefore = BigInt(challengeState.binding.evaluationNotBeforeUnixSeconds);
    const bindingNotAfter = BigInt(challengeState.binding.evaluationNotAfterUnixSeconds);
    if (evaluationTime < bindingNotBefore || evaluationTime >= bindingNotAfter
      || evaluationTime >= x.responseExpiresAt || evaluationTime >= d1.responseExpiresAt
      || x.responseExpiresAt > bindingNotAfter || d1.responseExpiresAt > bindingNotAfter) {
      throw new Error("EXTERNAL_OBSERVER_EVALUATION_TIME_OUTSIDE_SIGNED_WINDOW_HOLD");
    }
    const receipts = [];
    for (const observation of [x, d1]) {
      const receipt = verifyProviderSignedEnvelope({
        trustBinding: observation.source.trustBinding,
        currentState: observation.values.stateBefore,
        envelope: observation.values.envelope,
        requestBytes: observation.values.requestBytes,
        responseBytes: observation.values.responseBytes,
        expectedRequestNonceSha256: challengeState.nonceSha256,
        evaluationUnixSeconds: evaluationTime,
      });
      validateProviderEnvelopeVerificationReceipt(receipt);
      receipts.push(receipt);
    }
    CONSUMED_ENVELOPES.add(x.values.envelope.envelopeSha256);
    CONSUMED_ENVELOPES.add(d1.values.envelope.envelopeSha256);
    const capability = opaqueCarrier({
      schema: PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_CAPABILITY_SCHEMA,
      status: "OPAQUE_SINGLE_USE_STRUCTURAL_CAPABILITY_HOLD_ONLY",
      capabilityIssued: true,
    });
    CAPABILITIES.set(capability, Object.freeze({
      binding: challengeState.binding,
      bindingSha256: challengeState.bindingSha256,
      trustSourceSetSha256: challengeState.trustResult.sourceSetSha256,
      subjectBindingSha256: challengeState.trustResult.expectedSubjectBindingSha256,
      evaluationUnixSeconds: evaluationTime.toString(),
      expiresAtUnixSeconds: (x.responseExpiresAt <= d1.responseExpiresAt
        ? x.responseExpiresAt
        : d1.responseExpiresAt).toString(),
      sources: Object.freeze([x, d1].map((observation, index) => Object.freeze({
        role: observation.role,
        sourceId: observation.source.sourceId,
        failureDomainId: observation.source.failureDomainId,
        host: ROLE_CONFIG[observation.role].host,
        trustBindingSha256: observation.source.trustBinding.trustBindingSha256,
        envelopeSha256: observation.values.envelope.envelopeSha256,
        requestSha256: observation.values.envelope.requestSha256,
        responseSha256: observation.values.envelope.responseSha256,
        observationSha256: observation.responseRecord.observationSha256,
        verificationReceiptSha256: receipts[index].verificationReceiptSha256,
      }))),
    }));
    return capability;
  } catch (error) {
    return hold(error instanceof Error ? error.message : "EXTERNAL_OBSERVER_ACQUISITION_HOLD");
  }
}

export function isProductionIdentityExternalObserverCapability(capability) {
  return CAPABILITIES.has(capability);
}

export function inspectProductionIdentityExternalObserverCapability(capability) {
  const state = CAPABILITIES.get(capability);
  if (!state) return null;
  return Object.freeze({
    schema: PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_CAPABILITY_SCHEMA,
    status: "OPAQUE_SINGLE_USE_STRUCTURAL_CAPABILITY_HOLD_ONLY",
    capabilityIssued: true,
    capabilityBindingSha256: state.bindingSha256,
    trustSourceSetSha256: state.trustSourceSetSha256,
    subjectBindingSha256: state.subjectBindingSha256,
    evaluationUnixSeconds: state.evaluationUnixSeconds,
    expiresAtUnixSeconds: state.expiresAtUnixSeconds,
    sources: state.sources,
    inspectOnly: true,
    ...NON_CLEARING_TRUTH,
    authorizesMainnet: false,
    mainnetStatus: "HOLD",
  });
}

export function consumeProductionIdentityExternalObserverCapability(
  capability,
  expectedBinding,
) {
  const state = CAPABILITIES.get(capability);
  if (!state) return hold("EXTERNAL_OBSERVER_CAPABILITY_INVALID_OR_CONSUMED_HOLD");
  CAPABILITIES.delete(capability);
  try {
    const normalized = normalizeBinding(expectedBinding, state.trustSourceSetSha256);
    const digest = semanticSha256(
      "IAT_V2_PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_BINDING_V1",
      normalized,
    );
    if (digest !== state.bindingSha256) {
      throw new Error("EXTERNAL_OBSERVER_CAPABILITY_BINDING_MISMATCH_HOLD");
    }
    return Object.freeze({
      schema: CONSUMPTION_SCHEMA,
      status: "CONSUMED_HOLD_ONLY_CLAIMS",
      capabilityConsumed: true,
      capabilityBindingSha256: state.bindingSha256,
      trustSourceSetSha256: state.trustSourceSetSha256,
      subjectBindingSha256: state.subjectBindingSha256,
      evaluationUnixSeconds: state.evaluationUnixSeconds,
      expiresAtUnixSeconds: state.expiresAtUnixSeconds,
      sources: state.sources,
      ...NON_CLEARING_TRUTH,
      authorizesMainnet: false,
      mainnetStatus: "HOLD",
    });
  } catch (error) {
    return hold(error instanceof Error ? error.message : "EXTERNAL_OBSERVER_CONSUMPTION_HOLD");
  }
}

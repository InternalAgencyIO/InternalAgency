export const RETAINED_V2_RUNTIME_BOUNDARY_SCHEMA =
  "iat-b3-retained-v2-x-callback-runtime-boundary/v1";
export const RETAINED_V2_RUNTIME_AUTHORIZATION_SCHEMA =
  "iat-b3-retained-v2-x-callback-runtime-authorization/v1";
export const RETAINED_V2_WRITE_PLAN_SCHEMA =
  "iat-b3-retained-v2-x-callback-write-plan/v1";
export const RETAINED_V2_X_PROVIDER_RECEIPT_SCHEMA =
  "iat-b3-x-provider-runtime-authentication/v1";
export const RETAINED_V2_CHECKPOINT_RECEIPT_SCHEMA =
  "iat-b3-external-checkpoint-runtime-binding/v1";
export const RETAINED_V2_DAILY_LAW_RECEIPT_SCHEMA =
  "iat-b3-daily-law-runtime-authorization/v1";
export const RETAINED_V2_CONSUMER_RECEIPT_SCHEMA =
  "iat-b3-authenticated-consumer-preconditions/v1";
export const RETAINED_V2_RUNTIME_STATUS = "HOLD_PENDING_PRODUCTION_RUNTIME_EVIDENCE";
export const RETAINED_V2_MAINNET_STATUS = "HOLD";
export const RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS = "100000000000";

export const RETAINED_V2_SUBSCRIPTION_TYPES = Object.freeze([
  "None",
  "Basic",
  "Premium",
  "PremiumPlus",
]);
export const RETAINED_V2_NON_PREMIUM_TYPES = Object.freeze(["None", "Basic"]);
export const RETAINED_V2_PREMIUM_TYPES = Object.freeze(["Premium", "PremiumPlus"]);

const X_PROVIDER_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "environment",
  "providerAuthenticationVerified",
  "productionKeyOwnershipVerified",
  "providerIdentityVerified",
  "keyRegistryAuthenticityVerified",
  "responseSemanticsVerified",
  "durableReplayStateVerified",
  "providerOperationalTruthVerified",
  "subjectBindingSha256",
  "requestNonceSha256",
  "xUserId",
  "subscriptionType",
  "xAccountCreatedAtUtc",
  "subscriptionObservedAtUnixSeconds",
  "evidenceSha256",
  "envelopeSha256",
  "sequence",
  "issuedAtUnixSeconds",
  "expiresAtUnixSeconds",
]);

const CHECKPOINT_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "environment",
  "providerAuthenticationVerified",
  "productionKeyOwnershipVerified",
  "providerIdentityVerified",
  "keyRegistryAuthenticityVerified",
  "externalMonotonicityVerified",
  "durableReplayStateVerified",
  "rollbackProtectionVerified",
  "providerOperationalTruthVerified",
  "subjectBindingSha256",
  "localHeadSequence",
  "localHeadSha256",
  "checkpointSha256",
  "envelopeSha256",
  "sequence",
  "issuedAtUnixSeconds",
  "expiresAtUnixSeconds",
]);

const DAILY_LAW_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "environment",
  "lawId",
  "runtimeDailyLawAuthenticated",
  "decisionFinalized",
  "writeAuthorized",
  "authenticatedSolanaInputsVerified",
  "subjectBindingSha256",
  "localHeadSha256",
  "protocolDay",
  "decisionSha256",
  "validFromUnixSeconds",
  "validThroughUnixSeconds",
]);

const CONSUMER_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "environment",
  "runtimeConsumerGatingVerified",
  "allDownstreamConsumersGated",
  "providerEvidenceAuthenticationVerified",
  "externalCheckpointBindingVerified",
  "rollbackProtectionVerified",
  "dailyLawAuthorizationVerified",
  "retainedV2TierSemanticsVerified",
  "atomicWriteAdapterVerified",
  "subjectBindingSha256",
  "localHeadSha256",
  "checkpointSha256",
  "xEvidenceSha256",
  "dailyLawDecisionSha256",
  "writeAdapterId",
  "writeAdapterSha256",
  "validThroughUnixSeconds",
]);

const INPUT_KEYS = Object.freeze([
  "context",
  "evidence",
  "currentUnixSeconds",
]);
const CONTEXT_KEYS = Object.freeze([
  "nodeId",
  "wallet",
  "xUserId",
  "xAccountCreatedAtUtc",
  "subscriptionType",
  "subscriptionObservedAtUtc",
  "requestNonceSha256",
  "subjectBindingSha256",
  "localHeadSequence",
  "localHeadSha256",
  "writeAdapterId",
  "writeAdapterSha256",
  "nominalAmountBaseUnits",
]);
const EVIDENCE_KEYS = Object.freeze([
  "xProviderEnvelope",
  "externalCheckpointBinding",
  "dailyLawAuthorization",
  "consumerPreconditions",
]);

const HEX_32 = /^[0-9a-f]{64}$/u;
const POSITIVE_DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const X_USER_ID = /^[1-9][0-9]{0,31}$/u;
const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u;
const BASE58_WALLET = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{32,44}$/u;
const ADAPTER_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/u;
const NON_PRODUCTION_ID = /(?:^|[._:/-])(?:dev|dummy|example|fake|fixture|local|mock|sample|sandbox|staging|synthetic|test)(?:$|[._:/-])/iu;
const MAX_FUTURE_SKEW_SECONDS = 30n;
const X_EVIDENCE_MAXIMUM_AGE_SECONDS = 86_400n;
const X_ACCOUNT_MINIMUM_AGE_SECONDS = 3_456_000n;

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  return isPlainRecord(value)
    && JSON.stringify(Object.keys(value)) === JSON.stringify(expected);
}

function asUnixSeconds(value, label) {
  if (typeof value !== "string" || !POSITIVE_DECIMAL.test(value)) {
    throw new TypeError(`${label} must be canonical unsigned decimal seconds`);
  }
  return BigInt(value);
}

function asDigest(value, label) {
  if (typeof value !== "string" || !HEX_32.test(value)
    || /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value)) {
    throw new TypeError(`${label} must be a non-placeholder lowercase SHA-256`);
  }
  return value;
}

function asUtc(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    throw new TypeError(`${label} must be canonical millisecond UTC`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError(`${label} must be a real canonical UTC instant`);
  }
  return BigInt(timestamp) / 1_000n;
}

function asAmount(value, label) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) {
    throw new TypeError(`${label} must be a positive canonical base-unit amount`);
  }
  return BigInt(value);
}

function asAdapterId(value) {
  if (typeof value !== "string" || !ADAPTER_ID.test(value) || NON_PRODUCTION_ID.test(value)) {
    throw new TypeError("write adapter ID must identify an exact production adapter");
  }
  return value;
}

function assertReceiptWindow({ issuedAt, expiresAt, now, label }) {
  if (issuedAt > expiresAt) throw new Error(`${label} validity window is inverted`);
  if (issuedAt > now + MAX_FUTURE_SKEW_SECONDS) throw new Error(`${label} is future-dated`);
  if (expiresAt < now) throw new Error(`${label} is stale`);
}

function deny(code) {
  return Object.freeze({
    ok: false,
    schema: RETAINED_V2_RUNTIME_BOUNDARY_SCHEMA,
    status: RETAINED_V2_RUNTIME_STATUS,
    code,
    writeAuthorized: false,
    mainnetStatus: RETAINED_V2_MAINNET_STATUS,
  });
}

export function isRetainedV2SubscriptionType(value) {
  return RETAINED_V2_SUBSCRIPTION_TYPES.includes(value);
}

export function retainedV2TierDecision({ nominalAmountBaseUnits, subscriptionType }) {
  const nominal = asAmount(nominalAmountBaseUnits, "nominal reward");
  if (!isRetainedV2SubscriptionType(subscriptionType)) {
    throw new Error("retained V2 reward requires an exact known subscription type");
  }
  if (nominal % 10n !== 0n) {
    throw new Error("retained V2 nominal reward must split into exact 10/90 base-unit tranches");
  }
  if (RETAINED_V2_NON_PREMIUM_TYPES.includes(subscriptionType)) {
    return Object.freeze({
      subscriptionType,
      nominalAmountBaseUnits: nominal.toString(),
      immediateTrancheKind: "X_BASE_10",
      immediateBasisPoints: 1_000,
      immediateAmountBaseUnits: (nominal / 10n).toString(),
      conditionalUpgrade: Object.freeze({
        trancheKind: "X_PREMIUM_UPGRADE_90",
        basisPoints: 9_000,
        amountBaseUnits: (nominal * 9n / 10n).toString(),
        reserved: false,
        createsDebt: false,
        requiresSameImmutableXIdAndWallet: true,
        requiresFreshLaterPremiumOrPremiumPlus: true,
      }),
    });
  }
  return Object.freeze({
    subscriptionType,
    nominalAmountBaseUnits: nominal.toString(),
    immediateTrancheKind: "X_PREMIUM_FULL_100",
    immediateBasisPoints: 10_000,
    immediateAmountBaseUnits: nominal.toString(),
    conditionalUpgrade: null,
  });
}

function validateContext(context, now) {
  if (!hasExactKeys(context, CONTEXT_KEYS)) throw new Error("callback context keys are not exact");
  if (typeof context.nodeId !== "string" || !NODE_ID.test(context.nodeId)) throw new Error("node ID is invalid");
  if (typeof context.wallet !== "string" || !BASE58_WALLET.test(context.wallet)) throw new Error("wallet is invalid");
  if (typeof context.xUserId !== "string" || !X_USER_ID.test(context.xUserId)) throw new Error("immutable X user ID is invalid");
  if (!isRetainedV2SubscriptionType(context.subscriptionType)) throw new Error("X subscription type is not retained V2");
  const created = asUtc(context.xAccountCreatedAtUtc, "X account creation time");
  const observed = asUtc(context.subscriptionObservedAtUtc, "X subscription observation time");
  if (observed > now + MAX_FUTURE_SKEW_SECONDS) throw new Error("X subscription observation is future-dated");
  if (observed > now || now - observed > X_EVIDENCE_MAXIMUM_AGE_SECONDS) throw new Error("X subscription observation is stale");
  if (observed - created < X_ACCOUNT_MINIMUM_AGE_SECONDS) throw new Error("X account is younger than 40 full days");
  asDigest(context.requestNonceSha256, "request nonce");
  asDigest(context.subjectBindingSha256, "subject binding");
  if (typeof context.localHeadSequence !== "string" || !POSITIVE_DECIMAL.test(context.localHeadSequence)) throw new Error("local head sequence is invalid");
  asDigest(context.localHeadSha256, "local head");
  asAdapterId(context.writeAdapterId);
  asDigest(context.writeAdapterSha256, "write adapter");
  const tierDecision = retainedV2TierDecision(context);
  return { created, observed, tierDecision };
}

function validateXReceipt(receipt, context, now, times) {
  if (!hasExactKeys(receipt, X_PROVIDER_RECEIPT_KEYS)) throw new Error("X provider receipt keys are not exact");
  if (receipt.schema !== RETAINED_V2_X_PROVIDER_RECEIPT_SCHEMA
    || receipt.status !== "VERIFIED"
    || receipt.environment !== "PRODUCTION") throw new Error("X provider receipt header is invalid");
  for (const key of [
    "providerAuthenticationVerified",
    "productionKeyOwnershipVerified",
    "providerIdentityVerified",
    "keyRegistryAuthenticityVerified",
    "responseSemanticsVerified",
    "durableReplayStateVerified",
    "providerOperationalTruthVerified",
  ]) if (receipt[key] !== true) throw new Error(`X provider receipt ${key} is not verified`);
  for (const key of ["subjectBindingSha256", "requestNonceSha256", "evidenceSha256", "envelopeSha256"]) asDigest(receipt[key], `X provider ${key}`);
  if (receipt.subjectBindingSha256 !== context.subjectBindingSha256
    || receipt.requestNonceSha256 !== context.requestNonceSha256
    || receipt.xUserId !== context.xUserId
    || receipt.subscriptionType !== context.subscriptionType
    || receipt.xAccountCreatedAtUtc !== context.xAccountCreatedAtUtc) {
    throw new Error("X provider receipt does not bind the exact callback subject and observation");
  }
  const observed = asUnixSeconds(receipt.subscriptionObservedAtUnixSeconds, "X provider observation");
  if (observed !== times.observed) throw new Error("X provider observation time does not match callback context");
  if (typeof receipt.sequence !== "string" || !/^[1-9][0-9]*$/u.test(receipt.sequence)) throw new Error("X provider sequence is invalid");
  const issuedAt = asUnixSeconds(receipt.issuedAtUnixSeconds, "X provider issued-at");
  const expiresAt = asUnixSeconds(receipt.expiresAtUnixSeconds, "X provider expiry");
  assertReceiptWindow({ issuedAt, expiresAt, now, label: "X provider receipt" });
  return receipt;
}

function validateCheckpointReceipt(receipt, context, now) {
  if (!hasExactKeys(receipt, CHECKPOINT_RECEIPT_KEYS)) throw new Error("external checkpoint receipt keys are not exact");
  if (receipt.schema !== RETAINED_V2_CHECKPOINT_RECEIPT_SCHEMA
    || receipt.status !== "VERIFIED"
    || receipt.environment !== "PRODUCTION") throw new Error("external checkpoint receipt header is invalid");
  for (const key of [
    "providerAuthenticationVerified",
    "productionKeyOwnershipVerified",
    "providerIdentityVerified",
    "keyRegistryAuthenticityVerified",
    "externalMonotonicityVerified",
    "durableReplayStateVerified",
    "rollbackProtectionVerified",
    "providerOperationalTruthVerified",
  ]) if (receipt[key] !== true) throw new Error(`external checkpoint receipt ${key} is not verified`);
  for (const key of ["subjectBindingSha256", "localHeadSha256", "checkpointSha256", "envelopeSha256"]) asDigest(receipt[key], `external checkpoint ${key}`);
  if (receipt.subjectBindingSha256 !== context.subjectBindingSha256
    || receipt.localHeadSequence !== context.localHeadSequence
    || receipt.localHeadSha256 !== context.localHeadSha256) {
    throw new Error("external checkpoint does not bind the exact callback subject and local head");
  }
  if (typeof receipt.sequence !== "string" || !/^[1-9][0-9]*$/u.test(receipt.sequence)) throw new Error("external checkpoint sequence is invalid");
  const issuedAt = asUnixSeconds(receipt.issuedAtUnixSeconds, "external checkpoint issued-at");
  const expiresAt = asUnixSeconds(receipt.expiresAtUnixSeconds, "external checkpoint expiry");
  assertReceiptWindow({ issuedAt, expiresAt, now, label: "external checkpoint receipt" });
  return receipt;
}

function validateDailyLawReceipt(receipt, context, checkpoint, now) {
  if (!hasExactKeys(receipt, DAILY_LAW_RECEIPT_KEYS)) throw new Error("Daily Law receipt keys are not exact");
  if (receipt.schema !== RETAINED_V2_DAILY_LAW_RECEIPT_SCHEMA
    || receipt.status !== "AUTHORIZED"
    || receipt.environment !== "PRODUCTION"
    || receipt.lawId !== "IAT_B3_DAILY_LOCKDOWN_LAW_V1") throw new Error("Daily Law receipt header is invalid");
  for (const key of [
    "runtimeDailyLawAuthenticated",
    "decisionFinalized",
    "writeAuthorized",
    "authenticatedSolanaInputsVerified",
  ]) if (receipt[key] !== true) throw new Error(`Daily Law receipt ${key} is not verified`);
  for (const key of ["subjectBindingSha256", "localHeadSha256", "decisionSha256"]) asDigest(receipt[key], `Daily Law ${key}`);
  if (receipt.subjectBindingSha256 !== context.subjectBindingSha256
    || receipt.localHeadSha256 !== context.localHeadSha256
    || receipt.localHeadSha256 !== checkpoint.localHeadSha256) {
    throw new Error("Daily Law authorization does not bind the exact subject and local head");
  }
  if (typeof receipt.protocolDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(receipt.protocolDay)) throw new Error("Daily Law protocol day is invalid");
  const validFrom = asUnixSeconds(receipt.validFromUnixSeconds, "Daily Law valid-from");
  const validThrough = asUnixSeconds(receipt.validThroughUnixSeconds, "Daily Law valid-through");
  if (validFrom > now || validThrough < now || validFrom > validThrough) throw new Error("Daily Law authorization is stale or not yet valid");
  return receipt;
}

function validateConsumerReceipt(receipt, context, xProvider, checkpoint, dailyLaw, now) {
  if (!hasExactKeys(receipt, CONSUMER_RECEIPT_KEYS)) throw new Error("consumer receipt keys are not exact");
  if (receipt.schema !== RETAINED_V2_CONSUMER_RECEIPT_SCHEMA
    || receipt.status !== "VERIFIED"
    || receipt.environment !== "PRODUCTION") throw new Error("consumer receipt header is invalid");
  for (const key of [
    "runtimeConsumerGatingVerified",
    "allDownstreamConsumersGated",
    "providerEvidenceAuthenticationVerified",
    "externalCheckpointBindingVerified",
    "rollbackProtectionVerified",
    "dailyLawAuthorizationVerified",
    "retainedV2TierSemanticsVerified",
    "atomicWriteAdapterVerified",
  ]) if (receipt[key] !== true) throw new Error(`consumer receipt ${key} is not verified`);
  for (const key of [
    "subjectBindingSha256",
    "localHeadSha256",
    "checkpointSha256",
    "xEvidenceSha256",
    "dailyLawDecisionSha256",
    "writeAdapterSha256",
  ]) asDigest(receipt[key], `consumer ${key}`);
  if (receipt.subjectBindingSha256 !== context.subjectBindingSha256
    || receipt.localHeadSha256 !== context.localHeadSha256
    || receipt.checkpointSha256 !== checkpoint.checkpointSha256
    || receipt.xEvidenceSha256 !== xProvider.evidenceSha256
    || receipt.dailyLawDecisionSha256 !== dailyLaw.decisionSha256
    || receipt.writeAdapterId !== context.writeAdapterId
    || receipt.writeAdapterSha256 !== context.writeAdapterSha256) {
    throw new Error("consumer receipt does not cross-bind every exact runtime prerequisite");
  }
  asAdapterId(receipt.writeAdapterId);
  if (asUnixSeconds(receipt.validThroughUnixSeconds, "consumer expiry") < now) throw new Error("consumer preconditions are stale");
  return receipt;
}

export function createRetainedV2CallbackRuntimeBoundary(verifiers = {}) {
  const requiredVerifierKeys = [
    "verifyXProviderEnvelope",
    "verifyExternalCheckpointBinding",
    "verifyDailyLawAuthorization",
    "verifyConsumerPreconditions",
  ];
  const runtimeConfigured = isPlainRecord(verifiers)
    && requiredVerifierKeys.every((key) => typeof verifiers[key] === "function")
    && Object.keys(verifiers).every((key) => requiredVerifierKeys.includes(key));
  const issued = new WeakSet();
  const consumed = new WeakSet();
  const seenEvidence = new Set();

  async function authorize(input) {
    if (!runtimeConfigured) return deny("RUNTIME_VERIFIERS_UNAVAILABLE");
    try {
      if (!hasExactKeys(input, INPUT_KEYS)) throw new Error("runtime authorization input keys are not exact");
      const now = asUnixSeconds(input.currentUnixSeconds, "authorization evaluation time");
      const times = validateContext(input.context, now);
      if (!hasExactKeys(input.evidence, EVIDENCE_KEYS)
        || EVIDENCE_KEYS.some((key) => input.evidence[key] === null || input.evidence[key] === undefined)) {
        throw new Error("all four runtime evidence inputs are required");
      }

      const xProvider = validateXReceipt(
        await verifiers.verifyXProviderEnvelope(input.evidence.xProviderEnvelope, input.context),
        input.context,
        now,
        times,
      );
      const checkpoint = validateCheckpointReceipt(
        await verifiers.verifyExternalCheckpointBinding(input.evidence.externalCheckpointBinding, input.context),
        input.context,
        now,
      );
      const dailyLaw = validateDailyLawReceipt(
        await verifiers.verifyDailyLawAuthorization(input.evidence.dailyLawAuthorization, input.context),
        input.context,
        checkpoint,
        now,
      );
      const consumer = validateConsumerReceipt(
        await verifiers.verifyConsumerPreconditions(input.evidence.consumerPreconditions, input.context),
        input.context,
        xProvider,
        checkpoint,
        dailyLaw,
        now,
      );

      const replayKey = [
        input.context.subjectBindingSha256,
        xProvider.envelopeSha256,
        xProvider.sequence,
        checkpoint.envelopeSha256,
        checkpoint.sequence,
        dailyLaw.decisionSha256,
        consumer.writeAdapterSha256,
      ].join(":");
      if (seenEvidence.has(replayKey)) return deny("RUNTIME_EVIDENCE_REPLAYED");
      seenEvidence.add(replayKey);

      const writePlan = Object.freeze({
        schema: RETAINED_V2_WRITE_PLAN_SCHEMA,
        nodeId: input.context.nodeId,
        wallet: input.context.wallet,
        immutableXUserId: input.context.xUserId,
        xAccountCreatedAtUtc: input.context.xAccountCreatedAtUtc,
        subscriptionObservedAtUtc: input.context.subscriptionObservedAtUtc,
        ...times.tierDecision,
        subjectBindingSha256: input.context.subjectBindingSha256,
        localHeadSequence: input.context.localHeadSequence,
        localHeadSha256: input.context.localHeadSha256,
        xEvidenceSha256: xProvider.evidenceSha256,
        externalCheckpointSha256: checkpoint.checkpointSha256,
        dailyLawDecisionSha256: dailyLaw.decisionSha256,
        writeAdapterId: input.context.writeAdapterId,
        writeAdapterSha256: input.context.writeAdapterSha256,
        publicationAllowed: false,
        serverSigningAllowed: false,
        automaticBroadcastAllowed: false,
        mainnetStatus: RETAINED_V2_MAINNET_STATUS,
      });
      const authorization = Object.freeze({
        schema: RETAINED_V2_RUNTIME_AUTHORIZATION_SCHEMA,
        status: "ONE_SHOT_WRITE_AUTHORIZATION",
        writeAuthorized: true,
        mainnetStatus: RETAINED_V2_MAINNET_STATUS,
        writePlan,
      });
      issued.add(authorization);
      return Object.freeze({
        ok: true,
        schema: RETAINED_V2_RUNTIME_BOUNDARY_SCHEMA,
        status: "RUNTIME_PRECONDITIONS_VERIFIED",
        writeAuthorized: true,
        mainnetStatus: RETAINED_V2_MAINNET_STATUS,
        authorization,
      });
    } catch {
      return deny("RUNTIME_PRECONDITION_REJECTED");
    }
  }

  async function runAuthorizedMutation(authorization, mutation) {
    if (!issued.has(authorization) || consumed.has(authorization)) {
      throw new Error("RETAINED_V2_WRITE_AUTHORIZATION_INVALID_OR_CONSUMED");
    }
    if (typeof mutation !== "function") throw new TypeError("authorized mutation callback is required");
    consumed.add(authorization);
    return mutation(authorization.writePlan);
  }

  return Object.freeze({
    schema: RETAINED_V2_RUNTIME_BOUNDARY_SCHEMA,
    status: runtimeConfigured ? "VERIFIERS_CONFIGURED_ACTIVATION_STILL_EVIDENCE_GATED" : RETAINED_V2_RUNTIME_STATUS,
    runtimeConfigured,
    mainnetStatus: RETAINED_V2_MAINNET_STATUS,
    authorize,
    runAuthorizedMutation,
  });
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RETAINED_V2_CHECKPOINT_RECEIPT_SCHEMA,
  RETAINED_V2_CONSUMER_RECEIPT_SCHEMA,
  RETAINED_V2_DAILY_LAW_RECEIPT_SCHEMA,
  RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS,
  RETAINED_V2_X_PROVIDER_RECEIPT_SCHEMA,
  createRetainedV2CallbackRuntimeBoundary,
  isRetainedV2SubscriptionType,
  retainedV2TierDecision,
} from "../app/api/x/callback/retained-v2-runtime-boundary.mjs";
import {
  createRetainedV2CallbackHandler,
} from "../app/api/x/callback/retained-v2-callback-handler.mjs";

const NOW = 2_000_000_000n;
const NOW_UTC = new Date(Number(NOW) * 1_000).toISOString();
const CREATED_UTC = new Date(Number(NOW - 3_456_000n) * 1_000).toISOString();

function digest(label) {
  return createHash("sha256").update(`iat-b3-retained-v2-callback-test:${label}`).digest("hex");
}

function fixture({ subscriptionType = "None", stale = false } = {}) {
  const context = {
    nodeId: "retained-v2-node-001",
    wallet: "11111111111111111111111111111111",
    xUserId: "123456789",
    xAccountCreatedAtUtc: CREATED_UTC,
    subscriptionType,
    subscriptionObservedAtUtc: NOW_UTC,
    requestNonceSha256: digest("request-nonce"),
    subjectBindingSha256: digest("subject-binding"),
    localHeadSequence: "41",
    localHeadSha256: digest("local-head"),
    writeAdapterId: "prod-retained-v2-d1-adapter-v1",
    writeAdapterSha256: digest("write-adapter"),
    nominalAmountBaseUnits: RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS,
  };
  const expiry = (stale ? NOW - 1n : NOW + 120n).toString();
  const xReceipt = {
    schema: RETAINED_V2_X_PROVIDER_RECEIPT_SCHEMA,
    status: "VERIFIED",
    environment: "PRODUCTION",
    providerAuthenticationVerified: true,
    productionKeyOwnershipVerified: true,
    providerIdentityVerified: true,
    keyRegistryAuthenticityVerified: true,
    responseSemanticsVerified: true,
    durableReplayStateVerified: true,
    providerOperationalTruthVerified: true,
    subjectBindingSha256: context.subjectBindingSha256,
    requestNonceSha256: context.requestNonceSha256,
    xUserId: context.xUserId,
    subscriptionType,
    xAccountCreatedAtUtc: context.xAccountCreatedAtUtc,
    subscriptionObservedAtUnixSeconds: NOW.toString(),
    evidenceSha256: digest("x-evidence"),
    envelopeSha256: digest("x-envelope"),
    sequence: "18",
    issuedAtUnixSeconds: (NOW - 5n).toString(),
    expiresAtUnixSeconds: expiry,
  };
  const checkpointReceipt = {
    schema: RETAINED_V2_CHECKPOINT_RECEIPT_SCHEMA,
    status: "VERIFIED",
    environment: "PRODUCTION",
    providerAuthenticationVerified: true,
    productionKeyOwnershipVerified: true,
    providerIdentityVerified: true,
    keyRegistryAuthenticityVerified: true,
    externalMonotonicityVerified: true,
    durableReplayStateVerified: true,
    rollbackProtectionVerified: true,
    providerOperationalTruthVerified: true,
    subjectBindingSha256: context.subjectBindingSha256,
    localHeadSequence: context.localHeadSequence,
    localHeadSha256: context.localHeadSha256,
    checkpointSha256: digest("checkpoint"),
    envelopeSha256: digest("checkpoint-envelope"),
    sequence: "42",
    issuedAtUnixSeconds: (NOW - 5n).toString(),
    expiresAtUnixSeconds: expiry,
  };
  const dailyLawReceipt = {
    schema: RETAINED_V2_DAILY_LAW_RECEIPT_SCHEMA,
    status: "AUTHORIZED",
    environment: "PRODUCTION",
    lawId: "IAT_B3_DAILY_LOCKDOWN_LAW_V1",
    runtimeDailyLawAuthenticated: true,
    decisionFinalized: true,
    writeAuthorized: true,
    authenticatedSolanaInputsVerified: true,
    subjectBindingSha256: context.subjectBindingSha256,
    localHeadSha256: context.localHeadSha256,
    protocolDay: "2033-05-18",
    decisionSha256: digest("daily-law-decision"),
    validFromUnixSeconds: (NOW - 60n).toString(),
    validThroughUnixSeconds: expiry,
  };
  const consumerReceipt = {
    schema: RETAINED_V2_CONSUMER_RECEIPT_SCHEMA,
    status: "VERIFIED",
    environment: "PRODUCTION",
    runtimeConsumerGatingVerified: true,
    allDownstreamConsumersGated: true,
    providerEvidenceAuthenticationVerified: true,
    externalCheckpointBindingVerified: true,
    rollbackProtectionVerified: true,
    dailyLawAuthorizationVerified: true,
    retainedV2TierSemanticsVerified: true,
    atomicWriteAdapterVerified: true,
    subjectBindingSha256: context.subjectBindingSha256,
    localHeadSha256: context.localHeadSha256,
    checkpointSha256: checkpointReceipt.checkpointSha256,
    xEvidenceSha256: xReceipt.evidenceSha256,
    dailyLawDecisionSha256: dailyLawReceipt.decisionSha256,
    writeAdapterId: context.writeAdapterId,
    writeAdapterSha256: context.writeAdapterSha256,
    validThroughUnixSeconds: expiry,
  };
  const evidence = {
    xProviderEnvelope: Object.freeze({ kind: "TEST_ONLY_X_SIGNED_ENVELOPE" }),
    externalCheckpointBinding: Object.freeze({ kind: "TEST_ONLY_CHECKPOINT_ENVELOPE" }),
    dailyLawAuthorization: Object.freeze({ kind: "TEST_ONLY_DAILY_LAW_RECEIPT" }),
    consumerPreconditions: Object.freeze({ kind: "TEST_ONLY_CONSUMER_RECEIPT" }),
  };
  return {
    context,
    evidence,
    receipts: { xReceipt, checkpointReceipt, dailyLawReceipt, consumerReceipt },
  };
}

function boundaryFor(value) {
  const { evidence, receipts } = value;
  return createRetainedV2CallbackRuntimeBoundary({
    verifyXProviderEnvelope(raw) {
      if (raw !== evidence.xProviderEnvelope) throw new Error("forged X envelope");
      return receipts.xReceipt;
    },
    verifyExternalCheckpointBinding(raw) {
      if (raw !== evidence.externalCheckpointBinding) throw new Error("forged checkpoint envelope");
      return receipts.checkpointReceipt;
    },
    verifyDailyLawAuthorization(raw) {
      if (raw !== evidence.dailyLawAuthorization) throw new Error("forged Daily Law receipt");
      return receipts.dailyLawReceipt;
    },
    verifyConsumerPreconditions(raw) {
      if (raw !== evidence.consumerPreconditions) throw new Error("forged consumer receipt");
      return receipts.consumerReceipt;
    },
  });
}

function authorizationInput(value, evidence = value.evidence) {
  return {
    context: value.context,
    evidence,
    currentUnixSeconds: NOW.toString(),
  };
}

test("retained V2 admits all four exact tiers and preserves atomic 10/90/100 semantics", () => {
  for (const tier of ["None", "Basic", "Premium", "PremiumPlus"]) {
    assert.equal(isRetainedV2SubscriptionType(tier), true);
  }
  for (const tier of [undefined, null, "", "premium", "VerifiedOrganization"]) {
    assert.equal(isRetainedV2SubscriptionType(tier), false);
  }
  for (const tier of ["None", "Basic"]) {
    const decision = retainedV2TierDecision({
      nominalAmountBaseUnits: RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS,
      subscriptionType: tier,
    });
    assert.equal(decision.immediateTrancheKind, "X_BASE_10");
    assert.equal(decision.immediateBasisPoints, 1_000);
    assert.equal(decision.immediateAmountBaseUnits, "10000000000");
    assert.deepEqual(decision.conditionalUpgrade, {
      trancheKind: "X_PREMIUM_UPGRADE_90",
      basisPoints: 9_000,
      amountBaseUnits: "90000000000",
      reserved: false,
      createsDebt: false,
      requiresSameImmutableXIdAndWallet: true,
      requiresFreshLaterPremiumOrPremiumPlus: true,
    });
  }
  for (const tier of ["Premium", "PremiumPlus"]) {
    const decision = retainedV2TierDecision({
      nominalAmountBaseUnits: RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS,
      subscriptionType: tier,
    });
    assert.equal(decision.immediateTrancheKind, "X_PREMIUM_FULL_100");
    assert.equal(decision.immediateBasisPoints, 10_000);
    assert.equal(decision.immediateAmountBaseUnits, RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS);
    assert.equal(decision.conditionalUpgrade, null);
  }
  assert.throws(
    () => retainedV2TierDecision({ nominalAmountBaseUnits: "101", subscriptionType: "None" }),
    /split into exact 10\/90/u,
  );
});

test("the shipped callback holds before D1 or network access because runtime wiring is absent", async () => {
  let databaseCalls = 0;
  let fetchCalls = 0;
  const handler = createRetainedV2CallbackHandler({
    runtimeEnv: {
      DB: {
        prepare() {
          databaseCalls += 1;
          throw new Error("D1 must not be reached");
        },
      },
      X_CLIENT_ID: "configured-but-insufficient",
      X_OAUTH_STATE_SECRET: "configured-but-insufficient",
      NODE_SESSION_SECRET: "configured-but-insufficient",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("network must not be reached");
    },
  });
  const response = await handler(new Request("https://internalagency.io/api/x/callback?code=x&state=y"));
  assert.equal(response.status, 302);
  assert.match(response.headers.get("Location"), /retained-v2-runtime-hold/u);
  assert.equal(databaseCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("missing or forged evidence cannot mint a mutation capability and performs zero writes", async () => {
  const value = fixture();
  const boundary = boundaryFor(value);
  let writes = 0;

  const missing = await boundary.authorize(authorizationInput(value, {
    xProviderEnvelope: value.evidence.xProviderEnvelope,
    externalCheckpointBinding: null,
    dailyLawAuthorization: value.evidence.dailyLawAuthorization,
    consumerPreconditions: value.evidence.consumerPreconditions,
  }));
  assert.equal(missing.ok, false);
  assert.equal(missing.writeAuthorized, false);

  const forged = await boundary.authorize(authorizationInput(value, {
    ...value.evidence,
    xProviderEnvelope: { kind: "CALLER_FORGED_X_ENVELOPE" },
  }));
  assert.equal(forged.ok, false);
  assert.equal(forged.writeAuthorized, false);

  await assert.rejects(
    boundary.runAuthorizedMutation({}, async () => { writes += 1; }),
    /INVALID_OR_CONSUMED/u,
  );
  assert.equal(writes, 0);
});

test("stale authenticated-looking evidence fails before the mutation callback", async () => {
  const value = fixture({ stale: true });
  const boundary = boundaryFor(value);
  let writes = 0;
  const result = await boundary.authorize(authorizationInput(value));
  assert.equal(result.ok, false);
  assert.equal(result.code, "RUNTIME_PRECONDITION_REJECTED");
  assert.equal(result.writeAuthorized, false);
  await assert.rejects(
    boundary.runAuthorizedMutation(result.authorization ?? {}, async () => { writes += 1; }),
    /INVALID_OR_CONSUMED/u,
  );
  assert.equal(writes, 0);
});

test("verified evidence and its one-shot capability reject both evidence replay and send replay", async () => {
  const value = fixture({ subscriptionType: "Basic" });
  const boundary = boundaryFor(value);
  let writes = 0;
  const first = await boundary.authorize(authorizationInput(value));
  assert.equal(first.ok, true);
  assert.equal(first.writeAuthorized, true);
  assert.equal(first.authorization.writePlan.immediateTrancheKind, "X_BASE_10");
  assert.equal(first.authorization.writePlan.conditionalUpgrade.trancheKind, "X_PREMIUM_UPGRADE_90");

  const replayedEvidence = await boundary.authorize(authorizationInput(value));
  assert.equal(replayedEvidence.ok, false);
  assert.equal(replayedEvidence.code, "RUNTIME_EVIDENCE_REPLAYED");

  const receipt = await boundary.runAuthorizedMutation(first.authorization, async (plan) => {
    writes += 1;
    return { acceptedPlan: plan.schema };
  });
  assert.equal(receipt.acceptedPlan, "iat-b3-retained-v2-x-callback-write-plan/v1");
  assert.equal(writes, 1);
  await assert.rejects(
    boundary.runAuthorizedMutation(first.authorization, async () => { writes += 1; }),
    /INVALID_OR_CONSUMED/u,
  );
  await assert.rejects(
    boundary.runAuthorizedMutation({ ...first.authorization }, async () => { writes += 1; }),
    /INVALID_OR_CONSUMED/u,
  );
  assert.equal(writes, 1);
});

test("route source contains no legacy activation or reservation write escape hatch", () => {
  const route = readFileSync(new URL("../app/api/x/callback/route.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../app/api/x/callback/retained-v2-callback-handler.mjs", import.meta.url), "utf8");
  const boundary = readFileSync(new URL("../app/api/x/callback/retained-v2-runtime-boundary.mjs", import.meta.url), "utf8");
  for (const source of [route, handler]) {
    assert.doesNotMatch(source, /NODE_ACTIVATION_SQL|GENESIS_SLOT_RESERVATION_SQL|env\.DB\.batch|\.DB\.batch|\.run\(/u);
  }
  assert.match(route, /createRetainedV2CallbackHandler\(\{ runtimeEnv: env \}\)/u);
  assert.match(handler, /runtimeBoundary\.runAuthorizedMutation/u);
  assert.match(handler, /applyRetainedV2Write/u);
  assert.match(boundary, /RUNTIME_VERIFIERS_UNAVAILABLE/u);
  assert.match(boundary, /RUNTIME_EVIDENCE_REPLAYED/u);
  assert.match(boundary, /X_PREMIUM_UPGRADE_90/u);
});

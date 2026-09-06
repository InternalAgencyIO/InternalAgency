import {
  normalizedEligibleXAccountCreatedAt,
} from "../../../../engagement/node-binding-policy.mjs";
import {
  clearNodeSessionCookie,
  hashNodeSessionNonce,
  readNodeSessionCookie,
  verifyNodeSession,
} from "../../../../engagement/node-session.mjs";
import {
  pkceVerifier,
  verifyXOAuthState,
} from "../../../../engagement/x-oauth-state.mjs";
import {
  RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS,
  createRetainedV2CallbackRuntimeBoundary,
  isRetainedV2SubscriptionType,
} from "./retained-v2-runtime-boundary.mjs";

export const RETAINED_V2_CALLBACK_DEFAULT =
  "https://internalagency.io/api/x/callback";
export const RETAINED_V2_MUTATION_RECEIPT_SCHEMA =
  "iat-b3-retained-v2-x-callback-mutation-receipt/v1";

const allowedRedirectUris = new Set([RETAINED_V2_CALLBACK_DEFAULT]);
const defaultRuntimeBoundary = createRetainedV2CallbackRuntimeBoundary();
const MUTATION_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "atomicCommitVerified",
  "subjectBindingSha256",
  "writeAdapterSha256",
  "immediateTranchePersisted",
  "conditionalUpgradePersisted",
  "mutationReceiptSha256",
]);
const HEX_32 = /^[0-9a-f]{64}$/u;

function fail(code) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(
        `/rewards?binding=${encodeURIComponent(code)}`,
        "https://internalagency.io",
      ).toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function validDigest(value) {
  return typeof value === "string"
    && HEX_32.test(value)
    && !/^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value);
}

function validateMutationReceipt(receipt, writePlan) {
  if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)
    || JSON.stringify(Object.keys(receipt)) !== JSON.stringify(MUTATION_RECEIPT_KEYS)) {
    throw new Error("retained V2 mutation receipt keys are not exact");
  }
  if (receipt.schema !== RETAINED_V2_MUTATION_RECEIPT_SCHEMA
    || receipt.status !== "COMMITTED"
    || receipt.atomicCommitVerified !== true
    || receipt.subjectBindingSha256 !== writePlan.subjectBindingSha256
    || receipt.writeAdapterSha256 !== writePlan.writeAdapterSha256
    || receipt.immediateTranchePersisted !== true
    || receipt.conditionalUpgradePersisted !== (writePlan.conditionalUpgrade === null ? null : true)
    || !validDigest(receipt.mutationReceiptSha256)) {
    throw new Error("retained V2 mutation receipt does not prove the exact atomic write plan");
  }
  return receipt;
}

export function createRetainedV2CallbackHandler(options = {}) {
  const {
    runtimeEnv = Object.freeze({}),
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
    runtimeBoundary = defaultRuntimeBoundary,
    resolveRuntimeEvidence = null,
    applyRetainedV2Write = null,
  } = options;

  return async function retainedV2Callback(request) {
    // No environment switch, request flag, or caller-authored receipt can open
    // this route. Production wiring must provide all four trusted verifiers, a
    // read-only evidence resolver, and one exact atomic retained-V2 adapter.
    if (runtimeBoundary?.runtimeConfigured !== true
      || typeof resolveRuntimeEvidence !== "function"
      || typeof applyRetainedV2Write !== "function") {
      return fail("retained-v2-runtime-hold");
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const clientId = runtimeEnv.X_CLIENT_ID;
    const secret = runtimeEnv.X_OAUTH_STATE_SECRET;
    const sessionSecret = runtimeEnv.NODE_SESSION_SECRET;
    const redirectUri = runtimeEnv.X_OAUTH_REDIRECT_URI ?? RETAINED_V2_CALLBACK_DEFAULT;
    if (!code || !state || !clientId || !secret || !sessionSecret
      || !runtimeEnv.DB || !allowedRedirectUris.has(redirectUri)) {
      return fail("oauth-unavailable");
    }

    let payload;
    let session;
    try {
      payload = verifyXOAuthState({ state, secret });
    } catch {
      return fail("oauth-state-invalid");
    }
    try {
      session = verifyNodeSession({
        token: readNodeSessionCookie(request),
        secret: sessionSecret,
      });
    } catch {
      return fail("node-session-invalid");
    }
    if (payload.nodeId !== session.nodeId) return fail("oauth-session-mismatch");

    const observedAt = now();
    if (!(observedAt instanceof Date) || !Number.isFinite(observedAt.valueOf())) {
      return fail("runtime-clock-invalid");
    }
    const observedAtUtc = observedAt.toISOString();
    const eligible = await runtimeEnv.DB.prepare(
      "SELECT id FROM node_bindings WHERE id = ? AND wallet_address = ? AND state = 'pending' AND country_code IS NOT NULL AND session_nonce_hash = ? AND session_expires_at_utc >= ? AND oauth_nonce_hash = ? AND oauth_expires_at_utc >= ?",
    )
      .bind(
        session.nodeId,
        session.wallet,
        hashNodeSessionNonce(session.nonce),
        observedAtUtc,
        hashNodeSessionNonce(payload.nonce),
        observedAtUtc,
      )
      .first();
    if (!eligible) return fail("oauth-session-replayed");

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: pkceVerifier({ state, secret }),
    });
    let tokenResponse;
    try {
      tokenResponse = await fetchImpl("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      return fail("oauth-exchange-timeout");
    }
    let token;
    try {
      token = await tokenResponse.json();
    } catch {
      return fail("oauth-exchange-failed");
    }
    if (!tokenResponse.ok || typeof token?.access_token !== "string" || token.access_token.length === 0) {
      return fail("oauth-exchange-failed");
    }

    let profileResponse;
    try {
      profileResponse = await fetchImpl(
        "https://api.x.com/2/users/me?user.fields=created_at,subscription_type",
        {
          headers: { Authorization: `Bearer ${token.access_token}` },
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      return fail("oauth-profile-timeout");
    }
    let profile;
    try {
      profile = await profileResponse.json();
    } catch {
      return fail("oauth-profile-failed");
    }
    const xUserId = profile?.data?.id;
    const subscriptionType = profile?.data?.subscription_type;
    if (!profileResponse.ok || typeof xUserId !== "string") return fail("oauth-profile-failed");
    if (!isRetainedV2SubscriptionType(subscriptionType)) return fail("x-tier-unsupported");
    const xAccountCreatedAtUtc = normalizedEligibleXAccountCreatedAt(
      profile?.data?.created_at,
      observedAt,
    );
    if (!xAccountCreatedAtUtc) return fail("x-account-too-new");

    let runtimePacket;
    try {
      // Access tokens are intentionally excluded. The resolver may inspect the
      // request and provider response metadata, but its contract is read-only.
      runtimePacket = await resolveRuntimeEvidence({
        request,
        nodeId: session.nodeId,
        wallet: session.wallet,
        xUserId,
        xAccountCreatedAtUtc,
        subscriptionType,
        subscriptionObservedAtUtc: observedAtUtc,
        requestNonceSha256: hashNodeSessionNonce(payload.nonce),
        profileResponse,
      });
    } catch {
      return fail("retained-v2-runtime-evidence-unavailable");
    }

    const bindings = runtimePacket?.contextBindings;
    const authorization = await runtimeBoundary.authorize({
      context: {
        nodeId: session.nodeId,
        wallet: session.wallet,
        xUserId,
        xAccountCreatedAtUtc,
        subscriptionType,
        subscriptionObservedAtUtc: observedAtUtc,
        requestNonceSha256: hashNodeSessionNonce(payload.nonce),
        subjectBindingSha256: bindings?.subjectBindingSha256,
        localHeadSequence: bindings?.localHeadSequence,
        localHeadSha256: bindings?.localHeadSha256,
        writeAdapterId: bindings?.writeAdapterId,
        writeAdapterSha256: bindings?.writeAdapterSha256,
        nominalAmountBaseUnits: RETAINED_V2_GENESIS_NOMINAL_BASE_UNITS,
      },
      evidence: runtimePacket?.evidence,
      currentUnixSeconds: Math.floor(observedAt.valueOf() / 1_000).toString(),
    });
    if (authorization.ok !== true || authorization.writeAuthorized !== true) {
      return fail("retained-v2-runtime-precondition-hold");
    }

    try {
      const mutationReceipt = await runtimeBoundary.runAuthorizedMutation(
        authorization.authorization,
        async (writePlan) => validateMutationReceipt(
          await applyRetainedV2Write({ db: runtimeEnv.DB, writePlan }),
          writePlan,
        ),
      );
      const binding = authorization.authorization.writePlan.conditionalUpgrade === null
        ? "active-premium-full"
        : "active-base-10-upgrade-pending";
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL(`/rewards?binding=${binding}`, "https://internalagency.io").toString(),
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie": clearNodeSessionCookie(),
          "X-IAT-B3-Mutation-Receipt": mutationReceipt.mutationReceiptSha256,
        },
      });
    } catch {
      // The one-shot authorization is consumed before adapter invocation. An
      // ambiguous adapter response can never be automatically replayed.
      return fail("retained-v2-write-failed-hold");
    }
  };
}

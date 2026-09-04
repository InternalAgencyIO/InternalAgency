import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  ALLOWED_X_SUBSCRIPTION_TYPES,
  GENESIS_REWARD_BASE_UNITS,
  GENESIS_SLOT_RESERVATION_SQL,
  NODE_ACTIVATION_SQL,
  X_ACCOUNT_MINIMUM_AGE_MS,
  isAllowedXSubscriptionType,
  nextGenesisSlot,
  normalizedEligibleXAccountCreatedAt,
  premiumRevalidationDeadline,
} from "../engagement/node-binding-policy.mjs";
import {
  NODE_SESSION_COOKIE,
  clearNodeSessionCookie,
  hashNodeSessionNonce,
  issueNodeSession,
  nodeSessionCookie,
  readNodeSessionCookie,
  verifyNodeSession,
} from "../engagement/node-session.mjs";

const SECRET = "node-session-test-secret-that-is-at-least-32-characters";
const NODE_ID = "4b84ccdf-5d76-4b57-aee7-9b320da1af65";
const WALLET = "11111111111111111111111111111111";

test("node session is bound to node, wallet, nonce, expiry, and an HttpOnly host cookie", () => {
  const now = new Date("2026-08-02T00:00:00.000Z");
  const issued = issueNodeSession({ nodeId: NODE_ID, wallet: WALLET, secret: SECRET, now, nonce: "fixednonce0123456789abcdef" });
  const verified = verifyNodeSession({ token: issued.token, secret: SECRET, now });
  assert.equal(verified.nodeId, NODE_ID);
  assert.equal(verified.wallet, WALLET);
  assert.equal(hashNodeSessionNonce(verified.nonce).length, 64);
  assert.match(nodeSessionCookie(issued.token), new RegExp(`^${NODE_SESSION_COOKIE}=.*; Path=/; Secure; HttpOnly; SameSite=Lax$`));
  assert.match(clearNodeSessionCookie(), /Max-Age=0/);
  const request = new Request("https://internalagency.io/api/x/authorize", { headers: { Cookie: `other=1; ${NODE_SESSION_COOKIE}=${encodeURIComponent(issued.token)}` } });
  assert.equal(readNodeSessionCookie(request), issued.token);
});

test("node session rejects tampering, expiry, wrong wallet shape, and weak secrets", () => {
  const now = new Date("2026-08-02T00:00:00.000Z");
  const issued = issueNodeSession({ nodeId: NODE_ID, wallet: WALLET, secret: SECRET, now, ttlMs: 1_000, nonce: "fixednonce0123456789abcdef" });
  assert.throws(() => verifyNodeSession({ token: `${issued.token}x`, secret: SECRET, now }), /signature/);
  assert.throws(() => verifyNodeSession({ token: issued.token, secret: SECRET, now: new Date(now.valueOf() + 1_001) }), /expired/);
  assert.throws(() => issueNodeSession({ nodeId: NODE_ID, wallet: "not-a-wallet", secret: SECRET }), /base58|wallet/);
  assert.throws(() => issueNodeSession({ nodeId: NODE_ID, wallet: WALLET, secret: "weak" }), /32/);
});

test("only X Premium and PremiumPlus pass the Genesis subscription gate", () => {
  assert.deepEqual(ALLOWED_X_SUBSCRIPTION_TYPES, ["Premium", "PremiumPlus"]);
  for (const tier of ["Premium", "PremiumPlus"]) assert.equal(isAllowedXSubscriptionType(tier), true);
  for (const tier of [undefined, null, "", "None", "Basic", "premium", "VerifiedOrganization"]) assert.equal(isAllowedXSubscriptionType(tier), false);
  assert.equal(premiumRevalidationDeadline(new Date("2026-08-02T00:00:00.000Z")), "2026-08-03T00:00:00.000Z");
});

test("X account age is an inclusive exact 40-day anti-Sybil boundary", () => {
  const observedAt = new Date("2026-08-02T00:00:00.000Z");
  assert.equal(X_ACCOUNT_MINIMUM_AGE_MS, 40 * 24 * 60 * 60_000);
  assert.equal(
    normalizedEligibleXAccountCreatedAt(new Date(observedAt.valueOf() - X_ACCOUNT_MINIMUM_AGE_MS), observedAt),
    "2026-06-23T00:00:00.000Z",
  );
  assert.equal(normalizedEligibleXAccountCreatedAt(new Date(observedAt.valueOf() - X_ACCOUNT_MINIMUM_AGE_MS + 1), observedAt), null);
  assert.equal(normalizedEligibleXAccountCreatedAt("not-a-date", observedAt), null);
});

test("the pure Genesis boundary permits slot 1000 and permanently rejects 1001", () => {
  assert.equal(nextGenesisSlot(0), 1);
  assert.equal(nextGenesisSlot(999), 1_000);
  assert.equal(nextGenesisSlot(1_000), null);
  assert.throws(() => nextGenesisSlot(-1));
});

test("the activation-first SQL gives exactly 1,000 slots and safely activates completion 1,001 without a gift", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../engagement/binding-ledger.schema.sql", import.meta.url), "utf8"));
  const addBinding = db.prepare("INSERT INTO node_bindings (id, wallet_address, country_code, state, session_nonce_hash, session_expires_at_utc, oauth_nonce_hash, oauth_expires_at_utc, created_at_utc) VALUES (?, ?, 'TR', 'pending', 'session', '2026-08-03T00:00:00.000Z', 'oauth', '2026-08-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z')");
  const activate = db.prepare(NODE_ACTIVATION_SQL);
  const reserve = db.prepare(GENESIS_SLOT_RESERVATION_SQL);
  const complete = (index, xUserId = `x-${index}`) => {
    const nodeId = `node-${index}`;
    const wallet = `wallet-${index}`;
    const nowUtc = "2026-08-02T00:00:00.000Z";
    db.exec("BEGIN IMMEDIATE");
    try {
      const activation = activate.run(xUserId, "2026-06-01T00:00:00.000Z", "Premium", nowUtc, "2026-08-03T00:00:00.000Z", nowUtc, nodeId, wallet, "session", nowUtc, "oauth", nowUtc, xUserId);
      const reservation = reserve.run(GENESIS_REWARD_BASE_UNITS, nowUtc, nodeId, wallet, xUserId, nowUtc, nodeId);
      db.exec("COMMIT");
      return { activation, reservation };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  for (let index = 1; index <= 1_001; index += 1) addBinding.run(`node-${index}`, `wallet-${index}`);
  db.prepare("INSERT INTO node_bindings (id, wallet_address, x_user_id, country_code, state, created_at_utc) VALUES ('node-existing', 'wallet-existing', 'x-duplicate', 'TR', 'active', '2026-08-01T00:00:00.000Z')").run();
  const duplicate = complete(1, "x-duplicate");
  assert.equal(duplicate.activation.changes, 0);
  assert.equal(duplicate.reservation.changes, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM genesis_slots").get().count, 0);
  for (let index = 1; index <= 1_000; index += 1) {
    const result = complete(index);
    assert.equal(result.activation.changes, 1);
    assert.equal(result.reservation.changes, 1);
  }
  const overCapacity = complete(1_001);
  assert.equal(overCapacity.activation.changes, 1);
  assert.equal(overCapacity.reservation.changes, 0);
  assert.equal(db.prepare("SELECT state FROM node_bindings WHERE id = 'node-1001'").get().state, "active");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM genesis_slots WHERE node_binding_id = 'node-1001'").get().count, 0);
  const totals = db.prepare("SELECT COUNT(*) AS count, MIN(slot_number) AS min, MAX(slot_number) AS max, SUM(CAST(amount_base_units AS INTEGER)) AS total FROM genesis_slots").get();
  assert.equal(totals.count, 1_000);
  assert.equal(totals.min, 1);
  assert.equal(totals.max, 1_000);
  assert.equal(totals.total, 100_000_000_000_000);
  assert.throws(() => db.prepare("INSERT INTO genesis_slots VALUES (1001, 'node-1001', ?, ?, 'reserved', NULL, NULL)").run(GENESIS_REWARD_BASE_UNITS, "2026-08-02T00:00:00.000Z"), /CHECK constraint/);
  db.close();
});

test("route source eliminates UUID bearer authorization and isolates legacy writes behind the retained-V2 HOLD", () => {
  const verifyRoute = readFileSync(new URL("../app/api/nodes/verify-wallet/route.ts", import.meta.url), "utf8");
  const countryRoute = readFileSync(new URL("../app/api/nodes/select-country/route.ts", import.meta.url), "utf8");
  const authorizeRoute = readFileSync(new URL("../app/api/x/authorize/route.ts", import.meta.url), "utf8");
  const callbackRoute = readFileSync(new URL("../app/api/x/callback/route.ts", import.meta.url), "utf8");
  const callbackHandler = readFileSync(new URL("../app/api/x/callback/retained-v2-callback-handler.mjs", import.meta.url), "utf8");
  const runtimeBoundary = readFileSync(new URL("../app/api/x/callback/retained-v2-runtime-boundary.mjs", import.meta.url), "utf8");
  const bindingPolicy = readFileSync(new URL("../engagement/node-binding-policy.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(verifyRoute, /nodeId:\s*binding\?\.id/);
  assert.doesNotMatch(countryRoute, /input\.nodeId/);
  assert.doesNotMatch(authorizeRoute, /searchParams\.get\("nodeId"\)/);
  assert.match(countryRoute, /verifyNodeSession/);
  assert.match(authorizeRoute, /oauth_nonce_hash/);
  assert.match(callbackRoute, /createRetainedV2CallbackHandler/);
  assert.doesNotMatch(callbackRoute, /NODE_ACTIVATION_SQL|GENESIS_SLOT_RESERVATION_SQL|env\.DB\.batch/u);
  assert.match(callbackHandler, /user\.fields=created_at,subscription_type/);
  assert.match(callbackHandler, /isRetainedV2SubscriptionType/);
  assert.match(callbackHandler, /normalizedEligibleXAccountCreatedAt/);
  assert.match(callbackHandler, /x-account-too-new/);
  assert.match(callbackHandler, /runtimeBoundary\.runAuthorizedMutation/);
  assert.doesNotMatch(callbackHandler, /NODE_ACTIVATION_SQL|GENESIS_SLOT_RESERVATION_SQL|\.DB\.batch/u);
  assert.match(runtimeBoundary, /RUNTIME_VERIFIERS_UNAVAILABLE/);
  assert.match(runtimeBoundary, /X_PREMIUM_UPGRADE_90/);
  assert.match(bindingPolicy, /oauth_nonce_hash = NULL/);
  assert.doesNotMatch(`${callbackRoute}\n${callbackHandler}`, /[?&]node=/);
});

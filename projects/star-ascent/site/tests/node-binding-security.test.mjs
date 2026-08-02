import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  ALLOWED_X_SUBSCRIPTION_TYPES,
  GENESIS_REWARD_BASE_UNITS,
  GENESIS_SLOT_RESERVATION_SQL,
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

test("the production reservation SQL gives exactly one winner for the final slot and fixes the amount", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE node_bindings (id TEXT PRIMARY KEY NOT NULL, wallet_address TEXT NOT NULL UNIQUE, x_user_id TEXT UNIQUE, country_code TEXT, state TEXT NOT NULL, session_nonce_hash TEXT, session_expires_at_utc TEXT, oauth_nonce_hash TEXT, oauth_expires_at_utc TEXT)");
  const migration = readFileSync(new URL("../drizzle/0003_genesis_identity_hardening.sql", import.meta.url), "utf8");
  const createGenesis = migration.slice(migration.indexOf("CREATE TABLE `genesis_slots`"), migration.indexOf("ALTER TABLE `node_bindings`")).replaceAll("--> statement-breakpoint", "");
  db.exec(createGenesis);
  const addBinding = db.prepare("INSERT INTO node_bindings (id, wallet_address, country_code, state, session_nonce_hash, session_expires_at_utc, oauth_nonce_hash, oauth_expires_at_utc) VALUES (?, ?, 'TR', 'pending', 'session', '2026-08-03T00:00:00.000Z', 'oauth', '2026-08-03T00:00:00.000Z')");
  const reserve = db.prepare(GENESIS_SLOT_RESERVATION_SQL);
  for (let index = 1; index <= 1_001; index += 1) addBinding.run(`node-${index}`, `wallet-${index}`);
  db.prepare("INSERT INTO node_bindings (id, wallet_address, x_user_id, country_code, state) VALUES ('node-existing', 'wallet-existing', 'x-duplicate', 'TR', 'active')").run();
  db.exec("BEGIN IMMEDIATE");
  try {
    assert.equal(reserve.run(GENESIS_REWARD_BASE_UNITS, "2026-08-02T00:00:00.000Z", "node-1", "wallet-1", "wrong-session", "2026-08-02T00:00:00.000Z", "oauth", "2026-08-02T00:00:00.000Z", "x-1").changes, 0);
    assert.equal(reserve.run(GENESIS_REWARD_BASE_UNITS, "2026-08-02T00:00:00.000Z", "node-1", "wallet-1", "session", "2026-08-02T00:00:00.000Z", "oauth", "2026-08-02T00:00:00.000Z", "x-duplicate").changes, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM genesis_slots").get().count, 0);
    for (let index = 1; index <= 999; index += 1) {
      assert.equal(reserve.run(GENESIS_REWARD_BASE_UNITS, "2026-08-02T00:00:00.000Z", `node-${index}`, `wallet-${index}`, "session", "2026-08-02T00:00:00.000Z", "oauth", "2026-08-02T00:00:00.000Z", `x-${index}`).changes, 1);
    }
    assert.equal(reserve.run(GENESIS_REWARD_BASE_UNITS, "2026-08-02T00:00:00.000Z", "node-1000", "wallet-1000", "session", "2026-08-02T00:00:00.000Z", "oauth", "2026-08-02T00:00:00.000Z", "x-1000").changes, 1);
    assert.equal(reserve.run(GENESIS_REWARD_BASE_UNITS, "2026-08-02T00:00:00.000Z", "node-1001", "wallet-1001", "session", "2026-08-02T00:00:00.000Z", "oauth", "2026-08-02T00:00:00.000Z", "x-1001").changes, 0);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const totals = db.prepare("SELECT COUNT(*) AS count, MIN(slot_number) AS min, MAX(slot_number) AS max, SUM(CAST(amount_base_units AS INTEGER)) AS total FROM genesis_slots").get();
  assert.equal(totals.count, 1_000);
  assert.equal(totals.min, 1);
  assert.equal(totals.max, 1_000);
  assert.equal(totals.total, 100_000_000_000_000);
  assert.throws(() => db.prepare("INSERT INTO genesis_slots VALUES (1001, 'node-1001', ?, ?, 'reserved', NULL, NULL)").run(GENESIS_REWARD_BASE_UNITS, "2026-08-02T00:00:00.000Z"), /CHECK constraint/);
  db.close();
});

test("route source eliminates UUID bearer authorization and enforces one-time Premium activation", () => {
  const verifyRoute = readFileSync(new URL("../app/api/nodes/verify-wallet/route.ts", import.meta.url), "utf8");
  const countryRoute = readFileSync(new URL("../app/api/nodes/select-country/route.ts", import.meta.url), "utf8");
  const authorizeRoute = readFileSync(new URL("../app/api/x/authorize/route.ts", import.meta.url), "utf8");
  const callbackRoute = readFileSync(new URL("../app/api/x/callback/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(verifyRoute, /nodeId:\s*binding\?\.id/);
  assert.doesNotMatch(countryRoute, /input\.nodeId/);
  assert.doesNotMatch(authorizeRoute, /searchParams\.get\("nodeId"\)/);
  assert.match(countryRoute, /verifyNodeSession/);
  assert.match(authorizeRoute, /oauth_nonce_hash/);
  assert.match(callbackRoute, /user\.fields=created_at,subscription_type/);
  assert.match(callbackRoute, /isAllowedXSubscriptionType/);
  assert.match(callbackRoute, /normalizedEligibleXAccountCreatedAt/);
  assert.match(callbackRoute, /x-account-too-new/);
  assert.match(callbackRoute, /env\.DB\.batch/);
  assert.match(callbackRoute, /oauth_nonce_hash = NULL/);
  assert.doesNotMatch(callbackRoute, /[?&]node=/);
});

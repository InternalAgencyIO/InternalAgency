import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  GENESIS_REWARD_BASE_UNITS,
  GENESIS_SLOT_RESERVATION_SQL,
  NODE_ACTIVATION_SQL,
} from "../engagement/node-binding-policy.mjs";
import {
  issueXOAuthState,
  pkceChallenge,
  pkceVerifier,
  verifyXOAuthState,
} from "../engagement/x-oauth-state.mjs";

const NOW = "2026-08-02T00:00:00.000Z";
const EXPIRES = "2026-08-03T00:00:00.000Z";
const CREATED = "2026-06-01T00:00:00.000Z";
const STATE_SECRET = "credential-free-local-state-secret-32-characters-minimum";

const openLedger = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../engagement/binding-ledger.schema.sql", import.meta.url), "utf8"));
  return db;
};

const addPending = (db, id, wallet) => db.prepare(
  "INSERT INTO node_bindings (id, wallet_address, country_code, session_nonce_hash, session_expires_at_utc, oauth_nonce_hash, oauth_expires_at_utc, state, created_at_utc) VALUES (?, ?, 'TR', 'session-hash', ?, 'oauth-hash', ?, 'pending', ?)",
).run(id, wallet, EXPIRES, EXPIRES, NOW);

const complete = (db, { id, wallet, xUserId, now = NOW, reservationSql = GENESIS_SLOT_RESERVATION_SQL }) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const activation = db.prepare(NODE_ACTIVATION_SQL).run(
      xUserId,
      CREATED,
      "Premium",
      now,
      EXPIRES,
      now,
      id,
      wallet,
      "session-hash",
      now,
      "oauth-hash",
      now,
      xUserId,
    );
    const reservation = db.prepare(reservationSql).run(
      GENESIS_REWARD_BASE_UNITS,
      now,
      id,
      wallet,
      xUserId,
      now,
      id,
    );
    db.exec("COMMIT");
    return { activation, reservation };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

test("credential-free OAuth state is signed, expiring, PKCE-bound, and tamper evident", () => {
  const now = new Date(NOW);
  const state = issueXOAuthState({
    nodeId: "4b84ccdf-5d76-4b57-aee7-9b320da1af65",
    secret: STATE_SECRET,
    now,
    ttlMs: 1_000,
    nonce: "fixed-oauth-nonce-0123456789",
  });
  assert.equal(verifyXOAuthState({ state, secret: STATE_SECRET, now }).nonce, "fixed-oauth-nonce-0123456789");
  assert.equal(pkceChallenge(pkceVerifier({ state, secret: STATE_SECRET, now })).length, 43);
  assert.throws(() => verifyXOAuthState({ state: `${state}x`, secret: STATE_SECRET, now }), /signature/);
  assert.throws(() => verifyXOAuthState({ state, secret: STATE_SECRET, now: new Date(now.valueOf() + 1_001) }), /expired/);
});

test("PKCE S256 challenge matches the RFC 7636 appendix B vector", () => {
  assert.equal(
    pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});

test("a later D1-style statement failure rolls activation and nonce consumption back", () => {
  const db = openLedger();
  addPending(db, "rollback-node", "rollback-wallet");
  db.exec("CREATE TRIGGER fail_slot BEFORE INSERT ON genesis_slots BEGIN SELECT RAISE(ABORT, 'simulated-d1-write-failure'); END");
  assert.throws(
    () => complete(db, { id: "rollback-node", wallet: "rollback-wallet", xUserId: "rollback-x" }),
    /simulated-d1-write-failure/,
  );
  const binding = db.prepare("SELECT state, x_user_id, session_nonce_hash, oauth_nonce_hash FROM node_bindings WHERE id = 'rollback-node'").get();
  assert.equal(binding.state, "pending");
  assert.equal(binding.x_user_id, null);
  assert.equal(binding.session_nonce_hash, "session-hash");
  assert.equal(binding.oauth_nonce_hash, "oauth-hash");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM genesis_slots").get().count, 0);
  db.close();
});

test("duplicate immutable X identity and callback replay consume neither a second identity nor slot", () => {
  const db = openLedger();
  db.prepare("INSERT INTO node_bindings (id, wallet_address, x_user_id, country_code, state, created_at_utc, activated_at_utc) VALUES ('existing', 'existing-wallet', 'x-duplicate', 'TR', 'active', ?, ?)").run(NOW, NOW);
  addPending(db, "duplicate-node", "duplicate-wallet");
  const duplicate = complete(db, { id: "duplicate-node", wallet: "duplicate-wallet", xUserId: "x-duplicate" });
  assert.equal(duplicate.activation.changes, 0);
  assert.equal(duplicate.reservation.changes, 0);
  assert.equal(db.prepare("SELECT state FROM node_bindings WHERE id = 'duplicate-node'").get().state, "pending");

  addPending(db, "replay-node", "replay-wallet");
  const first = complete(db, { id: "replay-node", wallet: "replay-wallet", xUserId: "replay-x" });
  assert.equal(first.activation.changes, 1);
  assert.equal(first.reservation.changes, 1);
  const replay = complete(db, { id: "replay-node", wallet: "replay-wallet", xUserId: "replay-x", now: "2026-08-02T00:00:00.001Z" });
  assert.equal(replay.activation.changes, 0);
  assert.equal(replay.reservation.changes, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM genesis_slots WHERE node_binding_id = 'replay-node'").get().count, 1);
  assert.throws(
    () => db.prepare("INSERT INTO node_bindings (id, wallet_address, state, created_at_utc) VALUES ('wallet-duplicate', 'replay-wallet', 'pending', ?)").run(NOW),
    /UNIQUE constraint/,
  );
  db.close();
});

test("serialized final-slot contention yields one slot 1,000 winner and one active capacity result", () => {
  const db = openLedger();
  db.exec(`
    WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM seq WHERE n < 999)
    INSERT INTO node_bindings (id, wallet_address, x_user_id, country_code, state, created_at_utc, activated_at_utc)
    SELECT 'seed-' || n, 'seed-wallet-' || n, 'seed-x-' || n, 'TR', 'active', '${NOW}', '${NOW}' FROM seq;
    WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM seq WHERE n < 999)
    INSERT INTO genesis_slots (slot_number, node_binding_id, amount_base_units, reserved_at_utc, claim_status)
    SELECT n, 'seed-' || n, '${GENESIS_REWARD_BASE_UNITS}', '${NOW}', 'reserved' FROM seq;
  `);
  addPending(db, "final-a", "final-wallet-a");
  addPending(db, "final-b", "final-wallet-b");
  const winner = complete(db, { id: "final-a", wallet: "final-wallet-a", xUserId: "final-x-a" });
  const capacity = complete(db, { id: "final-b", wallet: "final-wallet-b", xUserId: "final-x-b", now: "2026-08-02T00:00:00.001Z" });
  assert.equal(winner.activation.changes, 1);
  assert.equal(winner.reservation.changes, 1);
  assert.equal(capacity.activation.changes, 1);
  assert.equal(capacity.reservation.changes, 0);
  const totals = db.prepare("SELECT COUNT(*) AS count, MAX(slot_number) AS max FROM genesis_slots").get();
  assert.equal(totals.count, 1_000);
  assert.equal(totals.max, 1_000);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM genesis_slots WHERE node_binding_id = 'final-a'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM genesis_slots WHERE node_binding_id = 'final-b'").get().count, 0);
  assert.equal(db.prepare("SELECT state FROM node_bindings WHERE id = 'final-b'").get().state, "active");
  db.close();
});

test("callback source keeps network deadlines but removes the legacy D1 writer without token retention", () => {
  const callback = readFileSync(new URL("../app/api/x/callback/route.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../app/api/x/callback/retained-v2-callback-handler.mjs", import.meta.url), "utf8");
  const boundary = readFileSync(new URL("../app/api/x/callback/retained-v2-runtime-boundary.mjs", import.meta.url), "utf8");
  const verifyWallet = readFileSync(new URL("../app/api/nodes/verify-wallet/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(`${callback}\n${handler}`, /NODE_ACTIVATION_SQL|GENESIS_SLOT_RESERVATION_SQL|\.DB\.batch/u);
  assert.match(callback, /createRetainedV2CallbackHandler/);
  assert.equal((handler.match(/AbortSignal\.timeout\(5_000\)/gu) ?? []).length, 2);
  assert.match(handler, /oauth-exchange-timeout/);
  assert.match(handler, /oauth-profile-timeout/);
  assert.match(handler, /runtimeBoundary\.runAuthorizedMutation/);
  assert.match(boundary, /RUNTIME_EVIDENCE_REPLAYED/);
  assert.doesNotMatch(handler, /console\.|access_token\s*=|INSERT[^\n]+access_token|UPDATE[^\n]+access_token/u);
  assert.match(verifyWallet, /LEFT JOIN genesis_slots/);
  assert.match(verifyWallet, /COALESCE\(genesis_slots\.slot_number, node_bindings\.genesis_slot\)/);
});

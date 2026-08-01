#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyFundingObservation,
  CEREMONY_FLOOR_LAMPORTS,
  fetchFinalizedBalance,
  OFFICIAL_MAINNET_RPC,
  PUBLIC_MAINNET_ADDRESS,
} from "./refresh-iat-v2-mainnet-funding-observation.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonical = JSON.parse(await readFile(
  path.join(siteRoot, "launch/iat-v2-mainnet-readiness-gate.json"),
  "utf8",
));

const sourceSnapshot = JSON.stringify(canonical);
const underfunded = applyFundingObservation(canonical, {
  lamports: "2500000000",
  contextSlot: "436000001",
  observedAtUtc: "2026-08-01T10:00:00Z",
});
assert.equal(JSON.stringify(canonical), sourceSnapshot, "pure refresh must not mutate its source");
assert.equal(underfunded.funding.publicAddress, PUBLIC_MAINNET_ADDRESS);
assert.equal(underfunded.funding.rpcEndpoint, OFFICIAL_MAINNET_RPC);
assert.equal(underfunded.funding.commitment, "finalized");
assert.equal(underfunded.funding.shortfallToCeremonyFloorLamports, "6000000000");
assert.equal(underfunded.funding.ceremonyFloorSatisfied, false);
assert.equal(underfunded.gates.mainnetFundingFloorSatisfied, false);
assert.equal(underfunded.status, "HOLD");
assert.ok(Object.values(underfunded.safety).every((value) => value === false));

const funded = applyFundingObservation(canonical, {
  lamports: CEREMONY_FLOOR_LAMPORTS.toString(),
  contextSlot: "436000002",
  observedAtUtc: "2026-08-01T10:01:00Z",
});
assert.equal(funded.funding.shortfallToCeremonyFloorLamports, "0");
assert.equal(funded.funding.shortfallToRentMinimumLamports, "0");
assert.equal(funded.funding.ceremonyFloorSatisfied, true);
assert.equal(funded.gates.mainnetFundingFloorSatisfied, true);
assert.equal(funded.status, "HOLD", "funding observation never lifts mainnet HOLD");
assert.equal(funded.schedule.state, "UNSCHEDULED_HOLD");

let requestedUrl;
let requestedOptions;
const fetched = await fetchFinalizedBalance(async (url, options) => {
  requestedUrl = url;
  requestedOptions = options;
  return {
    ok: true,
    async json() {
      return { result: { context: { slot: 436000005 }, value: 2_500_000_000 } };
    },
  };
});
assert.equal(requestedUrl, OFFICIAL_MAINNET_RPC);
assert.equal(requestedOptions.method, "POST");
assert.deepEqual(JSON.parse(requestedOptions.body), {
  jsonrpc: "2.0",
  id: 1,
  method: "getBalance",
  params: [PUBLIC_MAINNET_ADDRESS, { commitment: "finalized" }],
});
assert.equal(fetched.lamports, "2500000000");
assert.equal(fetched.contextSlot, "436000005");
assert.match(fetched.observedAtUtc, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);

await assert.rejects(
  fetchFinalizedBalance(async () => ({ ok: false, status: 503 })),
  /HTTP 503/u,
);
await assert.rejects(
  fetchFinalizedBalance(async () => ({
    ok: true,
    async json() { return { error: { code: -32000, message: "unavailable" } }; },
  })),
  /mainnet RPC error/u,
);
await assert.rejects(
  fetchFinalizedBalance(async () => ({
    ok: true,
    async json() { return { result: { context: { slot: 436000006 }, value: -1 } }; },
  })),
  /invalid balance/u,
);

for (const [label, mutate, pattern] of [
  ["address substitution", (gate) => { gate.funding.publicAddress = "11111111111111111111111111111111"; }, /unexpected public funding address/u],
  ["floor substitution", (gate) => { gate.funding.ceremonyFloorLamports = "8499999999"; }, /exactly 8500000000/u],
  ["unsafe record", (gate) => { gate.safety.signingPerformed = true; }, /unsafe side effect/u],
]) {
  const fixture = structuredClone(canonical);
  mutate(fixture);
  assert.throws(() => applyFundingObservation(fixture, {
    lamports: "2500000000",
    contextSlot: "436000003",
    observedAtUtc: "2026-08-01T10:02:00Z",
  }), pattern, label);
}

for (const [label, observation] of [
  ["negative balance", { lamports: "-1", contextSlot: "436000004", observedAtUtc: "2026-08-01T10:03:00Z" }],
  ["fractional balance", { lamports: "1.5", contextSlot: "436000004", observedAtUtc: "2026-08-01T10:03:00Z" }],
  ["zero slot", { lamports: "1", contextSlot: "0", observedAtUtc: "2026-08-01T10:03:00Z" }],
  ["noncanonical time", { lamports: "1", contextSlot: "436000004", observedAtUtc: "2026-08-01T10:03:00.000Z" }],
]) {
  assert.throws(() => applyFundingObservation(canonical, observation), undefined, label);
}

console.log("IAT V2 mainnet funding observation regression passed: read-only balance refresh is exact, fail-closed, and HOLD-preserving.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyLookup,
  decodePositionAccount,
  explorerUrl,
  PUBLIC_NETWORK_STATE,
} from "../app/network/network-state.mjs";

const apiSource = readFileSync(
  new URL("../app/api/network/route.ts", import.meta.url),
  "utf8",
);

test("network launch state is fail-closed until verified addresses are published", () => {
  assert.equal(PUBLIC_NETWORK_STATE.status, "HOLD");
  assert.equal(PUBLIC_NETWORK_STATE.cluster, "mainnet-beta");
  assert.equal(PUBLIC_NETWORK_STATE.mint, null);
  assert.equal(PUBLIC_NETWORK_STATE.programId, null);
  assert.equal(PUBLIC_NETWORK_STATE.genesisAtUtc, null);
});

test("network API is read-only, bounded, and has official RPC reads plus a public fallback", () => {
  assert.match(apiSource, /https:\/\/api\.mainnet\.solana\.com/);
  assert.match(apiSource, /https:\/\/api\.mainnet-beta\.solana\.com/);
  assert.match(apiSource, /https:\/\/solana-rpc\.publicnode\.com/);
  assert.match(apiSource, /process\.env\.SOLANA_RPC_URL/);
  assert.match(apiSource, /AbortSignal\.timeout\(5_000\)/);
  assert.match(apiSource, /RPC_ENDPOINTS_EXHAUSTED/);
  assert.doesNotMatch(apiSource, /sendTransaction|sendRawTransaction|signTransaction/);
});

test("read-only explorer classifies public addresses and signatures", () => {
  const address = "5Kg9jnaL4DuuT5Fr5surbexX8NeCiNpp4wKmi3Wp3C4H";
  const signature = "2ACnRs25wriFYYP7XBSaXWkCZUDAAxvg7SUf3SouQ5DgPctfn7wGTXwa81YYjo1JLUtsE7o3YbUMo16mmCTKAP75";
  assert.deepEqual(classifyLookup(address), { kind: "address", value: address });
  assert.deepEqual(classifyLookup(signature), { kind: "signature", value: signature });
  assert.equal(classifyLookup("not-a-solana-key").kind, "invalid");
  assert.equal(explorerUrl("address", address), `https://explorer.solana.com/address/${address}`);
  assert.equal(explorerUrl("signature", signature), `https://explorer.solana.com/tx/${signature}`);
});

test("position decoder exposes reviewed V2 fields without unsafe number coercion", () => {
  const bytes = new Uint8Array(168);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(72, 7n, true);
  view.setBigUint64(80, 123_456_789_012_345_678n, true);
  view.setBigUint64(112, 2_800n, true);
  view.setBigUint64(144, 987_654_321n, true);
  view.setUint32(160, 42, true);
  view.setUint8(164, 1);
  view.setUint8(165, 1);
  const encoded = Buffer.from(bytes).toString("base64");
  assert.deepEqual(decodePositionAccount(encoded), {
    positionId: "7",
    principalBaseUnits: "123456789012345678",
    acceptedWeek: "0",
    firstAccrualWeek: "0",
    termWeeks: "0",
    annualRateBps: "2800",
    treasuryReservedBaseUnits: "0",
    ecosystemReservedBaseUnits: "0",
    liquidityReservedBaseUnits: "0",
    paidBaseUnits: "987654321",
    settledMask: "0",
    agencyIndex: 42,
    role: 1,
    principalReturned: true,
    closed: false,
  });
});

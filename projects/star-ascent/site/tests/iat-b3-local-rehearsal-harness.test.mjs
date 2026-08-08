import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PublicKey } from "@solana/web3.js";

import {
  DRAW_DENOMINATOR,
  LAW_STATE_LEN,
  deriveSolanaDraw,
  matchesCustomError,
  packDecisionIntoLawState,
  parseLawState,
  protocolLocalDay,
} from "../scripts/iat-b3-local-rehearsal-driver.mjs";

const FRIDAY_BOUNDARY_UTC = 1_786_050_060n;
const MINT = new PublicKey(new Uint8Array(32).fill(0x22));
const NETWORK = Buffer.alloc(32, 0x11);

function emptyLawState() {
  const state = Buffer.alloc(LAW_STATE_LEN);
  Buffer.from("IATB3S01", "ascii").copy(state, 0);
  state[8] = 1;
  state[9] = 254;
  MINT.toBuffer().copy(state, 16);
  NETWORK.copy(state, 48);
  return state;
}

test("local rehearsal day arithmetic rolls at 00:01 with mathematical floor", () => {
  const friday = protocolLocalDay(FRIDAY_BOUNDARY_UTC);
  assert.equal(protocolLocalDay(FRIDAY_BOUNDARY_UTC - 1n), friday - 1n);
  assert.equal(protocolLocalDay(-10_741n), -1n);
  assert.equal(protocolLocalDay(-10_740n), 0n);
});

test("synthetic fixture decisions round-trip through the exact on-chain layout", () => {
  const decision = deriveSolanaDraw({
    ancestorSlotHash: Buffer.alloc(32, 0x33),
    localDay: 20_672n,
    entropySlot: 42_424_242n,
    networkGenesisHash: NETWORK,
    mint: MINT,
  });
  assert(decision.drawBucket >= 0n && decision.drawBucket < DRAW_DENOMINATOR);
  const packed = packDecisionIntoLawState(emptyLawState(), decision);
  const parsed = parseLawState(packed);
  assert(parsed.mint.equals(MINT));
  assert(parsed.networkGenesisHash.equals(NETWORK));
  assert.deepEqual(parsed.decision, decision);

  const forged = Buffer.from(packed);
  forged.writeUInt16LE((forged.readUInt16LE(136) + 1) % 10_000, 136);
  assert.notEqual(parseLawState(forged).decision.drawBucket, decision.drawBucket);
});

test("custom error recognition covers Solana log and structured forms", () => {
  assert.equal(matchesCustomError("custom program error: 0x7", 7), true);
  assert.equal(matchesCustomError("InstructionError(0, Custom(12))", 12), true);
  assert.equal(matchesCustomError("custom program error: 0x8", 7), false);
});

test("the wrapper is loopback-only, fail-closed, and owns disposable cleanup", async () => {
  const wrapper = await readFile(
    new URL("../scripts/run-iat-b3-local-rehearsal.sh", import.meta.url),
    "utf8",
  );
  assert.match(wrapper, /set -euo pipefail/u);
  assert.match(wrapper, /http:\/\/127\.0\.0\.1:/u);
  assert.match(wrapper, /trap finish EXIT/u);
  assert.match(wrapper, /rm -rf -- "\$temp_dir"/u);
  assert.match(wrapper, /set-upgrade-authority/u);
  assert.match(wrapper, /--final/u);
  assert.match(wrapper, /"status":"SKIP","reason":"tooling_missing"/u);
  assert.doesNotMatch(wrapper, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
});

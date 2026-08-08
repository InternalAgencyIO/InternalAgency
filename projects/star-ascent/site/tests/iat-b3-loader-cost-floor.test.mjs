import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const RENT_LAMPORTS_PER_ACCOUNT_BYTE = 6_960n;
const RENT_ACCOUNT_OVERHEAD_BYTES = 128n;
const LOADER_V4_STATE_BYTES = 48n;
const V2_OPTIMIZED_ELF_BYTES = 524_672n;
const B3_LAW_OPTIMIZED_ELF_BYTES = 141_824n;
const THREE_SOL_LAMPORTS = 3_000_000_000n;

function loaderV4PermanentLamports(elfBytes) {
  return (
    elfBytes + LOADER_V4_STATE_BYTES + RENT_ACCOUNT_OVERHEAD_BYTES
  ) * RENT_LAMPORTS_PER_ACCOUNT_BYTE;
}

test("optimistic loader-v4 rent still puts retained V2 plus B3 law above 3 SOL", () => {
  const v2 = loaderV4PermanentLamports(V2_OPTIMIZED_ELF_BYTES);
  const law = loaderV4PermanentLamports(B3_LAW_OPTIMIZED_ELF_BYTES);
  const aggregate = v2 + law;

  assert.equal(v2, 3_652_942_080n);
  assert.equal(law, 988_320_000n);
  assert.equal(aggregate, 4_641_262_080n);
  assert.ok(aggregate > THREE_SOL_LAMPORTS);
});

test("the cost document states the measured lower bound and refuses feature gutting", () => {
  const document = readFileSync(
    new URL("../docs/b3/COST_FEASIBILITY.md", import.meta.url),
    "utf8",
  );
  assert.match(document, /retained V2 \(`524,672` bytes\): `3\.65294208 SOL`/u);
  assert.match(document, /B3 Daily Law \(`141,824` bytes\): `0\.98832000 SOL`/u);
  assert.match(document, /both binaries alone: `4\.64126208 SOL`/u);
  assert.match(document, /3 SOL[^\n]+aggregate[^\n]+not achievable/iu);
  assert.match(document, /must not be gutted/u);
});

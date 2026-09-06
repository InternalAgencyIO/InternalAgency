import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const incident = readFileSync(
  "launch/IAT_V2_DEVNET_BUFFER_PARTIAL_UPLOAD_INCIDENT_20260828.md",
  "utf8",
);
const runbook = readFileSync(
  "launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md",
  "utf8",
);
const toolchain = readFileSync(
  "scripts/lib/iat-v2-attended-solana-toolchain.sh",
  "utf8",
);
const runtimeBinding = readFileSync(
  "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
  "utf8",
);

test("partial-buffer incident freezes the exact finalized observation and HOLD boundary", () => {
  for (const exact of [
    "DEVNET HOLD / FINALIZED PARTIAL BUFFER OBSERVED / REVIEWED ARTIFACT NOT PRESENT",
    "564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH",
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    "489440472",
    "BPFLoaderUpgradeab1e11111111111111111111111",
    "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4",
    "b93ff94d13fdd2c2ebe75af8630f70bfa3d59ab1578993a52377283edbf414ef",
    "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
    "payload bytes `[0, 19200)` match exactly",
    "payload bytes `[19200, 649680)` remain zero",
    "4,522,976,880` observed lamports (not a rent-exemption conclusion)",
  ]) {
    assert.ok(incident.includes(exact), `incident must retain exact evidence: ${exact}`);
  }
  assert.match(incident, /must not be rerun or resent/u);
  assert.match(incident, /partial-state hash[^\n]*incident evidence only/u);
  assert.match(incident, /new, separately reviewed, target-and-prestate-bound one-use in-place lane/u);
  assert.match(incident, /distinct crash-durable permanent CAS/u);
  assert.match(incident, /exact observed `\[19200, 649680\)` differing region/u);
  assert.match(incident, /7bc9c805218ca06769956e2cb61601329f5a0f6c/u);
  assert.match(incident, /supplied public buffer address selects `\(None, pubkey\)`/u);
  assert.match(incident, /skips matching chunks,[\s\S]*queues each differing chunk in full/u);
  assert.match(incident, /not evidence that the local executable completed any write/u);
  assert.match(incident, /raw-RPC account bytes establish finalized state only/u);
  assert.match(incident, /must never\s+create or close a buffer, access the protected signer/u);
  assert.match(incident, /No Trezor prompt, hardware signature, transaction signing, broadcast, or state\nmutation occurred during the signer-free reconciliation/u);
  assert.match(incident, /Mainnet was not accessed/u);
});

test("pinned Agave source audit remains aligned with the exact CLI and runtime closure", () => {
  const sourceCommit = "7bc9c805218ca06769956e2cb61601329f5a0f6c";
  for (const document of [incident, runbook]) {
    assert.ok(document.includes(sourceCommit));
  }
  assert.match(toolchain, /solana-cli 3\.1\.10 \(src:7bc9c805;/u);
  for (const runtimePath of [
    "launch/IAT_V2_DEVNET_BUFFER_PARTIAL_UPLOAD_INCIDENT_20260828.md",
    "launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md",
  ]) {
    assert.ok(runtimeBinding.includes(`"${runtimePath}"`));
  }
});

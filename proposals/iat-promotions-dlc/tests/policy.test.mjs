import assert from "node:assert/strict";
import test from "node:test";

import { loadPolicy, validatePolicy } from "../validate-policy.mjs";

const clone = (value) => structuredClone(value);

test("canonical draft policy passes", () => {
  assert.deepEqual(validatePolicy(loadPolicy()), []);
});

const mutations = [
  ["activation before eight hours", (p) => (p.activation.genesisOffsetSeconds = 1)],
  ["automatic activation", (p) => (p.activation.automatic = true)],
  ["Genesis inclusion", (p) => (p.status.partOfGenesis = true)],
  ["deployed status", (p) => (p.status.deployed = true)],
  ["claim route", (p) => (p.status.claimRoute = "https://example.invalid/claim")],
  ["network binding", (p) => (p.status.network = "MAINNET")],
  ["hero amount", (p) => (p.economics.heroRewardIat = 121)],
  ["proposer amount", (p) => (p.economics.proposerRewardIat = 61)],
  ["pair cap", (p) => (p.economics.maximumCompletedPairs = 1_001)],
  ["budget", (p) => (p.economics.maximumBudgetIat = 180_001)],
  ["V2 reward lane access", (p) => (p.economics.touchesV2RewardLanes = true)],
  ["non-atomic settlement", (p) => (p.economics.atomicPairedSettlement = false)],
  ["mandatory activation feature", (p) => (p.eligibility.optionalForNodeActivation = false)],
  ["hero impersonation", (p) => (p.eligibility.heroMustConnectIndependently = false)],
  ["handle-based identity", (p) => (p.eligibility.displayHandleControlsIdentity = true)],
  ["wallet self-proposal", (p) => (p.eligibility.rejectSelfProposalByWallet = false)],
  ["missing wallet dedupe", (p) => p.uniqueness.dimensionsPerRole.splice(1, 1)],
  ["pending capacity consumption", (p) => (p.capacity.pendingConsumesCapacity = true)],
  ["expired capacity consumption", (p) => (p.capacity.expiredConsumesCapacity = true)],
  ["reversible exhaustion", (p) => (p.capacity.exhaustedIsPermanent = false)],
  ["private identity publication", (p) => (p.publicEvidence.publishPrivateIdentityData = true)],
];

for (const [name, mutate] of mutations) {
  test(`rejects ${name}`, () => {
    const policy = clone(loadPolicy());
    mutate(policy);
    assert.ok(validatePolicy(policy).length > 0);
  });
}

test("rejects inconsistent base-unit arithmetic", () => {
  const policy = clone(loadPolicy());
  policy.economics.maximumBudgetBaseUnits = "180000000000001";
  assert.ok(validatePolicy(policy).some((error) => error.includes("budget")));
});

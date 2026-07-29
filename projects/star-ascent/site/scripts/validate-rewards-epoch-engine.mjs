import { readFileSync } from "node:fs";
import { buildEpoch, leafHash, policyHash, verifyProof } from "../engagement/epoch-engine.mjs";

const policy = JSON.parse(readFileSync("engagement/reward-policy.v1.json", "utf8"));
const fixture = JSON.parse(readFileSync("engagement/fixtures/genesis-eligible-nodes.example.json", "utf8"));
const epoch = buildEpoch({ ...fixture, policyHash: policyHash(policy), maximumClaims: policy.genesis.maximumClaims });

if (epoch.eligibleWalletCount !== 2) throw new Error("fixture must produce exactly two claimable nodes");
if (epoch.totalClaimableBaseUnits !== "200000000000") throw new Error("fixture total must equal 200 IAT in base units");
for (const claim of epoch.claims) {
  const leaf = leafHash({ epoch: epoch.epoch, wallet: claim.wallet, amountBaseUnits: claim.amountBaseUnits, policyHash: epoch.policyHash });
  if (!verifyProof({ leaf, proof: claim.merkleProof, root: epoch.merkleRoot })) throw new Error(`proof failed for ${claim.wallet}`);
}
console.log("OK: deterministic Genesis fixture creates two valid 100 IAT claims and a verifiable Merkle root.");

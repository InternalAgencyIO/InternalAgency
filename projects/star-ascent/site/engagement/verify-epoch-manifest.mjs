import { readFileSync } from "node:fs";
import { leafHash, verifyProof } from "./epoch-engine.mjs";

const path = process.argv[2];
if (!path) throw new Error("usage: node engagement/verify-epoch-manifest.mjs <manifest.json>");
const manifest = JSON.parse(readFileSync(path, "utf8"));
if (manifest.schema !== "star-ascent-reward-epoch/v1") throw new Error("unexpected manifest schema");
let total = 0n;
for (const claim of manifest.claims) {
  const leaf = leafHash({ epoch: manifest.epoch, wallet: claim.wallet, amountBaseUnits: claim.amountBaseUnits, policyHash: manifest.policyHash });
  if (leaf !== claim.leaf || !verifyProof({ leaf, proof: claim.merkleProof, root: manifest.merkleRoot })) throw new Error(`invalid proof for ${claim.wallet}`);
  total += BigInt(claim.amountBaseUnits);
}
if (total.toString() !== manifest.totalClaimableBaseUnits) throw new Error("claim total differs from manifest total");
console.log(`OK: ${manifest.eligibleWalletCount} claim proofs verify against ${manifest.merkleRoot}`);
console.log(`OK: total claimable base units ${manifest.totalClaimableBaseUnits}`);

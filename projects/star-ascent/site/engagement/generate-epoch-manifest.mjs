import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildEpoch, policyHash, sha256 } from "./epoch-engine.mjs";

const [inputPath, policyPath = "engagement/reward-policy.v1.json", outputPath = "engagement/out/epoch-manifest.json"] = process.argv.slice(2);
if (!inputPath) throw new Error("usage: node engagement/generate-epoch-manifest.mjs <eligible-rows.json> [policy.json] [output.json]");
const input = JSON.parse(readFileSync(inputPath, "utf8"));
const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const epoch = buildEpoch({ ...input, policyHash: policyHash(policy), maximumClaims: input.maximumClaims ?? policy.genesis.maximumClaims });
const manifest = { schema: "star-ascent-reward-epoch/v1", publishedAtUtc: new Date().toISOString(), ...epoch };
manifest.manifestDigest = sha256(JSON.stringify(manifest));
const target = resolve(outputPath);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Epoch manifest created: ${target}`);
console.log(`Merkle root: ${manifest.merkleRoot}`);
console.log(`Claimable wallets: ${manifest.eligibleWalletCount}`);

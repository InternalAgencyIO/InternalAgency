import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  REWARD_CAPACITY_POLICY_CANONICAL_SHA256,
  REWARD_CAPACITY_POLICY_FILE_SHA256,
  REWARD_LANE_ORDER,
  REWARD_PRIORITY_CLASSES,
  X_TRANCHE_KIND,
  canonicalJsonSha256,
  validateRewardCapacityPolicy,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";

const policyUrl = new URL("../docs/b3/iat-b3-reward-capacity-waterfall.v1.json", import.meta.url);
const bytes = await readFile(policyUrl);
let policy;
try {
  policy = JSON.parse(bytes.toString("utf8"));
} catch (error) {
  throw new Error(`Reward-capacity policy is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

validateRewardCapacityPolicy(policy);
const fileSha256 = createHash("sha256").update(bytes).digest("hex");
if (fileSha256 !== REWARD_CAPACITY_POLICY_FILE_SHA256) throw new Error("Reward-capacity policy file digest drifted");
if (canonicalJsonSha256(policy) !== REWARD_CAPACITY_POLICY_CANONICAL_SHA256) {
  throw new Error("Reward-capacity policy canonical digest drifted");
}

process.stdout.write(
  `PASS: non-activating B3 reward-capacity reference; classes=${REWARD_PRIORITY_CLASSES.join(">")}; lanes=${REWARD_LANE_ORDER.join(">")}; tranches=${Object.values(X_TRANCHE_KIND).join(",")}; sealed-capacity=true; sealed-ccc-registry=true; typed-round-state=true; recomputed-receipts=true; aggregate-faction=true; policy=${fileSha256}\n`,
);

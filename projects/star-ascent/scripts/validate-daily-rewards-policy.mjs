import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "engagement/reward-policy.v1.json";
const policy = JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const ok = (message) => console.log(`OK: ${message}`);

if (policy.schema !== "star-ascent-daily-rewards-policy/v1") fail("unexpected policy schema");
ok("policy schema");
if (policy.status !== "HOLD_UNTIL_X_AND_DISTRIBUTOR_GATES_PASS") fail("policy must remain HOLD until live integrations pass");
ok("HOLD gate is explicit");
if (policy.asset.symbol !== "IAT" || policy.asset.decimals !== 9 || policy.asset.network !== "mainnet-beta") fail("asset configuration must match the Genesis target");
ok("asset configuration matches Genesis target");
if (policy.genesis.rewardDisplayUnits !== 100 || !policy.genesis.onePerWallet || !policy.genesis.onePerXAccount) fail("Genesis reward must be exactly 100 IAT with one-to-one binding");
ok("Genesis reward is 100 IAT with one-to-one binding");
if (policy.daily.snapshotAtUtc !== "00:00" || policy.daily.claimOpenAtUtc !== "00:05") fail("daily UTC schedule must be 00:00 snapshot and 00:05 claims");
ok("daily UTC schedule");
if (!Number.isInteger(policy.daily.rewardDisplayUnits) || policy.daily.rewardDisplayUnits <= 0 || policy.daily.maximumQualifyingActionsPerEpoch !== 1) fail("daily reward must be positive and capped at one action per epoch");
ok("daily reward is capped");
if (policy.daily.excludedActions.includes("likes alone") && policy.daily.excludedActions.includes("reposts alone")) ok("low-signal actions are excluded"); else fail("likes and reposts alone must not qualify");
if (policy.distribution.model.includes("Merkle-proof claim") && policy.distribution.payer.includes("Dedicated distributor")) ok("claim model isolates the distribution wallet"); else fail("claim model must isolate distribution wallet");
if (!policy.disclosure.toLowerCase().includes("not yield") || !policy.disclosure.toLowerCase().includes("not interest")) fail("reward disclosure must reject yield and interest framing");
ok("reward disclosure");
console.log("DAILY REWARDS POLICY VALID: configuration is internally consistent. X collection, OAuth binding, Merkle generation, and distributor operations remain separate live gates.");

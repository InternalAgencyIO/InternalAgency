#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";

const policyPath = "engagement/iat-economic-policy.v2.json";
const planPath = "launch/iat-v2-allocation-plan.template.json";
const rehearsalPath = "launch/iat-v2-devnet-rehearsal.template.json";
const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const rehearsal = JSON.parse(readFileSync(rehearsalPath, "utf8"));
const programSource = readFileSync("programs/iat_v2/src/lib.rs", "utf8");
const policySource = readFileSync("programs/iat_v2/src/policy.rs", "utf8");
const randomnessAdapterSource = readFileSync(
  "programs/iat_v2/src/switchboard_randomness.rs",
  "utf8",
);
const anchorSource = readFileSync("Anchor.toml", "utf8");
const normalizedAnchorSource = anchorSource.replaceAll("\r\n", "\n");
const cargoSource = readFileSync("programs/iat_v2/Cargo.toml", "utf8");
const cargoLockSource = readFileSync("Cargo.lock", "utf8");
const mintPageSource = readFileSync("app/mint/page.tsx", "utf8");
const launchPageSource = readFileSync("app/launch/page.tsx", "utf8");
const homePageSource = readFileSync("app/page.tsx", "utf8");
const tokenomicsPageSource = readFileSync("app/tokenomics/page.tsx", "utf8");
const rehearsalRunbookSource = readFileSync("launch/DEVNET_REHEARSAL_SCENARIO.md", "utf8");
const returnChecklistSource = readFileSync("launch/RETURN_CHECKLIST_30_MINUTES.md", "utf8");
const failures = [];
const fail = (message) => failures.push(message);
const expectedAmounts = {
  community: "500000000000000000",
  treasury: "200000000000000000",
  ecosystem: "150000000000000000",
  coreTeam: "100000000000000000",
  liquidity: "50000000000000000",
};
const expectedBeneficiaries = {
  community: "5Kg9jnaL4DuuT5Fr5surbexX8NeCiNpp4wKmi3Wp3C4H",
  treasury: "CucS4oym18YjEMUmXYVx45q6HUGhW35wE3qpwkcnSCFQ",
  ecosystem: "HypAfe9RwaBRnZeLpqvYU1rBbAwHTSBnm24enRL6Qx18",
  coreTeam: "2yBK1NkeUoTToE4cfz33WRckho4Qr2BV1ZtCTrw3AHyB",
  liquidity: "2d41i3afUpWuo2LqpuKao5D1ToEU88aBokiQ3z8HQtPC",
};
const expectedSchedules = {
  treasury: ["50000000000000000", 52, 208],
  ecosystem: ["37500000000000000", 26, 104],
  coreTeam: ["0", 26, 104],
  liquidity: ["12500000000000000", 26, 104],
};
const usableAddress = (value) => {
  try {
    return typeof value === "string" && new PublicKey(value).toBytes().length === 32;
  } catch {
    return false;
  }
};
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

if (policy.schema !== "iat-economic-policy/v2") fail("policy schema must be iat-economic-policy/v2");
if (policy.status !== "HOLD_UNTIL_PROGRAM_REVIEW_AND_MATCHING_DEVNET_REHEARSAL") fail("V2 policy must remain HOLD");
if (policy.networkTarget !== "mainnet-beta") fail("policy network target must be mainnet-beta");
if (policy.token.programId !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") fail("policy must use the Original SPL Token Program");
if (policy.token.decimals !== 9) fail("policy decimals must be 9");
if (policy.token.fixedSupplyBaseUnits !== "1000000000000000000") fail("policy fixed supply is incorrect");
if (policy.token.mint !== null) {
  fail("HOLD policy cannot assert an unverified live mint");
}
if (policy.time.secondsPerWeek !== 604800 || policy.time.userPositionTermWeeks !== 52 || policy.time.coreRewardTermWeeks !== 104) {
  fail("canonical weekly timing is incorrect");
}
if (JSON.stringify(policy.time.monthToWeekConvention) !== JSON.stringify({ "6Months": 26, "12Months": 52, "24Months": 104, "36Months": 156 })) {
  fail("month-to-week convention is incorrect");
}
if (JSON.stringify(policy.rewardReserve.orderedLanes) !== JSON.stringify(["treasury", "ecosystem", "liquidity"])) {
  fail("reward lane order must be treasury, ecosystem, liquidity");
}
if (!policy.rewardReserve.mayReachZero || policy.rewardReserve.rewardDebtAllowed) fail("reserve exhaustion and no-debt rules are incorrect");
if (JSON.stringify(policy.rates) !== JSON.stringify({
  denominatorBasisPoints: 10000,
  weeksPerRateYear: 52,
  automaticCompounding: false,
  coreTeam: 1700,
  standard: 1000,
  cccAgent: 2800,
  cccAssociate: 2000,
})) fail("canonical simple annual rates are incorrect");
if (!policy.program.noOperatorReroll || policy.ccc.operatorReroll) fail("CCC draw must prohibit operator rerolls");
if (policy.ccc.firstSelectionDelaySeconds !== 86400 || policy.ccc.frequencyWeeks !== 1) {
  fail("CCC selection must open 24 hours after Genesis and then advance every seven days");
}
if (
  policy.tieResolution.scope !== "DEFAULT_FOR_EVERY_PROTOCOL_DECISION_WITH_TWO_OR_MORE_EXACTLY_EQUAL_CANDIDATES"
  || policy.tieResolution.oracleRolls !== 1
  || policy.tieResolution.mapping !== "SHA256_DOMAIN_SEPARATED_COUNTER_EXPANSION_WITH_EXACT_UNIFORM_REJECTION_SAMPLING"
  || policy.tieResolution.operatorReroll
  || !policy.tieResolution.resultFinal
  || !policy.tieResolution.candidateSnapshotHashRequired
  || policy.tieResolution.maximumCandidateCount !== 0xffff_ffff
) {
  fail("universal one-roll tiebreak policy is incorrect");
}
if (
  policy.ccc.winnerMapping
    !== "UNIVERSAL_EXACT_UNIFORM_ONE_ROLL_TIEBREAK_OVER_CANONICAL_AGENCY_SNAPSHOT"
) {
  fail("CCC selection must use the universal tiebreak method");
}

const allocationTotal = Object.values(policy.allocations)
  .reduce((sum, allocation) => sum + BigInt(allocation.baseUnitAmount), 0n);
if (allocationTotal !== 1_000_000_000_000_000_000n) fail("policy allocations do not total fixed supply");
const reserveTotal = policy.rewardReserve.orderedLanes
  .reduce((sum, lane) => sum + BigInt(policy.allocations[lane].baseUnitAmount), 0n);
if (reserveTotal !== 400_000_000_000_000_000n) fail("reward reserve does not total 400M IAT");
const genesisUnlocked = policy.rewardReserve.orderedLanes
  .reduce((sum, lane) => sum + BigInt(policy.allocations[lane].genesisUnlockedBaseUnits), 0n);
if (genesisUnlocked !== 100_000_000_000_000_000n) fail("Genesis unlocked reward capacity does not total 100M IAT");

for (const [name, amount] of Object.entries(expectedAmounts)) {
  if (policy.allocations[name]?.baseUnitAmount !== amount) fail(`policy ${name} amount is incorrect`);
  if (plan.allocations?.[name]?.baseUnitAmount !== amount) fail(`allocation plan ${name} amount is incorrect`);
  if (plan.allocations?.[name]?.beneficiary !== expectedBeneficiaries[name]) fail(`allocation plan ${name} beneficiary is incorrect`);
}
for (const [name, [unlocked, cliff, end]] of Object.entries(expectedSchedules)) {
  const policyAllocation = policy.allocations[name];
  const planAllocation = plan.allocations[name];
  for (const [label, allocation] of [["policy", policyAllocation], ["plan", planAllocation]]) {
    if (allocation.genesisUnlockedBaseUnits !== unlocked || allocation.cliffWeek !== cliff || allocation.linearEndWeek !== end) {
      fail(`${label} ${name} vesting schedule is incorrect`);
    }
  }
}

for (const address of [
  policy.publicRoles.programAdmin,
  policy.publicRoles.communityCustody,
  policy.publicRoles.treasuryBeneficiary,
  policy.publicRoles.ecosystemBeneficiary,
  policy.publicRoles.coreTeamBeneficiary,
  policy.publicRoles.liquidityBeneficiary,
  policy.publicRoles.publicationOperator,
  policy.publicRoles.independentVerifier.address,
]) {
  if (!usableAddress(address)) fail(`invalid public role address ${address}`);
}
if (new Set(Object.values(expectedBeneficiaries)).size !== 5) fail("beneficiaries must be distinct");
if (plan.schema !== "iat-v2-allocation-plan/v1" || plan.status !== "HOLD") fail("allocation plan must remain canonical HOLD v1");
if (plan.policyPath !== policyPath) fail("allocation plan must bind the canonical policy path");
if (plan.mint !== null) {
  fail("HOLD allocation plan cannot assert a live mint");
}
if (Object.values(plan.activationEvidence).some((value) => Array.isArray(value) ? value.length > 0 : value !== null && value !== expectedBeneficiaries.community && value !== policy.publicRoles.independentVerifier.address)) {
  fail("HOLD allocation plan contains premature activation evidence");
}
if (rehearsal.schema !== "iat-v2-devnet-rehearsal/v1" || rehearsal.status !== "PLANNED" || rehearsal.network !== "devnet") {
  fail("V2 rehearsal must remain PLANNED on devnet");
}
if (rehearsal.safety.mainnetTransactionsAllowed || rehearsal.safety.automaticWalletSignaturesAllowed || rehearsal.safety.secretsAllowedInRepositoryOrEvidence) {
  fail("V2 rehearsal safety boundary is incorrect");
}
if (rehearsal.toolchain.compatibilityStatus !== "HOST_TESTS_PASS_BPF_AND_DEVNET_PENDING") {
  fail("randomness adapter status must distinguish host tests from pending BPF and devnet evidence");
}
if (rehearsal.sources.policyPath !== policyPath || rehearsal.sources.allocationPlanPath !== planPath) {
  fail("V2 rehearsal source paths are not canonical");
}
if (rehearsal.sources.policySha256 !== null || rehearsal.sources.allocationPlanSha256 !== null || rehearsal.sources.programSha256 !== null) {
  fail("PLANNED rehearsal cannot assert completed source digests");
}
if (rehearsal.requiredScenarios.length !== new Set(rehearsal.requiredScenarios).size || rehearsal.requiredScenarios.length < 14) {
  fail("V2 rehearsal scenarios must be unique and complete");
}
const sentinelProgramId = "6T8qyz4ZSEK8x72hTK1c8rqvEfUX6zGbUsHDUUjpw6tY";
const switchboardMainnetProgramId = "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv";
const declaredProgramMatch = programSource.match(/declare_id!\("([^"]+)"\)/);
const declaredProgramId = declaredProgramMatch?.[1];
if (!usableAddress(declaredProgramId)) fail("Rust declare_id must contain one usable public program ID");
for (const cluster of ["localnet", "devnet", "mainnet"]) {
  if (!normalizedAnchorSource.includes(`[programs.${cluster}]\niat_v2 = "${declaredProgramId}"`)) {
    fail(`Anchor.toml ${cluster} program ID must match Rust declare_id`);
  }
}
if (declaredProgramId === sentinelProgramId) {
  if (policy.program.programId !== null || plan.program.programId !== null) {
    fail("sentinel source requires empty policy and allocation-plan program IDs");
  }
  if (policy.program.randomnessProgramId !== null || plan.program.randomnessProgramId !== null) {
    fail("sentinel source requires empty policy and allocation-plan randomness IDs");
  }
} else {
  if (policy.program.programId !== declaredProgramId || plan.program.programId !== declaredProgramId) {
    fail("bound Rust, policy, and allocation-plan program IDs must match");
  }
  if (
    policy.program.randomnessProgramId !== switchboardMainnetProgramId
    || plan.program.randomnessProgramId !== switchboardMainnetProgramId
  ) {
    fail("bound mainnet policy artifacts must pin the official Switchboard program ID");
  }
}

for (const fragment of [
  "pub const RANDOMNESS_ADAPTER_VERIFIED: bool = true;",
  "RANDOMNESS_ADAPTER_VERIFIED,",
  "parse_randomness(&data)",
  "validate_commit_instruction(",
  "load_current_index_checked",
  "ccc_round_for(&ctx.accounts.config)?",
  "IatV2Error::CccSelectionNotOpen",
  "position_maturity_week(",
  "IatV2Error::RandomnessCommitNotFresh",
  "IatV2Error::RandomnessCommitInstructionMissing",
  "IatV2Error::InvalidRandomnessCommitInstruction",
  "IatV2Error::RandomnessNotFresh",
  "IatV2Error::RandomnessCommitSlotMismatch",
  "IatV2Error::RoundAlreadySettled",
  "PROGRAM_ADMIN",
  "COMMUNITY_CUSTODY",
  "TREASURY_BENEFICIARY",
  "ECOSYSTEM_BENEFICIARY",
  "CORE_BENEFICIARY",
  "LIQUIDITY_BENEFICIARY",
  "MintAuthorityNotRevoked",
  "FreezeAuthorityNotRevoked",
  "InsufficientUnlockedRewardCapacity",
  "uniform_tiebreak_outcome",
  "derivation_counter",
  "agency_registry_hash_snapshot",
]) {
  if (!programSource.includes(fragment)) fail(`program source is missing fail-closed control ${JSON.stringify(fragment)}`);
}
for (const fragment of [
  "Switchboard On-Demand 0.13.0 mainnet program ID",
  "Switchboard On-Demand 0.13.0 devnet program ID",
  "pub const RANDOMNESS_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];",
  "pub const RANDOMNESS_COMMIT_DISCRIMINATOR: [u8; 8] =",
  "pub const RANDOMNESS_ACCOUNT_SIZE: usize = 408;",
  "const SEED_SLOT_START: usize = 104;",
  "const REVEAL_SLOT_START: usize = 144;",
  "const VALUE_START: usize = 152;",
  "data.len() < RANDOMNESS_ACCOUNT_SIZE",
  "is_fresh_unrevealed_commit",
  "commit_instruction_must_be_exact_and_atomic",
  "program_id_constants_match_the_published_addresses",
]) {
  if (!randomnessAdapterSource.includes(fragment)) {
    fail(`Switchboard ABI adapter is missing ${JSON.stringify(fragment)}`);
  }
}
if (cargoSource.includes("switchboard-on-demand")) {
  fail("the on-chain crate must not import Switchboard's off-chain client dependency graph");
}
for (const fragment of [
  "pub const MAINNET_SUPPLY: u64 = 1_000_000_000_000_000_000;",
  "pub const CCC_FIRST_SELECTION_DELAY_SECONDS: i64 = SECONDS_PER_DAY;",
  "pub fn current_ccc_round(",
  "pub const REHEARSAL_SUPPLY: u64 = 1_000_000_000_000;",
  "pub const USER_TERM_WEEKS: u64 = 52;",
  "pub const CORE_TERM_WEEKS: u64 = 104;",
  "pub const CORE_RATE_BPS: u64 = 1_700;",
  "pub const STANDARD_RATE_BPS: u64 = 1_000;",
  "pub const CCC_AGENT_RATE_BPS: u64 = 2_800;",
  "pub const CCC_ASSOCIATE_RATE_BPS: u64 = 2_000;",
  'pub const TIEBREAK_DOMAIN: &[u8] = b"IAT_TIEBREAK_V1";',
  "pub fn uniform_tiebreak_outcome(",
  "pub fn uniform_tiebreak_index(",
]) {
  if (!policySource.includes(fragment)) fail(`Rust policy source is missing ${JSON.stringify(fragment)}`);
}
if (!cargoSource.includes('anchor-lang = { version = "=1.0.2", features = ["init-if-needed"] }')
  || !cargoSource.includes('anchor-spl = "=1.0.2"')
  || !cargoSource.includes('solana-instructions-sysvar = "=3.0.1"')
  || !cargoSource.includes('solana-sha256-hasher = { version = "=3.1.0", features = ["sha2"] }')) {
  fail("Anchor and Solana program dependencies must remain exactly pinned");
}
for (const [crate, version] of [
  ["anchor-attribute-access-control", "1.0.2"],
  ["anchor-attribute-account", "1.0.2"],
  ["anchor-attribute-constant", "1.0.2"],
  ["anchor-attribute-error", "1.0.2"],
  ["anchor-attribute-event", "1.0.2"],
  ["anchor-attribute-program", "1.0.2"],
  ["anchor-derive-accounts", "1.0.2"],
  ["anchor-derive-serde", "1.0.2"],
  ["anchor-derive-space", "1.0.2"],
  ["anchor-lang", "1.0.2"],
  ["anchor-spl", "1.0.2"],
  ["anchor-syn", "1.0.2"],
  ["solana-instructions-sysvar", "3.0.1"],
  ["solana-sha256-hasher", "3.1.0"],
]) {
  const escapedCrate = crate.replaceAll("-", "\\-");
  const escapedVersion = version.replaceAll(".", "\\.");
  const lockedPackage = new RegExp(
    `\\[\\[package\\]\\]\\r?\\nname = "${escapedCrate}"\\r?\\nversion = "${escapedVersion}"(?:\\r?\\n|$)`,
  );
  if (!lockedPackage.test(cargoLockSource)) {
    fail(`Cargo.lock must resolve ${crate} exactly to ${version}`);
  }
}

for (const fragment of [
  "const V2_MINT_ONLY_PATH_SUPERSEDED = true;",
  "SUPERSEDED // DO NOT SIGN",
  "disabled={V2_MINT_ONLY_PATH_SUPERSEDED}",
  "The old four-transaction builder cannot initialize or fund the IAT V2",
  "It has no wallet provider, signer, transaction builder, or",
]) {
  if (!mintPageSource.includes(fragment)) {
    fail(`mint route is missing V2 fail-closed control ${JSON.stringify(fragment)}`);
  }
}
for (const forbidden of [
  "@solana/web3.js",
  "@solana/spl-token",
  "window.backpack",
  "signTransaction",
  "sendRawTransaction",
]) {
  if (mintPageSource.includes(forbidden)) {
    fail(`mint route still contains disabled signing dependency ${JSON.stringify(forbidden)}`);
  }
}
if (
  !launchPageSource.includes("V2 PROGRAM REHEARSAL")
  || !homePageSource.includes("V2 program rehearsal")
  || !tokenomicsPageSource.includes("HOST-TESTED · NOT DEPLOYED · MAINNET HOLD")
) {
  fail("public launch surfaces do not state the V2 rehearsal and HOLD status");
}
for (const source of [launchPageSource, homePageSource]) {
  if (/Run the exact four-transaction|exact four-transaction path must complete/i.test(source)) {
    fail("an active public launch surface still instructs the superseded mint-only ceremony");
  }
}
for (const [path, source] of [
  ["launch/DEVNET_REHEARSAL_SCENARIO.md", rehearsalRunbookSource],
  ["launch/RETURN_CHECKLIST_30_MINUTES.md", returnChecklistSource],
]) {
  for (const fragment of [
    "The old `/mint`",
    "Deploy the program **unfunded**",
    "transfer upgrade authority",
    "mainnet `HOLD`",
  ]) {
    if (!source.toLowerCase().includes(fragment.toLowerCase())) {
      fail(`${path} is missing V2 rehearsal boundary ${JSON.stringify(fragment)}`);
    }
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(`IAT V2 policy gate passes in HOLD. policySha256=${digest(policyPath)} planSha256=${digest(planPath)}. No deployment or transaction is authorized.`);

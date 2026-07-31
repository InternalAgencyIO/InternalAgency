import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const policyPath = fileURLToPath(new URL("./promotion-policy.v0.json", import.meta.url));

export function validatePolicy(policy) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  expect(policy?.schemaVersion === 0, "schemaVersion must remain 0 for this draft");
  expect(policy?.proposalId === "iat-promotions-dlc-v0", "unexpected proposalId");

  const status = policy?.status ?? {};
  expect(status.draft === true, "status.draft must be true");
  expect(status.active === false, "status.active must be false");
  expect(status.partOfGenesis === false, "status.partOfGenesis must be false");
  expect(status.deployed === false, "status.deployed must be false");
  expect(status.claimRoute === null, "status.claimRoute must be null");
  expect(status.network === "NONE", "status.network must be NONE");

  const activation = policy?.activation ?? {};
  expect(activation.genesisOffsetSeconds === 28_800, "activation floor must be eight hours");
  expect(activation.automatic === false, "activation must not be automatic");
  expect(activation.requiresVerifiedMainnetGenesis === true, "verified mainnet Genesis is required");
  expect(activation.requiresSeparateReview === true, "separate review is required");
  expect(activation.requiresSeparateFunding === true, "separate funding is required");
  expect(activation.requiresExplicitActivationTransaction === true, "explicit activation is required");

  const economics = policy?.economics ?? {};
  expect(economics.mintDecimals === 9, "mint decimals must be nine");
  expect(economics.heroRewardIat === 120, "hero reward must be 120 IAT");
  expect(economics.proposerRewardIat === 60, "proposer reward must be 60 IAT");
  expect(economics.pairRewardIat === 180, "pair reward must be 180 IAT");
  expect(economics.maximumCompletedPairs === 1_000, "pair cap must be 1,000");
  expect(economics.maximumHeroRewards === 1_000, "hero cap must be 1,000");
  expect(economics.maximumProposerRewards === 1_000, "proposer cap must be 1,000");
  expect(economics.maximumBudgetIat === 180_000, "budget must be 180,000 IAT");
  expect(economics.heroRewardBaseUnits === "120000000000", "hero base units mismatch");
  expect(economics.proposerRewardBaseUnits === "60000000000", "proposer base units mismatch");
  expect(economics.pairRewardBaseUnits === "180000000000", "pair base units mismatch");
  expect(economics.maximumBudgetBaseUnits === "180000000000000", "budget base units mismatch");
  expect(
    economics.fundingSource === "COMMUNITY_ALLOCATION_SEPARATE_PROMOTION_VAULT",
    "funding source must be the isolated community promotion vault",
  );
  expect(economics.touchesV2RewardLanes === false, "proposal must not touch V2 reward lanes");
  expect(economics.atomicPairedSettlement === true, "settlement must be atomic");

  try {
    const hero = BigInt(economics.heroRewardBaseUnits);
    const proposer = BigInt(economics.proposerRewardBaseUnits);
    const pair = BigInt(economics.pairRewardBaseUnits);
    const budget = BigInt(economics.maximumBudgetBaseUnits);
    const cap = BigInt(economics.maximumCompletedPairs);
    expect(hero + proposer === pair, "base-unit pair amount must equal hero plus proposer");
    expect(pair * cap === budget, "base-unit budget must equal pair amount times cap");
  } catch {
    errors.push("base-unit values must be valid integers");
  }

  const eligibility = policy?.eligibility ?? {};
  expect(eligibility.optionalForNodeActivation === true, "feature must remain optional");
  expect(eligibility.heroMustConnectIndependently === true, "hero must connect independently");
  expect(eligibility.xVerificationRequired === true, "X verification is required");
  expect(eligibility.stableXUserIdControlsIdentity === true, "stable X identity must control uniqueness");
  expect(eligibility.displayHandleControlsIdentity === false, "display handle must not control uniqueness");
  expect(eligibility.rejectSelfProposalByNode === true, "node self-proposal must be rejected");
  expect(eligibility.rejectSelfProposalByWallet === true, "wallet self-proposal must be rejected");
  expect(eligibility.rejectSelfProposalByXIdentity === true, "X self-proposal must be rejected");

  const uniqueness = policy?.uniqueness ?? {};
  expect(JSON.stringify(uniqueness.roles) === JSON.stringify(["HERO", "PROPOSER"]), "reward roles mismatch");
  expect(
    JSON.stringify(uniqueness.dimensionsPerRole) ===
      JSON.stringify(["NODE", "WALLET", "X_IDENTITY_COMMITMENT"]),
    "deduplication dimensions mismatch",
  );
  expect(uniqueness.maximumRewardsPerIdentityPerRole === 1, "each role is once per identity");
  expect(uniqueness.heroAndProposerRolesIndependent === true, "roles must be independently claimable");
  expect(uniqueness.oneActiveNominationPerProposer === true, "one active proposer nomination is required");
  expect(uniqueness.oneActiveReservationPerHeroIdentity === true, "one active hero reservation is required");

  const capacity = policy?.capacity ?? {};
  expect(capacity.consumedOnlyByCompletedAtomicPair === true, "only completed pairs consume capacity");
  expect(capacity.pendingConsumesCapacity === false, "pending must not consume capacity");
  expect(capacity.invalidConsumesCapacity === false, "invalid must not consume capacity");
  expect(capacity.cancelledConsumesCapacity === false, "cancelled must not consume capacity");
  expect(capacity.duplicateConsumesCapacity === false, "duplicate must not consume capacity");
  expect(capacity.exhaustedIsPermanent === true, "exhaustion must be permanent");

  const evidence = policy?.publicEvidence ?? {};
  expect(evidence.publishAggregateState === true, "aggregate state must be public");
  expect(evidence.publishVaultAccounting === true, "vault accounting must be public");
  expect(evidence.publishSettlementTransactions === true, "settlement transactions must be public");
  expect(evidence.publishSourceAndArtifactHashesBeforeActivation === true, "source and hashes must precede activation");
  expect(evidence.publishPrivateIdentityData === false, "private identity data must not be published");

  expect(
    policy?.meaningOfInstant === "PREPARE_AND_SUBMIT_WHEN_VERIFIED_SUBJECT_TO_NORMAL_SOLANA_CONFIRMATION",
    "instant settlement wording mismatch",
  );

  return errors;
}

export function loadPolicy() {
  return JSON.parse(readFileSync(policyPath, "utf8"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validatePolicy(loadPolicy());
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Promotions DLC policy is internally consistent and remains an inactive draft.");
  }
}

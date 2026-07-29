import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  NONDEPLOYABLE_SENTINEL_PROGRAM_ID,
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  SWITCHBOARD_ON_DEMAND_MAINNET_PROGRAM_ID,
  V2_STAGE_ORDER,
  createIatV2DeploymentPlan,
  deriveAgencyAddress,
  deriveAgencyOwnerIndexAddress,
  deriveIatV2Addresses,
  derivePositionAddress,
  deriveRoundAddress,
  serializePlan,
} from "../programs/iat_v2/client.mjs";

const mint = Keypair.generate().publicKey;
const program = Keypair.generate().publicKey;
const randomnessProgram = SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID;

test("V2 PDA inventory is deterministic, unique, and off curve", () => {
  const first = deriveIatV2Addresses({ mint, programId: program });
  const second = deriveIatV2Addresses({ mint, programId: program });
  assert.equal(first.config.toBase58(), second.config.toBase58());
  const values = [
    first.config,
    first.vaultAuthority,
    first.stakeTokenAccount,
    first.coreReward,
    ...Object.values(first.lanes).flatMap((lane) => [lane.state, lane.tokenAccount]),
  ];
  assert.equal(new Set(values.map((value) => value.toBase58())).size, values.length);
  values.forEach((value) => assert.equal(PublicKey.isOnCurve(value.toBytes()), false));
});

test("agency and round PDA indices are deterministic and separated", () => {
  const { config } = deriveIatV2Addresses({ mint, programId: program });
  assert.notEqual(
    deriveAgencyAddress({ config, programId: program, index: 0 }).toBase58(),
    deriveAgencyAddress({ config, programId: program, index: 1 }).toBase58(),
  );
  assert.notEqual(
    deriveRoundAddress({ config, programId: program, week: 0 }).toBase58(),
    deriveRoundAddress({ config, programId: program, week: 1 }).toBase58(),
  );
  const owner = Keypair.generate().publicKey;
  assert.equal(
    PublicKey.isOnCurve(
      deriveAgencyOwnerIndexAddress({ config, programId: program, owner }).toBytes(),
    ),
    false,
  );
  assert.notEqual(
    derivePositionAddress({
      config,
      programId: program,
      owner,
      positionId: 0,
    }).toBase58(),
    derivePositionAddress({
      config,
      programId: program,
      owner,
      positionId: 1,
    }).toBase58(),
  );
});

test("devnet plan uses one hardware ATA and four program vault destinations", () => {
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint,
    programId: program,
    randomnessProgramId: randomnessProgram,
  });
  assert.deepEqual(plan.stageOrder, V2_STAGE_ORDER);
  assert.equal(plan.signingOrBroadcastCapability, false);
  assert.equal(plan.expectedSupplyBaseUnits, 1_000_000_000_000n);
  assert.equal(plan.allocationDestinations.community.custody, "HARDWARE_WALLET_ATA");
  for (const lane of ["treasury", "ecosystem", "coreTeam", "liquidity"]) {
    assert.equal(plan.allocationDestinations[lane].custody, "PROGRAM_VAULT_PDA");
    assert.equal(plan.allocationDestinations[lane].owner.toBase58(), plan.vaultAuthority.toBase58());
  }
  assert.equal(
    Object.values(plan.allocationDestinations).reduce((sum, allocation) => sum + allocation.amount, 0n),
    plan.expectedSupplyBaseUnits,
  );
  assert.doesNotMatch(serializePlan(plan), /secretKey|privateKey|mnemonic|seedPhrase/i);
});

test("mainnet planning refuses the source sentinel program ID", () => {
  assert.throws(
    () => createIatV2DeploymentPlan({
      network: "mainnet-beta",
      mint,
      programId: NONDEPLOYABLE_SENTINEL_PROGRAM_ID,
      randomnessProgramId: SWITCHBOARD_ON_DEMAND_MAINNET_PROGRAM_ID,
      rehearsal: false,
    }),
    /NONDEPLOYABLE_SENTINEL_PROGRAM_ID/,
  );
});

test("deployment planning pins the official Switchboard program per cluster", () => {
  assert.throws(
    () => createIatV2DeploymentPlan({
      network: "devnet",
      mint,
      programId: program,
      randomnessProgramId: SWITCHBOARD_ON_DEMAND_MAINNET_PROGRAM_ID,
    }),
    /WRONG_SWITCHBOARD_ON_DEMAND_PROGRAM_ID/,
  );
  assert.throws(
    () => createIatV2DeploymentPlan({
      network: "mainnet-beta",
      mint,
      programId: program,
      randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
      rehearsal: false,
    }),
    /WRONG_SWITCHBOARD_ON_DEMAND_PROGRAM_ID/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import {
  IAT_V2_SENTINEL_PROGRAM_ID,
  SWITCHBOARD_MAINNET_PROGRAM_ID,
  bindAllocationPlanJson,
  bindAnchorConfig,
  bindPolicyJson,
  bindProgramSource,
  validateDeployableProgramId,
} from "../programs/iat_v2/program-id-binding.mjs";

const deployable = Keypair.generate().publicKey.toBase58();

test("binding accepts only a deployable public program ID", () => {
  assert.equal(validateDeployableProgramId(deployable), deployable);
  assert.throws(() => validateDeployableProgramId("not-a-key"), /canonical Solana/);
  assert.throws(
    () => validateDeployableProgramId(IAT_V2_SENTINEL_PROGRAM_ID),
    /reserved or non-deployable/,
  );
});

test("binding replaces each sentinel exactly once", () => {
  assert.equal(
    bindProgramSource(`declare_id!("${IAT_V2_SENTINEL_PROGRAM_ID}")`, deployable),
    `declare_id!("${deployable}")`,
  );
  const anchor = ["localnet", "devnet", "mainnet"]
    .map((cluster) => `[programs.${cluster}]\niat_v2 = "${IAT_V2_SENTINEL_PROGRAM_ID}"`)
    .join("\n\n");
  const bound = bindAnchorConfig(anchor, deployable);
  assert.equal((bound.match(new RegExp(deployable, "g")) ?? []).length, 3);
  assert.throws(
    () => bindProgramSource(`declare_id!("${deployable}")`, deployable),
    /sentinel binding state/,
  );
});

test("binding records the program and official mainnet randomness IDs in policy artifacts", () => {
  const policy = JSON.parse(bindPolicyJson(
    JSON.stringify({ program: { programId: null, randomnessProgramId: null } }),
    deployable,
  ));
  const plan = JSON.parse(bindAllocationPlanJson(
    JSON.stringify({ program: { programId: null, randomnessProgramId: null } }),
    deployable,
  ));
  for (const artifact of [policy, plan]) {
    assert.equal(artifact.program.programId, deployable);
    assert.equal(
      artifact.program.randomnessProgramId,
      SWITCHBOARD_MAINNET_PROGRAM_ID,
    );
  }
});

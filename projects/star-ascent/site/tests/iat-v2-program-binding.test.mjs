import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import {
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_PROGRAM_ARTIFACT_SHA256,
} from "../programs/iat_v2/instructions.mjs";
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

test("Devnet tooling preserves the live V2 artifact while preflight binds current source", () => {
  const liveSha256 = "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7";
  const currentSha256 = "d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4";
  assert.equal(IAT_V2_PROGRAM_ARTIFACT_SHA256, liveSha256);
  assert.equal(IAT_V2_PROGRAM_ARTIFACT_BYTES, 597_336);
  assert.equal(IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SHA256, currentSha256);
  assert.equal(IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BYTES, 579_480);
  assert.equal(
    IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SOURCE_HEAD,
    "dd3cb28f6b985c84fddcb971beaa9f00126f5d99",
  );
  assert.equal(IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BUILD_RUN_ID, 31_372_599_971);

  for (const path of [
    "scripts/rebuild-iat-v2-devnet-buffer-fresh.sh",
    "scripts/handoff-iat-v2-devnet-buffer.sh",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, new RegExp(`EXPECTED_HASH="${liveSha256}"`, "u"), `${path} lost live bytes`);
    assert.doesNotMatch(source, new RegExp(currentSha256, "u"), `${path} must not stage the incompatible artifact`);
    assert.match(source, /--url devnet/u, `${path} must stay Devnet-only`);
    assert.doesNotMatch(source, /mainnet-beta|api\.mainnet/u, `${path} must not gain a Mainnet route`);
  }

  for (const path of [
    "scripts/iat-v2-feature-preflight.mjs",
    "tools/iat-v2-admin-console/main.jsx",
    "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /inspectReviewedUpgradeableProgramArtifact/u, `${path} must inspect Loader padding`);
    assert.match(source, /matchesReviewedArtifact/u, `${path} must reject artifact or padding drift`);
  }

  for (const path of [
    "tools/iat-v2-admin-console/main.jsx",
    "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /IAT_V2_PROGRAM_ARTIFACT_SHA256/u, `${path} must retain the live artifact pin`);
    assert.doesNotMatch(
      source,
      /IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT|expectedArtifactBytes|expectedArtifactSha256/u,
      `${path} must not switch the live console to the incompatible artifact`,
    );
    assert.doesNotMatch(source, new RegExp(currentSha256, "u"), `${path} must not embed incompatible bytes`);
  }

  const consoleSource = readFileSync("tools/iat-v2-admin-console/main.jsx", "utf8");
  assert.match(consoleSource, /const SOURCE_COMMIT = "ba88535036da3f3871b65100fc18b655ccfa1d57"/u);
  assert.match(consoleSource, /programDataRegionBytes: snapshot\.deployment\.loaderRegionBytes/u);
  assert.match(consoleSource, /loaderZeroPaddingBytes: snapshot\.deployment\.loaderZeroPaddingBytes/u);

  const preflight = readFileSync("scripts/iat-v2-feature-preflight.mjs", "utf8");
  assert.match(preflight, /HOLD_CURRENT_SOURCE_INCOMPATIBLE_WITH_ACTIVE_V2_STATE/u);
  assert.match(preflight, /BLOCKED_CCC_DISABLED_AND_ROUND_MIGRATION_ABSENT/u);
  assert.match(preflight, /publicUpgradeAuthorized: false/u);
  assert.match(preflight, /preservesActiveV2Features: false/u);
  assert.match(preflight, /deployedRoundAccountBytes: 198/u);
  assert.match(preflight, /reviewedRoundAccountBytes: 206/u);
  assert.match(preflight, /roundAccountMigrationAvailable: false/u);
  assert.match(preflight, /expectedArtifactBytes: IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(preflight, /expectedArtifactSha256: IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SHA256/u);

  const currentProgram = readFileSync("programs/iat_v2/src/lib.rs", "utf8");
  assert.match(currentProgram, /pub const CCC_DLC_GENESIS_ENABLED: bool = false;/u);
  assert.match(currentProgram, /pub struct Round \{[\s\S]*pub commit_slot: u64,[\s\S]*pub commit_timestamp: i64,/u);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";
import {
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
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
const siteRoot = fileURLToPath(new URL("..", import.meta.url));
const readSiteSource = (relativePath) => readFileSync(resolve(siteRoot, relativePath), "utf8");

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
  assert.equal(
    IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
    "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
  );
  assert.equal(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES, 649_680);
  assert.equal(
    IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
    "a03fe71dd66cd1650b8d0353e486786df30b83e9",
  );
  assert.equal(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID, 33_161_771_816);
  assert.equal(
    IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
    "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
  );

  const rebuildPath = "scripts/rebuild-iat-v2-devnet-buffer-fresh.sh";
  const rebuildSource = readSiteSource(rebuildPath);
  assert.match(rebuildSource, /iat-v2-devnet-buffer-preflight\.mjs verify-recovery/u, `${rebuildPath} lost CI evidence verification`);
  assert.match(rebuildSource, /EXPECTED_HASH="\$\{binding_fields\[0\]\}"/u, `${rebuildPath} lost verified dynamic hash binding`);
  assert.match(rebuildSource, /EXPECTED_BYTES="\$\{binding_fields\[1\]\}"/u, `${rebuildPath} lost verified dynamic byte binding`);
  assert.doesNotMatch(rebuildSource, /EXPECTED_HASH="[0-9a-f]{64}"/u, `${rebuildPath} must not pin an obsolete artifact`);

  const handoffPath = "scripts/handoff-iat-v2-devnet-buffer.sh";
  const handoffSource = readSiteSource(handoffPath);
  assert.doesNotMatch(handoffSource, /iat-v2-devnet-buffer-preflight\.mjs verify/u, `${handoffPath} must not restore mutable-path preflight execution`);
  assert.match(handoffSource, /EXPECTED_HASH="771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01"/u, `${handoffPath} lost the immutable migration artifact hash`);
  assert.match(handoffSource, /EXPECTED_BYTES="649680"/u, `${handoffPath} lost the immutable migration artifact byte count`);
  assert.match(handoffSource, /iat_v2_run_runtime_binding_verifier/u, `${handoffPath} lost sealed runtime-binding verification`);
  assert.match(handoffSource, /IAT_V2_RUNTIME_BINDING_STDIN_CLI=iat-v2-devnet-buffer-runtime-binding-stdin\/v1/u, `${handoffPath} lost the captured verifier protocol`);
  assert.match(handoffSource, /-- node --input-type=module - verify/u, `${handoffPath} lost sealed captured-source verification`);
  assert.match(handoffSource, /"\$\{binding_fields\[0\]\}" == "\$EXPECTED_HASH"/u, `${handoffPath} lost runtime artifact-hash equality`);
  assert.match(handoffSource, /"\$\{binding_fields\[1\]\}" == "\$EXPECTED_BYTES"/u, `${handoffPath} lost runtime artifact-byte equality`);
  assert.match(handoffSource, /RUNTIME_EVIDENCE_MANIFEST_SHA256="\$\{binding_fields\[2\]\}"/u, `${handoffPath} lost runtime evidence binding`);
  assert.match(handoffSource, /runtime binding artifact or evidence tuple differs from the hardcoded migration tuple/u, `${handoffPath} lost migration tuple fail-closed behavior`);
  assert.match(handoffSource, /runtime-bound handoff source differs from the exact bytes parsed by Bash/u, `${handoffPath} lost captured-source identity enforcement`);

  for (const path of [rebuildPath, handoffPath]) {
    const source = readSiteSource(path);
    assert.doesNotMatch(source, new RegExp(currentSha256, "u"), `${path} must not stage the incompatible artifact`);
    assert.match(source, /--url devnet/u, `${path} must stay Devnet-only`);
    assert.doesNotMatch(source, /mainnet-beta|api\.mainnet/u, `${path} must not gain a Mainnet route`);
  }

  for (const path of [
    "scripts/iat-v2-feature-preflight.mjs",
    "tools/iat-v2-admin-console/main.jsx",
    "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
  ]) {
    const source = readSiteSource(path);
    assert.match(source, /inspectReviewedUpgradeableProgramArtifact/u, `${path} must inspect Loader padding`);
    assert.match(source, /matchesReviewedArtifact/u, `${path} must reject artifact or padding drift`);
  }

  const mainConsoleSource = readSiteSource("tools/iat-v2-admin-console/main.jsx");
  assert.match(mainConsoleSource, /IAT_V2_PROGRAM_ARTIFACT_SHA256/u, "main console must retain the live artifact pin");
  assert.match(mainConsoleSource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u, "feature mode must retain the migration artifact pin");
  assert.match(
    mainConsoleSource,
    /ACTIVE_PROGRAM_ARTIFACT_BYTES = FEATURE_MODE[\s\S]*IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES[\s\S]*IAT_V2_PROGRAM_ARTIFACT_BYTES/u,
    "main console must select one exact artifact by mode",
  );
  assert.match(mainConsoleSource, /expectedArtifactBytes: ACTIVE_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(mainConsoleSource, /expectedArtifactSha256: ACTIVE_PROGRAM_ARTIFACT_SHA256/u);
  assert.doesNotMatch(
    mainConsoleSource,
    /IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT/u,
    "main console must not switch to the incompatible current-reviewed artifact",
  );
  assert.doesNotMatch(mainConsoleSource, new RegExp(currentSha256, "u"), "main console embedded incompatible bytes");

  const upgradeConsoleSource = readSiteSource("tools/iat-v2-admin-console/ProgramUpgrade.jsx");
  assert.match(upgradeConsoleSource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u);
  assert.match(upgradeConsoleSource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES/u);
  assert.doesNotMatch(upgradeConsoleSource, /\bIAT_V2_PROGRAM_ARTIFACT_(?:SHA256|BYTES)\b/u);
  assert.doesNotMatch(upgradeConsoleSource, new RegExp(currentSha256, "u"), "upgrade console embedded incompatible bytes");

  const consoleSource = readSiteSource("tools/iat-v2-admin-console/main.jsx");
  assert.match(consoleSource, /const SOURCE_COMMIT = "ba88535036da3f3871b65100fc18b655ccfa1d57"/u);
  assert.match(consoleSource, /programDataRegionBytes: snapshot\.deployment\.loaderRegionBytes/u);
  assert.match(consoleSource, /loaderZeroPaddingBytes: snapshot\.deployment\.loaderZeroPaddingBytes/u);

  const preflight = readSiteSource("scripts/iat-v2-feature-preflight.mjs");
  assert.match(preflight, /HOLD_LEGACY_ROUND_MIGRATION_REQUIRED/u);
  assert.match(preflight, /SOURCE_PRESERVES_FEATURES_WITH_SETTLED_ROUND_MIGRATION/u);
  assert.match(preflight, /publicUpgradeAuthorized: false/u);
  assert.match(preflight, /preservesActiveV2Features: everyLegacyRoundMigrationSafe/u);
  assert.match(preflight, /deployedRoundAccountBytes: IAT_V2_ROUND_LAYOUT\.LEGACY_V1_BYTES/u);
  assert.match(preflight, /reviewedRoundAccountBytes: IAT_V2_ROUND_LAYOUT\.HARDENED_V2_BYTES/u);
  assert.match(preflight, /roundAccountMigrationAvailable: true/u);
  assert.match(preflight, /legacyRoundMigrationComplete: legacyRounds\.length === 0/u);
  assert.match(preflight, /HOLD_MIGRATION_ARTIFACT_NOT_CI_BOUND/u);
  assert.match(preflight, /migrationArtifactBound/u);
  assert.match(preflight, /expectedArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(preflight, /expectedArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u);
  assert.doesNotMatch(preflight, /IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT/u);

  const currentProgram = readSiteSource("programs/iat_v2/src/lib.rs");
  assert.match(currentProgram, /pub const CCC_DLC_GENESIS_ENABLED: bool = true;/u);
  assert.match(currentProgram, /pub fn migrate_legacy_round/u);
  assert.match(currentProgram, /pub struct Round \{[\s\S]*pub commit_slot: u64,[\s\S]*pub commit_timestamp: i64,/u);
});

test("attended consoles render complete exact migration evidence bindings", () => {
  const bufferPreflight = readSiteSource("scripts/iat-v2-devnet-buffer-preflight.mjs");
  assert.match(
    bufferPreflight,
    /evidenceManifestSha256: IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256/u,
  );
  assert.doesNotMatch(bufferPreflight, /evidenceManifestSha256:\s*["'][0-9a-f]{64}["']/u);

  const consolePaths = [
    "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
    "tools/iat-v2-admin-console/LegacyRoundMigration.jsx",
    "tools/iat-v2-admin-console/FeatureRehearsal.jsx",
  ];
  const exactVisibleValues = [
    '<code className="full-code">{IAT_V2_PROGRAM_DATA_ADDRESS.toBase58()}</code>',
    '<code className="full-code">{IAT_V2_PROGRAM_ADMIN.toBase58()}</code>',
    '<code className="full-code">{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD}</code>',
    "<code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID} / 1</code>",
    '<code className="full-code">{IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256}</code>',
    '<code className="full-code">{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256}</code>',
    "<code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES}</code>",
  ];

  for (const path of consolePaths) {
    const source = readSiteSource(path);
    for (const value of exactVisibleValues) {
      assert.ok(source.includes(value), `${path} must render ${value}`);
    }
  }

  const featureConsole = readSiteSource("tools/iat-v2-admin-console/FeatureRehearsal.jsx");
  assert.match(featureConsole, /MESSAGE \{pending\.messageSha256\}/u);
  assert.doesNotMatch(featureConsole, /short\(pending\.messageSha256/u);

  const upgradeConsole = readSiteSource("tools/iat-v2-admin-console/ProgramUpgrade.jsx");
  assert.match(upgradeConsole, /owner: info\.owner,[\s\S]*programBytes: data\.subarray\(BUFFER_METADATA_BYTES\)/u);
  assert.match(upgradeConsole, /bufferOwner: parsedBuffer\.owner/u);
  assert.match(upgradeConsole, /bufferProgramBytes: parsedBuffer\.programBytes\.length/u);
  assert.match(upgradeConsole, /FINALIZED BUFFER OWNER \(OBSERVED\)[\s\S]*snapshot\?\.bufferOwner\?\.toBase58\(\)/u);
  assert.match(upgradeConsole, /FINALIZED BUFFER PROGRAM BYTES \(OBSERVED\)[\s\S]*snapshot\?\.bufferProgramBytes/u);
});

test("current-source action routes cannot fall back to archived signing surfaces", () => {
  const mainConsole = readSiteSource("tools/iat-v2-admin-console/main.jsx");
  assert.match(
    mainConsole,
    /const LEGACY_INITIALIZATION_SIGNING_DISABLED = true;/u,
  );
  assert.match(
    mainConsole,
    /async function simulateAndSign\(\) \{[\s\S]*INSPECTION_MODE[\s\S]*\|\| LEGACY_INITIALIZATION_SIGNING_DISABLED[\s\S]*signingInFlight\.current[\s\S]*\) return;/u,
  );
  assert.match(
    mainConsole,
    /ARCHIVED INITIALIZATION SIGNING DISABLED/u,
  );
  assert.match(
    mainConsole,
    /INSPECTION_MODE \|\| !CANONICAL_ACTION_MODE[\s\S]*<App getHardwareProvider=\{rejectInspectionHardwareProvider\}/u,
  );
});

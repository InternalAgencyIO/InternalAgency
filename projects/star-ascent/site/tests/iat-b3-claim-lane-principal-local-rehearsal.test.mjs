import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

async function text(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function bashPath(value) {
  if (process.platform !== "win32") return value;
  const match = /^([A-Za-z]):[\\/](.*)$/u.exec(value);
  assert(match);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}
function runBash(script) {
  return process.platform === "win32"
    ? spawnSync("wsl.exe", ["bash", bashPath(script)], { encoding: "utf8" })
    : spawnSync("bash", [script], { encoding: "utf8" });
}

test("claim rehearsal is pinned, loopback-only, disposable, and fail-closed", async () => {
  const [runner, readme, ignore] = await Promise.all([
    text("../scripts/run-iat-b3-claim-lane-principal-local.sh"),
    text("./fixtures/iat-b3-claim-lane-principal/README.md"),
    text("./fixtures/iat-b3-claim-lane-principal/.gitignore"),
  ]);
  for (const marker of [
    "set -euo pipefail", "http://127.0.0.1:", "IAT_B3_GIT_HEAD",
    "exact_git_head_mismatch", "mktemp -d /tmp/iat-b3-claim-lane-principal",
    "trap finish EXIT", 'kill "$validator_pid"', 'rm -rf -- "$temp_dir"',
    "--tools-version v1.52", "--skip-tools-install", "-- --locked",
  ]) assert(runner.includes(marker), marker);
  assert.doesNotMatch(runner, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
  const order = [
    'if [[ -e "$evidence" ]]', 'if ! mkdir -p -- "$evidence_dir"',
    'if [[ ! -d "$evidence_dir" ]]', "for command_name in cargo rustc solana",
    'mkdir -p -- "$deploy_dir"', "mktemp -d /tmp/iat-b3-claim-lane-principal",
  ].map((marker) => runner.indexOf(marker));
  assert(order.every((value, index) => value >= 0 && (index === 0 || value > order[index - 1])));
  assert.match(readme, /exact 12-account graph/u);
  assert.match(readme, /Treasury, Ecosystem, and Liquidity/u);
  assert.match(readme, /Core is rejected/u);
  assert.match(readme, /`mainnetStatus` remains `HOLD`/u);
  for (const beneficiary of [
    "CucS4oym18YjEMUmXYVx45q6HUGhW35wE3qpwkcnSCFQ",
    "HypAfe9RwaBRnZeLpqvYU1rBbAwHTSBnm24enRL6Qx18",
    "2yBK1NkeUoTToE4cfz33WRckho4Qr2BV1ZtCTrw3AHyB",
    "2d41i3afUpWuo2LqpuKao5D1ToEU88aBokiQ3z8HQtPC",
  ]) assert(runner.includes(beneficiary), beneficiary);
  assert.match(runner, /--owner "\$beneficiary"/u);
  assert.equal(ignore.trim(), "/target/");
});

test("runner rejects a non-directory evidence parent before setup", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "iat-b3-claim-parent-"));
  try {
    const runner = join(sandbox, "scripts", "run-iat-b3-claim-lane-principal-local.sh");
    const hostile = join(sandbox, "docs", "b3", "evidence");
    await mkdir(dirname(runner), { recursive: true });
    await mkdir(dirname(hostile), { recursive: true });
    await copyFile(new URL("../scripts/run-iat-b3-claim-lane-principal-local.sh", import.meta.url), runner);
    await writeFile(hostile, "not a directory\n", { flag: "wx" });
    const result = runBash(runner);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /evidence_parent_create_failed/u);
    await assert.rejects(access(join(sandbox, "tests")), /ENOENT/u);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("fixture imports the real exact twelve-account production executor", async () => {
  const [manifest, source] = await Promise.all([
    text("./fixtures/iat-b3-claim-lane-principal/economy/Cargo.toml"),
    text("./fixtures/iat-b3-claim-lane-principal/economy/src/lib.rs"),
  ]);
  assert.match(manifest, /runtime-production-claim-lane-principal-executor/u);
  assert.match(source, /execute_runtime_production_claim_lane_principal_account_infos\(/u);
  assert.match(source, /accounts\.len\(\) != 12/u);
  assert.match(source, /&accounts\[11\]/u);
  const law = source.indexOf("verify_runtime_daily_law_open_account_info");
  const executor = source.indexOf("execute_runtime_production_claim_lane_principal_account_infos(", law);
  const injected = source.indexOf("InjectedAfterExecutorSuccess", executor);
  assert(law >= 0 && executor > law && injected > executor);
  assert.match(source, /state\.config\.admin != authority\.key\.to_bytes\(\)/u);
  for (const pattern of [
    /fixture_config_lifecycle_pair\(active\)/u,
    /\(GenesisPhase::Active, true\)/u,
    /\(GenesisPhase::GenesisStaging, false\)/u,
    /state\.phase = phase/u,
    /state\.config\.active = active/u,
    /fixture_active_flag_maps_to_the_canonical_phase_pair/u,
  ]) assert.match(source, pattern);
  assert.match(source, /SyntheticLawCapabilityMismatch/u);
  assert.match(source, /SHADOW_LAW_DECISION_BYTE_OFFSET: usize = 128/u);
});

test("hook uses one readonly Law meta and fail-closed custom control", async () => {
  const law = await text("./fixtures/iat-b3-claim-lane-principal/law-hook/src/lib.rs");
  for (const pattern of [
    /ExtraAccountMetaList::size_of\(1\)/u,
    /ExtraAccountMeta::new_with_pubkey\(law_state\.key, false, false\)/u,
    /CONTROL_DISCRIMINATOR: \[u8; 8\] = \*b"IATB3CTL"/u,
    /CONTROL_PAYLOAD_LEN: usize = 34/u,
    /require_exact_execute_meta_list\(&validation_data, law_state\.key\)/u,
    /read_control_tlv\(&validation_data\)/u,
    /facts\.authority == facts\.vault_authority/u,
    /facts\.source_owner == facts\.vault_authority/u,
    /facts\.destination_owner != facts\.vault_authority/u,
    /InjectedHookFailure/u,
  ]) assert.match(law, pattern);
  for (const hostile of [
    "zero amount", "signer escalation", "delegate or wrong authority",
    "non-lane destination", "lane-to-lane", "vault-owned non-lane source",
    "wrong destination owner", "absent TLV", "wrong account length",
    "wrong discriminator", "wrong payload length", "wrong version",
    "wrong ordinal", "wrong Execute meta list", "wrong signer",
    "wrong validation address", "wrong validation owner", "locked Law",
  ]) assert(law.includes(`"${hostile}"`), hostile);
});

test("driver freezes claim-specific one-CPI/one-CAS matrix", async () => {
  const driver = await text("../scripts/iat-b3-claim-lane-principal-local-driver.mjs");
  for (const label of [
    "law-first-malformed-production", "inactive-config-rejected",
    "wrong-beneficiary-rejected", "core-policy-rejected",
    "wrong-program-identity-rejected", "nothing-vested-rejected",
    "post-success-wrapper-rollback", "claim-success-treasury",
    "claim-success-ecosystem", "claim-success-liquidity",
    "direct-hook-nonsigner-rejected", "direct-hook-signer-rejected",
    "zero-funding-rejected", "nonlane-funding-rejected",
    "delegate-funding-rejected", "set-control-unsigned-controller-rejected",
    "set-control-wrong-validation-rejected", "set-control-invalid-ordinal-rejected",
    "set-control-locked-law-rejected", "set-config-wrong-controller-rejected",
    "wrong-lane-state-rejected", "wrong-source-pda-rejected",
    "wrong-mint-rejected", "wrong-hook-program-rejected",
    "wrong-validation-rejected", "wrong-law-rejected",
    "synthetic-shadow-law-capability-mismatch-rejected",
  ]) assert(driver.includes(`"${label}"`), label);
  for (const pattern of [
    /data\[9\] = 9/u,
    /data\[16\] = lane/u,
    /assertTokenInvokeCount\(success, 1\)/u,
    /assertTokenInvokeCount\(zeroFailure, 0\)/u,
    /laneExpected\.writeBigUInt64LE/u,
    /sourceExpected\.writeBigUInt64LE/u,
    /destinationExpected\.writeBigUInt64LE/u,
    /exactTwelveAccountGraphObserved: true/u,
    /allThreeNonCoreLanesClaimed: true/u,
    /coreLaneRejectedWithoutCpiOrWrites: true/u,
    /accountGraphHostilesRejectedBeforeCpiWithoutWrites: true/u,
    /eachNonCoreHookFailureRejectedCpiBeforeReloadAndCasWithExactRawStateUnchanged: true/u,
    /lateWrapperFailureRolledBackOneCpiAndOneLaneCas: true/u,
    /CONFIG_PHASE_OFFSET = 9/u,
    /CONFIG_ACTIVE_OFFSET = 253/u,
    /assertExactFixtureConfigLifecycleMutation\(/u,
    /GENESIS_PHASE_STAGING,\s+false,/u,
    /GENESIS_PHASE_ACTIVE,\s+true,/u,
    /assertRollback\(inactiveBefore, restoredActive, "Config restore baseline"\)/u,
  ]) assert.match(driver, pattern);
});

test("truth remains narrow and fail-closed", async () => {
  const driver = await text("../scripts/iat-b3-claim-lane-principal-local-driver.mjs");
  for (const name of [
    "productionComputeBudgetProven", "productionProgramErrorAbiProven",
    "productionDispatcherProven", "productionEntrypointProven",
    "productionFinalCombinedBinaryProven", "buildSourceClosureVerified",
    "reproducibleBinaryProven", "productionLaneFundingProven",
    "coreLaneClaimProven", "productionIdentitiesFrozen",
    "activationLifecycleProven", "fundingCeremonyProven",
    "adversarialDevnetProven", "publicDevnetExecuted", "all15HandlersComplete",
    "releaseGraphNodeComplete", "activationReady", "mainnetExecutionAuthorized",
  ]) assert.match(driver, new RegExp(`${name}: false`, "u"));
  assert.match(driver, /mainnetHold: true/u);
  assert.match(driver, /mainnetStatus: "HOLD"/u);
  assert.match(driver, /flag: "wx"/u);
});

test("generated evidence, when present, is source-bound and cleanup-finalized", async (context) => {
  const url = new URL("../docs/b3/evidence/local-validator-claim-lane-principal-production-executor-20260813.json", import.meta.url);
  try { await access(url); } catch { context.skip("generated only after exact loopback PASS"); return; }
  const [recordText, economy, law, driver, runner, lock] = await Promise.all([
    readFile(url, "utf8"), text("./fixtures/iat-b3-claim-lane-principal/economy/src/lib.rs"),
    text("./fixtures/iat-b3-claim-lane-principal/law-hook/src/lib.rs"),
    text("../scripts/iat-b3-claim-lane-principal-local-driver.mjs"),
    text("../scripts/run-iat-b3-claim-lane-principal-local.sh"),
    text("./fixtures/iat-b3-claim-lane-principal/Cargo.lock"),
  ]);
  const record = JSON.parse(recordText);
  assert.equal(record.status, "PASS");
  assert.match(record.gitHead, /^[0-9a-f]{40}$/u);
  assert.equal(record.cleanup.temporaryLedgerRemoved, true);
  assert.equal(record.cleanup.validatorStopped, true);
  assert.equal(record.fixture.economySourceSha256, sha256(economy));
  assert.equal(record.fixture.lawHookSourceSha256, sha256(law));
  assert.equal(record.fixture.driverSha256, sha256(driver));
  assert.equal(record.fixture.runnerSha256, sha256(runner));
  assert.equal(record.fixture.cargoLockSha256, sha256(lock));
  assert.equal(record.observed.exactTwelveAccountGraphObserved, true);
  assert.equal(record.observed.allThreeNonCoreLanesClaimed, true);
  assert.equal(record.observed.accountGraphHostilesRejectedBeforeCpiWithoutWrites, true);
  assert.equal(
    record.observed.syntheticShadowLawCapabilityDigestMismatchRejectedBeforeCpiReloadAndCas,
    true,
  );
  assert.equal(record.limits.coreLaneClaimProven, false);
  assert.equal(record.limits.mainnetExecutionAuthorized, false);
  assert.equal(record.limits.mainnetHold, true);
});

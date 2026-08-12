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
  assert(match, `expected an absolute Windows path, received ${value}`);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function runBash(script) {
  if (process.platform === "win32") {
    return spawnSync("wsl.exe", ["bash", bashPath(script)], { encoding: "utf8" });
  }
  return spawnSync("bash", [script], { encoding: "utf8" });
}

test("withdraw rehearsal is isolated, pinned, loopback-only, and disposable", async () => {
  const [runner, readme, ignore] = await Promise.all([
    text("../scripts/run-iat-b3-withdraw-position-local.sh"),
    text("./fixtures/iat-b3-withdraw-position/README.md"),
    text("./fixtures/iat-b3-withdraw-position/.gitignore"),
  ]);
  assert.match(runner, /set -euo pipefail/u);
  assert.match(runner, /http:\/\/127\.0\.0\.1:/u);
  assert.doesNotMatch(runner, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
  assert.match(runner, /IAT_B3_GIT_HEAD/u);
  assert.match(runner, /\^\[0-9a-f\]\{40\}\$/u);
  assert.match(runner, /mktemp -d \/tmp\/iat-b3-withdraw-position/u);
  assert.match(runner, /trap finish EXIT/u);
  assert.match(runner, /kill "\$validator_pid"/u);
  assert.match(runner, /rm -rf -- "\$temp_dir"/u);
  assert.match(runner, /--tools-version v1\.52/u);
  assert.match(runner, /--skip-tools-install/u);
  assert.match(runner, /-- --locked/u);
  const evidenceReject = runner.indexOf('if [[ -e "$evidence" ]]');
  const evidenceParentCreate = runner.indexOf('if ! mkdir -p -- "$evidence_dir"');
  const evidenceParentAssert = runner.indexOf('if [[ ! -d "$evidence_dir" ]]');
  const toolDiscovery = runner.indexOf("for command_name in cargo rustc solana");
  const deployCreate = runner.indexOf('mkdir -p -- "$deploy_dir"');
  const tempCreate = runner.indexOf("mktemp -d /tmp/iat-b3-withdraw-position");
  assert(
    evidenceReject >= 0
      && evidenceParentCreate > evidenceReject
      && evidenceParentAssert > evidenceParentCreate
      && toolDiscovery > evidenceParentAssert
      && deployCreate > toolDiscovery
      && tempCreate > deployCreate,
    "evidence parent must fail closed before tool discovery, build output, or temporary-ledger creation",
  );
  assert.match(readme, /not a member of the production workspace/u);
  assert.match(readme, /Mainnet remains \*\*HOLD\*\*/u);
  assert.equal(ignore.trim(), "/target/");
});

test("withdraw runner rejects a hostile non-directory evidence parent before replay setup", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "iat-b3-withdraw-parent-"));
  try {
    const source = new URL("../scripts/run-iat-b3-withdraw-position-local.sh", import.meta.url);
    const runner = join(sandbox, "scripts", "run-iat-b3-withdraw-position-local.sh");
    const hostileParent = join(sandbox, "docs", "b3", "evidence");
    await mkdir(dirname(runner), { recursive: true });
    await mkdir(dirname(hostileParent), { recursive: true });
    await copyFile(source, runner);
    await writeFile(hostileParent, "not a directory\n", { flag: "wx" });

    const result = runBash(runner);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /"status":"FAIL"/u);
    assert.match(result.stdout, /"reason":"evidence_parent_create_failed"/u);
    assert.doesNotMatch(result.stdout, /"mode":"driver"|"mode":"summary"/u);
    await assert.rejects(access(join(sandbox, "tests")), /ENOENT/u);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("fixture imports the real exact twelve-account production withdrawal executor", async () => {
  const [manifest, source] = await Promise.all([
    text("./fixtures/iat-b3-withdraw-position/economy/Cargo.toml"),
    text("./fixtures/iat-b3-withdraw-position/economy/src/lib.rs"),
  ]);
  assert.match(manifest, /runtime-production-withdraw-position-executor/u);
  assert.match(source, /execute_runtime_production_withdraw_position_account_infos\(/u);
  assert.match(source, /accounts\.len\(\) != 12/u);
  assert.match(source, /&accounts\[11\]/u);
  const law = source.indexOf("verify_runtime_daily_law_open_account_info");
  const executor = source.indexOf("execute_runtime_production_withdraw_position_account_infos(", law);
  const injected = source.indexOf("InjectedAfterExecutorSuccess", executor);
  assert(law >= 0 && executor > law && injected > executor);
  assert.doesNotMatch(source, /production_open_position_executor/u);
});

test("hook resolves one readonly Law meta and authorizes vault-to-owner withdrawal", async () => {
  const law = await text("./fixtures/iat-b3-withdraw-position/law-hook/src/lib.rs");
  assert.match(law, /ExtraAccountMetaList::size_of\(1\)/u);
  assert.match(law, /ExtraAccountMeta::new_with_pubkey\(law_state\.key, false, false\)/u);
  assert.match(law, /source\.key == &stake_vault/u);
  assert.match(law, /authority\.key == &vault_authority/u);
  assert.match(law, /destination_state\.base\.delegate\.is_some\(\)/u);
  assert.match(law, /InjectedHookFailure/u);
});

test("driver freezes law-first, hook, late rollback, and exact success postimages", async () => {
  const driver = await text("../scripts/iat-b3-withdraw-position-local-driver.mjs");
  for (const label of ["law-first", "hook-rejection", "post-success-wrapper-rollback", "withdraw-success"]) {
    assert(driver.includes(`"${label}"`), `missing ${label}`);
  }
  assert.match(driver, /data\[9\] = 10/u);
  assert.match(driver, /withdrawInstruction\(base, 0, \{ hostileLaw: true \}\)/u);
  assert.match(driver, /configExpected\.writeBigUInt64LE\(0n, 240\)/u);
  assert.match(driver, /positionExpected\[173\] = 1/u);
  assert.match(driver, /stakeExpected\.writeBigUInt64LE/u);
  assert.match(driver, /destinationExpected\.writeBigUInt64LE/u);
  assert.match(driver, /assertRollback\(lateBefore/u);
  assert.match(driver, /syntheticStakeFundingHookBypass: true/u);
});

test("evidence truth remains narrow and fail-closed", async () => {
  const driver = await text("../scripts/iat-b3-withdraw-position-local-driver.mjs");
  for (const name of [
    "productionComputeBudgetProven", "productionProgramErrorAbiProven",
    "productionDispatcherProven", "productionEntrypointProven",
    "productionFinalCombinedBinaryProven", "buildSourceClosureVerified",
    "reproducibleBinaryProven", "productionStakeIngressProven",
    "productionIdentitiesFrozen", "activationLifecycleProven",
    "fundingCeremonyProven", "adversarialDevnetProven", "mainnetExecutionAuthorized",
    "publicDevnetExecuted", "all15HandlersComplete", "releaseGraphNodeComplete", "activationReady",
  ]) assert.match(driver, new RegExp(`${name}: false`, "u"));
  assert.match(driver, /mainnetHold: true/u);
  assert.match(driver, /mainnetStatus: "HOLD"/u);
  assert.match(driver, /flag: "wx"/u);
});

test("generated evidence, when present, is source-bound and cleanup-finalized", async (context) => {
  const url = new URL(
    "../docs/b3/evidence/local-validator-withdraw-position-production-executor-20260812.json",
    import.meta.url,
  );
  try { await access(url); } catch { context.skip("generated only after exact loopback PASS"); return; }
  const [recordText, economy, law, driver, runner, lock] = await Promise.all([
    readFile(url, "utf8"), text("./fixtures/iat-b3-withdraw-position/economy/src/lib.rs"),
    text("./fixtures/iat-b3-withdraw-position/law-hook/src/lib.rs"),
    text("../scripts/iat-b3-withdraw-position-local-driver.mjs"),
    text("../scripts/run-iat-b3-withdraw-position-local.sh"),
    text("./fixtures/iat-b3-withdraw-position/Cargo.lock"),
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
  assert.equal(record.observed.exactTwelveAccountSuccess, true);
  assert.equal(record.limits.reproducibleBinaryProven, false);
  assert.equal(record.limits.mainnetExecutionAuthorized, false);
  assert.equal(record.limits.mainnetHold, true);
});

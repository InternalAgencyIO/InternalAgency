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

test("settle rehearsal is isolated, pinned, loopback-only, and disposable", async () => {
  const [runner, readme, ignore] = await Promise.all([
    text("../scripts/run-iat-b3-settle-position-week-local.sh"),
    text("./fixtures/iat-b3-settle-position-week/README.md"),
    text("./fixtures/iat-b3-settle-position-week/.gitignore"),
  ]);
  assert.match(runner, /set -euo pipefail/u);
  assert.match(runner, /http:\/\/127\.0\.0\.1:/u);
  assert.doesNotMatch(runner, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
  assert.match(runner, /IAT_B3_GIT_HEAD/u);
  assert.match(runner, /\^\[0-9a-f\]\{40\}\$/u);
  assert.match(runner, /git -C "\$site_dir" rev-parse HEAD/u);
  assert.match(runner, /exact_git_head_mismatch/u);
  assert.match(runner, /mktemp -d \/tmp\/iat-b3-settle-position-week/u);
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
  const tempCreate = runner.indexOf("mktemp -d /tmp/iat-b3-settle-position-week");
  assert(
    evidenceReject >= 0
      && evidenceParentCreate > evidenceReject
      && evidenceParentAssert > evidenceParentCreate
      && toolDiscovery > evidenceParentAssert
      && deployCreate > toolDiscovery
      && tempCreate > deployCreate,
    "evidence parent must fail closed before tool discovery, build output, or temporary-ledger creation",
  );
  assert.match(readme, /exact\s+17-account standard graph/u);
  assert.match(readme, /`mainnetStatus` remains `HOLD`/u);
  assert.equal(ignore.trim(), "/target/");
});

test("settle runner rejects a hostile non-directory evidence parent before replay setup", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "iat-b3-settle-parent-"));
  try {
    const source = new URL("../scripts/run-iat-b3-settle-position-week-local.sh", import.meta.url);
    const runner = join(sandbox, "scripts", "run-iat-b3-settle-position-week-local.sh");
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

test("fixture imports the real exact seventeen-account standard production executor", async () => {
  const [manifest, source] = await Promise.all([
    text("./fixtures/iat-b3-settle-position-week/economy/Cargo.toml"),
    text("./fixtures/iat-b3-settle-position-week/economy/src/lib.rs"),
  ]);
  assert.match(manifest, /runtime-production-settle-position-week-executor/u);
  assert.match(source, /execute_runtime_production_settle_position_week_standard_account_infos\(/u);
  assert.match(source, /accounts\.len\(\) != 17/u);
  assert.match(source, /&accounts\[16\]/u);
  const law = source.indexOf("verify_runtime_daily_law_open_account_info");
  const executor = source.indexOf(
    "execute_runtime_production_settle_position_week_standard_account_infos(",
    law,
  );
  const injected = source.indexOf("InjectedAfterExecutorSuccess", executor);
  assert(law >= 0 && executor > law && injected > executor);
  assert.doesNotMatch(source, /production_open_position_executor/u);
});

test("hook resolves one readonly Law meta and authorizes exact lane transfers", async () => {
  const law = await text("./fixtures/iat-b3-settle-position-week/law-hook/src/lib.rs");
  assert.match(law, /ExtraAccountMetaList::size_of\(1\)/u);
  assert.match(law, /ExtraAccountMeta::new_with_pubkey\(law_state\.key, false, false\)/u);
  assert.match(law, /CONTROL_DISCRIMINATOR: \[u8; 8\] = \*b"IATB3CTL"/u);
  assert.match(law, /CONTROL_PAYLOAD_LEN: usize = 34/u);
  assert.match(law, /CONTROL_VERSION: u8 = 1/u);
  assert.match(law, /checked_add\(CONTROL_TLV_LEN\)/u);
  assert.match(law, /initialize_control_tlv\(&mut data, payer\.key\)/u);
  assert.match(law, /require_exact_execute_meta_list\(&data, law_state\.key\)/u);
  assert.match(law, /set_control_ordinal\(&mut data, authority\.key, ordinal\)/u);
  assert.match(law, /read_control_tlv\(&validation_data\)/u);
  assert.doesNotMatch(law, /law_state[^\n]*\[142\]|data\[142\]\s*=\s*ordinal/u);
  assert.match(law, /\[b"lane-token", config\.as_ref\(\), &\[lane\]\]/u);
  assert.match(law, /facts\.authority == facts\.vault_authority/u);
  assert.match(law, /facts\.amount > 0/u);
  assert.match(law, /facts\.source_ordinal\.is_none\(\)/u);
  assert.match(law, /!facts\.authority_is_signer/u);
  assert.match(law, /facts\.authority == facts\.source_owner/u);
  assert.match(law, /facts\.source_owner != facts\.vault_authority/u);
  assert.match(law, /facts\.destination_owner == facts\.vault_authority/u);
  for (const hostile of [
    "zero amount", "signer escalation", "delegate or wrong authority",
    "non-lane destination", "lane-to-lane", "vault-owned non-lane source",
    "wrong destination owner",
  ]) assert(law.includes(`"${hostile}"`), `missing classifier hostile ${hostile}`);
  for (const hostile of [
    "absent TLV", "wrong account length", "wrong discriminator",
    "wrong payload length", "wrong version", "wrong ordinal",
    "wrong Execute meta list", "wrong signer", "wrong validation address",
    "wrong validation owner", "locked Law",
  ]) assert(law.includes(`"${hostile}"`), `missing control hostile ${hostile}`);
  assert.match(law, /validation_control_changes_only_ordinal_and_clears_to_exact_baseline/u);
  assert.match(law, /validation_control_rejects_hostile_bytes_without_mutation/u);
  assert.match(law, /validation_control_update_facts_are_fail_closed/u);
  assert.match(law, /production_settlement_classifier_is_unchanged/u);
  assert.match(law, /source_ordinal == Some\(rejection\)/u);
  assert.match(law, /InjectedHookFailure/u);
});

test("driver freezes law-first, ordered hook rollback, zero-skip, and exact postimages", async () => {
  const driver = await text("../scripts/iat-b3-settle-position-week-local-driver.mjs");
  for (const label of [
    "law-first-malformed-production", "zero-skip-success",
    "post-success-wrapper-rollback", "settle-success",
    "direct-hook-nonsigner-rejected", "direct-hook-signer-rejected",
    "zero-funding-rejected", "nonlane-funding-rejected",
    "delegate-funding-rejected",
    "set-control-unsigned-controller-rejected",
    "set-control-wrong-validation-rejected",
    "set-control-invalid-ordinal-rejected",
    "set-control-locked-law-rejected",
  ]) {
    assert(driver.includes(`"${label}"`), `missing ${label}`);
  }
  assert.match(driver, /`ordered-hook-rejection-\$\{ordinal\}`/u);
  assert.match(driver, /data\[9\] = 7/u);
  assert.match(driver, /data\.writeBigUInt64LE\(SETTLEMENT_WEEK, 16\)/u);
  assert.match(driver, /assertTokenInvokeCount\(failure, ordinal\)/u);
  assert.match(driver, /assertTokenInvokeCount\(zeroSuccess, 1\)/u);
  assert.match(driver, /positionExpected\.writeBigUInt64LE/u);
  assert.match(driver, /expected\.writeBigUInt64LE\(left\.lanes\[index\]\.reserved/u);
  assert.match(driver, /destinationExpected\.writeBigUInt64LE/u);
  assert.match(driver, /syntheticLaneFundingHookBypass: true/u);
  assert.match(driver, /syntheticFundingAuthorizationReliesOnToken2022OuterTransfer: true/u);
  assert.match(driver, /syntheticFundingAuthorityAppearsNonsignerInsideHook: true/u);
  assert.match(driver, /laneToLaneHostileIsClassifierOnly: true/u);
  assert.match(driver, /directSignerAndNonsignerHookBypassesRejected: true/u);
  assert.match(driver, /delegatedFundingRejectedWithExactRollback: true/u);
  assert.match(driver, /zeroAndNonLaneFundingRejectedWithExactRollback: true/u);
  assert.match(driver, /positiveOwnerFundingExactDeltasObserved: true/u);
  assert.match(driver, /custom program error: 0xe412/u);
  assert.match(driver, /custom program error: 0xe413/u);
  assert.match(driver, /createApproveCheckedInstruction/u);
  assert.match(driver, /createRevokeInstruction/u);
  assert.match(driver, /syntheticValidationPdaControlTlv: true/u);
  assert.match(driver, /syntheticValidationControlOrdinalFailureFlag: true/u);
  assert.match(driver, /assertSingleReadOnlyLawMeta/u);
  assert.match(driver, /assertExactControlMutation/u);
  assert.match(driver, /assertLawUnchanged/u);
  assert.match(driver, /validation: base\.validation/u);
  assert.match(driver, /onlyValidationControlOrdinalMutatedAndClearedToBaseline: true/u);
  assert.match(driver, /productionValidationControlAbiProven: false/u);
  assert.match(driver, /productionFailureInjectionControlProven: false/u);
  assert.doesNotMatch(driver, /syntheticLawHookOrdinalFailureFlag/u);
  assert.doesNotMatch(driver, /exactTwelveAccountSuccess|syntheticStakeFundingHookBypass/u);
});

test("evidence truth remains narrow and fail-closed", async () => {
  const driver = await text("../scripts/iat-b3-settle-position-week-local-driver.mjs");
  for (const name of [
    "productionComputeBudgetProven", "productionProgramErrorAbiProven",
    "productionDispatcherProven", "productionEntrypointProven",
    "productionFinalCombinedBinaryProven", "buildSourceClosureVerified",
    "reproducibleBinaryProven", "productionLaneFundingProven",
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
    "../docs/b3/evidence/local-validator-settle-position-week-production-executor-20260812.json",
    import.meta.url,
  );
  try { await access(url); } catch { context.skip("generated only after exact loopback PASS"); return; }
  const [recordText, economy, law, driver, runner, lock] = await Promise.all([
    readFile(url, "utf8"), text("./fixtures/iat-b3-settle-position-week/economy/src/lib.rs"),
    text("./fixtures/iat-b3-settle-position-week/law-hook/src/lib.rs"),
    text("../scripts/iat-b3-settle-position-week-local-driver.mjs"),
    text("../scripts/run-iat-b3-settle-position-week-local.sh"),
    text("./fixtures/iat-b3-settle-position-week/Cargo.lock"),
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
  assert.equal(record.observed.exactSeventeenAccountStandardSuccess, true);
  assert.equal(record.observed.zeroAmountTreasuryAndLiquidityCpisSkipped, true);
  assert.equal(record.observed.thirdHookFailureRolledBackFirstTwoCpisAndAllState, true);
  assert.equal(record.scope.syntheticValidationPdaControlTlv, true);
  assert.equal(record.observed.authenticatedLawBytesInvariantAcrossControlUpdates, true);
  assert.equal(record.observed.executeMetaListBytesInvariantAcrossControlUpdates, true);
  assert.equal(record.observed.onlyValidationControlOrdinalMutatedAndClearedToBaseline, true);
  assert.equal(record.limits.productionValidationControlAbiProven, false);
  assert.equal(record.limits.reproducibleBinaryProven, false);
  assert.equal(record.limits.mainnetExecutionAuthorized, false);
  assert.equal(record.limits.mainnetHold, true);
});

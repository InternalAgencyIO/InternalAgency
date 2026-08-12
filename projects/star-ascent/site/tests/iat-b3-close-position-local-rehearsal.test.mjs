import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function text(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

test("close-position fixture imports the actual production handler behind its exact feature", async () => {
  const [manifest, source, readme] = await Promise.all([
    text("./fixtures/iat-b3-close-position/Cargo.toml"),
    text("./fixtures/iat-b3-close-position/src/lib.rs"),
    text("./fixtures/iat-b3-close-position/README.md"),
  ]);
  assert.match(manifest, /features = \["runtime-write-adapter"\]/u);
  assert.match(source, /execute_runtime_production_close_position_account_infos/u);
  assert.match(source, /verify_runtime_daily_law_open_account_info/u);
  const law = source.indexOf("verify_runtime_daily_law_open_account_info");
  const count = source.indexOf("accounts.len() != BASE_ACCOUNT_COUNT", law);
  const execute = source.indexOf("execute_runtime_production_close_position_account_infos", count);
  const injected = source.indexOf("InjectedAfterProductionHandlerSuccess", execute);
  assert(law >= 0 && count > law && execute > count && injected > execute);
  assert.match(readme, /not a member of the production workspace/u);
  assert.match(readme, /synthetic rehearsal infrastructure/u);
  assert.match(readme, /Mainnet remains \*\*HOLD\*\*/u);
});

test("runner is loopback-only, rejects SBF diagnostics, and cleans disposable material", async () => {
  const runner = await text("../scripts/run-iat-b3-close-position-local.sh");
  assert.match(runner, /set -euo pipefail/u);
  assert.match(runner, /http:\/\/127\.0\.0\.1:/u);
  assert.doesNotMatch(runner, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
  assert.match(runner, /mktemp -d "\$work_root\/run\.XXXXXX"/u);
  assert.match(runner, /trap finish EXIT/u);
  assert.match(runner, /kill "\$validator_pid"/u);
  assert.match(runner, /rm -rf -- "\$temp_dir"/u);
  assert.match(runner, /--tools-version v1\.52/u);
  assert.match(runner, /--skip-tools-install/u);
  assert.match(runner, /-- --locked/u);
  for (const diagnostic of [
    "Stack offset of",
    "stack frame.*exceeds",
    "max offset exceeded",
    "overwrites values",
    "undefined behavior",
  ]) {
    assert(runner.includes(diagnostic));
  }
  assert.match(runner, /--account "\$POSITION"/u);
  assert.match(runner, /--account "\$TREASURY"/u);
  assert.match(runner, /--account "\$ECOSYSTEM"/u);
  assert.match(runner, /--account "\$LIQUIDITY"/u);
  assert.match(runner, /--mode law-first/u);
  assert.match(runner, /--mode late-failure/u);
  assert.match(runner, /--mode success/u);
});

test("driver freezes exact four-state success and rollback observations without release overclaim", async () => {
  const driver = await text("../scripts/iat-b3-close-position-local-driver.mjs");
  assert.match(driver, /CLOSE_POSITION_OPCODE = 11/u);
  assert.match(driver, /FULL_SETTLEMENT_MASK = \(1n << USER_TERM_WEEKS\) - 1n/u);
  assert.match(driver, /position\.writeBigUInt64LE\(0n, 128\)/u);
  assert.match(driver, /position\.writeBigUInt64LE\(0n, 136\)/u);
  assert.match(driver, /position\.writeBigUInt64LE\(0n, 144\)/u);
  assert.match(driver, /position\[174\] = 1/u);
  assert.match(driver, /data\.writeBigUInt64LE\(data\.readBigUInt64LE\(144\) - release, 144\)/u);
  assert.match(driver, /assertRollback\(after, before\)/u);
  assert.match(driver, /sponsorBalance/u);
  assert.match(driver, /callerBalance/u);
  assert.match(driver, /raw bytes changed/u);
  assert.match(driver, /productionProgramErrorAbiProven: false/u);
  assert.match(driver, /productionDispatcherProven: false/u);
  assert.match(driver, /productionEntrypointProven: false/u);
  assert.match(driver, /productionFinalBinaryProven: false/u);
  assert.match(driver, /publicDevnetExecuted: false/u);
  assert.match(driver, /all15HandlersComplete: false/u);
  assert.match(driver, /mainnetExecutionAuthorized: false/u);
  assert.match(driver, /mainnetStatus: "HOLD"/u);
});

test("evidence, when generated, is source-bound and preserves HOLD", async (context) => {
  const url = new URL(
    "../docs/b3/evidence/local-validator-close-position-production-handler-20260812.json",
    import.meta.url,
  );
  try {
    await access(url);
  } catch {
    context.skip("evidence is generated only after the exact loopback run passes");
    return;
  }
  const evidence = JSON.parse(await readFile(url, "utf8"));
  assert.equal(evidence.schema, "iat-b3-close-position-production-handler-loopback/v1");
  assert.equal(evidence.status, "PASS");
  assert.equal(evidence.productionClosePositionHandlerSbfExecutionObserved, true);
  assert.equal(evidence.runtimeDailyLawBeforeDecodeObserved, true);
  assert.equal(evidence.exactFourStateCasObserved, true);
  assert.equal(evidence.lateFailureFourStateTransactionRollbackObserved, true);
  assert.equal(evidence.temporaryLedgerRemoved, true);
  assert.equal(evidence.validatorStopped, true);
  assert.equal(evidence.generatedKeyMaterialRemoved, true);
  for (const property of [
    "buildSourceClosureVerified",
    "productionComputeBudgetProven",
    "productionProgramErrorAbiProven",
    "productionDispatcherProven",
    "productionEntrypointProven",
    "productionFinalCombinedBinaryProven",
    "productionIdentitiesFrozen",
    "publicDevnetExecuted",
    "adversarialFinalBinaryDevnetComplete",
    "all15HandlersComplete",
    "releaseGraphNodeComplete",
    "activationReady",
    "mainnetExecutionAuthorized",
  ]) {
    assert.equal(evidence[property], false, `${property} overclaimed`);
  }
  assert.equal(evidence.mainnetStatus, "HOLD");
});

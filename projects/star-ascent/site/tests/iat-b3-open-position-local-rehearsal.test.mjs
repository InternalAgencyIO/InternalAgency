import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function text(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("OpenPosition rehearsal is isolated, loopback-only, and cleans every disposable resource", async () => {
  const [runner, readme, ignore] = await Promise.all([
    text("../scripts/run-iat-b3-open-position-local.sh"),
    text("./fixtures/iat-b3-open-position/README.md"),
    text("./fixtures/iat-b3-open-position/.gitignore"),
  ]);
  assert.match(runner, /set -euo pipefail/u);
  assert.match(runner, /http:\/\/127\.0\.0\.1:/u);
  assert.match(runner, /mktemp -d \/tmp\/iat-b3-open-position/u);
  assert.match(runner, /trap finish EXIT/u);
  assert.match(runner, /kill "\$validator_pid"/u);
  assert.match(runner, /rm -rf -- "\$temp_dir"/u);
  assert.match(runner, /rm -f -- "\$economy_generated_keypair" "\$law_generated_keypair"/u);
  assert.doesNotMatch(runner, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
  assert.match(readme, /not a member of the production workspace/u);
  assert.match(readme, /not prove a production dispatcher/u);
  assert.match(readme, /Mainnet hold remains active/u);
  assert.equal(ignore.trim(), "/target/");
});

test("fixture imports the real production OpenPosition executor behind its exact feature", async () => {
  const [workspace, economyManifest, lawManifest, economy] = await Promise.all([
    text("./fixtures/iat-b3-open-position/Cargo.toml"),
    text("./fixtures/iat-b3-open-position/economy/Cargo.toml"),
    text("./fixtures/iat-b3-open-position/law-hook/Cargo.toml"),
    text("./fixtures/iat-b3-open-position/economy/src/lib.rs"),
  ]);
  assert.match(workspace, /members = \["economy", "law-hook"\]/u);
  assert.match(
    economyManifest,
    /features = \["runtime-production-open-position-executor"\]/u,
  );
  assert.match(economyManifest, /\.\.\/\.\.\/\.\.\/\.\.\/programs\/iat_b3_economy/u);
  assert.match(lawManifest, /\.\.\/\.\.\/\.\.\/\.\.\/programs\/iat_b3_consensus/u);
  assert.match(economy, /execute_runtime_production_open_position_account_infos\(/u);
  assert.match(economy, /&accounts\[16\]/u);
  assert.match(economy, /accounts\.len\(\) != 17 && accounts\.len\(\) != 18/u);
  assert.match(economy, /production_instruction,/u);
  const executor = economy.indexOf("execute_runtime_production_open_position_account_infos(");
  const lateFailure = economy.indexOf("InjectedAfterExecutorSuccess", executor);
  assert(executor >= 0 && lateFailure > executor);
  assert.doesNotMatch(economy, /sbf_preflight::process_instruction/u);
});

test("law hook owns an exact one-meta Law TLV and revalidates current consensus disposition", async () => {
  const law = await text("./fixtures/iat-b3-open-position/law-hook/src/lib.rs");
  assert.match(law, /ExtraAccountMetaList::size_of\(1\)/u);
  assert.match(law, /&\[law_meta\]/u);
  assert.match(law, /ExtraAccountMeta::new_with_pubkey\(law_state\.key, false, false\)/u);
  assert.match(law, /law_state_address\(&LAW_HOOK_PROGRAM_ID, mint\)/u);
  assert.match(law, /data\[9\] != expected_bump/u);
  assert.match(law, /protocol_local_day\(clock\.unix_timestamp\)/u);
  assert.match(law, /iat_transfer_disposition\(/u);
  assert.match(law, /IatTransferDisposition::Allowed/u);
  assert.match(law, /StateWithExtensions::<TokenAccount>::unpack/u);
  assert.match(law, /!bool::from\(hook\.transferring\)/u);
  assert.match(law, /destination\.key != &stake_vault \|\| authority\.key != &ingress_authority/u);
  assert.match(law, /INJECTED_HOOK_FAILURE_AMOUNT/u);
});

test("runner rejects every canonical SBF compiler diagnostic before local execution", async () => {
  const runner = await text("../scripts/run-iat-b3-open-position-local.sh");
  assert.match(runner, /--bpf-stack-size=4096/u);
  assert.match(runner, /--tools-version v1\.52/u);
  assert.match(runner, /--skip-tools-install/u);
  assert.match(runner, /-- --locked/u);
  for (const fragment of [
    "Stack offset of",
    "stack frame.*exceeds",
    "max offset exceeded",
    "overwrites values",
    "undefined behavior",
  ]) {
    assert(runner.includes(fragment));
  }
  const diagnosticGate = runner.indexOf("if grep -Eiq \"$canonical_diagnostics\"");
  const validator = runner.indexOf('phase="validator_start"');
  assert(diagnosticGate >= 0 && diagnosticGate < validator);
});

test("driver pins canonical confidential-hook mint, exact graph, and finalized readback", async () => {
  const driver = await text("../scripts/iat-b3-open-position-local-driver.mjs");
  assert.match(driver, /MAINNET_SUPPLY = 1_000_000_000_000_000_000n/u);
  assert.match(driver, /ExtensionType\.ConfidentialTransferMint/u);
  assert.match(driver, /ExtensionType\.TransferHook/u);
  assert.match(driver, /confidential\.subarray\(0, 32\)\.equals\(Buffer\.alloc\(32\)\)/u);
  assert.match(driver, /confidential\[32\], 1/u);
  assert.match(driver, /hook\.authority\.equals\(ZERO_PUBLIC_KEY\)/u);
  assert.match(driver, /hook\.programId\.equals\(LAW_HOOK_PROGRAM_ID\)/u);
  assert.match(driver, /ExtensionType\.TransferHookAccount/u);
  assert.match(driver, /ZK_ELGAMAL_PROOF_PROGRAM_ID/u);
  assert.match(driver, /keys\.push\(\{ pubkey: addresses\.priorDelegate/u);
  assert.match(driver, /commitment: "finalized"/u);
  assert.match(driver, /getTransaction\(signature/u);
  assert.match(driver, /computeUnitsConsumed/u);
  assert.equal((driver.match(/sendRawTransaction\(/gu) ?? []).length, 1);
});

test("matrix proves hook, lifecycle, and late-state transaction rollback plus both valid lifecycle paths", async () => {
  const driver = await text("../scripts/iat-b3-open-position-local-driver.mjs");
  for (const label of [
    "locked-law-first",
    "hook-rejection",
    "lifecycle-rollback",
    "post-success-wrapper-rollback",
    "vacant-17-success",
    "prefunded-18-success",
  ]) {
    assert(driver.includes(`\"${label}\"`), `missing ${label}`);
  }
  assert.match(driver, /assertRollback\(hookBefore/u);
  assert.match(driver, /Position lifecycle failure/u);
  assert.match(driver, /post-success wrapper failure/u);
  assert.match(driver, /sourceRaw: compactRaw/u);
  assert.match(driver, /stakeRaw: compactRaw/u);
  assert.match(driver, /owner: compactRaw/u);
  assert.match(driver, /decodeConfig/u);
  assert.match(driver, /decodeLane/u);
  assert.match(driver, /decodePosition/u);
  assert.match(driver, /treasuryReservation: 16_000_000_000_000_000n/u);
  assert.match(driver, /ecosystemReservation: 37_500_000_000_000_000n/u);
  assert.match(driver, /liquidityReservation: 6_500_000_000_000_000n/u);
  assert.match(driver, /delegatedAmount: PRIOR_ALLOWANCE/u);
});

test("evidence truth stays narrowly local and keeps every release boundary false", async () => {
  const driver = await text("../scripts/iat-b3-open-position-local-driver.mjs");
  for (const falseTruth of [
    "productionComputeBudgetProven",
    "productionProgramErrorAbiProven",
    "productionDispatcherProven",
    "productionEntrypointProven",
    "productionFinalCombinedBinaryProven",
    "productionIdentitiesFrozen",
    "productionGenesisTokenDistributionConservationProven",
    "activationLifecycleProven",
    "fundingCeremonyProven",
    "adversarialDevnetProven",
    "mainnetExecutionAuthorized",
  ]) {
    assert.match(driver, new RegExp(`${falseTruth}: false`, "u"));
  }
  assert.match(driver, /syntheticFixtureInstructionWrapper: true/u);
  assert.match(driver, /syntheticProgramErrorMapping: true/u);
  assert.match(driver, /mainnetHold: true/u);
  assert.match(driver, /flag: "wx"/u);
});

test("generated evidence, when present, is source-bound and cleanup-finalized", async (context) => {
  const url = new URL(
    "../docs/b3/evidence/local-validator-open-position-production-executor-20260811.json",
    import.meta.url,
  );
  try {
    await access(url);
  } catch {
    context.skip("evidence is generated only after the exact loopback run passes");
    return;
  }
  const [recordText, economy, law, driver, runner, cargoLock] = await Promise.all([
    readFile(url, "utf8"),
    text("./fixtures/iat-b3-open-position/economy/src/lib.rs"),
    text("./fixtures/iat-b3-open-position/law-hook/src/lib.rs"),
    text("../scripts/iat-b3-open-position-local-driver.mjs"),
    text("../scripts/run-iat-b3-open-position-local.sh"),
    text("./fixtures/iat-b3-open-position/Cargo.lock"),
  ]);
  const record = JSON.parse(recordText);
  assert.equal(record.status, "PASS");
  assert.equal(record.scope.publicNetworkWrites, false);
  assert.equal(record.cleanup.temporaryLedgerRemoved, true);
  assert.equal(record.cleanup.validatorStopped, true);
  assert.equal(record.cleanup.generatedKeyMaterialRemoved, true);
  assert.equal(record.fixture.economySourceSha256, sha256(economy));
  assert.equal(record.fixture.lawHookSourceSha256, sha256(law));
  assert.equal(record.fixture.driverSha256, sha256(driver));
  assert.equal(record.fixture.runnerSha256, sha256(runner));
  assert.equal(record.fixture.cargoLockSha256, sha256(cargoLock));
  assert.equal(record.build.cargoBuildSbfExitCode, 0);
  assert.equal(record.build.canonicalCompilerDiagnosticsPresent, false);
  assert.equal(record.observed.realProductionOpenPositionExecutorInvoked, true);
  assert.equal(record.observed.loopbackFinalizedTransactionRollbackProven, true);
  assert.equal(record.limits.productionGenesisTokenDistributionConservationProven, false);
  assert.equal(record.limits.adversarialDevnetProven, false);
  assert.equal(record.limits.mainnetExecutionAuthorized, false);
  assert.equal(record.limits.mainnetHold, true);
});

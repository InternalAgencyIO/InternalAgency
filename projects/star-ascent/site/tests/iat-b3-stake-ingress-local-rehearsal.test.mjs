import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function text(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const deprecatedIngressTerm = new RegExp(["account", "less"].join(""), "iu");

test("stake-ingress rehearsal stays loopback-only and owns cleanup", async () => {
  const [runner, packageText, workflow] = await Promise.all([
    text("../scripts/run-iat-b3-stake-ingress-local-rehearsal.sh"),
    text("../package.json"),
    text("../../../../.github/workflows/iat-v2-proof.yml"),
  ]);
  assert.match(runner, /set -euo pipefail/u);
  assert.match(runner, /http:\/\/127\.0\.0\.1:/u);
  assert.match(runner, /trap finish EXIT/u);
  assert.match(runner, /rm -rf -- "\$temp_dir"/u);
  assert.match(runner, /rm -f -- "\$economy_generated_keypair" "\$hook_generated_keypair"/u);
  assert.match(runner, /validatorStopped/u);
  assert.match(runner, /generatedKeyMaterialRemoved/u);
  assert.match(runner, /publicNetworkWrites/u);
  assert.doesNotMatch(runner, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
  const packageJson = JSON.parse(packageText);
  assert.match(
    packageJson.scripts["check:iat-b3-spec"],
    /tests\/iat-b3-stake-ingress-local-rehearsal\.test\.mjs/u,
  );
  assert.match(workflow, /--version 5\.5\.0[\s\S]+spl-token-cli/u);
  assert.match(
    workflow,
    /Rehearse B3 production-source Token-2022 stake ingress[\s\S]+run-iat-b3-stake-ingress-local-rehearsal\.sh/u,
  );
});

test("stake-ingress rehearsal pins a bounded compute budget before every fixture instruction", async () => {
  const driver = await text("../scripts/iat-b3-stake-ingress-local-rehearsal-driver.mjs");
  assert.match(driver, /const REHEARSAL_COMPUTE_UNIT_LIMIT = 400_000;/u);
  assert.match(
    driver,
    /new Transaction\(\)\.add\([\s\S]+ComputeBudgetProgram\.setComputeUnitLimit\(\{ units: REHEARSAL_COMPUTE_UNIT_LIMIT \}\)[\s\S]+\.\.\.instructions/u,
  );
  assert.equal((driver.match(/sendAndConfirmTransaction\(/gu) ?? []).length, 1);
});

test("fixture imports only the feature-gated production executor and freezes exact dependencies", async () => {
  const [productionWorkspace, fixtureWorkspace, fixtureEconomy, readme, ignore] = await Promise.all([
    text("../Cargo.toml"),
    text("./fixtures/iat-b3-stake-ingress/Cargo.toml"),
    text("./fixtures/iat-b3-stake-ingress/economy/Cargo.toml"),
    text("./fixtures/iat-b3-stake-ingress/README.md"),
    text("./fixtures/iat-b3-stake-ingress/.gitignore"),
  ]);
  assert.doesNotMatch(productionWorkspace, /iat-b3-stake-ingress/u);
  assert.match(fixtureWorkspace, /members = \["economy", "hook"\]/u);
  assert.match(
    fixtureEconomy,
    /iat-b3-economy = \{ path = "\.\.\/\.\.\/\.\.\/\.\.\/programs\/iat_b3_economy", features = \["runtime-token-2022-stake-ingress"\] \}/u,
  );
  assert.match(fixtureEconomy, /iat-b3-consensus = \{ path = "\.\.\/\.\.\/\.\.\/\.\.\/programs\/iat_b3_consensus" \}/u);
  assert.match(fixtureEconomy, /solana-clock = \{ version = "=3\.2\.0", features = \["sysvar"\] \}/u);
  for (const version of [
    "solana-account-info = \"=3.1.1\"",
    "solana-cpi = \"=3.1.0\"",
    "spl-token-2022-interface = \"=2.1.0\"",
    "spl-transfer-hook-interface = \"=2.1.0\"",
  ]) {
    assert(fixtureWorkspace.includes(version));
  }
  assert.match(readme, /not members of the production program workspace/u);
  assert.match(
    readme,
    /Neither binary, program ID, nor\s+source file is a deployment candidate/u,
  );
  assert.match(readme, /Stateless.*protocol property/su);
  assert.match(readme, /no account-existence, lamports, owner, data,/u);
  assert.match(readme, /ignored\s+fixture target directory/u);
  assert.doesNotMatch(readme, deprecatedIngressTerm);
  assert.equal(ignore.trim(), "/target/");
});

test("disposable programs encode the reviewed runtime boundary", async () => {
  const [economy, hook, runtime] = await Promise.all([
    text("./fixtures/iat-b3-stake-ingress/economy/src/lib.rs"),
    text("./fixtures/iat-b3-stake-ingress/hook/src/lib.rs"),
    text("../programs/iat_b3_economy/src/stake_ingress_runtime.rs"),
  ]);
  assert.match(economy, /execute_daily_law_authenticated_stake_ingress\(/u);
  assert.match(runtime, /approve_checked\(/u);
  assert.match(runtime, /add_extra_accounts_for_execute_cpi\(/u);
  assert.match(runtime, /invoke_signed\(/u);
  assert.match(runtime, /verify_ingress_approval\(/u);
  assert.match(runtime, /apply_transfer_and_retained_v2_finalizer\(/u);
  assert.match(runtime, /complete_stake_ingress\(/u);
  assert.match(runtime, /persist_transaction_local_state\(plan, &completed\)/u);
  assert.match(runtime, /retained_v2_post_cpi_finalizer_executed: true/u);
  assert.match(runtime, /persistence_callback_after_restoration: true/u);
  assert.match(runtime, /retained_v2_post_cpi_persistence_complete: false/u);
  assert.match(runtime, /daily_law_capability_reauthenticated: true/u);
  assert.match(runtime, /canonical_mint_policy_reauthenticated: false/u);
  assert.match(economy, /b"stake-ingress"/u);
  assert.match(runtime, /DelegateNotConsumed/u);
  assert.match(runtime, /DelegateRestorationMismatch/u);
  assert.match(runtime, /pub fn execute_daily_law_authenticated_stake_ingress/u);
  assert.match(runtime, /fn authenticate_daily_law/u);
  assert.match(runtime, /fn bind_stake_ingress_accounts/u);
  assert.match(runtime, /Box<PrepareOpenPositionInput>/u);
  assert.match(runtime, /Box<StakeIngressExecutionPlan>/u);
  const lawAuthentication = runtime.indexOf("authenticate_daily_law(");
  const accountBinding = runtime.indexOf("bind_stake_ingress_accounts(");
  const tokenExecution = runtime.indexOf("execute_prepared_stake_ingress(", accountBinding);
  assert(lawAuthentication >= 0 && lawAuthentication < accountBinding);
  assert(accountBinding < tokenExecution);
  assert.match(economy, /TOKEN_DECIMALS\.saturating_add\(1\)/u);
  assert.doesNotMatch(economy, /ingress_authority\.(?:lamports|owner|data|executable)/u);
  assert.match(hook, /TransferHookAccount/u);
  assert.match(hook, /!bool::from\(hook\.transferring\)/u);
  assert.match(hook, /authority\.is_signer/u);
  assert.match(hook, /authority\.key != &ingress_authority/u);
  assert.match(hook, /UnauthorizedStakeIngress/u);
  assert.doesNotMatch(hook, /authority\.(?:lamports|owner|data|executable)/u);
});

test("funded stateless PDA state cannot grief either successful path", async () => {
  const driver = await text("../scripts/iat-b3-stake-ingress-local-rehearsal-driver.mjs");
  const funding = driver.indexOf("const ingressFunding = await send");
  const noDelegateSuccess = driver.indexOf("const noDelegateSuccess = await send");
  const restorationSuccess = driver.indexOf("const restorationSuccess = await send");
  assert(funding >= 0);
  assert(funding < noDelegateSuccess);
  assert(funding < restorationSuccess);
  assert.match(driver, /assert\.equal\(ingressBeforeFunding, null\)/u);
  assert.match(driver, /lamports: ingressFundingLamports/u);
  assert.match(driver, /fundedIngress\.owner\.equals\(SystemProgram\.programId\)/u);
  assert.match(driver, /fundedIngress\.data\.length, 0/u);
  assert.match(driver, /fundedIngress\.executable, false/u);
  assert.match(driver, /fundedBeforeBothSuccessCases: true/u);
  assert.match(driver, /createExecuteInstruction\(/u);
  assert.match(driver, /direct hook invocation without Token-2022 transfer context/u);
  assert.match(driver, /custom program error: 0x66/u);
  assert.match(driver, /directHookFailure/u);
  assert.doesNotMatch(driver, deprecatedIngressTerm);
});

test("current production-executor record binds source and preserves the release hold", async () => {
  const [recordText, runtime, pureStakeIngress, economy, hook, runner, driver, cargoLock] = await Promise.all([
    text("../docs/b3/evidence/local-validator-stake-ingress-production-executor-20260810.json"),
    text("../programs/iat_b3_economy/src/stake_ingress_runtime.rs"),
    text("../programs/iat_b3_economy/src/stake_ingress.rs"),
    text("./fixtures/iat-b3-stake-ingress/economy/src/lib.rs"),
    text("./fixtures/iat-b3-stake-ingress/hook/src/lib.rs"),
    text("../scripts/run-iat-b3-stake-ingress-local-rehearsal.sh"),
    text("../scripts/iat-b3-stake-ingress-local-rehearsal-driver.mjs"),
    text("./fixtures/iat-b3-stake-ingress/Cargo.lock"),
  ]);
  const record = JSON.parse(recordText);
  assert.equal(record.status, "PASS");
  assert.equal(record.scope.publicNetworkWrites, false);
  assert.equal(record.cleanup.temporaryLedgerRemoved, true);
  assert.equal(record.cleanup.validatorStopped, true);
  assert.equal(record.fixture.productionCandidate, false);
  assert.equal(record.productionExecutor.sourceSha256, sha256(runtime));
  assert.equal(record.productionExecutor.pureStakeIngressSourceSha256, sha256(pureStakeIngress));
  assert.equal(record.productionExecutor.publicEntrypoint, false);
  assert.equal(record.productionExecutor.retainedV2PostCpiPersistenceComplete, false);
  assert.equal(record.productionExecutor.retainedV2PostCpiFinalizerExecuted, true);
  assert.equal(record.productionExecutor.persistenceCallbackAfterRestoration, true);
  assert.equal(record.productionExecutor.dailyLawCapabilityReauthenticated, true);
  assert.equal(record.productionExecutor.canonicalConfidentialMintPolicyReauthenticated, false);
  assert.equal(record.limits.combinedDailyLawDecisionAndStakeIngressHookProven, true);
  assert.equal(record.limits.productionEconomyEntrypointProven, false);
  assert.equal(record.limits.productionIdentitiesFrozen, false);
  assert.equal(record.productionExecutor.v2EconomicMathChanged, false);
  assert.equal(record.observed.productionSourceExecutorInvoked, true);
  assert.equal(record.observed.boundedComputeUnitLimit, 400000);
  assert.equal(record.observed.transferHookExtraAccountsResolvedFromTlv, true);
  assert.equal(record.observed.dailyLawAddressForwardedThroughHookValidation, true);
  assert.equal(record.observed.dailyLawOpenDecisionAuthenticatedByThisFixture, true);
  assert.equal(record.observed.dailyLawAuthenticatedBeforeTokenAccountParsing, true);
  assert.equal(record.observed.unfinalizedDailyLawRejectedBeforeTokenMutation, true);
  assert.equal(record.observed.lockedDailyLawRejectedBeforeTokenMutation, true);
  assert.equal(record.observed.lockedDailyLawPrecededHostileTokenParsing, true);
  assert.equal(record.observed.substitutedDailyLawRejectedBeforeTokenMutation, true);
  assert.equal(record.observed.sbfStackFrameLimitSatisfied, true);
  assert.equal(record.observed.retainedV2PostCpiFinalizerExecuted, true);
  assert.equal(record.observed.persistenceCallbackRanAfterExactDelegateRestoration, true);
  assert.equal(record.observed.postFinalizerPersistenceCallbackFailureRolledBackFullSequence, true);
  assert.doesNotMatch(recordText, deprecatedIngressTerm);
  assert.equal(record.fixture.economy.sourceSha256, sha256(economy));
  assert.equal(record.fixture.hook.sourceSha256, sha256(hook));
  assert.equal(record.fixture.runnerSha256, sha256(runner));
  assert.equal(record.fixture.driverSha256, sha256(driver));
  assert.equal(record.fixture.cargoLockSha256, sha256(cargoLock));
});

test("combined Law and stake-ingress rehearsal builds one dynamic fixture-bound Law ELF", async () => {
  const [runner, driver, workflow, manifest, fixture, readme] = await Promise.all([
    text("../scripts/run-iat-b3-combined-law-stake-local-rehearsal.sh"),
    text("../scripts/iat-b3-combined-law-stake-local-rehearsal-driver.mjs"),
    text("../../../../.github/workflows/iat-v2-proof.yml"),
    text("./fixtures/iat-b3-combined-law-stake/Cargo.toml"),
    text("./fixtures/iat-b3-combined-law-stake/src/lib.rs"),
    text("./fixtures/iat-b3-combined-law-stake/README.md"),
  ]);
  assert.match(runner, /http:\/\/127\.0\.0\.1:\$\{rpc_port\}/u);
  assert.doesNotMatch(runner, /api\.(?:devnet|mainnet-beta)\.solana\.com/iu);
  assert.match(runner, /IAT_B3_PRODUCTION_CANONICAL_MINT="\$mint_pubkey"/u);
  assert.doesNotMatch(runner, /IAT_B3_PRODUCTION_CANONICAL_MINT="3JF3/u);
  assert.match(runner, /--no-default-features[\s\S]+--features production-combined-hook/u);
  assert.match(runner, /--bpf-program "\$law_id" "\$law_artifact"/u);
  assert.equal((runner.match(/law_artifact="\$deploy_dir\/iat_b3_law\.so"/gu) ?? []).length, 1);
  assert.match(runner, /for variant in missing stale open locked forged/u);
  assert.match(runner, /trap finish EXIT/u);
  assert.match(runner, /rm -rf -- "\$temp_dir"/u);
  assert.match(runner, /generatedKeyMaterialRemoved/u);
  assert.match(runner, /"statusGate":"HOLD"/u);
  assert.match(driver, /lawFinalizerAndHookSha256Equal: true/u);
  assert.match(driver, /permissionlessFinalizeSignature/u);
  assert.match(driver, /finalizerAuthoritySignerRequired: false/u);
  assert.match(driver, /DETERMINISTIC_SYNTHETIC_GATE_VARIANTS_NOT_FINALIZER_PROVENANCE/u);
  assert.match(
    manifest,
    /iat-b3-economy = \{ path = "\.\.\/\.\.\/\.\.\/programs\/iat_b3_economy", features = \["runtime-token-2022-stake-ingress"\] \}/u,
  );
  assert.match(fixture, /execute_daily_law_authenticated_stake_ingress\(/u);
  assert.match(fixture, /additional_hook_accounts: core::slice::from_ref\(law_state\)/u);
  assert.match(fixture, /Pubkey::find_program_address\(&\[b"law-state", mint\.key\.as_ref\(\)\], &LAW_PROGRAM_ID\)/u);
  assert.doesNotMatch(fixture, /ingress_authority\.is_signer/u);
  assert.match(readme, /exact single ELF[\s\S]+Daily Law finalizer and Token-2022 Transfer Hook/u);
  assert.match(workflow, /tests\/fixtures\/iat-b3-combined-law-stake\/Cargo\.toml/u);
  assert.match(
    workflow,
    /run-iat-b3-combined-law-stake-local-rehearsal\.sh --require-tools[\s\S]+iat-b3-combined-law-stake-local-rehearsal\.jsonl/u,
  );
});

test("combined rehearsal asserts real hook context, ingress semantics, rollback, and immutable HOLDs", async () => {
  const [driver, runner] = await Promise.all([
    text("../scripts/iat-b3-combined-law-stake-local-rehearsal-driver.mjs"),
    text("../scripts/run-iat-b3-combined-law-stake-local-rehearsal.sh"),
  ]);
  assert.match(driver, /createTransferCheckedWithTransferHookInstruction\(/u);
  assert.match(driver, /createExecuteInstruction\(/u);
  assert.match(driver, /direct hook invocation without Token-2022 transfer context/u);
  assert.match(driver, /owner-authorized canonical stake-vault donation/u);
  assert.match(driver, /noDelegateConsumedAndCleared: true/u);
  assert.match(driver, /priorDelegateRestoredExactly: true/u);
  assert.match(driver, /ingressPdaFundedStatelessAdversary: true/u);
  assert.match(driver, /rawDataSha256: sha256\(raw\.data\)/u);
  assert.match(driver, /assertSnapshotEqual\(/u);
  for (const code of ["0xB30B", "0xB30C", "0xB30D"]) assert(driver.includes(code));
  for (const falseClaim of [
    "fixtureProductionCandidate: false",
    "productionEconomyEntrypoint: false",
    "productionEconomyDispatcher: false",
    "retainedV2PersistenceComplete: false",
    "all15Adapters: false",
    "finalBinary: false",
    "devnetExecuted: false",
    "mainnetExecuted: false",
    "graphNodeCompleted: false",
    "releaseAuthorized: false",
    "mainnetExecutionAuthorized: false",
  ]) assert(driver.includes(falseClaim), `missing false/HOLD claim ${falseClaim}`);
  assert.match(runner, /unsafe_diagnostic='Stack offset of\|stack frame/u);
  assert.match(runner, /temporaryLedgerRemoved/u);
  assert.match(runner, /syntheticVariantsFinalizerProvenance/u);
  assert.doesNotMatch(`${driver}\n${runner}`, /(?:deploy|program deploy|mainnet-beta|api\.devnet)\.solana\.com/iu);
});

test("combined rehearsal evidence replays exact source hashes without launch overclaim", async () => {
  const [recordText, law, ingress, build, fixture, manifest, lock, runner, driver] = await Promise.all([
    text("../docs/b3/evidence/local-validator-combined-law-stake-rehearsal-20260812.json"),
    text("../programs/iat_b3_law/src/lib.rs"),
    text("../programs/iat_b3_law/src/stake_ingress.rs"),
    text("../programs/iat_b3_law/build.rs"),
    text("./fixtures/iat-b3-combined-law-stake/src/lib.rs"),
    text("./fixtures/iat-b3-combined-law-stake/Cargo.toml"),
    text("./fixtures/iat-b3-combined-law-stake/Cargo.lock"),
    text("../scripts/run-iat-b3-combined-law-stake-local-rehearsal.sh"),
    text("../scripts/iat-b3-combined-law-stake-local-rehearsal-driver.mjs"),
  ]);
  const record = JSON.parse(recordText);
  assert.equal(record.schema, "iat-b3-combined-law-stake-local-validator-record/v1");
  assert.equal(record.status, "PASS_HOLD");
  assert.equal(record.observed.oneLawElfForFinalizerAndHook, true);
  assert.equal(record.observed.productionSourceIngressExecutorExercised, true);
  assert.equal(record.observed.realToken2022HookContext, true);
  assert.equal(record.observed.rawAndBalanceRollbackAsserted, true);
  assert.equal(record.observed.syntheticVariantsFinalizerProvenance, false);
  assert.equal(record.scope.publicNetworkWrites, false);
  assert.equal(record.scope.devnetExecuted, false);
  assert.equal(record.scope.mainnetExecuted, false);
  assert.equal(record.scope.mainnetExecutionAuthorized, false);
  assert.equal(record.scope.finalBinary, false);
  assert.equal(record.source.lawLibSha256, sha256(law));
  assert.equal(record.source.lawStakeIngressSha256, sha256(ingress));
  assert.equal(record.source.lawBuildScriptSha256, sha256(build));
  assert.equal(record.source.fixtureLibSha256, sha256(fixture));
  assert.equal(record.source.fixtureManifestSha256, sha256(manifest));
  assert.equal(record.source.fixtureLockSha256, sha256(lock));
  assert.equal(record.source.runnerSha256, sha256(runner));
  assert.equal(record.source.driverSha256, sha256(driver));
  assert.equal(record.cleanup.temporaryLedgerRemoved, true);
  assert.equal(record.cleanup.validatorStopped, true);
  assert.equal(record.cleanup.generatedKeyMaterialRemoved, true);
});

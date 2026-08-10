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

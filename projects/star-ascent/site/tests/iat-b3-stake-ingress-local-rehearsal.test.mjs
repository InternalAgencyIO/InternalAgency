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
  const [runner, packageText] = await Promise.all([
    text("../scripts/run-iat-b3-stake-ingress-local-rehearsal.sh"),
    text("../package.json"),
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
});

test("fixture is isolated from production programs and freezes exact dependencies", async () => {
  const [productionWorkspace, fixtureWorkspace, readme, ignore] = await Promise.all([
    text("../Cargo.toml"),
    text("./fixtures/iat-b3-stake-ingress/Cargo.toml"),
    text("./fixtures/iat-b3-stake-ingress/README.md"),
    text("./fixtures/iat-b3-stake-ingress/.gitignore"),
  ]);
  assert.doesNotMatch(productionWorkspace, /iat-b3-stake-ingress/u);
  assert.match(fixtureWorkspace, /members = \["economy", "hook"\]/u);
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
  const [economy, hook] = await Promise.all([
    text("./fixtures/iat-b3-stake-ingress/economy/src/lib.rs"),
    text("./fixtures/iat-b3-stake-ingress/hook/src/lib.rs"),
  ]);
  assert.match(economy, /approve_checked\(/u);
  assert.match(economy, /invoke_signed\(/u);
  assert.match(economy, /b"stake-ingress"/u);
  assert.match(economy, /DelegateNotConsumed/u);
  assert.match(economy, /DelegateRestorationMismatch/u);
  assert.match(economy, /TOKEN_DECIMALS\.saturating_add\(1\)/u);
  assert.doesNotMatch(
    economy,
    /ingress_authority\.(?:lamports|owner|data|executable)/u,
  );
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

test("frozen record binds source and states the remaining production gap", async () => {
  const [recordText, economy, hook, runner, driver, cargoLock, localDoc] = await Promise.all([
    text("../docs/b3/evidence/local-validator-stake-ingress-rehearsal-20260809.json"),
    text("./fixtures/iat-b3-stake-ingress/economy/src/lib.rs"),
    text("./fixtures/iat-b3-stake-ingress/hook/src/lib.rs"),
    text("../scripts/run-iat-b3-stake-ingress-local-rehearsal.sh"),
    text("../scripts/iat-b3-stake-ingress-local-rehearsal-driver.mjs"),
    text("./fixtures/iat-b3-stake-ingress/Cargo.lock"),
    text("../docs/b3/LOCAL_VALIDATOR_REHEARSAL.md"),
  ]);
  const record = JSON.parse(recordText);
  assert.equal(record.status, "PASS");
  assert.equal(record.scope.publicNetworkWrites, false);
  assert.equal(record.cleanup.temporaryLedgerRemoved, true);
  assert.equal(record.cleanup.validatorStopped, true);
  assert.equal(record.fixture.productionCandidate, false);
  assert.equal(record.limits.combinedDailyLawAndStakeIngressHookProven, false);
  assert.equal(record.limits.productionEconomyEntrypointProven, false);
  assert.equal(record.limits.productionIdentitiesFrozen, false);
  assert.equal(record.limits.v2EconomicMathChanged, false);
  assert.equal(record.observed.statelessIngressPdaInvokeSignedTransferChecked, true);
  assert.equal(record.observed.statelessIngressPdaHasNoStatePrerequisite, true);
  assert.deepEqual(record.observed.hookTransferContextRequired, {
    directInvocationRejected: true,
    customError: 102,
    balancesAndDelegateUnchanged: true,
  });
  assert.deepEqual(record.observed.ingressPdaFundingAdversary, {
    absentBeforeFunding: true,
    fundedBeforeBothSuccessCases: true,
    lamports: 1_000_000,
    owner: "11111111111111111111111111111111",
    dataLength: 0,
    executable: false,
    bothSuccessCasesPassedAfterFunding: true,
    noLamportsPrerequisite: true,
    noOwnerPrerequisite: true,
    noDataPrerequisite: true,
    noExecutablePrerequisite: true,
  });
  assert.doesNotMatch(recordText, deprecatedIngressTerm);
  assert.equal(record.fixture.economy.sourceSha256, sha256(economy));
  assert.equal(record.fixture.hook.sourceSha256, sha256(hook));
  assert.equal(record.fixture.runnerSha256, sha256(runner));
  assert.equal(record.fixture.driverSha256, sha256(driver));
  assert.equal(record.fixture.cargoLockSha256, sha256(cargoLock));
  assert(
    localDoc.indexOf("For that Daily Law runner")
      < localDoc.indexOf("## Stake-ingress primitive rehearsal"),
  );
});

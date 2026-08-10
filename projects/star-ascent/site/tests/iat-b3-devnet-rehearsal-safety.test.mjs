import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DEVNET_RPC = "https://api.devnet.solana.com";

const wrapperUrl = new URL(
  "../scripts/run-iat-b3-devnet-rehearsal.sh",
  import.meta.url,
);
const driverUrl = new URL(
  "../scripts/iat-b3-devnet-rehearsal-driver.mjs",
  import.meta.url,
);
const documentationUrl = new URL("../docs/b3/DEVNET_REHEARSAL.md", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);
const workflowUrl = new URL("../../../../.github/workflows/iat-v2-proof.yml", import.meta.url);

const [wrapper, driver, documentation, packageSource, workflow] = await Promise.all([
  readFile(wrapperUrl, "utf8"),
  readFile(driverUrl, "utf8"),
  readFile(documentationUrl, "utf8"),
  readFile(packageUrl, "utf8"),
  readFile(workflowUrl, "utf8"),
]);
const packageManifest = JSON.parse(packageSource);

const {
  DEVNET_GENESIS_HASH,
  accountExplorerUrl,
  assertEvidenceSafe,
  assertHardPinnedDevnetUrl,
  extractCliSignatures,
  normalizeAirdropCliEvidence,
  sanitizeFailureText,
  transactionExplorerUrl,
} = await import(driverUrl);

function firstIndex(source, candidates) {
  return candidates.reduce((best, candidate) => {
    const found = source.indexOf(candidate);
    if (found === -1) return best;
    return best === -1 ? found : Math.min(best, found);
  }, -1);
}

test("Devnet rehearsal requires explicit opt-in before every public write", () => {
  assert.match(wrapper, /set -euo pipefail/u);
  assert.match(wrapper, /--execute/u);
  assert.match(wrapper, /unexpected_arguments|explicit_execute_required/u);

  const optIn = wrapper.indexOf("--execute");
  const firstWrite = firstIndex(wrapper, [
    "solana airdrop",
    "solana program deploy",
    "spl-token create-token",
  ]);
  assert(optIn >= 0, "the wrapper must recognize the explicit execution flag");
  assert(firstWrite > optIn, "the execution gate must precede the first public write");
  assert(wrapper.indexOf("node_major") > optIn && wrapper.indexOf("node_major") < firstWrite);
  assert.doesNotMatch(wrapper, /--execute=(?:true|1)|IAT_B3_EXECUTE/u);
});

test("the driver dependency preflight loads offline without enabling execution", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(driverUrl), "--offline-import-preflight"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(result.stdout.trim());
  assert.equal(evidence.status, "PREFLIGHT_PASS");
  assert.equal(evidence.publicNetworkWrites, false);
  assert.equal(evidence.rpc, DEVNET_RPC);
});

test("normal CI runs both rehearsal safety suites but never the public wrapper", () => {
  const command = packageManifest.scripts["check:iat-b3-spec"];
  assert.match(command, /iat-b3-local-rehearsal-harness\.test\.mjs/u);
  assert.match(command, /iat-b3-devnet-rehearsal-safety\.test\.mjs/u);
  assert.match(workflow, /npm run check:iat-b3-spec/u);
  assert.doesNotMatch(command, /run-iat-b3-devnet-rehearsal|--execute/u);
  assert.doesNotMatch(workflow, /run-iat-b3-devnet-rehearsal|--execute/u);
});

test("both layers hard-pin the official Devnet RPC and cannot select Mainnet", () => {
  assert(wrapper.includes(DEVNET_RPC));
  assert(driver.includes(DEVNET_RPC));

  const combined = `${wrapper}\n${driver}`;
  assert.doesNotMatch(combined, /https:\/\/api\.mainnet-beta\.solana\.com/iu);
  assert.doesNotMatch(combined, /https:\/\/api\.testnet\.solana\.com/iu);
  assert.doesNotMatch(combined, /IAT_B3_(?:RPC|URL)|SOLANA_(?:RPC|URL)/u);
  assert.doesNotMatch(driver, /required\(args,\s*["']rpc["']\)/u);
  assert.match(driver, /genesisHash|genesis_hash|Genesis hash/u);
  assert.match(documentation, /never falls back to another cluster/u);

  const genesisPreflight = wrapper.indexOf("solana genesis-hash");
  const firstWrite = wrapper.indexOf("solana airdrop");
  assert(genesisPreflight >= 0 && genesisPreflight < firstWrite);
  assert.match(wrapper, /EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG/u);
  assert.equal(
    DEVNET_GENESIS_HASH,
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  );
  assert.doesNotThrow(() => accountExplorerUrl(DEVNET_GENESIS_HASH));

  assert.equal(assertHardPinnedDevnetUrl(DEVNET_RPC), DEVNET_RPC);
  assert.throws(
    () => assertHardPinnedDevnetUrl("https://api.mainnet-beta.solana.com"),
    /hard-pinned official Devnet endpoint/u,
  );
});

test("runtime URL and evidence guards reject unsafe inputs without contacting RPC", () => {
  assert.equal(assertHardPinnedDevnetUrl(DEVNET_RPC), DEVNET_RPC);
  assert.throws(() => assertHardPinnedDevnetUrl("devnet"));
  assert.throws(() => assertHardPinnedDevnetUrl("https://api.testnet.solana.com"));

  const signature = "5zQKxvRdgJDA8fRGPdKfGxRLnLpwmNnMXGYxfBqFSUPqc5BTmFPrTG8vnC4HvKDVY8zQ8aQxZxcEE7WFpGhZGVAA";
  assert.equal(
    transactionExplorerUrl(signature),
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  );
  assert.match(
    accountExplorerUrl("11111111111111111111111111111111"),
    /\/address\/11111111111111111111111111111111\?cluster=devnet$/u,
  );
  assert.deepEqual(
    extractCliSignatures({ signature, programId: "11111111111111111111111111111111" }),
    [signature],
  );
  assert.doesNotThrow(() => assertEvidenceSafe({
    status: "PASS",
    publicAddresses: { program: "11111111111111111111111111111111" },
    explorerUrl: accountExplorerUrl("11111111111111111111111111111111"),
  }));
  assert.throws(() => assertEvidenceSafe({ path: "redacted" }));
  assert.throws(() => assertEvidenceSafe({ note: "C:\\private\\payer.json" }));
  assert.throws(() => assertEvidenceSafe({ keypair: [1, 2, 3] }));
});

test("the wrapper generates isolated identities and never reaches for a default signer", () => {
  for (const identity of ["payer", "program", "mint", "recipient"]) {
    assert.match(wrapper, new RegExp(`(?:\\$temp_dir|\\$\\{temp_dir\\})/${identity}\\.json`, "u"));
  }

  assert.match(wrapper, /solana-keygen new/u);
  assert.match(wrapper, /--fee-payer/u);
  assert.match(wrapper, /--keypair/u);
  assert.match(wrapper, /--program-id/u);
  assert.match(wrapper, /--upgrade-authority/u);
  assert.match(wrapper, /--mint-authority/u);
  assert.match(wrapper, /--authority/u);
  assert.match(wrapper, /--owner/u);
  assert.doesNotMatch(
    `${wrapper}\n${driver}`,
    /\.config\/solana|solana config|ANCHOR_WALLET|getDefaultProvider/iu,
  );

  assert.match(wrapper, /solana airdrop/u);
  assert.doesNotMatch(wrapper, /solana transfer|spl-token transfer/u);
  assert.match(documentation, /Only Devnet faucet airdrops may fund/u);
});

test("program upgrade authority is finalized before law initialization", () => {
  const freeze = wrapper.indexOf("set-upgrade-authority");
  const finalFlag = wrapper.indexOf("--final", freeze);
  const driverInvocation = wrapper.indexOf('--execute "$execute_confirmation"');

  assert(freeze >= 0, "the wrapper must explicitly finalize upgrade authority");
  assert(finalFlag > freeze, "the finalization command must include --final");
  assert(
    driverInvocation > finalFlag,
    "the immutable-program transition must happen before the law driver starts",
  );

  assert.match(driver, /BPFLoaderUpgradeab1e11111111111111111111111/u);
  assert.match(driver, /upgrade authority|upgradeAuthority/u);
  assert.match(driver, /authority option|authorityOption|programData/u);
  assert.match(driver, /deployed program bytes differ from pinned artifact/u);
  assert.match(wrapper, /--commitment finalized/u);
  assert.match(driver, /new Connection\([^\n]+"finalized"\)/u);
  assert.doesNotMatch(`${wrapper}\n${driver}`, /--commitment confirmed|"confirmed"/u);

  const run = driver.indexOf("async function run");
  const immutabilityCheck = firstIndex(driver.slice(run), [
    "await verifyImmutableProgram",
    "await assertImmutableProgram",
    "await verifyProgramFrozen",
    "await assertProgramFrozen",
  ]);
  const initializeCall = firstIndex(driver.slice(run), [
    "const initializeLaw",
    "initialize_law",
    "PROCESS_INITIALIZE_LAW",
  ]);
  assert(immutabilityCheck >= 0, "the driver must independently verify immutability");
  assert(initializeCall > immutabilityCheck, "immutability verification must precede law init");
});

test("law initialization atomically seals both Token-2022 extension authorities", () => {
  assert.match(wrapper, /--program-2022/u);
  assert.match(wrapper, /--decimals\s+9/u);
  assert.match(wrapper, /--enable-confidential-transfers/u);
  assert.match(wrapper, /--transfer-hook/u);
  assert.match(wrapper, /--enable-freeze/u);
  assert.match(wrapper, /authorize[\s\S]{0,500}freeze[\s\S]{0,120}--disable/u);
  assert.match(wrapper, /authorize[\s\S]{0,500}mint[\s\S]{0,120}--disable/u);

  assert.doesNotMatch(driver, /AuthorityType\.(?:TransferHookProgramId|ConfidentialTransferMint)/u);
  assert.doesNotMatch(driver, /createSetAuthorityInstruction|revoke-transfer-hook-authority|revoke-confidential-mint-authority/u);
  assert.match(driver, /getTransferHook/u);
  assert.match(driver, /ExtensionType\.ConfidentialTransferMint/u);
  assert.match(driver, /mintAuthority/u);
  assert.match(driver, /freezeAuthority/u);
  assert.match(driver, /PublicKey\.default|Buffer\.alloc\(32(?:,\s*0)?\)/u);
  assert.match(driver, /confidentialBytes\[32\], 1/u);
  assert.match(driver, /subarray\(33, 65\)\.every/u);
  assert.match(driver, /auditorElGamalPubkey: null/u);

  assert.match(driver, /\{ pubkey: mint, isSigner: false, isWritable: true \}/u);
  assert.match(driver, /\{ pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false \}/u);
  assert.match(driver, /atomic_extension_authority_sealing_verification/u);

  const initialize = firstIndex(driver, ["initializeLaw", "initialize_law"]);
  const sealedVerification = driver.indexOf("atomic_extension_authority_sealing_verification");
  const dayFinalization = firstIndex(driver, ["finalizeDay", "finalize_day"]);
  assert(initialize >= 0 && sealedVerification > initialize);
  assert(dayFinalization > sealedVerification);
});

test("evidence is public, measurable, explorable, and excludes obvious secret paths", () => {
  assert.match(driver, /iat-b3-devnet-rehearsal\/v1/u);
  assert.match(driver, /explorer\.solana\.com/u);
  assert.match(driver, /cluster=devnet/u);
  for (const field of [
    "signature",
    "slot",
    "feeLamports",
    "computeUnitsConsumed",
    "payerTransactionHistory",
    "rpcMetadataExposed",
  ]) {
    assert(driver.includes(field), `evidence must include ${field}`);
  }

  assert.match(driver, /publicAddresses|public_addresses|addresses/u);
  assert.match(driver, /authorityPostconditions|authority_postconditions|authorities/u);
  assert.doesNotMatch(driver, /emit\([^\n]*(?:secretKey|secret_key|keypairPath|tempDir)/u);
  assert.doesNotMatch(wrapper, /printf[^\n]*(?:\$temp_dir|\$repo_dir|\$artifact)/u);
  assert.match(documentation, /No keypair bytes, seed material, filesystem paths/u);

  assert.doesNotThrow(() => assertEvidenceSafe({
    publicAddresses: { program: "11111111111111111111111111111111" },
  }));
  assert.throws(() => assertEvidenceSafe({ secretKey: [1, 2, 3] }), /forbidden field/u);
  assert.throws(
    () => assertEvidenceSafe({ failure: "C:\\Users\\operator\\payer.json" }),
    /filesystem path/u,
  );
  assert.doesNotMatch(
    sanitizeFailureText("failed at C:\\Users\\operator\\payer.json"),
    /C:\\Users/u,
  );
  assert.equal(
    accountExplorerUrl("11111111111111111111111111111111"),
    "https://explorer.solana.com/address/11111111111111111111111111111111?cluster=devnet",
  );
  assert.equal(
    transactionExplorerUrl("5zQKxvRdgJDA8fRGPdKfGxRLnLpwmNnMXGYxfBqFSUPqc5BTmFPrTG8vnC4HvKDVY8zQ8aQxZxcEE7WFpGhZGVAA"),
    "https://explorer.solana.com/tx/5zQKxvRdgJDA8fRGPdKfGxRLnLpwmNnMXGYxfBqFSUPqc5BTmFPrTG8vnC4HvKDVY8zQ8aQxZxcEE7WFpGhZGVAA?cluster=devnet",
  );
  assert.throws(() => transactionExplorerUrl("1".repeat(88)), /invalid transaction signature/u);
});

test("airdrop text is normalized only from the exact public three-line CLI shape", () => {
  const signature = "5zQKxvRdgJDA8fRGPdKfGxRLnLpwmNnMXGYxfBqFSUPqc5BTmFPrTG8vnC4HvKDVY8zQ8aQxZxcEE7WFpGhZGVAA";
  const evidence = normalizeAirdropCliEvidence(
    "airdrop-1",
    `Requesting airdrop of 2 SOL\n${JSON.stringify({ signature })}\n2 SOL\n`,
  );
  assert.equal(evidence.status, "PUBLIC_STEP_RECORDED");
  assert.equal(evidence.label, "airdrop-1");
  assert.deepEqual(extractCliSignatures(evidence), [signature]);
  for (const forged of [
    `Requesting airdrop of 1 SOL\n${JSON.stringify({ signature })}\n1 SOL\n`,
    `Requesting airdrop of 2 SOL\n${JSON.stringify({ signature })}\n1 SOL\n`,
    `Requesting airdrop of 2 SOL\n${JSON.stringify({ signature })}\n2 SOL\nextra\n`,
    "Requesting airdrop of 2 SOL\n",
    `Requesting airdrop of 2 SOL\n${JSON.stringify({ signature: "0".repeat(88) })}\n2 SOL\n`,
    `Requesting airdrop of 2 SOL\nSignature: ${signature}\n2 SOL\n`,
    `Requesting airdrop of 2 SOL\n${JSON.stringify({ signature, extra: true })}\n2 SOL\n`,
    `Requesting airdrop of 2 SOL\n{"signature":"${"2".repeat(88)}","signature":"${signature}"}\n2 SOL\n`,
    `\nRequesting airdrop of 2 SOL\n${JSON.stringify({ signature })}\n2 SOL\n`,
    `Requesting airdrop of 2 SOL\n\n${JSON.stringify({ signature })}\n2 SOL\n`,
    `Requesting airdrop of 2 SOL\n${JSON.stringify({ signature })}\n2 SOL`,
    `Requesting airdrop of 2 SOL\r\n${JSON.stringify({ signature })}\n2 SOL\r\n`,
  ]) {
    assert.throws(() => normalizeAirdropCliEvidence("airdrop-1", forged));
  }
  assert.doesNotThrow(() => normalizeAirdropCliEvidence(
    "airdrop-2",
    `Requesting airdrop of 1 SOL\n${JSON.stringify({ signature })}\n3 SOL\n`,
  ));
  assert.doesNotThrow(() => normalizeAirdropCliEvidence(
    "airdrop-2",
    `Requesting airdrop of 1 SOL\r\n${JSON.stringify({ signature })}\r\n3 SOL\r\n`,
  ));
  assert.throws(() => normalizeAirdropCliEvidence(
    "airdrop-2",
    `Requesting airdrop of 1 SOL\n${JSON.stringify({ signature })}\n1 SOL\n`,
  ));
  assert.throws(() => normalizeAirdropCliEvidence(
    "airdrop-1",
    `Requesting airdrop of 2 SOL\n${JSON.stringify({ signature: "1".repeat(88) })}\n2 SOL\n`,
  ));
});

test("airdrop CLI normalization emits only bounded JSON and fails closed offline", async () => {
  const directory = await mkdtemp(join(tmpdir(), "iat-b3-airdrop-evidence-"));
  const inputPath = join(directory, "airdrop.txt");
  const driverPath = fileURLToPath(driverUrl);
  const signature = "5zQKxvRdgJDA8fRGPdKfGxRLnLpwmNnMXGYxfBqFSUPqc5BTmFPrTG8vnC4HvKDVY8zQ8aQxZxcEE7WFpGhZGVAA";
  try {
    await writeFile(
      inputPath,
      `Requesting airdrop of 1 SOL\n${JSON.stringify({ signature })}\n3 SOL\n`,
      "utf8",
    );
    const accepted = spawnSync(
      process.execPath,
      [driverPath, "--offline-normalize-airdrop-cli-evidence", "airdrop-2", inputPath],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(accepted.status, 0, accepted.stderr);
    const acceptedEvidence = JSON.parse(accepted.stdout.trim());
    assert.equal(acceptedEvidence.status, "PUBLIC_STEP_RECORDED");
    assert.deepEqual(extractCliSignatures(acceptedEvidence), [signature]);

    await writeFile(inputPath, "Requesting airdrop of 1 SOL\nC:\\Users\\operator\\payer.json\n", "utf8");
    const rejected = spawnSync(
      process.execPath,
      [driverPath, "--offline-normalize-airdrop-cli-evidence", "airdrop-2", inputPath],
      { encoding: "utf8", windowsHide: true },
    );
    assert.notEqual(rejected.status, 0);
    assert.equal(JSON.parse(rejected.stdout.trim()).status, "FAIL");
    assert.doesNotMatch(rejected.stdout, /Users|operator|payer\.json/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("partial failure is loud and local-secret cleanup is narrowly scoped", () => {
  assert.match(wrapper, /mktemp -d/u);
  assert.match(wrapper, /target\/iat-b3-devnet-rehearsal\./u);
  assert.match(wrapper, /trap\s+finish\s+EXIT/u);
  assert.match(wrapper, /trap\s+['"]?exit 130['"]?\s+INT TERM/u);
  assert.match(wrapper, /rm -rf -- "\$temp_dir"/u);
  assert.match(wrapper, /public[_A-Za-z]*writes[_A-Za-z]*started/iu);
  assert.match(wrapper, /permanent[_A-Za-z]*artifacts[_A-Za-z]*remain/iu);
  assert.match(wrapper, /rehearsal_command_failed|partial/u);
  assert.match(wrapper, /PARTIAL_PUBLIC_ARTIFACT_LOCATORS/u);
  assert.match(wrapper, /--offline-sanitize-cli-evidence/u);
  assert.match(wrapper, /--offline-normalize-airdrop-cli-evidence/u);
  assert.match(wrapper, /run_airdrop airdrop-1 solana airdrop 2/u);
  assert.match(wrapper, /run_airdrop airdrop-2 solana airdrop 1/u);
  assert.doesNotMatch(wrapper, /run_json airdrop-[12]/u);
  assert.match(wrapper, /phase":"public_cli_command"/u);
  assert.match(wrapper, /cliExitCode/u);
  assert.match(wrapper, /stdoutJsonPresent/u);
  assert.match(wrapper, /cliEvidenceSanitized/u);
  assert.match(wrapper, /if "\$@" >"\$evidence_file"/u);
  assert.match(wrapper, /\[\[ -s "\$evidence_file" \]\] \|\| continue/u);
  assert.match(wrapper, /partial-\$evidence_label-sanitizer/u);
  assert.match(wrapper, /mv -- "\$normalized_file" "\$evidence_file"/u);
  assert.match(driver, /knownTransactions: observedPublicTransactions/u);
  assert.match(driver, /publicAddresses: partialPublicAddresses/u);

  const guard = wrapper.indexOf('"$repo_dir"/target/iat-b3-devnet-rehearsal.');
  const removal = wrapper.indexOf('rm -rf -- "$temp_dir"');
  assert(guard >= 0 && removal > guard, "temp removal needs an explicit target-prefix guard");
  assert.doesNotMatch(wrapper, /rm -rf -- (?:"?\$repo_dir"?|"?\$HOME"?|~)(?:\s|$)/u);
  assert.match(documentation, /cannot and does not roll back public ledger\s+state/u);
});

test("the review document preserves the scope boundary", () => {
  assert.match(documentation, /inert unless its only argument is the exact opt-in flag/u);
  assert.match(documentation, /program is made immutable before the law is initialized/u);
  assert.match(documentation, /Expected permanent Devnet artifacts/u);
  assert.match(documentation, /not(?:\*\*)?\s+prove retained V2 feature parity/u);
  assert.match(documentation, /not[\s\S]{0,250}Mainnet readiness/iu);
  assert.match(documentation, /bash scripts\/run-iat-b3-devnet-rehearsal\.sh --execute/u);
});

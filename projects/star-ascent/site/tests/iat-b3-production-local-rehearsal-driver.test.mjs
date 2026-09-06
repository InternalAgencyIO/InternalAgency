import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getExtraAccountMetaAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  IAT_B3_PRODUCTION_SOURCE_KEYS,
  extractIatB3ProductionTransactionMaps,
} from "../scripts/lib/iat-b3-production-transaction-map.mjs";
import {
  IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS,
  IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
  IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_PLAN_SCHEMA,
  IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INPUT_SCHEMA,
  IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID,
  canonicalIatB3ProductionLocalRehearsalJson,
  executeIatB3ProductionLocalRehearsal,
  observeIatB3ProductionLocalRehearsalPreflight,
  preflightIatB3ProductionLocalRehearsal,
  readCanonicalIatB3ProductionLocalRehearsalInput,
  validateIatB3ProductionLocalRehearsalExecutionReceipt,
  validateIatB3ProductionLocalRehearsalPreflight,
} from "../scripts/lib/iat-b3-production-local-rehearsal-contract.mjs";
import {
  parseIatB3ProductionLocalRehearsalArguments,
  runIatB3ProductionLocalRehearsalCli,
} from "../scripts/iat-b3-production-local-rehearsal-driver.mjs";
import {
  IAT_B3_PRODUCTION_UNSIGNED_BUILDERS,
  IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID,
} from "../programs/iat_b3_economy/production-client.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const NODE = process.execPath;
const DRIVER = resolve(ROOT, "scripts/iat-b3-production-local-rehearsal-driver.mjs");
const EXPECTED_FIXTURE = resolve(
  ROOT,
  "tests/fixtures/iat-b3-production-local-rehearsal/expected-dispositions.v1.json",
);
const HEAD = "1".repeat(40);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const SOURCE_PATHS = Object.freeze({
  economySource: "programs/iat_b3_economy/src/lib.rs",
  instructionSource: "programs/iat_b3_economy/src/production_instruction.rs",
  entrypointSource: "programs/iat_b3_economy/src/production_entrypoint.rs",
  dispatchSource: "programs/iat_b3_economy/src/production_dispatch.rs",
  initializationHoldSource: "programs/iat_b3_economy/src/production_initialization_policy_hold.rs",
  nativeAdapterSource: "programs/iat_b3_economy/src/native_adapter.rs",
  setEligibilitySource: "programs/iat_b3_economy/src/production_set_eligibility.rs",
  openPositionSource: "programs/iat_b3_economy/src/production_open_position.rs",
  openExecutorSource: "programs/iat_b3_economy/src/production_open_position_executor.rs",
  settleExecutorSource: "programs/iat_b3_economy/src/production_settle_position_week_executor.rs",
  settleCoreHoldSource: "programs/iat_b3_economy/src/production_settle_position_week.rs",
  claimLanePrincipalSource: "programs/iat_b3_economy/src/production_claim_lane_principal.rs",
  claimExecutorSource: "programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs",
  withdrawPositionSource: "programs/iat_b3_economy/src/production_withdraw_position.rs",
  withdrawExecutorSource: "programs/iat_b3_economy/src/production_withdraw_position_executor.rs",
  closeSource: "programs/iat_b3_economy/src/production_close_position.rs",
  closeSpecSource: "programs/iat_b3_economy/tests/production_close_position_spec.rs",
  disabledRoundSource: "programs/iat_b3_economy/src/production_round_disabled.rs",
  stakeIngressRuntimeSource: "programs/iat_b3_economy/src/stake_ingress_runtime.rs",
  economicWriteGatesSource: "docs/b3/iat-b3-economic-write-gates.v1.json",
});

function temporaryDirectory(prefix = "iat-b3-production-rehearsal-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

function descriptor(path) {
  const bytes = readFileSync(path);
  return { path, sha256: sha256(bytes), byteLength: bytes.length };
}

function writeBoundFile(path, bytes) {
  writeFileSync(path, bytes);
  return descriptor(path);
}

function sourceFiles() {
  return Object.fromEntries(IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [
    key,
    descriptor(resolve(ROOT, SOURCE_PATHS[key])),
  ]));
}

function sourceText(files) {
  return Object.fromEntries(IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [
    key,
    readFileSync(files[key].path, "utf8"),
  ]));
}

function publicKey(fill) {
  return new PublicKey(new Uint8Array(32).fill(fill)).toBase58();
}

function canonicalWrite(path, value) {
  writeFileSync(path, `${canonicalIatB3ProductionLocalRehearsalJson(value)}\n`);
}

function fixture() {
  const root = temporaryDirectory();
  const identities = {
    lawProgramId: publicKey(0x31),
    economyProgramId: publicKey(0x41),
    canonicalMint: publicKey(0x51),
    compiledLawDomainGenesisHash: publicKey(0x61),
  };
  const manifest = descriptor(resolve(ROOT, "docs/b3/iat-b3-identity-freeze.v1.json"));
  const ownerPolicy = descriptor(resolve(ROOT, "docs/b3/iat-b3-owner-policy-freeze.v1.json"));
  const lawEnvironmentSha256 = "a".repeat(64);
  const economyEnvironmentSha256 = "b".repeat(64);
  const elfBytes = (ownRole) => Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1, 0, 0, 0]),
    new PublicKey(identities[ownRole]).toBuffer(),
    new PublicKey(identities[ownRole === "lawProgramId" ? "economyProgramId" : "lawProgramId"]).toBuffer(),
    new PublicKey(identities.canonicalMint).toBuffer(),
  ]);
  const lawElf = writeBoundFile(join(root, "iat_b3_law.so"), elfBytes("lawProgramId"));
  const economyElf = writeBoundFile(join(root, "iat_b3_economy.so"), elfBytes("economyProgramId"));
  const receipt = (artifact, environmentBindingSha256) => ({
    source: { declaredHeadSha: HEAD },
    artifact: { sha256: artifact.sha256, byteLength: artifact.byteLength },
    identityBinding: {
      manifestSha256: manifest.sha256,
      environmentBindingSha256,
    },
  });
  const lawReceipt = writeBoundFile(
    join(root, "iat_b3_law.receipt.json"),
    Buffer.from(JSON.stringify(receipt(lawElf, lawEnvironmentSha256))),
  );
  const economyReceipt = writeBoundFile(
    join(root, "iat_b3_economy.receipt.json"),
    Buffer.from(JSON.stringify(receipt(economyElf, economyEnvironmentSha256))),
  );
  const files = sourceFiles();
  const map = extractIatB3ProductionTransactionMaps(sourceText(files));
  const input = {
    schema: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INPUT_SCHEMA,
    declaredHeadSha: HEAD,
    repositoryRoot: ROOT,
    rpc: {
      url: "http://127.0.0.1:18899/",
      commitment: "confirmed",
      networkPolicy: "LOOPBACK_ONLY",
    },
    ledger: {
      path: join(root, "iat-b3-production-local-rehearsal-ledger"),
      mustNotExistBeforeRun: true,
      cleanupPolicy: "REMOVE_ONLY_IF_CREATED_BY_THIS_PROCESS_AND_MARKER_MATCHES",
    },
    identities: { manifest, ownerPolicy, ...identities },
    productionMap: {
      canonicalMapSha256: map.canonicalMapSha256,
      sourceFiles: files,
      transactionMapModule: descriptor(resolve(ROOT, "scripts/lib/iat-b3-production-transaction-map.mjs")),
      productionClientModule: descriptor(resolve(ROOT, "programs/iat_b3_economy/production-client.mjs")),
    },
    artifacts: {
      law: { kind: "LAW", programId: identities.lawProgramId, elf: lawElf, receipt: lawReceipt },
      economy: {
        kind: "ECONOMY",
        programId: identities.economyProgramId,
        elf: economyElf,
        receipt: economyReceipt,
      },
    },
    expectedDispositionFixture: descriptor(EXPECTED_FIXTURE),
    executionBoundary: {
      mode: "PREFLIGHT_ONLY",
      ephemeralSignerDirectory: join(root, "ephemeral-signers-never-read"),
      signerLoadPhase: "AFTER_ALL_FIXTURE_AND_ARTIFACT_CHECKS",
      allowSignerLoad: false,
      allowValidatorSpawn: false,
      allowRpc: false,
      allowSigning: false,
      allowSend: false,
      allowKeyGeneration: false,
    },
  };
  const dependencies = {
    assertLawIdentity: () => ({
      environment: {
        IAT_B3_PRODUCTION_LAW_PROGRAM_ID: identities.lawProgramId,
        IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: identities.economyProgramId,
        IAT_B3_PRODUCTION_CANONICAL_MINT: identities.canonicalMint,
      },
      receiptBinding: {
        manifestSha256: manifest.sha256,
        environmentBindingSha256: lawEnvironmentSha256,
      },
    }),
    assertEconomyIdentity: () => ({
      environment: {
        IAT_B3_PRODUCTION_LAW_PROGRAM_ID: identities.lawProgramId,
        IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: identities.economyProgramId,
        IAT_B3_PRODUCTION_CANONICAL_MINT: identities.canonicalMint,
        IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH: identities.compiledLawDomainGenesisHash,
      },
      receiptBinding: {
        manifestSha256: manifest.sha256,
        environmentBindingSha256: economyEnvironmentSha256,
      },
    }),
    validateLawReceipt: (value) => value,
    validateEconomyReceipt: (value) => value,
  };
  const inputPath = join(root, "input.json");
  canonicalWrite(inputPath, input);
  return { root, input, inputPath, dependencies, map };
}

function withFixture(operation) {
  const context = fixture();
  let result;
  try {
    result = operation(context);
  } catch (error) {
    rmSync(context.root, { recursive: true, force: true });
    throw error;
  }
  if (result && typeof result.then === "function") {
    return result.finally(() => rmSync(context.root, { recursive: true, force: true }));
  }
  rmSync(context.root, { recursive: true, force: true });
  return result;
}

const NATIVE_LOADER_ID = new PublicKey("NativeLoader1111111111111111111111111111111");
// Public RFC 8032 section 7.1, TEST 1 keypair bytes. Test-only fixture;
// this is a published vector, not an operational or confidential signing key.
const RFC8032_TEST_VECTOR_1_KEYPAIR_BYTES = Buffer.from(
  "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"
  + "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "hex",
);
const TEST_SIGNER = Keypair.fromSecretKey(RFC8032_TEST_VECTOR_1_KEYPAIR_BYTES).publicKey;
const TEST_WALLET = new PublicKey(new Uint8Array(32).fill(0x72));

const canonicalDigest = (value) => sha256(
  Buffer.from(canonicalIatB3ProductionLocalRehearsalJson(value)),
);

function pda(programId, seeds) {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function jsonPayload(opcode) {
  return [
    {}, { lane: 1 }, {}, {}, {}, { role: 2, agency_index: 3 },
    { position_id: "4", principal: "5" }, { week: "6" }, { ordinal: "7" },
    { lane: 1 }, {}, {}, { week: "8" }, {}, {},
  ][opcode];
}

function builderPayload(map, opcode, payload) {
  return Object.fromEntries(map.operations[opcode].payload.map((field) => [
    field.name,
    field.type === "u64" ? BigInt(payload[field.name]) : payload[field.name],
  ]));
}

function executionAccounts(map, input) {
  const economyProgram = new PublicKey(input.identities.economyProgramId);
  const lawProgram = new PublicKey(input.identities.lawProgramId);
  const mint = new PublicKey(input.identities.canonicalMint);
  const [dailyLawState, dailyLawBump] = pda(lawProgram, [Buffer.from("law-state"), mint.toBuffer()]);
  const [config, configBump] = pda(economyProgram, [Buffer.from("config"), mint.toBuffer()]);
  const [vaultAuthority, vaultBump] = pda(
    economyProgram,
    [Buffer.from("vault-authority"), config.toBuffer()],
  );
  const [stakeTokens, stakeBump] = pda(
    economyProgram,
    [Buffer.from("stake-token"), config.toBuffer()],
  );
  const [ingressAuthority, ingressBump] = pda(
    economyProgram,
    [Buffer.from("stake-ingress"), config.toBuffer()],
  );
  const [setEligibility, setEligibilityBump] = pda(
    economyProgram,
    [Buffer.from("eligibility"), config.toBuffer(), TEST_WALLET.toBuffer()],
  );
  const [ownerEligibility, ownerEligibilityBump] = pda(
    economyProgram,
    [Buffer.from("eligibility"), config.toBuffer(), TEST_SIGNER.toBuffer()],
  );
  const positionId = Buffer.alloc(8);
  positionId.writeBigUInt64LE(4n);
  const [openPosition, openPositionBump] = pda(
    economyProgram,
    [Buffer.from("position"), config.toBuffer(), TEST_SIGNER.toBuffer(), positionId],
  );
  const knownPdas = new Map();
  const bindPda = (pubkey, programId, seeds, bump) => knownPdas.set(pubkey.toBase58(), {
    programId: programId.toBase58(),
    seeds,
    bump,
  });
  bindPda(dailyLawState, lawProgram, [
    { encoding: "utf8", value: "law-state" },
    { encoding: "pubkey", value: mint.toBase58() },
  ], dailyLawBump);
  bindPda(config, economyProgram, [
    { encoding: "utf8", value: "config" },
    { encoding: "pubkey", value: mint.toBase58() },
  ], configBump);
  bindPda(vaultAuthority, economyProgram, [
    { encoding: "utf8", value: "vault-authority" },
    { encoding: "pubkey", value: config.toBase58() },
  ], vaultBump);
  bindPda(stakeTokens, economyProgram, [
    { encoding: "utf8", value: "stake-token" },
    { encoding: "pubkey", value: config.toBase58() },
  ], stakeBump);
  bindPda(ingressAuthority, economyProgram, [
    { encoding: "utf8", value: "stake-ingress" },
    { encoding: "pubkey", value: config.toBase58() },
  ], ingressBump);
  bindPda(setEligibility, economyProgram, [
    { encoding: "utf8", value: "eligibility" },
    { encoding: "pubkey", value: config.toBase58() },
    { encoding: "pubkey", value: TEST_WALLET.toBase58() },
  ], setEligibilityBump);
  bindPda(ownerEligibility, economyProgram, [
    { encoding: "utf8", value: "eligibility" },
    { encoding: "pubkey", value: config.toBase58() },
    { encoding: "pubkey", value: TEST_SIGNER.toBase58() },
  ], ownerEligibilityBump);
  bindPda(openPosition, economyProgram, [
    { encoding: "utf8", value: "position" },
    { encoding: "pubkey", value: config.toBase58() },
    { encoding: "pubkey", value: TEST_SIGNER.toBase58() },
    { encoding: "u64le", value: "4" },
  ], openPositionBump);
  const lane = {};
  for (const number of [1, 2, 4]) {
    const [state, stateBump] = pda(
      economyProgram,
      [Buffer.from("lane"), config.toBuffer(), Buffer.from([number])],
    );
    const [tokens, tokenBump] = pda(
      economyProgram,
      [Buffer.from("lane-token"), config.toBuffer(), Buffer.from([number])],
    );
    lane[number] = { state, tokens };
    bindPda(state, economyProgram, [
      { encoding: "utf8", value: "lane" },
      { encoding: "pubkey", value: config.toBase58() },
      { encoding: "u8", value: number },
    ], stateBump);
    bindPda(tokens, economyProgram, [
      { encoding: "utf8", value: "lane-token" },
      { encoding: "pubkey", value: config.toBase58() },
      { encoding: "u8", value: number },
    ], tokenBump);
  }
  const hookValidation = getExtraAccountMetaAddress(mint, lawProgram);
  const [expectedHook, hookBump] = pda(
    lawProgram,
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
  );
  assert.ok(hookValidation.equals(expectedHook));
  bindPda(hookValidation, lawProgram, [
    { encoding: "utf8", value: "extra-account-metas" },
    { encoding: "pubkey", value: mint.toBase58() },
  ], hookBump);

  let marker = 0x70;
  const unique = () => {
    marker += 1;
    return new PublicKey(Uint8Array.from({ length: 32 }, (_, index) => (marker + index) & 0xff));
  };
  const cases = [];
  for (let opcode = 0; opcode < 15; opcode += 1) {
    const operation = map.operations[opcode];
    const payload = jsonPayload(opcode);
    const variant = opcode === 6 ? "BASE" : null;
    const selected = opcode === 6
      ? operation.variants.find(({ name }) => name === "BASE")
      : opcode === 9
        ? operation.variants.find(({ name }) => name === "NON_CORE_ACTIVE")
        : operation.variants[0];
    const accounts = {};
    for (const { role, binding } of selected.metas) {
      if (binding !== "account") continue;
      accounts[role] = (role === "admin" || role === "owner" || role === "caller")
        ? TEST_SIGNER.toBase58()
        : unique().toBase58();
    }
    if (Object.hasOwn(accounts, "config")) accounts.config = config.toBase58();
    if (Object.hasOwn(accounts, "wallet")) {
      accounts.wallet = opcode === 5 ? TEST_WALLET.toBase58() : unique().toBase58();
    }
    if (Object.hasOwn(accounts, "vault_authority")) {
      accounts.vault_authority = vaultAuthority.toBase58();
    }
    if (Object.hasOwn(accounts, "stake_tokens")) accounts.stake_tokens = stakeTokens.toBase58();
    if (Object.hasOwn(accounts, "eligibility")) {
      accounts.eligibility = (opcode === 5 ? setEligibility : ownerEligibility).toBase58();
    }
    if (opcode === 6) accounts.position = openPosition.toBase58();
    if (Object.hasOwn(accounts, "treasury")) accounts.treasury = lane[1].state.toBase58();
    if (Object.hasOwn(accounts, "treasury_tokens")) accounts.treasury_tokens = lane[1].tokens.toBase58();
    if (Object.hasOwn(accounts, "ecosystem")) accounts.ecosystem = lane[2].state.toBase58();
    if (Object.hasOwn(accounts, "ecosystem_tokens")) accounts.ecosystem_tokens = lane[2].tokens.toBase58();
    if (Object.hasOwn(accounts, "liquidity")) accounts.liquidity = lane[4].state.toBase58();
    if (Object.hasOwn(accounts, "liquidity_tokens")) accounts.liquidity_tokens = lane[4].tokens.toBase58();
    if (Object.hasOwn(accounts, "lane_state")) accounts.lane_state = lane[1].state.toBase58();
    if (Object.hasOwn(accounts, "lane_tokens")) accounts.lane_tokens = lane[1].tokens.toBase58();
    cases.push({ opcode, payload, variant, accounts });
  }
  return {
    economyProgram,
    lawProgram,
    mint,
    dailyLawState,
    config,
    setEligibility,
    knownPdas,
    cases,
  };
}

function deployedProgramBytes({ loader, programId, artifact, upgradeAuthority = null }) {
  const [programDataAddress] = pda(loader, [programId.toBuffer()]);
  const programAccount = Buffer.alloc(36);
  programAccount.writeUInt32LE(2, 0);
  programDataAddress.toBuffer().copy(programAccount, 4);
  const elf = readFileSync(artifact.path);
  const programData = Buffer.alloc(45 + elf.length);
  programData.writeUInt32LE(3, 0);
  programData.writeBigUInt64LE(1n, 4);
  programData[12] = upgradeAuthority === null ? 0 : 1;
  if (upgradeAuthority !== null) upgradeAuthority.toBuffer().copy(programData, 13);
  elf.copy(programData, 45);
  return { programDataAddress, programAccount, programData, elf };
}

function finalizedLawStateBytes({ bump, mint, compiledLawDomainGenesisHash }) {
  const bytes = Buffer.alloc(160);
  bytes.set(Buffer.from("IATB3S01", "ascii"), 0);
  bytes[8] = 1;
  bytes[9] = bump;
  bytes[10] = 1;
  bytes[11] = 0;
  mint.toBuffer().copy(bytes, 16);
  new PublicKey(compiledLawDomainGenesisHash).toBuffer().copy(bytes, 48);
  bytes.writeBigInt64LE(20_000n, 80);
  bytes.writeBigUInt64LE(40_000n, 88);
  Buffer.alloc(32, 0x65).copy(bytes, 96);
  bytes.writeBigUInt64LE(1n, 128);
  bytes.writeUInt16LE(50, 136);
  bytes.writeUInt16LE(1, 138);
  bytes.writeUInt16LE(10_000, 140);
  return bytes;
}

function expectedResult(
  disposition,
  errorCode,
  before,
  after,
  logs,
  innerCpi,
  requiredInnerCpiProgramIds = [],
) {
  return {
    disposition,
    errorCode,
    requiredInnerCpiProgramIds,
    logsSha256: canonicalDigest(logs),
    innerCpiSha256: canonicalDigest(innerCpi),
    transitionSha256: canonicalDigest({ before, after }),
  };
}

function executionFixture(context, { officialPreflight = false } = {}) {
  const { input, map } = context;
  const validatorGenesisHash = publicKey(0x71);
  const accountLayout = executionAccounts(map, input);
  const loader = new PublicKey(IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID);
  const lawDeployment = deployedProgramBytes({
    loader,
    programId: accountLayout.lawProgram,
    artifact: input.artifacts.law.elf,
  });
  const economyDeployment = deployedProgramBytes({
    loader,
    programId: accountLayout.economyProgram,
    artifact: input.artifacts.economy.elf,
  });
  const deployment = (kind, programId, artifact, value) => ({
    kind,
    programId: programId.toBase58(),
    programDataAddress: value.programDataAddress.toBase58(),
    upgradeAuthority: null,
    programAccountDataSha256: sha256(value.programAccount),
    programAccountDataLength: value.programAccount.length,
    programDataAccountSha256: sha256(value.programData),
    programDataAccountLength: value.programData.length,
    elfOffset: 45,
    artifactSha256: artifact.sha256,
    artifactByteLength: artifact.byteLength,
  });

  const fixedOwners = new Map([
    [accountLayout.mint.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58()],
    [TOKEN_2022_PROGRAM_ID.toBase58(), NATIVE_LOADER_ID.toBase58()],
    [SystemProgram.programId.toBase58(), NATIVE_LOADER_ID.toBase58()],
    [IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID.toBase58(), NATIVE_LOADER_ID.toBase58()],
    [accountLayout.lawProgram.toBase58(), NATIVE_LOADER_ID.toBase58()],
    [accountLayout.dailyLawState.toBase58(), accountLayout.lawProgram.toBase58()],
  ]);
  const executableKeys = new Set([
    TOKEN_2022_PROGRAM_ID.toBase58(),
    SystemProgram.programId.toBase58(),
    IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID.toBase58(),
    accountLayout.lawProgram.toBase58(),
  ]);
  const allKeys = new Set([
    TEST_SIGNER.toBase58(),
    accountLayout.dailyLawState.toBase58(),
  ]);
  const builtInstructions = [];
  for (const spec of accountLayout.cases) {
    const instruction = IAT_B3_PRODUCTION_UNSIGNED_BUILDERS[spec.opcode]({
      transactionMap: map,
      programId: input.identities.economyProgramId,
      lawProgramId: input.identities.lawProgramId,
      canonicalMint: input.identities.canonicalMint,
      dailyLawState: accountLayout.dailyLawState,
      payload: builderPayload(map, spec.opcode, spec.payload),
      accounts: spec.accounts,
      ...(spec.variant === null ? {} : { variant: spec.variant }),
    });
    builtInstructions.push(instruction);
    for (const { pubkey } of instruction.keys) allKeys.add(pubkey.toBase58());
  }

  const accountRecords = new Map();
  for (const pubkey of allKeys) {
    const pdaBinding = accountLayout.knownPdas.get(pubkey) ?? null;
    const decoded = { role: `fixture:${pubkey}`, version: 1 };
    const data = Buffer.from(`state:${pubkey}`, "utf8");
    accountRecords.set(pubkey, {
      role: `fixture:${pubkey}`,
      pubkey,
      owner: fixedOwners.get(pubkey) ?? (
        executableKeys.has(pubkey) ? NATIVE_LOADER_ID.toBase58() : accountLayout.economyProgram.toBase58()
      ),
      executable: executableKeys.has(pubkey),
      lamports: "1000000",
      rentEpoch: "0",
      data,
      decoded,
      pda: pdaBinding,
    });
  }
  accountRecords.get(TEST_SIGNER.toBase58()).owner = SystemProgram.programId.toBase58();
  const lawStateRecord = accountRecords.get(accountLayout.dailyLawState.toBase58());
  lawStateRecord.data = finalizedLawStateBytes({
    bump: accountLayout.knownPdas.get(accountLayout.dailyLawState.toBase58()).bump,
    mint: accountLayout.mint,
    compiledLawDomainGenesisHash: input.identities.compiledLawDomainGenesisHash,
  });
  lawStateRecord.decoded = {
    codec: "LAW_STATE_V1",
    bump: accountLayout.knownPdas.get(accountLayout.dailyLawState.toBase58()).bump,
    mint: accountLayout.mint.toBase58(),
    compiledLawDomainGenesisHash: input.identities.compiledLawDomainGenesisHash,
    decision: {
      locked: false,
      localDay: "20000",
      entropySlot: "40000",
      ancestorSlotHash: "65".repeat(32),
      drawCounter: "1",
      drawBucket: 50,
      chanceNumerator: 1,
      chanceDenominator: 10_000,
    },
  };
  const vacantEligibility = accountRecords.get(accountLayout.setEligibility.toBase58());
  vacantEligibility.owner = SystemProgram.programId.toBase58();
  vacantEligibility.lamports = "0";
  vacantEligibility.data = Buffer.alloc(0);
  vacantEligibility.decoded = {
    role: "set_eligibility_target",
    lifecycle: "VACANT_SYSTEM_OWNED",
  };

  const accountFixtures = [...accountRecords.values()].map((record) => ({
    role: record.role,
    codec: "TEST_FAKE",
    pubkey: record.pubkey,
    owner: record.owner,
    executable: record.executable,
    dataLength: record.data.length,
    dataSha256: sha256(record.data),
    decodedStateSha256: canonicalDigest(record.decoded),
    pda: record.pda,
  }));
  const snapshotPubkeys = [...accountRecords.keys()].sort();
  const accountObservation = (record) => ({
    pubkey: record.pubkey,
    owner: record.owner,
    executable: record.executable,
    lamports: record.lamports,
    rentEpoch: record.rentEpoch,
    dataBase64: record.data.toString("base64"),
  });
  const canonicalSnapshot = () => [...accountRecords.values()]
    .map(accountObservation)
    .sort((left, right) => left.pubkey.localeCompare(right.pubkey))
    .map((entry) => {
      const bytes = Buffer.from(entry.dataBase64, "base64");
      return {
        pubkey: entry.pubkey,
        owner: entry.owner,
        executable: entry.executable,
        lamports: entry.lamports,
        rentEpoch: entry.rentEpoch,
        dataLength: bytes.length,
        dataSha256: sha256(bytes),
      };
    });
  const beforeSnapshot = canonicalSnapshot();
  const feePayerIndex = beforeSnapshot.findIndex(({ pubkey }) => pubkey === TEST_SIGNER.toBase58());
  const failedAfter = structuredClone(beforeSnapshot);
  failedAfter[feePayerIndex].lamports = (BigInt(failedAfter[feePayerIndex].lamports) - 5000n).toString();
  const stateEffects = new Map();
  const successAfterSnapshot = (caseId, opcode) => {
    const target = builtInstructions[opcode].keys.find(({ pubkey, isWritable }) =>
      isWritable && pubkey.toBase58() !== TEST_SIGNER.toBase58());
    assert.ok(target, `opcode ${opcode} must expose a non-fee-payer writable account`);
    const pubkey = target.pubkey.toBase58();
    const data = Buffer.concat([
      accountRecords.get(pubkey).data,
      Buffer.from(`:${caseId}`, "utf8"),
    ]);
    stateEffects.set(caseId, { pubkey, dataBase64: data.toString("base64") });
    const after = structuredClone(failedAfter);
    const entry = after.find((value) => value.pubkey === pubkey);
    entry.dataLength = data.length;
    entry.dataSha256 = sha256(data);
    return after;
  };
  const lifecycleSystemCpi = (dataMarker) => ({
    instructionIndex: 0,
    programId: SystemProgram.programId.toBase58(),
    dataSha256: dataMarker.repeat(64),
    accountPubkeys: [],
  });
  const tokenCpi = (dataMarker) => ({
    instructionIndex: 0,
    programId: TOKEN_2022_PROGRAM_ID.toBase58(),
    dataSha256: dataMarker.repeat(64),
    accountPubkeys: [],
  });
  const successCpiForOpcode = (opcode, dataMarker) => [
    opcode === 5 ? lifecycleSystemCpi(dataMarker) : tokenCpi(dataMarker),
  ];

  const operationCases = accountLayout.cases.map((spec, opcode) => {
    const errorCode = [0xE540, 0xE541, 0xE542, 0xE543, 0xE544, null, null, null,
      0xE50E, null, null, null, 0xE50A, 0xE50A, 0xE50A][opcode];
    const disposition = opcode === 9
      ? "ACTIVE_EXPECTED_SUCCESS"
      : IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS.operations[opcode].expectedDisposition;
    const logs = [`case:opcode-${opcode}`, errorCode === null ? "success" : `error:${errorCode}`];
    const innerCpi = errorCode === null ? successCpiForOpcode(opcode, "c") : [];
    const caseId = `opcode-${opcode}`;
    return {
      id: caseId,
      ...spec,
      signerRoles: ["payer"],
      snapshotPubkeys,
      expected: expectedResult(
        disposition,
        errorCode,
        beforeSnapshot,
        errorCode === null ? successAfterSnapshot(caseId, opcode) : failedAfter,
        logs,
        innerCpi,
        opcode === 5 ? [SystemProgram.programId.toBase58()] : [],
      ),
    };
  });
  const rollbackCases = IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS.rollbackProbes.map((probe) => {
    const activeInstruction = {
      ...accountLayout.cases[probe.activeOpcode],
      variant: probe.activeVariant,
    };
    const atomicLogs = [`rollback:${probe.id}:atomic`, "error:58634"];
    const retryLogs = [`rollback:${probe.id}:retry`, "success"];
    const atomicCpi = successCpiForOpcode(probe.activeOpcode, "e");
    const retryCpi = successCpiForOpcode(probe.activeOpcode, "d");
    const retryCaseId = `${probe.id}:standalone-retry`;
    const requiredInnerCpiProgramIds = [
      probe.activeOpcode === 5
        ? SystemProgram.programId.toBase58()
        : TOKEN_2022_PROGRAM_ID.toBase58(),
    ];
    return {
      id: probe.id,
      activeInstruction,
      signerRoles: ["payer"],
      snapshotPubkeys,
      atomicExpected: expectedResult(
        "CCC_DISABLED",
        0xE50A,
        beforeSnapshot,
        failedAfter,
        atomicLogs,
        atomicCpi,
        requiredInnerCpiProgramIds,
      ),
      retryExpected: expectedResult(
        "ACTIVE_EXPECTED_SUCCESS",
        null,
        beforeSnapshot,
        successAfterSnapshot(retryCaseId, probe.activeOpcode),
        retryLogs,
        retryCpi,
        requiredInnerCpiProgramIds,
      ),
    };
  });

  const testPreflight = preflightIatB3ProductionLocalRehearsal(input, context.dependencies);
  const preflight = officialPreflight ? (() => {
    const clone = structuredClone(testPreflight);
    clone.status = "OFFICIAL_READY";
    clone.exitCode = 0;
    clone.validationAuthority = "SOURCE_BOUND_IDENTITY_AND_DOCKER_RECEIPT_VALIDATORS";
    clone.safety.officialIdentityAndReceiptValidatorsUsed = true;
    clone.blockers = clone.blockers.filter((blocker) => blocker !== "TEST_ONLY_VALIDATOR_OVERRIDE");
    const { preflightSha256: ignored, ...core } = clone;
    assert.ok(ignored);
    clone.preflightSha256 = canonicalDigest(core);
    return clone;
  })() : testPreflight;
  const executionPlan = {
    schema: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_PLAN_SCHEMA,
    preflightSha256: preflight.preflightSha256,
    inputBindingSha256: preflight.inputBindingSha256,
    rpcUrl: input.rpc.url,
    validatorGenesisHash,
    compiledLawDomainGenesisHash: input.identities.compiledLawDomainGenesisHash,
    lawDomainCases: {
      positive: {
        lawStateDomainHash: input.identities.compiledLawDomainGenesisHash,
        expectedErrorCode: null,
        executed: false,
      },
      negative: {
        lawStateDomainHash: validatorGenesisHash,
        expectedErrorCode: 0xE503,
        executed: false,
      },
    },
    dailyLawState: accountLayout.dailyLawState.toBase58(),
    loaderProgramId: loader.toBase58(),
    deployments: {
      law: deployment("LAW", accountLayout.lawProgram, input.artifacts.law.elf, lawDeployment),
      economy: deployment(
        "ECONOMY",
        accountLayout.economyProgram,
        input.artifacts.economy.elf,
        economyDeployment,
      ),
    },
    accountFixtures,
    signers: [{ role: "payer", expectedPubkey: TEST_SIGNER.toBase58(), feePayer: true }],
    operationCases,
    rollbackCases,
  };
  const signerLoadEvents = [];
  const adapterEvents = [];
  let fixtureObservationCount = 0;
  const results = new Map();
  for (const operationCase of operationCases) {
    results.set(operationCase.id, {
      expected: operationCase.expected,
      logs: [`case:${operationCase.id}`, operationCase.expected.errorCode === null
        ? "success" : `error:${operationCase.expected.errorCode}`],
      innerCpi: operationCase.expected.errorCode === null
        ? successCpiForOpcode(operationCase.opcode, "c") : [],
    });
  }
  for (const rollbackCase of rollbackCases) {
    results.set(`${rollbackCase.id}:atomic`, {
      expected: rollbackCase.atomicExpected,
      logs: [`rollback:${rollbackCase.id}:atomic`, "error:58634"],
      innerCpi: successCpiForOpcode(rollbackCase.activeInstruction.opcode, "e"),
    });
    results.set(`${rollbackCase.id}:standalone-retry`, {
      expected: rollbackCase.retryExpected,
      logs: [`rollback:${rollbackCase.id}:retry`, "success"],
      innerCpi: successCpiForOpcode(rollbackCase.activeInstruction.opcode, "d"),
    });
  }
  let pendingAfterCase = null;
  const adapter = {
    kind: "TEST_FAKE",
    rpcUrl: input.rpc.url,
    async assertExecutionPlanBinding() {},
    async observeGenesisHash() {
      adapterEvents.push("genesis");
      return validatorGenesisHash;
    },
    async observeProgramDeployment(programId) {
      adapterEvents.push(`deployment:${programId}`);
      const value = programId === input.identities.lawProgramId ? lawDeployment : economyDeployment;
      return {
        programId,
        programAccountOwner: loader.toBase58(),
        programAccountExecutable: true,
        programAccountDataBase64: value.programAccount.toString("base64"),
        programDataAddress: value.programDataAddress.toBase58(),
        programDataOwner: loader.toBase58(),
        programDataExecutable: false,
        programDataBase64: value.programData.toString("base64"),
      };
    },
    async observeAccount(pubkey) {
      fixtureObservationCount += 1;
      adapterEvents.push(`fixture:${pubkey}`);
      return accountObservation(accountRecords.get(pubkey));
    },
    async decodeFixtureState({ pubkey }) {
      return accountRecords.get(pubkey).decoded;
    },
    async loadEphemeralSignerBytes(binding) {
      adapterEvents.push(`signer:${binding.role}`);
      signerLoadEvents.push({
        binding,
        fixturesObserved: fixtureObservationCount,
      });
      return Uint8Array.from(RFC8032_TEST_VECTOR_1_KEYPAIR_BYTES);
    },
    async deriveEphemeralSignerPublicKey({ secret }) {
      return Keypair.fromSecretKey(secret).publicKey.toBase58();
    },
    async disposeEphemeralSigners() {},
    async snapshotAccounts(pubkeys) {
      const completedCase = pendingAfterCase;
      const feeApplied = completedCase !== null;
      const stateEffect = stateEffects.get(completedCase) ?? null;
      pendingAfterCase = null;
      return pubkeys.map((pubkey) => {
        const observed = accountObservation(accountRecords.get(pubkey));
        if (feeApplied && pubkey === TEST_SIGNER.toBase58()) {
          observed.lamports = (BigInt(observed.lamports) - 5000n).toString();
        }
        if (stateEffect?.pubkey === pubkey) observed.dataBase64 = stateEffect.dataBase64;
        return observed;
      });
    },
    async executeTransaction({ caseId, instructions }) {
      assert.ok(instructions.every(({ constructor }) => constructor.name === "TransactionInstruction"));
      pendingAfterCase = caseId;
      const value = results.get(caseId);
      const submittedMessageSha256 = sha256(Buffer.from(`message:${caseId}`));
      const submittedTransactionSha256 = sha256(Buffer.from(`transaction:${caseId}`));
      return {
        signature: `sig-${caseId}`,
        slot: 100,
        confirmationStatus: "confirmed",
        errorCode: value.expected.errorCode,
        feeLamports: "5000",
        submittedMessageSha256,
        landedMessageSha256: submittedMessageSha256,
        submittedTransactionSha256,
        landedTransactionSha256: submittedTransactionSha256,
        logs: value.logs,
        innerCpi: value.innerCpi,
      };
    },
  };
  return {
    preflight,
    executionPlan,
    adapter,
    signerLoadEvents,
    adapterEvents,
    accountRecords,
  };
}

test("expected-disposition fixture is canonical, exact for all 15, and records five unexecuted rollback probes", () => {
  const bytes = readFileSync(EXPECTED_FIXTURE, "utf8");
  const parsed = JSON.parse(bytes);
  assert.equal(bytes, `${canonicalIatB3ProductionLocalRehearsalJson(parsed)}\n`);
  assert.deepEqual(parsed, IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS);
  assert.equal(sha256(Buffer.from(canonicalIatB3ProductionLocalRehearsalJson(parsed))),
    IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256);
  assert.deepEqual(parsed.operations.map(({ opcode }) => opcode), [...Array(15).keys()]);
  assert.deepEqual(
    parsed.rollbackProbes.map(({ transactionInstructionOpcodes }) => transactionInstructionOpcodes),
    [[5, 12], [6, 12], [7, 12], [9, 12], [10, 12]],
  );
  assert.ok(parsed.operations.every(({ expectedExecutionEvidence }) => expectedExecutionEvidence === false));
  assert.ok(parsed.rollbackProbes.every(({ executed }) => executed === false));
});

test("guarded fake engine observes all 15 and the exact five rollback/retry rows but remains non-evidence HOLD", () => withFixture(
  async (context) => {
    const execution = executionFixture(context);
    const receipt = await executeIatB3ProductionLocalRehearsal({
      preflight: execution.preflight,
      input: context.input,
      executionPlan: execution.executionPlan,
      adapter: execution.adapter,
    });
    assert.equal(validateIatB3ProductionLocalRehearsalExecutionReceipt(receipt), receipt);
    assert.equal(receipt.status, "HOLD_TEST_EXECUTION_ONLY");
    assert.equal(receipt.complete, false);
    assert.equal(
      receipt.runtimeBindings.validatorGenesisHash,
      execution.executionPlan.validatorGenesisHash,
    );
    assert.equal(
      receipt.runtimeBindings.compiledLawDomainGenesisHash,
      context.input.identities.compiledLawDomainGenesisHash,
    );
    assert.notEqual(
      receipt.runtimeBindings.validatorGenesisHash,
      receipt.runtimeBindings.compiledLawDomainGenesisHash,
    );
    assert.equal(receipt.runtimeBindings.validatorGenesisClaimedMainnet, false);
    assert.deepEqual(receipt.runtimeBindings.lawDomainCases, execution.executionPlan.lawDomainCases);
    assert.equal(receipt.operationObservations.length, 15, receipt.blockers.join("\n"));
    assert.deepEqual(receipt.operationObservations.map(({ opcode }) => opcode), [...Array(15).keys()]);
    assert.deepEqual(
      receipt.rollbackObservations.map(({ transactionInstructionOpcodes }) =>
        transactionInstructionOpcodes),
      [[5, 12], [6, 12], [7, 12], [9, 12], [10, 12]],
    );
    assert.ok(receipt.rollbackObservations.every(({ atomicRollbackProven }) =>
      atomicRollbackProven === true));
    assert.ok(receipt.rollbackObservations.every(({ standaloneRetrySuccessProven }) =>
      standaloneRetrySuccessProven === true));
    const setEligibility = receipt.rollbackObservations[0];
    assert.ok(setEligibility.atomic.innerCpi.some(({ programId }) =>
      programId === SystemProgram.programId.toBase58()));
    assert.ok(setEligibility.standaloneRetry.innerCpi.some(({ programId }) =>
      programId === SystemProgram.programId.toBase58()));
    assert.deepEqual(receipt.safety, {
      localLoopbackOnly: true,
      validatorSpawned: false,
      publicNetworkUsed: false,
      keyGenerated: false,
      signerSecretsPersistedInReceipt: false,
      allFixturesValidatedBeforeSignerLoad: true,
      all15Observed: true,
      allFiveRollbackAndRetryProbesObserved: true,
      executionEvidenceAccepted: false,
      devnetExecuted: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    });
    assert.deepEqual(execution.signerLoadEvents.map(({ fixturesObserved }) => fixturesObserved), [
      execution.accountRecords.size,
    ]);
    assert.deepEqual(execution.adapterEvents.slice(0, 3), [
      "genesis",
      `deployment:${context.input.identities.lawProgramId}`,
      `deployment:${context.input.identities.economyProgramId}`,
    ]);
    assert.ok(execution.adapterEvents.indexOf("signer:payer")
      > execution.adapterEvents.lastIndexOf(
        `fixture:${execution.executionPlan.accountFixtures.at(-1).pubkey}`,
      ));
    assert.ok(receipt.blockers.includes("TEST_FAKE_ADAPTER_NOT_EVIDENCE"));
    assert.ok(receipt.blockers.includes("SOURCE_BOUND_LOCAL_REHEARSAL_NOT_EXECUTED"));
    assert.ok(receipt.blockers.includes("DEVNET_NOT_EXECUTED"));
    assert.ok(receipt.blockers.includes("MAINNET_HOLD"));
    assert.ok(receipt.blockers.includes(
      "NEGATIVE_LOCAL_DOMAIN_DAILY_LAW_REJECTION_NOT_EXECUTED",
    ));
    assert.ok(receipt.blockers.includes(
      "POSITIVE_COMPILED_DOMAIN_DAILY_LAW_ACCEPTANCE_NOT_ACCEPTED",
    ));
  },
));

test("a fabricated self-digested COMPLETE receipt is categorically rejected", () => withFixture(
  async (context) => {
    const execution = executionFixture(context);
    const receipt = await executeIatB3ProductionLocalRehearsal({
      preflight: execution.preflight,
      input: context.input,
      executionPlan: execution.executionPlan,
      adapter: execution.adapter,
    });
    const fabricated = structuredClone(receipt);
    fabricated.status = "COMPLETE";
    fabricated.exitCode = 0;
    fabricated.complete = true;
    fabricated.executionAuthority = "SOURCE_BOUND_LOOPBACK_ADAPTER";
    fabricated.blockers = [];
    fabricated.safety.executionEvidenceAccepted = true;
    const { receiptSha256: ignored, ...core } = fabricated;
    assert.ok(ignored);
    fabricated.receiptSha256 = canonicalDigest(core);
    assert.throws(
      () => validateIatB3ProductionLocalRehearsalExecutionReceipt(fabricated),
      /EXECUTION_RECEIPT_DIGEST_HOLD/u,
    );
  },
));

test("a promoted fake preflight cannot call any execution adapter surface", () => withFixture(
  async (context) => {
    const execution = executionFixture(context, { officialPreflight: true });
    const counters = Object.fromEntries([
      "observeGenesisHash",
      "observeProgramDeployment",
      "observeAccount",
      "decodeFixtureState",
      "loadEphemeralSignerBytes",
      "deriveEphemeralSignerPublicKey",
      "snapshotAccounts",
      "executeTransaction",
    ].map((method) => [method, 0]));
    const adapter = {
      kind: "TEST_FAKE",
      rpcUrl: context.input.rpc.url,
      ...Object.fromEntries(Object.keys(counters).map((method) => [method, async () => {
        counters[method] += 1;
        throw new Error(`UNEXPECTED_EXECUTION_METHOD:${method}`);
      }])),
    };
    const receipt = await executeIatB3ProductionLocalRehearsal({
      preflight: execution.preflight,
      input: context.input,
      executionPlan: execution.executionPlan,
      adapter,
    });
    assert.equal(receipt.status, "HOLD_TEST_EXECUTION_ONLY");
    assert.match(receipt.blockers[0], /TEST_PREFLIGHT_REQUIRED_HOLD/u);
    assert.ok(Object.values(counters).every((count) => count === 0));

    const noInput = await executeIatB3ProductionLocalRehearsal({ adapter });
    assert.equal(noInput.status, "HOLD_TEST_EXECUTION_ONLY");
    assert.match(noInput.blockers[0], /PREFLIGHT_RECORD_HOLD/u);
    assert.ok(Object.values(counters).every((count) => count === 0));
  },
));

test("a forged official kind with every adapter method is rejected by the private brand with zero calls", () => withFixture(
  async (context) => {
    const execution = executionFixture(context, { officialPreflight: true });
    let calls = 0;
    const adapter = {
      kind: "SOURCE_BOUND_LOOPBACK",
      rpcUrl: context.input.rpc.url,
      ...Object.fromEntries([
        "assertExecutionPlanBinding",
        "observeGenesisHash",
        "observeProgramDeployment",
        "observeAccount",
        "decodeFixtureState",
        "loadEphemeralSignerBytes",
        "deriveEphemeralSignerPublicKey",
        "disposeEphemeralSigners",
        "snapshotAccounts",
        "executeTransaction",
      ].map((method) => [method, async () => {
        calls += 1;
        throw new Error(`FORGED_METHOD_CALLED:${method}`);
      }])),
    };
    const receipt = await executeIatB3ProductionLocalRehearsal({
      preflight: execution.preflight,
      input: context.input,
      executionPlan: execution.executionPlan,
      adapter,
    });
    assert.equal(receipt.status, "HOLD");
    assert.match(receipt.blockers[0], /OFFICIAL_ADAPTER_BRAND_HOLD/u);
    assert.equal(calls, 0);
    assert.equal(receipt.safety.executionEvidenceAccepted, false);
  },
));

test("genesis, deployment, and fixture drift each stop before ephemeral signer bytes", () => withFixture(
  async (context) => {
    const scenarios = [
      {
        expected: /GENESIS_REOBSERVATION_HOLD/u,
        mutate(execution) {
          execution.adapter.observeGenesisHash = async () => publicKey(0x11);
        },
      },
      {
        expected: /LAW_DEPLOYMENT_REOBSERVATION_HOLD/u,
        mutate(execution) {
          const original = execution.adapter.observeProgramDeployment;
          execution.adapter.observeProgramDeployment = async (programId) => {
            const observation = await original(programId);
            return programId === context.input.identities.lawProgramId
              ? { ...observation, programAccountExecutable: false }
              : observation;
          };
        },
      },
      {
        expected: /FIXTURE_ACCOUNT_REJECTED_HOLD/u,
        mutate(execution) {
          const target = execution.executionPlan.accountFixtures[0].pubkey;
          const original = execution.adapter.observeAccount;
          execution.adapter.observeAccount = async (pubkey) => {
            const observation = await original(pubkey);
            return pubkey === target ? { ...observation, owner: publicKey(0x22) } : observation;
          };
        },
      },
      {
        expected: /COMPILED_LAW_DOMAIN_STATE_HOLD/u,
        mutate(execution) {
          const target = execution.executionPlan.dailyLawState;
          const original = execution.adapter.observeAccount;
          execution.adapter.observeAccount = async (pubkey) => {
            const observation = await original(pubkey);
            if (pubkey !== target) return observation;
            const bytes = Buffer.from(observation.dataBase64, "base64");
            new PublicKey(execution.executionPlan.validatorGenesisHash).toBuffer().copy(bytes, 48);
            return { ...observation, dataBase64: bytes.toString("base64") };
          };
        },
      },
    ];
    for (const scenario of scenarios) {
      const execution = executionFixture(context);
      scenario.mutate(execution);
      const receipt = await executeIatB3ProductionLocalRehearsal({
        preflight: execution.preflight,
        input: context.input,
        executionPlan: execution.executionPlan,
        adapter: execution.adapter,
      });
      assert.match(receipt.blockers[0], scenario.expected);
      assert.equal(execution.signerLoadEvents.length, 0);
      assert.equal(receipt.safety.allFixturesValidatedBeforeSignerLoad, false);
    }
  },
));

test("signer identity and exact log/CPI observations fail closed", () => withFixture(
  async (context) => {
    const signerMismatch = executionFixture(context);
    const otherSigner = Keypair.fromSeed(new Uint8Array(32).fill(0x42));
    signerMismatch.adapter.loadEphemeralSignerBytes = async () =>
      Uint8Array.from(otherSigner.secretKey);
    const signerReceipt = await executeIatB3ProductionLocalRehearsal({
      preflight: signerMismatch.preflight,
      input: context.input,
      executionPlan: signerMismatch.executionPlan,
      adapter: signerMismatch.adapter,
    });
    assert.match(signerReceipt.blockers[0], /SIGNER_PUBLIC_KEY_HOLD/u);

    const logDrift = executionFixture(context);
    const originalExecute = logDrift.adapter.executeTransaction;
    logDrift.adapter.executeTransaction = async (request) => {
      const result = await originalExecute(request);
      return request.caseId === "opcode-0"
        ? { ...result, logs: [...result.logs, "unexpected"] }
        : result;
    };
    const driftReceipt = await executeIatB3ProductionLocalRehearsal({
      preflight: logDrift.preflight,
      input: context.input,
      executionPlan: logDrift.executionPlan,
      adapter: logDrift.adapter,
    });
    assert.match(driftReceipt.blockers[0], /LOG_OR_CPI_DRIFT_HOLD/u);
    assert.equal(driftReceipt.operationObservations.length, 0);
  },
));

test("strict preflight validates every byte-bound fixture and remains execution-free", () => withFixture(
  ({ input, dependencies }) => {
    const executionCounters = {
      observeGenesisHash: 0,
      observeProgramDeployment: 0,
      observeAccount: 0,
      loadEphemeralSignerBytes: 0,
      snapshotAccounts: 0,
      executeTransaction: 0,
    };
    const instrumentedDependencies = { ...dependencies };
    for (const method of Object.keys(executionCounters)) {
      instrumentedDependencies[method] = () => {
        executionCounters[method] += 1;
        throw new Error(`UNEXPECTED_EXECUTION_METHOD:${method}`);
      };
    }
    const preflight = preflightIatB3ProductionLocalRehearsal(input, instrumentedDependencies);
    assert.equal(preflight.status, "HOLD_TEST_VALIDATION_ONLY");
    assert.equal(preflight.exitCode, 2);
    assert.equal(preflight.validationAuthority, "TEST_ONLY_OVERRIDES_NOT_EVIDENCE");
    assert.equal(validateIatB3ProductionLocalRehearsalPreflight(preflight), preflight);
    assert.deepEqual(preflight.expectedDispositions, IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS);
    assert.ok(preflight.blockers.includes("LOCAL_EXECUTION_DRIVER_NOT_IMPLEMENTED"));
    assert.ok(preflight.blockers.includes("ALL_15_NOT_EXECUTED"));
    assert.ok(preflight.blockers.includes("FIVE_FINAL_ARTIFACT_ROLLBACK_PROBES_NOT_EXECUTED"));
    assert.deepEqual(preflight.safety, {
      preflightOnly: true,
      officialIdentityAndReceiptValidatorsUsed: false,
      fixtureValidationCompletedBeforeSignerLoad: true,
      signerFilesLoaded: false,
      validatorSpawned: false,
      ledgerCreated: false,
      keyGenerated: false,
      rpcUsed: false,
      transactionSigned: false,
      transactionSent: false,
      networkUsed: false,
      executionEvidenceCreated: false,
      mainnetExecutionAuthorized: false,
    });
    assert.deepEqual(executionCounters, {
      observeGenesisHash: 0,
      observeProgramDeployment: 0,
      observeAccount: 0,
      loadEphemeralSignerBytes: 0,
      snapshotAccounts: 0,
      executeTransaction: 0,
    });
  },
));

test("input must be exact canonical JSON and every file hash is checked", () => withFixture(
  ({ input, inputPath, dependencies, root }) => {
    assert.deepEqual(readCanonicalIatB3ProductionLocalRehearsalInput(inputPath), input);
    writeFileSync(inputPath, JSON.stringify(input, null, 2));
    assert.equal(observeIatB3ProductionLocalRehearsalPreflight({ inputPath, dependencies }).status, "HOLD");

    canonicalWrite(inputPath, input);
    const hashDrift = structuredClone(input);
    hashDrift.productionMap.productionClientModule.sha256 = "0".repeat(64);
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(hashDrift, dependencies),
      /PRODUCTION_CLIENT_MODULE_HASH_HOLD/u,
    );

    const contentDrift = structuredClone(input);
    const driftPath = join(root, "expected-drift.json");
    writeFileSync(driftPath, `${canonicalIatB3ProductionLocalRehearsalJson({ drift: true })}\n`);
    contentDrift.expectedDispositionFixture = descriptor(driftPath);
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(contentDrift, dependencies),
      /EXPECTED_DISPOSITION_DRIFT_HOLD/u,
    );
  },
));

test("RPC is numeric-loopback only and ledger/signer material must stay disposable and outside the repository", () => withFixture(
  ({ input, dependencies, root }) => {
    for (const url of [
      "http://localhost:18899/",
      "http://[::1]:18899/",
      "https://127.0.0.1:18899/",
      "http://127.0.0.2:18899/",
      "http://127.0.0.1:18899/?cluster=mainnet",
      "http://user:pass@127.0.0.1:18899/",
    ]) {
      const drift = structuredClone(input);
      drift.rpc.url = url;
      assert.throws(
        () => preflightIatB3ProductionLocalRehearsal(drift, dependencies),
        /RPC_LOOPBACK_HOLD/u,
        url,
      );
    }
    const repositoryLedger = structuredClone(input);
    repositoryLedger.ledger.path = resolve(ROOT, "iat-b3-production-local-rehearsal-ledger");
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(repositoryLedger, dependencies),
      /LEDGER_POLICY_HOLD/u,
    );
    const existingLedger = structuredClone(input);
    writeFileSync(existingLedger.ledger.path, "not disposable");
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(existingLedger, dependencies),
      /LEDGER_ALREADY_EXISTS_HOLD/u,
    );
    rmSync(existingLedger.ledger.path, { force: true });
    const signerInRepository = structuredClone(input);
    signerInRepository.executionBoundary.ephemeralSignerDirectory = resolve(ROOT, "signers");
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(signerInRepository, dependencies),
      /EXECUTION_BOUNDARY_HOLD/u,
    );
    assert.ok(root.startsWith(tmpdir()));
  },
));

test("receipt, ELF, program identity, and map/client bindings fail closed independently", () => withFixture(
  ({ input, dependencies, root }) => {
    const wrongReceipt = structuredClone(input);
    wrongReceipt.artifacts.law.receipt = writeBoundFile(
      join(root, "wrong-law-receipt.json"),
      Buffer.from(JSON.stringify({
        source: { declaredHeadSha: "2".repeat(40) },
        artifact: {
          sha256: input.artifacts.law.elf.sha256,
          byteLength: input.artifacts.law.elf.byteLength,
        },
        identityBinding: {
          manifestSha256: input.identities.manifest.sha256,
          environmentBindingSha256: "a".repeat(64),
        },
      })),
    );
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(wrongReceipt, dependencies),
      /LAW_RECEIPT_BINDING_HOLD/u,
    );

    const notElf = structuredClone(input);
    notElf.artifacts.economy.elf = writeBoundFile(join(root, "not-elf.so"), Buffer.from("not elf"));
    const notElfReceipt = {
      source: { declaredHeadSha: HEAD },
      artifact: {
        sha256: notElf.artifacts.economy.elf.sha256,
        byteLength: notElf.artifacts.economy.elf.byteLength,
      },
      identityBinding: {
        manifestSha256: input.identities.manifest.sha256,
        environmentBindingSha256: "b".repeat(64),
      },
    };
    notElf.artifacts.economy.receipt = writeBoundFile(
      join(root, "not-elf-receipt.json"),
      Buffer.from(JSON.stringify(notElfReceipt)),
    );
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(notElf, dependencies),
      /ECONOMY_ELF_HOLD/u,
    );

    const mapDrift = structuredClone(input);
    mapDrift.productionMap.canonicalMapSha256 = "f".repeat(64);
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(mapDrift, dependencies),
      /MAP_CLIENT_DRIFT_HOLD/u,
    );

    const wrongProgram = structuredClone(input);
    wrongProgram.artifacts.law.programId = input.identities.economyProgramId;
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(wrongProgram, dependencies),
      /LAW_PROGRAM_ID_HOLD/u,
    );
  },
));

test("symlinked inputs and fixture files are rejected before content use", (context) => withFixture(
  ({ input, inputPath, dependencies, root }) => {
    const linkPath = join(root, "input-link.json");
    try {
      symlinkSync(inputPath, linkPath, "file");
    } catch (error) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
        context.skip(`symlink creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const linkedInput = observeIatB3ProductionLocalRehearsalPreflight({
      inputPath: linkPath,
      dependencies,
    });
    assert.equal(linkedInput.status, "HOLD");
    assert.match(linkedInput.blockers[0], /SYMLINK_HOLD/u);

    const linkedArtifactInput = structuredClone(input);
    const artifactLink = join(root, "law-link.so");
    symlinkSync(input.artifacts.law.elf.path, artifactLink, "file");
    linkedArtifactInput.artifacts.law.elf = {
      ...input.artifacts.law.elf,
      path: artifactLink,
    };
    assert.throws(
      () => preflightIatB3ProductionLocalRehearsal(linkedArtifactInput, dependencies),
      /SYMLINK_HOLD/u,
    );
  },
));

test("CLI is preflight-only, no-input fail-closed, and has no validator/RPC/key/sign/send surface", () => {
  assert.throws(
    () => parseIatB3ProductionLocalRehearsalArguments([]),
    /PREFLIGHT_FLAG_REQUIRED_HOLD/u,
  );
  assert.throws(
    () => parseIatB3ProductionLocalRehearsalArguments(["--preflight"]),
    /INPUT_REQUIRED_HOLD/u,
  );
  const direct = runIatB3ProductionLocalRehearsalCli([]);
  assert.equal(direct.status, "HOLD");
  assert.equal(direct.exitCode, 2);
  assert.equal(validateIatB3ProductionLocalRehearsalPreflight(direct), direct);

  const child = spawnSync(NODE, [DRIVER, "--preflight"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(child.status, 2, child.stderr);
  const childRecord = JSON.parse(child.stdout);
  assert.equal(childRecord.status, "HOLD");
  assert.equal(childRecord.safety.signerFilesLoaded, false);
  assert.equal(childRecord.safety.validatorSpawned, false);
  assert.equal(childRecord.safety.rpcUsed, false);
  assert.equal(childRecord.safety.transactionSigned, false);
  assert.equal(childRecord.safety.transactionSent, false);

  const driverSource = readFileSync(DRIVER, "utf8");
  const contractSource = readFileSync(
    resolve(ROOT, "scripts/lib/iat-b3-production-local-rehearsal-contract.mjs"),
    "utf8",
  );
  for (const forbidden of [
    /\bConnection\b/u,
    /\bKeypair\b/u,
    /sendAndConfirmTransaction/u,
    /sendRawTransaction/u,
    /sendTransaction/u,
    /solana-test-validator/u,
    /spawn(?:Sync)?\s*\(/u,
    /generateKeypair/u,
    /secretKey/u,
  ]) {
    assert.doesNotMatch(driverSource, forbidden);
  }
  for (const forbidden of [
    /\bConnection\b/u,
    /\bKeypair\b/u,
    /sendAndConfirmTransaction/u,
    /sendRawTransaction/u,
    /sendTransaction/u,
    /solana-test-validator/u,
    /spawn(?:Sync)?\s*\(/u,
    /generateKeypair/u,
  ]) assert.doesNotMatch(contractSource, forbidden);
  assert.match(contractSource, /preflight\.status !== "HOLD_TEST_VALIDATION_ONLY"/u);
  assert.match(
    contractSource,
    /sourceBoundPreflight = preflightIatB3ProductionLocalRehearsal\(input\)/u,
  );
  assert.match(
    contractSource,
    /canonicalIatB3ProductionLocalRehearsalJson\(sourceBoundPreflight\)[\s\S]*canonicalIatB3ProductionLocalRehearsalJson\(preflight\)/u,
  );
});

test("preflight receipt cannot be promoted or mutated after creation", () => withFixture(
  ({ input, dependencies }) => {
    const record = preflightIatB3ProductionLocalRehearsal(input, dependencies);
    const tampered = structuredClone(record);
    tampered.safety.transactionSent = true;
    assert.throws(
      () => validateIatB3ProductionLocalRehearsalPreflight(tampered),
      /PREFLIGHT_DIGEST_HOLD/u,
    );
    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.expectedDispositions), true);
  },
));

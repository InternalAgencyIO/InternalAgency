import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  AccountLayout,
  getExtraAccountMetaAddress,
  MintLayout,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import {
  COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
} from "../scripts/run-iat-b3-combined-law-reproducible-build.mjs";
import {
  ECONOMY_BUILD_RECEIPT_SCHEMA,
} from "../scripts/run-iat-b3-economy-reproducible-build.mjs";
import {
  IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_CHECKPOINT,
  IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_INPUT_SCHEMA,
  IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_FIXTURE_INPUT_SCHEMA,
  IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_TEST_STATUS,
  buildIatB3ProductionOfficialRehearsalSourceContract,
  canonicalIatB3ProductionAccountSnapshot,
  canonicalIatB3ProductionOfficialRehearsalJson,
  createIatB3ProductionOfficialLocalRehearsalExecutionReceipt,
  packIatB3ProductionOfficialLocalRehearsalFixtures,
  sha256IatB3ProductionOfficialRehearsalValue,
  validateAndPackIatB3ProductionConcreteFixture,
  validateIatB3ProductionMutableFixtureIsolation,
  validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt,
  validateIatB3ProductionOfficialLocalRehearsalFixturePack,
  validateIatB3ProductionOfficialTransactionObservation,
} from "../scripts/lib/iat-b3-production-official-local-rehearsal-evidence.mjs";
import {
  IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID,
} from "../scripts/lib/iat-b3-production-local-rehearsal-contract.mjs";
import { decodeIatB3ProductionFixtureState } from
  "../scripts/lib/iat-b3-production-loopback-adapter.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const key = (label) => new PublicKey(createHash("sha256").update(label).digest()).toBase58();
const hashLabel = (label) => sha256(Buffer.from(label, "utf8"));
const loader = new PublicKey(IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID);
const zkProgram = "ZkE1Gama1Proof11111111111111111111111111111";
const nativeLoader = "NativeLoader1111111111111111111111111111111";
const tokenProgram = TOKEN_2022_PROGRAM_ID.toBase58();
const signerKeypairs = {
  admin: Keypair.fromSeed(createHash("sha256").update("admin-signer").digest()),
  owner: Keypair.fromSeed(createHash("sha256").update("owner-signer").digest()),
  caller: Keypair.fromSeed(createHash("sha256").update("caller-signer").digest()),
};

function instruction(opcode, lane = null, positionId = 1n, principal = 1_000n) {
  const bytes = Buffer.alloc(32);
  bytes.write("IATB3EC1", 0, "ascii");
  bytes[8] = 1;
  bytes[9] = opcode;
  if (opcode === 6) {
    bytes.writeBigUInt64LE(positionId, 16);
    bytes.writeBigUInt64LE(principal, 24);
  }
  if ([7, 12].includes(opcode)) bytes.writeBigUInt64LE(1n, 16);
  if (opcode === 9) bytes[16] = lane;
  return bytes.toString("base64");
}

function deployment(programId, authority, elf) {
  const programData = PublicKey.findProgramAddressSync(
    [new PublicKey(programId).toBuffer()],
    loader,
  )[0];
  const programBytes = Buffer.alloc(36);
  programBytes.writeUInt32LE(2, 0);
  programData.toBuffer().copy(programBytes, 4);
  const programDataBytes = Buffer.alloc(45 + elf.length);
  programDataBytes.writeUInt32LE(3, 0);
  programDataBytes.writeBigUInt64LE(1n, 4);
  programDataBytes[12] = 1;
  new PublicKey(authority).toBuffer().copy(programDataBytes, 13);
  elf.copy(programDataBytes, 45);
  return {
    program: {
      pubkey: programId,
      owner: IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID,
      executable: true,
      lamports: 1,
      rentEpoch: 0,
      dataBase64: programBytes.toString("base64"),
    },
    programData: {
      pubkey: programData.toBase58(),
      owner: IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID,
      executable: false,
      lamports: 1,
      rentEpoch: 0,
      dataBase64: programDataBytes.toString("base64"),
    },
  };
}

function pda(programId, seed, ...parts) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed, "utf8"), ...parts.map((part) => Buffer.isBuffer(part)
      ? part : new PublicKey(part).toBuffer())],
    new PublicKey(programId),
  )[0].toBase58();
}

const economyLogs = (programId, errorCode) => [
  `Program ${programId} invoke [1]`,
  errorCode === null
    ? `Program ${programId} success`
    : `Program ${programId} failed: custom program error: 0x${errorCode.toString(16)}`,
];

function sourceLogs(programId, errorCode, innerCpi, instructionIndex = 0) {
  const result = [`Program ${programId} invoke [1]`];
  const stack = [];
  for (const entry of innerCpi.filter((value) => value.instructionIndex === instructionIndex)) {
    while (stack.length > 0 && stack.at(-1).stackHeight >= entry.stackHeight) {
      result.push(`Program ${stack.pop().programId} success`);
    }
    result.push(`Program ${entry.programId} invoke [${entry.stackHeight}]`);
    stack.push(entry);
  }
  while (stack.length > 0) result.push(`Program ${stack.pop().programId} success`);
  result.push(...economyLogs(programId, errorCode).slice(1));
  return result;
}

const u64 = (value) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
};

function transferCpi(programId, accounts, amount = 1n, instructionIndex = 0) {
  const transfer = Buffer.alloc(10);
  transfer[0] = 12;
  transfer.writeBigUInt64LE(amount, 1);
  transfer[9] = 9;
  return [{
    instructionIndex,
    stackHeight: 2,
    programId: tokenProgram,
    accounts,
    dataBase64: transfer.toString("base64"),
  }, {
    instructionIndex,
    stackHeight: 3,
    programId,
    accounts: [accounts[0], accounts[1], accounts[2], accounts[3], accounts[5], accounts[4]],
    dataBase64: Buffer.concat([
      Buffer.from("692565c54bfb661a", "hex"),
      u64(amount),
    ]).toString("base64"),
  }];
}

function createAccountCpi(programId, payer, target, space, instructionIndex = 0) {
  const data = Buffer.alloc(52);
  data.writeUInt32LE(0, 0);
  data.writeBigUInt64LE(1n, 4);
  data.writeBigUInt64LE(BigInt(space), 12);
  new PublicKey(programId).toBuffer().copy(data, 20);
  return {
    instructionIndex,
    stackHeight: 2,
    programId: SystemProgram.programId.toBase58(),
    accounts: [payer, target],
    dataBase64: data.toString("base64"),
  };
}

function approveCpi(accounts, amount, instructionIndex = 0) {
  const data = Buffer.alloc(10);
  data[0] = 13;
  data.writeBigUInt64LE(amount, 1);
  data[9] = 9;
  return {
    instructionIndex,
    stackHeight: 2,
    programId: tokenProgram,
    accounts,
    dataBase64: data.toString("base64"),
  };
}

function systemTransferCpi(payer, target, amount, instructionIndex = 0) {
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0);
  data.writeBigUInt64LE(amount, 4);
  return {
    instructionIndex,
    stackHeight: 2,
    programId: SystemProgram.programId.toBase58(),
    accounts: [payer, target],
    dataBase64: data.toString("base64"),
  };
}

function systemAllocateCpi(target, space, instructionIndex = 0) {
  const data = Buffer.alloc(12);
  data.writeUInt32LE(8, 0);
  data.writeBigUInt64LE(BigInt(space), 4);
  return {
    instructionIndex,
    stackHeight: 2,
    programId: SystemProgram.programId.toBase58(),
    accounts: [target],
    dataBase64: data.toString("base64"),
  };
}

function systemAssignCpi(target, owner, instructionIndex = 0) {
  const data = Buffer.alloc(36);
  data.writeUInt32LE(1, 0);
  new PublicKey(owner).toBuffer().copy(data, 4);
  return {
    instructionIndex,
    stackHeight: 2,
    programId: SystemProgram.programId.toBase58(),
    accounts: [target],
    dataBase64: data.toString("base64"),
  };
}

function writeKey(bytes, offset, value) {
  new PublicKey(value).toBuffer().copy(bytes, offset);
}

function encodeLawState(state) {
  const bytes = Buffer.alloc(160);
  bytes.write("IATB3S01", 0, "ascii");
  bytes[8] = 1;
  bytes[9] = state.bump;
  writeKey(bytes, 16, state.mint);
  writeKey(bytes, 48, state.compiledLawDomainGenesisHash);
  if (state.decision) {
    bytes[10] = 1;
    bytes[11] = state.decision.locked ? 1 : 0;
    bytes.writeBigInt64LE(BigInt(state.decision.localDay), 80);
    bytes.writeBigUInt64LE(BigInt(state.decision.entropySlot), 88);
    Buffer.from(state.decision.ancestorSlotHash, "hex").copy(bytes, 96);
    bytes.writeBigUInt64LE(BigInt(state.decision.drawCounter), 128);
    bytes.writeUInt16LE(state.decision.drawBucket, 136);
    bytes.writeUInt16LE(state.decision.chanceNumerator, 138);
    bytes.writeUInt16LE(state.decision.chanceDenominator, 140);
  }
  return bytes;
}

function encodeConfig(state) {
  const bytes = Buffer.alloc(272);
  bytes.write("IATB3CFG", 0, "ascii");
  bytes[8] = 1;
  bytes[9] = state.phase;
  writeKey(bytes, 32, state.admin);
  writeKey(bytes, 64, state.mint);
  writeKey(bytes, 96, state.tokenProgram);
  writeKey(bytes, 128, state.randomnessProgram);
  writeKey(bytes, 160, state.stakeTokenAccount);
  Buffer.from(state.agencyRegistryHash, "hex").copy(bytes, 192);
  bytes.writeBigInt64LE(BigInt(state.genesisTimestamp), 224);
  bytes.writeBigUInt64LE(BigInt(state.expectedSupply), 232);
  bytes.writeBigUInt64LE(BigInt(state.stakedPrincipal), 240);
  bytes.writeUInt32LE(state.agencyCount, 248);
  bytes[252] = state.rehearsalMode ? 1 : 0;
  bytes[253] = state.active ? 1 : 0;
  bytes[254] = state.laneMask;
  bytes[255] = state.stakeVaultInitialized ? 1 : 0;
  bytes[256] = state.bump;
  bytes[257] = state.vaultAuthorityBump;
  return bytes;
}

function encodePosition(state) {
  const bytes = Buffer.alloc(176);
  bytes.write("IATB3POS", 0, "ascii");
  bytes[8] = 1;
  writeKey(bytes, 16, state.config);
  writeKey(bytes, 48, state.owner);
  for (const [offset, name] of [
    [80, "positionId"], [88, "principal"], [96, "acceptedWeek"],
    [104, "firstAccrualWeek"], [112, "termWeeks"], [120, "annualRateBps"],
    [128, "treasuryReserved"], [136, "ecosystemReserved"],
    [144, "liquidityReserved"], [152, "paid"], [160, "settledMask"],
  ]) bytes.writeBigUInt64LE(BigInt(state[name]), offset);
  bytes.writeUInt32LE(state.agencyIndex, 168);
  bytes[172] = state.role;
  bytes[173] = state.principalReturned ? 1 : 0;
  bytes[174] = state.closed ? 1 : 0;
  bytes[175] = state.bump;
  return bytes;
}

function encodeLane(state) {
  const bytes = Buffer.alloc(176);
  bytes.write("IATB3LAN", 0, "ascii");
  bytes[8] = 1;
  writeKey(bytes, 16, state.config);
  writeKey(bytes, 48, state.tokenAccount);
  writeKey(bytes, 80, state.beneficiary);
  for (const [offset, name] of [
    [112, "total"], [120, "genesisUnlocked"], [128, "cliffWeek"],
    [136, "linearEndWeek"], [144, "reserved"], [152, "paid"],
    [160, "principalClaimed"],
  ]) bytes.writeBigUInt64LE(BigInt(state[name]), offset);
  bytes[168] = state.lane;
  bytes[169] = state.rewardSource ? 1 : 0;
  bytes[170] = state.bump;
  bytes[171] = state.tokenBump;
  return bytes;
}

function encodeEligibility(state) {
  const bytes = Buffer.alloc(96);
  bytes.write("IATB3ELG", 0, "ascii");
  bytes[8] = 1;
  writeKey(bytes, 16, state.config);
  writeKey(bytes, 48, state.wallet);
  bytes.writeUInt32LE(state.agencyIndex, 80);
  bytes[84] = state.role;
  bytes[85] = state.bump;
  return bytes;
}

function encodeTokenMint(state) {
  const bytes = Buffer.alloc(MintLayout.span);
  MintLayout.encode({
    mintAuthorityOption: 0,
    mintAuthority: PublicKey.default,
    supply: BigInt(state.supply),
    decimals: state.decimals,
    isInitialized: state.isInitialized,
    freezeAuthorityOption: 0,
    freezeAuthority: PublicKey.default,
  }, bytes);
  return bytes;
}

function encodeTokenAccount(state) {
  const bytes = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode({
    mint: new PublicKey(state.mint),
    owner: new PublicKey(state.owner),
    amount: BigInt(state.amount),
    delegateOption: state.delegate === null ? 0 : 1,
    delegate: state.delegate === null ? PublicKey.default : new PublicKey(state.delegate),
    state: state.isFrozen ? 2 : 1,
    isNativeOption: state.isNative ? 1 : 0,
    isNative: state.rentExemptReserve === null ? 0n : BigInt(state.rentExemptReserve),
    delegatedAmount: BigInt(state.delegatedAmount),
    closeAuthorityOption: state.closeAuthority === null ? 0 : 1,
    closeAuthority: state.closeAuthority === null
      ? PublicKey.default : new PublicKey(state.closeAuthority),
  }, bytes);
  return bytes;
}

function encodeCodecState(codec, state) {
  if (codec === "LAW_STATE_V1") return encodeLawState(state);
  if (codec === "ECONOMY_CONFIG_V1") return encodeConfig(state);
  if (codec === "ECONOMY_POSITION_V1") return encodePosition(state);
  if (codec === "ECONOMY_LANE_V1") return encodeLane(state);
  if (codec === "ECONOMY_ELIGIBILITY_V1") return encodeEligibility(state);
  if (codec === "TOKEN_2022_MINT") return encodeTokenMint(state);
  if (codec === "TOKEN_2022_ACCOUNT") return encodeTokenAccount(state);
  if (codec === "SYSTEM_VACANT") return Buffer.alloc(0);
  throw new Error(`test encoder missing ${codec}`);
}

function buildSyntheticFixtureInput({
  setEligibilityLifecycle = "CREATE",
  openPositionVariant = "BASE",
} = {}) {
  const source = buildIatB3ProductionOfficialRehearsalSourceContract();
  const identities = {
    identityManifestSha256: hashLabel("pending-identity-manifest"),
    ownerPolicySha256: hashLabel("owner-policy"),
    environmentBindingSha256: hashLabel("pending-environment"),
    lawProgramId: key("law-program"),
    economyProgramId: key("economy-program"),
    canonicalMint: key("canonical-mint"),
    dailyLawState: key("daily-law-state"),
    lawUpgradeAuthority: key("law-upgrade-authority"),
    economyUpgradeAuthority: key("economy-upgrade-authority"),
    compiledLawDomainGenesisHash: key("compiled-law-domain"),
  };
  const buildEnvironment = {
    IAT_B3_PRODUCTION_LAW_PROGRAM_ID: identities.lawProgramId,
    IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: identities.economyProgramId,
    IAT_B3_PRODUCTION_CANONICAL_MINT: identities.canonicalMint,
    IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH: identities.compiledLawDomainGenesisHash,
  };
  const lawBuildEnvironment = Object.fromEntries(Object.entries(buildEnvironment).slice(0, 3));
  const identityManifestBytes = Buffer.from(JSON.stringify({
    schema: "synthetic-test-only-identity-manifest/v1",
    identities: {
      lawProgramId: identities.lawProgramId,
      economyProgramId: identities.economyProgramId,
      canonicalMint: identities.canonicalMint,
    },
    networkBinding: { genesisHash: identities.compiledLawDomainGenesisHash },
  }), "utf8");
  identities.identityManifestSha256 = sha256(identityManifestBytes);
  identities.environmentBindingSha256 =
    sha256IatB3ProductionOfficialRehearsalValue(buildEnvironment);
  const lawElf = Buffer.from("public deterministic synthetic law elf", "utf8");
  const economyElf = Buffer.from("public deterministic synthetic economy elf", "utf8");
  const lawDeployment = deployment(
    identities.lawProgramId,
    identities.lawUpgradeAuthority,
    lawElf,
  );
  const economyDeployment = deployment(
    identities.economyProgramId,
    identities.economyUpgradeAuthority,
    economyElf,
  );
  const signerKeys = {
    admin: signerKeypairs.admin.publicKey.toBase58(),
    owner: signerKeypairs.owner.publicKey.toBase58(),
    caller: signerKeypairs.caller.publicKey.toBase58(),
  };
  const evidenceSnapshots = new Map();
  const config = pda(identities.economyProgramId, "config", identities.canonicalMint);
  const rolePlan = new Map(source.fixtureRoles.map((entry) => [entry.role, entry]));
  const fixtures = [];
  const decodedByData = new Map();
  const sharedFixtureByRoleAndPubkey = new Map();
  const sourceSharedAddresses = new Set([
    identities.dailyLawState,
    config,
    identities.canonicalMint,
    SystemProgram.programId.toBase58(),
    TOKEN_2022_PROGRAM_ID.toBase58(),
    zkProgram,
    identities.lawProgramId,
    getExtraAccountMetaAddress(
      new PublicKey(identities.canonicalMint),
      new PublicKey(identities.lawProgramId),
    ).toBase58(),
    ...Object.values(signerKeys),
    pda(identities.economyProgramId, "vault-authority", config),
    pda(identities.economyProgramId, "stake-token", config),
    pda(identities.economyProgramId, "stake-ingress", config),
    pda(identities.economyProgramId, "eligibility", config, signerKeys.owner),
    ...[1, 2, 4].flatMap((lane) => [
      pda(identities.economyProgramId, "lane", config, Buffer.from([lane])),
      pda(identities.economyProgramId, "lane-token", config, Buffer.from([lane])),
    ]),
  ]);
  let sequence = 0;
  const fixtureFor = (role, purpose, pubkeyValue, executable, decodedPatch = {}) => {
    const plan = rolePlan.get(role);
    assert.ok(plan, `missing role plan ${role}`);
    const shared = sourceSharedAddresses.has(pubkeyValue) && purpose !== "NEGATIVE_LOCAL_DOMAIN";
    const sharedKey = `${role}:${pubkeyValue}`;
    if (shared && sharedFixtureByRoleAndPubkey.has(sharedKey)) {
      return sharedFixtureByRoleAndPubkey.get(sharedKey);
    }
    const ownerByRule = {
      LAW_PROGRAM: identities.lawProgramId,
      ECONOMY_PROGRAM: identities.economyProgramId,
      ECONOMY_PROGRAM_OR_SYSTEM_VACANT_BY_CASE: identities.economyProgramId,
      TOKEN_2022_PROGRAM: TOKEN_2022_PROGRAM_ID.toBase58(),
      SYSTEM_PROGRAM: SystemProgram.programId.toBase58(),
      NATIVE_LOADER: nativeLoader,
      BPF_UPGRADEABLE_LOADER: IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID,
    };
    const requestedCodec = decodedPatch._codec ?? plan.codecAlternatives[0];
    const requestedLamports = decodedPatch._lamports ?? 10_000;
    const semanticPatch = { ...decodedPatch };
    delete semanticPatch._codec;
    delete semanticPatch._lamports;
    const lifecycleVacant = requestedCodec === "SYSTEM_VACANT";
    const owner = lifecycleVacant
      ? SystemProgram.programId.toBase58()
      : ownerByRule[plan.ownerRule] ?? SystemProgram.programId.toBase58();
    const codec = requestedCodec;
    const fixturePurpose = shared ? "SHARED_INFRASTRUCTURE" : purpose;
    const id = `${fixturePurpose}:${role}:${sequence += 1}`;
    let bytes;
    if (role === "transfer_hook_program") {
      bytes = Buffer.from(lawDeployment.program.dataBase64, "base64");
    } else if (codec === "UPGRADEABLE_PROGRAM") {
      bytes = Buffer.alloc(36);
      bytes.writeUInt32LE(2, 0);
      new PublicKey(key(`${id}:program-data`)).toBuffer().copy(bytes, 4);
    } else if (codec === "BYTE_BOUND") {
      bytes = Buffer.from(shared
        ? `public synthetic shared byte-bound fixture ${pubkeyValue}`
        : `public synthetic byte-bound fixture ${id}`, "utf8");
    } else {
      const [derivedConfig, configBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("config", "utf8"), new PublicKey(identities.canonicalMint).toBuffer()],
        new PublicKey(identities.economyProgramId),
      );
      assert.equal(derivedConfig.toBase58(), config);
      const defaultState = codec === "LAW_STATE_V1" ? {
        codec,
        bump: 1,
        mint: identities.canonicalMint,
        compiledLawDomainGenesisHash: fixturePurpose === "NEGATIVE_LOCAL_DOMAIN"
          ? key("validator-genesis") : identities.compiledLawDomainGenesisHash,
        decision: {
          locked: false,
          localDay: "1",
          entropySlot: "100",
          ancestorSlotHash: "11".repeat(32),
          drawCounter: "1",
          drawBucket: 0,
          chanceNumerator: 1,
          chanceDenominator: 20,
        },
      } : codec === "ECONOMY_CONFIG_V1" ? {
        codec,
        phase: 2,
        admin: signerKeys.admin,
        mint: identities.canonicalMint,
        tokenProgram: tokenProgram,
        randomnessProgram: key("randomness-program"),
        stakeTokenAccount: pda(identities.economyProgramId, "stake-token", config),
        agencyRegistryHash: "22".repeat(32),
        genesisTimestamp: "0",
        expectedSupply: "1000000000",
        stakedPrincipal: "100000",
        agencyCount: 0,
        rehearsalMode: false,
        active: true,
        laneMask: 0b1_0110,
        stakeVaultInitialized: true,
        bump: configBump,
        vaultAuthorityBump: PublicKey.findProgramAddressSync(
          [Buffer.from("vault-authority", "utf8"), new PublicKey(config).toBuffer()],
          new PublicKey(identities.economyProgramId),
        )[1],
      } : codec === "ECONOMY_POSITION_V1" ? {
        codec,
        config,
        owner: semanticPatch.owner ?? key(`${purpose}:position-owner`),
        positionId: semanticPatch.positionId ?? "1",
        principal: "5200",
        acceptedWeek: "0",
        firstAccrualWeek: "1",
        termWeeks: "52",
        annualRateBps: "1000",
        treasuryReserved: "100",
        ecosystemReserved: "20",
        liquidityReserved: "10",
        paid: "0",
        settledMask: "0",
        agencyIndex: 0xffff_ffff,
        role: 0,
        principalReturned: false,
        closed: false,
        bump: 1,
      } : codec === "ECONOMY_LANE_V1" ? {
        codec,
        config,
        tokenAccount: semanticPatch.tokenAccount,
        beneficiary: key(`${pubkeyValue}:beneficiary`),
        total: "1000000",
        genesisUnlocked: "1000000",
        cliffWeek: "0",
        linearEndWeek: "1",
        reserved: "10000",
        paid: "0",
        principalClaimed: "0",
        lane: semanticPatch.lane,
        rewardSource: true,
        bump: 1,
        tokenBump: 1,
      } : codec === "ECONOMY_ELIGIBILITY_V1" ? {
        codec,
        config,
        wallet: semanticPatch.wallet,
        agencyIndex: 0xffff_ffff,
        role: 0,
        bump: 1,
      } : codec === "TOKEN_2022_MINT" ? {
        codec,
        supply: "1000000000",
        decimals: 9,
        isInitialized: true,
      } : codec === "TOKEN_2022_ACCOUNT" ? {
        codec,
        mint: identities.canonicalMint,
        owner: semanticPatch.owner ?? key(`${pubkeyValue}:token-owner`),
        amount: semanticPatch.amount ?? "1000000",
        delegate: semanticPatch.delegate ?? null,
        delegatedAmount: semanticPatch.delegatedAmount ?? "0",
        isInitialized: true,
        isFrozen: false,
        isNative: false,
        rentExemptReserve: null,
        closeAuthority: null,
      } : { codec };
      const state = { ...defaultState, ...semanticPatch };
      if (codec === "ECONOMY_POSITION_V1") {
        const idBytes = Buffer.alloc(8);
        idBytes.writeBigUInt64LE(BigInt(state.positionId));
        state.bump = PublicKey.findProgramAddressSync([
          Buffer.from("position", "utf8"), new PublicKey(config).toBuffer(),
          new PublicKey(state.owner).toBuffer(), idBytes,
        ], new PublicKey(identities.economyProgramId))[1];
      } else if (codec === "ECONOMY_LANE_V1") {
        state.bump = PublicKey.findProgramAddressSync([
          Buffer.from("lane", "utf8"), new PublicKey(config).toBuffer(), Buffer.from([state.lane]),
        ], new PublicKey(identities.economyProgramId))[1];
        state.tokenBump = PublicKey.findProgramAddressSync([
          Buffer.from("lane-token", "utf8"), new PublicKey(config).toBuffer(),
          Buffer.from([state.lane]),
        ], new PublicKey(identities.economyProgramId))[1];
      } else if (codec === "ECONOMY_ELIGIBILITY_V1") {
        state.bump = PublicKey.findProgramAddressSync([
          Buffer.from("eligibility", "utf8"), new PublicKey(config).toBuffer(),
          new PublicKey(state.wallet).toBuffer(),
        ], new PublicKey(identities.economyProgramId))[1];
      }
      bytes = encodeCodecState(codec, state);
    }
    const decodedState = decodeIatB3ProductionFixtureState({
      codec,
      pubkey: pubkeyValue,
      owner,
      dataBase64: bytes.toString("base64"),
    });
    decodedByData.set(`${codec}:${pubkeyValue}:${bytes.toString("base64")}`, decodedState);
    fixtures.push({
      id,
      purpose: fixturePurpose,
      role,
      codec,
      pubkey: pubkeyValue,
      owner,
      executable,
      lamports: requestedLamports,
      rentEpoch: 0,
      dataBase64: bytes.toString("base64"),
      dataSha256: sha256(bytes),
      decodedState,
      decodedStateSha256: sha256IatB3ProductionOfficialRehearsalValue(decodedState),
      pda: null,
    });
    if (shared) sharedFixtureByRoleAndPubkey.set(sharedKey, id);
    return id;
  };
  const sharedSignerFixtureIds = Object.fromEntries(
    Object.entries(signerKeys).map(([role, pubkeyValue]) => [
      role,
      fixtureFor(role, "SHARED_EPHEMERAL_SIGNER", pubkeyValue, false),
    ]),
  );
  const addressFor = (role, opcode, lane, purpose, accountAddresses) => {
    if (role === "daily_law_state") return identities.dailyLawState;
    if (role === "config") return config;
    if (role === "mint") return identities.canonicalMint;
    if (role === "system_program") return SystemProgram.programId.toBase58();
    if (role === "token_program") return TOKEN_2022_PROGRAM_ID.toBase58();
    if (role === "zk_elgamal_proof_program") return zkProgram;
    if (role === "transfer_hook_program") return identities.lawProgramId;
    if (role === "transfer_hook_validation") return getExtraAccountMetaAddress(
      new PublicKey(identities.canonicalMint),
      new PublicKey(identities.lawProgramId),
    ).toBase58();
    if (["admin", "owner", "caller"].includes(role)) return signerKeys[role];
    if (role === "prior_delegate") return accountAddresses.owner;
    if (role === "wallet") return key(`${purpose}:wallet`);
    if (role === "vault_authority") return pda(identities.economyProgramId, "vault-authority", config);
    if (role === "stake_tokens") return pda(identities.economyProgramId, "stake-token", config);
    if (role === "ingress_authority") return pda(identities.economyProgramId, "stake-ingress", config);
    const laneRoles = {
      treasury: ["lane", 1], treasury_tokens: ["lane-token", 1],
      ecosystem: ["lane", 2], ecosystem_tokens: ["lane-token", 2],
      liquidity: ["lane", 4], liquidity_tokens: ["lane-token", 4],
    };
    if (laneRoles[role]) {
      const [seed, laneValue] = laneRoles[role];
      return pda(identities.economyProgramId, seed, config, Buffer.from([laneValue]));
    }
    if (role === "lane_state") {
      return pda(identities.economyProgramId, "lane", config, Buffer.from([lane]));
    }
    if (role === "lane_tokens") {
      return pda(identities.economyProgramId, "lane-token", config, Buffer.from([lane]));
    }
    if (role === "eligibility") {
      const operator = opcode === 5 ? accountAddresses.wallet : accountAddresses.owner;
      return pda(identities.economyProgramId, "eligibility", config, operator);
    }
    if (role === "position") {
      const id = Buffer.alloc(8);
      id.writeBigUInt64LE(1n);
      const positionOwner = opcode === 6
        ? accountAddresses.owner : key(`${purpose}:position-owner`);
      return pda(identities.economyProgramId, "position", config, positionOwner, id);
    }
    return key(`${purpose}:${role}`);
  };
  const fixtureFromRole = (caseAccounts, role) => {
    const binding = caseAccounts.find((entry) => entry.role === role);
    return fixtures.find((fixture) => fixture.id === binding?.fixtureId);
  };
  const lifecycleCpi = (caseAccounts, payerRole, targetRole, space, accounts) => {
    const target = fixtureFromRole(caseAccounts, targetRole);
    if (target.codec !== "SYSTEM_VACANT") return [];
    if (target.lamports === 0) {
      const create = createAccountCpi(
        identities.economyProgramId,
        accounts[payerRole],
        accounts[targetRole],
        space,
      );
      const data = Buffer.from(create.dataBase64, "base64");
      data.writeBigUInt64LE(10n, 4);
      create.dataBase64 = data.toString("base64");
      return [create];
    }
    return [
      ...(target.lamports === 1
        ? [systemTransferCpi(accounts[payerRole], accounts[targetRole], 9n)] : []),
      systemAllocateCpi(accounts[targetRole], space),
      systemAssignCpi(accounts[targetRole], identities.economyProgramId),
    ];
  };
  const sourceInnerCpi = (sourceCase, accounts, caseAccounts, instructionDataBase64) => {
    const { opcode } = sourceCase;
    if (opcode === 5) return lifecycleCpi(caseAccounts, "admin", "eligibility", 96, accounts);
    if (opcode === 6) {
      const principal = Buffer.from(instructionDataBase64, "base64").readBigUInt64LE(24);
      return [
        approveCpi([
          accounts.owner_tokens, accounts.mint, accounts.ingress_authority, accounts.owner,
        ], principal),
        ...transferCpi(identities.lawProgramId, [
          accounts.owner_tokens, accounts.mint, accounts.stake_tokens, accounts.ingress_authority,
          accounts.daily_law_state, accounts.transfer_hook_validation,
          accounts.transfer_hook_program,
        ], principal),
        ...(accounts.prior_delegate ? [approveCpi([
          accounts.owner_tokens, accounts.mint, accounts.prior_delegate, accounts.owner,
        ], 77n)] : []),
        ...lifecycleCpi(caseAccounts, "owner", "position", 176, accounts),
      ];
    }
    const transfer = (roles, amount) => transferCpi(
      identities.lawProgramId,
      [
        ...roles.map((role) => accounts[role]),
        accounts.daily_law_state,
        accounts.transfer_hook_validation,
        accounts.transfer_hook_program,
      ],
      amount,
    );
    if (opcode === 7) {
      return transfer(["treasury_tokens", "mint", "destination_tokens", "vault_authority"], 10n);
    }
    if (opcode === 9) {
      return transfer(["lane_tokens", "mint", "destination_tokens", "vault_authority"], 5n);
    }
    if (opcode === 10) {
      const principal = BigInt(fixtureFromRole(caseAccounts, "position").decodedState.principal);
      return transfer(["stake_tokens", "mint", "destination_tokens", "vault_authority"], principal);
    }
    return [];
  };
  const snapshotFixture = (fixture) => Object.fromEntries([
    "pubkey", "owner", "lamports", "executable", "rentEpoch", "dataBase64",
  ].map((name) => [name, fixture[name]]));
  const sharedSnapshotState = new Map();
  const isSharedPubkey = (pubkeyValue) => pubkeyValue === identities.economyProgramId
    || fixtures.some((fixture) => fixture.pubkey === pubkeyValue
      && fixture.purpose === "SHARED_INFRASTRUCTURE");
  const exactSnapshotsFor = (
    caseAccounts,
    sourceCase,
    innerCpi,
    label,
    { commitSharedState = true, freshSharedBaseline = false } = {},
  ) => {
    const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
    const accounts = new Map();
    const add = (account) => {
      const chained = freshSharedBaseline ? account : sharedSnapshotState.get(account.pubkey) ?? account;
      const previous = accounts.get(account.pubkey);
      if (previous) assert.deepEqual(previous, chained, `snapshot alias drift ${label}`);
      accounts.set(account.pubkey, structuredClone(chained));
    };
    for (const account of caseAccounts) add(snapshotFixture(byId.get(account.fixtureId)));
    add(snapshotFixture(byId.get(sharedSignerFixtureIds.admin)));
    add({ ...economyDeployment.program });
    const before = canonicalIatB3ProductionAccountSnapshot([...accounts.values()]);
    const after = structuredClone(before);
    const feePayer = after.find(({ pubkey }) => pubkey === signerKeys.admin);
    feePayer.lamports -= 5;
    const active = sourceCase.disposition === "ACTIVE_EXPECTED_SUCCESS";
    if (active) {
      const byRole = new Map(caseAccounts.map((binding) => [binding.role, binding]));
      const accountForRole = (role, side = after) => {
        const fixture = byId.get(byRole.get(role)?.fixtureId);
        const value = side.find((account) => account.pubkey === fixture?.pubkey);
        assert.ok(value, `missing snapshot role ${role} in ${label}`);
        return value;
      };
      const fixtureForRole = (role) => byId.get(byRole.get(role)?.fixtureId);
      const decodeRole = (role, side = before, afterCodec = null) => {
        const fixture = fixtureForRole(role);
        const snapshot = accountForRole(role, side);
        return decodeIatB3ProductionFixtureState({
          codec: side === after && fixture.codec === "SYSTEM_VACANT" ? afterCodec : fixture.codec,
          pubkey: snapshot.pubkey,
          owner: snapshot.owner,
          dataBase64: snapshot.dataBase64,
        });
      };
      const writeRole = (role, codec, state) => {
        const snapshot = accountForRole(role);
        snapshot.dataBase64 = encodeCodecState(codec, state).toString("base64");
      };
      const tokenDelta = (role, delta) => {
        const state = decodeRole(role);
        state.amount = (BigInt(state.amount) + delta).toString();
        writeRole(role, "TOKEN_2022_ACCOUNT", state);
      };
      const lifecycle = (payerRole, targetRole, codec, state) => {
        const targetFixture = fixtureForRole(targetRole);
        if (targetFixture.codec === "SYSTEM_VACANT") {
          const funding = targetFixture.lamports === 0 ? 10
            : targetFixture.lamports === 1 ? 9 : 0;
          accountForRole(payerRole).lamports -= funding;
          const target = accountForRole(targetRole);
          target.lamports += funding;
          target.owner = identities.economyProgramId;
        }
        writeRole(targetRole, codec, state);
      };
      if (sourceCase.opcode === 5) {
        const wallet = accountForRole("wallet", before).pubkey;
        const bump = PublicKey.findProgramAddressSync([
          Buffer.from("eligibility", "utf8"), new PublicKey(config).toBuffer(),
          new PublicKey(wallet).toBuffer(),
        ], new PublicKey(identities.economyProgramId))[1];
        lifecycle("admin", "eligibility", "ECONOMY_ELIGIBILITY_V1", {
          codec: "ECONOMY_ELIGIBILITY_V1", config, wallet,
          agencyIndex: 0xffff_ffff, role: 0, bump,
        });
      } else if (sourceCase.opcode === 6) {
        const ix = Buffer.from(sourceCase.instructionDataBase64, "base64");
        const positionId = ix.readBigUInt64LE(16);
        const principal = ix.readBigUInt64LE(24);
        tokenDelta("owner_tokens", -principal);
        tokenDelta("stake_tokens", principal);
        const configState = decodeRole("config");
        configState.stakedPrincipal = (BigInt(configState.stakedPrincipal) + principal).toString();
        writeRole("config", "ECONOMY_CONFIG_V1", configState);
        const obligation = principal * 1000n / 10_000n;
        const treasury = decodeRole("treasury");
        treasury.reserved = (BigInt(treasury.reserved) + obligation).toString();
        writeRole("treasury", "ECONOMY_LANE_V1", treasury);
        const owner = accountForRole("owner", before).pubkey;
        const idBytes = Buffer.alloc(8);
        idBytes.writeBigUInt64LE(positionId);
        const bump = PublicKey.findProgramAddressSync([
          Buffer.from("position", "utf8"), new PublicKey(config).toBuffer(),
          new PublicKey(owner).toBuffer(), idBytes,
        ], new PublicKey(identities.economyProgramId))[1];
        lifecycle("owner", "position", "ECONOMY_POSITION_V1", {
          codec: "ECONOMY_POSITION_V1", config, owner,
          positionId: positionId.toString(), principal: principal.toString(),
          acceptedWeek: "0", firstAccrualWeek: "1", termWeeks: "52",
          annualRateBps: "1000", treasuryReserved: obligation.toString(),
          ecosystemReserved: "0", liquidityReserved: "0", paid: "0", settledMask: "0",
          agencyIndex: 0xffff_ffff, role: 0, principalReturned: false, closed: false, bump,
        });
      } else if (sourceCase.opcode === 7) {
        const position = decodeRole("position");
        position.treasuryReserved = (BigInt(position.treasuryReserved) - 10n).toString();
        position.paid = (BigInt(position.paid) + 10n).toString();
        position.settledMask = (BigInt(position.settledMask) | 1n).toString();
        writeRole("position", "ECONOMY_POSITION_V1", position);
        const treasury = decodeRole("treasury");
        treasury.reserved = (BigInt(treasury.reserved) - 10n).toString();
        treasury.paid = (BigInt(treasury.paid) + 10n).toString();
        writeRole("treasury", "ECONOMY_LANE_V1", treasury);
        tokenDelta("treasury_tokens", -10n);
        tokenDelta("destination_tokens", 10n);
      } else if (sourceCase.opcode === 9) {
        const lane = decodeRole("lane_state");
        lane.principalClaimed = (BigInt(lane.principalClaimed) + 5n).toString();
        writeRole("lane_state", "ECONOMY_LANE_V1", lane);
        tokenDelta("lane_tokens", -5n);
        tokenDelta("destination_tokens", 5n);
      } else if (sourceCase.opcode === 10) {
        const position = decodeRole("position");
        const principal = BigInt(position.principal);
        position.principalReturned = true;
        writeRole("position", "ECONOMY_POSITION_V1", position);
        const configState = decodeRole("config");
        configState.stakedPrincipal = (BigInt(configState.stakedPrincipal) - principal).toString();
        writeRole("config", "ECONOMY_CONFIG_V1", configState);
        tokenDelta("stake_tokens", -principal);
        tokenDelta("destination_tokens", principal);
      } else if (sourceCase.opcode === 11) {
        const position = decodeRole("position");
        for (const [role, field] of [
          ["treasury", "treasuryReserved"],
          ["ecosystem", "ecosystemReserved"],
          ["liquidity", "liquidityReserved"],
        ]) {
          const lane = decodeRole(role);
          lane.reserved = (BigInt(lane.reserved) - BigInt(position[field])).toString();
          writeRole(role, "ECONOMY_LANE_V1", lane);
          position[field] = "0";
        }
        position.closed = true;
        writeRole("position", "ECONOMY_POSITION_V1", position);
      }
    }
    if (commitSharedState) {
      for (const account of after) {
        if (isSharedPubkey(account.pubkey)) {
          sharedSnapshotState.set(account.pubkey, structuredClone(account));
        }
      }
    }
    return {
      before: canonicalIatB3ProductionAccountSnapshot(before),
      after: canonicalIatB3ProductionAccountSnapshot(after),
    };
  };
  const expectedFor = (
    sourceCase,
    label,
    accountAddresses,
    caseAccounts,
    snapshotOptions,
  ) => {
    const active = sourceCase.disposition === "ACTIVE_EXPECTED_SUCCESS";
    const innerCpi = active
      ? sourceInnerCpi(sourceCase, accountAddresses, caseAccounts, sourceCase.instructionDataBase64)
      : [];
    const { before, after } = exactSnapshotsFor(
      caseAccounts,
      sourceCase,
      innerCpi,
      label,
      snapshotOptions,
    );
    evidenceSnapshots.set(label, { before, after });
    return {
      disposition: sourceCase.disposition,
      errorCode: sourceCase.expectedErrorCode,
      logs: sourceLogs(
        identities.economyProgramId,
        sourceCase.expectedErrorCode,
        innerCpi,
      ),
      innerCpi,
      beforeStateSetSha256: sha256IatB3ProductionOfficialRehearsalValue(before),
      afterStateSetSha256: sha256IatB3ProductionOfficialRehearsalValue(after),
      terminalStateSetSha256: sha256IatB3ProductionOfficialRehearsalValue(after),
      feePayerOnlyNoEffect: !active,
    };
  };
  const makeCase = (
    sourceCase,
    purpose = sourceCase.id,
    snapshotOptions = undefined,
  ) => {
    const selectedCase = sourceCase.opcode === 6 && purpose === "ORDINAL_6"
      && openPositionVariant === "RESTORE_DELEGATE"
      ? { ...sourceCase, variant: "RESTORE_DELEGATE" } : sourceCase;
    const positionId = BigInt(`0x${sha256(Buffer.from(purpose, "utf8")).slice(0, 16)}`);
    const positionIdBytes = Buffer.alloc(8);
    positionIdBytes.writeBigUInt64LE(positionId);
    const variant = source.transactionMap.operationAccountMap
      .find(({ opcode }) => opcode === selectedCase.opcode).variants
      .find(({ variant: name }) => name === selectedCase.variant);
    const accountAddresses = {};
    for (const meta of variant.orderedMetas) {
      if (["eligibility", "position"].includes(meta.role)) continue;
      accountAddresses[meta.role] = addressFor(
        meta.role,
        selectedCase.opcode,
        selectedCase.lane,
        purpose,
        accountAddresses,
      );
    }
    if (selectedCase.opcode === 6) {
      accountAddresses.position = pda(
        identities.economyProgramId,
        "position",
        config,
        accountAddresses.owner,
        positionIdBytes,
      );
    }
    for (const meta of variant.orderedMetas) {
      if (!accountAddresses[meta.role]) {
        accountAddresses[meta.role] = addressFor(
          meta.role,
          selectedCase.opcode,
          selectedCase.lane,
          purpose,
          accountAddresses,
        );
      }
    }
    const accounts = variant.orderedMetas.map((meta) => {
      const decodedPatch = {};
      if (meta.role === "position") {
        decodedPatch.owner = selectedCase.opcode === 6
          ? accountAddresses.owner : key(`${purpose}:position-owner`);
        decodedPatch.positionId = selectedCase.opcode === 6 ? positionId.toString() : "1";
        if (selectedCase.opcode === 6) {
          decodedPatch._codec = "SYSTEM_VACANT";
          decodedPatch._lamports = purpose.includes("OPEN_POSITION_THEN") ? 1 : 0;
        } else if (selectedCase.opcode === 10) {
          Object.assign(decodedPatch, {
            principal: "100", treasuryReserved: "0", ecosystemReserved: "0",
            liquidityReserved: "0", settledMask: "0", principalReturned: false,
          });
        } else if (selectedCase.opcode === 11) {
          Object.assign(decodedPatch, {
            principal: "100", treasuryReserved: "3", ecosystemReserved: "2",
            liquidityReserved: "1", settledMask: ((1n << 52n) - 1n).toString(),
            principalReturned: true,
          });
        }
      } else if (meta.role === "eligibility") {
        decodedPatch.wallet = selectedCase.opcode === 5
          ? accountAddresses.wallet : accountAddresses.owner;
        if (selectedCase.opcode === 5) {
          const lifecycle = purpose === "ORDINAL_5"
            ? setEligibilityLifecycle : "PREFUNDED_TOP_UP";
          if (lifecycle !== "EXISTING") {
            decodedPatch._codec = "SYSTEM_VACANT";
            decodedPatch._lamports = lifecycle === "CREATE" ? 0
              : lifecycle === "PREFUNDED" ? 10 : 1;
          } else {
            decodedPatch.agencyIndex = 7;
            decodedPatch.role = 1;
          }
        }
      } else if (["treasury", "ecosystem", "liquidity", "lane_state"].includes(meta.role)) {
        const laneByRole = { treasury: 1, ecosystem: 2, liquidity: 4 };
        const laneValue = meta.role === "lane_state" ? sourceCase.lane : laneByRole[meta.role];
        decodedPatch.lane = laneValue;
        decodedPatch.tokenAccount = pda(
          identities.economyProgramId,
          "lane-token",
          config,
          Buffer.from([laneValue]),
        );
      } else if (meta.role === "owner_tokens") {
        decodedPatch.owner = accountAddresses.owner;
        decodedPatch.amount = "5000";
        if (selectedCase.variant === "RESTORE_DELEGATE") {
          decodedPatch.delegate = accountAddresses.prior_delegate;
          decodedPatch.delegatedAmount = "77";
        }
      } else if (["stake_tokens", "treasury_tokens", "ecosystem_tokens", "liquidity_tokens",
        "lane_tokens"].includes(meta.role)) {
        decodedPatch.owner = pda(identities.economyProgramId, "vault-authority", config);
        decodedPatch.amount = "1000000";
      } else if (meta.role === "destination_tokens") {
        decodedPatch.owner = accountAddresses.caller ?? key(`${purpose}:destination-owner`);
        decodedPatch.amount = "100";
      }
      return {
        role: meta.role,
        fixtureId: sharedSignerFixtureIds[meta.role] ?? fixtureFor(
          meta.role, purpose, accountAddresses[meta.role], meta.executable, decodedPatch,
        ),
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
        executable: meta.executable,
      };
    });
    const instructionDataBase64 = instruction(selectedCase.opcode, selectedCase.lane, positionId);
    const caseForExpected = { ...selectedCase, instructionDataBase64 };
    return {
      id: selectedCase.id,
      opcode: selectedCase.opcode,
      variant: selectedCase.variant,
      lane: selectedCase.lane,
      instructionDataBase64,
      accounts,
      signerRoles: variant.orderedMetas.filter(({ isSigner }) => isSigner).map(({ role }) => role),
      expected: expectedFor(caseForExpected, purpose, accountAddresses, accounts, snapshotOptions),
    };
  };
  const operationCases = source.ordinalCases.map((sourceCase) => makeCase(sourceCase));
  const opcode9ConditionalCases = source.opcode9ConditionalCases.map((sourceCase) => makeCase(sourceCase));
  const rollbackRows = source.rollbackRows.map((row) => {
    const activeSource = {
      id: `${row.id}:ACTIVE`,
      opcode: row.activeOpcode,
      operation: row.activeOperation,
      variant: row.activeVariant,
      lane: row.activeOpcode === 9 ? 1 : null,
      disposition: "ACTIVE_EXPECTED_SUCCESS",
      expectedErrorCode: null,
    };
    const activeCase = makeCase(activeSource, activeSource.id, { commitSharedState: false });
    const atomicSnapshots = exactSnapshotsFor(
      activeCase.accounts,
      { ...activeSource, disposition: "ATOMIC_ROLLBACK_EXPECTED" },
      activeCase.expected.innerCpi,
      `${row.id}:ATOMIC`,
    );
    const retrySnapshots = exactSnapshotsFor(
      activeCase.accounts,
      { ...activeSource, instructionDataBase64: activeCase.instructionDataBase64 },
      activeCase.expected.innerCpi,
      `${row.id}:STANDALONE_RETRY`,
    );
    const atomicBeforeSnapshot = atomicSnapshots.before;
    const atomicAfterSnapshot = atomicSnapshots.after;
    const retryAfterSnapshot = retrySnapshots.after;
    evidenceSnapshots.set(`${row.id}:ATOMIC`, {
      before: atomicBeforeSnapshot,
      after: atomicAfterSnapshot,
    });
    evidenceSnapshots.set(`${row.id}:STANDALONE_RETRY`, {
      before: retrySnapshots.before,
      after: retryAfterSnapshot,
    });
    const atomicBefore = sha256IatB3ProductionOfficialRehearsalValue(atomicBeforeSnapshot);
    const atomicAfter = sha256IatB3ProductionOfficialRehearsalValue(atomicAfterSnapshot);
    const retryAfter = sha256IatB3ProductionOfficialRehearsalValue(retryAfterSnapshot);
    const cpi = activeCase.expected.innerCpi;
    return {
      id: row.id,
      activeOpcode: row.activeOpcode,
      activeCase,
      forcedFailureInstructionDataBase64: instruction(12),
      atomicExpected: {
        disposition: "ATOMIC_ROLLBACK_EXPECTED",
        errorCode: 0xe50a,
        logs: [
          ...sourceLogs(identities.economyProgramId, null, cpi),
          ...sourceLogs(identities.economyProgramId, 0xe50a, [], 1),
        ],
        innerCpi: cpi,
        beforeStateSetSha256: atomicBefore,
        afterStateSetSha256: atomicAfter,
        terminalStateSetSha256: atomicAfter,
        feePayerOnlyNoEffect: true,
      },
      retryExpected: {
        disposition: "ACTIVE_EXPECTED_SUCCESS",
        errorCode: null,
        logs: sourceLogs(identities.economyProgramId, null, cpi),
        innerCpi: cpi,
        beforeStateSetSha256: atomicAfter,
        afterStateSetSha256: retryAfter,
        terminalStateSetSha256: retryAfter,
        feePayerOnlyNoEffect: false,
      },
    };
  });
  fixtureFor(
    "daily_law_state",
    "NEGATIVE_LOCAL_DOMAIN",
    identities.dailyLawState,
    false,
  );
  const negativeLawFixtureId = fixtures.find(({ purpose }) =>
    purpose === "NEGATIVE_LOCAL_DOMAIN").id;
  const positiveLawFixtureId = operationCases[12].accounts
    .find(({ role }) => role === "daily_law_state").fixtureId;
  const dualGenesisCase = (negative) => {
    const sourceCase = {
      id: negative ? "DUAL_GENESIS_LOCAL_DOMAIN_REJECTED"
        : "DUAL_GENESIS_COMPILED_DOMAIN_ACCEPTED",
      opcode: 12,
      variant: "CCC_DISABLED",
      lane: null,
      disposition: negative ? "DAILY_LAW_REJECTED_LOCAL_DOMAIN"
        : "COMPILED_DOMAIN_ACCEPTED_CCC_DISABLED",
      expectedErrorCode: negative ? 0xe503 : 0xe50a,
    };
    const accounts = [{
      role: "daily_law_state",
      fixtureId: negative ? negativeLawFixtureId : positiveLawFixtureId,
      isSigner: false,
      isWritable: false,
      executable: false,
    }];
    const instructionDataBase64 = instruction(12);
    const expected = expectedFor(
      { ...sourceCase, instructionDataBase64 },
      sourceCase.id,
      { daily_law_state: identities.dailyLawState },
      accounts,
      { commitSharedState: false, freshSharedBaseline: true },
    );
    return {
      id: sourceCase.id,
      opcode: sourceCase.opcode,
      variant: sourceCase.variant,
      lane: sourceCase.lane,
      instructionDataBase64,
      accounts,
      signerRoles: [],
      expected,
    };
  };
  const dualGenesisCases = {
    negativeLocalDomain: dualGenesisCase(true),
    positiveCompiledDomain: dualGenesisCase(false),
  };
  const artifact = (fileName, bytes) => ({
    fileName,
    bytesBase64: bytes.toString("base64"),
    byteLength: bytes.length,
    sha256: sha256(bytes),
  });
  const receipt = (schema, artifactValue, economy = false) => ({
    schema,
    source: { declaredHeadSha: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_CHECKPOINT },
    identityBinding: {
      manifestSha256: identities.identityManifestSha256,
      environmentBindingSha256: economy
        ? identities.environmentBindingSha256
        : sha256IatB3ProductionOfficialRehearsalValue(lawBuildEnvironment),
      ...(economy ? { ownerPolicySha256: identities.ownerPolicySha256 } : {}),
    },
    artifact: {
      fileName: artifactValue.fileName,
      byteLength: artifactValue.byteLength,
      sha256: artifactValue.sha256,
      identicalBytes: true,
      preservedArtifactSha256: artifactValue.sha256,
      preservedArtifactByteLength: artifactValue.byteLength,
    },
  });
  const lawArtifact = artifact("iat_b3_law.so", lawElf);
  const economyArtifact = artifact("iat_b3_economy.so", economyElf);
  return {
    input: {
      schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_FIXTURE_INPUT_SCHEMA,
      sourceContractSha256: source.sourceContractSha256,
      declaredHeadSha: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_CHECKPOINT,
      authorityEvidenceSha256: source.authorityEvidence.sha256,
      identities,
      identityManifestBytesBase64: identityManifestBytes.toString("base64"),
      buildEnvironment,
      genesisDomains: {
        validatorGenesisHash: key("validator-genesis"),
        compiledLawDomainGenesisHash: identities.compiledLawDomainGenesisHash,
        negativeLocalDomainGenesisHash: key("validator-genesis"),
        validatorClaimedAsMainnet: false,
        negativeExpectedEconomyErrorCode: 0xe503,
        positiveExpectedDailyLawAcceptance: true,
      },
      buildReceipts: {
        law: receipt(COMBINED_LAW_BUILD_RECEIPT_SCHEMA, lawArtifact),
        economy: receipt(ECONOMY_BUILD_RECEIPT_SCHEMA, economyArtifact, true),
      },
      artifacts: { law: lawArtifact, economy: economyArtifact },
      deployments: {
        law: lawDeployment,
        economy: economyDeployment,
      },
      fixtures,
      signerPlan: {
        feePayerPubkey: signerKeys.admin,
        roles: [
          { role: "admin", pubkey: signerKeys.admin },
          { role: "owner", pubkey: signerKeys.owner },
          { role: "caller", pubkey: signerKeys.caller },
        ],
        keyReadAllowed: false,
        keyGenerationAllowed: false,
        loadPhase: "AFTER_GENESIS_PROGRAM_PROGRAMDATA_AND_ALL_FIXTURES_REOBSERVED",
      },
      dualGenesisCases,
      operationCases,
      opcode9ConditionalCases,
      rollbackRows,
      executionOrder: source.executionOrder,
    },
    dependencies: {
      validateLawReceipt: () => true,
      validateEconomyReceipt: () => true,
      decodeFixture: ({ codec, pubkey, dataBase64 }) =>
        decodedByData.get(`${codec}:${pubkey}:${dataBase64}`)
        ?? decodeIatB3ProductionFixtureState({
          codec,
          pubkey,
          owner: fixtures.find((fixture) => fixture.pubkey === pubkey)?.owner
            ?? SystemProgram.programId.toBase58(),
          dataBase64,
        }),
    },
    evidenceSnapshots,
  };
}

test("source contract binds the exact 15+6+5 map, dual receipt schemas, and 17-stage HOLD", () => {
  const contract = buildIatB3ProductionOfficialRehearsalSourceContract();
  assert.equal(contract.checkpointHeadSha, IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_CHECKPOINT);
  assert.equal(contract.ordinalCases.length, 15);
  assert.equal(contract.opcode9ConditionalCases.length, 6);
  assert.deepEqual(contract.rollbackRows.map(({ activeOpcode }) => activeOpcode), [5, 6, 7, 9, 10]);
  assert.equal(contract.authorityEvidence.journalStageCount, 17);
  assert.equal(contract.authorityEvidence.activationStatus, "PENDING");
  assert.equal(contract.safety.officialCompleteAccepted, false);
  assert.equal(contract.safety.mainnetStatus, "HOLD");
});

test("nested fixture-pack and receipt truth/blockers are exact immutable HOLD contracts", () => {
  const synthetic = buildSyntheticFixtureInput();
  const packed = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  for (const mutate of [
    (value) => { value.truth.executionObserved = true; },
    (value) => { value.truth.unrecognizedClaim = false; },
    (value) => { value.blockers.pop(); },
    (value) => { value.blockers.reverse(); },
  ]) {
    const forged = structuredClone(packed);
    mutate(forged);
    rehashPack(forged);
    assert.throws(
      () => validateIatB3ProductionOfficialLocalRehearsalFixturePack(forged),
      /FIXTURE_PACK/u,
    );
  }
  const { receipt } = buildFullSyntheticReceipt();
  for (const mutate of [
    (value) => { value.truth.operationSpecificCodecStateTransitionsValidated = false; },
    (value) => { value.truth.unrecognizedClaim = true; },
    (value) => { value.blockers.shift(); },
  ]) {
    const forged = structuredClone(receipt);
    mutate(forged);
    rehashReceipt(forged);
    assert.throws(
      () => validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(forged),
      /EXECUTION_RECEIPT/u,
    );
  }
});

test("exact manifest bytes, four-field environment, distinct signer roles, and fee payer role bind", () => {
  for (const mutate of [
    (input) => {
      input.buildEnvironment.IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH = key("wrong-genesis");
    },
    (input) => {
      const manifest = JSON.parse(Buffer.from(input.identityManifestBytesBase64, "base64"));
      manifest.identities.lawProgramId = key("wrong-manifest-law");
      input.identityManifestBytesBase64 = Buffer.from(JSON.stringify(manifest)).toString("base64");
    },
    (input) => { input.signerPlan.roles[1].pubkey = input.signerPlan.roles[0].pubkey; },
    (input) => {
      const walletBinding = input.operationCases[5].accounts.find(({ role }) => role === "wallet");
      input.signerPlan.feePayerPubkey = input.fixtures
        .find(({ id }) => id === walletBinding.fixtureId).pubkey;
    },
  ]) {
    const synthetic = buildSyntheticFixtureInput();
    mutate(synthetic.input);
    assert.throws(
      () => packIatB3ProductionOfficialLocalRehearsalFixtures(
        synthetic.input,
        synthetic.dependencies,
      ),
      /INVALID_IAT_B3_OFFICIAL_LOCAL_REHEARSAL/u,
    );
  }
});

test("source-derived CPI envelopes require Open approval and all SetEligibility lifecycles", () => {
  for (const [lifecycle, expectedSystemDiscriminants] of [
    ["CREATE", [0]],
    ["EXISTING", []],
    ["PREFUNDED", [8, 1]],
    ["PREFUNDED_TOP_UP", [2, 8, 1]],
  ]) {
    const { pack, receipt } = buildFullSyntheticReceipt({ setEligibilityLifecycle: lifecycle });
    assert.deepEqual(pack.operationCases[5].expected.innerCpi.map((entry) =>
      Buffer.from(entry.dataBase64, "base64").readUInt32LE(0)), expectedSystemDiscriminants);
    assert.equal(receipt.status, "HOLD_TEST_EVIDENCE_ONLY");
  }
  const restored = buildFullSyntheticReceipt({ openPositionVariant: "RESTORE_DELEGATE" });
  const restoredOpen = restored.pack.operationCases[6];
  assert.equal(restoredOpen.variant, "RESTORE_DELEGATE");
  assert.equal(restoredOpen.accountBindings.length, 18);
  assert.deepEqual(
    restoredOpen.expected.innerCpi
      .filter(({ programId }) => programId === tokenProgram)
      .map(({ dataBase64 }) => Buffer.from(dataBase64, "base64")[0]),
    [13, 12, 13],
  );
  const synthetic = buildSyntheticFixtureInput();
  synthetic.input.operationCases[6].expected.innerCpi.shift();
  assert.throws(
    () => packIatB3ProductionOfficialLocalRehearsalFixtures(
      synthetic.input,
      synthetic.dependencies,
    ),
    /(?:CASE_LOG_ENVELOPE|TOKEN_APPROVE_CHECKED_CPI|OPEN_POSITION)/u,
  );
  const unknownBoundary = buildSyntheticFixtureInput();
  unknownBoundary.input.operationCases[5].expected.logs.splice(
    1,
    0,
    `Program ${key("unrecognized-program-boundary")} invoke [2]`,
    `Program ${key("unrecognized-program-boundary")} success`,
  );
  assert.throws(
    () => packIatB3ProductionOfficialLocalRehearsalFixtures(
      unknownBoundary.input,
      unknownBoundary.dependencies,
    ),
    /CASE_LOG_ENVELOPE/u,
  );
});

test("injected fixture seam can pack structural fixtures but remains TEST HOLD", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  assert.equal(pack.status, IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_TEST_STATUS);
  assert.equal(pack.operationCases.length, 15);
  assert.equal(pack.opcode9ConditionalCases.length, 6);
  assert.deepEqual(pack.rollbackRows.map(({ activeOpcode }) => activeOpcode), [5, 6, 7, 9, 10]);
  assert.equal(pack.truth.officialComplete, false);
  assert.equal(pack.truth.activationAuthorized, false);
  assert.equal(pack.truth.signerKeysRead, false);
});

test("serialized TEST provenance cannot be rehashed or relabeled as source validated", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  assert.equal(validateIatB3ProductionOfficialLocalRehearsalFixturePack(pack), pack);
  const laundered = structuredClone(pack);
  laundered.status = "HOLD_SOURCE_ONLY";
  laundered.provenance.kind = "DEFAULT_SOURCE_VALIDATED";
  laundered.provenance.injectedDependencyNames = [];
  delete laundered.fixturePackSha256;
  laundered.fixturePackSha256 = sha256IatB3ProductionOfficialRehearsalValue(laundered);
  assert.throws(
    () => validateIatB3ProductionOfficialLocalRehearsalFixturePack(laundered),
    /INVALID_IAT_B3_(?:COMBINED_LAW|OFFICIAL_LOCAL_REHEARSAL)/u,
  );
  const relabeledOnly = structuredClone(pack);
  relabeledOnly.status = "HOLD_SOURCE_ONLY";
  delete relabeledOnly.fixturePackSha256;
  relabeledOnly.fixturePackSha256 = sha256IatB3ProductionOfficialRehearsalValue(relabeledOnly);
  assert.throws(
    () => validateIatB3ProductionOfficialLocalRehearsalFixturePack(relabeledOnly),
    /FIXTURE_PACK_PROVENANCE_STATUS/u,
  );
});

test("fixture pack rejects substituted ProgramData ELF and compiled/local genesis collapse", () => {
  const synthetic = buildSyntheticFixtureInput();
  const elfMutation = structuredClone(synthetic.input);
  const bytes = Buffer.from(elfMutation.deployments.economy.programData.dataBase64, "base64");
  bytes[bytes.length - 1] ^= 1;
  elfMutation.deployments.economy.programData.dataBase64 = bytes.toString("base64");
  assert.throws(
    () => packIatB3ProductionOfficialLocalRehearsalFixtures(elfMutation, synthetic.dependencies),
    /PROGRAMDATA_CODEC_OR_ELF/u,
  );
  const genesisMutation = structuredClone(synthetic.input);
  genesisMutation.genesisDomains.validatorGenesisHash =
    genesisMutation.genesisDomains.compiledLawDomainGenesisHash;
  genesisMutation.genesisDomains.negativeLocalDomainGenesisHash =
    genesisMutation.genesisDomains.compiledLawDomainGenesisHash;
  assert.throws(
    () => packIatB3ProductionOfficialLocalRehearsalFixtures(genesisMutation, synthetic.dependencies),
    /GENESIS_DOMAIN_SEPARATION/u,
  );
});

test("default source codec binds positive and negative Law-state domain bytes before signer phase", () => {
  const synthetic = buildSyntheticFixtureInput();
  const { identities, genesisDomains } = synthetic.input;
  const sourceContract = buildIatB3ProductionOfficialRehearsalSourceContract();
  const lawFixture = (purpose, domain) => {
    const bytes = Buffer.alloc(160);
    bytes.write("IATB3S01", 0, "ascii");
    bytes[8] = 1;
    bytes[9] = 1;
    bytes[10] = 1;
    new PublicKey(identities.canonicalMint).toBuffer().copy(bytes, 16);
    new PublicKey(domain).toBuffer().copy(bytes, 48);
    bytes.writeBigInt64LE(1n, 80);
    bytes.writeBigUInt64LE(100n, 88);
    Buffer.from("11".repeat(32), "hex").copy(bytes, 96);
    bytes.writeBigUInt64LE(1n, 128);
    bytes.writeUInt16LE(1, 138);
    bytes.writeUInt16LE(20, 140);
    const decodedState = {
      codec: "LAW_STATE_V1",
      bump: 1,
      mint: identities.canonicalMint,
      compiledLawDomainGenesisHash: domain,
      decision: {
        locked: false,
        localDay: "1",
        entropySlot: "100",
        ancestorSlotHash: "11".repeat(32),
        drawCounter: "1",
        drawBucket: 0,
        chanceNumerator: 1,
        chanceDenominator: 20,
      },
    };
    return {
      id: `law:${purpose}`,
      purpose,
      role: "daily_law_state",
      codec: "LAW_STATE_V1",
      pubkey: identities.dailyLawState,
      owner: identities.lawProgramId,
      executable: false,
      lamports: 1,
      rentEpoch: 0,
      dataBase64: bytes.toString("base64"),
      dataSha256: sha256(bytes),
      decodedState,
      decodedStateSha256: sha256IatB3ProductionOfficialRehearsalValue(decodedState),
      pda: null,
    };
  };
  assert.equal(validateAndPackIatB3ProductionConcreteFixture(
    lawFixture("POSITIVE_COMPILED_DOMAIN", identities.compiledLawDomainGenesisHash),
    { sourceContract, identities, genesisDomains },
  ).dataLength, 160);
  assert.equal(validateAndPackIatB3ProductionConcreteFixture(
    lawFixture("NEGATIVE_LOCAL_DOMAIN", genesisDomains.validatorGenesisHash),
    { sourceContract, identities, genesisDomains },
  ).dataLength, 160);
  assert.throws(() => validateAndPackIatB3ProductionConcreteFixture(
    lawFixture("POSITIVE_COMPILED_DOMAIN", genesisDomains.validatorGenesisHash),
    { sourceContract, identities, genesisDomains },
  ), /LAW_FIXTURE_DOMAIN_OR_OPEN_DECISION/u);
});

test("fixture pack rejects ABI, account-order, PDA, signer, and mutable-purpose drift", () => {
  for (const mutate of [
    (input) => { input.operationCases[5].instructionDataBase64 = instruction(6); },
    (input) => {
      const bytes = Buffer.from(input.operationCases[5].instructionDataBase64, "base64");
      bytes[31] = 1;
      input.operationCases[5].instructionDataBase64 = bytes.toString("base64");
    },
    (input) => { [input.operationCases[5].accounts[1], input.operationCases[5].accounts[2]] =
      [input.operationCases[5].accounts[2], input.operationCases[5].accounts[1]]; },
    (input) => {
      const configAccount = input.operationCases[6].accounts.find(({ role }) => role === "config");
      input.fixtures.find(({ id }) => id === configAccount.fixtureId).pubkey = key("wrong-config");
    },
    (input) => { input.signerPlan.roles[0].pubkey = key("wrong-admin"); },
    (input) => {
      const fixtureId = input.operationCases[5].accounts
        .find(({ isWritable, isSigner }) => isWritable && !isSigner)
        .fixtureId;
      input.fixtures.find(({ id }) => id === fixtureId).purpose = "WRONG_LEDGER_NAMESPACE";
    },
    (input) => {
      const first = input.operationCases[5].accounts
        .find(({ isWritable, isSigner }) => isWritable && !isSigner).fixtureId;
      input.operationCases[6].accounts
        .find(({ isWritable, isSigner }) => isWritable && !isSigner).fixtureId = first;
    },
    (input) => {
      const first = input.operationCases[7].accounts
        .find(({ role }) => role === "destination_tokens").fixtureId;
      input.operationCases[9].accounts
        .find(({ role }) => role === "destination_tokens").fixtureId = first;
    },
    (input) => { input.operationCases[6].expected.logs.splice(1, 1); },
    (input) => { input.operationCases[6].expected.innerCpi[0].accounts.reverse(); },
    (input) => {
      const data = Buffer.from(input.operationCases[6].expected.innerCpi[1].dataBase64, "base64");
      data[0] ^= 1;
      input.operationCases[6].expected.innerCpi[1].dataBase64 = data.toString("base64");
    },
  ]) {
    const synthetic = buildSyntheticFixtureInput();
    mutate(synthetic.input);
    assert.throws(
      () => packIatB3ProductionOfficialLocalRehearsalFixtures(
        synthetic.input,
        synthetic.dependencies,
      ),
      /INVALID_IAT_B3_OFFICIAL_LOCAL_REHEARSAL/u,
    );
  }
});

test("serialized shared-infrastructure exception is source-derived and not caller extensible", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  assert.ok(pack.sharedInfrastructure.length > 0);
  assert.ok(pack.sharedInfrastructure.every((entry) =>
    ["SERIALIZED_WRITABLE_CHAIN", "READONLY_BYTE_IDENTICAL"].includes(entry.access)));
  assert.ok(pack.sharedInfrastructure.some((entry) =>
    entry.kinds.includes("R06_OWNER_DERIVED_ELIGIBILITY_PDA")));
  const forged = structuredClone(pack);
  forged.sharedInfrastructure.push({
    pubkey: key("caller-authored-shared-account"),
    roles: ["position"],
    kinds: ["CALLER_ALLOWLIST"],
    access: "SERIALIZED_WRITABLE_CHAIN",
  });
  delete forged.fixturePackSha256;
  forged.fixturePackSha256 = sha256IatB3ProductionOfficialRehearsalValue(forged);
  assert.throws(
    () => validateIatB3ProductionOfficialLocalRehearsalFixturePack(forged),
    /FIXTURE_PACK_SHARED_INFRASTRUCTURE/u,
  );
});

function transactionInstruction(caseValue, economyProgramId) {
  return {
    programId: new PublicKey(economyProgramId),
    keys: caseValue.accountBindings.map((binding) => ({
      pubkey: new PublicKey(binding.pubkey),
      isSigner: binding.isSigner,
      isWritable: binding.isWritable,
    })),
    data: Buffer.from(caseValue.instructionDataBase64, "base64"),
  };
}

function observationFor({ pack, id, expected, instructionCases, snapshots }) {
  const transaction = new Transaction({
    feePayer: signerKeypairs.admin.publicKey,
    recentBlockhash: key(`blockhash:${id}`),
  });
  for (const caseValue of instructionCases) {
    transaction.add(transactionInstruction(caseValue, pack.identities.economyProgramId));
  }
  const keypairs = new Map([[signerKeypairs.admin.publicKey.toBase58(), signerKeypairs.admin]]);
  for (const caseValue of instructionCases) {
    for (const binding of caseValue.accountBindings.filter(({ isSigner }) => isSigner)) {
      const pair = Object.values(signerKeypairs)
        .find(({ publicKey }) => publicKey.toBase58() === binding.pubkey);
      assert.ok(pair, `missing signer ${binding.pubkey}`);
      keypairs.set(binding.pubkey, pair);
    }
  }
  transaction.sign(...keypairs.values());
  const message = transaction.serializeMessage();
  const serialized = transaction.serialize();
  const signature = transaction.signatures[0].signature;
  const accountKeys = transaction.compileMessage().accountKeys.map((value) => value.toBase58());
  const beforeByKey = new Map(snapshots.before.map((account) => [account.pubkey, account]));
  const afterByKey = new Map(snapshots.after.map((account) => [account.pubkey, account]));
  const programBindingsSha256 = sha256IatB3ProductionOfficialRehearsalValue({
    deployments: pack.deployments,
    artifacts: pack.artifactBindings,
    identities: pack.identities,
    identityEvidence: pack.identityEvidence,
    genesisDomains: pack.genesisDomains,
  });
  const sharedInfrastructure = new Map(
    pack.sharedInfrastructure.map((entry) => [entry.pubkey, entry]),
  );
  const observation = {
    id,
    outcome: expected.disposition,
    errorCode: expected.errorCode,
    submittedSignatureBase64: signature.toString("base64"),
    landedSignatureBase64: signature.toString("base64"),
    submittedSignatureSha256: sha256(signature),
    landedSignatureSha256: sha256(signature),
    submittedMessageBase64: message.toString("base64"),
    landedMessageBase64: message.toString("base64"),
    submittedTransactionBase64: serialized.toString("base64"),
    landedTransactionBase64: serialized.toString("base64"),
    submittedMessageSha256: sha256(message),
    landedMessageSha256: sha256(message),
    submittedTransactionSha256: sha256(serialized),
    landedTransactionSha256: sha256(serialized),
    logs: expected.logs,
    innerCpi: expected.innerCpi,
    beforeSnapshot: structuredClone(snapshots.before),
    afterSnapshot: structuredClone(snapshots.after),
    landedMeta: {
      feeLamports: 5,
      accountKeys,
      preBalances: accountKeys.map((value) => beforeByKey.get(value).lamports),
      postBalances: accountKeys.map((value) => afterByKey.get(value).lamports),
      logMessages: expected.logs,
      innerCpi: expected.innerCpi,
    },
    terminalStateSetSha256: expected.terminalStateSetSha256,
    transactionConfirmed: true,
    programBindingsSha256,
    fixtureBindingsSha256: pack.fixturesSha256,
  };
  return {
    observation,
    expected: { id, ...expected },
    context: {
      feePayerPubkey: pack.signerPlan.feePayerPubkey,
      identities: pack.identities,
      economyProgramId: pack.identities.economyProgramId,
      economyProgramAccount: pack.productionEvidence.deployments.economy.program,
      fixtures: pack.fixtures,
      instructionCases,
      sharedInfrastructure,
      sharedState: new Map(snapshots.before
        .filter(({ pubkey }) => sharedInfrastructure.has(pubkey))
        .map((account) => [account.pubkey, structuredClone(account)])),
      programBindingsSha256,
      fixtureBindingsSha256: pack.fixturesSha256,
    },
  };
}

function buildFullSyntheticReceipt(options = {}) {
  const synthetic = buildSyntheticFixtureInput(options);
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  const makeObservation = (id, expected, instructionCases) => {
    const snapshots = synthetic.evidenceSnapshots.get(id);
    assert.ok(snapshots, `missing snapshot ${id}`);
    return observationFor({ pack, id, expected, instructionCases, snapshots }).observation;
  };
  const receipt = createIatB3ProductionOfficialLocalRehearsalExecutionReceipt({
    schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_INPUT_SCHEMA,
    fixturePack: pack,
    validatorGenesisHash: pack.genesisDomains.validatorGenesisHash,
    compiledLawDomainGenesisHash: pack.genesisDomains.compiledLawDomainGenesisHash,
    negativeDomainObservation: makeObservation(
      pack.dualGenesisCases.negativeLocalDomain.id,
      pack.dualGenesisCases.negativeLocalDomain.expected,
      [pack.dualGenesisCases.negativeLocalDomain],
    ),
    positiveDomainObservation: makeObservation(
      pack.dualGenesisCases.positiveCompiledDomain.id,
      pack.dualGenesisCases.positiveCompiledDomain.expected,
      [pack.dualGenesisCases.positiveCompiledDomain],
    ),
    operationObservations: pack.operationCases.map((caseValue) =>
      makeObservation(caseValue.id, caseValue.expected, [caseValue])),
    opcode9ConditionalObservations: pack.opcode9ConditionalCases.map((caseValue) =>
      makeObservation(caseValue.id, caseValue.expected, [caseValue])),
    rollbackObservations: pack.rollbackRows.map((row) => ({
      id: row.id,
      atomic: makeObservation(`${row.id}:ATOMIC`, row.atomicExpected, [
        row.activeCase,
        {
          instructionDataBase64: row.forcedFailureInstructionDataBase64,
          accountBindings: [row.activeCase.accountBindings
            .find(({ role }) => role === "daily_law_state")],
        },
      ]),
      standaloneRetry: makeObservation(
        `${row.id}:STANDALONE_RETRY`,
        row.retryExpected,
        [row.activeCase],
      ),
    })),
  });
  return { synthetic, pack, receipt };
}

function rehashPack(pack) {
  delete pack.fixturePackSha256;
  pack.fixturePackSha256 = sha256IatB3ProductionOfficialRehearsalValue(pack);
}

function rehashReceipt(receipt) {
  receipt.fixturePackSha256 = receipt.fixturePack.fixturePackSha256;
  delete receipt.receiptSha256;
  receipt.receiptSha256 = sha256IatB3ProductionOfficialRehearsalValue(receipt);
}

test("transaction observation cryptographically binds wire, instruction metas, landed meta, and snapshots", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  const caseValue = pack.operationCases[5];
  const build = () => observationFor({
    pack,
    id: caseValue.id,
    expected: caseValue.expected,
    instructionCases: [caseValue],
    snapshots: synthetic.evidenceSnapshots.get(caseValue.id),
  });
  const valid = build();
  assert.equal(validateIatB3ProductionOfficialTransactionObservation(
    valid.observation,
    valid.expected,
    valid.context,
  ), valid.observation);
  for (const mutate of [
    (value) => { value.observation.landedSignatureBase64 = Buffer.alloc(64).toString("base64"); },
    (value) => { value.observation.landedMessageBase64 = Buffer.from("substitution").toString("base64"); },
    (value) => { value.observation.landedTransactionBase64 = Buffer.from("substitution").toString("base64"); },
    (value) => { value.observation.logs = []; },
    (value) => { value.observation.innerCpi = []; },
    (value) => { value.observation.beforeSnapshot.pop(); },
    (value) => { value.observation.landedMeta.feeLamports += 1; },
    (value) => {
      const bytes = Buffer.from(value.observation.submittedTransactionBase64, "base64");
      bytes[1] ^= 1;
      const signature = bytes.subarray(1, 65);
      for (const prefix of ["submitted", "landed"]) {
        value.observation[`${prefix}TransactionBase64`] = bytes.toString("base64");
        value.observation[`${prefix}TransactionSha256`] = sha256(bytes);
        value.observation[`${prefix}SignatureBase64`] = signature.toString("base64");
        value.observation[`${prefix}SignatureSha256`] = sha256(signature);
      }
    },
  ]) {
    const value = build();
    mutate(value);
    assert.throws(() => validateIatB3ProductionOfficialTransactionObservation(
      value.observation,
      value.expected,
      value.context,
    ), /INVALID_IAT_B3_OFFICIAL_LOCAL_REHEARSAL/u);
  }
  for (const mutateCase of [
    (value) => {
      const bytes = Buffer.from(value.instructionDataBase64, "base64");
      bytes[16] ^= 1;
      value.instructionDataBase64 = bytes.toString("base64");
    },
    (value) => { [value.accountBindings[2], value.accountBindings[3]] =
      [value.accountBindings[3], value.accountBindings[2]]; },
  ]) {
    const wireCase = structuredClone(caseValue);
    mutateCase(wireCase);
    const substituted = observationFor({
      pack,
      id: caseValue.id,
      expected: caseValue.expected,
      instructionCases: [wireCase],
      snapshots: synthetic.evidenceSnapshots.get(caseValue.id),
    });
    substituted.context.instructionCases = [caseValue];
    assert.throws(() => validateIatB3ProductionOfficialTransactionObservation(
      substituted.observation,
      substituted.expected,
      substituted.context,
    ), /TRANSACTION_INSTRUCTION_META_BINDING/u);
  }
});

test("every active handler after-state is decoded and operation semantics reject rehashed drift", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  const mutationByOpcode = new Map([
    [5, ["eligibility", "ECONOMY_ELIGIBILITY_V1", (state) => { state.role = 1; }]],
    [6, ["position", "ECONOMY_POSITION_V1", (state) => { state.paid = "1"; }]],
    [7, ["position", "ECONOMY_POSITION_V1", (state) => {
      state.paid = (BigInt(state.paid) + 1n).toString();
    }]],
    [9, ["lane_state", "ECONOMY_LANE_V1", (state) => {
      state.principalClaimed = (BigInt(state.principalClaimed) + 1n).toString();
    }]],
    [10, ["position", "ECONOMY_POSITION_V1", (state) => { state.closed = true; }]],
    [11, ["position", "ECONOMY_POSITION_V1", (state) => {
      state.paid = (BigInt(state.paid) + 1n).toString();
    }]],
  ]);
  for (const caseValue of pack.operationCases.filter(({ opcode }) => mutationByOpcode.has(opcode))) {
    const built = observationFor({
      pack,
      id: caseValue.id,
      expected: caseValue.expected,
      instructionCases: [caseValue],
      snapshots: synthetic.evidenceSnapshots.get(caseValue.id),
    });
    const [role, codec, mutate] = mutationByOpcode.get(caseValue.opcode);
    const binding = caseValue.accountBindings.find((entry) => entry.role === role);
    const account = built.observation.afterSnapshot.find(({ pubkey }) => pubkey === binding.pubkey);
    const state = decodeIatB3ProductionFixtureState({
      codec,
      pubkey: account.pubkey,
      owner: account.owner,
      dataBase64: account.dataBase64,
    });
    mutate(state);
    account.dataBase64 = encodeCodecState(codec, state).toString("base64");
    const afterHash = sha256IatB3ProductionOfficialRehearsalValue(
      canonicalIatB3ProductionAccountSnapshot(built.observation.afterSnapshot),
    );
    built.expected.afterStateSetSha256 = afterHash;
    built.expected.terminalStateSetSha256 = afterHash;
    built.observation.terminalStateSetSha256 = afterHash;
    assert.throws(
      () => validateIatB3ProductionOfficialTransactionObservation(
        built.observation,
        built.expected,
        built.context,
      ),
      /(?:STATE_TRANSITION|TOKEN_DELTA|CONSERVATION|REWARD|RESERVATION)/u,
      `opcode ${caseValue.opcode} semantic drift must fail`,
    );
  }
});

test("shared readonly drift and rollback business-byte drift cannot be hidden by rehashing", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  const activeCase = pack.operationCases[5];
  const readonly = observationFor({
    pack,
    id: activeCase.id,
    expected: activeCase.expected,
    instructionCases: [activeCase],
    snapshots: synthetic.evidenceSnapshots.get(activeCase.id),
  });
  const lawAfter = readonly.observation.afterSnapshot
    .find(({ pubkey }) => pubkey === pack.identities.dailyLawState);
  lawAfter.dataBase64 = Buffer.from("forged readonly drift", "utf8").toString("base64");
  const readonlyAfterHash = sha256IatB3ProductionOfficialRehearsalValue(
    canonicalIatB3ProductionAccountSnapshot(readonly.observation.afterSnapshot),
  );
  readonly.expected.afterStateSetSha256 = readonlyAfterHash;
  readonly.expected.terminalStateSetSha256 = readonlyAfterHash;
  readonly.observation.terminalStateSetSha256 = readonlyAfterHash;
  assert.throws(() => validateIatB3ProductionOfficialTransactionObservation(
    readonly.observation,
    readonly.expected,
    readonly.context,
  ), /READONLY_ACCOUNT_CHANGED/u);

  const row = pack.rollbackRows[0];
  const law = row.activeCase.accountBindings.find(({ role }) => role === "daily_law_state");
  const atomic = observationFor({
    pack,
    id: `${row.id}:ATOMIC`,
    expected: row.atomicExpected,
    instructionCases: [
      row.activeCase,
      { instructionDataBase64: row.forcedFailureInstructionDataBase64, accountBindings: [law] },
    ],
    snapshots: synthetic.evidenceSnapshots.get(`${row.id}:ATOMIC`),
  });
  const feePayer = pack.signerPlan.feePayerPubkey;
  const businessAfter = atomic.observation.afterSnapshot.find(({ pubkey }) =>
    pubkey !== feePayer && row.mutableFixtureIds.some((fixtureId) =>
      pack.fixtures.find(({ id }) => id === fixtureId)?.pubkey === pubkey));
  assert.ok(businessAfter);
  businessAfter.dataBase64 = Buffer.from("forged atomic business effect", "utf8").toString("base64");
  const atomicAfterHash = sha256IatB3ProductionOfficialRehearsalValue(
    canonicalIatB3ProductionAccountSnapshot(atomic.observation.afterSnapshot),
  );
  atomic.expected.afterStateSetSha256 = atomicAfterHash;
  atomic.expected.terminalStateSetSha256 = atomicAfterHash;
  atomic.observation.terminalStateSetSha256 = atomicAfterHash;
  assert.throws(() => validateIatB3ProductionOfficialTransactionObservation(
    atomic.observation,
    atomic.expected,
    atomic.context,
  ), /STATE_EFFECT_CLASS/u);
});

test("mutable fixture validator rejects aliases and accepts exact disjoint terminal chains", () => {
  const rows = ["A", "B"].map((id) => ({
    id,
    ledgerNamespace: `ledger:${id}`,
    mutableFixtureIds: [`${id}:fixture`],
    mutablePubkeys: [key(`${id}:mutable`)],
    beforeStateSetSha256: hashLabel(`${id}:before`),
    terminalStateSetSha256: hashLabel(`${id}:terminal`),
  }));
  assert.equal(validateIatB3ProductionMutableFixtureIsolation(rows), rows);
  rows[1].mutableFixtureIds = rows[0].mutableFixtureIds;
  assert.throws(
    () => validateIatB3ProductionMutableFixtureIsolation(rows),
    /MUTABLE_FIXTURE_ALIAS/u,
  );
  rows[1].mutableFixtureIds = ["B:fixture"];
  rows[1].mutablePubkeys = rows[0].mutablePubkeys;
  assert.throws(
    () => validateIatB3ProductionMutableFixtureIsolation(rows),
    /MUTABLE_PUBKEY_CROSS_PURPOSE_ALIAS/u,
  );
});

test("OFFICIAL_COMPLETE and self-digested fabricated promotion remain categorically rejected", () => {
  const fabricatedCore = {
    schema: "iat-b3-production-official-local-rehearsal-execution-receipt/v1",
    status: "OFFICIAL_COMPLETE",
    complete: true,
    evidenceAccepted: true,
    truth: { officialComplete: true, activationAuthorized: true, mainnetStatus: "GO" },
  };
  const fabricated = {
    ...fabricatedCore,
    receiptSha256: sha256IatB3ProductionOfficialRehearsalValue(fabricatedCore),
  };
  assert.throws(
    () => validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(fabricated),
    /EXECUTION_RECEIPT/u,
  );
  const minimalHoldCore = {
    schema: "iat-b3-production-official-local-rehearsal-execution-receipt/v1",
    status: "HOLD_SOURCE_ONLY_EVIDENCE_UNACCEPTED",
    complete: false,
    evidenceAccepted: false,
    truth: { officialComplete: false, activationAuthorized: false, mainnetStatus: "HOLD" },
  };
  const minimalHold = {
    ...minimalHoldCore,
    receiptSha256: sha256IatB3ProductionOfficialRehearsalValue(minimalHoldCore),
  };
  assert.throws(
    () => validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(minimalHold),
    /EXECUTION_RECEIPT/u,
  );
});

test("execution receipt constructor cannot use missing/fabricated observations as promotion evidence", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  const domainObservation = (caseValue) => observationFor({
    pack,
    id: caseValue.id,
    expected: caseValue.expected,
    instructionCases: [caseValue],
    snapshots: synthetic.evidenceSnapshots.get(caseValue.id),
  }).observation;
  assert.throws(() => createIatB3ProductionOfficialLocalRehearsalExecutionReceipt({
    schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_INPUT_SCHEMA,
    fixturePack: pack,
    validatorGenesisHash: pack.genesisDomains.validatorGenesisHash,
    compiledLawDomainGenesisHash: pack.genesisDomains.compiledLawDomainGenesisHash,
    negativeDomainObservation: domainObservation(pack.dualGenesisCases.negativeLocalDomain),
    positiveDomainObservation: domainObservation(pack.dualGenesisCases.positiveCompiledDomain),
    operationObservations: [],
    opcode9ConditionalObservations: [],
    rollbackObservations: [],
  }), /EXECUTION_ORDER_CHAIN/u);
});

test("all 15, six opcode9 variants, and five cryptographic rollback+retry observations stay HOLD", () => {
  const synthetic = buildSyntheticFixtureInput();
  const pack = packIatB3ProductionOfficialLocalRehearsalFixtures(
    synthetic.input,
    synthetic.dependencies,
  );
  const makeObservation = (id, expected, instructionCases) => {
    const snapshots = synthetic.evidenceSnapshots.get(id);
    assert.ok(snapshots, `missing snapshot ${id}`);
    return observationFor({ pack, id, expected, instructionCases, snapshots }).observation;
  };
  const receipt = createIatB3ProductionOfficialLocalRehearsalExecutionReceipt({
    schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_INPUT_SCHEMA,
    fixturePack: pack,
    validatorGenesisHash: pack.genesisDomains.validatorGenesisHash,
    compiledLawDomainGenesisHash: pack.genesisDomains.compiledLawDomainGenesisHash,
    negativeDomainObservation: makeObservation(
      pack.dualGenesisCases.negativeLocalDomain.id,
      pack.dualGenesisCases.negativeLocalDomain.expected,
      [pack.dualGenesisCases.negativeLocalDomain],
    ),
    positiveDomainObservation: makeObservation(
      pack.dualGenesisCases.positiveCompiledDomain.id,
      pack.dualGenesisCases.positiveCompiledDomain.expected,
      [pack.dualGenesisCases.positiveCompiledDomain],
    ),
    operationObservations: pack.operationCases.map((caseValue) =>
      makeObservation(caseValue.id, caseValue.expected, [caseValue])),
    opcode9ConditionalObservations: pack.opcode9ConditionalCases.map((caseValue) =>
      makeObservation(caseValue.id, caseValue.expected, [caseValue])),
    rollbackObservations: pack.rollbackRows.map((row) => ({
      id: row.id,
      atomic: makeObservation(`${row.id}:ATOMIC`, row.atomicExpected, [
        row.activeCase,
        {
          instructionDataBase64: row.forcedFailureInstructionDataBase64,
          accountBindings: [row.activeCase.accountBindings
            .find(({ role }) => role === "daily_law_state")],
        },
      ]),
      standaloneRetry: makeObservation(
        `${row.id}:STANDALONE_RETRY`,
        row.retryExpected,
        [row.activeCase],
      ),
    })),
  });
  assert.equal(receipt.status, "HOLD_TEST_EVIDENCE_ONLY");
  assert.equal(receipt.complete, false);
  assert.equal(receipt.evidenceAccepted, false);
  assert.equal(receipt.truth.ordinalObservationCount, 15);
  assert.equal(receipt.truth.opcode9ConditionalObservationCount, 6);
  assert.equal(receipt.truth.rollbackAndRetryObservationCount, 5);
  assert.equal(receipt.truth.dualGenesisFullTransactionObservationCount, 2);
  assert.equal(receipt.negativeDomainObservation.outcome, "DAILY_LAW_REJECTED_LOCAL_DOMAIN");
  assert.equal(
    receipt.positiveDomainObservation.outcome,
    "COMPILED_DOMAIN_ACCEPTED_CCC_DISABLED",
  );
  assert.ok(receipt.negativeDomainObservation.submittedTransactionBase64.length > 0);
  assert.ok(receipt.positiveDomainObservation.submittedTransactionBase64.length > 0);
  assert.equal(
    validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(receipt),
    receipt,
  );
  const substitutedDualGenesisWire = structuredClone(receipt);
  substitutedDualGenesisWire.negativeDomainObservation.landedMessageBase64 =
    Buffer.from("substituted dual-genesis wire", "utf8").toString("base64");
  rehashReceipt(substitutedDualGenesisWire);
  assert.throws(
    () => validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(
      substitutedDualGenesisWire,
    ),
    /MESSAGE_EQUALITY/u,
  );
  for (const mutate of [
    (value) => { value.operationObservations.pop(); },
    (value) => { [value.rollbackObservations[0], value.rollbackObservations[1]] =
      [value.rollbackObservations[1], value.rollbackObservations[0]]; },
    (value) => { value.fixturePack.programBindingsSha256 = hashLabel("not-a-pack-field"); },
  ]) {
    const forged = structuredClone(receipt);
    mutate(forged);
    delete forged.receiptSha256;
    forged.receiptSha256 = sha256IatB3ProductionOfficialRehearsalValue(forged);
    assert.throws(
      () => validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(forged),
      /INVALID_IAT_B3_OFFICIAL_LOCAL_REHEARSAL/u,
    );
  }
  const resetSharedBaseline = structuredClone(receipt);
  const second = resetSharedBaseline.operationObservations[1];
  const feePayer = resetSharedBaseline.fixturePack.signerPlan.feePayerPubkey;
  const feePayerBefore = second.beforeSnapshot.find(({ pubkey }) => pubkey === feePayer);
  feePayerBefore.lamports += second.landedMeta.feeLamports;
  const feePayerIndex = second.landedMeta.accountKeys.indexOf(feePayer);
  second.landedMeta.preBalances[feePayerIndex] = feePayerBefore.lamports;
  resetSharedBaseline.fixturePack.operationCases[1].expected.beforeStateSetSha256 =
    sha256IatB3ProductionOfficialRehearsalValue(
      canonicalIatB3ProductionAccountSnapshot(second.beforeSnapshot),
    );
  delete resetSharedBaseline.fixturePack.fixturePackSha256;
  resetSharedBaseline.fixturePack.fixturePackSha256 =
    sha256IatB3ProductionOfficialRehearsalValue(resetSharedBaseline.fixturePack);
  resetSharedBaseline.fixturePackSha256 = resetSharedBaseline.fixturePack.fixturePackSha256;
  delete resetSharedBaseline.receiptSha256;
  resetSharedBaseline.receiptSha256 =
    sha256IatB3ProductionOfficialRehearsalValue(resetSharedBaseline);
  assert.throws(
    () => validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(resetSharedBaseline),
    /SHARED_SNAPSHOT_CHAIN_PRESTATE/u,
  );
});

test("canonical JSON and receipt hashing are deterministic and order-independent", () => {
  assert.equal(
    canonicalIatB3ProductionOfficialRehearsalJson({ z: 1, a: { y: 2, x: 3 } }),
    canonicalIatB3ProductionOfficialRehearsalJson({ a: { x: 3, y: 2 }, z: 1 }),
  );
  assert.equal(
    sha256IatB3ProductionOfficialRehearsalValue({ z: 1, a: 2 }),
    sha256IatB3ProductionOfficialRehearsalValue({ a: 2, z: 1 }),
  );
});

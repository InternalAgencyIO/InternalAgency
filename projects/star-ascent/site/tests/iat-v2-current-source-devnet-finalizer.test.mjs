import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  CANONICAL_DEVNET_GENESIS_HASH,
  CurrentSourceEvidenceError,
  bindingFromCanonicalCeremony,
  createJsonRpcCaller,
  finalizeCurrentSourceDevnetEvidence,
  observeCompleteRehearsalLedgerProof,
  writeCurrentSourceEvidenceStage,
} from "../scripts/finalize-iat-v2-current-source-devnet-evidence.mjs";
import {
  IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
} from "../programs/iat_v2/ceremony-horizon.mjs";

const LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const blockhash = Keypair.generate().publicKey.toBase58();

function base58Bytes(bytes) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = BigInt(`0x${Buffer.from(bytes).toString("hex")}`);
  let value = "";
  while (number > 0n) { value = `${alphabet[Number(number % 58n)]}${value}`; number /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; value = `1${value}`; }
  return value;
}

const transactionSignature = (transaction) => base58Bytes(transaction.signature);

function signedInstructionTransaction({ signer, programId, keys = [], data }) {
  const transaction = new Transaction({ feePayer: signer.publicKey, recentBlockhash: blockhash }).add(
    new TransactionInstruction({ programId, keys, data }),
  );
  transaction.sign(signer);
  return transaction;
}

function blockEntry(transaction, err = null, meta = {}) {
  return {
    transaction: [transaction.serialize().toString("base64"), "base64"],
    meta: { err, loadedAddresses: { writable: [], readonly: [] }, ...meta },
  };
}

function fixture() {
  const signer = Keypair.generate();
  const programId = Keypair.generate().publicKey;
  const programDataAddress = Keypair.generate().publicKey;
  const artifact = Buffer.from("current source deterministic SBF fixture", "utf8");
  const deploymentSlot = 500;
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: blockhash,
  }).add(new TransactionInstruction({
    programId,
    keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: true }],
    data: Buffer.from([1, 2, 3, 4]),
  }));
  transaction.sign(signer);
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = BigInt(`0x${transaction.signature.toString("hex")}`);
  let txid = "";
  while (number > 0n) { txid = `${alphabet[Number(number % 58n)]}${txid}`; number /= 58n; }
  for (const byte of transaction.signature) { if (byte !== 0) break; txid = `1${txid}`; }

  const binding = {
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    programArtifactSha256: sha256(artifact),
    programArtifactBytes: artifact.length,
    ciBuildEvidenceSha256: "c".repeat(64),
    ciRunUrl: "https://github.com/InternalAgencyIO/InternalAgency/actions/runs/123/attempts/1",
  };
  const programAccount = Buffer.alloc(36);
  programAccount.writeUInt32LE(2, 0);
  programDataAddress.toBuffer().copy(programAccount, 4);
  const programData = Buffer.alloc(45 + artifact.length + 8);
  programData.writeUInt32LE(3, 0);
  programData.writeBigUInt64LE(BigInt(deploymentSlot), 4);
  programData[12] = 1;
  signer.publicKey.toBuffer().copy(programData, 13);
  artifact.copy(programData, 45);
  const consoleExport = {
    schema: "iat-v2-devnet-on-chain-feature-rehearsal-evidence/v1",
    status: "PARTIAL_PENDING_ALL_TIME_GATES_AND_AUTOMATED_DIRECT_EVIDENCE",
    network: "devnet",
    rpc: "https://api.devnet.solana.com",
    programId: programId.toBase58(),
    participant: signer.publicKey.toBase58(),
    transactions: [{
      action: "SETTLE_STANDARD_POSITION_WEEK_11",
      title: "Settle standard position week 11",
      signature: txid,
      messageSha256: sha256(transaction.serializeMessage()),
      explorerUrl: `https://explorer.solana.com/tx/${txid}?cluster=devnet`,
      confirmedAtUtc: "2026-08-26T12:00:00.000Z",
    }],
    exportedAtUtc: "2026-08-26T12:01:00.000Z",
    mainnetStatus: "HOLD",
    automatedDirectEvidenceRequired: true,
    humanReviewerRequired: false,
    noSelfAttestation: true,
    secretMaterialIncluded: false,
  };
  const responses = {
    getGenesisHash: CANONICAL_DEVNET_GENESIS_HASH,
    getSlot: 650,
    getBlockTime: 1_788_600_000,
    getSignatureStatuses: {
      context: { slot: 700 },
      value: [{ slot: 600, confirmations: null, err: null, confirmationStatus: "finalized" }],
    },
    getTransaction: {
      slot: 600,
      blockTime: 1_788_600_000,
      meta: { err: null },
      transaction: [transaction.serialize().toString("base64"), "base64"],
      version: "legacy",
    },
  };
  const rpcCall = async (method, params) => {
    if (method === "getAccountInfo") {
      assert.equal(params[1].minContextSlot, 650);
      if (params[0] === programId.toBase58()) return { context: { slot: 700 }, value: { owner: LOADER, executable: true, data: [programAccount.toString("base64"), "base64"] } };
      if (params[0] === programDataAddress.toBase58()) return { context: { slot: 700 }, value: { owner: LOADER, executable: false, data: [programData.toString("base64"), "base64"] } };
      throw new Error(`unexpected account: ${params[0]}`);
    }
    return responses[method];
  };
  return { artifact, binding, consoleExport, deploymentSlot, programData, programId, responses, rpcCall, signer, transaction, txid };
}

test("partial finalizer observes canonical Devnet but cannot clear from one successful transaction", async () => {
  const value = fixture();
  const result = await finalizeCurrentSourceDevnetEvidence({
    consoleExport: value.consoleExport,
    binding: value.binding,
    rpcCall: value.rpcCall,
    expectedProgramId: value.programId.toBase58(),
    expectedSigner: value.signer.publicKey.toBase58(),
    observedAt: "2026-08-26T12:02:03.456Z",
  });
  assert.equal(result.directEvidence.schema, "iat-v2-current-source-direct-evidence/v1");
  assert.equal(result.directEvidence.predicate, "CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL_PARTIAL");
  assert.equal(result.clearingEligible, false);
  assert.equal(
    result.clearingBlocker,
    "PARTIAL_CONSOLE_EXPORT",
  );
  assert.equal(result.directEvidence.observationMode, "INJECTED_LIBRARY_TRANSPORT_NON_CLEARING_OBSERVATION");
  assert.equal(result.directEvidence.observedAtUtc, "2026-08-26T12:02:03Z");
  assert.deepEqual(result.directEvidence.transactionSignatures, [value.txid]);
  assert.deepEqual(result.directEvidence.receipts, [`https://explorer.solana.com/tx/${value.txid}?cluster=devnet`]);
  assert.equal(result.directEvidence.checks.length, 4);
  assert.ok(result.directEvidence.checks.every((item) => item.result === "PASS"));
  assert.ok(result.files.some((item) => item.path === "signed-devnet-rehearsal-partial.json"));
  assert.ok(result.files.some((item) => item.path === "details/devnet-tx-001-finalized.json"));

  const staging = mkdtempSync(join(tmpdir(), "iat-v2-current-source-stage-parent-"));
  const target = join(staging, "stage");
  try {
    writeCurrentSourceEvidenceStage({ stagingDirectory: target, files: result.files });
    assert.ok(existsSync(join(target, "signed-devnet-rehearsal-partial.json")));
    const direct = JSON.parse(readFileSync(join(target, "signed-devnet-rehearsal-partial.json"), "utf8"));
    assert.equal(direct.transactionSignatures[0], value.txid);
    assert.notEqual(direct.predicate, "CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL");
    assert.throws(
      () => writeCurrentSourceEvidenceStage({ stagingDirectory: target, files: result.files }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "STAGING_NOT_EMPTY_HOLD",
    );
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
});

test("finalizer polls until every selected status is finalized", async () => {
  const value = fixture();
  let statusCalls = 0;
  let clock = 0;
  const rpcCall = async (method, params) => {
    if (method !== "getSignatureStatuses") return value.rpcCall(method, params);
    statusCalls += 1;
    if (statusCalls === 1) return { context: { slot: 700 }, value: [{ slot: 600, confirmations: 1, err: null, confirmationStatus: "confirmed" }] };
    return value.responses.getSignatureStatuses;
  };
  await finalizeCurrentSourceDevnetEvidence({
    consoleExport: value.consoleExport,
    binding: value.binding,
    rpcCall,
    expectedProgramId: value.programId.toBase58(),
    expectedSigner: value.signer.publicKey.toBase58(),
    maxWaitMs: 10,
    pollIntervalMs: 1,
    nowMs: () => clock,
    sleep: async () => { clock += 1; },
  });
  assert.equal(statusCalls, 2);
});

test("subset and incomplete-roster bypasses cannot emit clearing evidence", async () => {
  const value = fixture();
  const subset = await finalizeCurrentSourceDevnetEvidence({
    consoleExport: value.consoleExport,
    binding: value.binding,
    rpcCall: value.rpcCall,
    includeSignatures: [value.txid],
    expectedProgramId: value.programId.toBase58(),
    expectedSigner: value.signer.publicKey.toBase58(),
  });
  assert.equal(subset.clearingEligible, false);
  assert.equal(subset.directEvidence.predicate, "CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL_PARTIAL");

  const incompleteClaim = {
    schema: "iat-v2-current-source-attended-devnet-console-bundle/v1",
    status: "COMPLETE_PENDING_AUTOMATED_DIRECT_EVIDENCE",
    rosterVersion: "IAT_V2_MIGRATION_BACKFILL_POLICY13_CCC13_V1",
    sourceCommit: value.binding.sourceCommit,
    programArtifactSha256: value.binding.programArtifactSha256,
    network: "devnet",
    rpc: "https://api.devnet.solana.com",
    programId: value.programId.toBase58(),
    mint: Keypair.generate().publicKey.toBase58(),
    participant: value.signer.publicKey.toBase58(),
    conditions: {
      programDataExtensionRequired: false,
      preUpgradeProgramDataCapacityBytes: value.binding.programArtifactBytes,
      switchboardRandomnessCreationRequired: true,
      policyWeek: 13,
      cccRound: 13,
      cccRoundTerminalAction: "REVEAL_CCC_ROUND_13",
    },
    transactions: value.consoleExport.transactions.map((item) => ({
      action: item.action,
      title: item.title,
      signature: item.signature,
      messageSha256: item.messageSha256,
      explorerUrl: item.explorerUrl,
      finalizedAtUtc: item.confirmedAtUtc,
      kind: "feature",
      week: 11,
    })),
    exportedAtUtc: value.consoleExport.exportedAtUtc,
    mainnetStatus: "HOLD",
    automatedDirectEvidenceRequired: true,
    humanReviewerRequired: false,
    noSelfAttestation: true,
    secretMaterialIncluded: false,
  };
  const incomplete = await finalizeCurrentSourceDevnetEvidence({
    consoleExport: incompleteClaim,
    binding: value.binding,
    rpcCall: value.rpcCall,
    expectedProgramId: value.programId.toBase58(),
    expectedSigner: value.signer.publicKey.toBase58(),
  });
  assert.equal(incomplete.clearingEligible, false);
  assert.equal(incomplete.directEvidence.predicate, "CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL_PARTIAL");
  assert.equal(incomplete.clearingBlocker, "COMPLETE_REHEARSAL_ACTION_ROSTER_OR_ORDER_MISMATCH");

  const noCreateShortcut = structuredClone(incompleteClaim);
  noCreateShortcut.conditions.switchboardRandomnessCreationRequired = false;
  await assert.rejects(
    finalizeCurrentSourceDevnetEvidence({
      consoleExport: noCreateShortcut,
      binding: value.binding,
      rpcCall: value.rpcCall,
      expectedProgramId: value.programId.toBase58(),
      expectedSigner: value.signer.publicKey.toBase58(),
    }),
    (error) => error instanceof CurrentSourceEvidenceError && error.code === "COMPLETE_ROSTER_HOLD",
  );

  const contradictoryReceipt = structuredClone(incompleteClaim);
  contradictoryReceipt.transactions[0].kind = "program";
  await assert.rejects(
    finalizeCurrentSourceDevnetEvidence({
      consoleExport: contradictoryReceipt,
      binding: value.binding,
      rpcCall: value.rpcCall,
      expectedProgramId: value.programId.toBase58(),
      expectedSigner: value.signer.publicKey.toBase58(),
    }),
    (error) => error instanceof CurrentSourceEvidenceError && error.code === "CONSOLE_EXPORT_HOLD",
  );

  for (const [label, mutate, code] of [
    ["stale roster version", (claim) => { claim.rosterVersion = "IAT_V2_MIGRATION_BACKFILL_WEEK11_V1"; }, "COMPLETE_ROSTER_HOLD"],
    ["stale policy week", (claim) => { claim.conditions.policyWeek = 12; }, "COMPLETE_ROSTER_HOLD"],
    ["stale CCC round", (claim) => { claim.conditions.cccRound = 12; }, "COMPLETE_ROSTER_HOLD"],
    ["stale CCC terminal", (claim) => { claim.conditions.cccRoundTerminalAction = "REVEAL_CCC_ROUND_12"; }, "COMPLETE_ROSTER_HOLD"],
    ["old round-specific terminal field", (claim) => {
      delete claim.conditions.cccRoundTerminalAction;
      claim.conditions.cccRound12TerminalAction = "REVEAL_CCC_ROUND_12";
    }, "INPUT_SCHEMA_HOLD"],
  ]) {
    const drifted = structuredClone(incompleteClaim);
    mutate(drifted);
    let rpcCalled = false;
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: drifted,
        binding: value.binding,
        rpcCall: async (...args) => {
          rpcCalled = true;
          return value.rpcCall(...args);
        },
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === code,
      label,
    );
    assert.equal(rpcCalled, false, `${label} reached RPC observation`);
  }

  for (const [label, finalizedBlockTime] of [
    ["missing fresh finalized block time", null],
    ["fresh finalized clock before CCC round 13", 1_788_585_574],
    ["fresh finalized clock at the policy-week horizon close", IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP],
  ]) {
    const rpcMethods = [];
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: incompleteClaim,
        binding: value.binding,
        rpcCall: async (method, params) => {
          rpcMethods.push(method);
          if (method === "getBlockTime") return finalizedBlockTime;
          return value.rpcCall(method, params);
        },
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "CEREMONY_HORIZON_HOLD",
      label,
    );
    assert.deepEqual(
      rpcMethods,
      ["getGenesisHash", "getSlot", "getBlockTime"],
      `${label} reached transaction or poststate observation`,
    );
  }

  for (const [label, transactionBlockTime] of [
    ["finalized transaction before CCC round 13", 1_788_585_574],
    ["finalized transaction at the policy-week horizon close", IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP],
  ]) {
    const rpcMethods = [];
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: incompleteClaim,
        binding: value.binding,
        rpcCall: async (method, params) => {
          rpcMethods.push(method);
          if (method === "getTransaction") {
            return { ...value.responses.getTransaction, blockTime: transactionBlockTime };
          }
          return value.rpcCall(method, params);
        },
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "CEREMONY_HORIZON_HOLD",
      label,
    );
    assert.ok(rpcMethods.includes("getTransaction"), `${label} did not exercise transaction observation`);
    assert.equal(rpcMethods.includes("getBlock"), false, `${label} reached ledger-proof observation`);
  }
});

test("finalizer fails closed on wrong network, timeout, failed transaction, message drift, or deployed-byte drift", async (t) => {
  await t.test("wrong network", async () => {
    const value = fixture();
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: value.consoleExport,
        binding: value.binding,
        rpcCall: async (method, params) => method === "getGenesisHash" ? "wrong" : value.rpcCall(method, params),
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "NETWORK_BINDING_HOLD",
    );
  });
  await t.test("not finalized", async () => {
    const value = fixture();
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: value.consoleExport,
        binding: value.binding,
        rpcCall: async (method, params) => method === "getSignatureStatuses"
          ? { context: { slot: 700 }, value: [{ slot: 600, confirmations: 1, err: null, confirmationStatus: "confirmed" }] }
          : value.rpcCall(method, params),
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "FINALIZATION_TIMEOUT_HOLD",
    );
  });
  await t.test("failed transaction", async () => {
    const value = fixture();
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: value.consoleExport,
        binding: value.binding,
        rpcCall: async (method, params) => method === "getTransaction"
          ? { ...value.responses.getTransaction, meta: { err: { InstructionError: [0, "Custom"] } } }
          : value.rpcCall(method, params),
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "TRANSACTION_FAILED_HOLD",
    );
  });
  await t.test("message drift", async () => {
    const value = fixture();
    value.consoleExport.transactions[0].messageSha256 = "d".repeat(64);
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: value.consoleExport,
        binding: value.binding,
        rpcCall: value.rpcCall,
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "TRANSACTION_MESSAGE_HOLD",
    );
  });
  await t.test("deployed artifact drift", async () => {
    const value = fixture();
    value.programData[45] ^= 0xff;
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: value.consoleExport,
        binding: value.binding,
        rpcCall: value.rpcCall,
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "DEPLOYED_ARTIFACT_MISMATCH_HOLD",
    );
  });
  await t.test("ProgramData context below minContextSlot", async () => {
    const value = fixture();
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: value.consoleExport,
        binding: value.binding,
        rpcCall: async (method, params) => {
          const result = await value.rpcCall(method, params);
          return method === "getAccountInfo" && params[0] !== value.programId.toBase58()
            ? { ...result, context: { slot: 649 } }
            : result;
        },
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "RPC_CONTEXT_HOLD",
    );
  });
  await t.test("signature status context below minContextSlot", async () => {
    const value = fixture();
    await assert.rejects(
      finalizeCurrentSourceDevnetEvidence({
        consoleExport: value.consoleExport,
        binding: value.binding,
        rpcCall: async (method, params) => method === "getSignatureStatuses"
          ? { ...value.responses.getSignatureStatuses, context: { slot: 649 } }
          : value.rpcCall(method, params),
        expectedProgramId: value.programId.toBase58(),
        expectedSigner: value.signer.publicKey.toBase58(),
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "RPC_CONTEXT_HOLD",
    );
  });
});

test("read-only RPC caller rejects redirects, endpoint drift, content-type drift, and write methods", async (t) => {
  const response = (overrides = {}) => ({
    ok: true,
    status: 200,
    redirected: false,
    url: "https://api.devnet.solana.com/",
    headers: { get: () => "application/json; charset=utf-8" },
    json: async () => ({ jsonrpc: "2.0", id: 1, result: CANONICAL_DEVNET_GENESIS_HASH }),
    ...overrides,
  });
  await t.test("exact no-redirect request", async () => {
    let options;
    const caller = createJsonRpcCaller({ fetchImpl: async (_url, value) => { options = value; return response(); } });
    assert.equal(await caller("getGenesisHash", []), CANONICAL_DEVNET_GENESIS_HASH);
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
  });
  for (const [name, mutation] of [
    ["redirect flag", { redirected: true }],
    ["response endpoint", { url: "https://evil.invalid/" }],
    ["content type", { headers: { get: () => "text/html" } }],
  ]) {
    await t.test(name, async () => {
      const caller = createJsonRpcCaller({ fetchImpl: async () => response(mutation) });
      await assert.rejects(caller("getGenesisHash", []), (error) => error instanceof CurrentSourceEvidenceError && error.code === "RPC_TRANSPORT_HOLD");
    });
  }
  await t.test("write method", async () => {
    let called = false;
    const caller = createJsonRpcCaller({ fetchImpl: async () => { called = true; return response(); } });
    await assert.rejects(caller("sendTransaction", []), (error) => error instanceof CurrentSourceEvidenceError && error.code === "RPC_METHOD_HOLD");
    assert.equal(called, false);
  });
});

test("ledger proof binds same-slot order, last ProgramData upgrade, and conditional capacity", async (t) => {
  const signer = Keypair.generate();
  const loader = new PublicKey(LOADER);
  const programData = Keypair.generate().publicKey;
  const program = Keypair.generate().publicKey;
  const buffer = Keypair.generate().publicKey;
  const featureProgram = Keypair.generate().publicKey;
  const upgrade = signedInstructionTransaction({
    signer,
    programId: loader,
    data: Buffer.from([3, 0, 0, 0]),
    keys: [
      { pubkey: programData, isSigner: false, isWritable: true },
      { pubkey: program, isSigner: false, isWritable: true },
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: true },
    ],
  });
  const feature = signedInstructionTransaction({
    signer,
    programId: featureProgram,
    data: Buffer.from([1]),
  });
  const laterUpgrade = signedInstructionTransaction({
    signer,
    programId: loader,
    data: Buffer.from([3, 0, 0, 0]),
    keys: [
      { pubkey: programData, isSigner: false, isWritable: true },
      { pubkey: program, isSigner: false, isWritable: true },
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: true },
    ],
  });
  const innerUpgradeCarrier = signedInstructionTransaction({
    signer,
    programId: featureProgram,
    data: Buffer.from([2]),
    keys: [
      { pubkey: programData, isSigner: false, isWritable: true },
      { pubkey: loader, isSigner: false, isWritable: false },
    ],
  });
  const carrierKeys = innerUpgradeCarrier.compileMessage().accountKeys;
  const innerUpgradeCarrierEntry = blockEntry(innerUpgradeCarrier, null, {
    innerInstructions: [{
      index: 0,
      instructions: [{
        programIdIndex: carrierKeys.findIndex((item) => item.equals(loader)),
        accounts: [carrierKeys.findIndex((item) => item.equals(programData))],
        data: base58Bytes(Buffer.from([3, 0, 0, 0])),
      }],
    }],
  });
  const observations = [
    { action: "UPGRADE_PROGRAM", signature: transactionSignature(upgrade), slot: 500 },
    { action: "MIGRATE_LEGACY_ROUND_WEEK_7", signature: transactionSignature(feature), slot: 500 },
  ];
  const deployedProgram = {
    deploymentSlot: 500,
    programDataAddress: programData.toBase58(),
    programDataCapacityBytes: 500,
  };
  const binding = { programArtifactBytes: 400 };
  const conditions = {
    programDataExtensionRequired: false,
    preUpgradeProgramDataCapacityBytes: 500,
  };
  const invoke = (transactions, overrides = {}) => observeCompleteRehearsalLedgerProof({
    rpcCall: async (method, params) => {
      assert.equal(method, "getBlock");
      assert.equal(params[0], 500);
      assert.equal(params[1].commitment, "finalized");
      return {
        blockTime: overrides.blockTime ?? 1_788_600_000,
        blockhash: Keypair.generate().publicKey.toBase58(),
        previousBlockhash: Keypair.generate().publicKey.toBase58(),
        transactions: transactions.map((item) => Array.isArray(item?.transaction) ? item : blockEntry(item)),
      };
    },
    transactionObservations: overrides.transactionObservations ?? observations,
    decodedEntries: overrides.decodedEntries ?? [{ action: "UPGRADE_PROGRAM", transaction: upgrade }],
    deployedProgram: { ...deployedProgram, ...overrides.deployedProgram },
    conditions: { ...conditions, ...overrides.conditions },
    binding: { ...binding, ...overrides.binding },
  });

  const exact = await invoke([upgrade, feature]);
  assert.equal(exact.checkedSameSlotAndDeploymentBlocks[0].recordedUpgradeTransactionIndex, 0);
  assert.equal(exact.finalProgramDataCapacityBytes, 500);

  await t.test("same-slot roster reversal", async () => {
    await assert.rejects(invoke([feature, upgrade]), (error) => error instanceof CurrentSourceEvidenceError && error.code === "TRANSACTION_ORDER_HOLD");
  });
  await t.test("ledger block at the source-bound horizon close", async () => {
    await assert.rejects(
      invoke([upgrade, feature], {
        blockTime: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "CEREMONY_HORIZON_HOLD",
    );
  });
  await t.test("later ProgramData upgrade in deployment slot", async () => {
    await assert.rejects(invoke([upgrade, feature, laterUpgrade]), (error) => error instanceof CurrentSourceEvidenceError && error.code === "DEPLOYMENT_ORDER_HOLD");
  });
  await t.test("later inner ProgramData upgrade in deployment slot", async () => {
    await assert.rejects(invoke([upgrade, feature, innerUpgradeCarrierEntry]), (error) => error instanceof CurrentSourceEvidenceError && error.code === "DEPLOYMENT_ORDER_HOLD");
  });
  await t.test("unchanged capacity mismatch", async () => {
    await assert.rejects(
      invoke([upgrade, feature], { deployedProgram: { programDataCapacityBytes: 501 } }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "PROGRAM_CAPACITY_HOLD",
    );
  });
  await t.test("exact extension delta", async () => {
    const extensionData = Buffer.alloc(8);
    extensionData.writeUInt32LE(6, 0);
    extensionData.writeUInt32LE(100, 4);
    const extension = signedInstructionTransaction({
      signer,
      programId: loader,
      data: extensionData,
      keys: [{ pubkey: programData, isSigner: false, isWritable: true }],
    });
    const result = await invoke([upgrade], {
      transactionObservations: [
        { action: "EXTEND_PROGRAM_DATA", signature: transactionSignature(extension), slot: 499 },
        observations[0],
      ],
      decodedEntries: [
        { action: "EXTEND_PROGRAM_DATA", transaction: extension },
        { action: "UPGRADE_PROGRAM", transaction: upgrade },
      ],
      deployedProgram: { programDataCapacityBytes: 600 },
      conditions: { programDataExtensionRequired: true, preUpgradeProgramDataCapacityBytes: 500 },
      binding: { programArtifactBytes: 600 },
    });
    assert.equal(result.extensionDeltaBytes, 100);
    extensionData.writeUInt32LE(99, 4);
    const wrongExtension = signedInstructionTransaction({
      signer,
      programId: loader,
      data: extensionData,
      keys: [{ pubkey: programData, isSigner: false, isWritable: true }],
    });
    await assert.rejects(
      invoke([upgrade], {
        transactionObservations: [
          { action: "EXTEND_PROGRAM_DATA", signature: transactionSignature(wrongExtension), slot: 499 },
          observations[0],
        ],
        decodedEntries: [
          { action: "EXTEND_PROGRAM_DATA", transaction: wrongExtension },
          { action: "UPGRADE_PROGRAM", transaction: upgrade },
        ],
        deployedProgram: { programDataCapacityBytes: 600 },
        conditions: { programDataExtensionRequired: true, preUpgradeProgramDataCapacityBytes: 500 },
        binding: { programArtifactBytes: 600 },
      }),
      (error) => error instanceof CurrentSourceEvidenceError && error.code === "PROGRAM_CAPACITY_HOLD",
    );
  });
});

test("source finalizer derives only a bound ceremony tuple and authenticates the canonical local binary", () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "iat-v2-finalizer-binding-"));
  try {
    const binaryDirectory = join(projectRoot, "target", "verifiable");
    const binaryPath = join(binaryDirectory, "iat_v2.so");
    const hardlinkPath = join(projectRoot, "iat_v2-hardlink.so");
    const programBytes = Buffer.from("reviewed-program-a", "utf8");
    mkdirSync(binaryDirectory, { recursive: true });
    writeFileSync(binaryPath, programBytes);
    const verified = Object.freeze({
      schema: "iat-v2-devnet-program-ceremony-runtime-verification/v1",
      status: "BOUND",
      network: "devnet",
      mainnetStatus: "HOLD",
      relation: "DIRECT_BINDING_ONLY_SUCCESSOR",
      checkoutRelation: "PR_MERGE_SECOND_PARENT",
      checkoutObjectVerified: true,
      checkoutEvidenceRefVerified: true,
      runtimeEvidenceVerified: true,
      runtimeEvidencePath: "target/verifiable/iat-v2-ceremony-runtime-build-evidence.json",
      transactionExecution: false,
      signing: false,
      broadcast: false,
      mainnetAuthorized: false,
      sourceHeadCommit: "1".repeat(40),
      sourceHeadTree: "2".repeat(40),
      artifactSha256: sha256(programBytes),
      artifactBytes: programBytes.length,
      runtimeEvidenceManifestSha256: "3".repeat(64),
      ciRunId: 123456789,
      ciRunAttempt: 2,
    });
    const verifyRuntimeBinding = () => verified;
    const exact = bindingFromCanonicalCeremony({ projectRoot, verifyRuntimeBinding });
    assert.equal(Object.isFrozen(exact), true);
    assert.deepEqual(exact, {
      sourceCommit: verified.sourceHeadCommit,
      sourceTree: verified.sourceHeadTree,
      programArtifactSha256: verified.artifactSha256,
      programArtifactBytes: verified.artifactBytes,
      ciBuildEvidenceSha256: verified.runtimeEvidenceManifestSha256,
      ciRunUrl: "https://github.com/InternalAgencyIO/InternalAgency/actions/runs/123456789/attempts/2",
    });

    writeFileSync(binaryPath, Buffer.from("reviewed-program-b", "utf8"));
    assert.throws(
      () => bindingFromCanonicalCeremony({ projectRoot, verifyRuntimeBinding }),
      (error) => error instanceof CurrentSourceEvidenceError
        && error.code === "SOURCE_BINDING_HOLD"
        && /bytes or SHA-256 disagree/u.test(error.message),
    );

    writeFileSync(binaryPath, programBytes.subarray(0, programBytes.length - 1));
    assert.throws(
      () => bindingFromCanonicalCeremony({ projectRoot, verifyRuntimeBinding }),
      (error) => error instanceof CurrentSourceEvidenceError
        && error.code === "SOURCE_BINDING_HOLD"
        && /bytes or SHA-256 disagree/u.test(error.message),
    );

    writeFileSync(binaryPath, programBytes);
    linkSync(binaryPath, hardlinkPath);
    assert.throws(
      () => bindingFromCanonicalCeremony({ projectRoot, verifyRuntimeBinding }),
      (error) => error instanceof CurrentSourceEvidenceError
        && error.code === "SOURCE_BINDING_HOLD"
        && /single-linked/u.test(error.message),
    );
    rmSync(hardlinkPath);

    assert.throws(
      () => bindingFromCanonicalCeremony({
        projectRoot,
        verifyRuntimeBinding: () => ({ ...verified, mainnetAuthorized: true }),
      }),
      (error) => error instanceof CurrentSourceEvidenceError
        && error.code === "SOURCE_BINDING_HOLD"
        && /exact non-authorizing bound Devnet result/u.test(error.message),
    );

    rmSync(binaryPath);
    mkdirSync(binaryPath);
    assert.throws(
      () => bindingFromCanonicalCeremony({ projectRoot, verifyRuntimeBinding }),
      (error) => error instanceof CurrentSourceEvidenceError
        && error.code === "SOURCE_BINDING_HOLD"
        && /regular non-symlink file/u.test(error.message),
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("source finalizer exposes no signing or broadcast operation and CLI is dry unless --write is explicit", () => {
  const source = readFileSync("scripts/finalize-iat-v2-current-source-devnet-evidence.mjs", "utf8");
  assert.doesNotMatch(source, /sendRawTransaction|sendTransaction|signTransaction|partialSign|\.sign\(/u);
  assert.match(source, /if \(options\.write\) stagedAt = writeCurrentSourceEvidenceStage/u);
  assert.match(source, /const clearingEligible = canonicalCliTransport/u);
  assert.match(source, /commitment: "finalized"/u);
  assert.match(source, /redirect: "error"/u);
  assert.match(source, /canonicalCliRpcCallers\.has\(rpcCall\)/u);
  assert.match(source, /verifyRuntimeBinding = verifyIatV2DevnetProgramCeremonyRuntimeBinding/u);
  assert.match(source, /verified = verifyRuntimeBinding\(\{ projectRoot \}\)/u);
  assert.match(source, /runtimeEvidencePath === IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH/u);
  assert.match(source, /programBytes\.length === verified\.artifactBytes/u);
  assert.match(source, /sha256\(programBytes\) === verified\.artifactSha256/u);
  assert.doesNotMatch(source, /options\.ciManifest|bindingFromCiManifest/u);
  assert.doesNotMatch(source, /tools\/iat-v2-admin-console\/attended-evidence/u);
  assert.match(source, /IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION/u);
  assert.match(source, /"policyWeek",\s*"cccRound",\s*"cccRoundTerminalAction"/u);
  assert.match(source, /IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC/u);
  assert.match(source, /nextPolicyBoundaryTimestamp: IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP/u);
  assert.match(source, /nextPolicyBoundaryUtc: IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_UTC/u);
  assert.match(source, /nextCccBoundaryTimestamp: IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP/u);
  assert.match(source, /nextCccBoundaryUtc: IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_UTC/u);
  assert.match(source, /closesOn: horizon\.closesOn/u);
  assert.doesNotMatch(source, /CEREMONY_GENESIS_TIMESTAMP\s*=\s*IAT_V2_DEVNET_CEREMONY_.*CLOSE_TIMESTAMP/u);
  assert.match(source, /validateCeremonyHorizonTimestamp\(\{\s*slot: result\.slot,\s*timestamp: result\.blockTime/gu);
  assert.match(source, /validateCeremonyHorizonTimestamp\(\{\s*slot,\s*timestamp: block\.blockTime/gu);
  assert.match(
    source,
    /completePostState = await observeCompleteRehearsalPostState[\s\S]*final: await observeFreshCeremonyHorizon[\s\S]*clearingBlocker = null/u,
  );
  assert.match(
    source,
    /const observationFloor = Math\.max\(\s*minContextSlot,\s*statusContextSlot,\s*deployedProgram\.programContextSlot,\s*deployedProgram\.programDataContextSlot/u,
  );
  assert.match(
    source,
    /observeCompleteRehearsalPostState\(\{[\s\S]*minContextSlot: observationFloor,[\s\S]*observeFreshCeremonyHorizon\(\{[\s\S]*minContextSlot: Math\.max\(observationFloor, completePostState\.contextSlot\)/u,
  );
  assert.match(source, /ceremonyHorizonObservation\?\.final \? \[/u);
  const runtimeVerifierSource = readFileSync(
    "scripts/lib/iat-v2-devnet-program-ceremony-runtime-binding.mjs",
    "utf8",
  );
  assert.match(runtimeVerifierSource, /verifyArtifactFiles: false/u);
});

test("source finalizer CLI rejects an operator-selected CI manifest before any observation", () => {
  const result = spawnSync(process.execPath, [
    "scripts/finalize-iat-v2-current-source-devnet-evidence.mjs",
    "--console-export",
    "not-read.json",
    "--staging-dir",
    "not-written",
    "--ci-manifest",
    "target/verifiable/iat-v2-build-evidence.json",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /"code"\s*:\s*"CLI_USAGE"/u);
  assert.match(output, /unexpected option: --ci-manifest/u);
});

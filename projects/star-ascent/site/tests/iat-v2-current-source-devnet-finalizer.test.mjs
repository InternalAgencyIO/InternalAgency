import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  Keypair,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  CANONICAL_DEVNET_GENESIS_HASH,
  CurrentSourceEvidenceError,
  finalizeCurrentSourceDevnetEvidence,
  writeCurrentSourceEvidenceStage,
} from "../scripts/finalize-iat-v2-current-source-devnet-evidence.mjs";

const LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const blockhash = Keypair.generate().publicKey.toBase58();

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
    getSignatureStatuses: {
      context: { slot: 700 },
      value: [{ slot: 600, confirmations: null, err: null, confirmationStatus: "finalized" }],
    },
    getTransaction: {
      slot: 600,
      blockTime: 1_777_111_111,
      meta: { err: null },
      transaction: [transaction.serialize().toString("base64"), "base64"],
      version: "legacy",
    },
  };
  const rpcCall = async (method, params) => {
    if (method === "getAccountInfo") {
      if (params[0] === programId.toBase58()) return { value: { owner: LOADER, executable: true, data: [programAccount.toString("base64"), "base64"] } };
      if (params[0] === programDataAddress.toBase58()) return { value: { owner: LOADER, executable: false, data: [programData.toString("base64"), "base64"] } };
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
    "EXACT_ROSTER_INSTRUCTION_DECODING_AND_COMPLETE_POST_STATE_VERIFICATION_NOT_IMPLEMENTED",
  );
  assert.equal(result.directEvidence.observationMode, "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION");
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
    if (statusCalls === 1) return { context: { slot: 601 }, value: [{ slot: 600, confirmations: 1, err: null, confirmationStatus: "confirmed" }] };
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
    ...value.consoleExport,
    schema: "iat-v2-current-source-attended-devnet-console-bundle/v1",
    status: "COMPLETE_PENDING_AUTOMATED_DIRECT_EVIDENCE",
    rosterVersion: "IAT_V2_MIGRATION_BACKFILL_WEEK11_V1",
    sourceCommit: value.binding.sourceCommit,
    programArtifactSha256: value.binding.programArtifactSha256,
    conditions: {
      programDataExtensionRequired: false,
      preUpgradeProgramDataCapacityBytes: value.binding.programArtifactBytes,
      switchboardRandomnessCreationRequired: false,
      cccRound11TerminalAction: "REVEAL_CCC_ROUND_11",
    },
  };
  await assert.rejects(
    finalizeCurrentSourceDevnetEvidence({
      consoleExport: incompleteClaim,
      binding: value.binding,
      rpcCall: value.rpcCall,
      expectedProgramId: value.programId.toBase58(),
      expectedSigner: value.signer.publicKey.toBase58(),
    }),
    (error) => error instanceof CurrentSourceEvidenceError && error.code === "COMPLETE_ROSTER_HOLD",
  );
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
          ? { context: { slot: 600 }, value: [{ slot: 600, confirmations: 1, err: null, confirmationStatus: "confirmed" }] }
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
});

test("source finalizer exposes no signing or broadcast operation and CLI is dry unless --write is explicit", () => {
  const source = readFileSync("scripts/finalize-iat-v2-current-source-devnet-evidence.mjs", "utf8");
  assert.doesNotMatch(source, /sendRawTransaction|sendTransaction|signTransaction|partialSign|\.sign\(/u);
  assert.match(source, /if \(options\.write\) stagedAt = writeCurrentSourceEvidenceStage/u);
  assert.doesNotMatch(source, /predicate:\s*"CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL"/u);
  assert.match(source, /status: options\.write \? "STAGED_PARTIAL_NON_CLEARING" : "DRY_RUN_PARTIAL_NON_CLEARING"/u);
  assert.match(source, /commitment: "finalized"/u);
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const SCHEMA = "iat-b3-economy-sbf-structural-preflight/v1";
const NAMESPACE = Buffer.from("IATB3PF1", "ascii");
const RPC_LOOPBACK = /^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]+$/u;

const operations = Object.freeze([
  ["initialize_config", [[1, 1, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 0, 1]]],
  ["initialize_lane_vault", [[1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1]]],
  ["initialize_stake_vault", [[1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1]]],
  ["activate", [[1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 1, 0], [0, 0, 1]]],
  ["register_agency", [[1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1]]],
  ["set_eligibility", [[1, 1, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 1]]],
  ["open_position", [[1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1]]],
  ["settle_position_week", [[1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1]]],
  ["settle_core_week", [[1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1]]],
  ["claim_lane_principal", [[1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1]]],
  ["withdraw_position_principal", [[1, 0, 0], [0, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1]]],
  ["close_position", [[1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]]],
  ["commit_round", [[1, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 1]]],
  ["settle_round", [[0, 0, 0], [0, 1, 0], [0, 0, 0]]],
  ["expire_round", [[0, 0, 0], [0, 1, 0]]],
]);

function fail(message) {
  throw new Error(`${SCHEMA}: ${message}`);
}

function args() {
  const values = new Map();
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const value = process.argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) fail("invalid arguments");
    values.set(flag.slice(2), value);
  }
  for (const required of ["rpc", "program", "payer", "readonly-signer", "writable-dummy", "readonly-dummy", "artifact"]) {
    if (!values.has(required)) fail(`missing --${required}`);
  }
  return Object.fromEntries(values);
}

function keypair(path) {
  const bytes = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(bytes) || bytes.length !== 64) fail("keypair must contain exactly 64 bytes");
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function data(operationIndex) {
  const bytes = Buffer.alloc(16);
  NAMESPACE.copy(bytes, 0);
  bytes[8] = 1;
  bytes[9] = 0;
  bytes[10] = operationIndex;
  return bytes;
}

function instruction({ program, payer, readonlySigner, writableDummy, readonlyDummy }, operationIndex, hostile = false) {
  const [, graph] = operations[operationIndex];
  const keys = graph.map(([signer, writable, executable], index) => {
    let pubkey;
    if (executable) pubkey = SystemProgram.programId;
    else if (signer && writable) pubkey = payer.publicKey;
    else if (signer) pubkey = readonlySigner.publicKey;
    else if (writable) pubkey = writableDummy;
    else pubkey = readonlyDummy;
    return {
      pubkey,
      isSigner: hostile && index === 0 ? false : Boolean(signer),
      isWritable: Boolean(writable),
    };
  });
  return new TransactionInstruction({ programId: program, keys, data: data(operationIndex) });
}

async function exactTransaction(connection, context, operationIndex, hostile = false) {
  const latest = await connection.getLatestBlockhashAndContext("processed");
  const tx = new Transaction({
    feePayer: context.payer.publicKey,
    recentBlockhash: latest.value.blockhash,
  }).add(instruction(context, operationIndex, hostile));
  const needsReadonlySigner = !hostile
    && operations[operationIndex][1].some(([signer, writable]) => signer && !writable);
  tx.sign(...(needsReadonlySigner ? [context.payer, context.readonlySigner] : [context.payer]));
  return { latest, tx, wire: Buffer.from(tx.serialize()) };
}

async function rawSimulation(rpc, latest, wire) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "simulateTransaction",
    params: [wire.toString("base64"), {
      encoding: "base64",
      commitment: "processed",
      sigVerify: true,
      replaceRecentBlockhash: false,
      minContextSlot: latest.context.slot,
    }],
  };
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || json.id !== 1 || json.error || !json.result?.value) fail("invalid simulation response");
  return json.result;
}

async function finalizedTransaction(connection, signature, lastValidBlockHeight) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await connection.getSignatureStatuses(
      [signature],
      { searchTransactionHistory: true },
    );
    const status = response.value[0];
    if (status?.err) fail(`transaction ${signature} failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "finalized" || status?.confirmations === null) {
      const transaction = await connection.getTransaction(signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });
      if (!transaction || transaction.meta?.err !== null) {
        fail(`transaction ${signature} lacks exact finalized success evidence`);
      }
      return transaction;
    }
    const blockHeight = await connection.getBlockHeight("processed");
    if (!status && blockHeight > lastValidBlockHeight) {
      fail(`transaction ${signature} was never observed before blockhash expiry`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail(`transaction ${signature} did not finalize within 60 seconds`);
}

const input = args();
if (!RPC_LOOPBACK.test(input.rpc)) fail("driver is loopback-only");
if (operations.length !== 15) fail("operation inventory must contain exactly 15 entries");
const context = {
  program: new PublicKey(input.program),
  payer: keypair(input.payer),
  readonlySigner: keypair(input["readonly-signer"]),
  writableDummy: new PublicKey(input["writable-dummy"]),
  readonlyDummy: new PublicKey(input["readonly-dummy"]),
};
const artifact = readFileSync(input.artifact);
const artifactSha256 = createHash("sha256").update(artifact).digest("hex");
const connection = new Connection(input.rpc, "finalized");
const signatures = [];

for (let operationIndex = 0; operationIndex < operations.length; operationIndex += 1) {
  const built = await exactTransaction(connection, context, operationIndex);
  const simulation = await rawSimulation(input.rpc, built.latest, built.wire);
  if (simulation.value.err !== null) {
    fail(`${operations[operationIndex][0]} simulation failed: ${JSON.stringify({
      err: simulation.value.err,
      logs: simulation.value.logs,
    })}`);
  }
  const signature = await connection.sendRawTransaction(built.wire, {
    // The exact signed bytes already passed the raw, signature-verifying
    // simulation above. RPC retransmission is signature-idempotent and avoids
    // losing a valid local-validator packet while finalized roots advance.
    skipPreflight: true,
    maxRetries: 5,
  });
  const landed = await finalizedTransaction(
    connection,
    signature,
    built.latest.value.lastValidBlockHeight,
  );
  signatures.push({
    operationIndex,
    operation: operations[operationIndex][0],
    signature,
    finalizedSlot: landed.slot,
    simulationSlot: simulation.context.slot,
    unitsConsumed: simulation.value.unitsConsumed,
  });
}

// Operation 7 has a readonly signer distinct from the fee payer, so removing
// that signer bit reaches the program and cannot be upgraded by fee-payer
// message semantics.
const hostile = await exactTransaction(connection, context, 7, true);
const hostileSimulation = await rawSimulation(input.rpc, hostile.latest, hostile.wire);
const hostileError = hostileSimulation.value.err?.InstructionError?.[1]?.Custom;
if (hostileError !== 3) fail("hostile signer drift did not fail with SignerMismatch");

console.log(JSON.stringify({
  schema: SCHEMA,
  status: "PASS",
  mode: "loopback-local-validator",
  publicNetworkWrites: false,
  programId: context.program.toBase58(),
  artifact: { bytes: artifact.length, sha256: artifactSha256 },
  operationCount: signatures.length,
  signatures,
  hostileSignerDrift: {
    rejected: true,
    customError: hostileError,
    simulationSlot: hostileSimulation.context.slot,
  },
  writesExecutedByEconomyProgram: false,
  anyHandlerComplete: false,
  mainnetStatus: "HOLD",
}));

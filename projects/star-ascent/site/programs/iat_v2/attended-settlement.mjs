import { Buffer } from "buffer";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SHA256 = /^[0-9a-f]{64}$/u;

export const IAT_V2_WEEK9_STANDARD_SETTLEMENT = Object.freeze({
  network: "devnet",
  rpc: "https://api.devnet.solana.com",
  commitment: "finalized",
  programId: "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj",
  programData: "6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP",
  programArtifactSha256: "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7",
  programArtifactBytes: 597_336,
  programDeploymentSlot: 480_117_343,
  requiredSigner: "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
  mint: "CAJGkRQWXvJrUxK91XBPereaVSAUGzUY4yagxRKJdKUE",
  config: "9sqs4iAD9HBUA5a8L8eV39B1KepKb9jrRW3hAzvsPTBP",
  position: "5U8YH3SVgqYXjCYWe9wPuVjEc7NsFdKdQ53C3itWFmJs",
  positionId: 1n,
  week: 9n,
  vaultAuthority: "HeU35BJmunGc7n9YR7A2o25AsZmdCx6u6c96T9uN6SVx",
  destinationToken: "7bTXjkXABn5DQpk7owvXhk89eCpDfpwLhAXugD3KJsjg",
  treasuryState: "DYEU8V3uqPCiA7rh6MYVoceNhEUYBJJLWXyMz3CpKioa",
  treasuryToken: "GsrkTabdaknTu9Psv96zyF8zDn23VEZkrLDQaJsWFrYe",
  ecosystemState: "6k6U8Y4w7qpc9m9MU7zcGKxa6nDSd72ddhYmsLp5Pg3M",
  ecosystemToken: "EowV6HyQ56SKrgcxHCbvr6HkhB1JQJaSaA1kLUpSE8qg",
  liquidityState: "HgPrELVPRUWaGnMdKw7s1Gjuvo76AA2hsPXRgouTwa87",
  liquidityToken: "GGBfqRvL8L4MKCfFTd2jfdGgobfjcCQUKsM3MNynexe7",
  tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  instructionDataHex: "f6bed573577c803f0900000000000000",
  expectedFeeLamports: 5_000n,
  // The attended path is pinned to the deployed 634d artifact, whose
  // PositionWeekAlreadySettled Anchor error number is 6040.
  replayCustomError: 6_040,
});

export const IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS = Object.freeze([
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner, signer: true, writable: false }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.config, signer: false, writable: false }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.position, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId, signer: false, writable: false }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.mint, signer: false, writable: false }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.vaultAuthority, signer: false, writable: false }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.treasuryState, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.treasuryToken, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.ecosystemState, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.ecosystemToken, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.liquidityState, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.liquidityToken, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.destinationToken, signer: false, writable: true }),
  Object.freeze({ address: IAT_V2_WEEK9_STANDARD_SETTLEMENT.tokenProgram, signer: false, writable: false }),
]);

export const IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS = Object.freeze([
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.config,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.position,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.treasuryState,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.treasuryToken,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.ecosystemState,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.ecosystemToken,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.liquidityState,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.liquidityToken,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.destinationToken,
]);

export const IAT_V2_WEEK9_STANDARD_PRE_STATE = Object.freeze({
  config: Object.freeze({
    admin: IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner,
    mint: IAT_V2_WEEK9_STANDARD_SETTLEMENT.mint,
    genesisTimestamp: 1_780_636_775n,
    active: true,
    rehearsalMode: true,
    stakedPrincipal: 30_000_000_000n,
  }),
  position: Object.freeze({
    config: IAT_V2_WEEK9_STANDARD_SETTLEMENT.config,
    owner: IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner,
    positionId: 1n,
    principal: 10_000_000_000n,
    acceptedWeek: 7n,
    firstAccrualWeek: 8n,
    termWeeks: 52n,
    annualRateBps: 1_000n,
    treasuryReserved: 980_769_231n,
    ecosystemReserved: 0n,
    liquidityReserved: 0n,
    paid: 19_230_769n,
    settledMask: 1n,
    agencyIndex: 0xffff_ffff,
    role: 0,
    principalReturned: false,
    closed: false,
  }),
  lanes: Object.freeze({
    treasury: Object.freeze({ reserved: 39_400_000_002n, paid: 399_999_998n, principalClaimed: 0n }),
    ecosystem: Object.freeze({ reserved: 0n, paid: 0n, principalClaimed: 0n }),
    liquidity: Object.freeze({ reserved: 0n, paid: 0n, principalClaimed: 12_500_000_000n }),
  }),
  tokenBalances: Object.freeze({
    destination: 470_073_076_922n,
    treasury: 199_600_000_002n,
    ecosystem: 150_000_000_000n,
    liquidity: 37_500_000_000n,
  }),
  signerLamports: 4_201_198_718n,
});

function fail(message) {
  throw new Error(`Week-9 attended settlement HOLD: ${message}`);
}

function address(value, label) {
  const normalized = typeof value === "string"
    ? value
    : typeof value?.toBase58 === "function"
      ? value.toBase58()
      : null;
  if (!normalized || !BASE58.test(normalized)) fail(`${label} is not a Solana address`);
  return normalized;
}

function integer(value, label) {
  try {
    const normalized = BigInt(value);
    if (normalized < 0n) fail(`${label} must be unsigned`);
    return normalized;
  } catch {
    fail(`${label} is not an integer`);
  }
}

function safeNumber(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is not a safe unsigned integer`);
  return value;
}

function byteArray(value, label) {
  if (!(value instanceof Uint8Array) || value.length === 0) fail(`${label} is empty`);
  return value;
}

function hex(value) {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeBase58(value) {
  const bytes = byteArray(value, "signature bytes");
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return `${"1".repeat(leadingZeroes)}${digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join("")}`;
}

function assertLegacyWireContainsExactMessage(wireValue, expectedMessage) {
  const wire = byteArray(wireValue, "serialized transaction wire bytes");
  let signatureCount = 0;
  let shift = 0;
  let cursor = 0;
  for (; cursor < 3; cursor += 1) {
    const byte = wire[cursor];
    if (byte === undefined) fail("serialized transaction has a truncated signature count");
    signatureCount |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      cursor += 1;
      break;
    }
    shift += 7;
  }
  if (cursor !== 1 || signatureCount !== 1) {
    fail("serialized legacy transaction must encode exactly one signature canonically");
  }
  const messageOffset = cursor + 64;
  if (wire.length !== messageOffset + expectedMessage.length) {
    fail("serialized transaction wire length does not bind the reviewed message");
  }
  const wireMessage = wire.subarray(messageOffset);
  if (!Buffer.from(wireMessage).equals(Buffer.from(expectedMessage))) {
    fail("serialized transaction wire contains different message bytes");
  }
}

function assertEqual(actual, expected, label) {
  if (typeof expected === "bigint") {
    if (integer(actual, label) !== expected) fail(`${label} changed`);
  } else if (actual !== expected) {
    fail(`${label} changed`);
  }
}

function assertExactObject(actual, expected, label) {
  if (!actual || typeof actual !== "object") fail(`${label} is missing`);
  for (const [key, value] of Object.entries(expected)) {
    const candidate = typeof value === "string" && BASE58.test(value)
      ? address(actual[key], `${label}.${key}`)
      : actual[key];
    assertEqual(candidate, value, `${label}.${key}`);
  }
}

function maximumReward(principal, annualRateBps, weeks) {
  return (principal * annualRateBps * weeks) / 520_000n;
}

function expectedPostState(preState) {
  const position = preState.position;
  const ordinal = IAT_V2_WEEK9_STANDARD_SETTLEMENT.week - integer(position.firstAccrualWeek, "position.firstAccrualWeek");
  const bit = 1n << ordinal;
  const principal = integer(position.principal, "position.principal");
  const annualRateBps = integer(position.annualRateBps, "position.annualRateBps");
  const reward = maximumReward(principal, annualRateBps, ordinal + 1n)
    - maximumReward(principal, annualRateBps, ordinal);
  let remaining = reward;
  const treasuryPaid = integer(position.treasuryReserved, "position.treasuryReserved") < remaining
    ? integer(position.treasuryReserved, "position.treasuryReserved")
    : remaining;
  remaining -= treasuryPaid;
  const ecosystemPaid = integer(position.ecosystemReserved, "position.ecosystemReserved") < remaining
    ? integer(position.ecosystemReserved, "position.ecosystemReserved")
    : remaining;
  remaining -= ecosystemPaid;
  const liquidityPaid = integer(position.liquidityReserved, "position.liquidityReserved") < remaining
    ? integer(position.liquidityReserved, "position.liquidityReserved")
    : remaining;
  remaining -= liquidityPaid;
  if (remaining !== 0n) fail("reward exceeds the position reservation");

  return {
    reward,
    ordinal,
    bit,
    position: {
      ...position,
      treasuryReserved: integer(position.treasuryReserved, "position.treasuryReserved") - treasuryPaid,
      ecosystemReserved: integer(position.ecosystemReserved, "position.ecosystemReserved") - ecosystemPaid,
      liquidityReserved: integer(position.liquidityReserved, "position.liquidityReserved") - liquidityPaid,
      paid: integer(position.paid, "position.paid") + reward,
      settledMask: integer(position.settledMask, "position.settledMask") | bit,
    },
    lanes: {
      treasury: {
        ...preState.lanes.treasury,
        reserved: integer(preState.lanes.treasury.reserved, "lanes.treasury.reserved") - treasuryPaid,
        paid: integer(preState.lanes.treasury.paid, "lanes.treasury.paid") + treasuryPaid,
      },
      ecosystem: {
        ...preState.lanes.ecosystem,
        reserved: integer(preState.lanes.ecosystem.reserved, "lanes.ecosystem.reserved") - ecosystemPaid,
        paid: integer(preState.lanes.ecosystem.paid, "lanes.ecosystem.paid") + ecosystemPaid,
      },
      liquidity: {
        ...preState.lanes.liquidity,
        reserved: integer(preState.lanes.liquidity.reserved, "lanes.liquidity.reserved") - liquidityPaid,
        paid: integer(preState.lanes.liquidity.paid, "lanes.liquidity.paid") + liquidityPaid,
      },
    },
    tokenBalances: {
      destination: integer(preState.tokenBalances.destination, "tokenBalances.destination") + reward,
      treasury: integer(preState.tokenBalances.treasury, "tokenBalances.treasury") - treasuryPaid,
      ecosystem: integer(preState.tokenBalances.ecosystem, "tokenBalances.ecosystem") - ecosystemPaid,
      liquidity: integer(preState.tokenBalances.liquidity, "tokenBalances.liquidity") - liquidityPaid,
    },
    signerLamports: integer(preState.signerLamports, "signerLamports")
      - IAT_V2_WEEK9_STANDARD_SETTLEMENT.expectedFeeLamports,
    lanePayments: { treasury: treasuryPaid, ecosystem: ecosystemPaid, liquidity: liquidityPaid },
  };
}

function assertPinnedPreState(observation, label = "preState") {
  if (observation?.commitment !== "finalized") fail(`${label} is not finalized`);
  safeNumber(observation.contextSlot, `${label}.contextSlot`);
  assertEqual(observation.currentWeek, 9n, `${label}.currentWeek`);
  assertExactObject(observation.config, IAT_V2_WEEK9_STANDARD_PRE_STATE.config, `${label}.config`);
  assertExactObject(observation.position, IAT_V2_WEEK9_STANDARD_PRE_STATE.position, `${label}.position`);
  for (const lane of ["treasury", "ecosystem", "liquidity"]) {
    assertExactObject(observation.lanes?.[lane], IAT_V2_WEEK9_STANDARD_PRE_STATE.lanes[lane], `${label}.lanes.${lane}`);
  }
  assertExactObject(observation.tokenBalances, IAT_V2_WEEK9_STANDARD_PRE_STATE.tokenBalances, `${label}.tokenBalances`);
  assertEqual(observation.signerLamports, IAT_V2_WEEK9_STANDARD_PRE_STATE.signerLamports, `${label}.signerLamports`);
  return expectedPostState(observation);
}

function assertPostState(observation, expected, minimumSlot, label = "postState") {
  if (observation?.commitment !== "finalized") fail(`${label} is not finalized`);
  const slot = safeNumber(observation.contextSlot, `${label}.contextSlot`);
  if (slot < minimumSlot) fail(`${label} predates the finalized transaction`);
  assertExactObject(observation.config, IAT_V2_WEEK9_STANDARD_PRE_STATE.config, `${label}.config`);
  assertExactObject(observation.position, expected.position, `${label}.position`);
  for (const lane of ["treasury", "ecosystem", "liquidity"]) {
    assertExactObject(observation.lanes?.[lane], expected.lanes[lane], `${label}.lanes.${lane}`);
  }
  assertExactObject(observation.tokenBalances, expected.tokenBalances, `${label}.tokenBalances`);
  assertEqual(observation.signerLamports, expected.signerLamports, `${label}.signerLamports`);
}

function assertProgramDeployment(deployment) {
  if (deployment?.commitment !== "finalized") fail("program deployment observation is not finalized");
  assertEqual(address(deployment.programId, "programId"), IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId, "programId");
  assertEqual(address(deployment.programData, "programData"), IAT_V2_WEEK9_STANDARD_SETTLEMENT.programData, "programData");
  assertEqual(address(deployment.upgradeAuthority, "upgradeAuthority"), IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner, "upgradeAuthority");
  assertEqual(deployment.executable, true, "program executable flag");
  assertEqual(deployment.artifactSha256, IAT_V2_WEEK9_STANDARD_SETTLEMENT.programArtifactSha256, "program artifact hash");
  assertEqual(deployment.artifactBytes, IAT_V2_WEEK9_STANDARD_SETTLEMENT.programArtifactBytes, "program artifact bytes");
  assertEqual(deployment.deploymentSlot, IAT_V2_WEEK9_STANDARD_SETTLEMENT.programDeploymentSlot, "program deployment slot");
}

function assertInstruction(instruction) {
  assertEqual(address(instruction?.programId, "instruction program"), IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId, "instruction program");
  const data = byteArray(instruction?.data, "instruction data");
  assertEqual(hex(data), IAT_V2_WEEK9_STANDARD_SETTLEMENT.instructionDataHex, "instruction data");
  if (!Array.isArray(instruction.keys) || instruction.keys.length !== IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS.length) {
    fail("instruction account count changed");
  }
  instruction.keys.forEach((meta, index) => {
    const expected = IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS[index];
    assertEqual(address(meta.pubkey ?? meta.address, `instruction account ${index}`), expected.address, `instruction account ${index}`);
    assertEqual(meta.isSigner ?? meta.signer, expected.signer, `instruction account ${index} signer flag`);
    assertEqual(meta.isWritable ?? meta.writable, expected.writable, `instruction account ${index} writable flag`);
  });
}

async function inspectTransaction(transaction, sha256Hex) {
  if (!transaction || typeof transaction.serializeMessage !== "function") fail("transaction cannot serialize its message");
  assertEqual(address(transaction.feePayer, "fee payer"), IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner, "fee payer");
  if (typeof transaction.recentBlockhash !== "string" || !BASE58.test(transaction.recentBlockhash)) {
    fail("transaction recent blockhash is missing");
  }
  if (!Array.isArray(transaction.instructions) || transaction.instructions.length !== 1) {
    fail("transaction must contain exactly one instruction");
  }
  assertInstruction(transaction.instructions[0]);
  const messageBytes = byteArray(transaction.serializeMessage(), "transaction message");
  const digest = await sha256Hex(messageBytes);
  if (!SHA256.test(digest)) fail("message SHA-256 helper returned an invalid digest");
  return {
    recentBlockhash: transaction.recentBlockhash,
    messageBytes,
    messageHex: hex(messageBytes),
    messageSha256: digest,
  };
}

function assertRequiredSignature(transaction) {
  if (typeof transaction?.verifySignatures !== "function" || transaction.verifySignatures() !== true) {
    fail("signed transaction failed local signature verification");
  }
  if (!Array.isArray(transaction.signatures) || transaction.signatures.length !== 1) {
    fail("signed transaction must contain exactly one required signer");
  }
  const [entry] = transaction.signatures;
  assertEqual(
    address(entry.publicKey, "transaction signature public key"),
    IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner,
    "transaction signature public key",
  );
  if (!(entry.signature instanceof Uint8Array)
    || entry.signature.length !== 64
    || entry.signature.every((byte) => byte === 0)) {
    fail("required Model T signature is missing or invalid");
  }
  return encodeBase58(entry.signature);
}

export async function buildExactIatV2Week9SimulationRpcRequest({
  transaction,
  sha256Hex,
  sigVerify,
  minContextSlot,
} = {}) {
  if (typeof sigVerify !== "boolean") fail("simulation sigVerify must be explicit");
  const inspected = await inspectTransaction(transaction, sha256Hex);
  if (sigVerify) assertRequiredSignature(transaction);
  if (typeof transaction?.serialize !== "function") fail("transaction cannot serialize its wire bytes");
  const wire = transaction.serialize({
    requireAllSignatures: sigVerify,
    verifySignatures: sigVerify,
  });
  assertLegacyWireContainsExactMessage(wire, inspected.messageBytes);
  const after = await inspectTransaction(transaction, sha256Hex);
  assertEqual(after.messageSha256, inspected.messageSha256, "message digest after wire serialization");
  assertEqual(after.messageHex, inspected.messageHex, "message bytes after wire serialization");
  assertEqual(after.recentBlockhash, inspected.recentBlockhash, "recent blockhash after wire serialization");
  const contextSlot = safeNumber(minContextSlot, "simulation minContextSlot");
  return Object.freeze({
    rpcRequest: Object.freeze({
      jsonrpc: "2.0",
      id: "iat-v2-week9-attended-settlement-simulation",
      method: "simulateTransaction",
      params: Object.freeze([
        Buffer.from(wire).toString("base64"),
        Object.freeze({
          encoding: "base64",
          commitment: "finalized",
          sigVerify,
          replaceRecentBlockhash: false,
          minContextSlot: contextSlot,
          accounts: Object.freeze({
            encoding: "base64",
            addresses: IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS,
          }),
        }),
      ]),
    }),
    messageSha256: inspected.messageSha256,
    messageHex: inspected.messageHex,
    recentBlockhash: inspected.recentBlockhash,
  });
}

function assertSimulation(
  simulation,
  expectedPost,
  minimumSlot,
  expectedMessageSha256,
  expectedRecentBlockhash,
  expectedSigVerify,
  label,
) {
  if (simulation?.err !== null) fail(`${label} failed`);
  assertEqual(simulation.replaceRecentBlockhash, false, `${label}.replaceRecentBlockhash`);
  assertEqual(simulation.sigVerify, expectedSigVerify, `${label}.sigVerify`);
  assertEqual(simulation.messageSha256, expectedMessageSha256, `${label}.messageSha256`);
  assertEqual(simulation.recentBlockhash, expectedRecentBlockhash, `${label}.recentBlockhash`);
  const slot = safeNumber(simulation.contextSlot, `${label}.contextSlot`);
  if (slot < minimumSlot) fail(`${label} predates the bound state`);
  const units = safeNumber(simulation.unitsConsumed, `${label}.unitsConsumed`);
  if (units === 0 || units > 200_000) fail(`${label} compute consumption is outside the reviewed limit`);
  if (!Array.isArray(simulation.logs)
    || !simulation.logs.includes(`Program ${IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId} success`)
    || !simulation.logs.includes("Program log: Instruction: SettlePositionWeek")) {
    fail(`${label} logs do not prove the reviewed instruction succeeded`);
  }
  assertPostState({ ...simulation.postState, commitment: "finalized" }, expectedPost, slot, `${label}.postState`);
}

export async function prepareIatV2Week9StandardSettlement({
  transaction,
  sha256Hex,
  programDeployment,
  preState,
  blockhash,
  feeLamports,
  simulation,
} = {}) {
  if (typeof sha256Hex !== "function") fail("SHA-256 helper is required");
  assertProgramDeployment(programDeployment);
  const expectedPost = assertPinnedPreState(preState);
  const inspected = await inspectTransaction(transaction, sha256Hex);
  assertEqual(inspected.recentBlockhash, blockhash?.blockhash, "bound recent blockhash");
  const blockhashContextSlot = safeNumber(blockhash?.contextSlot, "blockhash.contextSlot");
  if (blockhashContextSlot < preState.contextSlot) fail("blockhash predates the finalized pre-state");
  const lastValidBlockHeight = safeNumber(blockhash?.lastValidBlockHeight, "blockhash.lastValidBlockHeight");
  assertEqual(feeLamports, IAT_V2_WEEK9_STANDARD_SETTLEMENT.expectedFeeLamports, "transaction fee");
  assertSimulation(
    simulation,
    expectedPost,
    preState.contextSlot,
    inspected.messageSha256,
    inspected.recentBlockhash,
    false,
    "pre-sign simulation",
  );
  return Object.freeze({
    schema: "iat-v2-week9-attended-standard-settlement/v1",
    status: "SIMULATED_NOT_SIGNED_NOT_BROADCAST",
    identity: IAT_V2_WEEK9_STANDARD_SETTLEMENT,
    preState,
    expectedPost,
    blockhash: Object.freeze({
      blockhash: blockhash.blockhash,
      contextSlot: blockhashContextSlot,
      lastValidBlockHeight,
    }),
    feeLamports: IAT_V2_WEEK9_STANDARD_SETTLEMENT.expectedFeeLamports,
    messageBytes: inspected.messageBytes,
    messageHex: inspected.messageHex,
    messageSha256: inspected.messageSha256,
    simulationSlot: simulation.contextSlot,
    unitsConsumed: simulation.unitsConsumed,
  });
}

export async function assertIatV2Week9BroadcastReady({
  review,
  signedTransaction,
  sha256Hex,
  latestBlockHeight,
  revalidatedPreState,
  simulation,
} = {}) {
  if (review?.status !== "SIMULATED_NOT_SIGNED_NOT_BROADCAST") fail("preparation review is missing");
  assertRequiredSignature(signedTransaction);
  const inspected = await inspectTransaction(signedTransaction, sha256Hex);
  assertEqual(inspected.messageSha256, review.messageSha256, "signed transaction message digest");
  assertEqual(inspected.messageHex, review.messageHex, "signed transaction message bytes");
  const height = safeNumber(latestBlockHeight, "latestBlockHeight");
  if (height > review.blockhash.lastValidBlockHeight) fail("signed transaction blockhash expired");
  const expectedPost = assertPinnedPreState(revalidatedPreState, "revalidatedPreState");
  if (revalidatedPreState.contextSlot < review.preState.contextSlot) fail("revalidated pre-state moved backwards");
  assertSimulation(
    simulation,
    expectedPost,
    revalidatedPreState.contextSlot,
    inspected.messageSha256,
    inspected.recentBlockhash,
    true,
    "pre-broadcast simulation",
  );
  return Object.freeze({
    ...review,
    status: "SIGNED_SIMULATED_READY_FOR_ONE_BROADCAST",
    broadcastCountAllowed: 1,
    revalidationSlot: revalidatedPreState.contextSlot,
    preBroadcastSimulationSlot: simulation.contextSlot,
  });
}

export async function finalizeIatV2Week9StandardSettlement({
  review,
  signedTransaction,
  finalizedTransaction,
  sha256Hex,
  signature,
  transactionResult,
  localBroadcastReceipts,
  postState,
  replayTransaction,
  replaySimulation,
} = {}) {
  if (review?.status !== "SIGNED_SIMULATED_READY_FOR_ONE_BROADCAST") fail("one-broadcast review is missing");
  const signedTransactionSignature = assertRequiredSignature(signedTransaction);
  const inspected = await inspectTransaction(signedTransaction, sha256Hex);
  assertEqual(inspected.messageSha256, review.messageSha256, "finalized transaction message digest");
  if (typeof signature !== "string" || signature.length < 80 || signature.length > 90 || !BASE58.test(signature)) {
    fail("finalized transaction signature is invalid");
  }
  assertEqual(signature, signedTransactionSignature, "returned signature versus signed transaction");
  const finalizedTransactionSignature = assertRequiredSignature(finalizedTransaction);
  assertEqual(finalizedTransactionSignature, signature, "finalized chain transaction signature");
  const inspectedFinalized = await inspectTransaction(finalizedTransaction, sha256Hex);
  assertEqual(inspectedFinalized.messageSha256, review.messageSha256, "finalized chain message digest");
  assertEqual(inspectedFinalized.messageHex, review.messageHex, "finalized chain message bytes");
  if (transactionResult?.commitment !== "finalized" || transactionResult.err !== null) {
    fail("transaction did not finalize successfully");
  }
  assertEqual(transactionResult.signature, signature, "finalized transaction signature");
  if (!Array.isArray(localBroadcastReceipts) || localBroadcastReceipts.length !== 1) {
    fail("local attended workflow must record exactly one broadcast receipt");
  }
  assertEqual(localBroadcastReceipts[0]?.method, "sendRawTransaction", "local broadcast method");
  assertEqual(localBroadcastReceipts[0]?.signature, signature, "local broadcast receipt signature");
  const finalizedSlot = safeNumber(transactionResult.slot, "transactionResult.slot");
  assertEqual(transactionResult.feeLamports, IAT_V2_WEEK9_STANDARD_SETTLEMENT.expectedFeeLamports, "finalized transaction fee");
  assertPostState(postState, review.expectedPost, finalizedSlot);
  const inspectedReplay = await inspectTransaction(replayTransaction, sha256Hex);
  if (inspectedReplay.recentBlockhash === review.blockhash.blockhash) {
    fail("replay transaction must use a fresh blockhash");
  }
  assertEqual(replaySimulation.messageSha256, inspectedReplay.messageSha256, "replay simulation message digest");
  assertEqual(replaySimulation.recentBlockhash, inspectedReplay.recentBlockhash, "replay simulation recent blockhash");
  assertEqual(replaySimulation.replaceRecentBlockhash, false, "replay simulation replaceRecentBlockhash");
  assertEqual(replaySimulation.sigVerify, false, "replay simulation sigVerify");
  if (replaySimulation?.err?.InstructionError?.[1]?.Custom !== IAT_V2_WEEK9_STANDARD_SETTLEMENT.replayCustomError) {
    fail("fresh replay did not reject with PositionWeekAlreadySettled");
  }
  if (safeNumber(replaySimulation.contextSlot, "replaySimulation.contextSlot") < postState.contextSlot) {
    fail("replay simulation predates finalized post-state");
  }
  if (!Array.isArray(replaySimulation.logs)
    || !replaySimulation.logs.some((line) => line.includes("PositionWeekAlreadySettled"))) {
    fail("replay logs do not name PositionWeekAlreadySettled");
  }
  assertPostState(
    { ...replaySimulation.postState, commitment: "finalized" },
    review.expectedPost,
    postState.contextSlot,
    "replaySimulation.postState",
  );
  return Object.freeze({
    schema: "iat-v2-week9-attended-standard-settlement-evidence/v1",
    status: "FINALIZED_AND_REPLAY_REJECTED",
    signature,
    finalizedSlot,
    messageSha256: review.messageSha256,
    messageHex: review.messageHex,
    feeLamports: review.feeLamports,
    expectedRewardBaseUnits: review.expectedPost.reward,
    resultingSettledMask: review.expectedPost.position.settledMask,
    replayCustomError: IAT_V2_WEEK9_STANDARD_SETTLEMENT.replayCustomError,
    localBroadcastReceiptCount: localBroadcastReceipts.length,
  });
}

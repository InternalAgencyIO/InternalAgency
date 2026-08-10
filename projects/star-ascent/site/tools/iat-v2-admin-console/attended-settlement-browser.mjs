import { Buffer } from "buffer";
import {
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  buildExactIatV2Week9SimulationRpcRequest,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT,
  IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS,
} from "../../programs/iat_v2/attended-settlement.mjs";
import {
  buildSettlePositionWeekInstruction,
  parseLaneVaultAccount,
  parsePositionAccount,
} from "../../programs/iat_v2/feature-instructions.mjs";
import { currentIatV2Week } from "../../programs/iat_v2/feature-rehearsal.mjs";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  TOKEN_PROGRAM_ID,
  inspectReviewedUpgradeableProgramArtifact,
  parseUpgradeableProgramAccounts,
  parseUpgradeableProgramData,
  parseV2ConfigAccount,
} from "../../programs/iat_v2/instructions.mjs";
import { decodeOriginalTokenAccountInfo } from "./original-token-decode.mjs";

const PINNED_RPC = IAT_V2_WEEK9_STANDARD_SETTLEMENT.rpc;
const FINALIZED = IAT_V2_WEEK9_STANDARD_SETTLEMENT.commitment;
const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
const SYSVAR_PROGRAM = new PublicKey("Sysvar1111111111111111111111111111111111111");
const CLOCK_SYSVAR = new PublicKey("SysvarC1ock11111111111111111111111111111111");
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const RPC_TIMEOUT_MS = 20_000;
const FINALIZATION_TIMEOUT_MS = 120_000;
const FINALIZATION_POLL_MS = 1_000;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const PROGRAM_ID = new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId);
const PROGRAM_DATA = new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.programData);
const REQUIRED_SIGNER = new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner);
const MINT = new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.mint);
const DESTINATION_TOKEN = new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.destinationToken);
const VAULT_AUTHORITY = new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.vaultAuthority);

const EXACT_ACCOUNT_LAYOUTS = Object.freeze({
  config: Object.freeze({ bytes: 234, discriminatorHex: "9b0caae01efacc82" }),
  position: Object.freeze({ bytes: 168, discriminatorHex: "aabc8fe47a40f7d0" }),
  lane: Object.freeze({ bytes: 164, discriminatorHex: "70c7860384a695b9" }),
});

export const IAT_V2_WEEK9_OBSERVATION_ACCOUNTS = Object.freeze([
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT.programData,
  ...IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS,
  CLOCK_SYSVAR.toBase58(),
]);

let rpcSequence = 0;

function hold(message) {
  throw new Error(`Week-9 attended browser HOLD: ${message}`);
}

function safeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) hold(`${label} is not a safe unsigned integer`);
  return value;
}

function encodeBase58(value) {
  const bytes = Buffer.from(value);
  if (bytes.length === 0) return "";
  let numeric = 0n;
  for (const byte of bytes) numeric = (numeric << 8n) | BigInt(byte);
  let encoded = "";
  while (numeric > 0n) {
    encoded = BASE58_ALPHABET[Number(numeric % 58n)] + encoded;
    numeric /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + encoded;
}

function address(value, label) {
  try {
    return new PublicKey(value);
  } catch {
    hold(`${label} is not a Solana address`);
  }
}

function bytesFromRpcData(data, label) {
  if (!Array.isArray(data) || data.length !== 2 || data[1] !== "base64" || typeof data[0] !== "string") {
    hold(`${label} is not exact base64 account data`);
  }
  const bytes = Buffer.from(data[0], "base64");
  if (bytes.toString("base64") !== data[0]) hold(`${label} is not canonical base64`);
  return bytes;
}

function rpcAccount(value, expectedAddress, label) {
  if (!value || typeof value !== "object") hold(`${label} is missing`);
  const lamports = safeInteger(value.lamports, `${label}.lamports`);
  return {
    address: address(expectedAddress, `${label}.address`),
    data: bytesFromRpcData(value.data, `${label}.data`),
    executable: value.executable === true,
    lamports,
    owner: address(value.owner, `${label}.owner`),
    rentEpoch: value.rentEpoch,
  };
}

function assertOwner(info, expected, label) {
  if (!info.owner.equals(expected)) hold(`${label} has the wrong owner`);
}

function assertAnchorAccount(info, layout, label) {
  if (info.data.length !== layout.bytes) hold(`${label} has the wrong byte length`);
  if (info.data.subarray(0, 8).toString("hex") !== layout.discriminatorHex) {
    hold(`${label} has the wrong Anchor discriminator`);
  }
}

function assertPublicKey(actual, expected, label) {
  if (!actual?.equals?.(expected)) hold(`${label} changed`);
}

function normalizePublicKeys(value) {
  if (value instanceof PublicKey) return value.toBase58();
  if (Array.isArray(value)) return value.map(normalizePublicKeys);
  if (value && typeof value === "object" && !ArrayBuffer.isView(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizePublicKeys(item)]),
    );
  }
  return value;
}

function stateFromAccounts(values, contextSlot, commitment) {
  if (!Array.isArray(values) || values.length !== IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS.length) {
    hold("state observation has the wrong account count");
  }
  const infos = values.map((value, index) => rpcAccount(
    value,
    IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS[index],
    `state account ${index}`,
  ));
  const [
    signerInfo,
    configInfo,
    positionInfo,
    treasuryStateInfo,
    treasuryTokenInfo,
    ecosystemStateInfo,
    ecosystemTokenInfo,
    liquidityStateInfo,
    liquidityTokenInfo,
    destinationTokenInfo,
  ] = infos;
  assertOwner(signerInfo, SYSTEM_PROGRAM, "required signer");
  if (signerInfo.data.length !== 0 || signerInfo.executable) hold("required signer is not a system wallet");
  for (const [info, label] of [
    [configInfo, "config"],
    [positionInfo, "position"],
    [treasuryStateInfo, "treasury state"],
    [ecosystemStateInfo, "ecosystem state"],
    [liquidityStateInfo, "liquidity state"],
  ]) assertOwner(info, PROGRAM_ID, label);
  assertAnchorAccount(configInfo, EXACT_ACCOUNT_LAYOUTS.config, "config");
  assertAnchorAccount(positionInfo, EXACT_ACCOUNT_LAYOUTS.position, "position");
  assertAnchorAccount(treasuryStateInfo, EXACT_ACCOUNT_LAYOUTS.lane, "treasury state");
  assertAnchorAccount(ecosystemStateInfo, EXACT_ACCOUNT_LAYOUTS.lane, "ecosystem state");
  assertAnchorAccount(liquidityStateInfo, EXACT_ACCOUNT_LAYOUTS.lane, "liquidity state");
  const config = parseV2ConfigAccount(configInfo.data);
  const position = parsePositionAccount(positionInfo.data);
  const lanes = {
    treasury: parseLaneVaultAccount(treasuryStateInfo.data),
    ecosystem: parseLaneVaultAccount(ecosystemStateInfo.data),
    liquidity: parseLaneVaultAccount(liquidityStateInfo.data),
  };
  assertPublicKey(config.admin, REQUIRED_SIGNER, "config admin");
  assertPublicKey(config.mint, MINT, "config mint");
  assertPublicKey(config.tokenProgram, TOKEN_PROGRAM_ID, "config token program");
  assertPublicKey(position.config, new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.config), "position config");
  assertPublicKey(position.owner, REQUIRED_SIGNER, "position owner");
  const laneIdentity = [
    [lanes.treasury, IAT_V2_WEEK9_STANDARD_SETTLEMENT.treasuryToken, 1, "treasury"],
    [lanes.ecosystem, IAT_V2_WEEK9_STANDARD_SETTLEMENT.ecosystemToken, 2, "ecosystem"],
    [lanes.liquidity, IAT_V2_WEEK9_STANDARD_SETTLEMENT.liquidityToken, 4, "liquidity"],
  ];
  for (const [lane, tokenAddress, laneNumber, label] of laneIdentity) {
    assertPublicKey(lane.config, new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.config), `${label} lane config`);
    assertPublicKey(lane.tokenAccount, new PublicKey(tokenAddress), `${label} lane token account`);
    if (lane.lane !== laneNumber) hold(`${label} lane number changed`);
  }
  const token = (info, expectedAddress, label) => decodeOriginalTokenAccountInfo({
    address: new PublicKey(expectedAddress),
    info,
    programId: TOKEN_PROGRAM_ID,
    label,
  });
  const tokenAccounts = {
    treasury: token(treasuryTokenInfo, IAT_V2_WEEK9_STANDARD_SETTLEMENT.treasuryToken, "treasury token"),
    ecosystem: token(ecosystemTokenInfo, IAT_V2_WEEK9_STANDARD_SETTLEMENT.ecosystemToken, "ecosystem token"),
    liquidity: token(liquidityTokenInfo, IAT_V2_WEEK9_STANDARD_SETTLEMENT.liquidityToken, "liquidity token"),
    destination: token(destinationTokenInfo, IAT_V2_WEEK9_STANDARD_SETTLEMENT.destinationToken, "destination token"),
  };
  for (const [label, account] of Object.entries(tokenAccounts)) {
    assertPublicKey(account.mint, MINT, `${label} token mint`);
    assertPublicKey(
      account.owner,
      label === "destination" ? REQUIRED_SIGNER : VAULT_AUTHORITY,
      `${label} token authority`,
    );
    if (!account.isInitialized || account.isFrozen) hold(`${label} token state changed`);
  }
  const tokenBalances = Object.fromEntries(
    Object.entries(tokenAccounts).map(([label, account]) => [label, account.amount]),
  );
  return {
    commitment,
    contextSlot: safeInteger(contextSlot, "state context slot"),
    config: normalizePublicKeys(config),
    position: normalizePublicKeys(position),
    lanes: normalizePublicKeys(lanes),
    tokenBalances,
    signerLamports: BigInt(signerInfo.lamports),
  };
}

function exactRpcEnvelope(method, params) {
  rpcSequence += 1;
  return {
    jsonrpc: "2.0",
    id: `iat-v2-week9-browser-${rpcSequence}`,
    method,
    params,
  };
}

export async function postPinnedDevnetRpcEnvelope(envelope, {
  fetchImpl = globalThis.fetch,
  timeoutMs = RPC_TIMEOUT_MS,
} = {}) {
  if (!envelope || envelope.jsonrpc !== "2.0" || typeof envelope.id !== "string") {
    hold("RPC envelope is not exact JSON-RPC 2.0");
  }
  if (typeof fetchImpl !== "function") hold("fetch is unavailable");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(PINNED_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response?.ok) hold(`RPC HTTP status is ${response?.status ?? "unavailable"}`);
  const payload = await response.json();
  if (payload?.jsonrpc !== "2.0" || payload.id !== envelope.id) hold("RPC response identity changed");
  if (payload.error) hold(`RPC ${envelope.method} failed: ${JSON.stringify(payload.error)}`);
  if (!("result" in payload)) hold(`RPC ${envelope.method} returned no result`);
  return payload.result;
}

async function rpc(method, params, options) {
  return postPinnedDevnetRpcEnvelope(exactRpcEnvelope(method, params), options);
}

export function buildIatV2Week9StandardTransaction(recentBlockhash) {
  if (typeof recentBlockhash !== "string" || !BASE58.test(recentBlockhash)) {
    hold("recent blockhash is not a Solana hash");
  }
  return new Transaction({
    feePayer: REQUIRED_SIGNER,
    recentBlockhash,
  }).add(buildSettlePositionWeekInstruction({
    caller: REQUIRED_SIGNER,
    mint: MINT,
    positionOwner: REQUIRED_SIGNER,
    positionId: IAT_V2_WEEK9_STANDARD_SETTLEMENT.positionId,
    destinationTokens: DESTINATION_TOKEN,
    week: IAT_V2_WEEK9_STANDARD_SETTLEMENT.week,
    round: null,
  }));
}

export async function observeFinalizedIatV2Week9State({
  minContextSlot,
  sha256Hex,
  fetchImpl,
} = {}) {
  const genesisHash = await rpc("getGenesisHash", [], { fetchImpl });
  if (genesisHash !== DEVNET_GENESIS_HASH) hold("RPC is not the pinned Solana Devnet genesis");
  const config = { commitment: FINALIZED, encoding: "base64" };
  if (minContextSlot !== undefined) config.minContextSlot = safeInteger(minContextSlot, "minimum context slot");
  const result = await rpc("getMultipleAccounts", [IAT_V2_WEEK9_OBSERVATION_ACCOUNTS, config], { fetchImpl });
  const contextSlot = safeInteger(result?.context?.slot, "observation context slot");
  if (!Array.isArray(result?.value) || result.value.length !== IAT_V2_WEEK9_OBSERVATION_ACCOUNTS.length) {
    hold("finalized observation returned the wrong account count");
  }
  const [programValue, programDataValue, ...remainingValues] = result.value;
  const stateValues = remainingValues.slice(0, IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS.length);
  const clockValue = remainingValues[IAT_V2_WEEK9_STANDARD_SIMULATION_ACCOUNTS.length];
  const programInfo = rpcAccount(programValue, IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId, "program");
  const programDataInfo = rpcAccount(programDataValue, IAT_V2_WEEK9_STANDARD_SETTLEMENT.programData, "ProgramData");
  assertOwner(programInfo, BPF_UPGRADEABLE_LOADER_ID, "program");
  assertOwner(programDataInfo, BPF_UPGRADEABLE_LOADER_ID, "ProgramData");
  if (!programInfo.executable) hold("program is not executable");
  parseUpgradeableProgramAccounts({
    programData: programInfo.data,
    programDataAddress: PROGRAM_DATA,
  });
  const parsedProgramData = parseUpgradeableProgramData(programDataInfo.data);
  const artifact = await inspectReviewedUpgradeableProgramArtifact({
    programBytes: parsedProgramData.programBytes,
    sha256Hex,
  });
  if (!artifact.matchesReviewedArtifact || artifact.loaderPaddingBytes !== 0) {
    hold("deployed program is not the exact pinned 634d artifact");
  }
  const clockInfo = rpcAccount(clockValue, CLOCK_SYSVAR, "finalized Clock sysvar");
  assertOwner(clockInfo, SYSVAR_PROGRAM, "finalized Clock sysvar");
  if (clockInfo.data.length !== 40 || clockInfo.executable) hold("finalized Clock sysvar layout changed");
  const blockTime = Number(clockInfo.data.readBigInt64LE(32));
  safeInteger(blockTime, "finalized Clock unix timestamp");
  const state = stateFromAccounts(stateValues, contextSlot, FINALIZED);
  const currentWeek = currentIatV2Week(state.config.genesisTimestamp, safeInteger(blockTime, "observation block time"));
  if (currentWeek === null) hold("finalized observation predates Genesis");
  state.currentWeek = BigInt(currentWeek);
  return {
    blockTime,
    programDeployment: {
      commitment: FINALIZED,
      programId: PROGRAM_ID,
      programData: PROGRAM_DATA,
      upgradeAuthority: parsedProgramData.upgradeAuthority,
      executable: true,
      artifactSha256: artifact.artifactSha256,
      artifactBytes: artifact.artifactBytes,
      deploymentSlot: safeInteger(Number(parsedProgramData.slot), "program deployment slot"),
    },
    preState: state,
  };
}

export async function fetchFinalizedBlockhashAndFee({
  minContextSlot,
  transactionFactory = buildIatV2Week9StandardTransaction,
  fetchImpl,
} = {}) {
  const minimum = safeInteger(minContextSlot, "minimum context slot");
  const latest = await rpc("getLatestBlockhash", [{
    commitment: FINALIZED,
    minContextSlot: minimum,
  }], { fetchImpl });
  const contextSlot = safeInteger(latest?.context?.slot, "blockhash context slot");
  const blockhash = latest?.value?.blockhash;
  const lastValidBlockHeight = safeInteger(latest?.value?.lastValidBlockHeight, "last valid block height");
  const transaction = transactionFactory(blockhash);
  const messageBase64 = Buffer.from(transaction.serializeMessage()).toString("base64");
  const fee = await rpc("getFeeForMessage", [messageBase64, {
    commitment: FINALIZED,
    minContextSlot: contextSlot,
  }], { fetchImpl });
  if (fee?.value === null) hold("reviewed message fee is unavailable");
  const feeContextSlot = safeInteger(fee?.context?.slot, "fee context slot");
  if (feeContextSlot < contextSlot) hold("message fee observation predates the blockhash");
  return {
    transaction,
    blockhash: { blockhash, contextSlot, lastValidBlockHeight },
    feeLamports: BigInt(safeInteger(fee?.value, "message fee")),
    feeContextSlot,
  };
}

function simulationFromRpc(result, request, commitment = "simulation") {
  const value = result?.value;
  const contextSlot = safeInteger(result?.context?.slot, "simulation context slot");
  if (!value || !Array.isArray(value.accounts)) hold("simulation omitted exact account returns");
  return {
    contextSlot,
    err: value.err ?? null,
    logs: value.logs ?? [],
    unitsConsumed: safeInteger(value.unitsConsumed, "simulation units"),
    replaceRecentBlockhash: request.rpcRequest.params[1].replaceRecentBlockhash,
    sigVerify: request.rpcRequest.params[1].sigVerify,
    messageSha256: request.messageSha256,
    recentBlockhash: request.recentBlockhash,
    postState: stateFromAccounts(value.accounts, contextSlot, commitment),
  };
}

export async function simulateExactIatV2Week9Transaction({
  transaction,
  sha256Hex,
  sigVerify,
  minContextSlot,
  fetchImpl,
} = {}) {
  const request = await buildExactIatV2Week9SimulationRpcRequest({
    transaction,
    sha256Hex,
    sigVerify,
    minContextSlot,
  });
  // This exact frozen helper envelope is the only simulation body ever posted.
  const result = await postPinnedDevnetRpcEnvelope(request.rpcRequest, { fetchImpl });
  return {
    request,
    simulation: simulationFromRpc(result, request),
  };
}

export async function getFinalizedBlockHeight({ fetchImpl } = {}) {
  return safeInteger(
    await rpc("getBlockHeight", [{ commitment: FINALIZED }], { fetchImpl }),
    "finalized block height",
  );
}

export function signatureBase58FromSignedIatV2Week9Transaction(signedTransaction) {
  if (signedTransaction?.verifySignatures?.() !== true || signedTransaction.signatures?.length !== 1) {
    hold("signed transaction does not have one valid local signature");
  }
  const [entry] = signedTransaction.signatures;
  if (
    !entry.publicKey?.equals?.(REQUIRED_SIGNER)
    || !(entry.signature instanceof Uint8Array)
    || entry.signature.length !== 64
    || entry.signature.every((byte) => byte === 0)
  ) {
    hold("signed transaction is not signed by the pinned 7XZ account");
  }
  return encodeBase58(entry.signature);
}

export async function sendRawIatV2Week9TransactionOnce({
  signedTransaction,
  minContextSlot,
  fetchImpl,
} = {}) {
  const wire = signedTransaction.serialize({ requireAllSignatures: true, verifySignatures: true });
  const signature = await rpc("sendTransaction", [Buffer.from(wire).toString("base64"), {
    encoding: "base64",
    skipPreflight: false,
    preflightCommitment: FINALIZED,
    maxRetries: 0,
    minContextSlot: safeInteger(minContextSlot, "broadcast minimum context slot"),
  }], { fetchImpl });
  if (typeof signature !== "string" || !BASE58.test(signature)) hold("broadcast returned an invalid signature");
  return {
    signature,
    receipt: Object.freeze({ method: "sendRawTransaction", signature }),
    wire,
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function awaitFinalizedIatV2Week9Transaction({
  signature,
  signedWire = null,
  fetchImpl,
  timeoutMs = FINALIZATION_TIMEOUT_MS,
  pollMs = FINALIZATION_POLL_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const statuses = await rpc("getSignatureStatuses", [[signature], {
      searchTransactionHistory: true,
    }], { fetchImpl });
    const status = statuses?.value?.[0];
    if (status?.err) hold(`broadcast transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === FINALIZED) {
      const result = await rpc("getTransaction", [signature, {
        commitment: FINALIZED,
        encoding: "base64",
        maxSupportedTransactionVersion: 0,
      }], { fetchImpl });
      if (result) {
        if (result.meta?.err) hold(`finalized transaction failed: ${JSON.stringify(result.meta.err)}`);
        const encoded = result.transaction?.[0];
        if (typeof encoded !== "string" || result.transaction?.[1] !== "base64") {
          hold("finalized transaction did not return exact base64 wire bytes");
        }
        const finalizedWire = Buffer.from(encoded, "base64");
        if (signedWire !== null && !finalizedWire.equals(Buffer.from(signedWire))) {
          hold("finalized chain wire differs from the signed wire");
        }
        return {
          finalizedTransaction: Transaction.from(finalizedWire),
          finalizedWire,
          transactionResult: {
            commitment: FINALIZED,
            signature,
            slot: safeInteger(result.slot, "finalized transaction slot"),
            err: result.meta.err ?? null,
            feeLamports: BigInt(safeInteger(result.meta.fee, "finalized fee")),
          },
        };
      }
    }
    await delay(pollMs);
  }
  hold("finalized confirmation timed out");
}

export function sanitizedIatV2Week9Evidence(value) {
  const json = JSON.stringify(value, (key, item) => {
    if (item !== false && /secret|private|path|wire|messageBytes|signedTransaction|serialized/iu.test(key)) {
      return undefined;
    }
    if (typeof item === "bigint") return item.toString();
    if (item instanceof PublicKey) return item.toBase58();
    if (item instanceof Uint8Array) return undefined;
    return item;
  });
  return JSON.parse(json);
}

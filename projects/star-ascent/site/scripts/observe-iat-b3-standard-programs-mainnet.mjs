import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  IAT_B3_MAINNET_GENESIS_HASH,
  IAT_B3_MAINNET_RPC_URL,
  TOKEN_2022_PROGRAM_ID,
} from "./observe-iat-b3-live-estate-mainnet.mjs";

export const ZK_ELGAMAL_PROOF_PROGRAM_ID = "ZkE1Gama1Proof11111111111111111111111111111";
export const UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
export const NATIVE_LOADER_ID = "NativeLoader1111111111111111111111111111111";
export const ZK_ELGAMAL_NATIVE_PROGRAM_NAME = "zk_elgamal_proof_program";
export const TOKEN_2022_LAST_UPGRADE = Object.freeze({
  signature: "2cM3S25AJnHyy4shW7zsoqz5W8JPXPvXiUxk545n5ANf6BET9VvBRfsnSNYi9MqogjVWNBxNfaZpE9QBJX4XCbfn",
  slot: 427_147_035,
  blockTime: 1_781_729_878,
  programDataAddress: "DoU57AYuPFu2QU514RktNPG22QhApEjnKxnBcu4BHDTY",
  bufferAccount: "BsRtj52FSoLqdtiJ6kM5Jmgc8LFbroy5yG24UE363C6s",
  authority: "AeLmXCbPaQHGWRLr2saFsEVfmMNuKnxRAbWCT9P5twgz",
  spillAccount: "4SnSuUtJGKvk2GYpBwmEsWG53zTurVM8yXGsoiZQyMJn",
  executorProgram: "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu",
  executionTrackerProgram: "SMPLKTQhrgo22hFCVq2VGX1KAktTWjeizkhrdB1eauK",
});

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes) {
  let magnitude = 0n;
  for (const byte of bytes) magnitude = (magnitude << 8n) + BigInt(byte);
  let encoded = "";
  while (magnitude > 0n) {
    encoded = BASE58_ALPHABET[Number(magnitude % 58n)] + encoded;
    magnitude /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + encoded;
}

function decodeAccountValue(value, label) {
  if (!value || !Array.isArray(value.data) || value.data.length !== 2 || value.data[1] !== "base64") {
    throw new Error(`${label} account was absent or did not return base64 data`);
  }
  const bytes = Buffer.from(value.data[0], "base64");
  if (bytes.toString("base64") !== value.data[0]) throw new Error(`${label} account data was noncanonical base64`);
  if (typeof value.executable !== "boolean" || typeof value.owner !== "string") {
    throw new Error(`${label} account metadata was malformed`);
  }
  return { bytes, executable: value.executable, owner: value.owner };
}

async function defaultRpcCall(method, params, requestId) {
  const response = await fetch(IAT_B3_MAINNET_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Mainnet RPC ${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.id !== requestId || payload?.jsonrpc !== "2.0") {
    throw new Error(`Mainnet RPC ${method} returned a mismatched response envelope`);
  }
  if (payload.error) throw new Error(`Mainnet RPC ${method} failed: ${JSON.stringify(payload.error)}`);
  return payload.result;
}

export async function observeIatB3StandardProgramsMainnet({
  rpcCall = defaultRpcCall,
  observedAtUtc = new Date().toISOString(),
} = {}) {
  if (typeof rpcCall !== "function") throw new TypeError("rpcCall must be a function");
  if (typeof observedAtUtc !== "string" || Number.isNaN(Date.parse(observedAtUtc))) {
    throw new TypeError("observedAtUtc must be an ISO date-time string");
  }
  let requestId = 1;
  const call = (method, params = []) => rpcCall(method, params, requestId++);
  const genesisHash = await call("getGenesisHash");
  if (genesisHash !== IAT_B3_MAINNET_GENESIS_HASH) throw new Error("Mainnet genesis mismatch");
  const boundarySlot = await call("getSlot", [{ commitment: "finalized" }]);
  if (!Number.isSafeInteger(boundarySlot) || boundarySlot < 0) throw new Error("invalid finalized boundary slot");

  const programs = await call("getMultipleAccounts", [
    [TOKEN_2022_PROGRAM_ID, ZK_ELGAMAL_PROOF_PROGRAM_ID],
    { encoding: "base64", commitment: "finalized", minContextSlot: boundarySlot },
  ]);
  const programsSlot = programs?.context?.slot;
  if (!Number.isSafeInteger(programsSlot) || programsSlot < boundarySlot || !Array.isArray(programs.value) || programs.value.length !== 2) {
    throw new Error("standard-program observations preceded the finalized boundary");
  }
  const tokenProgram = decodeAccountValue(programs.value[0], "Token-2022 program");
  const zkProgram = decodeAccountValue(programs.value[1], "ZK ElGamal proof program");
  if (!tokenProgram.executable || tokenProgram.owner !== UPGRADEABLE_LOADER_ID || tokenProgram.bytes.length !== 36 || tokenProgram.bytes.readUInt32LE(0) !== 2) {
    throw new Error("Token-2022 program account did not match UpgradeableLoader Program state");
  }
  const programDataAddress = encodeBase58(tokenProgram.bytes.subarray(4, 36));
  if (!zkProgram.executable
      || zkProgram.owner !== NATIVE_LOADER_ID
      || !zkProgram.bytes.equals(Buffer.from(ZK_ELGAMAL_NATIVE_PROGRAM_NAME, "ascii"))) {
    throw new Error("ZK ElGamal proof program did not match the pinned native program");
  }

  const programDataResult = await call("getAccountInfo", [
    programDataAddress,
    { encoding: "base64", commitment: "finalized", minContextSlot: programsSlot },
  ]);
  const programDataSlot = programDataResult?.context?.slot;
  if (!Number.isSafeInteger(programDataSlot) || programDataSlot < programsSlot) {
    throw new Error("Token-2022 ProgramData observation preceded the program boundary");
  }
  const programData = decodeAccountValue(programDataResult.value, "Token-2022 ProgramData");
  if (programData.executable || programData.owner !== UPGRADEABLE_LOADER_ID || programData.bytes.length < 45 || programData.bytes.readUInt32LE(0) !== 3) {
    throw new Error("Token-2022 ProgramData account was malformed");
  }
  const deploymentSlot = programData.bytes.readBigUInt64LE(4);
  if (deploymentSlot > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Token-2022 deployment slot exceeded safe integer range");
  const authorityOption = programData.bytes[12];
  if (authorityOption !== 0 && authorityOption !== 1) throw new Error("Token-2022 upgrade-authority option was noncanonical");
  if (authorityOption === 0 && programData.bytes.subarray(13, 45).some((byte) => byte !== 0)) {
    throw new Error("Token-2022 null upgrade-authority padding was nonzero");
  }
  const upgradeAuthority = authorityOption === 1 ? encodeBase58(programData.bytes.subarray(13, 45)) : null;
  const programBytes = programData.bytes.subarray(45);
  if (programBytes.length === 0) throw new Error("Token-2022 ProgramData contained no program bytes");
  if (programDataAddress !== TOKEN_2022_LAST_UPGRADE.programDataAddress
      || Number(deploymentSlot) !== TOKEN_2022_LAST_UPGRADE.slot
      || upgradeAuthority !== TOKEN_2022_LAST_UPGRADE.authority) {
    throw new Error("Token-2022 ProgramData no longer matched the pinned last-upgrade boundary");
  }

  const signatureHistory = await call("getSignaturesForAddress", [
    programDataAddress,
    { limit: 1, commitment: "finalized" },
  ]);
  const newestSignature = Array.isArray(signatureHistory) && signatureHistory.length === 1
    ? signatureHistory[0]
    : null;
  if (!newestSignature
      || newestSignature.signature !== TOKEN_2022_LAST_UPGRADE.signature
      || newestSignature.slot !== TOKEN_2022_LAST_UPGRADE.slot
      || newestSignature.blockTime !== TOKEN_2022_LAST_UPGRADE.blockTime
      || newestSignature.err !== null
      || newestSignature.confirmationStatus !== "finalized") {
    throw new Error("Token-2022 newest ProgramData history did not match the pinned finalized upgrade");
  }
  const upgradeTransaction = await call("getTransaction", [
    TOKEN_2022_LAST_UPGRADE.signature,
    { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 },
  ]);
  const transactionSignatures = upgradeTransaction?.transaction?.signatures;
  const innerInstructions = upgradeTransaction?.meta?.innerInstructions;
  const parsedUpgrade = Array.isArray(innerInstructions)
    ? innerInstructions.flatMap((group) => group?.instructions ?? []).find((instruction) => (
      instruction?.program === "bpf-upgradeable-loader"
      && instruction?.programId === UPGRADEABLE_LOADER_ID
      && instruction?.parsed?.type === "upgrade"
    ))
    : null;
  const upgradeInfo = parsedUpgrade?.parsed?.info;
  const outerPrograms = upgradeTransaction?.transaction?.message?.instructions?.map(({ programId }) => programId) ?? [];
  const innerPrograms = Array.isArray(innerInstructions)
    ? innerInstructions.flatMap((group) => group?.instructions ?? []).map(({ programId }) => programId)
    : [];
  const logs = upgradeTransaction?.meta?.logMessages;
  if (upgradeTransaction?.slot !== TOKEN_2022_LAST_UPGRADE.slot
      || upgradeTransaction?.blockTime !== TOKEN_2022_LAST_UPGRADE.blockTime
      || upgradeTransaction?.meta?.err !== null
      || !Array.isArray(transactionSignatures)
      || transactionSignatures.length !== 1
      || transactionSignatures[0] !== TOKEN_2022_LAST_UPGRADE.signature
      || upgradeInfo?.programAccount !== TOKEN_2022_PROGRAM_ID
      || upgradeInfo?.programDataAccount !== programDataAddress
      || upgradeInfo?.bufferAccount !== TOKEN_2022_LAST_UPGRADE.bufferAccount
      || upgradeInfo?.authority !== upgradeAuthority
      || upgradeInfo?.spillAccount !== TOKEN_2022_LAST_UPGRADE.spillAccount
      || !outerPrograms.includes(TOKEN_2022_LAST_UPGRADE.executorProgram)
      || !innerPrograms.includes(TOKEN_2022_LAST_UPGRADE.executionTrackerProgram)
      || !Array.isArray(logs)
      || !logs.includes(`Upgraded program ${TOKEN_2022_PROGRAM_ID}`)) {
    throw new Error("Token-2022 finalized upgrade transaction did not match the pinned provenance");
  }

  return {
    schema: "iat-b3-standard-program-mainnet-observation/v1",
    observedAtUtc,
    network: "mainnet-beta",
    rpcUrl: IAT_B3_MAINNET_RPC_URL,
    commitment: "finalized",
    genesisHash,
    finalizedBoundarySlot: boundarySlot,
    programsContextSlot: programsSlot,
    programDataContextSlot: programDataSlot,
    token2022: {
      programId: TOKEN_2022_PROGRAM_ID,
      loader: UPGRADEABLE_LOADER_ID,
      programDataAddress,
      deploymentSlot: Number(deploymentSlot),
      upgradeAuthority,
      immutable: upgradeAuthority === null,
      programBytes: programBytes.length,
      programSha256: createHash("sha256").update(programBytes).digest("hex"),
      lastUpgrade: {
        signature: TOKEN_2022_LAST_UPGRADE.signature,
        slot: TOKEN_2022_LAST_UPGRADE.slot,
        blockTime: TOKEN_2022_LAST_UPGRADE.blockTime,
        bufferAccount: TOKEN_2022_LAST_UPGRADE.bufferAccount,
        spillAccount: TOKEN_2022_LAST_UPGRADE.spillAccount,
        executorProgram: TOKEN_2022_LAST_UPGRADE.executorProgram,
        executionTrackerProgram: TOKEN_2022_LAST_UPGRADE.executionTrackerProgram,
        finalizedProvenanceVerified: true,
      },
    },
    zkElgamalProof: {
      programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      loader: NATIVE_LOADER_ID,
      nativeProgramName: ZK_ELGAMAL_NATIVE_PROGRAM_NAME,
      immutable: true,
    },
    standardProgramSnapshotComplete: true,
    sourceReleaseBindingComplete: false,
    exactSourceCommit: null,
    exactReleaseTag: null,
    reproducibleOfficialBuildMatched: false,
    rpcObservationAuthenticated: false,
    token2022ImmutableBytecodeVerified: upgradeAuthority === null,
    hostCompatibilityComplete: false,
    publicNetworkWrites: false,
    activationReady: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    blocker: "TOKEN_2022_SOURCE_RELEASE_BINDING_AND_CEREMONY_TIME_REATTESTATION_REMAIN_REQUIRED",
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await observeIatB3StandardProgramsMainnet();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

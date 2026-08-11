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
export const TOKEN_2022_OFFICIAL_RELEASE = Object.freeze({
  embeddedTag: "program@v11.0.0",
  officialRepository: "https://github.com/solana-program/token-2022",
  embeddedSourceUrl: "https://github.com/solana-program/token-2022/tree/main/program",
  annotatedTagObjectSha: "b491987dc1f84cf0d296a56dcf2c13cdce66aae7",
  taggedSourceCommit: "9bc02757f600ffe754746708a8a072bcd49d1260",
  sourceTreeSha: "6fb5dc5acbf622ce11cf1abc9b4db5bc13e0c78d",
  cargoLockSha256: "40f03a69a019b6381d7c20b03da2cc31f38d185809eda99ae6aaeca2adf486c7",
  pinnedSolanaCliVersion: "3.1.8",
  platformToolsVersion: "v1.52",
  hostRustVersion: "1.93.0",
  sbpfRustVersion: "1.89.0",
  buildArtifactBytes: 632_560,
  buildArtifactSha256: "9bbf90b30e06778ca0feca100b29f0eeb9be576ae024f6323cc207308f51a5d1",
  deployedCapacityBytes: 1_382_016,
  loaderPaddingBytes: 749_456,
  repeatedCleanBuilds: 2,
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
  releaseBinding = TOKEN_2022_OFFICIAL_RELEASE,
} = {}) {
  if (typeof rpcCall !== "function") throw new TypeError("rpcCall must be a function");
  if (typeof observedAtUtc !== "string" || Number.isNaN(Date.parse(observedAtUtc))) {
    throw new TypeError("observedAtUtc must be an ISO date-time string");
  }
  if (!releaseBinding || typeof releaseBinding !== "object") throw new TypeError("releaseBinding must be an object");
  const productionReleaseBinding = releaseBinding === TOKEN_2022_OFFICIAL_RELEASE;
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
  if (!Number.isSafeInteger(releaseBinding.buildArtifactBytes)
      || !Number.isSafeInteger(releaseBinding.deployedCapacityBytes)
      || releaseBinding.buildArtifactBytes <= 0
      || releaseBinding.deployedCapacityBytes < releaseBinding.buildArtifactBytes
      || releaseBinding.loaderPaddingBytes !== releaseBinding.deployedCapacityBytes - releaseBinding.buildArtifactBytes
      || !/^[0-9a-f]{64}$/u.test(releaseBinding.buildArtifactSha256)) {
    throw new Error("Token-2022 release binding dimensions were malformed");
  }
  if (!programBytes.includes(Buffer.from(releaseBinding.embeddedTag, "ascii"))
      || !programBytes.includes(Buffer.from(releaseBinding.embeddedSourceUrl, "ascii"))) {
    throw new Error("Token-2022 ProgramData omitted the pinned official release identity markers");
  }
  const rebuiltPrefix = programBytes.subarray(0, releaseBinding.buildArtifactBytes);
  const loaderPadding = programBytes.subarray(releaseBinding.buildArtifactBytes);
  if (programBytes.length !== releaseBinding.deployedCapacityBytes
      || createHash("sha256").update(rebuiltPrefix).digest("hex") !== releaseBinding.buildArtifactSha256
      || loaderPadding.length !== releaseBinding.loaderPaddingBytes
      || loaderPadding.some((byte) => byte !== 0)) {
    throw new Error("Token-2022 deployed bytes did not match the repeated exact-toolchain build plus zero Loader padding");
  }
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
      releaseIdentity: {
        embeddedTag: releaseBinding.embeddedTag,
        officialRepository: releaseBinding.officialRepository,
        embeddedSourceUrl: releaseBinding.embeddedSourceUrl,
        annotatedTagObjectSha: releaseBinding.annotatedTagObjectSha,
        taggedSourceCommit: releaseBinding.taggedSourceCommit,
        sourceTreeSha: releaseBinding.sourceTreeSha,
        cargoLockSha256: releaseBinding.cargoLockSha256,
        pinnedSolanaCliVersion: releaseBinding.pinnedSolanaCliVersion,
        platformToolsVersion: releaseBinding.platformToolsVersion,
        hostRustVersion: releaseBinding.hostRustVersion,
        sbpfRustVersion: releaseBinding.sbpfRustVersion,
        buildArtifactBytes: releaseBinding.buildArtifactBytes,
        buildArtifactSha256: releaseBinding.buildArtifactSha256,
        deployedCapacityBytes: releaseBinding.deployedCapacityBytes,
        loaderPaddingBytes: releaseBinding.loaderPaddingBytes,
        repeatedCleanBuilds: releaseBinding.repeatedCleanBuilds,
        productionBinding: productionReleaseBinding,
        embeddedReleaseMarkersVerified: true,
        exactSourceBytesRebuiltAndMatched: true,
        zeroLoaderPaddingVerified: true,
      },
    },
    zkElgamalProof: {
      programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      loader: NATIVE_LOADER_ID,
      nativeProgramName: ZK_ELGAMAL_NATIVE_PROGRAM_NAME,
      immutable: true,
    },
    standardProgramSnapshotComplete: true,
    sourceReleaseBindingComplete: productionReleaseBinding,
    exactSourceCommit: productionReleaseBinding ? releaseBinding.taggedSourceCommit : null,
    exactReleaseTag: productionReleaseBinding ? releaseBinding.embeddedTag : null,
    reproducibleOfficialBuildMatched: productionReleaseBinding,
    rpcObservationAuthenticated: false,
    token2022ImmutableBytecodeVerified: upgradeAuthority === null,
    hostCompatibilityComplete: false,
    publicNetworkWrites: false,
    activationReady: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    blocker: productionReleaseBinding
      ? "TOKEN_2022_CEREMONY_TIME_REATTESTATION_REMAINS_REQUIRED_BECAUSE_PROGRAM_IS_UPGRADEABLE"
      : "TEST_RELEASE_BINDING_CANNOT_COMPLETE_PRODUCTION_SOURCE_EQUIVALENCE",
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

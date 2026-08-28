#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PublicKey } from "@solana/web3.js";
import {
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
} from "../programs/iat_v2/artifact-binding.mjs";

export const FINALIZED_BUFFER_RECONCILIATION_SCHEMA =
  "iat-v2-devnet-buffer-finalized-reconciliation/v1";
export const FINALIZED_BUFFER_RECONCILIATION_ERROR_SCHEMA =
  "iat-v2-devnet-buffer-finalized-reconciliation-error/v1";
export const CANONICAL_DEVNET_RPC = "https://api.devnet.solana.com";
export const CANONICAL_DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const UPGRADEABLE_LOADER_ID =
  "BPFLoaderUpgradeab1e11111111111111111111111";
export const BUFFER_METADATA_BYTES = 37;
export const REVIEWED_DEVNET_DEPLOYER =
  "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4";
export const REVIEWED_MODEL_T_ADMIN =
  "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
export const CANONICAL_PUBLIC_CI_ARTIFACT = fileURLToPath(
  new URL("../target/verifiable/iat_v2.so", import.meta.url),
);
export const REVIEWED_PUBLIC_CI_ARTIFACT_BINDING = Object.freeze({
  expectedBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  expectedSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  sourceHeadCommit: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  ciRunId: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  evidenceManifestSha256: IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
});

const REVIEWED_AUTHORITIES = new Set([
  REVIEWED_DEVNET_DEPLOYER,
  REVIEWED_MODEL_T_ADMIN,
]);
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const READ_ONLY_RPC_METHODS = new Set([
  "getAccountInfo",
  "getGenesisHash",
  "getSlot",
]);

export class FinalizedBufferReconciliationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FinalizedBufferReconciliationError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new FinalizedBufferReconciliationError(code, message);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
}

export function createJsonRpcCaller({
  endpoint = CANONICAL_DEVNET_RPC,
  fetchImpl = globalThis.fetch,
} = {}) {
  check(endpoint === CANONICAL_DEVNET_RPC,
    "RPC_CONFIGURATION_HOLD", "only the canonical Devnet RPC endpoint is admitted");
  check(typeof fetchImpl === "function",
    "RPC_CONFIGURATION_HOLD", "RPC fetch implementation is invalid");
  const canonicalUrl = new URL(endpoint).href;
  let id = 0;
  return async (method, params) => {
    check(READ_ONLY_RPC_METHODS.has(method),
      "RPC_METHOD_HOLD", `RPC method is not in the reconciler read-only allowlist: ${method}`);
    check(Array.isArray(params),
      "RPC_CONFIGURATION_HOLD", `RPC parameters must be an array: ${method}`);
    id += 1;
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      redirect: "error",
      cache: "no-store",
    });
    check(response.ok,
      "RPC_TRANSPORT_HOLD", `Devnet RPC HTTP status ${response.status}`);
    check(response.redirected === false,
      "RPC_TRANSPORT_HOLD", "Devnet RPC response followed a redirect");
    let responseUrl;
    try {
      responseUrl = new URL(response.url).href;
    } catch {
      fail("RPC_TRANSPORT_HOLD", "Devnet RPC response URL is unavailable");
    }
    check(responseUrl === canonicalUrl,
      "RPC_TRANSPORT_HOLD", "Devnet RPC response URL drifted from the canonical endpoint");
    const contentType = response.headers?.get?.("content-type") ?? "";
    check(/^application\/json(?:;|$)/iu.test(contentType),
      "RPC_TRANSPORT_HOLD", "Devnet RPC response is not application/json");
    const envelope = await response.json();
    check(envelope?.jsonrpc === "2.0" && envelope.id === id && !envelope.error,
      "RPC_TRANSPORT_HOLD", `Devnet RPC rejected ${method}`);
    return envelope.result;
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function exactPublicKey(value, label) {
  check(typeof value === "string" && value.length > 0 && value.trim() === value,
    "PUBLIC_KEY_HOLD", `${label} is not an exact public-key string`);
  let parsed;
  try {
    parsed = new PublicKey(value);
  } catch {
    fail("PUBLIC_KEY_HOLD", `${label} is not a valid Solana public key`);
  }
  check(parsed.toBase58() === value, "PUBLIC_KEY_HOLD", `${label} is not canonical base58`);
  return parsed;
}

function canonicalUtc(value) {
  const date = value instanceof Date ? value : new Date(value);
  const observedAtUtc = date.toISOString();
  check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(observedAtUtc),
    "OBSERVATION_TIME_HOLD", "observation time is not canonical UTC");
  return observedAtUtc;
}

function decodeCanonicalBase64(value, label) {
  check(Array.isArray(value) && value.length === 2 && value[1] === "base64"
    && typeof value[0] === "string" && CANONICAL_BASE64.test(value[0]),
  "ACCOUNT_ENCODING_HOLD", `${label} is absent or not canonical base64`);
  const bytes = Buffer.from(value[0], "base64");
  check(bytes.toString("base64") === value[0],
    "ACCOUNT_ENCODING_HOLD", `${label} base64 is not canonical`);
  return bytes;
}

export function assertReviewedPublicCiArtifact(
  artifactBytes,
  {
    expectedBytes = IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    expectedSha256 = IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  } = {},
) {
  check(Buffer.isBuffer(artifactBytes), "ARTIFACT_BINDING_HOLD", "public CI artifact must be a Buffer");
  check(Number.isSafeInteger(expectedBytes) && expectedBytes > 0,
    "ARTIFACT_BINDING_HOLD", "expected public CI artifact length is invalid");
  check(typeof expectedSha256 === "string" && HEX_SHA256.test(expectedSha256),
    "ARTIFACT_BINDING_HOLD", "expected public CI artifact SHA-256 is invalid");
  const observedSha256 = sha256(artifactBytes);
  check(artifactBytes.length === expectedBytes && observedSha256 === expectedSha256,
    "ARTIFACT_BINDING_HOLD", "local public CI artifact does not match the exact reviewed bytes and SHA-256");
  return Object.freeze({
    bytes: Buffer.from(artifactBytes),
    byteLength: artifactBytes.length,
    sha256: observedSha256,
  });
}

export function loadReviewedPublicCiArtifact() {
  return assertReviewedPublicCiArtifact(readFileSync(CANONICAL_PUBLIC_CI_ARTIFACT));
}

function exactArtifactBinding(value) {
  check(value && typeof value === "object" && !Array.isArray(value),
    "ARTIFACT_BINDING_HOLD", "public CI artifact binding is invalid");
  const {
    expectedBytes,
    expectedSha256,
    sourceHeadCommit,
    ciRunId,
    evidenceManifestSha256,
  } = value;
  check(Number.isSafeInteger(expectedBytes) && expectedBytes > 0,
    "ARTIFACT_BINDING_HOLD", "public CI artifact binding length is invalid");
  check(typeof expectedSha256 === "string" && HEX_SHA256.test(expectedSha256),
    "ARTIFACT_BINDING_HOLD", "public CI artifact binding SHA-256 is invalid");
  check(typeof sourceHeadCommit === "string" && /^[0-9a-f]{40}$/u.test(sourceHeadCommit),
    "ARTIFACT_BINDING_HOLD", "public CI source commit is invalid");
  check(Number.isSafeInteger(ciRunId) && ciRunId > 0,
    "ARTIFACT_BINDING_HOLD", "public CI run ID is invalid");
  check(typeof evidenceManifestSha256 === "string" && HEX_SHA256.test(evidenceManifestSha256),
    "ARTIFACT_BINDING_HOLD", "public CI evidence manifest SHA-256 is invalid");
  return Object.freeze({
    expectedBytes,
    expectedSha256,
    sourceHeadCommit,
    ciRunId,
    evidenceManifestSha256,
  });
}

// This is the same upgradeable-loader Buffer layout enforced by the localhost
// ProgramUpgrade inspector: u32 state tag 1, one-byte authority option, the
// 32-byte authority, then program bytes beginning at byte 37.
export function parseUpgradeableLoaderBufferAccount(value) {
  check(value && typeof value === "object" && !Array.isArray(value),
    "BUFFER_ACCOUNT_HOLD", "finalized buffer account is absent");
  check(typeof value.owner === "string" && value.owner === UPGRADEABLE_LOADER_ID,
    "BUFFER_OWNER_HOLD", "finalized account is not owned by the upgradeable loader");
  check(value.executable === false,
    "BUFFER_EXECUTABLE_HOLD", "upgradeable-loader Buffer account must not be executable");
  check(Number.isSafeInteger(value.lamports) && value.lamports >= 0,
    "BUFFER_LAMPORTS_HOLD", "finalized buffer lamports are not a safe non-negative integer");
  const data = decodeCanonicalBase64(value.data, "finalized buffer account data");
  check(data.length >= BUFFER_METADATA_BYTES && data.readUInt32LE(0) === 1,
    "BUFFER_LAYOUT_HOLD", "address is not an upgradeable-loader Buffer account");
  check(data[4] === 1,
    "BUFFER_AUTHORITY_HOLD", "upgradeable-loader Buffer account has no authority");
  const authority = new PublicKey(data.subarray(5, BUFFER_METADATA_BYTES)).toBase58();
  return Object.freeze({
    owner: value.owner,
    executable: value.executable,
    lamports: value.lamports,
    accountDataBytes: data.length,
    stateTag: data.readUInt32LE(0),
    authorityOption: data[4],
    authority,
    programBytes: data.subarray(BUFFER_METADATA_BYTES),
  });
}

export function compareBufferProgramBytes(observedBytes, artifactBytes) {
  check(Buffer.isBuffer(observedBytes) && Buffer.isBuffer(artifactBytes),
    "BYTE_COMPARISON_HOLD", "buffer comparison requires byte Buffers");
  let matchingPrefixBytes = 0;
  const sharedBytes = Math.min(observedBytes.length, artifactBytes.length);
  while (
    matchingPrefixBytes < sharedBytes
    && observedBytes[matchingPrefixBytes] === artifactBytes[matchingPrefixBytes]
  ) {
    matchingPrefixBytes += 1;
  }
  let trailingZeroBytes = 0;
  while (
    trailingZeroBytes < observedBytes.length
    && observedBytes[observedBytes.length - trailingZeroBytes - 1] === 0
  ) {
    trailingZeroBytes += 1;
  }
  const observedSuffixIsZero = observedBytes.subarray(matchingPrefixBytes)
    .every((byte) => byte === 0);
  const exact = observedBytes.length === artifactBytes.length
    && matchingPrefixBytes === artifactBytes.length;
  let classification = "DIVERGENT_BYTES";
  if (exact) classification = "EXACT_ARTIFACT";
  else if (
    observedBytes.length === artifactBytes.length
    && observedSuffixIsZero
  ) {
    classification = matchingPrefixBytes === 0
      ? "ZERO_FILLED_UNWRITTEN_BUFFER"
      : "PARTIAL_EXACT_PREFIX_ZERO_TAIL";
  } else if (
    observedBytes.length < artifactBytes.length
    && matchingPrefixBytes === observedBytes.length
  ) {
    classification = "TRUNCATED_EXACT_PREFIX";
  } else if (
    observedBytes.length > artifactBytes.length
    && matchingPrefixBytes === artifactBytes.length
    && observedSuffixIsZero
  ) {
    classification = "EXACT_ARTIFACT_WITH_ZERO_TAIL";
  }
  const firstMismatchOffset = exact ? null : matchingPrefixBytes;
  return Object.freeze({
    classification,
    exact,
    matchingPrefixBytes,
    expectedRemainingBytes: Math.max(artifactBytes.length - matchingPrefixBytes, 0),
    observedSuffixIsZero,
    trailingZeroBytes,
    firstMismatchOffset,
    firstMismatchExpectedByte: firstMismatchOffset !== null && firstMismatchOffset < artifactBytes.length
      ? artifactBytes[firstMismatchOffset]
      : null,
    firstMismatchObservedByte: firstMismatchOffset !== null && firstMismatchOffset < observedBytes.length
      ? observedBytes[firstMismatchOffset]
      : null,
    observedProgramBytes: observedBytes.length,
    observedProgramSha256: sha256(observedBytes),
  });
}

function authorityRole(authority) {
  if (authority === REVIEWED_DEVNET_DEPLOYER) return "DEVNET_DEPLOYER";
  if (authority === REVIEWED_MODEL_T_ADMIN) return "MODEL_T_ADMIN";
  return "UNREVIEWED";
}

function exactSafeSlot(value, label, minimum = 1) {
  check(Number.isSafeInteger(value) && value >= minimum,
    "RPC_CONTEXT_HOLD", `${label} is absent, unsafe, or below the finalized read floor`);
  return value;
}

export async function reconcileFinalizedDevnetBuffer({
  rpcCall,
  bufferAddress,
  expectedAuthority,
  artifactBytes,
  artifactBinding = REVIEWED_PUBLIC_CI_ARTIFACT_BINDING,
  observedAt = new Date(),
}) {
  check(typeof rpcCall === "function", "RPC_CONFIGURATION_HOLD", "read-only RPC caller is required");
  exactPublicKey(bufferAddress, "buffer address");
  exactPublicKey(expectedAuthority, "expected buffer authority");
  check(REVIEWED_AUTHORITIES.has(expectedAuthority),
    "BUFFER_AUTHORITY_HOLD", "expected buffer authority is not one of the two reviewed recovery parties");
  const reviewedBinding = exactArtifactBinding(artifactBinding);
  const artifact = assertReviewedPublicCiArtifact(artifactBytes, reviewedBinding);

  const genesisHash = await rpcCall("getGenesisHash", []);
  check(genesisHash === CANONICAL_DEVNET_GENESIS_HASH,
    "NETWORK_BINDING_HOLD", "RPC genesis hash is not canonical Devnet");
  const minContextSlot = exactSafeSlot(
    await rpcCall("getSlot", [{ commitment: "finalized" }]),
    "finalized minContextSlot",
  );
  const accountResult = await rpcCall("getAccountInfo", [bufferAddress, {
    commitment: "finalized",
    encoding: "base64",
    minContextSlot,
  }]);
  const accountContextSlot = exactSafeSlot(
    accountResult?.context?.slot,
    "finalized buffer context slot",
    minContextSlot,
  );
  const parsed = parseUpgradeableLoaderBufferAccount(accountResult?.value);
  const comparison = compareBufferProgramBytes(parsed.programBytes, artifact.bytes);
  const observedAuthorityRole = authorityRole(parsed.authority);
  const authorityAdmitted = observedAuthorityRole !== "UNREVIEWED";
  const authorityMatchesExpected = parsed.authority === expectedAuthority;
  const sizeMatches = parsed.accountDataBytes === BUFFER_METADATA_BYTES + artifact.byteLength
    && parsed.programBytes.length === artifact.byteLength;
  const hashMatches = comparison.observedProgramSha256 === artifact.sha256;
  const exact = authorityAdmitted && authorityMatchesExpected && sizeMatches
    && hashMatches && comparison.exact;
  const partialExactPrefixZeroTail = authorityAdmitted && authorityMatchesExpected
    && sizeMatches && !hashMatches
    && ["ZERO_FILLED_UNWRITTEN_BUFFER", "PARTIAL_EXACT_PREFIX_ZERO_TAIL"]
      .includes(comparison.classification);
  const holdReasons = [];
  if (!authorityAdmitted) holdReasons.push("UNREVIEWED_AUTHORITY");
  if (!authorityMatchesExpected) holdReasons.push("EXPECTED_AUTHORITY_MISMATCH");
  if (!sizeMatches) holdReasons.push("ACCOUNT_OR_PROGRAM_SIZE_MISMATCH");
  if (!hashMatches) holdReasons.push("PROGRAM_SHA256_MISMATCH");
  if (!comparison.exact && !partialExactPrefixZeroTail) holdReasons.push("NON_CANONICAL_BYTE_RELATION");
  const status = exact
    ? "EXACT_FINALIZED_BUFFER"
    : (partialExactPrefixZeroTail
      ? "HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL"
      : "HOLD_BUFFER_MISMATCH");
  const evidenceBody = {
    schema: FINALIZED_BUFFER_RECONCILIATION_SCHEMA,
    status,
    network: "devnet",
    rpc: CANONICAL_DEVNET_RPC,
    genesisHash,
    commitment: "finalized",
    minContextSlot,
    accountContextSlot,
    observedAtUtc: canonicalUtc(observedAt),
    bufferAddress,
    expectedAuthority,
    observedAuthority: parsed.authority,
    observedAuthorityRole,
    account: {
      owner: parsed.owner,
      executable: parsed.executable,
      lamports: String(parsed.lamports),
      dataBytes: parsed.accountDataBytes,
      metadataBytes: BUFFER_METADATA_BYTES,
      stateTag: parsed.stateTag,
      authorityOption: parsed.authorityOption,
      programBytes: parsed.programBytes.length,
      programSha256: comparison.observedProgramSha256,
    },
    publicCiArtifact: {
      bytes: artifact.byteLength,
      sha256: artifact.sha256,
      sourceHeadCommit: reviewedBinding.sourceHeadCommit,
      ciRunId: reviewedBinding.ciRunId,
      evidenceManifestSha256: reviewedBinding.evidenceManifestSha256,
    },
    comparison,
    validation: {
      authorityAdmitted,
      authorityMatchesExpected,
      sizeMatches,
      hashMatches,
      exact,
      partialExactPrefixZeroTail,
      holdReasons,
    },
    boundary: {
      mutationAuthorized: false,
      signing: false,
      broadcast: false,
      protectedRecoveryStateRead: false,
      next: exact
        ? "SEPARATE_ATTENDED_ACTION_REVIEW_REQUIRED"
        : "PRESERVE_EXISTING_ADDRESS_AND_DO_NOT_RESUBMIT",
    },
  };
  return Object.freeze({
    ...evidenceBody,
    evidenceBodySha256: sha256(jsonBytes(evidenceBody)),
  });
}

export function writeDurableReconciliationEvidence(outputPath, record) {
  check(typeof outputPath === "string" && outputPath.length > 0,
    "OUTPUT_PATH_HOLD", "evidence output path is required");
  const absolute = isAbsolute(outputPath) ? outputPath : resolve(outputPath);
  writeFileSync(absolute, jsonBytes(record), { flag: "wx", mode: 0o600, flush: true });
  return absolute;
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    check(flag?.startsWith("--") && value !== undefined,
      "CLI_USAGE", "options must be exact --name value pairs");
    if (flag === "--buffer") options.bufferAddress = value;
    else if (flag === "--expected-authority") options.expectedAuthority = value;
    else if (flag === "--output") options.outputPath = value;
    else fail("CLI_USAGE", `unexpected option: ${flag}`);
  }
  check(options.bufferAddress && options.expectedAuthority,
    "CLI_USAGE", "--buffer and --expected-authority are required");
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const artifact = loadReviewedPublicCiArtifact();
  const record = await reconcileFinalizedDevnetBuffer({
    rpcCall: createJsonRpcCaller({ endpoint: CANONICAL_DEVNET_RPC }),
    bufferAddress: options.bufferAddress,
    expectedAuthority: options.expectedAuthority,
    artifactBytes: artifact.bytes,
  });
  const wroteFile = options.outputPath
    ? writeDurableReconciliationEvidence(options.outputPath, record)
    : null;
  console.log(JSON.stringify({ ...record, evidenceFile: wroteFile }, null, 2));
  if (record.status !== "EXACT_FINALIZED_BUFFER") process.exitCode = 2;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({
      schema: FINALIZED_BUFFER_RECONCILIATION_ERROR_SCHEMA,
      status: "HOLD",
      code: error instanceof FinalizedBufferReconciliationError
        ? error.code
        : "UNEXPECTED_RECONCILIATION_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      signing: false,
      broadcast: false,
      protectedRecoveryStateRead: false,
    }));
    process.exitCode = 2;
  });
}

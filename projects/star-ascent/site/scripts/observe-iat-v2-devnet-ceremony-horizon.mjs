import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PublicKey } from "@solana/web3.js";
import {
  IAT_V2_SECONDS_PER_DAY,
  IAT_V2_SECONDS_PER_WEEK,
  currentIatV2CccRound,
  currentIatV2Week,
} from "../programs/iat_v2/feature-rehearsal.mjs";

export const IAT_V2_DEVNET_CEREMONY_HORIZON_OBSERVATION_SCHEMA =
  "iat-v2-devnet-ceremony-horizon-observation/v1";
export const IAT_V2_DEVNET_CEREMONY_HORIZON_RPC =
  "https://api.devnet.solana.com";
export const IAT_V2_DEVNET_CEREMONY_HORIZON_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const IAT_V2_DEVNET_CEREMONY_HORIZON_COMMITMENT = "finalized";
export const IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_SEMANTICS =
  "OPEN_ONLY_WHILE_FINALIZED_TIMESTAMP_IS_STRICTLY_LESS_THAN_CLOSE; EQUALITY_IS_CLOSED";

const REVIEWED_PROGRAM_ID = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const REVIEWED_ADMIN = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM =
  "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const DEVNET_FEATURE_MINT_SEED = "iat-v2-features-cold7xz-v3";
const CONFIG_ACCOUNT_BYTES = 234;
const CONFIG_ACCOUNT_DISCRIMINATOR = Buffer.from("9b0caae01efacc82", "hex");
const CLOCK_SYSVAR = "SysvarC1ock11111111111111111111111111111111";
const SYSVAR_PROGRAM = "Sysvar1111111111111111111111111111111111111";
const CLOCK_ACCOUNT_BYTES = 40;
const READ_ONLY_RPC_METHODS = new Set([
  "getGenesisHash",
  "getMultipleAccounts",
  "getSlot",
]);
const canonicalRpcCallers = new WeakSet();

export class IatV2DevnetCeremonyHorizonObserverError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IatV2DevnetCeremonyHorizonObserverError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new IatV2DevnetCeremonyHorizonObserverError(code, message);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
}

function positiveSafeTimestamp(value, label, code = "HORIZON_TIME_HOLD") {
  check(
    Number.isSafeInteger(value) && value > 0,
    code,
    `${label} must be a positive safe-integer Unix timestamp`,
  );
  check(
    Number.isSafeInteger(value * 1_000),
    code,
    `${label} is outside the exact millisecond range`,
  );
  return value;
}

function utcTimestamp(value, label) {
  const timestamp = positiveSafeTimestamp(value, label);
  const date = new Date(timestamp * 1_000);
  check(Number.isFinite(date.valueOf()), "HORIZON_TIME_HOLD", `${label} has no exact UTC representation`);
  return date.toISOString();
}

function safeBoundary(value, label) {
  check(
    Number.isSafeInteger(value) && value > 0,
    "HORIZON_DERIVATION_HOLD",
    `${label} is outside the positive safe-integer range`,
  );
  utcTimestamp(value, label);
  return value;
}

export function selectStrictIatV2CeremonyHorizonClose({
  nextPolicyBoundaryTimestamp,
  nextCccBoundaryTimestamp,
} = {}) {
  const policy = positiveSafeTimestamp(
    nextPolicyBoundaryTimestamp,
    "Next policy boundary",
    "HORIZON_DERIVATION_HOLD",
  );
  const ccc = positiveSafeTimestamp(
    nextCccBoundaryTimestamp,
    "Next CCC boundary",
    "HORIZON_DERIVATION_HOLD",
  );
  const transitionKind = policy === ccc
    ? "BOTH"
    : (policy < ccc ? "POLICY_WEEK" : "CCC_ROUND");
  return Object.freeze({
    strictMinimumCloseTimestamp: Math.min(policy, ccc),
    transitionKind,
  });
}

export function isFinalizedTimestampBeforeStrictClose({
  finalizedTimestamp,
  strictMinimumCloseTimestamp,
} = {}) {
  const observed = positiveSafeTimestamp(finalizedTimestamp, "Finalized timestamp");
  const close = positiveSafeTimestamp(strictMinimumCloseTimestamp, "Strict minimum close");
  return observed < close;
}

export function deriveIatV2DevnetCeremonyHorizon({
  genesisTimestamp,
  finalizedTimestamp,
} = {}) {
  const genesis = positiveSafeTimestamp(genesisTimestamp, "Config Genesis");
  const observed = positiveSafeTimestamp(finalizedTimestamp, "Finalized timestamp");
  const policyWeek = currentIatV2Week(genesis, observed);
  const cccRound = currentIatV2CccRound(genesis, observed);
  const nextPolicyBoundaryTimestamp = safeBoundary(
    policyWeek === null
      ? genesis
      : genesis + ((policyWeek + 1) * IAT_V2_SECONDS_PER_WEEK),
    "Next policy boundary",
  );
  const nextCccBoundaryTimestamp = safeBoundary(
    cccRound === null
      ? genesis + IAT_V2_SECONDS_PER_DAY
      : genesis
        + IAT_V2_SECONDS_PER_DAY
        + ((cccRound + 1) * IAT_V2_SECONDS_PER_WEEK),
    "Next CCC boundary",
  );
  const close = selectStrictIatV2CeremonyHorizonClose({
    nextPolicyBoundaryTimestamp,
    nextCccBoundaryTimestamp,
  });
  return Object.freeze({
    policyWeek,
    cccRound,
    nextPolicyBoundaryTimestamp,
    nextPolicyBoundaryAtUtc: utcTimestamp(nextPolicyBoundaryTimestamp, "Next policy boundary"),
    nextCccBoundaryTimestamp,
    nextCccBoundaryAtUtc: utcTimestamp(nextCccBoundaryTimestamp, "Next CCC boundary"),
    strictMinimumCloseTimestamp: close.strictMinimumCloseTimestamp,
    strictMinimumCloseAtUtc: utcTimestamp(close.strictMinimumCloseTimestamp, "Strict minimum close"),
    transitionKind: close.transitionKind,
    strictCloseSemantics: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_SEMANTICS,
  });
}

export async function deriveReviewedIatV2DevnetCeremonyConfigIdentity() {
  const programId = new PublicKey(REVIEWED_PROGRAM_ID);
  const admin = new PublicKey(REVIEWED_ADMIN);
  const tokenProgram = new PublicKey(TOKEN_PROGRAM);
  const randomnessProgram = new PublicKey(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM);
  const clock = new PublicKey(CLOCK_SYSVAR);
  const sysvarProgram = new PublicKey(SYSVAR_PROGRAM);
  const mint = await PublicKey.createWithSeed(admin, DEVNET_FEATURE_MINT_SEED, tokenProgram);
  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), mint.toBuffer()],
    programId,
  )[0];
  return Object.freeze({
    programId,
    admin,
    tokenProgram,
    randomnessProgram,
    mint,
    config,
    clock,
    sysvarProgram,
  });
}

function canonicalBase64Bytes(value, label, code) {
  check(
    typeof value === "string"
      && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value),
    code,
    `${label} is not canonical base64`,
  );
  const bytes = Buffer.from(value, "base64");
  check(bytes.toString("base64") === value, code, `${label} base64 is non-canonical`);
  return bytes;
}

export function verifyReviewedIatV2DevnetCeremonyConfigAccount({
  account,
  identity,
} = {}) {
  check(account && typeof account === "object" && !Array.isArray(account), "CONFIG_ACCOUNT_HOLD", "Config account is absent");
  check(account.owner === identity.programId.toBase58(), "CONFIG_IDENTITY_HOLD", "Config owner is not the reviewed IAT V2 program");
  check(account.executable === false, "CONFIG_ACCOUNT_HOLD", "Config account must be non-executable");
  check(
    Array.isArray(account.data)
      && account.data.length === 2
      && account.data[1] === "base64",
    "CONFIG_ACCOUNT_HOLD",
    "Config account encoding is not exact base64",
  );
  const bytes = canonicalBase64Bytes(account.data[0], "Config account data", "CONFIG_ACCOUNT_HOLD");
  check(bytes.length === CONFIG_ACCOUNT_BYTES, "CONFIG_ACCOUNT_HOLD", "Config account byte length drifted");
  check(account.space === CONFIG_ACCOUNT_BYTES, "CONFIG_ACCOUNT_HOLD", "Config account space drifted");
  check(
    bytes.subarray(0, CONFIG_ACCOUNT_DISCRIMINATOR.length).equals(CONFIG_ACCOUNT_DISCRIMINATOR),
    "CONFIG_DISCRIMINATOR_HOLD",
    "Config account discriminator drifted",
  );

  const admin = new PublicKey(bytes.subarray(8, 40));
  const mint = new PublicKey(bytes.subarray(40, 72));
  const tokenProgram = new PublicKey(bytes.subarray(72, 104));
  const randomnessProgram = new PublicKey(bytes.subarray(104, 136));
  check(admin.equals(identity.admin), "CONFIG_IDENTITY_HOLD", "Config administrator drifted from the reviewed key");
  check(mint.equals(identity.mint), "CONFIG_IDENTITY_HOLD", "Config mint drifted from the deterministic Devnet mint");
  check(tokenProgram.equals(identity.tokenProgram), "CONFIG_IDENTITY_HOLD", "Config token program drifted");
  check(randomnessProgram.equals(identity.randomnessProgram), "CONFIG_IDENTITY_HOLD", "Config randomness program is not reviewed Switchboard Devnet");
  check(bytes[228] === 1, "CONFIG_STATE_HOLD", "Config rehearsal mode is not active");
  check(bytes[229] === 1, "CONFIG_STATE_HOLD", "Config is not active");

  const genesisValue = bytes.readBigInt64LE(200);
  check(
    genesisValue > 0n && genesisValue <= BigInt(Number.MAX_SAFE_INTEGER),
    "CONFIG_GENESIS_HOLD",
    "Config Genesis is not a positive safe-integer timestamp",
  );
  const genesisTimestamp = Number(genesisValue);
  utcTimestamp(genesisTimestamp, "Config Genesis");
  return Object.freeze({
    genesisTimestamp,
    admin: admin.toBase58(),
    mint: mint.toBase58(),
    tokenProgram: tokenProgram.toBase58(),
    randomnessProgram: randomnessProgram.toBase58(),
    rehearsalMode: true,
    active: true,
    bytes: bytes.length,
  });
}

export function verifyFinalizedIatV2ClockAccount({
  account,
  identity,
  contextSlot,
} = {}) {
  const exactContextSlot = finalizedSlot(contextSlot, "Finalized state context slot");
  check(account && typeof account === "object" && !Array.isArray(account), "CLOCK_ACCOUNT_HOLD", "Clock sysvar account is absent");
  check(account.owner === identity.sysvarProgram.toBase58(), "CLOCK_IDENTITY_HOLD", "Clock sysvar owner drifted");
  check(account.executable === false, "CLOCK_ACCOUNT_HOLD", "Clock sysvar must be non-executable");
  check(
    Array.isArray(account.data)
      && account.data.length === 2
      && account.data[1] === "base64",
    "CLOCK_ACCOUNT_HOLD",
    "Clock sysvar encoding is not exact base64",
  );
  const bytes = canonicalBase64Bytes(account.data[0], "Clock sysvar data", "CLOCK_ACCOUNT_HOLD");
  check(bytes.length === CLOCK_ACCOUNT_BYTES, "CLOCK_ACCOUNT_HOLD", "Clock sysvar byte length drifted");
  check(account.space === CLOCK_ACCOUNT_BYTES, "CLOCK_ACCOUNT_HOLD", "Clock sysvar space drifted");
  const clockSlotValue = bytes.readBigUInt64LE(0);
  check(
    clockSlotValue <= BigInt(Number.MAX_SAFE_INTEGER),
    "CLOCK_CONTEXT_HOLD",
    "Clock sysvar slot is outside the safe-integer range",
  );
  const clockSlot = Number(clockSlotValue);
  check(clockSlot === exactContextSlot, "CLOCK_CONTEXT_HOLD", "Clock sysvar slot does not match its finalized snapshot context");
  const unixTimestampValue = bytes.readBigInt64LE(32);
  check(
    unixTimestampValue > 0n && unixTimestampValue <= BigInt(Number.MAX_SAFE_INTEGER),
    "CLOCK_TIME_HOLD",
    "Clock sysvar Unix timestamp is not a positive safe integer",
  );
  const unixTimestamp = Number(unixTimestampValue);
  utcTimestamp(unixTimestamp, "Clock sysvar Unix timestamp");
  return Object.freeze({
    slot: clockSlot,
    unixTimestamp,
    bytes: bytes.length,
  });
}

export function createIatV2DevnetCeremonyHorizonRpcCaller({
  endpoint = IAT_V2_DEVNET_CEREMONY_HORIZON_RPC,
  fetchImpl = globalThis.fetch,
} = {}) {
  check(
    endpoint === IAT_V2_DEVNET_CEREMONY_HORIZON_RPC,
    "RPC_CONFIGURATION_HOLD",
    "Only the canonical Devnet RPC endpoint is admitted",
  );
  check(typeof fetchImpl === "function", "RPC_CONFIGURATION_HOLD", "RPC fetch implementation is invalid");
  const canonicalUrl = new URL(endpoint).href;
  let id = 0;
  const caller = async (method, params) => {
    check(
      READ_ONLY_RPC_METHODS.has(method),
      "RPC_METHOD_HOLD",
      `RPC method is outside the read-only horizon-observer allowlist: ${method}`,
    );
    check(Array.isArray(params), "RPC_CONFIGURATION_HOLD", `RPC parameters must be an array: ${method}`);
    id += 1;
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      redirect: "error",
      cache: "no-store",
    });
    check(response?.ok === true, "RPC_TRANSPORT_HOLD", `Devnet RPC HTTP status ${response?.status ?? "unavailable"}`);
    check(response.redirected === false, "RPC_TRANSPORT_HOLD", "Devnet RPC response followed a redirect");
    let responseUrl;
    try {
      responseUrl = new URL(response.url).href;
    } catch {
      fail("RPC_TRANSPORT_HOLD", "Devnet RPC response URL is unavailable");
    }
    check(responseUrl === canonicalUrl, "RPC_TRANSPORT_HOLD", "Devnet RPC response URL drifted from the canonical endpoint");
    const contentType = response.headers?.get?.("content-type") ?? "";
    check(/^application\/json(?:;|$)/iu.test(contentType), "RPC_TRANSPORT_HOLD", "Devnet RPC response is not application/json");
    let envelope;
    try {
      envelope = await response.json();
    } catch {
      fail("RPC_TRANSPORT_HOLD", "Devnet RPC response body is not valid JSON");
    }
    check(
      envelope
        && typeof envelope === "object"
        && !Array.isArray(envelope)
        && envelope.jsonrpc === "2.0"
        && envelope.id === id
        && (!Object.hasOwn(envelope, "error") || envelope.error === null)
        && Object.hasOwn(envelope, "result"),
      "RPC_TRANSPORT_HOLD",
      `Devnet RPC envelope drifted or rejected ${method}`,
    );
    return envelope.result;
  };
  canonicalRpcCallers.add(caller);
  return caller;
}

function finalizedSlot(value, label, minimum = 1) {
  check(
    Number.isSafeInteger(value) && value > 0 && value >= minimum,
    "RPC_CONTEXT_HOLD",
    `${label} is absent or below the finalized context floor`,
  );
  return value;
}

export async function observeIatV2DevnetCeremonyHorizon({ rpcCall } = {}) {
  check(
    typeof rpcCall === "function" && canonicalRpcCallers.has(rpcCall),
    "RPC_CONFIGURATION_HOLD",
    "Observation requires the canonical horizon-observer RPC transport",
  );
  const identity = await deriveReviewedIatV2DevnetCeremonyConfigIdentity();
  const genesisHash = await rpcCall("getGenesisHash", []);
  check(
    genesisHash === IAT_V2_DEVNET_CEREMONY_HORIZON_GENESIS_HASH,
    "NETWORK_BINDING_HOLD",
    "RPC genesis hash is not canonical Devnet",
  );
  const finalizedObservationSlot = finalizedSlot(
    await rpcCall("getSlot", [{ commitment: IAT_V2_DEVNET_CEREMONY_HORIZON_COMMITMENT }]),
    "Finalized observation slot",
  );
  const stateResult = await rpcCall("getMultipleAccounts", [
    [identity.config.toBase58(), identity.clock.toBase58()],
    {
      commitment: IAT_V2_DEVNET_CEREMONY_HORIZON_COMMITMENT,
      encoding: "base64",
      minContextSlot: finalizedObservationSlot,
    },
  ]);
  const stateContextSlot = finalizedSlot(
    stateResult?.context?.slot,
    "Finalized state context slot",
    finalizedObservationSlot,
  );
  check(
    Array.isArray(stateResult?.value) && stateResult.value.length === 2,
    "RPC_CONTEXT_HOLD",
    "Finalized Config and Clock snapshot is absent or malformed",
  );
  const config = verifyReviewedIatV2DevnetCeremonyConfigAccount({
    account: stateResult.value[0],
    identity,
  });
  const clock = verifyFinalizedIatV2ClockAccount({
    account: stateResult.value[1],
    identity,
    contextSlot: stateContextSlot,
  });
  const finalizedTimestamp = clock.unixTimestamp;
  const horizon = deriveIatV2DevnetCeremonyHorizon({
    genesisTimestamp: config.genesisTimestamp,
    finalizedTimestamp,
  });
  return Object.freeze({
    schema: IAT_V2_DEVNET_CEREMONY_HORIZON_OBSERVATION_SCHEMA,
    status: "PASS_READ_ONLY",
    network: "devnet",
    rpc: IAT_V2_DEVNET_CEREMONY_HORIZON_RPC,
    genesisHash,
    commitment: IAT_V2_DEVNET_CEREMONY_HORIZON_COMMITMENT,
    configAddress: identity.config.toBase58(),
    configOwner: identity.programId.toBase58(),
    admin: config.admin,
    mint: config.mint,
    randomnessProgram: config.randomnessProgram,
    rehearsalMode: config.rehearsalMode,
    active: config.active,
    finalizedObservationSlot,
    stateContextSlot,
    configContextSlot: stateContextSlot,
    clockContextSlot: stateContextSlot,
    finalizedClockSlot: clock.slot,
    finalizedTimestamp,
    finalizedAtUtc: utcTimestamp(finalizedTimestamp, "Clock sysvar Unix timestamp"),
    genesisTimestamp: config.genesisTimestamp,
    genesisAtUtc: utcTimestamp(config.genesisTimestamp, "Config Genesis"),
    ...horizon,
    readOnly: true,
  });
}

export async function runIatV2DevnetCeremonyHorizonObserverCli(argv = process.argv.slice(2)) {
  check(argv.length === 0, "CLI_USAGE", "The canonical observer accepts no options");
  const rpcCall = createIatV2DevnetCeremonyHorizonRpcCaller({
    endpoint: IAT_V2_DEVNET_CEREMONY_HORIZON_RPC,
    fetchImpl: globalThis.fetch.bind(globalThis),
  });
  const observation = await observeIatV2DevnetCeremonyHorizon({ rpcCall });
  console.log(JSON.stringify(observation, null, 2));
  return observation;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  runIatV2DevnetCeremonyHorizonObserverCli().catch((error) => {
    console.error(JSON.stringify({
      schema: "iat-v2-devnet-ceremony-horizon-observer-error/v1",
      status: "HOLD",
      code: error instanceof IatV2DevnetCeremonyHorizonObserverError
        ? error.code
        : "UNEXPECTED_OBSERVER_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      readOnly: true,
    }));
    process.exitCode = 2;
  });
}

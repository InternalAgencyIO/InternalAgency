import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const IAT_B3_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";
export const IAT_B3_MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_VALUES = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));

function decodeCanonicalPublicKey(value) {
  if (typeof value !== "string" || value.length < 32 || value.length > 44) {
    throw new TypeError("candidate mint must be a canonical 32-byte Base58 public key");
  }
  let magnitude = 0n;
  for (const character of value) {
    const digit = BASE58_VALUES.get(character);
    if (digit === undefined) throw new TypeError("candidate mint contains a non-Base58 character");
    magnitude = (magnitude * 58n) + BigInt(digit);
  }
  const body = [];
  while (magnitude > 0n) {
    body.unshift(Number(magnitude & 255n));
    magnitude >>= 8n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  const decoded = Uint8Array.from([...new Uint8Array(leadingZeroes), ...body]);
  if (decoded.length !== 32) throw new TypeError("candidate mint must decode to exactly 32 bytes");
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

export async function observeIatB3LiveEstateMainnet({
  candidateMint = null,
  rpcCall = defaultRpcCall,
  observedAtUtc = new Date().toISOString(),
} = {}) {
  if (candidateMint !== null) decodeCanonicalPublicKey(candidateMint);
  if (typeof rpcCall !== "function") throw new TypeError("rpcCall must be a function");
  if (typeof observedAtUtc !== "string" || Number.isNaN(Date.parse(observedAtUtc))) {
    throw new TypeError("observedAtUtc must be an ISO date-time string");
  }

  let requestId = 1;
  const call = (method, params = []) => rpcCall(method, params, requestId++);
  const genesisHash = await call("getGenesisHash");
  if (genesisHash !== IAT_B3_MAINNET_GENESIS_HASH) {
    throw new Error(`Mainnet genesis mismatch: expected ${IAT_B3_MAINNET_GENESIS_HASH}, received ${genesisHash}`);
  }
  const finalizedSlot = await call("getSlot", [{ commitment: "finalized" }]);
  if (!Number.isSafeInteger(finalizedSlot) || finalizedSlot < 0) {
    throw new Error("Mainnet RPC returned an invalid finalized slot");
  }

  const base = {
    schema: "iat-b3-live-estate-mainnet-observation/v1",
    observedAtUtc,
    network: "mainnet-beta",
    rpcUrl: IAT_B3_MAINNET_RPC_URL,
    commitment: "finalized",
    genesisHash,
    finalizedSlot,
    candidateMint,
    observationReadOnly: true,
    publicNetworkWrites: false,
    rpcObservationAuthenticated: false,
    ownerAssertionAccepted: false,
    liveEstateDecisionComplete: false,
    activationReady: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  };

  if (candidateMint === null) {
    return {
      ...base,
      result: "NO_CANDIDATE_SUPPLIED",
      candidateObservationComplete: false,
      blocker: "OWNER_MUST_SUPPLY_A_CANDIDATE_MINT_OR_SIGN_NO_LIVE_ESTATE_ASSERTION",
    };
  }

  const accountResult = await call("getAccountInfo", [
    candidateMint,
    { encoding: "base64", commitment: "finalized", minContextSlot: finalizedSlot },
  ]);
  const accountContextSlot = accountResult?.context?.slot;
  if (!accountResult || !Number.isSafeInteger(accountContextSlot) || accountContextSlot < finalizedSlot || !("value" in accountResult)) {
    throw new Error("Mainnet getAccountInfo response preceded the finalized observation boundary");
  }
  if (accountResult.value === null) {
    return {
      ...base,
      result: "CANDIDATE_ACCOUNT_NOT_FOUND",
      candidateObservationComplete: true,
      candidateAccountExists: false,
      candidateAccountContextSlot: accountContextSlot,
      blocker: "OWNER_LIVE_ESTATE_DECISION_REMAINS_UNACCEPTED",
    };
  }

  const { data, owner, lamports, executable } = accountResult.value;
  if (!Array.isArray(data) || data.length !== 2 || data[1] !== "base64" || typeof data[0] !== "string") {
    throw new Error("Mainnet candidate account did not return canonical base64 data");
  }
  const rawData = Buffer.from(data[0], "base64");
  if (rawData.toString("base64") !== data[0]) throw new Error("Mainnet candidate account returned noncanonical base64 data");
  if (typeof executable !== "boolean" || !Number.isSafeInteger(lamports) || lamports < 0) {
    throw new Error("Mainnet candidate account metadata was malformed");
  }
  decodeCanonicalPublicKey(owner);
  const tokenSupply = await call("getTokenSupply", [
    candidateMint,
    { commitment: "finalized", minContextSlot: accountContextSlot },
  ]);
  const tokenSupplyContextSlot = tokenSupply?.context?.slot;
  if (!tokenSupply || !Number.isSafeInteger(tokenSupplyContextSlot) || tokenSupplyContextSlot < accountContextSlot || !tokenSupply.value) {
    throw new Error("Mainnet getTokenSupply response preceded the account observation boundary");
  }
  const amount = tokenSupply.value.amount;
  const decimals = tokenSupply.value.decimals;
  if (!/^(0|[1-9][0-9]*)$/u.test(amount) || !Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error("Mainnet candidate token supply was malformed");
  }

  const recognizedTokenProgram = owner === TOKEN_PROGRAM_ID
    ? "ORIGINAL_SPL_TOKEN"
    : owner === TOKEN_2022_PROGRAM_ID
      ? "TOKEN_2022"
      : "UNRECOGNIZED";
  return {
    ...base,
    result: "CANDIDATE_OBSERVED_OWNER_DECISION_REQUIRED",
    candidateObservationComplete: true,
    candidateAccountExists: true,
    candidateAccount: {
      owner,
      recognizedTokenProgram,
      accountContextSlot,
      tokenSupplyContextSlot,
      executable,
      lamports,
      dataLength: rawData.length,
      dataSha256: sha256(rawData),
      supplyBaseUnits: amount,
      decimals,
    },
    blocker: "OWNER_LIVE_ESTATE_DECISION_REMAINS_UNACCEPTED",
  };
}

function parseCliArguments(argv) {
  if (argv.length === 0) return { candidateMint: null };
  if (argv.length === 2 && argv[0] === "--candidate-mint") return { candidateMint: argv[1] };
  throw new Error("usage: node scripts/observe-iat-b3-live-estate-mainnet.mjs [--candidate-mint <BASE58_MINT>]");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await observeIatB3LiveEstateMainnet(parseCliArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

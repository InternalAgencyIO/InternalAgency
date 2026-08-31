import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

export const IAT_B3_KEY_FREE_IDENTITY_SCHEMA =
  "iat-b3-disposable-devnet-public-identity-input/v1";
export const IAT_B3_KEY_FREE_DECLARED_GENESIS_SCHEMA =
  "iat-b3-disposable-devnet-genesis-observation-input/v1";
export const IAT_B3_KEY_FREE_CHECKPOINT_SCHEMA =
  "iat-b3-key-free-public-build-checkpoint/v1";
export const IAT_B3_KEY_FREE_ASSESSMENT_SCHEMA =
  "iat-b3-key-free-public-build-input-assessment/v1";
export const IAT_B3_KEY_FREE_TEMPLATE_SCHEMA =
  "iat-b3-key-free-public-build-input-template/v1";
export const IAT_B3_KEY_FREE_IDENTITY_INPUT_PATH = "inputs/build-only-identity.json";
export const IAT_B3_KEY_FREE_DECLARED_GENESIS_INPUT_PATH = "inputs/declared-genesis.json";

export const IAT_B3_KEY_FREE_DECLARED_GENESIS = Object.freeze({
  network: "solana-devnet",
  rpcUrl: "https://api.devnet.solana.com",
  genesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
});

export const IAT_B3_KEY_FREE_GENESIS_CLASSIFICATION =
  "DECLARED_COMPILE_DOMAIN_ONLY_NOT_NETWORK_OBSERVATION";
export const IAT_B3_KEY_FREE_PURPOSE = "KEY_FREE_BUILD_ONLY_NONDEPLOYABLE";

const SHA1 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const LANE_ID = /^[a-z0-9][a-z0-9-]{6,62}[a-z0-9]$/u;
const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));
const MAX_INPUT_BYTES = 16_384;
const MAX_AGE_MS = 15 * 60 * 1_000;
const DERIVATION_PREFIX = "IAT-B3-KEY-FREE-PUBLIC-ID/V1";

const IDENTITY_KEYS = Object.freeze([
  "schema", "generatedAtUtc", "laneId", "lawProgramId", "economyProgramId", "canonicalMint",
]);
const GENESIS_KEYS = Object.freeze([
  "schema", "generatedAtUtc", "laneId", "network", "rpcUrl", "genesisHash",
]);
const CHECKPOINT_KEYS = Object.freeze([
  "schema", "headSha", "treeSha", "b26RunnerSha256", "laneId",
]);
const FILE_BINDING_KEYS = Object.freeze(["path", "sha256", "byteLength"]);

const RESERVED_PUBLIC_KEYS = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "BPFLoaderUpgradeab1e11111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
  "Ed25519SigVerify111111111111111111111111111",
  "KeccakSecp256k11111111111111111111111111111",
  "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj",
  "6c725SoXTRThCVgEFrG6q2f3GKLR5m3A7dv7Gf11hNrq",
  "GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU",
  "DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F",
  "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF",
  "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij",
  "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd",
  "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
]);

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function assertPlainJsonData(value, path, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      fail(path, "expected canonical finite JSON number");
    }
    return;
  }
  if (typeof value !== "object") fail(path, "expected plain JSON data");
  if (utilTypes.isProxy(value)) fail(path, "proxy objects are rejected");
  if (seen.has(value)) fail(path, "cyclic object graph is rejected");
  seen.add(value);

  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    fail(path, "expected a plain JSON object or array");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) fail(path, "symbol properties are rejected");
  if (isArray) {
    const lengthDescriptor = descriptors.length;
    if (!lengthDescriptor || !("value" in lengthDescriptor)
      || !Number.isSafeInteger(lengthDescriptor.value)) {
      fail(path, "invalid array length descriptor");
    }
    const elementKeys = keys.filter((key) => key !== "length");
    if (elementKeys.length !== lengthDescriptor.value) fail(path, "sparse arrays are rejected");
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      if (!Object.hasOwn(descriptors, String(index))) fail(`${path}[${index}]`, "sparse arrays are rejected");
    }
  }
  for (const key of keys) {
    if (isArray && key === "length") continue;
    const descriptor = descriptors[key];
    if (!("value" in descriptor)) fail(`${path}.${String(key)}`, "accessor properties are rejected");
    if (descriptor.enumerable !== true) fail(`${path}.${String(key)}`, "non-enumerable properties are rejected");
    assertPlainJsonData(descriptor.value, isArray ? `${path}[${key}]` : `${path}.${key}`, seen);
  }
}

function snapshotPlainJsonData(value, path) {
  assertPlainJsonData(value, path, new WeakSet());
  try {
    return structuredClone(value);
  } catch (error) {
    fail(path, `plain JSON snapshot failed (${error instanceof Error ? error.message : String(error)})`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalIatB3KeyFreePublicBuildInputJson(value) {
  return `${JSON.stringify(canonicalize(snapshotPlainJsonData(value, "$canonicalValue")))}\n`;
}

function exactKeys(value, expectedKeys, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected object");
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(path, `expected exact keys ${expected.join(",")}; received ${actual.join(",")}`);
  }
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function encodeBase58(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value * 256n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    const digit = Number(value % 58n);
    encoded = BASE58_ALPHABET[digit] + encoded;
    value /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + encoded;
}

function decodePublicKey(value, path) {
  if (typeof value !== "string" || !BASE58.test(value)) {
    fail(path, "expected canonical base58 public key");
  }
  let decoded = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) fail(path, "invalid base58 character");
    decoded = (decoded * 58n) + BigInt(digit);
  }
  const body = [];
  while (decoded > 0n) {
    body.unshift(Number(decoded & 0xffn));
    decoded >>= 8n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  const bytes = Uint8Array.from([...new Array(leadingZeroes).fill(0), ...body]);
  if (bytes.length !== 32 || encodeBase58(bytes) !== value) {
    fail(path, "expected canonical 32-byte public key");
  }
  return value;
}

function validateLaneId(value, path) {
  if (typeof value !== "string" || !LANE_ID.test(value)) {
    fail(path, "expected 8..64 lowercase alphanumeric/hyphen lane id");
  }
  return value;
}

function validateCanonicalUtc(value, path) {
  if (typeof value !== "string" || !CANONICAL_UTC.test(value)) {
    fail(path, "expected canonical UTC timestamp with milliseconds");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail(path, "invalid canonical UTC timestamp");
  }
  return milliseconds;
}

function validateCheckpoint(value, path = "trustedCheckpoint") {
  const checkpoint = snapshotPlainJsonData(value, path);
  exactKeys(checkpoint, CHECKPOINT_KEYS, path);
  if (checkpoint.schema !== IAT_B3_KEY_FREE_CHECKPOINT_SCHEMA) {
    fail(`${path}.schema`, "checkpoint schema mismatch");
  }
  if (typeof checkpoint.headSha !== "string" || !SHA1.test(checkpoint.headSha)) {
    fail(`${path}.headSha`, "expected lowercase 40-hex committed head");
  }
  if (typeof checkpoint.treeSha !== "string" || !SHA1.test(checkpoint.treeSha)) {
    fail(`${path}.treeSha`, "expected lowercase 40-hex committed tree");
  }
  if (typeof checkpoint.b26RunnerSha256 !== "string"
    || !SHA256.test(checkpoint.b26RunnerSha256)) {
    fail(`${path}.b26RunnerSha256`, "expected lowercase SHA-256");
  }
  validateLaneId(checkpoint.laneId, `${path}.laneId`);
  return checkpoint;
}

function derivePublicId(domain, checkpoint) {
  const preimage = [
    DERIVATION_PREFIX,
    domain,
    checkpoint.headSha,
    checkpoint.treeSha,
    checkpoint.b26RunnerSha256,
    checkpoint.laneId,
  ].join("\0");
  return encodeBase58(createHash("sha256").update(preimage, "utf8").digest());
}

export function deriveIatB3KeyFreePublicIds(trustedCheckpoint) {
  const checkpoint = validateCheckpoint(trustedCheckpoint);
  return deepFreeze({
    lawProgramId: derivePublicId("LAW", checkpoint),
    economyProgramId: derivePublicId("ECONOMY", checkpoint),
    canonicalMint: derivePublicId("MINT", checkpoint),
  });
}

export function createIatB3KeyFreePublicBuildPayloads(rawInput) {
  const input = snapshotPlainJsonData(rawInput, "$createInput");
  exactKeys(input, ["trustedCheckpoint", "generatedAtUtc"], "$createInput");
  const { trustedCheckpoint, generatedAtUtc } = input;
  const checkpoint = validateCheckpoint(trustedCheckpoint);
  validateCanonicalUtc(generatedAtUtc, "generatedAtUtc");
  const ids = deriveIatB3KeyFreePublicIds(checkpoint);
  return deepFreeze({
    identity: {
      schema: IAT_B3_KEY_FREE_IDENTITY_SCHEMA,
      generatedAtUtc,
      laneId: checkpoint.laneId,
      ...ids,
    },
    declaredGenesis: {
      schema: IAT_B3_KEY_FREE_DECLARED_GENESIS_SCHEMA,
      generatedAtUtc,
      laneId: checkpoint.laneId,
      ...IAT_B3_KEY_FREE_DECLARED_GENESIS,
    },
  });
}

function validateIdentity(value, checkpoint) {
  exactKeys(value, IDENTITY_KEYS, "identity");
  if (value.schema !== IAT_B3_KEY_FREE_IDENTITY_SCHEMA) fail("identity.schema", "schema mismatch");
  validateCanonicalUtc(value.generatedAtUtc, "identity.generatedAtUtc");
  validateLaneId(value.laneId, "identity.laneId");
  if (value.laneId !== checkpoint.laneId) fail("identity.laneId", "does not match trusted checkpoint");
  const ids = ["lawProgramId", "economyProgramId", "canonicalMint"];
  for (const key of ids) decodePublicKey(value[key], `identity.${key}`);
  if (new Set(ids.map((key) => value[key])).size !== ids.length) {
    fail("identity", "public identities must be pairwise distinct");
  }
  const expected = deriveIatB3KeyFreePublicIds(checkpoint);
  for (const key of ids) {
    if (value[key] !== expected[key]) fail(`identity.${key}`, "deterministic derivation mismatch");
    if (RESERVED_PUBLIC_KEYS.has(value[key])) fail(`identity.${key}`, "reserved or retained identity rejected");
  }
  return expected;
}

function validateDeclaredGenesis(value, checkpoint, generatedAtUtc) {
  exactKeys(value, GENESIS_KEYS, "declaredGenesis");
  if (value.schema !== IAT_B3_KEY_FREE_DECLARED_GENESIS_SCHEMA) {
    fail("declaredGenesis.schema", "schema mismatch");
  }
  validateCanonicalUtc(value.generatedAtUtc, "declaredGenesis.generatedAtUtc");
  validateLaneId(value.laneId, "declaredGenesis.laneId");
  if (value.generatedAtUtc !== generatedAtUtc) {
    fail("declaredGenesis.generatedAtUtc", "must equal identity timestamp");
  }
  if (value.laneId !== checkpoint.laneId) {
    fail("declaredGenesis.laneId", "does not match trusted checkpoint");
  }
  for (const [key, expected] of Object.entries(IAT_B3_KEY_FREE_DECLARED_GENESIS)) {
    if (value[key] !== expected) fail(`declaredGenesis.${key}`, "declared compile-domain constant drifted");
  }
}

function validateExternalPublicIdList(value, path) {
  const list = snapshotPlainJsonData(value, path);
  if (!Array.isArray(list)) fail(path, "expected array");
  for (let index = 0; index < list.length; index += 1) {
    decodePublicKey(list[index], `${path}[${index}]`);
  }
  if (new Set(list).size !== list.length) fail(path, "duplicate public identity rejected");
  return new Set(list);
}

function validateFileBinding(value, text, path, expectedPath) {
  const binding = snapshotPlainJsonData(value, path);
  exactKeys(binding, FILE_BINDING_KEYS, path);
  if (binding.path !== expectedPath) {
    fail(`${path}.path`, `expected exact fixed path ${expectedPath}`);
  }
  const byteLength = Buffer.byteLength(text, "utf8");
  if (!Number.isSafeInteger(binding.byteLength) || binding.byteLength !== byteLength) {
    fail(`${path}.byteLength`, "does not match exact UTF-8 input bytes");
  }
  const digest = sha256Bytes(Buffer.from(text, "utf8"));
  if (typeof binding.sha256 !== "string" || binding.sha256 !== digest) {
    fail(`${path}.sha256`, "does not match exact input bytes");
  }
  return binding;
}

export function validateIatB3KeyFreePublicBuildInput(rawInput) {
  const input = snapshotPlainJsonData(rawInput, "$validationInput");
  exactKeys(input, [
    "identity",
    "declaredGenesis",
    "trustedCheckpoint",
    "nowUtc",
    "forbiddenProductionIds",
    "previouslyObservedPublicIds",
  ], "$validationInput");
  const {
    identity,
    declaredGenesis,
    trustedCheckpoint,
    nowUtc,
    forbiddenProductionIds,
    previouslyObservedPublicIds,
  } = input;
  const checkpoint = validateCheckpoint(trustedCheckpoint);
  const identitySnapshot = snapshotPlainJsonData(identity, "identity");
  const genesisSnapshot = snapshotPlainJsonData(declaredGenesis, "declaredGenesis");
  const nowMilliseconds = validateCanonicalUtc(nowUtc, "nowUtc");
  const generatedMilliseconds = validateCanonicalUtc(
    identitySnapshot.generatedAtUtc,
    "identity.generatedAtUtc",
  );
  const ageMilliseconds = nowMilliseconds - generatedMilliseconds;
  if (ageMilliseconds < 0 || ageMilliseconds > MAX_AGE_MS) {
    fail("identity.generatedAtUtc", "input is future-dated or older than 15 minutes");
  }
  const expectedIds = validateIdentity(identitySnapshot, checkpoint);
  validateDeclaredGenesis(genesisSnapshot, checkpoint, identitySnapshot.generatedAtUtc);

  const forbidden = validateExternalPublicIdList(forbiddenProductionIds, "forbiddenProductionIds");
  const prior = validateExternalPublicIdList(
    previouslyObservedPublicIds,
    "previouslyObservedPublicIds",
  );
  for (const [key, publicId] of Object.entries(expectedIds)) {
    if (forbidden.has(publicId)) fail(`identity.${key}`, "production identity reuse rejected");
    if (prior.has(publicId)) fail(`identity.${key}`, "prior-lane identity reuse rejected");
  }

  return deepFreeze({
    schema: IAT_B3_KEY_FREE_ASSESSMENT_SCHEMA,
    status: "HOLD",
    purpose: IAT_B3_KEY_FREE_PURPOSE,
    structuralContractValid: true,
    structuralPayloadsValidated: true,
    authorizingBuildInputValidated: false,
    ready: false,
    consumerPromotionPermitted: false,
    capabilityIssued: false,
    deterministicPublicIds: expectedIds,
    callerSuppliedCheckpointClaim: checkpoint,
    checkpointDirectlyObservedByThisModule: false,
    wallClockDirectlyObservedByThisModule: false,
    inputFilesDirectlyObservedByThisModule: false,
    productionIdentityInventoryDirectlyObservedByThisModule: false,
    priorLaneIdentityInventoryDirectlyObservedByThisModule: false,
    consumerMustSupplyDirectObservations: true,
    declaredGenesisClassification: IAT_B3_KEY_FREE_GENESIS_CLASSIFICATION,
    callerSuppliedGeneratedAtUtc: identitySnapshot.generatedAtUtc,
    callerSuppliedAgeMilliseconds: ageMilliseconds,
    productionIdentityInventoryClaimCount: forbidden.size,
    priorLaneIdentityInventoryClaimCount: prior.size,
    structuralInputFileClaims: null,
    callerSuppliedInputTextAndBindingStructurallyMatched: false,
    blockers: [
      "DIRECT_CHECKPOINT_OBSERVER_REQUIRED_BY_CONSUMER",
      "DIRECT_WALL_CLOCK_OBSERVER_REQUIRED_BY_CONSUMER",
      "DIRECT_INPUT_FILE_OBSERVER_REQUIRED_BY_CONSUMER",
      "DIRECT_PRODUCTION_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
      "DIRECT_PRIOR_LANE_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
      "NONDEPLOYABLE_BUILD_ONLY_IDENTITIES",
      "NO_PRIVATE_KEYS_OR_SIGNING_CAPABILITY",
      "DECLARED_GENESIS_IS_NOT_NETWORK_OBSERVATION",
      "R01_PRODUCTION_IDENTITY_MANIFEST_NOT_SATISFIED",
      "SIGNER_BEARING_REHEARSAL_NOT_AUTHORIZED",
      "THIS_ARTIFACT_DOES_NOT_AUTHORIZE_EXECUTION",
      "ENDPOINT_USE_NOT_AUTHORIZED",
      "DEPLOYMENT_NOT_AUTHORIZED",
      "RELEASE_NOT_AUTHORIZED",
      "PUBLIC_DEVNET_NOT_AUTHORIZED",
      "MAINNET_HOLD",
    ],
    truthBoundary: {
      keypairGenerated: false,
      privateKeyObserved: false,
      signerObserved: false,
      signatureObserved: false,
      payerObserved: false,
      payerBalanceObserved: false,
      fundingObserved: false,
      endpointUseAuthorized: false,
      networkContacted: false,
      rpcObserved: false,
      declaredGenesisNetworkObserved: false,
      deployable: false,
      deploymentAuthorized: false,
      releaseAuthorized: false,
      productionIdentityManifestSatisfied: false,
      executionAuthorized: false,
      signerBearingRehearsalAuthorized: false,
      publicDevnetAuthorized: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    },
  });
}

export function parseIatB3KeyFreePublicBuildInputJson(text, label = "key-free input") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  if (Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES) {
    throw new RangeError(`${label}: JSON source exceeds ${MAX_INPUT_BYTES} bytes`);
  }
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const syntaxFail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") syntaxFail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") index += 2;
      else {
        if (character < " ") syntaxFail("unescaped control character");
        index += 1;
      }
    }
    syntaxFail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") syntaxFail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") syntaxFail("expected comma or closing brace");
        index += 1;
      }
      syntaxFail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") syntaxFail("expected comma or closing bracket");
        index += 1;
      }
      syntaxFail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseStringToken();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) syntaxFail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) syntaxFail("unexpected trailing data");
  const parsed = JSON.parse(text);
  if (text !== canonicalIatB3KeyFreePublicBuildInputJson(parsed)) {
    throw new SyntaxError(`${label}: expected canonical sorted JSON plus exactly one LF`);
  }
  return parsed;
}

export function parseAndValidateIatB3KeyFreePublicBuildInputJson(rawInput) {
  const input = snapshotPlainJsonData(rawInput, "$jsonValidationInput");
  exactKeys(input, [
    "identityJson",
    "declaredGenesisJson",
    "identityFile",
    "declaredGenesisFile",
    "trustedCheckpoint",
    "nowUtc",
    "forbiddenProductionIds",
    "previouslyObservedPublicIds",
  ], "$jsonValidationInput");
  const {
    identityJson,
    declaredGenesisJson,
    identityFile,
    declaredGenesisFile,
    trustedCheckpoint,
    nowUtc,
    forbiddenProductionIds,
    previouslyObservedPublicIds,
  } = input;
  const identity = parseIatB3KeyFreePublicBuildInputJson(identityJson, "identity input");
  const declaredGenesis = parseIatB3KeyFreePublicBuildInputJson(
    declaredGenesisJson,
    "declared Genesis input",
  );
  const identityBinding = validateFileBinding(
    identityFile,
    identityJson,
    "identityFile",
    IAT_B3_KEY_FREE_IDENTITY_INPUT_PATH,
  );
  const genesisBinding = validateFileBinding(
    declaredGenesisFile,
    declaredGenesisJson,
    "declaredGenesisFile",
    IAT_B3_KEY_FREE_DECLARED_GENESIS_INPUT_PATH,
  );
  if (identityBinding.path === genesisBinding.path) {
    fail("fileBindings", "identity and Genesis files must be distinct");
  }
  const assessment = validateIatB3KeyFreePublicBuildInput({
    identity,
    declaredGenesis,
    trustedCheckpoint,
    nowUtc,
    forbiddenProductionIds,
    previouslyObservedPublicIds,
  });
  return deepFreeze({
    ...assessment,
    structuralInputFileClaims: {
      identity: identityBinding,
      declaredGenesis: genesisBinding,
    },
    callerSuppliedInputTextAndBindingStructurallyMatched: true,
  });
}

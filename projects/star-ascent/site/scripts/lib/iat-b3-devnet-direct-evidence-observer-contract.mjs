import { createHash } from "node:crypto";
import {
  closeSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DIRECT_OBSERVER_REQUEST_SCHEMA =
  "iat-b3-devnet-direct-evidence-observer-request/v1";
export const PRE_DIRECT_EVIDENCE_RECORD_SCHEMA =
  "iat-b3-pre-devnet-direct-evidence-record/v1";
export const POST_DIRECT_EVIDENCE_RECORD_SCHEMA =
  "iat-b3-post-devnet-direct-evidence-record/v1";
export const PRE_DIRECT_OBSERVER_RECEIPT_SCHEMA =
  "iat-b3-pre-devnet-direct-evidence-observer-receipt/v1";
export const POST_DIRECT_OBSERVER_RECEIPT_SCHEMA =
  "iat-b3-post-devnet-direct-evidence-observer-receipt/v1";
export const PRE_DIRECT_ASSESSMENT_SCHEMA =
  "iat-b3-pre-devnet-direct-evidence-assessment/v1";
export const POST_DIRECT_ASSESSMENT_SCHEMA =
  "iat-b3-post-devnet-direct-evidence-assessment/v1";
export const PRE_LEGACY_ASSESSMENT_SCHEMA =
  "iat-b3-pre-devnet-authorization-candidate-assessment/v1";
export const POST_LEGACY_ASSESSMENT_SCHEMA =
  "iat-b3-post-devnet-evidence-assessment/v1";

export const DIRECT_OBSERVER_LINUX_RUN_ROOT = "/run/iat-b3-gate8";
export const K45_SOURCE_CHECKPOINT = Object.freeze({
  headSha: "c73d01092c58152ac396dc580055d93511bf0644",
  treeSha: "fcfd4337cfa4ba35a10e4b65849b42d1f5659d3e",
  statusPorcelain: "",
});
export const DIRECT_OBSERVER_SOURCE_PATHS = Object.freeze([
  "projects/star-ascent/site/scripts/lib/iat-b3-devnet-direct-evidence-observer-contract.mjs",
  "projects/star-ascent/site/scripts/observe-iat-b3-pre-devnet-direct-evidence.mjs",
  "projects/star-ascent/site/scripts/observe-iat-b3-post-devnet-direct-evidence.mjs",
  "projects/star-ascent/site/scripts/assess-iat-b3-pre-devnet-direct-evidence.mjs",
  "projects/star-ascent/site/scripts/assess-iat-b3-post-devnet-direct-evidence.mjs",
  "projects/star-ascent/site/tests/iat-b3-devnet-direct-evidence-observer.test.mjs",
]);
export const DIRECT_OBSERVER_SOURCE_MANIFEST_SCHEMA =
  "G8O00_DIRECT_OBSERVER_MANIFEST_V1";
export const DIRECT_OBSERVER_MAX_RECORD_BYTES = 256 * 1024;
export const DIRECT_OBSERVER_MAX_AGGREGATE_BYTES = 8 * 1024 * 1024;
export const DIRECT_OBSERVER_MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const DIRECT_OBSERVER_MAX_RECEIPT_AGE_SECONDS = 1_500;
export const DIRECT_OBSERVER_MAX_FUTURE_SKEW_SECONDS = 5;
export const DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS = 5_000_000_000n;

export const PRE_DIRECT_EVIDENCE_CODES = Object.freeze([
  "READINESS_INPUT_VALID",
  "EXACT_CLEAN_COMMITTED_SOURCE",
  "EXECUTED_RUNNER_MATCHES_HEAD",
  "LINUX_AMD64_LOCAL_VALIDATOR_HOST",
  "PINNED_LOCAL_VALIDATOR_TOOLCHAIN",
  "CANONICAL_PRODUCTION_IDENTITIES_READY",
  "EXACT_REHEARSAL_IDENTITY_INPUT",
  "EXACT_LAW_ARTIFACT_DUAL_BUILD_BOUND",
  "EXACT_ECONOMY_ARTIFACT_DUAL_BUILD_BOUND",
  "LAW_ECONOMY_ARTIFACTS_AND_RECEIPTS_DISTINCT",
  "CONCRETE_LAW_PROGRAM_ID_MISSING",
  "CONCRETE_ECONOMY_PROGRAM_ID_MISSING",
  "CONCRETE_CANONICAL_MINT_MISSING",
  "COMPILED_LAW_DOMAIN_GENESIS_HASH_MISSING",
  "FINAL_LAW_ELF_AND_DOCKER_RECEIPT_MISSING",
  "FINAL_ECONOMY_ELF_AND_DOCKER_RECEIPT_MISSING",
  "PRESTARTED_LOOPBACK_VALIDATOR_MISSING",
  "VALIDATOR_GENESIS_HASH_MISSING",
  "CONCRETE_ACCOUNT_DUMPS_AND_DECODED_INVARIANTS_MISSING",
  "EPHEMERAL_SIGNER_PUBLIC_KEYS_AND_PATHS_MISSING",
  "MUTABLE_FIXTURE_ISOLATION_AND_TERMINAL_HASH_PLAN_MISSING",
  "ALL_15_ORDINAL_CASES_NOT_EXECUTED",
  "OPCODE9_FULL_CONDITIONAL_CASES_NOT_EXECUTED",
  "FIVE_ATOMIC_ROLLBACK_AND_STANDALONE_RETRY_PROBES_NOT_EXECUTED",
  "NEGATIVE_VALIDATOR_DOMAIN_DAILY_LAW_REJECTION_NOT_EXECUTED",
  "POSITIVE_COMPILED_DOMAIN_DAILY_LAW_ACCEPTANCE_NOT_EXECUTED",
  "SOURCE_BOUND_LOOPBACK_RECEIPT_COMPLETION_NOT_IMPLEMENTED",
  "24H_WINDOW_NOT_OBSERVED",
  "PREFLIGHT_NOT_OBSERVED",
  "EXECUTION_PLAN_NOT_OBSERVED",
  "EXECUTION_RECEIPT_NOT_OBSERVED",
  "OFFICIAL_EXECUTION_EVIDENCE_NOT_OBSERVED",
  "HERMETIC_MOUNT_CAUSALITY_UNPROVEN",
  "OWNER_POLICY_STAGES_2_THROUGH_6_INCOMPLETE",
  "FULL_SUPPLY_TRANSIT_OWNER_ACCEPTANCE_ABSENT",
]);

export const POST_DIRECT_EVIDENCE_CODES = Object.freeze([
  "PUBLIC_DEVNET_RPC_IDENTITY_OBSERVED",
  "TRANSACTION_SIGNATURES_OBSERVED",
  "ACCOUNT_STATE_OBSERVED",
  "MODEL_T_PHYSICAL_CONFIRMATIONS_OBSERVED",
  "POST_DEVNET_RECONCILIATION_OBSERVED",
  "AUTHORITY_AND_CLEANUP_STATE_OBSERVED",
]);

export const IMMUTABLE_X10_BINDINGS = Object.freeze({
  gateContract: Object.freeze({
    path: "scripts/lib/iat-b3-devnet-gate-split-contract.mjs",
    sha256: "592c7a7fea80896e1dc5441ce8638cad511a4108ec600916fb3b95fd1347ce1c",
    byteLength: 12_649,
  }),
  preAssessor: Object.freeze({
    path: "scripts/assess-iat-b3-pre-devnet-authorization.mjs",
    sha256: "ed99094d17d0f554de5815a01c07980cb298b3ee0c4a52f63babf7ec35d10c02",
    byteLength: 33_203,
  }),
  postAssessor: Object.freeze({
    path: "scripts/assess-iat-b3-post-devnet-evidence.mjs",
    sha256: "c5e9ae8e6ba2dc8138290602a6a585d7f4000fe68359ce162fe40fdfe23c38d7",
    byteLength: 44_165,
  }),
  hostileTest: Object.freeze({
    path: "tests/iat-b3-devnet-gate-split.test.mjs",
    sha256: "e77b882e5c4bd571e4ad35192d386832f11ad630b730c8ddc129c0aa58693474",
    byteLength: 38_020,
  }),
});

export const PRE_LEGACY_OBSERVER_BLOCKER = Object.freeze({
  code: "PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED",
  detail: "structural hashes and self-attested booleans are not direct evidence; trusted artifact, scheduler, owner/device, and local-rehearsal observers must be implemented before pre-review eligibility",
});
export const POST_LEGACY_OBSERVER_BLOCKER = Object.freeze({
  code: "POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED",
  detail: "structural hashes, self-declared grant/device fields, and transaction-shaped JSON are not direct RPC, signature, account-state, or hardware-confirmation evidence",
});
export const FIXED_X10_LEGACY_ORACLE = Object.freeze({
  pre: Object.freeze({
    inputSha256: "982669789920c91da1aa8586608d1e37e4248e432d1693b2b5f414202f4be44d",
    assessmentSha256: "a5c9bc8403c1e8bb378f792696fa8a9c7fd5b1e2b6e5c05e822ecb0be88f4531",
  }),
  post: Object.freeze({
    inputSha256: "ad67be57141e58152666b05af3c19790a4f48e4cad935b9289e768569f1f607c",
    assessmentSha256: "df706f6060e0af4c69f761b4badbaf909eae3166008e8ca0a41203c5ba265428",
  }),
});

const HEX_64 = /^[0-9a-f]{64}$/u;
const GIT_OID = /^[0-9a-f]{40}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const RUN_ID = /^[0-9a-f]{64}$/u;
const UNSIGNED_DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const LINUX_BOOT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PHASES = Object.freeze(["PRE", "POST"]);
const REQUEST_KEYS = Object.freeze([
  "schema", "phase", "runId", "sourceCheckpoint", "observerPackage",
  "observer", "workload", "observations",
]);
const PRINCIPAL_KEYS = Object.freeze([
  "principal", "processId", "parentProcessId", "sessionId", "uid", "gid",
  "processStartTicks", "bootId",
]);
const PACKAGE_KEYS = Object.freeze([
  "commitSha", "treeSha", "parentCommitSha", "manifestSha256",
  "manifestByteLength", "sourcePathCount", "sourcePayloadByteLength",
]);
const DESCRIPTOR_KEYS = Object.freeze(["code", "path", "sha256", "byteLength"]);
const RECEIPT_DESCRIPTOR_KEYS = Object.freeze(["path", "sha256", "byteLength"]);
const PAYLOAD_KEYS = Object.freeze([
  "schema", "phase", "code", "runId", "sourceCheckpoint", "observerPackage",
  "workload", "artifactPath", "artifactSha256", "artifactByteLength",
  "observationState", "directEvidenceObserved", "factAccepted",
  "authorizationEffect",
]);
const RECORD_KEYS = Object.freeze([
  "schema", "phase", "runId", "code", "sourceCheckpoint",
  "observerPackage", "workload", "capturedAtUnixSeconds", "payload",
  "payloadSha256", "payloadByteLength", "reviewState",
]);
const IDENTITY_KEYS = Object.freeze([
  "dev", "ino", "mode", "uid", "gid", "size", "mtimeNs", "ctimeNs",
]);
const OBSERVATION_KEYS = Object.freeze([
  "code", "path", "sha256", "byteLength", "identity",
  "capturedAtUnixSeconds", "payload", "payloadSha256", "payloadByteLength",
  "artifactIdentity", "reviewState",
]);
const RECEIPT_KEYS = Object.freeze([
  "schema", "phase", "runId", "sourceCheckpoint", "observerPackage",
  "observer", "workload", "observedAtUnixSeconds", "evidenceCodes",
  "observations", "receiptSha256",
]);
const PRE_LEGACY_KEYS = Object.freeze([
  "schema", "status", "inputSha256", "sourceCheckpoint",
  "executionIntentSha256", "clearedEvidenceCodes", "clearedEvidenceCount",
  "requiredEvidenceCount", "independentVerification", "preservedPendingFacts",
  "preservedInvariant", "blockers", "gate8Go", "requestAuthorizationPermitted",
  "publicDevnetAuthorizationMayBeRequested", "executionAuthorized",
  "publicDevnetAuthorized", "devnetExecuted",
  "publicDevnetExecutionProvenanceAvailable", "releaseAuthorized",
  "mainnetExecutionAuthorized", "mainnetStatus", "safety", "assessmentSha256",
]);
const POST_LEGACY_KEYS = Object.freeze([
  "schema", "status", "sourceCheckpoint", "preVerdictSha256", "grantSha256",
  "executionState", "factStates", "preservedInvariant", "blockers",
  "independentPostVerificationRequired", "devnetRehearsalEvidenceAccepted",
  "gate8Go", "requestAuthorizationPermitted",
  "publicDevnetAuthorizationMayBeRequested", "executionAuthorized",
  "publicDevnetAuthorized", "releaseAuthorized", "mainnetExecutionAuthorized",
  "mainnetStatus", "safety", "assessmentSha256",
]);

const PRE_LEGACY_INDEPENDENT_VERIFICATION = Object.freeze({
  required: true,
  blockerCode: "GATE_8_DIRECT_EVIDENCE_PACKET_UNSATISFIED",
  complete: false,
});
const LEGACY_PENDING_FACTS = Object.freeze([
  Object.freeze({
    code: "DEVNET_NOT_EXECUTED",
    state: "TRUE_EXPECTED_PENDING",
    clearableOnlyBy: "POST_DEVNET_DIRECT_RECEIPTS",
  }),
  Object.freeze({
    code: "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE",
    state: "TRUE_EXPECTED_PENDING",
    clearableOnlyBy: "POST_DEVNET_DIRECT_RECEIPTS",
  }),
]);
const LEGACY_MAINNET_HOLD_INVARIANT = Object.freeze({
  code: "MAINNET_HOLD",
  state: "TRUE_INVARIANT",
  clearableByThisContract: false,
});
const LEGACY_ASSESSMENT_SAFETY = Object.freeze({
  networkAccess: false,
  rpcQueries: false,
  signing: false,
  broadcast: false,
  deployment: false,
  fundingSpend: false,
  activation: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: "HOLD",
  injectedTestSeam: false,
  injectedTestEvidenceAccepted: false,
});

const CURRENT_SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIRECT_OBSERVER_REPO_PATH_PREFIX = "projects/star-ascent/site/";
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

export function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function assertUnicode(value, path) {
  if (loneSurrogate.test(value)) {
    throw new TypeError(`${path} contains a lone Unicode surrogate`);
  }
}

export function canonicalizeDirectObserverJson(value) {
  const ancestors = new Set();
  function serialize(current, path) {
    if (current === null) return "null";
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "string") {
      assertUnicode(current, path);
      return JSON.stringify(current);
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new TypeError(`${path} contains a non-finite number`);
      return JSON.stringify(current);
    }
    if (typeof current !== "object") {
      throw new TypeError(`${path} contains unsupported ${typeof current} data`);
    }
    if (ancestors.has(current)) throw new TypeError(`${path} contains a cycle`);
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getOwnPropertySymbols(current).length !== 0) {
          throw new TypeError(`${path} contains symbol keys`);
        }
        const extraKeys = Object.keys(current).filter((key) =>
          !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= current.length);
        if (extraKeys.length !== 0) {
          throw new TypeError(`${path} contains non-JSON array properties`);
        }
        const items = [];
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.hasOwn(current, index)) {
            throw new TypeError(`${path}[${index}] is a sparse array entry`);
          }
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor || !Object.hasOwn(descriptor, "value")) {
            throw new TypeError(`${path}[${index}] must be a data property`);
          }
          items.push(serialize(current[index], `${path}[${index}]`));
        }
        return `[${items.join(",")}]`;
      }
      if (Object.getPrototypeOf(current) !== Object.prototype
        && Object.getPrototypeOf(current) !== null) {
        throw new TypeError(`${path} must contain only plain JSON objects`);
      }
      if (Object.getOwnPropertySymbols(current).length !== 0) {
        throw new TypeError(`${path} contains symbol keys`);
      }
      const keys = Object.keys(current);
      if (Object.getOwnPropertyNames(current).length !== keys.length) {
        throw new TypeError(`${path} contains non-enumerable data`);
      }
      return `{${keys.sort().map((key) => {
        assertUnicode(key, `${path} key`);
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) {
          throw new TypeError(`${path}.${key} must be a data property`);
        }
        return `${JSON.stringify(key)}:${serialize(descriptor.value, `${path}.${key}`)}`;
      }).join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  }
  return serialize(value, "$root");
}

export function canonicalDirectObserverSha256(domain, value) {
  if (typeof domain !== "string" || !/^[A-Z0-9_]{8,128}$/u.test(domain)) {
    throw new TypeError("IAT_B3_DIRECT_OBSERVER_DIGEST_DOMAIN_INVALID_HOLD");
  }
  return createHash("sha256")
    .update(`${domain}\0`, "utf8")
    .update(canonicalizeDirectObserverJson(value), "utf8")
    .digest("hex");
}

export function parseStrictDirectObserverJson(
  text,
  label = "IAT_B3_DIRECT_OBSERVER_INPUT",
) {
  if (typeof text !== "string") {
    throw new TypeError(`${label}: JSON source must be a string`);
  }
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
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
        if (character < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
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
        if (keys.has(key)) {
          throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        }
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
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
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseStringToken();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function validateDigest(value) {
  return typeof value === "string" && HEX_64.test(value);
}

export function validateSourceCheckpoint(value) {
  return exactKeys(value, ["headSha", "treeSha", "statusPorcelain"])
    && GIT_OID.test(value.headSha) && GIT_OID.test(value.treeSha)
    && value.statusPorcelain === "";
}

export function validateObserverPackage(value) {
  const currentManifest = describeCurrentObserverSources();
  return currentManifest !== false && exactKeys(value, PACKAGE_KEYS)
    && GIT_OID.test(value.commitSha) && GIT_OID.test(value.treeSha)
    && value.parentCommitSha === K45_SOURCE_CHECKPOINT.headSha
    && value.treeSha !== K45_SOURCE_CHECKPOINT.treeSha
    && value.manifestSha256 === currentManifest.manifestSha256
    && value.manifestByteLength === currentManifest.manifestByteLength
    && value.sourcePathCount === currentManifest.sourcePathCount
    && value.sourcePayloadByteLength === currentManifest.sourcePayloadByteLength;
}

export function validateRunId(value) {
  return typeof value === "string" && RUN_ID.test(value);
}

function sameCanonical(left, right) {
  try {
    return canonicalizeDirectObserverJson(left) === canonicalizeDirectObserverJson(right);
  } catch {
    return false;
  }
}

function phaseCodes(phase) {
  return phase === "PRE" ? PRE_DIRECT_EVIDENCE_CODES
    : phase === "POST" ? POST_DIRECT_EVIDENCE_CODES : null;
}

function recordSchema(phase) {
  return phase === "PRE" ? PRE_DIRECT_EVIDENCE_RECORD_SCHEMA
    : phase === "POST" ? POST_DIRECT_EVIDENCE_RECORD_SCHEMA : null;
}

function receiptSchema(phase) {
  return phase === "PRE" ? PRE_DIRECT_OBSERVER_RECEIPT_SCHEMA
    : phase === "POST" ? POST_DIRECT_OBSERVER_RECEIPT_SCHEMA : null;
}

function validPrincipal(value, expectedPrincipal = null) {
  return exactKeys(value, PRINCIPAL_KEYS) && IDENTIFIER.test(value.principal)
    && (expectedPrincipal === null || value.principal === expectedPrincipal)
    && Number.isSafeInteger(value.processId) && value.processId > 1
    && Number.isSafeInteger(value.parentProcessId) && value.parentProcessId >= 1
    && UNSIGNED_DECIMAL.test(value.sessionId) && Number.isSafeInteger(value.uid)
    && value.uid >= 0 && Number.isSafeInteger(value.gid) && value.gid >= 0
    && UNSIGNED_DECIMAL.test(value.processStartTicks)
    && typeof value.bootId === "string" && LINUX_BOOT_ID.test(value.bootId);
}

function principalsSeparated(observer, workload) {
  return validPrincipal(observer, "devnet_release_audit")
    && validPrincipal(workload, "iat_b3_bpl_workload")
    && observer.principal !== workload.principal
    && observer.processId !== workload.processId
    && observer.sessionId !== workload.sessionId
    && observer.processStartTicks !== workload.processStartTicks
    && observer.uid !== workload.uid && observer.gid !== workload.gid;
}

export function expectedDirectEvidencePath(runId, phase, index, code) {
  if (!validateRunId(runId) || !PHASES.includes(phase)
    || !Number.isSafeInteger(index) || index < 0
    || typeof code !== "string" || !/^[A-Z0-9_]{8,128}$/u.test(code)) return null;
  return posix.join(
    DIRECT_OBSERVER_LINUX_RUN_ROOT,
    runId,
    phase.toLowerCase(),
    `${String(index).padStart(2, "0")}-${code}.json`,
  );
}

export function expectedDirectEvidenceArtifactPath(runId, phase, index, code) {
  if (!validateRunId(runId) || !PHASES.includes(phase)
    || !Number.isSafeInteger(index) || index < 0
    || typeof code !== "string" || !/^[A-Z0-9_]{8,128}$/u.test(code)) return null;
  return posix.join(
    DIRECT_OBSERVER_LINUX_RUN_ROOT,
    runId,
    phase.toLowerCase(),
    `${String(index).padStart(2, "0")}-${code}.artifact`,
  );
}

export function expectedDirectEvidenceReceiptPath(runId, phase) {
  if (!validateRunId(runId) || !PHASES.includes(phase)) return null;
  return posix.join(
    DIRECT_OBSERVER_LINUX_RUN_ROOT,
    runId,
    `${phase.toLowerCase()}-observer-receipt.json`,
  );
}

export function directEvidencePayloadSchema(phase, code) {
  const codes = phaseCodes(phase);
  if (codes === null || !codes.includes(code)) return null;
  return `iat-b3-${phase.toLowerCase()}-direct-evidence-payload/`
    + `${code.toLowerCase().replaceAll("_", "-")}/v1`;
}

export function validateDirectEvidencePayload(payload, {
  phase, runId, code, index, sourceCheckpoint, observerPackage, workload,
} = {}) {
  const expectedArtifactPath = expectedDirectEvidenceArtifactPath(
    runId, phase, index, code,
  );
  return expectedArtifactPath !== null && exactKeys(payload, PAYLOAD_KEYS)
    && payload.schema === directEvidencePayloadSchema(phase, code)
    && payload.phase === phase && payload.code === code && payload.runId === runId
    && sameCanonical(payload.sourceCheckpoint, sourceCheckpoint)
    && sameCanonical(payload.observerPackage, observerPackage)
    && sameCanonical(payload.workload, workload)
    && payload.artifactPath === expectedArtifactPath
    && validateDigest(payload.artifactSha256)
    && Number.isSafeInteger(payload.artifactByteLength)
    && payload.artifactByteLength > 0
    && payload.artifactByteLength <= DIRECT_OBSERVER_MAX_RECORD_BYTES
    && payload.observationState === "WORKLOAD_ARTIFACT_BYTES_OBSERVED_PENDING_REVIEW"
    && payload.directEvidenceObserved === false && payload.factAccepted === false
    && payload.authorizationEffect === "NONE";
}

function validDescriptor(value, { phase, runId, index, code }) {
  const expectedPath = expectedDirectEvidencePath(runId, phase, index, code);
  return expectedPath !== null && exactKeys(value, DESCRIPTOR_KEYS)
    && value.code === code && value.path === expectedPath
    && posix.isAbsolute(value.path) && posix.normalize(value.path) === value.path
    && validateDigest(value.sha256) && Number.isSafeInteger(value.byteLength)
    && value.byteLength > 0 && value.byteLength <= DIRECT_OBSERVER_MAX_RECORD_BYTES;
}

export function validateDirectObserverRequest(value, { phase } = {}) {
  const expectedCodes = phaseCodes(phase);
  return expectedCodes !== null && exactKeys(value, REQUEST_KEYS)
    && value.schema === DIRECT_OBSERVER_REQUEST_SCHEMA && value.phase === phase
    && validateRunId(value.runId) && validateSourceCheckpoint(value.sourceCheckpoint)
    && sameCanonical(value.sourceCheckpoint, K45_SOURCE_CHECKPOINT)
    && validateObserverPackage(value.observerPackage)
    && value.observerPackage.treeSha !== value.sourceCheckpoint.treeSha
    && principalsSeparated(value.observer, value.workload)
    && Array.isArray(value.observations)
    && value.observations.length === expectedCodes.length
    && value.observations.every((entry, index) => validDescriptor(entry, {
      phase, runId: value.runId, index, code: expectedCodes[index],
    }))
    && value.observations.reduce((sum, entry) => sum + entry.byteLength, 0)
      <= DIRECT_OBSERVER_MAX_AGGREGATE_BYTES;
}

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
    && left.uid === right.uid && left.gid === right.gid && left.size === right.size
    && left.nlink === right.nlink && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function statIdentity(stat) {
  return Object.freeze({
    dev: stat.dev.toString(10), ino: stat.ino.toString(10), mode: Number(stat.mode),
    uid: stat.uid.toString(10), gid: stat.gid.toString(10),
    size: stat.size.toString(10), mtimeNs: stat.mtimeNs.toString(10),
    ctimeNs: stat.ctimeNs.toString(10),
  });
}

function readBoundRegularFile(path, {
  maxBytes,
  expectedBytes = null,
  expectedSha256 = null,
  expectedUid = null,
  expectedGid = null,
} = {}) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path
    || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) return null;
  let handle = null;
  try {
    const beforePath = lstatSync(path, { bigint: true });
    if (!beforePath.isFile() || beforePath.isSymbolicLink()
      || beforePath.nlink !== 1n || beforePath.size <= 0n
      || beforePath.size > BigInt(maxBytes)
      || (expectedBytes !== null && beforePath.size !== BigInt(expectedBytes))
      || (expectedUid !== null && beforePath.uid !== BigInt(expectedUid))
      || (expectedGid !== null && beforePath.gid !== BigInt(expectedGid))
      || (expectedUid !== null && (beforePath.mode & 0o777n) !== 0o640n)
      || realpathSync.native(path) !== path) return null;
    handle = openSync(path, "r");
    const beforeHandle = fstatSync(handle, { bigint: true });
    if (!sameStat(beforePath, beforeHandle)) return null;
    const bytes = readFileSync(handle);
    const afterHandle = fstatSync(handle, { bigint: true });
    const afterPath = lstatSync(path, { bigint: true });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!sameStat(beforeHandle, afterHandle) || !sameStat(afterHandle, afterPath)
      || realpathSync.native(path) !== path || bytes.length !== Number(afterHandle.size)
      || (expectedSha256 !== null && sha256 !== expectedSha256)) return null;
    return Object.freeze({ bytes, sha256, identity: statIdentity(afterHandle) });
  } catch {
    return null;
  } finally {
    if (handle !== null) closeSync(handle);
  }
}

export function describeCurrentObserverSources() {
  const rows = [];
  let sourcePayloadByteLength = 0;
  const orderedPaths = [...DIRECT_OBSERVER_SOURCE_PATHS]
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  for (const relativePath of orderedPaths) {
    if (!relativePath.startsWith(DIRECT_OBSERVER_REPO_PATH_PREFIX)) return false;
    const absolutePath = resolve(
      CURRENT_SITE_ROOT,
      relativePath.slice(DIRECT_OBSERVER_REPO_PATH_PREFIX.length),
    );
    const result = readBoundRegularFile(absolutePath, {
      maxBytes: DIRECT_OBSERVER_MAX_AGGREGATE_BYTES,
    });
    if (result === null) return false;
    sourcePayloadByteLength += result.bytes.length;
    if (sourcePayloadByteLength > DIRECT_OBSERVER_MAX_AGGREGATE_BYTES) return false;
    rows.push(`${result.sha256}\0${result.bytes.length}\0${relativePath}\n`);
  }
  const manifestBytes = Buffer.from(
    `${DIRECT_OBSERVER_SOURCE_MANIFEST_SCHEMA}\n${rows.join("")}`,
    "utf8",
  );
  return Object.freeze({
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
    manifestByteLength: manifestBytes.length,
    sourcePathCount: orderedPaths.length,
    sourcePayloadByteLength,
  });
}

function readProcText(path, maxBytes = 64 * 1024) {
  let handle = null;
  try {
    const beforePath = lstatSync(path, { bigint: true });
    if (!beforePath.isFile() || beforePath.isSymbolicLink()
      || beforePath.nlink !== 1n || realpathSync.native(path) !== path) return null;
    handle = openSync(path, "r");
    const beforeHandle = fstatSync(handle, { bigint: true });
    if (beforeHandle.dev !== beforePath.dev || beforeHandle.ino !== beforePath.ino
      || beforeHandle.mode !== beforePath.mode) return null;
    const bytes = readFileSync(handle);
    const afterHandle = fstatSync(handle, { bigint: true });
    const afterPath = lstatSync(path, { bigint: true });
    if (bytes.length <= 0 || bytes.length > maxBytes
      || afterHandle.dev !== beforeHandle.dev || afterHandle.ino !== beforeHandle.ino
      || afterPath.dev !== afterHandle.dev || afterPath.ino !== afterHandle.ino
      || realpathSync.native(path) !== path) return null;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  } finally {
    if (handle !== null) closeSync(handle);
  }
}

function readLinuxProcessIdentity(processId) {
  if (process.platform !== "linux" || !Number.isSafeInteger(processId)
    || processId <= 1) return null;
  try {
    process.kill(processId, 0);
  } catch (error) {
    if (error?.code !== "EPERM") return null;
  }
  const stat = readProcText(`/proc/${processId}/stat`);
  const status = readProcText(`/proc/${processId}/status`);
  const bootId = readProcText("/proc/sys/kernel/random/boot_id", 128)?.trim() ?? null;
  if (stat === null || status === null || !LINUX_BOOT_ID.test(bootId ?? "")) return null;
  const close = stat.lastIndexOf(") ");
  if (close < 0) return null;
  const fields = stat.slice(close + 2).trim().split(/\s+/u);
  const uid = /^Uid:\s+([0-9]+)\s+/mu.exec(status)?.[1] ?? null;
  const gid = /^Gid:\s+([0-9]+)\s+/mu.exec(status)?.[1] ?? null;
  const parentProcessId = fields[1] ?? null;
  const sessionId = fields[3] ?? null;
  const startTicks = fields[19] ?? null;
  if (!UNSIGNED_DECIMAL.test(uid ?? "") || !UNSIGNED_DECIMAL.test(gid ?? "")
    || !UNSIGNED_DECIMAL.test(parentProcessId ?? "")
    || !UNSIGNED_DECIMAL.test(sessionId ?? "")
    || !UNSIGNED_DECIMAL.test(startTicks ?? "")) return null;
  return Object.freeze({
    processId,
    parentProcessId: Number(parentProcessId),
    sessionId,
    uid: Number(uid),
    gid: Number(gid),
    processStartTicks: startTicks,
    bootId,
  });
}

function sameRuntimePrincipal(requested, observed) {
  return observed !== null && requested.processId === observed.processId
    && requested.parentProcessId === observed.parentProcessId
    && requested.sessionId === observed.sessionId
    && requested.uid === observed.uid && requested.gid === observed.gid
    && requested.processStartTicks === observed.processStartTicks
    && requested.bootId === observed.bootId;
}

function validateLiveRuntimeSeparation(observer, workload) {
  if (!principalsSeparated(observer, workload)
    || typeof process.getuid !== "function" || typeof process.getgid !== "function") return false;
  const actualObserver = readLinuxProcessIdentity(process.pid);
  const actualWorkload = readLinuxProcessIdentity(workload.processId);
  return sameRuntimePrincipal(observer, actualObserver) && observer.uid === process.getuid()
    && observer.gid === process.getgid()
    && sameRuntimePrincipal(workload, actualWorkload)
    && workload.processId !== process.ppid;
}

function verifyRunDirectory(runId, phase, workloadUid) {
  if (process.platform !== "linux") return false;
  const path = posix.join(DIRECT_OBSERVER_LINUX_RUN_ROOT, runId, phase.toLowerCase());
  try {
    const stat = lstatSync(path, { bigint: true });
    const expectedNames = phaseCodes(phase).flatMap((code, index) => [
      `${String(index).padStart(2, "0")}-${code}.artifact`,
      `${String(index).padStart(2, "0")}-${code}.json`,
    ]).sort();
    const actualNames = readdirSync(path, { encoding: "utf8" }).sort();
    return stat.isDirectory() && !stat.isSymbolicLink()
      && stat.uid === BigInt(workloadUid) && (stat.mode & 0o777n) === 0o750n
      && realpathSync.native(path) === path
      && actualNames.length === expectedNames.length
      && actualNames.every((name, index) => name === expectedNames[index]);
  } catch {
    return false;
  }
}

export function verifyImmutableX10Sources() {
  const observations = [];
  for (const [name, binding] of Object.entries(IMMUTABLE_X10_BINDINGS)) {
    const path = resolve(CURRENT_SITE_ROOT, binding.path);
    const result = readBoundRegularFile(path, {
      maxBytes: binding.byteLength,
      expectedBytes: binding.byteLength,
      expectedSha256: binding.sha256,
    });
    if (result === null) return false;
    observations.push(Object.freeze({ name, path, ...binding, identity: result.identity }));
  }
  return Object.freeze(observations);
}

export function validateDirectEvidenceRecord(record, {
  phase, runId, code, index, sourceCheckpoint, observerPackage, workload,
  evaluationUnixSeconds,
} = {}) {
  let canonicalPayload;
  try {
    canonicalPayload = canonicalizeDirectObserverJson(record?.payload);
  } catch {
    return false;
  }
  return exactKeys(record, RECORD_KEYS) && record.schema === recordSchema(phase)
    && record.phase === phase && record.runId === runId && record.code === code
    && sameCanonical(record.sourceCheckpoint, sourceCheckpoint)
    && sameCanonical(record.observerPackage, observerPackage)
    && sameCanonical(record.workload, workload)
    && Number.isSafeInteger(record.capturedAtUnixSeconds)
    && Number.isSafeInteger(evaluationUnixSeconds)
    && record.capturedAtUnixSeconds > 0
    && record.capturedAtUnixSeconds <= evaluationUnixSeconds
      + DIRECT_OBSERVER_MAX_FUTURE_SKEW_SECONDS
    && evaluationUnixSeconds - record.capturedAtUnixSeconds
      <= DIRECT_OBSERVER_MAX_RECEIPT_AGE_SECONDS
    && validateDirectEvidencePayload(record.payload, {
      phase, runId, code, index, sourceCheckpoint, observerPackage, workload,
    })
    && record.payloadSha256 === canonicalDirectObserverSha256(
      `IAT_B3_${phase}_${code}_DIRECT_EVIDENCE_PAYLOAD_V1`, record.payload,
    )
    && record.payloadByteLength === Buffer.byteLength(canonicalPayload, "utf8")
    && record.reviewState === "PENDING_INDEPENDENT_RUNTIME_REVIEW";
}

function observeEvidenceRecord(descriptor, request, index, evaluationUnixSeconds) {
  const expectedCode = phaseCodes(request.phase)[index];
  if (!validDescriptor(descriptor, {
    phase: request.phase, runId: request.runId, index, code: expectedCode,
  })) return null;
  const result = readBoundRegularFile(descriptor.path, {
    maxBytes: DIRECT_OBSERVER_MAX_RECORD_BYTES,
    expectedBytes: descriptor.byteLength,
    expectedSha256: descriptor.sha256,
    expectedUid: request.workload.uid,
    expectedGid: request.workload.gid,
  });
  if (result === null) return null;
  let record;
  try {
    if (result.bytes.length >= 3 && result.bytes[0] === 0xef
      && result.bytes[1] === 0xbb && result.bytes[2] === 0xbf) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(result.bytes);
    record = parseStrictDirectObserverJson(text, `DIRECT_EVIDENCE_RECORD_${index}`);
  } catch {
    return null;
  }
  if (!validateDirectEvidenceRecord(record, {
    phase: request.phase, runId: request.runId, code: expectedCode, index,
    sourceCheckpoint: request.sourceCheckpoint,
    observerPackage: request.observerPackage, workload: request.workload,
    evaluationUnixSeconds,
  })) return null;
  const artifact = readBoundRegularFile(record.payload.artifactPath, {
    maxBytes: DIRECT_OBSERVER_MAX_RECORD_BYTES,
    expectedBytes: record.payload.artifactByteLength,
    expectedSha256: record.payload.artifactSha256,
    expectedUid: request.workload.uid,
    expectedGid: request.workload.gid,
  });
  if (artifact === null
    || (artifact.identity.dev === result.identity.dev
      && artifact.identity.ino === result.identity.ino)) return null;
  return Object.freeze({
    code: expectedCode, path: descriptor.path, sha256: descriptor.sha256,
    byteLength: descriptor.byteLength, identity: result.identity,
    capturedAtUnixSeconds: record.capturedAtUnixSeconds,
    payload: record.payload, payloadSha256: record.payloadSha256,
    payloadByteLength: record.payloadByteLength,
    artifactIdentity: artifact.identity, reviewState: record.reviewState,
  });
}

function uniqueObservationIdentities(observations) {
  const identities = new Set();
  for (const observation of observations) {
    for (const stat of [observation.identity, observation.artifactIdentity]) {
      const identity = `${stat.dev}:${stat.ino}`;
      if (identities.has(identity)) return false;
      identities.add(identity);
    }
  }
  return true;
}

export function observeDirectEvidence(request, { phase } = {}) {
  const started = process.hrtime.bigint();
  if (!validateDirectObserverRequest(request, { phase })) {
    throw new Error("DIRECT_EVIDENCE_OBSERVER_REQUEST_INVALID");
  }
  if (process.platform !== "linux") {
    throw new Error("DIRECT_EVIDENCE_OBSERVER_LINUX_ONLY_HOLD");
  }
  if (!validateLiveRuntimeSeparation(request.observer, request.workload)) {
    throw new Error("DIRECT_EVIDENCE_RUNTIME_PRINCIPAL_SEPARATION_INVALID");
  }
  if (!verifyRunDirectory(request.runId, phase, request.workload.uid)) {
    throw new Error("DIRECT_EVIDENCE_RUN_DIRECTORY_INVALID");
  }
  if (verifyImmutableX10Sources() === false) {
    throw new Error("DIRECT_EVIDENCE_IMMUTABLE_X10_MISMATCH");
  }
  if (process.hrtime.bigint() - started > DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS) {
    throw new Error("DIRECT_EVIDENCE_OBSERVER_DEADLINE_EXCEEDED");
  }
  const observedAtUnixSeconds = Math.floor(Date.now() / 1_000);
  const observations = [];
  for (let index = 0; index < request.observations.length; index += 1) {
    if (process.hrtime.bigint() - started > DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS) {
      throw new Error("DIRECT_EVIDENCE_OBSERVER_DEADLINE_EXCEEDED");
    }
    const observation = observeEvidenceRecord(
      request.observations[index], request, index, observedAtUnixSeconds,
    );
    if (observation === null) throw new Error("DIRECT_EVIDENCE_RECORD_REJECTED");
    observations.push(observation);
  }
  if (!uniqueObservationIdentities(observations)
    || observations.reduce((sum, observation) => sum + observation.byteLength
      + observation.payload.artifactByteLength, 0)
      > DIRECT_OBSERVER_MAX_AGGREGATE_BYTES
    || !verifyRunDirectory(request.runId, phase, request.workload.uid)
    || !validateLiveRuntimeSeparation(request.observer, request.workload)
    || process.hrtime.bigint() - started > DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS) {
    throw new Error("DIRECT_EVIDENCE_RUNTIME_IDENTITY_DRIFT");
  }
  const withoutDigest = {
    schema: receiptSchema(phase), phase, runId: request.runId,
    sourceCheckpoint: request.sourceCheckpoint, observerPackage: request.observerPackage,
    observer: request.observer, workload: request.workload, observedAtUnixSeconds,
    evidenceCodes: phaseCodes(phase), observations: Object.freeze(observations),
  };
  return Object.freeze({
    ...withoutDigest,
    receiptSha256: canonicalDirectObserverSha256(
      `IAT_B3_${phase}_DIRECT_EVIDENCE_OBSERVER_RECEIPT_V1`, withoutDigest,
    ),
  });
}

function validIdentity(value) {
  return exactKeys(value, IDENTITY_KEYS) && UNSIGNED_DECIMAL.test(value.dev)
    && UNSIGNED_DECIMAL.test(value.ino) && Number.isSafeInteger(value.mode)
    && value.mode > 0 && UNSIGNED_DECIMAL.test(value.uid)
    && UNSIGNED_DECIMAL.test(value.gid) && UNSIGNED_DECIMAL.test(value.size)
    && UNSIGNED_DECIMAL.test(value.mtimeNs) && UNSIGNED_DECIMAL.test(value.ctimeNs);
}

function validReceiptObservation(value, {
  phase, runId, expectedCode, index, sourceCheckpoint, observerPackage, workload,
} = {}) {
  return exactKeys(value, OBSERVATION_KEYS) && value.code === expectedCode
    && typeof value.path === "string" && posix.isAbsolute(value.path)
    && posix.normalize(value.path) === value.path && validateDigest(value.sha256)
    && Number.isSafeInteger(value.byteLength) && value.byteLength > 0
    && value.byteLength <= DIRECT_OBSERVER_MAX_RECORD_BYTES
    && validIdentity(value.identity) && validIdentity(value.artifactIdentity)
    && Number.isSafeInteger(value.capturedAtUnixSeconds)
    && validateDirectEvidencePayload(value.payload, {
      phase, runId, code: expectedCode, index, sourceCheckpoint, observerPackage, workload,
    })
    && value.payloadSha256 === canonicalDirectObserverSha256(
      `IAT_B3_${phase}_${expectedCode}_DIRECT_EVIDENCE_PAYLOAD_V1`, value.payload,
    )
    && value.payloadByteLength === Buffer.byteLength(
      canonicalizeDirectObserverJson(value.payload), "utf8",
    )
    && value.reviewState === "PENDING_INDEPENDENT_RUNTIME_REVIEW";
}

function exactOrderedStrings(value, expected) {
  return Array.isArray(value) && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function receiptCore(receipt) {
  return Object.fromEntries(Object.entries(receipt)
    .filter(([key]) => key !== "receiptSha256"));
}

export function validateDirectEvidenceReceipt(receipt, {
  phase, expectedRunId, expectedSourceCheckpoint, expectedObserverPackage,
} = {}) {
  const started = process.hrtime.bigint();
  const evaluationUnixSeconds = Math.floor(Date.now() / 1_000);
  const expectedCodes = phaseCodes(phase);
  if (expectedCodes === null || !validateRunId(expectedRunId)
    || !validateSourceCheckpoint(expectedSourceCheckpoint)
    || !validateObserverPackage(expectedObserverPackage)
    || expectedObserverPackage.treeSha === expectedSourceCheckpoint.treeSha
    || verifyImmutableX10Sources() === false || !exactKeys(receipt, RECEIPT_KEYS)
    || receipt.schema !== receiptSchema(phase) || receipt.phase !== phase
    || receipt.runId !== expectedRunId
    || !sameCanonical(receipt.sourceCheckpoint, expectedSourceCheckpoint)
    || !sameCanonical(receipt.observerPackage, expectedObserverPackage)
    || receipt.observerPackage.treeSha === receipt.sourceCheckpoint.treeSha
    || !principalsSeparated(receipt.observer, receipt.workload)
    || !validateLiveRuntimeSeparation(receipt.observer, receipt.workload)
    || !Number.isSafeInteger(receipt.observedAtUnixSeconds)
    || receipt.observedAtUnixSeconds <= 0
    || receipt.observedAtUnixSeconds > evaluationUnixSeconds
      + DIRECT_OBSERVER_MAX_FUTURE_SKEW_SECONDS
    || evaluationUnixSeconds - receipt.observedAtUnixSeconds
      > DIRECT_OBSERVER_MAX_RECEIPT_AGE_SECONDS
    || !exactOrderedStrings(receipt.evidenceCodes, expectedCodes)
    || !Array.isArray(receipt.observations)
    || receipt.observations.length !== expectedCodes.length
    || !receipt.observations.every((entry, index) => validReceiptObservation(entry, {
      phase, runId: expectedRunId, expectedCode: expectedCodes[index], index,
      sourceCheckpoint: expectedSourceCheckpoint,
      observerPackage: expectedObserverPackage, workload: receipt.workload,
    }))
    || !uniqueObservationIdentities(receipt.observations)
    || !validateDigest(receipt.receiptSha256)
    || receipt.receiptSha256 !== canonicalDirectObserverSha256(
      `IAT_B3_${phase}_DIRECT_EVIDENCE_OBSERVER_RECEIPT_V1`, receiptCore(receipt),
    )
    || !verifyRunDirectory(expectedRunId, phase, receipt.workload.uid)
    || process.hrtime.bigint() - started
      > DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS) return false;
  const request = {
    schema: DIRECT_OBSERVER_REQUEST_SCHEMA, phase, runId: expectedRunId,
    sourceCheckpoint: expectedSourceCheckpoint, observerPackage: expectedObserverPackage,
    observer: receipt.observer, workload: receipt.workload,
    observations: receipt.observations.map(({ code, path, sha256, byteLength }) => ({
      code, path, sha256, byteLength,
    })),
  };
  if (!validateDirectObserverRequest(request, { phase })) return false;
  for (let index = 0; index < receipt.observations.length; index += 1) {
    if (process.hrtime.bigint() - started > DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS) {
      return false;
    }
    const repeated = observeEvidenceRecord(
      request.observations[index], request, index, evaluationUnixSeconds,
    );
    if (repeated === null || !sameCanonical(repeated, receipt.observations[index])) {
      return false;
    }
  }
  return verifyRunDirectory(expectedRunId, phase, receipt.workload.uid)
    && validateLiveRuntimeSeparation(receipt.observer, receipt.workload)
    && process.hrtime.bigint() - started
      <= DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS;
}

function verifyReceiptParentDirectory(runId, expectedUid) {
  if (process.platform !== "linux" || !validateRunId(runId)
    || !Number.isSafeInteger(expectedUid) || expectedUid < 0) return false;
  const path = posix.join(DIRECT_OBSERVER_LINUX_RUN_ROOT, runId);
  try {
    const stat = lstatSync(path, { bigint: true });
    return stat.isDirectory() && !stat.isSymbolicLink() && stat.nlink >= 1n
      && stat.uid === BigInt(expectedUid) && (stat.mode & 0o777n) === 0o750n
      && realpathSync.native(path) === path;
  } catch {
    return false;
  }
}

export function persistDirectEvidenceReceipt(receipt, { phase } = {}) {
  if (process.platform !== "linux" || typeof process.getuid !== "function"
    || !validateDirectEvidenceReceipt(receipt, {
      phase,
      expectedRunId: receipt?.runId,
      expectedSourceCheckpoint: receipt?.sourceCheckpoint,
      expectedObserverPackage: receipt?.observerPackage,
    })
    || receipt.observer.uid !== process.getuid()
    || !verifyReceiptParentDirectory(receipt.runId, receipt.observer.uid)) {
    throw new Error("DIRECT_EVIDENCE_RECEIPT_PERSISTENCE_PREREQUISITE_HOLD");
  }
  const path = expectedDirectEvidenceReceiptPath(receipt.runId, phase);
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  if (path === null || bytes.length <= 0 || bytes.length > DIRECT_OBSERVER_MAX_INPUT_BYTES) {
    throw new Error("DIRECT_EVIDENCE_RECEIPT_PERSISTENCE_SIZE_HOLD");
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let handle = null;
  let created = false;
  try {
    handle = openSync(path, "wx", 0o640);
    created = true;
    fchmodSync(handle, 0o640);
    writeFileSync(handle, bytes);
    fsyncSync(handle);
    const stat = fstatSync(handle, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || stat.uid !== BigInt(process.getuid())
      || (stat.mode & 0o777n) !== 0o640n || stat.size !== BigInt(bytes.length)) {
      throw new Error("DIRECT_EVIDENCE_RECEIPT_PERSISTENCE_IDENTITY_HOLD");
    }
    closeSync(handle);
    handle = null;
    const reopened = readBoundRegularFile(path, {
      maxBytes: DIRECT_OBSERVER_MAX_INPUT_BYTES,
      expectedBytes: bytes.length,
      expectedSha256: sha256,
      expectedUid: process.getuid(),
      expectedGid: process.getgid(),
    });
    if (reopened === null) {
      throw new Error("DIRECT_EVIDENCE_RECEIPT_PERSISTENCE_REOPEN_HOLD");
    }
    return Object.freeze({ path, sha256, byteLength: bytes.length });
  } catch (error) {
    if (handle !== null) closeSync(handle);
    if (created) {
      try { unlinkSync(path); } catch { /* exact fail-closed residue is reported */ }
    }
    throw error;
  }
}

export function readDirectEvidenceReceiptArtifact(descriptor, {
  phase, expectedRunId, expectedSourceCheckpoint, expectedObserverPackage,
} = {}) {
  const expectedPath = expectedDirectEvidenceReceiptPath(expectedRunId, phase);
  if (expectedPath === null || !exactKeys(descriptor, RECEIPT_DESCRIPTOR_KEYS)
    || descriptor.path !== expectedPath || !validateDigest(descriptor.sha256)
    || !Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength <= 0
    || descriptor.byteLength > DIRECT_OBSERVER_MAX_INPUT_BYTES) return false;
  const result = readBoundRegularFile(descriptor.path, {
    maxBytes: DIRECT_OBSERVER_MAX_INPUT_BYTES,
    expectedBytes: descriptor.byteLength,
    expectedSha256: descriptor.sha256,
  });
  if (result === null || (result.identity.mode & 0o777) !== 0o640) return false;
  let receipt;
  try {
    if (result.bytes.length >= 3 && result.bytes[0] === 0xef
      && result.bytes[1] === 0xbb && result.bytes[2] === 0xbf) return false;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(result.bytes);
    receipt = parseStrictDirectObserverJson(text, "DIRECT_EVIDENCE_RECEIPT");
  } catch {
    return false;
  }
  if (String(receipt?.observer?.uid) !== result.identity.uid
    || String(receipt?.observer?.gid) !== result.identity.gid
    || !validateDirectEvidenceReceipt(receipt, {
      phase, expectedRunId, expectedSourceCheckpoint, expectedObserverPackage,
    })) return false;
  return Object.freeze({
    receipt,
    artifactSha256: result.sha256,
    artifactByteLength: result.bytes.length,
    artifactIdentity: result.identity,
  });
}

export function validateDirectEvidenceReceiptArtifact(descriptor, context = {}) {
  return readDirectEvidenceReceiptArtifact(descriptor, context) !== false;
}

function validBlockers(value, requiredBlocker) {
  return Array.isArray(value) && value.length > 0
    && value.every((entry) => exactKeys(entry, ["code", "detail"])
      && typeof entry.code === "string" && entry.code.length > 0
      && typeof entry.detail === "string" && entry.detail.length > 0)
    && new Set(value.map(({ code }) => code)).size === value.length
    && value.some((entry) => sameCanonical(entry, requiredBlocker))
    && !value.some((entry, index, entries) => index > 0
      && (entries[index - 1].code.localeCompare(entry.code)
        || entries[index - 1].detail.localeCompare(entry.detail)) > 0);
}

function falseLegacyAuthorityFields(value) {
  return value.gate8Go === false && value.requestAuthorizationPermitted === false
    && value.publicDevnetAuthorizationMayBeRequested === false
    && value.executionAuthorized === false && value.publicDevnetAuthorized === false
    && value.releaseAuthorized === false && value.mainnetExecutionAuthorized === false
    && value.mainnetStatus === "HOLD";
}

function validateFixedLegacyInput(phase, value, expectedSourceCheckpoint) {
  const oracle = phase === "PRE" ? FIXED_X10_LEGACY_ORACLE.pre
    : phase === "POST" ? FIXED_X10_LEGACY_ORACLE.post : null;
  return oracle !== null && exactKeys(value, ["sourceCheckpoint"])
    && sameCanonical(value.sourceCheckpoint, expectedSourceCheckpoint)
    && canonicalDirectObserverSha256(
      `IAT_B3_${phase}_DEVNET_INPUT_V1`, value,
    ) === oracle.inputSha256;
}

export function validateLegacyPreAssessmentArtifact(
  value, expectedSourceCheckpoint, legacyInput,
) {
  if (!exactKeys(value, PRE_LEGACY_KEYS)
    || value.schema !== PRE_LEGACY_ASSESSMENT_SCHEMA || value.status !== "HOLD"
    || !sameCanonical(value.sourceCheckpoint, expectedSourceCheckpoint)
    || !validateFixedLegacyInput("PRE", legacyInput, expectedSourceCheckpoint)
    || value.inputSha256 !== FIXED_X10_LEGACY_ORACLE.pre.inputSha256
    || !(value.executionIntentSha256 === null
      || validateDigest(value.executionIntentSha256))
    || !Array.isArray(value.clearedEvidenceCodes)
    || value.clearedEvidenceCodes.length !== 0 || value.clearedEvidenceCount !== 0
    || value.requiredEvidenceCount !== PRE_DIRECT_EVIDENCE_CODES.length
    || !sameCanonical(
      value.independentVerification, PRE_LEGACY_INDEPENDENT_VERIFICATION,
    )
    || !sameCanonical(value.preservedPendingFacts, LEGACY_PENDING_FACTS)
    || !sameCanonical(value.preservedInvariant, LEGACY_MAINNET_HOLD_INVARIANT)
    || !sameCanonical(value.safety, LEGACY_ASSESSMENT_SAFETY)
    || !validBlockers(value.blockers, PRE_LEGACY_OBSERVER_BLOCKER)
    || !PRE_DIRECT_EVIDENCE_CODES.every((code) =>
      value.blockers.some((entry) => entry.code === code))
    || !falseLegacyAuthorityFields(value) || value.devnetExecuted !== false
    || value.publicDevnetExecutionProvenanceAvailable !== false
    || value.assessmentSha256
      !== FIXED_X10_LEGACY_ORACLE.pre.assessmentSha256) return false;
  const core = Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "assessmentSha256"));
  return value.assessmentSha256 === canonicalDirectObserverSha256(
    "IAT_B3_PRE_DEVNET_ASSESSMENT_V1", core,
  );
}

export function validateLegacyPostAssessmentArtifact(
  value, expectedSourceCheckpoint, legacyInput,
) {
  if (!exactKeys(value, POST_LEGACY_KEYS)
    || value.schema !== POST_LEGACY_ASSESSMENT_SCHEMA || value.status !== "HOLD"
    || !sameCanonical(value.sourceCheckpoint, expectedSourceCheckpoint)
    || !validateFixedLegacyInput("POST", legacyInput, expectedSourceCheckpoint)
    || !(value.preVerdictSha256 === null || validateDigest(value.preVerdictSha256))
    || !(value.grantSha256 === null || validateDigest(value.grantSha256))
    || !["NOT_STARTED", "UNVERIFIED_OR_UNRECONCILED"].includes(value.executionState)
    || !Array.isArray(value.factStates) || value.factStates.length !== 2
    || !value.factStates.every((entry) => exactKeys(entry, ["code", "state"])
      && typeof entry.code === "string" && typeof entry.state === "string")
    || value.factStates[0].code !== "DEVNET_NOT_EXECUTED"
    || value.factStates[1].code !== "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE"
    || (value.executionState === "NOT_STARTED"
      && (value.factStates[0].state !== "TRUE_EXPECTED_PENDING"
        || value.factStates[1].state !== "TRUE_PENDING_OR_UNACCEPTED"))
    || (value.executionState === "UNVERIFIED_OR_UNRECONCILED"
      && (value.factStates[0].state !== "UNRESOLVED_DIRECT_OBSERVATION_REQUIRED"
        || value.factStates[1].state !== "TRUE_PENDING_OR_UNACCEPTED"))
    || !sameCanonical(value.preservedInvariant, LEGACY_MAINNET_HOLD_INVARIANT)
    || !sameCanonical(value.safety, LEGACY_ASSESSMENT_SAFETY)
    || !validBlockers(value.blockers, POST_LEGACY_OBSERVER_BLOCKER)
    || !falseLegacyAuthorityFields(value)
    || value.devnetRehearsalEvidenceAccepted !== false
    || value.independentPostVerificationRequired !== true
    || value.assessmentSha256
      !== FIXED_X10_LEGACY_ORACLE.post.assessmentSha256) return false;
  const core = Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "assessmentSha256"));
  return value.assessmentSha256 === canonicalDirectObserverSha256(
    "IAT_B3_POST_DEVNET_ASSESSMENT_V1", core,
  );
}

export function validateDirectAssessmentBindings(value) {
  return validateRunId(value?.expectedRunId)
    && validateSourceCheckpoint(value?.expectedK45SourceCheckpoint)
    && sameCanonical(value.expectedK45SourceCheckpoint, K45_SOURCE_CHECKPOINT)
    && validateObserverPackage(value?.expectedObserverPackage)
    && value.expectedObserverPackage.treeSha !== value.expectedK45SourceCheckpoint.treeSha;
}

export function readStrictDirectObserverFile(
  inputPath,
  label = "IAT_B3_DIRECT_OBSERVER_INPUT",
) {
  const result = readBoundRegularFile(inputPath, {
    maxBytes: DIRECT_OBSERVER_MAX_INPUT_BYTES,
  });
  if (result === null) throw new Error(`${label}_FILE_INVALID`);
  if (result.bytes.length >= 3 && result.bytes[0] === 0xef
    && result.bytes[1] === 0xbb && result.bytes[2] === 0xbf) {
    throw new Error(`${label}_BOM_FORBIDDEN`);
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(result.bytes);
  return parseStrictDirectObserverJson(text, label);
}

export function directObserverSafety() {
  return Object.freeze({
    sourceImplementationOnly: true,
    x10ExecutedByThisPackage: false,
    fixedX10InputOutputOracleOnly: true,
    callerAuthoredEvidenceAccepted: false,
    workloadArtifactFactsAccepted: false,
    observerOwnedReceiptArtifactRequired: true,
    observerPackageGitIdentityRequiresExternalG8CReview: true,
    injectedTestEvidenceAccepted: false,
    directEvidenceAcceptedForAuthorization: false,
    requestAuthorizationPermitted: false,
    executionAuthorized: false,
    publicDevnetAuthorized: false,
    signingAuthorized: false,
    fundingAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  });
}

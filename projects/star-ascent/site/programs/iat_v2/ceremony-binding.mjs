import {
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
} from "./artifact-binding.mjs";

export const IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_SCHEMA =
  "iat-v2-devnet-program-ceremony-runtime-binding/v1";

export const IAT_V2_DEVNET_PROGRAM_CEREMONY_LIMITATIONS = Object.freeze([
  "Source and public-CI binding only; not a Devnet signature, transaction, broadcast, deployment, or release result.",
  "Fresh ceremony source and runtime evidence do not replace the immutable migration artifact built from a03fe71dd66cd1650b8d0353e486786df30b83e9 in public run 33161771816.",
  "Does not authorize signing, broadcast, funding, deployment, release, or Mainnet.",
]);

const EXACT_FIELDS = Object.freeze([
  "artifactBuildRunAttempt",
  "artifactBuildRunId",
  "artifactBytes",
  "artifactEvidenceManifestSha256",
  "artifactSha256",
  "artifactSourceHeadCommit",
  "checkoutCommit",
  "checkoutRelation",
  "checkoutTree",
  "ciRunAttempt",
  "ciRunId",
  "limitations",
  "mainnetStatus",
  "network",
  "repository",
  "repositoryId",
  "runnerArch",
  "runnerOs",
  "runtimeClosureSha256",
  "runtimeEvidenceManifestSha256",
  "schema",
  "sourceHeadCommit",
  "sourceHeadTree",
  "status",
  "workflowEvent",
  "workflowRef",
]);

const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const WORKFLOW = /^InternalAgencyIO\/InternalAgency\/\.github\/workflows\/iat-v2-proof\.yml@refs\/pull\/[1-9][0-9]*\/merge$/u;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, expected, label) {
  check(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  check(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()),
    `${label} fields are not exact`,
  );
}

function positiveInteger(value, label) {
  check(Number.isSafeInteger(value) && value > 0, `${label} must be a positive safe integer`);
}

function base58ByteLength(value) {
  if (!BASE58.test(value ?? "")) return -1;
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(BASE58_ALPHABET.indexOf(character));
  let bytes = 0;
  while (number > 0n) {
    bytes += 1;
    number >>= 8n;
  }
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === "1") zeroes += 1;
  return bytes + zeroes;
}

function assertImmutableArtifactTuple(value) {
  check(value.artifactBuildRunAttempt === 1, "Ceremony binding changed the immutable artifact run attempt");
  check(
    value.artifactBuildRunId === IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
    "Ceremony binding changed the immutable artifact build run",
  );
  check(
    value.artifactBytes === IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    "Ceremony binding changed the immutable artifact byte length",
  );
  check(
    value.artifactEvidenceManifestSha256 === IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
    "Ceremony binding changed the immutable artifact evidence digest",
  );
  check(
    value.artifactSha256 === IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
    "Ceremony binding changed the immutable artifact SHA-256",
  );
  check(
    value.artifactSourceHeadCommit === IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
    "Ceremony binding changed the immutable artifact source",
  );
}

export function parseIatV2DevnetProgramCeremonyBinding(value, {
  requireBound = false,
} = {}) {
  exactKeys(value, EXACT_FIELDS, "Devnet program ceremony binding");
  check(value.schema === IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_SCHEMA, "Ceremony binding schema drifted");
  check(value.status === "UNBOUND" || value.status === "BOUND", "Ceremony binding status is invalid");
  check(value.network === "devnet" && value.mainnetStatus === "HOLD", "Ceremony binding network policy drifted");
  check(
    JSON.stringify(value.limitations) === JSON.stringify(IAT_V2_DEVNET_PROGRAM_CEREMONY_LIMITATIONS),
    "Ceremony binding limitations drifted",
  );
  check(
    value.repository === "InternalAgencyIO/InternalAgency" && value.repositoryId === 1_313_660_798,
    "Ceremony binding repository identity drifted",
  );
  check(value.runnerOs === "Linux" && value.runnerArch === "X64", "Ceremony binding runner identity drifted");
  check(
    value.workflowEvent === "pull_request" && value.checkoutRelation === "PR_MERGE_SECOND_PARENT",
    "Ceremony binding workflow relation drifted",
  );
  assertImmutableArtifactTuple(value);

  if (value.status === "UNBOUND") {
    for (const field of [
      "checkoutCommit",
      "checkoutTree",
      "ciRunAttempt",
      "ciRunId",
      "runtimeClosureSha256",
      "runtimeEvidenceManifestSha256",
      "sourceHeadCommit",
      "sourceHeadTree",
      "workflowRef",
    ]) check(value[field] === null, `UNBOUND ceremony binding field ${field} must be null`);
    check(!requireBound, "Devnet program ceremony source is not bound to fresh public CI");
    return Object.freeze({ ...value, limitations: Object.freeze([...value.limitations]) });
  }

  check(COMMIT.test(value.sourceHeadCommit ?? ""), "Ceremony source commit is invalid");
  check(COMMIT.test(value.sourceHeadTree ?? ""), "Ceremony source tree is invalid");
  check(COMMIT.test(value.checkoutCommit ?? ""), "Ceremony CI checkout commit is invalid");
  check(COMMIT.test(value.checkoutTree ?? ""), "Ceremony CI checkout tree is invalid");
  positiveInteger(value.ciRunId, "Ceremony CI run ID");
  positiveInteger(value.ciRunAttempt, "Ceremony CI run attempt");
  check(SHA256.test(value.runtimeClosureSha256 ?? ""), "Ceremony runtime closure SHA-256 is invalid");
  check(SHA256.test(value.runtimeEvidenceManifestSha256 ?? ""), "Ceremony runtime evidence SHA-256 is invalid");
  check(
    value.runtimeEvidenceManifestSha256 !== value.artifactEvidenceManifestSha256,
    "Ceremony runtime evidence must remain distinct from immutable artifact evidence",
  );
  check(WORKFLOW.test(value.workflowRef ?? ""), "Ceremony workflow reference is invalid");
  check(
    value.sourceHeadCommit !== value.artifactSourceHeadCommit,
    "Fresh ceremony source must differ from the immutable artifact source",
  );
  return Object.freeze({ ...value, limitations: Object.freeze([...value.limitations]) });
}

export function createIatV2DevnetProgramCeremonyEvidenceBinding({
  binding,
  mint,
} = {}) {
  const exact = parseIatV2DevnetProgramCeremonyBinding(binding, { requireBound: true });
  check(base58ByteLength(mint) === 32, "Ceremony evidence binding requires an exact 32-byte mint");
  return Object.freeze({
    sourceCommit: exact.sourceHeadCommit,
    programArtifactSha256: exact.artifactSha256,
    mint,
  });
}

export const IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_FIELDS = EXACT_FIELDS;

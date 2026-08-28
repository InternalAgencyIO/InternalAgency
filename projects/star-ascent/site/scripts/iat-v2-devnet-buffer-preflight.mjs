#!/usr/bin/env node

import "./lib/iat-v2-attended-node-runtime.mjs";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const {
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
} = await import("../programs/iat_v2/artifact-binding.mjs");
const {
  IAT_V2_SBF_ARTIFACT_INPUT_PATHS,
  validateSbfEvidence,
} = await import("./validate-iat-v2-ci-sbf-evidence.mjs");
const { createIatV2AttendedGitRunner } = await import("./lib/iat-v2-attended-git-runtime.mjs");

const DEVNET_RPC = "https://api.devnet.solana.com";
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const PROGRAM_ID = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const PROGRAM_DATA_ADDRESS = "6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP";
const PROGRAM_ADMIN = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const DEVNET_DEPLOYER = "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4";
const UPGRADEABLE_LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const PROGRAM_DATA_METADATA_BYTES = 45;
const BUFFER_METADATA_BYTES = 37;

// Reviewed static successor binding from the successful public-GitHub
// iat-v2-proof run for the exact migration source. The binary and evidence
// manifest remain untracked, operator-supplied inputs and must independently
// match every pin before either buffer helper may proceed.
export const IAT_V2_MIGRATION_ARTIFACT_BINDING = Object.freeze({
  schema: "iat-v2-migration-artifact-binding/v1",
  status: "BOUND",
  artifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  artifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  sourceHeadCommit: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  sourceHeadTree: "d92c532f41dacf04e8d5f1f13b261b963d05f001",
  ciRunId: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  ciRunAttempt: 1,
  workflowRef:
    "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
  evidenceManifestSha256: IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
});

export const IAT_V2_ARTIFACT_INPUT_PATHS = IAT_V2_SBF_ARTIFACT_INPUT_PATHS;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha256Pattern = /^[0-9a-f]{64}$/u;
const commitPattern = /^[0-9a-f]{40}$/u;

export class BufferPreflightError extends Error {
  constructor(code, message, { hold = true } = {}) {
    super(message);
    this.name = "BufferPreflightError";
    this.code = code;
    this.hold = hold;
  }
}

function fail(code, message, options) {
  throw new BufferPreflightError(code, message, options);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
}

function exactKeys(value, expectedKeys, label) {
  check(value && typeof value === "object" && !Array.isArray(value), "EVIDENCE_SCHEMA_HOLD", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  check(JSON.stringify(actual) === JSON.stringify(expected), "EVIDENCE_SCHEMA_HOLD", `${label} fields are not exact`);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function canonicalRegularFile(projectRoot, candidate, label) {
  const absolute = isAbsolute(candidate) ? candidate : resolve(projectRoot, candidate);
  let entry;
  try {
    entry = lstatSync(absolute);
  } catch {
    fail("ARTIFACT_INPUT_MISSING_HOLD", `${label} is missing`);
  }
  check(entry.isFile() && !entry.isSymbolicLink(), "NONCANONICAL_ARTIFACT_HOLD", `${label} must be a regular non-symlink file`);
  const root = realpathSync(projectRoot);
  const relativePath = normalize(relative(root, realpathSync(absolute)));
  check(relativePath !== "" && !relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && relativePath !== "..", "NONCANONICAL_ARTIFACT_HOLD", `${label} resolves outside the project root`);
  return absolute;
}

const reviewedGitRunners = new Map();

function reviewedGitRunner(projectRoot) {
  const root = realpathSync(projectRoot);
  if (!reviewedGitRunners.has(root)) reviewedGitRunners.set(root, createIatV2AttendedGitRunner(root));
  return reviewedGitRunners.get(root);
}

function defaultGit(projectRoot, args, options = {}) {
  return reviewedGitRunner(projectRoot).run(projectRoot, args, options);
}

function assertBoundShape(binding) {
  exactKeys(binding, [
    "schema",
    "status",
    "artifactSha256",
    "artifactBytes",
    "sourceHeadCommit",
    "sourceHeadTree",
    "ciRunId",
    "ciRunAttempt",
    "workflowRef",
    "evidenceManifestSha256",
  ], "migration artifact binding");
  check(binding.schema === "iat-v2-migration-artifact-binding/v1", "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "migration artifact binding schema drifted");
  if (binding.status !== "BOUND") {
    fail("MIGRATION_ARTIFACT_UNBOUND_HOLD", "migration artifact is not yet bound to public CI evidence");
  }
  check(sha256Pattern.test(binding.artifactSha256), "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound artifact SHA-256 is invalid");
  check(Number.isSafeInteger(binding.artifactBytes) && binding.artifactBytes > 0, "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound artifact byte length is invalid");
  check(commitPattern.test(binding.sourceHeadCommit), "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound source-head commit is invalid");
  check(commitPattern.test(binding.sourceHeadTree), "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound source-head tree is invalid");
  check(Number.isSafeInteger(binding.ciRunId) && binding.ciRunId > 0, "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound CI run ID is invalid");
  check(Number.isSafeInteger(binding.ciRunAttempt) && binding.ciRunAttempt > 0, "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound CI run attempt is invalid");
  check(/^InternalAgencyIO\/InternalAgency\/\.github\/workflows\/iat-v2-proof\.yml@refs\/pull\/[1-9][0-9]*\/merge$/u.test(binding.workflowRef), "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound workflow reference is invalid");
  check(sha256Pattern.test(binding.evidenceManifestSha256), "MIGRATION_ARTIFACT_BINDING_SCHEMA_HOLD", "bound evidence SHA-256 is invalid");
}

export function verifyMigrationArtifactBinding({
  projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  artifactPath = "target/verifiable/iat_v2.so",
  evidencePath = "target/verifiable/iat-v2-build-evidence.json",
  binding = IAT_V2_MIGRATION_ARTIFACT_BINDING,
  git = defaultGit,
  gitIdentity = null,
  validateCiEvidence = validateSbfEvidence,
} = {}) {
  assertBoundShape(binding);

  const artifact = canonicalRegularFile(projectRoot, artifactPath, "migration artifact");
  const evidence = canonicalRegularFile(projectRoot, evidencePath, "CI evidence manifest");
  const artifactBytes = readFileSync(artifact);
  const evidenceBytes = readFileSync(evidence);
  const evidenceText = evidenceBytes.toString("utf8");
  const manifest = JSON.parse(evidenceText);

  let canonicalCi;
  let reviewedGitIdentity = gitIdentity;
  try {
    if (git === defaultGit) reviewedGitIdentity = reviewedGitRunner(projectRoot).identity;
    canonicalCi = validateCiEvidence({
      projectRoot,
      manifestPath: evidencePath,
      allowDescendantCheckout: true,
      git,
    });
  } catch (error) {
    fail(
      "CANONICAL_CI_EVIDENCE_HOLD",
      `canonical CI SBF evidence validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  check(evidenceText === `${JSON.stringify(sortJson(manifest), null, 2)}\n`, "EVIDENCE_CANONICAL_JSON_HOLD", "CI evidence is not canonical sorted-key JSON");
  check(sha256(evidenceBytes) === binding.evidenceManifestSha256, "EVIDENCE_DIGEST_MISMATCH_HOLD", "CI evidence SHA-256 does not match the checked-in binding");
  check(canonicalCi?.manifestSha256 === binding.evidenceManifestSha256, "EVIDENCE_DIGEST_MISMATCH_HOLD", "canonical CI validation returned a different evidence digest");
  check(canonicalCi?.sourceHeadCommit === binding.sourceHeadCommit, "EVIDENCE_SOURCE_BINDING_HOLD", "canonical CI validation returned a different source-head commit");
  check(
    canonicalCi?.runUrl === `https://github.com/InternalAgencyIO/InternalAgency/actions/runs/${binding.ciRunId}/attempts/${binding.ciRunAttempt}`,
    "EVIDENCE_PROVENANCE_HOLD",
    "canonical CI validation returned a different public run receipt",
  );
  check(artifactBytes.length === binding.artifactBytes, "ARTIFACT_BYTES_MISMATCH_HOLD", "migration artifact byte length does not match the checked-in binding");
  check(sha256(artifactBytes) === binding.artifactSha256, "ARTIFACT_DIGEST_MISMATCH_HOLD", "migration artifact SHA-256 does not match the checked-in binding");

  exactKeys(manifest, ["schema", "status", "ciProvenance", "buildContainer", "sourceBinding", "programId", "toolchain", "artifacts", "limitations"], "CI evidence manifest");
  check(manifest.schema === "iat-v2-ci-verifiable-sbf-evidence/v5", "EVIDENCE_SCHEMA_HOLD", "CI evidence schema drifted");
  check(manifest.status === "BUILD_ONLY_HOLD", "EVIDENCE_STATUS_HOLD", "CI evidence must remain BUILD_ONLY_HOLD");
  check(manifest.programId === PROGRAM_ID, "EVIDENCE_PROGRAM_ID_HOLD", "CI evidence program ID drifted");
  check(JSON.stringify(manifest.limitations) === JSON.stringify([
    "Build evidence only; not signed Devnet evidence.",
    "Does not authorize deployment, signing, broadcast, funding, or Mainnet launch.",
  ]), "EVIDENCE_LIMITATIONS_HOLD", "CI evidence limitations drifted");

  const provenance = manifest.ciProvenance;
  check(provenance?.serverUrl === "https://github.com", "EVIDENCE_PROVENANCE_HOLD", "CI evidence is not from public GitHub");
  check(provenance?.repository === "InternalAgencyIO/InternalAgency" && provenance?.repositoryId === 1_313_660_798, "EVIDENCE_PROVENANCE_HOLD", "CI evidence repository drifted");
  check(provenance?.workflowRef === binding.workflowRef, "EVIDENCE_PROVENANCE_HOLD", "CI workflow reference does not match the checked-in binding");
  check(provenance?.runId === binding.ciRunId && provenance?.runAttempt === binding.ciRunAttempt, "EVIDENCE_PROVENANCE_HOLD", "CI run identity does not match the checked-in binding");
  check(provenance?.runnerOs === "Linux" && provenance?.runnerArch === "X64", "EVIDENCE_PROVENANCE_HOLD", "CI runner platform drifted");

  const source = manifest.sourceBinding;
  check(source?.workflowEvent === "pull_request" && source?.checkoutRelation === "PR_MERGE_SECOND_PARENT", "EVIDENCE_SOURCE_BINDING_HOLD", "CI source relation is not a pull-request merge binding");
  check(source?.sourceHeadCommit === binding.sourceHeadCommit && source?.sourceHeadTree === binding.sourceHeadTree, "EVIDENCE_SOURCE_BINDING_HOLD", "CI source head does not match the checked-in binding");
  check(source?.trackedWorktree === "CLEAN", "EVIDENCE_SOURCE_BINDING_HOLD", "CI evidence does not declare a clean tracked worktree");
  check(manifest.artifacts?.programBinary?.path === "target/verifiable/iat_v2.so", "EVIDENCE_ARTIFACT_RECORD_HOLD", "CI artifact path drifted");
  check(manifest.artifacts.programBinary.sha256 === binding.artifactSha256 && manifest.artifacts.programBinary.bytes === binding.artifactBytes, "EVIDENCE_ARTIFACT_RECORD_HOLD", "CI artifact record does not match the checked-in binding");

  try {
    git(projectRoot, ["cat-file", "-e", `${binding.sourceHeadCommit}^{commit}`]);
  } catch {
    fail("SOURCE_HEAD_MISSING_HOLD", "bound migration source head is unavailable in Git");
  }
  check(git(projectRoot, ["rev-parse", `${binding.sourceHeadCommit}^{tree}`]) === binding.sourceHeadTree, "SOURCE_TREE_MISMATCH_HOLD", "bound source-head tree does not match Git");
  try {
    git(projectRoot, ["merge-base", "--is-ancestor", binding.sourceHeadCommit, "HEAD"]);
  } catch {
    fail("SOURCE_HEAD_NOT_ANCESTOR_HOLD", "bound migration source is not an ancestor of the current checkout");
  }
  try {
    git(projectRoot, ["diff", "--no-ext-diff", "--no-textconv", "--quiet", binding.sourceHeadCommit, "--", ...IAT_V2_ARTIFACT_INPUT_PATHS]);
  } catch {
    fail("ARTIFACT_INPUT_DRIFT_HOLD", "artifact-producing inputs drifted after the bound CI source head");
  }

  return Object.freeze({
    schema: "iat-v2-migration-artifact-preflight/v1",
    status: "PASS",
    network: "devnet",
    programId: PROGRAM_ID,
    artifactSha256: binding.artifactSha256,
    artifactBytes: binding.artifactBytes,
    sourceHeadCommit: binding.sourceHeadCommit,
    sourceHeadTree: binding.sourceHeadTree,
    gitPath: reviewedGitIdentity?.path ?? null,
    gitVersion: reviewedGitIdentity?.version ?? null,
    gitSha256: reviewedGitIdentity?.sha256 ?? null,
    gitBytes: reviewedGitIdentity?.bytes ?? null,
    ciRunId: binding.ciRunId,
    ciRunAttempt: binding.ciRunAttempt,
    evidenceManifestSha256: binding.evidenceManifestSha256,
    signing: false,
    broadcast: false,
  });
}

function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail("CAPACITY_INPUT_HOLD", `${label} must be a non-negative safe integer`, { hold: false });
  }
  return value;
}

export function calculateUpgradeCapacityPlan({
  artifactBytes,
  currentProgramCapacityBytes,
  currentProgramDataBytes,
  currentProgramDataLamports,
  targetProgramDataRentLamports,
  bufferRentLamports,
  deployerLamports,
  adminLamports,
}) {
  for (const [label, value] of Object.entries({
    artifactBytes,
    currentProgramCapacityBytes,
    currentProgramDataBytes,
    currentProgramDataLamports,
    targetProgramDataRentLamports,
    bufferRentLamports,
    deployerLamports,
    adminLamports,
  })) integer(value, label);
  check(artifactBytes > 0, "CAPACITY_INPUT_HOLD", "artifactBytes must be positive");
  check(currentProgramDataBytes === currentProgramCapacityBytes + PROGRAM_DATA_METADATA_BYTES, "PROGRAM_DATA_LAYOUT_HOLD", "ProgramData capacity and byte length disagree");

  const extensionBytes = Math.max(0, artifactBytes - currentProgramCapacityBytes);
  const targetProgramDataBytes = currentProgramDataBytes + extensionBytes;
  const programDataRentTopUpLamports = Math.max(0, targetProgramDataRentLamports - currentProgramDataLamports);
  const deployerRequiredIfPayingAllLamports = bufferRentLamports + programDataRentTopUpLamports;
  const deployerShortfallIfPayingAllLamports = Math.max(0, deployerRequiredIfPayingAllLamports - deployerLamports);
  const deployerBufferOnlyShortfallLamports = Math.max(0, bufferRentLamports - deployerLamports);

  return Object.freeze({
    artifactBytes,
    currentProgramCapacityBytes,
    currentProgramDataBytes,
    extensionRequired: extensionBytes > 0,
    extensionBytes,
    targetProgramDataBytes,
    bufferAccountBytes: artifactBytes + BUFFER_METADATA_BYTES,
    currentProgramDataLamports,
    targetProgramDataRentLamports,
    programDataRentTopUpLamports,
    bufferRentLamports,
    deployerLamports,
    adminLamports,
    deployerRequiredIfPayingAllLamports,
    deployerShortfallIfPayingAllLamports,
    deployerBufferOnlyShortfallLamports,
    transactionFeesIncluded: false,
  });
}

function parseProgramAccount(info, { PublicKey, loader, programDataAddress }) {
  check(info, "PROGRAM_ACCOUNT_MISSING_HOLD", "reviewed Devnet program account is missing");
  check(info.owner.equals(loader), "PROGRAM_OWNER_HOLD", "reviewed Devnet program is not owned by the upgradeable loader");
  check(info.data.length === 36 && info.data.readUInt32LE(0) === 2, "PROGRAM_LAYOUT_HOLD", "reviewed Devnet program account layout drifted");
  const observedProgramData = new PublicKey(info.data.subarray(4, 36));
  check(observedProgramData.equals(programDataAddress), "PROGRAM_DATA_ADDRESS_HOLD", "reviewed ProgramData address drifted");
}

function parseProgramDataAccount(info, { PublicKey, loader, programAdmin }) {
  check(info, "PROGRAM_DATA_MISSING_HOLD", "reviewed Devnet ProgramData account is missing");
  check(info.owner.equals(loader), "PROGRAM_DATA_OWNER_HOLD", "reviewed Devnet ProgramData is not owned by the upgradeable loader");
  check(info.data.length >= PROGRAM_DATA_METADATA_BYTES && info.data.readUInt32LE(0) === 3, "PROGRAM_DATA_LAYOUT_HOLD", "reviewed Devnet ProgramData layout drifted");
  check(info.data[12] === 1, "PROGRAM_AUTHORITY_HOLD", "reviewed Devnet ProgramData has no upgrade authority");
  const authority = new PublicKey(info.data.subarray(13, 45));
  check(authority.equals(programAdmin), "PROGRAM_AUTHORITY_HOLD", `reviewed Devnet upgrade authority is ${authority.toBase58()}`);
  return info.data.length - PROGRAM_DATA_METADATA_BYTES;
}

export async function observeDevnetUpgradeCapacity({
  artifactBytes,
  connection,
} = {}) {
  const { Connection, PublicKey } = await import("@solana/web3.js");
  const programId = new PublicKey(PROGRAM_ID);
  const programDataAddress = new PublicKey(PROGRAM_DATA_ADDRESS);
  const programAdmin = new PublicKey(PROGRAM_ADMIN);
  const devnetDeployer = new PublicKey(DEVNET_DEPLOYER);
  const loader = new PublicKey(UPGRADEABLE_LOADER);
  const rpc = connection ?? new Connection(DEVNET_RPC, "finalized");
  integer(artifactBytes, "artifactBytes");
  check(artifactBytes > 0, "CAPACITY_INPUT_HOLD", "artifactBytes must be positive");
  const genesisHash = await rpc.getGenesisHash();
  check(genesisHash === DEVNET_GENESIS_HASH, "NETWORK_IDENTITY_HOLD", "RPC endpoint is not the exact reviewed Solana Devnet");
  const startSlot = await rpc.getSlot("finalized");
  const accounts = await rpc.getMultipleAccountsInfo([
    programId,
    programDataAddress,
    devnetDeployer,
    programAdmin,
  ], { commitment: "finalized", minContextSlot: startSlot });
  check(Array.isArray(accounts) && accounts.length === 4, "RPC_OBSERVATION_HOLD", "Devnet account observation is incomplete");
  const [program, programData, deployer, admin] = accounts;
  parseProgramAccount(program, { PublicKey, loader, programDataAddress });
  const currentProgramCapacityBytes = parseProgramDataAccount(programData, { PublicKey, loader, programAdmin });
  check(deployer, "DEPLOYER_ACCOUNT_MISSING_HOLD", "Devnet deployer account is missing");
  check(admin, "ADMIN_ACCOUNT_MISSING_HOLD", "Devnet administrator account is missing");

  const extensionBytes = Math.max(0, artifactBytes - currentProgramCapacityBytes);
  const targetProgramDataBytes = programData.data.length + extensionBytes;
  const bufferAccountBytes = artifactBytes + BUFFER_METADATA_BYTES;
  const [targetProgramDataRentLamports, bufferRentLamports, endSlot] = await Promise.all([
    rpc.getMinimumBalanceForRentExemption(targetProgramDataBytes, "finalized"),
    rpc.getMinimumBalanceForRentExemption(bufferAccountBytes, "finalized"),
    rpc.getSlot("finalized"),
  ]);
  const plan = calculateUpgradeCapacityPlan({
    artifactBytes,
    currentProgramCapacityBytes,
    currentProgramDataBytes: programData.data.length,
    currentProgramDataLamports: programData.lamports,
    targetProgramDataRentLamports,
    bufferRentLamports,
    deployerLamports: deployer.lamports,
    adminLamports: admin.lamports,
  });

  return Object.freeze({
    schema: "iat-v2-devnet-upgrade-capacity/v1",
    status: "READ_ONLY_CALCULATION",
    rpc: DEVNET_RPC,
    genesisHash,
    commitment: "finalized",
    startSlot,
    endSlot,
    programId: PROGRAM_ID,
    programDataAddress: PROGRAM_DATA_ADDRESS,
    upgradeAuthority: PROGRAM_ADMIN,
    devnetDeployer: DEVNET_DEPLOYER,
    artifactBindingStatus: IAT_V2_MIGRATION_ARTIFACT_BINDING.status,
    artifactBytesSource: IAT_V2_MIGRATION_ARTIFACT_BINDING.status === "BOUND"
      && IAT_V2_MIGRATION_ARTIFACT_BINDING.artifactBytes === artifactBytes
      ? "CHECKED_IN_CI_BINDING"
      : "CALLER_SUPPLIED_CALCULATION_ONLY",
    ...plan,
    rpcReadExecuted: true,
    networkMutation: false,
    transactionExecution: false,
    signing: false,
    broadcast: false,
  });
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith("--") || value === undefined) fail("CLI_USAGE", "options must be --name value pairs", { hold: false });
    options[flag.slice(2)] = value;
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseCli(process.argv.slice(2));
  if (command === "verify") {
    const unexpected = Object.keys(options).filter((key) => !["artifact", "evidence"].includes(key));
    if (unexpected.length > 0) fail("CLI_USAGE", `unexpected verify option: --${unexpected[0]}`, { hold: false });
    console.log(JSON.stringify(verifyMigrationArtifactBinding({
      artifactPath: options.artifact,
      evidencePath: options.evidence,
    })));
    return;
  }
  if (command === "capacity") {
    const unexpected = Object.keys(options).filter((key) => key !== "artifact-bytes");
    if (unexpected.length > 0) fail("CLI_USAGE", `unexpected capacity option: --${unexpected[0]}`, { hold: false });
    if (!/^[1-9][0-9]*$/u.test(options["artifact-bytes"] ?? "")) fail("CLI_USAGE", "capacity requires --artifact-bytes <positive integer>", { hold: false });
    console.log(JSON.stringify(await observeDevnetUpgradeCapacity({ artifactBytes: Number(options["artifact-bytes"]) }), null, 2));
    return;
  }
  fail("CLI_USAGE", "usage: iat-v2-devnet-buffer-preflight.mjs verify [--artifact PATH --evidence PATH] | capacity --artifact-bytes N", { hold: false });
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const code = error instanceof BufferPreflightError ? error.code : "UNEXPECTED_PREFLIGHT_FAILURE";
    const hold = error instanceof BufferPreflightError ? error.hold : true;
    console.error(JSON.stringify({
      schema: "iat-v2-devnet-buffer-preflight-error/v1",
      status: "HOLD",
      code,
      message: error instanceof Error ? error.message : String(error),
      signing: false,
      broadcast: false,
    }));
    process.exitCode = hold ? 2 : 1;
  });
}

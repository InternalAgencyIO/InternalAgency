#!/usr/bin/env node

import "./lib/iat-v2-attended-node-runtime.mjs";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_TARGET = "iat-v2-devnet-buffer-authority-target/v1";
const SCHEMA_ATTEMPT = "iat-v2-devnet-buffer-authority-attempt/v1";
const SCHEMA_RESULT = "iat-v2-devnet-buffer-authority-cas-result/v1";
const STATE = "MUTATION_RESERVED_DO_NOT_RETRY";
const NETWORK = "devnet";
const RPC_URL = "https://api.devnet.solana.com";
const MUTATION = "SET_BUFFER_AUTHORITY";
const EXPECTED_FROM = "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4";
const EXPECTED_TO = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const EXPECTED_SOLANA_PATH = "/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana";
const EXPECTED_SOLANA = "solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)";
const EXPECTED_SOLANA_SHA256 = "aacc6871e8ff199608987f0364f2ed9e239a32e1e0548f1ae4477e0e533e1dea";
const EXPECTED_SOLANA_BYTES = 28_546_968;
const EXPECTED_NODE_PATH = "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node";
const EXPECTED_NODE_VERSION = "v24.19.0";
const EXPECTED_NODE_SHA256 = "bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12";
const EXPECTED_NODE_BYTES = 125_989_464;
const EXPECTED_GIT_PATH = "/mnt/c/Program Files/Git/mingw64/bin/git.exe";
const EXPECTED_GIT_VERSION = "git version 2.55.0.windows.3";
const EXPECTED_GIT_SHA256 = "1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9";
const EXPECTED_GIT_BYTES = 4_383_048;
const EXPECTED_ARTIFACT_SHA256 = "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01";
const EXPECTED_ARTIFACT_BYTES = 649_680;
const EXPECTED_EVIDENCE_MANIFEST_SHA256 = "31ac038476e72c964f79a29bae5090aa7172f7013cc5454a0b96f9b343d0186b";
const EXPECTED_SOURCE_HEAD_COMMIT = "2b68cebecff756655d140277c67f8f46ac832d88";
const EXPECTED_SOURCE_HEAD_TREE = "d574530655579e925fdc61b921b4013a322f9a85";
const EXPECTED_CI_RUN_ID = 33_029_576_920;
const EXPECTED_CI_RUN_ATTEMPT = 1;
const EXPECTED_CAS_ROOT = "/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1";
const ROOT_SENTINEL_FILE = ".iat-v2-devnet-buffer-authority-cas-root.json";
const ROOT_SENTINEL = Object.freeze({
  ceremonyId: "9e691e59-35c8-4861-86a0-7a219885b1c0",
  network: NETWORK,
  schema: "iat-v2-devnet-buffer-authority-cas-root/v1",
});
const ROOT_SENTINEL_SHA256 = "11893575f111807621fcbc8c77ea73fae03390404507202146dde9e69d5818da";
const PROJECT_ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export class HandoffCasError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HandoffCasError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new HandoffCasError(code, message);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function canonicalJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, keys, label) {
  check(value && typeof value === "object" && !Array.isArray(value), "CAS_SCHEMA_HOLD", `${label} must be an object`);
  check(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    "CAS_SCHEMA_HOLD",
    `${label} fields are not exact`,
  );
}

function integer(value, label) {
  check(/^[1-9][0-9]*$/u.test(value ?? ""), "CAS_INPUT_HOLD", `${label} must be a positive integer`);
  const parsed = Number(value);
  check(Number.isSafeInteger(parsed), "CAS_INPUT_HOLD", `${label} exceeds the safe integer range`);
  return parsed;
}

function parseOptions(argv) {
  const [command, ...rest] = argv;
  check(command === "inspect" || command === "reserve", "CAS_USAGE", "usage: handoff-cas inspect|reserve --name value ...");
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    check(flag?.startsWith("--") && value !== undefined, "CAS_USAGE", "options must be --name value pairs");
    const name = flag.slice(2);
    check(options[name] === undefined, "CAS_USAGE", `duplicate option: --${name}`);
    options[name] = value;
  }
  const expected = [
    "root",
    "buffer",
    "from-authority",
    "to-authority",
    "artifact-sha256",
    "artifact-bytes",
    "evidence-manifest-sha256",
    "source-head-commit",
    "source-head-tree",
    "ci-run-id",
    "ci-run-attempt",
    "node-path",
    "node-version",
    "node-sha256",
    "node-bytes",
    "git-path",
    "git-version",
    "git-sha256",
    "git-bytes",
    "devnet-genesis-hash",
    "solana-cli-path",
    "solana-cli-version",
    "solana-cli-sha256",
    "solana-cli-bytes",
  ];
  exactKeys(options, expected, "CAS options");
  return { command, options };
}

function secureDirectory(path, expectedUid) {
  let entry;
  try {
    entry = lstatSync(path);
  } catch {
    fail("CAS_ROOT_HOLD", `${path} is missing; persistent CAS state must never be recreated by this helper`);
  }
  check(entry.isDirectory() && !entry.isSymbolicLink(), "CAS_ROOT_HOLD", `${path} must be a non-symlink directory`);
  if (process.platform !== "win32") {
    check((entry.mode & 0o7777) === 0o700, "CAS_ROOT_HOLD", `${path} must be exact mode 0700`);
    check(entry.uid === expectedUid, "CAS_ROOT_HOLD", `${path} is not owned by exact uid ${expectedUid}`);
  }
  return realpathSync(path);
}

function directorySnapshot(path, expectedUid) {
  const canonical = secureDirectory(path, expectedUid);
  const entry = lstatSync(canonical);
  return Object.freeze({ path: canonical, dev: String(entry.dev), ino: String(entry.ino) });
}

function assertNamespaceIdentity(prepared) {
  for (const expected of prepared.namespaceIdentity) {
    const observed = directorySnapshot(expected.path, prepared.expectedUid);
    check(
      observed.dev === expected.dev && observed.ino === expected.ino,
      "CAS_ROOT_HOLD",
      `${expected.path} changed filesystem identity during the CAS operation`,
    );
  }
}

function assertRootSentinel(root, expectedUid) {
  const path = resolve(root, ROOT_SENTINEL_FILE);
  let entry;
  try {
    entry = lstatSync(path);
  } catch {
    fail("CAS_ROOT_SENTINEL_HOLD", "persistent CAS root sentinel is missing");
  }
  check(entry.isFile() && !entry.isSymbolicLink(), "CAS_ROOT_SENTINEL_HOLD", "CAS root sentinel must be a regular non-symlink file");
  if (process.platform !== "win32") {
    check((entry.mode & 0o7777) === 0o600, "CAS_ROOT_SENTINEL_HOLD", "CAS root sentinel must be exact mode 0600");
    check(entry.uid === expectedUid, "CAS_ROOT_SENTINEL_HOLD", `CAS root sentinel is not owned by exact uid ${expectedUid}`);
    check(entry.nlink === 1, "CAS_ROOT_SENTINEL_HOLD", "CAS root sentinel must be single-linked");
  }
  const bytes = readFileSync(path);
  check(bytes.length === 140, "CAS_ROOT_SENTINEL_HOLD", "CAS root sentinel byte length drifted");
  check(sha256(bytes) === ROOT_SENTINEL_SHA256, "CAS_ROOT_SENTINEL_HOLD", "CAS root sentinel digest drifted");
  check(bytes.toString("utf8") === canonicalJson(ROOT_SENTINEL), "CAS_ROOT_SENTINEL_HOLD", "CAS root sentinel content drifted");
}

function prepare(options, {
  expectedRoot = EXPECTED_CAS_ROOT,
  expectedUid = expectedRoot === EXPECTED_CAS_ROOT ? 1000 : process.getuid?.(),
} = {}) {
  if (process.platform !== "win32") {
    check(Number.isSafeInteger(expectedUid) && process.getuid() === expectedUid, "CAS_ROOT_HOLD", `CAS process is not exact uid ${expectedUid}`);
  }
  check(isAbsolute(options.root), "CAS_ROOT_HOLD", "IAT_V2_HANDOFF_CAS_ROOT must be absolute");
  check(resolve(options.root) === expectedRoot, "CAS_ROOT_HOLD", "CAS root is not the one exact reviewed persistent namespace");
  const parent = dirname(expectedRoot);
  const parentSnapshot = directorySnapshot(parent, expectedUid);
  const canonicalParent = parentSnapshot.path;
  check(canonicalParent === parent, "CAS_ROOT_HOLD", "CAS root parent resolves through a symlink");
  const rootSnapshot = directorySnapshot(resolve(options.root), expectedUid);
  const root = rootSnapshot.path;
  check(root === resolve(options.root), "CAS_ROOT_HOLD", "CAS root or one of its parents resolves through a symlink");
  const fromProject = relative(PROJECT_ROOT, root);
  check(fromProject === ".." || fromProject.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`), "CAS_ROOT_HOLD", "CAS root must be outside the repository");
  if (process.platform !== "win32") {
    check(root !== "/tmp" && !root.startsWith("/tmp/"), "CAS_ROOT_HOLD", "CAS root must not be under /tmp");
  }
  assertRootSentinel(root, expectedUid);
  const attemptsSnapshot = directorySnapshot(resolve(root, "attempts"), expectedUid);
  const attempts = attemptsSnapshot.path;

  check(BASE58.test(options.buffer), "CAS_INPUT_HOLD", "buffer address is not canonical base58");
  check(options["from-authority"] === EXPECTED_FROM, "CAS_INPUT_HOLD", "source authority drifted");
  check(options["to-authority"] === EXPECTED_TO, "CAS_INPUT_HOLD", "target authority drifted");
  check(SHA256.test(options["artifact-sha256"]) && options["artifact-sha256"] === EXPECTED_ARTIFACT_SHA256, "CAS_INPUT_HOLD", "artifact SHA-256 drifted");
  check(integer(options["artifact-bytes"], "artifact bytes") === EXPECTED_ARTIFACT_BYTES, "CAS_INPUT_HOLD", "artifact byte length drifted");
  check(SHA256.test(options["evidence-manifest-sha256"]) && options["evidence-manifest-sha256"] === EXPECTED_EVIDENCE_MANIFEST_SHA256, "CAS_INPUT_HOLD", "evidence SHA-256 drifted");
  check(COMMIT.test(options["source-head-commit"]) && options["source-head-commit"] === EXPECTED_SOURCE_HEAD_COMMIT, "CAS_INPUT_HOLD", "source-head commit drifted");
  check(COMMIT.test(options["source-head-tree"]) && options["source-head-tree"] === EXPECTED_SOURCE_HEAD_TREE, "CAS_INPUT_HOLD", "source-head tree drifted");
  check(integer(options["ci-run-id"], "CI run ID") === EXPECTED_CI_RUN_ID, "CAS_INPUT_HOLD", "CI run ID drifted");
  check(integer(options["ci-run-attempt"], "CI run attempt") === EXPECTED_CI_RUN_ATTEMPT, "CAS_INPUT_HOLD", "CI run attempt drifted");
  check(options["node-path"] === EXPECTED_NODE_PATH, "CAS_INPUT_HOLD", "Node.js resolved path drifted");
  check(options["node-version"] === EXPECTED_NODE_VERSION, "CAS_INPUT_HOLD", "Node.js version drifted");
  check(options["node-sha256"] === EXPECTED_NODE_SHA256, "CAS_INPUT_HOLD", "Node.js SHA-256 drifted");
  check(integer(options["node-bytes"], "Node.js bytes") === EXPECTED_NODE_BYTES, "CAS_INPUT_HOLD", "Node.js byte length drifted");
  check(options["git-path"] === EXPECTED_GIT_PATH, "CAS_INPUT_HOLD", "Git resolved path drifted");
  check(options["git-version"] === EXPECTED_GIT_VERSION, "CAS_INPUT_HOLD", "Git version drifted");
  check(options["git-sha256"] === EXPECTED_GIT_SHA256, "CAS_INPUT_HOLD", "Git SHA-256 drifted");
  check(integer(options["git-bytes"], "Git bytes") === EXPECTED_GIT_BYTES, "CAS_INPUT_HOLD", "Git byte length drifted");
  check(options["devnet-genesis-hash"] === "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG", "CAS_INPUT_HOLD", "Devnet genesis hash drifted");
  check(options["solana-cli-path"] === EXPECTED_SOLANA_PATH, "CAS_INPUT_HOLD", "Solana CLI resolved path drifted");
  check(options["solana-cli-version"] === EXPECTED_SOLANA, "CAS_INPUT_HOLD", "Solana CLI identity drifted");
  check(options["solana-cli-sha256"] === EXPECTED_SOLANA_SHA256, "CAS_INPUT_HOLD", "Solana CLI SHA-256 drifted");
  check(integer(options["solana-cli-bytes"], "Solana CLI bytes") === EXPECTED_SOLANA_BYTES, "CAS_INPUT_HOLD", "Solana CLI byte length drifted");

  const target = {
    schema: SCHEMA_TARGET,
    network: NETWORK,
    mutation: MUTATION,
    casRootPath: root,
    casRootCeremonyId: ROOT_SENTINEL.ceremonyId,
    bufferAddress: options.buffer,
  };
  const casKeySha256 = sha256(canonicalJson(target));
  const identity = {
    schema: SCHEMA_ATTEMPT,
    state: STATE,
    casKeySha256,
    network: NETWORK,
    rpcUrl: RPC_URL,
    mutation: MUTATION,
    bufferAddress: options.buffer,
    fromAuthority: options["from-authority"],
    toAuthority: options["to-authority"],
    artifactSha256: options["artifact-sha256"],
    artifactBytes: integer(options["artifact-bytes"], "artifact bytes"),
    evidenceManifestSha256: options["evidence-manifest-sha256"],
    sourceHeadCommit: options["source-head-commit"],
    sourceHeadTree: options["source-head-tree"],
    ciRunId: integer(options["ci-run-id"], "CI run ID"),
    ciRunAttempt: integer(options["ci-run-attempt"], "CI run attempt"),
    nodePath: options["node-path"],
    nodeVersion: options["node-version"],
    nodeSha256: options["node-sha256"],
    nodeBytes: integer(options["node-bytes"], "Node.js bytes"),
    gitPath: options["git-path"],
    gitVersion: options["git-version"],
    gitSha256: options["git-sha256"],
    gitBytes: integer(options["git-bytes"], "Git bytes"),
    devnetGenesisHash: options["devnet-genesis-hash"],
    solanaCliPath: options["solana-cli-path"],
    solanaCliVersion: options["solana-cli-version"],
    solanaCliSha256: options["solana-cli-sha256"],
    solanaCliBytes: integer(options["solana-cli-bytes"], "Solana CLI bytes"),
  };
  return {
    attempts,
    casKeySha256,
    expectedUid,
    identity,
    namespaceIdentity: Object.freeze([parentSnapshot, rootSnapshot, attemptsSnapshot]),
    path: resolve(attempts, `${casKeySha256}.json`),
  };
}

function inspectFile(prepared) {
  assertNamespaceIdentity(prepared);
  if (!existsSync(prepared.path)) {
    assertNamespaceIdentity(prepared);
    return null;
  }
  const entry = lstatSync(prepared.path);
  check(entry.isFile() && !entry.isSymbolicLink(), "CAS_RECORD_HOLD", "CAS record must be a regular non-symlink file");
  if (process.platform !== "win32") {
    check((entry.mode & 0o7777) === 0o600, "CAS_RECORD_HOLD", "CAS record must be exact mode 0600");
    check(entry.uid === prepared.expectedUid, "CAS_RECORD_HOLD", `CAS record is not owned by exact uid ${prepared.expectedUid}`);
    check(entry.nlink === 1, "CAS_RECORD_HOLD", "CAS record must be single-linked");
  }
  const text = readFileSync(prepared.path, "utf8");
  check(Buffer.byteLength(text) <= 16_384, "CAS_RECORD_HOLD", "CAS record is unexpectedly large");
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    fail("CAS_RECORD_HOLD", "CAS record is partial or malformed; mutation remains permanently reserved");
  }
  exactKeys(record, [...Object.keys(prepared.identity), "reservedAtUtc"], "CAS record");
  check(text === canonicalJson(record), "CAS_RECORD_HOLD", "CAS record is not canonical JSON");
  check(ISO_UTC.test(record.reservedAtUtc), "CAS_RECORD_HOLD", "CAS reservation timestamp is invalid");
  for (const [key, expected] of Object.entries(prepared.identity)) {
    check(record[key] === expected, "CAS_IDENTITY_MISMATCH_HOLD", `existing CAS record ${key} does not match this request`);
  }
  assertNamespaceIdentity(prepared);
  return Object.freeze(record);
}

function result(status, prepared, record = null) {
  return Object.freeze({
    schema: SCHEMA_RESULT,
    status,
    casKeySha256: prepared.casKeySha256,
    recordPath: prepared.path,
    mutationReserved: status !== "AVAILABLE",
    mutationMayRun: status === "RESERVED_CREATED",
    reservedAtUtc: record?.reservedAtUtc ?? null,
  });
}

export function inspectHandoffReservation(options, dependencies) {
  const prepared = prepare(options, dependencies);
  const record = inspectFile(prepared);
  return result(record ? "RESERVED_EXISTING" : "AVAILABLE", prepared, record);
}

export function reserveHandoffMutation(options, {
  now = () => new Date(),
  expectedRoot = EXPECTED_CAS_ROOT,
} = {}) {
  const prepared = prepare(options, { expectedRoot });
  const existing = inspectFile(prepared);
  if (existing) return result("RESERVED_EXISTING", prepared, existing);

  const record = { ...prepared.identity, reservedAtUtc: now().toISOString() };
  check(ISO_UTC.test(record.reservedAtUtc), "CAS_RECORD_HOLD", "CAS reservation clock did not return canonical UTC");
  const bytes = canonicalJson(record);
  let descriptor;
  try {
    descriptor = openSync(
      prepared.path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
  } catch (error) {
    if (error?.code === "EEXIST") {
      const raced = inspectFile(prepared);
      check(raced, "CAS_RECORD_HOLD", "CAS reservation raced but no valid record is readable");
      return result("RESERVED_EXISTING", prepared, raced);
    }
    throw error;
  }
  try {
    const buffer = Buffer.from(bytes, "utf8");
    let offset = 0;
    while (offset < buffer.length) {
      offset += writeSync(descriptor, buffer, offset, buffer.length - offset);
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  if (process.platform !== "win32") {
    const directory = openSync(prepared.attempts, constants.O_RDONLY);
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }
  assertNamespaceIdentity(prepared);
  return result("RESERVED_CREATED", prepared, record);
}

async function main() {
  const { command, options } = parseOptions(process.argv.slice(2));
  const value = command === "inspect"
    ? inspectHandoffReservation(options)
    : reserveHandoffMutation(options);
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schema: "iat-v2-devnet-buffer-authority-cas-error/v1",
      status: "HOLD",
      code: error instanceof HandoffCasError ? error.code : "UNEXPECTED_CAS_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      mutationReserved: true,
      mutationMayRun: false,
    })}\n`);
    process.exitCode = 2;
  });
}

export const IAT_V2_HANDOFF_CAS_ROOT_SENTINEL_FILE = ROOT_SENTINEL_FILE;
export const IAT_V2_HANDOFF_CAS_ROOT_SENTINEL = ROOT_SENTINEL;
export const IAT_V2_HANDOFF_CAS_ROOT_SENTINEL_SHA256 = ROOT_SENTINEL_SHA256;
export const IAT_V2_HANDOFF_CAS_EXPECTED_ROOT = EXPECTED_CAS_ROOT;

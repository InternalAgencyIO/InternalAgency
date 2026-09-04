import { spawn } from "node:child_process";
import { createHash, createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  readSync,
  statSync,
  writeSync,
} from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types } from "node:util";
import { loadRuntimeBindingAfterFd11BeforeFd3 } from "./iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-runtime-binding-launcher.mjs";

const BPS09_SCHEMA_ID = "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored/v1";
const BPS09_BPK00_BINDING = Object.freeze({
  commit: "512b347ebf4de80bf5a50e0d8491f14eeef0f9f0",
  tree: "c4e8e6ca1c54e9154743dd2fea7b434307d74676",
  blobSha1: "8e38e773ed4f11a4aefd8787c63c535775056c1a",
  path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-owner-root-public-key-anchor.v1.json",
  fileSha256: "7865d0fb44465fbce2100af78d2392b3bc29a2f4a7ff2969b501bc2a0134bb21",
  byteLength: 1001,
  rootPublicKeyHex: "60fa8f2c48a8bc6d2ad476b094bb2f569f020211bf834deb144d2e2958ac4230",
  rootFingerprintSha256: "49e4e1637075a367448705ea703628f045cde70c489286b84d1db8f5697557f1",
  ownerProvisioningReceiptSha256: "3e1aa94f5203e882155d953e77f1036bb418929b5d6ddc5fe80070a4a0898f3a",
});
const BPK00_CHECKPOINT_OUTCOME = "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_FD12_OWNER_ROOT_PUBLIC_KEY_ANCHOR_CHECKPOINT_COMMITTED";
const BPS08_ANCHOR_SCHEMA = "iat-b3-bps08-compile-peer-anchor-receipt/v1";
const BPS08_ANCHOR_SUBJECT_DOMAIN = "IAT_B3_BPS08_ANCHOR_SUBJECT_V1";
const BPS08_HARDWARE_MESSAGE_PREFIX = "IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:";
const OCMS_V1_PREFIX = Buffer.from("ff736f6c616e61206f6666636861696e", "hex");
const REQUIRED_MEMFD_SEALS = Object.freeze(["F_SEAL_SEAL", "F_SEAL_SHRINK", "F_SEAL_GROW", "F_SEAL_WRITE", "F_SEAL_FUTURE_WRITE"]);
const REQUIRED_MEMFD_SEAL_MASK = 0x1f;
const BPS08_ANCHOR_SUBJECT_FIELDS = Object.freeze([
  "schema", "attemptId", "runId", "sessionId", "bootId",
  "anchorNonceHex", "anchorCasKeySha256", "anchorCasAcquireReceiptSha256", "anchorExpiresAtMonotonicNs",
  "ownerRootFingerprintSha256", "ownerRootPublicKeyHex", "ownerRootProvisioningReceiptSha256",
  "ownerRootKeyAnchorFd", "ownerRootKeyAnchorProducer", "ownerRootKeyAnchorOutcome", "ownerRootKeyAnchorDescriptorSha256",
  "ownerRootKeyAnchorDev", "ownerRootKeyAnchorIno", "ownerRootKeyAnchorMountId",
  "ownerRootKeyAnchorHandleSha256", "ownerRootKeyAnchorOpenFileDescriptionSha256",
  "ownerRootKeyAnchorContentSha256", "ownerRootKeyAnchorByteLength",
  "deviceModel", "deviceFirmwareVersion", "deviceFirmwareIdentitySha256", "deviceDerivationPath",
  "deviceAccountPublicKeyHex", "deviceAccountAddress", "deviceReceiptSha256", "physicalConfirmationReceiptSha256",
  "ocmsVersion", "ocmsSignerCount", "ocmsSignerIndex", "ocmsSignerPublicKeyHex",
  "ocmsSignerListByteLength", "ocmsSignerListSha256",
  "bps05ManifestSha256", "bps06ManifestSha256", "bpc01Commit", "bpc01Tree", "bpc01ManifestSha256",
  "successorExecutorSha256", "sourceFdManifestSha256", "toolchainManifestSha256",
  "toolOpenFileDescriptionManifestSha256", "sysrootManifestSha256", "staticNodeIdentitySha256",
  "launchArgvSha256", "launchEnvironmentSha256", "launchCwdIdentitySha256", "startupClosureSha256",
  "watchdogPublicKeyHex", "observerPublicKeyHex", "custodianPublicKeyHex",
  "watchdogPrincipalSha256", "observerPrincipalSha256", "custodianPrincipalSha256",
  "watchdogChannelOfdSha256", "observerChannelOfdSha256", "custodianChannelOfdSha256",
  "operationTimerOfdSha256", "operationDeadlineMonotonicNs",
  "teardownTimerOfdSha256", "teardownDeadlineMonotonicNs",
  "decision", "authority",
]);
const BPS08_ANCHOR_RECEIPT_FIELDS = Object.freeze([
  "schema", "producer", "outcome", "attemptId", "runId", "sessionId", "subject",
  "subjectSha256", "ocmsVersion", "hardwareMessageAscii", "messageBodySha256", "messageBodyByteLength",
  "signerListSha256", "signerListByteLength", "serializedMessageSha256", "serializedMessageByteLength",
  "rootPublicKeyHex", "signatureHex", "signatureSha256", "signatureByteLength",
  "deviceReceiptSha256", "decision", "authority",
]);

export const SUPERVISOR_ARTIFACT = "SUPERVISOR_ARTIFACT";
export const INSTALL_CONTROLLER_ARTIFACT = "INSTALL_CONTROLLER_ARTIFACT";
export const outputsMustBeByteEqual = true;

const FD = Object.freeze({
  bootstrap: 3,
  toolchainManifest: 4,
  reviewedPlan: 5,
  watchdog: 6,
  observer: 7,
  custodian: 8,
  teardownTimer: 9,
  cleanupTimer: 10,
  anchorReceipt: 11,
  ownerRootKeyAnchor: 12,
  watchdogPidfd: 13,
  observerPidfd: 14,
  custodianPidfd: 15,
  oneShotCasToken: 16,
  runtimeBindingReceipt: 17,
  sysrootDirectory: 18,
  launchCwdDirectory: 19,
  compiler: 20,
  linker: 21,
  archiver: 22,
  staticNode: 23,
  executorSource: 24,
  protectedDestinationParent: 25,
  recoveryQuarantineDirectory: 26,
  kernelBindingDescriptor: 27,
  runtimeBindingProviderExecutable: 28,
});
const TOOL_FDS = Object.freeze({ compiler: FD.compiler, linker: FD.linker, archiver: FD.archiver, staticNode: FD.staticNode });
const BPC01_SOURCE_ROWS = Object.freeze([
  Object.freeze({ fd: 30, path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-bootstrap-descriptor.v1.schema.json", sha256: "4c713372316253ed799ab3a653dc1e2878d0bc83dd86d232a5a8b7ad7bbb9279", byteLength: 39234 }),
  Object.freeze({ fd: 31, path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design.v1.schema.json", sha256: "47037dcfcaefe756b65598b94290e4ac59fbe8c418964f9c3a0e2c589d41105d", byteLength: 286164 }),
  Object.freeze({ fd: 32, path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-runtime-anchor.v1.schema.json", sha256: "1e753e0bb6ca3384dd0011617e2e8dbd6e4654dde891a59f4e62a64554663aad", byteLength: 39344 }),
  Object.freeze({ fd: 33, path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-runtime-evidence.v1.schema.json", sha256: "033cdb7955beb1e0362ad2108e4fc730aa1c11fc02adb2ad21b547d614c68e3b", byteLength: 29493 }),
  Object.freeze({ fd: 34, path: "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound.c", sha256: "3ff0cad0c63b992978fcf459259fbbf4e0001f2b387800940d52b1ae4c2af83f", byteLength: 370267 }),
  Object.freeze({ fd: 35, path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design-contract.mjs", sha256: "b2592dade11c2600e6bf0a160c8e51ff08c78ce21ba5c041fa2d77c345fed3a1", byteLength: 37956 }),
  Object.freeze({ fd: 36, path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-launcher.mjs", sha256: "6d993e2bf3ae0e1db6bc46ab8eb784fff97164e60cf43dad255e4cfbfd0668db", byteLength: 41687 }),
  Object.freeze({ fd: 37, path: "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design-contract.test.mjs", sha256: "a9472fe648518843680ab4a7410d25d89c848c32e7b1373fa008bfb01802c67e", byteLength: 21226 }),
  Object.freeze({ fd: 38, path: "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-source.test.mjs", sha256: "2b0b370f45e1279d689f25798086c5e05e326a0d80f008d988d29abcc576f0d4", byteLength: 180737 }),
]);
const CONTROLLER_INSTALL_SOURCE_FD = 39;
const BPS09_SOURCE_ROWS = Object.freeze([
  Object.freeze({ fd: 40, path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored.v1.schema.json", sha256: null, byteLength: null }),
  Object.freeze({ fd: CONTROLLER_INSTALL_SOURCE_FD, path: "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-install-controller-fd12-trust-anchored/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound_checkpoint_install_controller_fd12_trust_anchored.c", sha256: null, byteLength: null }),
  Object.freeze({ fd: FD.executorSource, path: "projects/star-ascent/site/scripts/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-executor-fd12-trust-anchored.mjs", sha256: null, byteLength: null }),
  Object.freeze({ fd: 41, path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-contract.mjs", sha256: null, byteLength: null }),
  Object.freeze({ fd: 42, path: "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-source.test.mjs", sha256: null, byteLength: null }),
]);
const EXPECTED_INHERITED_FDS = Object.freeze([...new Set([0, 1, 2, ...Object.values(FD), ...BPC01_SOURCE_ROWS.map((row) => row.fd), ...BPS09_SOURCE_ROWS.map((row) => row.fd)])].sort((left, right) => left - right));
const PLAN_SCHEMA = `${BPS09_SCHEMA_ID}/compile-plan`;
const RECEIPT_SCHEMA = `${BPS09_SCHEMA_ID}/authenticated-receipt`;
const RECEIPT_SEQUENCES = new Map();
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function fail(message) { throw new TypeError(message); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function validSha(value) { return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value); }
function equalHex(left, right) {
  return validSha(left) && validSha(right) && timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
function exactObject(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} must be a plain object`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string") || Reflect.ownKeys(value).length !== Object.keys(value).length) fail(`${label} has hidden keys`);
  for (const [key, descriptor] of Object.entries(descriptors)) if (!("value" in descriptor) || !descriptor.enumerable) fail(`${label}.${key} must be enumerable data`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) fail(`${label} keys/order mismatch`);
}
function denseTuple(value, length, label) {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length || Object.keys(value).length !== length) fail(`${label} must be a dense tuple`);
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = [...Array.from({ length }, (_, index) => String(index)), "length"];
  if (ownKeys.length !== expectedKeys.length || ownKeys.some((key, index) => key !== expectedKeys[index])) fail(`${label} must not be decorated`);
}
function canonicalU64(value, label) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value) || BigInt(value) > 18446744073709551615n) fail(`${label} must be canonical u64`);
}
function absolutePath(value, label) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\0\r\n]/u.test(value) || value.split("/").includes("..")) fail(`${label} must be a canonical absolute path`);
}
function validateFileIdentityDocument(value, label) {
  exactObject(value, ["path", "sha256", "byteLength", "mode", "uid", "gid", "dev", "ino", "mountId", "nlink", "handleSha256", "openFileDescriptionSha256", "sameHandleReplayRequired"], label);
  absolutePath(value.path, `${label}.path`);
  if (!validSha(value.sha256) || !validSha(value.handleSha256) || !validSha(value.openFileDescriptionSha256) || !/^[0-7]{4}$/u.test(value.mode) || value.sameHandleReplayRequired !== true) fail(`${label} identity hashes/mode mismatch`);
  for (const key of ["byteLength", "uid", "gid", "dev", "ino", "mountId", "nlink"]) canonicalU64(value[key], `${label}.${key}`);
}
function validateDeadlineDocument(value, label) {
  exactObject(value, ["clock", "absoluteNanoseconds", "timerFd", "timerDev", "timerIno", "timerFirst"], label);
  if (value.clock !== "CLOCK_MONOTONIC" || value.timerFirst !== true) fail(`${label} clock/timer mismatch`);
  for (const key of ["absoluteNanoseconds", "timerFd", "timerDev", "timerIno"]) canonicalU64(value[key], `${label}.${key}`);
}
function validateCompileBootstrapDocument(value) {
  exactObject(value, ["schema", "kind", "attemptId", "runId", "sessionId", "sourceCommit", "sourceTree", "toolchainManifestSha256", "attemptRoots", "outputNames", "deadline", "teardownDeadline", "peerSigningKeys", "capabilityDomain", "installFields", "decision", "authority"], "compileBootstrap");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "COMPILE_BOOTSTRAP" || value.sourceCommit !== BPS09_BPK00_BINDING.commit || value.sourceTree !== BPS09_BPK00_BINDING.tree || !validSha(value.toolchainManifestSha256) || value.capabilityDomain !== "COMPILE_ONLY" || value.installFields !== null || value.decision !== "HOLD" || value.authority !== "NONE") fail("compile bootstrap binding mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) canonicalText(value[key], `compileBootstrap.${key}`);
  denseTuple(value.attemptRoots, 2, "compileBootstrap.attemptRoots");
  value.attemptRoots.forEach((root, index) => absolutePath(root, `compileBootstrap.attemptRoots[${index}]`));
  if (value.attemptRoots[0] === value.attemptRoots[1]) fail("compile roots must be distinct");
  exactObject(value.outputNames, ["target", "installer"], "compileBootstrap.outputNames");
  canonicalBasename(value.outputNames.target, "compileBootstrap.outputNames.target"); canonicalBasename(value.outputNames.installer, "compileBootstrap.outputNames.installer");
  validateDeadlineDocument(value.deadline, "compileBootstrap.deadline");
  validateDeadlineDocument(value.teardownDeadline, "compileBootstrap.teardownDeadline");
  if (value.deadline.timerFd !== String(FD.teardownTimer) || value.teardownDeadline.timerFd !== String(FD.cleanupTimer) || BigInt(value.teardownDeadline.absoluteNanoseconds) <= BigInt(value.deadline.absoluteNanoseconds)) fail("compile operational/cleanup deadline separation invalid");
  exactObject(value.peerSigningKeys, ["watchdog", "observer", "custodian"], "compileBootstrap.peerSigningKeys");
  for (const [role, key] of Object.entries(value.peerSigningKeys)) if (typeof key !== "string" || !/^[0-9a-f]{64}$/u.test(key)) fail(`compile ${role} Ed25519 key invalid`);
}
function validateToolchainManifestDocument(value) {
  exactObject(value, ["schema", "kind", "attemptId", "runId", "sessionId", "sourceCommit", "sourceTree", "tools", "sysroot", "launch", "decision", "authority"], "toolchainManifest");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "TOOLCHAIN_MANIFEST" || value.sourceCommit !== BPS09_BPK00_BINDING.commit || value.sourceTree !== BPS09_BPK00_BINDING.tree || value.decision !== "HOLD" || value.authority !== "NONE") fail("toolchain source binding mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) canonicalText(value[key], `toolchainManifest.${key}`);
  exactObject(value.tools, ["compiler", "linker", "archiver", "staticNode"], "toolchainManifest.tools");
  for (const [role, identity] of Object.entries(value.tools)) validateFileIdentityDocument(identity, `toolchainManifest.tools.${role}`);
  exactObject(value.sysroot, ["root", "manifestSha256", "manifestByteLength", "entryCount", "readOnly"], "toolchainManifest.sysroot");
  absolutePath(value.sysroot.root, "toolchainManifest.sysroot.root"); if (!validSha(value.sysroot.manifestSha256) || value.sysroot.readOnly !== true) fail("sysroot identity mismatch"); canonicalU64(value.sysroot.manifestByteLength, "sysroot.manifestByteLength"); canonicalU64(value.sysroot.entryCount, "sysroot.entryCount");
  exactObject(value.launch, ["argvSha256", "environmentSha256", "cwd", "cwdIdentitySha256", "sourceDateEpoch", "locale", "timezone", "umask", "targetTriple", "network"], "toolchainManifest.launch");
  if (!validSha(value.launch.argvSha256) || !validSha(value.launch.environmentSha256) || !validSha(value.launch.cwdIdentitySha256) || value.launch.locale !== "C" || value.launch.timezone !== "UTC" || value.launch.umask !== "0022" || value.launch.network !== "NONE") fail("toolchain launch identity mismatch");
  absolutePath(value.launch.cwd, "toolchainManifest.launch.cwd"); canonicalU64(value.launch.sourceDateEpoch, "toolchainManifest.launch.sourceDateEpoch"); canonicalText(value.launch.targetTriple, "toolchainManifest.launch.targetTriple");
}
function validateZeroProofDocument(value) {
  exactObject(value, ["fdLedgerSha256", "processLedgerSha256", "mountLedgerSha256", "entryLedgerSha256", "cacheLedgerSha256", "allZero"], "compileEvidence.zeroProof");
  for (const key of ["fdLedgerSha256", "processLedgerSha256", "mountLedgerSha256", "entryLedgerSha256", "cacheLedgerSha256"]) if (!validSha(value[key])) fail(`invalid zero proof ${key}`);
  if (value.allZero !== true) fail("zero proof rejected");
}
function validateArtifactSetDocument(value, label) {
  exactObject(value, ["target", "installer", "objectMapSha256", "linkMapSha256", "diagnosticsSha256"], label);
  validateFileIdentityDocument(value.target, `${label}.target`); validateFileIdentityDocument(value.installer, `${label}.installer`);
  for (const key of ["objectMapSha256", "linkMapSha256", "diagnosticsSha256"]) if (!validSha(value[key])) fail(`${label}.${key} invalid`);
}
function validateCompileEvidenceDocument(value) {
  exactObject(value, ["schema", "kind", "attemptId", "runId", "sessionId", "bootstrapSha256", "attemptA", "attemptB", "artifactsByteEqual", "zeroProof", "independentReviewReceipt", "installed", "launched", "decision", "authority"], "compileEvidence");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "COMPILE_EVIDENCE" || !validSha(value.bootstrapSha256) || value.artifactsByteEqual !== true || value.independentReviewReceipt !== null || value.installed !== false || value.launched !== false || value.decision !== "HOLD" || value.authority !== "NONE") fail("compile evidence truth mismatch");
  validateArtifactSetDocument(value.attemptA, "compileEvidence.attemptA"); validateArtifactSetDocument(value.attemptB, "compileEvidence.attemptB"); validateZeroProofDocument(value.zeroProof);
  for (const role of ["target", "installer"]) if (value.attemptA[role].sha256 !== value.attemptB[role].sha256 || value.attemptA[role].byteLength !== value.attemptB[role].byteLength) fail(`compile evidence ${role} differs`);
  for (const key of ["objectMapSha256", "linkMapSha256", "diagnosticsSha256"]) if (value.attemptA[key] !== value.attemptB[key]) fail(`compile evidence ${key} differs`);
}
function canonicalText(value, label) {
  if (typeof value !== "string" || value.length === 0 || /[\0\r\n]/u.test(value)) fail(`${label} must be canonical text`);
}
function canonicalBasename(value, label) {
  canonicalText(value, label);
  if (value === "." || value === ".." || value.includes("/") || value.includes("\\")) fail(`${label} must be one basename`);
}
function canonicalBytes(value) { return Buffer.from(`${JSON.stringify(value)}\n`, "utf8"); }
function readAllAtFd(fd, maximum = 512 * 1024 * 1024) {
  const stat = fstatSync(fd, { bigint: true });
  if (!stat.isFile() || stat.size < 0n || stat.size > BigInt(maximum)) fail(`FD ${fd} is not a bounded regular file`);
  const bytes = Buffer.alloc(Number(stat.size));
  let offset = 0;
  while (offset < bytes.length) {
    const got = readSync(fd, bytes, offset, bytes.length - offset, offset);
    if (got <= 0) fail(`FD ${fd} short read`);
    offset += got;
  }
  return bytes;
}
function readCanonicalRecordFromFd(fd, maxBytes, label) {
  const stat = fstatSync(fd, { bigint: true });
  if (!stat.isFile() || stat.size <= 1n || stat.size > BigInt(maxBytes)) fail(`${label} must be a bounded sealed regular file`);
  const bytes = Buffer.alloc(Number(stat.size));
  let offset = 0;
  while (offset < bytes.length) {
    const got = readSync(fd, bytes, offset, bytes.length - offset, offset);
    if (got <= 0) fail(`${label} short read`);
    offset += got;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.includes("\r") || text.includes("\0")) fail(`${label} must be one canonical LF JSON record`);
  const value = JSON.parse(text.slice(0, -1));
  if (!canonicalBytes(value).equals(bytes)) fail(`${label} is not canonical JSON`);
  return Object.freeze({ bytes, value, stat });
}

function fdInfoBytes(fd) {
  return Buffer.from(readFileSync(`/proc/self/fdinfo/${fd}`, "utf8").replaceAll("\r", ""), "utf8");
}

function parseRequiredMemfdSeals(fdInfo, label) {
  const text = fdInfo.toString("utf8");
  const numeric = /^seals:\s+(?:0x([0-9a-f]+)|([0-9]+))$/imu.exec(text);
  if (numeric === null) fail(`${label} cannot prove F_GET_SEALS from its same-handle fdinfo`);
  const mask = Number.parseInt(numeric[1] ?? numeric[2], numeric[1] === undefined ? 10 : 16);
  if (mask !== REQUIRED_MEMFD_SEAL_MASK) fail(`${label} seal set must be exactly ${REQUIRED_MEMFD_SEALS.join("|")}`);
  return mask;
}

function snapshotSealedMemfd(fd, label, expectedByteLength = null) {
  const before = fstatSync(fd, { bigint: true });
  const target = readlinkSync(`/proc/self/fd/${fd}`);
  const beforeFdInfo = fdInfoBytes(fd);
  const flags = /^flags:\s+([0-7]+)$/mu.exec(beforeFdInfo.toString("utf8"));
  if (!before.isFile() || before.nlink !== 0n || before.uid !== 0n || (before.mode & 0o7777n) !== 0o400n ||
      !/^\/?memfd:[^\0\r\n]+ \(deleted\)$/u.test(target) || flags === null ||
      (Number.parseInt(flags[1], 8) & fsConstants.O_ACCMODE) !== fsConstants.O_RDONLY) {
    fail(`${label} must be the read-only 0400 root-owned nlink-zero sealed memfd same handle`);
  }
  parseRequiredMemfdSeals(beforeFdInfo, label);
  if (expectedByteLength !== null && before.size !== BigInt(expectedByteLength)) fail(`${label} byte length mismatch`);
  const bytes = readAllAtFd(fd, 4 * 1024 * 1024);
  const after = fstatSync(fd, { bigint: true });
  const afterFdInfo = fdInfoBytes(fd);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
      before.mode !== after.mode || before.uid !== after.uid || before.gid !== after.gid ||
      before.nlink !== after.nlink || !beforeFdInfo.equals(afterFdInfo)) {
    fail(`${label} changed during descriptor/content/kernel same-handle replay`);
  }
  return Object.freeze({
    fd,
    target,
    bytes,
    contentSha256: sha256(bytes),
    byteLength: String(bytes.byteLength),
    dev: String(before.dev),
    ino: String(before.ino),
    mountId: fdMountId(fd),
    nlink: String(before.nlink),
    mode: Number(before.mode & 0o7777n).toString(8).padStart(4, "0"),
    uid: String(before.uid),
    gid: String(before.gid),
    sealSet: REQUIRED_MEMFD_SEALS.join("|"),
    openFileDescriptionSha256: sha256(beforeFdInfo),
  });
}

function requireDistinctAnchorCapability(snapshot, otherFd, label) {
  const other = fstatSync(otherFd, { bigint: true });
  if (snapshot.fd === otherFd || (snapshot.dev === String(other.dev) && snapshot.ino === String(other.ino)) ||
      snapshot.openFileDescriptionSha256 === sha256(fdInfoBytes(otherFd))) {
    fail(`${label} aliases inherited FD ${otherFd}`);
  }
}

function buildFd12Descriptor(snapshot) {
  const handleProjection = Object.freeze({
    domain: "IAT_B3_BPS09_FD12_OWNER_ROOT_KEY_HANDLE_V1",
    checkpointCommit: BPS09_BPK00_BINDING.commit,
    checkpointTree: BPS09_BPK00_BINDING.tree,
    checkpointBlob: BPS09_BPK00_BINDING.blobSha1,
    checkpointPath: BPS09_BPK00_BINDING.path,
    checkpointFileSha256: BPS09_BPK00_BINDING.fileSha256,
    checkpointFileByteLength: String(BPS09_BPK00_BINDING.byteLength),
    fd: String(FD.ownerRootKeyAnchor),
    contentSha256: snapshot.contentSha256,
    byteLength: snapshot.byteLength,
    dev: snapshot.dev,
    ino: snapshot.ino,
    mountId: snapshot.mountId,
    nlink: snapshot.nlink,
    mode: snapshot.mode,
    uid: snapshot.uid,
    gid: snapshot.gid,
    sealSet: snapshot.sealSet,
  });
  const descriptor = Object.freeze({
    schema: "iat-b3-bps09-fd12-owner-root-key-anchor-descriptor/v1",
    producer: "BPK00",
    outcome: BPK00_CHECKPOINT_OUTCOME,
    checkpointCommit: BPS09_BPK00_BINDING.commit,
    checkpointTree: BPS09_BPK00_BINDING.tree,
    checkpointBlob: BPS09_BPK00_BINDING.blobSha1,
    checkpointPath: BPS09_BPK00_BINDING.path,
    checkpointFileSha256: BPS09_BPK00_BINDING.fileSha256,
    checkpointFileByteLength: String(BPS09_BPK00_BINDING.byteLength),
    rootFingerprintSha256: BPS09_BPK00_BINDING.rootFingerprintSha256,
    rootPublicKeyHex: BPS09_BPK00_BINDING.rootPublicKeyHex,
    provisioningReceiptSha256: BPS09_BPK00_BINDING.ownerProvisioningReceiptSha256,
    fd: String(FD.ownerRootKeyAnchor),
    contentSha256: snapshot.contentSha256,
    byteLength: snapshot.byteLength,
    dev: snapshot.dev,
    ino: snapshot.ino,
    mountId: snapshot.mountId,
    nlink: snapshot.nlink,
    mode: snapshot.mode,
    uid: snapshot.uid,
    gid: snapshot.gid,
    sealSet: snapshot.sealSet,
    handleSha256: sha256(canonicalBytes(handleProjection)),
    openFileDescriptionSha256: snapshot.openFileDescriptionSha256,
    sameHandleReplayRequired: true,
    verifiedBeforeFd11: true,
    verifiedBeforeFd3: true,
    verifiedBeforePeerRpc: true,
    decision: "HOLD",
    authority: "NONE",
  });
  return Object.freeze({ descriptor, descriptorSha256: sha256(canonicalBytes(descriptor)) });
}

export function verifyFd12OwnerRootTrustAnchor() {
  const exactSealPolicy = "F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE|F_SEAL_FUTURE_WRITE";
  const exactMode = "0400";
  const snapshot = snapshotSealedMemfd(FD.ownerRootKeyAnchor, "FD12 owner-root key anchor", 32);
  const rootPublicKeyHex = snapshot.bytes.toString("hex");
  if (snapshot.sealSet !== exactSealPolicy || snapshot.mode !== exactMode ||
      snapshot.nlink !== "0" || snapshot.uid !== "0" || snapshot.byteLength !== "32" ||
      !/^(?:0|[1-9][0-9]*)$/u.test(snapshot.dev) || !/^(?:0|[1-9][0-9]*)$/u.test(snapshot.ino) ||
      !/^(?:0|[1-9][0-9]*)$/u.test(snapshot.mountId) ||
      !validSha(snapshot.openFileDescriptionSha256) ||
      BPS09_BPK00_BINDING.commit !== "512b347ebf4de80bf5a50e0d8491f14eeef0f9f0" ||
      BPS09_BPK00_BINDING.tree !== "c4e8e6ca1c54e9154743dd2fea7b434307d74676" ||
      BPS09_BPK00_BINDING.blobSha1 !== "8e38e773ed4f11a4aefd8787c63c535775056c1a" ||
      BPS09_BPK00_BINDING.fileSha256 !== "7865d0fb44465fbce2100af78d2392b3bc29a2f4a7ff2969b501bc2a0134bb21" ||
      rootPublicKeyHex !== "60fa8f2c48a8bc6d2ad476b094bb2f569f020211bf834deb144d2e2958ac4230" ||
      snapshot.contentSha256 !== "49e4e1637075a367448705ea703628f045cde70c489286b84d1db8f5697557f1" ||
      sha256(Buffer.from(rootPublicKeyHex, "hex")) !== "49e4e1637075a367448705ea703628f045cde70c489286b84d1db8f5697557f1" ||
      BPS09_BPK00_BINDING.ownerProvisioningReceiptSha256 !== "3e1aa94f5203e882155d953e77f1036bb418929b5d6ddc5fe80070a4a0898f3a") {
    fail("FD12 raw32 key/content/fingerprint differs from corrected BPK00");
  }
  for (const fd of EXPECTED_INHERITED_FDS) if (fd !== FD.ownerRootKeyAnchor) requireDistinctAnchorCapability(snapshot, fd, "FD12 owner-root key anchor");
  const built = buildFd12Descriptor(snapshot);
  if (!validSha(built.descriptor.handleSha256) || !validSha(built.descriptor.openFileDescriptionSha256) ||
      built.descriptor.dev !== snapshot.dev || built.descriptor.ino !== snapshot.ino ||
      built.descriptor.mountId !== snapshot.mountId || built.descriptor.nlink !== "0" ||
      built.descriptor.uid !== "0" || built.descriptor.mode !== "0400") fail("FD12 runtime descriptor omitted kernel/handle/OFD identity");
  return Object.freeze({
    snapshot,
    descriptor: built.descriptor,
    descriptorSha256: built.descriptorSha256,
    rootPublicKeyHex,
    rootFingerprintSha256: BPS09_BPK00_BINDING.rootFingerprintSha256,
    ownerProvisioningReceiptSha256: BPS09_BPK00_BINDING.ownerProvisioningReceiptSha256,
  });
}

function numericFirmwareAtLeast2124(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(value)) return false;
  const [major, minor, patch] = value.split(".").map(Number);
  return major > 2 || (major === 2 && (minor > 12 || (minor === 12 && patch >= 4)));
}

function compareLittleEndian(left, right) {
  for (let index = left.length - 1; index >= 0; index -= 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function assertStrictCanonicalEd25519(rootKey, signature) {
  const fieldPrime = Buffer.from("edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f", "hex");
  const groupOrder = Buffer.from("edd3f55c1a631258d69cf7a2def9de14f0000000000000000000000000000010", "hex");
  for (const [encodedPoint, label] of [[rootKey, "root public key"], [signature.subarray(0, 32), "signature R"]]) {
    const y = Buffer.from(encodedPoint); y[31] &= 0x7f;
    if (compareLittleEndian(y, fieldPrime) >= 0) fail(`noncanonical Ed25519 ${label}`);
  }
  if (compareLittleEndian(signature.subarray(32), groupOrder) >= 0) fail("noncanonical Ed25519 signature scalar");
}

function canonicalSubjectPreimage(subject) {
  return Buffer.concat([
    Buffer.from(BPS08_ANCHOR_SUBJECT_DOMAIN, "ascii"),
    Buffer.from([0]),
    Buffer.from(JSON.stringify(subject), "utf8"),
    Buffer.from("\n", "ascii"),
  ]);
}

function requireAnchorShaFields(subject) {
  for (const key of [
    "anchorCasKeySha256", "anchorCasAcquireReceiptSha256", "ownerRootFingerprintSha256",
    "ownerRootProvisioningReceiptSha256", "ownerRootKeyAnchorDescriptorSha256",
    "ownerRootKeyAnchorHandleSha256", "ownerRootKeyAnchorOpenFileDescriptionSha256",
    "ownerRootKeyAnchorContentSha256", "deviceFirmwareIdentitySha256", "deviceReceiptSha256",
    "physicalConfirmationReceiptSha256", "ocmsSignerListSha256", "bps05ManifestSha256",
    "bps06ManifestSha256", "bpc01ManifestSha256", "successorExecutorSha256",
    "sourceFdManifestSha256", "toolchainManifestSha256", "toolOpenFileDescriptionManifestSha256",
    "sysrootManifestSha256", "staticNodeIdentitySha256", "launchArgvSha256",
    "launchEnvironmentSha256", "launchCwdIdentitySha256", "startupClosureSha256",
    "watchdogPrincipalSha256", "observerPrincipalSha256", "custodianPrincipalSha256",
    "watchdogChannelOfdSha256", "observerChannelOfdSha256", "custodianChannelOfdSha256",
    "operationTimerOfdSha256", "teardownTimerOfdSha256",
  ]) if (!validSha(subject[key])) fail(`FD11 subject.${key} must be exact lowercase SHA-256`);
}

export function verifyFd11OcmsV1AnchorReceipt(fd12Anchor, executorSourceSha256) {
  const minimumFirmwareVersion = "2.12.4";
  if (fd12Anchor?.descriptor?.verifiedBeforeFd11 !== true) fail("FD12 must be checkpoint-verified before FD11");
  const fd11Snapshot = snapshotSealedMemfd(FD.anchorReceipt, "FD11 anchor receipt");
  requireDistinctAnchorCapability(fd11Snapshot, FD.ownerRootKeyAnchor, "FD11 anchor receipt");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(fd11Snapshot.bytes);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.includes("\r") || text.includes("\0")) fail("FD11 must be one canonical JSON UTF-8 LF receipt");
  const receipt = JSON.parse(text.slice(0, -1));
  if (!canonicalBytes(receipt).equals(fd11Snapshot.bytes)) fail("FD11 receipt bytes are not canonical");
  exactObject(receipt, BPS08_ANCHOR_RECEIPT_FIELDS, "FD11 anchorReceipt");
  exactObject(receipt.subject, BPS08_ANCHOR_SUBJECT_FIELDS, "FD11 anchorReceipt.subject");
  const subject = receipt.subject;
  requireAnchorShaFields(subject);
  for (const key of ["attemptId", "runId", "sessionId", "bootId", "deviceDerivationPath", "deviceAccountAddress"]) canonicalText(subject[key], `FD11 subject.${key}`);
  if (receipt.schema !== BPS08_ANCHOR_SCHEMA ||
      receipt.producer !== "EXTERNAL_PRELAUNCH_SUPERVISOR_ANCHOR_CUSTODIAN" ||
      receipt.outcome !== "COMPILE_PEER_TRUST_ANCHOR_HOLD" ||
      receipt.attemptId !== subject.attemptId || receipt.runId !== subject.runId || receipt.sessionId !== subject.sessionId ||
      receipt.decision !== "HOLD" || receipt.authority !== "NONE" ||
      subject.schema !== "iat-b3-bps08-compile-peer-anchor-subject/v1" ||
      subject.decision !== "HOLD" || subject.authority !== "NONE") fail("FD11 receipt/subject identity or HOLD/NONE truth mismatch");
  if (!/^[0-9a-f]{64}$/u.test(subject.anchorNonceHex)) fail("FD11 one-use nonce is not raw32 lowercase hex");
  for (const key of ["anchorExpiresAtMonotonicNs", "operationDeadlineMonotonicNs", "teardownDeadlineMonotonicNs"]) canonicalU64(subject[key], `FD11 subject.${key}`);
  const now = process.hrtime.bigint();
  if (BigInt(subject.anchorExpiresAtMonotonicNs) <= now || BigInt(subject.operationDeadlineMonotonicNs) <= now ||
      BigInt(subject.teardownDeadlineMonotonicNs) <= BigInt(subject.operationDeadlineMonotonicNs)) fail("FD11 monotonic one-use/deadline receipt is expired or reordered");
  if (subject.ownerRootFingerprintSha256 !== fd12Anchor.rootFingerprintSha256 ||
      subject.ownerRootPublicKeyHex !== fd12Anchor.rootPublicKeyHex ||
      subject.ownerRootProvisioningReceiptSha256 !== fd12Anchor.ownerProvisioningReceiptSha256 ||
      subject.ownerRootKeyAnchorFd !== 12 || subject.ownerRootKeyAnchorProducer !== "BPK00" ||
      subject.ownerRootKeyAnchorOutcome !== BPK00_CHECKPOINT_OUTCOME ||
      subject.ownerRootKeyAnchorDescriptorSha256 !== fd12Anchor.descriptorSha256 ||
      subject.ownerRootKeyAnchorDev !== fd12Anchor.snapshot.dev ||
      subject.ownerRootKeyAnchorIno !== fd12Anchor.snapshot.ino ||
      subject.ownerRootKeyAnchorMountId !== fd12Anchor.snapshot.mountId ||
      subject.ownerRootKeyAnchorHandleSha256 !== fd12Anchor.descriptor.handleSha256 ||
      subject.ownerRootKeyAnchorOpenFileDescriptionSha256 !== fd12Anchor.snapshot.openFileDescriptionSha256 ||
      subject.ownerRootKeyAnchorContentSha256 !== fd12Anchor.snapshot.contentSha256 ||
      subject.ownerRootKeyAnchorByteLength !== "32") fail("FD11 did not byte-bind the verified FD12 descriptor/content/kernel identity");
  if (subject.bps05ManifestSha256 !== "09be6c33631845b2c300db6ba37157f667541335f00a9f31ec2e63df3d106b0b" ||
      subject.bps06ManifestSha256 !== "9f36884b53aa4646739b24e9829c69abd9a964a2ebc01934bc9217f78faafd7c" ||
      subject.bpc01Commit !== "fd47774fe6523e181b792d187a4bae708f96ad9d" ||
      subject.bpc01Tree !== "1a81c083b9207eaa6f0d4dd74c4c562aa9268201" ||
      subject.bpc01ManifestSha256 !== "504e093893403af28e7291c49cdb5bbd6a387810d438359973ff3070ac897513" ||
      subject.successorExecutorSha256 !== executorSourceSha256) fail("FD11 predecessor/executor lineage mismatch");
  if (minimumFirmwareVersion !== "2.12.4" || subject.deviceModel !== "T2T1" || !numericFirmwareAtLeast2124(subject.deviceFirmwareVersion) ||
      subject.deviceAccountPublicKeyHex !== fd12Anchor.rootPublicKeyHex ||
      subject.ocmsVersion !== 1 || subject.ocmsSignerCount !== 1 || subject.ocmsSignerIndex !== 0 ||
      subject.ocmsSignerPublicKeyHex !== fd12Anchor.rootPublicKeyHex ||
      subject.ocmsSignerListByteLength !== 33) fail("FD11 T2T1 firmware/account/OCMS-v1 capability binding mismatch");
  const peerKeys = [subject.watchdogPublicKeyHex, subject.observerPublicKeyHex, subject.custodianPublicKeyHex];
  if (peerKeys.some((key) => !/^[0-9a-f]{64}$/u.test(key) || key === fd12Anchor.rootPublicKeyHex) ||
      new Set(peerKeys).size !== peerKeys.length) fail("FD11 peer keys are invalid, aliased, or selected by the owner root");
  const subjectSha256 = sha256(canonicalSubjectPreimage(subject));
  if (receipt.subjectSha256 !== subjectSha256) fail("FD11 subject domain/NUL/canonical-JSON/LF SHA-256 mismatch");
  const body = Buffer.from(`${BPS08_HARDWARE_MESSAGE_PREFIX}${subjectSha256}`, "utf8");
  if (body.byteLength !== 100 || receipt.hardwareMessageAscii !== body.toString("ascii") ||
      receipt.messageBodySha256 !== sha256(body) || receipt.messageBodyByteLength !== 100) fail("FD11 exact OCMS application body mismatch");
  const rootKey = Buffer.from(fd12Anchor.rootPublicKeyHex, "hex");
  const signerList = Buffer.concat([Buffer.from([1]), rootKey]);
  if (signerList.byteLength !== 33 || subject.ocmsSignerListSha256 !== sha256(signerList) ||
      receipt.signerListSha256 !== sha256(signerList) || receipt.signerListByteLength !== 33) fail("FD11 causal OCMS signer list mismatch");
  const serialized = Buffer.concat([OCMS_V1_PREFIX, Buffer.from([1, 1]), rootKey, body]);
  const signedData = serialized;
  if (serialized.byteLength !== 150 || receipt.ocmsVersion !== 1 ||
      !signedData.equals(serialized) || receipt.serializedMessageSha256 !== sha256(signedData) ||
      receipt.serializedMessageByteLength !== 150) fail("FD11 firmware returned signedData differs from rebuilt OCMS-v1 bytes or attempted an OCMS-v0 downgrade");
  const signature = Buffer.from(receipt.signatureHex, "hex");
  if (signature.byteLength !== 64 || receipt.signatureByteLength !== 64 ||
      receipt.signatureSha256 !== sha256(signature) || receipt.rootPublicKeyHex !== fd12Anchor.rootPublicKeyHex ||
      receipt.deviceReceiptSha256 !== subject.deviceReceiptSha256) fail("FD11 signature/device envelope mismatch");
  assertStrictCanonicalEd25519(rootKey, signature);
  const publicKey = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, rootKey]), format: "der", type: "spki" });
  if (!verifySignature(null, signedData, publicKey, signature)) fail("FD11 strict Ed25519 verification over rebuilt OCMS-v1 signedData bytes failed");
  const fd12Replay = verifyFd12OwnerRootTrustAnchor();
  if (fd12Replay.descriptorSha256 !== fd12Anchor.descriptorSha256 ||
      !fd12Replay.snapshot.bytes.equals(fd12Anchor.snapshot.bytes)) fail("FD12 changed after FD11 verification");
  const fd11Replay = snapshotSealedMemfd(FD.anchorReceipt, "FD11 anchor receipt post-verification");
  if (!fd11Replay.bytes.equals(fd11Snapshot.bytes) || fd11Replay.openFileDescriptionSha256 !== fd11Snapshot.openFileDescriptionSha256) fail("FD11 changed during OCMS verification");
  return Object.freeze({ receipt, subject, subjectSha256, serializedMessageSha256: sha256(serialized), fd11Snapshot, fd12Anchor });
}

export function verifyFd11AnchorReceipt(fd12Anchor, executorSourceSha256) {
  return verifyFd11OcmsV1AnchorReceipt(fd12Anchor, executorSourceSha256);
}
function verifyCompleteFdTable() {
  const live = [];
  for (const name of readdirSync("/proc/self/fd")) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(name)) fail("noncanonical proc fd entry");
    const fd = Number(name);
    try { fstatSync(fd); live.push(fd); } catch (error) { if (error?.code !== "EBADF") throw error; }
  }
  live.sort((left, right) => left - right);
  for (const expected of EXPECTED_INHERITED_FDS) if (!live.includes(expected)) fail(`inherited FD table omits required FD ${expected}`);
  const startupInternals = [];
  for (const fd of live.filter((value) => !EXPECTED_INHERITED_FDS.includes(value))) {
    const target = readlinkSync(`/proc/self/fd/${fd}`);
    const stat = fstatSync(fd, { bigint: true });
    if (!/^(?:anon_inode:\[(?:eventpoll|eventfd)\]|pipe:\[[0-9]+\])$/u.test(target) || !(stat.isFIFO() || target.startsWith("anon_inode:"))) fail(`unexpected startup capability FD ${fd}`);
    startupInternals.push(Object.freeze({ fd, target, dev: String(stat.dev), ino: String(stat.ino), mode: String(stat.mode), mountId: fdMountId(fd), fdInfoSha256: sha256(Buffer.from(readFileSync(`/proc/self/fdinfo/${fd}`, "utf8").replaceAll("\r", ""), "utf8")) }));
  }
  for (const fd of EXPECTED_INHERITED_FDS) fstatSync(fd);
  for (const [role, fd] of Object.entries(TOOL_FDS)) if (!Number.isSafeInteger(fd) || fd < 20) fail(`invalid fixed tool FD for ${role}`);
  return Object.freeze({ live: Object.freeze(live), startupInternals: Object.freeze(startupInternals), startupClosureSha256: sha256(canonicalBytes(startupInternals)) });
}
function fdMountId(fd) {
  const text = readFileSync(`/proc/self/fdinfo/${fd}`, "utf8");
  const match = /^mnt_id:\s+([0-9]+)$/mu.exec(text);
  if (match === null) fail(`missing mount ID for FD ${fd}`);
  return match[1];
}

function verifyRuntimeDirectoryIdentity(fd, expected, label) {
  const stat = fstatSync(fd, { bigint: true });
  if (!stat.isDirectory() ||
      expected.dev !== String(stat.dev) ||
      expected.ino !== String(stat.ino) ||
      expected.mountId !== fdMountId(fd) ||
      expected.mode !== Number(stat.mode & 0o7777n).toString(8).padStart(4, "0") ||
      expected.openFileDescriptionSha256 !== sha256(fdInfoBytes(fd))) {
    fail(`${label} same-handle runtime-binding identity mismatch`);
  }
}

function assertExternalDeadlineOpen(bootstrap, label, cleanup = false) {
  const deadlineDocument = cleanup ? bootstrap.teardownDeadline : bootstrap.deadline;
  const expectedTimerFd = cleanup ? FD.cleanupTimer : FD.teardownTimer;
  const deadline = BigInt(deadlineDocument.absoluteNanoseconds);
  if (process.hrtime.bigint() >= deadline) fail(`${label} deadline expired`);
  if (deadlineDocument.timerFd !== String(expectedTimerFd)) fail(`${label} timer FD mismatch`);
  const stat = fstatSync(expectedTimerFd, { bigint: true });
  if (deadlineDocument.timerDev !== String(stat.dev) || deadlineDocument.timerIno !== String(stat.ino) || readlinkSync(`/proc/self/fd/${expectedTimerFd}`) !== "anon_inode:[timerfd]") fail(`${label} timer identity mismatch`);
  const fdInfo = readFileSync(`/proc/self/fdinfo/${expectedTimerFd}`, "utf8");
  const flags = /^flags:\s+([0-7]+)$/mu.exec(fdInfo);
  if (flags === null || (Number.parseInt(flags[1], 8) & fsConstants.O_NONBLOCK) === 0) fail(`${label} timer must be nonblocking`);
  try {
    const probe = Buffer.alloc(8); readSync(expectedTimerFd, probe, 0, probe.length, null);
    fail(`${label} timer has fired or closed`);
  } catch (error) {
    if (error?.code !== "EAGAIN" && error?.code !== "EWOULDBLOCK") throw error;
  }
}

function receiptPeerRole(fd) {
  if (fd === FD.watchdog) return "watchdog";
  if (fd === FD.observer) return "observer";
  if (fd === FD.custodian) return "custodian";
  fail(`FD ${fd} has no authenticated compile peer role`);
}

function verifyAuthenticatedReceiptSignature(receipt, bootstrap, fd) {
  const role = receiptPeerRole(fd);
  const rawPublicKey = Buffer.from(bootstrap.peerSigningKeys[role], "hex");
  const publicKey = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, rawPublicKey]), format: "der", type: "spki" });
  const signature = Buffer.from(receipt.signatureHex, "hex");
  const signedProjection = {
    schema: receipt.schema, operation: receipt.operation, sequence: receipt.sequence,
    channelIdentitySha256: receipt.channelIdentitySha256, requestSha256: receipt.requestSha256,
    attemptId: receipt.attemptId, runId: receipt.runId, sessionId: receipt.sessionId,
    producer: receipt.producer, payload: receipt.payload, decision: receipt.decision, authority: receipt.authority,
  };
  if (signature.length !== 64 || !verifySignature(null, canonicalBytes(signedProjection), publicKey, signature)) fail(`authenticated ${role} receipt signature invalid`);
}

function endpointIdentitySha256(fd) {
  const stat = fstatSync(fd, { bigint: true });
  const target = readlinkSync(`/proc/self/fd/${fd}`);
  const fdInfoText = readFileSync(`/proc/self/fdinfo/${fd}`, "utf8").replaceAll("\r", "");
  const flags = /^flags:\s+([0-7]+)$/mu.exec(fdInfoText);
  if (!stat.isSocket() || !/^socket:\[[0-9]+\]$/u.test(target) || flags === null || (Number.parseInt(flags[1], 8) & fsConstants.O_NONBLOCK) === 0) fail(`FD ${fd} is not a nonblocking authenticated channel socket`);
  return sha256(canonicalBytes({ fd, target, dev: String(stat.dev), ino: String(stat.ino), mountId: fdMountId(fd), fdInfoSha256: sha256(Buffer.from(fdInfoText, "utf8")) }));
}
function verifyFileIdentity(fd, identity, label, requireExecutable) {
  const stat = fstatSync(fd, { bigint: true });
  const bytes = readAllAtFd(fd);
  const resolvedPath = readlinkSync(`/proc/self/fd/${fd}`);
  if (resolvedPath.endsWith(" (deleted)")) fail(`${label} refers to a deleted object`);
  const mountId = fdMountId(fd);
  const handleProjection = { domain: "IAT_B3_BPS09_FILE_HANDLE_V1", path: resolvedPath, dev: String(stat.dev), ino: String(stat.ino), mountId, mode: (Number(stat.mode & 0o7777n)).toString(8).padStart(4, "0"), uid: String(stat.uid), gid: String(stat.gid), nlink: String(stat.nlink), byteLength: String(stat.size), sha256: sha256(bytes) };
  const fdInfoBytes = Buffer.from(readFileSync(`/proc/self/fdinfo/${fd}`, "utf8").replaceAll("\r", ""), "utf8");
  if (!stat.isFile() || stat.nlink !== 1n || identity.path !== resolvedPath || identity.dev !== String(stat.dev) || identity.ino !== String(stat.ino) || identity.mountId !== mountId || identity.byteLength !== String(bytes.byteLength) || identity.nlink !== "1" || identity.uid !== String(stat.uid) || identity.gid !== String(stat.gid) || identity.mode !== handleProjection.mode || !equalHex(identity.sha256, sha256(bytes)) || !equalHex(identity.handleSha256, sha256(canonicalBytes(handleProjection))) || !equalHex(identity.openFileDescriptionSha256, sha256(fdInfoBytes)) || identity.sameHandleReplayRequired !== true) fail(`${label} same-handle identity mismatch`);
  if (requireExecutable && (stat.mode & 0o111n) === 0n) fail(`${label} is not executable`);
  return Object.freeze({ stat, digest: sha256(bytes) });
}

function verifyPinnedSourceFd(row, expected) {
  exactObject(row, ["fd", "path", "sha256", "byteLength"], `sourceInputs.${expected.path}`);
  if (row.fd !== expected.fd || row.path !== expected.path || (expected.sha256 !== null && row.sha256 !== expected.sha256) || (expected.byteLength !== null && row.byteLength !== expected.byteLength) || !validSha(row.sha256) || !Number.isSafeInteger(row.byteLength) || row.byteLength <= 0) fail("compile source input identity mismatch");
  const stat = fstatSync(row.fd, { bigint: true });
  const bytes = readAllAtFd(row.fd);
  if (!stat.isFile() || stat.nlink !== 1n || bytes.byteLength !== row.byteLength || !equalHex(sha256(bytes), row.sha256)) fail("compile source same-handle bytes mismatch");
  return Object.freeze({ fd: row.fd, path: row.path, sha256: row.sha256, byteLength: row.byteLength });
}

function portableManifestSha256(rows) {
  const sorted = [...rows].sort((left, right) => Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8")));
  const payload = Buffer.concat(sorted.map((row) => Buffer.concat([Buffer.from("100644\0", "utf8"), Buffer.from(row.sha256, "ascii"), Buffer.from("\0", "utf8"), Buffer.from(String(row.byteLength), "ascii"), Buffer.from("\0", "utf8"), Buffer.from(row.path, "utf8"), Buffer.from("\n", "utf8")])));
  return Object.freeze({ sha256: sha256(payload), byteLength: payload.byteLength, pathCount: sorted.length, payloadByteLength: sorted.reduce((sum, row) => sum + row.byteLength, 0), rows: Object.freeze(sorted) });
}

function planSourceFdProjection(rows) {
  return rows.map((row)=>({fd:row.fd,path:row.path,sha256:row.sha256,byteLength:String(row.byteLength),observedFdInfoSha256:sha256(Buffer.from(readFileSync(`/proc/self/fdinfo/${row.fd}`,"utf8").replaceAll("\r",""),"utf8"))}));
}

function assertPlan(plan, bootstrap, manifest) {
  exactObject(plan, ["schema", "sourceCommit", "sourceTree", "sourceManifestSha256", "controllerSourceManifestSha256", "sourceInputs", "attemptRoots", "outputNames", "artifactPlans", "environment", "limits", "decision", "authority"], "compilePlan");
  if (plan.schema !== PLAN_SCHEMA || plan.sourceCommit !== BPS09_BPK00_BINDING.commit || plan.sourceTree !== BPS09_BPK00_BINDING.tree || plan.sourceManifestSha256 !== BPS09_BPK00_BINDING.fileSha256) fail("compile plan source binding mismatch");
  denseTuple(plan.sourceInputs, BPC01_SOURCE_ROWS.length + BPS09_SOURCE_ROWS.length, "compilePlan.sourceInputs");
  for (let index = 0; index < BPC01_SOURCE_ROWS.length; index += 1) verifyPinnedSourceFd(plan.sourceInputs[index], BPC01_SOURCE_ROWS[index]);
  const controllerRows = BPS09_SOURCE_ROWS.map((expected, index) => verifyPinnedSourceFd(plan.sourceInputs[BPC01_SOURCE_ROWS.length + index], expected));
  const controllerManifest = portableManifestSha256(controllerRows);
  if (plan.controllerSourceManifestSha256 !== controllerManifest.sha256) fail("controller source manifest does not bind all five same-handle sources");
  if (!Array.isArray(plan.attemptRoots) || plan.attemptRoots.length !== 2 || plan.attemptRoots[0] !== bootstrap.attemptRoots[0] || plan.attemptRoots[1] !== bootstrap.attemptRoots[1] || plan.attemptRoots[0] === plan.attemptRoots[1]) fail("compile roots mismatch");
  exactObject(plan.outputNames, ["target", "installer"], "compilePlan.outputNames");
  canonicalBasename(plan.outputNames.target, "compilePlan.outputNames.target");
  canonicalBasename(plan.outputNames.installer, "compilePlan.outputNames.installer");
  if (plan.outputNames.target !== bootstrap.outputNames.target || plan.outputNames.installer !== bootstrap.outputNames.installer || plan.outputNames.target === plan.outputNames.installer) fail("compile output names mismatch");
  if (!Array.isArray(plan.artifactPlans) || plan.artifactPlans.length !== 2 || plan.artifactPlans[0].artifact !== SUPERVISOR_ARTIFACT || plan.artifactPlans[1].artifact !== INSTALL_CONTROLLER_ARTIFACT) fail("two exact artifact plans required");
  for (const [index, artifactPlan] of plan.artifactPlans.entries()) {
    exactObject(artifactPlan, ["artifact", "outputName", "compile", "link"], `artifactPlans[${index}]`);
    const expectedName = index === 0 ? plan.outputNames.target : plan.outputNames.installer;
    const requiredSourceFd = index === 0 ? BPC01_SOURCE_ROWS.find((row) => row.path.endsWith("iat_b3_post_checkpoint_prelaunch_supervisor_package_bound.c")).fd : CONTROLLER_INSTALL_SOURCE_FD;
    if (artifactPlan.outputName !== expectedName) fail("artifact output name mismatch");
    for (const [phase, stage] of [["compile", artifactPlan.compile], ["link", artifactPlan.link]]) {
      exactObject(stage, ["toolRole", "toolFd", "argv", "cwd"], `${artifactPlan.artifact}.${phase}`);
      const expectedRole = phase === "compile" ? "compiler" : "linker";
      if (stage.toolRole !== expectedRole || stage.toolFd !== TOOL_FDS[expectedRole] || !Array.isArray(stage.argv) || stage.argv.length === 0 || !stage.argv.some((argument) => argument.includes("{ATTEMPT_ROOT}")) || stage.argv.some((argument) => typeof argument !== "string" || /[\0\r\n]/u.test(argument) || argument.startsWith("@") || /(?:^|\/)\.\.(?:\/|$)/u.test(argument) || /(?:plugin|preload|response-file|^-Xclang$|^-load$|^-B|^--?specs(?:=|$)|^--?resource-dir(?:=|$)|^--?wrapper(?:=|$)|^--?save-temps)/iu.test(argument))) fail("compile stage role/FD/argv mismatch");
      for (const argument of stage.argv) {
        const scrubbed=argument.replaceAll(`/proc/self/fd/${requiredSourceFd}`,"").replace(/\{ATTEMPT_ROOT\}(?:\/[A-Za-z0-9._-]+)*/gu,"");
        if(scrubbed.includes("/")||scrubbed.includes("\\"))fail("compile stage received an unreviewed absolute/path capability");
      }
      if (stage.cwd !== plan.attemptRoots[0] && stage.cwd !== plan.attemptRoots[1]) fail("compile stage cwd must be rebound per attempt");
    }
    if (!artifactPlan.compile.argv.includes(`/proc/self/fd/${requiredSourceFd}`)) fail("artifact compile stage does not consume its exact reviewed source FD");
    const allSourceFdArguments = [...BPC01_SOURCE_ROWS, ...BPS09_SOURCE_ROWS].map((row) => `/proc/self/fd/${row.fd}`);
    if (artifactPlan.compile.argv.filter((argument) => allSourceFdArguments.includes(argument)).length !== 1 || artifactPlan.link.argv.some((argument) => allSourceFdArguments.includes(argument))) fail("tool stage received an unrelated source capability");
  }
  exactObject(plan.environment, ["LANG", "LC_ALL", "TZ", "SOURCE_DATE_EPOCH", "PATH", "network", "plugins", "preloads"], "compilePlan.environment");
  if (plan.environment.LANG !== "C" || plan.environment.LC_ALL !== "C" || plan.environment.TZ !== "UTC" || plan.environment.SOURCE_DATE_EPOCH !== manifest.launch.sourceDateEpoch || plan.environment.PATH !== "" || plan.environment.network !== "NONE" || plan.environment.plugins !== "NONE" || plan.environment.preloads !== "NONE") fail("compile environment mismatch");
  exactObject(plan.limits, ["maxProcesses", "maxArtifactBytes", "maxDiagnosticsBytes", "absoluteDeadlineNanoseconds"], "compilePlan.limits");
  for (const value of Object.values(plan.limits)) if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value) || BigInt(value) > 18446744073709551615n) fail("compile limit invalid");
  if (plan.limits.maxProcesses !== "1" || plan.limits.maxDiagnosticsBytes !== "0" || plan.limits.maxArtifactBytes === "0" || plan.limits.absoluteDeadlineNanoseconds !== bootstrap.deadline.absoluteNanoseconds) fail("compile resource/deadline policy mismatch");
  if (plan.decision !== "HOLD" || plan.authority !== "NONE") fail("compile plan must remain HOLD/NONE");
  return controllerManifest;
}

async function exchangeAuthenticatedReceipt(fd, producer, operation, payload, bootstrap, cleanup = false) {
  assertExternalDeadlineOpen(bootstrap, `${operation} prewrite`, cleanup);
  const channelIdentitySha256 = endpointIdentitySha256(fd);
  const sequence = String((RECEIPT_SEQUENCES.get(fd) ?? 0n) + 1n);
  RECEIPT_SEQUENCES.set(fd, BigInt(sequence));
  const request = { schema: RECEIPT_SCHEMA, operation, sequence, channelIdentitySha256, attemptId: bootstrap.attemptId, runId: bootstrap.runId, sessionId: bootstrap.sessionId, payload, decision: "HOLD", authority: "NONE" };
  const requestBytes = canonicalBytes(request);
  const frame = Buffer.concat([Buffer.from(String(requestBytes.length).padStart(10, "0") + "\n", "ascii"), requestBytes]);
  let written = 0;
  while (written < frame.length) {
    assertExternalDeadlineOpen(bootstrap, `${operation} write`, cleanup);
    try {
      const count = writeSync(fd, frame, written, frame.length - written, null);
      if (count <= 0) fail(`${operation} channel short write`);
      written += count;
    } catch (error) {
      if (error?.code !== "EAGAIN" && error?.code !== "EWOULDBLOCK") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  const header = Buffer.alloc(11); let headerOffset = 0;
  while (headerOffset < header.length) {
    assertExternalDeadlineOpen(bootstrap, `${operation} header read`, cleanup);
    try {
      const count = readSync(fd, header, headerOffset, header.length - headerOffset, null);
      if (count <= 0) fail(`${operation} channel closed before receipt header`);
      headerOffset += count;
    } catch (error) {
      if (error?.code !== "EAGAIN" && error?.code !== "EWOULDBLOCK") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  const lengthText = header.subarray(0, 10).toString("ascii");
  if (!/^[0-9]{10}$/u.test(lengthText) || header[10] !== 0x0a) fail("receipt length frame invalid");
  const length = Number(lengthText);
  if (length <= 1 || length > 1024 * 1024) fail("receipt length out of range");
  const bytes = Buffer.alloc(length); let bodyOffset = 0;
  while (bodyOffset < bytes.length) {
    assertExternalDeadlineOpen(bootstrap, `${operation} body read`, cleanup);
    try {
      const count = readSync(fd, bytes, bodyOffset, bytes.length - bodyOffset, null);
      if (count <= 0) fail(`${operation} channel closed before receipt body`);
      bodyOffset += count;
    } catch (error) {
      if (error?.code !== "EAGAIN" && error?.code !== "EWOULDBLOCK") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  try {
    const trailing = Buffer.alloc(1); const count = readSync(fd, trailing, 0, 1, null);
    if (count !== 0) fail("receipt frame has trailing or coalesced bytes");
  } catch (error) {
    if (error?.code !== "EAGAIN" && error?.code !== "EWOULDBLOCK") throw error;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const receipt = JSON.parse(text.slice(0, -1));
  if (!text.endsWith("\n") || !canonicalBytes(receipt).equals(bytes)) fail("receipt is not canonical");
  exactObject(receipt, ["schema", "operation", "sequence", "channelIdentitySha256", "requestSha256", "attemptId", "runId", "sessionId", "producer", "payload", "decision", "authority", "signatureHex"], "authenticatedReceipt");
  if (receipt.schema !== RECEIPT_SCHEMA || receipt.operation !== operation || receipt.sequence !== sequence || receipt.channelIdentitySha256 !== channelIdentitySha256 || receipt.requestSha256 !== sha256(requestBytes) || receipt.attemptId !== bootstrap.attemptId || receipt.runId !== bootstrap.runId || receipt.sessionId !== bootstrap.sessionId || receipt.producer !== producer || receipt.decision !== "HOLD" || receipt.authority !== "NONE" || typeof receipt.signatureHex !== "string" || !/^[0-9a-f]{128}$/u.test(receipt.signatureHex)) fail("authenticated receipt binding mismatch");
  verifyAuthenticatedReceiptSignature(receipt, bootstrap, fd);
  return receipt;
}

export function assertCompileOnlyInvocation() {
  if (process.argv.length !== 2) fail("the COMPILE-only executor accepts no caller arguments");
  if (process.argv[1] !== `/proc/self/fd/${FD.executorSource}` || JSON.stringify(process.execArgv) !== JSON.stringify(["--preserve-symlinks-main"]) || process.env.NODE_OPTIONS !== undefined || process.env.NODE_PATH !== undefined || process.env.LD_PRELOAD !== undefined || process.env.LD_AUDIT !== undefined) fail("compile executor startup flags/loaders are not the reviewed fixed entry");
  if (fileURLToPath(import.meta.url) !== `/proc/self/fd/${FD.executorSource}`) fail("executor must be loaded from its inherited same-handle source FD");
  const startup = verifyCompleteFdTable();
  const executorSourceSha256 = sha256(readAllAtFd(FD.executorSource, 8 * 1024 * 1024));
  const fd12Anchor = verifyFd12OwnerRootTrustAnchor();
  const trustAnchor = verifyFd11AnchorReceipt(fd12Anchor, executorSourceSha256);
  const subject = trustAnchor.subject;
  const runtimeBinding = loadRuntimeBindingAfterFd11BeforeFd3({
    verifiedAnchor: Object.freeze({
      fd12Verified: true,
      fd11Verified: true,
      fd3Read: false,
      attemptId: subject.attemptId,
      runId: subject.runId,
      sessionId: subject.sessionId,
      bootId: subject.bootId,
      anchorReceiptSha256: sha256(trustAnchor.fd11Snapshot.bytes),
      ownerRootDescriptorSha256: subject.ownerRootKeyAnchorDescriptorSha256,
      ownerRootPublicKeyHex: subject.ownerRootPublicKeyHex,
      watchdogPublicKeyHex: subject.watchdogPublicKeyHex,
      observerPublicKeyHex: subject.observerPublicKeyHex,
      custodianPublicKeyHex: subject.custodianPublicKeyHex,
      watchdogPrincipalSha256: subject.watchdogPrincipalSha256,
      observerPrincipalSha256: subject.observerPrincipalSha256,
      custodianPrincipalSha256: subject.custodianPrincipalSha256,
      deviceModel: subject.deviceModel,
      deviceFirmwareVersion: subject.deviceFirmwareVersion,
      deviceFirmwareIdentitySha256: subject.deviceFirmwareIdentitySha256,
      deviceDerivationPath: subject.deviceDerivationPath,
      deviceAccountPublicKeyHex: subject.deviceAccountPublicKeyHex,
      deviceAccountAddress: subject.deviceAccountAddress,
      deviceReceiptSha256: subject.deviceReceiptSha256,
      devicePhysicalConfirmationReceiptSha256: subject.physicalConfirmationReceiptSha256,
    }),
    monotonicNowNs: process.hrtime.bigint(),
  });
  return Object.freeze({
    bootstrapRecord: readCanonicalRecordFromFd(FD.bootstrap, 1024 * 1024, "compile bootstrap"),
    toolchainRecord: readCanonicalRecordFromFd(FD.toolchainManifest, 1024 * 1024, "toolchain manifest"),
    planRecord: readCanonicalRecordFromFd(FD.reviewedPlan, 4 * 1024 * 1024, "reviewed compile plan"),
    executorSourceSha256,
    trustAnchor,
    runtimeBinding,
    startup,
  });
}

export function loadAndValidateCompileBootstrap(invocation) {
  const bootstrap = invocation.bootstrapRecord.value;
  validateCompileBootstrapDocument(bootstrap);
  const subject = invocation.trustAnchor.subject;
  if (bootstrap.attemptId !== subject.attemptId || bootstrap.runId !== subject.runId || bootstrap.sessionId !== subject.sessionId ||
      bootstrap.peerSigningKeys.watchdog !== subject.watchdogPublicKeyHex ||
      bootstrap.peerSigningKeys.observer !== subject.observerPublicKeyHex ||
      bootstrap.peerSigningKeys.custodian !== subject.custodianPublicKeyHex) {
    fail("FD3 bootstrap lineage/peer keys are not byte-equal to the already verified FD11 anchor");
  }
  assertExternalDeadlineOpen(bootstrap, "compile bootstrap");
  return bootstrap;
}

export async function replayExternalToolchainSameHandles(invocation, bootstrap) {
  const manifest = invocation.toolchainRecord.value;
  validateToolchainManifestDocument(manifest);
  if (manifest.attemptId !== bootstrap.attemptId || manifest.runId !== bootstrap.runId || manifest.sessionId !== bootstrap.sessionId || bootstrap.toolchainManifestSha256 !== sha256(invocation.toolchainRecord.bytes) || manifest.launch.argvSha256 !== sha256(invocation.planRecord.bytes) || manifest.launch.environmentSha256 !== sha256(canonicalBytes(invocation.planRecord.value.environment))) fail("toolchain/plan/bootstrap transcript mismatch");
  const controllerManifest = assertPlan(invocation.planRecord.value, bootstrap, manifest);
  for (const [role, fd] of Object.entries(TOOL_FDS)) verifyFileIdentity(fd, manifest.tools[role], `toolchain.${role}`, true);
  const self = statSync("/proc/self/exe", { bigint: true });
  const staticNode = fstatSync(FD.staticNode, { bigint: true });
  if (self.dev !== staticNode.dev || self.ino !== staticNode.ino) fail("current static Node is not the pinned same object");
  const toolOFDManifestSha256=sha256(canonicalBytes(Object.entries(TOOL_FDS).map(([role,fd])=>({role,fd,expectedOpenFileDescriptionSha256:manifest.tools[role].openFileDescriptionSha256,observedFdInfoSha256:sha256(Buffer.from(readFileSync(`/proc/self/fdinfo/${fd}`,"utf8").replaceAll("\r",""),"utf8"))}))));
  const sourceFDManifestSha256=sha256(canonicalBytes(planSourceFdProjection(invocation.planRecord.value.sourceInputs)));
  const anchorSubject = invocation.trustAnchor.subject;
  const runtimeToolchain = invocation.runtimeBinding.receipt.toolchain;
  if (runtimeToolchain.manifestSha256 !== sha256(invocation.toolchainRecord.bytes) ||
      runtimeToolchain.toolOpenFileDescriptionManifestSha256 !== toolOFDManifestSha256 ||
      runtimeToolchain.sysrootManifestSha256 !== manifest.sysroot.manifestSha256 ||
      runtimeToolchain.staticNodeIdentitySha256 !== sha256(canonicalBytes(manifest.tools.staticNode))) {
    fail("observer-signed runtime toolchain projection mismatch");
  }
  verifyRuntimeDirectoryIdentity(FD.sysrootDirectory, runtimeToolchain.sysrootIdentity, "sysroot");
  verifyRuntimeDirectoryIdentity(FD.launchCwdDirectory, runtimeToolchain.cwdIdentity, "compile cwd");
  const peerChannelOfds = {
    watchdog: sha256(fdInfoBytes(FD.watchdog)),
    observer: sha256(fdInfoBytes(FD.observer)),
    custodian: sha256(fdInfoBytes(FD.custodian)),
  };
  if (anchorSubject.toolchainManifestSha256 !== sha256(invocation.toolchainRecord.bytes) ||
      anchorSubject.sourceFdManifestSha256 !== sourceFDManifestSha256 ||
      anchorSubject.toolOpenFileDescriptionManifestSha256 !== toolOFDManifestSha256 ||
      anchorSubject.staticNodeIdentitySha256 !== sha256(canonicalBytes(manifest.tools.staticNode)) ||
      anchorSubject.sysrootManifestSha256 !== manifest.sysroot.manifestSha256 ||
      anchorSubject.launchArgvSha256 !== sha256(invocation.planRecord.bytes) ||
      anchorSubject.launchEnvironmentSha256 !== sha256(canonicalBytes(invocation.planRecord.value.environment)) ||
      anchorSubject.launchCwdIdentitySha256 !== manifest.launch.cwdIdentitySha256 ||
      anchorSubject.startupClosureSha256 !== invocation.startup.startupClosureSha256 ||
      anchorSubject.watchdogChannelOfdSha256 !== peerChannelOfds.watchdog ||
      anchorSubject.observerChannelOfdSha256 !== peerChannelOfds.observer ||
      anchorSubject.custodianChannelOfdSha256 !== peerChannelOfds.custodian ||
      anchorSubject.operationTimerOfdSha256 !== sha256(fdInfoBytes(FD.teardownTimer)) ||
      anchorSubject.teardownTimerOfdSha256 !== sha256(fdInfoBytes(FD.cleanupTimer)) ||
      anchorSubject.operationDeadlineMonotonicNs !== bootstrap.deadline.absoluteNanoseconds ||
      anchorSubject.teardownDeadlineMonotonicNs !== bootstrap.teardownDeadline.absoluteNanoseconds) {
    fail("verified FD11 launch/source/toolchain/peer/timer projection differs before first peer RPC");
  }
  const prearm = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "VERIFY_COMPILE_PREARM", {
    sourceCommit: BPS09_BPK00_BINDING.commit,
    sourceTree: BPS09_BPK00_BINDING.tree,
    sourceManifestSha256: BPS09_BPK00_BINDING.fileSha256,
    bootstrapSha256: sha256(invocation.bootstrapRecord.bytes),
    toolchainManifestSha256: sha256(invocation.toolchainRecord.bytes),
    reviewedPlanSha256: sha256(invocation.planRecord.bytes),
    staticNodeSha256: manifest.tools.staticNode.sha256,
    executorSourceSha256: invocation.executorSourceSha256,
    startupClosureSha256: invocation.startup.startupClosureSha256,
    controllerSourceManifestSha256: controllerManifest.sha256,
    controllerSourceManifestByteLength: String(controllerManifest.byteLength),
    controllerSourcePathCount: String(controllerManifest.pathCount),
    controllerSourcePayloadByteLength: String(controllerManifest.payloadByteLength),
    controllerCheckpointReviewOutcome: BPK00_CHECKPOINT_OUTCOME,
  }, bootstrap);
  exactObject(prearm.payload, ["accepted", "startupClosureSha256", "sourceManifestSha256", "controllerSourceManifestSha256", "toolchainManifestSha256", "reviewedPlanSha256", "toolOFDManifestSha256", "sourceFDManifestSha256", "sandboxProfileSha256", "mountNamespaceSha256", "networkNamespaceSha256", "cgroupSha256", "controllerCheckpointReviewOutcome"], "compilePrearm.payload");
  for (const key of ["startupClosureSha256", "controllerSourceManifestSha256", "toolOFDManifestSha256", "sourceFDManifestSha256", "sandboxProfileSha256", "mountNamespaceSha256", "networkNamespaceSha256", "cgroupSha256"]) if (!validSha(prearm.payload[key])) fail(`compile prearm ${key} invalid`);
  if (prearm.payload.accepted !== true || prearm.payload.startupClosureSha256 !== invocation.startup.startupClosureSha256 || prearm.payload.sourceManifestSha256 !== BPS09_BPK00_BINDING.fileSha256 || prearm.payload.controllerSourceManifestSha256 !== controllerManifest.sha256 || prearm.payload.toolchainManifestSha256 !== sha256(invocation.toolchainRecord.bytes) || prearm.payload.reviewedPlanSha256 !== sha256(invocation.planRecord.bytes) || prearm.payload.toolOFDManifestSha256!==toolOFDManifestSha256||prearm.payload.sourceFDManifestSha256!==sourceFDManifestSha256||prearm.payload.controllerCheckpointReviewOutcome !== BPK00_CHECKPOINT_OUTCOME) fail("external compile prearm rejected");
  return Object.freeze({ manifest, plan: invocation.planRecord.value, prearm });
}

function observeAttemptRootParent(root) {
  const parentPath = dirname(root), childName = basename(root);
  if (childName === "." || childName === ".." || `${parentPath}/${childName}` !== root) fail("compile attempt root parent/name is not canonical");
  const fd = openSync(parentPath, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW | fsConstants.O_CLOEXEC);
  try {
    const stat = fstatSync(fd, { bigint: true });const resolved = readlinkSync(`/proc/self/fd/${fd}`);
    if (!stat.isDirectory() || resolved !== parentPath || stat.nlink < 2n) fail("compile attempt parent same-object replay failed");
    const identity = Object.freeze({ path: parentPath, dev: String(stat.dev), ino: String(stat.ino), mountId: fdMountId(fd), uid: String(stat.uid), gid: String(stat.gid), mode: Number(stat.mode & 0o7777n).toString(8).padStart(4, "0"), nlink: String(stat.nlink) });
    return Object.freeze({ fd, childName, anchoredRoot: `/proc/self/fd/${fd}/${childName}`, identity, sha256: sha256(canonicalBytes(identity)) });
  } catch (error) {
    try { closeSync(fd); } catch {}
    throw error;
  }
}

export async function reserveIndependentCompileAttempt(root, label, bootstrap, reservations) {
  const index = label === "A" ? 0 : label === "B" ? 1 : -1;
  if (index < 0 || root !== bootstrap.attemptRoots[index] || !Array.isArray(reservations)) fail("compile attempt label/root mismatch");
  assertExternalDeadlineOpen(bootstrap, `compile attempt ${label} reserve`);
  const parent = observeAttemptRootParent(root);
  const reservation = { root, label, fd: null, parentFd: parent.fd, dev: null, ino: null, mountId: null, admissionLockSha256: null, rootIdentitySha256: null, rootParentIdentitySha256: parent.sha256, state: "PARENT_OPEN" };
  reservations.push(reservation);
  try {
    const reserveReceipt = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "RESERVE_COMPILE_ATTEMPT_ROOT", { label, root, otherRoot: bootstrap.attemptRoots[1 - index], rootParentIdentity: parent.identity, rootParentIdentitySha256: parent.sha256 }, bootstrap);
    exactObject(reserveReceipt.payload, ["accepted", "admissionLockSha256", "rootParentIdentitySha256"], "attemptReserveReceipt.payload");
    if (reserveReceipt.payload.accepted !== true || !validSha(reserveReceipt.payload.admissionLockSha256) || reserveReceipt.payload.rootParentIdentitySha256 !== parent.sha256) fail("compile attempt admission lock rejected");
    reservation.admissionLockSha256=reserveReceipt.payload.admissionLockSha256;reservation.state="RESERVED";
    assertExternalDeadlineOpen(bootstrap, `compile attempt ${label} mkdir`);
    try { lstatSync(parent.anchoredRoot); fail("compile attempt root already exists"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    mkdirSync(parent.anchoredRoot, { mode: 0o700 });
    const fd = openSync(parent.anchoredRoot, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW | fsConstants.O_CLOEXEC);
    reservation.fd = fd;
    const stat = fstatSync(fd, { bigint: true });
    const resolved = readlinkSync(`/proc/self/fd/${fd}`);
    if (!stat.isDirectory() || (stat.mode & 0o7777n) !== 0o700n || stat.nlink !== 2n || resolved !== root || readdirSync(`/proc/self/fd/${fd}`).length !== 0) fail("private compile root identity mismatch");
    const rootIdentity = Object.freeze({ root, label, dev: String(stat.dev), ino: String(stat.ino), mountId: fdMountId(fd), uid: String(stat.uid), gid: String(stat.gid), mode: "0700", nlink: String(stat.nlink), admissionLockSha256: reserveReceipt.payload.admissionLockSha256 });
    Object.assign(reservation,{dev:String(stat.dev),ino:String(stat.ino),mountId:fdMountId(fd),rootIdentitySha256:sha256(canonicalBytes(rootIdentity)),state:"CREATED"});
    const bindReceipt = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "BIND_COMPILE_ATTEMPT_ROOT", { rootIdentity, rootIdentitySha256: sha256(canonicalBytes(rootIdentity)) }, bootstrap);
    exactObject(bindReceipt.payload, ["accepted", "admissionLockSha256", "rootIdentitySha256"], "attemptBindReceipt.payload");
    if (bindReceipt.payload.accepted !== true || bindReceipt.payload.admissionLockSha256 !== reserveReceipt.payload.admissionLockSha256 || bindReceipt.payload.rootIdentitySha256 !== sha256(canonicalBytes(rootIdentity))) fail("compile attempt root binding rejected");
    reservation.state="BOUND";return reservation;
  } finally {
    if (Number.isInteger(reservation.parentFd)) { try { closeSync(reservation.parentFd); } finally { reservation.parentFd = null; } }
  }
}

function childStdioPreservingCapabilities(toolFd, requiredSourceFd, attemptRootFd) {
  const preserved = [toolFd, attemptRootFd, ...(requiredSourceFd === null ? [] : [requiredSourceFd])];
  const stdio = Array.from({ length: Math.max(...preserved) + 1 }, () => "ignore");
  for (const fd of preserved) stdio[fd] = fd;
  return stdio;
}
async function runPinnedStage(stage, attemptRoot, environment, deadlineNs, bootstrap, requiredSourceFd, attemptRootFd) {
  const executable = `/proc/self/fd/${stage.toolFd}`;
  const argv = stage.argv.map((argument) => argument.replaceAll("{ATTEMPT_ROOT}", attemptRoot));
  assertExternalDeadlineOpen(bootstrap, `${stage.toolRole} prespawn`);
  const stageProjection = { toolRole: stage.toolRole, toolFd: stage.toolFd, requiredSourceFd, attemptRoot, attemptRootFd, argv, environment, deadlineNs: String(deadlineNs) };
  const prelaunch = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "AUTHORIZE_EXACT_COMPILE_STAGE", { stageProjection, stageProjectionSha256: sha256(canonicalBytes(stageProjection)) }, bootstrap);
  exactObject(prelaunch.payload, ["accepted", "stageTokenSha256", "stageProjectionSha256", "cgroupSha256", "mountNamespaceSha256", "networkNamespaceSha256", "maxProcesses", "decision", "authority"], "stagePrelaunch.payload");
  if (prelaunch.payload.accepted !== true || !validSha(prelaunch.payload.stageTokenSha256) || prelaunch.payload.stageProjectionSha256 !== sha256(canonicalBytes(stageProjection)) || !validSha(prelaunch.payload.cgroupSha256) || !validSha(prelaunch.payload.mountNamespaceSha256) || !validSha(prelaunch.payload.networkNamespaceSha256) || prelaunch.payload.maxProcesses !== "1" || prelaunch.payload.decision !== "HOLD" || prelaunch.payload.authority !== "NONE") fail("compile stage external prelaunch rejected");
  assertExternalDeadlineOpen(bootstrap, `${stage.toolRole} spawn`);
  const child = spawn(executable, argv, {
    cwd: attemptRoot,
    env: Object.freeze({ ...environment }),
    detached: false,
    windowsHide: true,
    shell: false,
    stdio: childStdioPreservingCapabilities(stage.toolFd, requiredSourceFd, attemptRootFd),
  });
  const remaining = deadlineNs - process.hrtime.bigint();
  if (remaining <= 0n) {
    child.kill("SIGKILL");
    const expired = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "TERMINATE_COMPILE_STAGE_AFTER_DEADLINE", { stageTokenSha256: prelaunch.payload.stageTokenSha256, pid: String(child.pid), stageProjectionSha256: sha256(canonicalBytes(stageProjection)) }, bootstrap, true);
    exactObject(expired.payload, ["terminal", "pid", "pidfdDev", "pidfdIno", "startTicks", "cgroupSha256", "descendantsZero", "processLedgerSha256", "decision", "authority"], "stageExpired.payload");
    if (expired.payload.terminal !== true || expired.payload.pid !== String(child.pid) || !/^(?:0|[1-9][0-9]*)$/u.test(expired.payload.pidfdDev) || !/^(?:0|[1-9][0-9]*)$/u.test(expired.payload.pidfdIno) || !/^(?:0|[1-9][0-9]*)$/u.test(expired.payload.startTicks) || expired.payload.cgroupSha256 !== prelaunch.payload.cgroupSha256 || expired.payload.descendantsZero !== true || !validSha(expired.payload.processLedgerSha256) || expired.payload.decision !== "HOLD" || expired.payload.authority !== "NONE") fail("expired compile stage did not reach external terminal zero");
    child.unref(); fail("compile deadline expired during spawn");
  }
  let stageCompleted = false;
  let timeout;
  const deadlineFailure = new Promise((resolve) => {
    const arm = () => {
      if (stageCompleted) return;
      const left = deadlineNs - process.hrtime.bigint();
      if (left <= 0n) { resolve({ deadlineExpired: true }); return; }
      const ceilingMilliseconds = (left + 999999n) / 1000000n;
      const delay = Number(ceilingMilliseconds > 2147483647n ? 2147483647n : ceilingMilliseconds);
      timeout = setTimeout(arm, Math.max(1, delay));
    };
    arm();
  });
  const childOutcome = new Promise((resolve) => {
    const onExit = (code, signal) => { stageCompleted = true; child.off("error", onError); resolve({ code, signal }); };
    const onError = (error) => { stageCompleted = true; child.off("exit", onExit); resolve({ error }); };
    child.once("exit", onExit); child.once("error", onError);
  });
  let result;
  try { result = await Promise.race([childOutcome, deadlineFailure]); }
  finally { stageCompleted = true; clearTimeout(timeout); }
  if (result.deadlineExpired === true) {
    child.kill("SIGKILL");
    const expired = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "TERMINATE_COMPILE_STAGE_AFTER_DEADLINE", { stageTokenSha256: prelaunch.payload.stageTokenSha256, pid: String(child.pid), stageProjectionSha256: sha256(canonicalBytes(stageProjection)) }, bootstrap, true);
    exactObject(expired.payload, ["terminal", "pid", "pidfdDev", "pidfdIno", "startTicks", "cgroupSha256", "descendantsZero", "processLedgerSha256", "decision", "authority"], "stageExpired.payload");
    if (expired.payload.terminal !== true || expired.payload.pid !== String(child.pid) || !/^(?:0|[1-9][0-9]*)$/u.test(expired.payload.pidfdDev) || !/^(?:0|[1-9][0-9]*)$/u.test(expired.payload.pidfdIno) || !/^(?:0|[1-9][0-9]*)$/u.test(expired.payload.startTicks) || expired.payload.cgroupSha256 !== prelaunch.payload.cgroupSha256 || expired.payload.descendantsZero !== true || !validSha(expired.payload.processLedgerSha256) || expired.payload.decision !== "HOLD" || expired.payload.authority !== "NONE") fail("expired compile stage did not reach external terminal zero");
    child.unref(); fail("compile stage exceeded its absolute deadline");
  }
  if (result.error !== undefined) throw result.error;
  const terminal = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "VERIFY_COMPILE_STAGE_TERMINAL", { stageTokenSha256: prelaunch.payload.stageTokenSha256, pid: String(child.pid), code: result.code === null ? null : String(result.code), signal: result.signal, stageProjectionSha256: sha256(canonicalBytes(stageProjection)) }, bootstrap);
  exactObject(terminal.payload, ["terminal", "exitCode", "signal", "pid", "pidfdDev", "pidfdIno", "startTicks", "cgroupSha256", "descendantsZero", "processLedgerSha256", "decision", "authority"], "stageTerminal.payload");
  if (result.code !== 0 || result.signal !== null || terminal.payload.terminal !== true || terminal.payload.exitCode !== "0" || terminal.payload.signal !== null || terminal.payload.pid !== String(child.pid) || !/^(?:0|[1-9][0-9]*)$/u.test(terminal.payload.pidfdDev) || !/^(?:0|[1-9][0-9]*)$/u.test(terminal.payload.pidfdIno) || !/^(?:0|[1-9][0-9]*)$/u.test(terminal.payload.startTicks) || terminal.payload.cgroupSha256 !== prelaunch.payload.cgroupSha256 || terminal.payload.descendantsZero !== true || !validSha(terminal.payload.processLedgerSha256) || terminal.payload.decision !== "HOLD" || terminal.payload.authority !== "NONE") fail("pinned tool stage terminal proof rejected");
}

async function observeOutputSameHandle(fd, path, artifact, reservation, bootstrap) {
  const before = fstatSync(fd, { bigint: true });
  const bytes = readAllAtFd(fd);
  const after = fstatSync(fd, { bigint: true });
  if (!before.isFile() || before.nlink !== 1n || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || BigInt(bytes.byteLength) !== after.size) fail("compile output changed during same-handle observation");
  const identityBase = { path, sha256: sha256(bytes), byteLength: String(bytes.byteLength), mode: Number(before.mode & 0o7777n).toString(8).padStart(4, "0"), uid: String(before.uid), gid: String(before.gid), dev: String(before.dev), ino: String(before.ino), mountId: fdMountId(fd), nlink: String(before.nlink) };
  const handleProjection = { domain: "IAT_B3_BPS09_FILE_HANDLE_V1", path: identityBase.path, dev: identityBase.dev, ino: identityBase.ino, mountId: identityBase.mountId, mode: identityBase.mode, uid: identityBase.uid, gid: identityBase.gid, nlink: identityBase.nlink, byteLength: identityBase.byteLength, sha256: identityBase.sha256 };
  const expectedIdentity = Object.freeze({ ...identityBase, handleSha256: sha256(canonicalBytes(handleProjection)), openFileDescriptionSha256: sha256(Buffer.from(readFileSync(`/proc/self/fdinfo/${fd}`, "utf8").replaceAll("\r", ""), "utf8")), sameHandleReplayRequired: true });
  validateFileIdentityDocument(expectedIdentity, "observedCompileOutput");
  const receipt = await exchangeAuthenticatedReceipt(FD.observer, "COMPILE_OUTPUT_OBSERVER", "OBSERVE_COMPILE_OUTPUT", { artifact, fileIdentity: expectedIdentity, fileIdentitySha256: sha256(canonicalBytes(expectedIdentity)), attemptRootDev: reservation.dev, attemptRootIno: reservation.ino, attemptRootMountId: reservation.mountId }, bootstrap);
  exactObject(receipt.payload, ["fileIdentity", "objectMapSha256", "linkMapSha256", "diagnosticsSha256"], "outputReceipt.payload");
  validateFileIdentityDocument(receipt.payload.fileIdentity, "outputReceipt.fileIdentity");
  if (!canonicalBytes(receipt.payload.fileIdentity).equals(canonicalBytes(expectedIdentity)) || !validSha(receipt.payload.objectMapSha256) || !validSha(receipt.payload.linkMapSha256) || !validSha(receipt.payload.diagnosticsSha256)) fail("output observer receipt mismatch");
  return receipt.payload;
}

export async function runCompileAttempt(reservation, toolchain, bootstrap) {
  const outputs = [];
  for (const artifactPlan of toolchain.plan.artifactPlans) {
    const compile = { ...artifactPlan.compile, cwd: reservation.root };
    const link = { ...artifactPlan.link, cwd: reservation.root };
    const requiredSourceFd = artifactPlan.artifact === SUPERVISOR_ARTIFACT ? BPC01_SOURCE_ROWS.find((row) => row.path.endsWith("iat_b3_post_checkpoint_prelaunch_supervisor_package_bound.c")).fd : CONTROLLER_INSTALL_SOURCE_FD;
    await runPinnedStage(compile, reservation.root, toolchain.plan.environment, BigInt(toolchain.plan.limits.absoluteDeadlineNanoseconds), bootstrap, requiredSourceFd, reservation.fd);
    await runPinnedStage(link, reservation.root, toolchain.plan.environment, BigInt(toolchain.plan.limits.absoluteDeadlineNanoseconds), bootstrap, null, reservation.fd);
    assertExternalDeadlineOpen(bootstrap, `${artifactPlan.artifact} output open`);
    const outputPath = `${reservation.root}/${artifactPlan.outputName}`;
    const outputFd = openSync(`/proc/self/fd/${reservation.fd}/${artifactPlan.outputName}`, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_CLOEXEC);
    try {
      const observed = await observeOutputSameHandle(outputFd, outputPath, artifactPlan.artifact, reservation, bootstrap);
      if (BigInt(observed.fileIdentity.byteLength) > BigInt(toolchain.plan.limits.maxArtifactBytes)) fail("compile artifact exceeds reviewed byte limit");
      outputs.push(Object.freeze({ artifact: artifactPlan.artifact, ...observed }));
    }
    finally { closeSync(outputFd); }
  }
  return Object.freeze({ reservation, outputs });
}

export function compareIndependentArtifactSet(attemptA, attemptB) {
  if (attemptA.outputs.length !== 2 || attemptB.outputs.length !== 2 || attemptA.reservation.root === attemptB.reservation.root) fail("two isolated two-artifact attempts required");
  for (let index = 0; index < 2; index += 1) {
    const left = attemptA.outputs[index], right = attemptB.outputs[index];
    if (left.artifact !== right.artifact || !equalHex(left.fileIdentity.sha256, right.fileIdentity.sha256) || left.fileIdentity.byteLength !== right.fileIdentity.byteLength || !equalHex(left.objectMapSha256, right.objectMapSha256) || !equalHex(left.linkMapSha256, right.linkMapSha256) || !equalHex(left.diagnosticsSha256, right.diagnosticsSha256)) fail("independent compile artifacts differ");
  }
  return Object.freeze({ attemptA, attemptB, outputsMustBeByteEqual });
}

function validateZeroProof(value) {
  exactObject(value, ["fdLedgerSha256", "processLedgerSha256", "mountLedgerSha256", "entryLedgerSha256", "cacheLedgerSha256", "allZero"], "compileZeroProof");
  for (const key of ["fdLedgerSha256", "processLedgerSha256", "mountLedgerSha256", "entryLedgerSha256", "cacheLedgerSha256"]) if (!validSha(value[key])) fail(`invalid zero proof ${key}`);
  if (value.allZero !== true) fail("compile residue is not zero");
}
export async function verifyCompileZeroResidue(comparison, bootstrap, terminalState) {
  if(terminalState===null||typeof terminalState!=="object")fail("compile terminal state journal required");
  const observedA = artifactSet(comparison.attemptA), observedB = artifactSet(comparison.attemptB);
  const custodyReceipt = await exchangeAuthenticatedReceipt(FD.custodian, "COMPILE_EVIDENCE_CUSTODIAN", "TAKE_COMPILE_ARTIFACT_CUSTODY_HOLD", { attemptA: observedA, attemptB: observedB, roots: [comparison.attemptA.reservation, comparison.attemptB.reservation].map(({ root, label, dev, ino, mountId, admissionLockSha256, rootIdentitySha256 }) => ({ root, label, dev, ino, mountId, admissionLockSha256, rootIdentitySha256 })) }, bootstrap);
  exactObject(custodyReceipt.payload, ["accepted", "durable", "attemptA", "attemptB", "retainedArtifactSetSha256", "sourceRootsRemoved", "decision", "authority"], "compileCustody.payload");
  validateArtifactSetDocument(custodyReceipt.payload.attemptA, "compileCustody.attemptA"); validateArtifactSetDocument(custodyReceipt.payload.attemptB, "compileCustody.attemptB");
  const custodyProjection = { attemptA: custodyReceipt.payload.attemptA, attemptB: custodyReceipt.payload.attemptB };
  if (custodyReceipt.payload.accepted !== true || custodyReceipt.payload.durable !== true || custodyReceipt.payload.sourceRootsRemoved !== true || custodyReceipt.payload.decision !== "HOLD" || custodyReceipt.payload.authority !== "NONE" || custodyReceipt.payload.retainedArtifactSetSha256 !== sha256(canonicalBytes(custodyProjection))) fail("compile artifact custody rejected");
  for (const [observed, retained] of [[observedA, custodyReceipt.payload.attemptA], [observedB, custodyReceipt.payload.attemptB]]) {
    for (const role of ["target", "installer"]) if (observed[role].sha256 !== retained[role].sha256 || observed[role].byteLength !== retained[role].byteLength) fail("compile custody changed artifact bytes");
    for (const key of ["objectMapSha256", "linkMapSha256", "diagnosticsSha256"]) if (observed[key] !== retained[key]) fail("compile custody changed build ledgers");
  }
  Object.assign(terminalState,{custodyReceipt,attemptA:custodyReceipt.payload.attemptA,attemptB:custodyReceipt.payload.attemptB,retainedArtifactSetSha256:custodyReceipt.payload.retainedArtifactSetSha256});
  closeSync(comparison.attemptA.reservation.fd);
  closeSync(comparison.attemptB.reservation.fd);
  comparison.attemptA.reservation.fd=null;comparison.attemptB.reservation.fd=null;
  for (const root of bootstrap.attemptRoots) {
    try { lstatSync(root); fail("compile attempt root survived custody"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  const receipt = await exchangeAuthenticatedReceipt(FD.observer, "COMPILE_ZERO_OBSERVER", "VERIFY_COMPILE_ZERO_RESIDUE", { attemptRoots: bootstrap.attemptRoots, admissionLocks: [comparison.attemptA.reservation.admissionLockSha256, comparison.attemptB.reservation.admissionLockSha256], custodyReceiptSha256: sha256(canonicalBytes(custodyReceipt)), retainedArtifactSetSha256: custodyReceipt.payload.retainedArtifactSetSha256 }, bootstrap);
  validateZeroProof(receipt.payload);
  terminalState.zeroReceipt=receipt;
  const release = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "RELEASE_COMPILE_ATTEMPT_ROOT_LOCKS_AFTER_ZERO", { admissionLocks: [comparison.attemptA.reservation.admissionLockSha256, comparison.attemptB.reservation.admissionLockSha256], zeroReceiptSha256: sha256(canonicalBytes(receipt)), custodyReceiptSha256: sha256(canonicalBytes(custodyReceipt)) }, bootstrap);
  exactObject(release.payload, ["released", "allLocksReleased", "decision", "authority"], "compileLockRelease.payload");
  if (release.payload.released !== true || release.payload.allLocksReleased !== true || release.payload.decision !== "HOLD" || release.payload.authority !== "NONE") fail("compile admission locks were not released after zero");
  terminalState.releaseReceipt=release;
  return Object.freeze({ zeroProof: receipt.payload, attemptA: custodyReceipt.payload.attemptA, attemptB: custodyReceipt.payload.attemptB, custodyReceiptSha256: sha256(canonicalBytes(custodyReceipt)), zeroReceiptSha256: sha256(canonicalBytes(receipt)), releaseReceiptSha256: sha256(canonicalBytes(release)) });
}

function digestSet(outputs, key) { return sha256(Buffer.from(outputs.map((output) => output[key]).join("\0"), "utf8")); }
function artifactSet(attempt) {
  const target = attempt.outputs.find((output) => output.artifact === SUPERVISOR_ARTIFACT);
  const installer = attempt.outputs.find((output) => output.artifact === INSTALL_CONTROLLER_ARTIFACT);
  if (target === undefined || installer === undefined) fail("compile attempt lacks a required artifact");
  return { target: target.fileIdentity, installer: installer.fileIdentity, objectMapSha256: digestSet(attempt.outputs, "objectMapSha256"), linkMapSha256: digestSet(attempt.outputs, "linkMapSha256"), diagnosticsSha256: digestSet(attempt.outputs, "diagnosticsSha256") };
}
export async function persistCompileEvidenceHold(comparison, terminalZero, bootstrap, invocation) {
  const evidence = { schema: BPS09_SCHEMA_ID, kind: "COMPILE_EVIDENCE", attemptId: bootstrap.attemptId, runId: bootstrap.runId, sessionId: bootstrap.sessionId, bootstrapSha256: sha256(invocation.bootstrapRecord.bytes), attemptA: terminalZero.attemptA, attemptB: terminalZero.attemptB, artifactsByteEqual: true, zeroProof: terminalZero.zeroProof, independentReviewReceipt: null, installed: false, launched: false, decision: "HOLD", authority: "NONE" };
  validateCompileEvidenceDocument(evidence);
  const receipt = await exchangeAuthenticatedReceipt(FD.custodian, "COMPILE_EVIDENCE_CUSTODIAN", "PERSIST_COMPILE_EVIDENCE_HOLD", { evidence, evidenceSha256: sha256(canonicalBytes(evidence)), custodyReceiptSha256: terminalZero.custodyReceiptSha256, zeroReceiptSha256: terminalZero.zeroReceiptSha256, releaseReceiptSha256: terminalZero.releaseReceiptSha256 }, bootstrap);
  if (receipt.payload.evidenceSha256 !== sha256(canonicalBytes(evidence)) || receipt.payload.durable !== true || receipt.payload.decision !== "HOLD" || receipt.payload.authority !== "NONE") fail("durable compile evidence receipt mismatch");
  return receipt;
}

async function convergeCompileFailureHold(error, bootstrap, invocation, reservations, terminalState) {
  const failure = { name: typeof error?.name === "string" ? error.name : "Error", messageSha256: sha256(Buffer.from(String(error?.message ?? "compile failure"), "utf8")), phase: terminalState.custodyReceipt!==null?"POST_CUSTODY":reservations.length === 0 ? "PRE_RESERVATION" : reservations.length === 1 ? "ATTEMPT_A_ACTIVE" : "ATTEMPT_B_ACTIVE", roots: reservations.map(({ root, label, dev, ino, mountId, admissionLockSha256, rootIdentitySha256,rootParentIdentitySha256,state }) => ({ root, label, dev, ino, mountId, admissionLockSha256, rootIdentitySha256,rootParentIdentitySha256,state })), bootstrapSha256: sha256(invocation.bootstrapRecord.bytes) };
  for(const reservation of reservations){for(const key of ["fd","parentFd"]){if(Number.isInteger(reservation[key])){try{closeSync(reservation[key]);}catch{}reservation[key]=null;}}}
  if (terminalState.custodyReceipt !== null) {
    for(const root of bootstrap.attemptRoots){try{lstatSync(root);fail("post-custody compile root survived");}catch(pathError){if(pathError?.code!=="ENOENT")throw pathError;}}
    if(terminalState.zeroReceipt===null){terminalState.zeroReceipt=await exchangeAuthenticatedReceipt(FD.observer,"COMPILE_ZERO_OBSERVER","VERIFY_POST_CUSTODY_COMPILE_FAILURE_ZERO",{attemptRoots:bootstrap.attemptRoots,custodyReceiptSha256:sha256(canonicalBytes(terminalState.custodyReceipt)),retainedArtifactSetSha256:terminalState.retainedArtifactSetSha256},bootstrap,true);validateZeroProof(terminalState.zeroReceipt.payload);}
    if(terminalState.releaseReceipt===null){terminalState.releaseReceipt=await exchangeAuthenticatedReceipt(FD.watchdog,"COMPILE_PREARM_WATCHDOG","RELEASE_COMPILE_ATTEMPT_ROOT_LOCKS_AFTER_FAILURE_ZERO",{admissionLocks:reservations.map(({admissionLockSha256})=>admissionLockSha256).filter(validSha),zeroReceiptSha256:sha256(canonicalBytes(terminalState.zeroReceipt)),custodyReceiptSha256:sha256(canonicalBytes(terminalState.custodyReceipt))},bootstrap,true);exactObject(terminalState.releaseReceipt.payload,["released","allLocksReleased","decision","authority"],"postCustodyFailureRelease.payload");if(terminalState.releaseReceipt.payload.released!==true||terminalState.releaseReceipt.payload.allLocksReleased!==true||terminalState.releaseReceipt.payload.decision!=="HOLD"||terminalState.releaseReceipt.payload.authority!=="NONE")fail("post-custody failure locks not released");}
    const durableAfterCustody = await exchangeAuthenticatedReceipt(FD.custodian, "COMPILE_EVIDENCE_CUSTODIAN", "PERSIST_POST_CUSTODY_COMPILE_FAILURE_HOLD", { failure: { ...failure, phase: "POST_CUSTODY_ZERO" }, custodyReceiptSha256: sha256(canonicalBytes(terminalState.custodyReceipt)), zeroReceiptSha256: sha256(canonicalBytes(terminalState.zeroReceipt)), releaseReceiptSha256: sha256(canonicalBytes(terminalState.releaseReceipt)) }, bootstrap,true);
    exactObject(durableAfterCustody.payload, ["durable", "failureEvidenceSha256", "decision", "authority"], "postCustodyFailureEvidence.payload");
    if (durableAfterCustody.payload.durable !== true || !validSha(durableAfterCustody.payload.failureEvidenceSha256) || durableAfterCustody.payload.decision !== "HOLD" || durableAfterCustody.payload.authority !== "NONE") fail("post-custody failure HOLD evidence was not durable");
    return durableAfterCustody;
  }
  const abort = await exchangeAuthenticatedReceipt(FD.watchdog, "COMPILE_PREARM_WATCHDOG", "ABORT_COMPILE_TO_TERMINAL_HOLD", failure, bootstrap,true);
  exactObject(abort.payload, ["aborted", "descendantsTerminal", "admissionLocksHeldForCleanup", "abortReceiptSha256", "decision", "authority"], "compileAbort.payload");
  if (abort.payload.aborted !== true || abort.payload.descendantsTerminal !== true || abort.payload.admissionLocksHeldForCleanup !== true || !validSha(abort.payload.abortReceiptSha256) || abort.payload.decision !== "HOLD" || abort.payload.authority !== "NONE") fail("compile abort was not authenticated");
  const removal=await exchangeAuthenticatedReceipt(FD.custodian,"COMPILE_EVIDENCE_CUSTODIAN","REMOVE_COMPILE_ROOTS_BY_IDENTITY_AFTER_ABORT",{roots:failure.roots,abortReceiptSha256:abort.payload.abortReceiptSha256},bootstrap,true);
  exactObject(removal.payload,["removed","allAttemptRootsAbsent","identityLedgerSha256","decision","authority"],"compileFailureRemoval.payload");if(removal.payload.removed!==true||removal.payload.allAttemptRootsAbsent!==true||!validSha(removal.payload.identityLedgerSha256)||removal.payload.decision!=="HOLD"||removal.payload.authority!=="NONE")fail("compile failure custodian removal rejected");
  for (const root of bootstrap.attemptRoots) {try { lstatSync(root); fail("compile failure left an attempt root"); } catch (pathError) { if (pathError?.code !== "ENOENT") throw pathError; }}
  const zeroReceipt = await exchangeAuthenticatedReceipt(FD.observer, "COMPILE_ZERO_OBSERVER", "VERIFY_COMPILE_FAILURE_ZERO", { roots: failure.roots, abortReceiptSha256: abort.payload.abortReceiptSha256,removalReceiptSha256:sha256(canonicalBytes(removal)) }, bootstrap,true);
  validateZeroProof(zeroReceipt.payload);
  const release=await exchangeAuthenticatedReceipt(FD.watchdog,"COMPILE_PREARM_WATCHDOG","RELEASE_COMPILE_ATTEMPT_ROOT_LOCKS_AFTER_FAILURE_ZERO",{admissionLocks:reservations.map(({admissionLockSha256})=>admissionLockSha256).filter(validSha),zeroReceiptSha256:sha256(canonicalBytes(zeroReceipt)),removalReceiptSha256:sha256(canonicalBytes(removal))},bootstrap,true);exactObject(release.payload,["released","allLocksReleased","decision","authority"],"compileFailureRelease.payload");if(release.payload.released!==true||release.payload.allLocksReleased!==true||release.payload.decision!=="HOLD"||release.payload.authority!=="NONE")fail("compile failure locks not released");
  const durable = await exchangeAuthenticatedReceipt(FD.custodian, "COMPILE_EVIDENCE_CUSTODIAN", "PERSIST_COMPILE_FAILURE_HOLD", { failure, abortReceiptSha256: abort.payload.abortReceiptSha256,removalReceiptSha256:sha256(canonicalBytes(removal)), zeroReceiptSha256: sha256(canonicalBytes(zeroReceipt)),releaseReceiptSha256:sha256(canonicalBytes(release)) }, bootstrap,true);
  exactObject(durable.payload, ["durable", "failureEvidenceSha256", "decision", "authority"], "compileFailureEvidence.payload");
  if (durable.payload.durable !== true || !validSha(durable.payload.failureEvidenceSha256) || durable.payload.decision !== "HOLD" || durable.payload.authority !== "NONE") fail("compile failure HOLD evidence was not durable");
  return durable;
}

export async function runCompileExecutor() {
  const invocation = assertCompileOnlyInvocation();
  const bootstrap = loadAndValidateCompileBootstrap(invocation);
  const reservations = [];
  const terminalState={custodyReceipt:null,zeroReceipt:null,releaseReceipt:null,attemptA:null,attemptB:null,retainedArtifactSetSha256:null};
  try {
    const toolchain = await replayExternalToolchainSameHandles(invocation, bootstrap);
    const attemptA = await reserveIndependentCompileAttempt(bootstrap.attemptRoots[0], "A", bootstrap,reservations);
    const resultA = await runCompileAttempt(attemptA, toolchain, bootstrap);
    const attemptB = await reserveIndependentCompileAttempt(bootstrap.attemptRoots[1], "B", bootstrap,reservations);
    const resultB = await runCompileAttempt(attemptB, toolchain, bootstrap);
    const comparison = compareIndependentArtifactSet(resultA, resultB);
    const terminalZero = await verifyCompileZeroResidue(comparison, bootstrap,terminalState);
    return await persistCompileEvidenceHold(comparison, terminalZero, bootstrap, invocation);
  } catch (error) {
    await convergeCompileFailureHold(error, bootstrap, invocation, reservations, terminalState);
    throw error;
  }
}

const fixedFdEntry = process.argv[1] === `/proc/self/fd/${FD.executorSource}`;
const invokedByMutablePath = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (fixedFdEntry) {
  try {
    const terminal = await runCompileExecutor();
    if (terminal?.payload?.decision !== "HOLD" || terminal?.payload?.authority !== "NONE") fail("compile terminal truth promotion rejected");
  } catch {
    process.exitCode = 90;
  }
} else if (invokedByMutablePath) {
  process.exitCode = 90;
}

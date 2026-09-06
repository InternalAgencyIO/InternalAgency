import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { types } from "node:util";
import {
  BPS08A_COMPILE_FD_MAP,
  BPS08A_NATIVE_FD_MAP,
  BPS08A_SCHEMA_ID,
  BPS08A_SOURCE_STATE,
} from "./iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-runtime-binding-amendment-contract.mjs";

export const BPS09_SCHEMA_ID = "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored/v1";
export const BPS09_STATUS = "HOLD_SOURCE_ONLY";

export const BPS09_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored.v1.schema.json",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-contract.mjs",
  "projects/star-ascent/site/scripts/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-executor-fd12-trust-anchored.mjs",
  "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-install-controller-fd12-trust-anchored/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound_checkpoint_install_controller_fd12_trust_anchored.c",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-source.test.mjs",
]);

export const BPS09_RUNTIME_BINDING = Object.freeze({
  schema: BPS08A_SCHEMA_ID,
  compileFdMap: BPS08A_COMPILE_FD_MAP,
  nativeFdMap: BPS08A_NATIVE_FD_MAP,
  verificationPosition: "AFTER_FD11_BEFORE_FD3",
  externalDurableOneUseCasRequired: true,
  watchdogObserverCustodianQuorumRequired: true,
  independentDeviceAndToolchainObservationRequired: true,
  identityAtomicRecoveryRequired: true,
  sourceState: BPS08A_SOURCE_STATE,
});

export const BPS09_BPS06_BINDING = Object.freeze({
  sha256: "9f36884b53aa4646739b24e9829c69abd9a964a2ebc01934bc9217f78faafd7c",
  byteLength: 682,
  pathCount: 3,
  payloadByteLength: 345346,
  reviewOutcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_CHECKPOINT_COMPILE_INSTALL_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
});

export const BPS09_BPC03_BINDING = Object.freeze({
  taskId: "BPC03R",
  commit: "85d72e43869d3de7bab0e27005ba1cb95354c12a",
  tree: "6d4418655aa67d6516d18cff9a78c796f599f11b",
  manifestSha256: "caf0fd1ae601e337e86445497576339400605a817ba769d038605e7cb14c7d9a",
  reviewOutcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_COMPILE_PEER_TRUST_ANCHOR_SOURCE_CHECKPOINT_REVIEW_ACCEPTED",
});

export const BPS09_BPK00_BINDING = Object.freeze({
  taskId: "BPK00",
  commit: "512b347ebf4de80bf5a50e0d8491f14eeef0f9f0",
  tree: "c4e8e6ca1c54e9154743dd2fea7b434307d74676",
  path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-owner-root-public-key-anchor.v1.json",
  blobSha1: "8e38e773ed4f11a4aefd8787c63c535775056c1a",
  fileSha256: "7865d0fb44465fbce2100af78d2392b3bc29a2f4a7ff2969b501bc2a0134bb21",
  byteLength: 1001,
  schema: "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-owner-root-public-key-anchor/v1",
  producer: "BPK00",
  outcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_FD12_OWNER_ROOT_PUBLIC_KEY_ANCHOR_CHECKPOINT_COMMITTED",
  bps08ManifestSha256: "9e9679a7e5da6ee9b80b7774e219b91d4ca3c914a2b2fcd2459770a9e0a524ce",
  rootPublicKeyHex: "60fa8f2c48a8bc6d2ad476b094bb2f569f020211bf834deb144d2e2958ac4230",
  rootFingerprintSha256: "49e4e1637075a367448705ea703628f045cde70c489286b84d1db8f5697557f1",
  ownerProvisioningReceiptSha256: "3e1aa94f5203e882155d953e77f1036bb418929b5d6ddc5fe80070a4a0898f3a",
  decision: "HOLD",
  authority: "NONE",
});

export const BPS09_DOCUMENT_KINDS = Object.freeze([
  "TOOLCHAIN_MANIFEST",
  "COMPILE_BOOTSTRAP",
  "COMPILE_EVIDENCE",
  "INSTALL_BOOTSTRAP",
  "INSTALL_EVIDENCE",
  "RECOVERY_BOOTSTRAP",
  "RECOVERY_EVIDENCE",
]);

export const BPS09_CAPABILITY_MATRIX = Object.freeze({
  compileExecutor: Object.freeze({
    domain: "COMPILE_ONLY",
    compile: true,
    spawnToolchain: true,
    install: false,
    recover: false,
    publish: false,
    launch: false,
    network: false,
  }),
  nativeController: Object.freeze({
    domain: "INSTALL_OR_RECOVER_ONLY",
    compile: false,
    spawnToolchain: false,
    install: true,
    recover: true,
    publish: true,
    launch: false,
    network: false,
  }),
});

export const BPS09_VERIFICATION_ORDER = Object.freeze([
  "REPLAY_FD12_OWNER_ROOT_KEY_ANCHOR_SEALED_SAME_HANDLE_IDENTITY",
  "VERIFY_FD12_AGAINST_BPK00_CORRECTED_COMMIT_TREE_BLOB_AND_FILE_SHA256",
  "PARSE_FD12_EXACT_RAW32_OWNER_ROOT_PUBLIC_KEY_AND_PROVISIONING_IDENTITY",
  "REPLAY_FD11_SEALED_MEMFD_SAME_HANDLE_IDENTITY",
  "PARSE_EXACT_CANONICAL_ANCHOR_RECEIPT",
  "VERIFY_FD11_OWNER_ROOT_AND_FD12_IDENTITY_BINDINGS_BYTE_EQUAL",
  "VERIFY_T2T1_FIRMWARE_2_12_4_OR_LATER_WITH_EXACT_OCMS_V1_CAPABILITY_RECEIPT",
  "REJECT_OCMS_V0_DOWNGRADE_AND_UNOBSERVED_FIRMWARE_CAPABILITY",
  "RECOMPUTE_EXACT_DOMAIN_NUL_CANONICAL_JSON_LF_SUBJECT_SHA256",
  "REBUILD_EXACT_OCMS_V1_MESSAGE_BYTES",
  "VERIFY_FIRMWARE_RETURNED_SIGNED_DATA_BYTE_EQUAL_REBUILT_OCMS_V1_BYTES",
  "VERIFY_OCMS_SIGNER_LIST_CAUSALLY_SELECTS_THE_PINNED_OWNER_ROOT",
  "VERIFY_STRICT_CANONICAL_ED25519_WITH_SEPARATELY_PINNED_ROOT_PUBLIC_KEY",
  "VERIFY_T2T1_DERIVATION_ACCOUNT_AND_PHYSICAL_CONFIRMATION_RECEIPT",
  "VERIFY_BOOT_NONCE_ONE_USE_CAS_AND_MONOTONIC_EXPIRY",
  "BIND_LINEAGE_ATTEMPT_RUN_SESSION_EXECUTOR_SOURCE_TOOLCHAIN_LAUNCH_STARTUP_PEERS_AND_TIMERS",
  "REJECT_KEY_PRINCIPAL_CHANNEL_OR_TIMER_ALIASING",
  "READ_FD17_CANONICAL_RUNTIME_BINDING_RECEIPT_WITHOUT_READING_FD3",
  "VERIFY_FD17_WATCHDOG_OBSERVER_CUSTODIAN_SIGNATURES_AND_SIGNED_FD28_PROVIDER_HASH",
  "EXECUTE_PINNED_FD28_LIVE_KERNEL_PREFLIGHT_WITHOUT_FD3_OR_PEER_RPC",
  "CONSUME_FD16_EXTERNAL_DURABLE_ONE_USE_CAS_AND_VERIFY_FD27_DESCRIPTOR",
  "BIND_OBSERVER_DEVICE_TOOLCHAIN_AND_CUSTODIAN_PROTECTED_RECOVERY_EVIDENCE",
  "READ_AND_VALIDATE_FD3_COMPILE_BOOTSTRAP",
  "REQUIRE_FD3_PEER_KEYS_BYTE_EQUAL_ANCHOR_KEYS",
  "ALLOW_FIRST_PEER_RPC",
]);

const HEX40 = /^[0-9a-f]{40}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const U64 = /^(0|[1-9][0-9]*)$/u;
const ABS = /^\/(?!\/)(?:[^\0\r\n/]+\/)*[^\0\r\n/]+$/u;
const ZERO_SHA256 = "0".repeat(64);

const KIND_KEYS = Object.freeze({
  TOOLCHAIN_MANIFEST: ["schema", "kind", "attemptId", "runId", "sessionId", "sourceCommit", "sourceTree", "tools", "sysroot", "launch", "decision", "authority"],
  COMPILE_BOOTSTRAP: ["schema", "kind", "attemptId", "runId", "sessionId", "sourceCommit", "sourceTree", "lineage", "fd12TrustAnchor", "verificationOrder", "toolchainManifestSha256", "attemptRoots", "outputNames", "deadline", "capabilityDomain", "installOrRecoverFields", "decision", "authority"],
  COMPILE_EVIDENCE: ["schema", "kind", "attemptId", "runId", "sessionId", "bootstrapSha256", "attemptA", "attemptB", "artifactsByteEqual", "zeroProof", "independentReviewReceipt", "installed", "launched", "decision", "authority"],
  INSTALL_BOOTSTRAP: ["schema", "kind", "attemptId", "runId", "sessionId", "compileReviewReceipt", "targetArtifact", "installerArtifact", "destinationParent", "tempName", "finalName", "deadline", "capabilityDomain", "toolchainFields", "decision", "authority"],
  INSTALL_EVIDENCE: ["schema", "kind", "attemptId", "runId", "sessionId", "bootstrapSha256", "sourceArtifact", "installerSelf", "finalArtifact", "publicationReceipt", "custodyReceipt", "zeroProof", "launched", "decision", "authority"],
  RECOVERY_BOOTSTRAP: ["schema", "kind", "attemptId", "runId", "sessionId", "actualPriorReceipt", "acceptedProducerTypes", "acceptedProducerSetSha256", "identityLedger", "tempName", "finalName", "deadline", "capabilityDomain", "toolchainFields", "decision", "authority"],
  RECOVERY_EVIDENCE: ["schema", "kind", "attemptId", "runId", "sessionId", "bootstrapSha256", "abortCasReceipt", "cleanupReceipt", "parentFsyncReceipt", "zeroProof", "launched", "decision", "authority"],
});

function fail(message) {
  throw new TypeError(message);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} must be a plain object`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string") || Object.keys(value).length !== Reflect.ownKeys(value).length) fail(`${label} has hidden keys`);
  for (const key of Object.keys(descriptors)) if (!("value" in descriptors[key]) || descriptors[key].enumerable !== true) fail(`${label}.${key} must be enumerable data`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) fail(`${label} keys/order mismatch`);
}

function assertArray(value, length, label) {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length || Object.keys(value).length !== length) fail(`${label} must be a dense ${length}-tuple`);
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = [...Array.from({ length }, (_, index) => String(index)), "length"];
  if (ownKeys.length !== expectedKeys.length || ownKeys.some((key, index) => key !== expectedKeys[index])) fail(`${label} has decorated or hidden keys`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Object.keys(descriptors)) if (!("value" in descriptors[key])) fail(`${label}.${key} must be a data property`);
}

function text(value, label) {
  if (typeof value !== "string" || value.length === 0 || /[\0\r\n]/u.test(value)) fail(`${label} must be canonical text`);
}

function basename(value, label) {
  text(value, label);
  if (value === "." || value === ".." || value.includes("/") || value.includes("\\")) fail(`${label} must be one canonical basename`);
}

function sha(value, label) {
  if (typeof value !== "string" || !HEX64.test(value)) fail(`${label} must be lowercase sha256`);
}

function u64(value, label) {
  if (typeof value !== "string" || !U64.test(value) || BigInt(value) > 18446744073709551615n) fail(`${label} must be canonical u64`);
}

function abs(value, label) {
  if (typeof value !== "string" || !ABS.test(value) || value.includes("/../") || value.endsWith("/..")) fail(`${label} must be a canonical absolute path`);
}

function hold(value, label) {
  if (value.decision !== "HOLD" || value.authority !== "NONE") fail(`${label} must remain HOLD/NONE`);
}

function assertFileIdentity(value, label) {
  exactKeys(value, ["path", "sha256", "byteLength", "mode", "uid", "gid", "dev", "ino", "mountId", "nlink", "handleSha256", "openFileDescriptionSha256", "sameHandleReplayRequired"], label);
  abs(value.path, `${label}.path`);
  sha(value.sha256, `${label}.sha256`);
  for (const key of ["byteLength", "uid", "gid", "dev", "ino", "mountId", "nlink"]) u64(value[key], `${label}.${key}`);
  if (!/^[0-7]{4}$/u.test(value.mode)) fail(`${label}.mode invalid`);
  sha(value.handleSha256, `${label}.handleSha256`);
  sha(value.openFileDescriptionSha256, `${label}.openFileDescriptionSha256`);
  if (value.sameHandleReplayRequired !== true) fail(`${label} must require same-handle replay`);
}

function assertDeadline(value, label) {
  exactKeys(value, ["clock", "absoluteNanoseconds", "timerFd", "timerDev", "timerIno", "timerFirst"], label);
  if (value.clock !== "CLOCK_MONOTONIC") fail(`${label}.clock invalid`);
  for (const key of ["absoluteNanoseconds", "timerFd", "timerDev", "timerIno"]) u64(value[key], `${label}.${key}`);
  if (value.timerFirst !== true) fail(`${label} must be timer-first`);
}

function assertReceipt(value, label) {
  exactKeys(value, ["sha256", "byteLength", "producer", "outcome", "subjectSha256", "attemptId", "runId", "sessionId", "decision", "authority"], label);
  sha(value.sha256, `${label}.sha256`);
  sha(value.subjectSha256, `${label}.subjectSha256`);
  u64(value.byteLength, `${label}.byteLength`);
  for (const key of ["producer", "outcome", "attemptId", "runId", "sessionId"]) text(value[key], `${label}.${key}`);
  hold(value, label);
}

function assertZero(value, label) {
  exactKeys(value, ["fdLedgerSha256", "processLedgerSha256", "mountLedgerSha256", "entryLedgerSha256", "cacheLedgerSha256", "allZero"], label);
  for (const key of ["fdLedgerSha256", "processLedgerSha256", "mountLedgerSha256", "entryLedgerSha256", "cacheLedgerSha256"]) sha(value[key], `${label}.${key}`);
  if (value.allZero !== true) fail(`${label}.allZero required`);
}

function assertArtifactSet(value, label) {
  exactKeys(value, ["target", "installer", "objectMapSha256", "linkMapSha256", "diagnosticsSha256"], label);
  assertFileIdentity(value.target, `${label}.target`);
  assertFileIdentity(value.installer, `${label}.installer`);
  sha(value.objectMapSha256, `${label}.objectMapSha256`);
  sha(value.linkMapSha256, `${label}.linkMapSha256`);
  sha(value.diagnosticsSha256, `${label}.diagnosticsSha256`);
}

const LINEAGE_KEYS = Object.freeze([
  "bps06ManifestSha256", "bpc03Commit", "bpc03Tree", "bpc03ManifestSha256",
  "bpk00Commit", "bpk00Tree", "bpk00BlobSha1", "bpk00FileSha256",
]);

function assertLineage(value, label) {
  exactKeys(value, LINEAGE_KEYS, label);
  const expected = lineage();
  if (JSON.stringify(value) !== JSON.stringify(expected)) fail(`${label} does not match frozen BPS06/BPC03/BPK00 lineage`);
}

const FD12_KEYS = Object.freeze([
  "fd", "role", "storage", "nlink", "uid", "mode", "sealSet",
  "checkpointSchema", "checkpointProducer", "checkpointOutcome", "checkpointCommit", "checkpointTree",
  "checkpointBlobSha1", "checkpointFileSha256", "checkpointByteLength", "rootPublicKeyHex",
  "rootFingerprintSha256", "ownerProvisioningReceiptSha256", "contentSha256", "byteLength",
  "dev", "ino", "mountId", "handleSha256", "openFileDescriptionSha256",
  "sameHandleReplayRequired", "verifiedBeforeFd11", "verifiedBeforeFd3", "verifiedBeforePeerRpc",
]);

export function validateBps09Fd12TrustAnchor(value) {
  exactKeys(value, FD12_KEYS, "fd12TrustAnchor");
  const fixed = {
    fd: "12",
    role: "OWNER_ROOT_KEY_ANCHOR",
    storage: "SEALED_MEMFD",
    nlink: "0",
    uid: "0",
    mode: "0400",
    sealSet: "F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE|F_SEAL_FUTURE_WRITE",
    checkpointSchema: BPS09_BPK00_BINDING.schema,
    checkpointProducer: BPS09_BPK00_BINDING.producer,
    checkpointOutcome: BPS09_BPK00_BINDING.outcome,
    checkpointCommit: BPS09_BPK00_BINDING.commit,
    checkpointTree: BPS09_BPK00_BINDING.tree,
    checkpointBlobSha1: BPS09_BPK00_BINDING.blobSha1,
    checkpointFileSha256: BPS09_BPK00_BINDING.fileSha256,
    checkpointByteLength: String(BPS09_BPK00_BINDING.byteLength),
    rootPublicKeyHex: BPS09_BPK00_BINDING.rootPublicKeyHex,
    rootFingerprintSha256: BPS09_BPK00_BINDING.rootFingerprintSha256,
    ownerProvisioningReceiptSha256: BPS09_BPK00_BINDING.ownerProvisioningReceiptSha256,
    contentSha256: BPS09_BPK00_BINDING.rootFingerprintSha256,
    byteLength: "32",
  };
  for (const [key, expected] of Object.entries(fixed)) if (value[key] !== expected) fail(`fd12TrustAnchor.${key} binding mismatch`);
  if (!HEX40.test(value.checkpointCommit) || !HEX40.test(value.checkpointTree) || !HEX40.test(value.checkpointBlobSha1)) fail("fd12TrustAnchor Git identity invalid");
  for (const key of ["checkpointFileSha256", "rootPublicKeyHex", "rootFingerprintSha256", "ownerProvisioningReceiptSha256", "contentSha256", "handleSha256", "openFileDescriptionSha256"]) sha(value[key], `fd12TrustAnchor.${key}`);
  for (const key of ["checkpointByteLength", "byteLength", "dev", "ino", "mountId"]) u64(value[key], `fd12TrustAnchor.${key}`);
  const rootDigest = createHash("sha256").update(Buffer.from(value.rootPublicKeyHex, "hex")).digest("hex");
  if (rootDigest !== value.rootFingerprintSha256) fail("fd12TrustAnchor root fingerprint does not digest the raw32 key");
  if (value.sameHandleReplayRequired !== true || value.verifiedBeforeFd11 !== true || value.verifiedBeforeFd3 !== true || value.verifiedBeforePeerRpc !== true) fail("FD12 must be sealed same-handle verified before FD11, FD3, and peer use");
  return value;
}

function assertVerificationOrder(value) {
  assertArray(value, BPS09_VERIFICATION_ORDER.length, "compileBootstrap.verificationOrder");
  if (JSON.stringify(value) !== JSON.stringify(BPS09_VERIFICATION_ORDER)) fail("FD12-first verification order mismatch");
  const fd12Last = 2;
  const fd11First = value.findIndex((step) => step.includes("FD11"));
  const fd3First = value.findIndex((step) => step.includes("FD3"));
  const peerFirst = value.findIndex((step) => step.includes("PEER_RPC"));
  if (fd11First <= fd12Last || fd3First <= fd12Last || peerFirst <= fd12Last) fail("FD12 verification must precede FD11, FD3, and peers");
}

export function validateBps09ToolchainManifest(value) {
  exactKeys(value, KIND_KEYS.TOOLCHAIN_MANIFEST, "toolchainManifest");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "TOOLCHAIN_MANIFEST" || value.sourceCommit !== BPS09_BPK00_BINDING.commit || value.sourceTree !== BPS09_BPK00_BINDING.tree) fail("toolchain manifest source binding mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) text(value[key], `toolchainManifest.${key}`);
  exactKeys(value.tools, ["compiler", "linker", "archiver", "staticNode"], "toolchainManifest.tools");
  for (const key of Object.keys(value.tools)) assertFileIdentity(value.tools[key], `toolchainManifest.tools.${key}`);
  exactKeys(value.sysroot, ["root", "manifestSha256", "manifestByteLength", "entryCount", "readOnly"], "toolchainManifest.sysroot");
  abs(value.sysroot.root, "toolchainManifest.sysroot.root");
  sha(value.sysroot.manifestSha256, "toolchainManifest.sysroot.manifestSha256");
  u64(value.sysroot.manifestByteLength, "toolchainManifest.sysroot.manifestByteLength");
  u64(value.sysroot.entryCount, "toolchainManifest.sysroot.entryCount");
  if (value.sysroot.readOnly !== true) fail("sysroot must be read-only");
  exactKeys(value.launch, ["argvSha256", "environmentSha256", "cwd", "cwdIdentitySha256", "sourceDateEpoch", "locale", "timezone", "umask", "targetTriple", "network"], "toolchainManifest.launch");
  sha(value.launch.argvSha256, "launch.argvSha256");
  sha(value.launch.environmentSha256, "launch.environmentSha256");
  abs(value.launch.cwd, "launch.cwd");
  sha(value.launch.cwdIdentitySha256, "launch.cwdIdentitySha256");
  u64(value.launch.sourceDateEpoch, "launch.sourceDateEpoch");
  if (value.launch.locale !== "C" || value.launch.timezone !== "UTC" || value.launch.umask !== "0022" || value.launch.network !== "NONE") fail("launch context mismatch");
  text(value.launch.targetTriple, "launch.targetTriple");
  hold(value, "toolchainManifest");
  return value;
}

export function validateBps09CompileBootstrap(value) {
  exactKeys(value, KIND_KEYS.COMPILE_BOOTSTRAP, "compileBootstrap");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "COMPILE_BOOTSTRAP" || value.sourceCommit !== BPS09_BPK00_BINDING.commit || value.sourceTree !== BPS09_BPK00_BINDING.tree) fail("compile source binding mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) text(value[key], `compileBootstrap.${key}`);
  assertLineage(value.lineage, "compileBootstrap.lineage");
  validateBps09Fd12TrustAnchor(value.fd12TrustAnchor);
  assertVerificationOrder(value.verificationOrder);
  sha(value.toolchainManifestSha256, "compileBootstrap.toolchainManifestSha256");
  assertArray(value.attemptRoots, 2, "compileBootstrap.attemptRoots");
  value.attemptRoots.forEach((path, index) => abs(path, `compileBootstrap.attemptRoots[${index}]`));
  if (value.attemptRoots[0] === value.attemptRoots[1]) fail("compile roots must be distinct");
  exactKeys(value.outputNames, ["target", "installer"], "compileBootstrap.outputNames");
  basename(value.outputNames.target, "outputNames.target");
  basename(value.outputNames.installer, "outputNames.installer");
  if (value.outputNames.target === value.outputNames.installer) fail("compile output names must be distinct");
  assertDeadline(value.deadline, "compileBootstrap.deadline");
  if (value.capabilityDomain !== "COMPILE_ONLY" || value.installOrRecoverFields !== null) fail("compile/install-recover capability crossover");
  hold(value, "compileBootstrap");
  return value;
}

export function validateBps09CompileEvidence(value) {
  exactKeys(value, KIND_KEYS.COMPILE_EVIDENCE, "compileEvidence");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "COMPILE_EVIDENCE") fail("compile evidence kind mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) text(value[key], `compileEvidence.${key}`);
  sha(value.bootstrapSha256, "compileEvidence.bootstrapSha256");
  assertArtifactSet(value.attemptA, "compileEvidence.attemptA");
  assertArtifactSet(value.attemptB, "compileEvidence.attemptB");
  for (const role of ["target", "installer"]) if (value.attemptA[role].sha256 !== value.attemptB[role].sha256 || value.attemptA[role].byteLength !== value.attemptB[role].byteLength) fail(`compile ${role} attempts differ`);
  for (const key of ["objectMapSha256", "linkMapSha256", "diagnosticsSha256"]) if (value.attemptA[key] !== value.attemptB[key]) fail(`compile ${key} attempts differ`);
  if (value.artifactsByteEqual !== true) fail("two compile attempts must be byte-equal");
  assertZero(value.zeroProof, "compileEvidence.zeroProof");
  if (value.independentReviewReceipt !== null || value.installed !== false || value.launched !== false) fail("compile evidence cannot review/install/launch");
  hold(value, "compileEvidence");
  return value;
}

export function validateBps09InstallBootstrap(value) {
  exactKeys(value, KIND_KEYS.INSTALL_BOOTSTRAP, "installBootstrap");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "INSTALL_BOOTSTRAP") fail("install bootstrap kind mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) text(value[key], `installBootstrap.${key}`);
  assertReceipt(value.compileReviewReceipt, "installBootstrap.compileReviewReceipt");
  if (value.compileReviewReceipt.producer !== "INDEPENDENT_COMPILE_REVIEW" || value.compileReviewReceipt.outcome !== "POST_CHECKPOINT_PACKAGE_BOUND_FD12_TRUST_ANCHORED_DETERMINISTIC_COMPILE_ARTIFACT_REVIEW_ACCEPTED_HOLD" || value.compileReviewReceipt.subjectSha256 !== compileArtifactPairSubject(value.targetArtifact, value.installerArtifact) || value.compileReviewReceipt.attemptId !== value.attemptId || value.compileReviewReceipt.runId !== value.runId || value.compileReviewReceipt.sessionId !== value.sessionId) fail("install compile-review receipt is not exact");
  assertFileIdentity(value.targetArtifact, "installBootstrap.targetArtifact");
  assertFileIdentity(value.installerArtifact, "installBootstrap.installerArtifact");
  assertFileIdentity(value.destinationParent, "installBootstrap.destinationParent");
  basename(value.tempName, "installBootstrap.tempName");
  basename(value.finalName, "installBootstrap.finalName");
  if (value.tempName === value.finalName) fail("install names invalid");
  assertDeadline(value.deadline, "installBootstrap.deadline");
  if (value.capabilityDomain !== "INSTALL_OR_RECOVER_ONLY" || value.toolchainFields !== null) fail("install/compile capability crossover");
  hold(value, "installBootstrap");
  return value;
}

export function validateBps09InstallEvidence(value) {
  exactKeys(value, KIND_KEYS.INSTALL_EVIDENCE, "installEvidence");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "INSTALL_EVIDENCE") fail("install evidence kind mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) text(value[key], `installEvidence.${key}`);
  sha(value.bootstrapSha256, "installEvidence.bootstrapSha256");
  assertFileIdentity(value.sourceArtifact, "installEvidence.sourceArtifact");
  assertFileIdentity(value.installerSelf, "installEvidence.installerSelf");
  assertFileIdentity(value.finalArtifact, "installEvidence.finalArtifact");
  assertReceipt(value.publicationReceipt, "installEvidence.publicationReceipt");
  assertReceipt(value.custodyReceipt, "installEvidence.custodyReceipt");
  if (value.finalArtifact.sha256 !== value.sourceArtifact.sha256 || value.finalArtifact.byteLength !== value.sourceArtifact.byteLength) fail("installed final bytes do not equal the reviewed source artifact");
  const finalSubject = installedFinalSubject(value.finalArtifact);
  for (const [receiptValue, producer] of [[value.publicationReceipt, "INSTALL_WATCHDOG_PUBLICATION_RECEIPT"], [value.custodyReceipt, "EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT"]]) {
    if (receiptValue.producer !== producer || receiptValue.outcome !== "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD" || receiptValue.subjectSha256 !== finalSubject || receiptValue.attemptId !== value.attemptId || receiptValue.runId !== value.runId || receiptValue.sessionId !== value.sessionId) fail("install evidence receipt binding mismatch");
  }
  assertZero(value.zeroProof, "installEvidence.zeroProof");
  if (value.launched !== false) fail("installed target launch forbidden");
  hold(value, "installEvidence");
  return value;
}

export function validateBps09RecoveryBootstrap(value) {
  exactKeys(value, KIND_KEYS.RECOVERY_BOOTSTRAP, "recoveryBootstrap");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "RECOVERY_BOOTSTRAP") fail("recovery bootstrap kind mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) text(value[key], `recoveryBootstrap.${key}`);
  assertReceipt(value.actualPriorReceipt, "recoveryBootstrap.actualPriorReceipt");
  assertArray(value.acceptedProducerTypes, BPS09_RECOVERY_PRODUCER_TYPES.length, "recoveryBootstrap.acceptedProducerTypes");
  if (JSON.stringify(value.acceptedProducerTypes) !== JSON.stringify(BPS09_RECOVERY_PRODUCER_TYPES) || value.acceptedProducerSetSha256 !== BPS09_RECOVERY_PRODUCER_SET_SHA256 || value.actualPriorReceipt.sha256 === value.acceptedProducerSetSha256 || !BPS09_RECOVERY_PRODUCER_TYPES.includes(value.actualPriorReceipt.producer) || value.actualPriorReceipt.outcome !== "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD" || value.actualPriorReceipt.subjectSha256 !== recoveryLedgerSubject(value.identityLedger, value.tempName, value.finalName) || value.actualPriorReceipt.attemptId !== value.attemptId || value.actualPriorReceipt.runId !== value.runId || value.actualPriorReceipt.sessionId !== value.sessionId) fail("recovery prior receipt membership/binding mismatch");
  sha(value.acceptedProducerSetSha256, "recoveryBootstrap.acceptedProducerSetSha256");
  exactKeys(value.identityLedger, ["parent", "temp", "final", "publicationCasSha256"], "recoveryBootstrap.identityLedger");
  assertFileIdentity(value.identityLedger.parent, "identityLedger.parent");
  if (value.identityLedger.temp !== null) assertFileIdentity(value.identityLedger.temp, "identityLedger.temp");
  if (value.identityLedger.final !== null) assertFileIdentity(value.identityLedger.final, "identityLedger.final");
  sha(value.identityLedger.publicationCasSha256, "identityLedger.publicationCasSha256");
  basename(value.tempName, "recoveryBootstrap.tempName");
  basename(value.finalName, "recoveryBootstrap.finalName");
  if (value.tempName === value.finalName) fail("recovery names invalid");
  if (value.identityLedger.temp !== null && value.identityLedger.temp.path !== `${value.identityLedger.parent.path}/${value.tempName}`) fail("recovery temp identity/name mismatch");
  if (value.identityLedger.final !== null && value.identityLedger.final.path !== `${value.identityLedger.parent.path}/${value.finalName}`) fail("recovery final identity/name mismatch");
  assertDeadline(value.deadline, "recoveryBootstrap.deadline");
  if (value.capabilityDomain !== "INSTALL_OR_RECOVER_ONLY" || value.toolchainFields !== null) fail("recovery/compile capability crossover");
  hold(value, "recoveryBootstrap");
  return value;
}

export function validateBps09RecoveryEvidence(value) {
  exactKeys(value, KIND_KEYS.RECOVERY_EVIDENCE, "recoveryEvidence");
  if (value.schema !== BPS09_SCHEMA_ID || value.kind !== "RECOVERY_EVIDENCE") fail("recovery evidence kind mismatch");
  for (const key of ["attemptId", "runId", "sessionId"]) text(value[key], `recoveryEvidence.${key}`);
  sha(value.bootstrapSha256, "recoveryEvidence.bootstrapSha256");
  assertReceipt(value.abortCasReceipt, "recoveryEvidence.abortCasReceipt");
  assertReceipt(value.cleanupReceipt, "recoveryEvidence.cleanupReceipt");
  assertReceipt(value.parentFsyncReceipt, "recoveryEvidence.parentFsyncReceipt");
  assertZero(value.zeroProof, "recoveryEvidence.zeroProof");
  for (const [receiptValue, producer, purpose] of [[value.abortCasReceipt, "INSTALL_WATCHDOG_ABORT_RECEIPT", "ABORT_CAS"], [value.cleanupReceipt, "EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT", "IDENTITY_LED_CLEANUP"], [value.parentFsyncReceipt, "EVIDENCE_CUSTODIAN_PARENT_FSYNC_RECEIPT", "PARENT_FSYNC_AND_ZERO"]]) {
    if (receiptValue.producer !== producer || receiptValue.outcome !== "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD" || receiptValue.subjectSha256 !== recoveryEvidenceReceiptSubject(purpose, value) || receiptValue.attemptId !== value.attemptId || receiptValue.runId !== value.runId || receiptValue.sessionId !== value.sessionId) fail("recovery evidence receipt binding mismatch");
  }
  if (value.launched !== false) fail("recovery cannot launch target");
  hold(value, "recoveryEvidence");
  return value;
}

function fileIdentity(path, mode = "0550") {
  return {
    path,
    sha256: ZERO_SHA256,
    byteLength: "0",
    mode,
    uid: "0",
    gid: "0",
    dev: "0",
    ino: "0",
    mountId: "0",
    nlink: "1",
    handleSha256: ZERO_SHA256,
    openFileDescriptionSha256: ZERO_SHA256,
    sameHandleReplayRequired: true,
  };
}

function receipt(producer, outcome = "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD", subjectSha256 = ZERO_SHA256) {
  return {
    sha256: ZERO_SHA256,
    byteLength: "0",
    producer,
    outcome,
    subjectSha256,
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    decision: "HOLD",
    authority: "NONE",
  };
}

function lineage() {
  return {
    bps06ManifestSha256: BPS09_BPS06_BINDING.sha256,
    bpc03Commit: BPS09_BPC03_BINDING.commit,
    bpc03Tree: BPS09_BPC03_BINDING.tree,
    bpc03ManifestSha256: BPS09_BPC03_BINDING.manifestSha256,
    bpk00Commit: BPS09_BPK00_BINDING.commit,
    bpk00Tree: BPS09_BPK00_BINDING.tree,
    bpk00BlobSha1: BPS09_BPK00_BINDING.blobSha1,
    bpk00FileSha256: BPS09_BPK00_BINDING.fileSha256,
  };
}

function fd12TrustAnchor() {
  return {
    fd: "12",
    role: "OWNER_ROOT_KEY_ANCHOR",
    storage: "SEALED_MEMFD",
    nlink: "0",
    uid: "0",
    mode: "0400",
    sealSet: "F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE|F_SEAL_FUTURE_WRITE",
    checkpointSchema: BPS09_BPK00_BINDING.schema,
    checkpointProducer: BPS09_BPK00_BINDING.producer,
    checkpointOutcome: BPS09_BPK00_BINDING.outcome,
    checkpointCommit: BPS09_BPK00_BINDING.commit,
    checkpointTree: BPS09_BPK00_BINDING.tree,
    checkpointBlobSha1: BPS09_BPK00_BINDING.blobSha1,
    checkpointFileSha256: BPS09_BPK00_BINDING.fileSha256,
    checkpointByteLength: String(BPS09_BPK00_BINDING.byteLength),
    rootPublicKeyHex: BPS09_BPK00_BINDING.rootPublicKeyHex,
    rootFingerprintSha256: BPS09_BPK00_BINDING.rootFingerprintSha256,
    ownerProvisioningReceiptSha256: BPS09_BPK00_BINDING.ownerProvisioningReceiptSha256,
    contentSha256: BPS09_BPK00_BINDING.rootFingerprintSha256,
    byteLength: "32",
    dev: "0",
    ino: "0",
    mountId: "0",
    handleSha256: ZERO_SHA256,
    openFileDescriptionSha256: ZERO_SHA256,
    sameHandleReplayRequired: true,
    verifiedBeforeFd11: true,
    verifiedBeforeFd3: true,
    verifiedBeforePeerRpc: true,
  };
}

function compileArtifactPairSubject(target, installer) {
  return createHash("sha256").update("IAT_B3_BPS09_COMPILE_ARTIFACT_PAIR_V1\0", "utf8").update(`${JSON.stringify(target)}\n`, "utf8").update(`${JSON.stringify(installer)}\n`, "utf8").digest("hex");
}

function installedFinalSubject(finalArtifact) {
  return createHash("sha256").update("IAT_B3_BPS09_INSTALLED_FINAL_V1\0", "utf8").update(`${JSON.stringify(finalArtifact)}\n`, "utf8").digest("hex");
}

function recoveryLedgerSubject(identityLedger, tempName, finalName) {
  return createHash("sha256").update("IAT_B3_BPS09_RECOVERY_LEDGER_V2\0", "utf8").update(`${JSON.stringify({ identityLedger, tempName, finalName })}\n`, "utf8").digest("hex");
}

function recoveryEvidenceReceiptSubject(purpose, evidence) {
  const projection = purpose === "ABORT_CAS"
    ? { attemptId: evidence.attemptId, runId: evidence.runId, sessionId: evidence.sessionId, bootstrapSha256: evidence.bootstrapSha256 }
    : purpose === "IDENTITY_LED_CLEANUP"
      ? { attemptId: evidence.attemptId, runId: evidence.runId, sessionId: evidence.sessionId, bootstrapSha256: evidence.bootstrapSha256, abortReceiptSha256: evidence.abortCasReceipt.sha256 }
      : { attemptId: evidence.attemptId, runId: evidence.runId, sessionId: evidence.sessionId, bootstrapSha256: evidence.bootstrapSha256, abortReceiptSha256: evidence.abortCasReceipt.sha256, cleanupReceiptSha256: evidence.cleanupReceipt.sha256, zeroProof: evidence.zeroProof };
  return createHash("sha256").update(`IAT_B3_BPS09_RECOVERY_${purpose}_V1\0`, "utf8").update(`${JSON.stringify(projection)}\n`, "utf8").digest("hex");
}

const BPS09_RECOVERY_PRODUCER_TYPES = Object.freeze([
  "INSTALL_WATCHDOG_PUBLICATION_RECEIPT",
  "EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT",
  "INSTALL_WATCHDOG_ABORT_RECEIPT",
  "EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT",
]);

const BPS09_RECOVERY_PRODUCER_SET_SHA256 = createHash("sha256").update(`${JSON.stringify(BPS09_RECOVERY_PRODUCER_TYPES)}\n`, "utf8").digest("hex");

function deadline() {
  return { clock: "CLOCK_MONOTONIC", absoluteNanoseconds: "0", timerFd: "0", timerDev: "0", timerIno: "0", timerFirst: true };
}

function zeroProof() {
  return {
    fdLedgerSha256: ZERO_SHA256,
    processLedgerSha256: ZERO_SHA256,
    mountLedgerSha256: ZERO_SHA256,
    entryLedgerSha256: ZERO_SHA256,
    cacheLedgerSha256: ZERO_SHA256,
    allZero: true,
  };
}

function artifactSet(root) {
  return {
    target: fileIdentity(`${root}/supervisor`),
    installer: fileIdentity(`${root}/install-controller`),
    objectMapSha256: ZERO_SHA256,
    linkMapSha256: ZERO_SHA256,
    diagnosticsSha256: ZERO_SHA256,
  };
}

const REVIEWED_TARGET_TEMPLATE = fileIdentity("/unresolved/reviewed-artifacts/supervisor");
const REVIEWED_INSTALLER_TEMPLATE = fileIdentity("/unresolved/reviewed-artifacts/install-controller");
const RECOVERY_LEDGER_TEMPLATE = {
  parent: fileIdentity("/unresolved/install-parent", "0750"),
  temp: fileIdentity("/unresolved/install-parent/UNRESOLVED_TEMP"),
  final: fileIdentity("/unresolved/install-parent/UNRESOLVED_FINAL"),
  publicationCasSha256: ZERO_SHA256,
};
const FINAL_ARTIFACT_TEMPLATE = fileIdentity("/unresolved/install-parent/UNRESOLVED_FINAL");

const DOCUMENT_TEMPLATES = {
  TOOLCHAIN_MANIFEST: {
    schema: BPS09_SCHEMA_ID,
    kind: "TOOLCHAIN_MANIFEST",
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    sourceCommit: BPS09_BPK00_BINDING.commit,
    sourceTree: BPS09_BPK00_BINDING.tree,
    tools: {
      compiler: fileIdentity("/unresolved/toolchain/compiler"),
      linker: fileIdentity("/unresolved/toolchain/linker"),
      archiver: fileIdentity("/unresolved/toolchain/archiver"),
      staticNode: fileIdentity("/unresolved/toolchain/static-node"),
    },
    sysroot: { root: "/unresolved/sysroot", manifestSha256: ZERO_SHA256, manifestByteLength: "0", entryCount: "0", readOnly: true },
    launch: { argvSha256: ZERO_SHA256, environmentSha256: ZERO_SHA256, cwd: "/unresolved/compile-cwd", cwdIdentitySha256: ZERO_SHA256, sourceDateEpoch: "0", locale: "C", timezone: "UTC", umask: "0022", targetTriple: "UNRESOLVED_TARGET", network: "NONE" },
    decision: "HOLD",
    authority: "NONE",
  },
  COMPILE_BOOTSTRAP: {
    schema: BPS09_SCHEMA_ID,
    kind: "COMPILE_BOOTSTRAP",
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    sourceCommit: BPS09_BPK00_BINDING.commit,
    sourceTree: BPS09_BPK00_BINDING.tree,
    lineage: lineage(),
    fd12TrustAnchor: fd12TrustAnchor(),
    verificationOrder: [...BPS09_VERIFICATION_ORDER],
    toolchainManifestSha256: ZERO_SHA256,
    attemptRoots: ["/unresolved/compile-attempt-a", "/unresolved/compile-attempt-b"],
    outputNames: { target: "supervisor", installer: "install-controller" },
    deadline: deadline(),
    capabilityDomain: "COMPILE_ONLY",
    installOrRecoverFields: null,
    decision: "HOLD",
    authority: "NONE",
  },
  COMPILE_EVIDENCE: {
    schema: BPS09_SCHEMA_ID,
    kind: "COMPILE_EVIDENCE",
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    bootstrapSha256: ZERO_SHA256,
    attemptA: artifactSet("/unresolved/compile-attempt-a"),
    attemptB: artifactSet("/unresolved/compile-attempt-b"),
    artifactsByteEqual: true,
    zeroProof: zeroProof(),
    independentReviewReceipt: null,
    installed: false,
    launched: false,
    decision: "HOLD",
    authority: "NONE",
  },
  INSTALL_BOOTSTRAP: {
    schema: BPS09_SCHEMA_ID,
    kind: "INSTALL_BOOTSTRAP",
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    compileReviewReceipt: receipt("INDEPENDENT_COMPILE_REVIEW", "POST_CHECKPOINT_PACKAGE_BOUND_FD12_TRUST_ANCHORED_DETERMINISTIC_COMPILE_ARTIFACT_REVIEW_ACCEPTED_HOLD", compileArtifactPairSubject(REVIEWED_TARGET_TEMPLATE, REVIEWED_INSTALLER_TEMPLATE)),
    targetArtifact: REVIEWED_TARGET_TEMPLATE,
    installerArtifact: REVIEWED_INSTALLER_TEMPLATE,
    destinationParent: fileIdentity("/unresolved/install-parent", "0750"),
    tempName: "UNRESOLVED_TEMP",
    finalName: "UNRESOLVED_FINAL",
    deadline: deadline(),
    capabilityDomain: "INSTALL_OR_RECOVER_ONLY",
    toolchainFields: null,
    decision: "HOLD",
    authority: "NONE",
  },
  INSTALL_EVIDENCE: {
    schema: BPS09_SCHEMA_ID,
    kind: "INSTALL_EVIDENCE",
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    bootstrapSha256: ZERO_SHA256,
    sourceArtifact: fileIdentity("/unresolved/reviewed-artifacts/supervisor"),
    installerSelf: fileIdentity("/unresolved/reviewed-artifacts/install-controller"),
    finalArtifact: FINAL_ARTIFACT_TEMPLATE,
    publicationReceipt: receipt("INSTALL_WATCHDOG_PUBLICATION_RECEIPT", "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD", installedFinalSubject(FINAL_ARTIFACT_TEMPLATE)),
    custodyReceipt: receipt("EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT", "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD", installedFinalSubject(FINAL_ARTIFACT_TEMPLATE)),
    zeroProof: zeroProof(),
    launched: false,
    decision: "HOLD",
    authority: "NONE",
  },
  RECOVERY_BOOTSTRAP: {
    schema: BPS09_SCHEMA_ID,
    kind: "RECOVERY_BOOTSTRAP",
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    actualPriorReceipt: receipt(BPS09_RECOVERY_PRODUCER_TYPES[0], "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD", recoveryLedgerSubject(RECOVERY_LEDGER_TEMPLATE, "UNRESOLVED_TEMP", "UNRESOLVED_FINAL")),
    acceptedProducerTypes: [...BPS09_RECOVERY_PRODUCER_TYPES],
    acceptedProducerSetSha256: BPS09_RECOVERY_PRODUCER_SET_SHA256,
    identityLedger: RECOVERY_LEDGER_TEMPLATE,
    tempName: "UNRESOLVED_TEMP",
    finalName: "UNRESOLVED_FINAL",
    deadline: deadline(),
    capabilityDomain: "INSTALL_OR_RECOVER_ONLY",
    toolchainFields: null,
    decision: "HOLD",
    authority: "NONE",
  },
  RECOVERY_EVIDENCE: {
    schema: BPS09_SCHEMA_ID,
    kind: "RECOVERY_EVIDENCE",
    attemptId: "UNRESOLVED_ATTEMPT",
    runId: "UNRESOLVED_RUN",
    sessionId: "UNRESOLVED_SESSION",
    bootstrapSha256: ZERO_SHA256,
    abortCasReceipt: null,
    cleanupReceipt: null,
    parentFsyncReceipt: null,
    zeroProof: zeroProof(),
    launched: false,
    decision: "HOLD",
    authority: "NONE",
  },
};

for (const [key, producer, purpose] of [["abortCasReceipt", "INSTALL_WATCHDOG_ABORT_RECEIPT", "ABORT_CAS"], ["cleanupReceipt", "EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT", "IDENTITY_LED_CLEANUP"], ["parentFsyncReceipt", "EVIDENCE_CUSTODIAN_PARENT_FSYNC_RECEIPT", "PARENT_FSYNC_AND_ZERO"]]) {
  DOCUMENT_TEMPLATES.RECOVERY_EVIDENCE[key] = receipt(producer, "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD", recoveryEvidenceReceiptSubject(purpose, DOCUMENT_TEMPLATES.RECOVERY_EVIDENCE));
}

const DOCUMENT_VALIDATORS = Object.freeze({
  TOOLCHAIN_MANIFEST: validateBps09ToolchainManifest,
  COMPILE_BOOTSTRAP: validateBps09CompileBootstrap,
  COMPILE_EVIDENCE: validateBps09CompileEvidence,
  INSTALL_BOOTSTRAP: validateBps09InstallBootstrap,
  INSTALL_EVIDENCE: validateBps09InstallEvidence,
  RECOVERY_BOOTSTRAP: validateBps09RecoveryBootstrap,
  RECOVERY_EVIDENCE: validateBps09RecoveryEvidence,
});

function cloneCanonical(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertPlainGraph(value, label, seen = new Set()) {
  if (value === null || typeof value !== "object") return;
  if (types.isProxy(value) || seen.has(value)) fail(`${label} contains a proxy, alias, or cycle`);
  seen.add(value);
  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getPrototypeOf(value) !== Array.prototype || Object.keys(value).length !== value.length || Reflect.ownKeys(value).length !== value.length + 1) fail(`${label} contains a decorated or sparse array`);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) fail(`${label}[${index}] must be enumerable data`);
      assertPlainGraph(descriptor.value, `${label}[${index}]`, seen);
    }
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} contains a non-plain object`);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).some((key) => typeof key !== "string") || Object.keys(value).length !== Reflect.ownKeys(value).length) fail(`${label} contains hidden keys`);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor) || descriptor.enumerable !== true) fail(`${label}.${key} must be enumerable data`);
      assertPlainGraph(descriptor.value, `${label}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function validateBps09Document(kind, value) {
  if (!BPS09_DOCUMENT_KINDS.includes(kind) || value === null || typeof value !== "object" || value.kind !== kind) fail("unknown or crossed BPS09 document kind");
  assertPlainGraph(value, kind);
  return DOCUMENT_VALIDATORS[kind](value);
}

export function sha256CanonicalBps09Document(kind, value) {
  validateBps09Document(kind, value);
  return createHash("sha256").update(`${JSON.stringify(value)}\n`, "utf8").digest("hex");
}

export function parseCanonicalBps09Document(kind, bytes) {
  if (!(bytes instanceof Uint8Array)) fail("document bytes required");
  let textValue;
  try {
    textValue = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("document must be valid UTF-8");
  }
  if (!textValue.endsWith("\n") || textValue.slice(0, -1).includes("\n") || textValue.includes("\r") || textValue.includes("\0")) fail("document must be one canonical LF JSON record");
  let value;
  try {
    value = JSON.parse(textValue.slice(0, -1));
  } catch {
    fail("document must contain valid JSON");
  }
  validateBps09Document(kind, value);
  if (`${JSON.stringify(value)}\n` !== textValue) fail("document is not canonical JSON");
  return value;
}

const SOURCE_CONTRACT_TEMPLATE = {
  schema: BPS09_SCHEMA_ID,
  status: BPS09_STATUS,
  taskId: "BPS09",
  exactPaths: [...BPS09_PATHS],
  bps06Binding: cloneCanonical(BPS09_BPS06_BINDING),
  bpc03Binding: cloneCanonical(BPS09_BPC03_BINDING),
  bpk00Binding: cloneCanonical(BPS09_BPK00_BINDING),
  documentKinds: [...BPS09_DOCUMENT_KINDS],
  capabilityMatrix: cloneCanonical(BPS09_CAPABILITY_MATRIX),
  verificationOrder: [...BPS09_VERIFICATION_ORDER],
  documentTemplates: cloneCanonical(DOCUMENT_TEMPLATES),
  sourceBoundary: {
    existingPathMutationPermitted: false,
    gitMutationPermitted: false,
    compileOrControllerExecutionPermitted: false,
    installOrRecoveryPermitted: false,
    hostProbePermitted: false,
    deviceActionPermitted: false,
    networkOrRpcPermitted: false,
  },
  actualDocuments: {
    toolchainManifest: null,
    compileBootstrap: null,
    compileEvidence: null,
    installBootstrap: null,
    installEvidence: null,
    recoveryBootstrap: null,
    recoveryEvidence: null,
  },
  truthBoundary: {
    sourcePresent: true,
    fd12Observed: false,
    fd12CheckpointVerified: false,
    fd12SealsVerified: false,
    fd12SameHandleVerified: false,
    fd11Observed: false,
    fd3Observed: false,
    peerRpcUsed: false,
    toolchainAccepted: false,
    compiled: false,
    linked: false,
    reviewedArtifact: false,
    receiptPresent: false,
    installed: false,
    recovered: false,
    launched: false,
    runtimeObserved: false,
    publicDevnet: false,
    gate8Go: false,
    releasePermitted: false,
    mainnetPermitted: false,
    decision: "HOLD",
    authority: "NONE",
  },
};

export function createBps09SourceContract() {
  return cloneCanonical(SOURCE_CONTRACT_TEMPLATE);
}

export function validateBps09SourceContract(value) {
  assertPlainGraph(value, "sourceContract");
  exactKeys(value, ["schema", "status", "taskId", "exactPaths", "bps06Binding", "bpc03Binding", "bpk00Binding", "documentKinds", "capabilityMatrix", "verificationOrder", "documentTemplates", "sourceBoundary", "actualDocuments", "truthBoundary"], "sourceContract");
  if (JSON.stringify(value) !== JSON.stringify(SOURCE_CONTRACT_TEMPLATE)) fail("source contract differs from frozen BPS09 source truth");
  for (const kind of BPS09_DOCUMENT_KINDS) validateBps09Document(kind, value.documentTemplates[kind]);
  return value;
}

export const BPS09_SOURCE_CONTRACT = deepFreeze(createBps09SourceContract());
export const BPS09_SOURCE_CANONICAL_BYTES = Buffer.from(`${JSON.stringify(BPS09_SOURCE_CONTRACT)}\n`, "utf8");
export const BPS09_SOURCE_CANONICAL_SHA256 = createHash("sha256").update(BPS09_SOURCE_CANONICAL_BYTES).digest("hex");

const schemaPath = new URL("../../docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored.v1.schema.json", import.meta.url);
export const BPS09_JSON_SCHEMA = deepFreeze(JSON.parse(readFileSync(schemaPath, "utf8")));

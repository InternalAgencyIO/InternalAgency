import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";
import { types as utilTypes } from "node:util";

export const BPS06_SCHEMA = "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design/v1";
export const BPS06_STATUS = "HOLD_SOURCE_DESIGN_ONLY";
export const BPS06_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design.v1.schema.json",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design-contract.mjs",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design-contract.test.mjs",
]);
export const BPS05_MANIFEST = Object.freeze({
  sha256: "09be6c33631845b2c300db6ba37157f667541335f00a9f31ec2e63df3d106b0b",
  byteLength: 1214,
  pathCount: 6,
  payloadByteLength: 700762,
  serializer: "HEADERLESS_RAW_UTF8_PATH_SORT_100644_NUL_SHA256_NUL_DECIMAL_BYTES_NUL_PATH_LF",
});

const BPS05_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-bootstrap-descriptor.v1.schema.json",
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-runtime-anchor.v1.schema.json",
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-runtime-evidence.v1.schema.json",
  "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound.c",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-launcher.mjs",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-source.test.mjs",
]);

const NINE_PATHS_RAW_UTF8_SORTED = Object.freeze([
  BPS05_PATHS[0],
  BPS06_PATHS[0],
  BPS05_PATHS[1],
  BPS05_PATHS[2],
  BPS05_PATHS[3],
  BPS06_PATHS[1],
  BPS05_PATHS[4],
  BPS06_PATHS[2],
  BPS05_PATHS[5],
]);

const acceptedManifest = (sha256, byteLength, pathCount, payloadByteLength, rows, reviewOutcome) =>
  Object.freeze({ sha256, byteLength, pathCount, payloadByteLength, rows, reviewOutcome });

const row = (path, sha256, byteLength) => Object.freeze({ mode: "100644", sha256, byteLength, path });
const CHECKPOINT_PRIOR_RECEIPT = Object.freeze({ UNSTARTED: null, SOURCE_MANIFEST_REPLAYED: "SOURCE_MANIFEST_RECEIPT", PARENT_REPLAYED: "PARENT_OBJECT_RECEIPT", TARGETS_ABSENT: "ABSENCE_RECEIPT", TEMP_INDEX_RESERVED: "PRIVATE_INDEX_IDENTITY", NINE_BLOBS_WRITTEN_TO_CANONICAL_ODB_NO_FILTER: "NINE_BLOB_SET_RECEIPT", TEMP_INDEX_POPULATED: "CACHEINFO_RECEIPT", TREE_WRITTEN_TO_CANONICAL_ODB: "TREE_RECEIPT", COMMIT_WRITTEN_UNSIGNED_TO_CANONICAL_ODB: "RAW_COMMIT_RECEIPT", COMMIT_REOPENED_FROM_CANONICAL_ODB: "CANONICAL_ODB_REOPEN_RECEIPT", REF_CAS_CREATED: "ZERO_TO_COMMIT_REF_CAS_RECEIPT", WORKTREE_ATTACHED: "WORKTREE_ADMIN_RECEIPT", WORKTREE_REOPENED_CLEAN: "CLEAN_REOPEN_RECEIPT", CHECKPOINT_FROZEN_HOLD: "TERMINAL_HOLD_RECEIPT" });
const INSTALL_PRIOR_RECEIPT = Object.freeze({ UNSTARTED: null, PREARM_VALIDATED: "PREARM_RECEIPT", ATTEMPT_RESERVED: "CAS_RESERVATION_RECEIPT", PARENT_REPLAYED: "PARENT_IDENTITY_RECEIPT", TEMP_CREATED: "O_EXCL_RECEIPT", BYTES_WRITTEN: "BOUNDED_WRITE_LEDGER", TEMP_FSYNCED: "FILE_FSYNC_RECEIPT", IDENTITY_REPLAYED: "SAME_OBJECT_RECEIPT", PUBLISHED_NOREPLACE: "RENAME_NOREPLACE_CAS_RECEIPT", PARENT_FSYNCED: "PARENT_FSYNC_RECEIPT", FINAL_REOPENED_SAME_OBJECT: "FINAL_REOPEN_RECEIPT", CUSTODY_ACKED: "CUSTODY_ACK", OBSERVATION_HOLD: "OBSERVATION_HOLD_RECEIPT", ROLLBACK_OR_RETAIN_DECIDED: "CUSTODIAN_DECISION_RECEIPT", ZERO_VERIFIED: "DIRECT_ZERO_RECEIPT", TERMINAL_HOLD: "TERMINAL_HOLD_RECEIPT" });
const priorReceiptFor = (owner, phase) => (owner.startsWith("CHECKPOINT") ? CHECKPOINT_PRIOR_RECEIPT : INSTALL_PRIOR_RECEIPT)[phase] ?? null;
const transition = (from, to, emittedReceipt, owner = "CHECKPOINT_WATCHDOG", failureTarget = "ABORT_LATCHED") => Object.freeze({
  from, to, owner,
  preconditions: Object.freeze(["EXACT_FROM_STATE", "BOUND_PREIMAGE", "BOUND_IDENTITY_SET", "PRIOR_RECEIPT_CHAIN", "MONOTONIC_DEADLINE_OPEN"]),
  priorReceipt: priorReceiptFor(owner, from),
  priorReceiptSha256: null,
  acceptedPriorReceiptProducerSetSha256: null,
  priorReceiptProducerType: from === "UNSTARTED" ? null : `EXACT_${priorReceiptFor(owner, from)}_PRODUCER_TYPE`,
  priorReceiptInstanceBindings: Object.freeze(from === "UNSTARTED" ? [] : ["EXACT_RECEIPT_BYTES_SHA256", "ATTEMPT_ID_EQUAL", "RUN_ID_EQUAL", "SESSION_ID_EQUAL", "WATCHDOG_CAS_STATE_EQUAL", "PRODUCER_TYPE_MEMBER_PROOF"]),
  emittedReceipt,
  emittedReceiptSha256: null,
  deadlineBinding: "EXTERNAL_MONOTONIC_DEADLINE_AND_TIMER_IDENTITY",
  identityBindings: Object.freeze(["ATTEMPT_RUN_SESSION", `FROM_${from}_STATE_IDENTITY`, `TO_${to}_PREIMAGE`, `WATCHDOG_CAS_${from}_TO_${to}`, "ROLE_PRINCIPALS", "RESOURCE_IDENTITY_LEDGER"]),
  failureTarget,
});
const chain = (rows, initialPriorReceipt = null, acceptedProducerSetSha256 = null) => Object.freeze(rows.map((row, index) => Object.freeze({
  ...row,
  priorReceipt: index === 0 ? initialPriorReceipt : rows[index - 1].emittedReceipt,
  acceptedPriorReceiptProducerSetSha256: index === 0 ? acceptedProducerSetSha256 : null,
  priorReceiptProducerType: index === 0 ? (acceptedProducerSetSha256 === null ? null : "EXACT_MEMBER_OF_ACCEPTED_PRIOR_RECEIPT_PRODUCER_SET") : `EXACT_${rows[index - 1].emittedReceipt}_PRODUCER_TYPE`,
})));
const installTransition = (from, to, emittedReceipt) => transition(
  from,
  to,
  emittedReceipt,
  ["CUSTODY_ACKED", "OBSERVATION_HOLD", "ROLLBACK_OR_RETAIN_DECIDED", "ZERO_VERIFIED", "TERMINAL_HOLD"].includes(to) ? "EVIDENCE_CUSTODIAN" : ["UNSTARTED", "PREARM_VALIDATED"].includes(from) ? "INSTALL_WATCHDOG" : "INSTALLER",
);
const crash = (point, afterPhase, owner = "CHECKPOINT_WATCHDOG") => Object.freeze({
  point, afterPhase, owner,
  preconditions: Object.freeze(["EXACT_AFTER_PHASE", "BOUND_PREIMAGE", "BOUND_IDENTITY_SET"]),
  priorReceipt: priorReceiptFor(owner, afterPhase),
  priorReceiptSha256: null,
  acceptedPriorReceiptProducerSetSha256: null,
  priorReceiptProducerType: `EXACT_${priorReceiptFor(owner, afterPhase)}_PRODUCER_TYPE`,
  priorReceiptInstanceBindings: Object.freeze(["EXACT_RECEIPT_BYTES_SHA256", "ATTEMPT_ID_EQUAL", "RUN_ID_EQUAL", "SESSION_ID_EQUAL", "WATCHDOG_CAS_STATE_EQUAL", "PRODUCER_TYPE_MEMBER_PROOF"]),
  emittedReceipt: `CRASH_${point}_ABORT_LATCH_RECEIPT`,
  emittedReceiptSha256: null,
  deadlineBinding: "EXTERNAL_TEARDOWN_DEADLINE_AND_TIMER_IDENTITY",
  identityBindings: Object.freeze(["ATTEMPT_RUN_SESSION", `AFTER_${afterPhase}_IDENTITY`, `CRASH_${point}_PREIMAGE`, "WATCHDOG_ABORT_CAS", "PHASE_RESOURCE_LEDGER", "RECOVERY_TARGET_IDENTITIES"]),
  recoveryTarget: "ABORT_LATCHED",
  unknownStateDecision: "HOLD",
  authority: "NONE",
});
const failures = (owner, ...phases) => Object.freeze(phases.map((phase) => Object.freeze({
  ...transition(phase, "ABORT_LATCHED", `ABORT_FROM_${phase}_RECEIPT`, owner),
  priorReceipt: priorReceiptFor(owner, phase),
})));
const recoveries = (owner, acceptedProducerSetSha256, ...phases) => chain(phases.slice(0, -1).map((phase, index) => {
  const to = phases[index + 1];
  return transition(phase, to, `RECOVERY_${phase}_TO_${to}_RECEIPT`, owner, "ABORT_LATCHED");
}), "SHA256_OF_EXACT_ACTUAL_ABORT_OR_CRASH_RECEIPT", acceptedProducerSetSha256);
const recoveryCrashes = (owner, acceptedProducerSetSha256, ...phases) => Object.freeze(phases.slice(0, -1).map((phase, index) => {
  const priorReceipt = index === 0 ? "SHA256_OF_EXACT_ACTUAL_ABORT_OR_CRASH_RECEIPT" : `RECOVERY_${phases[index - 1]}_TO_${phase}_RECEIPT`;
  return Object.freeze({
    ...crash(`RECOVERY_CRASH_AFTER_${phase}`, phase, owner),
    priorReceipt,
    acceptedPriorReceiptProducerSetSha256: index === 0 ? acceptedProducerSetSha256 : null,
    priorReceiptProducerType: index === 0 ? "EXACT_MEMBER_OF_ACCEPTED_PRIOR_RECEIPT_PRODUCER_SET" : `EXACT_${priorReceipt}_PRODUCER_TYPE`,
    emittedReceipt: `RECOVERY_CRASH_AFTER_${phase}_ABORT_LATCH_RECEIPT`,
  });
}));
const receiptSetSha256 = (rows) => createHash("sha256").update(Buffer.from(JSON.stringify(rows) + "\n", "utf8")).digest("hex");
const CHECKPOINT_ABORT_PRODUCERS = Object.freeze([
  ...Object.keys(CHECKPOINT_PRIOR_RECEIPT).slice(0, -1).map((phase) => `ABORT_FROM_${phase}_RECEIPT`),
  ...["AFTER_SOURCE_MANIFEST_REPLAY", "AFTER_PARENT_REPLAY", "AFTER_TARGET_ABSENCE", "AFTER_PRIVATE_INDEX_RESERVE", "AFTER_BLOB_WRITE", "AFTER_INDEX_POPULATE", "AFTER_TREE_WRITE", "AFTER_COMMIT_WRITE", "AFTER_COMMIT_REOPEN", "AFTER_REF_CAS", "AFTER_WORKTREE_ATTACH", "AFTER_WORKTREE_REOPEN"].map((point) => `CRASH_${point}_ABORT_LATCH_RECEIPT`),
  ...["ABORT_LATCHED", "REF_AND_WORKTREE_IDENTITY_CHECKED", "REMOVE_ONLY_NEW_EXACT_TARGETS_OR_RETAIN_RECOVERABLY", "TEMP_INDEX_REMOVED", "UNREFERENCED_CANONICAL_OBJECTS_RETAINED_NO_PRUNE", "SOURCE_PRESERVATION_REPLAYED"].map((phase) => `RECOVERY_CRASH_AFTER_${phase}_ABORT_LATCH_RECEIPT`),
]);
const INSTALL_ABORT_PRODUCERS = Object.freeze([
  ...Object.keys(INSTALL_PRIOR_RECEIPT).slice(0, -1).map((phase) => `ABORT_FROM_${phase}_RECEIPT`),
  ...["AFTER_PREARM_VALIDATED", "AFTER_ATTEMPT_RESERVED", "BEFORE_TEMP_CREATE", "AFTER_TEMP_CREATE", "AFTER_FILE_WRITE", "AFTER_FILE_FSYNC", "AFTER_IDENTITY_REPLAY", "AFTER_RENAME", "AFTER_PARENT_FSYNC", "AFTER_REOPEN", "AFTER_CUSTODY_ACK", "AFTER_OBSERVATION_HOLD", "AFTER_ROLLBACK_OR_RETAIN_DECIDED", "AFTER_ZERO_VERIFIED"].map((point) => `CRASH_${point}_ABORT_LATCH_RECEIPT`),
  ...["ABORT_LATCHED", "IDENTITY_LED_CLEANUP", "PARENT_FSYNCED_AFTER_CLEANUP", "RECOVERY_ZERO_VERIFIED"].map((phase) => `RECOVERY_CRASH_AFTER_${phase}_ABORT_LATCH_RECEIPT`),
]);

const externalToolIdentity = (role, family) => Object.freeze({
  role, family, path: null, sha256: null, byteLength: null, version: null, mode: null,
  uid: null, gid: null, dev: null, ino: null, mountId: null, nlink: null,
  handleSha256: null, openFileDescriptionSha256: null, closureManifestSha256: null,
  closureManifestByteLength: null, requiredExecutableType: "REGULAR_ROOT_OWNED_NONWRITABLE",
  sameHandleReplayRequired: true,
});

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function assertPlain(value, label = "$", seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError(label + " has an unsafe number");
    return;
  }
  if (typeof value !== "object" || utilTypes.isProxy(value) || seen.has(value)) throw new TypeError(label + " is not plain acyclic data");
  seen.add(value);
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError(label + " is sparse or decorated");
    for (let index = 0; index < value.length; index += 1) assertPlain(value[index], `${label}[${index}]`, seen);
    return;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + " has a foreign or null prototype");
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string") || Reflect.ownKeys(value).length !== Object.keys(value).length) throw new TypeError(label + " has hidden keys");
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!("value" in descriptor) || !descriptor.enumerable) throw new TypeError(`${label}.${key} is not data`);
    assertPlain(descriptor.value, `${label}.${key}`, seen);
  }
}

const truth = Object.freeze({
  sourceDesignPresent: true,
  checkpointCreated: false,
  gitCommitCreated: false,
  compiled: false,
  linked: false,
  installed: false,
  launched: false,
  runtimeObserved: false,
  packageExecuted: false,
  receiptPresent: false,
  toolchainAccepted: false,
  k44Accepted: false,
  publicDevnet: false,
  gate8Go: false,
  releasePermitted: false,
  mainnetPermitted: false,
  decision: "HOLD",
  authority: "NONE",
});

export const BPS06_SOURCE_DESIGN = deepFreeze({
  schema: BPS06_SCHEMA,
  status: BPS06_STATUS,
  purpose: "FREEZE_CHECKPOINT_COMPILE_INSTALL_DESIGN_WITHOUT_PERFORMING_ANY_ACTION",
  taskBoundary: {
    taskId: "BPS06",
    priority: 0,
    exactNewPathCount: 3,
    exactPaths: [...BPS06_PATHS],
    sourceDesignOnly: true,
    existingPathMutationPermitted: false,
    gitMutationPermitted: false,
    compilePermitted: false,
    installPermitted: false,
    processLaunchPermitted: false,
    hostProbePermitted: false,
    networkOrRpcPermitted: false,
  },
  frozenBindings: {
    bps05: acceptedManifest(BPS05_MANIFEST.sha256, BPS05_MANIFEST.byteLength, BPS05_MANIFEST.pathCount, BPS05_MANIFEST.payloadByteLength, [
      row(BPS05_PATHS[0], "4c713372316253ed799ab3a653dc1e2878d0bc83dd86d232a5a8b7ad7bbb9279", 39234),
      row(BPS05_PATHS[1], "1e753e0bb6ca3384dd0011617e2e8dbd6e4654dde891a59f4e62a64554663aad", 39344),
      row(BPS05_PATHS[2], "033cdb7955beb1e0362ad2108e4fc730aa1c11fc02adb2ad21b547d614c68e3b", 29493),
      row(BPS05_PATHS[3], "3ff0cad0c63b992978fcf459259fbbf4e0001f2b387800940d52b1ae4c2af83f", 370267),
      row(BPS05_PATHS[4], "6d993e2bf3ae0e1db6bc46ab8eb784fff97164e60cf43dad255e4cfbfd0668db", 41687),
      row(BPS05_PATHS[5], "2b0b370f45e1279d689f25798086c5e05e326a0d80f008d988d29abcc576f0d4", 180737),
    ], "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_SOURCE_REVIEW_ACCEPTED"),
    bpc00: {
      commit: "11572110330c4b22aa89d629065574e567e9fea8",
      rawCommitSha256: "61ce1f82634a4ea41f433410d3437dbe94d37aee78e0692b79e959d3deee1c3f",
      rawCommitByteLength: 257,
      soleParent: "b1c65482aebb31395a763707b02224c38aa2da96",
      tree: "22741ccba22f8f16663c745c0496d5c0be97d534",
      rawSevenAdditionDeltaSha256: "1be0fac74e365d480a2b83ac7452d9a399374b0ff5e0ec68b7c9ac37064ea235",
      rawSevenAdditionDeltaByteLength: 1411,
      rawSevenAdditionCount: 7,
      packageManifestSha256: "383960b7b04fd4c3afe66b27fa1ce8de74a870ce18f15d37a8069a5a0414b9d5",
      packageManifestByteLength: 1334,
      packagePathCount: 7,
      packagePayloadByteLength: 123908,
      reviewOutcome: "POST_CHECKPOINT_TOOLCHAIN_K44_OBSERVER_FRESH_SEVEN_PATH_PACKAGE_CHECKPOINT_REVIEW_ACCEPTED",
    },
    predecessors: {
      bpo00: acceptedManifest("395d97b87e2faaf91ece3845ecd26370f1fcae2b5ddcffab1f3a543c6c9c08f9", 521, 3, 37833, [
        row("projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-observer-source-design.v1.schema.json", "75501ad2821d5c869d1a805ecb4764705069d9ee452f6438cab1febd7da9ecad", 8182),
        row("projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs", "1a33cf1ca99a209abccabb1abc66ea7cb7f683b80d17201abdbc207bb8a6bcfe", 13834),
        row("projects/star-ascent/site/tests/iat-b3-post-checkpoint-observer-source-design-contract.test.mjs", "85e400f30981cf433c7dc0c95b60d0018e82aaae62f208b5d48643804545035d", 15817),
      ], "POST_CHECKPOINT_TOOLCHAIN_K44_OBSERVER_SOURCE_DESIGN_REVIEW_ACCEPTED"),
      bps00: acceptedManifest("83a99ef694d4e1c7e6b364a0a768999cc73fd3911fea23ea6347ba5cfa7b1c8a", 607, 3, 403564, [
        row("projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-source-design.v1.schema.json", "c2dfd01c87e79596ab0af2dbbd163746a9e9b34dbf99738681ddb2ab2752ebcb", 275828),
        row("projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-source-design-contract.mjs", "207ac05c0b76ce016a539949aedf2c806f209e503e700e4a3d6f5b61b03a24b0", 65666),
        row("projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-source-design-contract.test.mjs", "6fc164084e980925a252f7b0a9fa8798ce1c20449e00388894b2848a2d729e37", 62070),
      ], "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_SOURCE_DESIGN_REVIEW_ACCEPTED"),
      bps02: acceptedManifest("4bd831835fdd0244c1331d1af3b841dc154fc7e8cecd2ca53f6d65deb7cf47d6", 677, 3, 93192, [
        row("projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-native-fd-bridge-source-design.v1.schema.json", "3d94aa812c53d9d8f918b3e0fd635096c828f59546920a449f74490c61de7db9", 39361),
        row("projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-native-fd-bridge-source-design-contract.mjs", "dc51bcb036ca17dbef8dcbfbd02eef357356f01b013036abf84df1499949aaa8", 27726),
        row("projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-native-fd-bridge-source-design-contract.test.mjs", "892a5c787158289d4c35764781075cef94bd116f355be0866629449c2bf211f1", 26105),
      ], "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_FD_BRIDGE_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED"),
      bps04: acceptedManifest("82d1563897dcf41f7f8f168741563231d17422a5c42e36a2e5d6e05516949832", 679, 3, 244603, [
        row("projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bundle-fd-source-design.v1.schema.json", "0ea924ea3148176b89fa01684ccd6fcc39bbe11f47e8df977e8e17d76292fbe9", 118283),
        row("projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bundle-fd-source-design-contract.mjs", "e8932a1985386c453878c5d6e08b4517428031e9649ac8b6ea959be82b88a6ff", 67375),
        row("projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bundle-fd-source-design-contract.test.mjs", "cd3b0159db803b41b493c3ee2594cb6e5c437a846c990e71b994ad407ad9eab2", 58945),
      ], "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BUNDLE_TRANSPORT_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED"),
      bpi01: acceptedManifest("f99d7e5490cdec9f6d9a20e68bbd2bff911efd045993dc06f556f55691ae60ad", 811, 4, 86075, [
        row("projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt.v1.schema.json", "cc1771e3fb6736d1887fd2523db15d0170eb59a5a125477498d71ea8ebc8bfb0", 7776),
        row("projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs", "7f47b43f8104d3d542879a666866798cf90ada9578e5a6a7e84a61d6d8b5ba16", 35319),
        row("projects/star-ascent/site/scripts/observe-iat-b3-post-checkpoint-supervised-toolchain-k44.mjs", "da595f511a5b2004b7a1ae91ed4f6d37d5f98c071abcb2f07592807de7993fc6", 2691),
        row("projects/star-ascent/site/tests/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package.test.mjs", "c9f7dd501e87b3077e73947e22e274a36a9e2344ebc507042ab1e11c64ca1396", 40289),
      ], "POST_CHECKPOINT_TOOLCHAIN_K44_OBSERVER_FRESH_SEVEN_PATH_PACKAGE_REVIEW_ACCEPTED"),
    },
    rejectedHistory: [
      { taskId: "BPI00", status: "BLOCKED_GATE", outcome: null, acceptedOrExecutable: false },
      { taskId: "BPS01", status: "BLOCKED_GATE", outcome: null, acceptedOrExecutable: false },
      { taskId: "BPS03", status: "BLOCKED_GATE", outcome: null, acceptedOrExecutable: false },
    ],
  },
  checkpointDesign: {
    taskId: "BPC01",
    parentCommit: "11572110330c4b22aa89d629065574e567e9fea8",
    exactAdditionCount: 9,
    canonicalRef: "refs/heads/codex/bpc01-package-bound-prelaunch-supervisor-checkpoint",
    canonicalWorktree: "C:\\Users\\A\\Documents\\Codex\\2026-08-13\\can-you-take-over-b3-architecture-3\\work\\iat-b3-bpc01-package-bound-prelaunch-supervisor-clean",
    exactAdditionPaths: [...NINE_PATHS_RAW_UTF8_SORTED],
    pathOrdering: "RAW_UTF8_BYTE_ASCENDING_GLOBAL",
    phases: ["UNSTARTED", "SOURCE_MANIFEST_REPLAYED", "PARENT_REPLAYED", "TARGETS_ABSENT", "TEMP_INDEX_RESERVED", "NINE_BLOBS_WRITTEN_TO_CANONICAL_ODB_NO_FILTER", "TEMP_INDEX_POPULATED", "TREE_WRITTEN_TO_CANONICAL_ODB", "COMMIT_WRITTEN_UNSIGNED_TO_CANONICAL_ODB", "COMMIT_REOPENED_FROM_CANONICAL_ODB", "REF_CAS_CREATED", "WORKTREE_ATTACHED", "WORKTREE_REOPENED_CLEAN", "CHECKPOINT_FROZEN_HOLD"],
    transitions: chain([
      transition("UNSTARTED", "SOURCE_MANIFEST_REPLAYED", "SOURCE_MANIFEST_RECEIPT"), transition("SOURCE_MANIFEST_REPLAYED", "PARENT_REPLAYED", "PARENT_OBJECT_RECEIPT"), transition("PARENT_REPLAYED", "TARGETS_ABSENT", "ABSENCE_RECEIPT"), transition("TARGETS_ABSENT", "TEMP_INDEX_RESERVED", "PRIVATE_INDEX_IDENTITY"), transition("TEMP_INDEX_RESERVED", "NINE_BLOBS_WRITTEN_TO_CANONICAL_ODB_NO_FILTER", "NINE_BLOB_SET_RECEIPT"), transition("NINE_BLOBS_WRITTEN_TO_CANONICAL_ODB_NO_FILTER", "TEMP_INDEX_POPULATED", "CACHEINFO_RECEIPT"), transition("TEMP_INDEX_POPULATED", "TREE_WRITTEN_TO_CANONICAL_ODB", "TREE_RECEIPT"), transition("TREE_WRITTEN_TO_CANONICAL_ODB", "COMMIT_WRITTEN_UNSIGNED_TO_CANONICAL_ODB", "RAW_COMMIT_RECEIPT"), transition("COMMIT_WRITTEN_UNSIGNED_TO_CANONICAL_ODB", "COMMIT_REOPENED_FROM_CANONICAL_ODB", "CANONICAL_ODB_REOPEN_RECEIPT"), transition("COMMIT_REOPENED_FROM_CANONICAL_ODB", "REF_CAS_CREATED", "ZERO_TO_COMMIT_REF_CAS_RECEIPT"), transition("REF_CAS_CREATED", "WORKTREE_ATTACHED", "WORKTREE_ADMIN_RECEIPT"), transition("WORKTREE_ATTACHED", "WORKTREE_REOPENED_CLEAN", "CLEAN_REOPEN_RECEIPT"), transition("WORKTREE_REOPENED_CLEAN", "CHECKPOINT_FROZEN_HOLD", "TERMINAL_HOLD_RECEIPT"),
    ]),
    failurePhases: ["ABORT_LATCHED", "REF_AND_WORKTREE_IDENTITY_CHECKED", "REMOVE_ONLY_NEW_EXACT_TARGETS_OR_RETAIN_RECOVERABLY", "TEMP_INDEX_REMOVED", "UNREFERENCED_CANONICAL_OBJECTS_RETAINED_NO_PRUNE", "SOURCE_PRESERVATION_REPLAYED", "TERMINAL_HOLD"],
    recoveryEntryAcceptedProducerReceipts: [...CHECKPOINT_ABORT_PRODUCERS],
    recoveryEntryAcceptedProducerSetSha256: receiptSetSha256(CHECKPOINT_ABORT_PRODUCERS),
    failureTransitions: failures("CHECKPOINT_CUSTODIAN", "UNSTARTED", "SOURCE_MANIFEST_REPLAYED", "PARENT_REPLAYED", "TARGETS_ABSENT", "TEMP_INDEX_RESERVED", "NINE_BLOBS_WRITTEN_TO_CANONICAL_ODB_NO_FILTER", "TEMP_INDEX_POPULATED", "TREE_WRITTEN_TO_CANONICAL_ODB", "COMMIT_WRITTEN_UNSIGNED_TO_CANONICAL_ODB", "COMMIT_REOPENED_FROM_CANONICAL_ODB", "REF_CAS_CREATED", "WORKTREE_ATTACHED", "WORKTREE_REOPENED_CLEAN"),
    recoveryTransitions: recoveries("CHECKPOINT_CUSTODIAN", receiptSetSha256(CHECKPOINT_ABORT_PRODUCERS), "ABORT_LATCHED", "REF_AND_WORKTREE_IDENTITY_CHECKED", "REMOVE_ONLY_NEW_EXACT_TARGETS_OR_RETAIN_RECOVERABLY", "TEMP_INDEX_REMOVED", "UNREFERENCED_CANONICAL_OBJECTS_RETAINED_NO_PRUNE", "SOURCE_PRESERVATION_REPLAYED", "TERMINAL_HOLD"),
    recoveryCrashTable: recoveryCrashes("CHECKPOINT_CUSTODIAN", receiptSetSha256(CHECKPOINT_ABORT_PRODUCERS), "ABORT_LATCHED", "REF_AND_WORKTREE_IDENTITY_CHECKED", "REMOVE_ONLY_NEW_EXACT_TARGETS_OR_RETAIN_RECOVERABLY", "TEMP_INDEX_REMOVED", "UNREFERENCED_CANONICAL_OBJECTS_RETAINED_NO_PRUNE", "SOURCE_PRESERVATION_REPLAYED", "TERMINAL_HOLD"),
    changedParentEntryCount: 0,
    removedParentEntryCount: 0,
    modes: "100644_ONLY",
    commitShape: "ONE_UNSIGNED_SOLE_PARENT_LOCAL_COMMIT",
    plumbing: "HASH_OBJECT_NO_FILTER_PLUS_TEMPORARY_INDEX_AND_COMMIT_TREE",
    gitEnvironment: { privateIndexRequired: true, canonicalObjectDatabaseRawWritesRequired: true, privateObjectStagingForbidden: true, canonicalObjectCollisionRequiresExactByteEquality: true, canonicalObjectReopenBeforeRefCasRequired: true, unreferencedObjectPruningPermitted: false, optionalLocks: "0", hooksDisabled: true, signingDisabled: true, editorPagerMaintenanceDisabled: true, replaceRefsGraftsShallowAlternatesForbidden: true },
    commitMetadata: { author: null, committer: null, epoch: null, timezone: null, messageBytesSha256: null, extraHeadersPermitted: false },
    refCasExpectedOld: "ZERO_OID_ABSENT",
    rawDeltaCommand: "git diff-tree --no-commit-id --raw -r -z --no-abbrev PARENT COMMIT",
    inheritedBpc00SevenMustRemainByteAndModeEqual: true,
    transitionReceiptRequired: true,
    crashRecoveryPolicy: "BEFORE_REF_CAS_REMOVE_ONLY_PRIVATE_INDEX_AND_RETAIN_UNREFERENCED_OBJECTS_NO_PRUNE;AFTER_REF_CAS_FINISH_OR_RETAIN_EXACT_REF;AFTER_WORKTREE_ATTACH_REMOVE_ONLY_IF_EXACT_CLEAN_IDENTITY_OTHERWISE_RETAIN",
    preservationReplay: ["SOURCE_HEAD_TREE_INDEX_STATUS_AND_CONTENT", "BPC00_REF_WORKTREE_COMMIT", "ALL_PREEXISTING_REFS_WORKTREES_AND_OBJECTS"],
    crashTable: [
      crash("AFTER_SOURCE_MANIFEST_REPLAY", "SOURCE_MANIFEST_REPLAYED"), crash("AFTER_PARENT_REPLAY", "PARENT_REPLAYED"), crash("AFTER_TARGET_ABSENCE", "TARGETS_ABSENT"), crash("AFTER_PRIVATE_INDEX_RESERVE", "TEMP_INDEX_RESERVED"), crash("AFTER_BLOB_WRITE", "NINE_BLOBS_WRITTEN_TO_CANONICAL_ODB_NO_FILTER"), crash("AFTER_INDEX_POPULATE", "TEMP_INDEX_POPULATED"), crash("AFTER_TREE_WRITE", "TREE_WRITTEN_TO_CANONICAL_ODB"), crash("AFTER_COMMIT_WRITE", "COMMIT_WRITTEN_UNSIGNED_TO_CANONICAL_ODB"), crash("AFTER_COMMIT_REOPEN", "COMMIT_REOPENED_FROM_CANONICAL_ODB"), crash("AFTER_REF_CAS", "REF_CAS_CREATED"), crash("AFTER_WORKTREE_ATTACH", "WORKTREE_ATTACHED"), crash("AFTER_WORKTREE_REOPEN", "WORKTREE_REOPENED_CLEAN"),
    ],
    unknownStatePolicy: "HOLD_NO_FORCE_NO_PRUNE_NO_RESET_NO_CLEAN",
    normalGitAddPermitted: false,
    lfsSmudgeOrCleanPermitted: false,
    symlinkReparseGitlinkPermitted: false,
    isolatedWorktreeRequired: true,
    cleanWorktreeRequired: true,
    oneLocalRefRequired: true,
    upstreamPermitted: false,
    pushPermitted: false,
    actualCommit: null,
    actualTree: null,
    actualDelta: null,
    actualRefTip: null,
    actualIndexIdentity: null,
    actualWorktreeAdminIdentity: null,
    actualReceipt: null,
  },
  compileDesign: {
    phase: "AFTER_BPC01R_ONLY",
    inputCommit: null,
    inputCommitCallerSelectable: false,
    toolchainRequirement: {
      schema: "iat-b3-external-checkpoint-compile-install-toolchain-manifest/v1",
      sourceAuthority: "EXTERNAL_DIRECT_OBSERVER_ONLY",
      selectedManifest: null,
      compiler: externalToolIdentity("COMPILER", "CLANG_C17"),
      linker: externalToolIdentity("LINKER", "LLD"),
      archiver: externalToolIdentity("ARCHIVER", "LLVM_AR"),
      sysroot: { rootPath: null, rootIdentity: null, manifestSha256: null, manifestByteLength: null, entryCount: null, payloadByteLength: null, entries: null, noSymlinkDeviceGitlink: true, readOnly: true },
      staticNode: { fd: null, path: null, sha256: null, byteLength: null, dev: null, ino: null, mountId: null, uid: null, gid: null, mode: null, nlink: null, handleSha256: null, openFileDescriptionSha256: null, version: "v24.19.0", elfClass: "ELF64_LE_X86_64_ET_EXEC", ptInterpAbsent: true, ptDynamicAbsent: true, dtNeededAbsent: true, startupAuxiliaryFiles: [], inspectorCompiledOut: true, singleThreaded: true, nodeExecutableMustEqualLaunchNodeBinary: true, sameHandleReplayRequired: true, startupClosureSha256: null, startupClosureByteLength: null, versionReceiptSha256: null, startupSyscallReceiptSha256: null, startupSyscallAllowlistSha256: null, receiptFileIdentity: null },
      launchContext: { argv: null, environment: null, cwd: null, cwdIdentity: null, sourceDateEpoch: null, locale: null, timezone: null, umask: null, targetTriple: null, byteEqualReceiptRequired: true },
      accepted: false,
    },
    deterministicBuild: { independentAttemptCount: 2, exactArgvDigest: null, exactEnvironmentDigest: null, objectMapSha256: null, linkMapSha256: null, outputSha256: null, diagnosticsSha256: null, outputsMustBeByteEqual: true },
    requiredArgvPolicy: { exactTargetTripleRequired: true, exactSysrootRequired: true, exactInputOrderRequired: true, exactOutputAndMapPathsRequired: true, responseFilesForbidden: true },
    requiredEnvironmentPolicy: { exactKeyAllowlistRequired: true, sourceDateEpochRequired: true, localeRequired: true, timezoneRequired: true, umaskRequired: true, cwdIdentityRequired: true },
    network: "NONE",
    dependencyPull: "NEVER",
    responseFilesPermitted: false,
    pluginsPermitted: false,
    loaderOrPreloadPermitted: false,
    outputBeforeReview: "PRIVATE_STAGING_ONLY",
    outputIdentityRequiresTwoIndependentReplays: true,
    actualCompiler: null,
    actualOutputSha256: null,
    actualDiagnosticsSha256: null,
  },
  installDesign: {
    phase: "AFTER_SEPARATE_COMPILE_REVIEW_ONLY",
    sourceArtifactSameObjectReplayRequired: true,
    rootOwnedDestinationRequired: true,
    destinationMode: "0550",
    parentMode: "0555_OR_0755_ROOT_OWNED_NONWRITABLE_BY_RUNTIME_PRINCIPALS",
    temporaryNameCreation: "O_EXCL_BENEATH_VERIFIED_PARENT",
    attemptId: null,
    runId: null,
    sessionId: null,
    sourceArtifactIdentity: null,
    destinationParentIdentity: null,
    temporaryIdentity: null,
    finalGenerationIdentity: null,
    phases: ["UNSTARTED", "PREARM_VALIDATED", "ATTEMPT_RESERVED", "PARENT_REPLAYED", "TEMP_CREATED", "BYTES_WRITTEN", "TEMP_FSYNCED", "IDENTITY_REPLAYED", "PUBLISHED_NOREPLACE", "PARENT_FSYNCED", "FINAL_REOPENED_SAME_OBJECT", "CUSTODY_ACKED", "OBSERVATION_HOLD", "ROLLBACK_OR_RETAIN_DECIDED", "ZERO_VERIFIED", "TERMINAL_HOLD"],
    transitions: chain([
      installTransition("UNSTARTED", "PREARM_VALIDATED", "PREARM_RECEIPT"), installTransition("PREARM_VALIDATED", "ATTEMPT_RESERVED", "CAS_RESERVATION_RECEIPT"), installTransition("ATTEMPT_RESERVED", "PARENT_REPLAYED", "PARENT_IDENTITY_RECEIPT"), installTransition("PARENT_REPLAYED", "TEMP_CREATED", "O_EXCL_RECEIPT"), installTransition("TEMP_CREATED", "BYTES_WRITTEN", "BOUNDED_WRITE_LEDGER"), installTransition("BYTES_WRITTEN", "TEMP_FSYNCED", "FILE_FSYNC_RECEIPT"), installTransition("TEMP_FSYNCED", "IDENTITY_REPLAYED", "SAME_OBJECT_RECEIPT"), installTransition("IDENTITY_REPLAYED", "PUBLISHED_NOREPLACE", "RENAME_NOREPLACE_CAS_RECEIPT"), installTransition("PUBLISHED_NOREPLACE", "PARENT_FSYNCED", "PARENT_FSYNC_RECEIPT"), installTransition("PARENT_FSYNCED", "FINAL_REOPENED_SAME_OBJECT", "FINAL_REOPEN_RECEIPT"), installTransition("FINAL_REOPENED_SAME_OBJECT", "CUSTODY_ACKED", "CUSTODY_ACK"), installTransition("CUSTODY_ACKED", "OBSERVATION_HOLD", "OBSERVATION_HOLD_RECEIPT"), installTransition("OBSERVATION_HOLD", "ROLLBACK_OR_RETAIN_DECIDED", "CUSTODIAN_DECISION_RECEIPT"), installTransition("ROLLBACK_OR_RETAIN_DECIDED", "ZERO_VERIFIED", "DIRECT_ZERO_RECEIPT"), installTransition("ZERO_VERIFIED", "TERMINAL_HOLD", "TERMINAL_HOLD_RECEIPT"),
    ]),
    failurePhases: ["ABORT_LATCHED", "IDENTITY_LED_CLEANUP", "PARENT_FSYNCED_AFTER_CLEANUP", "RECOVERY_ZERO_VERIFIED", "TERMINAL_HOLD"],
    recoveryEntryAcceptedProducerReceipts: [...INSTALL_ABORT_PRODUCERS],
    recoveryEntryAcceptedProducerSetSha256: receiptSetSha256(INSTALL_ABORT_PRODUCERS),
    failureTransitions: Object.freeze([
      ...failures("INSTALL_WATCHDOG", "UNSTARTED", "PREARM_VALIDATED", "ATTEMPT_RESERVED", "PARENT_REPLAYED", "TEMP_CREATED", "BYTES_WRITTEN", "TEMP_FSYNCED", "IDENTITY_REPLAYED", "PUBLISHED_NOREPLACE", "PARENT_FSYNCED", "FINAL_REOPENED_SAME_OBJECT"),
      ...failures("EVIDENCE_CUSTODIAN", "CUSTODY_ACKED", "OBSERVATION_HOLD", "ROLLBACK_OR_RETAIN_DECIDED", "ZERO_VERIFIED"),
    ]),
    recoveryTransitions: recoveries("EVIDENCE_CUSTODIAN", receiptSetSha256(INSTALL_ABORT_PRODUCERS), "ABORT_LATCHED", "IDENTITY_LED_CLEANUP", "PARENT_FSYNCED_AFTER_CLEANUP", "RECOVERY_ZERO_VERIFIED", "TERMINAL_HOLD"),
    recoveryCrashTable: recoveryCrashes("EVIDENCE_CUSTODIAN", receiptSetSha256(INSTALL_ABORT_PRODUCERS), "ABORT_LATCHED", "IDENTITY_LED_CLEANUP", "PARENT_FSYNCED_AFTER_CLEANUP", "RECOVERY_ZERO_VERIFIED", "TERMINAL_HOLD"),
    casSuccessStates: ["RESERVED", "TEMP_BOUND", "PUBLISHED_ONCE", "CUSTODY_ACCEPTED", "RETAINED_HOLD"],
    casAbortStates: ["RESERVED", "TEMP_BOUND", "PUBLISHED_ONCE", "ABORTED", "REMOVED", "ZERO"],
    casOwner: "WATCHDOG_AND_EVIDENCE_CUSTODIAN_NOT_INSTALLER",
    casKeyFields: ["attemptId", "runId", "sessionId", "sourceIdentity", "parentIdentity", "finalPath", "expectedSha256", "expectedByteLength", "expectedMode", "expectedOwner", "deadline", "preParentSnapshotSha256"],
    resolutionFlags: "RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS",
    temporaryOpenFlags: "O_CREAT|O_EXCL|O_NOFOLLOW",
    filePolicy: "MODE_0550_UID0_GID0_NLINK1_NO_SPECIAL_BITS_XATTRS_ACLS_OR_HARDLINKS",
    sameMountPublicationRequired: true,
    boundedStreamingWriteRequired: true,
    publication: "FSYNC_FILE_THEN_RENAME_NOREPLACE_THEN_FSYNC_PARENT_THEN_REOPEN_SAME_OBJECT",
    overwritePermitted: false,
    pathnameFallbackPermitted: false,
    custodyRoles: ["CHECKPOINT_COMPILER", "INSTALLER", "EVIDENCE_CUSTODIAN"],
    crashTable: [
      crash("AFTER_PREARM_VALIDATED", "PREARM_VALIDATED", "INSTALL_WATCHDOG"), crash("AFTER_ATTEMPT_RESERVED", "ATTEMPT_RESERVED", "INSTALL_WATCHDOG"), crash("BEFORE_TEMP_CREATE", "PARENT_REPLAYED", "INSTALL_WATCHDOG"), crash("AFTER_TEMP_CREATE", "TEMP_CREATED", "INSTALL_WATCHDOG"), crash("AFTER_FILE_WRITE", "BYTES_WRITTEN", "INSTALL_WATCHDOG"), crash("AFTER_FILE_FSYNC", "TEMP_FSYNCED", "INSTALL_WATCHDOG"), crash("AFTER_IDENTITY_REPLAY", "IDENTITY_REPLAYED", "INSTALL_WATCHDOG"), crash("AFTER_RENAME", "PUBLISHED_NOREPLACE", "INSTALL_WATCHDOG"), crash("AFTER_PARENT_FSYNC", "PARENT_FSYNCED", "INSTALL_WATCHDOG"), crash("AFTER_REOPEN", "FINAL_REOPENED_SAME_OBJECT", "INSTALL_WATCHDOG"), crash("AFTER_CUSTODY_ACK", "CUSTODY_ACKED", "EVIDENCE_CUSTODIAN"), crash("AFTER_OBSERVATION_HOLD", "OBSERVATION_HOLD", "EVIDENCE_CUSTODIAN"), crash("AFTER_ROLLBACK_OR_RETAIN_DECIDED", "ROLLBACK_OR_RETAIN_DECIDED", "EVIDENCE_CUSTODIAN"), crash("AFTER_ZERO_VERIFIED", "ZERO_VERIFIED", "EVIDENCE_CUSTODIAN"),
    ],
    rollback: "IDENTITY_LED_REMOVE_AND_PARENT_FSYNC_WITH_DURABLE_ABSENCE_RECEIPT",
    postCustodyDeletionAuthority: "EVIDENCE_CUSTODIAN_ONLY_AFTER_SEPARATE_AUTHENTICATED_DECISION",
    installerDeletionAfterCustodyAckPermitted: false,
    unknownStateOrIdentityMismatchPolicy: "HOLD_NO_BLIND_PATH_DELETION_EXTERNALLY_SUPERVISED_CLEANUP",
    identityLedger: { attemptId: null, runId: null, sessionId: null, sourceArtifact: null, installedRoot: null, parentDir: null, tempFile: null, finalFile: null, sourceReceiptSha256: null, preParentSnapshotSha256: null, postParentSnapshotSha256: null, writeLedgerSha256: null, publicationCasDigest: null, rollbackCasDigest: null, zeroLedgerSha256: null },
    custodianAckRequiredFields: ["schema", "attemptId", "runId", "sessionId", "sourceIdentity", "finalIdentity", "parentPreSnapshot", "parentPostSnapshot", "sameObjectProof", "fileFsyncReceipt", "parentFsyncReceipt", "publicationCasReceipt", "custodyPrincipal", "bootId", "timeWindow", "decision", "authority"],
    zeroProofRequiredFields: ["parentSameObjectDoubleSnapshot", "noAttemptTempTombstoneOrBackup", "noExtraHardlinks", "allInstallFdsClosed", "noHelperProcessMountCacheResidue", "watchdogZeroTranscript", "custodianCleanupAck"],
    reopenSameObjectRequired: true,
    zeroTemporaryEntriesRequired: true,
    launchAfterInstallPermitted: false,
    actualInstalledPath: null,
    actualInstalledIdentity: null,
    actualRollbackReceipt: null,
    actualCustodianReceipt: null,
    actualZeroReceipt: null,
  },
  truthBoundary: truth,
  hostileCases: [
    "BPS05_MANIFEST_OR_REVIEW_OUTCOME_SUBSTITUTION",
    "BPC00_COMMIT_PARENT_TREE_RAW_DELTA_OR_PACKAGE_MANIFEST_SUBSTITUTION",
    "NINE_PATH_OMISSION_EXTRA_REORDER_MODE_OR_BYTE_SUBSTITUTION",
    "NORMAL_GIT_ADD_FILTER_LFS_SMUDGE_CLEAN_OR_ATTRIBUTES_ESCAPE",
    "SECOND_PARENT_SIGNED_COMMIT_UPSTREAM_REMOTE_REF_OR_PUSH",
    "COMPILER_LINKER_SYSROOT_NODE_STARTUP_OR_ENVIRONMENT_SUBSTITUTION",
    "RESPONSE_FILE_PLUGIN_PRELOAD_LOADER_NETWORK_OR_DEPENDENCY_PULL",
    "NONDETERMINISTIC_TIMESTAMP_BUILD_ID_PATH_OR_LOCALE_INPUT",
    "COMPILE_INSTALL_OR_PROCESS_EXECUTION_DURING_SOURCE_DESIGN",
    "OUTPUT_DIGEST_SELF_AUTHORSHIP_OR_SINGLE_REPLAY",
    "INSTALL_PARENT_OWNER_MODE_PATH_OR_MOUNT_ALIAS",
    "OVERWRITE_REPLACE_SYMLINK_REPARSE_OR_CROSS_DEVICE_PUBLICATION",
    "ACK_BEFORE_FILE_AND_PARENT_FSYNC_OR_REOPEN_SAME_OBJECT",
    "ROLLBACK_BY_PATH_INSTEAD_OF_IDENTITY_OR_TEMPORARY_ENTRY_RESIDUE",
    "RUNTIME_RECEIPT_TOOLCHAIN_K44_DEVNET_GATE8_RELEASE_OR_MAINNET_PROMOTION",
  ],
  stopBoundary: {
    afterBps06: "REQUIRE_BPS06R_EXACT_INDEPENDENT_REVIEW",
    afterBps06R: "ONLY_SEPARATELY_QUEUED_BPC01_MAY_CHECKPOINT",
    checkpointCompileInstallNowAuthorized: false,
    finalDecision: "HOLD",
  },
});

function exactSchema(value) {
  if (value === null) return { type: "null", const: null };
  if (Array.isArray(value)) return {
    type: "array",
    minItems: value.length,
    maxItems: value.length,
    prefixItems: value.map(exactSchema),
    items: false,
  };
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return {
      type: "object",
      additionalProperties: false,
      required: keys,
      properties: Object.fromEntries(keys.map((key) => [key, exactSchema(value[key])])),
    };
  }
  return { type: typeof value === "number" ? "integer" : typeof value, const: value };
}

export const BPS06_JSON_SCHEMA = deepFreeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://internal.invalid/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design.v1.schema.json",
  title: "IAT-B3 package-bound checkpoint, compile, and install source design",
  ...exactSchema(BPS06_SOURCE_DESIGN),
});

export const BPS06_CANONICAL_BYTES = Buffer.from(JSON.stringify(BPS06_SOURCE_DESIGN) + "\n", "utf8");
export const BPS06_CANONICAL_SHA256 = createHash("sha256").update(BPS06_CANONICAL_BYTES).digest("hex");

export function validateBps06SourceDesign(candidate) {
  assertPlain(candidate);
  const bytes = Buffer.from(JSON.stringify(candidate) + "\n", "utf8");
  if (bytes.length !== BPS06_CANONICAL_BYTES.length || !timingSafeEqual(bytes, BPS06_CANONICAL_BYTES)) throw new TypeError("BPS06 source design differs from the frozen canonical design");
  return BPS06_SOURCE_DESIGN;
}

export function createBps06SourceDesign() {
  return JSON.parse(BPS06_CANONICAL_BYTES.toString("utf8"));
}

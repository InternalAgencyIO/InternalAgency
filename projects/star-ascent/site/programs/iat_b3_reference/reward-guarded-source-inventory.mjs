import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

export const REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA =
  "iat-b3-reward-guarded-source-inventory/v1";
export const REWARD_GUARDED_SOURCE_INVENTORY_STATUS =
  "HOST_ONLY_NON_ACTIVATING_EXACT_SOURCE_ADAPTER_INVENTORY";
export const REWARD_GUARDED_SOURCE_INVENTORY_MAINNET_STATUS = "HOLD";

const AUDITOR_PATHS = new Set([
  "programs/iat_b3_reference/reward-guarded-artifact-inventory.mjs",
  "programs/iat_b3_reference/reward-guarded-build-provenance.mjs",
  "programs/iat_b3_reference/reward-guarded-build-reproducibility.mjs",
  "programs/iat_b3_reference/reward-guarded-source-inventory.mjs",
]);
const ENUMERATED_SOURCE_INVENTORIES = new WeakSet();
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".wrangler",
  "archive",
  "build",
  "dist",
  "docs",
  "node_modules",
  "playwright-report",
  "target",
  "test-results",
  "tests",
  "vendor",
]);
const SOURCE_EXTENSIONS = new Set([
  ".bash",
  ".bat",
  ".cjs",
  ".cmd",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ps1",
  ".py",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
]);
const JAVASCRIPT_SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const NATIVE_REWARD_TRANSCRIPT_PATH =
  "programs/iat_b3_economy/src/reward_allocator_transcript.rs";
const NATIVE_REWARD_RECOMPUTATION_PATH =
  "programs/iat_b3_economy/src/reward_capacity_recomputation.rs";
const NATIVE_REWARD_EXPORT_PATH = "programs/iat_b3_economy/src/lib.rs";
const NATIVE_REWARD_MODULE_PATHS = new Set([
  NATIVE_REWARD_RECOMPUTATION_PATH,
  NATIVE_REWARD_TRANSCRIPT_PATH,
]);
const NATIVE_REWARD_SURFACE_PATHS = new Set([
  NATIVE_REWARD_EXPORT_PATH,
  ...NATIVE_REWARD_MODULE_PATHS,
]);

// These hashes deliberately bind the source inventory to the exact guarded
// adapter implementations it audited. Updating one requires an explicit
// inventory update and review; this module does not independently review or
// authorize such an update.
const CRITICAL_SOURCE_SHA256 = Object.freeze({
  "programs/iat_b3_economy/src/reward_allocator_transcript.rs":
    "a9fab4007e1dc7fa24b0e2248ee6ace8cd0c904f7643c87c79311deb6942a99d",
  "programs/iat_b3_economy/src/reward_capacity_recomputation.rs":
    "7824650bd5f9d4a8acf5a632a445d82ef625c5163ee6bc600d178266eaa962ec",
  "programs/iat_b3_reference/provider-authenticated-envelope.mjs":
    "42b45111b527ecf4f570a77ad5ae977d9bf62ea8a0d6c6f9ed7f082b5bbc07b7",
  "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs":
    "e9c865940798d2f0b415176ce1d607abc0d16ac3c4048dea1cd53e4e61610008",
  "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs":
    "9140ffcf489dfd3b24a5e121214a92705c794d639934649dec8a9217a7468584",
  "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs":
    "a71ce36dc45103d02361ba956a4e2567de939d11664a09db329a8834651319ee",
  "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs":
    "7aeca55b1821fa632444f6d4485ab6d2f6ea809cc495fe4f6a9ac54e30074dd7",
  "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs":
    "746af3f0d8f77c7766b95abae66b78ce36af10b1c660625b1c9d7d3dba8e9385",
  "programs/iat_b3_reference/reward-consumer-gate.mjs":
    "7139c8d2a57d630ca59306730f16a5d6f979a06280422b69eee4978310918b4f",
  "programs/iat_b3_reference/reward-external-rollback-anchor.mjs":
    "9efb430f51f5f81caf413dce20e68f0d0b4a0090151b400fb28426f55af03c3e",
  "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs":
    "2857bcec8cfc46526e4aecc9796e65efdd73710101e766a816ad5e9a5c041a29",
  "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs":
    "e935fafcfd947822f9a75f54a08369d4c8b7336a11e6ba37e8a3904a4c1fc23f",
  "programs/iat_b3_reference/reward-persistence-cas.mjs":
    "5f1fe96e878a25029836697c7ae78264b9f7239ae154c695040710b191011099",
  "programs/iat_b3_reference/reward-persistence-checkpoint.mjs":
    "38c652179120d2d5e1bf084d8f2ae0fb169fec4b800359503270e0925e0380c4",
  "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs":
    "622bf21521daca38a8272252425c18354d64b1e380bc63a84469730118acc51a",
  "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs":
    "d09fd2e22838200f1952f61a3a5682bd79105ed734d01b05ec1272076e174268",
});

// Raw substring counts are intentional. Imports renamed with `as`, comments
// that attempt to waive the gate, and direct table-name use all require an
// explicit inventory update. A separate conservative lexical pass below also
// folds directly concatenated static string literals so split dynamic-import
// paths and split computed factory names cannot evade these exact markers.
const EXPECTED_MARKER_LOCATIONS = Object.freeze({
  decode_reward_allocator_batch: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 2,
    "programs/iat_b3_economy/src/reward_capacity_recomputation.rs": 2,
  }),
  decode_reward_allocator_receipt: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 2,
  }),
  encode_reward_allocator_batch: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 2,
  }),
  encode_reward_allocator_receipt: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 2,
  }),
  "mod reward_allocator_transcript": Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
  }),
  "pub use reward_allocator_transcript": Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
  }),
  REWARD_ALLOCATOR_TRANSCRIPT_MAINNET_STATUS: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 1,
  }),
  REWARD_ALLOCATOR_TRANSCRIPT_STATUS: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 1,
  }),
  REWARD_ALLOCATOR_TRANSCRIPT_TRUTH: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 1,
  }),
  reward_allocator_batch_sha256: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 2,
  }),
  validate_reward_allocator_transcript_binding: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_allocator_transcript.rs": 1,
    "programs/iat_b3_economy/src/reward_capacity_recomputation.rs": 2,
  }),
  "mod reward_capacity_recomputation": Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
  }),
  "pub use reward_capacity_recomputation": Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
  }),
  REWARD_CAPACITY_RECOMPUTATION_MAINNET_STATUS: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_capacity_recomputation.rs": 1,
  }),
  REWARD_CAPACITY_RECOMPUTATION_STATUS: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_capacity_recomputation.rs": 1,
  }),
  REWARD_CAPACITY_RECOMPUTATION_TRUTH: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_capacity_recomputation.rs": 1,
  }),
  verify_reward_capacity_allocation_recomputation: Object.freeze({
    "programs/iat_b3_economy/src/lib.rs": 1,
    "programs/iat_b3_economy/src/reward_capacity_recomputation.rs": 1,
  }),
  appendFinalizedRound: Object.freeze({
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 1,
  }),
  REWARD_CAS_STORE_ADAPTER: Object.freeze({
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 3,
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 2,
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 5,
  }),
  assertRewardConsumerPermit: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 2,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
    "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs": 2,
  }),
  consumePermit: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 4,
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs": 1,
  }),
  "commitRecoveryBundle(": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
  }),
  commitVerifiedBundle: Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
    "programs/iat_b3_reference/privacy-vault-recovery-sqlite.mjs": 1,
  }),
  "consumeSignedAnchor(": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
  }),
  consumeAnchoredLocalProjection: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
  }),
  consumeAnchoredMaterializedProjection: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
  }),
  consumeSignedAnchorReceipt: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 3,
    "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs": 1,
  }),
  createRewardWaterfallAuditSqlite: Object.freeze({
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 1,
  }),
  createProviderTrustBinding: Object.freeze({
    "programs/iat_b3_reference/provider-authenticated-envelope.mjs": 2,
  }),
  createPrivacyVaultRollbackAnchorRequest: Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 3,
    "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs": 1,
  }),
  createCheckpointGatedRewardPersistenceCas: Object.freeze({
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 1,
  }),
  createInMemoryRewardPersistenceCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
  }),
  createRewardAuthenticatedConsumerRuntime: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 3,
  }),
  createRewardAuthenticatedMaterializedConsumerRuntime: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 3,
  }),
  createSqliteRewardConsumerCursor: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
  }),
  createSqliteRewardMaterializedProjection: Object.freeze({
    "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs": 1,
  }),
  createSqliteRewardPersistenceCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 1,
  }),
  createSqliteRewardRollbackAnchorMirror: Object.freeze({
    "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs": 1,
  }),
  finalizeRewardCapacityRoundCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
  }),
  HOST_ONLY_NONACTIVATING_REPLAY_AUDIT: Object.freeze({
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 1,
  }),
  "iat-b3-reward-waterfall-audit-sqlite/v1": Object.freeze({
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 1,
  }),
  prepareRewardConsumerPermit: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 3,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
  }),
  recordPremiumUpgradeCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
  }),
  "provider-authenticated-envelope.mjs": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
    "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs": 1,
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
    "programs/iat_b3_reference/reward-external-rollback-anchor.mjs": 1,
    "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs": 1,
  }),
  "prepareAnchorRequest(": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
  }),
  "privacy-vault-authenticated-recovery-runtime.mjs": Object.freeze({}),
  "privacy-vault-external-rollback-anchor.mjs": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
  }),
  "privacy-vault-recovery-lifecycle.mjs": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
    "programs/iat_b3_reference/privacy-vault-recovery-sqlite.mjs": 1,
  }),
  "privacy-vault-recovery-sqlite.mjs": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
    "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs": 1,
  }),
  "reconcileCommittedRecoveryBundle(": Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 1,
  }),
  "reward-checkpoint-gated-cas.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
  }),
  "reward-allocator-proof-bundle.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 1,
  }),
  "reward-allocator-receipt-codec.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-allocator-proof-bundle.mjs": 1,
    "programs/iat_b3_reference/reward-capacity-waterfall.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-checkpoint.mjs": 1,
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 1,
    "scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs": 1,
    "scripts/validate-iat-b3-x-social-evidence-provider-readiness.mjs": 1,
  }),
  "reward-consumer-cursor-sqlite.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
  }),
  "reward-consumer-gate.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs": 1,
  }),
  "reward-external-rollback-anchor.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
    "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs": 1,
  }),
  "reward-materialized-projection-sqlite.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
  }),
  "reward-persistence-cas-sqlite.mjs": Object.freeze({}),
  "reward-persistence-cas.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
    "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-checkpoint.mjs": 1,
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 1,
  }),
  "reward-persistence-checkpoint.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 1,
    "scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs": 1,
    "scripts/validate-iat-b3-x-social-evidence-provider-readiness.mjs": 1,
  }),
  "reward-rollback-anchor-sqlite.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 1,
  }),
  "reward-waterfall-audit-sqlite.mjs": Object.freeze({}),
  REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS: Object.freeze({
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 8,
  }),
  reward_cas_: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 55,
  }),
  reward_consumer_cursor_history: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 5,
  }),
  reward_consumer_projection_events: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 4,
  }),
  reward_materialized_projection_: Object.freeze({
    "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs": 25,
  }),
  reward_rollback_anchor_: Object.freeze({
    "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs": 16,
  }),
  reward_waterfall_audit_: Object.freeze({
    "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs": 2,
  }),
  verifyProviderSignedEnvelope: Object.freeze({
    "programs/iat_b3_reference/provider-authenticated-envelope.mjs": 1,
    "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs": 2,
    "programs/iat_b3_reference/reward-external-rollback-anchor.mjs": 2,
  }),
  verifyPrivacyVaultExternalRollbackAnchor: Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 2,
    "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs": 1,
  }),
  verifyPrivacyVaultRecoveryBundle: Object.freeze({
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs": 2,
    "programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs": 1,
  }),
  verifyRewardExternalRollbackAnchor: Object.freeze({
    "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs": 3,
    "programs/iat_b3_reference/reward-external-rollback-anchor.mjs": 1,
  }),
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hasExactDataKeys(value, expected) {
  if (!value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return false;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !("value" in descriptor)
      || "get" in descriptor
      || "set" in descriptor) return false;
  }
  return keys.length === expected.length
    && [...keys].sort().every((key, index) => key === [...expected].sort()[index]);
}

function asCanonicalSourcePath(value) {
  if (typeof value !== "string"
    || value.length === 0
    || value.includes("\\")
    || value.startsWith("/")
    || value.endsWith("/")
    || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError("reward guarded source path must be canonical repository-relative POSIX");
  }
  return value;
}

function asSourceFile(value) {
  if (!hasExactDataKeys(value, ["path", "source"])) {
    throw new TypeError("reward guarded source descriptor must contain only path and source");
  }
  const path = asCanonicalSourcePath(value.path);
  if (typeof value.source !== "string") {
    throw new TypeError("reward guarded source content must be text");
  }
  return Object.freeze({ path, source: value.source });
}

function countOccurrences(source, marker) {
  let count = 0;
  let cursor = 0;
  while (cursor <= source.length - marker.length) {
    const next = source.indexOf(marker, cursor);
    if (next === -1) break;
    count += 1;
    cursor = next + marker.length;
  }
  return count;
}

const STATIC_SPLIT_MARKERS = Object.freeze(
  Object.keys(EXPECTED_MARKER_LOCATIONS).sort((left, right) => right.length - left.length),
);

function skipJavascriptTrivia(source, start) {
  let cursor = start;
  while (cursor < source.length) {
    if (/\s/u.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const newline = source.indexOf("\n", cursor + 2);
      return newline === -1 ? source.length : skipJavascriptTrivia(source, newline + 1);
    }
    if (source.startsWith("/*", cursor)) {
      const end = source.indexOf("*/", cursor + 2);
      return end === -1 ? source.length : skipJavascriptTrivia(source, end + 2);
    }
    break;
  }
  return cursor;
}

function decodeJavascriptEscape(source, slashIndex) {
  const escaped = source[slashIndex + 1];
  if (escaped === undefined) return null;
  if (/^[0-7]$/u.test(escaped)) {
    const maximumDigits = /^[0-3]$/u.test(escaped) ? 3 : 2;
    let digits = escaped;
    while (digits.length < maximumDigits && /^[0-7]$/u.test(source[slashIndex + 1 + digits.length] ?? "")) {
      digits += source[slashIndex + 1 + digits.length];
    }
    return {
      value: String.fromCodePoint(Number.parseInt(digits, 8)),
      end: slashIndex + 1 + digits.length,
    };
  }
  const simple = {
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "\\": "\\",
    "'": "'",
    '"': '"',
    "`": "`",
  };
  if (Object.hasOwn(simple, escaped)) {
    return { value: simple[escaped], end: slashIndex + 2 };
  }
  if (escaped === "\n") return { value: "", end: slashIndex + 2 };
  if (escaped === "\r") {
    return {
      value: "",
      end: source[slashIndex + 2] === "\n" ? slashIndex + 3 : slashIndex + 2,
    };
  }
  if (escaped === "x") {
    const digits = source.slice(slashIndex + 2, slashIndex + 4);
    if (!/^[0-9a-f]{2}$/iu.test(digits)) return null;
    return { value: String.fromCodePoint(Number.parseInt(digits, 16)), end: slashIndex + 4 };
  }
  if (escaped === "u" && source[slashIndex + 2] === "{") {
    const close = source.indexOf("}", slashIndex + 3);
    if (close === -1) return null;
    const digits = source.slice(slashIndex + 3, close);
    if (!/^[0-9a-f]{1,6}$/iu.test(digits)) return null;
    const codePoint = Number.parseInt(digits, 16);
    if (codePoint > 0x10ffff) return null;
    return { value: String.fromCodePoint(codePoint), end: close + 1 };
  }
  if (escaped === "u") {
    const digits = source.slice(slashIndex + 2, slashIndex + 6);
    if (!/^[0-9a-f]{4}$/iu.test(digits)) return null;
    return { value: String.fromCodePoint(Number.parseInt(digits, 16)), end: slashIndex + 6 };
  }
  return { value: escaped, end: slashIndex + 2 };
}

function readStaticJavascriptString(source, start) {
  const quote = source[start];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  let value = "";
  let cursor = start + 1;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === quote) return { value, end: cursor + 1 };
    if (quote === "`" && source.startsWith("${", cursor)) return null;
    if ((quote === '"' || quote === "'") && (character === "\n" || character === "\r")) {
      return null;
    }
    if (character === "\\") {
      const decoded = decodeJavascriptEscape(source, cursor);
      if (!decoded) return null;
      value += decoded.value;
      cursor = decoded.end;
      continue;
    }
    value += character;
    cursor += 1;
  }
  return null;
}

function readStaticJavascriptStringPrimary(source, start, depth) {
  const cursor = skipJavascriptTrivia(source, start);
  const literal = readStaticJavascriptString(source, cursor);
  if (literal) return { ...literal, literalCount: 1 };
  if (source[cursor] !== "(" || depth >= 32) return null;
  const inner = readStaticJavascriptStringExpression(source, cursor + 1, depth + 1);
  if (!inner) return null;
  const close = skipJavascriptTrivia(source, inner.end);
  if (source[close] !== ")") return null;
  return { value: inner.value, end: close + 1, literalCount: inner.literalCount };
}

function readStaticJavascriptStringExpression(source, start, depth = 0) {
  const first = readStaticJavascriptStringPrimary(source, start, depth);
  if (!first) return null;
  let value = first.value;
  let end = first.end;
  let literalCount = first.literalCount;
  while (true) {
    const operator = skipJavascriptTrivia(source, end);
    if (source[operator] !== "+") break;
    const next = readStaticJavascriptStringPrimary(source, operator + 1, depth);
    if (!next) break;
    value += next.value;
    literalCount += next.literalCount;
    end = next.end;
  }
  return { value, end, literalCount };
}

function sensitiveMarker(value) {
  return STATIC_SPLIT_MARKERS.find((candidate) => value.includes(candidate));
}

function readJavascriptIdentifier(source, start) {
  const isStart = (value) => /^[A-Za-z_$]$/u.test(value);
  const isPart = (value) => /^[A-Za-z0-9_$]$/u.test(value);
  let cursor = start;
  let value = "";
  let escaped = false;
  while (cursor < source.length) {
    let decoded;
    let end;
    if (source[cursor] === "\\" && source[cursor + 1] === "u") {
      const escape = decodeJavascriptEscape(source, cursor);
      if (!escape || [...escape.value].length !== 1) break;
      decoded = escape.value;
      end = escape.end;
      escaped = true;
    } else {
      decoded = source[cursor];
      end = cursor + 1;
    }
    if ((value.length === 0 ? isStart : isPart)(decoded)) {
      value += decoded;
      cursor = end;
      continue;
    }
    break;
  }
  if (value.length === 0) return null;
  return { value, end: cursor, escaped };
}

function assertNoEncodedStaticMarkers(file) {
  if (!JAVASCRIPT_SOURCE_EXTENSIONS.has(extname(file.path).toLowerCase())) return;
  for (let start = 0; start < file.source.length; start += 1) {
    if (!['"', "'", "`", "("].includes(file.source[start])) continue;
    const expression = readStaticJavascriptStringExpression(file.source, start);
    if (!expression) continue;
    const marker = sensitiveMarker(expression.value);
    const rawExpression = file.source.slice(start, expression.end);
    if (marker && !rawExpression.includes(marker)) {
      const kind = expression.literalCount > 1 ? "SPLIT" : "ESCAPED_LITERAL";
      throw new Error(`REWARD_GUARDED_SOURCE_${kind}_MARKER_FORBIDDEN:${file.path}:${marker}`);
    }
    start = Math.max(start, expression.end - 1);
  }
  for (let start = 0; start < file.source.length; start += 1) {
    const identifier = readJavascriptIdentifier(file.source, start);
    if (!identifier) continue;
    const rawIdentifier = file.source.slice(start, identifier.end);
    if (identifier.escaped) {
      const marker = sensitiveMarker(identifier.value);
      if (marker && !rawIdentifier.includes(marker)) {
        throw new Error(
          `REWARD_GUARDED_SOURCE_ESCAPED_IDENTIFIER_MARKER_FORBIDDEN:${file.path}:${marker}`,
        );
      }
    }
    start = Math.max(start, identifier.end - 1);
  }
}

function canonicalLocationRecord(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => (
    left.localeCompare(right, "en")
  )));
}

function sameLocationRecord(left, right) {
  return JSON.stringify(canonicalLocationRecord(left))
    === JSON.stringify(canonicalLocationRecord(right));
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

/**
 * Audit a supplied source set. This lower-level function is useful for hostile
 * regression fixtures, but cannot prove that its caller supplied the complete
 * repository. Use assertRewardGuardedRepositorySourceInventory for the
 * enumerated repository gate.
 */
export function auditRewardGuardedSourceFiles(sourceFiles, {
  filesystemEnumerationVerified = false,
} = {}) {
  if (!Array.isArray(sourceFiles)) {
    throw new TypeError("reward guarded source inventory requires an array");
  }
  const files = sourceFiles.map(asSourceFile).sort((left, right) => (
    left.path.localeCompare(right.path, "en")
  ));
  const byPath = new Map();
  for (const file of files) {
    if (AUDITOR_PATHS.has(file.path)) {
      throw new Error("REWARD_GUARDED_SOURCE_AUDITOR_MUST_BE_EXCLUDED");
    }
    if (byPath.has(file.path)) throw new Error("REWARD_GUARDED_SOURCE_DUPLICATE_PATH");
    byPath.set(file.path, file.source);
    assertNoEncodedStaticMarkers(file);
  }

  // Narrow build-provenance fixtures intentionally contain only the guarded
  // host reference surface. Once either native reward module or its economy
  // export anchor is in an enumerated source root, every exact native path and
  // digest becomes mandatory. The canonical repository contains the export
  // anchor, so deleting or relocating only one native module still fails.
  const nativeRewardSurfacePresent = byPath.has(NATIVE_REWARD_EXPORT_PATH)
    || byPath.has(NATIVE_REWARD_TRANSCRIPT_PATH)
    || byPath.has(NATIVE_REWARD_RECOMPUTATION_PATH);
  const criticalSources = Object.entries(CRITICAL_SOURCE_SHA256)
    .filter(([path]) => !NATIVE_REWARD_MODULE_PATHS.has(path) || nativeRewardSurfacePresent)
    .map(([path, expectedSha256]) => {
      const source = byPath.get(path);
      if (source === undefined) {
        throw new Error(`REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING:${path}`);
      }
      const actualSha256 = sha256(source);
      if (actualSha256 !== expectedSha256) {
        throw new Error(`REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH:${path}`);
      }
      return Object.freeze({ path, sourceSha256: actualSha256 });
    });

  const markerInventory = Object.entries(EXPECTED_MARKER_LOCATIONS)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([marker, expected]) => {
      const expectedForSurface = nativeRewardSurfacePresent
        ? expected
        : Object.fromEntries(Object.entries(expected).filter(([path]) => (
          !NATIVE_REWARD_SURFACE_PATHS.has(path)
        )));
      const actual = {};
      for (const file of files) {
        const count = countOccurrences(file.source, marker);
        if (count > 0) actual[file.path] = count;
      }
      if (!sameLocationRecord(actual, expectedForSurface)) {
        throw new Error(`REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:${marker}`);
      }
      return Object.freeze({ markerSha256: sha256(marker), locations: canonicalLocationRecord(actual) });
    });

  const sourceSetSha256 = sha256(files.map((file) => (
    `${file.path}\0${sha256(file.source)}`
  )).join("\n"));
  const guardedSurfaceSha256 = sha256(JSON.stringify({
    criticalSources,
    markerInventory,
  }));
  return freezeResult({
    schema: REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA,
    status: REWARD_GUARDED_SOURCE_INVENTORY_STATUS,
    scannedSourceFileCount: files.length,
    sourceSetSha256,
    guardedSurfaceSha256,
    criticalSources,
    markerInventory,
    filesystemEnumerationVerified,
    exactGuardedAdapterSourceDigestsVerified: true,
    staticSensitiveSourceMarkerLocationsMatched: true,
    unlistedSensitiveSourceMarkerRejected: false,
    deployableRewardConsumerPathsInventoried: false,
    dynamicComputedDispatchRejected: false,
    reflectiveDispatchRejected: false,
    runtimeDirectStoreBypassPreventionVerified: false,
    providerAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    materializedProjectionStateVerified: false,
    externalSideEffectsAuthorized: false,
    builtArtifactParityVerified: false,
    independentReviewAccepted: false,
    activationReady: false,
    mainnetStatus: REWARD_GUARDED_SOURCE_INVENTORY_MAINNET_STATUS,
  });
}

export function collectRewardProductionSourceFiles(rootDirectory) {
  if (typeof rootDirectory !== "string" || rootDirectory.length === 0) {
    throw new TypeError("reward guarded source rootDirectory must be non-empty text");
  }
  const root = resolve(rootDirectory);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("REWARD_GUARDED_SOURCE_ROOT_DIRECTORY_REQUIRED");
  }
  const files = [];
  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name)) continue;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("REWARD_GUARDED_SOURCE_SYMLINK_HOLD");
      }
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      const path = relative(root, absolutePath).replaceAll("\\", "/");
      if (AUDITOR_PATHS.has(path)) continue;
      files.push(Object.freeze({ path, source: readFileSync(absolutePath, "utf8") }));
    }
  };
  walk(root);
  return Object.freeze(files.sort((left, right) => left.path.localeCompare(right.path, "en")));
}

export function assertRewardGuardedRepositorySourceInventory({ rootDirectory } = {}) {
  const result = auditRewardGuardedSourceFiles(
    collectRewardProductionSourceFiles(rootDirectory),
    { filesystemEnumerationVerified: true },
  );
  ENUMERATED_SOURCE_INVENTORIES.add(result);
  return result;
}

export function assertEnumeratedRewardGuardedSourceInventory(value) {
  if (!ENUMERATED_SOURCE_INVENTORIES.has(value)) {
    throw new Error("REWARD_GUARDED_SOURCE_ENUMERATED_INVENTORY_REQUIRED");
  }
  return value;
}

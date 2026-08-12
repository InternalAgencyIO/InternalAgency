import { createHash } from "node:crypto";
import { canonicalJsonSha256 } from "./pcm-editorial-gap-report.mjs";

const TOP_LEVEL_FIELDS = [
  "activationReady",
  "counts",
  "gapReportBinding",
  "gateBinding",
  "locale",
  "partition",
  "schema",
  "sourceFreeze",
  "status",
];
const SOURCE_FREEZE_FIELDS = ["ordering", "sourceCount", "sourceKeysSha256"];
const COUNT_FIELDS = ["gapSourceCount", "reusableSourceCount", "sourceCount"];
const GAP_REPORT_FIELDS = ["canonicalSha256", "fileSha256", "proposalArtifactCanonicalSha256", "schema"];
const GATE_BINDING_FIELDS = [
  "pcmQualityModuleSha256",
  "protectedIntegrityModuleSha256",
  "salvageModuleSha256",
];
const PARTITION_FIELDS = [
  "bitLength",
  "bitsBase64Url",
  "byteLength",
  "encoding",
  "gapSourceKeysSha256",
  "partitionBytesSha256",
  "reusableSourceKeysSha256",
  "semantics",
  "trailingPaddingBits",
];
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sortedKeys = (value) => Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function assertExactFields(value, expected, label) {
  if (!isRecord(value)
    || JSON.stringify(sortedKeys(value)) !== JSON.stringify([...expected].sort((left, right) => left.localeCompare(right, "en")))) {
    throw new Error(`${label} has missing or unexpected fields`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
}

function assertSafeCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

export function validatePcmEditorialSourcePartition({ manifest, inventory, currentGateBinding }) {
  assertExactFields(manifest, TOP_LEVEL_FIELDS, "PCM source partition manifest");
  assertExactFields(manifest.sourceFreeze, SOURCE_FREEZE_FIELDS, "PCM partition source freeze");
  assertExactFields(manifest.counts, COUNT_FIELDS, "PCM partition counts");
  assertExactFields(manifest.gapReportBinding, GAP_REPORT_FIELDS, "PCM partition gap-report binding");
  assertExactFields(manifest.gateBinding, GATE_BINDING_FIELDS, "PCM partition gate binding");
  assertExactFields(manifest.partition, PARTITION_FIELDS, "PCM source partition payload");
  assertExactFields(currentGateBinding, GATE_BINDING_FIELDS, "Current PCM gate binding");

  if (manifest.schema !== "iat-pcm-editorial-source-partition/v1" || manifest.locale !== "pcm") {
    throw new Error("PCM source partition schema or locale is invalid");
  }
  if (manifest.status !== "FROZEN_FAIL_CLOSED_PARTITION" || manifest.activationReady !== false) {
    throw new Error("PCM source partition must remain frozen and non-activating");
  }
  if (!Array.isArray(inventory?.sources)) throw new Error("PCM source partition inventory is malformed");
  if (manifest.sourceFreeze.ordering !== "UNIQUE_EN_LOCALE_COMPARE"
    || manifest.sourceFreeze.sourceCount !== inventory.sourceCount
    || manifest.sourceFreeze.sourceKeysSha256 !== inventory.sourceKeysSha256) {
    throw new Error("PCM source partition does not match the current source freeze");
  }
  assertSha256(manifest.sourceFreeze.sourceKeysSha256, "PCM partition source-freeze digest");
  for (const field of COUNT_FIELDS) assertSafeCount(manifest.counts[field], `PCM partition count ${field}`);
  if (manifest.counts.sourceCount !== inventory.sourceCount
    || manifest.counts.gapSourceCount + manifest.counts.reusableSourceCount !== manifest.counts.sourceCount) {
    throw new Error("PCM source partition declared counts do not cover the frozen source inventory");
  }
  if (manifest.gapReportBinding.schema !== "iat-pcm-editorial-gap-report/v1") {
    throw new Error("PCM source partition gap-report schema is invalid");
  }
  for (const [field, digest] of Object.entries(manifest.gapReportBinding).filter(([field]) => field !== "schema")) {
    assertSha256(digest, `PCM partition gap-report binding ${field}`);
  }
  for (const [field, digest] of Object.entries(manifest.gateBinding)) {
    assertSha256(digest, `PCM partition gate binding ${field}`);
    if (digest !== currentGateBinding[field]) throw new Error(`PCM source partition gate binding is stale: ${field}`);
  }

  const payload = manifest.partition;
  if (payload.encoding !== "BASE64URL_BITSET_MSB_FIRST" || payload.semantics !== "1=GAP,0=REUSABLE") {
    throw new Error("PCM source partition encoding contract is invalid");
  }
  for (const field of ["bitLength", "byteLength", "trailingPaddingBits"]) {
    assertSafeCount(payload[field], `PCM source partition ${field}`);
  }
  if (payload.bitLength !== inventory.sourceCount
    || payload.byteLength !== Math.ceil(payload.bitLength / 8)
    || payload.trailingPaddingBits !== payload.byteLength * 8 - payload.bitLength
    || payload.trailingPaddingBits > 7) {
    throw new Error("PCM source partition bit dimensions are invalid");
  }
  if (typeof payload.bitsBase64Url !== "string" || !BASE64URL_PATTERN.test(payload.bitsBase64Url)) {
    throw new Error("PCM source partition bit payload is not canonical base64url");
  }
  const bytes = Buffer.from(payload.bitsBase64Url, "base64url");
  if (bytes.length !== payload.byteLength || bytes.toString("base64url") !== payload.bitsBase64Url) {
    throw new Error("PCM source partition bit payload length or base64url canonicalization is invalid");
  }
  if (payload.trailingPaddingBits > 0) {
    const paddingMask = (1 << payload.trailingPaddingBits) - 1;
    if ((bytes.at(-1) & paddingMask) !== 0) throw new Error("PCM source partition trailing padding bits must be zero");
  }
  for (const field of ["partitionBytesSha256", "gapSourceKeysSha256", "reusableSourceKeysSha256"]) {
    assertSha256(payload[field], `PCM source partition ${field}`);
  }
  if (sha256(bytes) !== payload.partitionBytesSha256) {
    throw new Error("PCM source partition byte digest mismatch");
  }

  const gapSources = [];
  const reusableSources = [];
  for (let index = 0; index < inventory.sources.length; index += 1) {
    const isGap = Boolean(bytes[index >> 3] & (1 << (7 - (index & 7))));
    (isGap ? gapSources : reusableSources).push(inventory.sources[index]);
  }
  if (gapSources.length !== manifest.counts.gapSourceCount
    || reusableSources.length !== manifest.counts.reusableSourceCount) {
    throw new Error("PCM source partition decoded counts do not match the manifest");
  }
  if (sha256(JSON.stringify(gapSources)) !== payload.gapSourceKeysSha256
    || sha256(JSON.stringify(reusableSources)) !== payload.reusableSourceKeysSha256) {
    throw new Error("PCM source partition source-key digest mismatch");
  }
  const reconstructed = [...gapSources, ...reusableSources].sort((left, right) => left.localeCompare(right, "en"));
  if (new Set(reconstructed).size !== inventory.sourceCount
    || JSON.stringify(reconstructed) !== JSON.stringify(inventory.sources)) {
    throw new Error("PCM source partition is not a disjoint, complete frozen-source partition");
  }

  return {
    manifestSchema: manifest.schema,
    sourceFreeze: structuredClone(manifest.sourceFreeze),
    counts: structuredClone(manifest.counts),
    gapReportBinding: structuredClone(manifest.gapReportBinding),
    gateBinding: structuredClone(manifest.gateBinding),
    partitionDigests: {
      partitionBytesSha256: manifest.partition.partitionBytesSha256,
      gapSourceKeysSha256: manifest.partition.gapSourceKeysSha256,
      reusableSourceKeysSha256: manifest.partition.reusableSourceKeysSha256,
    },
    gapSources,
    reusableSources,
    manifestCanonicalSha256: canonicalJsonSha256(manifest),
  };
}

export function serializePcmEditorialSourcePartitionValidation(result) {
  return `${JSON.stringify({
    schema: "iat-pcm-editorial-source-partition-validation/v1",
    status: "PASS",
    activationReady: false,
    sourceCount: result.counts.sourceCount,
    gapSourceCount: result.counts.gapSourceCount,
    reusableSourceCount: result.counts.reusableSourceCount,
    manifestCanonicalSha256: result.manifestCanonicalSha256,
  }, null, 2)}\n`;
}

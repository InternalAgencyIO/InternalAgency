/**
 * Canonical unsigned payload codec for a future independent-review receipt.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This module cannot generate keys or signatures and has no wallet/network IO.
 */

import { createHash } from "node:crypto";

export const REVIEW_PAYLOAD_DOMAIN = "iat-promotions-dlc-independent-review-receipt-v1";
export const REVIEW_REPOSITORY = "InternalAgencyIO/InternalAgency";
export const REVIEW_PULL_REQUEST_NUMBER = 8;
export const REVIEW_PAYLOAD_KEYS = Object.freeze([
  "gitCommitSha",
  "reviewManifestContentSha256",
  "reviewTreeRootSha256",
  "coveredFileCount",
  "scopeCanonicalSha256",
  "accountabilityLabel",
  "reviewerIdentityCommitmentSha256",
  "independenceDeclaration",
  "decision",
  "rationaleCanonicalSha256",
  "findingsCommitmentSha256",
  "reviewedAtUnixSeconds",
  "activationAuthorized",
  "activationEffect",
]);
export const REVIEW_DECISIONS = Object.freeze({
  APPROVE_REVIEW_ONLY: 1,
  REQUEST_CHANGES: 2,
  REJECT: 3,
});

const MAGIC = Buffer.from("IATRDLC1", "ascii");
const MAX_U32 = 0xffff_ffffn;
const MAX_I64 = 0x7fff_ffff_ffff_ffffn;

const u8 = (value) => Buffer.from([value]);
const u16 = (value) => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
};
const u32 = (value) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(Number(value));
  return buffer;
};
const i64 = (value) => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value);
  return buffer;
};
const bytes32 = (value, name) => {
  if (!/^[0-9a-f]{64}$/.test(value ?? "")) throw new Error(`${name} must be lowercase-hex-64`);
  return Buffer.from(value, "hex");
};
const bytes20 = (value, name) => {
  if (!/^[0-9a-f]{40}$/.test(value ?? "")) throw new Error(`${name} must be lowercase-hex-40`);
  return Buffer.from(value, "hex");
};
const canonicalUnsigned = (value, name, maximum) => {
  if (!/^(0|[1-9][0-9]*)$/.test(value ?? "")) throw new Error(`${name} must be a canonical decimal string`);
  const parsed = BigInt(value);
  if (parsed > maximum) throw new Error(`${name} exceeds its fixed-width range`);
  return parsed;
};
const utf8 = (value, name, maximumLength) => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be non-empty UTF-8`);
  const encoded = Buffer.from(value, "utf8");
  if (encoded.length > maximumLength) throw new Error(`${name} exceeds ${maximumLength} UTF-8 bytes`);
  return Buffer.concat([u16(encoded.length), encoded]);
};

function assertExactShape(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("review payload must be an object");
  }
  const keys = Object.keys(payload);
  if (JSON.stringify(keys) !== JSON.stringify(REVIEW_PAYLOAD_KEYS)) {
    throw new Error("review payload keys or canonical field order drift");
  }
}

export function encodeUnsignedReviewReceiptPayload(payload) {
  assertExactShape(payload);
  const decisionCode = REVIEW_DECISIONS[payload.decision];
  if (!decisionCode) throw new Error("review decision is not allowed");
  if (payload.independenceDeclaration !== true) throw new Error("reviewer independence declaration must equal true");
  if (payload.activationAuthorized !== false) throw new Error("review payload cannot authorize activation");
  if (payload.activationEffect !== "NONE") throw new Error("review payload activation effect must equal NONE");
  const coveredFileCount = canonicalUnsigned(payload.coveredFileCount, "coveredFileCount", MAX_U32);
  const reviewedAt = canonicalUnsigned(payload.reviewedAtUnixSeconds, "reviewedAtUnixSeconds", MAX_I64);
  return Buffer.concat([
    MAGIC,
    utf8(REVIEW_PAYLOAD_DOMAIN, "domain", 0xffff),
    u8(1),
    utf8(REVIEW_REPOSITORY, "repository", 0xffff),
    u32(REVIEW_PULL_REQUEST_NUMBER),
    bytes20(payload.gitCommitSha, "gitCommitSha"),
    bytes32(payload.reviewManifestContentSha256, "reviewManifestContentSha256"),
    bytes32(payload.reviewTreeRootSha256, "reviewTreeRootSha256"),
    u32(coveredFileCount),
    bytes32(payload.scopeCanonicalSha256, "scopeCanonicalSha256"),
    utf8(payload.accountabilityLabel, "accountabilityLabel", 64),
    bytes32(payload.reviewerIdentityCommitmentSha256, "reviewerIdentityCommitmentSha256"),
    u8(1),
    u8(decisionCode),
    bytes32(payload.rationaleCanonicalSha256, "rationaleCanonicalSha256"),
    bytes32(payload.findingsCommitmentSha256, "findingsCommitmentSha256"),
    i64(reviewedAt),
    u8(0),
    u8(0),
  ]);
}

function reader(bytes) {
  const buffer = Buffer.from(bytes);
  let offset = 0;
  const take = (length, name) => {
    if (offset + length > buffer.length) throw new Error(`truncated review payload at ${name}`);
    const value = buffer.subarray(offset, offset + length);
    offset += length;
    return value;
  };
  const takeU8 = (name) => take(1, name)[0];
  const takeU16 = (name) => take(2, name).readUInt16LE();
  const takeU32 = (name) => take(4, name).readUInt32LE();
  const takeI64 = (name) => take(8, name).readBigInt64LE();
  const takeUtf8 = (name) => {
    const length = takeU16(`${name} length`);
    return new TextDecoder("utf-8", { fatal: true }).decode(take(length, name));
  };
  return { buffer, take, takeU8, takeU32, takeI64, takeUtf8, get offset() { return offset; } };
}

export function decodeUnsignedReviewReceiptPayload(bytes) {
  const cursor = reader(bytes);
  if (!cursor.take(MAGIC.length, "magic").equals(MAGIC)) throw new Error("review payload magic mismatch");
  if (cursor.takeUtf8("domain") !== REVIEW_PAYLOAD_DOMAIN) throw new Error("review payload domain mismatch");
  if (cursor.takeU8("version") !== 1) throw new Error("review payload version mismatch");
  if (cursor.takeUtf8("repository") !== REVIEW_REPOSITORY) throw new Error("review repository mismatch");
  if (cursor.takeU32("pull request") !== REVIEW_PULL_REQUEST_NUMBER) throw new Error("review pull request mismatch");
  const decisionCodeToName = Object.fromEntries(Object.entries(REVIEW_DECISIONS).map(([name, code]) => [code, name]));
  const payload = {
    gitCommitSha: cursor.take(20, "git commit").toString("hex"),
    reviewManifestContentSha256: cursor.take(32, "manifest digest").toString("hex"),
    reviewTreeRootSha256: cursor.take(32, "tree root").toString("hex"),
    coveredFileCount: String(cursor.takeU32("covered file count")),
    scopeCanonicalSha256: cursor.take(32, "scope digest").toString("hex"),
    accountabilityLabel: cursor.takeUtf8("accountability label"),
    reviewerIdentityCommitmentSha256: cursor.take(32, "reviewer commitment").toString("hex"),
    independenceDeclaration: cursor.takeU8("independence declaration") === 1,
    decision: decisionCodeToName[cursor.takeU8("decision")],
    rationaleCanonicalSha256: cursor.take(32, "rationale digest").toString("hex"),
    findingsCommitmentSha256: cursor.take(32, "findings digest").toString("hex"),
    reviewedAtUnixSeconds: String(cursor.takeI64("review timestamp")),
    activationAuthorized: cursor.takeU8("activation authorized") === 1,
    activationEffect: cursor.takeU8("activation effect") === 0 ? "NONE" : undefined,
  };
  if (cursor.offset !== cursor.buffer.length) throw new Error("trailing bytes after review payload");
  if (!payload.decision) throw new Error("unknown review decision code");
  if (!payload.independenceDeclaration) throw new Error("reviewer independence declaration byte mismatch");
  if (payload.activationAuthorized || payload.activationEffect !== "NONE") {
    throw new Error("review payload contains activation authority");
  }
  encodeUnsignedReviewReceiptPayload(payload);
  return payload;
}

export function unsignedReviewPayloadSha256(payload) {
  return createHash("sha256").update(encodeUnsignedReviewReceiptPayload(payload)).digest("hex");
}

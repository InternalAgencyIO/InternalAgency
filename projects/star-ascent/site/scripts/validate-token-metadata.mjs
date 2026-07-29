#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const canonicalPath = "launch/token-metadata.template.json";
const requestedPath = process.argv[2] ?? canonicalPath;
const failures = [];
const fail = (message) => failures.push(message);
const exactKeys = (value, expected) =>
  value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === expected.length
  && expected.every((key) => Object.hasOwn(value, key));
const sha256File = (path) => createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
const isUtc = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value));
const usableLabel = (value) => typeof value === "string"
  && value === value.trim()
  && value.length >= 3
  && value.length <= 80
  && !/^(reviewer|operator|pending|tbd|unknown)$/i.test(value);

if (requestedPath.replaceAll("\\", "/") !== canonicalPath) {
  fail(`metadata path must be ${canonicalPath}`);
}

let record;
try {
  record = JSON.parse(readFileSync(resolve(canonicalPath), "utf8"));
} catch (error) {
  fail(`metadata record is unreadable: ${error.message}`);
}

if (record) {
  const expectedFields = [
    "version", "status", "network", "metadataProgramId", "name", "symbol", "uri",
    "metadataJsonPath", "metadataJsonSha256", "sellerFeeBasisPoints", "isMutable",
    "updateAuthorityPolicy", "review",
  ];
  if (!exactKeys(record, expectedFields)) fail("metadata record must contain only canonical fields");
  if (!exactKeys(record.review, ["reviewedBy", "reviewedAtUtc"])) fail("metadata review must contain only canonical fields");
  if (record.version !== 1) fail("metadata version must be 1");
  if (!["HOLD", "READY"].includes(record.status)) fail("metadata status must be HOLD or READY");
  if (record.network !== "mainnet-beta") fail("metadata network must be mainnet-beta");
  if (record.metadataProgramId !== "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s") fail("metadata program must be canonical Metaplex Token Metadata");
  if (record.name !== "Internal Agency Token") fail("metadata name must be Internal Agency Token");
  if (record.symbol !== "IAT") fail("metadata symbol must be IAT");
  if (record.uri !== "https://internalagency.io/metadata/iat.json") fail("metadata URI must be the canonical HTTPS record");
  if (record.metadataJsonPath !== "public/metadata/iat.json") fail("metadata JSON path must be canonical");
  if (record.sellerFeeBasisPoints !== 0) fail("fungible token metadata seller fee must be zero");
  if (record.isMutable !== false) fail("metadata must be immutable at Genesis");
  if (record.updateAuthorityPolicy !== "IMMUTABLE_AT_GENESIS") fail("metadata update-authority policy must be immutable at Genesis");

  let metadataJson;
  try {
    metadataJson = JSON.parse(readFileSync(resolve(record.metadataJsonPath), "utf8"));
  } catch (error) {
    fail(`metadata JSON is unreadable: ${error.message}`);
  }
  if (metadataJson) {
    if (metadataJson.name !== record.name || metadataJson.symbol !== record.symbol) fail("off-chain metadata name and symbol must match the canonical record");
    if (metadataJson.external_url !== "https://internalagency.io") fail("off-chain metadata external URL must be canonical");
    if (typeof metadataJson.image !== "string" || !metadataJson.image.startsWith("https://internalagency.io/")) fail("off-chain metadata image must use the canonical site");
  }

  if (record.status === "HOLD") {
    if (record.metadataJsonSha256 !== null || record.review?.reviewedBy !== null || record.review?.reviewedAtUtc !== null) {
      fail("HOLD metadata must clear digest and independent-review evidence");
    }
  }

  if (record.status === "READY") {
    const actualDigest = sha256File(record.metadataJsonPath);
    if (!/^[a-f0-9]{64}$/.test(record.metadataJsonSha256 ?? "") || record.metadataJsonSha256 !== actualDigest) {
      fail("READY metadata must bind the exact off-chain JSON SHA-256");
    }
    if (!usableLabel(record.review?.reviewedBy)) fail("READY metadata requires an independent reviewer label");
    if (!isUtc(record.review?.reviewedAtUtc)) fail("READY metadata requires a canonical UTC review time");
    else if (Date.parse(record.review.reviewedAtUtc) > Date.now() + 60_000) fail("metadata review time cannot be in the future");
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(`Metadata gate passes in ${record.status}. No transaction is authorized by this result.`);

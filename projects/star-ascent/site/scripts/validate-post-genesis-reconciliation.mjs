#!/usr/bin/env node

import { readFileSync } from "node:fs";

const reconciliationPath = process.argv[2] ?? "launch/post-genesis-reconciliation.template.json";
const record = JSON.parse(readFileSync(reconciliationPath, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isUtcTimestamp = (value) => typeof value === "string" && /Z$/.test(value) && !Number.isNaN(Date.parse(value));
const isPublicUrl = (value) => typeof value === "string" && /^https:\/\/(?!example\.com|placeholder)/i.test(value);
const isPositiveWholeMinutes = (value) => Number.isInteger(value) && value > 0 && value <= 24 * 60;
const isSolanaAddress = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const payloadValueFor = (payload, label) => payload.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1]?.trim();
const requiredPaths = {
  manifestPath: "launch/genesis-manifest.template.json",
  publicationPayloadPath: "launch/PUBLICATION_PAYLOAD.template.md",
  releasePacketPath: "launch/release-packet.template.json",
};

if (!["HOLD", "COMPLETE"].includes(record.status)) fail("status must be HOLD or COMPLETE");
if (record.scope !== "Post-Genesis public evidence reconciliation only; this file never authorizes a transaction, distribution, or claim.") fail("scope must retain the non-authorizing boundary");
for (const [field, expected] of Object.entries(requiredPaths)) {
  if (record.sourceArtifacts?.[field] !== expected) fail(`${field} must point to the canonical artifact`);
  else ok(`${field} points to canonical artifact`);
}
for (const field of ["haltOnChannelMismatch", "haltOnExpiredEvidence", "haltOnUnresolvedCorrections", "preserveCorrectionHistory", "noDistributionClaimsWithoutEvidence"]) {
  if (record.controls?.[field] !== true) fail(`controls.${field} must be true`);
}
if (!isPositiveWholeMinutes(record.controls?.maxChannelEvidenceAgeMinutes)) {
  fail("controls.maxChannelEvidenceAgeMinutes must be a whole number from 1 to 1440");
}

if (record.status === "COMPLETE") {
  const manifest = JSON.parse(readFileSync(record.sourceArtifacts.manifestPath, "utf8"));
  const packet = JSON.parse(readFileSync(record.sourceArtifacts.releasePacketPath, "utf8"));
  const payload = readFileSync(record.sourceArtifacts.publicationPayloadPath, "utf8");
  if (manifest.status !== "PUBLISHED") fail("COMPLETE requires a PUBLISHED manifest"); else ok("manifest is PUBLISHED");
  if (packet.status !== "READY") fail("COMPLETE requires a READY release packet"); else ok("release packet is READY");
  if (!/Status:\s*\*\*PUBLISHED\*\*/.test(payload)) fail("COMPLETE requires a PUBLISHED publication payload"); else ok("publication payload is PUBLISHED");
  const canonicalEvidence = {
    canonicalRoute: manifest.claimOrDistribution?.canonicalRoute,
    mint: manifest.token?.mint,
    mintAuthorityEvidence: manifest.token?.mintAuthorityRevocationTransaction,
    freezeAuthorityEvidence: manifest.token?.freezeAuthorityRevocationTransaction,
  };
  if (!isPublicUrl(canonicalEvidence.canonicalRoute)) fail("COMPLETE requires a non-placeholder manifest canonical route");
  if (!isSolanaAddress(canonicalEvidence.mint)) fail("COMPLETE requires a Solana-form manifest mint");
  for (const [field, value] of Object.entries(canonicalEvidence)) {
    if (field !== "mint" && !isPublicUrl(value)) fail(`COMPLETE requires non-placeholder manifest ${field}`);
  }
  const payloadEvidence = {
    mint: payloadValueFor(payload, "Mint"),
    mintAuthorityEvidence: payloadValueFor(payload, "Mint authority evidence"),
    freezeAuthorityEvidence: payloadValueFor(payload, "Freeze authority evidence"),
    canonicalRoute: payloadValueFor(payload, "Allocation and lock evidence"),
  };
  for (const [field, expected] of Object.entries(canonicalEvidence)) {
    if (payloadEvidence[field] !== expected) fail(`publication payload ${field} must exactly match the canonical manifest`);
    else ok(`publication payload ${field} matches canonical manifest`);
  }
  if (!isUtcTimestamp(record.reconciliation?.checkedAtUtc)) fail("COMPLETE requires reconciliation.checkedAtUtc in UTC");
  const reconciliationCheckedAtMs = Date.parse(record.reconciliation?.checkedAtUtc);
  for (const field of ["archiveOwnerLabel", "independentReviewerLabel"]) {
    if (typeof record.reconciliation?.[field] !== "string" || record.reconciliation[field].trim().length < 2) fail(`COMPLETE requires reconciliation.${field}`);
  }
  if (record.reconciliation?.archiveOwnerLabel === record.reconciliation?.independentReviewerLabel) fail("COMPLETE requires separated archive and reviewer labels");
  for (const field of ["evidenceArchiveUrl", "publicChangelogUrl"]) {
    if (!isPublicUrl(record.reconciliation?.[field])) fail(`COMPLETE requires non-placeholder HTTPS reconciliation.${field}`);
  }
  if (record.reconciliation?.evidenceArchiveUrl === record.reconciliation?.publicChangelogUrl) {
    fail("COMPLETE requires separate evidence archive and public changelog URLs");
  }
  if (!["NONE", "RESOLVED"].includes(record.reconciliation?.correctionStatus)) {
    fail("COMPLETE requires reconciliation.correctionStatus to be NONE or RESOLVED");
  }
  if (!Array.isArray(record.reconciliation?.correctionRecords)) {
    fail("COMPLETE requires reconciliation.correctionRecords to be an array");
  } else {
    if (record.reconciliation.correctionStatus === "NONE" && record.reconciliation.correctionRecords.length !== 0) {
      fail("correctionStatus NONE requires an empty correctionRecords history");
    }
    if (record.reconciliation.correctionStatus === "RESOLVED" && record.reconciliation.correctionRecords.length === 0) {
      fail("correctionStatus RESOLVED requires at least one resolved correction record");
    }
    const correctionIds = new Set();
    for (const [index, correction] of record.reconciliation.correctionRecords.entries()) {
      if (!correction || typeof correction !== "object") { fail(`correctionRecords[${index}] must be an object`); continue; }
      if (typeof correction.correctionId !== "string" || correction.correctionId.trim().length < 3) {
        fail(`correctionRecords[${index}].correctionId must be non-empty`);
      } else if (correctionIds.has(correction.correctionId)) {
        fail(`duplicate correction record: ${correction.correctionId}`);
      } else correctionIds.add(correction.correctionId);
      if (correction.status !== "RESOLVED") fail(`correctionRecords[${index}].status must be RESOLVED before COMPLETE`);
      for (const field of ["reportedAtUtc", "resolvedAtUtc"]) {
        if (!isUtcTimestamp(correction[field])) fail(`correctionRecords[${index}].${field} must be UTC`);
        else if (Date.parse(correction[field]) > reconciliationCheckedAtMs) fail(`correctionRecords[${index}].${field} cannot be after reconciliation.checkedAtUtc`);
      }
      if (isUtcTimestamp(correction.reportedAtUtc) && isUtcTimestamp(correction.resolvedAtUtc) && Date.parse(correction.resolvedAtUtc) < Date.parse(correction.reportedAtUtc)) {
        fail(`correctionRecords[${index}].resolvedAtUtc cannot predate reportedAtUtc`);
      }
      if (!isPublicUrl(correction.publicNoticeUrl)) fail(`correctionRecords[${index}].publicNoticeUrl must be non-placeholder HTTPS`);
    }
  }
  if (!Array.isArray(record.reconciliation?.channelRecords) || record.reconciliation.channelRecords.length < 2) fail("COMPLETE requires at least two channel records");
  const channels = new Set();
  const publicUrls = new Set([record.reconciliation?.evidenceArchiveUrl, record.reconciliation?.publicChangelogUrl]);
  for (const [index, channel] of (record.reconciliation?.channelRecords ?? []).entries()) {
    if (!channel || typeof channel !== "object") { fail(`channelRecords[${index}] must be an object`); continue; }
    if (typeof channel.channel !== "string" || channel.channel.trim().length < 2) fail(`channelRecords[${index}].channel must be non-empty`);
    else if (channels.has(channel.channel)) fail(`duplicate channel record: ${channel.channel}`); else channels.add(channel.channel);
    if (!isPublicUrl(channel.publicUrl)) fail(`channelRecords[${index}].publicUrl must be non-placeholder HTTPS`);
    else if (publicUrls.has(channel.publicUrl)) fail(`channelRecords[${index}].publicUrl must be distinct from archive, changelog, and other channels`);
    else publicUrls.add(channel.publicUrl);
    if (!isUtcTimestamp(channel.checkedAtUtc)) fail(`channelRecords[${index}].checkedAtUtc must be UTC`);
    else {
      const ageMinutes = (reconciliationCheckedAtMs - Date.parse(channel.checkedAtUtc)) / 60_000;
      if (ageMinutes < 0) fail(`channelRecords[${index}].checkedAtUtc cannot be after reconciliation.checkedAtUtc`);
      if (ageMinutes > record.controls.maxChannelEvidenceAgeMinutes) {
        fail(`channelRecords[${index}].checkedAtUtc is older than controls.maxChannelEvidenceAgeMinutes`);
      }
    }
    if (channel.status !== "matched") fail(`channelRecords[${index}].status must be matched`);
    for (const [field, expected] of Object.entries(canonicalEvidence)) {
      if (channel[field] !== expected) fail(`channelRecords[${index}].${field} must exactly match the canonical manifest`);
    }
  }
}

if (process.exitCode) console.error("\nPost-Genesis reconciliation does not clear its archive gate.");
else console.log("\nPost-Genesis reconciliation structure passes. It never creates keys, signs, submits transactions, or establishes on-chain truth.");

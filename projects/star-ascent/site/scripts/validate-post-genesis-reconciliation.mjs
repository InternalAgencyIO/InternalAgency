#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeAccountabilityLabel } from "./normalize-accountability-label.mjs";

const canonicalReconciliationPath = "launch/post-genesis-reconciliation.template.json";
const reconciliationPath = process.argv[2] ?? canonicalReconciliationPath;
if (reconciliationPath !== canonicalReconciliationPath) {
  console.error(`FAIL: reconciliation path must be ${canonicalReconciliationPath}`);
  process.exit(1);
}
const reconciliationBytes = readFileSync(reconciliationPath);
const record = JSON.parse(reconciliationBytes.toString("utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const reconciliationMaxFutureSkewMs = 60_000;
// Evidence ordering relies on timestamps being byte-for-byte canonical. A
// parseable variant such as fractional seconds with a non-canonical precision
// must not become a distinct-looking record for the same instant.
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const normalizedUrlComponent = (value) => {
  try {
    return encodeURIComponent(decodeURIComponent(value).normalize("NFKC"));
  } catch {
    return value.replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase());
  }
};
const publicUrlIdentity = (value) => {
  if (typeof value !== "string" || value !== value.trim() || /\p{C}/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.replace(/\.+$/, "");
    if (!hostname || hostname === "example.com" || hostname.startsWith("placeholder")) return null;
    const pathname = url.pathname.split("/").map(normalizedUrlComponent).join("/");
    const searchParams = [...url.searchParams].map(([name, parameterValue]) => [
      name.normalize("NFKC"),
      parameterValue.normalize("NFKC"),
    ]);
    const search = searchParams.length > 0 ? `?${new URLSearchParams(searchParams)}` : "";
    // URL parsing canonicalizes the protocol, IDNA hostname, and default port.
    // A terminal DNS dot and fragments are deliberately omitted because they
    // do not identify a different public resource.
    const authority = url.port ? `${hostname}:${url.port}` : hostname;
    return `https://${authority}${pathname}${search}`;
  } catch {
    return null;
  }
};
const isPublicUrl = (value) => publicUrlIdentity(value) !== null;
const isPositiveWholeMinutes = (value) => Number.isInteger(value) && value > 0 && value <= 24 * 60;
const normalizedLabel = normalizeAccountabilityLabel;
const normalizedChannelIdentity = (value) => normalizedLabel(value).replace(/\s+/gu, " ");
const isUsableLabel = (value) => typeof value === "string"
  && value === value.trim()
  && !/\p{C}/u.test(value)
  && normalizedLabel(value).length >= 2
  && !/\b(pending|todo|tbd|example|placeholder|unassigned|none|unknown)\b/i.test(value);
// Correction IDs are durable references used across the archive, changelog,
// and channel proofs. Keep their spelling portable and unambiguous instead of
// letting whitespace, compatibility glyphs, or case variants split one issue.
const normalizedCorrectionId = (value) => typeof value === "string"
  ? value.normalize("NFKC").toLocaleLowerCase("en-US")
  : "";
const isUsableCorrectionId = (value) => typeof value === "string"
  && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/.test(value)
  && !/^(?:pending|todo|tbd|example|placeholder|unassigned|none|unknown)$/i.test(value);
const base58DecodedLength = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{1,88}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = [0];
  for (const character of value) {
    let carry = alphabet.indexOf(character);
    for (let index = 0; index < decoded.length; index += 1) {
      carry += decoded[index] * 58;
      decoded[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { decoded.push(carry & 0xff); carry >>= 8; }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return decoded.length + leadingZeroes - (decoded.length === 1 && decoded[0] === 0 ? 1 : 0);
};
const isSolanaAddress = (value) => base58DecodedLength(value) === 32;
const isUsableSolanaAddress = (value) => isSolanaAddress(value) && value !== "11111111111111111111111111111111";
const payloadValueFor = (payload, label) => payload.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1]?.trim();
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
};
const credentialBearingValue = (value) => {
  if (typeof value !== "string") return false;
  if (/\b(?:seed\s*(?:phrase|words)?|mnemonic|private\s*key|secret\s*key|keypair|passphrase|device\s*pin|wallet\s*(?:seed|export|backup)|recovery\s*(?:phrase|words|material)?|derivation\s*path|account\s*path)\b/i.test(value)) return true;
  // A raw 64-byte Base58 value is indistinguishable from exported Solana
  // keypair material. Explorer transaction signatures remain valid because
  // evidence fields contain complete URLs rather than the bare value.
  if (/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value) && base58DecodedLength(value) === 64) return true;
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]{3,8}$/i.test(word));
};
const findUnsafeRecordContent = (value, path = "reconciliation") => {
  if (typeof value === "string") return credentialBearingValue(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findUnsafeRecordContent(item, `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const fieldPath = `${path}.${name}`;
      if (secretBearingFieldName(name)) return fieldPath;
      const found = findUnsafeRecordContent(item, fieldPath);
      if (found) return found;
    }
  }
  return null;
};
const requiredPaths = {
  manifestPath: "launch/genesis-manifest.template.json",
  publicationPayloadPath: "launch/PUBLICATION_PAYLOAD.template.md",
  releasePacketPath: "launch/release-packet.template.json",
  prePublicationPacketProofPath: "launch/pre-publication-packet-proof.generated.json",
};
const mainnetHandoffPath = "launch/mainnet-handoff.template.json";
const immutableCeremonyPaths = [
  "launch/genesis-signing-checklist.template.json",
  "launch/devnet-rehearsal.template.json",
  mainnetHandoffPath,
];
const releaseSnapshotPath = "launch/release-snapshot.generated.json";
const captureDependencyBundle = (paths) => Object.fromEntries(
  paths.map((path) => [path, readFileSync(path)]),
);
const dependencyBundlesMatch = (left, right, paths) => paths.every(
  (path) => left[path] && right[path] && Buffer.compare(left[path], right[path]) === 0,
);
const validateCanonicalDependency = (script, path, label) => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./${script}`, import.meta.url)), path], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    fail(`post-Genesis reconciliation requires the canonical ${label} validator to pass before any reconciliation state is accepted`);
  } else {
    ok(`canonical ${label} validator passes`);
  }
};

if (!["HOLD", "COMPLETE"].includes(record.status)) fail("status must be HOLD or COMPLETE");
if (record.scope !== "Post-Genesis public evidence reconciliation only; this file never authorizes a transaction, distribution, or claim.") fail("scope must retain the non-authorizing boundary");
if (!hasExactKeys(record, ["status", "scope", "sourceArtifacts", "controls", "reconciliation"])) fail("record must contain exactly the reviewed reconciliation fields");
if (!hasExactKeys(record.sourceArtifacts, Object.keys(requiredPaths))) fail("sourceArtifacts must contain exactly the canonical artifact paths");
if (!hasExactKeys(record.controls, ["haltOnChannelMismatch", "haltOnExpiredEvidence", "haltOnUnresolvedCorrections", "maxChannelEvidenceAgeMinutes", "preserveCorrectionHistory", "noDistributionClaimsWithoutEvidence"])) fail("controls must contain exactly the reviewed gate fields");
if (!hasExactKeys(record.reconciliation, ["checkedAtUtc", "archiveOwnerLabel", "independentReviewerLabel", "evidenceArchiveUrl", "publicChangelogUrl", "correctionStatus", "correctionRecords", "channelRecords"])) fail("reconciliation must contain exactly the reviewed archive fields");
const unsafeRecordContent = findUnsafeRecordContent(record);
if (unsafeRecordContent) fail(`reconciliation must not contain credential-bearing field names or values (${unsafeRecordContent})`);
for (const [field, expected] of Object.entries(requiredPaths)) {
  if (record.sourceArtifacts?.[field] !== expected) fail(`${field} must point to the canonical artifact`);
  else ok(`${field} points to canonical artifact`);
}
const publicSourcePaths = [
  requiredPaths.manifestPath,
  requiredPaths.publicationPayloadPath,
];
const beforePublicSourceValidation = captureDependencyBundle(publicSourcePaths);
validateCanonicalDependency("validate-genesis-manifest.mjs", record.sourceArtifacts?.manifestPath, "manifest");
validateCanonicalDependency("validate-publication-payload.mjs", record.sourceArtifacts?.publicationPayloadPath, "publication payload");
const afterPublicSourceValidation = captureDependencyBundle(publicSourcePaths);
if (!dependencyBundlesMatch(beforePublicSourceValidation, afterPublicSourceValidation, publicSourcePaths)) {
  fail("canonical manifest or publication payload changed during validation; repeat the reconciliation review");
}
const routingManifest = JSON.parse(beforePublicSourceValidation[requiredPaths.manifestPath].toString("utf8"));
const routingPayload = beforePublicSourceValidation[requiredPaths.publicationPayloadPath].toString("utf8");
const sourcesArePublished = routingManifest.status === "PUBLISHED"
  && payloadValueFor(routingPayload, "Status") === "**VERIFIED**";
const commonDependencyPaths = [
  canonicalReconciliationPath,
  ...publicSourcePaths,
  requiredPaths.releasePacketPath,
  ...immutableCeremonyPaths,
];
let reviewedDependencyPaths;
let reviewedDependencyBundle;
if (sourcesArePublished) {
  reviewedDependencyPaths = [
    ...commonDependencyPaths,
    requiredPaths.prePublicationPacketProofPath,
    releaseSnapshotPath,
  ];
  reviewedDependencyBundle = captureDependencyBundle(reviewedDependencyPaths);
  if (Buffer.compare(reconciliationBytes, reviewedDependencyBundle[canonicalReconciliationPath]) !== 0) {
    fail("canonical reconciliation record changed during validation; repeat the reconciliation review");
  }
  if (!dependencyBundlesMatch(beforePublicSourceValidation, reviewedDependencyBundle, publicSourcePaths)) {
    fail("canonical launch dependencies changed after public-source validation; repeat the reconciliation review");
  }
  validateCanonicalDependency(
    "validate-pre-publication-packet-proof.mjs",
    record.sourceArtifacts?.prePublicationPacketProofPath,
    "pre-publication packet proof",
  );
} else {
  reviewedDependencyPaths = commonDependencyPaths;
  reviewedDependencyBundle = captureDependencyBundle(reviewedDependencyPaths);
  if (Buffer.compare(reconciliationBytes, reviewedDependencyBundle[canonicalReconciliationPath]) !== 0) {
    fail("canonical reconciliation record changed during validation; repeat the reconciliation review");
  }
  const releasePacketStatus = JSON.parse(
    reviewedDependencyBundle[requiredPaths.releasePacketPath].toString("utf8"),
  )?.status;
  const mainnetHandoffStatus = JSON.parse(
    reviewedDependencyBundle[mainnetHandoffPath].toString("utf8"),
  )?.status;
  // READY packet validation reads the snapshot directly. A HOLD packet also
  // reaches it through the canonical handoff validator when that handoff is
  // already APPROVED, so both branches must keep the snapshot in the stable
  // dependency bundle.
  if (releasePacketStatus === "READY" || mainnetHandoffStatus === "APPROVED") {
    const snapshotDependencyPaths = [...reviewedDependencyPaths, releaseSnapshotPath];
    const snapshotDependencyBundle = captureDependencyBundle(snapshotDependencyPaths);
    if (!dependencyBundlesMatch(reviewedDependencyBundle, snapshotDependencyBundle, reviewedDependencyPaths)) {
      fail("canonical launch dependencies changed while preparing snapshot-dependent validation; repeat the reconciliation review");
    }
    reviewedDependencyPaths = snapshotDependencyPaths;
    reviewedDependencyBundle = snapshotDependencyBundle;
  }
  if (!dependencyBundlesMatch(beforePublicSourceValidation, reviewedDependencyBundle, publicSourcePaths)) {
    fail("canonical launch dependencies changed after public-source validation; repeat the reconciliation review");
  }
  validateCanonicalDependency("validate-release-packet.mjs", record.sourceArtifacts?.releasePacketPath, "release packet");
}
const afterDependencyValidation = captureDependencyBundle(reviewedDependencyPaths);
if (!dependencyBundlesMatch(reviewedDependencyBundle, afterDependencyValidation, reviewedDependencyPaths)) {
  fail("canonical launch dependencies changed during validation; repeat the reconciliation review");
}
const manifest = JSON.parse(reviewedDependencyBundle[requiredPaths.manifestPath].toString("utf8"));
const payload = reviewedDependencyBundle[requiredPaths.publicationPayloadPath].toString("utf8");
for (const field of ["haltOnChannelMismatch", "haltOnExpiredEvidence", "haltOnUnresolvedCorrections", "preserveCorrectionHistory", "noDistributionClaimsWithoutEvidence"]) {
  if (record.controls?.[field] !== true) fail(`controls.${field} must be true`);
}
if (!isPositiveWholeMinutes(record.controls?.maxChannelEvidenceAgeMinutes)) {
  fail("controls.maxChannelEvidenceAgeMinutes must be a whole number from 1 to 1440");
}

if (record.status === "HOLD") {
  for (const field of ["checkedAtUtc", "archiveOwnerLabel", "independentReviewerLabel", "evidenceArchiveUrl", "publicChangelogUrl"]) {
    if (record.reconciliation?.[field] !== null) fail(`HOLD requires reconciliation.${field} to be null so prior public evidence cannot survive a reset`);
  }
  if (record.reconciliation?.correctionStatus !== "NONE") {
    fail("HOLD requires reconciliation.correctionStatus to be NONE so a prior correction cannot imply a cleared archive gate");
  }
  for (const field of ["correctionRecords", "channelRecords"]) {
    if (!Array.isArray(record.reconciliation?.[field]) || record.reconciliation[field].length !== 0) {
      fail(`HOLD requires reconciliation.${field} to be an empty array so prior public evidence cannot survive a reset`);
    }
  }
}

if (record.status === "COMPLETE") {
  // Reject ambiguous reviewer ownership before considering any external launch
  // artifact. A truthful archive gate needs two independently attributable
  // humans, even when another prerequisite is also incomplete.
  for (const field of ["archiveOwnerLabel", "independentReviewerLabel"]) {
    if (!isUsableLabel(record.reconciliation?.[field])) fail(`COMPLETE requires a trimmed, printable, non-placeholder reconciliation.${field}`);
  }
  if (normalizedLabel(record.reconciliation?.archiveOwnerLabel) === normalizedLabel(record.reconciliation?.independentReviewerLabel)) {
    fail("COMPLETE requires genuinely distinct archive-owner and independent-reviewer labels");
  }
  const packet = JSON.parse(reviewedDependencyBundle[requiredPaths.releasePacketPath].toString("utf8"));
  let packetProof = {};
  try {
    packetProof = JSON.parse(reviewedDependencyBundle[requiredPaths.prePublicationPacketProofPath].toString("utf8"));
  } catch {
    fail("COMPLETE requires a readable canonical pre-publication packet proof");
  }
  if (manifest.status !== "PUBLISHED") fail("COMPLETE requires a PUBLISHED manifest"); else ok("manifest is PUBLISHED");
  if (packet.status !== "READY") fail("COMPLETE requires a READY release packet"); else ok("release packet is READY");
  if (payloadValueFor(payload, "Status") !== "**VERIFIED**") {
    fail("COMPLETE requires a VERIFIED publication payload");
  } else {
    ok("publication payload is VERIFIED");
  }
  const payloadCheckedAt = payload.match(/^Checked at \(UTC\):\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)$/m)?.[1];
  const expectedPayloadCheckedAt = typeof packet.releaseControls?.publicEvidenceCheckedAtUtc === "string"
    ? `${packet.releaseControls.publicEvidenceCheckedAtUtc.slice(0, 16).replace("T", " ")} UTC`
    : null;
  const packetSealedAtMs = Date.parse(packetProof.sealedAtUtc);
  if (!payloadCheckedAt || payloadCheckedAt !== expectedPayloadCheckedAt) {
    fail("COMPLETE requires publication payload Checked at (UTC) to match the sealed packet public-evidence review minute");
  } else {
    ok("publication payload Checked at (UTC) matches the sealed packet review");
  }
  const canonicalEvidence = {
    canonicalRoute: manifest.claimOrDistribution?.canonicalRoute,
    mint: manifest.token?.mint,
    mintAuthorityEvidence: manifest.token?.mintAuthorityRevocationTransaction,
    freezeAuthorityEvidence: manifest.token?.freezeAuthorityRevocationTransaction,
  };
  if (!isPublicUrl(canonicalEvidence.canonicalRoute)) fail("COMPLETE requires a non-placeholder manifest canonical route");
  if (!isUsableSolanaAddress(canonicalEvidence.mint)) fail("COMPLETE requires a usable 32-byte Solana manifest mint");
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
  if (!isUtcTimestamp(record.reconciliation?.checkedAtUtc)) fail("COMPLETE requires a canonical ISO-8601 UTC reconciliation.checkedAtUtc timestamp");
  const reconciliationCheckedAtMs = Date.parse(record.reconciliation?.checkedAtUtc);
  if (isUtcTimestamp(record.reconciliation?.checkedAtUtc) && reconciliationCheckedAtMs > Date.now() + reconciliationMaxFutureSkewMs) {
    fail("COMPLETE reconciliation.checkedAtUtc cannot be more than one minute in the future");
  }
  if (isUtcTimestamp(packetProof.sealedAtUtc) && isUtcTimestamp(record.reconciliation?.checkedAtUtc)
    && reconciliationCheckedAtMs < packetSealedAtMs) {
    fail("COMPLETE reconciliation.checkedAtUtc cannot predate the sealed READY packet proof");
  }
  const evidenceArchiveUrlIdentity = publicUrlIdentity(record.reconciliation?.evidenceArchiveUrl);
  const publicChangelogUrlIdentity = publicUrlIdentity(record.reconciliation?.publicChangelogUrl);
  if (!evidenceArchiveUrlIdentity) fail("COMPLETE requires non-placeholder HTTPS reconciliation.evidenceArchiveUrl");
  if (!publicChangelogUrlIdentity) fail("COMPLETE requires non-placeholder HTTPS reconciliation.publicChangelogUrl");
  if (evidenceArchiveUrlIdentity && evidenceArchiveUrlIdentity === publicChangelogUrlIdentity) {
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
      if (!hasExactKeys(correction, ["correctionId", "status", "reportedAtUtc", "resolvedAtUtc", "publicNoticeUrl"])) fail(`correctionRecords[${index}] must contain exactly the reviewed correction fields`);
      if (!isUsableCorrectionId(correction.correctionId)) {
        fail(`correctionRecords[${index}].correctionId must be a portable, non-placeholder identifier`);
      } else if (correctionIds.has(normalizedCorrectionId(correction.correctionId))) {
        fail(`duplicate correction record: ${correction.correctionId}`);
      } else correctionIds.add(normalizedCorrectionId(correction.correctionId));
      if (correction.status !== "RESOLVED") fail(`correctionRecords[${index}].status must be RESOLVED before COMPLETE`);
      for (const field of ["reportedAtUtc", "resolvedAtUtc"]) {
        if (!isUtcTimestamp(correction[field])) fail(`correctionRecords[${index}].${field} must be a canonical ISO-8601 UTC timestamp`);
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
  const publicUrls = new Set([evidenceArchiveUrlIdentity, publicChangelogUrlIdentity].filter(Boolean));
  for (const [index, channel] of (record.reconciliation?.channelRecords ?? []).entries()) {
    if (!channel || typeof channel !== "object") { fail(`channelRecords[${index}] must be an object`); continue; }
    if (!hasExactKeys(channel, ["channel", "publicUrl", "checkedAtUtc", "status", "canonicalRoute", "mint", "mintAuthorityEvidence", "freezeAuthorityEvidence"])) fail(`channelRecords[${index}] must contain exactly the reviewed evidence fields`);
    const channelIdentity = normalizedChannelIdentity(channel.channel);
    if (!isUsableLabel(channel.channel)) fail(`channelRecords[${index}].channel must be trimmed, printable, and non-placeholder`);
    else if (channels.has(channelIdentity)) fail(`duplicate channel record: ${channel.channel}`); else channels.add(channelIdentity);
    const channelPublicUrlIdentity = publicUrlIdentity(channel.publicUrl);
    if (!channelPublicUrlIdentity) fail(`channelRecords[${index}].publicUrl must be non-placeholder HTTPS`);
    else if (publicUrls.has(channelPublicUrlIdentity)) fail(`channelRecords[${index}].publicUrl must be distinct from archive, changelog, and other channels`);
    else publicUrls.add(channelPublicUrlIdentity);
    if (!isUtcTimestamp(channel.checkedAtUtc)) fail(`channelRecords[${index}].checkedAtUtc must be a canonical ISO-8601 UTC timestamp`);
    else {
      const ageMinutes = (reconciliationCheckedAtMs - Date.parse(channel.checkedAtUtc)) / 60_000;
      if (ageMinutes < 0) fail(`channelRecords[${index}].checkedAtUtc cannot be after reconciliation.checkedAtUtc`);
      if (Date.parse(channel.checkedAtUtc) < packetSealedAtMs) fail(`channelRecords[${index}].checkedAtUtc cannot predate the sealed READY packet proof`);
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

const finalDependencyBundle = captureDependencyBundle(reviewedDependencyPaths);
if (!dependencyBundlesMatch(reviewedDependencyBundle, finalDependencyBundle, reviewedDependencyPaths)) {
  fail("canonical launch dependencies changed before reconciliation validation completed; repeat the reconciliation review");
}

if (process.exitCode) console.error("\nPost-Genesis reconciliation does not clear its archive gate.");
else console.log("\nPost-Genesis reconciliation structure passes. It never creates keys, signs, submits transactions, or establishes on-chain truth.");

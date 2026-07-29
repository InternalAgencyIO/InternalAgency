#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const canonicalProofPath = "launch/pre-publication-packet-proof.generated.json";
const canonicalPacketPath = "launch/release-packet.template.json";
const canonicalSnapshotPath = "launch/release-snapshot.generated.json";
const proofPath = process.argv[2] ?? canonicalProofPath;
const proofFields = [
  "version",
  "status",
  "scope",
  "sealedAtUtc",
  "releasePacketPath",
  "releasePacketSha256",
  "releaseSnapshotPath",
  "releaseSnapshotSha256",
  "approvalPacketDigest",
  "packetApprovedAtUtc",
  "artifactDigests",
];
const requiredScope = "Historical pre-publication READY-packet proof only; this record never authorizes signing, submission, publication, or a claim.";
const artifactDigestFields = [
  "manifestSha256",
  "publicationPayloadSha256",
  "signingChecklistSha256",
  "devnetRehearsalSha256",
  "mainnetHandoffSha256",
];
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const ok = (message) => console.log(`OK: ${message}`);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isCanonicalDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const hasCanonicalKeyOrder = (value, keys) => value && Object.keys(value).every(
  (key, index) => key === keys[index],
);
const reviewedInputBytes = new Map();
const readReviewedInput = (path) => {
  const bytes = readFileSync(path);
  reviewedInputBytes.set(path, bytes);
  return bytes;
};

let proof;
let proofWasRead = false;
if (proofPath !== canonicalProofPath || process.argv.length > 3) {
  fail(`proof path must be ${canonicalProofPath}`);
} else {
  try {
    proof = JSON.parse(readReviewedInput(proofPath).toString("utf8"));
    proofWasRead = true;
  } catch {
    fail(`proof must be readable JSON: ${proofPath}`);
  }
}

let packetBytes;
let packet;
if (proofWasRead) {
  const record = proof && typeof proof === "object" && !Array.isArray(proof) ? proof : {};
  if (!hasExactKeys(proof, proofFields)) fail("proof must contain only its exact canonical reviewed fields");
  if (record.version !== 1) fail("proof version must be 1");
  if (record.status !== "SEALED") fail("proof status must be SEALED");
  if (record.scope !== requiredScope) fail("proof scope must retain the non-authorizing boundary");
  if (!isUtcTimestamp(record.sealedAtUtc)) {
    fail("proof sealedAtUtc must be a canonical ISO-8601 UTC timestamp");
  } else if (Date.parse(record.sealedAtUtc) > Date.now() + 60_000) {
    fail("proof sealedAtUtc cannot be more than one minute in the future");
  }
  if (record.releasePacketPath !== canonicalPacketPath) {
    fail(`proof releasePacketPath must be ${canonicalPacketPath}`);
  } else {
    try {
      packetBytes = readReviewedInput(canonicalPacketPath);
      packet = JSON.parse(packetBytes.toString("utf8"));
    } catch {
      fail(`proof requires a readable canonical release packet: ${canonicalPacketPath}`);
    }
  }

  if (!isCanonicalDigest(record.releasePacketSha256)) {
    fail("proof releasePacketSha256 must be a lowercase SHA-256 digest");
  } else if (packetBytes && record.releasePacketSha256 !== sha256(packetBytes)) {
    fail("proof releasePacketSha256 does not match the canonical release-packet bytes");
  } else if (packetBytes) {
    ok("proof binds the canonical release-packet bytes");
  }

  if (record.releaseSnapshotPath !== canonicalSnapshotPath) {
    fail(`proof releaseSnapshotPath must be ${canonicalSnapshotPath}`);
  } else if (!isCanonicalDigest(record.releaseSnapshotSha256)) {
    fail("proof releaseSnapshotSha256 must be a lowercase SHA-256 digest");
  } else {
    try {
      const snapshotBytes = readReviewedInput(canonicalSnapshotPath);
      if (record.releaseSnapshotSha256 !== sha256(snapshotBytes)) {
        fail("proof releaseSnapshotSha256 does not match the canonical release-snapshot bytes");
      } else {
        ok("proof binds the canonical release-snapshot bytes");
      }
    } catch {
      fail(`proof requires a readable canonical release snapshot: ${canonicalSnapshotPath}`);
    }
  }

  if (!hasExactKeys(record.artifactDigests, artifactDigestFields)) {
    fail("proof artifactDigests must contain exactly the five canonical digest fields");
  } else {
    if (!hasCanonicalKeyOrder(record.artifactDigests, artifactDigestFields)) {
      fail("proof artifactDigests must retain the canonical packet-digest order");
    } else {
      ok("proof artifactDigests retain canonical packet-digest order");
    }
    for (const field of artifactDigestFields) {
      if (!isCanonicalDigest(record.artifactDigests[field])) {
        fail(`proof artifactDigests.${field} must be a lowercase SHA-256 digest`);
      }
      if (packet?.artifactDigests?.[field] !== record.artifactDigests[field]) {
        fail(`proof artifactDigests.${field} must match the sealed release packet`);
      }
    }
  }

  if (packet?.status !== "READY") fail("proof requires the sealed canonical release packet to remain READY");
  if (!isCanonicalDigest(record.approvalPacketDigest)) {
    fail("proof approvalPacketDigest must be a lowercase SHA-256 digest");
  }
  const orderedArtifactDigests = Object.fromEntries(
    artifactDigestFields.map((field) => [field, record.artifactDigests?.[field] ?? null]),
  );
  const expectedApprovalPacketDigest = sha256(JSON.stringify({
    packetVersion: 1,
    artifactDigests: orderedArtifactDigests,
  }));
  if (record.approvalPacketDigest !== expectedApprovalPacketDigest) {
    fail("proof approvalPacketDigest does not bind the ordered canonical artifact digests");
  } else if (packet?.approval?.packetDigest !== record.approvalPacketDigest) {
    fail("proof approvalPacketDigest must match the sealed release packet");
  } else {
    ok("proof approval packet digest binds the five canonical artifact digests");
  }

  if (!isUtcTimestamp(record.packetApprovedAtUtc)) {
    fail("proof packetApprovedAtUtc must be a canonical ISO-8601 UTC timestamp");
  } else if (packet?.approval?.approvedAtUtc !== record.packetApprovedAtUtc) {
    fail("proof packetApprovedAtUtc must match the sealed release packet");
  } else {
    ok("proof retains the sealed packet approval time");
  }
  if (isUtcTimestamp(record.sealedAtUtc) && isUtcTimestamp(record.packetApprovedAtUtc)) {
    const sealDelayMs = Date.parse(record.sealedAtUtc) - Date.parse(record.packetApprovedAtUtc);
    if (sealDelayMs < 0 || sealDelayMs > 30 * 60 * 1000) {
      fail("proof sealedAtUtc must be at or within 30 minutes after packetApprovedAtUtc");
    } else {
      ok("proof was sealed within the READY decision window");
    }
  }

  for (const [field, path] of Object.entries({
    signingChecklistSha256: "launch/genesis-signing-checklist.template.json",
    devnetRehearsalSha256: "launch/devnet-rehearsal.template.json",
    mainnetHandoffSha256: "launch/mainnet-handoff.template.json",
  })) {
    try {
      if (sha256(readReviewedInput(path)) !== record.artifactDigests?.[field]) {
        fail(`proof ${field} no longer matches ${path}`);
      } else {
        ok(`proof ${field} still matches ${path}`);
      }
    } catch {
      fail(`proof requires readable unchanged artifact ${path}`);
    }
  }
}

// A canonical input can change after its individual digest check but before
// success is reported. Re-read every file used by this validation so success
// describes one stable reviewed bundle rather than a sequence of stale reads.
if (!process.exitCode) {
  for (const [path, reviewedBytes] of reviewedInputBytes) {
    try {
      if (Buffer.compare(reviewedBytes, readFileSync(path)) !== 0) {
        fail(`proof validation input changed during validation: ${path}`);
        break;
      }
    } catch {
      fail(`proof validation input became unreadable during validation: ${path}`);
      break;
    }
  }
}

if (process.exitCode) {
  console.error("\nPre-publication packet proof is invalid; remain on HOLD or preserve the last valid sealed proof.");
} else {
  console.log("\nPre-publication packet proof is internally consistent. It never authorizes signing, submission, publication, or a launch claim.");
}

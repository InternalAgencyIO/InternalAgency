/**
 * Content-addressed review-manifest validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyReviewPath,
  generateReviewManifest,
  reviewLeafSha256,
  reviewTreeLevelsSha256,
  reviewTreeRootSha256,
} from "./generate-review-manifest.mjs";

const MANIFEST_PATH = fileURLToPath(new URL("./review-manifest.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const ROLES = ["ARTIFACT", "GENERATOR", "VALIDATOR", "TEST", "SUPPORTING_SOURCE"];

export function loadReviewManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

export function validateReviewManifest(manifest = loadReviewManifest()) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(manifest?.manifestVersion === 1, "review manifest version must equal one");
  expect(manifest?.manifestId === "iat-promotions-dlc-review-manifest-v1", "review manifest ID drift");
  expect(JSON.stringify(manifest?.status?.labels) === JSON.stringify(HOLD_LABELS), "review manifest HOLD labels drift");
  expect(manifest?.status?.network === "NONE", "review manifest must remain network-free");
  expect(manifest?.status?.programId === null, "review manifest must not claim a program ID");
  expect(manifest?.status?.deployable === false, "review manifest must remain undeployable");
  expect(manifest?.status?.manifestApplied === false, "review manifest must remain unapplied");
  expect(manifest?.hashContract?.hash === "SHA-256", "review hash algorithm drift");
  expect(manifest?.hashContract?.oddNode === "duplicate final node", "review odd-node rule drift");
  expect(manifest?.selfReference?.path === "review-manifest.v1.json", "review manifest self path drift");
  expect(manifest?.selfReference?.includedInTree === false, "review manifest must not claim a recursive self hash");

  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  const paths = entries.map((entry) => entry.path);
  expect(entries.length > 0, "review manifest must cover at least one file");
  expect(new Set(paths).size === paths.length, "review manifest path collision");
  const pathsAreStrings = paths.every((path) => typeof path === "string");
  expect(pathsAreStrings, "review manifest contains a non-string path");
  if (pathsAreStrings) {
    expect(JSON.stringify(paths) === JSON.stringify([...paths].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))), "review paths are not in UTF-8 byte order");
  }
  for (const entry of entries) {
    expect(typeof entry.path === "string" && entry.path.length > 0, "review entry path missing");
    expect(!entry.path?.includes("\\"), `review path uses a backslash: ${entry.path}`);
    expect(!entry.path?.startsWith("/") && !/^[A-Za-z]:/.test(entry.path ?? ""), `review path is absolute: ${entry.path}`);
    expect(!(entry.path ?? "").split("/").includes(".."), `review path traverses upward: ${entry.path}`);
    expect(entry.path !== "review-manifest.v1.json", "review manifest contains a recursive self entry");
    expect(ROLES.includes(entry.role), `unknown review role: ${entry.role}`);
    try {
      expect(entry.role === classifyReviewPath(entry.path), `review role drift: ${entry.path}`);
    } catch (error) {
      errors.push(error.message);
    }
    expect(/^(0|[1-9][0-9]*)$/.test(entry.normalizedByteLength ?? ""), `review byte length is not canonical: ${entry.path}`);
    expect(/^[0-9a-f]{64}$/.test(entry.contentSha256 ?? ""), `review content digest malformed: ${entry.path}`);
    expect(/^[0-9a-f]{64}$/.test(entry.leafSha256 ?? ""), `review leaf digest malformed: ${entry.path}`);
    try {
      expect(entry.leafSha256 === reviewLeafSha256(entry), `review leaf digest drift: ${entry.path}`);
    } catch (error) {
      errors.push(error.message);
    }
  }
  for (const role of ROLES) {
    const count = entries.filter((entry) => entry.role === role).length;
    expect(count > 0, `review manifest has no ${role} entry`);
    expect(manifest?.summary?.countsByRole?.[role] === String(count), `review role count drift: ${role}`);
  }
  const totalBytes = entries.reduce(
    (total, entry) =>
      /^(0|[1-9][0-9]*)$/.test(entry.normalizedByteLength ?? "")
        ? total + BigInt(entry.normalizedByteLength)
        : total,
    0n,
  );
  expect(manifest?.summary?.coveredFileCount === String(entries.length), "review covered-file count drift");
  expect(manifest?.summary?.totalNormalizedByteLength === String(totalBytes), "review total-byte count drift");
  if (entries.length > 0) {
    try {
      const levels = reviewTreeLevelsSha256(entries);
      const expectedVectors = {
        leafCount: String(entries.length),
        intermediateLevels: levels.slice(1).map((digests, index) => ({
          level: String(index + 1),
          nodeCount: String(digests.length),
          nodeSha256: digests,
        })),
      };
      expect(
        JSON.stringify(manifest?.merkleVectors) === JSON.stringify(expectedVectors),
        "review intermediate Merkle vectors drift",
      );
      expect(manifest?.treeRootSha256 === reviewTreeRootSha256(entries), "review tree root drift");
      expect(
        manifest?.merkleVectors?.intermediateLevels?.at(-1)?.nodeSha256?.[0] === manifest?.treeRootSha256,
        "review final Merkle vector does not equal the tree root",
      );
    } catch (error) {
      errors.push(error.message);
    }
  }
  try {
    expect(JSON.stringify(manifest) === JSON.stringify(generateReviewManifest()), "review manifest differs from deterministic generation");
  } catch (error) {
    errors.push(`deterministic review generation failed: ${error.message}`);
  }

  const serialized = JSON.stringify(manifest);
  expect(!/raw_x|x_user_id|x_handle|oauth|private_key|seed_phrase|mnemonic|signature/i.test(serialized), "review manifest leaks identity or signing fields");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateReviewManifest();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Review manifest reproduces, covers every non-self proposal file, and remains held.");
  }
}

/**
 * Deterministic, network-free review manifest for the Promotions DLC draft.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_PATH = fileURLToPath(new URL("./", import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL("./review-manifest.v1.json", import.meta.url));
const OUTPUT_RELATIVE_PATH = "review-manifest.v1.json";

const HOLD_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];
const LEAF_DOMAIN = "iat-promotions-dlc-review-leaf-v1";
const NODE_DOMAIN = "iat-promotions-dlc-review-node-v1";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest();
const sha256Hex = (bytes) => sha256(bytes).toString("hex");

function normalizeTextBytes(bytes, path) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`review file is not valid UTF-8 text: ${path}`);
  }
  return Buffer.from(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function classifyReviewPath(path) {
  const name = basename(path);
  if (path.startsWith("tests/") && name.endsWith(".test.mjs")) return "TEST";
  if ((name.startsWith("generate-") || name.startsWith("compose-")) && name.endsWith(".mjs")) {
    return "GENERATOR";
  }
  if (name.startsWith("validate-") && name.endsWith(".mjs")) return "VALIDATOR";
  if (name.endsWith(".md") || name.endsWith(".json")) return "ARTIFACT";
  if (name.endsWith(".mjs")) return "SUPPORTING_SOURCE";
  throw new Error(`unclassified proposal path: ${path}`);
}

function listReviewPaths(rootPath = ROOT_PATH) {
  const root = resolve(rootPath);
  const paths = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const normalized = relative(root, absolute).split(sep).join("/");
      if (!normalized || normalized.startsWith("../") || normalized.includes("/../")) {
        throw new Error(`review path escapes proposal root: ${normalized}`);
      }
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`symbolic links are forbidden: ${normalized}`);
      if (stat.isDirectory()) {
        visit(absolute);
      } else if (stat.isFile() && normalized !== OUTPUT_RELATIVE_PATH) {
        paths.push(normalized);
      } else if (!stat.isFile()) {
        throw new Error(`unsupported filesystem entry: ${normalized}`);
      }
    }
  };
  visit(root);
  return paths.sort(compareUtf8);
}

export function reviewLeafSha256(entry) {
  const contentDigest = Buffer.from(entry.contentSha256, "hex");
  if (contentDigest.length !== 32) throw new Error(`invalid content digest: ${entry.path}`);
  return sha256(
    Buffer.concat([
      Buffer.from(LEAF_DOMAIN, "utf8"),
      Buffer.from([0]),
      Buffer.from(entry.path, "utf8"),
      Buffer.from([0]),
      Buffer.from(entry.normalizedByteLength, "ascii"),
      Buffer.from([0]),
      contentDigest,
    ]),
  ).toString("hex");
}

export function reviewTreeRootSha256(entries) {
  if (entries.length === 0) throw new Error("review manifest cannot have an empty tree");
  let level = entries.map((entry) => Buffer.from(entry.leafSha256, "hex"));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(
        sha256(
          Buffer.concat([
            Buffer.from(NODE_DOMAIN, "utf8"),
            Buffer.from([0]),
            left,
            right,
          ]),
        ),
      );
    }
    level = next;
  }
  return level[0].toString("hex");
}

export function generateReviewManifest(rootPath = ROOT_PATH) {
  const root = resolve(rootPath);
  const entries = listReviewPaths(root).map((path) => {
    const normalizedBytes = normalizeTextBytes(readFileSync(resolve(root, path)), path);
    const entry = {
      path,
      role: classifyReviewPath(path),
      normalizedByteLength: String(normalizedBytes.length),
      contentSha256: sha256Hex(normalizedBytes),
    };
    return { ...entry, leafSha256: reviewLeafSha256(entry) };
  });
  const countsByRole = Object.fromEntries(
    ["ARTIFACT", "GENERATOR", "VALIDATOR", "TEST", "SUPPORTING_SOURCE"].map((role) => [
      role,
      String(entries.filter((entry) => entry.role === role).length),
    ]),
  );
  const totalNormalizedByteLength = entries.reduce(
    (total, entry) => total + BigInt(entry.normalizedByteLength),
    0n,
  );
  return {
    manifestVersion: 1,
    manifestId: "iat-promotions-dlc-review-manifest-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      manifestApplied: false,
    },
    hashContract: {
      hash: "SHA-256",
      contentBytes: "valid UTF-8 with CRLF and CR normalized to LF",
      pathBytes: "UTF-8 forward-slash proposal-relative path",
      ordering: "ascending unsigned UTF-8 path bytes",
      leafDomain: LEAF_DOMAIN,
      leafPreimage: "domain || 0x00 || path || 0x00 || normalizedByteLength || 0x00 || rawContentSha256",
      nodeDomain: NODE_DOMAIN,
      nodePreimage: "domain || 0x00 || rawLeftSha256 || rawRightSha256",
      oddNode: "duplicate final node",
    },
    selfReference: {
      path: OUTPUT_RELATIVE_PATH,
      includedInTree: false,
      reason: "A manifest cannot contain its own content digest without a recursive fixed-point claim.",
    },
    summary: {
      coveredFileCount: String(entries.length),
      totalNormalizedByteLength: String(totalNormalizedByteLength),
      countsByRole,
    },
    entries,
    treeRootSha256: reviewTreeRootSha256(entries),
  };
}

export function renderReviewManifest(rootPath = ROOT_PATH) {
  return `${JSON.stringify(generateReviewManifest(rootPath), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderReviewManifest();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote deterministic proposal review manifest; no network or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}

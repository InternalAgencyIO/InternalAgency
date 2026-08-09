/**
 * Deterministic public unsigned review-payload vectors.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  encodeUnsignedReviewReceiptPayload,
  REVIEW_DECISIONS,
  REVIEW_PAYLOAD_DOMAIN,
  REVIEW_PAYLOAD_KEYS,
  REVIEW_PULL_REQUEST_NUMBER,
  REVIEW_REPOSITORY,
} from "./independent-review-receipt-payload.mjs";

const TEMPLATE_PATH = fileURLToPath(new URL("./independent-review-receipt-template.v1.json", import.meta.url));
const CODEC_PATH = fileURLToPath(new URL("./independent-review-receipt-payload.mjs", import.meta.url));
const OUTPUT_PATH = fileURLToPath(
  new URL("./independent-review-receipt-payload-vectors.v1.json", import.meta.url),
);
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const fixtureDigest = (label) => sha256Hex(`iat-promotions-dlc-review-payload:${label}`);
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));

export function buildUnsignedReviewPayloadFixture(decision) {
  if (!(decision in REVIEW_DECISIONS)) throw new Error(`unknown fixture decision: ${decision}`);
  return {
    gitCommitSha: fixtureDigest("git-commit").slice(0, 40),
    reviewManifestContentSha256: fixtureDigest("review-manifest"),
    reviewTreeRootSha256: fixtureDigest("review-tree-root"),
    coveredFileCount: "79",
    scopeCanonicalSha256: fixtureDigest("review-scope"),
    accountabilityLabel: "SYNTHETIC INDEPENDENT REVIEWER",
    reviewerIdentityCommitmentSha256: fixtureDigest("reviewer-identity"),
    independenceDeclaration: true,
    decision,
    rationaleCanonicalSha256: fixtureDigest(`rationale:${decision}`),
    findingsCommitmentSha256: fixtureDigest(`findings:${decision}`),
    reviewedAtUnixSeconds: "1800000000",
    activationAuthorized: false,
    activationEffect: "NONE",
  };
}

export function generateIndependentReviewPayloadVectors() {
  const template = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-independent-review-payload-vectors-v1",
    status: {
      labels: ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"],
      network: "NONE",
      programId: null,
      deployable: false,
      payloadContractApplied: false,
      containsKeys: false,
      containsSignatures: false,
    },
    sources: {
      receiptTemplate: {
        path: "independent-review-receipt-template.v1.json",
        canonicalSha256: canonicalSha256(template),
      },
      payloadCodec: {
        path: "independent-review-receipt-payload.mjs",
        normalizedTextSha256: normalizedTextSha256(CODEC_PATH),
      },
    },
    contract: {
      domain: REVIEW_PAYLOAD_DOMAIN,
      repository: REVIEW_REPOSITORY,
      pullRequestNumber: String(REVIEW_PULL_REQUEST_NUMBER),
      payloadVersion: 1,
      fieldOrder: REVIEW_PAYLOAD_KEYS,
      integerEndian: "little",
      integerJsonRepresentation: "canonical-decimal-string",
      byteStringRepresentation: "lowercase-hex",
      activationAuthorized: false,
      activationEffect: "NONE",
      attestationIncluded: false,
    },
    vectors: Object.keys(REVIEW_DECISIONS).map((decision) => {
      const input = buildUnsignedReviewPayloadFixture(decision);
      const message = encodeUnsignedReviewReceiptPayload(input);
      return {
        name: decision,
        input,
        messageLength: String(message.length),
        messageHex: message.toString("hex"),
        messageSha256: sha256Hex(message),
      };
    }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = `${JSON.stringify(generateIndependentReviewPayloadVectors(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote unsigned review-payload vectors; no key or signature was created.");
  } else {
    process.stdout.write(rendered);
  }
}

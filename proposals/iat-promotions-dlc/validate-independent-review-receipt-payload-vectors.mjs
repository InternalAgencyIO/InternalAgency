/**
 * Unsigned independent-review payload-vector validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  generateIndependentReviewPayloadVectors,
} from "./generate-independent-review-receipt-payload-vectors.mjs";
import {
  decodeUnsignedReviewReceiptPayload,
  encodeUnsignedReviewReceiptPayload,
  REVIEW_DECISIONS,
  REVIEW_PAYLOAD_KEYS,
} from "./independent-review-receipt-payload.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./independent-review-receipt-payload-vectors.v1.json", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadIndependentReviewPayloadVectors() {
  return JSON.parse(readFileSync(VECTOR_PATH, "utf8"));
}

export function validateIndependentReviewPayloadVectors(
  vectors = loadIndependentReviewPayloadVectors(),
) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "unsigned review vector version drift");
  expect(
    vectors?.vectorId === "iat-promotions-dlc-independent-review-payload-vectors-v1",
    "unsigned review vector ID drift",
  );
  expect(JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS), "unsigned review HOLD labels drift");
  expect(vectors?.status?.network === "NONE", "unsigned review vectors must remain network-free");
  expect(vectors?.status?.programId === null, "unsigned review vectors must not claim a program ID");
  expect(vectors?.status?.deployable === false, "unsigned review vectors must remain undeployable");
  expect(vectors?.status?.payloadContractApplied === false, "unsigned review payload contract must remain unapplied");
  expect(vectors?.status?.containsKeys === false, "unsigned review vectors claim key material");
  expect(vectors?.status?.containsSignatures === false, "unsigned review vectors claim signatures");
  expect(vectors?.contract?.attestationIncluded === false, "unsigned review vectors include attestation material");
  expect(vectors?.contract?.activationAuthorized === false, "unsigned review vectors authorize activation");
  expect(vectors?.contract?.activationEffect === "NONE", "unsigned review vectors have activation effect");
  expect(
    JSON.stringify(vectors?.contract?.fieldOrder) === JSON.stringify(REVIEW_PAYLOAD_KEYS),
    "unsigned review field order drift",
  );
  expect(
    JSON.stringify(vectors?.vectors?.map((vector) => vector.name)) ===
      JSON.stringify(Object.keys(REVIEW_DECISIONS)),
    "unsigned review decision-vector set drift",
  );

  for (const vector of vectors?.vectors ?? []) {
    try {
      expect(JSON.stringify(Object.keys(vector.input)) === JSON.stringify(REVIEW_PAYLOAD_KEYS), `${vector.name} input field order drift`);
      expect(vector.input.decision === vector.name, `${vector.name} decision binding drift`);
      expect(vector.input.independenceDeclaration === true, `${vector.name} independence declaration drift`);
      expect(vector.input.activationAuthorized === false, `${vector.name} activation authorization drift`);
      expect(vector.input.activationEffect === "NONE", `${vector.name} activation effect drift`);
      const message = encodeUnsignedReviewReceiptPayload(vector.input);
      expect(vector.messageHex === message.toString("hex"), `${vector.name} message bytes drift`);
      expect(vector.messageLength === String(message.length), `${vector.name} message length drift`);
      expect(
        vector.messageSha256 === createHash("sha256").update(message).digest("hex"),
        `${vector.name} message digest drift`,
      );
      expect(
        JSON.stringify(decodeUnsignedReviewReceiptPayload(message)) === JSON.stringify(vector.input),
        `${vector.name} round-trip drift`,
      );
    } catch (error) {
      errors.push(`${vector?.name ?? "unknown vector"}: ${error.message}`);
    }
  }
  expect(
    JSON.stringify(vectors) === JSON.stringify(generateIndependentReviewPayloadVectors()),
    "unsigned review vectors differ from deterministic generation",
  );
  const serialized = JSON.stringify(vectors);
  for (const forbidden of ["publicKeyHex", "signatureHex", "privateKey", "secretKey", "seedPhrase", "mnemonic", "rawXUserId", "xHandle"]) {
    expect(!serialized.includes(`"${forbidden}"`), `unsigned review vectors expose forbidden field: ${forbidden}`);
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateIndependentReviewPayloadVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Unsigned review-payload vectors reproduce without keys, signatures, or activation authority.");
  }
}

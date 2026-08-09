/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { fileURLToPath } from "node:url";

import {
  composeProgramInterfacePreview,
  loadCompositionBundle,
} from "./compose-program-interface-preview.mjs";
import { generateComposedInterfaceVectors } from "./generate-composed-interface-vectors.mjs";
import { validateKeyLifecycleAmendment } from "./validate-key-lifecycle-amendment.mjs";
import { validateProgramInterface } from "./validate-program-interface.mjs";
import {
  decodeInstruction,
  encodeInstruction,
  instructionEncodedLength,
} from "./program-interface-codec.mjs";

const STATUS_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];
const FORBIDDEN_EXTERNAL_ACCOUNT_PATTERN =
  /(treasury|ecosystem|liquidity|core_team|staking_reserve|mint_authority|v2_upgrade)/i;

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateProgramInterfaceComposition(bundle) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  for (const error of validateProgramInterface(bundle.base)) errors.push(`base: ${error}`);
  for (const error of validateKeyLifecycleAmendment(bundle.amendment)) {
    errors.push(`amendment: ${error}`);
  }

  let expected;
  try {
    expected = composeProgramInterfacePreview(bundle);
  } catch (error) {
    errors.push(`composition failed: ${error.message}`);
    return errors;
  }
  expect(jsonEqual(bundle.preview, expected), "preview differs from deterministic composition");
  let expectedComposedVectors;
  try {
    expectedComposedVectors = generateComposedInterfaceVectors(bundle);
  } catch (error) {
    errors.push(`composed-vector generation failed: ${error.message}`);
  }
  if (expectedComposedVectors) {
    expect(
      jsonEqual(bundle.composedVectors, expectedComposedVectors),
      "composed vectors differ from deterministic generation",
    );
  }

  const status = bundle.preview?.status ?? {};
  expect(jsonEqual(status.labels, STATUS_LABELS), "preview public status labels mismatch");
  expect(status.network === "NONE", "preview must remain network-free");
  expect(status.programId === null, "preview must not claim a program ID");
  expect(status.deployable === false, "preview must remain undeployable");
  expect(status.baseV0Deployable === false, "preview must preserve the v0 HOLD");
  expect(status.amendmentApplied === false, "preview must preserve unapplied amendment state");
  expect(status.compositionApplied === false, "preview must remain an unapplied composition");

  expect(
    bundle.preview.accounts.length === bundle.base.accounts.length + bundle.amendment.accounts.length,
    "composed account count mismatch",
  );
  expect(
    bundle.preview.instructions.length ===
      bundle.base.instructions.length + bundle.amendment.instructions.length,
    "composed instruction count mismatch",
  );

  const campaign = bundle.preview.accounts.find((account) => account.name === "Campaign");
  expect(
    campaign?.fields.some((field) => field.name === "verifier_registry"),
    "composed Campaign registry field missing",
  );
  expect(
    !campaign?.fields.some((field) => field.name === "verifier_ed25519_key"),
    "composed Campaign still has inline verifier key",
  );
  const initializer = bundle.preview.instructions.find(
    (instruction) => instruction.name === "initialize_campaign",
  );
  expect(
    !initializer?.data.some((field) => field.name === "verifier_ed25519_key"),
    "composed initializer still has inline verifier key data",
  );

  for (const instructionName of bundle.amendment.baseInterfaceChanges.attestationInstructions) {
    const instruction = bundle.preview.instructions.find(
      (candidate) => candidate.name === instructionName,
    );
    for (const accountName of bundle.amendment.baseInterfaceChanges.requiredReadOnlyAccounts) {
      const matches = instruction?.accounts.filter((account) => account.name === accountName) ?? [];
      expect(matches.length === 1, `${instructionName} ${accountName} composition mismatch`);
      expect(
        matches[0]?.signer === false && matches[0]?.writable === false,
        `${instructionName} ${accountName} must remain read-only`,
      );
    }
    for (const guard of bundle.amendment.baseInterfaceChanges.requiredAttestationGuards) {
      expect(instruction?.guards.includes(guard), `${instructionName} composed guard missing: ${guard}`);
    }
  }

  const allEntries = [...bundle.preview.accounts, ...bundle.preview.instructions];
  const discriminators = allEntries.map((entry) => entry.discriminatorHex);
  expect(new Set(discriminators).size === discriminators.length, "cross-interface discriminator collision");
  for (const instruction of bundle.preview.instructions) {
    const forbidden = instruction.accounts.filter(
      (account) => account.writable && FORBIDDEN_EXTERNAL_ACCOUNT_PATTERN.test(account.name),
    );
    expect(forbidden.length === 0, `${instruction.name} writes a forbidden external account`);
  }

  const vectorByName = new Map(
    bundle.composedVectors.vectors.map((vector) => [vector.name, vector]),
  );
  expect(vectorByName.size === bundle.preview.instructions.length, "composed vector count mismatch");
  for (const instruction of bundle.preview.instructions) {
    const vector = vectorByName.get(instruction.name);
    expect(Boolean(vector), `${instruction.name} composed vector missing`);
    expect(
      vector?.expectedHex.startsWith(instruction.discriminatorHex),
      `${instruction.name} vector discriminator drift`,
    );
    expect(
      vector?.expectedHex.length / 2 === instructionEncodedLength(instruction.name, bundle.preview),
      `${instruction.name} composed vector length drift`,
    );
    if (vector) {
      try {
        const encoded = encodeInstruction(instruction.name, vector.data, bundle.preview);
        expect(encoded.toString("hex") === vector.expectedHex, `${instruction.name} composed vector bytes drift`);
        expect(
          jsonEqual(decodeInstruction(encoded, bundle.preview), {
            name: instruction.name,
            data: vector.data,
          }),
          `${instruction.name} composed vector round-trip drift`,
        );
      } catch (error) {
        errors.push(`${instruction.name} composed vector codec failure: ${error.message}`);
      }
    }
  }

  const forbiddenCapabilities = new Set(bundle.preview.forbiddenCapabilities);
  for (const capability of [
    ...bundle.base.forbiddenCapabilities,
    ...bundle.amendment.forbiddenCapabilities,
  ]) {
    expect(forbiddenCapabilities.has(capability), `composed forbidden capability missing: ${capability}`);
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateProgramInterfaceComposition(loadCompositionBundle());
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Composed-interface preview exactly matches its held, unapplied sources.");
  }
}

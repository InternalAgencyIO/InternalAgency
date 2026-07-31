/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decodeInstruction,
  deriveDiscriminatorHex,
  encodeInstruction,
  instructionEncodedLength,
} from "../program-interface-codec.mjs";
import {
  loadKeyLifecycleAmendment,
  validateKeyLifecycleAmendment,
} from "../validate-key-lifecycle-amendment.mjs";

const amendment = loadKeyLifecycleAmendment();
const vectors = JSON.parse(
  readFileSync(
    new URL("../program-interface-key-lifecycle-vectors.v1.json", import.meta.url),
    "utf8",
  ),
);
const clone = (value) => structuredClone(value);

test("the unapplied verifier-registry amendment passes every structural guard", () => {
  assert.deepEqual(validateKeyLifecycleAmendment(amendment), []);
  assert.equal(amendment.status.network, "NONE");
  assert.equal(amendment.status.programId, null);
  assert.equal(amendment.status.baseV0Deployable, false);
  assert.equal(amendment.status.amendmentApplied, false);
});

test("all amendment account sizes and discriminators are deterministic", () => {
  const discriminators = [];
  for (const account of amendment.accounts) {
    assert.equal(
      account.discriminatorHex,
      deriveDiscriminatorHex("account", account.name, amendment),
    );
    assert.equal(
      account.sizeBytes,
      amendment.codec.discriminatorBytes +
        account.fields.reduce((total, field) => total + field.sizeBytes, 0),
    );
    discriminators.push(account.discriminatorHex);
  }
  for (const instruction of amendment.instructions) {
    assert.equal(
      instruction.discriminatorHex,
      deriveDiscriminatorHex("instruction", instruction.name, amendment),
    );
    discriminators.push(instruction.discriminatorHex);
  }
  assert.equal(new Set(discriminators).size, discriminators.length);
});

test("every amendment instruction matches its public vector and round-trips", () => {
  assert.equal(vectors.amendmentVersion, 1);
  assert.equal(vectors.status.network, "NONE");
  assert.equal(vectors.status.programId, null);
  assert.equal(vectors.status.amendmentApplied, false);
  assert.equal(vectors.vectors.length, amendment.instructions.length);

  for (const vector of vectors.vectors) {
    const encoded = encodeInstruction(vector.name, vector.data, amendment);
    assert.equal(encoded.toString("hex"), vector.expectedHex, vector.name);
    assert.equal(encoded.length, instructionEncodedLength(vector.name, amendment));
    assert.deepEqual(decodeInstruction(encoded, amendment), {
      name: vector.name,
      data: vector.data,
    });
  }
});

test("deployment claims and removed review gates invalidate the amendment", () => {
  const mutated = clone(amendment);
  mutated.status.network = "mainnet-beta";
  mutated.status.programId = "11111111111111111111111111111111";
  mutated.status.baseV0Deployable = true;
  mutated.status.amendmentApplied = true;
  mutated.reviewGate.separateSecurityReviewRequired = false;
  mutated.reviewGate.independentReviewerApprovalRequired = false;
  mutated.reviewGate.devnetRehearsalRequired = false;
  const errors = validateKeyLifecycleAmendment(mutated);

  assert.ok(errors.includes("amendment must remain network-free"));
  assert.ok(errors.includes("amendment must not claim a program ID"));
  assert.ok(errors.includes("v0 must remain explicitly undeployable"));
  assert.ok(errors.includes("amendment must remain unapplied"));
  assert.ok(errors.includes("security review gate missing"));
  assert.ok(errors.includes("independent review gate missing"));
  assert.ok(errors.includes("Devnet rehearsal gate missing"));
});

test("money-account, secret-field, and layout mutations invalidate the amendment", () => {
  const mutated = clone(amendment);
  mutated.accounts[0].sizeBytes += 1;
  mutated.accounts[1].fields.push({ name: "private_key", type: "bytes32", sizeBytes: 32 });
  mutated.instructions[4].accounts.push({
    name: "promotion_vault",
    writable: true,
    signer: false,
  });
  const errors = validateKeyLifecycleAmendment(mutated);

  assert.ok(errors.includes("VerifierRegistry size mismatch"));
  assert.ok(errors.includes("VerifierKeyRecord contains a secret-bearing field name"));
  assert.ok(errors.includes("VerifierKeyRecord size mismatch"));
  assert.ok(
    errors.includes("emergency_disable_verifier_registry includes a forbidden money or V2 account"),
  );
});

test("weakened schedule, emergency, and optional-account guards invalidate the amendment", () => {
  const mutated = clone(amendment);
  const schedule = mutated.instructions.find(
    (instruction) => instruction.name === "schedule_verifier_key_rotation",
  );
  schedule.guards = schedule.guards.filter(
    (guard) => ![
      "NO_PENDING_ROTATION",
      "REVIEW_RECEIPT_MUST_NOT_EXIST",
      "ACTIVATE_AT_AT_LEAST_NOW_PLUS_86400",
      "OVERLAP_NOT_ABOVE_3600",
      "NEW_KEY_RECORD_MUST_NOT_EXIST",
      "IDENTITY_DOMAIN_IMMUTABLE",
    ].includes(guard),
  );
  const emergency = mutated.instructions.find(
    (instruction) => instruction.name === "emergency_disable_verifier_registry",
  );
  emergency.guards = emergency.guards.filter(
    (guard) => ![
      "DISABLED_AT_WRITTEN_FROM_CLOCK",
      "PENDING_UNACTIVATED_KEY_CANCELLED_IF_PRESENT",
      "EMERGENCY_DISABLE_TERMINAL",
      "NO_REENABLE_PATH",
    ].includes(guard),
  );
  emergency.accounts.find((account) => account.name === "pending_key_record").optional = false;
  const errors = validateKeyLifecycleAmendment(mutated);

  assert.ok(errors.includes("schedule guard missing: NO_PENDING_ROTATION"));
  assert.ok(errors.includes("schedule guard missing: REVIEW_RECEIPT_MUST_NOT_EXIST"));
  assert.ok(errors.includes("schedule guard missing: ACTIVATE_AT_AT_LEAST_NOW_PLUS_86400"));
  assert.ok(errors.includes("schedule guard missing: OVERLAP_NOT_ABOVE_3600"));
  assert.ok(errors.includes("schedule guard missing: NEW_KEY_RECORD_MUST_NOT_EXIST"));
  assert.ok(errors.includes("schedule guard missing: IDENTITY_DOMAIN_IMMUTABLE"));
  assert.ok(errors.includes("emergency guard missing: DISABLED_AT_WRITTEN_FROM_CLOCK"));
  assert.ok(errors.includes("emergency guard missing: EMERGENCY_DISABLE_TERMINAL"));
  assert.ok(errors.includes("emergency guard missing: NO_REENABLE_PATH"));
  assert.ok(errors.includes("emergency optional account contract mismatch"));
});

test("base attestation binding and forbidden-capability mutations invalidate the amendment", () => {
  const mutated = clone(amendment);
  mutated.baseInterfaceChanges.requiredReadOnlyAccounts = ["verifier_registry"];
  mutated.baseInterfaceChanges.requiredAttestationGuards =
    mutated.baseInterfaceChanges.requiredAttestationGuards.filter(
      (guard) => guard !== "KEY_NOT_RETIRED_AT_ISSUED_AT",
    );
  mutated.referencePolicy.reenableInstructionExists = true;
  mutated.forbiddenCapabilities = mutated.forbiddenCapabilities.filter(
    (capability) => capability !== "REENABLE_VERIFIER_REGISTRY",
  );
  mutated.instructions.push({
    name: "reenable_verifier_registry",
    discriminatorHex: "0000000000000000",
    accounts: [],
    data: [],
    guards: ["REOPEN"],
  });
  const errors = validateKeyLifecycleAmendment(mutated);

  assert.ok(errors.includes("attestation read-only account amendment mismatch"));
  assert.ok(errors.includes("attestation guard missing: KEY_NOT_RETIRED_AT_ISSUED_AT"));
  assert.ok(errors.includes("re-enable path must not exist"));
  assert.ok(errors.includes("instruction set or order mismatch"));
  assert.ok(errors.includes("forbidden lifecycle instruction exists"));
  assert.ok(errors.includes("forbidden capability missing: REENABLE_VERIFIER_REGISTRY"));
});

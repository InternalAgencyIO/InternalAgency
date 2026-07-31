/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalSha256,
  composeProgramInterfacePreview,
  loadCompositionBundle,
} from "../compose-program-interface-preview.mjs";
import { validateProgramInterfaceComposition } from "../validate-program-interface-composition.mjs";

const bundle = loadCompositionBundle();
const clone = (value) => structuredClone(value);

test("the full composition preview is deterministic and remains explicitly unapplied", () => {
  assert.deepEqual(validateProgramInterfaceComposition(bundle), []);
  assert.deepEqual(composeProgramInterfacePreview(bundle), bundle.preview);
  assert.equal(bundle.preview.status.deployable, false);
  assert.equal(bundle.preview.status.amendmentApplied, false);
  assert.equal(bundle.preview.status.compositionApplied, false);
});

test("composition source digests bind both interfaces and both vector artifacts", () => {
  const expected = [
    ["program-interface.v0.json", bundle.base],
    ["program-interface-key-lifecycle-amendment.v1.json", bundle.amendment],
    ["program-interface-vectors.v0.json", bundle.baseVectors],
    ["program-interface-key-lifecycle-vectors.v1.json", bundle.amendmentVectors],
  ];
  assert.deepEqual(
    bundle.preview.compositionSources,
    expected.map(([path, value]) => ({ path, canonicalSha256: canonicalSha256(value) })),
  );
});

test("composition replaces inline verifier state without changing Campaign size", () => {
  const baseCampaign = bundle.base.accounts.find((account) => account.name === "Campaign");
  const campaign = bundle.preview.accounts.find((account) => account.name === "Campaign");
  const initializer = bundle.preview.instructions.find(
    (instruction) => instruction.name === "initialize_campaign",
  );

  assert.equal(campaign.sizeBytes, baseCampaign.sizeBytes);
  assert.equal(campaign.fields.some((field) => field.name === "verifier_registry"), true);
  assert.equal(campaign.fields.some((field) => field.name === "verifier_ed25519_key"), false);
  assert.equal(initializer.data.some((field) => field.name === "verifier_ed25519_key"), false);
});

test("every attestation consumer gets the registry, key record, and exact required guards", () => {
  const changes = bundle.amendment.baseInterfaceChanges;
  for (const name of changes.attestationInstructions) {
    const instruction = bundle.preview.instructions.find((candidate) => candidate.name === name);
    const insertionPoint = instruction.accounts.findIndex(
      (account) => account.name === changes.attestationAccountInsertionBefore,
    );
    assert.deepEqual(
      instruction.accounts.slice(insertionPoint - 2, insertionPoint),
      changes.requiredReadOnlyAccounts.map((accountName) => ({
        name: accountName,
        signer: false,
        writable: false,
      })),
    );
    for (const guard of changes.requiredAttestationGuards) {
      assert.equal(instruction.guards.includes(guard), true, `${name}: ${guard}`);
    }
  }
});

test("a base-interface mutation is detected as cross-interface drift", () => {
  const mutated = clone(bundle);
  mutated.base.instructions.find((instruction) => instruction.name === "settle_pair").guards.push(
    "UNREVIEWED_GUARD",
  );
  const errors = validateProgramInterfaceComposition(mutated);
  assert.ok(errors.includes("preview differs from deterministic composition"));
});

test("an amendment mutation is detected as cross-interface drift", () => {
  const mutated = clone(bundle);
  mutated.amendment.baseInterfaceChanges.requiredAttestationGuards.push("UNREVIEWED_GUARD");
  const errors = validateProgramInterfaceComposition(mutated);
  assert.ok(errors.includes("preview differs from deterministic composition"));
});

test("vector removal and discriminator changes cannot hide behind a stale preview", () => {
  const missing = clone(bundle);
  missing.baseVectors.vectors.pop();
  assert.ok(
    validateProgramInterfaceComposition(missing).some((error) =>
      error.includes("base/amendment vector coverage or order mismatch"),
    ),
  );

  const changed = clone(bundle);
  changed.amendmentVectors.vectors[0].expectedHex =
    `0000000000000000${changed.amendmentVectors.vectors[0].expectedHex.slice(16)}`;
  const errors = validateProgramInterfaceComposition(changed);
  assert.ok(errors.includes("preview differs from deterministic composition"));
  assert.ok(errors.includes("initialize_verifier_registry vector discriminator drift"));
});

test("cross-domain account and instruction discriminator collisions stop composition", () => {
  const accountCollision = clone(bundle);
  accountCollision.amendment.accounts[0].discriminatorHex =
    accountCollision.base.accounts[0].discriminatorHex;
  assert.throws(
    () => composeProgramInterfacePreview(accountCollision),
    /account discriminator collision/,
  );

  const instructionCollision = clone(bundle);
  instructionCollision.amendment.instructions[0].discriminatorHex =
    instructionCollision.base.instructions[0].discriminatorHex;
  assert.throws(
    () => composeProgramInterfacePreview(instructionCollision),
    /instruction discriminator collision/,
  );
});

test("deployment claims and writable external accounts are rejected", () => {
  const mutated = clone(bundle);
  mutated.preview.status.deployable = true;
  mutated.preview.status.network = "mainnet-beta";
  mutated.preview.status.programId = "11111111111111111111111111111111";
  mutated.preview.instructions[0].accounts.push({
    name: "treasury",
    signer: false,
    writable: true,
  });
  const errors = validateProgramInterfaceComposition(mutated);
  assert.ok(errors.includes("preview differs from deterministic composition"));
  assert.ok(errors.includes("preview must remain network-free"));
  assert.ok(errors.includes("preview must not claim a program ID"));
  assert.ok(errors.includes("preview must remain undeployable"));
  assert.ok(errors.includes("initialize_campaign writes a forbidden external account"));
});

test("composition refuses an applied amendment or released v0 gate", () => {
  for (const field of ["amendmentApplied", "baseV0Deployable"]) {
    const mutated = clone(bundle);
    mutated.amendment.status[field] = true;
    assert.throws(
      () => composeProgramInterfacePreview(mutated),
      /composition requires unapplied amendment and held v0/,
    );
  }
});

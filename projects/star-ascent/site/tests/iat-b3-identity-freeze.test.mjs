import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  IAT_V2_PROGRAM_ID,
  TEST_FIXTURE_IDENTITIES as FIXTURE_IDENTITIES,
  assertIdentityFreezeReady,
  validateIdentityFreezeManifest,
} from "../scripts/validate-iat-b3-identity-freeze.mjs";

const draft = JSON.parse(readFileSync(
  new URL("../docs/b3/iat-b3-identity-freeze.v1.json", import.meta.url),
  "utf8",
));

function clone(value) {
  return structuredClone(value);
}

function completeFixture() {
  const manifest = clone(draft);
  manifest.profile = "TEST_FIXTURE";
  manifest.readiness = "READY";

  Object.assign(manifest.identities, FIXTURE_IDENTITIES, { status: "FROZEN", blocker: null });
  delete manifest.identities.genesisHash;
  Object.assign(manifest.clusterPolicy, {
    status: "FROZEN",
    identityPolicy: "SAME_LAW_ECONOMY_AND_MINT_IDS_ACROSS_CLUSTERS",
    blocker: null,
  });
  Object.assign(manifest.networkBinding, {
    status: "FROZEN",
    genesisHash: FIXTURE_IDENTITIES.genesisHash,
    blocker: null,
  });
  Object.assign(manifest.entropy, { status: "FROZEN", lagSlots: 200, blocker: null });
  for (const seed of manifest.seedTable) Object.assign(seed, { status: "FROZEN", blocker: null });
  Object.assign(manifest.mintConfig, {
    status: "FROZEN",
    metadataPolicy: "NO_MINT_METADATA_EXTENSION_IMMUTABLE_EXTERNAL_RECORD",
    blocker: null,
  });
  manifest.mintConfig.transferHook.programId = FIXTURE_IDENTITIES.lawProgramId;
  Object.assign(manifest.genesis, { status: "FROZEN", blocker: null });
  Object.assign(manifest.sealOrder, { status: "FROZEN", blocker: null });
  return manifest;
}

function expectBlocked(mutator, pattern) {
  const manifest = completeFixture();
  mutator(manifest);
  const result = validateIdentityFreezeManifest(manifest, { allowTestFixture: true });
  assert.equal(result.identityFreezeReady, false);
  assert.match(result.violations.join("\n"), pattern);
}

test("the production identity-freeze draft is honestly BLOCKED and never claims release readiness", () => {
  const result = validateIdentityFreezeManifest(draft);
  assert.equal(result.valid, true);
  assert.equal(result.identityFreezeReady, false);
  assert.equal(result.productionIdentityReady, false);
  assert.equal("productionReady" in result, false);
  assert.ok(result.blockers.length >= 7);
  assert.match(result.blockers.join("\n"), /production law program, economy program, and canonical Token-2022 mint/iu);
  assert.match(result.blockers.join("\n"), /150 slots is provisional/iu);
  assert.match(result.blockers.join("\n"), /Faction scoring, carve-out, and epoch rules/iu);
  assert.deepEqual(draft.scope.doesNotCertify, [
    "FACTION_ECONOMICS",
    "GENESIS_ALLOCATION_AMOUNTS_OR_CONSERVATION_EVIDENCE",
    "REVIEWED_BINARY_HASHES_OR_DEPLOYED_BYTES",
    "MAINNET_OR_RELEASE_READINESS",
  ]);
  assert.throws(() => assertIdentityFreezeReady(draft), /identity freeze is not ready/iu);
});

test("a complete, explicitly test-only freeze fixture passes every semantic check", () => {
  const manifest = completeFixture();
  const result = validateIdentityFreezeManifest(manifest, { allowTestFixture: true });
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.valid, true);
  assert.equal(result.identityFreezeReady, true);
  assert.equal(result.productionIdentityReady, false);
  assert.equal(assertIdentityFreezeReady(manifest, { allowTestFixture: true }).identityFreezeReady, true);

  const productionAttempt = validateIdentityFreezeManifest(manifest);
  assert.equal(productionAttempt.identityFreezeReady, false);
  assert.match(productionAttempt.violations.join("\n"), /requires explicit allowTestFixture/u);
});

test("fixture identities cannot be relabeled as production", () => {
  const relabeled = completeFixture();
  relabeled.profile = "PRODUCTION";
  const result = validateIdentityFreezeManifest(relabeled, { allowTestFixture: true });
  assert.equal(result.identityFreezeReady, false);
  assert.equal(result.productionIdentityReady, false);
  for (const path of [
    "identities.lawProgramId",
    "identities.economyProgramId",
    "identities.canonicalMint",
    "networkBinding.genesisHash",
  ]) {
    assert.match(result.violations.join("\n"), new RegExp(`${path.replace(".", "\\.")}: known TEST_FIXTURE identity`, "u"));
  }
});

test("identities fail closed on placeholders, malformed keys, collisions, V2, and disposable IDs", () => {
  expectBlocked((value) => { value.identities.lawProgramId = "PENDING"; }, /placeholder identity/u);
  expectBlocked((value) => { value.identities.lawProgramId = "not-a-base58-0-key"; }, /canonical Base58 value/u);
  expectBlocked((value) => { value.identities.economyProgramId = value.identities.lawProgramId; }, /must be distinct/u);

  for (const forbidden of [
    IAT_V2_PROGRAM_ID,
    "6c725SoXTRThCVgEFrG6q2f3GKLR5m3A7dv7Gf11hNrq",
    "GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU",
    "DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F",
  ]) {
    expectBlocked((value) => { value.identities.economyProgramId = forbidden; }, /cannot be a B3 production identity/u);
  }
});

test("the complete account namespace includes stake ingress and every faction state role", () => {
  const names = draft.seedTable.map(({ name }) => name);
  assert.equal(names.length, 22);
  for (const required of [
    "stakeIngress",
    "factionConfig",
    "factionAllegiance",
    "factionWeek",
    "factionScore",
    "factionRewardVault",
    "factionRewardManifest",
    "factionFollowerSnapshot",
    "factionClaim",
  ]) assert.ok(names.includes(required), `missing ${required}`);

  expectBlocked((value) => {
    value.seedTable[1].components = [...value.seedTable[0].components];
  }, /seed collision/u);
  expectBlocked((value) => { value.seedTable.pop(); }, /expected exactly 22 canonical account roles/u);
});

test("the agency PDA freezes the retained V2 u32 index width", () => {
  const source = readFileSync(
    new URL("../programs/iat_v2/src/lib.rs", import.meta.url),
    "utf8",
  );
  const agency = draft.seedTable.find(({ name }) => name === "agency");
  assert.deepEqual(agency.components, ["utf8:agency", "pubkey:economyConfig", "u32le:agencyIndex"]);
  assert.match(source, /pub agency_count: u32,/u);
  assert.match(
    source,
    /seeds = \[b"agency", config\.key\(\)\.as_ref\(\), &config\.agency_count\.to_le_bytes\(\)\]/u,
  );
  expectBlocked((value) => {
    value.seedTable.find(({ name }) => name === "agency").components[2] = "u64le:agencyIndex";
  }, /expected agency ECONOMY \[utf8:agency, pubkey:economyConfig, u32le:agencyIndex\]/u);
});

test("faction IDs, public names, and the 24-hour allegiance cooldown are frozen", () => {
  assert.deepEqual(draft.factionPolicy.factions, [
    { id: "radiance", displayLabel: "Radiance" },
    { id: "ellie", displayLabel: "Ellie" },
    { id: "alia", displayLabel: "Alia" },
    { id: "ece", displayLabel: "Ece" },
    { id: "boss", displayLabel: "the boss" },
  ]);
  assert.equal(draft.factionPolicy.allegianceCooldownSeconds, 86_400);
  assert.equal(draft.factionPolicy.leadersHaveProtocolAuthority, false);
  expectBlocked((value) => { value.factionPolicy.factions[4].id = "THE_BOSS"; }, /expected boss\/the boss/u);
  expectBlocked((value) => { value.factionPolicy.allegianceCooldownSeconds = 86_399; }, /exactly 86,400 seconds/u);
});

test("mint shape, Genesis staging, and authority-seal order reject weakened contracts", () => {
  expectBlocked((value) => { value.mintConfig.extensionsOrdered.push("PermanentDelegate"); }, /exactly ConfidentialTransferMint then TransferHook/u);
  expectBlocked((value) => { value.mintConfig.transferHook.authorityAfterLawInitialization = "CEREMONY_SIGNER"; }, /null after atomic law initialization/u);
  expectBlocked((value) => { value.genesis.stagingPredicate.allowedWrites.push("REWARD"); }, /only canonical creation and exact funding/u);
  expectBlocked((value) => { value.genesis.activationPredicate.requiresCurrentFinalizedOpenLaw = false; }, /requiresCurrentFinalizedOpenLaw: must be true/u);
  for (const authorityPredicate of [
    "requiresMintAuthorityNull",
    "requiresFreezeAuthorityNull",
    "requiresTransferHookAuthorityNull",
    "requiresConfidentialTransferMintAuthorityNull",
  ]) {
    assert.equal(draft.genesis.activationPredicate[authorityPredicate], true);
  }
  expectBlocked((value) => {
    value.genesis.activationPredicate.requiresConfidentialTransferMintAuthorityNull = false;
  }, /requiresConfidentialTransferMintAuthorityNull: must be true/u);
  expectBlocked((value) => {
    [value.sealOrder.steps[5], value.sealOrder.steps[6]] = [value.sealOrder.steps[6], value.sealOrder.steps[5]];
  }, /unsafe order/u);
});

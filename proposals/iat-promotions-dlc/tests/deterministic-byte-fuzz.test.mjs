/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decodeInstruction,
  encodeInstruction,
  loadProgramInterface,
} from "../program-interface-codec.mjs";
import {
  ADAPTER_COMMUNITY_SOURCE,
  applyInstructionBytes,
} from "../instruction-transition-adapter.mjs";
import { AttestationPurpose, snapshotState } from "../reference-engine.mjs";

const interfaceDefinition = loadProgramInterface();
const vectorDefinition = JSON.parse(
  readFileSync(new URL("../program-interface-vectors.v0.json", import.meta.url), "utf8"),
);
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function randomBytesHex(size, rng) {
  const bytes = Buffer.alloc(size);
  for (let index = 0; index < size; index += 1) bytes[index] = rng() & 0xff;
  return bytes.toString("hex");
}

function randomField(type, rng) {
  if (type === "bytes32") return randomBytesHex(32, rng);
  if (type === "u16") return String(rng() & 0xffff);
  if (type === "u32") return String(rng());
  const bits = (BigInt(rng()) << 32n) | BigInt(rng());
  if (type === "u64") return String(bits);
  if (type === "i64") return String(BigInt.asIntN(64, bits));
  throw new Error(`UNSUPPORTED_FUZZ_TYPE_${type}`);
}

function randomizedCodecDigest(seed, iterations) {
  const rng = createRng(seed);
  const digest = createHash("sha256");
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const instruction = interfaceDefinition.instructions[rng() % interfaceDefinition.instructions.length];
    const data = Object.fromEntries(
      instruction.data.map((field) => [field.name, randomField(field.type, rng)]),
    );
    const encoded = encodeInstruction(instruction.name, data, interfaceDefinition);
    const decoded = decodeInstruction(encoded, interfaceDefinition);
    assert.deepEqual(decoded, { name: instruction.name, data });
    assert.equal(
      encodeInstruction(decoded.name, decoded.data, interfaceDefinition).toString("hex"),
      encoded.toString("hex"),
    );
    digest.update(encoded);
  }
  return digest.digest("hex");
}

test("2,048 deterministic randomized instructions round-trip byte-for-byte", () => {
  const first = randomizedCodecDigest(0x1a7c0dec, 2_048);
  const second = randomizedCodecDigest(0x1a7c0dec, 2_048);
  const different = randomizedCodecDigest(0x51a7e001, 2_048);
  assert.equal(first, second);
  assert.notEqual(first, different);
});

test("every truncated vector and deterministic trailing suffix is rejected", () => {
  const rng = createRng(0x7a11cafe);
  for (const vector of vectorDefinition.vectors) {
    const encoded = Buffer.from(vector.expectedHex, "hex");
    for (let length = 0; length < encoded.length; length += 1) {
      assert.throws(() => decodeInstruction(encoded.subarray(0, length)));
    }
    for (let suffixLength = 1; suffixLength <= 16; suffixLength += 1) {
      assert.throws(
        () => decodeInstruction(Buffer.concat([encoded, Buffer.from(randomBytesHex(suffixLength, rng), "hex")])),
        /TRAILING_INSTRUCTION_DATA/,
      );
    }
  }
});

test("single-bit mutations are rejected or retain one canonical decode/encode representation", () => {
  for (const vector of vectorDefinition.vectors) {
    const original = Buffer.from(vector.expectedHex, "hex");
    for (let byteIndex = 0; byteIndex < original.length; byteIndex += 1) {
      const mutated = Buffer.from(original);
      mutated[byteIndex] ^= 1 << (byteIndex % 8);
      assert.notDeepEqual(mutated, original);
      try {
        const decoded = decodeInstruction(mutated, interfaceDefinition);
        const reencoded = encodeInstruction(decoded.name, decoded.data, interfaceDefinition);
        assert.deepEqual(reencoded, mutated);
      } catch (error) {
        assert.match(error.message, /UNKNOWN_INSTRUCTION_DISCRIMINATOR/);
      }
    }
  }
});

function activeCampaign() {
  const initialization = {
    campaign_id: hash("fuzz-campaign"),
    activation_offset_seconds: "28800",
    hero_reward_base_units: "120000000000",
    proposer_reward_base_units: "60000000000",
    maximum_budget_base_units: "180000000000000",
    maximum_completed_pairs: "1000",
    policy_hash: hash("fuzz-policy"),
    identity_domain_hash: hash("fuzz-identity-domain"),
    verifier_ed25519_key: hash("fuzz-public-verifier-key"),
  };
  let state = applyInstructionBytes(null, encodeInstruction("initialize_campaign", initialization), {
    mint: "REFERENCE_IAT_MINT",
    genesisTimestamp: 1_800_000_000,
    communityRefundWallet: "REFERENCE_COMMUNITY_REFUND_WALLET",
  }).state;
  state = applyInstructionBytes(
    state,
    encodeInstruction("fund_campaign", { amount_base_units: "180000000000000" }),
    { source: ADAPTER_COMMUNITY_SOURCE },
  ).state;
  state = applyInstructionBytes(state, encodeInstruction("activate_campaign", {
    review_hash: hash("fuzz-review"),
    artifact_hash: hash("fuzz-artifact"),
    policy_hash: initialization.policy_hash,
  }), {
    now: 1_800_028_800,
    networkBinding: "MAINNET",
    reviewAuthorityApproved: true,
  }).state;
  return state;
}

test("128 deterministic verifier-binding mutations fail without changing campaign state", () => {
  const state = activeCampaign();
  const baseline = snapshotState(state);
  const now = 1_800_028_801;
  for (let iteration = 0; iteration < 128; iteration += 1) {
    const data = {
      attestation_id: hash(`fuzz-attestation-${iteration}`),
      proposer_node_commitment: hash(`fuzz-node-${iteration}`),
      proposer_x_identity_commitment: hash(`fuzz-proposer-x-${iteration}`),
      hero_x_identity_commitment: hash(`fuzz-hero-x-${iteration}`),
      nonce_hash: hash(`fuzz-nonce-${iteration}`),
      issued_at: String(now - 1),
      expires_at: String(now + 299),
    };
    const verification = {
      ed25519Verified: true,
      exactMessageMatch: true,
      verifierEd25519Key: state.config.verifierEd25519Key,
      attestation: {
        purpose: AttestationPurpose.NOMINATE,
        campaignId: state.config.campaignId,
        attestationId: data.attestation_id,
        nodeCommitment: data.proposer_node_commitment,
        wallet: `fuzz-wallet-${iteration}`,
        xIdentityCommitment: data.proposer_x_identity_commitment,
        nonceHash: data.nonce_hash,
        issuedAt: data.issued_at,
        expiresAt: data.expires_at,
      },
    };
    const mutation = iteration % 11;
    if (mutation === 0) verification.ed25519Verified = false;
    else if (mutation === 1) verification.exactMessageMatch = false;
    else if (mutation === 2) verification.verifierEd25519Key = hash("wrong-verifier");
    else if (mutation === 3) verification.attestation.purpose = AttestationPurpose.CANCEL;
    else if (mutation === 4) verification.attestation.campaignId = hash("wrong-campaign");
    else if (mutation === 5) verification.attestation.attestationId = hash("wrong-attestation");
    else if (mutation === 6) verification.attestation.nonceHash = hash("wrong-nonce");
    else if (mutation === 7) verification.attestation.nodeCommitment = hash("wrong-node");
    else if (mutation === 8) verification.attestation.xIdentityCommitment = hash("wrong-x");
    else if (mutation === 9) verification.attestation.issuedAt = String(now);
    else verification.attestation.expiresAt = String(now + 300);

    assert.throws(() => applyInstructionBytes(
      state,
      encodeInstruction("nominate_hero", data),
      { now, heroDisplayHandle: `@f${iteration}`, verification },
    ));
    assert.equal(snapshotState(state), baseline);
  }
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  AttestationPurpose,
  COMMUNITY_PROMOTION_SOURCE,
  GENESIS_ACTIVATION_OFFSET_SECONDS,
  MAXIMUM_BUDGET_BASE_UNITS,
  activateCampaign,
  assertStateInvariants,
  cancelNomination,
  createCampaign,
  fundCampaign,
  nominateHero,
  settlePair,
  snapshotState,
} from "../reference-engine.mjs";

const GENESIS = 1_810_000_000;
const ACTIVE_AT = GENESIS + GENESIS_ACTIVATION_OFFSET_SECONDS;
const HASH = "d".repeat(64);
const commitment = (value) => createHash("sha256").update(value).digest("hex");

function xorshift32(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function attestation(state, purpose, identity, nonce, now, overrides = {}) {
  return {
    verified: true,
    campaignId: state.config.campaignId,
    purpose,
    nodeId: `node-${identity}`,
    wallet: `wallet-${identity}`,
    xIdentityCommitment: commitment(`x-${identity}`),
    nonce,
    issuedAt: now - 1,
    expiresAt: now + 300,
    ...overrides,
  };
}

function activeCampaign() {
  let state = createCampaign({ genesisTimestamp: GENESIS });
  state = fundCampaign(state, {
    amountBaseUnits: MAXIMUM_BUDGET_BASE_UNITS,
    source: COMMUNITY_PROMOTION_SOURCE,
  });
  return activateCampaign(state, {
    now: ACTIVE_AT,
    network: "MAINNET",
    separatelyReviewed: true,
    reviewHash: HASH,
    artifactHash: HASH,
    policyHash: HASH,
  });
}

function runScenario(seed, steps = 180) {
  const random = xorshift32(seed);
  let state = activeCampaign();
  const pending = [];
  let identitySequence = 0;
  let nonceSequence = 0;

  for (let step = 0; step < steps; step += 1) {
    const now = ACTIVE_AT + step + 1;
    const roll = random();

    if (roll < 0.46 || pending.length === 0) {
      const sequence = identitySequence;
      identitySequence += 1;
      const proposer = `random-proposer-${sequence}`;
      const hero = `random-hero-${sequence}`;
      const nonce = `random-nominate-${nonceSequence}`;
      nonceSequence += 1;
      const result = nominateHero(state, {
        now,
        proposerAttestation: attestation(
          state,
          AttestationPurpose.NOMINATE,
          proposer,
          nonce,
          now,
        ),
        heroXIdentityCommitment: commitment(`x-${hero}`),
        heroDisplayHandle: `@h${sequence}`,
      });
      state = result.state;
      pending.push({ nominationId: result.nominationId, proposer, hero, sequence });
    } else if (roll < 0.66) {
      const index = Math.floor(random() * pending.length);
      const [item] = pending.splice(index, 1);
      state = cancelNomination(state, {
        now,
        nominationId: item.nominationId,
        proposerAttestation: attestation(
          state,
          AttestationPurpose.CANCEL,
          item.proposer,
          `random-cancel-${nonceSequence}`,
          now,
        ),
      });
      nonceSequence += 1;
    } else if (roll < 0.9) {
      const index = Math.floor(random() * pending.length);
      const [item] = pending.splice(index, 1);
      state = settlePair(state, {
        now,
        nominationId: item.nominationId,
        heroAttestation: attestation(
          state,
          AttestationPurpose.SETTLE,
          item.hero,
          `random-settle-${nonceSequence}`,
          now,
        ),
        heroDisplayHandle: `@renamed${item.sequence}`,
      });
      nonceSequence += 1;
    } else {
      const before = snapshotState(state);
      const invalidIdentity = `invalid-${identitySequence}`;
      const usedNonce = state.usedAttestationNonces.values().next().value;
      const invalid = attestation(
        state,
        AttestationPurpose.NOMINATE,
        invalidIdentity,
        usedNonce ?? `expired-${nonceSequence}`,
        now,
        usedNonce ? {} : { expiresAt: now },
      );
      assert.throws(
        () =>
          nominateHero(state, {
            now,
            proposerAttestation: invalid,
            heroXIdentityCommitment: commitment(`x-invalid-hero-${identitySequence}`),
            heroDisplayHandle: `@bad${identitySequence}`,
          }),
        usedNonce ? /ATTESTATION_REPLAY/ : /ATTESTATION_EXPIRED/,
      );
      assert.equal(snapshotState(state), before);
    }

    assertStateInvariants(state);
  }
  return state;
}

test("deterministic random scenarios reproduce exactly for the same seed", () => {
  assert.equal(snapshotState(runScenario(0x1a2b3c4d)), snapshotState(runScenario(0x1a2b3c4d)));
});

test("twelve randomized state-machine traces preserve every accounting invariant", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const state = runScenario(seed * 0x9e3779b1);
    assertStateInvariants(state);
    assert.equal(state.settlements.length, state.completedPairs);
    assert.equal(
      state.heroPaidBaseUnits + state.proposerPaidBaseUnits,
      BigInt(state.completedPairs) * state.config.pairRewardBaseUnits,
    );
  }
});

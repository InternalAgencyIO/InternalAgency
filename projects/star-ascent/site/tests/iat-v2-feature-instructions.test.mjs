import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  IAT_V2_ROLE,
  buildClaimLanePrincipalInstruction,
  buildClosePositionInstruction,
  buildCommitRoundInstruction,
  buildOpenPositionInstruction,
  buildRegisterAgencyInstruction,
  buildSetEligibilityInstruction,
  buildSettleCoreWeekInstruction,
  buildSettlePositionWeekInstruction,
  buildSettleRoundInstruction,
  buildWithdrawPositionPrincipalInstruction,
  deriveEligibilityAddress,
  parseCoreRewardAccount,
  parseEligibilityAccount,
  parseLaneVaultAccount,
  parsePositionAccount,
  parseRoundAccount,
} from "../programs/iat_v2/feature-instructions.mjs";
import {
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_ID,
} from "../programs/iat_v2/instructions.mjs";
import {
  deriveIatV2Addresses,
  derivePositionAddress,
  deriveRoundAddress,
} from "../programs/iat_v2/client.mjs";

const mint = new PublicKey("BTuhzdrH2vnMELbHZWPJ1FoFRoBhkMDAyCSCRRLew4GR");
const owner = new PublicKey("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
const destination = getAssociatedTokenAddressSync(mint, owner);
const derived = deriveIatV2Addresses({ mint, programId: IAT_V2_PROGRAM_ID });

test("feature instruction builders match the deployed Anchor account order and data", () => {
  const register = buildRegisterAgencyInstruction({
    mint,
    agencyOwner: owner,
    agencyIndex: 0,
  });
  assert.deepEqual([...register.data], [102, 193, 24, 185, 91, 84, 85, 245]);
  assert.equal(register.keys.length, 6);
  assert.equal(register.keys[0].pubkey.toBase58(), IAT_V2_PROGRAM_ADMIN.toBase58());
  assert.equal(register.keys[0].isSigner, true);
  assert.equal(register.keys[1].pubkey.toBase58(), derived.config.toBase58());

  const standard = buildSetEligibilityInstruction({
    mint,
    wallet: owner,
    role: IAT_V2_ROLE.STANDARD,
  });
  assert.deepEqual([...standard.data.subarray(8)], [0, 0]);
  assert.equal(standard.keys[3].pubkey.toBase58(), deriveEligibilityAddress({
    config: derived.config,
    wallet: owner,
  }).toBase58());

  const agent = buildSetEligibilityInstruction({
    mint,
    wallet: owner,
    role: IAT_V2_ROLE.CCC_AGENT,
    agencyIndex: 7,
  });
  assert.deepEqual([...agent.data.subarray(8)], [1, 1, 7, 0, 0, 0]);
  assert.throws(
    () => buildSetEligibilityInstruction({ mint, wallet: owner, role: IAT_V2_ROLE.CCC_ASSOCIATE }),
    /must link an agency/,
  );

  const open = buildOpenPositionInstruction({
    owner,
    mint,
    ownerTokens: destination,
    positionId: 9,
    principal: 10_000_000_000n,
  });
  assert.equal(open.keys.length, 12);
  assert.equal(open.keys[9].pubkey.toBase58(), derivePositionAddress({
    config: derived.config,
    programId: IAT_V2_PROGRAM_ID,
    owner,
    positionId: 9,
  }).toBase58());
  assert.equal(open.data.readBigUInt64LE(8), 9n);
  assert.equal(open.data.readBigUInt64LE(16), 10_000_000_000n);

  const standardSettlement = buildSettlePositionWeekInstruction({
    caller: IAT_V2_PROGRAM_ADMIN,
    mint,
    positionOwner: owner,
    positionId: 9,
    destinationTokens: destination,
    week: 8,
  });
  assert.equal(standardSettlement.keys.length, 14);
  assert.equal(standardSettlement.keys[3].pubkey.toBase58(), IAT_V2_PROGRAM_ID.toBase58());

  const round = deriveRoundAddress({
    config: derived.config,
    programId: IAT_V2_PROGRAM_ID,
    week: 8,
  });
  const cccSettlement = buildSettlePositionWeekInstruction({
    caller: IAT_V2_PROGRAM_ADMIN,
    mint,
    positionOwner: owner,
    positionId: 9,
    destinationTokens: destination,
    week: 8,
    round,
  });
  assert.equal(cccSettlement.keys[3].pubkey.toBase58(), round.toBase58());

  assert.equal(buildSettleCoreWeekInstruction({
    caller: IAT_V2_PROGRAM_ADMIN,
    mint,
    destinationTokens: destination,
    ordinal: 0,
  }).keys.length, 13);
  assert.equal(buildClaimLanePrincipalInstruction({
    caller: IAT_V2_PROGRAM_ADMIN,
    mint,
    destinationTokens: destination,
    lane: 3,
  }).keys.length, 8);
  assert.equal(buildWithdrawPositionPrincipalInstruction({
    caller: IAT_V2_PROGRAM_ADMIN,
    mint,
    positionOwner: owner,
    positionId: 9,
    destinationTokens: destination,
  }).keys.length, 8);
  assert.equal(buildClosePositionInstruction({
    caller: IAT_V2_PROGRAM_ADMIN,
    mint,
    positionOwner: owner,
    positionId: 9,
  }).keys.length, 6);

  const randomness = new PublicKey("DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4");
  const commit = buildCommitRoundInstruction({
    payer: IAT_V2_PROGRAM_ADMIN,
    mint,
    randomnessAccount: randomness,
    week: 8,
  });
  assert.equal(commit.keys.length, 6);
  assert.equal(commit.keys[2].pubkey.toBase58(), randomness.toBase58());
  assert.equal(commit.keys[4].pubkey.toBase58(), round.toBase58());
  assert.equal(buildSettleRoundInstruction({
    mint,
    randomnessAccount: randomness,
    week: 8,
  }).keys.length, 3);
});

test("feature account parsers preserve every reviewed field offset", () => {
  const lane = Buffer.alloc(164);
  owner.toBuffer().copy(lane, 8);
  mint.toBuffer().copy(lane, 40);
  IAT_V2_PROGRAM_ADMIN.toBuffer().copy(lane, 72);
  lane.writeBigUInt64LE(200n, 104);
  lane.writeBigUInt64LE(50n, 112);
  lane.writeBigUInt64LE(26n, 120);
  lane.writeBigUInt64LE(104n, 128);
  lane.writeBigUInt64LE(34n, 136);
  lane.writeBigUInt64LE(2n, 144);
  lane.writeBigUInt64LE(10n, 152);
  lane[160] = 1;
  lane[161] = 1;
  lane[162] = 250;
  lane[163] = 249;
  const parsedLane = parseLaneVaultAccount(lane);
  assert.equal(parsedLane.total, 200n);
  assert.equal(parsedLane.principalClaimed, 10n);
  assert.equal(parsedLane.rewardSource, true);

  const core = Buffer.alloc(113);
  mint.toBuffer().copy(core, 8);
  core.writeBigUInt64LE(100n, 40);
  core.writeBigUInt64LE(1_700n, 48);
  core.writeBigUInt64LE(104n, 56);
  core.writeBigUInt64LE(34n, 64);
  core.writeBigUInt64LE(1n, 88);
  core.writeBigUInt64LE(3n, 96);
  core[112] = 254;
  const parsedCore = parseCoreRewardAccount(core);
  assert.equal(parsedCore.annualRateBps, 1_700n);
  assert.equal(parsedCore.settledLow, 3n);

  const eligibility = Buffer.alloc(78);
  mint.toBuffer().copy(eligibility, 8);
  owner.toBuffer().copy(eligibility, 40);
  eligibility.writeUInt32LE(7, 72);
  eligibility[76] = IAT_V2_ROLE.CCC_ASSOCIATE;
  eligibility[77] = 255;
  const parsedEligibility = parseEligibilityAccount(eligibility);
  assert.equal(parsedEligibility.agencyIndex, 7);
  assert.equal(parsedEligibility.role, IAT_V2_ROLE.CCC_ASSOCIATE);

  const position = Buffer.alloc(168);
  mint.toBuffer().copy(position, 8);
  owner.toBuffer().copy(position, 40);
  for (const [offset, value] of [
    [72, 9n], [80, 10n], [88, 7n], [96, 8n], [104, 52n], [112, 2_800n],
    [120, 5n], [128, 4n], [136, 3n], [144, 2n], [152, 1n],
  ]) position.writeBigUInt64LE(value, offset);
  position.writeUInt32LE(7, 160);
  position[164] = IAT_V2_ROLE.CCC_AGENT;
  position[165] = 1;
  position[166] = 0;
  position[167] = 253;
  const parsedPosition = parsePositionAccount(position);
  assert.equal(parsedPosition.positionId, 9n);
  assert.equal(parsedPosition.annualRateBps, 2_800n);
  assert.equal(parsedPosition.principalReturned, true);

  const roundData = Buffer.alloc(198);
  mint.toBuffer().copy(roundData, 8);
  owner.toBuffer().copy(roundData, 40);
  roundData.writeBigUInt64LE(8n, 72);
  roundData.writeBigUInt64LE(999n, 80);
  roundData.fill(0xa5, 88, 120);
  roundData.fill(0xb6, 120, 152);
  roundData.fill(0xc7, 152, 184);
  roundData.writeUInt32LE(100, 184);
  roundData.writeUInt32LE(42, 188);
  roundData.writeUInt32LE(1, 192);
  roundData[196] = 1;
  roundData[197] = 252;
  const parsedRound = parseRoundAccount(roundData);
  assert.equal(parsedRound.week, 8n);
  assert.equal(parsedRound.agencyCountSnapshot, 100);
  assert.equal(parsedRound.selectedAgencyIndex, 42);
  assert.equal(parsedRound.status, 1);
});

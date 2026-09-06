import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../programs/iat_v2/src/lib.rs", import.meta.url), "utf8");
const policy = JSON.parse(readFileSync(new URL("../engagement/iat-economic-policy.v2.json", import.meta.url), "utf8"));

const handlerBody = (name, nextName) => source.slice(source.indexOf(`pub fn ${name}`), source.indexOf(`pub fn ${nextName}`));

test("CCC has an immutable compile-time active Genesis policy and no activation instruction", () => {
  assert.match(source, /pub const CCC_DLC_GENESIS_ENABLED: bool = true;/u);
  assert.doesNotMatch(source, /pub fn (?:activate|enable)_ccc/u);
  assert.equal(policy.ccc.genesisStatus, "COMPILED_REVIEWED_GENESIS_ACTIVE");
  assert.equal(policy.ccc.genesisActivationInstruction, null);
  assert.equal(policy.ccc.activationRequiresNewReviewedUpgrade, false);
});

test("every CCC registry, eligibility, position, settlement, and randomness entry path binds the compile-time policy", () => {
  for (const body of [
    handlerBody("register_agency", "set_eligibility"),
    handlerBody("commit_round", "settle_round"),
    handlerBody("settle_round", "expire_round"),
    handlerBody("expire_round", "release_vested_lane"),
  ]) assert.match(body, /require!\(CCC_DLC_GENESIS_ENABLED, IatV2Error::CccDlcNotActive\)/u);

  const eligibility = handlerBody("set_eligibility", "open_position");
  const openPosition = handlerBody("open_position", "settle_position_week");
  const settlePosition = handlerBody("settle_position_week", "settle_core_week");
  assert.match(eligibility, /else \{\s*require!\(CCC_DLC_GENESIS_ENABLED/u);
  assert.match(openPosition, /else \{\s*require!\(CCC_DLC_GENESIS_ENABLED/u);
  assert.match(settlePosition, /else \{\s*require!\(CCC_DLC_GENESIS_ENABLED/u);
});

test("standard positions remain available without any CCC round", () => {
  const settlePosition = handlerBody("settle_position_week", "settle_core_week");
  assert.match(settlePosition, /position\.role == 0/u);
  assert.match(settlePosition, /StandardRoundMustBeOmitted/u);
});

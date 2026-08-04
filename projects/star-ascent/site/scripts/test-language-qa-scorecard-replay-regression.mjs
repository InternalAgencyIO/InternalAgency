import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertLanguageQaScorecardMatchesReplay } from "./verify-language-qa-scorecard-replay.mjs";

const scorecardPath = resolve("public/audits/localization-qa-20260803/language-qa-scorecard.json");
const baseline = JSON.parse(readFileSync(scorecardPath, "utf8"));
const replay = structuredClone(baseline);
replay.generatedAt = new Date(Date.parse(baseline.generatedAt) + 1_000).toISOString();

const expectFail = (name, mutate, pattern) => {
  const candidate = structuredClone(baseline);
  mutate(candidate);
  try {
    assertLanguageQaScorecardMatchesReplay({ scorecard: candidate, replay });
    throw new Error(`${name} unexpectedly passed`);
  } catch (error) {
    if (!pattern.test(error.message)) throw error;
  }
};

assertLanguageQaScorecardMatchesReplay({ scorecard: baseline, replay });
expectFail("static status substitution", (scorecard) => { scorecard.locales[0].checks[0].status = "HOLD"; }, /locales\/en\/LQA-001/u);
expectFail("static detail substitution", (scorecard) => { scorecard.locales[0].checks[1].detail = "Unreplayed result"; }, /locales\/en\/LQA-002/u);
expectFail("render metric substitution", (scorecard) => { scorecard.locales[0].checks[84].metrics.inspected += 1; }, /locales\/en\/LQA-085/u);
expectFail("evidence presence substitution", (scorecard) => { scorecard.evidenceInputs.nativeReview.present = true; }, /evidenceInputs/u);
expectFail("source binding substitution", (scorecard) => { scorecard.sourceBinding.messagesFileSha256 = "0".repeat(64); }, /sourceBinding/u);

console.log("Language QA scorecard replay regression passed: timestamp-only normalization is accepted while five static, render, evidence-input, and source-binding substitutions fail closed.");

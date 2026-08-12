// Source-bound regressions for semantic substitutions observed in the pinned
// Marian English-to-Nigerian-Pidgin model. These do not certify fluency; they
// stop known meaning-changing output from returning after editorial repair.
const introducedTermRules = [
  ["introduced-bungalow", /\bbungalows?\b/iu],
  ["introduced-peacekeeping", /\bpeacekeeping\b/iu],
  ["introduced-founders", /\bfounders\b/iu],
  ["introduced-volunteer", /\bvolunteers?\b/iu],
  ["introduced-mattress", /\bmattress(?:es)?\b/iu],
  ["introduced-imperfect", /\bimperfect\b/iu],
  ["introduced-teleopathy", /\bteleopathy\b/iu],
  ["introduced-romantic", /\bromantic\b/iu],
  ["introduced-poetry", /\bpoetry\b/iu],
  ["introduced-irb", /\bIRB\b/u],
  ["introduced-employers", /\bemployers?\b/iu],
];

const sourceBoundSubstitutionRules = [
  ["fixed-supply-substitution", /\bfixed[\s-]+supply\b/iu, /\bfixed[\s-]+(?:procurement|suppliers?)\b/iu],
  ["simulated-substitution", /\bsimulated\b/iu, /\b(?:bungalows?|simplified)\b/iu],
  ["preset-substitution", /\bpreset\b/iu, /\b(?:rent\p{L}*|compositions?|obligatory|requirements?|sold|employers?|tabled|classical|upgraded)\b/iu],
  ["lobby-substitution", /\blobby\b/iu, /\b(?:volunteers?|licen[cs]e)\b/iu],
  ["linear-substitution", /\blinear\b/iu, /\b(?:scanning|classical|validation|valid|rapid|featured)\b/iu],
  ["telemetry-substitution", /\btelemetry\b/iu, /\bteleopathy\b/iu],
  ["host-program-substitution", /\bhost[\s-]+program\b/iu, /\bhost[\s-]+project\b/iu],
  ["linear-unlock-substitution", /\blinear[\s-]+unlock\b/iu, /\bvalidation[\s-]+unlock\b/iu],
];

export function pcmKnownSemanticCorruptionFindings(source, translation) {
  const findings = [];
  for (const [rule, pattern] of introducedTermRules) {
    if (!pattern.test(source) && pattern.test(translation)) findings.push({ rule });
  }
  for (const [rule, sourcePattern, translationPattern] of sourceBoundSubstitutionRules) {
    if (sourcePattern.test(source) && translationPattern.test(translation)) findings.push({ rule });
  }
  return findings;
}

// Accountability labels are review controls, not display text. Collapse
// compatibility variants and combining marks before comparison so one person
// cannot satisfy an independent-review gate with a Unicode lookalike.
export const normalizeAccountabilityLabel = (value) => typeof value === "string"
  ? value
    .normalize("NFKD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .trim()
    .replace(/\p{White_Space}+/gu, " ")
    .toLocaleLowerCase("en-US")
  : "";

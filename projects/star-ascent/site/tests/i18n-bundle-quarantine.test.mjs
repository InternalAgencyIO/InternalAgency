import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  deriveReviewedValueExceptions,
  scanJavaScriptText,
} from "../scripts/check-i18n-bundle-quarantine.mjs";

const targetLocaleCodes = [
  "zh", "es", "hi", "fr", "ar", "bn", "pt", "id", "ur", "ru", "de", "ja", "pcm", "tr",
  "sq", "ca", "be", "nl", "bs", "bg", "hr", "el", "cs", "da", "et", "fi", "hu", "is",
  "ga", "it", "lv", "lt", "lb", "mk", "mt", "no", "pl", "ro", "sr", "sk", "sl", "sv",
  "uk", "ht", "gn", "qu", "hy", "az", "ka",
];
const localeCodes = new Set(["en", ...targetLocaleCodes]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function scan(text, reviewedValues = new Set()) {
  return scanJavaScriptText({
    text,
    label: "fixture.js",
    localeCodes,
    reviewedValues,
  });
}

test("framework Unicode regular expressions are syntax, not user-facing target copy", () => {
  const violations = scan(String.raw`
    const targetScripts = /[\u0370-\u052f\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff]/u;
    const escapedScripts = /\\u(?:0[3-6][0-9a-f]{2}|0e[0-9a-f]{2}|[4-9][0-9a-f]{3})/iu;
  `);
  assert.deepEqual(violations, []);
});

test("escaped target-language strings are decoded and rejected", () => {
  const violations = scan(String.raw`const greeting = "\u05e9\u05dc\u05d5\u05dd";`);
  assert.ok(violations.some((violation) => violation.includes("target-language script")));
});

test("Hebrew, Thai, and Hangul display strings are covered", () => {
  for (const value of ["שלום", "สวัสดี", "안녕하세요"]) {
    const violations = scan(`const greeting = ${JSON.stringify(value)};`);
    assert.ok(violations.some((violation) => violation.includes("target-language script")), value);
  }
});

test("ASCII-only Spanish and Turkish launch copy is rejected", () => {
  const violations = scan(`
    const spanish = "No hay transacciones automaticas. Lanzamiento no publicado.";
    const turkish = "Hayir. Yayinlanmamis. Otomatik islemler yok.";
  `);
  assert.ok(violations.some((violation) => violation.includes("Spanish vocabulary")));
  assert.ok(violations.some((violation) => violation.includes("Turkish vocabulary")));
});

test("object copy branches are rejected for every non-English locale code", () => {
  const source = `const copy = {\n${targetLocaleCodes
    .map((code) => `${JSON.stringify(code)}: "Launch remains on hold for ${code}",`)
    .join("\n")}\n};`;
  const violations = scan(source);
  for (const code of targetLocaleCodes) {
    assert.ok(
      violations.some((violation) => violation.includes(`for ${code}`)),
      `missing branch violation for ${code}`,
    );
  }
});

test("locale-indexed SHA-256 integrity metadata is not mistaken for display copy", () => {
  const digest = "49d396a515df21ef49d396a515df21ef49d396a515df21ef49d396a515df21ef";
  assert.deepEqual(scan(`const localeContentSha256 = { es: "${digest}", tr: "${digest}" };`), []);
});

test("exact canonical-English locale map fallbacks pass while drift remains blocked", () => {
  const fallback = `{
    en: { title: "Launch remains on hold", notices: ["No automatic transactions"] },
    es: { title: "Launch remains on hold", notices: ["No automatic transactions"] },
    tr: { title: "Launch remains on hold", notices: ["No automatic transactions"] }
  }`;
  assert.deepEqual(scan(`const metadata = ${fallback};`), []);
  const drift = fallback.replace(
    `tr: { title: "Launch remains on hold", notices: ["No automatic transactions"] }`,
    `tr: { title: "Launch is active", notices: ["No automatic transactions"] }`,
  );
  assert.ok(scan(`const metadata = ${drift};`).some((violation) => violation.includes("object branch for tr")));
});

test("scalar and array locale conditionals are rejected", () => {
  const violations = scan(`
    const copy = language === "es"
      ? ["Launch is on hold", "No automatic transactions"]
      : ["Launch is on hold"];
  `);
  assert.ok(violations.some((violation) => violation.includes("conditional branch for es")));
});

test("only exact evidence-bound reviewed policy values are exceptions", () => {
  const source = "No automatic transactions.";
  const translation = "No hay transacciones automaticas.";
  const policy = {
    localeStatus: { en: "SOURCE", es: "PARTIAL_REVIEW" },
    translations: { es: { [source]: translation } },
    reviews: [{
      locale: "es",
      source,
      status: "APPROVED",
      machineGenerated: false,
      origin: "HUMAN_AUTHORED_OR_CORRECTED",
      sourceSha256: sha256(source),
      translationSha256: sha256(translation),
    }],
  };
  const reviewedValues = deriveReviewedValueExceptions(policy);
  assert.deepEqual([...reviewedValues], [translation]);
  assert.deepEqual(scan(`const copy = { es: ${JSON.stringify(translation)} };`, reviewedValues), []);
  assert.ok(scan(`const copy = ${JSON.stringify(`${translation} Extra`)};`, reviewedValues).length > 0);
});

test("translation values without a matching approved digest-bound review are not exceptions", () => {
  const policy = {
    localeStatus: { en: "SOURCE", tr: "PARTIAL_REVIEW" },
    translations: { tr: { No: "Hayir" } },
    reviews: [],
  };
  assert.equal(deriveReviewedValueExceptions(policy).size, 0);
  assert.ok(scan(`const copy = "Hayir";`).length > 0);
});

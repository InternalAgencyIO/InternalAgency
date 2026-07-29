#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-incoming-artwork-"));
const validatorPath = join(repositoryRoot, "scripts", "validate-incoming-artwork-manifest.mjs");
const canonicalManifest = JSON.parse(readFileSync(
  join(repositoryRoot, "launch", "incoming-artwork-manifest.template.json"),
  "utf8",
));
const fixturePath = join(sandboxRoot, "incoming-artwork-manifest.json");
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const encodeBase58 = (bytes) => {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = base58Alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return encoded;
};
const credentialShapedKeypair = (seed) => encodeBase58(Buffer.alloc(64, seed));
const writeFixture = (fixture) => writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
const runValidator = () => spawnSync(process.execPath, [validatorPath, fixturePath], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
const assertValid = (label, mutate = () => {}) => {
  const fixture = structuredClone(canonicalManifest);
  mutate(fixture);
  writeFixture(fixture);
  const result = runValidator();
  if (result.error || result.status !== 0) fail(`incoming artwork validator rejected ${label}`);
  else console.log(`OK: incoming artwork validator accepts ${label}`);
};
const assertRejected = (label, mutate, expectedMessage) => {
  const fixture = structuredClone(canonicalManifest);
  mutate(fixture);
  writeFixture(fixture);
  const result = runValidator();
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.error || result.status === 0) fail(`incoming artwork validator accepted ${label}`);
  else if (!output.includes(expectedMessage)) fail(`incoming artwork validator did not report ${label}`);
  else console.log(`OK: incoming artwork validator rejects ${label}`);
};

try {
  assertValid("the canonical HOLD intake");
  assertValid(
    "ordinary launch prose in the operator note and bilingual alt text",
    (fixture) => {
      fixture.operatorNote = "Keep every asset under review until rights checks and final approval are complete";
      fixture.assets = [{
        filename: "star-ascent-signal-crew-v1.webp",
        sha256: "a".repeat(64),
        placement: "dossier",
        loading: "lazy",
        width: 1350,
        height: 1800,
        bytes: 1024,
        alt: {
          en: "Radiant agents gather beneath signal towers while stars bloom across the silent night",
          tr: "Parlak ajanlar sessiz gece altinda sinyal kulesi onunde birlikte hazir halde bekler",
        },
        safeArea: { left: 15, right: 85, top: 15, bottom: 85 },
        review: {
          generatedText: false,
          unlicensedMarks: false,
          personalData: false,
          rightsConfirmed: true,
        },
      }];
    },
  );
  assertRejected(
    "64-byte Base58 credential-shaped reviewer material",
    (fixture) => {
      fixture.status = "PENDING_REVIEW";
      fixture.reviewedAtUtc = "2026-07-29T09:00:00.000Z";
      fixture.reviewer = credentialShapedKeypair(9);
    },
    "manifest must not contain credential-bearing value at manifest.reviewer",
  );
  assertRejected(
    "64-byte Base58 credential-shaped operator-note material",
    (fixture) => { fixture.operatorNote = credentialShapedKeypair(10); },
    "manifest must not contain credential-bearing value at manifest.operatorNote",
  );
  assertRejected(
    "mnemonic-shaped reviewer material",
    (fixture) => {
      fixture.status = "PENDING_REVIEW";
      fixture.reviewedAtUtc = "2026-07-29T09:00:00.000Z";
      fixture.reviewer = "amber bridge candle drift ember forest galaxy harbor island jungle kindle lantern";
    },
    "manifest must not contain a mnemonic-shaped reviewer label",
  );
  assertRejected(
    "an unreviewed credential-bearing field",
    (fixture) => { fixture.walletSeedPhrase = "redacted"; },
    "manifest must not contain credential-bearing field manifest.walletSeedPhrase",
  );
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nIncoming artwork manifest regression failed.");
else console.log("\nIncoming artwork manifest regression passes.");

#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-publication-payload-"));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
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
const mint = encodeBase58(Buffer.alloc(32, 7));
const mintAuthorityTransaction = encodeBase58(Buffer.alloc(64, 8));
const freezeAuthorityTransaction = encodeBase58(Buffer.alloc(64, 9));
const evidencePacketSha256 = "ab".repeat(32);

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });

  const payloadPath = join(sandboxRoot, "launch", "PUBLICATION_PAYLOAD.template.md");
  const template = readFileSync(payloadPath, "utf8");
  const payloadTemplate = template.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1];
  if (!payloadTemplate) throw new Error("publication payload template is missing its canonical text block");
  const runValidator = () => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-publication-payload.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const runValidatorAt = (path) => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-publication-payload.mjs"), path], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const verifiedPayload = () => `Status: **HOLD**\n\n${payloadTemplate}`
    .replace("Status: **HOLD**", "Status: **VERIFIED**")
    .replace("Mint: [FULL MINT ADDRESS]", `Mint: ${mint}`)
    .replace("Explorer: [FULL MINT EXPLORER URL]", `Explorer: https://explorer.solana.com/address/${mint}`)
    .replace("Fixed supply: [VERIFIED SUPPLY] IAT", "Fixed supply: 1000000000 IAT")
    .replace("Base units: [VERIFIED BASE-UNIT TOTAL]", "Base units: 1000000000000000000")
    .replace("Mint authority evidence: [FULL EXPLORER URL]", `Mint authority evidence: https://explorer.solana.com/tx/${mintAuthorityTransaction}`)
    .replace("Freeze authority evidence: [FULL EXPLORER URL]", `Freeze authority evidence: https://explorer.solana.com/tx/${freezeAuthorityTransaction}`)
    .replace("Allocation and lock evidence: [CANONICAL URL]", "Allocation and lock evidence: https://internalagency.io/proof")
    .replace(/Checked at \(UTC\): \[[^\n]+\]/, "Checked at (UTC): 2026-07-28 19:00 UTC")
    .replace(/Evidence packet SHA-256: \[[^\n]+\]/, `Evidence packet SHA-256: ${evidencePacketSha256}`);
  const assertRejected = (label, mutate, expectedMessage) => {
    writeFileSync(payloadPath, mutate(verifiedPayload()), "utf8");
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`publication payload validator accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`publication payload validator did not report ${label}`);
    else console.log(`OK: publication payload validator rejects ${label}`);
  };

  writeFileSync(payloadPath, verifiedPayload(), "utf8");
  const baseline = runValidator();
  if (baseline.error || baseline.status !== 0) fail(`publication payload validator rejected a canonical VERIFIED payload: ${baseline.stderr.trim()}`);
  else console.log("OK: publication payload validator accepts a canonical VERIFIED payload");
  const substitutedPayloadPath = join(sandboxRoot, "launch", "substituted-publication-payload.md");
  writeFileSync(substitutedPayloadPath, verifiedPayload(), "utf8");
  const substitutedPathValidation = runValidatorAt("launch/substituted-publication-payload.md");
  const substitutedPathOutput = `${substitutedPathValidation.stdout}\n${substitutedPathValidation.stderr}`;
  if (substitutedPathValidation.error || substitutedPathValidation.status === 0) {
    fail("publication payload validator accepted a substituted payload path");
  } else if (!substitutedPathOutput.includes("publication payload path must be launch/PUBLICATION_PAYLOAD.template.md")) {
    fail("publication payload validator did not report a substituted payload path");
  } else {
    console.log("OK: publication payload validator rejects a substituted payload path");
  }

  assertRejected(
    "a HOLD payload carrying a stale mint",
    (payload) => payload.replace("Status: **VERIFIED**", "Status: **HOLD**"),
    "HOLD payload must keep Mint unresolved",
  );
  assertRejected(
    "a VERIFIED payload with an unresolved mint placeholder",
    (payload) => payload.replace(`Mint: ${mint}`, "Mint: [FULL MINT ADDRESS]"),
    "verified payload contains unresolved value",
  );
  assertRejected(
    "a payload with an unsupported status",
    (payload) => payload.replace("Status: **VERIFIED**", "Status: **READY**"),
    "Status must read **HOLD** or **VERIFIED**",
  );
  assertRejected(
    "an explorer URL that does not identify the claimed mint",
    (payload) => payload.replace(`Explorer: https://explorer.solana.com/address/${mint}`, "Explorer: https://explorer.solana.com/address/unrelated-record"),
    "Explorer must be a direct explorer.solana.com address record for the claimed Mint",
  );
  assertRejected(
    "a landing page that merely includes the claimed mint in a query string",
    (payload) => payload.replace(`Explorer: https://explorer.solana.com/address/${mint}`, `Explorer: https://launch.starascent.io/proof?mint=${mint}`),
    "Explorer must be a direct explorer.solana.com address record for the claimed Mint",
  );
  assertRejected(
    "an explorer address record on a non-default Explorer port",
    (payload) => payload.replace(`Explorer: https://explorer.solana.com/address/${mint}`, `Explorer: https://explorer.solana.com:444/address/${mint}`),
    "Explorer must be a direct explorer.solana.com address record for the claimed Mint",
  );
  assertRejected(
    "an authority proof on an untrusted host",
    (payload) => payload.replace(`Mint authority evidence: https://explorer.solana.com/tx/${mintAuthorityTransaction}`, `Mint authority evidence: https://proofs.starascent.io/tx/${mintAuthorityTransaction}`),
    "Mint authority evidence must be a direct explorer.solana.com transaction record without a query string or fragment",
  );
  assertRejected(
    "a parameterized authority proof",
    (payload) => payload.replace(`Freeze authority evidence: https://explorer.solana.com/tx/${freezeAuthorityTransaction}`, `Freeze authority evidence: https://explorer.solana.com/tx/${freezeAuthorityTransaction}?cluster=mainnet-beta`),
    "Freeze authority evidence must be a direct explorer.solana.com transaction record without a query string or fragment",
  );
  assertRejected(
    "an authority proof on a non-default Explorer port",
    (payload) => payload.replace(`Freeze authority evidence: https://explorer.solana.com/tx/${freezeAuthorityTransaction}`, `Freeze authority evidence: https://explorer.solana.com:444/tx/${freezeAuthorityTransaction}`),
    "Freeze authority evidence must be a direct explorer.solana.com transaction record without a query string or fragment",
  );
  assertRejected(
    "an authority proof with a Base58-shaped but non-signature transaction id",
    (payload) => payload.replace(`Mint authority evidence: https://explorer.solana.com/tx/${mintAuthorityTransaction}`, `Mint authority evidence: https://explorer.solana.com/tx/${"2".repeat(64)}`),
    "Mint authority evidence must be a direct explorer.solana.com transaction record without a query string or fragment",
  );
  assertRejected(
    "an all-zero Base58 authority proof",
    (payload) => payload.replace(`Mint authority evidence: https://explorer.solana.com/tx/${mintAuthorityTransaction}`, `Mint authority evidence: https://explorer.solana.com/tx/${"1".repeat(64)}`),
    "Mint authority evidence must be a direct explorer.solana.com transaction record without a query string or fragment",
  );
  assertRejected(
    "reused authority evidence",
    (payload) => payload.replace(`Freeze authority evidence: https://explorer.solana.com/tx/${freezeAuthorityTransaction}`, `Freeze authority evidence: https://explorer.solana.com/tx/${mintAuthorityTransaction}`),
    "Explorer and evidence URLs must be distinct direct records",
  );
  assertRejected(
    "an allocation proof on a lookalike host",
    (payload) => payload.replace("Allocation and lock evidence: https://internalagency.io/proof", "Allocation and lock evidence: https://launch.starascent.io/proof"),
    "Allocation and lock evidence must be the canonical https://internalagency.io/proof route",
  );
  assertRejected(
    "an invalid evidence packet digest",
    (payload) => payload.replace(evidencePacketSha256, "0".repeat(63)),
    "Evidence packet SHA-256 must be an exact lowercase digest",
  );
  assertRejected(
    "self-attestation enabled",
    (payload) => payload.replace("No self-attestation: true", "No self-attestation: false"),
    "No self-attestation must be true",
  );
  assertRejected(
    "a human-review prerequisite",
    (payload) => payload.replace("Human reviewer required: false", "Human reviewer required: true"),
    "Human reviewer required must be false",
  );
  assertRejected(
    "a verification timestamp in the future",
    (payload) => payload.replace("Checked at (UTC): 2026-07-28 19:00 UTC", "Checked at (UTC): 2099-01-01 00:00 UTC"),
    "Checked at (UTC) must not be in the future",
  );
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nPublication payload regression failed.");
else console.log("\nPublication payload regression passes.");

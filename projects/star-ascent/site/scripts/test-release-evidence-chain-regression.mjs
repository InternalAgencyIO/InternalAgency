#!/usr/bin/env node

import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-evidence-chain-"));
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
const authorityUrl = (transaction) => `https://explorer.solana.com/tx/${transaction}`;
const mintExplorerUrl = (address = mint) => `https://explorer.solana.com/address/${address}`;
const evidencePacketSha256 = "ab".repeat(32);

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });
  const manifestPath = join(sandboxRoot, "launch", "genesis-manifest.template.json");
  const payloadPath = join(sandboxRoot, "launch", "PUBLICATION_PAYLOAD.template.md");
  const runValidator = () => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-evidence-chain.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const canonicalManifest = () => ({
    status: "PUBLISHED",
    network: "mainnet-beta",
    token: {
      mint,
      symbol: "IAT",
      program: "Original SPL Token Program",
      decimals: 9,
      fixedSupplyTarget: "1000000000",
      fixedSupplyBaseUnits: "1000000000000000000",
      mintAuthorityRevocationTransaction: authorityUrl(mintAuthorityTransaction),
      freezeAuthorityRevocationTransaction: authorityUrl(freezeAuthorityTransaction),
    },
    releaseEvidence: { records: {
      mintCreation: mintExplorerUrl(),
      publicationRecord: "https://internalagency.io/proof",
    } },
    claimOrDistribution: { canonicalRoute: "https://internalagency.io/proof" },
  });
  const canonicalPayload = () => [
    "Status: **VERIFIED**",
    "Network: Solana mainnet-beta",
    `Mint: ${mint}`,
    `Explorer: ${mintExplorerUrl()}`,
    "Program: Original SPL Token Program",
    "Decimals: 9",
    "Fixed supply: 1000000000 IAT",
    "Base units: 1000000000000000000",
    "Mint authority: None",
    `Mint authority evidence: ${authorityUrl(mintAuthorityTransaction)}`,
    "Freeze authority: None",
    `Freeze authority evidence: ${authorityUrl(freezeAuthorityTransaction)}`,
    "Allocation and lock evidence: https://internalagency.io/proof",
    "Checked at (UTC): 2026-07-28 14:00 UTC",
    `Evidence packet SHA-256: ${evidencePacketSha256}`,
    "Evidence observation mode: AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION",
    "No self-attestation: true",
    "Human reviewer required: false",
  ].join("\n");
  const writeFixture = (manifest, payload) => {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    writeFileSync(payloadPath, `${payload}\n`, "utf8");
  };
  const assertValid = () => {
    writeFixture(canonicalManifest(), canonicalPayload());
    const result = runValidator();
    if (result.error || result.status !== 0) fail(`release evidence chain rejected canonical published artifacts: ${result.stderr.trim()}`);
    else console.log("OK: release evidence chain accepts canonical direct evidence");
  };
  const assertRejected = (label, mutate, expectedMessage) => {
    const manifest = canonicalManifest();
    let payload = canonicalPayload();
    payload = mutate(manifest, payload) ?? payload;
    writeFixture(manifest, payload);
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`release evidence chain accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`release evidence chain did not report ${label}`);
    else console.log(`OK: release evidence chain rejects ${label}`);
  };

  assertValid();
  const substitutedManifestPath = join(sandboxRoot, "launch", "substituted-manifest.json");
  const substitutedPayloadPath = join(sandboxRoot, "launch", "substituted-payload.md");
  writeFixture(canonicalManifest(), canonicalPayload());
  writeFileSync(substitutedManifestPath, JSON.stringify(canonicalManifest(), null, 2), "utf8");
  writeFileSync(substitutedPayloadPath, canonicalPayload(), "utf8");
  const substitutedPathValidation = spawnSync(process.execPath, [
    join(sandboxRoot, "scripts", "validate-release-evidence-chain.mjs"),
    "launch/substituted-manifest.json",
    "launch/substituted-payload.md",
  ], { cwd: sandboxRoot, encoding: "utf8" });
  const substitutedPathOutput = `${substitutedPathValidation.stdout}\n${substitutedPathValidation.stderr}`;
  if (substitutedPathValidation.error || substitutedPathValidation.status === 0) {
    fail("release evidence chain accepted substituted manifest and payload paths");
  } else if (!substitutedPathOutput.includes("manifest path must be launch/genesis-manifest.template.json") || !substitutedPathOutput.includes("publication payload path must be launch/PUBLICATION_PAYLOAD.template.md")) {
    fail("release evidence chain did not report substituted artifact paths");
  } else {
    console.log("OK: release evidence chain rejects substituted manifest and payload paths");
  }
  assertRejected(
    "a PUBLISHED manifest paired with a non-VERIFIED payload",
    (_manifest, payload) => payload.replace("Status: **VERIFIED**", "Status: **READY**"),
    "PUBLISHED manifest requires exactly one Status: **VERIFIED** publication payload assertion",
  );
  assertRejected(
    "a PUBLISHED manifest paired with an ambiguous verified status",
    (_manifest, payload) => payload.replace("Status: **VERIFIED**", "Status: **VERIFIED** — draft copy"),
    "PUBLISHED manifest requires exactly one Status: **VERIFIED** publication payload assertion",
  );
  assertRejected(
    "a PUBLISHED manifest paired with duplicate status assertions",
    (_manifest, payload) => `${payload}\nStatus: **VERIFIED**`,
    "PUBLISHED manifest requires exactly one Status: **VERIFIED** publication payload assertion",
  );
  const holdManifest = () => ({
    status: "HOLD",
    claimOrDistribution: { canonicalRoute: null },
  });
  const holdPayload = () => [
    "Status: **HOLD**",
    "Mint: [FULL MINT ADDRESS]",
    "Explorer: [FULL MINT EXPLORER URL]",
    "Mint authority evidence: [FULL EXPLORER URL]",
    "Freeze authority evidence: [FULL EXPLORER URL]",
    "Allocation and lock evidence: [CANONICAL URL]",
    "Checked at (UTC): [YYYY-MM-DD HH:MM UTC]",
    "Evidence packet SHA-256: [LOWERCASE SHA-256]",
  ].join("\n");
  const assertHoldRejected = (label, mutate, expectedMessage) => {
    const manifest = holdManifest();
    let payload = holdPayload();
    payload = mutate(manifest, payload) ?? payload;
    writeFixture(manifest, payload);
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`release evidence chain accepted HOLD payload with ${label}`);
    else if (!output.includes(expectedMessage)) fail(`release evidence chain did not report HOLD ${label}`);
    else console.log(`OK: release evidence chain rejects HOLD payload with ${label}`);
  };
  assertHoldRejected(
    "a stale Explorer record",
    (_manifest, payload) => payload.replace("Explorer: [FULL MINT EXPLORER URL]", `Explorer: ${mintExplorerUrl()}`),
    "HOLD payload must contain exactly one unresolved Explorer assertion",
  );
  assertHoldRejected(
    "a stale allocation evidence route",
    (_manifest, payload) => payload.replace("Allocation and lock evidence: [CANONICAL URL]", "Allocation and lock evidence: https://internalagency.io/proof"),
    "HOLD payload must contain exactly one unresolved Allocation and lock evidence assertion",
  );
  assertHoldRejected(
    "a stale verification timestamp",
    (_manifest, payload) => payload.replace("Checked at (UTC): [YYYY-MM-DD HH:MM UTC]", "Checked at (UTC): 2026-07-28 14:00 UTC"),
    "HOLD payload must contain exactly one unresolved Checked at (UTC) assertion",
  );
  assertHoldRejected(
    "a duplicate hidden mint assertion",
    (_manifest, payload) => `${payload}\nMint: ${mint}`,
    "HOLD payload must contain exactly one unresolved Mint assertion",
  );
  assertRejected(
    "a payload that omits the Solana context from its network label",
    (_manifest, payload) => payload.replace("Network: Solana mainnet-beta", "Network: mainnet-beta"),
    "published evidence must identify Solana mainnet-beta in the canonical manifest/payload forms",
  );
  assertRejected(
    "a manifest that names a different network",
    (manifest) => {
      manifest.network = "devnet";
    },
    "published evidence must identify Solana mainnet-beta in the canonical manifest/payload forms",
  );
  assertRejected(
    "a payload with mismatched fixed supply",
    (_manifest, payload) => payload.replace("Fixed supply: 1000000000 IAT", "Fixed supply: 999999999 IAT"),
    "fixed supply differs between manifest and publication payload",
  );
  assertRejected(
    "blank matching program identities",
    (manifest, payload) => {
      manifest.token.program = "";
      return payload.replace("Program: Original SPL Token Program", "Program:  ");
    },
    "program differs between manifest and publication payload",
  );
  assertRejected(
    "a payload with a duplicate mint assertion",
    (_manifest, payload) => `${payload}\nMint: ${mint}`,
    "verified publication payload must contain exactly one Mint assertion",
  );
  assertRejected(
    "a verified payload without a canonical review timestamp",
    (_manifest, payload) => payload.replace("Checked at (UTC): 2026-07-28 14:00 UTC", "Checked at (UTC): 2026-07-28T14:00:00Z"),
    "verified publication payload requires a real canonical Checked at (UTC) timestamp",
  );
  assertRejected(
    "a verified payload with a future review timestamp",
    (_manifest, payload) => payload.replace("Checked at (UTC): 2026-07-28 14:00 UTC", "Checked at (UTC): 2099-01-01 00:00 UTC"),
    "verified publication payload Checked at (UTC) must not be in the future",
  );
  assertRejected(
    "a verified payload with an invalid evidence digest",
    (_manifest, payload) => payload.replace(evidencePacketSha256, "0".repeat(63)),
    "verified publication payload requires an exact lowercase evidence-packet SHA-256",
  );
  assertRejected(
    "a manifest with bare 64-byte Base58 credential-shaped metadata",
    (manifest) => {
      manifest.publicVerifier = mintAuthorityTransaction;
    },
    "manifest must not contain credential-bearing value at manifest.publicVerifier",
  );
  assertRejected(
    "a verified payload permitting self-attestation",
    (_manifest, payload) => payload.replace("No self-attestation: true", "No self-attestation: false"),
    "verified publication payload must require automated source/receipt/state evidence",
  );
  assertRejected(
    "a verified payload requiring a human reviewer",
    (_manifest, payload) => payload.replace("Human reviewer required: false", "Human reviewer required: true"),
    "verified publication payload must require automated source/receipt/state evidence",
  );
  assertRejected(
    "a payload that does not explicitly revoke mint authority",
    (_manifest, payload) => payload.replace("Mint authority: None", "Mint authority: Pending"),
    "mint authority must state None in a verified publication payload",
  );
  assertRejected(
    "a payload Explorer record for a different mint",
    (manifest, payload) => payload.replace(mintExplorerUrl(), mintExplorerUrl(encodeBase58(Buffer.alloc(32, 6)))),
    "mint explorer evidence must be a direct explorer.solana.com address record for the claimed mint in both artifacts",
  );
  assertRejected(
    "a mismatched manifest mintCreation record",
    (manifest) => {
      manifest.releaseEvidence.records.mintCreation = mintExplorerUrl(encodeBase58(Buffer.alloc(32, 6)));
    },
    "mint explorer evidence must be a direct explorer.solana.com address record for the claimed mint in both artifacts",
  );
  assertRejected(
    "an alternate publication record that diverges from allocation evidence",
    (manifest) => {
      manifest.releaseEvidence.records.publicationRecord = "https://launch.starascent.io/proof/stale";
    },
    "publication record must be a non-placeholder canonical public route without a query string or fragment",
  );
  assertRejected(
    "a lookalike allocation and lock route that agrees across artifacts",
    (manifest, payload) => {
      const replacement = "https://launch.starascent.io/proof";
      manifest.claimOrDistribution.canonicalRoute = replacement;
      manifest.releaseEvidence.records.publicationRecord = replacement;
      return payload.replace("https://internalagency.io/proof", replacement);
    },
    "PUBLISHED manifest requires a non-placeholder canonical route without a query string or fragment",
  );
  assertRejected(
    "an authority landing page that matches across artifacts",
    (manifest, payload) => {
      const replacement = `https://proofs.starascent.io/tx/${mintAuthorityTransaction}`;
      manifest.token.mintAuthorityRevocationTransaction = replacement;
      return payload.replace(authorityUrl(mintAuthorityTransaction), replacement);
    },
    "mint authority evidence must be a non-placeholder public value in both artifacts",
  );
  assertRejected(
    "a parameterized direct authority record",
    (manifest, payload) => {
      const replacement = `${authorityUrl(freezeAuthorityTransaction)}?cluster=mainnet-beta`;
      manifest.token.freezeAuthorityRevocationTransaction = replacement;
      return payload.replace(authorityUrl(freezeAuthorityTransaction), replacement);
    },
    "freeze authority evidence must be a non-placeholder public value in both artifacts",
  );
  assertRejected(
    "an authority record on a non-default Explorer port",
    (manifest, payload) => {
      const replacement = `https://explorer.solana.com:444/tx/${mintAuthorityTransaction}`;
      manifest.token.mintAuthorityRevocationTransaction = replacement;
      return payload.replace(authorityUrl(mintAuthorityTransaction), replacement);
    },
    "mint authority evidence must be a non-placeholder public value in both artifacts",
  );
  assertRejected(
    "an authority record with a Base58-shaped but non-signature transaction id",
    (manifest, payload) => {
      const replacement = `https://explorer.solana.com/tx/${"2".repeat(64)}`;
      manifest.token.mintAuthorityRevocationTransaction = replacement;
      return payload.replace(authorityUrl(mintAuthorityTransaction), replacement);
    },
    "mint authority evidence must be a non-placeholder public value in both artifacts",
  );
  assertRejected(
    "an all-zero Base58 authority record",
    (manifest, payload) => {
      const replacement = `https://explorer.solana.com/tx/${"1".repeat(64)}`;
      manifest.token.mintAuthorityRevocationTransaction = replacement;
      return payload.replace(authorityUrl(mintAuthorityTransaction), replacement);
    },
    "mint authority evidence must be a non-placeholder public value in both artifacts",
  );
  assertRejected(
    "reused authority evidence records",
    (manifest, payload) => {
      manifest.token.freezeAuthorityRevocationTransaction = authorityUrl(mintAuthorityTransaction);
      return payload.replace(authorityUrl(freezeAuthorityTransaction), authorityUrl(mintAuthorityTransaction));
    },
    "mint and freeze authority evidence must use distinct direct transaction records",
  );
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nRelease evidence-chain regression failed.");
else console.log("\nRelease evidence-chain regression passes.");

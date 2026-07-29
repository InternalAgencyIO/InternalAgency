#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-manifest-gate-"));
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
const assertRejected = (script, expectedMessage, rejectedArtifact = "malformed canonical manifest", args = []) => {
  const result = spawnSync(process.execPath, [join(sandboxRoot, "scripts", script), ...args], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.error || result.status === 0) {
    fail(`${script} accepted a ${rejectedArtifact}`);
  } else if (!output.includes(expectedMessage)) {
    fail(`${script} did not report the expected ${rejectedArtifact} gate failure`);
  } else {
    console.log(`OK: ${script} rejects a ${rejectedArtifact} before state review`);
  }
};

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });

  const manifestPath = join(sandboxRoot, "launch", "genesis-manifest.template.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const substitutedManifestPath = join(sandboxRoot, "launch", "substituted-genesis-manifest.json");
  writeFileSync(substitutedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const supplyMathResult = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-iat-supply-math.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  if (supplyMathResult.error || supplyMathResult.status !== 0) {
    fail("supply math validator rejected the canonical Genesis manifest");
  } else {
    console.log("OK: supply math validator accepts the canonical Genesis manifest");
  }
  assertRejected(
    "validate-iat-supply-math.mjs",
    "supply math manifest path must be launch/genesis-manifest.template.json",
    "substituted Genesis manifest path",
    ["launch/substituted-genesis-manifest.json"],
  );

  const canonicalBaseUnitSupply = manifest.token.fixedSupplyBaseUnits;
  manifest.token.fixedSupplyBaseUnits = "999999999999999999";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-iat-supply-math.mjs",
    "token.fixedSupplyBaseUnits must equal recomputed supply 1000000000000000000",
    "manifest with drifted fixed base-unit supply",
  );
  manifest.token.fixedSupplyBaseUnits = canonicalBaseUnitSupply;

  const canonicalCommunityAmount = manifest.allocations.community.baseUnitAmount;
  manifest.allocations.community.baseUnitAmount = "499999999999999999";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-iat-supply-math.mjs",
    "allocations.community.baseUnitAmount must equal recomputed amount 500000000000000000",
    "manifest with a drifted community allocation",
  );
  manifest.allocations.community.baseUnitAmount = canonicalCommunityAmount;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
    assertRejected(
      script,
      "manifest path must be launch/genesis-manifest.template.json",
      "substituted Genesis manifest path",
      ["launch/substituted-genesis-manifest.json"],
    );
  }
  manifest.unreviewedApproval = encodeBase58(Buffer.alloc(64, 13));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
    assertRejected(
      script,
      "manifest must not contain credential-bearing value at manifest.unreviewedApproval",
      "manifest with bare 64-byte Base58 credential-shaped material",
    );
  }
  manifest.unreviewedApproval = "approved in a private chat";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-genesis-manifest.mjs",
    "manifest must contain only canonical reviewed fields",
    "manifest with an unreviewed approval assertion",
  );

  delete manifest.unreviewedApproval;
  for (const [field, value, expectedMessage] of [
    ["symbol", "STAR", "token symbol must be IAT"],
    ["name", "Star Ascent Token", "token name must be Internal Agency Token"],
  ]) {
    const canonicalValue = manifest.token[field];
    manifest.token[field] = value;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    assertRejected(
      "validate-genesis-manifest.mjs",
      expectedMessage,
      `manifest with an altered token ${field}`,
    );
    manifest.token[field] = canonicalValue;
  }

  manifest.token.mint = "stale-mint-identifier";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
    assertRejected(
      script,
      "HOLD requires token.mint to be null",
      "HOLD manifest retaining a prior mint",
    );
  }

  manifest.token.mint = null;
  manifest.allocations.community.evidence = "https://explorer.solana.com/address/stale-community-evidence";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
    assertRejected(
      script,
      "HOLD requires allocations.community.evidence to be null",
      "HOLD manifest retaining prior allocation evidence",
    );
  }

  manifest.allocations.community.evidence = null;
  manifest.claimOrDistribution.canonicalRoute = "https://launch.starascent.io/proof/allocation-lock";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
    assertRejected(
      script,
      "HOLD requires claimOrDistribution.canonicalRoute to be null",
      "HOLD manifest retaining a public claim route",
    );
  }

  manifest.claimOrDistribution.canonicalRoute = null;
  manifest.token.decimals = 8;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  assertRejected(
    "validate-mainnet-handoff.mjs",
    "handoff requires the canonical manifest validator to pass before any handoff state is accepted",
  );
  assertRejected(
    "validate-release-packet.mjs",
    "release packet requires the canonical manifest validator to pass before any packet state is accepted",
  );

  manifest.token.decimals = 9;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const checklistPath = join(sandboxRoot, "launch", "genesis-signing-checklist.template.json");
  const checklist = JSON.parse(readFileSync(checklistPath, "utf8"));
  checklist.ceremonyControls.noSecretsInChecklist = false;
  writeFileSync(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-mainnet-handoff.mjs",
    "handoff requires the canonical signer checklist validator to pass before any handoff state is accepted",
    "malformed canonical signer checklist",
  );

  checklist.ceremonyControls.noSecretsInChecklist = true;
  writeFileSync(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  const rehearsalPath = join(sandboxRoot, "launch", "devnet-rehearsal.template.json");
  const rehearsal = JSON.parse(readFileSync(rehearsalPath, "utf8"));
  rehearsal.token.decimals = 8;
  writeFileSync(rehearsalPath, `${JSON.stringify(rehearsal, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-mainnet-handoff.mjs",
    "handoff requires the canonical devnet rehearsal validator to pass before any handoff state is accepted",
    "malformed canonical devnet rehearsal",
  );

  rehearsal.token.decimals = 9;
  writeFileSync(rehearsalPath, `${JSON.stringify(rehearsal, null, 2)}\n`, "utf8");
  const payloadPath = join(sandboxRoot, "launch", "PUBLICATION_PAYLOAD.template.md");
  const payload = readFileSync(payloadPath, "utf8");
  writeFileSync(payloadPath, payload.replace("Network:", "Network missing:"), "utf8");
  assertRejected(
    "validate-release-packet.mjs",
    "release packet requires the canonical publication payload validator to pass before any packet state is accepted",
    "malformed canonical publication payload",
  );

  checklist.ceremonyControls.noSecretsInChecklist = false;
  writeFileSync(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-release-packet.mjs",
    "release packet requires the canonical signer checklist validator to pass before any packet state is accepted",
    "malformed canonical signer checklist",
  );

  checklist.ceremonyControls.noSecretsInChecklist = true;
  writeFileSync(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  rehearsal.token.decimals = 8;
  writeFileSync(rehearsalPath, `${JSON.stringify(rehearsal, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-release-packet.mjs",
    "release packet requires the canonical devnet rehearsal validator to pass before any packet state is accepted",
    "malformed canonical devnet rehearsal",
  );

  rehearsal.token.decimals = 9;
  writeFileSync(rehearsalPath, `${JSON.stringify(rehearsal, null, 2)}\n`, "utf8");
  const handoffPath = join(sandboxRoot, "launch", "mainnet-handoff.template.json");
  const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  handoff.holdControls.noSecretsInHandoff = false;
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-release-packet.mjs",
    "release packet requires the canonical mainnet handoff validator to pass before any packet state is accepted",
    "malformed canonical mainnet handoff",
  );

  handoff.holdControls.noSecretsInHandoff = true;
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
  const publishedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const address = (byte) => encodeBase58(Buffer.alloc(32, byte));
  const transaction = (byte) => encodeBase58(Buffer.alloc(64, byte));
  const mint = address(7);
  const mintAuthorityRevocation = transaction(8);
  const freezeAuthorityRevocation = transaction(9);
  const allocationMints = transaction(10);
  publishedManifest.status = "PUBLISHED";
  publishedManifest.token.mint = mint;
  publishedManifest.token.mintAuthorityRevocationTransaction = "https://explorer.solana.com/tx/" + mintAuthorityRevocation;
  publishedManifest.token.freezeAuthorityRevocationTransaction = "https://explorer.solana.com/tx/" + freezeAuthorityRevocation;
  publishedManifest.claimOrDistribution = {
    status: "PUBLISHED",
    canonicalRoute: "https://launch.starascent.io/proof/allocation-lock?alternate=unreviewed",
  };
  for (const [index, allocation] of Object.values(publishedManifest.allocations).entries()) {
    const destination = address(index + 20);
    allocation.destination = destination;
    allocation.evidence = `https://explorer.solana.com/address/${destination}`;
  }
  publishedManifest.releaseEvidence.records = {
    mintCreation: `https://explorer.solana.com/address/${mint}?creation=1`,
    allocationMints: `https://explorer.solana.com/tx/${allocationMints}`,
    mintAuthorityRevocation: publishedManifest.token.mintAuthorityRevocationTransaction,
    freezeAuthorityRevocation: publishedManifest.token.freezeAuthorityRevocationTransaction,
    publicationRecord: publishedManifest.claimOrDistribution.canonicalRoute,
  };
  writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-genesis-manifest.mjs",
    "PUBLISHED requires a non-placeholder public value for claimOrDistribution.canonicalRoute",
    "PUBLISHED manifest with a parameterized canonical proof route",
  );

  publishedManifest.claimOrDistribution.canonicalRoute = "https://internalagency.io/proof";
  publishedManifest.releaseEvidence.records.publicationRecord = publishedManifest.claimOrDistribution.canonicalRoute;
  for (const [label, mintCreation] of [
    ["a mintCreation record on an untrusted host", `https://proofs.starascent.io/address/${mint}`],
    ["a parameterized mintCreation record", `https://explorer.solana.com/address/${mint}?creation=1`],
    ["a mintCreation record on a non-default Explorer port", `https://explorer.solana.com:444/address/${mint}`],
  ]) {
    publishedManifest.releaseEvidence.records.mintCreation = mintCreation;
    writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
    for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
      assertRejected(
        script,
        "mintCreation evidence must be a direct explorer.solana.com address record for the claimed mint",
        label,
      );
    }
  }

  publishedManifest.releaseEvidence.records.mintCreation = "https://explorer.solana.com/address/" + mint;
  for (const [label, allocationMintsRecord] of [
    ["an allocationMints record on an untrusted host", `https://proofs.starascent.io/tx/${allocationMints}`],
    ["an allocationMints address record", `https://explorer.solana.com/address/${mint}`],
    ["a parameterized allocationMints record", `https://explorer.solana.com/tx/${allocationMints}?cluster=mainnet-beta`],
    ["an allocationMints record on a non-default Explorer port", `https://explorer.solana.com:444/tx/${allocationMints}`],
    ["a Base58-shaped but non-signature allocationMints record", "https://explorer.solana.com/tx/" + "2".repeat(64)],
    ["an all-zero Base58 allocationMints record", "https://explorer.solana.com/tx/" + "1".repeat(64)],
  ]) {
    publishedManifest.releaseEvidence.records.allocationMints = allocationMintsRecord;
    writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
    for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
      assertRejected(
        script,
        "PUBLISHED requires allocationMints to be a direct explorer.solana.com transaction record without a query string or fragment",
        label,
      );
    }
  }

  publishedManifest.releaseEvidence.records.allocationMints = "https://explorer.solana.com/tx/" + allocationMints;
  for (const [label, authorityRecord] of [
    ["a Base58-shaped but non-signature mint-authority record", "https://explorer.solana.com/tx/" + "2".repeat(64)],
    ["a Base58-shaped but non-signature freeze-authority record", "https://explorer.solana.com/tx/" + "3".repeat(64)],
    ["an all-zero Base58 mint-authority record", "https://explorer.solana.com/tx/" + "1".repeat(64)],
  ]) {
    const isMintAuthority = label.includes("mint-authority");
    const field = isMintAuthority ? "mintAuthorityRevocationTransaction" : "freezeAuthorityRevocationTransaction";
    const record = isMintAuthority ? "mintAuthorityRevocation" : "freezeAuthorityRevocation";
    publishedManifest.token[field] = authorityRecord;
    publishedManifest.releaseEvidence.records[record] = authorityRecord;
    writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
    for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
      assertRejected(
        script,
        `PUBLISHED requires ${record} to be a direct explorer.solana.com transaction record without a query string or fragment`,
        label,
      );
    }
    publishedManifest.token[field] = isMintAuthority
      ? "https://explorer.solana.com/tx/" + mintAuthorityRevocation
      : "https://explorer.solana.com/tx/" + freezeAuthorityRevocation;
    publishedManifest.releaseEvidence.records[record] = publishedManifest.token[field];
  }
  writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
  for (const [label, evidence] of [
    ["allocation evidence on an untrusted host", "https://proofs.starascent.io/address/" + publishedManifest.allocations.community.destination],
    ["parameterized allocation evidence", "https://explorer.solana.com/address/" + publishedManifest.allocations.community.destination + "?allocation=community"],
    ["allocation evidence on a non-default Explorer port", "https://explorer.solana.com:444/address/" + publishedManifest.allocations.community.destination],
  ]) {
    publishedManifest.allocations.community.evidence = evidence;
    writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
    for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
      assertRejected(
        script,
        "PUBLISHED requires community allocation evidence to be a direct explorer.solana.com address record for its destination",
        label,
      );
    }
  }

  publishedManifest.allocations.community.evidence = "https://explorer.solana.com/address/" + publishedManifest.allocations.community.destination;
  for (const [label, authorityRecord] of [
    ["an authority revocation record on an untrusted host", "https://proofs.starascent.io/tx/" + mintAuthorityRevocation],
    ["a parameterized authority revocation record", "https://explorer.solana.com/tx/" + mintAuthorityRevocation + "?cluster=mainnet-beta"],
    ["an authority revocation record on a non-default Explorer port", "https://explorer.solana.com:444/tx/" + mintAuthorityRevocation],
  ]) {
    publishedManifest.token.mintAuthorityRevocationTransaction = authorityRecord;
    publishedManifest.releaseEvidence.records.mintAuthorityRevocation = authorityRecord;
    writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
    for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
      assertRejected(
        script,
        "mintAuthorityRevocation to be a direct explorer.solana.com transaction record without a query string or fragment",
        label,
      );
    }
  }

  publishedManifest.token.mintAuthorityRevocationTransaction = "https://explorer.solana.com/tx/" + mintAuthorityRevocation;
  publishedManifest.releaseEvidence.records.mintAuthorityRevocation = publishedManifest.token.mintAuthorityRevocationTransaction;
  publishedManifest.token.freezeAuthorityRevocationTransaction = publishedManifest.token.mintAuthorityRevocationTransaction;
  publishedManifest.releaseEvidence.records.freezeAuthorityRevocation = publishedManifest.token.freezeAuthorityRevocationTransaction;
  writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
  for (const script of ["validate-genesis-manifest.mjs", "validate-genesis-transaction-order.mjs"]) {
    assertRejected(
      script,
      "PUBLISHED requires distinct direct transaction records for mint and freeze authority revocation",
      "PUBLISHED manifest reusing a mint-authority revocation record as freeze-authority proof",
    );
  }
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nManifest gate regression failed.");
else console.log("\nManifest gate regression passes.");

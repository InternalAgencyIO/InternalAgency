#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "iat-devnet-rehearsal-v2-"));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const digestJson = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const addressUrl = (value) => `https://explorer.solana.com/address/${value}?cluster=devnet`;
const transactionUrl = (value) => `https://explorer.solana.com/tx/${value}?cluster=devnet`;
const encodeBase58 = (bytes) => {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading += 1;
  return `${"1".repeat(leading)}${encoded}`;
};
const fakeSignature = (seed) => encodeBase58(Buffer.alloc(64, seed));

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });
  cpSync(join(repositoryRoot, "public"), join(sandboxRoot, "public"), { recursive: true });
  cpSync(join(repositoryRoot, "app", "mint"), join(sandboxRoot, "app", "mint"), { recursive: true });
  cpSync(join(repositoryRoot, "package-lock.json"), join(sandboxRoot, "package-lock.json"));
  symlinkSync(join(repositoryRoot, "node_modules"), join(sandboxRoot, "node_modules"), "junction");

  const rehearsalPath = join(sandboxRoot, "launch", "devnet-rehearsal.template.json");
  const metadataPath = join(sandboxRoot, "launch", "token-metadata.template.json");
  const lockPath = join(sandboxRoot, "launch", "allocation-lock-plan.template.json");
  const manifestPath = join(sandboxRoot, "launch", "genesis-manifest.template.json");
  const validator = join(sandboxRoot, "scripts", "validate-devnet-rehearsal.mjs");
  const run = (argument) => spawnSync(process.execPath, argument ? [validator, argument] : [validator], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const assertValid = (label) => {
    const result = run();
    if (result.error || result.status !== 0) fail(`${label}\n${result.stdout}\n${result.stderr}`);
    else console.log(`OK: ${label}`);
  };
  const canonicalPlanned = readFileSync(rehearsalPath, "utf8");
  const reject = (label, mutate, expected) => {
    const fixture = JSON.parse(canonicalPlanned);
    mutate(fixture);
    writeFileSync(rehearsalPath, `${JSON.stringify(fixture, null, 2)}\n`);
    const result = run();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.status === 0) fail(`validator accepted ${label}`);
    else if (!output.includes(expected)) fail(`validator did not report ${label}\n${output}`);
    else console.log(`OK: rejects ${label}`);
    writeFileSync(rehearsalPath, canonicalPlanned);
  };

  assertValid("canonical PLANNED v2 rehearsal");
  reject(
    "mainnet allocation drift",
    (fixture) => { fixture.mainnetPlan.allocationBaseUnitAmounts.treasury = "1"; },
    "mainnet allocation amounts",
  );
  reject(
    "transaction-order drift",
    (fixture) => { fixture.mainnetPlan.transactionOrder.reverse(); },
    "four-step ceremony",
  );
  reject(
    "credential-bearing field",
    (fixture) => { fixture.device.recoveryPhrase = "never store credentials here"; },
    "credential-bearing field rehearsal.device.recoveryPhrase",
  );
  reject(
    "stale PLANNED transaction evidence",
    (fixture) => { fixture.transactions.createInitializeMetadata = transactionUrl(fakeSignature(1)); },
    "PLANNED rehearsal must clear transaction evidence",
  );
  const substituted = run("launch/substituted-devnet-rehearsal.json");
  if (substituted.status === 0 || !`${substituted.stdout}${substituted.stderr}`.includes("rehearsal path must be")) {
    fail("validator accepted a substituted rehearsal path");
  } else {
    console.log("OK: rejects a substituted rehearsal path");
  }

  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  metadata.status = "READY";
  metadata.metadataJsonSha256 = sha256File(join(sandboxRoot, "public", "metadata", "iat.json"));
  metadata.review = { reviewedBy: "Metadata reviewer", reviewedAtUtc: new Date(Date.now() - 180_000).toISOString() };
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.status = "READY";
  const lockNames = Object.keys(lock.allocations);
  lockNames.forEach((name, index) => {
    const allocation = lock.allocations[name];
    if (allocation.lockRequired) {
      const program = Keypair.fromSeed(new Uint8Array(32).fill(index + 21)).publicKey;
      allocation.lockProgramId = program.toBase58();
      allocation.ownerAddress = PublicKey.findProgramAddressSync(
        [Buffer.from(`iat-${name}`)],
        program,
      )[0].toBase58();
      allocation.programEvidence = `https://explorer.solana.com/address/${allocation.lockProgramId}`;
    } else {
      allocation.ownerAddress = Keypair.fromSeed(new Uint8Array(32).fill(index + 11)).publicKey.toBase58();
    }
    allocation.vaultEvidence = `https://explorer.solana.com/address/${allocation.ownerAddress}`;
    allocation.scheduleEvidence = `https://internalagency.io/token-locks/${name}.json`;
  });
  lock.independentReview = {
    reviewedBy: "Independent lock reviewer",
    reviewedAtUtc: new Date(Date.now() - 120_000).toISOString(),
    planSha256: digestJson({ version: lock.version, network: lock.network, allocations: lock.allocations }),
  };
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const completed = JSON.parse(canonicalPlanned);
  completed.status = "COMPLETED";
  completed.mainnetPlan.sourceDigests = {
    manifestSha256: sha256File(manifestPath),
    metadataSha256: sha256File(metadataPath),
    lockPlanSha256: sha256File(lockPath),
    implementationSha256: createHash("sha256").update(
      completed.mainnetPlan.implementationPaths
        .map((path) => `${path}:${sha256File(join(sandboxRoot, path))}`)
        .join("\n"),
    ).digest("hex"),
  };
  completed.mainnetPlan.planSha256 = digestJson({
    sourceDigests: completed.mainnetPlan.sourceDigests,
    implementationPaths: completed.mainnetPlan.implementationPaths,
    network: completed.mainnetPlan.network,
    program: completed.mainnetPlan.program,
    programId: completed.mainnetPlan.programId,
    decimals: completed.mainnetPlan.decimals,
    fixedSupplyBaseUnits: completed.mainnetPlan.fixedSupplyBaseUnits,
    allocationBaseUnitAmounts: completed.mainnetPlan.allocationBaseUnitAmounts,
    transactionOrder: completed.mainnetPlan.transactionOrder,
  });
  const mint = Keypair.fromSeed(new Uint8Array(32).fill(71)).publicKey;
  const metadataProgram = new PublicKey(metadata.metadataProgramId);
  const metadataAddress = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), metadataProgram.toBuffer(), mint.toBuffer()],
    metadataProgram,
  )[0];
  Object.assign(completed.token, {
    mint: mint.toBase58(),
    metadataAddress: metadataAddress.toBase58(),
    mintEvidence: addressUrl(mint.toBase58()),
    metadataEvidence: addressUrl(metadataAddress.toBase58()),
  });
  const allocationReview = {};
  for (const [index, name] of Object.keys(completed.allocations).entries()) {
    const owner = Keypair.fromSeed(new Uint8Array(32).fill(index + 81)).publicKey;
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner, true, TOKEN_PROGRAM_ID);
    Object.assign(completed.allocations[name], {
      ownerAddress: owner.toBase58(),
      tokenAccount: tokenAccount.toBase58(),
      evidence: addressUrl(tokenAccount.toBase58()),
    });
    allocationReview[name] = {
      ownerAddress: owner.toBase58(),
      tokenAccount: tokenAccount.toBase58(),
      baseUnitAmount: completed.allocations[name].baseUnitAmount,
    };
  }
  const transactionEvidence = [1, 2, 3, 4].map((seed) => transactionUrl(fakeSignature(seed)));
  Object.assign(completed.transactions, Object.fromEntries(
    Object.keys(completed.transactions).map((field, index) => [field, transactionEvidence[index]]),
  ));
  const deviceTime = new Date(Date.now() - 120_000).toISOString();
  const reviewTime = new Date(Date.now() - 60_000).toISOString();
  Object.assign(completed.device, {
    operatorLabel: "Device operator",
    firmwareVersion: "2.8.7",
    suiteOrWalletInterface: "Backpack hardware wallet",
    confirmedActions: completed.mainnetPlan.transactionOrder,
    confirmedTransactionEvidence: transactionEvidence,
    confirmedPlanSha256: completed.mainnetPlan.planSha256,
    completedAtUtc: deviceTime,
  });
  Object.assign(completed.verifier, {
    reviewedBy: "Independent verifier",
    independentOfDeviceOperator: true,
    reviewedDevice: {
      model: completed.device.model,
      firmwareVersion: completed.device.firmwareVersion,
      suiteOrWalletInterface: completed.device.suiteOrWalletInterface,
    },
    reviewedMint: completed.token.mint,
    reviewedMetadataAddress: completed.token.metadataAddress,
    reviewedAllocations: allocationReview,
    reviewedActions: completed.mainnetPlan.transactionOrder,
    reviewedTransactionEvidence: transactionEvidence,
    reviewedPlanSha256: completed.mainnetPlan.planSha256,
    completedAtUtc: reviewTime,
  });
  writeFileSync(rehearsalPath, `${JSON.stringify(completed, null, 2)}\n`);
  assertValid("complete exact-shape Model T rehearsal");

  const completedText = readFileSync(rehearsalPath, "utf8");
  const rejectCompleted = (label, mutate, expected) => {
    const fixture = JSON.parse(completedText);
    mutate(fixture);
    writeFileSync(rehearsalPath, `${JSON.stringify(fixture, null, 2)}\n`);
    const result = run();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.status === 0) fail(`validator accepted ${label}`);
    else if (!output.includes(expected)) fail(`validator did not report ${label}\n${output}`);
    else console.log(`OK: rejects ${label}`);
    writeFileSync(rehearsalPath, completedText);
  };
  rejectCompleted(
    "noncanonical metadata PDA",
    (fixture) => { fixture.token.metadataAddress = Keypair.generate().publicKey.toBase58(); },
    "canonical mint PDA",
  );
  rejectCompleted(
    "reused transaction proof",
    (fixture) => { fixture.transactions.mintAllocations = fixture.transactions.createInitializeMetadata; },
    "four distinct canonical devnet transaction proofs",
  );
  rejectCompleted(
    "stale plan digest",
    (fixture) => { fixture.mainnetPlan.planSha256 = "0".repeat(64); },
    "canonical mainnet plan digest",
  );
  rejectCompleted(
    "device operator reused as verifier through whitespace and format characters",
    (fixture) => { fixture.verifier.reviewedBy = "  DEVICE\u200b   OPERATOR  "; },
    "accountability-label normalization",
  );
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nDevnet rehearsal regression failed.");
else console.log("\nDevnet rehearsal regression passes.");

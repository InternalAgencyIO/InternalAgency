#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-release-packet-"));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const digestRecord = (record) => sha256Text(Object.entries(record).map(([path, digest]) => `${path}:${digest}`).join("\n"));
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
const address = (seed) => encodeBase58(Buffer.alloc(32, seed));
const signature = (seed) => encodeBase58(Buffer.alloc(64, seed));
const devnetAddressUrl = (value) => `https://explorer.solana.com/address/${value}?cluster=devnet`;
const devnetTransactionUrl = (value) => `https://explorer.solana.com/tx/${value}?cluster=devnet`;

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });
  cpSync(join(repositoryRoot, "public"), join(sandboxRoot, "public"), { recursive: true });
  cpSync(join(repositoryRoot, "app", "mint"), join(sandboxRoot, "app", "mint"), { recursive: true });
  cpSync(join(repositoryRoot, "pnpm-lock.yaml"), join(sandboxRoot, "pnpm-lock.yaml"));
  symlinkSync(join(repositoryRoot, "node_modules"), join(sandboxRoot, "node_modules"), "junction");

  const packetPath = join(sandboxRoot, "launch", "release-packet.template.json");
  const manifestPath = join(sandboxRoot, "launch", "genesis-manifest.template.json");
  const payloadPath = join(sandboxRoot, "launch", "PUBLICATION_PAYLOAD.template.md");
  const checklistPath = join(sandboxRoot, "launch", "genesis-signing-checklist.template.json");
  const rehearsalPath = join(sandboxRoot, "launch", "devnet-rehearsal.template.json");
  const handoffPath = join(sandboxRoot, "launch", "mainnet-handoff.template.json");
  const metadataPath = join(sandboxRoot, "launch", "token-metadata.template.json");
  const lockPlanPath = join(sandboxRoot, "launch", "allocation-lock-plan.template.json");
  const canonicalPacket = JSON.parse(readFileSync(packetPath, "utf8"));
  const canonicalArtifacts = new Map([
    [manifestPath, readFileSync(manifestPath, "utf8")],
    [payloadPath, readFileSync(payloadPath, "utf8")],
    [checklistPath, readFileSync(checklistPath, "utf8")],
    [rehearsalPath, readFileSync(rehearsalPath, "utf8")],
    [handoffPath, readFileSync(handoffPath, "utf8")],
    [metadataPath, readFileSync(metadataPath, "utf8")],
    [lockPlanPath, readFileSync(lockPlanPath, "utf8")],
  ]);
  const runValidator = () => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-packet.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const runValidatorAt = (path) => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-packet.mjs"), path], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const runHandoffValidator = () => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-mainnet-handoff.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const writePacket = (fixture) => writeFileSync(packetPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const assertValid = (label) => {
    writePacket(canonicalPacket);
    const result = runValidator();
    if (result.error || result.status !== 0) fail(`release packet validator rejected ${label}`);
    else console.log(`OK: release packet validator accepts ${label}`);
  };
  const assertRejected = (label, mutate, expectedMessage) => {
    const fixture = JSON.parse(JSON.stringify(canonicalPacket));
    mutate(fixture);
    writePacket(fixture);
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`release packet validator accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`release packet validator did not report ${label}`);
    else console.log(`OK: release packet validator rejects ${label}`);
  };
  const restoreCanonicalArtifacts = () => {
    for (const [path, contents] of canonicalArtifacts) writeFileSync(path, contents, "utf8");
  };
  const assertDependencyRejected = (label, path, mutate, expectedMessage) => {
    restoreCanonicalArtifacts();
    writePacket(canonicalPacket);
    mutate(path);
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`release packet validator accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`release packet validator did not report ${label}`);
    else console.log(`OK: release packet validator requires a valid ${label}`);
  };

  assertValid("the canonical HOLD packet");
  const substitutedPacketPath = join(sandboxRoot, "launch", "substituted-release-packet.json");
  writeFileSync(substitutedPacketPath, `${JSON.stringify(canonicalPacket, null, 2)}\n`, "utf8");
  const substitutedPathValidation = runValidatorAt("launch/substituted-release-packet.json");
  const substitutedPathOutput = `${substitutedPathValidation.stdout}\n${substitutedPathValidation.stderr}`;
  if (substitutedPathValidation.error || substitutedPathValidation.status === 0) {
    fail("release packet validator accepted a substituted packet path");
  } else if (!substitutedPathOutput.includes("release packet path must be launch/release-packet.template.json")) {
    fail("release packet validator did not report a substituted packet path");
  } else {
    console.log("OK: release packet validator rejects a substituted packet path");
  }
  // A malformed substitute must not be parsed before the canonical-path gate;
  // the path violation is the actionable launch-control failure.
  const malformedSubstitutedPacketPath = join(sandboxRoot, "launch", "malformed-release-packet.json");
  writeFileSync(malformedSubstitutedPacketPath, "this is not JSON\n", "utf8");
  const malformedSubstitutedPathValidation = runValidatorAt("launch/malformed-release-packet.json");
  const malformedSubstitutedPathOutput = `${malformedSubstitutedPathValidation.stdout}\n${malformedSubstitutedPathValidation.stderr}`;
  if (malformedSubstitutedPathValidation.error || malformedSubstitutedPathValidation.status === 0) {
    fail("release packet validator accepted or parsed a malformed substituted packet path");
  } else if (!malformedSubstitutedPathOutput.includes("release packet path must be launch/release-packet.template.json")) {
    fail("release packet validator did not report a malformed substituted packet path");
  } else if (malformedSubstitutedPathOutput.includes("SyntaxError")) {
    fail("release packet validator parsed a malformed substituted packet path");
  } else {
    console.log("OK: release packet validator never parses a malformed substituted packet path");
  }
  assertRejected(
    "a HOLD packet that permits mismatch publication",
    (fixture) => { fixture.releaseControls.stopOnAnyMismatch = false; },
    "releaseControls.stopOnAnyMismatch must be true",
  );
  assertRejected(
    "a HOLD packet that permits publication before independent evidence",
    (fixture) => { fixture.releaseControls.noPublicationBeforeIndependentEvidence = false; },
    "releaseControls.noPublicationBeforeIndependentEvidence must be true",
  );
  assertRejected(
    "a non-canonical manifest source path",
    (fixture) => { fixture.sourceArtifacts.manifestPath = "launch/review-copy.json"; },
    "manifestPath must point to the canonical artifact",
  );
  assertRejected(
    "a mnemonic-shaped correction owner label",
    (fixture) => { fixture.releaseControls.correctionOwnerLabel = "amber bridge candle drift ember forest galaxy harbor island jungle kindle lantern"; },
    "credential-bearing value at packet.releaseControls.correctionOwnerLabel",
  );
  for (const [index, path] of [
    "releaseControls.correctionOwnerLabel",
    "approval.releaseOwnerLabel",
    "approval.independentVerifierLabel",
  ].entries()) {
    assertRejected(
      `64-byte Base58 credential-shaped material at ${path}`,
      (fixture) => {
        const [section, field] = path.split(".");
        fixture[section][field] = signature(index + 9);
      },
      `credential-bearing value at packet.${path}`,
    );
  }
  assertRejected(
    "an unreviewed extra packet assertion",
    (fixture) => { fixture.emergencyOverride = "not allowed"; },
    "release packet must contain only its exact canonical reviewed fields",
  );
  // HOLD is a complete reset. Exercise every approval, review, and digest
  // field so a future schema change cannot let a stale release decision look
  // usable after the packet returns to its stop state.
  for (const [path, staleValue, expectedMessage] of [
    ["releaseControls.allOperatorsReviewedSameArtifactVersions", true, "HOLD requires releaseControls.allOperatorsReviewedSameArtifactVersions to be false so no prior approval can survive a reset"],
    ["releaseControls.publicEvidenceCheckedAtUtc", "2026-07-28T18:00:00.000Z", "HOLD requires releaseControls.publicEvidenceCheckedAtUtc to be null so no prior approval can survive a reset"],
    ["releaseControls.correctionOwnerLabel", "Previous correction owner", "HOLD requires releaseControls.correctionOwnerLabel to be null so no prior approval can survive a reset"],
    ["approval.releaseOwnerLabel", "Previous release owner", "HOLD requires approval.releaseOwnerLabel to be null so no prior approval can survive a reset"],
    ["approval.independentVerifierLabel", "Previous independent verifier", "HOLD requires approval.independentVerifierLabel to be null so no prior approval can survive a reset"],
    ["approval.packetDigest", "a".repeat(64), "HOLD requires approval.packetDigest to be null so no prior approval can survive a reset"],
    ["approval.approvedAtUtc", "2026-07-28T18:00:00.000Z", "HOLD requires approval.approvedAtUtc to be null so no prior approval can survive a reset"],
  ]) {
    assertRejected(
      `a HOLD packet retaining stale ${path}`,
      (fixture) => {
        const [section, field] = path.split(".");
        fixture[section][field] = staleValue;
      },
      expectedMessage,
    );
  }
  for (const field of Object.keys(canonicalPacket.artifactDigests)) {
    assertRejected(
      `a HOLD packet retaining stale artifactDigests.${field}`,
      (fixture) => { fixture.artifactDigests[field] = "a".repeat(64); },
      `HOLD requires artifactDigests.${field} to be null so no prior approval digest can survive a reset`,
    );
  }

  writePacket(canonicalPacket);
  const canonicalManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  canonicalManifest.token.decimals = 8;
  writeFileSync(manifestPath, `${JSON.stringify(canonicalManifest, null, 2)}\n`, "utf8");
  const malformedDependency = runValidator();
  const dependencyOutput = `${malformedDependency.stdout}\n${malformedDependency.stderr}`;
  if (malformedDependency.error || malformedDependency.status === 0) {
    fail("release packet validator accepted a malformed canonical manifest dependency");
  } else if (!dependencyOutput.includes("release packet requires the canonical manifest validator to pass")) {
    fail("release packet validator did not report the malformed canonical manifest dependency");
  } else {
    console.log("OK: release packet validator requires a valid canonical manifest");
  }
  assertDependencyRejected(
    "canonical publication payload dependency",
    payloadPath,
    (path) => writeFileSync(path, `${readFileSync(path, "utf8")}\nSecret key: prohibited fixture\n`, "utf8"),
    "release packet requires the canonical publication payload validator to pass",
  );
  assertDependencyRejected(
    "canonical signer checklist dependency",
    checklistPath,
    (path) => {
      const fixture = JSON.parse(readFileSync(path, "utf8"));
      fixture.network = "devnet";
      writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    },
    "release packet requires the canonical signer checklist validator to pass",
  );
  assertDependencyRejected(
    "canonical Model T devnet rehearsal dependency",
    rehearsalPath,
    (path) => {
      const fixture = JSON.parse(readFileSync(path, "utf8"));
      fixture.token.decimals = 8;
      writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    },
    "release packet requires the canonical devnet rehearsal validator to pass",
  );
  assertDependencyRejected(
    "canonical mainnet handoff dependency",
    handoffPath,
    (path) => {
      const fixture = JSON.parse(readFileSync(path, "utf8"));
      fixture.sourceArtifacts.manifestPath = "launch/review-copy.json";
      writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    },
    "release packet requires the canonical mainnet handoff validator to pass",
  );

  // Build one fully valid READY ceremony so ordering controls are exercised
  // through the same validators used for the production handoff.
  restoreCanonicalArtifacts();
  writePacket(canonicalPacket);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  metadata.status = "READY";
  metadata.metadataJsonSha256 = sha256File(join(sandboxRoot, "public", "metadata", "iat.json"));
  metadata.review = {
    reviewedBy: "Metadata reviewer",
    reviewedAtUtc: new Date(Date.now() - (7 * 60 * 1000)).toISOString(),
  };
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  const lockPlan = JSON.parse(readFileSync(lockPlanPath, "utf8"));
  lockPlan.status = "READY";
  const lockOwners = {};
  for (const [index, name] of Object.keys(lockPlan.allocations).entries()) {
    const allocation = lockPlan.allocations[name];
    if (allocation.lockRequired) {
      const program = Keypair.fromSeed(new Uint8Array(32).fill(index + 41)).publicKey;
      allocation.lockProgramId = program.toBase58();
      allocation.ownerAddress = PublicKey.findProgramAddressSync(
        [Buffer.from(`iat-${name}`)],
        program,
      )[0].toBase58();
      allocation.programEvidence = `https://explorer.solana.com/address/${allocation.lockProgramId}`;
    } else {
      allocation.ownerAddress = Keypair.fromSeed(new Uint8Array(32).fill(index + 31)).publicKey.toBase58();
    }
    allocation.vaultEvidence = `https://explorer.solana.com/address/${allocation.ownerAddress}`;
    allocation.scheduleEvidence = `https://internalagency.io/token-locks/${name}.json`;
    lockOwners[name] = allocation.ownerAddress;
  }
  lockPlan.independentReview = {
    reviewedBy: "Independent lock reviewer",
    reviewedAtUtc: new Date(Date.now() - (6 * 60 * 1000)).toISOString(),
    planSha256: sha256Text(JSON.stringify({
      version: lockPlan.version,
      network: lockPlan.network,
      allocations: lockPlan.allocations,
    })),
  };
  writeFileSync(lockPlanPath, `${JSON.stringify(lockPlan, null, 2)}\n`, "utf8");

  const checklist = JSON.parse(readFileSync(checklistPath, "utf8"));
  checklist.status = "READY";
  const signerAddress = address(1);
  checklist.participants.mintAuthoritySigner.publicAddress = signerAddress;
  checklist.participants.feePayerSigner.publicAddress = signerAddress;
  checklist.participants.independentVerifier.publicAddress = address(2);
  checklist.participants.publicationOperator.publicAddress = address(3);
  checklist.participants.mintAuthoritySigner.devicePathReviewed = true;
  checklist.participants.feePayerSigner.devicePathReviewed = true;
  checklist.participants.independentVerifier.reviewedManifest = true;
  checklist.participants.independentVerifier.reviewedDestinations = true;
  checklist.participants.publicationOperator.reviewedHoldControls = true;
  Object.assign(checklist.ceremonyControls, {
    recipientAddressesCheckedAgainstManifest: true,
    signerAddressesCheckedAgainstManifest: true,
    holdOwnerConfirmed: true,
    manifestSha256: sha256File(manifestPath),
    readyAtUtc: new Date(Date.now() - (4 * 60 * 1000)).toISOString(),
  });
  for (const allocation of Object.keys(checklist.ceremonyControls.reviewedRecipientDestinations)) {
    checklist.ceremonyControls.reviewedRecipientDestinations[allocation].publicAddress = lockOwners[allocation];
  }
  writeFileSync(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");

  const rehearsal = JSON.parse(readFileSync(rehearsalPath, "utf8"));
  rehearsal.status = "COMPLETED";
  rehearsal.mainnetPlan.sourceDigests = {
    manifestSha256: sha256File(manifestPath),
    metadataSha256: sha256File(metadataPath),
    lockPlanSha256: sha256File(lockPlanPath),
    implementationSha256: sha256Text(
      rehearsal.mainnetPlan.implementationPaths
        .map((path) => `${path}:${sha256File(join(sandboxRoot, path))}`)
        .join("\n"),
    ),
  };
  rehearsal.mainnetPlan.planSha256 = sha256Text(JSON.stringify({
    sourceDigests: rehearsal.mainnetPlan.sourceDigests,
    implementationPaths: rehearsal.mainnetPlan.implementationPaths,
    network: rehearsal.mainnetPlan.network,
    program: rehearsal.mainnetPlan.program,
    programId: rehearsal.mainnetPlan.programId,
    decimals: rehearsal.mainnetPlan.decimals,
    fixedSupplyBaseUnits: rehearsal.mainnetPlan.fixedSupplyBaseUnits,
    allocationBaseUnitAmounts: rehearsal.mainnetPlan.allocationBaseUnitAmounts,
    transactionOrder: rehearsal.mainnetPlan.transactionOrder,
  }));
  const mint = Keypair.fromSeed(new Uint8Array(32).fill(71)).publicKey;
  const metadataProgram = new PublicKey(metadata.metadataProgramId);
  const metadataAddress = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), metadataProgram.toBuffer(), mint.toBuffer()],
    metadataProgram,
  )[0];
  Object.assign(rehearsal.token, {
    mint: mint.toBase58(),
    metadataAddress: metadataAddress.toBase58(),
    mintEvidence: devnetAddressUrl(mint.toBase58()),
    metadataEvidence: devnetAddressUrl(metadataAddress.toBase58()),
  });
  const allocationReview = {};
  for (const [index, name] of Object.keys(rehearsal.allocations).entries()) {
    const owner = Keypair.fromSeed(new Uint8Array(32).fill(index + 81)).publicKey;
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner, true, TOKEN_PROGRAM_ID);
    Object.assign(rehearsal.allocations[name], {
      ownerAddress: owner.toBase58(),
      tokenAccount: tokenAccount.toBase58(),
      evidence: devnetAddressUrl(tokenAccount.toBase58()),
    });
    allocationReview[name] = {
      ownerAddress: owner.toBase58(),
      tokenAccount: tokenAccount.toBase58(),
      baseUnitAmount: rehearsal.allocations[name].baseUnitAmount,
    };
  }
  const actions = rehearsal.mainnetPlan.transactionOrder;
  const transactionEvidence = [30, 31, 32, 33].map((seed) => devnetTransactionUrl(signature(seed)));
  Object.assign(rehearsal.transactions, Object.fromEntries(
    Object.keys(rehearsal.transactions).map((field, index) => [field, transactionEvidence[index]]),
  ));
  Object.assign(rehearsal.device, {
    operatorLabel: "Model T operator",
    firmwareVersion: "2.8.7",
    suiteOrWalletInterface: "Backpack hardware wallet",
    completedAtUtc: new Date(Date.now() - (3 * 60 * 1000)).toISOString(),
    confirmedActions: actions,
    confirmedTransactionEvidence: transactionEvidence,
    confirmedPlanSha256: rehearsal.mainnetPlan.planSha256,
  });
  Object.assign(rehearsal.verifier, {
    reviewedBy: "Devnet verifier",
    independentOfDeviceOperator: true,
    reviewedDevice: { model: rehearsal.device.model, firmwareVersion: rehearsal.device.firmwareVersion, suiteOrWalletInterface: rehearsal.device.suiteOrWalletInterface },
    reviewedMint: rehearsal.token.mint,
    reviewedMetadataAddress: rehearsal.token.metadataAddress,
    reviewedAllocations: allocationReview,
    reviewedActions: actions,
    reviewedTransactionEvidence: transactionEvidence,
    reviewedPlanSha256: rehearsal.mainnetPlan.planSha256,
    completedAtUtc: new Date(Date.now() - (2 * 60 * 1000)).toISOString(),
  });
  writeFileSync(rehearsalPath, `${JSON.stringify(rehearsal, null, 2)}\n`, "utf8");

  const snapshotResult = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "create-release-snapshot.mjs")], { cwd: sandboxRoot, encoding: "utf8" });
  if (snapshotResult.error || snapshotResult.status !== 0) fail("could not create a fresh READY-path release snapshot fixture");
  const snapshot = JSON.parse(readFileSync(join(sandboxRoot, "launch", "release-snapshot.generated.json"), "utf8"));
  const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  const handoffArtifactDigests = {
    manifestSha256: sha256File(manifestPath),
    signingChecklistSha256: sha256File(checklistPath),
    devnetRehearsalSha256: sha256File(rehearsalPath),
  };
  // Use the recorded snapshot time, rather than wall-clock offsets, so this
  // causal fixture remains valid even on a slow CI worker.
  const snapshotMs = Date.parse(snapshot.generatedAtUtc);
  const evidenceCheckedAtUtc = new Date(snapshotMs + 1000).toISOString();
  Object.assign(handoff, { status: "APPROVED" });
  Object.assign(handoff.approval, {
    releaseOwnerLabel: "Release owner",
    independentVerifierLabel: "Handoff verifier",
    manifestDigest: handoffArtifactDigests.manifestSha256,
    destinationDigest: sha256Text(JSON.stringify({ handoffVersion: 1, network: handoff.network, artifactDigests: handoffArtifactDigests })),
    releaseSnapshotDigest: digestRecord(snapshot.preApprovalArtifacts),
    ...handoffArtifactDigests,
    approvedAtUtc: new Date(snapshotMs).toISOString(),
  });
  handoff.holdControls.correctionOwnerLabel = "Correction owner";
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");

  const simultaneousApprovalResult = runHandoffValidator();
  const simultaneousApprovalOutput = `${simultaneousApprovalResult.stdout}\n${simultaneousApprovalResult.stderr}`;
  if (simultaneousApprovalResult.error || simultaneousApprovalResult.status === 0) {
    fail("mainnet handoff validator accepted approval simultaneous with its frozen snapshot");
  } else if (!simultaneousApprovalOutput.includes("approval.approvedAtUtc must be after the frozen approval snapshot")) {
    fail("mainnet handoff validator did not report approval simultaneous with its frozen snapshot");
  } else {
    console.log("OK: mainnet handoff validator rejects approval simultaneous with its frozen snapshot");
  }

  handoff.approval.approvedAtUtc = new Date(snapshotMs + 2000).toISOString();
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");

  const readyPacket = JSON.parse(JSON.stringify(canonicalPacket));
  readyPacket.status = "READY";
  Object.assign(readyPacket.releaseControls, {
    allOperatorsReviewedSameArtifactVersions: true,
    publicEvidenceCheckedAtUtc: evidenceCheckedAtUtc,
    correctionOwnerLabel: handoff.holdControls.correctionOwnerLabel,
  });
  Object.assign(readyPacket.approval, {
    releaseOwnerLabel: handoff.approval.releaseOwnerLabel,
    independentVerifierLabel: handoff.approval.independentVerifierLabel,
    approvedAtUtc: new Date(snapshotMs + 3000).toISOString(),
  });
  Object.assign(readyPacket.artifactDigests, {
    manifestSha256: sha256File(manifestPath),
    publicationPayloadSha256: sha256File(payloadPath),
    signingChecklistSha256: sha256File(checklistPath),
    devnetRehearsalSha256: sha256File(rehearsalPath),
    mainnetHandoffSha256: sha256File(handoffPath),
  });
  readyPacket.approval.packetDigest = sha256Text(JSON.stringify({ packetVersion: 1, artifactDigests: readyPacket.artifactDigests }));
  writePacket(readyPacket);
  const readyResult = runValidator();
  if (readyResult.error || readyResult.status !== 0) fail(`release packet validator rejected a coherent READY ceremony: ${readyResult.stdout}\n${readyResult.stderr}`);
  else console.log("OK: release packet validator accepts a coherent READY ceremony");
  const proofGeneration = spawnSync(
    process.execPath,
    [join(sandboxRoot, "scripts", "create-pre-publication-packet-proof.mjs")],
    { cwd: sandboxRoot, encoding: "utf8" },
  );
  const proofValidation = spawnSync(
    process.execPath,
    [join(sandboxRoot, "scripts", "validate-pre-publication-packet-proof.mjs")],
    { cwd: sandboxRoot, encoding: "utf8" },
  );
  if (proofGeneration.error || proofGeneration.status !== 0 || proofValidation.error || proofValidation.status !== 0) {
    fail(`coherent READY ceremony did not produce a valid pre-publication packet proof: ${proofGeneration.stderr}\n${proofValidation.stderr}`);
  } else {
    console.log("OK: coherent READY ceremony produces a valid pre-publication packet proof");
  }

  // The final release approval must be a distinct recorded decision after
  // the approved handoff; equal timestamps cannot establish that sequence.
  readyPacket.approval.approvedAtUtc = handoff.approval.approvedAtUtc;
  writePacket(readyPacket);
  const simultaneousPacketAndHandoffResult = runValidator();
  const simultaneousPacketAndHandoffOutput = `${simultaneousPacketAndHandoffResult.stdout}\n${simultaneousPacketAndHandoffResult.stderr}`;
  if (simultaneousPacketAndHandoffResult.error || simultaneousPacketAndHandoffResult.status === 0) {
    fail("release packet validator accepted approval simultaneous with its approved handoff");
  } else if (!simultaneousPacketAndHandoffOutput.includes("READY requires packet approval.approvedAtUtc to be strictly after the approved handoff")) {
    fail("release packet validator did not report approval simultaneous with its approved handoff");
  } else {
    console.log("OK: release packet validator rejects approval simultaneous with its approved handoff");
  }
  readyPacket.approval.approvedAtUtc = new Date(snapshotMs + 3000).toISOString();
  writePacket(readyPacket);

  // Public evidence review and the independent handoff must be two distinct
  // recorded events. A shared timestamp cannot prove that the handoff saw the
  // evidence check, even when every artifact digest still matches.
  handoff.approval.approvedAtUtc = evidenceCheckedAtUtc;
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
  readyPacket.artifactDigests.mainnetHandoffSha256 = sha256File(handoffPath);
  readyPacket.approval.packetDigest = sha256Text(JSON.stringify({ packetVersion: 1, artifactDigests: readyPacket.artifactDigests }));
  writePacket(readyPacket);
  const simultaneousEvidenceAndHandoffResult = runValidator();
  const simultaneousEvidenceAndHandoffOutput = `${simultaneousEvidenceAndHandoffResult.stdout}\n${simultaneousEvidenceAndHandoffResult.stderr}`;
  if (simultaneousEvidenceAndHandoffResult.error || simultaneousEvidenceAndHandoffResult.status === 0) {
    fail("release packet validator accepted a handoff simultaneous with its public evidence check");
  } else if (!simultaneousEvidenceAndHandoffOutput.includes("READY requires handoff approval.approvedAtUtc to be strictly after the public evidence check")) {
    fail("release packet validator did not report a handoff simultaneous with its public evidence check");
  } else {
    console.log("OK: release packet validator rejects a handoff simultaneous with its public evidence check");
  }

  handoff.approval.approvedAtUtc = new Date(snapshotMs + 2000).toISOString();
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
  readyPacket.artifactDigests.mainnetHandoffSha256 = sha256File(handoffPath);
  readyPacket.approval.packetDigest = sha256Text(JSON.stringify({ packetVersion: 1, artifactDigests: readyPacket.artifactDigests }));
  writePacket(readyPacket);

  // Evidence review must happen after the immutable snapshot is created. A
  // shared timestamp cannot establish that the reviewer saw the frozen packet.
  readyPacket.releaseControls.publicEvidenceCheckedAtUtc = snapshot.generatedAtUtc;
  writePacket(readyPacket);
  const simultaneousEvidenceAndSnapshotResult = runValidator();
  const simultaneousEvidenceAndSnapshotOutput = `${simultaneousEvidenceAndSnapshotResult.stdout}\n${simultaneousEvidenceAndSnapshotResult.stderr}`;
  if (simultaneousEvidenceAndSnapshotResult.error || simultaneousEvidenceAndSnapshotResult.status === 0) {
    fail("release packet validator accepted public evidence simultaneous with the frozen snapshot");
  } else if (!simultaneousEvidenceAndSnapshotOutput.includes("READY requires publicEvidenceCheckedAtUtc to be strictly after the frozen release snapshot")) {
    fail("release packet validator did not report public evidence simultaneous with the frozen snapshot");
  } else {
    console.log("OK: release packet validator rejects public evidence simultaneous with the frozen snapshot");
  }

  readyPacket.releaseControls.publicEvidenceCheckedAtUtc = new Date(Date.parse(snapshot.generatedAtUtc) - 1000).toISOString();
  writePacket(readyPacket);
  const staleEvidenceResult = runValidator();
  const staleEvidenceOutput = `${staleEvidenceResult.stdout}\n${staleEvidenceResult.stderr}`;
  if (staleEvidenceResult.error || staleEvidenceResult.status === 0) {
    fail("release packet validator accepted public evidence checked before the frozen snapshot");
  } else if (!staleEvidenceOutput.includes("READY requires publicEvidenceCheckedAtUtc to be strictly after the frozen release snapshot")) {
    fail("release packet validator did not report public evidence checked before the frozen snapshot");
  } else {
    console.log("OK: release packet validator rejects public evidence checked before the frozen snapshot");
  }
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nRelease packet regression failed.");
else console.log("\nRelease packet regression passes.");

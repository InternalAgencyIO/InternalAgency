#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-pre-publication-proof-"));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

try {
  mkdirSync(join(sandboxRoot, "scripts"), { recursive: true });
  mkdirSync(join(sandboxRoot, "launch"), { recursive: true });
  for (const script of [
    "create-pre-publication-packet-proof.mjs",
    "validate-pre-publication-packet-proof.mjs",
  ]) {
    cpSync(join(repositoryRoot, "scripts", script), join(sandboxRoot, "scripts", script));
  }

  const artifactPaths = {
    manifestSha256: "launch/genesis-manifest.template.json",
    publicationPayloadSha256: "launch/PUBLICATION_PAYLOAD.template.md",
    signingChecklistSha256: "launch/genesis-signing-checklist.template.json",
    devnetRehearsalSha256: "launch/devnet-rehearsal.template.json",
    mainnetHandoffSha256: "launch/mainnet-handoff.template.json",
  };
  for (const [index, path] of Object.values(artifactPaths).entries()) {
    writeFileSync(join(sandboxRoot, path), `reviewed pre-publication artifact ${index}\n`, "utf8");
  }
  const snapshotPath = join(sandboxRoot, "launch", "release-snapshot.generated.json");
  writeFileSync(
    snapshotPath,
    `${JSON.stringify({ version: 1, status: "HOLD", fixture: true }, null, 2)}\n`,
    "utf8",
  );

  const artifactDigests = Object.fromEntries(Object.entries(artifactPaths).map(
    ([field, path]) => [field, sha256(readFileSync(join(sandboxRoot, path)))],
  ));
  const packetObservedAtUtc = new Date(Date.now() - 60_000).toISOString();
  const packet = {
    status: "READY",
    artifactDigests,
    automatedClosure: {
      packetDigest: sha256(JSON.stringify({ packetVersion: 1, artifactDigests })),
      observedAtUtc: packetObservedAtUtc,
    },
  };
  const packetPath = join(sandboxRoot, "launch", "release-packet.template.json");
  const proofPath = join(sandboxRoot, "launch", "pre-publication-packet-proof.generated.json");
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  // The full release-packet validator has its own regression suite. This stub
  // gives the proof test a minimal READY fixture while still proving that the
  // generator invokes the canonical validator and refuses HOLD.
  writeFileSync(join(sandboxRoot, "scripts", "validate-release-packet.mjs"), [
    'import { readFileSync, writeFileSync } from "node:fs";',
    'const path = process.argv[2] ?? "launch/release-packet.template.json";',
    'const packet = JSON.parse(readFileSync(path, "utf8"));',
    'writeFileSync("packet-validator-invoked.txt", "yes\\n", "utf8");',
    'if (packet.status !== "READY") {',
    '  console.error("FAIL: fixture release packet must be READY");',
    '  process.exit(1);',
    '}',
    "",
  ].join("\n"), "utf8");

  const runGenerator = () => spawnSync(
    process.execPath,
    [join(sandboxRoot, "scripts", "create-pre-publication-packet-proof.mjs")],
    { cwd: sandboxRoot, encoding: "utf8" },
  );
  const runValidator = () => spawnSync(
    process.execPath,
    [join(sandboxRoot, "scripts", "validate-pre-publication-packet-proof.mjs")],
    { cwd: sandboxRoot, encoding: "utf8" },
  );

  const generation = runGenerator();
  if (generation.error || generation.status !== 0) {
    fail(`proof generator rejected a coherent minimal READY packet: ${generation.stderr.trim()}`);
  } else if (readFileSync(join(sandboxRoot, "packet-validator-invoked.txt"), "utf8") !== "yes\n") {
    fail("proof generator did not invoke the canonical release-packet validator");
  } else {
    console.log("OK: proof generator seals a validator-approved READY packet");
  }

  const generatedProof = JSON.parse(readFileSync(proofPath, "utf8"));
  if (generatedProof.releaseSnapshotPath !== "launch/release-snapshot.generated.json"
    || generatedProof.releaseSnapshotSha256 !== sha256(readFileSync(snapshotPath))) {
    fail("proof generator did not bind the exact canonical release-snapshot bytes");
  } else {
    console.log("OK: proof generator binds the exact canonical release-snapshot bytes");
  }

  const validation = runValidator();
  if (validation.error || validation.status !== 0) {
    fail(`proof validator rejected the generated proof: ${validation.stderr.trim()}`);
  } else {
    console.log("OK: proof validator accepts the canonical generated proof");
  }

  // Fault-inject a release-snapshot edit after every semantic and digest check
  // has passed. The final stable reread must still reject the validator run.
  const validatorPath = join(sandboxRoot, "scripts", "validate-pre-publication-packet-proof.mjs");
  const canonicalValidatorSource = readFileSync(validatorPath, "utf8").replaceAll("\r\n", "\n");
  const stableReadMarker = [
    "if (!process.exitCode) {",
    "  for (const [path, reviewedBytes] of reviewedInputBytes) {",
  ].join("\n");
  const injectedStableRead = [
    "if (!process.exitCode) {",
    '  appendFileSync(canonicalSnapshotPath, "late-swap fixture\\n");',
    "  for (const [path, reviewedBytes] of reviewedInputBytes) {",
  ].join("\n");
  const validatorWithWriteImport = canonicalValidatorSource.replace(
    'import { readFileSync } from "node:fs";',
    'import { appendFileSync, readFileSync } from "node:fs";',
  );
  const reviewedSnapshotBytes = readFileSync(snapshotPath);
  if (validatorWithWriteImport === canonicalValidatorSource
    || !canonicalValidatorSource.includes(stableReadMarker)) {
    fail("proof regression could not install the final stable-reread fixture");
  } else {
    writeFileSync(
      validatorPath,
      validatorWithWriteImport.replace(stableReadMarker, injectedStableRead),
      "utf8",
    );
    try {
      const lateSwapValidation = runValidator();
      const lateSwapOutput = `${lateSwapValidation.stdout}\n${lateSwapValidation.stderr}`;
      if (lateSwapValidation.error || lateSwapValidation.status === 0) {
        fail("proof validator accepted a release snapshot changed after its digest check");
      } else if (!lateSwapOutput.includes(
        "proof validation input changed during validation: launch/release-snapshot.generated.json",
      )) {
        fail("proof validator did not report the final stable-reread violation");
      } else if (lateSwapOutput.includes("Pre-publication packet proof is internally consistent.")) {
        fail("proof validator reported success after the final stable-reread violation");
      } else {
        console.log("OK: proof validator rejects a dependency changed after its digest check");
      }
    } finally {
      writeFileSync(validatorPath, canonicalValidatorSource, "utf8");
      writeFileSync(snapshotPath, reviewedSnapshotBytes);
    }
  }

  const priorProof = readFileSync(proofPath, "utf8");
  // The proof is intentionally historical: after the READY packet is sealed,
  // the manifest and publication payload may advance to their public states.
  // Their pre-publication digests remain bound inside the unchanged packet.
  writeFileSync(
    join(sandboxRoot, artifactPaths.manifestSha256),
    "published manifest bytes that intentionally differ from the sealed input\n",
    "utf8",
  );
  writeFileSync(
    join(sandboxRoot, artifactPaths.publicationPayloadSha256),
    "verified publication payload bytes that intentionally differ from the sealed input\n",
    "utf8",
  );
  const postPublicationValidation = runValidator();
  if (postPublicationValidation.error || postPublicationValidation.status !== 0) {
    fail(`proof validator rejected allowed post-publication source transitions: ${postPublicationValidation.stderr.trim()}`);
  } else {
    console.log("OK: sealed proof remains valid after public source artifacts advance");
  }

  writeFileSync(snapshotPath, Buffer.concat([reviewedSnapshotBytes, Buffer.from("tampered after seal\n")]));
  const tamperedSnapshotValidation = runValidator();
  const tamperedSnapshotOutput = `${tamperedSnapshotValidation.stdout}\n${tamperedSnapshotValidation.stderr}`;
  if (tamperedSnapshotValidation.error || tamperedSnapshotValidation.status === 0) {
    fail("proof validator accepted post-seal release-snapshot tampering");
  } else if (!tamperedSnapshotOutput.includes("proof releaseSnapshotSha256 does not match the canonical release-snapshot bytes")) {
    fail("proof validator did not identify post-seal release-snapshot tampering");
  } else {
    console.log("OK: proof validator rejects post-seal release-snapshot tampering");
  }
  writeFileSync(snapshotPath, reviewedSnapshotBytes);

  // Signer, rehearsal, and handoff records are immutable ceremony inputs.
  // Unlike the manifest and publication payload, they must remain byte-for-byte
  // identical after publication so the historical READY packet cannot be
  // detached from the review that produced it.
  for (const field of [
    "signingChecklistSha256",
    "devnetRehearsalSha256",
    "mainnetHandoffSha256",
  ]) {
    const artifactPath = join(sandboxRoot, artifactPaths[field]);
    const reviewedBytes = readFileSync(artifactPath);
    writeFileSync(artifactPath, Buffer.concat([reviewedBytes, Buffer.from("tampered after seal\n")]));
    const tamperedArtifactValidation = runValidator();
    const tamperedArtifactOutput = `${tamperedArtifactValidation.stdout}\n${tamperedArtifactValidation.stderr}`;
    if (tamperedArtifactValidation.error || tamperedArtifactValidation.status === 0) {
      fail(`proof validator accepted post-seal tampering of ${artifactPaths[field]}`);
    } else if (!tamperedArtifactOutput.includes(`proof ${field} no longer matches ${artifactPaths[field]}`)) {
      fail(`proof validator did not identify post-seal tampering of ${artifactPaths[field]}`);
    } else {
      console.log(`OK: proof validator rejects post-seal tampering of ${artifactPaths[field]}`);
    }
    writeFileSync(artifactPath, reviewedBytes);
  }

  packet.status = "HOLD";
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  const holdGeneration = runGenerator();
  const holdOutput = `${holdGeneration.stdout}\n${holdGeneration.stderr}`;
  if (holdGeneration.error || holdGeneration.status === 0) {
    fail("proof generator accepted a HOLD release packet");
  } else if (!holdOutput.includes("canonical READY release-packet validation did not pass")) {
    fail("proof generator did not report failed READY validation for a HOLD packet");
  } else if (readFileSync(proofPath, "utf8") !== priorProof) {
    fail("proof generator replaced the prior proof after HOLD validation failed");
  } else {
    console.log("OK: HOLD refusal preserves the prior sealed proof");
  }

  packet.status = "READY";
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  const tamperedPacketText = `${readFileSync(packetPath, "utf8")}\n`;
  writeFileSync(packetPath, tamperedPacketText, "utf8");
  const tamperedValidation = runValidator();
  const tamperedOutput = `${tamperedValidation.stdout}\n${tamperedValidation.stderr}`;
  if (tamperedValidation.error || tamperedValidation.status === 0) {
    fail("proof validator accepted release-packet byte tampering");
  } else if (!tamperedOutput.includes("proof releasePacketSha256 does not match the canonical release-packet bytes")) {
    fail("proof validator did not report release-packet byte tampering");
  } else {
    console.log("OK: proof validator rejects any post-seal release-packet byte change");
  }
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nPre-publication packet proof regression failed.");
else console.log("\nPre-publication packet proof regression passes.");

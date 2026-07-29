#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-release-snapshot-"));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });
  cpSync(join(repositoryRoot, "public"), join(sandboxRoot, "public"), { recursive: true });
  cpSync(join(repositoryRoot, "app", "mint"), join(sandboxRoot, "app", "mint"), { recursive: true });
  cpSync(join(repositoryRoot, "pnpm-lock.yaml"), join(sandboxRoot, "pnpm-lock.yaml"));
  symlinkSync(join(repositoryRoot, "node_modules"), join(sandboxRoot, "node_modules"), "junction");

  const create = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "create-release-snapshot.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  if (create.error || create.status !== 0) fail("could not create a fresh release snapshot fixture");

  const snapshotPath = join(sandboxRoot, "launch", "release-snapshot.generated.json");
  const baseline = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  if (baseline.error || baseline.status !== 0) fail("release snapshot validator rejected a fresh canonical inventory");

  const baselineSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const baselineSnapshotText = readFileSync(snapshotPath, "utf8");
  const publicationPayloadPath = join(sandboxRoot, "launch", "PUBLICATION_PAYLOAD.template.md");
  const canonicalPublicationPayload = readFileSync(publicationPayloadPath, "utf8");

  // Full validation must bind every stored digest to the current artifact
  // bytes. Pre-approval validation intentionally binds only the three inputs
  // that remain immutable while the handoff, packet, and payload advance.
  writeFileSync(publicationPayloadPath, `${canonicalPublicationPayload}\n`, "utf8");
  try {
    const payloadValidation = spawnSync(process.execPath, [
      join(sandboxRoot, "scripts", "validate-publication-payload.mjs"),
    ], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    if (payloadValidation.error || payloadValidation.status !== 0) {
      fail("release snapshot stale-digest fixture made the publication payload semantically invalid");
    }

    const fullValidation = spawnSync(process.execPath, [
      join(sandboxRoot, "scripts", "validate-release-snapshot.mjs"),
    ], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    const fullOutput = `${fullValidation.stdout}\n${fullValidation.stderr}`;
    if (fullValidation.error || fullValidation.status === 0) {
      fail("full release snapshot validation accepted a stale publication-payload digest");
    } else if (!fullOutput.includes("snapshot artifact digest does not match launch/PUBLICATION_PAYLOAD.template.md")) {
      fail("full release snapshot validation did not report the stale publication-payload digest");
    } else {
      console.log("OK: full release snapshot validation rejects a stale publication-payload digest");
    }

    const preApprovalValidation = spawnSync(process.execPath, [
      join(sandboxRoot, "scripts", "validate-release-snapshot.mjs"),
      "launch/release-snapshot.generated.json",
      "pre-approval",
    ], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    if (preApprovalValidation.error || preApprovalValidation.status !== 0) {
      fail("pre-approval snapshot validation rejected an allowed post-snapshot payload change");
    } else {
      console.log("OK: pre-approval snapshot validation retains its three-artifact boundary");
    }
  } finally {
    writeFileSync(publicationPayloadPath, canonicalPublicationPayload, "utf8");
  }

  const substitutedSnapshotPath = join(sandboxRoot, "launch", "substituted-release-snapshot.json");
  writeFileSync(substitutedSnapshotPath, baselineSnapshotText, "utf8");
  const substitutedSnapshotValidation = spawnSync(process.execPath, [
    join(sandboxRoot, "scripts", "validate-release-snapshot.mjs"),
    "launch/substituted-release-snapshot.json",
  ], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const substitutedSnapshotOutput = `${substitutedSnapshotValidation.stdout}\n${substitutedSnapshotValidation.stderr}`;
  if (substitutedSnapshotValidation.error || substitutedSnapshotValidation.status === 0) {
    fail("release snapshot validator accepted a substituted snapshot path");
  } else if (!substitutedSnapshotOutput.includes("snapshot path must be launch/release-snapshot.generated.json")) {
    fail("release snapshot validator did not report a substituted snapshot path");
  } else {
    console.log("OK: release snapshot validator rejects a substituted snapshot path");
  }
  const assertSnapshotGenerationRejectsInvalidDependency = (label, artifactPath, mutate) => {
    const dependencyPath = join(sandboxRoot, artifactPath);
    const original = readFileSync(dependencyPath, "utf8");
    const dependency = JSON.parse(original);
    mutate(dependency);
    writeFileSync(dependencyPath, `${JSON.stringify(dependency, null, 2)}\n`, "utf8");

    try {
      const generation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "create-release-snapshot.mjs")], {
        cwd: sandboxRoot,
        encoding: "utf8",
      });
      const output = `${generation.stdout}\n${generation.stderr}`;
      if (generation.error || generation.status === 0) {
        fail(`release snapshot generator accepted a malformed canonical ${label}`);
      } else if (!output.includes(`canonical ${label} validator did not pass`)) {
        fail(`release snapshot generator did not report the malformed canonical ${label} dependency`);
      } else if (readFileSync(snapshotPath, "utf8") !== baselineSnapshotText) {
        fail(`release snapshot generator replaced the prior snapshot after a malformed canonical ${label}`);
      } else {
        console.log(`OK: release snapshot generator rejects malformed canonical ${label} without replacing the prior snapshot`);
      }
    } finally {
      writeFileSync(dependencyPath, original, "utf8");
    }
  };

  assertSnapshotGenerationRejectsInvalidDependency("manifest", "launch/genesis-manifest.template.json", (manifest) => {
    manifest.token.decimals = 8;
  });
  assertSnapshotGenerationRejectsInvalidDependency("signer checklist", "launch/genesis-signing-checklist.template.json", (checklist) => {
    checklist.network = "devnet";
  });
  assertSnapshotGenerationRejectsInvalidDependency("devnet rehearsal", "launch/devnet-rehearsal.template.json", (rehearsal) => {
    rehearsal.token.decimals = 8;
  });
  assertSnapshotGenerationRejectsInvalidDependency("mainnet handoff", "launch/mainnet-handoff.template.json", (handoff) => {
    handoff.network = "devnet";
  });
  assertSnapshotGenerationRejectsInvalidDependency("release packet", "launch/release-packet.template.json", (packet) => {
    packet.packetScope = "Release packet fixture with an invalid safety boundary.";
  });
  writeFileSync(publicationPayloadPath, `${canonicalPublicationPayload}\nSecret key: prohibited fixture\n`, "utf8");
  try {
    const generation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "create-release-snapshot.mjs")], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    const output = `${generation.stdout}\n${generation.stderr}`;
    if (generation.error || generation.status === 0) {
      fail("release snapshot generator accepted a malformed canonical publication payload");
    } else if (!output.includes("canonical publication payload validator did not pass")) {
      fail("release snapshot generator did not report the malformed canonical publication payload dependency");
    } else if (readFileSync(snapshotPath, "utf8") !== baselineSnapshotText) {
      fail("release snapshot generator replaced the prior snapshot after a malformed canonical publication payload");
    } else {
      console.log("OK: release snapshot generator rejects malformed canonical publication payload without replacing the prior snapshot");
    }
  } finally {
    writeFileSync(publicationPayloadPath, canonicalPublicationPayload, "utf8");
  }

  // Simulate an edit that lands after the publication payload validator has
  // finished. The generator must refuse to turn that unreviewed content into a
  // fresh snapshot, even though its subsequent reads are internally stable.
  const releasePacketValidatorPath = join(sandboxRoot, "scripts", "validate-release-packet.mjs");
  const canonicalReleasePacketValidator = readFileSync(releasePacketValidatorPath, "utf8");
  writeFileSync(releasePacketValidatorPath, `${canonicalReleasePacketValidator}\nimport { writeFileSync } from \"node:fs\";\nwriteFileSync(\"launch/PUBLICATION_PAYLOAD.template.md\", readFileSync(\"launch/PUBLICATION_PAYLOAD.template.md\", \"utf8\") + \"\\nValidator-race fixture.\\n\", \"utf8\");\n`, "utf8");
  try {
    const generation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "create-release-snapshot.mjs")], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    const output = `${generation.stdout}\n${generation.stderr}`;
    if (generation.error || generation.status === 0) {
      fail("release snapshot generator accepted an artifact changed after its validator completed");
    } else if (!output.includes("Release artifacts changed while canonical validators were running")) {
      fail("release snapshot generator did not report an artifact changed during canonical validation");
    } else if (readFileSync(snapshotPath, "utf8") !== baselineSnapshotText) {
      fail("release snapshot generator replaced the prior snapshot after an artifact changed during canonical validation");
    } else {
      console.log("OK: release snapshot generator rejects an artifact changed after its validator completed");
    }
  } finally {
    writeFileSync(releasePacketValidatorPath, canonicalReleasePacketValidator, "utf8");
    writeFileSync(publicationPayloadPath, canonicalPublicationPayload, "utf8");
  }

  // A late edit can land after every validator and pre-write read has passed.
  // The final pre-rename guard must preserve the prior snapshot in that case.
  const generatorPath = join(sandboxRoot, "scripts", "create-release-snapshot.mjs");
  const canonicalGenerator = readFileSync(generatorPath, "utf8");
  const publishWrite = 'writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\\n`);';
  const publishRace = `${publishWrite}\n  writeFileSync("launch/PUBLICATION_PAYLOAD.template.md", readFileSync("launch/PUBLICATION_PAYLOAD.template.md", "utf8") + "\\nPublish-race fixture.\\n", "utf8");`;
  if (!canonicalGenerator.includes(publishWrite)) {
    fail("release snapshot regression could not install the publish-race fixture");
  } else {
    writeFileSync(generatorPath, canonicalGenerator.replace(publishWrite, publishRace), "utf8");
    try {
      const generation = spawnSync(process.execPath, [generatorPath], {
        cwd: sandboxRoot,
        encoding: "utf8",
      });
      const output = `${generation.stdout}\n${generation.stderr}`;
      if (generation.error || generation.status === 0) {
        fail("release snapshot generator accepted an artifact changed during snapshot publication");
      } else if (!output.includes("Release artifacts changed while the snapshot was being published")) {
        fail("release snapshot generator did not report an artifact changed during snapshot publication");
      } else if (readFileSync(snapshotPath, "utf8") !== baselineSnapshotText) {
        fail("release snapshot generator replaced the prior snapshot after an artifact changed during snapshot publication");
      } else {
        console.log("OK: release snapshot generator rejects an artifact changed during snapshot publication");
      }
    } finally {
      writeFileSync(generatorPath, canonicalGenerator, "utf8");
      writeFileSync(publicationPayloadPath, canonicalPublicationPayload, "utf8");
    }
  }

  const assertSnapshotRejectsInvalidRecord = (label, mutate, expectedMessage) => {
    const invalidSnapshot = JSON.parse(JSON.stringify(baselineSnapshot));
    mutate(invalidSnapshot);
    writeFileSync(snapshotPath, `${JSON.stringify(invalidSnapshot, null, 2)}\n`, "utf8");

    const validation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    const output = `${validation.stdout}\n${validation.stderr}`;
    if (validation.error || validation.status === 0) {
      fail(`release snapshot validator accepted a ${label} record`);
    } else if (!output.includes(expectedMessage)) {
      fail(`release snapshot validator did not report the ${label} record`);
    } else {
      console.log(`OK: release snapshot validator rejects a ${label} record`);
    }
  };

  assertSnapshotRejectsInvalidRecord(
    "free-form",
    (snapshot) => { snapshot.operatorNote = "approved by chat"; },
    "snapshot must contain only its canonical reviewed fields",
  );
  assertSnapshotRejectsInvalidRecord(
    "non-canonical timestamp",
    (snapshot) => { snapshot.generatedAtUtc = "2026-07-28T20:00:00+03:00"; },
    "snapshot requires a canonical ISO-8601 UTC generatedAtUtc timestamp ending in Z",
  );
  assertSnapshotRejectsInvalidRecord(
    "uppercase artifact digest",
    (snapshot) => {
      const handoffPath = "launch/mainnet-handoff.template.json";
      snapshot.artifacts[handoffPath] = snapshot.artifacts[handoffPath].toUpperCase();
      snapshot.packetDigest = createHash("sha256")
        .update(Object.entries(snapshot.artifacts).map(([path, digest]) => `${path}:${digest}`).join("\n"))
        .digest("hex");
    },
    "snapshot artifacts requires a lowercase SHA-256 digest for launch/mainnet-handoff.template.json",
  );

  const assertSnapshotRejectsInvalidDependency = (label, artifactPath, mutate) => {
    const dependencyPath = join(sandboxRoot, artifactPath);
    const original = readFileSync(dependencyPath, "utf8");
    const dependency = JSON.parse(original);
    mutate(dependency);
    writeFileSync(dependencyPath, `${JSON.stringify(dependency, null, 2)}\n`, "utf8");

    try {
      const validation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
        cwd: sandboxRoot,
        encoding: "utf8",
      });
      const output = `${validation.stdout}\n${validation.stderr}`;
      if (validation.error || validation.status === 0) {
        fail(`release snapshot validator accepted a malformed canonical ${label}`);
      } else if (!output.includes(`snapshot requires the canonical ${label} validator to pass`)) {
        fail(`release snapshot validator did not report the malformed canonical ${label} dependency`);
      } else {
        console.log(`OK: release snapshot validator requires a valid canonical ${label}`);
      }
    } finally {
      writeFileSync(dependencyPath, original, "utf8");
    }
  };

  assertSnapshotRejectsInvalidDependency("manifest", "launch/genesis-manifest.template.json", (manifest) => {
    manifest.token.decimals = 8;
  });
  assertSnapshotRejectsInvalidDependency("signer checklist", "launch/genesis-signing-checklist.template.json", (checklist) => {
    checklist.network = "devnet";
  });
  assertSnapshotRejectsInvalidDependency("devnet rehearsal", "launch/devnet-rehearsal.template.json", (rehearsal) => {
    rehearsal.token.decimals = 8;
  });
  assertSnapshotRejectsInvalidDependency("mainnet handoff", "launch/mainnet-handoff.template.json", (handoff) => {
    handoff.network = "devnet";
  });
  assertSnapshotRejectsInvalidDependency("release packet", "launch/release-packet.template.json", (packet) => {
    packet.packetScope = "Release packet fixture with an invalid safety boundary.";
  });

  const canonicalPayloadForValidation = readFileSync(publicationPayloadPath, "utf8");
  writeFileSync(publicationPayloadPath, `${canonicalPayloadForValidation}\nSecret key: prohibited fixture\n`, "utf8");
  try {
    const validation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    const output = `${validation.stdout}\n${validation.stderr}`;
    if (validation.error || validation.status === 0) {
      fail("release snapshot validator accepted a malformed canonical publication payload");
    } else if (!output.includes("snapshot requires the canonical publication payload validator to pass")) {
      fail("release snapshot validator did not report the malformed canonical publication payload dependency");
    } else {
      console.log("OK: release snapshot validator requires a valid canonical publication payload");
    }
  } finally {
    writeFileSync(publicationPayloadPath, canonicalPayloadForValidation, "utf8");
  }

  const assertSnapshotRejectsInvalidTimestamp = (label, generatedAtUtc, expectedMessage) => {
    const timestampSnapshot = JSON.parse(JSON.stringify(baselineSnapshot));
    timestampSnapshot.generatedAtUtc = generatedAtUtc;
    writeFileSync(snapshotPath, `${JSON.stringify(timestampSnapshot, null, 2)}\n`, "utf8");

    const validation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
      cwd: sandboxRoot,
      encoding: "utf8",
    });
    const output = `${validation.stdout}\n${validation.stderr}`;
    if (validation.error || validation.status === 0) {
      fail(`release snapshot validator accepted a ${label} timestamp`);
    } else if (!output.includes(expectedMessage)) {
      fail(`release snapshot validator did not report the ${label} timestamp`);
    } else {
      console.log(`OK: release snapshot validator rejects a ${label} timestamp`);
    }
  };

  assertSnapshotRejectsInvalidTimestamp(
    "stale",
    new Date(Date.now() - (31 * 60 * 1000)).toISOString(),
    "snapshot is older than 30 minutes",
  );
  assertSnapshotRejectsInvalidTimestamp(
    "future",
    new Date(Date.now() + (2 * 60 * 1000)).toISOString(),
    "snapshot generatedAtUtc cannot be more than one minute in the future",
  );

  const snapshot = JSON.parse(JSON.stringify(baselineSnapshot));
  snapshot.artifacts = Object.fromEntries(Object.entries(snapshot.artifacts).reverse());
  snapshot.packetDigest = createHash("sha256")
    .update(Object.entries(snapshot.artifacts).map(([path, digest]) => `${path}:${digest}`).join("\n"))
    .digest("hex");
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  const validation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const output = `${validation.stdout}\n${validation.stderr}`;
  if (validation.error || validation.status === 0) {
    fail("release snapshot validator accepted a reordered artifact inventory");
  } else if (!output.includes("snapshot artifacts must retain the canonical artifact order")) {
    fail("release snapshot validator did not report reordered artifact inventory");
  } else {
    console.log("OK: release snapshot validator rejects reordered artifact inventory");
  }

  writeFileSync(snapshotPath, `${JSON.stringify(baselineSnapshot, null, 2)}\n`, "utf8");
  const preApprovalSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  preApprovalSnapshot.preApprovalArtifacts = Object.fromEntries(
    Object.entries(preApprovalSnapshot.preApprovalArtifacts).reverse(),
  );
  preApprovalSnapshot.preApprovalPacketDigest = createHash("sha256")
    .update(Object.entries(preApprovalSnapshot.preApprovalArtifacts).map(([path, digest]) => `${path}:${digest}`).join("\n"))
    .digest("hex");
  writeFileSync(snapshotPath, `${JSON.stringify(preApprovalSnapshot, null, 2)}\n`, "utf8");

  const preApprovalValidation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const preApprovalOutput = `${preApprovalValidation.stdout}\n${preApprovalValidation.stderr}`;
  if (preApprovalValidation.error || preApprovalValidation.status === 0) {
    fail("release snapshot validator accepted a reordered pre-approval inventory");
  } else if (!preApprovalOutput.includes("snapshot pre-approval artifacts must retain the canonical packet-digest order")) {
    fail("release snapshot validator did not report reordered pre-approval inventory");
  } else {
    console.log("OK: release snapshot validator rejects reordered pre-approval inventory");
  }

  writeFileSync(snapshotPath, `${JSON.stringify(baselineSnapshot, null, 2)}\n`, "utf8");
  const divergentSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const manifestPath = "launch/genesis-manifest.template.json";
  divergentSnapshot.artifacts[manifestPath] = "0".repeat(64);
  divergentSnapshot.packetDigest = createHash("sha256")
    .update(Object.entries(divergentSnapshot.artifacts).map(([path, digest]) => `${path}:${digest}`).join("\n"))
    .digest("hex");
  writeFileSync(snapshotPath, `${JSON.stringify(divergentSnapshot, null, 2)}\n`, "utf8");

  const divergentValidation = spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-release-snapshot.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const divergentOutput = `${divergentValidation.stdout}\n${divergentValidation.stderr}`;
  if (divergentValidation.error || divergentValidation.status === 0) {
    fail("release snapshot validator accepted divergent pre-approval and full-inventory digests");
  } else if (!divergentOutput.includes("snapshot pre-approval digest must match the full artifact inventory")) {
    fail("release snapshot validator did not report a divergent pre-approval and full-inventory digest");
  } else {
    console.log("OK: release snapshot validator rejects divergent pre-approval and full-inventory digests");
  }
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nRelease snapshot regression failed.");
else console.log("\nRelease snapshot regression passes.");

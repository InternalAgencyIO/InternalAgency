#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-canonical-digest-"));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const assertRejected = (script, expectedMessage, label) => {
  const result = spawnSync(process.execPath, [join(sandboxRoot, "scripts", script)], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.error || result.status === 0) fail(`${script} accepted ${label}`);
  else if (!output.includes(expectedMessage)) fail(`${script} did not report ${label}`);
  else console.log(`OK: ${script} rejects ${label}`);
};

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });
  cpSync(join(repositoryRoot, "public"), join(sandboxRoot, "public"), { recursive: true });
  cpSync(join(repositoryRoot, "app", "mint"), join(sandboxRoot, "app", "mint"), { recursive: true });
  cpSync(join(repositoryRoot, "package-lock.json"), join(sandboxRoot, "package-lock.json"));
  symlinkSync(join(repositoryRoot, "node_modules"), join(sandboxRoot, "node_modules"), "junction");

  const handoffPath = join(sandboxRoot, "launch", "mainnet-handoff.template.json");
  const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  handoff.status = "READY";
  handoff.automatedClosure.manifestDigest = "A".repeat(64);
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-mainnet-handoff.mjs",
    "READY requires a lowercase SHA-256 automatedClosure.manifestDigest",
    "an uppercase mainnet-handoff digest",
  );

  const packetPath = join(sandboxRoot, "launch", "release-packet.template.json");
  const packet = JSON.parse(readFileSync(packetPath, "utf8"));
  packet.status = "READY";
  packet.automatedClosure.packetDigest = "A".repeat(64);
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-release-packet.mjs",
    "READY requires a lowercase SHA-256 packetDigest",
    "an uppercase release-packet digest",
  );

  const canonicalHandoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  canonicalHandoff.status = "READY";
  canonicalHandoff.automatedClosure.manifestSha256 = sha256File(join(sandboxRoot, "launch", "genesis-manifest.template.json"));
  canonicalHandoff.automatedClosure.signingChecklistSha256 = sha256File(join(sandboxRoot, "launch", "genesis-signing-checklist.template.json"));
  canonicalHandoff.automatedClosure.devnetRehearsalSha256 = sha256File(join(sandboxRoot, "launch", "devnet-rehearsal.template.json"));
  canonicalHandoff.automatedClosure.manifestDigest = canonicalHandoff.automatedClosure.manifestSha256;
  canonicalHandoff.automatedClosure.destinationDigest = createHash("sha256").update(JSON.stringify({
    handoffVersion: canonicalHandoff.handoffVersion,
    network: canonicalHandoff.network,
    artifactDigests: {
      manifestSha256: canonicalHandoff.automatedClosure.manifestSha256,
      signingChecklistSha256: canonicalHandoff.automatedClosure.signingChecklistSha256,
      devnetRehearsalSha256: canonicalHandoff.automatedClosure.devnetRehearsalSha256,
    },
  })).digest("hex").toUpperCase();
  writeFileSync(handoffPath, `${JSON.stringify(canonicalHandoff, null, 2)}\n`, "utf8");

  const readyPacket = JSON.parse(readFileSync(packetPath, "utf8"));
  readyPacket.status = "READY";
  writeFileSync(packetPath, `${JSON.stringify(readyPacket, null, 2)}\n`, "utf8");
  assertRejected(
    "validate-release-packet.mjs",
    "READY requires a lowercase SHA-256 handoff.automatedClosure.destinationDigest",
    "an uppercase handoff destination digest during READY packet review",
  );
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nCanonical digest regression failed.");
else console.log("\nCanonical digest regression passes.");

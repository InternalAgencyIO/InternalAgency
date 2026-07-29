import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const files = [
  "launch/genesis-manifest.template.json",
  "launch/genesis-signing-checklist.template.json",
  "launch/devnet-rehearsal.template.json",
  "launch/mainnet-handoff.template.json",
  "launch/release-packet.template.json",
  "launch/PUBLICATION_PAYLOAD.template.md",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readArtifacts = () => Object.fromEntries(files.map((file) => [file, sha256(readFileSync(file))]));
const sameArtifactSet = (left, right) => files.every((file) => left[file] === right[file]);
const canonicalDependencyValidators = [
  ["manifest", "launch/genesis-manifest.template.json", "./validate-genesis-manifest.mjs"],
  ["publication payload", "launch/PUBLICATION_PAYLOAD.template.md", "./validate-publication-payload.mjs"],
  ["signer checklist", "launch/genesis-signing-checklist.template.json", "./validate-genesis-signing-checklist.mjs"],
  ["devnet rehearsal", "launch/devnet-rehearsal.template.json", "./validate-devnet-rehearsal.mjs"],
  ["mainnet handoff", "launch/mainnet-handoff.template.json", "./validate-mainnet-handoff.mjs"],
  ["release packet", "launch/release-packet.template.json", "./validate-release-packet.mjs"],
];

// Bind the reviewed input set before launching validators. A source can change
// after its own validator finishes, so validating only then reading would let a
// snapshot attest to an unreviewed edit.
const preValidationArtifacts = readArtifacts();

// Never mint a new review artifact from an invalid recorded input. This makes
// the generator safe to run directly, rather than relying on callers to
// remember a separate validation command before creating a snapshot.
for (const [label, artifactPath, relativeValidatorPath] of canonicalDependencyValidators) {
  const validatorPath = fileURLToPath(new URL(relativeValidatorPath, import.meta.url));
  const validation = spawnSync(process.execPath, [validatorPath, artifactPath], { encoding: "utf8" });
  if (validation.error || validation.status !== 0) {
    throw new Error(`Cannot create release snapshot: canonical ${label} validator did not pass. Correct the source artifact and remain on HOLD.`);
  }
}
const artifacts = readArtifacts();
if (!sameArtifactSet(preValidationArtifacts, artifacts)) {
  throw new Error("Release artifacts changed while canonical validators were running; retry from HOLD after edits stop.");
}
// A handoff snapshot must describe one coherent read set. Re-read every input
// before publishing it so an edit that lands during generation cannot produce
// a mixed inventory that looks like a reviewed release record.
if (!sameArtifactSet(artifacts, readArtifacts())) {
  throw new Error("Release artifacts changed while the snapshot was being generated; retry from HOLD after edits stop.");
}
const packetDigest = sha256(Object.entries(artifacts).map(([file, digest]) => `${file}:${digest}`).join("\n"));
const preApprovalFiles = files.slice(0, 3);
const preApprovalArtifacts = Object.fromEntries(preApprovalFiles.map((file) => [file, artifacts[file]]));
const preApprovalPacketDigest = sha256(Object.entries(preApprovalArtifacts).map(([file, digest]) => `${file}:${digest}`).join("\n"));
const snapshot = {
  version: 1,
  status: "HOLD",
  generatedAtUtc: new Date().toISOString(),
  packetDigest,
  artifacts,
  preApprovalPacketDigest,
  preApprovalArtifacts,
};

const outputPath = "launch/release-snapshot.generated.json";
const temporaryPath = `${outputPath}.tmp`;
try {
  // Publish only a complete JSON record. Readers see either the previous
  // snapshot or this fully written one, never a partially written handoff aid.
  writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  // The temporary record can take a nonzero amount of time to serialize and
  // write. Check the inputs once more immediately before replacement so a
  // late edit cannot make this snapshot look like it froze a stable ceremony.
  if (!sameArtifactSet(artifacts, readArtifacts())) {
    throw new Error("Release artifacts changed while the snapshot was being published; retry from HOLD after edits stop.");
  }
  renameSync(temporaryPath, outputPath);
} catch (error) {
  try { unlinkSync(temporaryPath); } catch { /* no temporary file to remove */ }
  throw error;
}
console.log(`Release snapshot created: ${packetDigest}`);

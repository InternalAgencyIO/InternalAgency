import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "launch/genesis-manifest.template.json",
  "launch/genesis-signing-checklist.template.json",
  "launch/devnet-rehearsal.template.json",
  "launch/mainnet-handoff.template.json",
  "launch/release-packet.template.json",
  "launch/PUBLICATION_PAYLOAD.template.md",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const artifacts = Object.fromEntries(files.map((file) => [file, sha256(readFileSync(file))]));
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
  note: "Snapshot only. It does not authorize a transaction, publication, or launch claim.",
};

writeFileSync("launch/release-snapshot.generated.json", `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Release snapshot created: ${packetDigest}`);

import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const requestPath = join(here, "IAT-B3-DEVNET-HW-UNSIGNED-20260825.json");
const proofPath = join(here, "IAT-B3-DEVNET-HW-PROOF-20260825.json");
const requestBytes = readFileSync(requestPath);
const request = JSON.parse(requestBytes);
const proof = JSON.parse(readFileSync(proofPath));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(sha256(requestBytes) === proof.requestArtifact.sha256, "request artifact SHA-256 mismatch");
assert(requestBytes.length === proof.requestArtifact.byteLength, "request artifact byte length mismatch");

const sourceSetBytes = Buffer.from(
  request.sourceRows.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).join(""),
  "utf8",
);
assert(sha256(sourceSetBytes) === request.subject.sourceSetSha256, "source-set SHA-256 mismatch");

const subjectBytes = Buffer.from(`${JSON.stringify(request.subject)}\n`, "utf8");
const subjectDomain = Buffer.from("IAT_B3_DEVNET_PHYSICAL_REHEARSAL_SUBJECT_V1\0", "ascii");
const subjectSha256 = sha256(Buffer.concat([subjectDomain, subjectBytes]));
assert(subjectBytes.length === request.subjectByteLength, "subject byte length mismatch");
assert(subjectSha256 === request.subjectSha256, "subject SHA-256 mismatch");
assert(subjectSha256 === proof.subject.subjectSha256, "proof subject SHA-256 mismatch");

const body = Buffer.from(`IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:${subjectSha256}`, "ascii");
assert(body.length === 100, "hardware message must be exactly 100 bytes");
assert(body.toString("ascii") === request.hardwareMessageAscii, "hardware message mismatch");
assert(sha256(body) === request.messageBodySha256, "hardware message SHA-256 mismatch");

const publicKey = Buffer.from(request.subject.signerPublicKeyHex, "hex");
const serialized = Buffer.concat([
  Buffer.from("ff736f6c616e61206f6666636861696e0101", "hex"),
  publicKey,
  body,
]);
assert(serialized.toString("hex") === proof.ocmsV1.serializedHex, "OCMS-v1 serialized bytes mismatch");
assert(serialized.length === proof.ocmsV1.byteLength, "OCMS-v1 byte length mismatch");
assert(sha256(serialized) === proof.ocmsV1.sha256, "OCMS-v1 SHA-256 mismatch");

const signature = Buffer.from(proof.signature.hex, "hex");
const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), publicKey]);
const key = createPublicKey({ key: spki, format: "der", type: "spki" });
assert(signature.length === 64, "signature must be exactly 64 bytes");
assert(sha256(signature) === proof.signature.sha256, "signature SHA-256 mismatch");
assert(verify(null, serialized, key, signature), "Ed25519 signature verification failed");
const tampered = Buffer.from(serialized);
tampered[tampered.length - 1] ^= 1;
assert(!verify(null, tampered, key, signature), "tampered message was not rejected");

if (process.argv[2]) {
  const sourceRoot = resolve(process.argv[2]);
  for (const row of request.sourceRows) {
    assert(sha256(readFileSync(join(sourceRoot, row.path))) === row.sha256, `source drift: ${row.path}`);
  }
}

console.log(JSON.stringify({
  result: "PASS",
  attemptId: proof.attemptId,
  subjectSha256,
  signedDataSha256: sha256(serialized),
  signatureSha256: sha256(signature),
  sourceSetSha256: sha256(sourceSetBytes),
  tamperedRejected: true,
}, null, 2));

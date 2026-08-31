#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-signing-checklist-"));
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
const address = (seed) => encodeBase58(Buffer.alloc(32, seed));
const credentialShapedKeypair = (seed) => encodeBase58(Buffer.alloc(64, seed));
const sha256File = (filePath) => createHash("sha256").update(readFileSync(filePath)).digest("hex");

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });

  const checklistPath = join(sandboxRoot, "launch", "genesis-signing-checklist.template.json");
  const manifestPath = join(sandboxRoot, "launch", "genesis-manifest.template.json");
  const runValidator = () => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-genesis-signing-checklist.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const runValidatorAt = (path) => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-genesis-signing-checklist.mjs"), path], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const assertValid = (label) => {
    const result = runValidator();
    if (result.error || result.status !== 0) fail(`signing checklist validator rejected ${label}`);
    else console.log(`OK: signing checklist validator accepts ${label}`);
  };
  const assertRejected = (label, mutate, expectedMessage, unexpectedMessage) => {
    const fixture = JSON.parse(readFileSync(checklistPath, "utf8"));
    mutate(fixture);
    writeFileSync(checklistPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`signing checklist validator accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`signing checklist validator did not report ${label}`);
    else if (unexpectedMessage && output.includes(unexpectedMessage)) fail(`signing checklist validator followed the substituted path for ${label}`);
    else console.log(`OK: signing checklist validator rejects ${label}`);
  };

  assertValid("the canonical HOLD checklist");
  const hold = JSON.parse(readFileSync(checklistPath, "utf8"));
  const canonicalManifest = readFileSync(manifestPath, "utf8");
  const wrongNetworkManifest = JSON.parse(canonicalManifest);
  wrongNetworkManifest.network = "devnet";
  writeFileSync(manifestPath, `${JSON.stringify(wrongNetworkManifest, null, 2)}\n`, "utf8");
  const wrongNetworkValidation = runValidator();
  const wrongNetworkOutput = `${wrongNetworkValidation.stdout}\n${wrongNetworkValidation.stderr}`;
  if (wrongNetworkValidation.error || wrongNetworkValidation.status === 0) {
    fail("signing checklist validator accepted a canonical manifest with a mismatched network");
  } else if (!wrongNetworkOutput.includes("checklist network must match the canonical Genesis manifest")) {
    fail("signing checklist validator did not report the canonical manifest network mismatch");
  } else {
    console.log("OK: signing checklist validator rejects a canonical manifest with a mismatched network");
  }
  writeFileSync(manifestPath, canonicalManifest, "utf8");
  const substitutedChecklistPath = join(sandboxRoot, "launch", "review-copy.json");
  writeFileSync(substitutedChecklistPath, `${JSON.stringify(hold, null, 2)}\n`, "utf8");
  const substitutedPathValidation = runValidatorAt("launch/review-copy.json");
  const substitutedPathOutput = `${substitutedPathValidation.stdout}\n${substitutedPathValidation.stderr}`;
  if (substitutedPathValidation.error || substitutedPathValidation.status === 0) {
    fail("signing checklist validator accepted a substituted checklist path");
  } else if (!substitutedPathOutput.includes("checklist path must be launch/genesis-signing-checklist.template.json")) {
    fail("signing checklist validator did not report a substituted checklist path");
  } else {
    console.log("OK: signing checklist validator rejects a substituted checklist path");
  }
  assertRejected(
    "a credential-bearing field in HOLD",
    (fixture) => { fixture.participants.feePayerSigner.recoveryPhrase = "not a real credential"; },
    "canonical reviewed fields",
  );
  writeFileSync(checklistPath, `${JSON.stringify(hold, null, 2)}\n`, "utf8");
  assertRejected(
    "64-byte Base58 credential-shaped material in a signer address field",
    (fixture) => { fixture.participants.mintAuthoritySigner.publicAddress = credentialShapedKeypair(9); },
    "credential-bearing value at checklist.participants.mintAuthoritySigner.publicAddress",
  );
  writeFileSync(checklistPath, `${JSON.stringify(hold, null, 2)}\n`, "utf8");
  assertRejected(
    "a HOLD checklist with a stale signer address",
    (fixture) => { fixture.participants.mintAuthoritySigner.publicAddress = address(1); },
    "HOLD requires participants.mintAuthoritySigner.publicAddress to be null",
  );
  writeFileSync(checklistPath, `${JSON.stringify(hold, null, 2)}\n`, "utf8");
  assertRejected(
    "a HOLD checklist with an injected human reviewer",
    (fixture) => { fixture.participants.humanReviewer = { role: "VERIFIER" }; },
    "participants must contain only its canonical reviewed fields",
  );
  writeFileSync(checklistPath, `${JSON.stringify(hold, null, 2)}\n`, "utf8");
  assertRejected(
    "a HOLD checklist that drops required signer confirmation",
    (fixture) => { fixture.participants.feePayerSigner.physicalConfirmationRequired = false; },
    "checklist requires physical confirmation for feePayerSigner in every state",
  );
  writeFileSync(checklistPath, `${JSON.stringify(hold, null, 2)}\n`, "utf8");
  assertRejected(
    "a checklist that substitutes an unreadable manifest path",
    (fixture) => { fixture.manifestPath = "launch/unreviewed-manifest.json"; },
    "manifestPath must point to the canonical Genesis manifest",
  );
  writeFileSync(checklistPath, `${JSON.stringify(hold, null, 2)}\n`, "utf8");
  assertRejected(
    "a HOLD checklist with a stale recipient review",
    (fixture) => { fixture.ceremonyControls.reviewedRecipientDestinations.community.publicAddress = address(10); },
    "HOLD requires ceremonyControls.reviewedRecipientDestinations.community.publicAddress to be null",
  );
  assertRejected(
    "a HOLD checklist with a stale manifest binding",
    (fixture) => { fixture.ceremonyControls.manifestSha256 = "a".repeat(64); },
    "HOLD requires ceremonyControls.manifestSha256 to be null",
  );
  assertRejected(
    "a HOLD checklist with stale allocation math",
    (fixture) => { fixture.ceremonyControls.reviewedRecipientDestinations.community.expectedBaseUnitAmount = "1"; },
    "checklist expected base-unit amount must match the canonical manifest allocation for community",
  );

  const ready = JSON.parse(JSON.stringify(hold));
  ready.status = "READY";
  const participants = ["mintAuthoritySigner", "feePayerSigner"];
  for (const [index, participant] of participants.entries()) ready.participants[participant].publicAddress = address(index + 1);
  ready.participants.feePayerSigner.publicAddress = ready.participants.mintAuthoritySigner.publicAddress;
  ready.participants.mintAuthoritySigner.devicePathReviewed = true;
  ready.participants.feePayerSigner.devicePathReviewed = true;
  ready.ceremonyControls.recipientAddressesCheckedAgainstManifest = true;
  ready.ceremonyControls.signerAddressesCheckedAgainstManifest = true;
  ready.ceremonyControls.mainnetHoldObserved = true;
  for (const [index, allocation] of Object.keys(ready.ceremonyControls.reviewedRecipientDestinations).entries()) {
    ready.ceremonyControls.reviewedRecipientDestinations[allocation].publicAddress = address(index + 10);
  }
  ready.ceremonyControls.manifestSha256 = sha256File(manifestPath);
  ready.ceremonyControls.readyAtUtc = new Date().toISOString();
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertValid("a fresh READY checklist with one reviewed physical signer and automated observations");

  assertRejected(
    "a fee payer that differs from the reviewed mint-authority signer",
    (fixture) => { fixture.participants.feePayerSigner.publicAddress = address(2); },
    "READY requires mintAuthoritySigner and feePayerSigner to share one reviewed physical signing address",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a READY checklist that enables a human reviewer gate",
    (fixture) => { fixture.ceremonyControls.humanReviewerRequired = true; },
    "checklist must not require a human reviewer",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a READY checklist that permits self-attestation",
    (fixture) => { fixture.ceremonyControls.noSelfAttestation = false; },
    "checklist must reject self-attestation",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a READY checklist that demotes Model T physical confirmation from the sole human gate",
    (fixture) => { fixture.ceremonyControls.trezorModelTPhysicalConfirmationIsSoleHumanGate = false; },
    "Model T physical confirmation must be the sole human gate",
  );

  const malformedCanonicalManifest = JSON.parse(canonicalManifest);
  malformedCanonicalManifest.token.fixedSupply = "1000000000";
  writeFileSync(manifestPath, `${JSON.stringify(malformedCanonicalManifest, null, 2)}\n`, "utf8");
  ready.ceremonyControls.manifestSha256 = sha256File(manifestPath);
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a READY checklist paired with a freshly hashed malformed canonical manifest",
    () => {},
    "canonical Genesis manifest validator to pass before the signing ceremony",
  );
  writeFileSync(manifestPath, canonicalManifest, "utf8");
  ready.ceremonyControls.manifestSha256 = sha256File(manifestPath);
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");

  const substitutedManifestPath = join(sandboxRoot, "launch", "unreviewed-manifest.json");
  writeFileSync(substitutedManifestPath, "not the reviewed manifest\n", "utf8");
  assertRejected(
    "a READY checklist that points its digest check at a substituted manifest",
    (fixture) => { fixture.manifestPath = "launch/unreviewed-manifest.json"; },
    "manifestPath must point to the canonical Genesis manifest",
    "manifestSha256 to match the exact reviewed manifest",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a recipient address reused as a ceremony role",
    (fixture) => { fixture.ceremonyControls.reviewedRecipientDestinations.community.publicAddress = fixture.participants.mintAuthoritySigner.publicAddress; },
    "READY recipient addresses must be separate from ceremony-role addresses",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a READY checklist that permits automatic broadcast",
    (fixture) => { fixture.ceremonyControls.automaticBroadcastPermitted = true; },
    "checklist must forbid automatic broadcast",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  const publishedManifest = JSON.parse(canonicalManifest);
  publishedManifest.status = "PUBLISHED";
  publishedManifest.token.mint = address(80);
  for (const [index, allocation] of Object.keys(publishedManifest.allocations).entries()) {
    publishedManifest.allocations[allocation].destination = address(index + 10);
  }
  writeFileSync(manifestPath, `${JSON.stringify(publishedManifest, null, 2)}\n`, "utf8");
  ready.ceremonyControls.manifestSha256 = sha256File(manifestPath);
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a READY checklist after the Genesis manifest is published",
    () => {},
    "READY requires the canonical Genesis manifest to remain HOLD until the signing ceremony is complete",
  );
  writeFileSync(manifestPath, canonicalManifest, "utf8");
  ready.ceremonyControls.manifestSha256 = sha256File(manifestPath);
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a manifest digest that no longer binds the review",
    (fixture) => { fixture.ceremonyControls.manifestSha256 = "a".repeat(64); },
    "manifestSha256 to match the exact reviewed manifest",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "an uppercase READY manifest digest",
    (fixture) => { fixture.ceremonyControls.manifestSha256 = fixture.ceremonyControls.manifestSha256.toUpperCase(); },
    "manifestSha256 as a lowercase 64-character SHA-256 digest",
  );
  writeFileSync(checklistPath, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  assertRejected(
    "a stale READY review timestamp",
    (fixture) => { fixture.ceremonyControls.readyAtUtc = new Date(Date.now() - (31 * 60 * 1000)).toISOString(); },
    "older than 30 minutes",
  );
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nSigning checklist regression failed.");
else console.log("\nSigning checklist regression passes.");

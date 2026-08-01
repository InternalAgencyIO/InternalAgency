#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-post-genesis-reconciliation-"));
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
const credentialShapedKeypair = (seed) => encodeBase58(Buffer.alloc(64, seed));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });
  cpSync(join(repositoryRoot, "public"), join(sandboxRoot, "public"), { recursive: true });
  cpSync(join(repositoryRoot, "app", "mint"), join(sandboxRoot, "app", "mint"), { recursive: true });
  cpSync(join(repositoryRoot, "programs", "iat_v2"), join(sandboxRoot, "programs", "iat_v2"), { recursive: true });
  cpSync(join(repositoryRoot, "engagement"), join(sandboxRoot, "engagement"), { recursive: true });
  cpSync(join(repositoryRoot, "pnpm-lock.yaml"), join(sandboxRoot, "pnpm-lock.yaml"));
  symlinkSync(join(repositoryRoot, "node_modules"), join(sandboxRoot, "node_modules"), "junction");

  const reconciliationPath = join(sandboxRoot, "launch", "post-genesis-reconciliation.template.json");
  const canonicalRecord = JSON.parse(readFileSync(reconciliationPath, "utf8"));
  const runValidator = () => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-post-genesis-reconciliation.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const runValidatorAt = (path) => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-post-genesis-reconciliation.mjs"), path], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const writeRecord = (fixture) => writeFileSync(reconciliationPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const assertValid = (label) => {
    writeRecord(canonicalRecord);
    const result = runValidator();
    if (result.error || result.status !== 0) fail(`post-Genesis reconciliation validator rejected ${label}`);
    else console.log(`OK: post-Genesis reconciliation validator accepts ${label}`);
  };
  const assertRejected = (label, mutate, expectedMessage) => {
    const fixture = JSON.parse(JSON.stringify(canonicalRecord));
    mutate(fixture);
    writeRecord(fixture);
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`post-Genesis reconciliation validator accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`post-Genesis reconciliation validator did not report ${label}`);
    else console.log(`OK: post-Genesis reconciliation validator rejects ${label}`);
  };

  assertValid("the canonical HOLD reconciliation record");
  const stageJournalPath = join(sandboxRoot, "launch", "iat-v2-mainnet-stage-journal.template.json");
  const stageJournalValidatorPath = join(sandboxRoot, "scripts", "validate-iat-v2-mainnet-stage-journal.mjs");
  const reviewedStageJournalBytes = readFileSync(stageJournalPath);
  const stageJournalValidatorSource = readFileSync(stageJournalValidatorPath, "utf8");
  try {
    writeFileSync(stageJournalValidatorPath, [
      'import { appendFileSync } from "node:fs";',
      'appendFileSync("launch/iat-v2-mainnet-stage-journal.template.json", " ");',
      "process.exit(0);",
      "",
    ].join("\n"), "utf8");
    writeRecord(canonicalRecord);
    const stageJournalSwapValidation = runValidator();
    const stageJournalSwapOutput = `${stageJournalSwapValidation.stdout}\n${stageJournalSwapValidation.stderr}`;
    if (stageJournalSwapValidation.error || stageJournalSwapValidation.status === 0) {
      fail("post-Genesis reconciliation accepted a stage journal changed by its validator");
    } else if (!stageJournalSwapOutput.includes("IAT V2 stage journal changed during validation")) {
      fail("post-Genesis reconciliation did not report a stage-journal validation race");
    } else {
      console.log("OK: post-Genesis reconciliation rejects a stage journal changed by its validator");
    }
  } finally {
    writeFileSync(stageJournalPath, reviewedStageJournalBytes);
    writeFileSync(stageJournalValidatorPath, stageJournalValidatorSource, "utf8");
  }
  const substitutedReconciliationPath = join(sandboxRoot, "launch", "substituted-post-genesis-reconciliation.json");
  writeFileSync(substitutedReconciliationPath, `${JSON.stringify(canonicalRecord, null, 2)}\n`, "utf8");
  const substitutedPathValidation = runValidatorAt("launch/substituted-post-genesis-reconciliation.json");
  const substitutedPathOutput = `${substitutedPathValidation.stdout}\n${substitutedPathValidation.stderr}`;
  if (substitutedPathValidation.error || substitutedPathValidation.status === 0) {
    fail("post-Genesis reconciliation validator accepted a substituted reconciliation path");
  } else if (!substitutedPathOutput.includes("reconciliation path must be launch/post-genesis-reconciliation.template.json")) {
    fail("post-Genesis reconciliation validator did not report a substituted reconciliation path");
  } else {
    console.log("OK: post-Genesis reconciliation validator rejects a substituted reconciliation path");
  }
  assertRejected(
    "a reconciliation record that permits channel mismatches",
    (fixture) => { fixture.controls.haltOnChannelMismatch = false; },
    "controls.haltOnChannelMismatch must be true",
  );
  assertRejected(
    "a reconciliation record that permits unresolved corrections",
    (fixture) => { fixture.controls.haltOnUnresolvedCorrections = false; },
    "controls.haltOnUnresolvedCorrections must be true",
  );
  assertRejected(
    "a non-canonical release-packet source path",
    (fixture) => { fixture.sourceArtifacts.releasePacketPath = "launch/review-copy.json"; },
    "releasePacketPath must point to the canonical artifact",
  );
  assertRejected(
    "a non-canonical IAT V2 stage-journal source path",
    (fixture) => { fixture.sourceArtifacts.iatV2StageJournalPath = "launch/review-stage-journal.json"; },
    "iatV2StageJournalPath must point to the canonical artifact",
  );
  assertRejected(
    "a COMPLETE archive while the stage journal remains HOLD",
    (fixture) => {
      fixture.status = "COMPLETE";
      fixture.reconciliation.archiveOwnerLabel = "Evidence archive owner";
      fixture.reconciliation.independentReviewerLabel = "Independent evidence reviewer";
    },
    "COMPLETE requires IAT V2 stage journal status RECONCILED",
  );
  assertRejected(
    "a credential-bearing archive owner label",
    (fixture) => { fixture.reconciliation.archiveOwnerLabel = "amber bridge candle drift ember forest galaxy harbor island jungle kindle lantern"; },
    "reconciliation must not contain credential-bearing field names or values",
  );
  for (const [index, field] of ["archiveOwnerLabel", "independentReviewerLabel"].entries()) {
    assertRejected(
      `64-byte Base58 credential-shaped material at reconciliation.${field}`,
      (fixture) => { fixture.reconciliation[field] = credentialShapedKeypair(index + 9); },
      `reconciliation must not contain credential-bearing field names or values (reconciliation.reconciliation.${field})`,
    );
  }
  assertRejected(
    "an unreviewed extra reconciliation assertion",
    (fixture) => { fixture.approvalNote = "cleared in chat"; },
    "record must contain exactly the reviewed reconciliation fields",
  );
  assertRejected(
    "a HOLD reconciliation record retaining an evidence archive",
    (fixture) => { fixture.reconciliation.evidenceArchiveUrl = "https://internalagency.io/archives/genesis-proof"; },
    "HOLD requires reconciliation.evidenceArchiveUrl to be null so prior public evidence cannot survive a reset",
  );
  assertRejected(
    "a HOLD reconciliation record retaining a reconciled channel",
    (fixture) => { fixture.reconciliation.channelRecords = [{ channel: "website" }]; },
    "HOLD requires reconciliation.channelRecords to be an empty array so prior public evidence cannot survive a reset",
  );

  assertRejected(
    "case-variant archive and reviewer labels",
    (fixture) => {
      fixture.status = "COMPLETE";
      fixture.reconciliation.archiveOwnerLabel = "Archive owner";
      fixture.reconciliation.independentReviewerLabel = "ARCHIVE OWNER";
    },
    "genuinely distinct archive-owner and independent-reviewer labels",
  );
  assertRejected(
    "a Turkish dotted-I case-variant archive and reviewer label",
    (fixture) => {
      fixture.status = "COMPLETE";
      fixture.reconciliation.archiveOwnerLabel = "Archive owner";
      fixture.reconciliation.independentReviewerLabel = "ARCH\u0130VE OWNER";
    },
    "genuinely distinct archive-owner and independent-reviewer labels",
  );
  assertRejected(
    "a parseable but non-canonical reconciliation timestamp",
    (fixture) => {
      fixture.status = "COMPLETE";
      fixture.reconciliation.archiveOwnerLabel = "Archive owner";
      fixture.reconciliation.independentReviewerLabel = "Independent reviewer";
      fixture.reconciliation.checkedAtUtc = "2026-07-29T01:00:00.00Z";
    },
    "COMPLETE requires a canonical ISO-8601 UTC reconciliation.checkedAtUtc timestamp",
  );
  assertRejected(
    "a future-dated reconciliation review",
    (fixture) => {
      fixture.status = "COMPLETE";
      fixture.reconciliation.archiveOwnerLabel = "Archive owner";
      fixture.reconciliation.independentReviewerLabel = "Independent reviewer";
      fixture.reconciliation.checkedAtUtc = "2099-01-01T00:00:00.000Z";
    },
    "COMPLETE reconciliation.checkedAtUtc cannot be more than one minute in the future",
  );
  assertRejected(
    "a correction identifier with ambiguous whitespace",
    (fixture) => {
      fixture.status = "COMPLETE";
      fixture.reconciliation.correctionStatus = "RESOLVED";
      fixture.reconciliation.correctionRecords = [{
        correctionId: "CORR 001",
        status: "RESOLVED",
        reportedAtUtc: "2026-07-29T00:30:00.000Z",
        resolvedAtUtc: "2026-07-29T00:45:00.000Z",
        publicNoticeUrl: "https://status.star-ascent.example/corrections/corr-001",
      }];
    },
    "correctionRecords[0].correctionId must be a portable, non-placeholder identifier",
  );
  assertRejected(
    "case-variant duplicate correction identifiers",
    (fixture) => {
      fixture.status = "COMPLETE";
      fixture.reconciliation.correctionStatus = "RESOLVED";
      fixture.reconciliation.correctionRecords = [
        {
          correctionId: "CORR-001",
          status: "RESOLVED",
          reportedAtUtc: "2026-07-29T00:30:00.000Z",
          resolvedAtUtc: "2026-07-29T00:45:00.000Z",
          publicNoticeUrl: "https://status.star-ascent.example/corrections/corr-001",
        },
        {
          correctionId: "corr-001",
          status: "RESOLVED",
          reportedAtUtc: "2026-07-29T00:35:00.000Z",
          resolvedAtUtc: "2026-07-29T00:50:00.000Z",
          publicNoticeUrl: "https://status.star-ascent.example/corrections/corr-001-followup",
        },
      ];
    },
    "duplicate correction record: corr-001",
  );

  // A HOLD packet still dispatches through the mainnet-handoff validator. When
  // that handoff is APPROVED, the child validator reads the release snapshot;
  // mutating it during validation must invalidate the reconciliation review.
  const snapshotSwapPacketPath = join(sandboxRoot, "launch", "release-packet.template.json");
  const snapshotSwapHandoffPath = join(sandboxRoot, "launch", "mainnet-handoff.template.json");
  const snapshotSwapPath = join(sandboxRoot, "launch", "release-snapshot.generated.json");
  const snapshotSwapValidatorPath = join(sandboxRoot, "scripts", "validate-release-packet.mjs");
  const reviewedHoldPacketBytes = readFileSync(snapshotSwapPacketPath);
  const reviewedHandoffBytes = readFileSync(snapshotSwapHandoffPath);
  const releasePacketValidatorSource = readFileSync(snapshotSwapValidatorPath, "utf8");
  try {
    const holdPacket = JSON.parse(reviewedHoldPacketBytes.toString("utf8"));
    holdPacket.status = "HOLD";
    writeFileSync(snapshotSwapPacketPath, `${JSON.stringify(holdPacket, null, 2)}\n`, "utf8");
    const approvedHandoff = JSON.parse(reviewedHandoffBytes.toString("utf8"));
    approvedHandoff.status = "APPROVED";
    writeFileSync(snapshotSwapHandoffPath, `${JSON.stringify(approvedHandoff, null, 2)}\n`, "utf8");
    writeFileSync(snapshotSwapPath, '{"version":1,"status":"HOLD"}\n', "utf8");
    writeFileSync(snapshotSwapValidatorPath, [
      'import { appendFileSync } from "node:fs";',
      'appendFileSync("launch/release-snapshot.generated.json", " ");',
      "process.exit(0);",
      "",
    ].join("\n"), "utf8");
    writeRecord(canonicalRecord);
    const snapshotSwapValidation = runValidator();
    const snapshotSwapOutput = `${snapshotSwapValidation.stdout}\n${snapshotSwapValidation.stderr}`;
    if (snapshotSwapValidation.error || snapshotSwapValidation.status === 0) {
      fail("post-Genesis reconciliation accepted a release snapshot swapped through an APPROVED handoff while the packet remained HOLD");
    } else if (!snapshotSwapOutput.includes("canonical launch dependencies changed during validation")) {
      fail("post-Genesis reconciliation did not report the APPROVED-handoff/HOLD-packet snapshot swap");
    } else {
      console.log("OK: post-Genesis reconciliation rejects snapshot swaps through an APPROVED handoff while the packet remains HOLD");
    }
  } finally {
    writeFileSync(snapshotSwapPacketPath, reviewedHoldPacketBytes);
    writeFileSync(snapshotSwapHandoffPath, reviewedHandoffBytes);
    writeFileSync(snapshotSwapValidatorPath, releasePacketValidatorSource, "utf8");
  }

  const manifestPath = join(sandboxRoot, "launch", "genesis-manifest.template.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.token.decimals = 8;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  assertRejected(
    "a reconciliation record with a malformed canonical manifest dependency",
    () => {},
    "post-Genesis reconciliation requires the canonical manifest validator to pass before any reconciliation state is accepted",
  );

  // Exercise the post-publication state independently from manifest/payload
  // internals while keeping the real sealed-packet validator. The old gate
  // reran READY here and could never coexist with PUBLISHED/VERIFIED sources.
  for (const validator of [
    "validate-genesis-manifest.mjs",
    "validate-publication-payload.mjs",
    "validate-iat-v2-mainnet-stage-journal.mjs",
  ]) {
    writeFileSync(join(sandboxRoot, "scripts", validator), "process.exit(0);\n", "utf8");
  }
  writeFileSync(join(sandboxRoot, "scripts", "validate-release-packet.mjs"), "process.exit(1);\n", "utf8");
  const stageJournal = JSON.parse(readFileSync(stageJournalPath, "utf8"));
  stageJournal.status = "RECONCILED";
  for (const stage of stageJournal.stages) stage.status = "FINALIZED_MATCHED";
  Object.assign(stageJournal.terminalDecision, {
    state: "RECONCILED",
    reasonCode: "ALL_STAGES_MATCHED",
  });
  writeFileSync(stageJournalPath, `${JSON.stringify(stageJournal, null, 2)}\n`, "utf8");
  const mint = "US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx";
  const mintAuthorityEvidence = "https://explorer.solana.com/tx/AKAh9LUoWFG2sxAMotzmLNpKwPTCiG6Q4YTwAinZMnkvYKPAKVPwYSfoQDp8XLKWzpbCNx66XB1BrcD1ZUPqU39";
  const freezeAuthorityEvidence = "https://explorer.solana.com/tx/BUguQsv2ZuHus54HAFzjdJHzZBkygAjKhEeYwSG19tUfUyvvz3worsdQCdAXDNjakJHioSiyxhFiDJrm8XpSXRA";
  const canonicalRoute = "https://internalagency.io/proof";
  writeFileSync(manifestPath, `${JSON.stringify({
    status: "PUBLISHED",
    token: {
      mint,
      mintAuthorityRevocationTransaction: mintAuthorityEvidence,
      freezeAuthorityRevocationTransaction: freezeAuthorityEvidence,
    },
    claimOrDistribution: { canonicalRoute },
  }, null, 2)}\n`, "utf8");
  const artifactDigests = {
    manifestSha256: "a".repeat(64),
    publicationPayloadSha256: "b".repeat(64),
    signingChecklistSha256: sha256(readFileSync(join(sandboxRoot, "launch", "genesis-signing-checklist.template.json"))),
    devnetRehearsalSha256: sha256(readFileSync(join(sandboxRoot, "launch", "devnet-rehearsal.template.json"))),
    mainnetHandoffSha256: sha256(readFileSync(join(sandboxRoot, "launch", "mainnet-handoff.template.json"))),
  };
  const packetApprovedAtUtc = "2026-07-29T00:54:00.000Z";
  const packet = {
    status: "READY",
    releaseControls: { publicEvidenceCheckedAtUtc: "2026-07-29T00:50:00.000Z" },
    artifactDigests,
    approval: {
      packetDigest: sha256(JSON.stringify({ packetVersion: 1, artifactDigests })),
      approvedAtUtc: packetApprovedAtUtc,
    },
  };
  const releasePacketPath = join(sandboxRoot, "launch", "release-packet.template.json");
  writeFileSync(releasePacketPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  const releaseSnapshotPath = join(sandboxRoot, "launch", "release-snapshot.generated.json");
  writeFileSync(
    releaseSnapshotPath,
    `${JSON.stringify({ version: 1, status: "HOLD", fixture: true }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(join(sandboxRoot, "launch", "PUBLICATION_PAYLOAD.template.md"), [
    "Status: **VERIFIED**",
    `Mint: ${mint}`,
    `Mint authority evidence: ${mintAuthorityEvidence}`,
    `Freeze authority evidence: ${freezeAuthorityEvidence}`,
    `Allocation and lock evidence: ${canonicalRoute}`,
    "Checked at (UTC): 2026-07-29 00:50 UTC",
    "",
  ].join("\n"), "utf8");
  writeFileSync(
    join(sandboxRoot, "launch", "pre-publication-packet-proof.generated.json"),
    `${JSON.stringify({
      version: 1,
      status: "SEALED",
      scope: "Historical pre-publication READY-packet proof only; this record never authorizes signing, submission, publication, or a claim.",
      sealedAtUtc: "2026-07-29T00:55:00.000Z",
      releasePacketPath: "launch/release-packet.template.json",
      releasePacketSha256: sha256(readFileSync(releasePacketPath)),
      releaseSnapshotPath: "launch/release-snapshot.generated.json",
      releaseSnapshotSha256: sha256(readFileSync(releaseSnapshotPath)),
      approvalPacketDigest: packet.approval.packetDigest,
      packetApprovedAtUtc,
      artifactDigests,
    }, null, 2)}\n`,
    "utf8",
  );
  writeRecord(canonicalRecord);
  const postPublicationHoldValidation = runValidator();
  const postPublicationHoldOutput = `${postPublicationHoldValidation.stdout}\n${postPublicationHoldValidation.stderr}`;
  if (postPublicationHoldValidation.error || postPublicationHoldValidation.status !== 0) {
    fail(`post-Genesis reconciliation validator rejected the canonical post-publication HOLD collection phase: ${postPublicationHoldValidation.stderr.trim()}`);
  } else if (!postPublicationHoldOutput.includes("canonical pre-publication packet proof validator passes")) {
    fail("post-Genesis reconciliation validator did not dispatch post-publication HOLD through the sealed-packet proof");
  } else {
    console.log("OK: post-publication HOLD collection uses the sealed proof without reopening READY");
  }

  const completeRecord = JSON.parse(JSON.stringify(canonicalRecord));
  completeRecord.status = "COMPLETE";
  completeRecord.reconciliation = {
    checkedAtUtc: "2026-07-29T01:00:00.000Z",
    archiveOwnerLabel: "Evidence archive owner",
    independentReviewerLabel: "Independent evidence reviewer",
    evidenceArchiveUrl: "https://internalagency.io/proof/archive",
    publicChangelogUrl: "https://internalagency.io/proof/changelog",
    correctionStatus: "NONE",
    correctionRecords: [],
    channelRecords: [
      {
        channel: "Website",
        publicUrl: "https://internalagency.io/proof",
        checkedAtUtc: "2026-07-29T00:56:00.000Z",
        status: "matched",
        canonicalRoute,
        mint,
        mintAuthorityEvidence,
        freezeAuthorityEvidence,
      },
      {
        channel: "Status archive",
        publicUrl: "https://status.internalagency.io/genesis",
        checkedAtUtc: "2026-07-29T00:57:00.000Z",
        status: "matched",
        canonicalRoute,
        mint,
        mintAuthorityEvidence,
        freezeAuthorityEvidence,
      },
    ],
  };
  writeRecord(completeRecord);
  const completeValidation = runValidator();
  if (completeValidation.error || completeValidation.status !== 0) {
    fail(`post-Genesis reconciliation validator rejected the canonical VERIFIED COMPLETE state: ${completeValidation.stderr.trim()}`);
  } else {
    console.log("OK: post-Genesis reconciliation validator accepts the canonical VERIFIED COMPLETE state");
  }
  const assertCompleteRejected = (label, mutate, expectedMessage) => {
    const fixture = JSON.parse(JSON.stringify(completeRecord));
    mutate(fixture);
    writeRecord(fixture);
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`post-Genesis reconciliation validator accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`post-Genesis reconciliation validator did not report ${label}`);
    else console.log(`OK: post-Genesis reconciliation validator rejects ${label}`);
  };
  assertCompleteRejected(
    "case-variant duplicate channel labels",
    (fixture) => { fixture.reconciliation.channelRecords[1].channel = "WEBSITE"; },
    "duplicate channel record: WEBSITE",
  );
  assertCompleteRejected(
    "Unicode-equivalent duplicate channel labels",
    (fixture) => { fixture.reconciliation.channelRecords[1].channel = "WEBS\u0130TE"; },
    "duplicate channel record: WEBS\u0130TE",
  );
  assertCompleteRejected(
    "full-width compatibility duplicate channel labels",
    (fixture) => { fixture.reconciliation.channelRecords[1].channel = "\uFF37\uFF45\uFF42\uFF53\uFF49\uFF54\uFF45"; },
    "duplicate channel record: \uFF37\uFF45\uFF42\uFF53\uFF49\uFF54\uFF45",
  );
  assertCompleteRejected(
    "internal-whitespace duplicate channel labels",
    (fixture) => {
      fixture.reconciliation.channelRecords[0].channel = "Status archive";
      fixture.reconciliation.channelRecords[1].channel = "Status   archive";
    },
    "duplicate channel record: Status   archive",
  );
  assertCompleteRejected(
    "archive and changelog URL aliases",
    (fixture) => { fixture.reconciliation.publicChangelogUrl = "https://INTERNALAGENCY.IO:443/proof/archive#changes"; },
    "COMPLETE requires separate evidence archive and public changelog URLs",
  );
  assertCompleteRejected(
    "host-case, terminal-dot, default-port, dot-segment, and fragment variants of another channel URL",
    (fixture) => { fixture.reconciliation.channelRecords[1].publicUrl = "https://INTERNALAGENCY.IO.:443/archive/../proof#status"; },
    "channelRecords[1].publicUrl must be distinct from archive, changelog, and other channels",
  );
  assertCompleteRejected(
    "percent-encoding variants of another channel URL",
    (fixture) => {
      fixture.reconciliation.channelRecords[0].publicUrl = "https://status.internalagency.io/genesis/channel";
      fixture.reconciliation.channelRecords[1].publicUrl = "https://status.internalagency.io/genesis/%63hannel#live";
    },
    "channelRecords[1].publicUrl must be distinct from archive, changelog, and other channels",
  );
  assertCompleteRejected(
    "Unicode-normalization variants of an archive URL",
    (fixture) => {
      fixture.reconciliation.evidenceArchiveUrl = "https://internalagency.io/proof/caf%C3%A9";
      fixture.reconciliation.channelRecords[1].publicUrl = "https://internalagency.io/proof/cafe%CC%81";
    },
    "channelRecords[1].publicUrl must be distinct from archive, changelog, and other channels",
  );
  assertCompleteRejected(
    "a userinfo-bearing channel URL",
    (fixture) => { fixture.reconciliation.channelRecords[1].publicUrl = "https://operator:review@status.internalagency.io/genesis"; },
    "channelRecords[1].publicUrl must be non-placeholder HTTPS",
  );

  const proofValidatorPath = join(sandboxRoot, "scripts", "validate-pre-publication-packet-proof.mjs");
  const proofValidatorSource = readFileSync(proofValidatorPath, "utf8");
  const reviewedPacketBytes = readFileSync(releasePacketPath);
  writeFileSync(proofValidatorPath, `${proofValidatorSource}
import { appendFileSync } from "node:fs";
appendFileSync("launch/release-packet.template.json", " ");
`, "utf8");
  writeRecord(completeRecord);
  const dependencySwapValidation = runValidator();
  const dependencySwapOutput = `${dependencySwapValidation.stdout}\n${dependencySwapValidation.stderr}`;
  if (dependencySwapValidation.error || dependencySwapValidation.status === 0) {
    fail("post-Genesis reconciliation accepted a release packet swapped after sealed-proof validation");
  } else if (!dependencySwapOutput.includes("canonical launch dependencies changed during validation")) {
    fail("post-Genesis reconciliation did not report a dependency swap during sealed-proof validation");
  } else {
    console.log("OK: post-Genesis reconciliation rejects dependencies changed after sealed-proof validation");
  }
  writeFileSync(releasePacketPath, reviewedPacketBytes);
  writeFileSync(proofValidatorPath, proofValidatorSource, "utf8");
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nPost-Genesis reconciliation regression failed.");
else console.log("\nPost-Genesis reconciliation regression passes.");

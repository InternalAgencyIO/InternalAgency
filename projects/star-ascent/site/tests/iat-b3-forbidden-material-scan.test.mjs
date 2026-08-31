import assert from "node:assert/strict";
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import {
  IAT_B3_FORBIDDEN_MATERIAL_SCAN_SCHEMA,
  IAT_B3_FORBIDDEN_MATERIAL_SCAN_STATUS,
  IAT_B3_REVIEWED_PUBLIC_TEST_VECTOR_ALLOWLIST,
  scanIatB3RepositoryForForbiddenMaterial,
} from "../scripts/lib/iat-b3-forbidden-material-scan.mjs";

const PUBLIC_VECTOR_SOURCE = fileURLToPath(
  new URL("./iat-b3-production-local-rehearsal-driver.test.mjs", import.meta.url),
);
const SCANNER_SOURCE = fileURLToPath(
  new URL("../scripts/lib/iat-b3-forbidden-material-scan.mjs", import.meta.url),
);
const PEM_BEGIN = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
const PEM_END = ["-----END", "PRIVATE KEY-----"].join(" ");

function temporaryRoot(t, prefix = "iat-b3-forbidden-material-scan-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relativePath, bytes = "ordinary\n") {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return path;
}

test("direct scan includes ignored-style paths, excludes only root Git metadata, and bounds huge media", (t) => {
  const root = temporaryRoot(t);
  write(root, "src/index.mjs", "export const clean = true;\n");
  write(root, ".ignored-cache/example/Keypair.cjs", "export class Keypair {}\n");
  write(
    root,
    "projects/star-ascent/site/node_modules/untrusted-binary/program.so",
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  );
  write(
    root,
    "projects/star-ascent/site/vendor/checked-in-package/dist/index.mjs",
    "export const vendored = true;\n",
  );
  write(root, ".git/objects/ignored-private-key.pem", [
    PEM_BEGIN,
    "dGhpcyBpcyBnaXQgaW50ZXJuYWwgb25seSBhbmQgaXMgbm90IHNjYW5uZWQ=",
    PEM_END,
    "",
  ].join("\n"));
  write(root, "assets/large-reviewed-image.png", Buffer.alloc(8 * 1024 * 1024 + 1, 0x5a));

  const observation = scanIatB3RepositoryForForbiddenMaterial(root);
  assert.equal(observation.schema, IAT_B3_FORBIDDEN_MATERIAL_SCAN_SCHEMA);
  assert.equal(observation.status, IAT_B3_FORBIDDEN_MATERIAL_SCAN_STATUS);
  assert.equal(observation.directFilesystemObservationOnly, true);
  assert.equal(observation.gitMetadataExcluded, true);
  assert.equal(observation.gitOrExternalCommandsInvoked, false);
  assert.equal(observation.forbiddenMaterialObserved, false);
  assert.equal(observation.fileCount, 4);
  assert.equal(observation.excludedGitMetadataEntryCount, 1);
  assert.equal(observation.excludedReviewedDependencyCacheDirectoryCount, 1);
  assert.equal(observation.largeMediaPrefixOnlyFileCount, 1);
  assert.equal(observation.fullFileInspectionCount, 3);
  assert.match(observation.inventorySha256, /^[0-9a-f]{64}$/u);
});

test("forbidden filenames cover keypairs, credential env, receipts, and build artifacts", async (t) => {
  const cases = [
    ["operator-keypair.json", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["operatorPrivateKey.json", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["BackupSecretKey.txt", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["recoverySeedPhrase.json", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["custody/hotWallet", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["keys/operator_key_pair.json", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["archive/recovery-phrase.seed", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["keys/id_ed25519", "KEYPAIR_OR_PRIVATE_KEY_FILE"],
    ["config/.env.local", "CREDENTIAL_ENV_FILE"],
    ["evidence/run.receipt.json", "RECEIPT_ARTIFACT_FILE"],
    ["build-output/program.so", "ELF_SBF_OR_BUILD_ARTIFACT_FILE"],
    ["target/debug/no-extension", "ELF_SBF_OR_BUILD_ARTIFACT_DIRECTORY"],
  ];
  for (const [relativePath, code] of cases) {
    await t.test(relativePath, (subtest) => {
      const root = temporaryRoot(subtest);
      write(root, relativePath, "");
      assert.throws(
        () => scanIatB3RepositoryForForbiddenMaterial(root),
        new RegExp(`IAT_B3_FORBIDDEN_MATERIAL_${code}_HOLD`, "u"),
      );
    });
  }
});

test("normalized sensitive stems do not overmatch benign source and prose filenames", (t) => {
  const root = temporaryRoot(t);
  for (const relativePath of [
    "src/Keypair.cjs",
    "src/privateKeyUtilities.mjs",
    "src/walletAdapter.ts",
    "docs/recoverySeedPhrase.md",
    "fixtures/monkeypair.json",
    "fixtures/walleting.json",
  ]) {
    write(root, relativePath, "ordinary reviewed source text\n");
  }
  const observation = scanIatB3RepositoryForForbiddenMaterial(root);
  assert.equal(observation.forbiddenMaterialObserved, false);
  assert.equal(observation.fileCount, 6);
});

test("content inspection rejects ELF, private-key blocks, raw keypairs, credentials, and mnemonics", async (t) => {
  const cases = [
    ["innocent.bin", Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x01]), "ELF_SBF_BYTES"],
    ["notes.txt", [
      PEM_BEGIN,
      "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      PEM_END,
      "",
    ].join("\n"), "PRIVATE_KEY_MNEMONIC_OR_CREDENTIAL_BYTES"],
    ["numbers.json", `${JSON.stringify(Array.from({ length: 64 }, (_, index) => index))}\n`,
      "PRIVATE_KEY_MNEMONIC_OR_CREDENTIAL_BYTES"],
    ["settings.json", `${JSON.stringify({ secretKey: "1".repeat(64) })}\n`,
      "PRIVATE_KEY_MNEMONIC_OR_CREDENTIAL_BYTES"],
    ["ordinary.conf", "RPC_PASSWORD=correct-horse-battery-staple\n",
      "PRIVATE_KEY_MNEMONIC_OR_CREDENTIAL_BYTES"],
    ["recovery.txt", "mnemonic=\"abandon ability able about above absent absorb abstract absurd abuse access accident\"\n",
      "PRIVATE_KEY_MNEMONIC_OR_CREDENTIAL_BYTES"],
  ];
  for (const [relativePath, bytes, code] of cases) {
    await t.test(relativePath, (subtest) => {
      const root = temporaryRoot(subtest);
      write(root, relativePath, bytes);
      assert.throws(
        () => scanIatB3RepositoryForForbiddenMaterial(root),
        new RegExp(`IAT_B3_FORBIDDEN_MATERIAL_${code}_HOLD`, "u"),
      );
    });
  }
});

test("the sole public RFC keypair vector requires its exact reviewed path, bytes, and hash", (t) => {
  assert.deepEqual(IAT_B3_REVIEWED_PUBLIC_TEST_VECTOR_ALLOWLIST, [{
    path: "projects/star-ascent/site/tests/iat-b3-production-local-rehearsal-driver.test.mjs",
    byteLength: 58_499,
    sha256: "227efd4b045f4f7cb97cc43a3133919df4d82ee9b5aa3e7bb22722b7c8607511",
    subject: "RFC_8032_SECTION_7_1_TEST_1_PUBLIC_VECTOR",
  }]);
  const root = temporaryRoot(t, "iat-b3-reviewed-vector-");
  const reviewedPath = write(
    root,
    IAT_B3_REVIEWED_PUBLIC_TEST_VECTOR_ALLOWLIST[0].path,
    readFileSync(PUBLIC_VECTOR_SOURCE),
  );
  const clean = scanIatB3RepositoryForForbiddenMaterial(root);
  assert.deepEqual(clean.reviewedAllowlistMatches, IAT_B3_REVIEWED_PUBLIC_TEST_VECTOR_ALLOWLIST);

  writeFileSync(reviewedPath, Buffer.concat([readFileSync(reviewedPath), Buffer.from("\n")]));
  assert.throws(
    () => scanIatB3RepositoryForForbiddenMaterial(root),
    /IAT_B3_FORBIDDEN_MATERIAL_REVIEWED_ALLOWLIST_DRIFT_HOLD/u,
  );

  const wrongRoot = temporaryRoot(t, "iat-b3-unreviewed-vector-");
  write(wrongRoot, "tests/copied-public-vector.mjs", readFileSync(PUBLIC_VECTOR_SOURCE));
  assert.throws(
    () => scanIatB3RepositoryForForbiddenMaterial(wrongRoot),
    /IAT_B3_FORBIDDEN_MATERIAL_UNREVIEWED_PUBLIC_TEST_VECTOR_HOLD/u,
  );
});

test("hardlinks, reparse entries, nested Git metadata, and root aliases fail closed", async (t) => {
  await t.test("hardlink", (subtest) => {
    const root = temporaryRoot(subtest);
    const original = write(root, "ordinary.txt");
    linkSync(original, join(root, "ordinary-copy.txt"));
    assert.throws(
      () => scanIatB3RepositoryForForbiddenMaterial(root),
      /IAT_B3_FORBIDDEN_MATERIAL_HARDLINK_HOLD/u,
    );
  });

  await t.test("reparse directory", (subtest) => {
    const root = temporaryRoot(subtest);
    const outside = temporaryRoot(subtest, "iat-b3-forbidden-material-outside-");
    write(outside, "ordinary.txt");
    symlinkSync(outside, join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(
      () => scanIatB3RepositoryForForbiddenMaterial(root),
      /IAT_B3_FORBIDDEN_MATERIAL_REPARSE_ENTRY_HOLD/u,
    );
  });

  await t.test("nested Git metadata", (subtest) => {
    const root = temporaryRoot(subtest);
    write(root, "nested/.git/hidden.txt");
    assert.throws(
      () => scanIatB3RepositoryForForbiddenMaterial(root),
      /IAT_B3_FORBIDDEN_MATERIAL_NESTED_GIT_METADATA_HOLD/u,
    );
  });

  await t.test("root Git metadata reparse", (subtest) => {
    const root = temporaryRoot(subtest);
    const outside = temporaryRoot(subtest, "iat-b3-git-metadata-outside-");
    write(outside, "HEAD", "ref: refs/heads/main\n");
    symlinkSync(outside, join(root, ".git"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(
      () => scanIatB3RepositoryForForbiddenMaterial(root),
      /IAT_B3_FORBIDDEN_MATERIAL_GIT_METADATA_REPARSE_HOLD/u,
    );
  });

  await t.test("relative root", (subtest) => {
    const root = temporaryRoot(subtest);
    assert.throws(
      () => scanIatB3RepositoryForForbiddenMaterial("."),
      /IAT_B3_FORBIDDEN_MATERIAL_ROOT_INVALID_HOLD/u,
    );
    assert.doesNotThrow(() => scanIatB3RepositoryForForbiddenMaterial(root));
  });
});

test("late file mutation cannot survive descriptor and final full-scan revalidation", async (t) => {
  const root = temporaryRoot(t, "iat-b3-forbidden-material-race-");
  const racedPath = write(root, "source/0000.txt", "initial\n");
  for (let index = 1; index <= 300; index += 1) {
    write(root, `source/${String(index).padStart(4, "0")}.txt`, `${index}\n`);
  }
  const signal = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  const worker = new Worker([
    'const { writeFileSync } = require("node:fs");',
    'const { workerData } = require("node:worker_threads");',
    'const signal = new Int32Array(workerData.signal);',
    'Atomics.store(signal, 0, 1); Atomics.notify(signal, 0);',
    'Atomics.wait(signal, 0, 1);',
    'let index = 0;',
    'while (Atomics.load(signal, 0) === 2) {',
    '  writeFileSync(workerData.path, `${index % 2 === 0 ? "mutated-a" : "mutated-b"}-${index}\\n`);',
    '  index += 1;',
    '}',
  ].join("\n"), {
    eval: true,
    workerData: { path: racedPath, signal: signal.buffer },
  });
  t.after(async () => worker.terminate());
  assert.equal(Atomics.wait(signal, 0, 0, 10_000), "ok");
  Atomics.store(signal, 0, 2);
  Atomics.notify(signal, 0);
  try {
    assert.throws(
      () => scanIatB3RepositoryForForbiddenMaterial(root),
      /IAT_B3_FORBIDDEN_MATERIAL_(?:FILE_DESCRIPTOR_BINDING|FILE_CHANGED_DURING_SCAN|FILE_CHANGED_BEFORE_FINALIZATION)_HOLD/u,
    );
  } finally {
    Atomics.store(signal, 0, 3);
    Atomics.notify(signal, 0);
  }
});

test("scanner has no Git, subprocess, network, signing, deployment, or mutation executor", () => {
  const source = readFileSync(SCANNER_SOURCE, "utf8");
  assert.doesNotMatch(source, /node:child_process|\bspawn(?:Sync)?\s*\(|\bexec(?:File|Sync)?\s*\(/u);
  assert.doesNotMatch(source, /\bgit\s+(?:status|ls-files|check-ignore)|\bfetch\s*\(|https?:\/\//u);
  assert.doesNotMatch(
    source,
    /@solana\/web3\.js|sendTransaction|sendAndConfirmTransaction|TransactionInstruction|\bfetch\s*\(/u,
  );
  assert.match(source, /O_NOFOLLOW/u);
  assert.match(source, /fstatSync/u);
  assert.match(source, /FILE_CHANGED_BEFORE_FINALIZATION/u);
  assert.match(source, /DIRECTORY_INVENTORY_CHANGED_BEFORE_FINALIZATION/u);
});

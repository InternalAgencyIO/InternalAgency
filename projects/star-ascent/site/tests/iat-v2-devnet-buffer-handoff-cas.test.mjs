import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  chmodSync,
  closeSync,
  constants,
  linkSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  HandoffCasError,
  IAT_V2_HANDOFF_CAS_ATTEMPTS_FD_ENV,
  IAT_V2_HANDOFF_CAS_ROOT_SENTINEL,
  inspectHandoffReservation,
  reserveHandoffMutation,
} from "../scripts/iat-v2-devnet-buffer-handoff-cas.mjs";

const sentinelText = `${JSON.stringify(IAT_V2_HANDOFF_CAS_ROOT_SENTINEL, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function provision() {
  const parent = mkdtempSync(join(homedir(), ".iat-v2-cas-parent-"));
  const root = join(parent, "devnet-buffer-handoff-v1");
  const attempts = join(root, "attempts");
  chmodSync(parent, 0o700);
  mkdirSync(root, { mode: 0o700 });
  mkdirSync(attempts, { mode: 0o700 });
  const sentinel = join(root, ".iat-v2-devnet-buffer-authority-cas-root.json");
  writeFileSync(sentinel, sentinelText, { mode: 0o600 });
  chmodSync(sentinel, 0o600);
  return { parent, root, attempts, sentinel };
}

function options(root) {
  return {
    root,
    buffer: "Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6",
    "from-authority": "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4",
    "to-authority": "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
    "artifact-sha256": "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
    "artifact-bytes": "649680",
    "evidence-manifest-sha256": "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
    "source-head-commit": "a03fe71dd66cd1650b8d0353e486786df30b83e9",
    "source-head-tree": "ffe82fcf8fd3d851c09a937ebec945121137e546",
    "ci-run-id": "33161771816",
    "ci-run-attempt": "1",
    "runtime-source-head-commit": "1".repeat(40),
    "runtime-source-head-tree": "2".repeat(40),
    "runtime-checkout-commit": "3".repeat(40),
    "runtime-checkout-tree": "2".repeat(40),
    "runtime-checkout-relation": "PR_MERGE_SECOND_PARENT",
    "runtime-binding-successor-commit": "4".repeat(40),
    "runtime-binding-successor-tree": "5".repeat(40),
    "runtime-binding-anchor-sha256": "6".repeat(64),
    "runtime-closure-sha256": "7".repeat(64),
    "runtime-evidence-manifest-sha256": "8".repeat(64),
    "runtime-verification-sha256": "9".repeat(64),
    "runtime-ci-run-id": "33378495895",
    "runtime-ci-run-attempt": "1",
    "runtime-workflow-ref": "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
    "handoff-sha256": "a".repeat(64),
    "handoff-bytes": "38421",
    "reconciler-sha256": "b".repeat(64),
    "reconciler-bytes": "22369",
    "cas-helper-sha256": "c".repeat(64),
    "cas-helper-bytes": "30112",
    "sealed-exec-sha256": "d".repeat(64),
    "sealed-exec-bytes": "17633",
    "runtime-binding-verifier-sha256": "e".repeat(64),
    "runtime-binding-verifier-bytes": "24576",
    "toolchain-sha256": "f".repeat(64),
    "toolchain-bytes": "6176",
    "sealed-exec-python-path": "/usr/bin/python3.12",
    "sealed-exec-python-version": "Python 3.12.3",
    "sealed-exec-python-sha256": "1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118",
    "sealed-exec-python-bytes": "8020928",
    "node-path": "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node",
    "node-version": "v24.19.0",
    "node-sha256": "bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12",
    "node-bytes": "125989464",
    "git-path": "/usr/bin/git",
    "git-version": "git version 2.43.0",
    "git-sha256": "2a8c18fbf43da9f692d75474c72bea9dfd796c260b0f3dfe456376abc3bbd668",
    "git-bytes": "4066232",
    "devnet-genesis-hash": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    "solana-cli-path": "/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana",
    "solana-cli-version": "solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)",
    "solana-cli-sha256": "aacc6871e8ff199608987f0364f2ed9e239a32e1e0548f1ae4477e0e533e1dea",
    "solana-cli-bytes": "28546968",
  };
}

const runtimeIdentityFields = Object.freeze([
  ["runtime-source-head-commit", "runtimeSourceHeadCommit"],
  ["runtime-source-head-tree", "runtimeSourceHeadTree"],
  ["runtime-checkout-commit", "runtimeCheckoutCommit"],
  ["runtime-checkout-tree", "runtimeCheckoutTree"],
  ["runtime-checkout-relation", "runtimeCheckoutRelation"],
  ["runtime-binding-successor-commit", "runtimeBindingSuccessorCommit"],
  ["runtime-binding-successor-tree", "runtimeBindingSuccessorTree"],
  ["runtime-binding-anchor-sha256", "runtimeBindingAnchorSha256"],
  ["runtime-closure-sha256", "runtimeClosureSha256"],
  ["runtime-evidence-manifest-sha256", "runtimeEvidenceManifestSha256"],
  ["runtime-verification-sha256", "runtimeVerificationSha256"],
  ["runtime-ci-run-id", "runtimeCiRunId", Number],
  ["runtime-ci-run-attempt", "runtimeCiRunAttempt", Number],
  ["runtime-workflow-ref", "runtimeWorkflowRef"],
  ["handoff-sha256", "handoffSha256"],
  ["handoff-bytes", "handoffBytes", Number],
  ["reconciler-sha256", "reconcilerSha256"],
  ["reconciler-bytes", "reconcilerBytes", Number],
  ["cas-helper-sha256", "casHelperSha256"],
  ["cas-helper-bytes", "casHelperBytes", Number],
  ["sealed-exec-sha256", "sealedExecSha256"],
  ["sealed-exec-bytes", "sealedExecBytes", Number],
  ["runtime-binding-verifier-sha256", "runtimeBindingVerifierSha256"],
  ["runtime-binding-verifier-bytes", "runtimeBindingVerifierBytes", Number],
  ["toolchain-sha256", "toolchainSha256"],
  ["toolchain-bytes", "toolchainBytes", Number],
  ["sealed-exec-python-path", "sealedExecPythonPath"],
  ["sealed-exec-python-version", "sealedExecPythonVersion"],
  ["sealed-exec-python-sha256", "sealedExecPythonSha256"],
  ["sealed-exec-python-bytes", "sealedExecPythonBytes", Number],
]);

test("CAS requires its exact secure parent/root/sentinel and exact reviewed identity", () => {
  const fixture = provision();
  try {
    const exact = options(fixture.root);
    const available = inspectHandoffReservation(exact, { expectedRoot: fixture.root });
    assert.equal(available.status, "AVAILABLE");
    assert.equal(available.schema, "iat-v2-devnet-buffer-authority-cas-result/v2");
    assert.equal(available.recordSha256, null);
    const runtimeVariant = inspectHandoffReservation({
      ...exact,
      "runtime-verification-sha256": "0".repeat(64),
    }, { expectedRoot: fixture.root });
    assert.equal(runtimeVariant.casKeySha256, available.casKeySha256, "runtime provenance changed the target-keyed CAS key");
    assert.equal(runtimeVariant.recordSha256, null);
    if (process.platform !== "win32") {
      const sentinelAlias = join(fixture.root, "sentinel-alias.json");
      linkSync(fixture.sentinel, sentinelAlias);
      assert.throws(
        () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_SENTINEL_HOLD",
      );
      unlinkSync(sentinelAlias);
    }
    for (const drift of [
      { "artifact-sha256": "8".repeat(64) },
      { "artifact-bytes": "649681" },
      { "source-head-commit": "3".repeat(40) },
      { "ci-run-id": "33029576921" },
      { "runtime-source-head-commit": "z".repeat(40) },
      { "runtime-checkout-relation": "ANCESTOR" },
      { "runtime-evidence-manifest-sha256": "z".repeat(64) },
      { "runtime-verification-sha256": "z".repeat(64) },
      { "runtime-workflow-ref": "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/heads/main" },
      { "handoff-bytes": "0" },
      { "sealed-exec-python-sha256": "4".repeat(64) },
      { "node-sha256": "4".repeat(64) },
      { "git-sha256": "5".repeat(64) },
      { "devnet-genesis-hash": "11111111111111111111111111111111" },
    ]) {
      assert.throws(
        () => inspectHandoffReservation({ ...exact, ...drift }, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_INPUT_HOLD",
      );
    }
    chmodSync(fixture.parent, 0o755);
    if (process.platform !== "win32") {
      assert.throws(
        () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_HOLD",
      );
    }
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("CAS reservation is durable, immutable, and malformed partial records remain HOLD", () => {
  const fixture = provision();
  try {
    const exact = options(fixture.root);
    const created = reserveHandoffMutation(exact, {
      expectedRoot: fixture.root,
      now: () => new Date("2026-08-27T00:00:00.000Z"),
    });
    assert.equal(created.status, "RESERVED_CREATED");
    assert.equal(created.schema, "iat-v2-devnet-buffer-authority-cas-result/v2");
    assert.equal(created.mutationMayRun, true);
    assert.deepEqual(Object.keys(created), [
      "schema",
      "status",
      "casKeySha256",
      "recordPath",
      "recordSha256",
      "mutationReserved",
      "mutationMayRun",
      "reservedAtUtc",
    ]);
    const original = readFileSync(created.recordPath, "utf8");
    const originalSha256 = sha256(original);
    assert.equal(created.recordSha256, originalSha256);
    const record = JSON.parse(original);
    assert.equal(record.schema, "iat-v2-devnet-buffer-authority-attempt/v2");
    for (const [optionName, recordName, convert = String] of runtimeIdentityFields) {
      assert.equal(record[recordName], convert(exact[optionName]), `${recordName} was not durably bound`);
    }
    assert.throws(
      () => inspectHandoffReservation({
        ...exact,
        "runtime-verification-sha256": "0".repeat(64),
      }, { expectedRoot: fixture.root }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_IDENTITY_MISMATCH_HOLD",
    );
    const existing = reserveHandoffMutation(exact, { expectedRoot: fixture.root });
    assert.equal(existing.status, "RESERVED_EXISTING");
    assert.equal(existing.recordSha256, originalSha256);
    assert.equal(readFileSync(created.recordPath, "utf8"), original);
    if (process.platform !== "win32") {
      const recordAlias = join(fixture.root, "record-alias.json");
      linkSync(created.recordPath, recordAlias);
      assert.throws(
        () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_RECORD_HOLD",
      );
      unlinkSync(recordAlias);
    }
    writeFileSync(created.recordPath, '{"partial":', "utf8");
    assert.throws(
      () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_RECORD_HOLD",
    );
    assert.throws(
      () => reserveHandoffMutation(exact, { expectedRoot: fixture.root }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_CREATION_INDETERMINATE_HOLD",
    );
    assert.equal(readFileSync(created.recordPath, "utf8"), '{"partial":');
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("Linux reserve creates and fsyncs through the exact pinned attempts-directory descriptor", {
  skip: process.platform !== "linux",
}, () => {
  const fixture = provision();
  const descriptor = openSync(
    fixture.attempts,
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    assert.equal(IAT_V2_HANDOFF_CAS_ATTEMPTS_FD_ENV, "IAT_V2_HANDOFF_CAS_ATTEMPTS_FD");
    const created = reserveHandoffMutation(options(fixture.root), {
      attemptsDirectoryFd: descriptor,
      expectedRoot: fixture.root,
      now: () => new Date("2026-08-27T00:00:00.000Z"),
    });
    assert.equal(created.status, "RESERVED_CREATED");
    assert.equal(readdirSync(fixture.attempts).length, 1);
    assert.equal(inspectHandoffReservation(options(fixture.root), {
      attemptsDirectoryFd: descriptor,
      expectedRoot: fixture.root,
    }).status, "RESERVED_EXISTING");
  } finally {
    closeSync(descriptor);
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("Linux pinned reserve fails closed when the canonical attempts path is replaced", {
  skip: process.platform !== "linux",
}, () => {
  const fixture = provision();
  const displaced = join(fixture.root, "attempts.displaced");
  const descriptor = openSync(
    fixture.attempts,
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    assert.throws(
      () => reserveHandoffMutation(options(fixture.root), {
        attemptsDirectoryFd: descriptor,
        beforePinnedReserve: () => {
          renameSync(fixture.attempts, displaced);
          mkdirSync(fixture.attempts, { mode: 0o700 });
        },
        expectedRoot: fixture.root,
      }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_HOLD",
    );
    assert.deepEqual(readdirSync(displaced), []);
    assert.deepEqual(readdirSync(fixture.attempts), []);
  } finally {
    closeSync(descriptor);
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("Linux pinned reserve detects an attempts-directory ABA before O_EXCL creation", {
  skip: process.platform !== "linux",
}, () => {
  const fixture = provision();
  const displaced = join(fixture.root, "attempts.displaced");
  const replacement = join(fixture.root, "attempts.replacement");
  mkdirSync(replacement, { mode: 0o700 });
  const descriptor = openSync(
    fixture.attempts,
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    assert.throws(
      () => reserveHandoffMutation(options(fixture.root), {
        attemptsDirectoryFd: descriptor,
        beforePinnedReserve: () => {
          renameSync(fixture.attempts, displaced);
          renameSync(replacement, fixture.attempts);
          renameSync(fixture.attempts, replacement);
          renameSync(displaced, fixture.attempts);
        },
        expectedRoot: fixture.root,
      }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_HOLD",
    );
    assert.deepEqual(readdirSync(fixture.attempts), []);
    assert.deepEqual(readdirSync(replacement), []);
  } finally {
    closeSync(descriptor);
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("Linux pinned reserve detects attempts-directory ctime drift before O_EXCL creation", {
  skip: process.platform !== "linux",
}, () => {
  const fixture = provision();
  const descriptor = openSync(
    fixture.attempts,
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    assert.throws(
      () => reserveHandoffMutation(options(fixture.root), {
        attemptsDirectoryFd: descriptor,
        beforePinnedReserve: () => {
          const transient = join(fixture.attempts, "transient-entry");
          writeFileSync(transient, "ctime drift\n", { mode: 0o600 });
          unlinkSync(transient);
        },
        expectedRoot: fixture.root,
      }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_HOLD",
    );
    assert.deepEqual(readdirSync(fixture.attempts), []);
  } finally {
    closeSync(descriptor);
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("CAS CLI stdout is one exact compact result-v2 JSON line", {
  skip: process.version !== "v24.19.0"
    || (process.platform !== "win32" && process.getuid?.() !== 1000),
}, async () => {
  const fixture = provision();
  const helperProject = mkdtempSync(join(homedir(), ".iat-v2-cas-cli-project-"));
  try {
    const scripts = join(helperProject, "scripts");
    mkdirSync(scripts, { mode: 0o700 });
    const productionPath = resolve("scripts/iat-v2-devnet-buffer-handoff-cas.mjs");
    const helperPath = join(scripts, "iat-v2-devnet-buffer-handoff-cas.mjs");
    const productionSource = readFileSync(productionPath, "utf8");
    const reviewedRootDeclaration = "const EXPECTED_CAS_ROOT = \"/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1\";";
    assert.equal(productionSource.includes(reviewedRootDeclaration), true);
    writeFileSync(
      helperPath,
      productionSource.replace(
        reviewedRootDeclaration,
        `const EXPECTED_CAS_ROOT = ${JSON.stringify(fixture.root)};`,
      ),
      { mode: 0o600 },
    );
    const args = [helperPath, "inspect"];
    for (const [name, value] of Object.entries(options(fixture.root))) args.push(`--${name}`, value);
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
      !["BASH_ENV", "ENV", "LD_LIBRARY_PATH", "LD_PRELOAD", "NODE_OPTIONS", "NODE_PATH"].includes(name)
      && !name.startsWith("GIT_")
    )));
    const child = await new Promise((resolveChild, rejectChild) => {
      const childProcess = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      childProcess.stdout.setEncoding("utf8");
      childProcess.stderr.setEncoding("utf8");
      childProcess.stdout.on("data", (chunk) => { stdout += chunk; });
      childProcess.stderr.on("data", (chunk) => { stderr += chunk; });
      childProcess.on("error", rejectChild);
      childProcess.on("close", (code) => resolveChild({ code, stdout, stderr }));
    });
    assert.equal(child.code, 0, child.stderr);
    assert.equal(child.stderr, "");
    const value = JSON.parse(child.stdout);
    assert.equal(child.stdout, `${JSON.stringify(value)}\n`);
    assert.deepEqual(Object.keys(value), [
      "schema",
      "status",
      "casKeySha256",
      "recordPath",
      "recordSha256",
      "mutationReserved",
      "mutationMayRun",
      "reservedAtUtc",
    ]);
    assert.equal(value.schema, "iat-v2-devnet-buffer-authority-cas-result/v2");
    assert.equal(value.status, "AVAILABLE");
    assert.equal(value.recordSha256, null);
  } finally {
    rmSync(helperProject, { recursive: true, force: true });
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("CAS CLI error-v2 distinguishes inspect, invalid, and conservatively unknown reserve failures", {
  skip: process.version !== "v24.19.0"
    || (process.platform !== "win32" && process.getuid?.() !== 1000),
}, async () => {
  const fixture = provision();
  const helperProject = mkdtempSync(join(homedir(), ".iat-v2-cas-error-cli-project-"));
  try {
    const scripts = join(helperProject, "scripts");
    mkdirSync(scripts, { mode: 0o700 });
    const productionPath = resolve("scripts/iat-v2-devnet-buffer-handoff-cas.mjs");
    const helperPath = join(scripts, "iat-v2-devnet-buffer-handoff-cas.mjs");
    const productionSource = readFileSync(productionPath, "utf8");
    const reviewedRootDeclaration = "const EXPECTED_CAS_ROOT = \"/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1\";";
    assert.equal(productionSource.includes(reviewedRootDeclaration), true);
    writeFileSync(
      helperPath,
      productionSource.replace(
        reviewedRootDeclaration,
        `const EXPECTED_CAS_ROOT = ${JSON.stringify(fixture.root)};`,
      ),
      { mode: 0o600 },
    );
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
      !["BASH_ENV", "ENV", "LD_LIBRARY_PATH", "LD_PRELOAD", "NODE_OPTIONS", "NODE_PATH"].includes(name)
      && !name.startsWith("GIT_")
    )));
    const run = (operation, suppliedOptions = null) => {
      const args = [helperPath, operation];
      if (suppliedOptions !== null) {
        for (const [name, value] of Object.entries(suppliedOptions)) args.push(`--${name}`, value);
      }
      return new Promise((resolveChild, rejectChild) => {
        const childProcess = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        childProcess.stdout.setEncoding("utf8");
        childProcess.stderr.setEncoding("utf8");
        childProcess.stdout.on("data", (chunk) => { stdout += chunk; });
        childProcess.stderr.on("data", (chunk) => { stderr += chunk; });
        childProcess.on("error", rejectChild);
        childProcess.on("close", (code) => resolveChild({ code, stdout, stderr }));
      });
    };

    const inspectFailure = await run("inspect", {
      ...options(fixture.root),
      "artifact-bytes": "0",
    });
    const invalidFailure = await run("delete");
    const reserveFailure = await run("reserve", options(fixture.root));
    for (const child of [inspectFailure, invalidFailure, reserveFailure]) {
      assert.equal(child.code, 2);
      assert.equal(child.stdout, "");
      const value = JSON.parse(child.stderr);
      assert.equal(child.stderr, `${JSON.stringify(value)}\n`);
      assert.deepEqual(Object.keys(value), [
        "schema",
        "status",
        "operation",
        "code",
        "message",
        "reservationState",
        "reservationCreatedByInvocation",
        "reservationMayExist",
        "mutationMayRun",
      ]);
      assert.equal(value.schema, "iat-v2-devnet-buffer-authority-cas-error/v2");
      assert.equal(value.status, "HOLD");
      assert.equal(value.mutationMayRun, false);
    }
    const inspectValue = JSON.parse(inspectFailure.stderr);
    assert.equal(inspectValue.operation, "inspect");
    assert.equal(inspectValue.code, "CAS_INPUT_HOLD");
    assert.equal(inspectValue.reservationState, "NOT_CREATED_BY_THIS_INVOCATION");
    assert.equal(inspectValue.reservationCreatedByInvocation, false);
    assert.equal(inspectValue.reservationMayExist, true);
    const invalidValue = JSON.parse(invalidFailure.stderr);
    assert.equal(invalidValue.operation, "invalid");
    assert.equal(invalidValue.code, "CAS_USAGE");
    assert.equal(invalidValue.reservationState, "NOT_CREATED_BY_THIS_INVOCATION");
    assert.equal(invalidValue.reservationCreatedByInvocation, false);
    assert.equal(invalidValue.reservationMayExist, null);
    const reserveValue = JSON.parse(reserveFailure.stderr);
    assert.equal(reserveValue.operation, "reserve");
    assert.equal(reserveValue.code, "CAS_RUNTIME_HOLD");
    assert.equal(reserveValue.reservationState, "UNKNOWN");
    assert.equal(reserveValue.reservationCreatedByInvocation, null);
    assert.equal(reserveValue.reservationMayExist, true);
  } finally {
    rmSync(helperProject, { recursive: true, force: true });
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("two separate Node processes can create at most one reservation", async () => {
  const fixture = provision();
  try {
    const helperUrl = pathToFileURL(resolve("scripts/iat-v2-devnet-buffer-handoff-cas.mjs")).href;
    const worker = join(fixture.parent, "worker.mjs");
    writeFileSync(worker, `
      import { reserveHandoffMutation } from ${JSON.stringify(helperUrl)};
      const value = JSON.parse(Buffer.from(process.argv[2], "base64url").toString("utf8"));
      const result = reserveHandoffMutation(value.options, {
        expectedRoot: value.root,
        now: () => new Date("2026-08-27T01:02:03.000Z"),
      });
      process.stdout.write(\`\${JSON.stringify(result)}\\n\`);
    `, "utf8");
    const payload = Buffer.from(JSON.stringify({ root: fixture.root, options: options(fixture.root) })).toString("base64url");
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
      !["BASH_ENV", "ENV", "LD_LIBRARY_PATH", "LD_PRELOAD", "NODE_OPTIONS", "NODE_PATH"].includes(name)
      && !name.startsWith("GIT_")
    )));
    const run = () => new Promise((resolveChild, rejectChild) => {
      const child = spawn(process.execPath, [worker, payload], { env, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", rejectChild);
      child.on("close", (code) => resolveChild({ code, stdout, stderr }));
    });
    const children = await Promise.all([run(), run()]);
    const successful = children.filter((child) => child.code === 0);
    const held = children.filter((child) => child.code !== 0);
    assert.ok(successful.length >= 1 && successful.length <= 2);
    for (const child of held) {
      assert.equal(child.stdout, "");
      assert.match(child.stderr, /CAS_ROOT_HOLD|changed metadata after the attempts directory was prepared/u);
    }
    const values = [];
    for (const child of successful) {
      const value = JSON.parse(child.stdout);
      values.push(value);
      assert.equal(child.stdout, `${JSON.stringify(value)}\n`, "CAS stdout was not one exact compact JSON line");
      assert.equal(value.schema, "iat-v2-devnet-buffer-authority-cas-result/v2");
    }
    const durableRecordSha256 = sha256(readFileSync(values[0].recordPath));
    for (const value of values) assert.equal(value.recordSha256, durableRecordSha256);
    const statuses = values.map((value) => value.status).sort();
    assert.equal(statuses.filter((status) => status === "RESERVED_CREATED").length, 1);
    assert.equal(statuses.every((status) => status === "RESERVED_CREATED" || status === "RESERVED_EXISTING"), true);
    assert.equal(readdirSync(fixture.attempts).length, 1);
    const observed = inspectHandoffReservation(options(fixture.root), { expectedRoot: fixture.root });
    assert.equal(observed.status, "RESERVED_EXISTING");
    assert.equal(observed.recordSha256, durableRecordSha256);
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

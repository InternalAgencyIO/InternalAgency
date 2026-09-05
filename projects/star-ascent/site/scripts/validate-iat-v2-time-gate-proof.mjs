#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BOUND_COMMIT = "b73d2d3ce8572e833b9fdd37df23cd97b40df111";
const BOUND_TREE = "faa4f1c9ddcd78ddaeabed5616b815022ddcd613";
const BOUND_PROOF_SHA256 = "8453aa583e95477088ebca3baebbf2c2ff5df3e4f36b740d2ae09d3254e87734";
const PUBLIC_EVIDENCE_PATH =
  "public/evidence/iat-v2/v2-local-time-gate-proof-hardening-20260802T130622Z.json";
const INPUT_PATHS = Object.freeze([
  "programs/iat_v2/src/lib.rs",
  "programs/iat_v2/src/policy.rs",
  "programs/iat_v2/tests/time_warp.rs",
  "engagement/iat-economic-policy.v2.json",
  "engagement/iat-v2-reference-engine.mjs",
  "tests/iat-v2-reference-engine.test.mjs",
]);
const COMMANDS = Object.freeze([
  Object.freeze({
    command: "cargo test --locked --test time_warp -- --nocapture",
    result: "PASS",
    tests: 6,
  }),
  Object.freeze({
    command: "node --test tests/iat-v2-reference-engine.test.mjs",
    result: "PASS",
    tests: 16,
  }),
]);

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = path.join(siteRoot, "launch/iat-v2-local-time-gate-proof.json");
const canonicalBytes = await readFile(canonicalPath);
const proof = JSON.parse(canonicalBytes.toString("utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalizeUtf8 = (bytes) => Buffer.from(
  bytes.toString("utf8").replaceAll("\r\n", "\n"),
  "utf8",
);
const git = (args, encoding = "buffer") => execFileSync("git", args, {
  encoding,
  maxBuffer: 50_000_000,
  stdio: ["ignore", "pipe", "pipe"],
});

async function replayBoundReferenceTest(boundInputs) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "iat-v2-time-gate-b73d-"));
  try {
    for (const relativePath of INPUT_PATHS) {
      const destination = path.join(sandbox, ...relativePath.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, boundInputs.get(relativePath));
    }
    const result = spawnSync(
      process.execPath,
      ["--test", "--test-reporter=tap", path.join(sandbox, "tests/iat-v2-reference-engine.test.mjs")],
      {
        cwd: sandbox,
        encoding: "utf8",
        env: { ...process.env, NODE_OPTIONS: "" },
        windowsHide: true,
      },
    );
    check(result.status === 0, "isolated bound JS reference replay failed");
    check(/^# tests 16$/mu.test(result.stdout ?? ""), "isolated bound JS replay test count drifted");
    check(/^# pass 16$/mu.test(result.stdout ?? ""), "isolated bound JS replay did not pass all tests");
    check(/^# fail 0$/mu.test(result.stdout ?? ""), "isolated bound JS replay recorded a failure");
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

check(proof.schema === "iat-v2-local-time-gate-proof/v1", "unexpected proof schema");
check(proof.status === "VERIFIED_LOCAL_HOST_ONLY", "time-gate proof is not verified");
check(proof.network === "local-host", "time-gate proof must remain local-only");
check(proof.mainnetStatus === "HOLD", "time-gate proof must preserve Mainnet HOLD");
check(
  proof.sourceBinding?.commit === BOUND_COMMIT
    && proof.sourceBinding?.gitTree === BOUND_TREE
    && proof.sourceBinding?.allInputsMatchCommit === true,
  "time-gate proof source binding drift",
);
check(
  proof.method?.kind === "DETERMINISTIC_VIRTUAL_CLOCK_OVER_EXACT_PROGRAM_POLICY",
  "unexpected proof method",
);
for (const field of [
  "localValidatorTransactionUsed",
  "signingPerformed",
  "simulationForSigningPerformed",
  "broadcastingPerformed",
  "walletAccessed",
  "keyCreated",
]) {
  check(proof.method?.[field] === false, `unsafe method flag changed: ${field}`);
}
check(
  proof.reviewedProgramArtifact?.sha256
      === "d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4"
    && proof.reviewedProgramArtifact?.bytes === 579480
    && proof.reviewedProgramArtifact?.sourceCommit === BOUND_COMMIT
    && proof.reviewedProgramArtifact?.artifactEmbedded === false,
  "reviewed historical program artifact binding drift",
);

// V1 is immutable historical evidence. This byte pin locks every ordered vector,
// expected result, limitation, safety flag, and field without duplicating the
// 39-vector fixture in validator source.
check(
  sha256(canonicalBytes) === BOUND_PROOF_SHA256,
  "canonical historical proof SHA-256 drifted; exact ordered vectors/cases are immutable",
);
check(proof.publicEvidencePath === PUBLIC_EVIDENCE_PATH, "historical public proof path drift");
try {
  const publicBytes = await readFile(path.join(siteRoot, ...PUBLIC_EVIDENCE_PATH.split("/")));
  check(Buffer.compare(canonicalBytes, publicBytes) === 0, "launch and public proof bytes differ");
} catch {
  check(false, "historical public proof is missing or unreadable");
}

try {
  check(
    git(["rev-parse", `${BOUND_COMMIT}^{tree}`], "utf8").trim() === BOUND_TREE,
    "bound source commit tree drift",
  );
} catch {
  check(false, `bound source commit is unavailable: ${BOUND_COMMIT}`);
}

const inputs = Array.isArray(proof.inputs) ? proof.inputs : [];
check(
  inputs.length === INPUT_PATHS.length
    && new Set(inputs.map(({ path: inputPath }) => inputPath)).size === INPUT_PATHS.length
    && inputs.every((input, index) => input?.path === INPUT_PATHS[index]),
  "expected exact ordered unique six-input historical inventory",
);
const boundInputs = new Map();
for (let index = 0; index < INPUT_PATHS.length; index += 1) {
  const expectedPath = INPUT_PATHS[index];
  const input = inputs[index];
  let committed;
  try {
    committed = normalizeUtf8(git([
      "show",
      `${BOUND_COMMIT}:projects/star-ascent/site/${expectedPath}`,
    ]));
    boundInputs.set(expectedPath, committed);
  } catch {
    check(false, `bound source input unavailable at ${BOUND_COMMIT}: ${expectedPath}`);
    continue;
  }
  check(input?.path === expectedPath, `input path drift at historical index ${index}`);
  check(input?.normalization === "UTF8_LF", `input normalization drift: ${expectedPath}`);
  check(input?.bytes === committed.length, `input byte count drift: ${expectedPath}`);
  check(input?.sha256 === sha256(committed), `input hash drift: ${expectedPath}`);
}

check(
  sameJson(proof.commands, COMMANDS),
  "expected exact nonempty ordered historical command inventory, PASS results, and test counts",
);
check(
  proof.observations?.clockCases?.length === 6
    && proof.observations?.cccCases?.length === 4
    && proof.observations?.recoveryCases?.length === 2
    && proof.observations?.neutralRewardCases?.length === 3
    && proof.observations?.laneCases?.length === 24
    && proof.observations?.positionCase,
  "historical ordered 39-vector and position inventory drift",
);

if (boundInputs.size === INPUT_PATHS.length) {
  await replayBoundReferenceTest(boundInputs);
} else {
  check(false, "isolated reference replay requires all six exact bound inputs");
}

if (failures.length) {
  console.error("IAT V2 local time-gate proof validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("IAT V2 historical local time-gate proof validation passed: exact b73d2d3 inputs were materialized in isolation and the bound 16-test JS reference suite replayed; immutable 6-test Rust receipt and 39 ordered vectors remain local-only; no signing or broadcast; Mainnet remains HOLD.");

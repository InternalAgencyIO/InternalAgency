#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(siteRoot, "../../..");
const sandboxRoot = await mkdtemp(path.join(os.tmpdir(), "iat-v2-time-gate-proof-"));
const sandboxScript = path.join(sandboxRoot, "scripts/validate-iat-v2-time-gate-proof.mjs");
const sandboxCanonical = path.join(sandboxRoot, "launch/iat-v2-local-time-gate-proof.json");
const expectedPublicEvidencePath =
  "public/evidence/iat-v2/v2-local-time-gate-proof-hardening-20260802T130622Z.json";
const canonicalProof = JSON.parse(await readFile(
  path.join(siteRoot, "launch/iat-v2-local-time-gate-proof.json"),
  "utf8",
));
const sandboxPublic = path.resolve(sandboxRoot, ...expectedPublicEvidencePath.split("/"));
const sandboxPrefix = `${path.resolve(sandboxRoot)}${path.sep}`;
if (!sandboxPublic.startsWith(sandboxPrefix)) {
  throw new Error("time-gate regression public fixture escaped its temporary sandbox");
}

async function writeProof(proof) {
  const bytes = `${JSON.stringify(proof, null, 2)}\n`;
  await writeFile(sandboxCanonical, bytes, "utf8");
  await writeFile(sandboxPublic, bytes, "utf8");
}

function runValidator() {
  return spawnSync(process.execPath, [sandboxScript], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

function mutatedProof(mutate) {
  const proof = structuredClone(canonicalProof);
  mutate(proof);
  return proof;
}

try {
  await Promise.all([
    mkdir(path.dirname(sandboxScript), { recursive: true }),
    mkdir(path.dirname(sandboxCanonical), { recursive: true }),
    mkdir(path.dirname(sandboxPublic), { recursive: true }),
    mkdir(path.join(sandboxRoot, "engagement"), { recursive: true }),
    mkdir(path.join(sandboxRoot, "tests"), { recursive: true }),
  ]);
  await copyFile(path.join(siteRoot, "scripts/validate-iat-v2-time-gate-proof.mjs"), sandboxScript);

  // No live input path is needed. The immutable v1 proof remains valid only
  // because the validator materializes all executable bytes from b73d in a new
  // isolated directory, never from this sandbox or the current worktree.
  await writeProof(canonicalProof);
  const baseline = runValidator();
  assert.equal(baseline.status, 0, `${baseline.stdout}\n${baseline.stderr}`);
  assert.match(baseline.stdout, /exact b73d2d3 inputs were materialized in isolation/u);

  await Promise.all([
    writeFile(
      path.join(sandboxRoot, "engagement/iat-v2-reference-engine.mjs"),
      'throw new Error("LIVE_ENGINE_MUST_NEVER_EXECUTE");\n',
      "utf8",
    ),
    writeFile(
      path.join(sandboxRoot, "engagement/iat-economic-policy.v2.json"),
      "this is not JSON\n",
      "utf8",
    ),
    writeFile(
      path.join(sandboxRoot, "tests/iat-v2-reference-engine.test.mjs"),
      'throw new Error("LIVE_TEST_MUST_NEVER_EXECUTE");\n',
      "utf8",
    ),
  ]);
  const liveSubstitution = runValidator();
  assert.equal(
    liveSubstitution.status,
    0,
    `live-source substitution influenced bound execution:\n${liveSubstitution.stdout}\n${liveSubstitution.stderr}`,
  );
  assert.doesNotMatch(
    `${liveSubstitution.stdout}\n${liveSubstitution.stderr}`,
    /LIVE_(?:ENGINE|TEST)_MUST_NEVER_EXECUTE|not JSON/u,
  );

  const cases = [
    {
      name: "byte count",
      proof: mutatedProof((proof) => { proof.inputs[0].bytes += 1; }),
      diagnostic: /input byte count drift: programs\/iat_v2\/src\/lib\.rs/u,
    },
    {
      name: "digest",
      proof: mutatedProof((proof) => { proof.inputs[0].sha256 = "0".repeat(64); }),
      diagnostic: /input hash drift: programs\/iat_v2\/src\/lib\.rs/u,
    },
    {
      name: "normalization",
      proof: mutatedProof((proof) => { proof.inputs[0].normalization = "RAW"; }),
      diagnostic: /input normalization drift: programs\/iat_v2\/src\/lib\.rs/u,
    },
    {
      name: "missing input substitution",
      proof: mutatedProof((proof) => { proof.inputs[0].path = "programs/iat_v2/src/missing.rs"; }),
      diagnostic: /expected exact ordered unique six-input historical inventory/u,
    },
    {
      name: "path escape",
      proof: mutatedProof((proof) => { proof.inputs[0].path = "../outside.rs"; }),
      diagnostic: /expected exact ordered unique six-input historical inventory/u,
    },
    {
      name: "public evidence path escape",
      proof: mutatedProof((proof) => { proof.publicEvidencePath = "../../../../outside.json"; }),
      diagnostic: /historical public proof path drift/u,
    },
    {
      name: "duplicate input",
      proof: mutatedProof((proof) => { proof.inputs[1] = structuredClone(proof.inputs[0]); }),
      diagnostic: /expected exact ordered unique six-input historical inventory/u,
    },
    {
      name: "reordered inputs",
      proof: mutatedProof((proof) => { [proof.inputs[0], proof.inputs[1]] = [proof.inputs[1], proof.inputs[0]]; }),
      diagnostic: /expected exact ordered unique six-input historical inventory/u,
    },
    {
      name: "empty command inventory",
      proof: mutatedProof((proof) => { proof.commands = []; }),
      diagnostic: /expected exact nonempty ordered historical command inventory, PASS results, and test counts/u,
    },
    {
      name: "duplicate command receipt",
      proof: mutatedProof((proof) => { proof.commands[1] = structuredClone(proof.commands[0]); }),
      diagnostic: /expected exact nonempty ordered historical command inventory, PASS results, and test counts/u,
    },
    {
      name: "command result",
      proof: mutatedProof((proof) => { proof.commands[0].result = "FAIL"; }),
      diagnostic: /expected exact nonempty ordered historical command inventory, PASS results, and test counts/u,
    },
    {
      name: "command test count",
      proof: mutatedProof((proof) => { proof.commands[1].tests = 15; }),
      diagnostic: /expected exact nonempty ordered historical command inventory, PASS results, and test counts/u,
    },
    {
      name: "duplicate clock vector",
      proof: mutatedProof((proof) => { proof.observations.clockCases[1] = structuredClone(proof.observations.clockCases[0]); }),
      diagnostic: /canonical historical proof SHA-256 drifted; exact ordered vectors\/cases are immutable/u,
    },
    {
      name: "duplicate CCC vector",
      proof: mutatedProof((proof) => { proof.observations.cccCases[1] = structuredClone(proof.observations.cccCases[0]); }),
      diagnostic: /canonical historical proof SHA-256 drifted; exact ordered vectors\/cases are immutable/u,
    },
    {
      name: "duplicate recovery vector",
      proof: mutatedProof((proof) => { proof.observations.recoveryCases[1] = structuredClone(proof.observations.recoveryCases[0]); }),
      diagnostic: /canonical historical proof SHA-256 drifted; exact ordered vectors\/cases are immutable/u,
    },
    {
      name: "duplicate neutral-reward vector",
      proof: mutatedProof((proof) => { proof.observations.neutralRewardCases[1] = structuredClone(proof.observations.neutralRewardCases[0]); }),
      diagnostic: /canonical historical proof SHA-256 drifted; exact ordered vectors\/cases are immutable/u,
    },
    {
      name: "duplicate lane vector",
      proof: mutatedProof((proof) => { proof.observations.laneCases[1] = structuredClone(proof.observations.laneCases[0]); }),
      diagnostic: /canonical historical proof SHA-256 drifted; exact ordered vectors\/cases are immutable/u,
    },
    {
      name: "position vector",
      proof: mutatedProof((proof) => { proof.observations.positionCase.exactBoundaryResult.paidReward = "0"; }),
      diagnostic: /canonical historical proof SHA-256 drifted; exact ordered vectors\/cases are immutable/u,
    },
  ];

  for (const testCase of cases) {
    await writeProof(testCase.proof);
    const result = runValidator();
    assert.equal(result.status, 1, `${testCase.name} mutation did not fail closed`);
    assert.match(result.stderr, testCase.diagnostic, `${testCase.name} diagnostic drift`);
  }
} finally {
  await rm(sandboxRoot, { recursive: true, force: true });
}

console.log("IAT V2 historical time-gate proof regression passed: live-source substitution is ignored; exact ordered input, command, vector, position, byte-count, digest, and normalization mutations fail closed.");

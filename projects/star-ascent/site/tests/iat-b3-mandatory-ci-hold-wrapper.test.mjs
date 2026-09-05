import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

import {
  assertIatB3MandatoryCiExpectedHold,
} from "../scripts/assert-iat-b3-mandatory-ci-hold.mjs";
import {
  IAT_B3_MANDATORY_CI_GATES,
  runIatB3MandatoryCiGateCanonical,
} from "../scripts/run-iat-b3-mandatory-ci-gate.mjs";

const scriptPath = resolve("scripts/assert-iat-b3-mandatory-ci-hold.mjs");

test("every canonical mandatory gate is accepted only as exact nonauthorizing HOLD", async () => {
  for (const gate of Object.keys(IAT_B3_MANDATORY_CI_GATES)) {
    const report = await runIatB3MandatoryCiGateCanonical(gate);
    assert.equal(assertIatB3MandatoryCiExpectedHold(report, gate), report);
  }
});

test("READY, execution, and diagnostic-error relabels fail closed", async () => {
  const gate = "ci-manifest";
  const report = structuredClone(await runIatB3MandatoryCiGateCanonical(gate));
  for (const mutate of [
    (value) => { value.status = "READY"; },
    (value) => { value.processStarted = true; },
    (value) => { value.diagnostic.reason = "CANONICAL_HOLD"; },
    (value) => { value.blockers = []; },
    (value) => { value.testSourceIdentity[0].sha256 = "f"; },
  ]) {
    const candidate = structuredClone(report);
    mutate(candidate);
    assert.throws(
      () => assertIatB3MandatoryCiExpectedHold(candidate, gate),
      /IAT_B3_MANDATORY_CI_EXPECTED_HOLD_INVALID/u,
    );
  }
});

test("the CI wrapper exits zero only for an exact canonical gate argument", () => {
  const accepted = spawnSync(process.execPath, [scriptPath, "ci-manifest"], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.stderr, "");
  const report = JSON.parse(accepted.stdout);
  assert.equal(report.status, "HOLD");
  assert.equal(report.exitCode, 2);
  assert.equal(report.ready, false);
  assert.equal(report.complete, false);
  assert.equal(report.authorized, false);

  const rejected = spawnSync(process.execPath, [scriptPath], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /IAT_B3_MANDATORY_CI_GATE_EXACT_ARGUMENT_REQUIRED_HOLD/u);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  OWNER_GATE_POLICY_PREDICATE_MIGRATIONS,
  loadOwnerGatePolicyDecisionInputs,
  parseOwnerGatePolicyDecisionJson,
  validateOwnerGatePolicyDecision,
} from "../scripts/validate-iat-b3-owner-gate-policy-decision.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CLI_PATH = fileURLToPath(new URL(
  "../scripts/validate-iat-b3-owner-gate-policy-decision.mjs",
  import.meta.url,
));

function canonicalInputs() {
  return loadOwnerGatePolicyDecisionInputs();
}

function cloneInputs() {
  const inputs = canonicalInputs();
  return {
    ...inputs,
    packet: structuredClone(inputs.packet),
    graph: structuredClone(inputs.graph),
    ownerPolicyFreeze: structuredClone(inputs.ownerPolicyFreeze),
  };
}

function assertNonauthorizingHold(result) {
  assert.equal(result.graphMigrationApplied, result.valid);
  assert.equal(result.repositoryPolicyEditSignatureRequired, false);
  assert.equal(result.graphPredicatesSatisfied, false);
  assert.equal(result.automatedEvidenceVerified, false);
  assert.equal(result.ownerDecisionAuthorized, false);
  assert.equal(result.trezorModelTConfirmationObserved, false);
  assert.equal(result.effective, result.valid);
  assert.equal(result.devnetAuthorized, false);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
}

test("canonical owner-gate repository policy is source-bound, applied, and nonauthorizing", () => {
  const inputs = canonicalInputs();
  const result = validateOwnerGatePolicyDecision(inputs);
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.policyCandidateStructurallyValid, true);
  assert.equal(result.sourceBindingsValidated, true);
  assert.equal(result.conflictingPredicateCount, 7);
  assert.deepEqual(result.violations, []);
  assertNonauthorizingHold(result);

  assert.equal(inputs.packet.status, "REPOSITORY_POLICY_APPLIED_HOLD");
  assert.equal(inputs.packet.authorization.state, "REPOSITORY_POLICY_APPLIED_NO_CRYPTOGRAPHIC_SIGNATURE_REQUIRED");
  assert.equal(inputs.packet.authorization.repositoryPolicyEditSignatureRequired, false);
  assert.equal(inputs.packet.authorization.effective, true);
  assert.equal(inputs.packet.migrationBoundary.state, "APPLIED_TO_CANONICAL_GRAPH");
  assert.equal(inputs.packet.migrationBoundary.currentGraphRemainsAuthoritative, true);
  assert.equal(inputs.packet.migrationBoundary.policyCandidateOverridesGraph, false);
  assert.equal(inputs.graph.status, "BLOCKED");
  assert.equal(inputs.graph.mainnetStatus, "HOLD");
  assert.equal(inputs.ownerPolicyFreeze.status, "BLOCKED");
  assert.equal(inputs.ownerPolicyFreeze.ownerAcceptance, null);
  assert.equal(inputs.ownerPolicyFreeze.assurance.mainnetStatus, "HOLD");
});

test("Trezor Model T is the only human gate and direct evidence never substitutes an observation", () => {
  const { packet } = canonicalInputs();
  assert.deepEqual(packet.policy.humanGate, {
    count: 1,
    soleGate: "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION",
    deviceModel: "TREZOR_MODEL_T",
    appliesTo: "EVERY_REQUIRED_CRYPTOGRAPHIC_SIGNATURE",
    otherHumanApprovalGatePermitted: false,
    independentHumanReviewerPrerequisitePermitted: false,
    nativeHumanReviewerPrerequisitePermitted: false,
  });
  assert.equal(packet.policy.nonSignatureGateClosure.automatedDirectEvidenceMayClose, true);
  assert.equal(packet.policy.nonSignatureGateClosure.directObservationRequired, true);
  assert.equal(packet.policy.nonSignatureGateClosure.assertionOnlyEvidenceMayClose, false);
  assert.equal(packet.policy.nonSignatureGateClosure.inferredEvidenceMayClose, false);
  assert.equal(packet.policy.nonSignatureGateClosure.humanReviewPrerequisitePermitted, false);
  for (const disposition of ["unobserved", "partiallyObserved", "stale", "contradictory", "invalid"]) {
    assert.equal(packet.policy.claimDisposition[disposition], "HOLD", disposition);
  }
});

test("all seven conflicting or ambiguous predicates have exact applied BLOCKED migrations", () => {
  const { packet, graph } = canonicalInputs();
  assert.deepEqual(packet.predicateMigrations, OWNER_GATE_POLICY_PREDICATE_MIGRATIONS);
  assert.equal(packet.predicateMigrations.filter(({ gateClass }) => gateClass === "SIGNATURE").length, 1);
  assert.equal(packet.predicateMigrations.filter(({ gateClass }) => gateClass === "NON_SIGNATURE").length, 6);

  for (const migration of packet.predicateMigrations) {
    const currentNode = graph.nodes.find(({ id }) => id === migration.proposedNodeId);
    assert.ok(currentNode, migration.proposedNodeId);
    assert.equal(currentNode.status, "BLOCKED", migration.proposedNodeId);
    assert.equal(currentNode.completionPredicate, migration.proposedPredicate, migration.proposedNodeId);
    assert.equal(currentNode.completionEvidence, null, migration.proposedNodeId);
    assert.equal(migration.migrationState, "APPLIED_TO_CANONICAL_GRAPH", migration.nodeId);
    assert.equal(migration.completionClaimed, false, migration.nodeId);
  }

  const nativeReview = packet.predicateMigrations.find(({ nodeId }) => nodeId === "LOCALIZATION_EVIDENCE");
  assert.equal(nativeReview.currentPredicate, "ALL_50_LOCALES_ACCEPTED_NATIVE_REVIEW_PACKET");
  assert.equal(nativeReview.proposedPredicate, "ALL_50_LOCALE_CLAIMS_AUTOMATED_DIRECT_EVIDENCE_PACKET");

  const independentReview = packet.predicateMigrations.find(
    ({ nodeId }) => nodeId === "INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW",
  );
  assert.equal(independentReview.proposedNodeId, "AUTOMATED_SECURITY_ECONOMIC_PRIVACY_LEGAL_EVIDENCE");
  assert.equal(independentReview.proposedPredicate, "AUTOMATED_MULTI_DOMAIN_DIRECT_EVIDENCE_PACKET");
  assert.equal(
    graph.nodes.some(({ id }) => id === independentReview.proposedNodeId),
    true,
    "renamed automated evidence node must exist after migration",
  );
  assert.equal(graph.nodes.some(({ id }) => id === independentReview.nodeId), false);
  assert.equal(
    graph.edges.filter(([, to]) => to === independentReview.proposedNodeId).length,
    packet.topologyMigration.renamedNode.expectedIncomingEdgeCount,
  );
  assert.equal(
    graph.edges.filter(([from]) => from === independentReview.proposedNodeId).length,
    packet.topologyMigration.renamedNode.expectedOutgoingEdgeCount,
  );
});

test("policy weakening, alternate human gates, and self-authorization fail closed", () => {
  const mutators = [
    (packet) => { packet.policy.humanGate.deviceModel = "OTHER_DEVICE"; },
    (packet) => { packet.policy.humanGate.count = 2; },
    (packet) => { packet.policy.humanGate.independentHumanReviewerPrerequisitePermitted = true; },
    (packet) => { packet.policy.humanGate.nativeHumanReviewerPrerequisitePermitted = true; },
    (packet) => { packet.policy.nonSignatureGateClosure.directObservationRequired = false; },
    (packet) => { packet.policy.nonSignatureGateClosure.assertionOnlyEvidenceMayClose = true; },
    (packet) => { packet.policy.claimDisposition.unobserved = "READY"; },
    (packet) => { packet.migrationBoundary.state = "APPLIED"; },
    (packet) => { packet.predicateMigrations[0].completionClaimed = true; },
    (packet) => { packet.authorization.ownerDecisionAuthenticated = true; },
    (packet) => { packet.authorization.effective = false; },
    (packet) => { packet.assurance.ownerDecisionAuthorized = true; },
  ];
  for (const mutate of mutators) {
    const inputs = cloneInputs();
    mutate(inputs.packet);
    const result = validateOwnerGatePolicyDecision(inputs);
    assert.equal(result.valid, false);
    assert.ok(result.violations.length > 0);
    assertNonauthorizingHold(result);
  }
});

test("source graph, predicate, topology, and legacy-freeze drift fail closed", () => {
  {
    const inputs = cloneInputs();
    inputs.graph.nodes.find(({ id }) => id === "LOCALIZATION_EVIDENCE").completionPredicate =
      "ALL_50_LOCALES_ACCEPTED_NATIVE_REVIEW_PACKET";
    inputs.graphBytes = Buffer.from(JSON.stringify(inputs.graph));
    const result = validateOwnerGatePolicyDecision(inputs);
    assert.equal(result.valid, false);
    assert.match(result.violations.join("\n"), /releaseDependencyGraph/iu);
    assertNonauthorizingHold(result);
  }
  {
    const inputs = cloneInputs();
    inputs.graph.edges = inputs.graph.edges.filter(
      ([from, to]) => from !== "RELEASE_SURFACE_PUBLIC_CLAIMS"
        || to !== "AUTOMATED_SECURITY_ECONOMIC_PRIVACY_LEGAL_EVIDENCE",
    );
    inputs.graphBytes = Buffer.from(JSON.stringify(inputs.graph));
    const result = validateOwnerGatePolicyDecision(inputs);
    assert.equal(result.valid, false);
    assert.match(result.violations.join("\n"), /edge topology/iu);
    assertNonauthorizingHold(result);
  }
  {
    const inputs = cloneInputs();
    inputs.ownerPolicyFreeze.ownerAcceptance = { substituted: true };
    inputs.ownerPolicyFreezeBytes = Buffer.from(JSON.stringify(inputs.ownerPolicyFreeze));
    const result = validateOwnerGatePolicyDecision(inputs);
    assert.equal(result.valid, false);
    assert.match(result.violations.join("\n"), /ownerPolicyFreeze/iu);
    assertNonauthorizingHold(result);
  }
});

test("strict parser and exact envelope reject duplicate or extra members", () => {
  assert.throws(
    () => parseOwnerGatePolicyDecisionJson('{"schema":"one","schema":"two"}', "duplicate-top"),
    /duplicate JSON member \$root\.schema/u,
  );
  assert.throws(
    () => parseOwnerGatePolicyDecisionJson('{"outer":{"gate":1,"gate":2}}', "duplicate-nested"),
    /duplicate JSON member \$root\.outer\.gate/u,
  );

  const inputs = cloneInputs();
  inputs.packet.unrequestedAuthority = true;
  const result = validateOwnerGatePolicyDecision(inputs);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /expected exact keys/iu);
  assertNonauthorizingHold(result);
});

test("bound graph and owner-policy freeze hashes are exact", () => {
  const inputs = canonicalInputs();
  const graphSha256 = createHash("sha256").update(inputs.graphBytes).digest("hex");
  const ownerPolicyFreezeSha256 = createHash("sha256").update(inputs.ownerPolicyFreezeBytes).digest("hex");
  assert.equal(graphSha256, inputs.packet.sourceBindings.releaseDependencyGraph.fileSha256);
  assert.equal(ownerPolicyFreezeSha256, inputs.packet.sourceBindings.ownerPolicyFreeze.fileSha256);
  assert.equal(inputs.graph.graphDefinitionSha256, inputs.packet.sourceBindings.releaseDependencyGraph.graphDefinitionSha256);
});

test("CLI validates effective repository policy without authorizing release", () => {
  const ordinary = spawnSync(process.execPath, [CLI_PATH], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(ordinary.status, 0, ordinary.stderr || ordinary.stdout);
  const ordinaryResult = JSON.parse(ordinary.stdout);
  assert.equal(ordinaryResult.valid, true);
  assertNonauthorizingHold(ordinaryResult);

  const required = spawnSync(process.execPath, [CLI_PATH, "--require-effective"], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(required.status, 0, required.stderr || required.stdout);
  const requiredResult = JSON.parse(required.stdout);
  assert.equal(requiredResult.valid, true);
  assert.equal(requiredResult.effective, true);
  assert.equal(requiredResult.mainnetStatus, "HOLD");
});

test("CLI rejects duplicate-member packet bytes without touching bound sources", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-owner-gate-policy-"));
  try {
    const packetPath = join(directory, "duplicate.json");
    writeFileSync(packetPath, '{"schema":"one","schema":"two"}', "utf8");
    const result = spawnSync(process.execPath, [CLI_PATH, "--packet", packetPath], {
      cwd: SITE_ROOT,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /duplicate JSON member \$root\.schema/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

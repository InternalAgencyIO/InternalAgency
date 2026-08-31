#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OWNER_GATE_POLICY_DECISION_SCHEMA = "iat-b3-owner-gate-policy-decision/v1";
export const OWNER_GATE_POLICY_DECISION_STATUS = "REPOSITORY_POLICY_APPLIED_HOLD";

const DEFAULT_PACKET_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-owner-gate-policy-decision.v1.json",
  import.meta.url,
));
const DEFAULT_GRAPH_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-release-dependency-graph.v1.json",
  import.meta.url,
));
const DEFAULT_OWNER_POLICY_FREEZE_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-owner-policy-freeze.v1.json",
  import.meta.url,
));

const TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "profile",
  "status",
  "scope",
  "sourceBindings",
  "policy",
  "migrationBoundary",
  "predicateMigrations",
  "topologyMigration",
  "authorization",
  "assurance",
]);

const EXPECTED_SCOPE = Object.freeze({
  contract: "NON_ACTIVATING_OWNER_POLICY_MIGRATION_RECORD",
  appliesTo: "B3_RELEASE_EVIDENCE_AND_REQUIRED_SIGNATURE_GATES",
  doesNotCertify: Object.freeze([
    "OWNER_IDENTITY_OR_POLICY_AUTHORIZATION",
    "TREZOR_DEVICE_OR_SIGNATURE_AUTHENTICITY",
    "GRAPH_PREDICATE_SATISFACTION_OR_NODE_COMPLETION",
    "AUTOMATED_EVIDENCE_COMPLETENESS_OR_CORRECTNESS",
    "DEVNET_REHEARSAL_OR_ACTIVATION",
    "RELEASE_OR_MAINNET_AUTHORIZATION",
  ]),
});

const EXPECTED_SOURCE_BINDINGS = Object.freeze({
  declaredHeadSha: "09ec025b5b301925d49bc24347bafc8a0c7f733d",
  releaseDependencyGraph: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/iat-b3-release-dependency-graph.v1.json",
    fileSha256: "68b22e29f555adb2f59fe5cf42e6a1bf7783a8c962195de6f7736ccd9b1ea843",
    schema: "iat-b3-release-dependency-graph/v1",
    graphDefinitionSha256: "fd1c3648508e8ad72a933355b4b87a44d60466997bedce4e83693583f9996689",
    status: "BLOCKED",
    mainnetStatus: "HOLD",
  }),
  ownerPolicyFreeze: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
    fileSha256: "95c508a47f9ccfed8d466851196cf4de0928027bebccc35b5842fb2c77449f06",
    schema: "iat-b3-owner-policy-freeze/v2",
    status: "BLOCKED",
    mainnetStatus: "HOLD",
  }),
});

const EXPECTED_POLICY = Object.freeze({
  humanGate: Object.freeze({
    count: 1,
    soleGate: "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION",
    deviceModel: "TREZOR_MODEL_T",
    appliesTo: "EVERY_REQUIRED_CRYPTOGRAPHIC_SIGNATURE",
    otherHumanApprovalGatePermitted: false,
    independentHumanReviewerPrerequisitePermitted: false,
    nativeHumanReviewerPrerequisitePermitted: false,
  }),
  nonSignatureGateClosure: Object.freeze({
    mode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    automatedDirectEvidenceMayClose: true,
    directObservationRequired: true,
    exactMigratedPredicateEvidenceRequired: true,
    assertionOnlyEvidenceMayClose: false,
    inferredEvidenceMayClose: false,
    simulatedEvidenceMayCloseProductionClaim: false,
    humanReviewPrerequisitePermitted: false,
  }),
  claimDisposition: Object.freeze({
    unobserved: "HOLD",
    partiallyObserved: "HOLD",
    stale: "HOLD",
    contradictory: "HOLD",
    invalid: "HOLD",
    scopeExpansionPermitted: false,
  }),
});

const EXPECTED_MIGRATION_BOUNDARY = Object.freeze({
  state: "APPLIED_TO_CANONICAL_GRAPH",
  currentGraphRemainsAuthoritative: true,
  policyCandidateOverridesGraph: false,
  conflictingNodesRemainBlocked: true,
  graphCompletionClaimed: false,
  separateGraphMigrationRequired: false,
});

export const OWNER_GATE_POLICY_PREDICATE_MIGRATIONS = Object.freeze([
  Object.freeze({
    nodeId: "LIVE_ESTATE_CANONICAL_MINT_DECISION",
    currentNodeStatus: "BLOCKED",
    currentPredicate: "SIGNED_LIVE_ESTATE_CANONICAL_MINT_DECISION_PACKET",
    conflictClass: "SIGNATURE_DEVICE_UNDERSPECIFIED",
    proposedNodeId: "LIVE_ESTATE_CANONICAL_MINT_DECISION",
    proposedPredicate: "TREZOR_MODEL_T_SIGNED_LIVE_ESTATE_CANONICAL_MINT_DECISION_PACKET",
    gateClass: "SIGNATURE",
    closureMode: "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION_AND_VERIFIED_SIGNATURE",
    migrationState: "APPLIED_TO_CANONICAL_GRAPH",
    completionClaimed: false,
  }),
  Object.freeze({
    nodeId: "EXTERNAL_CHECKPOINT_PROVIDER",
    currentNodeStatus: "BLOCKED",
    currentPredicate: "EXTERNAL_CHECKPOINT_PRODUCTION_REVIEW_PACKET_SCOPED_OUTPUT",
    conflictClass: "HUMAN_REVIEW_AUTHORITY_AMBIGUOUS",
    proposedNodeId: "EXTERNAL_CHECKPOINT_PROVIDER",
    proposedPredicate: "EXTERNAL_CHECKPOINT_AUTOMATED_DIRECT_EVIDENCE_PACKET_SCOPED_OUTPUT",
    gateClass: "NON_SIGNATURE",
    closureMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    migrationState: "APPLIED_TO_CANONICAL_GRAPH",
    completionClaimed: false,
  }),
  Object.freeze({
    nodeId: "X_SOCIAL_EVIDENCE_PROVIDER",
    currentNodeStatus: "BLOCKED",
    currentPredicate: "X_SOCIAL_PRODUCTION_REVIEW_PACKET_SCOPED_OUTPUT",
    conflictClass: "HUMAN_REVIEW_AUTHORITY_AMBIGUOUS",
    proposedNodeId: "X_SOCIAL_EVIDENCE_PROVIDER",
    proposedPredicate: "X_SOCIAL_AUTOMATED_DIRECT_EVIDENCE_PACKET_SCOPED_OUTPUT",
    gateClass: "NON_SIGNATURE",
    closureMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    migrationState: "APPLIED_TO_CANONICAL_GRAPH",
    completionClaimed: false,
  }),
  Object.freeze({
    nodeId: "PRIVACY_VAULT_CLIENT",
    currentNodeStatus: "BLOCKED",
    currentPredicate: "PRIVACY_VAULT_FULL_LIFECYCLE_REVIEW_PACKET",
    conflictClass: "HUMAN_REVIEW_AUTHORITY_AMBIGUOUS",
    proposedNodeId: "PRIVACY_VAULT_CLIENT",
    proposedPredicate: "PRIVACY_VAULT_FULL_LIFECYCLE_AUTOMATED_DIRECT_EVIDENCE_PACKET",
    gateClass: "NON_SIGNATURE",
    closureMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    migrationState: "APPLIED_TO_CANONICAL_GRAPH",
    completionClaimed: false,
  }),
  Object.freeze({
    nodeId: "DEPENDENCY_SECURITY_REMEDIATION",
    currentNodeStatus: "BLOCKED",
    currentPredicate: "ZERO_UNACCEPTED_DEPENDENCY_FINDINGS_PACKET",
    conflictClass: "INDEPENDENT_CLOSURE_SEMANTICS_IN_BLOCKER",
    proposedNodeId: "DEPENDENCY_SECURITY_REMEDIATION",
    proposedPredicate: "ZERO_UNRESOLVED_DEPENDENCY_FINDINGS_AUTOMATED_DIRECT_EVIDENCE_PACKET",
    gateClass: "NON_SIGNATURE",
    closureMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    migrationState: "APPLIED_TO_CANONICAL_GRAPH",
    completionClaimed: false,
  }),
  Object.freeze({
    nodeId: "LOCALIZATION_EVIDENCE",
    currentNodeStatus: "BLOCKED",
    currentPredicate: "ALL_50_LOCALES_ACCEPTED_NATIVE_REVIEW_PACKET",
    conflictClass: "NATIVE_HUMAN_REVIEW_PREREQUISITE",
    proposedNodeId: "LOCALIZATION_EVIDENCE",
    proposedPredicate: "ALL_50_LOCALE_CLAIMS_AUTOMATED_DIRECT_EVIDENCE_PACKET",
    gateClass: "NON_SIGNATURE",
    closureMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    migrationState: "APPLIED_TO_CANONICAL_GRAPH",
    completionClaimed: false,
  }),
  Object.freeze({
    nodeId: "INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW",
    currentNodeStatus: "BLOCKED",
    currentPredicate: "INDEPENDENT_MULTI_DOMAIN_REVIEW_PACKET",
    conflictClass: "INDEPENDENT_HUMAN_REVIEW_PREREQUISITE",
    proposedNodeId: "AUTOMATED_SECURITY_ECONOMIC_PRIVACY_LEGAL_EVIDENCE",
    proposedPredicate: "AUTOMATED_MULTI_DOMAIN_DIRECT_EVIDENCE_PACKET",
    gateClass: "NON_SIGNATURE",
    closureMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    migrationState: "APPLIED_TO_CANONICAL_GRAPH",
    completionClaimed: false,
  }),
]);

const EXPECTED_TOPOLOGY_MIGRATION = Object.freeze({
  renamedNode: Object.freeze({
    currentNodeId: "INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW",
    proposedNodeId: "AUTOMATED_SECURITY_ECONOMIC_PRIVACY_LEGAL_EVIDENCE",
    replaceEveryEdgeEndpoint: true,
    expectedIncomingEdgeCount: 23,
    expectedOutgoingEdgeCount: 1,
    replaceTerminalRequiredNodeId: true,
  }),
  terminalAggregator: Object.freeze({
    nodeId: "TERMINAL_B3_REVIEW_PACKET",
    predicate: "ALL_27_PREREQUISITES_STRUCTURALLY_COMPLETE",
    interpretation: "AUTOMATION_NEUTRAL_STRUCTURAL_AGGREGATION",
    humanReviewPrerequisite: false,
    renameRequired: false,
  }),
});

const EXPECTED_AUTHORIZATION = Object.freeze({
  state: "REPOSITORY_POLICY_APPLIED_NO_CRYPTOGRAPHIC_SIGNATURE_REQUIRED",
  repositoryPolicyEditSignatureRequired: false,
  ownerDecisionAuthenticated: false,
  trezorModelTConfirmationObserved: false,
  signatureVerified: false,
  effective: true,
});

const EXPECTED_ASSURANCE = Object.freeze({
  policyStructureValidated: false,
  sourceBindingsValidated: false,
  graphMigrationApplied: true,
  graphPredicatesSatisfied: false,
  automatedEvidenceVerified: false,
  ownerDecisionAuthorized: false,
  devnetAuthorized: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: "HOLD",
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exactJson(actual, expected) {
  return stableJson(actual) === stableJson(expected);
}

function exactKeys(value, keys, label, violations) {
  if (!isRecord(value)) {
    violations.push(`${label}: expected an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!exactJson(actual, expected)) {
    violations.push(`${label}: expected exact keys ${expected.join(", ")}`);
    return false;
  }
  return true;
}

function expectExact(actual, expected, label, violations) {
  if (!exactJson(actual, expected)) violations.push(`${label}: canonical value mismatch`);
}

export function parseOwnerGatePolicyDecisionJson(text, label = "owner-gate-policy") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const skipWhitespace = () => {
    while (index < text.length && /[\t\n\r ]/u.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseString = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (text[index] === "\\") index += 2;
      else {
        if (text[index] < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseString();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function loadOwnerGatePolicyDecisionInputs({
  packetPath = DEFAULT_PACKET_PATH,
  graphPath = DEFAULT_GRAPH_PATH,
  ownerPolicyFreezePath = DEFAULT_OWNER_POLICY_FREEZE_PATH,
} = {}) {
  const packetBytes = readFileSync(resolve(packetPath));
  const graphBytes = readFileSync(resolve(graphPath));
  const ownerPolicyFreezeBytes = readFileSync(resolve(ownerPolicyFreezePath));
  return {
    packet: parseOwnerGatePolicyDecisionJson(packetBytes.toString("utf8"), resolve(packetPath)),
    packetBytes,
    graph: parseOwnerGatePolicyDecisionJson(graphBytes.toString("utf8"), resolve(graphPath)),
    graphBytes,
    ownerPolicyFreeze: parseOwnerGatePolicyDecisionJson(
      ownerPolicyFreezeBytes.toString("utf8"),
      resolve(ownerPolicyFreezePath),
    ),
    ownerPolicyFreezeBytes,
  };
}

export function validateOwnerGatePolicyDecision({
  packet,
  graph,
  graphBytes,
  ownerPolicyFreeze,
  ownerPolicyFreezeBytes,
}) {
  const violations = [];
  if (!exactKeys(packet, TOP_LEVEL_KEYS, "packet", violations)) {
    return buildResult(violations);
  }
  if (packet.schema !== OWNER_GATE_POLICY_DECISION_SCHEMA
    || packet.profile !== "PRODUCTION"
    || packet.status !== OWNER_GATE_POLICY_DECISION_STATUS) {
    violations.push("packet: expected canonical schema, PRODUCTION profile, and REPOSITORY_POLICY_APPLIED_HOLD status");
  }
  expectExact(packet.scope, EXPECTED_SCOPE, "scope", violations);
  expectExact(packet.sourceBindings, EXPECTED_SOURCE_BINDINGS, "sourceBindings", violations);
  expectExact(packet.policy, EXPECTED_POLICY, "policy", violations);
  expectExact(packet.migrationBoundary, EXPECTED_MIGRATION_BOUNDARY, "migrationBoundary", violations);
  expectExact(packet.predicateMigrations, OWNER_GATE_POLICY_PREDICATE_MIGRATIONS, "predicateMigrations", violations);
  expectExact(packet.topologyMigration, EXPECTED_TOPOLOGY_MIGRATION, "topologyMigration", violations);
  expectExact(packet.authorization, EXPECTED_AUTHORIZATION, "authorization", violations);
  expectExact(packet.assurance, EXPECTED_ASSURANCE, "assurance", violations);

  if (!isRecord(graph)) {
    violations.push("releaseDependencyGraph: expected an object");
  } else {
    if (graphBytes === undefined || sha256(graphBytes) !== EXPECTED_SOURCE_BINDINGS.releaseDependencyGraph.fileSha256) {
      violations.push("releaseDependencyGraph: source-bound file SHA-256 mismatch");
    }
    if (graph.schema !== EXPECTED_SOURCE_BINDINGS.releaseDependencyGraph.schema
      || graph.graphDefinitionSha256 !== EXPECTED_SOURCE_BINDINGS.releaseDependencyGraph.graphDefinitionSha256
      || graph.status !== "BLOCKED"
      || graph.mainnetStatus !== "HOLD") {
      violations.push("releaseDependencyGraph: expected the bound BLOCKED/HOLD graph definition");
    }
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const nodeIds = nodes.map((node) => node?.id);
    if (nodeIds.length !== new Set(nodeIds).size) violations.push("releaseDependencyGraph: duplicate node id");
    for (const migration of OWNER_GATE_POLICY_PREDICATE_MIGRATIONS) {
      const node = nodes.find(({ id }) => id === migration.proposedNodeId);
      if (!node) {
        violations.push(`releaseDependencyGraph: missing migrated node ${migration.proposedNodeId}`);
        continue;
      }
      if (node.status !== migration.currentNodeStatus
        || node.completionPredicate !== migration.proposedPredicate
        || node.completionEvidence !== null
        || typeof node.blocker !== "string") {
        violations.push(`releaseDependencyGraph: ${migration.proposedNodeId} does not match its applied BLOCKED migration`);
      }
    }
    const renamed = EXPECTED_TOPOLOGY_MIGRATION.renamedNode;
    if (nodes.some(({ id }) => id === renamed.currentNodeId)
      || !nodes.some(({ id }) => id === renamed.proposedNodeId)) {
      violations.push("releaseDependencyGraph: independent-review node-id migration was not applied exactly");
    }
    const edges = Array.isArray(graph.edges) ? graph.edges : [];
    const incoming = edges.filter((edge) => Array.isArray(edge) && edge[1] === renamed.proposedNodeId).length;
    const outgoing = edges.filter((edge) => Array.isArray(edge) && edge[0] === renamed.proposedNodeId).length;
    if (incoming !== renamed.expectedIncomingEdgeCount || outgoing !== renamed.expectedOutgoingEdgeCount) {
      violations.push("releaseDependencyGraph: renamed-node edge topology does not match the applied migration");
    }
    if (edges.some((edge) => Array.isArray(edge) && edge.includes(renamed.currentNodeId))) {
      violations.push("releaseDependencyGraph: old independent-review edge endpoint remains after migration");
    }
    const terminalRequired = graph.terminalPredicate?.requiredNodeIds;
    if (!Array.isArray(terminalRequired)
      || terminalRequired.includes(renamed.currentNodeId)
      || !terminalRequired.includes(renamed.proposedNodeId)) {
      violations.push("releaseDependencyGraph: terminal predicate does not reflect the applied node-id migration");
    }
    const terminal = nodes.find(({ id }) => id === EXPECTED_TOPOLOGY_MIGRATION.terminalAggregator.nodeId);
    if (terminal?.completionPredicate !== EXPECTED_TOPOLOGY_MIGRATION.terminalAggregator.predicate) {
      violations.push("releaseDependencyGraph: terminal structural aggregator predicate mismatch");
    }
  }

  if (!isRecord(ownerPolicyFreeze)) {
    violations.push("ownerPolicyFreeze: expected an object");
  } else {
    if (ownerPolicyFreezeBytes === undefined
      || sha256(ownerPolicyFreezeBytes) !== EXPECTED_SOURCE_BINDINGS.ownerPolicyFreeze.fileSha256) {
      violations.push("ownerPolicyFreeze: source-bound file SHA-256 mismatch");
    }
    if (ownerPolicyFreeze.schema !== EXPECTED_SOURCE_BINDINGS.ownerPolicyFreeze.schema
      || ownerPolicyFreeze.status !== "BLOCKED"
      || ownerPolicyFreeze.ownerAcceptance !== null
      || ownerPolicyFreeze.assurance?.mainnetStatus !== "HOLD") {
      violations.push("ownerPolicyFreeze: expected the bound unresolved BLOCKED/HOLD freeze");
    }
  }

  return buildResult(violations);
}

function buildResult(violations) {
  const valid = violations.length === 0;
  return {
    schema: "iat-b3-owner-gate-policy-decision-validation/v1",
    valid,
    policyCandidateStructurallyValid: valid,
    sourceBindingsValidated: valid,
    conflictingPredicateCount: OWNER_GATE_POLICY_PREDICATE_MIGRATIONS.length,
    graphMigrationApplied: valid,
    repositoryPolicyEditSignatureRequired: false,
    graphPredicatesSatisfied: false,
    automatedEvidenceVerified: false,
    ownerDecisionAuthorized: false,
    trezorModelTConfirmationObserved: false,
    effective: valid,
    devnetAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    violations,
  };
}

function parseCli(argv) {
  const cli = {
    packetPath: DEFAULT_PACKET_PATH,
    graphPath: DEFAULT_GRAPH_PATH,
    ownerPolicyFreezePath: DEFAULT_OWNER_POLICY_FREEZE_PATH,
    requireEffective: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--packet", "--graph", "--owner-policy-freeze"].includes(argument)) {
      if (!argv[index + 1]) throw new Error(`${argument} requires a path`);
      const key = argument === "--packet"
        ? "packetPath"
        : argument === "--graph"
          ? "graphPath"
          : "ownerPolicyFreezePath";
      cli[key] = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--require-effective") {
      cli.requireEffective = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return cli;
}

function main() {
  let cli;
  let inputs;
  try {
    cli = parseCli(process.argv.slice(2));
    inputs = loadOwnerGatePolicyDecisionInputs(cli);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const result = validateOwnerGatePolicyDecision(inputs);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
  else if (cli.requireEffective && !result.effective) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

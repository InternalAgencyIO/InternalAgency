#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const V2_PARITY_CLAIMS_SCHEMA = "iat-b3-v2-parity-claims-readiness/v1";
export const V2_PARITY_CLAIMS_MAINNET_STATUS = "HOLD";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const DEFAULT_MANIFEST_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-v2-parity-claims-readiness.v1.json",
  import.meta.url,
));

const TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "profile",
  "status",
  "scope",
  "inputBindings",
  "sourceInheritance",
  "featureRows",
  "decisionPolicy",
  "implementationSlices",
  "releaseClaimsBoundary",
  "ownerAndExternalInputs",
  "zeroUnauthorizedCuts",
  "allFeatureRowsMapped",
  "productionParityPacketComplete",
  "releaseSurfaceClaimsPacketComplete",
  "activationReady",
  "deploymentAuthorized",
  "mainnetExecutionAuthorized",
  "mainnetStatus",
]);

const EXPECTED_SCOPE = Object.freeze({
  contract: "NON_ACTIVATING_V2_SOURCE_INHERITANCE_AND_PUBLIC_CLAIMS_BOUNDARY",
  doesNotCertify: Object.freeze([
    "B3_RUNTIME_FEATURE_PARITY",
    "FULL_FEATURE_DEVNET_REHEARSAL",
    "PRODUCTION_IDENTITY_OR_DEPLOYED_BYTES",
    "LOCALIZATION_OR_MEDIA_ACCEPTANCE",
    "RELEASE_AUTHORIZATION",
    "MAINNET_READINESS",
  ]),
});

const INPUT_SPECS = Object.freeze({
  featureParityContract: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/V2_FEATURE_PARITY.md",
    sha256: "360a8511d5f2cc92a3a3e78509134a6c7096322ab88fca1be5e67f6fdf8fce26",
  }),
  sourceInventory: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/V2_SOURCE_INVENTORY.md",
    sha256: "70ecb803e5c063b7d8ac230b08792e4d95090d663d705e0b1b94eae5577f2914",
  }),
  releaseDependencyGraph: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/iat-b3-release-dependency-graph.v1.json",
    sha256: "f7c40b6dfd2b5fe59ab5e2a6ff36bf1439a381346549af32a027938dfd3eaf83",
  }),
});

export const CANONICAL_V2_SOURCE_COMMIT = "f0a794952ab822d823c8d8eba0c4c8f5d9ae4796";

export const REQUIRED_V2_SOURCE_PATHS = Object.freeze([
  "projects/star-ascent/site/programs/iat_v2/src/lib.rs",
  "projects/star-ascent/site/programs/iat_v2/src/policy.rs",
  "projects/star-ascent/site/programs/iat_v2/src/switchboard_randomness.rs",
  "projects/star-ascent/site/programs/iat_v2/client.mjs",
  "projects/star-ascent/site/programs/iat_v2/instructions.mjs",
  "projects/star-ascent/site/programs/iat_v2/feature-instructions.mjs",
  "projects/star-ascent/site/engagement/iat-v2-reference-engine.mjs",
  "projects/star-ascent/site/engagement/node-binding-policy.mjs",
  "projects/star-ascent/site/engagement/x-oauth-state.mjs",
  "projects/star-ascent/site/app/api/network/route.ts",
  "projects/star-ascent/site/app/i18n/config.ts",
  "projects/star-ascent/site/app/future/page.tsx",
  "projects/star-ascent/site/tools/iat-v2-admin-console/main.jsx",
]);

export const REQUIRED_V2_ENTRYPOINTS = Object.freeze([
  "initialize_config",
  "initialize_lane_vault",
  "initialize_stake_vault",
  "activate",
  "register_agency",
  "set_eligibility",
  "open_position",
  "settle_position_week",
  "settle_core_week",
  "claim_lane_principal",
  "withdraw_position_principal",
  "close_position",
  "commit_round",
  "settle_round",
  "expire_round",
]);

export const RELEASE_CLAIMS_PREREQUISITES = Object.freeze([
  "LIVE_ESTATE_CANONICAL_MINT_DECISION",
  "V2_FEATURE_PARITY",
  "PRODUCTION_IDENTITY_INPUT_FREEZE",
  "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE",
  "LOCALIZATION_EVIDENCE",
  "MEDIA_MASTER_COMPLETENESS",
  "V2_LAUNCH_CEREMONY_BOUNDARY",
]);

const PUBLISHABLE_CLAIM_CLASSES = Object.freeze([
  "V2_SOURCE_INHERITED",
  "B3_REFERENCE_OR_PARTIAL_IMPLEMENTATION",
  "LOCAL_TEST_RESULT_WITH_EXACT_SCOPE",
  "DEVNET_ATTEMPT_WITH_EXACT_SCOPE",
  "MAINNET_HOLD",
]);

const FORBIDDEN_CLAIM_CLASSES = Object.freeze([
  "FULL_V2_PARITY_COMPLETE",
  "ALL_FEATURES_DEVNET_REHEARSED",
  "PRODUCTION_IDENTITIES_FROZEN",
  "ALL_50_LOCALES_NATIVE_ACCEPTED",
  "ALL_MEDIA_MASTERS_COMPLETE",
  "B3_DEPLOYED_OR_ACTIVATION_READY",
  "MAINNET_LAUNCH_AUTHORIZED",
]);

const EXPECTED_SLICE_SPECS = Object.freeze([
  Object.freeze({
    id: "CANONICAL_ASSET_AND_PRIVACY",
    state: "BLOCKED_PRODUCTION_ASSET_AND_PRIVACY",
    featureOrdinals: Object.freeze([1, 2, 3, 28]),
    evidencePaths: Object.freeze([
      "projects/star-ascent/site/docs/b3/ESTATE_BASELINE.md",
      "projects/star-ascent/site/docs/b3/SHIELDED_TRANSFERS.md",
      "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
    ]),
    blockers: Object.freeze([
      "Signed canonical mint decision and migration evidence are absent.",
      "Exact-version native Privacy Vault lifecycle and independent privacy review are incomplete.",
    ]),
  }),
  Object.freeze({
    id: "V2_ECONOMY_REWARDS_AND_CCC",
    state: "PARTIAL_NATIVE_PORT",
    featureOrdinals: Object.freeze([4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]),
    evidencePaths: Object.freeze([
      "projects/star-ascent/site/docs/b3/ECONOMIC_PORT_ARCHITECTURE.md",
      "projects/star-ascent/site/docs/b3/iat-b3-economic-write-gates.v1.json",
      "projects/star-ascent/site/docs/b3/REWARD_CAPACITY_WATERFALL.md",
    ]),
    blockers: Object.freeze([
      "The B3 economy surface lacks a production entrypoint, dispatcher, CPI execution, and complete native write handlers.",
      "End-to-end V2 differential, migration, and adversarial Devnet evidence is incomplete.",
    ]),
  }),
  Object.freeze({
    id: "CUSTODY_CEREMONY_AND_REPRODUCIBILITY",
    state: "INHERITED_TRANSITION_BOUNDARY",
    featureOrdinals: Object.freeze([5, 29, 30, 44, 45, 46]),
    evidencePaths: Object.freeze([
      "projects/star-ascent/site/docs/b3/COST_FEASIBILITY.md",
      "projects/star-ascent/site/docs/b3/MAINNET_PATH.md",
      "projects/star-ascent/site/docs/b3/V2_SOURCE_INVENTORY.md",
    ]),
    blockers: Object.freeze([
      "B3 supersession, custody policy, accountable ceremony funding, and production binary reproduction are incomplete.",
      "V2 and Mainnet remain on HOLD.",
    ]),
  }),
  Object.freeze({
    id: "IDENTITY_SOCIAL_AND_NETWORK",
    state: "PARTIAL_REFERENCE_AND_APP_ADAPTERS",
    featureOrdinals: Object.freeze([31, 32, 33, 34, 35, 51, 52]),
    evidencePaths: Object.freeze([
      "projects/star-ascent/site/docs/b3/X_SOCIAL_EVIDENCE_PROVIDER_READINESS.md",
      "projects/star-ascent/site/docs/b3/EXTERNAL_CHECKPOINT_PROVIDER_READINESS.md",
      "projects/star-ascent/site/docs/b3/V2_SOURCE_INVENTORY.md",
    ]),
    blockers: Object.freeze([
      "Production X evidence and checkpoint providers are unfrozen and unauthenticated.",
      "B3 identity, network read-adapter, rollback, and full integration rehearsals are incomplete.",
    ]),
  }),
  Object.freeze({
    id: "PUBLIC_DOMAINS_AND_LOCALIZATION",
    state: "INHERITED_RUNTIME_REVIEW_BLOCKED",
    featureOrdinals: Object.freeze([36, 37, 38]),
    evidencePaths: Object.freeze([
      "projects/star-ascent/site/docs/b3/V2_SOURCE_INVENTORY.md",
      "projects/star-ascent/site/docs/b3/MAINNET_PATH.md",
    ]),
    blockers: Object.freeze([
      "All 50 locales lack complete native review and immutable acceptance evidence.",
      "Production dual-host render and hydration evidence is incomplete.",
    ]),
  }),
  Object.freeze({
    id: "INACTIVE_FUTURE_AND_ADMIN_SURFACES",
    state: "INHERITED_INACTIVE_EVIDENCE_PENDING",
    featureOrdinals: Object.freeze([39, 40, 41, 42, 43]),
    evidencePaths: Object.freeze([
      "projects/star-ascent/site/docs/b3/ARCHITECTURE_BASELINE.md",
      "projects/star-ascent/site/docs/b3/V2_SOURCE_INVENTORY.md",
    ]),
    blockers: Object.freeze([
      "Inherited inactive surfaces still require final source-bound no-activation and cross-engine isolation evidence.",
      "No future module is authorized for activation.",
    ]),
  }),
  Object.freeze({
    id: "B3_LOCKDOWN_FACTIONS_CORE_AND_WATERFALL",
    state: "PARTIAL_B3_REFERENCE_AND_NATIVE_PREPARATION",
    featureOrdinals: Object.freeze([47, 48, 49, 50, 53]),
    evidencePaths: Object.freeze([
      "projects/star-ascent/site/docs/b3/LAW_ADAPTER.md",
      "projects/star-ascent/site/docs/b3/FACTIONS.md",
      "projects/star-ascent/site/docs/b3/CORE_TEAM_CAP.md",
      "projects/star-ascent/site/docs/b3/REWARD_CAPACITY_WATERFALL.md",
    ]),
    blockers: Object.freeze([
      "Production Daily Law hook invocation and combined stake-ingress enforcement are incomplete.",
      "Faction economics, core-custody release policy, downstream consumers, and end-to-end conservation remain unresolved.",
    ]),
  }),
]);

const OWNER_EXTERNAL_INPUTS = Object.freeze([
  "Signed canonical mint and migration decision for every live Estate.",
  "Frozen production program, mint, cluster, entropy, metadata, and authority inputs.",
  "Owner acceptance of core custody/release and faction economics, scoring, Sybil, snapshot, tie, authorization, carve-out, and funding rules.",
  "Production checkpoint and X evidence providers with authenticated, rollback-safe, independently observed evidence.",
  "Accountable native review and immutable acceptance evidence for all 50 locales.",
  "All 16 release media masters with license and legal clearance; 14 are currently missing.",
  "Independent security, economic, privacy, dependency, and legal review of final bytes and evidence.",
]);

const exactArray = (left, right) => Array.isArray(left)
  && left.length === right.length
  && left.every((value, index) => value === right[index]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function canonicalJsonTree(value, path, violations, ancestors = new Set(), observed = new Set()) {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) violations.push(`${path}: lone Unicode surrogate is forbidden`);
    return !hasLoneSurrogate(value);
  }
  if (typeof value === "number") {
    const valid = Number.isSafeInteger(value) && !Object.is(value, -0);
    if (!valid) violations.push(`${path}: expected a finite safe JSON integer other than negative zero`);
    return valid;
  }
  if (typeof value !== "object") {
    violations.push(`${path}: expected canonical JSON data`);
    return false;
  }
  if (ancestors.has(value)) {
    violations.push(`${path}: contains a cycle`);
    return false;
  }
  if (observed.has(value)) {
    violations.push(`${path}: shared object aliases are forbidden`);
    return false;
  }
  ancestors.add(value);
  observed.add(value);
  let valid = true;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      violations.push(`${path}: expected the canonical Array prototype`);
      valid = false;
    }
    const expectedKeys = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
    const actualKeys = Reflect.ownKeys(value);
    if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      violations.push(`${path}: expected a dense undecorated JSON array`);
      valid = false;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor
      || !("value" in lengthDescriptor)
      || lengthDescriptor.value !== value.length
      || lengthDescriptor.enumerable !== false
      || lengthDescriptor.configurable !== false) {
      violations.push(`${path}.length: expected the canonical array length data property`);
      valid = false;
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        violations.push(`${path}[${index}]: expected an enumerable own data property`);
        valid = false;
      } else {
        valid = canonicalJsonTree(
          descriptor.value,
          `${path}[${index}]`,
          violations,
          ancestors,
          observed,
        ) && valid;
      }
    }
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      violations.push(`${path}: expected the canonical Object prototype`);
      valid = false;
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        violations.push(`${path}: symbol properties are forbidden`);
        valid = false;
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        violations.push(`${path}.${key}: expected an enumerable own data property`);
        valid = false;
      } else {
        valid = canonicalJsonTree(
          descriptor.value,
          `${path}.${key}`,
          violations,
          ancestors,
          observed,
        ) && valid;
      }
    }
  }
  ancestors.delete(value);
  return valid;
}

function exactKeys(value, expected, path, violations) {
  if (!isObject(value)) {
    violations.push(`${path}: expected object`);
    return false;
  }
  const keys = Object.keys(value);
  if (!exactArray(keys, expected)) {
    violations.push(`${path}: keys must be exactly ${expected.join(", ")}`);
    return false;
  }
  return true;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runGit(args, repositoryRoot = REPOSITORY_ROOT) {
  return spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

function parseFeatureRows(markdown, violations) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/u)) {
    if (!line.startsWith("| ") || line.startsWith("| ---") || line.startsWith("| V2 capability")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 3) {
      violations.push("featureParityContract: every feature row must contain exactly three cells");
      continue;
    }
    rows.push({ capability: cells[0], disposition: cells[1], acceptanceRequirement: cells[2] });
  }
  if (rows.length !== 53) violations.push(`featureParityContract: expected exactly 53 feature rows; found ${rows.length}`);
  return rows;
}

function readBoundInputs(manifest, repositoryRoot, violations) {
  const bytesById = new Map();
  if (!exactKeys(manifest.inputBindings, Object.keys(INPUT_SPECS), "inputBindings", violations)) return bytesById;
  for (const [id, expected] of Object.entries(INPUT_SPECS)) {
    const binding = manifest.inputBindings[id];
    if (!exactKeys(binding, ["path", "sha256"], `inputBindings.${id}`, violations)) continue;
    if (binding.path !== expected.path || binding.sha256 !== expected.sha256) {
      violations.push(`inputBindings.${id}: canonical path or digest drifted`);
      continue;
    }
    try {
      const bytes = readFileSync(resolve(repositoryRoot, binding.path));
      bytesById.set(id, bytes);
      if (sha256(bytes) !== binding.sha256) violations.push(`inputBindings.${id}: working-tree bytes do not match the pinned digest`);
    } catch (error) {
      violations.push(`inputBindings.${id}: cannot read bound input (${error.message})`);
    }
    const status = runGit(["status", "--porcelain=v1", "--untracked-files=all", "--", binding.path], repositoryRoot);
    if (status.status !== 0 || status.stdout.trim() !== "") {
      violations.push(`inputBindings.${id}: bound input must be clean relative to HEAD`);
    }
  }
  return bytesById;
}

function validateSourceInheritance(sourceInheritance, sourceInventoryMarkdown, repositoryRoot, violations) {
  let verified = true;
  if (!exactKeys(sourceInheritance, ["canonicalV2SourceCommit", "requiredPaths", "requiredEntrypoints"], "sourceInheritance", violations)) return false;
  if (sourceInheritance.canonicalV2SourceCommit !== CANONICAL_V2_SOURCE_COMMIT) {
    violations.push("sourceInheritance.canonicalV2SourceCommit: canonical V2 source commit drifted");
    verified = false;
  }
  if (!exactArray(sourceInheritance.requiredPaths, REQUIRED_V2_SOURCE_PATHS)) {
    violations.push("sourceInheritance.requiredPaths: exact ordered V2 source inventory drifted");
    verified = false;
  }
  if (!exactArray(sourceInheritance.requiredEntrypoints, REQUIRED_V2_ENTRYPOINTS)) {
    violations.push("sourceInheritance.requiredEntrypoints: exact ordered 15-entrypoint inventory drifted");
    verified = false;
  }
  if (!sourceInventoryMarkdown.includes(`Canonical V2 source commit: \`${CANONICAL_V2_SOURCE_COMMIT}\``)) {
    violations.push("sourceInventory: canonical V2 source commit statement drifted");
    verified = false;
  }
  const ancestor = runGit(["merge-base", "--is-ancestor", CANONICAL_V2_SOURCE_COMMIT, "HEAD"], repositoryRoot);
  if (ancestor.status !== 0) {
    violations.push("sourceInheritance: canonical V2 commit is not an ancestor of HEAD");
    verified = false;
  }
  for (const path of REQUIRED_V2_SOURCE_PATHS) {
    for (const revision of [CANONICAL_V2_SOURCE_COMMIT, "HEAD"]) {
      const present = runGit(["cat-file", "-e", `${revision}:${path}`], repositoryRoot);
      if (present.status !== 0) {
        violations.push(`sourceInheritance: ${path} is absent from ${revision}`);
        verified = false;
      }
    }
  }
  const canonicalProgram = runGit(["show", `${CANONICAL_V2_SOURCE_COMMIT}:projects/star-ascent/site/programs/iat_v2/src/lib.rs`], repositoryRoot);
  const currentProgram = runGit(["show", "HEAD:projects/star-ascent/site/programs/iat_v2/src/lib.rs"], repositoryRoot);
  if (canonicalProgram.status !== 0 || currentProgram.status !== 0) {
    violations.push("sourceInheritance: cannot read canonical and current V2 program source");
    return false;
  }
  for (const entrypoint of REQUIRED_V2_ENTRYPOINTS) {
    const marker = new RegExp(`\\bpub\\s+fn\\s+${entrypoint}\\s*\\(`, "u");
    if (!marker.test(canonicalProgram.stdout)) {
      violations.push(`sourceInheritance: canonical V2 entrypoint ${entrypoint} is absent`);
      verified = false;
    }
    if (!marker.test(currentProgram.stdout)) {
      violations.push(`sourceInheritance: inherited V2 entrypoint ${entrypoint} is absent from HEAD`);
      verified = false;
    }
  }
  return verified;
}

function validateFeatureInventory(manifest, canonicalRows, violations) {
  let mapped = true;
  if (!Array.isArray(manifest.featureRows) || manifest.featureRows.length !== canonicalRows.length) {
    violations.push(`featureRows: expected exactly ${canonicalRows.length} ordered rows`);
    mapped = false;
  } else {
    for (let index = 0; index < canonicalRows.length; index += 1) {
      const row = manifest.featureRows[index];
      if (!exactKeys(row, ["ordinal", "capability"], `featureRows[${index}]`, violations)) {
        mapped = false;
        continue;
      }
      if (row.ordinal !== index + 1 || row.capability !== canonicalRows[index].capability) {
        violations.push(`featureRows[${index}]: ordinal or canonical capability drifted`);
        mapped = false;
      }
    }
  }
  const unauthorizedCut = canonicalRows.some(({ disposition }) => /\bcut\b/iu.test(disposition));
  if (unauthorizedCut) {
    violations.push("featureParityContract: CUT disposition requires a new owner-authorized contract version");
    mapped = false;
  }
  return mapped;
}

function validateDecisionPolicy(policy, violations) {
  if (!exactKeys(policy, ["defaultDecision", "cutExceptions", "ownerCutAuthorizationArtifacts", "acceptanceState"], "decisionPolicy", violations)) return false;
  if (policy.defaultDecision !== "RETAIN"
    || !exactArray(policy.cutExceptions, [])
    || !exactArray(policy.ownerCutAuthorizationArtifacts, [])
    || policy.acceptanceState !== "INCOMPLETE") {
    violations.push("decisionPolicy: every canonical row must remain RETAIN with no cut exception and incomplete acceptance evidence");
    return false;
  }
  return true;
}

function validateImplementationSlices(slices, repositoryRoot, violations) {
  let complete = true;
  if (!Array.isArray(slices) || slices.length !== EXPECTED_SLICE_SPECS.length) {
    violations.push(`implementationSlices: expected exactly ${EXPECTED_SLICE_SPECS.length} ordered slices`);
    return false;
  }
  const observedOrdinals = [];
  for (let index = 0; index < EXPECTED_SLICE_SPECS.length; index += 1) {
    const slice = slices[index];
    const expected = EXPECTED_SLICE_SPECS[index];
    if (!exactKeys(slice, ["id", "featureOrdinals", "state", "evidencePaths", "blockers"], `implementationSlices[${index}]`, violations)) {
      complete = false;
      continue;
    }
    if (slice.id !== expected.id
      || slice.state !== expected.state
      || !exactArray(slice.featureOrdinals, expected.featureOrdinals)
      || !exactArray(slice.evidencePaths, expected.evidencePaths)
      || !exactArray(slice.blockers, expected.blockers)) {
      violations.push(`implementationSlices[${index}]: id, state, evidence, blockers, or exact feature coverage drifted`);
      complete = false;
    }
    observedOrdinals.push(...(Array.isArray(slice.featureOrdinals) ? slice.featureOrdinals : []));
    if (!Array.isArray(slice.evidencePaths) || slice.evidencePaths.length === 0) {
      violations.push(`implementationSlices[${index}].evidencePaths: at least one clean B3 document is required`);
      complete = false;
    } else {
      for (const path of slice.evidencePaths) {
        if (typeof path !== "string"
          || !path.startsWith("projects/star-ascent/site/docs/b3/")
          || path.includes("\\")
          || path.includes("..")) {
          violations.push(`implementationSlices[${index}].evidencePaths: unsafe or out-of-scope evidence path`);
          complete = false;
          continue;
        }
        const present = runGit(["cat-file", "-e", `HEAD:${path}`], repositoryRoot);
        const status = runGit(["status", "--porcelain=v1", "--untracked-files=all", "--", path], repositoryRoot);
        if (present.status !== 0 || status.status !== 0 || status.stdout.trim() !== "") {
          violations.push(`implementationSlices[${index}].evidencePaths: ${path} must be committed and clean`);
          complete = false;
        }
      }
    }
    if (!Array.isArray(slice.blockers)
      || slice.blockers.length === 0
      || slice.blockers.some((blocker) => typeof blocker !== "string" || blocker.trim().length < 20)) {
      violations.push(`implementationSlices[${index}].blockers: specific nonempty blockers are required`);
      complete = false;
    }
  }
  const sorted = [...observedOrdinals].sort((left, right) => left - right);
  const expected = Array.from({ length: 53 }, (_, index) => index + 1);
  if (!exactArray(sorted, expected)) {
    violations.push("implementationSlices: every feature ordinal must be covered exactly once");
    complete = false;
  }
  return complete;
}

function validateReleaseClaimsBoundary(boundary, releaseGraph, violations) {
  let held = true;
  if (!exactKeys(boundary, ["prerequisiteNodeIds", "requiredCurrentStatus", "publishableClaimClasses", "forbiddenClaimClasses"], "releaseClaimsBoundary", violations)) return false;
  if (!exactArray(boundary.prerequisiteNodeIds, RELEASE_CLAIMS_PREREQUISITES)
    || boundary.requiredCurrentStatus !== "BLOCKED"
    || !exactArray(boundary.publishableClaimClasses, PUBLISHABLE_CLAIM_CLASSES)
    || !exactArray(boundary.forbiddenClaimClasses, FORBIDDEN_CLAIM_CLASSES)) {
    violations.push("releaseClaimsBoundary: prerequisite or claim-class policy drifted");
    held = false;
  }
  if (!isObject(releaseGraph) || !Array.isArray(releaseGraph.nodes) || !Array.isArray(releaseGraph.edges)) {
    violations.push("releaseDependencyGraph: expected canonical nodes and edges");
    return false;
  }
  const nodes = new Map(releaseGraph.nodes.map((node) => [node?.id, node]));
  for (const id of RELEASE_CLAIMS_PREREQUISITES) {
    const node = nodes.get(id);
    if (!node || node.status !== "BLOCKED" || node.completionEvidence !== null || typeof node.blocker !== "string") {
      violations.push(`releaseDependencyGraph: ${id} must remain explicitly BLOCKED with no completion evidence`);
      held = false;
    }
  }
  const incoming = releaseGraph.edges
    .filter((edge) => Array.isArray(edge) && edge[1] === "RELEASE_SURFACE_PUBLIC_CLAIMS")
    .map((edge) => edge[0]);
  if (!exactArray(incoming, RELEASE_CLAIMS_PREREQUISITES)) {
    violations.push("releaseDependencyGraph: RELEASE_SURFACE_PUBLIC_CLAIMS prerequisite edges drifted");
    held = false;
  }
  const claimsNode = nodes.get("RELEASE_SURFACE_PUBLIC_CLAIMS");
  if (!claimsNode || claimsNode.status !== "BLOCKED" || claimsNode.completionEvidence !== null) {
    violations.push("releaseDependencyGraph: RELEASE_SURFACE_PUBLIC_CLAIMS must remain BLOCKED with no completion evidence");
    held = false;
  }
  for (const flag of ["activationReady", "releaseAuthorizationVerified", "mainnetExecutionAuthorized"]) {
    if (releaseGraph[flag] !== false) {
      violations.push(`releaseDependencyGraph.${flag}: must remain false`);
      held = false;
    }
  }
  if (releaseGraph.mainnetStatus !== "HOLD") {
    violations.push("releaseDependencyGraph.mainnetStatus: must remain HOLD");
    held = false;
  }
  return held;
}

function validateTerminalSurface(manifest, violations) {
  const expected = {
    zeroUnauthorizedCuts: true,
    allFeatureRowsMapped: true,
    productionParityPacketComplete: false,
    releaseSurfaceClaimsPacketComplete: false,
    activationReady: false,
    deploymentAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  };
  let held = true;
  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) {
      violations.push(`${key}: expected ${JSON.stringify(value)}`);
      held = false;
    }
  }
  return held;
}

function resultSurface({ violations, blockers, sourceInheritanceVerified, featureInventoryMapped, implementationSliceInventoryComplete, releaseClaimsHeld }) {
  const valid = violations.length === 0;
  return {
    valid,
    profile: valid ? "PRODUCTION" : null,
    sourceInheritanceVerified: valid && sourceInheritanceVerified,
    featureInventoryMapped: valid && featureInventoryMapped,
    zeroUnauthorizedCuts: valid && featureInventoryMapped,
    implementationSliceInventoryComplete: valid && implementationSliceInventoryComplete,
    productionParityPacketComplete: false,
    releaseSurfaceClaimsPacketComplete: false,
    publicReleaseClaimsAuthorized: false,
    activationReady: false,
    deploymentAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: V2_PARITY_CLAIMS_MAINNET_STATUS,
    releaseClaimsHeld: valid && releaseClaimsHeld,
    blockers: Object.freeze([...new Set(blockers)]),
    violations: Object.freeze([...violations]),
  };
}

export function validateV2ParityClaimsReadinessManifest(manifest, options = {}) {
  const repositoryRoot = options.repositoryRoot ?? REPOSITORY_ROOT;
  const violations = [];
  const blockers = [];
  if (!canonicalJsonTree(manifest, "manifest", violations)) {
    return resultSurface({
      violations,
      blockers,
      sourceInheritanceVerified: false,
      featureInventoryMapped: false,
      implementationSliceInventoryComplete: false,
      releaseClaimsHeld: false,
    });
  }
  if (!exactKeys(manifest, TOP_LEVEL_KEYS, "manifest", violations)) {
    return resultSurface({
      violations,
      blockers,
      sourceInheritanceVerified: false,
      featureInventoryMapped: false,
      implementationSliceInventoryComplete: false,
      releaseClaimsHeld: false,
    });
  }
  if (manifest.schema !== V2_PARITY_CLAIMS_SCHEMA || manifest.profile !== "PRODUCTION" || manifest.status !== "BLOCKED") {
    violations.push("manifest: expected canonical schema, PRODUCTION profile, and BLOCKED status");
  }
  if (!exactKeys(manifest.scope, ["contract", "doesNotCertify"], "scope", violations)
    || manifest.scope.contract !== EXPECTED_SCOPE.contract
    || !exactArray(manifest.scope.doesNotCertify, EXPECTED_SCOPE.doesNotCertify)) {
    violations.push("scope: non-activating certification exclusions drifted");
  }
  const bytesById = readBoundInputs(manifest, repositoryRoot, violations);
  const featureMarkdown = bytesById.get("featureParityContract")?.toString("utf8") ?? "";
  const sourceInventoryMarkdown = bytesById.get("sourceInventory")?.toString("utf8") ?? "";
  let releaseGraph = null;
  try {
    releaseGraph = parseV2ParityClaimsReadinessJson(
      bytesById.get("releaseDependencyGraph")?.toString("utf8") ?? "null",
      "releaseDependencyGraph",
    );
  } catch (error) {
    violations.push(`releaseDependencyGraph: invalid JSON (${error.message})`);
  }
  const canonicalRows = parseFeatureRows(featureMarkdown, violations);
  const sourceInheritanceVerified = validateSourceInheritance(
    manifest.sourceInheritance,
    sourceInventoryMarkdown,
    repositoryRoot,
    violations,
  );
  const featureInventoryMapped = validateFeatureInventory(manifest, canonicalRows, violations)
    && validateDecisionPolicy(manifest.decisionPolicy, violations);
  const implementationSliceInventoryComplete = validateImplementationSlices(
    manifest.implementationSlices,
    repositoryRoot,
    violations,
  );
  const releaseClaimsHeld = validateReleaseClaimsBoundary(manifest.releaseClaimsBoundary, releaseGraph, violations);
  if (!exactArray(manifest.ownerAndExternalInputs, OWNER_EXTERNAL_INPUTS)) {
    violations.push("ownerAndExternalInputs: exact unresolved owner and external inputs drifted");
  }
  validateTerminalSurface(manifest, violations);
  if (Array.isArray(manifest.implementationSlices)) {
    for (const slice of manifest.implementationSlices) {
      if (Array.isArray(slice?.blockers)) blockers.push(...slice.blockers);
    }
  }
  if (releaseGraph && Array.isArray(releaseGraph.nodes)) {
    for (const id of [...RELEASE_CLAIMS_PREREQUISITES, "RELEASE_SURFACE_PUBLIC_CLAIMS"]) {
      const blocker = releaseGraph.nodes.find((node) => node?.id === id)?.blocker;
      if (typeof blocker === "string") blockers.push(`${id}: ${blocker}`);
    }
  }
  return resultSurface({
    violations,
    blockers,
    sourceInheritanceVerified,
    featureInventoryMapped,
    implementationSliceInventoryComplete,
    releaseClaimsHeld,
  });
}

export function parseV2ParityClaimsReadinessJson(text, label = "manifest") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") index += 2;
      else {
        if (character < " ") fail("unescaped control character");
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
        const key = parseStringToken();
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
      parseStringToken();
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

export function loadV2ParityClaimsReadinessManifest(path = DEFAULT_MANIFEST_PATH) {
  const resolved = resolve(path);
  return parseV2ParityClaimsReadinessJson(readFileSync(resolved, "utf8"), resolved);
}

function parseCli(argv) {
  const result = {
    manifestPath: DEFAULT_MANIFEST_PATH,
    requireParityComplete: false,
    requireReleaseClaimsComplete: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--manifest") {
      if (!argv[index + 1]) throw new Error("--manifest requires a path");
      result.manifestPath = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--require-parity-complete") {
      result.requireParityComplete = true;
    } else if (argument === "--require-release-claims-complete") {
      result.requireReleaseClaimsComplete = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return result;
}

function main() {
  let cli;
  let manifest;
  try {
    cli = parseCli(process.argv.slice(2));
    manifest = loadV2ParityClaimsReadinessManifest(cli.manifestPath);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const result = validateV2ParityClaimsReadinessManifest(manifest);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
  else if ((cli.requireParityComplete && !result.productionParityPacketComplete)
    || (cli.requireReleaseClaimsComplete && !result.releaseSurfaceClaimsPacketComplete)) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

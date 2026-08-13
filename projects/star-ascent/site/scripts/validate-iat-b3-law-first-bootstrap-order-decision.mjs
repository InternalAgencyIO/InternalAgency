import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sha256CanonicalJson } from "./iat-v2-canonical-json.mjs";
import { parseB3OwnerPolicyFreezeJson } from "./validate-iat-b3-owner-policy-freeze.mjs";

export const LAW_FIRST_BOOTSTRAP_ORDER_DECISION_SCHEMA =
  "iat-b3-law-first-bootstrap-order-decision/v1";
export const LAW_FIRST_BOOTSTRAP_ORDER_DECISION_STATUS =
  "ENGINEERING_RECOMMENDED_OWNER_ACCEPTANCE_REQUIRED_HOLD";
export const LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID =
  "TREZOR_MODEL_T_CONTROLLED_FULL_SUPPLY_TRANSIT";

export const CURRENT_CANONICAL_CEREMONY_ORDER = Object.freeze([
  "DEPLOY_LAW_WITH_HARDWARE_UPGRADE_AUTHORITY",
  "DEPLOY_ECONOMY_WITH_HARDWARE_UPGRADE_AUTHORITY",
  "VERIFY_EXACT_PROGRAM_BYTES_AND_IDENTITIES",
  "REVOKE_LAW_UPGRADE_AUTHORITY",
  "REVOKE_ECONOMY_UPGRADE_AUTHORITY",
  "VERIFY_BOTH_PROGRAMS_IMMUTABLE",
  "CREATE_EXACT_TOKEN_2022_MINT",
  "ENTER_GENESIS_STAGING",
  "CREATE_AND_FUND_CANONICAL_ACCOUNTS",
  "VERIFY_GENESIS_CONSERVATION_AND_BINDINGS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "INITIALIZE_LAW_AND_SEAL_EXTENSION_AUTHORITIES",
  "VERIFY_MINT_AND_PROGRAM_AUTHORITIES_SEALED",
  "FINALIZE_CURRENT_DAY",
  "ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN",
  "VERIFY_ACTIVE_AND_STAGING_DISABLED",
]);

export const TRANSIT_CUSTODY_CANDIDATE_CEREMONY_ORDER = Object.freeze([
  "DEPLOY_LAW_WITH_HARDWARE_UPGRADE_AUTHORITY",
  "DEPLOY_ECONOMY_WITH_HARDWARE_UPGRADE_AUTHORITY",
  "VERIFY_EXACT_PROGRAM_BYTES_AND_IDENTITIES",
  "REVOKE_LAW_UPGRADE_AUTHORITY",
  "REVOKE_ECONOMY_UPGRADE_AUTHORITY",
  "VERIFY_BOTH_PROGRAMS_IMMUTABLE",
  "CREATE_EXACT_TOKEN_2022_MINT_AUTHENTICATED_TRANSIT_ATA_AND_MINT_FULL_SUPPLY_ONCE",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "INITIALIZE_LAW_AND_SEAL_EXTENSION_AUTHORITIES",
  "VERIFY_MINT_AND_PROGRAM_AUTHORITIES_SEALED",
  "FINALIZE_CURRENT_DAY_AND_VERIFY_OPEN_BEFORE_ECONOMY",
  "ENTER_GENESIS_STAGING",
  "CREATE_EXACT_CANONICAL_DESTINATIONS_AND_TRANSFER_FROM_TRANSIT_UNDER_OPEN_LAW_WITH_PER_TRANSFER_CONSERVATION",
  "VERIFY_FINAL_GENESIS_CONSERVATION_AND_ZERO_TRANSIT_BALANCE",
  "ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN",
  "VERIFY_ACTIVE_STAGING_DISABLED_AND_CLOSE_ZERO_BALANCE_TRANSIT_ATA",
]);

export const CURRENT_CANONICAL_CEREMONY_STAGES_SHA256 =
  "6f6d69392db5e9a7426d26c349dea64e12f177c3429f735fdf87f83b07e108ac";
export const TRANSIT_CUSTODY_CANDIDATE_CEREMONY_STAGES_SHA256 =
  "cbee6085861e858be61036c45cec74e90c782b537365e1c780447370a06dfb0f";

export const LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS = Object.freeze([
  Object.freeze({
    id: "IDENTITY_FREEZE",
    path: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
    sha256: "17bcf00f97c5fd95bc39fa9eff120fd7f7678ed77f9bc333c36189f44633cacf",
    byteLength: 16242,
  }),
  Object.freeze({
    id: "PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE",
    path: "projects/star-ascent/site/docs/b3/iat-b3-production-identity-authority-evidence.v1.json",
    sha256: "94fc32f1380843ec31b2d94077061d7e788114d346d71f7c3a1001f2fcd980c5",
    byteLength: 8037,
  }),
  Object.freeze({
    id: "RELEASE_DEPENDENCY_GRAPH",
    path: "projects/star-ascent/site/docs/b3/iat-b3-release-dependency-graph.v1.json",
    sha256: "68b22e29f555adb2f59fe5cf42e6a1bf7783a8c962195de6f7736ccd9b1ea843",
    byteLength: 31813,
  }),
  Object.freeze({
    id: "OWNER_POLICY_FREEZE",
    path: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
    sha256: "95c508a47f9ccfed8d466851196cf4de0928027bebccc35b5842fb2c77449f06",
    byteLength: 12681,
  }),
  Object.freeze({
    id: "OWNER_GATE_POLICY",
    path: "projects/star-ascent/site/docs/b3/iat-b3-owner-gate-policy-decision.v1.json",
    sha256: "0a35ca3fd676dee0b57d213314531922c4ac6239b06384fc9b36ea443494f87d",
    byteLength: 8160,
  }),
  Object.freeze({
    id: "LAW_PROGRAM_SOURCE",
    path: "projects/star-ascent/site/programs/iat_b3_law/src/lib.rs",
    sha256: "ba404c92cbe80c5952f1c525be486636e694ced2525a8dc2b8610f41adfd2cea",
    byteLength: 36873,
  }),
  Object.freeze({
    id: "ECONOMY_PROGRAM_SOURCE",
    path: "projects/star-ascent/site/programs/iat_b3_economy/src/lib.rs",
    sha256: "c83516648a5fefdb7f911b21e8b40b06a13aab54d6ad22cc06cd4c303194a65e",
    byteLength: 339522,
  }),
  Object.freeze({
    id: "ECONOMY_PRODUCTION_ENTRYPOINT",
    path: "projects/star-ascent/site/programs/iat_b3_economy/src/production_entrypoint.rs",
    sha256: "e54aef98fa61c9198adf80dc2724a618184cce7fe360e76e221a4ce1a2953672",
    byteLength: 22614,
  }),
  Object.freeze({
    id: "ECONOMY_INITIALIZATION_POLICY_HOLD",
    path: "projects/star-ascent/site/programs/iat_b3_economy/src/production_initialization_policy_hold.rs",
    sha256: "e2e44f7981075d41e25a4df40253ba3f5fabf911f427f702e69719c3b8b6f647",
    byteLength: 13257,
  }),
  Object.freeze({
    id: "ECONOMY_STAGING_PERSISTENCE",
    path: "projects/star-ascent/site/programs/iat_b3_economy/src/config_genesis_transition/runtime_staging_persistence.rs",
    sha256: "77de06fd578f6c59605616e438180eca231d92fda34aeea12b73f022b24bb493",
    byteLength: 21277,
  }),
  Object.freeze({
    id: "LOCAL_REHEARSAL_ASSESSOR",
    path: "projects/star-ascent/site/scripts/assess-iat-b3-local-rehearsal-readiness.mjs",
    sha256: "c6f018759664bfa537bf56315836c460f50dbf2fea3fff15a357f7c35cd08cee",
    byteLength: 47486,
  }),
  Object.freeze({
    id: "ALL_FEATURE_DEVNET_ASSESSOR",
    path: "projects/star-ascent/site/scripts/assess-iat-b3-all-feature-devnet-readiness.mjs",
    sha256: "6f7ffc5920982cc69013ed2a4bf0413204fe23d675344129ce6cb7a9ef39f3ce",
    byteLength: 75983,
  }),
]);

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const DEFAULT_PACKET_PATH = resolve(fileURLToPath(new URL(
  "../docs/b3/iat-b3-law-first-bootstrap-order-decision.v1.json",
  import.meta.url,
)));
const TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "profile",
  "status",
  "scope",
  "sourceBindings",
  "canonicalState",
  "dependencyAnalysis",
  "engineeringPolicy",
  "ownerDecision",
  "candidateMigration",
  "dependentBindingImpact",
  "signaturePolicy",
  "authorizationBoundary",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected, path, violations) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${path}: expected object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    violations.push(`${path}: expected exact keys ${wanted.join(", ")}`);
    return false;
  }
  return true;
}

function equalArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function stageDigest(order) {
  return sha256CanonicalJson(order.map((step, index) => ({ ordinal: index + 1, step })));
}

function before(order, first, second) {
  return order.indexOf(first) >= 0 && order.indexOf(first) < order.indexOf(second);
}

function sourceSection(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) return "";
  return source.slice(startIndex, endIndex);
}

function requireIncludes(source, snippets, path, violations) {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) violations.push(`${path}: missing source predicate ${snippet}`);
  }
}

export function loadLawFirstBootstrapSourceBytes(repositoryRoot = REPOSITORY_ROOT) {
  return Object.fromEntries(LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS.map((binding) => [
    binding.id,
    readFileSync(resolve(repositoryRoot, binding.path)),
  ]));
}

function validateSourceBindings(packet, sourceBytesById, violations) {
  const declared = packet?.sourceBindings;
  if (!exactKeys(
    declared,
    ["declaredHeadSha", "bindingPolicy", "files"],
    "sourceBindings",
    violations,
  )) return;
  if (declared.declaredHeadSha !== "09ec025b5b301925d49bc24347bafc8a0c7f733d") {
    violations.push("sourceBindings.declaredHeadSha: exact takeover HEAD drifted");
  }
  if (declared.bindingPolicy !== "EXACT_CURRENT_FILE_BYTES_NON_COMPLETION_EVIDENCE") {
    violations.push("sourceBindings.bindingPolicy: source observations must remain non-completion evidence");
  }
  if (!Array.isArray(declared.files)
    || declared.files.length !== LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS.length) {
    violations.push("sourceBindings.files: expected exact source inventory");
    return;
  }
  for (let index = 0; index < LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS.length; index += 1) {
    const expected = LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS[index];
    const actual = declared.files[index];
    if (!exactKeys(actual, ["id", "path", "sha256", "byteLength"], `sourceBindings.files[${index}]`, violations)) continue;
    for (const key of ["id", "path", "sha256", "byteLength"]) {
      if (actual[key] !== expected[key]) {
        violations.push(`sourceBindings.files[${index}].${key}: exact source binding drifted`);
      }
    }
    const bytes = sourceBytesById?.[expected.id];
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
      violations.push(`sourceBindings.files[${index}]: exact source bytes were not supplied`);
      continue;
    }
    const buffer = Buffer.from(bytes);
    if (buffer.length !== expected.byteLength) {
      violations.push(`sourceBindings.files[${index}].byteLength: observed ${buffer.length}, expected ${expected.byteLength}`);
    }
    if (sha256(buffer) !== expected.sha256) {
      violations.push(`sourceBindings.files[${index}].sha256: observed bytes do not match the source binding`);
    }
  }
}

function parseSourceJson(sourceBytesById, id, violations) {
  try {
    return parseB3OwnerPolicyFreezeJson(Buffer.from(sourceBytesById[id]).toString("utf8"), id);
  } catch (error) {
    violations.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function validateCanonicalSources(packet, sourceBytesById, violations) {
  const identity = parseSourceJson(sourceBytesById, "IDENTITY_FREEZE", violations);
  const production = parseSourceJson(sourceBytesById, "PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE", violations);
  const graph = parseSourceJson(sourceBytesById, "RELEASE_DEPENDENCY_GRAPH", violations);
  const owner = parseSourceJson(sourceBytesById, "OWNER_POLICY_FREEZE", violations);
  const gate = parseSourceJson(sourceBytesById, "OWNER_GATE_POLICY", violations);
  if (!identity || !production || !graph || !owner || !gate) return;

  if (identity.readiness !== "BLOCKED" || identity.sealOrder?.status !== "BLOCKED") {
    violations.push("IDENTITY_FREEZE: canonical identity and order must remain BLOCKED");
  }
  if (!equalArray(identity.sealOrder?.steps, CURRENT_CANONICAL_CEREMONY_ORDER)) {
    violations.push("IDENTITY_FREEZE: current canonical ceremony order drifted");
  }
  const journalOrder = production.phaseCDeployedSeal?.journal?.map(({ step }) => step);
  if (production.status !== "PENDING"
    || production.phaseCDeployedSeal?.status !== "PENDING"
    || !equalArray(journalOrder, CURRENT_CANONICAL_CEREMONY_ORDER)
    || production.phaseCDeployedSeal.journal.some(({ status, evidenceSha256 }) => (
      status !== "PENDING" || evidenceSha256 !== null
    ))) {
    violations.push("PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE: exact journal must remain PENDING with null evidence");
  }
  if (graph.status !== "BLOCKED"
    || graph.mainnetStatus !== "HOLD"
    || graph.mainnetExecutionAuthorized !== false) {
    violations.push("RELEASE_DEPENDENCY_GRAPH: graph must remain BLOCKED/HOLD/nonauthorizing");
  }
  const graphBindings = graph.nodes
    .filter(({ contractArtifact }) => (
      contractArtifact?.path
      === "projects/star-ascent/site/docs/b3/iat-b3-production-identity-authority-evidence.v1.json"
    ))
    .map(({ id, contractArtifact }) => ({ id, sha256: contractArtifact.sha256 }));
  const expectedGraphBindingIds = [
    "PRODUCTION_IDENTITY_INPUT_FREEZE",
    "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE",
    "B3_COST_CEREMONY_FUNDING",
  ];
  if (!equalArray(graphBindings.map(({ id }) => id), expectedGraphBindingIds)
    || graphBindings.some(({ sha256: digest }) => digest !== LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS[1].sha256)) {
    violations.push("RELEASE_DEPENDENCY_GRAPH: exact three production-evidence bindings drifted");
  }
  const allocations = owner.nodes?.GENESIS_ALLOCATIONS_CONSERVATION?.ownerChoices;
  for (const key of [
    "communityOwner",
    "treasuryBeneficiary",
    "ecosystemBeneficiary",
    "coreBeneficiary",
    "liquidityBeneficiary",
  ]) {
    if (allocations?.[key] !== null) violations.push(`OWNER_POLICY_FREEZE: ${key} must remain unselected in this packet`);
  }
  if (gate.policy?.humanGate?.soleGate !== "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION"
    || gate.policy?.humanGate?.appliesTo !== "EVERY_REQUIRED_CRYPTOGRAPHIC_SIGNATURE"
    || gate.policy?.humanGate?.otherHumanApprovalGatePermitted !== false
    || gate.policy?.nonSignatureGateClosure?.automatedDirectEvidenceMayClose !== true
    || gate.policy?.claimDisposition?.unobserved !== "HOLD") {
    violations.push("OWNER_GATE_POLICY: Model T-only signature and automated direct-evidence policy drifted");
  }
}

function validateProgramSourcePredicates(sourceBytesById, violations) {
  const law = Buffer.from(sourceBytesById.LAW_PROGRAM_SOURCE).toString("utf8");
  const economy = Buffer.from(sourceBytesById.ECONOMY_PROGRAM_SOURCE).toString("utf8");
  const entrypoint = Buffer.from(sourceBytesById.ECONOMY_PRODUCTION_ENTRYPOINT).toString("utf8");
  const initialization = Buffer.from(sourceBytesById.ECONOMY_INITIALIZATION_POLICY_HOLD).toString("utf8");
  const staging = Buffer.from(sourceBytesById.ECONOMY_STAGING_PERSISTENCE).toString("utf8");
  const local = Buffer.from(sourceBytesById.LOCAL_REHEARSAL_ASSESSOR).toString("utf8");
  const devnet = Buffer.from(sourceBytesById.ALL_FEATURE_DEVNET_ASSESSOR).toString("utf8");

  const initializeLaw = sourceSection(law, "fn process_initialize_law(", "fn process_finalize_day(");
  const finalizeDay = sourceSection(law, "fn process_finalize_day(", "fn process_execute(");
  const validateMintBase = sourceSection(law, "fn validate_mint_base(", "fn validate_transfer_context(");
  requireIncludes(initializeLaw, [
    "validate_mint_extensions(program_id, Some(payer.key), mint)?;",
    "AuthorityType::TransferHookProgramId",
    "AuthorityType::ConfidentialTransferMint",
    "validate_mint_extensions(program_id, None, mint)?;",
    "LawState::uninitialized",
    "ExtraAccountMetaList::init",
  ], "LAW_PROGRAM_SOURCE.process_initialize_law", violations);
  requireIncludes(validateMintBase, [
    "mint.decimals != IAT_DECIMALS",
    "mint.supply != IAT_TOTAL_BASE_UNITS",
    "!mint.mint_authority.is_none()",
    "!mint.freeze_authority.is_none()",
  ], "LAW_PROGRAM_SOURCE.validate_mint_base", violations);
  if ((finalizeDay.match(/next_account_info\(account_iter\)/gu) ?? []).length !== 2
    || !finalizeDay.includes("ensure_day_can_finalize(&state, current_day)?;")
    || !finalizeDay.includes("create_solana_daily_decision(")) {
    violations.push("LAW_PROGRAM_SOURCE.process_finalize_day: exact mint/Law-state finalization dependency drifted");
  }

  requireIncludes(economy, [
    "pub fn verify_daily_law_open(",
    "IatTransferDisposition::DayUnfinalized => Err(EconomyError::DayUnfinalized)",
    "IatTransferDisposition::RejectedDailyLockdown => Err(EconomyError::DailyLockdown)",
    "pub fn initialize_config(\n    gate: &ValidatedDailyLawWrite,",
    "pub fn initialize_lane_vault(\n    _gate: &ValidatedDailyLawWrite,",
    "pub fn initialize_stake_vault(\n    _gate: &ValidatedDailyLawWrite,",
  ], "ECONOMY_PROGRAM_SOURCE", violations);
  const gateIndex = entrypoint.indexOf("verify_runtime_daily_law_open_account_info(law, law_state)");
  const dispatchIndex = entrypoint.indexOf("dispatch_authenticated_production_instruction(", gateIndex);
  if (gateIndex < 0 || dispatchIndex <= gateIndex) {
    violations.push("ECONOMY_PRODUCTION_ENTRYPOINT: open Daily Law must be verified before dispatch/decode");
  }
  requireIncludes(initialization, [
    "opaque_runtime_daily_law_required_before_decode: true",
    "owner_policy_held_route_count: 4",
    "compile_time_disabled_route_count: 1",
    "operation_accounts_accepted: false",
    "ProductionInstruction::InitializeConfig",
    "ProductionInstruction::InitializeLaneVault",
    "ProductionInstruction::InitializeStakeVault",
    "ProductionInstruction::Activate",
    "ProductionInstruction::RegisterAgency",
  ], "ECONOMY_INITIALIZATION_POLICY_HOLD", violations);
  requireIncludes(staging, [
    "daily_law_deliberately_not_required: true",
    "production_execution_guard_constructible: false",
    "instruction_abi_frozen: false",
    "entrypoint_exposed: false",
    "dispatcher_exposed: false",
    "mainnet_hold: true",
  ], "ECONOMY_STAGING_PERSISTENCE", violations);
  requireIncludes(local, [
    "extractCanonicalCeremonyStages,",
    "const ceremonyStages = extractCanonicalCeremonyStages(",
    "const ceremonyReady = ceremonyStages?.count === 17;",
  ], "LOCAL_REHEARSAL_ASSESSOR", violations);
  requireIncludes(devnet, [
    "export function extractCanonicalCeremonyStages",
    "journal.length !== 17",
    "bindingSha256: canonicalSha256(stages)",
  ], "ALL_FEATURE_DEVNET_ASSESSOR", violations);
}

function validatePacketPolicy(packet, violations) {
  if (!exactKeys(packet, TOP_LEVEL_KEYS, "packet", violations)) return;
  if (packet.schema !== LAW_FIRST_BOOTSTRAP_ORDER_DECISION_SCHEMA) {
    violations.push("packet.schema: unsupported schema");
  }
  if (packet.profile !== "PRODUCTION" || packet.status !== LAW_FIRST_BOOTSTRAP_ORDER_DECISION_STATUS) {
    violations.push("packet: must remain PRODUCTION ENGINEERING_RECOMMENDED_OWNER_ACCEPTANCE_REQUIRED_HOLD");
  }
  if (packet.scope?.contract !== "NONAUTHORIZING_LAW_FIRST_BOOTSTRAP_ORDER_DECISION"
    || packet.scope?.objective
      !== "MINT_AND_CURRENT_FINALIZED_OPEN_LAW_BEFORE_ANY_ECONOMY_INITIALIZATION_OR_STAGING_OPCODE") {
    violations.push("scope: Law-first nonauthorizing boundary drifted");
  }

  const canonical = packet.canonicalState;
  if (!exactKeys(canonical, [
    "identityFreezeStatus",
    "productionEvidenceStatus",
    "graphStatus",
    "graphMainnetStatus",
    "stageCount",
    "ceremonyStagesSha256",
    "order",
    "canonicalOrderChanged",
  ], "canonicalState", violations)) return;
  if (canonical.identityFreezeStatus !== "BLOCKED"
    || canonical.productionEvidenceStatus !== "PENDING"
    || canonical.graphStatus !== "BLOCKED"
    || canonical.graphMainnetStatus !== "HOLD"
    || canonical.stageCount !== 17
    || canonical.canonicalOrderChanged !== false
    || !equalArray(canonical.order, CURRENT_CANONICAL_CEREMONY_ORDER)
    || canonical.ceremonyStagesSha256 !== CURRENT_CANONICAL_CEREMONY_STAGES_SHA256
    || stageDigest(canonical.order) !== CURRENT_CANONICAL_CEREMONY_STAGES_SHA256) {
    violations.push("canonicalState: exact unchanged BLOCKED/PENDING/HOLD 17-stage order drifted");
  }

  const analysis = packet.dependencyAnalysis;
  if (analysis?.lawInitializationMintBasePrecondition
      !== "INITIALIZED_DECIMALS_9_FIXED_SUPPLY_MINT_AUTHORITY_NULL_FREEZE_AUTHORITY_NULL"
    || analysis?.economyProductionBoundary
      !== "CURRENT_FINALIZED_OPEN_CANONICAL_DAILY_LAW_REQUIRED_BEFORE_INSTRUCTION_DECODE"
    || analysis?.stagingCandidateBoundary
      !== "CURRENT_SOURCE_HAS_NO_PRODUCTION_GUARD_ABI_ENTRYPOINT_OR_DISPATCH"
    || analysis?.simpleStageReorderSafe !== false
    || typeof analysis?.exactBlocker !== "string"
    || !analysis.exactBlocker.includes("authenticated full-supply transit ATA architecture")
    || !analysis.exactBlocker.includes("Model T-signed owner acceptance remain null")) {
    violations.push("dependencyAnalysis: exact source-proven blocker drifted");
  }

  const policy = packet.engineeringPolicy;
  if (!exactKeys(policy, [
    "id",
    "status",
    "recommended",
    "asset",
    "transit",
    "lawFirstBoundary",
    "transferPolicy",
    "failurePolicy",
    "closePolicy",
  ], "engineeringPolicy", violations)) return;
  if (policy.id !== LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID
    || policy.status !== LAW_FIRST_BOOTSTRAP_ORDER_DECISION_STATUS
    || policy.recommended !== true) {
    violations.push("engineeringPolicy: exact recommended policy identity/status drifted");
  }
  const asset = policy.asset;
  if (!exactKeys(asset, [
    "tokenProgramId",
    "decimals",
    "fullSupplyTokens",
    "fullSupplyBaseUnits",
    "mintOperationCount",
    "additionalMintOperationsPermitted",
    "mintAuthorityAfterFullSupplyMint",
    "freezeAuthorityBeforeLawInitialization",
  ], "engineeringPolicy.asset", violations)) return;
  if (asset.tokenProgramId !== "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    || asset.decimals !== 9
    || asset.fullSupplyTokens !== "1000000000"
    || asset.fullSupplyBaseUnits !== "1000000000000000000"
    || asset.mintOperationCount !== 1
    || asset.additionalMintOperationsPermitted !== false
    || asset.mintAuthorityAfterFullSupplyMint !== null
    || asset.freezeAuthorityBeforeLawInitialization !== null) {
    violations.push("engineeringPolicy.asset: exact 1B/9-decimal single-mint terminal-authority policy drifted");
  }
  const transit = policy.transit;
  if (!exactKeys(transit, [
    "accountKind",
    "address",
    "ownerPublicKey",
    "addressAuthentication",
    "authorityCustody",
    "hotKeyPermitted",
    "serverAuthorityPermitted",
    "delegate",
    "separateCloseAuthority",
  ], "engineeringPolicy.transit", violations)) return;
  if (transit.accountKind !== "TOKEN_2022_ASSOCIATED_TOKEN_ACCOUNT"
    || transit.address !== null
    || transit.ownerPublicKey !== null
    || transit.addressAuthentication
      !== "DERIVE_ASSOCIATED_TOKEN_ADDRESS_FROM_CANONICAL_MINT_TOKEN_2022_AND_TRANSIT_OWNER"
    || transit.authorityCustody !== "TREZOR_MODEL_T_ONLY"
    || transit.hotKeyPermitted !== false
    || transit.serverAuthorityPermitted !== false
    || transit.delegate !== null
    || transit.separateCloseAuthority !== null) {
    violations.push("engineeringPolicy.transit: authenticated Model T-only ATA must remain owner/address-null and free of hot/server/delegate authority");
  }
  const lawFirst = policy.lawFirstBoundary;
  const lawFirstKeys = [
    "fullSupplyInAuthenticatedTransitBeforeLawInitialization",
    "mintAuthorityNullBeforeLawInitialization",
    "freezeAuthorityNullBeforeLawInitialization",
    "lawInitializationSealsExtensionAuthorities",
    "currentDayFinalizedBeforeAnyEconomyOpcode",
    "currentDayVerifiedOpenBeforeAnyEconomyOpcode",
    "economyOpcodeBeforeCurrentOpenLawPermitted",
  ];
  if (!exactKeys(lawFirst, lawFirstKeys, "engineeringPolicy.lawFirstBoundary", violations)) return;
  if (lawFirstKeys.slice(0, -1).some((key) => lawFirst[key] !== true)
    || lawFirst.economyOpcodeBeforeCurrentOpenLawPermitted !== false) {
    violations.push("engineeringPolicy.lawFirstBoundary: fixed supply, null authorities, sealed Law, and open day must precede every Economy opcode");
  }
  const transfer = policy.transferPolicy;
  if (!exactKeys(transfer, [
    "source",
    "destinationPolicy",
    "canonicalDestinationManifestSha256",
    "canonicalDestinations",
    "currentFinalizedOpenLawRequiredForEveryTransfer",
    "exactConservationAfterEveryTransfer",
    "arbitraryDestinationPermitted",
  ], "engineeringPolicy.transferPolicy", violations)) return;
  if (transfer.source !== "AUTHENTICATED_TRANSIT_ATA_ONLY"
    || transfer.destinationPolicy !== "EXACT_CANONICAL_VAULT_OR_OWNER_ACCEPTED_BENEFICIARY_ONLY"
    || transfer.canonicalDestinationManifestSha256 !== null
    || transfer.currentFinalizedOpenLawRequiredForEveryTransfer !== true
    || transfer.exactConservationAfterEveryTransfer !== true
    || transfer.arbitraryDestinationPermitted !== false) {
    violations.push("engineeringPolicy.transferPolicy: exact source/destination/open-Law/per-transfer-conservation policy drifted");
  }
  const destinationKeys = [
    "communityOwner",
    "treasuryBeneficiary",
    "ecosystemBeneficiary",
    "coreBeneficiary",
    "liquidityBeneficiary",
  ];
  if (!exactKeys(
    transfer.canonicalDestinations,
    destinationKeys,
    "engineeringPolicy.transferPolicy.canonicalDestinations",
    violations,
  )) return;
  if (destinationKeys.some((key) => transfer.canonicalDestinations[key] !== null)) {
    violations.push("engineeringPolicy.transferPolicy.canonicalDestinations: unaccepted destination keys must remain null");
  }
  const failure = policy.failurePolicy;
  if (!exactKeys(failure, [
    "automaticRetry",
    "automaticResubmission",
    "lockedDayAction",
    "preTransferFailureAction",
    "midTransferFailureAction",
    "manualReconciliationRequiredBeforeAnyNewAttempt",
    "ambiguousTransactionOutcome",
  ], "engineeringPolicy.failurePolicy", violations)) return;
  if (failure.automaticRetry !== false
    || failure.automaticResubmission !== false
    || failure.lockedDayAction !== "STOP_BEFORE_ECONOMY_WITH_FULL_IMMUTABLE_SUPPLY_IN_TRANSIT"
    || failure.preTransferFailureAction !== "STOP_WITH_FULL_IMMUTABLE_SUPPLY_IN_TRANSIT"
    || failure.midTransferFailureAction
      !== "STOP_WITH_UNTRANSFERRED_IMMUTABLE_SUPPLY_IN_TRANSIT_AND_RETAIN_VERIFIED_CANONICAL_TRANSFERS"
    || failure.manualReconciliationRequiredBeforeAnyNewAttempt !== true
    || failure.ambiguousTransactionOutcome !== "STOP_AND_OBSERVE_CHAIN_STATE_NO_RESUBMISSION") {
    violations.push("engineeringPolicy.failurePolicy: fail-stop/no-retry immutable-transit policy drifted");
  }
  const close = policy.closePolicy;
  if (!exactKeys(close, [
    "closePermittedBeforeActivation",
    "requiresActivationObserved",
    "requiresZeroTransitBalance",
    "requiresFinalConservationVerified",
    "closeOnlyAfterActivationAtZero",
    "rentDestination",
  ], "engineeringPolicy.closePolicy", violations)) return;
  if (close.closePermittedBeforeActivation !== false
    || close.requiresActivationObserved !== true
    || close.requiresZeroTransitBalance !== true
    || close.requiresFinalConservationVerified !== true
    || close.closeOnlyAfterActivationAtZero !== true
    || close.rentDestination !== "TRANSIT_OWNER_PUBLIC_KEY") {
    violations.push("engineeringPolicy.closePolicy: transit may close only at zero after observed activation and final conservation");
  }

  const decision = packet.ownerDecision;
  if (!exactKeys(decision, [
    "state",
    "engineeringRecommendationId",
    "ownerSelectedPolicyId",
    "transitOwnerPublicKey",
    "signedAcceptance",
    "trezorModelTConfirmationObserved",
    "signatureVerified",
    "requiredModelTFields",
  ], "ownerDecision", violations)) return;
  if (decision.state !== "ENGINEERING_RECOMMENDATION_UNACCEPTED"
    || decision.engineeringRecommendationId !== LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID
    || decision.ownerSelectedPolicyId !== null
    || decision.transitOwnerPublicKey !== null
    || decision.signedAcceptance !== null
    || decision.trezorModelTConfirmationObserved !== false
    || decision.signatureVerified !== false
    || !equalArray(decision.requiredModelTFields, [
      "TRANSIT_OWNER_PUBLIC_KEY",
      "OWNER_SIGNED_POLICY_ACCEPTANCE",
    ])) {
    violations.push("ownerDecision: engineering recommendation must remain owner-unaccepted with exact Model T fields null");
  }

  const candidate = packet.candidateMigration;
  if (!exactKeys(candidate, [
    "status",
    "policyId",
    "appliesOnlyIf",
    "stageCount",
    "assessorConsumption",
    "ceremonyStagesSha256",
    "order",
    "invariants",
  ], "candidateMigration", violations)) return;
  if (candidate.status !== "ENGINEERING_RECOMMENDED_OWNER_UNACCEPTED_NONAUTHORIZING"
    || candidate.policyId !== LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID
    || candidate.appliesOnlyIf
      !== "OWNER_ACCEPTS_WITH_TREZOR_MODEL_T_AND_EVERY_NULL_IDENTITY_DESTINATION_AND_EVIDENCE_BINDING_IS_SOURCE_BOUND"
    || candidate?.stageCount !== 17
    || candidate.assessorConsumption !== "ORDINAL_AND_STEP_ARRAY_CANONICAL_SHA256"
    || !equalArray(candidate?.order, TRANSIT_CUSTODY_CANDIDATE_CEREMONY_ORDER)
    || new Set(candidate?.order ?? []).size !== 17
    || candidate?.ceremonyStagesSha256 !== TRANSIT_CUSTODY_CANDIDATE_CEREMONY_STAGES_SHA256
    || stageDigest(candidate?.order ?? []) !== TRANSIT_CUSTODY_CANDIDATE_CEREMONY_STAGES_SHA256) {
    violations.push("candidateMigration: exact engineering-recommended nonauthorizing 17-stage proposal drifted");
  } else if (!before(candidate.order, candidate.order[6], "REVOKE_MINT_AUTHORITY")
    || !before(candidate.order, "REVOKE_MINT_AUTHORITY", "INITIALIZE_LAW_AND_SEAL_EXTENSION_AUTHORITIES")
    || !before(candidate.order, "REVOKE_FREEZE_AUTHORITY", "INITIALIZE_LAW_AND_SEAL_EXTENSION_AUTHORITIES")
    || !before(candidate.order, "INITIALIZE_LAW_AND_SEAL_EXTENSION_AUTHORITIES", "FINALIZE_CURRENT_DAY_AND_VERIFY_OPEN_BEFORE_ECONOMY")
    || !before(candidate.order, "FINALIZE_CURRENT_DAY_AND_VERIFY_OPEN_BEFORE_ECONOMY", "ENTER_GENESIS_STAGING")
    || !before(candidate.order, "ENTER_GENESIS_STAGING", "CREATE_EXACT_CANONICAL_DESTINATIONS_AND_TRANSFER_FROM_TRANSIT_UNDER_OPEN_LAW_WITH_PER_TRANSFER_CONSERVATION")
    || !before(candidate.order, "VERIFY_FINAL_GENESIS_CONSERVATION_AND_ZERO_TRANSIT_BALANCE", "ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN")
    || !before(candidate.order, "ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN", "VERIFY_ACTIVE_STAGING_DISABLED_AND_CLOSE_ZERO_BALANCE_TRANSIT_ATA")) {
    violations.push("candidateMigration.order: Law-first authority-safe dependency order drifted");
  }
  if (!equalArray(candidate.invariants, [
    "EXACTLY_17_UNIQUE_STAGES",
    "PROGRAM_BYTES_VERIFIED_AND_UPGRADE_AUTHORITIES_REVOKED_BEFORE_MINT_CREATION",
    "FIXED_SUPPLY_MINTED_AND_BASE_AUTHORITIES_NULL_BEFORE_LAW_INITIALIZATION",
    "LAW_INITIALIZED_EXTENSION_AUTHORITIES_NULL_AND_CURRENT_DAY_OPEN_BEFORE_ECONOMY",
    "CANONICAL_DESTINATIONS_FUNDED_ONLY_FROM_AUTHENTICATED_TRANSIT_BY_LAW_GATED_TRANSFERS",
    "CONSERVATION_VERIFIED_AFTER_EVERY_TRANSFER",
    "NO_AUTOMATIC_RETRY_OR_RESUBMISSION",
    "LOCKED_OR_FAILED_FLOW_STOPS_WITH_IMMUTABLE_UNTRANSFERRED_SUPPLY_IN_TRANSIT",
    "ACTIVATION_ONLY_ON_CURRENT_OPEN_LAW",
    "TRANSIT_CLOSE_ONLY_AFTER_ACTIVATION_AND_ZERO_BALANCE",
  ])) {
    violations.push("candidateMigration.invariants: exact engineering policy invariants drifted");
  }

  const impact = packet.dependentBindingImpact;
  if (!Array.isArray(impact)
    || impact.length !== 3
    || impact[0]?.currentSha256 !== LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS[0].sha256
    || impact[1]?.currentSha256 !== LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS[1].sha256
    || impact[2]?.currentSha256 !== CURRENT_CANONICAL_CEREMONY_STAGES_SHA256) {
    violations.push("dependentBindingImpact: exact prospective stale-binding map drifted");
  }

  const signature = packet.signaturePolicy;
  if (signature?.humanGateCount !== 1
    || signature?.soleHumanGate !== "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION"
    || signature?.appliesOnlyTo !== "ACTUAL_CRYPTOGRAPHIC_SIGNATURES"
    || signature?.repositoryDecisionPacketSignatureRequired !== false
    || signature?.otherHumanReviewPrerequisitePermitted !== false
    || signature?.automatedDirectEvidenceMayCloseNonSignatureGates !== true
    || signature?.unobservedClaims !== "HOLD") {
    violations.push("signaturePolicy: exact Model T-only actual-signature policy drifted");
  }

  const boundary = packet.authorizationBoundary;
  const falseKeys = [
    "engineeringPolicyAccepted",
    "ownerOptionSelected",
    "transitOwnerBound",
    "ownerSignedAcceptancePresent",
    "canonicalOrderChanged",
    "completionEvidencePresent",
    "ceremonyAuthorized",
    "signingAuthorized",
    "deploymentAuthorized",
    "devnetAuthorized",
    "activationAuthorized",
    "releaseAuthorized",
    "mainnetAuthorized",
  ];
  if (!exactKeys(boundary, [...falseKeys, "mainnetStatus"], "authorizationBoundary", violations)) return;
  if (falseKeys.some((key) => boundary[key] !== false) || boundary.mainnetStatus !== "HOLD") {
    violations.push("authorizationBoundary: every authority flag must remain false and Mainnet HOLD");
  }
}

export function validateLawFirstBootstrapOrderDecision(packet, options = {}) {
  const violations = [];
  const sourceBytesById = options.sourceBytesById ?? loadLawFirstBootstrapSourceBytes(
    options.repositoryRoot ?? REPOSITORY_ROOT,
  );
  validatePacketPolicy(packet, violations);
  validateSourceBindings(packet, sourceBytesById, violations);
  validateCanonicalSources(packet, sourceBytesById, violations);
  validateProgramSourcePredicates(sourceBytesById, violations);
  return Object.freeze({
    valid: violations.length === 0,
    status: packet?.status ?? null,
    engineeringPolicyRecommended:
      packet?.engineeringPolicy?.id === LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID
      && packet?.engineeringPolicy?.recommended === true,
    ownerAcceptanceRequired:
      packet?.ownerDecision?.ownerSelectedPolicyId === null
      || packet?.ownerDecision?.signedAcceptance === null,
    ownerChoiceRequired:
      packet?.ownerDecision?.ownerSelectedPolicyId === null
      || packet?.ownerDecision?.signedAcceptance === null,
    remainingModelTFields: Object.freeze([
      ...(packet?.ownerDecision?.requiredModelTFields ?? []),
    ]),
    proposedCeremonyStagesSha256: packet?.candidateMigration?.ceremonyStagesSha256 ?? null,
    canonicalOrderChanged: packet?.canonicalState?.canonicalOrderChanged === true,
    completionEvidencePresent: packet?.authorizationBoundary?.completionEvidencePresent === true,
    signingAuthorized: false,
    deploymentAuthorized: false,
    devnetAuthorized: false,
    activationAuthorized: false,
    releaseAuthorized: false,
    mainnetAuthorized: false,
    mainnetStatus: "HOLD",
    violations: Object.freeze(violations),
  });
}

export function parseLawFirstBootstrapOrderDecisionJson(text, label = "law-first-bootstrap-order-decision") {
  return parseB3OwnerPolicyFreezeJson(text, label);
}

export function loadLawFirstBootstrapOrderDecision(path = DEFAULT_PACKET_PATH) {
  const resolved = resolve(path);
  return parseLawFirstBootstrapOrderDecisionJson(readFileSync(resolved, "utf8"), resolved);
}

function main() {
  const path = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_PACKET_PATH;
  try {
    const result = validateLawFirstBootstrapOrderDecision(
      loadLawFirstBootstrapOrderDecision(path),
    );
    console.log(JSON.stringify({ packetPath: path, ...result }, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

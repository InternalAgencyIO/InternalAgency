import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sha256CanonicalJson } from "../scripts/iat-v2-canonical-json.mjs";
import {
  CURRENT_CANONICAL_CEREMONY_ORDER,
  CURRENT_CANONICAL_CEREMONY_STAGES_SHA256,
  LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID,
  LAW_FIRST_BOOTSTRAP_ORDER_DECISION_STATUS,
  LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS,
  TRANSIT_CUSTODY_CANDIDATE_CEREMONY_ORDER,
  TRANSIT_CUSTODY_CANDIDATE_CEREMONY_STAGES_SHA256,
  loadLawFirstBootstrapSourceBytes,
  parseLawFirstBootstrapOrderDecisionJson,
  validateLawFirstBootstrapOrderDecision,
} from "../scripts/validate-iat-b3-law-first-bootstrap-order-decision.mjs";

const packetText = readFileSync(
  new URL("../docs/b3/iat-b3-law-first-bootstrap-order-decision.v1.json", import.meta.url),
  "utf8",
);
const packet = parseLawFirstBootstrapOrderDecisionJson(packetText, "canonical packet");
const sourceBytesById = loadLawFirstBootstrapSourceBytes();

function clone(value) {
  return structuredClone(value);
}

function stageDigest(order) {
  return sha256CanonicalJson(order.map((step, index) => ({ ordinal: index + 1, step })));
}

test("canonical Law-first bootstrap packet recommends exact transit engineering while owner acceptance remains HOLD", () => {
  const result = validateLawFirstBootstrapOrderDecision(packet, { sourceBytesById });
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.status, LAW_FIRST_BOOTSTRAP_ORDER_DECISION_STATUS);
  assert.equal(result.engineeringPolicyRecommended, true);
  assert.equal(result.ownerAcceptanceRequired, true);
  assert.equal(result.ownerChoiceRequired, true);
  assert.deepEqual(result.remainingModelTFields, [
    "TRANSIT_OWNER_PUBLIC_KEY",
    "OWNER_SIGNED_POLICY_ACCEPTANCE",
  ]);
  assert.equal(
    result.proposedCeremonyStagesSha256,
    TRANSIT_CUSTODY_CANDIDATE_CEREMONY_STAGES_SHA256,
  );
  assert.equal(result.canonicalOrderChanged, false);
  assert.equal(result.completionEvidencePresent, false);
  assert.equal(result.signingAuthorized, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.devnetAuthorized, false);
  assert.equal(result.activationAuthorized, false);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.mainnetAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.deepEqual(result.violations, []);
});

test("current and candidate orders have exact distinct 17-stage assessor-compatible digests", () => {
  assert.equal(CURRENT_CANONICAL_CEREMONY_ORDER.length, 17);
  assert.equal(new Set(CURRENT_CANONICAL_CEREMONY_ORDER).size, 17);
  assert.equal(TRANSIT_CUSTODY_CANDIDATE_CEREMONY_ORDER.length, 17);
  assert.equal(new Set(TRANSIT_CUSTODY_CANDIDATE_CEREMONY_ORDER).size, 17);
  assert.equal(
    stageDigest(CURRENT_CANONICAL_CEREMONY_ORDER),
    CURRENT_CANONICAL_CEREMONY_STAGES_SHA256,
  );
  assert.equal(
    stageDigest(TRANSIT_CUSTODY_CANDIDATE_CEREMONY_ORDER),
    TRANSIT_CUSTODY_CANDIDATE_CEREMONY_STAGES_SHA256,
  );
  assert.notEqual(
    CURRENT_CANONICAL_CEREMONY_STAGES_SHA256,
    TRANSIT_CUSTODY_CANDIDATE_CEREMONY_STAGES_SHA256,
  );
  assert.deepEqual(packet.canonicalState.order, CURRENT_CANONICAL_CEREMONY_ORDER);
  assert.deepEqual(packet.candidateMigration.order, TRANSIT_CUSTODY_CANDIDATE_CEREMONY_ORDER);
});

test("candidate preserves fixed supply and terminal authority requirements before open Law and Economy", () => {
  const order = packet.candidateMigration.order;
  const index = (step) => order.indexOf(step);
  const mintSupply = "CREATE_EXACT_TOKEN_2022_MINT_AUTHENTICATED_TRANSIT_ATA_AND_MINT_FULL_SUPPLY_ONCE";
  const law = "INITIALIZE_LAW_AND_SEAL_EXTENSION_AUTHORITIES";
  const open = "FINALIZE_CURRENT_DAY_AND_VERIFY_OPEN_BEFORE_ECONOMY";
  const staging = "ENTER_GENESIS_STAGING";
  assert.ok(index(mintSupply) < index("REVOKE_MINT_AUTHORITY"));
  assert.ok(index(mintSupply) < index("REVOKE_FREEZE_AUTHORITY"));
  assert.ok(index("REVOKE_MINT_AUTHORITY") < index(law));
  assert.ok(index("REVOKE_FREEZE_AUTHORITY") < index(law));
  assert.ok(index(law) < index(open));
  assert.ok(index(open) < index(staging));
  assert.ok(index(staging) < index("CREATE_EXACT_CANONICAL_DESTINATIONS_AND_TRANSFER_FROM_TRANSIT_UNDER_OPEN_LAW_WITH_PER_TRANSFER_CONSERVATION"));
  assert.ok(index("VERIFY_FINAL_GENESIS_CONSERVATION_AND_ZERO_TRANSIT_BALANCE") < index("ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN"));
  assert.ok(index("ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN") < index("VERIFY_ACTIVE_STAGING_DISABLED_AND_CLOSE_ZERO_BALANCE_TRANSIT_ATA"));
  assert.equal(packet.ownerDecision.ownerSelectedPolicyId, null);
  assert.equal(packet.ownerDecision.signedAcceptance, null);
  assert.equal(packet.canonicalState.canonicalOrderChanged, false);
});

test("recommended policy pins one exact 1B/9-decimal mint into an authenticated Model T-only transit ATA", () => {
  const policy = packet.engineeringPolicy;
  assert.equal(policy.id, LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID);
  assert.equal(policy.status, LAW_FIRST_BOOTSTRAP_ORDER_DECISION_STATUS);
  assert.equal(policy.recommended, true);
  assert.deepEqual(policy.asset, {
    tokenProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    decimals: 9,
    fullSupplyTokens: "1000000000",
    fullSupplyBaseUnits: "1000000000000000000",
    mintOperationCount: 1,
    additionalMintOperationsPermitted: false,
    mintAuthorityAfterFullSupplyMint: null,
    freezeAuthorityBeforeLawInitialization: null,
  });
  assert.equal(policy.transit.accountKind, "TOKEN_2022_ASSOCIATED_TOKEN_ACCOUNT");
  assert.equal(policy.transit.address, null);
  assert.equal(policy.transit.ownerPublicKey, null);
  assert.equal(policy.transit.authorityCustody, "TREZOR_MODEL_T_ONLY");
  assert.equal(policy.transit.hotKeyPermitted, false);
  assert.equal(policy.transit.serverAuthorityPermitted, false);
  assert.equal(policy.transit.delegate, null);
  assert.equal(policy.transit.separateCloseAuthority, null);
});

test("every Economy operation and transit transfer is current-open-Law gated with exact conservation", () => {
  const { lawFirstBoundary, transferPolicy } = packet.engineeringPolicy;
  assert.equal(lawFirstBoundary.fullSupplyInAuthenticatedTransitBeforeLawInitialization, true);
  assert.equal(lawFirstBoundary.mintAuthorityNullBeforeLawInitialization, true);
  assert.equal(lawFirstBoundary.freezeAuthorityNullBeforeLawInitialization, true);
  assert.equal(lawFirstBoundary.lawInitializationSealsExtensionAuthorities, true);
  assert.equal(lawFirstBoundary.currentDayFinalizedBeforeAnyEconomyOpcode, true);
  assert.equal(lawFirstBoundary.currentDayVerifiedOpenBeforeAnyEconomyOpcode, true);
  assert.equal(lawFirstBoundary.economyOpcodeBeforeCurrentOpenLawPermitted, false);
  assert.equal(transferPolicy.source, "AUTHENTICATED_TRANSIT_ATA_ONLY");
  assert.equal(
    transferPolicy.destinationPolicy,
    "EXACT_CANONICAL_VAULT_OR_OWNER_ACCEPTED_BENEFICIARY_ONLY",
  );
  assert.equal(transferPolicy.canonicalDestinationManifestSha256, null);
  assert.equal(Object.values(transferPolicy.canonicalDestinations).every((value) => value === null), true);
  assert.equal(transferPolicy.currentFinalizedOpenLawRequiredForEveryTransfer, true);
  assert.equal(transferPolicy.exactConservationAfterEveryTransfer, true);
  assert.equal(transferPolicy.arbitraryDestinationPermitted, false);
});

test("failure handling has no automatic retry and transit closes only at zero after activation", () => {
  const { failurePolicy, closePolicy } = packet.engineeringPolicy;
  assert.equal(failurePolicy.automaticRetry, false);
  assert.equal(failurePolicy.automaticResubmission, false);
  assert.equal(
    failurePolicy.lockedDayAction,
    "STOP_BEFORE_ECONOMY_WITH_FULL_IMMUTABLE_SUPPLY_IN_TRANSIT",
  );
  assert.equal(
    failurePolicy.preTransferFailureAction,
    "STOP_WITH_FULL_IMMUTABLE_SUPPLY_IN_TRANSIT",
  );
  assert.equal(
    failurePolicy.midTransferFailureAction,
    "STOP_WITH_UNTRANSFERRED_IMMUTABLE_SUPPLY_IN_TRANSIT_AND_RETAIN_VERIFIED_CANONICAL_TRANSFERS",
  );
  assert.equal(failurePolicy.manualReconciliationRequiredBeforeAnyNewAttempt, true);
  assert.equal(
    failurePolicy.ambiguousTransactionOutcome,
    "STOP_AND_OBSERVE_CHAIN_STATE_NO_RESUBMISSION",
  );
  assert.equal(closePolicy.closePermittedBeforeActivation, false);
  assert.equal(closePolicy.requiresActivationObserved, true);
  assert.equal(closePolicy.requiresZeroTransitBalance, true);
  assert.equal(closePolicy.requiresFinalConservationVerified, true);
  assert.equal(closePolicy.closeOnlyAfterActivationAtZero, true);
});

test("exact source inventory and any source-byte drift fail closed", () => {
  assert.equal(packet.sourceBindings.files.length, LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS.length);
  assert.deepEqual(packet.sourceBindings.files, LAW_FIRST_BOOTSTRAP_SOURCE_BINDINGS);
  const tamperedSources = Object.fromEntries(
    Object.entries(sourceBytesById).map(([id, bytes]) => [id, Buffer.from(bytes)]),
  );
  tamperedSources.LAW_PROGRAM_SOURCE[0] ^= 1;
  const result = validateLawFirstBootstrapOrderDecision(packet, {
    sourceBytesById: tamperedSources,
  });
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /LAW_PROGRAM_SOURCE|source binding/iu);
  assert.equal(result.mainnetAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("a stage-only shuffle, an invented selection, or any authority promotion is rejected", () => {
  const stageOnly = clone(packet);
  stageOnly.candidateMigration.order[6] = "CREATE_EXACT_TOKEN_2022_MINT";
  assert.match(
    validateLawFirstBootstrapOrderDecision(stageOnly, { sourceBytesById }).violations.join("\n"),
    /candidateMigration/iu,
  );

  const selected = clone(packet);
  selected.ownerDecision.ownerSelectedPolicyId = LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID;
  selected.ownerDecision.state = "OWNER_ACCEPTED";
  assert.match(
    validateLawFirstBootstrapOrderDecision(selected, { sourceBytesById }).violations.join("\n"),
    /ownerDecision/iu,
  );

  for (const key of [
    "engineeringPolicyAccepted",
    "ownerOptionSelected",
    "transitOwnerBound",
    "ownerSignedAcceptancePresent",
    "ceremonyAuthorized",
    "signingAuthorized",
    "deploymentAuthorized",
    "devnetAuthorized",
    "activationAuthorized",
    "releaseAuthorized",
    "mainnetAuthorized",
  ]) {
    const promoted = clone(packet);
    promoted.authorizationBoundary[key] = true;
    const result = validateLawFirstBootstrapOrderDecision(promoted, { sourceBytesById });
    assert.equal(result.valid, false, key);
    assert.match(result.violations.join("\n"), /authorizationBoundary/iu);
  }
});

test("exact remaining owner fields require Model T without adding a human-review gate", () => {
  assert.equal(packet.ownerDecision.state, "ENGINEERING_RECOMMENDATION_UNACCEPTED");
  assert.equal(
    packet.ownerDecision.engineeringRecommendationId,
    LAW_FIRST_BOOTSTRAP_ENGINEERING_POLICY_ID,
  );
  assert.equal(packet.ownerDecision.ownerSelectedPolicyId, null);
  assert.equal(packet.ownerDecision.transitOwnerPublicKey, null);
  assert.equal(packet.ownerDecision.signedAcceptance, null);
  assert.equal(packet.ownerDecision.trezorModelTConfirmationObserved, false);
  assert.equal(packet.ownerDecision.signatureVerified, false);
  assert.deepEqual(packet.ownerDecision.requiredModelTFields, [
    "TRANSIT_OWNER_PUBLIC_KEY",
    "OWNER_SIGNED_POLICY_ACCEPTANCE",
  ]);
  assert.equal(packet.signaturePolicy.humanGateCount, 1);
  assert.equal(packet.signaturePolicy.soleHumanGate, "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION");
  assert.equal(packet.signaturePolicy.appliesOnlyTo, "ACTUAL_CRYPTOGRAPHIC_SIGNATURES");
  assert.equal(packet.signaturePolicy.repositoryDecisionPacketSignatureRequired, false);
  assert.equal(packet.signaturePolicy.otherHumanReviewPrerequisitePermitted, false);
  assert.equal(packet.signaturePolicy.automatedDirectEvidenceMayCloseNonSignatureGates, true);
  assert.equal(packet.signaturePolicy.unobservedClaims, "HOLD");
});

test("dependent hash impact is prospective because this packet does not mutate canonical evidence", () => {
  assert.deepEqual(packet.dependentBindingImpact.map(({ subject, currentSha256 }) => ({
    subject,
    currentSha256,
  })), [
    {
      subject: "IDENTITY_FREEZE_TO_PRODUCTION_EVIDENCE",
      currentSha256: "17bcf00f97c5fd95bc39fa9eff120fd7f7678ed77f9bc333c36189f44633cacf",
    },
    {
      subject: "PRODUCTION_EVIDENCE_TO_RELEASE_GRAPH",
      currentSha256: "94fc32f1380843ec31b2d94077061d7e788114d346d71f7c3a1001f2fcd980c5",
    },
    {
      subject: "LOCAL_AND_DEVNET_CEREMONY_AUTHORIZATION_PACKETS",
      currentSha256: CURRENT_CANONICAL_CEREMONY_STAGES_SHA256,
    },
  ]);
  assert.equal(packet.authorizationBoundary.canonicalOrderChanged, false);
  assert.equal(packet.authorizationBoundary.completionEvidencePresent, false);
});

test("duplicate JSON members are rejected before semantic validation", () => {
  const duplicate = packetText.replace(
    '  "profile": "PRODUCTION",',
    '  "profile": "PRODUCTION",\n  "profile": "PRODUCTION",',
  );
  assert.throws(
    () => parseLawFirstBootstrapOrderDecisionJson(duplicate, "duplicate packet"),
    /duplicate JSON member/iu,
  );
});

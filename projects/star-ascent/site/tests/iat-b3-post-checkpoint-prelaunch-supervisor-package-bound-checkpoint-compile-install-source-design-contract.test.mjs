import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BPS06_JSON_SCHEMA,
  BPS06_PATHS,
  BPS06_SOURCE_DESIGN,
  createBps06SourceDesign,
  validateBps06SourceDesign,
} from "../scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design-contract.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = path.join(
  SITE_ROOT,
  "docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-source-design.v1.schema.json",
);

function rawUtf8Sort(values) {
  return [...values].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

const TRANSITION_KEYS = [
  "acceptedPriorReceiptProducerSetSha256",
  "deadlineBinding",
  "emittedReceipt",
  "emittedReceiptSha256",
  "failureTarget",
  "from",
  "identityBindings",
  "owner",
  "preconditions",
  "priorReceipt",
  "priorReceiptInstanceBindings",
  "priorReceiptProducerType",
  "priorReceiptSha256",
  "to",
].sort();

const CRASH_KEYS = [
  "acceptedPriorReceiptProducerSetSha256",
  "afterPhase",
  "authority",
  "deadlineBinding",
  "emittedReceipt",
  "emittedReceiptSha256",
  "identityBindings",
  "owner",
  "point",
  "preconditions",
  "priorReceipt",
  "priorReceiptInstanceBindings",
  "priorReceiptProducerType",
  "priorReceiptSha256",
  "recoveryTarget",
  "unknownStateDecision",
].sort();

const PRIOR_RECEIPT_INSTANCE_BINDINGS = [
  "EXACT_RECEIPT_BYTES_SHA256",
  "ATTEMPT_ID_EQUAL",
  "RUN_ID_EQUAL",
  "SESSION_ID_EQUAL",
  "WATCHDOG_CAS_STATE_EQUAL",
  "PRODUCER_TYPE_MEMBER_PROOF",
];

function assertTypedTransition(row, label) {
  assert.deepEqual(Object.keys(row).sort(), TRANSITION_KEYS, label + " exact keys");
  assert.equal(typeof row.from, "string", label + " from");
  assert.equal(typeof row.to, "string", label + " to");
  assert.equal(typeof row.owner, "string", label + " owner");
  assert.ok(row.owner.length > 0, label + " owner nonempty");
  assert.ok(Array.isArray(row.preconditions) && row.preconditions.length > 0, label + " preconditions");
  assert.ok(row.priorReceipt === null || (typeof row.priorReceipt === "string" && row.priorReceipt.length > 0), label + " prior receipt");
  assert.equal(row.priorReceiptSha256, null, label + " no source-authored actual prior receipt");
  assert.ok(row.acceptedPriorReceiptProducerSetSha256 === null || /^[0-9a-f]{64}$/u.test(row.acceptedPriorReceiptProducerSetSha256), label + " accepted producer set");
  assert.ok(row.priorReceiptProducerType === null || (typeof row.priorReceiptProducerType === "string" && row.priorReceiptProducerType.length > 0), label + " producer type");
  assert.deepEqual(
    row.priorReceiptInstanceBindings,
    row.priorReceipt === null ? [] : PRIOR_RECEIPT_INSTANCE_BINDINGS,
    label + " exact instance bindings",
  );
  assert.ok(typeof row.emittedReceipt === "string" && row.emittedReceipt.length > 0, label + " emitted receipt");
  assert.equal(row.emittedReceiptSha256, null, label + " no source-authored emitted receipt");
  assert.notEqual(row.priorReceipt, row.emittedReceipt, label + " distinct receipt chain");
  assert.ok(typeof row.deadlineBinding === "string" && row.deadlineBinding.length > 0, label + " deadline");
  assert.ok(Array.isArray(row.identityBindings) && row.identityBindings.length > 0, label + " identities");
  assert.equal(typeof row.failureTarget, "string", label + " failure target");
}

function assertTransitions(section, label) {
  assert.ok(Array.isArray(section.transitions), label + " transitions");
  assert.equal(section.transitions.length, section.phases.length - 1, label + " success transition count");
  for (let index = 0; index < section.transitions.length; index += 1) {
    const row = section.transitions[index];
    assertTypedTransition(row, label + " success " + index);
    assert.equal(row.from, section.phases[index]);
    assert.equal(row.to, section.phases[index + 1]);
    assert.equal(row.failureTarget, section.failurePhases[0]);
  }
  assert.ok(Array.isArray(section.failureTransitions), label + " failureTransitions");
  assert.equal(section.failureTransitions.length, section.phases.length - 1, label + " failure transition count");
  for (const phase of section.phases.slice(0, -1)) {
    const rows = section.failureTransitions.filter((row) => row.from === phase);
    assert.equal(rows.length, 1, label + " failure transition from " + phase);
    assertTypedTransition(rows[0], label + " failure " + phase);
    assert.equal(rows[0].to, section.failurePhases[0]);
    assert.equal(rows[0].failureTarget, section.failurePhases[0]);
  }
  assert.ok(Array.isArray(section.recoveryTransitions), label + " recoveryTransitions");
  assert.equal(section.recoveryTransitions.length, section.failurePhases.length - 1, label + " recovery transition count");
  for (let index = 0; index < section.recoveryTransitions.length; index += 1) {
    const row = section.recoveryTransitions[index];
    assertTypedTransition(row, label + " recovery " + index);
    assert.equal(row.from, section.failurePhases[index]);
    assert.equal(row.to, section.failurePhases[index + 1]);
    assert.equal(row.failureTarget, section.failurePhases[0]);
  }
  assert.equal(
    new Set(section.recoveryTransitions.map((row) => row.emittedReceipt)).size,
    section.recoveryTransitions.length,
    label + " recovery receipts are edge-bound",
  );

  assert.ok(Array.isArray(section.crashTable), label + " crash table");
  assert.deepEqual(
    section.crashTable.map((row) => row.afterPhase),
    section.phases.slice(1, -1),
    label + " every post-transition crash boundary",
  );
  for (const [index, row] of section.crashTable.entries()) {
    assert.deepEqual(Object.keys(row).sort(), CRASH_KEYS, label + " crash " + index + " exact keys");
    assert.ok(typeof row.point === "string" && row.point.length > 0);
    assert.ok(typeof row.owner === "string" && row.owner.length > 0);
    assert.ok(Array.isArray(row.preconditions) && row.preconditions.length > 0);
    assert.ok(typeof row.priorReceipt === "string" && row.priorReceipt.length > 0);
    assert.equal(row.priorReceiptSha256, null);
    assert.equal(row.acceptedPriorReceiptProducerSetSha256, null);
    assert.equal(row.priorReceiptProducerType, `EXACT_${row.priorReceipt}_PRODUCER_TYPE`);
    assert.deepEqual(row.priorReceiptInstanceBindings, PRIOR_RECEIPT_INSTANCE_BINDINGS);
    assert.ok(typeof row.emittedReceipt === "string" && row.emittedReceipt.length > 0);
    assert.equal(row.emittedReceiptSha256, null);
    assert.notEqual(row.priorReceipt, row.emittedReceipt);
    assert.ok(typeof row.deadlineBinding === "string" && row.deadlineBinding.length > 0);
    assert.ok(Array.isArray(row.identityBindings) && row.identityBindings.length > 0);
    assert.equal(row.recoveryTarget, section.failurePhases[0]);
    assert.equal(row.unknownStateDecision, "HOLD");
    assert.equal(row.authority, "NONE");
  }

  assert.ok(Array.isArray(section.recoveryCrashTable), label + " recovery crash table");
  assert.deepEqual(
    section.recoveryCrashTable.map((row) => row.afterPhase),
    section.failurePhases.slice(0, -1),
    label + " every recovery crash boundary",
  );
  assert.deepEqual(
    section.recoveryCrashTable.map((row) => row.point),
    section.failurePhases.slice(0, -1).map((phase) => `RECOVERY_CRASH_AFTER_${phase}`),
    label + " recovery crash points",
  );
  for (const [index, row] of section.recoveryCrashTable.entries()) {
    assert.deepEqual(Object.keys(row).sort(), CRASH_KEYS, label + " recovery crash " + index + " exact keys");
    assert.equal(row.owner, label === "checkpoint" ? "CHECKPOINT_CUSTODIAN" : "EVIDENCE_CUSTODIAN");
    assert.deepEqual(row.preconditions, ["EXACT_AFTER_PHASE", "BOUND_PREIMAGE", "BOUND_IDENTITY_SET"]);
    assert.equal(row.priorReceiptSha256, null);
    assert.deepEqual(row.priorReceiptInstanceBindings, PRIOR_RECEIPT_INSTANCE_BINDINGS);
    assert.equal(row.emittedReceiptSha256, null);
    assert.equal(row.deadlineBinding, "EXTERNAL_TEARDOWN_DEADLINE_AND_TIMER_IDENTITY");
    assert.deepEqual(row.identityBindings, [
      "ATTEMPT_RUN_SESSION",
      `AFTER_${row.afterPhase}_IDENTITY`,
      `CRASH_${row.point}_PREIMAGE`,
      "WATCHDOG_ABORT_CAS",
      "PHASE_RESOURCE_LEDGER",
      "RECOVERY_TARGET_IDENTITIES",
    ]);
    assert.equal(row.recoveryTarget, section.failurePhases[0]);
    assert.equal(row.unknownStateDecision, "HOLD");
    assert.equal(row.authority, "NONE");
  }
}

function producerReceiptForPhase(section, phase) {
  const phaseIndex = section.phases.indexOf(phase);
  assert.ok(phaseIndex >= 0, "known phase " + phase);
  return phaseIndex === 0 ? null : section.transitions[phaseIndex - 1].emittedReceipt;
}

function assertReceiptAncestry(section, label) {
  for (let index = 0; index < section.transitions.length; index += 1) {
    assert.equal(section.transitions[index].priorReceipt, index === 0 ? null : section.transitions[index - 1].emittedReceipt, label + " success ancestry " + index);
    assert.equal(section.transitions[index].priorReceiptProducerType, index === 0 ? null : `EXACT_${section.transitions[index].priorReceipt}_PRODUCER_TYPE`);
    assert.equal(section.transitions[index].acceptedPriorReceiptProducerSetSha256, null);
  }
  for (const row of section.failureTransitions) {
    assert.equal(row.priorReceipt, producerReceiptForPhase(section, row.from), label + " abort ancestry " + row.from);
    assert.equal(row.priorReceiptProducerType, row.priorReceipt === null ? null : `EXACT_${row.priorReceipt}_PRODUCER_TYPE`);
    assert.equal(row.acceptedPriorReceiptProducerSetSha256, null);
  }
  for (const row of section.crashTable) {
    assert.equal(row.priorReceipt, producerReceiptForPhase(section, row.afterPhase), label + " crash ancestry " + row.afterPhase);
    assert.equal(row.priorReceiptProducerType, `EXACT_${row.priorReceipt}_PRODUCER_TYPE`);
    assert.equal(row.acceptedPriorReceiptProducerSetSha256, null);
  }
  for (let index = 0; index < section.recoveryCrashTable.length; index += 1) {
    const row = section.recoveryCrashTable[index];
    if (index === 0) {
      assert.equal(row.priorReceipt, "SHA256_OF_EXACT_ACTUAL_ABORT_OR_CRASH_RECEIPT", label + " recovery crash entry actual receipt");
      assert.equal(row.priorReceiptProducerType, "EXACT_MEMBER_OF_ACCEPTED_PRIOR_RECEIPT_PRODUCER_SET");
    } else {
      assert.equal(row.priorReceipt, section.recoveryTransitions[index - 1].emittedReceipt, label + " recovery crash ancestry " + index);
      assert.equal(row.priorReceiptProducerType, `EXACT_${row.priorReceipt}_PRODUCER_TYPE`);
      assert.equal(row.acceptedPriorReceiptProducerSetSha256, null);
    }
  }
  const acceptedAbortProducers = [
    ...section.failureTransitions.map((row) => row.emittedReceipt),
    ...section.crashTable.map((row) => row.emittedReceipt),
    ...section.recoveryCrashTable.map((row) => row.emittedReceipt),
  ];
  const acceptedProducerSetSha256 = createHash("sha256")
    .update(Buffer.from(JSON.stringify(acceptedAbortProducers) + "\n", "utf8"))
    .digest("hex");
  assert.equal(section.recoveryTransitions[0].priorReceipt, "SHA256_OF_EXACT_ACTUAL_ABORT_OR_CRASH_RECEIPT", label + " actual abort receipt required");
  assert.equal(section.recoveryTransitions[0].priorReceiptSha256, null, label + " actual abort receipt remains external");
  assert.equal(section.recoveryTransitions[0].acceptedPriorReceiptProducerSetSha256, acceptedProducerSetSha256, label + " exact abort producer policy set");
  assert.notEqual(section.recoveryTransitions[0].priorReceipt, acceptedProducerSetSha256, label + " policy digest is not receipt instance");
  assert.equal(section.recoveryTransitions[0].priorReceiptProducerType, "EXACT_MEMBER_OF_ACCEPTED_PRIOR_RECEIPT_PRODUCER_SET");
  assert.equal(section.recoveryCrashTable[0].acceptedPriorReceiptProducerSetSha256, acceptedProducerSetSha256, label + " recovery crash exact abort producer policy set");
  assert.notEqual(section.recoveryCrashTable[0].priorReceipt, acceptedProducerSetSha256, label + " recovery crash policy digest is not receipt instance");
  for (let index = 1; index < section.recoveryTransitions.length; index += 1) {
    assert.equal(section.recoveryTransitions[index].priorReceipt, section.recoveryTransitions[index - 1].emittedReceipt, label + " recovery ancestry " + index);
    assert.equal(section.recoveryTransitions[index].priorReceiptProducerType, `EXACT_${section.recoveryTransitions[index].priorReceipt}_PRODUCER_TYPE`);
    assert.equal(section.recoveryTransitions[index].acceptedPriorReceiptProducerSetSha256, null);
  }
  const emittedReceipts = [
    ...section.transitions,
    ...section.failureTransitions,
    ...section.recoveryTransitions,
    ...section.crashTable,
    ...section.recoveryCrashTable,
  ].map((row) => row.emittedReceipt);
  assert.equal(new Set(emittedReceipts).size, emittedReceipts.length, label + " emitted receipts unique");
}

function assertPhaseOwners() {
  const checkpoint = BPS06_SOURCE_DESIGN.checkpointDesign;
  for (const row of checkpoint.transitions) assert.equal(row.owner, "CHECKPOINT_WATCHDOG");
  for (const row of checkpoint.failureTransitions) assert.equal(row.owner, "CHECKPOINT_CUSTODIAN");
  for (const row of checkpoint.recoveryTransitions) assert.equal(row.owner, "CHECKPOINT_CUSTODIAN");
  for (const row of checkpoint.crashTable) assert.equal(row.owner, "CHECKPOINT_WATCHDOG");
  for (const row of checkpoint.recoveryCrashTable) assert.equal(row.owner, "CHECKPOINT_CUSTODIAN");

  const install = BPS06_SOURCE_DESIGN.installDesign;
  const custodyIndex = install.phases.indexOf("CUSTODY_ACKED");
  for (const row of install.transitions) {
    const expectedOwner = ["UNSTARTED", "PREARM_VALIDATED"].includes(row.from)
      ? "INSTALL_WATCHDOG"
      : install.phases.indexOf(row.to) >= custodyIndex
        ? "EVIDENCE_CUSTODIAN"
        : "INSTALLER";
    assert.equal(row.owner, expectedOwner, "install success owner " + row.from + "->" + row.to);
  }
  for (const row of install.failureTransitions) {
    assert.equal(row.owner, install.phases.indexOf(row.from) < custodyIndex ? "INSTALL_WATCHDOG" : "EVIDENCE_CUSTODIAN", "install abort owner " + row.from);
  }
  for (const row of install.recoveryTransitions) assert.equal(row.owner, "EVIDENCE_CUSTODIAN");
  for (const row of install.crashTable) {
    assert.equal(row.owner, install.phases.indexOf(row.afterPhase) < custodyIndex ? "INSTALL_WATCHDOG" : "EVIDENCE_CUSTODIAN", "install crash owner " + row.afterPhase);
  }
  for (const row of install.recoveryCrashTable) assert.equal(row.owner, "EVIDENCE_CUSTODIAN");
}

function mutateValue(value) {
  if (Array.isArray(value)) return [...value, "UNBOUND_MUTATION"];
  if (value === null) return "UNEXPECTED_RECEIPT";
  if (typeof value === "string") return value + "_MUTATED";
  return !value;
}

function assertLifecycleMutationsRejected(sectionName) {
  for (const collectionName of ["transitions", "failureTransitions", "recoveryTransitions", "crashTable", "recoveryCrashTable"]) {
    const canonicalRows = BPS06_SOURCE_DESIGN[sectionName][collectionName];
    for (let rowIndex = 0; rowIndex < canonicalRows.length; rowIndex += 1) {
      for (const key of Object.keys(canonicalRows[rowIndex])) {
        const candidate = createBps06SourceDesign();
        candidate[sectionName][collectionName][rowIndex][key] = mutateValue(candidate[sectionName][collectionName][rowIndex][key]);
        assert.throws(() => validateBps06SourceDesign(candidate), sectionName + "." + collectionName + "[" + rowIndex + "]." + key);
      }
      const extra = createBps06SourceDesign();
      extra[sectionName][collectionName][rowIndex].unexpected = "UNBOUND";
      assert.throws(() => validateBps06SourceDesign(extra), sectionName + "." + collectionName + " nested unknown key");
    }
    const skipped = createBps06SourceDesign();
    skipped[sectionName][collectionName].splice(0, 1);
    assert.throws(() => validateBps06SourceDesign(skipped), sectionName + "." + collectionName + " skipped row");
    if (canonicalRows.length > 1) {
      const reordered = createBps06SourceDesign();
      [reordered[sectionName][collectionName][0], reordered[sectionName][collectionName][1]] = [
        reordered[sectionName][collectionName][1],
        reordered[sectionName][collectionName][0],
      ];
      assert.throws(() => validateBps06SourceDesign(reordered), sectionName + "." + collectionName + " reordered rows");
    }
  }
}

function assertClosedSchema(schema, location = "$") {
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false, location);
    assert.deepEqual(schema.required, Object.keys(schema.properties), location);
    for (const [key, child] of Object.entries(schema.properties)) assertClosedSchema(child, location + "." + key);
  } else if (schema.type === "array") {
    assert.equal(schema.items, false, location);
    assert.equal(schema.minItems, schema.prefixItems.length, location);
    assert.equal(schema.maxItems, schema.prefixItems.length, location);
    schema.prefixItems.forEach((child, index) => assertClosedSchema(child, location + "[" + index + "]"));
  } else {
    assert.ok(Object.hasOwn(schema, "const"), location);
  }
}

test("BPS06 remains exact source-only HOLD", () => {
  assert.equal(BPS06_SOURCE_DESIGN.status, "HOLD_SOURCE_DESIGN_ONLY");
  assert.deepEqual(BPS06_SOURCE_DESIGN.taskBoundary.exactPaths, BPS06_PATHS);
  assert.equal(BPS06_SOURCE_DESIGN.truthBoundary.sourceDesignPresent, true);
  assert.equal(BPS06_SOURCE_DESIGN.truthBoundary.decision, "HOLD");
  assert.equal(BPS06_SOURCE_DESIGN.truthBoundary.authority, "NONE");
  for (const [key, value] of Object.entries(BPS06_SOURCE_DESIGN.truthBoundary)) {
    if (typeof value === "boolean" && key !== "sourceDesignPresent") assert.equal(value, false, key);
  }
});

test("checkpoint target, global nine-path order, and raw Git boundary are exact", () => {
  const design = BPS06_SOURCE_DESIGN.checkpointDesign;
  assert.equal(design.canonicalRef, "refs/heads/codex/bpc01-package-bound-prelaunch-supervisor-checkpoint");
  assert.equal(design.canonicalWorktree, "C:\\Users\\A\\Documents\\Codex\\2026-08-13\\can-you-take-over-b3-architecture-3\\work\\iat-b3-bpc01-package-bound-prelaunch-supervisor-clean");
  assert.equal(design.exactAdditionCount, 9);
  assert.deepEqual(design.exactAdditionPaths, rawUtf8Sort(design.exactAdditionPaths));
  assert.equal(design.gitEnvironment.canonicalObjectDatabaseRawWritesRequired, true);
  assert.equal(design.gitEnvironment.privateObjectStagingForbidden, true);
  assert.equal(design.gitEnvironment.canonicalObjectReopenBeforeRefCasRequired, true);
  assert.equal(design.gitEnvironment.unreferencedObjectPruningPermitted, false);
});

test("checkpoint and install transitions are typed and exhaustive", () => {
  assertTransitions(BPS06_SOURCE_DESIGN.checkpointDesign, "checkpoint");
  assertTransitions(BPS06_SOURCE_DESIGN.installDesign, "install");
  assertReceiptAncestry(BPS06_SOURCE_DESIGN.checkpointDesign, "checkpoint");
  assertReceiptAncestry(BPS06_SOURCE_DESIGN.installDesign, "install");
  assertPhaseOwners();
  assert.equal(BPS06_SOURCE_DESIGN.installDesign.phases.includes("RECOVERY_ZERO_VERIFIED"), false);
  assert.equal(BPS06_SOURCE_DESIGN.installDesign.failurePhases.includes("ZERO_VERIFIED"), false);
  assert.ok(BPS06_SOURCE_DESIGN.installDesign.phases.includes("ZERO_VERIFIED"));
  assert.ok(BPS06_SOURCE_DESIGN.installDesign.failurePhases.includes("RECOVERY_ZERO_VERIFIED"));
  assert.equal(BPS06_SOURCE_DESIGN.installDesign.installerDeletionAfterCustodyAckPermitted, false);
  assert.equal(BPS06_SOURCE_DESIGN.installDesign.postCustodyDeletionAuthority, "EVIDENCE_CUSTODIAN_ONLY_AFTER_SEPARATE_AUTHENTICATED_DECISION");
});

test("every lifecycle, receipt, crash, and nested-key mutation fails closed", () => {
  assertLifecycleMutationsRejected("checkpointDesign");
  assertLifecycleMutationsRejected("installDesign");
});

test("validator rejects promotions, proxies, accessors, and null prototypes", () => {
  const promoted = createBps06SourceDesign();
  promoted.truthBoundary.compiled = true;
  assert.throws(() => validateBps06SourceDesign(promoted));
  assert.throws(() => validateBps06SourceDesign(new Proxy(createBps06SourceDesign(), {})));
  const accessor = createBps06SourceDesign();
  Object.defineProperty(accessor, "status", { enumerable: true, get: () => "HOLD_SOURCE_DESIGN_ONLY" });
  assert.throws(() => validateBps06SourceDesign(accessor));
  const nullPrototype = Object.assign(Object.create(null), createBps06SourceDesign());
  assert.throws(() => validateBps06SourceDesign(nullPrototype), /prototype|plain/u);
});

test("checked schema bytes equal the recursively closed generated schema", async () => {
  const bytes = await readFile(SCHEMA_PATH);
  assert.equal(bytes.at(-1), 0x0a);
  assert.equal(bytes.includes(0x0d), false);
  const schema = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(schema, BPS06_JSON_SCHEMA);
  assertClosedSchema(schema);
});

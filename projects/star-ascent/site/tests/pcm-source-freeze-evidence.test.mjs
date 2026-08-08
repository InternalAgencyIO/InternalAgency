import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PCM_SOURCE_FREEZE,
  PCM_SOURCE_FREEZE_EVIDENCE_BINDING,
  canonicalJsonSha256,
  sourceInventoryFromInputs,
  validatePcmSourceFreezeEvidence,
} from "../scripts/lib/pcm-editorial-gap-report.mjs";

const evidenceUrl = new URL("../scripts/data/pcm-source-freeze-evidence-5baff9.json", import.meta.url);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const serialize = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

async function loadEvidence() {
  const evidenceBytes = await readFile(evidenceUrl);
  return { evidenceBytes, evidence: JSON.parse(evidenceBytes.toString("utf8")) };
}

test("committed PCM source evidence is exact, non-activating, and provenance-bound", async () => {
  const { evidence, evidenceBytes } = await loadEvidence();
  const result = validatePcmSourceFreezeEvidence({ evidence, evidenceBytes });
  assert.deepEqual(
    { sourceCount: result.inventory.sourceCount, sourceKeysSha256: result.inventory.sourceKeysSha256 },
    PCM_SOURCE_FREEZE,
  );
  assert.deepEqual(result.binding, PCM_SOURCE_FREEZE_EVIDENCE_BINDING);
  assert.equal(result.componentSources.CANONICAL_ENGLISH_CATALOG_KEYS.length, 985);
  assert.equal(result.componentSources.PENDING_VISIBLE_SOURCE_VALUES.length, 48);
  assert.equal(result.componentSources.CRITICAL_UI_PRIORITY_VALUES.length, 468);
  assert.equal(
    sha256(JSON.stringify(result.componentSources.CRITICAL_UI_PRIORITY_VALUES)),
    "c91bcd1e4ecafe5c1ff0592910bf1398c799678c03d9bc5b910dd5fad8d24067",
  );
  assert.deepEqual(result.policy, {
    canonicalEnglishControls: true,
    directApplicationPermitted: false,
    runtimeCatalogDependency: false,
    reviewClaim: "SOURCE_MEMBERSHIP_EVIDENCE_ONLY",
    translationClaim: "NONE",
  });
});

test("source mutation, reordering, count drift, schema drift, and byte drift fail closed", async () => {
  const { evidence, evidenceBytes } = await loadEvidence();

  const reordered = structuredClone(evidence);
  [reordered.sourceFreeze.sources[0], reordered.sourceFreeze.sources[1]] = [
    reordered.sourceFreeze.sources[1],
    reordered.sourceFreeze.sources[0],
  ];
  assert.throws(
    () => validatePcmSourceFreezeEvidence({ evidence: reordered, evidenceBytes: serialize(reordered) }),
    /canonical en localeCompare order/u,
  );

  const mutated = structuredClone(evidence);
  mutated.sourceFreeze.sources[0] = `${mutated.sourceFreeze.sources[0]} MUTATED`;
  assert.throws(
    () => validatePcmSourceFreezeEvidence({ evidence: mutated, evidenceBytes: serialize(mutated) }),
    /canonical en localeCompare order|declared count or digest|provenance components/u,
  );

  const wrongCount = structuredClone(evidence);
  wrongCount.sourceFreeze.sourceCount += 1;
  assert.throws(
    () => validatePcmSourceFreezeEvidence({ evidence: wrongCount, evidenceBytes }),
    /declared count or digest/u,
  );

  const duplicate = structuredClone(evidence);
  duplicate.sourceFreeze.sources[1] = duplicate.sourceFreeze.sources[0];
  assert.throws(
    () => validatePcmSourceFreezeEvidence({ evidence: duplicate, evidenceBytes: serialize(duplicate) }),
    /duplicate sources/u,
  );

  const nonNfc = structuredClone(evidence);
  nonNfc.sourceFreeze.sources[0] = "Cafe\u0301";
  assert.throws(
    () => validatePcmSourceFreezeEvidence({ evidence: nonNfc, evidenceBytes: serialize(nonNfc) }),
    /trimmed NFC source strings/u,
  );

  const wrongSchema = structuredClone(evidence);
  wrongSchema.schema = "iat-pcm-source-freeze-evidence/v0";
  assert.throws(
    () => validatePcmSourceFreezeEvidence({ evidence: wrongSchema, evidenceBytes: serialize(wrongSchema) }),
    /schema or locale/u,
  );

  assert.throws(
    () => validatePcmSourceFreezeEvidence({
      evidence,
      evidenceBytes: Buffer.concat([evidenceBytes, Buffer.from(" ")]),
    }),
    /evidence binding mismatch: evidenceFileSha256/u,
  );
});

test("component and provenance tampering fails even when the 1,491-source union is unchanged", async () => {
  const { evidence } = await loadEvidence();

  const componentMutation = structuredClone(evidence);
  componentMutation.provenance.components[0].sources[0] += " MUTATED";
  assert.throws(
    () => validatePcmSourceFreezeEvidence({
      evidence: componentMutation,
      evidenceBytes: serialize(componentMutation),
    }),
    /canonical en localeCompare order|component count or digest/u,
  );

  const criticalReorder = structuredClone(evidence);
  const critical = criticalReorder.provenance.components[2];
  [critical.sources[0], critical.sources[1]] = [critical.sources[1], critical.sources[0]];
  critical.sourceKeysSha256 = sha256(JSON.stringify(critical.sources));
  criticalReorder.provenanceCanonicalSha256 = canonicalJsonSha256(criticalReorder.provenance);
  assert.throws(
    () => validatePcmSourceFreezeEvidence({
      evidence: criticalReorder,
      evidenceBytes: serialize(criticalReorder),
    }),
    /evidence binding mismatch/u,
  );

  const provenanceRewrite = structuredClone(evidence);
  provenanceRewrite.provenance.components[1].sourceFileSha256 = "0".repeat(64);
  provenanceRewrite.provenanceCanonicalSha256 = canonicalJsonSha256(provenanceRewrite.provenance);
  assert.throws(
    () => validatePcmSourceFreezeEvidence({
      evidence: provenanceRewrite,
      evidenceBytes: serialize(provenanceRewrite),
    }),
    /evidence binding mismatch/u,
  );

  const orphanedCritical = structuredClone(evidence);
  const orphanedComponent = orphanedCritical.provenance.components[2];
  orphanedComponent.sources[0] = "ORPHANED CRITICAL SOURCE";
  orphanedComponent.sourceKeysSha256 = sha256(JSON.stringify(orphanedComponent.sources));
  orphanedCritical.provenanceCanonicalSha256 = canonicalJsonSha256(orphanedCritical.provenance);
  assert.throws(
    () => validatePcmSourceFreezeEvidence({
      evidence: orphanedCritical,
      evidenceBytes: serialize(orphanedCritical),
    }),
    /pre-retirement union mismatch|sources do not match their provenance components/u,
  );

  const activating = structuredClone(evidence);
  activating.activationReady = true;
  assert.throws(
    () => validatePcmSourceFreezeEvidence({ evidence: activating, evidenceBytes: serialize(activating) }),
    /frozen and non-activating/u,
  );

  const runtimeAuthority = structuredClone(evidence);
  runtimeAuthority.policy.runtimeCatalogDependency = true;
  assert.throws(
    () => validatePcmSourceFreezeEvidence({
      evidence: runtimeAuthority,
      evidenceBytes: serialize(runtimeAuthority),
    }),
    /policy is invalid/u,
  );
});

test("focused validation is invariant to runtime catalog inputs and never reads them", async () => {
  const { evidence, evidenceBytes } = await loadEvidence();
  const baseline = validatePcmSourceFreezeEvidence({ evidence, evidenceBytes });
  const runtimeOne = sourceInventoryFromInputs({
    catalog: { messages: { en: { "Runtime source A": "Runtime source A" } } },
    pending: { sources: [] },
    criticalUi: {},
  });
  const runtimeTwo = sourceInventoryFromInputs({
    catalog: { messages: { en: { "Runtime source B": "Runtime source B" } } },
    pending: { sources: [{ source: "Runtime pending source" }] },
    criticalUi: { runtime: "Runtime critical source" },
  });
  assert.notDeepEqual(runtimeOne, runtimeTwo);
  assert.deepEqual(
    validatePcmSourceFreezeEvidence({ evidence, evidenceBytes }).inventory,
    baseline.inventory,
  );

  const validatorSource = await readFile(
    new URL("../scripts/validate-pcm-editorial-batch.mjs", import.meta.url),
    "utf8",
  );
  for (const forbiddenRuntimeInput of ["messages.json", "pending-visible-source.json", "critical-ui-source.json"]) {
    assert.doesNotMatch(validatorSource, new RegExp(forbiddenRuntimeInput.replaceAll(".", "\\."), "u"));
  }
  assert.match(validatorSource, /pcm-source-freeze-evidence-5baff9\.json/u);
});

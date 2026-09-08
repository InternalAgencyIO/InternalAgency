#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const CHECKPOINT = "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json";
const CONTRACT = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const BATCH_ROOT = "tmp/world-195x4/batch-382";
const BANK_ROUNDS = [48, 49, 50, 51];
const SLOTS = ["A", "B", "C", "D"];
const ACCEPTED_PROMPTS = new Set([
  "scene-1548-fresh-round-11-recovery-prompt.txt",
  "scene-1549-fresh-round-2-recovery-prompt.txt",
  "scene-1550-fresh-round-8-prompt.txt",
]);

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const verify = args.has("--verify");
if (apply === verify) {
  throw new Error("Choose exactly one mode: --apply or --verify");
}

const root = process.cwd();
const checkpointPath = path.join(root, CHECKPOINT);
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
const contractSha256 = sha256(readFileSync(path.join(root, CONTRACT)));
const recordedAt = checkpoint.rejectedPromptLedger?.backfilledAt ?? "2026-08-13T08:11:00.000Z";

function sha256(textOrBuffer) {
  return createHash("sha256").update(textOrBuffer).digest("hex").toUpperCase();
}

function readPrompt(relativePath) {
  const text = readFileSync(path.join(root, relativePath), "utf8");
  return { text, sha256: sha256(text), bytes: Buffer.byteLength(text), chars: text.length };
}

function normalizePhase(phase) {
  if (phase === "raw") return "fresh";
  return phase ?? "fresh";
}

function parseSinglePromptName(name) {
  let match;
  if ((match = name.match(/^scene-(\d+)-prompt\.txt$/))) {
    return { scene: Number(match[1]), round: 1, phase: "initial" };
  }
  if ((match = name.match(/^scene-(\d+)-recovery-round-(\d+)-prompt\.txt$/))) {
    return { scene: Number(match[1]), round: Number(match[2]), phase: "recovery" };
  }
  if ((match = name.match(/^scene-(\d+)-(clean-)?fresh-round-(\d+)(-recovery|-safety-retry)?-prompt\.txt$/))) {
    return {
      scene: Number(match[1]),
      round: Number(match[3]),
      phase: match[4] ? match[4].slice(1) : "fresh",
      clean: Boolean(match[2]),
    };
  }
  if ((match = name.match(/^scene-(\d+)-consolidated-round-(\d+)-edit-prompt\.txt$/))) {
    return { scene: Number(match[1]), round: Number(match[2]), phase: "consolidated-edit" };
  }
  throw new Error(`Unrecognized prompt filename: ${name}`);
}

function recordPointersByPrompt() {
  const pointers = new Map();
  for (let index = 0; index < (checkpoint.rejectedAssets ?? []).length; index += 1) {
    const value = checkpoint.rejectedAssets[index];
    const key = `${value.scene}|${value.round ?? 1}|${normalizePhase(value.phase)}`;
    if (!pointers.has(key)) pointers.set(key, []);
    pointers.get(key).push({ pointer: `/rejectedAssets/${index}`, value });
  }
  return pointers;
}

const legacyPointers = recordPointersByPrompt();

function rawFallback(meta) {
  const candidates = [];
  if (meta.phase === "recovery" && meta.round === 1) {
    candidates.push(`raw/recovery-round-1/scene-${meta.scene}.png`);
  } else if (meta.phase === "consolidated-edit") {
    candidates.push(`raw/consolidated-round-${meta.round}/scene-${meta.scene}.png`);
  } else if (meta.phase !== "initial") {
    const stem = `${meta.clean ? "clean-" : ""}fresh-round-${meta.round}`;
    if (meta.phase === "fresh") candidates.push(`raw/${stem}/scene-${meta.scene}.png`);
    if (meta.phase === "recovery") {
      candidates.push(`raw/${stem}-recovery/scene-${meta.scene}.png`);
      candidates.push(`raw/${stem}/scene-${meta.scene}-recovery.png`);
    }
    if (meta.phase === "safety-retry") {
      candidates.push(`raw/${stem}-safety-retry/scene-${meta.scene}.png`);
      candidates.push(`raw/${stem}/scene-${meta.scene}.png`);
    }
  }
  return candidates.map((candidate) => `${BATCH_ROOT}/${candidate}`).find((candidate) => existsSync(path.join(root, candidate))) ?? null;
}

function renderAttemptFor(meta) {
  if (meta.phase === "initial") return checkpoint.renderAttempts.raw;
  if (meta.round === 1 && meta.phase === "recovery") return checkpoint.renderAttempts.recovery.perScene[String(meta.scene)];
  if (meta.phase === "consolidated-edit") return checkpoint.persistentContinuationWindow2;
  if (meta.round === 44) return checkpoint.activeRenderPreparation;
  if (meta.round === 45) return checkpoint.finalRenderPreparation;
  if (meta.round === 46 || meta.round === 47) return checkpoint.persistentContinuationWindow2;
  const base = checkpoint.renderAttempts[`freshRound${meta.round}`];
  if (!base) return null;
  if (meta.phase === "recovery") return base.recovery ?? checkpoint.renderAttempts[`freshRound${meta.round}Recovery`];
  if (meta.phase === "safety-retry") return base.safetyRetry;
  if (meta.round === 17 && meta.phase === "fresh") return base.initialLaunch;
  return base;
}

function rawFromAttempt(meta) {
  const attempt = renderAttemptFor(meta);
  if (!attempt) return null;
  if (meta.round === 1 && meta.phase === "recovery") {
    return {
      path: attempt.rawOutput ?? null,
      sha256: attempt.sha256 ?? null,
      bytes: attempt.bytes,
      preserved: Boolean(attempt.rawOutput),
    };
  }
  if (meta.phase === "consolidated-edit") return attempt.round47RawOutput ?? null;
  if (meta.round === 44) return attempt.rawOutput ?? null;
  if (meta.round === 45) return attempt.rawOutput ?? null;
  if (meta.round === 46) return attempt.round46RawOutput ?? null;
  const value = attempt.rawOutputs?.[String(meta.scene)] ?? attempt.rawOutputs?.[meta.scene] ?? null;
  if (!value) return null;
  return {
    path: value.path ?? value.providerPath ?? null,
    sha256: value.sha256 ?? null,
    bytes: value.bytes,
    preserved: value.preserved,
  };
}

function rawState(relativePath, recordedSha) {
  if (!relativePath) return { path: null, sha256: recordedSha ?? null, state: "no-bytes" };
  const absolute = path.isAbsolute(relativePath) ? relativePath : path.join(root, relativePath);
  if (!existsSync(absolute)) return { path: relativePath, sha256: recordedSha ?? null, state: "no-bytes" };
  const bytes = statSync(absolute).size;
  const actual = sha256(readFileSync(absolute));
  if (recordedSha && actual !== recordedSha.toUpperCase()) {
    throw new Error(`Raw SHA mismatch for ${relativePath}: ${actual} != ${recordedSha}`);
  }
  return { path: relativePath, sha256: actual, bytes, state: bytes === 0 ? "zero-byte-file" : "preserved" };
}

function makeEntry({ entryId, scene, round, phase, status, promptPath, prompt, rawOutput, auditRef, candidateSlot = null, promptFidelity = "canonical-source-text" }) {
  return {
    entryId,
    recordedAt,
    scene,
    round,
    phase,
    ...(candidateSlot ? { candidateSlot } : {}),
    status,
    prompt: {
      sourcePath: promptPath,
      text: prompt.text,
      sha256: prompt.sha256,
      encoding: "utf-8",
      bytes: prompt.bytes,
      chars: prompt.chars,
      fidelity: promptFidelity,
    },
    rawOutput,
    auditRef,
    immutable: true,
  };
}

function auditRefFor(meta, match) {
  if (match?.pointer) return match.pointer;
  if (meta.phase === "initial") return "/renderAttempts/raw";
  if (meta.round === 1 && meta.phase === "recovery") return `/renderAttempts/recovery/perScene/${meta.scene}`;
  if (meta.round === 17 && meta.phase === "fresh") return "/renderAttempts/freshRound17/initialLaunch";
  if (meta.round === 17 && meta.phase === "safety-retry") return "/renderAttempts/freshRound17/strictAudit";
  if (meta.round === 44) return "/activeRenderPreparation/strictAudit";
  if (meta.round === 45) return "/finalRenderPreparation/strictAudit";
  if (meta.round === 46) return "/persistentContinuationWindow2/round46StrictAudit";
  if (meta.round === 47) return "/persistentContinuationWindow2/round47StrictAudit";
  if (meta.phase === "recovery" && checkpoint.renderAttempts[`freshRound${meta.round}Recovery`]) {
    return `/renderAttempts/freshRound${meta.round}Recovery/strictAudit`;
  }
  if (meta.phase === "recovery" && checkpoint.renderAttempts[`freshRound${meta.round}`]?.recovery) {
    return `/renderAttempts/freshRound${meta.round}/recovery`;
  }
  return `/renderAttempts/freshRound${meta.round}`;
}

function resolvePointer(document, pointer) {
  if (pointer === "") return document;
  if (!pointer.startsWith("/")) return undefined;
  return pointer.slice(1).split("/").reduce((value, token) => {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    return value != null && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
  }, document);
}

function singlePromptEntries() {
  const entries = [];
  const promptNames = readdirSync(path.join(root, BATCH_ROOT))
    .filter((name) => /prompt\.txt$/i.test(name))
    .filter((name) => !/round-(48|49|50|51)-four-slot-common-prompt\.txt$/.test(name))
    .sort();
  for (const name of promptNames) {
    if (ACCEPTED_PROMPTS.has(name)) continue;
    const meta = parseSinglePromptName(name);
    const promptPath = `${BATCH_ROOT}/${name}`;
    const prompt = readPrompt(promptPath);
    const key = `${meta.scene}|${meta.round}|${normalizePhase(meta.phase)}`;
    const matches = legacyPointers.get(key) ?? [];
    let match = matches.shift();
    if (!match && meta.phase === "initial") {
      match = { pointer: "/renderAttempts/raw", value: { status: "moderation-blocked-no-raw-output" } };
    }
    const attempt = renderAttemptFor(meta);
    const attemptRaw = rawFromAttempt(meta);
    const round17OriginalBlocked = meta.round === 17 && meta.phase === "fresh" && attempt?.rawAssetProduced === false;
    const round17RetryRaw = meta.round === 17 && meta.phase === "safety-retry" ? checkpoint.renderAttempts.freshRound17.rawOutputs?.[String(meta.scene)] : null;
    const fallback = rawFallback(meta);
    const recordedRaw = round17OriginalBlocked ? null : match?.value?.rawOutput ?? round17RetryRaw?.path ?? attemptRaw?.path ?? fallback;
    const recordedSha = round17OriginalBlocked ? null : match?.value?.sha256 ?? round17RetryRaw?.sha256 ?? attemptRaw?.sha256 ?? null;
    const status = meta.round === 17 && meta.phase === "safety-retry"
      ? "rejected-strict-visual-audit"
      : match?.value?.status ?? attempt?.status ?? (recordedRaw ? "rejected-strict-visual-audit" : "rejected-or-failed-no-raw");
    const idPhase = normalizePhase(meta.phase).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    entries.push(makeEntry({
      entryId: `batch-382-scene-${meta.scene}-round-${meta.round}-${idPhase}`,
      scene: meta.scene,
      round: meta.round,
      phase: normalizePhase(meta.phase),
      status,
      promptPath,
      prompt,
      rawOutput: rawState(recordedRaw, recordedSha),
      auditRef: auditRefFor(meta, match),
    }));
  }
  return entries;
}

function bankAudit(round) {
  if (round === 48) return checkpoint.contractAmendments.fixedFourSlotParallelRenderBank.round48BankAudit;
  if (round === 49) return checkpoint.contractAmendments.fixedFourSlotParallelRenderBank.round49Preparation;
  if (round === 50) return checkpoint.oneTimeGeorgiaScene1551ContinuationWindow.round50;
  if (round === 51) return checkpoint.oneTimeGeorgiaScene1551ContinuationWindow.round51;
  throw new Error(`Unsupported bank round ${round}`);
}

function bankPromptEntries() {
  const entries = [];
  for (const round of BANK_ROUNDS) {
    const commonPath = `${BATCH_ROOT}/scene-1551-round-${round}-four-slot-common-prompt.txt`;
    const commonFile = readPrompt(commonPath).text;
    const audit = bankAudit(round);
    const raws = audit.rawOutputs ?? [];
    for (let slotIndex = 0; slotIndex < SLOTS.length; slotIndex += 1) {
      const slot = SLOTS[slotIndex];
      const narrativePath = `${BATCH_ROOT}/scene-1551-round-${round}-candidate-${slot}-narrative.txt`;
      const narrativeFile = readPrompt(narrativePath).text;
      let text;
      if (round === 48) {
        text = `${commonFile}\r\n\n\n${narrativeFile}\r\n\n\nCandidate slot ${slot}. Generate one independent candidate only.`;
      } else if (round === 49) {
        text = `${commonFile.trim()}\n\n${narrativeFile.trim()}\n\nCandidate slot ${slot}. Render one image only.`;
      } else {
        text = `${commonFile}\n\n${narrativeFile}\n\nReturn one candidate image only. Candidate slot: ${slot}.`;
      }
      const prompt = { text, sha256: sha256(text), bytes: Buffer.byteLength(text), chars: text.length };
      const raw = raws.find((value) => value.candidateSlot === slot) ?? checkpoint.rawOutputs.find((value) => value.round === round && value.candidateSlot === slot);
      if (!raw) throw new Error(`Missing raw record for round ${round} slot ${slot}`);
      const auditRoot = round === 50 || round === 51 ? `/round${round}RejectedAssetsAudit/${slotIndex}` : round === 48 ? `/contractAmendments/fixedFourSlotParallelRenderBank/round48BankAudit/slotAudit/${slot}` : `/contractAmendments/fixedFourSlotParallelRenderBank/round49Preparation/slotAudit/${slot}`;
      entries.push(makeEntry({
        entryId: `batch-382-scene-1551-round-${round}-slot-${slot}`,
        scene: 1551,
        round,
        phase: round === 51 ? "final-holistic-four-slot-bank" : "four-slot-parallel-bank",
        candidateSlot: slot,
        status: "rejected-strict-visual-audit",
        promptPath: `${commonPath} + ${narrativePath} + launch suffix`,
        prompt,
        rawOutput: rawState(raw.path, raw.sha256),
        auditRef: auditRoot,
        promptFidelity: "runtime-launch-byte-exact",
      }));
    }
  }
  return entries;
}

const entries = [...singlePromptEntries(), ...bankPromptEntries()];
const ids = new Set(entries.map((entry) => entry.entryId));
if (ids.size !== entries.length) throw new Error("Duplicate rejectedPromptLedger entryId");

const ledger = {
  schemaVersion: 1,
  appendOnly: true,
  backfilledAt: recordedAt,
  coverageRule: "Exactly one immutable entry per rejected or failed generation occurrence. prompt.text contains the complete canonical UTF-8 prompt source; a path, hash, component, or external text file alone is insufficient.",
  historicalRuntimeFidelity: "Legacy single-prompt entries are labeled canonical-source-text because historical PowerShell transport could alter terminal whitespace or character encoding in the runtime echo. This does not omit prompt prose. Future entries must preserve runtime-launch-byte-exact text before advancement.",
  bankCompositionRule: "Rounds 48-51 are labeled runtime-launch-byte-exact: prompt.text preserves the verified per-round launch composition and suffix from the originating image-generation call, and the verifier hashes that complete composed UTF-8 string.",
  sourceOccurrenceCount: entries.length,
  contractPolicySha256: contractSha256,
  entries,
};

function validate(value) {
  const errors = [];
  if (!value || value.schemaVersion !== 1 || value.appendOnly !== true) errors.push("invalid ledger header");
  if (checkpoint.contractSha256 !== contractSha256) errors.push("checkpoint contractSha256 mismatch");
  if (value?.contractPolicySha256 !== contractSha256) errors.push("ledger contractPolicySha256 mismatch");
  if (value?.entries?.length !== value?.sourceOccurrenceCount) errors.push("sourceOccurrenceCount mismatch");
  if (JSON.stringify(value?.entries ?? []) !== JSON.stringify(entries)) errors.push("ledger entries differ from source prompts and audits");
  const seen = new Set();
  for (const entry of value?.entries ?? []) {
    if (seen.has(entry.entryId)) errors.push(`duplicate ${entry.entryId}`);
    seen.add(entry.entryId);
    if (!entry.prompt?.text) errors.push(`missing prompt text ${entry.entryId}`);
    if (sha256(entry.prompt?.text ?? "") !== entry.prompt?.sha256) errors.push(`prompt SHA mismatch ${entry.entryId}`);
    if (!["canonical-source-text", "runtime-launch-byte-exact"].includes(entry.prompt?.fidelity)) errors.push(`invalid prompt fidelity ${entry.entryId}`);
    if (!entry.auditRef?.startsWith("/") || resolvePointer(checkpoint, entry.auditRef) === undefined) {
      errors.push(`unresolved auditRef ${entry.entryId}: ${entry.auditRef}`);
    }
    if (entry.rawOutput?.state === "preserved") {
      const absolute = path.join(root, entry.rawOutput.path);
      if (!existsSync(absolute)) errors.push(`missing raw ${entry.entryId}`);
      else if (sha256(readFileSync(absolute)) !== entry.rawOutput.sha256) errors.push(`raw SHA mismatch ${entry.entryId}`);
    }
  }
  return errors;
}

if (apply) {
  checkpoint.rejectedPromptLedger = ledger;
  writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

const actual = apply ? ledger : checkpoint.rejectedPromptLedger;
const errors = validate(actual);
const result = {
  mode: apply ? "apply" : "verify",
  entries: actual?.entries?.length ?? 0,
  expectedEntries: entries.length,
  exactPromptShaPasses: (actual?.entries ?? []).filter((entry) => sha256(entry.prompt?.text ?? "") === entry.prompt?.sha256).length,
  preservedRawEntries: (actual?.entries ?? []).filter((entry) => entry.rawOutput?.state === "preserved").length,
  noByteEntries: (actual?.entries ?? []).filter((entry) => entry.rawOutput?.state === "no-bytes").length,
  zeroByteEntries: (actual?.entries ?? []).filter((entry) => entry.rawOutput?.state === "zero-byte-file").length,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length || actual?.entries?.length !== entries.length) process.exitCode = 1;

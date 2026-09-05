const LATCH_SCHEMA = "iat-v2-current-source-model-t-transaction-prompt-latch/v1";
const GLOBAL_LOCK_NAME = "iat-v2-current-source-model-t-transaction-prompt/global/v1";
const LATCH_PREFIX = "iat-v2-current-source-model-t-transaction-prompt";
const CEREMONY_TERMINAL_LATCH_SLOT = "CCC_ROUND_13_TERMINAL";
const hex40 = /^[0-9a-f]{40}$/u;
const hex64 = /^[0-9a-f]{64}$/u;
const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
// Exact source-bound policy-13 / CCC-13 action roster. Numeric forms are
// deliberately bounded so no future week or round is admitted implicitly.
const CANONICAL_ACTION = /^(?:EXTEND_PROGRAM_DATA|UPGRADE_PROGRAM|MIGRATE_LEGACY_ROUND_WEEK_[78]|BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_(?:9|1[0-2])|SETTLE_STANDARD_POSITION_WEEK_1[0-3]|SETTLE_LINKED_POSITION_[23]_WEEK_(?:9|1[0-3])|CREATE_SWITCHBOARD_RANDOMNESS|(?:COMMIT|REVEAL|EXPIRE)_CCC_ROUND_13)$/u;
const CEREMONY_TERMINAL_ACTION = /^(?:REVEAL|EXPIRE)_CCC_ROUND_13$/u;
const LATCH_FIELDS = Object.freeze([
  "schema",
  "status",
  "sourceCommit",
  "programArtifactSha256",
  "mint",
  "action",
  "messageSha256",
  "signer",
  "tabId",
  "enteredAtUtc",
  "finishedAtUtc",
]);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function base58ByteLength(value) {
  if (!base58.test(value ?? "")) return -1;
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(base58Alphabet.indexOf(character));
  let bytes = 0;
  while (number > 0n) {
    bytes += 1;
    number >>= 8n;
  }
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === "1") zeroes += 1;
  return bytes + zeroes;
}

function exactBinding({ sourceCommit, programArtifactSha256, mint } = {}) {
  check(hex40.test(sourceCommit ?? ""), "Prompt coordination requires an exact source commit");
  check(hex64.test(programArtifactSha256 ?? ""), "Prompt coordination requires an exact artifact SHA-256");
  check(base58ByteLength(mint) === 32, "Prompt coordination requires an exact 32-byte mint");
  return { sourceCommit, programArtifactSha256, mint };
}

function exactAction(action) {
  check(CANONICAL_ACTION.test(action), "Prompt coordination action is outside the canonical attended roster");
  return action;
}

function permanentLatchSlot(action) {
  return CEREMONY_TERMINAL_ACTION.test(action)
    ? CEREMONY_TERMINAL_LATCH_SLOT
    : action;
}

function exactTimestamp(value, label) {
  check(
    typeof value === "string"
      && Number.isFinite(Date.parse(value))
      && new Date(value).toISOString() === value,
    `${label} is invalid`,
  );
  return value;
}

function exactLatch(value) {
  check(value && typeof value === "object" && !Array.isArray(value), "Prompt latch must be an object");
  check(JSON.stringify(Object.keys(value)) === JSON.stringify(LATCH_FIELDS), "Prompt latch fields are not exact");
  check(value.schema === LATCH_SCHEMA, "Prompt latch schema is not reviewed");
  check(["PROMPT_ENTERED", "PROMPT_VERIFIED", "PROMPT_FAILED"].includes(value.status), "Prompt latch status is invalid");
  exactBinding(value);
  exactAction(value.action);
  check(hex64.test(value.messageSha256 ?? ""), "Prompt latch message SHA-256 is invalid");
  check(base58ByteLength(value.signer) === 32, "Prompt latch signer is invalid");
  check(uuid.test(value.tabId ?? ""), "Prompt latch tab ID is invalid");
  exactTimestamp(value.enteredAtUtc, "Prompt latch entered time");
  if (value.status === "PROMPT_ENTERED") {
    check(value.finishedAtUtc === null, "Entered prompt latch cannot have a finished time");
  } else {
    exactTimestamp(value.finishedAtUtc, "Prompt latch finished time");
  }
  return Object.freeze({ ...value });
}

function readExistingLatch(storage, key) {
  let serialized;
  try {
    serialized = storage.getItem(key);
  } catch (error) {
    throw new Error("Prompt latch storage is unavailable for reading", { cause: error });
  }
  if (serialized === null) return null;
  check(typeof serialized === "string", "Existing prompt latch storage value is malformed");
  try {
    return exactLatch(JSON.parse(serialized));
  } catch (error) {
    throw new Error("Existing prompt latch is malformed; transaction prompting remains blocked", { cause: error });
  }
}

function assertLatchMatchesStorageBinding(latch, binding, action) {
  if (latch === null) return null;
  check(latch.sourceCommit === binding.sourceCommit, "Prompt latch source commit drifted from its storage key");
  check(
    latch.programArtifactSha256 === binding.programArtifactSha256,
    "Prompt latch artifact SHA-256 drifted from its storage key",
  );
  check(latch.mint === binding.mint, "Prompt latch mint drifted from its storage key");
  check(
    permanentLatchSlot(latch.action) === permanentLatchSlot(action),
    "Prompt latch action drifted from its permanent storage slot",
  );
  return latch;
}

function persistExactLatch(storage, key, latch) {
  const exact = exactLatch(latch);
  const serialized = JSON.stringify(exact);
  try {
    storage.setItem(key, serialized);
    check(storage.getItem(key) === serialized, "Prompt latch storage readback disagrees with the write");
  } catch (error) {
    throw new Error("Prompt latch storage is unavailable or non-durable", { cause: error });
  }
  return exact;
}

function resolvedTabId(tabId) {
  const value = tabId ?? globalThis.crypto?.randomUUID?.();
  check(uuid.test(value ?? ""), "Prompt coordination requires an exact random tab ID");
  return value;
}

function resolvedLocks(locks) {
  const value = locks ?? globalThis.navigator?.locks;
  check(typeof value?.request === "function", "Web Locks are unavailable; transaction prompting remains blocked");
  return value;
}

function resolvedStorage(storage) {
  let value = storage;
  if (value === undefined) {
    try {
      value = globalThis.localStorage;
    } catch (error) {
      throw new Error("Prompt latch storage is unavailable", { cause: error });
    }
  }
  check(
    typeof value?.getItem === "function" && typeof value?.setItem === "function",
    "Prompt latch storage is unavailable; transaction prompting remains blocked",
  );
  return value;
}

function nextTimestamp(now, label) {
  check(typeof now === "function", "Prompt coordination clock is unavailable");
  return exactTimestamp(now(), label);
}

export function attendedPromptLatchKey({ binding, action } = {}) {
  const exact = exactBinding(binding);
  const canonicalAction = exactAction(action);
  return `${LATCH_PREFIX}/${exact.sourceCommit}/${exact.programArtifactSha256}/${exact.mint}/${permanentLatchSlot(canonicalAction)}/v1`;
}

export function loadAttendedModelTPromptLatch(storage, { binding, action } = {}) {
  const latchStorage = resolvedStorage(storage);
  const exact = exactBinding(binding);
  const canonicalAction = exactAction(action);
  const key = attendedPromptLatchKey({ binding: exact, action: canonicalAction });
  return assertLatchMatchesStorageBinding(
    readExistingLatch(latchStorage, key),
    exact,
    canonicalAction,
  );
}

export function createAttendedModelTPromptCoordinator({
  locks,
  storage,
  tabId,
  now = () => new Date().toISOString(),
} = {}) {
  const exactTabId = resolvedTabId(tabId);
  return Object.freeze({
    async request({
      binding,
      action,
      messageSha256,
      signer,
      prepare,
      prompt,
    } = {}) {
      const lockManager = resolvedLocks(locks);
      const latchStorage = resolvedStorage(storage);
      const exact = exactBinding(binding);
      const canonicalAction = exactAction(action);
      check(hex64.test(messageSha256 ?? ""), "Prompt coordination requires an exact message SHA-256");
      check(base58ByteLength(signer) === 32, "Prompt coordination requires an exact 32-byte signer");
      check(typeof prompt === "function", "Prompt coordination callback is required");
      check(prepare === undefined || typeof prepare === "function", "Prompt preparation callback is invalid");
      const key = attendedPromptLatchKey({ binding: exact, action: canonicalAction });

      return lockManager.request(
        GLOBAL_LOCK_NAME,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          check(lock, "Another attended transaction prompt owns the global Web Lock");
          const existing = assertLatchMatchesStorageBinding(
            readExistingLatch(latchStorage, key),
            exact,
            canonicalAction,
          );
          check(!existing, `Canonical action ${canonicalAction} already consumed its transaction-prompt latch`);

          // Preparation runs under the same exclusive lock, but before the
          // irreversible prompt boundary. A failed unsigned check writes no latch.
          if (prepare !== undefined) await prepare();

          const entered = persistExactLatch(latchStorage, key, {
            schema: LATCH_SCHEMA,
            status: "PROMPT_ENTERED",
            ...exact,
            action: canonicalAction,
            messageSha256,
            signer,
            tabId: exactTabId,
            enteredAtUtc: nextTimestamp(now, "Prompt entered time"),
            finishedAtUtc: null,
          });

          try {
            const value = await prompt();
            const verified = persistExactLatch(latchStorage, key, {
              ...entered,
              status: "PROMPT_VERIFIED",
              finishedAtUtc: nextTimestamp(now, "Prompt verified time"),
            });
            return Object.freeze({ value, latch: verified });
          } catch (error) {
            try {
              persistExactLatch(latchStorage, key, {
                ...entered,
                status: "PROMPT_FAILED",
                finishedAtUtc: nextTimestamp(now, "Prompt failed time"),
              });
            } catch (latchError) {
              throw new Error("Transaction prompt failed and its permanent failed latch could not be persisted", {
                cause: latchError,
              });
            }
            throw error;
          }
        },
      );
    },
  });
}

export const IAT_V2_ATTENDED_PROMPT_LATCH_SCHEMA = LATCH_SCHEMA;
export const IAT_V2_ATTENDED_PROMPT_GLOBAL_LOCK_NAME = GLOBAL_LOCK_NAME;

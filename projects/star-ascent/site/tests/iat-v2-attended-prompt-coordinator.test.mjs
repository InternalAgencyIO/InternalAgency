import assert from "node:assert/strict";
import test from "node:test";
import {
  IAT_V2_ATTENDED_PROMPT_GLOBAL_LOCK_NAME,
  IAT_V2_ATTENDED_PROMPT_LATCH_SCHEMA,
  attendedPromptLatchKey,
  createAttendedModelTPromptCoordinator,
} from "../tools/iat-v2-admin-console/attended-prompt-coordinator.mjs";

const binding = Object.freeze({
  sourceCommit: "a".repeat(40),
  programArtifactSha256: "b".repeat(64),
  mint: "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
});
const signer = binding.mint;
const tabId = "123e4567-e89b-42d3-a456-426614174000";
const messageSha256 = "c".repeat(64);

function storage() {
  const values = new Map();
  const calls = [];
  return {
    calls,
    getItem(key) {
      calls.push(["getItem", key]);
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      calls.push(["setItem", key, value]);
      values.set(key, value);
    },
    value(key) {
      return values.get(key) ?? null;
    },
  };
}

function lockManager() {
  let held = false;
  const calls = [];
  return {
    calls,
    async request(name, options, callback) {
      calls.push({ name, options });
      if (held && options?.ifAvailable === true) return callback(null);
      held = true;
      try {
        return await callback({ name });
      } finally {
        held = false;
      }
    },
  };
}

function coordinator({ targetStorage = storage(), locks = lockManager(), times } = {}) {
  const queue = [...(times ?? [
    "2026-08-27T10:00:00.000Z",
    "2026-08-27T10:01:00.000Z",
  ])];
  return {
    targetStorage,
    locks,
    value: createAttendedModelTPromptCoordinator({
      locks,
      storage: targetStorage,
      tabId,
      now: () => queue.shift(),
    }),
  };
}

function request(value, overrides = {}) {
  return value.request({
    binding,
    action: "UPGRADE_PROGRAM",
    messageSha256,
    signer,
    prompt: async () => "signed",
    ...overrides,
  });
}

test("global exclusive lock persists entered before the only callback and marks verified", async () => {
  const { value, targetStorage, locks } = coordinator();
  const key = attendedPromptLatchKey({ binding, action: "UPGRADE_PROGRAM" });
  let callbackCalls = 0;
  const result = await request(value, {
    prompt: async () => {
      callbackCalls += 1;
      const entered = JSON.parse(targetStorage.value(key));
      assert.equal(entered.status, "PROMPT_ENTERED");
      assert.equal(entered.action, "UPGRADE_PROGRAM");
      assert.equal(entered.messageSha256, messageSha256);
      assert.equal(entered.signer, signer);
      assert.equal(entered.tabId, tabId);
      assert.equal(entered.enteredAtUtc, "2026-08-27T10:00:00.000Z");
      assert.equal(entered.finishedAtUtc, null);
      return "verified-signature";
    },
  });
  assert.equal(callbackCalls, 1);
  assert.equal(result.value, "verified-signature");
  assert.equal(result.latch.status, "PROMPT_VERIFIED");
  assert.equal(result.latch.finishedAtUtc, "2026-08-27T10:01:00.000Z");
  assert.equal(JSON.parse(targetStorage.value(key)).status, "PROMPT_VERIFIED");
  assert.deepEqual(locks.calls, [{
    name: IAT_V2_ATTENDED_PROMPT_GLOBAL_LOCK_NAME,
    options: { mode: "exclusive", ifAvailable: true },
  }]);
  assert.equal(Object.hasOwn(value, "clear"), false);
  assert.equal(Object.hasOwn(value, "reset"), false);
});

test("callback failure leaves a permanent failed latch and cannot reprompt", async () => {
  const { value, targetStorage } = coordinator();
  const key = attendedPromptLatchKey({ binding, action: "UPGRADE_PROGRAM" });
  let callbackCalls = 0;
  await assert.rejects(request(value, {
    prompt: async () => {
      callbackCalls += 1;
      throw new Error("device rejected");
    },
  }), /device rejected/u);
  const failed = JSON.parse(targetStorage.value(key));
  assert.equal(failed.status, "PROMPT_FAILED");
  assert.equal(failed.finishedAtUtc, "2026-08-27T10:01:00.000Z");
  await assert.rejects(request(value, {
    messageSha256: "d".repeat(64),
    prompt: async () => {
      callbackCalls += 1;
    },
  }), /already consumed its transaction-prompt latch/u);
  assert.equal(callbackCalls, 1);
  assert.equal(targetStorage.calls.some(([method]) => method === "removeItem"), false);
});

test("fresh blockhash message cannot bypass the source-bound canonical action latch", async () => {
  const { value } = coordinator();
  await request(value);
  let secondCalls = 0;
  await assert.rejects(request(value, {
    messageSha256: "d".repeat(64),
    prompt: async () => {
      secondCalls += 1;
    },
  }), /already consumed/u);
  assert.equal(secondCalls, 0);
  const firstKey = attendedPromptLatchKey({ binding, action: "UPGRADE_PROGRAM" });
  assert.equal(firstKey.includes(messageSha256), false);
  assert.match(firstKey, new RegExp(`${binding.sourceCommit}/${binding.programArtifactSha256}/${binding.mint}/UPGRADE_PROGRAM`, "u"));
});

test("round 11 reveal and expire share one permanent terminal-slot latch", async () => {
  const revealKey = attendedPromptLatchKey({ binding, action: "REVEAL_CCC_ROUND_11" });
  const expireKey = attendedPromptLatchKey({ binding, action: "EXPIRE_CCC_ROUND_11" });
  assert.equal(revealKey, expireKey);
  assert.match(revealKey, /\/CCC_ROUND_11_TERMINAL\/v1$/u);

  for (const [firstAction, secondAction, firstOutcome] of [
    ["REVEAL_CCC_ROUND_11", "EXPIRE_CCC_ROUND_11", "verified"],
    ["EXPIRE_CCC_ROUND_11", "REVEAL_CCC_ROUND_11", "failed"],
  ]) {
    const { value, targetStorage } = coordinator();
    let firstCalls = 0;
    let secondCalls = 0;
    const first = request(value, {
      action: firstAction,
      prompt: async () => {
        firstCalls += 1;
        if (firstOutcome === "failed") throw new Error("terminal prompt failed");
        return "terminal-signed";
      },
    });
    if (firstOutcome === "failed") {
      await assert.rejects(first, /terminal prompt failed/u);
    } else {
      await first;
    }
    const stored = JSON.parse(targetStorage.value(revealKey));
    assert.equal(stored.action, firstAction);
    assert.equal(stored.status, firstOutcome === "failed" ? "PROMPT_FAILED" : "PROMPT_VERIFIED");
    await assert.rejects(request(value, {
      action: secondAction,
      prompt: async () => { secondCalls += 1; },
    }), /already consumed its transaction-prompt latch/u);
    assert.equal(firstCalls, 1);
    assert.equal(secondCalls, 0);
  }
});

test("one global ifAvailable lock blocks concurrent prompts even for different actions", async () => {
  const sharedLocks = lockManager();
  const first = coordinator({ locks: sharedLocks });
  const second = coordinator({ locks: sharedLocks });
  let release;
  const blocker = new Promise((resolve) => { release = resolve; });
  let firstCalls = 0;
  let secondCalls = 0;
  const active = request(first.value, {
    prompt: async () => {
      firstCalls += 1;
      await blocker;
      return "first";
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(request(second.value, {
    action: "MIGRATE_LEGACY_ROUND_WEEK_7",
    prompt: async () => {
      secondCalls += 1;
    },
  }), /owns the global Web Lock/u);
  release();
  await active;
  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 0);
});

test("valid existing and malformed latches fail closed before callback", async () => {
  for (const serialized of [
    "{",
    JSON.stringify({ status: "PROMPT_ENTERED" }),
    JSON.stringify({
      schema: IAT_V2_ATTENDED_PROMPT_LATCH_SCHEMA,
      status: "PROMPT_ENTERED",
      ...binding,
      action: "UPGRADE_PROGRAM",
      messageSha256,
      signer,
      tabId,
      enteredAtUtc: "2026-08-27T10:00:00.000Z",
      finishedAtUtc: null,
    }),
  ]) {
    const targetStorage = storage();
    const key = attendedPromptLatchKey({ binding, action: "UPGRADE_PROGRAM" });
    targetStorage.setItem(key, serialized);
    const { value } = coordinator({ targetStorage });
    let calls = 0;
    const expectation = serialized === "{" || serialized.includes('"schema"') === false
      ? /malformed/u
      : /already consumed/u;
    await assert.rejects(request(value, {
      prompt: async () => { calls += 1; },
    }), expectation);
    assert.equal(calls, 0);
  }
});

test("missing Web Locks or storage and storage failures block before callback", async () => {
  let calls = 0;
  const noLocks = createAttendedModelTPromptCoordinator({
    locks: {},
    storage: storage(),
    tabId,
  });
  await assert.rejects(request(noLocks, { prompt: async () => { calls += 1; } }), /Web Locks are unavailable/u);

  const noStorage = createAttendedModelTPromptCoordinator({
    locks: lockManager(),
    storage: {},
    tabId,
  });
  await assert.rejects(request(noStorage, { prompt: async () => { calls += 1; } }), /storage is unavailable/u);

  const brokenStorage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
  };
  const broken = createAttendedModelTPromptCoordinator({
    locks: lockManager(),
    storage: brokenStorage,
    tabId,
  });
  await assert.rejects(request(broken, { prompt: async () => { calls += 1; } }), /unavailable for reading/u);
  assert.equal(calls, 0);
});

test("invalid binding, noncanonical action, message, signer, and tab ID fail closed", async () => {
  const { value } = coordinator();
  await assert.rejects(request(value, { action: "RETURN_BUFFER_AUTHORITY_TO_DEPLOYER" }), /outside the canonical attended roster/u);
  await assert.rejects(request(value, { binding: { ...binding, sourceCommit: "A".repeat(40) } }), /exact source commit/u);
  await assert.rejects(request(value, { binding: { ...binding, mint: "1" } }), /exact 32-byte mint/u);
  await assert.rejects(request(value, { messageSha256: "no" }), /exact message SHA-256/u);
  await assert.rejects(request(value, { signer: "0OIl" }), /exact 32-byte signer/u);
  await assert.rejects(request(value, { signer: "1" }), /exact 32-byte signer/u);
  assert.throws(() => createAttendedModelTPromptCoordinator({
    locks: lockManager(),
    storage: storage(),
    tabId: "not-a-uuid",
  }), /exact random tab ID/u);

  let calls = 0;
  const noncanonicalTime = coordinator({ times: ["2026-08-27 10:00:00Z"] });
  await assert.rejects(request(noncanonicalTime.value, {
    prompt: async () => { calls += 1; },
  }), /Prompt entered time is invalid/u);
  assert.equal(calls, 0);
});

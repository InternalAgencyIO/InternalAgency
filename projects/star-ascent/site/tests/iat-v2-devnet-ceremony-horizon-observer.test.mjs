import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_SEMANTICS,
  IAT_V2_DEVNET_CEREMONY_HORIZON_COMMITMENT,
  IAT_V2_DEVNET_CEREMONY_HORIZON_GENESIS_HASH,
  IAT_V2_DEVNET_CEREMONY_HORIZON_OBSERVATION_SCHEMA,
  IAT_V2_DEVNET_CEREMONY_HORIZON_RPC,
  IatV2DevnetCeremonyHorizonObserverError,
  createIatV2DevnetCeremonyHorizonRpcCaller,
  deriveIatV2DevnetCeremonyHorizon,
  deriveReviewedIatV2DevnetCeremonyConfigIdentity,
  isFinalizedTimestampBeforeStrictClose,
  observeIatV2DevnetCeremonyHorizon,
  runIatV2DevnetCeremonyHorizonObserverCli,
  selectStrictIatV2CeremonyHorizonClose,
  verifyFinalizedIatV2ClockAccount,
  verifyReviewedIatV2DevnetCeremonyConfigAccount,
} from "../scripts/observe-iat-v2-devnet-ceremony-horizon.mjs";

const GENESIS_TIMESTAMP = 1_780_636_775;
const OBSERVED_TIMESTAMP = 1_788_587_659;
const PROGRAM_ID = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const ADMIN = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const MINT = "CAJGkRQWXvJrUxK91XBPereaVSAUGzUY4yagxRKJdKUE";
const CONFIG = "9sqs4iAD9HBUA5a8L8eV39B1KepKb9jrRW3hAzvsPTBP";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const RANDOMNESS_PROGRAM = "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const CONFIG_DISCRIMINATOR = Buffer.from("9b0caae01efacc82", "hex");
const CLOCK_SYSVAR = "SysvarC1ock11111111111111111111111111111111";
const SYSVAR_PROGRAM = "Sysvar1111111111111111111111111111111111111";

function configAccount({
  owner = PROGRAM_ID,
  executable = false,
  admin = ADMIN,
  mint = MINT,
  tokenProgram = TOKEN_PROGRAM,
  randomnessProgram = RANDOMNESS_PROGRAM,
  genesisTimestamp = BigInt(GENESIS_TIMESTAMP),
  rehearsalMode = 1,
  active = 1,
  discriminator = CONFIG_DISCRIMINATOR,
  encoding = "base64",
  byteLength = 234,
  space = byteLength,
} = {}) {
  const bytes = Buffer.alloc(byteLength);
  if (byteLength >= 234) {
    discriminator.copy(bytes, 0);
    new PublicKey(admin).toBuffer().copy(bytes, 8);
    new PublicKey(mint).toBuffer().copy(bytes, 40);
    new PublicKey(tokenProgram).toBuffer().copy(bytes, 72);
    new PublicKey(randomnessProgram).toBuffer().copy(bytes, 104);
    bytes.writeBigInt64LE(genesisTimestamp, 200);
    bytes[228] = rehearsalMode;
    bytes[229] = active;
  }
  return {
    data: [bytes.toString("base64"), encoding],
    executable,
    lamports: 1,
    owner,
    rentEpoch: 0,
    space,
  };
}

function clockAccount({
  owner = SYSVAR_PROGRAM,
  executable = false,
  slot = 101n,
  unixTimestamp = BigInt(OBSERVED_TIMESTAMP),
  encoding = "base64",
  byteLength = 40,
  space = byteLength,
} = {}) {
  const bytes = Buffer.alloc(byteLength);
  if (byteLength >= 40) {
    bytes.writeBigUInt64LE(slot, 0);
    bytes.writeBigInt64LE(unixTimestamp, 32);
  }
  return {
    data: [bytes.toString("base64"), encoding],
    executable,
    lamports: 1,
    owner,
    rentEpoch: 0,
    space,
  };
}

function responseFor(body, result, overrides = {}) {
  const envelope = overrides.envelope ?? {
    jsonrpc: "2.0",
    id: overrides.id ?? body.id,
    ...(overrides.error === undefined ? { result } : { error: overrides.error }),
  };
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    redirected: overrides.redirected ?? false,
    url: overrides.url ?? IAT_V2_DEVNET_CEREMONY_HORIZON_RPC,
    headers: {
      get: (name) => name.toLowerCase() === "content-type"
        ? (overrides.contentType ?? "application/json; charset=utf-8")
        : null,
    },
    json: overrides.json ?? (async () => envelope),
  };
}

function sequentialFetch(steps, calls = []) {
  let cursor = 0;
  return async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });
    const step = steps[cursor++];
    assert.ok(step, `unexpected RPC call ${body.method}`);
    assert.equal(body.method, step.method);
    const result = typeof step.result === "function" ? await step.result(body) : step.result;
    return responseFor(body, result, step.response);
  };
}

async function observationFixture({
  genesisHash = IAT_V2_DEVNET_CEREMONY_HORIZON_GENESIS_HASH,
  finalizedObservationSlot = 100,
  stateContextSlot = 101,
  config = configAccount(),
  clock = clockAccount({ slot: BigInt(stateContextSlot) }),
  stateValue = [config, clock],
  calls = [],
} = {}) {
  const fetchImpl = sequentialFetch([
    { method: "getGenesisHash", result: genesisHash },
    { method: "getSlot", result: finalizedObservationSlot },
    {
      method: "getMultipleAccounts",
      result: { context: { slot: stateContextSlot }, value: stateValue },
    },
  ], calls);
  const rpcCall = createIatV2DevnetCeremonyHorizonRpcCaller({ fetchImpl });
  return observeIatV2DevnetCeremonyHorizon({ rpcCall });
}

test("deterministic feature mint and config PDA are the exact reviewed Devnet identities", async () => {
  const identity = await deriveReviewedIatV2DevnetCeremonyConfigIdentity();
  assert.equal(identity.programId.toBase58(), PROGRAM_ID);
  assert.equal(identity.admin.toBase58(), ADMIN);
  assert.equal(identity.tokenProgram.toBase58(), TOKEN_PROGRAM);
  assert.equal(identity.randomnessProgram.toBase58(), RANDOMNESS_PROGRAM);
  assert.equal(identity.mint.toBase58(), MINT);
  assert.equal(identity.config.toBase58(), CONFIG);
  assert.equal(identity.clock.toBase58(), CLOCK_SYSVAR);
  assert.equal(identity.sysvarProgram.toBase58(), SYSVAR_PROGRAM);
  assert.equal(Object.isFrozen(identity), true);
});

test("pure horizon derivation emits both boundaries, the strict minimum, and exact equality semantics", () => {
  const horizon = deriveIatV2DevnetCeremonyHorizon({
    genesisTimestamp: GENESIS_TIMESTAMP,
    finalizedTimestamp: OBSERVED_TIMESTAMP,
  });
  assert.deepEqual(horizon, {
    policyWeek: 13,
    cccRound: 13,
    nextPolicyBoundaryTimestamp: 1_789_103_975,
    nextPolicyBoundaryAtUtc: "2026-09-11T05:19:35.000Z",
    nextCccBoundaryTimestamp: 1_789_190_375,
    nextCccBoundaryAtUtc: "2026-09-12T05:19:35.000Z",
    strictMinimumCloseTimestamp: 1_789_103_975,
    strictMinimumCloseAtUtc: "2026-09-11T05:19:35.000Z",
    transitionKind: "POLICY_WEEK",
    strictCloseSemantics: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_SEMANTICS,
  });
  assert.equal(Object.isFrozen(horizon), true);
  assert.equal(isFinalizedTimestampBeforeStrictClose({
    finalizedTimestamp: horizon.strictMinimumCloseTimestamp - 1,
    strictMinimumCloseTimestamp: horizon.strictMinimumCloseTimestamp,
  }), true);
  assert.equal(isFinalizedTimestampBeforeStrictClose({
    finalizedTimestamp: horizon.strictMinimumCloseTimestamp,
    strictMinimumCloseTimestamp: horizon.strictMinimumCloseTimestamp,
  }), false);
  assert.equal(isFinalizedTimestampBeforeStrictClose({
    finalizedTimestamp: horizon.strictMinimumCloseTimestamp + 1,
    strictMinimumCloseTimestamp: horizon.strictMinimumCloseTimestamp,
  }), false);
});

test("transition selection covers policy, CCC, and defensive simultaneous boundaries", () => {
  assert.deepEqual(selectStrictIatV2CeremonyHorizonClose({
    nextPolicyBoundaryTimestamp: 100,
    nextCccBoundaryTimestamp: 200,
  }), { strictMinimumCloseTimestamp: 100, transitionKind: "POLICY_WEEK" });
  assert.deepEqual(selectStrictIatV2CeremonyHorizonClose({
    nextPolicyBoundaryTimestamp: 200,
    nextCccBoundaryTimestamp: 100,
  }), { strictMinimumCloseTimestamp: 100, transitionKind: "CCC_ROUND" });
  assert.deepEqual(selectStrictIatV2CeremonyHorizonClose({
    nextPolicyBoundaryTimestamp: 100,
    nextCccBoundaryTimestamp: 100,
  }), { strictMinimumCloseTimestamp: 100, transitionKind: "BOTH" });

  const beforeFirstCccRound = deriveIatV2DevnetCeremonyHorizon({
    genesisTimestamp: GENESIS_TIMESTAMP,
    finalizedTimestamp: GENESIS_TIMESTAMP + 1,
  });
  assert.equal(beforeFirstCccRound.policyWeek, 0);
  assert.equal(beforeFirstCccRound.cccRound, null);
  assert.equal(beforeFirstCccRound.transitionKind, "CCC_ROUND");
  assert.equal(beforeFirstCccRound.strictMinimumCloseTimestamp, GENESIS_TIMESTAMP + 86_400);
});

test("observer authenticates canonical finalized state and emits the exact canonical record", async () => {
  const calls = [];
  const observation = await observationFixture({ calls });
  assert.deepEqual(observation, {
    schema: IAT_V2_DEVNET_CEREMONY_HORIZON_OBSERVATION_SCHEMA,
    status: "PASS_READ_ONLY",
    network: "devnet",
    rpc: IAT_V2_DEVNET_CEREMONY_HORIZON_RPC,
    genesisHash: IAT_V2_DEVNET_CEREMONY_HORIZON_GENESIS_HASH,
    commitment: IAT_V2_DEVNET_CEREMONY_HORIZON_COMMITMENT,
    configAddress: CONFIG,
    configOwner: PROGRAM_ID,
    admin: ADMIN,
    mint: MINT,
    randomnessProgram: RANDOMNESS_PROGRAM,
    rehearsalMode: true,
    active: true,
    finalizedObservationSlot: 100,
    stateContextSlot: 101,
    configContextSlot: 101,
    clockContextSlot: 101,
    finalizedClockSlot: 101,
    finalizedTimestamp: OBSERVED_TIMESTAMP,
    finalizedAtUtc: "2026-09-05T05:54:19.000Z",
    genesisTimestamp: GENESIS_TIMESTAMP,
    genesisAtUtc: "2026-06-05T05:19:35.000Z",
    policyWeek: 13,
    cccRound: 13,
    nextPolicyBoundaryTimestamp: 1_789_103_975,
    nextPolicyBoundaryAtUtc: "2026-09-11T05:19:35.000Z",
    nextCccBoundaryTimestamp: 1_789_190_375,
    nextCccBoundaryAtUtc: "2026-09-12T05:19:35.000Z",
    strictMinimumCloseTimestamp: 1_789_103_975,
    strictMinimumCloseAtUtc: "2026-09-11T05:19:35.000Z",
    transitionKind: "POLICY_WEEK",
    strictCloseSemantics: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_SEMANTICS,
    readOnly: true,
  });
  assert.equal(Object.isFrozen(observation), true);
  assert.deepEqual(calls.map(({ body }) => body.method), [
    "getGenesisHash",
    "getSlot",
    "getMultipleAccounts",
  ]);
  assert.deepEqual(calls[0].body.params, []);
  assert.deepEqual(calls[1].body.params, [{ commitment: "finalized" }]);
  assert.deepEqual(calls[2].body.params, [[CONFIG, CLOCK_SYSVAR], {
    commitment: "finalized",
    encoding: "base64",
    minContextSlot: 100,
  }]);
  for (const [index, call] of calls.entries()) {
    assert.equal(call.url, IAT_V2_DEVNET_CEREMONY_HORIZON_RPC);
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.cache, "no-store");
    assert.equal(call.options.headers["content-type"], "application/json");
    assert.equal(call.body.jsonrpc, "2.0");
    assert.equal(call.body.id, index + 1);
  }
});

test("observer rejects noncanonical network, nonmonotonic slots, missing state, and unsafe time", async () => {
  const cases = [
    [
      "genesis drift",
      { genesisHash: "not-devnet" },
      "NETWORK_BINDING_HOLD",
      /genesis hash/u,
    ],
    [
      "invalid finalized slot",
      { finalizedObservationSlot: 0 },
      "RPC_CONTEXT_HOLD",
      /Finalized observation slot/u,
    ],
    [
      "account context below floor",
      { finalizedObservationSlot: 100, stateContextSlot: 99 },
      "RPC_CONTEXT_HOLD",
      /Finalized state context slot/u,
    ],
    [
      "missing config",
      { config: null },
      "CONFIG_ACCOUNT_HOLD",
      /absent/u,
    ],
    [
      "missing Clock sysvar",
      { clock: null },
      "CLOCK_ACCOUNT_HOLD",
      /absent/u,
    ],
    [
      "Clock slot mismatch",
      { clock: clockAccount({ slot: 100n }) },
      "CLOCK_CONTEXT_HOLD",
      /does not match/u,
    ],
    [
      "unsafe Clock time",
      { clock: clockAccount({ unixTimestamp: BigInt(Number.MAX_SAFE_INTEGER) }) },
      "HORIZON_TIME_HOLD",
      /millisecond range/u,
    ],
    [
      "malformed state tuple",
      { stateValue: [configAccount()] },
      "RPC_CONTEXT_HOLD",
      /snapshot is absent or malformed/u,
    ],
  ];
  for (const [label, options, code, message] of cases) {
    await assert.rejects(
      observationFixture(options),
      (error) => error instanceof IatV2DevnetCeremonyHorizonObserverError
        && error.code === code
        && message.test(error.message),
      label,
    );
  }
  await assert.rejects(
    observeIatV2DevnetCeremonyHorizon({ rpcCall: async () => null }),
    (error) => error instanceof IatV2DevnetCeremonyHorizonObserverError
      && error.code === "RPC_CONFIGURATION_HOLD"
      && /canonical horizon-observer RPC transport/u.test(error.message),
  );
});

test("config verifier fails closed across discriminator, owner, encoding, identity, state, and Genesis drift", async () => {
  const identity = await deriveReviewedIatV2DevnetCeremonyConfigIdentity();
  const wrongKey = "11111111111111111111111111111111";
  const cases = [
    ["owner", { owner: wrongKey }, "CONFIG_IDENTITY_HOLD", /owner/u],
    ["executable", { executable: true }, "CONFIG_ACCOUNT_HOLD", /non-executable/u],
    ["encoding", { encoding: "base64+zstd" }, "CONFIG_ACCOUNT_HOLD", /encoding/u],
    ["length", { byteLength: 233 }, "CONFIG_ACCOUNT_HOLD", /byte length/u],
    ["space", { space: 233 }, "CONFIG_ACCOUNT_HOLD", /space/u],
    ["discriminator", { discriminator: Buffer.alloc(8, 1) }, "CONFIG_DISCRIMINATOR_HOLD", /discriminator/u],
    ["admin", { admin: wrongKey }, "CONFIG_IDENTITY_HOLD", /administrator/u],
    ["mint", { mint: wrongKey }, "CONFIG_IDENTITY_HOLD", /mint/u],
    ["token", { tokenProgram: wrongKey }, "CONFIG_IDENTITY_HOLD", /token program/u],
    ["randomness", { randomnessProgram: wrongKey }, "CONFIG_IDENTITY_HOLD", /randomness program/u],
    ["rehearsal", { rehearsalMode: 0 }, "CONFIG_STATE_HOLD", /rehearsal/u],
    ["active", { active: 0 }, "CONFIG_STATE_HOLD", /not active/u],
    ["negative Genesis", { genesisTimestamp: -1n }, "CONFIG_GENESIS_HOLD", /Genesis/u],
    [
      "unsafe Genesis",
      { genesisTimestamp: BigInt(Number.MAX_SAFE_INTEGER) },
      "HORIZON_TIME_HOLD",
      /millisecond range/u,
    ],
  ];
  for (const [label, options, code, message] of cases) {
    const account = await configAccount(options);
    assert.throws(
      () => verifyReviewedIatV2DevnetCeremonyConfigAccount({ account, identity }),
      (error) => error instanceof IatV2DevnetCeremonyHorizonObserverError
        && error.code === code
        && message.test(error.message),
      label,
    );
  }

  const noncanonical = await configAccount();
  noncanonical.data[0] = `${noncanonical.data[0]}=`;
  assert.throws(
    () => verifyReviewedIatV2DevnetCeremonyConfigAccount({ account: noncanonical, identity }),
    (error) => error.code === "CONFIG_ACCOUNT_HOLD" && /canonical base64/u.test(error.message),
  );
});

test("Clock verifier authenticates the exact finalized sysvar snapshot", async () => {
  const identity = await deriveReviewedIatV2DevnetCeremonyConfigIdentity();
  assert.deepEqual(verifyFinalizedIatV2ClockAccount({
    account: clockAccount(),
    identity,
    contextSlot: 101,
  }), {
    slot: 101,
    unixTimestamp: OBSERVED_TIMESTAMP,
    bytes: 40,
  });

  const wrongKey = "11111111111111111111111111111111";
  const cases = [
    ["owner", { owner: wrongKey }, 101, "CLOCK_IDENTITY_HOLD", /owner/u],
    ["executable", { executable: true }, 101, "CLOCK_ACCOUNT_HOLD", /non-executable/u],
    ["encoding", { encoding: "base64+zstd" }, 101, "CLOCK_ACCOUNT_HOLD", /encoding/u],
    ["length", { byteLength: 39 }, 101, "CLOCK_ACCOUNT_HOLD", /byte length/u],
    ["space", { space: 39 }, 101, "CLOCK_ACCOUNT_HOLD", /space/u],
    ["slot mismatch", { slot: 100n }, 101, "CLOCK_CONTEXT_HOLD", /does not match/u],
    ["unsafe slot", { slot: BigInt(Number.MAX_SAFE_INTEGER) + 1n }, 101, "CLOCK_CONTEXT_HOLD", /safe-integer/u],
    ["negative time", { unixTimestamp: -1n }, 101, "CLOCK_TIME_HOLD", /timestamp/u],
  ];
  for (const [label, options, contextSlot, code, message] of cases) {
    assert.throws(
      () => verifyFinalizedIatV2ClockAccount({
        account: clockAccount(options),
        identity,
        contextSlot,
      }),
      (error) => error instanceof IatV2DevnetCeremonyHorizonObserverError
        && error.code === code
        && message.test(error.message),
      label,
    );
  }

  const noncanonical = clockAccount();
  noncanonical.data[0] = `${noncanonical.data[0]}=`;
  assert.throws(
    () => verifyFinalizedIatV2ClockAccount({ account: noncanonical, identity, contextSlot: 101 }),
    (error) => error.code === "CLOCK_ACCOUNT_HOLD" && /canonical base64/u.test(error.message),
  );
});

test("RPC transport admits only its three read-only methods and exact parameter arrays", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });
    return responseFor(body, 456);
  };
  const rpcCall = createIatV2DevnetCeremonyHorizonRpcCaller({ fetchImpl });
  assert.equal(await rpcCall("getSlot", [{ commitment: "finalized" }]), 456);
  assert.equal(await rpcCall("getMultipleAccounts", [[CONFIG, CLOCK_SYSVAR], {
    commitment: "finalized",
    encoding: "base64",
  }]), 456);
  assert.deepEqual(calls.map(({ body }) => body.id), [1, 2]);

  for (const method of ["getBlockTime", "sendTransaction"]) {
    await assert.rejects(
      rpcCall(method, []),
      (error) => error.code === "RPC_METHOD_HOLD" && /read-only/u.test(error.message),
    );
  }
  await assert.rejects(
    rpcCall("getSlot", { commitment: "finalized" }),
    (error) => error.code === "RPC_CONFIGURATION_HOLD" && /parameters must be an array/u.test(error.message),
  );
  assert.equal(calls.length, 2, "rejected calls must stop before fetch");
  assert.throws(
    () => createIatV2DevnetCeremonyHorizonRpcCaller({
      endpoint: "https://example.invalid",
      fetchImpl,
    }),
    (error) => error.code === "RPC_CONFIGURATION_HOLD" && /canonical Devnet RPC endpoint/u.test(error.message),
  );
});

test("RPC transport rejects HTTP, redirect, endpoint, content-type, JSON, ID, and envelope drift", async () => {
  const cases = [
    ["HTTP", { ok: false, status: 503 }, /HTTP status 503/u],
    ["redirect", { redirected: true }, /followed a redirect/u],
    ["response endpoint", { url: "https://example.invalid" }, /URL drifted/u],
    ["content type", { contentType: "text/html" }, /not application\/json/u],
    ["invalid JSON", { json: async () => { throw new SyntaxError("bad JSON"); } }, /not valid JSON/u],
    ["ID", { id: 999 }, /envelope drifted/u],
    ["RPC error", { error: { code: -32000, message: "hold" } }, /envelope drifted/u],
    ["missing result", { envelope: { jsonrpc: "2.0", id: 1 } }, /envelope drifted/u],
  ];
  for (const [label, response, message] of cases) {
    const fetchImpl = async (_url, options) => {
      const body = JSON.parse(options.body);
      return responseFor(body, 123, response);
    };
    const rpcCall = createIatV2DevnetCeremonyHorizonRpcCaller({ fetchImpl });
    await assert.rejects(
      rpcCall("getSlot", [{ commitment: "finalized" }]),
      (error) => error instanceof IatV2DevnetCeremonyHorizonObserverError
        && error.code === "RPC_TRANSPORT_HOLD"
        && message.test(error.message),
      label,
    );
  }
});

test("source is import-safe, signer-free, write-free, finalized-only, and package-routed", async () => {
  const source = readFileSync("scripts/observe-iat-v2-devnet-ceremony-horizon.mjs", "utf8");
  assert.doesNotMatch(
    source,
    /node:fs|writeFile|appendFile|mkdir|createWriteStream|sendRawTransaction|sendTransaction|signTransaction|signAllTransactions|partialSign|TransactionInstruction|VersionedTransaction|Keypair|secretKey|\.sign\(/u,
  );
  assert.doesNotMatch(source, /Date\.now|"confirmed"|'confirmed'|mainnet-beta/u);
  assert.doesNotMatch(source, /getBlockTime|getAccountInfo/u);
  assert.match(source, /const READ_ONLY_RPC_METHODS = new Set\(\[\s*"getGenesisHash",\s*"getMultipleAccounts",\s*"getSlot",\s*\]\)/u);
  assert.match(source, /redirect: "error"/u);
  assert.match(source, /cache: "no-store"/u);
  assert.match(source, /responseUrl === canonicalUrl/u);
  assert.match(source, /envelope\.id === id/u);
  assert.match(source, /commitment: IAT_V2_DEVNET_CEREMONY_HORIZON_COMMITMENT/u);
  assert.match(source, /minContextSlot: finalizedObservationSlot/u);
  assert.match(source, /rpcCall\("getMultipleAccounts", \[/u);
  assert.match(source, /CONFIG_ACCOUNT_DISCRIMINATOR = Buffer\.from\("9b0caae01efacc82", "hex"\)/u);
  assert.match(source, /bytes\.readBigInt64LE\(32\)/u);
  assert.match(source, /clockSlot === exactContextSlot/u);
  assert.match(source, /observed < close/u);
  assert.match(source, /EQUALITY_IS_CLOSED/u);
  assert.match(
    source,
    /if \(resolve\(process\.argv\[1\] \?\? ""\) === fileURLToPath\(import\.meta\.url\)\)/u,
  );

  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(
    packageJson.scripts["observe:iat-v2-devnet-ceremony-horizon"],
    "node scripts/observe-iat-v2-devnet-ceremony-horizon.mjs",
  );
  assert.match(
    packageJson.scripts["check:iat-v2-attended-safety"],
    /tests\/iat-v2-devnet-ceremony-horizon-observer\.test\.mjs/u,
  );
  await assert.rejects(
    runIatV2DevnetCeremonyHorizonObserverCli(["--rpc"]),
    (error) => error.code === "CLI_USAGE" && /accepts no options/u.test(error.message),
  );
});

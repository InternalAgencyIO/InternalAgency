import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  BUFFER_METADATA_BYTES,
  CANONICAL_DEVNET_GENESIS_HASH,
  CANONICAL_DEVNET_RPC,
  CANONICAL_PUBLIC_CI_ARTIFACT,
  FINALIZED_BUFFER_RECONCILIATION_SCHEMA,
  FinalizedBufferReconciliationError,
  REVIEWED_DEVNET_DEPLOYER,
  REVIEWED_MODEL_T_ADMIN,
  UPGRADEABLE_LOADER_ID,
  assertReviewedPublicCiArtifact,
  compareBufferProgramBytes,
  createJsonRpcCaller,
  loadReviewedPublicCiArtifact,
  reconcileFinalizedDevnetBuffer,
  writeDurableReconciliationEvidence,
} from "../scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const BUFFER_ADDRESS = "564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH";
const TEST_ARTIFACT = Buffer.from([
  0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00,
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
]);
const TEST_BINDING = Object.freeze({
  expectedBytes: TEST_ARTIFACT.length,
  expectedSha256: sha256(TEST_ARTIFACT),
  sourceHeadCommit: "0123456789abcdef0123456789abcdef01234567",
  ciRunId: 1,
  evidenceManifestSha256: "0".repeat(64),
});

function bufferAccountData(programBytes, {
  authority = REVIEWED_DEVNET_DEPLOYER,
  authorityOption = 1,
  stateTag = 1,
} = {}) {
  const data = Buffer.alloc(BUFFER_METADATA_BYTES + programBytes.length);
  data.writeUInt32LE(stateTag, 0);
  data[4] = authorityOption;
  new PublicKey(authority).toBuffer().copy(data, 5);
  programBytes.copy(data, BUFFER_METADATA_BYTES);
  return data;
}

function accountValue(programBytes, overrides = {}) {
  const { data: suppliedData, ...accountOverrides } = overrides;
  const data = suppliedData ?? bufferAccountData(programBytes, overrides);
  return {
    data: [data.toString("base64"), "base64"],
    executable: false,
    lamports: 4_000_000,
    owner: UPGRADEABLE_LOADER_ID,
    rentEpoch: 0,
    ...accountOverrides,
  };
}

function mockRpc({
  account = accountValue(TEST_ARTIFACT),
  accountContextSlot = 701,
  genesisHash = CANONICAL_DEVNET_GENESIS_HASH,
  minContextSlot = 700,
} = {}) {
  const calls = [];
  return {
    calls,
    rpcCall: async (method, params) => {
      calls.push({ method, params });
      if (method === "getGenesisHash") return genesisHash;
      if (method === "getSlot") return minContextSlot;
      if (method === "getAccountInfo") {
        return { context: { slot: accountContextSlot }, value: account };
      }
      throw new Error(`unexpected RPC method ${method}`);
    },
  };
}

async function reconcile(overrides = {}) {
  const transport = overrides.transport ?? mockRpc(overrides.rpc);
  const record = await reconcileFinalizedDevnetBuffer({
    rpcCall: transport.rpcCall,
    bufferAddress: BUFFER_ADDRESS,
    expectedAuthority: REVIEWED_DEVNET_DEPLOYER,
    artifactBytes: TEST_ARTIFACT,
    artifactBinding: TEST_BINDING,
    observedAt: new Date("2026-08-28T12:34:56.789Z"),
    ...overrides.options,
  });
  return { record, calls: transport.calls };
}

test("exact finalized Buffer reconciliation is signer-free and bound to one monotonic read", async () => {
  const { record, calls } = await reconcile();
  assert.equal(record.schema, FINALIZED_BUFFER_RECONCILIATION_SCHEMA);
  assert.equal(record.status, "EXACT_FINALIZED_BUFFER");
  assert.equal(record.rpc, CANONICAL_DEVNET_RPC);
  assert.equal(record.genesisHash, CANONICAL_DEVNET_GENESIS_HASH);
  assert.equal(record.minContextSlot, 700);
  assert.equal(record.accountContextSlot, 701);
  assert.equal(record.bufferAddress, BUFFER_ADDRESS);
  assert.equal(record.observedAuthority, REVIEWED_DEVNET_DEPLOYER);
  assert.equal(record.observedAuthorityRole, "DEVNET_DEPLOYER");
  assert.equal(record.account.owner, UPGRADEABLE_LOADER_ID);
  assert.equal(record.account.executable, false);
  assert.equal(record.account.metadataBytes, BUFFER_METADATA_BYTES);
  assert.equal(record.account.programBytes, TEST_ARTIFACT.length);
  assert.equal(record.comparison.classification, "EXACT_ARTIFACT");
  assert.equal(record.validation.exact, true);
  assert.deepEqual(record.validation.holdReasons, []);
  assert.deepEqual(calls, [
    { method: "getGenesisHash", params: [] },
    { method: "getSlot", params: [{ commitment: "finalized" }] },
    {
      method: "getAccountInfo",
      params: [BUFFER_ADDRESS, {
        commitment: "finalized",
        encoding: "base64",
        minContextSlot: 700,
      }],
    },
  ]);
  assert.deepEqual(record.boundary, {
    mutationAuthorized: false,
    signing: false,
    broadcast: false,
    protectedRecoveryStateRead: false,
    next: "SEPARATE_ATTENDED_ACTION_REVIEW_REQUIRED",
  });
  const { evidenceBodySha256, ...body } = record;
  assert.equal(
    evidenceBodySha256,
    sha256(Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8")),
  );
});

test("exact-prefix zero-tail upload is characterized and remains HOLD", async () => {
  const partial = Buffer.alloc(TEST_ARTIFACT.length);
  TEST_ARTIFACT.subarray(0, 8).copy(partial);
  const { record } = await reconcile({
    rpc: { account: accountValue(partial) },
  });
  assert.equal(record.status, "HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL");
  assert.equal(record.comparison.classification, "PARTIAL_EXACT_PREFIX_ZERO_TAIL");
  assert.equal(record.comparison.matchingPrefixBytes, 8);
  assert.equal(record.comparison.expectedRemainingBytes, 8);
  assert.equal(record.comparison.observedSuffixIsZero, true);
  assert.equal(record.validation.partialExactPrefixZeroTail, true);
  assert.deepEqual(record.validation.holdReasons, ["PROGRAM_SHA256_MISMATCH"]);
  assert.equal(record.boundary.next, "PRESERVE_EXISTING_ADDRESS_AND_DO_NOT_RESUBMIT");
});

test("a completely unwritten zero-filled account is distinguished from a partial prefix", async () => {
  const comparison = compareBufferProgramBytes(Buffer.alloc(TEST_ARTIFACT.length), TEST_ARTIFACT);
  assert.equal(comparison.classification, "ZERO_FILLED_UNWRITTEN_BUFFER");
  assert.equal(comparison.matchingPrefixBytes, 0);
  assert.equal(comparison.trailingZeroBytes, TEST_ARTIFACT.length);
  const { record } = await reconcile({
    rpc: { account: accountValue(Buffer.alloc(TEST_ARTIFACT.length)) },
  });
  assert.equal(record.status, "HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL");
  assert.equal(record.validation.partialExactPrefixZeroTail, true);
});

test("non-zero divergence and size drift cannot be described as resumable prefix state", async (t) => {
  await t.test("divergent bytes", async () => {
    const divergent = Buffer.from(TEST_ARTIFACT);
    divergent[8] ^= 0xff;
    const { record } = await reconcile({ rpc: { account: accountValue(divergent) } });
    assert.equal(record.status, "HOLD_BUFFER_MISMATCH");
    assert.equal(record.comparison.classification, "DIVERGENT_BYTES");
    assert.equal(record.validation.partialExactPrefixZeroTail, false);
    assert(record.validation.holdReasons.includes("NON_CANONICAL_BYTE_RELATION"));
  });
  await t.test("truncated exact prefix", async () => {
    const truncated = TEST_ARTIFACT.subarray(0, 8);
    const { record } = await reconcile({ rpc: { account: accountValue(truncated) } });
    assert.equal(record.status, "HOLD_BUFFER_MISMATCH");
    assert.equal(record.comparison.classification, "TRUNCATED_EXACT_PREFIX");
    assert(record.validation.holdReasons.includes("ACCOUNT_OR_PROGRAM_SIZE_MISMATCH"));
  });
});

test("network, context, loader metadata, and authority checks fail closed", async (t) => {
  await t.test("artifact drift stops before any RPC", async () => {
    const transport = mockRpc();
    const driftedArtifact = Buffer.from(TEST_ARTIFACT);
    driftedArtifact[0] ^= 0xff;
    await assert.rejects(
      reconcile({ transport, options: { artifactBytes: driftedArtifact } }),
      (error) => error instanceof FinalizedBufferReconciliationError
        && error.code === "ARTIFACT_BINDING_HOLD",
    );
    assert.deepEqual(transport.calls, []);
  });
  await t.test("unreviewed expected authority stops before any RPC", async () => {
    const transport = mockRpc();
    await assert.rejects(
      reconcile({ transport, options: { expectedAuthority: BUFFER_ADDRESS } }),
      (error) => error instanceof FinalizedBufferReconciliationError
        && error.code === "BUFFER_AUTHORITY_HOLD",
    );
    assert.deepEqual(transport.calls, []);
  });
  await t.test("wrong genesis stops before any account read", async () => {
    const transport = mockRpc({ genesisHash: "11111111111111111111111111111111" });
    await assert.rejects(
      reconcile({ transport }),
      (error) => error instanceof FinalizedBufferReconciliationError
        && error.code === "NETWORK_BINDING_HOLD",
    );
    assert.deepEqual(transport.calls.map(({ method }) => method), ["getGenesisHash"]);
  });
  await t.test("context rollback", async () => {
    await assert.rejects(
      reconcile({ rpc: { minContextSlot: 700, accountContextSlot: 699 } }),
      (error) => error instanceof FinalizedBufferReconciliationError
        && error.code === "RPC_CONTEXT_HOLD",
    );
  });
  for (const [name, account, code] of [
    ["owner", accountValue(TEST_ARTIFACT, { owner: "11111111111111111111111111111111" }), "BUFFER_OWNER_HOLD"],
    ["executable", accountValue(TEST_ARTIFACT, { executable: true }), "BUFFER_EXECUTABLE_HOLD"],
    ["state tag", accountValue(TEST_ARTIFACT, { data: bufferAccountData(TEST_ARTIFACT, { stateTag: 2 }) }), "BUFFER_LAYOUT_HOLD"],
    ["missing authority", accountValue(TEST_ARTIFACT, { data: bufferAccountData(TEST_ARTIFACT, { authorityOption: 0 }) }), "BUFFER_AUTHORITY_HOLD"],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(
        reconcile({ rpc: { account } }),
        (error) => error instanceof FinalizedBufferReconciliationError
          && error.code === code,
      );
    });
  }
  await t.test("unexpected reviewed-phase authority is recorded as HOLD", async () => {
    const account = accountValue(TEST_ARTIFACT, {
      data: bufferAccountData(TEST_ARTIFACT, { authority: REVIEWED_MODEL_T_ADMIN }),
    });
    const { record } = await reconcile({ rpc: { account } });
    assert.equal(record.status, "HOLD_BUFFER_MISMATCH");
    assert.equal(record.observedAuthorityRole, "MODEL_T_ADMIN");
    assert.equal(record.validation.authorityAdmitted, true);
    assert.equal(record.validation.authorityMatchesExpected, false);
    assert(record.validation.holdReasons.includes("EXPECTED_AUTHORITY_MISMATCH"));
  });
  await t.test("unreviewed observed authority is recorded as HOLD", async () => {
    const account = accountValue(TEST_ARTIFACT, {
      data: bufferAccountData(TEST_ARTIFACT, { authority: BUFFER_ADDRESS }),
    });
    const { record } = await reconcile({ rpc: { account } });
    assert.equal(record.status, "HOLD_BUFFER_MISMATCH");
    assert.equal(record.observedAuthorityRole, "UNREVIEWED");
    assert.equal(record.validation.authorityAdmitted, false);
    assert(record.validation.holdReasons.includes("UNREVIEWED_AUTHORITY"));
  });
  await t.test("reviewed Model T phase can be selected explicitly", async () => {
    const account = accountValue(TEST_ARTIFACT, {
      data: bufferAccountData(TEST_ARTIFACT, { authority: REVIEWED_MODEL_T_ADMIN }),
    });
    const { record } = await reconcile({
      rpc: { account },
      options: { expectedAuthority: REVIEWED_MODEL_T_ADMIN },
    });
    assert.equal(record.status, "EXACT_FINALIZED_BUFFER");
    assert.equal(record.observedAuthorityRole, "MODEL_T_ADMIN");
  });
});

test("the canonical raw caller transport remains endpoint-pinned and read-only", async () => {
  const envelopes = [];
  const results = [
    CANONICAL_DEVNET_GENESIS_HASH,
    700,
    { context: { slot: 701 }, value: accountValue(TEST_ARTIFACT) },
  ];
  const caller = createJsonRpcCaller({
    fetchImpl: async (url, options) => {
      const envelope = JSON.parse(options.body);
      envelopes.push({ url, options, envelope });
      return {
        ok: true,
        status: 200,
        redirected: false,
        url: `${CANONICAL_DEVNET_RPC}/`,
        headers: { get: () => "application/json" },
        json: async () => ({
          jsonrpc: "2.0",
          id: envelope.id,
          result: results.shift(),
        }),
      };
    },
  });
  const { record } = await reconcile({ transport: { rpcCall: caller, calls: [] } });
  assert.equal(record.status, "EXACT_FINALIZED_BUFFER");
  assert.deepEqual(envelopes.map(({ envelope }) => envelope.method), [
    "getGenesisHash",
    "getSlot",
    "getAccountInfo",
  ]);
  assert(envelopes.every(({ url, options }) =>
    url === CANONICAL_DEVNET_RPC
      && options.method === "POST"
      && options.redirect === "error"
      && options.cache === "no-store"));
  let fetched = false;
  const blocked = createJsonRpcCaller({ fetchImpl: async () => { fetched = true; } });
  await assert.rejects(blocked("sendTransaction", []), { code: "RPC_METHOD_HOLD" });
  assert.equal(fetched, false);
});

test("public CI artifact loader is pinned and durable evidence is exclusive", () => {
  const artifact = loadReviewedPublicCiArtifact();
  assert.equal(CANONICAL_PUBLIC_CI_ARTIFACT.endsWith("iat_v2.so"), true);
  assert.equal(artifact.byteLength, 649_680);
  assert.equal(artifact.sha256, "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01");
  assert.throws(
    () => assertReviewedPublicCiArtifact(Buffer.from(artifact.bytes).fill(0, 0, 1)),
    (error) => error instanceof FinalizedBufferReconciliationError
      && error.code === "ARTIFACT_BINDING_HOLD",
  );
  const directory = mkdtempSync(join(tmpdir(), "iat-v2-finalized-buffer-evidence-"));
  const output = join(directory, "observation.json");
  const record = { schema: FINALIZED_BUFFER_RECONCILIATION_SCHEMA, status: "TEST" };
  assert.equal(writeDurableReconciliationEvidence(output, record), output);
  assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), record);
  if (process.platform !== "win32") assert.equal(statSync(output).mode & 0o777, 0o600);
  assert.throws(() => writeDurableReconciliationEvidence(output, record), { code: "EEXIST" });
});

test("reconciler source has no transaction, keypair, or protected-state capability", () => {
  const source = readFileSync(
    new URL("../scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /createJsonRpcCaller/u);
  assert.match(source, /commitment: "finalized"[\s\S]*encoding: "base64"[\s\S]*minContextSlot/u);
  assert.doesNotMatch(source, /sendRawTransaction|sendTransaction|signTransaction|Keypair|write-buffer|set-buffer-authority/u);
  assert.doesNotMatch(source, /attempt-one-use|buffer-keypair\.json|devnet-buffer-rebuild|devnet-buffer-handoff-v1/u);
  const programUpgrade = readFileSync(
    new URL("../tools/iat-v2-admin-console/ProgramUpgrade.jsx", import.meta.url),
    "utf8",
  );
  assert.match(programUpgrade, /const BUFFER_METADATA_BYTES = 37;/u);
  assert.match(programUpgrade, /data\.readUInt32LE\(0\) !== 1/u);
  assert.match(programUpgrade, /data\[4\] !== 1/u);
  assert.match(programUpgrade, /new PublicKey\(data\.subarray\(5, 37\)\)/u);
  assert.match(programUpgrade, /programBytes: data\.subarray\(BUFFER_METADATA_BYTES\)/u);
});

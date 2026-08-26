import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalizeRfc8785 } from "../scripts/iat-v2-canonical-json.mjs";
import {
  INDEPENDENT_SECURITY_ARTIFACT_ENTRIES,
  INDEPENDENT_SECURITY_ARTIFACT_NAME,
  INDEPENDENT_SECURITY_EVIDENCE_SCHEMA,
  INDEPENDENT_SECURITY_EVIDENCE_STATUS,
  INDEPENDENT_SECURITY_MAINNET_STATUS,
  INDEPENDENT_SECURITY_MANIFEST_PATH,
  INDEPENDENT_SECURITY_PREDICATE,
  INDEPENDENT_SECURITY_REPOSITORY,
  INDEPENDENT_SECURITY_REPOSITORY_ID,
  INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
  INDEPENDENT_SECURITY_WORKFLOW_PATH,
} from "../scripts/lib/iat-v2-independent-security-evidence.mjs";

const SOURCE_HEAD = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const PROGRAM_ARTIFACT = "c".repeat(64);
const RUN_ID = 33_000_000_001;
const RUN_ATTEMPT = 1;
const JOB_ID = 98_300_000_001;
const ARTIFACT_ID = 9_620_000_001;
const OBSERVED_AT = "2026-08-26T20:04:00Z";
const EXPIRES_AT = "2026-08-26T20:19:00Z";
const API_ORIGIN = "https://api.github.com";
const WEB_ORIGIN = "https://github.com";
const RUN_API_URL = `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}/actions/runs/${RUN_ID}`;
const JOBS_API_URL = `${RUN_API_URL}/attempts/${RUN_ATTEMPT}/jobs?per_page=100`;
const ARTIFACTS_API_URL = `${RUN_API_URL}/artifacts?per_page=100`;
const ARTIFACT_API_URL = `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}/actions/artifacts/${ARTIFACT_ID}`;
const ARCHIVE_API_URL = `${ARTIFACT_API_URL}/zip`;
const RUN_WEB_URL = `${WEB_ORIGIN}/${INDEPENDENT_SECURITY_REPOSITORY}/actions/runs/${RUN_ID}`;
const JOB_WEB_URL = `${RUN_WEB_URL}/job/${JOB_ID}`;
const MODULE_URL = new URL(
  "../scripts/lib/iat-v2-github-hosted-state-authenticator.mjs",
  import.meta.url,
);
const TOKEN = "github_pat_fixture_token_not_a_real_credential";

let moduleCounter = 0;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, value] of [...entries].sort(([left], [right]) => left.localeCompare(right))) {
    const nameBytes = Buffer.from(name, "utf8");
    const bytes = Buffer.from(value);
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + bytes.length;
  }
  const localDirectory = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.size, 8);
  end.writeUInt16LE(entries.size, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localDirectory.length, 16);
  return Buffer.concat([localDirectory, centralDirectory, end]);
}

function manifest() {
  return {
    schema: INDEPENDENT_SECURITY_EVIDENCE_SCHEMA,
    status: INDEPENDENT_SECURITY_EVIDENCE_STATUS,
    predicate: INDEPENDENT_SECURITY_PREDICATE,
    sourceBinding: {
      commit: SOURCE_HEAD,
      tree: SOURCE_TREE,
      programArtifactSha256: PROGRAM_ARTIFACT,
    },
    ciProvenance: {
      serverUrl: WEB_ORIGIN,
      repository: INDEPENDENT_SECURITY_REPOSITORY,
      repositoryId: INDEPENDENT_SECURITY_REPOSITORY_ID,
      workflowRef: `${INDEPENDENT_SECURITY_REPOSITORY}/${INDEPENDENT_SECURITY_WORKFLOW_PATH}@refs/pull/14/merge`,
      workflowPath: INDEPENDENT_SECURITY_WORKFLOW_PATH,
      workflowSha256: "d".repeat(64),
      runId: RUN_ID,
      runAttempt: RUN_ATTEMPT,
      eventName: "pull_request",
      sourceHeadSha: SOURCE_HEAD,
      checkoutSha: SOURCE_HEAD,
      checkoutRelation: "IDENTICAL",
      jobKey: INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
      jobName: INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
      runnerOs: "Linux",
      runnerArch: "X64",
      artifactName: INDEPENDENT_SECURITY_ARTIFACT_NAME,
    },
    inputBindings: [],
    toolchain: {},
    checks: [],
    findingSummary: {},
    artifactContract: {
      name: INDEPENDENT_SECURITY_ARTIFACT_NAME,
      manifestPath: INDEPENDENT_SECURITY_MANIFEST_PATH,
      entries: INDEPENDENT_SECURITY_ARTIFACT_ENTRIES,
    },
    observedAtUtc: OBSERVED_AT,
    expiresAtUtc: EXPIRES_AT,
    safety: {},
    limitations: [],
    mainnetStatus: INDEPENDENT_SECURITY_MAINNET_STATUS,
  };
}

function response({ url, status, headers, body = Buffer.alloc(0), redirected = false }) {
  const bytes = Buffer.from(body);
  return {
    url,
    status,
    redirected,
    headers: new Headers(headers),
    body: null,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

function jsonResponse(url, value, headers, overrides = {}) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return response({
    url: overrides.url ?? url,
    status: overrides.status ?? 200,
    redirected: overrides.redirected ?? false,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(body.length),
      ...headers,
      ...overrides.headers,
    },
    body,
  });
}

function input() {
  return {
    live: true,
    runId: RUN_ID,
    runAttempt: RUN_ATTEMPT,
    sourceHeadSha: SOURCE_HEAD,
    sourceTree: SOURCE_TREE,
    programArtifactSha256: PROGRAM_ARTIFACT,
  };
}

function buildFixture({ mutateManifest = () => {}, mutate = () => {} } = {}) {
  const evidence = manifest();
  mutateManifest(evidence);
  const evidenceBytes = Buffer.from(`${canonicalizeRfc8785(evidence)}\n`, "utf8");
  const entries = new Map(INDEPENDENT_SECURITY_ARTIFACT_ENTRIES.map((path, index) => [
    path,
    path === INDEPENDENT_SECURITY_MANIFEST_PATH
      ? evidenceBytes
      : Buffer.from(`fixture:${index}:${path}\n`, "utf8"),
  ]));
  const archive = storeZip(entries);
  const workflowId = 9_001;
  const apiBase = `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}`;
  const run = {
    id: RUN_ID,
    run_attempt: RUN_ATTEMPT,
    name: "IAT V2 independent security evidence",
    event: "pull_request",
    status: "completed",
    conclusion: "success",
    head_sha: SOURCE_HEAD,
    path: INDEPENDENT_SECURITY_WORKFLOW_PATH,
    workflow_id: workflowId,
    url: RUN_API_URL,
    html_url: RUN_WEB_URL,
    jobs_url: `${RUN_API_URL}/jobs`,
    artifacts_url: `${RUN_API_URL}/artifacts`,
    workflow_url: `${apiBase}/actions/workflows/${workflowId}`,
    repository: {
      id: INDEPENDENT_SECURITY_REPOSITORY_ID,
      full_name: INDEPENDENT_SECURITY_REPOSITORY,
      url: apiBase,
      html_url: `${WEB_ORIGIN}/${INDEPENDENT_SECURITY_REPOSITORY}`,
    },
    head_repository: {
      id: INDEPENDENT_SECURITY_REPOSITORY_ID,
      full_name: INDEPENDENT_SECURITY_REPOSITORY,
      url: apiBase,
      html_url: `${WEB_ORIGIN}/${INDEPENDENT_SECURITY_REPOSITORY}`,
    },
    head_commit: {
      id: SOURCE_HEAD,
      tree_id: SOURCE_TREE,
    },
    created_at: "2026-08-26T19:59:50Z",
    updated_at: "2026-08-26T20:04:35Z",
  };
  const jobs = {
    total_count: 1,
    jobs: [{
      id: JOB_ID,
      run_id: RUN_ID,
      run_attempt: RUN_ATTEMPT,
      head_sha: SOURCE_HEAD,
      name: INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
      status: "completed",
      conclusion: "success",
      url: `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}/actions/jobs/${JOB_ID}`,
      html_url: JOB_WEB_URL,
      labels: ["ubuntu-24.04"],
      started_at: "2026-08-26T20:00:00Z",
      completed_at: "2026-08-26T20:04:30Z",
      steps: INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS.map((name, index) => ({
        name,
        number: index + 1,
        status: "completed",
        conclusion: "success",
      })),
    }],
  };
  const artifacts = {
    total_count: 1,
    artifacts: [{
      id: ARTIFACT_ID,
      name: INDEPENDENT_SECURITY_ARTIFACT_NAME,
      size_in_bytes: archive.length,
      expired: false,
      digest: `sha256:${sha256(archive)}`,
      url: ARTIFACT_API_URL,
      archive_download_url: ARCHIVE_API_URL,
      workflow_run: {
        id: RUN_ID,
        head_sha: SOURCE_HEAD,
        repository_id: INDEPENDENT_SECURITY_REPOSITORY_ID,
        head_repository_id: INDEPENDENT_SECURITY_REPOSITORY_ID,
      },
      created_at: "2026-08-26T20:04:31Z",
      expires_at: "2026-09-25T20:04:31Z",
    }],
  };
  const providerDates = [0, 1, 2, 3, 4].map((offset) => new Date(
    Date.parse("2026-08-26T20:05:00Z") + offset * 1_000,
  ).toUTCString());
  const githubHeaders = providerDates.map((date, index) => ({
    date,
    "x-github-request-id": `FIXTURE-REQUEST-${index + 1}`,
  }));
  const state = {
    run,
    finalRun: structuredClone(run),
    jobs,
    artifacts,
    githubHeaders,
    responseOverrides: {
      run: {},
      finalRun: {},
      jobs: {},
      artifacts: {},
      archiveRedirect: {},
      archive: {},
    },
    redirectLocation: "https://productionresultssa7.blob.core.windows.net/actions-results/fixture/run/artifact.zip?se=2026-08-26T20%3A10%3A00Z&sp=r&spr=https&sv=2025-01-05&sig=fixture-signature",
    deliveredArchive: archive,
  };
  mutate(state);
  const calls = [];
  let runRequestCount = 0;
  const mockFetch = async (urlValue, options) => {
    const url = String(urlValue);
    calls.push({ url, options });
    if (url === RUN_API_URL) {
      const finalSnapshot = runRequestCount % 2 === 1;
      runRequestCount += 1;
      return jsonResponse(
        url,
        finalSnapshot ? state.finalRun : state.run,
        state.githubHeaders[finalSnapshot ? 4 : 0],
        state.responseOverrides[finalSnapshot ? "finalRun" : "run"],
      );
    }
    if (url === JOBS_API_URL) {
      return jsonResponse(url, state.jobs, state.githubHeaders[1], state.responseOverrides.jobs);
    }
    if (url === ARTIFACTS_API_URL) {
      return jsonResponse(
        url,
        state.artifacts,
        state.githubHeaders[2],
        state.responseOverrides.artifacts,
      );
    }
    if (url === ARCHIVE_API_URL) {
      return response({
        url: state.responseOverrides.archiveRedirect.url ?? url,
        status: state.responseOverrides.archiveRedirect.status ?? 302,
        redirected: state.responseOverrides.archiveRedirect.redirected ?? false,
        headers: {
          ...state.githubHeaders[3],
          location: state.redirectLocation,
          ...state.responseOverrides.archiveRedirect.headers,
        },
      });
    }
    if (url === state.redirectLocation) {
      return response({
        url: state.responseOverrides.archive.url ?? url,
        status: state.responseOverrides.archive.status ?? 200,
        redirected: state.responseOverrides.archive.redirected ?? false,
        headers: {
          "content-type": "application/zip",
          "content-length": String(state.deliveredArchive.length),
          ...state.responseOverrides.archive.headers,
        },
        body: state.deliveredArchive,
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };
  return {
    mockFetch,
    calls,
    state,
    expectedBinding: {
      runId: RUN_ID,
      runAttempt: RUN_ATTEMPT,
      sourceHeadSha: SOURCE_HEAD,
      sourceTree: SOURCE_TREE,
      programArtifactSha256: PROGRAM_ARTIFACT,
      archiveSha256: sha256(archive),
      evidenceSha256: sha256(evidenceBytes),
    },
  };
}

async function withAuthenticator(mockFetch, callback, options = {}) {
  const priorFetch = globalThis.fetch;
  const priorToken = process.env.IAT_V2_GITHUB_READ_TOKEN;
  const priorHrtimeBigint = process.hrtime.bigint;
  globalThis.fetch = mockFetch;
  process.env.IAT_V2_GITHUB_READ_TOKEN = TOKEN;
  if (options.monotonicNowNanoseconds !== undefined) {
    process.hrtime.bigint = options.monotonicNowNanoseconds;
  }
  const url = new URL(MODULE_URL);
  url.searchParams.set("fixture", String(moduleCounter));
  moduleCounter += 1;
  try {
    const authenticator = await import(url.href);
    return await callback(authenticator);
  } finally {
    globalThis.fetch = priorFetch;
    process.hrtime.bigint = priorHrtimeBigint;
    if (priorToken === undefined) delete process.env.IAT_V2_GITHUB_READ_TOKEN;
    else process.env.IAT_V2_GITHUB_READ_TOKEN = priorToken;
  }
}

test("GitHub hosted-state authentication is direct, opaque, one-use, and fail-closed", async (t) => {
  await t.test("default, live:false, and caller-supplied receipt paths HOLD without requests", async () => {
    const calls = [];
    await withAuthenticator(async (...args) => {
      calls.push(args);
      throw new Error("network must remain unused");
    }, async ({
      authenticateGitHubHostedState,
      consumeGitHubHostedStateAuthenticationCapability,
      isGitHubHostedStateAuthenticationCapability,
    }) => {
      const baseline = await authenticateGitHubHostedState();
      assert.equal(baseline.status, "LIVE_AUTH_REQUIRED_HOLD");
      assert.equal(baseline.authenticated, false);
      assert.equal(baseline.mainnetStatus, "HOLD");
      assert.equal(isGitHubHostedStateAuthenticationCapability(baseline), false);
      assert.equal(consumeGitHubHostedStateAuthenticationCapability(baseline, {}), null);

      const disabled = await authenticateGitHubHostedState({
        live: false,
        githubRunBytes: Buffer.from("forged"),
        artifactArchiveBytes: Buffer.from("forged"),
        evaluationUnixSeconds: "9999999999",
      });
      assert.equal(disabled.status, "LIVE_AUTH_REQUIRED_HOLD");

      const injected = await authenticateGitHubHostedState({
        ...input(),
        fetch: async () => { throw new Error("caller transport"); },
        token: "caller-token",
        githubRunBytes: Buffer.from("forged"),
        artifactArchiveBytes: Buffer.from("forged"),
        evaluationUnixSeconds: "9999999999",
      });
      assert.equal(injected.status, "LIVE_AUTH_REQUIRED_HOLD");
      assert.deepEqual(injected.violations, ["CALLER_INPUT_CONTRACT_REJECTED"]);

      const symbolInput = input();
      symbolInput[Symbol("hidden caller state")] = "forged";
      assert.equal((await authenticateGitHubHostedState(symbolInput)).status, "LIVE_AUTH_REQUIRED_HOLD");
      const proxyInput = new Proxy(input(), {});
      assert.equal((await authenticateGitHubHostedState(proxyInput)).status, "LIVE_AUTH_REQUIRED_HOLD");
      const revokedInput = Proxy.revocable(input(), {});
      revokedInput.revoke();
      assert.equal(
        (await authenticateGitHubHostedState(revokedInput.proxy)).status,
        "LIVE_AUTH_REQUIRED_HOLD",
      );
      assert.equal(calls.length, 0);
    });
  });

  await t.test("exact HTTPS state yields only a branded token and atomic bound consumption", async () => {
    const fixture = buildFixture();
    await withAuthenticator(fixture.mockFetch, async ({
      authenticateGitHubHostedState,
      consumeGitHubHostedStateAuthenticationCapability,
      isGitHubHostedStateAuthenticationCapability,
    }) => {
      const capability = await authenticateGitHubHostedState(input());
      assert.equal(isGitHubHostedStateAuthenticationCapability(capability), true);
      assert.equal(Object.isFrozen(capability), true);
      assert.deepEqual(Object.keys(capability), []);
      assert.equal(isGitHubHostedStateAuthenticationCapability({}), false);
      assert.equal(isGitHubHostedStateAuthenticationCapability({ ...capability }), false);
      assert.equal(isGitHubHostedStateAuthenticationCapability(JSON.parse(JSON.stringify(capability))), false);
      assert.equal(isGitHubHostedStateAuthenticationCapability(structuredClone(capability)), false);

      const claims = consumeGitHubHostedStateAuthenticationCapability(
        capability,
        fixture.expectedBinding,
      );
      assert.equal(Object.isFrozen(claims), true);
      assert.equal(claims.status, "LIVE_GITHUB_HOSTED_STATE_AUTHENTICATED_HOLD");
      assert.equal(claims.authenticated, true);
      assert.equal(claims.clearanceValid, false);
      assert.equal(claims.authorizesMainnet, false);
      assert.equal(claims.mainnetStatus, "HOLD");
      assert.equal(claims.runId, RUN_ID);
      assert.equal(claims.runAttempt, RUN_ATTEMPT);
      assert.equal(claims.jobId, JOB_ID);
      assert.equal(claims.artifactId, ARTIFACT_ID);
      assert.equal(claims.archiveSha256, fixture.expectedBinding.archiveSha256);
      assert.equal(claims.evidenceSha256, fixture.expectedBinding.evidenceSha256);
      assert.equal(isGitHubHostedStateAuthenticationCapability(capability), false);
      assert.equal(
        consumeGitHubHostedStateAuthenticationCapability(capability, fixture.expectedBinding),
        null,
      );

      const burned = await authenticateGitHubHostedState(input());
      assert.equal(isGitHubHostedStateAuthenticationCapability(burned), true);
      assert.equal(consumeGitHubHostedStateAuthenticationCapability(burned, {
        ...fixture.expectedBinding,
        evidenceSha256: "e".repeat(64),
      }), null);
      assert.equal(isGitHubHostedStateAuthenticationCapability(burned), false);
      assert.equal(consumeGitHubHostedStateAuthenticationCapability(burned, fixture.expectedBinding), null);
    });

    assert.equal(fixture.calls.length, 12);
    const expectedRequestSequence = [
      RUN_API_URL,
      JOBS_API_URL,
      ARTIFACTS_API_URL,
      ARCHIVE_API_URL,
      fixture.state.redirectLocation,
      RUN_API_URL,
    ];
    assert.deepEqual(fixture.calls.slice(0, 6).map(({ url }) => url), expectedRequestSequence);
    assert.deepEqual(fixture.calls.slice(6).map(({ url }) => url), expectedRequestSequence);
    for (const call of fixture.calls.filter(({ url }) => url.startsWith(API_ORIGIN))) {
      assert.equal(call.options.method, "GET");
      assert.equal(call.options.redirect, "manual");
      assert.equal(call.options.cache, "no-store");
      assert.equal(call.options.credentials, "omit");
      assert.equal(call.options.headers.authorization, `Bearer ${TOKEN}`);
      assert.equal(call.options.headers["x-github-api-version"], "2022-11-28");
    }
    for (const call of fixture.calls.filter(({ url }) => url.includes("blob.core.windows.net"))) {
      assert.equal(call.options.redirect, "error");
      assert.equal(Object.hasOwn(call.options.headers, "authorization"), false);
    }
  });

  await t.test("first consumption has a short monotonic lifetime and always burns", async () => {
    const fixture = buildFixture();
    let monotonicNowNanoseconds = 1_000_000_000n;
    let monotonicFailure = null;
    await withAuthenticator(fixture.mockFetch, async ({
      authenticateGitHubHostedState,
      consumeGitHubHostedStateAuthenticationCapability,
      isGitHubHostedStateAuthenticationCapability,
    }) => {
      const expired = await authenticateGitHubHostedState(input());
      monotonicNowNanoseconds += 30_000_000_000n;
      assert.equal(
        consumeGitHubHostedStateAuthenticationCapability(expired, fixture.expectedBinding),
        null,
      );
      assert.equal(isGitHubHostedStateAuthenticationCapability(expired), false);
      assert.equal(
        consumeGitHubHostedStateAuthenticationCapability(expired, fixture.expectedBinding),
        null,
      );

      const boundary = await authenticateGitHubHostedState(input());
      monotonicNowNanoseconds += 29_999_999_999n;
      assert.equal(
        consumeGitHubHostedStateAuthenticationCapability(boundary, fixture.expectedBinding)?.authenticated,
        true,
      );

      const rollback = await authenticateGitHubHostedState(input());
      monotonicNowNanoseconds -= 1n;
      assert.equal(
        consumeGitHubHostedStateAuthenticationCapability(rollback, fixture.expectedBinding),
        null,
      );
      assert.equal(isGitHubHostedStateAuthenticationCapability(rollback), false);

      monotonicNowNanoseconds += 1n;
      const throwing = await authenticateGitHubHostedState(input());
      monotonicFailure = "throw";
      assert.equal(
        consumeGitHubHostedStateAuthenticationCapability(throwing, fixture.expectedBinding),
        null,
      );
      assert.equal(isGitHubHostedStateAuthenticationCapability(throwing), false);

      monotonicFailure = null;
      const wrongType = await authenticateGitHubHostedState(input());
      monotonicFailure = "wrong-type";
      assert.equal(
        consumeGitHubHostedStateAuthenticationCapability(wrongType, fixture.expectedBinding),
        null,
      );
      assert.equal(isGitHubHostedStateAuthenticationCapability(wrongType), false);
    }, {
      monotonicNowNanoseconds: () => {
        if (monotonicFailure === "throw") throw new Error("fixture monotonic clock failure");
        if (monotonicFailure === "wrong-type") return 1;
        return monotonicNowNanoseconds;
      },
    });
    assert.equal(fixture.calls.length, 30);
  });

  await t.test("caller mutation after invocation cannot change the synchronous bound snapshot", async () => {
    const fixture = buildFixture();
    await withAuthenticator(fixture.mockFetch, async ({
      authenticateGitHubHostedState,
      consumeGitHubHostedStateAuthenticationCapability,
      isGitHubHostedStateAuthenticationCapability,
    }) => {
      const mutableInput = input();
      const pending = authenticateGitHubHostedState(mutableInput);
      mutableInput.runId += 1;
      mutableInput.runAttempt += 1;
      mutableInput.sourceHeadSha = "e".repeat(40);
      mutableInput.sourceTree = "e".repeat(40);
      mutableInput.programArtifactSha256 = "e".repeat(64);
      const capability = await pending;
      assert.equal(isGitHubHostedStateAuthenticationCapability(capability), true);
      const claims = consumeGitHubHostedStateAuthenticationCapability(
        capability,
        fixture.expectedBinding,
      );
      assert.equal(claims.runId, RUN_ID);
      assert.equal(claims.sourceHeadSha, SOURCE_HEAD);
      assert.equal(claims.sourceTree, SOURCE_TREE);
      assert.equal(claims.programArtifactSha256, PROGRAM_ARTIFACT);
    });
  });

  const adversarialCases = [
    {
      name: "redirected GitHub JSON response",
      mutate: ({ responseOverrides }) => { responseOverrides.run.redirected = true; },
    },
    {
      name: "GitHub response host substitution",
      mutate: ({ responseOverrides }) => {
        responseOverrides.run.url = "https://api.github.invalid/repos/InternalAgencyIO/InternalAgency/actions/runs/33000000001";
      },
    },
    {
      name: "missing authenticated provider Date",
      mutate: ({ responseOverrides }) => { responseOverrides.run.headers = { date: "" }; },
    },
    {
      name: "replayed provider time after evidence expiry",
      mutate: ({ githubHeaders }) => {
        for (let index = 0; index < githubHeaders.length; index += 1) {
          githubHeaders[index].date = new Date(
            Date.parse("2026-08-26T20:20:00Z") + index * 1_000,
          ).toUTCString();
        }
      },
    },
    {
      name: "provider Date spread",
      mutate: ({ githubHeaders }) => {
        githubHeaders[4].date = new Date("2026-08-26T20:07:00Z").toUTCString();
      },
    },
    {
      name: "duplicate GitHub request identity",
      mutate: ({ githubHeaders }) => {
        githubHeaders[4]["x-github-request-id"] = githubHeaders[0]["x-github-request-id"];
      },
    },
    {
      name: "rerun transition after artifact acquisition",
      mutate: ({ finalRun }) => {
        finalRun.run_attempt = RUN_ATTEMPT + 1;
        finalRun.status = "queued";
        finalRun.conclusion = null;
        finalRun.updated_at = "2026-08-26T20:05:03Z";
      },
    },
    {
      name: "run updated_at drift after artifact acquisition",
      mutate: ({ finalRun }) => {
        finalRun.updated_at = "2026-08-26T20:04:36Z";
      },
    },
    {
      name: "run head substitution",
      mutate: ({ run }) => { run.head_sha = "e".repeat(40); },
    },
    {
      name: "job head substitution",
      mutate: ({ jobs }) => { jobs.jobs[0].head_sha = "e".repeat(40); },
    },
    {
      name: "artifact source substitution",
      mutate: ({ artifacts }) => { artifacts.artifacts[0].workflow_run.head_sha = "e".repeat(40); },
    },
    {
      name: "artifact digest substitution",
      mutate: ({ artifacts }) => { artifacts.artifacts[0].digest = `sha256:${"e".repeat(64)}`; },
    },
    {
      name: "archive byte substitution",
      mutate: (state) => {
        state.deliveredArchive = Buffer.concat([state.deliveredArchive, Buffer.from([0])]);
      },
    },
    {
      name: "archive redirect host substitution",
      mutate: (state) => {
        state.redirectLocation = "https://attacker.invalid/actions-results/fixture/archive.zip?se=2026-08-26T20%3A10%3A00Z&sp=r&spr=https&sv=2025-01-05&sig=fixture";
      },
    },
    {
      name: "archive redirect permission substitution",
      mutate: (state) => {
        state.redirectLocation = "https://productionresultssa7.blob.core.windows.net/actions-results/fixture/archive.zip?se=2026-08-26T20%3A10%3A00Z&sp=rw&spr=https&sv=2025-01-05&sig=fixture";
      },
    },
  ];

  for (const adversarial of adversarialCases) {
    await t.test(`rejects ${adversarial.name}`, async () => {
      const fixture = buildFixture({ mutate: adversarial.mutate });
      await withAuthenticator(fixture.mockFetch, async ({
        authenticateGitHubHostedState,
        isGitHubHostedStateAuthenticationCapability,
      }) => {
        const result = await authenticateGitHubHostedState(input());
        assert.equal(result.status, "LIVE_AUTH_REQUIRED_HOLD");
        assert.equal(result.authenticated, false);
        assert.equal(result.mainnetStatus, "HOLD");
        assert.equal(isGitHubHostedStateAuthenticationCapability(result), false);
      });
    });
  }

  const manifestSubstitutions = [
    ["manifest source commit", (value) => { value.sourceBinding.commit = "e".repeat(40); }],
    ["manifest source tree", (value) => { value.sourceBinding.tree = "e".repeat(40); }],
    ["manifest program digest", (value) => {
      value.sourceBinding.programArtifactSha256 = "e".repeat(64);
    }],
    ["manifest CI source", (value) => { value.ciProvenance.sourceHeadSha = "e".repeat(40); }],
    ["manifest run identity", (value) => { value.ciProvenance.runId += 1; }],
  ];
  for (const [name, mutateManifest] of manifestSubstitutions) {
    await t.test(`rejects ${name} substitution even with matching archive metadata`, async () => {
      const fixture = buildFixture({ mutateManifest });
      await withAuthenticator(fixture.mockFetch, async ({
        authenticateGitHubHostedState,
        isGitHubHostedStateAuthenticationCapability,
      }) => {
        const result = await authenticateGitHubHostedState(input());
        assert.equal(result.status, "LIVE_AUTH_REQUIRED_HOLD");
        assert.equal(isGitHubHostedStateAuthenticationCapability(result), false);
      });
    });
  }
});

import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import { canonicalizeRfc8785 } from "../iat-v2-canonical-json.mjs";
import { parseB3OwnerPolicyFreezeJson } from "../validate-iat-b3-owner-policy-freeze.mjs";
import {
  INDEPENDENT_SECURITY_ARTIFACT_ENTRIES,
  INDEPENDENT_SECURITY_ARTIFACT_NAME,
  INDEPENDENT_SECURITY_EVIDENCE_SCHEMA,
  INDEPENDENT_SECURITY_EVIDENCE_STATUS,
  INDEPENDENT_SECURITY_FRESHNESS_SECONDS,
  INDEPENDENT_SECURITY_MAINNET_STATUS,
  INDEPENDENT_SECURITY_MANIFEST_PATH,
  INDEPENDENT_SECURITY_PREDICATE,
  INDEPENDENT_SECURITY_REPOSITORY,
  INDEPENDENT_SECURITY_REPOSITORY_ID,
  INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
  INDEPENDENT_SECURITY_WORKFLOW_PATH,
  readIndependentSecurityArtifactArchive,
} from "./iat-v2-independent-security-evidence.mjs";

const DIRECT_FETCH = typeof globalThis.fetch === "function"
  ? globalThis.fetch.bind(globalThis)
  : null;

const API_ORIGIN = "https://api.github.com";
const WEB_ORIGIN = "https://github.com";
const WORKFLOW_NAME = "IAT V2 independent security evidence";
const API_VERSION = "2022-11-28";
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_PROVIDER_TIME_SPREAD_SECONDS = 60n;
const MAX_FUTURE_SKEW_SECONDS = 30n;
const REQUEST_TIMEOUT_MILLISECONDS = 30_000;
const CAPABILITY_MAX_MONOTONIC_AGE_NANOSECONDS = 30_000_000_000n;
const HEX_40 = /^[0-9a-f]{40}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;
const REQUEST_ID = /^[!-~]{8,128}$/u;
const ACTIONS_BLOB_HOST = /^productionresultssa[0-9]+\.blob\.core\.windows\.net$/u;
const WORKFLOW_REF =
  /^InternalAgencyIO\/InternalAgency\/\.github\/workflows\/iat-v2-independent-security-evidence\.yml@refs\/(?:heads\/.+|pull\/[1-9][0-9]*\/merge)$/u;

const AUTHENTICATE_KEYS = Object.freeze([
  "live",
  "runId",
  "runAttempt",
  "sourceHeadSha",
  "sourceTree",
  "programArtifactSha256",
]);
const CONSUME_KEYS = Object.freeze([
  "runId",
  "runAttempt",
  "sourceHeadSha",
  "sourceTree",
  "programArtifactSha256",
  "archiveSha256",
  "evidenceSha256",
]);
const MANIFEST_KEYS = Object.freeze([
  "schema",
  "status",
  "predicate",
  "sourceBinding",
  "ciProvenance",
  "inputBindings",
  "toolchain",
  "checks",
  "findingSummary",
  "artifactContract",
  "observedAtUtc",
  "expiresAtUtc",
  "safety",
  "limitations",
  "mainnetStatus",
]);
const SOURCE_BINDING_KEYS = Object.freeze(["commit", "tree", "programArtifactSha256"]);
const CI_PROVENANCE_KEYS = Object.freeze([
  "serverUrl",
  "repository",
  "repositoryId",
  "workflowRef",
  "workflowPath",
  "workflowSha256",
  "runId",
  "runAttempt",
  "eventName",
  "sourceHeadSha",
  "checkoutSha",
  "checkoutRelation",
  "jobKey",
  "jobName",
  "runnerOs",
  "runnerArch",
  "artifactName",
]);
const ARTIFACT_CONTRACT_KEYS = Object.freeze(["name", "manifestPath", "entries"]);
const ALLOWED_EVENTS = Object.freeze(["pull_request", "push", "workflow_dispatch"]);

const capabilityClaims = new WeakMap();
const monotonicNowNanoseconds = process.hrtime.bigint.bind(process.hrtime);

class HostedStateAuthenticationFailure extends Error {
  constructor(code) {
    super(code);
    this.name = "HostedStateAuthenticationFailure";
    this.code = code;
  }
}

function fail(code) {
  throw new HostedStateAuthenticationFailure(code);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !isProxy(value)
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function snapshotDataRecord(value, expectedKeys) {
  if (!isPlainObject(value)) return null;
  const actualKeys = Reflect.ownKeys(value);
  const expected = [...expectedKeys].sort();
  if (actualKeys.some((key) => typeof key !== "string")) return null;
  actualKeys.sort();
  if (actualKeys.length !== expected.length
    || actualKeys.some((key, index) => key !== expected[index])) {
    return null;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!expectedKeys.every((key) => Object.hasOwn(descriptors[key], "value")
    && descriptors[key].enumerable === true)) {
    return null;
  }
  return Object.freeze(Object.fromEntries(
    expectedKeys.map((key) => [key, descriptors[key].value]),
  ));
}

function exactDataRecord(value, expectedKeys) {
  return snapshotDataRecord(value, expectedKeys) !== null;
}

function exactJson(left, right) {
  return canonicalizeRfc8785(left) === canonicalizeRfc8785(right);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function hold(violation) {
  return Object.freeze({
    status: "LIVE_AUTH_REQUIRED_HOLD",
    authenticated: false,
    clearanceValid: false,
    authorizesMainnet: false,
    mainnetStatus: "HOLD",
    blocker: "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED",
    violations: Object.freeze([violation]),
  });
}

function authenticationInputSnapshot(value) {
  const snapshot = snapshotDataRecord(value, AUTHENTICATE_KEYS);
  if (snapshot === null
    || snapshot.live !== true
    || !positiveInteger(snapshot.runId)
    || !positiveInteger(snapshot.runAttempt)
    || !HEX_40.test(snapshot.sourceHeadSha)
    || !HEX_40.test(snapshot.sourceTree)
    || !HEX_64.test(snapshot.programArtifactSha256)
    || /^0{64}$/u.test(snapshot.programArtifactSha256)) {
    return null;
  }
  return snapshot;
}

function consumeBindingSnapshot(value) {
  const snapshot = snapshotDataRecord(value, CONSUME_KEYS);
  if (snapshot === null || !positiveInteger(snapshot.runId)
    || !positiveInteger(snapshot.runAttempt)
    || !HEX_40.test(snapshot.sourceHeadSha)
    || !HEX_40.test(snapshot.sourceTree)
    || !HEX_64.test(snapshot.programArtifactSha256)
    || /^0{64}$/u.test(snapshot.programArtifactSha256)
    || !HEX_64.test(snapshot.archiveSha256)
    || !HEX_64.test(snapshot.evidenceSha256)) {
    return null;
  }
  return snapshot;
}

function configuredToken() {
  const token = process.env.IAT_V2_GITHUB_READ_TOKEN ?? process.env.GITHUB_TOKEN;
  if (typeof token !== "string" || token.length < 20 || token.length > 512
    || !/^[\x21-\x7e]+$/u.test(token)) {
    fail("GITHUB_READ_TOKEN_UNAVAILABLE");
  }
  return token;
}

function strictUrl(value, expectedOrigin) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("HTTPS_RESPONSE_URL_INVALID");
  }
  if (url.origin !== expectedOrigin || url.protocol !== "https:" || url.username !== ""
    || url.password !== "" || url.port !== "" || url.hash !== "") {
    fail("HTTPS_RESPONSE_ORIGIN_MISMATCH");
  }
  return url;
}

function responseHeader(response, name) {
  const value = response?.headers?.get?.(name);
  return typeof value === "string" ? value : null;
}

function githubProviderObservation(response) {
  const dateValue = responseHeader(response, "date");
  const requestId = responseHeader(response, "x-github-request-id");
  if (dateValue === null || new Date(dateValue).toUTCString() !== dateValue) {
    fail("GITHUB_PROVIDER_DATE_INVALID");
  }
  if (requestId === null || !REQUEST_ID.test(requestId)) {
    fail("GITHUB_REQUEST_ID_INVALID");
  }
  return Object.freeze({
    unixSeconds: BigInt(Date.parse(dateValue) / 1_000),
    requestId,
  });
}

function verifyApiResponse(response, expectedUrl, expectedStatus = 200) {
  if (response === null || typeof response !== "object" || response.status !== expectedStatus
    || response.redirected !== false || response.url !== expectedUrl) {
    fail("GITHUB_API_RESPONSE_BINDING_MISMATCH");
  }
  strictUrl(response.url, API_ORIGIN);
  return githubProviderObservation(response);
}

async function responseBytes(response, maximum, label) {
  const contentLength = responseHeader(response, "content-length");
  if (contentLength !== null
    && (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength) || BigInt(contentLength) > BigInt(maximum))) {
    fail(`${label}_CONTENT_LENGTH_INVALID`);
  }
  if (response?.body !== null && response?.body !== undefined
    && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) fail(`${label}_BODY_INVALID`);
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel().catch(() => {});
        fail(`${label}_BODY_TOO_LARGE`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, length);
  }
  if (typeof response?.arrayBuffer !== "function") fail(`${label}_BODY_INVALID`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maximum) fail(`${label}_BODY_TOO_LARGE`);
  return bytes;
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label}_UTF8_INVALID`);
  }
}

function parseJsonBytes(bytes, label) {
  let parsed;
  try {
    parsed = parseB3OwnerPolicyFreezeJson(decodeUtf8(bytes, label), label);
  } catch {
    fail(`${label}_JSON_INVALID`);
  }
  return parsed;
}

async function directFetch(url, token, { redirect = "manual", githubAuthorization = true } = {}) {
  if (DIRECT_FETCH === null) fail("DIRECT_HTTPS_TRANSPORT_UNAVAILABLE");
  const headers = {
    accept: githubAuthorization ? "application/vnd.github+json" : "application/zip",
    "user-agent": "iat-v2-github-hosted-state-authenticator",
  };
  if (githubAuthorization) {
    headers.authorization = `Bearer ${token}`;
    headers["x-github-api-version"] = API_VERSION;
  }
  return DIRECT_FETCH(url, {
    method: "GET",
    headers,
    redirect,
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  });
}

async function acquireGithubJson(url, token, observations) {
  let response;
  try {
    response = await directFetch(url, token);
  } catch {
    fail("GITHUB_API_HTTPS_ACQUISITION_FAILED");
  }
  observations.push(verifyApiResponse(response, url));
  const contentType = responseHeader(response, "content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    fail("GITHUB_API_CONTENT_TYPE_INVALID");
  }
  return parseJsonBytes(await responseBytes(response, MAX_JSON_BYTES, "GITHUB_API"), "GITHUB_API");
}

function canonicalUtc(value, code) {
  if (typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) {
    fail(code);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)
    || new Date(milliseconds).toISOString().replace(".000Z", "Z") !== value) {
    fail(code);
  }
  return BigInt(milliseconds / 1_000);
}

function validateRun(run, input) {
  const apiBase = `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}`;
  const apiUrl = `${apiBase}/actions/runs/${input.runId}`;
  const webUrl = `${WEB_ORIGIN}/${INDEPENDENT_SECURITY_REPOSITORY}/actions/runs/${input.runId}`;
  if (!isPlainObject(run) || run.id !== input.runId || run.run_attempt !== input.runAttempt
    || run.name !== WORKFLOW_NAME || !ALLOWED_EVENTS.includes(run.event)
    || run.status !== "completed" || run.conclusion !== "success"
    || run.head_sha !== input.sourceHeadSha || run.path !== INDEPENDENT_SECURITY_WORKFLOW_PATH
    || !positiveInteger(run.workflow_id)
    || run.url !== apiUrl || run.html_url !== webUrl
    || run.jobs_url !== `${apiUrl}/jobs` || run.artifacts_url !== `${apiUrl}/artifacts`
    || run.workflow_url !== `${apiBase}/actions/workflows/${run.workflow_id}`
    || run.repository?.id !== INDEPENDENT_SECURITY_REPOSITORY_ID
    || run.repository?.full_name !== INDEPENDENT_SECURITY_REPOSITORY
    || run.repository?.url !== apiBase
    || run.repository?.html_url !== `${WEB_ORIGIN}/${INDEPENDENT_SECURITY_REPOSITORY}`
    || run.head_repository?.id !== INDEPENDENT_SECURITY_REPOSITORY_ID
    || run.head_repository?.full_name !== INDEPENDENT_SECURITY_REPOSITORY
    || run.head_repository?.url !== apiBase
    || run.head_repository?.html_url !== `${WEB_ORIGIN}/${INDEPENDENT_SECURITY_REPOSITORY}`
    || run.head_commit?.id !== input.sourceHeadSha
    || run.head_commit?.tree_id !== input.sourceTree) {
    fail("GITHUB_RUN_METADATA_MISMATCH");
  }
  return Object.freeze({
    eventName: run.event,
    workflowId: run.workflow_id,
    created: canonicalUtc(run.created_at, "GITHUB_RUN_CREATED_AT_INVALID"),
    updated: canonicalUtc(run.updated_at, "GITHUB_RUN_UPDATED_AT_INVALID"),
    apiUrl,
    webUrl,
  });
}

function validateStableRunSnapshots(initial, final) {
  if (initial.eventName !== final.eventName || initial.workflowId !== final.workflowId
    || initial.created !== final.created || initial.updated !== final.updated
    || initial.apiUrl !== final.apiUrl || initial.webUrl !== final.webUrl) {
    fail("GITHUB_RUN_CHANGED_DURING_ACQUISITION");
  }
}

function validateJobs(receipt, input) {
  if (!isPlainObject(receipt) || receipt.total_count !== 1
    || !Array.isArray(receipt.jobs) || receipt.jobs.length !== 1) {
    fail("GITHUB_JOB_INVENTORY_MISMATCH");
  }
  const job = receipt.jobs[0];
  const apiUrl = `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}/actions/jobs/${job?.id}`;
  const webUrl = `${WEB_ORIGIN}/${INDEPENDENT_SECURITY_REPOSITORY}/actions/runs/${input.runId}/job/${job?.id}`;
  const steps = Array.isArray(job?.steps) ? job.steps : [];
  const requiredStepsValid = INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS.every((name) => {
    const matches = steps.filter((step) => step?.name === name);
    return matches.length === 1 && matches[0].status === "completed"
      && matches[0].conclusion === "success";
  });
  const allObservedStepsPassed = steps.length >= INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS.length
    && steps.every((step) => isPlainObject(step) && typeof step.name === "string"
      && step.status === "completed" && step.conclusion === "success");
  if (!isPlainObject(job) || !positiveInteger(job.id) || job.run_id !== input.runId
    || job.run_attempt !== input.runAttempt || job.head_sha !== input.sourceHeadSha
    || job.name !== INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME
    || job.status !== "completed" || job.conclusion !== "success"
    || job.url !== apiUrl || job.html_url !== webUrl
    || !Array.isArray(job.labels) || !job.labels.includes("ubuntu-24.04")
    || !requiredStepsValid || !allObservedStepsPassed) {
    fail("GITHUB_JOB_METADATA_MISMATCH");
  }
  return Object.freeze({
    id: job.id,
    started: canonicalUtc(job.started_at, "GITHUB_JOB_STARTED_AT_INVALID"),
    completed: canonicalUtc(job.completed_at, "GITHUB_JOB_COMPLETED_AT_INVALID"),
    apiUrl,
    webUrl,
  });
}

function validateArtifactInventory(receipt, input) {
  if (!isPlainObject(receipt) || receipt.total_count !== 1
    || !Array.isArray(receipt.artifacts) || receipt.artifacts.length !== 1) {
    fail("GITHUB_ARTIFACT_INVENTORY_MISMATCH");
  }
  const artifact = receipt.artifacts[0];
  const apiUrl = `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}/actions/artifacts/${artifact?.id}`;
  const archiveApiUrl = `${apiUrl}/zip`;
  if (!isPlainObject(artifact) || !positiveInteger(artifact.id)
    || artifact.name !== INDEPENDENT_SECURITY_ARTIFACT_NAME || artifact.expired !== false
    || artifact.url !== apiUrl || artifact.archive_download_url !== archiveApiUrl
    || artifact.workflow_run?.id !== input.runId
    || artifact.workflow_run?.head_sha !== input.sourceHeadSha
    || artifact.workflow_run?.repository_id !== INDEPENDENT_SECURITY_REPOSITORY_ID
    || artifact.workflow_run?.head_repository_id !== INDEPENDENT_SECURITY_REPOSITORY_ID
    || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0
    || !/^sha256:[0-9a-f]{64}$/u.test(artifact.digest ?? "")) {
    fail("GITHUB_ARTIFACT_METADATA_MISMATCH");
  }
  return Object.freeze({
    id: artifact.id,
    size: artifact.size_in_bytes,
    digest: artifact.digest,
    created: canonicalUtc(artifact.created_at, "GITHUB_ARTIFACT_CREATED_AT_INVALID"),
    expires: canonicalUtc(artifact.expires_at, "GITHUB_ARTIFACT_EXPIRES_AT_INVALID"),
    apiUrl,
    archiveApiUrl,
  });
}

function actionsBlobRedirect(value, redirectObservation) {
  const url = strictUrl(value, new URL(value).origin);
  if (!ACTIONS_BLOB_HOST.test(url.hostname) || !url.pathname.startsWith("/actions-results/")
    || /(?:^|\/)(?:\.{1,2})(?:\/|$)/u.test(url.pathname)
    || /%2f|%5c|\\/iu.test(url.pathname) || url.search === "") {
    fail("ARTIFACT_ARCHIVE_REDIRECT_NOT_ALLOWLISTED");
  }
  const keys = [...url.searchParams.keys()];
  if (new Set(keys).size !== keys.length || url.searchParams.get("sp") !== "r"
    || url.searchParams.get("spr") !== "https" || url.searchParams.get("sig") === null
    || url.searchParams.get("sv") === null || url.searchParams.get("se") === null) {
    fail("ARTIFACT_ARCHIVE_REDIRECT_QUERY_INVALID");
  }
  const expiry = Date.parse(url.searchParams.get("se"));
  if (!Number.isFinite(expiry) || BigInt(Math.floor(expiry / 1_000)) <= redirectObservation.unixSeconds) {
    fail("ARTIFACT_ARCHIVE_REDIRECT_EXPIRED");
  }
  return url;
}

async function acquireArtifactArchive(artifact, token, observations) {
  let redirectResponse;
  try {
    redirectResponse = await directFetch(artifact.archiveApiUrl, token);
  } catch {
    fail("ARTIFACT_ARCHIVE_REDIRECT_ACQUISITION_FAILED");
  }
  const observation = verifyApiResponse(redirectResponse, artifact.archiveApiUrl, 302);
  observations.push(observation);
  const location = responseHeader(redirectResponse, "location");
  if (location === null) fail("ARTIFACT_ARCHIVE_REDIRECT_MISSING");
  const redirectUrl = actionsBlobRedirect(location, observation);

  let archiveResponse;
  try {
    archiveResponse = await directFetch(redirectUrl.href, token, {
      redirect: "error",
      githubAuthorization: false,
    });
  } catch {
    fail("ARTIFACT_ARCHIVE_HTTPS_ACQUISITION_FAILED");
  }
  if (archiveResponse === null || typeof archiveResponse !== "object"
    || archiveResponse.status !== 200 || archiveResponse.redirected !== false
    || archiveResponse.url !== redirectUrl.href) {
    fail("ARTIFACT_ARCHIVE_RESPONSE_BINDING_MISMATCH");
  }
  strictUrl(archiveResponse.url, redirectUrl.origin);
  const contentType = responseHeader(archiveResponse, "content-type") ?? "";
  const contentEncoding = responseHeader(archiveResponse, "content-encoding");
  if (!/^(?:application\/zip|application\/octet-stream)(?:;|$)/iu.test(contentType)
    || (contentEncoding !== null && contentEncoding !== "identity")) {
    fail("ARTIFACT_ARCHIVE_CONTENT_TYPE_INVALID");
  }
  const bytes = await responseBytes(archiveResponse, MAX_ARCHIVE_BYTES, "ARTIFACT_ARCHIVE");
  if (bytes.byteLength !== artifact.size || `sha256:${sha256(bytes)}` !== artifact.digest) {
    fail("ARTIFACT_ARCHIVE_DIGEST_OR_SIZE_MISMATCH");
  }
  return bytes;
}

function providerTime(observations) {
  if (observations.length !== 5
    || new Set(observations.map(({ requestId }) => requestId)).size !== observations.length) {
    fail("GITHUB_PROVIDER_OBSERVATION_SET_INVALID");
  }
  const times = observations.map(({ unixSeconds }) => unixSeconds);
  const earliest = times.reduce((left, right) => left < right ? left : right);
  const latest = times.reduce((left, right) => left > right ? left : right);
  if (latest - earliest > MAX_PROVIDER_TIME_SPREAD_SECONDS) {
    fail("GITHUB_PROVIDER_DATE_SPREAD_INVALID");
  }
  return latest;
}

function validateCanonicalManifest(archiveBytes, input) {
  let archive;
  try {
    archive = readIndependentSecurityArtifactArchive(archiveBytes);
  } catch {
    fail("ARTIFACT_ARCHIVE_FORMAT_INVALID");
  }
  if (!exactJson([...archive.keys()].sort(), [...INDEPENDENT_SECURITY_ARTIFACT_ENTRIES].sort())) {
    fail("ARTIFACT_ARCHIVE_INVENTORY_MISMATCH");
  }
  const evidenceBytes = archive.get(INDEPENDENT_SECURITY_MANIFEST_PATH);
  if (!(evidenceBytes instanceof Uint8Array)) fail("EVIDENCE_MANIFEST_MISSING");
  const text = decodeUtf8(evidenceBytes, "EVIDENCE_MANIFEST");
  let evidence;
  try {
    evidence = parseB3OwnerPolicyFreezeJson(text, "independent security evidence");
  } catch {
    fail("EVIDENCE_MANIFEST_JSON_INVALID");
  }
  if (text !== `${canonicalizeRfc8785(evidence)}\n`
    || !exactDataRecord(evidence, MANIFEST_KEYS)
    || !exactDataRecord(evidence.sourceBinding, SOURCE_BINDING_KEYS)
    || !exactDataRecord(evidence.ciProvenance, CI_PROVENANCE_KEYS)
    || !exactDataRecord(evidence.artifactContract, ARTIFACT_CONTRACT_KEYS)) {
    fail("EVIDENCE_MANIFEST_CANONICAL_SHAPE_MISMATCH");
  }
  const source = evidence.sourceBinding;
  const ci = evidence.ciProvenance;
  if (evidence.schema !== INDEPENDENT_SECURITY_EVIDENCE_SCHEMA
    || evidence.status !== INDEPENDENT_SECURITY_EVIDENCE_STATUS
    || evidence.predicate !== INDEPENDENT_SECURITY_PREDICATE
    || evidence.mainnetStatus !== INDEPENDENT_SECURITY_MAINNET_STATUS
    || source.commit !== input.sourceHeadSha || source.tree !== input.sourceTree
    || source.programArtifactSha256 !== input.programArtifactSha256
    || ci.serverUrl !== WEB_ORIGIN || ci.repository !== INDEPENDENT_SECURITY_REPOSITORY
    || ci.repositoryId !== INDEPENDENT_SECURITY_REPOSITORY_ID
    || ci.workflowPath !== INDEPENDENT_SECURITY_WORKFLOW_PATH
    || !WORKFLOW_REF.test(ci.workflowRef ?? "") || !HEX_64.test(ci.workflowSha256 ?? "")
    || ci.runId !== input.runId || ci.runAttempt !== input.runAttempt
    || !ALLOWED_EVENTS.includes(ci.eventName)
    || ci.sourceHeadSha !== input.sourceHeadSha || ci.checkoutSha !== input.sourceHeadSha
    || ci.checkoutRelation !== "IDENTICAL" || ci.jobKey !== INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY
    || ci.jobName !== INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME || ci.runnerOs !== "Linux"
    || ci.runnerArch !== "X64" || ci.artifactName !== INDEPENDENT_SECURITY_ARTIFACT_NAME
    || evidence.artifactContract.name !== INDEPENDENT_SECURITY_ARTIFACT_NAME
    || evidence.artifactContract.manifestPath !== INDEPENDENT_SECURITY_MANIFEST_PATH
    || !exactJson(evidence.artifactContract.entries, INDEPENDENT_SECURITY_ARTIFACT_ENTRIES)) {
    fail("EVIDENCE_MANIFEST_BINDING_MISMATCH");
  }
  return Object.freeze({
    evidenceSha256: sha256(evidenceBytes),
    eventName: ci.eventName,
    observed: canonicalUtc(evidence.observedAtUtc, "EVIDENCE_OBSERVED_AT_INVALID"),
    expires: canonicalUtc(evidence.expiresAtUtc, "EVIDENCE_EXPIRES_AT_INVALID"),
  });
}

function validateTiming({ run, job, artifact, evidence, provider }) {
  if (run.created > job.started || job.started > job.completed
    || job.completed > run.updated + 60n
    || evidence.observed < job.started || evidence.observed > job.completed
    || evidence.expires - evidence.observed !== INDEPENDENT_SECURITY_FRESHNESS_SECONDS
    || artifact.created < evidence.observed || artifact.created > job.completed + 60n
    || artifact.expires <= artifact.created || artifact.expires <= provider
    || evidence.observed > provider + MAX_FUTURE_SKEW_SECONDS || provider >= evidence.expires
    || run.updated > provider + MAX_FUTURE_SKEW_SECONDS
    || job.completed > provider + MAX_FUTURE_SKEW_SECONDS
    || artifact.created > provider + MAX_FUTURE_SKEW_SECONDS) {
    fail("HOSTED_STATE_FRESHNESS_OR_TIMING_MISMATCH");
  }
}

function authenticationClaims({ input, run, job, artifact, archive, evidence, provider }) {
  return Object.freeze({
    status: "LIVE_GITHUB_HOSTED_STATE_AUTHENTICATED_HOLD",
    authenticated: true,
    hostedStateAuthenticated: true,
    clearanceValid: false,
    authorizesMainnet: false,
    mainnetStatus: "HOLD",
    repository: INDEPENDENT_SECURITY_REPOSITORY,
    repositoryId: INDEPENDENT_SECURITY_REPOSITORY_ID,
    workflowPath: INDEPENDENT_SECURITY_WORKFLOW_PATH,
    jobName: INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
    artifactName: INDEPENDENT_SECURITY_ARTIFACT_NAME,
    runId: input.runId,
    runAttempt: input.runAttempt,
    jobId: job.id,
    artifactId: artifact.id,
    sourceHeadSha: input.sourceHeadSha,
    sourceTree: input.sourceTree,
    programArtifactSha256: input.programArtifactSha256,
    archiveSha256: sha256(archive),
    evidenceSha256: evidence.evidenceSha256,
    providerTimeUtc: new Date(Number(provider * 1_000n)).toISOString().replace(".000Z", "Z"),
    runUrl: run.webUrl,
    jobUrl: job.webUrl,
    archiveApiUrl: artifact.archiveApiUrl,
  });
}

export async function authenticateGitHubHostedState(options = {}) {
  if (!isPlainObject(options)
    || Object.getOwnPropertyDescriptor(options, "live")?.value !== true) {
    return hold("LIVE_GITHUB_ACQUISITION_NOT_REQUESTED");
  }
  const input = authenticationInputSnapshot(options);
  if (input === null) {
    return hold("CALLER_INPUT_CONTRACT_REJECTED");
  }
  try {
    const token = configuredToken();
    const observations = [];
    const runApiUrl = `${API_ORIGIN}/repos/${INDEPENDENT_SECURITY_REPOSITORY}/actions/runs/${input.runId}`;
    const jobsApiUrl = `${runApiUrl}/attempts/${input.runAttempt}/jobs?per_page=100`;
    const artifactsApiUrl = `${runApiUrl}/artifacts?per_page=100`;
    const run = validateRun(await acquireGithubJson(runApiUrl, token, observations), input);
    const job = validateJobs(await acquireGithubJson(jobsApiUrl, token, observations), input);
    const artifact = validateArtifactInventory(
      await acquireGithubJson(artifactsApiUrl, token, observations),
      input,
    );
    const archive = await acquireArtifactArchive(artifact, token, observations);
    const finalRun = validateRun(
      await acquireGithubJson(runApiUrl, token, observations),
      input,
    );
    validateStableRunSnapshots(run, finalRun);
    const provider = providerTime(observations);
    const evidence = validateCanonicalManifest(archive, input);
    if (evidence.eventName !== run.eventName) fail("EVIDENCE_RUN_EVENT_MISMATCH");
    validateTiming({ run, job, artifact, evidence, provider });
    const claims = authenticationClaims({
      input,
      run,
      job,
      artifact,
      archive,
      evidence,
      provider,
    });
    const issuedAtMonotonicNanoseconds = monotonicNowNanoseconds();
    if (typeof issuedAtMonotonicNanoseconds !== "bigint"
      || issuedAtMonotonicNanoseconds < 0n) {
      fail("MONOTONIC_CLOCK_INVALID");
    }
    const capability = Object.freeze({});
    capabilityClaims.set(capability, Object.freeze({
      claims,
      issuedAtMonotonicNanoseconds,
    }));
    return capability;
  } catch (error) {
    return hold(error instanceof HostedStateAuthenticationFailure
      ? error.code
      : "LIVE_GITHUB_AUTHENTICATION_FAILED");
  }
}

export function isGitHubHostedStateAuthenticationCapability(value) {
  return (typeof value === "object" && value !== null) || typeof value === "function"
    ? capabilityClaims.has(value)
    : false;
}

export function consumeGitHubHostedStateAuthenticationCapability(capability, expectedBinding) {
  const record = (typeof capability === "object" && capability !== null)
    || typeof capability === "function"
    ? capabilityClaims.get(capability)
    : undefined;
  if (record === undefined) return null;
  capabilityClaims.delete(capability);
  let consumedAtMonotonicNanoseconds;
  try {
    consumedAtMonotonicNanoseconds = monotonicNowNanoseconds();
  } catch {
    return null;
  }
  if (typeof consumedAtMonotonicNanoseconds !== "bigint"
    || consumedAtMonotonicNanoseconds < record.issuedAtMonotonicNanoseconds
    || consumedAtMonotonicNanoseconds - record.issuedAtMonotonicNanoseconds
      >= CAPABILITY_MAX_MONOTONIC_AGE_NANOSECONDS) {
    return null;
  }
  const expected = consumeBindingSnapshot(expectedBinding);
  if (expected === null) return null;
  const { claims } = record;
  const matches = CONSUME_KEYS.every((key) => claims[key] === expected[key]);
  return matches ? claims : null;
}

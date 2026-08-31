#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const X01_SITE_OPS_EVIDENCE_SCHEMA = "iat-b3-x01-site-ops-local-rehearsal-evidence/v1";
export const X01_SITE_OPS_EVIDENCE_SHA256 = "859f0b4ef36ad13a839fd3dcd3abfd9c544ec1af8c291541a270df3aeab497b2";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const HOMEPAGE_PATH = fileURLToPath(new URL("../app/page.tsx", import.meta.url));
const DEFAULT_PACKET_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-x01-site-ops-local-rehearsal-evidence.v1.json",
  import.meta.url,
));

const TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "profile",
  "componentId",
  "observationId",
  "status",
  "scope",
  "sourceBinding",
  "observationWindow",
  "dnssecObservation",
  "transportObservation",
  "routeObservation",
  "hostedCiObservation",
  "sourceLiveDriftObservation",
  "freshnessPolicy",
  "evidenceSetSha256",
  "assurance",
]);

const EXPECTED_SCOPE = Object.freeze({
  contract: "NONAUTHORIZING_READ_ONLY_POINT_IN_TIME_EVIDENCE",
  networkMutationPerformed: false,
  deploymentMutationPerformed: false,
  dnsMutationPerformed: false,
  signingPerformed: false,
  continuousMonitoringPerformed: false,
  doesNotCertify: Object.freeze([
    "CONTINUOUS_DNS_OR_HTTPS_RELIABILITY",
    "TAKEOVER_HEAD_HOSTED_CI",
    "LIVE_B3_SOURCE_PARITY",
    "DEPLOYMENT_IDENTITY_OR_ROLLBACK_READINESS",
    "DEVNET_OR_MAINNET_AUTHORIZATION",
  ]),
});

const EXPECTED_FRESHNESS_POLICY = Object.freeze({
  staleObservationDisposition: "HOLD",
  unobservedClaimDisposition: "HOLD",
  livePreB3Disposition: "HOLD",
  failedHostedCheckDisposition: "HOLD",
  continuousReliabilityUnobservedDisposition: "HOLD",
});

const EXPECTED_ASSURANCE = Object.freeze({
  dnssecPointInTimeObserved: true,
  tlsPointInTimeObserved: true,
  routeAndIndexingContractObserved: true,
  continuousDnssecReliabilityVerified: false,
  takeoverHeadHostedCiVerified: false,
  standaloneReleaseCiVerified: false,
  liveB3SourceParityVerified: false,
  deploymentIdentityVerified: false,
  siteOpsReady: false,
  devnetAuthorized: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: "HOLD",
});

const EXPECTED_A_RECORDS = Object.freeze(["162.159.143.30", "172.66.3.26"]);
const EXPECTED_RESOLVERS = Object.freeze(["1.1.1.1", "8.8.8.8", "9.9.9.9"]);
const EXPECTED_DOMAINS = Object.freeze(["internalagency.io", "ileriakil.com"]);
const NOINDEX = "noindex, nofollow, noarchive";
const INDEXABLE_PATHS = Object.freeze(["/", "/network", "/proof", "/dossier", "/launch"]);
const HOLD_LOCALE_PATHS = Object.freeze(["/tr", "/fr"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exactJson(actual, expected) {
  return stableJson(actual) === stableJson(expected);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function evidenceSet(packet) {
  return {
    sourceBinding: packet.sourceBinding,
    observationWindow: packet.observationWindow,
    dnssecObservation: packet.dnssecObservation,
    transportObservation: packet.transportObservation,
    routeObservation: packet.routeObservation,
    hostedCiObservation: packet.hostedCiObservation,
    sourceLiveDriftObservation: packet.sourceLiveDriftObservation,
    freshnessPolicy: packet.freshnessPolicy,
  };
}

function exactKeys(value, expectedKeys, label, violations) {
  if (!isRecord(value)) {
    violations.push(`${label}: expected an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (!exactJson(actual, expected)) {
    violations.push(`${label}: expected exact keys ${expected.join(", ")}`);
    return false;
  }
  return true;
}

export function parseX01SiteOpsEvidenceJson(text, label = "x01-site-ops-evidence") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const skipWhitespace = () => {
    while (index < text.length && /[\t\n\r ]/u.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseString = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (text[index] === "\\") index += 2;
      else {
        if (text[index] < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseString();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function loadX01SiteOpsEvidence(path = DEFAULT_PACKET_PATH) {
  const resolved = resolve(path);
  return parseX01SiteOpsEvidenceJson(readFileSync(resolved, "utf8"), resolved);
}

export function observeLocalSourceBinding() {
  const homepageBytes = readFileSync(HOMEPAGE_PATH);
  let gitHead = null;
  let gitError = null;
  try {
    gitHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: SITE_ROOT,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    gitError = error.message;
  }
  return {
    gitHead,
    gitError,
    homepageGitBlobSha1: gitBlobSha1(homepageBytes),
  };
}

function routeByUrl(routes, url) {
  return routes.find((route) => route?.url === url);
}

function validateRouteContract(packet, violations, blockers) {
  const routes = packet.routeObservation?.routes;
  if (!Array.isArray(routes) || routes.length !== 14 || new Set(routes.map((route) => route?.url)).size !== 14) {
    violations.push("routeObservation: expected 14 unique route observations");
    blockers.add("ROUTE_OBSERVATION_INCOMPLETE");
    return false;
  }
  let valid = true;
  const fail = (detail) => {
    violations.push(`routeObservation: ${detail}`);
    blockers.add("ROUTE_OR_INDEXING_CONTRACT_MISMATCH");
    valid = false;
  };
  for (const path of INDEXABLE_PATHS) {
    const url = `https://internalagency.io${path}`;
    const route = routeByUrl(routes, url);
    if (!route
      || route.status !== 200
      || route.contentLanguage !== "en"
      || route.htmlLang !== "en"
      || route.xRobotsTag !== null
      || route.metaRobots !== "index, follow"
      || route.canonical !== url
      || route.holdMarker !== true) {
      fail(`${url} must be canonical indexable English HOLD content`);
    }
  }
  for (const path of HOLD_LOCALE_PATHS) {
    const url = `https://internalagency.io${path}`;
    const route = routeByUrl(routes, url);
    if (!route
      || route.status !== 200
      || route.contentLanguage !== "en"
      || route.htmlLang !== "en"
      || route.xRobotsTag !== NOINDEX
      || route.metaRobots !== NOINDEX
      || route.canonical !== "https://internalagency.io/"
      || route.holdMarker !== true) {
      fail(`${url} must be fail-closed English fallback with noindex`);
    }
  }
  for (const path of [...INDEXABLE_PATHS, ...HOLD_LOCALE_PATHS]) {
    const url = `https://ileriakil.com${path}`;
    const route = routeByUrl(routes, url);
    const canonicalPath = HOLD_LOCALE_PATHS.includes(path) ? "/" : path;
    if (!route
      || route.status !== 200
      || route.contentLanguage !== "en"
      || route.htmlLang !== "en"
      || route.xRobotsTag !== NOINDEX
      || route.metaRobots !== NOINDEX
      || route.canonical !== `https://internalagency.io${canonicalPath}`
      || route.holdMarker !== true) {
      fail(`${url} must be Turkish-intent fail-closed English fallback with noindex`);
    }
  }
  if (routes.some((route) => route.b3Marker !== false)) {
    fail("live route observations must retain the observed pre-B3 marker state");
  }
  const discovery = packet.routeObservation?.discovery;
  if (discovery?.canonicalSitemapLocationCount !== 25
    || discovery?.ileriakilReferences !== 0
    || discovery?.holdLocaleReferences !== 0
    || discovery?.nonEnglishHreflangReferences !== 0
    || discovery?.bothRobotsFilesAdvertise !== "https://internalagency.io/sitemap.xml") {
    fail("sitemap/robots discovery boundary mismatch");
  }
  return valid;
}

function validateDnssec(packet, evaluationMs, violations, blockers) {
  const observation = packet.dnssecObservation;
  const matrix = observation?.recursiveResolverMatrix;
  let valid = true;
  if (!Array.isArray(matrix) || matrix.length !== 6) valid = false;
  for (const domain of EXPECTED_DOMAINS) {
    for (const resolver of EXPECTED_RESOLVERS) {
      const row = matrix?.find((entry) => entry?.domain === domain && entry?.resolver === resolver);
      if (!row
        || row.rcode !== 0
        || row.authenticatedData !== true
        || row.checkingDisabled !== false
        || !Array.isArray(row.aRecords)
        || !exactJson([...row.aRecords].sort(), [...EXPECTED_A_RECORDS].sort())) valid = false;
    }
  }
  if (!Array.isArray(observation?.zones) || observation.zones.length !== 2) valid = false;
  for (const domain of EXPECTED_DOMAINS) {
    const zone = observation?.zones?.find((candidate) => candidate?.domain === domain);
    const inceptionMs = Date.parse(zone?.rrsigInceptionUtc);
    const expirationMs = Date.parse(zone?.rrsigExpirationUtc);
    if (!zone
      || zone.authoritiesEqual !== true
      || !Array.isArray(zone.aRecords)
      || !exactJson([...zone.aRecords].sort(), [...EXPECTED_A_RECORDS].sort())
      || !Number.isFinite(inceptionMs)
      || !Number.isFinite(expirationMs)
      || inceptionMs > evaluationMs
      || expirationMs <= evaluationMs) valid = false;
  }
  if (observation?.dohValidation?.allStatusZero !== true
    || observation?.dohValidation?.allAuthenticatedData !== true) valid = false;
  if (!valid) {
    violations.push("dnssecObservation: incomplete or nonvalidating point-in-time matrix");
    blockers.add("DNSSEC_OBSERVATION_INCOMPLETE");
  }
  if (observation?.incidentBoundary?.continuousReliabilityVerified !== true) {
    blockers.add("DNSSEC_CONTINUITY_UNOBSERVED");
  }
  return valid;
}

function validateTransport(packet, evaluationMs, violations, blockers) {
  const hosts = packet.transportObservation?.hosts;
  let valid = Array.isArray(hosts) && hosts.length === 2;
  for (const host of EXPECTED_DOMAINS) {
    const entry = hosts?.find((candidate) => candidate?.host === host);
    const notBeforeMs = Date.parse(entry?.certificateNotBeforeUtc);
    const notAfterMs = Date.parse(entry?.certificateNotAfterUtc);
    if (!entry
      || entry.httpStatus !== 302
      || entry.httpsStatus !== 200
      || entry.tlsValidated !== true
      || entry.tlsProtocol !== "TLS_1_3"
      || entry.certificateSubject !== `CN=${host}`
      || !Number.isFinite(notBeforeMs)
      || !Number.isFinite(notAfterMs)
      || notBeforeMs > evaluationMs
      || notAfterMs <= evaluationMs) valid = false;
    if (entry?.strictTransportSecurityObserved !== true) blockers.add("HSTS_HEADER_ABSENT");
  }
  if (!valid) {
    violations.push("transportObservation: HTTPS/TLS observation is incomplete or invalid at evaluation time");
    blockers.add("TLS_OR_HTTPS_OBSERVATION_INCOMPLETE");
  }
  return valid;
}

function validateHostedCi(packet, blockers) {
  const ci = packet.hostedCiObservation;
  const standalone = ci?.checks?.filter((check) => check?.name === "standalone") ?? [];
  if (ci?.takeoverHeadHostedChecks?.observed !== true) blockers.add("TAKEOVER_HEAD_HOSTED_CI_UNOBSERVED");
  if (standalone.length !== 2 || standalone.some(({ conclusion }) => conclusion !== "SUCCESS")) {
    blockers.add("PR_STANDALONE_CI_FAILED");
  }
  return ci?.takeoverHeadHostedChecks?.observed === true
    && standalone.length === 2
    && standalone.every(({ conclusion }) => conclusion === "SUCCESS");
}

function validateSourceLiveDrift(packet, blockers) {
  const drift = packet.sourceLiveDriftObservation;
  if (drift?.liveMatchesTakeoverSource !== true || drift?.state === "LIVE_PRE_B3_SOURCE_DRIFT") {
    blockers.add("LIVE_PRE_B3_SOURCE_DRIFT");
  }
  if (drift?.deployedSourceIdentityVerified !== true) blockers.add("DEPLOYED_SOURCE_IDENTITY_UNVERIFIED");
  if (drift?.rollbackRehearsalObserved !== true) blockers.add("ROLLBACK_REHEARSAL_UNOBSERVED");
  return drift?.liveMatchesTakeoverSource === true
    && drift?.deployedSourceIdentityVerified === true
    && drift?.rollbackRehearsalObserved === true;
}

export function validateX01SiteOpsEvidence({
  packet,
  sourceContext = observeLocalSourceBinding(),
  evaluationAtUtc = packet?.observationWindow?.rehearsalEvaluationAtUtc,
} = {}) {
  const violations = [];
  const blockers = new Set(["NONAUTHORIZING_LOCAL_REHEARSAL"]);
  if (!exactKeys(packet, TOP_LEVEL_KEYS, "packet", violations)) return buildResult({ violations, blockers });
  if (packet.schema !== X01_SITE_OPS_EVIDENCE_SCHEMA
    || packet.profile !== "PRODUCTION"
    || packet.componentId !== "X01_SITE_OPS_LOCAL_REHEARSAL"
    || packet.observationId !== "W01_20260813"
    || packet.status !== "HOLD") {
    violations.push("packet: expected canonical X01/W01 PRODUCTION HOLD envelope");
  }
  if (!exactJson(packet.scope, EXPECTED_SCOPE)) violations.push("scope: canonical nonauthorizing boundary mismatch");
  if (!exactJson(packet.freshnessPolicy, EXPECTED_FRESHNESS_POLICY)) {
    violations.push("freshnessPolicy: every stale, unobserved, failed, or pre-B3 disposition must remain HOLD");
  }
  if (!exactJson(packet.assurance, EXPECTED_ASSURANCE)) violations.push("assurance: canonical false/HOLD boundary mismatch");

  const computedEvidenceSha256 = sha256(stableJson(evidenceSet(packet)));
  if (packet.evidenceSetSha256 !== X01_SITE_OPS_EVIDENCE_SHA256
    || computedEvidenceSha256 !== X01_SITE_OPS_EVIDENCE_SHA256) {
    violations.push("evidenceSetSha256: frozen W01 evidence set mismatch");
    blockers.add("EVIDENCE_SET_DRIFT");
  }

  if (sourceContext?.gitHead !== packet.sourceBinding?.takeoverHeadSha) {
    violations.push("sourceBinding: local Git HEAD does not match the observed takeover head");
    blockers.add("SOURCE_HEAD_DRIFT");
  }
  if (sourceContext?.homepageGitBlobSha1 !== packet.sourceBinding?.takeoverHomepageGitBlobSha1) {
    violations.push("sourceBinding: local homepage bytes do not match the frozen takeover blob");
    blockers.add("SOURCE_HOMEPAGE_DRIFT");
  }
  if (packet.sourceBinding?.worktreeAtObservation?.clean !== true) blockers.add("DIRTY_WORKTREE_AT_OBSERVATION");

  const evaluationMs = Date.parse(evaluationAtUtc);
  const startedMs = Date.parse(packet.observationWindow?.startedAtUtc);
  const endedMs = Date.parse(packet.observationWindow?.endedAtUtc);
  const maximumAgeMs = Number(packet.observationWindow?.maximumFreshAgeSeconds) * 1_000;
  if (![evaluationMs, startedMs, endedMs, maximumAgeMs].every(Number.isFinite)
    || packet.observationWindow?.pointInTime !== true
    || startedMs > endedMs
    || evaluationMs < endedMs) {
    violations.push("observationWindow: invalid point-in-time window or evaluation time");
    blockers.add("OBSERVATION_WINDOW_INVALID");
  } else if (evaluationMs - endedMs > maximumAgeMs) {
    blockers.add("OBSERVATION_STALE");
  }

  const dnssecPass = validateDnssec(packet, evaluationMs, violations, blockers);
  const transportPass = validateTransport(packet, evaluationMs, violations, blockers);
  const routePass = validateRouteContract(packet, violations, blockers);
  const hostedCiPass = validateHostedCi(packet, blockers);
  const sourceLiveParityPass = validateSourceLiveDrift(packet, blockers);

  return buildResult({
    violations,
    blockers,
    computedEvidenceSha256,
    dnssecPass,
    transportPass,
    routePass,
    hostedCiPass,
    sourceLiveParityPass,
    observationFresh: !blockers.has("OBSERVATION_STALE") && !blockers.has("OBSERVATION_WINDOW_INVALID"),
  });
}

function buildResult({
  violations,
  blockers,
  computedEvidenceSha256 = null,
  dnssecPass = false,
  transportPass = false,
  routePass = false,
  hostedCiPass = false,
  sourceLiveParityPass = false,
  observationFresh = false,
}) {
  return {
    schema: "iat-b3-x01-site-ops-local-rehearsal-validation/v1",
    valid: violations.length === 0,
    evidenceSetSha256: computedEvidenceSha256,
    observationFresh,
    components: {
      dnssecPointInTime: dnssecPass ? "PASS" : "HOLD",
      httpsTlsPointInTime: transportPass ? "PASS" : "HOLD",
      routeAndIndexingContract: routePass ? "PASS" : "HOLD",
      takeoverHeadHostedCi: hostedCiPass ? "PASS" : "HOLD",
      sourceLiveParity: sourceLiveParityPass ? "PASS" : "HOLD",
    },
    siteOpsReady: false,
    devnetAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    status: "HOLD",
    blockers: [...blockers].sort(),
    violations,
  };
}

function parseCli(argv) {
  const cli = { packetPath: DEFAULT_PACKET_PATH, evaluationAtUtc: null, requireReady: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--packet" || argument === "--evaluation-time") {
      if (!argv[index + 1]) throw new Error(`${argument} requires a value`);
      if (argument === "--packet") cli.packetPath = resolve(argv[index + 1]);
      else cli.evaluationAtUtc = argv[index + 1];
      index += 1;
    } else if (argument === "--require-ready") {
      cli.requireReady = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return cli;
}

function main() {
  let cli;
  let packet;
  try {
    cli = parseCli(process.argv.slice(2));
    packet = loadX01SiteOpsEvidence(cli.packetPath);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const result = validateX01SiteOpsEvidence({
    packet,
    evaluationAtUtc: cli.evaluationAtUtc ?? packet.observationWindow.rehearsalEvaluationAtUtc,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
  else if (cli.requireReady && !result.siteOpsReady) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

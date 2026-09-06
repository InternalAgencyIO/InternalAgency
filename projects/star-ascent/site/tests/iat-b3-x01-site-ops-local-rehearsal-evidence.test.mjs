import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  X01_SITE_OPS_EVIDENCE_SHA256,
  loadX01SiteOpsEvidence,
  observeLocalSourceBinding,
  parseX01SiteOpsEvidenceJson,
  validateX01SiteOpsEvidence,
} from "../scripts/validate-iat-b3-x01-site-ops-local-rehearsal-evidence.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CLI_PATH = fileURLToPath(new URL(
  "../scripts/validate-iat-b3-x01-site-ops-local-rehearsal-evidence.mjs",
  import.meta.url,
));
const NOINDEX = "noindex, nofollow, noarchive";
const SOURCE_CONTEXT = observeLocalSourceBinding();

function canonicalPacket() {
  return loadX01SiteOpsEvidence();
}

function validate(packet = canonicalPacket(), options = {}) {
  return validateX01SiteOpsEvidence({ packet, sourceContext: SOURCE_CONTEXT, ...options });
}

function assertNonauthorizingHold(result) {
  assert.equal(result.siteOpsReady, false);
  assert.equal(result.devnetAuthorized, false);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.status, "HOLD");
}

test("canonical W01 packet is source-bound point-in-time evidence and X01 remains HOLD", () => {
  const result = validate();
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.evidenceSetSha256, X01_SITE_OPS_EVIDENCE_SHA256);
  assert.equal(result.observationFresh, true);
  assert.deepEqual(result.components, {
    dnssecPointInTime: "PASS",
    httpsTlsPointInTime: "PASS",
    routeAndIndexingContract: "PASS",
    takeoverHeadHostedCi: "HOLD",
    sourceLiveParity: "HOLD",
  });
  for (const blocker of [
    "DNSSEC_CONTINUITY_UNOBSERVED",
    "TAKEOVER_HEAD_HOSTED_CI_UNOBSERVED",
    "PR_STANDALONE_CI_FAILED",
    "LIVE_PRE_B3_SOURCE_DRIFT",
    "DEPLOYED_SOURCE_IDENTITY_UNVERIFIED",
    "NONAUTHORIZING_LOCAL_REHEARSAL",
  ]) assert.ok(result.blockers.includes(blocker), blocker);
  assert.deepEqual(result.violations, []);
  assertNonauthorizingHold(result);
});

test("canonical English routes are indexable while Turkish-intent and HOLD locale routes fail closed", () => {
  const packet = canonicalPacket();
  const routes = packet.routeObservation.routes;
  for (const path of ["/", "/network", "/proof", "/dossier", "/launch"]) {
    const route = routes.find(({ url }) => url === `https://internalagency.io${path}`);
    assert.ok(route, path);
    assert.equal(route.status, 200);
    assert.equal(route.contentLanguage, "en");
    assert.equal(route.htmlLang, "en");
    assert.equal(route.xRobotsTag, null);
    assert.equal(route.metaRobots, "index, follow");
    assert.equal(route.canonical, `https://internalagency.io${path}`);
  }
  for (const path of ["/tr", "/fr"]) {
    const route = routes.find(({ url }) => url === `https://internalagency.io${path}`);
    assert.equal(route.contentLanguage, "en");
    assert.equal(route.xRobotsTag, NOINDEX);
    assert.equal(route.metaRobots, NOINDEX);
    assert.equal(route.canonical, "https://internalagency.io/");
  }
  for (const path of ["/", "/network", "/proof", "/dossier", "/launch", "/tr", "/fr"]) {
    const route = routes.find(({ url }) => url === `https://ileriakil.com${path}`);
    assert.ok(route, path);
    assert.equal(route.contentLanguage, "en");
    assert.equal(route.htmlLang, "en");
    assert.equal(route.xRobotsTag, NOINDEX);
    assert.equal(route.metaRobots, NOINDEX);
    assert.ok(route.canonical.startsWith("https://internalagency.io"));
  }
  assert.equal(packet.routeObservation.discovery.ileriakilReferences, 0);
  assert.equal(packet.routeObservation.discovery.holdLocaleReferences, 0);
  assert.equal(packet.routeObservation.discovery.nonEnglishHreflangReferences, 0);
});

test("DNSSEC and TLS observations bind exact authorities, DS records, and certificates", () => {
  const packet = canonicalPacket();
  assert.equal(packet.dnssecObservation.recursiveResolverMatrix.length, 6);
  assert.ok(packet.dnssecObservation.recursiveResolverMatrix.every(
    ({ rcode, authenticatedData, checkingDisabled }) => rcode === 0
      && authenticatedData === true
      && checkingDisabled === false,
  ));
  const internal = packet.dnssecObservation.zones.find(({ domain }) => domain === "internalagency.io");
  const turkish = packet.dnssecObservation.zones.find(({ domain }) => domain === "ileriakil.com");
  assert.equal(internal.ds, "3329 13 2 627d74f447509dfb4d0d3509b7ff7cebbe81d3f2bba990f4849531498a0de2eb");
  assert.equal(internal.soaSerial, 1785462982);
  assert.equal(internal.aRrsigKeyTag, 17470);
  assert.equal(turkish.ds, "10880 13 2 d3704f59caac5f0dbad75e26d745717da9a4e1a12c505ea4c5db33461569944c");
  assert.equal(turkish.soaSerial, 1785094577);
  assert.equal(turkish.aRrsigKeyTag, 27518);
  assert.equal(packet.dnssecObservation.incidentBoundary.continuousReliabilityVerified, false);

  const internalTls = packet.transportObservation.hosts.find(({ host }) => host === "internalagency.io");
  const turkishTls = packet.transportObservation.hosts.find(({ host }) => host === "ileriakil.com");
  assert.equal(internalTls.certificateSubject, "CN=internalagency.io");
  assert.equal(internalTls.certificateThumbprintSha1, "D7A30E7F2AA494A41ED9A04A02B4EC32E10E498A");
  assert.equal(internalTls.certificateNotAfterUtc, "2026-10-24T19:40:23Z");
  assert.equal(turkishTls.certificateSubject, "CN=ileriakil.com");
  assert.equal(turkishTls.certificateThumbprintSha1, "BC664888C77A002FAF472FDE8B9185A866B9F2B7");
  assert.equal(turkishTls.certificateNotAfterUtc, "2026-10-24T19:46:01Z");
  assert.ok(packet.transportObservation.hosts.every(({ tlsProtocol }) => tlsProtocol === "TLS_1_3"));
});

test("PR #10 evidence is bound to 48dc882a while takeover 09ec025b has no hosted checks", () => {
  const packet = canonicalPacket();
  const ci = packet.hostedCiObservation;
  assert.equal(ci.pullRequestNumber, 10);
  assert.equal(ci.isDraft, true);
  assert.equal(ci.mergeStateStatus, "UNSTABLE");
  assert.equal(ci.headSha, "48dc882a1a9a70720910bc983323ceb1a6275ef2");
  assert.equal(ci.takeoverHeadHostedChecks.headSha, "09ec025b5b301925d49bc24347bafc8a0c7f733d");
  assert.equal(ci.takeoverHeadHostedChecks.observed, false);
  assert.equal(ci.takeoverHeadHostedChecks.apiStatus, 422);
  const standalone = ci.checks.filter(({ name }) => name === "standalone");
  assert.deepEqual(standalone.map(({ runId, conclusion }) => [runId, conclusion]), [
    [31649911841, "FAILURE"],
    [31649908543, "FAILURE"],
  ]);
  assert.equal(ci.latestStandaloneFailure.expectedFullMasterCount, 16);
  assert.equal(ci.latestStandaloneFailure.recomputedFullMasterCount, 2);
  assert.equal(ci.latestStandaloneFailure.missingFullMasterCount, 14);
});

test("source/live evidence proves the observed live estate is pre-B3 and cannot be called parity", () => {
  const packet = canonicalPacket();
  assert.equal(packet.sourceBinding.takeoverHomepageGitBlobSha1, SOURCE_CONTEXT.homepageGitBlobSha1);
  assert.equal(packet.sourceBinding.takeoverHeadSha, SOURCE_CONTEXT.gitHead);
  assert.equal(packet.sourceBinding.takeoverHomepageGitBlobSha1, packet.sourceBinding.prHomepageGitBlobSha1);
  assert.notEqual(packet.sourceBinding.takeoverHomepageGitBlobSha1, packet.sourceBinding.deployedReferenceHomepageGitBlobSha1);
  assert.equal(packet.sourceLiveDriftObservation.state, "LIVE_PRE_B3_SOURCE_DRIFT");
  assert.equal(packet.sourceLiveDriftObservation.liveHomepageMarkers.v2ProgramRehearsal, true);
  assert.equal(packet.sourceLiveDriftObservation.liveHomepageMarkers.b3ArchitectureHold, false);
  assert.equal(packet.sourceLiveDriftObservation.takeoverHomepageMarkers.v2ProgramRehearsal, false);
  assert.equal(packet.sourceLiveDriftObservation.takeoverHomepageMarkers.b3ArchitectureHold, true);
  assert.equal(packet.sourceLiveDriftObservation.liveMatchesTakeoverSource, false);
  assertNonauthorizingHold(validate(packet));
});

test("stale evaluation and every missing observation remain HOLD", () => {
  const stale = validate(canonicalPacket(), { evaluationAtUtc: "2026-08-13T06:55:28Z" });
  assert.equal(stale.valid, true);
  assert.equal(stale.observationFresh, false);
  assert.ok(stale.blockers.includes("OBSERVATION_STALE"));
  assertNonauthorizingHold(stale);

  const mutations = [
    {
      code: "DNSSEC_OBSERVATION_INCOMPLETE",
      mutate(packet) { packet.dnssecObservation.recursiveResolverMatrix.pop(); },
    },
    {
      code: "ROUTE_OBSERVATION_INCOMPLETE",
      mutate(packet) { packet.routeObservation.routes.pop(); },
    },
    {
      code: "TLS_OR_HTTPS_OBSERVATION_INCOMPLETE",
      mutate(packet) { packet.transportObservation.hosts[0].tlsValidated = false; },
    },
  ];
  for (const { code, mutate } of mutations) {
    const packet = structuredClone(canonicalPacket());
    mutate(packet);
    const result = validate(packet);
    assert.equal(result.valid, false);
    assert.ok(result.blockers.includes("EVIDENCE_SET_DRIFT"));
    assert.ok(result.blockers.includes(code), code);
    assertNonauthorizingHold(result);
  }
});

test("source-head or homepage drift invalidates the component without broadening authority", () => {
  for (const sourceContext of [
    { ...SOURCE_CONTEXT, gitHead: "0".repeat(40) },
    { ...SOURCE_CONTEXT, homepageGitBlobSha1: "f".repeat(40) },
  ]) {
    const result = validateX01SiteOpsEvidence({ packet: canonicalPacket(), sourceContext });
    assert.equal(result.valid, false);
    assert.ok(result.blockers.some((blocker) => blocker.startsWith("SOURCE_")));
    assertNonauthorizingHold(result);
  }
});

test("strict parsing, exact envelope, and frozen evidence hash reject substitution", () => {
  assert.throws(
    () => parseX01SiteOpsEvidenceJson('{"schema":"one","schema":"two"}', "duplicate-top"),
    /duplicate JSON member \$root\.schema/u,
  );
  assert.throws(
    () => parseX01SiteOpsEvidenceJson('{"route":{"status":1,"status":2}}', "duplicate-nested"),
    /duplicate JSON member \$root\.route\.status/u,
  );

  const extra = structuredClone(canonicalPacket());
  extra.releaseAuthorized = true;
  const extraResult = validate(extra);
  assert.equal(extraResult.valid, false);
  assert.match(extraResult.violations.join("\n"), /expected exact keys/u);
  assertNonauthorizingHold(extraResult);

  const substituted = structuredClone(canonicalPacket());
  substituted.routeObservation.routes[0].bodySha256 = "0".repeat(64);
  const substitutedResult = validate(substituted);
  assert.equal(substitutedResult.valid, false);
  assert.ok(substitutedResult.blockers.includes("EVIDENCE_SET_DRIFT"));
  assertNonauthorizingHold(substitutedResult);
});

test("Node CLI validates historical evidence but cannot require X01 readiness", () => {
  const ordinary = spawnSync(process.execPath, [CLI_PATH], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(ordinary.status, 0, ordinary.stderr || ordinary.stdout);
  const ordinaryResult = JSON.parse(ordinary.stdout);
  assert.equal(ordinaryResult.valid, true);
  assertNonauthorizingHold(ordinaryResult);

  const required = spawnSync(process.execPath, [CLI_PATH, "--require-ready"], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(required.status, 2, required.stderr || required.stdout);
  const requiredResult = JSON.parse(required.stdout);
  assert.equal(requiredResult.valid, true);
  assert.equal(requiredResult.siteOpsReady, false);
  assertNonauthorizingHold(requiredResult);
});

test("CLI rejects duplicate-member evidence bytes", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-x01-site-ops-"));
  try {
    const packetPath = join(directory, "duplicate.json");
    writeFileSync(packetPath, '{"schema":"one","schema":"two"}', "utf8");
    const result = spawnSync(process.execPath, [CLI_PATH, "--packet", packetPath], {
      cwd: SITE_ROOT,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /duplicate JSON member \$root\.schema/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

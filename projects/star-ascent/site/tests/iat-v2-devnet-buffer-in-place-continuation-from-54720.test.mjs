import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = "scripts/continue-iat-v2-devnet-buffer-in-place-from-54720.sh";
const source = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const incidentPath = "launch/IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_54720_INCIDENT_20260831.md";
const incident = readFileSync(incidentPath, "utf8");
const runtimeBinding = readFileSync(
  "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
  "utf8",
);
const buffer = "564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH";
const authority = "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4";
const partial = "c8b842bae57c2f23da0de4219ab879147971a0dafeda8755f6a90e8ca5db0dd3";
const target = "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01";
const phrase = `AUTHORIZE-DEVNET-IN-PLACE-BUFFER-CONTINUATION-${buffer}-FROM-54720-OF-649680-CURRENT-${partial}-TARGET-${target}`;
const owner = "BPFLoaderUpgradeab1e11111111111111111111111";
const genesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const rpc = "https://api.devnet.solana.com";

function sealPoststate(body) {
  return {
    ...body,
    evidenceBodySha256: createHash("sha256")
      .update(Buffer.from(JSON.stringify(body, null, 2) + "\n", "utf8"))
      .digest("hex"),
  };
}

function poststateFixture({
  kind = "exact",
  minContextSlot = 490807312,
  accountContextSlot = 490807312,
  matchingPrefixBytes = kind === "exact" ? 649680 : 55680,
  programSha256 = kind === "exact" ? target : "a".repeat(64),
} = {}) {
  const exact = kind === "exact";
  const comparison = exact ? {
    classification: "EXACT_ARTIFACT",
    exact: true,
    matchingPrefixBytes: 649680,
    expectedRemainingBytes: 0,
    observedSuffixIsZero: true,
    trailingZeroBytes: 0,
    firstMismatchOffset: null,
    firstMismatchExpectedByte: null,
    firstMismatchObservedByte: null,
    observedProgramBytes: 649680,
    observedProgramSha256: target,
  } : {
    classification: "PARTIAL_EXACT_PREFIX_ZERO_TAIL",
    exact: false,
    matchingPrefixBytes,
    expectedRemainingBytes: 649680 - matchingPrefixBytes,
    observedSuffixIsZero: true,
    trailingZeroBytes: 649680 - matchingPrefixBytes,
    firstMismatchOffset: matchingPrefixBytes,
    firstMismatchExpectedByte: 1,
    firstMismatchObservedByte: 0,
    observedProgramBytes: 649680,
    observedProgramSha256: programSha256,
  };
  return {
    ...sealPoststate({
    schema: "iat-v2-devnet-buffer-finalized-reconciliation/v1",
    status: exact ? "EXACT_FINALIZED_BUFFER" : "HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL",
    network: "devnet",
    rpc,
    genesisHash: genesis,
    commitment: "finalized",
    minContextSlot,
    accountContextSlot,
    observedAtUtc: "2026-08-31T12:34:56.789Z",
    bufferAddress: buffer,
    expectedAuthority: authority,
    observedAuthority: authority,
    observedAuthorityRole: "DEVNET_DEPLOYER",
    account: {
      owner,
      executable: false,
      lamports: "4522976880",
      dataBytes: 649717,
      metadataBytes: 37,
      stateTag: 1,
      authorityOption: 1,
      programBytes: 649680,
      programSha256,
    },
    publicCiArtifact: {
      bytes: 649680,
      sha256: target,
      sourceHeadCommit: "a03fe71dd66cd1650b8d0353e486786df30b83e9",
      ciRunId: 33161771816,
      evidenceManifestSha256: "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
    },
    comparison,
    validation: {
      authorityAdmitted: true,
      authorityMatchesExpected: true,
      sizeMatches: true,
      hashMatches: exact,
      exact,
      partialExactPrefixZeroTail: !exact,
      holdReasons: exact ? [] : ["PROGRAM_SHA256_MISMATCH"],
    },
    boundary: {
      mutationAuthorized: false,
      signing: false,
      broadcast: false,
      protectedRecoveryStateRead: false,
      next: exact
        ? "SEPARATE_ATTENDED_ACTION_REVIEW_REQUIRED"
        : "PRESERVE_EXISTING_ADDRESS_AND_DO_NOT_RESUBMIT",
    },
    }),
    evidenceFile: null,
  };
}

function extractPoststateValidator() {
  const marker = "post_classification=\"$(printf '%s' \"$post_record\" | \"$NODE_BIN\" --input-type=module -e '\n";
  const start = source.indexOf(marker);
  const bodyStart = start + marker.length;
  const end = source.indexOf("\n ' -- \"$BUFFER_ADDRESS\"", bodyStart);
  assert.ok(start >= 0 && end > bodyStart, "poststate validator must be extractable");
  return source.slice(bodyStart, end);
}

function runPoststateValidator(record, exitStatus) {
  return spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    extractPoststateValidator(),
    "--",
    buffer,
    authority,
    owner,
    genesis,
    "4522976880",
    "649717",
    "37",
    target,
    "649680",
    "490807312",
    "490807312",
    "490807312",
    "490807312",
    "490807312",
    "490807312",
    "a03fe71dd66cd1650b8d0353e486786df30b83e9",
    "33161771816",
    "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
    rpc,
    "54720",
    partial,
    String(exitStatus),
  ], {
    encoding: "utf8",
    input: JSON.stringify(record),
    windowsHide: true,
  });
}

test("new continuation lane requires the exact public-CI runtime binding with no bypass", () => {
  const guard = source.indexOf("CONTINUATION_RUNTIME_BINDING_POLICY='REQUIRE_EXACT_PUBLIC_CI_SOURCE_AND_BINDING_SUCCESSOR'");
  const binding = source.indexOf("\nverify_binding\n");
  const toolchainSource = source.indexOf("source \"$SCRIPT_DIR/lib/iat-v2-attended-solana-toolchain.sh\"");
  const rpc = source.indexOf("iat_v2_verify_devnet_genesis", binding);
  const signer = source.indexOf("open_private_payer", binding);
  assert.ok(guard >= 0 && binding > guard && toolchainSource > binding && rpc > toolchainSource && signer > binding);
  assert.doesNotMatch(source.slice(0, binding), /^\s*(?:source|\.)\s+/gmu,
    "no runtime shell source may execute before exact public-CI runtime verification");
  assert.match(source, /verify-recovery/u);
  assert.match(source, /direct,[\s\S]*data-only runtime-binding successor B/u);
  assert.doesNotMatch(source, /IAT_V2_IN_PLACE.*:-|ALLOW_UNBOUND|FORCE_UNBOUND|RUNTIME_BINDING_STATUS='BOUND'/u);
});

test("continuation incident and runtime closure preserve the consumed lane and exact new baseline", () => {
  for (const exact of [
    "SECOND IN-PLACE LANE CONSUMED",
    buffer,
    authority,
    owner,
    "490807312",
    partial,
    target,
    "payload bytes `[0, 54720)`",
    "payload bytes `[54720, 649680)`",
    "594,960",
    "bceff73e737dee68f812e7d73c3554d30e08b899ca723e08a798b2275609f429",
    "Data writes to account failed",
    "evidenceFile: null",
  ]) assert.ok(incident.includes(exact), "incident must retain exact continuation evidence: " + exact);
  assert.match(incident, /contained no transaction signatures or receipts,[\s\S]*does not claim an exact submitted or finalized transaction set/u);
  assert.match(incident, /must never be rerun/u);
  assert.match(incident, /No signer invocation, device[\s\S]*Devnet\/Mainnet transaction, or blockchain mutation occurs while[\s\S]*preparing/u);
  assert.match(incident, /Mainnet was not accessed/u);
  assert.ok(runtimeBinding.includes(JSON.stringify(incidentPath)));
  assert.ok(runtimeBinding.includes(JSON.stringify(path)));
});

test("exact partial prestate, finalized slot floor, and target are all pinned", () => {
  for (const value of [
    buffer, authority, partial, target,
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    "BPFLoaderUpgradeab1e11111111111111111111111",
    "4522976880", "649717", "649680", "54720", "594960", "490807312",
    "bceff73e737dee68f812e7d73c3554d30e08b899ca723e08a798b2275609f429",
    "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
  ]) assert.ok(source.includes(value), `missing exact pin ${value}`);
  assert.doesNotMatch(source, /RUNTIME_EVIDENCE_SHA256=/u);
  assert.match(source, /HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL/u);
  assert.match(source, /PARTIAL_EXACT_PREFIX_ZERO_TAIL/u);
  assert.match(source, /firstMismatchObservedByte===0/u);
});

test("real Bash evaluation preserves the exact partial-state hold reason string", () => {
  const start = source.indexOf("validate_partial() {");
  const end = source.indexOf("\n}\n\nobserve_partial() {", start);
  assert.ok(start >= 0 && end > start, "validate_partial must be extractable from the reviewed helper");
  const validatePartial = source.slice(start, end + 2);
  const record = {
    schema: "iat-v2-devnet-buffer-finalized-reconciliation/v1",
    status: "HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL",
    network: "devnet",
    genesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    commitment: "finalized",
    minContextSlot: 490807312,
    accountContextSlot: 490807312,
    bufferAddress: buffer,
    expectedAuthority: authority,
    observedAuthority: authority,
    account: {
      owner: "BPFLoaderUpgradeab1e11111111111111111111111",
      executable: false,
      lamports: "4522976880",
      dataBytes: 649717,
      metadataBytes: 37,
      stateTag: 1,
      authorityOption: 1,
      programBytes: 649680,
      programSha256: partial,
    },
    publicCiArtifact: { bytes: 649680, sha256: target },
    comparison: {
      classification: "PARTIAL_EXACT_PREFIX_ZERO_TAIL",
      exact: false,
      matchingPrefixBytes: 54720,
      expectedRemainingBytes: 594960,
      observedSuffixIsZero: true,
      firstMismatchOffset: 54720,
      firstMismatchObservedByte: 0,
    },
    validation: {
      partialExactPrefixZeroTail: true,
      exact: false,
      holdReasons: ["PROGRAM_SHA256_MISMATCH"],
    },
    boundary: {
      mutationAuthorized: false,
      signing: false,
      broadcast: false,
      protectedRecoveryStateRead: false,
    },
    evidenceBodySha256: "0".repeat(64),
  };
  const bashScript = `set -euo pipefail
${validatePartial}
NODE_BIN="$2"
BUFFER_ADDRESS="$3"
EXPECTED_AUTHORITY="$4"
EXPECTED_OWNER="$5"
EXPECTED_GENESIS="$6"
EXPECTED_BUFFER_LAMPORTS="$7"
EXPECTED_ACCOUNT_BYTES="$8"
EXPECTED_METADATA_BYTES="$9"
EXPECTED_PROGRAM_BYTES="\${10}"
EXPECTED_PARTIAL_HASH="\${11}"
EXPECTED_PREFIX_BYTES="\${12}"
EXPECTED_REMAINING_BYTES="\${13}"
MIN_FINALIZED_SLOT="\${14}"
BASELINE_ACCOUNT_SLOT="\${15}"
TARGET_ARTIFACT_SHA256="\${16}"
printf '%s' "$1" | /usr/bin/base64 -d | validate_partial
`;
  const node = process.platform === "win32"
    ? "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node"
    : process.execPath;
  const command = process.platform === "win32"
    ? `${process.env.WINDIR ?? "C:\\Windows"}\\System32\\wsl.exe`
    : "/usr/bin/bash";
  const prefixArgs = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/bash", "--noprofile", "--norc", "-s", "--"]
    : ["--noprofile", "--norc", "-s", "--"];
  const result = spawnSync(command, [
    ...prefixArgs,
    Buffer.from(JSON.stringify(record), "utf8").toString("base64"),
    node,
    buffer,
    authority,
    "BPFLoaderUpgradeab1e11111111111111111111111",
    record.genesisHash,
    "4522976880",
    "649717",
    "37",
    "649680",
    partial,
    "54720",
    "594960",
    "490807312",
    "490807312",
    target,
  ], { encoding: "utf8", input: bashScript });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout, `490807312\n490807312\n${"0".repeat(64)}\n`);
});

test("one target-bound TTY phrase gates one literal-address mutation", () => {
  assert.equal((source.match(/exec 8<>\/dev\/tty/gmu) ?? []).length, 1);
  assert.ok(source.includes(`CONFIRMATION_PHRASE="${phrase}"`));
  assert.match(source, /DEVNET ONLY \/\/ EXISTING BUFFER IN-PLACE CONTINUATION FROM 54,720/u);
  assert.equal((source.match(/program write-buffer/gmu) ?? []).length, 1);
  assert.match(source, new RegExp(`program write-buffer /proc/self/fd/11 --buffer ${buffer}`, "u"));
  assert.match(source, /--buffer-authority \/proc\/self\/fd\/9 --fee-payer \/proc\/self\/fd\/9 --keypair \/proc\/self\/fd\/9/u);
  assert.match(source, /iat_v2_run_keyless_solana_timeout 1500 "\$SOLANA_BIN" program write-buffer/u);
  assert.match(source, /--url devnet --commitment finalized --use-quic --with-compute-unit-price 1000 --max-sign-attempts 20/u);
  assert.match(source, /mutationPolicy:\{cliInvocations:1,maxSignAttempts:20,timeoutSeconds:1500,transport:"QUIC_TPU",doNotRerunAfterAmbiguity:true\}/u);
});

test("continuation never reads the consumed CAS or protected buffer signer and has no adjacent mutation", () => {
  assert.doesNotMatch(source, /buffer-keypair|solana-keygen|SOLANA_KEYGEN|\/proc\/self\/fd\/10|--buffer\s+\/proc\/self\/fd/u);
  assert.doesNotMatch(source, /devnet-buffer-rebuild-v1|devnet-buffer-in-place-recovery-v1|devnet-buffer-in-place-continuation-from-35520-v1|recover-iat-v2-devnet-buffer-in-place\.sh|continue-iat-v2-devnet-buffer-in-place-from-35520\.sh|program (?:close|deploy|set-buffer-authority)|set-buffer-authority|program upgrade|--url (?:mainnet|mainnet-beta)/u);
  assert.doesNotMatch(source, /rm\s+-rf|rm\s+-f|unlink|rmdir/u);
  assert.match(source, /protectedBufferKeypairUsed:false,newBufferCreated:false/u);
});

test("separate persistent CAS is durable before the sole boundary and never cleaned", () => {
  assert.match(source, /devnet-buffer-in-place-continuation-from-54720-v1/u);
  assert.match(source, /ATTEMPT_DIR="\$RECOVERY_ROOT\/attempt-one-use"/u);
  assert.match(source, /mkdir -m 700 -- "\$ATTEMPT_DIR"/u);
  assert.match(source, /MUTATION_BOUNDARY_ENTERED/u);
  assert.match(source, /mayHaveInvoked:true,doNotRerun:true/u);
  assert.match(source, /DO NOT RERUN/u);
  assert.match(source, /iat-v2-devnet-buffer-in-place-continuation-reservation\/v1/u);
  assert.match(source, /iat-v2-devnet-buffer-in-place-continuation-mutation-boundary\/v1/u);
  assert.match(source, /iat-v2-devnet-buffer-in-place-continuation-write-result\/v1/u);
  assert.match(source, /reviewedBaselineFinalizedPrestate/u);
  const cas = source.indexOf('/usr/bin/mkdir -m 700 -- "$ATTEMPT_DIR"');
  const manifest = source.indexOf('write_manifest "$ATTEMPT_DIR/reservation-manifest.json"');
  const marker = source.indexOf("write_boundary_marker 9<&- 11<&-");
  const mutation = source.indexOf("program write-buffer");
  assert.ok(cas >= 0 && manifest > cas && marker > manifest && mutation > marker);
});

test("source, artifact, tool, and signer-free reconciliation checks surround the attended gate", () => {
  assert.match(source, /verify_committed_source/u);
  assert.match(source, /verify-recovery/u);
  assert.match(source, /snapshot_artifact/u);
  assert.match(source, /assert_artifact_fd/u);
  assert.ok((source.match(/observe_partial(?:\s+9<&-\s+11<&-)?$/gmu) ?? []).length >= 3,
    "initial, post-prompt, and marker-fresh finalized prestates are required");
  const prompt = source.indexOf("exec 8<>/dev/tty");
  const firstPartial = source.indexOf("observe_partial\n");
  const secondPartial = source.indexOf("observe_partial\n", prompt);
  const mutation = source.indexOf("program write-buffer");
  const post = source.indexOf("capture_post_reconciliation", mutation);
  assert.ok(firstPartial >= 0 && prompt > firstPartial && secondPartial > prompt && mutation > secondPartial && post > mutation);
  assert.match(source, /EXACT_FINALIZED_BUFFER/u);
});

test("a fresh finalized prestate is captured after local preparation and bound immediately to the mutation marker", () => {
  const payerOpen = source.lastIndexOf("\nopen_private_payer");
  const artifactOpen = source.lastIndexOf('exec 11< "$ATTEMPT_DIR/reviewed-iat_v2.so"');
  const finalPrestate = Math.max(
    source.lastIndexOf("\nobserve_partial 9<&- 11<&-"),
    source.lastIndexOf("\nobserve_partial\n"),
  );
  const persistedPrestate = source.indexOf("mutation-prestate.json", finalPrestate);
  const marker = source.indexOf("write_boundary_marker 9<&- 11<&-", finalPrestate);
  const mutation = source.indexOf("program write-buffer", marker);
  assert.ok(payerOpen >= 0 && artifactOpen > payerOpen && finalPrestate > artifactOpen,
    "the marker-bound prestate must be observed after payer/artifact FD preparation");
  assert.ok(persistedPrestate > finalPrestate && marker > persistedPrestate && mutation > marker,
    "the fresh prestate must be persisted before the durable marker and sole write");
  const betweenPrestateAndMarker = source.slice(finalPrestate, marker);
  assert.doesNotMatch(betweenPrestateAndMarker,
    /snapshot_artifact|open_private_payer|observe_payer_floor|iat_v2_verify_devnet_genesis|verify_(?:node|git|solana|binding|committed_source)/u,
    "no mutable setup or additional observation may intervene after the marker-bound prestate");
  assert.match(source.slice(marker, mutation), /BOUNDARY_ENTERED=true/u);
});

test("every non-signing child after payer/artifact open closes protected descriptors explicitly", () => {
  assert.match(source, /assert_artifact_fd 9<&-/u,
    "artifact stat/hash children must not inherit payer FD9");
  for (const invocation of [
    "verify_node", "verify_git", "verify_committed_source", "verify_binding",
    "verify_solana", "iat_v2_verify_devnet_genesis", "observe_payer_floor", "observe_partial",
  ]) {
    assert.match(source, new RegExp(`^${invocation}[^\\n]*9<&- 11<&-$`, "mu"),
      `${invocation} must close FD9 and FD11 in the final pre-mutation lane`);
  }
  assert.match(source, /iat_v2_run_keyless_solana[^\n]*address -k \/proc\/self\/fd\/9 11<&-/u,
    "payer identity child needs FD9 but must close artifact FD11");
  assert.match(source, /write_boundary_marker 9<&- 11<&-/u);
  const mutation = source.indexOf("program write-buffer");
  const close = source.indexOf("exec 9<&- 11<&-", mutation);
  assert.ok(close > mutation, "both protected descriptors must close immediately after the sole write invocation");
});

test("poststate capture reauthenticates runtime after the write and durably records all outcomes", () => {
  const mutation = source.indexOf("program write-buffer");
  const close = source.indexOf("exec 9<&- 11<&-", mutation);
  const postNode = source.indexOf("verify_node", close);
  const postGit = source.indexOf("verify_git", postNode);
  const postSource = source.indexOf("verify_committed_source", postGit);
  const postBinding = source.indexOf("verify_binding", postSource);
  const capture = source.indexOf("capture_post_reconciliation", postBinding);
  assert.ok(mutation >= 0 && close > mutation && postNode > close && postGit > postNode
    && postSource > postGit && postBinding > postSource && capture > postBinding,
  "Node, Git, committed source, and runtime binding must be reauthenticated before poststate execution");
  assert.doesNotMatch(source.slice(mutation), /post_record="\$\("\$NODE_BIN" "\$RECONCILER"/u,
    "poststate must use the durable capture wrapper, not lossy command substitution");
  assert.match(source, /poststate\.json/u);
  assert.match(source, /poststate-stderr\.txt/u);
  assert.match(source, /poststate-result\.json/u);
  assert.match(source, /exitStatus:result\.status,signal:result\.signal,error:/u);
  assert.match(source, /iat-v2-devnet-buffer-in-place-continuation-poststate-capture\/v1/u);
  assert.match(source, /!\[0,2\]\.includes\(v\.exitStatus\)/u);
  assert.match(source, /Number\(exitStatus\)===0[\s\S]*EXACT_FINALIZED_BUFFER/u);
  assert.match(source, /Number\(exitStatus\)===2[\s\S]*HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL/u);
  assert.match(source, /validated monotonic partial; continuation CAS is consumed; DO NOT RERUN/u);
  assert.match(source, /v\.evidenceFile===null/u);
  assert.match(source, /evidenceBodySha256,evidenceFile,\.\.\.body/u);
  assert.match(source, /writeFileSync\(stdoutPath,stdout,\{flag:"wx",mode:0o600,flush:true\}\)/u);
  assert.match(source, /writeFileSync\(stderrPath,stderr,\{flag:"wx",mode:0o600,flush:true\}\)/u);
  assert.match(source, /writeFileSync\(resultPath,[\s\S]*\{flag:"wx",mode:0o600,flush:true\}\)/u);
  const captureCall = source.lastIndexOf("capture_post_reconciliation");
  const durable = source.indexOf(
    'fsync_paths "$ATTEMPT_DIR/poststate.json" "$ATTEMPT_DIR/poststate-stderr.txt" "$ATTEMPT_DIR/poststate-result.json"',
    captureCall,
  );
  assert.ok(durable > captureCall, "stdout, stderr, and exit metadata must be fsynced before status interpretation");
});

test("exact or admitted partial poststate is monotonic from the marker-bound finalized prestate", () => {
  assert.match(source, /preMinSlot,preAccountSlot/u,
    "poststate validator must accept both marker-bound finalized slot values");
  assert.match(source, /v\.minContextSlot\s*>=\s*Number\(preMinSlot\)/u);
  assert.match(source, /v\.accountContextSlot\s*>=\s*v\.minContextSlot/u);
  assert.match(source, /v\.accountContextSlot\s*>=\s*Number\(preAccountSlot\)/u);
  assert.match(source, /prefix>=Number\(baselinePrefix\)/u);
  assert.match(source, /prefix>Number\(baselinePrefix\) \|\| account\.programSha256===baselineHash/u);
  assert.match(source, /"\$\{PARTIAL_FIELDS\[0\]\}"\s+"\$\{PARTIAL_FIELDS\[1\]\}"/u,
    "the validator must receive the latest marker-bound prestate slots");
});

test("manifest argument mapping is exact and immutable files use exclusive creation", () => {
  assert.match(source, /a\.length!==14/u);
  assert.match(source, /a\.length !== 5/u);
  assert.match(source, /manifest argument map drifted/u);
  assert.match(source, /flag:"wx"/u);
  assert.match(source, /constants\.O_EXCL \| constants\.O_NOFOLLOW/u);
  assert.match(source, /binding-verification\.json/u);
  assert.match(source, /prestate\.json/u);
  assert.match(source, /reviewed-iat_v2\.so/u);
  assert.match(source, /poststate\.json/u);
});

test("real poststate validator pairs exit status with exact or consumed-partial records", () => {
  const exact = poststateFixture();
  const exactResult = runPoststateValidator(exact, 0);
  assert.equal(exactResult.status, 0, exactResult.stderr || exactResult.stdout);
  assert.equal(exactResult.stdout, "EXACT");

  const progressed = poststateFixture({ kind: "partial" });
  const progressedResult = runPoststateValidator(progressed, 2);
  assert.equal(progressedResult.status, 0, progressedResult.stderr || progressedResult.stdout);
  assert.equal(progressedResult.stdout, "PARTIAL");

  const missingEvidenceFile = { ...exact };
  delete missingEvidenceFile.evidenceFile;
  assert.notEqual(runPoststateValidator(missingEvidenceFile, 0).status, 0);
  assert.notEqual(runPoststateValidator({ ...exact, evidenceFile: "unexpected" }, 0).status, 0);

  const noProgress = poststateFixture({
    kind: "partial",
    matchingPrefixBytes: 54720,
    programSha256: partial,
  });
  const noProgressResult = runPoststateValidator(noProgress, 2);
  assert.equal(noProgressResult.status, 0, noProgressResult.stderr || noProgressResult.stdout);
  assert.equal(noProgressResult.stdout, "PARTIAL");

  assert.notEqual(runPoststateValidator(exact, 2).status, 0,
    "an exact record cannot pair with the reconciler partial exit status");
  assert.notEqual(runPoststateValidator(progressed, 0).status, 0,
    "a partial record cannot pair with a success exit status");

  const rollback = poststateFixture({
    kind: "partial",
    minContextSlot: 490776147,
    accountContextSlot: 490776147,
  });
  assert.notEqual(runPoststateValidator(rollback, 2).status, 0);

  const retreated = poststateFixture({
    kind: "partial",
    matchingPrefixBytes: 53760,
  });
  assert.notEqual(runPoststateValidator(retreated, 2).status, 0);

  const wrongBaselineHash = poststateFixture({
    kind: "partial",
    matchingPrefixBytes: 54720,
    programSha256: "b".repeat(64),
  });
  assert.notEqual(runPoststateValidator(wrongBaselineHash, 2).status, 0);

  const { evidenceBodySha256: _discarded, evidenceFile: _consoleField, ...divergentBody } = progressed;
  divergentBody.comparison = {
    ...divergentBody.comparison,
    classification: "DIVERGENT_BYTES",
    observedSuffixIsZero: false,
  };
  assert.notEqual(runPoststateValidator({ ...sealPoststate(divergentBody), evidenceFile: null }, 2).status, 0);

  const { evidenceBodySha256: _ignored, evidenceFile: _ignoredConsoleField, ...extraKeyBody } = exact;
  extraKeyBody.unreviewed = true;
  assert.notEqual(runPoststateValidator({ ...sealPoststate(extraKeyBody), evidenceFile: null }, 0).status, 0);
});

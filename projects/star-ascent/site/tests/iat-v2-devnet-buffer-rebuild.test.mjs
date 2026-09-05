import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const path = "scripts/rebuild-iat-v2-devnet-buffer-fresh.sh";
const recoveryPath = "scripts/recover-iat-v2-devnet-buffer-pre-address.sh";

function runIsolatedBash(script) {
  const command = process.platform === "win32"
    ? `${process.env.WINDIR ?? "C:\\Windows"}\\System32\\wsl.exe`
    : "/usr/bin/bash";
  const args = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/bash", "--noprofile", "--norc", "-c", script]
    : ["--noprofile", "--norc", "-c", script];
  return spawnSync(command, args, { encoding: "utf8" });
}

test("legacy clickable buffer launchers are inert fail-closed pointers", () => {
  const launchers = [
    "OPEN_IAT_DEVNET_FRESH_REBUILD.cmd",
    "OPEN_IAT_DEVNET_BUFFER.cmd",
    "OPEN_IAT_BUFFER_HANDOFF.cmd",
    "scripts/open-iat-v2-devnet-buffer-terminal.ps1",
  ].map((launcher) => readFileSync(launcher, "utf8"));
  for (const launcher of launchers) {
    assert.match(launcher, /IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK\.md/u);
    assert.doesNotMatch(launcher, /wsl(?:\.exe)?|bash\s+-l|IAT_FRESH_REBUILD_CONFIRM|2026-07-29|program (?:close|write-buffer)/iu);
  }
  assert.match(launchers[0], /exit \/b 1/u);
  assert.match(launchers[1], /exit \/b 1/u);
  assert.match(launchers[2], /exit \/b 1/u);
  assert.match(launchers[3], /exit 1/u);
});

test("fresh-buffer helper retains the old buffer and has one fail-closed mutation boundary", () => {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(source, /program close|Closing abandoned|reclaim/iu);
  assert.equal((source.match(/program write-buffer/gmu) ?? []).length, 1);
  assert.match(source, /OLD BUFFER POLICY:\s+RETAINED; THIS HELPER NEVER CLOSES OR MUTATES IT/u);
  assert.match(source, /The write invocation will not be repeated/u);
  assert.match(source, /DO NOT RERUN/u);
  assert.match(source, /--commitment finalized/gmu);
  assert.match(source, /Buffer Address: \$new_buffer/u);
  assert.match(source, /Authority: \$EXPECTED_PAYER/u);
  assert.match(source, /observed_bytes[\s\S]*EXPECTED_BYTES[\s\S]*observed_hash[\s\S]*EXPECTED_HASH/u);
  assert.match(source, /UPLOAD RETRY DISCLOSURE:[^\n]*max-sign-attempts 5[^\n]*re-sign\/resend/u);
});

test("fresh-buffer upload is persistently one-use, crash-durable, and artifact-FD bound", () => {
  const source = readFileSync(path, "utf8");
  assert.match(source, /attempt_dir="\$RECOVERY_ROOT\/attempt-one-use"/u);
  assert.match(source, /mkdir -m 700 -- "\$attempt_dir"/u);
  assert.doesNotMatch(source, /mktemp -d "\$RECOVERY_ROOT\/attempt-/u);
  assert.match(source, /iat-v2-devnet-buffer-rebuild-reservation\/v2/u);
  assert.match(source, /phase: "RESERVED_BEFORE_UPLOAD"/u);
  assert.match(source, /reservedSignerReused: entryMode === "recover-pre-address"/u);
  assert.match(source, /fsync_recovery_paths "\$buffer_keypair" "\$buffer_address_record" "\$artifact_snapshot" "\$reservation_manifest"[\s\S]*"\$attempt_dir" "\$RECOVERY_ROOT" "\$RECOVERY_PARENT"/u);
  assert.match(source, /openSync\(source, constants\.O_RDONLY \| constants\.O_NOFOLLOW\)/u);
  assert.match(source, /open_exact_private_file "\$artifact_snapshot" 11/u);
  assert.match(source, /exec 10<\/dev\/null\s+open_exact_private_file "\$buffer_keypair" 10/u);
  assert.equal((source.match(/^exec 10<\/dev\/null$/gmu) ?? []).length, 1);
  assert.match(source, /assert_bound_artifact_identity 9<&- 10<&-/u);
  assert.match(source, /program write-buffer \/proc\/self\/fd\/11/u);
  assert.doesNotMatch(source, /program write-buffer "\$ARTIFACT"/u);
  assert.match(source, /exec 9<&- 10<&- 11<&-/u);
});

test("the consumed fresh entrypoint fails before tooling and recovery is exact pre-address only", () => {
  const source = readFileSync(path, "utf8");
  const recovery = readFileSync(recoveryPath, "utf8");
  const consumedGuard = source.indexOf("use only the separately reviewed recovery entrypoint");
  const initialTooling = source.indexOf("verify_node; verify_git\n\nbinding_diagnostics=");

  assert.ok(consumedGuard >= 0 && initialTooling > consumedGuard);
  assert.match(source, /REBUILD_MODE="\$\{1:-fresh\}"/u);
  assert.match(source, /"fresh" \|\| "\$REBUILD_MODE" == "recover-pre-address"/u);
  assert.match(source, /expected_confirmation="RECOVER-DEVNET-BUFFER-PRE-ADDRESS"/u);
  assert.match(source, /\[\[ -d "\$attempt_dir" && ! -L "\$attempt_dir" \]\]/u);
  assert.match(source, /! -e "\$buffer_address_record" && ! -L "\$buffer_address_record"[\s\S]*! -e "\$reservation_manifest" && ! -L "\$reservation_manifest"[\s\S]*! -e "\$dump_path" && ! -L "\$dump_path"/u);
  assert.match(source, /! -path "\$buffer_keypair" ! -path "\$artifact_snapshot" -print -quit/u);
  assert.match(source, /if \[\[ "\$REBUILD_MODE" == "fresh" \]\]; then[\s\S]*"\$SOLANA_KEYGEN_BIN" new[\s\S]*--outfile "\$buffer_keypair"/u);

  assert.match(recovery, /^#!\/usr\/bin\/bash\r?\nset -euo pipefail\r?\nset \+x/u);
  assert.match(recovery, /\(\( \$# == 0 \)\) \|\| hold "this recovery launcher accepts no arguments"/u);
  assert.match(recovery, /IAT_V2_CLEAN_ENVIRONMENT:-.*iat-v2-devnet-buffer-v1/u);
  assert.match(recovery, /exec \/usr\/bin\/bash --noprofile --norc[\s\S]*"\$SCRIPT_DIR\/rebuild-iat-v2-devnet-buffer-fresh\.sh" recover-pre-address/u);
  assert.doesNotMatch(recovery, /solana-keygen|program write-buffer|buffer-keypair\.json/u);
});

test("runtime binding is checked initially and after both attended confirmation gates", () => {
  const source = readFileSync(path, "utf8");
  const runtimeRechecks = source.split(/\r?\n/u).filter((line) => (
    /(?:^|;\s*)verify_recovery_runtime_binding_again(?:\s|$)/u.test(line)
  ));
  const initialBinding = source.indexOf("iat-v2-devnet-buffer-preflight.mjs verify-recovery");
  const initialSolana = source.indexOf('verify_solana; iat_v2_verify_devnet_genesis "$SOLANA_BIN"', initialBinding);
  const initialCapacity = source.indexOf("iat-v2-devnet-buffer-preflight.mjs capacity", initialSolana);
  const firstPrompt = source.indexOf("exec 8<>/dev/tty", initialCapacity);
  const firstApproval = source.indexOf('[[ "$confirmation" == "$expected_confirmation" ]]', firstPrompt);
  const postApprovalBinding = source.indexOf("verify_node; verify_git; verify_recovery_runtime_binding_again", firstApproval);
  const postApprovalSolana = source.indexOf('verify_solana; iat_v2_verify_devnet_genesis "$SOLANA_BIN"', postApprovalBinding);
  const payerOpen = source.indexOf('open_exact_private_file "$PAYER_KEYPAIR" 9', postApprovalSolana);
  const targetPrompt = source.indexOf("Type UPLOAD-$new_buffer exactly", payerOpen);
  const targetApproval = source.indexOf('[[ "$target_confirmation" == "UPLOAD-$new_buffer" ]]', targetPrompt);
  const preMutationBinding = source.indexOf("verify_recovery_runtime_binding_again 9<&- 10<&- 11<&-", targetApproval);
  const preMutationSolana = source.indexOf("verify_solana 9<&- 10<&- 11<&-", preMutationBinding);
  const mutation = source.indexOf("program write-buffer", preMutationSolana);

  assert.equal((source.match(/iat-v2-devnet-buffer-preflight\.mjs verify-recovery\b/gmu) ?? []).length, 1);
  assert.equal(runtimeRechecks.length, 2, "the reviewed runtime binding must be rechecked after each attended gate");
  assert.ok(initialBinding >= 0);
  assert.ok(initialSolana > initialBinding);
  assert.ok(initialCapacity > initialSolana);
  assert.ok(firstPrompt > initialCapacity);
  assert.ok(firstApproval > firstPrompt);
  assert.ok(postApprovalBinding > firstApproval);
  assert.ok(postApprovalSolana > postApprovalBinding);
  assert.ok(payerOpen > postApprovalSolana);
  assert.ok(targetPrompt > payerOpen);
  assert.ok(targetApproval > targetPrompt);
  assert.ok(preMutationBinding > targetApproval);
  assert.ok(preMutationSolana > preMutationBinding);
  assert.ok(mutation > preMutationSolana);
});

test("recovery rejection preserves preexisting reconstruction evidence", () => {
  const source = readFileSync(path, "utf8");
  assert.match(source, /dump_created_by_this_run=false/u);
  assert.match(source, /if \[\[ "\$dump_created_by_this_run" == "true" \]\]; then \/usr\/bin\/rm -f -- "\$dump_path"; fi/u);
  assert.match(source, /if \[\[ "\$dump_created_by_this_run" == "true" \]\]; then[\s\S]*\/usr\/bin\/rm -f -- "\$dump_path"[\s\S]*dump_created_by_this_run=false[\s\S]*\[\[ ! -e "\$dump_path" && ! -L "\$dump_path" \]\][\s\S]*dump_created_by_this_run=true/u);
  assert.doesNotMatch(source, /cleanup\(\)[\s\S]{0,200}\n\s*\/usr\/bin\/rm -f -- "\$dump_path"/u);
});

test("an unreserved FD 10 reproduces Bash's FD 11 save collision and cannot reach a fake mutation", (context) => {
  const result = runIsolatedBash(String.raw`
    set -euo pipefail
    fixture="$(/usr/bin/mktemp -d)"
    trap '/usr/bin/rm -rf -- "$fixture"' EXIT
    printf '%s' payer >"$fixture/payer"
    printf '%s' signer >"$fixture/signer"
    printf '%s' artifact >"$fixture/artifact"
    printf '%s\n' '#!/usr/bin/bash' 'printf invoked >"$1"' >"$fixture/fake-mutation"
    /usr/bin/chmod 700 "$fixture/fake-mutation"
    open_signer() {
      exec 10<"$fixture/signer"
      /usr/bin/stat -Lc '%F' -- /proc/self/fd/10 >/dev/null
    }
    exec 9<"$fixture/payer"
    exec 11<"$fixture/artifact"
    set +e
    open_signer 9<&- 11<&-
    open_status=$?
    set -e
    if (( open_status == 0 )); then
      "$fixture/fake-mutation" "$fixture/mutation-marker"
      exit 91
    fi
    test ! -e "$fixture/mutation-marker"
    printf 'EXPECTED_FD10_CLOEXEC_COLLISION\n'
  `);
  if (result.error?.code === "ENOENT") return context.skip("Bash runtime unavailable");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /EXPECTED_FD10_CLOEXEC_COLLISION/u);
  assert.doesNotMatch(result.stdout, /invoked/u);
});

test("pre-reserving FD 10 preserves all bound files through child verification and fake upload", (context) => {
  const result = runIsolatedBash(String.raw`
    set -euo pipefail
    fixture="$(/usr/bin/mktemp -d)"
    trap '/usr/bin/rm -rf -- "$fixture"' EXIT
    printf '%s' payer >"$fixture/payer"
    printf '%s' signer >"$fixture/signer"
    printf '%s' artifact >"$fixture/artifact"
    printf '%s\n' '#!/usr/bin/bash' \
      'set -euo pipefail' \
      'test "$(cat /proc/self/fd/9)" = payer' \
      'test "$(cat /proc/self/fd/10)" = signer' \
      'test "$(cat /proc/self/fd/11)" = artifact' \
      'printf "invoked\\n" >>"$1"' >"$fixture/fake-mutation"
    /usr/bin/chmod 700 "$fixture/fake-mutation"
    open_signer() {
      exec 10<"$fixture/signer"
      /usr/bin/stat -Lc '%F' -- /proc/self/fd/10 >/dev/null
      /usr/bin/bash --noprofile --norc -c 'test "$(cat /proc/self/fd/10)" = signer'
    }
    exec 9<"$fixture/payer"
    exec 11<"$fixture/artifact"
    exec 10</dev/null
    open_signer 9<&- 11<&-
    /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/bash --noprofile --norc -c \
      'test "$(cat /proc/self/fd/10)" = signer'
    "$fixture/fake-mutation" "$fixture/mutation-marker"
    test "$(wc -l <"$fixture/mutation-marker")" = 1
    test "$(cat "$fixture/mutation-marker")" = invoked
    printf 'FAKE_MUTATION_INVOKED_ONCE_WITH_BOUND_FDS\n'
  `);
  if (result.error?.code === "ENOENT") return context.skip("Bash runtime unavailable");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /FAKE_MUTATION_INVOKED_ONCE_WITH_BOUND_FDS/u);
});

test("a missing bound descriptor fails before a fake mutation invocation", (context) => {
  const result = runIsolatedBash(String.raw`
    set -euo pipefail
    fixture="$(/usr/bin/mktemp -d)"
    trap '/usr/bin/rm -rf -- "$fixture"' EXIT
    printf '%s' signer >"$fixture/signer"
    printf '%s\n' '#!/usr/bin/bash' 'printf invoked >"$1"' >"$fixture/fake-mutation"
    /usr/bin/chmod 700 "$fixture/fake-mutation"
    exec 10<"$fixture/signer"
    exec 10<&-
    if [[ ! -r /proc/self/fd/10 ]]; then
      test ! -e "$fixture/mutation-marker"
      printf 'MISSING_FD_REJECTED_BEFORE_MUTATION\n'
      exit 0
    fi
    "$fixture/fake-mutation" "$fixture/mutation-marker"
    exit 92
  `);
  if (result.error?.code === "ENOENT") return context.skip("Bash runtime unavailable");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /MISSING_FD_REJECTED_BEFORE_MUTATION/u);
  assert.doesNotMatch(result.stdout, /invoked/u);
});

test("fresh-buffer funding gate has an explicit headroom floor and final reobservation", () => {
  const source = readFileSync(path, "utf8");
  assert.match(source, /DEVNET_UPLOAD_FEE_HEADROOM_LAMPORTS="100000000"/u);
  assert.match(source, /REQUIRED_DEPLOYER_LAMPORTS=\$\(\(BUFFER_RENT_LAMPORTS \+ DEVNET_UPLOAD_FEE_HEADROOM_LAMPORTS\)\)/u);
  assert.equal((source.match(/observe_finalized_payer_floor/gmu) ?? []).length, 3, "definition plus pre- and post-prompt observations are required");
  assert.ok(source.lastIndexOf("observe_finalized_payer_floor") > source.indexOf("Type UPLOAD-$new_buffer exactly"));
  assert.ok(source.indexOf("program write-buffer") > source.lastIndexOf("observe_finalized_payer_floor"));
});

test("fresh-buffer finalized reconciliation requires one exact address and authority line", () => {
  const source = readFileSync(path, "utf8");
  assert.match(source, /buffer_line_count == 1 && exact_buffer_line_count == 1/u);
  assert.match(source, /authority_line_count == 1 && exact_authority_line_count == 1/u);
  assert.doesNotMatch(source, /show_output" == \*"Buffer Address:/u);
});

test("pre-address recovery preserves the reviewed ordering before the sole upload boundary", () => {
  const source = readFileSync(path, "utf8");
  const stateValidation = source.indexOf('[[ ! -e "$buffer_address_record"');
  const artifactOpen = source.indexOf('open_exact_private_file "$artifact_snapshot" 11', stateValidation);
  const fd10Reservation = source.indexOf("exec 10</dev/null", artifactOpen);
  const signerOpen = source.indexOf('open_exact_private_file "$buffer_keypair" 10', fd10Reservation);
  const artifactValidation = source.indexOf("assert_bound_artifact_identity 9<&- 10<&-", signerOpen);
  const publicAddress = source.indexOf('new_buffer="$(iat_v2_run_keyless_solana', artifactValidation);
  const addressRecord = source.indexOf('printf \'%s\\n\' "$new_buffer" > "$buffer_address_record"', publicAddress);
  const manifest = source.indexOf('write_rebuild_reservation_manifest "$reservation_manifest"', addressRecord);
  const durableReservation = source.indexOf('fsync_recovery_paths "$buffer_keypair" "$buffer_address_record"', manifest);
  const uploadGate = source.indexOf('Type UPLOAD-$new_buffer exactly', durableReservation);
  const finalFloor = source.lastIndexOf("observe_finalized_payer_floor");
  const mutation = source.indexOf("program write-buffer", uploadGate);

  assert.ok(stateValidation >= 0);
  assert.ok(artifactOpen > stateValidation);
  assert.ok(fd10Reservation > artifactOpen);
  assert.ok(signerOpen > fd10Reservation);
  assert.ok(artifactValidation > signerOpen);
  assert.ok(publicAddress > artifactValidation);
  assert.ok(addressRecord > publicAddress);
  assert.ok(manifest > addressRecord);
  assert.ok(durableReservation > manifest);
  assert.ok(uploadGate > durableReservation);
  assert.ok(finalFloor > uploadGate);
  assert.ok(mutation > finalFloor);
});

test("fresh-buffer helper is clean-WSL, terminal-attended, and keypair identity atomic", () => {
  const source = readFileSync(path, "utf8");
  const summary = source.indexOf('echo "NETWORK:');
  const prompt = source.indexOf("exec 8<>/dev/tty");
  const payerOpen = source.indexOf('open_exact_private_file "$PAYER_KEYPAIR" 9');
  const mutation = source.indexOf("program write-buffer");
  assert.ok(summary >= 0 && prompt > summary && payerOpen > prompt && mutation > payerOpen);
  assert.match(source, /IAT_V2_CLEAN_ENVIRONMENT:-.*iat-v2-devnet-buffer-v1/u);
  assert.match(source, /Ubuntu-24\.04 WSL2/u);
  assert.match(source, /PATH:-.*\/usr\/bin:\/bin/u);
  assert.match(source, /exec 8<>\/dev\/tty/u);
  assert.equal((source.match(/exec 8<>\/dev\/tty/gmu) ?? []).length, 2, "initial approval and generated-address binding need separate TTY gates");
  assert.match(source, /Type UPLOAD-\$new_buffer exactly/u);
  assert.ok(source.indexOf("Type UPLOAD-$new_buffer exactly") > source.indexOf('new_buffer="$(iat_v2_run_keyless_solana'));
  assert.doesNotMatch(source, /read -r -p/u);
  assert.match(source, /exec 9< "\$path"/u);
  assert.match(source, /exec 10< "\$path"/u);
  assert.match(source, /--buffer \/proc\/self\/fd\/10/u);
  assert.match(source, /--buffer-authority \/proc\/self\/fd\/9/u);
  assert.match(source, /--fee-payer \/proc\/self\/fd\/9/u);
  assert.match(source, /protected recovery signer retained/u);
  assert.doesNotMatch(source, /sha256sum[^\n]*buffer-keypair|cat[^\n]*buffer-keypair/u);
});

test("all Solana processes use the isolated no-config wrapper", () => {
  const source = readFileSync(path, "utf8");
  const toolchain = readFileSync("scripts/lib/iat-v2-attended-solana-toolchain.sh", "utf8");
  assert.match(toolchain, /HOME=\/nonexistent\/iat-v2-keyless-solana-home/u);
  assert.match(toolchain, /XDG_CONFIG_HOME=\/nonexistent\/iat-v2-keyless-solana-config/u);
  assert.match(toolchain, /--config \/dev\/null/u);
  assert.match(source, /iat_v2_run_keyless_solana_timeout 900/u);
  assert.match(source, /iat_v2_run_keyless_solana_timeout 45[^\n]*balance[^\n]*--url devnet[^\n]*--commitment finalized/u);
  assert.doesNotMatch(source, /\/usr\/bin\/timeout [0-9]+ "\$SOLANA_BIN"/u);
  const unsafeInvocation = source.split(/\r?\n/u).find((line) => (
    /"\$SOLANA_BIN" (?:address|balance|program)/u.test(line)
    && !/iat_v2_run_keyless_solana(?:_timeout)?/u.test(line)
  ));
  assert.equal(unsafeInvocation, undefined);
});

test("fresh and recovery helpers parse as Bash and reject unsafe launch forms before tooling", (context) => {
  const command = process.platform === "win32"
    ? `${process.env.WINDIR ?? "C:\\Windows"}\\System32\\wsl.exe`
    : "/usr/bin/bash";
  const toWsl = (value) => {
    if (process.platform !== "win32") return value;
    const match = /^([A-Za-z]):[\\/](.*)$/u.exec(value.replaceAll("\\", "/"));
    return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
  };
  const absolute = toWsl(`${process.cwd().replaceAll("\\", "/")}/${path}`);
  const recoveryAbsolute = toWsl(`${process.cwd().replaceAll("\\", "/")}/${recoveryPath}`);
  const syntaxArgs = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/bash", "-n", absolute]
    : ["-n", absolute];
  const syntax = spawnSync(command, syntaxArgs, { encoding: "utf8" });
  if (syntax.error?.code === "ENOENT") return context.skip("Bash runtime unavailable");
  assert.equal(syntax.status, 0, syntax.stderr);
  const recoverySyntaxArgs = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/bash", "-n", recoveryAbsolute]
    : ["-n", recoveryAbsolute];
  const recoverySyntax = spawnSync(command, recoverySyntaxArgs, { encoding: "utf8" });
  assert.equal(recoverySyntax.status, 0, recoverySyntax.stderr);
  const rejectArgs = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/env", "-i", "HOME=/home/a", "LANG=C.UTF-8", "LC_ALL=C.UTF-8", "PATH=/usr/bin:/bin", "/usr/bin/bash", "--noprofile", "--norc", absolute]
    : ["--noprofile", "--norc", absolute];
  const rejected = spawnSync(command, rejectArgs, { encoding: "utf8", env: process.platform === "win32" ? process.env : { HOME: "/home/a", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", PATH: "/usr/bin:/bin" } });
  assert.equal(rejected.status, 1);
  assert.match(`${rejected.stdout}\n${rejected.stderr}`, /use the exact clean Ubuntu-24\.04 WSL2 launcher/u);

  const unexpectedArgs = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/bash", "--noprofile", "--norc", absolute, "one", "two"]
    : ["--noprofile", "--norc", absolute, "one", "two"];
  const unexpected = spawnSync(command, unexpectedArgs, { encoding: "utf8" });
  assert.equal(unexpected.status, 1);
  assert.match(`${unexpected.stdout}\n${unexpected.stderr}`, /unexpected rebuild arguments/u);

  const wrapperArg = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/bash", "--noprofile", "--norc", recoveryAbsolute, "unexpected"]
    : ["--noprofile", "--norc", recoveryAbsolute, "unexpected"];
  const wrapperRejected = spawnSync(command, wrapperArg, { encoding: "utf8" });
  assert.equal(wrapperRejected.status, 1);
  assert.match(`${wrapperRejected.stdout}\n${wrapperRejected.stderr}`, /recovery launcher accepts no arguments/u);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const path = "scripts/rebuild-iat-v2-devnet-buffer-fresh.sh";

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
  assert.match(source, /iat-v2-devnet-buffer-rebuild-reservation\/v1/u);
  assert.match(source, /phase: "RESERVED_BEFORE_UPLOAD"/u);
  assert.match(source, /fsync_recovery_paths "\$buffer_keypair" "\$buffer_address_record" "\$artifact_snapshot" "\$reservation_manifest"[\s\S]*"\$attempt_dir" "\$RECOVERY_ROOT" "\$RECOVERY_PARENT"/u);
  assert.match(source, /openSync\(source, constants\.O_RDONLY \| constants\.O_NOFOLLOW\)/u);
  assert.match(source, /open_exact_private_file "\$artifact_snapshot" 11/u);
  assert.match(source, /assert_bound_artifact_identity 9<&- 10<&-/u);
  assert.match(source, /program write-buffer \/proc\/self\/fd\/11/u);
  assert.doesNotMatch(source, /program write-buffer "\$ARTIFACT"/u);
  assert.match(source, /exec 9<&- 10<&- 11<&-/u);
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

test("fresh-buffer helper parses as Bash and rejects a noncanonical launcher before tooling", (context) => {
  const command = process.platform === "win32"
    ? `${process.env.WINDIR ?? "C:\\Windows"}\\System32\\wsl.exe`
    : "/usr/bin/bash";
  const toWsl = (value) => {
    if (process.platform !== "win32") return value;
    const match = /^([A-Za-z]):[\\/](.*)$/u.exec(value.replaceAll("\\", "/"));
    return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
  };
  const absolute = toWsl(`${process.cwd().replaceAll("\\", "/")}/${path}`);
  const syntaxArgs = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/bash", "-n", absolute]
    : ["-n", absolute];
  const syntax = spawnSync(command, syntaxArgs, { encoding: "utf8" });
  if (syntax.error?.code === "ENOENT") return context.skip("Bash runtime unavailable");
  assert.equal(syntax.status, 0, syntax.stderr);
  const rejectArgs = process.platform === "win32"
    ? ["-d", "Ubuntu-24.04", "-u", "a", "--exec", "/usr/bin/env", "-i", "HOME=/home/a", "LANG=C.UTF-8", "LC_ALL=C.UTF-8", "PATH=/usr/bin:/bin", "/usr/bin/bash", "--noprofile", "--norc", absolute]
    : ["--noprofile", "--norc", absolute];
  const rejected = spawnSync(command, rejectArgs, { encoding: "utf8", env: process.platform === "win32" ? process.env : { HOME: "/home/a", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", PATH: "/usr/bin:/bin" } });
  assert.equal(rejected.status, 1);
  assert.match(`${rejected.stdout}\n${rejected.stderr}`, /use the exact clean Ubuntu-24\.04 WSL2 launcher/u);
});

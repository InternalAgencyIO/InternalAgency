import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS } from "../scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs";

const HELPER_RELATIVE_PATH = "scripts/iat-v2-sealed-exec.py";
const HELPER_WINDOWS_PATH = resolve(HELPER_RELATIVE_PATH);

function toLinuxPath(value) {
  if (process.platform !== "win32") return value;
  const match = /^([A-Za-z]):\\(.*)$/u.exec(value);
  if (!match) throw new Error(`cannot map test path into WSL: ${value}`);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

const HELPER_LINUX_PATH = toLinuxPath(HELPER_WINDOWS_PATH);
const NODE_LINUX_PATH = process.platform === "win32"
  ? "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node"
  : process.execPath;
const SOLANA_LINUX_PATH = "/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana";

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function runLinux(script) {
  const cleanEnvironment = {
    HOME: "/home/a",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    PATH: "/usr/bin:/bin",
  };
  const environmentArguments = Object.entries(cleanEnvironment)
    .map(([name, value]) => `${name}=${value}`);
  if (process.platform === "win32") {
    return spawnSync(
      `${process.env.WINDIR ?? "C:\\Windows"}\\System32\\wsl.exe`,
      [
        "-d",
        "Ubuntu-24.04",
        "-u",
        "a",
        "--exec",
        "/usr/bin/env",
        "-i",
        ...environmentArguments,
        "/usr/bin/bash",
        "--noprofile",
        "--norc",
        "-c",
        script,
      ],
      { encoding: "utf8", windowsHide: true },
    );
  }
  return spawnSync(
    "/usr/bin/env",
    [
      "-i",
      ...environmentArguments,
      "/usr/bin/bash",
      "--noprofile",
      "--norc",
      "-c",
      script,
    ],
    { encoding: "utf8" },
  );
}

const linuxProbe = runLinux([
  "test \"$(/usr/bin/uname -s)\" = Linux",
  "test -x /usr/bin/python3",
  `test -f ${shellQuote(HELPER_LINUX_PATH)}`,
  `test -x ${shellQuote(NODE_LINUX_PATH)}`,
  "test -e /proc/self/fd",
].join(" && "));
const linuxSealingAvailable = linuxProbe.status === 0;
const exactSolanaAvailable = linuxSealingAvailable
  && runLinux(`test -x ${shellQuote(SOLANA_LINUX_PATH)}`).status === 0;

function exactIdentity(binary) {
  return [
    `source=${shellQuote(binary)}`,
    "expected_sha=$(/usr/bin/sha256sum -- \"$source\")",
    "expected_sha=${expected_sha%% *}",
    "expected_bytes=$(/usr/bin/stat -Lc %s -- \"$source\")",
  ].join("; ");
}

function launcherCommand(parts) {
  return parts.join(" ");
}

test("sealed launcher is source-only, dependency-free, and runtime-bound", () => {
  const source = readFileSync(HELPER_RELATIVE_PATH, "utf8");
  assert.match(source, /^#!\/usr\/bin\/python3\n/u);
  assert.match(source, /os\.memfd_create/u);
  assert.match(source, /F_ADD_SEALS/u);
  assert.match(source, /F_SEAL_WRITE/u);
  assert.match(source, /os\.pwrite\(sealed_fd/u);
  assert.match(source, /magic != b"\\x7fELF"/u);
  assert.match(source, /os\.execve\(/u);
  assert.match(source, /os\.listdir\("\/proc\/self\/fd"\)/u);
  assert.match(source, /sys\.flags\.isolated == 1/u);
  assert.match(source, /sys\.flags\.no_site == 1/u);
  assert.doesNotMatch(source, /subprocess|socket|urllib|requests|solana|keypair|wallet/iu);
  assert.equal(IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS.includes(HELPER_RELATIVE_PATH), true);
  assert.deepEqual(
    IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS,
    [...IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS].sort(),
  );
});

test("sealed launcher executes exact Node bytes with explicit argv, env, and FD boundary", {
  skip: !linuxSealingAvailable,
}, () => {
  const target = "const fs=require('node:fs');let fd7='open';"
    + "try{fd7=fs.readlinkSync('/proc/self/fd/7')}catch(error){fd7=error.code}"
    + "console.log(JSON.stringify({argv0:process.argv0,args:process.argv.slice(1),"
    + "env:process.env,exe:fs.readlinkSync('/proc/self/exe'),fd7,"
    + "fd9:fs.fstatSync(9).isCharacterDevice(),fd10:fs.fstatSync(10).isDirectory()}))";
  const command = launcherCommand([
    "exec /usr/bin/python3 -I -S -c \"$helper_source\"",
    "--source-fd 5",
    "--expected-sha256 \"$expected_sha\"",
    "--expected-bytes \"$expected_bytes\"",
    "--env HOME=/home/a",
    "--env LANG=C.UTF-8",
    "--env LC_ALL=C.UTF-8",
    "--env PATH=/usr/bin:/bin",
    "--env IAT_V2_TEST_MARKER=sealed",
    "--inherit-fd 9",
    "--inherit-fd 10",
    `-- sealed-node --eval ${shellQuote(target)} alpha --beta=2`,
  ]);
  const result = runLinux([
    "set -euo pipefail",
    `helper_source=$(/usr/bin/cat -- ${shellQuote(HELPER_LINUX_PATH)}; printf '\\x1f')`,
    "helper_source=${helper_source%$'\\x1f'}",
    exactIdentity(NODE_LINUX_PATH),
    "exec 5<\"$source\"",
    "exec 7</dev/null",
    "exec 9</dev/null",
    "exec 10</usr",
    command,
  ].join("\n"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.argv0, "sealed-node");
  assert.deepEqual(observed.args, ["alpha", "--beta=2"]);
  assert.deepEqual(observed.env, {
    HOME: "/home/a",
    IAT_V2_TEST_MARKER: "sealed",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    PATH: "/usr/bin:/bin",
  });
  assert.match(observed.exe, /^\/memfd:iat-v2-sealed-exec(?: \(deleted\))?$/u);
  assert.notEqual(observed.fd7, "/dev/null");
  assert.equal(observed.fd9, true);
  assert.equal(observed.fd10, true);
});

test("sealed launcher executes exact Agave Solana ELF bytes without network access", {
  skip: !exactSolanaAvailable,
}, () => {
  const command = launcherCommand([
    "exec /usr/bin/python3 -I -S -c \"$helper_source\"",
    "--source-fd 7",
    "--expected-sha256 \"$expected_sha\"",
    "--expected-bytes \"$expected_bytes\"",
    "--env HOME=/nonexistent/iat-v2-keyless-solana-home",
    "--env XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-solana-config",
    "--env LANG=C.UTF-8",
    "--env LC_ALL=C.UTF-8",
    "--env PATH=/usr/bin:/bin",
    "--",
    "solana --version --config /dev/null",
  ]);
  const result = runLinux([
    "set -euo pipefail",
    `helper_source=$(/usr/bin/cat -- ${shellQuote(HELPER_LINUX_PATH)}; printf '\\x1f')`,
    "helper_source=${helper_source%$'\\x1f'}",
    exactIdentity(SOLANA_LINUX_PATH),
    "exec 7<\"$source\"",
    command,
  ].join("\n"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)\n",
  );
});

test("sealed launcher applies effective immutable seals and rehashes the executed image", {
  skip: !linuxSealingAvailable,
}, () => {
  const target = [
    "import fcntl,hashlib,json,os",
    "fd=os.open('/proc/self/exe',os.O_RDONLY)",
    "required=fcntl.F_SEAL_SEAL|fcntl.F_SEAL_SHRINK|fcntl.F_SEAL_GROW|fcntl.F_SEAL_WRITE",
    "seals=fcntl.fcntl(fd,fcntl.F_GET_SEALS)",
    "with open('/proc/self/exe','rb') as image:",
    " payload=image.read()",
    "print(json.dumps({'sealed':seals & required == required,'sha256':hashlib.sha256(payload).hexdigest(),'bytes':len(payload),'exe':os.readlink('/proc/self/exe')}))",
  ].join("\n");
  const command = launcherCommand([
    `exec /usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
    "--source-fd 5",
    "--expected-sha256 \"$expected_sha\"",
    "--expected-bytes \"$expected_bytes\"",
    "--env HOME=/home/a",
    "--env LANG=C.UTF-8",
    "--env LC_ALL=C.UTF-8",
    "--env PATH=/usr/bin:/bin",
    "--",
    `sealed-python -I -S -c ${shellQuote(target)}`,
  ]);
  const result = runLinux([
    "set -euo pipefail",
    exactIdentity("/usr/bin/python3"),
    "exec 5<\"$source\"",
    command,
  ].join("\n"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const observed = JSON.parse(result.stdout);
  const identity = runLinux(`${exactIdentity("/usr/bin/python3")}; printf '%s %s' "$expected_sha" "$expected_bytes"`);
  const [expectedSha256, expectedBytes] = identity.stdout.trim().split(" ");
  assert.equal(observed.sealed, true);
  assert.equal(observed.sha256, expectedSha256);
  assert.equal(observed.bytes, Number(expectedBytes));
  assert.match(observed.exe, /^\/memfd:iat-v2-sealed-exec(?: \(deleted\))?$/u);
});

test("sealed launcher rejects shebang images instead of resolving a mutable interpreter", {
  skip: !linuxSealingAvailable,
}, () => {
  const command = launcherCommand([
    `exec /usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
    "--source-fd 5",
    "--expected-sha256 \"$expected_sha\"",
    "--expected-bytes \"$expected_bytes\"",
    "--env HOME=/home/a",
    "--env LANG=C.UTF-8",
    "--env LC_ALL=C.UTF-8",
    "--env PATH=/usr/bin:/bin",
    "--",
    "sealed-which sh",
  ]);
  const result = runLinux([
    "set -euo pipefail",
    exactIdentity("/usr/bin/which"),
    "exec 5<\"$source\"",
    command,
  ].join("\n"));
  assert.equal(result.status, 126);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^HOLD: source executable is not an ELF image\n$/u);
});

test("sealed launcher rejects identity drift, loader injection, and ambiguous FD inheritance", {
  skip: !linuxSealingAvailable,
}, () => {
  const nonIsolated = runLinux(
    `/usr/bin/python3 ${shellQuote(HELPER_LINUX_PATH)} --help`,
  );
  assert.equal(nonIsolated.status, 126);
  assert.equal(nonIsolated.stdout, "");
  assert.match(nonIsolated.stderr, /requires Python -I -S/u);

  const base = [
    "source=/usr/bin/printf",
    "expected_bytes=$(/usr/bin/stat -Lc %s -- \"$source\")",
    "exec 5<\"$source\"",
  ];
  const wrongHash = runLinux([
    ...base,
    launcherCommand([
      `exec /usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
      "--source-fd 5",
      `--expected-sha256 ${"0".repeat(64)}`,
      "--expected-bytes \"$expected_bytes\"",
      "-- should-not-run SENTINEL",
    ]),
  ].join("; "));
  assert.equal(wrongHash.status, 126);
  assert.equal(wrongHash.stdout, "");
  assert.match(wrongHash.stderr, /^HOLD: source executable SHA-256 did not match\n$/u);

  const loaderInjection = runLinux([
    ...base,
    "expected_sha=$(/usr/bin/sha256sum -- \"$source\")",
    "expected_sha=${expected_sha%% *}",
    launcherCommand([
      `exec /usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
      "--source-fd 5",
      "--expected-sha256 \"$expected_sha\"",
      "--expected-bytes \"$expected_bytes\"",
      "--env LD_PRELOAD=/tmp/not-admitted.so",
      "-- should-not-run SENTINEL",
    ]),
  ].join("; "));
  assert.equal(loaderInjection.status, 126);
  assert.equal(loaderInjection.stdout, "");
  assert.match(loaderInjection.stderr, /environment name can alter executable loading/u);

  const sourceInheritance = runLinux([
    ...base,
    "expected_sha=$(/usr/bin/sha256sum -- \"$source\")",
    "expected_sha=${expected_sha%% *}",
    launcherCommand([
      `exec /usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
      "--source-fd 5",
      "--expected-sha256 \"$expected_sha\"",
      "--expected-bytes \"$expected_bytes\"",
      "--inherit-fd 5",
      "-- should-not-run SENTINEL",
    ]),
  ].join("; "));
  assert.equal(sourceInheritance.status, 126);
  assert.equal(sourceInheritance.stdout, "");
  assert.match(sourceInheritance.stderr, /source descriptor cannot be inherited/u);

  const aliasedSourceInheritance = runLinux([
    ...base,
    "expected_sha=$(/usr/bin/sha256sum -- \"$source\")",
    "expected_sha=${expected_sha%% *}",
    "exec 9<&5",
    launcherCommand([
      `exec /usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
      "--source-fd 5",
      "--expected-sha256 \"$expected_sha\"",
      "--expected-bytes \"$expected_bytes\"",
      "--inherit-fd 9",
      "-- should-not-run SENTINEL",
    ]),
  ].join("; "));
  assert.equal(aliasedSourceInheritance.status, 126);
  assert.equal(aliasedSourceInheritance.stdout, "");
  assert.match(aliasedSourceInheritance.stderr, /aliases the source executable/u);

  const standardSourceAlias = runLinux([
    ...base,
    "expected_sha=$(/usr/bin/sha256sum -- \"$source\")",
    "expected_sha=${expected_sha%% *}",
    "exec 0<&5",
    launcherCommand([
      `exec /usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
      "--source-fd 5",
      "--expected-sha256 \"$expected_sha\"",
      "--expected-bytes \"$expected_bytes\"",
      "-- should-not-run SENTINEL",
    ]),
  ].join("; "));
  assert.equal(standardSourceAlias.status, 126);
  assert.equal(standardSourceAlias.stdout, "");
  assert.match(standardSourceAlias.stderr, /standard descriptor aliases the source executable/u);

  const oversizedDescriptor = runLinux(launcherCommand([
    `/usr/bin/python3 -I -S ${shellQuote(HELPER_LINUX_PATH)}`,
    `--source-fd ${2n ** 63n - 1n}`,
    `--expected-sha256 ${"0".repeat(64)}`,
    "--expected-bytes 1",
    "-- should-not-run SENTINEL",
  ]));
  assert.equal(oversizedDescriptor.status, 126);
  assert.equal(oversizedDescriptor.stdout, "");
  assert.match(oversizedDescriptor.stderr, /source descriptor exceeds the supported range/u);
  assert.doesNotMatch(oversizedDescriptor.stderr, /Traceback/u);
});

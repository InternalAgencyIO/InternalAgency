import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  chmodSync,
  linkSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  HandoffCasError,
  IAT_V2_HANDOFF_CAS_ROOT_SENTINEL,
  inspectHandoffReservation,
  reserveHandoffMutation,
} from "../scripts/iat-v2-devnet-buffer-handoff-cas.mjs";

const sentinelText = `${JSON.stringify(IAT_V2_HANDOFF_CAS_ROOT_SENTINEL, null, 2)}\n`;

function provision() {
  const parent = mkdtempSync(join(homedir(), ".iat-v2-cas-parent-"));
  const root = join(parent, "devnet-buffer-handoff-v1");
  const attempts = join(root, "attempts");
  chmodSync(parent, 0o700);
  mkdirSync(root, { mode: 0o700 });
  mkdirSync(attempts, { mode: 0o700 });
  const sentinel = join(root, ".iat-v2-devnet-buffer-authority-cas-root.json");
  writeFileSync(sentinel, sentinelText, { mode: 0o600 });
  chmodSync(sentinel, 0o600);
  return { parent, root, attempts, sentinel };
}

function options(root) {
  return {
    root,
    buffer: "Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6",
    "from-authority": "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4",
    "to-authority": "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
    "artifact-sha256": "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
    "artifact-bytes": "649680",
    "evidence-manifest-sha256": "9f8fe145af01d7eff1de7ddc27b1dc409f5ffecc6f440bf1d335fc7bd63d71a1",
    "source-head-commit": "e6f1041abde0d70f0055ef4f7bc333f4271f37aa",
    "source-head-tree": "d92c532f41dacf04e8d5f1f13b261b963d05f001",
    "ci-run-id": "33146434415",
    "ci-run-attempt": "1",
    "node-path": "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node",
    "node-version": "v24.19.0",
    "node-sha256": "bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12",
    "node-bytes": "125989464",
    "git-path": "/mnt/c/Program Files/Git/mingw64/bin/git.exe",
    "git-version": "git version 2.55.0.windows.3",
    "git-sha256": "1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9",
    "git-bytes": "4383048",
    "devnet-genesis-hash": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    "solana-cli-path": "/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana",
    "solana-cli-version": "solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)",
    "solana-cli-sha256": "aacc6871e8ff199608987f0364f2ed9e239a32e1e0548f1ae4477e0e533e1dea",
    "solana-cli-bytes": "28546968",
  };
}

test("CAS requires its exact secure parent/root/sentinel and exact reviewed identity", () => {
  const fixture = provision();
  try {
    const exact = options(fixture.root);
    assert.equal(inspectHandoffReservation(exact, { expectedRoot: fixture.root }).status, "AVAILABLE");
    if (process.platform !== "win32") {
      const sentinelAlias = join(fixture.root, "sentinel-alias.json");
      linkSync(fixture.sentinel, sentinelAlias);
      assert.throws(
        () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_SENTINEL_HOLD",
      );
      unlinkSync(sentinelAlias);
    }
    for (const drift of [
      { "artifact-sha256": "8".repeat(64) },
      { "artifact-bytes": "649681" },
      { "source-head-commit": "3".repeat(40) },
      { "ci-run-id": "33029576921" },
      { "node-sha256": "4".repeat(64) },
      { "git-sha256": "5".repeat(64) },
      { "devnet-genesis-hash": "11111111111111111111111111111111" },
    ]) {
      assert.throws(
        () => inspectHandoffReservation({ ...exact, ...drift }, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_INPUT_HOLD",
      );
    }
    chmodSync(fixture.parent, 0o755);
    if (process.platform !== "win32") {
      assert.throws(
        () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_HOLD",
      );
    }
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("CAS reservation is durable, immutable, and malformed partial records remain HOLD", () => {
  const fixture = provision();
  try {
    const exact = options(fixture.root);
    const created = reserveHandoffMutation(exact, {
      expectedRoot: fixture.root,
      now: () => new Date("2026-08-27T00:00:00.000Z"),
    });
    assert.equal(created.status, "RESERVED_CREATED");
    assert.equal(created.mutationMayRun, true);
    const original = readFileSync(created.recordPath, "utf8");
    assert.equal(reserveHandoffMutation(exact, { expectedRoot: fixture.root }).status, "RESERVED_EXISTING");
    assert.equal(readFileSync(created.recordPath, "utf8"), original);
    if (process.platform !== "win32") {
      const recordAlias = join(fixture.root, "record-alias.json");
      linkSync(created.recordPath, recordAlias);
      assert.throws(
        () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
        (error) => error instanceof HandoffCasError && error.code === "CAS_RECORD_HOLD",
      );
      unlinkSync(recordAlias);
    }
    writeFileSync(created.recordPath, '{"partial":', "utf8");
    assert.throws(
      () => inspectHandoffReservation(exact, { expectedRoot: fixture.root }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_RECORD_HOLD",
    );
    assert.throws(
      () => reserveHandoffMutation(exact, { expectedRoot: fixture.root }),
      (error) => error instanceof HandoffCasError && error.code === "CAS_CREATION_INDETERMINATE_HOLD",
    );
    assert.equal(readFileSync(created.recordPath, "utf8"), '{"partial":');
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("two separate Node processes can create at most one reservation", async () => {
  const fixture = provision();
  try {
    const helperUrl = pathToFileURL(resolve("scripts/iat-v2-devnet-buffer-handoff-cas.mjs")).href;
    const worker = join(fixture.parent, "worker.mjs");
    writeFileSync(worker, `
      import { reserveHandoffMutation } from ${JSON.stringify(helperUrl)};
      const value = JSON.parse(Buffer.from(process.argv[2], "base64url").toString("utf8"));
      const result = reserveHandoffMutation(value.options, {
        expectedRoot: value.root,
        now: () => new Date("2026-08-27T01:02:03.000Z"),
      });
      process.stdout.write(JSON.stringify(result));
    `, "utf8");
    const payload = Buffer.from(JSON.stringify({ root: fixture.root, options: options(fixture.root) })).toString("base64url");
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
      !["BASH_ENV", "ENV", "LD_LIBRARY_PATH", "LD_PRELOAD", "NODE_OPTIONS", "NODE_PATH"].includes(name)
      && !name.startsWith("GIT_")
    )));
    const run = () => new Promise((resolveChild, rejectChild) => {
      const child = spawn(process.execPath, [worker, payload], { env, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", rejectChild);
      child.on("close", (code) => resolveChild({ code, stdout, stderr }));
    });
    const children = await Promise.all([run(), run()]);
    for (const child of children) assert.equal(child.code, 0, child.stderr);
    const statuses = children.map((child) => JSON.parse(child.stdout).status).sort();
    assert.deepEqual(statuses, ["RESERVED_CREATED", "RESERVED_EXISTING"]);
    assert.equal(inspectHandoffReservation(options(fixture.root), { expectedRoot: fixture.root }).status, "RESERVED_EXISTING");
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
});

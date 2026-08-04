import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { readCanonicalTrackedFile } from "../scripts/lib/read-canonical-tracked-file.mjs";

const git = (repoRoot, args) => execFileSync("git", args, {
  cwd: repoRoot,
  encoding: "utf8",
  windowsHide: true,
});

test("canonical tracked reads ignore checkout-only CRLF conversion but preserve real edits", () => {
  const repoRoot = mkdtempSync(resolve(tmpdir(), "iat-canonical-tracked-"));
  const artifactPath = resolve(repoRoot, "artifact.md");
  try {
    git(repoRoot, ["init"]);
    git(repoRoot, ["config", "user.name", "IAT QA"]);
    git(repoRoot, ["config", "user.email", "iat-qa@example.invalid"]);
    git(repoRoot, ["config", "core.autocrlf", "true"]);
    writeFileSync(artifactPath, "alpha\nbeta\n", "utf8");
    git(repoRoot, ["add", "artifact.md"]);
    git(repoRoot, ["commit", "-m", "fixture"]);

    writeFileSync(artifactPath, "alpha\r\nbeta\r\n", "utf8");
    assert.equal(spawnSync("git", ["diff", "--quiet", "--", "artifact.md"], { cwd: repoRoot }).status, 0);
    assert.notDeepEqual(readFileSync(artifactPath), Buffer.from("alpha\nbeta\n"));
    assert.deepEqual(
      readCanonicalTrackedFile({ repoRoot, absolutePath: artifactPath }),
      Buffer.from("alpha\nbeta\n"),
    );

    const changedBytes = Buffer.from("alpha\r\ngamma\r\n");
    writeFileSync(artifactPath, changedBytes);
    assert.notEqual(spawnSync("git", ["diff", "--quiet", "--", "artifact.md"], { cwd: repoRoot }).status, 0);
    assert.deepEqual(readCanonicalTrackedFile({ repoRoot, absolutePath: artifactPath }), changedBytes);

    git(repoRoot, ["add", "artifact.md"]);
    assert.deepEqual(readCanonicalTrackedFile({ repoRoot, absolutePath: artifactPath }), changedBytes);
    writeFileSync(artifactPath, "alpha\r\ndelta\r\n", "utf8");
    assert.throws(
      () => readCanonicalTrackedFile({ repoRoot, absolutePath: artifactPath }),
      /index and worktree differ/u,
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

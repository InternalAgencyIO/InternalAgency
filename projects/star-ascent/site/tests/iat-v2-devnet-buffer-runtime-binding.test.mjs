import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";

import {
  IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH,
  IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS,
  observeIatV2DevnetBufferRuntimeClosure,
  resolveIatV2WslLinkedWorktreeAdministration,
  verifyIatV2DevnetBufferRuntimeBinding,
} from "../scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs";

const LIMITATIONS = Object.freeze([
  "Source and public-CI binding only; not a Devnet buffer upload, signature, transaction, authority handoff, or deployment result.",
  "Does not authorize signing, broadcast, funding, deployment, release, or Mainnet.",
  "Root-owned Ubuntu 24.04 OS runtime, including Bash, system utilities, loaders, shared libraries, and Python standard-library/runtime modules, plus the WSL kernel and procfs, are trusted but not individually SHA-256-bound by this source closure.",
]);

const UNBOUND_BINDING = Object.freeze({
  artifactBytes: 649_680,
  artifactSha256: "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
  checkoutCommit: null,
  checkoutRelation: "PR_MERGE_SECOND_PARENT",
  checkoutTree: null,
  ciRunAttempt: null,
  ciRunId: null,
  evidenceManifestSha256: null,
  limitations: LIMITATIONS,
  mainnetStatus: "HOLD",
  network: "devnet",
  repository: "InternalAgencyIO/InternalAgency",
  repositoryId: 1_313_660_798,
  runnerArch: "X64",
  runnerOs: "Linux",
  runtimeClosureSha256: null,
  schema: "iat-v2-devnet-buffer-runtime-binding/v1",
  sourceHeadCommit: null,
  sourceHeadTree: null,
  status: "UNBOUND",
  workflowEvent: "pull_request",
  workflowRef: null,
});

test("runtime closure binds the attended handoff and both durable CAS modules", () => {
  assert.deepEqual(
    IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS,
    [...IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS].sort(),
    "runtime closure paths must remain in exact code-unit order",
  );
  assert.equal(new Set(IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS).size, IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS.length);
  for (const path of [
    "scripts/handoff-iat-v2-devnet-buffer.sh",
    "scripts/iat-v2-devnet-buffer-handoff-cas.mjs",
    "scripts/iat-v2-sealed-exec.py",
    "scripts/initialize-iat-v2-devnet-buffer-handoff-cas.mjs",
    "scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs",
  ]) assert.equal(IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS.includes(path), true, `${path} must be runtime-bound`);
});

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function canonicalJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function runGit(cwd, args, { input } = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

function reviewedGit(projectRoot, args) {
  return runGit(projectRoot, args);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function createLinkedWorktreeAdministrationFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "iat-v2-linked-worktree-"));
  const windowsMountRoot = join(fixtureRoot, "mnt");
  const driveRoot = join(windowsMountRoot, "c");
  const repositoryRoot = join(driveRoot, "repository");
  const workTree = join(driveRoot, "reviewed-worktree");
  mkdirSync(repositoryRoot, { recursive: true });
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "user.email", "linked-worktree-test@internalagency.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Linked Worktree Test"]);
  write(join(repositoryRoot, "fixture.txt"), "linked worktree fixture\n");
  commitAll(repositoryRoot, "linked worktree base");
  runGit(repositoryRoot, ["worktree", "add", "--quiet", "-b", "reviewed-linked-worktree", workTree]);

  const originalPointer = readFileSync(join(workTree, ".git"), "utf8");
  const originalMatch = /^gitdir: (\/[^\r\n]+)\n$/u.exec(originalPointer);
  assert.ok(originalMatch, "test Git must create one canonical POSIX linked-worktree pointer");
  const expectedGitDirectory = originalMatch[1];
  const expectedCommonDirectory = join(repositoryRoot, ".git");
  const gitDirectoryRelative = relative(driveRoot, expectedGitDirectory).replaceAll("\\", "/");
  const workTreeRelative = relative(driveRoot, workTree).replaceAll("\\", "/");
  writeFileSync(join(workTree, ".git"), `gitdir: C:/${gitDirectoryRelative}\n`);
  writeFileSync(join(expectedGitDirectory, "gitdir"), `C:/${workTreeRelative}/.git\n`);
  const config = readFileSync(join(expectedCommonDirectory, "config"));
  const options = Object.freeze({
    expectedCommonDirectory,
    expectedGitConfigBytes: config.length,
    expectedGitConfigSha256: sha256(config),
    expectedGitDirectory,
    windowsMountRoot,
    workTree,
  });
  return {
    driveRoot,
    fixtureRoot,
    options,
    repositoryRoot,
    workTree,
  };
}

function withLinkedWorktreeAdministrationFixture(callback) {
  const fixture = createLinkedWorktreeAdministrationFixture();
  try {
    return callback(fixture);
  } finally {
    rmSync(fixture.fixtureRoot, { recursive: true, force: true });
  }
}

test("resolves a canonical Windows-form linked-worktree pointer for explicit root Git administration", {
  skip: process.platform !== "linux",
}, () => {
  withLinkedWorktreeAdministrationFixture((fixture) => {
    const administration = resolveIatV2WslLinkedWorktreeAdministration(fixture.options);
    assert.deepEqual(administration, {
      commonDirectory: fixture.options.expectedCommonDirectory,
      gitDirectory: fixture.options.expectedGitDirectory,
      objectDirectory: join(fixture.options.expectedCommonDirectory, "objects"),
      workTree: fixture.workTree,
    });
    assert.equal(
      runGit(fixture.workTree, [
        `--git-dir=${administration.gitDirectory}`,
        `--work-tree=${administration.workTree}`,
        "rev-parse",
        "HEAD",
      ]),
      runGit(fixture.repositoryRoot, ["rev-parse", "reviewed-linked-worktree"]),
    );
  });
});

for (const [label, pointer] of [
  ["relative", "gitdir: ../repository/.git/worktrees/reviewed-worktree\n"],
  ["backslash", "gitdir: C:\\repository\\.git\\worktrees\\reviewed-worktree\n"],
  ["lowercase drive", "gitdir: c:/repository/.git/worktrees/reviewed-worktree\n"],
  ["dot-segment escape", "gitdir: C:/repository/../outside\n"],
  ["extra line", "gitdir: C:/repository/.git/worktrees/reviewed-worktree\nsecond line\n"],
]) {
  test(`holds a ${label} linked-worktree .git pointer`, { skip: process.platform !== "linux" }, () => {
    withLinkedWorktreeAdministrationFixture((fixture) => {
      writeFileSync(join(fixture.workTree, ".git"), pointer);
      assertHold(
        () => resolveIatV2WslLinkedWorktreeAdministration(fixture.options),
        "RUNTIME_BINDING_GIT_HOLD",
      );
    });
  });
}

test("holds a canonical Windows-form pointer to an outside administration directory", {
  skip: process.platform !== "linux",
}, () => {
  withLinkedWorktreeAdministrationFixture((fixture) => {
    mkdirSync(join(fixture.driveRoot, "outside"));
    writeFileSync(join(fixture.workTree, ".git"), "gitdir: C:/outside\n");
    assertHold(
      () => resolveIatV2WslLinkedWorktreeAdministration(fixture.options),
      "RUNTIME_BINDING_GIT_HOLD",
    );
  });
});

test("holds a linked-worktree administration backpointer that is not exact and reciprocal", {
  skip: process.platform !== "linux",
}, () => {
  withLinkedWorktreeAdministrationFixture((fixture) => {
    writeFileSync(join(fixture.options.expectedGitDirectory, "gitdir"), "../reviewed-worktree/.git\n");
    assertHold(
      () => resolveIatV2WslLinkedWorktreeAdministration(fixture.options),
      "RUNTIME_BINDING_GIT_HOLD",
    );
  });
});

test("holds repository config drift and object alternates before root Git runs", {
  skip: process.platform !== "linux",
}, () => {
  withLinkedWorktreeAdministrationFixture((fixture) => {
    writeFileSync(join(fixture.options.expectedCommonDirectory, "config"), "[filter \"hostile\"]\n\tprocess = arbitrary-command\n", { flag: "a" });
    assertHold(
      () => resolveIatV2WslLinkedWorktreeAdministration(fixture.options),
      "RUNTIME_BINDING_GIT_HOLD",
    );
  });
  withLinkedWorktreeAdministrationFixture((fixture) => {
    write(join(fixture.options.expectedCommonDirectory, "objects", "info", "alternates"), "/unreviewed/objects\n");
    assertHold(
      () => resolveIatV2WslLinkedWorktreeAdministration(fixture.options),
      "RUNTIME_BINDING_GIT_HOLD",
    );
  });
  for (const path of ["info/grafts", "shallow"]) {
    withLinkedWorktreeAdministrationFixture((fixture) => {
      write(join(fixture.options.expectedCommonDirectory, path), "unreviewed topology override\n");
      assertHold(
        () => resolveIatV2WslLinkedWorktreeAdministration(fixture.options),
        "RUNTIME_BINDING_GIT_HOLD",
      );
    });
  }
});

function commitAll(repositoryRoot, message) {
  runGit(repositoryRoot, ["add", "--all"]);
  runGit(repositoryRoot, ["commit", "--quiet", "--message", message]);
  return runGit(repositoryRoot, ["rev-parse", "HEAD"]);
}

function createSourceFixture() {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "iat-v2-runtime-binding-"));
  const projectRoot = join(repositoryRoot, "projects", "star-ascent", "site");
  const anchorPath = join(projectRoot, IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH);

  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "user.email", "runtime-binding-test@internalagency.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Runtime Binding Test"]);
  runGit(repositoryRoot, ["config", "core.filemode", "true"]);
  write(join(repositoryRoot, ".fixture-base"), "runtime binding fixture base\n");
  const baseCommit = commitAll(repositoryRoot, "fixture base");

  for (const [index, path] of IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS.entries()) {
    write(join(projectRoot, path), `reviewed runtime closure fixture ${index}: ${path}\n`);
  }
  write(anchorPath, canonicalJson(UNBOUND_BINDING));
  const sourceHeadCommit = commitAll(repositoryRoot, "reviewed runtime source");
  const sourceHeadTree = runGit(repositoryRoot, ["rev-parse", `${sourceHeadCommit}^{tree}`]);
  const closure = observeIatV2DevnetBufferRuntimeClosure({
    projectRoot,
    sourceHeadCommit,
    git: reviewedGit,
  });

  // Model the public pull-request checkout as a merge commit whose second
  // parent is the reviewed source, without moving the fixture worktree to it.
  const checkoutCommit = runGit(
    repositoryRoot,
    ["commit-tree", sourceHeadTree, "-p", baseCommit, "-p", sourceHeadCommit],
    { input: "fixture public CI merge checkout\n" },
  );
  const checkoutTree = runGit(repositoryRoot, ["rev-parse", `${checkoutCommit}^{tree}`]);

  return {
    anchorPath,
    checkoutCommit,
    checkoutTree,
    closure,
    projectRoot,
    repositoryRoot,
    sourceHeadCommit,
    sourceHeadTree,
  };
}

function bindFixture(fixture, {
  bindingOverrides = {},
  extraSuccessorPath = null,
  executableAnchor = false,
} = {}) {
  const binding = {
    ...UNBOUND_BINDING,
    checkoutCommit: fixture.checkoutCommit,
    checkoutTree: fixture.checkoutTree,
    ciRunAttempt: 1,
    ciRunId: 33_029_576_920,
    evidenceManifestSha256: "31ac038476e72c964f79a29bae5090aa7172f7013cc5454a0b96f9b343d0186b",
    runtimeClosureSha256: fixture.closure.runtimeClosureSha256,
    sourceHeadCommit: fixture.sourceHeadCommit,
    sourceHeadTree: fixture.sourceHeadTree,
    status: "BOUND",
    workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
    ...bindingOverrides,
  };
  write(fixture.anchorPath, canonicalJson(binding));
  if (extraSuccessorPath) {
    write(join(fixture.repositoryRoot, extraSuccessorPath), "forbidden binding-successor scope expansion\n");
  }
  runGit(fixture.repositoryRoot, ["add", "--all"]);
  if (executableAnchor) {
    const repositoryAnchorPath = `projects/star-ascent/site/${IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH}`;
    runGit(fixture.repositoryRoot, ["update-index", "--chmod=+x", "--", repositoryAnchorPath]);
  }
  const bindingSuccessorCommit = runGit(fixture.repositoryRoot, [
    "commit",
    "--quiet",
    "--message",
    "bind reviewed runtime evidence",
  ]);
  return { binding, bindingSuccessorCommit };
}

function withFixture(callback) {
  const fixture = createSourceFixture();
  try {
    return callback(fixture);
  } finally {
    rmSync(fixture.repositoryRoot, { recursive: true, force: true });
  }
}

function assertHold(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.equal(error?.name, "IatV2DevnetBufferRuntimeBindingError");
    assert.equal(error?.code, expectedCode);
    return true;
  });
}

test("accepts one canonical anchor-only B commit directly after reviewed source S", () => {
  withFixture((fixture) => {
    bindFixture(fixture);
    const observed = verifyIatV2DevnetBufferRuntimeBinding({
      projectRoot: fixture.projectRoot,
      git: reviewedGit,
    });

    assert.equal(observed.status, "BOUND");
    assert.equal(observed.network, "devnet");
    assert.equal(observed.mainnetStatus, "HOLD");
    assert.equal(observed.sourceHeadCommit, fixture.sourceHeadCommit);
    assert.equal(observed.runtimeClosureSha256, fixture.closure.runtimeClosureSha256);
    assert.deepEqual(observed.runtimeClosureEntries, fixture.closure.entries);
    assert.equal(fixture.closure.entries.length, IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS.length);
    assert.equal(fixture.closure.entries.every((entry) => (
      Number.isSafeInteger(entry.bytes)
        && entry.bytes > 0
        && /^[0-9a-f]{64}$/u.test(entry.sha256)
    )), true);
    assert.equal(observed.bindingSuccessorCommit, runGit(fixture.repositoryRoot, ["rev-parse", "HEAD"]));
    assert.equal(observed.relation, "DIRECT_BINDING_ONLY_SUCCESSOR");
    assert.equal(observed.transactionExecution, false);
    assert.equal(observed.signing, false);
    assert.equal(observed.broadcast, false);
    assert.equal(observed.mainnetAuthorized, false);
  });
});

test("holds an UNBOUND source checkout", () => {
  withFixture((fixture) => {
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_UNBOUND_HOLD",
    );
  });
});

test("holds a binding successor that commits any path beyond the canonical anchor", () => {
  withFixture((fixture) => {
    bindFixture(fixture, { extraSuccessorPath: "forbidden-successor-file.txt" });
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_SUCCESSOR_HOLD",
    );
  });
});

test("holds a two-hop checkout even when the first successor was anchor-only", () => {
  withFixture((fixture) => {
    bindFixture(fixture);
    write(join(fixture.repositoryRoot, "second-successor.txt"), "a second successor is not the reviewed B commit\n");
    commitAll(fixture.repositoryRoot, "forbidden second successor");
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_SUCCESSOR_HOLD",
    );
  });
});

test("ignores replacement commits when proving the exact S to B parent relation", () => {
  withFixture((fixture) => {
    bindFixture(fixture);
    const bindingSuccessor = runGit(fixture.repositoryRoot, ["rev-parse", "HEAD"]);
    const bindingTree = runGit(fixture.repositoryRoot, ["rev-parse", "HEAD^{tree}"]);
    const sourceParent = runGit(fixture.repositoryRoot, ["rev-parse", `${fixture.sourceHeadCommit}^`]);
    const replacementCommit = runGit(
      fixture.repositoryRoot,
      ["commit-tree", bindingTree, "-p", sourceParent],
      { input: "hostile replacement commit\n" },
    );
    runGit(fixture.repositoryRoot, ["replace", bindingSuccessor, replacementCommit]);
    const replacementAwareParents = runGit(fixture.repositoryRoot, [
      "rev-list",
      "--parents",
      "-n",
      "1",
      "HEAD",
    ]).split(" ");
    assert.equal(replacementAwareParents[0], bindingSuccessor);
    assert.equal(replacementAwareParents[1], sourceParent);
    assert.notEqual(replacementAwareParents[1], fixture.sourceHeadCommit);

    const observed = verifyIatV2DevnetBufferRuntimeBinding({
      projectRoot: fixture.projectRoot,
      git: reviewedGit,
    });
    assert.equal(observed.bindingSuccessorCommit, bindingSuccessor);
    assert.equal(observed.sourceHeadCommit, fixture.sourceHeadCommit);
    assert.equal(observed.relation, "DIRECT_BINDING_ONLY_SUCCESSOR");
  });
});

test("holds a source-tree scalar that does not identify the bound source commit tree", () => {
  withFixture((fixture) => {
    bindFixture(fixture, { bindingOverrides: { sourceHeadTree: "0".repeat(40) } });
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_SOURCE_HOLD",
    );
  });
});

test("holds a CI checkout tree scalar that does not identify the bound checkout commit tree", () => {
  withFixture((fixture) => {
    bindFixture(fixture, { bindingOverrides: { checkoutTree: "0".repeat(40) } });
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_CHECKOUT_HOLD",
    );
  });
});

test("holds a checkout that is not a two-parent PR merge with source S as second parent", () => {
  withFixture((fixture) => {
    bindFixture(fixture, {
      bindingOverrides: {
        checkoutCommit: fixture.sourceHeadCommit,
        checkoutTree: fixture.sourceHeadTree,
      },
    });
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_CHECKOUT_HOLD",
    );
  });
});

test("holds a runtime closure digest that does not replay from source S", () => {
  withFixture((fixture) => {
    bindFixture(fixture, { bindingOverrides: { runtimeClosureSha256: "0".repeat(64) } });
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_CLOSURE_HOLD",
    );
  });
});

test("holds noncanonical JSON, including a duplicate field", () => {
  withFixture((fixture) => {
    bindFixture(fixture);
    const canonical = readFileSync(fixture.anchorPath, "utf8");
    write(fixture.anchorPath, canonical.replace(/^\{\n/u, "{\n  \"artifactBytes\": 649680,\n"));
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_ANCHOR_HOLD",
    );
  });
});

test("holds a symlinked runtime binding anchor", (context) => {
  withFixture((fixture) => {
    bindFixture(fixture);
    const target = join(fixture.projectRoot, "runtime-binding-target.json");
    write(target, readFileSync(fixture.anchorPath));
    unlinkSync(fixture.anchorPath);
    try {
      symlinkSync(target, fixture.anchorPath, "file");
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") {
        context.skip(`filesystem does not permit test symlinks: ${error.code}`);
        return;
      }
      throw error;
    }
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_ANCHOR_HOLD",
    );
  });
});

test("holds a committed executable-mode anchor", () => {
  withFixture((fixture) => {
    bindFixture(fixture, { executableAnchor: true });
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_ANCHOR_HOLD",
    );
  });
});

for (const drift of ["unstaged", "staged", "deleted"]) {
  test(`holds ${drift} runtime-closure worktree drift after B`, () => {
    withFixture((fixture) => {
      bindFixture(fixture);
      const closurePath = join(fixture.projectRoot, IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS[0]);
      const originalBytes = readFileSync(closurePath);
      if (drift === "deleted") {
        unlinkSync(closurePath);
      } else {
        write(closurePath, `${drift} runtime closure drift\n`);
        if (drift === "staged") {
          runGit(fixture.repositoryRoot, ["add", "--", `projects/star-ascent/site/${IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS[0]}`]);
          writeFileSync(closurePath, originalBytes);
        }
      }
      assertHold(
        () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
        drift === "staged" ? "RUNTIME_BINDING_WORKTREE_HOLD" : "RUNTIME_BINDING_CLOSURE_HOLD",
      );
    });
  });
}

test("holds raw working-byte drift when Git's clean-filter and index view report the path clean", () => {
  withFixture((fixture) => {
    bindFixture(fixture);
    const relativeClosurePath = IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS[0];
    const repositoryClosurePath = `projects/star-ascent/site/${relativeClosurePath}`;
    const closurePath = join(fixture.projectRoot, relativeClosurePath);
    runGit(fixture.repositoryRoot, [
      "config",
      "filter.runtime-binding-test.clean",
      "sed 's/^altered /reviewed /'",
    ]);
    runGit(fixture.repositoryRoot, ["config", "filter.runtime-binding-test.smudge", "cat"]);
    runGit(fixture.repositoryRoot, ["config", "filter.runtime-binding-test.required", "true"]);
    write(
      join(fixture.repositoryRoot, ".git", "info", "attributes"),
      `${repositoryClosurePath} filter=runtime-binding-test\n`,
    );
    const sourceText = readFileSync(closurePath, "utf8");
    assert.match(sourceText, /^reviewed /u);
    writeFileSync(closurePath, sourceText.replace(/^reviewed /u, "altered "));
    assert.equal(
      runGit(fixture.repositoryRoot, ["check-attr", "filter", "--", repositoryClosurePath]),
      `${repositoryClosurePath}: filter: runtime-binding-test`,
    );
    assert.equal(
      runGit(fixture.repositoryRoot, ["hash-object", "--path", repositoryClosurePath, "--", repositoryClosurePath]),
      runGit(fixture.repositoryRoot, ["rev-parse", `${fixture.sourceHeadCommit}:${repositoryClosurePath}`]),
      "the configured clean filter must normalize the hostile working bytes to source S",
    );
    runGit(fixture.repositoryRoot, ["update-index", "--assume-unchanged", "--", repositoryClosurePath]);
    assert.equal(runGit(fixture.repositoryRoot, [
      "status",
      "--porcelain=v1",
      "--",
      repositoryClosurePath,
    ]), "", "Git's filter-aware status should demonstrate the bypass precondition");
    assertHold(
      () => verifyIatV2DevnetBufferRuntimeBinding({ projectRoot: fixture.projectRoot, git: reviewedGit }),
      "RUNTIME_BINDING_CLOSURE_HOLD",
    );
  });
});

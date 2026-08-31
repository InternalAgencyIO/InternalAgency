import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
import { dirname, join } from "node:path";
import test from "node:test";

import {
  IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH,
  IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS,
  observeIatV2DevnetBufferRuntimeClosure,
  verifyIatV2DevnetBufferRuntimeBinding,
} from "../scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs";

const LIMITATIONS = Object.freeze([
  "Source and public-CI binding only; not a Devnet buffer upload, signature, transaction, authority handoff, or deployment result.",
  "Does not authorize signing, broadcast, funding, deployment, release, or Mainnet.",
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

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import { build as viteBuild, loadConfigFromFile } from "vite";

import {
  IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_FIELDS,
  IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_SCHEMA,
  createIatV2DevnetProgramCeremonyEvidenceBinding,
  parseIatV2DevnetProgramCeremonyBinding,
} from "../programs/iat_v2/ceremony-binding.mjs";
import {
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
} from "../programs/iat_v2/artifact-binding.mjs";
import {
  IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH,
  IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
  IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS,
  iatV2DevnetProgramCeremonyCheckoutEvidenceRef,
  inspectIatV2DevnetProgramCeremonySource,
  observeIatV2DevnetProgramCeremonyRuntimeClosure,
  verifyIatV2DevnetProgramCeremonyExactHeadTopology,
  verifyIatV2DevnetProgramCeremonyRuntimeBinding,
} from "../scripts/lib/iat-v2-devnet-program-ceremony-runtime-binding.mjs";
import { attendedPromptLatchKey } from "../tools/iat-v2-admin-console/attended-prompt-coordinator.mjs";
import adminViteConfig, {
  assertIatV2CeremonyCapturedSnapshot,
} from "../tools/iat-v2-admin-console/vite.config.mjs";

const MINT = "CAJGkRQWXvJrUxK91XBPereaVSAUGzUY4yagxRKJdKUE";
const UNBOUND_PATH = new URL(
  "../scripts/data/iat-v2-devnet-program-ceremony-runtime-binding.json",
  import.meta.url,
);
const SCHEMA_PATH = new URL(
  "../docs/b3/iat-v2-devnet-program-ceremony-runtime-binding.v1.schema.json",
  import.meta.url,
);
const RUNBOOK_PATH = new URL(
  "../launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md",
  import.meta.url,
);
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PROJECT_ROOT_REAL = realpathSync(PROJECT_ROOT);

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function canonicalJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function currentCanonicalBinding() {
  return JSON.parse(readFileSync(UNBOUND_PATH, "utf8"));
}

function canonicalUnboundBinding() {
  return {
    ...currentCanonicalBinding(),
    checkoutCommit: null,
    checkoutTree: null,
    ciRunAttempt: null,
    ciRunId: null,
    runtimeClosureSha256: null,
    runtimeEvidenceManifestSha256: null,
    sourceHeadCommit: null,
    sourceHeadTree: null,
    status: "UNBOUND",
    workflowRef: null,
  };
}

function boundBinding(overrides = {}) {
  return {
    ...canonicalUnboundBinding(),
    checkoutCommit: "3".repeat(40),
    checkoutTree: "4".repeat(40),
    ciRunAttempt: 1,
    ciRunId: 33_500_000_001,
    runtimeClosureSha256: "5".repeat(64),
    runtimeEvidenceManifestSha256: "6".repeat(64),
    sourceHeadCommit: "1".repeat(40),
    sourceHeadTree: "2".repeat(40),
    status: "BOUND",
    workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
    ...overrides,
  };
}

test("canonical ceremony anchor is fail-closed and preserves the immutable artifact tuple", () => {
  const source = readFileSync(UNBOUND_PATH, "utf8");
  const value = JSON.parse(source);
  assert.equal(source, canonicalJson(value));
  assert.deepEqual(Object.keys(value), IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_FIELDS);
  const exact = parseIatV2DevnetProgramCeremonyBinding(value);
  assert.equal(exact.schema, IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_SCHEMA);
  assert.equal(exact.artifactSourceHeadCommit, IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD);
  assert.equal(exact.artifactSha256, IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256);
  if (exact.status === "UNBOUND") {
    assert.equal(exact.sourceHeadCommit, null);
    assert.equal(exact.runtimeEvidenceManifestSha256, null);
    assert.throws(
      () => createIatV2DevnetProgramCeremonyEvidenceBinding({ binding: exact, mint: MINT }),
      /not bound to fresh public CI/u,
    );
  } else {
    assert.notEqual(exact.sourceHeadCommit, exact.artifactSourceHeadCommit);
    assert.notEqual(exact.runtimeEvidenceManifestSha256, exact.artifactEvidenceManifestSha256);
    assert.equal(
      createIatV2DevnetProgramCeremonyEvidenceBinding({ binding: exact, mint: MINT }).sourceCommit,
      exact.sourceHeadCommit,
    );
  }
});

test("runbook derives the fresh PR merge ref from the exact runtime evidence manifest", () => {
  const runbook = readFileSync(RUNBOOK_PATH, "utf8");
  assert.ok(runbook.includes(
    "$WorkflowRef = [string]$RuntimeEvidence.ciProvenance.workflowRef",
  ));
  assert.doesNotMatch(runbook, /\$RuntimeEvidence\.sourceBinding\.workflowRef/u);
  assert.ok(runbook.includes(
    "$ExpectedWorkflowRefPattern = '^InternalAgencyIO/InternalAgency/\\.github/workflows/iat-v2-proof\\.yml@refs/pull/([1-9][0-9]*)/merge$'",
  ));
  assert.ok(runbook.includes("$PullRequestNumber = $Matches[1]"));
  assert.ok(runbook.includes(
    '"+refs/pull/${PullRequestNumber}/merge:refs/remotes/$PublicRemote/$EvidenceBranch"',
  ));
  assert.doesNotMatch(runbook, /\+refs\/pull\/[0-9]+\/merge:/u);
});

test("browser-safe validator projects only verified fresh source plus immutable artifact and mint", () => {
  const exact = parseIatV2DevnetProgramCeremonyBinding(boundBinding(), { requireBound: true });
  const evidence = createIatV2DevnetProgramCeremonyEvidenceBinding({ binding: exact, mint: MINT });
  assert.deepEqual(evidence, {
    sourceCommit: "1".repeat(40),
    programArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
    mint: MINT,
  });

  const oldKey = attendedPromptLatchKey({
    binding: {
      sourceCommit: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
      programArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
      mint: MINT,
    },
    action: "UPGRADE_PROGRAM",
  });
  const freshKey = attendedPromptLatchKey({ binding: evidence, action: "UPGRADE_PROGRAM" });
  assert.notEqual(freshKey, oldKey);
  assert.match(freshKey, new RegExp(`/${"1".repeat(40)}/${IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256}/${MINT}/UPGRADE_PROGRAM/v1$`, "u"));
});

test("binding rejects artifact substitution and conflated runtime/artifact evidence", () => {
  assert.throws(
    () => parseIatV2DevnetProgramCeremonyBinding(boundBinding({ artifactSha256: "7".repeat(64) })),
    /immutable artifact SHA-256/u,
  );
  assert.throws(
    () => parseIatV2DevnetProgramCeremonyBinding(boundBinding({
      runtimeEvidenceManifestSha256: canonicalUnboundBinding().artifactEvidenceManifestSha256,
    })),
    /must remain distinct/u,
  );
  assert.throws(
    () => parseIatV2DevnetProgramCeremonyBinding(boundBinding({
      sourceHeadCommit: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
    })),
    /must differ from the immutable artifact source/u,
  );
});

test("JSON Schema mirrors the exact anchor shape and immutable constants", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, IAT_V2_DEVNET_PROGRAM_CEREMONY_BINDING_FIELDS);
  assert.equal(schema.properties.artifactSourceHeadCommit.const, IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD);
  assert.equal(schema.properties.artifactSha256.const, IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256);
  assert.equal(schema.properties.network.const, "devnet");
  assert.equal(schema.properties.mainnetStatus.const, "HOLD");
  assert.deepEqual(schema.oneOf.map((branch) => branch.properties.status.const), ["UNBOUND", "BOUND"]);
});

function firstPartyModulePath(moduleId) {
  if (typeof moduleId !== "string" || moduleId.startsWith("\0")) return null;
  let pathname = moduleId.split(/[?#]/u, 1)[0];
  if (pathname.startsWith("/@fs/")) pathname = pathname.slice(4);
  const absolutePath = isAbsolute(pathname) ? pathname : resolve(PROJECT_ROOT_REAL, pathname);
  let exactPath;
  try {
    exactPath = realpathSync(absolutePath);
  } catch {
    return null;
  }
  const repositoryPath = relative(PROJECT_ROOT_REAL, exactPath);
  if (
    repositoryPath === ""
    || repositoryPath === ".."
    || repositoryPath.startsWith(`..${sep}`)
    || isAbsolute(repositoryPath)
    || repositoryPath.split(sep).includes("node_modules")
  ) return null;
  return repositoryPath.replaceAll("\\", "/");
}

function isImportMeta(node) {
  return node?.type === "MetaProperty"
    && node.meta?.name === "import"
    && node.property?.name === "meta";
}

function isImportMetaUrl(node) {
  return node?.type === "MemberExpression"
    && node.computed === false
    && isImportMeta(node.object)
    && node.property?.type === "Identifier"
    && node.property.name === "url";
}

function assertOnlyStaticallyModeledModuleLoading(repositoryPath) {
  const source = readFileSync(resolve(PROJECT_ROOT_REAL, repositoryPath), "utf8");
  const ast = parse(source, {
    sourceType: "module",
    createImportExpressions: true,
    plugins: ["jsx", "importAttributes"],
  });
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (node.type === "ImportExpression") {
      assert.equal(
        node.source?.type,
        "StringLiteral",
        `${repositoryPath} contains a non-literal dynamic import outside the captured Vite graph`,
      );
    }
    if (node.type === "CallExpression" && node.callee?.type === "Import") {
      assert.equal(node.arguments.length, 1, `${repositoryPath} contains an ambiguous dynamic import`);
      assert.equal(
        node.arguments[0]?.type,
        "StringLiteral",
        `${repositoryPath} contains a non-literal dynamic import outside the captured Vite graph`,
      );
    }
    if (
      node.type === "CallExpression"
      && node.callee?.type === "MemberExpression"
      && isImportMeta(node.callee.object)
      && node.callee.property?.type === "Identifier"
      && node.callee.property.name === "glob"
    ) {
      assert.fail(`${repositoryPath} uses import.meta.glob without an explicit ceremony-closure model`);
    }
    if (
      node.type === "NewExpression"
      && node.callee?.type === "Identifier"
      && node.callee.name === "URL"
      && isImportMetaUrl(node.arguments?.[1])
    ) {
      assert.equal(
        node.arguments[0]?.type,
        "StringLiteral",
        `${repositoryPath} contains a non-literal import.meta.url dependency`,
      );
    }
    for (const [key, child] of Object.entries(node)) {
      if (["loc", "start", "end", "extra"].includes(key)) continue;
      visit(child);
    }
  };
  visit(ast);
}

test("runtime closure covers Vite's complete first-party console, build, and verifier graph", async () => {
  const closure = new Set(IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS);
  const anchor = IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH;
  assert.equal(closure.has(anchor), false, "the separately verified mutable anchor must stay outside S's closure digest");

  const packageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf8"));
  const attendedNodePrehook = "scripts/lib/iat-v2-attended-node-runtime.mjs";
  assert.equal(packageJson.scripts["preiat:v2-admin"], `node ${attendedNodePrehook}`);
  assert.equal(
    closure.has(attendedNodePrehook),
    true,
    "the npm lifecycle runtime gate executes before Vite and must remain in source S's closure",
  );
  for (const evidenceGate of [
    "scripts/finalize-iat-v2-current-source-devnet-evidence.mjs",
    "scripts/iat-v2-devnet-buffer-preflight.mjs",
    "scripts/lib/iat-v2-current-source-devnet-clearance.mjs",
    "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
    "scripts/validate-iat-v2-ci-sbf-evidence.mjs",
    "scripts/verify-iat-v2-devnet-program-ceremony-runtime-binding.mjs",
  ]) {
    assert.equal(
      closure.has(evidenceGate),
      true,
      `the public-CI evidence gate must remain in source S's closure: ${evidenceGate}`,
    );
  }

  const indexPath = "tools/iat-v2-admin-console/index.html";
  assert.equal(closure.has(indexPath), true);
  assert.match(readFileSync(resolve(PROJECT_ROOT, indexPath), "utf8"), /<script\s+type="module"\s+src="\/main\.jsx"><\/script>/u);

  const viteConfigPath = resolve(PROJECT_ROOT_REAL, "tools/iat-v2-admin-console/vite.config.mjs");
  const loadedConfig = await loadConfigFromFile(
    { command: "build", mode: "test", isPreview: false },
    viteConfigPath,
  );
  assert.ok(loadedConfig, "Vite ceremony config did not load");
  const capturedModuleIds = new Set();
  const temporaryRoot = mkdtempSync(join(tmpdir(), "iat-v2-ceremony-vite-graph-"));
  try {
    await viteBuild({
      cacheDir: join(temporaryRoot, "cache"),
      configFile: viteConfigPath,
      logLevel: "silent",
      build: {
        emptyOutDir: false,
        write: false,
      },
      plugins: [{
        name: "iat-v2-capture-first-party-ceremony-graph",
        generateBundle() {
          for (const moduleId of this.getModuleIds()) capturedModuleIds.add(moduleId);
        },
      }],
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const firstParty = new Set([
    ...capturedModuleIds,
    ...loadedConfig.dependencies,
    resolve(PROJECT_ROOT_REAL, indexPath),
    resolve(PROJECT_ROOT_REAL, "tools/iat-v2-admin-console/main.jsx"),
    viteConfigPath,
  ].map(firstPartyModulePath).filter(Boolean));
  assert.equal(firstParty.has(anchor), true, "Vite graph did not expose the separately verified ceremony anchor");
  const outsideClosure = [...firstParty]
    .filter((repositoryPath) => !closure.has(repositoryPath))
    .sort();
  assert.deepEqual(outsideClosure, [anchor], "first-party Vite/config dependencies escaped the ceremony closure");
  for (const seed of [
    indexPath,
    "tools/iat-v2-admin-console/main.jsx",
    "tools/iat-v2-admin-console/vite.config.mjs",
  ]) {
    assert.equal(firstParty.has(seed), true, `Vite ceremony graph is missing its entry seed: ${seed}`);
  }
  for (const repositoryPath of firstParty) {
    if (/\.(?:js|jsx|mjs)$/u.test(repositoryPath)) {
      assertOnlyStaticallyModeledModuleLoading(repositoryPath);
    }
  }
});

test("Vite preview is disabled and B CI exercises the full evidence-bound live gate", () => {
  assert.throws(
    () => adminViteConfig({ command: "serve", isPreview: true }),
    (error) => error?.code === "CEREMONY_BINDING_PREVIEW_HOLD",
  );
  const binding = currentCanonicalBinding();
  if (binding.status === "UNBOUND") {
    assert.throws(
      () => adminViteConfig({ command: "serve", isPreview: false }),
      (error) => typeof error?.code === "string" && error.code.startsWith("CEREMONY_BINDING_"),
    );
  } else {
    const verified = verifyIatV2DevnetProgramCeremonyRuntimeBinding({
      projectRoot: PROJECT_ROOT,
      git: reviewedGit,
    });
    assert.equal(verified.bindingSuccessorCommit, runGit(PROJECT_ROOT, ["rev-parse", "HEAD"]));
    assert.equal(verified.sourceHeadCommit, binding.sourceHeadCommit);
    assert.equal(verified.checkoutObjectVerified, true);
    assert.equal(verified.checkoutEvidenceRefVerified, true);
    assert.equal(verified.checkoutEvidenceRemote, "origin");
    assert.equal(verified.runtimeEvidenceVerified, true);
    assert.equal(verified.relation, "DIRECT_BINDING_ONLY_SUCCESSOR");
    assert.equal(verified.transactionExecution, false);
    assert.equal(verified.signing, false);
    assert.equal(verified.broadcast, false);
    assert.equal(verified.mainnetAuthorized, false);
  }
  assert.doesNotThrow(() => adminViteConfig({ command: "build", isPreview: false }));
});

test("public B CI provisions the exact S checkout object and downloaded runtime manifest", () => {
  const workflow = readFileSync(
    resolve(PROJECT_ROOT, "../../..", ".github/workflows/iat-v2-proof.yml"),
    "utf8",
  );
  assert.match(workflow, /permissions:\s+actions: read\s+contents: read/u);
  assert.match(workflow, /agent\/iat-v2-devnet-ceremony-ci-\$\{binding\.sourceHeadCommit\}/u);
  assert.match(workflow, /git fetch --no-tags origin/u);
  assert.match(workflow, /actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/u);
  assert.match(workflow, /run-id: \$\{\{ steps\.ceremony_binding\.outputs\.run_id \}\}/u);
  assert.match(workflow, /target\/verifiable\/iat-v2-ceremony-runtime-build-evidence\.json/u);
});

test("captured Vite serve bytes must exactly match the full verifier snapshot", () => {
  const relativePaths = [
    ...IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS,
    IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH,
    IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
  ];
  const captured = new Map(relativePaths.map((relativePath) => {
    const bytes = relativePath === IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH
      ? Buffer.from("canonical runtime evidence fixture\n", "utf8")
      : readFileSync(resolve(PROJECT_ROOT, relativePath));
    return [relativePath, { bytes, relativePath }];
  }));
  const verification = {
    bindingAnchorSha256: sha256(captured.get(IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH).bytes),
    runtimeEvidenceManifestSha256: sha256(
      captured.get(IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH).bytes,
    ),
    runtimeEvidenceVerified: true,
    runtimeClosureEntries: IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS.map((path) => ({
      bytes: captured.get(path).bytes.length,
      path,
      sha256: sha256(captured.get(path).bytes),
    })),
  };
  assert.doesNotThrow(() => assertIatV2CeremonyCapturedSnapshot({ captured, verification }));

  const changedPath = IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS[0];
  assert.throws(
    () => assertIatV2CeremonyCapturedSnapshot({
      captured,
      verification: {
        ...verification,
        runtimeClosureEntries: verification.runtimeClosureEntries.map((entry) => (
          entry.path === changedPath ? { ...entry, sha256: "0".repeat(64) } : entry
        )),
      },
    }),
    (error) => error?.code === "CEREMONY_BINDING_SNAPSHOT_HOLD"
      && error.message.includes(changedPath),
  );
  assert.throws(
    () => assertIatV2CeremonyCapturedSnapshot({
      captured,
      verification: { ...verification, bindingAnchorSha256: "0".repeat(64) },
    }),
    (error) => error?.code === "CEREMONY_BINDING_SNAPSHOT_HOLD"
      && /binding anchor differs/u.test(error.message),
  );
  assert.throws(
    () => assertIatV2CeremonyCapturedSnapshot({
      captured,
      verification: { ...verification, runtimeEvidenceManifestSha256: "0".repeat(64) },
    }),
    (error) => error?.code === "CEREMONY_BINDING_SNAPSHOT_HOLD"
      && /runtime CI evidence differs/u.test(error.message),
  );
  assert.throws(
    () => assertIatV2CeremonyCapturedSnapshot({
      captured: new Map([...captured, ["unexpected", {
        bytes: Buffer.from("unexpected"),
        relativePath: "unexpected",
      }]]),
      verification,
    }),
    (error) => error?.code === "CEREMONY_BINDING_SNAPSHOT_HOLD"
      && /path set differs/u.test(error.message),
  );
});

test("Vite guard covers dev, HMR, polling, every request, and rejects preview", () => {
  const source = readFileSync(
    resolve(PROJECT_ROOT, "tools/iat-v2-admin-console/vite.config.mjs"),
    "utf8",
  );
  assert.match(source, /if \(command === "serve" && isPreview\)/u);
  assert.match(source, /CEREMONY_BINDING_PREVIEW_HOLD/u);
  assert.match(
    source,
    /ceremonyServeGuard = createCeremonyServeGuard\(\);\s*const verification = verifyIatV2DevnetProgramCeremonyRuntimeBinding/u,
  );
  assert.match(source, /ceremonyServeGuard\.assertVerifiedSnapshot\(verification\)/u);
  assert.match(source, /entry\.bytes !== record\.bytes\.length \|\| entry\.sha256 !== sha256\(record\.bytes\)/u);
  assert.match(source, /verification\.bindingAnchorSha256 !== sha256\(anchor\.bytes\)/u);
  for (const boundary of [
    "configureServer: configure",
    "handleHotUpdate",
    "server.middlewares.use(assertRequestBoundary)",
    "setInterval",
    "response.statusCode = 503",
    "process.exitCode = 1",
  ]) {
    assert.equal(source.includes(boundary), true, `Vite fail-closed serve guard is missing ${boundary}`);
  }
  assert.equal(source.includes("configurePreviewServer"), false);
  assert.equal(source.includes("preview:"), false);
});

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

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function commitAll(repositoryRoot, message) {
  runGit(repositoryRoot, ["add", "--all"]);
  runGit(repositoryRoot, ["commit", "--quiet", "-m", message]);
  return runGit(repositoryRoot, ["rev-parse", "HEAD"]);
}

function withRuntimeFixture(callback) {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "iat-v2-ceremony-binding-"));
  try {
    runGit(repositoryRoot, ["init", "--quiet"]);
    runGit(repositoryRoot, ["config", "user.email", "ceremony-binding-test@internalagency.invalid"]);
    runGit(repositoryRoot, ["config", "user.name", "Ceremony Binding Test"]);
    runGit(repositoryRoot, [
      "remote",
      "add",
      "origin",
      "https://github.com/InternalAgencyIO/InternalAgency.git",
    ]);
    write(join(repositoryRoot, ".fixture-base"), "ceremony binding fixture base\n");
    write(join(repositoryRoot, ".gitignore"), "target/\n");
    const baseCommit = commitAll(repositoryRoot, "fixture base");

    for (const path of IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS) {
      write(join(repositoryRoot, path), `ceremony runtime fixture: ${path}\n`);
    }
    write(
      join(repositoryRoot, IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH),
      canonicalJson(canonicalUnboundBinding()),
    );
    const sourceHeadCommit = commitAll(repositoryRoot, "reviewed ceremony source S");
    const sourceHeadTree = runGit(repositoryRoot, ["rev-parse", `${sourceHeadCommit}^{tree}`]);
    return callback({ baseCommit, repositoryRoot, sourceHeadCommit, sourceHeadTree });
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
}

function fixtureRuntimeEvidence({
  binding,
  checkoutCommit,
  sourceHeadCommit,
  sourceHeadTree,
}) {
  return {
    artifacts: {
      buildLog: {
        bytes: 1,
        path: "target/iat-v2-sbf-build.log",
        sha256: "a".repeat(64),
      },
      programBinary: {
        bytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
        path: "target/verifiable/iat_v2.so",
        sha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
      },
      programIdl: {
        bytes: 1,
        path: "target/idl/iat_v2.json",
        sha256: "b".repeat(64),
      },
    },
    buildContainer: {
      image: "solanafoundation/anchor",
      indexDigest: "sha256:05a13b9f0a6d7dd5dc86955dd0e14a098110f12d2862ac5e0cf588049a48841b",
      platform: "linux/amd64",
      platformManifestDigest: "sha256:28fde4e63a063727c9520a925de4e9a3be29fcc717b5d759363c23ddea28f59d",
      reference: "solanafoundation/anchor@sha256:05a13b9f0a6d7dd5dc86955dd0e14a098110f12d2862ac5e0cf588049a48841b",
      registryVerification: "DOCKER_MANIFEST_AND_LOCAL_PLATFORM",
      tag: "v1.0.2",
    },
    ciProvenance: {
      repository: binding.repository,
      repositoryId: binding.repositoryId,
      runAttempt: binding.ciRunAttempt,
      runId: binding.ciRunId,
      runnerArch: binding.runnerArch,
      runnerOs: binding.runnerOs,
      serverUrl: "https://github.com",
      workflowRef: binding.workflowRef,
    },
    limitations: [
      "Build evidence only; not signed Devnet evidence.",
      "Does not authorize deployment, signing, broadcast, funding, or Mainnet launch.",
    ],
    programId: "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj",
    schema: "iat-v2-ci-verifiable-sbf-evidence/v5",
    sourceBinding: {
      checkoutCommit,
      checkoutRelation: binding.checkoutRelation,
      checkoutTree: sourceHeadTree,
      sourceHeadCommit,
      sourceHeadTree,
      trackedWorktree: "CLEAN",
      workflowEvent: binding.workflowEvent,
    },
    status: "BUILD_ONLY_HOLD",
    toolchain: {
      anchor: "anchor-cli 1.0.2",
      rustc: "rustc 1.97.1 (000000000 2026-01-01)",
      solana: "solana-cli 3.1.10 (fixture)",
    },
  };
}

function bindFixture({
  baseCommit,
  repositoryRoot,
  sourceHeadCommit,
  sourceHeadTree,
}, { extraPath = false } = {}) {
  const closure = observeIatV2DevnetProgramCeremonyRuntimeClosure({
    projectRoot: repositoryRoot,
    sourceHeadCommit,
    git: reviewedGit,
  });
  const checkoutCommit = runGit(repositoryRoot, [
    "commit-tree",
    sourceHeadTree,
    "-p",
    baseCommit,
    "-p",
    sourceHeadCommit,
  ], { input: "fixture public PR merge checkout\n" });
  const seedBinding = boundBinding({
    checkoutCommit,
    checkoutTree: sourceHeadTree,
    runtimeClosureSha256: closure.runtimeClosureSha256,
    sourceHeadCommit,
    sourceHeadTree,
  });
  const evidenceBytes = Buffer.from(canonicalJson(fixtureRuntimeEvidence({
    binding: seedBinding,
    checkoutCommit,
    sourceHeadCommit,
    sourceHeadTree,
  })), "utf8");
  write(
    join(repositoryRoot, IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH),
    evidenceBytes,
  );
  const binding = {
    ...seedBinding,
    runtimeEvidenceManifestSha256: createHash("sha256").update(evidenceBytes).digest("hex"),
  };
  write(
    join(repositoryRoot, IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH),
    canonicalJson(binding),
  );
  const checkoutEvidenceRef = iatV2DevnetProgramCeremonyCheckoutEvidenceRef(sourceHeadCommit);
  runGit(repositoryRoot, [
    "update-ref",
    checkoutEvidenceRef.replace("refs/heads/", "refs/remotes/origin/"),
    checkoutCommit,
  ]);
  if (extraPath) write(join(repositoryRoot, "unexpected-binding-change.txt"), "not anchor-only\n");
  const bindingSuccessorCommit = commitAll(repositoryRoot, "binding-only successor B");
  return { binding, bindingSuccessorCommit, checkoutCommit, closure };
}

test("runtime verifier accepts exact S to one-anchor B topology and remains non-authorizing", () => {
  withRuntimeFixture((fixture) => {
    const source = inspectIatV2DevnetProgramCeremonySource({
      projectRoot: fixture.repositoryRoot,
      git: reviewedGit,
    });
    assert.equal(source.status, "UNBOUND");
    assert.equal(source.sourceHeadCommit, fixture.sourceHeadCommit);
    assert.equal(source.sourceHeadTree, fixture.sourceHeadTree);
    assert.equal(source.transactionExecution, false);
    assert.equal(source.signing, false);
    assert.equal(source.broadcast, false);
    assert.equal(source.mainnetAuthorized, false);

    const bound = bindFixture(fixture);
    const topology = verifyIatV2DevnetProgramCeremonyExactHeadTopology({
      projectRoot: fixture.repositoryRoot,
      git: reviewedGit,
    });
    assert.equal(topology.status, "BOUND");
    assert.equal(topology.sourceHeadCommit, fixture.sourceHeadCommit);
    assert.equal(topology.bindingSuccessorCommit, bound.bindingSuccessorCommit);
    assert.equal(topology.checkoutObjectVerified, false);
    assert.equal(topology.relation, "DIRECT_BINDING_ONLY_SUCCESSOR");
    const verified = verifyIatV2DevnetProgramCeremonyRuntimeBinding({
      projectRoot: fixture.repositoryRoot,
      git: reviewedGit,
    });
    assert.equal(verified.status, "BOUND");
    assert.equal(verified.sourceHeadCommit, fixture.sourceHeadCommit);
    assert.equal(verified.checkoutCommit, bound.checkoutCommit);
    assert.equal(verified.checkoutObjectVerified, true);
    assert.equal(verified.checkoutEvidenceRefVerified, true);
    assert.equal(
      verified.checkoutEvidenceRef,
      iatV2DevnetProgramCeremonyCheckoutEvidenceRef(fixture.sourceHeadCommit),
    );
    assert.equal(
      verified.localCheckoutEvidenceRef,
      verified.checkoutEvidenceRef.replace("refs/heads/", "refs/remotes/origin/"),
    );
    assert.equal(verified.bindingSuccessorCommit, bound.bindingSuccessorCommit);
    assert.equal(verified.runtimeClosureSha256, bound.closure.runtimeClosureSha256);
    assert.match(verified.sourceBindingAnchorSha256, /^[0-9a-f]{64}$/u);
    assert.equal(verified.runtimeEvidenceManifestSha256, bound.binding.runtimeEvidenceManifestSha256);
    assert.equal(verified.runtimeEvidenceVerified, true);
    assert.equal(
      verified.runtimeEvidencePath,
      IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
    );
    assert.equal(verified.artifactEvidenceManifestSha256, canonicalUnboundBinding().artifactEvidenceManifestSha256);
    assert.notEqual(verified.runtimeEvidenceManifestSha256, verified.artifactEvidenceManifestSha256);
    assert.equal(verified.relation, "DIRECT_BINDING_ONLY_SUCCESSOR");
    assert.equal(verified.transactionExecution, false);
    assert.equal(verified.signing, false);
    assert.equal(verified.broadcast, false);
    assert.equal(verified.mainnetAuthorized, false);
  });
});

test("runtime verifier rejects a source S whose predecessor anchor was already bound", () => {
  withRuntimeFixture((fixture) => {
    write(
      join(fixture.repositoryRoot, IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH),
      canonicalJson(boundBinding()),
    );
    const sourceHeadCommit = commitAll(fixture.repositoryRoot, "invalid pre-bound ceremony source S");
    const sourceHeadTree = runGit(fixture.repositoryRoot, ["rev-parse", `${sourceHeadCommit}^{tree}`]);
    bindFixture({
      ...fixture,
      baseCommit: fixture.sourceHeadCommit,
      sourceHeadCommit,
      sourceHeadTree,
    });
    assert.throws(
      () => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
        projectRoot: fixture.repositoryRoot,
        git: reviewedGit,
      }),
      (error) => error?.code === "CEREMONY_BINDING_SOURCE_HOLD"
        && /source S anchor must be the exact UNBOUND predecessor/u.test(error.message),
    );
  });
});

test("runtime verifier rejects noncanonical source S anchor bytes", () => {
  withRuntimeFixture((fixture) => {
    write(
      join(fixture.repositoryRoot, IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH),
      `${canonicalJson(canonicalUnboundBinding())}\n`,
    );
    const sourceHeadCommit = commitAll(fixture.repositoryRoot, "invalid noncanonical ceremony source S");
    const sourceHeadTree = runGit(fixture.repositoryRoot, ["rev-parse", `${sourceHeadCommit}^{tree}`]);
    bindFixture({
      ...fixture,
      baseCommit: fixture.sourceHeadCommit,
      sourceHeadCommit,
      sourceHeadTree,
    });
    assert.throws(
      () => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
        projectRoot: fixture.repositoryRoot,
        git: reviewedGit,
      }),
      (error) => error?.code === "CEREMONY_BINDING_SOURCE_HOLD"
        && /source S anchor is not canonical sorted-key UTF-8 JSON/u.test(error.message),
    );
  });
});

test("runtime verifier rejects a successor that changes any path beyond the anchor", () => {
  withRuntimeFixture((fixture) => {
    bindFixture(fixture, { extraPath: true });
    assert.throws(
      () => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
        projectRoot: fixture.repositoryRoot,
        git: reviewedGit,
      }),
      (error) => error?.code === "CEREMONY_BINDING_SUCCESSOR_HOLD"
        && /beyond the one canonical anchor/u.test(error.message),
    );
  });
});

test("runtime verifier rejects working-byte drift in every explicit attended evidence gate", () => {
  withRuntimeFixture((fixture) => {
    bindFixture(fixture);
    for (const gatePath of [
      "scripts/finalize-iat-v2-current-source-devnet-evidence.mjs",
      "scripts/iat-v2-devnet-buffer-preflight.mjs",
      "scripts/lib/iat-v2-current-source-devnet-clearance.mjs",
      "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
    ]) {
      const absoluteGatePath = join(fixture.repositoryRoot, gatePath);
      const original = readFileSync(absoluteGatePath, "utf8");
      write(absoluteGatePath, `${original}uncommitted attended evidence-gate drift\n`);
      assert.throws(
        () => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
          projectRoot: fixture.repositoryRoot,
          git: reviewedGit,
        }),
        (error) => error?.code === "CEREMONY_BINDING_CLOSURE_HOLD"
          && error.message.includes(gatePath),
      );
      write(absoluteGatePath, original);
    }
    assert.doesNotThrow(() => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
      projectRoot: fixture.repositoryRoot,
      git: reviewedGit,
    }));
  });
});

test("runtime verifier requires the exact durable public CI-checkout evidence ref", () => {
  withRuntimeFixture((fixture) => {
    const bound = bindFixture(fixture);
    const localCheckoutEvidenceRef = iatV2DevnetProgramCeremonyCheckoutEvidenceRef(
      fixture.sourceHeadCommit,
    ).replace("refs/heads/", "refs/remotes/origin/");
    runGit(fixture.repositoryRoot, [
      "update-ref",
      "-d",
      localCheckoutEvidenceRef,
    ]);
    assert.throws(
      () => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
        projectRoot: fixture.repositoryRoot,
        git: reviewedGit,
      }),
      (error) => error?.code === "CEREMONY_BINDING_CHECKOUT_REF_HOLD"
        && /exactly one authenticated public ceremony CI-checkout evidence ref/u.test(error.message),
    );

    runGit(fixture.repositoryRoot, [
      "update-ref",
      localCheckoutEvidenceRef,
      bound.checkoutCommit,
    ]);
    runGit(fixture.repositoryRoot, [
      "config",
      "url.https://evil.example/.insteadOf",
      "https://github.com/",
    ]);
    assert.throws(
      () => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
        projectRoot: fixture.repositoryRoot,
        git: reviewedGit,
      }),
      (error) => error?.code === "CEREMONY_BINDING_CHECKOUT_REF_HOLD"
        && /exactly one authenticated public ceremony CI-checkout evidence ref/u.test(error.message),
    );
    assert.equal(bound.binding.checkoutCommit.length, 40);
  });
});

test("runtime verifier authenticates the exact downloaded public-CI manifest bytes", () => {
  withRuntimeFixture((fixture) => {
    bindFixture(fixture);
    const evidencePath = join(
      fixture.repositoryRoot,
      IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
    );
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    evidence.ciProvenance.runId += 1;
    write(evidencePath, canonicalJson(evidence));
    assert.throws(
      () => verifyIatV2DevnetProgramCeremonyRuntimeBinding({
        projectRoot: fixture.repositoryRoot,
        git: reviewedGit,
      }),
      (error) => error?.code === "CEREMONY_BINDING_EVIDENCE_HOLD"
        && /SHA-256 disagrees/u.test(error.message),
    );
  });
});

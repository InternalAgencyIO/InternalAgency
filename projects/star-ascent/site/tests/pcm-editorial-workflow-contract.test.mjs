import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../../../../.github/workflows/iat-pcm-evidence-proof.yml", import.meta.url);
const workflow = (await readFile(workflowUrl, "utf8")).replaceAll("\r\n", "\n");

const checkoutPin = "actions/checkout@11d5960a326750d5838078e36cf38b85af677262";
const setupNodePin = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020";
const workflowPath = ".github/workflows/iat-pcm-evidence-proof.yml";
const sitePrefix = "projects/star-ascent/site/";
const focusedTests = Object.freeze([
  "tests/i18n-protected-integrity.test.mjs",
  "tests/pcm-machine-draft-quality.test.mjs",
  "tests/pcm-editorial-gap-report.test.mjs",
  "tests/pcm-editorial-incremental-batch.test.mjs",
  "tests/pcm-source-freeze-evidence.test.mjs",
]);
const contractTest = "tests/pcm-editorial-workflow-contract.test.mjs";
const batchFiles = Object.freeze([
  "scripts/data/pcm-editorial-batches/pcm-public-ui-short-001.json",
  "scripts/data/pcm-editorial-batches/pcm-public-ui-priority-002.json",
  "scripts/data/pcm-editorial-batches/pcm-public-ui-priority-003.json",
  "scripts/data/pcm-editorial-batches/pcm-public-ui-priority-004.json",
  "scripts/data/pcm-editorial-batches/pcm-public-ui-priority-005.json",
  "scripts/data/pcm-editorial-batches/pcm-public-ui-priority-006.json",
]);
const closurePaths = Object.freeze([
  workflowPath,
  `${sitePrefix}.gitattributes`,
  `${sitePrefix}scripts/data/pcm-source-freeze-evidence-5baff9.json`,
  `${sitePrefix}scripts/data/pcm-editorial-source-partition-5baff9.json`,
  ...batchFiles.map((path) => `${sitePrefix}${path}`),
  `${sitePrefix}scripts/validate-pcm-editorial-batch.mjs`,
  `${sitePrefix}scripts/lib/i18n-protected-integrity.mjs`,
  `${sitePrefix}scripts/lib/pcm-machine-draft-quality.mjs`,
  `${sitePrefix}scripts/lib/pcm-editorial-gap-report.mjs`,
  `${sitePrefix}scripts/lib/pcm-editorial-source-partition.mjs`,
  `${sitePrefix}scripts/lib/pcm-editorial-incremental-batch.mjs`,
  ...focusedTests.map((path) => `${sitePrefix}${path}`),
  `${sitePrefix}${contractTest}`,
]);
const executedModulePaths = Object.freeze([
  "scripts/validate-pcm-editorial-batch.mjs",
  "scripts/lib/i18n-protected-integrity.mjs",
  "scripts/lib/pcm-machine-draft-quality.mjs",
  "scripts/lib/pcm-editorial-gap-report.mjs",
  "scripts/lib/pcm-editorial-source-partition.mjs",
  "scripts/lib/pcm-editorial-incremental-batch.mjs",
  ...focusedTests,
  contractTest,
]);
const executedModules = await Promise.all(executedModulePaths.map(async (path) => {
  const url = new URL(`../${path}`, import.meta.url);
  return { path, source: await readFile(url, "utf8"), url };
}));
const executedModuleUrls = new Set(executedModules.map(({ url }) => url.href));
const allowedNodeImports = new Set([
  "node:assert/strict",
  "node:crypto",
  "node:fs/promises",
  "node:path",
  "node:test",
]);

function count(source, needle) {
  return source.split(needle).length - 1;
}

function eventPaths(source, eventName) {
  const lines = source.split("\n");
  const eventIndex = lines.indexOf(`  ${eventName}:`);
  if (eventIndex === -1 || lines[eventIndex + 1] !== "    paths:") return [];
  const paths = [];
  for (let index = eventIndex + 2; index < lines.length; index += 1) {
    const match = /^      - "([^"]+)"$/u.exec(lines[index]);
    if (!match) break;
    paths.push(match[1]);
  }
  return paths;
}

function runBlocks(source) {
  const lines = source.split("\n");
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== "        run: |") continue;
    const body = [];
    for (index += 1; index < lines.length && lines[index].startsWith("          "); index += 1) {
      body.push(lines[index].slice(10));
    }
    blocks.push(body);
    index -= 1;
  }
  return blocks;
}

function importSpecifiers(source) {
  return [
    ...[...source.matchAll(/\bfrom\s+["']([^"']+)["']/gu)].map((match) => match[1]),
    ...[...source.matchAll(/^\s*import\s+["']([^"']+)["']/gmu)].map((match) => match[1]),
  ];
}

function validateWorkflow(source) {
  assert.equal(count(source, checkoutPin), 1, "workflow must use the reviewed checkout pin exactly once");
  assert.equal(count(source, setupNodePin), 1, "workflow must use the reviewed setup-node pin exactly once");
  const actionUses = [...source.matchAll(/^\s+-?\s*uses:\s*(\S+)/gmu)].map((match) => match[1]);
  assert.deepEqual(actionUses, [checkoutPin, setupNodePin], "workflow contains an unreviewed action");
  assert.equal(count(source, "permissions:\n"), 1, "workflow must define one permissions block");
  assert.equal(
    /^permissions:\n(?:  [^\n]+\n)+/mu.exec(source)?.[0],
    "permissions:\n  contents: read\n",
    "workflow permissions must contain only contents: read",
  );
  assert.equal(count(source, "persist-credentials: false"), 1);
  assert.equal(count(source, "node-version: 24"), 1);
  assert.doesNotMatch(source, /^\s+(?:cache|registry-url|token):/gmu);
  assert.match(
    source,
    /defaults:\n  run:\n    shell: bash\n    working-directory: projects\/star-ascent\/site\n/u,
  );
  assert.match(source, /runs-on:\s+ubuntu-latest\s*$/mu);
  assert.match(source, /timeout-minutes:\s+10\s*$/mu);
  assert.match(
    source,
    /concurrency:\n  group: iat-pcm-evidence-proof-\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}\n  cancel-in-progress: true\n/u,
  );
  assert.deepEqual(eventPaths(source, "push"), closurePaths, "push path closure drifted");
  assert.deepEqual(eventPaths(source, "pull_request"), closurePaths, "pull-request path closure drifted");
  assert.match(source, /^  workflow_dispatch:\n\npermissions:/mu);
  const jobsText = source.slice(source.indexOf("jobs:\n") + "jobs:\n".length);
  assert.deepEqual(
    jobsText.split("\n").filter((line) => /^  [a-z0-9-]+:\s*$/u.test(line)),
    ["  pcm-evidence:"],
    "workflow must contain exactly one proof job",
  );
  const blocks = runBlocks(source);
  assert.equal(
    source.split("\n").filter((line) => /^(?:        run:|      - run:)/u.test(line)).length,
    3,
    "workflow must contain exactly the three reviewed run blocks",
  );
  const continuation = "\\";
  assert.deepEqual(blocks, [
    ["set -euo pipefail", `node --test ${contractTest}`],
    [
      "set -euo pipefail",
      `node --test ${continuation}`,
      ...focusedTests.map((path, index) => `  ${path}${index === focusedTests.length - 1 ? "" : ` ${continuation}`}`),
    ],
    [
      "set -euo pipefail",
      ...batchFiles.map(
      (batchFile) => `I18N_PCM_EDITORIAL_BATCH_PATH="${batchFile}" node scripts/validate-pcm-editorial-batch.mjs`,
      ),
    ],
  ], "workflow run commands drifted");
  assert.doesNotMatch(
    source,
    /^\s+(?:continue-on-error|if|strategy|matrix|environment|container|services|secrets|env):|\|\|\s*true|;\s*true/gmu,
  );
  assert.doesNotMatch(
    source,
    /\bnpm\s+(?:ci|install)|\bnpx\b|\bcurl\b|\bwget\b|activate-machine-draft-locales|apply-i18n-editorial-overrides|compile-i18n-assets|generate-pcm-machine-draft|machine-translation-transport/u,
  );
}

test("PCM evidence workflow is exact, pinned, read-only, fail-fast, and non-activating", () => {
  validateWorkflow(workflow);
});

test("PCM proof execution closure has no package, process, network, or filesystem-mutation imports", () => {
  for (const { path, source, url } of executedModules) {
    assert.doesNotMatch(source, /\bimport\s*\(/u, `${path} uses a dynamic import`);
    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith("node:")) {
        assert.ok(allowedNodeImports.has(specifier), `${path} imports unreviewed builtin ${specifier}`);
      } else {
        assert.match(specifier, /^\.\.?\//u, `${path} imports package ${specifier}`);
        assert.ok(executedModuleUrls.has(new URL(specifier, url).href), `${path} imports outside the proof closure`);
      }
    }
    if (path === contractTest) continue;
    assert.doesNotMatch(
      source,
      /\b(?:fetch|WebSocket|EventSource)\b|node:(?:http|https|net|tls|dgram|child_process)|\b(?:writeFile|appendFile|unlink|rename|mkdir|rm|createWriteStream)\b|activate-machine-draft-locales|apply-i18n-editorial-overrides|compile-i18n-assets|generate-pcm-machine-draft|machine-translation-transport/u,
      `${path} contains an unreviewed external or mutating capability`,
    );
  }
});

test("PCM evidence workflow contract rejects omissions, substitutions, and unsafe execution", () => {
  const finalBatchCommand = `I18N_PCM_EDITORIAL_BATCH_PATH="${batchFiles[5]}" node scripts/validate-pcm-editorial-batch.mjs`;
  const probes = [
    ["missing path", workflow.replace(`      - "${sitePrefix}scripts/data/pcm-source-freeze-evidence-5baff9.json"\n`, "")],
    ["broadened path", workflow.replace(`"${sitePrefix}scripts/lib/pcm-editorial-gap-report.mjs"`, `"${sitePrefix}scripts/**"`)],
    ["Node substitution", workflow.replace("node-version: 24", "node-version: 22")],
    ["floating checkout", workflow.replace(checkoutPin, "actions/checkout@v4")],
    ["floating setup-node", workflow.replace(setupNodePin, "actions/setup-node@v4")],
    ["write permission", workflow.replace("contents: read", "contents: write")],
    ["extra permission", workflow.replace("  contents: read\n", "  contents: read\n  id-token: write\n")],
    ["checkout credentials", workflow.replace("persist-credentials: false", "persist-credentials: true")],
    ["setup cache", workflow.replace("          node-version: 24\n", "          node-version: 24\n          cache: npm\n")],
    ["missing fail-fast", workflow.replace("set -euo pipefail\n", "")],
    ["missing contract test", workflow.replace(`          node --test ${contractTest}\n`, "")],
    ["missing focused test", workflow.replace(`            ${focusedTests[0]} \\\n`, "")],
    ["substituted batch", workflow.replace(finalBatchCommand, finalBatchCommand.replace(batchFiles[5], batchFiles[4]))],
    ["duplicated batch", workflow.replace(`          ${finalBatchCommand}\n`, `          ${finalBatchCommand}\n          ${finalBatchCommand}\n`)],
    ["install command", workflow.replace(
      "          set -euo pipefail\n          node --test",
      "          set -euo pipefail\n          npm ci\n          node --test",
    )],
    ["activation command", `${workflow}\n      - run: node scripts/activate-machine-draft-locales.mjs\n`],
    ["continue-on-error", `${workflow}\n      - run: echo bypass\n        continue-on-error: true\n`],
    ["extra run step", `${workflow}\n      - run: echo unexpected\n`],
    ["conditional bypass", workflow.replace("      - name: Validate every frozen editorial batch\n", "      - name: Validate every frozen editorial batch\n        if: always()\n")],
    ["extra action", `${workflow}\n      - uses: example/action@0123456789012345678901234567890123456789\n`],
    ["extra job", `${workflow}\n  deploy:\n    runs-on: ubuntu-latest\n`],
  ];
  for (const [label, probe] of probes) {
    assert.notEqual(probe, workflow, `${label} probe did not mutate the fixture`);
    assert.throws(() => validateWorkflow(probe), undefined, `${label} probe passed unexpectedly`);
  }
});

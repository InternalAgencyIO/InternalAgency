import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const siteRoot = process.cwd();
const repositoryRoot = resolve(siteRoot, "..", "..", "..");
const relativeSiteRoot = "projects/star-ascent/site";
const manifestRelative = `${relativeSiteRoot}/public/audits/localization-qa-20260803/translation-provenance.v1.json`;
const messagesRelative = `${relativeSiteRoot}/app/i18n/messages.json`;
const validatorRelative = `${relativeSiteRoot}/scripts/validate-localization-provenance.mjs`;
const temporaryRoot = mkdtempSync(join(tmpdir(), "iat-i18n-provenance-regression-"));
const cloneRoot = join(temporaryRoot, "repository");

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" },
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runValidator() {
  return run(process.execPath, [join(cloneRoot, validatorRelative)], join(cloneRoot, relativeSiteRoot));
}

function expectFailure(label, mutate, restore) {
  mutate();
  const result = runValidator();
  restore();
  assert(result.status !== 0, `${label} unexpectedly passed`);
  assert(
    `${result.stdout}\n${result.stderr}`.includes("localization provenance validation failed"),
    `${label} failed outside the provenance gate`,
  );
}

try {
  const clone = run("git", ["clone", "--shared", "--no-checkout", repositoryRoot, cloneRoot], repositoryRoot);
  assert(clone.status === 0, `temporary shared clone failed: ${clone.stderr}`);
  const checkout = run("git", ["-c", "core.autocrlf=false", "checkout", "--detach", "HEAD"], cloneRoot);
  assert(checkout.status === 0, `temporary checkout failed: ${checkout.stderr}`);

  const baseline = runValidator();
  assert(baseline.status === 0, `baseline provenance validation failed: ${baseline.stderr}`);

  const manifestPath = join(cloneRoot, manifestRelative);
  const messagesPath = join(cloneRoot, messagesRelative);
  const originalManifestText = readFileSync(manifestPath, "utf8");
  const originalManifest = JSON.parse(originalManifestText);
  const originalMessages = readFileSync(messagesPath);
  const restoreManifest = () => writeFileSync(manifestPath, originalManifestText, "utf8");
  const writeManifest = (mutate) => {
    const candidate = structuredClone(originalManifest);
    mutate(candidate);
    writeFileSync(manifestPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  };

  expectFailure(
    "mainnet status mutation",
    () => writeManifest((value) => { value.mainnetStatus = "READY"; }),
    restoreManifest,
  );
  expectFailure(
    "license mutation",
    () => writeManifest((value) => { value.license.spdx = "UNLICENSED"; }),
    restoreManifest,
  );
  expectFailure(
    "native-quality assurance mutation",
    () => writeManifest((value) => { value.policy.nativeQualityClaimAllowed = true; }),
    restoreManifest,
  );
  expectFailure(
    "absolute workstation path mutation",
    () => writeManifest((value) => { value.runs[0].runtime.cachePath = "C:\\private\\model-cache"; }),
    restoreManifest,
  );
  expectFailure(
    "append-only run mutation",
    () => writeManifest((value) => { value.runs[0].outcomes.changedLocaleEntries += 1; }),
    restoreManifest,
  );
  expectFailure(
    "unrecorded active artifact mutation",
    () => writeFileSync(messagesPath, Buffer.concat([originalMessages, Buffer.from("\n")])),
    () => writeFileSync(messagesPath, originalMessages),
  );

  writeManifest((value) => { value.runs[0].outcomes.changedLocaleEntries += 1; });
  const stageRewrite = run("git", ["add", "--", manifestRelative], cloneRoot);
  assert(stageRewrite.status === 0, `failed to stage committed rewrite probe: ${stageRewrite.stderr}`);
  const commitRewrite = run(
    "git",
    [
      "-c",
      "user.name=IAT Provenance Regression",
      "-c",
      "user.email=provenance-regression@example.invalid",
      "commit",
      "-m",
      "test: rewrite prior provenance run",
    ],
    cloneRoot,
  );
  assert(commitRewrite.status === 0, `failed to commit rewrite probe: ${commitRewrite.stderr}`);
  const committedRewrite = runValidator();
  assert(committedRewrite.status !== 0, "committed historical rewrite unexpectedly passed");
  assert(
    `${committedRewrite.stdout}\n${committedRewrite.stderr}`.includes("localization provenance validation failed"),
    "committed historical rewrite failed outside the provenance gate",
  );

  console.log("Localization provenance regression passed: baseline plus 7 status, license, assurance, path, worktree-history, committed-history, and artifact mutations fail closed.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

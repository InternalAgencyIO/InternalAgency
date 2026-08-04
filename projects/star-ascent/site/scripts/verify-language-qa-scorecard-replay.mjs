import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sameJson = (left, right) => canonical(left) === canonical(right);
const trustedHistoricalExecutables = {
  "projects/star-ascent/site/scripts/compile-i18n-assets.mjs": "e989db9e885ed40425d586932d071242678cbbfff4f44baff166941f83a3b318",
  "projects/star-ascent/site/scripts/generate-language-qa-scorecard.mjs": "02d0b55ca3d8d77b76b3a29b8dea0b2da6ac675cc20561ad8b7d1cdbea6c570b",
  "projects/star-ascent/site/scripts/lib/read-canonical-tracked-file.mjs": "fddcaa53a532b161ba23c93e92f73838c014e94c33b5e10bd0e8ff191566ebc3",
};

const mismatchLocation = (expected, actual) => {
  const derivedKeys = new Set(["status", "summary", "lanes", "assurance", "locales"]);
  for (const key of Object.keys(expected)) {
    if (key === "generatedAt" || derivedKeys.has(key)) continue;
    if (!sameJson(expected[key], actual[key])) return key;
  }
  if (!Array.isArray(expected.locales) || !Array.isArray(actual.locales)) return "locales";
  if (expected.locales.length !== actual.locales.length) return "locales.length";
  for (const [localeIndex, expectedLocale] of expected.locales.entries()) {
    const actualLocale = actual.locales[localeIndex];
    if (expectedLocale.locale !== actualLocale?.locale) return `locales[${localeIndex}].locale`;
    for (const key of Object.keys(expectedLocale)) {
      if (!["checks", "status", "summary"].includes(key) && !sameJson(expectedLocale[key], actualLocale?.[key])) return `locales/${expectedLocale.locale}/${key}`;
    }
    if (!Array.isArray(expectedLocale.checks) || !Array.isArray(actualLocale?.checks)) return `locales/${expectedLocale.locale}/checks`;
    if (expectedLocale.checks.length !== actualLocale.checks.length) return `locales/${expectedLocale.locale}/checks.length`;
    for (const [checkIndex, expectedCheck] of expectedLocale.checks.entries()) {
      if (!sameJson(expectedCheck, actualLocale.checks[checkIndex])) {
        return `locales/${expectedLocale.locale}/${expectedCheck.id ?? checkIndex}`;
      }
    }
    for (const key of ["status", "summary"]) {
      if (!sameJson(expectedLocale[key], actualLocale[key])) return `locales/${expectedLocale.locale}/${key}`;
    }
  }
  for (const key of ["status", "summary", "lanes", "assurance"]) {
    if (!sameJson(expected[key], actual[key])) return key;
  }
  return "unknown";
};

const mismatchValue = (scorecard, location) => {
  const localeMatch = location.match(/^locales\/([^/]+)\/([^/]+)$/u);
  if (localeMatch) {
    const locale = scorecard.locales?.find((row) => row.locale === localeMatch[1]);
    if (localeMatch[2].startsWith("LQA-")) return locale?.checks?.find((check) => check.id === localeMatch[2]);
    return locale?.[localeMatch[2]];
  }
  return scorecard[location.split(/[./[]/u)[0]];
};

export function assertLanguageQaScorecardMatchesReplay({ scorecard, replay }) {
  const normalizedReplay = structuredClone(replay);
  normalizedReplay.generatedAt = scorecard.generatedAt;
  if (!sameJson(scorecard, normalizedReplay)) {
    const location = mismatchLocation(scorecard, normalizedReplay);
    throw new Error(`Language QA scorecard replay mismatch at ${location}; expectedValue=${canonical(mismatchValue(scorecard, location))} replayValue=${canonical(mismatchValue(normalizedReplay, location))}; expectedDigest=${sha256(canonical(scorecard))} replayDigest=${sha256(canonical(normalizedReplay))}`);
  }
}

export function replayLanguageQaScorecard({ scorecardBytes, repoRoot }) {
  const scorecard = JSON.parse(scorecardBytes.toString("utf8"));
  const sourceCommit = scorecard.sourceBinding?.headCommit;
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit ?? "")) throw new Error("Language QA scorecard replay refused an invalid source commit");
  execFileSync("git", ["cat-file", "-e", `${sourceCommit}^{commit}`], { cwd: repoRoot, stdio: "ignore", windowsHide: true });
  execFileSync("git", ["merge-base", "--is-ancestor", sourceCommit, "HEAD"], { cwd: repoRoot, stdio: "ignore", windowsHide: true });
  for (const [path, expectedDigest] of Object.entries(trustedHistoricalExecutables)) {
    const bytes = execFileSync("git", ["show", `${sourceCommit}:${path}`], {
      cwd: repoRoot,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (sha256(bytes) !== expectedDigest) throw new Error(`Language QA scorecard replay refused untrusted historical executable bytes: ${path}`);
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), "iat-language-qa-replay-"));
  const worktreeRoot = join(temporaryRoot, "source");
  const outputPath = join(temporaryRoot, "replay.json");
  let worktreeAdded = false;
  try {
    execFileSync("git", ["worktree", "add", "--detach", worktreeRoot, sourceCommit], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    worktreeAdded = true;
    const sourceSiteRoot = join(worktreeRoot, "projects", "star-ascent", "site");
    const compilerPath = join(sourceSiteRoot, "scripts", "compile-i18n-assets.mjs");
    const generatorPath = join(sourceSiteRoot, "scripts", "generate-language-qa-scorecard.mjs");
    execFileSync(process.execPath, [compilerPath], {
      cwd: sourceSiteRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    execFileSync(process.execPath, [generatorPath, "--output", outputPath], {
      cwd: sourceSiteRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const replay = JSON.parse(readFileSync(outputPath, "utf8"));
    assertLanguageQaScorecardMatchesReplay({ scorecard, replay });
    return { resultCount: replay.scope.results, sourceCommit, trustedExecutableCount: Object.keys(trustedHistoricalExecutables).length };
  } finally {
    if (worktreeAdded) {
      const removal = spawnSync("git", ["worktree", "remove", "--force", worktreeRoot], {
        cwd: repoRoot,
        encoding: "utf8",
        windowsHide: true,
      });
      if (removal.status !== 0) {
        throw new Error(`Language QA scorecard replay could not remove its temporary worktree: ${removal.stderr?.trim() || "unknown error"}`);
      }
    }
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function main() {
  const siteRoot = process.cwd();
  const repoRoot = resolve(siteRoot, "../../..");
  const scorecardPath = resolve(siteRoot, "public/audits/localization-qa-20260803/language-qa-scorecard.json");
  const scorecardBytes = readCanonicalTrackedFile({ repoRoot, absolutePath: scorecardPath });
  const result = replayLanguageQaScorecard({ scorecardBytes, repoRoot });
  console.log(`Language QA scorecard replay valid: all ${result.resultCount.toLocaleString("en-US")} outcomes match a fresh clean-worktree compile and exact historical generator run at ${result.sourceCommit.slice(0, 12)} after ${result.trustedExecutableCount} executable digests were allowlisted; generation time normalized only.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

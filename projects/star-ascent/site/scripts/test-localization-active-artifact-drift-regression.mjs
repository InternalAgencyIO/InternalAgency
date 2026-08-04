import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyReportBoundFiles } from "./check-localization-active-artifact-drift.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const root = mkdtempSync(join(tmpdir(), "iat-i18n-active-artifact-"));

try {
  const fixturePath = "app/i18n/LocaleRuntime.tsx";
  const fixture = Buffer.from("source-bound locale runtime\n");
  mkdirSync(join(root, "app/i18n"), { recursive: true });
  writeFileSync(join(root, fixturePath), fixture);
  const report = {
    schemaVersion: 1,
    files: {
      [fixturePath]: { bytes: fixture.length, sha256: sha256(fixture) },
    },
  };

  assert.equal(verifyReportBoundFiles({ siteRoot: root, report }), 1);

  writeFileSync(join(root, fixturePath), "unrecorded mutation\n");
  assert.throws(
    () => verifyReportBoundFiles({ siteRoot: root, report }),
    /LocaleRuntime\.tsx differs from the active public report/,
  );
  assert.throws(
    () => verifyReportBoundFiles({ siteRoot: root, report: { ...report, files: { "../escape": report.files[fixturePath] } } }),
    /path escapes site root/,
  );
  assert.throws(
    () => verifyReportBoundFiles({ siteRoot: root, report: { ...report, files: { "app/i18n/missing.tsx": report.files[fixturePath] } } }),
    /missing bound file/,
  );

  console.log("Localization active-artifact regression passed: baseline plus content, traversal, and missing-file mutations fail closed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}

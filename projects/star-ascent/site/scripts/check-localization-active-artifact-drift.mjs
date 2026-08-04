import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultSiteRoot = resolve(dirname(scriptPath), "..");
const defaultReportPath = resolve(
  defaultSiteRoot,
  "public/audits/localization-qa-20260803/report.json",
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function verifyReportBoundFiles({ siteRoot, report }) {
  if (report?.schemaVersion !== 1 || !report.files || typeof report.files !== "object") {
    throw new Error("localization active-artifact preflight failed: unsupported report schema");
  }

  const entries = Object.entries(report.files);
  if (entries.length === 0) {
    throw new Error("localization active-artifact preflight failed: report has no bound files");
  }

  for (const [path, expected] of entries) {
    if (isAbsolute(path)) {
      throw new Error(`localization active-artifact preflight failed: absolute path is forbidden: ${path}`);
    }
    const absolutePath = resolve(siteRoot, path);
    const relativePath = relative(siteRoot, absolutePath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error(`localization active-artifact preflight failed: path escapes site root: ${path}`);
    }

    let bytes;
    try {
      bytes = readFileSync(absolutePath);
    } catch {
      throw new Error(`localization active-artifact preflight failed: missing bound file: ${path}`);
    }
    if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) {
      throw new Error(
        `localization active-artifact preflight failed: ${path} differs from the active public report; ` +
          "create and validate a new append-only provenance run before regenerating evidence",
      );
    }
  }

  return entries.length;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const report = JSON.parse(readFileSync(defaultReportPath, "utf8"));
  const count = verifyReportBoundFiles({ siteRoot: defaultSiteRoot, report });
  console.log(
    `Localization active-artifact preflight PASS: ${count} report-bound files match active public evidence.`,
  );
}

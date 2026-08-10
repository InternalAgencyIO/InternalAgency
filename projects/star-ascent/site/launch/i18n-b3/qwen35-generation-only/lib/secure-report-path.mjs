import { randomUUID } from "node:crypto";
import { link, lstat, realpath, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CACHE_ROOT = path.resolve("E:\\CodexCache");

function isDescendant(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function assertDescendant(root, target, label) {
  if (!isDescendant(root, target)) throw new Error(`${label} must remain below canonical cache root ${root}`);
}

export async function resolveSecureReportTarget({ outputDir, reportName, cacheRoot = DEFAULT_CACHE_ROOT }) {
  if (typeof reportName !== "string" || reportName.length === 0 || reportName !== path.basename(reportName) || reportName === "." || reportName === ".." || reportName.includes("\0")) {
    throw new Error("report name must be one non-empty basename");
  }
  if (typeof outputDir !== "string" || !path.isAbsolute(outputDir)) throw new Error("output directory must be an absolute path");

  const canonicalRoot = await realpath(cacheRoot);
  const lexicalParent = path.resolve(outputDir);
  assertDescendant(canonicalRoot, lexicalParent, "lexical output directory");
  const canonicalParent = await realpath(lexicalParent);
  assertDescendant(canonicalRoot, canonicalParent, "canonical output directory");
  if (!(await stat(canonicalParent)).isDirectory()) throw new Error("canonical output parent is not a directory");

  const target = path.join(canonicalParent, reportName);
  const existing = await lstat(target).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (existing) throw new Error(`refusing to overwrite existing report path: ${target}`);
  return { canonicalRoot, canonicalParent, reportName, target };
}

export async function writeExclusiveAtomicReport(security, bytes) {
  const parentNow = await realpath(security.canonicalParent);
  if (parentNow !== security.canonicalParent) throw new Error("output parent canonical identity changed before write");
  assertDescendant(security.canonicalRoot, parentNow, "canonical output directory at write time");
  if (path.dirname(security.target) !== parentNow || path.basename(security.target) !== security.reportName) {
    throw new Error("secured report target changed before write");
  }

  const temporary = path.join(parentNow, `.${security.reportName}.tmp-${process.pid}-${randomUUID()}`);
  await writeFile(temporary, bytes, { flag: "wx" });
  try {
    await link(temporary, security.target);
  } catch (error) {
    throw new Error(`exclusive report publish failed: ${error.message}`);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return security.target;
}

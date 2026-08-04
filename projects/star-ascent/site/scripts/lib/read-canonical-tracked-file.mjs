import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";

const gitStatus = (repoRoot, args) => spawnSync("git", args, {
  cwd: repoRoot,
  encoding: "utf8",
  windowsHide: true,
});

export function readCanonicalTrackedFile({ repoRoot, absolutePath }) {
  const repoRelativePath = relative(repoRoot, absolutePath).replaceAll("\\", "/");
  if (isAbsolute(repoRelativePath) || repoRelativePath === ".." || repoRelativePath.startsWith("../")) {
    throw new Error(`Refusing to read outside repository root: ${absolutePath}`);
  }

  const tracked = gitStatus(repoRoot, ["ls-files", "--error-unmatch", "--", repoRelativePath]).status === 0;
  if (tracked) {
    const worktreeClean = gitStatus(repoRoot, ["diff", "--quiet", "--", repoRelativePath]).status === 0;
    const indexClean = gitStatus(repoRoot, ["diff", "--cached", "--quiet", "--", repoRelativePath]).status === 0;
    if (worktreeClean && indexClean) {
      return execFileSync("git", ["show", `HEAD:${repoRelativePath}`], {
        cwd: repoRoot,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      });
    }
  }

  return readFileSync(absolutePath);
}

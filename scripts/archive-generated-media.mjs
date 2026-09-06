import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  appendFile,
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import process from "node:process";

const MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
  ".bmp",
  ".avif",
  ".svg",
  ".ico",
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".m4v",
]);

const MIME_BY_EXTENSION = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
};

function parseArgs(argv) {
  const options = {
    apply: false,
    generatedRoot: join(homedir(), ".codex", "generated_images"),
    legacyRoots: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--generated-root") {
      options.generatedRoot = resolve(argv[++index]);
    } else if (argument === "--legacy-root") {
      options.legacyRoots.push(resolve(argv[++index]));
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: node scripts/archive-generated-media.mjs [--apply] " +
          "[--generated-root PATH] [--legacy-root PATH ...]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function gitOutput(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });
}

function decodeNullList(buffer) {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.replaceAll("\\", "/"));
}

function isMediaPath(filePath) {
  return MEDIA_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function toPosix(filePath) {
  return filePath.split(sep).join("/");
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkMedia(
  root,
  { recursive = true, skipDirectoryNames = new Set() } = {},
) {
  if (!(await pathExists(root))) return [];

  const output = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (recursive && !skipDirectoryNames.has(entry.name.toLowerCase())) {
          pending.push(absolutePath);
        }
      } else if (entry.isFile() && isMediaPath(entry.name)) {
        output.push(absolutePath);
      }
    }
  }

  return output.sort((left, right) => left.localeCompare(right));
}

async function sha256File(filePath) {
  return await new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const input = createReadStream(filePath);
    input.on("error", rejectHash);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function occurrenceId(sourceKind, sourcePath, digest) {
  return createHash("sha256")
    .update(`${sourceKind}\0${sourcePath}\0${digest}`)
    .digest("hex");
}

function inferStatus(sourceKind, sourcePath, bytes) {
  if (bytes === 0) return "failed-empty-output";
  const lower = sourcePath.toLowerCase();
  if (lower.includes("rejected")) return "rejected";
  if (lower.includes("superseded")) return "superseded";
  if (sourceKind === "repo-tracked" && lower.startsWith("assets/")) {
    return "canonical-repository-asset";
  }
  return "unclassified-progress";
}

function inferThreadId(sourceKind, sourcePath) {
  if (sourceKind !== "codex-generated-images") return null;
  const firstSegment = sourcePath.split("/")[2];
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(firstSegment)
    ? firstSegment
    : null;
}

function inferNumber(sourcePath, label) {
  const expression = new RegExp(`(?:^|[\\/-])${label}[-_ ]?(\\d+)(?:[\\/._-]|$)`, "i");
  const match = sourcePath.match(expression);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function loadOccurrenceIds(manifestPath) {
  if (!(await pathExists(manifestPath))) return new Set();

  const ids = new Set();
  const content = await readFile(manifestPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.occurrenceId) ids.add(row.occurrenceId);
    } catch (error) {
      throw new Error(`Invalid JSONL row in ${manifestPath}: ${error.message}`);
    }
  }
  return ids;
}

async function materializeBlob(sourcePath, destinationPath, digest) {
  await mkdir(resolve(destinationPath, ".."), { recursive: true });
  if (await pathExists(destinationPath)) {
    const existingDigest = await sha256File(destinationPath);
    if (existingDigest !== digest) {
      throw new Error(`Blob collision at ${destinationPath}`);
    }
    return "existing";
  }

  await copyFile(sourcePath, destinationPath);
  return "copy";
}

function addOccurrence(target, seenSourceKeys, occurrence) {
  const key = `${occurrence.sourceKind}\0${occurrence.sourcePath}`;
  if (seenSourceKeys.has(key)) return;
  seenSourceKeys.add(key);
  target.push(occurrence);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(
    gitOutput(process.cwd(), ["rev-parse", "--show-toplevel"])
      .toString("utf8")
      .trim(),
  );
  const archiveRoot = join(repoRoot, "progress-reports", "codex-generated-media");
  const blobRoot = join(archiveRoot, "blobs");
  const manifestPath = join(archiveRoot, "manifest.jsonl");
  const framePackRoot = join(
    repoRoot,
    "tools",
    "framepack-runtime",
    "FramePack-current",
    "outputs",
  );
  const artifactsRoot = join(repoRoot, "artifacts");
  const occurrences = [];
  const seenSourceKeys = new Set();

  const trackedPaths = decodeNullList(gitOutput(repoRoot, ["ls-files", "-z"]));
  const untrackedPaths = decodeNullList(
    gitOutput(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
  );

  for (const repositoryPath of trackedPaths) {
    if (!isMediaPath(repositoryPath)) continue;
    if (repositoryPath.startsWith("progress-reports/codex-generated-media/")) continue;
    addOccurrence(occurrences, seenSourceKeys, {
      absolutePath: join(repoRoot, ...repositoryPath.split("/")),
      repositoryPath,
      sourceKind: "repo-tracked",
      sourcePath: `repo/${repositoryPath}`,
      canonicalRank: 0,
    });
  }

  for (const repositoryPath of untrackedPaths) {
    if (!isMediaPath(repositoryPath)) continue;
    if (repositoryPath.startsWith("progress-reports/codex-generated-media/")) continue;
    addOccurrence(occurrences, seenSourceKeys, {
      absolutePath: join(repoRoot, ...repositoryPath.split("/")),
      repositoryPath,
      sourceKind: "repo-untracked",
      sourcePath: `repo/${repositoryPath}`,
      canonicalRank: 1,
    });
  }

  for (const absolutePath of await walkMedia(framePackRoot, { recursive: false })) {
    addOccurrence(occurrences, seenSourceKeys, {
      absolutePath,
      sourceKind: "framepack-output",
      sourcePath: `framepack-output/${basename(absolutePath)}`,
      canonicalRank: 3,
    });
  }

  for (const absolutePath of await walkMedia(artifactsRoot)) {
    addOccurrence(occurrences, seenSourceKeys, {
      absolutePath,
      sourceKind: "ignored-artifact",
      sourcePath: `from-artifacts/${toPosix(relative(artifactsRoot, absolutePath))}`,
      canonicalRank: 3,
    });
  }

  for (const absolutePath of await walkMedia(options.generatedRoot)) {
    addOccurrence(occurrences, seenSourceKeys, {
      absolutePath,
      sourceKind: "codex-generated-images",
      sourcePath: `.codex/generated_images/${toPosix(relative(options.generatedRoot, absolutePath))}`,
      canonicalRank: 2,
    });
  }

  for (const legacyRoot of options.legacyRoots) {
    for (const absolutePath of await walkMedia(legacyRoot, {
      skipDirectoryNames: new Set([
        ".git",
        ".codex",
        "node_modules",
        "release",
        "tools",
      ]),
    })) {
      addOccurrence(occurrences, seenSourceKeys, {
        absolutePath,
        sourceKind: "legacy-workspace",
        sourcePath: `legacy-workspace/${basename(legacyRoot)}/${toPosix(relative(legacyRoot, absolutePath))}`,
        canonicalRank: 3,
      });
    }
  }

  occurrences.sort((left, right) => {
    return (
      left.canonicalRank - right.canonicalRank ||
      left.sourceKind.localeCompare(right.sourceKind) ||
      left.sourcePath.localeCompare(right.sourcePath)
    );
  });

  const byDigest = new Map();
  let totalBytes = 0;
  for (let index = 0; index < occurrences.length; index += 1) {
    const occurrence = occurrences[index];
    const fileStat = await stat(occurrence.absolutePath);
    occurrence.bytes = fileStat.size;
    occurrence.observedAtUtc = fileStat.mtime.toISOString();
    occurrence.extension = extname(occurrence.absolutePath).toLowerCase();
    occurrence.sha256 = await sha256File(occurrence.absolutePath);
    totalBytes += occurrence.bytes;

    if (!byDigest.has(occurrence.sha256)) byDigest.set(occurrence.sha256, []);
    byDigest.get(occurrence.sha256).push(occurrence);
    if ((index + 1) % 100 === 0 || index + 1 === occurrences.length) {
      console.log(`Hashed ${index + 1}/${occurrences.length}`);
    }
  }

  const existingIds = await loadOccurrenceIds(manifestPath);
  const importedAtUtc = new Date().toISOString();
  const newRows = [];
  let newBlobBytes = 0;
  let createdBlobs = 0;
  let linkedBlobs = 0;
  let copiedBlobs = 0;

  for (const [digest, group] of byDigest) {
    const repositoryOccurrence = group.find(
      (item) =>
        item.sourceKind === "repo-tracked" ||
        item.repositoryPath?.startsWith("assets/"),
    );
    let canonicalPath = repositoryOccurrence?.repositoryPath ?? null;

    if (!canonicalPath && group[0].bytes > 0) {
      const source = group[0];
      const blobExtension = source.extension || ".bin";
      canonicalPath =
        `progress-reports/codex-generated-media/blobs/${digest.slice(0, 2)}/` +
        `${digest}${blobExtension}`;
      if (options.apply) {
        const mode = await materializeBlob(
          source.absolutePath,
          join(repoRoot, ...canonicalPath.split("/")),
          digest,
        );
        if (mode === "hardlink") linkedBlobs += 1;
        if (mode === "copy") copiedBlobs += 1;
        if (mode !== "existing") {
          createdBlobs += 1;
          newBlobBytes += source.bytes;
        }
      } else if (!(await pathExists(join(repoRoot, ...canonicalPath.split("/"))))) {
        createdBlobs += 1;
        newBlobBytes += source.bytes;
      }
    }

    for (const occurrence of group) {
      const id = occurrenceId(occurrence.sourceKind, occurrence.sourcePath, digest);
      if (existingIds.has(id)) continue;
      const row = {
        schemaVersion: 1,
        occurrenceId: id,
        importedAtUtc,
        observedAtUtc: occurrence.observedAtUtc,
        sha256: digest,
        bytes: occurrence.bytes,
        extension: occurrence.extension,
        mime: MIME_BY_EXTENSION[occurrence.extension] ?? "application/octet-stream",
        sourceKind: occurrence.sourceKind,
        sourcePath: occurrence.sourcePath,
        status: inferStatus(
          occurrence.sourceKind,
          occurrence.sourcePath,
          occurrence.bytes,
        ),
        canonicalPath,
      };
      const threadId = inferThreadId(occurrence.sourceKind, occurrence.sourcePath);
      const batch = inferNumber(occurrence.sourcePath, "batch");
      const scene = inferNumber(occurrence.sourcePath, "scene");
      if (threadId !== null) row.threadId = threadId;
      if (batch !== null) row.batch = batch;
      if (scene !== null) row.scene = scene;
      newRows.push(row);
    }
  }

  newRows.sort((left, right) => {
    return (
      left.sourceKind.localeCompare(right.sourceKind) ||
      left.sourcePath.localeCompare(right.sourcePath) ||
      left.sha256.localeCompare(right.sha256)
    );
  });

  if (options.apply && newRows.length > 0) {
    await mkdir(archiveRoot, { recursive: true });
    const body = `${newRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
    await appendFile(manifestPath, body, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        occurrences: occurrences.length,
        logicalBytes: totalBytes,
        uniqueContents: byDigest.size,
        newManifestRows: newRows.length,
        newBlobs: createdBlobs,
        newBlobBytes,
        hardlinksCreated: linkedBlobs,
        copiesCreated: copiedBlobs,
        manifest: toPosix(relative(repoRoot, manifestPath)),
      },
      null,
      2,
    ),
  );
}

await main();

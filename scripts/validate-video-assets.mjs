import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPinnedFfprobeSession,
  EXPECTED_MASTER_COUNT,
  parsePinnedReleaseInventory,
  validateVideoRelease
} from "./lib/video-asset-validation.mjs";

const repo = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ffprobeArgument(argv) {
  let value = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--ffprobe" || index + 1 >= argv.length || value !== null) {
      throw new Error("usage: node scripts/validate-video-assets.mjs --ffprobe <absolute-pinned-ffprobe-path>");
    }
    value = argv[index + 1];
    index += 1;
  }
  return value ?? process.env.RADIANCE_FFPROBE_PATH ?? null;
}

try {
  const ffprobePath = ffprobeArgument(process.argv.slice(2));
  const pin = readJson(path.join(repo, "scripts", "video", "ffprobe-tool.json"), "ffprobe pin");
  const releaseInventory = parsePinnedReleaseInventory(
    fs.readFileSync(path.join(repo, "scripts", "video", "release-inventory.json"))
  );
  const videoConfig = readJson(path.join(repo, "scripts", "video", "scenes.json"), "scene config");
  const manifest = readJson(path.join(repo, "assets", "videos", "manifest.json"), "video manifest");
  const ffprobeSession = createPinnedFfprobeSession(ffprobePath, pin);
  let result;
  let toolEvidence;
  try {
    result = validateVideoRelease({
      repo,
      videoConfig,
      releaseInventory,
      manifest,
      ffprobeSession
    });
    toolEvidence = ffprobeSession.evidence;
  } finally {
    ffprobeSession.close();
  }

  if (result.failures.length > 0) {
    console.error(
      `Radiance release assets are incomplete: ${result.missingMasters.length} required full masters are missing.\n` +
        `Pinned ffprobe: ${toolEvidence.sha256} (${toolEvidence.bytes} bytes).\n` +
        `Recomputed source evidence for ${result.checkedSources.length} unique pinned sources.\n` +
        `Recomputed evidence for ${result.checked.length}/${EXPECTED_MASTER_COUNT} expected full masters.\n` +
        `- ${result.failures.join("\n- ")}`
    );
    process.exitCode = 1;
  } else {
    console.log(
        `Validated ${EXPECTED_MASTER_COUNT} pre-rendered 30 fps Radiance full masters with recomputed ` +
        `SHA-256, byte length, decoded frame count, fps, and duration.\n` +
        `Pinned source images: ${result.checkedSources.length}.\n` +
        `Pinned ffprobe: ${toolEvidence.sha256} (${toolEvidence.bytes} bytes).`
    );
  }
} catch (error) {
  console.error(`Radiance video validation failed closed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

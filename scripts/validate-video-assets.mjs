import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videoConfig = JSON.parse(
  fs.readFileSync(path.join(repo, "scripts", "video", "scenes.json"), "utf8")
);
const manifestPath = path.join(repo, "assets", "videos", "manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("Missing assets/videos/manifest.json. Render the full scene set first.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];

for (const scene of videoConfig.scenes) {
  const file = `${scene.id}-full-30fps.mp4`;
  const filePath = path.join(repo, "assets", "videos", file);
  const entry = manifest.assets?.[file];

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100_000) {
    failures.push(`${file}: missing or empty`);
    continue;
  }
  if (!entry || Math.abs(Number(entry.fps) - 30) > 0.01) {
    failures.push(`${file}: missing verified 30 fps metadata`);
  }
  if (Number(entry.durationSeconds) < scene.durationSeconds - 1) {
    failures.push(`${file}: shorter than configured scene duration`);
  }
}

if (failures.length) {
  console.error(`Radiance release assets are incomplete:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Validated ${videoConfig.scenes.length} pre-rendered 30 fps Radiance scenes.`);

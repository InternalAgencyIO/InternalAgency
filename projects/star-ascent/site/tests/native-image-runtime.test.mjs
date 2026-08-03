import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const runtimeSensitivePages = [
  "app/dossier/page.tsx",
  "app/dossier/read/[slug]/page.tsx",
  "app/page.tsx",
  "app/press/page.tsx",
  "app/world/page.tsx",
];

const expectedAssets = new Map([
  ["/images/stage-manager-story.webp", [1672, 941]],
  ["/images/scorpion-commander-portrait-v1.webp", [1024, 1536]],
  ["/images/scorpion-crew-arrival-v1.webp", [1672, 941]],
  ["/images/outer-comms-v1.webp", [1823, 863]],
  ["/images/ascent-ritual-v1.webp", [1536, 1024]],
  ["/images/launch-core-radiance-v1.png", [1935, 813]],
  ["/images/radiance-roller-rave.webp", [853, 1844]],
]);

test("Vinext runtime-sensitive pages stay on native image elements", async () => {
  for (const path of runtimeSensitivePages) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["']next\/image["']/, `${path} must not reintroduce the incompatible next/image runtime`);
    assert.match(source, /Vinext runtime does not safely support next\/image/, `${path} must document the native-image exception`);
  }
});

test("static native artwork declares its verified intrinsic dimensions", async () => {
  const sources = (await Promise.all(runtimeSensitivePages.map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")))).join("\n");
  for (const [asset, [width, height]] of expectedAssets) {
    const escapedAsset = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      sources,
      new RegExp(`src=["']${escapedAsset}["'][^>]*width=\\{${width}\\}[^>]*height=\\{${height}\\}`),
      `${asset} must retain its verified ${width}×${height} intrinsic dimensions`,
    );
  }
});

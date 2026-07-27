import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  DEFAULT_SIGNAL,
  SceneScheduler,
  mergeSignal,
  selectReactiveScene
} from "../src/engine/scene-engine.js";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../assets/scene-manifest.json", import.meta.url), "utf8")
);
const videoConfig = JSON.parse(
  fs.readFileSync(new URL("../scripts/video/scenes.json", import.meta.url), "utf8")
);

test("collection is sixteen scenes and seven minutes", () => {
  const scheduler = new SceneScheduler(manifest.scenes);
  assert.equal(manifest.scenes.length, 16);
  assert.equal(scheduler.totalDurationSeconds, 420);
  assert.equal(manifest.totalDurationSeconds, 420);
});

test("scene scheduler wraps in both directions", () => {
  const scheduler = new SceneScheduler(manifest.scenes);
  assert.equal(scheduler.move(-1).id, "butterfly-code-couture");
  assert.equal(scheduler.move(1).id, "neon-listening-lounge");
});

test("fast techno selects the chrome catwalk", () => {
  const signal = mergeSignal(DEFAULT_SIGNAL, {
    music: { genre: "techno", bpm: 134, energy: "driving" }
  });
  assert.equal(
    selectReactiveScene(manifest.scenes, signal)?.id,
    "chrome-catwalk"
  );
});

test("hypnotic techno selects the pole ballet", () => {
  const signal = mergeSignal(DEFAULT_SIGNAL, {
    music: { genre: "techno", bpm: 118, energy: "hypnotic" }
  });
  assert.equal(
    selectReactiveScene(manifest.scenes, signal)?.id,
    "orbit-pole-ballet"
  );
});

test("task and away signals select operator scenes", () => {
  const analysis = mergeSignal(DEFAULT_SIGNAL, {
    task: { state: "running", kind: "analysis" }
  });
  const away = mergeSignal(DEFAULT_SIGNAL, {
    task: { state: "waiting" },
    user: { away: true }
  });
  assert.equal(selectReactiveScene(manifest.scenes, analysis)?.id, "world-operator");
  assert.equal(selectReactiveScene(manifest.scenes, away)?.id, "velvet-reset");
});

test("milestones override other matching cues with the finale", () => {
  const signal = mergeSignal(DEFAULT_SIGNAL, {
    music: { genre: "techno", bpm: 132 },
    session: { milestone: true }
  });
  assert.equal(selectReactiveScene(manifest.scenes, signal)?.id, "red-heel-finale");
});

test("every scene has a locked-camera 30 fps video specification", () => {
  assert.equal(videoConfig.fps, 30);
  assert.equal(videoConfig.scenes.length, manifest.scenes.length);
  assert.equal(
    videoConfig.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    420
  );
  for (const scene of videoConfig.scenes) {
    assert.match(scene.prompt, /locked camera|locked tracking position/i);
    assert.match(scene.prompt, /no zoom/i);
    assert.ok(fs.existsSync(new URL(`../${scene.source}`, import.meta.url)));
  }
});

test("six enrichment scenes are twenty-second HQ renders", () => {
  const enrichment = videoConfig.scenes.filter((scene) => scene.collection === "enrichment");
  assert.equal(enrichment.length, 6);
  for (const scene of enrichment) {
    assert.equal(scene.durationSeconds, 20);
    assert.ok(scene.steps >= 30);
    assert.ok(scene.mp4Crf <= 14);
  }
});

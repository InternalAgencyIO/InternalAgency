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

test("pilot is exactly ten scenes and five minutes", () => {
  const scheduler = new SceneScheduler(manifest.scenes);
  assert.equal(manifest.scenes.length, 10);
  assert.equal(scheduler.totalDurationSeconds, 300);
  assert.equal(manifest.totalDurationSeconds, 300);
});

test("scene scheduler wraps in both directions", () => {
  const scheduler = new SceneScheduler(manifest.scenes);
  assert.equal(scheduler.move(-1).id, "red-heel-finale");
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

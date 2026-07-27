const REACTIVE_SCORES = {
  "neon-listening-lounge": (s) =>
    s.music.genre === "techno" && s.music.bpm >= 90 && s.music.bpm < 126 ? 70 : 0,
  "chrome-catwalk": (s) =>
    s.music.genre === "techno" && s.music.bpm >= 126 ? 80 : 0,
  "orbit-pole-ballet": (s) =>
    s.music.genre === "techno" && s.music.energy === "hypnotic" ? 90 : 0,
  "world-operator": (s) =>
    s.task.state === "running" && s.task.kind === "analysis" ? 85 : 0,
  "rooftop-signal-hunt": (s) =>
    s.task.state === "running" && s.task.kind === "search" ? 85 : 0,
  "containment-run": (s) =>
    s.task.state === "running" && s.urgency === "high" ? 95 : 0,
  "controlled-breach": (s) =>
    s.task.state === "running" && s.plan === "bold" ? 92 : 0,
  "velvet-reset": (s) =>
    s.task.state === "waiting" || s.user.away ? 75 : 0,
  "dawn-data-garden": (s) =>
    s.task.state === "review" && s.outcome === "success" ? 88 : 0,
  "red-heel-finale": (s) =>
    s.session.milestone || s.music.outro ? 100 : 0
};

export const DEFAULT_SIGNAL = Object.freeze({
  music: { genre: "unknown", bpm: 0, energy: "calm", level: 0, outro: false },
  task: { state: "idle", kind: "none" },
  urgency: "normal",
  plan: "steady",
  user: { away: false },
  outcome: "unknown",
  session: { milestone: false }
});

export function mergeSignal(base, patch) {
  return {
    ...base,
    ...patch,
    music: { ...base.music, ...(patch.music || {}) },
    task: { ...base.task, ...(patch.task || {}) },
    user: { ...base.user, ...(patch.user || {}) },
    session: { ...base.session, ...(patch.session || {}) }
  };
}

export function scoreScene(scene, signal) {
  return REACTIVE_SCORES[scene.id]?.(signal) || 0;
}

export function selectReactiveScene(scenes, signal, currentId = "") {
  const ranked = scenes
    .map((scene, index) => ({
      scene,
      index,
      score: scoreScene(scene, signal)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = ranked[0];
  if (!best || best.score === 0) return null;

  const current = ranked.find((entry) => entry.scene.id === currentId);
  if (current && current.score > 0 && current.score >= best.score - 5) return current.scene;
  return best.scene;
}

export class SceneScheduler {
  constructor(scenes, startIndex = 0) {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error("SceneScheduler requires at least one scene");
    }
    this.scenes = scenes;
    this.index = ((startIndex % scenes.length) + scenes.length) % scenes.length;
  }

  get current() {
    return this.scenes[this.index];
  }

  move(delta) {
    this.index = (this.index + delta + this.scenes.length) % this.scenes.length;
    return this.current;
  }

  goTo(id) {
    const next = this.scenes.findIndex((scene) => scene.id === id);
    if (next >= 0) this.index = next;
    return this.current;
  }

  get totalDurationSeconds() {
    return this.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  }
}

import {
  DEFAULT_SIGNAL,
  SceneScheduler,
  mergeSignal,
  selectReactiveScene
} from "../engine/scene-engine.js";

const $ = (selector) => document.querySelector(selector);
const image = $("#scene-image");
const sceneVideo = $("#scene-video");
const sceneCopy = $(".scene-copy");
const stage = $("#stage");
const progress = $("#progress");
const playButton = $("#play");
const listenButton = $("#listen");
const modeSelect = $("#mode");
const canvas = $("#atmosphere");
const context = canvas.getContext("2d");

const MOTION = [
  { x: "2.4%", y: "-1.4%", zoom: 1.08, accent: "#4da7ff" },
  { x: "-2.5%", y: "-0.7%", zoom: 1.1, accent: "#e5e8ef" },
  { x: "1.2%", y: "-2.2%", zoom: 1.09, accent: "#67b7ff" },
  { x: "-1.8%", y: "1.2%", zoom: 1.07, accent: "#45a8d8" },
  { x: "2.5%", y: "0.4%", zoom: 1.1, accent: "#79a1dd" },
  { x: "-2.2%", y: "-1.5%", zoom: 1.12, accent: "#f4b65f" },
  { x: "1.8%", y: "0.8%", zoom: 1.1, accent: "#e6a34b" },
  { x: "-1.3%", y: "-1.2%", zoom: 1.08, accent: "#d2a4dd" },
  { x: "2.2%", y: "-1.8%", zoom: 1.09, accent: "#f2cc83" },
  { x: "-1.6%", y: "-0.8%", zoom: 1.08, accent: "#7caeff" }
];

let manifest;
let scheduler;
let signal = structuredClone(DEFAULT_SIGNAL);
let elapsed = 0;
let playing = true;
let mode = "sequence";
let switching = false;
let lastFrame = performance.now();
let audioState = null;
let nextReactiveCheck = 0;

function sceneAsset(index, scene) {
  if (scene.source) {
    return new URL(`../../${scene.source}`, import.meta.url).href;
  }
  return new URL(
    `../../assets/scenes/${String(index + 1).padStart(2, "0")}-${scene.id}.png`,
    import.meta.url
  ).href;
}

function videoAsset(scene, suffix) {
  return new URL(
    `../../assets/videos/${scene.id}-${suffix}-30fps.mp4`,
    import.meta.url
  ).href;
}

function tryVideo(url) {
  return new Promise((resolve) => {
    const cleanup = () => {
      sceneVideo.removeEventListener("loadedmetadata", loaded);
      sceneVideo.removeEventListener("error", failed);
    };
    const loaded = () => {
      cleanup();
      resolve(true);
    };
    const failed = () => {
      cleanup();
      resolve(false);
    };
    sceneVideo.addEventListener("loadedmetadata", loaded, { once: true });
    sceneVideo.addEventListener("error", failed, { once: true });
    sceneVideo.src = url;
    sceneVideo.load();
  });
}

async function loadSceneMedia(index, scene) {
  sceneVideo.pause();
  stage.classList.remove("video-active");
  image.src = sceneAsset(index, scene);
  image.alt = `${titleCase(scene.id)} — ${scene.setting}`;

  for (const suffix of ["full", "draft"]) {
    if (await tryVideo(videoAsset(scene, suffix))) {
      stage.classList.add("video-active");
      sceneVideo.currentTime = 0;
      if (playing) await sceneVideo.play();
      $("#status").textContent = "GENERATED MOTION · 30 FPS";
      return;
    }
  }
  sceneVideo.removeAttribute("src");
  $("#status").textContent = "MOTION GENERATION PENDING";
}

function titleCase(value) {
  return value
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function renderDots() {
  const dots = $("#scene-dots");
  dots.replaceChildren(
    ...manifest.scenes.map((scene, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.title = titleCase(scene.id);
      button.setAttribute("aria-label", `Scene ${index + 1}: ${titleCase(scene.id)}`);
      button.addEventListener("click", () => showScene(index));
      return button;
    })
  );
}

function updateDots() {
  [...$("#scene-dots").children].forEach((dot, index) => {
    dot.classList.toggle("active", index === scheduler.index);
  });
}

async function showScene(index, immediate = false) {
  if (switching && !immediate) return;
  switching = true;
  scheduler.index = (index + manifest.scenes.length) % manifest.scenes.length;
  const scene = scheduler.current;
  const motion = MOTION[scheduler.index % MOTION.length];
  elapsed = 0;

  if (!immediate) {
    image.classList.add("switching");
    sceneCopy.classList.add("switching");
    await new Promise((resolve) => setTimeout(resolve, 360));
  }

  await loadSceneMedia(scheduler.index, scene);
  $("#scene-number").textContent =
    `SCENE ${String(scheduler.index + 1).padStart(2, "0")} · 00:${String(scene.durationSeconds).padStart(2, "0")}`;
  $("#scene-title").textContent = titleCase(scene.id);
  $("#scene-action").textContent = scene.action;
  $("#scene-outfit").textContent = scene.outfit;
  stage.style.setProperty("--motion-duration", `${8 + (scheduler.index % 4) * 0.9}s`);
  stage.style.setProperty("--drift-x", motion.x);
  stage.style.setProperty("--drift-y", motion.y);
  stage.style.setProperty("--zoom", motion.zoom);
  updateDots();

  requestAnimationFrame(() => {
    image.classList.remove("switching");
    sceneCopy.classList.remove("switching");
    switching = false;
  });
}

function applyMode(nextMode) {
  mode = nextMode;
  modeSelect.value = mode;
  $("#mode-label").textContent = mode.toUpperCase();

  const modeSignals = {
    techno: { music: { genre: "techno", bpm: 132, energy: "hypnotic" } },
    operator: { task: { state: "running", kind: "analysis" } },
    away: { user: { away: true }, task: { state: "waiting" } },
    finale: { session: { milestone: true } }
  };

  if (modeSignals[mode]) {
    signal = mergeSignal(structuredClone(DEFAULT_SIGNAL), modeSignals[mode]);
    const selected = selectReactiveScene(manifest.scenes, signal, scheduler.current.id);
    if (selected) showScene(manifest.scenes.indexOf(selected));
  }
}

function maybeReact(now) {
  if (now < nextReactiveCheck || !["reactive", "techno", "operator", "away", "finale"].includes(mode)) return;
  nextReactiveCheck = now + 1600;
  const selected = selectReactiveScene(manifest.scenes, signal, scheduler.current.id);
  if (selected && selected.id !== scheduler.current.id && elapsed > 4) {
    showScene(manifest.scenes.indexOf(selected));
  }
}

function tick(now) {
  const delta = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  if (playing && !switching) {
    elapsed += delta;
    if (elapsed >= scheduler.current.durationSeconds) {
      showScene(scheduler.index + 1);
    }
  }

  progress.style.width = `${Math.min(100, (elapsed / scheduler.current.durationSeconds) * 100)}%`;
  maybeReact(now);
  drawAtmosphere(now, signal.music.level || 0);
  requestAnimationFrame(tick);
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

const motes = Array.from({ length: 27 }, (_, index) => ({
  x: (index * 37.7) % 100,
  y: (index * 61.3) % 100,
  radius: 0.45 + (index % 5) * 0.18,
  speed: 0.42 + (index % 7) * 0.08,
  phase: index * 0.73
}));

function drawAtmosphere(now, level) {
  const rect = canvas.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
  const energy = 0.55 + Math.min(level * 4, 1.5);
  for (const mote of motes) {
    const time = now * 0.0001 * mote.speed;
    const x = ((mote.x + Math.sin(time + mote.phase) * 5) / 100) * rect.width;
    const y = (((mote.y - time * 11 + 110) % 110) / 100) * rect.height;
    const alpha = (0.09 + (Math.sin(time * 5 + mote.phase) + 1) * 0.055) * energy;
    context.beginPath();
    context.fillStyle = `rgba(222, 235, 255, ${alpha})`;
    context.arc(x, y, mote.radius * energy, 0, Math.PI * 2);
    context.fill();
  }
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function startListening() {
  if (audioState) {
    stopListening();
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    stream.getVideoTracks().forEach((track) => track.stop());
    if (!stream.getAudioTracks().length) throw new Error("No loopback audio track");
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.82;
  audioContext.createMediaStreamSource(stream).connect(analyser);

  audioState = {
    stream,
    audioContext,
    analyser,
    frequency: new Uint8Array(analyser.frequencyBinCount),
    time: new Uint8Array(analyser.fftSize),
    energyHistory: [],
    beats: [],
    lastBeat: 0,
    raf: 0
  };
  listenButton.classList.add("active");
  listenButton.lastChild.textContent = " LIVE";
  modeSelect.value = "reactive";
  mode = "reactive";
  $("#mode-label").textContent = "REACTIVE";
  analyzeAudio();
}

function stopListening() {
  if (!audioState) return;
  cancelAnimationFrame(audioState.raf);
  audioState.stream.getTracks().forEach((track) => track.stop());
  audioState.audioContext.close();
  audioState = null;
  listenButton.classList.remove("active");
  listenButton.lastChild.textContent = " LISTEN";
  signal = mergeSignal(signal, {
    music: { genre: "unknown", bpm: 0, level: 0, energy: "calm" }
  });
  $("#bpm").textContent = "— BPM";
}

function analyzeAudio() {
  if (!audioState) return;
  const state = audioState;
  state.analyser.getByteTimeDomainData(state.time);
  state.analyser.getByteFrequencyData(state.frequency);

  const rms = Math.sqrt(
    state.time.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
      state.time.length
  );
  const binHz = state.audioContext.sampleRate / state.analyser.fftSize;
  const bassEnd = Math.max(1, Math.round(180 / binHz));
  const bodyEnd = Math.max(bassEnd + 1, Math.round(4000 / binHz));
  const bass = state.frequency.slice(0, bassEnd).reduce((sum, value) => sum + value, 0);
  const body = state.frequency.slice(0, bodyEnd).reduce((sum, value) => sum + value, 0);
  const bassRatio = body ? bass / body : 0;
  const now = performance.now();

  state.energyHistory.push(rms);
  if (state.energyHistory.length > 48) state.energyHistory.shift();
  const baseline =
    state.energyHistory.reduce((sum, value) => sum + value, 0) / state.energyHistory.length;

  if (rms > Math.max(0.045, baseline * 1.28) && now - state.lastBeat > 260) {
    state.beats.push(now);
    if (state.beats.length > 14) state.beats.shift();
    state.lastBeat = now;
  }

  const intervals = state.beats.slice(1).map((beat, index) => beat - state.beats[index]);
  let bpm = intervals.length >= 3 ? Math.round(60000 / median(intervals)) : 0;
  while (bpm > 180) bpm = Math.round(bpm / 2);
  while (bpm > 0 && bpm < 80) bpm = Math.round(bpm * 2);
  const genre = bpm >= 90 && bpm <= 180 && bassRatio > 0.085 ? "techno" : "unknown";
  const energy = rms > 0.17 ? "driving" : rms > 0.065 ? "hypnotic" : "calm";
  signal = mergeSignal(signal, { music: { bpm, genre, energy, level: rms } });

  $("#bpm").textContent = bpm ? `${bpm} BPM` : "LISTENING";
  stage.style.setProperty("--audio-level", String(1 + Math.min(rms * 8, 1.4)));
  state.raf = requestAnimationFrame(analyzeAudio);
}

window.radianceSignal = (detail = {}) => {
  signal = mergeSignal(signal, detail);
  if (mode === "sequence") {
    mode = "reactive";
    modeSelect.value = mode;
    $("#mode-label").textContent = "REACTIVE";
  }
  nextReactiveCheck = 0;
  return signal;
};

$("#previous").addEventListener("click", () => showScene(scheduler.index - 1));
$("#next").addEventListener("click", () => showScene(scheduler.index + 1));
playButton.addEventListener("click", () => {
  playing = !playing;
  stage.classList.toggle("paused", !playing);
  if (stage.classList.contains("video-active")) {
    if (playing) sceneVideo.play();
    else sceneVideo.pause();
  }
  playButton.textContent = playing ? "Ⅱ" : "▶";
  playButton.title = playing ? "Pause" : "Play";
});
modeSelect.addEventListener("change", () => applyMode(modeSelect.value));
listenButton.addEventListener("click", () => startListening().catch((error) => {
  $("#status").textContent = `AUDIO UNAVAILABLE · ${error.message.toUpperCase()}`;
  stopListening();
}));

let pinned = true;
$("#pin").addEventListener("click", (event) => {
  pinned = !pinned;
  event.currentTarget.classList.toggle("active", pinned);
  window.radianceDesktop?.setAlwaysOnTop(pinned);
});
$("#minimize").addEventListener("click", () => window.radianceDesktop?.minimize());
$("#close").addEventListener("click", () => window.radianceDesktop?.close());
window.addEventListener("resize", resizeCanvas);

async function initialize() {
  const response = await fetch(new URL("../../assets/scene-manifest.json", import.meta.url));
  manifest = await response.json();
  scheduler = new SceneScheduler(manifest.scenes);
  renderDots();
  resizeCanvas();
  await showScene(0, true);
  requestAnimationFrame(tick);
}

initialize().catch((error) => {
  $("#status").textContent = "RUNTIME ERROR";
  $("#scene-action").textContent = error.message;
});

"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { draw, chance, shuffle, cameraCategory, buildBank, sha256 } = require("./editorial-rolls.cjs");
const location = { name: "test", setting: "A dry bench in a park.", flagDescription: "red blue orange horizontal bands", wardrobes: ["blue mini", "gold mini", "red mini", "green mini"], shoeFinishes: ["silver", "gold", "black", "green"], deathMotif: "original skull-and-basalt design", loveMotif: "original heart-and-fruit design" };
const brief = { batch: 489, country: "Armenia", firstScene: 1983, locations: [location, location, location, location] };
test("camera boundaries preserve 20/60/20", () => {
  assert.equal(cameraCategory(1), "extreme-close"); assert.equal(cameraCategory(20), "extreme-close");
  assert.equal(cameraCategory(21), "intermediate"); assert.equal(cameraCategory(80), "intermediate");
  assert.equal(cameraCategory(81), "extreme-wide"); assert.equal(cameraCategory(100), "extreme-wide");
  assert.throws(() => cameraCategory(0)); assert.throws(() => cameraCategory(101));
});
test("rolls are deterministic, auditable and boundary-safe", () => {
  assert.deepEqual(draw("same-key"), draw("same-key"));
  assert.equal(chance("k", 0).active, false); assert.equal(chance("k", 100).active, true);
  assert.throws(() => chance("k", 101)); assert.throws(() => draw("k", 0));
  for (let i = 0; i < 1000; i++) { const r = draw(`test-${i}`); assert(r.value >= 1 && r.value <= 100); assert(r.byte < 200); }
  assert.equal(new Set(shuffle([1, 2, 3, 4, 5], "deck")).size, 5);
});
test("four varied poses and shoe families without seed hunting", () => {
  const bank = buildBank(brief); assert.deepEqual(bank, buildBank(brief));
  assert.equal(new Set(bank.scenes.map(s => s.pose)).size, 4);
  assert.equal(new Set(bank.scenes.map(s => s.camera.angle)).size, 4);
  for (const scene of bank.scenes) {
    assert.equal(new Set(scene.characters.map(c => c.shoeType)).size, 4);
    assert.equal(scene.promptSha256, sha256(scene.prompt));
    assert.equal(scene.prompt.length, scene.promptCharacters);
    assert.equal(scene.singleEditPromptSha256, sha256(scene.singleEditPrompt));
    assert.match(scene.singleEditPrompt, /Apply these exact per-character styling rolls/);
    for (const c of scene.characters) { assert.equal(Object.keys(c.tattoos).length, 12); assert.equal(new Set(Object.values(c.tattoos).map(r => r.key)).size, 12); }
  }
  for (let i = 1; i < 4; i++) for (let c = 0; c < 4; c++) assert.notEqual(bank.scenes[i].characters[c].shoeType, bank.scenes[i-1].characters[c].shoeType);
  assert.equal(bank.browserDispatchCount, 0); assert.equal(bank.editInvocationCount, 0);
});
test("extreme-close is a genuine crop, not compulsory all-shoe framing", () => {
  let checked = false;
  for (let batch = 1; batch <= 12; batch++) for (const s of buildBank({ ...brief, batch }).scenes) if (s.camera.category === "extreme-close") {
    assert.match(s.prompt, /Lower bodies and shoes may be outside the frame/);
    assert.match(s.singleEditPrompt, /Do not widen an extreme-close crop/); checked = true;
  }
  assert(checked);
});
test("independent probabilities remain near their specified rates", () => {
  const n = 50000; const targets = [4, 22, 25, 32, 33, 35, 40, 45];
  for (const percent of targets) {
    let selected = 0; for (let i = 0; i < n; i++) selected += chance(`audit|field-${percent}|sample-${i}`, percent).active;
    const rate = selected / n * 100; assert(Math.abs(rate - percent) < 1, `${percent}% became ${rate}%`);
  }
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  campaignArt,
  campaignScenes,
  crewIds,
  gameIds,
  hostById,
  hostForId,
  hostProfiles,
  narrativePolicy,
  storyByGame,
  storyForGame,
} from "../app/future/casino/demo/nightflight-narrative.mjs";

const expectedGameIds = ["plinko", "dice", "roulette", "mines", "keno", "limbo", "slots", "baccarat", "blackjack", "crash"];
const expectedCrewIds = ["radiance", "ellie", "alia", "ece"];
const expectedNames = ["Radiance", "Ellie", "Alia", "AI ECE"];

test("Nightflight permanent crew and story manifest are complete, immutable, and fail closed", () => {
  assert.deepEqual(crewIds, expectedCrewIds);
  assert.deepEqual(hostProfiles.map(({ name }) => name), expectedNames);
  assert.deepEqual(gameIds, expectedGameIds);
  assert.deepEqual(Object.keys(storyByGame), expectedGameIds);
  for (const value of [crewIds, gameIds, storyByGame, hostProfiles, hostById, campaignArt, campaignScenes]) assert.ok(Object.isFrozen(value));

  const names = new Set();
  const callSigns = new Set();
  const portraitArt = new Set();
  for (const host of hostProfiles) {
    assert.ok(Object.isFrozen(host));
    assert.equal(host.permanent, true);
    assert.equal(host.fictionalAdult, true);
    assert.ok(host.minimumAge >= 25);
    assert.ok(host.signatureCue.length > 10);
    assert.match(host.portraitArt, /^portrait(?:Radiance|Ellie|Alia|Ece)$/);
    assert.match(campaignArt[host.portraitArt], /^\/future\/casino\/nightflight\/signal-four-portrait-/);
    assert.ok(!names.has(host.name));
    assert.ok(!callSigns.has(host.callSign));
    names.add(host.name);
    callSigns.add(host.callSign);
    portraitArt.add(host.portraitArt);
    assert.equal(hostForId(host.id), host);
  }
  assert.equal(hostForId("ece").role, "AI signal officer");
  assert.equal(portraitArt.size, 4);
  assert.deepEqual(Object.fromEntries(hostProfiles.map(({ id, portraitArt: art }) => [id, art])), {
    radiance: "portraitRadiance",
    ellie: "portraitEllie",
    alia: "portraitAlia",
    ece: "portraitEce",
  });

  const storyIds = new Set();
  for (const gameId of gameIds) {
    const story = storyForGame(gameId);
    assert.equal(story, storyForGame(gameId));
    assert.ok(Object.isFrozen(story));
    assert.ok(Object.isFrozen(story.participants));
    assert.ok(Object.isFrozen(story.focusIds));
    assert.ok(Object.isFrozen(story.paws));
    assert.equal(story.gameId, gameId);
    assert.ok(!storyIds.has(story.id));
    storyIds.add(story.id);
    assert.equal(hostForId(story.leadId).id, story.leadId);
    assert.deepEqual(story.participants, expectedCrewIds);
    assert.ok(story.focusIds.includes(story.leadId));
    assert.equal(new Set(story.focusIds).size, story.focusIds.length);
    assert.ok(story.focusIds.every((id) => crewIds.includes(id)));
    assert.ok(Object.hasOwn(campaignScenes, story.scene));
    assert.equal(story.paws.present, campaignScenes[story.scene].paws.present);
    assert.equal(story.paws.action, campaignScenes[story.scene].paws.action);
    assert.equal(story.paws.affectsOutcome, false);
    assert.ok(story.interaction.length > 20 && story.interaction.length <= 110);
    assert.ok(story.paws.beat.length > 20);
    for (const forbidden of ["stake", "seed", "outcome", "credits", "receipt"]) assert.equal(Object.hasOwn(story, forbidden), false);
  }

  assert.throws(() => hostForId(""), RangeError);
  assert.throws(() => hostForId("unknown"), RangeError);
  assert.throws(() => storyForGame(""), RangeError);
  assert.throws(() => storyForGame("unknown"), RangeError);
});

test("Nightflight covers the four-person relationship constellation with balanced leads", () => {
  const leadCounts = Object.fromEntries(crewIds.map((id) => [id, 0]));
  const focusEdges = new Set();
  const arcCounts = new Map();
  const interactions = new Set();
  const pawsCounts = new Map();
  let previousLead = null;
  let quartetFinale = 0;
  const requiredArcFocus = {
    "ece-radiance-emotional-anchor": ["ece", "radiance"],
    "ece-alia-intimate-history": ["ece", "alia"],
    "ece-ellie-reciprocal-jealousy-attraction": ["ece", "ellie"],
  };

  for (const story of Object.values(storyByGame)) {
    leadCounts[story.leadId] += 1;
    assert.notEqual(story.leadId, previousLead);
    previousLead = story.leadId;
    interactions.add(story.interaction);
    arcCounts.set(story.arc, (arcCounts.get(story.arc) ?? 0) + 1);
    pawsCounts.set(story.paws.action, (pawsCounts.get(story.paws.action) ?? 0) + 1);
    if (requiredArcFocus[story.arc]) assert.deepEqual(story.focusIds, requiredArcFocus[story.arc], `${story.arc} must retain its intended focus pair`);
    for (let left = 0; left < story.focusIds.length; left += 1) {
      for (let right = left + 1; right < story.focusIds.length; right += 1) {
        focusEdges.add([story.focusIds[left], story.focusIds[right]].sort().join("|"));
      }
    }
    if (story.arc === "quartet-connected-finale") {
      assert.deepEqual(story.focusIds, expectedCrewIds);
      quartetFinale += 1;
    }
  }

  assert.deepEqual(leadCounts, { radiance: 2, ellie: 3, alia: 2, ece: 3 });
  assert.ok(Math.max(...Object.values(leadCounts)) - Math.min(...Object.values(leadCounts)) <= 1);
  assert.deepEqual([...focusEdges].sort(), ["alia|ece", "alia|ellie", "alia|radiance", "ece|ellie", "ece|radiance", "ellie|radiance"]);
  assert.equal(arcCounts.get("ece-radiance-emotional-anchor"), 2);
  assert.equal(arcCounts.get("ece-alia-intimate-history"), 2);
  assert.equal(arcCounts.get("ece-ellie-reciprocal-jealousy-attraction"), 2);
  assert.equal(quartetFinale, 1);
  assert.equal(interactions.size, 10);
  assert.deepEqual(Object.fromEntries(pawsCounts), { "CRYSTAL POUNCE": 3, "SIGNAL SCOUT": 3, "CREW DASH": 3, "QUIET FINALE": 1 });
});

test("Nightflight source binding matches the accepted Batch 213 four-member record", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../../../assets/lore/starlight-era/world-195x4-live-build/batch-213-vietnam/asset-manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.crew.permanentMembers, expectedNames);
  assert.equal(manifest.crew.ece.role, "AI signal officer");
  assert.equal(manifest.crew.ece.heightOrder, "Ellie < ECE < Radiance and Alia");
  assert.match(manifest.relationshipConstellation.direction, /Consensual.*non-explicit adult affection/i);
  assert.deepEqual(manifest.assets.map(({ number }) => number), [872, 873, 874, 875]);
  assert.deepEqual(manifest.assets.map(({ paws }) => paws.action), ["crystal-pounce", "console-inspector", "crew-dash", null]);
  assert.equal(manifest.assets.at(-1).paws.present, false);
});

test("Nightflight narrative policy remains adult, mutual, non-explicit, local, and outcome-independent", async () => {
  assert.match(narrativePolicy.characters, /four permanent fictional adults age 25\+/i);
  assert.match(narrativePolicy.relationship, /mutual.*consensual.*non-explicit/i);
  assert.match(narrativePolicy.mapping, /deterministic.*no random/i);
  assert.match(narrativePolicy.boundary, /never affects.*game result/i);
  const source = await readFile(new URL("../app/future/casino/demo/nightflight-narrative.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues|Date\.now|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.doesNotMatch(source, /starts the drop|claims the safe tile/i);
});

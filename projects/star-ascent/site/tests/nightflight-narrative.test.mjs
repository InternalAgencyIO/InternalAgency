import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  campaignArt,
  gameIds,
  hostProfiles,
  narrativePolicy,
  storyByGame,
  storyForGame,
} from "../app/future/casino/demo/nightflight-narrative.mjs";

const expectedGameIds = ["plinko", "dice", "roulette", "mines", "keno", "limbo", "slots", "baccarat", "blackjack", "crash"];
const hostNames = new Set(["Radiance", "Ellie", "Alia"]);

test("Nightflight story manifest is complete, immutable, and deterministic", () => {
  assert.deepEqual(gameIds, expectedGameIds);
  assert.deepEqual(Object.keys(storyByGame), expectedGameIds);
  assert.ok(Object.isFrozen(gameIds));
  assert.ok(Object.isFrozen(storyByGame));
  assert.ok(Object.isFrozen(hostProfiles));
  assert.ok(Object.isFrozen(campaignArt));

  for (const host of hostProfiles) {
    assert.ok(Object.isFrozen(host));
    assert.ok(hostNames.has(host.name));
    assert.ok(host.minimumAge >= 25);
    assert.ok(host.tattoo.length > 10);
  }

  const storyIds = new Set();
  for (const gameId of gameIds) {
    const story = storyForGame(gameId);
    assert.equal(story, storyForGame(gameId));
    assert.ok(Object.isFrozen(story));
    assert.ok(Object.isFrozen(story.participants));
    assert.equal(story.gameId, gameId);
    assert.ok(!storyIds.has(story.id));
    storyIds.add(story.id);
    assert.ok(hostNames.has(story.leadHost));
    assert.ok(story.participants.includes(story.leadHost));
    assert.equal(new Set(story.participants).size, story.participants.length);
    assert.ok(story.participants.length === 2 || story.participants.length === 3);
    assert.ok(Object.hasOwn(campaignArt, story.art));
    assert.ok(story.interaction.length > 12 && story.interaction.length <= 72);
    assert.ok(story.pawsAction.length > 3);
  }

  assert.throws(() => storyForGame(""), RangeError);
  assert.throws(() => storyForGame("unknown"), RangeError);
});

test("Nightflight story keeps all three relationship edges and balanced lead focus", () => {
  const leadCounts = Object.fromEntries([...hostNames].map((name) => [name, 0]));
  const edges = new Set();
  let trioCount = 0;
  const interactions = new Set();
  const pawsActions = new Set();

  for (const story of Object.values(storyByGame)) {
    leadCounts[story.leadHost] += 1;
    interactions.add(story.interaction);
    pawsActions.add(story.pawsAction);
    if (story.participants.length === 3) trioCount += 1;
    for (let left = 0; left < story.participants.length; left += 1) {
      for (let right = left + 1; right < story.participants.length; right += 1) {
        edges.add([story.participants[left], story.participants[right]].sort().join("|"));
      }
    }
  }

  assert.deepEqual(leadCounts, { Radiance: 4, Ellie: 3, Alia: 3 });
  assert.ok(Math.max(...Object.values(leadCounts)) - Math.min(...Object.values(leadCounts)) <= 1);
  assert.deepEqual([...edges].sort(), ["Alia|Ellie", "Alia|Radiance", "Ellie|Radiance"]);
  assert.ok(trioCount >= 3);
  assert.equal(interactions.size, 10);
  assert.deepEqual([...pawsActions].sort(), ["CONSOLE INSPECTOR", "CREW DASH", "LAP COPILOT", "PAWS-UP REQUEST", "RIBBON CHASE"]);
});

test("Nightflight narrative policy remains adult, mutual, non-explicit, and local", async () => {
  assert.match(narrativePolicy.characters, /fictional adults age 25\+/i);
  assert.match(narrativePolicy.relationship, /mutual.*consensual.*non-explicit/i);
  assert.match(narrativePolicy.mapping, /deterministic.*no random/i);
  const source = await readFile(new URL("../app/future/casino/demo/nightflight-narrative.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues|Date\.now|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
});

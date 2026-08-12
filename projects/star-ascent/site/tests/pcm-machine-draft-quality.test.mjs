import assert from "node:assert/strict";
import test from "node:test";
import { pcmKnownSemanticCorruptionFindings } from "../scripts/lib/pcm-machine-draft-quality.mjs";

test("known Marian semantic substitutions fail source-bound PCM quality checks", () => {
  const cases = [
    ["fixed-supply design", "fixed-Procurement design", "fixed-supply-substitution"],
    ["simulated credits", "bungalow credits", "introduced-bungalow"],
    ["reflective silver", "peacekeeping silver", "introduced-peacekeeping"],
    ["through the foreground", "through di founders", "introduced-founders"],
    ["preset hands", "rented hands", "preset-substitution"],
    ["ten-game lobby", "ten-game volunteer", "introduced-volunteer"],
    ["mathematical total", "mattress total", "introduced-mattress"],
    ["integer units", "imperfect units", "introduced-imperfect"],
    ["linear release", "classical release", "linear-substitution"],
    ["stage telemetry", "stage teleopathy", "introduced-teleopathy"],
    ["host-program boundary", "host-Project boundary", "host-program-substitution"],
  ];
  for (const [source, translation, expectedRule] of cases) {
    assert.ok(
      pcmKnownSemanticCorruptionFindings(source, translation).some(({ rule }) => rule === expectedRule),
      `${expectedRule}: ${source} => ${translation}`,
    );
  }
});

test("legitimate source words and repaired Pidgin do not trigger known-corruption checks", () => {
  for (const [source, translation] of [
    ["Volunteer for the project.", "Volunteer for di project."],
    ["Use simulated credits.", "Use demo credits wey no get value."],
    ["Linear release through month 24.", "Release am small-small through month 24."],
    ["Open the casino lobby.", "Open di casino lobby."],
  ]) assert.deepEqual(pcmKnownSemanticCorruptionFindings(source, translation), []);
});

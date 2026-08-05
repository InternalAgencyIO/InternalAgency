import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { decodeHtml, extractFromHtml } from "../scripts/generate-i18n-catalog.mjs";

test("decodes each HTML entity exactly once", () => {
  assert.equal(decodeHtml("A &amp; B &lt; C &#x21;"), "A & B < C !");
  assert.equal(decodeHtml("&amp;lt;script&amp;gt;"), "&lt;script&gt;");
});

test("extracts visible copy while excluding comments and raw-text elements", () => {
  const html = `
    <main title="Public launch status">
      Visible launch copy
      <!-- Hidden comment copy -->
      <script>dangerous script copy</script>
      <style>.hidden { content: "style copy"; }</style>
      <template>hidden template copy</template>
      <div data-no-translate title="Excluded title">
        Excluded English-only copy
        <div><span>Excluded nested copy</span></div>
      </div>
      <img alt="Radiance launch portrait" src="/favicon-radiance.png">
    </main>
  `;
  assert.deepEqual(
    [...extractFromHtml(html)].sort(),
    ["Public launch status", "Radiance launch portrait", "Visible launch copy"].sort(),
  );
});

test("does not reintroduce markup through nested entity decoding", () => {
  const values = extractFromHtml("<p>&amp;lt;script&amp;gt; stays text</p>");
  assert.deepEqual([...values], ["&lt;script&gt; stays text"]);
});

test("critical hydration-only launch copy stays in the canonical source manifest", async () => {
  const [component, criticalUi] = await Promise.all([
    readFile(new URL("../app/LaunchSequence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/critical-ui-source.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  for (const source of Object.values(criticalUi)) {
    assert.ok(component.includes(JSON.stringify(source)), `LaunchSequence source is missing manifest value: ${source}`);
  }
  const guardedSequence = Object.entries(criticalUi)
    .filter(([key]) => key.endsWith("Ready"))
    .map(([, source]) => source);
  assert.equal(guardedSequence.length, 6, "The complete six-line preflight sequence must be guarded");
  assert.ok(guardedSequence.every((source) => /(?:CHECK|STANDBY)\.$/u.test(source)));
  assert.ok(guardedSequence.every((source) => !/\bGO\b/u.test(source)), "HOLD copy must not contain a launch command");
});

import assert from "node:assert/strict";
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

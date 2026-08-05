import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const sourceFiles = [
  "app/future/future-copy.json",
  "app/future/language.ts",
  "app/future/page.tsx",
  "app/future/FutureNav.tsx",
  "app/future/FashionReveal.tsx",
  "app/future/EditorialScene.tsx",
  "app/future/ProtocolEdgeLoop.tsx",
  "app/future/predictive-engine/page.tsx",
  "app/future/casino/page.tsx",
];

test("future previews are explicit, inactive, and transaction-free", async () => {
  const source = (await Promise.all(sourceFiles.map((path) => readFile(new URL(path, root), "utf8")))).join("\n");
  assert.match(source, /POST-GENESIS CONCEPT/);
  assert.match(source, /INACTIVE/);
  assert.match(source, /NO WAGER ROUTE/);
  assert.match(source, /30 DAYS AFTER \$IAT GENESIS/);
  assert.match(source, /15 DAYS AFTER \$IAT GENESIS/);
  assert.match(source, /predictive-engine-carrier-runway-v2/);
  assert.match(source, /casino-everest-poker-v2/);
  assert.match(source, /FAIRNESS CLAIM \/\/ NOT YET PROVEN/);
  assert.match(source, /1% PROTOCOL EDGE/);
  assert.match(source, /LIQUIDITY POOL/);
  assert.match(source, /EXTENDED \$IAT APY RUNWAY/);
  assert.match(source, /not a guaranteed fixed APY or return/i);
  assert.match(source, /DECORATIVE RUNWAY HARDWARE/);
  assert.doesNotMatch(source, /handcuff|restraint|bondage/i);
  assert.doesNotMatch(source, /\/api\//i);
  assert.doesNotMatch(source, /connectWallet|sendTransaction|TransactionInstruction|wallet-adapter/i);
  assert.doesNotMatch(source, /<form\b|<button\b/i);
});

test("future previews expose only canonical English while target-language review is on HOLD", async () => {
  const [copyText, languageSource, reviewedPolicyText] = await Promise.all([
    readFile(new URL("app/future/future-copy.json", root), "utf8"),
    readFile(new URL("app/future/language.ts", root), "utf8"),
    readFile(new URL("app/i18n/reviewed-localization-policy.json", root), "utf8"),
  ]);
  const copy = JSON.parse(copyText);
  const reviewedPolicy = JSON.parse(reviewedPolicyText);

  assert.equal(reviewedPolicy.mode, "GLOBAL_FAIL_CLOSED");
  assert.equal(reviewedPolicy.machineDraftRuntimeAllowed, false);
  assert.equal(reviewedPolicy.unreviewedTargetLanguageBundleAllowed, false);
  assert.equal(reviewedPolicy.unreviewedLocaleAutonymsAllowed, false);
  assert.equal(reviewedPolicy.directComponentReviewBundleComplete, false);
  assert.deepEqual(reviewedPolicy.translations, {});
  assert.deepEqual(reviewedPolicy.reviews, []);
  assert.deepEqual(Object.keys(copy), ["en"]);
  assert.match(copy.en.edge.title.join(" "), /1% PROTOCOL EDGE.*LIQUIDITY POOL.*EXTENDED \$IAT APY RUNWAY/);
  assert.match(copy.en.edge.caveat, /not a guaranteed fixed APY or return/i);
  assert.match(copy.en.predictive.target, /30 DAYS AFTER \$IAT GENESIS/);
  assert.match(copy.en.casino.target, /15 DAYS AFTER \$IAT GENESIS/);
  assert.match(languageSource, /export type FutureLanguage = keyof typeof futureCopy/);
  assert.match(languageSource, /return "en"/);
  assert.doesNotMatch(languageSource, /\b(?:tr|ar|zh|ja|ru)\b\s*[:=]/);
  assert.doesNotMatch(copyText, /[ĞğİıŞş]|\b(?:BEKLET|DOSYA|SİNYAL|Türkçe)\b/u);
  assert.doesNotMatch(copyText, /T\+\d+/);
});

test("future previews use new source-bound art and accessible motion fallbacks", async () => {
  const [manifestText, css, home] = await Promise.all([
    readFile(new URL("public/images/future/asset-manifest.json", root), "utf8"),
    readFile(new URL("app/future/future.css", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.assets.length, 4);
  assert.deepEqual(Object.values(manifest.characters).map((character) => character.canonicalAge), [21, 24, 23]);
  assert.match(manifest.variationPolicy.publicSafety, /no explicit exposure/i);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.fashion-after\{[^}]*clip-path/);
  assert.match(home, /href="\/future"/);

  for (const asset of manifest.assets) {
    const assetUrl = new URL(`public${asset.path}`, root);
    const [details, contents] = await Promise.all([stat(assetUrl), readFile(assetUrl)]);
    assert.ok(details.size > 300_000, `${asset.path} must retain a high-resolution web delivery master`);
    assert.equal(details.size, asset.bytes);
    assert.equal(createHash("sha256").update(contents).digest("hex"), asset.sha256);
  }
});

test("ships four source-bound 15-second 4K teaser masters", async () => {
  const manifest = JSON.parse(await readFile(new URL("public/media/future/media-manifest.json", root), "utf8"));
  assert.equal(manifest.status, "POST-GENESIS CONCEPT / INACTIVE / NO WAGER ROUTE");
  assert.deepEqual(manifest.format, {
    durationSeconds: 15,
    width: 3840,
    height: 2160,
    framesPerSecond: 30,
    videoCodec: "h264",
    audioCodec: "aac",
  });
  assert.equal(manifest.assets.length, 4);
  for (const asset of manifest.assets) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    const assetUrl = new URL(`public${asset.path}`, root);
    const [details, contents] = await Promise.all([stat(assetUrl), readFile(assetUrl)]);
    assert.equal(details.size, asset.bytes);
    assert.equal(createHash("sha256").update(contents).digest("hex"), asset.sha256);
    assert.ok(details.size > 3_500_000);
  }
});

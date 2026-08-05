import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Casino DLC demo is explicit, English-only, deterministic, and transaction-free", async () => {
  const [page, component, preview, sitemap, worker] = await Promise.all([
    read("app/future/casino/demo/page.tsx"),
    read("app/future/casino/demo/CasinoDemo.tsx"),
    read("app/future/casino/page.tsx"),
    read("app/sitemap.ts"),
    read("worker/index.ts"),
  ]);
  const source = `${page}\n${component}`;
  assert.match(page, /robots: "noindex, nofollow, noarchive"/);
  assert.match(page, /languages:[\s\S]*en: "https:\/\/internalagency\.io\/future\/casino\/demo"[\s\S]*"x-default": "https:\/\/internalagency\.io\/future\/casino\/demo"/);
  assert.match(component, /data-no-translate/);
  assert.match(source, /ENGLISH ONLY/);
  assert.match(source, /DEMO ONLY/);
  assert.match(source, /SIMULATED CREDITS/);
  assert.match(source, /FICTIONAL ADULT PARTICIPANTS/);
  assert.match(source, /NO REAL WAGERS/);
  assert.match(source, /No account\. No deposit|No real gameplay, account, deposit/i);
  assert.match(component, /const demoRounds: DemoRound\[\] = \[/);
  assert.equal((component.match(/receipt: "DLC-DEMO-/g) ?? []).length, 3);
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.doesNotMatch(source, /connectWallet|sendTransaction|TransactionInstruction|wallet-adapter|@solana|@coral-xyz/);
  assert.doesNotMatch(source, /href=["'{`]\/api\//);
  assert.doesNotMatch(source, /<form\b/);
  for (const button of component.matchAll(/<button\b[^>]*>/g)) assert.match(button[0], /type="button"/);
  assert.match(preview, /href="\/future\/casino\/demo"/);
  assert.doesNotMatch(sitemap, /future\/casino\/demo/);
  assert.match(worker, /englishOnlyCasinoDemo[\s\S]*incomingLocale \|\| turkishHost[\s\S]*https:\/\/internalagency\.io\/future\/casino\/demo/);
});

test("Casino DLC demo includes keyboard, live-region, responsive, and reduced-motion support", async () => {
  const [component, css] = await Promise.all([
    read("app/future/casino/demo/CasinoDemo.tsx"),
    read("app/future/casino/demo/casino-demo.css"),
  ]);
  assert.match(component, /href="#demo-table">Skip to demo table/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /aria-label="Decrease simulated stake by 25 credits"/);
  assert.match(component, /aria-label="Increase simulated stake by 25 credits"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /body:has\(\.casino-demo\) \.locale-switcher\{display:none!important\}/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /animation-duration:\.01ms!important/);
});

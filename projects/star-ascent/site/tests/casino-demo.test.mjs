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
  assert.match(source, /FICTIONAL ADULT HOSTS/);
  assert.match(source, /Radiance/);
  assert.match(source, /Ellie/);
  assert.match(source, /Alia/);
  assert.match(source, /STARSHIP CASINO DLC/);
  assert.match(source, /NIGHTFLIGHT/);
  assert.match(source, /NO REAL WAGERS/);
  assert.match(source, /No account\. No deposit|No real gameplay, account, deposit/i);
  assert.match(component, /const games: GameDefinition\[\] = \[/);
  assert.equal((component.match(/receipt: "DLC-[A-Z]+"/g) ?? []).length, 10);
  for (const game of ["plinko", "dice", "roulette", "mines", "keno", "limbo", "slots", "baccarat", "blackjack", "crash"]) {
    assert.match(component, new RegExp(`id: "${game}"`));
    assert.match(component, new RegExp(`scene: "${game}"`));
  }
  assert.match(component, /data-testid=\{`game-\$\{item\.id\}`\}/);
  assert.match(component, /24\.4B quarterly UK-regulated spins/);
  assert.match(component, /145\.9M operator-reported 2025 plays/);
  assert.match(component, /AUTO TARGET LOCKED BEFORE PRESET REVEAL/);
  assert.match(component, /The animation only replays it/);
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
  assert.match(component, /href="#game-lobby">Skip to the ten-game lobby/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /aria-label="Ten Casino DLC demo games"/);
  assert.equal((component.match(/sceneLabel: "/g) ?? []).length, 10);
  assert.match(component, /aria-label="Decrease simulated stake by 25 credits"/);
  assert.match(component, /aria-label="Increase simulated stake by 25 credits"/);
  assert.match(component, /aria-pressed=\{lightPulse\}/);
  assert.match(component, /SAFE PULSE \{lightPulse \? "ON" : "OFF"\}/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /body:has\(\.casino-demo\) \.locale-switcher\{display:none!important\}/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /animation-duration:\.01ms!important/);
  assert.match(css, /nightlife-pulse 1\.6s ease-in-out infinite/);
  assert.match(css, /\.casino-demo\.is-pulse-on \.demo-light-wash\{animation:none!important;opacity:0\}/);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { campaignArt, hostProfiles } from "../app/future/casino/demo/nightflight-narrative.mjs";

const root = new URL("../", import.meta.url);
const repositoryRoot = new URL("../../../", root);
const read = (path) => readFile(new URL(path, root), "utf8");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

test("Casino DLC demo is explicit, English-only, deterministic, and transaction-free", async () => {
  const [page, component, narrative, narrativeComponent, preview, sitemap, worker] = await Promise.all([
    read("app/future/casino/demo/page.tsx"),
    read("app/future/casino/demo/CasinoDemo.tsx"),
    read("app/future/casino/demo/nightflight-narrative.mjs"),
    read("app/future/casino/demo/NightflightNarrative.tsx"),
    read("app/future/casino/page.tsx"),
    read("app/sitemap.ts"),
    read("worker/index.ts"),
  ]);
  const source = `${page}\n${component}\n${narrative}\n${narrativeComponent}`;
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
  assert.match(source, /AI ECE/);
  assert.match(source, /STARSHIP CASINO DLC/);
  assert.match(source, /NIGHTFLIGHT/);
  assert.doesNotMatch(`${component}\n${narrativeComponent}`, /Three adult fashion hosts|playful fictional trio|THE NIGHTFLIGHT TRIANGLE|TRIANGLE HEARTBEAT/);
  assert.match(source, /NO REAL WAGERS/);
  assert.match(source, /FICTIONAL TRAINING BOARD/);
  assert.match(source, /FAKE CREDITS/);
  assert.match(source, /NO PRIZES/);
  assert.match(source, /STATIC PRESENTATION ONLY/);
  assert.match(component, /const demoRankings: DemoRanking\[\] = \[/);
  assert.equal((component.match(/participant: "[^"]+", module:/g) ?? []).length, 6);
  assert.match(component, /aria-label="Scrollable fictional demo leaderboard"/);
  assert.match(component, /<caption>Preset Nightflight training standings/);
  assert.match(source, /No account\. No deposit|No real gameplay, account, deposit/i);
  assert.match(component, /const games: GameDefinition\[\] = \[/);
  assert.equal((component.match(/receipt: "DLC-[A-Z]+"/g) ?? []).length, 10);
  for (const game of ["plinko", "dice", "roulette", "mines", "keno", "limbo", "slots", "baccarat", "blackjack", "crash"]) {
    assert.match(component, new RegExp(`id: "${game}"`));
    assert.match(component, new RegExp(`scene: "${game}"`));
  }
  assert.match(component, /data-testid=\{`game-\$\{item\.id\}`\}/);
  assert.match(component, /storyForGame\(game\.id\)/);
  assert.match(component, /<NightflightNarrative key=\{roll\.id\}/);
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
  const [component, narrativeComponent, css] = await Promise.all([
    read("app/future/casino/demo/CasinoDemo.tsx"),
    read("app/future/casino/demo/NightflightNarrative.tsx"),
    read("app/future/casino/demo/casino-demo.css"),
  ]);
  assert.match(component, /href="#game-lobby">Skip to the ten-game lobby/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(component, /const phaseStatus = phase === "settled"/);
  assert.equal((component.match(/loading="lazy" decoding="async"/g) ?? []).length, 7);
  assert.match(component, /campaignArt\.signalFourAnchor[\s\S]{0,400}fetchPriority="high"/);
  assert.match(component, /aria-label="Ten Casino DLC demo games"/);
  assert.equal((component.match(/sceneLabel: "/g) ?? []).length, 10);
  assert.match(component, /aria-label="Decrease simulated stake by 25 credits"/);
  assert.match(component, /aria-label="Increase simulated stake by 25 credits"/);
  assert.match(component, /aria-pressed=\{lightPulse\}/);
  assert.match(component, /disabled=\{!interactiveReady\}/);
  assert.match(component, /data-interactive-ready=\{interactiveReady\}/);
  assert.match(component, /SAFE PULSE \{lightPulse \? "ON" : "OFF"\}/);
  assert.match(component, /aria-pressed=\{cinemaActive\}/);
  assert.match(component, /CINEMA LOOP \{cinemaActive \? "ON" : "PAUSED"\}/);
  assert.match(component, /scrollIntoView\(\{ behavior: reduceMotion \? "auto" : "smooth", block: "start" \}\)/);
  assert.match(component, /#demo-table-title/);
  assert.match(component, /aria-describedby="nightflight-narrative-summary"/);
  assert.match(narrativeComponent, /data-testid="nightflight-narrative"/);
  assert.match(narrativeComponent, /data-story-id=\{story\.id\}/);
  assert.match(narrativeComponent, /data-participants=\{story\.participants\.join\("\|"\)\}/);
  assert.match(narrativeComponent, /data-focus-ids=\{story\.focusIds\.join\("\|"\)\}/);
  assert.match(narrativeComponent, /data-paws-present=\{String\(story\.paws\.present\)\}/);
  assert.match(component, /OPEN MODULE ↓/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.casino-demo \.demo-skip\{[^}]*clip-path:inset\(50%\)/);
  assert.match(css, /\.casino-demo \.demo-skip:focus\{[^}]*clip-path:none/);
  assert.match(css, /\.casino-demo>\*:not\(\.demo-light-wash\):not\(\.demo-skip\)/);
  assert.match(css, /body:has\(\.casino-demo\) \.locale-switcher\{display:none!important\}/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /animation-duration:\.01ms!important/);
  assert.match(css, /nightlife-pulse 1\.6s ease-in-out infinite/);
  assert.match(css, /\.casino-demo\.is-pulse-on \.demo-light-wash\{animation:none!important;opacity:0\}/);
  assert.match(css, /@keyframes cinema-drift/);
  assert.match(css, /@keyframes anime-flight/);
  assert.match(css, /@keyframes host-fashion-reveal/);
  assert.match(css, /@keyframes campaign-fashion-reveal/);
  assert.match(css, /@keyframes constellation-story-reveal/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.demo-constellation-narrative/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.cinema-frame img/);
});

test("Nightflight Signal Four art is source-bound, deterministic, and traceable", async () => {
  const [component, narrative, narrativeComponent, css, provenance, packageLock] = await Promise.all([
    read("app/future/casino/demo/CasinoDemo.tsx"),
    read("app/future/casino/demo/nightflight-narrative.mjs"),
    read("app/future/casino/demo/NightflightNarrative.tsx"),
    read("app/future/casino/demo/casino-demo.css"),
    read("public/future/casino/nightflight/asset-provenance.json").then(JSON.parse),
    read("package-lock.json").then(JSON.parse),
  ]);
  assert.equal(packageLock.packages["node_modules/sharp"].version, "0.35.2", "the deterministic image processor must remain lock-pinned");
  assert.equal(provenance.licenseScope.metadata, "CC0-1.0");
  assert.equal(provenance.licenseScope.generatedAssets, "CC0-1.0 dedication to the extent of the project's rights");
  assert.equal(provenance.version, 4);
  assert.equal(provenance.process.mode, "source-bound-reuse-plus-project-generation");
  assert.match(provenance.process.generationPolicy, /fictional adults age 25\+/);
  assert.match(provenance.process.motionDisclosure, /does not claim.*live-action video/i);
  assert.match(provenance.process.summary, /four-member.*AI ECE/i);
  assert.equal(provenance.assets.length, 14);
  assert.equal(new Set(provenance.assets.map((asset) => asset.sha256)).size, 14);
  assert.equal(provenance.identityAnchor.role, "AI signal officer");
  assert.equal(provenance.identityAnchor.sourceSha256, "b22ef5cd9929d2a09f96dc0765434db41c964b0f0390589e940eb085935c2315");
  for (const asset of provenance.assets) {
    assert.match(asset.publicPath, /^\/future\/casino\/nightflight\/[a-z0-9-]+\.(png|webp)$/);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    const publicBytes = await readFile(new URL(`public${asset.publicPath}`, root));
    assert.equal(sha256(publicBytes), asset.sha256, `${asset.publicPath} hash must match provenance`);
    if (asset.bytes) assert.equal(publicBytes.byteLength, asset.bytes, `${asset.publicPath} bytes must match provenance`);
    if (asset.dimensions) {
      const metadata = await sharp(publicBytes).metadata();
      assert.deepEqual({ width: metadata.width, height: metadata.height }, asset.dimensions, `${asset.publicPath} dimensions must match provenance`);
    }
    if (asset.sourceSha256) {
      const sourceBytes = await readFile(new URL(asset.sourcePath, repositoryRoot));
      assert.equal(sha256(sourceBytes), asset.sourceSha256, `${asset.sourcePath} hash must match provenance`);
      if (asset.sourceDimensions) {
        const metadata = await sharp(sourceBytes).metadata();
        assert.deepEqual({ width: metadata.width, height: metadata.height }, asset.sourceDimensions, `${asset.sourcePath} dimensions must match provenance`);
      }
    }
    if (asset.editMasterPath) {
      const masterBytes = await readFile(new URL(asset.editMasterPath, repositoryRoot));
      assert.equal(sha256(masterBytes), asset.editMasterSha256, `${asset.editMasterPath} hash must match provenance`);
      assert.equal(masterBytes.byteLength, asset.editMasterBytes, `${asset.editMasterPath} bytes must match provenance`);
    }
    if (asset.cropMasterPath) {
      const masterBytes = await readFile(new URL(asset.cropMasterPath, repositoryRoot));
      assert.equal(sha256(masterBytes), asset.cropMasterSha256, `${asset.cropMasterPath} hash must match provenance`);
      assert.equal(masterBytes.byteLength, asset.cropMasterBytes, `${asset.cropMasterPath} bytes must match provenance`);
      const metadata = await sharp(masterBytes).metadata();
      assert.deepEqual({ width: metadata.width, height: metadata.height }, asset.cropMasterDimensions, `${asset.cropMasterPath} dimensions must match provenance`);
    }
  }
  const legacyAssets = provenance.assets.filter((asset) => asset.status === "historical-v1");
  const activeAssets = provenance.assets.filter((asset) => asset.status === "active-v2");
  const inactiveAssets = provenance.assets.filter((asset) => asset.status === "inactive-source-v2");
  const supportAssets = provenance.assets.filter((asset) => asset.status === "active-support-v2");
  assert.equal(legacyAssets.length, 6);
  assert.equal(activeAssets.length, 3);
  assert.equal(inactiveAssets.length, 1);
  assert.equal(supportAssets.length, 4);
  assert.deepEqual(activeAssets.map((asset) => asset.sourceAssetNumber), [872, 874, 875]);
  for (const asset of activeAssets) {
    assert.equal(asset.sourceCommit, "084c86c01a9c65022bd9ca4dba5f4aa3e85914f7");
    assert.match(asset.sourcePath, /^assets\/lore\/starlight-era\/87[2-5]-vietnam-/);
    assert.match(asset.mode, /identity-preserve-wardrobe-edit|source-referenced-fashion-reinterpretation|source-bound-derivative/);
    if (asset.mode === "identity-preserve-wardrobe-edit") assert.match(asset.promptFamily, /identity-preserve.*wardrobe-only/i);
    if (asset.mode === "source-referenced-fashion-reinterpretation") assert.match(asset.acceptedDeviation, /cylinder.*baton.*arm\/hand/i);
    assert.deepEqual(asset.dimensions, { width: 720, height: 1280 });
    assert.equal(asset.encoding.format, "webp");
    assert.equal(asset.adultPolicy, "four fictional adults age 25+, fully clothed, non-explicit");
    assert.equal(asset.visibleSubjectsLeftToRight.length, 4);
    assert.ok(asset.accessibleDescription.length > 40);
    assert.match(`${component}\n${narrative}`, new RegExp(asset.publicPath.replaceAll("/", "\\/")));
    const transformInput = await readFile(new URL(asset.editMasterPath ?? asset.sourcePath, repositoryRoot));
    const regenerated = await sharp(transformInput)
      .resize({ width: 720, height: 1280, fit: "cover", position: "centre" })
      .webp({ quality: 84, smartSubsample: true })
      .toBuffer();
    assert.equal(sha256(regenerated), asset.sha256, `${asset.publicPath} must reproduce from its declared source and transform`);
  }
  assert.equal(inactiveAssets[0].sourceAssetNumber, 873);
  assert.equal(inactiveAssets[0].mode, "source-bound-derivative");
  assert.match(inactiveAssets[0].use, /Inactive.*not referenced.*latex-and-lace/i);
  assert.doesNotMatch(`${component}\n${narrative}`, new RegExp(inactiveAssets[0].publicPath.replaceAll("/", "\\/")));
  const inactiveInput = await readFile(new URL(inactiveAssets[0].sourcePath, repositoryRoot));
  const inactiveRegenerated = await sharp(inactiveInput)
    .resize({ width: 720, height: 1280, fit: "cover", position: "centre" })
    .webp({ quality: 84, smartSubsample: true })
    .toBuffer();
  assert.equal(sha256(inactiveRegenerated), inactiveAssets[0].sha256, "inactive Hue evidence must remain reproducible");
  assert.deepEqual(supportAssets.map((asset) => asset.visibleSubject), ["Radiance", "Ellie", "AI ECE", "Alia"]);
  for (const host of hostProfiles) {
    const portrait = supportAssets.find((asset) => asset.publicPath === campaignArt[host.portraitArt]);
    assert.equal(portrait?.visibleSubject, host.name, `${host.name} must map to its own source-bound portrait`);
  }
  for (const asset of supportAssets) {
    assert.equal(asset.mode, "source-bound-crop");
    assert.equal(asset.sourceAssetNumber, 875);
    assert.deepEqual(asset.dimensions, { width: 480, height: 720 });
    assert.deepEqual({ width: asset.crop.width, height: asset.crop.height }, { width: 400, height: 600 });
    assert.match(`${component}\n${narrative}`, new RegExp(asset.publicPath.replaceAll("/", "\\/")));
    const cropMaster = await readFile(new URL(asset.cropMasterPath, repositoryRoot));
    const regenerated = await sharp(cropMaster)
      .extract(asset.crop)
      .resize({ width: 480, height: 720, fit: "cover", position: "centre" })
      .webp({ quality: 84, smartSubsample: true })
      .toBuffer();
    assert.equal(sha256(regenerated), asset.sha256, `${asset.publicPath} must reproduce from its declared crop and transform`);
  }
  assert.match(component, /storyForGame/);
  assert.equal((narrative.match(/interaction: "/g) ?? []).length, 10);
  assert.equal((narrative.match(/affectsOutcome: false/g) ?? []).length, 10);
  assert.equal((narrative.match(/signatureCue: "/g) ?? []).length, 4);
  assert.equal((narrative.match(/portraitArt: "/g) ?? []).length, 4);
  assert.doesNotMatch(`${component}\n${narrative}`, /imagePosition|rosterArtByHostId/);
  assert.match(narrativeComponent, /LOVE CONSTELLATION/);
  assert.equal((narrativeComponent.match(/className={`heartline-edge edge-\$\{index \+ 1\}`}/g) ?? []).length, 1);
  assert.match(narrativeComponent, /Array\.from\(\{ length: 6 \}/);
  assert.match(provenance.process.determinism, /nightflight-narrative\.mjs/);
  assert.match(component, /PAWS \/\/ GOLDEN COPILOT/);
  assert.match(component, /THE SIGNAL FOUR/);
  assert.match(component, /SOURCE-BOUND MOTION DESIGN/);
  assert.match(component, /Not model-generated live-action video/);
  assert.match(css, /@keyframes paws-copilot/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.paws-companion img/);
});

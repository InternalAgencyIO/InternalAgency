import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { campaignArt, hostProfiles } from "../app/future/casino/demo/nightflight-narrative.mjs";

const root = new URL("../", import.meta.url);
const repositoryRoot = new URL("../../../", root);
const read = (path) => readFile(new URL(path, root), "utf8");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const gitShow = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`], {
  cwd: fileURLToPath(repositoryRoot),
  encoding: "utf8",
});

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
  assert.equal((component.match(/loading="lazy" decoding="async"/g) ?? []).length, 8);
  assert.match(component, /campaignArt\.signalFourAnchor[\s\S]{0,400}fetchPriority="high"/);
  assert.match(component, /aria-label="Ten Casino DLC demo games"/);
  assert.equal((component.match(/^    sceneLabels: \{/gmu) ?? []).length, 10);
  assert.equal((component.match(/^      pending: "/gmu) ?? []).length, 10);
  assert.equal((component.match(/^      revealed: "/gmu) ?? []).length, 10);
  assert.equal((component.match(/^      settled: "/gmu) ?? []).length, 1);
  assert.match(component, /settled && game\.sceneLabels\.settled[\s\S]*game\.sceneLabels\.revealed[\s\S]*game\.sceneLabels\.pending/);
  assert.doesNotMatch(component, /aria-label=\{game\.sceneLabel\}/);
  assert.match(component, /aria-label="Decrease simulated stake by 25 credits"/);
  assert.match(component, /aria-label="Increase simulated stake by 25 credits"/);
  assert.match(component, /aria-pressed=\{lightPulse\}/);
  assert.match(component, /disabled=\{!interactiveReady\}/);
  assert.match(component, /data-interactive-ready=\{interactiveReady\}/);
  assert.match(component, /SAFE PULSE \{lightPulse \? "ON" : "OFF"\}/);
  assert.match(component, /aria-pressed=\{cinemaActive\}/);
  assert.match(component, /CINEMA LOOP \{cinemaActive \? "ON" : "PAUSED"\}/);
  assert.match(component, /alt=\{item\.portraitDescription\}/);
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
  const [component, narrative, narrativeComponent, css, provenance, packageLock, homePage] = await Promise.all([
    read("app/future/casino/demo/CasinoDemo.tsx"),
    read("app/future/casino/demo/nightflight-narrative.mjs"),
    read("app/future/casino/demo/NightflightNarrative.tsx"),
    read("app/future/casino/demo/casino-demo.css"),
    read("public/future/casino/nightflight/asset-provenance.json").then(JSON.parse),
    read("package-lock.json").then(JSON.parse),
    read("app/page.tsx"),
  ]);
  assert.equal(packageLock.packages["node_modules/sharp"].version, "0.35.2", "the deterministic image processor must remain lock-pinned");
  assert.equal(provenance.licenseScope.metadata, "CC0-1.0");
  assert.equal(provenance.licenseScope.generatedAssets, "CC0-1.0 dedication to the extent of the project's rights");
  assert.equal(provenance.version, 7);
  assert.equal(provenance.process.mode, "source-bound-reuse-plus-project-generation");
  assert.match(provenance.process.generationPolicy, /fictional adults age 25\+/);
  assert.match(provenance.process.motionDisclosure, /does not claim.*live-action video/i);
  assert.match(provenance.process.summary, /four-member.*AI ECE/i);
  assert.equal(provenance.assets.length, 23);
  assert.equal(new Set(provenance.assets.map((asset) => asset.sha256)).size, 23);
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
      if (asset.editMasterDimensions) {
        const metadata = await sharp(masterBytes).metadata();
        assert.deepEqual({ width: metadata.width, height: metadata.height }, asset.editMasterDimensions, `${asset.editMasterPath} dimensions must match provenance`);
      }
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
  const generatedAssets = provenance.assets.filter((asset) => asset.status === "active-v3");
  const inactiveAssets = provenance.assets.filter((asset) => asset.status === "inactive-source-v2");
  const supportAssets = provenance.assets.filter((asset) => asset.status === "active-support-v2");
  const editorialAssets = provenance.assets.filter((asset) => asset.status === "active-editorial-v1");
  assert.equal(legacyAssets.length, 6);
  assert.equal(activeAssets.length, 3);
  assert.equal(generatedAssets.length, 1);
  assert.equal(inactiveAssets.length, 1);
  assert.equal(supportAssets.length, 4);
  assert.equal(editorialAssets.length, 8);
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
  const generatedTension = generatedAssets[0];
  assert.equal(generatedTension.mode, "reference-guided-campaign-generation");
  assert.equal(generatedTension.sourceCommit, "cf1f55783fa64ce89433e891b87c92567c018c70");
  assert.equal(generatedTension.generationRecord, "generation-prompts-v3.md");
  assert.equal(generatedTension.sourceReferences.length, 3);
  for (const reference of generatedTension.sourceReferences) {
    const referenceBytes = await readFile(new URL(reference.path, repositoryRoot));
    assert.equal(sha256(referenceBytes), reference.sha256, `${reference.path} reference hash must match provenance`);
    const pointer = gitShow(generatedTension.sourceCommit, reference.path);
    assert.match(pointer, /^version https:\/\/git-lfs\.github\.com\/spec\/v1$/m, `${reference.path} must exist as LFS content at sourceCommit`);
    assert.equal(pointer.match(/^oid sha256:([0-9a-f]{64})$/m)?.[1], reference.sha256, `${reference.path} LFS OID must match provenance at sourceCommit`);
    assert.equal(Number(pointer.match(/^size (\d+)$/m)?.[1]), referenceBytes.byteLength, `${reference.path} LFS size must match sourceCommit`);
  }
  const generationRecord = await read(`public/future/casino/nightflight/${generatedTension.generationRecord}`);
  assert.match(generationRecord, /^# Signal Four orbital-tension generation record$/m);
  assert.match(generationRecord, /^## Accepted prompt$/m);
  assert.match(generationRecord, /^## Accepted-output deviation$/m);
  assert.match(generationRecord, /two pairwise handholds: Radiance with Ellie, and AI ECE with Alia/);
  assert.match(generationRecord, /built-in OpenAI image-generation workflow/);
  for (const reference of generatedTension.sourceReferences) assert.match(generationRecord, new RegExp(reference.path.replaceAll("/", "\\/")));
  assert.match(generationRecord, new RegExp(generatedTension.editMasterPath.replaceAll("/", "\\/")));
  assert.match(generationRecord, new RegExp(generatedTension.publicPath.replaceAll("/", "\\/")));
  assert.deepEqual(generatedTension.dimensions, { width: 720, height: 1280 });
  assert.equal(generatedTension.adultPolicy, "four fictional adults age 25+, fully clothed, non-explicit");
  assert.deepEqual(generatedTension.visibleSubjectsLeftToRight, ["Radiance", "Ellie", "AI ECE", "Alia"]);
  assert.match(`${component}\n${narrative}`, new RegExp(generatedTension.publicPath.replaceAll("/", "\\/")));
  const generatedInput = await readFile(new URL(generatedTension.editMasterPath, repositoryRoot));
  const generatedDelivery = await sharp(generatedInput)
    .resize({ width: 720, height: 1280, fit: "cover", position: "centre" })
    .webp({ quality: 84, smartSubsample: true })
    .toBuffer();
  assert.equal(sha256(generatedDelivery), generatedTension.sha256, "generated tension delivery must reproduce from its accepted master");
  assert.notEqual(campaignArt.signalFourTension, campaignArt.signalFourRelay, "tension and relay scenes must use distinct active art");
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
  for (const asset of editorialAssets) {
    assert.deepEqual(asset.dimensions, { width: 720, height: 1280 });
    assert.equal(asset.generatedAt, "2026-08-08");
    assert.equal(asset.generator, "OpenAI built-in image generation via Codex imagegen skill");
    assert.equal(asset.generatorVersion, "not exposed by provider");
    assert.match(asset.generationMaster.storage, /private generation-stage artifact.*host path intentionally omitted/i);
    assert.equal(asset.generationMaster.pathDisclosed, false);
    assert.match(asset.generationMaster.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.generationMaster.bytes > 0);
    assert.deepEqual(asset.generationMaster.dimensions, asset.publicPath.includes("paws-prismatic-pounce") ? { width: 1023, height: 1537 } : { width: 941, height: 1672 });
    assert.equal(asset.encoding.processor, "Sharp 0.35.2");
    assert.equal(asset.encoding.resize, "720x1280 cover centre");
    assert.equal(asset.encoding.quality, 84);
    assert.equal(asset.encoding.smartSubsample, true);
    assert.ok(["home", "nightflight-demo"].includes(asset.placementSurface));
    const placementSource = asset.placementSurface === "home" ? homePage : component;
    assert.match(placementSource, new RegExp(asset.publicPath.replaceAll("/", "\\/")));
    for (const reference of asset.sourceReferences) {
      assert.match(reference.sha256, /^[a-f0-9]{64}$/);
      if (reference.scope === "repository") {
        const referenceBytes = await readFile(new URL(reference.path, repositoryRoot));
        assert.equal(sha256(referenceBytes), reference.sha256, `${reference.path} reference hash must match provenance`);
      } else {
        assert.equal(reference.scope, "private-generation-stage");
        assert.equal(reference.pathDisclosed, false);
        assert.equal("path" in reference, false, "private generation-stage host paths must not enter public provenance");
      }
    }
  }
  const homeEditorialAssets = editorialAssets.filter((asset) => asset.placementSurface === "home");
  const relationshipEditorialAssets = editorialAssets.filter((asset) => asset.placementSurface === "nightflight-demo");
  assert.equal(homeEditorialAssets.length, 3);
  assert.equal(relationshipEditorialAssets.length, 5);
  assert.deepEqual(relationshipEditorialAssets.map((asset) => asset.mode), Array(5).fill("reference-guided-relationship-study-generation"));
  assert.deepEqual(relationshipEditorialAssets.map((asset) => asset.visibleSubjectsLeftToRight.length), Array(5).fill(4));
  for (const asset of relationshipEditorialAssets) {
    assert.equal(asset.adultPolicy, "four fictional adults age 25+, fully clothed, non-explicit");
    assert.match(asset.accessibleDescription, /four fictional adult women age 25 or older/i);
    assert.doesNotMatch(`${asset.accessibleDescription}\n${asset.promptFamily}`, /kiss|kissing/i);
    assert.equal(asset.sourceReferences.filter((reference) => reference.scope === "repository").length, 2);
  }
  const skybridgeStudy = relationshipEditorialAssets.find((asset) => asset.publicPath.includes("skybridge-triangle"));
  const privateSkybridgePredecessor = skybridgeStudy?.sourceReferences.find((reference) => reference.scope === "private-generation-stage");
  assert.equal(privateSkybridgePredecessor?.pathDisclosed, false);
  assert.equal(privateSkybridgePredecessor?.sha256, "26b430fa2bcff800b3c561cf557004a896d8d78b691498cbc4dffe263ea85abf");
  assert.equal(privateSkybridgePredecessor?.bytes, 2726933);
  assert.deepEqual(privateSkybridgePredecessor?.dimensions, { width: 941, height: 1672 });
  assert.equal("path" in privateSkybridgePredecessor, false);
  assert.match(component, /SIGNAL FOUR \/\/ FULL-SPECTRUM RELATIONSHIP STUDIES/);
  assert.match(component, /className="relationship-studies-grid"/);
  assert.match(component, /Four fictional adult women age 25 or older/);
  assert.match(component, /playful AI ECE jealousy/);
  assert.equal((component.match(/src: "\/future\/casino\/nightflight\/signal-four-[^"]+-v1\.webp"/g) ?? []).length, 5);
  assert.match(component, /<img src=\{study\.src\} width=\{720\} height=\{1280\} loading="lazy" decoding="async" alt=\{study\.alt\} \/>/);
  assert.doesNotMatch(component, /kiss|kissing/i);
  assert.match(css, /\.relationship-studies-grid\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:540px\)[\s\S]*\.relationship-studies-grid\{grid-template-columns:1fr\}/);
  const eceEditorial = editorialAssets.find((asset) => asset.visibleSubject === "AI ECE");
  assert.equal(eceEditorial?.adultPolicy, "fictional adult age 25+, fully clothed, non-explicit");
  assert.equal(eceEditorial?.editorialProp.state, "inert and non-operational");
  assert.match(eceEditorial?.editorialProp.claimBoundary ?? "", /not represent.*functional equipment.*operational use/i);
  assert.equal(editorialAssets.find((asset) => asset.visibleSubject === "PAWS")?.adultPolicy, "no people depicted");
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

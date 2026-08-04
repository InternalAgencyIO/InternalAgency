import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateAllocationManifest } from "../archive/public-disclosures/source/iat-allocation-validator.mjs";
import { validateAuthorityTransitionPlan } from "../archive/public-disclosures/source/iat-authority-plan-validator.mjs";
import {
  auditPublicationBundle,
  PUBLICATION_MANIFEST,
} from "../archive/public-disclosures/source/star-ascent-publication-audit.mjs";
import {
  validateCrossChannelReleasePacket,
} from "../archive/public-disclosures/source/star-ascent-release-packet-validator.mjs";
import {
  validateEvidenceFreshnessLedger,
} from "../archive/public-disclosures/source/star-ascent-evidence-ledger-validator.mjs";
import {
  composeReadinessSnapshot,
} from "../archive/public-disclosures/source/star-ascent-readiness-snapshot-validator.mjs";
import {
  validateRehearsalTrace,
} from "../archive/public-disclosures/source/star-ascent-rehearsal-trace-validator.mjs";
import {
  createChangeFreezeManifest,
  validateChangeFreezeManifest,
} from "../archive/public-disclosures/source/star-ascent-change-freeze-validator.mjs";
import {
  validateLaunchHandoffPacket,
} from "../archive/public-disclosures/source/star-ascent-launch-handoff-validator.mjs";

// The production target supplies these CommonJS globals through workerd's
// nodejs_compat layer. Define them only for this direct Node bundle renderer.
globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(globalThis.__filename);

async function render(url = "http://localhost/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const requestUrl = new URL(url, "http://localhost/");

  return worker.fetch(
    new Request(requestUrl, { headers: {
      accept: "text/html",
      host: requestUrl.host,
      "x-forwarded-host": requestUrl.host,
      "x-forwarded-proto": requestUrl.protocol.replace(":", ""),
    } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the read-only IAT Network explorer in fail-closed launch state", async () => {
  const response = await render("/network");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /IAT NETWORK \/\/ LIVE SOLANA READOUT/);
  assert.match(html, /READ ONLY \/\/ NO WALLET CONNECTION/);
  assert.match(html, /IAT PROGRAM \/\/ MAINNET HOLD/);
  assert.match(html, /Wallet, transaction, program, or mint/);
  assert.match(html, /Balances and positions switch on only after verified Genesis evidence/);
  assert.doesNotMatch(html, /\b(?:phantom|solflare|backpack|walletconnect)\b/i);
});

test("renders reconciled future previews in both public languages", async () => {
  const paths = ["/future", "/future/predictive-engine", "/future/casino"];
  const [english, turkish] = await Promise.all([
    Promise.all(paths.map(async (path) => (await render(`https://internalagency.io${path}`)).text())),
    Promise.all(paths.map(async (path) => (await render(`https://ileriakil.com${path}`)).text())),
  ]);

  for (const html of english) {
    assert.match(html, /<html lang="en"/i);
    assert.match(html, /POST-GENESIS CONCEPT/);
    assert.match(html, /INACTIVE/);
    assert.match(html, /NO WAGER ROUTE/);
  }
  for (const html of turkish) {
    assert.match(html, /<html lang="tr"/i);
    assert.match(html, /BAŞLANGIÇ SONRASI KONSEPT/);
    assert.match(html, /PASİF/);
    assert.match(html, /BAHİS YOLU YOK/);
  }

  assert.match(english[1], /1% PROTOCOL EDGE/);
  assert.match(english[1], /EXTENDED \$IAT APY RUNWAY/);
  assert.match(english[2], /15 DAYS AFTER \$IAT GENESIS/);
  assert.match(turkish[1], /%1 PROTOKOL PAYI/);
  assert.match(turkish[1], /LİKİDİTE HAVUZU/);
  assert.match(turkish[1], /\$IAT APY SÜRESİNİ UZATAN KAYNAK/);
  assert.match(turkish[2], /\$IAT BAŞLANGICINDAN 15 GÜN SONRA/);
});

test("renders proof copy in Turkish on both Turkish public routes before hydration", async () => {
  const [prefixed, dedicatedHost] = await Promise.all([
    render("https://internalagency.io/tr/proof"),
    render("https://ileriakil.com/proof"),
  ]);
  const [prefixedHtml, dedicatedHostHtml] = await Promise.all([
    prefixed.text(),
    dedicatedHost.text(),
  ]);
  const englishLeak = /Every non-secret Devnet export and the separate local time-gate proof/;
  const turkishCopy = /Gizli olmayan tüm Devnet dışa aktarımları ve ayrı yerel zaman kapısı kanıtı/;

  for (const html of [prefixedHtml, dedicatedHostHtml]) {
    assert.match(html, /<html lang="tr"/i);
    assert.match(html, turkishCopy);
    assert.doesNotMatch(html, englishLeak);
  }
});

test("renders the STAR ASCENT launch page and transparent disclosure", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Internal Agency — STAR ASCENT<\/title>/i);
  assert.match(html, /STAR ASCENT/);
  assert.match(html, /No token price, profit, or guaranteed market value is promised/);
  assert.match(html, /REWARD CONTRACT/);
  assert.match(html, /PROPOSED \/ HOLD/);
  assert.match(html, /No wallet connection required/);
  assert.match(html, /href="#main-content"[^>]*>Skip to main content<\/a>/i);
  assert.match(html, /<main id="main-content" tabindex="-1">/i);
  assert.match(html, /id="registration-safety">Registration is free\. No seed phrase, private key, password, or payment is ever required\./i);
  assert.equal((html.match(/aria-describedby="registration-safety"/gi) ?? []).length, 3);
  assert.match(html, /property="og:image" content="(?:http:\/\/localhost)?\/og-star-ascent-v1\.png"/i);
  assert.match(html, /name="twitter:card" content="summary_large_image"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps bilingual and accessibility safeguards in source", async () => {
  const [page, css, keyArt] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/images/star-ascent-keyart-v2.png", import.meta.url)),
  ]);

  assert.match(page, /Skip to mission/);
  assert.match(page, /Misyona geç/);
  assert.match(page, /aria-label=\{t\.languageLabel\}/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /id="registration-safety"/);
  assert.match(page, /aria-describedby="registration-safety"/);
  assert.match(css, /\.sr-only\{/);
  assert.match(page, /document\.documentElement\.lang = language/);
  assert.match(page, /ANTI-SCAM PROTOCOL/);
  assert.match(page, /DOLANDIRICILIKTAN KORUNMA/);
  assert.match(page, /No transaction is automatic/);
  assert.match(page, /Hiçbir işlem otomatik değildir/);
  assert.match(page, /There is no private sale, paid registration/);
  assert.match(page, /transaction, token access, spending permission/);
  assert.match(page, /işlem, token erişimi, harcama izni/);
  assert.match(page, /treat those details as pending—not implied/);
  assert.match(page, /ayrıntıları kesinleşmemiş kabul edin/);
  assert.match(page, /Design targets are not live facts/);
  assert.match(page, /Tasarım hedefleri canlı veriler değildir/);
  assert.match(page, /SUPPLY DESIGN TARGET/);
  assert.match(page, /ARZ TASARIM HEDEFİ/);
  assert.match(page, /current status is not yet verified/);
  assert.match(page, /mevcut durum henüz doğrulanmadı/);
  assert.match(page, /Distribution and reward activation must not begin/);
  assert.match(page, /dağıtım ve ödül aktivasyonu başlamamalıdır/);
  assert.match(page, /Read the complete proposed terms/);
  assert.match(page, /Önerilen şartların tamamını oku/);
  assert.match(page, /Evidence required before distribution/);
  assert.match(page, /Dağıtımdan önce gereken kanıtlar/);
  assert.match(page, /Direct explorer links/);
  assert.match(page, /doğrudan explorer bağlantıları/);
  assert.match(page, /mathematical total of 100%/);
  assert.match(page, /matematiksel olarak %100 toplam/);
  assert.match(page, /iat-allocation-authority-checklist-en\.txt/);
  assert.match(page, /iat-allocation-authority-checklist-tr\.txt/);
  assert.match(page, /Read the design before any wallet action/);
  assert.match(page, /Herhangi bir cüzdan işleminden önce tasarımı okuyun/);
  assert.match(page, /iat-litepaper-en\.txt/);
  assert.match(page, /iat-litepaper-tr\.txt/);
  assert.match(page, /iat-solana-technical-spec-en\.txt/);
  assert.match(page, /iat-solana-technical-spec-tr\.txt/);
  assert.match(page, /iat-allocation-validator\.mjs/);
  assert.match(page, /iat-authority-plan-validator\.mjs/);
  assert.match(page, /star-ascent-communications-kit-en\.txt/);
  assert.match(page, /star-ascent-communications-kit-tr\.txt/);
  assert.match(page, /star-ascent-launch-rehearsal-en\.txt/);
  assert.match(page, /star-ascent-launch-rehearsal-tr\.txt/);
  assert.match(page, /star-ascent-readiness-scorecard-en\.txt/);
  assert.match(page, /star-ascent-readiness-scorecard-tr\.txt/);
  assert.match(page, /star-ascent-incident-response-en\.txt/);
  assert.match(page, /star-ascent-incident-response-tr\.txt/);
  assert.match(page, /star-ascent-release-packet-validator\.mjs/);
  assert.match(page, /star-ascent-evidence-ledger-validator\.mjs/);
  assert.match(page, /star-ascent-readiness-snapshot-validator\.mjs/);
  assert.match(page, /star-ascent-rehearsal-trace-validator\.mjs/);
  assert.match(page, /star-ascent-change-freeze-validator\.mjs/);
  assert.match(page, /star-ascent-launch-handoff-validator\.mjs/);
  assert.match(page, /Current readiness: HOLD/);
  assert.match(page, /Mevcut hazırlık durumu: BEKLET/);
  assert.match(page, /Freshness is a launch gate/);
  assert.match(page, /Güncellik bir lansman eşiğidir/);
  assert.match(page, /If a launch signal conflicts, stop the action/);
  assert.match(page, /Lansman sinyalleri çelişirse işlemi durdurun/);
  assert.match(page, /One source\. Three public surfaces\. No silent substitutions/);
  assert.match(page, /Tek kaynak\. Üç kamu yüzeyi\. Sessiz değişiklik yok/);
  assert.match(page, /22 FILES · 7 LANGUAGE PAIRS/);
  assert.match(page, /22 DOSYA · 7 DİL ÇİFTİ/);
  assert.match(page, /Current evidence needs an expiry, two reviewers, and a direct link/);
  assert.match(page, /Güncel kanıt; sona erme zamanı, iki inceleyen ve doğrudan bağlantı gerektirir/);
  assert.match(page, /Three gates\. One fail-closed snapshot/);
  assert.match(page, /Üç eşik\. Kapalı durumda başarısız olan tek görünüm/);
  assert.match(page, /Timed checks need an auditable handoff/);
  assert.match(page, /Zamanlı kontroller denetlenebilir bir devre teslimi gerektirir/);
  assert.match(page, /Freeze the reviewed bundle\. Detect every silent change/);
  assert.match(page, /İncelenen paketi dondurun\. Her sessiz değişikliği tespit edin/);
  assert.match(page, /Package the evidence\. Keep the final decision human/);
  assert.match(page, /Kanıtları paketleyin\. Nihai kararı insanda tutun/);
  assert.match(page, /names and email addresses are rejected/);
  assert.match(page, /adlar ve e-posta adresleri reddedilir/);
  assert.match(page, /What the allocation validator proves/);
  assert.match(page, /Tahsis doğrulayıcının kanıtladığı/);
  assert.match(page, /does not prove token authenticity/);
  assert.match(page, /token gerçekliğini/i);
  assert.match(page, /Authority plans stay proposed until the evidence is public/);
  assert.match(page, /Kanıtlar kamuya açılana kadar yetki planları öneri olarak kalır/);
  assert.doesNotMatch(page, /permanently revoked|kalıcı olarak kaldırılır/i);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.status \.eyebrow\{color:#4a3508\}/);
  assert.match(css, /\.safety-steps span\{color:var\(--amber\)\}/);
  assert.match(page, /\/images\/star-ascent-keyart-v2\.png/);
  assert.match(page, /width=\{1728\} height=\{909\} loading="lazy" decoding="async" fetchPriority="low"/);
  assert.match(page, /Amber STAR ASCENT signal-acquired deep-space telemetry artwork/);
  assert.match(page, /Kehribar STAR ASCENT sinyal alındı derin uzay telemetri görseli/);
  assert.match(css, /\.keyart-frame\{[^}]*overflow:hidden[^}]*isolation:isolate/);
  assert.match(css, /\.keyart-frame::after\{[^}]*pointer-events:none[^}]*animation:keyart-scan 14s linear infinite/);
  assert.match(css, /\.keyart img\{[^}]*height:auto[^}]*transition:transform 1\.2s ease/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{html\{scroll-behavior:auto\}\.pulse,\.keyart-frame::after\{animation:none\}/);
  assert.match(page, /PRE-LAUNCH ART · Decorative brand artwork — not live telemetry or network status\./);
  assert.match(page, /LANSMAN ÖNCESİ GÖRSEL · Dekoratif marka görseli — canlı telemetri veya ağ durumu değildir\./);
  assert.match(css, /\.keyart figcaption\{[^}]*text-transform:uppercase/);
  assert.match(css, /\.keyart\{[^}]*content-visibility:auto[^}]*contain-intrinsic-size:auto 52vw/);
  assert.match(css, /@media\(max-width:700px\)\{\.keyart\{[^}]*contain-intrinsic-size:auto 76vw\}/);
  assert.match(css, /\.keyart img\{aspect-ratio:1\.28;object-fit:cover;object-position:54% center\}/);
  assert.match(css, /@media\(prefers-reduced-data:reduce\)\{\.keyart-frame\{box-shadow:none\}\.keyart-frame::after\{display:none\}\.keyart:hover img\{transform:none\}\}/);
  assert.ok(keyArt.length > 1_000_000, "ships the inspected full-resolution key art");
  assert.match(css, /\.faq summary\{[^}]*min-height:44px/);
  assert.match(css, /\.hero h1\{font-size:clamp\(3\.9rem,22vw,5rem\)/);
  assert.match(css, /\.schedule li\{grid-template-columns:1fr/);
  assert.match(css, /\.token-disclosure dl/);
  assert.match(css, /\.evidence-pack li/);
  assert.match(css, /\.document-cards/);
  assert.match(css, /\.readiness-scorecard/);
  assert.match(css, /\.incident-response/);
  assert.match(css, /\.release-packet/);
  assert.match(css, /\.evidence-ledger/);
  assert.match(css, /\.readiness-snapshot/);
  assert.match(css, /\.rehearsal-trace/);
  assert.match(css, /\.change-freeze/);
  assert.match(css, /\.launch-handoff/);
});

test("ships bilingual readiness scorecards with freshness and hold gates", async () => {
  const [english, turkish] = await Promise.all([
    readFile(new URL("../archive/public-disclosures/source/star-ascent-readiness-scorecard-en.txt", import.meta.url), "utf8"),
    readFile(new URL("../archive/public-disclosures/source/star-ascent-readiness-scorecard-tr.txt", import.meta.url), "utf8"),
  ]);

  assert.match(english, /CURRENT DECISION: HOLD/);
  assert.match(english, /T−60 minutes/);
  assert.match(english, /cross-channel mismatch returns the launch\s+to HOLD/);
  assert.match(english, /Any HOLD or FAIL blocks address publication/);
  assert.match(turkish, /MEVCUT KARAR: BEKLET/);
  assert.match(turkish, /T−60 dakikada/);
  assert.match(turkish, /kanallar arası uyumsuzluk\s+lansmanı BEKLET durumuna döndürür/);
  assert.match(turkish, /BEKLET veya BAŞARISIZ durumu adres yayınını/);
});

test("audits every public document link and bilingual critical marker", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const linkedFiles = new Set(
    [...page.matchAll(/\/disclosures\/([a-z0-9.-]+)/gi)].map((match) => match[1]),
  );
  const auditedFiles = new Set([
    ...PUBLICATION_MANIFEST.bilingualPairs.flatMap((pair) => [pair.en, pair.tr]),
    ...PUBLICATION_MANIFEST.sharedFiles.map((file) => file.path),
  ]);

  for (const path of linkedFiles) {
    const file = await readFile(new URL(`../archive/public-disclosures/source/${path}`, import.meta.url), "utf8");
    assert.ok(file.trim(), `${path} must be a non-empty public file`);
  }
  assert.deepEqual(
    [...linkedFiles].filter((path) => path !== "star-ascent-publication-audit.mjs").sort(),
    [...auditedFiles].sort(),
  );

  const bundle = new Map(
    await Promise.all(
      [...auditedFiles].map(async (path) => [
        path,
        await readFile(new URL(`../archive/public-disclosures/source/${path}`, import.meta.url), "utf8"),
      ]),
    ),
  );
  assert.deepEqual(auditPublicationBundle(bundle), {
    criticalMarkerStatus: "pass",
    fileCount: 22,
    languagePairCount: 7,
    networkChecked: false,
    readinessDecision: "HOLD",
  });

  const missingWarning = new Map(bundle);
  missingWarning.set(
    "star-ascent-readiness-scorecard-en.txt",
    missingWarning.get("star-ascent-readiness-scorecard-en.txt").replace(
      "Any HOLD or FAIL blocks",
      "A decision blocks",
    ),
  );
  assert.throws(
    () => auditPublicationBundle(missingWarning),
    /missing critical marker.*readiness-scorecard-en/i,
  );
});

test("launch handoff composes three HOLD results and requires separated human roles", () => {
  const packet = {
    lifecycle: "pre-launch",
    readinessDecision: "HOLD",
    humanDecision: "pending",
    handoffId: "star-ascent-2026-07-28-pre-action",
    preparedAtUtc: "2026-07-28T13:59:30Z",
    roles: {
      releaseOperator: "release-operator",
      safetyReviewer: "safety-reviewer",
      decisionOwner: "decision-owner",
    },
    readinessSnapshot: {
      readinessDecision: "HOLD",
      networkChecked: false,
      unresolvedEvidenceCount: 2,
      unresolvedReleaseCriticalCount: 3,
    },
    rehearsalTrace: {
      readinessDecision: "HOLD",
      networkChecked: false,
      unresolvedCount: 1,
    },
    changeFreeze: {
      readinessDecision: "HOLD",
      networkChecked: false,
      digestAlgorithm: "sha256",
      assetCount: 22,
      frozenAtUtc: "2026-07-28T13:58:00Z",
    },
  };

  assert.deepEqual(validateLaunchHandoffPacket(packet), {
    assetCount: 22,
    handoffId: "star-ascent-2026-07-28-pre-action",
    humanDecisionRequired: true,
    launchApproved: false,
    networkChecked: false,
    preparedAtUtc: "2026-07-28T13:59:30Z",
    readinessDecision: "HOLD",
    roleCount: 3,
    unresolvedCount: 6,
  });
  assert.throws(
    () => validateLaunchHandoffPacket({
      ...packet,
      roles: {
        ...packet.roles,
        safetyReviewer: "reviewer@example.test",
      },
    }),
    /do not supply a name or email address/,
  );
  assert.throws(
    () => validateLaunchHandoffPacket({
      ...packet,
      humanDecision: "approved",
    }),
    /humanDecision must remain pending/,
  );
});

test("change-freeze manifest detects altered, missing, and unexpected public assets", () => {
  const bundle = new Map([
    ["landing-page.html", "<main>PRE-LAUNCH · HOLD</main>"],
    ["launch-kit-en.txt", "No wallet connection required."],
  ]);
  const manifest = createChangeFreezeManifest(bundle, "2026-07-27T05:00:00Z");

  assert.deepEqual(validateChangeFreezeManifest(manifest, bundle), {
    assetCount: 2,
    digestAlgorithm: "sha256",
    frozenAtUtc: "2026-07-27T05:00:00Z",
    launchApproved: false,
    networkChecked: false,
    readinessDecision: "HOLD",
  });
  assert.throws(
    () => validateChangeFreezeManifest({
      ...manifest,
      frozenAtUtc: "not-a-utc-timestamp",
    }, bundle),
    /frozenAtUtc must be a valid UTC timestamp/,
  );
  assert.throws(
    () => validateChangeFreezeManifest(manifest, new Map([
      ...bundle,
      ["launch-kit-en.txt", "Changed without review."],
    ])),
    /content digest mismatch/,
  );
  assert.throws(
    () => validateChangeFreezeManifest(manifest, new Map([
      ["landing-page.html", bundle.get("landing-page.html")],
    ])),
    /missing frozen asset/,
  );
  assert.throws(
    () => validateChangeFreezeManifest(manifest, new Map([
      ...bundle,
      ["unapproved.txt", "extra"],
    ])),
    /unexpected public asset outside freeze/,
  );
});

test("rehearsal trace requires ordered separated checks and stays on HOLD", () => {
  const validTrace = {
    lifecycle: "pre-launch",
    readinessDecision: "HOLD",
    checks: [
      {
        phase: "t-60",
        status: "pass",
        checkedAtUtc: "2026-07-28T13:00:00Z",
        operatorRole: "broadcast operator",
        reviewerRole: "safety reviewer",
        notes: "Evidence and public copy checked.",
      },
      {
        phase: "t-15",
        status: "hold",
        checkedAtUtc: "2026-07-28T13:45:00Z",
        operatorRole: "community operator",
        reviewerRole: "release reviewer",
        notes: "Pinned announcement remains unpublished.",
      },
      {
        phase: "pre-action",
        status: "pass",
        checkedAtUtc: "2026-07-28T13:59:00Z",
        operatorRole: "release operator",
        reviewerRole: "evidence reviewer",
        notes: "No wallet action requested.",
      },
    ],
  };

  assert.deepEqual(validateRehearsalTrace(validTrace), {
    checkCount: 3,
    launchApproved: false,
    networkChecked: false,
    readinessDecision: "HOLD",
    unresolvedCount: 1,
  });
  assert.throws(
    () => validateRehearsalTrace({
      ...validTrace,
      checks: validTrace.checks.map((check) => (
        check.phase === "t-15"
          ? { ...check, reviewerRole: check.operatorRole }
          : check
      )),
    }),
    /separated operator and reviewer roles/,
  );
  assert.throws(
    () => validateRehearsalTrace({
      ...validTrace,
      checks: validTrace.checks.map((check) => (
        check.phase === "pre-action"
          ? { ...check, checkedAtUtc: "2026-07-28T12:59:00Z" }
          : check
      )),
    }),
    /strictly increasing UTC times/,
  );
});

test("composes publication, channel, and evidence results into a HOLD snapshot", () => {
  const result = composeReadinessSnapshot({
    lifecycle: "pre-launch",
    readinessDecision: "HOLD",
    publication: {
      criticalMarkerStatus: "pass",
      fileCount: 19,
      languagePairCount: 7,
      networkChecked: false,
      readinessDecision: "HOLD",
    },
    releasePacket: {
      channelCount: 3,
      fieldCount: 10,
      networkChecked: false,
      readinessDecision: "HOLD",
      unresolvedCriticalCount: 6,
    },
    evidenceLedger: {
      evidenceRecordCount: 6,
      networkChecked: false,
      readinessDecision: "HOLD",
      unresolvedCount: 1,
      verifiedCurrentCount: 5,
    },
  });

  assert.deepEqual(result, {
    evidenceRecordCount: 6,
    languagePairCount: 7,
    launchApproved: false,
    networkChecked: false,
    publicationFileCount: 19,
    readinessDecision: "HOLD",
    releaseChannelCount: 3,
    releaseFieldCount: 10,
    unresolvedEvidenceCount: 1,
    unresolvedReleaseCriticalCount: 6,
    verifiedCurrentCount: 5,
  });
  assert.throws(
    () => composeReadinessSnapshot({
      lifecycle: "pre-launch",
      readinessDecision: "READY",
    }),
    /must remain HOLD/,
  );
});

test("evidence ledger rejects stale or weak review metadata and stays on HOLD", () => {
  const asOfUtc = "2026-07-27T12:00:00Z";
  const verified = (id) => ({
    id,
    status: "verified",
    publicUrl: `https://example.invalid/evidence/${id}`,
    observedValue: `${id}-public-value`,
    checkedAtUtc: "2026-07-27T11:30:00Z",
    expiresAtUtc: "2026-07-27T12:30:00Z",
    reviewerRole: "evidence operator",
    independentReviewerRole: "safety reviewer",
  });
  const ledger = {
    lifecycle: "pre-launch",
    readinessDecision: "HOLD",
    asOfUtc,
    records: [
      verified("token-identity"),
      verified("mint-authority"),
      verified("freeze-authority"),
      verified("allocation-map"),
      verified("release-controls"),
      {
        id: "channel-consistency",
        status: "pending",
        holdReason: "Final public copy has not been published.",
      },
    ],
  };

  assert.deepEqual(validateEvidenceFreshnessLedger(ledger), {
    evidenceRecordCount: 6,
    networkChecked: false,
    readinessDecision: "HOLD",
    unresolvedCount: 1,
    verifiedCurrentCount: 5,
  });
  assert.throws(
    () => validateEvidenceFreshnessLedger({
      ...ledger,
      records: ledger.records.map((record) => (
        record.id === "token-identity"
          ? { ...record, expiresAtUtc: "2026-07-27T11:59:59Z" }
          : record
      )),
    }),
    /evidence is stale/,
  );
  assert.throws(
    () => validateEvidenceFreshnessLedger({
      ...ledger,
      records: ledger.records.map((record) => (
        record.id === "mint-authority"
          ? { ...record, independentReviewerRole: record.reviewerRole }
          : record
      )),
    }),
    /two separated review roles/,
  );
  assert.throws(
    () => validateEvidenceFreshnessLedger({
      ...ledger,
      records: ledger.records.filter((record) => record.id !== "freeze-authority"),
    }),
    /missing required evidence record: freeze-authority/,
  );
});

test("cross-channel release packet keeps exact public fields on HOLD", () => {
  const canonical = {
    projectName: "STAR ASCENT",
    launchStatus: "PRE-LAUNCH",
    mintAddress: "PENDING",
    tokenProgram: "PENDING",
    decimals: "PENDING",
    supplyBaseUnits: "PENDING",
    mintAuthorityState: "PENDING",
    freezeAuthorityState: "PENDING",
    registrationStatus: "CLOSED",
    safetyNotice: "NO WALLET CONNECTION REQUIRED",
  };
  const validPacket = {
    lifecycle: "pre-launch",
    readinessDecision: "HOLD",
    canonical,
    surfaces: {
      website: { ...canonical },
      pinnedAnnouncement: { ...canonical },
      livestream: { ...canonical },
    },
  };

  assert.deepEqual(validateCrossChannelReleasePacket(validPacket), {
    channelCount: 3,
    fieldCount: 10,
    networkChecked: false,
    readinessDecision: "HOLD",
    unresolvedCriticalCount: 6,
  });
  assert.throws(
    () => validateCrossChannelReleasePacket({
      ...validPacket,
      readinessDecision: "READY",
    }),
    /must remain HOLD/,
  );
  assert.throws(
    () => validateCrossChannelReleasePacket({
      ...validPacket,
      surfaces: {
        ...validPacket.surfaces,
        livestream: { ...canonical, mintAddress: "DIFFERENT_VALUE" },
      },
    }),
    /cross-channel mismatch for mintAddress on livestream/,
  );
});

test("ships bilingual incident-response runbooks with automatic hold triggers", async () => {
  const [english, turkish] = await Promise.all([
    readFile(new URL("../archive/public-disclosures/source/star-ascent-incident-response-en.txt", import.meta.url), "utf8"),
    readFile(new URL("../archive/public-disclosures/source/star-ascent-incident-response-tr.txt", import.meta.url), "utf8"),
  ]);

  assert.match(english, /DEFAULT DECISION: HOLD/);
  assert.match(english, /unexpected wallet request/i);
  assert.match(english, /Two separated review roles/);
  assert.match(english, /Support will not resolve an incident through a private message/);
  assert.match(turkish, /VARSAYILAN KARAR: BEKLET/);
  assert.match(turkish, /cüzdan işlem, transfer, token onayı/);
  assert.match(turkish, /İki ayrı inceleme rolü/);
  assert.match(turkish, /Destek bir olayı özel mesajla çözmez/);
});

test("ships bilingual allocation and authority checklists as pending templates", async () => {
  const [english, turkish] = await Promise.all([
    readFile(new URL("../archive/public-disclosures/source/iat-allocation-authority-checklist-en.txt", import.meta.url), "utf8"),
    readFile(new URL("../archive/public-disclosures/source/iat-allocation-authority-checklist-tr.txt", import.meta.url), "utf8"),
  ]);

  assert.match(english, /PRE-LAUNCH TEMPLATE — NOT LIVE TOKEN EVIDENCE/);
  assert.match(english, /Direct explorer link: PENDING/);
  assert.match(english, /Distribution must remain paused/);
  assert.match(turkish, /LANSMAN ÖNCESİ ŞABLON — CANLI TOKEN KANITI DEĞİLDİR/);
  assert.match(turkish, /Doğrudan explorer bağlantısı: BEKLİYOR/);
  assert.match(turkish, /dağıtım durmalıdır/);
});

test("ships bilingual litepapers as unverified pre-launch design drafts", async () => {
  const [english, turkish] = await Promise.all([
    readFile(new URL("../archive/public-disclosures/source/iat-litepaper-en.txt", import.meta.url), "utf8"),
    readFile(new URL("../archive/public-disclosures/source/iat-litepaper-tr.txt", import.meta.url), "utf8"),
  ]);

  assert.match(english, /PRE-LAUNCH DESIGN DRAFT — NOT LIVE TOKEN EVIDENCE/);
  assert.match(english, /Proposed allocation design — not final/);
  assert.match(english, /Distribution must remain paused/);
  assert.match(turkish, /LANSMAN ÖNCESİ TASARIM TASLAĞI — CANLI TOKEN KANITI DEĞİLDİR/);
  assert.match(turkish, /Önerilen tahsis tasarımı — kesinleşmemiştir/);
  assert.match(turkish, /Dağıtım durmalıdır/);
});

test("ships bilingual design-only Solana specification with safety gates", async () => {
  const [english, turkish] = await Promise.all([
    readFile(new URL("../archive/public-disclosures/source/iat-solana-technical-spec-en.txt", import.meta.url), "utf8"),
    readFile(new URL("../archive/public-disclosures/source/iat-solana-technical-spec-tr.txt", import.meta.url), "utf8"),
  ]);

  assert.match(english, /DESIGN AND TEST SCAFFOLD ONLY — NO LIVE MINT OR DEPLOYMENT/);
  assert.match(english, /Threat model/);
  assert.match(english, /Local-validator test plan/);
  assert.match(english, /Private keys, seed phrases, and passwords must never enter/);
  assert.match(turkish, /YALNIZCA TASARIM VE TEST İSKELETİ — CANLI MINT VEYA DAĞITIM YOKTUR/);
  assert.match(turkish, /Tehdit modeli/);
  assert.match(turkish, /Yerel doğrulayıcı test planı/);
  assert.match(turkish, /Özel anahtarlar, seed phrase'ler ve şifreler/);
});

test("allocation validator accepts exact totals and rejects unsafe manifests", () => {
  const validManifest = {
    supplyBaseUnits: "1000",
    categories: [
      {
        id: "community",
        totalBaseUnits: "700",
        recipients: [{ publicWallet: "PUBLIC_WALLET_A", amountBaseUnits: "700" }],
      },
      {
        id: "reserve",
        totalBaseUnits: "300",
        recipients: [{ publicWallet: "PUBLIC_WALLET_B", amountBaseUnits: "300" }],
      },
    ],
  };

  assert.deepEqual(validateAllocationManifest(validManifest), {
    categoryCount: 2,
    recipientCount: 2,
    supplyBaseUnits: "1000",
    totalBaseUnits: "1000",
  });

  assert.throws(
    () => validateAllocationManifest({ ...validManifest, supplyBaseUnits: "1001" }),
    /allocation total does not match supply/,
  );
  assert.throws(
    () => validateAllocationManifest({
      ...validManifest,
      categories: [
        validManifest.categories[0],
        {
          ...validManifest.categories[1],
          recipients: [{ publicWallet: "PUBLIC_WALLET_A", amountBaseUnits: "300" }],
        },
      ],
    }),
    /duplicate recipient wallet/,
  );
  assert.throws(
    () => validateAllocationManifest({
      supplyBaseUnits: "1.5",
      categories: validManifest.categories,
    }),
    /canonical integer base-unit string/,
  );
});

test("authority validator keeps proposed transitions behind a public evidence gate", () => {
  const validPlan = {
    status: "proposed",
    distributionBlockedUntilEvidence: true,
    authorities: [
      {
        role: "mint",
        currentPublicAuthority: "PUBLIC_MINT_AUTHORITY",
        intendedFinalState: "revoked",
        evidenceRequired: ["signed-change-record", "transaction-signature", "explorer-link"],
      },
      {
        role: "freeze",
        currentPublicAuthority: "PUBLIC_FREEZE_AUTHORITY",
        intendedFinalState: "transferred",
        destinationPublicAuthority: "PUBLIC_GOVERNANCE_AUTHORITY",
        evidenceRequired: ["signed-change-record", "independent-review"],
      },
    ],
  };

  assert.deepEqual(validateAuthorityTransitionPlan(validPlan), {
    authorityCount: 2,
    distributionBlockedUntilEvidence: true,
    finalStateCounts: { retained: 0, transferred: 1, revoked: 1 },
    status: "proposed",
  });
  assert.throws(
    () => validateAuthorityTransitionPlan({ ...validPlan, status: "final" }),
    /status must remain proposed/,
  );
  assert.throws(
    () => validateAuthorityTransitionPlan({
      ...validPlan,
      distributionBlockedUntilEvidence: false,
    }),
    /distribution must remain blocked/,
  );
  assert.throws(
    () => validateAuthorityTransitionPlan({
      ...validPlan,
      authorities: [validPlan.authorities[0], { ...validPlan.authorities[0] }],
    }),
    /duplicate authority role/,
  );
  assert.throws(
    () => validateAuthorityTransitionPlan({
      ...validPlan,
      authorities: [{
        ...validPlan.authorities[1],
        destinationPublicAuthority: "PUBLIC_FREEZE_AUTHORITY",
      }],
    }),
    /destination must differ/,
  );
});

test("ships bilingual launch communications kits with anti-scam publishing gates", async () => {
  const [english, turkish] = await Promise.all([
    readFile(new URL("../archive/public-disclosures/source/star-ascent-communications-kit-en.txt", import.meta.url), "utf8"),
    readFile(new URL("../archive/public-disclosures/source/star-ascent-communications-kit-tr.txt", import.meta.url), "utf8"),
  ]);

  assert.match(english, /PRE-LAUNCH DRAFT — VERIFY EVERY PENDING FACT BEFORE PUBLICATION/);
  assert.match(english, /Exact token-availability minute: NOT PROMISED/);
  assert.match(english, /LIVESTREAM RUN OF SHOW/);
  assert.match(english, /COMMUNITY SUPPORT SCRIPTS/);
  assert.match(english, /No token address, price, chart, wallet balance/);
  assert.match(turkish, /LANSMAN ÖNCESİ TASLAK — YAYINDAN ÖNCE BEKLEYEN HER BİLGİYİ DOĞRULAYIN/);
  assert.match(turkish, /Kesin token erişim dakikası: VAAT EDİLMİYOR/);
  assert.match(turkish, /CANLI YAYIN AKIŞI/);
  assert.match(turkish, /TOPLULUK DESTEK METİNLERİ/);
  assert.match(turkish, /Token adresi, fiyat, grafik, cüzdan bakiyesi/);
});

test("ships bilingual rehearsal playbooks with preflight and escalation gates", async () => {
  const [english, turkish] = await Promise.all([
    readFile(new URL("../archive/public-disclosures/source/star-ascent-launch-rehearsal-en.txt", import.meta.url), "utf8"),
    readFile(new URL("../archive/public-disclosures/source/star-ascent-launch-rehearsal-tr.txt", import.meta.url), "utf8"),
  ]);

  assert.match(english, /A REHEARSAL IS NOT LAUNCH APPROVAL/);
  assert.match(english, /PREFLIGHT CHECKLIST/);
  assert.match(english, /PAUSE AND ESCALATION MATRIX/);
  assert.match(english, /Any HOLD or FAIL keeps the launch disclosure paused/);
  assert.match(english, /seed phrase, private key, password, personal\s+data, payment/);
  assert.match(turkish, /PROVA, LANSMAN ONAYI DEĞİLDİR/);
  assert.match(turkish, /UÇUŞ ÖNCESİ KONTROL LİSTESİ/);
  assert.match(turkish, /DURAKLATMA VE ESKALASYON MATRİSİ/);
  assert.match(turkish, /Her BEKLET veya BAŞARISIZ sonucu lansman açıklamasını duraklatıyor/);
  assert.match(turkish, /seed phrase, özel anahtar, şifre,\s+kişisel veri, ödeme/);
});

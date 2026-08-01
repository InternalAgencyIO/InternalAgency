"use client";

import { useEffect, useState } from "react";

const EVIDENCE_ROOT = "/evidence/iat-v2";
const GITHUB_EVIDENCE =
  "https://github.com/InternalAgencyIO/InternalAgency/tree/agent/iat-launch-window/projects/star-ascent/site/public/evidence/iat-v2";

const evidenceRecords = [
  {
    file: "v2-initialization-20260730T074603Z.json",
    sha256: "902f7608b1f001e238c6e7999f8424b9a0fd38a61ac08db6f6b7e5f785d37602",
    en: ["V2 INITIALIZATION", "Seven-transaction deployment, immutable metadata, allocation, authority-revocation, and activation record."],
    tr: ["V2 BAŞLATMA", "Yedi işlemlik dağıtım, değişmez metadata, tahsis, yetki kaldırma ve etkinleştirme kaydı."],
  },
  {
    file: "v2-features-20260801T053340Z.json",
    sha256: "7b460bee7a644452c6710cff7a5b81a3a3769a1d2daf4d3813913d7524a9b6f9",
    en: ["V2 FEATURE SNAPSHOT", "Latest 18-transaction record: three stake roles, standard and CCC-agent week-8 payouts, the selected-agency CCC-associate pause, core APY, liquidity unlock, Switchboard randomness, and CCC rounds 7 and 8. Later time gates remain outside this signed snapshot."],
    tr: ["V2 ÖZELLİK GÖRÜNTÜSÜ", "En son 18 işlem kaydı: üç stake rolü, standart ve CCC-agent hafta-8 ödemeleri, seçili ajans nedeniyle CCC-associate duraklaması, core APY, likidite açılımı, Switchboard rastgeleliği ve CCC tur 7 ve 8. Sonraki zaman kapıları bu imzalı kaydın dışındadır."],
  },
  {
    file: "chain-status-20260801T053947Z.json",
    sha256: "0a2e1f8ffeecffaf974e51f2d6e9abe020517a784c5cfa8b9c0f6af1f1efa4ce",
    en: ["CHAIN STATUS RECEIPT", "Read-only devnet RPC receipt: all 29 canonical transaction signatures were finalized with no reported error."],
    tr: ["ZİNCİR DURUM MAKBUZU", "Salt okunur devnet RPC makbuzu: 29 kanonik işlem imzasının tamamı bildirilen hata olmadan finalized."],
  },
  {
    file: "v2-feature-independent-signoff-20260801T055736Z.json",
    sha256: "74487d17063e2bcf25bf00c9a23299f357bdf122b078342e2d40d46c58a7bf01",
    en: ["INDEPENDENT FEATURE REVIEW", "FDF Guard approval, relayed by the launch operator, binds the corrected artifact, the 18-transaction feature export, and the 29-signature receipt. Mainnet remains HOLD."],
    tr: ["BAĞIMSIZ ÖZELLİK İNCELEMESİ", "Lansman operatörü tarafından aktarılan FDF Guard onayı; düzeltilmiş artifact'i, 18 işlemlik özellik kaydını ve 29 imzalı makbuzu bağlar. Mainnet BEKLET durumundadır."],
  },
  {
    file: "v2-local-time-gate-proof-20260801T072730Z.json",
    sha256: "11245226a3ed1941519cf1f8fa875e3f6448d4a4144c0b612672a09750c22e6c",
    en: ["LOCAL TIME-GATE PROOF", "Exact host-program boundary proof: 34 clock, maturity, cliff, and linear-unlock vectors; four Rust tests and 14 JavaScript tests. No validator transaction, wallet, signing, or broadcast."],
    tr: ["YEREL ZAMAN KAPISI KANITI", "Kesin host-program sınır kanıtı: 34 saat, vade, cliff ve doğrusal açılım vektörü; dört Rust ve 14 JavaScript testi. Validator işlemi, cüzdan, imza veya yayın yoktur."],
  },
  {
    file: "index.json",
    sha256: null,
    en: ["COMPLETE FILE INDEX", "Every export, including superseded progress snapshots and the historical V1 record, with byte counts and SHA-256 digests."],
    tr: ["TAM DOSYA DİZİNİ", "Geçersiz kılınan ilerleme görüntüleri ve tarihsel V1 kaydı dahil her dışa aktarım; bayt sayıları ve SHA-256 özetleriyle."],
  },
];

const copy = {
  en: {
    launch: "LAUNCH CONTROL",
    eyebrow: "STAR ASCENT // PUBLIC PROOF BOARD",
    title: <>NO CLAIM<br />WITHOUT PROOF.</>,
    lede: "Every non-secret Devnet export and the separate local time-gate proof are public under CC0. The 18-transaction rehearsal and operator-relayed FDF Guard review are recorded; mainnet remains on hold for funding, final preflight, and scheduling.",
    fields: [
      ["Mainnet mint", "Not published", "No mainnet IAT mint is represented by these devnet records."],
      ["V2 program", "Devnet live", "Program 62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj is named in both V2 rehearsal records."],
      ["Initialization", "7 / 7", "All seven recorded V2 initialization signatures were observed finalized on devnet."],
      ["Feature progress", "18 TX", "Three stake roles, standard and CCC-linked week-8 settlement outcomes, core APY, liquidity unlock, Switchboard randomness, and two settled CCC draws are recorded."],
      ["Chain receipt", "29 / 29", "Every canonical signature across the published V1 and V2 exports was observed finalized with no reported transaction error."],
      ["Independent review", "Verified", "The operator-relayed FDF Guard approval is published with its evidence bindings and UTC completion time."],
      ["Local time gates", "34 / 34", "Host-only maturity, cliff, and linear-unlock vectors passed without any wallet, signer, validator transaction, or broadcast."],
    ],
    evidence: "CC0 PUBLIC EVIDENCE",
    evidenceTitle: "RAW BYTES. PUBLIC HASHES. NO SECRETS.",
    evidenceLede: "The initialization and feature exports describe separate devnet rehearsal instances, so their mint and configuration addresses differ. Neither is a mainnet mint.",
    download: "DOWNLOAD JSON",
    hash: "SHA-256",
    github: "OPEN THE GITHUB EVIDENCE DIRECTORY",
    cc0: "CC0 1.0 PUBLIC-DOMAIN DEDICATION",
    scope: "WHAT THIS DOES NOT PROVE",
    scopeTitle: "Publication is not launch approval.",
    scopeBody: "Every immediately available feature path, the independent feature review, and separate local time boundaries are recorded. The local proof is not a signed Devnet transaction. Mainnet funding, final packet regeneration, and replacement ceremony scheduling are not complete. Mainnet remains HOLD.",
    order: "PUBLICATION ORDER",
    rule: "Sign physically. Verify independently. Publish everywhere together.",
    links: ["RUN OF SHOW", "GENESIS RECORD", "OFFICIAL SIGNAL"],
    guide: "FIELD GUIDE",
    guideLine: "Know the public verification order before Genesis begins.",
    footer: "STAR ASCENT // EVIDENCE BEFORE AMPLIFICATION",
  },
  tr: {
    launch: "LANSMAN KONTROLÜ",
    eyebrow: "STAR ASCENT // KAMU KANIT PANOSU",
    title: <>KANIT YOKSA<br /><i>İDDİA YOK.</i></>,
    lede: "Gizli olmayan tüm Devnet dışa aktarımları ve ayrı yerel zaman kapısı kanıtı CC0 ile kamusaldır. 18 işlemlik prova ve operatör tarafından aktarılan FDF Guard incelemesi kayıtlıdır; fonlama, son ön kontrol ve planlama bitene kadar mainnet beklemede.",
    fields: [
      ["Mainnet mint", "Yayımlanmadı", "Bu devnet kayıtlarının hiçbiri mainnet IAT minti değildir."],
      ["V2 programı", "Devnet canlı", "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj programı iki V2 prova kaydında da belirtilir."],
      ["Başlatma", "7 / 7", "Kayıtlı yedi V2 başlatma imzasının tamamı devnette finalized olarak gözlemlendi."],
      ["Özellik ilerlemesi", "18 TX", "Üç stake rolü, standart ve CCC bağlantılı hafta-8 hesaplaşma sonuçları, core APY, likidite açılımı, Switchboard rastgeleliği ve iki sonuçlanmış CCC çekilişi kayıtlıdır."],
      ["Zincir makbuzu", "29 / 29", "Yayımlanan V1 ve V2 dosyalarındaki her kanonik imza, bildirilen işlem hatası olmadan finalized olarak gözlemlendi."],
      ["Bağımsız inceleme", "Doğrulandı", "Operatör tarafından aktarılan FDF Guard onayı, kanıt bağları ve UTC tamamlanma zamanıyla yayımlanmıştır."],
      ["Yerel zaman kapıları", "34 / 34", "Host-only vade, cliff ve doğrusal açılım vektörleri; cüzdan, imzalayan, validator işlemi veya yayın olmadan geçti."],
    ],
    evidence: "CC0 KAMU KANITI",
    evidenceTitle: "HAM BAYTLAR. KAMU HASH'LERİ. GİZLİ VERİ YOK.",
    evidenceLede: "Başlatma ve özellik dışa aktarımları ayrı devnet prova örneklerini anlatır; bu nedenle mint ve yapılandırma adresleri farklıdır. Hiçbiri mainnet minti değildir.",
    download: "JSON İNDİR",
    hash: "SHA-256",
    github: "GITHUB KANIT DİZİNİNİ AÇ",
    cc0: "CC0 1.0 KAMU MALI FERAGATİ",
    scope: "BU KAYIT NEYİ KANITLAMIYOR",
    scopeTitle: "Yayımlamak, lansman onayı değildir.",
    scopeBody: "Anında kullanılabilir tüm özellik yolları, bağımsız inceleme ve ayrı yerel zaman sınırları kaydedildi. Yerel kanıt imzalı bir Devnet işlemi değildir. Mainnet fonlaması, son paket yenilemesi ve yeni tören planı tamamlanmadı. Mainnet BEKLET durumundadır.",
    order: "YAYIN SIRASI",
    rule: "Fiziksel imzala. Bağımsız doğrula. Her yerde birlikte yayımla.",
    links: ["YAYIN AKIŞI", "BAŞLANGIÇ KAYDI", "RESMÎ SİNYAL"],
    guide: "SAHA REHBERİ",
    guideLine: "Başlangıç öncesi kamusal doğrulama sırasını öğren.",
    footer: "STAR ASCENT // KANIT, YÜKSELTİDEN ÖNCE GELİR",
  },
};

export default function ProofPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => { if (window.location.hostname.includes("ileriakil")) setLanguage("tr"); }, []);
  const t = copy[language];
  return <main className="proof-page"><div className="proof-stars" aria-hidden="true" /><nav><a href="/">IA<span>///</span></a><a href="/launch">{t.launch} ↗</a></nav>
    <section className="proof-hero"><p>{t.eyebrow}</p><h1>{t.title}</h1><p>{t.lede}</p></section>
    <section className="proof-grid">{t.fields.map(([label,status,detail], index)=><article key={label}><span>0{index + 1}</span><div><p>{label}</p><strong>{status}</strong><small>{detail}</small></div></article>)}</section>
    <section className="proof-evidence">
      <p>{t.evidence}</p>
      <h2>{t.evidenceTitle}</h2>
      <span>{t.evidenceLede}</span>
      <div className="proof-evidence-grid">
        {evidenceRecords.map((record, index) => {
          const [label, detail] = record[language];
          return <article key={record.file}>
            <span>0{index + 1}</span>
            <p>{label}</p>
            <h3>{detail}</h3>
            {record.sha256 && <code><b>{t.hash}</b>{record.sha256}</code>}
            <a href={`${EVIDENCE_ROOT}/${record.file}`}>{t.download} ↗</a>
          </article>;
        })}
      </div>
      <div className="proof-evidence-links">
        <a href={GITHUB_EVIDENCE} target="_blank" rel="noreferrer">{t.github} ↗</a>
        <a href={`${EVIDENCE_ROOT}/CC0-1.0.md`}>{t.cc0} ↗</a>
      </div>
    </section>
    <section className="proof-scope"><p>{t.scope}</p><h2>{t.scopeTitle}</h2><span>{t.scopeBody}</span></section>
    <section className="proof-rule"><p>{t.order}</p><h2>{t.rule}</h2><div><a href="/launch">{t.links[0]} ↗</a><a href="/dossier/read/genesis-proof">{t.links[1]} ↗</a><a href="/signal">{t.links[2]} ↗</a></div></section>
    <section className="proof-rule"><p>{t.guide}</p><h2>{t.guideLine}</h2><div><a href="/verify">{t.guide} ↗</a></div></section><footer>{t.footer}</footer>
  </main>;
}

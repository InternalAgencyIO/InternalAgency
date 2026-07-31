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
    file: "v2-features-20260731T101732Z.json",
    sha256: "4c81fe0dc4e5ec92bf8ac24d73e0c923eff02159d8f03674c13909c82b4d6b85",
    en: ["V2 FEATURE SNAPSHOT", "Latest 14-transaction record: three stake roles, the first standard settlement, core APY, liquidity unlock, Switchboard randomness, and CCC selection. Remaining time gates and independent review are pending."],
    tr: ["V2 ÖZELLİK GÖRÜNTÜSÜ", "En son 14 işlemlik kayıt: üç stake rolü, ilk standart hesaplaşma, core APY, likidite açılımı, Switchboard rastgeleliği ve CCC seçimi. Kalan zaman kapıları ve bağımsız inceleme bekliyor."],
  },
  {
    file: "chain-status-20260731T102046Z.json",
    sha256: "9b2bfa33f82e67a88d109c96173263ecc1b216d10bea751aa60793595d302093",
    en: ["CHAIN STATUS RECEIPT", "Read-only devnet RPC receipt: all 25 canonical transaction signatures were finalized with no reported error."],
    tr: ["ZİNCİR DURUM MAKBUZU", "Salt okunur devnet RPC makbuzu: 25 kanonik işlem imzasının tamamı bildirilen hata olmadan finalized."],
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
    lede: "Every non-secret devnet export is public under CC0. The 14-transaction feature rehearsal includes the first standard settlement; mainnet remains on hold until the remaining time gates and independent review are finished.",
    fields: [
      ["Mainnet mint", "Not published", "No mainnet IAT mint is represented by these devnet records."],
      ["V2 program", "Devnet live", "Program 62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj is named in both V2 rehearsal records."],
      ["Initialization", "7 / 7", "All seven recorded V2 initialization signatures were observed finalized on devnet."],
      ["Feature progress", "14 TX", "Three stake roles, the first standard settlement, core APY, liquidity unlock, Switchboard randomness, and a settled CCC draw are recorded."],
      ["Chain receipt", "25 / 25", "Every canonical signature across the published V1 and V2 exports was observed finalized with no reported transaction error."],
      ["Independent review", "Required", "FDF Guard must still compare the complete feature result and sign the public review record."],
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
    scopeBody: "CCC-linked week-8 settlements remain gated on real CCC round 8. Later maturity, cliff and linear-unlock gates, and independent review are not complete. Mainnet remains HOLD.",
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
    lede: "Gizli olmayan tüm devnet dışa aktarımları artık CC0 ile kamusaldır. Kayıt açık; tamamlanmamış özellik yolları ve bağımsız inceleme bitene kadar mainnet beklemede.",
    fields: [
      ["Mainnet mint", "Yayımlanmadı", "Bu devnet kayıtlarının hiçbiri mainnet IAT minti değildir."],
      ["V2 programı", "Devnet canlı", "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj programı iki V2 prova kaydında da belirtilir."],
      ["Başlatma", "7 / 7", "Kayıtlı yedi V2 başlatma imzasının tamamı devnette finalized olarak gözlemlendi."],
      ["Özellik ilerlemesi", "14 TX", "Üç stake rolü, ilk standart hesaplaşma, core APY, likidite açılımı, Switchboard rastgeleliği ve sonuçlanmış CCC çekilişi kayıtlıdır."],
      ["Zincir makbuzu", "25 / 25", "Yayımlanan V1 ve V2 dosyalarındaki her kanonik imza, bildirilen işlem hatası olmadan finalized olarak gözlemlendi."],
      ["Bağımsız inceleme", "Gerekli", "FDF Guard tam özellik sonucunu karşılaştırmalı ve kamu inceleme kaydını imzalamalıdır."],
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
    scopeBody: "CCC bağlantılı hafta-8 hesaplaşmaları gerçek CCC tur 8 kapısında bekliyor. Sonraki vade, uçurum ve doğrusal açılım kapıları ile bağımsız inceleme tamamlanmış değildir. Mainnet BEKLET durumundadır.",
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

"use client";

import { useEffect, useState } from "react";

const copy = {
  en: {
    launch: "LAUNCH CONTROL", eyebrow: "STAR ASCENT // PUBLIC PROOF BOARD", title: <>NO CLAIM<br />WITHOUT PROOF.</>, lede: "This record changes only when public evidence can be checked directly. Until then, every field remains on hold.",
    fields: [["Mint", "Not published", "The canonical mint address will appear here only after independent verification."], ["Token program", "Not published", "Program, decimals, and exact fixed supply will be recorded together."], ["Mint authority", "Not published", "Direct explorer evidence is required after the documented initial mint."], ["Freeze authority", "Not published", "Direct explorer evidence is required after the documented initial mint."], ["Allocations", "Not published", "Public allocation wallets, amounts, and time-lock evidence will be linked here."], ["Verification", "HOLD", "A UTC timestamp and independent verifier identity are required before status can change."]],
    order: "PUBLICATION ORDER", rule: "Sign physically. Verify independently. Publish everywhere together.", links: ["RUN OF SHOW", "GENESIS RECORD", "OFFICIAL SIGNAL"], guide: "FIELD GUIDE", guideLine: "Know the public verification order before Genesis begins.", footer: "STAR ASCENT // EVIDENCE BEFORE AMPLIFICATION",
  },
  tr: {
    launch: "LANSMAN KONTROLÜ", eyebrow: "STAR ASCENT // KAMU KANIT PANOSU", title: <>KANIT YOKSA<br /><i>İDDİA YOK.</i></>, lede: "Bu kayıt yalnızca kamusal kanıt doğrudan kontrol edilebildiğinde değişir. O zamana kadar her alan beklettedir.",
    fields: [["Mint", "Yayımlanmadı", "Kanonik mint adresi yalnızca bağımsız doğrulamadan sonra burada görünür."], ["Token programı", "Yayımlanmadı", "Program, ondalıklar ve tam sabit arz birlikte kayda geçer."], ["Mint yetkisi", "Yayımlanmadı", "Belgelenmiş ilk mintten sonra doğrudan Explorer kanıtı gerekir."], ["Dondurma yetkisi", "Yayımlanmadı", "Belgelenmiş ilk mintten sonra doğrudan Explorer kanıtı gerekir."], ["Tahsisler", "Yayımlanmadı", "Kamu tahsis cüzdanları, miktarlar ve zaman kilidi kanıtları burada bağlanır."], ["Doğrulama", "BEKLET", "Durum değişmeden önce UTC zaman damgası ve bağımsız doğrulayıcı kimliği gerekir."]],
    order: "YAYIN SIRASI", rule: "Fiziksel imzala. Bağımsız doğrula. Her yerde birlikte yayımla.", links: ["YAYIN AKIŞI", "BAŞLANGIÇ KAYDI", "RESMÎ SİNYAL"], guide: "SAHA REHBERİ", guideLine: "Başlangıç öncesi kamusal doğrulama sırasını öğren.", footer: "STAR ASCENT // KANIT, YÜKSELTİDEN ÖNCE GELİR",
  },
};

export default function ProofPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => { if (window.location.hostname.includes("ileriakil")) setLanguage("tr"); }, []);
  const t = copy[language];
  return <main className="proof-page"><div className="proof-stars" aria-hidden="true" /><nav><a href="/">IA<span>///</span></a><a href="/launch">{t.launch} ↗</a></nav>
    <section className="proof-hero"><p>{t.eyebrow}</p><h1>{t.title}</h1><p>{t.lede}</p></section>
    <section className="proof-grid">{t.fields.map(([label,status,detail], index)=><article key={label}><span>0{index + 1}</span><div><p>{label}</p><strong>{status}</strong><small>{detail}</small></div></article>)}</section>
    <section className="proof-rule"><p>{t.order}</p><h2>{t.rule}</h2><div><a href="/launch">{t.links[0]} ↗</a><a href="/dossier/read/genesis-proof">{t.links[1]} ↗</a><a href="/signal">{t.links[2]} ↗</a></div></section>
    <section className="proof-rule"><p>{t.guide}</p><h2>{t.guideLine}</h2><div><a href="/verify">{t.guide} ↗</a></div></section><footer>{t.footer}</footer>
  </main>;
}

"use client";

import { useEffect, useState } from "react";
import { sourceLanguageForClientPath } from "../i18n/config";
import "./verify.css";

const copy = {
  en: {
    proof: "PROOF BOARD", eyebrow: "STAR ASCENT // FIELD GUIDE 01", title: <>VERIFY THE<br /><i>SIGNAL.</i></>, lede: "Four checks. One public route. No shortcuts.",
    checks: [["START AT THE SOURCE", "Open Launch Control from the official site. Do not begin from a reply, a direct message, or a copied wallet link."], ["MATCH THE RECORD", "When the Genesis record is published, match the mint address, token program, decimals, and fixed supply across the site and an independent explorer."], ["CHECK AUTHORITY", "Confirm the public authority evidence and the allocation or timelock evidence before treating a distribution statement as final."], ["MOVE ONLY ON THE LIVE ROUTE", "A claim route, if one exists, will be shown on the official site itself. A countdown, a social post, or a screenshot is not a route."]],
    order: "THE LIVE ORDER", rule: "LAUNCH CONTROL → PROOF BOARD → INDEPENDENT RECORD", links: ["OPEN LAUNCH CONTROL", "OPEN PROOF BOARD", "OPEN WHITE DOSSIER"], footer: "STAR ASCENT // VERIFY WHAT YOU CAN SEE",
  },
  tr: {
    proof: "KANIT PANOSU", eyebrow: "STAR ASCENT // SAHA REHBERİ 01", title: <>SİNYALİ<br /><i>DOĞRULA.</i></>, lede: "Dört kontrol. Tek açık rota. Kestirme yok.",
    checks: [["KAYNAKTAN BAŞLA", "Lansman Kontrolü’nü resmî siteden aç. Bir yanıttan, doğrudan mesajdan veya kopyalanmış cüzdan bağlantısından başlama."], ["KAYDI EŞLEŞTİR", "Başlangıç kaydı yayımlandığında mint adresini, token programını, ondalıkları ve sabit arzı site ile bağımsız Explorer arasında eşleştir."], ["YETKİYİ KONTROL ET", "Bir dağıtım ifadesini kesin kabul etmeden önce kamu yetki kanıtını ve tahsis ya da zaman kilidi kanıtını kontrol et."], ["YALNIZCA CANLI ROTADA İLERLE", "Bir claim rotası varsa resmî sitenin kendisinde görünür. Geri sayım, sosyal gönderi veya ekran görüntüsü rota değildir."]],
    order: "CANLI SIRA", rule: "LANSMAN KONTROLÜ → KANIT PANOSU → BAĞIMSIZ KAYIT", links: ["LANSMAN KONTROLÜNÜ AÇ", "KANIT PANOSUNU AÇ", "BEYAZ DOSYAYI AÇ"], footer: "STAR ASCENT // GÖREBİLDİĞİNİ DOĞRULA",
  },
};

export default function VerifyPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => setLanguage(sourceLanguageForClientPath(window.location.pathname, window.location.hostname)), []);
  const t = copy[language];
  return <main className="verify-page"><div className="verify-orbit" aria-hidden="true" /><nav><a href="/">IA<span>///</span></a><a href="/proof">{t.proof} ↗</a></nav>
    <header><p>{t.eyebrow}</p><h1>{t.title}</h1><strong>{t.lede}</strong></header>
    <section className="verify-steps" aria-label={t.eyebrow}>{t.checks.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><div><h2>{title}</h2><p>{body}</p></div><b>→</b></article>)}</section>
    <section className="verify-command"><p>{t.order}</p><h2>{t.rule}</h2><div><a href="/launch">{t.links[0]} ↗</a><a href="/proof">{t.links[1]} ↗</a><a href="/dossier">{t.links[2]} ↗</a></div></section><footer>{t.footer}</footer>
  </main>;
}

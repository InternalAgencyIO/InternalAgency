"use client";

import { useEffect, useState } from "react";

const copy = {
  en: { label: "INTERNAL AGENCY // OFFICIAL SIGNAL DIRECTORY", title: <>ONE SIGNAL.<br />NO SHADOW LINKS.</>, intro: "Every verified public route begins here. Read the record, enter the activation terminal, and follow only channels published from this directory.", site: "MAIN SIGNAL", dossier: "WHITE DOSSIER", terminal: "ACTIVATION TERMINAL", broadcast: "BROADCAST WINDOW", status: "CHANNELS ACTIVATING", note: "New official social profiles will appear here as they are created and verified. Until then, the site and Dossier are the only canonical public surfaces.", safety: "NO SEED PHRASE. NO PRIVATE KEY. NO PAYMENT. NO IMPERSONATORS.", lang: "TÜRKÇE" },
  tr: { label: "İLERİ AKIL // RESMÎ SİNYAL DİZİNİ", title: <>TEK SİNYAL.<br />GÖLGE BAĞLANTI YOK.</>, intro: "Doğrulanmış her kamusal rota buradan başlar. Kaydı oku, aktivasyon terminaline gir ve yalnızca bu dizinde yayımlanan kanalları takip et.", site: "ANA SİNYAL", dossier: "BEYAZ DOSYA", terminal: "AKTİVASYON TERMİNALİ", broadcast: "YAYIN PENCERESİ", status: "KANALLAR AKTİFLEŞİYOR", note: "Yeni resmî sosyal profiller oluşturulup doğrulandıkça burada görünür. O zamana kadar site ve Dosya tek kanonik kamusal alandır.", safety: "SEED PHRASE YOK. ÖZEL ANAHTAR YOK. ÖDEME YOK. TAKLİTÇİ YOK.", lang: "ENGLISH" },
};

export default function SignalPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => { if (window.location.hostname.includes("ileriakil")) setLanguage("tr"); }, []);
  const t = copy[language];
  return <main className="signal-page"><div className="signal-page-noise" aria-hidden="true" />
    <nav className="signal-page-nav"><a href="/">IA<span>///</span></a><button onClick={() => setLanguage(language === "en" ? "tr" : "en")}>{t.lang}</button></nav>
    <section className="signal-page-hero"><p>{t.label}</p><h1>{t.title}</h1><div className="signal-page-orbit" aria-hidden="true"><i /><i /><i /></div><p className="signal-page-intro">{t.intro}</p></section>
    <section className="signal-directory"><a href="/"><small>01 // ROOT</small><strong>{t.site}</strong><span>↗</span></a><a href="/dossier"><small>02 // RECORD</small><strong>{t.dossier}</strong><span>↗</span></a><a href="/#genesis-console-title"><small>03 // PREPARE</small><strong>{t.terminal}</strong><span>↗</span></a><a href="/launch"><small>04 // WITNESS</small><strong>{t.broadcast}</strong><span>↗</span></a></section>
    <section className="signal-social"><p>{t.status}</p><div><i>◉</i><i>○</i><i>◉</i><i>○</i><i>◉</i></div><strong>{t.note}</strong></section><footer>{t.safety}</footer>
  </main>;
}

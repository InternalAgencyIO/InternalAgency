"use client";

import { useEffect, useState } from "react";

const copy = {
  en: {
    kicker: "INTERNAL AGENCY // WORLD ARCHIVE", title: <>THE SHIP<br />REMEMBERS.</>, intro: "STAR ASCENT is not a product universe. It is a live cultural machine: a ship held together by people who chose signal over noise.", stations: [["01", "THE BRIDGE", "The Stage Manager reads the room, the weather, the bandwidth. Nothing moves until the crew can see it."], ["02", "THE LIGHT DECK", "AI light operators turn pressure into color. Their job is not to persuade; it is to make the live system legible."], ["03", "THE ARCHIVE", "Every transmission leaves a trace: drafts, corrections, decisions, receipts, held lines, and the reasons a gate stayed closed."], ["04", "THE FLOOR", "The Scorpion Generation does not wait for permission to make a world. It brings discernment, taste, and a refusal to fake certainty."]], oath: "We build in public because the evidence is part of the art.", footer: "RETURN TO DOSSIER →"
  },
  tr: {
    kicker: "İLERİ AKIL // DÜNYA ARŞİVİ", title: <>GEMİ<br />HATIRLAR.</>, intro: "STAR ASCENT bir ürün evreni değildir. Sinyali gürültüye tercih eden insanların bir arada tuttuğu, yaşayan bir kültürel makinedir.", stations: [["01", "KÖPRÜ", "Sahne Yöneticisi odayı, havayı ve bağlantıyı okur. Ekip göremeden hiçbir şey hareket etmez."], ["02", "IŞIK GÜVERTESİ", "Yapay zekâ ışık operatörleri baskıyı renge çevirir. Görevleri ikna etmek değil; canlı sistemi okunabilir kılmaktır."], ["03", "ARŞİV", "Her iletim bir iz bırakır: taslaklar, düzeltmeler, kararlar, kayıtlar, bekletilen satırlar ve bir eşiğin neden kapalı kaldığı."], ["04", "ZEMİN", "Akrep Nesli bir dünya yaratmak için izin beklemez. Sağduyu, zevk ve sahte kesinliğe direnç getirir."]], oath: "Kanıt sanatın bir parçası olduğu için herkesin gözü önünde inşa ediyoruz.", footer: "DOSYAYA DÖN →"
  }
};

export default function WorldPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => { if (window.location.hostname.includes("ileriakil")) setLanguage("tr"); }, []);
  const t = copy[language];
  return <main className="world-page"><div className="world-stars" aria-hidden="true" /><nav className="world-nav"><a href="/">IA<span>///</span></a><div><a href="/dossier">{language === "tr" ? "DOSYA" : "DOSSIER"}</a><button onClick={() => setLanguage(language === "en" ? "tr" : "en")}>{language === "en" ? "TR" : "EN"}</button></div></nav><section className="world-hero"><p>{t.kicker}</p><h1>{t.title}</h1><p>{t.intro}</p></section><figure className="world-art"><img src="/images/radiance-roller-rave.png" alt={language === "tr" ? "Radiance, canlı sinyalin sahne operatörü" : "Radiance, stage operator of the live signal"} /><figcaption>RADIANCE // THE SIGNAL HAS A FACE</figcaption></figure><section className="world-stations">{t.stations.map(([number, title, text]) => <article key={number}><span>{number}</span><h2>{title}</h2><p>{text}</p></article>)}</section><section className="world-oath"><p>SCORPION GENERATION</p><h2>{t.oath}</h2><a href="/dossier">{t.footer}</a></section></main>;
}

"use client";

import { useEffect, useState } from "react";
import { LaunchClock } from "./LaunchClock";

type Language = "en" | "tr";

const links = {
  en: [["WHITE DOSSIER", "/dossier/read/white-dossier"], ["THE WORLD", "/world"], ["TOKENOMICS", "/dossier#tokenomics"], ["MINT MANIFEST", "/dossier/read/mint-manifest"], ["GENESIS PROOF", "/dossier/read/genesis-proof"], ["BROADCAST PACK", "/dossier/read/broadcast-pack"], ["SOCIAL KIT", "/dossier/read/social-kit"], ["GENESIS RUN", "/dossier/read/genesis-run"]],
  tr: [["BEYAZ DOSYA", "/dossier/read/white-dossier"], ["DÜNYA", "/world"], ["TOKENOMICS", "/dossier#tokenomics"], ["MINT BİLDİRİMİ", "/dossier/read/mint-manifest"], ["BAŞLANGIÇ KANITI", "/dossier/read/genesis-proof"], ["YAYIN PAKETİ", "/dossier/read/broadcast-pack"], ["SOSYAL KİT", "/dossier/read/social-kit"], ["BAŞLANGIÇ AKIŞI", "/dossier/read/genesis-run"]],
} as const;

export function DossierDock() {
  const [language, setLanguage] = useState<Language | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => setLanguage(window.location.hostname.includes("ileriakil") ? "tr" : "en"), []);
  if (!language) return null;
  const tr = language === "tr";
  return <aside className={`dossier-dock${open ? " dossier-dock--open" : ""}`} aria-label={tr ? "Kanonik lansman belgeleri" : "Canonical launch documents"}>
    <style>{`
      .dossier-dock .launch-clock{display:block;width:100%;box-sizing:border-box;overflow:hidden;margin:0 0 .75rem!important;padding:.6rem .45rem}
      .dossier-dock .launch-clock>p{font-size:.48rem;line-height:1.45}
      .dossier-dock .launch-clock>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.3rem}
      .dossier-dock .launch-clock>div span{display:grid;justify-items:start;gap:.08rem}
      .dossier-dock .launch-clock>div b{font-size:1.35rem}
      .dossier-dock .launch-clock>div em{font-size:.43rem}
      .dossier-dock .launch-clock>strong{font-size:.86rem;letter-spacing:0}
      .dossier-dock .launch-clock>small{overflow-wrap:anywhere;font-size:.42rem;line-height:1.4}
    `}</style>
    <button className="dossier-dock-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{tr ? "DOSYA VE KANITLAR" : "DOSSIER + PROOF"}<span>{open ? "−" : "+"}</span></button>
    <div className="dossier-dock-content"><p>{tr ? "KANONİK DOSYA" : "CANONICAL DOSSIER"}</p><LaunchClock language={language} /><a className="dossier-open" href="/dossier">{tr ? "GÖRSEL DOSYAYI AÇ →" : "READ THE VISUAL DOSSIER →"}</a><div>{links[language].map(([label, href]) => <a href={href} key={href}>{label}<span>{language.toUpperCase()}</span></a>)}</div></div>
  </aside>;
}

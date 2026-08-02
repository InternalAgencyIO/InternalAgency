"use client";

import { useEffect, useState } from "react";
import "./launch-sequence.css";

const copy = {
  en: { lines: ["STARSHIP CONTROL. GO.", "MAIN AI. GO.", "COMMANDER RADIANCE // GRD CTRL. GO.", "LIVE OUTER COMMS // SECURE RENDER CONTROL ROOM. GO.", "ENCRYPTED DEPLOYMENT TOOLS // ROOT SECTOR. GO.", "LAUNCH SEQUENCE. GO."], label: "INTERNAL AGENCY // OUTER COMMS", title: <>MAIN COUNTDOWN<br />START.</>, enter: "ENTER STAR ASCENT", launch: "OPEN LAUNCH CONTROL" },
  tr: { lines: ["YILDIZ GEMİSİ KONTROLÜ. HAZIR.", "ANA YAPAY ZEKÂ. HAZIR.", "KOMUTAN RADIANCE // YER KONTROL. HAZIR.", "CANLI DIŞ İLETİŞİM // GÜVENLİ KONTROL ODASI. HAZIR.", "ŞİFRELİ YAYIN ARAÇLARI // KÖK SEKTÖR. HAZIR.", "FIRLATMA DİZİSİ. HAZIR."], label: "İLERİ AKIL // DIŞ İLETİŞİM", title: <>ANA GERİ SAYIM<br />BAŞLIYOR.</>, enter: "STAR ASCENT'E GİR", launch: "LANSMAN KONTROLÜNÜ AÇ" },
};

export function LaunchSequence({ language }: { language: "en" | "tr" }) {
  const t = copy[language];
  const [visible, setVisible] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { setVisible(t.lines.length); return; }
    const id = window.setInterval(() => setVisible((value) => Math.min(t.lines.length, value + 1)), 420);
    return () => window.clearInterval(id);
  }, [t.lines.length]);
  if (dismissed) return null;
  return <section className="launch-sequence" aria-labelledby="launch-sequence-title"><div className="launch-fire" aria-hidden="true" /><div className="launch-sequence-copy"><p>{t.label}</p><div className="launch-lines" aria-live="off">{t.lines.slice(0, visible).map((line) => <span key={line}>{line}</span>)}</div><p className="launch-sequence-title" id="launch-sequence-title">{t.title}</p><div className="launch-sequence-actions"><button type="button" onClick={() => { setDismissed(true); document.querySelector("#main-content")?.scrollIntoView({ behavior: "smooth" }); }}>{t.enter} <b>↓</b></button>{visible === t.lines.length && <a href="/launch">{t.launch} ↗</a>}</div></div></section>;
}

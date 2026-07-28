"use client";

import { useEffect, useState } from "react";
import { LaunchClock } from "../LaunchClock";
import "./launch.css";

const copy = {
  en: { dossier: "WHITE DOSSIER", eyebrow: "STAR ASCENT // GENESIS CONTROL", title: <>THE ROOM<br />IS OPEN.</>, lede: "One signal. One public record. No shadow links.", actions: ["OPEN OFFICIAL SIGNAL DIRECTORY", "OPEN PROOF BOARD", "OPEN FIELD GUIDE", "OPEN PRESS ROOM", "READ THE DOSSIER"], status: "PUBLIC STATUS // UTC", cards: [["BROADCAST", "SCHEDULED // 13:30", "The room opens and the verification order is read aloud."], ["GENESIS", "SCHEDULED // 14:00", "The physical-signing and evidence sequence begins only on the public route."], ["CHAIN RECORD", "HOLD // AWAITING EVIDENCE", "No mint, authority, allocation, or claim fact is published before direct proof."], ["PUBLIC ROUTE", "PROOF BOARD // HOLD", "The site changes only when the same record can be independently checked."]] },
  tr: { dossier: "BEYAZ DOSYA", eyebrow: "STAR ASCENT // BAŞLANGIÇ KONTROLÜ", title: <>ODA<br />AÇIK.</>, lede: "Tek sinyal. Tek kamu kaydı. Gizli bağlantı yok.", actions: ["RESMÎ SİNYAL DİZİNİNİ AÇ", "KANIT PANOSUNU AÇ", "SAHA REHBERİNİ AÇ", "BASIN ODASINI AÇ", "DOSYAYI OKU"], status: "KAMU DURUMU // UTC", cards: [["YAYIN", "PLANLI // 13:30", "Oda açılır ve doğrulama sırası canlı okunur."], ["BAŞLANGIÇ", "PLANLI // 14:00", "Fiziksel imza ve kanıt sırası yalnızca açık rotada başlar."], ["ZİNCİR KAYDI", "BEKLET // KANIT BEKLİYOR", "Doğrudan kanıt olmadan mint, yetki, tahsis veya claim bilgisi yayımlanmaz."], ["KAMU ROTASI", "KANIT PANOSU // BEKLET", "Site yalnızca aynı kayıt herkes tarafından bağımsız doğrulanabildiğinde değişir."]] },
};

const moments = [["13:30 UTC", "OPEN THE ROOM", "Broadcast begins. Confirm the official site, Dossier, and the verification order together."], ["14:00 UTC", "GENESIS", "The public launch sequence begins. Watch the broadcast and use only routes shown on this site."], ["AFTER EVIDENCE", "PUBLISH THE RECORD", "Any mint, authority, allocation, or route is meaningful only once direct public evidence is linked."], ["AFTER UPDATE", "ENTER THE FIELD", "The activation surface changes only when the site itself shows it. Never trust a DM or copied link."]];

export default function LaunchPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => { if (window.location.hostname.includes("ileriakil")) setLanguage("tr"); }, []);
  const t = copy[language];
  return <main className="launch-page"><div className="launch-page-stars" aria-hidden="true" /><nav><a href="/">IA<span>///</span></a><a href="/dossier">{t.dossier} ↗</a></nav>
    <section className="launch-page-hero"><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.lede}</span><LaunchClock language={language} /><div className="launch-page-actions"><a href="/signal">{t.actions[0]} ↗</a><a href="/proof">{t.actions[1]} ↗</a><a href="/verify">{t.actions[2]} ↗</a><a href="/press">{t.actions[3]} ↗</a><a href="/dossier">{t.actions[4]} ↗</a></div></section>
    <section className="launch-status" aria-label={t.status}><p>{t.status}</p><div>{t.cards.map(([label, state, note], index) => <article key={label}><span>0{index + 1}</span><strong>{label}</strong><b>{state}</b><small>{note}</small></article>)}</div></section>
    <section className="launch-run"><p>RUN OF SHOW // UTC</p><div>{moments.map(([time,title,body],i)=><article key={time}><span>0{i+1}</span><time>{time}</time><h2>{title}</h2><p>{body}</p></article>)}</div></section>
    <section className="launch-evidence"><p>WHAT MAKES IT REAL</p><h2>Five proofs. One public record.</h2><div>{["Mint address on the site and broadcast screen.","Exact supply and token program.","Mint and freeze authority evidence.","Allocation wallets and time-lock records.","A matching record across every official surface."].map((item,index)=><article key={item}><span>0{index + 1}</span><p>{item}</p></article>)}</div></section>
    <section className="launch-operators"><p>THE OPERATOR GATE</p><h2>ONE DEVICE. ONE VERIFIER. ONE PUBLIC RECORD.</h2><div><article><span>01 // SIGNER</span><h3>CONFIRM<br />PHYSICALLY.</h3><p>The signing device shows the details. The signer reviews what is on-device and confirms only the intended action.</p></article><article><span>02 // VERIFIER</span><h3>CHECK<br />INDEPENDENTLY.</h3><p>The verifier matches the public address, supply, program, and authority state against the evidence record.</p></article><article><span>03 // PUBLISHER</span><h3>MAKE THE<br />RECORD REAL.</h3><p>The public site changes only after the evidence is ready to be checked by anyone else.</p></article></div><a href="/dossier/read/mint-manifest">READ THE MINT MANIFEST ↗</a></section>
    <section className="launch-rule"><p>THE ONLY RULE</p><h2>If it is not published here, in the Dossier, and on the broadcast screen, it is not official.</h2><a href="/?activate=1">OPEN ACTIVATION TERMINAL →</a></section><footer>INTERNAL AGENCY // STAR ASCENT // BUILD IN PUBLIC</footer>
  </main>;
}

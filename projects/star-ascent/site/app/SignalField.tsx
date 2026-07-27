"use client";

import { useState } from "react";

type Language = "en" | "tr";

export function SignalField({ language, onOpenTerminal }: { language: Language; onOpenTerminal: () => void }) {
  const [armed, setArmed] = useState(false);
  const copy = language === "en" ? { eyebrow: "LIVE INTERFACE // NO WALLET REQUIRED", title: "STEER THE SIGNAL.", body: "Move through the field. The constellation answers. This is a visual transmission only—no wallet, account, or data connection occurs here.", idle: "FIELD STANDBY", active: "FIELD AWAKENED", action: "OPEN ACTIVATION TERMINAL", note: "INTERACTION IS LOCAL TO THIS SCREEN" } : { eyebrow: "CANLI ARAYÜZ // CÜZDAN GEREKMEZ", title: "SİNYALİ YÖNLENDİR.", body: "Alan içinde hareket et. Takımyıldız yanıt verir. Bu yalnızca görsel bir iletimdir; burada cüzdan, hesap veya veri bağlantısı kurulmaz.", idle: "ALAN BEKLEMEDE", active: "ALAN UYANDI", action: "AKTİVASYON TERMİNALİNİ AÇ", note: "ETKİLEŞİM BU EKRANDA YERELDİR" };
  return <section className={`signal-field${armed ? " signal-field--armed" : ""}`} aria-labelledby="signal-field-title" onPointerMove={(event) => { const b = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--signal-x", `${((event.clientX - b.left) / b.width) * 100}%`); event.currentTarget.style.setProperty("--signal-y", `${((event.clientY - b.top) / b.height) * 100}%`); }}>
    <div className="signal-field-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /><b /></div>
    <div className="signal-field-copy"><p>{copy.eyebrow}</p><h2 id="signal-field-title">{copy.title}</h2><span>{copy.body}</span><div className="signal-field-actions"><button type="button" className="signal-field-arm" aria-pressed={armed} onClick={() => setArmed((value) => !value)}>{armed ? copy.active : copy.idle}</button><button type="button" className="signal-field-open" onClick={onOpenTerminal}>{copy.action} <b>→</b></button></div><small>{copy.note}</small></div>
  </section>;
}

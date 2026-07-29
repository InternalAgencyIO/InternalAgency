"use client";

import { useEffect, useRef, useState } from "react";

type Language = "en" | "tr";

export function ActivationTerminal({ language, onClose }: { language: Language; onClose: () => void }) {
  const [tab, setTab] = useState<"activate" | "claim" | "broadcast">("activate");
  const [callsign, setCallsign] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const tr = language === "tr";
  useEffect(() => {
    const dialog = dialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => dialog?.querySelector<HTMLElement>("button")?.focus());
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = priorOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);
  const copy = tr ? {
    label: "GENESIS // AKTİVASYON TERMİNALİ", title: "SİNYALİNİ HAZIRLA.", tabs: ["AKTİVASYON", "CLAIM DURUMU", "YAYIN"], close: "KAPAT", callsign: "OPERATÖR ÇAĞRI ADI", placeholder: "TERCİHE BAĞLI // HENÜZ KAYDEDİLMEZ", acknowledgement: "Resmî mint ve claim yolu yayımlanana kadar hiçbir cüzdan veya işlem isteminin geçerli olmadığını anlıyorum.", ready: "GENESIS İÇİN HAZIR", notReady: "SİNYAL BEKLENİYOR", activateText: "Bu terminal bir hazırlık alanıdır. Şu an cüzdan bağlamaz, veri toplamaz, imza istemez ve hiçbir işlemi başlatmaz.", activateBullets: ["Resmî yayın kanallarını izle", "Mint adresini üç kez doğrula", "Yalnızca okunabilir, insan-dili bir mesajı incele"], claimText: "Claim penceresi genesis sırasında yalnızca doğrulanmış kanallarda duyurulacaktır.", claimStatus: "CLAIM ROUTE // HENÜZ YAYINLANMADI", broadcastText: "AÇIK KAYNAK GENESIS TÖRENİ", broadcastTime: "30 TEM 2026 // 06:45:00 İSTANBUL", broadcastNote: "Pencere bu tam zamanda açılır. Hiçbir işlem otomatik değildir; devnet provası ve tüm kanıt eşikleri geçmeden mainnet kilidi açılmaz.", return: "ANA SİNYALE DÖN", proof: "KANIT PANOSUNU AÇ", launch: "YAYIN KONTROLÜNÜ AÇ"
  } : {
    label: "GENESIS // ACTIVATION TERMINAL", title: "PREPARE YOUR SIGNAL.", tabs: ["ACTIVATION", "CLAIM STATUS", "BROADCAST"], close: "CLOSE", callsign: "OPERATOR CALLSIGN", placeholder: "OPTIONAL // NOT SAVED YET", acknowledgement: "I understand that no wallet or transaction request is valid until the official mint and claim route are published.", ready: "GENESIS READY", notReady: "SIGNAL PENDING", activateText: "This terminal is a preparation space. It does not connect a wallet, collect data, request a signature, or initiate a transaction.", activateBullets: ["Watch verified project channels", "Verify the mint address three times", "Review only a human-readable message"], claimText: "The claim window will be announced during genesis only through verified channels.", claimStatus: "CLAIM ROUTE // NOT PUBLISHED", broadcastText: "OPEN-SOURCE GENESIS CEREMONY", broadcastTime: "30 JUL 2026 // 03:45:00 UTC", broadcastNote: "The window opens at this exact time. No transaction is automatic; mainnet stays locked until the devnet rehearsal and every evidence gate pass.", return: "RETURN TO MAIN SIGNAL", proof: "OPEN PROOF BOARD", launch: "OPEN LAUNCH CONTROL"
  };
  return <div className="activation-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} className="activation-terminal" role="dialog" aria-modal="true" aria-labelledby="activation-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>{copy.label}</p><h2 id="activation-title">{copy.title}</h2></div><button onClick={onClose} aria-label={copy.close}>×</button></header>
      <div className="activation-tabs" role="tablist">{(["activate", "claim", "broadcast"] as const).map((key, index) => <button role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key)}>{copy.tabs[index]}</button>)}</div>
      <div className="activation-panel">
        {tab === "activate" && <><p className="activation-lede">{copy.activateText}</p><label>{copy.callsign}<input value={callsign} onChange={(event) => setCallsign(event.target.value.toUpperCase().slice(0, 28))} placeholder={copy.placeholder} /></label><div className="activation-check"><input id="activation-check" type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><label htmlFor="activation-check">{copy.acknowledgement}</label></div><ol>{copy.activateBullets.map((item, index) => <li key={item}><span>0{index + 1}</span>{item}</li>)}</ol><strong className={acknowledged ? "ready" : "pending"}>{acknowledged ? copy.ready : copy.notReady}</strong></>}
        {tab === "claim" && <><p className="activation-lede">{copy.claimText}</p><div className="claim-slate"><span>{copy.claimStatus}</span><b>— — — —</b><small>NO MINT · NO TRANSACTION · NO TRANSFER</small></div><a href="/proof">{copy.proof} →</a></>}
        {tab === "broadcast" && <><p className="activation-kicker">{copy.broadcastText}</p><h3>{copy.broadcastTime}</h3><p className="activation-lede">{copy.broadcastNote}</p><a href="/launch">{copy.launch} →</a><a href="/dossier">{copy.return} →</a></>}
      </div>
      <footer><span>◉ VERIFIED-SURFACE ONLY</span><span>SCORPION // 01</span></footer>
    </section>
  </div>;
}

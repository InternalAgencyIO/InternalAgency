"use client";

import { useEffect, useState } from "react";
import "./launch-sequence.css";

const copy = { lines: ["STARSHIP CONTROL // PREFLIGHT CHECK.", "MAIN AI // PREFLIGHT CHECK.", "COMMANDER RADIANCE // GROUND CONTROL CHECK.", "OUTER COMMS // SECURE RENDER CHECK.", "DEPLOYMENT TOOLS // LOCAL SIMULATION CHECK.", "PREFLIGHT SEQUENCE // STANDBY."], label: "INTERNAL AGENCY // OUTER COMMS", status: "SIMULATION // MAINNET HOLD // NO CEREMONY TIME ACTIVE", title: <>PREFLIGHT<br />STANDBY.</>, enter: "ENTER STAR ASCENT", launch: "OPEN LAUNCH CONTROL" };

export function LaunchSequence() {
  const t = copy;
  const [visible, setVisible] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { setVisible(t.lines.length); return; }
    const id = window.setInterval(() => setVisible((value) => Math.min(t.lines.length, value + 1)), 420);
    return () => window.clearInterval(id);
  }, [t.lines.length]);
  if (dismissed) return null;
  return <section className="launch-sequence" aria-labelledby="launch-sequence-title"><div className="launch-fire" aria-hidden="true" /><div className="launch-sequence-copy"><p>{t.label}</p><strong className="launch-sequence-hold" role="status">{t.status}</strong><div className="launch-lines" aria-live="off">{t.lines.slice(0, visible).map((line) => <span key={line}>{line}</span>)}</div><p className="launch-sequence-title" id="launch-sequence-title">{t.title}</p><div className="launch-sequence-actions"><button type="button" onClick={() => { setDismissed(true); document.querySelector("#main-content")?.scrollIntoView({ behavior: "smooth" }); }}>{t.enter} <b>↓</b></button>{visible === t.lines.length && <a href="/launch">{t.launch} ↗</a>}</div></div></section>;
}

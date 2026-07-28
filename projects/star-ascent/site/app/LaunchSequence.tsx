"use client";

import { useEffect, useState } from "react";
import "./launch-sequence.css";

const lines = ["STARSHIP CONTROL. GO.", "MAIN AI. GO.", "COMMANDER RADIANCE // GRD CTRL. GO.", "LIVE OUTER COMMS // SECURE RENDER CONTROL ROOM. GO.", "ENCRYPTED DEPLOYMENT TOOLS // ROOT SECTOR. GO.", "LAUNCH SEQUENCE. GO."];

export function LaunchSequence() {
  const [visible, setVisible] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { setVisible(lines.length); return; }
    const id = window.setInterval(() => setVisible((value) => Math.min(lines.length, value + 1)), 420);
    return () => window.clearInterval(id);
  }, []);
  if (dismissed) return null;
  return <section className="launch-sequence" aria-label="STAR ASCENT launch sequence"><div className="launch-fire" aria-hidden="true" /><div className="launch-sequence-copy"><p>INTERNAL AGENCY // OUTER COMMS</p><div className="launch-lines" aria-live="off">{lines.slice(0, visible).map((line) => <span key={line}>{line}</span>)}</div><h2>MAIN COUNTDOWN<br />START.</h2><div className="launch-sequence-actions"><button type="button" onClick={() => { setDismissed(true); document.querySelector("#main-content")?.scrollIntoView({ behavior: "smooth" }); }}>ENTER STAR ASCENT <b>↓</b></button>{visible === lines.length && <a href="/launch">OPEN LAUNCH CONTROL ↗</a>}</div></div></section>;
}

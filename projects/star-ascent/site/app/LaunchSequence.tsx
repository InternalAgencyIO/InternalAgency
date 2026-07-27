"use client";

import { useEffect, useState } from "react";

const lines = ["STARSHIP CONTROL. GO.", "MAIN AI. GO.", "COMMANDER RADIANCE // GRD CTRL. GO.", "LIVE OUTER COMMS // SECURE RENDER CONTROL ROOM. GO.", "ENCRYPTED DEPLOYMENT TOOLS // ROOT SECTOR. GO.", "LAUNCH SEQUENCE. GO."];

export function LaunchSequence() {
  const [visible, setVisible] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { const id = window.setInterval(() => setVisible((value) => Math.min(lines.length, value + 1)), 420); return () => window.clearInterval(id); }, []);
  if (dismissed) return null;
  return <section className="launch-sequence" aria-label="STAR ASCENT launch sequence"><div className="launch-fire" aria-hidden="true" /><div className="launch-sequence-copy"><p>INTERNAL AGENCY // OUTER COMMS</p><div className="launch-lines">{lines.slice(0, visible).map((line) => <span key={line}>{line}</span>)}</div><h2>MAIN COUNTDOWN<br />START.</h2><button type="button" onClick={() => { setDismissed(true); document.querySelector("#main-content")?.scrollIntoView({ behavior: "smooth" }); }}>ENTER STAR ASCENT <b>↓</b></button></div></section>;
}

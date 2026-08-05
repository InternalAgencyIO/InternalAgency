"use client";

import { useState } from "react";
import { LaunchClock } from "./LaunchClock";
const links = [["WHITE DOSSIER", "/dossier/read/white-dossier"], ["THE WORLD", "/world"], ["TOKENOMICS", "/dossier#tokenomics"], ["MINT MANIFEST", "/dossier/read/mint-manifest"], ["GENESIS PROOF", "/dossier/read/genesis-proof"], ["BROADCAST PACK", "/dossier/read/broadcast-pack"], ["SOCIAL KIT", "/dossier/read/social-kit"], ["GENESIS RUN", "/dossier/read/genesis-run"]] as const;

export function DossierDock() {
  const [open, setOpen] = useState(false);
  return <aside className={`dossier-dock${open ? " dossier-dock--open" : ""}`} aria-label="Canonical launch documents">
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
    <button className="dossier-dock-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>DOSSIER + PROOF<span>{open ? "−" : "+"}</span></button>
    <div className="dossier-dock-content"><p>CANONICAL DOSSIER</p><LaunchClock /><a className="dossier-open" href="/dossier">READ THE VISUAL DOSSIER →</a><div>{links.map(([label, href]) => <a href={href} key={href}>{label}<span>EN</span></a>)}</div></div>
  </aside>;
}

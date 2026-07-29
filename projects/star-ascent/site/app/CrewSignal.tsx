"use client";

import { useEffect, useState } from "react";

export function CrewSignal() {
  const [tr, setTr] = useState(false);
  useEffect(() => setTr(window.location.hostname.includes("ileriakil")), []);
  return <a className="crew-signal" href="/dossier" aria-label={tr ? "STAR ASCENT dosyasını aç" : "Open the STAR ASCENT Dossier"}>
    {/* eslint-disable-next-line @next/next/no-img-element -- shared static editorial artwork */}
    <img src="/images/scorpion-commander-portrait-v1.webp" width={1024} height={1536} alt="Adult STAR ASCENT stage commander and crew preparing a starship launch" />
    <span><b>{tr ? "AKREP" : "SCORPION"}</b><i>{tr ? "CANLI YAPI" : "LIVE BUILD"}</i></span>
  </a>;
}

"use client";

import { useEffect, useState } from "react";
import { sourceLanguageForClientPath } from "./i18n/config";

export function CrewSignal() {
  const [tr, setTr] = useState(false);
  useEffect(() => setTr(sourceLanguageForClientPath(window.location.pathname, window.location.hostname) === "tr"), []);
  const label = tr ? "STAR ASCENT dosyasını aç" : "Open the STAR ASCENT Dossier";
  return <aside className="crew-signal-landmark" aria-label={label}><a className="crew-signal" href="/dossier" aria-label={label}>
    {/* eslint-disable-next-line @next/next/no-img-element -- shared static editorial artwork */}
    <img src="/images/scorpion-commander-portrait-v1.webp" width={1024} height={1536} alt="Adult STAR ASCENT stage commander and crew preparing a starship launch" />
    <span><b>{tr ? "AKREP" : "SCORPION"}</b><i>{tr ? "CANLI YAPI" : "LIVE BUILD"}</i></span>
  </a></aside>;
}

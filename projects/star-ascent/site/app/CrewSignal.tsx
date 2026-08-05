"use client";

export function CrewSignal() {
  const label = "Open the STAR ASCENT Dossier";
  return <aside className="crew-signal-landmark" aria-label={label}><a className="crew-signal" href="/dossier" aria-label={label}>
    {/* eslint-disable-next-line @next/next/no-img-element -- shared static editorial artwork */}
    <img src="/images/scorpion-commander-portrait-v1.webp" width={1024} height={1536} alt="Adult STAR ASCENT stage commander and crew preparing a starship launch" />
    <span><b>SCORPION</b><i>PUBLIC BUILD</i></span>
  </a></aside>;
}

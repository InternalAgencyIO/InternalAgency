"use client";

const copy = {
  label: "INTERNAL AGENCY // OFFICIAL SIGNAL DIRECTORY", title: <>ONE SIGNAL.<br />NO SHADOW LINKS.</>, intro: "Every verified public route begins here. Read the record, enter the activation terminal, and follow only channels published from this directory.", site: "MAIN SIGNAL", dossier: "WHITE DOSSIER", terminal: "ACTIVATION TERMINAL", broadcast: "BROADCAST STATUS", status: "CHANNELS PENDING VERIFICATION", note: "New official social profiles will appear here only after they are created and verified. Until then, the site and Dossier are the only canonical public surfaces; no broadcast window is scheduled.", safety: "NO SEED PHRASE. NO PRIVATE KEY. NO PAYMENT. NO IMPERSONATORS.",
};

export default function SignalPage() {
  const t = copy;
  return <main className="signal-page"><div className="signal-page-noise" aria-hidden="true" />
    <nav className="signal-page-nav"><a href="/">IA<span>///</span></a></nav>
    <section className="signal-page-hero"><p>{t.label}</p><h1>{t.title}</h1><div className="signal-page-orbit" aria-hidden="true"><i /><i /><i /></div><p className="signal-page-intro">{t.intro}</p></section>
    <section className="signal-directory"><a href="/"><small>01 // ROOT</small><strong>{t.site}</strong><span>↗</span></a><a href="/dossier"><small>02 // RECORD</small><strong>{t.dossier}</strong><span>↗</span></a><a href="/#genesis-console-title"><small>03 // PREPARE</small><strong>{t.terminal}</strong><span>↗</span></a><a href="/launch"><small>04 // WITNESS</small><strong>{t.broadcast}</strong><span>↗</span></a></section>
    <section className="signal-social"><p>{t.status}</p><div><i>◉</i><i>○</i><i>◉</i><i>○</i><i>◉</i></div><strong>{t.note}</strong></section><footer>{t.safety}</footer>
  </main>;
}

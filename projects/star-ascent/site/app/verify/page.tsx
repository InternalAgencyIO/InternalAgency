"use client";

import "./verify.css";

const copy = {
  proof: "PROOF BOARD", eyebrow: "STAR ASCENT // FIELD GUIDE 01", title: <>VERIFY THE<br /><i>SIGNAL.</i></>, lede: "Four checks. One public route. No shortcuts.",
  checks: [["START AT THE SOURCE", "Open Launch Control from the official site. Do not begin from a reply, a direct message, or a copied wallet link."], ["MATCH THE RECORD", "When the Genesis record is published, match the mint address, token program, decimals, and fixed supply across the site and an independent explorer."], ["CHECK AUTHORITY", "Confirm the public authority evidence and the allocation or timelock evidence before treating a distribution statement as final."], ["TRUST ONLY A PUBLISHED ROUTE", "A claim route is not active. If one is ever published, verify it on the official site itself. A countdown, social post, or screenshot is not a route."]],
  order: "THE VERIFICATION ORDER", rule: "MAINNET HOLD → LAUNCH CONTROL → PROOF BOARD → INDEPENDENT RECORD", links: ["OPEN LAUNCH CONTROL", "OPEN PROOF BOARD", "OPEN WHITE DOSSIER"], footer: "STAR ASCENT // VERIFY WHAT YOU CAN SEE",
};

export default function VerifyPage() {
  const t = copy;
  return <main className="verify-page"><div className="verify-orbit" aria-hidden="true" /><nav><a href="/">IA<span>///</span></a><a href="/proof">{t.proof} ↗</a></nav>
    <header className="verify-hero">
      <div className="verify-hero-copy"><p>{t.eyebrow}</p><h1>{t.title}</h1><strong>{t.lede}</strong></div>
      <figure className="verify-portrait">
        {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
        <img src="/images/radiance-proof-signal-v1.png" width={1120} height={1400} fetchPriority="high" alt="Radiance, a fictional adult signal operator, demonstrating the public verification route" />
        <span className="verify-portrait-sweep" aria-hidden="true" />
        <figcaption><span>FIELD GUIDE // VISUAL LOCK</span><b>VERIFY BEFORE AMPLIFY</b></figcaption>
      </figure>
    </header>
    <section className="verify-steps" aria-label={t.eyebrow}>{t.checks.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><div><h2>{title}</h2><p>{body}</p></div><b>→</b></article>)}</section>
    <section className="verify-command"><p>{t.order}</p><h2>{t.rule}</h2><div><a href="/launch">{t.links[0]} ↗</a><a href="/proof">{t.links[1]} ↗</a><a href="/dossier">{t.links[2]} ↗</a></div></section><footer>{t.footer}</footer>
  </main>;
}

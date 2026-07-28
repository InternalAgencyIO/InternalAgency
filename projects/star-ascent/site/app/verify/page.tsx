import "./verify.css";

const checks = [
  ["01", "START AT THE SOURCE", "Open Launch Control from the official site. Do not begin from a reply, a direct message, or a copied wallet link."],
  ["02", "MATCH THE RECORD", "When the Genesis record is published, match the mint address, token program, decimals, and fixed supply across the site and an independent explorer."],
  ["03", "CHECK AUTHORITY", "Confirm the public authority evidence and the allocation or timelock evidence before treating a distribution statement as final."],
  ["04", "MOVE ONLY ON THE LIVE ROUTE", "A claim route, if one exists, will be shown on the official site itself. A countdown, a social post, or a screenshot is not a route."],
];

export default function VerifyPage() {
  return <main className="verify-page">
    <div className="verify-orbit" aria-hidden="true" />
    <nav><a href="/">IA<span>///</span></a><a href="/proof">PROOF BOARD ↗</a></nav>
    <header>
      <p>STAR ASCENT // FIELD GUIDE 01</p>
      <h1>VERIFY THE<br /><i>SIGNAL.</i></h1>
      <strong>Four checks. One public route. No shortcuts.</strong>
    </header>
    <section className="verify-steps" aria-label="Verification steps">
      {checks.map(([number, title, body]) => <article key={number}>
        <span>{number}</span><div><h2>{title}</h2><p>{body}</p></div><b>→</b>
      </article>)}
    </section>
    <section className="verify-command">
      <p>THE LIVE ORDER</p>
      <h2>LAUNCH CONTROL → PROOF BOARD → INDEPENDENT RECORD</h2>
      <div><a href="/launch">OPEN LAUNCH CONTROL ↗</a><a href="/proof">OPEN PROOF BOARD ↗</a><a href="/dossier">OPEN WHITE DOSSIER ↗</a></div>
    </section>
    <footer>STAR ASCENT // VERIFY WHAT YOU CAN SEE</footer>
  </main>;
}

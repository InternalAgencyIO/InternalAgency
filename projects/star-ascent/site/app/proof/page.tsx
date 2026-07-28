const fields = [
  ["Mint", "Not published", "The canonical mint address will appear here only after independent verification."],
  ["Token program", "Not published", "Program, decimals, and exact fixed supply will be recorded together."],
  ["Mint authority", "Not published", "Direct explorer evidence is required after the documented initial mint."],
  ["Freeze authority", "Not published", "Direct explorer evidence is required after the documented initial mint."],
  ["Allocations", "Not published", "Public allocation wallets, amounts, and time-lock evidence will be linked here."],
  ["Verification", "HOLD", "A UTC timestamp and independent verifier identity are required before status can change."]
];

export default function ProofPage() {
  return <main className="proof-page">
    <div className="proof-stars" aria-hidden="true" />
    <nav><a href="/">IA<span>///</span></a><a href="/launch">LAUNCH CONTROL ↗</a></nav>
    <section className="proof-hero"><p>STAR ASCENT // PUBLIC PROOF BOARD</p><h1>NO CLAIM<br />WITHOUT PROOF.</h1><p>This record changes only when public evidence can be checked directly. Until then, every field remains on hold.</p></section>
    <section className="proof-grid">{fields.map(([label,status,detail], index)=><article key={label}><span>0{index + 1}</span><div><p>{label}</p><strong>{status}</strong><small>{detail}</small></div></article>)}</section>
    <section className="proof-rule"><p>PUBLICATION ORDER</p><h2>Sign physically. Verify independently. Publish everywhere together.</h2><div><a href="/launch">RUN OF SHOW ↗</a><a href="/dossier/read/genesis-proof">GENESIS RECORD ↗</a><a href="/signal">OFFICIAL SIGNAL ↗</a></div></section>
    <section className="proof-rule"><p>FIELD GUIDE</p><h2>Know the public verification order before Genesis begins.</h2><div><a href="/verify">OPEN FIELD GUIDE ↗</a></div></section>
    <footer>STAR ASCENT // EVIDENCE BEFORE AMPLIFICATION</footer>
  </main>;
}

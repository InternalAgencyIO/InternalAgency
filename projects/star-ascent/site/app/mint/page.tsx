import "./mint.css";

const V2_MINT_ONLY_PATH_SUPERSEDED = true;

const rehearsalStages = [
  ["01", "BIND", "Bind the public program ID to the reviewed source."],
  ["02", "BUILD", "Produce and compare the pinned verifiable SBF binary."],
  ["03", "DEVNET", "Deploy unfunded, transfer authority, then run every positive and adversarial case."],
  ["04", "VERIFY", "FDF Guard compares source, program, destinations, authorities, and transaction evidence."],
] as const;

export default function MintPage() {
  return (
    <main className="mint-ceremony">
      <section className="mint-hero">
        <p>IAT V2 // FAIL-CLOSED</p>
        <h1>NO<br />MINT</h1>
        <div className="mint-hero-copy">
          <strong>SUPERSEDED // DO NOT SIGN</strong>
          <span>
            The old four-transaction builder cannot initialize or fund the IAT V2
            program. It has no wallet provider, signer, transaction builder, or
            broadcast path.
          </span>
        </div>
      </section>

      <section className="mint-local-lock" role="alert">
        <strong>MAINNET HOLD // HARDWARE SIGNING DISABLED</strong>
        <p>
          This route is permanently read-only. No countdown, announcement, browser
          state, or automated check can turn it into a signing surface.
        </p>
      </section>

      <section className="mint-rehearsal" aria-labelledby="rehearsal-ready-title">
        <div>
          <p>IAT V2 // REQUIRED REHEARSAL</p>
          <h2 id="rehearsal-ready-title">DEPLOY. TEST.<br />VERIFY.</h2>
          <span>30 JUL 2026 · 03:45:00 UTC / 06:45:00 ISTANBUL</span>
        </div>
        <ol>
          {rehearsalStages.map(([index, title, body]) => (
            <li key={index}>
              <span>{index}</span>
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mint-safety">
        <div>
          <p>READ-ONLY SURFACES</p>
          <h2>SEE THE SYSTEM.<br />SIGN NOTHING.</h2>
        </div>
        <div className="mint-safety-actions">
          <a href="/network">OPEN IAT NETWORK ↗</a>
          <a href="/tokenomics">READ TOKENOMICS ↗</a>
          <button disabled={V2_MINT_ONLY_PATH_SUPERSEDED}>
            SIGNING DISABLED
          </button>
        </div>
      </section>
    </main>
  );
}

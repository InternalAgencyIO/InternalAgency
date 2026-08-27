import { useState } from "react";
import { createTrezorPathSessionGate } from "./trezor-path-session.mjs";

export default function TrezorPathSessionGate({
  expectedAddress,
  localOperator,
  openSession,
  renderActionUi,
}) {
  const [gate] = useState(() => createTrezorPathSessionGate(expectedAddress));
  const [phase, setPhase] = useState("LOCKED");
  const [error, setError] = useState("");

  async function displayAndVerify() {
    if (!localOperator || phase === "VERIFYING" || phase === "VERIFIED") return;
    setPhase("VERIFYING");
    setError("");
    try {
      await gate.verify(openSession);
      gate.assertVerified();
      setPhase("VERIFIED");
    } catch (caught) {
      setPhase("LOCKED");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  if (phase === "VERIFIED") {
    const session = gate.assertVerified();
    return renderActionUi(session);
  }

  return (
    <main className="console-shell">
      <section className="workspace">
        <header className="hero">
          <div>
            <p>HARDWARE SESSION GATE // NO ACTION UI LOADED</p>
            <h1>VERIFY THE<br /><em>SIGNER.</em></h1>
          </div>
          <div className="hero-state">
            <span>SESSION</span>
            <strong>LOCKED</strong>
            <small>Verification is memory-only and clears on reload.</small>
          </div>
        </header>

        {!localOperator && (
          <div className="fatal" role="alert">
            <strong>PUBLIC HOST BLOCKED</strong>
            <span>This hardware gate only operates on localhost or 127.0.0.1.</span>
          </div>
        )}

        <section className="command">
          <div className="command-status">
            <small>EXPECTED SOLANA SIGNER</small>
            <strong>{expectedAddress}</strong>
            <p>
              The console will discover the matching path without display, then make one exact
              on-device re-fetch for that path. Match the address on the Model T before approving.
            </p>
            {error && <p role="alert">{error}</p>}
          </div>
          <div className="command-actions">
            <button
              className="connect"
              disabled={!localOperator || phase === "VERIFYING"}
              onClick={displayAndVerify}
            >
              {phase === "VERIFYING" ? "WAITING FOR MODEL T…" : "DISPLAY + VERIFY MODEL T ADDRESS"}
            </button>
          </div>
        </section>

        <section className="evidence">
          <div>
            <small>FAIL-CLOSED SESSION CONTROL</small>
            <strong>ACTION UI REMAINS UNRENDERED</strong>
            <p>No address result or approval is written to localStorage, sessionStorage, or disk.</p>
          </div>
          <strong>MAINNET HOLD</strong>
        </section>
      </section>
    </main>
  );
}

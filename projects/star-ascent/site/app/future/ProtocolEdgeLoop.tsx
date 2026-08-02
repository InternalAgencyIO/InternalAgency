export function ProtocolEdgeLoop() {
  return (
    <section className="edge-loop" aria-labelledby="edge-loop-title">
      <p>ECONOMIC LOOP // DESIGN INTENT</p>
      <h2 id="edge-loop-title">1% PROTOCOL EDGE<br />→ LIQUIDITY POOL<br />→ EXTENDED $IAT APY RUNWAY</h2>
      <div className="edge-loop-steps">
        <article>
          <span>01</span>
          <h3>COLLECT</h3>
          <p>Each settled position or game contributes the proposed fixed 1% protocol edge.</p>
        </article>
        <article>
          <span>02</span>
          <h3>RETURN</h3>
          <p>The edge is routed back to the isolated liquidity pool instead of becoming discretionary house revenue.</p>
        </article>
        <article>
          <span>03</span>
          <h3>EXTEND</h3>
          <p>Added liquidity is intended to extend the APY runway available to eligible $IAT holders.</p>
        </article>
      </div>
      <aside>
        This is an intended holder benefit, not a guaranteed fixed APY or return. Exact fee incidence, eligible-holder treatment, on-chain routing, pool accounting, solvency constraints, and independent review remain release gates.
      </aside>
    </section>
  );
}

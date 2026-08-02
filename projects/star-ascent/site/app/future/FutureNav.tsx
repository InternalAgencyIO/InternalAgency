export function FutureNav() {
  return (
    <nav className="future-nav" aria-label="Post-Genesis previews">
      <a className="future-mark" href="/" aria-label="Internal Agency home">IA<span aria-hidden="true">///</span></a>
      <div>
        <a href="/future">Future systems</a>
        <a href="/future/predictive-engine">IA-PET</a>
        <a href="/future/casino">Casino DLC</a>
      </div>
    </nav>
  );
}

export function InactiveStrip({ target }: { target: string }) {
  return (
    <div className="inactive-strip" role="note">
      <span>POST-GENESIS CONCEPT</span>
      <span>INACTIVE</span>
      <span>NO WAGER ROUTE</span>
      <strong>{target}</strong>
    </div>
  );
}

import type { Metadata } from "next";
import { FashionReveal } from "./FashionReveal";
import { FutureNav, InactiveStrip } from "./FutureNav";

export const metadata: Metadata = {
  title: "Future Systems — Internal Agency",
  description: "Inactive post-Genesis previews for the Predictive Engine Market and Casino DLC.",
  openGraph: {
    title: "Future Systems — Internal Agency",
    description: "Inactive post-Genesis previews. No wager route and no Genesis dependency.",
    images: ["/images/future/predictive-engine-hero-v1.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/future/predictive-engine-hero-v1.png"],
  },
};

export default function FutureSystemsPage() {
  return (
    <main className="future-page future-hub">
      <FutureNav />
      <InactiveStrip target="SEPARATE REVIEW REQUIRED" />
      <header className="future-hub-hero">
        <p>INTERNAL AGENCY // AFTER GENESIS</p>
        <h1>THE HOUSE<br />LIGHTS <i>CHANGE.</i></h1>
        <span>
          Two future systems are taking shape outside the Genesis launch boundary. Preview the design;
          do not treat this page as availability, approval, or an invitation to wager.
        </span>
      </header>
      <section className="future-portals" aria-label="Future feature previews">
        <a className="future-portal portal-pet" href="/future/predictive-engine">
          <span>01 // TARGET: NOT BEFORE T+31 DAYS</span>
          <div><p>INTERNAL AGENCY</p><h2>THE PREDICTIVE<br />ENGINE MARKET</h2></div>
          <strong>ENTER THE IA-PET PREVIEW →</strong>
        </a>
        <a className="future-portal portal-casino" href="/future/casino">
          <span>02 // TARGET: NOT BEFORE T+15 DAYS</span>
          <div><p>INTERNAL AGENCY</p><h2>THE CASINO<br />DLC</h2></div>
          <strong>ENTER THE CASINO PREVIEW →</strong>
        </a>
      </section>
      <FashionReveal />
      <section className="future-boundary">
        <p>BOUNDARY // 001</p>
        <h2>GENESIS DOES NOT DEPEND ON EITHER FEATURE.</h2>
        <div>
          <span>No wallet connection</span><span>No wager submission</span><span>No deposits</span>
          <span>No live odds</span><span>No automated activation</span><span>No mainnet change</span>
        </div>
      </section>
      <footer className="future-footer"><a href="/">← RETURN TO STAR ASCENT</a><span>CONCEPT ART / SPECIFICATION IN PROGRESS</span></footer>
    </main>
  );
}

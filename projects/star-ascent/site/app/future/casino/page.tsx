import type { Metadata } from "next";
import { EditorialScene } from "../EditorialScene";
import { FutureNav, InactiveStrip } from "../FutureNav";
import { ProtocolEdgeLoop } from "../ProtocolEdgeLoop";

export const metadata: Metadata = {
  title: "Casino DLC — Inactive Preview",
  description: "A post-Genesis concept preview. The Casino DLC is not active and has no wager route.",
  openGraph: {
    title: "Casino DLC — Inactive Preview",
    description: "A post-Genesis concept preview. The Casino DLC is inactive and has no wager route.",
    images: ["/images/future/casino-hero-v1.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/future/casino-hero-v1.png"],
  },
};

const proofLayers = [
  ["COMMIT", "Publish the game commitment before a result can be known."],
  ["REVEAL", "Expose the inputs needed to reproduce the result after settlement."],
  ["VERIFY", "Let any player replay the calculation without trusting the interface."],
  ["ACCOUNT", "Route the fixed 1% protocol edge to the isolated liquidity pool with public totals, extending the APY runway available to eligible $IAT holders."],
];

export default function CasinoPage() {
  return (
    <main className="future-page feature-page feature-casino">
      <FutureNav />
      <InactiveStrip target="TARGET: 15 DAYS AFTER $IAT GENESIS" />
      <header className="feature-hero">
        <div className="feature-hero-copy">
          <p>CASINO DLC // EVERY RESULT REPLAYABLE</p>
          <h1>PLAY.<br /><i>VERIFY.</i></h1>
          <span>A high-energy game layer whose fairness must survive independent reproduction—not just a glowing interface.</span>
          <a href="#proof-layers">SEE THE PROOF MODEL ↓</a>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial master is a local static asset */}
        <img src="/images/future/casino-hero-v1.png" alt="Radiance, Ellie, and Alia in a playful inactive Casino DLC concept scene" />
      </header>
      <section className="feature-statline" aria-label="Casino DLC proposal summary">
        <div><span>TARGET WINDOW</span><strong>15 DAYS AFTER $IAT GENESIS</strong></div>
        <div><span>ASSETS PROPOSED</span><strong>IAT + SOL</strong></div>
        <div><span>PROTOCOL EDGE</span><strong>1% → LIQUIDITY</strong></div>
        <div><span>STATUS</span><strong>INACTIVE</strong></div>
      </section>
      <section className="media-teaser" aria-labelledby="casino-teaser-title">
        <div><p>15-SECOND FIELD TRANSMISSION</p><h2 id="casino-teaser-title">THE TRIO ENTERS<br />THE PROOF ROOM.</h2><span>Original 4K motion teaser. Playful pillow-fight energy, character-labelled voiceover, and an always-visible inactive-status burn-in.</span></div>
        <video controls playsInline preload="metadata" poster="/images/future/casino-hero-v1.png">
          <source src="/media/future/casino-dlc-teaser-15s-4k-v1.mp4" type="video/mp4" />
          Your browser does not support the video element.
        </video>
      </section>
      <section className="mechanics" id="proof-layers">
        <p>PROOF MODEL // SUBJECT TO AUDIT</p>
        <h2>TRUST THE RECEIPT.<br />NOT THE HOUSE.</h2>
        <div>{proofLayers.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className="fairness-note">
        <p>RELEASE BOUNDARY // INACTIVE</p>
        <h2>NO GAME SHIPS ON A PROMISE OF FAIRNESS.</h2>
        <span>Each game requires exact integer accounting, public randomness commitments, deterministic replay vectors, bankroll solvency limits, failure rollback, abuse controls, and an independent final-code audit.</span>
      </section>
      <ProtocolEdgeLoop />
      <EditorialScene
        eyebrow="FIELD EDITORIAL // EVEREST TABLE"
        title="THE HOUSE REACHES THE SUMMIT."
        body="A cheerful poker-table concept above the clouds: one latex-finish cocktail dress, one lace-overlay cocktail dress, and one opaque corset-seamed cocktail dress in rainbow color."
        image="/images/future/casino-everest-poker-v2.png"
        imageAlt="Three adult women in rainbow cocktail dresses cheerfully playing poker at a table on the summit of Mount Everest"
        video="/media/future/casino-everest-teaser-15s-4k-v2.mp4"
        caption="ORIGINAL EDITORIAL · ADULT FICTIONAL CHARACTERS · CONCEPT ONLY"
      />
      <section className="feature-next"><a href="/future/predictive-engine"><span>OTHER PREVIEW</span>PREDICTIVE ENGINE →</a></section>
      <footer className="future-footer"><a href="/future">← ALL FUTURE SYSTEMS</a><span>NO WALLET · NO WAGER · NO ACTIVATION</span></footer>
    </main>
  );
}

import type { Metadata } from "next";
import { EditorialScene } from "../EditorialScene";
import { FutureNav, InactiveStrip } from "../FutureNav";

export const metadata: Metadata = {
  title: "Predictive Engine Market — Inactive Preview",
  description: "A post-Genesis concept preview. IA-PET is not active and has no wager route.",
  openGraph: {
    title: "Predictive Engine Market — Inactive Preview",
    description: "A post-Genesis concept preview. IA-PET is inactive and has no wager route.",
    images: ["/images/future/predictive-engine-hero-v1.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/future/predictive-engine-hero-v1.png"],
  },
};

const mechanics = [
  ["CREATE", "Users may propose prediction markets. Objective resolution rules, a named source, review, and dispute handling remain mandatory design gates."],
  ["CANCEL", "A proposal with zero matched volume may be cancelled without penalty. Matched positions cannot be erased by a creator."],
  ["HOLD", "The design target keeps eligible IAT positions in normal APY and CCC accounting while they remain locked. SOL positions do not earn IAT APY."],
  ["RECYCLE", "The proposed 1% protocol edge returns to an isolated liquidity runway. Exact fee incidence remains under economic review."],
];

export default function PredictiveEnginePage() {
  return (
    <main className="future-page feature-page feature-pet">
      <FutureNav />
      <InactiveStrip target="TARGET: 30 DAYS AFTER $IAT GENESIS" />
      <header className="feature-hero">
        <div className="feature-hero-copy">
          <p>IA-PET // PREDICTIVE ENGINE MARKET</p>
          <h1>MAKE A<br /><i>MARKET.</i></h1>
          <span>Prediction infrastructure designed for public verification, transparent resolution, and capital that does not silently leave the holder system.</span>
          <a href="#mechanics">READ THE CONCEPT ↓</a>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial master is a local static asset */}
        <img src="/images/future/predictive-engine-hero-v1.png" alt="Radiance, Ellie, and Alia presenting an inactive futuristic prediction-market concept" />
      </header>
      <section className="feature-statline" aria-label="Predictive Engine proposal summary">
        <div><span>TARGET WINDOW</span><strong>30 DAYS AFTER $IAT GENESIS</strong></div>
        <div><span>ASSETS PROPOSED</span><strong>IAT + SOL</strong></div>
        <div><span>PROTOCOL EDGE</span><strong>1%</strong></div>
        <div><span>STATUS</span><strong>INACTIVE</strong></div>
      </section>
      <section className="media-teaser" aria-labelledby="pet-teaser-title">
        <div><p>15-SECOND FIELD TRANSMISSION</p><h2 id="pet-teaser-title">RADIANCE, ELLIE &amp; ALIA<br />OPEN THE POSSIBILITY ROOM.</h2><span>Original 4K motion teaser. Character-labelled voiceover, generated editorial art, and an always-visible inactive-status burn-in.</span></div>
        <video controls playsInline preload="metadata" poster="/images/future/predictive-engine-hero-v1.png">
          <source src="/media/future/predictive-engine-teaser-15s-4k-v1.mp4" type="video/mp4" />
          Your browser does not support the video element.
        </video>
      </section>
      <section className="mechanics" id="mechanics">
        <p>DESIGN SYSTEM // SUBJECT TO AUDIT</p>
        <h2>FOUR RULES.<br />NO HIDDEN DOOR.</h2>
        <div>{mechanics.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className="fairness-note">
        <p>FAIRNESS CLAIM // NOT YET PROVEN</p>
        <h2>“PROVABLY FAIR” MUST BE A REPRODUCIBLE PROPERTY, NOT A TAGLINE.</h2>
        <span>The release gate requires public settlement rules, canonical resolution sources, replayable receipts, dispute handling, economic tests, and independent review. Until then this is a design target.</span>
      </section>
      <EditorialScene
        eyebrow="FIELD EDITORIAL // FLIGHT DECK RUNWAY"
        title="THE MARKET TAKES THE DECK."
        body="Radiance, Ellie, and Alia preview the concept from an aircraft-carrier fashion runway while flight operations continue safely behind them. Rainbow cocktail couture; still inactive."
        image="/images/future/predictive-engine-carrier-runway-v2.png"
        imageAlt="Three adult women in rainbow cocktail couture walking a fashion runway on an aircraft carrier with fighter jets operating in the background"
        video="/media/future/predictive-engine-carrier-teaser-15s-4k-v2.mp4"
        caption="ORIGINAL EDITORIAL · ADULT FICTIONAL CHARACTERS · CONCEPT ONLY"
      />
      <section className="feature-next"><a href="/future/casino"><span>NEXT PREVIEW</span>CASINO DLC →</a></section>
      <footer className="future-footer"><a href="/future">← ALL FUTURE SYSTEMS</a><span>NO WALLET · NO WAGER · NO ACTIVATION</span></footer>
    </main>
  );
}

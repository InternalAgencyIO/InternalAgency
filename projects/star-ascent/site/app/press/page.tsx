import { PressCopyDeck } from "./PressCopyDeck";
import "./press-copy.css";

export default function PressPage() {
  return <main className="press-page">
    <nav><a href="/">IA<span>///</span></a><a href="/signal">OFFICIAL SIGNAL ↗</a></nav>
    <section className="press-hero"><p>INTERNAL AGENCY // PRESS ROOM // MAINNET HOLD</p><h1>STAR ASCENT<br />PLANNING IS PUBLIC.</h1><span>Public culture. A living archive. No launch window or claim route is scheduled.</span></section>
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/launch-core-radiance-v1.png" width={1935} height={813} fetchPriority="high" decoding="async" alt="Commander Radiance in launch control beside an ascending starship" />
      <figcaption>OFFICIAL LAUNCH ART // CREDIT: INTERNAL AGENCY</figcaption>
    </figure>
    <section className="press-copy"><article><p>THE SHORT VERSION</p><h2>STAR ASCENT is the first public chapter of Internal Agency: a public build where culture, design, technology, and evidence move together.</h2></article><article><p>CURRENT PUBLIC LINE</p><h2>“The record is public. Mainnet remains on HOLD. Follow only the official signal.”</h2></article></section>
    <PressCopyDeck />
    <section className="press-links"><p>OFFICIAL MATERIAL</p><div><a href="/launch">LAUNCH CONTROL ↗</a><a href="/dossier">WHITE DOSSIER ↗</a><a href="/proof">PROOF BOARD ↗</a><a href="/world">THE WORLD ↗</a></div></section>
    <footer>FOR PUBLIC USE: LINK TO THE OFFICIAL SITE. DO NOT REPOST UNVERIFIED ADDRESSES.</footer>
  </main>;
}

import { PressCopyDeck } from "./PressCopyDeck";
import "./press-copy.css";

export default function PressPage() {
  return <main className="press-page">
    <nav><a href="/">IA<span>///</span></a><a href="/signal">OFFICIAL SIGNAL ↗</a></nav>
    <section className="press-hero"><p>INTERNAL AGENCY // PRESS ROOM</p><h1>STAR ASCENT<br />IS IN MOTION.</h1><span>Public culture. A living archive. A launch built in the open.</span></section>
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/launch-core-radiance-v1.png" width={1935} height={813} fetchPriority="high" decoding="async" alt="Commander Radiance in launch control beside an ascending starship" />
      <figcaption>OFFICIAL LAUNCH ART // CREDIT: INTERNAL AGENCY</figcaption>
    </figure>
    <section className="press-copy"><article><p>THE SHORT VERSION</p><h2>STAR ASCENT is the first public chapter of Internal Agency: a live world where culture, design, technology, and public proof move together.</h2></article><article><p>THE LINE TO USE</p><h2>“The room is open. The record is public. Follow the signal.”</h2></article></section>
    <PressCopyDeck />
    <section className="press-links"><p>OFFICIAL MATERIAL</p><div><a href="/launch">LAUNCH CONTROL ↗</a><a href="/dossier">WHITE DOSSIER ↗</a><a href="/proof">PROOF BOARD ↗</a><a href="/world">THE WORLD ↗</a></div></section>
    <footer>FOR PUBLIC USE: LINK TO THE OFFICIAL SITE. DO NOT REPOST UNVERIFIED ADDRESSES.</footer>
  </main>;
}

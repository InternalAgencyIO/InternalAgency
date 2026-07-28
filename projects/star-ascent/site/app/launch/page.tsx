"use client";

import { LaunchClock } from "../LaunchClock";
import "./launch.css";

const moments = [
  ["13:30 UTC", "OPEN THE ROOM", "Broadcast begins. Confirm the official site, Dossier, and the verification order together."],
  ["14:00 UTC", "GENESIS", "The public launch sequence begins. Watch the broadcast and use only routes shown on this site."],
  ["AFTER EVIDENCE", "PUBLISH THE RECORD", "Any mint, authority, allocation, or route is meaningful only once direct public evidence is linked."],
  ["AFTER UPDATE", "ENTER THE FIELD", "The activation surface changes only when the site itself shows it. Never trust a DM or copied link."]
];

export default function LaunchPage() {
  return <main className="launch-page">
    <div className="launch-page-stars" aria-hidden="true" />
    <nav><a href="/">IA<span>///</span></a><a href="/dossier">WHITE DOSSIER ↗</a></nav>
    <section className="launch-page-hero">
      <p>STAR ASCENT // GENESIS CONTROL</p>
      <h1>THE ROOM<br />IS OPEN.</h1>
      <span>One signal. One public record. No shadow links.</span>
      <LaunchClock language="en" />
      <div className="launch-page-actions"><a href="/signal">OPEN OFFICIAL SIGNAL DIRECTORY ↗</a><a href="/proof">OPEN PROOF BOARD ↗</a><a href="/verify">OPEN FIELD GUIDE ↗</a><a href="/press">OPEN PRESS ROOM ↗</a><a href="/dossier">READ THE DOSSIER ↗</a></div>
    </section>
    <section className="launch-run"><p>RUN OF SHOW // UTC</p><div>{moments.map(([time,title,body],i)=><article key={time}><span>0{i+1}</span><time>{time}</time><h2>{title}</h2><p>{body}</p></article>)}</div></section>
    <section className="launch-evidence"><p>WHAT MAKES IT REAL</p><h2>Five proofs. One public record.</h2><div>{["Mint address on the site and broadcast screen.","Exact supply and token program.","Mint and freeze authority evidence.","Allocation wallets and time-lock records.","A matching record across every official surface."].map((item,index)=><article key={item}><span>0{index + 1}</span><p>{item}</p></article>)}</div></section>
    <section className="launch-operators"><p>THE OPERATOR GATE</p><h2>ONE DEVICE. ONE VERIFIER. ONE PUBLIC RECORD.</h2><div><article><span>01 // SIGNER</span><h3>CONFIRM<br />PHYSICALLY.</h3><p>The signing device shows the details. The signer reviews what is on-device and confirms only the intended action.</p></article><article><span>02 // VERIFIER</span><h3>CHECK<br />INDEPENDENTLY.</h3><p>The verifier matches the public address, supply, program, and authority state against the evidence record.</p></article><article><span>03 // PUBLISHER</span><h3>MAKE THE<br />RECORD REAL.</h3><p>The public site changes only after the evidence is ready to be checked by anyone else.</p></article></div><a href="/dossier/read/mint-manifest">READ THE MINT MANIFEST ↗</a></section>
    <section className="launch-rule"><p>THE ONLY RULE</p><h2>If it is not published here, in the Dossier, and on the broadcast screen, it is not official.</h2><a href="/?activate=1">OPEN ACTIVATION TERMINAL →</a></section>
    <footer>INTERNAL AGENCY // STAR ASCENT // BUILD IN PUBLIC</footer>
  </main>;
}

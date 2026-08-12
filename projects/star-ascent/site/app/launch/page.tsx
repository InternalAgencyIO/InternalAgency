"use client";

import { Fragment } from "react";
import { LaunchClock } from "../LaunchClock";
import "./launch.css";

const copy = {
  en: {
    dossier: "WHITE DOSSIER", eyebrow: "STAR ASCENT // GENESIS CONTROL", title: <>THE ROOM<br />IS OPEN.</>, lede: "One signal. One public record. No shadow links.", actions: ["OPEN IAT NETWORK", "OPEN OFFICIAL SIGNAL DIRECTORY", "OPEN PROOF BOARD", "OPEN FIELD GUIDE", "OPEN PRESS ROOM", "READ THE DOSSIER", "REVIEW OPEN-SOURCE CODE"], status: "PUBLIC STATUS // UTC",
    cards: [["BROADCAST", "UNSCHEDULED // HOLD", "No replacement UTC ceremony window is published."], ["GENESIS", "UNSCHEDULED // EVIDENCE HOLD", "Execution still requires funding, regenerated packets, physical Model T confirmation, and passing evidence gates."], ["CHAIN RECORD", "HOLD // AWAITING EVIDENCE", "No mint, authority, allocation, or claim fact is published before direct proof."], ["SOURCE", "B3 PUBLIC // REVIEWABLE", "Review the B3 law adapter, retained V2 features, configuration interlock, and validation scripts before any signing begins."]],
    runTitle: "EVIDENCE ORDER", moments: [["AFTER FUNDING", "PUBLISH ONE UTC WINDOW", "Publish a replacement time only after the exact funding floor is confirmed by a fresh read-only observation."], ["DEVNET FIRST", "B3 LAW + RETAINED V2 FEATURE REHEARSAL", "Exercise the IAT-wide law and every retained feature, then regenerate every bound release artifact; invalidate all stale approvals."], ["AFTER ALL GATES", "MAINNET DECISION", "Proceed only if the independent verifier confirms metadata, destinations, locks, digests, program authority, and the complete rehearsal."], ["AFTER EVIDENCE", "PUBLISH THE RECORD", "Any mint, authority, allocation, or route is meaningful only once direct public evidence is linked."]],
    real: "WHAT MAKES IT REAL", realTitle: "Five proofs. One public record.", proofs: ["Mint address on the site and broadcast screen.", "Exact supply and token program.", "Mint and freeze authority evidence.", "Allocation wallets and time-lock records.", "A matching record across every official surface."], gate: "THE OPERATOR GATE", gateTitle: "ONE DEVICE. ONE VERIFIER. ONE PUBLIC RECORD.", operators: [["01 // SIGNER", "CONFIRM\nPHYSICALLY.", "The signing device shows the details. The signer reviews what is on-device and confirms only the intended action."], ["02 // VERIFIER", "CHECK\nINDEPENDENTLY.", "The verifier matches the public address, supply, program, and authority state against the evidence record."], ["03 // PUBLISHER", "MAKE THE\nRECORD REAL.", "The public site changes only after the evidence is ready to be checked by anyone else."]], manifest: "READ THE MINT MANIFEST", rule: "THE ONLY RULE", ruleText: "If it is not published here, in the Dossier, and on the broadcast screen, it is not official.", terminal: "OPEN ACTIVATION TERMINAL", footer: "INTERNAL AGENCY // STAR ASCENT // BUILD IN PUBLIC",
  },
};

export default function LaunchPage() {
  const t = copy.en;
  return <main className="launch-page"><div className="launch-page-stars" aria-hidden="true" /><nav><a href="/">IA<span>///</span></a><a href="/dossier">{t.dossier} ↗</a></nav>
    <section className="launch-page-hero"><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.lede}</span><LaunchClock /><div className="launch-page-actions"><a href="/network">{t.actions[0]} ↗</a><a href="/signal">{t.actions[1]} ↗</a><a href="/proof">{t.actions[2]} ↗</a><a href="/verify">{t.actions[3]} ↗</a><a href="/press">{t.actions[4]} ↗</a><a href="/dossier">{t.actions[5]} ↗</a><a href="https://github.com/InternalAgencyIO/InternalAgency/tree/agent/iat-b3-architecture/projects/star-ascent/site" target="_blank" rel="noreferrer">{t.actions[6]} ↗</a></div></section>
    <section className="launch-status" aria-label={t.status}><p>{t.status}</p><div>{t.cards.map(([label, state, note], index) => <article key={label}><span>0{index + 1}</span><strong>{label}</strong><b>{state}</b><small>{note}</small></article>)}</div></section>
    <section className="launch-rewards-entry"><p>NODE REWARDS // GENESIS GIFT</p><h2>100 IAT.<br />THE FIRST 1,000.</h2><span>The public claim system remains on HOLD until verified Genesis evidence and node-binding gates are live.</span><a href="/rewards">OPEN NODE REWARDS ↗</a></section>
    <section className="launch-run"><p>{t.runTitle}</p><div>{t.moments.map(([time,title,body],i)=><article key={time}><span>0{i+1}</span><time>{time}</time><h2>{title}</h2><p>{body}</p></article>)}</div></section>
    <section className="launch-evidence"><p>{t.real}</p><h2>{t.realTitle}</h2><div>{t.proofs.map((item,index)=><article key={item}><span>0{index + 1}</span><p>{item}</p></article>)}</div></section>
    <section className="launch-operators"><p>{t.gate}</p><h2>{t.gateTitle}</h2><div>{t.operators.map(([role,title,body])=><article key={role}><span>{role}</span><h3>{title.split("\n").map((line,index)=><Fragment key={`${role}-${line}`}>{line}{index === 0 && <br />}</Fragment>)}</h3><p>{body}</p></article>)}</div><a href="/dossier/read/mint-manifest">{t.manifest} ↗</a></section>
    <section className="launch-rule"><p>{t.rule}</p><h2>{t.ruleText}</h2><a href="/?activate=1">{t.terminal} →</a></section><footer>{t.footer}</footer>
  </main>;
}

"use client";

const copy = {
  kicker: "INTERNAL AGENCY // WORLD ARCHIVE", title: <>THE SHIP<br />REMEMBERS.</>, intro: "STAR ASCENT is not a product universe. It is a live cultural machine: a ship held together by people who chose signal over noise.", stations: [["01", "THE BRIDGE", "The Stage Manager reads the room, the weather, the bandwidth. Nothing moves until the crew can see it."], ["02", "THE LIGHT DECK", "AI light operators turn pressure into color. Their job is not to persuade; it is to make the live system legible."], ["03", "THE ARCHIVE", "Every transmission leaves a trace: drafts, corrections, decisions, receipts, held lines, and the reasons a gate stayed closed."], ["04", "THE FLOOR", "The Scorpion Generation does not wait for permission to make a world. It brings discernment, taste, and a refusal to fake certainty."]], oath: "We build in public because the evidence is part of the art.", footer: "RETURN TO DOSSIER →"
};

export default function WorldPage() {
  const t = copy;
  return <main className="world-page"><div className="world-stars" aria-hidden="true" /><nav className="world-nav"><a href="/">IA<span>///</span></a><div><a href="/dossier">DOSSIER</a></div></nav><section className="world-hero"><p>{t.kicker}</p><h1>{t.title}</h1><p>{t.intro}</p></section><figure className="world-art">
    {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
    <img src="/images/radiance-roller-rave.webp" width={853} height={1844} loading="lazy" decoding="async" alt="Radiance, stage operator of the live signal" />
    <figcaption>RADIANCE // THE SIGNAL HAS A FACE</figcaption>
  </figure><section className="world-stations">{t.stations.map(([number, title, text]) => <article key={number}><span>{number}</span><h2>{title}</h2><p>{text}</p></article>)}</section><section className="world-oath"><p>SCORPION GENERATION</p><h2>{t.oath}</h2><a href="/dossier">{t.footer}</a></section></main>;
}

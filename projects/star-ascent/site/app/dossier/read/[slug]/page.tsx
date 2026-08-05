"use client";

import { useParams } from "next/navigation";

type Copy = { label: string; title: string; deck: string; state: string; blocks: [string, string][]; next: string };

const NEXT_RECORD_ROUTES: Record<string, string> = {
  "white-dossier": "/dossier/read/tokenomics",
  tokenomics: "/dossier/read/genesis-proof",
  "mint-manifest": "/dossier/read/genesis-run",
  "genesis-proof": "/dossier/read/mint-manifest",
  "broadcast-pack": "/dossier/read/social-kit",
  "social-kit": "/dossier/read/white-dossier",
  "genesis-run": "/dossier/read/genesis-proof",
  "authority-map": "/dossier/read/genesis-proof",
  "technical-spec": "/dossier/read/mint-manifest",
  readiness: "/dossier/read/genesis-run",
  "incident-response": "/dossier",
};

const EN: Record<string, Copy> = {
  "white-dossier": { label: "CANONICAL RECORD / 01", title: "WHITE DOSSIER", deck: "The public transmission of STAR ASCENT: a mythic system made legible before Genesis.", state: "PUBLIC DRAFT / READING EDITION", blocks: [["THE SIGNAL", "STAR ASCENT is a public build across culture, technology, and collective imagination. The work stays visible so the record can be inspected in real time."], ["THE BOUNDARY", "No presale or paid registration. No token-price, profit, or guaranteed market-value promise. The proposed reward program is disclosed separately and remains inactive on mainnet HOLD."], ["THE STANDARD", "Every material Genesis claim belongs beside a public address, transaction, program reference, or a clear HOLD status."]], next: "OPEN TOKENOMICS →" },
  tokenomics: { label: "CANONICAL RECORD / 02", title: "TOKENOMICS", deck: "A fixed-supply design target with its reward mechanics and adverse outcomes visible before execution.", state: "POLICY V2 / NOT ACTIVE / MAINNET HOLD", blocks: [["FIXED SUPPLY", "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public."], ["REWARD RESERVE", "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance."], ["RATES + CCC", "Simple annual rates, paid weekly without automatic compounding: core team 17%, standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%. A weekly public random draw pauses one CCC Agency and its snapshotted downstream group for that turn. Every exact protocol tie uses one final, exact-uniform, publicly verifiable roll over a precommitted candidate set. Full terms: /tokenomics."]], next: "OPEN GENESIS PROOF →" },
  "mint-manifest": { label: "OPERATOR RECORD / 03", title: "MINT MANIFEST", deck: "The sequence that must be rehearsed, signed physically, and evidenced without shortcuts.", state: "HOLD UNTIL SIGNER REHEARSAL", blocks: [["SIGNER GATE", "The fee payer must be signed on the Trezor device. Any required one-time mint-account signer must be treated as a rehearsal gate, never an invisible detail."], ["STANDARD PROGRAM", "The intended path uses the original SPL Token Program. No hidden mint path, transfer tax, or surprise authority belongs in the launch."], ["PUBLICATION", "Mint address, program, supply, authority evidence, allocation addresses, locks, and circulating-supply calculation must be published together."]], next: "OPEN GENESIS RUN →" },
  "genesis-proof": { label: "EVIDENCE RECORD / 04", title: "GENESIS PROOF", deck: "A designed evidence ledger for the moment a proposal becomes a public network fact.", state: "AWAITING ON-CHAIN EVIDENCE", blocks: [["MINT", "Record the verified mint address, decimals, supply, and token program."], ["AUTHORITY", "Record the transaction evidence that confirms mint and freeze authority removal."], ["ALLOCATIONS", "Record allocation wallets, lock evidence, circulating calculation, and any known limitation in plain language."]], next: "OPEN MINT MANIFEST →" },
  "broadcast-pack": { label: "TRANSMISSION / 05", title: "BROADCAST PACK", deck: "The proposed run of show for a launch broadcast that values proof over theatre—without losing the theatre.", state: "DRAFT BUILD / EDITION 01 / HOLD", blocks: [["OPEN", "State the time window, the scope, and the fact that no transaction is final until physically signed and publicly confirmed."], ["SIGNAL", "Show the public evidence screens as they exist. Do not narrate unavailable facts as already complete."], ["CLOSE", "Publish the proof route and a clear HOLD notice if any gate is incomplete."]], next: "OPEN SOCIAL KIT →" },
  "social-kit": { label: "SIGNAL SYSTEM / 06", title: "SOCIAL KIT", deck: "A draft set of language and visual cues for the Scorpion Generation signal.", state: "DRAFT BUILD / EDITION 01 / HOLD", blocks: [["VOICE", "Precise, electric, suspicious of empty promises. Myth is welcome; false certainty is not."], ["VISUAL", "Hot red, deep space, operators, light, movement, and a system visibly being assembled."], ["POSTING", "Lead to designed Dossier routes, then attach immutable evidence as it is available."]], next: "OPEN WHITE DOSSIER →" },
  "genesis-run": { label: "OPERATIONS RECORD / 07", title: "GENESIS RUN", deck: "A planned rehearsal sequence for a future Genesis window, with stop conditions explicit.", state: "HOLD UNTIL ALL GATES PASS", blocks: [["BEFORE", "Verify the signing device, devnet rehearsal, intended accounts, publication payload, and current page copy."], ["DURING", "Sign only what is shown on the device. Capture transaction references immediately and do not improvise recovery steps."], ["AFTER", "Publish the evidence ledger, confirm authority state, and reconcile actual circulating supply before any forward-looking story."]], next: "OPEN GENESIS PROOF →" },
};

const tailoredEN: Record<string, Copy> = {
  "authority-map": { label: "CONTROL RECORD / 08", title: "AUTHORITY MAP", deck: "A public checklist for the moment the system gives up the powers it must not retain.", state: "HOLD UNTIL EVIDENCED", blocks: [["MINT AUTHORITY", "The mint authority is a launch gate, not a trust-me sentence. Its revocation belongs in a public transaction record."], ["FREEZE AUTHORITY", "Freeze authority follows the same rule: name the state, publish the evidence, or keep the record on HOLD."], ["ALLOCATION CONTROL", "Time-locks, custody boundaries, and public allocation addresses are evidence objects, not marketing copy."]], next: "OPEN GENESIS PROOF →" },
  "technical-spec": { label: "SYSTEM RECORD / 09", title: "TECHNICAL SPEC", deck: "A readable technical contract between the signal, the chain, and the people verifying both.", state: "REFERENCE EDITION", blocks: [["TOKEN STANDARD", "The intended design uses the original SPL Token Program with a fixed supply target and nine decimals."], ["VERIFICATION", "Every technical statement should resolve to a mint address, program reference, account state, or a clear pending label."], ["NO HIDDEN LAYER", "No transfer tax, surprise authority, or opaque execution path belongs in the public design."]], next: "OPEN MINT MANIFEST →" },
  readiness: { label: "LAUNCH RECORD / 10", title: "READINESS SCORE", deck: "A visible list of what must be true before the signal crosses from theatre into a public event.", state: "HOLD CHECKLIST", blocks: [["DEVICE", "The physical signer, device update state, and rehearsal path must be confirmed before any Mainnet action is considered."], ["EVIDENCE", "The public pages, release packet, and evidence ledger must be ready before any final signature is considered."], ["STOP CONDITION", "If a gate is incomplete, the correct move is HOLD. Speed does not outrank verifiability."]], next: "OPEN GENESIS RUN →" },
  "incident-response": { label: "SAFETY RECORD / 11", title: "INCIDENT RESPONSE", deck: "A calm route through bad information, compromised links, and the pressure to move too quickly.", state: "ALWAYS ACTIVE", blocks: [["PAUSE", "Stop broadcast claims and transactions when a material inconsistency appears. Preserve facts before narrative."], ["VERIFY", "Use known official addresses and independent evidence. Never accept a wallet or link from a reply, DM, or rushed message."], ["RECORD", "Publish the correction, the decision, and the new status in the archive. A visible pause is stronger than a hidden mistake."]], next: "RETURN TO DOSSIER →" },
};

function fallback(slug: string): Copy {
  if (tailoredEN[slug]) return tailoredEN[slug];
  return { label: "RECORD NOT FOUND", title: "NON-CANONICAL ADDRESS", deck: "This address does not resolve to a canonical STAR ASCENT Dossier record.", state: "RECORD NOT PUBLISHED", blocks: [["VERIFY", "Open canonical records from the Dossier index."], ["SAFETY", "Do not treat any claim on this page as public evidence."], ["NEXT", "Return to the Dossier index for the correct record link."]], next: "RETURN TO DOSSIER →" };
}

function archiveFragments(slug: string) {
  return [
    ["ARCHIVE FRAGMENT", "Every page is a room on the ship. The bridge holds the visible choices; the archive keeps the reasons, revisions, and pressure around them."],
    ["SCORPION GENERATION", "The point is not to perform futurity. It is to become precise enough to build a future in public—beautifully, critically, and without faking what is not ready."],
    ["THE NEXT SIGNAL", slug === "genesis-run" ? "Genesis is a threshold, not an ending. The record stays open after the launch window." : "Follow this record into the next room. The world is assembled by routes, traces, and the people who keep showing up."]
  ];
}

export default function DossierReaderPage() {
  const params = useParams<{ slug: string }>();
  const record = EN[params.slug] ?? fallback(params.slug);
  const fragments = archiveFragments(params.slug);
  const radianceArt = params.slug === "broadcast-pack" || params.slug === "social-kit"
    ? { src: "/images/radiance-studio-signal.png", width: 800, height: 1966 }
    : params.slug === "genesis-run" || params.slug === "readiness"
      ? { src: "/images/radiance-bike-operator.webp", width: 1024, height: 1536 }
      : params.slug === "white-dossier"
        ? { src: "/images/radiance-roller-rave.webp", width: 853, height: 1844 }
        : { src: "/images/radiance-snow-train.webp", width: 864, height: 1820 };
  const nextRecordHref = NEXT_RECORD_ROUTES[params.slug] ?? "/dossier";
  return <main className="reader-page">
    <div className="reader-noise" aria-hidden="true" />
    <nav className="reader-nav"><a href="/">IA<span>///</span></a><div><a href="/dossier">DOSSIER</a></div></nav>
    <section className="reader-hero"><div><p>{record.label}</p><h1>{record.title}</h1><strong>{record.state}</strong><p className="reader-deck">{record.deck}</p>{params.slug === "genesis-proof" && <p className="reader-live-note">PUBLIC RECORD SLOT: canonical Genesis links appear here only after verified publication.</p>}</div><figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img {...radianceArt} loading="lazy" decoding="async" alt="Radiance, Internal Agency field operator" />
      <figcaption>RADIANCE // ARCHIVE OPERATOR</figcaption>
    </figure></section>
    <section className="reader-sheet"><div className="reader-spine"><span>STAR ASCENT</span><b>0{Math.max(1, Object.keys(EN).indexOf(params.slug) + 1)}</b><span>2026</span></div><div className="reader-content">{record.blocks.map(([heading, text], index) => <article key={heading}><span>0{index + 1}</span><h2>{heading}</h2><p>{text}</p></article>)}</div></section>
    <section className="reader-lore"><figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/scorpion-crew-arrival-v1.webp" width={1672} height={941} loading="lazy" decoding="async" alt="STAR ASCENT crew arriving under red light" />
    </figure><div>{fragments.map(([heading, text], index) => <article key={heading}><span>0{index + 4}</span><h2>{heading}</h2><p>{text}</p></article>)}</div></section>
    <section className="reader-next"><p>NEXT RECORD</p><a href={nextRecordHref}>{record.next}<span>↗</span></a><a className="reader-world-link" href="/world">ENTER THE WORLD ARCHIVE<span>◌</span></a></section>
  </main>;
}

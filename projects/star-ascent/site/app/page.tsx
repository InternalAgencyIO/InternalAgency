"use client";
import { useEffect, useState } from "react";
import { ActivationTerminal } from "./ActivationTerminal";
import { LaunchClock } from "./LaunchClock";
import { SignalField } from "./SignalField";
import { LaunchSequence } from "./LaunchSequence";
const copy = {
    nav: ["Mission", "Token", "Roadmap", "Dossier"], register: "Operator Registration", signal: "STARLIGHT // SIGNAL ACQUIRED", presents: "INTERNAL AGENCY PRESENTS", lede: "The first public chapter of Internal Agency: a community token on Solana and the opening of the operator network.", enter: "Enter the Register", disclosure: "Read the token disclosure ↓", genesis: "GENESIS EVENT", broadcast: "BROADCAST STATUS", terminal: "STARLIGHT :: LAUNCH TERMINAL", terminalNote: "PUBLIC BUILD / NO WALLET CONNECTION REQUIRED", brief: "MISSION BRIEF", briefTitle: "THE PUBLIC BUILD", briefLines: ["[01] Internal Agency is opening its first public chapter.", "[02] $IAT is the community layer; it is not a promise of return.", "[03] Official information appears only through verified project channels."], premise: "THE PREMISE", thesis: <>Agency is not handed down.<br />It is built together.</>, body: "Internal Agency is a staged creative and technical project for people who want more agency in the AI era. STAR ASCENT is a transparent beginning—not a promise of finished technology or financial returns.", token: "$IAT / SOLANA", clear: <>Community layer.<br />Clear terms.</>, supply: "SUPPLY DESIGN TARGET", supplyTarget: "1,000,000,000 IAT", network: "NETWORK", presale: "PRESALE", yield: "LAUNCH YIELD", none: "None", status: "LAUNCH STATUS", live: "Launch information published", verified: "Mint address not published yet", safety: "No wallet connection required", staged: "STAGED RELEASE", phases: [["GENESIS", "Launch disclosure, livestream, and operator registration."], ["DISTRIBUTION", "Publish campaign methodology and the community allocation process."], ["IA PREVIEW", "Release announced IA experiences when ready for public use."]], protocol: "OPERATOR PROTOCOL", verify: "Verify. Sign. Enter.", free: "Registration is free. No seed phrase, private key, password, or payment is ever required.", prepare: "Prepare for Registration", notice: "Registration opens at launch. You will only ever be asked to sign a wallet message—never to share a seed phrase or private key.", faq: "OPERATOR FAQ", questions: [["Where is the official token address?", "The official mint address will appear only here, in the pinned official announcement, and on the launch livestream."], ["Do I need to connect a wallet now?", "No. Registration is not open yet. Never share a seed phrase or private key."], ["Is $IAT an investment promise?", "No. $IAT is a speculative community token. No price or financial return is promised."]], risk: "© 2026 Internal Agency. $IAT is highly speculative. No financial return is promised.", skip: "Skip to mission"
};
const tokenPolicyVoice = {
    broadcast: "BROADCAST",
    live: "Launch information draft published // Mainnet HOLD",
    briefLines: ["[01] Internal Agency is opening its first public chapter.", "[02] The proposed IAT reward contract is public, not active.", "[03] Mainnet stays on HOLD until code, funding, review, and evidence match."],
    yield: "REWARD CONTRACT",
    none: "PROPOSED / HOLD",
    questions: [["Where is the official token address?", "The official mint address will appear only here, in the pinned official announcement, and on the launch livestream."], ["Do I need to connect a wallet now?", "No. Registration and staking are not open. Never share a seed phrase or private key."], ["Is IAT an investment promise?", "No token price, profit, or guaranteed market value is promised. Proposed reward rates are contract rules for accepted, fully collateralized positions and are not active."]],
    risk: "© 2026 Internal Agency. IAT is highly speculative. No token price, profit, or guaranteed market value is promised."
};
const manifesto = {
    lede: "A signal for people who refuse to sleepwalk through the age of artificial intelligence. STAR ASCENT is the first opening in the wall.",
    brief: "TRANSMISSION // 001",
    briefTitle: "THE SIGNAL IS OPEN.",
    lines: ["[01] We are not here to optimize the old world.", "[02] We are here to imagine a more sovereign one.", "[03] This is a public build. Bring your curiosity. Bring your fire."],
    premise: "THE TRANSMISSION",
    thesis: <>The future is not handed down.<br />It is taken back.</>,
    body: "Internal Agency is a living experiment in collective imagination, technology, culture, and self-determination. STAR ASCENT is our first broadcast: an invitation to build the strange, the beautiful, and the useful in public.",
    clear: <>A signal.<br />A gathering.</>
};
const launchPlan = {
    eyebrow: "OPEN-SOURCE EXECUTION WINDOW",
    title: "Public code. Physical approval. Verifiable evidence.",
    note: "The prior ceremony window has expired and no replacement UTC time is published. The source is public now. No transaction is automatic, and mainnet remains on HOLD until funding and every evidence gate pass.",
    items: [
        ["UNSCHEDULED", "Replacement UTC window pending", "Publish one new exact time only after funding is confirmed and before every bound release artifact is regenerated."],
        ["DEVNET FIRST", "V2 program rehearsal", "The reviewed V2 program must be built, deployed unfunded, transferred to hardware control, initialized, funded, and exercised on Devnet before any Mainnet decision can be considered."],
        ["AFTER ALL GATES", "Mainnet decision", "The signer and verifier may proceed only if metadata, destinations, locks, digests, and handoff records all match."],
        ["After site update", "Registration opens", "Use the on-page status—not a direct message—to confirm availability."],
    ]
};
const scamProtocol = {
    eyebrow: "ANTI-SCAM PROTOCOL",
    title: "Pause before you sign.",
    intro: "Treat every direct message, countdown, and copied address as unverified until it matches this page and the livestream screen.",
    steps: [
        ["STOP", "Do not act on urgency, giveaways, presales, support DMs, or “verification” payments."],
        ["VERIFY", "Match the full address character-for-character in two official surfaces. A logo or display name proves nothing."],
        ["PROTECT", "Never enter a seed phrase or private key. Reject unexpected signatures and inspect the wallet prompt."],
        ["REPORT", "Capture the account and URL, report them on the platform, then return here independently—do not follow their link."],
    ],
    warning: "There is no private sale, paid registration, support wallet, or secret early-access link."
};
const faqAdditions = [
    ["What should a registration signature ask me to do?", "Registration should request only a human-readable wallet message. If the wallet asks you to approve a transaction, token access, spending permission, or a transfer, cancel and return to this page independently."],
    ["Where will allocation and authority details be published?", "The allocation method, distribution rules, recipient categories, and mint/freeze authority status will be documented publicly before distribution begins. Until then, treat those details as pending—not implied."],
    ["Can support recover or verify my wallet?", "No. Official support will never ask to recover, import, verify, or inspect your wallet, and cannot reverse a transfer. Anyone requesting wallet secrets or payment is impersonating the project."],
];
const tokenDisclosure = {
    eyebrow: "TOKEN DISCLOSURE",
    title: "Design targets are not live facts.",
    intro: "No $IAT token has been presented as live on this page. These fields separate the intended configuration from evidence that must be published before distribution.",
    note: "The economic policy is public at /tokenomics. The official mint, program vaults, reward router, and authority evidence are not yet published; the program is not active.",
    pending: "PENDING",
    items: [
        ["Mint address", "Not published. Treat every address as unofficial until it matches the website and livestream."],
        ["Initial supply", "Design target: 1,000,000,000 IAT. The final on-chain supply must be independently verifiable."],
        ["Mint / freeze authority", "Revocation is planned after the documented initial mint; current status is not yet verified. On-chain evidence must be linked here."],
        ["Allocation and release", "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending."],
    ],
    gate: "Distribution and reward activation must not begin while any launch-critical implementation or evidence remains pending."
};
const evidencePack = {
    eyebrow: "PUBLICATION GATE",
    title: "Evidence required before distribution.",
    intro: "A launch announcement is not proof. Distribution stays paused until one public packet makes every critical claim independently checkable.",
    status: "NOT YET PUBLISHED",
    items: [
        ["Final token configuration", "Mint address, token program, decimals, total supply, and a UTC verification timestamp."],
        ["Authority evidence", "Direct explorer links showing the current mint and freeze authority state; plans or screenshots are not sufficient."],
        ["Allocation map", "Recipient categories, percentages, token amounts, labeled public wallets, and a mathematical total of 100%."],
        ["Release controls", "Vesting, lock, custody, and release terms plus the public method for reporting every distribution."],
    ],
    note: "Each field remains pending until the linked evidence is live and consistent across the website, pinned announcement, and livestream.",
    download: "Open English evidence-checklist record"
};
const documentPack = {
    eyebrow: "PUBLIC DOCUMENTS",
    title: "Read the design before any wallet action.",
    intro: "These pre-launch documents describe intended safeguards and unresolved fields. They are not proof that a token exists, that an allocation is final, or that any authority has been changed.",
    status: "CANONICAL DOSSIER CONTEXT",
    litepaper: "Open English litepaper record",
    tokenPolicy: "Open IAT economic policy V2",
    checklist: "Open English evidence-checklist record",
    technical: "Open English technical-specification record",
    validator: "Open allocation-control context",
    authorityValidator: "Open authority-map context",
    socialKit: "Open English communications-kit record",
    rehearsal: "Open English rehearsal-playbook record",
    readiness: "Open English readiness-scorecard record",
    incident: "Open English incident-response record",
    audit: "Open readiness-review context",
    releaseValidator: "Open release-readiness context",
    evidenceValidator: "Open Genesis-evidence context",
    snapshotValidator: "Open readiness-snapshot context",
    rehearsalTraceValidator: "Open Genesis-rehearsal context",
    changeFreezeValidator: "Open change-control context",
    launchHandoffValidator: "Open launch-handoff context",
    note: "These links open canonical Dossier context, not executable downloads or preserved validator bytes. Every launch-critical field remains HOLD until backed by linked public evidence."
};
const validatorPlan = {
    eyebrow: "TECHNICAL TEST GATE · LOCAL ONLY",
    title: "What the allocation validator proves — and what it cannot.",
    intro: "The archived scaffold describes checks for a proposed public allocation manifest without connecting to Solana, a wallet, or a signing service.",
    checks: [
        ["Exact arithmetic", "Supply, category totals, and recipient totals must match exactly in integer base units."],
        ["Unique identifiers", "Category IDs and public recipient-wallet identifiers cannot be duplicated."],
        ["Canonical inputs", "Amounts must be positive whole-number strings, avoiding floating-point rounding."],
        ["Deterministic result", "The same manifest produces the same summary and errors in local tests."],
    ],
    limit: "A passing result only shows that the draft manifest is internally consistent. It does not prove token authenticity, authority state, audit approval, deployment, or safety.",
    authorityTitle: "Authority plans stay proposed until the evidence is public.",
    authorityIntro: "A second offline scaffold checks that mint and freeze authority intentions are unique, explicit, evidence-gated, and still marked as proposed.",
    authorityLimit: "It does not inspect Solana or prove that an authority is retained, transferred, or revoked. Distribution remains blocked until linked public evidence is independently reviewed."
};
const readinessScorecard = {
    eyebrow: "LAUNCH READINESS · NOT APPROVED",
    title: "Current readiness: HOLD.",
    intro: "Rehearsal materials exist, but launch approval requires current public evidence. A completed draft, passing local test, or previous review cannot replace that evidence.",
    status: "HOLD",
    items: [
        ["Token identity", "Mint address, token program, decimals, supply, and verification time are not yet published as one checkable record."],
        ["Authority state", "Direct explorer evidence for current mint and freeze authorities is not yet linked and independently reviewed."],
        ["Allocation controls", "The final 100% allocation map, labeled public wallets, and release terms are not yet published."],
        ["Channel consistency", "The website, pinned announcement, and livestream must be compared after final content is live."],
    ],
    freshnessTitle: "Freshness is a launch gate.",
    freshness: "Every evidence record needs a UTC checked-at time, a named review role, and a direct public link. Recheck at T−60 minutes and immediately before any address publication or registration opening. A missing timestamp, unavailable link, changed value, or cross-channel mismatch returns the launch to HOLD.",
    note: "No numerical readiness score is shown while launch-critical evidence is missing; a percentage could imply approval that has not been earned."
};
const publicationAudit = {
    eyebrow: "PUBLICATION QA · LOCAL ONLY",
    title: "Files, links, and critical warnings must travel together.",
    intro: "The archive records a historical local checklist. The current release publishes canonical English fallback only; no target-language copy is approved without source-bound human review.",
    status: "ARCHIVE RECORD · REVIEW HOLD",
    limit: "This archive does not certify the current file set, public reachability, evidence freshness, translation approval, or launch readiness. Readiness remains HOLD."
};
const incidentResponse = {
    eyebrow: "INCIDENT RESPONSE · PUBLIC PROTOCOL",
    title: "If a launch signal conflicts, stop the action.",
    intro: "A mismatched address, unexpected wallet request, impersonation report, unavailable evidence link, or changed authority value immediately returns launch activity to HOLD.",
    status: "HOLD ON ANY TRIGGER",
    steps: [
        ["PAUSE", "Stop address publication, registration opening, distribution, and scheduled social posts. Do not improvise a replacement address or link."],
        ["CONTAIN", "Remove unsafe links from project-controlled surfaces, preserve public evidence, and warn the community without repeating a suspicious wallet or payment request."],
        ["CORRECT", "Publish one timestamped canonical correction on this website first, then mirror only approved, source-bound wording to the pinned announcement and livestream."],
        ["REVIEW", "Two separated review roles must recheck the full value, direct public evidence, UTC time, and cross-channel match before any activity resumes."],
    ],
    note: "Support will not resolve an incident through a private message and will never ask for a seed phrase, private key, password, personal data, payment, or token transfer."
};
const releasePacket = {
    eyebrow: "CROSS-CHANNEL RELEASE PACKET · LOCAL ONLY",
    title: "One source. Three public surfaces. No silent substitutions.",
    intro: "Before any address publication, the website, pinned announcement, and livestream must carry the same launch-critical values character for character.",
    status: "HOLD UNTIL EXACT MATCH",
    surfaces: [
        ["Website", "Set the canonical public wording here first; unresolved token fields stay PENDING."],
        ["Pinned announcement", "Copy the same full values and safety notice without shortening addresses or changing status language."],
        ["Livestream", "Display and read back the same values; a verbal claim or cropped screen is not a substitute for public evidence."],
    ],
    limit: "The archived validator record compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD."
};
const evidenceLedger = {
    eyebrow: "EVIDENCE FRESHNESS LEDGER · LOCAL ONLY",
    title: "Current evidence needs an expiry, two reviewers, and a direct link.",
    intro: "The archived validator record describes six required evidence checks at one declared UTC time. Missing, stale, future-dated, duplicated, or single-reviewer evidence fails closed.",
    status: "HOLD ON ANY GAP",
    checks: [
        ["Six required records", "Token identity, mint authority, freeze authority, allocation, release controls, and channel consistency must each be present."],
        ["Explicit freshness window", "Every verified record needs checked-at and expires-at UTC times; stale evidence is rejected deterministically."],
        ["Separated review", "A primary and independent review role must be named, and they cannot be the same role."],
    ],
    limit: "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD."
};
const readinessSnapshot = {
    eyebrow: "COMPOSITE READINESS SNAPSHOT · LOCAL ONLY",
    title: "Three gates. One fail-closed snapshot.",
    intro: "The archived composer record joins the publication audit, cross-channel packet result, and evidence-freshness ledger result into one deterministic handoff.",
    status: "HOLD · NOT LAUNCH APPROVAL",
    gates: [
        ["Publication integrity", "All public files and critical pre-launch warnings must pass the local publication audit."],
        ["Cross-channel consistency", "Website, pinned announcement, and livestream values must match, with unresolved critical fields counted."],
        ["Evidence freshness", "The six required evidence records must reconcile as current or unresolved under separated review."],
    ],
    limit: "The snapshot composes supplied local results only. It does not fetch public links, authenticate evidence, inspect Solana, handle wallet data, or turn a HOLD into READY."
};
const rehearsalTrace = {
    eyebrow: "REHEARSAL TRACE · LOCAL ONLY",
    title: "Timed checks need an auditable handoff.",
    intro: "The archived validator record requires three ordered rehearsal records with UTC times, separated operator and reviewer roles, and explicit notes.",
    status: "HOLD AFTER EVERY REHEARSAL",
    phases: [
        ["T−60", "Record evidence freshness, public-link availability, and cross-channel copy before final staging."],
        ["T−15", "Repeat safety, account-control, and support-route checks without introducing new launch claims."],
        ["PRE-ACTION", "Recheck immediately before address publication, registration opening, or any scheduled broadcast action."],
    ],
    limit: "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review."
};
const changeFreeze = {
    eyebrow: "CHANGE-FREEZE MANIFEST · LOCAL ONLY",
    title: "Freeze the reviewed bundle. Detect every silent change.",
    intro: "The archived validator record describes SHA-256 digests for an approved public asset inventory and rejection of missing, altered, duplicated, or unexpected files.",
    status: "ANY CHANGE RETURNS HOLD",
    checks: [
        ["Approved inventory", "A reviewer supplies the exact public files intended for the freeze; the tool does not decide which content is approved."],
        ["Content digests", "Every frozen file receives a deterministic SHA-256 digest so text changes are visible before publication."],
        ["Strict comparison", "Missing, changed, duplicate, or extra files fail closed and require a new human review."],
    ],
    limit: "The validator reads only supplied local files. It does not fetch the website, authenticate evidence, inspect Solana, handle wallet data, or approve launch readiness. A matching bundle still returns HOLD."
};
const launchHandoff = {
    eyebrow: "HUMAN LAUNCH HANDOFF · LOCAL ONLY",
    title: "Package the evidence. Keep the final decision human.",
    intro: "The archived validator record composes the readiness snapshot, rehearsal trace, and change-freeze result into one role-separated handoff packet.",
    status: "HUMAN DECISION PENDING",
    checks: [
        ["Three supplied results", "Readiness, rehearsal, and frozen-asset results must each remain HOLD and declare that no network was checked."],
        ["Separated role codes", "Use only release-operator, safety-reviewer, and decision-owner; names and email addresses are rejected."],
        ["Explicit unresolved count", "Pending evidence, release fields, and rehearsal checks are totaled without converting them into a readiness score."],
    ],
    limit: "The packet records a review boundary; it does not fetch evidence, inspect Solana, handle wallet data, or sign for a person. Software cannot set READY or grant launch approval."
};
export default function Home() {
    const [notice, setNotice] = useState("");
    const [activationOpen, setActivationOpen] = useState(false);
    const [activationOpener, setActivationOpener] = useState<HTMLElement | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("activate") !== "1")
            return;
        queueMicrotask(() => setActivationOpen(true));
        params.delete("activate");
        const suffix = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}${window.location.hash}`);
    }, []);
    const t = { ...copy, ...tokenPolicyVoice };
    const m = { ...manifesto, lines: tokenPolicyVoice.briefLines };
    const schedule = launchPlan;
    const antiScam = scamProtocol;
    const disclosure = tokenDisclosure;
    const evidence = evidencePack;
    const documents = documentPack;
    const validator = validatorPlan;
    const readiness = readinessScorecard;
    const audit = publicationAudit;
    const incident = incidentResponse;
    const packet = releasePacket;
    const ledger = evidenceLedger;
    const snapshot = readinessSnapshot;
    const trace = rehearsalTrace;
    const freeze = changeFreeze;
    const handoff = launchHandoff;
    const register = (event?: React.MouseEvent<HTMLButtonElement>) => { setActivationOpener(event?.currentTarget ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)); setNotice(t.notice); setActivationOpen(true); };
    const openActivation = () => { setActivationOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null); setActivationOpen(true); };
    return <>
    {activationOpen && <ActivationTerminal onClose={() => setActivationOpen(false)} returnFocusTo={activationOpener}/>}
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); const main = document.getElementById("main-content"); main?.focus({ preventScroll: true }); main?.scrollIntoView(); }}>{"Skip to main content"}</a>
    <nav aria-label={"Primary navigation"}><span className="sr-only" id="registration-safety">{t.free}</span><a className="mark" href="/" aria-label="Internal Agency">IA<span aria-hidden="true">{"///"}</span></a><div className="nav-links"><a href="#mission">{t.nav[0]}</a><a href="#token">{t.nav[1]}</a><a href="#roadmap">{t.nav[2]}</a><a href="#document-pack-title">{t.nav[3]}</a><a href="/network">{"Network"}</a><a href="/launch">{"Launch"}</a><a href="/proof">{"Proof"}</a><a href="/signal">{"Signal"}</a><a href="/future">{"Future"}</a></div><div className="nav-actions"><button className="outline" onClick={register} aria-describedby="registration-safety">{t.register}</button></div></nav>
    <main id="main-content" tabIndex={-1}><LaunchSequence/>
    <section className="hero" aria-labelledby="hero-title"><div className="grid" aria-hidden="true"/><div className="orbital-nodes" aria-hidden="true"><i /><i /><i /><i /></div><div className="signal">{t.signal}</div><div className="terminal-head"><span>{t.terminal}</span><span>{t.terminalNote}</span></div><p className="eyebrow">{t.presents}</p><h1 id="hero-title">STAR<br />ASCENT<span>.</span></h1><p className="lede">{m.lede}</p><div className="actions"><button onClick={register} aria-describedby="registration-safety">{t.enter}</button><a className="text-link" href="#token">{t.disclosure}</a></div><LaunchClock/><div className="launch-time"><span>{t.genesis}</span><strong>{"UNSCHEDULED · MAINNET HOLD"}</strong><span className="broadcast">{t.broadcast} · {"CODE PUBLIC // EVIDENCE HOLD"}</span></div></section>
    <section className="signal-ticker" aria-label={"Project signal"}><div>{"THE SIGNAL IS OPEN  //  BUILD THE STRANGE  //  BUILD THE BEAUTIFUL  //  BUILD IN PUBLIC  //  STAR ASCENT"}</div></section>
    <SignalField onOpenTerminal={openActivation}/>
    <section className="brief"><p className="eyebrow">{m.brief}</p><h2>{m.briefTitle}</h2><div className="brief-console">{m.lines.map((line: string) => <p key={line}>{line}</p>)}</div></section>
    <section className="outer-comms">
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/outer-comms-v1.webp" width={1823} height={863} loading="lazy" decoding="async" alt=""/>
      <div><p className="eyebrow">{"OUTER COMMS // SECURE"}</p><h2>{<>THE SIGNAL<br />IS ALIVE.</>}</h2><p>{"A constellation answers from the black. One room. One rising ship. Every line is moving."}</p></div>
    </section>
    <section className="genesis-console" aria-labelledby="genesis-console-title"><div className="genesis-console-heading"><p>{"GENESIS // COMMAND CENTER"}</p><h2 id="genesis-console-title">{<>CHOOSE YOUR<br />ENTRY VECTOR.</>}</h2><span>{"Three public surfaces. One verification order."}</span></div><div className="genesis-console-grid"><a href="/dossier"><small>01 // {"CANONICAL RECORD"}</small><strong>{"OPEN THE DOSSIER"}</strong><em>{"Read the public record, token design target, and evidence gates."}</em><b>↗</b></a><a href="/network"><small>02 // {"READ THE CHAIN"}</small><strong>{"OPEN IAT NETWORK"}</strong><em>{"Inspect Solana, player wallets, IAT positions, rewards, and CCC state from one read-only screen."}</em><b>↗</b></a><a href="#schedule"><small>03 // {"WITNESS"}</small><strong>{"BROADCAST WINDOW"}</strong><em>{"The window opens exactly; transaction execution remains human-approved."}</em><b>↓</b></a></div></section>
    <figure className="keyart">
      <div className="keyart-frame">
        {/* eslint-disable-next-line @next/next/no-img-element -- native dimensions and lazy loading keep this static Sites asset stable */}
        <img src="/images/star-ascent-keyart-v2.png" width={1728} height={909} loading="lazy" decoding="async" fetchPriority="low" alt={"Amber STAR ASCENT signal-acquired deep-space telemetry artwork"}/>
      </div>
      <figcaption>{"PRE-LAUNCH ART · Decorative brand artwork — not live telemetry or network status."}</figcaption>
    </figure>
    <figure className="scorpion-story">
      <div className="scorpion-story-copy"><p>{"SCORPION GENERATION // LAUNCH CONTROL"}</p><h2>{<>WE DO NOT<br />WAIT FOR THE<br />FUTURE.</>}</h2><span>{"The stage is a ship. The signal is a gathering. The ascent is ours."}</span></div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static, responsive lore artwork */}
      <img src="/images/scorpion-launch-control-v1.webp" width={1728} height={909} loading="lazy" decoding="async" alt={"Adult Scorpion Generation stage director and light operators at a starship launch-rave control deck"}/>
    </figure>
    <figure className="crew-arrival"><div className="crew-arrival-copy"><p>{"THE CREW // ARRIVAL WINDOW"}</p><h2>{<>THE LIGHTS<br />ARE ALREADY<br />ON.</>}</h2><span>{"Not a promise. A scene set for the people arriving with their eyes open."}</span></div>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/scorpion-crew-arrival-v1.webp" width={1672} height={941} loading="lazy" decoding="async" alt={"Adult stage commander and light operators in a red spacecraft launch hangar"}/>
    </figure>
    <section className="ascent-ritual" aria-label={"The ascent ritual"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/ascent-ritual-v1.webp" width={1536} height={1024} loading="lazy" decoding="async" alt={"A crew witnessing the STAR ASCENT launch beneath a luminous constellation"}/>
      <div><p className="eyebrow">{"THE SCORPION GENERATION"}</p><h2>{<>WE DON&apos;T WATCH<br />THE FUTURE.</>}</h2><p>{"We gather at the edge of the signal: artists, operators, believers and night people. The ship rises; the room becomes a constellation."}</p></div>
    </section>
    <section className="statement" id="mission"><p className="eyebrow">{m.premise}</p><h2>{m.thesis}</h2><p>{m.body}</p></section>
    <section className="token" id="token"><div><p className="eyebrow">{t.token}</p><h2>{m.clear}</h2></div><div className="token-grid"><div><span>{t.supply}</span><b>{t.supplyTarget}</b></div><div><span>{t.network}</span><b>Solana</b></div><div><span>{t.presale}</span><b>{"None"}</b></div><div><span>{t.yield}</span><b>{t.none}</b></div></div><p className="note">{disclosure.note} <a href="/tokenomics">{"Read the complete proposed terms →"}</a></p></section>
    <section className="token-disclosure" aria-labelledby="token-disclosure-title"><p className="eyebrow">{disclosure.eyebrow}</p><h2 id="token-disclosure-title">{disclosure.title}</h2><p className="disclosure-intro">{disclosure.intro}</p><dl>{disclosure.items.map(([term, detail]: string[]) => <div key={term}><dt>{term}<span>{disclosure.pending}</span></dt><dd>{detail}</dd></div>)}</dl><p className="disclosure-gate"><strong>{disclosure.gate}</strong> <a href="#evidence">{"Review the publication gate ↓"}</a></p></section>
    <section className="evidence-pack" id="evidence" aria-labelledby="evidence-title">
      <p className="eyebrow">{evidence.eyebrow}</p><h2 id="evidence-title">{evidence.title}</h2><p className="evidence-intro">{evidence.intro}</p>
      <ol>{evidence.items.map(([title, detail]: string[], index: number) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div><strong>{evidence.status}</strong></li>)}</ol>
      <p className="evidence-note">{evidence.note}</p><a className="document-link" href={"/disclosures/iat-allocation-authority-checklist-en.txt"}>{evidence.download}</a>
    </section>
    <section className="validator-plan" aria-labelledby="validator-plan-title">
      <p className="eyebrow">{validator.eyebrow}</p><h2 id="validator-plan-title">{validator.title}</h2><p className="validator-plan-intro">{validator.intro}</p>
      <ol>{validator.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol>
      <p className="validator-plan-limit"><strong>{"LIMIT"}</strong> {validator.limit}</p><a className="document-link" href="/disclosures/iat-allocation-validator.mjs">{documents.validator}</a>
      <h3 className="validator-plan-subtitle">{validator.authorityTitle}</h3><p className="validator-plan-intro">{validator.authorityIntro}</p><p className="validator-plan-limit"><strong>{"EVIDENCE GATE"}</strong> {validator.authorityLimit}</p><a className="document-link" href="/disclosures/iat-authority-plan-validator.mjs">{documents.authorityValidator}</a>
    </section>
    <section className="document-pack" aria-labelledby="document-pack-title">
      <p className="eyebrow">{documents.eyebrow}</p><h2 id="document-pack-title">{documents.title}</h2><p className="document-pack-intro">{documents.intro}</p>
      <div className="document-cards">
        <a href="/tokenomics"><span>V2 · HOLD</span><strong>{documents.tokenPolicy}</strong></a>
        <a href={"/disclosures/iat-litepaper-en.txt"}><span>{documents.status}</span><strong>{documents.litepaper}</strong></a>
        <a href={"/disclosures/iat-allocation-authority-checklist-en.txt"}><span>{documents.status}</span><strong>{documents.checklist}</strong></a>
        <a href={"/disclosures/iat-solana-technical-spec-en.txt"}><span>{documents.status}</span><strong>{documents.technical}</strong></a>
        <a href="/disclosures/iat-allocation-validator.mjs"><span>{documents.status}</span><strong>{documents.validator}</strong></a>
        <a href="/disclosures/iat-authority-plan-validator.mjs"><span>{documents.status}</span><strong>{documents.authorityValidator}</strong></a>
        <a href={"/disclosures/star-ascent-communications-kit-en.txt"}><span>{documents.status}</span><strong>{documents.socialKit}</strong></a>
        <a href={"/disclosures/star-ascent-launch-rehearsal-en.txt"}><span>{documents.status}</span><strong>{documents.rehearsal}</strong></a>
        <a href={"/disclosures/star-ascent-readiness-scorecard-en.txt"}><span>{readiness.status}</span><strong>{documents.readiness}</strong></a>
        <a href={"/disclosures/star-ascent-incident-response-en.txt"}><span>{documents.status}</span><strong>{documents.incident}</strong></a>
        <a href="/disclosures/star-ascent-publication-audit.mjs"><span>{documents.status}</span><strong>{documents.audit}</strong></a>
        <a href="/disclosures/star-ascent-release-packet-validator.mjs"><span>{packet.status}</span><strong>{documents.releaseValidator}</strong></a>
        <a href="/disclosures/star-ascent-evidence-ledger-validator.mjs"><span>{ledger.status}</span><strong>{documents.evidenceValidator}</strong></a>
        <a href="/disclosures/star-ascent-readiness-snapshot-validator.mjs"><span>{snapshot.status}</span><strong>{documents.snapshotValidator}</strong></a>
        <a href="/disclosures/star-ascent-rehearsal-trace-validator.mjs"><span>{trace.status}</span><strong>{documents.rehearsalTraceValidator}</strong></a>
        <a href="/disclosures/star-ascent-change-freeze-validator.mjs"><span>{freeze.status}</span><strong>{documents.changeFreezeValidator}</strong></a>
        <a href="/disclosures/star-ascent-launch-handoff-validator.mjs"><span>{handoff.status}</span><strong>{documents.launchHandoffValidator}</strong></a>
      </div><p className="document-pack-note">{documents.note}</p>
    </section>
    <details className="deep-archive"><summary><span>{"OPEN THE DEEP ARCHIVE"}</span><small>{"Operational controls, rehearsal and readiness material"}</small></summary><div className="deep-archive-body"><section className="publication-audit" aria-labelledby="publication-audit-title"><p className="eyebrow">{audit.eyebrow}</p><div className="publication-audit-heading"><h2 id="publication-audit-title">{audit.title}</h2><strong>{audit.status}</strong></div><p className="publication-audit-intro">{audit.intro}</p><p className="publication-audit-limit"><strong>{"LIMIT"}</strong> {audit.limit}</p><a className="document-link" href="/disclosures/star-ascent-publication-audit.mjs">{documents.audit}</a></section>
    <section className="release-packet" aria-labelledby="release-packet-title"><p className="eyebrow">{packet.eyebrow}</p><div className="release-packet-heading"><h2 id="release-packet-title">{packet.title}</h2><strong>{packet.status}</strong></div><p className="release-packet-intro">{packet.intro}</p><ol>{packet.surfaces.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="release-packet-limit"><strong>{"LIMIT"}</strong> {packet.limit}</p><a className="document-link" href="/disclosures/star-ascent-release-packet-validator.mjs">{documents.releaseValidator}</a></section>
    <section className="evidence-ledger" aria-labelledby="evidence-ledger-title"><p className="eyebrow">{ledger.eyebrow}</p><div className="evidence-ledger-heading"><h2 id="evidence-ledger-title">{ledger.title}</h2><strong>{ledger.status}</strong></div><p className="evidence-ledger-intro">{ledger.intro}</p><ol>{ledger.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="evidence-ledger-limit"><strong>{"LIMIT"}</strong> {ledger.limit}</p><a className="document-link" href="/disclosures/star-ascent-evidence-ledger-validator.mjs">{documents.evidenceValidator}</a></section>
    <section className="readiness-snapshot" aria-labelledby="readiness-snapshot-title"><p className="eyebrow">{snapshot.eyebrow}</p><div className="readiness-snapshot-heading"><h2 id="readiness-snapshot-title">{snapshot.title}</h2><strong>{snapshot.status}</strong></div><p className="readiness-snapshot-intro">{snapshot.intro}</p><ol>{snapshot.gates.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="readiness-snapshot-limit"><strong>{"LIMIT"}</strong> {snapshot.limit}</p><a className="document-link" href="/disclosures/star-ascent-readiness-snapshot-validator.mjs">{documents.snapshotValidator}</a></section>
    <section className="rehearsal-trace" aria-labelledby="rehearsal-trace-title"><p className="eyebrow">{trace.eyebrow}</p><div className="rehearsal-trace-heading"><h2 id="rehearsal-trace-title">{trace.title}</h2><strong>{trace.status}</strong></div><p className="rehearsal-trace-intro">{trace.intro}</p><ol>{trace.phases.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="rehearsal-trace-limit"><strong>{"LIMIT"}</strong> {trace.limit}</p><a className="document-link" href="/disclosures/star-ascent-rehearsal-trace-validator.mjs">{documents.rehearsalTraceValidator}</a></section>
    <section className="change-freeze" aria-labelledby="change-freeze-title"><p className="eyebrow">{freeze.eyebrow}</p><div className="change-freeze-heading"><h2 id="change-freeze-title">{freeze.title}</h2><strong>{freeze.status}</strong></div><p className="change-freeze-intro">{freeze.intro}</p><ol>{freeze.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="change-freeze-limit"><strong>{"LIMIT"}</strong> {freeze.limit}</p><a className="document-link" href="/disclosures/star-ascent-change-freeze-validator.mjs">{documents.changeFreezeValidator}</a></section>
    <section className="launch-handoff" aria-labelledby="launch-handoff-title"><p className="eyebrow">{handoff.eyebrow}</p><div className="launch-handoff-heading"><h2 id="launch-handoff-title">{handoff.title}</h2><strong>{handoff.status}</strong></div><p className="launch-handoff-intro">{handoff.intro}</p><ol>{handoff.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="launch-handoff-limit"><strong>{"LIMIT"}</strong> {handoff.limit}</p><a className="document-link" href="/disclosures/star-ascent-launch-handoff-validator.mjs">{documents.launchHandoffValidator}</a></section>
    <section className="readiness-scorecard" aria-labelledby="readiness-title"><p className="eyebrow">{readiness.eyebrow}</p><div className="readiness-heading"><h2 id="readiness-title">{readiness.title}</h2><strong>{readiness.status}</strong></div><p className="readiness-intro">{readiness.intro}</p><ol>{readiness.items.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div><strong>{readiness.status}</strong></li>)}</ol><div className="freshness-gate"><h3>{readiness.freshnessTitle}</h3><p>{readiness.freshness}</p></div><p className="readiness-note">{readiness.note}</p></section>
    <section className="incident-response" aria-labelledby="incident-response-title"><p className="eyebrow">{incident.eyebrow}</p><div className="incident-response-heading"><h2 id="incident-response-title">{incident.title}</h2><strong>{incident.status}</strong></div><p className="incident-response-intro">{incident.intro}</p><ol>{incident.steps.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="incident-response-note">{incident.note}</p><a className="document-link" href={"/disclosures/star-ascent-incident-response-en.txt"}>{documents.incident}</a></section>
    </div></details>
    <section className="status"><p className="eyebrow">{t.status}</p><div><span className="pulse" aria-hidden="true"/>{t.live}</div><div>{t.verified}</div><div><span className="check" aria-hidden="true">✓</span>{t.safety}</div></section>
    <section className="schedule" aria-labelledby="schedule-title"><p className="eyebrow">{schedule.eyebrow}</p><h2 id="schedule-title">{schedule.title}</h2><p className="schedule-note">{schedule.note}</p><ol>{schedule.items.map(([time, title, description]: string[]) => <li key={time}><time>{time}</time><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol><a className="document-link" href="https://github.com/InternalAgencyIO/InternalAgency/tree/agent/iat-launch-window/projects/star-ascent/site" target="_blank" rel="noreferrer">{"REVIEW THE OPEN-SOURCE CEREMONY CODE ↗"}</a></section>
    <section className="roadmap" id="roadmap"><p className="eyebrow">{t.staged}</p><div className="steps">{t.phases.map(([title, description]: string[], i: number) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="postgenesis-tease" aria-labelledby="postgenesis-title"><div><p>{"POST-GENESIS // INACTIVE PREVIEWS"}</p><h2 id="postgenesis-title">{<>THE NEXT ROOMS<br />ARE TAKING SHAPE.</>}</h2><span>{"Predictive Engine target: 30 days after $IAT Genesis. Casino DLC target: 15 days after $IAT Genesis. Separate audits, separate activation, no wager route today."}</span><a href="/future">{"ENTER THE FUTURE-SYSTEMS PREVIEW →"}</a></div></section>
    <section className="faq" id="faq" aria-labelledby="faq-title"><p className="eyebrow" id="faq-title">{t.faq}</p>{[...t.questions, ...faqAdditions].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
    <section className="anti-scam" aria-labelledby="anti-scam-title"><p className="eyebrow">{antiScam.eyebrow}</p><h2 id="anti-scam-title">{antiScam.title}</h2><p className="anti-scam-intro">{antiScam.intro}</p><div className="safety-steps">{antiScam.steps.map(([label, guidance]: string[], index: number) => <article key={label}><span aria-hidden="true">0{index + 1}</span><h3>{label}</h3><p>{guidance}</p></article>)}</div><p className="safety-warning"><strong>{antiScam.warning}</strong></p></section>
    <section className="register"><p className="eyebrow">{t.protocol}</p><h2>{t.verify}</h2><p>{t.free}</p><button onClick={register} aria-describedby="registration-safety">{t.prepare}</button><p className="notice" role="status" aria-live="polite">{notice}</p></section>
    </main>
    <footer><div className="mark">IA<span>{"///"}</span></div><p>{t.risk}</p><a href="#token">{t.disclosure}</a></footer>
  </>;
}

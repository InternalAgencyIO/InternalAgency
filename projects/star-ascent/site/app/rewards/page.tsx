import "./rewards.css";

const copy = {
  en: {
    eyebrow: "STAR ASCENT // PROPOSED NODE REWARDS", title: <>THE FIRST<br /><i>1,000.</i></>, lede: "A proposed Genesis Gift and participation rhythm. Neither the node program nor any claim window is active.", hold: "CLAIM SYSTEM // NOT ACTIVE // MAINNET HOLD", gift: "PROPOSED GENESIS GIFT", nodes: "TARGET VERIFIED NODES", clock: "PLANNED EPOCH", stats: [["100 IAT", "PROPOSED PER VERIFIED NODE"], ["1,000", "PROPOSED GENESIS LIMIT"], ["00:00 UTC", "PLANNED EPOCH SNAPSHOT"], ["NOT ACTIVE", "CLAIM WINDOW"]], staking: "PROPOSED STAKING RATES // NOT ACTIVE", stakingIntro: "A separate contract proposal uses simple annual reward rates paid weekly without automatic compounding. No staking position is currently accepted.", rates: [["17%", "CORE TEAM"], ["10%", "STANDARD USER"], ["28%", "CCC AGENT"], ["20%", "CCC ASSOCIATE"]], reserve: "Maximum proposed combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions would need full collateralization; all three lanes may reach zero by design.", terms: "READ COMPLETE ECONOMIC POLICY", protocol: "THE PROPOSED NODE PROTOCOL", steps: [["BIND", "Proposal: one X account, one public Solana wallet, and one signed node record."], ["WITNESS", "The verified Genesis record must be public before any gift can be claimed."], ["PARTICIPATE", "If activated, one qualifying original X post or reply may earn one campaign reward per epoch."], ["CLAIM", "No claim is available. Any future epoch must publish its public root and proof before a wallet can claim."]], proof: "OPEN PROOF BOARD", signal: "OPEN SIGNAL DIRECTORY", foot: "THE CAMPAIGN AND CLAIM SYSTEM ARE PROPOSED, NOT ACTIVE. MAINNET AND ALL REWARD ROUTES REMAIN ON HOLD." },
};

export default function RewardsPage() {
  const t = copy.en;
  return <main className="rewards-page"><div className="rewards-stars" aria-hidden="true" />
    <nav><a href="/">IA<span>///</span></a><a href="/dossier">WHITE DOSSIER ↗</a></nav>
    <section className="rewards-hero"><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.lede}</span><strong>{t.hold}</strong></section>
    <section className="rewards-statline" aria-label={t.eyebrow}><p>{t.gift}</p><b>{t.stats[0][0]}</b><p>{t.nodes}</p><b>{t.stats[1][0]}</b><p>{t.clock}</p><b>{t.stats[2][0]}</b></section>
    <section className="rewards-grid">{t.stats.map(([value, label], index) => <article key={label}><span>0{index + 1}</span><b>{value}</b><p>{label}</p></article>)}</section>
    <section className="rewards-staking"><p>{t.staking}</p><h2>{t.stakingIntro}</h2><div>{t.rates.map(([rate, label]) => <article key={label}><b>{rate}</b><span>{label}</span></article>)}</div><strong>{t.reserve}</strong><a href="/tokenomics">{t.terms} ↗</a></section>
    <section className="rewards-protocol"><p>{t.protocol}</p><div>{t.steps.map(([heading, body], index) => <article key={heading}><span>0{index + 1}</span><h2>{heading}</h2><p>{body}</p></article>)}</div></section>
    <section className="rewards-links"><a href="/proof">{t.proof} ↗</a><a href="/signal">{t.signal} ↗</a></section><footer>{t.foot}</footer>
  </main>;
}

const content = {
  kicker: "INTERNAL AGENCY // CANONICAL DOSSIER", title: <>THE SIGNAL<br />IS OPEN.</>, intro: "A public record for STAR ASCENT: myth, mechanism, and the evidence required to make both real.",
  section1: "THE TRANSMISSION", thesis: "The future is not handed down. It is taken back.", body: "STAR ASCENT is the first public transmission of Internal Agency: a living experiment in collective imagination, technology, culture, and self-determination. We are here to build the strange, the beautiful, and the useful in public.",
  section2: "FIXED-SUPPLY PROTOCOL", supply: "1,000,000,000", supplyLabel: "IAT MAXIMUM SUPPLY", allocations: [["COMMUNITY", "50%", "500M"], ["TREASURY", "20%", "200M"], ["ECOSYSTEM", "15%", "150M"], ["CORE TEAM", "10%", "100M"], ["LIQUIDITY", "5%", "50M"]],
  locks: [["TREASURY REWARD LANE", "25% available at Genesis target; remaining 75% has a 12-month cliff, then 36-month linear release"], ["ECOSYSTEM REWARD LANE", "25% available at Genesis target; remaining 75% has a 6-month cliff, then 24-month linear release"], ["LIQUIDITY REWARD LANE", "25% available at Genesis target; remaining 75% has a 6-month cliff, then linear release through month 24"], ["CORE TEAM", "100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting"], ["AUTHORITY", "Mint and freeze authority are intended to be permanently revoked after the documented initial mint; status requires on-chain evidence"]],
  associate: "REWARD + CCC POLICY", associateBody: "The proposed staking system uses simple annual reward rates paid weekly without automatic compounding: standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%, and core team 17%. A public random draw reassigns one CCC Agency every week and pauses that Agency and its snapshotted downstream group for the turn. Every exact protocol tie uses the same final one-roll, exact-uniform, publicly verifiable method. The program is not active.",
  evidence: "GENESIS PROOF", evidenceBody: "Before any distribution: publish the mint, program, supply, authority-revocation evidence, allocation wallets, program vaults, time-locks, circulating-supply calculation, and reward-contract review. If any field is missing, the correct status is HOLD.",
  open: "OPEN THE SOURCE DOCUMENTS", whiteDossier: "White Dossier", tokenomics: "Tokenomics", policy: "Economic policy V2", proof: "Genesis proof record", boundary: "No presale. No token-price, profit, or guaranteed market-value promise. Reward contracts and mainnet remain on HOLD until implementation and evidence are public.", footer: "STAR ASCENT // BUILD WITH DISCERNMENT",
};

export default function DossierPage() {
  const proposedLocks = content.locks.map(([label, detail]) => [label, `Proposed: ${detail}`]);

  return <main className="dossier-page">
    <div className="dossier-stars" aria-hidden="true" />
    <nav className="dossier-nav"><a href="/">IA<span>///</span></a><div><a className="dossier-signal-link" href="/signal">SIGNAL</a></div></nav>
    <section className="dossier-hero"><p>{content.kicker}</p><h1>{content.title}</h1><div className="dossier-orbit" aria-hidden="true"><i /><i /><i /></div><p className="dossier-intro">{content.intro}</p><div className="dossier-live-strip" role="status" aria-label="Archive availability status"><span><b>●</b> ARCHIVE AVAILABLE</span><span>REWARD CONTRACT: HOLD</span><span>MAINNET: HOLD</span></div><nav className="dossier-chapters" aria-label="Dossier chapters"><a href="#transmission">01 / SIGNAL</a><a href="#tokenomics">02 / TOKENOMICS</a><a href="#locks">03 / LOCKS</a><a href="#records">04 / RECORDS</a></nav></section>
    <figure className="story-art">
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/stage-manager-story.webp" width={1672} height={941} loading="lazy" decoding="async" alt="The STAR ASCENT stage manager on the ship bridge, with AI light operators conducting a cosmic rave" />
      <figcaption>THE STAGE MANAGER // THE SHIP IS A SIGNAL</figcaption>
    </figure>
    <section className="dossier-thesis" id="transmission"><p>{content.section1}</p><h2>{content.thesis}</h2><p>{content.body}</p></section>
    <section className="dossier-tokenomics" id="tokenomics"><p>{content.section2}</p><div className="supply-mark"><strong>{content.supply}</strong><span>{content.supplyLabel}</span></div><div className="allocation-table">{content.allocations.map(([name, share, amount]) => <div key={name}><i aria-hidden="true" style={{ width: `${share.replace("%", "")}%` }} /><b>{name}</b><span>{share}</span><strong>{amount}</strong></div>)}</div></section>
    <section className="dossier-locks" id="locks"><p>THE LOCK IS THE MESSAGE // PROPOSED</p><div>{proposedLocks.map(([label, detail], index) => <article key={label}><span>0{index + 1}</span><h3>{label}</h3><p>{detail}</p></article>)}</div></section>
    <figure className="dossier-crew-art">
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/scorpion-commander-portrait-v1.webp" width={1024} height={1536} loading="lazy" decoding="async" alt="Adult STAR ASCENT commander with the launch crew in the red-light control deck" />
      <figcaption>THE CREW IS THE CONSTELLATION // PUBLIC BUILD</figcaption>
    </figure>
    <section className="dossier-duo"><article><p>{content.associate}</p><h2>{content.associateBody}</h2></article><article><p>{content.evidence}</p><h2>{content.evidenceBody}</h2></article></section>
    <section className="dossier-sources" id="records"><p>{content.open}</p><div><a href="/tokenomics">{content.policy}</a><a href="/dossier/read/white-dossier">{content.whiteDossier}</a><a href="/dossier/read/tokenomics">{content.tokenomics}</a><a href="/dossier/read/genesis-proof">{content.proof}</a></div><small>{content.boundary}</small></section>
    <footer>{content.footer}</footer>
  </main>;
}

const EVIDENCE_ROOT = "/evidence/iat-v2";
const PUBLICATION_COMMIT = "eb2e59c2d41f9f716227887e54a5300d9b463dd0";
const PUBLICATION_ROOT =
  `https://github.com/InternalAgencyIO/InternalAgency/blob/${PUBLICATION_COMMIT}/projects/star-ascent/site/docs/b3/evidence`;
const CI_RUN = "https://github.com/InternalAgencyIO/InternalAgency/actions/runs/32937913614";
const GITHUB_EVIDENCE =
  `https://github.com/InternalAgencyIO/InternalAgency/tree/${PUBLICATION_COMMIT}/projects/star-ascent/site/public/evidence/iat-v2`;

type EvidenceRecord = {
  file: string;
  sha256: string | null;
  en: [string, string];
  href?: string;
  action?: string;
};

const evidenceRecords: EvidenceRecord[] = [
  {
    file: "IAT-B3-DEVNET-HW-PROOF-20260825.json",
    sha256: "175759dce910b3b2a4e346267608aae2942eec02260fbf4e8340ff59169ce290",
    en: ["OFF-CHAIN SIGNATURE PROOF", "Verified Ed25519 signature, frozen request binding, signer public key, and independent verification result. This artifact does not prove hardware provenance or a Devnet transaction."],
    href: `${PUBLICATION_ROOT}/IAT-B3-DEVNET-HW-PROOF-20260825.json`,
    action: "OPEN VERIFIED PROOF",
  },
  {
    file: "IAT-B3-DEVNET-HW-UNSIGNED-20260825.json",
    sha256: "62e31b746e57ce9e29ec4fb44bbff6ce94821412f069707772b119b226fdb096",
    en: ["FROZEN SIGNING REQUEST", "Exact unsigned request reviewed before the physical device confirmation; published separately for byte-level comparison."],
    href: `${PUBLICATION_ROOT}/IAT-B3-DEVNET-HW-UNSIGNED-20260825.json`,
    action: "OPEN FROZEN REQUEST",
  },
  {
    file: "verify-IAT-B3-DEVNET-HW-PROOF-20260825.mjs",
    sha256: "a17481693ee161b0497486cbeaa8b425c3965db45711b16c4d5eed47122bc045",
    en: ["INDEPENDENT VERIFIER", "Public verifier for the proof signature and request binding. It requires no wallet connection, private material, or transaction broadcast."],
    href: `${PUBLICATION_ROOT}/verify-IAT-B3-DEVNET-HW-PROOF-20260825.mjs`,
    action: "OPEN VERIFIER",
  },
  {
    file: "v2-initialization-20260730T074603Z.json",
    sha256: "902f7608b1f001e238c6e7999f8424b9a0fd38a61ac08db6f6b7e5f785d37602",
    en: ["V2 INITIALIZATION", "Seven-transaction deployment, immutable metadata, allocation, authority-revocation, and activation record."],
  },
  {
    file: "v2-features-20260801T053340Z.json",
    sha256: "7b460bee7a644452c6710cff7a5b81a3a3769a1d2daf4d3813913d7524a9b6f9",
    en: ["V2 FEATURE SNAPSHOT", "Latest 18-transaction record: three stake roles, standard and CCC-agent week-8 payouts, the selected-agency CCC-associate pause, core APY, liquidity unlock, Switchboard randomness, and CCC rounds 7 and 8. Later time gates remain outside this signed snapshot."],
  },
  {
    file: "chain-status-20260801T053947Z.json",
    sha256: "0a2e1f8ffeecffaf974e51f2d6e9abe020517a784c5cfa8b9c0f6af1f1efa4ce",
    en: ["CHAIN STATUS RECEIPT", "Read-only devnet RPC receipt: all 29 canonical transaction signatures were finalized with no reported error."],
  },
  {
    file: "v2-feature-independent-signoff-20260801T055736Z.json",
    sha256: "74487d17063e2bcf25bf00c9a23299f357bdf122b078342e2d40d46c58a7bf01",
    en: ["INDEPENDENT FEATURE REVIEW", "FDF Guard approval, relayed by the launch operator, binds the corrected artifact, the 18-transaction feature export, and the 29-signature receipt. Mainnet remains HOLD."],
  },
  {
    file: "v2-local-time-gate-proof-20260801T072730Z.json",
    sha256: "11245226a3ed1941519cf1f8fa875e3f6448d4a4144c0b612672a09750c22e6c",
    en: ["LOCAL TIME-GATE PROOF", "Exact host-program boundary proof: 34 clock, maturity, cliff, and linear-unlock vectors; four Rust tests and 14 JavaScript tests. No validator transaction, wallet, signing, or broadcast."],
  },
  {
    file: "index.json",
    sha256: null,
    en: ["COMPLETE FILE INDEX", "Every export, including superseded progress snapshots and the historical V1 record, with byte counts and SHA-256 digests."],
  },
];

const progressRecords = [
  {
    state: "PASS",
    label: "OFF-CHAIN SIGNATURE PROOF",
    detail: "The historical Ed25519 signature and frozen request binding verify independently at exact commit hashes. They are not a transaction receipt and do not independently prove the signing device.",
    href: `${PUBLICATION_ROOT}/IAT-B3-DEVNET-HW-PROOF-20260825.json`,
  },
  {
    state: "HOLD",
    label: "RUST HOST TESTS",
    detail: "Reference run 32937913614 failed 3 retained-v2 parity assertions after 50 tests passed. This board stays HOLD until a newer exact public run is bound.",
    href: `${CI_RUN}/job/98082727542`,
  },
  {
    state: "HOLD",
    label: "VERIFIABLE SBF BUILD",
    detail: "No passing current-source artifact is bound on this board. In reference run 32937913614, the deterministic build stopped on the same 3 Rust assertions and upload was skipped.",
    href: `${CI_RUN}/job/98082727557`,
  },
  {
    state: "HOLD",
    label: "MANDATORY LIVE-EVIDENCE GATE",
    detail: "Source-bound live build and runtime receipts plus required direct observers are still absent. The canonical gate remains nonexecuting and nonauthorizing HOLD.",
    href: `${CI_RUN}/job/98082727615`,
  },
  {
    state: "HOLD",
    label: "WINDOWS NON-EVIDENCE SMOKE",
    detail: "Reference run 32937913614 failed closed on a hash-pinned authority-file newline mismatch. The local LF pin still requires fresh public CI verification.",
    href: `${CI_RUN}/job/98082727399`,
  },
  {
    state: "BLOCKED",
    label: "RADIANCE VISUAL CI",
    detail: "Source, preview, and standalone jobs stop at checkout because the repository Git LFS budget is exhausted; their tests never start.",
    href: "https://github.com/InternalAgencyIO/InternalAgency/pull/14/checks",
  },
];

const copy = {
  en: {
    launch: "LAUNCH CONTROL",
    eyebrow: "STAR ASCENT // PUBLIC PROOF BOARD",
    title: <>NO CLAIM<br />WITHOUT PROOF.</>,
    lede: "Historical off-chain signature proof remains independently verifiable at exact hashes. No passing current-source Rust run or verifiable SBF artifact is bound on this board. Mainnet is UNSCHEDULED HOLD until funding and every canonical gate clear.",
    fields: [
      ["Mainnet mint", "HOLD", "No mainnet IAT mint is represented by these Devnet records, and no Mainnet action was performed."],
      ["V2 program", "Devnet live", "Program 62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj is named in both V2 rehearsal records."],
      ["Initialization", "7 / 7", "All seven recorded V2 initialization signatures were observed finalized on devnet."],
      ["Feature progress", "18 TX", "Three stake roles, standard and CCC-linked week-8 settlement outcomes, core APY, liquidity unlock, Switchboard randomness, and two settled CCC draws are recorded."],
      ["Chain receipt", "29 / 29", "Every canonical signature across the published V1 and V2 exports was observed finalized with no reported transaction error."],
      ["Independent review", "Verified", "The operator-relayed FDF Guard approval is published with its evidence bindings and UTC completion time."],
      ["Local time gates", "34 / 34", "Host-only maturity, cliff, and linear-unlock vectors passed without any wallet, signer, validator transaction, or broadcast."],
    ],
    evidence: "CC0 PUBLIC EVIDENCE",
    evidenceTitle: "RAW BYTES. PUBLIC HASHES. NO SECRETS.",
    evidenceLede: "The historical off-chain signature artifacts are frozen at publication commit eb2e59c. The earlier initialization and feature exports describe separate Devnet rehearsal instances, so their mint and configuration addresses differ. None is a Mainnet mint or current-source CI artifact.",
    download: "OPEN JSON",
    hash: "SHA-256",
    github: "OPEN THE GITHUB EVIDENCE DIRECTORY",
    cc0: "CC0 1.0 PUBLIC-DOMAIN DEDICATION",
    scope: "WHAT THIS DOES NOT PROVE",
    scopeTitle: "Publication is not launch approval.",
    scopeBody: "The published signature verifies against the bound public key and frozen request; it does not independently prove hardware provenance, a Devnet transaction, or launch authorization. Current-source Rust/SBF evidence, source-bound live receipts, required direct observers, final Mainnet preflight, funding, and ceremony scheduling are not complete. Mainnet remains UNSCHEDULED HOLD.",
    progress: "CURRENT PUBLIC CHECKPOINT",
    progressTitle: "HISTORICAL PROOF VALID. CURRENT SOURCE HOLD.",
    progressLede: "This board separates completed verification from fail-closed HOLD conditions. A red gate is not relabeled as success.",
    inspect: "INSPECT RECEIPT",
    order: "PUBLICATION ORDER",
    rule: "Sign physically. Verify independently. Publish everywhere together.",
    links: ["RUN OF SHOW", "GENESIS RECORD", "OFFICIAL SIGNAL"],
    guide: "FIELD GUIDE",
    guideLine: "Know the public verification order before Genesis begins.",
    footer: "STAR ASCENT // EVIDENCE BEFORE AMPLIFICATION",
  },
};

export default function ProofPage() {
  const t = copy.en;
  return <main className="proof-page"><div className="proof-stars" aria-hidden="true" /><nav><a href="/">IA<span>///</span></a><a href="/launch">{t.launch} ↗</a></nav>
    <section className="proof-hero">
      <div className="proof-hero-copy"><p>{t.eyebrow}</p><h1>{t.title}</h1><p>{t.lede}</p></div>
      <figure className="proof-portrait">
        <div className="proof-portrait-frame">
          {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
          <img src="/images/radiance-proof-signal-v1.png" width={1120} height={1400} fetchPriority="high" alt="Radiance, a fictional adult signal operator, beside the illuminated Devnet proof beacon" />
          <span className="proof-portrait-scan" aria-hidden="true" />
          <span className="proof-portrait-reticle" aria-hidden="true" />
        </div>
        <figcaption><span>RADIANCE // SIGNAL OPERATOR</span><b>CURRENT SOURCE // HOLD</b></figcaption>
      </figure>
    </section>
    <section className="proof-progress">
      <p>{t.progress}</p><h2>{t.progressTitle}</h2><span>{t.progressLede}</span>
      <div>{progressRecords.map((record)=><article key={record.label} data-state={record.state.toLowerCase()}><b>{record.state}</b><p>{record.label}</p><h3>{record.detail}</h3><a href={record.href} target="_blank" rel="noreferrer">{t.inspect} ↗</a></article>)}</div>
    </section>
    <section className="proof-grid">{t.fields.map(([label,status,detail], index)=><article key={label}><span>0{index + 1}</span><div><p>{label}</p><strong>{status}</strong><small>{detail}</small></div></article>)}</section>
    <section className="proof-evidence">
      <p>{t.evidence}</p>
      <h2>{t.evidenceTitle}</h2>
      <span>{t.evidenceLede}</span>
      <div className="proof-evidence-grid">
        {evidenceRecords.map((record, index) => {
          const [label, detail] = record.en;
          return <article key={record.file}>
            <span>0{index + 1}</span>
            <p>{label}</p>
            <h3>{detail}</h3>
            {record.sha256 && <code><b>{t.hash}</b>{record.sha256}</code>}
            <a href={record.href ?? `${EVIDENCE_ROOT}/${record.file}`} target={record.href ? "_blank" : undefined} rel={record.href ? "noreferrer" : undefined}>{record.action ?? t.download} ↗</a>
          </article>;
        })}
      </div>
      <div className="proof-evidence-links">
        <a href={GITHUB_EVIDENCE} target="_blank" rel="noreferrer">{t.github} ↗</a>
        <a href={`${EVIDENCE_ROOT}/CC0-1.0.md`}>{t.cc0} ↗</a>
      </div>
    </section>
    <section className="proof-scope"><p>{t.scope}</p><h2>{t.scopeTitle}</h2><span>{t.scopeBody}</span></section>
    <section className="proof-rule"><p>{t.order}</p><h2>{t.rule}</h2><div><a href="/launch">{t.links[0]} ↗</a><a href="/dossier/read/genesis-proof">{t.links[1]} ↗</a><a href="/signal">{t.links[2]} ↗</a></div></section>
    <section className="proof-rule"><p>{t.guide}</p><h2>{t.guideLine}</h2><div><a href="/verify">{t.guide} ↗</a></div></section><footer>{t.footer}</footer>
  </main>;
}

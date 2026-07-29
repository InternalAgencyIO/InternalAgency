"use client";

import { FormEvent, useEffect, useState } from "react";
import "./network.css";

type NetworkPayload = {
  network?: {
    status: string;
    networkLabel: string;
    mint: string | null;
    programId: string | null;
    genesisAtUtc: string | null;
  };
  snapshot?: {
    health: string;
    slot: number;
    blockHeight: number;
    epoch: { epoch: number; slotIndex: number; slotsInEpoch: number };
    observedAtUtc: string;
  };
  result?: {
    kind: "address" | "signature";
    address?: string;
    signature?: string;
    explorerUrl: string;
    exists?: boolean;
    found?: boolean;
    sol?: { amount: string };
    iat?: { configured: boolean; accounts: unknown[] };
    positions?: {
      configured: boolean;
      items: Array<{
        address: string;
        positionId: string;
        principalBaseUnits: string;
        paidBaseUnits: string;
        annualRateBps: string;
        role: number;
        closed: boolean;
      }>;
    };
    signatures?: Array<{
      signature: string;
      slot: number;
      blockTime: number | null;
      err: unknown;
      confirmationStatus: string | null;
    }>;
    summary?: {
      slot: number | null;
      blockTimeUtc: string | null;
      succeeded: boolean;
      feeLamports: number | null;
    } | null;
  };
  error?: string;
};

const copy = {
  en: {
    eyebrow: "IAT NETWORK // LIVE SOLANA READOUT",
    title: <>ONE SCREEN.<br /><i>THE WHOLE SIGNAL.</i></>,
    lede: "Track the chain, inspect a wallet or transaction, and see IAT player state without connecting a wallet.",
    hold: "IAT PROGRAM // MAINNET HOLD",
    placeholder: "Wallet, transaction, program, or mint",
    search: "INSPECT",
    chain: "CHAIN PULSE",
    player: "PLAYER VIEW",
    noLookup: "Paste a public Solana address or transaction signature. This is read-only and never asks for a signature.",
    noIat: "IAT mint and program addresses are not published yet. Balances and positions switch on only after verified Genesis evidence.",
    notFound: "No matching on-chain record was found.",
    explorer: "OPEN IN SOLANA EXPLORER",
    recent: "RECENT ACTIVITY",
    positions: "IAT POSITIONS",
    back: "RETURN TO STAR ASCENT",
  },
  tr: {
    eyebrow: "IAT AĞI // CANLI SOLANA OKUMASI",
    title: <>TEK EKRAN.<br /><i>TÜM SİNYAL.</i></>,
    lede: "Cüzdan bağlamadan zinciri izle, cüzdan veya işlemi incele ve IAT oyuncu durumunu gör.",
    hold: "IAT PROGRAMI // MAINNET BEKLET",
    placeholder: "Cüzdan, işlem, program veya mint",
    search: "İNCELE",
    chain: "ZİNCİR NABZI",
    player: "OYUNCU GÖRÜNÜMÜ",
    noLookup: "Kamuya açık bir Solana adresi veya işlem imzası yapıştır. Bu ekran salt okunurdur ve asla imza istemez.",
    noIat: "IAT mint ve program adresleri henüz yayımlanmadı. Bakiye ve pozisyonlar yalnızca doğrulanmış Başlangıç kanıtından sonra açılır.",
    notFound: "Eşleşen zincir üstü kayıt bulunamadı.",
    explorer: "SOLANA EXPLORER'DA AÇ",
    recent: "SON HAREKETLER",
    positions: "IAT POZİSYONLARI",
    back: "STAR ASCENT'E DÖN",
  },
};

const roleName = (role: number) => ["STANDARD", "CCC AGENT", "CCC ASSOCIATE"][role] ?? "UNKNOWN";
const shorten = (value: string) => `${value.slice(0, 7)}…${value.slice(-7)}`;
const iat = (baseUnits: string) => {
  const amount = BigInt(baseUnits);
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""}`;
};

export default function NetworkPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  const [status, setStatus] = useState<NetworkPayload | null>(null);
  const [lookup, setLookup] = useState("");
  const [result, setResult] = useState<NetworkPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.location.hostname.includes("ileriakil")) setLanguage("tr");
    fetch("/api/network").then((response) => response.json()).then(setStatus).catch(() => setStatus({ error: "SOLANA_RPC_UNAVAILABLE" }));
  }, []);

  const inspect = async (event: FormEvent) => {
    event.preventDefault();
    if (!lookup.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/network?q=${encodeURIComponent(lookup.trim())}`);
      setResult(await response.json());
    } catch {
      setResult({ error: "SOLANA_RPC_UNAVAILABLE" });
    } finally {
      setLoading(false);
    }
  };

  const t = copy[language];
  const chain = status?.snapshot;
  const found = result?.result;
  const positions = found?.positions?.items ?? [];
  const signatures = found?.signatures ?? [];

  return <main className="network-page">
    <div className="network-stars" aria-hidden="true" />
    <nav><a href="/">IA<span>///</span></a><a href="/launch">{t.back} ↗</a></nav>
    <section className="network-hero">
      <div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.lede}</span></div>
      <aside>
        <strong><i />{t.hold}</strong>
        <dl>
          <div><dt>NETWORK</dt><dd>{status?.network?.networkLabel ?? "SOLANA MAINNET BETA"}</dd></div>
          <div><dt>PROGRAM</dt><dd>{status?.network?.programId ? shorten(status.network.programId) : "NOT PUBLISHED"}</dd></div>
          <div><dt>MINT</dt><dd>{status?.network?.mint ? shorten(status.network.mint) : "NOT PUBLISHED"}</dd></div>
        </dl>
      </aside>
    </section>

    <section className="network-pulse" aria-labelledby="network-pulse-title">
      <p id="network-pulse-title">{t.chain}</p>
      <div>
        <article><span>01</span><b>{chain?.health === "ok" ? "HEALTHY" : chain ? "DEGRADED" : "SYNCING"}</b><small>RPC HEALTH</small></article>
        <article><span>02</span><b>{chain?.slot?.toLocaleString() ?? "—"}</b><small>CONFIRMED SLOT</small></article>
        <article><span>03</span><b>{chain?.blockHeight?.toLocaleString() ?? "—"}</b><small>FINALIZED HEIGHT</small></article>
        <article><span>04</span><b>{chain?.epoch?.epoch?.toLocaleString() ?? "—"}</b><small>CURRENT EPOCH</small></article>
      </div>
      <small>{chain?.observedAtUtc ? `OBSERVED ${chain.observedAtUtc}` : "READING SOLANA MAINNET…"}</small>
    </section>

    <section className="network-console">
      <div className="network-console-head"><p>{t.player}</p><strong>READ ONLY // NO WALLET CONNECTION</strong></div>
      <form onSubmit={inspect}>
        <label className="sr-only" htmlFor="network-lookup">{t.placeholder}</label>
        <input id="network-lookup" value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder={t.placeholder} autoComplete="off" spellCheck={false} />
        <button type="submit" disabled={loading}>{loading ? "READING…" : t.search} <span>→</span></button>
      </form>

      {!result && <div className="network-empty"><span>◎</span><p>{t.noLookup}</p><strong>{t.noIat}</strong></div>}
      {result?.error && <div className="network-error"><span>!</span><p>{result.error.replaceAll("_", " ")}</p></div>}
      {found && <div className="network-result">
        <header><div><small>{found.kind.toUpperCase()}</small><h2>{shorten(found.address ?? found.signature ?? "")}</h2></div><a href={found.explorerUrl} target="_blank" rel="noreferrer">{t.explorer} ↗</a></header>
        {found.kind === "address" && <>
          <div className="network-wallet-stats">
            <article><small>SOL BALANCE</small><b>{found.sol?.amount ?? "0"}</b></article>
            <article><small>IAT BALANCE</small><b>{found.iat?.configured ? "ON-CHAIN" : "AWAITING GENESIS"}</b></article>
            <article><small>{t.positions}</small><b>{found.positions?.configured ? positions.length : "AWAITING GENESIS"}</b></article>
          </div>
          {positions.length > 0 && <div className="network-list"><p>{t.positions}</p>{positions.map((position) => <article key={position.address}><div><b>#{position.positionId} · {roleName(position.role)}</b><span>{position.closed ? "CLOSED" : "ACTIVE"} · {(Number(position.annualRateBps) / 100).toFixed(0)}%</span></div><strong>{iat(position.principalBaseUnits)} IAT</strong><small>{iat(position.paidBaseUnits)} IAT PAID</small></article>)}</div>}
          <div className="network-list"><p>{t.recent}</p>{signatures.length ? signatures.map((entry) => <a key={entry.signature} href={`https://explorer.solana.com/tx/${entry.signature}`} target="_blank" rel="noreferrer"><div><b>{shorten(entry.signature)}</b><span>{entry.err == null ? "SUCCESS" : "FAILED"} · {entry.confirmationStatus ?? "UNKNOWN"}</span></div><strong>SLOT {entry.slot.toLocaleString()}</strong><small>{entry.blockTime ? new Date(entry.blockTime * 1_000).toISOString() : "TIME UNAVAILABLE"} ↗</small></a>) : <span>{t.notFound}</span>}</div>
        </>}
        {found.kind === "signature" && <div className="network-wallet-stats">
          <article><small>RESULT</small><b>{found.found ? found.summary?.succeeded ? "SUCCESS" : "FAILED" : "NOT FOUND"}</b></article>
          <article><small>SLOT</small><b>{found.summary?.slot?.toLocaleString() ?? "—"}</b></article>
          <article><small>FEE</small><b>{found.summary?.feeLamports?.toLocaleString() ?? "—"} LAMPORTS</b></article>
        </div>}
      </div>}
    </section>
    <footer><span>IAT NETWORK // VERIFIED DATA ONLY</span><a href="/proof">EVIDENCE BOARD ↗</a><a href="/tokenomics">ECONOMIC POLICY ↗</a></footer>
  </main>;
}

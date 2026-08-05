"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "ready" | "staged" | "committed" | "dealt" | "settled";
type Suit = "♠" | "♥" | "♦" | "♣";

type DemoCard = {
  rank: string;
  suit: Suit;
};

type DemoRound = {
  participant: string;
  playerCards: DemoCard[];
  houseCards: DemoCard[];
  playerScore: number;
  houseScore: number;
  outcome: "PLAYER WIN" | "PUSH" | "HOUSE WIN";
  multiplier: -1 | 0 | 1;
  seed: string;
  receipt: string;
};

type DemoReceipt = {
  id: string;
  participant: string;
  outcome: DemoRound["outcome"];
  credits: number;
};

const demoRounds: DemoRound[] = [
  {
    participant: "Nora Vale",
    playerCards: [{ rank: "A", suit: "♠" }, { rank: "8", suit: "♥" }],
    houseCards: [{ rank: "K", suit: "♦" }, { rank: "7", suit: "♣" }],
    playerScore: 19,
    houseScore: 17,
    outcome: "PLAYER WIN",
    multiplier: 1,
    seed: "DEMO-SEED-ALPHA-104",
    receipt: "DLC-DEMO-001",
  },
  {
    participant: "Eli Mercer",
    playerCards: [{ rank: "Q", suit: "♣" }, { rank: "10", suit: "♦" }],
    houseCards: [{ rank: "A", suit: "♥" }, { rank: "9", suit: "♠" }],
    playerScore: 20,
    houseScore: 20,
    outcome: "PUSH",
    multiplier: 0,
    seed: "DEMO-SEED-BRAVO-208",
    receipt: "DLC-DEMO-002",
  },
  {
    participant: "Samira Cole",
    playerCards: [{ rank: "J", suit: "♥" }, { rank: "8", suit: "♣" }],
    houseCards: [{ rank: "K", suit: "♠" }, { rank: "A", suit: "♦" }],
    playerScore: 18,
    houseScore: 21,
    outcome: "HOUSE WIN",
    multiplier: -1,
    seed: "DEMO-SEED-CHARLIE-312",
    receipt: "DLC-DEMO-003",
  },
];

const phaseOrder: Exclude<Phase, "ready">[] = ["staged", "committed", "dealt", "settled"];
const phaseCopy: Record<Phase, string> = {
  ready: "Demo table ready. Choose a simulated stake and run the first round.",
  staged: "Simulated credits staged locally. No value moved.",
  committed: "Preset demo seed committed for the replay walkthrough.",
  dealt: "Preset cards revealed from the deterministic demo script.",
  settled: "Demo result settled and a fictional replay receipt recorded.",
};

function DemoCardView({ card, hidden }: { card: DemoCard; hidden: boolean }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <span className={`demo-card${hidden ? " is-hidden" : ""}${red ? " is-red" : ""}`} role="img" aria-label={hidden ? "Face-down demo card" : `${card.rank} of ${card.suit}`}>
      {hidden ? <i aria-hidden="true">IA</i> : <><b>{card.rank}</b><i aria-hidden="true">{card.suit}</i></>}
    </span>
  );
}

export function CasinoDemo() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [roundIndex, setRoundIndex] = useState(0);
  const [stake, setStake] = useState(100);
  const [balance, setBalance] = useState(5_000);
  const [history, setHistory] = useState<DemoReceipt[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const round = demoRounds[roundIndex];
  const running = phase !== "ready" && phase !== "settled";
  const cardsVisible = phase === "dealt" || phase === "settled";

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function runRound() {
    if (running) return;
    clearTimers();
    const nextIndex = phase === "settled" ? (roundIndex + 1) % demoRounds.length : roundIndex;
    const nextRound = demoRounds[nextIndex];
    const roundStake = stake;
    setRoundIndex(nextIndex);
    setPhase("staged");
    timers.current = [
      setTimeout(() => setPhase("committed"), 550),
      setTimeout(() => setPhase("dealt"), 1_150),
      setTimeout(() => {
        setPhase("settled");
        setBalance((current) => current + (roundStake * nextRound.multiplier));
        setHistory((current) => [{
          id: nextRound.receipt,
          participant: nextRound.participant,
          outcome: nextRound.outcome,
          credits: roundStake * nextRound.multiplier,
        }, ...current].slice(0, 3));
      }, 2_050),
    ];
  }

  function resetDemo() {
    clearTimers();
    setPhase("ready");
    setRoundIndex(0);
    setStake(100);
    setBalance(5_000);
    setHistory([]);
  }

  const phaseIndex = phaseOrder.indexOf(phase as Exclude<Phase, "ready">);

  return (
    <main className="casino-demo" data-no-translate>
      <a className="demo-skip" href="#demo-table">Skip to demo table</a>
      <header className="demo-header">
        <nav aria-label="Casino demo navigation">
          <a className="demo-wordmark" href="/future/casino">IA<span aria-hidden="true">///</span>CASINO</a>
          <div>
            <span>ENGLISH ONLY</span>
            <a href="/future/casino">EXIT DEMO</a>
          </div>
        </nav>
        <div className="demo-alert" role="note">
          <strong>DEMO ONLY</strong>
          <span>SIMULATED CREDITS</span>
          <span>FICTIONAL ADULT PARTICIPANTS</span>
          <span>NO REAL WAGERS</span>
        </div>
        <div className="demo-hero">
          <div className="demo-hero-copy">
            <p>CASINO DLC // FRONT-END WALKTHROUGH</p>
            <h1>SEE THE<br /><i>WHOLE LOOP.</i></h1>
            <span>This interactive mock shows the proposed experience using preset outcomes, fake names, and demo credits. Nothing connects to a wallet, contract, account, payment rail, or live game.</span>
            <a href="#demo-table">RUN THE DEMO ↓</a>
          </div>
          <div className="demo-orbit" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="orbit orbit-three" />
            <div className="demo-chip"><b>DEMO</b><i>NO VALUE</i></div>
          </div>
        </div>
      </header>

      <section className="demo-boundary" aria-labelledby="boundary-title">
        <div>
          <p>WHAT THIS IS</p>
          <h2 id="boundary-title">A working interface prototype.</h2>
          <span>Buttons, transitions, deterministic rounds, balances, and receipts run locally in your browser.</span>
        </div>
        <ul>
          <li><strong>0</strong><span>Accounts created</span></li>
          <li><strong>0</strong><span>Wallet calls</span></li>
          <li><strong>0</strong><span>Network requests</span></li>
          <li><strong>0</strong><span>Real-value outcomes</span></li>
        </ul>
      </section>

      <section className="demo-stage" id="demo-table" aria-labelledby="demo-table-title">
        <div className="demo-stage-heading">
          <div><p>PLAYABLE MOCK // SIGNAL 21</p><h2 id="demo-table-title">One click.<br />Four visible stages.</h2></div>
          <aside role="note"><strong>IMPORTANT</strong> Every card, result, identity, credit, seed, and receipt on this screen is fictional and pre-scripted for demonstration.</aside>
        </div>

        <div className="demo-shell">
          <div className="demo-shell-topbar">
            <div><span className="demo-live-dot" aria-hidden="true" />LOCAL SIMULATION</div>
            <div>TABLE // SIGNAL 21</div>
            <div>ROUND // {String(roundIndex + 1).padStart(2, "0")}</div>
          </div>

          <div className="demo-workspace">
            <aside className="demo-sidebar" aria-label="Demo player and credit controls">
              <div className="demo-profile">
                <span aria-hidden="true">{round.participant.split(" ").map((name) => name[0]).join("")}</span>
                <div><small>FICTIONAL ADULT</small><strong>{round.participant}</strong><i>Demo participant</i></div>
              </div>
              <div className="demo-balance"><span>SIMULATED BALANCE</span><strong>{balance.toLocaleString("en-US")}</strong><small>DEMO CREDITS</small></div>
              <div className="demo-stake">
                <span>SIMULATED STAKE</span>
                <div>
                  <button type="button" onClick={() => setStake((value) => Math.max(25, value - 25))} disabled={running || stake === 25} aria-label="Decrease simulated stake by 25 credits">−</button>
                  <strong>{stake}</strong>
                  <button type="button" onClick={() => setStake((value) => Math.min(250, value + 25))} disabled={running || stake === 250} aria-label="Increase simulated stake by 25 credits">+</button>
                </div>
                <small>Credits have no monetary value.</small>
              </div>
              <button className="demo-run" type="button" onClick={runRound} disabled={running}>{running ? "RUNNING DEMO…" : phase === "settled" ? "RUN NEXT DEMO ROUND" : "RUN DEMO ROUND"}<span aria-hidden="true">→</span></button>
              <button className="demo-reset" type="button" onClick={resetDemo}>RESET DEMO</button>
            </aside>

            <div className={`demo-table phase-${phase}`}>
              <div className="demo-table-glow" aria-hidden="true" />
              <div className="demo-hand house-hand">
                <span>HOUSE // SIMULATED</span>
                <div>{round.houseCards.map((card, index) => <DemoCardView key={`${card.rank}-${card.suit}`} card={card} hidden={!cardsVisible || (index === 1 && phase === "dealt")} />)}</div>
                <strong>{phase === "settled" ? round.houseScore : cardsVisible ? "?" : "—"}</strong>
              </div>
              <div className="demo-table-mark" aria-hidden="true"><span>IA</span><i>DEMO TABLE</i></div>
              <div className="demo-hand player-hand">
                <span>{round.participant.toUpperCase()} // SIMULATED</span>
                <div>{round.playerCards.map((card) => <DemoCardView key={`${card.rank}-${card.suit}`} card={card} hidden={!cardsVisible} />)}</div>
                <strong>{cardsVisible ? round.playerScore : "—"}</strong>
              </div>
              <div className={`demo-result result-${round.multiplier}`} aria-hidden={phase !== "settled"}>
                <span>DEMO RESULT</span><strong>{round.outcome}</strong><i>{round.multiplier === 1 ? `+${stake}` : round.multiplier === -1 ? `−${stake}` : "±0"} demo credits</i>
              </div>
            </div>

            <aside className="demo-proof" aria-label="Demo stage and replay receipt">
              <div className="demo-phase-status" aria-live="polite"><span>CURRENT STATUS</span><strong>{phaseCopy[phase]}</strong></div>
              <ol>
                {phaseOrder.map((item, index) => {
                  const state = phase === "ready" ? "waiting" : index < phaseIndex ? "complete" : index === phaseIndex ? "active" : "waiting";
                  return <li className={`is-${state}`} key={item}><span>0{index + 1}</span><div><strong>{item === "staged" ? "Stage credits" : item === "committed" ? "Commit demo seed" : item === "dealt" ? "Reveal cards" : "Settle + receipt"}</strong><small>{state.toUpperCase()}</small></div></li>;
                })}
              </ol>
              <div className="demo-receipt">
                <span>REPLAY RECEIPT // FICTIONAL</span>
                <dl>
                  <div><dt>ID</dt><dd data-testid="demo-receipt-id">{phase === "settled" ? round.receipt : "PENDING"}</dd></div>
                  <div><dt>SEED</dt><dd>{phase === "committed" || cardsVisible ? round.seed : "HIDDEN"}</dd></div>
                  <div><dt>PLAYER</dt><dd>{round.participant}</dd></div>
                  <div><dt>VALUE</dt><dd>NONE</dd></div>
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="demo-history" aria-labelledby="history-title">
        <div><p>LOCAL SESSION LOG</p><h2 id="history-title">Replay the story,<br />not a transaction.</h2></div>
        <div className="demo-history-list">
          {history.length === 0 ? <p>No demo rounds recorded yet. Run the walkthrough above.</p> : history.map((receipt) => <article key={receipt.id}><span>{receipt.id}</span><strong>{receipt.participant}</strong><i>{receipt.outcome}</i><b>{receipt.credits > 0 ? "+" : ""}{receipt.credits} DEMO</b></article>)}
        </div>
      </section>

      <section className="demo-explainer" aria-labelledby="explainer-title">
        <p>HOW THE PROPOSED UX READS</p>
        <h2 id="explainer-title">Transparent by design.<br />Still only a demo.</h2>
        <div>
          <article><span>01</span><h3>Choose</h3><p>A participant selects an amount. Here it is a local number representing credits with no monetary value.</p></article>
          <article><span>02</span><h3>Observe</h3><p>The interface exposes each conceptual stage instead of hiding the round behind a single loading spinner.</p></article>
          <article><span>03</span><h3>Replay</h3><p>A fictional receipt explains the outcome. It is not signed, published, or evidence of a real system.</p></article>
        </div>
      </section>

      <footer className="demo-footer">
        <div><strong>CASINO DLC // INTERACTIVE DEMO</strong><span>Front-end mock only. No real gameplay, account, deposit, withdrawal, wallet, smart contract, or network operation.</span></div>
        <a href="/future/casino">RETURN TO INACTIVE PREVIEW →</a>
      </footer>
    </main>
  );
}

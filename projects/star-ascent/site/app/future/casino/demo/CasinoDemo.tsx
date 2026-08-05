"use client";

import { useEffect, useRef, useState } from "react";
import { NightflightNarrative } from "./NightflightNarrative";
import { campaignArt as campaignArtManifest, hostForId, hostProfiles, storyForGame } from "./nightflight-narrative.mjs";

type Phase = "ready" | "staged" | "committed" | "revealed" | "settled";
type Suit = "♠" | "♥" | "♦" | "♣";
type Scene = "plinko" | "dice" | "roulette" | "mines" | "keno" | "limbo" | "slots" | "baccarat" | "blackjack" | "crash";
type HostId = "radiance" | "ellie" | "alia" | "ece";

type DemoCard = {
  rank: string;
  suit: Suit;
};

type GameDefinition = {
  id: string;
  order: string;
  name: string;
  scene: Scene;
  participant: string;
  tagline: string;
  instruction: string;
  selection: string;
  outcome: string;
  sceneLabels: {
    pending: string;
    revealed: string;
    settled?: string;
  };
  payoutLabel: string;
  netFactor: number;
  seed: string;
  receipt: string;
  demandSignal: string;
  buildTier: "FOUNDATION" | "ADVANCED";
};

type DemoReceipt = {
  id: string;
  game: string;
  participant: string;
  outcome: string;
  credits: number;
};

type DemoRanking = {
  rank: string;
  participant: string;
  module: string;
  missions: number;
  credits: number;
  badge: string;
};

type HostDefinition = {
  id: HostId;
  name: "Radiance" | "Ellie" | "Alia" | "AI ECE";
  permanent: true;
  fictionalAdult: true;
  callSign: string;
  role: string;
  signal: string;
  tone: "solar" | "sapphire" | "crimson" | "emerald";
  portraitArt: HostPortrait;
  portraitDescription: string;
  signatureCue: string;
  minimumAge: number;
};

type CampaignScene = "signalFourAnchor" | "signalFourTension" | "signalFourRelay" | "signalFourFinale";
type HostPortrait = "portraitRadiance" | "portraitEllie" | "portraitAlia" | "portraitEce";
type CampaignArt = CampaignScene | HostPortrait;

type NightflightStory = {
  id: string;
  gameId: string;
  leadId: HostId;
  participants: readonly HostId[];
  focusIds: readonly HostId[];
  arc: string;
  scene: CampaignScene;
  interaction: string;
  paws: { present: boolean; action: string; beat: string; affectsOutcome: false };
};

const campaignArt = campaignArtManifest as Record<CampaignArt, string>;

const demoRankings: DemoRanking[] = [
  { rank: "01", participant: "Samira Cole", module: "Roulette", missions: 12, credits: 8_420, badge: "ORBIT ACE" },
  { rank: "02", participant: "Jules Carter", module: "Original Slots", missions: 11, credits: 7_960, badge: "REEL PILOT" },
  { rank: "03", participant: "Nora Vale", module: "Plinko", missions: 10, credits: 7_540, badge: "DROP VECTOR" },
  { rank: "04", participant: "Maya Rook", module: "Keno", missions: 9, credits: 6_880, badge: "SIGNAL FINDER" },
  { rank: "05", participant: "Arin Moss", module: "Baccarat", missions: 8, credits: 6_210, badge: "TABLE LEAD" },
  { rank: "06", participant: "Luca Vale", module: "Crash", missions: 7, credits: 5_940, badge: "CUTOFF CREW" },
];

const games: GameDefinition[] = [
  {
    id: "plinko",
    order: "01",
    name: "Plinko",
    scene: "plinko",
    participant: "Nora Vale",
    tagline: "One drop. Every turn replayable.",
    instruction: "Choose a risk lane and watch a preset ball path resolve into one multiplier pocket.",
    selection: "MEDIUM RISK // 12 ROWS",
    outcome: "4.20× LANDING",
    sceneLabels: {
      pending: "A demo Plinko board awaiting its preset drop",
      revealed: "A demo Plinko board with a ball landing in the 4.20 times pocket",
    },
    payoutLabel: "+3.20× net",
    netFactor: 3.2,
    seed: "DEMO-PLINKO-A104",
    receipt: "DLC-PLINKO",
    demandSignal: "145.9M operator-reported 2025 plays",
    buildTier: "FOUNDATION",
  },
  {
    id: "dice",
    order: "02",
    name: "Dice",
    scene: "dice",
    participant: "Eli Mercer",
    tagline: "Set the line. Read the roll.",
    instruction: "Set a roll-under threshold. The preset result misses the line to demonstrate a losing receipt.",
    selection: "ROLL UNDER 71.00",
    outcome: "ROLL 86 // MISS",
    sceneLabels: {
      pending: "A demo Dice interface awaiting its preset roll",
      revealed: "A demo dice roll of 86 missing a roll-under target of 71",
    },
    payoutLabel: "−1.00× net",
    netFactor: -1,
    seed: "DEMO-DICE-B208",
    receipt: "DLC-DICE",
    demandSignal: "174.6M operator-reported 2025 plays",
    buildTier: "FOUNDATION",
  },
  {
    id: "roulette",
    order: "03",
    name: "Roulette",
    scene: "roulette",
    participant: "Samira Cole",
    tagline: "A classic wheel, reduced to one result.",
    instruction: "Place a preset straight-up selection and follow the wheel to its deterministic demo pocket.",
    selection: "STRAIGHT UP // 17",
    outcome: "17 // STRAIGHT HIT",
    sceneLabels: {
      pending: "A European roulette demo wheel awaiting its preset spin",
      revealed: "A European roulette demo wheel resolving to pocket 17",
    },
    payoutLabel: "+35.00× net",
    netFactor: 35,
    seed: "DEMO-ROULETTE-C312",
    receipt: "DLC-ROULETTE",
    demandSignal: "36% UK virtual-table survey participation",
    buildTier: "FOUNDATION",
  },
  {
    id: "mines",
    order: "04",
    name: "Mines",
    scene: "mines",
    participant: "Theo Park",
    tagline: "Open tiles. Stop before danger.",
    instruction: "Reveal a preset run of safe tiles, then cash out before the full fictional mine map appears.",
    selection: "3 MINES // 8 SAFE PICKS",
    outcome: "CASH OUT // SAFE",
    sceneLabels: {
      pending: "A five by five demo Mines grid with its preset map concealed",
      revealed: "A five by five demo Mines grid showing eight preset safe tiles",
      settled: "A five by five demo Mines grid with eight safe tiles and three revealed mines",
    },
    payoutLabel: "+1.12× net",
    netFactor: 1.12,
    seed: "DEMO-MINES-D416",
    receipt: "DLC-MINES",
    demandSignal: "25.5M operator-reported 2025 plays",
    buildTier: "FOUNDATION",
  },
  {
    id: "keno",
    order: "05",
    name: "Keno",
    scene: "keno",
    participant: "Maya Rook",
    tagline: "Pick numbers. Reveal the field.",
    instruction: "Five preset picks meet a ten-number demo draw with four visible matches.",
    selection: "5 PICKS // CLASSIC RISK",
    outcome: "4 HITS // WIN",
    sceneLabels: {
      pending: "A forty-number Keno demo board awaiting its preset draw",
      revealed: "A forty-number Keno demo board showing five picks and four matching draws",
    },
    payoutLabel: "+2.00× net",
    netFactor: 2,
    seed: "DEMO-KENO-E520",
    receipt: "DLC-KENO",
    demandSignal: "61.6M operator-reported 2025 plays",
    buildTier: "FOUNDATION",
  },
  {
    id: "limbo",
    order: "06",
    name: "Limbo",
    scene: "limbo",
    participant: "Lena Ortiz",
    tagline: "Choose a target. Clear the line.",
    instruction: "Commit a 2.00 times target and compare it with a preset 2.40 times result.",
    selection: "TARGET // 2.00×",
    outcome: "2.40× // CLEARED",
    sceneLabels: {
      pending: "A Limbo demo interface awaiting its preset multiplier",
      revealed: "A Limbo demo result of 2.40 times clearing a 2.00 times target",
    },
    payoutLabel: "+1.00× net",
    netFactor: 1,
    seed: "DEMO-LIMBO-F624",
    receipt: "DLC-LIMBO",
    demandSignal: "40.0M operator-reported 2025 plays",
    buildTier: "FOUNDATION",
  },
  {
    id: "slots",
    order: "07",
    name: "Original Slots",
    scene: "slots",
    participant: "Jules Carter",
    tagline: "One original machine. One fixed table.",
    instruction: "Spin a fictional 3 by 3 original reel set with a fixed demo paytable and no licensed content.",
    selection: "3×3 REELS // FIXED TABLE",
    outcome: "TRIPLE SEVEN // WIN",
    sceneLabels: {
      pending: "An original three by three slot demo with all reels concealed",
      revealed: "An original three by three slot demo resolving to three sevens on the center line",
    },
    payoutLabel: "+4.00× net",
    netFactor: 4,
    seed: "DEMO-SLOTS-G728",
    receipt: "DLC-SLOTS",
    demandSignal: "24.4B quarterly UK-regulated spins",
    buildTier: "ADVANCED",
  },
  {
    id: "baccarat",
    order: "08",
    name: "Baccarat",
    scene: "baccarat",
    participant: "Arin Moss",
    tagline: "High-recognition play, automatic rules.",
    instruction: "Back the banker and watch both preset hands resolve without any player decision tree.",
    selection: "BANKER // STANDARD RULES",
    outcome: "BANKER 8 // WIN",
    sceneLabels: {
      pending: "A demo Baccarat table with both preset hands face down",
      revealed: "A demo Baccarat table where the banker wins eight to six",
    },
    payoutLabel: "+0.95× net",
    netFactor: 0.95,
    seed: "DEMO-BACCARAT-H832",
    receipt: "DLC-BACCARAT",
    demandSignal: "Operator-revenue classic",
    buildTier: "ADVANCED",
  },
  {
    id: "blackjack",
    order: "09",
    name: "Blackjack",
    scene: "blackjack",
    participant: "Priya Shaw",
    tagline: "Familiar cards, explicit state.",
    instruction: "A preset stand decision reveals a player 19 against the house 17.",
    selection: "STAND // PLAYER 19",
    outcome: "PLAYER 19 // WIN",
    sceneLabels: {
      pending: "A demo Blackjack table with both preset hands face down",
      revealed: "A demo Blackjack table where player 19 beats house 17",
    },
    payoutLabel: "+1.00× net",
    netFactor: 1,
    seed: "DEMO-BLACKJACK-I936",
    receipt: "DLC-BLACKJACK",
    demandSignal: "27% UK online-table survey participation",
    buildTier: "ADVANCED",
  },
  {
    id: "crash",
    order: "10",
    name: "Crash",
    scene: "crash",
    participant: "Luca Vale",
    tagline: "A rising line with the target locked first.",
    instruction: "Commit a 2.00 times auto-exit before the round; the preset curve crashes later at 2.64 times.",
    selection: "AUTO EXIT // 2.00×",
    outcome: "EXIT 2.00× // CRASH 2.64×",
    sceneLabels: {
      pending: "A Crash demo curve awaiting its preset run with a 2.00 times auto-exit set",
      revealed: "A Crash demo curve automatically exiting at 2.00 times before a 2.64 times crash",
    },
    payoutLabel: "+1.00× net",
    netFactor: 1,
    seed: "DEMO-CRASH-J040",
    receipt: "DLC-CRASH",
    demandSignal: "Crypto-original demand signal",
    buildTier: "ADVANCED",
  },
];

const hosts = hostProfiles as readonly HostDefinition[];

const phaseOrder: Exclude<Phase, "ready">[] = ["staged", "committed", "revealed", "settled"];
const phaseCopy: Record<Phase, string> = {
  ready: "Demo room ready. Choose simulated credits and run the preset round.",
  staged: "Simulated credits staged locally. No value moved.",
  committed: "Preset choice and demo seed committed for the walkthrough.",
  revealed: "Deterministic demo outcome revealed. The animation only replays it.",
  settled: "Demo result settled and a fictional replay receipt recorded.",
};

const blackjackPlayer: DemoCard[] = [{ rank: "A", suit: "♠" }, { rank: "8", suit: "♥" }];
const blackjackHouse: DemoCard[] = [{ rank: "K", suit: "♦" }, { rank: "7", suit: "♣" }];
const baccaratPlayer: DemoCard[] = [{ rank: "4", suit: "♥" }, { rank: "2", suit: "♠" }];
const baccaratBanker: DemoCard[] = [{ rank: "5", suit: "♦" }, { rank: "3", suit: "♣" }];

function DemoCardView({ card, hidden }: { card: DemoCard; hidden: boolean }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <span className={`demo-card${hidden ? " is-hidden" : ""}${red ? " is-red" : ""}`} role="img" aria-label={hidden ? "Face-down demo card" : `${card.rank} of ${card.suit}`}>
      {hidden ? <i aria-hidden="true">IA</i> : <><b>{card.rank}</b><i aria-hidden="true">{card.suit}</i></>}
    </span>
  );
}

function GameScene({ game, revealed, settled }: { game: GameDefinition; revealed: boolean; settled: boolean }) {
  const stateClass = `${revealed ? " is-revealed" : ""}${settled ? " is-settled" : ""}`;
  const sceneLabel = settled && game.sceneLabels.settled
    ? game.sceneLabels.settled
    : revealed
      ? game.sceneLabels.revealed
      : game.sceneLabels.pending;
  if (game.scene === "plinko") {
    return <div className={`game-scene scene-plinko${stateClass}`} role="img" aria-label={sceneLabel}><div className="plinko-board">{Array.from({ length: 45 }, (_, index) => <span className="plinko-peg" key={index} />)}<i className="plinko-ball" /></div><div className="plinko-pockets"><span>0.40×</span><span>1.20×</span><strong>4.20×</strong><span>1.20×</span><span>0.40×</span></div></div>;
  }
  if (game.scene === "dice") {
    return <div className={`game-scene scene-dice${stateClass}`} role="img" aria-label={sceneLabel}><span className="scene-kicker">PRESET ROLL</span><strong className="dice-number">{revealed ? "86" : "—"}</strong><div className="dice-track"><i style={{ left: revealed ? "86%" : "0%" }} /><span style={{ left: "71%" }}>TARGET 71</span></div></div>;
  }
  if (game.scene === "roulette") {
    const pockets = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27];
    return <div className={`game-scene scene-roulette${stateClass}`} role="img" aria-label={sceneLabel}><div className="roulette-wheel">{pockets.map((pocket, index) => <span key={pocket} style={{ transform: `rotate(${index * 30}deg) translateY(-8.5rem)` }}>{pocket}</span>)}<i /><strong>{revealed ? "17" : "?"}</strong></div><small>EUROPEAN // SINGLE ZERO</small></div>;
  }
  if (game.scene === "mines") {
    const safeTiles = new Set([0, 1, 2, 3, 4, 6, 7, 8]);
    const mines = new Set([10, 17, 24]);
    return <div className={`game-scene scene-mines${stateClass}`} role="img" aria-label={sceneLabel}><div className="mines-grid">{Array.from({ length: 25 }, (_, index) => <span className={`${revealed && safeTiles.has(index) ? "is-safe" : ""}${settled && mines.has(index) ? " is-mine" : ""}`} key={index}>{revealed && safeTiles.has(index) ? "✓" : settled && mines.has(index) ? "✦" : ""}</span>)}</div><small>{settled ? "FULL PRESET MAP REVEALED" : "8 SAFE PICKS // CASH OUT READY"}</small></div>;
  }
  if (game.scene === "keno") {
    const picks = new Set([3, 7, 18, 28, 36]);
    const hits = new Set([3, 7, 18, 36]);
    return <div className={`game-scene scene-keno${stateClass}`} role="img" aria-label={sceneLabel}><div className="keno-grid">{Array.from({ length: 40 }, (_, index) => { const number = index + 1; return <span className={`${picks.has(number) ? "is-picked" : ""}${revealed && hits.has(number) ? " is-hit" : ""}`} key={number}>{number}</span>; })}</div><small>5 PICKS // {revealed ? "4 MATCHES" : "DRAW PENDING"}</small></div>;
  }
  if (game.scene === "limbo") {
    return <div className={`game-scene scene-limbo${stateClass}`} role="img" aria-label={sceneLabel}><span className="scene-kicker">DEMO MULTIPLIER</span><strong>{revealed ? "2.40×" : "0.00×"}</strong><div><i style={{ width: revealed ? "80%" : "0%" }} /><span>TARGET 2.00×</span></div></div>;
  }
  if (game.scene === "slots") {
    const symbols = ["◆", "7", "★", "7", "7", "7", "●", "BAR", "◆"];
    return <div className={`game-scene scene-slots${stateClass}`} role="img" aria-label={sceneLabel}><div className="slot-machine"><span>IA ORIGINAL // FIXED DEMO TABLE</span><div>{symbols.map((symbol, index) => <i className={index >= 3 && index <= 5 ? "is-payline" : ""} key={`${symbol}-${index}`}>{revealed ? symbol : "IA"}</i>)}</div></div><small>NO LICENSED ART // NO VARIABLE PAYTABLE</small></div>;
  }
  if (game.scene === "baccarat" || game.scene === "blackjack") {
    const player = game.scene === "baccarat" ? baccaratPlayer : blackjackPlayer;
    const house = game.scene === "baccarat" ? baccaratBanker : blackjackHouse;
    const playerScore = game.scene === "baccarat" ? 6 : 19;
    const houseScore = game.scene === "baccarat" ? 8 : 17;
    return <div className={`game-scene scene-cards${stateClass}`} role="img" aria-label={sceneLabel}><div className="demo-hand"><span>{game.scene === "baccarat" ? "BANKER" : "HOUSE"} // SIMULATED</span><div>{house.map((card) => <DemoCardView key={`${card.rank}-${card.suit}`} card={card} hidden={!revealed} />)}</div><strong>{revealed ? houseScore : "—"}</strong></div><div className="demo-table-mark" aria-hidden="true"><span>IA</span><i>{game.name.toUpperCase()}</i></div><div className="demo-hand"><span>{game.scene === "baccarat" ? "PLAYER" : game.participant.toUpperCase()} // SIMULATED</span><div>{player.map((card) => <DemoCardView key={`${card.rank}-${card.suit}`} card={card} hidden={!revealed} />)}</div><strong>{revealed ? playerScore : "—"}</strong></div></div>;
  }
  return <div className={`game-scene scene-crash${stateClass}`} role="img" aria-label={sceneLabel}><div className="crash-chart"><span className="crash-grid" /><i className="crash-line" /><b className="crash-target">AUTO 2.00×</b><strong>{revealed ? "2.64×" : "1.00×"}</strong></div><small>AUTO TARGET LOCKED BEFORE PRESET REVEAL</small></div>;
}

export function CasinoDemo() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [selectedId, setSelectedId] = useState(games[0].id);
  const [stake, setStake] = useState(100);
  const [balance, setBalance] = useState(5_000);
  const [history, setHistory] = useState<DemoReceipt[]>([]);
  const [runCount, setRunCount] = useState(0);
  const [lightPulse, setLightPulse] = useState(false);
  const [cinemaActive, setCinemaActive] = useState(true);
  const [interactiveReady, setInteractiveReady] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gameStage = useRef<HTMLElement | null>(null);
  const game = games.find((item) => item.id === selectedId) ?? games[0];
  const roll = storyForGame(game.id) as NightflightStory;
  const host = hostForId(roll.leadId) as HostDefinition;
  const running = phase !== "ready" && phase !== "settled";
  const revealed = phase === "revealed" || phase === "settled";

  useEffect(() => {
    setInteractiveReady(true);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function selectGame(id: string) {
    if (running) return;
    clearTimers();
    setSelectedId(id);
    setPhase("ready");
    requestAnimationFrame(() => {
      const stage = gameStage.current;
      if (!stage) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      stage.querySelector<HTMLElement>("#demo-table-title")?.focus({ preventScroll: true });
      stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (!reduceMotion) {
        timers.current.push(setTimeout(() => {
          const { top, bottom } = stage.getBoundingClientRect();
          if (bottom <= 0 || top >= window.innerHeight) stage.scrollIntoView({ behavior: "auto", block: "start" });
        }, 900));
      }
    });
  }

  function runRound() {
    if (running) return;
    clearTimers();
    const roundGame = game;
    const roundStake = stake;
    const nextRun = runCount + 1;
    const delta = Math.round(roundStake * roundGame.netFactor);
    setRunCount(nextRun);
    setPhase("staged");
    timers.current = [
      setTimeout(() => setPhase("committed"), 450),
      setTimeout(() => setPhase("revealed"), 900),
      setTimeout(() => {
        setPhase("settled");
        setBalance((current) => current + delta);
        setHistory((current) => [{
          id: `${roundGame.receipt}-${String(nextRun).padStart(2, "0")}`,
          game: roundGame.name,
          participant: roundGame.participant,
          outcome: roundGame.outcome,
          credits: delta,
        }, ...current].slice(0, 6));
      }, 1_500),
    ];
  }

  function resetDemo() {
    clearTimers();
    setPhase("ready");
    setSelectedId(games[0].id);
    setStake(100);
    setBalance(5_000);
    setHistory([]);
    setRunCount(0);
  }

  const phaseIndex = phaseOrder.indexOf(phase as Exclude<Phase, "ready">);
  const delta = Math.round(stake * game.netFactor);
  const phaseStatus = phase === "settled"
    ? `${game.name}: ${game.outcome}. ${delta > 0 ? "+" : ""}${delta} demo credits. Balance ${balance.toLocaleString("en-US")}.`
    : phaseCopy[phase];

  return (
    <main className={`casino-demo${lightPulse ? " is-pulse-on" : ""}${cinemaActive ? "" : " is-cinema-paused"}`} data-interactive-ready={interactiveReady} data-no-translate>
      <div className="demo-light-wash" aria-hidden="true" />
      <a className="demo-skip" href="#game-lobby">Skip to the ten-game lobby</a>
      <header className="demo-header">
        <nav aria-label="Casino demo navigation">
          <a className="demo-wordmark" href="/future/casino">IA<span aria-hidden="true">///</span>NIGHTFLIGHT</a>
          <div><span>ENGLISH ONLY</span><a href="#demo-leaderboard">DEMO BOARD</a><button className="light-control" type="button" aria-pressed={lightPulse} disabled={!interactiveReady} onClick={() => setLightPulse((enabled) => !enabled)}><i aria-hidden="true" />SAFE PULSE {lightPulse ? "ON" : "OFF"}</button><a href="/future/casino">EXIT DEMO</a></div>
        </nav>
        <div className="demo-alert" role="note">
          <strong>DEMO ONLY</strong><span>SIMULATED CREDITS</span><span>FICTIONAL ADULT HOSTS</span><span>FICTIONAL ADULT PARTICIPANTS</span><span>NO REAL WAGERS</span><span>OPT-IN SAFE LIGHT PULSE</span>
        </div>
        <div className="demo-hero">
          <div className="demo-hero-copy">
            <p>STARSHIP CASINO DLC // DARK-TECHNO NIGHT LAUNCH</p>
            <h1>BOARD THE<br /><i>NIGHTFLIGHT.</i></h1>
            <span>Four adult fashion hosts. Ten preset neon rooms. Fake credits only—no wallet, payment, contract, or live wager.</span>
            <a href="#game-lobby">ENTER THE LAUNCH DECK ↓</a>
          </div>
          <figure className="demo-campaign-hero">
            <img src={campaignArt.signalFourAnchor} alt="Ellie, Radiance, AI ECE, and Alia, four fictional adult crew members, linking hands around a glowing launch crystal while PAWS pounces beside them" fetchPriority="high" />
            <div className="demo-orbit" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><span className="orbit-beam beam-one" /><span className="orbit-beam beam-two" /><div className="demo-chip"><b>10</b><i>LAUNCH MODULES</i></div></div>
            <figcaption>THE SIGNAL FOUR // RADIANCE × ELLIE × ALIA × AI ECE × PAWS</figcaption>
          </figure>
        </div>
      </header>

      <section className="night-crew" aria-labelledby="night-crew-title">
        <div className="night-crew-heading"><p>FICTIONAL ADULT HOSTS // OPAQUE LATEX + LINED LACE COUTURE</p><h2 id="night-crew-title">Meet the flight deck.</h2><span>Linked hands. Shared launch cues. One magnetic four-person constellation.</span></div>
        <div className="host-roster">{hosts.map((item, index) => <article className={`host-card host-${item.tone}`} data-host-id={item.id} key={item.id}><div className="host-card-visual"><span>{item.callSign}</span><img src={campaignArt[item.portraitArt]} alt={item.portraitDescription} loading="lazy" decoding="async" /><i aria-hidden="true" /></div><small>0{index + 1} // {item.role.toUpperCase()}</small><h3>{item.name}</h3><p>{item.signal}</p><strong>PERMANENT FICTIONAL ADULT CREW // {item.signatureCue.toUpperCase()}</strong></article>)}</div>
        <article className="paws-companion"><div><p>PAWS // GOLDEN COPILOT</p><h3>Chaos has four favorite humans.</h3><span>PAWS pounces on crystals, inspects consoles, and dashes through the crew. Sometimes she steals the scene; once, she leaves the four-person finale quiet.</span></div><figure><img src={campaignArt.signalFourRelay} alt="PAWS, a tiny golden fictional kitten, dashing between Radiance, Ellie, AI ECE, and Alia as the four adult crew members form a linked relay" loading="lazy" decoding="async" /><figcaption>DETERMINISTIC COMIC CUE // NEVER CHANGES A DEMO RESULT</figcaption></figure></article>
      </section>

      <section className="nightflight-cinema" aria-labelledby="nightflight-cinema-title">
        <div className="nightflight-cinema-heading">
          <div><p>CAMPAIGN FILM // SOURCE-BOUND MOTION DESIGN</p><h2 id="nightflight-cinema-title">Launch night,<br />four signals.</h2></div>
          <div><span>Four-person launch sequence. Front-end spectacle only.</span><button type="button" aria-pressed={cinemaActive} onClick={() => setCinemaActive((active) => !active)}><i aria-hidden="true" />CINEMA LOOP {cinemaActive ? "ON" : "PAUSED"}</button></div>
        </div>
        <div className="nightflight-cinema-grid">
          <figure className="cinema-frame cinema-frame-live">
            <div className="cinema-frame-media"><img src={campaignArt.signalFourFinale} alt="Radiance, Ellie, AI ECE, and Alia, four fictional adult crew members, standing connected at a glowing arrival beacon" loading="lazy" decoding="async" /><span className="cinema-launch-flare" aria-hidden="true" /><span className="cinema-scanline" aria-hidden="true" /></div>
            <figcaption><strong>01 // ORBITAL LAUNCH FILM</strong><span>Gentle pan-and-zoom motion design from a generated still. Not model-generated live-action video.</span></figcaption>
          </figure>
          <figure className="cinema-frame cinema-frame-anime">
            <div className="cinema-frame-media"><img src={campaignArt.signalFourTension} alt="Radiance holds hands with Ellie while AI ECE holds hands with Alia inside an orbital signal gallery; Ellie carries a sapphire prism and PAWS scouts the foreground" loading="lazy" decoding="async" /><span className="cinema-speedline" aria-hidden="true" /></div>
            <figcaption><strong>02 // SIGNAL-CIPHER TRANSMISSION</strong><span>Two pairwise handholds, a sapphire prism, and PAWS scouting the orbital signal gallery.</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="demo-boundary" aria-labelledby="boundary-title">
        <div><p>MISSION BOUNDARY</p><h2 id="boundary-title">A starship interface prototype.</h2><span>Local preset data. Visible demo flow. Zero real value.</span></div>
        <ul><li><strong>10</strong><span>Playable mock rooms</span></li><li><strong>0</strong><span>Wallet or account calls</span></li><li><strong>0</strong><span>Network round requests</span></li><li><strong>0</strong><span>Real-value outcomes</span></li></ul>
      </section>

      <section className="demo-lobby" id="game-lobby" aria-labelledby="lobby-title">
        <div className="demo-lobby-heading"><div><p>ORBITAL NIGHTCLUB // ENGLISH DEMO</p><h2 id="lobby-title">Choose a module.</h2></div><p>Tap a room. The playable deck opens immediately below.</p></div>
        <div className="game-selector" role="list" aria-label="Ten Casino DLC demo games">
          {games.map((item) => { const itemStory = storyForGame(item.id) as NightflightStory; const itemHost = hostForId(itemStory.leadId) as HostDefinition; return <div role="listitem" key={item.id}><button type="button" aria-pressed={item.id === selectedId} data-testid={`game-${item.id}`} className={item.id === selectedId ? "is-selected" : ""} onClick={() => selectGame(item.id)} disabled={running}><span className="game-selector-art"><img src={campaignArt[itemStory.scene]} alt="" loading="lazy" decoding="async" /><b>{itemHost.name} // {itemStory.paws.action}</b></span><span>{item.order} // {item.buildTier}</span><strong>{item.name}</strong><i>{item.tagline}</i><small>{item.demandSignal}</small><em>OPEN MODULE ↓</em></button></div>; })}
        </div>
        <div className="demo-sources" role="note"><strong>PUBLIC DEMAND REFERENCES</strong><a href="https://stake.us/blog/2025-online-gaming-player-statistics-trends">Stake.us 2025 operator play counts ↗</a><a href="https://www.gamblingcommission.gov.uk/statistics-and-research/publication/market-overview-operator-data-to-june-2025-published-august-2025">UK slots activity ↗</a><a href="https://www.gamblingcommission.gov.uk/about-us/guide/page/online-casino-games-excluding-slots-key-findings">UK non-slot participation survey ↗</a></div>
      </section>

      <section className="demo-stage" id="demo-table" aria-labelledby="demo-table-title" ref={gameStage}>
        <div className="demo-stage-heading"><div><p>NIGHTFLIGHT MODULE // {game.order} {game.name.toUpperCase()}</p><h2 id="demo-table-title" tabIndex={-1} aria-describedby="nightflight-narrative-summary">One vessel.<br />Ten neon missions.</h2></div><aside role="note"><strong>PRESET DEMO</strong> Fictional identities, fake credits, scripted results.</aside></div>
        <div className="demo-shell">
          <div className="demo-shell-topbar"><div><span className="demo-live-dot" aria-hidden="true" />LOCAL NIGHTFLIGHT</div><div>HOST // {host.name.toUpperCase()}</div><div>MISSION // {String(runCount + 1).padStart(2, "0")}</div></div>
          <div className="demo-room-summary"><div><span>{game.order} // {game.buildTier}</span><h3>{game.name}</h3><p>{game.instruction}</p></div><strong>{game.selection}</strong></div>
          <div className="demo-workspace">
            <aside className="demo-sidebar" aria-label="Fictional host, participant, and credit controls">
              <div className={`demo-profile host-profile host-${host.tone}`}><span className="host-thumb"><img key={`${game.id}-host`} src={campaignArt[host.portraitArt]} alt="" loading="lazy" decoding="async" /></span><div><small>{host.callSign} // {host.role.toUpperCase()}</small><strong>{host.name}</strong><i>{host.signal}</i></div></div>
              <div className="demo-passenger"><span>FICTIONAL ADULT PARTICIPANT</span><strong>{game.participant}</strong><small>LOCAL DEMO IDENTITY</small></div>
              <div className="demo-balance"><span>SIMULATED BALANCE</span><strong>{balance.toLocaleString("en-US")}</strong><small>DEMO CREDITS</small></div>
              <div className="demo-stake"><span>SIMULATED STAKE</span><div><button type="button" onClick={() => setStake((value) => Math.max(25, value - 25))} disabled={running || stake === 25} aria-label="Decrease simulated stake by 25 credits">−</button><strong>{stake}</strong><button type="button" onClick={() => setStake((value) => Math.min(250, value + 25))} disabled={running || stake === 250} aria-label="Increase simulated stake by 25 credits">+</button></div><small>Credits have no monetary value.</small></div>
              <button className="demo-run" type="button" onClick={runRound} disabled={running}>{running ? "RUNNING DEMO…" : phase === "settled" ? "REPLAY THIS PRESET" : `RUN ${game.name.toUpperCase()} DEMO`}<span aria-hidden="true">→</span></button>
              <button className="demo-reset" type="button" onClick={resetDemo}>RESET ALL DEMO DATA</button>
            </aside>

            <div className={`demo-table game-${game.scene} phase-${phase}`} data-testid="active-game-scene">
              <img key={`${game.id}-campaign`} className="demo-table-campaign" src={campaignArt[roll.scene]} alt="" loading="lazy" decoding="async" />
              <div className="demo-table-glow" aria-hidden="true" />
              <NightflightNarrative key={roll.id} story={roll} host={host} />
              <GameScene game={game} revealed={revealed} settled={phase === "settled"} />
              <div className={`demo-result ${game.netFactor < 0 ? "result--1" : "result-1"}`} aria-hidden={phase !== "settled"}><span>NIGHTFLIGHT DEMO RESULT</span><strong>{game.outcome}</strong><i>{delta > 0 ? "+" : ""}{delta} demo credits // {game.payoutLabel}</i></div>
            </div>

            <aside className="demo-proof" aria-label="Demo stages and replay receipt">
              <div className="demo-phase-status" role="status" aria-live="polite" aria-atomic="true"><span>CURRENT STATUS</span><strong>{phaseStatus}</strong></div>
              <ol>{phaseOrder.map((item, index) => { const state = phase === "ready" ? "waiting" : index < phaseIndex ? "complete" : index === phaseIndex ? "active" : "waiting"; return <li className={`is-${state}`} key={item}><span>0{index + 1}</span><div><strong>{item === "staged" ? "Stage demo credits" : item === "committed" ? "Commit preset choice" : item === "revealed" ? "Reveal deterministic result" : "Settle + receipt"}</strong><small>{state.toUpperCase()}</small></div></li>; })}</ol>
              <div className="demo-receipt"><span>REPLAY RECEIPT // FICTIONAL</span><dl><div><dt>ID</dt><dd data-testid="demo-receipt-id">{phase === "settled" ? `${game.receipt}-${String(runCount).padStart(2, "0")}` : "PENDING"}</dd></div><div><dt>GAME</dt><dd>{game.name.toUpperCase()}</dd></div><div><dt>SEED</dt><dd>{phase === "committed" || revealed ? game.seed : "HIDDEN"}</dd></div><div><dt>RULE</dt><dd>{game.selection}</dd></div><div><dt>VALUE</dt><dd>NONE</dd></div></dl></div>
            </aside>
          </div>
        </div>
      </section>

      <section className="demo-history" aria-labelledby="history-title"><div><p>LOCAL SESSION LOG</p><h2 id="history-title">Replay the story,<br />not a transaction.</h2></div><div className="demo-history-list">{history.length === 0 ? <p>No demo rounds recorded yet. Choose any room and run its preset walkthrough.</p> : history.map((receipt) => <article key={receipt.id}><span>{receipt.id}</span><strong>{receipt.game}</strong><i>{receipt.participant}</i><b>{receipt.credits > 0 ? "+" : ""}{receipt.credits} DEMO</b></article>)}</div></section>

      <section className="demo-leaderboard" id="demo-leaderboard" aria-labelledby="leaderboard-title">
        <div className="demo-leaderboard-heading"><div><p>FICTIONAL TRAINING BOARD // STATIC DEMO DATA</p><h2 id="leaderboard-title">Crew standings,<br />zero stakes.</h2></div><aside role="note"><strong>DEMO BOARD ONLY</strong><span>FAKE CREDITS</span><span>NO PRIZES</span><span>NO REAL VALUE</span></aside></div>
        <div className="demo-leaderboard-table" role="region" aria-label="Scrollable fictional demo leaderboard" tabIndex={0}>
          <table>
            <caption>Preset Nightflight training standings. These fictional scores never leave this front-end demo.</caption>
            <thead><tr><th scope="col">RANK</th><th scope="col">FICTIONAL ADULT PARTICIPANT</th><th scope="col">MODULE</th><th scope="col">PRESET MISSIONS</th><th scope="col">FAKE CREDITS</th><th scope="col">DEMO BADGE</th></tr></thead>
            <tbody>{demoRankings.map((entry) => <tr key={entry.rank}><td><strong>{entry.rank}</strong></td><th scope="row">{entry.participant}</th><td>{entry.module}</td><td>{entry.missions}</td><td>{entry.credits.toLocaleString("en-US")}</td><td><span>{entry.badge}</span></td></tr>)}</tbody>
          </table>
        </div>
        <p className="demo-leaderboard-note">STATIC PRESENTATION ONLY // No account, profile, competition, prize, persistence, payment, wager, or ranking request exists.</p>
      </section>

      <section className="demo-explainer" aria-labelledby="explainer-title"><p>HOW EVERY ROOM READS</p><h2 id="explainer-title">Result first.<br />Animation second.</h2><div><article><span>01</span><h3>Choose</h3><p>Select a room, a fixed demo rule, and simulated credits. No identity, account, deposit, or wallet exists.</p></article><article><span>02</span><h3>Observe</h3><p>The interface exposes stage, commitment, reveal, and settlement instead of hiding the conceptual flow.</p></article><article><span>03</span><h3>Replay</h3><p>The recorded preset result drives each visual. A fictional receipt explains the round but proves no real system.</p></article></div></section>

      <footer className="demo-footer"><div><strong>STARSHIP NIGHTFLIGHT // TEN-GAME INTERACTIVE DEMO</strong><span>Dark-techno nightlife presentation, opaque latex-and-lined-lace runway couture on fictional adult hosts, and an opt-in low-frequency light pulse. Front-end mock only: no real gameplay, account, deposit, withdrawal, wallet, smart contract, oracle, payment, or network operation.</span></div><a href="/future/casino">RETURN TO INACTIVE PREVIEW →</a></footer>
    </main>
  );
}

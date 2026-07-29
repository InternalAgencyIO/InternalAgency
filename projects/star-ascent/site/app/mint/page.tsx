"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { getAccount, getMint } from "@solana/spl-token";
import config from "./ceremony-config.generated.json";
import {
  AuthorityType,
  EXPECTED_MODEL_T_ADDRESS,
  MINT_SIZE,
  TOKEN_DECIMALS,
  TOKEN_PROGRAM_ID,
  assertCanonicalMetadataAccount,
  buildCreateInitializeMetadataTransaction,
  buildMintAllocationsTransaction,
  buildRevokeAuthorityTransaction,
  classifyCeremonyState,
  deriveAllocationAccounts,
  deriveMetadataAddress,
  isLocalOperatorHost,
} from "./ceremony.mjs";
import "./mint.css";

type Mode = "devnet" | "mainnet-beta";
type PublicAllocation = { name: string; amount: string; owner: string };
type EvidenceRecord = { label: string; signature: string; explorerUrl: string };
type PersistedState = {
  version: 1;
  configurationSha256: string;
  mode: Mode;
  mintAddress: string;
  allocations: PublicAllocation[];
  activeStep: number;
  evidence: EvidenceRecord[];
};
type BackpackProvider = {
  isBackpack?: boolean;
  publicKey?: PublicKey | { toString(): string } | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: PublicKey | { toString(): string } }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

declare global {
  interface Window {
    backpack?: { solana?: BackpackProvider };
  }
}

const STEPS = [
  {
    title: "CREATE + INITIALIZE + METADATA",
    text: "One atomic transaction creates the Original SPL mint, initializes 9 decimals, and creates immutable IAT Metaplex metadata.",
  },
  {
    title: "MINT FIVE ALLOCATIONS",
    text: "Create five distinct associated token accounts and mint the exact 50/20/15/10/5 allocation amounts atomically.",
  },
  {
    title: "REVOKE MINT AUTHORITY",
    text: "After exact supply and destination balances are verified, permanently set mint authority to None.",
  },
  {
    title: "REVOKE FREEZE AUTHORITY",
    text: "Permanently set freeze authority to None, then verify the final mint state.",
  },
] as const;
const expectedSigner = new PublicKey(EXPECTED_MODEL_T_ADDRESS);
const storageKey = `iat-ceremony:${config.configurationSha256}`;
const DEVNET_MINIMUM_BALANCE_LAMPORTS = 30_000_000;

function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function explorerUrl(mode: Mode, kind: "address" | "tx", value: string) {
  const base = `https://explorer.solana.com/${kind}/${value}`;
  return mode === "devnet" ? `${base}?cluster=devnet` : base;
}

function providerPublicKey(provider: BackpackProvider, connected?: { publicKey?: PublicKey | { toString(): string } }) {
  const value = connected?.publicKey ?? provider.publicKey;
  if (!value) throw new Error("Backpack did not return a Solana public key");
  return value instanceof PublicKey ? value : new PublicKey(value.toString());
}

async function getReviewedWallet() {
  const provider = window.backpack?.solana;
  if (!provider) throw new Error("Backpack Solana wallet was not found in this browser.");
  if (provider.isBackpack === false) throw new Error("The detected Solana provider is not Backpack.");
  if (!provider.signTransaction) throw new Error("Backpack must expose signTransaction for local verification.");
  const connected = await provider.connect();
  const publicKey = providerPublicKey(provider, connected);
  if (!publicKey.equals(expectedSigner)) {
    throw new Error(`Connected wallet ${publicKey.toBase58()} does not match the reviewed Model T address.`);
  }
  return { provider, publicKey };
}

async function simulateSignSend({
  connection,
  provider,
  publicKey,
  transaction,
  additionalSigner,
}: {
  connection: Connection;
  provider: BackpackProvider;
  publicKey: PublicKey;
  transaction: Transaction;
  additionalSigner?: Keypair;
}) {
  if (!provider.signTransaction) throw new Error("Backpack signTransaction is unavailable.");
  const latest = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = publicKey;
  transaction.recentBlockhash = latest.blockhash;
  if (additionalSigner) transaction.partialSign(additionalSigner);

  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);

  const signed = await provider.signTransaction(transaction);
  if (additionalSigner) {
    const localSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(additionalSigner.publicKey));
    if (!localSignature?.signature) throw new Error("The one-time mint-account signature is missing.");
  }
  const walletSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(publicKey));
  if (!walletSignature?.signature) throw new Error("The reviewed Model T wallet signature is missing.");
  if (!signed.verifySignatures()) throw new Error("The signed transaction failed local signature verification.");

  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed",
  );
  if (confirmation.value.err) throw new Error(`Confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
  return signature;
}

function assertAuthority(actual: PublicKey | null, expected: PublicKey | null, label: string) {
  if (actual === null && expected === null) return;
  if (actual && expected && actual.equals(expected)) return;
  throw new Error(`${label} does not match the reviewed state`);
}

function safePersistedState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as PersistedState;
  return candidate.version === 1
    && candidate.configurationSha256 === config.configurationSha256
    && ["devnet", "mainnet-beta"].includes(candidate.mode)
    && typeof candidate.mintAddress === "string"
    && Array.isArray(candidate.allocations)
    && Array.isArray(candidate.evidence)
    && Number.isInteger(candidate.activeStep);
}

export default function MintPage() {
  const [hydrated, setHydrated] = useState(false);
  const [localHost, setLocalHost] = useState(false);
  const [mode, setMode] = useState<Mode>("devnet");
  const [connectedAddress, setConnectedAddress] = useState("");
  const [devnetBalanceLamports, setDevnetBalanceLamports] = useState<number | null>(null);
  const [preparedMint, setPreparedMint] = useState<Keypair | null>(null);
  const [mintAddress, setMintAddress] = useState("");
  const [resumeAddress, setResumeAddress] = useState("");
  const [allocations, setAllocations] = useState<PublicAllocation[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [status, setStatus] = useState("HOLD // LOCAL OPERATOR CHECK");
  const [busy, setBusy] = useState(false);
  const mainnetReady = config.status === "READY";

  useEffect(() => {
    const isLocal = isLocalOperatorHost(window.location.hostname);
    setLocalHost(isLocal);
    if (isLocal) {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
        if (safePersistedState(parsed)) {
          setMode(parsed.mode);
          setMintAddress(parsed.mintAddress);
          setResumeAddress(parsed.mintAddress);
          setAllocations(parsed.allocations);
          setActiveStep(parsed.activeStep);
          setEvidence(parsed.evidence);
          setStatus("RESTORED // VERIFY ON-CHAIN STATE BEFORE CONTINUING");
        } else {
          setStatus("DEVNET // EXACT FOUR-TRANSACTION REHEARSAL");
        }
      } catch {
        setStatus("DEVNET // LOCAL STATE WAS IGNORED; START OR RESUME FROM CHAIN");
      }
    } else {
      setStatus("DISABLED // CEREMONY SIGNING IS LOCALHOST-ONLY");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !localHost || !mintAddress) return;
    const publicState: PersistedState = {
      version: 1,
      configurationSha256: config.configurationSha256,
      mode,
      mintAddress,
      allocations,
      activeStep,
      evidence,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(publicState));
  }, [activeStep, allocations, evidence, hydrated, localHost, mintAddress, mode]);

  const configuredAllocations = useMemo(() => {
    if (mode === "devnet") return allocations;
    return config.networks.mainnetBeta.allocations
      .filter((allocation): allocation is typeof allocation & { owner: string } => typeof allocation.owner === "string")
      .map(({ name, amount, owner }) => ({ name, amount, owner }));
  }, [allocations, mode]);

  const expectedSupply = BigInt(
    mode === "devnet"
      ? config.networks.devnet.expectedSupplyBaseUnits
      : config.networks.mainnetBeta.expectedSupplyBaseUnits,
  );

  function reset(nextMode: Mode) {
    if (nextMode === "mainnet-beta" && !mainnetReady) return;
    setMode(nextMode);
    setPreparedMint(null);
    setMintAddress("");
    setResumeAddress("");
    setAllocations([]);
    setActiveStep(0);
    setEvidence([]);
    setDevnetBalanceLamports(null);
    window.localStorage.removeItem(storageKey);
    setStatus(nextMode === "devnet"
      ? "DEVNET // EXACT FOUR-TRANSACTION REHEARSAL"
      : "MAINNET // ALL CANONICAL EVIDENCE GATES READY");
  }

  async function connect() {
    if (!localHost) return;
    setBusy(true);
    setStatus("CONNECTING // VERIFY THE ADDRESS ON THE MODEL T");
    try {
      const { publicKey } = await getReviewedWallet();
      setConnectedAddress(publicKey.toBase58());
      if (mode === "devnet") {
        const connection = new Connection(config.networks.devnet.rpcUrl, "confirmed");
        const balanceLamports = await connection.getBalance(publicKey, "confirmed");
        setDevnetBalanceLamports(balanceLamports);
        if (balanceLamports < DEVNET_MINIMUM_BALANCE_LAMPORTS) {
          setStatus("HOLD // ADD AT LEAST 0.03 DEVNET SOL, THEN CONNECT AGAIN");
          return;
        }
      }
      setStatus("CONNECTED // REVIEWED MODEL T ADDRESS MATCHES");
    } catch (error) {
      setStatus(`STOP // ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function prepareMintAddress() {
    if (!localHost) return;
    const mint = Keypair.generate();
    const devnetOwners = config.networks.devnet.allocations.map(({ name, amount }) => ({
      name,
      amount,
      owner: Keypair.generate().publicKey.toBase58(),
    }));
    setPreparedMint(mint);
    setMintAddress(mint.publicKey.toBase58());
    setResumeAddress(mint.publicKey.toBase58());
    if (mode === "devnet") setAllocations(devnetOwners);
    setStatus("PREPARED // PUBLIC ADDRESSES ONLY; VERIFY BEFORE SIGNING");
  }

  function transactionAllocations() {
    if (configuredAllocations.length !== 5) throw new Error("Exactly five public allocation owners are required");
    return configuredAllocations.map(({ name, amount, owner }) => ({
      name,
      amount: BigInt(amount),
      owner: new PublicKey(owner),
    }));
  }

  async function recoverOnChain() {
    if (!localHost) return;
    const candidate = resumeAddress.trim();
    setBusy(true);
    setStatus("VERIFYING // RECONSTRUCTING CEREMONY STATE FROM CHAIN");
    try {
      const mint = new PublicKey(candidate);
      if (mode === "devnet" && allocations.length !== 5) {
        throw new Error("The five public devnet owners are absent. Import the downloaded public evidence record.");
      }
      const ceremonyAllocations = transactionAllocations();
      const connection = new Connection(
        mode === "devnet" ? config.networks.devnet.rpcUrl : config.networks.mainnetBeta.rpcUrl,
        "confirmed",
      );
      const mintInfo = await connection.getAccountInfo(mint, "confirmed");
      if (!mintInfo) throw new Error("Mint does not exist on the selected network; generate a fresh address.");
      const mintState = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
      const metadataAddress = deriveMetadataAddress(mint);
      const metadataInfo = await connection.getAccountInfo(metadataAddress, "confirmed");
      if (!metadataInfo?.owner.equals(new PublicKey(config.token.metadataProgramId))) {
        throw new Error("Canonical metadata account is missing or owned by the wrong program");
      }
      assertCanonicalMetadataAccount({
        data: metadataInfo.data,
        mint,
        updateAuthority: expectedSigner,
      });
      const accounts = deriveAllocationAccounts({ mint, allocations: ceremonyAllocations });
      const allocationBalances: Record<string, bigint> = {};
      for (const allocation of accounts) {
        const accountInfo = await connection.getAccountInfo(allocation.tokenAccount, "confirmed");
        if (!accountInfo) {
          allocationBalances[allocation.name] = 0n;
          continue;
        }
        const account = await getAccount(connection, allocation.tokenAccount, "confirmed", TOKEN_PROGRAM_ID);
        if (!account.owner.equals(allocation.owner) || !account.mint.equals(mint)) {
          throw new Error(`${allocation.name} token account owner or mint is incorrect`);
        }
        allocationBalances[allocation.name] = account.amount;
      }
      const classified = classifyCeremonyState({
        mintExists: true,
        metadataExists: Boolean(metadataInfo?.owner.equals(new PublicKey(config.token.metadataProgramId))),
        decimals: mintState.decimals,
        supply: mintState.supply,
        mintAuthority: mintState.mintAuthority,
        freezeAuthority: mintState.freezeAuthority,
        expectedAuthority: expectedSigner,
        allocationBalances,
        expectedAllocations: ceremonyAllocations,
        expectedSupply,
      });
      setMintAddress(mint.toBase58());
      setPreparedMint(null);
      setActiveStep(classified.nextStep);
      setStatus(classified.complete
        ? "VERIFIED // ON-CHAIN CEREMONY COMPLETE; INDEPENDENT REVIEW REQUIRED"
        : `RESUMED // NEXT ACTION ${String(classified.nextStep + 1).padStart(2, "0")}`);
    } catch (error) {
      setStatus(`STOP // ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function runStep() {
    if (!localHost) return;
    if (mode === "mainnet-beta" && !mainnetReady) {
      setStatus("STOP // MAINNET EVIDENCE GATES ARE NOT READY");
      return;
    }
    if (activeStep === 0 && !preparedMint) {
      prepareMintAddress();
      return;
    }

    setBusy(true);
    setStatus(`SIMULATING // ${STEPS[activeStep].title}`);
    try {
      const { provider, publicKey } = await getReviewedWallet();
      setConnectedAddress(publicKey.toBase58());
      const connection = new Connection(
        mode === "devnet" ? config.networks.devnet.rpcUrl : config.networks.mainnetBeta.rpcUrl,
        "confirmed",
      );
      const mintKey = new PublicKey(mintAddress);
      const ceremonyAllocations = transactionAllocations();
      let transaction: Transaction;
      let additionalSigner: Keypair | undefined;

      if (activeStep === 0) {
        if (!preparedMint || !preparedMint.publicKey.equals(mintKey)) {
          throw new Error("The one-time mint signer is unavailable. Resume only after creation is confirmed, or generate a fresh mint.");
        }
        const rentLamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE, "confirmed");
        transaction = buildCreateInitializeMetadataTransaction({
          feePayer: publicKey,
          mint: mintKey,
          rentLamports,
        }).transaction;
        additionalSigner = preparedMint;
      } else {
        const mintState = await getMint(connection, mintKey, "confirmed", TOKEN_PROGRAM_ID);
        if (activeStep === 1) {
          if (mintState.supply !== 0n) throw new Error("Mint supply is not zero before the one-time allocation mint");
          assertAuthority(mintState.mintAuthority, publicKey, "Mint authority");
          assertAuthority(mintState.freezeAuthority, publicKey, "Freeze authority");
          transaction = buildMintAllocationsTransaction({
            feePayer: publicKey,
            mint: mintKey,
            authority: publicKey,
            allocations: ceremonyAllocations,
            expectedSupply,
          }).transaction;
        } else if (activeStep === 2) {
          if (mintState.supply !== expectedSupply) throw new Error("Supply is not the exact reviewed total");
          assertAuthority(mintState.mintAuthority, publicKey, "Mint authority");
          transaction = buildRevokeAuthorityTransaction({
            mint: mintKey,
            authority: publicKey,
            authorityType: AuthorityType.MintTokens,
          });
        } else if (activeStep === 3) {
          if (mintState.supply !== expectedSupply) throw new Error("Supply is not the exact reviewed total");
          assertAuthority(mintState.mintAuthority, null, "Mint authority");
          assertAuthority(mintState.freezeAuthority, publicKey, "Freeze authority");
          transaction = buildRevokeAuthorityTransaction({
            mint: mintKey,
            authority: publicKey,
            authorityType: AuthorityType.FreezeAccount,
          });
        } else {
          throw new Error("Ceremony step is out of order");
        }
      }

      setStatus(`MODEL T // REVIEW ${STEPS[activeStep].title}`);
      const signature = await simulateSignSend({
        connection,
        provider,
        publicKey,
        transaction,
        additionalSigner,
      });

      const mintState = await getMint(connection, mintKey, "confirmed", TOKEN_PROGRAM_ID);
      if (activeStep === 0) {
        const metadataInfo = await connection.getAccountInfo(deriveMetadataAddress(mintKey), "confirmed");
        if (
          mintState.decimals !== TOKEN_DECIMALS
          || mintState.supply !== 0n
          || !metadataInfo?.owner.equals(new PublicKey(config.token.metadataProgramId))
        ) throw new Error("Created mint or immutable metadata did not verify");
        assertCanonicalMetadataAccount({
          data: metadataInfo.data,
          mint: mintKey,
          updateAuthority: publicKey,
        });
        assertAuthority(mintState.mintAuthority, publicKey, "Mint authority");
        assertAuthority(mintState.freezeAuthority, publicKey, "Freeze authority");
        setPreparedMint(null);
      } else if (activeStep === 1) {
        if (mintState.supply !== expectedSupply) throw new Error("Mint supply does not equal the exact reviewed total");
        const accounts = deriveAllocationAccounts({ mint: mintKey, allocations: ceremonyAllocations });
        for (const allocation of accounts) {
          const account = await getAccount(connection, allocation.tokenAccount, "confirmed", TOKEN_PROGRAM_ID);
          if (
            !account.owner.equals(allocation.owner)
            || !account.mint.equals(mintKey)
            || account.amount !== allocation.amount
          ) throw new Error(`${allocation.name} allocation failed on-chain verification`);
        }
      } else if (activeStep === 2) {
        assertAuthority(mintState.mintAuthority, null, "Mint authority");
        assertAuthority(mintState.freezeAuthority, publicKey, "Freeze authority");
      } else {
        assertAuthority(mintState.mintAuthority, null, "Mint authority");
        assertAuthority(mintState.freezeAuthority, null, "Freeze authority");
      }

      const record = {
        label: STEPS[activeStep].title,
        signature,
        explorerUrl: explorerUrl(mode, "tx", signature),
      };
      setEvidence((current) => [...current.filter((item) => item.label !== record.label), record]);
      setActiveStep((current) => current + 1);
      setStatus(activeStep === STEPS.length - 1
        ? "VERIFIED // FOUR TRANSACTIONS COMPLETE; INDEPENDENT REVIEW REQUIRED"
        : `CONFIRMED // ${STEPS[activeStep].title}`);
    } catch (error) {
      setStatus(`STOP // ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function downloadEvidence() {
    const payload = {
      version: 1,
      network: mode,
      configurationSha256: config.configurationSha256,
      expectedSigner: EXPECTED_MODEL_T_ADDRESS,
      mint: mintAddress,
      metadataAddress: mintAddress ? deriveMetadataAddress(mintAddress).toBase58() : null,
      allocations: configuredAllocations,
      transactions: evidence,
      exportedAtUtc: new Date().toISOString(),
      independentReviewRequired: true,
      notice: "Public evidence only. This file contains no seed phrase, private key, PIN, or wallet export.",
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `iat-${mode}-ceremony-evidence.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const complete = activeStep >= STEPS.length;
  const devnetFunded = devnetBalanceLamports !== null
    && devnetBalanceLamports >= DEVNET_MINIMUM_BALANCE_LAMPORTS;
  const canAct = hydrated
    && localHost
    && connectedAddress
    && !busy
    && (mode === "mainnet-beta" ? mainnetReady : devnetFunded);

  return (
    <main className="mint-ceremony">
      <header className="mint-hero">
        <p>STAR ASCENT // MODEL T CEREMONY</p>
        <h1>ONE<br />MINT.</h1>
        <div className="mint-hero-copy">
          <strong>{mode === "devnet" ? "DEVNET REHEARSAL" : "MAINNET CEREMONY"}</strong>
          <span>Original SPL · immutable metadata · 9 decimals · fixed supply · four confirmations</span>
        </div>
      </header>

      {!localHost && hydrated && (
        <section className="mint-local-lock" role="alert">
          <strong>PUBLIC HOST // READ-ONLY</strong>
          <p>The signing controls only activate on localhost. This deployed route can never request a wallet connection or transaction signature.</p>
        </section>
      )}

      <section className="mint-rehearsal" aria-labelledby="rehearsal-ready-title">
        <div>
          <p>DEVNET // OPERATOR SCENARIO</p>
          <h2 id="rehearsal-ready-title">COMPLETE THIS<br />BEFORE THE WINDOW.</h2>
          <span>29 JUL 2026 · 14:15:18 UTC / 17:15:18 ISTANBUL</span>
        </div>
        <ol>
          <li><b>01</b><span>Confirm the reviewed public address has at least 0.03 devnet SOL. Use the official faucet only if the live balance check is short.</span></li>
          <li><b>02</b><span>Open this page on localhost, connect Backpack, and confirm the exact address on the Model T.</span></li>
          <li><b>03</b><span>Generate public rehearsal addresses, then simulate, review, sign, and verify each of the four devnet transactions separately.</span></li>
          <li><b>04</b><span>Download the public evidence JSON and give it to an independent verifier. Do not switch to mainnet in the same review session.</span></li>
        </ol>
        <div className="mint-rehearsal-links">
          <a href="https://faucet.solana.com/" target="_blank" rel="noreferrer">OPEN OFFICIAL DEVNET FAUCET ↗</a>
          <a href="https://github.com/InternalAgencyIO/InternalAgency/tree/agent/iat-launch-window/projects/star-ascent/site" target="_blank" rel="noreferrer">REVIEW OPEN-SOURCE CODE ↗</a>
        </div>
      </section>

      <section className="mint-safety" aria-labelledby="mint-safety-title">
        <div>
          <p>NON-NEGOTIABLE</p>
          <h2 id="mint-safety-title">THE DEVICE<br />IS THE FINAL GATE.</h2>
        </div>
        <ul>
          <li>Never enter a seed phrase, PIN, passphrase, private key, or wallet export here.</li>
          <li>Stop if the Model T prompt is unclear, blind, or differs from the reviewed intent.</li>
          <li>Every transaction is simulated and locally signature-checked before submission.</li>
          <li>Mainnet stays locked until every generated source digest and human evidence gate passes.</li>
        </ul>
      </section>

      <section className="mint-control" aria-labelledby="mint-control-title">
        <div className="mint-control-heading">
          <p>NETWORK // SELECTED PATH</p>
          <h2 id="mint-control-title">REHEARSE FIRST.<br />MAINNET LAST.</h2>
        </div>
        <div className="mint-mode-switch" role="group" aria-label="Ceremony network">
          <button className={mode === "devnet" ? "active" : ""} disabled={busy || !localHost} onClick={() => reset("devnet")}>
            DEVNET REHEARSAL
          </button>
          <button
            className={mode === "mainnet-beta" ? "active" : ""}
            disabled={busy || !localHost || !mainnetReady}
            onClick={() => reset("mainnet-beta")}
          >
            MAINNET {mainnetReady ? "READY" : "LOCKED"}
          </button>
        </div>

        {!mainnetReady && (
          <div className="mint-gates" role="status">
            <strong>MAINNET INTERLOCK // {config.blockers.length} OPEN GATES</strong>
            <ul>{config.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
          </div>
        )}

        <div className="mint-wallet">
          <div>
            <span>REVIEWED MODEL T ADDRESS</span>
            <code>{EXPECTED_MODEL_T_ADDRESS}</code>
            <small>
              DEVNET BALANCE // {devnetBalanceLamports === null
                ? "CHECK AFTER CONNECTION"
                : `${(devnetBalanceLamports / 1_000_000_000).toFixed(4)} SOL`}
            </small>
          </div>
          <button disabled={busy || !localHost} onClick={connect}>
            {connectedAddress ? `CONNECTED ${short(connectedAddress)}` : "CONNECT BACKPACK"}
          </button>
        </div>

        <div className="mint-resume">
          <label htmlFor="resume-mint">RESUME FROM PUBLIC MINT ADDRESS</label>
          <div>
            <input
              id="resume-mint"
              value={resumeAddress}
              disabled={busy || !localHost}
              onChange={(event) => setResumeAddress(event.target.value)}
              placeholder="Solana mint public address"
              spellCheck={false}
            />
            <button disabled={busy || !localHost || !resumeAddress.trim()} onClick={recoverOnChain}>VERIFY + RESUME</button>
          </div>
        </div>
      </section>

      <section className="mint-sequence" aria-labelledby="mint-sequence-title">
        <div className="mint-sequence-heading">
          <p>FOUR {mode === "devnet" ? "DEVNET" : "MAINNET"} TRANSACTIONS</p>
          <h2 id="mint-sequence-title">REVIEW.<br />SIGN.<br />VERIFY.</h2>
          <span>{status}</span>
        </div>

        <div className="mint-steps">
          {STEPS.map((step, index) => {
            const record = evidence.find((item) => item.label === step.title);
            const state = index < activeStep ? "complete" : index === activeStep ? "active" : "locked";
            return (
              <article className={state} key={step.title}>
                <div className="mint-step-number">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <span>{state === "complete" ? "CONFIRMED" : state === "active" ? "NEXT ACTION" : "LOCKED"}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  {index === 0 && mintAddress && (
                    <div className="mint-address">
                      <small>MINT PUBLIC ADDRESS</small>
                      <code>{mintAddress}</code>
                      <a href={explorerUrl(mode, "address", mintAddress)} target="_blank" rel="noreferrer">OPEN EXPLORER ↗</a>
                    </div>
                  )}
                  {record && (
                    <a className="mint-evidence-link" href={record.explorerUrl} target="_blank" rel="noreferrer">
                      {short(record.signature)}{" // "}EXPLORER ↗
                    </a>
                  )}
                </div>
                <b aria-hidden="true">{state === "complete" ? "✓" : state === "active" ? "→" : "×"}</b>
              </article>
            );
          })}
        </div>

        {!complete && (
          <div className="mint-action">
            <button disabled={!canAct} onClick={runStep}>
              {busy
                ? "WORKING — DO NOT RELOAD"
                : activeStep === 0 && !preparedMint
                  ? "GENERATE PUBLIC CEREMONY ADDRESSES"
                  : "SIMULATE + REQUEST MODEL T SIGNATURE"}
            </button>
            <p>
              {activeStep === 0 && !preparedMint
                ? "One-time local signers are held only in memory. Only public mint, owner, token-account, and transaction evidence is persisted."
                : "The next click simulates exactly one transaction, then asks Backpack and the Model T for a physical signature."}
            </p>
          </div>
        )}

        {(mintAddress || evidence.length > 0) && (
          <div className="mint-download">
            <button disabled={!localHost} onClick={downloadEvidence}>DOWNLOAD PUBLIC EVIDENCE</button>
            <code>CONFIG {config.configurationSha256}</code>
          </div>
        )}

        {complete && (
          <div className="mint-complete" role="status">
            <strong>TRANSACTION SEQUENCE COMPLETE</strong>
            <p>Do not publish yet. An independent verifier must check metadata, supply, five destinations, both revoked authorities, and every Explorer record.</p>
          </div>
        )}
      </section>

      <footer className="mint-footer">
        <span>LOCAL OPERATOR CEREMONY</span>
        <span>NO AUTOMATIC TRANSACTIONS</span>
        <span>STOP ON ANY MISMATCH</span>
      </footer>
    </main>
  );
}

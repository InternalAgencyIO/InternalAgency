import "./buffer-polyfill.mjs";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Connection,
  PublicKey,
} from "@solana/web3.js";
import {
  assertCanonicalMetadataAccount,
  deriveMetadataAddress,
  isLocalOperatorHost,
} from "../../app/mint/ceremony.mjs";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  createIatV2DeploymentPlan,
} from "../../programs/iat_v2/client.mjs";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  DEVNET_FEATURE_MINT_SEED,
  DEVNET_MINT_SEED,
  IAT_V2_ADMIN_STAGE_ORDER,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  IAT_V2_REHEARSAL_SUPPLY,
  AuthorityType,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  buildActivateTransaction,
  buildCreateMintAndMetadataTransaction,
  buildInitializeConfigTransaction,
  buildInitializeVaultsTransaction,
  buildMintRehearsalAllocationsTransaction,
  buildRevokeV2AuthorityTransaction,
  deriveDeterministicDevnetMint,
  inspectReviewedUpgradeableProgramArtifact,
  parseUpgradeableProgramAccounts,
  parseUpgradeableProgramData,
  parseV2ConfigAccount,
} from "../../programs/iat_v2/instructions.mjs";
import {
  assertIatV2RehearsalAllocationBalances,
} from "../../programs/iat_v2/feature-rehearsal.mjs";
import {
  createTrezorTransactionProvider,
  findTrezorSolanaAccount,
} from "./trezor-provider.mjs";
import {
  decodeOriginalTokenAccountInfo,
  decodeOriginalTokenMintInfo,
} from "./original-token-decode.mjs";
import "./style.css";

const DEVNET_RPC = "https://api.devnet.solana.com";
const SOURCE_COMMIT = "ba88535036da3f3871b65100fc18b655ccfa1d57";
const CONSOLE_PARAMS = new URLSearchParams(window.location.search);
const FEATURE_MODE = CONSOLE_PARAMS.get("mode") === "features";
const UPGRADE_MODE = CONSOLE_PARAMS.get("mode") === "upgrade";
const INSPECTION_MODE = CONSOLE_PARAMS.get("mode") === "inspect";
const ATTENDED_WEEK9_MODE = CONSOLE_PARAMS.get("mode") === "settle-week9";
const MIGRATE_ROUNDS_MODE = CONSOLE_PARAMS.get("mode") === "migrate-rounds";
const FEATURE_GENESIS_OVERRIDE = CONSOLE_PARAMS.get("genesis");
const ACTIVE_MINT_SEED = FEATURE_MODE ? DEVNET_FEATURE_MINT_SEED : DEVNET_MINT_SEED;
const STORAGE_KEY = FEATURE_MODE
  ? `iat-v2-devnet-feature-initialization-evidence/${ACTIVE_MINT_SEED}/v1`
  : "iat-v2-devnet-admin-console-evidence/v1";
const FEATURE_GENESIS_STORAGE_KEY = `iat-v2-feature-genesis-timestamp/${ACTIVE_MINT_SEED}/v3`;
const SECONDS_PER_WEEK = 604_800;
const FEATURE_BOUNDARY_LEAD_SECONDS = 7_200;
const connection = new Connection(DEVNET_RPC, "confirmed");
const FeatureRehearsal = lazy(() => import("./FeatureRehearsal.jsx"));
const ProgramUpgrade = lazy(() => import("./ProgramUpgrade.jsx"));
const AttendedWeek9Settlement = lazy(() => import("./AttendedWeek9Settlement.jsx"));
const LegacyRoundMigration = lazy(() => import("./LegacyRoundMigration.jsx"));
document.documentElement.dataset.iatAdminMode = INSPECTION_MODE
  ? "inspection"
  : UPGRADE_MODE
    ? "upgrade"
    : MIGRATE_ROUNDS_MODE
      ? "migrate-rounds"
    : ATTENDED_WEEK9_MODE
      ? "settle-week9"
      : FEATURE_MODE
        ? "features"
        : "initialization";
document.documentElement.dataset.iatTrezorConnect = "unloaded";
let trezorConnect;
let trezorConnectReady;
const trezorAccounts = new Map();

const STAGE_COPY = [
  {
    title: "Create deterministic mint",
    detail: "Original SPL Token, 9 decimals, immutable Metaplex metadata. The Model T is the only signer.",
  },
  {
    title: "Initialize V2 config",
    detail: "Pins devnet rehearsal mode, genesis time, fixed rehearsal supply, and Switchboard devnet identity.",
  },
  {
    title: "Initialize protocol vaults",
    detail: "Atomically creates four lane states, four lane token vaults, and the stake vault.",
  },
  {
    title: "Mint exact allocations",
    detail: "500 community / 200 treasury / 150 ecosystem / 100 core / 50 liquidity IAT.",
  },
  {
    title: "Revoke mint authority",
    detail: "Permanently prevents any additional IAT from being created.",
  },
  {
    title: "Revoke freeze authority",
    detail: "Permanently removes the SPL freeze control.",
  },
  {
    title: "Activate V2",
    detail: "Verifies supply, authorities, every destination, and reward reservation before activation.",
  },
];

function short(value, edge = 6) {
  if (!value) return "—";
  return `${value.slice(0, edge)}…${value.slice(-edge)}`;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function explorer(kind, value) {
  return `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;
}

function json(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return item.toString();
    if (item instanceof PublicKey) return item.toBase58();
    return item;
  }, 2);
}

async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function initializeTrezorConnect() {
  if (INSPECTION_MODE) throw new Error("Hardware loading is disabled in non-signing inspection mode");
  if (!trezorConnect) {
    const trezorModule = await import("@trezor/connect-web");
    trezorConnect = trezorModule.default;
  }
  const apiAvailable = [
    "init",
    "solanaGetPublicKey",
    "solanaSignTransaction",
  ].every((method) => typeof trezorConnect?.[method] === "function");
  document.documentElement.dataset.iatTrezorConnect = apiAvailable ? "ready" : "missing";
  if (!apiAvailable) {
    throw new Error("Trezor Connect SDK did not load correctly; restart the local Devnet console");
  }
  if (!trezorConnectReady) {
    trezorConnectReady = trezorConnect.init({
      manifest: {
        appName: "Internal Agency IAT V2 Devnet Console",
        appUrl: "https://internalagency.io",
        email: "opensource@internalagency.io",
      },
      coreMode: "auto",
    }).catch((error) => {
      trezorConnectReady = undefined;
      throw error;
    });
  }
  await trezorConnectReady;
  return trezorConnect;
}

async function getHardwareProvider(expectedAddress = IAT_V2_PROGRAM_ADMIN) {
  const connect = await initializeTrezorConnect();
  const cacheKey = expectedAddress.toBase58();
  let account = trezorAccounts.get(cacheKey);
  if (!account) {
    account = await findTrezorSolanaAccount({
      connect,
      expectedAddress,
    });
    trezorAccounts.set(cacheKey, account);
  }
  const publicKey = account.publicKey;
  const provider = createTrezorTransactionProvider({
    connect,
    path: account.path,
    publicKey,
    network: "devnet",
    readGenesisHash: () => connection.getGenesisHash(),
  });
  return { provider, publicKey };
}

function getFeatureGenesisTimestamp() {
  if (FEATURE_GENESIS_OVERRIDE !== null) {
    if (!/^\d+$/.test(FEATURE_GENESIS_OVERRIDE)) {
      throw new Error("Feature Genesis URL override must be an unsigned Unix timestamp");
    }
    const timestamp = BigInt(FEATURE_GENESIS_OVERRIDE);
    localStorage.setItem(FEATURE_GENESIS_STORAGE_KEY, timestamp.toString());
    return timestamp;
  }
  const stored = localStorage.getItem(FEATURE_GENESIS_STORAGE_KEY);
  if (stored && /^-?\d+$/.test(stored)) return BigInt(stored);
  const now = Math.floor(Date.now() / 1000);
  const timestamp = BigInt(now - (8 * SECONDS_PER_WEEK) + FEATURE_BOUNDARY_LEAD_SECONDS);
  localStorage.setItem(FEATURE_GENESIS_STORAGE_KEY, timestamp.toString());
  return timestamp;
}

async function verifyProgramDeployment() {
  const [programInfo, programDataInfo] = await connection.getMultipleAccountsInfo(
    [IAT_V2_PROGRAM_ID, IAT_V2_PROGRAM_DATA_ADDRESS],
    "confirmed",
  );
  if (!programInfo || !programDataInfo) throw new Error("Deployed V2 program accounts are missing");
  if (!programInfo.executable) throw new Error("V2 program account is not executable");
  if (
    !programInfo.owner.equals(BPF_UPGRADEABLE_LOADER_ID)
    || !programDataInfo.owner.equals(BPF_UPGRADEABLE_LOADER_ID)
  ) {
    throw new Error("V2 program is not owned by the upgradeable loader");
  }
  parseUpgradeableProgramAccounts({
    programData: programInfo.data,
    programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
  });
  const parsed = parseUpgradeableProgramData(programDataInfo.data);
  if (!parsed.upgradeAuthority.equals(IAT_V2_PROGRAM_ADMIN)) {
    throw new Error(`Upgrade authority is ${parsed.upgradeAuthority.toBase58()}, not the reviewed Model T`);
  }
  const artifact = await inspectReviewedUpgradeableProgramArtifact({
    programBytes: parsed.programBytes,
    sha256Hex,
  });
  if (!artifact.matchesReviewedArtifact) {
    throw new Error("On-chain program bytes do not match the reviewed verifiable artifact");
  }
  return {
    artifactSha256: artifact.artifactSha256,
    slot: parsed.slot,
    upgradeAuthority: parsed.upgradeAuthority,
    programBytes: artifact.artifactBytes,
    loaderRegionBytes: artifact.loaderRegionBytes,
    loaderZeroPaddingBytes: artifact.loaderPaddingBytes,
  };
}

function assertKey(actual, expected, label) {
  if (!actual.equals(expected)) {
    throw new Error(`${label} is ${actual.toBase58()}, expected ${expected.toBase58()}`);
  }
}

function assertAuthority(actual, expected, label) {
  if (actual === null && expected === null) return;
  if (actual && expected && actual.equals(expected)) return;
  throw new Error(`${label} does not match the reviewed ceremony state`);
}

async function readTokenAccount(address, mint, owner, required) {
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info) {
    if (required) throw new Error(`Required token account ${address.toBase58()} is missing`);
    return null;
  }
  const account = decodeOriginalTokenAccountInfo({
    address,
    info,
    programId: TOKEN_PROGRAM_ID,
  });
  assertKey(account.mint, mint, "Token-account mint");
  assertKey(account.owner, owner, "Token-account authority");
  return account;
}

async function loadChainSnapshot() {
  const mint = await deriveDeterministicDevnetMint({ seed: ACTIVE_MINT_SEED });
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint,
    programId: IAT_V2_PROGRAM_ID,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  const deployment = await verifyProgramDeployment();
  const trackedAddresses = [
    mint,
    deriveMetadataAddress(mint),
    plan.config,
    ...Object.values(plan.lanes).flatMap((lane) => [lane.state, lane.tokenAccount]),
    plan.stakeTokenAccount,
    plan.coreReward,
  ];
  const tracked = await connection.getMultipleAccountsInfo(trackedAddresses, "confirmed");
  const [
    mintInfo,
    metadataInfo,
    configInfo,
    treasuryState,
    treasuryToken,
    ecosystemState,
    ecosystemToken,
    coreState,
    coreToken,
    liquidityState,
    liquidityToken,
    stakeToken,
    coreReward,
  ] = tracked;
  const balanceLamports = await connection.getBalance(IAT_V2_PROGRAM_ADMIN, "confirmed");
  const dependentAccounts = tracked.slice(1).filter(Boolean).length;
  if (!mintInfo) {
    if (dependentAccounts !== 0) throw new Error("Dependent V2 accounts exist before the deterministic mint");
    return {
      mint,
      plan,
      deployment,
      balanceLamports,
      nextStage: 0,
      complete: false,
      supply: 0n,
      active: false,
      config: null,
      balances: null,
    };
  }
  if (!mintInfo.owner.equals(TOKEN_PROGRAM_ID)) throw new Error("Deterministic mint is owned by the wrong program");
  if (!metadataInfo) throw new Error("Atomic immutable metadata is missing for the deterministic mint");
  assertCanonicalMetadataAccount({
    data: metadataInfo.data,
    mint,
    updateAuthority: IAT_V2_PROGRAM_ADMIN,
  });
  const mintState = decodeOriginalTokenMintInfo({
    address: mint,
    info: mintInfo,
    programId: TOKEN_PROGRAM_ID,
  });
  if (mintState.decimals !== 9) throw new Error("V2 mint does not have exactly 9 decimals");

  const lanePairs = [
    [treasuryState, treasuryToken],
    [ecosystemState, ecosystemToken],
    [coreState, coreToken],
    [liquidityState, liquidityToken],
  ];
  for (const [stateInfo, tokenInfo] of lanePairs) {
    if (Boolean(stateInfo) !== Boolean(tokenInfo)) {
      throw new Error("A V2 lane is only partially initialized");
    }
  }
  const initializedLaneCount = lanePairs.filter(([stateInfo]) => Boolean(stateInfo)).length;
  if (![0, 4].includes(initializedLaneCount)) {
    throw new Error(`Only ${initializedLaneCount} of four lane vaults exist`);
  }
  if (initializedLaneCount === 4) {
    for (const [stateInfo, tokenInfo] of lanePairs) {
      if (!stateInfo.owner.equals(IAT_V2_PROGRAM_ID)) throw new Error("Lane state has the wrong owner");
      if (!tokenInfo.owner.equals(TOKEN_PROGRAM_ID)) throw new Error("Lane token account has the wrong owner");
    }
  }
  if (stakeToken && !stakeToken.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error("Stake token account has the wrong owner");
  }

  let config = null;
  if (configInfo) {
    if (!configInfo.owner.equals(IAT_V2_PROGRAM_ID)) throw new Error("V2 config has the wrong program owner");
    config = parseV2ConfigAccount(configInfo.data);
    assertKey(config.admin, IAT_V2_PROGRAM_ADMIN, "Config administrator");
    assertKey(config.mint, mint, "Config mint");
    assertKey(config.tokenProgram, TOKEN_PROGRAM_ID, "Config token program");
    assertKey(
      config.randomnessProgram,
      SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
      "Config randomness program",
    );
    if (!config.rehearsalMode || config.expectedSupply !== IAT_V2_REHEARSAL_SUPPLY) {
      throw new Error("Config is not the exact fixed-supply devnet rehearsal policy");
    }
    if (config.genesisTimestamp > BigInt(Math.floor(Date.now() / 1000))) {
      throw new Error("Config genesis timestamp is in the future");
    }
  }

  const vaultsComplete = initializedLaneCount === 4 && Boolean(stakeToken);
  if (!configInfo) {
    if (initializedLaneCount !== 0 || stakeToken || coreReward) {
      throw new Error("Vault or reward state exists without the V2 config");
    }
    if (mintState.supply !== 0n) throw new Error("Mint has supply before V2 config initialization");
    assertAuthority(mintState.mintAuthority, IAT_V2_PROGRAM_ADMIN, "Mint authority");
    assertAuthority(mintState.freezeAuthority, IAT_V2_PROGRAM_ADMIN, "Freeze authority");
    return {
      mint,
      plan,
      deployment,
      balanceLamports,
      nextStage: 1,
      complete: false,
      supply: mintState.supply,
      active: false,
      config: null,
      balances: null,
    };
  }
  if (!vaultsComplete) {
    if (initializedLaneCount !== 0 || stakeToken) throw new Error("V2 vault initialization is incomplete");
    if (config.laneMask !== 0 || config.stakeVaultInitialized) {
      throw new Error("Config claims vaults that do not exist");
    }
    if (mintState.supply !== 0n) throw new Error("Mint has supply before V2 vault initialization");
    assertAuthority(mintState.mintAuthority, IAT_V2_PROGRAM_ADMIN, "Mint authority");
    assertAuthority(mintState.freezeAuthority, IAT_V2_PROGRAM_ADMIN, "Freeze authority");
    return {
      mint,
      plan,
      deployment,
      balanceLamports,
      nextStage: 2,
      complete: false,
      supply: mintState.supply,
      active: false,
      config,
      balances: null,
    };
  }
  if (config.laneMask !== 0b1_1110 || !config.stakeVaultInitialized) {
    throw new Error("Config vault mask does not match the complete on-chain vault inventory");
  }
  assertKey(config.stakeTokenAccount, plan.stakeTokenAccount, "Config stake vault");

  const laneAccounts = {};
  for (const [name, allocation] of Object.entries(plan.allocationDestinations)) {
    laneAccounts[name] = await readTokenAccount(
      allocation.tokenAccount,
      mint,
      allocation.owner,
      mintState.supply !== 0n || name !== "community",
    );
  }
  const stake = await readTokenAccount(
    plan.stakeTokenAccount,
    mint,
    plan.vaultAuthority,
    true,
  );
  if (stake.amount !== config.stakedPrincipal) {
    throw new Error("Stake-vault balance does not match config staked principal");
  }
  const balances = Object.fromEntries(
    Object.entries(laneAccounts).map(([name, account]) => [name, account?.amount ?? 0n]),
  );

  if (mintState.supply === 0n) {
    if (Object.values(balances).some((amount) => amount !== 0n)) {
      throw new Error("Allocation token balance exists before the reviewed mint step");
    }
    assertAuthority(mintState.mintAuthority, IAT_V2_PROGRAM_ADMIN, "Mint authority");
    assertAuthority(mintState.freezeAuthority, IAT_V2_PROGRAM_ADMIN, "Freeze authority");
    return {
      mint,
      plan,
      deployment,
      balanceLamports,
      nextStage: 3,
      complete: false,
      supply: mintState.supply,
      active: false,
      config,
      balances,
    };
  }
  if (mintState.supply !== IAT_V2_REHEARSAL_SUPPLY) {
    throw new Error(`Mint supply is ${mintState.supply}, not ${IAT_V2_REHEARSAL_SUPPLY}`);
  }
  assertIatV2RehearsalAllocationBalances({
    balances,
    allocationDestinations: plan.allocationDestinations,
    active: config.active,
  });
  if (mintState.mintAuthority) {
    assertAuthority(mintState.mintAuthority, IAT_V2_PROGRAM_ADMIN, "Mint authority");
    assertAuthority(mintState.freezeAuthority, IAT_V2_PROGRAM_ADMIN, "Freeze authority");
    if (config.active || coreReward) throw new Error("V2 activated before authority revocation");
    return {
      mint,
      plan,
      deployment,
      balanceLamports,
      nextStage: 4,
      complete: false,
      supply: mintState.supply,
      active: false,
      config,
      balances,
    };
  }
  if (mintState.freezeAuthority) {
    assertAuthority(mintState.freezeAuthority, IAT_V2_PROGRAM_ADMIN, "Freeze authority");
    if (config.active || coreReward) throw new Error("V2 activated before freeze-authority revocation");
    return {
      mint,
      plan,
      deployment,
      balanceLamports,
      nextStage: 5,
      complete: false,
      supply: mintState.supply,
      active: false,
      config,
      balances,
    };
  }
  if (!config.active) {
    if (coreReward) throw new Error("Core reward exists before activation");
    return {
      mint,
      plan,
      deployment,
      balanceLamports,
      nextStage: 6,
      complete: false,
      supply: mintState.supply,
      active: false,
      config,
      balances,
    };
  }
  if (!coreReward || !coreReward.owner.equals(IAT_V2_PROGRAM_ID)) {
    throw new Error("Active config is missing the program-owned core reward record");
  }
  return {
    mint,
    plan,
    deployment,
    balanceLamports,
    nextStage: 7,
    complete: true,
    supply: mintState.supply,
    active: true,
    config,
    balances,
  };
}

async function buildStageTransaction(stage, snapshot) {
  switch (stage) {
    case 0: {
      const rentLamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE, "confirmed");
      return (await buildCreateMintAndMetadataTransaction({
        rentLamports,
        seed: ACTIVE_MINT_SEED,
      })).transaction;
    }
    case 1:
      return buildInitializeConfigTransaction({
        mint: snapshot.mint,
        rehearsalGenesisTimestamp: FEATURE_MODE
          ? getFeatureGenesisTimestamp()
          : BigInt(Math.floor(Date.now() / 1000) - 2),
      });
    case 2:
      return buildInitializeVaultsTransaction({ mint: snapshot.mint });
    case 3:
      return buildMintRehearsalAllocationsTransaction({ mint: snapshot.mint }).transaction;
    case 4:
      return buildRevokeV2AuthorityTransaction({
        mint: snapshot.mint,
        authorityType: AuthorityType.MintTokens,
      });
    case 5:
      return buildRevokeV2AuthorityTransaction({
        mint: snapshot.mint,
        authorityType: AuthorityType.FreezeAccount,
      });
    case 6:
      return buildActivateTransaction({ mint: snapshot.mint });
    default:
      throw new Error("No unsigned action remains");
  }
}

function loadEvidence() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry) => (
      typeof entry?.stage === "string"
      && typeof entry?.signature === "string"
      && typeof entry?.messageSha256 === "string"
      && typeof entry?.confirmedAtUtc === "string"
    ));
  } catch {
    return [];
  }
}

function App() {
  const local = isLocalOperatorHost(window.location.hostname);
  const [snapshot, setSnapshot] = useState(null);
  const [connected, setConnected] = useState("");
  const [pending, setPending] = useState(null);
  const [evidence, setEvidence] = useState(loadEvidence);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    INSPECTION_MODE
      ? "INSPECTION ONLY // NETWORK, HARDWARE, SIGNING, BROADCAST DISABLED"
      : local ? "VERIFYING DEPLOYMENT // NO SIGNING YET" : "DISABLED // LOCALHOST ONLY",
  );
  const [error, setError] = useState("");

  async function refresh() {
    if (INSPECTION_MODE) return null;
    setBusy(true);
    setError("");
    setStatus("VERIFYING CHAIN // PROGRAM, AUTHORITY, MINT, VAULTS");
    try {
      const next = await loadChainSnapshot();
      setSnapshot(next);
      setStatus(next.complete
        ? "DEVNET V2 ACTIVE // EXPORT SOURCE-BOUND AUTOMATED EVIDENCE"
        : `READY // STAGE ${next.nextStage + 1} OF 7`);
      return next;
    } catch (caught) {
      setSnapshot(null);
      setStatus("HOLD // CHAIN VERIFICATION FAILED");
      setError(errorText(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!local || INSPECTION_MODE) return;
    refresh().catch(() => {});
  }, [local]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evidence));
  }, [evidence]);

  async function connect() {
    if (INSPECTION_MODE) return;
    setBusy(true);
    setError("");
    setStatus("CONNECTING // CONFIRM THE MODEL T ADDRESS");
    try {
      const { publicKey } = await getHardwareProvider();
      setConnected(publicKey.toBase58());
      const next = await loadChainSnapshot();
      setSnapshot(next);
      setStatus("HARDWARE MATCH // REVIEW THE NEXT STAGE");
    } catch (caught) {
      setStatus("HOLD // WALLET CHECK FAILED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function simulateAndSign() {
    if (INSPECTION_MODE || !local || !connected || pending) return;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("SIMULATING // NOTHING WILL BE BROADCAST");
    try {
      const current = await loadChainSnapshot();
      setSnapshot(current);
      if (current.complete) throw new Error("Devnet V2 is already active");
      const { provider, publicKey } = await getHardwareProvider();
      const transaction = await buildStageTransaction(current.nextStage, current);
      const latest = await connection.getLatestBlockhash("confirmed");
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = latest.blockhash;
      const wireSize = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).length;
      if (wireSize > 1232) throw new Error(`Transaction is ${wireSize} bytes, above Solana's limit`);
      const messageSha256 = await sha256Hex(transaction.serializeMessage());
      const simulation = await connection.simulateTransaction(transaction);
      setLogs(simulation.value.logs ?? []);
      if (simulation.value.err) {
        throw new Error(`Simulation failed: ${json(simulation.value.err)}`);
      }
      setStatus("MODEL T // REVIEW AND SIGN; STILL NOT BROADCAST");
      const signed = await provider.signTransaction(transaction);
      const signedMessageSha256 = await sha256Hex(signed.serializeMessage());
      if (signedMessageSha256 !== messageSha256) {
        throw new Error("Wallet changed the reviewed transaction message");
      }
      const walletSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(publicKey));
      if (!walletSignature?.signature) throw new Error("Reviewed Model T signature is missing");
      if (!signed.verifySignatures()) throw new Error("Hardware-signed transaction failed local verification");
      setPending({
        stageIndex: current.nextStage,
        stage: IAT_V2_ADMIN_STAGE_ORDER[current.nextStage],
        signed,
        messageSha256,
        latest,
        wireSize,
      });
      setStatus("SIGNED // NOT BROADCAST — REVIEW THEN PRESS BROADCAST");
    } catch (caught) {
      setStatus("HOLD // SIGNING PREPARATION STOPPED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function broadcastSigned() {
    if (INSPECTION_MODE || !pending || busy) return;
    setBusy(true);
    setError("");
    setStatus("BROADCASTING USER-APPROVED SIGNED TRANSACTION");
    try {
      const signature = await connection.sendRawTransaction(pending.signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: pending.latest.blockhash,
          lastValidBlockHeight: pending.latest.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(`Confirmation failed: ${json(confirmation.value.err)}`);
      }
      const record = {
        stage: pending.stage,
        stageIndex: pending.stageIndex,
        signature,
        messageSha256: pending.messageSha256,
        explorerUrl: explorer("tx", signature),
        confirmedAtUtc: new Date().toISOString(),
      };
      setEvidence((current) => [
        ...current.filter((entry) => entry.stage !== record.stage),
        record,
      ].sort((a, b) => a.stageIndex - b.stageIndex));
      setPending(null);
      const next = await loadChainSnapshot();
      setSnapshot(next);
      setStatus(next.complete
        ? "DEVNET V2 ACTIVE // EXPORT SOURCE-BOUND AUTOMATED EVIDENCE"
        : `CONFIRMED // NEXT IS STAGE ${next.nextStage + 1} OF 7`);
    } catch (caught) {
      setStatus("HOLD // BROADCAST OR CONFIRMATION FAILED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  function discardSigned() {
    setPending(null);
    setStatus("SIGNED TRANSACTION DISCARDED // NOTHING BROADCAST");
  }

  function downloadEvidence() {
    if (!snapshot) return;
    const payload = {
      schema: "iat-v2-devnet-rehearsal-evidence/v1",
      status: snapshot.complete ? "DEVNET_ACTIVE_PENDING_AUTOMATED_DIRECT_EVIDENCE" : "INCOMPLETE",
      network: "devnet",
      rpc: DEVNET_RPC,
      sourceCommit: SOURCE_COMMIT,
      programId: IAT_V2_PROGRAM_ID,
      programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
      artifactSha256: snapshot.deployment.artifactSha256,
      programBytes: snapshot.deployment.programBytes,
      programDataRegionBytes: snapshot.deployment.loaderRegionBytes,
      loaderZeroPaddingBytes: snapshot.deployment.loaderZeroPaddingBytes,
      deploymentSlot: snapshot.deployment.slot,
      upgradeAuthority: snapshot.deployment.upgradeAuthority,
      expectedHardwareSigner: IAT_V2_PROGRAM_ADMIN,
      rehearsalScope: FEATURE_MODE ? "BACKDATED_FEATURE_INSTANCE_INITIALIZATION" : "PRIMARY_INITIALIZATION",
      deterministicMintSeed: ACTIVE_MINT_SEED,
      mint: snapshot.mint,
      metadata: deriveMetadataAddress(snapshot.mint),
      config: snapshot.plan.config,
      vaultAuthority: snapshot.plan.vaultAuthority,
      stakeVault: snapshot.plan.stakeTokenAccount,
      coreReward: snapshot.plan.coreReward,
      allocations: snapshot.plan.allocationDestinations,
      onChainSupply: snapshot.supply,
      onChainConfig: snapshot.config,
      transactions: evidence,
      exportedAtUtc: new Date().toISOString(),
      mainnetStatus: "HOLD",
      automatedDirectEvidenceRequired: true,
      humanReviewerRequired: false,
      noSelfAttestation: true,
      secretMaterialIncluded: false,
    };
    const blob = new Blob([`${json(payload)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = FEATURE_MODE
      ? "iat-v2-devnet-feature-initialization-evidence.json"
      : "iat-v2-devnet-rehearsal-evidence.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const nextStage = snapshot?.nextStage ?? 0;
  const addressRows = useMemo(() => {
    if (!snapshot) return [];
    return [
      ["MINT", snapshot.mint],
      ["CONFIG", snapshot.plan.config],
      ["VAULT AUTHORITY", snapshot.plan.vaultAuthority],
      ["COMMUNITY ATA", snapshot.plan.allocationDestinations.community.tokenAccount],
      ["TREASURY", snapshot.plan.lanes.treasury.tokenAccount],
      ["ECOSYSTEM", snapshot.plan.lanes.ecosystem.tokenAccount],
      ["CORE TEAM", snapshot.plan.lanes.coreTeam.tokenAccount],
      ["LIQUIDITY", snapshot.plan.lanes.liquidity.tokenAccount],
      ["STAKE", snapshot.plan.stakeTokenAccount],
    ];
  }, [snapshot]);

  return (
    <main className="console-shell">
      <aside className="rail">
        <a className="mark" href="https://internalagency.io/network" target="_blank" rel="noreferrer">
          IA<span>///</span>
        </a>
        <div className="rail-copy">
          <b>V2</b>
          <span>DEVNET</span>
          <span>LOCAL</span>
        </div>
        <div className="network-light"><i /> SOLANA DEVNET</div>
      </aside>

      <section className="workspace">
        <header className="hero">
          <div>
            <p>HARDWARE CEREMONY // {FEATURE_MODE ? "FEATURE REHEARSAL INSTANCE" : "REHEARSAL ONLY"}</p>
            <h1>{FEATURE_MODE ? "REHEARSE" : "INITIALIZE"}<br /><em>{FEATURE_MODE ? "THE SYSTEM." : "THE NETWORK."}</em></h1>
          </div>
          <div className="hero-state">
            <span>MAINNET</span>
            <strong>HOLD</strong>
            <small>No mainnet endpoint or action exists in this console.</small>
          </div>
        </header>

        {!local && (
          <div className="fatal" role="alert">
            <strong>PUBLIC HOST BLOCKED</strong>
            <span>This console only operates on localhost or 127.0.0.1.</span>
          </div>
        )}

        {INSPECTION_MODE && (
          <div className="fatal" role="status">
            <strong>NON-SIGNING INSPECTION MODE</strong>
            <span>RPC reads, hardware loading, simulation, signing, and broadcast are disabled.</span>
          </div>
        )}

        <section className="attestation">
          <div>
            <small>CHAIN ATTESTATION</small>
            <strong>{snapshot ? "MATCH" : "CHECKING"}</strong>
          </div>
          <dl>
            <div><dt>PROGRAM</dt><dd>{short(IAT_V2_PROGRAM_ID.toBase58(), 8)}</dd></div>
            <div><dt>ARTIFACT</dt><dd>{short(snapshot?.deployment.artifactSha256 ?? IAT_V2_PROGRAM_ARTIFACT_SHA256, 8)}</dd></div>
            <div><dt>UPGRADE AUTHORITY</dt><dd>{short(snapshot?.deployment.upgradeAuthority?.toBase58() ?? IAT_V2_PROGRAM_ADMIN.toBase58(), 8)}</dd></div>
            <div><dt>MODEL T BALANCE</dt><dd>{snapshot ? `${(snapshot.balanceLamports / 1e9).toFixed(4)} SOL` : "—"}</dd></div>
          </dl>
          <a href={explorer("address", IAT_V2_PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
            OPEN PROGRAM ↗
          </a>
        </section>

        <section className="command">
          <div className="command-status">
            <small>OPERATOR STATUS</small>
            <strong>{status}</strong>
            {error && <p role="alert">{error}</p>}
          </div>
          <div className="command-actions">
            {FEATURE_MODE && snapshot?.complete ? (
              <strong>USE THE EXACT-SIGNER ACTION BELOW</strong>
            ) : (
              <>
                <button className="quiet" onClick={() => refresh().catch(() => {})} disabled={busy || !local || INSPECTION_MODE}>
                  REFRESH CHAIN
                </button>
                <button className="connect" onClick={connect} disabled={busy || !local || INSPECTION_MODE}>
                  {connected ? `MODEL T ${short(connected)}` : "CONNECT MODEL T DIRECTLY"}
                </button>
              </>
            )}
          </div>
        </section>

        <section className="sequence">
          <div className="section-head">
            <div>
              <p>SEVEN TRANSACTIONS // ONE-WAY GATES // {FEATURE_MODE ? "SEPARATE BACKDATED MINT" : "PRIMARY INSTANCE"}</p>
              <h2>SIMULATE. SIGN.<br />BROADCAST YOURSELF.</h2>
            </div>
            <span>{snapshot?.complete ? "7 / 7" : `${Math.min(nextStage, 7)} / 7`}</span>
          </div>

          <div className="stage-list">
            {STAGE_COPY.map((stage, index) => {
              const record = evidence.find((entry) => entry.stageIndex === index);
              const state = index < nextStage ? "complete" : index === nextStage ? "active" : "locked";
              return (
                <article className={`stage ${state}`} key={stage.title}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div>
                    <small>{state === "complete" ? "CONFIRMED" : state === "active" ? "NEXT" : "LOCKED"}</small>
                    <h3>{stage.title}</h3>
                    <p>{stage.detail}</p>
                    {record && (
                      <a href={record.explorerUrl} target="_blank" rel="noreferrer">
                        {short(record.signature, 8)} ↗
                      </a>
                    )}
                  </div>
                  <i>{state === "complete" ? "✓" : state === "active" ? "→" : "·"}</i>
                </article>
              );
            })}
          </div>

          {!snapshot?.complete && (
            <div className="sign-panel">
              <div>
                <small>NEXT HARDWARE REQUEST</small>
                <strong>{STAGE_COPY[nextStage]?.title ?? "VERIFY CHAIN"}</strong>
                <p>First click simulates and signs only. It cannot broadcast. A separate second click is required.</p>
              </div>
              {!pending ? (
                <button
                  onClick={simulateAndSign}
                  disabled={busy || !local || !connected || !snapshot || INSPECTION_MODE}
                >
                  {busy ? "VERIFYING…" : "SIMULATE + REQUEST MODEL T SIGNATURE"}
                </button>
              ) : (
                <div className="broadcast-panel">
                  <code>MESSAGE {short(pending.messageSha256, 10)}</code>
                  <code>{pending.wireSize} BYTES // SIGNATURE VERIFIED</code>
                  <button onClick={broadcastSigned} disabled={busy || INSPECTION_MODE}>BROADCAST SIGNED DEVNET TRANSACTION</button>
                  <button className="discard" onClick={discardSigned} disabled={busy}>DISCARD WITHOUT BROADCAST</button>
                </div>
              )}
            </div>
          )}
        </section>

        {FEATURE_MODE && snapshot?.complete && (
          <FeatureRehearsal
            baseSnapshot={snapshot}
            explorer={explorer}
            getHardwareProvider={getHardwareProvider}
            json={json}
            sha256Hex={sha256Hex}
            short={short}
          />
        )}

        <section className="inventory">
          <div className="section-head compact">
            <div>
              <p>DERIVED PUBLIC INVENTORY</p>
              <h2>NO SECRET KEYS.</h2>
            </div>
            <a href={snapshot ? explorer("address", snapshot.mint.toBase58()) : "#"} target="_blank" rel="noreferrer">
              MINT EXPLORER ↗
            </a>
          </div>
          <div className="address-grid">
            {addressRows.map(([label, address]) => (
              <div key={label}>
                <span>{label}</span>
                <code>{address.toBase58()}</code>
              </div>
            ))}
          </div>
        </section>

        {logs.length > 0 && (
          <details className="logs">
            <summary>LAST SIMULATION LOGS // {logs.length} LINES</summary>
            <pre>{logs.join("\n")}</pre>
          </details>
        )}

        <section className="evidence">
          <div>
            <small>PUBLIC PROOF</small>
            <strong>{evidence.length} / 7 TRANSACTIONS RECORDED</strong>
            <p>Export contains addresses, hashes, state, and Explorer links—never wallet secrets.</p>
          </div>
          <button onClick={downloadEvidence} disabled={!snapshot || evidence.length === 0}>
            DOWNLOAD EVIDENCE JSON
          </button>
        </section>

        <footer>
          <span>SOURCE {SOURCE_COMMIT.slice(0, 12)}</span>
          <span>{INSPECTION_MODE ? "RPC // DISABLED" : "RPC // DEVNET ONLY"}</span>
          <span>AUTOMATED RECEIPT VERIFICATION REQUIRED</span>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <Suspense fallback={<main className="console-shell"><strong>LOADING LOCAL CONSOLE...</strong></main>}>
    {UPGRADE_MODE
      ? (
          <ProgramUpgrade
            getHardwareProvider={getHardwareProvider}
            isLocalOperatorHost={isLocalOperatorHost}
            sha256Hex={sha256Hex}
            short={short}
          />
        )
      : MIGRATE_ROUNDS_MODE
        ? (
            <LegacyRoundMigration
              getHardwareProvider={getHardwareProvider}
              isLocalOperatorHost={isLocalOperatorHost}
              sha256Hex={sha256Hex}
              short={short}
            />
          )
      : ATTENDED_WEEK9_MODE
        ? (
            <AttendedWeek9Settlement
              explorer={explorer}
              getHardwareProvider={getHardwareProvider}
              localOperator={isLocalOperatorHost(window.location.hostname)}
              sha256Hex={sha256Hex}
            />
          )
      : <App />}
  </Suspense>,
);

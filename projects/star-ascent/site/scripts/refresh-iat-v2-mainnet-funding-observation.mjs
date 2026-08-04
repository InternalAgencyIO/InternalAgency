#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OFFICIAL_MAINNET_RPC = "https://api.mainnet-beta.solana.com";
export const PUBLIC_MAINNET_ADDRESS = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
export const CEREMONY_FLOOR_LAMPORTS = 8_500_000_000n;

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gatePath = path.join(siteRoot, "launch/iat-v2-mainnet-readiness-gate.json");

function requireIntegerString(value, label) {
  if (!/^(?:0|[1-9]\d*)$/u.test(String(value ?? ""))) {
    throw new Error(`${label} must be a non-negative integer string`);
  }
  return BigInt(value);
}

function canonicalUtcSeconds(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)
    && Number.isFinite(Date.parse(value));
}

function shortfall(target, observed) {
  return target > observed ? target - observed : 0n;
}

export function applyFundingObservation(sourceGate, observation) {
  if (sourceGate?.schema !== "iat-v2-mainnet-readiness-gate/v1") {
    throw new Error("unexpected readiness-gate schema");
  }
  if (sourceGate.status !== "HOLD" || sourceGate.network !== "mainnet-beta") {
    throw new Error("read-only refresh requires mainnet-beta HOLD");
  }
  if (sourceGate.funding?.publicAddress !== PUBLIC_MAINNET_ADDRESS) {
    throw new Error("readiness gate contains an unexpected public funding address");
  }
  const floor = requireIntegerString(sourceGate.funding?.ceremonyFloorLamports, "ceremony floor");
  if (floor !== CEREMONY_FLOOR_LAMPORTS) {
    throw new Error("ceremony floor must remain exactly 8500000000 lamports");
  }
  const rentMinimum = requireIntegerString(
    sourceGate.funding?.measuredRentExemptMinimumLamports,
    "rent-exempt minimum",
  );
  const observed = requireIntegerString(observation?.lamports, "observed balance");
  const contextSlot = requireIntegerString(observation?.contextSlot, "RPC context slot");
  if (contextSlot === 0n) throw new Error("RPC context slot must be positive");
  if (!canonicalUtcSeconds(observation?.observedAtUtc)) {
    throw new Error("observation time must be canonical UTC to whole seconds");
  }
  if (Object.values(sourceGate.safety ?? {}).some((value) => value !== false)) {
    throw new Error("read-only refresh refuses a readiness record with any unsafe side effect");
  }

  const gate = structuredClone(sourceGate);
  gate.observedAtUtc = observation.observedAtUtc;
  gate.funding.observationKind = "READ_ONLY_RPC_BALANCE";
  gate.funding.rpcEndpoint = OFFICIAL_MAINNET_RPC;
  gate.funding.commitment = "finalized";
  gate.funding.contextSlot = contextSlot.toString();
  gate.funding.observedLamports = observed.toString();
  gate.funding.shortfallToRentMinimumLamports = shortfall(rentMinimum, observed).toString();
  gate.funding.shortfallToCeremonyFloorLamports = shortfall(floor, observed).toString();
  gate.funding.ceremonyFloorSatisfied = observed >= floor;
  gate.gates.mainnetFundingFloorSatisfied = observed >= floor;
  return gate;
}

export async function fetchFinalizedBalance(fetchImplementation = fetch) {
  const response = await fetchImplementation(OFFICIAL_MAINNET_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [PUBLIC_MAINNET_ADDRESS, { commitment: "finalized" }],
    }),
  });
  if (!response.ok) throw new Error(`mainnet RPC returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`mainnet RPC error: ${JSON.stringify(payload.error)}`);
  if (!Number.isSafeInteger(payload?.result?.value) || payload.result.value < 0) {
    throw new Error("mainnet RPC returned an invalid balance");
  }
  if (!Number.isSafeInteger(payload?.result?.context?.slot) || payload.result.context.slot <= 0) {
    throw new Error("mainnet RPC returned an invalid context slot");
  }
  return {
    lamports: String(payload.result.value),
    contextSlot: String(payload.result.context.slot),
    observedAtUtc: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
  };
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("this read-only command accepts no arguments");
  }
  const sourceGate = JSON.parse(await readFile(gatePath, "utf8"));
  const observation = await fetchFinalizedBalance();
  const gate = applyFundingObservation(sourceGate, observation);
  await writeFile(gatePath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    action: "READ_ONLY_MAINNET_BALANCE_REFRESH",
    observedAtUtc: gate.observedAtUtc,
    contextSlot: gate.funding.contextSlot,
    observedLamports: gate.funding.observedLamports,
    ceremonyFloorLamports: gate.funding.ceremonyFloorLamports,
    shortfallToCeremonyFloorLamports: gate.funding.shortfallToCeremonyFloorLamports,
    ceremonyFloorSatisfied: gate.funding.ceremonyFloorSatisfied,
    mainnetStatus: gate.status,
    signingPerformed: false,
    broadcastingPerformed: false,
  }, null, 2));
}

const invokedAsCli = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsCli) {
  main().catch((error) => {
    console.error(`Funding observation refresh failed: ${error.message}`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { sha256CanonicalTextFile } from "./canonical-text-digest.mjs";

const outputPath = "app/mint/ceremony-config.generated.json";
const paths = {
  manifest: "launch/genesis-manifest.template.json",
  metadata: "launch/token-metadata.template.json",
  metadataJson: "public/metadata/iat.json",
  lockPlan: "launch/allocation-lock-plan.template.json",
  checklist: "launch/genesis-signing-checklist.template.json",
  rehearsal: "launch/devnet-rehearsal.template.json",
  handoff: "launch/mainnet-handoff.template.json",
  packet: "launch/release-packet.template.json",
};
const validators = [
  ["manifest", "scripts/validate-genesis-manifest.mjs"],
  ["metadata", "scripts/validate-token-metadata.mjs"],
  ["allocation lock plan", "scripts/validate-allocation-lock-plan.mjs"],
  ["signing checklist", "scripts/validate-genesis-signing-checklist.mjs"],
  ["devnet rehearsal", "scripts/validate-devnet-rehearsal.mjs"],
  ["mainnet handoff", "scripts/validate-mainnet-handoff.mjs"],
  ["release packet", "scripts/validate-release-packet.mjs"],
];
const implementationPaths = [
  "app/mint/ceremony.mjs",
  "app/mint/page.tsx",
  "package-lock.json",
];
const allocationOrder = ["community", "treasury", "ecosystem", "coreTeam", "liquidity"];
const expectedModelTAddress = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const transactionOrder = [
  "CREATE_INITIALIZE_IMMUTABLE_METADATA",
  "MINT_FIVE_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
];
const devnetAmounts = {
  community: "500000000000",
  treasury: "200000000000",
  ecosystem: "150000000000",
  coreTeam: "100000000000",
  liquidity: "50000000000",
};

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha256File = (path) => sha256CanonicalTextFile(resolve(path));
const canonicalDigest = (value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const sameOrder = (value) =>
  Array.isArray(value)
  && value.length === transactionOrder.length
  && value.every((action, index) => action === transactionOrder[index]);

const artifacts = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readJson(path)]));
const sourceDigests = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, sha256File(path)]));
const implementationDigests = Object.fromEntries(
  implementationPaths.map((path) => [path, sha256File(path)]),
);
const implementationSha256 = sha256(
  Object.entries(implementationDigests).map(([path, digest]) => `${path}:${digest}`).join("\n"),
);
const blockers = [];

for (const [label, validator] of validators) {
  const result = spawnSync(process.execPath, [resolve(validator)], { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).find((line) => line.startsWith("FAIL:"));
    blockers.push(`${label} validator failed${detail ? `: ${detail.slice(6)}` : "."}`);
  }
}

const requiredStates = [
  ["token metadata", artifacts.metadata.status, "READY"],
  ["allocation lock plan", artifacts.lockPlan.status, "READY"],
  ["signing checklist", artifacts.checklist.status, "READY"],
  ["Model T devnet rehearsal", artifacts.rehearsal.status, "COMPLETED"],
  ["mainnet handoff", artifacts.handoff.status, "APPROVED"],
  ["release packet", artifacts.packet.status, "READY"],
];
for (const [label, actual, expected] of requiredStates) {
  if (actual !== expected) blockers.push(`${label} is ${actual}; ${expected} is required.`);
}
if (artifacts.manifest.status !== "HOLD") blockers.push("Genesis manifest must remain HOLD until post-transaction reconciliation.");

const signer = artifacts.checklist.participants?.mintAuthoritySigner?.publicAddress;
const feePayer = artifacts.checklist.participants?.feePayerSigner?.publicAddress;
if (signer !== expectedModelTAddress || feePayer !== expectedModelTAddress) {
  blockers.push("Mint authority signer and fee payer must both be the reviewed Model T address.");
}
if (!sameOrder(artifacts.rehearsal.mainnetPlan?.transactionOrder)) {
  blockers.push("Devnet rehearsal does not bind the exact four-transaction mainnet plan.");
}
const rehearsalSourceDigests = artifacts.rehearsal.mainnetPlan?.sourceDigests;
for (const [field, expected] of [
  ["manifestSha256", sourceDigests.manifest],
  ["metadataSha256", sourceDigests.metadata],
  ["lockPlanSha256", sourceDigests.lockPlan],
  ["implementationSha256", implementationSha256],
]) {
  if (rehearsalSourceDigests?.[field] !== expected) blockers.push(`Devnet rehearsal ${field} does not bind the current source.`);
}
for (const [field, expected] of [
  ["manifestSha256", sourceDigests.manifest],
  ["signingChecklistSha256", sourceDigests.checklist],
  ["devnetRehearsalSha256", sourceDigests.rehearsal],
  ["mainnetHandoffSha256", sourceDigests.handoff],
]) {
  if (artifacts.packet.artifactDigests?.[field] !== expected) blockers.push(`Release packet ${field} does not bind the current source.`);
}
if (!canonicalDigest(artifacts.packet.approval?.packetDigest)) blockers.push("Release packet approval digest is absent.");

const mainnetAllocations = allocationOrder.map((name) => {
  const lockAllocation = artifacts.lockPlan.allocations?.[name];
  const checklistAllocation = artifacts.checklist.ceremonyControls?.reviewedRecipientDestinations?.[name];
  if (
    artifacts.lockPlan.status === "READY"
    && (
      lockAllocation?.ownerAddress !== checklistAllocation?.publicAddress
      || lockAllocation?.baseUnitAmount !== checklistAllocation?.expectedBaseUnitAmount
    )
  ) {
    blockers.push(`${name} lock-plan owner or amount does not match the signing checklist.`);
  }
  return {
    name,
    amount: lockAllocation?.baseUnitAmount ?? null,
    owner: artifacts.lockPlan.status === "READY" ? lockAllocation?.ownerAddress ?? null : null,
    custodyModel: lockAllocation?.custodyModel ?? null,
    releaseRule: lockAllocation?.releaseRule ?? null,
  };
});

const status = blockers.length === 0 ? "READY" : "LOCKED";
const configWithoutDigest = {
  version: 1,
  status,
  blockers,
  safety: {
    localOperatorHostOnly: true,
    expectedSigner: expectedModelTAddress,
    walletProvider: "Backpack",
    hardwareDevice: "Trezor Model T",
    noAutomaticTransactions: true,
    noSecretPersistence: true,
  },
  token: {
    name: artifacts.metadata.name,
    symbol: artifacts.metadata.symbol,
    program: artifacts.manifest.token.program,
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    decimals: artifacts.manifest.token.decimals,
    metadataProgramId: artifacts.metadata.metadataProgramId,
    metadataUri: artifacts.metadata.uri,
    metadataJsonSha256: sourceDigests.metadataJson,
    sellerFeeBasisPoints: artifacts.metadata.sellerFeeBasisPoints,
    isMutable: artifacts.metadata.isMutable,
  },
  transactionOrder,
  networks: {
    devnet: {
      rpcUrl: "https://api.devnet.solana.com",
      expectedSupplyBaseUnits: "1000000000000",
      allocations: allocationOrder.map((name) => ({ name, amount: devnetAmounts[name], owner: null })),
    },
    mainnetBeta: {
      rpcUrl: "https://api.mainnet-beta.solana.com",
      expectedSupplyBaseUnits: artifacts.manifest.token.fixedSupplyBaseUnits,
      allocations: mainnetAllocations,
    },
  },
  sourcePaths: paths,
  sourceDigests,
  implementationPaths,
  implementationDigests,
  implementationSha256,
};
const config = {
  ...configWithoutDigest,
  configurationSha256: sha256(JSON.stringify(configWithoutDigest)),
};

writeFileSync(resolve(outputPath), `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Mint ceremony configuration generated in ${status}: ${outputPath}`);
if (status !== "READY") console.log(`Mainnet remains locked by ${blockers.length} evidence gate(s).`);

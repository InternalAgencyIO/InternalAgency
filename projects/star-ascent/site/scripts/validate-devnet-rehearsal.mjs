#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const canonicalPath = "launch/devnet-rehearsal.template.json";
const requestedPath = process.argv[2] ?? canonicalPath;
const paths = {
  manifest: "launch/genesis-manifest.template.json",
  metadata: "launch/token-metadata.template.json",
  lockPlan: "launch/allocation-lock-plan.template.json",
};
const implementationPaths = [
  "app/mint/ceremony.mjs",
  "app/mint/page.tsx",
  "package-lock.json",
];
const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const allocations = {
  community: ["50%", "500000000000"],
  treasury: ["20%", "200000000000"],
  ecosystem: ["15%", "150000000000"],
  coreTeam: ["10%", "100000000000"],
  liquidity: ["5%", "50000000000"],
};
const mainnetAmounts = {
  community: "500000000000000000",
  treasury: "200000000000000000",
  ecosystem: "150000000000000000",
  coreTeam: "100000000000000000",
  liquidity: "50000000000000000",
};
const actions = [
  "CREATE_INITIALIZE_IMMUTABLE_METADATA",
  "MINT_FIVE_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
];
const transactionFields = [
  "createInitializeMetadata",
  "mintAllocations",
  "revokeMintAuthority",
  "revokeFreezeAuthority",
];
const failures = [];
const fail = (message) => failures.push(message);
const exactKeys = (value, keys) =>
  value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const sha256File = (path) => createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const implementationDigest = () => sha256Text(
  implementationPaths.map((path) => `${path}:${sha256File(path)}`).join("\n"),
);
const planDigest = (plan) => createHash("sha256").update(JSON.stringify({
  sourceDigests: plan.sourceDigests,
  implementationPaths: plan.implementationPaths,
  network: plan.network,
  program: plan.program,
  programId: plan.programId,
  decimals: plan.decimals,
  fixedSupplyBaseUnits: plan.fixedSupplyBaseUnits,
  allocationBaseUnitAmounts: plan.allocationBaseUnitAmounts,
  transactionOrder: plan.transactionOrder,
})).digest("hex");
const usableAddress = (value) => {
  try {
    return typeof value === "string" && new PublicKey(value).toBytes().length === 32;
  } catch {
    return false;
  }
};
const addressUrl = (value) => `https://explorer.solana.com/address/${value}?cluster=devnet`;
const transactionUrl = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^https:\/\/explorer\.solana\.com\/tx\/([1-9A-HJ-NP-Za-km-z]{80,90})\?cluster=devnet$/);
  return match?.[1] ?? null;
};
const isUtc = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value));
const label = (value) => typeof value === "string"
  && value === value.trim()
  && value.length >= 3
  && value.length <= 80
  && !/^(operator|verifier|reviewer|pending|tbd|unknown)$/i.test(value);
const findSecretField = (value, path = "rehearsal") => {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (key !== "noSecretsInManifest"
      && /(secret|private(?:Key)?|mnemonic|seed(?:Phrase)?|passphrase|password|recoveryPhrase|pin)/i.test(key)) {
      return `${path}.${key}`;
    }
    const nested = findSecretField(child, `${path}.${key}`);
    if (nested) return nested;
  }
  return null;
};

if (requestedPath.replaceAll("\\", "/") !== canonicalPath) fail(`rehearsal path must be ${canonicalPath}`);

let rehearsal;
try {
  rehearsal = JSON.parse(readFileSync(resolve(canonicalPath), "utf8"));
} catch (error) {
  fail(`rehearsal record is unreadable: ${error.message}`);
}

if (rehearsal) {
  if (!exactKeys(rehearsal, ["version", "status", "network", "purpose", "signingRules", "mainnetPlan", "token", "allocations", "transactions", "device", "verifier"])) fail("rehearsal must contain only canonical fields");
  if (rehearsal.version !== 2) fail("rehearsal version must be 2");
  if (!["PLANNED", "COMPLETED"].includes(rehearsal.status)) fail("status must be PLANNED or COMPLETED");
  if (rehearsal.network !== "devnet") fail("rehearsal network must be devnet");
  if (rehearsal.purpose !== "Exact-shape Model T rehearsal for the four-transaction Genesis ceremony. No value, public allocation, or launch assertion.") fail("rehearsal purpose must be canonical");
  if (!exactKeys(rehearsal.signingRules, ["physicalConfirmationRequired", "noSecretsInManifest", "noBlindApproval", "localOperatorHostOnly"])) fail("signing rules must contain only canonical fields");
  else if (Object.values(rehearsal.signingRules).some((value) => value !== true)) fail("every rehearsal signing rule must be true");
  const secretField = findSecretField(rehearsal);
  if (secretField) fail(`rehearsal contains credential-bearing field ${secretField}`);

  const plan = rehearsal.mainnetPlan;
  if (!exactKeys(plan, ["manifestPath", "metadataPath", "lockPlanPath", "implementationPaths", "sourceDigests", "planSha256", "network", "program", "programId", "decimals", "fixedSupplyBaseUnits", "allocationBaseUnitAmounts", "transactionOrder"])) fail("mainnet plan must contain only canonical fields");
  if (plan?.manifestPath !== paths.manifest || plan?.metadataPath !== paths.metadata || plan?.lockPlanPath !== paths.lockPlan) fail("mainnet plan must point to canonical source artifacts");
  if (JSON.stringify(plan?.implementationPaths) !== JSON.stringify(implementationPaths)) fail("mainnet plan must bind the canonical ceremony implementation paths");
  if (!exactKeys(plan?.sourceDigests, ["manifestSha256", "metadataSha256", "lockPlanSha256", "implementationSha256"])) fail("mainnet plan source digests must be canonical");
  if (plan?.network !== "mainnet-beta" || plan?.program !== "Original SPL Token Program" || plan?.programId !== TOKEN_PROGRAM_ID.toBase58() || plan?.decimals !== 9 || plan?.fixedSupplyBaseUnits !== "1000000000000000000") fail("mainnet token plan does not match the fixed Original SPL design");
  if (!exactKeys(plan?.allocationBaseUnitAmounts, Object.keys(mainnetAmounts)) || Object.entries(mainnetAmounts).some(([name, amount]) => plan?.allocationBaseUnitAmounts?.[name] !== amount)) fail("mainnet allocation amounts must match the fixed 50/20/15/10/5 plan");
  if (!Array.isArray(plan?.transactionOrder) || plan.transactionOrder.length !== actions.length || plan.transactionOrder.some((value, index) => value !== actions[index])) fail("mainnet transaction order must match the four-step ceremony");

  const token = rehearsal.token;
  if (!exactKeys(token, ["program", "programId", "decimals", "testSupply", "testSupplyBaseUnits", "mint", "metadataAddress", "metadataUri", "mintEvidence", "metadataEvidence"])) fail("rehearsal token must contain only canonical fields");
  if (token?.program !== "Original SPL Token Program" || token?.programId !== TOKEN_PROGRAM_ID.toBase58() || token?.decimals !== 9 || token?.testSupply !== "1000" || token?.testSupplyBaseUnits !== "1000000000000") fail("rehearsal token does not match the canonical 1,000-IAT test plan");
  if (token?.metadataUri !== "https://internalagency.io/metadata/iat.json") fail("rehearsal metadata URI must match the canonical token metadata");

  if (!exactKeys(rehearsal.allocations, Object.keys(allocations))) fail("rehearsal must contain exactly five allocations");
  for (const [name, [share, amount]] of Object.entries(allocations)) {
    const allocation = rehearsal.allocations?.[name];
    if (!exactKeys(allocation, ["share", "baseUnitAmount", "ownerAddress", "tokenAccount", "evidence"])) fail(`${name} rehearsal allocation must contain only canonical fields`);
    if (allocation?.share !== share || allocation?.baseUnitAmount !== amount) fail(`${name} rehearsal allocation does not match the exact test-supply ratio`);
  }
  if (!exactKeys(rehearsal.transactions, transactionFields)) fail("rehearsal transactions must contain exactly four canonical fields");

  if (rehearsal.status === "PLANNED") {
    if (Object.values(plan?.sourceDigests ?? {}).some((value) => value !== null) || plan?.planSha256 !== null) fail("PLANNED rehearsal must clear mainnet source bindings");
    for (const field of ["mint", "metadataAddress", "mintEvidence", "metadataEvidence"]) {
      if (token?.[field] !== null) fail(`PLANNED rehearsal requires token.${field} to be null`);
    }
    for (const [name, allocation] of Object.entries(rehearsal.allocations ?? {})) {
      for (const field of ["ownerAddress", "tokenAccount", "evidence"]) if (allocation[field] !== null) fail(`PLANNED rehearsal requires allocations.${name}.${field} to be null`);
    }
    if (Object.values(rehearsal.transactions ?? {}).some((value) => value !== null)) fail("PLANNED rehearsal must clear transaction evidence");
    const plannedDevice = {
      operatorLabel: null, firmwareVersion: null, suiteOrWalletInterface: null,
      confirmedActions: [], confirmedTransactionEvidence: [], confirmedPlanSha256: null, completedAtUtc: null,
    };
    if (rehearsal.device?.model !== "Trezor Model T" || Object.entries(plannedDevice).some(([field, value]) => JSON.stringify(rehearsal.device?.[field]) !== JSON.stringify(value))) fail("PLANNED rehearsal must clear device completion evidence");
    if (rehearsal.verifier?.reviewedDevice?.model !== "Trezor Model T"
      || rehearsal.verifier?.reviewedDevice?.firmwareVersion !== null
      || rehearsal.verifier?.reviewedDevice?.suiteOrWalletInterface !== null
      || rehearsal.verifier?.reviewedBy !== null
      || rehearsal.verifier?.independentOfDeviceOperator !== false
      || rehearsal.verifier?.reviewedMint !== null
      || rehearsal.verifier?.reviewedMetadataAddress !== null
      || !exactKeys(rehearsal.verifier?.reviewedAllocations, [])
      || JSON.stringify(rehearsal.verifier?.reviewedActions) !== "[]"
      || JSON.stringify(rehearsal.verifier?.reviewedTransactionEvidence) !== "[]"
      || rehearsal.verifier?.reviewedPlanSha256 !== null
      || rehearsal.verifier?.completedAtUtc !== null) fail("PLANNED rehearsal must clear verifier completion evidence");
  }

  if (rehearsal.status === "COMPLETED") {
    const metadata = JSON.parse(readFileSync(resolve(paths.metadata), "utf8"));
    const lockPlan = JSON.parse(readFileSync(resolve(paths.lockPlan), "utf8"));
    if (metadata.status !== "READY" || lockPlan.status !== "READY") fail("COMPLETED rehearsal requires READY metadata and allocation-lock plans");
    for (const script of ["validate-token-metadata.mjs", "validate-allocation-lock-plan.mjs"]) {
      const result = spawnSync(process.execPath, [resolve("scripts", script)], { encoding: "utf8" });
      if (result.status !== 0) fail(`COMPLETED rehearsal requires ${script} to pass`);
    }
    const expectedDigests = {
      manifestSha256: sha256File(paths.manifest),
      metadataSha256: sha256File(paths.metadata),
      lockPlanSha256: sha256File(paths.lockPlan),
      implementationSha256: implementationDigest(),
    };
    if (Object.entries(expectedDigests).some(([field, digest]) => plan?.sourceDigests?.[field] !== digest)) fail("COMPLETED rehearsal must bind the exact current mainnet source artifacts");
    if (plan?.planSha256 !== planDigest(plan)) fail("COMPLETED rehearsal must bind the exact canonical mainnet plan digest");

    if (!usableAddress(token?.mint)) fail("COMPLETED rehearsal requires a usable devnet mint");
    const expectedMetadataAddress = usableAddress(token?.mint)
      ? PublicKey.findProgramAddressSync([Buffer.from("metadata"), METADATA_PROGRAM.toBuffer(), new PublicKey(token.mint).toBuffer()], METADATA_PROGRAM)[0].toBase58()
      : null;
    if (token?.metadataAddress !== expectedMetadataAddress) fail("COMPLETED rehearsal metadata address must be the canonical mint PDA");
    if (token?.mintEvidence !== addressUrl(token?.mint) || token?.metadataEvidence !== addressUrl(token?.metadataAddress)) fail("COMPLETED rehearsal requires direct mint and metadata Explorer evidence");

    const ownerAddresses = [];
    const tokenAccounts = [];
    const allocationReview = {};
    for (const name of Object.keys(allocations)) {
      const allocation = rehearsal.allocations[name];
      if (!usableAddress(allocation.ownerAddress)) fail(`COMPLETED rehearsal requires a usable ${name} owner`);
      else ownerAddresses.push(allocation.ownerAddress);
      const expectedAta = usableAddress(token?.mint) && usableAddress(allocation.ownerAddress)
        ? getAssociatedTokenAddressSync(new PublicKey(token.mint), new PublicKey(allocation.ownerAddress), true, TOKEN_PROGRAM_ID).toBase58()
        : null;
      if (allocation.tokenAccount !== expectedAta) fail(`COMPLETED rehearsal ${name} token account must be the canonical Original SPL ATA`);
      if (allocation.evidence !== addressUrl(allocation.tokenAccount)) fail(`COMPLETED rehearsal requires direct ${name} token-account evidence`);
      tokenAccounts.push(allocation.tokenAccount);
      allocationReview[name] = {
        ownerAddress: allocation.ownerAddress,
        tokenAccount: allocation.tokenAccount,
        baseUnitAmount: allocation.baseUnitAmount,
      };
    }
    if (new Set(ownerAddresses).size !== 5 || new Set(tokenAccounts).size !== 5) fail("COMPLETED rehearsal owners and token accounts must all be distinct");

    const transactionEvidence = transactionFields.map((field) => rehearsal.transactions?.[field]);
    const transactionIds = transactionEvidence.map(transactionUrl);
    if (transactionIds.some((value) => value === null) || new Set(transactionIds).size !== 4) fail("COMPLETED rehearsal requires four distinct canonical devnet transaction proofs");

    if (rehearsal.device?.model !== "Trezor Model T" || !label(rehearsal.device?.operatorLabel) || !label(rehearsal.device?.firmwareVersion) || !label(rehearsal.device?.suiteOrWalletInterface)) fail("COMPLETED rehearsal requires the reviewed Model T environment");
    if (JSON.stringify(rehearsal.device?.confirmedActions) !== JSON.stringify(actions) || JSON.stringify(rehearsal.device?.confirmedTransactionEvidence) !== JSON.stringify(transactionEvidence)) fail("COMPLETED device evidence must bind the exact four actions and transactions");
    if (rehearsal.device?.confirmedPlanSha256 !== plan.planSha256) fail("COMPLETED device evidence must bind the mainnet plan digest");

    if (!label(rehearsal.verifier?.reviewedBy) || rehearsal.verifier.reviewedBy.toLocaleLowerCase("en") === rehearsal.device.operatorLabel.toLocaleLowerCase("en")) fail("COMPLETED rehearsal requires a distinct independent verifier");
    if (rehearsal.verifier?.independentOfDeviceOperator !== true) fail("COMPLETED rehearsal requires verifier independence");
    if (JSON.stringify(rehearsal.verifier?.reviewedDevice) !== JSON.stringify({ model: rehearsal.device.model, firmwareVersion: rehearsal.device.firmwareVersion, suiteOrWalletInterface: rehearsal.device.suiteOrWalletInterface })) fail("COMPLETED verifier must review the same Model T environment");
    if (rehearsal.verifier?.reviewedMint !== token.mint || rehearsal.verifier?.reviewedMetadataAddress !== token.metadataAddress) fail("COMPLETED verifier must review the exact mint and metadata addresses");
    if (JSON.stringify(rehearsal.verifier?.reviewedAllocations) !== JSON.stringify(allocationReview)) fail("COMPLETED verifier must review all five allocation owners, ATAs, and amounts");
    if (JSON.stringify(rehearsal.verifier?.reviewedActions) !== JSON.stringify(actions) || JSON.stringify(rehearsal.verifier?.reviewedTransactionEvidence) !== JSON.stringify(transactionEvidence)) fail("COMPLETED verifier evidence must bind the exact four actions and transactions");
    if (rehearsal.verifier?.reviewedPlanSha256 !== plan.planSha256) fail("COMPLETED verifier evidence must bind the mainnet plan digest");

    if (!isUtc(rehearsal.device?.completedAtUtc) || !isUtc(rehearsal.verifier?.completedAtUtc)) fail("COMPLETED rehearsal requires canonical UTC device and verifier times");
    else {
      const deviceTime = Date.parse(rehearsal.device.completedAtUtc);
      const verifierTime = Date.parse(rehearsal.verifier.completedAtUtc);
      if (verifierTime <= deviceTime || verifierTime - deviceTime > 30 * 60_000) fail("independent review must follow the device ceremony within 30 minutes");
      if (Date.now() - verifierTime > 24 * 60 * 60_000 || verifierTime > Date.now() + 60_000) fail("COMPLETED rehearsal evidence must be current for the 24-hour launch window");
    }
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(`Devnet rehearsal gate passes in ${rehearsal.status}. Mainnet signing remains a separate human action.`);

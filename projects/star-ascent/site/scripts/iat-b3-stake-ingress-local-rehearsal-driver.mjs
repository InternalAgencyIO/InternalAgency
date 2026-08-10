import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createApproveCheckedInstruction,
  createExecuteInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
  getCpiGuard,
  getExtraAccountMetaAddress,
} from "@solana/spl-token";
import {
  deriveSolanaDraw,
  protocolLocalDay,
} from "./iat-b3-local-rehearsal-driver.mjs";

const SCHEMA = "iat-b3-stake-ingress-local-validator/v1";
const ECONOMY_PROGRAM_ID = new PublicKey("GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU");
const HOOK_PROGRAM_ID = new PublicKey("DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F");
const DECIMALS = 9;

function parseArgs(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("invalid arguments");
    result.set(key.slice(2), value);
  }
  return result;
}

function required(args, name) {
  const value = args.get(name);
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

function readKeypair(path) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function u64le(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function compactSnapshot(account) {
  return Object.freeze({
    amount: account.amount,
    delegate: account.delegate?.toBase58() ?? null,
    delegatedAmount: account.delegatedAmount,
  });
}

async function snapshot(connection, source, vault) {
  const [sourceAccount, vaultAccount] = await Promise.all([
    getAccount(connection, source, "confirmed", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, vault, "confirmed", TOKEN_2022_PROGRAM_ID),
  ]);
  return Object.freeze({
    source: compactSnapshot(sourceAccount),
    vault: compactSnapshot(vaultAccount),
  });
}

function assertSnapshotEqual(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} mutated token state despite failure`);
}

async function transactionLogs(connection, signature) {
  const transaction = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  assert(transaction?.meta, `missing transaction metadata for ${signature}`);
  return transaction.meta.logMessages ?? [];
}

async function send(connection, payer, instructions) {
  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(...instructions),
    [payer],
    { commitment: "confirmed" },
  );
  return Object.freeze({ signature, logs: await transactionLogs(connection, signature) });
}

async function failureText(connection, error) {
  const parts = [String(error?.message ?? error)];
  let logs = error?.logs;
  if ((!logs || logs.length === 0) && typeof error?.getLogs === "function") {
    try {
      logs = await error.getLogs(connection);
    } catch {
      // Preserve the original transaction error.
    }
  }
  if (logs) parts.push(...logs);
  return parts.join("\n");
}

async function expectFailure(connection, label, action, pattern) {
  try {
    await action();
  } catch (error) {
    const text = await failureText(connection, error);
    assert.match(text, pattern, `${label} failed for an unexpected reason:\n${text}`);
    return Object.freeze({
      rejected: true,
      label,
      matched: pattern.source,
      customErrors: [...text.matchAll(/custom program error: 0x([0-9a-f]+)/giu)].map(
        (match) => Number.parseInt(match[1], 16),
      ),
    });
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

function economyInstruction({
  owner,
  source,
  mint,
  vault,
  ingress,
  priorDelegate,
  validation,
  lawState,
  mode,
  amount,
}) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: ingress, isSigner: false, isWritable: false },
      { pubkey: priorDelegate, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: HOOK_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: validation, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([1, mode]), u64le(amount)]),
  });
}

async function validatorProtocolDay(connection) {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  assert(clock && clock.data.length >= 40, "validator Clock sysvar is unavailable");
  return protocolLocalDay(clock.data.readBigInt64LE(32));
}

function findLockedAncestor(mint, localDay) {
  for (let candidate = 0; candidate <= 0xffff_ffff; candidate += 1) {
    const ancestorSlotHash = Buffer.alloc(32, 0x42);
    ancestorSlotHash.writeUInt32LE(candidate, 0);
    const decision = deriveSolanaDraw({
      ancestorSlotHash,
      localDay,
      entropySlot: 42_424_242n,
      networkGenesisHash: Buffer.alloc(32, 0x91),
      mint,
    });
    if (decision.locked) return ancestorSlotHash;
  }
  throw new Error("unable to derive a fixture locked Daily Law ancestor");
}

function setLawStateInstruction({ owner, mint, lawState, mode, lockedAncestor = null }) {
  assert.equal(mode === 1, lockedAncestor !== null);
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: true },
    ],
    data: lockedAncestor === null
      ? Buffer.from([3, mode])
      : Buffer.concat([Buffer.from([3, mode]), lockedAncestor]),
  });
}

function assertSuccessLogs(logs, expectedApprovalCount) {
  const joined = logs.join("\n");
  assert.match(joined, /Instruction: ApproveChecked/u);
  assert.match(joined, /Instruction: TransferChecked/u);
  const approvals = logs.filter((line) => line.includes("Instruction: ApproveChecked"));
  assert.equal(approvals.length, expectedApprovalCount);
  assert(
    logs.some((line) => line.includes(`Program ${HOOK_PROGRAM_ID.toBase58()} invoke`)),
    "hook CPI was not observed",
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const connection = new Connection(required(args, "rpc"), "confirmed");
  const owner = readKeypair(required(args, "owner"));
  const mint = new PublicKey(required(args, "mint"));
  const source = new PublicKey(required(args, "source"));
  const guardedSource = new PublicKey(required(args, "guarded-source"));
  const priorDelegate = new PublicKey(required(args, "prior-delegate"));
  const economySha256 = required(args, "economy-sha256");
  const hookSha256 = required(args, "hook-sha256");

  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), mint.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake-token"), config.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const [ingress] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake-ingress"), config.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const [lawState] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state"), mint.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const validation = getExtraAccountMetaAddress(mint, HOOK_PROGRAM_ID);

  const lawInitialization = await send(connection, owner, [
    new TransactionInstruction({
      programId: ECONOMY_PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: lawState, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([2]),
    }),
  ]);

  const hookInitialization = await send(connection, owner, [
    new TransactionInstruction({
      programId: HOOK_PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: validation, isSigner: false, isWritable: true },
        { pubkey: lawState, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([0]),
    }),
  ]);
  const vaultInitialization = await send(connection, owner, [
    new TransactionInstruction({
      programId: ECONOMY_PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([0]),
    }),
  ]);
  assert((await connection.getAccountInfo(validation, "confirmed"))?.owner.equals(HOOK_PROGRAM_ID));
  assert((await connection.getAccountInfo(lawState, "confirmed"))?.owner.equals(ECONOMY_PROGRAM_ID));
  const initializedVault = await getAccount(
    connection,
    vault,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  assert.equal(initializedVault.amount, 0n);

  const ingressBeforeFunding = await connection.getAccountInfo(ingress, "confirmed");
  assert.equal(ingressBeforeFunding, null);
  const ingressFundingLamports = 1_000_000;
  const ingressFunding = await send(connection, owner, [
    SystemProgram.transfer({
      fromPubkey: owner.publicKey,
      toPubkey: ingress,
      lamports: ingressFundingLamports,
    }),
  ]);
  const fundedIngress = await connection.getAccountInfo(ingress, "confirmed");
  assert(fundedIngress, "funded ingress PDA is absent");
  assert.equal(fundedIngress.lamports, ingressFundingLamports);
  assert(fundedIngress.owner.equals(SystemProgram.programId));
  assert.equal(fundedIngress.data.length, 0);
  assert.equal(fundedIngress.executable, false);

  const beforeDirectHook = await snapshot(connection, source, vault);
  const directExecute = createExecuteInstruction(
    HOOK_PROGRAM_ID,
    source,
    mint,
    vault,
    priorDelegate,
    validation,
    1n,
  );
  directExecute.keys.push({
    pubkey: lawState,
    isSigner: false,
    isWritable: false,
  });
  const directHookFailure = await expectFailure(
    connection,
    "direct hook invocation without Token-2022 transfer context",
    async () => send(connection, owner, [directExecute]),
    /custom program error: 0x66\b/iu,
  );
  assertSnapshotEqual(
    await snapshot(connection, source, vault),
    beforeDirectHook,
    "direct hook invocation",
  );

  const noDelegateBefore = await snapshot(connection, source, vault);
  assert.equal(noDelegateBefore.source.delegate, null);
  const noDelegateSuccess = await send(connection, owner, [
    economyInstruction({
      owner: owner.publicKey,
      source,
      mint,
      vault,
      ingress,
      priorDelegate,
      validation,
      lawState,
      mode: 0,
      amount: 7n,
    }),
  ]);
  assertSuccessLogs(noDelegateSuccess.logs, 1);
  const noDelegateAfter = await snapshot(connection, source, vault);
  assert.equal(noDelegateAfter.source.amount, noDelegateBefore.source.amount - 7n);
  assert.equal(noDelegateAfter.vault.amount, noDelegateBefore.vault.amount + 7n);
  assert.equal(noDelegateAfter.source.delegate, null);
  assert.equal(noDelegateAfter.source.delegatedAmount, 0n);

  const priorAllowance = 41n;
  await send(connection, owner, [
    createApproveCheckedInstruction(
      source,
      mint,
      priorDelegate,
      owner.publicKey,
      priorAllowance,
      DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ]);
  const priorBefore = await snapshot(connection, source, vault);
  assert.equal(priorBefore.source.delegate, priorDelegate.toBase58());
  assert.equal(priorBefore.source.delegatedAmount, priorAllowance);
  const restorationSuccess = await send(connection, owner, [
    economyInstruction({
      owner: owner.publicKey,
      source,
      mint,
      vault,
      ingress,
      priorDelegate,
      validation,
      lawState,
      mode: 0,
      amount: 11n,
    }),
  ]);
  assertSuccessLogs(restorationSuccess.logs, 2);
  const restorationAfter = await snapshot(connection, source, vault);
  assert.equal(restorationAfter.source.amount, priorBefore.source.amount - 11n);
  assert.equal(restorationAfter.vault.amount, priorBefore.vault.amount + 11n);
  assert.equal(restorationAfter.source.delegate, priorDelegate.toBase58());
  assert.equal(restorationAfter.source.delegatedAmount, priorAllowance);

  const beforeDonation = await snapshot(connection, source, vault);
  const donation = await expectFailure(
    connection,
    "owner-authorized direct stake-vault donation",
    async () => send(connection, owner, [
      await createTransferCheckedWithTransferHookInstruction(
        connection,
        source,
        mint,
        vault,
        owner.publicKey,
        3n,
        DECIMALS,
        [],
        "confirmed",
        TOKEN_2022_PROGRAM_ID,
      ),
    ]),
    /custom program error: 0x67\b/iu,
  );
  assertSnapshotEqual(await snapshot(connection, source, vault), beforeDonation, "direct donation");

  const beforeHookFailure = await snapshot(connection, source, vault);
  const hookFailure = await expectFailure(
    connection,
    "injected hook failure after approval CPI",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState,
        mode: 0,
        amount: 13n,
      }),
    ]),
    /custom program error: 0x69\b/iu,
  );
  assertSnapshotEqual(await snapshot(connection, source, vault), beforeHookFailure, "hook failure");

  const beforePostCpiFailure = await snapshot(connection, source, vault);
  const postCpiFailure = await expectFailure(
    connection,
    "injected post-CPI failure",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState,
        mode: 1,
        amount: 9n,
      }),
    ]),
    /custom program error: 0xcf\b/iu,
  );
  assertSnapshotEqual(
    await snapshot(connection, source, vault),
    beforePostCpiFailure,
    "post-CPI failure",
  );

  const beforeRestorationFailure = await snapshot(connection, source, vault);
  const restorationFailure = await expectFailure(
    connection,
    "delegate restoration CPI failure",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState,
        mode: 2,
        amount: 8n,
      }),
    ]),
    /decimals different from the Mint decimals|custom program error: 0x12\b/iu,
  );
  assertSnapshotEqual(
    await snapshot(connection, source, vault),
    beforeRestorationFailure,
    "restoration failure",
  );

  const setUnfinalized = await send(connection, owner, [
    setLawStateInstruction({ owner: owner.publicKey, mint, lawState, mode: 2 }),
  ]);
  const beforeUnfinalized = await snapshot(connection, source, vault);
  const unfinalizedLawFailure = await expectFailure(
    connection,
    "unfinalized Daily Law rejects before Token-2022 mutation",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState,
        mode: 0,
        amount: 5n,
      }),
    ]),
    /custom program error: 0xb30c\b/iu,
  );
  assertSnapshotEqual(
    await snapshot(connection, source, vault),
    beforeUnfinalized,
    "unfinalized Daily Law",
  );

  const lockedAncestor = findLockedAncestor(mint, await validatorProtocolDay(connection));
  const setLocked = await send(connection, owner, [
    setLawStateInstruction({
      owner: owner.publicKey,
      mint,
      lawState,
      mode: 1,
      lockedAncestor,
    }),
  ]);
  const beforeLocked = await snapshot(connection, source, vault);
  const lockedLawFailure = await expectFailure(
    connection,
    "locked Daily Law rejects before Token-2022 mutation",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState,
        mode: 0,
        amount: 4n,
      }),
    ]),
    /custom program error: 0xb30d\b/iu,
  );
  assertSnapshotEqual(await snapshot(connection, source, vault), beforeLocked, "locked Daily Law");

  const lawFirstFailure = await expectFailure(
    connection,
    "locked Daily Law wins over a hostile non-token source",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source: priorDelegate,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState,
        mode: 0,
        amount: 3n,
      }),
    ]),
    /custom program error: 0xb30d\b/iu,
  );

  const setOpen = await send(connection, owner, [
    setLawStateInstruction({ owner: owner.publicKey, mint, lawState, mode: 0 }),
  ]);
  const beforeSubstitutedLaw = await snapshot(connection, source, vault);
  const substitutedLawFailure = await expectFailure(
    connection,
    "substituted Daily Law account rejects before Token-2022 mutation",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState: priorDelegate,
        mode: 0,
        amount: 6n,
      }),
    ]),
    /custom program error: 0xb30b\b/iu,
  );
  assertSnapshotEqual(
    await snapshot(connection, source, vault),
    beforeSubstitutedLaw,
    "substituted Daily Law",
  );

  const guardedAccount = await getAccount(
    connection,
    guardedSource,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  assert.equal(Boolean(getCpiGuard(guardedAccount)?.lockCpi), true);
  const guardedBefore = await snapshot(connection, guardedSource, vault);
  const cpiGuardFailure = await expectFailure(
    connection,
    "CPI Guard is rejected by the retained preflight before approval",
    async () => send(connection, owner, [
      economyInstruction({
        owner: owner.publicKey,
        source: guardedSource,
        mint,
        vault,
        ingress,
        priorDelegate,
        validation,
        lawState,
        mode: 0,
        amount: 5n,
      }),
    ]),
    /custom program error: 0xb30f\b/iu,
  );
  assertSnapshotEqual(await snapshot(connection, guardedSource, vault), guardedBefore, "CPI Guard");

  emit({
    schema: SCHEMA,
    status: "PASS",
    rpcScope: "loopback-only",
    publicNetworkWrites: false,
    programs: {
      productionCandidates: false,
      economy: { id: ECONOMY_PROGRAM_ID.toBase58(), sha256: economySha256 },
      hook: { id: HOOK_PROGRAM_ID.toBase58(), sha256: hookSha256 },
    },
    addresses: {
      mint: mint.toBase58(),
      config: config.toBase58(),
      stakeVault: vault.toBase58(),
      ingressAuthority: ingress.toBase58(),
      validation: validation.toBase58(),
      dailyLaw: lawState.toBase58(),
    },
    checks: {
      hookInitialization: hookInitialization.signature,
      lawInitialization: lawInitialization.signature,
      vaultInitialization: vaultInitialization.signature,
      ownerSignedApproveCheckedCpi: true,
      statelessIngressPdaInvokeSignedTransferChecked: true,
      statelessIngressPdaHasNoStatePrerequisite: true,
      ingressPdaFundingAdversary: {
        absentBeforeFunding: true,
        fundingSignature: ingressFunding.signature,
        fundedBeforeBothSuccessCases: true,
        lamports: fundedIngress.lamports,
        owner: fundedIngress.owner.toBase58(),
        dataLength: fundedIngress.data.length,
        executable: fundedIngress.executable,
        bothSuccessCasesPassedAfterFunding: true,
        noLamportsPrerequisite: true,
        noOwnerPrerequisite: true,
        noDataPrerequisite: true,
        noExecutablePrerequisite: true,
      },
      hookTransferContextRequired: {
        directInvocationRejected: directHookFailure,
        balancesAndDelegateUnchanged: true,
      },
      hookAuthorityObservedNonSigner: true,
      dailyLawAccountResolvedThroughHookValidation: lawState.toBase58(),
      dailyLawAuthenticatedBeforeTokenParsing: true,
      dailyLawStateTransitions: {
        unfinalizedSetup: setUnfinalized.signature,
        lockedSetup: setLocked.signature,
        openRestore: setOpen.signature,
      },
      unfinalizedDailyLawFailsClosed: unfinalizedLawFailure,
      lockedDailyLawFailsClosed: lockedLawFailure,
      dailyLawFailurePrecedesHostileTokenParsing: lawFirstFailure,
      substitutedDailyLawFailsClosed: substitutedLawFailure,
      productionSourceExecutorInvoked: true,
      exactDelegateConsumptionAndAutoClear: true,
      exactPriorDelegateRestoration: true,
      noDelegateSuccess: noDelegateSuccess.signature,
      restorationSuccess: restorationSuccess.signature,
      directDonationRejected: donation,
      hookFailureAtomicRollback: hookFailure,
      postCpiFailureAtomicRollback: postCpiFailure,
      restorationFailureAtomicRollback: restorationFailure,
      cpiGuardFailsClosed: cpiGuardFailure,
    },
  });
}

main().catch((error) => {
  const diagnostic = typeof error?.stack === "string"
    ? error.stack
    : JSON.stringify(error, (_key, value) => typeof value === "bigint" ? value.toString() : value);
  emit({
    schema: SCHEMA,
    status: "FAIL",
    reason: diagnostic ?? String(error),
    publicNetworkWrites: false,
  });
  process.exitCode = 1;
});

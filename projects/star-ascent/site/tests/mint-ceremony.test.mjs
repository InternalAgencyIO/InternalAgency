import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  AuthorityType,
  decodeInitializeMintInstruction,
  decodeMintToCheckedInstruction,
  decodeSetAuthorityInstruction,
} from "@solana/spl-token";
import {
  getCreateMetadataAccountV3InstructionDataSerializer,
  getMetadataAccountDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  ALLOCATION_ORDER,
  CEREMONY_TRANSACTION_ORDER,
  DEVNET_TEST_SUPPLY_BASE_UNITS,
  EXPECTED_MODEL_T_ADDRESS,
  FIXED_SUPPLY_BASE_UNITS,
  METADATA_PROGRAM_ID,
  ORIGINAL_TOKEN_PROGRAM_ADDRESS,
  TOKEN_DECIMALS,
  assertCanonicalMetadataAccount,
  buildCreateInitializeMetadataTransaction,
  buildMintAllocationsTransaction,
  buildRevokeAuthorityTransaction,
  classifyCeremonyState,
  deriveMetadataAddress,
  isLocalOperatorHost,
} from "../app/mint/ceremony.mjs";

const blockhash = Keypair.generate().publicKey.toBase58();
const modelT = new PublicKey(EXPECTED_MODEL_T_ADDRESS);
const amounts = {
  community: 500_000_000_000_000_000n,
  treasury: 200_000_000_000_000_000n,
  ecosystem: 150_000_000_000_000_000n,
  coreTeam: 100_000_000_000_000_000n,
  liquidity: 50_000_000_000_000_000n,
};
const allocations = ALLOCATION_ORDER.map((name, index) => ({
  name,
  amount: amounts[name],
  owner: Keypair.fromSeed(new Uint8Array(32).fill(index + 1)).publicKey,
}));

test("devnet and mainnet share the exact four-transaction shape", () => {
  assert.deepEqual(CEREMONY_TRANSACTION_ORDER, [
    "CREATE_INITIALIZE_IMMUTABLE_METADATA",
    "MINT_FIVE_ALLOCATION_DESTINATIONS",
    "REVOKE_MINT_AUTHORITY",
    "REVOKE_FREEZE_AUTHORITY",
  ]);
});

test("mint creation, initialization, and immutable metadata are atomic", () => {
  const mint = Keypair.generate();
  const { transaction, metadataAddress } = buildCreateInitializeMetadataTransaction({
    feePayer: modelT,
    mint: mint.publicKey,
    rentLamports: 1_461_600,
  });

  assert.equal(transaction.instructions.length, 3);
  assert.equal(transaction.instructions[0].programId.toBase58(), "11111111111111111111111111111111");
  assert.equal(transaction.instructions[1].programId.toBase58(), ORIGINAL_TOKEN_PROGRAM_ADDRESS);
  assert.equal(transaction.instructions[2].programId.toBase58(), METADATA_PROGRAM_ID.toBase58());
  assert.equal(metadataAddress.toBase58(), deriveMetadataAddress(mint.publicKey).toBase58());

  const initialize = decodeInitializeMintInstruction(transaction.instructions[1]);
  assert.equal(initialize.data.decimals, TOKEN_DECIMALS);
  assert.equal(initialize.data.mintAuthority.toBase58(), modelT.toBase58());
  assert.equal(initialize.data.freezeAuthority?.toBase58(), modelT.toBase58());

  const [metadata] = getCreateMetadataAccountV3InstructionDataSerializer()
    .deserialize(transaction.instructions[2].data);
  assert.equal(metadata.discriminator, 33);
  assert.equal(metadata.data.name, "Internal Agency Token");
  assert.equal(metadata.data.symbol, "IAT");
  assert.equal(metadata.data.uri, "https://internalagency.io/metadata/iat.json");
  assert.equal(metadata.data.sellerFeeBasisPoints, 0);
  assert.equal(metadata.isMutable, false);
  transaction.feePayer = modelT;
  transaction.recentBlockhash = blockhash;
  const wireSize = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
  assert.ok(wireSize <= 1232, `create/initialize/metadata transaction is ${wireSize} bytes`);
});

test("recovery decodes and verifies the complete immutable metadata account", () => {
  const canonical = {
    updateAuthority: modelT.toBase58(),
    mint: modelT.toBase58(),
    name: "Internal Agency Token",
    symbol: "IAT",
    uri: "https://internalagency.io/metadata/iat.json",
    sellerFeeBasisPoints: 0,
    creators: null,
    primarySaleHappened: false,
    isMutable: false,
    editionNonce: null,
    tokenStandard: null,
    collection: null,
    uses: null,
    collectionDetails: null,
    programmableConfig: null,
  };
  const serializer = getMetadataAccountDataSerializer();
  const data = serializer.serialize(canonical);
  assert.equal(assertCanonicalMetadataAccount({
    data,
    mint: modelT,
    updateAuthority: modelT,
  }).symbol, "IAT");
  assert.throws(() => assertCanonicalMetadataAccount({
    data: serializer.serialize({ ...canonical, name: "Impostor Token" }),
    mint: modelT,
    updateAuthority: modelT,
  }), /immutable canonical IAT/);
});

test("allocation transaction mints five exact amounts and fits Solana wire limits", () => {
  const mint = Keypair.generate().publicKey;
  const { transaction, tokenAccounts } = buildMintAllocationsTransaction({
    feePayer: modelT,
    mint,
    authority: modelT,
    allocations,
    expectedSupply: FIXED_SUPPLY_BASE_UNITS,
  });

  assert.equal(tokenAccounts.length, 5);
  assert.equal(new Set(tokenAccounts.map(({ owner }) => owner.toBase58())).size, 5);
  assert.equal(transaction.instructions.length, 10);
  const mintInstructions = transaction.instructions.filter(
    (instruction) => instruction.programId.toBase58() === ORIGINAL_TOKEN_PROGRAM_ADDRESS,
  );
  const decoded = mintInstructions.map((instruction) => decodeMintToCheckedInstruction(instruction));
  assert.deepEqual(decoded.map((instruction) => instruction.data.decimals), [9, 9, 9, 9, 9]);
  assert.equal(decoded.reduce((sum, instruction) => sum + instruction.data.amount, 0n), FIXED_SUPPLY_BASE_UNITS);

  transaction.feePayer = modelT;
  transaction.recentBlockhash = blockhash;
  const wireSize = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
  assert.ok(wireSize <= 1232, `allocation transaction is ${wireSize} bytes`);
});

test("the same allocation builder accepts the exact 1,000-IAT devnet ratio", () => {
  const divisors = [500n, 200n, 150n, 100n, 50n];
  const devnetAllocations = allocations.map((allocation, index) => ({
    ...allocation,
    amount: divisors[index] * 1_000_000_000n,
  }));
  const { tokenAccounts } = buildMintAllocationsTransaction({
    feePayer: modelT,
    mint: Keypair.generate().publicKey,
    authority: modelT,
    allocations: devnetAllocations,
    expectedSupply: DEVNET_TEST_SUPPLY_BASE_UNITS,
  });
  assert.equal(tokenAccounts.reduce((sum, allocation) => sum + allocation.amount, 0n), DEVNET_TEST_SUPPLY_BASE_UNITS);
});

test("authority revocations set only the selected authority to None", () => {
  const mint = Keypair.generate().publicKey;
  for (const authorityType of [AuthorityType.MintTokens, AuthorityType.FreezeAccount]) {
    const transaction = buildRevokeAuthorityTransaction({ mint, authority: modelT, authorityType });
    assert.equal(transaction.instructions.length, 1);
    const decoded = decodeSetAuthorityInstruction(transaction.instructions[0]);
    assert.equal(decoded.data.authorityType, authorityType);
    assert.equal(decoded.data.newAuthority, null);
    assert.equal(decoded.keys.account.pubkey.toBase58(), mint.toBase58());
    assert.equal(decoded.keys.currentAuthority.pubkey.toBase58(), modelT.toBase58());
  }
});

test("resume classifier accepts only canonical state transitions", () => {
  const balances = Object.fromEntries(allocations.map(({ name, amount }) => [name, amount]));
  const base = {
    mintExists: true,
    metadataExists: true,
    decimals: TOKEN_DECIMALS,
    expectedAuthority: modelT,
    expectedAllocations: allocations,
    expectedSupply: FIXED_SUPPLY_BASE_UNITS,
  };
  assert.equal(classifyCeremonyState({
    ...base,
    supply: 0n,
    mintAuthority: modelT,
    freezeAuthority: modelT,
    allocationBalances: Object.fromEntries(ALLOCATION_ORDER.map((name) => [name, 0n])),
  }).nextStep, 1);
  assert.equal(classifyCeremonyState({
    ...base,
    supply: FIXED_SUPPLY_BASE_UNITS,
    mintAuthority: modelT,
    freezeAuthority: modelT,
    allocationBalances: balances,
  }).nextStep, 2);
  assert.equal(classifyCeremonyState({
    ...base,
    supply: FIXED_SUPPLY_BASE_UNITS,
    mintAuthority: null,
    freezeAuthority: modelT,
    allocationBalances: balances,
  }).nextStep, 3);
  assert.deepEqual(classifyCeremonyState({
    ...base,
    supply: FIXED_SUPPLY_BASE_UNITS,
    mintAuthority: null,
    freezeAuthority: null,
    allocationBalances: balances,
  }), { nextStep: 4, complete: true });
  assert.throws(() => classifyCeremonyState({
    ...base,
    supply: 1n,
    mintAuthority: modelT,
    freezeAuthority: modelT,
    allocationBalances: balances,
  }), /supply or allocation balances/);
});

test("operator signing controls are localhost-only", () => {
  assert.equal(isLocalOperatorHost("localhost"), true);
  assert.equal(isLocalOperatorHost("127.0.0.1"), true);
  assert.equal(isLocalOperatorHost("[::1]"), true);
  assert.equal(isLocalOperatorHost("internalagency.io"), false);
  assert.equal(isLocalOperatorHost("localhost.evil.example"), false);
});

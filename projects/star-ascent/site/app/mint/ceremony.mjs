import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  getCreateMetadataAccountV3InstructionDataSerializer,
  getMetadataAccountDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";

export const EXPECTED_MODEL_T_ADDRESS = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
export const TOKEN_DECIMALS = 9;
export const FIXED_SUPPLY_BASE_UNITS = 1_000_000_000_000_000_000n;
export const DEVNET_TEST_SUPPLY_BASE_UNITS = 1_000_000_000_000n;
export const ORIGINAL_TOKEN_PROGRAM_ADDRESS = TOKEN_PROGRAM_ID.toBase58();
export const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const ALLOCATION_ORDER = ["community", "treasury", "ecosystem", "coreTeam", "liquidity"];
export const CEREMONY_TRANSACTION_ORDER = [
  "CREATE_INITIALIZE_IMMUTABLE_METADATA",
  "MINT_FIVE_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
];

const METADATA_DEFAULTS = Object.freeze({
  name: "Internal Agency Token",
  symbol: "IAT",
  uri: "https://internalagency.io/metadata/iat.json",
  sellerFeeBasisPoints: 0,
  isMutable: false,
});

function publicKey(value, label) {
  try {
    return value instanceof PublicKey ? value : new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a usable Solana public key`);
  }
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function positiveBigInt(value, label) {
  if (typeof value !== "bigint" || value <= 0n) {
    throw new Error(`${label} must be a positive bigint`);
  }
}

export function deriveMetadataAddress(mint) {
  const mintKey = publicKey(mint, "Mint");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintKey.toBuffer()],
    METADATA_PROGRAM_ID,
  )[0];
}

export function assertCanonicalMetadataAccount({ data, mint, updateAuthority }) {
  let metadata;
  try {
    [metadata] = getMetadataAccountDataSerializer().deserialize(data);
  } catch {
    throw new Error("Metadata account data is not a valid Metaplex record");
  }
  if (
    metadata.mint !== publicKey(mint, "Mint").toBase58()
    || metadata.updateAuthority !== publicKey(updateAuthority, "Metadata update authority").toBase58()
    || metadata.name !== METADATA_DEFAULTS.name
    || metadata.symbol !== METADATA_DEFAULTS.symbol
    || metadata.uri !== METADATA_DEFAULTS.uri
    || metadata.sellerFeeBasisPoints !== 0
    || metadata.primarySaleHappened !== false
    || metadata.isMutable !== false
  ) {
    throw new Error("On-chain metadata does not match the immutable canonical IAT record");
  }
  return metadata;
}

export function buildCreateInitializeMetadataTransaction({
  feePayer,
  mint,
  rentLamports,
  authority = feePayer,
  metadata = METADATA_DEFAULTS,
}) {
  positiveInteger(rentLamports, "Mint rent");
  if (
    metadata?.name !== METADATA_DEFAULTS.name
    || metadata?.symbol !== METADATA_DEFAULTS.symbol
    || metadata?.uri !== METADATA_DEFAULTS.uri
    || metadata?.sellerFeeBasisPoints !== 0
    || metadata?.isMutable !== false
  ) {
    throw new Error("Ceremony metadata does not match the immutable canonical IAT record");
  }

  const payerKey = publicKey(feePayer, "Fee payer");
  const mintKey = publicKey(mint, "Mint");
  const authorityKey = publicKey(authority, "Mint authority");
  const metadataAddress = deriveMetadataAddress(mintKey);
  const metadataData = Buffer.from(
    getCreateMetadataAccountV3InstructionDataSerializer().serialize({
      data: {
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: false,
      collectionDetails: null,
    }),
  );

  const metadataInstruction = new TransactionInstruction({
    programId: METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadataAddress, isSigner: false, isWritable: true },
      { pubkey: mintKey, isSigner: false, isWritable: false },
      { pubkey: authorityKey, isSigner: true, isWritable: false },
      { pubkey: payerKey, isSigner: true, isWritable: true },
      { pubkey: authorityKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: metadataData,
  });

  return {
    metadataAddress,
    transaction: new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payerKey,
        newAccountPubkey: mintKey,
        space: MINT_SIZE,
        lamports: rentLamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKey,
        TOKEN_DECIMALS,
        authorityKey,
        authorityKey,
        TOKEN_PROGRAM_ID,
      ),
      metadataInstruction,
    ),
  };
}

export function deriveAllocationAccounts({ mint, allocations }) {
  if (!Array.isArray(allocations) || allocations.length !== ALLOCATION_ORDER.length) {
    throw new Error("Ceremony requires exactly five allocations");
  }
  const mintKey = publicKey(mint, "Mint");
  const owners = new Set();
  return allocations.map((allocation, index) => {
    const expectedName = ALLOCATION_ORDER[index];
    if (allocation?.name !== expectedName) {
      throw new Error(`Allocation ${index + 1} must be ${expectedName}`);
    }
    positiveBigInt(allocation.amount, `${expectedName} amount`);
    const owner = publicKey(allocation.owner, `${expectedName} owner`);
    if (owners.has(owner.toBase58())) throw new Error("Every allocation owner must be distinct");
    owners.add(owner.toBase58());
    const tokenAccount = getAssociatedTokenAddressSync(
      mintKey,
      owner,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    return { name: expectedName, owner, tokenAccount, amount: allocation.amount };
  });
}

export function buildMintAllocationsTransaction({
  feePayer,
  mint,
  authority,
  allocations,
  expectedSupply,
}) {
  positiveBigInt(expectedSupply, "Expected supply");
  const payerKey = publicKey(feePayer, "Fee payer");
  const mintKey = publicKey(mint, "Mint");
  const authorityKey = publicKey(authority, "Mint authority");
  const tokenAccounts = deriveAllocationAccounts({ mint: mintKey, allocations });
  const total = tokenAccounts.reduce((sum, allocation) => sum + allocation.amount, 0n);
  if (total !== expectedSupply) throw new Error("Allocation transaction does not total the exact expected supply");

  const transaction = new Transaction();
  for (const allocation of tokenAccounts) {
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payerKey,
        allocation.tokenAccount,
        allocation.owner,
        mintKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createMintToCheckedInstruction(
        mintKey,
        allocation.tokenAccount,
        authorityKey,
        allocation.amount,
        TOKEN_DECIMALS,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  return { transaction, tokenAccounts };
}

export function buildRevokeAuthorityTransaction({ mint, authority, authorityType }) {
  if (![AuthorityType.MintTokens, AuthorityType.FreezeAccount].includes(authorityType)) {
    throw new Error("Ceremony may revoke only mint or freeze authority");
  }
  return new Transaction().add(
    createSetAuthorityInstruction(
      publicKey(mint, "Mint"),
      publicKey(authority, "Current authority"),
      authorityType,
      null,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
}

export function classifyCeremonyState({
  mintExists,
  metadataExists,
  decimals,
  supply,
  mintAuthority,
  freezeAuthority,
  expectedAuthority,
  allocationBalances,
  expectedAllocations,
  expectedSupply,
}) {
  if (!mintExists) return { nextStep: 0, complete: false };
  if (
    !metadataExists
    || decimals !== TOKEN_DECIMALS
  ) {
    throw new Error("On-chain mint state cannot safely resume the canonical ceremony");
  }
  for (const [label, authority] of [["mint", mintAuthority], ["freeze", freezeAuthority]]) {
    if (authority !== null && !authority.equals(expectedAuthority)) {
      throw new Error(`On-chain ${label} authority cannot safely resume the canonical ceremony`);
    }
  }
  const expectedBalances = Object.fromEntries(
    expectedAllocations.map(({ name, amount }) => [name, amount]),
  );
  const balancesMatch = ALLOCATION_ORDER.every(
    (name) => allocationBalances?.[name] === expectedBalances[name],
  );
  if (supply === 0n && ALLOCATION_ORDER.every((name) => (allocationBalances?.[name] ?? 0n) === 0n)) {
    return { nextStep: 1, complete: false };
  }
  if (supply !== expectedSupply || !balancesMatch) {
    throw new Error("On-chain supply or allocation balances do not match the canonical ceremony");
  }
  if (mintAuthority && freezeAuthority) return { nextStep: 2, complete: false };
  if (mintAuthority === null && freezeAuthority) return { nextStep: 3, complete: false };
  if (mintAuthority === null && freezeAuthority === null) return { nextStep: 4, complete: true };
  throw new Error("Authority state is not a valid point in the canonical ceremony");
}

export function isLocalOperatorHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export { AuthorityType, MINT_SIZE, TOKEN_PROGRAM_ID };

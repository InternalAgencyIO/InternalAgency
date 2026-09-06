# B3 production local rehearsal contract

Status: `HOLD`. This contract defines a source-bound, loopback-only evidence lane. It is not Devnet evidence, Mainnet authorization, or an executed rehearsal receipt.

## Authority boundary

The command-line driver remains preflight-only. A future execution caller must supply an `OFFICIAL_READY` preflight produced by the built-in identity and Docker receipt validators. Immediately before any RPC call or signer-file read, the execution engine reruns those built-in validators without dependency overrides and exact-compares the complete preflight record. A test-only preflight can drive only an injected fake adapter and can produce only `HOLD_TEST_EXECUTION_ONLY`.

The source-bound adapter accepts only an exact numeric-loopback URL (`http://127.0.0.1:<port>/`). It never starts a validator, requests an airdrop, selects a public Solana endpoint, generates a key, or deploys a program. Program and ProgramData accounts, loader ownership, upgrade-authority state, and deployed ELF bytes are reobserved before every fixture account. Every fixture must then match its PDA, owner, executable flag, length, byte hash, named source-derived codec, and decoded-state hash before the adapter may read an ephemeral signer file.

## The two genesis hashes are different evidence

`validatorGenesisHash` is the observed genesis hash of the disposable loopback ledger. It must be nonzero, must differ from `compiledLawDomainGenesisHash`, and is recorded in the execution receipt with `validatorGenesisClaimedMainnet: false`. It is not compared with Mainnet genesis and is never Mainnet identity evidence.

`compiledLawDomainGenesisHash` is the Mainnet decision-domain hash compiled into the Economy final artifact and bound by the production identity manifest and Economy Docker build receipt. The local exact-final-byte lane preloads the production program IDs and canonical mint without possessing their private keys. The exact Law-state bytes at offsets 48–79 must contain this compiled domain hash, and the source-derived Law codec must decode the same value, before signer loading.

Economy does not authenticate the running validator's cluster genesis. It authenticates the stored Law state against its compiled decision domain. Conflating the disposable ledger genesis with the compiled Law domain would make an exact-final-byte local rehearsal impossible and would misstate what the program enforces.

## Required domain cases

The execution plan records two unexecuted cases:

- Positive: a finalized Law state carrying `compiledLawDomainGenesisHash`, followed by all 15 expected-disposition transactions and rollback targets `[5, 6, 7, 9, 10]` plus standalone retries.
- Negative: the same final Economy bytes with a Law state carrying the disposable local-domain hash; Economy must return `DailyLawRejected` (`0xE503`) before an operation handler.

One immutable Law-state PDA cannot represent both domains in one ledger. The negative case therefore requires a separately prepared disposable loopback ledger or an equivalent source-bound reset protocol. That dual-ledger execution is not implemented or observed yet. Receipts retain `NEGATIVE_LOCAL_DOMAIN_DAILY_LAW_REJECTION_NOT_EXECUTED` and `POSITIVE_COMPILED_DOMAIN_DAILY_LAW_ACCEPTANCE_NOT_ACCEPTED`; `COMPLETE` is categorically invalid.

## Devnet separation

A disposable Devnet build may be used for behavioral rehearsal only. It is not final-byte evidence and cannot satisfy the production artifact, compiled-domain, deployment-byte, rollback, identity, release, or Mainnet gates. No public Devnet or Mainnet RPC is accepted by this local adapter.

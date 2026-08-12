# Disposable combined Law + stake-ingress validator fixture

This nested Cargo package is not a member of the production program workspace.
Its only executable is a disposable economy-side driver for a loopback
`solana-test-validator` rehearsal. It imports the feature-gated production
stake-ingress executor, creates the canonical fixture stake vault, signs for
the stateless ingress PDA, and sends a real Token-2022 transfer through the
separately built `iat_b3_law` artifact.

The hook is **not** reimplemented here. The rehearsal builds
`programs/iat_b3_law` with `production-combined-hook`; that exact single ELF
serves as both the Daily Law finalizer and Token-2022 Transfer Hook. Its Law
program ID, this fixture economy ID, and a fresh disposable mint are immutable
build inputs for that run.

The fixed fixture identities are conspicuous repeated-byte public keys:

- Law/combined hook: `[0xB3; 32]`;
- economy driver: `[0xE3; 32]`.

Neither identity, binary, source file, generated mint, ledger, nor evidence
record is a production candidate. The runner removes the ignored target,
generated key material, compiled artifacts, account fixtures, and ledger on
every exit. It never selects Devnet or Mainnet and never changes the canonical
release graph.

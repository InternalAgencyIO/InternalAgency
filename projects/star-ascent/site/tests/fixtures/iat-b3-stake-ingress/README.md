# Disposable stake-ingress validator fixtures

These two native Solana programs exist only to rehearse the proposed B3
stake-ingress mechanics on a disposable loopback validator. They are a nested
Cargo workspace and are not members of the production program workspace.

- `hook` implements the already-reviewed canonical stake-vault and ingress-PDA
  admission rule plus Token-2022's `transferring` context check.
- `economy` performs real `ApproveChecked` and hooked `TransferChecked` CPIs,
  signs for the stateless ingress PDA, reloads token state, and restores a
  captured prior delegate exactly.

“Stateless” is the protocol property: admission binds only the canonical PDA
key and signer seeds. It has no account-existence, lamports, owner, data,
executable-bit, or other state prerequisite. The rehearsal deliberately funds
the PDA as a System Program-owned, zero-data, non-executable account before
both successful ingress paths and proves that this unsolicited state does not
disable either path. That one funded state is runtime evidence; the absence of
all state predicates is also checked directly in the fixture source.

Both IDs are conspicuous fixture constants. Neither binary, program ID, nor
source file is a deployment candidate. The runner builds into an ignored
fixture target directory and deletes validator ledgers and generated keys.

# Model T Solana signing gate

Status: **required / not yet completed / mainnet HOLD**

The same Model T, cable, computer, wallet interface, public administrator
address, and review procedure intended for mainnet must be used for the V2
devnet rehearsal. The disabled `/mint` route is not the V2 rehearsal.

## Device boundary

- Confirm the full public administrator address on the physical device.
- Never enter or transmit a seed phrase, PIN, passphrase, private key, recovery
  material, wallet export, derivation path, or program keypair.
- Reject blind, unclear, unexpected, or differently ordered prompts.
- Automation may prepare and simulate, but it may not approve or broadcast.
- Capture one direct Explorer/RPC result for each authority or value boundary.

## Required V2 evidence

| Boundary | Required proof |
| --- | --- |
| Program deployment | Public program and ProgramData accounts match the verifiable SBF hash |
| Authority transfer | Upgrade authority becomes the reviewed Model T address before IAT funding |
| Mint and metadata | Original SPL, 9 decimals, canonical immutable metadata |
| Program initialization | Config, four lane vaults, stake vault, policy and randomness program match |
| Allocation funding | Exact 50/20/15/10/5 scaled devnet balances reach the reviewed destinations |
| Authority revocation | Mint and freeze authorities are both `None` |
| Activation | All build, randomness, vault, and authority preconditions are satisfied |
| Policy matrix | Every required positive case succeeds and every required negative case rejects |

## Decision rule

**PASS** only when the completed V2 rehearsal evidence:

- binds the exact committed source, policy digests, program ID, SBF hash, mint,
  ProgramData, vaults, and token accounts;
- proves hardware control before token funding;
- proves the official devnet Switchboard commit/reveal path without reroll;
- contains complete positive and negative scenario evidence; and
- is independently checked by FDF Guard in the same review window.

**HOLD** on any mismatch, stale evidence, unexplained retry, successful negative
case, missing transaction, credential request, or unavailable direct evidence.

## Mainnet dependency order

1. Complete source binding, locked SBF build, security/economic review, and
   local-validator tests.
2. Complete the full V2 devnet rehearsal.
3. Independently compare program, authority, mint, destinations, vaults,
   policies, randomness, and failure paths.
4. Freeze source, binary, configuration, evidence, and public payload digests.
5. Start a separate mainnet review session.
6. Physically confirm every mainnet authority and value boundary.
7. Publish only independently verified on-chain facts.

No substitute wallet path is allowed under time pressure.

## References

- Trezor, [Solana and Trezor](https://trezor.io/learn/supported-assets/solana/solana-what-it-is-and-how-it-works-with-trezor)
- Anchor, [verifiable builds](https://www.anchor-lang.com/docs/references/verifiable-builds)
- Solana, [deploying programs](https://solana.com/docs/programs/deploying)
- Switchboard, [Solana randomness](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness)

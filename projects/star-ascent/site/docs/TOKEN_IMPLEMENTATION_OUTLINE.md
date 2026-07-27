# $IAT Genesis Token Implementation Outline

Status: design outline only. No mint, authority change, token account, time lock, or distribution is created by this repository.

## Lean Genesis architecture

| Layer | Genesis decision |
| --- | --- |
| Token standard | Original SPL Token Program |
| Decimals | 9 |
| Supply target | 1,000,000,000 IAT |
| Token extensions | None at Genesis |
| Mint authority | Revoked only after the documented full initial mint |
| Freeze authority | Revoked after the documented full initial mint |
| Signing model | Trezor Model T physical confirmation after the exact devnet rehearsal passes |
| Public state before evidence | HOLD — no claim, sale, transfer request, or wallet-connect promise |

This is deliberately a standard token configuration. A custom on-chain program is not required to create a fixed-supply SPL token, and adding one under deadline would create more audit and signer risk.

## Required transaction families

1. Create the mint account.
2. Initialize the mint with the intended decimals and temporary authorities.
3. Create the public allocation destinations or verified lock destinations.
4. Mint the full, fixed supply exactly once into those destinations.
5. Independently verify supply, decimals, program, and allocations.
6. Set mint authority to `None`.
7. Set freeze authority to `None`.
8. Publish the evidence packet before any distribution route is enabled.

## Time-lock implementation choice

The allocation model needs one explicit choice before it can be described as locked:

- **External audited lock / vesting protocol:** fastest if its current Solana support, public contracts, and hardware-wallet transaction path are verified during the rehearsal.
- **Dedicated multisig custody + published release policy:** simpler operationally but is custody, not a cryptographic time lock; it must never be labelled a time lock.
- **New custom lock contract:** not suitable for a two-day Genesis without independent review and a complete Model T rehearsal.

No choice is assumed here. Until the chosen mechanism has public addresses, public terms, and on-chain evidence, all non-circulating allocations remain marked `PENDING`.

## Required final input bundle

Before mainnet, the operator and verifier must freeze a public manifest containing final token name/ticker, every labelled allocation address, selected lock mechanism/dates, exact integer token amounts, the devnet-proven signer path, and direct Explorer links for every mainnet transaction.

## Hard stops

- No unverified wallet interface or unclear device prompt.
- No seed phrase, private key, PIN, passphrase, or secret in source control, chat, or a web form.
- No claim, sale, yield, or return language before its public evidence exists.
- No label of “time locked” for a wallet that is merely controlled by a team or multisig.

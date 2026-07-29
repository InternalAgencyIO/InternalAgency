# Model T Solana Signing Gate

Status: required before Genesis. This is a capability gate, not a claim that a mint exists.

## Fixed ceremony

The same Trezor Model T, cable, computer, Backpack path, transaction builder, metadata, allocation ratios, and instruction order planned for mainnet must complete this exact devnet rehearsal:

| Transaction | Required proof |
| --- | --- |
| 1. Create + initialize + immutable metadata | One atomic transaction; Original SPL, 9 decimals, temporary Model T mint/freeze authorities, canonical Metaplex PDA and URI |
| 2. Mint five allocations | Five distinct owners and canonical ATAs with the exact 50/20/15/10/5 test-supply balances |
| 3. Revoke mint authority | Mint record shows `None`; exact supply is unchanged |
| 4. Revoke freeze authority | Freeze record shows `None`; exact supply is unchanged |

Every transaction must be simulated, reviewed on the device, submitted separately, confirmed without error, and recorded with a distinct canonical Solana Explorer devnet URL. The device operator and independent verifier must bind the same four actions, four transaction proofs, mint, metadata PDA, five owners, five ATAs, exact amounts, and reviewed mainnet-plan digest.

## Decision rule

**GO** only when `launch/devnet-rehearsal.template.json` is `COMPLETED`, its validator passes against the current metadata and allocation-lock plans, the evidence is less than 24 hours old, and the independent review follows the device ceremony within 30 minutes.

**HOLD** if any prompt is unclear or blind; the wallet cannot construct the exact instructions; an address, amount, program, metadata record, or authority differs; evidence is stale or reused; or any surface requests a seed phrase, private key, PIN, passphrase, wallet export, or recovery material.

No substitute wallet path is allowed on mainnet under time pressure.

## Mainnet dependency order

1. Independently approve immutable metadata and the external lock/vault plan.
2. Complete the exact four-transaction devnet rehearsal.
3. Freeze and validate signer, allocation, handoff, snapshot, and release-packet digests.
4. Open the localhost-only mint console using the reviewed configuration digest.
5. Physically confirm each mainnet transaction on the Model T.
6. Independently verify metadata, supply, five balances, and both revoked authorities.
7. Publish the evidence packet, then enable any distribution route.

## References

- Trezor, [Solana and Trezor](https://trezor.io/learn/supported-assets/solana/solana-what-it-is-and-how-it-works-with-trezor)
- Backpack, [Connect a hardware wallet](https://support.backpack.exchange/wallet/actions/connect-hardware-wallet)
- Solana, [Token basics](https://solana.com/docs/tokens/basics)
- Solana, [Metaplex token metadata](https://solana.com/docs/tokens/metaplex)

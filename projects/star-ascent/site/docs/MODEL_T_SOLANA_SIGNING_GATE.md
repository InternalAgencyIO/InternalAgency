# Model T Solana Signing Gate

Status: required before Genesis. This is a capability gate, not a claim that a mint has been created.

## What is confirmed

- Trezor Model T is supported for Solana and SPL-token custody in Trezor's supported-assets documentation.
- The signer must physically review and approve each transaction on the Model T touchscreen.
- Genesis uses the original SPL Token Program, nine decimals, and no Token-2022 extensions.

## What must be proven on this exact setup

Solana/SPL support alone does not prove that the chosen wallet interface can build and send the full fixed-supply mint sequence. The same Model T, cable, computer, wallet interface, and transaction-building path planned for mainnet must complete a devnet rehearsal of all of these actions:

| Action | Required proof |
| --- | --- |
| Create mint account | Devnet Explorer transaction and clear device confirmation |
| Initialize mint | Decimals, mint authority, and freeze authority match the rehearsal manifest |
| Create allocation destinations | Every destination is independently checked before signing |
| Mint test supply | Explorer shows exact test supply and destination balances |
| Revoke mint authority | Mint record shows `None` |
| Revoke freeze authority | Mint record shows `None` |

## Decision rule

**GO** only when all six actions are completed on devnet and their public signatures are recorded in the evidence packet.

**HOLD** if the wallet cannot construct one of the required instructions, if the device prompt is unclear, or if the interface asks for a seed phrase, private key, PIN, passphrase, or unexplained blind approval. Do not substitute an unfamiliar signing route on mainnet under time pressure.

## Safe division of work

- Builder: prepares the transaction and shows the human-readable manifest.
- Signer: reviews recipient addresses and physically approves only on the Model T.
- Verifier: checks Explorer after each transaction and blocks publication on any mismatch.
- Broadcaster: changes public status from HOLD only after the evidence packet is complete.

## Mainnet dependency order

1. Complete the exact devnet rehearsal.
2. Freeze the public allocation and time-lock addresses.
3. Produce the final manifest and independently compare every address.
4. Sign the mainnet sequence in the documented order.
5. Verify supply, program, decimals, allocations, and both revoked authorities in Explorer.
6. Publish the evidence packet, then enable any public claim or distribution route.

## References

- Trezor, [Solana and Trezor](https://trezor.io/learn/supported-assets/solana/solana-what-it-is-and-how-it-works-with-trezor)
- Trezor, [Model T guide](https://trezor.io/guides/trezor-devices/trezor-model-t/get-started-with-the-model-t)
- Trezor, [transaction-signing tool reference](https://docs.trezor.io/trezor-suite/packages/suite-desktop/skills/trezor-mcp/references/tools-reference.html)

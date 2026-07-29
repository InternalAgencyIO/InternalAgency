# Mint Account Signer Gate

Status: mandatory devnet rehearsal item before IAT Genesis.

## Why this exists

Creating a standard SPL mint account requires more than the fee-payer signature. The new mint account itself must authorize its creation as a new account. Solana's token-creation documentation describes this as two signatures: the wallet that pays for creation and the newly generated mint account.

The Trezor Model T must remain the only long-lived authority and fee-payer signer. The mint-account signer is a one-time, local-only account-creation signer; it must never be placed in chat, source control, a web form, screenshots, or the public evidence packet.

## Required devnet proof

The exact mainnet transaction-builder must demonstrate all of the following on devnet:

1. Generate the mint account locally inside the approved transaction-building path.
2. Present the resulting mint public address to the verifier before the transaction is signed.
3. Add the one-time mint-account signature locally without exporting its private material.
4. Request the fee-payer/authority signature through the Trezor Model T, with clear physical confirmation.
5. In the same atomic transaction, create immutable Metaplex metadata at the canonical PDA with the reviewed IAT name, symbol, and URI.
6. Broadcast the create-initialize-metadata transaction.
7. Verify the mint program, decimals, temporary authority fields, public address, metadata program owner, and metadata PDA in Explorer.
8. Continue with the five-destination allocation mint and both authority revocations.

## Mainnet rules

- Do not pre-generate or paste a mint private key into a document, terminal history, repository, chat, or browser.
- Do not use a cloud wallet, browser wallet seed import, or remote “token launch” service as a shortcut.
- Do not publish the mint address until the completed on-chain sequence and evidence packet have been independently checked.
- The temporary mint-account signer is not a mint authority. It is only required to create the mint account address.
- If the selected Trezor-compatible workflow cannot handle the combined transaction with a local mint signer and a clear Model T confirmation, HOLD the launch and use no substitute path under time pressure.

## Evidence to retain

Public: mint and metadata addresses, transaction signature, Explorer links, program, decimals, supply, authority states, and allocation/lock links.

Never retain or publish: mint account private material, seed phrases, PINs, passphrases, or any device secret.

## References

- Solana, [Create a token mint](https://solana.com/docs/tokens/basics/create-mint)
- Solana, [Writing to the network](https://solana.com/docs/intro/quick-start/writing-to-network)
- Trezor, [Solana transaction requirements](https://docs.trezor.io/trezor-suite/packages/suite-desktop/skills/trezor-mcp/references/tools-reference.html)

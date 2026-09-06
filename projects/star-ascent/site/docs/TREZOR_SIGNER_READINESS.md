# Trezor Signer Readiness - Genesis

## Non-negotiable rule

The sole signer physically confirms every transaction on the Trezor device. No seed phrase, device PIN, passphrase, recovery code, private key, or signing secret is ever entered into this repository, a browser form, chat, or a script.

## Device compatibility gate

An older touch-screen Trezor may be a Model T. Do not assume it can sign the complete Solana mint and authority-revocation sequence merely because it can receive SOL.

Before mainnet:

1. Confirm the exact device model, firmware version, and Trezor Suite version.
2. Install or update only through the official Trezor Suite application from trezor.io.
3. Confirm a Solana primary wallet address on the device display.
4. Rehearse the exact transaction class on devnet through a Trezor-compatible Solana wallet interface.
5. Confirm the device displays a comprehensible transaction for every required action.
6. Rehearse the one-time local mint-account signer plus the Model T fee-payer signature in the same create-and-initialize-mint transaction. See `MINT_ACCOUNT_SIGNER_GATE.md`.

If any transaction is unsupported, confusing, or cannot be checked exactly on-device against the source-bound intent, stop. Do not improvise on Mainnet.

## Genesis implementation choice

Use the original SPL Token Program with 9 decimals and no Token-2022 extensions for Genesis. This minimizes wallet and exchange compatibility risk. There is no custom contract required for a fixed-supply standard SPL token.

Target supply: 1,000,000,000 IAT.

The target is not a fact until the completed mint and evidence packet are published.

## Mandatory devnet rehearsal

Run the complete sequence with a test mint and test recipient addresses:

1. Create a mint with the intended decimals, mint authority, and freeze authority.
2. Create the intended allocation token accounts or time-lock destinations.
3. Mint the test supply to the test destinations.
4. Revoke mint authority.
5. Revoke freeze authority.
6. Inspect the mint and every authority in Solana Explorer.
7. Record every devnet transaction signature and verify the device can sign the exact sequence.

The rehearsal must use the same wallet interface, computer, cable, Trezor device, and transaction-building path planned for mainnet.

## Mainnet room setup

- Signer: physically controls the unlocked Trezor and confirms every address on-device.
- Builder: prepares transactions only; cannot sign.
- Automated evidence lane: checks recipient addresses, transaction summaries, Explorer records, receipts, and state against the bound packet; it cannot sign.
- Broadcaster: publishes only approved, verified information.

Use a second screen or a printed manifest. Never rely on a clipboard value as the only address check.

## Mainnet order

1. Freeze the final public manifest: program, decimals, target supply, recipient addresses, and lock destinations.
2. Confirm the signer address on the Trezor display and fund it with only the required SOL operational buffer.
3. Create the mint.
4. Create allocation/token-account or verified lock destinations.
5. Mint the full fixed supply exactly once.
6. Verify total supply and all destination balances in Explorer.
7. Revoke mint authority by setting it to `None`.
8. Revoke freeze authority by setting it to `None`.
9. Verify both revoked authorities in Explorer.
10. Publish the evidence packet and only then update the site status from HOLD.

Do not revoke mint authority before all intended Genesis minting is complete. Do not promise time locks until their public destination and lock mechanism have been verified.

## STOP conditions

Stop the launch and publish HOLD if any one of these is true:

- The hardware device cannot display or approve the transaction clearly.
- The tool asks for a recovery phrase, private key, or blind signing that cannot be explained.
- A recipient address differs between the manifest, device confirmation, and automated source/receipt/state evidence.
- The executed supply, program, decimals, or authority state differs from the manifest.
- Any time-lock or allocation evidence is incomplete.

## What the signer reports after every transaction

Only non-secret evidence:

- Solana Explorer transaction URL
- Mint address
- Program identifier
- Confirmed supply and decimals
- Confirmed authority fields
- Allocation / lock addresses

Never report or capture recovery material, PINs, passphrases, private keys, or device screens containing them.

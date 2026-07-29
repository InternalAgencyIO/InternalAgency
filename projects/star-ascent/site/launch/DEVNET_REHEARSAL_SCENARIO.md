# $IAT Model T devnet rehearsal scenario

**Public ceremony window:** 29 July 2026 at 14:15:18 UTC / 17:15:18 Istanbul

**Rehearsal status:** required before any mainnet decision

**Reviewed public signer:** `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`

The scheduled window opens the public broadcast and makes the reviewed
open-source ceremony eligible for human-approved execution. It does not
automatically connect a wallet, sign, submit, or unlock mainnet.

## 1. Fund the devnet fee payer

The local operator page checks the live devnet balance after Backpack connects.

1. Open `https://faucet.solana.com/` only if the balance is below `0.03` devnet
   SOL.
2. Select devnet and paste only the reviewed public address above.
3. Request enough faucet SOL to leave at least `0.03` devnet SOL available.
4. Never send mainnet SOL to satisfy this rehearsal step.

## 2. Freeze the signing path

- Use the same Windows computer, cable, Trezor Model T, Backpack extension, and
  Solana account intended for mainnet.
- Record the public firmware version and Backpack version.
- Confirm the reviewed address on the physical device.
- Close unrelated wallet tabs and applications.
- Do not enter a seed phrase, PIN, passphrase, private key, or wallet export
  into the browser, terminal, Codex, or any message.

## 3. Open the local ceremony

1. Open `http://localhost:3000/mint`.
2. Confirm the page says `DEVNET REHEARSAL` and `MAINNET LOCKED`.
3. Connect Backpack.
4. Confirm the page reports that the reviewed Model T address matches.
5. Confirm the displayed devnet balance is at least `0.03 SOL`.

## 4. Execute exactly four devnet transactions

Stop on any unexpected or unclear device prompt.

1. `CREATE_INITIALIZE_IMMUTABLE_METADATA`
   - Generate the public rehearsal addresses.
   - Simulate the transaction.
   - Confirm mint creation, 9 decimals, Original SPL Token Program, and immutable
     metadata intent before approving on the Model T.
2. `MINT_FIVE_ALLOCATION_DESTINATIONS`
   - Confirm five distinct destination accounts.
   - Confirm the exact devnet amounts: `500000000000`, `200000000000`,
     `150000000000`, `100000000000`, and `50000000000` base units.
3. `REVOKE_MINT_AUTHORITY`
   - Confirm only mint authority is being set to `None`.
4. `REVOKE_FREEZE_AUTHORITY`
   - Confirm mint authority is already `None`.
   - Confirm freeze authority is being set to `None`.

Do not batch, skip, reorder, retry blindly, or replace a failed transaction.
Use the on-chain resume function only after independently checking the public
mint address and the already-confirmed transaction.

## 5. Export and independently verify

1. Download `iat-devnet-ceremony-evidence.json` from the local ceremony.
2. Give the JSON to a verifier who did not operate the Model T.
3. The verifier checks all four distinct devnet signatures, the canonical
   metadata PDA and metadata fields, the five owners and associated token
   accounts, exact supply, and both revoked authorities.
4. Return the evidence JSON, operator label, verifier label, firmware version,
   Backpack version, and completion time to Codex.

The canonical rehearsal record remains `PLANNED` until those human and on-chain
checks are supplied and validated. A completed devnet rehearsal still does not
authorize mainnet; metadata, lock-plan, signer, handoff, and release-packet
gates remain separate.

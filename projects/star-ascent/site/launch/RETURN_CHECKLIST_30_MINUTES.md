# $IAT return checklist — final 30 minutes

**Ceremony window:** 29 July 2026 at 15:00:00 UTC / 18:00:00 Istanbul

The countdown opens the public ceremony window. It does not automatically
connect a wallet, sign, submit, or authorize mainnet.

## Bring back

- Trezor Model T, cable, and the computer that will be used for the rehearsal.
- Backpack open on the Solana devnet account whose public address is
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`.
- At least `0.03` devnet SOL on that public address. The local operator page
  will check this live; use `https://faucet.solana.com/` only if it is short.
- The public Trezor firmware version and public Backpack version.
- A short operator label and a different independent-verifier label.
- Final public mainnet recipient addresses for all five allocations, plus the
  final lock method and public lock schedule for every locked allocation.
- The livestream or announcement URL, if one will be used.

Never provide a seed phrase, PIN, passphrase, private key, recovery material,
wallet export, or derivation path.

## Do together

1. Open `http://localhost:3000/mint` and confirm `DEVNET REHEARSAL`,
   `MAINNET LOCKED`, the exact signer address, and at least `0.03` devnet SOL.
2. Connect Backpack and physically verify the public address on the Model T.
3. Execute exactly four devnet transactions, with a separate physical device
   confirmation for each:
   - create mint + initialize 9 decimals + immutable metadata;
   - mint the exact five allocations;
   - revoke mint authority;
   - revoke freeze authority.
4. Download `iat-devnet-ceremony-evidence.json`.
5. Independently verify all four signatures, the metadata PDA and fields, five
   owners and canonical token accounts, exact supply, and both revoked
   authorities.
6. Re-run the complete release gate. Mainnet remains `HOLD` if any recipient,
   lock, signer, rehearsal, handoff, publication, or independent-review field
   is unresolved.

## Mainnet boundary

No countdown state, site deployment, source publication, devnet success, or
verbal approval alone authorizes mainnet. The operator reviews every physical
device prompt; stop on any mismatch or unclear instruction.

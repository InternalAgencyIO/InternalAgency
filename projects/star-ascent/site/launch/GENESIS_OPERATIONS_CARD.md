# $IAT Genesis Operations Card

Use this as a one-page run-of-show. No secret, recovery phrase, PIN, private key, passphrase, or wallet export belongs on this card.

## Roles

| Role | Required action |
| --- | --- |
| Signer | Physically reviews and confirms only comprehensible transactions on the Trezor Model T. |
| Builder | Prepares transactions from the frozen manifest; cannot substitute addresses. |
| Verifier | Independently checks every address, amount, authority state, and Explorer result. |
| Broadcaster | Publishes only text copied from the verified publication payload. |

## Before 13:30 UTC

- [ ] Model T model, firmware, and selected wallet interface match the successful devnet rehearsal.
- [ ] The signer address is confirmed on the device display.
- [ ] Mainnet manifest has been independently checked character-for-character.
- [ ] Every allocation destination and lock destination is labelled in the manifest.
- [ ] Both `internalagency.io` and `ileriakil.com` show HOLD with no mint address.
- [ ] Broadcast screen and pinned-post template contain no unverified address.

## 13:30 UTC — broadcast opens

Say only: the project is live, the evidence sequence is about to begin, and the official mint is not published until the on-chain checks are complete. Do not announce a claim, sale, price, yield, or address.

## Mainnet sequence

1. Create mint account.
2. Initialize original SPL mint: IAT, 9 decimals, temporary mint/freeze authorities.
3. Create final allocation or independently verifiable lock destinations.
4. Mint the full fixed supply exactly once.
5. Verifier checks supply, decimals, program, and every destination in Explorer.
6. Revoke mint authority to `None`.
7. Revoke freeze authority to `None`.
8. Verifier checks both authority fields in Explorer.
9. Fill and validate `genesis-manifest.json` and the public evidence packet.
10. Publish the exact same facts to website, pinned announcement, and livestream.

## STOP — return to HOLD immediately if

- a device confirmation is unclear or unexpected;
- an address, amount, program, decimal, or authority value differs from the frozen manifest;
- the devnet-proven signing path cannot produce the required mainnet transaction;
- Explorer evidence is unavailable or inconsistent;
- a lock is only a custody wallet but was described as a time lock.

## Minimum public payload after verification

- Mint address and mainnet Explorer link
- Original SPL Token Program confirmation and 9 decimals
- Exact total supply
- Mint authority revocation transaction and Explorer link
- Freeze authority revocation transaction and Explorer link
- Allocation / lock destination map and evidence links
- UTC checked-at time and verifier role


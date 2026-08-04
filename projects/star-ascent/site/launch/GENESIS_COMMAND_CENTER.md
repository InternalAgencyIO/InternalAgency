# STAR ASCENT — Genesis Command Center

**Schedule:** UNSCHEDULED

**Genesis ceremony window:** replacement UTC time not published; mainnet remains **HOLD**

**Signing device:** Trezor Model T; signing remains a physical operator action.

## Before broadcast

1. In the attended final review, run
   `node scripts/run-launch-preflight.mjs --require-ceremony-ready`. The default
   preflight is preparation-only and cannot open the ceremony.
2. Open the live site, `/launch`, `/signal`, and `/dossier` in independent tabs.
3. Confirm the Trezor Model T firmware, PIN, recovery material security, and the intended public address on the device screen. Do not type recovery words into a computer or browser.
4. Keep the publication payload in **HOLD** until independently verified evidence exists. Do not infer an address, transaction, allocation, or authority state.

## Window-opening sequence

1. After funding is confirmed and one replacement UTC time is published, open
   the broadcast and public source record at that reviewed time. No clock
   connects, signs, or submits anything.
2. Identify the official site and Signal directory.
3. State the verification rule: no direct messages, no paid registration, no
   seed phrase, and no copied links.
4. Complete the exact devnet scenario in
   [DEVNET_REHEARSAL_SCENARIO.md](./DEVNET_REHEARSAL_SCENARIO.md).
5. Perform the reviewed mainnet flow only if every separate evidence gate passes.
6. After each action, capture direct public evidence before announcing it.
7. Update the site, Dossier, pinned announcement, and broadcast screen together.

## Evidence gate

Publish nothing as verified until all of these are independently observable:

- Mint address, program, decimals, and exact supply.
- Mint authority and freeze authority state.
- Allocation wallets, percentages, amounts, and time-lock evidence.
- UTC timestamp and independent verifier identity.

## First hour

Use [FIRST_HOUR_RECONCILIATION.md](./FIRST_HOUR_RECONCILIATION.md) for the reconciliation loop and [POST_GENESIS_PUBLIC_UPDATE.md](./POST_GENESIS_PUBLIC_UPDATE.md) for the public update. Any missing evidence returns the public status to **HOLD**.

## Linked operator material

- [Trezor signer readiness](../docs/TREZOR_SIGNER_READINESS.md)
- [Model T Solana signing gate](../docs/MODEL_T_SOLANA_SIGNING_GATE.md)
- [Broadcast call sheet](./BROADCAST_CALL_SHEET.md)
- [Launch day card](./LAUNCH_DAY_CARD.md)
- [Genesis operations card](./GENESIS_OPERATIONS_CARD.md)

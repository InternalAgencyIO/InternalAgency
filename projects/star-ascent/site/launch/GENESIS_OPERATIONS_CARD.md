# $IAT Genesis Operations Card

Status: **HOLD — CEREMONY WINDOW 29 JULY 2026, 15:00:00 UTC**

Use this as a one-page run-of-show. No secret, recovery phrase, PIN, private
key, passphrase, or wallet export belongs on this card.

## Roles

| Role | Required action |
| --- | --- |
| Signer | Physically reviews and confirms only comprehensible transactions on the Trezor Model T. |
| Builder | Prepares transactions from the frozen manifest; cannot substitute addresses. |
| Verifier | Independently checks every address, amount, authority state, and Explorer result. |
| Broadcaster | Publishes only text copied from the verified publication payload. |

## Canonical artifact gates

Complete these gates in order. A locally passing gate never authorizes a
transaction or publication.

1. Validate `launch/token-metadata.template.json`,
   `launch/allocation-lock-plan.template.json`, and
   `launch/genesis-manifest.template.json` while all release evidence remains
   `HOLD` / `null`.
2. Complete the exact four-transaction Model T rehearsal in
   `launch/devnet-rehearsal.template.json` and move
   `launch/genesis-signing-checklist.template.json` to `READY`.
3. Generate and validate `launch/release-snapshot.generated.json` in `HOLD`.
   Never edit this generated file by hand.
4. Independently review the public surfaces and record that review time.
5. Validate `launch/mainnet-handoff.template.json` as `APPROVED`,
   `launch/release-packet.template.json` as `READY`, and
   `launch/pre-publication-packet-proof.generated.json` against the exact frozen
   files. Keep `launch/PUBLICATION_PAYLOAD.template.md` on `HOLD`.
6. The public ceremony window opens at 15:00:00 UTC. This is not mainnet
   authorization; mainnet remains locked unless all previous gates are current.

The snapshot, handoff, packet, and proof bind reviewed files; they never sign,
submit, or approve a transaction.

## Exact planned allocation math

These are reviewed targets, not claims of completed minting. The five base-unit
amounts must total exactly `1000000000000000000` at 9 decimals.

| Destination | Share | Base units |
| --- | ---: | ---: |
| Community | 50% | `500000000000000000` |
| Treasury | 20% | `200000000000000000` |
| Ecosystem | 15% | `150000000000000000` |
| Core team | 10% | `100000000000000000` |
| Liquidity | 5% | `50000000000000000` |

## Before a new window is scheduled

- [ ] Model T model, firmware, and wallet interface match the successful devnet rehearsal.
- [ ] Fee-payer/signer address is confirmed on the physical device and matches the READY signing checklist.
- [ ] Every allocation owner, derived token account, lock mechanism, and exact base-unit amount matches the READY artifacts.
- [ ] Release owner, independent verifier, and correction owner are named, usable, and distinct.
- [ ] Both public domains show `HOLD` with no mint address.
- [ ] Broadcast screen and pinned-post template contain no unverified address.

## Exact four-transaction ceremony

Do not insert, remove, rename, or reorder a transaction.

1. `CREATE_INITIALIZE_IMMUTABLE_METADATA` — atomically create the mint, initialize
   9 decimals under the Original SPL Token Program, and create immutable
   Metaplex metadata.
2. `MINT_FIVE_ALLOCATION_DESTINATIONS` — create/verify the five canonical
   associated token accounts and mint the exact reviewed base-unit amounts.
3. `REVOKE_MINT_AUTHORITY` — revoke mint authority to `None`; independently
   verify the transaction and mint account.
4. `REVOKE_FREEZE_AUTHORITY` — revoke freeze authority to `None`; independently
   verify the transaction and mint account.

After all four confirmations, independently verify the mint, immutable
metadata, supply, five allocation accounts, and both revoked authorities.
Publication is a separate human-controlled action, not a fifth transaction.

## STOP — return to HOLD immediately if

- a device confirmation is unclear or unexpected;
- an address, amount, program, decimal, metadata field, or authority differs;
- the devnet-proven path cannot produce the required mainnet transaction;
- direct RPC and Explorer evidence are unavailable or inconsistent;
- a digest, review, or approval timestamp is stale;
- a credential, secret, blind approval, or unreviewed correction is requested;
- a custody wallet is described as an enforceable time lock.

On any stop, preserve observable evidence, clear stale approvals, regenerate
derived artifacts, and repeat independent review. Do not improvise a corrective
transaction or reuse an earlier approval.

## Minimum public payload after verification

- Mint address and mainnet Explorer link
- Original SPL Token Program confirmation and 9 decimals
- Immutable metadata account, URI, and digest
- Exact total supply and five allocation accounts
- Mint-authority and freeze-authority revocation evidence
- Allocation lock/vesting mechanism and direct evidence
- UTC checked-at time and verifier role

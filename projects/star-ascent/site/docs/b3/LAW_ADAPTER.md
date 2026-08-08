# B3 native IAT Daily Law adapter

Status: **SBF + DISPOSABLE LOCAL-VALIDATOR REHEARSED / DEVNET HOLD**

Implementation: `programs/iat_b3_law`

The adapter is a small native Solana program around the framework-neutral
`iat_b3_consensus` kernel. It implements the standard Token-2022 Transfer Hook
`Execute` instruction and a permissionless `finalize_day` instruction. It is
separate from the V2 Anchor program so the mandatory transfer path does not
inherit the complete V2 monolith's binary size or dependencies.

## Pinned compatibility surface

| Component | Pinned source version |
| --- | --- |
| Agave/Solana build toolchain | `3.1.10` in public CI |
| Rust | `1.97.1` in public CI |
| Token-2022 interface | `2.1.0` |
| Transfer Hook interface | `2.1.0` |
| TLV account resolution | `0.11.1` |
| Solana sysvar API | `3.1.1` |
| Solana Clock type | `3.2.0` |

The canonical Token-2022 program address remains
`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`. Interface compatibility is not
yet a claim that the exact Mainnet program configuration has passed Gate 1.

## Accounts and initialization

Initialization is a one-time mint-authority operation. It verifies that:

- the mint is owned by Token-2022;
- the mint is initialized with nine decimals and exactly
  `1,000,000,000,000,000,000` base units;
- mint and freeze authorities are already revoked;
- the mint contains both Transfer Hook and Confidential Transfer extensions;
- the configured hook program is the running adapter;
- the signer is the current hook-update authority;
- the network genesis identity is nonzero;
- the law-state and standard `extra-account-metas` addresses are the exact PDAs.

It then creates only two rent-bearing accounts:

1. `law-state` PDA: 160 bytes, bound to program ID and canonical mint;
2. standard Transfer Hook extra-account-meta PDA, containing one read-only
   mint-derived reference to the law-state PDA.

There is no administrator, threshold, timezone, result, or bypass update
instruction. Program and hook-update authorities still exist outside this code
until the audited Mainnet ceremony revokes them; the prototype is therefore not
yet immutable.

### Prototype instruction ABI

- initialize: `"IATB3LAW" || 0x00 || network_genesis_hash[32]`, with ordered
  accounts `payer`, `mint`, `law_state`, `extra_account_metas`, `system_program`;
- finalize: `"IATB3LAW" || 0x01`, with ordered accounts `mint`, writable
  `law_state`;
- transfer enforcement: standard Transfer Hook interface `Execute`, with its
  five standard accounts followed by the read-only `law_state` resolved from
  the extra-account-meta PDA.

## Permissionless daily finalization

`finalize_day` requires only the canonical mint and writable law-state PDA. The
transaction's fee payer can be anyone. The program:

1. reads Solana `Clock` through the sysvar syscall;
2. derives the fixed UTC+03:00 protocol day with the exact mapping
   `floor((Clock.unix_timestamp + 10_800 - 60) / 86_400)`, so the boundary is
   local 00:01;
3. rejects a second finalization for that day;
4. fetches `PodSlotHashes` through the sysvar syscall;
5. selects the newest available ancestor at or before `Clock.slot - 150`;
6. calls the shared exact-threshold and rejection-sampling kernel;
7. atomically writes the complete decision into the fixed law-state account.

The 150-slot lag is a **provisional source constant**, approximately one minute
at nominal 400ms slots. It must be measured under skipped slots, forks, delayed
finalization, congestion, and hostile timing before the Mainnet binary is frozen.

The fixed account is deliberately reused instead of creating a permanent PDA
every day. This avoids indefinite daily rent growth. A successful same-day
decision cannot be overwritten or rerolled; the next civil day replaces the
active record. Historical transactions remain public, but long-term historical
indexing is an external availability concern and must not be described as
permanent on-chain per-day account storage.

## Transfer execution

Token-2022 supplies the standard ordered hook accounts plus the law-state PDA.
The adapter verifies:

- source, destination, and mint are Token-2022 accounts for the same mint;
- the standard validation PDA is exact and program-owned;
- the law-state PDA is exact, program-owned, and bound to the mint;
- the source account's `TransferHookAccount.transferring` flag is active, which
  rejects direct calls that did not come from Token-2022;
- the stored decision recomputes exactly from network, mint, day, slot, and hash;
- the stored day equals the current UTC+03:00 protocol day and is open.

Missing, stale, corrupt, forged, or locked state fails closed. The law-state is
read-only during hook execution. Public and confidential transfers use the same
standard hook entrypoint; the adapter neither receives nor attempts to inspect
a confidential amount.

The boundary is half-open: a prior-day record remains current through local
`00:00:59`; at `00:01:00` that record is stale and all ownership transfers fail
closed until the new day is finalized. A Friday selection therefore covers
`[Friday 00:01:00, Saturday 00:01:00)`, subject to normal fail-closed downtime
if Saturday's result has not yet been finalized.

This adapter does not yet port or gate the V2 staking, settlement, reservation,
vesting, or registry instructions. Each state-changing B3 port remains required
to call the same law kernel directly before Gate 2 can pass. The current code is
therefore IAT-wide for Token-2022 ownership transfers, not yet complete B3-wide
economic-state enforcement.

## Current evidence and next gates

Host evidence currently covers canonical state serialization, corrupt-state
rejection, mint/program PDA separation, standard hook instruction decoding,
unchanged 1%/66.67% thresholds, same-day reroll rejection, future-state
rejection, and deterministic lag selection.

The 2026-08-08 disposable local-validator rehearsal additionally covers the
optimized 141,824-byte SBF artifact, frozen local program data, exact
Token-2022 mint shape, real public hooked transfers, permissionless Clock plus
SlotHashes finalization, stored-record reproduction, direct-call rejection, and
real-hook missing/stale/open/locked/forged state gates. See
[`LOCAL_VALIDATOR_REHEARSAL.md`](LOCAL_VALIDATOR_REHEARSAL.md).

Before Devnet:

- produce a pinned SBF binary and SHA-256 evidence in public CI;
- add a local-validator integration harness that creates a mint with both
  extensions and exercises direct public and confidential transfer paths;
- measure compute units, transaction bytes, account rent, and wallet resolution;
- add rollback, delayed-finalizer, skipped-slot, malformed TLV, wrong-owner,
  wrong-mint, and direct-call adversarial tests;
- decide whether the 150-slot lag survives measurement;
- independently review every error and authority transition.

No deployment or mint operation is authorized by this prototype.

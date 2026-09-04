# IAT V2 attended Devnet incident — 2026-08-28

Status: **HOLD / SIGNED TRANSACTION DISCARDED BEFORE BROADCAST**. Mainnet was not accessed.

During the attended `EXTEND_PROGRAM_DATA` capacity ceremony, the local console
accepted a Model T signature and retained it behind the separate broadcast
boundary. When the broadcast control was later entered, the mandatory
pre-reservation blockhash checks did not pass: the first validity check failed
with:

`Signed transaction blockhash is no longer valid`

The console then displayed:

`HOLD // SIGNED PROGRAM TRANSACTION DISCARDED BEFORE BROADCAST`

Read-only inspection of the preserved browser LevelDB established the exact
local transaction evidence:

- source commit `e6f1041abde0d70f0055ef4f7bc333f4271f37aa`;
- artifact SHA-256 `771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`;
- message SHA-256 `6cb0140334976541571e40bcef8c8856fc7bd06096cf2af24019d208bb76a8ec`;
- signed-wire SHA-256 `ae2368e6fa387eb3e6306f5f732879069aee313a1031ae075c92b5a685ab003f`;
- locally derived Solana signature
  `2Xjs9svukMSScLCGAinZeuFnnUpQKinnwrdiBMZhougNJkDTgRxZN2KTqtu8tQTqEKQYmsU5gUar31nt6dBaupC4`;
- blockhash `HwR8gs4SmqegZjMCJYM6GGfiTSSRZWNKrLbygjT9ip7R`, last-valid block
  height `477070265`, and finalized context slot `489269885`; and
- reviewed capacity `597336` to `649680` bytes (`+52344`) with
  `364314240` lamports rent top-up.

The exact message SHA-256 recomputed from the retained 212 message bytes. The
signed-pending key is now tombstoned, and no live program broadcast-attempt
record or receipt exists in the active LevelDB tables. The prompt latch remains
`PROMPT_VERIFIED`. These are local forensic facts; they do not establish an
on-chain submission or result.

That terminal status is reachable only before a permanent broadcast-attempt
reservation exists and after the console has exclusively proved and removed the
exact retained signed wire with terminal reason `PRE_SEND_FAILURE`. The expired
wire was not submitted by that path. This record is local ceremony evidence, not
an independent on-chain transaction observation.

The consumed source/artifact/mint/action prompt latch remains preserved. The
operator must not retry the signature, clear browser storage, change profile or
origin, reconstruct or submit the expired wire, or reuse the same source-bound
ceremony. Recovery requires a separately reviewed source change, fresh exact-head
CI, authenticated artifact and evidence bindings, and a new binding commit.

The replacement source-bound ceremony refreshes its transaction blockhash only
after the initial exact simulation and finalized state re-observation, then
simulates the final hardware-prompt message again. The console exposes the exact
last-valid block height before and after signing and directs the operator to
complete the separate attended broadcast approval without delay. The permanent
pre-send validity checks and one-use broadcast reservation remain unchanged.

This incident record is not a transaction receipt, signature receipt, release,
deployment, or Mainnet authorization.

# IAT V2 attended Devnet signing-headroom incident, 2026-09-06

## Status

`HOLD // B2 SIGNED BLOCKHASH TOO CLOSE TO EXPIRY // CEREMONY TERMINAL`

This is an evidence-bounded incident record and source-remediation plan. It is
not a transaction receipt, deployment receipt, release, or Mainnet
authorization.

## Reported terminal observation

The attended operator reported the exact B2 program-upgrade surface displaying:

- message SHA-256
  `6e631151de9b769916a8a7aad71cf35680216fdd17bc4229845f0b1206e24379`;
- last-valid block height `481719172`;
- `13` blocks remaining as the last observed value; and
- `HOLD // SIGNED BLOCKHASH TOO CLOSE TO EXPIRY; CEREMONY TERMINAL; NOTHING BROADCAST`.

The operator separately reported that nothing was broadcast. The signed wire,
its local Solana signature, and browser storage records were not supplied or
inspected. Therefore this document does not independently prove the absence of
a prior submission, invent a signature-specific chain result, or claim that a
particular local broadcast-attempt record exists. The displayed terminal path
is implemented before the sole broadcast reservation and send boundary, but UI
text and an operator report are not substitutes for a retained signature or a
finalized transaction observation.

At `2026-09-06T06:55:04.5640130Z`, a later read-only public Devnet observation
matched canonical Genesis
`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` and returned:

- processed block height `481720052`, which is `880` blocks past the reported
  last-valid height; and
- finalized block height `481720019`, which is `847` blocks past the reported
  last-valid height.

That observation proves the reported blockhash window is now expired at both
commitments. It does not prove whether the transaction was submitted earlier.
No Mainnet endpoint was queried.

## Preserved source identity

The consumed ceremony remains bound to source S2 commit
`bd586056ed56da5530cedddef06cf415408c057e`, source tree
`584dfab53c78106ea19b67cd122b105363e2fed9`, and binding-only B2 commit
`ba49525bb2fd21c04a797b17d042dce9b61540a1`. Its immutable program artifact
remains the 649,680-byte file with SHA-256
`771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`.

The B2 page, profile, retained signed-pending bytes, and permanent prompt latch
must remain untouched. Do not broadcast, re-sign, refresh, discard, clear
storage, change origin or profile, or attempt to revive this action. A new
ceremony uses a genuinely new reviewed source binding; it does not delete,
reset, migrate, or reinterpret the B2 namespace.

## Code-proven headroom exposure

The B2 source admitted a program prompt after observing at least 80 remaining
blocks. The coordinator then persisted `PROMPT_ENTERED`, but the provider still
awaited a separate Genesis-hash RPC before it invoked the Trezor Connect signing
method. That post-latch application RPC was outside the 5,000-millisecond
admission timer and could consume an unbounded part of the accepted blockhash
window.

This is a source-proven exposure, not proof that the Genesis RPC caused this
specific incident. No retained measurement establishes the exact device,
popup, operator, or network duration for this attempt.

## Reviewed source remediation

The replacement source must:

1. retain the same permanent prompt latch, durable signed-pending record,
   40-block broadcast cutoff, permanent broadcast-attempt reservation, and
   separate attended broadcast control;
2. use an opaque, internally branded, transaction-bound, provider-bound,
   Devnet-only, one-use prepared signing capability;
3. complete canonical Devnet Genesis verification before the final blockhash
   admission and before `PROMPT_ENTERED` is persisted;
4. reject a stale, substituted, cross-provider, reused, or non-Devnet prepared
   capability without reaching the device;
5. require at least 100 remaining blocks at prompt admission;
6. bound the whole final candidate interval, beginning before final blockhash
   acquisition and exact simulation and ending after the finalized and
   processed validity observation, to no more than 5,000 milliseconds;
7. verify the exact candidate message again immediately before latch entry; and
8. invoke the prepared Trezor Connect signing method after latch entry without
   another application RPC, blockhash refresh, simulation, timer, or storage
   mutation in between.

The 100-block threshold is additional policy headroom, not a guarantee of a
wall-clock signing duration. A slow or hidden preparation fails before latch
entry and before a device call. A slow hardware response can still end the new
ceremony. The 40-block broadcast cutoff remains authoritative and unchanged.

## Replacement ceremony gate

This source amendment resets only the canonical ceremony runtime anchor to
`UNBOUND`. It does not modify the immutable migration artifact or its evidence.
Before any replacement address display or transaction prompt, the exact new
source S3 requires fresh public proof and security CI, authenticated runtime
evidence, a preserved PR-merge evidence ref M3, a direct anchor-only successor
B3, a clean local full verifier, and exact-B3 public CI. None of those source
or CI steps authorizes a Trezor prompt, signature, broadcast, deployment,
release, or Mainnet action.

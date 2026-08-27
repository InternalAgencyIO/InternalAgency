# IAT V2 attended Devnet incident — 2026-08-27

Status: **HOLD / NO DEVNET SUBMISSION OBSERVED**. Mainnet was not accessed.

The Model T locally signed the reviewed `EXTEND_PROGRAM_DATA` message with SHA-256
`ecd8ecbd41b45d7912185e8689f639944876c186b0a53f1bf147a535fb25222c`.
The console showed `SIGNED // NOT BROADCAST`. The page was then reloaded before
the separate broadcast boundary completed. The signed wire existed only in
React memory and was lost; the permanent v1 transaction-prompt latch remained.
The exact subsequent error was:

`Canonical action EXTEND_PROGRAM_DATA already consumed its transaction-prompt latch`

Two delayed, read-only finalized Devnet observations proved that the extension
did not finalize:

- finalized slots `488933440–488933442` and `488935590–488935592`;
- ProgramData capacity remained `597336` bytes (`597381` account bytes);
- ProgramData lamports remained `4158662640`;
- the required extension remained `52344` bytes with `364314240` lamports rent
  top-up;
- ProgramData's newest confirmed/finalized signature remained the old
  `4x5QMdtqPJ64K5Bm3trYqBukykpip1n1hjsrCkt8sYxuDBxqvUyD8nY4RErTYSWfUKSPk4UPkAYbMYRWgynt1Cja`
  at slot `480117343`;
- administrator `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`'s newest
  confirmed/finalized signature remained the old
  `666EDsSEdL26X5u3rnus1druwE3MHUWwTHyCkCFE8yetE9touhMFhr2VbPuxAUgrGvZi82DB22PVgQsThpufaatD`
  at slot `482637865`.

The consumed v1 latch must remain preserved. Clearing storage, changing browser
profile, changing origin/port, or re-requesting the v1 signature is prohibited.
The lost wire cannot be recovered and the old ceremony cannot be continued.
Recovery requires a separately reviewed source amendment, a genuinely new source
binding, and fresh exact-head CI. The fresh source-bound ceremony therefore:

1. keeps the cross-version global Web Lock;
2. retains the v1 permanent prompt-latch namespace while the new exact source
   binding creates a distinct key without deleting the prior incident latch;
3. requests only the evidence-bound account-zero Trezor path
   `m/44'/501'/0'/0'` for on-device address verification;
4. persists the exact verified signed transaction before displaying the separate
   broadcast control, allowing pre-attempt reload recovery without another device
   prompt;
5. derives the exact Solana signature locally and atomically persists a permanent
   source/artifact/mint/action-bound broadcast-attempt reservation before the sole
   send. Once that reservation exists, including after an RPC timeout, error, or
   reload, that action is permanently reconcile-only: poll the retained signature,
   verify the exact finalized wire/message/signature and action-specific post-state,
   and never send again or delete/reset the attempt; and
6. keeps migration and feature signed-pending state memory-only. The program
   amendment does not make those surfaces reload-safe; navigation or loss while
   either is pending remains HOLD and cannot authorize another prompt or resend.

The fresh ceremony's source-bound prompt, signed-pending, and broadcast-attempt
namespaces are distinct. They preserve, rather than replace or bypass, the consumed
v1 incident latch.

This incident record is not a transaction receipt, signature receipt, release,
deployment, or Mainnet authorization.

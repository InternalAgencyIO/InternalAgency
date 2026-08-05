# IAT V2 dependency advisory preconditions

**DRAFT / QA HOLD / UNPATCHED HIGH ADVISORY / MAINNET UNSCHEDULED_HOLD**

The current lock still contains `bigint-buffer@1.1.5` through `@solana/spl-token@0.4.15` and `@solana/buffer-layout-utils@0.3.0`. GitHub advisory `GHSA-3gc7-fjrx-p6mg` identifies a high-severity availability crash in `toBigIntLE()` for every published `bigint-buffer` version through 1.1.5 and lists no patched version.

This increment does not call that finding fixed or unreachable. It narrows the reviewed admin-console path before SPL Token decoding:

- original Token accounts must be exactly 165 bytes;
- original Token mints must be exactly 82 bytes;
- the installed SPL layout must continue slicing u64 values to exactly 8 bytes;
- runtime source may not import `bigint-buffer` or `@solana/buffer-layout-utils` directly; and
- the console decodes the same RPC account snapshot whose owner and size it checked, instead of issuing a second read immediately before decoding.

The regression rejects missing, wrong-owner, undersized, and oversized account or mint data, binds the exact locked package path, and verifies the fixed-width dependency implementation used by the installed graph. These controls reduce ambiguity and the exposed input boundary; they are not exploitability proof, a dependency patch, or a substitute for supported graph removal/replacement and independent review. The machine-readable policy is [`policy.json`](./policy.json).

No dependency version, RPC state, wallet, hardware device, transaction, deployment, Devnet, or Mainnet state was changed.

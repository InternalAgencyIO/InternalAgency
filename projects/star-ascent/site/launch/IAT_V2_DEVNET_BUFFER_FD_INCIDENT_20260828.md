# IAT V2 Devnet buffer descriptor incident — 2026-08-28

Status: **DEVNET HOLD / ONE-USE PRE-ADDRESS STATE PRESERVED / NO BUFFER WRITE ATTEMPT**. The separately finalized capacity extension is unaffected. Mainnet was not accessed.

The attended fresh-buffer helper passed its first `REBUILD-DEVNET-FRESH` gate,
created the permanent `devnet-buffer-rebuild-v1/attempt-one-use` reservation,
snapshotted the reviewed 649,680-byte artifact, and created the protected buffer
signer. It then stopped before deriving or displaying a buffer address with:

`/usr/bin/stat: cannot statx '/proc/self/fd/10': No such file or directory`

`HOLD: fresh buffer signer descriptor is not a regular file`

The protected signer and reviewed artifact snapshot remain in the one-use
reservation. No `buffer-address.txt`, `reservation-manifest.json`, or finalized
buffer reconstruction existed at the stop. The target-bound
`UPLOAD-<FRESH_BUFFER_ADDRESS>` gate was never reached, and the helper never
invoked `solana program write-buffer`; the historical buffer was untouched. No
Model T prompt was involved. This incident therefore establishes no buffer
upload, transaction signature, transaction submission, deployment, authority
handoff, receipt, or release.

An isolated non-secret Bash reproduction established the cause. The helper had
opened the reviewed artifact on file descriptor 11 and then invoked a function
with descriptor 11 closed for that function call. Because descriptor 10 was
unreserved, Bash temporarily used it to save descriptor 11 with close-on-exec
semantics. Opening the protected signer on descriptor 10 inside the function
overwrote that internal save slot, so child metadata checks could not see
`/proc/self/fd/10`. Reserving descriptor 10 before the function-call redirections
keeps the subsequently opened signer descriptor inheritable by the exact child
checks. This diagnosis used ordinary non-secret fixture files; the protected
signer was not printed, copied, read for contents, or digested.

The retained reservation and signer must not be deleted, reset, renamed, copied,
printed, hashed, exposed, or manually opened. The original fresh helper is
permanently consumed for this reservation and must not be rerun. Recovery is
restricted to the separate
`recover-iat-v2-devnet-buffer-pre-address.sh` entrypoint. It admits only the exact
existing pre-address phase, creates neither a signer nor a reservation, preserves
unexpected or later-phase state, and reuses the shared one-write implementation.
Recovery requires two independent binding lanes to pass. The immutable migration
artifact/evidence lane remains the already reviewed 649,680-byte artifact
`771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`,
source `a03fe71dd66cd1650b8d0353e486786df30b83e9`, public CI run
`33161771816` attempt 1, and evidence-manifest SHA-256
`ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9`.
Those immutable migration constants must not be rewritten or described as bound
to the newer recovery source. Separately, recovery-runtime source commit `S`
requires fresh exact-head public PR CI, and a direct one-parent, data-only
successor commit `B` must change only
`scripts/data/iat-v2-devnet-buffer-runtime-binding.json` to bind `S`, its exact
runtime-closure digest, the PR checkout, CI run/attempt/workflow, runtime evidence
manifest, and the retained artifact tuple. The checked-out `B` and clean runtime
closure must verify before recovery. The closure commits `package.json` and
`package-lock.json` source bytes; that is a declared-dependency source binding
only and does not bind installed `node_modules` bytes or establish installed
dependency provenance.

After both lanes pass, recovery still requires two immediate attended terminal confirmations:
`RECOVER-DEVNET-BUFFER-PRE-ADDRESS`, then the newly displayed exact
`UPLOAD-<FRESH_BUFFER_ADDRESS>` challenge. Until both are deliberately performed,
the buffer upload remains HOLD. This is the sole exact continuation of the same
one-use attempt, not a general retry path.

This record is source-level incident evidence, not a transaction receipt,
signature receipt, deployment proof, release, or Mainnet authorization.

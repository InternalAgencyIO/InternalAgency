# IAT V2 Devnet buffer in-place continuation incident — 2026-08-31

Status: **DEVNET HOLD / FIRST IN-PLACE LANE CONSUMED / FINALIZED PARTIAL BUFFER OBSERVED**.
Mainnet was not accessed.

The one-use lane in
`scripts/recover-iat-v2-devnet-buffer-in-place.sh` entered its durable mutation
boundary for buffer
`564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`. Its permanent CAS at
`/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-recovery-v1/attempt-one-use`
is consumed and must remain unchanged. The helper must never be rerun, copied to
a different state root, or reinterpreted as an available authorization.

Finalized public state later showed that the exact target prefix had advanced
from 19,200 bytes to 35,520 bytes, but the helper did not establish exact target
completion. Its visible post-write result validation rejected the captured
reconciliation outcome and stopped fail-closed. That console failure alone does
not establish the captured exit status, signal, error field, or record contents.
This is not permission to retry that helper.

A later separate signer-free finalized reconciliation against the canonical
Devnet endpoint and genesis
`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` observed, at both minimum and
account context slot `490776148`:

- buffer address `564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`;
- owner `BPFLoaderUpgradeab1e11111111111111111111111`;
- `executable: false`;
- `4,522,976,880` lamports;
- upgradeable-loader state tag `1` and authority-present tag `1`;
- authority `DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4`;
- `649,717` account bytes, consisting of `37` metadata bytes and
  `649,680` program bytes;
- program SHA-256
  `72f835371ef4a29710d3976683c8449c2db5a56a06311ead0d439abae53d4398`;
- payload bytes `[0, 35520)` exactly equal to the reviewed public-CI artifact;
- payload bytes `[35520, 649680)` all zero, leaving `614,160` bytes; and
- evidence-body SHA-256
  `7b89459c06b3ee6768d7862c8cb14e06730f2a920aa1ac90b68b7b93277f03ee`.

The reviewed target remains the exact 649,680-byte artifact with SHA-256
`771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`.
The observed partial hash is incident evidence only and must never be presented
as an artifact hash, a ready buffer, or successful upload evidence.

Public address history showed 17 finalized entries with `err: null` in slot
`490771674`. That observation does not, without exact transaction-message,
signer, instruction, and account-delta validation, prove that those entries are
the complete causal set for the prefix advance. It does not establish an exact
signature roster for release evidence or authorize replay.

## New continuation boundary

Any further mutation requires a new source-distinct helper, a fresh exact-head
public-CI runtime-evidence run, its direct anchor-only binding successor, a
different clean-environment token, a target-and-35,520-prestate-bound attended
phrase, and a fresh crash-durable permanent CAS. The new source lane is
`scripts/continue-iat-v2-devnet-buffer-in-place-from-35520.sh`; its CAS is
`/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-continuation-from-35520-v1/attempt-one-use`.
Neither the source nor the new helper reads, removes, renames, resets, or depends
on the consumed protected recovery directory.

Before its boundary, the continuation must repeatedly reobserve the entire exact
finalized tuple above at slots no earlier than `490776148`. A longer prefix,
different partial hash, nonzero suffix, authority or layout change, slot
rollback, artifact drift, runtime-binding drift, or existing new CAS is HOLD
before mutation. It may address only the literal existing public buffer and may
invoke the pinned Agave `program write-buffer` route exactly once. The bounded
CLI invocation may sign and send multiple deployer-key Devnet chunk
transactions; it is not a one-transaction or one-signature claim.

After the boundary, exact target reconciliation is the only success. A
well-formed monotonic `PARTIAL_EXACT_PREFIX_ZERO_TAIL` result is durably
classified but permanently consumes the continuation CAS and remains **DO NOT
RERUN**. Transport failure, malformed evidence, divergent bytes, timeout, or
unclear output is also permanently reconcile-only. A future continuation after
any such outcome would require another independent finalized observation and a
new source/CI/binding/helper/CAS lane.

This lane never creates or closes a buffer, reads the protected buffer signer,
hands off authority, deploys or upgrades a program, opens a release gate, uses a
Trezor, or accesses Mainnet. No device prompt, protected-state read, signature,
broadcast, or mutation occurred during the signer-free reconciliation recorded
here.

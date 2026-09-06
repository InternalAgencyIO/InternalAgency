# IAT V2 Devnet buffer continuation incident at 54,720 bytes — 2026-08-31

Status: **DEVNET HOLD / SECOND IN-PLACE LANE CONSUMED / FINALIZED PARTIAL BUFFER OBSERVED**.
Mainnet was not accessed.

The one-use lane in
`scripts/continue-iat-v2-devnet-buffer-in-place-from-35520.sh` entered its
durable mutation boundary for buffer
`564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`. Its permanent CAS at
`/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-continuation-from-35520-v1/attempt-one-use`
is consumed and must remain unchanged. That helper must never be rerun, copied
to another state root, or treated as an available authorization.

The sole Agave 3.1.10 `program write-buffer` invocation used the reviewed
literal public buffer route, RPC transport, and `--max-sign-attempts 5`. It
exited `1` with `Data writes to account failed: Custom error: Max retries
exceeded`. Its captured output contained no transaction signatures or receipts,
so this record does not claim an exact submitted or finalized transaction set.

A durable signer-free reconciliation against the canonical Devnet endpoint and
genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` then returned the admitted
partial exit status `2`, with null process signal and error, and observed at both
minimum and account context slot `490807312`:

- buffer address `564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`;
- owner `BPFLoaderUpgradeab1e11111111111111111111111`;
- `executable: false`;
- `4,522,976,880` lamports;
- upgradeable-loader state tag `1` and authority-present tag `1`;
- authority `DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4`;
- `649,717` account bytes, consisting of `37` metadata bytes and `649,680`
  program bytes;
- program SHA-256
  `c8b842bae57c2f23da0de4219ab879147971a0dafeda8755f6a90e8ca5db0dd3`;
- payload bytes `[0, 54720)` exactly equal to the reviewed public-CI artifact;
- payload bytes `[54720, 649680)` all zero, leaving `594,960` bytes; and
- evidence-body SHA-256
  `bceff73e737dee68f812e7d73c3554d30e08b899ca723e08a798b2275609f429`.

The reconciler's console envelope appended exact `evidenceFile: null` after
sealing the evidence body. The consumed helper's strict validator omitted that
documented console-only field from its root-key allowlist and did not remove it
before recomputing the evidence-body hash. It therefore stopped on the generic
`post-write finalized outcome validation failed; DO NOT RERUN` branch instead
of its intended monotonic-partial branch. Independently removing only that
console-only field reproduces the recorded evidence-body SHA-256 exactly. This
explains the validator failure; it does not turn the partial buffer into a
successful upload or permit replay.

The reviewed target remains the exact 649,680-byte artifact with SHA-256
`771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`.
The observed partial hash is incident evidence only and must never be presented
as an artifact hash, ready buffer, handoff evidence, or deployment result.

## Successor continuation boundary

Any further mutation requires a source-distinct helper, a fresh exact-head
public-CI runtime-evidence run, its direct anchor-only binding successor, a
different clean-environment token, a target-and-54,720-prestate-bound attended
phrase, and a fresh crash-durable permanent CAS. The successor source lane is
`scripts/continue-iat-v2-devnet-buffer-in-place-from-54720.sh`; its CAS is
`/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-in-place-continuation-from-54720-v1/attempt-one-use`.
It does not read, remove, rename, reset, or depend on either consumed CAS.

Before its boundary, the successor must repeatedly reobserve the complete
finalized tuple above at slots no earlier than `490807312`. A longer or shorter
prefix, different partial hash, nonzero suffix, authority or layout change,
slot rollback, artifact drift, runtime-binding drift, or existing successor CAS
is HOLD before mutation.

The successor may address only the literal existing public buffer and may invoke
the pinned Agave `program write-buffer` route exactly once. It explicitly uses
QUIC TPU submission, a 1,500-second outer timeout, and
`--max-sign-attempts 20`. The bounded invocation may sign, re-sign, send, and
resend multiple deployer-key Devnet chunk transactions. It is not a
one-transaction, one-signature, or exact-receipt claim.

After the boundary, exact target reconciliation is the only success. A valid
monotonic `PARTIAL_EXACT_PREFIX_ZERO_TAIL` result remains **DO NOT RERUN** and
permanently consumes the successor CAS. Transport failure, malformed evidence,
divergent bytes, timeout, or unclear output is also permanently reconcile-only.

This successor never creates or closes a buffer, reads the protected buffer
signer, hands off authority, deploys or upgrades a program, opens a release
gate, prompts a Trezor, or accesses Mainnet. No signer invocation, device
prompt, Devnet/Mainnet transaction, or blockchain mutation occurs while
preparing, testing, committing, or binding this source lane.

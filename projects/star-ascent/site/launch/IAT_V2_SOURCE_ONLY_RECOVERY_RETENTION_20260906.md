# Devnet recovery retention: source-only repair

Status: local source tests, build and bundle-size verification PASS. Not activated; public CI, runtime and attended clearance remain pending.
Reviewed on 2026-09-06. This report records local validation before the source checkpoint. The checkpoint remains UNBOUND; no repair-specific public CI result or runtime binding is claimed.

## Scope and isolation

- Repair branch: `agent/iat-v2-devnet-recovery-retention-20260906`.
- Base: `a3919b801abd4a59960a1f795314ab20a38287c4`.
- The running B3 checkout remains clean and unchanged. No browser data was accessed or changed during this repair.
- No Trezor prompt, wallet signature, broadcast, RPC observation, deployment, release, Git commit or push was performed during this source-only implementation.
- Existing signed-pending v2 and prompt-latch keys are unchanged. No old record is reconstructed, migrated, cleared, or reauthorized.

## Changes

1. Pre-send validation and reservation failures preserve the exact signed pending record. If strict readback proves that no broadcast reservation exists, a terminal-disposition sidecar is recorded under the same held broadcast lock.
2. Explicit discard retains signed bytes and saves a write-once disposition bound to the complete pending-record SHA-256. It no longer deletes evidence.
3. A durable terminal disposition blocks reload recovery and stale-tab sends. Permanent broadcast reservations remain poll-only and are never erased or retried.
4. Recovery reads use both existing writer locks without queuing behind a device interaction. Cancelled reads cannot update a replaced view.
5. Chain-only inspection says signing recovery is not checked. READY appears only after the attended recovery check passes. Non-signable snapshots exit the checking status explicitly.
6. Existing entered/failed/verified latches without signed records remain HOLD. This patch cannot repair the already-missing S3 signed record.

## Verification

- 81 offline tests passed again after the approved size amendment, across pending storage, recovery, broadcast-once, prompt coordinator, prompt surfaces, transaction boundaries and path-session gating (81 passed, zero failed).
- Tests use in-memory storage, injected locks/network doubles and deterministic synthetic wallet fixtures. They are not physical Trezor or live Devnet transaction evidence.
- Local Vite production build passed in the isolated repair checkout. No server was started.
- The complete admin bundle regression passed with the approved ceilings and unchanged lazy-load boundary checks.
- ESLint passed on all five changed production modules.
- `git diff --check` passed. Independent source review found no remaining blocking correctness findings after its two issues were fixed.
- No mounted-browser lifecycle or physical-device test was performed.

| Build measurement | Actual bytes | Approved ceiling | Result |
| --- | ---: | ---: | --- |
| Program shell | 15,208 | 15,500 | PASS |
| Attended actions | 48,914 | 50,000 | PASS, 1,086 headroom |
| Incremental upgrade closure | 86,735 | 88,000 | PASS, 1,265 headroom |

The user explicitly approved raising only the attended ceiling from 46,000 to 50,000 bytes and the incremental closure ceiling from 84,000 to 88,000 bytes. Those two policy values and their pinned assertions are now amended, with one explanatory limitation added. A semantic comparison against the base policy and an independent review confirmed that all other values, existing limitations, lazy-load boundaries, assurance flags and the immutable predecessor are unchanged. The measured byte counts are unchanged from the earlier build that exceeded the old ceilings; the table records the approved new limits. The passing result is local evidence only, not CI or hardware clearance.

## Source checkpoint scope

After local validation, the user separately approved committing and pushing the nonsensitive repair source and running exact-source public CI. Checkpoint preparation restores only the repair checkout's ceremony anchor to its canonical UNBOUND predecessor. This prevents old B3 runtime evidence from authenticating the modified source. The original B3 checkout and anchor, immutable artifact pins, historical recovery anchor, browser data and consumed ceremony remain unchanged.

This publication approval does not authorize a bound runtime successor, console replacement, device prompt, signature, broadcast, deployment, release or Mainnet access. A future runtime manifest must come from successful CI for this exact checkpoint, not from a historical run. No one-use browser or mutation namespace is initialized by source publication.

The pre-checkpoint build with the canonical UNBOUND anchor also passed the complete bundle regression: program shell 15,208 bytes, attended actions 48,914 bytes and incremental upgrade closure 86,374 bytes. The smaller closure compared with the table above reflects the UNBOUND anchor's smaller bundled data, not a change to either approved ceiling. A future BOUND successor must be measured again against the same limits.

The expanded pre-checkpoint suite passed all 127 offline tests with zero failures or skips, covering the original repair tests plus ceremony runtime binding, program binding and the attended runbook. The proof-workflow regression also passed. These remain synthetic/local checks, not live network or device evidence.

## Persistence limit

If a browser refuses a terminal write before committing anything, no subsequent reload can observe that uncommitted intent. The current view reports failure and remains blocked, while signed evidence is retained. A write-then-throw whose disposition actually persists is terminal on reload. Tests distinguish these outcomes; the implementation does not claim impossible durability or authorize a send from an error message.

## Next boundary

The local bundle-size HOLD is resolved. Complete the approved source checkpoint and exact-source CI, then separately review the resulting runtime evidence and replacement ceremony binding. Do not load this modified checkout under the old B3 binding. Do not refresh, discard or retry the consumed S3 ceremony to obtain another prompt.

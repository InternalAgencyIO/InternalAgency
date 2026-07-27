# Release snapshot workflow

Run this immediately before the final handoff meeting:

```bash
node scripts/create-release-snapshot.mjs
node scripts/validate-release-snapshot.mjs
```

The generated snapshot lists the SHA-256 digest of every launch artifact and a
single packet digest. It also records a separate pre-approval digest for the
manifest, signer checklist, and devnet rehearsal. The release owner and
independent verifier compare that pre-approval digest before the physical
signing sequence and copy it to `approval.releaseSnapshotDigest` in an approved
handoff. If any source file changes, generate a new snapshot and repeat the
comparison.

Those three pre-approval entries must also exactly match their counterparts in
the snapshot's full artifact inventory. A snapshot with two different views of
the same canonical input is invalid and must be regenerated from HOLD; do not
selectively copy a digest between fields.

`generatedAtUtc` is a canonical ISO-8601 timestamp ending in `Z` (for example,
`2026-07-28T11:30:00.000Z`). The validator rejects offset-form or ambiguous
timestamps so the handoff room has one unambiguous snapshot time. It also
rejects snapshots older than 30 minutes and timestamps more than one minute in
the future. Regenerate the snapshot immediately if the handoff is delayed;
never edit its timestamp by hand.

The snapshot contains no wallet secret and does not sign, submit, or approve a
transaction. It simply proves that the room is looking at the same release set.
The snapshot validator and the APPROVED mainnet-handoff gate itself recompute
each listed file digest and both ordered packet digests; they reject stale,
missing, or extra artifact entries before the handoff meeting. This makes the
handoff safe to validate on its own rather than relying on a separately run
snapshot command.

For an APPROVED handoff, the snapshot time must be at or before
`approval.approvedAtUtc`. A snapshot made after approval cannot be used to
retroactively support that decision: return to HOLD, generate a fresh snapshot,
and repeat independent review.

The READY signer checklist's `readyAtUtc` and the COMPLETED devnet rehearsal's
`completedAtUtc` must both be canonical UTC timestamps at or before the
snapshot and the approval. If either gate finishes after a snapshot is made,
return to HOLD, regenerate the snapshot, and repeat independent review; an
older snapshot cannot attest to a later gate result.

An APPROVED handoff is also valid for only the same 30-minute window, with at
most one minute of future clock skew. If `approval.approvedAtUtc` expires, the
operator must return the handoff to HOLD, regenerate the snapshot, and repeat
the independent review; changing a timestamp alone is not a correction.

The APPROVED handoff and READY release-packet gates independently recheck the
current snapshot's version, HOLD status, freshness, canonical inventories,
overlapping pre-approval/full-inventory digest equality, packet digests, and
pre-approval binding to the approved handoff. A READY packet cannot rely on a
stale, substituted, or post-approval snapshot even if the handoff fields look
complete; return to HOLD and repeat the review from a fresh snapshot.

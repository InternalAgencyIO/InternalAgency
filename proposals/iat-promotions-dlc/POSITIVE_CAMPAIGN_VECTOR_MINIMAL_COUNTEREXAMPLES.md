# Minimal positive-vector intake counterexamples

**DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This proposal-only artifact reduces each of the ten seeded fuzz families to one
deterministic semantic delta. It publishes compact commitments and gate
transitions, not full candidate/result copies. It creates no valid campaign
signature, review decision, receipt, key, wallet request, network call,
deployment, or activation effect.

## Proof contract

Each fixture binds:

- one fuzz family and its first deterministic source case;
- one semantic mutation descriptor and its physical storage-write count;
- canonical and insertion-order-sensitive input commitments before and after;
- complete-result commitments before and after;
- the primary gate and all gate result/detail transitions;
- the verification reason before and after; and
- fixed rejected, unissued, unreviewed, and non-activating outcomes.

Eight families isolate a primary gate that passes in the rejected control and
fails after one semantic delta. The two cryptographic families cannot use a
valid campaign-signature baseline because no such positive vector is published:

- `CRYPTOGRAPHIC_SIGNATURE` proves a one-byte signature mutation, mirrored in
  its hexadecimal representation, preserves rejection without inventing a
  signature; and
- `CRYPTOGRAPHIC_GUARD` proves one nonce delta changes the fail-closed
  verification reason while remaining rejected.

The review control can pass its review gate but still fails cryptography and
overall intake policy. No fixture is a positive acceptance example.

## Ordered target commitment

Canonical JSON intentionally ignores object insertion order, while the
intake's independently supplied expected-target shape intentionally fixes it.
Therefore the `EXPECTED_TARGET` fixture publishes both commitments:

- canonical commitments remain equal for the same key/value set; and
- ordered commitments differ and bind the key-order mutation.

This makes the representation-sensitive contract explicit without weakening
the canonical commitments used everywhere else.

## Independent replay

Node regenerates each control, mutation, and compact fixture. The
standard-library-only Python verifier independently rebuilds the same ten
controls and mutations, evaluates all gates, and requires exact compact-record
and fixture-set commitment equality.

```text
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-minimal-counterexamples.mjs --write
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-minimal-counterexamples.mjs
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-minimal-counterexamples --format json
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake-minimal-counterexamples.test.mjs
```

These commands are local and verification-only. A separately supplied valid
positive campaign vector and independent review remain mandatory before any
future integration could be considered.

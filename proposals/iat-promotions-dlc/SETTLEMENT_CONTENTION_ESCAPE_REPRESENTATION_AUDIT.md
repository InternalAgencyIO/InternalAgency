# Settlement contention escape representation audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit tests whether JSON transport spelling can alter the twelve
published closed-schema rejection candidates. It does not accept a campaign
vector, complete review, prepare a transaction, access a wallet, or contact a
validator or network.

## Valid representation corpus

Each mutation is reconstructed from six runtime-only envelopes:

1. baseline LF;
2. recursively reversed object-key order with LF;
3. baseline CRLF;
4. escaped-Unicode spellings in the envelope and candidate keys;
5. an escaped solidus in the fixed `DRAFT/INACTIVE` transport marker; and
6. combined escaped-Unicode and Unicode-solidus spellings.

All 72 trials must parse to the same candidate semantics, reproduce the
published canonical candidate commitment, remain bound to the prior exact
diagnostic commitment, and reject. Raw representation digests must be distinct
within every mutation case.

## Malformed representation corpus

The transport parser separately rejects six runtime-only malformed inputs:

- truncated and non-hex Unicode escapes;
- a non-JSON `\x` escape;
- lone high and low surrogates; and
- a broken surrogate pair.

The first three fail JSON parsing. The surrogate cases are syntactically JSON
but fail the stricter Unicode-scalar check. Every failure occurs before a
mutation candidate can be produced.

## Public evidence boundary

The artifact publishes representation hashes, candidate and diagnostic
commitments, error classes, and compact set commitments. It never publishes the
serialized envelopes or mutated candidates. A separate zero-dependency Python
verifier independently reconstructs all valid bytes, candidate hashes, strict
Unicode failures, and set commitments.

This evidence is review material only. It grants no receipt, deployment,
activation, claim, wallet, signing, RPC, transaction, or chain capability.

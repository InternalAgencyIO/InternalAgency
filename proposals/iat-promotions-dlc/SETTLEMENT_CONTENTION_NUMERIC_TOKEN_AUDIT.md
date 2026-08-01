# Settlement contention numeric-token audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit closes JSON-number representation ambiguity at the bounded
transport boundary. It does not accept a campaign vector, complete review,
prepare a transaction, access a wallet, or contact a validator or network.

## Canonical rule

Every JSON number that reaches a candidate must be a base-10 safe integer with
the exact token grammar `0|-?[1-9][0-9]*`. Fractions, exponents, negative zero,
integers outside JavaScript's exact safe range, and non-finite or non-JSON
constants reject before a candidate is returned. Semantic schemas still own
field-specific values; the transport parser prevents lexical coercion from
bypassing those constraints.

Four controls accept: the unchanged composition envelope, canonical zero, and
the exact positive and negative safe-integer boundaries. Sixteen isolated
inputs reject:

- three value-equivalent fractional or exponent spellings of `1`;
- three integer, fractional, or exponent spellings of negative zero;
- three integers beyond the exact safe range, including a precision-collision
  value;
- two exponent-overflow spellings that would coerce to infinities; and
- `NaN`, positive or negative `Infinity`, a leading plus, and a leading zero.

Every changed input targets `/candidate/vectorVersion`. Only the token
descriptor, representation hash, byte count, error class, and pre-candidate
outcome are published. Serialized envelopes and runtime candidates are not.

## Independent replay

The zero-dependency Python mode reconstructs all twenty inputs independently
and must match every digest, error, outcome, and commitment. Changed evidence
exits with status `2`.

This audit is review material only. It grants no receipt, deployment,
activation, claim, wallet, signing, RPC, transaction, or chain capability.

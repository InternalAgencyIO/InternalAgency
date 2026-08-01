# Settlement contention delimiter and whitespace audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes the JSON document boundary accepted by the bounded
transport parser. It does not accept a campaign vector, complete review,
prepare a transaction, access a wallet, or contact a validator or network.

## Fixed rule

Only JSON's four whitespace code points are accepted outside strings: space,
tab, line feed, and carriage return. A transport envelope must contain exactly
one complete JSON document. A byte-order mark, other Unicode whitespace,
trailing value, or concatenated document rejects before a candidate is
returned.

Four controls accept: pretty LF, compact, pretty CRLF, and a small envelope
mixing all four standard whitespace characters. Sixteen isolated inputs reject:

- a byte-order mark at the prefix, suffix, or after a delimiter;
- seven non-JSON Unicode whitespace characters at five structural positions;
- a trailing scalar, object, or array; and
- two compact documents concatenated with no separator, a space, or a line
  feed.

Only the representation descriptor, hash, byte count, error class, and
pre-candidate outcome are published. Serialized envelopes and runtime
candidates are not.

## Independent replay

The zero-dependency Python mode reconstructs all twenty inputs independently
and must match every digest, error, outcome, and commitment. Changed evidence
exits with status `2`.

This audit is review material only. It grants no receipt, deployment,
activation, claim, wallet, signing, RPC, transaction, or chain capability.

The companion
[`SETTLEMENT_CONTENTION_STRING_TOKEN_AUDIT.md`](./SETTLEMENT_CONTENTION_STRING_TOKEN_AUDIT.md)
fixes exact decoded required-key matching and rejects control-character or
normalization-lookalike key spellings under the same bounded parser.

The byte-level companion
[`SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md`](./SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md)
proves BOM bytes are preserved through strict UTF-8 decoding before this
delimiter rule rejects them outside a JSON string.

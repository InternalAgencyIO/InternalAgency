# ABI offset and conformance manifest

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

`program-interface-abi-offsets.v1.json` is language-neutral client-binding
evidence derived from the held composed-interface preview. It is not an IDL,
SDK, program binary, deployed address, transaction, wallet request, or release
authorization.

## Published layout evidence

For all eight proposed accounts, the manifest fixes:

- the discriminator domain and bytes;
- every field's zero-based byte offset, width, and exclusive end offset;
- the exact full account size; and
- a canonical SHA-256 digest of that account layout.

For all thirteen proposed instructions, it fixes:

- the discriminator and every instruction-data byte range;
- the exact total encoded length;
- every account meta's position, name, signer flag, writable flag, and optional
  flag; and
- a canonical SHA-256 digest of the full instruction layout.

There are no alignment gaps, implicit padding bytes, variable-length fields, or
native-platform integer encodings. All integers are fixed-width little-endian.
JSON integers are decimal strings so clients cannot silently round u64 or i64
values.

## Cross-language fixtures

The manifest includes fixed expected hex for u8, u16, u32, u64, i64, bytes32,
Solana public-key bytes, and fixed raw bytes. Rust, TypeScript, Python, or any
other client can consume the same JSON and compare its own encoder with these
fixtures without a private key, wallet, RPC endpoint, or chain.

Its instruction lengths are checked against
`program-interface-composition-vectors.v1.json`, not the inherited v0 vectors.
The composed initializer is exactly 32 bytes shorter because the lifecycle
amendment removes the inline verifier key in favor of separate registry
initialization.

Run:

```sh
node proposals/iat-promotions-dlc/validate-abi-offset-manifest.mjs
node --test proposals/iat-promotions-dlc/tests/abi-offset-manifest.test.mjs
```

The validator independently rejects gaps, overlaps, wrong end offsets, account
size drift, instruction/vector length drift, account-meta reordering, flag
changes, layout-digest changes, unsafe numeric JSON, wrong scalar bytes, stale
preview bindings, and any network/deployment/application claim.

## Release boundary

The manifest remains `clientBindingOnly: true` and carries every held state:
`deployable: false`, `amendmentApplied: false`, and
`compositionApplied: false`. Exact ABI agreement is necessary for later review,
but it does not approve compilation, deployment, funding, activation, or use on
Devnet or mainnet.

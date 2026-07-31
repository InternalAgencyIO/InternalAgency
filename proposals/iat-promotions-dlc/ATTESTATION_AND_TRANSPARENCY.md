# Verifier attestation and transparency contract

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This contract defines how an off-chain X/wallet verifier may communicate a
minimal identity result to the standalone Promotions program without placing X
OAuth tokens, raw X IDs, emails, IP addresses, or private wallet-proof material
on-chain or in the public log.

## Canonical attestation envelope

The verifier produces a versioned detached-signature envelope:

```json
{
  "attestationId": "sha256 of canonical payload",
  "keyId": "public verifier key identifier",
  "payload": {
    "campaignId": "iat-promotions-dlc-v0",
    "domain": "iat-promotions-dlc-attestation-v0",
    "expiresAt": 1800000300,
    "issuedAt": 1800000000,
    "nodeId": "opaque stable node identifier",
    "nonce": "single-use verifier nonce",
    "purpose": "NOMINATE | CANCEL | SETTLE",
    "wallet": "public Solana wallet",
    "walletProofDigest": "sha256 digest of the verified challenge record",
    "walletProofVerifiedAt": 1799999999,
    "xIdentityCommitment": "keyed 32-byte identity commitment"
  },
  "scheme": "ED25519_DETACHED",
  "signatureBase64": "detached signature",
  "version": 0
}
```

The signature message is:

```text
iat-promotions-dlc-attestation-v0 + newline + canonical JSON of the unsigned envelope
```

Canonical JSON sorts every object key recursively, permits only strings,
booleans, null, safe integers, arrays, and plain objects, and rejects undefined
or ambiguous numeric values. The verifier signs bytes, not an implementation's
in-memory object representation.

## Required validation

Before the reference engine or a future program accepts an attestation, it must
check:

- exact version, scheme, domain, and field set;
- campaign ID and purpose;
- verifier `keyId` against the campaign's published allowlist;
- stable node ID, Base58 Solana wallet, and opaque X identity commitment;
- wallet-proof digest and proof age;
- issued-at and expiry bounds;
- a maximum attestation lifetime of 300 seconds;
- detached signature over the exact canonical message;
- `attestationId = SHA-256(canonical payload)`; and
- single-use nonce in campaign state.

An attestation says the verifier observed X OAuth and a wallet proof. It is not
the wallet proof itself and does not make X verification trustless. A compromised
verifier can lie about identities, but the standalone program still enforces
fixed amounts, paired settlement, independent uniqueness markers, and the hard
campaign cap.

## Key handling boundary

This public proposal contains no private key and creates none. Production
signing should use a managed KMS/HSM or equivalent audited service. Public
configuration contains only the scheme, key identifier, public verification
key, activation/retirement slots, and a public rotation record.

Key rotation must not change the X commitment domain or permit nonce reuse.
During a bounded overlap, old and new public keys may both verify; every
attestation records the exact `keyId`. Emergency key removal stops new
attestations but cannot rewrite accepted settlements.

## Public transparency log

Each final attestation outcome appends a minimal public entry containing:

- log and campaign IDs;
- monotonic sequence;
- previous entry hash;
- attestation ID;
- purpose;
- outcome and non-sensitive reason code;
- timestamp; and
- optional public nomination/settlement record ID.

The log deliberately omits the signed envelope, raw X user ID, handle, wallet
proof, OAuth data, and rejected user's wallet. Successful wallet payouts remain
public through normal Solana transaction evidence.

Every entry hashes its canonical body and links to the prior entry. Published
checkpoints contain log ID, campaign ID, entry count, head hash, timestamp, and
checkpoint hash. A later log must extend every prior checkpoint; truncation or
history rewriting fails verification.

Hash chaining detects mutation but does not by itself prove who published a
checkpoint. A later implementation must bind checkpoints to the reviewed public
signing authority and publish them through at least two independent surfaces.

## Outcome vocabulary

- `NOMINATION_ACCEPTED`
- `NOMINATION_CANCELLED`
- `PAIR_SETTLED`
- `ATTESTATION_REJECTED`

Rejected outcomes use stable reason codes and never expose OAuth responses or
other private diagnostics. One attestation ID receives one final logged outcome.
The campaign's on-chain state and final settlement receipt separately expose the
1,000-pair counter, zero remaining committed budget, and permanent shutdown.

## Model limitations

`attestation-transparency.mjs` accepts a signature-verification callback so it
can remain network-free and key-free. Tests use a plainly labelled public hash
fixture for campaign-envelope integration.

The separate `ed25519-public-vectors.v0.json` contains only the public keys,
messages, and signatures from RFC 8032 section 7.1 tests 1 and 2. It deliberately
omits the RFC private keys. `validate-ed25519-public-vectors.mjs` verifies those
signatures using the runtime's Ed25519 implementation, while mutation tests
reject every changed signature byte, changed message, and substituted public
key. The primary source is
https://datatracker.ietf.org/doc/html/rfc8032#section-7.1.

This proves the public verification primitive, not the future program's
preinstruction parser or a production verifier deployment. Binding audited
Ed25519 verification, exact canonical envelope bytes, the reviewed public key,
and Solana's Instructions sysvar remains required before any Devnet prototype.

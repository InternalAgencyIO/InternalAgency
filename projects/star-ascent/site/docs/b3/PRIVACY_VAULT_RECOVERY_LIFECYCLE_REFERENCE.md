# B3 Privacy Vault encrypted recovery lifecycle prerequisite

Status: **host-only, nonactivating cryptographic prerequisite**. Mainnet remains
**HOLD**.

[`privacy-vault-recovery-lifecycle.mjs`](../../programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs)
closes one narrow gap in the Privacy Vault reference surface: an encrypted
backup and a successful restore are no longer represented only by
caller-supplied booleans. A caller can seal opaque, caller-supplied recovery
bytes with a caller-supplied 32-byte recovery key and can obtain a verification
receipt only after exact AES-256-GCM authentication, recovery-key commitment
matching, recovered-material commitment matching, time validation, and
contiguous predecessor-state validation all succeed.

This module does not replace or amend the existing Rust lifecycle planner. It
is a separate prerequisite for a future native client integration. Nothing in
this reference performs RPC, constructs a Token-2022 instruction, generates or
validates an ElGamal keypair, derives keys from a wallet signature, signs a
transaction, writes durable state, or activates a privacy feature.

## Exact artifact and lifecycle

The caller first creates a content-addressed genesis state that binds:

- an externally selected Privacy Vault identity commitment;
- the commitment of an externally supplied recovery key;
- a maximum encrypted-bundle lifetime; and
- a maximum tolerated future-clock skew.

The module has no default vault identity or key. Zero, malformed, and obvious
placeholder commitments fail closed. The recovery key must be an exact
32-byte `Buffer` and cannot be an obvious one- or two-byte repeating
placeholder; opaque recovery material must be nonempty, nonzero, and no larger
than 16,384 bytes. These checks reject trivial fixtures but do not prove key
entropy or production custody.

Each encrypted bundle binds all of these facts as canonical AES-GCM additional
authenticated data:

- schema, status, cipher, and nonce-derivation identifiers;
- vault and recovery-key commitments;
- the complete content digest of the supplied pre-state;
- a strictly contiguous unsigned 64-bit epoch;
- the exact previous bundle and key-material commitments;
- the current key-material commitment and byte length; and
- creation and expiry times.

The supplied recovery key is a root secret, not a direct cipher key. Separate
encryption and nonce subkeys are derived with HMAC-SHA-256 using distinct
domains and the vault-binding digest. The AES-256-GCM nonce is the first 96
bits of HMAC-SHA-256 under the nonce subkey over a domain-separated canonical
AAD transcript. The KDF and nonce-derivation identifiers are themselves bound
into that AAD. The bound state, epoch, predecessor, and material commitment
make a nonce specific to one logical snapshot. Repeating the exact same
snapshot is deterministic. A different epoch, state, vault, time window, or
material commitment produces a different nonce. Callers cannot select a nonce.

The encrypted plaintext has a domain-separated fixed header, an exact
big-endian length, and the opaque caller bytes. Restore verification rejects a
noncanonical bundle, stale public digest, wrong key, wrong expected material
commitment, nonce substitution, AAD substitution, ciphertext or tag tampering,
expiry, premature creation beyond configured skew, replay, skipped epoch,
forked predecessor, and a bundle made against a different supplied state.

Successful verification returns a frozen, process-branded receipt and a frozen
next-state object. It does not return the decrypted bytes. A serialized,
cloned, accessor-backed, prototype-substituted, symbol-bearing, extra-field, or
missing-field receipt is not consumable as an executed receipt. The caller's
input buffers are not mutated. Local copies of the recovery key, opaque
material, and decrypted plaintext are overwritten in `finally` blocks.

## Security and metadata boundary

AES-256-GCM authenticates confidentiality and integrity only for the exact
caller-supplied bytes and transcript processed by this host module. The bundle
still exposes ciphertext, its byte length, timestamps, epoch, predecessor
links, vault binding, and public commitments. This is intentional lifecycle
metadata, not a claim of traffic-analysis resistance.

JavaScript zeroization is best effort. This module overwrites the explicit
`Buffer` copies it owns, but the JavaScript engine, crypto implementation,
garbage collector, operating system, caller-owned buffers, logs outside this
module, and swapped memory are outside that guarantee. Production key custody
still requires an independently reviewed secure platform-keystore design.

Deterministic nonces are safe here only while the recovery key is used through
this exact domain and the AAD uniqueness invariant is preserved. A future
adapter must not reuse this recovery key with another AES-GCM nonce scheme. A
reviewed production design may instead choose a keystore-native randomized
nonce protocol; that would require a new schema and migration review, not a
silent change to this transcript.

The SHA-256 key-material commitment proves equality to an explicitly expected
opaque byte sequence after authenticated decryption. It does **not** prove that
those bytes contain a valid Token-2022 ElGamal secret key, AES key, wallet
derivation, account binding, or any other semantic key structure.

## Deliberate truth boundary

A valid verification receipt sets only these positive facts:

- `canonicalBundleVerified: true`;
- `aes256GcmAuthenticationVerified: true`;
- `deterministicNonceVerified: true`;
- `keyMaterialCommitmentVerified: true`;
- `contiguousEpochVerified: true`; and
- `predecessorBundleVerified: true`.

It fixes all broader claims to false:

- `plaintextExported`;
- `walletSignatureDerivationVerified`;
- `token2022ElGamalKeypairVerified`;
- `securePlatformKeystoreVerified`;
- `durablePersistenceVerified`;
- `externalRollbackProtectionVerified`;
- `onchainRuntimeIntegrationVerified`;
- `falseZeroUiPreventionVerified`;
- `privacyLegalReviewAccepted`;
- `devnetLifecycleVerified`; and
- `activationReady`.

The state objects likewise fix durable persistence, external rollback
protection, platform keystore integration, on-chain runtime integration, and
activation to false. Every artifact has `mainnetStatus: "HOLD"`.

In particular, the predecessor chain is only as current as the state supplied
by the caller. Replaying an older state and its matching older bundle can pass
inside a new process. Content addressing detects substitution relative to the
supplied state; it is not a durable compare-and-swap store, trusted monotonic
counter, external checkpoint, or rollback anchor.

## Remaining production evidence

This prerequisite cannot close `PRIVACY_VAULT_CLIENT`. Production completion
still requires, at minimum:

1. explicit owner-approved wallet-signature key derivation and domain
   separation;
2. proof that restored bytes decode to the exact expected Token-2022 ElGamal
   and symmetric-key structures and bind the intended mint, token account, and
   wallet owner;
3. secure platform-keystore storage, access control, backup-key custody,
   rotation, loss, and revocation behavior;
4. durable, atomic, crash-safe state and an independently trusted rollback
   anchor;
5. exact native client instruction/proof construction against pinned Solana
   and Token-2022 binaries;
6. authenticated chain observation and uncertain-result recovery;
7. UI gating that never represents an unavailable or locked view key as a true
   zero balance;
8. enforcement against direct-client bypasses;
9. final-binary adversarial Devnet lifecycle evidence; and
10. independent cryptographic, privacy, security, accessibility, and legal
    review and explicit terminal authorization.

No object produced by this module is a signature, transaction, deployment,
provider credential, privacy acceptance, Devnet result, or Mainnet
authorization.

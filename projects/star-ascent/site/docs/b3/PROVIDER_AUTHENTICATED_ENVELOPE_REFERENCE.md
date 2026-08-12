# Provider authenticated-envelope reference

Status: `HOST_ONLY_NON_ACTIVATING_CONFIGURED_KEY_SIGNATURE_PREREQUISITE`

Mainnet status: `HOLD`

Provider authentication verified: `false`

Production key ownership verified: `false`

External rollback protection verified: `false`

The executable reference is
[`provider-authenticated-envelope.mjs`](../../programs/iat_b3_reference/provider-authenticated-envelope.mjs).
The hostile suite is
[`iat-b3-provider-authenticated-envelope.test.mjs`](../../tests/iat-b3-provider-authenticated-envelope.test.mjs).

This slice supplies one generic cryptographic prerequisite shared by the
`EXTERNAL_CHECKPOINT_PROVIDER` and `X_SOCIAL_EVIDENCE_PROVIDER` blockers. It
does not select a provider, key, credential, endpoint, tenant, resource, trust
root, or owner policy, and it never holds a private key or signs an envelope.

## Audited pre-existing seams

The current checkpoint reference accepts a structurally valid checkpoint from
`checkpointSource.readCurrent()`. Its own result correctly keeps runtime
authentication, external monotonicity, and rollback protection `false`. The
existing checkpoint readiness packet requires signed request/response receipts,
key lifecycle, anti-replay state, monotonic sequence, fork rejection, and
rollback evidence, but all production provider and trust facts remain `null`.

The current `/api/x/callback` route authenticates an OAuth exchange for the
retained Premium-only V1 HOLD path and then writes its legacy D1 binding state.
It does not create a signed V2 evidence receipt, use a provider public-key
registry, or advance a signed anti-replay chain. The X/social readiness packet
therefore also remains correctly `BLOCKED` and unauthenticated.

This module is not wired into either seam. It must not be described as runtime
provider authentication.

## Exact configured-key prerequisite

There is no default, generated, fixture, development, or fallback verification
key. `createProviderTrustBinding` requires all of these caller-supplied values:

- the exact `PRODUCTION` environment and one exact provider kind;
- non-placeholder provider-identity, subject-binding, and owner key-evidence
  SHA-256 digests;
- a provider-specific, versioned receipt-domain identifier;
- a production key-registry resource identifier;
- explicit maximum envelope age, future-clock skew, and key-overlap sequence
  bounds; and
- one to 32 strictly ordered public-key records.

Each key record must declare
`OWNER_SUPPLIED_PRODUCTION_PUBLIC_KEY`, `Ed25519`, an exact unpadded SPKI DER
base64url value, its matching SHA-256 digest, an activation sequence, optional
retirement sequence, a nonempty validity interval, and optional revocation and
compromise cutoffs. The parser rejects `TEST_FIXTURE`, Devnet, obvious
fixture/test/example/mock/placeholder identifiers, zero or repeated-byte
placeholder digests, zero Ed25519 key material, malformed or noncanonical DER,
non-Ed25519 keys, duplicate keys, sparse arrays, accessors, symbols, prototype
aliases, and unknown fields.

The resulting trust-root, trust-binding, and key-registry snapshot digests
prove only that the supplied bytes were bound consistently. A digest and the declaration
`OWNER_SUPPLIED_PRODUCTION_PUBLIC_KEY` do not prove that the owner supplied the
key, that a provider controls its private half, or that an external key registry
contains it.

## Canonical signed envelope

The Ed25519 transcript uses a fixed binary domain prefix followed by one exact
JSON field order. Every signed envelope binds:

- environment, provider kind, provider identity, subject, trust binding,
  receipt domain, trust root, and key-registry snapshot;
- key ID, signature algorithm, and a provider-kind-specific operation;
- canonical u64 sequence and exact predecessor-envelope digest;
- a caller-selected nonce digest;
- exact request-byte and response-byte SHA-256 digests; and
- issued-at and expires-at Unix seconds.

The verifier receives the original request and response as `Buffer` values and
an explicit expected caller nonce. It recomputes both byte digests, matches the
nonce, selects only the configured key, applies activation/retirement,
not-before/not-after, revocation, compromise-cutoff, expiry, age, and future-
skew rules, and finally verifies the Ed25519 signature. Changing one signed
field, byte, key, domain, subject, provider, operation, nonce, or time fails
closed.

## Supplied-state replay and predecessor check

`createProviderEnvelopeGenesisState` starts at sequence zero and the zero
predecessor digest. Each accepted envelope must be exactly the supplied state's
next u64 sequence and must name its exact head digest. Verification returns a
new content-addressed state. Against the supplied state this rejects exact
replay, sequence skip, same-sequence fork, and predecessor substitution.

The module does not persist or externally anchor that state. A caller that
rolls the whole state back can present an alternate historical branch, so the
result deliberately keeps both `durableReplayStateVerified` and
`externalRollbackProtectionVerified` `false`. Closing that boundary requires
an atomic durable state adapter plus an independently observed rollback anchor;
neither may be inferred from this host-only transition.

Successful verification receipts are process-private branded objects. A JSON
copy, structured clone, or caller-authored digest cannot be validated as an
executed signature check. Persisted consumers must re-run verification from the
original signed envelope and exact request/response bytes or use a separately
reviewed authenticated handoff.

## Exact truth boundary

A successful result proves only these local mechanics:

- the envelope had the exact canonical shape and digest;
- its Ed25519 signature matched one configured public key;
- the request, response, and caller nonce matched the signed transcript;
- the key's configured sequence/time lifecycle admitted this envelope; and
- the sequence and predecessor were contiguous with the supplied state.

Even after success, all of these remain explicitly `false`:

- `providerAuthenticationVerified`;
- `productionKeyOwnershipVerified`;
- `providerIdentityVerified`;
- `keyRegistryAuthenticityVerified`;
- `responseSemanticsVerified`;
- `durableReplayStateVerified`;
- `externalRollbackProtectionVerified`;
- `runtimeConsumerGatingVerified`;
- `providerOperationalTruthVerified`; and
- `activationReady`.

Mainnet remains `HOLD`. The verifier does not parse checkpoint or X evidence
semantics, prove collector completeness, prove OAuth or provider operational
truth, persist anti-replay state, authenticate a registry, isolate signing
credentials, gate reward consumers, or authorize a write, claim, publication,
payment, transfer, mint, deployment, or activation.

## Required owner and external evidence

The next production integration cannot proceed until the owner supplies and an
independent reviewer accepts the exact provider identity, subject binding,
receipt domain, Ed25519 public keys, key-registry resource, rotation schedule,
revocation state, compromise policy, receipt timing bounds, and content-
addressed approval evidence. Separate provider evidence must prove control of
the corresponding private keys and the signed response semantics.

After those inputs exist, closing the runtime blocker still requires a
credential-free verifier integration, atomic durable monotonic state, an
external rollback anchor, semantic codecs for checkpoint and X responses,
Daily-Law-first and every-consumer gating, outage/recovery drills, and
independent security, privacy, legal, and operations review. No field in this
reference substitutes for those facts.

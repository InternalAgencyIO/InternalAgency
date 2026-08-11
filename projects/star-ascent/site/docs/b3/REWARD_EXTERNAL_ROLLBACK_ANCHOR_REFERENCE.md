# B3 reward external rollback-anchor verification prerequisite

Status: **host-only, nonactivating signed-anchor prerequisite**. Mainnet remains
**HOLD**.

[`reward-external-rollback-anchor.mjs`](../../programs/iat_b3_reference/reward-external-rollback-anchor.mjs)
closes one narrow executable prerequisite for `DURABLE_REWARD_CAS`: it can
cryptographically verify that one exact, canonical reward checkpoint was
signed by a key in an explicitly supplied checkpoint-provider trust binding
and that the anchor is the next entry relative to two supplied predecessor
states.

This does not activate or modify the SQLite reward store, provider-neutral
checkpoint protocol, guarded write adapter, consumer gate, or release graph.
It does not contact a service, load a credential, generate a production key,
write durable state, perform a provider compare-and-swap, or authorize a reward
effect.

## Gap addressed

The SQLite adapter already proves atomic local writes, append-only history,
strict reopen validation, and crash durability. It deliberately cannot detect
replacement of the complete database/WAL persistence unit with an older,
internally consistent copy. The provider-neutral checkpoint protocol can
expose that rollback only when its current checkpoint comes from an
independent trusted monotonic system. Its existing host sink is
unauthenticated and can itself be rolled back.

This module supplies the missing cryptographic transcript shape between those
pieces. It composes the generic provider-envelope verifier rather than
inventing another key registry. The caller must supply a `PRODUCTION`
`EXTERNAL_CHECKPOINT_PROVIDER` trust binding containing explicit owner-supplied
Ed25519 public keys. Fixture, zero, malformed, noncanonical, wrong-provider,
revoked, compromised, inactive, expired, or unknown keys remain rejected by
that verifier. The trust binding has no default.

## Canonical exchange

The content-addressed anchor state binds:

- one nonzero anchor-namespace digest;
- one nonzero reward persistence-identity digest;
- the exact provider trust-binding, trust-root, and key-registry snapshot
  digests;
- bounded anchor age and future-clock skew;
- the last anchor sequence and digest;
- the last checkpoint revision and digest; and
- the corresponding CAS commit sequence and head digest.

Genesis is explicit. Its anchor sequence and checkpoint revision are zero and
all predecessor/head digests are zero. The first signed anchor must bind
checkpoint revision one and CAS sequence zero. Every later anchor advances
exactly one anchor sequence and one checkpoint revision, requires checkpoint
revision to equal CAS sequence plus one, and binds the exact previous anchor
and checkpoint digests. Skip, replay against advanced state, predecessor
splice, same-sequence fork, persistence-identity substitution, and checkpoint
rollback fail closed.

The canonical request binds the complete pre-state digest, next required
anchor/checkpoint sequence, exact predecessor digests, a caller nonce, request
time, namespace, persistence identity, and trust digests. The canonical anchor
statement binds the request digest, exact expected checkpoint and CAS head,
observation/expiry window, and all nonactivation facts. JSON is accepted only
as an exact bounded `Buffer` containing the single canonical UTF-8 encoding;
whitespace aliases, duplicate/extra/missing members, unsupported prototypes,
symbols, and accessors fail closed.

The outer provider envelope signs the exact request and anchor byte digests
under operation `CHECKPOINT_READ_CURRENT`. Its independent sequence and
predecessor state also advance contiguously. A signature under an unconfigured
key, the wrong key, a substituted trust binding, a different operation,
request/response byte mutation, nonce substitution, envelope replay, expiry,
revocation, or compromise cutoff fails.

A successful verification receipt is frozen and process-branded. A serialized
or shallow-cloned receipt is not an executed receipt. It exposes the next
provider-envelope state and next anchor state for a caller to persist atomically
outside this module.

## Exact positive facts

The receipt proves only:

- canonical request and anchor encoding;
- a valid Ed25519 signature under the exact configured public key;
- exact request nonce and request/response byte binding;
- advancement relative to the supplied provider replay state;
- contiguous anchor sequence and predecessor relative to the supplied anchor
  state;
- checkpoint revision/CAS-sequence monotonicity relative to that supplied
  state; and
- exact equality between the signed checkpoint fields and the caller's
  expected checkpoint fields.

The positive field is deliberately named
`suppliedStateCheckpointMonotonicityVerified`, not external monotonicity. The
module does not recompute the existing checkpoint's semantic digest from a
SQLite snapshot and does not authenticate how the caller obtained the expected
checkpoint. A future adapter must bridge that exact record through the existing
checkpoint validator and local snapshot verification.

## Deliberate HOLD boundary

The state, signed statement, and verification receipt forbid self-attestation
of broader facts. Depending on the artifact, these fields remain false:

- `providerAuthenticationVerified`;
- `providerIdentityVerified`;
- `productionKeyOwnershipVerified`;
- `keyRegistryAuthenticityVerified`;
- `durablePersistenceVerified` or `durableAnchorStateVerified`;
- `trustedMonotonicStorageVerified`;
- `externalMonotonicityVerified`;
- `externalRollbackProtectionVerified`;
- `runtimeIntegrationVerified`;
- `independentReviewAccepted`; and
- `activationReady`.

Every artifact remains `mainnetStatus: "HOLD"`. A configured public key and a
valid signature do not prove who controls the private key, whether the provider
identity and registry are authentic, whether the provider stored the anchor in
nonrollbackable infrastructure, or whether the signed response is operationally
truthful.

Most importantly, both monotonic states are caller supplied. An exact replay is
rejected when either current state has actually advanced. If a caller rolls
back both state objects and supplies the matching old signed exchange, the
cryptographic verifier cannot distinguish that from the original verification.
The hostile suite preserves this limitation explicitly and confirms all
durability, external monotonicity, and rollback facts remain false. Content
addressing detects substitution relative to a chosen state; it is not a trusted
monotonic counter.

## Remaining production work

This prerequisite does not complete `DURABLE_REWARD_CAS`. Production still
requires:

1. owner-approved production provider, tenant, resource, namespace, trust
   roots, key registry, key custody, and revocation evidence;
2. independently verified single-copy linearizable provider read/CAS semantics;
3. an external append-only or hardware-backed monotonic store that detects
   provider snapshot, backup, and control-plane rollback;
4. atomic durable persistence of both next states, or a reviewed recovery
   protocol that cannot accept an old pair after partial commit;
5. exact runtime bridging from the validated local checkpoint/snapshot into
   this signed request and from the receipt into the guarded local write and
   every consumer gate;
6. provider outage, lost-response, fork, restore, key-rotation, compromise,
   retention, RTO, and RPO drills;
7. enforcement against direct-store and alternate-client bypasses;
8. exact production identities and final-binary adversarial Devnet evidence;
   and
9. independent security, operations, economic, privacy, legal, and disaster-
   recovery review plus terminal authorization.

No request, anchor, state, or receipt produced here is a provider credential,
network observation, durable write, reward authorization, Devnet result,
deployment, or Mainnet authorization.

# B3 Privacy Vault signed external rollback-anchor prerequisite

Status: **host-only, nonactivating cryptographic transcript prerequisite**.
Mainnet remains **HOLD**.

[`privacy-vault-external-rollback-anchor.mjs`](../../programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs)
composes two already isolated prerequisites without changing either one:

- the generic configured-public-key provider envelope verifier; and
- the process-branded Privacy Vault recovery SQLite adapter.

It proves that one canonical anchor statement has a valid Ed25519 signature
under an explicitly supplied `PRODUCTION` `EXTERNAL_CHECKPOINT_PROVIDER` trust
binding and exactly describes the branded local recovery snapshot observed in
the same process. It does not contact, configure, or authenticate a provider;
generate, load, or retain a private key; write anchor state; integrate a
wallet; or authorize any Privacy Vault operation.

## Explicit trust and no signing surface

There is no default provider, identity, resource, namespace, public key, or key
registry. The caller must supply the strict generic trust binding with an
owner-supplied production Ed25519 public key. The generic verifier rejects
fixture, zero, placeholder, malformed, wrong-provider, inactive, expired,
revoked, compromised, or unknown key material.

This module exports no signing or private-key API. Test signatures are created
outside the module. A matching configured key and a valid signature do not
prove who owns the private key, whether the provider identity or registry is
authentic, or whether an external system stored the statement durably.

## Branded local snapshot binding

Genesis can be created only from the process-branded SQLite adapter while its
recovery history is empty. Structural clones, bound aliases, prototypes, and
transparent or hostile proxies do not carry the adapter's private process
brand.

Every request reopens and validates the SQLite snapshot through that branded
adapter. The request binds:

- the exact SQLite schema-manifest and complete snapshot digests;
- the vault and recovery-key commitments;
- the recovery bundle lifetime and future-skew policy;
- the exact recovery epoch and content-addressed recovery state;
- the exact last encrypted bundle digest; and
- the exact local cursor revision and cursor digest.

The request also binds the complete supplied anchor-state digest, the next
required anchor sequence, the exact predecessor-anchor digest, an unpredictable
caller-supplied nonce digest, the request time, the anchor namespace, and the
provider trust-root and registry digests.

When the local recovery history has advanced, the module verifies that the
snapshot still contains the exact previously anchored bundle, state, cursor,
and historical prefix snapshot. A locally restored older database, a fork at
the anchored epoch, or a substituted vault, recovery key, policy, schema, or
cursor fails closed relative to the supplied anchor state.

## Canonical signed exchange

The response statement is the next contiguous anchor relative to the supplied
state. It binds the request digest, predecessor anchor, every local snapshot
field, and a bounded observation and expiry interval. Request and response are
accepted only as nonempty bounded `Buffer` values containing their single
canonical UTF-8 JSON encodings. Whitespace, key-order, duplicate-key,
extra/missing member, accessor, symbol, prototype, byte-view, and digest aliases
fail closed.

The outer provider envelope signs the exact request and statement byte digests
under operation `CHECKPOINT_READ_CURRENT`. Its independent replay state must
also advance exactly one sequence and bind the exact predecessor envelope.
Wrong operation, key, signature, request nonce, request bytes, response bytes,
time window, replay, skip, fork, or predecessor substitution fails.

Verification re-reads the branded SQLite snapshot after parsing the signed
exchange and requires exact equality with both request and statement. A local
recovery commit between request construction and verification is therefore a
drift HOLD, not a silently anchored different head.

## Exact positive facts

A successful, frozen, process-branded verification receipt proves only:

- canonical request and anchor encodings;
- a valid signature under the exact configured public key;
- exact request nonce and request/response byte binding;
- advancement relative to the caller-supplied provider replay state;
- a contiguous sequence and predecessor relative to the caller-supplied
  anchor state;
- a read through the process-branded local SQLite adapter;
- exact equality between the signed fields and that local snapshot; and
- ancestry of the supplied prior anchor within the currently validated local
  SQLite history.

The receipt validator checks its private execution brand before inspecting the
candidate. Serialization, spread clones, prototypes, accessors, and proxies
cannot become executed receipts.

## Deliberate HOLD boundary

The state, statement, and receipt keep all of these false:

- provider authentication and provider-identity verification;
- production private-key ownership and key-registry authenticity;
- durable anchor-state persistence and external durability;
- trusted external monotonic storage;
- external rollback protection;
- runtime integration;
- privacy/legal review acceptance;
- Devnet lifecycle verification;
- activation readiness; and
- Mainnet execution authorization.

Every artifact has `mainnetStatus: "HOLD"`. The generic provider receipt also
retains its own negative provider-authentication and durability facts.

Most importantly, the provider replay state, anchor state, and SQLite database
are all supplied local inputs. A restored older SQLite database accompanied by
the matching older provider state, older anchor state, and original signed
exchange is indistinguishable from the original verification. The hostile
suite preserves this exact limitation and confirms
`externalRollbackProtectionVerified: false`. Content addressing detects
substitution relative to the states actually supplied; it is not a hardware
counter, transparency log, linearizable provider CAS, or independent rollback
proof.

## Remaining production work

This prerequisite does not close `PRIVACY_VAULT_CLIENT`. Production still
requires:

1. owner-approved provider identities, resources, namespaces, trust roots,
   registry provenance, private-key custody, rotation, and revocation evidence;
2. independently proven external append-only or hardware-backed monotonic
   storage and restore behavior;
3. atomic durable persistence of provider and anchor next states, or a reviewed
   recovery protocol that cannot accept an old pair after a partial commit;
4. exact integration with the native Privacy Vault planner, durable operation
   journal, authenticated Solana finality, proof-context discovery, and cleanup;
5. secure wallet/platform-keystore integration and key-loss behavior;
6. direct-client bypass prevention and false-zero UI enforcement;
7. final-binary adversarial Devnet lifecycle and failure drills; and
8. independent cryptographic, privacy, security, accessibility, operations,
   and legal review plus terminal authorization.

No artifact from this module is a provider credential, external observation,
durable external write, Solana transaction, proof, deployment, Devnet result,
privacy acceptance, or Mainnet authorization.

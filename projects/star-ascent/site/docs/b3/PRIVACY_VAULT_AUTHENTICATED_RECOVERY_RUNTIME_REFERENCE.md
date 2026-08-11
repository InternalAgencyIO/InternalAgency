# Privacy Vault authenticated recovery runtime prerequisite

Status: **host-only composition verified, nonactivating**. This reference
runtime performs no RPC, signing, provider I/O, Solana instruction encoding,
deployment, or activation. Mainnet remains **HOLD**.

[`privacy-vault-authenticated-recovery-runtime.mjs`](../../programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs)
is a narrow orchestration prerequisite over four existing reviewed boundaries:

1. the encrypted recovery lifecycle verifier;
2. the process-branded, append-only Privacy Vault recovery SQLite adapter;
3. the generic signed provider-envelope verifier through the Privacy Vault
   external rollback-anchor prerequisite; and
4. caller-supplied provider and anchor replay states.

It does not replace the native Rust Privacy Vault planner and is not a wallet,
keystore, provider client, Solana client, or production runtime.

## Construction boundary

Construction requires exactly:

- an explicit validated `PRODUCTION` checkpoint-provider trust binding;
- a process-branded Privacy Vault recovery SQLite adapter;
- a canonical provider replay state bound to that trust input; and
- a canonical Privacy Vault anchor state bound to the same trust input.

The constructor performs an exact read of the branded SQLite snapshot and
requires the supplied anchor head to be Genesis or an exact ancestor of that
snapshot. The returned runtime is process-branded only after every dependency
has validated. Structural clones, bound aliases, prototypes, accessors, and
proxies do not acquire the brand.

This validates supplied configuration and local ancestry only. It does not
prove the owner controls a production key, the registry is authentic, the
provider exists, or either supplied replay state came from durable storage.

## Local encrypted recovery commit

`commitRecoveryBundle` obtains the current state from the branded SQLite
adapter, executes the process-private AES-256-GCM recovery verifier without
retaining the recovery-key bytes, and passes that executed receipt directly to
the SQLite adapter. The bundle record, cursor, and recovery state are committed
in the adapter's existing transaction and read back before the runtime returns
a process-branded local receipt.

The local receipt may assert only that this process executed the recovery
verification and observed the exact durable local SQLite head. It keeps
provider authentication, external durability, rollback protection,
cross-system atomicity, native runtime integration, and Mainnet false.

`reconcileCommittedRecoveryBundle` is deliberately separate. After a process
restart or lost response it accepts only the exact structurally valid bundle at
the current validated SQLite head. Its receipt reports
`recoveryVerificationExecutedThisProcess: false`; it relies only on the stored
digest of the process-private receipt accepted when that local row was first
written. A different bundle, older epoch, fork, or rehashed head is rejected.
This is local readback, not renewed cryptographic verification and not external
rollback protection.

## Signed anchor preparation and consumption

`prepareAnchorRequest` creates one canonical request from the exact current
SQLite snapshot and current supplied anchor state. Its canonical bytes are
stored behind a process-private prepared-request capability; the public object
contains only a base64url copy for transport. A clone, proxy, or request from a
different runtime cannot be consumed.

`consumeSignedAnchor` accepts only that capability, a caller-supplied signed
provider envelope, canonical anchor bytes, and an evaluation time. The existing
external-anchor verifier rechecks:

- the configured Ed25519 public key and signature;
- exact request and response bytes;
- request nonce, operation, trust root, and registry digest;
- provider and anchor sequence/predecessor continuity;
- request, statement, SQLite schema, snapshot, recovery state, bundle, cursor,
  nonce, and time bindings; and
- the branded local snapshot at consumption time.

Only after that verifier returns a process-private receipt does the host runtime
advance its in-memory provider and anchor states. A repeated envelope, a stale
prepared request, a local commit after preparation, cross-runtime capability,
wrong signature, wrong operation, or changed response fails closed.

The positive `cryptographicEnvelopeVerificationExecuted` fact means only that
the configured-key signature check ran over exact bytes. It does not promote
`providerAuthenticationVerified`, provider identity, key ownership, registry
authenticity, provider operations, external durability, or rollback protection.

## Immutable HOLD truth boundary

The runtime, snapshots, prepared requests, and both receipt forms keep all of
these facts false:

- `providerAuthenticationVerified`;
- `providerIdentityVerified`;
- `productionKeyOwnershipVerified`;
- `keyRegistryAuthenticityVerified`;
- `providerOperationalTruthVerified`;
- `externalDurabilityVerified`;
- `externalRollbackProtectionVerified`;
- `crossSystemAtomicityVerified`;
- `runtimeConfinementVerified`;
- `onchainRuntimeIntegrationVerified`;
- `nativePrivacyVaultPlannerIntegrated`;
- `authenticatedSolanaFinalityVerified`;
- `securePlatformKeystoreVerified`;
- `privacyLegalReviewAccepted`;
- `devnetLifecycleVerified`;
- `activationReady`; and
- `mainnetExecutionAuthorized`.

Every artifact remains `mainnetStatus: "HOLD"`. Receipt clones and serialized
copies lose their process execution brands. The deployable module exports no
signer, private-key, RPC, transaction, broadcast, deployment, or activation
API.

## Explicit residual failures

This prerequisite cannot make an external signature and a local SQLite commit
atomic. The local recovery bundle can be ahead of the last signed anchor until
a later request is accepted. Provider and anchor next states are held only in
memory by this runtime; their durable persistence remains separate. Restoring
the SQLite database together with both old caller-supplied replay states can
therefore reproduce an old accepted view. That exact limitation remains tested
and all external rollback facts stay false.

Static source inventory pins the runtime's exact path, source digest, and
reviewed lifecycle/SQLite/external-anchor imports and calls. The inventory is
still a static, non-exhaustive source assertion: dynamic or reflective dispatch
and runtime confinement remain unproved and `HOLD`.

## Remaining production work

`PRIVACY_VAULT_CLIENT` remains blocked. Completion still requires owner-approved
production identities and provider evidence; externally durable provider and
anchor states; a native instruction/proof client integrated with the Rust
planner; authenticated Solana account/program/finality observations; durable
operation-journal recovery and proof-context cleanup; a secure platform
keystore and key-loss UX; direct-client bypass prevention; final-binary
adversarial Devnet evidence; measured cost and wallet compatibility; and
independent cryptographic, privacy, security, accessibility, operations, and
legal review followed by terminal authorization.

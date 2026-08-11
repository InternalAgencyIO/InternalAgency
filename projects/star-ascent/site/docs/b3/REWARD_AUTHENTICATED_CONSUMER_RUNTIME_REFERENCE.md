# B3 signed-anchor reward-consumer runtime composition prerequisite

Status: **host-only, nonactivating composition prerequisite**. Mainnet and
every external effect remain **HOLD**.

[`reward-authenticated-consumer-runtime.mjs`](../../programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs)
closes one narrow reference gap: the provider-envelope verifier, signed reward
rollback anchor, durable local anchor mirror, exact-checkpoint reward-consumer
permit, and durable local cursor/projection event now have one static,
inventory-visible call path. The returned object exposes only
`consumeAnchoredLocalProjection`; it does not expose the injected reward store,
anchor mirror, consumer cursor, or process-branded permit.

This is not a production provider client, credential loader, network adapter,
materialized reward projection, payment executor, runtime-confinement proof,
or launch switch. No app or worker calls it. Its production binding fields are
currently unavailable, provider readiness remains `BLOCKED`, and its broad
truth flags remain false.

## Exact configuration boundary

The factory accepts exactly five caller-supplied values:

- one content-addressed runtime binding;
- one explicit `PRODUCTION` `EXTERNAL_CHECKPOINT_PROVIDER` trust binding;
- the exact checkpoint-gated reward SQLite store;
- the exact durable rollback-anchor SQLite mirror; and
- the exact durable reward-consumer cursor.

The runtime binding has no defaults. It commits to:

- runtime identity and production identity-freeze manifest digests;
- deployment-domain and reward-persistence-identity digests;
- reward adapter schema, version, schema manifest, and Genesis entity-set
  digest;
- rollback-anchor namespace;
- provider trust-binding, trust-root, key-registry snapshot, receipt-domain,
  and owner production-key evidence digests;
- provider-readiness packet, failure-domain separation, and complete consumer-
  inventory evidence digests;
- rollback-anchor and consumer-cursor schema-manifest digests; and
- one approved consumer ID, projection kind, and projection key.

Before reading any adapter property, the factory requires a process-private
factory brand from the exact loaded checkpoint-gated store, rollback-anchor
mirror, and consumer-cursor modules. The brands are held only in module-local
`WeakSet`s; exported assertions can test membership but cannot add it. Exact-
property clones, bound-method aliases, transparent or hostile proxies,
prototype lookalikes, and accessor-backed fakes therefore fail before their
properties are read. A real branded adapter is frozen before it is branded.

After that identity boundary, the factory reads and validates the complete
reward snapshot and persistence identity, checks the checkpoint-gated
wrapper's fixed HOLD flags, checks both SQLite adapters' exact schemas/manifests
and truth boundaries, and requires all available live values to equal the
binding. Merely supplying an evidence digest does not establish evidence
acceptance. The binding therefore fixes
`productionIdentityEvidenceAccepted`, provider authentication, independent
review, runtime integration, and activation to false.

The provider trust binding still requires explicit owner-supplied Ed25519
public-key records. Each record binds key ID, canonical SPKI bytes and digest,
activation and optional retirement sequence, validity interval, optional
revocation time, and optional compromise cutoff. The trust binding also binds
the provider identity and subject digests, dedicated receipt-domain ID,
key-registry resource ID, owner key-evidence digest, maximum envelope age,
future skew, and key-overlap sequence bound. There is no default key, identity,
provider, tenant, service, or resource.

## One ordered local operation

`consumeAnchoredLocalProjection` accepts an exact data-only input containing:

- the canonical Daily-Law state;
- current supplied provider-envelope and reward-anchor states;
- one signed provider envelope plus canonical request and anchor bytes;
- expected nonce digest and evaluation time;
- the complete provider-neutral reward checkpoint;
- the configured consumer ID and `LOCAL_PROJECTION` scope;
- one retained target commit sequence and digest; and
- one exact configured projection kind, key, and canonical typed payload.

The operation proceeds in this order:

1. Daily Law is checked before any provider, store, cursor, projection, or
   other caller field is read. A locked or invalid state leaves every local
   store unchanged.
2. The input, consumer, scope, target, and projection shape/namespace/payload
   are validated. `EXTERNAL_EFFECT` is rejected unconditionally.
3. The reward persistence identity and complete snapshot are revalidated. The
   supplied full checkpoint must be exactly equal to the current local head;
   an ancestor, fork, unrelated identity, or locally ahead state is rejected.
4. The exact six-field checkpoint projection is passed to the signed rollback-
   anchor verifier. The Ed25519 signature, key selection, nonce, request and
   response bytes, time window, provider replay predecessor, anchor
   predecessor, checkpoint digest, CAS sequence, and CAS head must all match.
5. Only the process-branded verification receipt is appended to the rollback-
   anchor mirror. Receipt and mirror cursor commit atomically. The durable head
   is read back and must exactly match the receipt's advanced anchor/provider
   states and checkpoint.
6. The same full checkpoint is passed to the existing reward-consumer permit
   constructor. It revalidates the local reward snapshot, exact checkpoint,
   target commit, operation-specific proof, and indivisible reservation
   evidence, returning a process-branded local-only permit.
7. The permit and canonical projection enter the existing durable consumer
   cursor. Cursor and projection event commit atomically, then are read back and
   checked against the permit, checkpoint, target, payload, and configured
   runtime binding.
8. A frozen process-branded composition receipt binds both durable local
   records and preserves every nonauthorization fact.

All integration calls and imports are static. The guarded-source inventory
pins this module's exact SHA-256 and exact marker locations. A new caller,
alias, computed access, direct table path, raw store path, or change to this
module fails that source gate until an explicit ledger update and review.

## Partial commit and reconciliation boundary

The rollback-anchor database and consumer-cursor database are separate local
persistence units. They do not share one SQLite transaction. If the signed
anchor commits and later permit or cursor processing fails, the anchor remains
validly advanced while no consumer event exists. Retrying the exact signed
exchange is idempotent at the anchor mirror and can continue the consumer
operation.

If the consumer cursor/event transaction commits but the caller loses the
return value, an exact retry re-verifies the signed exchange, reconciles the
current cursor and projection event by exact readback, and returns disposition
`RECONCILED_AFTER_COMMIT` without another insert. A changed consumer, target,
permit digest, checkpoint, projection namespace, or payload cannot reconcile
over the committed record. A cursor already beyond the requested sequence is
not treated as an exact retry.

This is local recovery, not distributed atomicity. There is no transaction
with a provider, materialized projection, queue, webhook, token transfer, or
other service. Whole-unit rollback of both local databases and both supplied
provider/anchor states remains undetectable without an independent higher
anchor.

## Exact positive facts

A valid composition receipt establishes only that this process observed:

- a passing Daily-Law write gate;
- three exact factory-created, process-branded local adapters rather than
  structural clones or proxies;
- exact configured local runtime-binding matches;
- the predecessor verifier's canonical Ed25519 signature prerequisite;
- an exact signed checkpoint equal to the validated local reward head;
- an exact durable local anchor receipt and mirror cursor;
- an exact durable local consumer cursor and projection event; and
- either a new local cursor/event commit or exact lost-return readback.

The positive field is
`cryptographicSignaturePrerequisiteVerified`, not provider authentication.
Likewise, `durableLocalAnchorMirrorMatched` and
`durableLocalCursorEventMatched` describe local records only.

## Deliberate HOLD boundary

The runtime and/or every composition receipt preserve these broader fields as
false:

- `providerAuthenticationVerified`;
- `providerIdentityVerified`;
- `productionKeyOwnershipVerified`;
- `keyRegistryAuthenticityVerified`;
- `externalProviderDurabilityVerified`;
- `externalMonotonicityVerified`;
- `independentRollbackProtectionVerified`;
- `suppliedStateAuthenticityVerified`;
- `materializedProjectionStateVerified`;
- `projectionEffectAtomicityVerified`;
- `runtimeConfinementVerified`;
- `runtimeIntegrationVerified`;
- `externalSideEffectsAuthorized`;
- `independentReviewAccepted`; and
- `activationReady`.

Every artifact remains `mainnetStatus: "HOLD"`. A configured key and valid
signature do not establish provider identity, key ownership, registry
authenticity, operational truth, or externally monotonic storage. A static
reference call path and source ledger do not prove the final artifact contains
only this path or that a deployed process cannot load other code. Process-
private adapter identity blocks in-process structural substitution at this
constructor; it is not final-artifact runtime confinement and does not prevent
other code from retaining or invoking an underlying store.

## Missing production inputs and evidence

The canonical external-checkpoint readiness packet currently leaves its
subject, provider, and failure-domain fields null. Production still requires
owner-selected and independently reviewed values for:

1. identity-freeze manifest, deployment domain, persistence identity, reward
   schema/Genesis set, external namespace, and trust policy;
2. provider legal entity, product, tenant, resource, region policy, receipt
   format, terms, retention policy, trust root, and key-registry resource;
3. exact public keys, key ownership/custody, rotation, revocation, compromise,
   and authenticated registry evidence;
4. distinct local persistence, provider write, administration, credential,
   and backup failure-domain identities;
5. production database paths and custody, approved consumer/projection IDs,
   and a complete downstream consumer inventory;
6. authenticated provider read/CAS, linearizability, monotonicity, outage,
   uncertain-response, rollback, backup/restore, RTO, and RPO evidence;
7. a same-transaction materialized projection or reviewed durable outbox with
   cross-system idempotency;
8. final-artifact runtime confinement and enforcement against dynamic loading,
   alternate clients, retained raw stores, and direct database access;
9. exact final binaries and full adversarial Devnet rehearsal; and
10. independent security, operations, economic, privacy, legal, and disaster-
    recovery acceptance plus terminal authorization.

No runtime binding, signature, mirror row, permit, cursor, projection event, or
composition receipt from this module is a provider credential, authenticated
production observation, independent rollback proof, materialized reward,
external-effect authorization, Devnet result, deployment, or Mainnet
authorization.

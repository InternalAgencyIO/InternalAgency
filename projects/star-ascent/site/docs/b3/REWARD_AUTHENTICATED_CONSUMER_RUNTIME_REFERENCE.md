# B3 signed-anchor reward-consumer runtime composition prerequisite

Status: **host-only, nonactivating composition prerequisite**. Mainnet and
every external effect remain **HOLD**.

[`reward-authenticated-consumer-runtime.mjs`](../../programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs)
closes one narrow reference gap: the provider-envelope verifier, signed reward
rollback anchor, durable local anchor mirror, exact-checkpoint reward-consumer
permit, and durable local projection persistence now have static,
inventory-visible call paths. The V1 factory retains
`consumeAnchoredLocalProjection` and its cursor/event receipt. The separate V2
factory exposes `consumeAnchoredMaterializedProjection`, which atomically
persists a cursor, event, and canonical projection state in one local SQLite
database. Neither runtime exposes its injected reward store, anchor mirror,
cursor/projection adapter, or process-branded permit.

This is not a production provider client, credential loader, network adapter,
payment executor, runtime-confinement proof, cross-database transaction, or
launch switch. No statically visible app or worker caller is present, but the
source inventory cannot reject a caller that computes a property name at
runtime or obtains it reflectively. Its production binding fields are
currently unavailable, provider readiness remains `BLOCKED`, and its broad
truth flags remain false.

## Exact configuration boundary

Each factory accepts exactly five caller-supplied values:

- one content-addressed runtime binding;
- one explicit `PRODUCTION` `EXTERNAL_CHECKPOINT_PROVIDER` trust binding;
- the exact checkpoint-gated reward SQLite store;
- the exact durable rollback-anchor SQLite mirror; and
- either the exact durable V1 reward-consumer cursor or the exact V2
  materialized-projection adapter.

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
- rollback-anchor schema-manifest digest plus either the V1 consumer-cursor
  manifest or the V2 materialized-projection manifest; and
- one approved consumer ID, projection kind, and projection key.

V1 and V2 use distinct binding schemas and content-addressed digests. V2's
field is named `materializedProjectionSchemaManifestSha256`; it cannot relabel
or reuse V1's `consumerCursorSchemaManifestSha256`. A cursor manifest supplied
to V2 is rejected before an operation can write projection state.

Before reading any adapter property, the factory requires a process-private
factory brand from the exact loaded checkpoint-gated store, rollback-anchor
mirror, and selected cursor/projection module. The brands are held only in module-local
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

## Ordered local operations

Both `consumeAnchoredLocalProjection` and
`consumeAnchoredMaterializedProjection` accept the same exact data-only input
containing:

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
7. On V1, the permit and canonical projection enter the existing durable
   consumer cursor; cursor and projection event commit atomically. On V2, the
   permit enters the process-branded materialized adapter; cursor, projection
   event, and canonical full state commit atomically in its one local SQLite
   transaction. The selected complete record set is read back through both
   snapshot and direct-read APIs and checked against the permit, checkpoint,
   target, payload, adapter manifest, and configured runtime binding.
8. A frozen process-branded composition receipt binds both durable local
   records and preserves every nonauthorization fact.

The two reference compositions themselves use only static calls and imports.
The guarded-source inventory pins this module's exact SHA-256 and exact static
marker locations. A new literal caller, alias retaining a guarded token,
encoded static token, direct table path, raw store path, or change to this
module fails that static source check until an explicit ledger update and
review. Runtime-computed member dispatch, two-step function extraction, and
reflection are not rejected by that check; exhaustive deployable-path
inventory and runtime confinement remain false.

## Partial commit and reconciliation boundary

The rollback-anchor database and selected cursor/projection database are
separate local persistence units. They do not share one SQLite transaction. If
the signed anchor commits and later permit or projection processing fails, the
anchor remains validly advanced while no consumer event/state exists. Retrying
the exact signed exchange is idempotent at the anchor mirror and can continue
the consumer operation.

If the consumer cursor/event transaction commits but the caller loses the
return value, an exact retry re-verifies the signed exchange, reconciles the
current cursor and projection event by exact readback, and returns disposition
`RECONCILED_AFTER_COMMIT` without another insert. A changed consumer, target,
permit digest, checkpoint, projection namespace, or payload cannot reconcile
over the committed record. A cursor already beyond the requested sequence is
not treated as an exact retry.

The V2 equivalent returns `RECONCILED_EXACT_REPLAY` only after exact durable
readback of the cursor, event, and materialized state. Changed bytes,
namespace, permit, checkpoint, or target fail closed. Within that projection
database, `projectionEffectAtomicityVerified: true` is valid only on the
post-readback receipt and only with
`projectionEffectScope: DURABLE_LOCAL_SQLITE_STATE_ONLY`.

This is local recovery, not distributed atomicity. There is no transaction
with a provider, queue, webhook, token transfer, external database, or other
service. Whole-unit rollback of both local databases and both supplied
provider/anchor states remains undetectable without an independent higher
anchor.

## Exact positive facts

A valid composition receipt establishes only that this process observed:

- a passing Daily-Law write gate;
- three exact factory-created, process-branded local adapters for the selected
  V1 or V2 path rather than structural clones or proxies;
- exact configured local runtime-binding matches;
- the predecessor verifier's canonical Ed25519 signature prerequisite;
- an exact signed checkpoint equal to the validated local reward head;
- an exact durable local anchor receipt and mirror cursor;
- an exact durable local consumer cursor and projection event on V1, or an
  exact durable local cursor/event/full-state triplet on V2; and
- either a new selected local commit or exact lost-return readback.

The positive field is
`cryptographicSignaturePrerequisiteVerified`, not provider authentication.
Likewise, `durableLocalAnchorMirrorMatched`,
`durableLocalCursorEventMatched`, and
`durableLocalMaterializedProjectionMatched` describe local records only. V2's
receipt sets `materializedProjectionStateVerified` and
`projectionEffectAtomicityVerified` true only after exact readback and only for
the local SQLite state scope; the newly constructed empty runtime keeps those
operation facts false.

## Deliberate HOLD boundary

Both runtimes and receipts preserve these broader fields as false:

- `providerAuthenticationVerified`;
- `providerIdentityVerified`;
- `productionKeyOwnershipVerified`;
- `keyRegistryAuthenticityVerified`;
- `externalProviderDurabilityVerified`;
- `externalMonotonicityVerified`;
- `independentRollbackProtectionVerified`;
- `suppliedStateAuthenticityVerified`;
- `externalRollbackAnchorVerified`;
- `crossDatabaseAnchorProjectionAtomicityVerified`;
- `runtimeAuthenticationVerified`;
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

The V1 runtime and receipt also keep `materializedProjectionStateVerified` and
`projectionEffectAtomicityVerified` false. The V2 runtime keeps them false
until an operation succeeds; only its process-issued, post-readback receipt
sets them true, inseparably from
`projectionEffectScope: DURABLE_LOCAL_SQLITE_STATE_ONLY`.

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
7. reviewed cross-database anchor/projection recovery plus any durable outbox,
   external effect, and cross-system idempotency required by the production
   consumer;
8. final-artifact runtime confinement and enforcement against dynamic loading,
   alternate clients, retained raw stores, and direct database access;
9. exact final binaries and full adversarial Devnet rehearsal; and
10. independent security, operations, economic, privacy, legal, and disaster-
    recovery acceptance plus terminal authorization.

No runtime binding, signature, mirror row, permit, cursor, projection event,
local materialized state, or composition receipt from this module is a
provider credential, authenticated production observation, independent
rollback proof, externally durable reward, external-effect authorization,
Devnet result, deployment, or Mainnet authorization.

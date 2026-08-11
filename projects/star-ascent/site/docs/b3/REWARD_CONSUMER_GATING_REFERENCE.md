# B3 reward-consumer gating reference

Status: host-only, non-activating reference. Mainnet and every external side
effect remain **HOLD**.

The reward allocator, durable SQLite CAS, and provider-neutral external
checkpoint protocol previously established deterministic allocation and local
commit lineage. They did not establish the point at which a downstream process
may consume a local commit. In particular, a process could otherwise observe a
valid local CAS head that had not yet reached the external checkpoint.

[`reward-consumer-gate.mjs`](../../programs/iat_b3_reference/reward-consumer-gate.mjs)
adds that missing fail-closed reference boundary.

[`reward-checkpoint-gated-cas.mjs`](../../programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs)
adds the corresponding host write boundary for both supported reward-CAS
mutations: round finalization and Premium-upgrade recording. The wrapper reads
the current checkpoint itself; callers cannot supply a checkpoint as a write
argument. It admits one local CAS write only while the validated local head and
checkpoint are exactly equal. That write necessarily makes the local database
one commit ahead, so the next write remains closed until the checkpoint is
advanced through the existing sequential reconciliation protocol. A missing,
stale, forked, unrelated, or locally-ahead checkpoint fails before the wrapped
CAS adapter is called, and the denied attempt leaves the local snapshot
unchanged.

After successful construction, the frozen wrapper is recorded in a module-
private `WeakSet`. Its exported assertion checks only that process membership,
without reading candidate properties. This lets the authenticated reference
runtime reject exact-property clones, bound-method aliases, proxies, prototype
lookalikes, and accessor fakes before they can fabricate wrapper truth fields.

This is still a compositional host reference, not an IAT-wide bypass proof. A
caller that retains and invokes the underlying store can bypass the wrapper;
provider reads remain unauthenticated; and the local SQLite transaction cannot
be atomic with an external provider read. The gate therefore fixes
`directStoreBypassPreventionVerified`, `runtimeAuthenticationVerified`,
`externalMonotonicityVerified`, `rollbackProtectionVerified`, and
`activationReady` to `false` and remains `HOLD`.

[`reward-consumer-cursor-sqlite.mjs`](../../programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs)
adds a file-backed, append-only cursor for the local projection side. It accepts
only a process-branded permit from the exact-checkpoint consumer gate and
requires each consumer to advance through global CAS commits contiguously from
sequence one. Replay, skip, cross-consumer substitution, copied permits,
history update/delete, and schema drift fail closed. Cursor history uses a
pinned strict SQLite schema, WAL, `synchronous=FULL`, defensive mode, canonical
u64 ordering, chained record digests, and complete reopen validation. Each
consumer has an independent chain, and a committed cursor can be reconciled by
exact readback after a caller loses the return value.

The cursor factory likewise brands only a successfully opened, fully validated,
frozen adapter in a module-private `WeakSet`. Its exported assertion performs
no candidate property reads. That blocks structural adapter substitution at
the authenticated-runtime constructor without claiming that every deployed
consumer is confined to that constructor.

The cursor now requires one exact canonical local-projection commitment and
appends that complete projection event plus its cursor in the same SQLite
`BEGIN IMMEDIATE` transaction. Deferred foreign-key binding, one-to-one set
validation on every read/reopen, append-only triggers, and injected faults
after each insert prove that neither local record can survive without the
other. The event can be replayed deterministically from its typed payload and
is exactly bound to the permit, checkpoint, commit, consumer, and cursor.
Nonempty `Buffer` and `Uint8Array` payloads are codec-normalized and detached
at write and every read. ECMAScript does not permit freezing a nonempty byte
view, so containing records remain frozen while each returned view is a
caller-owned copy whose mutation cannot alter durable state or a later read.

This proves only atomic persistence of a local event log record. It does not
prove that a materialized projection database or external effect was updated,
cannot prove that every deployed runtime consumer uses this API, and has no
independent anti-rollback anchor. Its records therefore keep
`materializedProjectionStateVerified`, `runtimeAuthenticationVerified`,
`rollbackProtectionVerified`, `projectionEffectAtomicityVerified`,
`externalSideEffectsAuthorized`, and `activationReady` false. No queue,
webhook, payment, token transfer, or other external effect is authorized.

[`reward-materialized-projection-sqlite.mjs`](../../programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs)
adds the next isolated local prerequisite. It consumes the same process-branded
local-only permit and commits a contiguous cursor, projection event, and full
canonical materialized projection state in one file-backed SQLite transaction.
While its exact trigger schema remains installed, the full-state history is
DML-append-only and independently chained for each exact consumer/kind/key
namespace. Every open and operation verifies the exact schema, integrity,
cursor chain, state chain, and one-to-one cursor/event/state set.
Exact retries reconcile without another write; changed replays and skips fail
closed; injected failures after every insert roll the entire triplet back. A
lost return after `COMMIT` is recovered by exact replay after reopen.

Its `projectionEffectAtomicityVerified: true` assertion is inseparable from
`projectionEffectScope: DURABLE_LOCAL_SQLITE_STATE_ONLY`. It does not cover an
external system or side effect. A separate V2 authenticated reference factory
accepts only this process-branded adapter under a distinct binding with its
exact materialized schema manifest. The empty V2 runtime keeps operation facts
false; only a post-readback process-issued receipt asserts local materialized
state and local projection atomicity. Runtime integration remains false.
Provider authenticity, independent rollback protection, cross-database
atomicity, runtime confinement, external effects, activation, and Mainnet
remain false or `HOLD`. The complete boundary is in
[`REWARD_MATERIALIZED_PROJECTION_SQLITE_REFERENCE.md`](./REWARD_MATERIALIZED_PROJECTION_SQLITE_REFERENCE.md).

[`reward-authenticated-consumer-runtime.mjs`](../../programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs)
adds two static, inventory-visible reference compositions. Both check Daily Law
first, validates the full local reward snapshot and exact checkpoint, verifies
the canonical provider-key-signed rollback-anchor exchange, commits and reads
back the local durable anchor mirror, creates a process-branded local-only
consumer permit against that same checkpoint. V1 commits and reads back its
durable cursor plus projection event. V2 uses a distinct binding schema and
atomically commits and reads back its local cursor/event/materialized-state
triplet. An exact retry reconciles the selected durable records without another
insert. The returned runtimes do not expose their injected stores or permit.

The constructor requires the module-private process brands of all three
injected adapters before it inspects their public schemas, methods, or truth
fields. Exact-property clones, bound aliases, proxies, prototypes, and accessor
fakes cannot manufacture `durableLocalAnchorMirrorMatched`,
`durableLocalCursorEventMatched`, or
`durableLocalMaterializedProjectionMatched`; only subsequent readback from the
exact factory-created adapters can set those local facts.

That composition remains host-only and nonactivating. It has no production
provider client or credentials; does not authenticate provider identity, key
ownership, registry truth, or supplied predecessor states; does not establish
external monotonicity or independent rollback protection; and the anchor
mirror is not atomic with either projection database or any external effect.
No app or worker contains a statically recognized construction of either path;
runtime-computed or reflective construction remains unresolved. They therefore
keep
provider authentication, external monotonicity, rollback protection,
cross-database atomicity, runtime confinement/integration, external effects,
activation, and Mainnet false or `HOLD`. V1 also keeps materialization false;
V2 asserts it only on an exact local post-readback receipt. Their exact truth
boundary and missing production inputs are in
[`REWARD_AUTHENTICATED_CONSUMER_RUNTIME_REFERENCE.md`](./REWARD_AUTHENTICATED_CONSUMER_RUNTIME_REFERENCE.md).

[`reward-guarded-source-inventory.mjs`](../../programs/iat_b3_reference/reward-guarded-source-inventory.mjs)
adds a repository-source gate around the guarded reward adapters. It enumerates the
first-party deployable/reference JavaScript, TypeScript, Rust, Python, shell,
and command sources directly from the filesystem, rejects source symlinks,
and excludes only dependencies, generated build/test output, tests, docs,
archives, and vendor sources. The auditor itself is excluded to avoid a
circular self-hash; the paired artifact, build-provenance, and dual-build
auditors are excluded for the same reason because they necessarily contain the
forbidden markers and gate identities as data.

The exact critical-source ledger is:

- `programs/iat_b3_reference/provider-authenticated-envelope.mjs`;
- `programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs`;
- `programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs`;
- `programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs`;
- `programs/iat_b3_reference/reward-persistence-cas.mjs`;
- `programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs`;
- `programs/iat_b3_reference/reward-persistence-checkpoint.mjs`;
- `programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs`;
- `programs/iat_b3_reference/reward-consumer-gate.mjs`;
- `programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs`;
- `programs/iat_b3_reference/reward-external-rollback-anchor.mjs`;
- `programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs`;
- `programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs`.

The privacy-vault external rollback-anchor prerequisite is included only
because it is a reviewed static consumer of the generic provider-envelope
verifier. Its exact path, complete source digest, single provider-module import
marker, and verifier entry-point occurrences are pinned here. This does not
make it a reward consumer, expand the reward runtime boundary, or promote any
provider, rollback, runtime, activation, or Mainnet truth claim.

The host-only authenticated recovery runtime is also pinned by exact path and
complete source digest. The static inventory confines its reviewed generic
provider-state, recovery lifecycle, branded SQLite, and external-anchor imports
and direct calls to that one source. The runtime module itself has no reviewed deployable importer, so a
new static app, worker, or bootstrap import fails until a separate review
updates the ledger. This composition remains host-only and does not promote the
inventory's exhaustive-path, dynamic-dispatch, reflective-dispatch, runtime
confinement, provider, rollback, activation, or Mainnet facts.

The static inventory pins the complete SHA-256 of each ledger source and exact per-path
occurrence counts for every raw adapter symbol, mutation/factory entry point,
permit/cursor/anchor/composed-runtime entry point, guarded-module import edge,
and private CAS/cursor/materialized-state/anchor SQLite table-name family. A
conservative JavaScript/TypeScript lexical pass decodes every static string
literal and escaped IdentifierName/property token, and folds directly
concatenated static string literals. A guarded path or factory name encoded by
splitting literals or by a Unicode escape therefore fails closed instead of
evading the raw count. Every statically visible signed-anchor-to-consumer token
is confined to the exact hashed composition module. The other literal
non-adapter checkpoint imports are the two read-only
provider-readiness validators:
`scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs` and
`scripts/validate-iat-b3-x-social-evidence-provider-readiness.mjs`. No app,
worker, or production bootstrap contains a statically recognized import,
factory call, or operation call. That is not proof that none can construct or
invoke the same operation through computed dispatch. A new raw occurrence, an
alias that retains the guarded token, a direct static-literal split, direct
table access, critical-source change, missing critical path, or source symlink
fails closed until the static inventory and its review are explicitly updated.

This is a static source-snapshot assertion, not an exhaustive deployable-path
inventory or runtime confinement. Array joins, character-code construction,
caller-supplied variables, optional or parenthesized computed members,
two-step function extraction, and `Reflect.get(...).call(...)` can construct
and invoke the guarded operation without a static marker. Those exact hostile
forms are regression-tested as accepted-but-HOLD limitations. The result
therefore reports `staticSensitiveSourceMarkerLocationsMatched: true` while
fixing `unlistedSensitiveSourceMarkerRejected`,
`deployableRewardConsumerPathsInventoried`,
`dynamicComputedDispatchRejected`, and `reflectiveDispatchRejected` to false.
It also cannot prove that a built artifact matches the scanned source, that a
caller did not retain the underlying store, or that an inventory update
received independent review.
It therefore keeps runtime bypass prevention, provider authentication,
rollback protection, materialized projection state, built-artifact parity,
external effects, activation, and Mainnet false or `HOLD`.

[`reward-guarded-build-provenance.mjs`](../../programs/iat_b3_reference/reward-guarded-build-provenance.mjs)
adds a process-observed fresh-build recipe and receipt boundary. Recipe
creation freezes an enumerated source-set digest, guarded-surface digest,
absolute executable and executable SHA-256, exact argument vector, repository-
relative working directory, explicit secret-name-rejecting environment, Node
version/platform/architecture, timeout, and an ordered configuration-file
path/length/digest ledger. Recipes are process-branded; a serialized or caller-
authored lookalike cannot be executed.

Execution requires the artifact directory not to exist before the child
process starts. It re-enumerates source and configuration before execution,
runs the exact executable without a shell or inherited environment, requires a
zero exit and newly created nonempty artifact directory, re-enumerates source
and configuration after execution, and then runs the branded full artifact
inventory. A receipt binds the recipe, artifact-set and forbidden-marker-set
digests, file/byte counts, exit status, and stdout/stderr lengths and digests.
Existing `dist` is deliberately stale input to this boundary and must be
removed or replaced outside this non-destructive module before a fresh recipe
can run.

The receipt proves a process-observed stable-source-to-fresh-artifact binding
for the exact command. It does not prove that an unreviewed command semantically
built rather than copied bytes, that a second build reproduces the result, or
that the packaged runtime is confined. It therefore keeps
`artifactBuiltFromBoundSourceVerified`, reproducibility, runtime confinement,
provider authentication, rollback protection, materialized projection state,
independent review, external effects, activation, and Mainnet false or `HOLD`.

[`reward-guarded-build-reproducibility.mjs`](../../programs/iat_b3_reference/reward-guarded-build-reproducibility.mjs)
adds a dual-fresh-build byte-equality receipt. It accepts only two distinct
process-branded provenance receipt objects from different observed child-
process executions against the same source root. A serialized clone, repeated
use of one receipt, or a valid receipt from a different recipe or source root
is rejected.

Before comparison, the gate re-enumerates the current source, configuration
files, executable digest, and Node version/platform/architecture. Both
receipts must bind the exact same recipe, configuration ledger, toolchain,
guarded surface, forbidden-marker set, artifact file count, artifact byte
count, and artifact-set digest. A successful comparison therefore proves two
independent fresh executions produced the same complete artifact byte ledger
under one still-current recipe.

This remains a narrow two-run equality fact. It does not prove semantic build
provenance, independently reviewed recipe correctness, cross-host or clean-room
reproduction, runtime confinement, or future determinism. The comparison keeps
`semanticBuildProvenanceVerified`, `artifactBuiltFromBoundSourceVerified`,
general `reproducibleBuildVerified`, runtime confinement, provider
authentication, rollback protection, materialized projection state,
independent review, external effects, activation, and Mainnet false or `HOLD`.

[`reward-guarded-artifact-inventory.mjs`](../../programs/iat_b3_reference/reward-guarded-artifact-inventory.mjs)
adds the next negative-packaging prerequisite. It accepts only a process-
branded, filesystem-enumerated source-inventory result, recursively inventories
every artifact file without extension or media exclusions, rejects symlinks,
and binds each exact relative path, byte length, and SHA-256 into one artifact-
set digest. Every byte -- including opaque binaries and source maps -- is
searched for the frozen reward adapter symbols, mutators, factories, module
paths, private SQLite table families, schemas, and status canaries. Any hit,
duplicate/escaping path, decorated buffer, forged source inventory, or empty
artifact fails closed.

A clean artifact result proves only that the inventoried byte set contains no
recognized guarded-reward runtime surface. Recording the current source-set
and guarded-surface digests beside an artifact is not evidence that the build
was produced from that source. The artifact record therefore keeps build-
source parity, reproducibility, runtime confinement, provider authentication,
rollback protection, materialized projection state, independent review,
external effects, activation, and Mainnet false or `HOLD`.

## Exact admission order

The exported permit constructor performs these checks in order:

1. validate the current canonical Daily-Law reference state before reading any
   store, checkpoint, consumer, or target-commit input;
2. validate the durable store's persistence identity and complete CAS snapshot;
3. validate the external checkpoint chain and require the checkpoint to equal
   the local head exactly — a retained ancestor is not sufficient;
4. bind one exact target sequence and commit digest retained by that anchored
   history;
5. validate the operation-specific proof/consumption or Premium-upgrade
   evidence bound to that commit;
6. decode every allocator receipt and independently require each admitted
   reservation's three lane amounts to sum to its complete obligation, while
   every null outcome has a zero lane plan;
7. issue a process-local branded permit for a local projection only.

The permit binds the persistence identity, external checkpoint, target commit,
source Daily-Law reference, current consumer Daily-Law reference, proof digest,
consumer ID, and exact reservation plan. A serialized or caller-authored object
does not carry the private process brand and is rejected.

## Preserved reward laws

- allocation order remains CCC Agent, CCC Associate, standard-10% and X
  campaigns, authorized weekly faction manifest, then core;
- admitted reservation plans bind one complete obligation and never project a
  partial reservation; this gate does not execute or verify payment;
- treasury, ecosystem, then liquidity remains the only lane order;
- the first unfundable obligation stops peers and lower priorities from
  leapfrogging;
- non-Premium X rewards remain the 10% tranche, and a later accepted Premium
  proof can create only the separately ordered 90% upgrade tranche;
- Daily Law is checked before every state-changing reference path;
- the original CAS commit and allocator receipt lineage are retained rather
  than replaced by a consumer-selected amount or disposition.

## Deliberate HOLD boundary

This module authorizes no token transfer, queue publish, webhook, RPC write,
payment, claim, cleanup, or on-chain reservation. Requests for an
`EXTERNAL_EFFECT` permit fail with `REWARD_CONSUMER_EXTERNAL_EFFECTS_HOLD`.
Every permit reports:

- `runtimeAuthenticationVerified: false`;
- `rollbackProtectionVerified: false`;
- `durableConsumerCursorVerified: false`;
- `externalSideEffectsAuthorized: false`;
- `activationReady: false`;
- `mainnetStatus: "HOLD"`.

The regression suite also freezes the limitations instead of hiding them. An
exact byte-for-byte caller copy of a structurally valid checkpoint is
indistinguishable from an authenticated provider read to this host reference;
it can produce the same local permit repeatedly. A retained but stale ancestor
is rejected when the local CAS has advanced, but the module cannot prove that a
provider response itself is fresh, authentic, monotonic outside the supplied
chain, or protected from rollback. The permit alone remains repeatable; the
separate SQLite cursor rejects a repeated branded permit after durable commit,
and atomically retains the local projection event that a materializer would
consume, but deliberately does not claim an exactly-once materialized
projection or external-effect guarantee. These are limitation tests, not mock
authentication.

Production completion still requires a reviewed provider integration, an
authenticated read/write boundary, a production-integrated cursor plus
same-transaction projection/outbox effect, cross-system idempotency and
uncertain-result recovery, an independent cursor rollback anchor, complete
downstream consumer inventory, final-artifact runtime confinement, exact
production identities, and adversarial Devnet evidence. The composition
reference must not be wired into the app, worker, economic program, Devnet
runner, or release switch as if those gates were complete.

Focused write-gate adversaries are in
`tests/iat-b3-reward-checkpoint-gated-cas.test.mjs`; they cover both mutation
paths, stale-head denial without mutation, exact reconciliation, missing and
forked checkpoint rejection, copied-checkpoint non-authentication, and
Daily-Law-first failure precedence.

Focused durable-cursor adversaries are in
`tests/iat-b3-reward-consumer-cursor-sqlite.test.mjs`; they cover contiguous
multi-consumer advance, reopen, replay and skip denial, copied and substituted
permits, append-only SQL guards for both local tables, schema tamper,
Daily-Law-first denial without mutation, nonempty byte-view commit/reopen/read
isolation, hostile payload/accessor rejection, and transaction rollback after
each cursor/event insert boundary.

Focused materialized-projection adversaries are in
`tests/iat-b3-reward-materialized-projection-sqlite.test.mjs`; they cover exact
commit and reopen, nonempty byte-view clone isolation and replay, full-state
chaining, exact replay idempotency, replay drift, copied permits, skips,
rollback after every cursor/event/state insert boundary, post-commit lost-return
recovery, separate-writer append-only SQL guards including `INSERT OR REPLACE`
with recursive triggers disabled, schema drift, Daily-Law-first denial,
locked-law denial, record tamper, and truth-flag tamper.

Focused source-inventory adversaries are in
`tests/iat-b3-reward-guarded-source-inventory.test.mjs`; they inject aliased
raw mutators, raw adapter-symbol access, permit-only and cursor-only consumers,
unlisted literal provider/anchor/mirror/composed-runtime callers, direct
private-table writes, split or Unicode-escaped static dynamic-import paths,
statically computed factory names, and escaped IdentifierNames, plus source
omission, digest drift, and hostile source descriptors. A separate limitation
matrix preserves accepted array-join, character-code, variable, optional,
parenthesized, two-step, and reflective runtime dispatch while verifying that
all exhaustive-inventory, bypass-prevention, activation, and Mainnet claims
remain false or `HOLD`.
Unrelated source remains allowed without changing the frozen guarded-surface
digest.

Focused signed-anchor composition adversaries are in
`tests/iat-b3-reward-authenticated-consumer-runtime.test.mjs`; they cover the
V1 and V2 exact commit/lost-return paths, V1/V2 byte-view reopen and replay,
V2 empty-runtime truth, distinct materialized-manifest binding, changed-
projection reconciliation denial, Daily-Law-first accessor isolation,
external-effect and namespace denial, signature/request/nonce/checkpoint
substitution, predecessor-state rollback, wrong trust root, runtime-binding
tamper, dependency lookalikes, exact-property adapter clones, bound-method
aliases, transparent/hostile/revoked proxies, prototype lookalikes, accessor
fakes, and hostile input shapes while every external and Mainnet truth flag
remains false or `HOLD`.

Focused artifact-inventory adversaries are in
`tests/iat-b3-reward-guarded-artifact-inventory.test.mjs`; they inject raw
mutators, module paths, schemas, private-table SQL, source-map sources and
contents, opaque binary canaries, duplicate and escaping paths, forged source
inventory records, decorated buffers, and accessors. Harmless artifact drift
changes the exact byte ledger while every non-authorizing flag remains frozen.

Focused build-provenance adversaries are in
`tests/iat-b3-reward-guarded-build-provenance.test.mjs`; they execute a real
child process against an isolated exact source ledger and reject pre-existing
artifacts, source drift before or during the build, configuration and toolchain
drift, forbidden output bytes, nonzero exit, omitted output, forged recipes,
and receipt or truth-flag tamper.

Focused dual-build adversaries are in
`tests/iat-b3-reward-guarded-build-reproducibility.test.mjs`; they reject a
one-byte output change, nondeterministic file cardinality, repeated receipt,
serialized receipt substitution, different recipe, post-build source or
configuration drift, and comparison digest or truth-flag tamper.

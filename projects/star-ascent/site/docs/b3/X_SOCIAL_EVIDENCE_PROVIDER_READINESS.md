# IAT B3 X/social reward evidence provider-readiness packet

Status: **nonactivating structural review-packet contract**

Production packet: `BLOCKED`

Mainnet status: `HOLD`

This slice freezes the inputs and evidence topology that a future production X
identity, tier, and public-action evidence system must present for review. It is
not an X API integration, collector, receipt verifier, wallet verifier, reward
adapter, database migration, runtime gate, allocator, claim service, or transfer
authority. It makes no network request and accepts no provider credential.

The canonical production packet is
`iat-b3-x-social-evidence-provider-readiness.v1.json`. Unknown production facts
are `null`, not invented IDs. The JSON Schema freezes the transport shape. The
semantic validator additionally freezes ordered controls, exact reward facts,
content-addressed evidence descriptors, bounded declared validity, domain separation, and the
nonactivation truth surface.

## What the reference contract preserves

The packet binds the existing held V2 policy without changing its economics:

- an identity is one OAuth-authenticated immutable numeric X user ID plus one
  wallet proven by signature and one country selection;
- the X account is at least 40 full days old, and the exact provider-observed
  `subscription_type` is no more than 24 hours old at the exact reward decision
  acceptance time;
- only `None`, `Basic`, `Premium`, and `PremiumPlus` are admitted. Missing,
  stale, unknown, malformed, or provider-failed observations fail closed;
- X's `verified` boolean is informational only. It never selects eligibility or
  amount;
- known `None` or `Basic` maps to one atomic `X_BASE_10` tranche at 1,000 basis
  points and an unreserved conditional `X_PREMIUM_UPGRADE_90` entitlement at
  9,000 basis points;
- fresh `Premium` or `PremiumPlus` maps to one atomic
  `X_PREMIUM_FULL_100` tranche at 10,000 basis points. Base plus full, partial
  payments, debt, retry, and backfill are forbidden;
- the upgrade requires the same immutable X ID and wallet, an authenticated
  original base-admission receipt, a fresh later Premium observation accepted
  strictly after the original round and before expiry, and the next UTC
  midnight strictly after proof acceptance;
- source kinds remain exactly `GENESIS_AIRDROP` and `X_INTERACTION`; builder
  schema, not a caller, derives source, tranche, amount, class, priority, and
  lineage; and
- a missed exact UTC boundary is terminal null under the existing reward law.

The public-action taxonomy is exactly `original`, `reply`, `quote`, `repost`,
`like`, and `follow`. Raw `retweet` is only an alias and becomes `repost` before
hashing, replay keys, or selection. Originals, replies, quotes, and reposts bind
the provider's canonical numeric post ID, provider `created_at` inside the
closed UTC epoch, the bound actor X ID, and an immutable campaign-target
revision and digest.

Like and follow lookups do not provide a trustworthy occurrence time. They
therefore forbid caller-authored action IDs and timestamps. A future append-only
collector must derive the synthetic ID from action, actor, and canonical target;
record its first observation inside the closed epoch; and bind that observation
to the exact finalized Solana slot used as activity chronology. Cursor gaps,
unlike/unfollow ambiguity, incomplete pages, rate limits, or outages fail closed.

## Identity and Sybil boundary

The one-X/one-wallet rule and permanent non-rebinding tombstones prevent the
same admitted X ID or wallet from being rebound as another reward identity.
They do **not** prove that an X account represents one biological human, that a
person controls only one qualifying pair, or that X identities are expensive.
Neither a structurally complete packet nor any validator result may be marketed
as biological-human uniqueness or strong Sybil resistance.

The production review must reconcile durable non-rebinding with data
minimization, deletion and appeal rights, exact retention windows, and an
independently reviewed pseudonymization and legal-basis policy. Retaining raw
personal data forever is not implied by the tombstone invariant.

## Required packet groups

Seven subject groups bind the review:

1. the exact identity-freeze, external-checkpoint, deployment, persistence,
   reward-policy, ledger, engine, capacity, Daily Law, action, and source-lineage
   subject;
2. the X provider legal/service/project/application/API version, endpoints,
   least-scope OAuth policy, terms, rate limits, pagination, and tier policy;
3. the wallet challenge and verifier, binding and tombstone stores, country and
   age evidence, and the narrow identity claim;
4. the collector, campaign-target registry, finalized-slot authority,
   completeness policy, replay store, and regional policy;
5. the domain-separated receipt format, signature algorithm, trust root, key
   registry, active key, rotation, revocation, compromise cutoff, and anti-replay
   policy, including monotonic receipt sequence and same-sequence fork rejection;
6. privacy, X terms, field inventory, retention, erasure and appeal, tombstone
   pseudonymization, and incident response; and
7. ten distinct X-provider, collector-runtime, finalized-slot, local-persistence,
   external-checkpoint, administration, credential-custody, backup, independent-
   observer, and independent-reviewer failure domains.

The 17 ordered control packets cover OAuth and account age; wallet uniqueness
and tombstones; tier observation and acceptance time; exact 10/90/100 and
upgrade rules; the six actions and retweet normalization; post evidence;
like/follow first-observed finality; campaign targets; collector completeness
and replay; the complete Genesis first-1,000 registry and legacy reconciliation;
authenticated receipts and key lifecycle; outage and uncertain response;
privacy and retention; backup/restore/DR and rollback detection; Daily-Law-first
gating; source/allocator/persistence lineage; and independent audit.

Every completed group or control requires a unique content-addressed evidence
artifact. A second domain-separated descriptor digest covers the artifact,
exact full subject and section policy digests, environment, declared observer
and reviewer identities plus their exact distinct failure domains, identity-to-
domain binding digests, and validity metadata. The interval is half-open, may
not exceed the externally pinned 30-day maximum, and is evaluated against an
explicit caller-supplied `evaluationUnixSeconds`. Mutating any covered metadata
without replacing the descriptor digest fails. This proves only internal
descriptor consistency; it does not turn declared times, identities, domains,
or artifacts into verified real-world freshness or independence.

## Daily Law and consumer gating

A future evidence writer or write preparer must check the immutable IAT-wide
Daily Law before reading provider, store, or caller-controlled reward data. A
locked or unfinalized state cannot advance a collector cursor, receipt,
tombstone, tier observation, candidate, entitlement, allocator record, or CAS
head.

Unauthenticated, incomplete, unanchored, DB-ahead, or provider-outage state must
block the next local reward write and every Genesis, daily, upgrade, allocator,
CAS, claim, publication, and downstream consumer. The packet records this as a
required review claim only. No such runtime gate is installed by this slice.
Every accepted evidence receipt must bind the exact local CAS head, and the
external checkpoint may advance only through the next retained local commit;
skipped or forked checkpoint ancestry fails closed.

## Exact truth surface

`xSocialEvidenceReviewPacketComplete` means only that the selected packet is
structurally complete and its referenced evidence descriptors are internally
consistent, content-addressed, and inside their bounded declared validity
interval at the caller-supplied evaluation time.
`productionXSocialEvidenceReviewPacketComplete` additionally requires the
`PRODUCTION` profile. Neither result performs a provider request, verifies an
artifact's real-world truth, verifies a signature, proves collector
completeness, or authorizes a consumer.

Even for a structurally complete production packet, the validator permanently
returns:

- `certifiesProviderOperationalTruth: false`;
- `certifiesOneBiologicalHumanPerXAccount: false`;
- provider-evidence, collector-completeness, wallet-binding, and allocator-
  lineage authentication flags `false`;
- external monotonicity, rollback protection, and runtime consumer gating
  `false`;
- `activationReady: false`;
- `mainnetOrReleaseReady: false`; and
- `mainnetStatus: "HOLD"`.

There is intentionally no generic `providerReadinessReady`, `providerVerified`,
`productionReady`, or `mainnetReady` property.

`TEST_FIXTURE` can exercise a complete packet only with explicit
`allowTestFixture: true` and an in-window evaluation time. Production rejects
known fixture subject values, provider and resource IDs, trust material,
failure domains, observer and reviewer identities, evidence hashes, and derived
subject or policy digests recursively, even if the fixture allow flag is set.
Obvious placeholder, fake, example, test, local, repeated-character, URL-shaped,
uppercase-digest, and repeated-nibble values fail closed. Plausible invented
production identifiers remain impossible to authenticate offline, which is why
all operational truth flags remain false.

## Legacy path and remaining blockers

The existing `/api/x/callback` route and legacy binding tables remain the
retained Premium-only V1 HOLD path. They reject `None` and `Basic` and directly
reserve legacy Genesis state; they must not be relabeled as the V2 10%/90%
adapter. This slice does not import the readiness validator into that route or
modify its database.

Production remains blocked on frozen provider and deployment identities; an
accepted signed receipt and trust/key lifecycle; complete six-action collection
and campaign targets; authenticated clocks and finalized-slot chronology; tier
freshness at exact decision time; a Genesis migration decision; complete
cross-class due-set and allocator lineage; durable receipt and CAS persistence;
external rollback protection; Daily-Law-first runtime and consumer gates;
privacy/terms/retention review; and outage, backup, restore, and disaster-
recovery evidence.

Only after those facts are frozen and independently reviewed should a separate
slice specify a receipt codec or executable adapter. This packet does not choose
a signature scheme, production ID, provider, authority, secret, endpoint, or
Genesis migration rule on their behalf.

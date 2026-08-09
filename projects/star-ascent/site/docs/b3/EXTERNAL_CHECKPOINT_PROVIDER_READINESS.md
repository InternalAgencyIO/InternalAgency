# External checkpoint provider-readiness review packet

Status: `BLOCKED`

Contract status: `NON_ACTIVATING_PROVIDER_READINESS_REVIEW_PACKET`

Mainnet status: `HOLD`

Runtime authentication verified: `false`

External monotonicity verified: `false`

Rollback protection verified: `false`

Activation ready: `false`

The canonical production review packet is
[`iat-b3-external-checkpoint-provider-readiness.v1.json`](iat-b3-external-checkpoint-provider-readiness.v1.json).
Its strict shape is fixed by
[`iat-b3-external-checkpoint-provider-readiness.v1.schema.json`](iat-b3-external-checkpoint-provider-readiness.v1.schema.json),
and the stricter offline semantic audit is
[`scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs`](../../scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs).

This is a provider-selection and independent-review input contract. It is not a
provider integration, provider attestation verifier, runtime gate, credential
loader, network client, Solana contract, Config codec, or authorization to
publish, reserve, claim, transfer, pay, or mint rewards.

## Honest production state

The production packet remains deliberately `BLOCKED`. All unresolved production
identity, provider, tenant, resource, failure-domain, terms, retention, trust
root, key-registry, and evidence facts are `null`; no fake service identifier,
example URL, placeholder digest, or test credential stands in for production.
The current checkpoint deployment domain, namespace, and trust policy are
explicitly reference-only and unfrozen, so the semantic validator forbids them
from being relabeled as completed production subject bindings.

The packet never carries a caller-selected `allow`, `verified`, or activation
boolean. Its four runtime truth flags are permanently `false`, and Mainnet is
permanently `HOLD`, including for a structurally complete fixture or future
production review packet.

## Exact required packets

The subject packet binds one exact production identity-freeze artifact,
persistence identity, deployment domain, adapter schema/version, SQLite schema
manifest, revision-zero entity set, external namespace, and trust policy.
Provider binding then fixes the legal entity, service product, tenant, resource,
region policy, terms and retention digests, authenticated receipt format, trust
root, and key-registry resource.

The local database, provider write plane, provider administration, credential
custody, and backup custody must have five globally distinct identifiers. They
must also be distinct from the provider tenant, resource, receipt registry, and
independent observer. This is a required separation contract, not an assertion
that any current system satisfies it.

Twelve ordered control packets are mandatory:

1. single-copy linearizable readback and exact revision-plus-digest CAS,
   including concurrent-writer and stale-CAS evidence;
2. a versioned domain-separated authenticated receipt that binds subject,
   request, checkpoint, and response, with anti-replay, bounded key-rotation
   overlap, revocation, compromise cutoff, and fail-closed key handling;
3. nondecreasing sequence, same-sequence fork rejection, ancestry rejection,
   and restart-persistent monotonic state;
4. fail-closed outage/timeout behavior, consistent recovery, and contracted
   retention, RTO, and RPO;
5. detection of old sink snapshots, sink restore, control-plane rollback, and a
   pre/post-state-bound rollback drill;
6. immutable Daily Law validation before store or provider access and exact
   production persistence-identity plus local-head binding;
7. Genesis-only first anchoring and exactly one retained CAS commit per
   checkpoint, rejecting skip and predecessor splice;
8. blocking the next and every subsequent local CAS write and every downstream
   reward consumer while the database is ahead, including provider outage;
9. lost-response recovery only by exact readback, with alternate state and stale
   retry rejection and no local mutation;
10. application-runtime, read, write, admin, credential, and backup authority
    isolation with managed custody, rotation, and emergency revocation;
11. closed-database and provider backup-API restore drills, provider-outage
    recovery, sink-rollback detection without external rewind, and incident/DR
    evidence bound to the exact subject; and
12. independent security, legal, retention, operations, and DR review with
    reproducible evidence digests and reviewer separation of duties.

Every completed packet must reference a unique lowercase SHA-256 evidence
artifact. Its evidence descriptor binds the exact subject digest, the exact
section/control/policy digest, a canonical independent observer identity and
identity digest, the matching environment, and a bounded validity interval.
Validation of any completed packet requires an explicit caller-supplied
`evaluationUnixSeconds`; manifest timestamps cannot self-authorize freshness.

## Narrow result surface

`providerReviewPacketComplete` means only that the selected manifest is
structurally complete, semantically consistent, content-addressed, and within
its declared evidence interval. `productionReviewPacketComplete` additionally
requires the `PRODUCTION` profile. Neither field proves that a provider told the
truth, that evidence is authentic, that the service is currently available, or
that runtime enforcement exists.

The validator therefore also returns these immutable negative results:

- `certifiesProviderOperationalTruth: false`;
- `mainnetOrReleaseReady: false`;
- `runtimeAuthenticationVerified: false`;
- `externalMonotonicityVerified: false`;
- `rollbackProtectionVerified: false`;
- `activationReady: false`; and
- `mainnetStatus: "HOLD"`.

It intentionally exposes no `providerReadinessReady`, `providerVerified`,
`productionProviderVerified`, or generic `productionReady` field.

## Fixture and relabel protection

The focused suite can construct one conspicuous `TEST_FIXTURE` packet. It passes
only with `allowTestFixture: true` and an explicit in-window evaluation time.
Fixture provider/resource/failure-domain IDs, subject and trust-root digests,
observer identities, policy bindings, evidence artifacts, and DR evidence are
known test values. A `PRODUCTION` profile containing any of them fails even when
the caller supplies `allowTestFixture` or invented allow-like options. Missing,
extra, hidden, symbol, accessor, sparse, cyclic, null-prototype, and
custom-prototype data also fail closed without invoking accessors. Obvious
fixture/fake/mock/sample/synthetic identifiers, low-entropy repeated-character
identifiers, and repeated-nibble digest placeholders are rejected. Plausible
but invented provider identifiers or evidence digests cannot be disproved by an
offline structural validator; independent operational verification remains
mandatory.

## Offline use

Audit the current canonical production packet:

```text
node scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs
```

It prints an internally valid but blocked result and exits with status `2`.
That is intentional. A future packet evaluation must also supply an explicit
time:

```text
node scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs --manifest <review-packet.json> --evaluation-unix-seconds <u64>
```

The validator performs no network call and consumes no provider credential. A
structurally complete packet remains only a prerequisite for separate provider
verification, runtime implementation, independent sign-off, and Mainnet/release
gates.

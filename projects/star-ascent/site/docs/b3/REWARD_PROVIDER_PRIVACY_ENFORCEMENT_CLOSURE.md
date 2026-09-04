# Reward, provider, and Privacy Vault enforcement closure

Status: **HOLD**. This is a nonactivating, source-bound current-truth packet. It
does not authorize Devnet writes, reward publication, Privacy Vault execution,
deployment, funding, release, or Mainnet execution.

Gate 8 is the unsatisfied
`SOURCE_BOUND_AUTOMATED_GATE_8_DIRECT_EVIDENCE_PACKET` predicate. It may close
only from exact, fresh, source-bound automated direct evidence. It requires no
human reviewer, separate approver, or human observer. Physical confirmation on
a Trezor Model T is the sole human gate, and only when an actual cryptographic
signature is required. This packet supplies neither Gate-8 completion evidence
nor a signature or release authorization.

The machine-readable packet is
[`iat-b3-reward-provider-privacy-enforcement-closure.v1.json`](./iat-b3-reward-provider-privacy-enforcement-closure.v1.json).
The validator is
[`validate-iat-b3-reward-provider-privacy-enforcement-closure.mjs`](../../scripts/validate-iat-b3-reward-provider-privacy-enforcement-closure.mjs).

## Exact current conclusion

The V2 parity packet retains 53 feature rows with zero authorized cuts. This
closure selects the exact 12 rows whose enforcement depends directly on the
reward, X/provider, or optional Privacy Vault boundaries:

`3, 7, 8, 9, 10, 31, 32, 33, 49, 51, 52, 53`.

None of those 12 rows currently has production runtime-authenticated
enforcement. Reference mechanics are not counted as production integration,
structural provider packets are not counted as provider truth, local D1 batch
atomicity is not counted as rollback protection, and an unsigned account-local
instruction builder is not counted as a complete Privacy Vault lifecycle.

The current fail-closed facts are:

- reward publication is `false` in the exact bound V2 policy;
- server signing and automatic broadcast are `false`;
- the legacy V1 manifest publisher rejects the current V2 policy;
- both required production-provider packets say
  `providerIntegrationPresent=false` and keep their operational controls
  `BLOCKED` with null evidence;
- the native privacy plan is unsigned and performs no RPC, CPI, submission, or
  chain mutation; Devnet, activation, release, and Mainnet flags remain false;
- the provider-envelope, reward-consumer, and privacy-recovery implementations
  under `programs/iat_b3_reference` are reference mechanics and preserve false
  production/activation truth.

Those facts prevent payout or Privacy Vault activation from this slice. The X
callback runtime write surface is now also source-bound disabled in the shipped
route, but that does not promote any retained feature to runtime-authenticated.

## Closed P0 runtime exposure

The legacy callback previously called `env.DB.batch` with
`NODE_ACTIVATION_SQL` and `GENESIS_SLOT_RESERVATION_SQL`, accepting only
`Premium` and `PremiumPlus`. That write path has been removed from the shipped
route and handler.

The replacement has two layers:

- `retained-v2-runtime-boundary.mjs` preserves exact known
  `None`/`Basic`/`Premium`/`PremiumPlus` admission and atomic
  `X_BASE_10`/`X_PREMIUM_UPGRADE_90`/`X_PREMIUM_FULL_100` planning. It can mint
  only an in-memory, one-shot mutation capability after four injected trusted
  verifiers cross-bind X provider evidence, external checkpoint and rollback,
  Daily Law authorization, every-consumer gating, the exact local head, and the
  exact write adapter. Missing, forged, stale, mismatched, or replayed evidence
  returns HOLD. A capability cannot be caller-forged or reused.
- `retained-v2-callback-handler.mjs` performs no mutation directly. It invokes
  a supplied exact write adapter only through that one-shot capability and
  requires a cross-bound atomic mutation receipt. An ambiguous failure consumes
  the capability and cannot be automatically replayed.
- `route.ts` injects only the Cloudflare environment. It deliberately injects
  no runtime verifiers, evidence resolver, or write adapter. It therefore
  returns `retained-v2-runtime-hold` before any D1 or X-network access.

The closure now records `RETAINED_V2_X_CALLBACK_WRITE_BOUNDARY` as
`SOURCE_BOUND_DISABLED_PENDING_UNAVAILABLE_RUNTIME_PREREQUISITES`, with zero
current unresolved runtime exposures from this route. Exact route, handler, and
boundary hashes and byte lengths are bound by the packet.

This closes the unsafe runtime exposure, not the feature-completion gate. All 12
scoped rows remain `runtimeAuthenticated=false`: no production provider,
durable replay/checkpoint/rollback implementation, source-bound automatically
verified write adapter,
collector-completeness evidence, or full Privacy Vault lifecycle is wired.

## Required production closure

GO requires all of the following in the same final source/artifact lineage:

1. freeze production X and checkpoint provider identities, key registries,
   trust roots, receipt domains, retention terms, endpoints, and credentials,
   with exact source-bound automated direct observations;
2. authenticate every provider response with the source-bound automatically
   verified envelope and durable
   anti-replay state, including rotation, revocation, compromise cutoff,
   request/response binding, contiguous sequence, and predecessor binding;
3. install the external checkpoint after each retained local CAS commit and
   prove monotonicity, readback, uncertain-response reconciliation, provider
   outage behavior, restore detection, and source-bound automated rollback evidence;
4. gate every reward writer and consumer—including candidate admission,
   allocator, materialized view, publisher, claim path, entitlement upgrade,
   and any transfer executor—on exact Daily Law, local head, external anchor,
   and authenticated provider evidence;
5. keep the legacy callback absent from the exact final artifact and, before
   enabling a write adapter, bind final-artifact tests for the retained
   `None`/`Basic`/`Premium`/`PremiumPlus` semantics with no parallel path;
6. complete the Privacy Vault configure, deposit, apply-pending, confidential
   transfer, withdraw, empty, and close lifecycle with authenticated Solana
   observations, runtime Daily Law/hook accounts, proof-context lifecycle,
   durable journal/recovery/rollback state, secure keystore and recovery UX,
   final-binary Devnet evidence, and source-bound automated privacy/security
   direct evidence;
7. replace every relevant release-graph `BLOCKED` node with exact source-bound
   automated direct evidence and obtain explicit release authorization. Any
   actual cryptographic signature still requires physical confirmation on the
   Trezor Model T.

## Validator behavior

Run from `projects/star-ascent/site`:

```text
node scripts/validate-iat-b3-reward-provider-privacy-enforcement-closure.mjs
```

The command is offline and read-only. It binds exact SHA-256 and byte lengths
for the retained parity packet, release graph, reward policy/publisher, legacy X
route and binding policy, both provider packets, privacy native plan, and the
relevant reference mechanics. It emits JSON and exits:

- `1` when the packet or any bound source truth is invalid or has drifted;
- `2` for today's structurally valid `HOLD` state.

There is no successful activation exit in this version. A future production
closure must introduce exact source-bound automatically verified affirmative
runtime evidence; changing a false flag or label cannot promote this packet.

Focused regression coverage is in
[`iat-b3-reward-provider-privacy-enforcement-closure.test.mjs`](../../tests/iat-b3-reward-provider-privacy-enforcement-closure.test.mjs).

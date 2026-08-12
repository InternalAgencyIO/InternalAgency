# IAT B3 release dependency graph contract

Status: **NONACTIVATING / HOLD**

This reference is the canonical machine-enforced inventory and dependency graph for the current IAT B3 review work. It removes ambiguity between fragmented readiness documents; it does not convert those documents into production truth.

The canonical production manifest is structurally valid but blocked:

- 28 exact ordered nodes;
- 134 exact ordered prerequisite edges;
- all nodes are `REQUIRED`;
- Privacy Vault, all 50 locales, and required media cannot be marked optional or `N/A`;
- 27 nonterminal nodes feed the terminal node directly;
- all 28 nodes and the terminal predicate are `BLOCKED`;
- every operational, authentication, rollback, activation, release, and Mainnet flag is immutable `false` / `HOLD`.

The files are:

- `iat-b3-release-dependency-graph.v1.json`: canonical production BLOCKED packet;
- `iat-b3-release-dependency-graph.v1.schema.json`: strict JSON shape, order, count, constants, and false/HOLD surface;
- `scripts/validate-iat-b3-release-dependency-graph.mjs`: semantic, artifact, DAG, and closure validator;
- `tests/iat-b3-release-dependency-graph.test.mjs`: focused adversarial contract tests.

## Truth boundary

`dependencyInventoryComplete` and `dependencyGraphValid` say only that the canonical inventory, graph, policies, and committed reference bindings are internally consistent. `dependencyReviewPacketComplete` says only that all node-specific structural predicates passed. `productionDependencyReviewPacketComplete` is the same narrow structural statement for a production-profile packet.

None of those fields certifies:

- provider, deployment, receipt, reviewer, or evidence truth;
- runtime authentication, authorization, atomicity, or consumer gating;
- external monotonicity or rollback protection;
- an authenticated owner cut;
- transaction signing, deployment authority, release authorization, or Mainnet execution.

There is deliberately no generic `ready`, `GO`, `productionReady`, or `mainnetReady` result. The result always retains `externalTruthVerified=false`, `runtimeAuthenticationVerified=false`, `providerEvidenceVerified=false`, `rollbackProtectionVerified=false`, `runtimeEnforcementVerified=false`, `activationReady=false`, `releaseAuthorizationVerified=false`, `mainnetExecutionAuthorized=false`, and `mainnetStatus=HOLD`.

The ordinary `valid` field is parse/contract validity only. It is never a node completion predicate.

## Exact dependency inventory

The notation `node <- prerequisites` means the node cannot complete until every listed prerequisite completes.

1. `LIVE_ESTATE_CANONICAL_MINT_DECISION <- []`
2. `V2_FEATURE_PARITY <- []`
3. `TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY <- []`
4. `CORE_CUSTODY_POLICY_ADAPTER <- [V2_FEATURE_PARITY]`
5. `FACTION_ECONOMICS_FUNDING <- [V2_FEATURE_PARITY]`
6. `CONFIG_GENESIS_PHASE_CODEC <- [V2_FEATURE_PARITY, CORE_CUSTODY_POLICY_ADAPTER, FACTION_ECONOMICS_FUNDING]`
7. `GENESIS_ALLOCATIONS_CONSERVATION <- [LIVE_ESTATE_CANONICAL_MINT_DECISION, V2_FEATURE_PARITY, CORE_CUSTODY_POLICY_ADAPTER, FACTION_ECONOMICS_FUNDING, CONFIG_GENESIS_PHASE_CODEC]`
8. `PRODUCTION_IDENTITY_INPUT_FREEZE <- [LIVE_ESTATE_CANONICAL_MINT_DECISION, TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, CORE_CUSTODY_POLICY_ADAPTER, FACTION_ECONOMICS_FUNDING, CONFIG_GENESIS_PHASE_CODEC, GENESIS_ALLOCATIONS_CONSERVATION]`
9. `DAILY_LAW_NATIVE_HOOK <- [TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, PRODUCTION_IDENTITY_INPUT_FREEZE]`
10. `COMBINED_STAKE_INGRESS_HOOK <- [TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, CONFIG_GENESIS_PHASE_CODEC, PRODUCTION_IDENTITY_INPUT_FREEZE, DAILY_LAW_NATIVE_HOOK]`
11. `REWARD_WATERFALL_PROOFS <- [V2_FEATURE_PARITY, CORE_CUSTODY_POLICY_ADAPTER, FACTION_ECONOMICS_FUNDING]`
12. `DURABLE_REWARD_CAS <- [DAILY_LAW_NATIVE_HOOK, REWARD_WATERFALL_PROOFS]`
13. `EXTERNAL_CHECKPOINT_PROVIDER <- [PRODUCTION_IDENTITY_INPUT_FREEZE, DURABLE_REWARD_CAS]`
14. `X_SOCIAL_EVIDENCE_PROVIDER <- [PRODUCTION_IDENTITY_INPUT_FREEZE, REWARD_WATERFALL_PROOFS, DURABLE_REWARD_CAS, EXTERNAL_CHECKPOINT_PROVIDER]`
15. `ECONOMY_ALL_15_WRITE_ADAPTER <- [V2_FEATURE_PARITY, TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, CORE_CUSTODY_POLICY_ADAPTER, FACTION_ECONOMICS_FUNDING, CONFIG_GENESIS_PHASE_CODEC, GENESIS_ALLOCATIONS_CONSERVATION, PRODUCTION_IDENTITY_INPUT_FREEZE, DAILY_LAW_NATIVE_HOOK, COMBINED_STAKE_INGRESS_HOOK, REWARD_WATERFALL_PROOFS]`
16. `REWARD_LOCAL_WRITE_CONSUMER_GATING <- [PRODUCTION_IDENTITY_INPUT_FREEZE, DAILY_LAW_NATIVE_HOOK, REWARD_WATERFALL_PROOFS, DURABLE_REWARD_CAS, EXTERNAL_CHECKPOINT_PROVIDER, X_SOCIAL_EVIDENCE_PROVIDER, ECONOMY_ALL_15_WRITE_ADAPTER]`
17. `PRIVACY_VAULT_CLIENT <- [V2_FEATURE_PARITY, TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, PRODUCTION_IDENTITY_INPUT_FREEZE, DAILY_LAW_NATIVE_HOOK]`
18. `DEPENDENCY_SECURITY_REMEDIATION <- [V2_FEATURE_PARITY]`
19. `PRODUCTION_BINARY_REPRODUCIBILITY <- [TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, PRODUCTION_IDENTITY_INPUT_FREEZE, DAILY_LAW_NATIVE_HOOK, COMBINED_STAKE_INGRESS_HOOK, ECONOMY_ALL_15_WRITE_ADAPTER, REWARD_LOCAL_WRITE_CONSUMER_GATING, PRIVACY_VAULT_CLIENT, DEPENDENCY_SECURITY_REMEDIATION]`
20. `ADVERSARIAL_DEVNET_REHEARSAL <- [TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, PRODUCTION_BINARY_REPRODUCIBILITY]`
21. `DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE <- [LIVE_ESTATE_CANONICAL_MINT_DECISION, PRODUCTION_IDENTITY_INPUT_FREEZE, PRODUCTION_BINARY_REPRODUCIBILITY, ADVERSARIAL_DEVNET_REHEARSAL, B3_COST_CEREMONY_FUNDING]`
22. `B3_COST_CEREMONY_FUNDING <- [GENESIS_ALLOCATIONS_CONSERVATION, PRODUCTION_IDENTITY_INPUT_FREEZE, PRODUCTION_BINARY_REPRODUCIBILITY]`
23. `LOCALIZATION_EVIDENCE <- [V2_FEATURE_PARITY]`
24. `MEDIA_MASTER_COMPLETENESS <- [V2_FEATURE_PARITY]`
25. `V2_LAUNCH_CEREMONY_BOUNDARY <- [LIVE_ESTATE_CANONICAL_MINT_DECISION, V2_FEATURE_PARITY]`
26. `RELEASE_SURFACE_PUBLIC_CLAIMS <- [LIVE_ESTATE_CANONICAL_MINT_DECISION, V2_FEATURE_PARITY, PRODUCTION_IDENTITY_INPUT_FREEZE, DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE, LOCALIZATION_EVIDENCE, MEDIA_MASTER_COMPLETENESS, V2_LAUNCH_CEREMONY_BOUNDARY]`
27. `INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW <- [TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY, CORE_CUSTODY_POLICY_ADAPTER, FACTION_ECONOMICS_FUNDING, CONFIG_GENESIS_PHASE_CODEC, GENESIS_ALLOCATIONS_CONSERVATION, PRODUCTION_IDENTITY_INPUT_FREEZE, DAILY_LAW_NATIVE_HOOK, COMBINED_STAKE_INGRESS_HOOK, REWARD_WATERFALL_PROOFS, DURABLE_REWARD_CAS, EXTERNAL_CHECKPOINT_PROVIDER, X_SOCIAL_EVIDENCE_PROVIDER, ECONOMY_ALL_15_WRITE_ADAPTER, REWARD_LOCAL_WRITE_CONSUMER_GATING, PRIVACY_VAULT_CLIENT, DEPENDENCY_SECURITY_REMEDIATION, PRODUCTION_BINARY_REPRODUCIBILITY, ADVERSARIAL_DEVNET_REHEARSAL, DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE, B3_COST_CEREMONY_FUNDING, LOCALIZATION_EVIDENCE, MEDIA_MASTER_COMPLETENESS, RELEASE_SURFACE_PUBLIC_CLAIMS]`
28. `TERMINAL_B3_REVIEW_PACKET <- [all ordered nodes 1 through 27]`

The identity split is intentional. `PRODUCTION_IDENTITY_INPUT_FREEZE` validates frozen inputs only. It never stands in for evidence that exact deployed bytes use the intended identities and that deployment authorities were sealed.

## Staged deployment boundary

`DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE` is post-deployment evidence. Therefore this terminal packet is not a pre-execution launch switch. Before an authorized deployment exists, the node remains blocked. A future predeployment authority-plan packet would be a distinct node and cannot be relabeled as actual deployed seal evidence. Even a structurally complete post-deployment review packet would leave all release and execution flags false; a separate authenticated release authority is required outside this reference.

## Completion model

Node status is either `BLOCKED` or `STRUCTURAL_REVIEW_PACKET_COMPLETE`. A complete child with a blocked prerequisite is invalid. Missing, extra, duplicate, reordered, self, unknown, cyclic, or unreachable edges are invalid. The terminal predicate requires every nonterminal node in exact order.

Production completion never follows from a manifest `valid:true`, a successfully parsed file, a passing reference test, or a self-attested evidence hash. The v1 validator recognizes only narrowly named scoped outputs from immutable committed contracts. Currently those include:

- `productionIdentityReady` from the production identity input-freeze validator;
- `productionReviewPacketComplete` from the external-checkpoint review-packet validator;
- `productionXSocialEvidenceReviewPacketComplete` from the X/social review-packet validator;
- the exact 15-handler economic adapter predicate, including the nonblocked native Config codec and all-handler exposure state.

Provider packets require a caller-supplied `evaluationUnixSeconds` so bounded evidence is evaluated at an explicit instant. Omitting it cannot promote a provider node.

All other production predicates remain false in this v1 implementation until a dedicated scoped validator is reviewed and added. Production completion evidence must also bind the exact allowlisted committed contract-artifact SHA-256; an opaque caller-selected evidence hash is insufficient, and nodes with `contractArtifact: null` cannot complete. That deliberate fail-closed limitation means the current production graph cannot complete by attaching generic evidence. A `TEST_FIXTURE` can exercise closure only with `allowTestFixture=true`; fixture completion can never become production completion or change the false/HOLD surface.

V2 evidence establishes retained feature coverage and the fail-closed supersession boundary only. The legacy Original SPL launch ceremony is never a B3 satisfaction path.

## Artifact binding

Only fixed, repository-relative, allowlisted B3 reference artifacts may be bound. Every bound artifact carries its exact SHA-256 and `REFERENCE_CONTRACT_ONLY` scope. During production-profile validation the validator:

1. rejects absolute paths, backslashes, traversal, symlinks, and paths outside the fixed allowlist;
2. rejects dirty or staged content relative to `HEAD`;
3. reads exact committed bytes with `git show HEAD:path`;
4. recomputes SHA-256 and rejects drift;
5. runs only fixed in-process scoped validators—never a validator named by the manifest.

The artifact policy also binds the separately versioned Privacy Vault native
instruction-plan prerequisite packet and its exact source inventory. That
auxiliary binding is fail-closed audit input only: it neither adds a graph node
nor changes the 28-node/134-edge topology, and it cannot promote the blocked
`PRIVACY_VAULT_CLIENT` full-lifecycle predicate.

The unresolved localization and media inputs intentionally have `contractArtifact: null` and remain blocked. The validator does not read or hash the changing site/i18n files. The canonical media blocker retains the exact 14 missing full masters; it is not an accepted failure and cannot be marked `N/A`.

## Canonical input hardening

The semantic validator rejects non-JSON prototypes, symbols, accessors without invoking them, non-enumerable fields, sparse or decorated arrays, shared aliases, cycles, lone Unicode surrogates, nonfinite numbers, unsafe integers, bigint values, missing or extra keys, and decoded duplicate JSON member names. Graph and evidence SHA-256 values are lowercase, domain-separated, canonical JSON digests. Replacing the fixed graph digest with a hash of a caller-edited manifest does not redefine the graph.

## CLI

From `projects/star-ascent/site`:

```text
node scripts/validate-iat-b3-release-dependency-graph.mjs
node scripts/validate-iat-b3-release-dependency-graph.mjs --require-review-packet-complete
node scripts/validate-iat-b3-release-dependency-graph.mjs packet.json --evaluation-unix-seconds 2001000000
```

The first command exits successfully for the valid canonical BLOCKED contract. `--require-review-packet-complete` exits with status 2 until the structural packet completes. `--fixture` is conspicuous test-only authority and never enables production, release, or Mainnet claims.

# Promotions DLC public status

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

Updated: 2026-08-01 00:53 UTC

Public draft PR: https://github.com/InternalAgencyIO/InternalAgency/pull/8

Public branch: `agent/iat-promotions-dlc-draft`

Previously published public increment: `606acfc`

The authoritative current commit is always the head of the public draft PR.
This status file deliberately does not claim a self-referential commit hash.

## Completed

- fixed public product and economic contract;
- architecture, trust-boundary, privacy, and activation plan;
- campaign and nomination state machines;
- threat model and adversarial matrix;
- exact integer accounting policy and validator;
- 28 policy mutation tests;
- standalone, network-free reference engine;
- isolated community promotion-vault funding gate;
- pure-state nomination, cancellation, activation, and settlement operations;
- atomic rollback fault injection after either modeled transfer;
- replay, stable-X-ID, self-referral, triple-deduplication, full-cap, final-slot,
  and permanent-terminal-state tests;
- canonical verifier-attestation envelope with detached-signature boundary;
- 300-second attestation and 600-second wallet-proof freshness limits;
- no raw X user ID, OAuth token, or signing key in the public envelope;
- append-only transparency hash chain and public checkpoints;
- tamper, key/campaign mismatch, truncation, and history-rewrite tests; and
- twelve deterministic randomized state-machine traces;
- independent rejection tests for every proposer and hero node/wallet/X role
  dimension;
- deterministic cancellation-versus-settlement terminal ordering;
- fixed account layouts and eight-instruction proposed binary interface;
- canonical discriminator derivation and fixed little-endian serialization;
- one public byte vector for every proposed instruction;
- a network-free codec and structural interface validator; and
- mutation tests for deployment claims, layout drift, forbidden V2 accounts,
  integer boundaries, ambiguous bytes, weakened atomicity, and terminal guards;
- network-free adapter from encoded instructions to pure state transitions;
- exact verifier-result binding across public key, message, campaign, purpose,
  attestation ID, nonce, timestamps, node, wallet, and X commitment;
- encoded lifecycle coverage for initialization, funding, activation,
  nomination, cancellation, settlement, exhaustion, and surplus finalization;
- adapter rollback proof for policy, attestation, and injected transfer failures;
  and
- a complete 1,000-pair exhaustion run using encoded transitions;
- public-key-only RFC 8032 Ed25519 tests 1 and 2 with their primary source;
- runtime verification without storing or generating any private key;
- rejection of every changed byte across both 64-byte RFC signatures;
- deterministic fuzzing of 2,048 randomly generated fixed-width instructions;
- complete truncation and trailing-byte rejection across every instruction;
- canonical decode/re-encode checks for every single-bit vector mutation; and
- 128 verifier-binding mutations that all preserve byte-identical campaign
  state;
- pure public-key rotation and emergency-disable lifecycle model;
- separately reviewed, replay-resistant rotation scheduling;
- 24-hour minimum public notice and one-hour maximum old/new key overlap;
- explicit activation and retirement finalization with exact time boundaries;
- permanent key-reuse rejection and immutable identity-commitment domain;
- immediate terminal emergency disable with historical verification preserved;
  and
- canonical hash-chained key events and append-only public checkpoints;
- machine-readable verifier-registry amendment against interface v0;
- fixed layouts for registry, public-key record, and review receipt accounts;
- five proposed lifecycle instructions with no money or V2 account capability;
- read-only registry/key validity guards for every attestation consumer;
- deterministic byte vectors for all proposed lifecycle instructions;
- permanent review-receipt and key-record replay barriers; and
- explicit `baseV0Deployable: false` and `amendmentApplied: false` release gates;
- deterministic full-interface composition preview derived from both interface
  sources and both public vector artifacts;
- canonical SHA-256 source bindings and exact recomposition validation;
- removal of the obsolete inline verifier initializer argument;
- read-only registry/key insertion and complete issuance-time guard composition
  across nomination, cancellation, and settlement;
- cross-domain name and discriminator collision rejection;
- stale source, stale vector, deployment-claim, and writable external-account
  drift tests; and
- explicit `deployable: false` and `compositionApplied: false` preview gates;
- deterministic all-thirteen-instruction composed vector artifact;
- explicit removal of the obsolete 32-byte initializer vector payload;
- vector discriminator, length, byte, and round-trip drift validation;
- exact byte offsets and end offsets for all eight proposed account layouts;
- exact data offsets, encoded lengths, and account-meta indices/flags for all
  thirteen proposed instructions;
- canonical layout digests bound to the composed preview and vectors;
- language-neutral u8/u16/u32/u64/i64, bytes, bytes32, and public-key fixtures;
- gap, overlap, final-size, vector-length, meta-order, unsafe-number, scalar-byte,
  and stale-source rejection tests; and
- explicit client-binding-only and undeployable ABI status gates;
- fourteen fixed-width campaign, settlement, terminal, and verifier event
  layouts covering all thirteen composed instructions;
- one deterministic public byte vector for every event;
- fixed event discriminator domain, little-endian codec, and exact round trips;
- success-only emission and transaction-rollback semantics with accounts and
  receipts remaining authoritative;
- exact PairSettled destinations, commitment bindings, 120/60 rewards, receipt,
  sequence, counters, and vault-balance evidence;
- terminal pair-1,000 event without impossible arbitrary-account bulk writes;
- prior/new verifier hash heads bound to registry state;
- no raw X user ID, mutable X handle, secret, or signing material in events;
- exhaustive truncation, trailing-byte, malformed-field, privacy, economics,
  stale-vector, source-drift, and deployment-claim rejection; and
- explicit `eventInterfaceApplied: false` release gate;
- network-free ordered event/account reconciler with no RPC or wallet import;
- machine-readable reconciliation policy bound to the event-interface digest;
- complete campaign-history, funding, activation, cancellation, nomination,
  settlement, exhaustion, and surplus-finalization ordering checks;
- exact receipt/event bijection and full receipt-field comparison;
- campaign counter, reward-total, and promotion-vault snapshot reconciliation;
- explicit isolation of unsolicited vault deposits as non-budget surplus;
- same-transaction pair-1,000 exhaustion and permanent terminal-state proof;
- verifier zero-hash genesis, prior-head continuity, final registry-head, and
  emergency-terminal reconciliation;
- a complete 1,000-pair event/receipt/account reconciliation run; and
- policy, byte, cursor, receipt, counter, vault, terminal, refund, verifier,
  source-drift, and deployment-claim rejection tests;
- deterministic public fixtures for active, cancelled, exhausted,
  surplus-finalized, and verifier-disabled histories;
- two compact commitments over complete 2,006-event, 1,000-receipt histories;
- canonical evidence, record-array, snapshot, and reconciliation-result SHA-256
  digests for every fixture;
- domain-separated ordered record and receipt Merkle roots with fixed odd-node
  and empty-set rules;
- source hashes binding the held policy, event interface, reconciler, and
  deterministic fixture generator;
- no event bytes, account snapshots, receipt bodies, raw X identities,
  handles, signatures, or secrets in the compact public artifact;
- source, scenario, digest, Merkle, result, privacy, and deployment-drift tests;
- strict portable Draft-07 schemas for full evidence inputs and held results;
- closed object shapes, canonical decimal strings, lowercase fixed hex, exact
  status enums, and fixed reward/budget constants;
- explicit result constants preserving account authority and preventing event
  streams from claiming state-change authority;
- deterministic synthetic corpus with two valid evidence envelopes, two held
  results, and nine invalid pointer-based mutations;
- dependency-free local validation of the exact Draft-07 keyword subset used by
  the proposal, without claiming to be a general schema engine;
- structural validation followed by semantic reconciliation for every valid
  evidence example;
- schema source, open-object, economics, type, pattern, enum, required-field,
  extra-field, authority, privacy, and deployment-drift tests.
- deterministic content-addressed inventory of every non-self proposal file;
- normalized UTF-8 content hashes, domain-separated leaf hashes, and one
  deterministic binary Merkle root;
- explicit classification and counts for artifacts, generators, validators,
  tests, and supporting source;
- fail-closed symbolic-link, unknown-type, absolute-path, traversal,
  duplicate-path, malformed-digest, stale-content, stale-role, and stale-root
  guards;
- cross-platform LF/CRLF reproduction without weakening path or content
  commitments;
- an explicit, honest self-reference exclusion instead of an impossible
  recursive self-hash claim;
- no private evidence, identity, OAuth, signature, secret, or signing material
  in the published review inventory; and
- fixed network-free, undeployable, and unapplied manifest status gates.
- every intermediate Merkle level published for precise cross-review
  comparison, not only the final tree root;
- independent zero-dependency Python implementation of filesystem discovery,
  normalization, classification, content hashing, leaf hashing, tree building,
  summary accounting, and HOLD metadata;
- complete Node/Python manifest equality, including the intermediate vectors;
- nonzero independent-verifier failure on stale content or intermediate-node
  mutation; and
- the independent Python verifier itself classified and content-addressed as a
  validator in the review tree.
- deterministic machine-readable independent-review receipt template;
- required future binding to exact Git commit, review-manifest content digest,
  review-tree root, covered-file count, and canonical scope digest;
- fixed review coverage across eight security areas, every manifest entry, and
  every open security-decision disposition;
- explicit production, site, chain-state, wallet/key, DNS/hosting, and Genesis
  release-gate exclusions;
- reviewer-independence contract excluding concurrent author, operator,
  deployer, promotion-vault, and verifier-operator roles;
- review-only approval with zero activation effect and mandatory separate
  activation review;
- external-only Ed25519 attestation slots with no key generation, signing,
  public key, signature, reviewer, decision, target, or timestamp in the held
  template; and
- drift tests for bindings, scope, independence, decision, attestation,
  issuance, deployment, and activation claims.
- exact domain-separated unsigned receipt-message framing;
- fixed repository and PR binding plus exact ordered commit, manifest, tree,
  file-count, scope, reviewer, decision, rationale, findings, timestamp, and
  non-activation fields;
- canonical lowercase fixed-width hex and decimal-string JSON formats with
  fixed little-endian binary integers;
- one deterministic public unsigned message, length, and SHA-256 digest for
  each of the three allowed review-only decisions;
- exact encode/decode round trips with missing, extra, or reordered fields
  rejected;
- independent digest-change proof for every target, scope, reviewer, decision,
  rationale, findings, and timestamp binding;
- malformed format, false independence, unknown decision, activation claim,
  truncation, trailing-byte, magic, and decision-code rejection; and
- no key, signature, secret, raw X identity, handle, wallet capability, or
  cryptographic attestation in the public payload vectors.
- verify-only detached Ed25519 adapter for future externally supplied receipt
  attestations;
- positive verification through the two published RFC 8032 section 7.1 public
  vectors without loading private material;
- explicit proof that unrelated valid RFC signatures fail against all three
  canonical receipt payloads;
- payload-digest comparison before detached-signature verification;
- exact attestation shape, algorithm, public-key, signature, and message-format
  validation with malformed input failing without exceptions;
- changed key, signature, message, digest, invalid payload, and activation
  payload rejection;
- cryptographic verification explicitly separated from review semantics,
  reviewer independence, and activation authority; and
- source-level exclusion of signing, private-key, key-generation, wallet, and
  network capabilities, with no valid review-receipt signature published.
- pure six-gate future receipt-candidate acceptance evaluator;
- exact candidate shape and three-way expected-target/candidate-target/signed-
  payload binding;
- complete coverage of all manifest entries, eight review areas, seven explicit
  exclusions, and nine enumerated open security decisions;
- unique disposition and evidence commitment for every open security decision;
- independent reviewer binding and rejection of every disallowed concurrent
  author, ceremony, deployer, promotion-vault, and verifier role;
- blocking dispositions rejected for review-only approval but preserved for
  request-changes and rejection decisions;
- semantic, cryptographic, and non-activation gates kept separate;
- a fully aligned public candidate that visibly fails only because no external
  review signature exists;
- five additional target, scope, role, blocking, and activation rejection
  vectors; and
- every public result rejected, unissued, incomplete, and non-activating.
- local-file-only reviewer-bundle CLI with separately supplied candidate and
  expected-target inputs;
- deterministic candidate, expected-target, and receipt-template commitments;
- fixed six-row PASS/FAIL gate ordering and explicit failure details;
- distinct exit codes for accepted lint, policy rejection, and malformed input;
- a reproducible human-readable public report showing five gates passing and
  the absent external signature gate failing;
- fail-closed malformed input with no receipt, review, or activation authority;
  and
- source-level exclusion of file writes, signing, key generation, wallet, and
  network capability from the linter.
- three closed portable Draft-07 schemas for reviewer candidate, independently
  supplied expected target, and evaluation-only lint result;
- fixed lowercase commit/hash/signature formats, canonical decimal strings,
  exact review-area/exclusion arrays, and closed nested objects;
- explicit separation of structural validity from target authenticity,
  semantic review acceptance, and cryptographic validity;
- lint-result constants permanently preventing receipt issuance, completed
  review, activation authority, or non-`NONE` activation effects;
- three structurally valid but rejection-only public examples;
- fourteen pointer-based invalid examples isolating closed-object, required,
  type, pattern, enum, scope, HOLD, binding, receipt, and activation guards;
  and
- deterministic schema-source commitments and mutation validation.
- local-read-only candidate and expected-target structural preflight before the
  CLI invokes any semantic gate;
- exact document, JSON Pointer, schema pointer, Draft-07 keyword, and message
  diagnostics for every malformed input;
- distinct exit `3` for structural rejection while preserving exit `2` for
  semantic rejection and exit `1` for usage, file, or JSON failure;
- one valid-structure vector and nine invalid input vectors with deterministic
  preflight results;
- invalid structure permanently stopping semantic evaluation;
- direct programmatic access to the unchanged pure six-gate evaluator; and
- preflight results fixed to no receipt, no completed review, and no activation
  authority or effect.
- CodeQL-safe Markdown diagnostics that escape backslashes before pipe
  characters and normalize embedded line breaks.
- an independent, zero-dependency Python implementation of the fixed
  candidate and expected-target Draft-07 subset;
- exact cross-runtime reproduction of all ten complete preflight result
  objects and normalized Markdown diagnostics;
- independent rejection of a changed published diagnostic with the affected
  scenario named;
- structural-validity exit `0`, structural-rejection exit `3`, and local
  usage/file/encoding/JSON exit `1` without semantic-review execution; and
- source-level exclusion of write, network, signing, wallet, receipt, review-
  completion, and activation capabilities from the Python verifier.
- a verify-only Ed25519 adapter bound to the exact canonical campaign
  attestation message;
- two externally sourced RFC 8032 positive primitive controls with no private
  material copied into the proposal;
- two exact-envelope negative controls proving unrelated valid signatures do
  not authenticate the campaign message;
- eleven rebuilt canonical-field mutations, two cryptographic mutations, and
  four ordered pre-signature guards;
- an explicit machine-readable HOLD because no independently supplied positive
  campaign-envelope signature is published; and
- campaign verification results fixed to no receipt, no completed review, no
  activation authority, and effect `NONE`.
- a closed Draft-07 schema for future externally supplied positive campaign
  vectors, with every nested object fixed against unknown fields;
- a separately supplied expected-target boundary binding campaign, key,
  provenance, review-receipt, availability, and review-completion state;
- a pure local-read-only evaluator with eight ordered structural, provenance,
  privacy, canonical-message, cryptographic, review, and non-authority gates;
- ten deterministic public rejection scenarios covering missing provenance,
  private-material fields, message/source/target drift, fake review, unrelated
  signatures, and forbidden activation claims; and
- an explicit continued HOLD: no valid positive campaign vector or independent
  positive-vector review exists, and the intake issues no receipt or authority.
- an independent zero-dependency Python implementation of the closed intake
  schema, canonical campaign message, fixed eight gates, and non-authority
  result;
- a public-verification-only Ed25519 implementation with both RFC 8032 positive
  controls required before any rejection corpus can pass;
- complete reproduction of all ten Node-published result objects, including
  JSON Pointer diagnostics and cryptographic rejection reasons;
- independent rejection of changed results, candidate drift, released HOLD
  state, and activation claims with distinct verification exit `2`; and
- source-level exclusion of write, network, wallet, signing, key-generation,
  receipt, completed-review, deployment, and activation capability.
- a twenty-case deterministic differential corpus spanning closed structure,
  target shape/binding, private fields, provenance, canonical messages, public
  keys/signatures, cryptographic guards, review binding, and non-authority;
- exact complete-result parity between the Node evaluator and independent
  Python implementation for every mutation;
- a review-complete case that passes its independent-review gate while the
  unrelated signature still fails cryptography and blocks overall acceptance;
- content bindings for base vectors, schema, Node evaluator, and Python
  verifier, with drift rejected in both runtimes; and
- public mutation evidence fixed to no receipt, no completed review, no
  activation authority, and effect `NONE`.
- a seeded 256-case compact mutation corpus spanning ten gate families;
- exact Node/Python replay from fixed seed `49544154`, with no stored full
  candidate/result expansion and no positive signature or review material;
- canonical input, result, and case commitments plus a domain-separated
  ordered SHA-256 Merkle root; and
- changed-case, changed-root, review/cryptography isolation, family-coverage,
  source-safety, and permanent non-authority checks.
- ten compact one-family minimal counterexamples with one semantic delta each;
- eight isolated primary-gate PASS-to-FAIL proofs plus rejection-preserving
  signature and guard proofs that create no positive cryptographic material;
- canonical and insertion-order-sensitive input commitments that explicitly
  bind the expected-target key-order case; and
- exact Node/Python fixture replay, fixture-set commitment, tamper rejection,
  source-safety, and permanent non-authority checks.
- a compact representation-sensitivity audit over all 256 seeded inputs;
- 256 unique ordered commitments and 231 canonical classes, with exactly one
  permitted 26-case class containing only expected-target key permutations;
- exact Node/Python replay of every compact audit record, collision class, and
  record-set commitment without storing full input or result expansions; and
- changed-record, changed-set, unexpected-collision, duplicate-order,
  source-safety, and permanent non-authority checks.
- a domain-separated binary Merkle tree over all 256 compact audit records;
- eight-step inclusion proofs for exactly the 26 expected target-order
  collision members and no accepted vector;
- proof and proof-set commitments plus exact Node/Python reconstruction; and
- index, record, sibling, side, domain, path, root, membership, authority, and
  proof-set mutation rejection.
- one deterministic minimal multiproof for the same 26 collision members;
- 84 aggregate proof nodes versus 208 individual-path nodes, with the exact
  124-node saving bound in the public contract;
- canonical membership-derived level/index coordinates and exact Node/Python
  multiproof reconstruction; and
- missing, redundant, reordered, changed, disconnected, incomplete-membership,
  authority, equivalence, count, and commitment rejection.
- 96 deterministic unique multiproof property subsets spanning one through 256
  selected records and 10,579 total memberships;
- an independent pairwise coordinate oracle, forward/reverse membership-order
  verification, and individual-path equivalence for every property case;
- 84,632 aggregate individual-path nodes reduced to 6,554 minimal multiproof
  nodes, saving 78,078 nodes; and
- bad-root, duplicate-member, out-of-range-member, missing-member,
  missing-node, redundant-node, changed-node, and reordered-node rejection over
  the full compact property corpus.
- 79 deterministic subsets across 15 odd tree widths from one through 257
  leaves, covering 2,893 selected records and duplicate-final-node behavior;
- independent root and minimal-coordinate oracles plus exact individual-path
  equivalence for every odd-width property case;
- 21,873 aggregate individual-path nodes reduced to 908 multiproof nodes,
  saving 20,965 nodes;
- explicit recognition that a duplicate-final Merkle root alone does not bind
  an odd leaf count against `N + 1` aliasing; and
- canonical `treeLeafCount` commitment with exact equality to independently
  replayed record and summary counts.
- compact Node/Python replay of the same 79 odd-width cases, 15 tree sizes,
  2,893 memberships, 21,873/908/20,965 node accounting, 18 known root-only
  width aliases, and case-set commitment; and
- independent Python exit-`2` rejection when the published odd-width property
  commitment drifts, without storing the expanded synthetic corpus.
- 237 deterministic `treeLeafCount` boundary outcomes covering below, exact,
  and above candidates for all 79 odd-width property cases;
- 79 exact accepts and 158 bound mismatch rejections despite 20 raw multiproof
  aliases, including two below and 18 above the committed width;
- separate root, committed-count, and boundary-outcome commitments reproduced
  exactly in Node and zero-dependency Python; and
- compact-only publication with no expanded boundary corpus, acceptance,
  receipt, completed review, deployment, or activation authority.
- a deterministic network-free settlement scheduler with canonical sorted
  write-lock sets for campaign, promotion vault, nomination, sequence, role
  markers, and destination balances;
- six seven-step final-slot schedules covering both admission orders and both
  injected transfer-failure points for either contender;
- six lock conflicts, four exact atomic rollbacks, six single-winner commits,
  two permanent-terminal loser rejections, and zero lock leaks;
- exact 1,000-pair, zero-vault, 120/60 IAT winner, and unpaid-loser accounting
  in every compact scenario; and
- explicit no-validator, no-RPC, no-wallet, no-transaction, no-receipt,
  no-review, and no-activation capability gates.
- a fully closed Draft-07 schema for the compact settlement-contention
  artifact, with no field for expanded state, schedules, traces, or attempts;
- independent zero-dependency Python replay of all six admission/fault
  outcomes without importing or executing the JavaScript reference engine;
- exact cross-runtime reproduction of six conflicts, four rollbacks, six
  commits, two terminal rejections, and 1,000-pair/zero-vault/120-60 accounting;
- independent source hashing, scenario-commitment reconstruction, ordered
  scenario-set reconstruction, and winner-equivalent final-state consistency;
- compact semantic replay commitment
  `34049424beac2fd7869365de35419cf86a3824f4eb2a6e5b1a8f9110475ed914`;
  and
- rejection of extra/expanded properties, changed economics with recomputed
  commitments, stale sources, and network/review/activation authority claims.
- sixteen deterministic compact contention mutations across eight primary
  structure, status, capability, authority, economics, semantic replay,
  commitment, and source-binding gates;
- eleven schema-invalid and five schema-valid-but-semantically-invalid
  candidates, all created in memory and rejected in both Node and Python;
- five authority/economic/winner/timeline mutations that remain rejected after
  scenario and ordered scenario-set commitments are recomputed;
- shared cross-runtime candidate/rejection replay commitment
  `949fe48b3ae1d63bf31ead5a7e4ff251100de6fed0749654e9baef112db08032`;
  and
- Python exit-2 rejection for changed compact mutation evidence without storing
  expanded candidates, states, schedules, traces, or attempt inputs.
- all 28 unordered pairs of the eight contention failure gates, with exact
  fixed-order observation and no duplicate pairs;
- independent rejection of both isolated constituents and every combined
  runtime-only candidate, proving no failure is masked;
- shared Node/Python composition replay commitment
  `4584f45b37ca33a07b5c85e68643d11ce41d4e44e3f4174d36052788f55a2faa`;
  and
- Python exit-2 rejection for changed compact composition evidence, with no
  combined candidate, expanded state, schedule, trace, or attempt stored.
- a closed Draft-07 composition schema rejecting unknown root, case, and
  removal fields plus released network, wallet, transaction, receipt, review,
  deployment, or activation authority;
- 56 one-mutation removal checks proving each pair reduces to exactly its
  remaining named gate and remains rejected in Node and Python; and
- shared cross-runtime removal replay commitment
  `951bd99fd43aa9f519f6cf1b817debba1e3b1b22430c96c0c683f21f1831be1d`.
- twelve compact closed-schema mutations covering unknown fields, HOLD status,
  forbidden capabilities, authority claims, cardinality, canonical hex, and
  gate-enum drift;
- exact Node/Python equality for instance pointer, schema pointer, keyword,
  message, candidate commitment, and diagnostic commitment; and
- shared cross-runtime schema-diagnostic replay commitment
  `f7698b7d87a0d5bdfe0aa5a009662cd837fd015d890c87ad1c45dead3866b7fe`.
- 36 representation trials spanning every schema mutation over baseline LF,
  recursively reversed-key LF, and baseline CRLF JSON;
- distinct raw representation digests with stable canonical candidate,
  instance pointer, schema pointer, keyword, message, and diagnostic
  commitments in Node and Python; and
- shared cross-runtime diagnostic representation replay commitment
  `e878654551b14af9516e725230dadabdca72433890ff6c8a67cfbba111d0a68a`.
- 72 strict JSON escape trials across all twelve schema mutations, spanning
  escaped Unicode keys, escaped and Unicode solidus spellings, key order, and
  LF/CRLF bytes while preserving canonical candidate and baseline diagnostic
  commitments;
- six malformed escape and unpaired-surrogate representations rejected before
  mutation in Node and independent zero-dependency Python;
- escape replay commitment
  `441bf740f2d2329b4ccfd8cc78d117db4238081e9dc7e1a1095941b026ef51b0`
  and malformed-set commitment
  `51e96f7b21417e1e84569f8adb0c80079ed96ecaddf3ae5ebf7895c7221a98e9`.
- two bounded-transport controls accepting the ordinary envelope and exactly
  65,536 UTF-8 bytes while preserving the canonical candidate commitment;
- eight pre-mutation rejections covering duplicate keys at three depths and
  one-over-limit byte, depth, object-member, array-length, and total-node
  inputs, independently replayed in Node and zero-dependency Python; and
- control-set commitment
  `3d738e4f62f837f5e0efccf14e61f82ae43423b9b907a8f053e1728e6180a249`,
  rejection-set commitment
  `8422840dc082a557c0ede2b18c576eea3e3eaa0588d1a102b91fd1c4ce57eebd`,
  and combined replay commitment
  `978ec26a9ecf5d0ef9697caa60cea689042feae27070b68a168511b84b24beca`.
- four canonical numeric-token controls spanning the unchanged composition
  envelope, zero, and both exact safe-integer boundaries;
- sixteen pre-candidate rejections covering three fractional or exponent
  equivalents of one, three negative-zero spellings, three unsafe or
  precision-colliding integers, two infinity-producing exponents, and five
  non-JSON constants or illegal prefixes in Node and zero-dependency Python;
- numeric control-set commitment
  `a232afc87617e570edadf508e26ba046b2b4a7ee6c97e5992747941c001fcb13`,
  rejection-set commitment
  `949454ae890e8f2cf261c728a8bb4270bac5bb089c6230603e353a94a2b806cd`,
  and combined replay commitment
  `1d0d6fb06996456732cfd9ba0baa8c7b57ca5bea702bcc9c2dc0efb20d93eaa5`.

Current proposal-only result: **378 tests passed**. This consists of 28 protected
policy tests, 13 reference-engine tests, eight attestation/transparency tests,
two deterministic randomized-state-machine tests, and eight program-interface
and codec tests, five encoded transition-adapter tests, four deterministic
byte-fuzz tests, three Ed25519 public-vector tests, and five verifier-key
lifecycle tests, seven lifecycle-amendment tests, twelve full-interface
composition and drift tests, eleven ABI offset/conformance tests, plus twelve
program-event interface tests and ten event/account reconciliation tests.
Five compact reconciliation-vector and Merkle-commitment tests complete the
compact-vector suite, and six Draft-07 schema/example tests complete the current
suite. Eight content-addressed review-manifest tests and three independent
Python integration tests complete the review-surface suite. Eight held
independent-review receipt-template tests complete the review-contract suite.
Ten unsigned review-payload codec, binding, privacy, and byte-vector tests
complete the canonical payload suite.
Nine verify-only Ed25519 adapter, public-vector, malformed-input, source-safety,
and non-activation tests complete the cryptographic verification suite.
Ten acceptance-gate, target, scope, independence, blocking-finding,
source-safety, receipt-issuance, and non-activation tests complete the receipt
policy suite.
Ten offline linter, deterministic report, input-commitment, CLI-exit,
fail-closed, source-safety, and non-activation tests complete the reviewer
bundle presentation suite.
Eight portable-schema, structural/semantic-boundary, invalid-example,
target-authenticity, authority-constant, source-drift, and privacy tests
complete the reviewer bundle schema suite.
Nine structural-preflight, pointer-diagnostic, CLI-exit, semantic-stop,
pure-evaluator, source-safety, and non-authority tests complete the reviewer
input preflight suite.
Six cross-runtime Python reproduction, diagnostic-parity, mutation-rejection,
CLI-failure, source-safety, and manifest-coverage tests complete the independent
preflight suite.
Six campaign-envelope primitive-control, exact-message, field-mutation,
cryptographic-guard, source-safety, and non-authority tests complete the
rejection-only signature-integration suite.
Eight positive-vector intake schema, target-binding, privacy, provenance,
message-binding, review, non-authority, source-safety, and manifest-coverage
tests complete the rejection-only intake suite.
Seven independent Python intake reproduction, RFC-control, drift-rejection,
HOLD, CLI-failure, source-safety, and manifest-coverage tests complete the
cross-runtime intake-verification suite.
Nine differential-corpus generation, gate-family, Node/Python parity,
changed-evidence rejection, source-safety, non-authority, and manifest-coverage
tests complete the fixed mutation suite.
Eight seeded fuzz generation, family-coverage, rejection, review isolation,
commitment/Merkle, Python parity, changed-evidence, source-safety, and
manifest-coverage tests complete the compact high-volume mutation suite.
Nine minimal-counterexample generation, family coverage, primary-gate
transition, negative-cryptography, ordered-commitment, non-authority, Python
parity, changed-evidence, source-safety, and manifest-coverage tests complete
the reduced-fixture suite.
Eighteen representation-audit regeneration, ordered-uniqueness, expected-
collision, family-coverage, record-tree, exact-proof-coverage, proof-mutation,
minimal-multiproof, varied-subset property, independent-coordinate,
odd-width root parity, duplicate-final tree-size binding, multiproof-mutation,
exact boundary mutation, rejection-only, odd-width and boundary Node/Python
parity, changed-evidence, source-safety, and manifest-coverage tests complete
the all-input audit suite.
Seven settlement-contention regeneration, lock-derivation, final-slot winner,
two-transfer rollback, reverse-order, invalid-schedule, source-safety, compact-
evidence, and manifest-coverage tests complete the network-free concurrency
suite.
Five closed-schema, unexpected-property, malformed/accounting, authority-gate,
and manifest-coverage tests plus five independent Python replay, recomputed-
commitment mutation, expanded-schedule, source-drift, source-safety, and
manifest-coverage tests complete the portable contention-verification suite.
Nine deterministic mutation regeneration, gate-family coverage, all-rejected,
schema/semantic separation, rebound-commitment, compact-publication, Python
parity, changed-evidence exit, source-safety, and manifest-coverage tests
complete the cross-runtime contention mutation suite.
Nine complete-pair regeneration, unique coverage, exact precedence,
independent no-masking rejection, compact-publication, Python parity,
changed-evidence exit, source-safety, and manifest-coverage tests complete the
cross-runtime two-gate composition suite.
Six closed-schema acceptance, unknown-field rejection, HOLD-authority
rejection, 56-case removal minimality, independent Python tamper rejection,
source-safety, and manifest-coverage tests complete the composition schema and
minimization suite.
Eight deterministic diagnostic regeneration, family coverage, JSON Pointer
provenance, all-rejected, independent Python exact parity, tamper exit,
compact-publication, source-safety, and manifest-coverage tests complete the
composition schema mutation suite.
Eight deterministic representation regeneration, 36-trial coverage, raw-
digest distinction, canonical/diagnostic stability, LF/CRLF separation,
independent Python parity, tamper exit, compact-publication, source-safety, and
manifest-coverage tests complete the diagnostic representation suite.
Twelve strict escape regeneration, 72-trial coverage, raw-digest distinction,
canonical and diagnostic stability, line-ending, escaped-Unicode, solidus,
malformed-escape, surrogate, independent Python parity, two tamper exits,
compact-publication, source-safety, and manifest-coverage tests complete the
escape representation suite.
Twelve bounded-transport deterministic regeneration, fixed-limit, control,
duplicate-key, exact-byte, depth, object-member, array-length, total-node,
independent Python parity, tamper-exit, compact-publication, source-safety, and
manifest-coverage tests complete the transport-limit suite.
Twelve numeric-token deterministic regeneration, exact-rule, canonical-control,
fraction/exponent-equivalence, negative-zero, unsafe-integer, non-finite,
non-JSON, compact-publication, independent Python parity, tamper-exit,
source-safety, and manifest-coverage tests complete the numeric-token suite.

## Current guarantees of the reference model

- fixed 120 IAT hero and 60 IAT proposer reward;
- exactly 180 IAT per completed pair;
- no more than 1,000 completed pairs;
- no more than 180,000 IAT total outflow;
- pending, cancelled, invalid, and expired-attestation paths consume no slot;
- node, wallet, and X commitment markers are independent per reward role;
- a prior hero may later earn one proposer reward and vice versa;
- failed settlement returns no partial state;
- pair 1,001 cannot execute; and
- an exhausted campaign cannot reopen; all remaining nominations expire unpaid
  and release their reservations.

These are executable model properties, not claims about any deployed program.

## Open security decisions

- revoke standalone upgrade authority or use an enforced public timelock;
- identity-verifier key custody and emergency-reviewer threshold;
- independent reviewer authority and threshold;
- identity-commitment pepper custody and auditor procedure;
- X API terms, availability, minimal scopes, and retention;
- relayer and rent funding;
- exact community refund account;
- public-handle display consent; and
- legal review of promotion eligibility and regional restrictions.

## Next safe increment

Add a compact delimiter and whitespace corpus proving BOM, Unicode whitespace,
trailing values, and concatenated JSON documents reject before candidate
production. Keep candidates runtime-only; do not contact a local validator,
Devnet, or Mainnet; preserve every network, wallet, review, deployment, and
activation HOLD.

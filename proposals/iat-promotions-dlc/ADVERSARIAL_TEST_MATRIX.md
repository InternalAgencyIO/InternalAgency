# Adversarial test matrix

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This matrix describes the network-free reference tests. Passing it is not a
security audit or deployment approval.

| Invariant or attack | Test evidence | Expected result |
| --- | --- | --- |
| Funding attempts to use a V2 or non-community lane | `activation requires isolated full funding...` | Rejected; original state unchanged |
| Activation before Genesis + 8 hours | same | Rejected |
| Activation on a non-mainnet binding | same | Rejected |
| Activation without separate review | same | Rejected |
| Pending nomination | `pending and cancelled nominations...` | Zero completed capacity and zero spend |
| Cancelled nomination | same | Reservation released; zero completed capacity and zero spend |
| Fake verifier result | `invalid and expired attestations...` | Rejected without state mutation |
| Expired verifier attestation | same | Rejected without state mutation |
| Exact paired accounting | `paired settlement pays exact amounts...` | 120/60 transfers, six role markers, one receipt |
| X handle changes after nomination | `a handle change is safe...` | Same immutable X commitment settles |
| Self-referral by X identity | `self-proposals are rejected...` | Rejected at nomination |
| Self-referral by node | same | Rejected at settlement |
| Self-referral by wallet | same | Rejected at settlement |
| Failure after modeled hero transfer | `settlement failure after either modeled transfer...` | Full rollback |
| Failure after modeled proposer transfer | same | Full rollback |
| Reused settlement attestation nonce | `attestation nonces cannot be replayed...` | Rejected; no second payment |
| Reused proposer wallet | `node, wallet, and X uniqueness...` | Rejected independently of node/X |
| Reused hero wallet | same | Rejected independently of node/X |
| Reused proposer node, wallet, or X identity | `every proposer and hero identity dimension...` | Each dimension independently rejects reuse |
| Reused hero node, wallet, or X identity | same | Hero X rejected at nomination; node/wallet rejected before settlement |
| Same node earns different roles once each | same | Accepted; role limits remain independent |
| Cancellation wins before settlement | `cancellation and settlement ordering...` | Settlement rejected; no payment or completed slot |
| Settlement wins before cancellation | same | Cancellation rejected; exactly one atomic pair remains paid |
| 1,000 completed pairs | `exactly 1,000 pairs...` | Exactly 180,000 IAT spent; vault reaches zero |
| Attempted pair 1,001 | same | Permanently rejected |
| Two candidates for final slot | `the final slot is serialized...` | First canonical settlement wins; other expires unpaid and releases reservations |
| Work after terminal state | final two tests | Rejected; state remains unchanged |
| Canonical-envelope key order ambiguity | `canonical JSON is stable...` | Same bytes and digest regardless of insertion order |
| Envelope payload or ID tampering | `payload, ID, signature...` | Rejected |
| Detached-signature tampering | same | Rejected by the supplied verification boundary |
| Unapproved verifier key or wrong campaign | same | Rejected |
| Overlong attestation or stale wallet proof | `attestation lifetime...` | Rejected before reference-engine use |
| Duplicate public outcome | `duplicate outcomes...` | Rejected |
| Transparency entry mutation or reordering | same | Hash-chain verification fails |
| Transparency-log truncation or rewrite | `published checkpoints...` | Prior public checkpoint verification fails |
| Canonical envelope to settlement | `verified envelopes drive...` | Verified minimal binding completes one exact pair |
| Random legal/illegal operation sequences | `randomized-state-machine.test.mjs` | Every invariant holds after every operation |
| Program interface claims a network or program ID | `network or deployment claims...` | Interface validator rejects the deployment claim |
| Account size or discriminator mutation | `layout and forbidden-account mutations...` | Interface validator rejects the binary-layout drift |
| Forbidden V2 account added to an instruction | same | Interface validator rejects the capability leak |
| Missing atomicity, six-marker, or terminal guard | `economic, vault, atomicity...` | Interface validator rejects the weakened contract |
| Deterministic instruction serialization | `published vectors encode...` | Every instruction matches its fixed public byte vector and round-trips |
| Missing, extra, malformed, negative, unsafe, or overflowing field | `the encoder rejects...` | Encoding fails before bytes are produced |
| Unknown discriminator, truncation, or trailing bytes | `the decoder rejects...` | Decoding fails without accepting an ambiguous instruction |
| Encoded bytes drift from the pure transition model | `encoded initialization, funding...` | Full lifecycle decodes and preserves exact accounting |
| Pre-activation refund through encoded adapter | `pre-activation cancellation...` | Only the isolated promotion balance returns to the fixed refund lane |
| Encoded cancellation path | `encoded nomination cancellation...` | Reservation releases with zero spend and zero completed capacity |
| Verifier reports a non-exact signed message | `verification, policy...` | Rejected before any state transition |
| Attestation ID differs from encoded bytes | same | Rejected before any state transition |
| Policy hash differs during activation | same | Rejected without mutating the funded campaign |
| Failure after decoded hero transfer | same | Caller state retains zero partial effects |
| 1,000 encoded nomination/settlement pairs | `pair 1,000 exhausts through encoded transitions...` | Exact cap and zero remaining vault balance |
| Repeated terminal surplus finalization | same | First finalization is auditable; repeat is permanently rejected |
| 2,048 randomized fixed-width instructions | `2,048 deterministic randomized instructions...` | Every value round-trips to one byte representation; seeded digest reproduces |
| Every proper prefix of every instruction vector | `every truncated vector...` | Decoder rejects all truncations |
| Random trailing suffixes | same | Decoder rejects all non-canonical trailing bytes |
| Single-bit instruction mutation | `single-bit mutations...` | Unknown discriminator rejects; valid data mutation re-encodes identically |
| 128 verifier-binding mutations | `128 deterministic verifier-binding mutations...` | Every mismatch rejects with byte-identical caller state |
| RFC 8032 Ed25519 tests 1 and 2 | `public-key-only RFC 8032 vectors...` | Public keys verify the published messages/signatures |
| Every byte of both RFC signatures mutated | `every signature-byte mutation...` | All 128 mutations reject |
| RFC message or public key substituted | same | Verification rejects |
| Secret-bearing field added to public vectors | `deployment claims, secret-bearing fields...` | Vector validator rejects publication |
| Rotation without separate review | `rotation requires separate review...` | Rejected with original lifecycle unchanged |
| Rotation notice shorter than 24 hours | same | Rejected |
| Key overlap longer than one hour | same | Rejected |
| New key before explicit activation | `activation and retirement enforce...` | Rejected even after scheduled timestamp |
| Old key at retirement boundary | same | Invalid exactly at retirement timestamp |
| Concurrent rotation | `concurrent rotations...` | Rejected while one rotation is pending |
| Public key reused | same | Permanently rejected for the campaign |
| Review ID replayed | same | Rejected across later transitions |
| Emergency disable with pending rotation | `emergency disable is immediate...` | Pending key cancels; new issuance stops immediately |
| Re-enable after emergency disable | same | Permanently rejected; new reviewed campaign version required |
| Historical issuance before emergency timestamp | same | Remains verifiable under its original guards |
| Key-lifecycle log mutation or domain drift | `public checkpoints accept...` | Lifecycle validation and prior checkpoint verification fail |
| Amendment claims deployment or application | `deployment claims and removed review gates...` | Validator rejects network, program ID, deployable-v0, or applied-amendment claims |
| Amendment review or Devnet gate removed | same | Validator rejects the weakened release boundary |
| Amendment account size or discriminator drift | `all amendment account sizes...` | Deterministic layout/discriminator check fails |
| New lifecycle instruction bytes drift | `every amendment instruction matches...` | All five fixed vectors must round-trip exactly |
| Token, vault, mint, or V2 account added | `money-account, secret-field...` | Amendment validator rejects the account capability |
| Private/secret-bearing account field added | same | Amendment validator rejects the field and layout |
| Notice, overlap, replay, reuse, or identity guard removed | `weakened schedule, emergency...` | Amendment validator rejects the weakened schedule |
| Emergency terminal or clock guard removed | same | Amendment validator rejects the weakened disable path |
| Re-enable instruction added | `base attestation binding...` | Instruction set and forbidden-capability validation fail |
| Read-only registry/key binding removed from settlement | same | Base-interface amendment validation fails |
| Base or amendment source changes under a stale composed preview | `a base-interface mutation...`; `an amendment mutation...` | Canonical source digest and full deterministic composition mismatch |
| Base or amendment vector removed or reordered | `vector removal and discriminator changes...` | Composition stops before a preview can be accepted |
| Vector discriminator differs from its composed instruction | same | Drift validator rejects the mismatched vector |
| Base/amendment discriminator collision | `cross-domain account and instruction...` | Composer rejects ambiguous account or instruction identity |
| Inline verifier field or initializer argument survives composition | `composition replaces inline verifier state...` | Preview validation fails |
| Registry/key accounts become writable on an attestation path | `every attestation consumer...` | Drift validator rejects the capability escalation |
| Preview claims mainnet, a program ID, deployment, or application | `deployment claims and writable external accounts...` | Preview status gate and exact recomposition both fail |
| Treasury or another external lane becomes writable | same | Cross-interface capability scan rejects the instruction |
| Applied amendment or released v0 HOLD used as preview input | `composition refuses an applied amendment...` | Composer stops; no derived artifact is accepted |
| Inherited initializer vector retains removed verifier-key bytes | `composed vectors remove only...` | Derived vector is exactly 32 bytes shorter and round-trips against the preview |
| Stale composed vector or reintroduced key field | `a stale composed vector...` | Composition validator rejects length, bytes, and deterministic-generation drift |
| Account layout gap, overlap, or wrong final size | `account gaps, overlaps...` | ABI validator rejects the exact field and layout digest |
| Instruction-data offset or encoded length drift | `instruction data, account-meta order...` | ABI validator rejects layout and public-vector length mismatch |
| Account-meta reorder or signer/writable/optional flag drift | same | ABI manifest exact generation and contiguous meta-index checks fail |
| u64/i64 published as unsafe JSON number | `numeric JSON values...` | ABI conformance validator requires a decimal string |
| Cross-language scalar byte drift | same | Fixed little-endian hex fixture comparison fails |
| Stale composed preview under ABI manifest | `a changed composed preview...` | Canonical preview binding and deterministic manifest equality fail |
| ABI manifest claims deployment or applied composition | `deployment claims and released...` | All client-binding HOLD gates reject the artifact |
| A composed instruction has no successful-outcome event | `all thirteen composed instructions...` | Event coverage check fails |
| Event discriminator collision or domain drift | `event discriminators are domain-derived...` | Event interface validation fails |
| Missing, extra, numeric, malformed, or overflowing event field | `event encoding rejects...` | Codec rejects before bytes are emitted |
| Unknown, truncated, or trailing event bytes | `event decoding rejects...` | Decoder rejects every ambiguous representation |
| Raw X ID or mutable handle added to an event | `identity events expose commitments...` | Privacy-field and commitment-only guards fail |
| Pair event omits a destination, identity binding, receipt, reward, or counter | `PairSettled publishes...` | Audit field/semantic-guard validation fails |
| Exhaustion claims arbitrary nomination bulk writes | `exhaustion is one terminal event...` | Event interface requires status-derived invalidation without bulk mutation |
| Verifier event does not bind prior/new registry hash heads | `all verifier events publish...` | Lifecycle event validation fails |
| Failed transition allowed to emit an outcome | `deployment, source, audit-rule...` | Rollback and success-only audit rules fail |
| Event vector or schema changes under stale evidence | `stale vector bytes and event schema...` | Deterministic vector, byte, and length checks fail |
| Event interface claims a network, program ID, deployment, or application | `deployment, source, audit-rule...` | All event HOLD gates fail |
| Event ordinal, transaction log index, or cursor is duplicated or reordered | `record truncation, duplicate cursors...` | Reconciler rejects before campaign evidence is evaluated |
| Event bytes are truncated or ambiguous | same | Fixed event decoder fails closed |
| Settlement has no receipt, an extra receipt, or a changed receipt field | `receipt set, receipt body...` | Complete receipt bijection and every public field must match |
| Campaign paid counter or completed-pair counter drifts | same | Aggregate event economics must equal the campaign snapshot |
| Promotion-vault snapshot differs from the last successful outcome | same | Reconciler rejects the evidence set |
| Promotion vault drops below fixed budget less exact paired rewards | `unattributed deposits remain surplus...` | Deficit is rejected; outside deposits cannot fund reward capacity |
| Unattributed vault surplus disappears during settlement | same | Unexplained outflow is rejected |
| Pair 1,000 has no exhaustion event or a different transaction | `pair 1,000 requires...` | Terminal evidence must immediately follow the final pair in one transaction |
| Campaign event occurs after cancellation or exhaustion | same | Permanent terminal-state guard rejects resumed work |
| Pending nominations exist at exhaustion | `a complete 1,000-pair stream...` | They remain unwritten but are derived as ineligible from campaign status |
| Verifier registry starts from a nonzero hash or forks its prior head | `verifier hash-chain forks...` | Reconciler rejects the broken chain |
| Registry snapshot head or terminal status differs from events | same | Authoritative registry snapshot must equal the derived final state |
| Verifier event follows emergency disable | same | Permanent verifier terminal-state guard rejects it |
| Pre-activation cancellation redirects the refund | `pre-activation cancellation reconciles...` | Only the immutable community refund and exact vault balance are accepted |
| Reconciliation policy claims network, program, deployment, or application | `deployment claims, source drift...` | Policy HOLD gates fail before evidence processing |
| Reconciliation source digest or non-authority invariant drifts | same | Source binding and accounts-remain-authoritative rule fail closed |
| Active, cancelled, exhausted, surplus, or verifier-disabled fixture changes | `compact reconciliation vectors reproduce...` | Full deterministic generation no longer equals the published artifact |
| Event or receipt order changes under a compact vector | `record and receipt Merkle roots...` | Domain-separated Merkle root changes |
| Record, receipt, snapshot, result, or source changes under stale digests | `source, scenario, digest...` | Canonical digest, scenario contract, or source binding fails |
| Raw X ID, handle, signature, event bytes, snapshot, or receipt body is added | `raw identity, signatures...` | Compact-artifact privacy and size guard rejects the field |
| Compact vectors claim network, program, deployment, or application | `source, scenario, digest...` | Every vector HOLD gate fails |
| Evidence ordinal is numeric rather than a decimal string | `all invalid public examples...` | Draft-07 type check rejects the envelope |
| Event bytes have odd length or non-hex characters | same | Fixed byte pattern rejects the record |
| Campaign or registry status is outside the public enum | same | Draft-07 enum check rejects the snapshot/result |
| Required vault/account field is missing | same | Draft-07 required check rejects the snapshot |
| Unknown field is added to evidence or result | same | Closed-object `additionalProperties: false` rejects it |
| Result claims mainnet or authority to change state | same | Fixed `const` gates reject the result |
| Schema opens an object, changes economics, or releases status | `open objects, economics drift...` | Schema contract and source-digest validation fail |
| Schema adds raw X identity, handle, OAuth, or signing fields | `schema properties expose commitments...` | Privacy-field scan rejects the schema |
| Structurally valid evidence violates accounting semantics | `every valid evidence example...` | Semantic reconciler remains the required second validation layer |
| Proposal file content, normalized length, path, or role changes under a stale review root | `path order, content changes...` | Per-file content/leaf hashes, deterministic regeneration, and the tree root fail |
| Review entry is absolute, traversing, duplicated, malformed, or self-recursive | `absolute, traversing...` | Path-safety, uniqueness, digest, and explicit self-reference guards fail closed |
| Checkout changes LF to CRLF | `CRLF and LF checkouts...` | UTF-8 newline normalization reproduces the same content hashes and tree root |
| Validator, generator, test, artifact, or supporting source disappears | `all validator, generator...` | Filesystem regeneration or required-role coverage rejects the stale manifest |
| Review manifest claims mainnet, a program ID, deployment, or application | `manifest status cannot claim...` | Fixed HOLD status gates reject the manifest |
| Review manifest publishes private evidence instead of paths and hashes | `manifest publishes only paths...` | Entry-shape and private-field scans reject the artifact |
| Intermediate Merkle node changes while the final manifest is stale | `every fixed intermediate Merkle level...` | Full published level-by-level comparison fails before root acceptance |
| JavaScript and Python normalize, classify, or hash differently | `independent zero-dependency Python verifier...` | Complete independently generated manifests must be equal |
| Stale digest or intermediate node is submitted to the Python verifier | `independent Python verifier rejects...` | Independent regeneration exits nonzero and reports invalid evidence |
| Independent verifier is omitted from the review inventory | `the independent verifier is itself covered...` | Required validator entry and deterministic filesystem coverage fail |
| Receipt does not bind commit, manifest digest, tree root, file count, or scope | `template binds a future receipt...` | Required final-binding contract and commit/tree agreement fail |
| Reviewer also controls authorship, deployment, vault, ceremony, or verification | `reviewer must be independent...` | Fixed disallowed-role and independence requirements reject the receipt |
| Review scope silently omits files or open security decisions | `template covers the full manifest...` | Every manifest entry and open-decision disposition remain mandatory |
| Review approval is treated as activation authorization | `even review approval has no activation effect...` | Approval effect remains `NONE`; separate activation review is required |
| Template creates keys, signs, or pre-fills a public key or signature | `template never generates keys...` | External-only attestation boundary and null template fields fail |
| Template claims a final decision, completed review, issuance, or deployment | `deployment, binding, independence...` | HOLD, template-state, and non-activation mutation checks fail |
| Unsigned payload omits or reorders a bound field | `canonical field order is fixed...` | Exact key set and canonical order reject encoding |
| Commit, manifest, tree, file count, or scope changes under the same payload digest | `every target and scope binding...` | Each independent mutation produces different message bytes and SHA-256 |
| Reviewer, decision, rationale, findings, or timestamp is not committed | `reviewer, decision, rationale...` | Each independent mutation changes the payload digest |
| Payload uses unsafe integers, malformed hex, invalid UTF-8 length, or unknown decision | `malformed hashes, integers...` | Fixed-width and canonical-format validation fails closed |
| Review payload carries activation authority | `activation authorization and every non-NONE...` | Encoder rejects authorized activation and every non-`NONE` effect |
| Payload is truncated, extended, or has wrong magic or decision code | `truncation, trailing bytes...` | Decoder rejects every ambiguous byte sequence |
| Public vectors contain a key, signature, secret, raw identity, handle, or wallet field | `public vectors contain no key...` | Forbidden-field and non-attestation checks fail |
| Adapter accepts a signature that is valid for an unrelated message | `unrelated valid RFC signatures...` | All three canonical review payloads reject the unrelated RFC signature |
| Public key, signature, or message byte changes | `changed public key, signature...` | Detached Ed25519 verification returns false |
| Attestation has malformed material, extra fields, or wrong algorithm | `malformed detached material...` | Exact shape and public-material format checks fail without throwing |
| Claimed payload digest differs from canonical receipt bytes | `payload digest mismatch stops...` | Verification stops before the signature check |
| Invalid or activation-authorizing payload reaches cryptographic verification | `invalid or activation-authorizing...` | Canonical payload validation fails first and result remains non-activating |
| Valid cryptography is presented as semantic review, independence, or activation proof | `cryptographic result never claims...` | All three non-cryptographic conclusions remain false or `NONE` |
| Verify-only adapter gains keygen, signing, wallet, or network capability | `adapter source contains no signing...` | Allowed imports and forbidden-call scan fail |
| Candidate, target, or reviewer has unknown, missing, or reordered fields | `unknown, missing, or reordered candidate...` | Exact-shape acceptance gate fails |
| Candidate target differs from expected target or signed payload | `target must match expected...` | Three-way target-binding gate fails |
| Scope duplicates/omits decisions, omits areas, changes count, or has stale hash | `scope rejects duplicate decisions...` | Complete-scope gate fails closed |
| Reviewer holds any author/operator/deployer/vault/verifier role | `every disallowed concurrent reviewer role...` | Reviewer-independence gate fails |
| Approval retains a blocking open-security disposition | `blocking dispositions prevent approval...` | Semantic gate rejects approval while allowing request-changes |
| Missing external signature is hidden by otherwise complete evidence | `fully aligned public fixture fails only...` | Cryptographic gate remains visibly false and candidate is rejected |
| Rejection is presented as receipt issuance, completed review, or activation | `no public scenario issues a receipt...` | All result authority fields remain false or `NONE` |
| Human-readable report hides or reorders a required gate | `gate order is fixed...` | All six policy gates reproduce in one fixed order with explicit PASS/FAIL state |
| Candidate controls the supposedly expected review target | `separately supplied expected-target mismatch...` | Independently supplied target mismatch visibly fails target binding |
| Bundle or target changes after linting | `candidate, expected target... receive distinct stable commitments` | Three separate canonical input commitments change with their bound objects |
| Malformed programmatic input crashes open or claims authority | `malformed programmatic input fails closed...` | Candidate rejects and receipt, review, and activation authority remain false |
| Rejected CLI result is mistaken for a successful lint | `CLI returns rejection status 2...` | Rejection is human-readable and returns a distinct nonzero status |
| Linter gains file-write, signing, keygen, or network capability | `linter source has local-read-only capability...` | Import allowlist and forbidden-capability scan fail |
| Candidate, expected target, or lint result gains an unknown field | `all fourteen invalid examples...` | Closed Draft-07 object shape rejects the field |
| File count becomes numeric or a hash/signature is malformed | same | Canonical string type and fixed lowercase-hex patterns reject it |
| Candidate omits a required review area | same | Fixed ordered eight-area scope fails structural validation |
| Structurally valid candidate is presented as semantically accepted | `structural validity remains separate...` | Six-gate evaluator still rejects the unrelated signature |
| Structurally valid target is candidate-controlled or mismatched | `a structurally valid but independently mismatched target...` | Semantic target-binding gate fails despite shape validity |
| Lint result claims receipt, completed review, or activation | `lint-result schema permanently fixes...` | Result schema constants reject every authority escalation |
| Schema opens an object or claims a released network | `open objects, released status...` | Schema-contract validator rejects the source and source digest |
| Schema/example corpus exposes raw X identity or private material | `portable schemas expose commitments...` | Privacy scan permits commitments and public attestation only |
| CLI evaluates semantic gates after malformed structure | `all nine malformed input scenarios stop...` | Structural failure fixes semantic permission and execution to false |
| CLI hides the failing field behind a generic error | `human diagnostics expose document...` | Document, JSON Pointer, Draft-07 keyword, and message remain explicit |
| Crafted diagnostic contains backslashes, pipes, or line breaks | same | Renderer escapes backslashes first, then pipes, and normalizes newlines |
| Structural rejection returns the semantic-rejection exit code | `CLI returns status 3...` | Schema failure uses distinct exit `3`; semantic rejection remains exit `2` |
| Structural preflight replaces or mutates the pure evaluator | `pure programmatic evaluator remains available...` | Direct evaluator behavior and rejection result remain unchanged |
| Preflight gains file-write, signing, keygen, or network capability | `preflight source is local-read-only...` | Import and forbidden-capability checks fail |
| Node validator or renderer hides an implementation-specific result | `Python and Node produce identical...` | Independent Python reproduces all ten complete result objects and normalized Markdown outputs |
| One published diagnostic is changed after generation | `independent vector verification rejects...` | Python comparison exits nonzero and names the changed scenario |
| Independent verifier gains network, write, signing, wallet, or authority capability | `independent Python preflight is local-read-only...` | Source capability checks and fixed false/`NONE` authority fields fail |
| Cryptographic library is broken or bypassed | `both externally sourced RFC primitive controls verify` | Two primary-source RFC positive controls must verify |
| An unrelated valid signature is accepted for the exact campaign envelope | `both unrelated RFC signatures reject...` | Exact canonical message reaches Ed25519 verification and rejects |
| Any signed campaign field changes without detection | `all eleven canonical field mutations...` | Rebuilt canonical envelope reaches and fails the signature gate |
| Signature byte or public key is substituted | `cryptographic mutations fail...` | Verify-only adapter rejects both mutations |
| Domain, scheme, version, or attestation ID bypasses signature ordering | same | Four fixed guards reject before signature verification |
| Negative controls are presented as positive campaign integration | `campaign-envelope vectors reproduce...` | Missing positive vector remains machine-readable HOLD; no receipt/review/activation effect |
| Positive-vector candidate omits provenance or adds an unknown field | `closed schema and private-material exclusion...` | Closed Draft-07 structure rejects the candidate before cryptographic acceptance |
| Candidate includes a private key, seed, mnemonic, OAuth secret, or access token | same | Independent recursive privacy gate rejects secret-bearing field names |
| Claimed canonical message bytes or SHA-256 drift | `canonical bytes, digest... remain bound` | Canonical-message binding fails against the verifier's reconstruction |
| Candidate substitutes the independently supplied public key or source digest | `canonical bytes...` / `provenance cannot be self-asserted...` | Target binding or external provenance fails closed |
| Candidate labels an unrelated valid signature as source-signed | `provenance cannot be self-asserted...` | Ed25519 verification still fails for the exact campaign message |
| Candidate claims its own review completion | `candidate review claims... remain powerless` | Independent target flags and review-receipt digest remain unsatisfied |
| Intake candidate claims receipt, review, deployment, or activation authority | same | Closed schema and non-authority gate reject the claim; evaluator output remains false/`NONE` |
| Public rejection case is presented as accepted | `every published scenario is rejected...` | At least one of the fixed eight gates fails for every public candidate |
| Intake evaluator gains write, network, wallet, signing, or keygen capability | `intake evaluator is local-read-only...` | Source capability scan and review-manifest coverage fail |
| Independent verifier skips the public Ed25519 positive controls | `independent Python verifier reproduces... both RFC controls` | Both primary-source controls must verify before the rejection corpus is accepted |
| Python canonical JSON, schema pointers, or Ed25519 result differs from Node | same | Every complete expected result must reproduce independently |
| Published gate detail changes under stale Python evidence | `independent verifier rejects and names...` | Independent comparison exits `2` and names the changed scenario |
| Candidate changes while the published Node result remains stale | `independent verifier rejects candidate drift...` | Recomputed schema, binding, and gate result no longer equals the artifact |
| Corpus releases its HOLD or claims activation authority | `released HOLD or authority claims fail...` | Independent metadata contract rejects released or non-`NONE` authority |
| Python verifier receives invalid usage or malformed JSON | `Python CLI gives exit 1...` | Offline pre-evaluation failure returns distinct exit `1` with no result authority |
| Python verifier gains write, network, wallet, signing, keygen, or chain capability | `independent verifier is local-read-only...` | Source capability scan and review-manifest role coverage fail |
| Candidate version, status, unknown fields, or HOLD-label order drifts | `closed-schema mutations fail...` | Node and Python both fail the closed-schema gate in the same fixed result |
| Expected-target key order or version changes | `target shape and candidate-target binding...` | Exact independent-target gate fails before acceptance |
| Expected-target or candidate public key is substituted | same / `canonical-message and signature mutations...` | Canonical binding and cryptographic gates remain deterministic across runtimes |
| Secret-bearing field name or provenance digest is added | `privacy and provenance mutations...` | Both runtimes expose the same privacy/provenance rejection |
| Source-signed provenance is asserted over an unrelated signature | same | Provenance can pass while real Ed25519 verification still fails |
| Canonical bytes, digest, signature hex, payload, or detached signature changes | `canonical-message and signature mutations...` | Both runtimes reproduce exact binding/cryptographic outcomes |
| Review metadata is fully independently bound without valid cryptography | `review binding can pass...` | Review gate passes but cryptographic gate blocks overall acceptance |
| Receipt or activation authority is added to the candidate | `authority mutations fail...` | Schema and non-authority gates fail; evaluator output remains false/`NONE` |
| Python differential result differs from published Node evidence | `Python independently reproduces...` | Complete result-object equality is mandatory for all twenty mutations |

## Next matrix expansion

- seeded high-volume cross-runtime mutation fuzzing for closed schema,
  canonical message, public key, provenance, review, and authority fields;
- local-validator transaction rollback and account-lock contention.

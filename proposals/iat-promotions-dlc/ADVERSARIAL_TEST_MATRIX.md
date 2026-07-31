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

## Next matrix expansion

- machine-readable independent-review receipt template binding the Git commit,
  review root, review scope, decision, and explicit non-activation status;
- canonical campaign-envelope signatures using a reviewed external test-vector
  generator without publishing signing material;
- local-validator transaction rollback and account-lock contention.

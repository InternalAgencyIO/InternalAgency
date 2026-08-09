# Program event interface v1

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

`program-event-interface.v1.json` defines fixed review bytes for campaign,
nomination, settlement, terminal, and verifier-key lifecycle outcomes. It is not
an IDL, deployed log contract, program binary, transaction, wallet request, or
authorization to activate the promotion.

## Authority model

Account state, role markers, settlement receipts, token-account balances, and
the terminal campaign status remain authoritative. Events are supplemental
audit signals. They cannot authorize a transition, move value, substitute for
a receipt, or make a failed instruction look successful.

An event is emitted only after all instruction state changes and transfers have
succeeded. Solana transaction rollback must remove the event with the rest of a
failed transaction.

## Fixed event families

Nine campaign events cover initialization, funding, activation,
pre-activation cancellation, nomination, nomination cancellation, paired
settlement, terminal exhaustion, and surplus finalization. Five verifier events
cover registry initialization, rotation scheduling, rotation activation,
retirement finalization, and terminal emergency disable.

`PairSettled` exposes both public wallet destinations, both node commitments,
both immutable X identity commitments, exact 120/60 IAT rewards, settlement
receipt, sequence, completed-pair counter, and remaining promotion-vault
balance. It contains no raw X user ID or mutable handle.

`CampaignExhausted` is emitted once when pair 1,000 commits. Pending nominations
become ineligible because the campaign account is terminal. The design does not
claim that one Solana instruction can discover and bulk-write an arbitrary set
of nomination accounts. Indexers derive pending-to-expired presentation from
the terminal campaign state.

Every verifier event publishes the prior hash-chain head and the new event hash.
The new hash must equal `VerifierRegistry.last_event_hash` after the transition.
The zero 32-byte cancelled-rotation ID means no pending rotation existed during
emergency disable.

## Encoding and vectors

Every event begins with the first eight bytes of SHA-256 over
`iat-promotions-dlc-events-v1:event:<EventName>`. Fields are fixed-width and
little-endian; public keys and privacy-preserving commitments are raw 32-byte
values. Integers use decimal strings in JSON.

`program-event-vectors.v1.json` contains one deterministic public vector for
all fourteen events. The codec and validator require exact field sets, bytes,
lengths, and round trips and reject unknown discriminators, all truncations,
trailing bytes, unsafe numeric JSON, unsupported types, private identity fields,
stale preview bindings, and deployment/application claims.

Run:

```sh
node proposals/iat-promotions-dlc/generate-program-event-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-program-event-interface.mjs
node --test proposals/iat-promotions-dlc/tests/program-event-interface.test.mjs
```

## Release boundary

The event interface remains `deployable: false`, `compositionApplied: false`,
and `eventInterfaceApplied: false`. Matching event vectors do not approve a
binary, on-chain event format, deployment, funding, activation, Devnet use, or
mainnet use. Independent review must decide whether log cost and the verifier
hash-chain design are acceptable before any implementation.

`EVENT_RECONCILIATION.md` defines a separate held audit model that decodes
these event bytes and compares them with inert semantic account, vault,
receipt, and verifier-registry snapshots. Passing reconciliation proves only
internal consistency of supplied evidence; it does not prove chain inclusion,
finality, account ownership, or deployment.

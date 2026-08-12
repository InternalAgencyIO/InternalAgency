# Disposable standard settle-position-week rehearsal

This fixture links the real internal
`execute_runtime_production_settle_position_week_standard_account_infos` seam
into a conspicuously disposable SBF entrypoint. It exercises the exact
17-account standard graph: signer caller, read-only ACTIVE Config, writable
Position, canonical confidential/hooked Token-2022 mint, vault authority,
Treasury/Ecosystem/Liquidity state and source-token pairs, owner destination,
Token-2022, ZK proof program, transfer-hook program, validation PDA, and the
read-only authenticated Daily-Law state. No CCC Round account is accepted.

Fixture-only instructions create canonical lane-token PDAs and seed one ACTIVE
Config, three lane states, and two standard Positions. Owner-authorized hooked
transfers fund the disposable lane tokens. Token-2022 authenticates that outer
transfer before invoking the hook, whose standard Execute interface deliberately
presents the authority as a read-only nonsigner; the fixture additionally binds
that key to the external source account's owner, requires positive amount and a
vault-owned lane destination, and rejects delegates. This explicitly is not
production lane-funding or stake-ingress evidence.

The fixture validation PDA appends a fixed custom control TLV after the standard
Execute TLV: discriminator `IATB3CTL`, 34-byte payload, version 1, initialization
controller, and ordinal 0..3. Its authenticated setter requires that stored
controller to sign, the exact readonly Token-2022 mint, the exact writable
validation PDA with the expected owner and length, and the exact readonly open
Daily-Law PDA. The standard Execute list remains exactly one readonly nonsigner
Law meta. Setting first/second/third hook rejection changes only the control
ordinal byte; the Execute-list bytes and authenticated Law bytes/hash remain
unchanged, and clearing restores the exact validation baseline. This control is
synthetic failure injection only, not a production ABI or production control.

The loopback matrix proves Daily Law precedes malformed production decoding,
zero Treasury/Liquidity amounts skip CPIs, all three ordered hook-failure
boundaries roll back prior token effects, a wrapper error after executor success
rolls back all three CPIs and the four-state CAS, and success produces exact raw
postimages for Position, three lanes, three source tokens, and destination.
Aggregate lane reservations remain equal to the two Positions' outstanding
reservations throughout.

Hostile checks reject direct signer and nonsigner hook calls because only
Token-2022 can set the source account's transient `transferring` extension.
Actual delegated, zero-amount, and non-lane Token-2022 transfers are rejected
with exact rollback, while positive owner-authorized funding proves exact source
and lane deltas. Lane-to-lane, vault-owned non-lane source, signer escalation,
wrong authority, and wrong destination-owner cases are covered by the pure
classifier table. Lane-to-lane is intentionally classifier-only: the disposable
driver cannot sign for a canonical vault PDA, and the real settlement preflight
rejects a lane-owned destination before the hook. No live result is fabricated.

Control hostiles cover unsigned/wrong controllers, wrong validation address or
owner, malformed length/discriminator/version/ordinal, a locked Law, a changed
Execute meta list, and an absent control TLV. Runtime-addressable failures and
pure byte/fact classifiers both prove fail-closed behavior without mutating the
validation account or settlement accounts.

This packet does not expose or freeze a production ABI, dispatcher, entrypoint,
program identity, final combined binary, reproducible build, public Devnet
result, all-15-handler completion, release-graph node, activation authority, or
Mainnet authorization. `mainnetStatus` remains `HOLD`.

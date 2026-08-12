# Disposable non-core claim-lane-principal rehearsal

This fixture links the real internal
`execute_runtime_production_claim_lane_principal_account_infos` seam into a
conspicuously disposable SBF wrapper. Every production invocation uses its
exact 12-account graph: arbitrary readonly signer caller, readonly ACTIVE
Config, canonical confidential/hooked Token-2022 mint, vault-authority PDA,
one writable lane state, its writable source token account, the fixed
beneficiary destination, Token-2022, ZK ElGamal proof program, transfer-hook
program, validation PDA, and readonly authenticated Daily-Law state.

Fixture-only setup creates all four canonical lane-state and lane-token PDAs
and the fixed beneficiary-owned destination accounts. Owner-authorized hooked
transfers fund the lane tokens. This is synthetic funding only; it is not a
production funding, distribution, or authority ceremony.

Each Treasury, Ecosystem, and Liquidity success invokes exactly one real
hook-aware Token-2022 transfer, reloads both token accounts, and applies
exactly one lane-state CAS increasing `principal_claimed`. Raw account bytes,
owners, lamports, executable flags, delegate/allowance state, token debits and
credits, and economic conservation are checked. Core is rejected before CPI
because its custody/release policy remains unresolved. A fully claimed lane
then proves `NothingVestedToClaim` with zero CPI and no writes.

The authenticated Law is checked before malformed production decoding.
Inactive Config, wrong beneficiary, wrong program identity, wrong lane/source
facts, wrong mint/hook validation/Law facts, core policy, and nothing-vested
paths are fail closed. A fixture-only shadow of the already authenticated Law
changes one copied decision byte and proves the production capability-digest
rebind rejects before CPI, reload, or CAS while the real Law remains unchanged;
this is not a real stale account or production rollback claim. A synthetic
wrapper error after executor success separately proves transaction rollback of
the one transfer and one lane CAS.

The validation PDA appends a fixed custom control TLV after the standard
Execute TLV. Its independently authenticated setter may enable a fixture-only
hook rejection. The Execute list remains exactly one readonly nonsigner Law
meta; authenticated Law bytes and Execute-list bytes never change, and clear
restores the exact baseline. Direct hook calls and hostile setters are
rejected. This control is never parsed by the production executor and is not a
production ABI or authority surface.

The seeded fixture Config stores the disposable controller as its synthetic
admin. Its Law-first fixture toggle requires that exact readonly signer and
uses only the canonical `GenesisStaging/false` and `Active/true` phase/active
pairs. The inactive hostile changes exactly Config bytes 9 and 253, leaves the
rest of the graph and authenticated Law byte-exact, and restores the exact
ACTIVE baseline; a wrong controller changes nothing. This is synthetic fixture
control for an inactive preflight hostile, not a production lifecycle
transition, rollback authority, or activation proof. Hook rejection is
returned from the CPI before token reload or lane CAS, so its proof is exact
raw-state invariance, not a CAS rollback claim.

The packet proves only disposable loopback execution of the retained non-core
executor. It does not prove core custody, a production wrapper or error ABI,
dispatcher, entrypoint, program identity, final combined binary, complete
source closure, reproducibility, public Devnet execution, all 15 handlers,
release-graph completion, activation, funding ceremony, or Mainnet authority.
`mainnetStatus` remains `HOLD`.

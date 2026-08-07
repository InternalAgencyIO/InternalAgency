# B3 deployment-cost feasibility

Status: measured baseline, not a cost promise.

## 1. What the current 8.31841104 SOL represents

The V2 return checklist records:

- ProgramData: `4.15866264 SOL`;
- temporary deployment buffer: `4.15860696 SOL`;
- program account: `0.00114144 SOL`;
- pre-fee peak: `8.31841104 SOL`.

The buffer is temporary deployment liquidity. Loader-v3 drains the buffer when
the bytecode is installed. ProgramData and the program account remain funded.
The current permanent lock is therefore approximately `4.15980408 SOL`, while
the fresh-payer peak is `8.31841104 SOL`, before transaction and priority fees.

“Deployment cost” must always say whether it means:

1. peak payer balance;
2. permanent rent locked after buffer recovery;
3. transaction/priority fees actually spent; or
4. total network/operations cost.

These values are not interchangeable.

## 2. Loader-v3 model

The recorded rent values reconcile exactly with the current rent formula:

```text
rent_exempt(data_bytes) = (data_bytes + 128) * 6_960 lamports
ProgramData overhead = 45 bytes
Buffer overhead = 37 bytes
Program account = 0.00114144 SOL
```

For binary length `B`:

```text
permanent(B) = ((B + 45 + 128) * 6_960 + 1_141_440) / 1e9 SOL
peak(B) = permanent(B) + ((B + 37 + 128) * 6_960) / 1e9 SOL
```

## 3. Safe compiler-only measurement

On 2026-08-07 the exact V2 source at `f0a7949` was built unchanged with:

```text
solana-cargo-build-sbf 3.1.10
platform-tools 1.52
cargo-build-sbf --optimize-size
```

Result:

- binary: `524,672` bytes;
- SHA-256: `2e6b910b57a9b62060eee0ea750592efa3c589815f4fd374bae172dfb8693afb`;
- estimated ProgramData: `3.65292120 SOL`;
- estimated temporary buffer: `3.65286552 SOL`;
- program account: `0.00114144 SOL`;
- estimated permanent lock: `3.65406264 SOL`;
- estimated pre-fee peak: `7.30692816 SOL`.

The generated deployment keypair side effect was deleted immediately. The
measurement does not establish a deployable identity or deployment authority.

The safe size optimizer reduces cost, but it does not meet 3 SOL or 1.5 SOL.

## 4. Exact byte ceilings

| Target interpretation | Maximum binary bytes | Reduction from recorded 597,336-byte basis |
| --- | ---: | ---: |
| 3 SOL peak | about `215,266` | `63.96%` |
| 1.5 SOL peak | about `107,507` | `82.00%` |
| 3 SOL permanent | about `430,697` | `27.90%` |
| 1.5 SOL permanent | about `215,180` | `63.98%` |

After the safe compiler-only build, a 3 SOL peak still requires roughly a 59%
binary reduction from `524,672` bytes. That is a major reimplementation, not a
build flag.

## 5. Current feasibility decision

### Full-feature Solana monolith

- **3 SOL peak:** not feasible by safe compiler optimization; unproven and
  presently treated as infeasible without a major architecture rewrite.
- **1.5 SOL peak:** not credible for the full V2 feature set under the current
  loader-v3 monolith.
- **3 SOL permanent:** closer, but still not met; a native dispatcher and
  dependency cleanup could be prototyped only under full differential tests.
- **1.5 SOL permanent:** not credible without a deep rewrite and measured proof.

No V2 safety check, arithmetic invariant, inactive DLC boundary, randomness
guard, evidence hook, or user feature will be removed to force one of these
numbers.

### Selected Solana-hosted B3 profile

The owner selected an immutable IAT-wide transfer law on Solana and explicitly
relaxed Solana-wide scope, first-block execution, threshold-VRF randomness, and
independent-clock guarantees. B3 therefore needs no validator investment.

Incremental B3 project cost consists of the small Daily Law hook, one fixed
law-state account, canonical Token-2022 mint configuration, RPC/indexing, confidential-
wallet support, possible migration, monitoring, and audits. Solana's deployed
Token-2022 and native ZK proof program provide the confidential-transfer
cryptography.

Default public IAT users pay no ZK-proof or confidential-account cost. Every
public transfer executes the Daily Law hook; its compute, account-list, wallet,
and optional priority-fee overhead must be measured. Only opt-in privacy users
fund the confidential-account extension, currently estimated at roughly
`0.0015 SOL` of extra rent reserve. The canonical current three-transaction
confidential transfer example has six signatures, an illustrative base-fee
floor of `0.000030 SOL` before optional priority fees, plus another transaction
when the recipient applies a pending balance. Temporary proof-context rent is
reclaimed on correct closure. These figures require Devnet measurement and are
not production quotes.

The former sovereign profile remains the only design that can make the law a
chainwide Solana-independent consensus rule. Its validator and network budget
is intentionally not part of the selected low-cost profile.

## 6. Safe optimization work that remains allowed

1. Attribute SBF size by crate, symbol, dispatcher, instruction, and error
   metadata.
2. Unify duplicate Solana dependency generations visible in the exact build.
3. Prototype a native Rust dispatcher while retaining exact state-transition
   vectors and account validation.
4. Separate inactive future DLC binaries only if the features and their
   fail-closed activation model remain intact.
5. Evaluate module boundaries for auditability and upgrade isolation.
6. Rebuild reproducibly and rerun Rust, JavaScript, local-validator, Devnet,
   and independent review gates after every candidate change.

Splitting a monolith is not automatically cheaper: duplicated framework code
can increase permanent rent, and all deployed program accounts count. Every
proposal must report aggregate permanent rent and peak funding, not only the
smallest module.

## 7. Stop condition

If a fully equivalent, independently reviewed candidate cannot meet the byte
ceiling, the target is rejected. The reliable V2 implementation remains the
reference; the code is not gutted.

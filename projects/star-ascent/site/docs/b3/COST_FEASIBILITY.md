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

### Measured B3 native-law artifact

On 2026-08-08 the native `iat_b3_law` adapter, including the immutable daily
law kernel and Token-2022 transfer-hook validation, was built locally with
`solana-cargo-build-sbf 3.1.10`.

The pre-allowlist ordinary release build measured:

- binary: `175,840` bytes;
- SHA-256: `c15d50db862a7aac6cf8d93474357db34d1579acbd5b4d1f50b9f2486d1d2428`;
- estimated permanent lock: `1.22619192 SOL`;
- estimated temporary buffer: `1.22499480 SOL`;
- estimated pre-fee peak: `2.45118672 SOL`.

That source was then rebuilt with `cargo build-sbf --optimize-size`:

- binary: `141,824` bytes;
- SHA-256: `50fc66ec95bc68a71e6a1288f6fb830e2a3c996bd93348f4b832de954ca6dbc4`;
- estimated permanent lock: `0.98944056 SOL`;
- estimated temporary buffer: `0.98824344 SOL`;
- estimated pre-fee peak: `1.97768400 SOL`.

After adding the exact Token-2022 mint-extension allowlist, that intermediate
source was rebuilt with the same pinned optimized command:

- binary: `143,360` bytes;
- SHA-256: `7c495967e183707a92d819b3d09738c82f50d432c1c9c4af57e3ac1e1dc36923`;
- estimated permanent lock: `1.00013112 SOL`;
- estimated temporary buffer: `0.99893400 SOL`;
- estimated pre-fee peak: `1.99906512 SOL`.

After moving both extension-authority revocations and their post-CPI checks
inside the one-time law initializer, the atomic source produced a 188,512-byte
ordinary SBF artifact (SHA-256
`f7061b6c3350d833a01568b2d2b1eda668d57bd500119ebe0e849248cb735061`).
The current candidate was then rebuilt twice with the pinned optimized command
and exercised on a disposable loopback validator:

- binary: `154,952` bytes;
- SHA-256: `927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c`;
- estimated permanent lock: `1.08081144 SOL`;
- estimated temporary buffer: `1.07961432 SOL`;
- estimated pre-fee peak: `2.16042576 SOL`.

This safely meets a `1.5 SOL` **permanent-rent** target for the incremental B3
law program. It does not meet a `1.5 SOL` **fresh-payer peak** target. Under the
same loader-v3 formula, that peak requires approximately `107,507` bytes, so
the current optimized artifact remains `47,445` bytes above the ceiling. The
temporary buffer is recovered after a successful deployment; it is still real
liquidity required during deployment.

Owner decision on 2026-08-08: accept a `3 SOL` aggregate fresh-payer peak
deployment ceiling. The optimized law artifact meets that ceiling by itself
with `0.83957424 SOL` of headroom. Further byte cutting is not justified merely
to chase the former 1.5 SOL peak target; reliability and retained V2 behavior
remain higher priorities. The complete retained-feature B3 aggregate must still
be measured against 3 SOL before Mainnet approval.

The new faction module and core-team cap do not fit into the existing cost claim
for free. At the measured `2.16042576 SOL` law peak, only `0.83957424 SOL`
remains under the aggregate ceiling, corresponding to roughly 60,314 additional
loader-v3 program bytes before mint/state-account rent and retained V2 modules.
A separate faction program, core-vault burn CPI, reward state, NFT accounts, or
duplicated framework runtime may exceed that headroom. No feature may be gutted
to force the number; measure the complete artifact set and report infeasibility
if it exceeds 3 SOL.

These figures cover only the B3 law program. They do not include the retained
V2 program, mint/account rent, optional Privacy Vault work, migration,
operations, RPC/indexing, or audits. Aggregate deployment funding must report
all artifacts that will actually remain on-chain.

### Loader-v4 lower-bound sensitivity

The locally pinned Solana CLI `3.1.10` exposes loader-v4, whose program account
stores one 48-byte loader state followed directly by the ELF. The pinned Agave
implementation funds that single account to rent exemption for exactly the
loader-state offset plus the ELF length. This is a useful optimistic
lower-bound check, not a Mainnet loader selection or deployment authorization:

```text
loader_v4_permanent(B) = (B + 48 + 128) * 6_960 lamports
```

Using the exact current optimized artifacts:

- retained V2 (`524,672` bytes): `3.65294208 SOL` permanent rent;
- B3 Daily Law (`154,952` bytes): `1.07969088 SOL` permanent rent;
- both binaries alone: `4.73263296 SOL` permanent rent.

Therefore the accepted `3 SOL` **aggregate** target is not achievable with the
current retained V2 binary plus the B3 law binary, even under this optimistic
single-account loader-v4 lower bound and before mint/state rent or fees. A
safe native B3 successor rewrite and a new measured artifact are required. The
code must not be gutted to force the target; if the full retained-feature
successor remains above 3 SOL, the target must be relaxed.

Primary implementation reference:
<https://github.com/anza-xyz/agave/blob/v3.1.10/programs/loader-v4/src/lib.rs>.

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
7. Attribute faction and core-cap code/state separately, then report aggregate
   peak funding rather than counting only the smallest frozen law binary.

Splitting a monolith is not automatically cheaper: duplicated framework code
can increase permanent rent, and all deployed program accounts count. Every
proposal must report aggregate permanent rent and peak funding, not only the
smallest module.

## 7. Stop condition

If a fully equivalent, independently reviewed candidate cannot meet the byte
ceiling, the target is rejected. The reliable V2 implementation remains the
reference; the code is not gutted.

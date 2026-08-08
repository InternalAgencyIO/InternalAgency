# B3 Daily Law local-validator rehearsal

Status: **DISPOSABLE LOCAL EVIDENCE ONLY**

This rehearsal exercises the optimized native Daily Law artifact against a
disposable `solana-test-validator`. It never selects Devnet or Mainnet, never
uses an owner wallet, and never retains generated key material or ledger state.
Passing it is necessary local integration evidence; it is not a Mainnet or
Devnet release authorization.

## Run

From `projects/star-ascent/site` on a host with Agave and SPL Token tooling:

```bash
bash scripts/run-iat-b3-local-rehearsal.sh --require-tools
```

The wrapper uses:

- `target/deploy/iat_b3_law.so`;
- `target/deploy/iat_b3_law-keypair.json` only to preserve the generated local
  program identity;
- a loopback RPC URL;
- fresh disposable payer, recipient, and mint keypairs;
- a temporary ledger beneath `target/` whose resolved path is checked before
  recursive removal.

The script traps success, failure, interruption, and termination, stops its own
validator process, and removes the temporary directory. Standard output is
newline-delimited JSON using schema `iat-b3-local-validator-rehearsal/v1`.
Private-key bytes, seed phrases, and filesystem paths are not included in those
records.

## Recorded run — 2026-08-08

The required-tools run passed locally with Agave `3.1.10`, SPL Token CLI
`5.5.0`, and the optimized 141,824-byte law artifact:

```text
artifact SHA-256: 50fc66ec95bc68a71e6a1288f6fb830e2a3c996bd93348f4b832de954ca6dbc4
local program id: 6c725SoXTRThCVgEFrG6q2f3GKLR5m3A7dv7Gf11hNrq
actual finalized day: open, bucket 3661 / 10000
actual selected entropy slot: 20 at finalization slot 172
```

The actual public hooked transfer moved one base unit. Missing and stale records
rejected with custom error `7`; the deterministic locked record rejected with
`8`; a same-day reroll rejected with `9`; a forged record rejected with `11`;
and direct hook execution outside Token-2022 rejected with `12`. All rejected
transfers left both token balances unchanged. The final summary reported
`publicNetworkWrites: false` and verified cleanup before reporting
`temporaryLedgerRemoved: true`.

This is immutable historical evidence for the pre-allowlist candidate. The
current optimized atomic-sealing candidate is 154,952 bytes with SHA-256
`927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c`.
It completed a fresh disposable loopback rehearsal with the expanded authority
and confidential-policy adversary. The older machine-readable record remains
bound only to its historical 141,824-byte artifact and is not rewritten.

The sanitized current-candidate record is
[`evidence/local-validator-atomic-sealing-rehearsal-20260808.json`](evidence/local-validator-atomic-sealing-rehearsal-20260808.json).

The sanitized historical run record is
[`evidence/local-validator-rehearsal-20260808.json`](evidence/local-validator-rehearsal-20260808.json).
The harness itself emits more granular newline-delimited JSON on every run.

Without `--require-tools`, missing validator, Token-2022 CLI, Node, checksum, or
local artifact prerequisites emit a machine-readable `SKIP` record and exit
successfully. This makes the rehearsal CI-optional without turning a present but
failing validator stack into a pass. With `--require-tools`, the same absence is
an error.

## Real-validator coverage

Before the valid baseline, the harness constructs an otherwise exact mint with
manual confidential-account approval. It proves initialization rejects that
configuration and commits neither PDA creation nor either authority change.

The baseline run:

1. loads the exact native `.so` at Genesis under the disposable payer, revokes
   that local upgrade authority, and verifies the program-data authority is
   absent before exercising the law;
2. creates a Token-2022 mint with Transfer Hook and Confidential Transfer mint
   extensions;
3. mints exactly `1,000,000,000,000,000,000` base units at nine decimals, leaves
   no freeze authority, and revokes mint authority;
4. derives the mint-bound law-state and validation PDAs;
5. calls `initialize_law`, verifies the serialized empty state, and proves that
   the same instruction atomically set both Transfer Hook and Confidential
   Transfer mint authorities to null while preserving the hook program,
   auto-approval, and null auditor key;
6. proves a real Token-2022 transfer rejects with `DayUnfinalized` before a
   result exists;
7. proves a direct call cannot fake Token-2022's transferring flag;
8. waits for more than the immutable 150-slot lag and calls permissionless
   `finalize_day` using on-chain `Clock` and `SlotHashes`;
9. recomputes the stored draw and verifies the chosen slot/hash is the newest
   available ancestor at or before `finalize_slot - 150`;
10. proves a same-day reroll rejects; and
11. performs a real hooked transfer if the finalized result is open, or proves
    `DailyLockdown` rejection if the actual result is selected.

The run then starts isolated validators from public-account fixtures and sends
real Token-2022 transfers through five deterministic law states:

| Fixture | Expected result |
| --- | --- |
| missing | `DayUnfinalized`, balances unchanged |
| stale | `DayUnfinalized`, balances unchanged |
| open | accepted, exactly one base unit moves |
| locked | `DailyLockdown`, balances unchanged |
| forged | `StateCorrupt`, balances unchanged |

The open, locked, and stale fixture decisions are generated with the production
Solana domain separator and exact rejection sampler. The forged fixture starts
from that valid open decision and deliberately changes its bucket. These are
synthetic state-gate vectors: they prove the deployed hook recomputes and
enforces open, locked, stale, and forged records, but they do not claim that
those records were each produced by a separate real `finalize_day` call.

## Time-boundary coverage

`solana-test-validator` exposes slot warping but not a supported command for
setting `Clock.unix_timestamp` to both sides of an arbitrary civil-time second.
The rehearsal therefore does not misrepresent slot warp as time warp. Exact
fixed-UTC+03:00 boundary evidence remains deterministic and cross-language:

```text
protocol_day(t) = floor((t + 10_800 - 60) / 86_400)
```

The harness unit test and the consensus/reference suites prove that local
`00:00:59` uses the prior protocol day and local `00:01:00` begins the next one,
including negative Unix timestamps. Runtime transfer fixtures additionally
prove that a stale stored day fails closed.

## Limits that remain

- `SlotHashes` proves the chosen value was a Solana ancestor visible to the
  executing bank. It does not expose an on-chain RPC-style commitment-finality
  certificate.
- The first successful caller can still influence which eligible lagged hash is
  selected by delaying finalization. Permissionless competition reduces but
  does not remove that timing surface.
- Fixture injection is a test-validator capability, not a production
  instruction or administrator path in the law program.
- This rehearsal covers canonical Token-2022 ownership transfers. Every ported
  B3 instruction that mutates other economic state must still invoke the shared
  law kernel directly.
- Devnet still needs transaction-size, compute-unit, fee, skipped-slot,
  congestion, confidential-transfer, rollback, and client-compatibility
  evidence before any authority can be frozen.

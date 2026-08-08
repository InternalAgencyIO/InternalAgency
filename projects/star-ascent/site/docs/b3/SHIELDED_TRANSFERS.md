# B3 IAT-wide Daily Law and optional Privacy Vault

Status: primary B3 architecture, pending exact-version Devnet prototype,
measurement, migration decision, independent review, and Mainnet approval.

The Daily Law applies to **all canonical B3 IAT ownership transfers**. Privacy
is optional. The 1% non-Friday and 66.67% Friday thresholds are unchanged.

"Privacy Vault" is the wallet-facing name for a user's optional confidential
balance on the same canonical IAT mint. It is not a second token, mixer, bridge,
or separately backed receipt.

## 1. Canonical B3 asset

B3 uses one canonical Token-2022 IAT mint with:

- fixed total supply of 1,000,000,000 IAT and nine decimals;
- no post-Genesis mint or freeze authority;
- `TransferHook` permanently bound to the immutable IAT Daily Law program;
- `ConfidentialTransferMint` enabled for opt-in confidential accounts;
- no global confidential-transfer auditor key by default.

Every public and confidential IAT ownership transfer invokes the same Daily Law
hook. Released Token-2022 code invokes Transfer Hooks for confidential transfers
without revealing the encrypted amount to the hook.

Ordinary users keep public balances and ordinary Token-2022 transfers. They do
not configure confidential accounts, generate zero-knowledge proofs, maintain
encryption keys, or pay confidential-account rent.

## 2. Optional Privacy Vault

An IAT holder may configure their token account for confidential transfers and
move IAT between that account's public and confidential balance. The mint does
not change and no wrapped asset is created.

```text
same canonical IAT mint

public IAT balance
    |  clear amount: deposit into confidential balance
confidential IAT balance (Privacy Vault mode)
    |  encrypted amount: confidential transfer
recipient confidential IAT balance
    |  clear amount: withdraw to public balance
public IAT balance
```

Incoming confidential transfers first enter the recipient's encrypted pending
balance. The recipient applies pending funds before spending them.

## 3. Privacy boundary

Hidden during a confidential IAT transfer:

- transferred IAT amount;
- sender's confidential available balance;
- recipient's confidential pending and available balances.

Still public and linkable:

- sender and recipient token-account addresses and owners;
- the canonical IAT mint and invoked programs;
- time, slot, signature, transaction type, and SOL fee;
- public IAT balances and ordinary transfers;
- amounts deposited into or withdrawn from confidential balance;
- proof-context transactions and the counterparty graph.

This is amount and balance confidentiality, not anonymity, an unlinkable mixer,
or protection against traffic analysis. B3 must never market it as anonymous.

No global auditor key is selected because one global secret could decrypt every
confidential transfer amount. Users may selectively disclose their own view
keys. Any future auditor-key proposal requires a separate owner decision and
security/legal review.

## 4. User cost

### Ordinary public IAT

Ordinary users do not pay any confidential-transfer cost. They pay the normal
Solana fee for a Token-2022 transfer plus the Daily Law hook's compute overhead.
The base fee remains signature-based; the hook requires no additional user
signature. Optional priority fees may be affected by compute requirements, so
the exact difference from an unhooked transfer must be measured on Devnet.

### Optional confidential IAT

Current Solana integration guidance implies:

- a confidential token account adds roughly 295 bytes and about `0.0015 SOL`
  of extra rent reserve at setup;
- a confidential transfer currently uses several dependent transactions for
  proof-context creation, proof verification, transfer, and context closure;
- the canonical three-transaction Rust example carries six signatures, whose
  base-fee floor at `5,000` lamports per signature is about `0.000030 SOL`;
- optional priority fees can increase actual cost;
- temporary proof-context rent is reclaimed on correct closure;
- applying pending balance is another transaction and fee;
- proof generation consumes client CPU but requires no B3 validator.

These are current-example figures, not production quotes. A fee sponsor can pay
for users, but the Solana cost still exists.

## 5. IAT-wide Daily Law

Every canonical IAT public or confidential ownership transfer supplies the
current-day record to the immutable hook. The hook:

1. reads Solana's consensus-provided `Clock` sysvar;
2. derives `floor((Clock.unix_timestamp + 10_800 - 60) / 86_400)` using
   mathematical floor division;
3. derives the fixed UTC+03:00 protocol day and Friday status, with its boundary
   at local 00:01;
4. rejects with `DAY_UNFINALIZED` if the exact current-day decision is absent;
5. rejects with `DAILY_LOCKDOWN` if the day is selected;
6. otherwise permits Token-2022 to finish the transfer.

Missing records fail closed. No canonical IAT ownership transfer can pass after
a day boundary merely because finalization is late. An open day may experience
additional downtime until the result is finalized.

All B3 application instructions that move IAT or mutate B3 economic state must
call the same law kernel directly. Token-2022 public/confidential balance
conversion is account-local bookkeeping rather than a change of owner and is not
a Transfer Hook call; it must be disclosed as outside the ownership-transfer
hook boundary unless the exact deployed Token-2022 version supplies another
enforcement mechanism.

## 6. Permissionless daily finalization

Solana programs do not execute automatically at a time boundary. Any caller may
submit `finalize_day` at or after local 00:01. The instruction:

1. requires the fixed law state not to contain a decision for the current day;
2. reads `Clock` and the recent SlotHashes sysvar;
3. selects an ancestor hash at a fixed lag using one immutable skipped-slot rule;
4. domain-separates it by law identifier, Solana genesis identity, canonical IAT
   mint, local-day number, and entropy slot;
5. applies SHA-256 rejection sampling into 10,000 buckets;
6. stores one immutable result for the day.

Buckets `0..99` select lockdown on non-Friday days. Buckets `0..6666` select it
on Friday. The mapping is exactly `100/10000` and `6667/10000` for a uniform
input, without modulo bias.

Finalization must be a separate successful transaction. If a later instruction
in the same Solana transaction failed, the stored day result would roll back.
Official clients finalize first, then continue only if the persistent record is
open. There is no operator-only finalizer, reroll call, override, or bypass.

## 7. Preserved requirements

- all V2 features remain unless explicitly cut;
- Daily Law applies to every canonical B3 IAT ownership transfer;
- exact 1% non-Friday and 66.67% Friday bucket thresholds;
- fixed UTC+03:00 label and half-open 00:01-to-00:01 protocol day;
- no external time API, NTP input, timezone database, or randomness oracle;
- permissionless public finalization and reproducible result;
- no reroll after finalization and no privileged IAT transfer bypass;
- fail-closed transfers before finalization;
- optional confidential amounts and balances on the same IAT mint;
- no IAT validator network;
- Solana consensus and read-only access continue during lockdown.

## 8. Explicitly relaxed requirements

These are the only selected Solana-hosting relaxations:

1. **Network scope:** the law is IAT-wide, not Solana-wide. SOL, unrelated
   assets, and unrelated programs continue.
2. **Decision event:** the first successful permissionless `finalize_day`
   records the result, not the first Solana block after 00:01.
3. **Randomness strength:** a lagged Solana ancestor hash replaces a threshold
   VRF. Leaders, schedulers, and prospective finalizers may have limited
   influence. The thresholds remain exact, but perfectly unbiased entropy and
   an unconditional exact realized probability are not claimed.
4. **Liveness:** all IAT transfers fail closed until somebody finalizes the day.
5. **Time:** the program uses Solana `Clock` with fixed `+03:00`, inheriting
   Solana clock drift and consensus behavior.
6. **Host-chain immutability:** the IAT program and hook configuration can be
   made immutable, but B3 inherits Solana and Token-2022 upgrades and social forks.
7. **Account-local conversion:** conversion between public and confidential
   balance does not change ownership and is not currently a Transfer Hook call.

Privacy is optional; IAT-wide ownership-transfer enforcement is not.

## 9. Existing-mint boundary

An original SPL Token mint cannot be retrofitted with Token-2022 extensions.
Therefore:

- if canonical IAT has not launched, B3 must create the canonical mint as
  Token-2022 from the beginning;
- if an original SPL canonical mint is already live, universal IAT transfer
  enforcement requires an explicitly approved, supply-reconciled migration to a
  new canonical B3 mint.

No migration, mint creation, or authority revocation is authorized by this
document. Mainnet remains HOLD until the actual chain state is independently
verified and the migration question is resolved.

## 10. Release gates

- independently determine whether a canonical live mint already exists;
- pin the exact Token-2022 and ZK proof program identities available on Mainnet;
- prove ordinary and confidential IAT transfers both invoke the hook on Devnet;
- prove public transfers pay no confidential proof or account-rent cost;
- measure hook compute, account-list, wallet, priority-fee, and compatibility
  overhead for default transfers;
- test missing, open, selected, Friday, non-Friday, consecutive-day, skipped-slot,
  delayed-finalization, rollback, replay, and direct-client paths;
- prove all B3 economic mutations use the shared gate;
- complete independent Solana, cryptographic, economic, migration, privacy, and
  legal review;
- publish reproducible binaries, mint configuration, test vectors, and evidence;
- revoke mint, hook-update, and program-upgrade authorities only after every
  Mainnet gate passes.

## 11. Primary implementation references

- Solana Confidential Transfer integration guide:
  <https://solana.com/docs/tokens/extensions/confidential-transfer/integration-guide>
- Solana Confidential Transfer transfer flow:
  <https://solana.com/docs/tokens/extensions/confidential-transfer/transfer-tokens>
- Solana transaction fees:
  <https://solana.com/docs/core/fees>
- Token-2022 source and releases:
  <https://github.com/solana-program/token-2022>
- Token-2022 confidential Transfer Hook support:
  <https://github.com/solana-program/token-2022/commit/eb579a048f0b98c3cc8c9d52076df181ba038507>
- Current onchain slot-hash access API:
  <https://docs.rs/solana-program/latest/solana_program/sysvar/slot_hashes/struct.PodSlotHashes.html>

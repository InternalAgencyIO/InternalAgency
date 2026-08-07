# B3 native confidential IAT transfers

Status: selected low-cost architecture, pending Devnet prototype, measurement,
independent security review, and explicit migration approval.

"Shielded" in this document means that transfer amounts and confidential
account balances are encrypted. It does **not** mean sender, recipient, timing,
mint, transaction type, or transaction graph anonymity.

## 1. Selected least-expensive design

B3 remains on Solana and does not operate a validator network. A new B3
Token-2022 IAT mint uses Solana's native:

- `ConfidentialTransferMint` and `ConfidentialTransferAccount` extensions;
- ZK ElGamal Proof program for equality, ciphertext-validity, and range proofs;
- `TransferHook` extension pointing permanently to the IAT Daily Law program;
- fixed supply and nine-decimal V2 arithmetic;
- no post-migration mint or freeze authority;
- no global auditor key by default.

The existing V2 mint cannot be assumed to gain extensions after creation. B3
therefore requires a separately reviewed migration to the new Token-2022 mint.
The final migration must use a supply-reconciled burn-and-mint, lock-and-mint,
or one-time snapshot procedure; this document does not silently choose custody.

This design reuses the Solana validator set, Token-2022, and native proof
verifier. The only new onchain security-critical code is the small IAT Daily
Law transfer hook and its day-record state.

## 2. What is private

For a confidential IAT transfer, public observers cannot read:

- the transferred IAT amount;
- the sender's confidential available balance;
- the recipient's confidential pending and available balances.

The owner derives or stores account-specific ElGamal and AES decryption keys.
The sender creates the proofs locally; Solana verifies correctness without
learning the plaintext amount. The recipient applies pending confidential
credits before spending them.

The following remain public and linkable:

- sender and recipient token-account addresses and their owners;
- the IAT mint and invoked programs;
- the fact, time, slot, signature, and fee of the operation;
- deposits from public to confidential balance and withdrawals back to public
  balance, including their cleartext amounts;
- every public IAT balance and ordinary public transfer;
- proof-context transactions and their relationship to the transfer;
- the public transfer graph and the boundary between public and confidential
  balances.

Therefore B3 provides amount and balance confidentiality, not anonymity, an
unlinkable mixer, or protection against traffic and graph analysis. No privacy
claim may use "anonymous" unless a later independently reviewed protocol also
hides ownership and graph information.

No global auditor key is selected because one global secret would be able to
decrypt every confidential transfer amount and would create a permanent key
concentration risk. Users may selectively disclose their own view keys. Any
future auditor-key proposal is a separate owner decision and security/legal
review, not an implementation default.

## 3. Daily Law hook

Released Token-2022 code executes the configured transfer hook for ordinary
and confidential transfers. For a confidential transfer the hook receives an
amount sentinel because it must not learn the encrypted amount. The IAT hook
does not need the amount: it only decides whether an ownership transfer is
allowed for the current day.

Every transfer supplies the canonical current-day record as an extra hook
account. The immutable hook:

1. reads Solana's consensus-provided `Clock` sysvar;
2. adds the fixed `10_800` second UTC+03:00 label without consulting a timezone
   service;
3. derives the local day and whether it is Friday;
4. rejects with `DAY_UNFINALIZED` if that exact day's record is absent;
5. rejects with `DAILY_LOCKDOWN` if the recorded day is selected;
6. otherwise allows Token-2022 to finish the public or confidential transfer.

There is no transfer gap after midnight. A stale or absent day record fails
closed, so a transfer cannot pass merely because nobody has finalized the day.
On an open day this may create extra downtime between midnight and finalization.

## 4. Permissionless daily finalization

Solana programs do not execute automatically at a wall-clock boundary. Any
caller may therefore submit `finalize_day` after local 00:00. The instruction:

1. requires the current day record to be absent;
2. reads `Clock` and the canonical recent slot-hash sysvar;
3. selects the ancestor hash at a fixed lag from the finalization slot, using a
   single specified fallback for skipped slots;
4. domain-separates the hash by law identifier, Solana genesis identity, mint,
   local-day number, and entropy slot;
5. applies the existing SHA-256 rejection sampler into 10,000 buckets;
6. records one immutable result for the day.

Buckets `0..99` select a non-Friday lockdown. Buckets `0..6666` select a Friday
lockdown. This mapping is exactly `100/10000` and `6667/10000` for a uniform
input and never uses modulo-biased reduction.

Finalization and a rejected transfer cannot be one atomic transaction: Solana
rolls back every state write when any later instruction fails. A selected-day
result must therefore be stored by a successful finalization transaction
before transfer attempts deterministically fail. The official client performs:

```text
read day record
  -> absent: submit finalize_day
  -> open: submit confidential transfer plan
  -> locked: show public proof and do not submit transfer
```

Direct callers receive `DAY_UNFINALIZED` until somebody finalizes. There is no
operator-only finalizer, fee switch, reroll call, or result override.

## 5. What the user pays

Users pay Solana fees in SOL unless the application sponsors them. There is no
additional IAT privacy fee in this design.

Current Solana integration guidance implies:

- a confidential token account adds roughly 295 bytes and about `0.0015 SOL`
  of extra rent reserve at setup; this is account funding, not a protocol fee,
  and is normally recoverable when a closable account is closed;
- a confidential transfer currently uses several dependent transactions for
  proof-context creation, proof verification, transfer, and context closure;
- the canonical three-transaction Rust example carries six signatures, whose
  base-fee floor at `5,000` lamports per signature is about `0.000030 SOL`;
- priority fees are optional and variable, so the real transfer cost can be
  higher;
- temporary proof-context rent is reclaimed when the context accounts close;
- applying a received pending balance is a further transaction and fee;
- proof generation consumes the user's device CPU but does not require a B3
  server or validator.

The `0.000030 SOL` number is an illustrative current-example floor, not a
production quote. Devnet measurements must record account setup, finalization,
transfer, apply, retry, priority-fee, and recovery behavior. A relayer may make
the wallet experience gasless, but then the project or another sponsor pays the
same Solana costs.

## 6. Requirements preserved

This profile preserves:

- all V2 features unless separately cut;
- Solana hosting with no IAT validator investment;
- fixed IAT supply and V2 arithmetic;
- native amount and confidential-balance encryption;
- client-side proof generation and native onchain proof verification;
- a permissionless, publicly reproducible daily result;
- no external time API, NTP input, timezone database, or randomness oracle;
- exact 10,000-bucket threshold mapping;
- one recorded result per day, no reroll after finalization, and no privileged
  transfer bypass;
- fail-closed transfers before finalization;
- Friday/non-Friday probabilities as protocol thresholds;
- a fixed UTC+03:00 civil-day label and selected-day transfer rejection;
- public read-only Solana, explorer, balance, and history access.

## 7. Requirements explicitly relaxed

The owner selected these relaxations to avoid a sovereign validator network:

1. **Scope:** the law is an immutable IAT transfer law, not a Solana-wide
   consensus rule. SOL, unrelated tokens, and unrelated programs continue.
2. **Decision event:** the result is recorded by the first successful
   permissionless `finalize_day` interaction after 00:00, not by the first
   Solana block after 00:00.
3. **Randomness strength:** a lagged Solana ancestor slot hash replaces a
   consensus-native threshold VRF. A leader and transaction scheduler may have
   limited influence, and a prospective finalizer can choose whether or when to
   submit. The 1% and 66.67% bucket thresholds remain exact, but B3 cannot claim
   the underlying input is perfectly unbiased or that the realized event has an
   unconditional mathematically exact probability.
4. **Liveness:** transfers fail closed until somebody finalizes the day. On an
   open day, missing or delayed finalization creates additional downtime.
5. **Time:** the hook uses Solana's validator-maintained `Clock` sysvar with a
   fixed `+03:00` offset rather than B3's own height-derived clock. It uses no
   external oracle, but inherits Solana clock drift and consensus behavior.
6. **Transaction scope:** the hook blocks IAT ownership transfers. Solana
   transactions, proof setup, reads, and protocol housekeeping still execute.
   Token-2022 public/confidential balance conversion and other Token-2022
   bookkeeping are not automatically transfer-hook calls and must not be
   described as chainwide lockdown enforcement.
7. **Immutability boundary:** the IAT hook can have its loader upgrade authority
   revoked and the hook-update authority removed, but B3 inherits Solana and
   Token-2022 upgrades and social forks. It is not immutable against changes to
   the host chain itself.

No document may claim the relaxed profile satisfies the former sovereign-chain
guarantees. Recovering first-block execution, bias-resistant threshold-VRF
randomness, and chainwide transaction invalidity requires validator-level
protocol control and the corresponding infrastructure investment.

## 8. Release gates

Before describing this feature as available:

- pin the exact deployed Token-2022 and ZK proof program identities;
- prove on Devnet that the deployed Token-2022 version invokes the IAT hook for
  confidential and ordinary transfers;
- test missing, open, selected, Friday, non-Friday, consecutive-day, skipped-slot,
  delayed-finalization, rollback, replay, and direct-client paths;
- prove a selected result cannot be overwritten and an absent record fails
  closed;
- benchmark real user fees, proof time, transaction count, and rent recovery;
- complete independent cryptographic and Solana-program audits;
- complete privacy-language, sanctions, AML, money-transmission, and jurisdiction
  review before offering a hosted interface;
- rehearse and publish exact V2-to-B3 supply reconciliation;
- revoke mint, freeze, hook-update, and program-upgrade authorities only after
  the audited binary, mint configuration, and recovery UX are final.

## 9. Primary implementation references

- Solana Confidential Transfer integration guide:
  <https://solana.com/docs/tokens/extensions/confidential-transfer/integration-guide>
- Solana Confidential Transfer transfer flow:
  <https://solana.com/docs/tokens/extensions/confidential-transfer/transfer-tokens>
- Solana transaction fees:
  <https://solana.com/docs/core/fees>
- Token-2022 source and releases:
  <https://github.com/solana-program/token-2022>
- Token-2022 change that invokes Transfer Hooks during confidential transfers:
  <https://github.com/solana-program/token-2022/commit/eb579a048f0b98c3cc8c9d52076df181ba038507>
- Current onchain slot-hash access API:
  <https://docs.rs/solana-program/latest/solana_program/sysvar/slot_hashes/struct.PodSlotHashes.html>

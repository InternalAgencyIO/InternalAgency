# Optional IAT Privacy Vault

Status: selected opt-in architecture, pending Devnet prototype, measurement,
independent security review, and explicit deployment approval.

Ordinary IAT remains the canonical V2 SPL token with its existing transaction
path and cost. No holder is required to use the vault, create a Token-2022
account, generate a proof, or pay a privacy-related fee.

"Shielded" means that transfers inside the optional vault hide amounts and
vault balances. It does **not** mean sender, recipient, timing, transaction
graph, vault entry, or vault exit anonymity.

## 1. Selected least-expensive design

B3 remains on Solana and does not operate validators. The optional IAT Privacy
Vault uses two assets:

1. **IAT:** the unchanged canonical V2 SPL token. Ordinary transfers remain the
   default and retain ordinary SPL transaction cost and compatibility.
2. **vIAT:** an opt-in Token-2022 vault receipt. Each vIAT base unit is backed
   1:1 by one canonical IAT base unit held in the immutable vault escrow.

The vault creates and redeems vIAT only against an equal escrow movement. Its
mint authority is a program-derived address, not a human or administrator. The
vault program enforces:

```text
vIAT total supply == canonical IAT held in vault escrow
```

The vIAT mint uses Solana's native:

- `ConfidentialTransferMint` and `ConfidentialTransferAccount` extensions;
- ZK ElGamal Proof program for equality, ciphertext-validity, and range proofs;
- `TransferHook` extension pointing to the IAT Vault Daily Law hook;
- no global auditor key by default.

The project deploys only the vault/wrapper and small law hook. Solana's existing
validator set, Token-2022, and proof verifier supply the expensive shared
infrastructure. Default IAT does not invoke these programs.

## 2. User flow

```text
ordinary IAT holder
  |-- ordinary transfer --------------------> ordinary IAT holder
  |
  +-- deposit clear amount into vault
          -> receive equal vIAT
          -> move amount into confidential balance
          -> confidential vIAT transfers
          -> move amount back to public vIAT
          -> redeem clear amount
          -> receive equal ordinary IAT
```

Deposit and redemption are public because the vault must prove 1:1 backing.
Transfers between configured confidential vIAT accounts use client-generated
zero-knowledge proofs and encrypted balances.

## 3. What is private

For a confidential vIAT transfer, public observers cannot read:

- the transferred vIAT amount;
- the sender's confidential available balance;
- the recipient's confidential pending and available balances.

The following remain public and linkable:

- sender and recipient token-account addresses and their owners;
- the IAT and vIAT mints and invoked programs;
- the fact, time, slot, signature, and SOL fee of the operation;
- the amount and account entering or leaving the vault;
- the amount moved between public and confidential vIAT balance;
- every ordinary IAT balance and transfer;
- proof-context transactions and their relationship to the transfer;
- the public transfer graph.

This is amount and balance confidentiality inside the vault, not anonymity, an
unlinkable mixer, or protection against traffic and graph analysis. No public
claim may call it anonymous.

No global auditor key is selected because one global secret could decrypt every
confidential vIAT transfer amount. Users may selectively disclose their own view
keys. Any future auditor-key proposal requires a separate owner decision and
security/legal review.

## 4. Who pays

### Default IAT users

Nothing changes. They pay only the normal Solana fee for the transactions they
already use. They do not fund confidential-account rent or proof transactions.

### Opt-in vault users

Vault users pay Solana fees in SOL unless an application sponsor pays them.
There is no additional IAT-denominated privacy fee in the baseline.

Current Solana integration guidance implies:

- a confidential token account adds roughly 295 bytes and about `0.0015 SOL`
  of extra rent reserve at setup; this is account funding, not a protocol fee,
  and is normally recoverable when a closable account is closed;
- a confidential transfer currently uses several dependent transactions for
  proof-context creation, proof verification, transfer, and context closure;
- the canonical three-transaction Rust example carries six signatures, whose
  base-fee floor at `5,000` lamports per signature is about `0.000030 SOL`;
- priority fees are optional and variable, so the actual cost can be higher;
- temporary proof-context rent is reclaimed when context accounts close;
- applying a received pending balance is another transaction and fee;
- deposit and redemption are additional ordinary transactions;
- proof generation consumes the user's device CPU but requires no B3 validator.

The `0.000030 SOL` figure is an illustrative current-example floor, not a quote.
Devnet measurements must publish setup, deposit, transfer, apply, redemption,
retry, priority-fee, and rent-recovery behavior. Gas sponsorship moves the cost
to the sponsor; it does not eliminate the Solana fee.

## 5. Vault Daily Law

Released Token-2022 code executes a configured Transfer Hook for ordinary and
confidential Token-2022 transfers. For confidential transfers it passes an
amount sentinel, so the hook does not learn the encrypted amount.

Every vIAT transfer supplies the current-day record. The immutable hook:

1. reads Solana's consensus-provided `Clock` sysvar;
2. adds the fixed 10,800-second UTC+03:00 label;
3. derives the local day and Friday status;
4. rejects with `DAY_UNFINALIZED` if the exact day record is absent;
5. rejects with `DAILY_LOCKDOWN` if the day is selected;
6. otherwise permits the vIAT transfer.

Vault deposit and redemption instructions call the same gate directly. A stale
or absent day record fails closed for every vault value movement, so delayed
finalization cannot create a vault transfer gap. It can create extra vault
downtime on an open day.

The default canonical IAT token does not have this hook. Canonical IAT transfers
outside the vault continue even when the vault is locked. This is the explicit
cost/compatibility tradeoff selected by making privacy optional.

## 6. Permissionless finalization

Solana programs do not execute automatically at midnight. Any caller may submit
`finalize_day` after local 00:00. The instruction:

1. requires the current day record to be absent;
2. reads `Clock` and the canonical recent SlotHashes sysvar;
3. selects an ancestor hash at a fixed lag using one specified skipped-slot
   fallback;
4. domain-separates it by law identifier, Solana genesis identity, vIAT mint,
   local-day number, and entropy slot;
5. applies SHA-256 rejection sampling into 10,000 buckets;
6. records one immutable result for the day.

Buckets `0..99` select a non-Friday lockdown. Buckets `0..6666` select a Friday
lockdown. The mapping is exactly `100/10000` and `6667/10000` for a uniform
input and has no modulo bias.

Finalization must succeed as a separate transaction. If a later instruction in
the same Solana transaction failed, the day write would roll back. Official
clients finalize first, then continue only when the stored result is open.

## 7. Requirements preserved

- all V2 features remain unless separately cut;
- canonical IAT, wallet compatibility, and default transaction cost stay
  unchanged;
- no IAT validator network;
- optional native Token-2022 encrypted amounts and confidential balances;
- 1:1 public backing between vIAT supply and escrowed canonical IAT;
- client-side proofs and native Solana proof verification;
- no external time API, NTP input, timezone database, or randomness oracle;
- exact 10,000-bucket threshold mapping;
- one persistent result per day and no reroll after finalization;
- no administrator vault bypass;
- fail-closed vault movements before finalization;
- public read-only Solana, explorer, balance, and history access.

## 8. Requirements explicitly relaxed

1. **Optional scope:** the Daily Law controls vIAT and vault entry/exit, not
   ordinary canonical IAT transfers outside the vault.
2. **Network scope:** the law is not a Solana-wide consensus rule. SOL,
   unrelated tokens, and unrelated programs continue.
3. **Decision event:** the first successful permissionless `finalize_day`
   records the result, not the first Solana block after 00:00.
4. **Randomness strength:** a lagged ancestor slot hash replaces a threshold
   VRF. Leaders, schedulers, and prospective finalizers may have limited
   influence. Thresholds remain exact, but perfectly unbiased entropy and an
   unconditional exact realized probability are not claimed.
5. **Liveness:** vault movements fail closed until somebody finalizes the day.
6. **Time:** the vault uses Solana `Clock` with fixed `+03:00`, inheriting Solana
   clock drift and consensus behavior.
7. **Immutability boundary:** the vault and hook can have loader authorities
   revoked, but they inherit Solana and Token-2022 upgrades and social forks.
8. **Privacy boundary:** amounts and confidential balances are hidden inside
   vIAT; addresses, graph, entry, and exit remain public.

No document may claim this optional profile stops all canonical IAT transfers.
Doing so while retaining unchanged default SPL-token transfers is technically
impossible. Universal IAT enforcement requires migrating the canonical mint to
a hooked Token-2022 mint; chainwide enforcement requires validator-level control.

## 9. Release gates

- prove exact deployed Token-2022 and ZK proof program identities;
- prove ordinary and confidential vIAT transfers invoke the hook on Devnet;
- prove every deposit and redemption executes the same Daily Law gate;
- prove `vIAT supply == escrowed IAT` after every success and rollback path;
- test missing, open, selected, Friday, non-Friday, consecutive-day, skipped-slot,
  delayed-finalization, replay, and direct-client paths;
- benchmark actual user fees, proof time, transaction count, and rent recovery;
- independently audit vault custody, mint authority PDA, law hook, cryptography,
  client key recovery, and migration-free default behavior;
- complete privacy-language, sanctions, AML, money-transmission, tax, and
  jurisdictional review before offering a hosted vault interface;
- revoke vault and hook program authorities only after the final reviewed
  binaries, configuration, and recovery UX are reproducible.

## 10. Primary implementation references

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

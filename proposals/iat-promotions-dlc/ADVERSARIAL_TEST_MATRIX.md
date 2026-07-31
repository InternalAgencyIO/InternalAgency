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
| Same node earns different roles once each | same | Accepted; role limits remain independent |
| 1,000 completed pairs | `exactly 1,000 pairs...` | Exactly 180,000 IAT spent; vault reaches zero |
| Attempted pair 1,001 | same | Permanently rejected |
| Two candidates for final slot | `the final slot is serialized...` | First canonical settlement wins; other expires unpaid and releases reservations |
| Work after terminal state | final two tests | Rejected; state remains unchanged |

## Next matrix expansion

- randomized model sequences and invariant checking;
- duplicate tests for every node/wallet/X and hero/proposer combination;
- nomination cancellation versus settlement ordering;
- verifier purpose, campaign, expiry, and nonce fuzzing;
- malformed integer and overflow boundaries;
- transparency-log root and attestation-signature verification; and
- local-validator transaction rollback and account-lock contention.

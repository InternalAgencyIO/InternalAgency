# Positive campaign-vector representation audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This proposal-only audit replays all 256 seeded negative intake cases and
commits to each exact ordered input without storing full candidate or result
objects. It creates no positive signature, review receipt, key, wallet request,
network action, or activation authority.

## Expected result

- all 256 insertion-order-sensitive input commitments are unique;
- 231 canonical input commitments are unique;
- exactly one canonical equivalence class contains more than one case;
- that class contains the 26 `EXPECTED_TARGET` key-order permutations only;
- the 26 ordered commitments remain distinct; and
- every case remains rejected with effect `NONE`.

Canonical JSON intentionally erases object insertion order. The separate
ordered commitment proves that each tested representation is distinct while
retaining the canonical hash used by the intake contract. Any other canonical
collision or any repeated ordered commitment fails both validators.

## Compact evidence

`positive-campaign-vector-representation-audit.v1.json` stores source and
record commitments, class sizes, the one expected collision-class membership,
and permanent non-authority flags. A domain-separated binary Merkle tree binds
all 256 records in numeric index order. The artifact publishes an eight-step
inclusion proof for each of the 26 expected collision members and no proof for
an accepted vector. Each proof and the ordered proof set have separate
canonical commitments.

The tree uses SHA-256, distinct leaf and node domains, raw 32-byte digests, and
duplicate-final-node handling for odd levels. Changing a record, index, sibling,
side, path order, proof commitment, root, or proof-set commitment fails closed.

A deterministic minimal multiproof covers those same 26 records with 84 proof
nodes instead of the 208 nodes carried by 26 independent eight-step paths. Its
node coordinates are derived solely from the sorted membership indices. Every
node must be connected, uniquely required, and in canonical level/index order;
missing, redundant, reordered, changed, disconnected, or incomplete evidence
fails. The multiproof commitment binds membership, nodes, minimality,
individual-proof equivalence, and permanent non-authority.

The proposal-only test suite also derives 96 unique property subsets spanning
one through 256 selected records. Fixed boundary sizes and deterministic
odd-stride layouts cover 10,579 selected memberships without publishing any
expanded input or result corpus. A separate pairwise tree oracle derives the
required coordinates without calling the multiproof builder. Across the
compact suite, 84,632 repeated individual-path nodes reduce to 6,554 minimal
multiproof nodes, saving 78,078 nodes. The ordered subset set is committed as
`55b6dfca7e24fe93a18ee1a0e45b5086d27ca0f07ec778e283e67953b6582abb`.
Every case verifies in forward and reverse membership order and rejects bad
roots, duplicate or out-of-range members, missing members, and missing,
redundant, changed, or reordered proof nodes.

It does not store the 256 full inputs or results. Node regenerates the artifact;
Python independently rebuilds every record, collision class, tree root, and
individual or aggregate proof from the base vectors and fixed seed.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-representation-audit.mjs --write
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-representation-audit.mjs
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-representation-audit --format json
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-representation-audit.test.mjs
```

These commands are offline verification only. They cannot deploy, sign,
broadcast, move tokens, issue a receipt, complete review, or enable a claim.

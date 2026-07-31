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
individual-proof equivalence, the exact 256-leaf tree size, and permanent
non-authority. The tree size is also required to equal the artifact summary
case count.

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

A second compact property suite covers 79 subsets across 15 odd tree sizes
from one through 257 leaves. It exercises 2,893 selected records and every
duplicate-final-node level, matches an independently implemented root and
coordinate oracle, and reduces 21,873 individual-path nodes to 908 multiproof
nodes, saving 20,965. Its case-set commitment is
`937771b307fe23379f7c4840017f1ce7e832186cbd9dfd1420720731624ed354`.
Because duplicate-final-node Merkle roots alone can alias an odd `N`-leaf tree
with a misdeclared `N + 1` tree, the verifier contract never treats the root as
a leaf-count commitment. The canonical multiproof separately binds
`treeLeafCount`, and validation requires it to equal the independently replayed
record count and summary count.

The compact odd-width summary is generated independently in Node and Python.
Both runtimes derive the same 79 cases, 15 tree sizes, 2,893 memberships,
21,873 individual nodes, 908 multiproof nodes, 20,965-node saving, 18 known
root-only width aliases, and case-set commitment. The expanded cases remain
runtime-only. A changed summary commitment or tree-size binding fails the
independent Python replay.

The boundary suite then evaluates `N - 1`, exact `N`, and `N + 1` for every
odd-width property case: 237 deterministic outcomes. Raw multiproof mechanics
accept 20 mismatched widths (two below and 18 above) because duplicate-final
geometry can alias proofs, while the explicit count binding accepts all 79
exact candidates and rejects all 158 mismatches. Fourteen of the 15 distinct
odd trees also share a raw root with an explicitly duplicate-padded `N + 1`
tree. Root evidence and committed tree sizes therefore use separate
commitments: `8662b7f1e1b87dc81d648cefb9fcd847821346ee304792d3b5ce42b32a362d1e`
for roots and `759111eb0bb4d9848edc2e3d556093ad98cdd1682bbc5d8c110648c8331738df`
for counts. The compact outcome set is
`72c8cbf74755b88862b57d58d15a63189740cb5b4d65b3c8324f8bd1eea219d9`.
Node and Python reproduce all three independently; expanded mutations remain
runtime-only and authority-negative.

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

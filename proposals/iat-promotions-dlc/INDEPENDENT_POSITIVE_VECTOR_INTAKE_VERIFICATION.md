# Independent positive-vector intake verification

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

`verify-positive-campaign-vector-intake.py` is a second, zero-dependency
implementation of the external positive campaign-vector intake boundary. It
does not call the Node evaluator. It independently reproduces the published
schema diagnostics, canonical campaign message, Ed25519 result, eight ordered
gates, and fixed non-authority output for all ten public scenarios.

The Python verifier reads only local public proposal files. It cannot write a
file, use a network or wallet, create a key or signature, issue a receipt,
complete review, deploy code, or authorize activation.

## Independent cryptographic control

Python's standard library has no Ed25519 API, so this verifier implements only
the public verification operation over the fixed Ed25519 group. There is no
key-generation or signing operation. Before accepting the rejection corpus it
must independently verify both public RFC 8032 section 7.1 positive controls.

It then reconstructs each campaign attestation message from the closed public
envelope and verifies the detached signature against the independently
supplied public key. The baseline and every public variant remain rejected
because their RFC signatures authenticate different messages.

## Reproduced boundaries

For each scenario the verifier independently checks:

- the Draft-07 subset used by the closed intake schema, including exact JSON
  Pointer and schema-pointer diagnostics;
- exact expected-target key order, types, and fixed-width public hashes;
- recursive exclusion of secret-bearing field names;
- external provenance and source-artifact binding;
- exact canonical campaign-message bytes and SHA-256 digest;
- detached Ed25519 verification;
- separately supplied positive-vector and independent-review state; and
- permanent non-authority for receipts, review completion, and activation.

It also independently checks the canonical hashes of the campaign-vector and
intake-schema artifacts, the normalized evaluator-source digest, fixed HOLD
metadata, the ten-case count, and the exact eight-gate order.

## Exit contract

- `0`: the complete public rejection corpus reproduces;
- `2`: a vector, result, source binding, primitive control, gate, or HOLD
  invariant is invalid; and
- `1`: invalid offline usage or a file, UTF-8, or JSON error.

No exit state carries authority beyond reporting verification results.

## Offline command

```sh
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-vectors --format json
```

Expected public summary:

```json
{
  "valid": true,
  "errors": [],
  "scenarioCount": 10,
  "positivePrimitiveControlCount": 2,
  "receiptIssued": false,
  "reviewCompleted": false,
  "activationAuthorized": false,
  "activationEffect": "NONE"
}
```

This confirms only that both implementations agree on the published HOLD and
rejections. It does not provide the absent external positive campaign vector
or its independent review.

The verifier also supports the separately content-bound twenty-case mutation
corpus:

```sh
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-differential-vectors --format json
```

That mode independently reproduces every complete Node gate result and returns
exit `2` if any mutation evidence or source binding drifts.

The same verifier also independently replays the seeded compact fuzz corpus:

```sh
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-fuzz-vectors --format json
```

That mode rebuilds all 256 inputs and complete results from seed `49544154`,
checks their compact commitments and domain-separated Merkle root, and requires
exact Node/Python parity. It returns exit `2` for any changed case, source
binding, family count, authority constant, or root. It creates no positive
signature or review material.

The ten reduced one-family counterexamples have a separate mode:

```sh
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-minimal-counterexamples --format json
```

It independently rebuilds each control and one-semantic-delta mutation,
including the insertion-order-sensitive target commitment. Any fixture or set
commitment drift exits `2`; no control or mutation is accepted.

The compact representation audit has a fifth mode:

```sh
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-representation-audit --format json
```

It reconstructs all 256 ordered inputs, requires 256 unique ordered
commitments, and independently confirms that the only canonical collision is
the expected 26-case target-key-order class. It stores no full input or result
expansions and grants no receipt, review, or activation authority.

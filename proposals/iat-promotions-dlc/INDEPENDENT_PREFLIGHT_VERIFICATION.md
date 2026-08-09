# Independent reviewer-input preflight verification

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

`verify-reviewer-bundle-preflight.py` is a zero-dependency Python 3
implementation of the exact Draft-07 subset and diagnostic contract used by
the Node reviewer-input preflight. It exists so a reviewer can reproduce the
public structural results without trusting the JavaScript implementation.

It reads only local JSON files. It does not perform the six semantic review
gates, establish target authenticity, verify or create a signature, issue a
receipt, complete a review, access a wallet or network, or authorize
activation.

## Fixed cross-runtime contract

For each of the ten public scenarios, Python must reproduce the complete Node
result object, including:

- structural validity and semantic-evaluation permission;
- document ordering and validity;
- every instance JSON Pointer, schema pointer, Draft-07 keyword, message, and
  diagnostic order;
- the same normalized Markdown table output; and
- false receipt, review-completion, and activation fields with effect `NONE`.

The supported schema subset is deliberately limited to the keywords used by
the fixed candidate and expected-target schemas: local `$ref`, `const`, `enum`,
`type`, `pattern`, string lengths, array bounds, uniqueness, tuple/list items,
required properties, named properties, and closed objects. This is not a
general-purpose JSON Schema engine.

## Offline commands

Verify every published vector:

```sh
python proposals/iat-promotions-dlc/verify-reviewer-bundle-preflight.py --verify-vectors --format json
```

Preflight two separately supplied local files:

```sh
python proposals/iat-promotions-dlc/verify-reviewer-bundle-preflight.py \
  --candidate candidate.json \
  --expected-target expected-target.json \
  --format markdown
```

Input mode returns exit `0` for structurally valid input, exit `3` for
structural rejection, and exit `1` for usage, file, encoding, or JSON errors.
Vector-verification mode returns exit `0` only when all published results
reproduce exactly; any changed diagnostic returns exit `1`.

Structural exit `0` is not review acceptance. A separate semantic evaluator
and future independent attestation are still required, and neither grants
activation authority.

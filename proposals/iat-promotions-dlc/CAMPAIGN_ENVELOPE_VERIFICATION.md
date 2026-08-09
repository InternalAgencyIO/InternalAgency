# Campaign-envelope signature verification boundary

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This increment connects the canonical campaign attestation envelope to a real,
verify-only Ed25519 adapter without creating a key or signature. The only valid
signatures in the public corpus are copied from RFC 8032 section 7.1 tests 1
and 2, with their private material omitted.

Those RFC signatures are valid positive controls for the cryptographic
primitive. They are deliberately unrelated to the campaign-envelope message,
so both must fail against the exact canonical envelope. This is a
rejection-only integration surface, not proof that a campaign envelope has
been externally signed.

## Public cases

`campaign-envelope-verification-vectors.v1.json` publishes:

- two externally sourced RFC Ed25519 positive primitive controls;
- two exact-envelope negative controls, one for each unrelated RFC signature;
- eleven canonical field mutations that rebuild a valid unsigned envelope and
  reach the signature gate;
- one changed-signature and one substituted-public-key rejection; and
- four ordered pre-signature guards for domain, scheme, version, and
  attestation-ID drift.

Every campaign case remains rejected. Every result fixes receipt issuance,
review completion, and activation authority to false, with activation effect
`NONE`.

## Honest positive-vector HOLD

No valid campaign-envelope signature is published. A positive case requires a
separately supplied, independently reviewed public vector containing only:

- the already-public canonical envelope and exact signing-message bytes;
- an externally controlled public key and accountability label;
- a detached signature over exactly those bytes; and
- source/provenance evidence sufficient for independent reproduction.

The repository must never receive a private key, seed, mnemonic, signing
request, wallet prompt, or generated signing material. Until a positive public
vector passes a separate review, `positiveCampaignIntegrationBlocked` remains
true and no deployment or activation inference is permitted.

The closed intake schema, independently supplied target boundary, fixed gate
order, and rejection-only adversarial corpus are specified in
[`POSITIVE_CAMPAIGN_VECTOR_INTAKE.md`](./POSITIVE_CAMPAIGN_VECTOR_INTAKE.md).
That intake does not relax this HOLD and does not create signing or review
material.

## Offline reproduction

```sh
node proposals/iat-promotions-dlc/generate-campaign-envelope-verification-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-campaign-envelope-verification-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/campaign-envelope-verification.test.mjs
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake.test.mjs
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-vectors --format json
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-differential-vectors --format json
```

The generator only assembles canonical envelopes, copies public RFC material,
and mutates public bytes for rejection tests. It does not sign.

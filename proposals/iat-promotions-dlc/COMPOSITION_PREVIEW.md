# Held full-interface composition preview

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

`program-interface-composition-preview.v1.json` is a deterministic review
artifact. It is not an IDL, binary, deployed program, upgrade proposal,
transaction, wallet request, or release authorization.

## What is composed

The preview starts from `program-interface.v0.json` and applies only the exact
delta declared by `program-interface-key-lifecycle-amendment.v1.json`:

1. replace the Campaign account's 32-byte inline verifier key with the 32-byte
   verifier-registry public key;
2. remove the obsolete verifier-key argument from `initialize_campaign`;
3. insert `verifier_registry` and `verifier_key_record` as read-only accounts
   immediately before `instructions_sysvar` on nomination, cancellation, and
   settlement;
4. append all seven issuance-time registry/key guards to those instructions;
5. append the three lifecycle account layouts and five lifecycle instructions;
   and
6. union the forbidden-capability declarations without removing any boundary.

The Campaign account size remains unchanged. Registry initialization is a
separate proposed instruction after campaign initialization; no public key is
stored or accepted by the base initializer in the preview.

## Reproducibility and drift rejection

The preview records canonical SHA-256 digests for the base interface, lifecycle
amendment, base vectors, and lifecycle vectors. The composer preserves each
source's discriminator domain and rejects duplicate account names, instruction
names, or discriminators across the composed surface.

`program-interface-composition-vectors.v1.json` is a second derived artifact
covering all thirteen composed instructions. It removes exactly the obsolete
32-byte `verifier_ed25519_key` value from the initializer fixture, then
re-encodes every vector against the composed instruction data. This closes the
otherwise-valid-looking drift where the preview and inherited v0 initializer
vector had different lengths.

Run:

```sh
node proposals/iat-promotions-dlc/validate-program-interface-composition.mjs
node --test proposals/iat-promotions-dlc/tests/program-interface-composition.test.mjs
```

The validator recomposes the entire JSON object and requires exact equality. It
also independently checks the HOLD labels, source/vector coverage, read-only
attestation dependencies, required guards, forbidden writable external
accounts, and composed-vector discriminator, length, byte, and round-trip
agreement.

`node proposals/iat-promotions-dlc/compose-program-interface-preview.mjs
--write` is proposal-local deterministic code generation. It performs no
network, chain, wallet, signing, secret, deployment, or production operation.
The composed-vector generator has the same boundary and must run before the ABI
offset-manifest generator.

## Release boundary

The preview explicitly carries `deployable: false`, `baseV0Deployable: false`,
`amendmentApplied: false`, and `compositionApplied: false`. A matching preview
does not satisfy independent review, governance, deterministic binary build,
public artifact hash, Devnet rehearsal, or a separate mainnet decision.

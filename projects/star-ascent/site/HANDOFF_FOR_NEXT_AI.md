# STAR ASCENT handoff — 2026-07-29

## Current public surfaces

- English: `https://internalagency.io`
- Turkish: `https://ileriakil.com`
- Sites source project: `appgprj_6a665e190c9081918cfdd3f9f121087a`
- GitHub mirror: `https://github.com/InternalAgencyIO/InternalAgency`

## Confirmed on-chain information

- Trezor Model T public Solana address: `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`
- It received `0.52973258 SOL` successfully on mainnet in transaction `5aPpv6jBUXQaQPZnGUEwXQ5gKVHfTZWuMAffn2VXRDEMn9RSjr2BDwtP4dYVynd9MaVRafBzx5snHWfW9mMW5EdY`.
- No IAT mint transaction has been created, signed, or deployed.

## Locked launch scope

- Original SPL Token Program, 9 decimals, fixed supply `1,000,000,000 IAT` / `1,000,000,000,000,000,000` base units.
- After the one mint: revoke mint authority and freeze authority.
- Allocation targets: community 50%, treasury 20%, ecosystem 15%, core team 10%, liquidity 5%.
- Genesis Gift: 100 IAT for first 1,000 verified nodes, from community allocation, remains HOLD until a reviewed claim program exists.
- No claim, yield, CCC election, associates, or smart-contract country enforcement is live.

## Website/service state

- Wallet proof, country-selection, X OAuth PKCE, rewards policies, D1 schemas, and preflight checks exist in source.
- Country selection is intended immutable per node, but no on-chain CCC program is deployed.
- X OAuth requires deployment secrets: `X_CLIENT_ID`, `X_OAUTH_STATE_SECRET`, `X_OAUTH_REDIRECT_URI`.
- The local `/mint` operator console implements the exact four-transaction devnet/mainnet shape, immutable Metaplex metadata, five allocations, on-chain recovery, public-evidence export, and a generated digest interlock.
- Signing controls are localhost-only. A deployed `/mint` route is read-only and cannot connect Backpack or request a signature.
- Mainnet remains `LOCKED`: metadata, allocation-lock, signer, devnet, handoff, and release-packet human evidence is incomplete.
- The open-source ceremony window is scheduled for 29 July 2026 at
  `15:00:00 UTC` / `18:00:00 Istanbul`. The countdown opens a public window
  only; it never signs, submits, or authorizes mainnet.

## Immediate risks / instructions

- Never ask for or store seed words, private keys, PIN, passphrase, or Trezor recovery data.
- Do not use unreviewed token creator sites or approve unexplained Backpack/Model T transactions.
- Do not claim mint/authority/claim facts publicly until Explorer evidence exists.
- Solana CLI and `spl-token` were not installed in the local shell at last check.
- Existing public documents use HOLD templates for all unverified chain evidence.

## Useful commands

- Build: `pnpm exec vinext build`
- Public routes: `node scripts/check-public-launch-routes.mjs`
- Full local preflight: `node scripts/run-launch-preflight.mjs`
- Generated mint interlock: `node scripts/generate-mint-ceremony-config.mjs`
- Mint ceremony tests: `node --test tests/mint-ceremony.test.mjs`

## User communication preferences

- English only in direct conversation.
- User expects frequent, verbose status updates during active work.
- User wants public GitHub `main` visibility, but do not overwrite unrelated Radiance work.

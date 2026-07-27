# Repository Protocol

## Public archive rules

- Commit source changes in small, descriptive increments.
- Keep artwork in `public/images/` with versioned filenames.
- Keep legacy source material in `archive/public-disclosures/source/`; public routes resolve through the designed Dossier reader.
- Preserve established public paths; add compatible redirects instead of breaking traffic.
- Record material public-facing changes in `CHANGELOG.md`.

## Never publish

- API keys, access tokens, passwords, recovery phrases, or private keys.
- User wallet addresses or personal information unless the owner has explicitly authorized it and there is a clear public purpose.
- A claim that a token was minted, an authority revoked, a lock created, or a claim opened without direct public evidence.

## Release checklist

1. Build passes locally.
2. Direct document links resolve in both languages.
3. Mobile reading flow is checked.
4. No interface asks for a seed phrase, private key, transfer, or token approval.
5. Commit, changelog, and public deployment correspond to the same source state.

# Daily rewards launch gate

The 100 IAT Genesis claim and 00:00 UTC daily X participation claims remain **HOLD** until all checks below pass.

- [ ] Official X handle and campaign tag entered in the policy.
- [ ] X developer app approved; OAuth callback and production secrets configured outside the repository.
- [ ] One-to-one X account / Solana wallet binding passes on devnet.
- [ ] Daily snapshot scheduler, scorer, Merkle generator, and manifest publisher pass a full devnet epoch rehearsal.
- [ ] Claim proof verifies against the published root.
- [ ] Distributor wallet is distinct from treasury, capped, funded only after rehearsal, and has a documented incident stop switch.
- [ ] Token mint, decimals, total supply, mint authority state, and freeze authority state are independently verified and published.
- [ ] Proof Board has a verified Genesis record before any Genesis claim announcement.

Until every box passes, the public copy must say that rewards are planned and not active.

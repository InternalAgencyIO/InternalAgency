# CCC country entry policy

At launch, a verified node must select exactly one ISO 3166-1 country before its Genesis entrance record can become active. The selected country is mandatory, visible in the node record, and can be changed only through a later public policy update.

A node may hold one CCC Agency country only. The system enforces one country selection per active node binding; it does not establish real-world identity, nationality, residency, or one-human-per-account status. Distinct verified X accounts are treated as distinct node identities, subject to the published one-wallet and one-X-account binding rules.

Country selection, wallet proof, X binding, and Genesis slot reservation are separate checks. A selection never creates a claim, transfer, election, legal status, or authority. Any future contract-enforced CCC rule must be published with its program address, source, deployment transaction, and independent verification path before it is described as on-chain.

If a published CCC rule leaves two or more candidates exactly equal, the
universal IAT tiebreak applies. The system commits the complete canonically
ordered tied set before requesting one Switchboard commit-reveal result, then
uses domain-separated SHA-256 counter expansion and exact-uniform rejection
sampling to select one final index. The candidate commitment, randomness
account, commit slot, reveal, derivation counter, winning index, and settlement
transaction must be public. There is no operator reroll. The process starts
immediately and becomes final on the committed reveal; normal network and
oracle latency still applies.

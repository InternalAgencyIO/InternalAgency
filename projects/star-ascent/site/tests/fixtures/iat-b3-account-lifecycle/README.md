# B3 account-lifecycle local-validator fixture

This fixture exposes one deliberately isolated local-validator ABI around the
feature-gated `iat-b3-economy` account-lifecycle primitive. It exists only to
prove real System Program CPI, canonical PDA signing, sealed postimage writes,
prefunded allocate/assign/fund behavior, and Solana transaction rollback.

The fixture is not a production handler, deployment candidate, Devnet or
Mainnet identity, instruction ABI, or release authorization. Its Daily Law
account uses a source-bound synthetic open-decision fixture for the validator's
current protocol day. Production Daily Law identity and evidence remain
blocked and Mainnet remains HOLD.

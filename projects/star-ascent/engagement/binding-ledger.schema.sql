CREATE TABLE IF NOT EXISTS node_bindings (
  id TEXT PRIMARY KEY,
  x_user_id TEXT NOT NULL UNIQUE,
  x_username TEXT NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  wallet_challenge_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'revoked', 'held')),
  verified_at_utc TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS genesis_slots (
  slot_number INTEGER PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 1000),
  node_binding_id TEXT NOT NULL UNIQUE REFERENCES node_bindings(id),
  amount_base_units TEXT NOT NULL,
  reserved_at_utc TEXT NOT NULL,
  claim_state TEXT NOT NULL CHECK (claim_state IN ('reserved', 'published', 'claimed', 'held', 'expired'))
);

CREATE TABLE IF NOT EXISTS reward_epochs (
  id TEXT PRIMARY KEY,
  starts_at_utc TEXT NOT NULL UNIQUE,
  ends_at_utc TEXT NOT NULL UNIQUE,
  policy_hash TEXT NOT NULL,
  mint_address TEXT NOT NULL,
  merkle_root TEXT,
  manifest_digest TEXT,
  eligible_wallet_count INTEGER NOT NULL DEFAULT 0,
  total_claimable_base_units TEXT NOT NULL DEFAULT '0',
  state TEXT NOT NULL CHECK (state IN ('collecting', 'held', 'published', 'closed')),
  published_at_utc TEXT
);

CREATE TABLE IF NOT EXISTS reward_claims (
  id TEXT PRIMARY KEY,
  epoch_id TEXT NOT NULL REFERENCES reward_epochs(id),
  node_binding_id TEXT NOT NULL REFERENCES node_bindings(id),
  wallet_address TEXT NOT NULL,
  amount_base_units TEXT NOT NULL,
  source_post_ids_json TEXT NOT NULL,
  leaf_hash TEXT,
  proof_json TEXT,
  state TEXT NOT NULL CHECK (state IN ('eligible', 'held', 'claimed', 'expired')),
  claim_transaction TEXT,
  created_at_utc TEXT NOT NULL,
  claimed_at_utc TEXT,
  UNIQUE(epoch_id, node_binding_id),
  UNIQUE(epoch_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS node_bindings_state_idx ON node_bindings(state);
CREATE INDEX IF NOT EXISTS reward_epochs_state_idx ON reward_epochs(state);
CREATE INDEX IF NOT EXISTS reward_claims_epoch_state_idx ON reward_claims(epoch_id, state);

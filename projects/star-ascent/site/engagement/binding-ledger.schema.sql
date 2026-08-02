CREATE TABLE IF NOT EXISTS node_bindings (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  x_user_id TEXT UNIQUE,
  x_account_created_at_utc TEXT,
  country_code TEXT,
  session_nonce_hash TEXT,
  session_expires_at_utc TEXT,
  oauth_nonce_hash TEXT,
  oauth_expires_at_utc TEXT,
  x_subscription_type TEXT CHECK (x_subscription_type IS NULL OR x_subscription_type IN ('Premium', 'PremiumPlus')),
  x_premium_observed_at_utc TEXT,
  x_premium_revalidate_after_utc TEXT,
  state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'held')),
  genesis_slot INTEGER UNIQUE,
  created_at_utc TEXT NOT NULL,
  activated_at_utc TEXT
);

CREATE TABLE IF NOT EXISTS genesis_slots (
  slot_number INTEGER PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 1000),
  node_binding_id TEXT NOT NULL UNIQUE REFERENCES node_bindings(id),
  amount_base_units TEXT NOT NULL CHECK (amount_base_units = '100000000000'),
  reserved_at_utc TEXT NOT NULL,
  claim_status TEXT NOT NULL CHECK (claim_status IN ('reserved', 'held', 'claimed', 'expired')),
  claim_transaction TEXT,
  claimed_at_utc TEXT
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

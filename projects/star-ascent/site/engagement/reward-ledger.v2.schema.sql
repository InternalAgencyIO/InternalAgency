PRAGMA foreign_keys = ON;
PRAGMA recursive_triggers = ON;

-- Blueprint only. No active route, migration, allocator, signer, or transfer path
-- is allowed to treat these tables as production state.
CREATE TABLE IF NOT EXISTS reward_v2_blueprint_guard (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  schema_version INTEGER NOT NULL CHECK (schema_version = 2),
  status TEXT NOT NULL CHECK (status = 'BLUEPRINT_ONLY_NON_ACTIVATING'),
  runtime_wiring_allowed INTEGER NOT NULL CHECK (runtime_wiring_allowed = 0),
  migration_path_present INTEGER NOT NULL CHECK (migration_path_present = 0),
  global_allocator_present INTEGER NOT NULL CHECK (global_allocator_present = 0)
) STRICT;

INSERT INTO reward_v2_blueprint_guard (
  singleton_id,
  schema_version,
  status,
  runtime_wiring_allowed,
  migration_path_present,
  global_allocator_present
) SELECT 1, 2, 'BLUEPRINT_ONLY_NON_ACTIVATING', 0, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM reward_v2_blueprint_guard WHERE singleton_id = 1
);

CREATE TRIGGER IF NOT EXISTS reward_v2_blueprint_guard_no_replace
BEFORE INSERT ON reward_v2_blueprint_guard
WHEN EXISTS (
  SELECT 1 FROM reward_v2_blueprint_guard AS existing
  WHERE existing.singleton_id = NEW.singleton_id
)
BEGIN
  SELECT RAISE(ABORT, 'reward ledger v2 blueprint guard cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_blueprint_guard_no_update
BEFORE UPDATE ON reward_v2_blueprint_guard
BEGIN
  SELECT RAISE(ABORT, 'reward ledger v2 blueprint guard is immutable');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_blueprint_guard_no_delete
BEFORE DELETE ON reward_v2_blueprint_guard
BEGIN
  SELECT RAISE(ABORT, 'reward ledger v2 blueprint guard is immutable');
END;

CREATE TABLE IF NOT EXISTS reward_v2_identity_tombstones (
  node_id TEXT PRIMARY KEY
    CHECK (length(node_id) BETWEEN 8 AND 128)
    CHECK (node_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  immutable_x_user_id TEXT NOT NULL UNIQUE
    CHECK (length(immutable_x_user_id) BETWEEN 1 AND 32)
    CHECK (immutable_x_user_id NOT GLOB '*[^0-9]*')
    CHECK (substr(immutable_x_user_id, 1, 1) BETWEEN '1' AND '9'),
  wallet_address TEXT NOT NULL UNIQUE
    CHECK (length(wallet_address) BETWEEN 32 AND 44)
    CHECK (wallet_address NOT GLOB '*[^123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]*'),
  identity_digest TEXT NOT NULL UNIQUE
    CHECK (length(identity_digest) = 64)
    CHECK (identity_digest NOT GLOB '*[^0-9a-f]*'),
  tombstoned_at_utc TEXT NOT NULL
    CHECK (length(tombstoned_at_utc) = 24)
    CHECK (tombstoned_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(tombstoned_at_utc) IS NOT NULL),
  UNIQUE (node_id, immutable_x_user_id, wallet_address)
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_identity_tombstones_no_replace
BEFORE INSERT ON reward_v2_identity_tombstones
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_identity_tombstones AS existing
  WHERE existing.node_id = NEW.node_id
    OR existing.immutable_x_user_id = NEW.immutable_x_user_id
    OR existing.wallet_address = NEW.wallet_address
    OR existing.identity_digest = NEW.identity_digest
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 identity tombstone keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_identity_tombstones_no_update
BEFORE UPDATE ON reward_v2_identity_tombstones
BEGIN
  SELECT RAISE(ABORT, 'reward v2 identity tombstones are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_identity_tombstones_no_delete
BEFORE DELETE ON reward_v2_identity_tombstones
BEGIN
  SELECT RAISE(ABORT, 'reward v2 identity tombstones are permanent');
END;

CREATE TABLE IF NOT EXISTS reward_v2_history_events (
  history_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE
    CHECK (length(event_id) BETWEEN 8 AND 128)
    CHECK (event_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  node_id TEXT NOT NULL REFERENCES reward_v2_identity_tombstones(node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_kind TEXT NOT NULL
    CHECK (event_kind IN ('node_bound', 'tier_observed', 'action_accepted')),
  accepted_at_utc TEXT NOT NULL
    CHECK (length(accepted_at_utc) = 24)
    CHECK (accepted_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(accepted_at_utc) IS NOT NULL),
  evidence_digest TEXT NOT NULL UNIQUE
    CHECK (length(evidence_digest) = 64)
    CHECK (evidence_digest NOT GLOB '*[^0-9a-f]*'),
  UNIQUE (history_sequence, event_kind, node_id, evidence_digest)
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_history_events_no_replace
BEFORE INSERT ON reward_v2_history_events
WHEN (NEW.history_sequence > 0 AND EXISTS (
    SELECT 1 FROM reward_v2_history_events AS existing
    WHERE existing.history_sequence = NEW.history_sequence
  ))
  OR EXISTS (
    SELECT 1 FROM reward_v2_history_events AS existing
    WHERE existing.event_id = NEW.event_id
      OR existing.evidence_digest = NEW.evidence_digest
  )
BEGIN
  SELECT RAISE(ABORT, 'reward v2 history keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_history_events_no_update
BEFORE UPDATE ON reward_v2_history_events
BEGIN
  SELECT RAISE(ABORT, 'reward v2 history is append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_history_events_no_delete
BEFORE DELETE ON reward_v2_history_events
BEGIN
  SELECT RAISE(ABORT, 'reward v2 history is append-only');
END;

CREATE TABLE IF NOT EXISTS reward_v2_nodes (
  node_id TEXT PRIMARY KEY,
  immutable_x_user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  wallet_proof_digest TEXT NOT NULL UNIQUE
    CHECK (length(wallet_proof_digest) = 64)
    CHECK (wallet_proof_digest NOT GLOB '*[^0-9a-f]*'),
  wallet_proof_accepted_at_utc TEXT NOT NULL
    CHECK (length(wallet_proof_accepted_at_utc) = 24)
    CHECK (wallet_proof_accepted_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(wallet_proof_accepted_at_utc) IS NOT NULL),
  oauth_control_evidence_digest TEXT NOT NULL UNIQUE
    CHECK (length(oauth_control_evidence_digest) = 64)
    CHECK (oauth_control_evidence_digest NOT GLOB '*[^0-9a-f]*'),
  country_code TEXT NOT NULL
    CHECK (length(country_code) = 2)
    CHECK (country_code GLOB '[A-Z][A-Z]'),
  x_account_created_at_utc TEXT NOT NULL
    CHECK (length(x_account_created_at_utc) = 24)
    CHECK (x_account_created_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(x_account_created_at_utc) IS NOT NULL),
  x_control_observed_at_utc TEXT NOT NULL
    CHECK (length(x_control_observed_at_utc) = 24)
    CHECK (x_control_observed_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(x_control_observed_at_utc) IS NOT NULL),
  node_accepted_at_utc TEXT NOT NULL
    CHECK (length(node_accepted_at_utc) = 24)
    CHECK (node_accepted_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(node_accepted_at_utc) IS NOT NULL),
  node_history_sequence INTEGER NOT NULL UNIQUE
    REFERENCES reward_v2_history_events(history_sequence)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (unixepoch(x_control_observed_at_utc) - unixepoch(x_account_created_at_utc) >= 3456000),
  CHECK (unixepoch(wallet_proof_accepted_at_utc) <= unixepoch(node_accepted_at_utc)),
  CHECK (unixepoch(x_control_observed_at_utc) <= unixepoch(node_accepted_at_utc)),
  UNIQUE (node_id, immutable_x_user_id),
  UNIQUE (node_id, wallet_address),
  FOREIGN KEY (node_id, immutable_x_user_id, wallet_address)
    REFERENCES reward_v2_identity_tombstones(node_id, immutable_x_user_id, wallet_address)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_nodes_no_replace
BEFORE INSERT ON reward_v2_nodes
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_nodes AS existing
  WHERE existing.node_id = NEW.node_id
    OR existing.wallet_proof_digest = NEW.wallet_proof_digest
    OR existing.oauth_control_evidence_digest = NEW.oauth_control_evidence_digest
    OR existing.node_history_sequence = NEW.node_history_sequence
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 node identity keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_nodes_history_guard
BEFORE INSERT ON reward_v2_nodes
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_history_events AS history
  WHERE history.history_sequence = NEW.node_history_sequence
    AND history.event_kind = 'node_bound'
    AND history.node_id = NEW.node_id
    AND history.evidence_digest = NEW.oauth_control_evidence_digest
    AND history.accepted_at_utc = NEW.node_accepted_at_utc
)
BEGIN
  SELECT RAISE(ABORT, 'node must bind one canonical node_bound history event');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_nodes_no_update
BEFORE UPDATE ON reward_v2_nodes
BEGIN
  SELECT RAISE(ABORT, 'reward v2 node identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_nodes_no_delete
BEFORE DELETE ON reward_v2_nodes
BEGIN
  SELECT RAISE(ABORT, 'reward v2 node identity cannot re-enter');
END;

CREATE TABLE IF NOT EXISTS reward_v2_tier_observations (
  observation_id TEXT PRIMARY KEY
    CHECK (length(observation_id) BETWEEN 8 AND 128)
    CHECK (observation_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  node_id TEXT NOT NULL,
  immutable_x_user_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('None', 'Basic', 'Premium', 'PremiumPlus')),
  provider_evidence_digest TEXT NOT NULL UNIQUE
    CHECK (length(provider_evidence_digest) = 64)
    CHECK (provider_evidence_digest NOT GLOB '*[^0-9a-f]*'),
  observed_at_utc TEXT NOT NULL
    CHECK (length(observed_at_utc) = 24)
    CHECK (observed_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(observed_at_utc) IS NOT NULL),
  accepted_at_utc TEXT NOT NULL
    CHECK (length(accepted_at_utc) = 24)
    CHECK (accepted_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(accepted_at_utc) IS NOT NULL),
  fresh_until_utc TEXT NOT NULL
    CHECK (length(fresh_until_utc) = 24)
    CHECK (fresh_until_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(fresh_until_utc) IS NOT NULL),
  observation_history_sequence INTEGER NOT NULL UNIQUE
    REFERENCES reward_v2_history_events(history_sequence)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (unixepoch(accepted_at_utc) >= unixepoch(observed_at_utc)),
  CHECK (unixepoch(accepted_at_utc) < unixepoch(fresh_until_utc)),
  CHECK (unixepoch(fresh_until_utc) = unixepoch(observed_at_utc) + 86400),
  UNIQUE (observation_id, node_id),
  FOREIGN KEY (node_id, immutable_x_user_id)
    REFERENCES reward_v2_nodes(node_id, immutable_x_user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_tier_observations_no_replace
BEFORE INSERT ON reward_v2_tier_observations
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_tier_observations AS existing
  WHERE existing.observation_id = NEW.observation_id
    OR existing.provider_evidence_digest = NEW.provider_evidence_digest
    OR existing.observation_history_sequence = NEW.observation_history_sequence
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 tier-observation keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_tier_observations_history_guard
BEFORE INSERT ON reward_v2_tier_observations
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_history_events AS history
  WHERE history.history_sequence = NEW.observation_history_sequence
    AND history.event_kind = 'tier_observed'
    AND history.node_id = NEW.node_id
    AND history.evidence_digest = NEW.provider_evidence_digest
    AND history.accepted_at_utc = NEW.accepted_at_utc
)
BEGIN
  SELECT RAISE(ABORT, 'tier observation must bind one canonical history event');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_tier_observations_no_update
BEFORE UPDATE ON reward_v2_tier_observations
BEGIN
  SELECT RAISE(ABORT, 'reward v2 tier observations are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_tier_observations_no_delete
BEFORE DELETE ON reward_v2_tier_observations
BEGIN
  SELECT RAISE(ABORT, 'reward v2 tier observations are append-only');
END;

CREATE TABLE IF NOT EXISTS reward_v2_funding_rounds (
  funding_round_id TEXT PRIMARY KEY
    CHECK (length(funding_round_id) BETWEEN 8 AND 128)
    CHECK (funding_round_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  utc_day TEXT NOT NULL UNIQUE
    CHECK (utc_day GLOB '????-??-??')
    CHECK (date(utc_day) = utc_day),
  opens_at_utc TEXT NOT NULL UNIQUE
    CHECK (length(opens_at_utc) = 24)
    CHECK (opens_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(opens_at_utc) IS NOT NULL)
    CHECK (substr(opens_at_utc, 12) = '00:00:00.000Z'),
  miss_decidable_at_utc TEXT NOT NULL UNIQUE
    CHECK (length(miss_decidable_at_utc) = 24)
    CHECK (miss_decidable_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(miss_decidable_at_utc) IS NOT NULL),
  funding_class TEXT NOT NULL
    CHECK (funding_class = 'STANDARD_10_PERCENT_AND_X_CAMPAIGN'),
  state TEXT NOT NULL
    CHECK (state IN ('collecting', 'sealed', 'global_allocator_pending', 'allocator_recorded', 'terminal', 'null')),
  sealed_at_utc TEXT
    CHECK (sealed_at_utc IS NULL OR (
      length(sealed_at_utc) = 24
      AND sealed_at_utc GLOB '????-??-??T??:??:??.???Z'
      AND unixepoch(sealed_at_utc) IS NOT NULL
    )),
  candidate_snapshot_digest TEXT
    CHECK (candidate_snapshot_digest IS NULL OR (
      length(candidate_snapshot_digest) = 64
      AND candidate_snapshot_digest NOT GLOB '*[^0-9a-f]*'
    )),
  lane_reservation_snapshot_digest TEXT
    CHECK (lane_reservation_snapshot_digest IS NULL OR (
      length(lane_reservation_snapshot_digest) = 64
      AND lane_reservation_snapshot_digest NOT GLOB '*[^0-9a-f]*'
    )),
  allocator_batch_digest TEXT UNIQUE
    CHECK (allocator_batch_digest IS NULL OR (
      length(allocator_batch_digest) = 64
      AND allocator_batch_digest NOT GLOB '*[^0-9a-f]*'
    )),
  null_reason TEXT
    CHECK (null_reason IS NULL OR null_reason IN (
      'daily_unfulfilled_at_utc_boundary',
      'global_allocator_absent',
      'insufficient_full_tranche_capacity',
      'identity_or_evidence_held',
      'premium_upgrade_proof_not_fresh',
      'claim_window_expired',
      'policy_hold'
    )),
  nullified_at_utc TEXT
    CHECK (nullified_at_utc IS NULL OR (
      length(nullified_at_utc) = 24
      AND nullified_at_utc GLOB '????-??-??T??:??:??.???Z'
      AND unixepoch(nullified_at_utc) IS NOT NULL
    )),
  created_at_utc TEXT NOT NULL
    CHECK (length(created_at_utc) = 24)
    CHECK (created_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(created_at_utc) IS NOT NULL),
  CHECK (substr(opens_at_utc, 1, 10) = utc_day),
  CHECK (unixepoch(miss_decidable_at_utc) = unixepoch(opens_at_utc) + 1),
  CHECK (
    (state = 'null'
      AND null_reason IS NOT NULL
      AND nullified_at_utc IS NOT NULL
      AND allocator_batch_digest IS NULL
      AND (
        (null_reason = 'daily_unfulfilled_at_utc_boundary'
          AND sealed_at_utc IS NULL
          AND candidate_snapshot_digest IS NULL
          AND lane_reservation_snapshot_digest IS NULL)
        OR
        (null_reason <> 'daily_unfulfilled_at_utc_boundary'
          AND sealed_at_utc = opens_at_utc
          AND candidate_snapshot_digest IS NOT NULL
          AND lane_reservation_snapshot_digest IS NOT NULL)
      ))
    OR
    (state = 'collecting'
      AND sealed_at_utc IS NULL
      AND candidate_snapshot_digest IS NULL
      AND lane_reservation_snapshot_digest IS NULL
      AND null_reason IS NULL
      AND nullified_at_utc IS NULL
      AND allocator_batch_digest IS NULL)
    OR
    (state IN ('sealed', 'global_allocator_pending')
      AND sealed_at_utc = opens_at_utc
      AND candidate_snapshot_digest IS NOT NULL
      AND lane_reservation_snapshot_digest IS NOT NULL
      AND null_reason IS NULL
      AND nullified_at_utc IS NULL
      AND allocator_batch_digest IS NULL)
    OR
    (state IN ('allocator_recorded', 'terminal')
      AND sealed_at_utc = opens_at_utc
      AND candidate_snapshot_digest IS NOT NULL
      AND lane_reservation_snapshot_digest IS NOT NULL
      AND null_reason IS NULL
      AND nullified_at_utc IS NULL
      AND allocator_batch_digest IS NOT NULL)
  )
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_no_replace
BEFORE INSERT ON reward_v2_funding_rounds
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_funding_rounds AS existing
  WHERE existing.funding_round_id = NEW.funding_round_id
    OR existing.utc_day = NEW.utc_day
    OR existing.opens_at_utc = NEW.opens_at_utc
    OR existing.miss_decidable_at_utc = NEW.miss_decidable_at_utc
    OR (NEW.allocator_batch_digest IS NOT NULL
      AND existing.allocator_batch_digest = NEW.allocator_batch_digest)
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 funding-round keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_initial_state_guard
BEFORE INSERT ON reward_v2_funding_rounds
WHEN NEW.state <> 'collecting'
  OR NEW.sealed_at_utc IS NOT NULL
  OR NEW.candidate_snapshot_digest IS NOT NULL
  OR NEW.lane_reservation_snapshot_digest IS NOT NULL
  OR NEW.allocator_batch_digest IS NOT NULL
  OR NEW.null_reason IS NOT NULL
  OR NEW.nullified_at_utc IS NOT NULL
  OR unixepoch(NEW.created_at_utc) >= unixepoch(NEW.opens_at_utc)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 funding rounds must begin collecting before their boundary with no lifecycle outcome');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_immutable_fields
BEFORE UPDATE ON reward_v2_funding_rounds
WHEN OLD.funding_round_id IS NOT NEW.funding_round_id
  OR OLD.utc_day IS NOT NEW.utc_day
  OR OLD.opens_at_utc IS NOT NEW.opens_at_utc
  OR OLD.miss_decidable_at_utc IS NOT NEW.miss_decidable_at_utc
  OR OLD.funding_class IS NOT NEW.funding_class
  OR OLD.created_at_utc IS NOT NEW.created_at_utc
  OR (OLD.sealed_at_utc IS NOT NULL AND OLD.sealed_at_utc IS NOT NEW.sealed_at_utc)
  OR (OLD.candidate_snapshot_digest IS NOT NULL AND OLD.candidate_snapshot_digest IS NOT NEW.candidate_snapshot_digest)
  OR (OLD.lane_reservation_snapshot_digest IS NOT NULL AND OLD.lane_reservation_snapshot_digest IS NOT NEW.lane_reservation_snapshot_digest)
  OR (OLD.allocator_batch_digest IS NOT NULL AND OLD.allocator_batch_digest IS NOT NEW.allocator_batch_digest)
  OR (OLD.null_reason IS NOT NULL AND OLD.null_reason IS NOT NEW.null_reason)
  OR (OLD.nullified_at_utc IS NOT NULL AND OLD.nullified_at_utc IS NOT NEW.nullified_at_utc)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 funding-round identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_terminal_immutable
BEFORE UPDATE ON reward_v2_funding_rounds
WHEN OLD.state IN ('terminal', 'null')
BEGIN
  SELECT RAISE(ABORT, 'terminal reward v2 funding-round state is immutable');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_transition_guard
BEFORE UPDATE OF state ON reward_v2_funding_rounds
WHEN OLD.state IS NOT NEW.state
  AND NOT (
    (OLD.state = 'collecting' AND NEW.state IN ('sealed', 'null'))
    OR (OLD.state = 'sealed' AND NEW.state IN ('global_allocator_pending', 'null'))
    OR (OLD.state = 'global_allocator_pending' AND NEW.state IN ('allocator_recorded', 'null'))
    OR (OLD.state = 'allocator_recorded' AND NEW.state = 'terminal')
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid reward v2 funding-round transition');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_boundary_null_guard
BEFORE UPDATE ON reward_v2_funding_rounds
WHEN NEW.state = 'null'
  AND unixepoch(NEW.nullified_at_utc) < unixepoch(NEW.miss_decidable_at_utc)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 null cannot be recorded before the miss-decidable instant');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_no_delete
BEFORE DELETE ON reward_v2_funding_rounds
BEGIN
  SELECT RAISE(ABORT, 'reward v2 funding rounds cannot be deleted');
END;

CREATE TABLE IF NOT EXISTS reward_v2_qualifying_actions (
  action_id TEXT PRIMARY KEY
    CHECK (length(action_id) BETWEEN 8 AND 128)
    CHECK (action_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  node_id TEXT NOT NULL REFERENCES reward_v2_nodes(node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  utc_day TEXT NOT NULL
    CHECK (utc_day GLOB '????-??-??')
    CHECK (date(utc_day) = utc_day),
  action_type TEXT NOT NULL
    CHECK (action_type IN ('original', 'reply', 'quote', 'repost', 'like', 'follow')),
  provider_activity_id TEXT UNIQUE
    CHECK (provider_activity_id IS NULL OR (
      length(provider_activity_id) BETWEEN 1 AND 32
      AND provider_activity_id NOT GLOB '*[^0-9]*'
      AND substr(provider_activity_id, 1, 1) BETWEEN '1' AND '9'
    )),
  provider_activity_at_utc TEXT
    CHECK (provider_activity_at_utc IS NULL OR (
      length(provider_activity_at_utc) = 24
      AND provider_activity_at_utc GLOB '????-??-??T??:??:??.???Z'
      AND unixepoch(provider_activity_at_utc) IS NOT NULL
    )),
  first_observed_at_utc TEXT
    CHECK (first_observed_at_utc IS NULL OR (
      length(first_observed_at_utc) = 24
      AND first_observed_at_utc GLOB '????-??-??T??:??:??.???Z'
      AND unixepoch(first_observed_at_utc) IS NOT NULL
    )),
  first_observed_finalized_slot INTEGER
    CHECK (first_observed_finalized_slot IS NULL OR first_observed_finalized_slot > 0),
  effective_activity_at_utc TEXT NOT NULL
    CHECK (length(effective_activity_at_utc) = 24)
    CHECK (effective_activity_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(effective_activity_at_utc) IS NOT NULL),
  canonical_campaign_target_digest TEXT NOT NULL
    CHECK (length(canonical_campaign_target_digest) = 64)
    CHECK (canonical_campaign_target_digest NOT GLOB '*[^0-9a-f]*'),
  evidence_digest TEXT NOT NULL UNIQUE
    CHECK (length(evidence_digest) = 64)
    CHECK (evidence_digest NOT GLOB '*[^0-9a-f]*'),
  accepted_at_utc TEXT NOT NULL
    CHECK (length(accepted_at_utc) = 24)
    CHECK (accepted_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(accepted_at_utc) IS NOT NULL),
  action_history_sequence INTEGER NOT NULL UNIQUE
    REFERENCES reward_v2_history_events(history_sequence)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (substr(effective_activity_at_utc, 1, 10) = utc_day),
  CHECK (unixepoch(accepted_at_utc) >= unixepoch(effective_activity_at_utc)),
  CHECK (
    (action_type IN ('like', 'follow')
      AND provider_activity_id IS NULL
      AND provider_activity_at_utc IS NULL
      AND first_observed_at_utc IS NOT NULL
      AND first_observed_finalized_slot IS NOT NULL
      AND effective_activity_at_utc = first_observed_at_utc)
    OR
    (action_type IN ('original', 'reply', 'quote', 'repost')
      AND provider_activity_id IS NOT NULL
      AND provider_activity_at_utc IS NOT NULL
      AND first_observed_at_utc IS NULL
      AND first_observed_finalized_slot IS NULL
      AND effective_activity_at_utc = provider_activity_at_utc)
  ),
  UNIQUE (node_id, utc_day),
  UNIQUE (node_id, action_type, canonical_campaign_target_digest, utc_day),
  UNIQUE (action_id, node_id, utc_day)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS reward_v2_qualifying_actions_lookup_target_replay_unique
ON reward_v2_qualifying_actions(node_id, action_type, canonical_campaign_target_digest)
WHERE action_type IN ('like', 'follow');

CREATE TRIGGER IF NOT EXISTS reward_v2_qualifying_actions_no_replace
BEFORE INSERT ON reward_v2_qualifying_actions
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_qualifying_actions AS existing
  WHERE existing.action_id = NEW.action_id
    OR (NEW.provider_activity_id IS NOT NULL
      AND existing.provider_activity_id = NEW.provider_activity_id)
    OR existing.evidence_digest = NEW.evidence_digest
    OR existing.action_history_sequence = NEW.action_history_sequence
    OR (existing.node_id = NEW.node_id AND existing.utc_day = NEW.utc_day)
    OR (existing.node_id = NEW.node_id
      AND existing.action_type = NEW.action_type
      AND existing.canonical_campaign_target_digest = NEW.canonical_campaign_target_digest
      AND existing.utc_day = NEW.utc_day)
    OR (NEW.action_type IN ('like', 'follow')
      AND existing.node_id = NEW.node_id
      AND existing.action_type = NEW.action_type
      AND existing.canonical_campaign_target_digest = NEW.canonical_campaign_target_digest)
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 action identity or replay keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_qualifying_actions_history_guard
BEFORE INSERT ON reward_v2_qualifying_actions
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_history_events AS history
  WHERE history.history_sequence = NEW.action_history_sequence
    AND history.event_kind = 'action_accepted'
    AND history.node_id = NEW.node_id
    AND history.evidence_digest = NEW.evidence_digest
    AND history.accepted_at_utc = NEW.accepted_at_utc
)
BEGIN
  SELECT RAISE(ABORT, 'qualifying action must bind one canonical history event');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_qualifying_actions_no_update
BEFORE UPDATE ON reward_v2_qualifying_actions
BEGIN
  SELECT RAISE(ABORT, 'reward v2 qualifying actions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_qualifying_actions_no_delete
BEFORE DELETE ON reward_v2_qualifying_actions
BEGIN
  SELECT RAISE(ABORT, 'reward v2 qualifying actions are append-only');
END;

CREATE TABLE IF NOT EXISTS reward_v2_genesis_acceptances (
  acceptance_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  acceptance_id TEXT NOT NULL UNIQUE
    CHECK (length(acceptance_id) BETWEEN 8 AND 128)
    CHECK (acceptance_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  genesis_rank INTEGER NOT NULL UNIQUE CHECK (genesis_rank BETWEEN 1 AND 1000),
  node_id TEXT NOT NULL UNIQUE REFERENCES reward_v2_nodes(node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_utc_day TEXT NOT NULL
    CHECK (origin_utc_day GLOB '????-??-??')
    CHECK (date(origin_utc_day) = origin_utc_day),
  accepted_at_utc TEXT NOT NULL
    CHECK (length(accepted_at_utc) = 24)
    CHECK (accepted_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(accepted_at_utc) IS NOT NULL),
  acceptance_evidence_digest TEXT NOT NULL UNIQUE
    CHECK (length(acceptance_evidence_digest) = 64)
    CHECK (acceptance_evidence_digest NOT GLOB '*[^0-9a-f]*'),
  CHECK (substr(accepted_at_utc, 1, 10) = origin_utc_day),
  UNIQUE (acceptance_id, node_id, genesis_rank, origin_utc_day)
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_genesis_acceptances_no_replace
BEFORE INSERT ON reward_v2_genesis_acceptances
WHEN (NEW.acceptance_sequence > 0 AND EXISTS (
    SELECT 1 FROM reward_v2_genesis_acceptances AS existing
    WHERE existing.acceptance_sequence = NEW.acceptance_sequence
  ))
  OR EXISTS (
    SELECT 1
    FROM reward_v2_genesis_acceptances AS existing
    WHERE existing.acceptance_id = NEW.acceptance_id
      OR existing.genesis_rank = NEW.genesis_rank
      OR existing.node_id = NEW.node_id
      OR existing.acceptance_evidence_digest = NEW.acceptance_evidence_digest
  )
BEGIN
  SELECT RAISE(ABORT, 'Genesis acceptance identity and rank keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_genesis_acceptances_contiguous_rank_guard
BEFORE INSERT ON reward_v2_genesis_acceptances
WHEN NEW.genesis_rank IS NOT (
  SELECT coalesce(max(existing.genesis_rank), 0) + 1
  FROM reward_v2_genesis_acceptances AS existing
)
BEGIN
  SELECT RAISE(ABORT, 'Genesis rank must be the next contiguous append-only acceptance rank');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_genesis_acceptances_no_update
BEFORE UPDATE ON reward_v2_genesis_acceptances
BEGIN
  SELECT RAISE(ABORT, 'Genesis acceptance rank is immutable');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_genesis_acceptances_no_delete
BEFORE DELETE ON reward_v2_genesis_acceptances
BEGIN
  SELECT RAISE(ABORT, 'Genesis acceptance rank is append-only and cannot create gaps');
END;

CREATE TABLE IF NOT EXISTS reward_v2_candidates (
  candidate_id TEXT PRIMARY KEY
    CHECK (length(candidate_id) BETWEEN 8 AND 128)
    CHECK (candidate_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  campaign_kind TEXT NOT NULL CHECK (campaign_kind IN ('GENESIS', 'DAILY')),
  origin_utc_day TEXT NOT NULL
    CHECK (origin_utc_day GLOB '????-??-??')
    CHECK (date(origin_utc_day) = origin_utc_day),
  node_id TEXT NOT NULL REFERENCES reward_v2_nodes(node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  action_id TEXT,
  genesis_acceptance_id TEXT,
  original_funding_round_at_utc TEXT NOT NULL
    REFERENCES reward_v2_funding_rounds(opens_at_utc)
    ON UPDATE RESTRICT ON DELETE RESTRICT
    CHECK (length(original_funding_round_at_utc) = 24)
    CHECK (original_funding_round_at_utc GLOB '????-??-??T00:00:00.000Z')
    CHECK (unixepoch(original_funding_round_at_utc) IS NOT NULL),
  initial_tier_observation_id TEXT NOT NULL,
  genesis_rank INTEGER CHECK (genesis_rank IS NULL OR genesis_rank BETWEEN 1 AND 1000),
  nominal_full_reward_base_units INTEGER NOT NULL,
  base_eligibility_sequence INTEGER NOT NULL CHECK (base_eligibility_sequence > 0),
  claim_expires_at_utc TEXT NOT NULL
    CHECK (length(claim_expires_at_utc) = 24)
    CHECK (claim_expires_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(claim_expires_at_utc) IS NOT NULL),
  created_at_utc TEXT NOT NULL
    CHECK (length(created_at_utc) = 24)
    CHECK (created_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(created_at_utc) IS NOT NULL),
  CHECK (
    (campaign_kind = 'GENESIS'
      AND action_id IS NULL
      AND genesis_acceptance_id IS NOT NULL
      AND genesis_rank BETWEEN 1 AND 1000
      AND nominal_full_reward_base_units = 100000000000)
    OR
    (campaign_kind = 'DAILY'
      AND action_id IS NOT NULL
      AND genesis_acceptance_id IS NULL
      AND genesis_rank IS NULL
      AND nominal_full_reward_base_units = 12000000000)
  ),
  CHECK (unixepoch(created_at_utc) >= unixepoch(origin_utc_day || 'T00:00:00.000Z')),
  CHECK (unixepoch(created_at_utc) < unixepoch(original_funding_round_at_utc)),
  CHECK (unixepoch(original_funding_round_at_utc) = unixepoch(origin_utc_day || 'T00:00:00.000Z') + 86400),
  CHECK (unixepoch(claim_expires_at_utc) = unixepoch(original_funding_round_at_utc) + 2592000),
  UNIQUE (node_id, campaign_kind, origin_utc_day),
  UNIQUE (candidate_id, node_id),
  UNIQUE (candidate_id, genesis_acceptance_id),
  FOREIGN KEY (action_id, node_id, origin_utc_day)
    REFERENCES reward_v2_qualifying_actions(action_id, node_id, utc_day)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (initial_tier_observation_id, node_id)
    REFERENCES reward_v2_tier_observations(observation_id, node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (genesis_acceptance_id, node_id, genesis_rank, origin_utc_day)
    REFERENCES reward_v2_genesis_acceptances(acceptance_id, node_id, genesis_rank, origin_utc_day)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS reward_v2_candidates_genesis_rank_unique
ON reward_v2_candidates(genesis_rank)
WHERE campaign_kind = 'GENESIS';

CREATE UNIQUE INDEX IF NOT EXISTS reward_v2_candidates_genesis_node_unique
ON reward_v2_candidates(node_id)
WHERE campaign_kind = 'GENESIS';

CREATE TRIGGER IF NOT EXISTS reward_v2_candidates_no_replace
BEFORE INSERT ON reward_v2_candidates
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_candidates AS existing
  WHERE existing.candidate_id = NEW.candidate_id
    OR (existing.node_id = NEW.node_id
      AND existing.campaign_kind = NEW.campaign_kind
      AND existing.origin_utc_day = NEW.origin_utc_day)
    OR (NEW.campaign_kind = 'GENESIS'
      AND existing.campaign_kind = 'GENESIS'
      AND existing.genesis_rank = NEW.genesis_rank)
    OR (NEW.campaign_kind = 'GENESIS'
      AND existing.campaign_kind = 'GENESIS'
      AND existing.node_id = NEW.node_id)
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 candidate identity and campaign keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_candidates_eligibility_guard
BEFORE INSERT ON reward_v2_candidates
WHEN NEW.base_eligibility_sequence IS NOT (
  SELECT max(
    node.node_history_sequence,
    observation.observation_history_sequence,
    coalesce(action.action_history_sequence, node.node_history_sequence)
  )
  FROM reward_v2_nodes AS node
  JOIN reward_v2_tier_observations AS observation
    ON observation.observation_id = NEW.initial_tier_observation_id
    AND observation.node_id = node.node_id
  LEFT JOIN reward_v2_qualifying_actions AS action
    ON action.action_id = NEW.action_id
    AND action.node_id = node.node_id
  WHERE node.node_id = NEW.node_id
)
BEGIN
  SELECT RAISE(ABORT, 'candidate eligibility sequence must be the canonical max of activity, node, and accepted proof history');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_candidates_fresh_tier_guard
BEFORE INSERT ON reward_v2_candidates
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_tier_observations AS observation
  WHERE observation.observation_id = NEW.initial_tier_observation_id
    AND observation.node_id = NEW.node_id
    AND unixepoch(NEW.created_at_utc) >= unixepoch(observation.accepted_at_utc)
    AND unixepoch(NEW.created_at_utc) < unixepoch(observation.fresh_until_utc)
    AND NOT EXISTS (
      SELECT 1
      FROM reward_v2_tier_observations AS newer_observation
      WHERE newer_observation.node_id = NEW.node_id
        AND newer_observation.observation_history_sequence > observation.observation_history_sequence
        AND unixepoch(newer_observation.accepted_at_utc) <= unixepoch(NEW.created_at_utc)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'candidate requires the latest current known tier observation for the same identity');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_candidates_origin_evidence_time_guard
BEFORE INSERT ON reward_v2_candidates
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_nodes AS node
  WHERE node.node_id = NEW.node_id
    AND unixepoch(node.node_accepted_at_utc) <= unixepoch(NEW.created_at_utc)
)
  OR NOT (
  (NEW.campaign_kind = 'DAILY' AND EXISTS (
    SELECT 1
    FROM reward_v2_qualifying_actions AS action
    WHERE action.action_id = NEW.action_id
      AND action.node_id = NEW.node_id
      AND unixepoch(action.accepted_at_utc) <= unixepoch(NEW.created_at_utc)
  ))
  OR
  (NEW.campaign_kind = 'GENESIS' AND EXISTS (
    SELECT 1
    FROM reward_v2_genesis_acceptances AS acceptance
    WHERE acceptance.acceptance_id = NEW.genesis_acceptance_id
      AND acceptance.node_id = NEW.node_id
      AND unixepoch(acceptance.accepted_at_utc) <= unixepoch(NEW.created_at_utc)
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'candidate cannot predate its accepted node, Daily action, or Genesis acceptance');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_candidates_open_round_guard
BEFORE INSERT ON reward_v2_candidates
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_funding_rounds AS round
  WHERE round.opens_at_utc = NEW.original_funding_round_at_utc
    AND round.state = 'collecting'
)
BEGIN
  SELECT RAISE(ABORT, 'candidate must enter the designated funding round before its boundary seal');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_candidates_no_update
BEFORE UPDATE ON reward_v2_candidates
BEGIN
  SELECT RAISE(ABORT, 'reward v2 candidates are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_candidates_no_delete
BEFORE DELETE ON reward_v2_candidates
BEGIN
  SELECT RAISE(ABORT, 'reward v2 candidates are append-only');
END;

CREATE TABLE IF NOT EXISTS reward_v2_daily_epochs (
  daily_epoch_id TEXT PRIMARY KEY
    CHECK (length(daily_epoch_id) BETWEEN 8 AND 128)
    CHECK (daily_epoch_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  epoch_ordinal INTEGER NOT NULL UNIQUE CHECK (epoch_ordinal BETWEEN 1 AND 365),
  origin_utc_day TEXT NOT NULL UNIQUE
    CHECK (origin_utc_day GLOB '????-??-??')
    CHECK (date(origin_utc_day) = origin_utc_day),
  funding_round_id TEXT NOT NULL UNIQUE
    REFERENCES reward_v2_funding_rounds(funding_round_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  nominal_reward_per_selected_base_units INTEGER NOT NULL
    CHECK (nominal_reward_per_selected_base_units = 12000000000),
  selected_count INTEGER NOT NULL CHECK (selected_count BETWEEN 0 AND 1000),
  selected_nominal_base_units INTEGER NOT NULL
    CHECK (selected_nominal_base_units BETWEEN 0 AND 12000000000000),
  cumulative_selected_nominal_base_units INTEGER NOT NULL
    CHECK (cumulative_selected_nominal_base_units BETWEEN 0 AND 4380000000000000),
  candidate_snapshot_digest TEXT NOT NULL
    CHECK (length(candidate_snapshot_digest) = 64)
    CHECK (candidate_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  selection_policy_hash TEXT NOT NULL
    CHECK (length(selection_policy_hash) = 64)
    CHECK (selection_policy_hash NOT GLOB '*[^0-9a-f]*'),
  selection_algorithm TEXT NOT NULL
    CHECK (selection_algorithm = 'IAT_DAILY_BUDGET_V1_ASCENDING_SHA256'),
  selection_domain TEXT NOT NULL
    CHECK (selection_domain = 'IAT_DAILY_BUDGET_V1'),
  finalized_slot INTEGER NOT NULL CHECK (finalized_slot > 0),
  finalized_slot_hash TEXT NOT NULL
    CHECK (length(finalized_slot_hash) = 64)
    CHECK (finalized_slot_hash NOT GLOB '*[^0-9a-f]*'),
  previous_epoch_chain_digest TEXT UNIQUE
    CHECK (previous_epoch_chain_digest IS NULL OR (
      length(previous_epoch_chain_digest) = 64
      AND previous_epoch_chain_digest NOT GLOB '*[^0-9a-f]*'
    )),
  epoch_chain_digest TEXT NOT NULL UNIQUE
    CHECK (length(epoch_chain_digest) = 64)
    CHECK (epoch_chain_digest NOT GLOB '*[^0-9a-f]*'),
  budget_attestation_digest TEXT NOT NULL UNIQUE
    CHECK (length(budget_attestation_digest) = 64)
    CHECK (budget_attestation_digest NOT GLOB '*[^0-9a-f]*'),
  finalized_at_utc TEXT NOT NULL
    CHECK (length(finalized_at_utc) = 24)
    CHECK (finalized_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(finalized_at_utc) IS NOT NULL),
  refill_allowed INTEGER NOT NULL CHECK (refill_allowed = 0),
  recycling_allowed INTEGER NOT NULL CHECK (recycling_allowed = 0),
  CHECK (selected_nominal_base_units = selected_count * nominal_reward_per_selected_base_units),
  CHECK (
    (epoch_ordinal = 1 AND previous_epoch_chain_digest IS NULL)
    OR (epoch_ordinal > 1 AND previous_epoch_chain_digest IS NOT NULL)
  ),
  UNIQUE (
    daily_epoch_id,
    funding_round_id,
    selection_policy_hash,
    selection_algorithm,
    selection_domain,
    candidate_snapshot_digest,
    finalized_slot_hash
  )
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_epochs_no_replace
BEFORE INSERT ON reward_v2_daily_epochs
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_daily_epochs AS existing
  WHERE existing.daily_epoch_id = NEW.daily_epoch_id
    OR existing.epoch_ordinal = NEW.epoch_ordinal
    OR existing.origin_utc_day = NEW.origin_utc_day
    OR existing.funding_round_id = NEW.funding_round_id
    OR (NEW.previous_epoch_chain_digest IS NOT NULL
      AND existing.previous_epoch_chain_digest = NEW.previous_epoch_chain_digest)
    OR existing.epoch_chain_digest = NEW.epoch_chain_digest
    OR existing.budget_attestation_digest = NEW.budget_attestation_digest
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 daily-epoch identity and chain keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_epochs_round_guard
BEFORE INSERT ON reward_v2_daily_epochs
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_funding_rounds AS round
  WHERE round.funding_round_id = NEW.funding_round_id
    AND round.state = 'global_allocator_pending'
    AND round.candidate_snapshot_digest = NEW.candidate_snapshot_digest
    AND unixepoch(round.opens_at_utc) = unixepoch(NEW.origin_utc_day || 'T00:00:00.000Z') + 86400
    AND round.sealed_at_utc = round.opens_at_utc
    AND NEW.finalized_at_utc = round.sealed_at_utc
)
BEGIN
  SELECT RAISE(ABORT, 'daily epoch must bind the next-midnight pending funding round and frozen candidate snapshot');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_epochs_chain_guard
BEFORE INSERT ON reward_v2_daily_epochs
WHEN NOT (
  (NEW.epoch_ordinal = 1
    AND NOT EXISTS (SELECT 1 FROM reward_v2_daily_epochs)
    AND NEW.previous_epoch_chain_digest IS NULL
    AND NEW.cumulative_selected_nominal_base_units = NEW.selected_nominal_base_units)
  OR
  (NEW.epoch_ordinal > 1
    AND EXISTS (
      SELECT 1
      FROM reward_v2_daily_epochs AS previous
      WHERE previous.epoch_ordinal = NEW.epoch_ordinal - 1
        AND previous.epoch_chain_digest = NEW.previous_epoch_chain_digest
        AND NEW.cumulative_selected_nominal_base_units =
          previous.cumulative_selected_nominal_base_units + NEW.selected_nominal_base_units
    )
    AND NEW.epoch_ordinal = (SELECT max(existing.epoch_ordinal) + 1 FROM reward_v2_daily_epochs AS existing))
)
BEGIN
  SELECT RAISE(ABORT, 'daily epoch ordinal, chain digest, and cumulative nominal budget must advance exactly once');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_epochs_no_update
BEFORE UPDATE ON reward_v2_daily_epochs
BEGIN
  SELECT RAISE(ABORT, 'reward v2 daily epochs and nominal budgets are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_epochs_no_delete
BEFORE DELETE ON reward_v2_daily_epochs
BEGIN
  SELECT RAISE(ABORT, 'reward v2 daily epoch budget cannot be refilled or recycled');
END;

CREATE TABLE IF NOT EXISTS reward_v2_daily_selections (
  daily_selection_id TEXT PRIMARY KEY
    CHECK (length(daily_selection_id) BETWEEN 8 AND 128)
    CHECK (daily_selection_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  daily_epoch_id TEXT NOT NULL,
  funding_round_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL UNIQUE
    REFERENCES reward_v2_candidates(candidate_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  selection_rank INTEGER NOT NULL CHECK (selection_rank BETWEEN 1 AND 1000),
  selection_policy_hash TEXT NOT NULL
    CHECK (length(selection_policy_hash) = 64)
    CHECK (selection_policy_hash NOT GLOB '*[^0-9a-f]*'),
  selection_algorithm TEXT NOT NULL
    CHECK (selection_algorithm = 'IAT_DAILY_BUDGET_V1_ASCENDING_SHA256'),
  selection_domain TEXT NOT NULL
    CHECK (selection_domain = 'IAT_DAILY_BUDGET_V1'),
  candidate_snapshot_digest TEXT NOT NULL
    CHECK (length(candidate_snapshot_digest) = 64)
    CHECK (candidate_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  finalized_slot INTEGER NOT NULL CHECK (finalized_slot > 0),
  finalized_slot_hash TEXT NOT NULL
    CHECK (length(finalized_slot_hash) = 64)
    CHECK (finalized_slot_hash NOT GLOB '*[^0-9a-f]*'),
  v1_selection_score TEXT NOT NULL
    CHECK (length(v1_selection_score) = 64)
    CHECK (v1_selection_score NOT GLOB '*[^0-9a-f]*'),
  selection_attestation_digest TEXT NOT NULL UNIQUE
    CHECK (length(selection_attestation_digest) = 64)
    CHECK (selection_attestation_digest NOT GLOB '*[^0-9a-f]*'),
  selected_at_utc TEXT NOT NULL
    CHECK (length(selected_at_utc) = 24)
    CHECK (selected_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(selected_at_utc) IS NOT NULL),
  UNIQUE (funding_round_id, selection_rank),
  UNIQUE (funding_round_id, candidate_id),
  UNIQUE (funding_round_id, v1_selection_score),
  UNIQUE (daily_selection_id, candidate_id),
  FOREIGN KEY (
    daily_epoch_id,
    funding_round_id,
    selection_policy_hash,
    selection_algorithm,
    selection_domain,
    candidate_snapshot_digest,
    finalized_slot_hash
  ) REFERENCES reward_v2_daily_epochs(
    daily_epoch_id,
    funding_round_id,
    selection_policy_hash,
    selection_algorithm,
    selection_domain,
    candidate_snapshot_digest,
    finalized_slot_hash
  ) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_selections_no_replace
BEFORE INSERT ON reward_v2_daily_selections
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_daily_selections AS existing
  WHERE existing.daily_selection_id = NEW.daily_selection_id
    OR existing.candidate_id = NEW.candidate_id
    OR (existing.funding_round_id = NEW.funding_round_id
      AND existing.selection_rank = NEW.selection_rank)
    OR (existing.funding_round_id = NEW.funding_round_id
      AND existing.v1_selection_score = NEW.v1_selection_score)
    OR existing.selection_attestation_digest = NEW.selection_attestation_digest
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 daily-selection rank and replay keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_selections_binding_guard
BEFORE INSERT ON reward_v2_daily_selections
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_daily_epochs AS epoch
  JOIN reward_v2_funding_rounds AS round
    ON round.funding_round_id = epoch.funding_round_id
  JOIN reward_v2_candidates AS candidate
    ON candidate.candidate_id = NEW.candidate_id
  WHERE epoch.daily_epoch_id = NEW.daily_epoch_id
    AND epoch.funding_round_id = NEW.funding_round_id
    AND epoch.origin_utc_day = candidate.origin_utc_day
    AND candidate.campaign_kind = 'DAILY'
    AND candidate.original_funding_round_at_utc = round.opens_at_utc
    AND NEW.selection_rank <= epoch.selected_count
    AND NEW.finalized_slot = epoch.finalized_slot
    AND NEW.selection_policy_hash = epoch.selection_policy_hash
    AND NEW.selection_algorithm = epoch.selection_algorithm
    AND NEW.selection_domain = epoch.selection_domain
    AND NEW.candidate_snapshot_digest = epoch.candidate_snapshot_digest
    AND NEW.finalized_slot_hash = epoch.finalized_slot_hash
    AND NEW.selected_at_utc = epoch.finalized_at_utc
)
BEGIN
  SELECT RAISE(ABORT, 'daily selection must bind one eligible daily candidate and its frozen epoch evidence');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_selections_contiguous_rank_guard
BEFORE INSERT ON reward_v2_daily_selections
WHEN NEW.selection_rank IS NOT (
    SELECT coalesce(max(existing.selection_rank), 0) + 1
    FROM reward_v2_daily_selections AS existing
    WHERE existing.daily_epoch_id = NEW.daily_epoch_id
  )
  OR (
    NEW.selection_rank > 1
    AND NEW.v1_selection_score <= (
      SELECT previous.v1_selection_score
      FROM reward_v2_daily_selections AS previous
      WHERE previous.daily_epoch_id = NEW.daily_epoch_id
        AND previous.selection_rank = NEW.selection_rank - 1
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'daily selection rank must be contiguous and ordered by ascending V1 score within its epoch');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_selections_no_update
BEFORE UPDATE ON reward_v2_daily_selections
BEGIN
  SELECT RAISE(ABORT, 'reward v2 daily selections are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_daily_selections_no_delete
BEFORE DELETE ON reward_v2_daily_selections
BEGIN
  SELECT RAISE(ABORT, 'reward v2 daily selections cannot be retried or recycled');
END;

CREATE TABLE IF NOT EXISTS reward_v2_allocator_batches (
  allocator_batch_id TEXT PRIMARY KEY
    CHECK (length(allocator_batch_id) BETWEEN 8 AND 128)
    CHECK (allocator_batch_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  funding_round_id TEXT NOT NULL UNIQUE
    REFERENCES reward_v2_funding_rounds(funding_round_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  batch_kind TEXT NOT NULL
    CHECK (batch_kind IN ('GLOBAL_ALLOCATOR_V1', 'UTC_BOUNDARY_NULL_V1')),
  allocator_batch_digest TEXT NOT NULL UNIQUE
    CHECK (length(allocator_batch_digest) = 64)
    CHECK (allocator_batch_digest NOT GLOB '*[^0-9a-f]*'),
  candidate_snapshot_digest TEXT NOT NULL
    CHECK (length(candidate_snapshot_digest) = 64)
    CHECK (candidate_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  lane_reservation_snapshot_digest TEXT NOT NULL
    CHECK (length(lane_reservation_snapshot_digest) = 64)
    CHECK (lane_reservation_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  authentication_evidence_digest TEXT NOT NULL UNIQUE
    CHECK (length(authentication_evidence_digest) = 64)
    CHECK (authentication_evidence_digest NOT GLOB '*[^0-9a-f]*'),
  decided_at_utc TEXT NOT NULL
    CHECK (length(decided_at_utc) = 24)
    CHECK (decided_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(decided_at_utc) IS NOT NULL),
  recorded_at_utc TEXT NOT NULL
    CHECK (length(recorded_at_utc) = 24)
    CHECK (recorded_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(recorded_at_utc) IS NOT NULL),
  runtime_authentication_verified INTEGER NOT NULL
    CHECK (runtime_authentication_verified = 0),
  CHECK (unixepoch(recorded_at_utc) >= unixepoch(decided_at_utc)),
  UNIQUE (
    allocator_batch_id,
    funding_round_id,
    allocator_batch_digest,
    candidate_snapshot_digest,
    lane_reservation_snapshot_digest
  )
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_batches_no_replace
BEFORE INSERT ON reward_v2_allocator_batches
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_allocator_batches AS existing
  WHERE existing.allocator_batch_id = NEW.allocator_batch_id
    OR existing.funding_round_id = NEW.funding_round_id
    OR existing.allocator_batch_digest = NEW.allocator_batch_digest
    OR existing.authentication_evidence_digest = NEW.authentication_evidence_digest
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator-batch identity and authentication keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_batches_round_guard
BEFORE INSERT ON reward_v2_allocator_batches
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_funding_rounds AS round
  WHERE round.funding_round_id = NEW.funding_round_id
    AND (
      (NEW.batch_kind = 'GLOBAL_ALLOCATOR_V1'
        AND round.state = 'global_allocator_pending'
        AND round.sealed_at_utc = round.opens_at_utc
        AND round.candidate_snapshot_digest = NEW.candidate_snapshot_digest
        AND round.lane_reservation_snapshot_digest = NEW.lane_reservation_snapshot_digest
        AND unixepoch(NEW.decided_at_utc) >= unixepoch(round.opens_at_utc))
      OR
      (NEW.batch_kind = 'UTC_BOUNDARY_NULL_V1'
        AND round.state = 'null'
        AND unixepoch(NEW.decided_at_utc) >= unixepoch(round.miss_decidable_at_utc))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'allocator batch must antecede receipts and bind the exact pending seal or terminal boundary null');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_batches_no_update
BEFORE UPDATE ON reward_v2_allocator_batches
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator batches are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_batches_no_delete
BEFORE DELETE ON reward_v2_allocator_batches
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator batches cannot be replaced, retried, or recycled');
END;

CREATE TABLE IF NOT EXISTS reward_v2_allocator_receipts (
  allocator_receipt_id TEXT PRIMARY KEY
    CHECK (length(allocator_receipt_id) BETWEEN 8 AND 128)
    CHECK (allocator_receipt_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  allocator_batch_id TEXT NOT NULL,
  funding_round_id TEXT NOT NULL,
  allocator_batch_digest TEXT NOT NULL
    CHECK (length(allocator_batch_digest) = 64)
    CHECK (allocator_batch_digest NOT GLOB '*[^0-9a-f]*'),
  candidate_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  daily_selection_id TEXT,
  genesis_acceptance_id TEXT,
  tranche_kind TEXT NOT NULL
    CHECK (tranche_kind IN ('X_BASE_10', 'X_PREMIUM_FULL_100', 'X_PREMIUM_UPGRADE_90')),
  tranche_basis_points INTEGER NOT NULL,
  funding_class TEXT NOT NULL
    CHECK (funding_class = 'STANDARD_10_PERCENT_AND_X_CAMPAIGN'),
  amount_base_units INTEGER NOT NULL CHECK (amount_base_units > 0),
  premium_observation_id TEXT,
  eligibility_sequence INTEGER NOT NULL CHECK (eligibility_sequence > 0),
  candidate_snapshot_digest TEXT NOT NULL
    CHECK (length(candidate_snapshot_digest) = 64)
    CHECK (candidate_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  lane_reservation_snapshot_digest TEXT NOT NULL
    CHECK (length(lane_reservation_snapshot_digest) = 64)
    CHECK (lane_reservation_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  allocator_decision_digest TEXT NOT NULL UNIQUE
    CHECK (length(allocator_decision_digest) = 64)
    CHECK (allocator_decision_digest NOT GLOB '*[^0-9a-f]*'),
  allocator_receipt_digest TEXT NOT NULL UNIQUE
    CHECK (length(allocator_receipt_digest) = 64)
    CHECK (allocator_receipt_digest NOT GLOB '*[^0-9a-f]*'),
  disposition TEXT NOT NULL CHECK (disposition IN (
    'ADMITTED_RESERVED',
    'NULL_UNDERFUNDED',
    'NULL_BLOCKED',
    'NULL_MISSED',
    'NULL_PARENT_UNFUNDED',
    'NULL_CLAIM_EXPIRED',
    'NULL_POLICY_HOLD',
    'NULL_EVIDENCE_HELD',
    'NULL_PREMIUM_PROOF_STALE',
    'NULL_ALLOCATOR_ABSENT'
  )),
  null_reason TEXT CHECK (null_reason IS NULL OR null_reason IN (
    'daily_unfulfilled_at_utc_boundary',
    'global_allocator_absent',
    'insufficient_full_tranche_capacity',
    'waterfall_blocked_by_higher_priority',
    'parent_tranche_unfunded',
    'identity_or_evidence_held',
    'premium_upgrade_proof_not_fresh',
    'claim_window_expired',
    'policy_hold'
  )),
  decided_at_utc TEXT NOT NULL
    CHECK (length(decided_at_utc) = 24)
    CHECK (decided_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(decided_at_utc) IS NOT NULL),
  partial_payment_allowed INTEGER NOT NULL CHECK (partial_payment_allowed = 0),
  retry_allowed INTEGER NOT NULL CHECK (retry_allowed = 0),
  recycling_allowed INTEGER NOT NULL CHECK (recycling_allowed = 0),
  CHECK (
    (tranche_kind = 'X_BASE_10' AND tranche_basis_points = 1000)
    OR (tranche_kind = 'X_PREMIUM_FULL_100' AND tranche_basis_points = 10000)
    OR (tranche_kind = 'X_PREMIUM_UPGRADE_90' AND tranche_basis_points = 9000)
  ),
  CHECK (
    (disposition = 'ADMITTED_RESERVED' AND null_reason IS NULL)
    OR (disposition = 'NULL_UNDERFUNDED' AND null_reason = 'insufficient_full_tranche_capacity')
    OR (disposition = 'NULL_BLOCKED' AND null_reason = 'waterfall_blocked_by_higher_priority')
    OR (disposition = 'NULL_MISSED' AND null_reason = 'daily_unfulfilled_at_utc_boundary')
    OR (disposition = 'NULL_PARENT_UNFUNDED' AND null_reason = 'parent_tranche_unfunded')
    OR (disposition = 'NULL_CLAIM_EXPIRED' AND null_reason = 'claim_window_expired')
    OR (disposition = 'NULL_POLICY_HOLD' AND null_reason = 'policy_hold')
    OR (disposition = 'NULL_EVIDENCE_HELD' AND null_reason = 'identity_or_evidence_held')
    OR (disposition = 'NULL_PREMIUM_PROOF_STALE' AND null_reason = 'premium_upgrade_proof_not_fresh')
    OR (disposition = 'NULL_ALLOCATOR_ABSENT' AND null_reason = 'global_allocator_absent')
  ),
  UNIQUE (candidate_id, tranche_kind),
  UNIQUE (allocator_receipt_id, candidate_id, tranche_kind),
  FOREIGN KEY (
    allocator_batch_id,
    funding_round_id,
    allocator_batch_digest,
    candidate_snapshot_digest,
    lane_reservation_snapshot_digest
  ) REFERENCES reward_v2_allocator_batches(
    allocator_batch_id,
    funding_round_id,
    allocator_batch_digest,
    candidate_snapshot_digest,
    lane_reservation_snapshot_digest
  ) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (candidate_id, node_id)
    REFERENCES reward_v2_candidates(candidate_id, node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (daily_selection_id, candidate_id)
    REFERENCES reward_v2_daily_selections(daily_selection_id, candidate_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (candidate_id, genesis_acceptance_id)
    REFERENCES reward_v2_candidates(candidate_id, genesis_acceptance_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (premium_observation_id, node_id)
    REFERENCES reward_v2_tier_observations(observation_id, node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_receipts_no_replace
BEFORE INSERT ON reward_v2_allocator_receipts
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_allocator_receipts AS existing
  WHERE existing.allocator_receipt_id = NEW.allocator_receipt_id
    OR existing.allocator_decision_digest = NEW.allocator_decision_digest
    OR existing.allocator_receipt_digest = NEW.allocator_receipt_digest
    OR (existing.candidate_id = NEW.candidate_id
      AND existing.tranche_kind = NEW.tranche_kind)
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator-receipt identity and tranche keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_receipts_campaign_guard
BEFORE INSERT ON reward_v2_allocator_receipts
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_candidates AS candidate
  LEFT JOIN reward_v2_daily_selections AS selection
    ON selection.daily_selection_id = NEW.daily_selection_id
    AND selection.candidate_id = candidate.candidate_id
  WHERE candidate.candidate_id = NEW.candidate_id
    AND candidate.node_id = NEW.node_id
    AND (
      (candidate.campaign_kind = 'DAILY'
        AND NEW.daily_selection_id IS NOT NULL
        AND NEW.genesis_acceptance_id IS NULL
        AND selection.candidate_id = candidate.candidate_id)
      OR
      (candidate.campaign_kind = 'GENESIS'
        AND NEW.daily_selection_id IS NULL
        AND NEW.genesis_acceptance_id = candidate.genesis_acceptance_id)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'allocator receipt requires the immutable Daily selection or Genesis acceptance');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_receipts_round_guard
BEFORE INSERT ON reward_v2_allocator_receipts
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_allocator_batches AS batch
  JOIN reward_v2_funding_rounds AS round
    ON round.funding_round_id = batch.funding_round_id
  JOIN reward_v2_candidates AS candidate
    ON candidate.candidate_id = NEW.candidate_id
  LEFT JOIN reward_v2_tier_observations AS premium_observation
    ON premium_observation.observation_id = NEW.premium_observation_id
    AND premium_observation.node_id = candidate.node_id
  WHERE batch.allocator_batch_id = NEW.allocator_batch_id
    AND batch.funding_round_id = NEW.funding_round_id
    AND batch.allocator_batch_digest = NEW.allocator_batch_digest
    AND batch.candidate_snapshot_digest = NEW.candidate_snapshot_digest
    AND batch.lane_reservation_snapshot_digest = NEW.lane_reservation_snapshot_digest
    AND batch.decided_at_utc = NEW.decided_at_utc
    AND (
      (batch.batch_kind = 'GLOBAL_ALLOCATOR_V1' AND round.state = 'global_allocator_pending')
      OR (batch.batch_kind = 'UTC_BOUNDARY_NULL_V1'
        AND round.state = 'null'
        AND NEW.disposition <> 'ADMITTED_RESERVED')
    )
    AND (NEW.disposition = 'ADMITTED_RESERVED'
      OR unixepoch(NEW.decided_at_utc) >= unixepoch(round.miss_decidable_at_utc))
    AND (
      (NEW.tranche_kind IN ('X_BASE_10', 'X_PREMIUM_FULL_100')
        AND round.opens_at_utc = candidate.original_funding_round_at_utc)
      OR
      (NEW.tranche_kind = 'X_PREMIUM_UPGRADE_90'
        AND unixepoch(round.opens_at_utc) > unixepoch(candidate.original_funding_round_at_utc)
        AND unixepoch(round.opens_at_utc) =
          unixepoch(substr(premium_observation.accepted_at_utc, 1, 10) || 'T00:00:00.000Z') + 86400)
    )
    AND (NEW.disposition <> 'ADMITTED_RESERVED'
      OR unixepoch(NEW.decided_at_utc) < unixepoch(candidate.claim_expires_at_utc))
)
BEGIN
  SELECT RAISE(ABORT, 'allocator receipt must bind its antecedent batch, exact round, seal, and claim window');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_receipts_tranche_guard
BEFORE INSERT ON reward_v2_allocator_receipts
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_candidates AS candidate
  JOIN reward_v2_tier_observations AS initial_observation
    ON initial_observation.observation_id = candidate.initial_tier_observation_id
  LEFT JOIN reward_v2_tier_observations AS premium_observation
    ON premium_observation.observation_id = NEW.premium_observation_id
    AND premium_observation.node_id = candidate.node_id
  WHERE candidate.candidate_id = NEW.candidate_id
    AND candidate.node_id = NEW.node_id
    AND (
      (NEW.tranche_kind = 'X_BASE_10'
        AND initial_observation.tier IN ('None', 'Basic')
        AND NEW.premium_observation_id IS NULL
        AND NEW.amount_base_units = candidate.nominal_full_reward_base_units / 10
        AND NEW.eligibility_sequence = candidate.base_eligibility_sequence)
      OR
      (NEW.tranche_kind = 'X_PREMIUM_FULL_100'
        AND initial_observation.tier IN ('Premium', 'PremiumPlus')
        AND NEW.premium_observation_id IS NULL
        AND NEW.amount_base_units = candidate.nominal_full_reward_base_units
        AND NEW.eligibility_sequence = candidate.base_eligibility_sequence)
      OR
      (NEW.tranche_kind = 'X_PREMIUM_UPGRADE_90'
        AND initial_observation.tier IN ('None', 'Basic')
        AND premium_observation.tier IN ('Premium', 'PremiumPlus')
        AND premium_observation.observation_history_sequence > candidate.base_eligibility_sequence
        AND unixepoch(premium_observation.accepted_at_utc) > unixepoch(candidate.original_funding_round_at_utc)
        AND unixepoch(NEW.decided_at_utc) >= unixepoch(premium_observation.accepted_at_utc)
        AND unixepoch(NEW.decided_at_utc) < unixepoch(premium_observation.fresh_until_utc)
        AND NEW.amount_base_units = candidate.nominal_full_reward_base_units - (candidate.nominal_full_reward_base_units / 10)
        AND NEW.eligibility_sequence = premium_observation.observation_history_sequence
        AND (
          NEW.disposition <> 'ADMITTED_RESERVED'
          OR EXISTS (
            SELECT 1
            FROM reward_v2_allocator_receipts AS base_receipt
            WHERE base_receipt.candidate_id = candidate.candidate_id
              AND base_receipt.node_id = candidate.node_id
              AND base_receipt.tranche_kind = 'X_BASE_10'
              AND base_receipt.disposition = 'ADMITTED_RESERVED'
              AND unixepoch(base_receipt.decided_at_utc) < unixepoch(NEW.decided_at_utc)
          )
        ))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'allocator receipt violates exact atomic tranche or Premium-upgrade ancestry');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_receipts_no_update
BEFORE UPDATE ON reward_v2_allocator_receipts
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator receipts are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_receipts_no_delete
BEFORE DELETE ON reward_v2_allocator_receipts
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator receipts cannot be replaced, retried, or recycled');
END;

CREATE TABLE IF NOT EXISTS reward_v2_allocator_grants (
  grant_id TEXT PRIMARY KEY
    CHECK (length(grant_id) BETWEEN 8 AND 128)
    CHECK (grant_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  allocator_receipt_id TEXT NOT NULL UNIQUE
    REFERENCES reward_v2_allocator_receipts(allocator_receipt_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  funding_round_id TEXT NOT NULL REFERENCES reward_v2_funding_rounds(funding_round_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  candidate_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  daily_selection_id TEXT,
  genesis_acceptance_id TEXT,
  tranche_kind TEXT NOT NULL CHECK (tranche_kind IN ('X_BASE_10', 'X_PREMIUM_FULL_100', 'X_PREMIUM_UPGRADE_90')),
  tranche_basis_points INTEGER NOT NULL,
  funding_class TEXT NOT NULL CHECK (funding_class = 'STANDARD_10_PERCENT_AND_X_CAMPAIGN'),
  amount_base_units INTEGER NOT NULL CHECK (amount_base_units > 0),
  premium_observation_id TEXT,
  eligibility_sequence INTEGER NOT NULL CHECK (eligibility_sequence > 0),
  candidate_snapshot_digest TEXT NOT NULL
    CHECK (length(candidate_snapshot_digest) = 64)
    CHECK (candidate_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  lane_reservation_snapshot_digest TEXT NOT NULL
    CHECK (length(lane_reservation_snapshot_digest) = 64)
    CHECK (lane_reservation_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  allocator_decision_digest TEXT NOT NULL UNIQUE
    CHECK (length(allocator_decision_digest) = 64)
    CHECK (allocator_decision_digest NOT GLOB '*[^0-9a-f]*'),
  allocator_receipt_digest TEXT NOT NULL UNIQUE
    CHECK (length(allocator_receipt_digest) = 64)
    CHECK (allocator_receipt_digest NOT GLOB '*[^0-9a-f]*'),
  allocated_at_utc TEXT NOT NULL
    CHECK (length(allocated_at_utc) = 24)
    CHECK (allocated_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(allocated_at_utc) IS NOT NULL),
  partial_payment_allowed INTEGER NOT NULL CHECK (partial_payment_allowed = 0),
  retry_allowed INTEGER NOT NULL CHECK (retry_allowed = 0),
  recycling_allowed INTEGER NOT NULL CHECK (recycling_allowed = 0),
  CHECK (
    (tranche_kind = 'X_BASE_10' AND tranche_basis_points = 1000)
    OR (tranche_kind = 'X_PREMIUM_FULL_100' AND tranche_basis_points = 10000)
    OR (tranche_kind = 'X_PREMIUM_UPGRADE_90' AND tranche_basis_points = 9000)
  ),
  UNIQUE (candidate_id, tranche_kind),
  UNIQUE (grant_id, candidate_id, tranche_kind),
  FOREIGN KEY (candidate_id, node_id)
    REFERENCES reward_v2_candidates(candidate_id, node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (daily_selection_id, candidate_id)
    REFERENCES reward_v2_daily_selections(daily_selection_id, candidate_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (candidate_id, genesis_acceptance_id)
    REFERENCES reward_v2_candidates(candidate_id, genesis_acceptance_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (premium_observation_id, node_id)
    REFERENCES reward_v2_tier_observations(observation_id, node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_no_replace
BEFORE INSERT ON reward_v2_allocator_grants
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_allocator_grants AS existing
  WHERE existing.grant_id = NEW.grant_id
    OR existing.allocator_receipt_id = NEW.allocator_receipt_id
    OR existing.allocator_decision_digest = NEW.allocator_decision_digest
    OR existing.allocator_receipt_digest = NEW.allocator_receipt_digest
    OR (existing.candidate_id = NEW.candidate_id
      AND existing.tranche_kind = NEW.tranche_kind)
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator-grant identity and tranche keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_receipt_guard
BEFORE INSERT ON reward_v2_allocator_grants
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_allocator_receipts AS receipt
  WHERE receipt.allocator_receipt_id = NEW.allocator_receipt_id
    AND receipt.funding_round_id = NEW.funding_round_id
    AND receipt.candidate_id = NEW.candidate_id
    AND receipt.node_id = NEW.node_id
    AND receipt.daily_selection_id IS NEW.daily_selection_id
    AND receipt.genesis_acceptance_id IS NEW.genesis_acceptance_id
    AND receipt.tranche_kind = NEW.tranche_kind
    AND receipt.tranche_basis_points = NEW.tranche_basis_points
    AND receipt.funding_class = NEW.funding_class
    AND receipt.amount_base_units = NEW.amount_base_units
    AND receipt.premium_observation_id IS NEW.premium_observation_id
    AND receipt.eligibility_sequence = NEW.eligibility_sequence
    AND receipt.candidate_snapshot_digest = NEW.candidate_snapshot_digest
    AND receipt.lane_reservation_snapshot_digest = NEW.lane_reservation_snapshot_digest
    AND receipt.allocator_decision_digest = NEW.allocator_decision_digest
    AND receipt.allocator_receipt_digest = NEW.allocator_receipt_digest
    AND receipt.decided_at_utc = NEW.allocated_at_utc
    AND receipt.disposition = 'ADMITTED_RESERVED'
    AND receipt.null_reason IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'allocator grant requires one antecedent admitted allocator receipt with exact matching fields');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_campaign_evidence_guard
BEFORE INSERT ON reward_v2_allocator_grants
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_candidates AS candidate
  LEFT JOIN reward_v2_daily_selections AS selection
    ON selection.daily_selection_id = NEW.daily_selection_id
    AND selection.candidate_id = candidate.candidate_id
  WHERE candidate.candidate_id = NEW.candidate_id
    AND (
      (candidate.campaign_kind = 'DAILY'
        AND NEW.daily_selection_id IS NOT NULL
        AND NEW.genesis_acceptance_id IS NULL
        AND selection.funding_round_id = (
          SELECT round.funding_round_id
          FROM reward_v2_funding_rounds AS round
          WHERE round.opens_at_utc = candidate.original_funding_round_at_utc
        ))
      OR
      (candidate.campaign_kind = 'GENESIS'
        AND NEW.daily_selection_id IS NULL
        AND NEW.genesis_acceptance_id = candidate.genesis_acceptance_id)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'allocator grant requires the immutable daily selection or Genesis acceptance for its campaign');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_round_guard
BEFORE INSERT ON reward_v2_allocator_grants
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_funding_rounds AS round
  JOIN reward_v2_candidates AS candidate ON candidate.candidate_id = NEW.candidate_id
  WHERE round.funding_round_id = NEW.funding_round_id
    AND round.state = 'global_allocator_pending'
    AND round.sealed_at_utc = round.opens_at_utc
    AND round.funding_class = NEW.funding_class
    AND round.candidate_snapshot_digest = NEW.candidate_snapshot_digest
    AND round.lane_reservation_snapshot_digest = NEW.lane_reservation_snapshot_digest
    AND unixepoch(NEW.allocated_at_utc) >= unixepoch(round.opens_at_utc)
    AND unixepoch(NEW.allocated_at_utc) < unixepoch(candidate.claim_expires_at_utc)
    AND (
      (NEW.tranche_kind IN ('X_BASE_10', 'X_PREMIUM_FULL_100')
        AND round.opens_at_utc = candidate.original_funding_round_at_utc)
      OR
      (NEW.tranche_kind = 'X_PREMIUM_UPGRADE_90' AND unixepoch(round.opens_at_utc) = (
        SELECT unixepoch(substr(observation.accepted_at_utc, 1, 10) || 'T00:00:00.000Z') + 86400
        FROM reward_v2_tier_observations AS observation
        WHERE observation.observation_id = NEW.premium_observation_id
      ) AND unixepoch(round.opens_at_utc) > unixepoch(candidate.original_funding_round_at_utc))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'allocator grant requires the exact open UTC funding round and an unexpired candidate');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_tranche_guard
BEFORE INSERT ON reward_v2_allocator_grants
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_candidates AS candidate
  JOIN reward_v2_tier_observations AS initial_observation
    ON initial_observation.observation_id = candidate.initial_tier_observation_id
  LEFT JOIN reward_v2_tier_observations AS premium_observation
    ON premium_observation.observation_id = NEW.premium_observation_id
    AND premium_observation.node_id = candidate.node_id
  WHERE candidate.candidate_id = NEW.candidate_id
    AND candidate.node_id = NEW.node_id
    AND (
      (NEW.tranche_kind = 'X_BASE_10'
        AND initial_observation.tier IN ('None', 'Basic')
        AND NEW.premium_observation_id IS NULL
        AND NEW.amount_base_units = candidate.nominal_full_reward_base_units / 10
        AND NEW.eligibility_sequence = candidate.base_eligibility_sequence)
      OR
      (NEW.tranche_kind = 'X_PREMIUM_FULL_100'
        AND initial_observation.tier IN ('Premium', 'PremiumPlus')
        AND NEW.premium_observation_id IS NULL
        AND NEW.amount_base_units = candidate.nominal_full_reward_base_units
        AND NEW.eligibility_sequence = candidate.base_eligibility_sequence)
      OR
      (NEW.tranche_kind = 'X_PREMIUM_UPGRADE_90'
        AND initial_observation.tier IN ('None', 'Basic')
        AND premium_observation.tier IN ('Premium', 'PremiumPlus')
        AND premium_observation.observation_history_sequence > candidate.base_eligibility_sequence
        AND unixepoch(premium_observation.accepted_at_utc) > unixepoch(candidate.original_funding_round_at_utc)
        AND unixepoch(NEW.allocated_at_utc) >= unixepoch(premium_observation.accepted_at_utc)
        AND unixepoch(NEW.allocated_at_utc) < unixepoch(premium_observation.fresh_until_utc)
        AND NEW.amount_base_units = candidate.nominal_full_reward_base_units - (candidate.nominal_full_reward_base_units / 10)
        AND NEW.eligibility_sequence = premium_observation.observation_history_sequence
        AND EXISTS (
          SELECT 1
          FROM reward_v2_allocator_receipts AS base_receipt
          WHERE base_receipt.candidate_id = candidate.candidate_id
            AND base_receipt.node_id = candidate.node_id
            AND base_receipt.tranche_kind = 'X_BASE_10'
            AND base_receipt.disposition = 'ADMITTED_RESERVED'
            AND unixepoch(base_receipt.decided_at_utc) < unixepoch(NEW.allocated_at_utc)
        ))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'allocator grant violates atomic base or same-identity fresh Premium-upgrade semantics');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_null_exclusion
BEFORE INSERT ON reward_v2_allocator_grants
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_null_receipts AS receipt
  WHERE receipt.candidate_id = NEW.candidate_id
    AND receipt.tranche_kind = NEW.tranche_kind
)
BEGIN
  SELECT RAISE(ABORT, 'a nulled tranche cannot be retried or funded');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_no_update
BEFORE UPDATE ON reward_v2_allocator_grants
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator grants are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_allocator_grants_no_delete
BEFORE DELETE ON reward_v2_allocator_grants
BEGIN
  SELECT RAISE(ABORT, 'reward v2 allocator grants cannot be recycled');
END;

CREATE TABLE IF NOT EXISTS reward_v2_null_receipts (
  null_receipt_id TEXT PRIMARY KEY
    CHECK (length(null_receipt_id) BETWEEN 8 AND 128)
    CHECK (null_receipt_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  allocator_receipt_id TEXT NOT NULL UNIQUE
    REFERENCES reward_v2_allocator_receipts(allocator_receipt_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  funding_round_id TEXT NOT NULL REFERENCES reward_v2_funding_rounds(funding_round_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  allocator_batch_digest TEXT NOT NULL
    CHECK (length(allocator_batch_digest) = 64)
    CHECK (allocator_batch_digest NOT GLOB '*[^0-9a-f]*'),
  candidate_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  tranche_kind TEXT NOT NULL CHECK (tranche_kind IN ('X_BASE_10', 'X_PREMIUM_FULL_100', 'X_PREMIUM_UPGRADE_90')),
  tranche_basis_points INTEGER NOT NULL,
  funding_class TEXT NOT NULL CHECK (funding_class = 'STANDARD_10_PERCENT_AND_X_CAMPAIGN'),
  amount_base_units INTEGER NOT NULL CHECK (amount_base_units > 0),
  eligibility_sequence INTEGER NOT NULL CHECK (eligibility_sequence > 0),
  candidate_snapshot_digest TEXT NOT NULL
    CHECK (length(candidate_snapshot_digest) = 64)
    CHECK (candidate_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  lane_reservation_snapshot_digest TEXT NOT NULL
    CHECK (length(lane_reservation_snapshot_digest) = 64)
    CHECK (lane_reservation_snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  allocator_decision_digest TEXT NOT NULL UNIQUE
    CHECK (length(allocator_decision_digest) = 64)
    CHECK (allocator_decision_digest NOT GLOB '*[^0-9a-f]*'),
  allocator_receipt_digest TEXT NOT NULL UNIQUE
    CHECK (length(allocator_receipt_digest) = 64)
    CHECK (allocator_receipt_digest NOT GLOB '*[^0-9a-f]*'),
  null_reason TEXT NOT NULL CHECK (null_reason IN (
    'daily_unfulfilled_at_utc_boundary',
    'global_allocator_absent',
    'insufficient_full_tranche_capacity',
    'waterfall_blocked_by_higher_priority',
    'parent_tranche_unfunded',
    'identity_or_evidence_held',
    'premium_upgrade_proof_not_fresh',
    'claim_window_expired',
    'policy_hold'
  )),
  nullified_at_utc TEXT NOT NULL
    CHECK (length(nullified_at_utc) = 24)
    CHECK (nullified_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(nullified_at_utc) IS NOT NULL),
  null_receipt_digest TEXT NOT NULL UNIQUE
    CHECK (length(null_receipt_digest) = 64)
    CHECK (null_receipt_digest NOT GLOB '*[^0-9a-f]*'),
  retry_allowed INTEGER NOT NULL CHECK (retry_allowed = 0),
  recycling_allowed INTEGER NOT NULL CHECK (recycling_allowed = 0),
  CHECK (
    (tranche_kind = 'X_BASE_10' AND tranche_basis_points = 1000)
    OR (tranche_kind = 'X_PREMIUM_FULL_100' AND tranche_basis_points = 10000)
    OR (tranche_kind = 'X_PREMIUM_UPGRADE_90' AND tranche_basis_points = 9000)
  ),
  UNIQUE (candidate_id, tranche_kind),
  FOREIGN KEY (candidate_id, node_id)
    REFERENCES reward_v2_candidates(candidate_id, node_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_null_receipts_no_replace
BEFORE INSERT ON reward_v2_null_receipts
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_null_receipts AS existing
  WHERE existing.null_receipt_id = NEW.null_receipt_id
    OR existing.allocator_receipt_id = NEW.allocator_receipt_id
    OR existing.allocator_decision_digest = NEW.allocator_decision_digest
    OR existing.allocator_receipt_digest = NEW.allocator_receipt_digest
    OR existing.null_receipt_digest = NEW.null_receipt_digest
    OR (existing.candidate_id = NEW.candidate_id
      AND existing.tranche_kind = NEW.tranche_kind)
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 null-receipt identity and tranche keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_null_receipts_allocator_guard
BEFORE INSERT ON reward_v2_null_receipts
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_allocator_receipts AS receipt
  WHERE receipt.allocator_receipt_id = NEW.allocator_receipt_id
    AND receipt.funding_round_id = NEW.funding_round_id
    AND receipt.allocator_batch_digest = NEW.allocator_batch_digest
    AND receipt.candidate_id = NEW.candidate_id
    AND receipt.node_id = NEW.node_id
    AND receipt.tranche_kind = NEW.tranche_kind
    AND receipt.tranche_basis_points = NEW.tranche_basis_points
    AND receipt.funding_class = NEW.funding_class
    AND receipt.amount_base_units = NEW.amount_base_units
    AND receipt.eligibility_sequence = NEW.eligibility_sequence
    AND receipt.candidate_snapshot_digest = NEW.candidate_snapshot_digest
    AND receipt.lane_reservation_snapshot_digest = NEW.lane_reservation_snapshot_digest
    AND receipt.allocator_decision_digest = NEW.allocator_decision_digest
    AND receipt.allocator_receipt_digest = NEW.allocator_receipt_digest
    AND receipt.decided_at_utc = NEW.nullified_at_utc
    AND receipt.disposition <> 'ADMITTED_RESERVED'
    AND receipt.null_reason = NEW.null_reason
)
BEGIN
  SELECT RAISE(ABORT, 'null receipt requires one antecedent allocator receipt with exact matching fields');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_null_receipts_original_tier_guard
BEFORE INSERT ON reward_v2_null_receipts
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_candidates AS candidate
  JOIN reward_v2_tier_observations AS observation
    ON observation.observation_id = candidate.initial_tier_observation_id
  WHERE candidate.candidate_id = NEW.candidate_id
    AND (
      (observation.tier IN ('None', 'Basic') AND NEW.tranche_kind IN ('X_BASE_10', 'X_PREMIUM_UPGRADE_90'))
      OR
      (observation.tier IN ('Premium', 'PremiumPlus') AND NEW.tranche_kind = 'X_PREMIUM_FULL_100')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'null receipt tranche must match the candidate original tier');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_null_receipts_grant_exclusion
BEFORE INSERT ON reward_v2_null_receipts
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_allocator_grants AS grant
  WHERE grant.candidate_id = NEW.candidate_id
    AND grant.tranche_kind = NEW.tranche_kind
)
BEGIN
  SELECT RAISE(ABORT, 'a funded tranche cannot also be null');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_null_receipts_boundary_guard
BEFORE INSERT ON reward_v2_null_receipts
WHEN NOT EXISTS (
    SELECT 1
    FROM reward_v2_funding_rounds AS round
    WHERE round.funding_round_id = NEW.funding_round_id
      AND unixepoch(NEW.nullified_at_utc) >= unixepoch(round.miss_decidable_at_utc)
  )
BEGIN
  SELECT RAISE(ABORT, 'null receipt cannot precede its exact miss-decidable instant');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_null_receipts_no_update
BEFORE UPDATE ON reward_v2_null_receipts
BEGIN
  SELECT RAISE(ABORT, 'reward v2 null receipts are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_null_receipts_no_delete
BEFORE DELETE ON reward_v2_null_receipts
BEGIN
  SELECT RAISE(ABORT, 'reward v2 null receipts cannot be retried or recycled');
END;

CREATE TABLE IF NOT EXISTS reward_v2_terminal_receipts (
  terminal_receipt_id TEXT PRIMARY KEY
    CHECK (length(terminal_receipt_id) BETWEEN 8 AND 128)
    CHECK (terminal_receipt_id NOT GLOB '*[^A-Za-z0-9:_-]*'),
  grant_id TEXT NOT NULL UNIQUE REFERENCES reward_v2_allocator_grants(grant_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('paid_full', 'expired_unpaid')),
  destination_wallet_address TEXT,
  amount_base_units INTEGER NOT NULL CHECK (amount_base_units >= 0),
  transaction_evidence_digest TEXT UNIQUE
    CHECK (transaction_evidence_digest IS NULL OR (
      length(transaction_evidence_digest) = 64
      AND transaction_evidence_digest NOT GLOB '*[^0-9a-f]*'
    )),
  terminal_at_utc TEXT NOT NULL
    CHECK (length(terminal_at_utc) = 24)
    CHECK (terminal_at_utc GLOB '????-??-??T??:??:??.???Z')
    CHECK (unixepoch(terminal_at_utc) IS NOT NULL),
  terminal_receipt_digest TEXT NOT NULL UNIQUE
    CHECK (length(terminal_receipt_digest) = 64)
    CHECK (terminal_receipt_digest NOT GLOB '*[^0-9a-f]*'),
  null_reason TEXT CHECK (null_reason IS NULL OR null_reason = 'claim_window_expired'),
  retry_count INTEGER NOT NULL CHECK (retry_count = 0),
  recycling_allowed INTEGER NOT NULL CHECK (recycling_allowed = 0),
  CHECK (
    (outcome = 'paid_full'
      AND destination_wallet_address IS NOT NULL
      AND amount_base_units > 0
      AND transaction_evidence_digest IS NOT NULL
      AND null_reason IS NULL)
    OR
    (outcome = 'expired_unpaid'
      AND destination_wallet_address IS NULL
      AND amount_base_units = 0
      AND transaction_evidence_digest IS NULL
      AND null_reason = 'claim_window_expired')
  )
) STRICT;

CREATE TRIGGER IF NOT EXISTS reward_v2_terminal_receipts_no_replace
BEFORE INSERT ON reward_v2_terminal_receipts
WHEN EXISTS (
  SELECT 1
  FROM reward_v2_terminal_receipts AS existing
  WHERE existing.terminal_receipt_id = NEW.terminal_receipt_id
    OR existing.grant_id = NEW.grant_id
    OR (NEW.transaction_evidence_digest IS NOT NULL
      AND existing.transaction_evidence_digest = NEW.transaction_evidence_digest)
    OR existing.terminal_receipt_digest = NEW.terminal_receipt_digest
)
BEGIN
  SELECT RAISE(ABORT, 'reward v2 terminal-receipt identity and evidence keys cannot be replaced');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_terminal_receipts_outcome_guard
BEFORE INSERT ON reward_v2_terminal_receipts
WHEN NOT EXISTS (
  SELECT 1
  FROM reward_v2_allocator_grants AS grant
  JOIN reward_v2_candidates AS candidate ON candidate.candidate_id = grant.candidate_id
  JOIN reward_v2_nodes AS node ON node.node_id = candidate.node_id
  WHERE grant.grant_id = NEW.grant_id
    AND (
      (NEW.outcome = 'paid_full'
        AND NEW.amount_base_units = grant.amount_base_units
        AND NEW.destination_wallet_address = node.wallet_address
        AND unixepoch(NEW.terminal_at_utc) >= unixepoch(grant.allocated_at_utc)
        AND unixepoch(NEW.terminal_at_utc) < unixepoch(candidate.claim_expires_at_utc))
      OR
      (NEW.outcome = 'expired_unpaid'
        AND unixepoch(NEW.terminal_at_utc) >= unixepoch(candidate.claim_expires_at_utc))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'terminal receipt must be one full payment or one non-recycled expiry');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_terminal_receipts_no_update
BEFORE UPDATE ON reward_v2_terminal_receipts
BEGIN
  SELECT RAISE(ABORT, 'reward v2 terminal receipts are append-only');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_terminal_receipts_no_delete
BEFORE DELETE ON reward_v2_terminal_receipts
BEGIN
  SELECT RAISE(ABORT, 'reward v2 terminal receipts cannot be retried or recycled');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_allocator_recorded_guard
BEFORE UPDATE OF state ON reward_v2_funding_rounds
WHEN NEW.state = 'allocator_recorded'
  AND NOT EXISTS (
    SELECT 1
    FROM reward_v2_allocator_batches AS batch
    WHERE batch.funding_round_id = NEW.funding_round_id
      AND batch.batch_kind = 'GLOBAL_ALLOCATOR_V1'
      AND batch.allocator_batch_digest = NEW.allocator_batch_digest
      AND batch.candidate_snapshot_digest = NEW.candidate_snapshot_digest
      AND batch.lane_reservation_snapshot_digest = NEW.lane_reservation_snapshot_digest
      AND NOT EXISTS (
        SELECT 1
        FROM reward_v2_allocator_receipts AS receipt
        WHERE receipt.allocator_batch_id = batch.allocator_batch_id
          AND (
            (receipt.disposition = 'ADMITTED_RESERVED' AND NOT EXISTS (
              SELECT 1 FROM reward_v2_allocator_grants AS grant
              WHERE grant.allocator_receipt_id = receipt.allocator_receipt_id
            ))
            OR
            (receipt.disposition <> 'ADMITTED_RESERVED' AND NOT EXISTS (
              SELECT 1 FROM reward_v2_null_receipts AS null_receipt
              WHERE null_receipt.allocator_receipt_id = receipt.allocator_receipt_id
            ))
          )
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'allocator-recorded round requires its immutable antecedent batch and every materialized decision receipt');
END;

CREATE TRIGGER IF NOT EXISTS reward_v2_funding_rounds_terminal_guard
BEFORE UPDATE OF state ON reward_v2_funding_rounds
WHEN NEW.state = 'terminal'
  AND EXISTS (
    SELECT 1
    FROM reward_v2_allocator_grants AS grant
    WHERE grant.funding_round_id = NEW.funding_round_id
      AND NOT EXISTS (
        SELECT 1
        FROM reward_v2_terminal_receipts AS terminal_receipt
        WHERE terminal_receipt.grant_id = grant.grant_id
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'terminal funding round requires one terminal receipt for every admitted grant');
END;

CREATE INDEX IF NOT EXISTS reward_v2_history_events_node_order_idx
ON reward_v2_history_events(node_id, history_sequence);

CREATE INDEX IF NOT EXISTS reward_v2_tier_observations_node_order_idx
ON reward_v2_tier_observations(node_id, observation_history_sequence);

CREATE INDEX IF NOT EXISTS reward_v2_tier_observations_tier_freshness_idx
ON reward_v2_tier_observations(tier, fresh_until_utc);

CREATE INDEX IF NOT EXISTS reward_v2_funding_rounds_state_day_idx
ON reward_v2_funding_rounds(state, utc_day);

CREATE INDEX IF NOT EXISTS reward_v2_qualifying_actions_type_day_idx
ON reward_v2_qualifying_actions(action_type, utc_day);

CREATE INDEX IF NOT EXISTS reward_v2_qualifying_actions_lookup_slot_idx
ON reward_v2_qualifying_actions(first_observed_finalized_slot)
WHERE action_type IN ('like', 'follow');

CREATE INDEX IF NOT EXISTS reward_v2_genesis_acceptances_order_idx
ON reward_v2_genesis_acceptances(genesis_rank, acceptance_sequence);

CREATE INDEX IF NOT EXISTS reward_v2_candidates_order_idx
ON reward_v2_candidates(campaign_kind, base_eligibility_sequence, node_id);

CREATE INDEX IF NOT EXISTS reward_v2_allocator_grants_waterfall_order_idx
ON reward_v2_allocator_grants(funding_class, eligibility_sequence, candidate_id);

CREATE INDEX IF NOT EXISTS reward_v2_allocator_batches_round_idx
ON reward_v2_allocator_batches(funding_round_id, batch_kind, decided_at_utc);

CREATE INDEX IF NOT EXISTS reward_v2_allocator_receipts_waterfall_order_idx
ON reward_v2_allocator_receipts(funding_class, eligibility_sequence, candidate_id);

CREATE INDEX IF NOT EXISTS reward_v2_null_receipts_reason_idx
ON reward_v2_null_receipts(null_reason, nullified_at_utc);

CREATE INDEX IF NOT EXISTS reward_v2_terminal_receipts_outcome_idx
ON reward_v2_terminal_receipts(outcome, terminal_at_utc);

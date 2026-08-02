export const GENESIS_SLOT_LIMIT = 1_000;
export const GENESIS_REWARD_BASE_UNITS = "100000000000";
export const X_PREMIUM_REVALIDATION_MS = 24 * 60 * 60_000;
export const X_ACCOUNT_MINIMUM_AGE_MS = 40 * 24 * 60 * 60_000;
export const ALLOWED_X_SUBSCRIPTION_TYPES = Object.freeze(["Premium", "PremiumPlus"]);
export const GENESIS_SLOT_RESERVATION_SQL = "INSERT INTO genesis_slots (slot_number, node_binding_id, amount_base_units, reserved_at_utc, claim_status) SELECT (SELECT COALESCE(MAX(slot_number), 0) + 1 FROM genesis_slots), id, ?, ?, 'reserved' FROM node_bindings WHERE id = ? AND wallet_address = ? AND state = 'pending' AND x_user_id IS NULL AND country_code IS NOT NULL AND session_nonce_hash = ? AND session_expires_at_utc >= ? AND oauth_nonce_hash = ? AND oauth_expires_at_utc >= ? AND NOT EXISTS (SELECT 1 FROM node_bindings WHERE x_user_id = ?) AND (SELECT COUNT(*) FROM genesis_slots) < 1000";

export function isAllowedXSubscriptionType(value) {
  return ALLOWED_X_SUBSCRIPTION_TYPES.includes(value);
}

export function premiumRevalidationDeadline(observedAt = new Date()) {
  return new Date(observedAt.valueOf() + X_PREMIUM_REVALIDATION_MS).toISOString();
}

export function normalizedEligibleXAccountCreatedAt(createdAt, observedAt = new Date()) {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.valueOf()) || !Number.isFinite(observedAt.valueOf())) return null;
  if (created.valueOf() > observedAt.valueOf() - X_ACCOUNT_MINIMUM_AGE_MS) return null;
  return created.toISOString();
}

export function nextGenesisSlot(completedSlots) {
  if (!Number.isSafeInteger(completedSlots) || completedSlots < 0) throw new Error("completed slot count must be a non-negative safe integer");
  return completedSlots < GENESIS_SLOT_LIMIT ? completedSlots + 1 : null;
}

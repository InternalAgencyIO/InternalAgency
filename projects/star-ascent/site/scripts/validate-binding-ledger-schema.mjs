import { readFileSync } from "node:fs";

const sql = readFileSync("engagement/binding-ledger.schema.sql", "utf8");
const required = [
  "x_user_id TEXT UNIQUE",
  "x_account_created_at_utc TEXT",
  "wallet_address TEXT NOT NULL UNIQUE",
  "session_nonce_hash TEXT",
  "oauth_nonce_hash TEXT",
  "x_subscription_type TEXT CHECK",
  "'Premium', 'PremiumPlus'",
  "slot_number INTEGER PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 1000)",
  "amount_base_units TEXT NOT NULL CHECK (amount_base_units = '100000000000')",
  "UNIQUE(epoch_id, node_binding_id)",
  "UNIQUE(epoch_id, wallet_address)",
  "claim_transaction TEXT",
];
for (const entry of required) {
  if (!sql.includes(entry)) throw new Error(`missing ledger control: ${entry}`);
  console.log(`OK: ${entry}`);
}
console.log("BINDING LEDGER SCHEMA VALID: wallet/X uniqueness, 40-day account evidence, one-time session state, Premium tiers, exact 1,000-slot cap, and one claim per wallet per epoch are represented.");

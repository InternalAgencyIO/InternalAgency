import { readFileSync } from "node:fs";

const sql = readFileSync("engagement/binding-ledger.schema.sql", "utf8");
const required = [
  "x_user_id TEXT NOT NULL UNIQUE",
  "wallet_address TEXT NOT NULL UNIQUE",
  "slot_number INTEGER PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 1000)",
  "UNIQUE(epoch_id, node_binding_id)",
  "UNIQUE(epoch_id, wallet_address)",
  "claim_transaction TEXT",
];
for (const entry of required) {
  if (!sql.includes(entry)) throw new Error(`missing ledger control: ${entry}`);
  console.log(`OK: ${entry}`);
}
console.log("BINDING LEDGER SCHEMA VALID: one-to-one node binding, 1,000-slot cap, and one claim per wallet per epoch are represented.");

import { generateKeyPairSync, sign } from "node:crypto";
import { encodeBase58, nodeChallenge, verifyNodeChallenge } from "../engagement/solana-wallet-proof.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const der = publicKey.export({ type: "spki", format: "der" });
const wallet = encodeBase58(der.subarray(-32));
const input = { wallet, nonce: "nodebindingnonce_0123456789", issuedAtUtc: "2026-07-28T00:00:00.000Z", expiresAtUtc: "2026-07-28T00:05:00.000Z", origin: "https://internalagency.io" };
const message = nodeChallenge(input);
const signatureBase58 = encodeBase58(sign(null, Buffer.from(message, "utf8"), privateKey));
const verified = verifyNodeChallenge({ ...input, signatureBase58, now: new Date("2026-07-28T00:02:00.000Z") });
if (verified.wallet !== wallet) throw new Error("valid wallet proof did not return wallet");
let rejected = false;
try { verifyNodeChallenge({ ...input, signatureBase58, now: new Date("2026-07-28T00:06:00.000Z") }); } catch { rejected = true; }
if (!rejected) throw new Error("expired challenge was accepted");
console.log("OK: Ed25519 wallet proof validates a signed Solana public key and rejects an expired challenge.");

import { env } from "cloudflare:workers";
import {
  classifyLookup,
  decodePositionAccount,
  explorerUrl,
  PUBLIC_NETWORK_STATE,
} from "../../network/network-state.mjs";

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL?.trim()
    ? { url: process.env.SOLANA_RPC_URL.trim(), publicLabel: "configured-rpc" }
    : null,
  { url: "https://api.mainnet.solana.com", publicLabel: "api.mainnet.solana.com" },
  { url: "https://api.mainnet-beta.solana.com", publicLabel: "api.mainnet-beta.solana.com" },
  { url: "https://solana-rpc.publicnode.com", publicLabel: "solana-rpc.publicnode.com" },
].filter((endpoint): endpoint is { url: string; publicLabel: string } => Boolean(endpoint));
const POSITION_ACCOUNT_SIZE = 168;
const POSITION_OWNER_OFFSET = 40;
const MAX_RPC_BATCH_SIZE = 5;
const MAX_RPC_RESPONSE_BYTES = 2_000_000;
const MAX_REQUESTS_PER_MINUTE = 12;

type RpcRequest = {
  id: string;
  method: string;
  params?: unknown[];
};

type RpcReply = {
  id: string;
  result?: unknown;
  error?: { code?: number; message?: string };
};

function json(body: unknown, status = 200, maxAge = 0) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": maxAge > 0
        ? `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=30`
        : "no-store",
    },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function reserveReadQuota(request: Request) {
  if (!env.DB) return false;
  const clientIp = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "anonymous";
  const subjectHash = await sha256(`network-read:${clientIp}`);
  const now = new Date();
  const windowStart = new Date(Math.floor(now.valueOf() / 60_000) * 60_000).toISOString();
  const result = await env.DB.prepare("INSERT INTO network_read_rate_limits (subject_hash, window_start_utc, request_count) VALUES (?, ?, 1) ON CONFLICT(subject_hash) DO UPDATE SET request_count = CASE WHEN network_read_rate_limits.window_start_utc = excluded.window_start_utc THEN network_read_rate_limits.request_count + 1 ELSE 1 END, window_start_utc = excluded.window_start_utc WHERE network_read_rate_limits.window_start_utc <> excluded.window_start_utc OR network_read_rate_limits.request_count < ?")
    .bind(subjectHash, windowStart, MAX_REQUESTS_PER_MINUTE)
    .run();
  return result.meta.changes === 1;
}

async function rpcBatch(requests: RpcRequest[]) {
  if (requests.length === 0 || requests.length > MAX_RPC_BATCH_SIZE) {
    throw new Error("RPC_BATCH_LIMIT_EXCEEDED");
  }
  let lastError = "RPC_ENDPOINTS_EXHAUSTED";
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          requests.map((request) => ({ jsonrpc: "2.0", ...request })),
        ),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`RPC_HTTP_${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_RPC_RESPONSE_BYTES) throw new Error("RPC_RESPONSE_TOO_LARGE");
      const payload = JSON.parse(new TextDecoder().decode(bytes)) as RpcReply[];
      if (!Array.isArray(payload) || payload.length > requests.length) throw new Error("RPC_RESPONSE_INVALID");
      const replies = new Map(payload.map((reply) => [reply.id, reply]));
      return {
        values: Object.fromEntries(
          requests.map(({ id }) => {
            const reply = replies.get(id);
            if (!reply || reply.error) {
              throw new Error(reply?.error?.message ?? `RPC_REPLY_MISSING_${id}`);
            }
            return [id, reply.result];
          }),
        ),
        source: endpoint.publicLabel,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "RPC_UNKNOWN_FAILURE";
    }
  }
  throw new Error(lastError);
}

async function networkSnapshot() {
  const { values: result, source } = await rpcBatch([
    { id: "health", method: "getHealth" },
    { id: "slot", method: "getSlot", params: [{ commitment: "confirmed" }] },
    { id: "height", method: "getBlockHeight", params: [{ commitment: "finalized" }] },
    { id: "epoch", method: "getEpochInfo", params: [{ commitment: "confirmed" }] },
  ]);
  return {
    health: result.health,
    slot: result.slot,
    blockHeight: result.height,
    epoch: result.epoch,
    observedAtUtc: new Date().toISOString(),
    rpcSource: source,
  };
}

async function signatureSnapshot(signature: string) {
  const { values: result, source } = await rpcBatch([
    {
      id: "status",
      method: "getSignatureStatuses",
      params: [[signature], { searchTransactionHistory: true }],
    },
    {
      id: "transaction",
      method: "getTransaction",
      params: [
        signature,
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
        },
      ],
    },
  ]);
  const status = (result.status as { value?: unknown[] } | null)?.value?.[0] ?? null;
  const transaction = result.transaction as {
    slot?: number;
    blockTime?: number | null;
    meta?: { err?: unknown; fee?: number };
  } | null;
  return {
    kind: "signature",
    signature,
    rpcSource: source,
    explorerUrl: explorerUrl("signature", signature),
    found: Boolean(status || transaction),
    status,
    summary: transaction
      ? {
          slot: transaction.slot ?? null,
          blockTimeUtc: transaction.blockTime
            ? new Date(transaction.blockTime * 1_000).toISOString()
            : null,
          succeeded: transaction.meta?.err == null,
          feeLamports: transaction.meta?.fee ?? null,
        }
      : null,
  };
}

async function addressSnapshot(address: string) {
  const requests: RpcRequest[] = [
    {
      id: "balance",
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    },
    {
      id: "account",
      method: "getAccountInfo",
      params: [address, { commitment: "confirmed", encoding: "jsonParsed" }],
    },
    {
      id: "signatures",
      method: "getSignaturesForAddress",
      params: [address, { commitment: "confirmed", limit: 8 }],
    },
  ];
  if (PUBLIC_NETWORK_STATE.mint) {
    requests.push({
      id: "iat",
      method: "getTokenAccountsByOwner",
      params: [
        address,
        { mint: PUBLIC_NETWORK_STATE.mint },
        { commitment: "confirmed", encoding: "jsonParsed" },
      ],
    });
  }
  if (PUBLIC_NETWORK_STATE.programId) {
    requests.push({
      id: "positions",
      method: "getProgramAccounts",
      params: [
        PUBLIC_NETWORK_STATE.programId,
        {
          commitment: "confirmed",
          encoding: "base64",
          filters: [
            { dataSize: POSITION_ACCOUNT_SIZE },
            { memcmp: { offset: POSITION_OWNER_OFFSET, bytes: address } },
          ],
        },
      ],
    });
  }
  const { values: result, source } = await rpcBatch(requests);
  const lamports = Number((result.balance as { value?: number })?.value ?? 0);
  const tokenAccounts = (result.iat as {
    value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: string; uiAmountString?: string } } } } } }>;
  } | undefined)?.value ?? [];
  const positions = ((result.positions as Array<{ pubkey: string; account?: { data?: [string, string] } }> | undefined) ?? [])
    .flatMap((entry) => {
      try {
        const encoded = entry.account?.data?.[0];
        return encoded ? [{ address: entry.pubkey, ...decodePositionAccount(encoded) }] : [];
      } catch {
        return [];
      }
    });
  return {
    kind: "address",
    address,
    rpcSource: source,
    explorerUrl: explorerUrl("address", address),
    exists: Boolean((result.account as { value?: unknown })?.value),
    sol: { lamports, amount: (lamports / 1_000_000_000).toFixed(9) },
    iat: PUBLIC_NETWORK_STATE.mint
      ? {
          configured: true,
          mint: PUBLIC_NETWORK_STATE.mint,
          accounts: tokenAccounts,
        }
      : { configured: false, mint: null, accounts: [] },
    positions: {
      configured: Boolean(PUBLIC_NETWORK_STATE.programId),
      programId: PUBLIC_NETWORK_STATE.programId,
      items: positions,
    },
    signatures: result.signatures,
  };
}

export async function GET(request: Request) {
  const lookupValue = new URL(request.url).searchParams.get("q");
  try {
    if (!await reserveReadQuota(request)) {
      return Response.json(
        { error: env.DB ? "NETWORK_READ_RATE_LIMITED" : "NETWORK_READ_QUOTA_UNAVAILABLE" },
        { status: env.DB ? 429 : 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
      );
    }
    if (!lookupValue) {
      return json({
        network: PUBLIC_NETWORK_STATE,
        snapshot: await networkSnapshot(),
      }, 200, 15);
    }
    if (lookupValue.length > 90) return json({ error: "INVALID_SOLANA_ADDRESS_OR_SIGNATURE" }, 400);
    const lookup = classifyLookup(lookupValue);
    if (lookup.kind === "invalid") {
      return json({ error: "INVALID_SOLANA_ADDRESS_OR_SIGNATURE" }, 400);
    }
    const result = lookup.kind === "signature"
      ? await signatureSnapshot(lookup.value)
      : await addressSnapshot(lookup.value);
    return json({ network: PUBLIC_NETWORK_STATE, result });
  } catch {
    return json({
      error: "SOLANA_RPC_UNAVAILABLE",
      network: PUBLIC_NETWORK_STATE,
    }, 503);
  }
}

import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "CLAIM_SERVICE_NOT_CONFIGURED" }, { status: 503 });
  let input: { nodeId?: string; countryCode?: string };
  try { input = await request.json(); } catch { return Response.json({ error: "INVALID_REQUEST" }, { status: 400 }); }
  const countryCode = input.countryCode?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(countryCode) || !input.nodeId || !/^[0-9a-f-]{36}$/i.test(input.nodeId)) return Response.json({ error: "INVALID_COUNTRY_SELECTION" }, { status: 400 });
  const result = await env.DB.prepare("UPDATE node_bindings SET country_code = ? WHERE id = ? AND state = 'pending' AND country_code IS NULL").bind(countryCode, input.nodeId).run();
  if (result.meta.changes !== 1) return Response.json({ error: "COUNTRY_SELECTION_LOCKED" }, { status: 409 });
  return Response.json({ nodeId: input.nodeId, countryCode, next: "X_OAUTH_REQUIRED", claimStatus: "HOLD" }, { headers: { "Cache-Control": "no-store" } });
}

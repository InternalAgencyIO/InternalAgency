import { env } from "cloudflare:workers";

import { createRetainedV2CallbackHandler } from "./retained-v2-callback-handler.mjs";

// Production provider verifiers, durable replay/checkpoint readers, Daily Law
// authorization, every-consumer proof, and an atomic retained-V2 persistence
// adapter are intentionally not configured. The default handler therefore
// returns retained-v2-runtime-hold before any D1 access or provider request.
// Activation requires reviewed source wiring; no environment or request flag
// can re-enable the removed legacy Premium-only D1 mutation path.
export const GET = createRetainedV2CallbackHandler({ runtimeEnv: env });

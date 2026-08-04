# X OAuth activation configuration

The node service uses X OAuth 2.0 Authorization Code with PKCE. It is deliberately inactive until the deployment secret manager contains the values below.

## Configure in the deployment secret manager

| Key | Value | Visibility |
|---|---|---|
| `X_CLIENT_ID` | OAuth 2.0 Client ID from the STAR ASCENT X App | regular environment value |
| `X_OAUTH_STATE_SECRET` | a newly generated random value, at least 32 characters | secret |
| `X_OAUTH_REDIRECT_URI` | `https://internalagency.io/api/x/callback` | regular environment value |
| `NODE_SESSION_SECRET` | an independent random value, at least 32 characters | secret |

In the X Developer Console, enable OAuth 2.0 for the project App and register the redirect URI as an exact match. The source rejects any callback URI other than `https://internalagency.io/api/x/callback`. Request only `users.read` for identity and subscription-tier binding. Do not request posting, DMs, follows, email, or offline access for this launch path.

Wallet verification creates a 15-minute `Secure`, `HttpOnly`, `SameSite=Lax`, host-only session. Country selection and X authorization require that session; neither route accepts the internal node UUID from the browser. OAuth state is signed, PKCE-bound, stored as a one-time nonce hash, and consumed during activation.

The callback must exchange the code within X's short authorization-code window, retrieve the authenticated public X user ID, `created_at`, and `subscription_type`, and discard the access token. Only the exact values `Premium` and `PremiumPlus` pass; `None`, `Basic`, missing, or unknown values fail closed. The account must be at least 40 full days old at observation time. The tier observation expires for reward eligibility after 24 hours and must be refreshed by an approved revalidation flow before a later epoch may rely on it.

Activation atomically enforces one immutable X ID to one Solana wallet and reserves at most one of slots 1-1,000. A verified pair after capacity remains active but receives no Genesis Gift. No secret, access token, refresh token, private key, seed phrase, PIN, or passphrase may enter this repository, a public issue, or a browser form.

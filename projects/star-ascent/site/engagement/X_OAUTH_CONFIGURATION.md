# X OAuth activation configuration

The node service uses X OAuth 2.0 Authorization Code with PKCE. It is deliberately inactive until the deployment secret manager contains the values below.

## Configure in the deployment secret manager

| Key | Value | Visibility |
|---|---|---|
| `X_CLIENT_ID` | OAuth 2.0 Client ID from the STAR ASCENT X App | regular environment value |
| `X_OAUTH_STATE_SECRET` | a newly generated random value, at least 32 characters | secret |
| `X_OAUTH_REDIRECT_URI` | `https://internalagency.io/api/x/callback` | regular environment value |

In the X Developer Console, enable OAuth 2.0 for the project App and register the redirect URI as an exact match. Request only `users.read` for identity binding. Do not request posting, DMs, follows, email, or offline access for this launch path.

The callback must exchange the code within X's short authorization-code window, retrieve only the public X user id, discard the access token, and atomically enforce one X id to one Solana wallet. No secret, access token, refresh token, private key, seed phrase, PIN, or passphrase may enter this repository, a public issue, or a browser form.

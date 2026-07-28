# X OAuth activation configuration

Configure `X_CLIENT_ID`, a secret `X_OAUTH_STATE_SECRET` of at least 32 random characters, and `X_OAUTH_REDIRECT_URI` as `https://internalagency.io/api/x/callback` in the deployment secret manager. In the X Developer Console enable OAuth 2.0, register that exact callback URL, and request only `users.read` for identity binding. Never add a client secret, access token, refresh token, wallet key, seed phrase, PIN, or passphrase to this public archive.

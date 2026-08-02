declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    X_CLIENT_ID?: string;
    X_OAUTH_STATE_SECRET?: string;
    X_OAUTH_REDIRECT_URI?: string;
    NODE_SESSION_SECRET?: string;
  }
}

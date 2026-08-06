import { defineConfig } from "@playwright/test";
import sourceConfig from "./playwright.config.mjs";

const externalBaseURL = process.env.UI_AUDIT_BASE_URL;
const baseURL = sourceConfig.use.baseURL;
const localPort = new URL(baseURL).port;
const reuseExistingServer = process.env.UI_AUDIT_REUSE_EXISTING_SERVER === "1";

export default defineConfig({
  ...sourceConfig,
  webServer: externalBaseURL ? undefined : {
    command: `node ./node_modules/vite/bin/vite.js preview --port ${localPort}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer,
  },
});

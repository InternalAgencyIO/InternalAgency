import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.UI_AUDIT_BASE_URL;
const localPortText = process.env.UI_AUDIT_PORT ?? "4176";
if (!/^\d+$/u.test(localPortText) || Number(localPortText) < 1_024 || Number(localPortText) > 65_535) {
  throw new Error(`UI_AUDIT_PORT must be an integer from 1024 through 65535; received ${localPortText}`);
}
const reuseExistingServerValue = process.env.UI_AUDIT_REUSE_EXISTING_SERVER;
if (!new Set([undefined, "0", "1"]).has(reuseExistingServerValue)) {
  throw new Error(`UI_AUDIT_REUSE_EXISTING_SERVER must be 0 or 1; received ${reuseExistingServerValue}`);
}
const localPort = Number(localPortText);
const baseURL = externalBaseURL ?? `http://localhost:${localPort}`;
const reuseExistingServer = reuseExistingServerValue === "1";

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: "playwright-report/ci" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL ? undefined : {
    command: `npm run compile:i18n && node ./node_modules/vinext/dist/cli.js dev -p ${localPort}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer,
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "chromium-tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "firefox-tablet", use: { ...devices["Desktop Firefox"], viewport: { width: 768, height: 1024 } } },
    { name: "android-chromium-emulation", use: { ...devices["Pixel 5"] } },
    { name: "ios-webkit-emulation", use: { ...devices["iPhone 13"] } },
  ],
});

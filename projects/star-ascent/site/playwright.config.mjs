import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.UI_AUDIT_BASE_URL;
const baseURL = externalBaseURL ?? "http://localhost:4176";

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: "test-results/ui-report" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL ? undefined : {
    command: "node ./node_modules/vinext/dist/cli.js dev -p 4176",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
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

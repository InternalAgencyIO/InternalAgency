import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const configUrl = new URL("../playwright.config.mjs", import.meta.url).href;
const productionConfigUrl = new URL("../playwright.production.config.mjs", import.meta.url).href;

function inspectSource(configHref) {
  return `
  import config from ${JSON.stringify(configHref)};
  console.log(JSON.stringify({
    baseURL: config.use.baseURL,
    webServer: config.webServer ? {
      command: config.webServer.command,
      url: config.webServer.url,
      reuseExistingServer: config.webServer.reuseExistingServer,
    } : null,
  }));
`;
}

function inspectConfig(overrides = {}, inspectedConfigUrl = configUrl) {
  const env = { ...process.env };
  delete env.UI_AUDIT_BASE_URL;
  delete env.UI_AUDIT_PORT;
  delete env.UI_AUDIT_REUSE_EXISTING_SERVER;
  Object.assign(env, overrides);
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", inspectSource(inspectedConfigUrl)], {
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  return { ...result, combined: `${result.stdout}\n${result.stderr}` };
}

test("Playwright starts a source-local server and never reuses one by default", () => {
  const result = inspectConfig();
  assert.equal(result.status, 0, result.combined);
  assert.deepEqual(JSON.parse(result.stdout), {
    baseURL: "http://localhost:4176",
    webServer: {
      command: "npm run compile:i18n && node ./node_modules/vinext/dist/cli.js dev -p 4176",
      url: "http://localhost:4176",
      reuseExistingServer: false,
    },
  });
});

test("production Playwright starts only the packaged server", () => {
  const result = inspectConfig({}, productionConfigUrl);
  assert.equal(result.status, 0, result.combined);
  assert.deepEqual(JSON.parse(result.stdout), {
    baseURL: "http://localhost:4176",
    webServer: {
      command: "node ./node_modules/vite/bin/vite.js preview --port 4176",
      url: "http://localhost:4176",
      reuseExistingServer: false,
    },
  });
});

test("production Playwright preserves external audit isolation", () => {
  const result = inspectConfig(
    { UI_AUDIT_BASE_URL: "https://preview.example.invalid" },
    productionConfigUrl,
  );
  assert.equal(result.status, 0, result.combined);
  assert.deepEqual(JSON.parse(result.stdout), {
    baseURL: "https://preview.example.invalid",
    webServer: null,
  });
});

test("Playwright accepts an isolated local port and explicit server reuse", () => {
  const result = inspectConfig({ UI_AUDIT_PORT: "49176", UI_AUDIT_REUSE_EXISTING_SERVER: "1" });
  assert.equal(result.status, 0, result.combined);
  assert.deepEqual(JSON.parse(result.stdout), {
    baseURL: "http://localhost:49176",
    webServer: {
      command: "npm run compile:i18n && node ./node_modules/vinext/dist/cli.js dev -p 49176",
      url: "http://localhost:49176",
      reuseExistingServer: true,
    },
  });
});

test("an external audit URL keeps Playwright from starting a local server", () => {
  const result = inspectConfig({ UI_AUDIT_BASE_URL: "https://preview.example.invalid" });
  assert.equal(result.status, 0, result.combined);
  assert.deepEqual(JSON.parse(result.stdout), {
    baseURL: "https://preview.example.invalid",
    webServer: null,
  });
});

test("invalid local ports and implicit reuse values fail closed", () => {
  for (const value of ["0", "1023", "65536", "12.5", "not-a-port"]) {
    const result = inspectConfig({ UI_AUDIT_PORT: value });
    assert.notEqual(result.status, 0, `${value} unexpectedly passed`);
    assert.match(result.combined, /UI_AUDIT_PORT must be an integer from 1024 through 65535/u);
  }
  const reuse = inspectConfig({ UI_AUDIT_REUSE_EXISTING_SERVER: "yes" });
  assert.notEqual(reuse.status, 0);
  assert.match(reuse.combined, /UI_AUDIT_REUSE_EXISTING_SERVER must be 0 or 1/u);
});

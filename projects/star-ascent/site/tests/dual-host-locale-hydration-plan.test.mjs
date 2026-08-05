import assert from "node:assert/strict";
import test from "node:test";
import {
  createHydrationPlans,
  hydrationOptionsFromEnvironment,
} from "../scripts/dual-host-locale-hydration-plan.mjs";

const locales = ["en", "tr", "hr", ...Array.from({ length: 47 }, (_, index) => `l${String(index).padStart(2, "0")}`)];
const routes = [
  "/",
  "/dossier/read/white-dossier",
  "/future",
  "/network",
  "/tokenomics",
  ...Array.from({ length: 20 }, (_, index) => `/route-${index + 1}`),
];

test("default hydration options are bounded and cross-engine", () => {
  assert.deepEqual(hydrationOptionsFromEnvironment(), {
    concurrency: 8,
    maxFailures: 20,
    fullCrossEngine: false,
    engineNames: ["chromium", "firefox", "webkit"],
    diagnosticLocale: null,
    diagnosticRoute: null,
  });
});

test("standard profile is 2,500 exhaustive Chromium plus 500 Firefox and 500 WebKit pages", () => {
  const plans = createHydrationPlans({
    locales,
    routes,
    engineNames: ["chromium", "firefox", "webkit"],
    fullCrossEngine: false,
  });
  assert.deepEqual(plans.map((plan) => plan.jobs.length), [2_500, 500, 500]);
  assert.deepEqual(plans.map((plan) => plan.resultOffset), [0, 2_500, 3_000]);
  assert.deepEqual(plans.map((plan) => plan.routeCount), [25, 5, 5]);
  assert.equal(plans.reduce((total, plan) => total + plan.jobs.length, 0), 3_500);
  assert.equal(plans.reduce((total, plan) => total + plan.routeCount, 0), 35);
});

test("full cross-engine diagnostic profile contains 7,500 pages with stable offsets", () => {
  const plans = createHydrationPlans({
    locales,
    routes,
    engineNames: ["chromium", "firefox", "webkit"],
    fullCrossEngine: true,
  });
  assert.deepEqual(plans.map((plan) => plan.jobs.length), [2_500, 2_500, 2_500]);
  assert.deepEqual(plans.map((plan) => plan.resultOffset), [0, 2_500, 5_000]);
  assert.equal(plans.reduce((total, plan) => total + plan.routeCount, 0), 75);
});

test("engine subsets preserve the selected engine and bounded sentinel scope", () => {
  const options = hydrationOptionsFromEnvironment({
    I18N_HYDRATION_ENGINES: "webkit",
    I18N_HYDRATION_WORKERS: "16",
    I18N_HYDRATION_MAX_FAILURES: "1",
  });
  const [plan] = createHydrationPlans({ locales, routes, ...options });
  assert.equal(plan.engineName, "webkit");
  assert.equal(plan.jobs.length, 500);
  assert.equal(plan.routeCount, 5);
});

test("diagnostic scope selects one canonical locale/route pair without changing engine coverage", () => {
  const options = hydrationOptionsFromEnvironment({
    I18N_HYDRATION_DIAGNOSTIC_LOCALE: "hr",
    I18N_HYDRATION_DIAGNOSTIC_ROUTE: "/",
  });
  const plans = createHydrationPlans({ locales, routes, ...options });
  assert.deepEqual(plans.map((plan) => plan.jobs.length), [2, 2, 2]);
  assert.deepEqual(plans.map((plan) => plan.resultOffset), [0, 2, 4]);
  assert.ok(plans.flatMap((plan) => plan.jobs).every((job) => job.locale === "hr" && job.route === "/"));
});

test("invalid environment options and incomplete route inventories fail closed", () => {
  assert.throws(
    () => hydrationOptionsFromEnvironment({ I18N_HYDRATION_ENGINES: "chromium,chromium" }),
    /unique comma-separated subset/,
  );
  assert.throws(
    () => hydrationOptionsFromEnvironment({ I18N_HYDRATION_ENGINES: "gecko" }),
    /unique comma-separated subset/,
  );
  assert.throws(
    () => hydrationOptionsFromEnvironment({ I18N_HYDRATION_WORKERS: "17" }),
    /integer from 1 through 16/,
  );
  assert.throws(
    () => hydrationOptionsFromEnvironment({ I18N_HYDRATION_WORKERS: "8workers" }),
    /integer from 1 through 16/,
  );
  assert.throws(
    () => hydrationOptionsFromEnvironment({ I18N_HYDRATION_MAX_FAILURES: "0" }),
    /integer from 1 through 100/,
  );
  assert.throws(
    () => hydrationOptionsFromEnvironment({ I18N_HYDRATION_FULL_CROSS_ENGINE: "2" }),
    /must be 0 or 1/,
  );
  assert.throws(
    () => hydrationOptionsFromEnvironment({ I18N_HYDRATION_DIAGNOSTIC_LOCALE: "hr" }),
    /must be supplied together/,
  );
  assert.throws(
    () => createHydrationPlans({
      locales,
      routes: routes.map((route) => (route === "/future" ? "/replacement" : route)),
      engineNames: ["chromium"],
      fullCrossEngine: false,
    }),
    /sentinel routes must remain a subset/,
  );
  assert.throws(
    () => createHydrationPlans({
      locales: [...locales.slice(0, 49), locales[0]],
      routes,
      engineNames: ["chromium"],
      fullCrossEngine: false,
    }),
    /50 unique catalog locales/,
  );
});

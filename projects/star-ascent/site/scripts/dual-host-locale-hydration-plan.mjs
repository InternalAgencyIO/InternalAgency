export const crossEngineRoutes = [
  "/",
  "/dossier/read/white-dossier",
  "/future",
  "/network",
  "/tokenomics",
];

export const engineConcurrencyCaps = {
  chromium: 16,
  firefox: 4,
  webkit: 8,
};

const browserEngineNames = Object.keys(engineConcurrencyCaps);

function parseBoundedInteger(value, fallback, name, minimum, maximum) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}; received ${value}`);
  }
  return parsed;
}

export function hydrationOptionsFromEnvironment(environment = {}) {
  const fullCrossEngineValue = environment.I18N_HYDRATION_FULL_CROSS_ENGINE;
  if (!new Set([undefined, "0", "1"]).has(fullCrossEngineValue)) {
    throw new Error(`I18N_HYDRATION_FULL_CROSS_ENGINE must be 0 or 1; received ${fullCrossEngineValue}`);
  }

  const engineNames = (environment.I18N_HYDRATION_ENGINES ?? browserEngineNames.join(","))
    .split(",")
    .map((engine) => engine.trim())
    .filter(Boolean);
  if (
    engineNames.length === 0
    || new Set(engineNames).size !== engineNames.length
    || engineNames.some((engine) => !browserEngineNames.includes(engine))
  ) {
    throw new Error(
      `I18N_HYDRATION_ENGINES must be a unique comma-separated subset of ${browserEngineNames.join(",")}; ` +
        `received ${environment.I18N_HYDRATION_ENGINES}`,
    );
  }

  const diagnosticLocale = environment.I18N_HYDRATION_DIAGNOSTIC_LOCALE?.trim() || null;
  const diagnosticRoute = environment.I18N_HYDRATION_DIAGNOSTIC_ROUTE?.trim() || null;
  if (Boolean(diagnosticLocale) !== Boolean(diagnosticRoute)) {
    throw new Error(
      "I18N_HYDRATION_DIAGNOSTIC_LOCALE and I18N_HYDRATION_DIAGNOSTIC_ROUTE must be supplied together",
    );
  }

  return {
    concurrency: parseBoundedInteger(environment.I18N_HYDRATION_WORKERS, "8", "I18N_HYDRATION_WORKERS", 1, 16),
    maxFailures: parseBoundedInteger(
      environment.I18N_HYDRATION_MAX_FAILURES,
      "20",
      "I18N_HYDRATION_MAX_FAILURES",
      1,
      100,
    ),
    fullCrossEngine: fullCrossEngineValue === "1",
    engineNames,
    diagnosticLocale,
    diagnosticRoute,
  };
}

export function createHydrationPlans({
  locales,
  routes,
  engineNames,
  fullCrossEngine,
  diagnosticLocale = null,
  diagnosticRoute = null,
}) {
  if (locales.length !== 50 || new Set(locales).size !== 50) {
    throw new Error(`Expected 50 unique catalog locales; found ${locales.length}/${new Set(locales).size}`);
  }
  if (routes.length !== 25 || new Set(routes).size !== 25) {
    throw new Error(`Expected 25 unique canonical sitemap routes; found ${routes.length}/${new Set(routes).size}`);
  }
  if (crossEngineRoutes.some((route) => !routes.includes(route))) {
    throw new Error("Cross-engine sentinel routes must remain a subset of the canonical sitemap inventory");
  }
  if (diagnosticLocale && !locales.includes(diagnosticLocale)) {
    throw new Error(`Diagnostic locale is absent from the catalog: ${diagnosticLocale}`);
  }
  if (diagnosticRoute && !routes.includes(diagnosticRoute)) {
    throw new Error(`Diagnostic route is absent from the canonical sitemap inventory: ${diagnosticRoute}`);
  }

  const localeScope = diagnosticLocale ? [diagnosticLocale] : locales;
  let resultOffset = 0;
  return engineNames.map((engineName) => {
    const routeScope = diagnosticRoute
      ? [diagnosticRoute]
      : engineName === "chromium" || fullCrossEngine
        ? routes
        : crossEngineRoutes;
    const jobs = ["internalagency", "ileriakil"].flatMap((host) =>
      localeScope.flatMap((locale) =>
        routeScope.map((route) => ({
          host,
          locale,
          route,
          label: `${host}.localhost/${locale}${route === "/" ? "" : route}`,
        })),
      ),
    );
    const plan = {
      engineName,
      jobs,
      resultOffset,
      routeCount: routeScope.length,
    };
    resultOffset += jobs.length;
    return plan;
  });
}

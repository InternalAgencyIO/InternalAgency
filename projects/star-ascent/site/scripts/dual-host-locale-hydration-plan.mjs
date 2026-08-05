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
export const exhaustiveLocaleShardCount = 50;

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

  const shardIndex = environment.I18N_HYDRATION_SHARD_INDEX === undefined
    ? null
    : parseBoundedInteger(
        environment.I18N_HYDRATION_SHARD_INDEX,
        environment.I18N_HYDRATION_SHARD_INDEX,
        "I18N_HYDRATION_SHARD_INDEX",
        1,
        exhaustiveLocaleShardCount,
      );
  if (shardIndex !== null) {
    if (fullCrossEngineValue !== "1") {
      throw new Error("I18N_HYDRATION_SHARD_INDEX requires I18N_HYDRATION_FULL_CROSS_ENGINE=1");
    }
    if (engineNames.join(",") !== browserEngineNames.join(",")) {
      throw new Error("A hydration shard must retain chromium,firefox,webkit in canonical order");
    }
    if (diagnosticLocale || diagnosticRoute) {
      throw new Error("Hydration shard and diagnostic locale/route scopes cannot be combined");
    }
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
    pageTimeoutMs: parseBoundedInteger(
      environment.I18N_HYDRATION_PAGE_TIMEOUT_MS,
      "45000",
      "I18N_HYDRATION_PAGE_TIMEOUT_MS",
      5_000,
      60_000,
    ),
    fullCrossEngine: fullCrossEngineValue === "1",
    engineNames,
    diagnosticLocale,
    diagnosticRoute,
    shardIndex,
  };
}

export function createHydrationPlans({
  locales,
  routes,
  engineNames,
  fullCrossEngine,
  diagnosticLocale = null,
  diagnosticRoute = null,
  shardIndex = null,
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
  if (shardIndex !== null) {
    if (!Number.isSafeInteger(shardIndex) || shardIndex < 1 || shardIndex > exhaustiveLocaleShardCount) {
      throw new Error(`Hydration shard index must be 1 through ${exhaustiveLocaleShardCount}; received ${shardIndex}`);
    }
    if (!fullCrossEngine || engineNames.join(",") !== browserEngineNames.join(",")) {
      throw new Error("A hydration shard requires the canonical full cross-engine profile");
    }
    if (diagnosticLocale || diagnosticRoute) {
      throw new Error("Hydration shard and diagnostic locale/route scopes cannot be combined");
    }
  }

  const localeScope = diagnosticLocale
    ? [diagnosticLocale]
    : shardIndex === null
      ? locales
      : [locales[shardIndex - 1]];
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

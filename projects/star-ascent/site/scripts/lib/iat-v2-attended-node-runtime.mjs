export const IAT_V2_ATTENDED_MINIMUM_NODE_VERSION = "22.13.0";

export const IAT_V2_ATTENDED_PROHIBITED_ENVIRONMENT_NAMES = Object.freeze([
  "BASH_ENV",
  "ENV",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "NODE_OPTIONS",
  "NODE_PATH",
]);

export const IAT_V2_ATTENDED_PROHIBITED_GIT_ENVIRONMENT_NAMES = Object.freeze([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CEILING_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_PARAMETERS",
  "GIT_DIR",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
  "GIT_EXEC_PATH",
  "GIT_EXTERNAL_DIFF",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_WORK_TREE",
]);

const VERSION_PATTERN = /^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

export class IatV2AttendedNodeRuntimeError extends Error {
  constructor(observedVersion) {
    super(
      `IAT V2 attended operations require Node.js >=${IAT_V2_ATTENDED_MINIMUM_NODE_VERSION}; observed ${observedVersion ?? "an unavailable version"}. HOLD before external modules, network, device, signing, broadcast, or evidence writes.`,
    );
    this.name = "IatV2AttendedNodeRuntimeError";
    this.code = "IAT_V2_ATTENDED_NODE_RUNTIME_HOLD";
    this.minimumVersion = IAT_V2_ATTENDED_MINIMUM_NODE_VERSION;
    this.observedVersion = observedVersion ?? null;
  }
}

export class IatV2AttendedEnvironmentError extends Error {
  constructor(names) {
    super(
      `IAT V2 attended operations require a clean launcher environment; prohibited inherited variable${names.length === 1 ? "" : "s"}: ${names.join(", ")}. HOLD before external modules, Git, RPC, device, signing, broadcast, or evidence writes.`,
    );
    this.name = "IatV2AttendedEnvironmentError";
    this.code = "IAT_V2_ATTENDED_ENVIRONMENT_HOLD";
    this.prohibitedNames = Object.freeze([...names]);
  }
}

export function parseIatV2NodeVersion(value) {
  if (typeof value !== "string") return null;
  const match = VERSION_PATTERN.exec(value);
  if (!match) return null;
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return Object.freeze({ major, minor, patch });
}

export function isIatV2AttendedNodeRuntimeSupported(value) {
  const observed = parseIatV2NodeVersion(value);
  const minimum = parseIatV2NodeVersion(IAT_V2_ATTENDED_MINIMUM_NODE_VERSION);
  if (!observed || !minimum) return false;
  if (observed.major !== minimum.major) return observed.major > minimum.major;
  if (observed.minor !== minimum.minor) return observed.minor > minimum.minor;
  return observed.patch >= minimum.patch;
}

export function assertIatV2AttendedNodeRuntime(value = process.versions.node) {
  if (!isIatV2AttendedNodeRuntimeSupported(value)) {
    throw new IatV2AttendedNodeRuntimeError(value);
  }
  return Object.freeze({
    minimumVersion: IAT_V2_ATTENDED_MINIMUM_NODE_VERSION,
    observedVersion: value,
  });
}

export function assertIatV2AttendedEnvironment(environment = process.env) {
  const names = Object.keys(environment ?? {})
    .filter((name) => IAT_V2_ATTENDED_PROHIBITED_ENVIRONMENT_NAMES.includes(name)
      || IAT_V2_ATTENDED_PROHIBITED_GIT_ENVIRONMENT_NAMES.includes(name))
    .sort();
  if (names.length > 0) throw new IatV2AttendedEnvironmentError(names);
  return Object.freeze({ clean: true, prohibitedNames: Object.freeze([]) });
}

// This module is intentionally dependency-free and imported before every
// attended CLI dependency graph. An unsupported runtime stops module
// evaluation before Solana, filesystem, RPC, device, or write code can load.
export const IAT_V2_ATTENDED_NODE_RUNTIME = assertIatV2AttendedNodeRuntime();
export const IAT_V2_ATTENDED_ENVIRONMENT = assertIatV2AttendedEnvironment();

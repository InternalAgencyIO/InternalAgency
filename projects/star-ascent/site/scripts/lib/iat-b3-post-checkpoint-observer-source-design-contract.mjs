import { Buffer } from "node:buffer";
import { types as utilTypes } from "node:util";

export const POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_SCHEMA =
  "iat-b3-post-checkpoint-observer-source-design/v1";
export const POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_STATUS =
  "HOLD_SOURCE_DESIGN_ONLY";
export const POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-observer-source-design.v1.schema.json",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-observer-source-design-contract.test.mjs",
]);

const binding = (path, sha256, byteLength) => Object.freeze({ path, sha256, byteLength });

export const POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN = deepFreeze({
  $schema: "./iat-b3-post-checkpoint-observer-source-design.v1.schema.json",
  schema: POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_SCHEMA,
  status: POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_STATUS,
  purpose: "POST_G8C_TOOLCHAIN_AND_K44_LIVE_OBSERVER_SOURCE_DESIGN",
  ready: false,
  complete: false,
  operative: false,
  exitCode: 2,
  sourceScope: {
    paths: POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_PATHS,
    newRegularMode100644FilesOnly: true,
    existingSourceMutationPermitted: false,
    observerRunnerPermitted: false,
    cliActionPermitted: false,
    processSpawnPermitted: false,
    probePermitted: false,
    evidenceWritePermitted: false,
    compilerOrBuildExecutionPermitted: false,
    networkOrRpcPermitted: false,
  },
  bindings: {
    k45SourceCheckpoint: {
      headSha: "c73d01092c58152ac396dc580055d93511bf0644",
      treeSha: "fcfd4337cfa4ba35a10e4b65849b42d1f5659d3e",
      cleanCommittedSourceRequired: true,
    },
    g8cObserverPackage: {
      commitSha: "b1c65482aebb31395a763707b02224c38aa2da96",
      parentCommitSha: "c73d01092c58152ac396dc580055d93511bf0644",
      treeSha: "da099d9bc7c38c1d8c1aa14bf8c7e49dbd55352f",
      manifestSha256: "4942e2b5c83b44df86da975b07b96b967df02a7f89244d7ec3a316c1c6502647",
      manifestByteLength: 946,
      sourcePathCount: 6,
      sourcePayloadByteLength: 93844,
      cleanCommittedObserverPackageRequired: true,
    },
    g8oSourceManifest: [
      binding("projects/star-ascent/site/scripts/lib/iat-b3-devnet-direct-evidence-observer-contract.mjs", "c0141cdb79c5f1810e21abe06690a72f649401e99789e6a988b9c059cb40f368", 55916),
      binding("projects/star-ascent/site/scripts/observe-iat-b3-pre-devnet-direct-evidence.mjs", "f1a41e21bd5d4d4b09d7d5cef38db0455ab35019667450435a5011c0140091f4", 1490),
      binding("projects/star-ascent/site/scripts/observe-iat-b3-post-devnet-direct-evidence.mjs", "2efea102cf0a1714a71fbbb8c3d27cbcd9af2854cd817ba319e2a88a16434795", 1499),
      binding("projects/star-ascent/site/scripts/assess-iat-b3-pre-devnet-direct-evidence.mjs", "98d0f903a9530c0ff286bd6758f6d6692eb79a9fd38d63f7bc6cf441fb68ad62", 5778),
      binding("projects/star-ascent/site/scripts/assess-iat-b3-post-devnet-direct-evidence.mjs", "ca0f248c19d929f3dc8b7bd49d0b4ba76967f44c34b720cc1bb4d603fe2323e5", 5857),
      binding("projects/star-ascent/site/tests/iat-b3-devnet-direct-evidence-observer.test.mjs", "625b5d2810ac5243834a6f1521bfda842d157f764aca1bf79402684b95d2cfd8", 23304),
    ],
    bp11ToolchainPolicy: {
      policy: binding("projects/star-ascent/site/docs/b3/iat-b3-mandatory-ci-containment-toolchains.v1.json", "2b1a6778049db9a42eab5131f69cded03587af61b054e66b890f56e4753d3518", 4792),
      policyTest: binding("projects/star-ascent/site/tests/iat-b3-mandatory-ci-containment-toolchain-policy.test.mjs", "d5d2a9b03b2b9e4d5dabe61ef4d6a0a23b89553d8038dbda6ac958e471b21490", 19911),
      expectedStatus: "HOLD_UNMEASURED",
      allToolchainIdentitiesExpectedNull: true,
    },
    k44StructuralContract: {
      library: binding("projects/star-ascent/site/scripts/lib/iat-b3-key-free-public-build-input.mjs", "296ba945f1842e9e0ede0158c38da3997061b465a51a4a67578216e40a2c80d0", 23017),
      test: binding("projects/star-ascent/site/tests/iat-b3-key-free-public-build-input.test.mjs", "ca7aee8197c9a918413f6fb35c518ed4df2a5a04cdecbcccb843d1c689467d3b", 17333),
      documentation: binding("projects/star-ascent/site/docs/b3/KEY_FREE_PUBLIC_BUILD_INPUT.md", "f9e65e024d2e26c1923d810fc7feba80a4b75788cf213670edcf6b2aa6689b65", 4201),
      template: binding("projects/star-ascent/site/docs/b3/iat-b3-key-free-public-build-input.template.v1.json", "176a855e8c53e8a9c5f6c555758e641e98e6eb1f7198220442a6531ab47b8884", 1998),
      directObservationFlags: [
        "checkpointDirectlyObservedByThisModule",
        "wallClockDirectlyObservedByThisModule",
        "inputFilesDirectlyObservedByThisModule",
        "productionIdentityInventoryDirectlyObservedByThisModule",
        "priorLaneIdentityInventoryDirectlyObservedByThisModule",
      ],
    },
  },
  observationDesign: {
    implementationPresent: false,
    observerSessionId: null,
    toolchainPolicyObserved: false,
    toolchainFactsObserved: false,
    toolchainReceipt: null,
    k44DirectObservation: {
      checkpointDirectlyObservedByThisModule: false,
      wallClockDirectlyObservedByThisModule: false,
      inputFilesDirectlyObservedByThisModule: false,
      productionIdentityInventoryDirectlyObservedByThisModule: false,
      priorLaneIdentityInventoryDirectlyObservedByThisModule: false,
    },
    samePrincipalSelfAttestationAccepted: false,
    observerOwnedReceiptRequired: true,
    sourceDesignMayCloseObservationBlockers: false,
  },
  blockers: [
    "SOURCE_DESIGN_ONLY_NO_OBSERVER_IMPLEMENTATION",
    "TOOLCHAIN_POLICY_DIRECT_OBSERVATION_ABSENT",
    "DIRECT_CHECKPOINT_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_WALL_CLOCK_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_INPUT_FILE_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_PRODUCTION_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_PRIOR_LANE_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
    "OBSERVER_PRINCIPAL_SEPARATION_UNPROVEN",
    "OBSERVER_OWNED_RECEIPT_UNAVAILABLE",
    "RUNTIME_AND_GATE8_HOLD",
  ],
  truthBoundary: {
    structuralSourceDesignDefined: true,
    toolchainObserved: false,
    k44LiveObserved: false,
    runtimeObserved: false,
    buildExecuted: false,
    networkContacted: false,
    rpcObserved: false,
    keyAccessed: false,
    signingObserved: false,
    fundingObserved: false,
    publicDevnetWriteObserved: false,
    gate8Go: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  },
  authorization: {
    sourceDesignMayAuthorizeObserverImplementation: false,
    sourceDesignMayAuthorizeRuntime: false,
    sourceDesignMayAuthorizeBuild: false,
    sourceDesignMayAuthorizeNetwork: false,
    sourceDesignMayAuthorizeRpc: false,
    sourceDesignMayAuthorizeSigning: false,
    sourceDesignMayAuthorizeFunding: false,
    sourceDesignMayAuthorizePublicDevnet: false,
    sourceDesignMayAuthorizeRelease: false,
    sourceDesignMayAuthorizeMainnet: false,
  },
});

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function assertPlainJsonData(value, path, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail(path, "expected canonical finite JSON number");
    return;
  }
  if (typeof value !== "object") fail(path, "expected plain JSON data");
  if (utilTypes.isProxy(value)) fail(path, "proxy objects are rejected");
  if (seen.has(value)) fail(path, "cyclic object graph is rejected");
  seen.add(value);
  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    fail(path, "expected a plain JSON object or array");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) fail(path, "symbol properties are rejected");
  if (isArray) {
    const length = descriptors.length?.value;
    const elementKeys = keys.filter((key) => key !== "length");
    if (!Number.isSafeInteger(length) || elementKeys.length !== length) fail(path, "sparse arrays are rejected");
    for (let index = 0; index < length; index += 1) {
      if (!Object.hasOwn(descriptors, String(index))) fail(`${path}[${index}]`, "sparse arrays are rejected");
    }
  }
  for (const key of keys) {
    if (isArray && key === "length") continue;
    const descriptor = descriptors[key];
    if (!("value" in descriptor)) fail(`${path}.${String(key)}`, "accessor properties are rejected");
    if (descriptor.enumerable !== true) fail(`${path}.${String(key)}`, "non-enumerable properties are rejected");
    assertPlainJsonData(descriptor.value, isArray ? `${path}[${key}]` : `${path}.${key}`, seen);
  }
}

function snapshotPlainJsonData(value, path) {
  assertPlainJsonData(value, path, new WeakSet());
  try {
    return structuredClone(value);
  } catch (error) {
    fail(path, `plain JSON snapshot failed (${error instanceof Error ? error.message : String(error)})`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalPostCheckpointObserverSourceDesignJson(value) {
  return `${JSON.stringify(canonicalize(snapshotPlainJsonData(value, "$canonicalValue")))}\n`;
}

const EXPECTED_CANONICAL_DESIGN =
  canonicalPostCheckpointObserverSourceDesignJson(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);

export function createPostCheckpointObserverSourceDesign() {
  return deepFreeze(structuredClone(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN));
}

export function validatePostCheckpointObserverSourceDesign(value) {
  const snapshot = snapshotPlainJsonData(value, "$sourceDesign");
  if (canonicalPostCheckpointObserverSourceDesignJson(snapshot) !== EXPECTED_CANONICAL_DESIGN) {
    fail("$sourceDesign", "expected the exact frozen post-checkpoint observer source design");
  }
  return deepFreeze(snapshot);
}

export function parsePostCheckpointObserverSourceDesignJson(text) {
  if (typeof text !== "string") fail("$json", "expected a JSON string");
  if (Buffer.byteLength(text, "utf8") > 64 * 1024) fail("$json", "source exceeds 65536 bytes");
  if (text.charCodeAt(0) === 0xfeff) fail("$json", "BOM is forbidden");
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skip = () => { while (index < text.length && whitespace.test(text[index])) index += 1; };
  const syntaxFail = (message) => { throw new SyntaxError(`$json: ${message} at character ${index}`); };
  const stringToken = () => {
    if (text[index] !== "\"") syntaxFail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\"") { index += 1; return JSON.parse(text.slice(start, index)); }
      if (text[index] === "\\") index += 2;
      else { if (text[index] < " ") syntaxFail("unescaped control character"); index += 1; }
    }
    syntaxFail("unterminated JSON string");
  };
  const value = (path) => {
    skip();
    if (text[index] === "{") {
      index += 1;
      skip();
      const keys = new Set();
      if (text[index] === "}") { index += 1; return; }
      while (index < text.length) {
        skip();
        const key = stringToken();
        if (keys.has(key)) throw new SyntaxError(`$json: duplicate member ${path}.${key}`);
        keys.add(key);
        skip();
        if (text[index] !== ":") syntaxFail("expected colon");
        index += 1;
        value(`${path}.${key}`);
        skip();
        if (text[index] === "}") { index += 1; return; }
        if (text[index] !== ",") syntaxFail("expected comma or closing brace");
        index += 1;
      }
      syntaxFail("unterminated object");
    }
    if (text[index] === "[") {
      index += 1;
      skip();
      if (text[index] === "]") { index += 1; return; }
      let item = 0;
      while (index < text.length) {
        value(`${path}[${item}]`);
        item += 1;
        skip();
        if (text[index] === "]") { index += 1; return; }
        if (text[index] !== ",") syntaxFail("expected comma or closing bracket");
        index += 1;
      }
      syntaxFail("unterminated array");
    }
    if (text[index] === "\"") { stringToken(); return; }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) syntaxFail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skip();
  value("$root");
  skip();
  if (index !== text.length) syntaxFail("unexpected trailing data");
  const parsed = JSON.parse(text);
  if (text !== canonicalPostCheckpointObserverSourceDesignJson(parsed)) {
    throw new SyntaxError("$json: expected canonical sorted JSON plus exactly one LF");
  }
  return validatePostCheckpointObserverSourceDesign(parsed);
}

export function postCheckpointObserverSourceDesignSafety() {
  return deepFreeze({
    sourceDesignOnly: true,
    observerImplementationPresent: false,
    runtimeObserved: false,
    buildExecuted: false,
    networkContacted: false,
    rpcObserved: false,
    signingObserved: false,
    publicDevnetAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  });
}

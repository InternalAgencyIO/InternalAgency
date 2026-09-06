import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  readdirSync,
} from "node:fs";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

export const IAT_B3_FORBIDDEN_MATERIAL_SCAN_SCHEMA =
  "iat-b3-direct-filesystem-forbidden-material-scan/v1";
export const IAT_B3_FORBIDDEN_MATERIAL_SCAN_STATUS = "FORBIDDEN_MATERIAL_ABSENT";

const READ_CHUNK_BYTES = 1024 * 1024;
const TEXT_WINDOW_OVERLAP_BYTES = 64 * 1024;
const RETAINED_CONTENT_BYTES = 4 * 1024 * 1024;
const LARGE_MEDIA_THRESHOLD_BYTES = 8 * 1024 * 1024;
const MEDIA_PREFIX_BYTES = 64 * 1024;
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
const RFC8032_TEST_VECTOR_1 =
  /9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60[\s"'`+]*d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a/iu;
const PRIVATE_KEY_BLOCK =
  /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----[\s\S]{32,}?-----END (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/iu;
const SENSITIVE_ASSIGNMENT =
  /["']?(?:mnemonic|seed[_-]?phrase|recovery[_-]?phrase|private[_-]?key|secret[_-]?key)["']?\s*[:=]\s*["'](?<value>[^"'\r\n]{8,})["']/giu;
const CREDENTIAL_ENV_ASSIGNMENT =
  /^(?:export\s+)?(?<name>[A-Z][A-Z0-9_]*(?:PRIVATE_KEY|SECRET_KEY|MNEMONIC|SEED_PHRASE|RECOVERY_PHRASE|PASSWORD|PASSCODE|API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET|CREDENTIAL)[A-Z0-9_]*)\s*=\s*(?<value>[^\r\n#]+)$/gmu;
const RAW_MNEMONIC = /^(?:[a-z]{3,12}\s+){11,23}[a-z]{3,12}$/u;
const SENSITIVE_JSON_KEY =
  /^(?:mnemonic|seedPhrase|seed_phrase|recoveryPhrase|recovery_phrase|privateKey|private_key|secretKey|secret_key|clientSecret|client_secret)$/u;
const KEY_MATERIAL_CARRIER_EXTENSIONS = new Set([
  "",
  ".json",
  ".key",
  ".pem",
  ".secret",
  ".seed",
  ".txt",
]);
const PRIVATE_KEY_FILE_EXTENSION = /\.(?:pem|key|p8|p12|pfx|jks|keystore)$/iu;
const RECEIPT_FILE_NAME = /(?:^|[._-])receipt(?:[._-]|$)/iu;
const RECEIPT_FILE_EXTENSION = /\.(?:json|jsonl|cbor|bin|txt|log)$/iu;
const BUILD_ARTIFACT_EXTENSION =
  /\.(?:so|elf|sbf|o|obj|a|rlib|rmeta|dylib|dll|exe|wasm|node)$/iu;
const BUILD_ARTIFACT_DIRECTORY = new Set([
  ".anchor",
  ".next",
  ".vinext",
  "coverage",
  "dist",
  "out",
  "playwright-report",
  "target",
  "test-ledger",
  "test-results",
]);
const REVIEWED_DEPENDENCY_CACHE_DIRECTORIES = new Set(["node_modules", "vendor"]);
const LARGE_MEDIA_EXTENSIONS = new Set([
  ".avif",
  ".flac",
  ".gif",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".pdf",
  ".png",
  ".wav",
  ".webm",
  ".webp",
]);

// This is the sole reviewed secret-shaped source fixture. The bytes are the
// public RFC 8032 section 7.1 TEST 1 vector, never an operational credential.
export const IAT_B3_REVIEWED_PUBLIC_TEST_VECTOR_ALLOWLIST = Object.freeze([
  Object.freeze({
    path: "projects/star-ascent/site/tests/iat-b3-production-local-rehearsal-driver.test.mjs",
    byteLength: 58_499,
    sha256: "227efd4b045f4f7cb97cc43a3133919df4d82ee9b5aa3e7bb22722b7c8607511",
    subject: "RFC_8032_SECTION_7_1_TEST_1_PUBLIC_VECTOR",
  }),
]);

const REVIEWED_ALLOWLIST_BY_PATH = new Map(
  IAT_B3_REVIEWED_PUBLIC_TEST_VECTOR_ALLOWLIST.map((entry) => [entry.path, entry]),
);

function fail(code, path = null) {
  const suffix = typeof path === "string" && path.length > 0 ? `: ${path}` : "";
  throw new Error(`IAT_B3_FORBIDDEN_MATERIAL_${code}_HOLD${suffix}`);
}

function normalizedRealPath(path) {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function statFingerprint(stat) {
  return [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.nlink,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ].join(":");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalInventorySha256(records) {
  const hash = createHash("sha256");
  for (const record of records) hash.update(`${JSON.stringify(record)}\n`, "utf8");
  return hash.digest("hex");
}

function compareCanonicalPath(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function canonicalRelativePath(root, absolutePath) {
  const candidate = relative(root, absolutePath).replaceAll("\\", "/");
  if (candidate.length === 0
    || candidate.startsWith("../")
    || candidate === ".."
    || candidate.startsWith("/")
    || candidate.split("/").some((part) => part.length === 0 || part === "." || part === "..")) {
    fail("PATH_ESCAPE", candidate || "<root>");
  }
  return candidate;
}

function assertEntryName(name, parentRelativePath) {
  if (typeof name !== "string"
    || name.length === 0
    || name === "."
    || name === ".."
    || /[\\/\0]/u.test(name)) {
    fail("ENTRY_NAME_INVALID", parentRelativePath || "<root>");
  }
}

function looksLikePlaceholder(value) {
  const normalized = value.trim().replace(/^['"]|['"]$/gu, "").trim();
  return normalized.length === 0
    || /^(?:null|none|false|redacted|forbidden|never|changeme|change-me|example|placeholder|test-only|not-a-secret)$/iu
      .test(normalized)
    || /^<[^>]+>$/u.test(normalized)
    || /^\$\{[^}]+\}$/u.test(normalized)
    || /^(?:process\.)?env\b/iu.test(normalized);
}

function looksLikeSecretValue(value) {
  const normalized = String(value).trim();
  if (looksLikePlaceholder(normalized)) return false;
  if (RAW_MNEMONIC.test(normalized.toLowerCase())) return true;
  const compact = normalized.replaceAll(/\s+/gu, "");
  return /^[0-9a-f]{64,}$/iu.test(compact)
    || /^[1-9A-HJ-NP-Za-km-z]{40,}$/u.test(compact)
    || /^[A-Za-z0-9+/]{40,}={0,2}$/u.test(compact);
}

function jsonContainsSecretMaterial(value, sensitiveContext = false) {
  if (Array.isArray(value)) {
    if (value.length === 64
      && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
      return true;
    }
    if (sensitiveContext && value.length >= 32
      && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
      return true;
    }
    return value.some((item) => jsonContainsSecretMaterial(item, sensitiveContext));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, child]) => (
      jsonContainsSecretMaterial(child, SENSITIVE_JSON_KEY.test(key))
    ));
  }
  if (sensitiveContext && typeof value === "string") return looksLikeSecretValue(value);
  return false;
}

function textContainsCredentialMaterial(text) {
  PRIVATE_KEY_BLOCK.lastIndex = 0;
  if (PRIVATE_KEY_BLOCK.test(text)) return true;
  SENSITIVE_ASSIGNMENT.lastIndex = 0;
  for (const match of text.matchAll(SENSITIVE_ASSIGNMENT)) {
    if (looksLikeSecretValue(match.groups?.value ?? "")) return true;
  }
  CREDENTIAL_ENV_ASSIGNMENT.lastIndex = 0;
  for (const match of text.matchAll(CREDENTIAL_ENV_ASSIGNMENT)) {
    if (!looksLikePlaceholder(match.groups?.value ?? "")) return true;
  }
  return false;
}

function inspectRetainedContent(bytes) {
  const trimmed = bytes.toString("utf8").trim();
  if (trimmed.length === 0) return false;
  if (textContainsCredentialMaterial(trimmed)) return true;
  if (RAW_MNEMONIC.test(trimmed.toLowerCase())) return true;
  if ((trimmed.startsWith("[") && trimmed.endsWith("]"))
    || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      return jsonContainsSecretMaterial(JSON.parse(trimmed));
    } catch {
      return false;
    }
  }
  return false;
}

function pathContainsBuildArtifactDirectory(relativePath) {
  const parts = relativePath.split("/");
  const dependencyCacheIndex = parts.findIndex(
    (part) => REVIEWED_DEPENDENCY_CACHE_DIRECTORIES.has(part.toLowerCase()),
  );
  return parts.slice(0, -1).some((part, index) => (
    BUILD_ARTIFACT_DIRECTORY.has(part.toLowerCase())
    && (dependencyCacheIndex < 0 || index < dependencyCacheIndex)
  ));
}

function credentialFileStemTokens(name) {
  const extension = extname(name).toLowerCase();
  if (!KEY_MATERIAL_CARRIER_EXTENSIONS.has(extension)) return null;
  const stem = extension === "" ? name : name.slice(0, -extension.length);
  const tokenized = stem
    .replaceAll(/([a-z\d])([A-Z])/gu, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replaceAll(/[^A-Za-z\d]+/gu, " ")
    .trim()
    .toLowerCase();
  return tokenized === "" ? [] : tokenized.split(/\s+/u);
}

function hasKeyMaterialFileStem(name) {
  const tokens = credentialFileStemTokens(name);
  if (tokens === null || tokens.length === 0) return false;
  const finalToken = tokens.at(-1);
  if (["keypair", "keystore", "mnemonic", "wallet"].includes(finalToken)) return true;
  if (tokens.length >= 2) {
    const finalPair = tokens.slice(-2).join("");
    if (["keypair", "privatekey", "secretkey", "seedphrase", "recoveryphrase"]
      .includes(finalPair)) return true;
  }
  return tokens.length === 2
    && tokens[0] === "id"
    && ["dsa", "ecdsa", "ed25519", "rsa"].includes(tokens[1]);
}

function classifyForbiddenFileName(relativePath) {
  const name = basename(relativePath);
  const lowerName = name.toLowerCase();
  if (/^\.env(?:\..+)?$/u.test(lowerName)
    || [".npmrc", ".pypirc", ".netrc"].includes(lowerName)) {
    return "CREDENTIAL_ENV_FILE";
  }
  if (hasKeyMaterialFileStem(name) || PRIVATE_KEY_FILE_EXTENSION.test(name)) {
    return "KEYPAIR_OR_PRIVATE_KEY_FILE";
  }
  if (RECEIPT_FILE_NAME.test(name) && RECEIPT_FILE_EXTENSION.test(name)) {
    return "RECEIPT_ARTIFACT_FILE";
  }
  if (BUILD_ARTIFACT_EXTENSION.test(name) || pathContainsBuildArtifactDirectory(relativePath)) {
    return "ELF_SBF_OR_BUILD_ARTIFACT_FILE";
  }
  return null;
}

function observeStableRegularFile({ absolutePath, relativePath, stat }) {
  if (!stat.isFile() || stat.isSymbolicLink()) fail("NONREGULAR_FILE", relativePath);
  if (stat.nlink !== 1n) fail("HARDLINK", relativePath);
  let actual;
  try {
    actual = realpathSync(absolutePath);
  } catch {
    fail("FILE_REALPATH", relativePath);
  }
  if (normalizedRealPath(actual) !== normalizedRealPath(absolutePath)) {
    fail("FILE_REPARSE", relativePath);
  }
  const descriptor = openSync(
    absolutePath,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
  );
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile()
      || opened.nlink !== 1n
      || statFingerprint(opened) !== statFingerprint(stat)) {
      fail("FILE_DESCRIPTOR_BINDING", relativePath);
    }
    if (opened.size > BigInt(Number.MAX_SAFE_INTEGER)) fail("FILE_SIZE_UNSUPPORTED", relativePath);
    const largeMedia = LARGE_MEDIA_EXTENSIONS.has(extname(relativePath).toLowerCase())
      && opened.size > BigInt(LARGE_MEDIA_THRESHOLD_BYTES);
    const digest = largeMedia ? null : createHash("sha256");
    const retained = [];
    let retainedLength = 0;
    let prefix = Buffer.alloc(0);
    let carryText = "";
    let credentialMaterialObserved = false;
    let publicVectorObserved = false;
    let total = 0;
    const chunk = Buffer.allocUnsafe(READ_CHUNK_BYTES);
    while (true) {
      const maximumRead = largeMedia
        ? Math.min(chunk.length, Math.max(0, MEDIA_PREFIX_BYTES - total))
        : chunk.length;
      if (maximumRead === 0) break;
      const read = readSync(descriptor, chunk, 0, maximumRead, null);
      if (read === 0) break;
      const bytes = chunk.subarray(0, read);
      total += read;
      if (prefix.length < ELF_MAGIC.length) {
        prefix = Buffer.concat([prefix, bytes.subarray(0, ELF_MAGIC.length - prefix.length)]);
      }
      digest?.update(bytes);
      if (retainedLength < RETAINED_CONTENT_BYTES) {
        const kept = bytes.subarray(
          0,
          Math.min(bytes.length, RETAINED_CONTENT_BYTES - retainedLength),
        );
        retained.push(Buffer.from(kept));
        retainedLength += kept.length;
      }
      const window = `${carryText}${bytes.toString("utf8")}`;
      if (textContainsCredentialMaterial(window)) credentialMaterialObserved = true;
      if (RFC8032_TEST_VECTOR_1.test(window)) publicVectorObserved = true;
      carryText = window.slice(-TEXT_WINDOW_OVERLAP_BYTES);
    }
    const afterDescriptor = fstatSync(descriptor, { bigint: true });
    const afterPath = lstatSync(absolutePath, { bigint: true });
    const expectedBytesRead = largeMedia ? Math.min(Number(opened.size), MEDIA_PREFIX_BYTES) : Number(opened.size);
    if (statFingerprint(opened) !== statFingerprint(afterDescriptor)
      || statFingerprint(opened) !== statFingerprint(afterPath)
      || total !== expectedBytesRead) {
      fail("FILE_CHANGED_DURING_SCAN", relativePath);
    }
    if (prefix.subarray(0, ELF_MAGIC.length).equals(ELF_MAGIC)) {
      fail("ELF_SBF_BYTES", relativePath);
    }
    const retainedBytes = Buffer.concat(retained);
    if (!largeMedia && (credentialMaterialObserved || inspectRetainedContent(retainedBytes))) {
      fail("PRIVATE_KEY_MNEMONIC_OR_CREDENTIAL_BYTES", relativePath);
    }
    if (!publicVectorObserved && RFC8032_TEST_VECTOR_1.test(retainedBytes.toString("utf8"))) {
      publicVectorObserved = true;
    }
    const contentSha256 = digest?.digest("hex") ?? null;
    const allowlisted = REVIEWED_ALLOWLIST_BY_PATH.get(relativePath) ?? null;
    if (allowlisted !== null) {
      if (largeMedia
        || Number(opened.size) !== allowlisted.byteLength
        || contentSha256 !== allowlisted.sha256
        || !publicVectorObserved) {
        fail("REVIEWED_ALLOWLIST_DRIFT", relativePath);
      }
    } else if (publicVectorObserved) {
      fail("UNREVIEWED_PUBLIC_TEST_VECTOR", relativePath);
    }
    return Object.freeze({
      fingerprint: statFingerprint(afterPath),
      record: Object.freeze({
        path: relativePath,
        byteLength: Number(opened.size),
        contentInspection: largeMedia ? "STABLE_PREFIX_ONLY_LARGE_MEDIA" : "FULL_FILE",
        sha256: contentSha256,
        inspectedPrefixSha256: largeMedia ? sha256(retainedBytes) : null,
      }),
      allowlisted,
      largeMedia,
    });
  } finally {
    closeSync(descriptor);
  }
}

function assertDirectoryBoundary(absolutePath, relativePath) {
  let before;
  let actual;
  try {
    before = lstatSync(absolutePath, { bigint: true });
    actual = realpathSync(absolutePath);
  } catch {
    fail("DIRECTORY_REQUIRED", relativePath || "<root>");
  }
  if (!before.isDirectory()
    || before.isSymbolicLink()
    || normalizedRealPath(actual) !== normalizedRealPath(absolutePath)) {
    fail("DIRECTORY_REPARSE", relativePath || "<root>");
  }
  return before;
}

export function scanIatB3RepositoryForForbiddenMaterial(repositoryRoot) {
  if (typeof repositoryRoot !== "string"
    || repositoryRoot.length === 0
    || !isAbsolute(repositoryRoot)
    || /[\r\n\0]/u.test(repositoryRoot)) {
    fail("ROOT_INVALID");
  }
  const resolvedRoot = resolve(repositoryRoot);
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(resolvedRoot);
  } catch {
    fail("ROOT_REQUIRED");
  }
  if (normalizedRealPath(canonicalRoot) !== normalizedRealPath(resolvedRoot)) {
    fail("ROOT_REPARSE");
  }

  const directoryObservations = new Map();
  const fileObservations = new Map();
  const excludedGitMetadataObservations = new Map();
  const records = [];
  const reviewedAllowlistMatches = [];
  let excludedGitMetadataEntryCount = 0;
  let largeMediaPrefixOnlyFileCount = 0;

  const walk = (absoluteDirectory, relativeDirectory) => {
    const before = assertDirectoryBoundary(absoluteDirectory, relativeDirectory);
    const entries = readdirSync(absoluteDirectory, { withFileTypes: true })
      .map(({ name }) => name)
      .sort(compareCanonicalPath);
    directoryObservations.set(absoluteDirectory, Object.freeze({
      fingerprint: statFingerprint(before),
      entries: Object.freeze([...entries]),
      relativePath: relativeDirectory,
    }));
    for (const name of entries) {
      assertEntryName(name, relativeDirectory);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (relativeDirectory === "" && name === ".git") {
        const absolutePath = join(absoluteDirectory, name);
        const stat = lstatSync(absolutePath, { bigint: true });
        if ((!stat.isFile() && !stat.isDirectory())
          || stat.isSymbolicLink()
          || normalizedRealPath(realpathSync(absolutePath)) !== normalizedRealPath(absolutePath)) {
          fail("GIT_METADATA_REPARSE", relativePath);
        }
        excludedGitMetadataObservations.set(absolutePath, Object.freeze({
          fingerprint: statFingerprint(stat),
          isFile: stat.isFile(),
          isDirectory: stat.isDirectory(),
          relativePath,
        }));
        excludedGitMetadataEntryCount += 1;
        continue;
      }
      if (name === ".git") fail("NESTED_GIT_METADATA", relativePath);
      const absolutePath = join(absoluteDirectory, name);
      const canonicalPath = canonicalRelativePath(canonicalRoot, absolutePath);
      if (canonicalPath !== relativePath) fail("PATH_CANONICALIZATION", relativePath);
      let stat;
      try {
        stat = lstatSync(absolutePath, { bigint: true });
      } catch {
        fail("ENTRY_CHANGED_DURING_SCAN", relativePath);
      }
      if (stat.isSymbolicLink()) fail("REPARSE_ENTRY", relativePath);
      if (stat.isDirectory()) {
        const inDependencyCache = relativeDirectory.split("/").some(
          (part) => REVIEWED_DEPENDENCY_CACHE_DIRECTORIES.has(part.toLowerCase()),
        );
        if (BUILD_ARTIFACT_DIRECTORY.has(name.toLowerCase()) && !inDependencyCache) {
          fail("ELF_SBF_OR_BUILD_ARTIFACT_DIRECTORY", relativePath);
        }
        const rootDependencyCache = relativeDirectory === "projects/star-ascent/site"
          && name.toLowerCase() === "node_modules";
        if (rootDependencyCache) {
          const boundary = assertDirectoryBoundary(absolutePath, relativePath);
          directoryObservations.set(absolutePath, Object.freeze({
            fingerprint: statFingerprint(boundary),
            entries: null,
            relativePath,
            dependencyCacheBoundaryOnly: true,
          }));
          continue;
        }
        walk(absolutePath, relativePath);
        continue;
      }
      if (!stat.isFile()) fail("SPECIAL_FILE", relativePath);
      const fileNameViolation = classifyForbiddenFileName(relativePath);
      if (fileNameViolation !== null) fail(fileNameViolation, relativePath);
      const observation = observeStableRegularFile({ absolutePath, relativePath, stat });
      records.push(observation.record);
      fileObservations.set(absolutePath, Object.freeze({
        fingerprint: observation.fingerprint,
        relativePath,
      }));
      if (observation.largeMedia) largeMediaPrefixOnlyFileCount += 1;
      if (observation.allowlisted !== null) {
        reviewedAllowlistMatches.push(Object.freeze({
          path: observation.allowlisted.path,
          sha256: observation.allowlisted.sha256,
          byteLength: observation.allowlisted.byteLength,
          subject: observation.allowlisted.subject,
        }));
      }
    }
    const after = lstatSync(absoluteDirectory, { bigint: true });
    if (statFingerprint(after) !== statFingerprint(before)) {
      fail("DIRECTORY_CHANGED_DURING_SCAN", relativeDirectory || "<root>");
    }
  };

  walk(canonicalRoot, "");

  for (const [absolutePath, observation] of excludedGitMetadataObservations) {
    const stat = lstatSync(absolutePath, { bigint: true });
    if (statFingerprint(stat) !== observation.fingerprint
      || stat.isSymbolicLink()
      || stat.isFile() !== observation.isFile
      || stat.isDirectory() !== observation.isDirectory
      || normalizedRealPath(realpathSync(absolutePath)) !== normalizedRealPath(absolutePath)) {
      fail("GIT_METADATA_CHANGED_BEFORE_FINALIZATION", observation.relativePath);
    }
  }
  for (const [absolutePath, observation] of fileObservations) {
    const stat = lstatSync(absolutePath, { bigint: true });
    if (!stat.isFile()
      || stat.isSymbolicLink()
      || stat.nlink !== 1n
      || statFingerprint(stat) !== observation.fingerprint
      || normalizedRealPath(realpathSync(absolutePath)) !== normalizedRealPath(absolutePath)) {
      fail("FILE_CHANGED_BEFORE_FINALIZATION", observation.relativePath);
    }
  }
  for (const [absolutePath, observation] of directoryObservations) {
    const stat = assertDirectoryBoundary(absolutePath, observation.relativePath);
    if (observation.dependencyCacheBoundaryOnly === true) {
      if (statFingerprint(stat) !== observation.fingerprint) {
        fail("DEPENDENCY_CACHE_BOUNDARY_CHANGED_BEFORE_FINALIZATION", observation.relativePath);
      }
      continue;
    }
    const entries = readdirSync(absolutePath, { withFileTypes: true })
      .map(({ name }) => name)
      .sort(compareCanonicalPath);
    if (statFingerprint(stat) !== observation.fingerprint
      || entries.length !== observation.entries.length
      || entries.some((entry, index) => entry !== observation.entries[index])) {
      fail("DIRECTORY_INVENTORY_CHANGED_BEFORE_FINALIZATION", observation.relativePath || "<root>");
    }
  }

  records.sort((left, right) => compareCanonicalPath(left.path, right.path));
  reviewedAllowlistMatches.sort((left, right) => compareCanonicalPath(left.path, right.path));
  return Object.freeze({
    schema: IAT_B3_FORBIDDEN_MATERIAL_SCAN_SCHEMA,
    status: IAT_B3_FORBIDDEN_MATERIAL_SCAN_STATUS,
    directFilesystemObservationOnly: true,
    gitMetadataExcluded: true,
    gitOrExternalCommandsInvoked: false,
    forbiddenMaterialObserved: false,
    fileCount: records.length,
    directoryCount: directoryObservations.size,
    excludedGitMetadataEntryCount,
    excludedReviewedDependencyCacheDirectoryCount: [...directoryObservations.values()]
      .filter(({ dependencyCacheBoundaryOnly }) => dependencyCacheBoundaryOnly === true).length,
    fullFileInspectionCount: records.length - largeMediaPrefixOnlyFileCount,
    largeMediaPrefixOnlyFileCount,
    reviewedAllowlistMatches: Object.freeze(reviewedAllowlistMatches),
    inventorySha256: canonicalInventorySha256(records),
  });
}

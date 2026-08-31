import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {
  IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH,
  IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
  IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS,
  verifyIatV2DevnetProgramCeremonyRuntimeBinding,
} from "../../scripts/lib/iat-v2-devnet-program-ceremony-runtime-binding.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = path.resolve(root, "../..");
const CEREMONY_GUARD_POLL_MS = 250;

function ceremonyConfigHold(code, message) {
  const error = new Error(message);
  error.name = "IatV2DevnetProgramCeremonyConfigError";
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalWatchPath(value) {
  const absolute = path.resolve(value);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

function captureCeremonyRuntimeFiles() {
  try {
    return new Map([
      ...IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS,
      IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH,
      IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
    ].map((relativePath) => {
      const absolutePath = path.resolve(repositoryRoot, relativePath);
      return [canonicalWatchPath(absolutePath), {
        absolutePath,
        bytes: readFileSync(absolutePath),
        relativePath,
      }];
    }));
  } catch (error) {
    ceremonyConfigHold(
      "CEREMONY_BINDING_SNAPSHOT_HOLD",
      `ceremony serve input could not be captured: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function assertIatV2CeremonyCapturedSnapshot({ captured, verification }) {
  if (!(captured instanceof Map)) {
    ceremonyConfigHold("CEREMONY_BINDING_SNAPSHOT_HOLD", "captured ceremony runtime snapshot is invalid");
  }
  const capturedByPath = new Map();
  for (const record of captured.values()) {
    if (
      !record
      || typeof record.relativePath !== "string"
      || !Buffer.isBuffer(record.bytes)
      || capturedByPath.has(record.relativePath)
    ) {
      ceremonyConfigHold("CEREMONY_BINDING_SNAPSHOT_HOLD", "captured ceremony runtime snapshot is ambiguous");
    }
    capturedByPath.set(record.relativePath, record);
  }

  const expectedRuntimePaths = [...IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS];
  const expectedCapturedPaths = [
    ...expectedRuntimePaths,
    IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH,
    IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
  ].sort();
  const capturedPaths = [...capturedByPath.keys()].sort();
  if (JSON.stringify(capturedPaths) !== JSON.stringify(expectedCapturedPaths)) {
    ceremonyConfigHold(
      "CEREMONY_BINDING_SNAPSHOT_HOLD",
      "captured ceremony runtime path set differs from the canonical closure plus anchor",
    );
  }

  const verifiedEntries = verification?.runtimeClosureEntries;
  if (!Array.isArray(verifiedEntries)) {
    ceremonyConfigHold("CEREMONY_BINDING_SNAPSHOT_HOLD", "verified ceremony runtime closure is unavailable");
  }
  const verifiedByPath = new Map();
  for (const entry of verifiedEntries) {
    if (!entry || typeof entry.path !== "string" || verifiedByPath.has(entry.path)) {
      ceremonyConfigHold("CEREMONY_BINDING_SNAPSHOT_HOLD", "verified ceremony runtime closure is ambiguous");
    }
    verifiedByPath.set(entry.path, entry);
  }
  const verifiedPaths = [...verifiedByPath.keys()].sort();
  if (JSON.stringify(verifiedPaths) !== JSON.stringify(expectedRuntimePaths)) {
    ceremonyConfigHold(
      "CEREMONY_BINDING_SNAPSHOT_HOLD",
      "verified ceremony runtime path set differs from the canonical closure",
    );
  }

  for (const relativePath of expectedRuntimePaths) {
    const record = capturedByPath.get(relativePath);
    const entry = verifiedByPath.get(relativePath);
    if (entry.bytes !== record.bytes.length || entry.sha256 !== sha256(record.bytes)) {
      ceremonyConfigHold(
        "CEREMONY_BINDING_SNAPSHOT_HOLD",
        `captured ceremony runtime bytes differ from verified source S: ${relativePath}`,
      );
    }
  }
  const anchor = capturedByPath.get(IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH);
  if (
    typeof verification?.bindingAnchorSha256 !== "string"
    || verification.bindingAnchorSha256 !== sha256(anchor.bytes)
  ) {
    ceremonyConfigHold(
      "CEREMONY_BINDING_SNAPSHOT_HOLD",
      "captured ceremony binding anchor differs from the verified anchor",
    );
  }
  const runtimeEvidence = capturedByPath.get(IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH);
  if (
    verification?.runtimeEvidenceVerified !== true
    || typeof verification?.runtimeEvidenceManifestSha256 !== "string"
    || verification.runtimeEvidenceManifestSha256 !== sha256(runtimeEvidence.bytes)
  ) {
    ceremonyConfigHold(
      "CEREMONY_BINDING_SNAPSHOT_HOLD",
      "captured ceremony runtime CI evidence differs from the verified manifest",
    );
  }
}

function createCeremonyServeGuard() {
  const captured = captureCeremonyRuntimeFiles();
  let activeTerminate = null;
  let snapshotVerified = false;

  const configure = (server) => {
    if (!snapshotVerified) {
      ceremonyConfigHold(
        "CEREMONY_BINDING_SNAPSHOT_HOLD",
        "ceremony serve guard was installed before snapshot verification",
      );
    }
    let compromised = false;
    let closeStarted = false;
    let poll = null;

    const changedRuntimePath = () => {
      for (const record of captured.values()) {
        try {
          if (!readFileSync(record.absolutePath).equals(record.bytes)) return record.relativePath;
        } catch {
          return record.relativePath;
        }
      }
      return null;
    };
    const initialChangedPath = changedRuntimePath();
    if (initialChangedPath !== null) {
      ceremonyConfigHold(
        "CEREMONY_BINDING_RUNTIME_HOLD",
        `bound serve input changed before server configuration (${initialChangedPath})`,
      );
    }
    const cleanup = () => {
      if (poll !== null) clearInterval(poll);
      poll = null;
      if (server.watcher) server.watcher.off("all", watchedChange);
    };
    const terminate = (reason) => {
      if (closeStarted) return;
      compromised = true;
      closeStarted = true;
      process.exitCode = 1;
      cleanup();
      const message = `CEREMONY_BINDING_RUNTIME_HOLD: bound serve input changed (${reason}); server terminated`;
      if (server.config?.logger?.error) server.config.logger.error(message);
      else console.error(message);
      if (typeof server.close === "function") {
        Promise.resolve(server.close()).catch(() => {});
      } else if (server.httpServer) {
        server.httpServer.close();
      }
    };
    activeTerminate = terminate;
    const watchedChange = (_event, changedPath) => {
      const key = canonicalWatchPath(changedPath);
      if (captured.has(key)) terminate(captured.get(key).relativePath);
    };
    const assertRequestBoundary = (_request, response, next) => {
      const changedPath = changedRuntimePath();
      if (!compromised && changedPath === null) {
        next();
        return;
      }
      response.statusCode = 503;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end("CEREMONY_BINDING_RUNTIME_HOLD\n");
      terminate(changedPath ?? "prior runtime change");
    };

    server.middlewares.use(assertRequestBoundary);
    if (server.watcher) {
      server.watcher.add([...captured.values()].map(({ absolutePath }) => absolutePath));
      server.watcher.on("all", watchedChange);
    }
    poll = setInterval(() => {
      const changedPath = changedRuntimePath();
      if (changedPath !== null) terminate(changedPath);
    }, CEREMONY_GUARD_POLL_MS);
    server.httpServer?.once("close", cleanup);
  };

  return {
    assertVerifiedSnapshot(verification) {
      assertIatV2CeremonyCapturedSnapshot({ captured, verification });
      snapshotVerified = true;
    },
    plugin: {
      name: "iat-v2-devnet-program-ceremony-serve-guard",
      apply: "serve",
      configureServer: configure,
      handleHotUpdate({ file }) {
        const key = canonicalWatchPath(file);
        if (!captured.has(key)) return undefined;
        const relativePath = captured.get(key).relativePath;
        activeTerminate?.(relativePath);
        throw new Error(`CEREMONY_BINDING_RUNTIME_HOLD: hot update rejected for ${relativePath}`);
      },
    },
  };
}

export default defineConfig(({ command, isPreview }) => {
  if (command === "serve" && isPreview) {
    ceremonyConfigHold(
      "CEREMONY_BINDING_PREVIEW_HOLD",
      "Vite preview is disabled for the attended ceremony console; use the verified dev server only",
    );
  }
  let ceremonyServeGuard = null;
  if (command === "serve") {
    ceremonyServeGuard = createCeremonyServeGuard();
    const verification = verifyIatV2DevnetProgramCeremonyRuntimeBinding({ projectRoot: repositoryRoot });
    ceremonyServeGuard.assertVerifiedSnapshot(verification);
  }
  return {
    root,
    base: "/",
    plugins: [react(), ...(ceremonyServeGuard ? [ceremonyServeGuard.plugin] : [])],
    resolve: {
      alias: {
        crypto: path.join(root, "crypto-browser-shim.mjs"),
        https: path.join(root, "https-browser-shim.mjs"),
        util: path.join(root, "util-browser-shim.mjs"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 4175,
      strictPort: true,
      fs: {
        allow: [repositoryRoot],
      },
    },
    build: {
      outDir: path.join(root, "dist"),
      emptyOutDir: true,
      manifest: true,
    },
  };
});

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-v2-admin-inspection-20260803");
const readJson = (name) => JSON.parse(readFileSync(resolve(auditRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`IAT V2 admin inspection audit validation failed: ${message}`);
};

const manifest = readJson("manifest.json");
const checks = readJson("checks.json");
check(manifest.schema === "iat-v2-admin-inspection-manifest/v1", "unexpected manifest schema");
check(checks.schema === "iat-v2-admin-inspection-checks/v1", "unexpected checks schema");
check(manifest.status === "DRAFT_PARTIALLY_REMEDIATED_QA_HOLD" && checks.status === manifest.status, "audit must remain partial-remediation HOLD");
check(manifest.mainnetStatus === "UNSCHEDULED_HOLD" && checks.mainnetStatus === manifest.mainnetStatus, "mainnet must remain unscheduled HOLD");
check(manifest.assurance === "INTERNAL_CODEX_ASSISTED_LOCAL_NON_SIGNING_QA", "assurance boundary changed");
check(checks.sourceBinding.commit === manifest.sourceBinding.commit && checks.sourceBinding.gitTree === manifest.sourceBinding.gitTree, "source binding mismatch");
check(execFileSync("git", ["rev-parse", `${manifest.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim() === manifest.sourceBinding.gitTree, "source tree mismatch");
for (const [path, expected] of Object.entries(manifest.sourceSha256)) {
  check(sha256(execFileSync("git", ["show", `${manifest.sourceBinding.commit}:${path}`], { cwd: repoRoot })) === expected, `source hash mismatch for ${path}`);
}
for (const [name, expected] of Object.entries(manifest.artifactSha256)) {
  check(expected !== "PENDING", `${name} hash remains pending`);
  check(sha256(readFileSync(resolve(auditRoot, name))) === expected, `artifact hash mismatch for ${name}`);
}

const packageJson = JSON.parse(execFileSync("git", ["show", `${manifest.sourceBinding.commit}:projects/star-ascent/site/package.json`], { cwd: repoRoot, encoding: "utf8" }));
const mainSource = execFileSync("git", ["show", `${manifest.sourceBinding.commit}:projects/star-ascent/site/tools/iat-v2-admin-console/main.jsx`], { cwd: repoRoot, encoding: "utf8" });
const cssSource = execFileSync("git", ["show", `${manifest.sourceBinding.commit}:projects/star-ascent/site/tools/iat-v2-admin-console/style.css`], { cwd: repoRoot, encoding: "utf8" });
const testSource = execFileSync("git", ["show", `${manifest.sourceBinding.commit}:projects/star-ascent/site/scripts/test-iat-v2-admin-inspection-runtime.mjs`], { cwd: repoRoot, encoding: "utf8" });
check(packageJson.scripts["check:iat-v2-admin-inspection"] === "npm run build:iat-v2-admin && node scripts/test-iat-v2-admin-inspection-runtime.mjs", "inspection command mismatch");
check(packageJson.scripts["check:iat-v2"].includes("npm run check:iat-v2-admin-inspection"), "inspection runtime is not in the IAT V2 gate");
for (const marker of ["mode\") === \"inspect", "RPC reads, hardware loading, simulation, signing, and broadcast are disabled", "lazy(() => import(\"./FeatureRehearsal.jsx\"))", "await import(\"@trezor/connect-web\")"]) {
  check(mainSource.includes(marker), `admin source lacks ${marker}`);
}
check(!mainSource.includes("import TrezorConnect from"), "Trezor Connect became an eager import");
check(!cssSource.includes("fonts.googleapis.com") && !cssSource.includes("fonts.gstatic.com"), "admin CSS requires an external font origin");
for (const marker of ["externalRequests", "data-iat-trezor-connect", "is enabled in inspection mode", "FeatureRehearsal|ProgramUpgrade|\\/lib-"]) {
  check(testSource.includes(marker), `inspection test lacks ${marker}`);
}

check(checks.build.priorInitialJavaScriptBytes === 2148150 && checks.build.currentInitialJavaScriptBytes === 1063820, "initial bundle measurements changed");
check(checks.build.initialJavaScriptReductionBytes === 1084330 && checks.build.initialJavaScriptReductionPercent === 50.48, "bundle reduction mismatch");
check(checks.build.featureOnlyChunkBytes === 909373 && checks.build.trezorOnlyChunkBytes === 169595, "lazy chunk measurements changed");
for (const field of ["externalRequests", "pageErrors", "consoleErrors"]) check(checks.inspectionRuntime[field] === 0, `${field} must be zero`);
for (const field of ["operatorControlsDisabled"]) check(checks.inspectionRuntime[field] === true, `${field} must be true`);
for (const field of ["hardwareOrFeatureChunksLoaded", "rpcReadsPerformed", "hardwareAccessPerformed", "simulationPerformed", "signingPerformed", "broadcastingPerformed"]) check(checks.inspectionRuntime[field] === false, `${field} must be false`);
check(checks.inspectionRuntime.trezorConnectState === "unloaded", "Trezor must remain unloaded in inspection mode");
check(checks.finding.id === "QA-ADMIN-001" && checks.finding.state === "PARTIALLY_REMEDIATED_OPEN", "admin finding must remain partially remediated and open");
check(JSON.stringify(checks.finding.remainingExternalizedNodeImports) === JSON.stringify(["util", "crypto"]), "residual externalized imports changed");
for (const [field, value] of Object.entries(checks.clearance)) check(value === false, `checks clearance ${field} must remain false`);
for (const [field, value] of Object.entries(manifest.clearance)) check(value === false, `manifest clearance ${field} must remain false`);

console.log("IAT V2 admin inspection audit valid: non-signing isolated runtime passed, initial JS reduced 50.48%, QA-ADMIN-001 remains partially remediated/open, mainnet HOLD.");

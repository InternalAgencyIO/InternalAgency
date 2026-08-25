import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BPS08A_FD_MAP,
  BPS08A_PRINCIPAL_FIELDS,
  BPS08A_SOURCE_STATE,
  bps08PrincipalSha256
} from "../scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-runtime-binding-amendment-contract.mjs";

const ROOT = new URL("../", import.meta.url);
const schemaPath = new URL("docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-runtime-binding-amendment.v1.schema.json", ROOT);
const launcherPath = new URL("scripts/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-runtime-binding-launcher.mjs", ROOT);
const nativePath = new URL("native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-runtime-binding-provider/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound_fd12_runtime_binding_provider.c", ROOT);

test("source-only boundary remains HOLD", () => {
  assert.equal(BPS08A_SOURCE_STATE.sourceOnly, true);
  assert.equal(BPS08A_SOURCE_STATE.compiled, false);
  assert.equal(BPS08A_SOURCE_STATE.executed, false);
  assert.equal(BPS08A_SOURCE_STATE.devicePrompted, false);
  assert.equal(BPS08A_SOURCE_STATE.transactionSigned, false);
  assert.equal(BPS08A_SOURCE_STATE.broadcast, false);
  assert.equal(BPS08A_SOURCE_STATE.gitCheckpointed, false);
  assert.equal(BPS08A_SOURCE_STATE.released, false);
  assert.equal(BPS08A_SOURCE_STATE.decision, "HOLD");
});

test("descriptor allocation is exact and non-aliasing", () => {
  const values = Object.values(BPS08A_FD_MAP);
  assert.equal(new Set(values).size, values.length);
  assert.deepEqual([BPS08A_FD_MAP.watchdogPidfd, BPS08A_FD_MAP.observerPidfd, BPS08A_FD_MAP.custodianPidfd], [13, 14, 15]);
  assert.equal(BPS08A_FD_MAP.oneShotCasToken, 16);
  assert.equal(BPS08A_FD_MAP.runtimeBindingReceipt, 17);
  assert.equal(BPS08A_FD_MAP.kernelBindingDescriptor, 27);
  assert.equal(BPS08A_FD_MAP.runtimeBindingProviderExecutable, 28);
});

test("principal projection retains the frozen fourteen fields", () => {
  assert.deepEqual(BPS08A_PRINCIPAL_FIELDS, [
    "role", "pid", "uid", "gid", "startTicks", "pidfdFd", "pidfdDev", "pidfdIno",
    "executableSha256", "securityLabelSha256", "namespaceProjectionSha256",
    "cgroupProjectionSha256", "authorityProjectionSha256", "channelOpenFileDescriptionSha256"
  ]);
  const principal = Object.fromEntries(BPS08A_PRINCIPAL_FIELDS.map((field, index) => [field, field === "role" ? "watchdog" : field.endsWith("Sha256") ? "0".repeat(63) + "1" : String(index)]));
  const ordered = Object.fromEntries(BPS08A_PRINCIPAL_FIELDS.map((field) => [field, principal[field]]));
  assert.equal(bps08PrincipalSha256(principal), createHash("sha256").update(Buffer.from(`${JSON.stringify(ordered)}\n`, "utf8")).digest("hex"));
});

test("schema requires CAS, independent observation, quorum signatures and protected recovery", async () => {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.equal(schema.$defs.cas.properties.state.const, "ACQUIRED_ONCE_EXTERNAL_DURABLE");
  assert.equal(schema.$defs.device.properties.observedBy.const, "observer");
  assert.equal(schema.$defs.toolchain.properties.observedBy.const, "observer");
  assert.equal(schema.$defs.recovery.properties.authorizedBy.const, "custodian");
  assert.deepEqual(schema.$defs.signatures.required, ["watchdog", "observer", "custodian"]);
});

test("launcher preserves FD12 then FD11 then preflight then FD3 order", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /fd12Verified !== true/);
  assert.match(source, /fd11Verified !== true/);
  assert.match(source, /fd3Read === true/);
  assert.match(source, /EXECUTE_PINNED_FD28_NATIVE_PREFLIGHT_WITHOUT_FD3/);
  assert.match(source, /VERIFY_FD27_LIVE_KERNEL_DESCRIPTOR/);
  assert.match(source, /\[6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 25, 26, 27\]/);
  assert.match(source, /ONLY_THEN_READ_FD3_COMPILE_BOOTSTRAP/);
});

test("native provider uses durable CAS and holds identity across deletion", async () => {
  const source = await readFile(nativePath, "utf8");
  assert.match(source, /runtime_receipt_sha256/);
  assert.match(source, /provider_executable_sha256/);
  assert.match(source, /role_public_keys\[3\]\[32\]/);
  assert.match(source, /role_signatures\[3\]\[64\]/);
  assert.match(source, /EVP_DigestVerify/);
  assert.match(source, /verify_descriptor_quorum/);
  assert.match(source, /principal_sha256/);
  assert.match(source, /timer_ofd_sha256\[2\]\[32\]/);
  assert.match(source, /timer_deadline_ns_be\[2\]/);
  assert.match(source, /timerfd_gettime/);
  assert.match(source, /--preflight-native/);
  assert.match(source, /O_CREAT \| O_EXCL \| O_WRONLY/);
  assert.match(source, /fdatasync\(marker\)/);
  assert.match(source, /SYS_renameat2/);
  assert.match(source, /RENAME_NOREPLACE/);
  assert.match(source, /openat\(FD_QUARANTINE_DIR, tombstone, O_PATH \| O_NOFOLLOW/);
  assert.match(source, /unlinkat\(FD_QUARANTINE_DIR, tombstone, 0\)/);
  assert.match(source, /held_stat\.st_nlink == 0/);
  assert.doesNotMatch(source, /unlink\(target\)/);
});

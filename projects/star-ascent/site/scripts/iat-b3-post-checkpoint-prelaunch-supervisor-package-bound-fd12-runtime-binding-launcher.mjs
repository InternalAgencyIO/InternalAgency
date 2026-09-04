import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  BPS08A_COMPILE_FD_MAP,
  parseCanonicalRuntimeBindingReceipt,
  verifyRuntimeBindingAuthority,
  verifyRuntimeBindingReceipt
} from "./lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-runtime-binding-amendment-contract.mjs";

const FD = BPS08A_COMPILE_FD_MAP;
const PREFLIGHT_LINE = /^\{"casTokenSha256":"([0-9a-f]{64})","kernelDescriptorSha256":"([0-9a-f]{64})","ledgerIdentitySha256":"([0-9a-f]{64})","outcome":"LIVE_KERNEL_BINDING_VERIFIED"\}\n$/u;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function readDuplicate(fd) {
  const duplicate = openSync(`/proc/self/fd/${fd}`, "r");
  try {
    return readFileSync(duplicate);
  } finally {
    closeSync(duplicate);
  }
}

function nativePreflight(expectedProviderSha256) {
  const providerSha256 = createHash("sha256").update(readDuplicate(FD.runtimeBindingProviderExecutable)).digest("hex");
  if (providerSha256 !== expectedProviderSha256) fail("RUNTIME_BINDING_PROVIDER_EXECUTABLE_SUBSTITUTION");
  const stdio = Array.from({ length: FD.runtimeBindingProviderExecutable + 1 }, () => "ignore");
  stdio[1] = "pipe";
  stdio[2] = "pipe";
  for (const fd of [6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 25, 26, 27]) stdio[fd] = fd;
  const result = spawnSync(`/proc/self/fd/${FD.runtimeBindingProviderExecutable}`, ["--preflight-compile"], {
    env: Object.create(null),
    stdio,
    timeout: 10_000,
    windowsHide: true
  });
  if (result.error || result.status !== 0 || result.signal !== null) fail("RUNTIME_BINDING_NATIVE_PREFLIGHT_FAILED");
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("ascii") : "";
  const match = PREFLIGHT_LINE.exec(stdout);
  if (!match || (result.stderr && result.stderr.length !== 0)) fail("RUNTIME_BINDING_NATIVE_PREFLIGHT_EVIDENCE_INVALID");
  return Object.freeze({
    casTokenSha256: match[1],
    kernelDescriptorSha256: match[2],
    ledgerIdentitySha256: match[3]
  });
}

export function loadRuntimeBindingAfterFd11BeforeFd3({ verifiedAnchor, monotonicNowNs }) {
  if (!verifiedAnchor || verifiedAnchor.fd12Verified !== true || verifiedAnchor.fd11Verified !== true || verifiedAnchor.fd3Read === true) fail("RUNTIME_BINDING_VERIFICATION_ORDER");
  const receiptBytes = readDuplicate(FD.runtimeBindingReceipt);
  parseCanonicalRuntimeBindingReceipt(receiptBytes);
  const authority = verifyRuntimeBindingAuthority({ receiptBytes, anchor: verifiedAnchor, monotonicNowNs });
  const preflight = nativePreflight(authority.receipt.runtimeBindingProviderSha256);
  return verifyRuntimeBindingReceipt({
    receiptBytes,
    anchor: verifiedAnchor,
    nativePreflight: preflight,
    monotonicNowNs
  });
}

export const RUNTIME_BINDING_LAUNCH_ORDER = Object.freeze([
  "VERIFY_FD12_SAME_HANDLE_OWNER_ROOT_ANCHOR",
  "VERIFY_FD11_HARDWARE_SIGNED_ANCHOR_RECEIPT",
  "EXECUTE_PINNED_FD28_NATIVE_PREFLIGHT_WITHOUT_FD3",
  "CONSUME_FD16_ONE_SHOT_CAS_TOKEN",
  "VERIFY_FD27_LIVE_KERNEL_DESCRIPTOR",
  "VERIFY_FD17_WATCHDOG_OBSERVER_CUSTODIAN_SIGNATURES",
  "ONLY_THEN_READ_FD3_COMPILE_BOOTSTRAP"
]);

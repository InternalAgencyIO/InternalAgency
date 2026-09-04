import { createHash, createPublicKey, verify } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export const BPS08A_SCHEMA_ID = "iat-b3-bps08a-runtime-binding-receipt/v1";
export const BPS08A_ROLE_ORDER = Object.freeze(["watchdog", "observer", "custodian"]);
export const BPS08A_COMMON_FD_MAP = Object.freeze({
  compileBootstrap: 3,
  watchdogChannel: 6,
  observerChannel: 7,
  custodianChannel: 8,
  operationTimer: 9,
  teardownTimer: 10,
  anchorReceipt: 11,
  ownerRootKeyAnchor: 12,
  watchdogPidfd: 13,
  observerPidfd: 14,
  custodianPidfd: 15,
  oneShotCasToken: 16,
  runtimeBindingReceipt: 17
});
export const BPS08A_COMPILE_FD_MAP = Object.freeze({
  ...BPS08A_COMMON_FD_MAP,
  sysrootDirectory: 18,
  launchCwdDirectory: 19,
  compiler: 20,
  linker: 21,
  archiver: 22,
  staticNode: 23,
  executorSource: 24,
  protectedDestinationParent: 25,
  recoveryQuarantineDirectory: 26,
  kernelBindingDescriptor: 27,
  runtimeBindingProviderExecutable: 28
});
export const BPS08A_NATIVE_FD_MAP = Object.freeze({
  ...BPS08A_COMMON_FD_MAP,
  installParent: 5,
  evidence: 20,
  selfImage: 21,
  recoveryQuarantineDirectory: 22,
  kernelBindingDescriptor: 23,
  runtimeBindingProviderExecutable: 24
});
export const BPS08A_FD_MAP = BPS08A_COMPILE_FD_MAP;

export const BPS08A_PRINCIPAL_FIELDS = Object.freeze([
  "role", "pid", "uid", "gid", "startTicks", "pidfdFd", "pidfdDev", "pidfdIno",
  "executableSha256", "securityLabelSha256", "namespaceProjectionSha256",
  "cgroupProjectionSha256", "authorityProjectionSha256", "channelOpenFileDescriptionSha256"
]);

export const BPS08A_SOURCE_STATE = Object.freeze({
  sourceOnly: true,
  compiled: false,
  installed: false,
  executed: false,
  devicePrompted: false,
  transactionSigned: false,
  broadcast: false,
  gitCheckpointed: false,
  released: false,
  decision: "HOLD",
  authority: "NONE"
});

const TOP_KEYS = Object.freeze([
  "schema", "attemptId", "runId", "sessionId", "bootId", "anchorReceiptSha256",
  "ownerRootDescriptorSha256", "runtimeBindingProviderSha256", "kernelDescriptorSha256",
  "expiresAtMonotonicNs", "cas", "peers", "device", "toolchain", "recovery",
  "signatures", "decision", "authority"
]);
const CAS_KEYS = Object.freeze(["keySha256", "tokenSha256", "ledgerIdentitySha256", "acquireReceiptSha256", "state"]);
const DEVICE_KEYS = Object.freeze([
  "model", "firmwareVersion", "firmwareIdentitySha256", "derivationPath", "accountPublicKeyHex",
  "accountAddress", "deviceReceiptSha256", "physicalConfirmationReceiptSha256", "observedBy"
]);
const TOOLCHAIN_KEYS = Object.freeze([
  "manifestSha256", "toolOpenFileDescriptionManifestSha256", "sysrootManifestSha256",
  "staticNodeIdentitySha256", "sysrootIdentity", "cwdIdentity", "observedBy"
]);
const RECOVERY_KEYS = Object.freeze([
  "protectedParentIdentity", "quarantineIdentity", "exclusiveLeaseCasSha256",
  "targetNameSha256", "tombstoneNameSha256", "algorithm", "authorizedBy"
]);
const IDENTITY_KEYS = Object.freeze(["dev", "ino", "mode", "mountId", "openFileDescriptionSha256"]);
const SIGNATURE_KEYS = Object.freeze(["publicKeyHex", "signatureHex"]);
const HEX64 = /^[0-9a-f]{64}$/u;
const HEX128 = /^[0-9a-f]{128}$/u;
const DECIMAL = /^(0|[1-9][0-9]*)$/u;
const RAW_ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertRecord(value, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  return value;
}

function assertExactKeys(value, expected, code) {
  assertRecord(value, code);
  if (!isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort())) fail(code);
}

function assertString(value, code, maximum = 512) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) fail(code);
}

function assertHex(value, pattern, code) {
  if (typeof value !== "string" || !pattern.test(value)) fail(code);
}

function assertDecimal(value, code) {
  if (typeof value !== "string" || !DECIMAL.test(value) || value.length > 32) fail(code);
}

function canonical(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  assertRecord(value, "RUNTIME_BINDING_NONCANONICAL_VALUE");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function canonicalJsonLf(value) {
  return Buffer.from(`${canonical(value)}\n`, "utf8");
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function bps08PrincipalSha256(principal) {
  const ordered = Object.create(null);
  for (const field of BPS08A_PRINCIPAL_FIELDS) ordered[field] = principal[field];
  return sha256Hex(Buffer.from(`${JSON.stringify(ordered)}\n`, "utf8"));
}

function validateIdentity(identity, code) {
  assertExactKeys(identity, IDENTITY_KEYS, code);
  assertDecimal(identity.dev, code);
  assertDecimal(identity.ino, code);
  assertString(identity.mode, code, 8);
  assertDecimal(identity.mountId, code);
  assertHex(identity.openFileDescriptionSha256, HEX64, code);
}

function validatePrincipal(principal, role) {
  const code = `RUNTIME_BINDING_${role.toUpperCase()}_PRINCIPAL`;
  assertExactKeys(principal, BPS08A_PRINCIPAL_FIELDS, code);
  if (principal.role !== role) fail(code);
  for (const field of ["pid", "uid", "gid", "startTicks", "pidfdFd", "pidfdDev", "pidfdIno"]) assertDecimal(principal[field], code);
  if (principal.pidfdFd !== String(BPS08A_FD_MAP[`${role}Pidfd`])) fail(code);
  for (const field of BPS08A_PRINCIPAL_FIELDS.filter((field) => field.endsWith("Sha256"))) assertHex(principal[field], HEX64, code);
}

function minimumFirmware(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  return parts[0] > 2 || (parts[0] === 2 && (parts[1] > 12 || (parts[1] === 12 && parts[2] >= 4)));
}

export function validateReceiptShape(receipt) {
  assertExactKeys(receipt, TOP_KEYS, "RUNTIME_BINDING_TOP_KEYS");
  if (receipt.schema !== BPS08A_SCHEMA_ID) fail("RUNTIME_BINDING_SCHEMA");
  for (const field of ["attemptId", "runId", "sessionId", "bootId"]) assertString(receipt[field], `RUNTIME_BINDING_${field.toUpperCase()}`);
  for (const field of ["anchorReceiptSha256", "ownerRootDescriptorSha256", "runtimeBindingProviderSha256", "kernelDescriptorSha256"]) assertHex(receipt[field], HEX64, `RUNTIME_BINDING_${field.toUpperCase()}`);
  assertDecimal(receipt.expiresAtMonotonicNs, "RUNTIME_BINDING_EXPIRY");

  assertExactKeys(receipt.cas, CAS_KEYS, "RUNTIME_BINDING_CAS");
  for (const field of CAS_KEYS.filter((field) => field.endsWith("Sha256"))) assertHex(receipt.cas[field], HEX64, "RUNTIME_BINDING_CAS");
  if (receipt.cas.state !== "ACQUIRED_ONCE_EXTERNAL_DURABLE") fail("RUNTIME_BINDING_CAS_STATE");

  assertExactKeys(receipt.peers, BPS08A_ROLE_ORDER, "RUNTIME_BINDING_PEERS");
  for (const role of BPS08A_ROLE_ORDER) validatePrincipal(receipt.peers[role], role);
  if (new Set(BPS08A_ROLE_ORDER.map((role) => bps08PrincipalSha256(receipt.peers[role]))).size !== 3) fail("RUNTIME_BINDING_PRINCIPAL_ALIAS");

  assertExactKeys(receipt.device, DEVICE_KEYS, "RUNTIME_BINDING_DEVICE");
  if (receipt.device.model !== "T2T1" || !minimumFirmware(receipt.device.firmwareVersion) || receipt.device.observedBy !== "observer") fail("RUNTIME_BINDING_DEVICE_AUTHORITY");
  for (const field of ["firmwareIdentitySha256", "deviceReceiptSha256", "physicalConfirmationReceiptSha256"]) assertHex(receipt.device[field], HEX64, "RUNTIME_BINDING_DEVICE");
  assertHex(receipt.device.accountPublicKeyHex, HEX64, "RUNTIME_BINDING_DEVICE_KEY");
  for (const field of ["derivationPath", "accountAddress"]) assertString(receipt.device[field], "RUNTIME_BINDING_DEVICE");

  assertExactKeys(receipt.toolchain, TOOLCHAIN_KEYS, "RUNTIME_BINDING_TOOLCHAIN");
  if (receipt.toolchain.observedBy !== "observer") fail("RUNTIME_BINDING_TOOLCHAIN_AUTHORITY");
  for (const field of TOOLCHAIN_KEYS.filter((field) => field.endsWith("Sha256"))) assertHex(receipt.toolchain[field], HEX64, "RUNTIME_BINDING_TOOLCHAIN");
  validateIdentity(receipt.toolchain.sysrootIdentity, "RUNTIME_BINDING_SYSROOT_IDENTITY");
  validateIdentity(receipt.toolchain.cwdIdentity, "RUNTIME_BINDING_CWD_IDENTITY");

  assertExactKeys(receipt.recovery, RECOVERY_KEYS, "RUNTIME_BINDING_RECOVERY");
  validateIdentity(receipt.recovery.protectedParentIdentity, "RUNTIME_BINDING_PROTECTED_PARENT");
  validateIdentity(receipt.recovery.quarantineIdentity, "RUNTIME_BINDING_QUARANTINE");
  for (const field of ["exclusiveLeaseCasSha256", "targetNameSha256", "tombstoneNameSha256"]) assertHex(receipt.recovery[field], HEX64, "RUNTIME_BINDING_RECOVERY");
  if (receipt.recovery.algorithm !== "HOLD_FD_RENAMEAT2_REOPEN_COMPARE_FSYNC_UNLINKAT_PROVE_ENOENT_NLINK0" || receipt.recovery.authorizedBy !== "custodian") fail("RUNTIME_BINDING_RECOVERY_POLICY");

  assertExactKeys(receipt.signatures, BPS08A_ROLE_ORDER, "RUNTIME_BINDING_SIGNATURES");
  for (const role of BPS08A_ROLE_ORDER) {
    assertExactKeys(receipt.signatures[role], SIGNATURE_KEYS, `RUNTIME_BINDING_${role.toUpperCase()}_SIGNATURE`);
    assertHex(receipt.signatures[role].publicKeyHex, HEX64, `RUNTIME_BINDING_${role.toUpperCase()}_KEY`);
    assertHex(receipt.signatures[role].signatureHex, HEX128, `RUNTIME_BINDING_${role.toUpperCase()}_SIGNATURE`);
  }
  if (new Set(BPS08A_ROLE_ORDER.map((role) => receipt.signatures[role].publicKeyHex)).size !== 3) fail("RUNTIME_BINDING_SIGNING_KEY_ALIAS");
  if (receipt.decision !== "RUNTIME_BOUND" || receipt.authority !== "WATCHDOG_OBSERVER_CUSTODIAN_QUORUM") fail("RUNTIME_BINDING_DECISION");
  return receipt;
}

export function parseCanonicalRuntimeBindingReceipt(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 131072 || bytes.at(-1) !== 0x0a || bytes.includes(0x00)) fail("RUNTIME_BINDING_RECEIPT_FRAMING");
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) fail("RUNTIME_BINDING_RECEIPT_BOM");
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8", 0, -1));
  } catch {
    fail("RUNTIME_BINDING_RECEIPT_JSON");
  }
  if (!canonicalJsonLf(parsed).equals(bytes)) fail("RUNTIME_BINDING_RECEIPT_NOT_CANONICAL");
  return validateReceiptShape(parsed);
}

function unsignedReceipt(receipt) {
  const { signatures: _signatures, ...unsigned } = receipt;
  return unsigned;
}

export function roleSigningBytes(role, unsigned) {
  if (!BPS08A_ROLE_ORDER.includes(role)) fail("RUNTIME_BINDING_UNKNOWN_ROLE");
  return Buffer.concat([
    Buffer.from(`IAT_B3_BPS08A_${role.toUpperCase()}_RUNTIME_BINDING_V1`, "ascii"),
    Buffer.from([0]),
    canonicalJsonLf(unsigned)
  ]);
}

function verifyRoleSignature(role, receipt, expectedPublicKeyHex) {
  const envelope = receipt.signatures[role];
  if (envelope.publicKeyHex !== expectedPublicKeyHex) fail(`RUNTIME_BINDING_${role.toUpperCase()}_KEY_SUBSTITUTION`);
  const key = createPublicKey({
    key: Buffer.concat([RAW_ED25519_SPKI_PREFIX, Buffer.from(expectedPublicKeyHex, "hex")]),
    format: "der",
    type: "spki"
  });
  if (!verify(null, roleSigningBytes(role, unsignedReceipt(receipt)), key, Buffer.from(envelope.signatureHex, "hex"))) fail(`RUNTIME_BINDING_${role.toUpperCase()}_SIGNATURE_INVALID`);
}

export function assembleSignedRuntimeBindingReceipt(unsigned, signerEnvelopes) {
  assertRecord(unsigned, "RUNTIME_BINDING_UNSIGNED_RECEIPT");
  assertExactKeys(signerEnvelopes, BPS08A_ROLE_ORDER, "RUNTIME_BINDING_SIGNER_ENVELOPES");
  const receipt = { ...unsigned, signatures: signerEnvelopes };
  validateReceiptShape(receipt);
  for (const role of BPS08A_ROLE_ORDER) verifyRoleSignature(role, receipt, signerEnvelopes[role].publicKeyHex);
  return canonicalJsonLf(receipt);
}

function equal(actual, expected, code) {
  if (actual !== expected) fail(code);
}

export function verifyRuntimeBindingAuthority({ receiptBytes, anchor, monotonicNowNs }) {
  assertRecord(anchor, "RUNTIME_BINDING_ANCHOR");
  const receipt = parseCanonicalRuntimeBindingReceipt(receiptBytes);
  for (const field of ["attemptId", "runId", "sessionId", "bootId", "anchorReceiptSha256", "ownerRootDescriptorSha256"]) {
    equal(receipt[field], anchor[field], `RUNTIME_BINDING_ANCHOR_${field.toUpperCase()}_MISMATCH`);
  }
  if (!DECIMAL.test(String(monotonicNowNs)) || BigInt(receipt.expiresAtMonotonicNs) <= BigInt(monotonicNowNs)) fail("RUNTIME_BINDING_EXPIRED");

  for (const role of BPS08A_ROLE_ORDER) {
    const keyField = `${role}PublicKeyHex`;
    assertHex(anchor[keyField], HEX64, `RUNTIME_BINDING_ANCHOR_${keyField.toUpperCase()}`);
    verifyRoleSignature(role, receipt, anchor[keyField]);
    const principalSha256 = bps08PrincipalSha256(receipt.peers[role]);
    if (anchor[`${role}PrincipalSha256`] !== principalSha256) fail(`RUNTIME_BINDING_${role.toUpperCase()}_PRINCIPAL_ANCHOR_MISMATCH`);
  }
  if (anchor.ownerRootPublicKeyHex && BPS08A_ROLE_ORDER.some((role) => receipt.signatures[role].publicKeyHex === anchor.ownerRootPublicKeyHex)) fail("RUNTIME_BINDING_ROOT_PEER_KEY_ALIAS");

  for (const field of ["model", "firmwareVersion", "firmwareIdentitySha256", "derivationPath", "accountPublicKeyHex", "accountAddress", "deviceReceiptSha256", "physicalConfirmationReceiptSha256"]) {
    const anchorField = `device${field[0].toUpperCase()}${field.slice(1)}`;
    equal(receipt.device[field], anchor[anchorField], `RUNTIME_BINDING_DEVICE_${field.toUpperCase()}_MISMATCH`);
  }
  return Object.freeze({ receipt, receiptSha256: sha256Hex(receiptBytes) });
}

export function verifyRuntimeBindingReceipt({ receiptBytes, anchor, nativePreflight, monotonicNowNs }) {
  assertRecord(nativePreflight, "RUNTIME_BINDING_NATIVE_PREFLIGHT");
  const authority = verifyRuntimeBindingAuthority({ receiptBytes, anchor, monotonicNowNs });
  const { receipt } = authority;
  equal(receipt.kernelDescriptorSha256, nativePreflight.kernelDescriptorSha256, "RUNTIME_BINDING_KERNEL_DESCRIPTOR_MISMATCH");
  equal(receipt.cas.tokenSha256, nativePreflight.casTokenSha256, "RUNTIME_BINDING_CAS_TOKEN_MISMATCH");
  equal(receipt.cas.ledgerIdentitySha256, nativePreflight.ledgerIdentitySha256, "RUNTIME_BINDING_CAS_LEDGER_MISMATCH");
  return Object.freeze({
    receipt,
    receiptSha256: authority.receiptSha256,
    kernelDescriptorSha256: nativePreflight.kernelDescriptorSha256,
    casTokenSha256: nativePreflight.casTokenSha256,
    decision: "RUNTIME_BOUND",
    authority: "WATCHDOG_OBSERVER_CUSTODIAN_QUORUM"
  });
}

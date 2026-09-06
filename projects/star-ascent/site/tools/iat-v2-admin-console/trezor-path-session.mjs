import { assertTrezorSolanaVerificationCapability } from "./trezor-provider.mjs";

const trezorPathSessions = new WeakSet();
const trezorPathSessionBindings = new WeakMap();

function expectedAddressText(expectedAddress) {
  const address = typeof expectedAddress === "string"
    ? expectedAddress
    : expectedAddress?.toBase58?.();
  if (typeof address !== "string" || address.length === 0) {
    throw new Error("Model T session gate requires an exact expected Solana address");
  }
  return address;
}

export function assertTrezorPathSession(session, expectedAddress) {
  if (!session || !trezorPathSessions.has(session)) {
    throw new Error("Model T address display verification is required for this browser session");
  }
  const binding = trezorPathSessionBindings.get(session);
  const expected = expectedAddressText(expectedAddress);
  if (!binding || binding.expectedAddress !== expected || session.expectedAddress !== expected) {
    throw new Error("Model T browser session is bound to a different Solana address");
  }
  const verified = assertTrezorSolanaVerificationCapability({
    capability: binding.verification,
    expectedAddress: expected,
  });
  if (
    session.verification !== binding.verification
    || session.path !== verified.path
    || session.publicKeyBase58 !== verified.publicKeyBase58
    || session.publicKey?.toBase58?.() !== verified.publicKeyBase58
    || session.verifiedOnDevice !== true
  ) {
    throw new Error("Model T browser session binding is inconsistent");
  }
  return session;
}

export function createTrezorPathSessionGate(expectedAddress) {
  const expected = expectedAddressText(expectedAddress);
  let session;
  let verificationInFlight = false;

  return Object.freeze({
    isVerified() {
      try {
        assertTrezorPathSession(session, expected);
        return true;
      } catch {
        return false;
      }
    },
    assertVerified() {
      return assertTrezorPathSession(session, expected);
    },
    async verify(openSession) {
      if (session) return assertTrezorPathSession(session, expected);
      if (verificationInFlight) {
        throw new Error("Model T address display verification is already in progress");
      }
      if (typeof openSession !== "function") {
        throw new Error("Model T address display verification is unavailable");
      }
      verificationInFlight = true;
      try {
        const verification = await openSession();
        const verified = assertTrezorSolanaVerificationCapability({
          capability: verification,
          expectedAddress: expected,
        });
        session = Object.freeze({
          expectedAddress: expected,
          path: verified.path,
          publicKey: verified.publicKey,
          publicKeyBase58: verified.publicKeyBase58,
          verification,
          verifiedOnDevice: true,
        });
        trezorPathSessions.add(session);
        trezorPathSessionBindings.set(session, Object.freeze({
          expectedAddress: expected,
          verification,
        }));
        return assertTrezorPathSession(session, expected);
      } finally {
        verificationInFlight = false;
      }
    },
  });
}

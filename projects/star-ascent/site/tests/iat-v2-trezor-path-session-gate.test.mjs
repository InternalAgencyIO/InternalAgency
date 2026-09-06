import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { Buffer } from "buffer";
import { Keypair } from "@solana/web3.js";
import {
  assertTrezorPathSession,
  createTrezorPathSessionGate,
} from "../tools/iat-v2-admin-console/trezor-path-session.mjs";
import {
  findTrezorSolanaAccount,
  verifyTrezorSolanaAccountOnDevice,
} from "../tools/iat-v2-admin-console/trezor-provider.mjs";

const MAIN = new URL("../tools/iat-v2-admin-console/main.jsx", import.meta.url);
const COMPONENT = new URL("../tools/iat-v2-admin-console/TrezorPathSessionGate.jsx", import.meta.url);
const PROVIDER = new URL("../tools/iat-v2-admin-console/trezor-provider.mjs", import.meta.url);

function solanaEntry(publicKey, path, accountIndex) {
  return {
    publicKey: Buffer.from(publicKey.toBytes()).toString("hex"),
    publicKeyBase58: publicKey.toBase58(),
    displayablePublicKey: publicKey.toBase58(),
    path: [0x8000002c, 0x800001f5, (0x80000000 + accountIndex) >>> 0, 0x80000000],
    serializedPath: path,
  };
}

test("matched Solana discovery performs one exact on-device re-fetch for the matched path", async () => {
  const expected = Keypair.generate().publicKey;
  const decoy = Keypair.generate().publicKey;
  const paths = ["m/44'/501'/0'/0'", "m/44'/501'/3'/0'"];
  const requests = [];
  const connect = {
    async solanaGetPublicKey(request) {
      requests.push(request);
      if (Array.isArray(request.bundle)) {
        return {
          success: true,
          payload: [
            solanaEntry(decoy, paths[0], 0),
            solanaEntry(expected, paths[1], 3),
          ],
        };
      }
      return {
        success: true,
        payload: solanaEntry(expected, paths[1], 3),
      };
    },
  };

  const discovered = await findTrezorSolanaAccount({ connect, expectedAddress: expected, paths });
  const verified = await verifyTrezorSolanaAccountOnDevice({
    connect,
    account: discovered,
    expectedAddress: expected,
  });

  assert.equal(verified.verifiedOnDevice, true);
  assert.equal(verified.path, paths[1]);
  assert.ok(verified.publicKey.equals(expected));
  assert.deepEqual(requests[0], {
    bundle: paths.map((path) => ({ path, showOnTrezor: false })),
  });
  assert.deepEqual(requests[1], { path: paths[1], showOnTrezor: true });
  assert.equal(requests.filter((request) => request.showOnTrezor === true).length, 1);
});

test("on-device re-fetch rejects path or public-key substitution", async () => {
  const expected = Keypair.generate().publicKey;
  const other = Keypair.generate().publicKey;
  const path = "m/44'/501'/3'/0'";
  const account = { path, publicKey: expected };

  await assert.rejects(
    verifyTrezorSolanaAccountOnDevice({
      account,
      expectedAddress: expected,
      connect: {
        async solanaGetPublicKey() {
          return { success: true, payload: solanaEntry(expected, "m/44'/501'/0'/0'", 0) };
        },
      },
    }),
    /different Solana derivation path/u,
  );
  await assert.rejects(
    verifyTrezorSolanaAccountOnDevice({
      account,
      expectedAddress: expected,
      connect: {
        async solanaGetPublicKey() {
          return { success: true, payload: solanaEntry(other, path, 3) };
        },
      },
    }),
    /different Solana public key/u,
  );
  await assert.rejects(
    verifyTrezorSolanaAccountOnDevice({
      account,
      expectedAddress: expected,
      connect: {
        async solanaGetPublicKey() {
          return {
            success: true,
            payload: { ...solanaEntry(expected, path, 3), publicKey: undefined },
          };
        },
      },
    }),
    /both exact Solana public-key encodings/u,
  );
});

test("session gate accepts only a genuine expected-address capability and opens once in memory", async () => {
  const publicKey = Keypair.generate().publicKey;
  const other = Keypair.generate().publicKey;
  const path = "m/44'/501'/3'/0'";
  const gate = createTrezorPathSessionGate(publicKey);
  assert.equal(gate.isVerified(), false);
  assert.throws(() => gate.assertVerified(), /address display verification is required/u);

  await assert.rejects(
    gate.verify(async () => ({ path, publicKey, verifiedOnDevice: false })),
    /genuine on-device verification capability/u,
  );
  assert.equal(gate.isVerified(), false);

  const connect = {
    async solanaGetPublicKey(request) {
      assert.deepEqual(request, { path, showOnTrezor: true });
      return { success: true, payload: solanaEntry(publicKey, path, 3) };
    },
  };
  let openCalls = 0;
  const session = await gate.verify(async () => {
    openCalls += 1;
    return verifyTrezorSolanaAccountOnDevice({
      connect,
      account: { path, publicKey },
      expectedAddress: publicKey,
    });
  });
  assert.equal(gate.isVerified(), true);
  assert.equal(session.expectedAddress, publicKey.toBase58());
  assert.equal(gate.assertVerified().verification, session.verification);
  assert.equal(
    assertTrezorPathSession(session, publicKey).verification,
    session.verification,
  );
  const cached = await gate.verify(async () => {
    openCalls += 1;
    throw new Error("verified session must not prompt again");
  });
  assert.equal(cached.verification, session.verification);
  assert.equal(openCalls, 1);

  const wrongAddressGate = createTrezorPathSessionGate(other);
  await assert.rejects(
    wrongAddressGate.verify(async () => session.verification),
    /bound to a different Solana address/u,
  );
  assert.throws(
    () => assertTrezorPathSession({ ...session }, publicKey),
    /address display verification is required/u,
  );
});

test("action routes are render-gated behind an explicit nonpersistent verification button", () => {
  const main = fs.readFileSync(MAIN, "utf8");
  const component = fs.readFileSync(COMPONENT, "utf8");
  const provider = fs.readFileSync(PROVIDER, "utf8");

  assert.match(component, /DISPLAY \+ VERIFY MODEL T ADDRESS/u);
  assert.match(component, /reviewed account-zero path once with on-device display/u);
  assert.doesNotMatch(component, /discover the matching path/u);
  assert.match(component, /onClick=\{displayAndVerify\}/u);
  assert.match(
    component,
    /if \(phase === "VERIFIED"\)[\s\S]*assertVerified\(\)[\s\S]*return renderActionUi\(session\)/u,
  );
  assert.doesNotMatch(component, /useEffect\s*\(/u);
  assert.doesNotMatch(component, /(?:localStorage|sessionStorage)\.(?:getItem|setItem)\s*\(/u);
  assert.doesNotMatch(component, /indexedDB\./u);
  assert.match(main, /<TrezorPathSessionGate[\s\S]*renderActionUi=\{renderActionConsole\}/u);
  assert.match(main, /assertTrezorPathSession\(session, expectedAddress\)/u);
  assert.match(main, /const REVIEWED_MODEL_T_SOLANA_PATH = "m\/44'\/501'\/0'\/0'";/u);
  assert.match(
    main,
    /verifyTrezorSolanaAccountOnDevice\(\{[\s\S]*path: REVIEWED_MODEL_T_SOLANA_PATH,[\s\S]*publicKey: expectedAddress,[\s\S]*expectedAddress,/u,
  );
  assert.doesNotMatch(main, /findTrezorSolanaAccount/u);
  assert.match(provider, /trezorVerificationCapabilities\.has\(capability\)/u);
  assert.equal((provider.match(/showOnTrezor: true/gu) ?? []).length, 1);
});

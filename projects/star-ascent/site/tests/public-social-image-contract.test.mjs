import assert from "node:assert/strict";
import test from "node:test";
import {
  explicitSocialImageRoutes,
  socialImageContractForPath,
} from "../scripts/iat-public-social-image-contract.mjs";

test("future routes use their explicit reviewed social images", () => {
  assert.deepEqual(explicitSocialImageRoutes, [
    "/future",
    "/future/predictive-engine",
    "/future/casino",
  ]);
  assert.deepEqual(socialImageContractForPath("/future"), {
    path: "/images/future/predictive-engine-hero-v1.jpg",
  });
  assert.deepEqual(socialImageContractForPath("/future/predictive-engine"), {
    path: "/images/future/predictive-engine-hero-v1.jpg",
  });
  assert.deepEqual(socialImageContractForPath("/future/casino"), {
    path: "/images/future/casino-hero-v1.jpg",
  });
});

test("all other routes retain the canonical launch image and dimensions", () => {
  assert.deepEqual(socialImageContractForPath("/"), {
    path: "/og-star-ascent-v1.png",
    width: "1792",
    height: "1024",
  });
  assert.deepEqual(socialImageContractForPath("/network"), socialImageContractForPath("/dossier"));
});

test("non-canonical route identities fail closed", () => {
  for (const value of ["future", "/future?preview=1", "/future#preview", "", null]) {
    assert.throws(
      () => socialImageContractForPath(value),
      /publicPath must be one canonical absolute route/u,
    );
  }
});

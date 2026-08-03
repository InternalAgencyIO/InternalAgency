import assert from "node:assert/strict";
import test from "node:test";
import { metadataBaseFromRequest } from "../app/metadata-origin.mjs";

test("metadata origin keeps loopback QA on HTTP without weakening production HTTPS", () => {
  assert.equal(metadataBaseFromRequest("localhost:4176")?.href, "http://localhost:4176/");
  assert.equal(metadataBaseFromRequest("127.0.0.1:4176")?.href, "http://127.0.0.1:4176/");
  assert.equal(metadataBaseFromRequest("[::1]:4176")?.href, "http://[::1]:4176/");
  assert.equal(metadataBaseFromRequest("internalagency.io")?.href, "https://internalagency.io/");
});

test("metadata origin honors the first valid proxy protocol and host", () => {
  assert.equal(
    metadataBaseFromRequest("internalagency.io, edge.internal", "http, https")?.href,
    "http://internalagency.io/",
  );
  assert.equal(metadataBaseFromRequest("localhost:4176", "https")?.href, "https://localhost:4176/");
});

test("metadata origin rejects missing or malformed hosts and unsafe protocols", () => {
  assert.equal(metadataBaseFromRequest(undefined), undefined);
  assert.equal(metadataBaseFromRequest(""), undefined);
  assert.equal(metadataBaseFromRequest("not a host"), undefined);
  assert.equal(
    metadataBaseFromRequest("internalagency.io", "javascript")?.href,
    "https://internalagency.io/",
  );
});

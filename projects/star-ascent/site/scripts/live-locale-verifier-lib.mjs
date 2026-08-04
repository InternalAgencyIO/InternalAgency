export function responseIdentityError(requestedUrl, response) {
  const requested = new URL(requestedUrl);
  const final = new URL(response.url);
  if (response.redirected) return `unexpected redirect to ${response.url}`;
  if (final.origin !== requested.origin || final.pathname !== requested.pathname) {
    return `final origin/path ${final.origin}${final.pathname} != ${requested.origin}${requested.pathname}`;
  }
  return null;
}

export function runtimeBundleError({ contentType, bytes, contract }) {
  if (!contentType?.toLowerCase().includes("javascript")) {
    return `unexpected runtime content type ${contentType ?? "missing"}`;
  }
  if (bytes.length < 1_000) {
    return `unexpectedly small runtime response (${bytes.length} bytes)`;
  }

  const runtime = bytes.toString("utf8");
  const requiredMarkers = [
    contract.schema,
    contract.assetNamespace,
    contract.catalogSha256,
    contract.catalogSha256.slice(0, 16),
    "payload-contract-failed",
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !runtime.includes(marker));
  if (missingMarkers.length > 0) {
    return `runtime missing committed marker(s): ${missingMarkers.join(", ")}`;
  }
  if (runtime.includes("/i18n/")) {
    return "runtime still contains the legacy /i18n/ payload path";
  }
  return null;
}

export function runtimeParityError(results) {
  if (results.length < 2) return `runtime parity requires at least 2 domains; found ${results.length}`;
  if (results.some((result) => !result.ok || !result.assetPath || !result.sha256)) {
    return "runtime parity unavailable because a per-domain runtime result is incomplete";
  }

  const [reference, ...others] = results;
  const pathDrift = others.find((result) => result.assetPath !== reference.assetPath);
  if (pathDrift) {
    return `runtime asset path ${pathDrift.assetPath} != ${reference.assetPath}`;
  }
  const hashDrift = others.find((result) => result.sha256 !== reference.sha256);
  if (hashDrift) {
    return `runtime SHA-256 ${hashDrift.sha256} != ${reference.sha256}`;
  }
  return null;
}

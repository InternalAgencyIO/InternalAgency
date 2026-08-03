const loopbackHostPattern = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i;

function firstForwardedValue(value) {
  return value?.split(",", 1)[0]?.trim();
}

export function metadataBaseFromRequest(hostHeader, forwardedProtocolHeader) {
  const host = firstForwardedValue(hostHeader);
  if (!host) return undefined;

  const forwardedProtocol = firstForwardedValue(forwardedProtocolHeader)?.toLowerCase();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : loopbackHostPattern.test(host)
      ? "http"
      : "https";

  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return undefined;
  }
}

const defaultContract = Object.freeze({
  path: "/og-star-ascent-v1.png",
  width: "1792",
  height: "1024",
});

const routeContracts = new Map([
  ["/future", Object.freeze({ path: "/images/future/predictive-engine-hero-v1.jpg" })],
  ["/future/predictive-engine", Object.freeze({ path: "/images/future/predictive-engine-hero-v1.jpg" })],
  ["/future/casino", Object.freeze({ path: "/images/future/casino-hero-v1.jpg" })],
]);

export function socialImageContractForPath(publicPath) {
  if (
    typeof publicPath !== "string"
    || !publicPath.startsWith("/")
    || publicPath.includes("?")
    || publicPath.includes("#")
  ) {
    throw new TypeError(`publicPath must be one canonical absolute route; received ${publicPath}`);
  }
  return routeContracts.get(publicPath) ?? defaultContract;
}

export const explicitSocialImageRoutes = Object.freeze([...routeContracts.keys()]);

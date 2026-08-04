import type { MetadataRoute } from "next";
import { googleHreflangTag, localeCodes, localePath } from "./i18n/config";

const modified = new Date("2026-08-03T00:00:00Z");

const routes = [
  { path: "", changeFrequency: "daily" as const, priority: 1 },
  { path: "/dossier", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "/dossier/read/white-dossier", changeFrequency: "weekly" as const, priority: 0.78 },
  { path: "/dossier/read/tokenomics", changeFrequency: "weekly" as const, priority: 0.78 },
  { path: "/dossier/read/mint-manifest", changeFrequency: "daily" as const, priority: 0.82 },
  { path: "/dossier/read/genesis-proof", changeFrequency: "hourly" as const, priority: 0.88 },
  { path: "/dossier/read/broadcast-pack", changeFrequency: "weekly" as const, priority: 0.72 },
  { path: "/dossier/read/social-kit", changeFrequency: "weekly" as const, priority: 0.68 },
  { path: "/dossier/read/genesis-run", changeFrequency: "daily" as const, priority: 0.82 },
  { path: "/dossier/read/authority-map", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/dossier/read/technical-spec", changeFrequency: "weekly" as const, priority: 0.76 },
  { path: "/dossier/read/readiness", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/dossier/read/incident-response", changeFrequency: "weekly" as const, priority: 0.74 },
  { path: "/launch", changeFrequency: "hourly" as const, priority: 0.95 },
  { path: "/signal", changeFrequency: "hourly" as const, priority: 0.9 },
  { path: "/proof", changeFrequency: "hourly" as const, priority: 0.9 },
  { path: "/verify", changeFrequency: "daily" as const, priority: 0.85 },
  { path: "/press", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/rewards", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "/tokenomics", changeFrequency: "daily" as const, priority: 0.95 },
  { path: "/network", changeFrequency: "hourly" as const, priority: 0.95 },
  { path: "/world", changeFrequency: "weekly" as const, priority: 0.75 },
  { path: "/future", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/future/predictive-engine", changeFrequency: "weekly" as const, priority: 0.65 },
  { path: "/future/casino", changeFrequency: "weekly" as const, priority: 0.65 },
] as const;

function languageAlternates(path: string): Record<string, string> {
  const pathname = path || "/";
  return {
    ...Object.fromEntries(localeCodes.flatMap((locale) => {
      const tag = googleHreflangTag(locale);
      return tag ? [[tag, `https://internalagency.io${localePath(locale, pathname)}`]] : [];
    })),
    "tr-TR": `https://ileriakil.com${path}`,
    "x-default": `https://internalagency.io${path}`,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const canonicalRoots = ["https://internalagency.io", "https://ileriakil.com"];
  const canonical = canonicalRoots.flatMap((root) => routes.map((route) => ({
    url: `${root}${route.path}`,
    lastModified: modified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: { languages: languageAlternates(route.path) },
  })));
  const localized = localeCodes
    .filter((locale) => locale !== "en")
    .flatMap((locale) => routes.map((route) => ({
      url: `https://internalagency.io/${locale}${route.path}`,
      lastModified: modified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages: languageAlternates(route.path) },
    })));
  return [...canonical, ...localized];
}

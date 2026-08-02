import type { MetadataRoute } from "next";

const modified = new Date("2026-07-29T00:00:00Z");
const futureModified = new Date("2026-08-02T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const roots = ["https://internalagency.io", "https://ileriakil.com"];
  return roots.flatMap((root) => [
    { url: root, lastModified: modified, changeFrequency: "daily", priority: 1 },
    { url: `${root}/dossier`, lastModified: modified, changeFrequency: "daily", priority: 0.9 },
    { url: `${root}/launch`, lastModified: modified, changeFrequency: "hourly", priority: 0.95 },
    { url: `${root}/signal`, lastModified: modified, changeFrequency: "hourly", priority: 0.9 },
    { url: `${root}/proof`, lastModified: modified, changeFrequency: "hourly", priority: 0.9 },
    { url: `${root}/verify`, lastModified: modified, changeFrequency: "daily", priority: 0.85 },
    { url: `${root}/press`, lastModified: modified, changeFrequency: "daily", priority: 0.8 },
    { url: `${root}/rewards`, lastModified: modified, changeFrequency: "daily", priority: 0.9 },
    { url: `${root}/tokenomics`, lastModified: modified, changeFrequency: "daily", priority: 0.95 },
    { url: `${root}/network`, lastModified: modified, changeFrequency: "hourly", priority: 0.95 },
    { url: `${root}/world`, lastModified: modified, changeFrequency: "weekly", priority: 0.75 },
    { url: `${root}/future`, lastModified: futureModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${root}/future/predictive-engine`, lastModified: futureModified, changeFrequency: "weekly", priority: 0.65 },
    { url: `${root}/future/casino`, lastModified: futureModified, changeFrequency: "weekly", priority: 0.65 },
  ]);
}

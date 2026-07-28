import type { MetadataRoute } from "next";

const modified = new Date("2026-07-27T00:00:00Z");

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
    { url: `${root}/world`, lastModified: modified, changeFrequency: "weekly", priority: 0.75 },
  ]);
}

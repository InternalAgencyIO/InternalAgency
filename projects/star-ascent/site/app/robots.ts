import type { MetadataRoute } from "next";
import { runtimeContentLocale } from "./i18n/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: [
      "https://internalagency.io/sitemap.xml",
      ...(runtimeContentLocale("tr") === "tr" ? ["https://ileriakil.com/sitemap.xml"] : []),
    ],
  };
}

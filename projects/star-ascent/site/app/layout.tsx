import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./audit-remediation.css";
import "./postgenesis-tease.css";
import { DossierDock } from "./DossierDock";
import { CrewSignal } from "./CrewSignal";
import { DocumentLinkUpgrade } from "./DocumentLinkUpgrade";
import { googleHreflangTag, htmlLanguageTag, localeCodes, localeDirection, localeFromRequestHeaders, localePath } from "./i18n/config";
import { LocaleRuntime, type PromptCopy } from "./i18n/LocaleRuntime";
import localizedMetadata from "./i18n/metadata.generated.json";
import routeSeo from "./i18n/route-seo.json";
import { metadataBaseFromRequest } from "./metadata-origin.mjs";

type LocaleMetadata = {
  title: string;
  description: string;
  imageAlt: string;
  prompt: PromptCopy;
  seo: Record<string, string>;
};

const metadataCatalog = localizedMetadata as Record<string, LocaleMetadata>;
const routeSeoCatalog = routeSeo as Record<string, { title: string; description: string }>;

function localizedUrl(locale: (typeof localeCodes)[number], publicPath: string): string {
  return `https://internalagency.io${localePath(locale, publicPath)}`;
}

function languageAlternates(publicPath: string): Record<string, string> {
  return {
    ...Object.fromEntries(localeCodes.flatMap((code) => {
      const tag = googleHreflangTag(code);
      return tag ? [[tag, localizedUrl(code, publicPath)]] : [];
    })),
    "tr-TR": `https://ileriakil.com${publicPath === "/" ? "" : publicPath}`,
    "x-default": localizedUrl("en", publicPath),
  };
}

function routeSeoSources(publicPath: string): { title: string; description: string } {
  return routeSeoCatalog[publicPath]
    ?? (publicPath.startsWith("/dossier/read/") ? routeSeoCatalog["/dossier"] : routeSeoCatalog["/"]);
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const metadataBase = metadataBaseFromRequest(host, requestHeaders.get("x-forwarded-proto"));
  const locale = localeFromRequestHeaders(requestHeaders.get("x-ia-locale"), host);
  const localeMetadata = metadataCatalog[locale];
  const publicPath = requestHeaders.get("x-ia-path") ?? "/";
  const sources = routeSeoSources(publicPath);
  const title = localeMetadata?.seo?.[sources.title] ?? localeMetadata?.title ?? sources.title;
  const description = localeMetadata?.seo?.[sources.description] ?? localeMetadata?.description ?? sources.description;
  const canonicalHost = host?.toLowerCase().includes("ileriakil") ? "https://ileriakil.com" : "https://internalagency.io";
  const canonicalPath = host?.toLowerCase().includes("ileriakil") ? publicPath : localePath(locale, publicPath);
  const canonical = `${canonicalHost}${canonicalPath === "/" ? "" : canonicalPath}`;
  const indexable = publicPath !== "/mint";
  return {
    metadataBase,
    title, description,
    alternates: {
      canonical,
      languages: languageAlternates(publicPath),
    },
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
        { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
        { url: "/favicon-radiance-32.png", type: "image/png", sizes: "32x32" },
        { url: "/favicon-radiance-48.png", type: "image/png", sizes: "48x48" },
        { url: "/favicon-radiance-192.png", type: "image/png", sizes: "192x192" },
        { url: "/favicon-radiance-512.png", type: "image/png", sizes: "512x512" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    },
    robots: indexable ? { index: true, follow: true } : "noindex, nofollow, noarchive",
    openGraph: { type: "website", url: canonical, siteName: "Internal Agency", title, description, images: [{ url: "/og-star-ascent-v1.png", width: 1792, height: 1024, alt: localeMetadata?.imageAlt ?? "STAR ASCENT launch control" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og-star-ascent-v1.png"] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const locale = localeFromRequestHeaders(
    requestHeaders.get("x-ia-locale"),
    host,
  );
  const publicPath = requestHeaders.get("x-ia-path") ?? "/";
  const turkishHost = Boolean(host?.toLowerCase().includes("ileriakil"));
  const promptCopy = metadataCatalog[locale]?.prompt ?? metadataCatalog.en.prompt;
  const canonical = turkishHost
    ? `https://ileriakil.com${publicPath === "/" ? "" : publicPath}`
    : localizedUrl(locale, publicPath);
  const localeMetadata = metadataCatalog[locale] ?? metadataCatalog.en;
  const sources = routeSeoSources(publicPath);
  const pageTitle = localeMetadata.seo?.[sources.title] ?? localeMetadata.title;
  const pageDescription = localeMetadata.seo?.[sources.description] ?? localeMetadata.description;
  const websiteUrl = turkishHost ? "https://ileriakil.com" : localizedUrl(locale, "/");
  const websiteId = `${websiteUrl}#website`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://internalagency.io/#organization",
        name: "Internal Agency",
        url: "https://internalagency.io",
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: localeMetadata.title,
        description: localeMetadata.description,
        url: websiteUrl,
        inLanguage: htmlLanguageTag(locale),
        publisher: { "@id": "https://internalagency.io/#organization" },
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonical,
        inLanguage: htmlLanguageTag(locale),
        isPartOf: { "@id": websiteId },
      },
    ],
  };
  const localeReady = locale === "en" || (locale === "tr" && turkishHost);
  return <html lang={htmlLanguageTag(locale)} dir={localeDirection(locale)} data-locale-ready={localeReady ? "true" : "false"}><head>{locale !== "en" && !turkishHost ? <link rel="preload" href={`/i18n/${locale}.json`} as="fetch" crossOrigin="anonymous" /> : null}</head><body className="antialiased">{children}<DocumentLinkUpgrade /><CrewSignal /><DossierDock /><LocaleRuntime locale={locale} promptCopy={promptCopy} publicPath={publicPath} turkishHost={turkishHost} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /></body></html>;
}

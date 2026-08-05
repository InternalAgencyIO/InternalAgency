import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./audit-remediation.css";
import "./postgenesis-tease.css";
import { DossierDock } from "./DossierDock";
import { CrewSignal } from "./CrewSignal";
import { DocumentLinkUpgrade } from "./DocumentLinkUpgrade";
import { googleHreflangTag, htmlLanguageTag, localeCodes, localeDirection, localeFromRequestHeaders, localePath, runtimeContentLocale } from "./i18n/config";
import { LocaleRuntime, type PromptCopy } from "./i18n/LocaleRuntime";
import { localePayloadPath } from "./i18n/payload-contract";
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

function canonicalUrl(
  locale: (typeof localeCodes)[number],
  publicPath: string,
  turkishHost: boolean,
): string {
  if (turkishHost && runtimeContentLocale("tr") !== "tr") {
    return localizedUrl("en", publicPath);
  }
  if (runtimeContentLocale(locale) !== locale) {
    return localizedUrl("en", publicPath);
  }
  if (turkishHost && locale === "tr") {
    return `https://ileriakil.com${publicPath === "/" ? "" : publicPath}`;
  }
  return localizedUrl(locale, publicPath);
}

function languageAlternates(publicPath: string): Record<string, string> {
  const turkishReady = runtimeContentLocale("tr") === "tr";
  return {
    ...Object.fromEntries(localeCodes.flatMap((code) => {
      if (runtimeContentLocale(code) !== code) return [];
      const tag = googleHreflangTag(code);
      return tag ? [[tag, localizedUrl(code, publicPath)]] : [];
    })),
    ...(turkishReady ? { "tr-TR": `https://ileriakil.com${publicPath === "/" ? "" : publicPath}` } : {}),
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
  const contentLocale = runtimeContentLocale(locale);
  const localeMetadata = metadataCatalog[contentLocale];
  const publicPath = requestHeaders.get("x-ia-path") ?? "/";
  const sources = routeSeoSources(publicPath);
  const title = localeMetadata?.seo?.[sources.title] ?? localeMetadata?.title ?? sources.title;
  const description = localeMetadata?.seo?.[sources.description] ?? localeMetadata?.description ?? sources.description;
  const turkishHost = Boolean(host?.toLowerCase().includes("ileriakil"));
  const turkishHostReviewHold = turkishHost && runtimeContentLocale("tr") !== "tr";
  const canonical = canonicalUrl(locale, publicPath, turkishHost);
  const indexable = publicPath !== "/mint"
    && contentLocale === locale
    && !turkishHostReviewHold;
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
  const contentLocale = runtimeContentLocale(locale);
  const fallbackPromptCopy: PromptCopy = {
    eyebrow: "LANGUAGE REVIEW HOLD",
    title: "English fallback is active",
    body: "This language is awaiting accountable review, so unreviewed machine text is not shown.",
    stay: "Continue in English",
    english: "Open English route",
    close: "Close language notice",
    timeout: "This closes on its own in 15 seconds.",
  };
  const promptCopy = contentLocale === locale
    ? metadataCatalog[locale]?.prompt ?? metadataCatalog.en.prompt
    : fallbackPromptCopy;
  const canonical = canonicalUrl(locale, publicPath, turkishHost);
  const localeMetadata = metadataCatalog[contentLocale] ?? metadataCatalog.en;
  const sources = routeSeoSources(publicPath);
  const pageTitle = localeMetadata.seo?.[sources.title] ?? localeMetadata.title;
  const pageDescription = localeMetadata.seo?.[sources.description] ?? localeMetadata.description;
  const websiteUrl = canonicalUrl(locale, "/", turkishHost);
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
        inLanguage: htmlLanguageTag(contentLocale),
        publisher: { "@id": "https://internalagency.io/#organization" },
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonical,
        inLanguage: htmlLanguageTag(contentLocale),
        isPartOf: { "@id": websiteId },
      },
    ],
  };
  const localeReady = contentLocale === "en";
  return <html lang={htmlLanguageTag(contentLocale)} dir={localeDirection(contentLocale)} data-route-locale={locale} data-locale-ready={localeReady ? "true" : "false"}><head>{!localeReady ? <link rel="preload" href={localePayloadPath(locale)} as="fetch" crossOrigin="anonymous" /> : null}</head><body className="antialiased">{children}<DocumentLinkUpgrade /><CrewSignal /><DossierDock /><LocaleRuntime locale={locale} contentLocale={contentLocale} promptCopy={promptCopy} publicPath={publicPath} turkishHost={turkishHost} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /></body></html>;
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { DossierDock } from "./DossierDock";
import { CrewSignal } from "./CrewSignal";
import { DocumentLinkUpgrade } from "./DocumentLinkUpgrade";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

function isTurkishHost(host: string | null) {
  return host?.toLowerCase().includes("ileriakil") ?? false;
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const tr = isTurkishHost(host);
  const title = tr ? "İleri Akıl — STAR ASCENT" : "Internal Agency — STAR ASCENT";
  const description = tr
    ? "İleri Akıl'ın ilk kamusal bölümü: şeffaf lansman bilgileri, IAT ekonomi politikası V2 ve mainnet BEKLET kanıt durumu."
    : "The first public chapter of Internal Agency: transparent launch information, IAT economic policy V2, and mainnet HOLD evidence status.";
  return {
    metadataBase: host ? new URL(`${protocol}://${host}`) : undefined,
    title, description,
    alternates: { languages: { en: "https://internalagency.io", tr: "https://ileriakil.com" } },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { type: "website", title, description, images: [{ url: "/og-star-ascent-v1.png", width: 1792, height: 1024, alt: tr ? "STAR ASCENT fırlatma kontrolü" : "STAR ASCENT launch control" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og-star-ascent-v1.png"] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const tr = isTurkishHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));
  return <html lang={tr ? "tr" : "en"}><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}<DocumentLinkUpgrade /><CrewSignal /><DossierDock /></body></html>;
}

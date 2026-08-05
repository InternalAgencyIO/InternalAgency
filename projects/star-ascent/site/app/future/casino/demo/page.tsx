import type { Metadata } from "next";
import { CasinoDemo } from "./CasinoDemo";

export const metadata: Metadata = {
  title: "Casino DLC — Nightflight Demo",
  description: "An English-only starship-nightlife Casino DLC mock with the permanent four-member fictional adult crew, simulated credits, and no wagers, wallets, contracts, or transactions.",
  alternates: {
    canonical: "https://internalagency.io/future/casino/demo",
    languages: {
      en: "https://internalagency.io/future/casino/demo",
      "x-default": "https://internalagency.io/future/casino/demo",
    },
  },
  robots: "noindex, nofollow, noarchive",
};

export default function CasinoDemoPage() {
  return <CasinoDemo />;
}

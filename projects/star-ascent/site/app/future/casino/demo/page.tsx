import type { Metadata } from "next";
import { CasinoDemo } from "./CasinoDemo";

export const metadata: Metadata = {
  title: "Casino DLC — Interactive Demo",
  description: "An English-only, front-end simulation of the proposed Casino DLC. Demo credits and fictional participants only; no wagers, wallets, contracts, or transactions.",
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

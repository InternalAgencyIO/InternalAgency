import type { Metadata } from "next";
import { FashionReveal } from "./FashionReveal";
import { FutureNav, InactiveStrip } from "./FutureNav";
import { futureCopy, getFutureLanguage } from "./language";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getFutureLanguage();
  const t = futureCopy[language].hub;
  return {
    title: t.metadataTitle,
    description: t.metadataDescription,
    openGraph: {
      title: t.metadataTitle,
      description: t.metadataSocialDescription,
      images: ["/images/future/predictive-engine-hero-v1.jpg"],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/images/future/predictive-engine-hero-v1.jpg"],
    },
  };
}

export default async function FutureSystemsPage() {
  const language = await getFutureLanguage();
  const t = futureCopy[language].hub;
  return (
    <main className="future-page future-hub">
      <FutureNav language={language} />
      <InactiveStrip target={t.target} language={language} />
      <header className="future-hub-hero">
        <p>{t.eyebrow}</p>
        <h1>{t.title[0]}<br /><i>{t.title[1]}</i></h1>
        <span>{t.body}</span>
      </header>
      <section className="future-portals" aria-label={t.portalsLabel}>
        <a className="future-portal portal-pet" href="/future/predictive-engine">
          <span>{t.predictiveTarget}</span>
          <div><p>{t.predictiveBrand}</p><h2>{t.predictiveTitle[0]}<br />{t.predictiveTitle[1]}</h2></div>
          <strong>{t.predictiveCta}</strong>
        </a>
        <a className="future-portal portal-casino" href="/future/casino">
          <span>{t.casinoTarget}</span>
          <div><p>{t.casinoBrand}</p><h2>{t.casinoTitle[0]}<br />{t.casinoTitle[1]}</h2></div>
          <strong>{t.casinoCta}</strong>
        </a>
      </section>
      <FashionReveal language={language} />
      <section className="future-boundary">
        <p>{t.boundaryEyebrow}</p>
        <h2>{t.boundaryTitle}</h2>
        <div>{t.boundaries.map((boundary) => <span key={boundary}>{boundary}</span>)}</div>
      </section>
      <footer className="future-footer"><a href="/">{t.return}</a><span>{t.footer}</span></footer>
    </main>
  );
}

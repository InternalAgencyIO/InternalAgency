import type { Metadata } from "next";
import { EditorialScene } from "../EditorialScene";
import { FutureNav, InactiveStrip } from "../FutureNav";
import { futureCopy, getFutureLanguage } from "../language";
import { ProtocolEdgeLoop } from "../ProtocolEdgeLoop";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getFutureLanguage();
  const t = futureCopy[language].casino;
  return {
    title: t.metadataTitle,
    description: t.metadataDescription,
    openGraph: { title: t.metadataTitle, description: t.metadataDescription, images: ["/images/future/casino-hero-v1.jpg"] },
    twitter: { card: "summary_large_image", images: ["/images/future/casino-hero-v1.jpg"] },
  };
}

export default async function CasinoPage() {
  const language = await getFutureLanguage();
  const common = futureCopy[language].common;
  const t = futureCopy[language].casino;
  return (
    <main className="future-page feature-page feature-casino">
      <FutureNav language={language} />
      <InactiveStrip target={t.target} language={language} />
      <header className="feature-hero">
        <div className="feature-hero-copy">
          <p>{t.eyebrow}</p>
          <h1>{t.title[0]}<br /><i>{t.title[1]}</i></h1>
          <span>{t.lede}</span>
          <a href="#proof-layers">{t.heroCta}</a>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial master is a local static asset */}
        <img src="/images/future/casino-hero-v1.jpg" alt={t.heroAlt} />
      </header>
      <section className="feature-statline" aria-label={t.statLabel}>
        {t.stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>
      <section className="media-teaser" aria-labelledby="casino-teaser-title">
        <div><p>{t.teaserEyebrow}</p><h2 id="casino-teaser-title">{t.teaserTitle[0]}<br />{t.teaserTitle[1]}</h2><span>{t.teaserBody}</span></div>
        <video controls playsInline preload="metadata" poster="/images/future/casino-hero-v1.jpg">
          <source src="/media/future/casino-dlc-teaser-15s-4k-v1.mp4" type="video/mp4" />
          {common.videoFallback}
        </video>
      </section>
      <section className="mechanics" id="proof-layers">
        <p>{t.mechanicsEyebrow}</p>
        <h2>{t.mechanicsTitle[0]}<br />{t.mechanicsTitle[1]}</h2>
        <div>{t.mechanics.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>
      <section className="fairness-note">
        <p>{t.fairnessEyebrow}</p>
        <h2>{t.fairnessTitle}</h2>
        <span>{t.fairnessBody}</span>
      </section>
      <ProtocolEdgeLoop language={language} />
      <EditorialScene
        eyebrow={t.editorialEyebrow}
        title={t.editorialTitle}
        body={t.editorialBody}
        image="/images/future/casino-everest-poker-v2.jpg"
        imageAlt={t.editorialAlt}
        video="/media/future/casino-everest-teaser-15s-4k-v2.mp4"
        caption={common.adultEditorial}
        videoFallback={common.videoFallback}
      />
      <section className="feature-next"><a href="/future/predictive-engine"><span>{t.otherLabel}</span>{t.otherTitle}</a></section>
      <footer className="future-footer"><a href="/future">{common.allFutureSystems}</a><span>{common.noActivationFooter}</span></footer>
    </main>
  );
}

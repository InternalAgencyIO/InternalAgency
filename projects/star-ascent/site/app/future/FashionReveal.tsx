import { futureCopy, type FutureLanguage } from "./language";

export function FashionReveal({ language }: { language: FutureLanguage }) {
  const t = futureCopy[language].fashion;
  return (
    <section className="fashion-section" aria-labelledby="fashion-title">
      <div className="fashion-copy">
        <p>{t.eyebrow}</p>
        <h2 id="fashion-title">{t.title[0]}<br />{t.title[1]}</h2>
        <span>{t.body}</span>
      </div>
      <figure className="fashion-reveal">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial master is a local static asset */}
        <img className="fashion-before" src="/images/future/predictive-engine-hero-v1.png" alt={t.beforeAlt} />
        {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial master is a local static asset */}
        <img className="fashion-after" src="/images/future/casino-hero-v1.png" alt={t.afterAlt} />
        <i className="fabric fabric-one" aria-hidden="true" />
        <i className="fabric fabric-two" aria-hidden="true" />
        <i className="fabric fabric-three" aria-hidden="true" />
        <span className="couture-rig" aria-hidden="true">
          <i className="rig-strap rig-strap-one" />
          <i className="rig-strap rig-strap-two" />
          <i className="rig-strap rig-strap-three" />
          <i className="corset-lacing" />
          <i className="metal-cuff cuff-one" />
          <i className="metal-cuff cuff-two" />
        </span>
        <figcaption>{t.caption}</figcaption>
      </figure>
    </section>
  );
}

export function FashionReveal() {
  return (
    <section className="fashion-section" aria-labelledby="fashion-title">
      <div className="fashion-copy">
        <p>RADIANCE · ELLIE · ALIA // TWO SYSTEMS, TWO LOOKS</p>
        <h2 id="fashion-title">THE SIGNAL<br />CHANGES OUTFIT.</h2>
        <span>
          A couture transition between probability blue and casino red. The animated fabric panels
          are decorative; both products remain inactive.
        </span>
      </div>
      <figure className="fashion-reveal">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial master is a local static asset */}
        <img className="fashion-before" src="/images/future/predictive-engine-hero-v1.png" alt="Adult Internal Agency trio presenting the future Predictive Engine concept" />
        {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial master is a local static asset */}
        <img className="fashion-after" src="/images/future/casino-hero-v1.png" alt="Adult Internal Agency trio in a playful futuristic Casino DLC pillow fight" />
        <i className="fabric fabric-one" aria-hidden="true" />
        <i className="fabric fabric-two" aria-hidden="true" />
        <i className="fabric fabric-three" aria-hidden="true" />
        <figcaption>ORIGINAL GENERATED ART · ADULT FICTIONAL CHARACTERS · PUBLIC-SAFE FASHION REVEAL</figcaption>
      </figure>
    </section>
  );
}

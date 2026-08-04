import { futureCopy, type FutureLanguage } from "./language";

export function ProtocolEdgeLoop({ language }: { language: FutureLanguage }) {
  const t = futureCopy[language].edge;
  return (
    <section className="edge-loop" aria-labelledby="edge-loop-title">
      <p>{t.eyebrow}</p>
      <h2 id="edge-loop-title">{t.title[0]}<br />{t.title[1]}<br />{t.title[2]}</h2>
      <div className="edge-loop-steps">
        {t.steps.map(([title, body], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <aside>{t.caveat}</aside>
    </section>
  );
}

import { futureCopy, type FutureLanguage } from "./language";

export function FutureNav({ language }: { language: FutureLanguage }) {
  const t = futureCopy[language].common;
  return (
    <nav className="future-nav" aria-label={t.navLabel}>
      <a className="future-mark" href="/" aria-label={t.homeLabel}>IA<span aria-hidden="true">///</span></a>
      <div>
        <a href="/future">{t.systems}</a>
        <a href="/future/predictive-engine">IA-PET</a>
        <a href="/future/casino">{t.casino}</a>
      </div>
    </nav>
  );
}

export function InactiveStrip({ target, language }: { target: string; language: FutureLanguage }) {
  const t = futureCopy[language].common;
  return (
    <div className="inactive-strip" role="note">
      <span>{t.postGenesis}</span>
      <span>{t.inactive}</span>
      <span>{t.noWagerRoute}</span>
      <strong>{target}</strong>
    </div>
  );
}

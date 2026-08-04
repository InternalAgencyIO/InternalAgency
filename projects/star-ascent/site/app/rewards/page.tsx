"use client";

import { useEffect, useState } from "react";
import "./rewards.css";

const copy = {
  en: {
    eyebrow: "STAR ASCENT // NODE REWARDS", title: <>THE FIRST<br /><i>1,000.</i></>, lede: "A Genesis Gift for the first verified nodes, then one public participation rhythm every UTC day.", hold: "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS", gift: "GENESIS GIFT", nodes: "VERIFIED NODES", clock: "DAILY SNAPSHOT", stats: [["100 IAT", "PER VERIFIED NODE"], ["1,000", "GENESIS CLAIM LIMIT"], ["00:00 UTC", "EPOCH SNAPSHOT"], ["00:05 UTC", "CLAIMS OPEN"]], staking: "PROPOSED STAKING RATES // NOT ACTIVE", stakingIntro: "A separate contract proposal uses simple annual reward rates paid weekly without automatic compounding. No staking position is currently accepted.", rates: [["17%", "CORE TEAM"], ["10%", "STANDARD USER"], ["28%", "CCC AGENT"], ["20%", "CCC ASSOCIATE"]], reserve: "Maximum combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions must be fully collateralized; all three lanes may reach zero by design.", terms: "READ COMPLETE ECONOMIC POLICY", protocol: "THE DAILY NODE PROTOCOL", steps: [["BIND", "One X account. One public Solana wallet. One signed node record."], ["WITNESS", "The verified Genesis record must be public before the gift can be claimed."], ["PARTICIPATE", "One qualifying original X post or reply may earn one daily campaign reward."], ["CLAIM", "Every epoch publishes its public root and proof before a wallet can claim."]], proof: "OPEN PROOF BOARD", signal: "OPEN SIGNAL DIRECTORY", foot: "DAILY CAMPAIGN REWARDS ARE NOT APY. THE SEPARATE STAKING POLICY IS PROPOSED, NOT ACTIVE, AND REMAINS ON MAINNET HOLD." },
  tr: {
    eyebrow: "STAR ASCENT // DÜĞÜM ÖDÜLLERİ", title: <>İLK<br /><i>1.000.</i></>, lede: "İlk doğrulanmış düğümler için Başlangıç Hediyesi; ardından her UTC gününde tek, açık bir katılım ritmi.", hold: "CLAIM SİSTEMİ // DOĞRULANMIŞ BAŞLANGIÇ BEKLİYOR", gift: "BAŞLANGIÇ HEDİYESİ", nodes: "DOĞRULANMIŞ DÜĞÜMLER", clock: "GÜNLÜK SNAPSHOT", stats: [["100 IAT", "DOĞRULANMIŞ DÜĞÜM BAŞINA"], ["1.000", "BAŞLANGIÇ CLAIM SINIRI"], ["00:00 UTC", "EPOCH SNAPSHOT"], ["00:05 UTC", "CLAIM AÇILIR"]], staking: "ÖNERİLEN STAKING ORANLARI // AKTİF DEĞİL", stakingIntro: "Ayrı bir sözleşme önerisi, otomatik bileşik olmayan ve haftalık ödenen basit yıllık ödül oranları kullanır. Şu anda staking pozisyonu kabul edilmez.", rates: [["%17", "ÇEKİRDEK EKİP"], ["%10", "STANDART KULLANICI"], ["%28", "CCC AGENT"], ["%20", "CCC ASSOCIATE"]], reserve: "Azami birleşik ödül rezervi: 400M IAT; hazine → ekosistem → likidite sırasıyla kullanılır. Yeni pozisyonlar tam teminatlandırılmalıdır; üç hat da tasarım gereği sıfıra ulaşabilir.", terms: "TÜM EKONOMİ POLİTİKASINI OKU", protocol: "GÜNLÜK DÜĞÜM PROTOKOLÜ", steps: [["BAĞLA", "Bir X hesabı. Bir kamu Solana cüzdanı. Bir imzalı düğüm kaydı."], ["TANIK OL", "Hediye claim edilebilmeden önce doğrulanmış Başlangıç kaydı kamuya açık olmalıdır."], ["KATIL", "Bir özgün, nitelikli X gönderisi veya yanıtı günlük kampanya ödülü kazanabilir."], ["CLAIM ET", "Her epoch, cüzdan claim etmeden önce kamu kökünü ve kanıtını yayımlar."]], proof: "KANIT PANOSUNU AÇ", signal: "SİNYAL DİZİNİNİ AÇ", foot: "GÜNLÜK KAMPANYA ÖDÜLLERİ APY DEĞİLDİR. AYRI STAKING POLİTİKASI ÖNERİDİR, AKTİF DEĞİLDİR VE MAINNET BEKLET DURUMUNDADIR." },
};

export default function RewardsPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => { if (window.location.hostname.includes("ileriakil")) setLanguage("tr"); }, []);
  const t = copy[language];
  return <main className="rewards-page"><div className="rewards-stars" aria-hidden="true" />
    <nav><a href="/">IA<span>///</span></a><a href="/dossier">{language === "en" ? "WHITE DOSSIER" : "BEYAZ DOSYA"} ↗</a></nav>
    <section className="rewards-hero"><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.lede}</span><strong>{t.hold}</strong></section>
    <section className="rewards-statline" aria-label={t.eyebrow}><p>{t.gift}</p><b>{t.stats[0][0]}</b><p>{t.nodes}</p><b>{t.stats[1][0]}</b><p>{t.clock}</p><b>{t.stats[2][0]}</b></section>
    <section className="rewards-grid">{t.stats.map(([value, label], index) => <article key={label}><span>0{index + 1}</span><b>{value}</b><p>{label}</p></article>)}</section>
    <section className="rewards-staking"><p>{t.staking}</p><h2>{t.stakingIntro}</h2><div>{t.rates.map(([rate, label]) => <article key={label}><b>{rate}</b><span>{label}</span></article>)}</div><strong>{t.reserve}</strong><a href="/tokenomics">{t.terms} ↗</a></section>
    <section className="rewards-protocol"><p>{t.protocol}</p><div>{t.steps.map(([heading, body], index) => <article key={heading}><span>0{index + 1}</span><h2>{heading}</h2><p>{body}</p></article>)}</div></section>
    <section className="rewards-links"><a href="/proof">{t.proof} ↗</a><a href="/signal">{t.signal} ↗</a></section><footer>{t.foot}</footer>
  </main>;
}
